import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { CATEGORIES, categoryEmoji, type Category, type Media } from "@/lib/data";
import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const ORANGE = "#F28C38";

export function Cover({ media, className, rounded = "rounded-xl" }: { media: Media; className?: string; rounded?: string }) {
  const [failed, setFailed] = useState(false);
  const colors = useThemeColors();
  if (!media.cover || failed) {
    return (
      <View className={cn("items-center justify-center overflow-hidden border border-border bg-card p-2", rounded, className)}>
        <Text className="text-3xl">{categoryEmoji(media.category)}</Text>
        <Text className="mt-2 text-center text-xs font-bold text-foreground" numberOfLines={3}>
          {media.title}
        </Text>
        <Text className="mt-1 text-[10px]" style={{ color: colors.mutedForeground }}>
          {media.year}
        </Text>
      </View>
    );
  }
  return (
    <View
      className={cn("overflow-hidden border border-border bg-card", rounded, className)}
      style={{ shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
    >
      <Image source={{ uri: media.cover }} style={{ width: "100%", height: "100%" }} resizeMode="cover" onError={() => setFailed(true)} />
    </View>
  );
}

export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row" style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={value >= i ? "star" : value >= i - 0.5 ? "star-half" : "star-outline"}
          size={size}
          color={value >= i - 0.5 ? colors.primary : colors.mutedForeground}
        />
      ))}
    </View>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel={`${i} stars`}>
          <Ionicons name={value >= i ? "star" : "star-outline"} size={30} color={value >= i ? colors.primary : colors.mutedForeground} />
        </Pressable>
      ))}
    </View>
  );
}

export type Filter = Category | "all";

export function CategoryPills({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const items: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    ...CATEGORIES.map((c) => ({ key: c.key as Filter, label: `${c.emoji} ${c.label}` })),
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} className="min-h-[44px] justify-center">
            <View className={cn("rounded-full border px-4 py-2", active ? "border-primary bg-primary/10" : "border-border bg-card")}>
              <Text className={cn("text-sm font-semibold", active ? "text-primary" : "text-muted-foreground")}>{it.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} className="min-h-[44px] flex-row items-center px-4" disabled={!onPress}>
      <Text className="flex-1 text-base font-bold text-foreground">{title}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} /> : null}
    </Pressable>
  );
}

export function Avatar({ uri, size = 36, ring = false }: { uri: string; size?: number; ring?: boolean }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 2 : 1, borderColor: ring ? ORANGE : "#0A0E17", overflow: "hidden" }}
      className="bg-card"
    >
      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

export function Logo() {
  return (
    <Text className="text-2xl font-black tracking-widest text-foreground">
      HOBBY<Text className="text-primary">BOX</Text>
    </Text>
  );
}
