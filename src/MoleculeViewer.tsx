import { cn } from "@utils/stringUtils";
import "molstar/build/viewer/molstar.css";
import { StructureSelection } from "molstar/lib/mol-model/structure";
import { setStructureOverpaint } from "molstar/lib/mol-plugin-state/helpers/structure-overpaint";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
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
  structureHexColor?: string;
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
          structureHexColor,
          plugin,
        }: {
          pdbString: string;
          structureHexColor?: string;
          plugin: PluginContext | null;
        }) => {
          if (plugin) {
            const data = await plugin.builders.data.rawData({
              data: pdbString,
              label: void 0,
            });
            const trajectory = await plugin.builders.structure.parseTrajectory(
              data,
              "pdb",
            );

            if (trajectory) {
              const params = {
                representationPresetParams: {
                  theme: {
                    globalName: "uniform",
                    globalColorParams: {
                      value: Color.fromHexStyle(
                        structureHexColor ?? DEFAULT_STRUCTURE_COLOR,
                      ),
                    },
                  },
                },
              };

              await plugin.builders.structure.hierarchy.applyPreset(
                trajectory,
                "default",
                params,
              );
            }
          }
        };

        const _onMoleculePayloadsChange = async () => {
          // pause the viewer
          plugin.current!.canvas3d?.pause();
          // reset the structure
          plugin.current!.clear();

          // Load all structures
          for (const payload of moleculePayloads) {
            if (!payload) {
              continue;
            }
            await loadStructure({
              pdbString: payload.pdbString,
              structureHexColor: payload.structureHexColor,
              plugin: plugin.current,
            });

            // Apply highlights for each molecule
            payload.highlights?.forEach((highlight) =>
              colorResidues(highlight),
            );
          }
          // reset camera
          plugin.current!.canvas3d?.requestCameraReset();
        };
        _onMoleculePayloadsChange();
      },
      [moleculePayloads],
    );

    const colorResidues = ({
      start,
      end,
      label,
      hidden,
    }: MoleculeHighlight) => {
      if (hidden) {
        return;
      }
      const range = Array.from(
        //creates an array of all numbers in [start, end]
        { length: end - start },
        (_, idx) => idx + start,
      );

      const data =
        plugin.current!.managers.structure.hierarchy.current.structures[0]?.cell
          .obj?.data;
      if (!data) {
        console.debug("Problem with data, try to reload viewer.");
        return;
      }

      const selection = Script.getStructureSelection(
        (Q) =>
          Q.struct.generator.atomGroups({
            "residue-test": Q.core.set.has([
              Q.set(...range),
              Q.ammp("auth_seq_id"),
            ]),
            "group-by": Q.struct.atomProperty.macromolecular.residueKey(),
          }),
        data,
      );
      const lociGetter = async () =>
        StructureSelection.toLociWithSourceUnits(selection);

      const components =
        plugin.current!.managers.structure.hierarchy.current.structures[0]
          .components;

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
    };

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
