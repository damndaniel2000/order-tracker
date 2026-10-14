import { MD3LightTheme, MD3DarkTheme, type MD3Theme } from "react-native-paper";

// Single source of truth for the brand color (Siddhi Services green) —
// everything else derives from it.
export const BRAND_PRIMARY = "#43A340";
const BRAND_CONTAINER_LIGHT = "#E6F4E6";
const BRAND_CONTAINER_DARK = "#1E5A1C";

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND_PRIMARY,
    onPrimary: "#FFFFFF",
    primaryContainer: BRAND_CONTAINER_LIGHT,
    onPrimaryContainer: BRAND_CONTAINER_DARK,
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: BRAND_PRIMARY,
    onPrimary: "#FFFFFF",
    primaryContainer: BRAND_CONTAINER_DARK,
    onPrimaryContainer: BRAND_CONTAINER_LIGHT,
  },
};
