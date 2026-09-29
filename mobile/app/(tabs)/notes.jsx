import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import NoteCard from "../../components/NoteCard.jsx";
import { EmptyState, ErrorState, LoadingState } from "../../components/RequestStates.jsx";
import Screen from "../../components/Screen.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import { listNotes } from "../../services/notes.js";
import { radius } from "../../constants/theme.js";

export default function Notes() {
  const { colors } = useAppTheme();
  const styles = getStyles(colors);
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState("loading");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(null);

  const load = useCallback(async () => {
    setStatus((current) => (current === "idle" ? "refreshing" : "loading"));
    try {
      setNotes(await listNotes());
      setStatus("idle");
    } catch (_error) {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const categories = useMemo(
    () => Array.from(new Set(notes.map((note) => note.category).filter(Boolean))),
    [notes]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesCategory = !category || note.category === category;
      const matchesSearch = !q || [note.title, note.description, note.category].some((field) => field?.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [notes, search, category]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search notes..." placeholderTextColor={colors.muted} style={styles.searchInput} />
        </View>
        {categories.length > 0 && (
          <FlatList
            horizontal
            data={["All", ...categories]}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
            renderItem={({ item }) => {
              const active = item === "All" ? !category : category === item;
              return (
                <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={() => setCategory(item === "All" ? null : item)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {status === "loading" && <LoadingState label="Loading notes..." />}
      {status === "error" && <ErrorState onRetry={load} />}
      {(status === "idle" || status === "refreshing") && (
        <FlatList
          data={visible}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <NoteCard note={item} />}
          ListEmptyComponent={<EmptyState title="No notes match your search" />}
        />
      )}
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, paddingTop: 10 },
    searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
    searchInput: { flex: 1, color: colors.text, padding: 0 },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },
    chipTextActive: { color: colors.accentText },
    list: { padding: 16, paddingTop: 0 },
  });
