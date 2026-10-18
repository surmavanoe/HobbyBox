import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cover, Stars } from "@/components/hb";
import { FRIEND_LOGS, categoryLabel, mediaById, popularTitle, rankByRecentSearches, type Media } from "@/lib/data";
import { CatalogStatus } from "@/components/CatalogStatus";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

const TITLES: Record<string, string> = {
  rec: "Based on your recent searches",
  friends: "Liked by your friends",
  trending: "Series popular this week",
};

export default function Grid() {
  const { section = "rec", filter = "all" } = useLocalSearchParams<{ section: string; filter: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { openDetail, catalog, recentSearches } = useStore();
  const { width } = useWindowDimensions();
  const cardW = (Math.min(width, 600) - 16 * 2 - 12 * 2) / 3;

  const filters = filter.split(",").filter((f): f is Media["category"] => f !== "all" && f !== "");
  const pass = (m: Media) => filters.length === 0 || filters.includes(m.category);

  let data: Media[] = rankByRecentSearches(catalog.filter(pass), recentSearches);
  if (section === "friends") {
    const ids = new Set(FRIEND_LOGS.filter((l) => l.rating >= 4).map((l) => l.mediaId));
    data = [...ids].flatMap((id) => {
      const media = mediaById(id);
      return media && pass(media) ? [media] : [];
    });
  }
  if (section === "trending") data = [...data].sort((a, b) => b.rating - a.rating);

  const heading =
    section === "trending"
      ? popularTitle(filters)
      : (TITLES[section] ?? "More") +
        (filters.length === 1 ? ` · ${categoryLabel(filters[0])}` : filters.length > 1 ? ` · ${filters.length} categories` : "");

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-2 pb-2" style={{ paddingTop: insets.top + 4 }}>
        <Pressable onPress={() => router.back()} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground">{heading}</Text>
      </View>
      <FlatList
        ListHeaderComponent={<CatalogStatus />}
        data={data}
        numColumns={3}
        keyExtractor={(m) => m.id}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 16, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={<Text className="px-4 text-muted-foreground">No titles in this category yet.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => openDetail(item.id)} style={{ width: cardW }}>
            <View style={{ width: cardW, height: cardW * 1.5 }}>
              <Cover media={item} className="h-full w-full" rounded="rounded-lg" />
            </View>
            <Text className="mt-1.5 text-xs font-semibold text-foreground" numberOfLines={1}>
              {item.title}
            </Text>
            {item.rating > 0 ? <Stars value={item.rating} size={10} showValue /> : null}
          </Pressable>
        )}
      />
    </View>
  );
}
