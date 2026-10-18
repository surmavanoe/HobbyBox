import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Cover, Stars } from "@/components/hb";
import { FRIENDS, FRIEND_LOGS, categoryLabel, friendById, mediaById, timeAgo } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

export default function Friends() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { openDetail, watchlist, toggleWatchlist } = useStore();
  const params = useLocalSearchParams<{ who?: string }>();
  const [who, setWho] = useState<string>(params.who ?? "all");
  useEffect(() => {
    if (params.who) setWho(params.who);
  }, [params.who]);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const data = FRIEND_LOGS.filter((l) => who === "all" || l.userId === who).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={data}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, gap: 12 }}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <Text className="px-4 text-2xl font-bold text-foreground">
              Friends <Text className="text-primary">Activity</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
              <Pressable onPress={() => setWho("all")} className="min-h-[44px] items-center">
                <View className={cn("h-[52px] w-[52px] items-center justify-center rounded-full border-2 bg-card", who === "all" ? "border-primary" : "border-border")}>
                  <Ionicons name="people" size={22} color={who === "all" ? colors.primary : colors.mutedForeground} />
                </View>
                <Text className={cn("mt-1 text-xs", who === "all" ? "text-primary" : "text-muted-foreground")}>All</Text>
              </Pressable>
              {FRIENDS.map((f) => (
                <Pressable key={f.id} onPress={() => setWho(f.id)} className="min-h-[44px] items-center">
                  <View className={cn("rounded-full border-2", who === f.id ? "border-primary" : "border-transparent")}>
                    <Avatar uri={f.avatar} size={48} />
                  </View>
                  <Text className={cn("mt-1 text-xs", who === f.id ? "text-primary" : "text-muted-foreground")}>{f.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => {
          const f = friendById(item.userId);
          const m = mediaById(item.mediaId)!;
          const isLiked = liked[item.id];
          const verb = m.category === "book" || m.category === "manga" ? (item.rewatch ? "re-read" : "read") : item.rewatch ? "re-watched" : "watched";
          return (
            <View className="mx-4 rounded-2xl border border-border bg-card p-4">
              <View className="flex-row items-center gap-3">
                <Avatar uri={f.avatar} size={38} />
                <View className="flex-1">
                  <Text className="text-sm text-foreground">
                    <Text className="font-bold">{f.name}</Text> {verb} <Text className="font-bold">{m.title}</Text>
                  </Text>
                  <Text className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</Text>
                </View>
              </View>
              <Pressable onPress={() => openDetail(m.id)} className="mt-3 flex-row gap-3">
                <Cover media={m} className="h-[105px] w-[70px]" rounded="rounded-lg" />
                <View className="flex-1">
                  <Stars value={item.rating} size={14} />
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {categoryLabel(m.category)} · {m.year}
                    {item.rewatch ? " · Rewatch" : ""}
                  </Text>
                  {item.review ? <Text className="mt-2 text-sm text-foreground">“{item.review}”</Text> : null}
                </View>
              </Pressable>
              <View className="mt-2 flex-row items-center">
                <Pressable onPress={() => setLiked((s) => ({ ...s, [item.id]: !s[item.id] }))} className="min-h-[44px] flex-row items-center gap-1 pr-4">
                  <Ionicons name={isLiked ? "heart" : "heart-outline"} size={20} color={isLiked ? colors.primary : colors.mutedForeground} />
                  <Text className="text-sm text-muted-foreground">{item.likes + (isLiked ? 1 : 0)}</Text>
                </Pressable>
                <Pressable onPress={() => toggleWatchlist(m.id)} className="min-h-[44px] flex-row items-center gap-1">
                  <Ionicons name={watchlist.includes(m.id) ? "time" : "time-outline"} size={20} color={watchlist.includes(m.id) ? colors.primary : colors.mutedForeground} />
                  <Text className={cn("text-sm", watchlist.includes(m.id) ? "text-primary" : "text-muted-foreground")}>{watchlist.includes(m.id) ? "In watchlist" : "Add to watchlist"}</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
