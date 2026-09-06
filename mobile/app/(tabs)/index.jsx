import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Logo from "../../components/Logo.jsx";
import NoteCard from "../../components/NoteCard.jsx";
import { ErrorState, LoadingState } from "../../components/RequestStates.jsx";
import Screen from "../../components/Screen.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import { absoluteAsset } from "../../services/api.js";
import { listNotes } from "../../services/notes.js";
import { radius } from "../../constants/theme.js";

const QUICK_LINKS = [
  { label: "Notes", icon: "book", href: "/notes" },
  { label: "Playground", icon: "code-slash", href: "/playground" },
  { label: "AI Assistant", icon: "sparkles", href: "/ai" },
  { label: "Projects", icon: "briefcase", href: "/projects" },
  { label: "Contact", icon: "mail", href: "/contact" },
];

export default function Home() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { user, isAuthenticated } = useAuth();
  const styles = getStyles(colors);

  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    setStatus((current) => (current === "idle" ? "refreshing" : "loading"));
    try {
      const data = await listNotes();
      setNotes(data.slice(0, 6));
      setStatus("idle");
    } catch (_error) {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <View style={styles.navbar}>
        <View style={styles.navbarLeft}>
          <Logo size={32} />
          <Text style={styles.brand}>BuildWithVishant</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push(isAuthenticated ? "/profile" : "/login")}
        >
          {isAuthenticated ? (
            user?.avatar?.url ? (
              <Image source={{ uri: absoluteAsset(user.avatar.url) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>{user?.name?.[0]?.toUpperCase()}</Text>
              </View>
            )
          ) : (
            <Ionicons name="log-in-outline" size={22} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={status === "refreshing"} onRefresh={load} tintColor={colors.accent} />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>BuildWithVishant</Text>
          <Text style={styles.heroTitle}>Build. Learn. Code.</Text>
          <Text style={styles.heroText}>
            A developer-learning platform with structured notes, a real code playground, and an
            AI assistant — all in your pocket.
          </Text>
        </View>

        <View style={styles.quickGrid}>
          {QUICK_LINKS.map((item) => (
            <TouchableOpacity key={item.label} style={styles.quickCard} onPress={() => router.push(item.href)}>
              <Ionicons name={item.icon} size={22} color={colors.accent} />
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Notes</Text>
          <TouchableOpacity onPress={() => router.push("/notes")}>
            <Text style={styles.sectionLink}>See all</Text>
          </TouchableOpacity>
        </View>
        {status === "loading" && <LoadingState label="Loading notes..." />}
        {status === "error" && <ErrorState onRetry={load} />}
        {(status === "idle" || status === "refreshing") &&
          (notes.length ? notes.map((note) => <NoteCard key={note._id} note={note} />) : (
            <Text style={styles.muted}>No notes published yet.</Text>
          ))}
      </ScrollView>
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    navbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    navbarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    brand: { color: colors.text, fontWeight: "800", fontSize: 15 },
    profileButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    avatar: { width: 34, height: 34, borderRadius: 17 },
    avatarFallback: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border },
    avatarFallbackText: { color: colors.accent, fontWeight: "800" },
    content: { padding: 16, paddingBottom: 40, gap: 18 },
    hero: { gap: 6 },
    heroEyebrow: { color: colors.accent, fontWeight: "800", letterSpacing: 1, fontSize: 12, textTransform: "uppercase" },
    heroTitle: { color: colors.text, fontSize: 30, fontWeight: "800" },
    heroText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    quickCard: { flexBasis: "31%", flexGrow: 1, backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center", gap: 8 },
    quickLabel: { color: colors.text, fontSize: 12, fontWeight: "700", textAlign: "center" },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
    sectionLink: { color: colors.accent, fontSize: 13, fontWeight: "700" },
    muted: { color: colors.muted },
  });
