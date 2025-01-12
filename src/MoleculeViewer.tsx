import { cn } from "@utils/stringUtils";
import { CustomColorThemeProvider } from "@utils/themeUtils";
import "molstar/build/viewer/molstar.css";
import { StructureSelection } from "molstar/lib/mol-model/structure";
import { setStructureOverpaint } from "molstar/lib/mol-plugin-state/helpers/structure-overpaint";
import { Download } from "molstar/lib/mol-plugin-state/transforms/data";
import {
  ModelFromTrajectory,
  StructureComponent,
  StructureFromModel,
  TrajectoryFromPDB,
} from "molstar/lib/mol-plugin-state/transforms/model";
import { StructureRepresentation3D } from "molstar/lib/mol-plugin-state/transforms/representation";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { MolScriptBuilder } from "molstar/lib/mol-script/language/builder";
import { Script } from "molstar/lib/mol-script/script";
import { Color } from "molstar/lib/mol-util/color";
import { memo, useEffect, useRef } from "react";

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
  pdbString: string;
  highlights?: MoleculeHighlight[];
  indexToColor?: Map<number, string>;
}

const DEFAULT_STRUCTURE_COLOR = "#94a3b8";
const DEFAULT_BACKGROUND_COLOR = "#f4f4f4";

const MoleculeViewer = memo(
  ({
    moleculePayloads,
    className,
    backgroundHexColor,
  }: {
    moleculePayloads: (MoleculePayload | null)[];
    className?: string;
    backgroundHexColor?: string;
  }) => {
    const parentRef = useRef(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const plugin = useRef<PluginContext | null>(null);

    useEffect(function onInit() {
      (async () => {
        plugin.current = new PluginContext(DefaultPluginSpec());
        if (canvasRef.current && parentRef.current) {
          plugin.current.initViewer(canvasRef.current, parentRef.current);
          /* remove axes and set background transparent */
          plugin.current.canvas3d?.setProps({
            renderer: {
              backgroundColor: Color.fromHexStyle(
                backgroundHexColor ?? DEFAULT_BACKGROUND_COLOR,
              ),
            },
            camera: {
              helper: {
                axes: {
                  name: "off",
                  params: {},
                },
              },
            },
          });
        }
        await plugin.current.init();
      })();
      return () => {
        plugin.current = null;
      };
    }, []);

    useEffect(
      function onBackgroundChange() {
        if (plugin.current && backgroundHexColor) {
          plugin.current.canvas3d?.setProps({
            renderer: {
              backgroundColor: Color.fromHexStyle(backgroundHexColor),
            },
          });
        }
      },
      [backgroundHexColor],
    );

    useEffect(
      function onMoleculePayloadsChange() {
        const loadStructure = async ({
          pdbString,
          indexToColor,
          plugin,
        }: {
          pdbString: string;
          indexToColor: MoleculePayload["indexToColor"];
          plugin: PluginContext | null;
        }) => {
          if (plugin) {
            const blob = new Blob([pdbString], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            let colorTheme = {
              name: "uniform",
              params: {
                value: Color.fromHexStyle(DEFAULT_STRUCTURE_COLOR),
              },
            };
            if (indexToColor) {
              const registry =
                plugin.representation.structure.themes.colorThemeRegistry;
              const provider = CustomColorThemeProvider({
                indexToColor: indexToColor,
                defaultColor: Color.fromHexStyle(DEFAULT_STRUCTURE_COLOR),
              });
              if (registry.has(provider)) {
                registry.remove(provider);
              }
              // register custom theme
              registry.add(provider);

              colorTheme = {
                name: "nitro-custom-theme",
                params: {},
              };
            }
            const structure = await plugin
              .build()
              .toRoot()
              .apply(Download, { url })
              .apply(TrajectoryFromPDB)
              .apply(ModelFromTrajectory)
              .apply(StructureFromModel, {
                type: { name: "assembly", params: {} },
              })
              .apply(StructureComponent, {
                type: { name: "static", params: "polymer" },
              })
              .apply(StructureRepresentation3D, {
                colorTheme,
              })
              .commit();
            return structure;
          }
        };

        const _onMoleculePayloadsChange = async () => {
          plugin.current!.canvas3d?.pause();
          plugin.current!.clear();
          moleculePayloads.forEach(async (payload, idx) => {
            if (!payload) {
              return;
            }
            const struct = await loadStructure({
              pdbString: payload.pdbString,
              indexToColor: payload.indexToColor,
              plugin: plugin.current,
            });
            if (!struct?.data) {
              return;
            }

            payload.highlights?.forEach((highlight) => {
              const { start, end, label } = highlight;
              const structure =
                plugin.current!.managers.structure.hierarchy.current
                  .structures[0].cell.obj?.data;
              const selection = Script.getStructureSelection(
                (Q) =>
                  Q.struct.generator.atomGroups({
                    "residue-test": Q.core.rel.inRange([
                      MolScriptBuilder.struct.atomProperty.macromolecular.label_seq_id(),
                      start,
                      end,
                    ]),
                    "group-by":
                      Q.struct.atomProperty.macromolecular.residueKey(),
                  }),
                structure!,
              );
              const lociGetter = async () =>
                StructureSelection.toLociWithSourceUnits(selection);

              const components =
                plugin.current!.managers.structure.hierarchy.current.structures[
                  idx
                ].components;

              setStructureOverpaint(
                plugin.current!,
                components,
                Color.fromHexStyle(label.hexColor),
                lociGetter,
              );
              const loci = StructureSelection.toLociWithSourceUnits(selection);
              plugin.current!.managers.structure.measurement.addLabel(loci, {
                labelParams: {
                  customText: label.text,
                  textColor: Color.fromHexStyle(label.hexColor),
                  sizeFactor: label.scale ?? 1.0,
                },
              });
            });
          });
          plugin.current!.canvas3d?.requestCameraReset();
        };
        _onMoleculePayloadsChange();
      },
      [moleculePayloads],
    );

    return (
      <div ref={parentRef} className={cn("", className)}>
        <canvas
          ref={canvasRef}
          className=""
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  },
);

MoleculeViewer.displayName = "MoleculeViewer";

export { MoleculeViewer };
export type { MoleculeHighlight, MoleculePayload };
