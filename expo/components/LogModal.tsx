import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryPills, Cover, StarPicker, type Filter } from "@/components/hb";
import { CatalogStatus } from "@/components/CatalogStatus";
import { categoryLabel, mediaById, type Media } from "@/lib/data";
import { searchLocal } from "@/lib/mediaService";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

export function LogModal() {
  const { logModal, closeLog, addLog, catalog, catalogLoading, catalogError } = useStore();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [selected, setSelected] = useState<Media | undefined>();
  const [query, setQuery] = useState("");
  const [cats, setCats] = useState<Filter[]>([]);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [rewatch, setRewatch] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (logModal.open) {
      setSelected(logModal.mediaId ? mediaById(logModal.mediaId) : undefined);
      setQuery("");
      setCats([]);
      setRating(0);
      setReview("");
      setRewatch(false);
      setSaved(false);
    }
  }, [logModal.open, logModal.mediaId]);

  const results = useMemo(
    () => searchLocal(query, "all", catalog).filter((m) => cats.length === 0 || cats.includes(m.category)),
    [query, cats, catalog],
  );
  const reLabel = selected && (selected.category === "book" || selected.category === "manga") ? "Re-read" : "Re-watch";

  const save = () => {
    if (!selected || rating === 0) return;
    addLog({ mediaId: selected.id, rating, review: review.trim(), rewatch });
    setSaved(true);
    setTimeout(closeLog, 700);
  };

  return (
    <Modal visible={logModal.open} animationType="slide" transparent onRequestClose={closeLog}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View className="flex-1 bg-black/60">
          <Pressable className="h-[60px]" onPress={closeLog} accessibilityLabel="Close" />
          <View className="flex-1 rounded-t-3xl border-t border-border bg-background" style={{ paddingBottom: insets.bottom }}>
            <View className="flex-row items-center px-4 pt-2">
              <Text className="flex-1 text-xl font-bold text-foreground">
                {selected ? "Log & Review" : "What did you watch or read?"}
              </Text>
              <Pressable onPress={closeLog} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {!selected ? (
              <FlatList
                data={results}
                keyExtractor={(m) => m.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 24 }}
                ListHeaderComponent={
                  <View className="gap-3 pb-3">
                    <View className="mx-4 min-h-[44px] flex-row items-center rounded-full border border-border bg-card px-4">
                      <Ionicons name="search" size={18} color={colors.mutedForeground} />
                      <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search films, shows, anime, manga, books"
                        placeholderTextColor={colors.mutedForeground}
                        className="ml-2 flex-1 py-3 text-base text-foreground"
                      />
                    </View>
                    <CategoryPills values={cats} onChange={setCats} />
                    <CatalogStatus />
                  </View>
                }
                ListEmptyComponent={catalogLoading || catalogError ? null : <Text className="px-4 text-muted-foreground">No titles match that search yet.</Text>}
                renderItem={({ item }) => (
                  <Pressable onPress={() => setSelected(item)} className="min-h-[44px] flex-row items-center gap-3 px-4 py-2 active:bg-card">
                    <Cover media={item} className="h-[66px] w-[44px]" rounded="rounded-md" />
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">{item.title}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {categoryLabel(item.category)} · {item.year} · {item.creator}
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={26} color={colors.primary} />
                  </Pressable>
                )}
              />
            ) : (
              <FlatList
                data={[]}
                renderItem={null}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <View className="gap-5 px-4 pb-6 pt-2">
                    <View className="flex-row gap-4">
                      <Cover media={selected} className="h-[150px] w-[100px]" />
                      <View className="flex-1 justify-center">
                        <Text className="text-lg font-bold text-foreground">{selected.title}</Text>
                        <Text className="mt-1 text-sm text-muted-foreground">
                          {categoryLabel(selected.category)} · {selected.year}
                        </Text>
                        <Text className="text-sm text-muted-foreground">{selected.creator}</Text>
                        <Pressable onPress={() => setSelected(undefined)} className="mt-2 min-h-[44px] justify-center self-start">
                          <Text className="font-semibold text-primary">Change title</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View>
                      <Text className="mb-1 font-semibold text-foreground">Your rating</Text>
                      <StarPicker value={rating} onChange={setRating} />
                    </View>
                    <View>
                      <Text className="mb-2 font-semibold text-foreground">Review</Text>
                      <TextInput
                        value={review}
                        onChangeText={setReview}
                        placeholder="What did you think?"
                        placeholderTextColor={colors.mutedForeground}
                        multiline
                        className="min-h-[110px] rounded-2xl border border-border bg-card p-4 text-base text-foreground"
                        style={{ textAlignVertical: "top" }}
                      />
                    </View>
                    <View className="min-h-[52px] flex-row items-center rounded-2xl border border-border bg-card px-4">
                      <Ionicons name="repeat" size={20} color={colors.primary} />
                      <Text className="ml-3 flex-1 text-base text-foreground">{reLabel}</Text>
                      <Switch value={rewatch} onValueChange={setRewatch} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#ffffff" />
                    </View>
                    <Pressable
                      onPress={save}
                      disabled={rating === 0 || saved}
                      className="min-h-[52px] items-center justify-center rounded-full bg-primary active:opacity-80"
                      style={{ opacity: rating === 0 ? 0.5 : 1 }}
                    >
                      <Text className="text-base font-bold text-primary-foreground">
                        {saved ? "Saved" : rating === 0 ? "Pick a rating to save" : "Save log"}
                      </Text>
                    </Pressable>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
