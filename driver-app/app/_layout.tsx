import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";
import { AuthProvider } from "@/lib/auth";
import { lightTheme } from "@/lib/theme";

// The app doesn't have a designed dark palette yet (every screen was built
// with light-mode-only colors before this file existed), so pin to light
// regardless of system theme for now rather than ship a half-broken dark
// mode. Revisit once dark-mode colors are actually designed.

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  return (
    <PaperProvider theme={lightTheme}>
      <ThemeProvider value={DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
}
