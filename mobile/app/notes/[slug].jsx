import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import NoteBlocks from "../../components/NoteBlocks.jsx";
<<<<<<< HEAD
import DownloadPdfButton from "../../components/DownloadPdfButton.jsx";
=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
import { ErrorState, LoadingState } from "../../components/RequestStates.jsx";
import Screen from "../../components/Screen.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import { getNote } from "../../services/notes.js";
import { resolveBlocks } from "../../utils/blocks.js";

export default function NoteDetail() {
  const { slug } = useLocalSearchParams();
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = getStyles(colors);
  const [note, setNote] = useState(null);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await getNote(slug);
      setNote(data);
      navigation.setOptions({ title: data.title });
      setStatus("idle");
    } catch (_error) {
      setStatus("error");
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  if (status === "loading") return <Screen><LoadingState label="Loading note..." /></Screen>;
  if (status === "error" || !note) return <Screen><ErrorState onRetry={load} /></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.category}>{note.category} · {note.difficulty}</Text>
        <Text style={styles.title}>{note.title}</Text>
        <Text style={styles.description}>{note.description}</Text>
        {note.tags?.length > 0 && (
          <View style={styles.tags}>
            {note.tags.map((tag) => (
              <Text key={tag} style={styles.tag}>#{tag}</Text>
            ))}
          </View>
        )}
<<<<<<< HEAD
        <DownloadPdfButton slug={note.slug} />
=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
        <View style={styles.divider} />
        <NoteBlocks blocks={resolveBlocks(note)} />
      </ScrollView>
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    content: { padding: 18, paddingBottom: 60, gap: 6 },
    category: { color: colors.accent, fontWeight: "800", fontSize: 12, textTransform: "uppercase" },
    title: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 4 },
    description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
    tag: { color: colors.accent, fontSize: 12 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  });
