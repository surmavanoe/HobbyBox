import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cover, Stars } from "@/components/hb";
import { FRIEND_LOGS, MEDIA, RECENT_SEARCHES, categoryLabel, type Media } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

const TITLES: Record<string, string> = {
  rec: "💡 Recommended for you",
  friends: "🤍 Your friends liked",
  trending: "🔥 Popular this week",
};

export default function Grid() {
  const { section = "rec", filter = "all" } = useLocalSearchParams<{ section: string; filter: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { openLog } = useStore();
  const { width } = useWindowDimensions();
  const cardW = (Math.min(width, 600) - 16 * 2 - 12 * 2) / 3;

  let data: Media[] = MEDIA.filter((m) => filter === "all" || m.category === filter);
  if (section === "rec") data = data.filter((m) => m.genres.some((g) => RECENT_SEARCHES.includes(g)) || m.rating >= 4.5);
  if (section === "friends") {
    const ids = new Set(FRIEND_LOGS.filter((l) => l.rating >= 4).map((l) => l.mediaId));
    data = data.filter((m) => ids.has(m.id));
  }
  if (section === "trending") data = [...data].sort((a, b) => b.logs - a.logs);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-2 pb-2" style={{ paddingTop: insets.top + 4 }}>
        <Pressable onPress={() => router.back()} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground">
          {TITLES[section] ?? "More"}
          {filter !== "all" ? ` · ${categoryLabel(filter as Media["category"])}` : ""}
        </Text>
      </View>
      <FlatList
        data={data}
        numColumns={3}
        keyExtractor={(m) => m.id}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 16, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={<Text className="px-4 text-muted-foreground">No titles in this category yet.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => openLog(item.id)} style={{ width: cardW }}>
            <Cover media={item} className="w-full" rounded="rounded-lg" />
            <View style={{ position: "absolute", top: 0, width: cardW, height: cardW * 1.5 }} pointerEvents="none" />
            <Text className="mt-1.5 text-xs font-semibold text-foreground" numberOfLines={1}>
              {item.title}
            </Text>
            <Stars value={item.rating} size={10} />
          </Pressable>
        )}
      />
    </View>
  );
}
