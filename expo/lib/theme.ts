import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useColorScheme } from "nativewind";

// Hex mirror of the RGB channels in global.css — change a token in both places.
export const palette = {
  light: {
    background: "#0a0e17",
    foreground: "#ffffff",
    card: "#131b2e",
    cardForeground: "#ffffff",
    primary: "#f28c38",
    primaryForeground: "#0a0e17",
    secondary: "#1e293b",
    secondaryForeground: "#ffffff",
    muted: "#1e293b",
    mutedForeground: "#94a3b8",
    destructive: "#f87171",
    destructiveForeground: "#0a0e17",
    border: "#1e293b",
    input: "#131b2e",
  },
  dark: {
    background: "#0a0e17",
    foreground: "#ffffff",
    card: "#131b2e",
    cardForeground: "#ffffff",
    primary: "#f28c38",
    primaryForeground: "#0a0e17",
    secondary: "#1e293b",
    secondaryForeground: "#ffffff",
    muted: "#1e293b",
    mutedForeground: "#94a3b8",
    destructive: "#f87171",
    destructiveForeground: "#0a0e17",
    border: "#1e293b",
    input: "#131b2e",
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type ThemeColors = (typeof palette)[ColorScheme];

// NativeWind's store is what `dark:` utilities read, so hook colors and utilities cannot disagree.
export function useAppColorScheme(): ColorScheme {
  return useColorScheme().colorScheme === "dark" ? "dark" : "light";
}

export function useThemeColors(): ThemeColors {
  return palette[useAppColorScheme()];
}

function navigationTheme(scheme: ColorScheme, base: Theme): Theme {
  const colors = palette[scheme];
  return {
    ...base,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.foreground,
      border: colors.border,
      notification: colors.destructive,
    },
  };
}

export const navigationThemes: Record<ColorScheme, Theme> = {
  light: navigationTheme("light", DefaultTheme),
  dark: navigationTheme("dark", DarkTheme),
};
