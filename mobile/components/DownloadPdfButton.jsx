import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Sharing from "expo-sharing";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { downloadNotePdf } from "../services/notes.js";
import { radius } from "../constants/theme.js";

// Mirrors web's DownloadPdfButton.jsx exactly: local auth state only decides
// whether to show the login prompt immediately; the backend is still the
// final authority (a 401 is treated as "not logged in" either way). Where
// web hands the browser a Blob URL to download, mobile has no download
// tray — downloadNotePdf() writes the PDF to a local file instead, and this
// opens the OS share/save sheet for it via expo-sharing, which is the
// closest mobile equivalent of "save this file somewhere".
export default function DownloadPdfButton({ slug }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { colors } = useAppTheme();
  const styles = getStyles(colors);

  const [state, setState] = useState("idle"); // idle | loading | error
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);

  const handlePress = async () => {
    if (state === "loading") return; // prevent duplicate taps

    if (!isAuthenticated) {
      setShowLogin(true);
      setError("");
      return;
    }

    setState("loading");
    setError("");
    setShowLogin(false);

    try {
      const { uri, filename } = await downloadNotePdf(slug);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: filename, UTI: "com.adobe.pdf" });
      }
      setState("idle");
    } catch (err) {
      if (err.code === "UNAUTHENTICATED") {
        setShowLogin(true);
        setState("idle");
        return;
      }
      setError(err.message || "Could not generate the PDF. Please try again.");
      setState("error");
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.button} onPress={handlePress} disabled={state === "loading"}>
        {state === "loading" ? (
          <ActivityIndicator size="small" color={colors.accentText} />
        ) : (
          <Ionicons name="download-outline" size={16} color={colors.accentText} />
        )}
        <Text style={styles.buttonText}>{state === "loading" ? "Preparing PDF…" : "Download PDF"}</Text>
      </TouchableOpacity>

      {showLogin && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Login to download notes as PDF.</Text>
          <TouchableOpacity style={styles.noticeButton} onPress={() => router.push("/login")}>
            <Text style={styles.noticeButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === "error" && error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    wrap: { gap: 8, marginTop: 4 },
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: radius.pill,
      paddingVertical: 11,
      paddingHorizontal: 18,
      alignSelf: "flex-start",
    },
    buttonText: { color: colors.accentText, fontWeight: "800", fontSize: 13 },
    notice: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    noticeText: { color: colors.muted, fontSize: 13 },
    noticeButton: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14 },
    noticeButtonText: { color: colors.text, fontWeight: "700", fontSize: 12 },
    error: { color: colors.danger, fontSize: 13 },
  });
