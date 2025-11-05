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
import type { ColorType } from "molstar/lib/mol-geo/geometry/color-data";

// Per-theme state map to allow multiple viewers with different colors
const ThemeStateByName = new Map<
  string,
  {
    indexToColor: Map<number, string>;
    defaultColor: Color;
  }
>();

/**
 * Update the theme state for a specific theme name
 * This allows multiple viewers to have independent color schemes
 */
export function updateCustomThemeStateFor(
  name: string,
  indexToColor: Map<number, string>,
  defaultColor: Color,
): void {
  ThemeStateByName.set(name, { indexToColor, defaultColor });
}

/**
 * Clear the theme state for a specific theme name
 * Call this when disposing a viewer to prevent memory leaks
 */
export function clearThemeStateFor(name: string): void {
  ThemeStateByName.delete(name);
}

/**
 * Create a color theme factory for a specific theme name
 * This allows each viewer to have its own independent color scheme
 */
function CustomColorThemeFor(
  name: string,
): ColorTheme.Factory<EntityIdColorThemeParams, ColorType> {
  return (
    ctx: ThemeDataContext,
    props: PD.Values<EntityIdColorThemeParams>,
  ) => {
    // Read state for this specific theme name
    const state = ThemeStateByName.get(name);
    const fallback = {
      indexToColor: new Map<number, string>(),
      defaultColor: Color(0x94a3b8),
    };
    const { indexToColor, defaultColor } = state ?? fallback;

    const color: LocationColor = (location) => {
      if (!StructureElement.Location.is(location)) return defaultColor;

      const { unit, element } = location;
      const h = unit.model.atomicHierarchy;
      if (!h) return defaultColor;

      const rIdx = h.residueAtomSegments.index[element];
      const seq = h.residues.label_seq_id.value(rIdx);
      const hex = indexToColor.get(seq);
      return hex ? Color.fromHexStyle(hex) : defaultColor;
    };

    return {
      granularity: "group",
      factory: CustomColorThemeFor(name),
      color,
      props,
      description: "Viewer-scoped custom color theme",
      legend: TableLegend(
        [...indexToColor.entries()].map(([k, v]) => [
          String(k),
          Color.fromHexStyle(v),
        ]),
      ),
    };
  };
}

export const CustomColorThemeProvider = (
  name = "nitro-custom-theme",
): ColorTheme.Provider<EntityIdColorThemeParams, string> => {
  return {
    name,
    label: `Nitro Theme (${name})`,
    category: "Custom",
    factory: CustomColorThemeFor(name),
    getParams: getEntityIdColorThemeParams,
    defaultValues: PD.getDefaultValues(EntityIdColorThemeParams),
    isApplicable: () => true,
  };
};
