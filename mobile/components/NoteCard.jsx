import { useRouter } from "expo-router";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { absoluteAsset } from "../services/api.js";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { radius } from "../constants/theme.js";

export default function NoteCard({ note }) {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}
      activeOpacity={0.8}
      onPress={() => router.push(`/notes/${note.slug}`)}
    >
      {note.thumbnail ? (
        <Image source={{ uri: absoluteAsset(note.thumbnail) }} style={[styles.thumb, { backgroundColor: colors.bgSoft }]} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.bgSoft }]}>
          <Text style={[styles.thumbFallbackText, { color: colors.accent }]}>{note.category?.[0] || "N"}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.category, { color: colors.accent }]}>{note.category}</Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{note.title}</Text>
        <Text style={[styles.description, { color: colors.muted }]} numberOfLines={2}>{note.description}</Text>
        <Text style={[styles.difficulty, { color: colors.muted }]}>{note.difficulty}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 10, marginBottom: 10 },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  thumbFallbackText: { fontSize: 24, fontWeight: "800" },
  body: { flex: 1, gap: 2, justifyContent: "center" },
  category: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  title: { fontSize: 15, fontWeight: "700" },
  description: { fontSize: 12.5 },
  difficulty: { fontSize: 11, marginTop: 2 },
});
