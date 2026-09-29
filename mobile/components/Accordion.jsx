import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext.jsx";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Mirrors client/src/components/Accordion.jsx's behavior: only one item
// open at a time. items: [{ id, question, answer: string | string[] }].
// A string[] answer renders as a bullet list (used for FAQ items that are
// lists on the web, e.g. "who is this for").
export default function Accordion({ items, defaultOpenId = null }) {
  const { colors } = useAppTheme();
  const styles = getStyles(colors);
  const [openId, setOpenId] = useState(defaultOpenId);

  const toggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <View key={item.id} style={styles.item}>
            <TouchableOpacity style={styles.trigger} onPress={() => toggle(item.id)} activeOpacity={0.7}>
              <Text style={styles.question}>{item.question}</Text>
              <Ionicons name={isOpen ? "remove" : "add"} size={18} color={colors.accent} />
            </TouchableOpacity>
            {isOpen ? (
              <View style={styles.panel}>
                {Array.isArray(item.answer) ? (
                  item.answer.map((line, index) => (
                    <View key={index} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.answer}>{line}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.answer}>{item.answer}</Text>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    item: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surfaceSolid, overflow: "hidden" },
    trigger: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, gap: 10 },
    question: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 14 },
    panel: { paddingHorizontal: 14, paddingBottom: 14, gap: 6 },
    answer: { color: colors.muted, fontSize: 13, lineHeight: 20, flex: 1 },
    bulletRow: { flexDirection: "row", gap: 8 },
    bulletDot: { color: colors.accent, fontSize: 13, lineHeight: 20 },
  });
