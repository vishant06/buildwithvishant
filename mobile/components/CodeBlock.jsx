import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { radius } from "../constants/theme.js";
import { tokenizeLine } from "../utils/highlight.js";

export default function CodeBlock({ language = "text", content = "" }) {
  const { colors } = useAppTheme();
  const [copied, setCopied] = useState(false);
  const lines = content.replace(/\n$/, "").split("\n");

  const TOKEN_COLORS = {
    keyword: "#c084fc",
    string: colors.mode === "light" ? "#15803d" : "#86efac",
    number: colors.mode === "light" ? "#b45309" : "#fbbf24",
    comment: colors.muted,
    plain: colors.text,
  };

  const copy = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
  };

  const codeBg = colors.mode === "light" ? "#0f172a" : "#0b1220";
  const codeHeaderBg = colors.mode === "light" ? "#1e293b" : "#111a2d";

  return (
    <View style={[styles.wrapper, { backgroundColor: codeBg, borderColor: colors.border }]}>
      <View style={[styles.header, { backgroundColor: codeHeaderBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.language, { color: "#94a3b8" }]}>{language}</Text>
        <TouchableOpacity style={styles.copyButton} onPress={copy} hitSlop={8}>
          <Text style={[styles.copyText, { color: colors.accent }]}>{copied ? "Copied" : "Copy"}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.body}>
          {lines.map((line, i) => (
            <View key={i} style={styles.line}>
              <Text style={styles.lineNumber}>{i + 1}</Text>
              <Text style={styles.code} numberOfLines={1}>
                {tokenizeLine(line).map((token, j) => (
                  <Text key={j} style={{ color: TOKEN_COLORS[token.type] }}>
                    {token.text}
                  </Text>
                ))}
                {line === "" ? " " : null}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: radius.md, overflow: "hidden", borderWidth: 1, marginVertical: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  language: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  copyButton: { paddingHorizontal: 8, paddingVertical: 4 },
  copyText: { fontSize: 12, fontWeight: "700" },
  scroll: { maxHeight: 420 },
  body: { paddingVertical: 10 },
  line: { flexDirection: "row", paddingHorizontal: 12 },
  lineNumber: { width: 26, color: "#475569", fontFamily: "monospace", fontSize: 12.5, marginRight: 10, textAlign: "right" },
  code: { fontFamily: "monospace", fontSize: 12.5, lineHeight: 19 },
});
