import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Accordion from "../../components/Accordion.jsx";
import Logo from "../../components/Logo.jsx";
import NoteCard from "../../components/NoteCard.jsx";
import { ErrorState, LoadingState } from "../../components/RequestStates.jsx";
import Screen from "../../components/Screen.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import { absoluteAsset } from "../../services/api.js";
import { listNotes } from "../../services/notes.js";
import { radius } from "../../constants/theme.js";
import { ABOUT_FAQ_ITEMS } from "../../constants/faq.js";

const QUICK_LINKS = [
  { label: "Notes", icon: "book", href: "/notes" },
  { label: "Playground", icon: "code-slash", href: "/playground" },
  { label: "AI Assistant", icon: "sparkles", href: "/ai" },
  { label: "Projects", icon: "briefcase", href: "/projects" },
  { label: "Contact", icon: "mail", href: "/contact" },
];

// Mirrors client/src/pages/Home.jsx's local PLAYGROUND_LANGUAGES list — kept
// local for the same reason the web version is: just used for a count/chips,
// not worth wiring up a shared package for.
const PLAYGROUND_LANGUAGES = [
  "HTML / CSS / JS", "JavaScript", "TypeScript", "Python", "Java", "C", "C++",
  "C#", "Go", "Rust", "Ruby", "PHP", "Kotlin", "Swift", "Dart", "R", "Scala",
  "Bash / Shell", "SQL", "Lua", "Perl", "Haskell",
];

