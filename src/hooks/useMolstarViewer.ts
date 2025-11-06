/* eslint-disable @typescript-eslint/no-explicit-any */
import { useSyncExternalStore, useCallback, useMemo, useRef } from "react";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { Color } from "molstar/lib/mol-util/color";
import {
  Download,
  ParseCif,
} from "molstar/lib/mol-plugin-state/transforms/data";
import {
  ModelFromTrajectory,
  StructureComponent,
  StructureFromModel,
  TrajectoryFromPDB,
  TrajectoryFromMmCif,
} from "molstar/lib/mol-plugin-state/transforms/model";
import { StructureRepresentation3D } from "molstar/lib/mol-plugin-state/transforms/representation";
import { StructureSelection } from "molstar/lib/mol-model/structure";
import {
  setStructureOverpaint,
  clearStructureOverpaint,
} from "molstar/lib/mol-plugin-state/helpers/structure-overpaint";
import { MolScriptBuilder } from "molstar/lib/mol-script/language/builder";
import { Script } from "molstar/lib/mol-script/script";
import {
  CustomColorThemeProvider,
  updateCustomThemeStateFor,
  clearThemeStateFor,
} from "@utils/themeUtils";
import { Mat4, Vec3, Quat } from "molstar/lib/mol-math/linear-algebra";
import { Euler } from "molstar/lib/mol-math/linear-algebra/3d/euler";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import type { StateObjectSelector } from "molstar/lib/mol-state/object";

export type MoleculeStyle =
  | "spacefill"
  | "ball-and-stick"
  | "surface"
  | "ribbon";

export interface MoleculeHighlight {
  label: {
    text: string;
    hexColor: string;
    scale?: number;
  };
  start: number;
  end: number;
  hidden?: true;
}

export interface ModelTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export interface MoleculePayload {
  structureString?: string;
  format?: "pdb" | "mmcif";
  highlights?: MoleculeHighlight[];
  indexToColor?: Map<number, string>;
  baseHexColor?: string;
  style?: {
    type: MoleculeStyle;
    params?: Record<string, unknown>;
  };
  transform?: ModelTransform;
}

type ViewerSnapshot = { ready: boolean; plugin: PluginContext | null };

/** Compute a stable key for payload diffing */
function payloadKey(p: MoleculePayload | null, idx: number): string {
  if (!p || !p.structureString) return `empty:${idx}`;
  const s = p.structureString;
  const format = p.format ?? "pdb";
  const styleKey = p.style
    ? `${p.style.type}:${JSON.stringify(p.style.params || {})}`
    : "default";
  // Include style in key calculation so style changes trigger rebuilds
  return `${format}:${idx}:${s.length}:${s.slice(0, 32)}:${s.slice(-32)}:${styleKey}`;
}

/** Check if two highlight arrays are equal (shallow) */
function highlightsEqual(
  a: MoleculeHighlight[] | undefined,
  b: MoleculeHighlight[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((h, i) => {
    const other = b[i];
    return (
      h.start === other.start &&
      h.end === other.end &&
      h.label.text === other.label.text &&
      h.label.hexColor === other.label.hexColor &&
      h.label.scale === other.label.scale &&
      h.hidden === other.hidden
    );
  });
}

/** Map friendly style names to Mol* representation types */
function repLookup(style?: MoleculePayload["style"]) {
  if (!style) return { name: "ribbon", params: {} };

  switch (style.type) {
    case "surface":
      return {
        name: "molecular-surface",
        params: { resolution: 0.5, probeRadius: 1.4, ...style.params },
      };
    case "ribbon":
      return {
        name: "ribbon",
        params: { sizeFactor: 3, ...style.params },
      };
    default:
      return { name: style.type as MoleculeStyle, params: style.params || {} };
  }
}

/** Create a Mat4 transformation matrix from position and rotation (Euler degrees) */
function createTransformMatrix(transform: ModelTransform): Mat4 {
  const { position, rotation } = transform;

  // Create rotation matrix from Euler angles (convert degrees to radians)
  const euler = Euler.create(
    (rotation.x * Math.PI) / 180,
    (rotation.y * Math.PI) / 180,
    (rotation.z * Math.PI) / 180,
  );

  // Convert Euler to quaternion
  const quat = Quat();
  Quat.fromEuler(quat, euler, "XYZ");

  // Create 4x4 rotation matrix from quaternion
  const matrix = Mat4();
  Mat4.fromQuat(matrix, quat);

  // Set translation component (ensures pure rotation + translation)
  const translation = Vec3.create(position.x, position.y, position.z);
  Mat4.setTranslation(matrix, translation);

  return matrix;
}

/** Check if two transforms are equal */
function transformsEqual(
  a: ModelTransform | undefined,
  b: ModelTransform | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.position.z === b.position.z &&
    a.rotation.x === b.rotation.x &&
    a.rotation.y === b.rotation.y &&
    a.rotation.z === b.rotation.z
  );
}

