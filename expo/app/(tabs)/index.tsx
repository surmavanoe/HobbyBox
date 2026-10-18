import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, CategoryPills, Cover, Logo, SectionHeader, Stars, type Filter } from "@/components/hb";
import { CatalogStatus } from "@/components/CatalogStatus";
import { FRIEND_LOGS, categoryIcon, categoryLabel, friendById, mediaById, popularTitle, rankByRecentSearches, type Media } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

const ME_AVATAR = "https://i.pravatar.cc/150?img=68";

// Posters lift on hover (web) and press down when tapped.
const lift = ({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ transform: [{ scale: pressed ? 0.95 : hovered ? 1.05 : 1 }] });

export default function Home() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { openDetail, catalog, catalogLoading, catalogError, recentSearches } = useStore();
  const [filters, setFilters] = useState<Filter[]>([]);
  const pass = (m: Media) => filters.length === 0 || filters.includes(m.category);

  const friendLiked = useMemo(() => {
    const byMedia = new Map<string, string[]>();
    FRIEND_LOGS.filter((l) => l.rating >= 4).forEach((l) => byMedia.set(l.mediaId, [...(byMedia.get(l.mediaId) ?? []), l.userId]));
    return [...byMedia.entries()]
      .flatMap(([id, friends]) => {
        const media = mediaById(id);
        return media && pass(media) ? [{ media, friends: [...new Set(friends)] }] : [];
      });
  }, [filters, catalog]);
  // Titles already shown in "Liked by your friends" are left out here so a poster never appears in both rows.
  const recommended = useMemo(() => {
    const taken = new Set(friendLiked.map((f) => f.media.id));
    return rankByRecentSearches(catalog.filter(pass), recentSearches).filter((m) => !taken.has(m.id));
  }, [filters, catalog, recentSearches, friendLiked]);
  const trending = useMemo(
    () => catalog.filter(pass).sort((a, b) => b.rating - a.rating),
    [filters, catalog],
  );
  const single = filters.length === 1 && filters[0] !== "all" ? filters[0] : null;

  const sections = [
    { key: "rec", icon: "bulb-outline", title: "Based on your recent searches:", empty: recommended.length === 0 },
    { key: "friends", icon: "heart-outline", title: "Liked by your friends", empty: friendLiked.length === 0 },
    { key: "trending", icon: single ? categoryIcon(single) : "flame-outline", title: popularTitle(filters), empty: trending.length === 0 },
  ];

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-1">
          <Logo />
        </View>
        <Pressable onPress={() => router.push("/profile")} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel="Profile">
          <Avatar uri={ME_AVATAR} size={40} ring />
        </Pressable>
      </View>
      <FlatList
        data={catalogLoading || catalogError ? [] : sections}
        keyExtractor={(s) => s.key}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={<View className="py-2"><CategoryPills values={filters} onChange={setFilters} /><CatalogStatus /></View>}
        renderItem={({ item: s }) => (
          <View className="mt-4">
            <SectionHeader icon={s.icon} title={s.title} onPress={() => router.push({ pathname: "/grid/[section]", params: { section: s.key, filter: filters.join(",") || "all" } })} />
            {s.empty ? (
              <View className="mx-4 rounded-2xl border border-border bg-card p-4">
                <Text className="text-muted-foreground">Nothing here for this category yet.</Text>
                <Pressable onPress={() => setFilters([])} className="mt-2 min-h-[44px] justify-center self-start">
                  <Text className="font-semibold text-primary">Show all categories</Text>
                </Pressable>
              </View>
            ) : s.key === "rec" ? (
              <FlatList
                horizontal
                data={recommended}
                keyExtractor={(m) => m.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                renderItem={({ item }) => (
                  <Pressable onPress={() => openDetail(item.id)} className="w-[124px]" style={lift}>
                    <View style={{ transform: [{ perspective: 600 }, { rotateY: "-8deg" }] }}>
                      <Cover media={item} className="h-[180px] w-[124px] border-primary/40" />
                    </View>
                    <Text className="mt-2 text-sm font-semibold text-foreground" numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.rating > 0 ? <Stars value={item.rating} showValue /> : null}
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {[item.genres[0], categoryLabel(item.category)].filter(Boolean).join(" · ")}
                    </Text>
                  </Pressable>
                )}
              />
            ) : s.key === "friends" ? (
              <FlatList
                horizontal
                data={friendLiked}
                keyExtractor={(x) => x.media.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                renderItem={({ item }) => (
                  <Pressable onPress={() => openDetail(item.media.id)} className="w-[124px]" style={lift}>
                    <View>
                      <Cover media={item.media} className="h-[180px] w-[124px]" />
                      <View className="absolute left-2 top-2 flex-row">
                        {item.friends.map((f, i) => (
                          <View key={f} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                            <Avatar uri={friendById(f).avatar} size={26} />
                          </View>
                        ))}
                      </View>
                      <View className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5">
                        <View className="flex-row items-center gap-1"><Text className="text-[10px] font-bold text-foreground">Friend</Text><Ionicons name="heart" size={10} color={colors.primary} /></View>
                      </View>
                    </View>
                    <Text className="mt-2 text-sm font-semibold text-foreground" numberOfLines={1}>
                      {item.media.title}
                    </Text>
                    <Stars value={item.media.rating} showValue />
                  </Pressable>
                )}
              />
            ) : (
              <FlatList
                horizontal
                data={trending}
                keyExtractor={(m) => m.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                renderItem={({ item, index }) => (
                  <Pressable onPress={() => openDetail(item.id)} className="w-[140px]" style={lift}>
                    <View>
                      <Cover media={item} className="h-[200px] w-[140px] border-primary/40" />
                      <View className="absolute left-2 top-2 flex-row items-center gap-1 rounded-md bg-background/85 px-2 py-1">
                        <Ionicons name="flame" size={12} color={colors.primary} />
                        <Text className="text-[11px] font-bold text-foreground">#{index + 1} Trending</Text>
                      </View>
                    </View>
                    <Text className="mt-2 text-sm font-semibold text-foreground" numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.rating > 0 ? <Stars value={item.rating} showValue /> : null}
                  </Pressable>
                )}
              />
            )}
          </View>
        )}
      />
    </View>
  );
}
