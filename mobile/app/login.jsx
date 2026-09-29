import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Logo from "../components/Logo.jsx";
import Screen from "../components/Screen.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { radius } from "../constants/theme.js";
import { signInWithProvider } from "../services/oauth.js";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const { colors } = useAppTheme();
  const styles = getStyles(colors);
  const { oauthError } = useLocalSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState(null);
  const [error, setError] = useState("");

  // If app/_layout.jsx's OAuthCallbackListener failed to parse the OAuth
  // redirect (bad/missing token, malformed user payload, etc.), it sends the
  // user back here with the reason instead of leaving them stuck on a
  // spinner — surface it rather than hiding it.
  useEffect(() => {
    if (oauthError) setError(String(oauthError));
  }, [oauthError]);

  const submit = async () => {
    if (!email.trim() || !password) return setError("Email and password are required.");
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
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
      // the session and redirects home (or sends us back here with
      // oauthError set on failure). If the user backs out without
      // finishing, we just land back here with nothing left to do.
      await signInWithProvider(provider);
    } catch (err) {
      setError(err.message);
    } finally {
      setOauthProvider(null);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.form}>
        <View style={styles.logoWrap}><Logo size={56} /></View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to continue learning.</Text>

        <TouchableOpacity style={styles.oauthButton} onPress={() => withProvider("google")} disabled={Boolean(oauthProvider)}>
          {oauthProvider === "google" ? <ActivityIndicator color={colors.text} /> : (
            <>
              <Ionicons name="logo-google" size={18} color={colors.text} />
              <Text style={styles.oauthText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.oauthButton} onPress={() => withProvider("github")} disabled={Boolean(oauthProvider)}>
          {oauthProvider === "github" ? <ActivityIndicator color={colors.text} /> : (
            <>
              <Ionicons name="logo-github" size={18} color={colors.text} />
              <Text style={styles.oauthText}>Continue with GitHub</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.buttonText}>Log in</Text>}
        </TouchableOpacity>

        <Link href="/signup" style={styles.link}>
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </Link>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    form: { flex: 1, padding: 24, justifyContent: "center", gap: 12 },
    logoWrap: { alignItems: "center", marginBottom: 8 },
    title: { color: colors.text, fontSize: 26, fontWeight: "800", textAlign: "center" },
    subtitle: { color: colors.muted, marginBottom: 8, textAlign: "center" },
    oauthButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, padding: 13, backgroundColor: colors.surfaceSolid },
    oauthText: { color: colors.text, fontWeight: "700", fontSize: 14 },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.muted, fontSize: 12 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, padding: 14, backgroundColor: colors.surfaceSolid },
    error: { color: colors.danger, fontSize: 13 },
    button: { backgroundColor: colors.accent, borderRadius: radius.pill, padding: 14, alignItems: "center", marginTop: 8 },
    buttonText: { color: colors.accentText, fontWeight: "800" },
    link: { alignSelf: "center", marginTop: 14 },
    linkText: { color: colors.accent, fontSize: 13 },
  });
