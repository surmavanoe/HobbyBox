import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap, string]> = {
  index: ["home", "home-outline", "Home"],
  friends: ["people", "people-outline", "Friends"],
  search: ["search", "search-outline", "Search"],
  profile: ["person", "person-outline", "Profile"],
};

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { openLog } = useStore();
  return (
    <View className="flex-row items-center border-t border-border bg-background px-2 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
      {state.routes.map((route, i) => {
        if (route.name === "log") {
          return (
            <View key={route.key} className="flex-1 items-center">
              <Pressable
                onPress={() => openLog()}
                accessibilityLabel="Log media"
                className="h-[52px] w-[52px] items-center justify-center rounded-2xl bg-primary active:opacity-80"
              >
                <Ionicons name="add" size={32} color={colors.primaryForeground} />
              </Pressable>
            </View>
          );
        }
        const focused = state.index === i;
        const [on, off, label] = ICONS[route.name] ?? ["ellipse", "ellipse-outline", route.name];
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={() => !focused && navigation.navigate(route.name)}
            className="min-h-[52px] flex-1 items-center justify-center"
          >
            <Ionicons name={focused ? on : off} size={24} color={focused ? colors.primary : colors.mutedForeground} />
            <View className="mt-1 h-[4px] w-[4px] rounded-full" style={{ backgroundColor: focused ? colors.primary : "transparent" }} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "#0A0E17" } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
