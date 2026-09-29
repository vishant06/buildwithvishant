import { Image, StyleSheet, Text, View } from "react-native";
import { absoluteAsset } from "../services/api.js";
import { useAppTheme } from "../context/ThemeContext.jsx";
import CodeBlock from "./CodeBlock.jsx";

const headingSize = { 1: 24, 2: 20, 3: 17, 4: 15 };

export default function NoteBlocks({ blocks }) {
  const { colors } = useAppTheme();
  const styles = getStyles(colors);

  return (
    <View style={{ gap: 4 }}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <Text key={index} style={[styles.heading, { fontSize: headingSize[block.level] || 18 }]}>
                {block.content}
              </Text>
            );
          case "text":
            return <Text key={index} style={styles.text}>{block.content}</Text>;
          case "code":
            return <CodeBlock key={index} language={block.language} content={block.content} />;
          case "output":
            return (
              <View key={index} style={styles.outputBox}>
                <Text style={styles.outputText}>{block.content}</Text>
              </View>
            );
          case "callout":
            return (
              <View key={index} style={[styles.callout, styles[`callout_${block.calloutType}`]]}>
                <Text style={styles.text}>{block.content}</Text>
              </View>
            );
          case "bulletList":
            return (
              <View key={index} style={{ gap: 4 }}>
                {block.items.map((item, i) => (
                  <Text key={i} style={styles.text}>{"\u2022  "}{item}</Text>
                ))}
              </View>
            );
          case "numberedList":
            return (
              <View key={index} style={{ gap: 4 }}>
                {block.items.map((item, i) => (
                  <Text key={i} style={styles.text}>{i + 1}. {item}</Text>
                ))}
              </View>
            );
          case "image":
            return (
              <View key={index} style={{ gap: 6 }}>
                <Image source={{ uri: absoluteAsset(block.url) }} style={styles.image} resizeMode="cover" />
                {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}
              </View>
            );
          case "table":
            return (
              <View key={index} style={styles.table}>
                {block.headers?.length > 0 && (
                  <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    {block.headers.map((header, i) => (
                      <Text key={i} style={[styles.tableCell, styles.tableHeaderCell]}>{header}</Text>
                    ))}
                  </View>
                )}
                {block.rows?.map((row, i) => (
                  <View key={i} style={styles.tableRow}>
                    {row.cells.map((cell, j) => (
                      <Text key={j} style={styles.tableCell}>{cell}</Text>
                    ))}
                  </View>
                ))}
              </View>
            );
          case "divider":
            return <View key={index} style={styles.divider} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    heading: { color: colors.text, fontWeight: "800", marginTop: 10, marginBottom: 4 },
    text: { color: colors.text, fontSize: 15, lineHeight: 23 },
    outputBox: { backgroundColor: colors.mode === "light" ? "#0f172a" : "#050913", borderRadius: 8, padding: 12, marginVertical: 4 },
    outputText: { color: "#86efac", fontFamily: "monospace", fontSize: 12.5 },
    callout: { borderLeftWidth: 3, borderRadius: 8, padding: 12, marginVertical: 4 },
    callout_note: { backgroundColor: "rgba(56,189,248,0.08)", borderLeftColor: colors.accent },
    callout_important: { backgroundColor: "rgba(248,113,113,0.08)", borderLeftColor: colors.danger },
    callout_tip: { backgroundColor: "rgba(74,222,128,0.08)", borderLeftColor: colors.success },
    callout_warning: { backgroundColor: "rgba(251,191,36,0.08)", borderLeftColor: colors.warning },
    image: { width: "100%", height: 200, borderRadius: 10, backgroundColor: colors.bgSoft },
    caption: { color: colors.muted, fontSize: 12, textAlign: "center" },
    table: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden", marginVertical: 4 },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
    tableHeaderRow: { backgroundColor: colors.surfaceSolid },
    tableCell: { flex: 1, padding: 8, fontSize: 12.5, color: colors.text },
    tableHeaderCell: { fontWeight: "800", color: colors.accent },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  });
