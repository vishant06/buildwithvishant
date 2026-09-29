import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { EmptyState, ErrorState, LoadingState } from "../../components/RequestStates.jsx";
import Screen from "../../components/Screen.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import * as adminApi from "../../services/admin.js";
import * as notesApi from "../../services/notes.js";
import { radius } from "../../constants/theme.js";

const SECTIONS = ["Notes", "Users", "Messages"];

export default function AdminDashboard() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = getStyles(colors);
  const [section, setSection] = useState("Notes");
  const [data, setData] = useState({ Notes: [], Users: [], Messages: [] });
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [notes, users, messages] = await Promise.all([
        notesApi.listAdminNotes(),
        adminApi.listUsers(),
        adminApi.listMessages().catch(() => []),
      ]);
      setData({ Notes: notes, Users: users, Messages: messages });
      setStatus("idle");
    } catch (_error) {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeNote = (note) => {
    Alert.alert("Delete note", `Delete "${note.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await notesApi.deleteNote(note._id);
            setData((current) => ({ ...current, Notes: current.Notes.filter((n) => n._id !== note._id) }));
          } catch (error) {
            Alert.alert("Couldn't delete note", error.message);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.tabs}>
        {SECTIONS.map((item) => (
          <TouchableOpacity key={item} style={[styles.tab, section === item && styles.tabActive]} onPress={() => setSection(item)}>
            <Text style={[styles.tabText, section === item && styles.tabTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {section === "Notes" && (
        <TouchableOpacity style={styles.addButton} onPress={() => router.push("/admin/notes/new")}>
          <Ionicons name="add" size={18} color={colors.accentText} />
          <Text style={styles.addButtonText}>Add note</Text>
        </TouchableOpacity>
      )}

      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState onRetry={load} />}
      {status === "idle" && (
        <FlatList
          data={data[section]}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title={`No ${section.toLowerCase()} yet`} />}
          renderItem={({ item }) => {
            if (section === "Notes") {
              return (
                <View style={styles.row}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/admin/notes/${item._id}`)}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowMuted}>{item.category} · {item.published ? "Published" : "Draft"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeNote(item)} hitSlop={10}>
                    <Ionicons name="trash" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            }
            if (section === "Users") {
              return (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.name} ({item.username})</Text>
                    <Text style={styles.rowMuted}>{item.email} · {item.role}</Text>
                  </View>
                </View>
              );
            }
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.name || item.email}</Text>
                  <Text style={styles.rowMuted} numberOfLines={2}>{item.message}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    tabs: { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 8 },
    tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    tabText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
    tabTextActive: { color: colors.accentText },
    addButton: { flexDirection: "row", gap: 6, alignSelf: "flex-start", marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center" },
    addButtonText: { color: colors.accentText, fontWeight: "800", fontSize: 13 },
    list: { padding: 16, paddingTop: 4 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 8 },
    rowTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
    rowMuted: { color: colors.muted, fontSize: 12, marginTop: 2 },
  });
