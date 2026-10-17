import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { EMPTY_SEARCH_FILTERS, FILM_GENRES, formatYearRange, type SearchFilters } from "@/lib/searchFilters";
import { YearRangeSlider } from "@/components/YearRangeSlider";
import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

type Page = "root" | "years" | "genres" | "ratings";
interface Props { visible: boolean; onClose: () => void; value: SearchFilters; onChange: (value: SearchFilters) => void }

export function SearchFilterModal({ visible, onClose, value, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [page, setPage] = useState<Page>("root");
  const title = page === "root" ? "Filters" : page === "years" ? "Release Date" : page === "genres" ? "Genre" : "Ratings";
  const close = () => { setPage("root"); onClose(); };
  const rows = page === "root" ? ["Release Date", "Genre", "Ratings"] : page === "years" ? [] : page === "genres" ? FILM_GENRES : ["Best to worst", "Worst to best"];
  const select = (label: string) => {
    if (page === "root") setPage(label === "Release Date" ? "years" : label === "Genre" ? "genres" : "ratings");
    else if (page === "genres") onChange({ ...value, genre: value.genre === label ? null : label });
    else { const order = label === "Best to worst" ? "best" : "worst"; onChange({ ...value, ratingOrder: value.ratingOrder === order ? null : order }); }
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 8, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }}>
          {page !== "root" ? <Pressable onPress={() => setPage("root")} accessibilityLabel="Back" className="min-h-[44px] min-w-[44px] items-center justify-center"><Ionicons name="arrow-back" size={24} color={colors.foreground} /></Pressable> : null}
          <Text className="flex-1 text-2xl font-bold text-foreground">{title}</Text>
          <Pressable onPress={close} accessibilityLabel="Close filters" className="min-h-[44px] min-w-[44px] items-center justify-center"><Ionicons name="close" size={26} color={colors.foreground} /></Pressable>
        </View>
        {page === "years" ? <View className="flex-1" style={{ paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }}><YearRangeSlider value={value.yearRange} onChange={(yearRange) => onChange({ ...value, yearRange })} /></View> : <FlatList data={rows} keyExtractor={(label) => label} contentContainerStyle={{ paddingHorizontal: 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16, paddingBottom: 20 }} renderItem={({ item }) => {
          const selected = page === "genres" ? value.genre === item : page === "ratings" ? value.ratingOrder === (item === "Best to worst" ? "best" : "worst") : false;
          const summary = page === "root" ? item === "Release Date" ? value.yearRange ? formatYearRange(value.yearRange) : null : item === "Genre" ? value.genre : value.ratingOrder === "best" ? "Best to worst" : value.ratingOrder === "worst" ? "Worst to best" : null : null;
          return <Pressable onPress={() => select(item)} accessibilityRole="button" accessibilityState={{ selected }} className={cn("min-h-[60px] flex-row items-center gap-3 border-b border-border py-3 active:bg-card", selected && "bg-primary/10")}>
            {page === "ratings" || (page === "root" && item === "Ratings") ? <View className="flex-row"><Ionicons name="arrow-up" size={20} color={colors.primary} /><Ionicons name="arrow-down" size={20} color={colors.primary} /></View> : page === "root" ? <Ionicons name={item === "Release Date" ? "calendar-outline" : "film-outline"} size={23} color={colors.primary} /> : null}
            <Text className={cn("flex-1 text-base font-semibold", selected ? "text-primary" : "text-foreground")}>{item}</Text>
            {summary ? <Text className="max-w-[140px] text-right text-sm text-primary">{summary}</Text> : null}
            <Ionicons name={selected ? "checkmark" : page === "root" ? "chevron-forward" : "ellipse-outline"} size={selected ? 22 : 18} color={selected ? colors.primary : colors.mutedForeground} />
          </Pressable>;
        }} />}
        <View className="gap-2 border-t border-border px-4 pt-3" style={{ paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }}>
          <Button onPress={close} className="min-h-[52px]">Show results</Button>
          <Button variant="ghost" onPress={() => onChange({ ...EMPTY_SEARCH_FILTERS })}>Reset filters</Button>
        </View>
      </View>
    </Modal>
  );
}