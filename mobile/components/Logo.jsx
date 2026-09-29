import { Image, StyleSheet, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext.jsx";

// The mark's line-art is white/teal, so it needs a dark backing in both
// app themes to stay legible — the same reason the website's own asset
// ships with a charcoal background baked in. `chip` keeps that contrast
// consistent instead of ever placing the raw mark on a light background.
export default function Logo({ size = 36, variant = "mark" }) {
  const { colors } = useAppTheme();
  const source =
    variant === "splash"
      ? require("../assets/logo-splash.png")
      : require("../assets/logo-mark.png");

  if (variant === "splash") {
    return <Image source={source} style={{ width: size, height: size, borderRadius: size * 0.22 }} resizeMode="contain" />;
  }

  return (
    <View style={[styles.chip, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandChip }]}>
      <Image source={source} style={{ width: size * 0.72, height: size * 0.72 }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