/** Check if two color maps are shallowly equal */
function mapShallowEqual(
  a: Map<number, string> | null | undefined,
  b: Map<number, string> | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

type InitState = "idle" | "pending" | "ready";

// Type for storing label references (complex Molstar types, use unknown for storage)
type LabelRef = { selection: unknown; representation: unknown };

export class MolstarViewerStore {
  private listeners = new Set<() => void>();
  private _snapshot: ViewerSnapshot = { ready: false, plugin: null };

  private initState: InitState = "idle";
  private initPromise: Promise<void> | null = null;
  private viewerAttached = false;

  private structureKeys: string[] = [];
  private lastHighlights: (MoleculeHighlight[] | undefined)[] = [];
  // Track label refs for each structure: Map<structureIndex, labelRefs[]>
  private labelRefs: Map<number, LabelRef[]> = new Map();
  // Track transform node refs: Map<structureIndex, transform selector>
  private transformRefs: Map<number, StateObjectSelector> = new Map();
  // Track last transforms to detect changes
  private lastTransforms: (ModelTransform | undefined)[] = [];

  // Per-structure theme state
  private themePrefix: string;
  private themeNamesByIndex = new Map<number, string>();
  private themeProvidersByIndex = new Map<
    number,
    ReturnType<typeof CustomColorThemeProvider>
  >();
  private lastIndexToColorByIndex: (Map<number, string> | null)[] = [];
  private lastBaseHexByIndex: (string | null)[] = [];
  private hasCustomThemeIndex = new Set<number>();
  private currentDefaultColorHex = "#94a3b8";

  constructor(private id = crypto.randomUUID()) {
    // Per-viewer theme prefix to prevent cross-viewer color bleeding
    this.themePrefix = `nitro-custom-theme:${this.id}`;
  }

  getSnapshot(): ViewerSnapshot {
    return this._snapshot;
  }

  private setSnapshot(next: ViewerSnapshot) {
    // Only update reference & notify if something actually changed
    if (
      next.ready !== this._snapshot.ready ||
      next.plugin !== this._snapshot.plugin
    ) {
      this._snapshot = next;
      this.emit();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async init(
    canvas: HTMLCanvasElement,
    parent: HTMLDivElement,
    opts?: { background?: string; defaultColor?: string },
  ): Promise<void> {
    // Already fully initialized
    if (this.initState === "ready") return;

    // Init in progress - return the existing promise
    if (this.initState === "pending") return this.initPromise!;

    this.initState = "pending";
    this.initPromise = (async () => {
      try {
        // Create plugin context once
        if (!this._snapshot.plugin) {
          const plugin = new PluginContext(DefaultPluginSpec());
          // IMPORTANT: plugin.init() registers all behaviors/custom props → call exactly once
          await plugin.init();
          this.setSnapshot({ ready: false, plugin });
        }

        // Attach DOM once
        if (!this.viewerAttached && this._snapshot.plugin) {
          await this._snapshot.plugin.initViewer(canvas, parent);
          this.viewerAttached = true;
        }

        const backgroundColor = opts?.background ?? "#f4f4f4";
        this.currentDefaultColorHex = opts?.defaultColor ?? "#94a3b8";

        // Set initial props
        this._snapshot.plugin!.canvas3d?.setProps({
          renderer: {
            backgroundColor: Color.fromHexStyle(backgroundColor),
          },
          camera: { helper: { axes: { name: "off", params: {} } } },
        });

        this.initState = "ready";
        this.setSnapshot({ ready: true, plugin: this._snapshot.plugin });
      } catch (error) {
        this.initState = "idle";
        this.initPromise = null;
        console.error("Failed to initialize Molstar viewer:", error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  unmountCanvas(): void {
    // Mark as not attached so we could reattach later if needed
    this.viewerAttached = false;
  }

  /**
   * Resolve the appropriate color theme for a structure at a given index
   * Returns theme name and params based on indexToColor map and baseHexColor
   */
  private async resolveThemeForStructure(
    idx: number,
    indexToColor: Map<number, string> | null | undefined,
    baseHex: string | null | undefined,
  ): Promise<{ name: string; params: Record<string, unknown> }> {
    if (!this._snapshot.plugin) {
      return {
        name: "uniform",
        params: { value: Color.fromHexStyle(this.currentDefaultColorHex) },
      };
    }

    // Determine the base color for this structure
    const baseColor = baseHex ?? this.currentDefaultColorHex;

    // If we have a color map, use custom theme
    if (indexToColor && indexToColor.size > 0) {
      const themeName = `${this.themePrefix}:${idx}`;
      this.themeNamesByIndex.set(idx, themeName);

      // Update theme state with base color fallback
      updateCustomThemeStateFor(
        themeName,
        indexToColor,
        Color.fromHexStyle(baseColor),
      );

      // Register provider if not already registered in Mol*'s registry
      const reg =
        this._snapshot.plugin.representation.structure.themes
          .colorThemeRegistry;
      if (!this.themeProvidersByIndex.has(idx)) {
        const provider = CustomColorThemeProvider(themeName);
        try {
          // Try to add the provider - will throw if already registered
          reg.add(provider);
        } catch (e) {
          // Provider already exists in registry (e.g., after rebuild)
          // This is fine - we'll just use the existing one
        }
        this.themeProvidersByIndex.set(idx, provider);
      }

      this.hasCustomThemeIndex.add(idx);

      return {
        name: themeName,
        params: { value: Color.fromHexStyle(baseColor) },
      };
    }

    // No custom map - use uniform theme with base color
    this.hasCustomThemeIndex.delete(idx);
    return {
      name: "uniform",
      params: { value: Color.fromHexStyle(baseColor) },
    };
  }

  dispose(): void {
    this.viewerAttached = false;
    if (this._snapshot.plugin) {
      this._snapshot.plugin.dispose();
    }
    this.structureKeys = [];
    this.lastHighlights = [];
    this.labelRefs.clear();
    this.transformRefs.clear();
    this.lastTransforms = [];
    this.initState = "idle";
    this.initPromise = null;

    // Clean up all per-structure theme state to prevent memory leaks
    for (const themeName of this.themeNamesByIndex.values()) {
      clearThemeStateFor(themeName);
    }
    this.themeNamesByIndex.clear();
    this.themeProvidersByIndex.clear();
    this.lastIndexToColorByIndex = [];
    this.lastBaseHexByIndex = [];
    this.hasCustomThemeIndex.clear();

    // Update snapshot once with both ready and plugin
    this.setSnapshot({ ready: false, plugin: null });
  }

  setBackground(hex: string): void {
    if (!this._snapshot.plugin) return;
    this._snapshot.plugin.canvas3d?.setProps({
      renderer: {
        backgroundColor: Color.fromHexStyle(hex),
      },
    });
    this._snapshot.plugin.canvas3d?.requestDraw();
  }

  async ensurePayloads(
    payloads: (MoleculePayload | null)[],
    defaultHex?: string,
  ): Promise<void> {
    if (!this._snapshot.plugin) return;

    if (defaultHex) {
      this.currentDefaultColorHex = defaultHex;
    }

    try {
      // Pause rendering during bulk operations
      this._snapshot.plugin.canvas3d?.pause();

      // Check which payloads need to be built
      const newKeys = payloads.map((p, idx) => payloadKey(p, idx));
      const needsBuild: number[] = [];

      for (let i = 0; i < newKeys.length; i++) {
        if (newKeys[i] !== this.structureKeys[i]) {
          needsBuild.push(i);
        }
      }

      const isGrowing = newKeys.length > this.structureKeys.length;
      const isShrinking = newKeys.length < this.structureKeys.length;
      const isPureAddition =
        isGrowing && needsBuild.every((i) => i >= this.structureKeys.length);

      // Determine rebuild strategy
      if (isShrinking || (needsBuild.length > 0 && !isPureAddition)) {
        // Full rebuild needed: structures removed or existing ones changed
        this._snapshot.plugin.clear();
        this.structureKeys = [];
        this.lastHighlights = [];
        this.labelRefs.clear();
        this.transformRefs.clear();
        this.lastTransforms = [];

        // Clear per-structure theme state
        for (const themeName of this.themeNamesByIndex.values()) {
          clearThemeStateFor(themeName);
        }
        this.themeNamesByIndex.clear();
        this.themeProvidersByIndex.clear();
        this.lastIndexToColorByIndex = [];
        this.lastBaseHexByIndex = [];
        this.hasCustomThemeIndex.clear();

        for (let idx = 0; idx < payloads.length; idx++) {
          const payload = payloads[idx];
          if (!payload || !payload.structureString) continue;

          await this.buildStructure(payload, idx);
          this.structureKeys.push(newKeys[idx]);

          // Apply transform if specified
          if (payload.transform) {
            const structures =
              this._snapshot.plugin.managers.structure.hierarchy.current
                .structures;
            const struct = structures[idx];

            if (struct) {
              const matrix = createTransformMatrix(payload.transform);
              const update = this._snapshot.plugin
                .build()
                .to(struct.cell)
                .insert(StateTransforms.Model.TransformStructureConformation, {
                  transform: {
                    name: "matrix",
                    params: { data: matrix, transpose: false },
                  },
                });

              const res = await update.commit();
              // Handle Molstar version differences: result may be selector or { selector }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const selector = (res as any)?.selector ?? res;
              this.transformRefs.set(idx, selector);
              this.lastTransforms[idx] = payload.transform;
            }
          }
        }

        // Reset camera after new structures are loaded
        this._snapshot.plugin.canvas3d?.requestCameraReset();
      } else if (isPureAddition) {
        // Incremental addition - only build new structures
        for (
          let idx = this.structureKeys.length;
          idx < payloads.length;
          idx++
        ) {
          const payload = payloads[idx];
          if (!payload || !payload.structureString) continue;

          await this.buildStructure(payload, idx);
          this.structureKeys.push(newKeys[idx]);

          // Apply transform if specified
          if (payload.transform) {
            const structures =
              this._snapshot.plugin.managers.structure.hierarchy.current
                .structures;
            const struct = structures[idx];

            if (struct) {
              const matrix = createTransformMatrix(payload.transform);
              const update = this._snapshot.plugin
                .build()
                .to(struct.cell)
                .insert(StateTransforms.Model.TransformStructureConformation, {
                  transform: {
                    name: "matrix",
                    params: { data: matrix, transpose: false },
                  },
                });

              const res = await update.commit();
              // Handle Molstar version differences: result may be selector or { selector }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const selector = (res as any)?.selector ?? res;
              this.transformRefs.set(idx, selector);
              this.lastTransforms[idx] = payload.transform;
            }
          }
        }
        // No camera reset for incremental additions - keeps current view
      }

      this._snapshot.plugin.canvas3d?.resume();
    } catch (error) {
      console.error("Failed to ensure payloads:", error);
      this._snapshot.plugin.canvas3d?.resume();
    }
  }

  private async buildStructure(
    payload: MoleculePayload,
    idx: number,
  ): Promise<void> {
    if (!this._snapshot.plugin || !payload.structureString) return;

    const format = payload.format ?? "pdb";
    const blob = new Blob([payload.structureString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    try {
      // Resolve color theme for this structure
      const colorTheme = await this.resolveThemeForStructure(
        idx,
        payload.indexToColor ?? null,
        payload.baseHexColor ?? null,
      );

      const repType = repLookup(payload.style);

      // Build transform chain
      const builder = this._snapshot.plugin
        .build()
        .toRoot()
        .apply(Download, { url });

      const trajectoryBuilder =
        format === "mmcif"
          ? builder.apply(ParseCif).apply(TrajectoryFromMmCif)
          : builder.apply(TrajectoryFromPDB);

      await trajectoryBuilder
        .apply(ModelFromTrajectory)
        .apply(StructureFromModel, {
          type: { name: "assembly", params: {} },
        })
        .apply(StructureComponent, {
          type: { name: "static", params: "polymer" },
        })
        .apply(StructureRepresentation3D, { type: repType, colorTheme })
        .commit();
    } finally {
      // Always revoke the blob URL to prevent memory leak
      URL.revokeObjectURL(url);
    }
  }

  async applyHighlights(payloads: (MoleculePayload | null)[]): Promise<void> {
    if (!this._snapshot.plugin) return;

    try {
      const structures =
        this._snapshot.plugin.managers.structure.hierarchy.current.structures;
      const state = this._snapshot.plugin.state.data;

      // Process each structure individually
      for (let idx = 0; idx < payloads.length; idx++) {
        const payload = payloads[idx];
        const newHighlights = payload?.highlights;
        const oldHighlights = this.lastHighlights[idx];

        // Skip if highlights haven't changed for this structure
        if (highlightsEqual(newHighlights, oldHighlights)) {
          continue;
        }

        const structureRef = structures[idx];
        if (!structureRef?.cell?.obj?.data) continue;

        const root = structureRef.cell.obj.data;
        const comps = structureRef.components;

        // Clear overpaint for this structure
        await clearStructureOverpaint(this._snapshot.plugin, comps);

        // Reset theme before applying overpaint - use per-structure base theme
        if (comps.length > 0) {
          const baseTheme = await this.resolveThemeForStructure(
            idx,
            payload?.indexToColor ?? null,
            payload?.baseHexColor ?? null,
          );

          await (
            this._snapshot.plugin.managers.structure.component
              .updateRepresentationsTheme as any
          )(
            // eslint-disable-line @typescript-eslint/no-explicit-any
            comps,
            {
              color: baseTheme.name,
              colorParams: baseTheme.params,
            },
          );
        }

        const existingLabels = this.labelRefs.get(idx) || [];
        const visibleHighlights = (newHighlights || []).filter(
          (h) => !h.hidden,
        );

        // Check if we can update labels in place
        const canUpdateInPlace =
          existingLabels.length === visibleHighlights.length &&
          existingLabels.length > 0;

        if (canUpdateInPlace) {
          // Update existing labels imperatively
          const update = state.build();

          for (let i = 0; i < visibleHighlights.length; i++) {
            const h = visibleHighlights[i];
            const labelRef = existingLabels[i];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            update.to(labelRef.representation as any).update({
              customText: h.label.text,
              textColor: Color.fromHexStyle(h.label.hexColor),
              sizeFactor: h.label.scale ?? 1,
            });
          }

          await update.commit();
        } else {
          // Delete old labels (both selection and representation to avoid state bloat)
          if (existingLabels.length > 0) {
            const deleteUpdate = state.build();
            for (const labelRef of existingLabels) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              deleteUpdate.delete((labelRef.selection as any).ref);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              deleteUpdate.delete((labelRef.representation as any).ref);
            }
            await deleteUpdate.commit();
            this.labelRefs.delete(idx);
          }

          // Create new labels
          if (visibleHighlights.length > 0) {
            const newLabelRefs: LabelRef[] = [];

            for (const h of visibleHighlights) {
              const sel = Script.getStructureSelection(
                (Q) =>
                  Q.struct.generator.atomGroups({
                    "residue-test": Q.core.rel.inRange([
                      MolScriptBuilder.struct.atomProperty.macromolecular.label_seq_id(),
                      h.start,
                      h.end,
                    ]),
                    "group-by":
                      Q.struct.atomProperty.macromolecular.residueKey(),
                  }),
                root,
              );

              const loci = StructureSelection.toLociWithSourceUnits(sel);

              // Add label and store ref
              const labelRef =
                await this._snapshot.plugin.managers.structure.measurement.addLabel(
                  loci,
                  {
                    labelParams: {
                      customText: h.label.text,
                      textColor: Color.fromHexStyle(h.label.hexColor),
                      sizeFactor: h.label.scale ?? 1,
                    },
                  },
                );

              if (labelRef) {
                newLabelRefs.push(labelRef);
              }
            }

            this.labelRefs.set(idx, newLabelRefs);
          }
        }

        // Reapply overpaint with new colors
        if (visibleHighlights.length > 0) {
          for (const h of visibleHighlights) {
            const sel = Script.getStructureSelection(
              (Q) =>
                Q.struct.generator.atomGroups({
                  "residue-test": Q.core.rel.inRange([
                    MolScriptBuilder.struct.atomProperty.macromolecular.label_seq_id(),
                    h.start,
                    h.end,
                  ]),
                  "group-by": Q.struct.atomProperty.macromolecular.residueKey(),
                }),
              root,
            );

            const loci = StructureSelection.toLociWithSourceUnits(sel);

            await setStructureOverpaint(
              this._snapshot.plugin,
              comps,
              Color.fromHexStyle(h.label.hexColor),
              async () => loci,
            );
          }
        }

        this.lastHighlights[idx] = newHighlights;
      }

      this._snapshot.plugin.canvas3d?.requestDraw();
    } catch (error) {
      console.error("Failed to apply highlights:", error);
    }
  }

  async applyTransforms(payloads: (MoleculePayload | null)[]): Promise<void> {
    if (!this._snapshot.plugin) return;

    try {
      const state = this._snapshot.plugin.state.data;
      const structures =
        this._snapshot.plugin.managers.structure.hierarchy.current.structures;

      // Process each structure individually
      for (let idx = 0; idx < payloads.length; idx++) {
        const payload = payloads[idx];
        const newTransform = payload?.transform;
        const oldTransform = this.lastTransforms[idx];

        // Skip if transform hasn't changed for this structure
        if (transformsEqual(newTransform, oldTransform)) {
          continue;
        }

        const transformRef = this.transformRefs.get(idx);
        const struct = structures[idx];

        if (transformRef && newTransform) {
          // Update existing transform
          const matrix = createTransformMatrix(newTransform);

          await state
            .build()
            .to(transformRef)
            .update({
              transform: {
                name: "matrix",
                params: { data: matrix, transpose: false },
              },
            })
            .commit();

          this.lastTransforms[idx] = newTransform;
        } else if (!transformRef && newTransform && struct) {
          // Add new transform
          const matrix = createTransformMatrix(newTransform);
          const update = this._snapshot.plugin
            .build()
            .to(struct.cell)
            .insert(StateTransforms.Model.TransformStructureConformation, {
              transform: {
                name: "matrix",
                params: { data: matrix, transpose: false },
              },
            });

          const res = await update.commit();
          // Handle Molstar version differences: result may be selector or { selector }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const selector = (res as any)?.selector ?? res;
          this.transformRefs.set(idx, selector);
          this.lastTransforms[idx] = newTransform;
        } else if (transformRef && !newTransform) {
          // Remove transform
          await state.build().delete(transformRef.ref).commit();
          this.transformRefs.delete(idx);
          this.lastTransforms[idx] = undefined;
        }
      }

      this._snapshot.plugin.canvas3d?.requestDraw();
    } catch (error) {
      console.error("Failed to apply transforms:", error);
    }
  }

  async applyThemes(payloads: (MoleculePayload | null)[]): Promise<void> {
    if (!this._snapshot.plugin) return;

    try {
      const structures =
        this._snapshot.plugin.managers.structure.hierarchy.current.structures;

      // Process each structure individually
      for (let idx = 0; idx < payloads.length; idx++) {
        const payload = payloads[idx];
        const newMap = payload?.indexToColor ?? null;
        const newBase = payload?.baseHexColor ?? null;
        const oldMap = this.lastIndexToColorByIndex[idx] ?? null;
        const oldBase = this.lastBaseHexByIndex[idx] ?? null;

        // Skip if both map and base color haven't changed for this structure
        if (mapShallowEqual(newMap, oldMap) && newBase === oldBase) {
          continue;
        }

        const struct = structures[idx];
        if (!struct || struct.components.length === 0) continue;

        // Resolve theme for this structure
        const colorTheme = await this.resolveThemeForStructure(
          idx,
          newMap,
          newBase,
        );

        // Update the representation theme
        await (
          this._snapshot.plugin.managers.structure.component
            .updateRepresentationsTheme as any
        )(struct.components, {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          color: colorTheme.name,
          colorParams: colorTheme.params,
        });

        // Update cache
        this.lastIndexToColorByIndex[idx] = newMap;
        this.lastBaseHexByIndex[idx] = newBase;
      }

      this._snapshot.plugin.canvas3d?.requestDraw();
    } catch (error) {
      console.error("Failed to apply themes:", error);
    }
  }

  /**
   * Legacy API for backward compatibility
   * Applies the same color map to all structures
   * @deprecated Use applyThemes() instead for per-structure themes
   */
  async setCustomTheme(
    indexToColor: Map<number, string> | null,
    defaultHex?: string,
  ): Promise<void> {
    if (!this._snapshot.plugin) return;

    if (defaultHex) {
      this.currentDefaultColorHex = defaultHex;
    }

    try {
      // Get all loaded structures
      const structures =
        this._snapshot.plugin.managers.structure.hierarchy.current.structures;

      // Create synthetic payloads array with same map for all structures
      const syntheticPayloads: (MoleculePayload | null)[] = structures.map(
        () => ({
          indexToColor: indexToColor ?? undefined,
          baseHexColor: undefined,
        }),
      );

      // Delegate to applyThemes
      await this.applyThemes(syntheticPayloads);
    } catch (error) {
      console.error("Failed to set custom theme:", error);
    }
  }
}

// Global store registry
const viewerStores = new Map<string, MolstarViewerStore>();

function getOrCreateStore(viewerId: string): MolstarViewerStore {
  if (!viewerStores.has(viewerId)) {
    viewerStores.set(viewerId, new MolstarViewerStore());
  }
  return viewerStores.get(viewerId)!;
}

/**
 * Destroy a viewer store and clean up all resources
 * Call this when a viewer is unmounted to prevent memory leaks
 */
export function destroyViewer(viewerId: string): void {
  const store = viewerStores.get(viewerId);
  if (store) {
    store.dispose();
    viewerStores.delete(viewerId);
  }
}

export function useMolstarViewer(viewerId: string) {
  const storeRef = useRef(getOrCreateStore(viewerId));
  const store = storeRef.current;

  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(listener),
    [store],
  );
  const getSnap = useCallback(() => store.getSnapshot(), [store]);

  const snapshot = useSyncExternalStore(subscribe, getSnap, getSnap);

  const api = useMemo(
    () => ({
      init: (
        canvas: HTMLCanvasElement,
        parent: HTMLDivElement,
        opts?: { background?: string; defaultColor?: string },
      ) => store.init(canvas, parent, opts),
      dispose: () => store.dispose(),
      unmountCanvas: () => store.unmountCanvas(),
      ensurePayloads: (
        payloads: (MoleculePayload | null)[],
        defaultHex?: string,
      ) => store.ensurePayloads(payloads, defaultHex),
      applyHighlights: (payloads: (MoleculePayload | null)[]) =>
        store.applyHighlights(payloads),
      applyTransforms: (payloads: (MoleculePayload | null)[]) =>
        store.applyTransforms(payloads),
      applyThemes: (payloads: (MoleculePayload | null)[]) =>
        store.applyThemes(payloads),
      setBackground: (hex: string) => store.setBackground(hex),
      setCustomTheme: (
        indexToColor: Map<number, string> | null,
        defaultHex?: string,
      ) => store.setCustomTheme(indexToColor, defaultHex),
    }),
    [store],
  );

  return {
    ready: snapshot.ready,
    plugin: snapshot.plugin,
    api,
  };
}
