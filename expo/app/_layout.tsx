// Gesture handler must load before navigation modules (Expo Router requirement).
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";
import { useLayoutEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DetailModal } from "../components/DetailModal";
import { LogModal } from "../components/LogModal";
import { LovablePreviewErrorReporter } from "../components/lovable-preview-error-reporter";
import { LovablePreviewSafeArea } from "../components/lovable-preview-safe-area";
import { LovablePreviewTextSelection } from "../components/lovable-preview-text-selection";
import { LovableSimulatorGuard } from "../components/lovable-simulator-guard";
import { StoreProvider } from "../lib/store";
import { navigationThemes } from "../lib/theme";

export default function RootLayout() {
  useLayoutEffect(() => {
    if (Platform.OS !== "web") return;
    colorScheme.set("dark");
    document.documentElement.classList.toggle("dark", true);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LovablePreviewErrorReporter>
          <LovablePreviewSafeArea>
            <LovableSimulatorGuard>
              <ThemeProvider value={navigationThemes.dark}>
                <StoreProvider>
                  <LovablePreviewTextSelection />
                  <StatusBar style="light" />
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A0E17" } }} />
                  <DetailModal />
                  <LogModal />
                </StoreProvider>
              </ThemeProvider>
            </LovableSimulatorGuard>
          </LovablePreviewSafeArea>
        </LovablePreviewErrorReporter>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
