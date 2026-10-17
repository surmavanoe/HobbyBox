import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, CategoryPills, Cover, Logo, SectionHeader, Stars, type Filter } from "@/components/hb";
import { FRIEND_LOGS, MEDIA, RECENT_SEARCHES, categoryLabel, formatCount, friendById, mediaById, type Media } from "@/lib/data";
import { useStore } from "@/lib/store";

const ME_AVATAR = "https://i.pravatar.cc/150?img=68";

export default function Home() {
  const insets = useSafeAreaInsets();
  const { openDetail } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const pass = (m: Media) => filter === "all" || m.category === filter;

  const recommended = useMemo(
    () => MEDIA.filter((m) => m.genres.some((g) => RECENT_SEARCHES.includes(g))).filter(pass).sort((a, b) => b.rating - a.rating).slice(0, 10),
    [filter],
  );
  const friendLiked = useMemo(() => {
    const byMedia = new Map<string, string[]>();
    FRIEND_LOGS.filter((l) => l.rating >= 4).forEach((l) => byMedia.set(l.mediaId, [...(byMedia.get(l.mediaId) ?? []), l.userId]));
    return [...byMedia.entries()]
      .map(([id, friends]) => ({ media: mediaById(id)!, friends: [...new Set(friends)] }))
      .filter((x) => pass(x.media));
  }, [filter]);
  const trending = useMemo(
    () => MEDIA.filter((m) => m.trendingRank).filter(pass).sort((a, b) => a.trendingRank! - b.trendingRank!),
    [filter],
  );

  const sections = [
    { key: "rec", title: "💡 Based on your recent searches:", empty: recommended.length === 0 },
    { key: "friends", title: "🤍 Movies your friends liked", empty: friendLiked.length === 0 },
    { key: "trending", title: "🔥 Series popular this week", empty: trending.length === 0 },
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
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="py-2">
          <CategoryPills value={filter} onChange={setFilter} />
        </View>

        {sections.map((s) => (
          <View key={s.key} className="mt-4">
            <SectionHeader title={s.title} onPress={() => router.push({ pathname: "/grid/[section]", params: { section: s.key, filter } })} />
            {s.empty ? (
              <View className="mx-4 rounded-2xl border border-border bg-card p-4">
                <Text className="text-muted-foreground">Nothing here for this category yet.</Text>
                <Pressable onPress={() => setFilter("all")} className="mt-2 min-h-[44px] justify-center self-start">
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
                  <Pressable onPress={() => openDetail(item.id)} className="w-[124px]">
                    <View style={{ transform: [{ perspective: 600 }, { rotateY: "-8deg" }] }}>
                      <Cover media={item} className="h-[180px] w-[124px]" />
                    </View>
                    <View className="mt-2">
                      <Stars value={item.rating} />
                    </View>
                    <Text className="mt-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {categoryLabel(item.category)} · {item.rating.toFixed(1)}
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
                  <Pressable onPress={() => openDetail(item.media.id)} className="w-[124px]">
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
                        <Text className="text-[10px] font-bold text-foreground">Friend 🧡</Text>
                      </View>
                    </View>
                    <Text className="mt-2 text-sm font-semibold text-foreground" numberOfLines={1}>
                      {item.media.title}
                    </Text>
                    <Stars value={item.media.rating} />
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
                renderItem={({ item }) => (
                  <Pressable onPress={() => openDetail(item.id)} className="w-[140px]">
                    <View>
                      <Cover media={item} className="h-[200px] w-[140px]" />
                      <View className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1">
                        <Text className="text-[10px] font-bold text-primary-foreground">🔥 #{item.trendingRank} Trending</Text>
                      </View>
                      <View className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-1">
                        <Text className="text-[10px] font-semibold text-foreground">👁 {formatCount(item.logs)} logs</Text>
                      </View>
                    </View>
                    <Text className="mt-2 text-sm font-semibold text-foreground" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Stars value={item.rating} />
                  </Pressable>
                )}
              />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
