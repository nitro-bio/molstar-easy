import { StructureElement } from "molstar/lib/mol-model/structure";
import { ColorTheme, LocationColor } from "molstar/lib/mol-theme/color";
import {
  EntityIdColorThemeParams,
  getEntityIdColorThemeParams,
} from "molstar/lib/mol-theme/color/entity-id";
import { ThemeDataContext } from "molstar/lib/mol-theme/theme";
import { Color } from "molstar/lib/mol-util/color";
import { TableLegend } from "molstar/lib/mol-util/legend";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition";

export function CustomColorTheme(
  ctx: ThemeDataContext,
  props: PD.Values<EntityIdColorThemeParams>,
  indexToColor: Map<number, string>,
  defaultColor: Color,
): ColorTheme<EntityIdColorThemeParams> {
  // TODO: check this
  const color: LocationColor = (location) => {
    if (StructureElement.Location.is(location)) {
      const unsafeUnit = location.unit as unknown as { residueIndex: number[] };
      const residueIndex = unsafeUnit.residueIndex[location.element] ?? -1;
      return indexToColor.has(residueIndex)
        ? Color.fromHexStyle(indexToColor.get(residueIndex)!)
        : defaultColor;
    } else {
      console.log("location is not a StructureElement.Location");
      return defaultColor;
    }
  };
  return {
    granularity: "group",
    factory: () => CustomColorTheme(ctx, props, indexToColor, defaultColor),
    color: color,
    props: props,
    description: "Assigns colors based on a custom index",
    legend: TableLegend(
      Array.from(indexToColor.entries()).map(([index, colorString]) => [
        index.toString(),
        Color.fromHexString(colorString),
      ]),
    ),
  };
}
export const CustomColorThemeProvider = ({
  indexToColor,
  defaultColor,
}: {
  indexToColor: Map<number, string>;
  defaultColor: Color;
}): ColorTheme.Provider<EntityIdColorThemeParams, "nitro-custom-theme"> => {
  return {
    name: "nitro-custom-theme",
    label: "Nitro Theme",
    category: "Foo",
    factory: (
      ctx: ThemeDataContext,
      props: PD.Values<EntityIdColorThemeParams>,
    ) => {
      return CustomColorTheme(ctx, props, indexToColor, defaultColor);
    },
    getParams: getEntityIdColorThemeParams,
    defaultValues: PD.getDefaultValues(EntityIdColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => !!ctx.structure,
  };
};
