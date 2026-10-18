import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cover } from "@/components/hb";
import type { Media } from "@/lib/data";
import { aiDiscover } from "@/lib/mediaService";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

type Msg = { id: string; role: "user" | "ai"; text: string; results?: Media[]; failed?: string; signIn?: boolean };

const STARTERS = ["Drama my friends rated 5 stars", "Something cozy like Frieren", "A short book for a weekend"];

export function AiChatSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { account, catalog, openDetail } = useStore();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async (q: string) => {
    const prompt = q.trim();
    if (!prompt || busy) return;
    setInput("");
    const id = String(Date.now());
    setMsgs((m) => [...m.filter((x) => x.failed !== prompt), { id, role: "user", text: prompt }]);
    if (/\bfriends?\b/i.test(prompt) && !account?.token) {
      setMsgs((m) => [...m, { id: id + "a", role: "ai", text: "Sign in to use your friends' ratings.", signIn: true }]);
      return;
    }
    setBusy(true);
    try {
      const r = await aiDiscover(prompt, "all", catalog, account?.token);
      setMsgs((m) => [...m, { id: id + "a", role: "ai", text: r.results.length ? r.intro : "I couldn't find anything for that yet. Try describing it differently.", results: r.results }]);
    } catch {
      setMsgs((m) => [...m, { id: id + "a", role: "ai", text: "The assistant couldn't answer right now.", failed: prompt }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable className="flex-1 bg-black/50" onPress={onClose} accessibilityLabel="Close assistant" />
        <View className="max-h-[70%] min-h-[50%] rounded-t-3xl border border-border bg-card" style={{ paddingBottom: insets.bottom + 8 }}>
          <View className="flex-row items-center px-4 pt-2">
            <Text className="flex-1 text-lg font-bold text-foreground">AI <Text className="text-primary">assistant</Text></Text>
            <Pressable onPress={onClose} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>
          <FlatList
            data={msgs}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View className="gap-2">
                <Text className="text-muted-foreground">Ask me what to watch or read next.</Text>
                {STARTERS.map((s) => (
                  <Pressable key={s} onPress={() => ask(s)} className="min-h-[44px] justify-center rounded-[10px] bg-primary/15 px-4 active:bg-primary/25">
                    <Text className="font-semibold text-primary">“{s}”</Text>
                  </Pressable>
                ))}
              </View>
            }
            ListFooterComponent={busy ? (
              <View className="gap-2">
                <View className="h-[14px] w-2/3 rounded bg-muted" />
                <View className="flex-row gap-2">{[0, 1, 2].map((i) => <View key={i} className="h-[105px] w-[70px] rounded-lg bg-muted" />)}</View>
              </View>
            ) : null}
            renderItem={({ item }) => item.role === "user" ? (
              <View className="max-w-[85%] self-end rounded-2xl bg-primary px-4 py-2">
                <Text className="text-primary-foreground">{item.text}</Text>
              </View>
            ) : (
              <View className="gap-2">
                <Text className="text-foreground">{item.text}</Text>
                {item.failed ? (
                  <Pressable onPress={() => ask(item.failed!)} className="min-h-[44px] justify-center self-start"><Text className="font-semibold text-primary">Retry</Text></Pressable>
                ) : null}
                {item.signIn ? (
                  <Pressable onPress={() => { onClose(); router.push("/auth"); }} className="min-h-[44px] justify-center self-start"><Text className="font-semibold text-primary">Sign in</Text></Pressable>
                ) : null}
                {item.results?.length ? (
                  <FlatList
                    horizontal
                    data={item.results}
                    keyExtractor={(m) => m.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                    renderItem={({ item: m }) => (
                      <Pressable onPress={() => { onClose(); openDetail(m.id); }} className="w-[80px] active:opacity-80">
                        <Cover media={m} className="h-[120px] w-[80px]" rounded="rounded-lg" />
                        <Text className="mt-1 text-xs text-foreground" numberOfLines={2}>{m.title}</Text>
                        {m.friendNote ? <Text className="text-[10px] text-primary" numberOfLines={2}>{m.friendNote}</Text> : null}
                      </Pressable>
                    )}
                  />
                ) : null}
              </View>
            )}
          />
          <View className="mx-4 min-h-[48px] flex-row items-center rounded-full border border-border bg-background pl-4 pr-1">
            <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => ask(input)} returnKeyType="send" placeholder="Ask for a suggestion..." placeholderTextColor={colors.mutedForeground} className="flex-1 py-3 text-base text-foreground" />
            <Pressable onPress={() => ask(input)} disabled={busy} className="h-[44px] w-[44px] items-center justify-center rounded-full bg-primary" accessibilityLabel="Send">
              <Ionicons name="arrow-up" size={20} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
