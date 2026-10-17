import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryPills, Cover, Stars, type Filter } from "@/components/hb";
import { CatalogStatus } from "@/components/CatalogStatus";
import { FRIEND_LOGS, categoryEmoji, categoryLabel, friendById, type Media } from "@/lib/data";
import { aiDiscover, searchLocal } from "@/lib/mediaService";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["Show me what my friends watched this week", "Something cozy like Frieren", "A dark mind-bending sci-fi series", "Short emotional books for a weekend", "Epic fantasy manga my friends rated highly"];

function friendContext(id: string) {
  const l = FRIEND_LOGS.filter((x) => x.mediaId === id).sort((a, b) => b.rating - a.rating)[0];
  return l ? `${friendById(l.userId).name} gave this ${l.rating} star${l.rating === 1 ? "" : "s"}` : null;
}

export default function Search() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { openDetail, catalog, catalogLoading, catalogError } = useStore();
  const [aiOn, setAiOn] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Filter>("all");
  const [mode, setMode] = useState<"browse" | "ai">("browse");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [ai, setAi] = useState<{ intro: string; results: Media[] } | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");

  const runAi = async (prompt: string) => {
    if (!prompt.trim()) return;
    setMode("ai");
    setLastPrompt(prompt);
    setLoading(true);
    setError(false);
    try {
      setAi(await aiDiscover(prompt, cat, catalog));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const data = catalogLoading || catalogError ? [] : mode === "ai" ? (loading || error ? [] : ai?.results ?? []) : query ? searchLocal(query, cat, catalog) : [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View className="flex-1 bg-background">
        <FlatList
          data={data}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 96, gap: 12 }}
          ListHeaderComponent={
            <View className="gap-3">
              <View className="flex-row items-center px-4">
                <Text className="flex-1 text-2xl font-bold text-foreground">
                  Search & <Text className="text-primary">AI assist</Text>
                </Text>
                <Pressable onPress={() => setShowFilters((v) => !v)} className={cn("h-[44px] w-[44px] items-center justify-center rounded-full border", showFilters || cat !== "all" ? "border-primary bg-primary/15" : "border-border bg-card")} accessibilityLabel="Filters">
                  <Ionicons name="options-outline" size={22} color={showFilters || cat !== "all" ? colors.primary : colors.foreground} />
                </Pressable>
              </View>
              <View className="mx-4 min-h-[48px] flex-row items-center rounded-full border border-border bg-card pl-4 pr-1">
                <Ionicons name="search" size={18} color={colors.mutedForeground} />
                <TextInput
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t);
                    if (mode === "ai") setMode("browse");
                  }}
                  onSubmitEditing={() => (aiOn ? runAi(query) : undefined)}
                  returnKeyType="search"
                  placeholder={aiOn ? "Ask the AI anything..." : "Search..."}
                  placeholderTextColor={colors.mutedForeground}
                  className="ml-2 flex-1 py-3 text-base text-foreground"
                />
                <Pressable onPress={() => setAiOn((v) => !v)} className="min-h-[44px] items-center justify-center" accessibilityLabel={aiOn ? "Turn AI off" : "Turn AI on"}>
                  <View className={cn("rounded-full border border-primary px-3 py-1.5", aiOn ? "bg-primary" : "bg-transparent")}>
                    <Text className={cn("text-sm font-bold", aiOn ? "text-primary-foreground" : "text-primary")}>AI</Text>
                  </View>
                </Pressable>
              </View>
              {showFilters ? <CategoryPills value={cat} onChange={setCat} /> : null}
              <CatalogStatus />
              {mode === "browse" && query && !catalogLoading && !catalogError ? <Text className="px-4 text-sm text-muted-foreground">{data.length} {data.length === 1 ? "title" : "titles"}</Text> : null}
              {mode === "browse" && !query ? (
                <View className="gap-1 px-4 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <Pressable key={s} onPress={() => { setQuery(s); setAiOn(true); runAi(s); }} className="min-h-[44px] justify-center active:opacity-100">
                      <Text className="text-base font-semibold text-primary opacity-60">“{s}”</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {mode === "ai" && loading ? (
                <View className="gap-3 px-4">
                  <View className="h-[18px] w-3/4 rounded bg-muted" />
                  {[0, 1, 2].map((i) => (
                    <View key={i} className="flex-row gap-3 rounded-2xl border border-border bg-card p-3">
                      <View className="h-[120px] w-[80px] rounded-lg bg-muted" />
                      <View className="flex-1 gap-2">
                        <View className="h-[16px] w-2/3 rounded bg-muted" />
                        <View className="h-[12px] w-1/3 rounded bg-muted" />
                        <View className="h-[12px] w-full rounded bg-muted" />
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              {mode === "ai" && error ? (
                <View className="mx-4 rounded-2xl border border-border bg-card p-4">
                  <Text className="text-foreground">The assistant couldn't find recommendations right now.</Text>
                  <Pressable onPress={() => runAi(lastPrompt)} className="mt-2 min-h-[44px] justify-center self-start">
                    <Text className="font-semibold text-primary">Retry</Text>
                  </Pressable>
                </View>
              ) : null}
              {mode === "ai" && !loading && !error && ai ? <Text className="px-4 text-base font-semibold text-foreground">{ai.intro}</Text> : null}
            </View>
          }
          ListEmptyComponent={
            catalogLoading || catalogError || loading || error || (mode === "browse" && !query) ? null : (
              <View className="mx-4 rounded-2xl border border-border bg-card p-4">
                <Text className="text-muted-foreground">No matches yet — try describing it to the assistant.</Text>
                <Pressable onPress={() => runAi(query || "something great")} className="mt-2 min-h-[44px] justify-center self-start">
                  <Text className="font-semibold text-primary">Ask the assistant</Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item }) => {
            const fc = friendContext(item.id);
            return (
              <Pressable onPress={() => openDetail(item.id)} className="mx-4 flex-row gap-3 rounded-2xl border border-border bg-card p-3 active:opacity-80">
                <Cover media={item} className="h-[120px] w-[80px]" rounded="rounded-lg" />
                <View className="flex-1">
                  <Text className="text-base font-bold text-foreground">{item.title}</Text>
                  <View className="mt-1 flex-row items-center gap-2">
                    <View className="rounded-full border border-primary px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-primary">
                        {categoryEmoji(item.category)} {categoryLabel(item.category)}
                      </Text>
                    </View>
                    {item.year ? <Text className="text-xs text-muted-foreground">{item.year}</Text> : null}
                  </View>
                  <Text className="mt-1.5 text-xs text-muted-foreground" numberOfLines={3}>
                    {item.synopsis}
                  </Text>
                  {fc ? (
                    <View className="mt-1.5 flex-row items-center gap-1">
                      <Stars value={5} size={10} />
                      <Text className="flex-1 text-xs text-foreground">{fc}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
        <Pressable
          onPress={() => { setAiOn(true); runAi(query || SUGGESTIONS[0]); }}
          className="absolute right-4 h-[60px] w-[60px] items-center justify-center rounded-full bg-primary active:opacity-90"
          style={{ bottom: 16, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
          accessibilityLabel="Ask the AI assistant"
        >
          <Text className="text-lg font-black text-primary-foreground">AI</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
