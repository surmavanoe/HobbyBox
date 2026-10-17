import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useColorScheme } from "nativewind";

// Hex mirror of the RGB channels in global.css — change a token in both places.
export const palette = {
  light: {
    background: "#f2f2f7",
    foreground: "#000000",
    card: "#ffffff",
    cardForeground: "#000000",
    primary: "#0040dd",
    primaryForeground: "#ffffff",
    secondary: "#e5e5ea",
    secondaryForeground: "#000000",
    muted: "#e5e5ea",
    mutedForeground: "#5c5c61",
    destructive: "#d70015",
    destructiveForeground: "#ffffff",
    border: "#c6c6c8",
    input: "#e5e5ea",
  },
  dark: {
    background: "#000000",
    foreground: "#ffffff",
    card: "#1c1c1e",
    cardForeground: "#ffffff",
    primary: "#409cff",
    primaryForeground: "#000000",
    secondary: "#2c2c2e",
    secondaryForeground: "#ffffff",
    muted: "#2c2c2e",
    mutedForeground: "#98989d",
    destructive: "#ff453a",
    destructiveForeground: "#000000",
    border: "#38383a",
    input: "#2c2c2e",
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
