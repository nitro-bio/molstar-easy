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

// Global mutable singleton for custom theme state
// This allows us to update colors without re-registering the provider
const CustomThemeState = {
  indexToColor: new Map<number, string>(),
  defaultColor: Color(0x94a3b8), // #94a3b8
};

/**
 * Update the global custom theme state
 * Call this before applying theme updates to representations
 */
export function updateCustomThemeState(
  indexToColor: Map<number, string>,
  defaultColor: Color,
): void {
  CustomThemeState.indexToColor = indexToColor;
  CustomThemeState.defaultColor = defaultColor;
}

export function CustomColorTheme(
  ctx: ThemeDataContext,
  props: PD.Values<EntityIdColorThemeParams>,
): ColorTheme<EntityIdColorThemeParams> {
  // Read from global singleton instead of closure
  const { indexToColor, defaultColor } = CustomThemeState;

  const color: LocationColor = (location) => {
    if (StructureElement.Location.is(location)) {
      const unsafeUnit = location.unit as unknown as { residueIndex: number[] };
      const residueIndex = unsafeUnit.residueIndex[location.element] ?? -1;
      return indexToColor.has(residueIndex)
        ? Color.fromHexStyle(indexToColor.get(residueIndex)!)
        : defaultColor;
    } else {
      return defaultColor;
    }
  };

  return {
    granularity: "group",
    factory: () => CustomColorTheme(ctx, props),
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

export const CustomColorThemeProvider = (): ColorTheme.Provider<EntityIdColorThemeParams, "nitro-custom-theme"> => {
  return {
    name: "nitro-custom-theme",
    label: "Nitro Theme",
    category: "Foo",
    factory: (
      ctx: ThemeDataContext,
      props: PD.Values<EntityIdColorThemeParams>,
    ) => {
      return CustomColorTheme(ctx, props);
    },
    getParams: getEntityIdColorThemeParams,
    defaultValues: PD.getDefaultValues(EntityIdColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => !!ctx.structure,
  };
};
