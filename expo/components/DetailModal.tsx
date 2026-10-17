import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cover, Stars } from "@/components/hb";
import { CAST } from "@/lib/cast";
import { categoryLabel, mediaById } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

export function DetailModal() {
  const { detailId, closeDetail, openLog, watchlist, toggleWatchlist } = useStore();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const m = detailId ? mediaById(detailId) : undefined;
  const isPrint = m && (m.category === "book" || m.category === "manga");
  const saved = m ? watchlist.includes(m.id) : false;

  return (
    <Modal visible={!!m} transparent animationType="slide" onRequestClose={closeDetail}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[85%] rounded-t-3xl border-t border-border bg-background" style={{ paddingBottom: insets.bottom + 12 }}>
          <View className="flex-row justify-end px-2 pt-2">
            <Pressable onPress={closeDetail} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>
          {m ? (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <View className="flex-row gap-4">
                <Cover media={m} className="h-[165px] w-[110px]" />
                <View className="flex-1">
                  <Text className="text-xl font-bold text-foreground">{m.title}</Text>
                  <Text className="mt-1 text-sm text-muted-foreground">
                    {categoryLabel(m.category)}{m.year ? ` · ${m.year}` : ""}
                  </Text>
                  {m.rating > 0 ? <View className="mt-2">
                    <Stars value={m.rating} size={14} />
                  </View> : null}
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {m.genres.map((g) => (
                      <View key={g} className="rounded-full border border-primary px-3 py-1">
                        <Text className="text-xs font-semibold capitalize text-primary">{g}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <Text className="mt-5 text-base text-foreground">{m.synopsis || "No description available yet."}</Text>
              {m.creator || CAST[m.id] ? <>
                <Text className="mt-5 text-sm font-bold text-foreground">{isPrint ? "Author" : CAST[m.id] ? "Cast" : "Creator"}</Text>
                <Text className="mt-1 text-sm text-muted-foreground">{isPrint ? m.creator : (CAST[m.id] ?? [m.creator]).join(", ")}</Text>
              </> : null}

              <Pressable
                onPress={() => {
                  closeDetail();
                  openLog(m.id);
                }}
                className="mt-6 min-h-[52px] items-center justify-center rounded-xl bg-primary active:opacity-90"
              >
                <Text className="text-base font-bold text-primary-foreground">Log & Review</Text>
              </Pressable>
              <Pressable onPress={() => toggleWatchlist(m.id)} className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-primary/15">
                <Ionicons name={saved ? "time" : "time-outline"} size={18} color={colors.primary} />
                <Text className="font-semibold text-primary">{saved ? "In your watchlist" : "Add to watchlist"}</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
