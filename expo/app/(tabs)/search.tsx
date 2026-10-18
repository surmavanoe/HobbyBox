import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryIcon, Cover, Stars } from "@/components/hb";
import { CatalogStatus } from "@/components/CatalogStatus";
import { AiChatSheet } from "@/components/AiChatSheet";
import { router } from "expo-router";
import { SearchFilterModal } from "@/components/SearchFilterModal";
import { FRIEND_LOGS, categoryLabel, friendById, type Media } from "@/lib/data";
import { aiDiscover, searchLocal } from "@/lib/mediaService";
import { useStore } from "@/lib/store";
import { applySearchFilters, EMPTY_SEARCH_FILTERS, formatYearRange, type SearchFilters } from "@/lib/searchFilters";
import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["Drama my friends rated 5 stars", "Books my friends reviewed this month", "Sci-fi anime my friends rated 4+", "Something cozy like Frieren", "A dark mind-bending sci-fi series"];

function friendContext(id: string) {
  const l = FRIEND_LOGS.filter((x) => x.mediaId === id).sort((a, b) => b.rating - a.rating)[0];
  return l ? `${friendById(l.userId).name} gave this ${l.rating} star${l.rating === 1 ? "" : "s"}` : null;
}

export default function Search() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { openDetail, addRecentSearch, account, catalog, catalogLoading, catalogError } = useStore();
  const [aiOn, setAiOn] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({ ...EMPTY_SEARCH_FILTERS });
  const [mode, setMode] = useState<"browse" | "ai">("browse");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [ai, setAi] = useState<{ intro: string; results: Media[] } | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [needSignIn, setNeedSignIn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const runAi = async (prompt: string) => {
    if (!prompt.trim()) return;
    setMode("ai");
    setLastPrompt(prompt);
    addRecentSearch(prompt);
    if (/\bfriends?\b/i.test(prompt) && !account?.token) {
      setNeedSignIn(true);
      setAi(null);
      return;
    }
    setNeedSignIn(false);
    setLoading(true);
    setError(false);
    try {
      setAi(await aiDiscover(prompt, "all", catalog, account?.token));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // After signing in, re-run the friend question that was waiting on sign-in.
  useEffect(() => {
    if (account?.token && needSignIn && lastPrompt) void runAi(lastPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.token]);

  // With AI on, typing runs the AI search after a short pause.
  useEffect(() => {
    if (!aiOn || !query.trim() || query === lastPrompt) return;
    const t = setTimeout(() => void runAi(query), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, aiOn]);

  const resetAll = () => {
    setQuery(""); setFilters({ ...EMPTY_SEARCH_FILTERS }); setMode("browse"); setAiOn(false);
    setAi(null); setError(false); setLoading(false); setNeedSignIn(false); setLastPrompt("");
  };

  const hasFilters = filters.categories.length > 0 || filters.yearRange !== null || filters.genres.length > 0 || filters.ratingOrder !== null;
  const source = catalogLoading || catalogError ? [] : mode === "ai" ? (loading || error ? [] : ai?.results ?? []) : query || hasFilters ? searchLocal(query, "all", catalog) : [];
  const data = applySearchFilters(source, filters);

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
                <Pressable onPress={() => setShowFilters(true)} className={cn("h-[44px] w-[44px] items-center justify-center rounded-full border", hasFilters ? "border-primary bg-primary/15" : "border-border bg-card")} accessibilityLabel="Filters">
                  <Ionicons name="options-outline" size={22} color={hasFilters ? colors.primary : colors.foreground} />
                </Pressable>
              </View>
              <View className="mx-4 flex-row items-center gap-2">
              {query || hasFilters || mode === "ai" || aiOn ? (
                <Pressable onPress={resetAll} className="h-[48px] w-[48px] items-center justify-center rounded-full border border-border bg-card active:opacity-80" accessibilityLabel="Reset search">
                  <Ionicons name="refresh" size={20} color={colors.foreground} />
                </Pressable>
              ) : null}
              <View className="min-h-[48px] flex-1 flex-row items-center rounded-full border border-border bg-card pl-4 pr-1">
                <Ionicons name="search" size={18} color={colors.mutedForeground} />
                <TextInput
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t);
                    if (!aiOn && mode === "ai") setMode("browse");
                  }}
                  returnKeyType="search"
                  onSubmitEditing={() => { if (aiOn) runAi(query); else if (query.trim()) addRecentSearch(query); }}
                  placeholder="Search..."
                  placeholderTextColor={colors.mutedForeground}
                  className="ml-2 flex-1 py-3 text-base text-foreground"
                />
                <Pressable onPress={() => { const next = !aiOn; setAiOn(next); if (next && query.trim()) runAi(query); else if (!next && mode === "ai") setMode("browse"); }} className="min-h-[44px] min-w-[52px] items-center justify-center" accessibilityLabel="AI search" accessibilityState={{ selected: aiOn }}>
                  <View className={cn("h-[36px] min-w-[48px] items-center justify-center rounded-full px-3", aiOn ? "bg-primary" : "bg-muted")}>
                    <Text className={cn("text-sm font-bold", aiOn ? "text-primary-foreground" : "text-muted-foreground")}>AI</Text>
                  </View>
                </Pressable>
              </View>
              </View>
              <CatalogStatus />
              {mode === "browse" && (query || hasFilters) && !catalogLoading && !catalogError ? <Text className="px-4 text-sm text-muted-foreground">{data.length} {data.length === 1 ? "title" : "titles"}{filters.yearRange ? ` · ${formatYearRange(filters.yearRange)}` : ""}{filters.genres.length ? ` · ${filters.genres.join(", ")}` : ""}{filters.ratingOrder ? ` · ${filters.ratingOrder === "best" ? "Best to worst" : "Worst to best"}` : ""}</Text> : null}
              {mode === "browse" && !query && !hasFilters ? (
                <View className="gap-2 px-4 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <Pressable key={s} onPress={() => { setQuery(s); runAi(s); }} className="min-h-[44px] justify-center rounded-[10px] bg-primary/15 px-4 active:bg-primary/25">
                      <Text className="text-base font-semibold text-primary">“{s}”</Text>
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
              {mode === "ai" && needSignIn ? (
                <View className="mx-4 rounded-2xl border border-border bg-card p-4">
                  <Text className="text-foreground">Sign in to use your friends' ratings.</Text>
                  <Pressable onPress={() => router.push("/auth")} className="mt-2 min-h-[44px] justify-center self-start">
                    <Text className="font-semibold text-primary">Sign in</Text>
                  </Pressable>
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
            catalogLoading || catalogError || loading || error || (mode === "ai" && needSignIn) || (mode === "browse" && !query && !hasFilters) ? null : (
              <View className="mx-4 rounded-2xl border border-border bg-card p-4">
                  <Text className="text-muted-foreground">{hasFilters ? "No titles match these filters yet." : "No matches yet — try describing it to the assistant."}</Text>
                  <Pressable onPress={() => hasFilters ? setFilters({ ...EMPTY_SEARCH_FILTERS }) : runAi(query || "something great")} className="mt-2 min-h-[44px] justify-center self-start">
                    <Text className="font-semibold text-primary">{hasFilters ? "Clear filters" : "Ask the assistant"}</Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item }) => {
            const fc = item.friendNote ?? friendContext(item.id);
            return (
              <Pressable onPress={() => openDetail(item.id)} className="mx-4 flex-row gap-3 rounded-2xl border border-border bg-card p-3 active:opacity-80">
                <Cover media={item} className="h-[120px] w-[80px]" rounded="rounded-lg" />
                <View className="flex-1">
                  <Text className="text-base font-bold text-foreground">{item.title}</Text>
                  <View className="mt-1 flex-row items-center gap-2">
                    <View className="flex-row items-center gap-1 rounded-full border border-primary px-2 py-0.5">
                      <CategoryIcon category={item.category} size={10} />
                      <Text className="text-[10px] font-bold text-primary">
                        {categoryLabel(item.category)}
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
          onPress={() => setChatOpen(true)}
          className="absolute right-4 h-[72px] w-[72px] items-center justify-center rounded-full bg-primary"
          style={{ bottom: 16 }}
          accessibilityLabel="AI assistant"
        >
          <Text className="text-xl font-black text-primary-foreground">AI</Text>
        </Pressable>
        <AiChatSheet visible={chatOpen} onClose={() => setChatOpen(false)} />
        <SearchFilterModal visible={showFilters} onClose={() => setShowFilters(false)} value={filters} onChange={setFilters} />
      </View>
    </KeyboardAvoidingView>
  );
}
