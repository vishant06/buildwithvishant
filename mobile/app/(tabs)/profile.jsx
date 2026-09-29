import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
<<<<<<< HEAD
import { useState } from "react";
=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Screen from "../../components/Screen.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import { absoluteAsset } from "../../services/api.js";
import { radius } from "../../constants/theme.js";

const LINKS = [
  { label: "Projects", icon: "briefcase-outline", href: "/projects" },
  { label: "Contact", icon: "mail-outline", href: "/contact" },
  { label: "Settings", icon: "settings-outline", href: "/settings" },
];

export default function Profile() {
  const router = useRouter();
  const { colors } = useAppTheme();
<<<<<<< HEAD
  const { user, isAuthenticated, isAdmin, logout, resendVerification } = useAuth();
  const styles = getStyles(colors);
  const [sending, setSending] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState("");

  const sendVerification = async () => {
    setSending(true);
    setVerifyStatus("");
    try {
      const data = await resendVerification();
      setVerifyStatus(data.message || "Verification email sent.");
    } catch (err) {
      setVerifyStatus(err.message);
    } finally {
      setSending(false);
    }
  };
=======
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const styles = getStyles(colors);
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764

  if (!isAuthenticated) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.title}>You're not logged in</Text>
          <Text style={styles.muted}>Log in to see your profile and saved progress.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/login")}>
            <Text style={styles.buttonText}>Log in</Text>
          </TouchableOpacity>

          <View style={{ height: 24 }} />
          {LINKS.map((item) => (
            <TouchableOpacity key={item.label} style={styles.linkRow} onPress={() => router.push(item.href)}>
              <Ionicons name={item.icon} size={18} color={colors.text} />
              <Text style={styles.linkLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarWrap}>
          {user.avatar?.url ? (
            <Image source={{ uri: absoluteAsset(user.avatar.url) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{user.name?.[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.muted}>@{user.username}</Text>
        </View>

        <View style={styles.infoCard}>
          <Row label="Email" value={user.email} colors={colors} />
          <Row label="Role" value={user.role} colors={colors} />
          <Row label="Email verified" value={user.isEmailVerified ? "Yes" : "No"} colors={colors} />
        </View>

<<<<<<< HEAD
        {!user.isEmailVerified && (
          <View style={styles.verifyCard}>
            <Text style={styles.verifyText}>Verify your email address to keep your account secure.</Text>
            <TouchableOpacity style={styles.verifyButton} onPress={sendVerification} disabled={sending}>
              <Text style={styles.verifyButtonText}>{sending ? "Sending…" : "Resend verification email"}</Text>
            </TouchableOpacity>
            {verifyStatus ? <Text style={styles.muted}>{verifyStatus}</Text> : null}
          </View>
        )}

=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
        <View style={styles.linksCard}>
          {LINKS.map((item) => (
            <TouchableOpacity key={item.label} style={styles.linkRow} onPress={() => router.push(item.href)}>
              <Ionicons name={item.icon} size={18} color={colors.text} />
              <Text style={styles.linkLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {isAdmin && (
          <TouchableOpacity style={styles.adminButton} onPress={() => router.push("/admin")}>
            <Ionicons name="shield-checkmark" size={18} color={colors.accentText} />
            <Text style={styles.adminButtonText}>Open Admin Dashboard</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const Row = ({ label, value, colors }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
    <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
    <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{value}</Text>
  </View>
);

const getStyles = (colors) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
    content: { padding: 20, gap: 18 },
    title: { color: colors.text, fontSize: 18, fontWeight: "800" },
    muted: { color: colors.muted, fontSize: 13 },
    button: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
    buttonText: { color: colors.accentText, fontWeight: "800" },
    avatarWrap: { alignItems: "center", gap: 4 },
    avatar: { width: 84, height: 84, borderRadius: 42 },
    avatarFallback: { backgroundColor: colors.surfaceSolid, alignItems: "center", justifyContent: "center" },
    avatarFallbackText: { color: colors.accent, fontSize: 30, fontWeight: "800" },
    name: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 8 },
    infoCard: { backgroundColor: colors.surfaceSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
<<<<<<< HEAD
    verifyCard: { backgroundColor: colors.surfaceSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
    verifyText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    verifyButton: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 11, alignItems: "center" },
    verifyButtonText: { color: colors.accentText, fontWeight: "800", fontSize: 13 },
=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
    linksCard: { backgroundColor: colors.surfaceSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    linkLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
    adminButton: { flexDirection: "row", gap: 8, backgroundColor: colors.accent, borderRadius: radius.pill, padding: 14, alignItems: "center", justifyContent: "center" },
    adminButtonText: { color: colors.accentText, fontWeight: "800" },
    logoutButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.pill, padding: 14, alignItems: "center" },
    logoutText: { color: colors.danger, fontWeight: "800" },
  });
