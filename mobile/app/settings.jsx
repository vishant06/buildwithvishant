import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Screen from "../components/Screen.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { radius } from "../constants/theme.js";

const MODES = [
  { id: "light", label: "Light", icon: "sunny" },
  { id: "dark", label: "Dark", icon: "moon" },
  { id: "system", label: "System", icon: "phone-portrait" },
];

export default function Settings() {
  const { mode, setMode, colors } = useAppTheme();
  const { user, logout } = useAuth();
  const styles = getStyles(colors);

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          {MODES.map((item) => {
            const active = mode === item.id;
            return (
              <TouchableOpacity key={item.id} style={styles.row} onPress={() => setMode(item.id)}>
                <View style={styles.rowLeft}>
                  <Ionicons name={item.icon} size={18} color={active ? colors.accent : colors.muted} />
                  <Text style={[styles.rowLabel, active && { color: colors.accent, fontWeight: "800" }]}>{item.label}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {user && (
          <>
            <Text style={styles.sectionLabel}>Account</Text>
            <View style={styles.card}>
              <View style={styles.row}><Text style={styles.rowLabel}>Email</Text><Text style={styles.rowValue}>{user.email}</Text></View>
              <View style={styles.row}><Text style={styles.rowLabel}>Username</Text><Text style={styles.rowValue}>@{user.username}</Text></View>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    content: { padding: 20, gap: 20 },
    sectionLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", marginBottom: -8 },
    card: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: "hidden" },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
    rowValue: { color: colors.muted, fontSize: 13 },
    logoutButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.pill, padding: 14, alignItems: "center" },
    logoutText: { color: colors.danger, fontWeight: "800" },
  });
