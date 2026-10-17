// Gesture handler must load before navigation modules (Expo Router requirement).
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import Constants from "expo-constants";
import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";
import { useLayoutEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LovablePreviewErrorReporter } from "../components/lovable-preview-error-reporter";
import { LovablePreviewSafeArea } from "../components/lovable-preview-safe-area";
import { LovablePreviewTextSelection } from "../components/lovable-preview-text-selection";
import { LovableSimulatorGuard } from "../components/lovable-simulator-guard";
import { navigationThemes, useAppColorScheme } from "../lib/theme";

const userInterfaceStyle = Constants.expoConfig?.userInterfaceStyle ?? "light";

export default function RootLayout() {
  const scheme = useAppColorScheme();

  useLayoutEffect(() => {
    // Native applies app.json's userInterfaceStyle itself; on web nothing reads it, so seed NativeWind's store.
    if (Platform.OS !== "web") return;
    colorScheme.set(userInterfaceStyle === "automatic" ? "system" : userInterfaceStyle);
  }, []);

  useLayoutEffect(() => {
    // NativeWind's web store follows the OS while unpinned but only toggles <html>'s `dark` class from set().
    if (Platform.OS !== "web") return;
    document.documentElement.classList.toggle("dark", scheme === "dark");
  }, [scheme]);

  return (
    // Native gesture components need this root, and Expo Router does not provide it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LovablePreviewErrorReporter>
          <LovablePreviewSafeArea>
            <LovableSimulatorGuard>
              <ThemeProvider value={navigationThemes[scheme]}>
                <LovablePreviewTextSelection />
                <StatusBar style="auto" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                  }}
                />
              </ThemeProvider>
            </LovableSimulatorGuard>
          </LovablePreviewSafeArea>
        </LovablePreviewErrorReporter>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