// Mirrors client/src/pages/Home.jsx's STEPS.
const HOW_IT_WORKS = [
  { n: "01", icon: "school", title: "Learn", desc: "Explore structured programming notes across languages, frameworks and core CS concepts." },
  { n: "02", icon: "hammer", title: "Practice", desc: "Write and run real code right on your phone — no local setup required." },
  { n: "03", icon: "construct", title: "Build", desc: "Lean on the AI assistant and your notes to turn practice into real projects." },
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
      setNotes(Array.isArray(data) ? data : []);
      setStatus("idle");
    } catch (_error) {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latestNotes = useMemo(() => notes.slice(0, 6), [notes]);
  const categoryCount = useMemo(
    () => new Set(notes.map((note) => note.category).filter(Boolean)).size,
    [notes]
  );
  const firstName = user?.name?.split(" ")[0];

  const stats = [
    { icon: "book", label: "Notes published", value: status === "idle" || status === "refreshing" ? notes.length : "—" },
    { icon: "layers", label: "Subjects covered", value: status === "idle" || status === "refreshing" ? categoryCount : "—" },
    { icon: "terminal", label: "Languages in Playground", value: PLAYGROUND_LANGUAGES.length },
    { icon: "sparkles", label: "AI learning assistant", value: "Built-in" },
  ];

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
        {/* HERO */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>
            {isAuthenticated ? `Welcome back, ${firstName || "builder"} 👋` : "BuildWithVishant · developer learning platform"}
          </Text>
          <Text style={styles.heroTitle}>Learn. Code. Build.</Text>
          <Text style={styles.heroText}>
            Study clear programming notes, practice in a real code playground, and get unstuck faster with
            an AI learning companion — everything you need to go from concept to project, in one place.
          </Text>
        </View>

        {/* STATS */}
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Ionicons name={stat.icon} size={18} color={colors.accent} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* QUICK LINKS */}
        <View style={styles.quickGrid}>
          {QUICK_LINKS.map((item) => (
            <TouchableOpacity key={item.label} style={styles.quickCard} onPress={() => router.push(item.href)}>
              <Ionicons name={item.icon} size={22} color={colors.accent} />
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* LATEST NOTES */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest notes</Text>
            <TouchableOpacity onPress={() => router.push("/notes")}>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>
          {status === "loading" && <LoadingState label="Loading notes..." />}
          {status === "error" && <ErrorState onRetry={load} />}
          {(status === "idle" || status === "refreshing") && (
            latestNotes.length ? (
              <View style={{ gap: 10 }}>
                {latestNotes.map((note) => <NoteCard key={note._id} note={note} />)}
              </View>
            ) : (
              <Text style={styles.muted}>No notes published yet — check back soon.</Text>
            )
          )}
        </View>

        {/* PLAYGROUND PROMO */}
        <View style={styles.promoCard}>
          <Ionicons name="code-slash" size={22} color={colors.accent} />
          <Text style={styles.promoTitle}>Code. Run. Experiment.</Text>
          <Text style={styles.promoText}>
            Write and execute real code right in the app across {PLAYGROUND_LANGUAGES.length}+ languages — no local
            environment to configure.
          </Text>
          <TouchableOpacity style={styles.promoButton} onPress={() => router.push("/playground")}>
            <Text style={styles.promoButtonText}>Open Playground</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.accentText} />
          </TouchableOpacity>
        </View>

        {/* AI PROMO */}
        <View style={styles.promoCard}>
          <Ionicons name="sparkles" size={22} color={colors.accent} />
          <Text style={styles.promoTitle}>Your AI-powered learning companion</Text>
          <Text style={styles.promoText}>
            Stuck on a bug or a concept? Ask about React, JavaScript, Node.js or MongoDB, or paste code to get it
            explained line by line.
          </Text>
          <TouchableOpacity style={styles.promoButton} onPress={() => router.push("/ai")}>
            <Text style={styles.promoButtonText}>Try AI</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.accentText} />
          </TouchableOpacity>
        </View>

        {/* HOW IT WORKS */}
        <View>
          <Text style={styles.sectionTitle}>From learning to building, in three steps</Text>
          <View style={styles.stepsGrid}>
            {HOW_IT_WORKS.map((step) => (
              <View key={step.n} style={styles.stepCard}>
                <Text style={styles.stepNumber}>{step.n}</Text>
                <Ionicons name={step.icon} size={20} color={colors.accent} />
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* FINAL CTA */}
        <View style={styles.finalCta}>
          <Text style={styles.finalCtaTitle}>
            {isAuthenticated ? `Keep the momentum going, ${firstName || "builder"}.` : "Everything you need to learn, practice and build."}
          </Text>
          <Text style={styles.finalCtaText}>
            {isAuthenticated
              ? "Jump back into your notes, playground, or ask the AI assistant a question."
              : "Programming notes, a real code playground, and an AI companion — free to start."}
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/notes")}>
            <Text style={styles.buttonText}>Explore Notes</Text>
          </TouchableOpacity>
        </View>

        {/* ABOUT / FAQ */}
        <View>
          <Text style={styles.sectionEyebrow}>About BuildWithVishant</Text>
          <Text style={styles.sectionTitle}>Frequently asked questions</Text>
          <Text style={styles.sectionSubtext}>
            A developer learning platform created by Vishant Kumar — programming notes, an in-browser coding
            playground, and an AI learning assistant.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Accordion items={ABOUT_FAQ_ITEMS} />
          </View>
        </View>

        {/* CONTACT CTA */}
        <View style={styles.promoCard}>
          <Ionicons name="mail" size={22} color={colors.accent} />
          <Text style={styles.promoTitle}>Let's build something clean</Text>
          <Text style={styles.promoText}>
            Send a message directly to Vishant Kumar — it's saved and emailed straight to the inbox.
          </Text>
          <TouchableOpacity style={styles.promoButton} onPress={() => router.push("/contact")}>
            <Text style={styles.promoButtonText}>Get in touch</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.accentText} />
          </TouchableOpacity>
        </View>
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
    content: { padding: 16, paddingBottom: 40, gap: 22 },
    hero: { gap: 6 },
    heroEyebrow: { color: colors.accent, fontWeight: "800", letterSpacing: 0.5, fontSize: 12, textTransform: "uppercase" },
    heroTitle: { color: colors.text, fontSize: 30, fontWeight: "800" },
    heroText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, gap: 4 },
    statValue: { color: colors.text, fontSize: 20, fontWeight: "800" },
    statLabel: { color: colors.muted, fontSize: 11 },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    quickCard: { flexBasis: "31%", flexGrow: 1, backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center", gap: 8 },
    quickLabel: { color: colors.text, fontSize: 12, fontWeight: "700", textAlign: "center" },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    sectionEyebrow: { color: colors.accent, fontWeight: "800", letterSpacing: 0.5, fontSize: 11, textTransform: "uppercase" },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginTop: 4, marginBottom: 10 },
    sectionSubtext: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    sectionLink: { color: colors.accent, fontSize: 13, fontWeight: "700" },
    muted: { color: colors.muted },
    promoCard: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 8, alignItems: "flex-start" },
    promoTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
    promoText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    promoButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, marginTop: 4 },
    promoButtonText: { color: colors.accentText, fontSize: 13, fontWeight: "800" },
    stepsGrid: { gap: 10 },
    stepCard: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, gap: 4 },
    stepNumber: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    stepTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    stepDesc: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    finalCta: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, gap: 8, alignItems: "flex-start" },
    finalCtaTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    finalCtaText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    button: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
    buttonText: { color: colors.accentText, fontWeight: "800" },
  });
