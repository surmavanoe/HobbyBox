import { Ionicons } from "@expo/vector-icons";
import { FlatList, Image, Modal, Pressable, Text, View } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import marvel from "@/assets/marvel-badge.asset.json";
import tolkien from "@/assets/tolkien-badge.asset.json";
import { getAchievements, type Achievement } from "@/lib/achievements";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";
import { Button } from "@/components/ui/Button";

function BadgeArt({ achievement, small = false }: { achievement: Achievement; small?: boolean }) {
  const colors = useThemeColors();
  const size = small ? 34 : 72;
  return achievement.artwork ? (
    <Image source={{ uri: achievement.artwork === "marvel" ? marvel.url : tolkien.url }} style={{ width: size, height: small ? 42 : 86 }} resizeMode="contain" />
  ) : (
    <View style={{ width: size, height: small ? 42 : 86 }} className="items-center justify-center">
      <Ionicons name={achievement.icon} size={small ? 24 : 40} color={colors.primary} />
    </View>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  return (
    <View className="flex-1 items-center rounded-lg border border-primary/35 bg-card p-3">
      <BadgeArt achievement={achievement} />
      <Text className="min-h-[44px] text-center text-base font-bold text-foreground">{achievement.title}</Text>
      <Text className="mt-1 min-h-[36px] text-center text-xs text-muted-foreground">{achievement.description}</Text>
      <View className="mt-3 w-full flex-row items-center gap-2">
        <View className="h-[6px] flex-1 overflow-hidden rounded-full bg-muted">
          <View className="h-full rounded-full bg-primary" style={{ width: `${achievement.percent}%` }} />
        </View>
        <Text className="text-xs font-semibold text-primary">{achievement.percent}%</Text>
      </View>
    </View>
  );
}

export function ProfileBadges({ onPress }: { onPress: () => void }) {
  const { myLogs, catalog } = useStore();
  const achievements = getAchievements(myLogs, catalog).slice(0, 2);
  return (
    <View className="ml-auto flex-row">
      {achievements.map((achievement) => (
        <Pressable key={achievement.id} onPress={onPress} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel={`${achievement.title}, ${achievement.percent}% complete`}>
          <BadgeArt achievement={achievement} small />
        </Pressable>
      ))}
    </View>
  );
}

export function ProfileAchievements({ visible, onOpen, onClose }: { visible: boolean; onOpen: () => void; onClose: () => void }) {
  const { myLogs, catalog, openLog } = useStore();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const achievements = getAchievements(myLogs, catalog);
  return (
    <>
      <View className="mt-2 flex-row items-center justify-between px-4">
        <Text className="flex-1 text-base font-bold text-foreground">Achievements & Badges</Text>
        <Button variant="ghost" className="px-0" onPress={onOpen} accessibilityLabel="See more achievements">See more</Button>
      </View>
      <View className="flex-row gap-3 px-4">
        {achievements.slice(0, 2).map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} />)}
      </View>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View className="flex-1 justify-end bg-background/80">
          <View className="max-h-[85%] rounded-t-lg border-t border-border bg-background">
            <View className="flex-row items-center px-4 py-2">
              <Text className="flex-1 text-lg font-bold text-foreground">Achievements & Badges</Text>
              <Pressable onPress={onClose} accessibilityLabel="Close achievements" className="min-h-[44px] min-w-[44px] items-center justify-center">
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            <FlatList data={achievements} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }} renderItem={({ item }) => (
              <View className="border-b border-border py-3">
                <Pressable onPress={() => setSelected(selected === item.id ? null : item.id)} className="min-h-[44px] flex-row items-center gap-3" accessibilityLabel={`${item.title}, ${item.completed} of ${item.total}`}>
                  <BadgeArt achievement={item} small />
                  <View className="flex-1">
                    <Text className="font-bold text-foreground">{item.title}</Text>
                    <Text className="mt-1 text-sm text-muted-foreground">{item.description}</Text>
                    <Text className="mt-1 text-xs text-primary">{item.completed} / {item.total} · {item.percent === 100 ? "Earned" : `${item.percent}% complete`}</Text>
                  </View>
                  <Ionicons name={selected === item.id ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                </Pressable>
                {selected === item.id && item.percent < 100 ? <Button variant="tinted" className="mt-3 self-start" onPress={() => { onClose(); openLog(); }}>Log a title</Button> : null}
              </View>
            )} />
          </View>
        </View>
      </Modal>
    </>
  );
}