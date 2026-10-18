import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { signInAccount } from "@/lib/mediaService";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

function Field(props: { label: string; value: string; onChange: (s: string) => void; secure?: boolean; keyboard?: "email-address" }) {
  const colors = useThemeColors();
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChange}
      accessibilityLabel={props.label}
      placeholder={props.label}
      placeholderTextColor={colors.mutedForeground}
      secureTextEntry={props.secure}
      keyboardType={props.keyboard}
      autoCapitalize="none"
      className="min-h-[52px] rounded-full border border-border bg-card px-5 text-base text-foreground"
    />
  );
}

export default function Auth() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { account, signUp, signOut, resetLocalData } = useStore();
  const [mode, setMode] = useState<"up" | "in">("up");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Enter a valid email.");
    if (mode === "up" && username.trim().length < 3) return setErr("Username needs at least 3 characters.");
    if (pw.length < 6) return setErr("Password needs at least 6 characters.");
    if (mode === "up" && pw !== pw2) return setErr("Passwords don't match.");
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const token = await signInAccount(email.trim(), pw, mode === "up");
      if (!token) {
        setNotice("Check your inbox to confirm your email, then sign in.");
        setMode("in");
        setPw("");
        setPw2("");
        return;
      }
      signUp({ email: email.trim(), username: mode === "up" ? username.trim() : email.split("@")[0], token });
      router.back();
    } catch (error) {
      setErr(error instanceof TypeError ? "Couldn't connect. Check your connection and try again." : error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const ThickPlus = ({ size = 30, thickness = 8, style, opacity = 1, floating = true }: { size?: number; thickness?: number; style?: object; opacity?: number; floating?: boolean }) => (
    <View style={[{ position: floating ? "absolute" : "relative", width: size, height: size, opacity }, style]} pointerEvents="none">
      <View style={{ position: "absolute", left: 0, top: (size - thickness) / 2, width: size, height: thickness, backgroundColor: colors.primary }} />
      <View style={{ position: "absolute", top: 0, left: (size - thickness) / 2, width: thickness, height: size, backgroundColor: colors.primary }} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View className="flex-1 bg-background">
        <ThickPlus style={{ top: insets.top + 60, left: 16 }} opacity={0.6} />
        <ThickPlus style={{ top: insets.top + 60, right: 16 }} opacity={0.6} />
        <ThickPlus style={{ bottom: insets.bottom + 16, left: 16 }} opacity={0.6} />
        <ThickPlus style={{ bottom: insets.bottom + 16, right: 16 }} opacity={0.6} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 32, paddingHorizontal: 28 }}>
          <View className="flex-row items-center">
            <Pressable onPress={() => router.back()} className="min-h-[44px] min-w-[44px] items-center justify-center" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={26} color={colors.foreground} />
            </Pressable>
            <View className="flex-1" />
            <Text className="text-sm text-muted-foreground">Account</Text>
          </View>

          {account?.token ? (
            <View className="mt-10 items-center gap-4">
              <View className="h-[110px] w-[110px] items-center justify-center rounded-full border-2 border-primary bg-card">
                <Ionicons name="person" size={52} color={colors.mutedForeground} />
              </View>
              <Text className="text-xl font-bold text-foreground">@{account.username}</Text>
              <Text className="text-muted-foreground">{account.email}</Text>
              <Pressable onPress={() => { signOut(); router.back(); }} className="mt-4 min-h-[52px] w-full items-center justify-center rounded-full bg-primary">
                <Text className="font-bold text-primary-foreground">Sign out</Text>
              </Pressable>
              {confirmReset ? (
                <View className="w-full gap-2 rounded-2xl border border-border bg-card p-4">
                  <Text className="text-foreground">Reset logs, favorites, watchlist and search history on this device to the demo defaults? Your online account will remain.</Text>
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => setConfirmReset(false)} className="min-h-[44px] flex-1 items-center justify-center rounded-full border border-border">
                      <Text className="text-foreground">Cancel</Text>
                    </Pressable>
                    <Pressable onPress={() => { resetLocalData(); router.back(); }} className="min-h-[44px] flex-1 items-center justify-center rounded-full bg-destructive">
                      <Text className="font-bold text-destructive-foreground">Reset</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setConfirmReset(true)} className="min-h-[44px] justify-center">
                  <Text className="text-destructive">Reset local demo data</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View className="mt-6 gap-4">
              <View className="items-center">
                <View className="h-[110px] w-[110px] items-center justify-center rounded-full border-2 border-border bg-card">
                  <Ionicons name="person" size={52} color={colors.mutedForeground} />
                </View>
                <Text className="mt-4 text-2xl font-black tracking-widest text-foreground">
                  HOBBY<Text className="text-primary">BOX</Text>
                </Text>
              </View>
              <Text className="text-center text-sm text-muted-foreground">Sign in for personal and friend-aware AI search. Logs and watchlists stay on this device.</Text>
              <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
              {mode === "up" ? <Field label="Username" value={username} onChange={setUsername} /> : null}
              <Field label="Password" value={pw} onChange={setPw} secure />
              {mode === "up" ? <Field label="Repeat Password" value={pw2} onChange={setPw2} secure /> : null}
              {notice ? <Text accessibilityLiveRegion="polite" className="text-center text-primary">{notice}</Text> : null}
              {err ? <Text accessibilityLiveRegion="polite" className="text-center text-destructive">{err}</Text> : null}
              <Pressable onPress={submit} disabled={busy} className="min-h-[52px] items-center justify-center rounded-full bg-primary active:opacity-80">
                <Text className="text-base font-bold text-primary-foreground">{busy ? "Please wait…" : mode === "up" ? "Sign up" : "Sign in"}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => { setMode(mode === "up" ? "in" : "up"); setErr(""); setNotice(""); }} className="mt-4 min-h-[44px] items-center justify-center">
                <View className="flex-row items-center gap-1.5"><ThickPlus size={22} thickness={6} floating={false} /><Text className="font-semibold text-foreground">{mode === "up" ? "Sign in" : "Create account"}</Text></View>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
