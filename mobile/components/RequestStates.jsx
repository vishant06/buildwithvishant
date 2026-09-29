import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { radius } from "../constants/theme.js";

export function LoadingState({ label = "Loading..." }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={[styles.muted, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title = "Nothing here yet", hint }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.muted, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorState({ message = "Something went wrong while connecting to the server.", onRetry }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>Unable to load this content.</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={onRetry}>
          <Text style={[styles.buttonText, { color: colors.accentText }]}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  muted: { fontSize: 13, textAlign: "center" },
  button: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill },
  buttonText: { fontWeight: "800" },
});
