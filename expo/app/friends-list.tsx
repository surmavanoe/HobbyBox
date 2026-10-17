import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/hb";
import { FRIENDS, FRIEND_LOGS } from "@/lib/data";
import { useThemeColors } from "@/lib/theme";

export default function FriendsList() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-2 pb-2" style={{ paddingTop: insets.top + 4 }}>
        <Pressable onPress={() => router.back()} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground">Friends</Text>
      </View>
      <FlatList
        data={FRIENDS}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16, gap: 10 }}
        ListEmptyComponent={
          <View className="rounded-2xl border border-border bg-card p-4">
            <Text className="text-muted-foreground">You haven't added any friends yet.</Text>
            <Pressable onPress={() => router.push("/friends")} className="mt-2 min-h-[44px] justify-center self-start">
              <Text className="font-semibold text-primary">Browse friends' activity</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const count = FRIEND_LOGS.filter((l) => l.userId === item.id).length;
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/friends", params: { who: item.id } })}
              className="min-h-[64px] flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:opacity-80"
            >
              <Avatar uri={item.avatar} size={44} />
              <View className="flex-1">
                <Text className="font-semibold text-foreground">{item.name}</Text>
                <Text className="text-xs text-muted-foreground">{item.handle} · {count} logged</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
