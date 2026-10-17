import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { FlatList, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cover, ORANGE, Stars } from "@/components/hb";
import { CATEGORIES, FRIENDS, categoryEmoji, categoryLabel, mediaById, type Category } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

const ME_AVATAR = "https://i.pravatar.cc/150?img=68";
const BANNER = "https://is1-ssl.mzstatic.com/image/thumb/Video126/v4/d8/ab/12/d8ab1255-b426-228e-b0b9-bf9226f56b28/6a9bf4da-a829-4291-9c77-c26853dbb1b1_FBJ-S1-1_3000x3000_Season_Master_Key_Art.jpg/1200x600bb.jpg";
const ORDER: Category[] = ["film", "tv", "anime", "manga", "book"];

const TURN_MS = 40000;

function PentSlot({ i, cat, theta, cx, cy, R, cw, ch, onSlot }: { i: number; cat: Category; theta: SharedValue<number>; cx: number; cy: number; R: number; cw: number; ch: number; onSlot: (c: Category) => void }) {
  const { favorites } = useStore();
  const m = mediaById(favorites[cat]);
  const style = useAnimatedStyle(() => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + theta.value;
    const x = cx + R * Math.cos(a);
    const y = cy + R * Math.sin(a);
    const depth = (Math.sin(a) + 1) / 2; // 0 back (top) -> 1 front (bottom)
    return {
      left: x - cw / 2,
      top: y - ch / 2,
      zIndex: Math.round(depth * 100),
      transform: [{ scale: 0.8 + depth * 0.35 }],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", width: cw, height: ch }, style]}>
      <Pressable onPress={() => onSlot(cat)} accessibilityLabel={`Change favorite ${categoryLabel(cat)}`} className="h-full w-full">
        {m ? <Cover media={m} className="h-full w-full border-primary" rounded="rounded-lg" /> : <View className="h-full w-full rounded-lg border border-primary bg-card" />}
        <View className="absolute -bottom-2 self-center rounded-full bg-background px-1.5">
          <Text className="text-[10px]">{categoryEmoji(cat)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Pentagon({ size, onSlot }: { size: number; onSlot: (c: Category) => void }) {
  const cw = size * 0.3;
  const ch = cw * 1.5;
  const R = size / 2 - ch / 2;
  const cx = size / 2;
  const cy = size / 2;
  const theta = useSharedValue(0);
  useEffect(() => {
    theta.value = withRepeat(withTiming(2 * Math.PI, { duration: TURN_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(theta);
  }, [theta]);
  const outlineStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${theta.value}rad` }] }));
  const pts = ORDER.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  return (
    <View style={{ width: size, height: size + ch * 0.2, paddingTop: ch * 0.1 }}>
      <View style={{ width: size, height: size }}>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: size, height: size }, outlineStyle]}>
          {pts.map((p, i) => {
            const q = pts[(i + 1) % 5];
            const len = Math.hypot(q.x - p.x, q.y - p.y);
            const ang = Math.atan2(q.y - p.y, q.x - p.x);
            return (
              <View
                key={`l${i}`}
                style={{ position: "absolute", left: (p.x + q.x) / 2 - len / 2, top: (p.y + q.y) / 2 - 1, width: len, height: 2, backgroundColor: ORANGE, transform: [{ rotate: `${ang}rad` }], shadowColor: ORANGE, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }}
              />
            );
          })}
          {pts.map((p, i) => (
            <View
              key={`d${i}`}
              style={{ position: "absolute", left: p.x - 5, top: p.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE, shadowColor: ORANGE, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }}
            />
          ))}
        </Animated.View>
        {ORDER.map((cat, i) => (
          <PentSlot key={cat} i={i} cat={cat} theta={theta} cx={cx} cy={cy} R={R} cw={cw} ch={ch} onSlot={onSlot} />
        ))}
      </View>
    </View>
  );
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { width, height } = useWindowDimensions();
  const { myLogs, account, setFavorite, openLog, favorites, watchlist, openDetail, catalog } = useStore();
  const [swap, setSwap] = useState<Category | null>(null);
  const bannerH = Math.round(height * 0.28);
  const pentSize = Math.min(width - 32, 360);
  const username = account?.username ?? "USERNAME";
  const split = Math.ceil(username.length / 2);

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ height: bannerH }} className="overflow-hidden rounded-b-3xl bg-card">
          <Image source={{ uri: BANNER }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          <View className="absolute inset-0 bg-black/30" />
          <View className="absolute right-2 flex-row" style={{ top: insets.top + 4 }}>
            <Pressable onPress={() => router.push("/auth")} className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/40" accessibilityLabel="Account">
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </Pressable>
          </View>
          <View className="absolute bottom-2" style={{ left: 16 + 92 + 12, right: 16 }}>
            <Text
              className="text-lg font-black tracking-widest text-white"
              style={{ textShadowColor: "rgba(0,0,0,0.85)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }}
            >
              {username.slice(0, split).toUpperCase()}
              <Text className="text-primary">{username.slice(split).toUpperCase()}</Text>
            </Text>
          </View>
        </View>
        <View className="flex-row items-end px-4" style={{ marginTop: -44 }}>
          <View style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: ORANGE, overflow: "hidden", shadowColor: ORANGE, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } }} className="bg-card">
            <Image source={{ uri: ME_AVATAR }} style={{ width: "100%", height: "100%" }} />
          </View>
          <Pressable onPress={() => router.push("/friends-list")} className="ml-3 min-h-[44px] flex-row items-center gap-1.5" accessibilityLabel={`Friends, ${FRIENDS.length}`}>
            <Text className="text-base font-semibold text-foreground">Friends</Text>
            <Text className="text-base font-bold text-primary">{FRIENDS.length}</Text>
          </Pressable>
        </View>
        {!account ? (
          <Pressable onPress={() => router.push("/auth")} className="mx-4 mt-3 min-h-[44px] flex-row items-center rounded-2xl border border-border bg-card px-4">
            <Text className="flex-1 text-sm text-muted-foreground">Create an account to save your profile</Text>
            <Text className="font-semibold text-primary">Sign up</Text>
          </Pressable>
        ) : null}

        <Text className="mt-2 text-center text-base font-bold tracking-widest text-primary">Quintuple</Text>
        <View className="items-center">
          <Pentagon size={pentSize} onSlot={setSwap} />
        </View>

        <Text className="mt-8 px-4 text-base font-bold text-foreground">Last Reviewed:</Text>
        {myLogs.length === 0 ? (
          <View className="mx-4 mt-2 rounded-2xl border border-border bg-card p-4">
            <Text className="text-muted-foreground">Your reviews will show up here.</Text>
            <Pressable onPress={() => openLog()} className="mt-2 min-h-[44px] justify-center self-start">
              <Text className="font-semibold text-primary">Log your first title</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            horizontal
            data={myLogs}
            keyExtractor={(l) => l.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingTop: 10 }}
            renderItem={({ item }) => {
              const m = mediaById(item.mediaId);
              if (!m) return null;
              return (
                <Pressable onPress={() => openLog(m.id)} className="h-[165px] w-[110px]">
                  <Cover media={m} className="h-full w-full" />
                  <View className="absolute bottom-0 left-0 right-0 items-center rounded-b-xl bg-black/70 py-1.5">
                    <Stars value={item.rating} size={12} />
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        <Text className="mt-8 px-4 text-base font-bold text-foreground">Watchlist:</Text>
        {watchlist.length === 0 ? (
          <View className="mx-4 mt-2 rounded-2xl border border-border bg-card p-4">
            <Text className="text-muted-foreground">Titles you add to your watchlist will show up here.</Text>
            <Pressable onPress={() => router.push("/friends")} className="mt-2 min-h-[44px] justify-center self-start">
              <Text className="font-semibold text-primary">Browse friends' activity</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            horizontal
            data={watchlist}
            keyExtractor={(id) => id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingTop: 10 }}
            renderItem={({ item }) => {
              const m = mediaById(item);
              if (!m) return null;
              return (
                <Pressable onPress={() => openDetail(m.id)} className="h-[165px] w-[110px]">
                  <Cover media={m} className="h-full w-full" />
                  <View className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1">
                    <Ionicons name="time" size={14} color={ORANGE} />
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </ScrollView>

      <Modal visible={!!swap} transparent animationType="slide" onRequestClose={() => setSwap(null)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[75%] rounded-t-3xl border-t border-border bg-background" style={{ paddingBottom: insets.bottom + 12 }}>
            <View className="flex-row items-center px-4 pt-2">
              <Text className="flex-1 text-lg font-bold text-foreground">
                Favorite {swap ? CATEGORIES.find((c) => c.key === swap)?.plural : ""}
              </Text>
              <Pressable onPress={() => setSwap(null)} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            <FlatList
              data={catalog.filter((m) => m.category === swap)}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => {
                const active = swap && favorites[swap] === item.id;
                return (
                  <Pressable
                    onPress={() => {
                      if (swap) setFavorite(swap, item.id);
                      setSwap(null);
                    }}
                    className="min-h-[44px] flex-row items-center gap-3 px-4 py-2 active:bg-card"
                  >
                    <Cover media={item} className="h-[66px] w-[44px]" rounded="rounded-md" />
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">{item.title}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {item.year} · {item.creator}
                      </Text>
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={24} color={colors.primary} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
