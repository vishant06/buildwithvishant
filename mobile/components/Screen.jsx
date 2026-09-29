import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext.jsx";

export default function Screen({ children, style }) {
  const { colors } = useAppTheme();
  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }, style]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
