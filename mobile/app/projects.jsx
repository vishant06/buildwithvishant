import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, ErrorState, LoadingState } from "../components/RequestStates.jsx";
import Screen from "../components/Screen.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { absoluteAsset } from "../services/api.js";
import { listProjects } from "../services/projects.js";
import { radius } from "../constants/theme.js";

export default function Projects() {
  const { colors } = useAppTheme();
  const styles = getStyles(colors);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setProjects(await listProjects());
      setStatus("idle");
    } catch (_error) {
      setStatus("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (status === "loading") return <Screen><LoadingState label="Loading projects..." /></Screen>;
  if (status === "error") return <Screen><ErrorState onRetry={load} /></Screen>;

  return (
    <Screen>
      <FlatList
        data={projects}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="No projects published yet" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.image ? <Image source={{ uri: absoluteAsset(item.image) }} style={styles.image} /> : null}
            <View style={styles.body}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
              <View style={styles.tags}>
                {item.technologies?.map((tech) => (
                  <Text key={tech} style={styles.tag}>{tech}</Text>
                ))}
              </View>
              <View style={styles.linkRow}>
                {item.liveLink ? (
                  <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(item.liveLink)}>
                    <Ionicons name="open-outline" size={14} color={colors.accentText} />
                    <Text style={styles.linkButtonText}>Live</Text>
                  </TouchableOpacity>
                ) : null}
                {item.githubLink ? (
                  <TouchableOpacity style={[styles.linkButton, styles.linkButtonGhost]} onPress={() => Linking.openURL(item.githubLink)}>
                    <Ionicons name="logo-github" size={14} color={colors.text} />
                    <Text style={[styles.linkButtonText, { color: colors.text }]}>Code</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    list: { padding: 16, gap: 12 },
    card: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: "hidden", marginBottom: 12 },
    image: { width: "100%", height: 160, backgroundColor: colors.bgSoft },
    body: { padding: 14, gap: 6 },
    title: { color: colors.text, fontSize: 16, fontWeight: "800" },
    description: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
    tag: { color: colors.accent, fontSize: 11, fontWeight: "700", backgroundColor: colors.bgSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    linkRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    linkButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
    linkButtonGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
    linkButtonText: { color: colors.accentText, fontSize: 12, fontWeight: "700" },
  });
