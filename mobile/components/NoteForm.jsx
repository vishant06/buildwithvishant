import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { uploadThumbnail } from "../services/notes.js";
import { absoluteAsset } from "../services/api.js";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { radius } from "../constants/theme.js";
import { prepareImageForUpload } from "../utils/image.js";

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

export default function NoteForm({ initial, onSubmit, submitLabel = "Save note" }) {
  const { colors } = useAppTheme();
  const styles = getStyles(colors);

  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    category: initial?.category || "",
    difficulty: initial?.difficulty || "Beginner",
    tags: initial?.tags?.join(", ") || "",
    thumbnail: initial?.thumbnail || "",
    content: initial?.content || "",
    published: initial?.published || false,
  });
  const [codeExamples, setCodeExamples] = useState(initial?.codeExamples?.length ? initial.codeExamples : []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const pickThumbnail = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError("Photo library permission is required.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled) return;

    setUploading(true);
    setError("");
    try {
      const prepared = await prepareImageForUpload(result.assets[0], 1200);
      const { url } = await uploadThumbnail(prepared);
      set("thumbnail")(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const addCodeExample = () => setCodeExamples((current) => [...current, { title: "", language: "javascript", code: "" }]);
  const updateCodeExample = (index, key, value) =>
    setCodeExamples((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  const removeCodeExample = (index) => setCodeExamples((current) => current.filter((_, i) => i !== index));

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.category.trim()) {
      return setError("Title, description and category are required.");
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ ...form, codeExamples });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.form}>
      <Field label="Title" styles={styles}><TextInput value={form.title} onChangeText={set("title")} style={styles.input} placeholderTextColor={colors.muted} /></Field>
      <Field label="Description" styles={styles}><TextInput value={form.description} onChangeText={set("description")} style={[styles.input, styles.multiline]} multiline placeholderTextColor={colors.muted} /></Field>
      <Field label="Category" styles={styles}><TextInput value={form.category} onChangeText={set("category")} placeholder="e.g. Java, React, Node.js" style={styles.input} placeholderTextColor={colors.muted} /></Field>

      <Field label="Difficulty" styles={styles}>
        <View style={styles.pillRow}>
          {DIFFICULTIES.map((item) => (
            <TouchableOpacity key={item} style={[styles.pill, form.difficulty === item && styles.pillActive]} onPress={() => set("difficulty")(item)}>
              <Text style={[styles.pillText, form.difficulty === item && styles.pillTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Field>

      <Field label="Tags (comma-separated)" styles={styles}><TextInput value={form.tags} onChangeText={set("tags")} placeholder="loops, arrays, oop" style={styles.input} placeholderTextColor={colors.muted} /></Field>

      <Field label="Thumbnail" styles={styles}>
        <View style={styles.thumbnailRow}>
          {form.thumbnail ? (
            <Image source={{ uri: absoluteAsset(form.thumbnail) }} style={styles.thumbnailPreview} />
          ) : (
            <View style={[styles.thumbnailPreview, styles.thumbnailEmpty]}><Text style={{ color: colors.muted, fontSize: 10 }}>No image</Text></View>
          )}
          <TouchableOpacity style={styles.uploadButton} onPress={pickThumbnail} disabled={uploading}>
            {uploading ? <ActivityIndicator color={colors.accentText} size="small" /> : <Text style={styles.uploadButtonText}>{form.thumbnail ? "Replace image" : "Upload image"}</Text>}
          </TouchableOpacity>
        </View>
      </Field>

      <Field label="Content (use # / ## for headings)" styles={styles}>
        <TextInput value={form.content} onChangeText={set("content")} style={[styles.input, styles.multilineLarge]} multiline placeholderTextColor={colors.muted} placeholder={"# Introduction\nExplain the concept here..."} />
      </Field>

      <View style={styles.sectionHeader}>
        <Text style={styles.label}>Code examples</Text>
        <TouchableOpacity onPress={addCodeExample}><Text style={styles.addLink}>+ Add code example</Text></TouchableOpacity>
      </View>
      {codeExamples.map((example, index) => (
        <View key={index} style={styles.codeExampleCard}>
          <TextInput value={example.title} onChangeText={(v) => updateCodeExample(index, "title", v)} placeholder="Title (optional)" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={example.language} onChangeText={(v) => updateCodeExample(index, "language", v)} placeholder="Language (e.g. java)" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
          <TextInput value={example.code} onChangeText={(v) => updateCodeExample(index, "code", v)} placeholder="Code" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline, { fontFamily: "monospace" }]} multiline autoCapitalize="none" autoCorrect={false} />
          <TouchableOpacity onPress={() => removeCodeExample(index)}><Text style={styles.removeLink}>Remove</Text></TouchableOpacity>
        </View>
      ))}

      <View style={styles.switchRow}>
        <Text style={styles.label}>Published</Text>
        <Switch value={form.published} onValueChange={set("published")} trackColor={{ true: colors.accent }} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.submitText}>{submitLabel}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const Field = ({ label, children, styles }) => (
  <View style={{ gap: 6 }}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const getStyles = (colors) =>
  StyleSheet.create({
    form: { padding: 16, gap: 16, paddingBottom: 60 },
    label: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, padding: 12, backgroundColor: colors.surfaceSolid },
    multiline: { minHeight: 80, textAlignVertical: "top" },
    multilineLarge: { minHeight: 140, textAlignVertical: "top" },
    pillRow: { flexDirection: "row", gap: 8 },
    pill: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
    pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    pillText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    pillTextActive: { color: colors.accentText },
    thumbnailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    thumbnailPreview: { width: 64, height: 64, borderRadius: radius.md },
    thumbnailEmpty: { backgroundColor: colors.surfaceSolid, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    uploadButton: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
    uploadButtonText: { color: colors.accentText, fontWeight: "800", fontSize: 12.5 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    addLink: { color: colors.accent, fontWeight: "700", fontSize: 13 },
    removeLink: { color: colors.danger, fontWeight: "700", fontSize: 12.5, alignSelf: "flex-end" },
    codeExampleCard: { gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.surface },
    switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    error: { color: colors.danger, fontSize: 13 },
    submitButton: { backgroundColor: colors.accent, borderRadius: radius.pill, padding: 14, alignItems: "center" },
    submitText: { color: colors.accentText, fontWeight: "800" },
  });
