import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import Screen from "../components/Screen.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { sendMessage } from "../services/contact.js";
import { radius } from "../constants/theme.js";

export default function Contact() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const styles = getStyles(colors);

  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // 'sent' | error message

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      return setStatus("All fields are required.");
    }
    setSending(true);
    setStatus(null);
    try {
      const data = await sendMessage(form);
      setStatus({ type: "sent", message: data?.message || "Message sent — thanks for reaching out!" });
      setForm((current) => ({ ...current, subject: "", message: "" }));
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.title}>Get in touch</Text>
          <Text style={styles.subtitle}>Send a message directly to Vishant Kumar — it's saved and emailed straight to the inbox.</Text>

          <TextInput value={form.name} onChangeText={set("name")} placeholder="Your name" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={form.email} onChangeText={set("email")} placeholder="Your email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <TextInput value={form.subject} onChangeText={set("subject")} placeholder="Subject" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={form.message} onChangeText={set("message")} placeholder="Message" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} multiline />

          {status?.type === "sent" ? (
            <Text style={styles.success}>{status.message}</Text>
          ) : status ? (
            <Text style={styles.error}>{status.message}</Text>
          ) : null}

          <TouchableOpacity style={styles.button} onPress={submit} disabled={sending}>
            {sending ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.buttonText}>Send message</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    form: { padding: 20, gap: 12 },
    title: { color: colors.text, fontSize: 22, fontWeight: "800" },
    subtitle: { color: colors.muted, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, padding: 13, backgroundColor: colors.surfaceSolid },
    multiline: { minHeight: 120, textAlignVertical: "top" },
    success: { color: colors.success, fontSize: 13 },
    error: { color: colors.danger, fontSize: 13 },
    button: { backgroundColor: colors.accent, borderRadius: radius.pill, padding: 14, alignItems: "center", marginTop: 6 },
    buttonText: { color: colors.accentText, fontWeight: "800" },
  });
