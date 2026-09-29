import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";

// Purely presentational. If Expo Router's own linking system happens to
// match buildwithvishant://auth/callback to this route and navigate here,
// this just shows a brief "finishing sign-in" state. It intentionally does
// NOT read the URL, parse the fragment, or call applySession itself — that
// is handled once, exclusively, by the persistent root-level listener in
// app/_layout.jsx (see the comment there for why). A second Linking
// listener in this screen would just be a second, slower, less reliable
// copy of the same logic — a duplicate auth handler, not a fallback.
export default function AuthCallback() {
  const { colors } = useAppTheme();
  const styles = getStyles(colors);

  return (
    <Screen>
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.text}>Finishing sign-in…</Text>
      </View>
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
    text: { color: colors.muted, fontSize: 14 },
  });
