/**
 * Fedites mobile shell — Phase 1: auth (invite-code signup + sign-in with
 * 2FA), session, profile, inbox. Same API contracts as web (M6, E11 parity).
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from "react-native";
import { visibleItems, type SessionBoot } from "@fedites/config";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8787";

const styles = StyleSheet.create({
  screen: { flex: 1 },
  masthead: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 8, justifyContent: "center" },
  mastheadText: { fontSize: 22, fontWeight: "700" },
  title: { fontSize: 32, fontWeight: "700", paddingHorizontal: 16 },
  micro: { fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", paddingHorizontal: 16, paddingBottom: 8 },
  body: { fontSize: 15, paddingHorizontal: 16 },
  input: { minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, marginVertical: 4, fontSize: 15 },
  btn: { minHeight: 44, marginHorizontal: 16, marginVertical: 8, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontWeight: "600" },
  tabbar: { flexDirection: "row", justifyContent: "space-around", minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  tabLabel: { fontSize: 11, letterSpacing: 0.4 },
  row: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
});

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${res.status})`);
  return body as T;
}

interface Member { id: string; displayName: string; verification: string; roles: string[]; totpEnabled: boolean; email: string; phone: string | null }
interface Inbox { items: Array<{ id: string; title: string; read: boolean }>; unread: number }

export default function App(): React.ReactElement {
  const [boot, setBoot] = useState<SessionBoot | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback((): void => {
    api<{ member: Member | null }>("/v1/auth/session").then((s) => setMember(s.member)).catch(() => setMember(null)).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/v1/config?device=mobile`).then((r) => r.json() as Promise<SessionBoot>).then(setBoot).catch(() => setBoot(null));
    refresh();
  }, [refresh]);

  if (boot === null || !loaded) {
    return (
      <View style={styles.screen}>
        <View style={styles.masthead}><Text style={styles.mastheadText}>Fedites</Text></View>
      </View>
    );
  }

  const theme = boot.resolved.theme;

  if (member === null) {
    return <AuthGate accent={theme.accent} danger={theme.danger} onDone={refresh} />;
  }

  return <SignedIn member={member} boot={boot} accent={theme.accent} onSignOut={() => { void api("/v1/auth/logout", { method: "POST" }).then(refresh); }} />;
}

function AuthGate({ onDone, accent, danger }: { accent: string; danger: string; onDone: () => void }): React.ReactElement {
  const [mode, setMode] = useState<"signin" | "join">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [setYear, setSetYear] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signIn = async (): Promise<void> => {
    setError(null);
    try {
      await api("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password, totp: needsTotp ? totp : undefined }) });
      onDone();
    } catch (e) {
      if ((e as Error).message === "totp-required") { setNeedsTotp(true); return; }
      setError((e as Error).message);
    }
  };

  const join = async (): Promise<void> => {
    setError(null);
    try {
      await api("/v1/auth/signup", { method: "POST", body: JSON.stringify({ inviteCode: code, email, password, displayName: name, setYear: setYear ? Number(setYear) : undefined }) });
      setError(null);
      setMode("signin");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.masthead}><Text style={styles.mastheadText}>Fedites</Text></View>
      <Text style={styles.title}>{mode === "signin" ? "Sign in" : "Join with your invite code"}</Text>
      <View style={{ flexDirection: "row", paddingHorizontal: 16 }}>
        {(["signin", "join"] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={{ minHeight: 44, justifyContent: "center", marginRight: 24, borderBottomWidth: 2, borderBottomColor: mode === m ? accent : "transparent" }}>
            <Text style={{ color: mode === m ? accent : undefined }}>{m === "signin" ? "Sign in" : "New member"}</Text>
          </Pressable>
        ))}
      </View>
      {mode === "signin" ? (
        <View>
          <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          {needsTotp && <TextInput style={styles.input} placeholder="6-digit authentication code" keyboardType="number-pad" value={totp} onChangeText={setTotp} />}
        </View>
      ) : (
        <View>
          <TextInput style={styles.input} placeholder="Invite code" autoCapitalize="characters" value={code} onChangeText={setCode} />
          <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Password (10+ characters)" secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.input} placeholder="Set year, e.g. 1998 (optional)" keyboardType="number-pad" value={setYear} onChangeText={setSetYear} />
        </View>
      )}
      {error !== null && <Text style={{ color: danger, fontSize: 13, paddingHorizontal: 16 }}>{error}</Text>}
      <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} onPress={() => void (mode === "signin" ? signIn() : join())}>
        <Text style={styles.btnText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
      </Pressable>
      <Text style={styles.micro}>Signup needs an invite code from a verified member.</Text>
    </ScrollView>
  );
}

function SignedIn({ member, boot, onSignOut }: { member: Member; boot: SessionBoot; accent: string; onSignOut: () => void }): React.ReactElement {
  const [tab, setTab] = useState<string>("/me");
  const [inbox, setInbox] = useState<Inbox | null>(null);

  useEffect(() => {
    api<Inbox>("/v1/notifications").then(setInbox).catch(() => undefined);
  }, [tab]);

  const items = visibleItems(boot.config.nav, member.roles.some((r) => r !== "member"));
  const current = items.find((i) => i.route === tab) ?? items[0]!;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.masthead}>
        <Text style={styles.mastheadText}>{boot.config.instance.shortName}</Text>
        {inbox !== null && inbox.unread > 0 && <Text style={styles.micro}>{inbox.unread} new</Text>}
      </View>
      <Text style={styles.title}>{current.label}</Text>
      <ScrollView style={{ flex: 1 }}>
        <Text style={styles.body}>{member.displayName}</Text>
        <Text style={styles.micro}>{member.verification}{member.roles.length > 1 ? ` · ${member.roles.filter((r) => r !== "member").join(", ")}` : ""}</Text>
        {tab === "/me" && (
          <>
            <Pressable onPress={onSignOut} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.btnText}>Sign out</Text>
            </Pressable>
          </>
        )}
        {inbox !== null && tab !== "/me" && inbox.items.map((n) => (
          <View key={n.id} style={styles.row}>
            <Text style={{ fontSize: 15, fontWeight: n.read ? "400" : "600" }}>{n.title}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.tabbar, { backgroundColor: boot.resolved.theme.base }]}>
        {items.map((i) => (
          <Pressable key={i.item} accessibilityRole="button" accessibilityLabel={i.label} accessibilityState={{ selected: i.route === tab }} onPress={() => setTab(i.route)} style={({ pressed }) => [styles.tab, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}>
            <Text style={[styles.tabLabel, { color: i.route === tab ? boot.resolved.theme.accent : boot.resolved.theme["neutral-600"] }]}>{i.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
