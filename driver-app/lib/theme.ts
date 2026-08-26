import { MD3LightTheme, MD3DarkTheme, type MD3Theme } from "react-native-paper";

// Single source of truth for the brand color. Swap this when real brand
// colors are available — everything else derives from it.
const BRAND_PRIMARY = "#4F46E5";

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND_PRIMARY,
    onPrimary: "#FFFFFF",
    primaryContainer: "#EEF2FF",
    onPrimaryContainer: "#312E81",
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: BRAND_PRIMARY,
    onPrimary: "#FFFFFF",
    primaryContainer: "#312E81",
    onPrimaryContainer: "#EEF2FF",
  },
};
