import { cn } from "@utils/stringUtils";
import { CustomColorThemeProvider } from "@utils/themeUtils";
import "molstar/build/viewer/molstar.css";
import { StructureSelection } from "molstar/lib/mol-model/structure";
import { setStructureOverpaint } from "molstar/lib/mol-plugin-state/helpers/structure-overpaint";
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
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { MolScriptBuilder } from "molstar/lib/mol-script/language/builder";
import { Script } from "molstar/lib/mol-script/script";
import { Color } from "molstar/lib/mol-util/color";
import { memo, useEffect, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";

export type MoleculeStyle =
  | "spacefill"
  | "ball-and-stick"
  | "surface"
  | "ribbon";

interface MoleculeHighlight {
  label: {
    text: string;
    hexColor: string;
    scale?: number;
  };
  start: number;
  end: number;
  hidden?: true;
}

interface MoleculePayload {
  /** Structure data as string (PDB or mmCIF format) */
  structureString?: string;
  /** Format of the structure data - defaults to 'pdb' for backward compatibility */
  format?: "pdb" | "mmcif";
  highlights?: MoleculeHighlight[];
  indexToColor?: Map<number, string>;
  style?: {
    type: MoleculeStyle;
    params?: Record<string, unknown>;
  };
}

const MoleculeViewer = memo(
  ({
    moleculePayloads,
    className,
    backgroundHexColor,
    defaultStructureHexColor,
  }: {
    moleculePayloads: (MoleculePayload | null)[];
    className?: string;
    backgroundHexColor?: string;
    defaultStructureHexColor?: string;
  }) => {
    const DEFAULT_STRUCTURE_COLOR = defaultStructureHexColor ?? "#94a3b8";
    const DEFAULT_BACKGROUND_COLOR = "#f4f4f4";

    const parentRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const plugin = useRef<PluginContext | null>(null);

    /* ───────────────── init once ───────────────── */
    useEffect(() => {
      (async () => {
        plugin.current = new PluginContext(DefaultPluginSpec());
        if (canvasRef.current && parentRef.current) {
          plugin.current.initViewer(canvasRef.current, parentRef.current);
          plugin.current.canvas3d?.setProps({
            renderer: {
              backgroundColor: Color.fromHexStyle(
                backgroundHexColor ?? DEFAULT_BACKGROUND_COLOR,
              ),
            },
            camera: { helper: { axes: { name: "off", params: {} } } },
          });
        }
        await plugin.current?.init();
      })();
      return () => {
        plugin.current = null;
      };
    }, []);

    /* ───────────────── bg colour updates ───────────────── */
    useEffect(() => {
      if (plugin.current && backgroundHexColor) {
        plugin.current.canvas3d?.setProps({
          renderer: {
            backgroundColor: Color.fromHexStyle(backgroundHexColor),
          },
        });
      }
    }, [backgroundHexColor]);

    /* ───────────────── load / reload structures ───────────────── */
    useEffect(() => {
      const buildStructure = async (payload: MoleculePayload) => {
        if (!plugin.current) return;

        // Get structure string with backward compatibility
        const structureString = payload.structureString;
        if (!structureString) {
          console.warn(
            "No structure data provided. Use structureString property.",
          );
          return;
        }

        // Determine format - default to 'pdb' for backward compatibility
        const format = payload.format ?? "pdb";

        const structureUrl = URL.createObjectURL(
          new Blob([structureString], { type: "text/plain" }),
        );

        /* Colour theme — unchanged from last version */
        let colorTheme = {
          name: "uniform",
          params: { value: Color.fromHexStyle(DEFAULT_STRUCTURE_COLOR) },
        };
        if (payload.indexToColor) {
          const reg =
            plugin.current.representation.structure.themes.colorThemeRegistry;
          const provider = CustomColorThemeProvider({
            indexToColor: payload.indexToColor,
            defaultColor: Color.fromHexStyle(DEFAULT_STRUCTURE_COLOR),
          });
          if (reg.has(provider)) reg.remove(provider);
          reg.add(provider);
          colorTheme = {
            name: "nitro-custom-theme",
            params: { value: Color.fromHexStyle(DEFAULT_STRUCTURE_COLOR) },
          };
        }

        /* <── the only line that really changed */
        const repType = repLookup(payload.style);

        // Build trajectory transform chain based on format
        const builder = plugin.current
          .build()
          .toRoot()
          .apply(Download, { url: structureUrl });

        const trajectoryBuilder =
          format === "mmcif"
            ? builder.apply(ParseCif).apply(TrajectoryFromMmCif)
            : builder.apply(TrajectoryFromPDB);

        return trajectoryBuilder
          .apply(ModelFromTrajectory)
          .apply(StructureFromModel, {
            type: { name: "assembly", params: {} },
          })
          .apply(StructureComponent, {
            type: { name: "static", params: "polymer" },
          })
          .apply(StructureRepresentation3D, { type: repType, colorTheme })
          .commit();
      };

      const render = async () => {
        if (!plugin.current) return;
        plugin.current.canvas3d?.pause();
        plugin.current.clear();

        for (let idx = 0; idx < moleculePayloads.length; idx++) {
          const payload = moleculePayloads[idx];
          if (!payload) continue;
          const struct = await buildStructure(payload);
          if (!struct?.data) continue;

          /* highlights unchanged … */
          payload.highlights?.forEach((h) => {
            const root =
              plugin.current!.managers.structure.hierarchy.current
                .structures[0]!.cell.obj!.data;
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
            const comps =
              plugin.current!.managers.structure.hierarchy.current.structures[
                idx
              ]!.components;
            const loci = StructureSelection.toLociWithSourceUnits(sel);
            setStructureOverpaint(
              plugin.current!,
              comps,
              Color.fromHexStyle(h.label.hexColor),
              async () => loci,
            );
            plugin.current!.managers.structure.measurement.addLabel(loci, {
              labelParams: {
                customText: h.label.text,
                textColor: Color.fromHexStyle(h.label.hexColor),
                sizeFactor: h.label.scale ?? 1,
              },
            });
          });
        }

        plugin.current.canvas3d?.requestCameraReset();
        plugin.current.canvas3d?.resume();
      };

      render();
    }, [moleculePayloads]);

    /* ───────────────── render ───────────────── */
    return (
      <ErrorBoundary
        FallbackComponent={() => <>Something went wrong</>}
        onError={(e) => console.error(e)}
      >
        <div ref={parentRef} className={cn("", className)}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </ErrorBoundary>
    );
  },
);

MoleculeViewer.displayName = "MoleculeViewer";
export type { MoleculeHighlight, MoleculePayload };
export { MoleculeViewer };

/** Map our friendly names → Mol* representation names + sensible defaults */
const repLookup = (style?: MoleculePayload["style"]) => {
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
        params: { sizeFactor: 3, ...style.params }, // beef up width a bit
      };
    default:
      return { name: style.type as MoleculeStyle, params: style.params || {} };
  }
};
