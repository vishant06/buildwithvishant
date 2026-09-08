import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Screen from "../components/Screen.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { radius } from "../constants/theme.js";
import { signInWithProvider } from "../services/oauth.js";
import { prepareImageForUpload } from "../utils/image.js";

export default function Signup() {
  const router = useRouter();
  const { signup } = useAuth();
  const { colors } = useAppTheme();
  const styles = getStyles(colors);

  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirmPassword: "" });
  const [avatar, setAvatar] = useState(null);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState(null);
  const [error, setError] = useState("");

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError("Photo library permission is required to pick a profile photo.");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], // ImagePicker.MediaTypeOptions is deprecated — plain string array is the current API
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;

    setError("");
    setAvatarProcessing(true);
    try {
      // Resize/compress before upload — a raw phone photo can exceed the
      // backend's 2MB avatar limit even at reduced JPEG quality, which
      // otherwise surfaces as a confusing failed-upload with no clear cause.
      setAvatar(await prepareImageForUpload(result.assets[0], 640));
    } catch (_err) {
      setError("Couldn't process that image. Please try a different photo.");
    } finally {
      setAvatarProcessing(false);
    }
  };

  const submit = async () => {
    const { name, username, email, password, confirmPassword } = form;
    if (!name.trim() || !username.trim() || !email.trim() || !password) return setError("All fields are required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!avatar) return setError("A profile photo is required.");

    setLoading(true);
    setError("");
    try {
      await signup({ name, username, email, password, avatar });
      router.replace("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const withProvider = async (provider) => {
    setOauthProvider(provider);
    setError("");
    try {
      // Opens the OAuth browser flow. The redirect is caught by the
      // persistent root-level listener in app/_layout.jsx, which applies
      // the session and redirects home (or sends the user to /login with
      // oauthError set on failure).
      await signInWithProvider(provider);
    } catch (err) {
      setError(err.message);
    } finally {
      setOauthProvider(null);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join BuildWithVishant to save progress and use the AI assistant.</Text>

          <TouchableOpacity style={styles.oauthButton} onPress={() => withProvider("google")} disabled={Boolean(oauthProvider)}>
            {oauthProvider === "google" ? <ActivityIndicator color={colors.text} /> : (
              <><Ionicons name="logo-google" size={18} color={colors.text} /><Text style={styles.oauthText}>Continue with Google</Text></>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.oauthButton} onPress={() => withProvider("github")} disabled={Boolean(oauthProvider)}>
            {oauthProvider === "github" ? <ActivityIndicator color={colors.text} /> : (
              <><Ionicons name="logo-github" size={18} color={colors.text} /><Text style={styles.oauthText}>Continue with GitHub</Text></>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar} disabled={avatarProcessing}>
            {avatarProcessing ? <ActivityIndicator color={colors.accent} /> : avatar ? (
              <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarPlaceholder}>Add profile photo</Text>
            )}
          </TouchableOpacity>

          <TextInput value={form.name} onChangeText={set("name")} placeholder="Full name" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={form.username} onChangeText={set("username")} placeholder="Username" placeholderTextColor={colors.muted} autoCapitalize="none" style={styles.input} />
          <TextInput value={form.email} onChangeText={set("email")} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <TextInput value={form.password} onChangeText={set("password")} placeholder="Password (min 8 characters)" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
          <TextInput value={form.confirmPassword} onChangeText={set("confirmPassword")} placeholder="Confirm password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.buttonText}>Create account</Text>}
          </TouchableOpacity>

          <Link href="/login" style={styles.link}>
            <Text style={styles.linkText}>Already have an account? Log in</Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    form: { padding: 24, gap: 12 },
    title: { color: colors.text, fontSize: 26, fontWeight: "800" },
    subtitle: { color: colors.muted, marginBottom: 8 },
    oauthButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, padding: 13, backgroundColor: colors.surfaceSolid },
    oauthText: { color: colors.text, fontWeight: "700", fontSize: 14 },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.muted, fontSize: 12 },
    avatarPicker: { alignSelf: "center", width: 88, height: 88, borderRadius: 44, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSolid, alignItems: "center", justifyContent: "center", marginBottom: 8, overflow: "hidden" },
    avatarImage: { width: "100%", height: "100%" },
    avatarPlaceholder: { color: colors.muted, fontSize: 11, textAlign: "center", paddingHorizontal: 8 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, padding: 14, backgroundColor: colors.surfaceSolid },
    error: { color: colors.danger, fontSize: 13 },
    button: { backgroundColor: colors.accent, borderRadius: radius.pill, padding: 14, alignItems: "center", marginTop: 8 },
    buttonText: { color: colors.accentText, fontWeight: "800" },
    link: { alignSelf: "center", marginTop: 14 },
    linkText: { color: colors.accent, fontSize: 13 },
  });
