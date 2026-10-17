import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { EMPTY_SEARCH_FILTERS, FILM_GENRES, type SearchFilters } from "@/lib/searchFilters";
import { YearRangeSlider } from "@/components/YearRangeSlider";
import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/data";

const CATEGORIES: { key: Category | null; label: string }[] = [
  { key: null, label: "All" }, { key: "film", label: "Films" },
  { key: "anime", label: "Anime" }, { key: "tv", label: "Series" },
  { key: "manga", label: "Manga / Comics" }, { key: "book", label: "Books" },
];

interface Props { visible: boolean; onClose: () => void; value: SearchFilters; onChange: (value: SearchFilters) => void }

export function SearchFilterModal({ visible, onClose, value, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [draft, setDraft] = useState<SearchFilters>(value);
  useEffect(() => { if (visible) setDraft(value); }, [visible, value]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-background/60" style={{ paddingTop: insets.top }}>
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Dismiss filters" />
        <View className="w-full self-center overflow-hidden rounded-t-[24px] border border-border bg-card" style={{ height: "78%", maxWidth: 560 }}>
          <View className="mt-2 h-[4px] w-[40px] self-center rounded-full bg-muted-foreground/50" />
          <View className="flex-row items-center pb-2 pt-2" style={{ paddingLeft: insets.left + 20, paddingRight: insets.right + 12 }}>
            <Text className="flex-1 text-2xl font-bold text-foreground">Filter Search & <Text className="text-primary">AI</Text></Text>
            <Pressable onPress={onClose} accessibilityLabel="Close filters" className="min-h-[44px] min-w-[44px] items-center justify-center"><Ionicons name="close-circle" size={28} color={colors.mutedForeground} /></Pressable>
          </View>
          <FlatList data={["Category", "Genre", "Release Year", "Ratings"]} keyExtractor={(label) => label} contentContainerStyle={{ paddingLeft: insets.left + 20, paddingRight: insets.right + 20, paddingBottom: 16, gap: 12 }} renderItem={({ item }) => (
            <View>
              <Text className="mb-2 text-base font-semibold text-foreground">{item}</Text>
              {item === "Category" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{CATEGORIES.map(({ key, label }) => <Button key={label} variant={draft.category === key ? "tinted" : "ghost"} accessibilityState={{ selected: draft.category === key }} className={cn("min-h-[44px] rounded-full border px-3 py-2", draft.category === key ? "border-primary" : "border-border")} onPress={() => setDraft({ ...draft, category: key })}>{label}</Button>)}</ScrollView> : item === "Genre" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{FILM_GENRES.map((genre) => <Button key={genre} variant={draft.genre === genre ? "tinted" : "ghost"} accessibilityState={{ selected: draft.genre === genre }} className={cn("min-h-[44px] rounded-full border px-3 py-2", draft.genre === genre ? "border-primary" : "border-border")} onPress={() => setDraft({ ...draft, genre: draft.genre === genre ? null : genre })}>{genre}</Button>)}</ScrollView> : item === "Release Year" ? <YearRangeSlider value={draft.yearRange} onChange={(yearRange) => setDraft({ ...draft, yearRange })} /> : <View className="gap-1">{(["best", "worst"] as const).map((order) => <Pressable key={order} accessibilityRole="button" accessibilityLabel={order === "best" ? "Best to worst" : "Worst to best"} accessibilityState={{ selected: draft.ratingOrder === order }} onPress={() => setDraft({ ...draft, ratingOrder: draft.ratingOrder === order ? null : order })} className={cn("min-h-[48px] flex-row items-center gap-2 rounded-lg px-2", draft.ratingOrder === order && "bg-primary/15")}>
                <View className="flex-row"><Ionicons name="arrow-up" size={20} color={colors.primary} /><Ionicons name="arrow-down" size={20} color={colors.primary} /></View>
                <Text className="flex-1 text-base text-foreground">{order === "best" ? "Best to worst" : "Worst to best"}</Text>
                {draft.ratingOrder === order ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : null}
              </Pressable>)}</View>}
            </View>
          )} />
          <View className="gap-1 border-t border-border pt-3" style={{ paddingBottom: insets.bottom + 8, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }}>
            <Button onPress={() => { onChange(draft); onClose(); }} className="min-h-[52px] rounded-full">Apply Filters</Button>
            <Button variant="ghost" onPress={() => setDraft({ ...EMPTY_SEARCH_FILTERS })}>Reset filters</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}