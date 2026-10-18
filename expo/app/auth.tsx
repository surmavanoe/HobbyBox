import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { signInAccount } from "@/lib/mediaService";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

const LANGS = ["EN", "ES", "FR", "DE", "JA"];

function Field(props: { label: string; value: string; onChange: (s: string) => void; secure?: boolean; keyboard?: "email-address" }) {
  const colors = useThemeColors();
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChange}
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
  const { account, signUp, signOut, deleteAccount } = useStore();
  const [lang, setLang] = useState(0);
  const [mode, setMode] = useState<"up" | "in">("up");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter a valid email.");
    if (mode === "up" && username.trim().length < 3) return setErr("Username needs at least 3 characters.");
    if (pw.length < 6) return setErr("Password needs at least 6 characters.");
    if (mode === "up" && pw !== pw2) return setErr("Passwords don't match.");
    setErr("");
    setBusy(true);
    try {
      const token = await signInAccount(email.trim(), pw, mode === "up");
      signUp({ email: email.trim(), username: mode === "up" ? username.trim() : email.split("@")[0], token });
      router.back();
    } catch {
      setErr(mode === "up" ? "Couldn't create the account. Try signing in instead." : "Wrong email or password.");
    } finally {
      setBusy(false);
    }
  };

  const ThickPlus = ({ size = 30, thickness = 8, style, opacity = 1 }: { size?: number; thickness?: number; style?: object; opacity?: number }) => (
    <View style={[{ position: "absolute", width: size, height: size, opacity }, style]} pointerEvents="none">
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
            <Pressable onPress={() => setLang((l) => (l + 1) % LANGS.length)} className="min-h-[44px] justify-center">
              <Text className="text-sm text-muted-foreground">
                Language: <Text className="font-bold text-primary">{LANGS[lang]}</Text>
              </Text>
            </Pressable>
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
              {confirmDelete ? (
                <View className="w-full gap-2 rounded-2xl border border-border bg-card p-4">
                  <Text className="text-foreground">Delete your account and all your logs? This can't be undone.</Text>
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => setConfirmDelete(false)} className="min-h-[44px] flex-1 items-center justify-center rounded-full border border-border">
                      <Text className="text-foreground">Cancel</Text>
                    </Pressable>
                    <Pressable onPress={() => { deleteAccount(); router.back(); }} className="min-h-[44px] flex-1 items-center justify-center rounded-full bg-destructive">
                      <Text className="font-bold text-destructive-foreground">Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setConfirmDelete(true)} className="min-h-[44px] justify-center">
                  <Text className="text-destructive">Delete account</Text>
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
              <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
              {mode === "up" ? <Field label="Username" value={username} onChange={setUsername} /> : null}
              <Field label="Password" value={pw} onChange={setPw} secure />
              {mode === "up" ? <Field label="Repeat Password" value={pw2} onChange={setPw2} secure /> : null}
              {err ? <Text className="text-center text-destructive">{err}</Text> : null}
              <Pressable onPress={submit} disabled={busy} className="min-h-[52px] items-center justify-center rounded-full bg-primary active:opacity-80">
                <Text className="text-base font-bold text-primary-foreground">{mode === "up" ? "Sign up" : "Sign in"}</Text>
              </Pressable>
              <Pressable onPress={() => { setMode(mode === "up" ? "in" : "up"); setErr(""); }} className="mt-4 min-h-[44px] items-center justify-center">
                <View className="flex-row items-center gap-1.5"><ThickPlus size={22} thickness={6} /><Text className="font-semibold text-foreground">{mode === "up" ? "Sign in" : "Create account"}</Text></View>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
