/**
 * Fedites mobile shell (phases.md 0.1/0.4): Expo app shell whose nav renders
 * from the instance config at session boot — same schema as web (I2: tab
 * order is law; E1: mobile is the app-first experience).
 */
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { visibleItems, type SessionBoot, type NavItemView } from "@fedites/config";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8787";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "var(--c-base)" },
  masthead: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
  },
  mastheadText: { fontSize: 22, fontWeight: "700" },
  title: { fontSize: 32, fontWeight: "700", paddingHorizontal: 16 },
  micro: { fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", paddingHorizontal: 16, paddingBottom: 8 },
  body: { fontSize: 15, paddingHorizontal: 16 },
  tabbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  tabLabel: { fontSize: 11, letterSpacing: 0.4 },
});

export default function App(): React.ReactElement {
  const [session, setSession] = useState<SessionBoot | null>(null);
  const [route, setRoute] = useState("/");

  useEffect(() => {
    fetch(`${API_URL}/v1/config?device=mobile`)
      .then((r) => r.json() as Promise<SessionBoot>)
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  if (session === null) {
    return (
      <View style={styles.screen}>
        <View style={styles.masthead}><Text style={styles.mastheadText}>Fedites</Text></View>
      </View>
    );
  }

  const member = session.member;
  const hasDutyRole = member !== null && member.roles.some((r) => r !== "member");
  const items: NavItemView[] = visibleItems(session.config.nav, hasDutyRole);
  const current = items.find((i) => i.route === route) ?? items[0]!;

  return (
    <View style={styles.screen}>
      <View style={styles.masthead}>
        <Text style={styles.mastheadText}>{session.config.instance.shortName}</Text>
      </View>
      <Text style={styles.title}>{current.label}</Text>
      <Text style={styles.micro}>
        {session.config.instance.copy[`tab.${current.item}.job`] ?? ""}
      </Text>
      <Text style={styles.body}>
        {session.config.instance.copy[`empty.${current.item}.title`] ?? "Nothing here yet"}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={styles.tabbar}>
        {items.map((i) => (
          <Pressable
            key={i.item}
            accessibilityRole="button"
            accessibilityLabel={i.label}
            accessibilityState={{ selected: i.route === route }}
            onPress={() => setRoute(i.route)}
            style={({ pressed }) => [
              styles.tab,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <Text style={[styles.tabLabel, { color: i.route === route ? session.resolved.theme.accent : session.resolved.theme["neutral-600"] }]}>
              {i.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
