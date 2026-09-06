import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { EmptyState } from "../../components/RequestStates.jsx";
import Screen from "../../components/Screen.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { radius } from "../../constants/theme.js";
import * as playgroundApi from "../../services/playground.js";

// Pulled directly from the website's Playground (client/src/pages/Playground.jsx)
// — this is the real, complete list the backend/execution service supports,
// not a guess. "web" is the combined HTML/CSS/JS mode, rendered locally
// (matches the website: no backend call for that mode, just a live preview).
const LANGUAGES = [
  { id: "web", label: "HTML / CSS / JS" },
  { id: "javascript", label: "JavaScript", demo: 'console.log("Hello from JavaScript!");' },
  { id: "typescript", label: "TypeScript", demo: 'const greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("BuildWithVishant"));' },
  { id: "python", label: "Python", demo: 'print("Hello from Python!")' },
  { id: "java", label: "Java", demo: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java!");\n  }\n}' },
  { id: "c", label: "C", demo: '#include <stdio.h>\n\nint main(void) {\n  printf("Hello from C!\\n");\n  return 0;\n}' },
  { id: "cpp", label: "C++", demo: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello from C++!" << endl;\n  return 0;\n}' },
  { id: "csharp", label: "C#", demo: 'using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello from C#!");\n  }\n}' },
  { id: "go", label: "Go", demo: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello from Go!")\n}' },
  { id: "rust", label: "Rust", demo: 'fn main() {\n  println!("Hello from Rust!");\n}' },
  { id: "ruby", label: "Ruby", demo: 'puts "Hello from Ruby!"' },
  { id: "php", label: "PHP", demo: '<?php\necho "Hello from PHP!\\n";' },
  { id: "kotlin", label: "Kotlin", demo: 'fun main() {\n  println("Hello from Kotlin!")\n}' },
  { id: "swift", label: "Swift", demo: 'print("Hello from Swift!")' },
  { id: "dart", label: "Dart", demo: 'void main() {\n  print("Hello from Dart!");\n}' },
  { id: "r", label: "R", demo: 'cat("Hello from R!\\n")' },
  { id: "scala", label: "Scala", demo: 'object Main extends App {\n  println("Hello from Scala!")\n}' },
  { id: "shell", label: "Bash / Shell", demo: 'echo "Hello from Shell!"' },
  { id: "sql", label: "SQL", demo: "SELECT 'Hello from SQL!' AS greeting;" },
  { id: "lua", label: "Lua", demo: 'print("Hello from Lua!")' },
  { id: "perl", label: "Perl", demo: 'print "Hello from Perl!\\n";' },
  { id: "haskell", label: "Haskell", demo: 'main = putStrLn "Hello from Haskell!"' },
];

const DEFAULT_WEB = {
  html: "<h1>Hello, BuildWithVishant!</h1>\n<p>Edit the HTML, CSS and JS tabs above.</p>",
  css: "body {\n  font-family: sans-serif;\n  padding: 20px;\n  color: #0f172a;\n}",
  javascript: "console.log('Hello from the browser runtime!');",
};

const buildWebDocument = ({ html, css, javascript }) =>
  `<!doctype html><html><head><style>\n${css}\n</style></head><body>\n${html}\n<script>\n${javascript}\n</script></body></html>`;

export default function Playground() {
  const { colors } = useAppTheme();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const styles = getStyles(colors);

  const [languageId, setLanguageId] = useState("web");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [code, setCode] = useState(LANGUAGES[1].demo);
  const [webCode, setWebCode] = useState(DEFAULT_WEB);
  const [webFile, setWebFile] = useState("html");
  const [webPreviewKey, setWebPreviewKey] = useState(0);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState([]);
  const [running, setRunning] = useState(false);
  const [fitToScreen, setFitToScreen] = useState(false);

  const [projectId, setProjectId] = useState(null);
  const [title, setTitle] = useState("Untitled project");
  const [saving, setSaving] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const language = LANGUAGES.find((item) => item.id === languageId);
  const isWeb = languageId === "web";

  const selectLanguage = (id) => {
    setLanguageId(id);
    if (id !== "web") setCode(LANGUAGES.find((item) => item.id === id)?.demo || "");
    setOutput([]);
    setPickerOpen(false);
  };

  const run = async () => {
    if (isWeb) {
      setWebPreviewKey((key) => key + 1); // forces the WebView to reload with the latest html/css/js
      return;
    }
    setRunning(true);
    setOutput([{ type: "info", text: "Running..." }]);
    try {
      const result = await playgroundApi.execute({ language: languageId, code, stdin });
      const lines = [result.stdout, result.compileOutput, result.stderr, result.message].filter(Boolean);
      setOutput(
        lines.length
          ? lines.map((text) => ({ type: result.success ? "success" : "error", text }))
          : [{ type: result.success ? "success" : "error", text: result.success ? "Execution completed with no output." : (result.status || "Execution error") }]
      );
    } catch (error) {
      setOutput([{ type: "error", text: error.message }]);
    } finally {
      setRunning(false);
    }
  };

  const clear = () => {
    if (isWeb) setWebCode(DEFAULT_WEB);
    else setCode("");
    setOutput([]);
  };

  const copy = () => Clipboard.setStringAsync(isWeb ? webCode[webFile] : code);

  const newProject = () => {
    setProjectId(null);
    setTitle("Untitled project");
    setLanguageId("web");
    setWebCode(DEFAULT_WEB);
    setCode(LANGUAGES[1].demo);
    setOutput([]);
  };

  const buildPayload = () => ({
    title: title.trim() || "Untitled project",
    language: languageId,
    code: isWeb ? "" : code,
    html: isWeb ? webCode.html : "",
    css: isWeb ? webCode.css : "",
    javascript: isWeb ? webCode.javascript : "",
  });

  const save = async () => {
    if (!isAuthenticated) {
      return Alert.alert("Log in required", "Log in to save Playground projects.", [
        { text: "Cancel", style: "cancel" },
        { text: "Log in", onPress: () => router.push("/login") },
      ]);
    }
    setSaving(true);
    try {
      if (projectId) {
        await playgroundApi.updateProject(projectId, buildPayload());
      } else {
        const created = await playgroundApi.saveProject(buildPayload());
        setProjectId(created._id);
      }
      Alert.alert("Saved", "Your project has been saved.");
    } catch (error) {
      Alert.alert("Couldn't save project", error.message);
    } finally {
      setSaving(false);
    }
  };

  const openProjects = async () => {
    setProjectsOpen(true);
    setProjectsLoading(true);
    try {
      setProjects(await playgroundApi.myProjects());
    } catch (_error) {
      // Modal shows an empty state either way; low-stakes to retry manually.
    } finally {
      setProjectsLoading(false);
    }
  };

  const openProject = (project) => {
    setProjectId(project._id);
    setTitle(project.title);
    setLanguageId(project.language || "web");
    if (project.language === "web" || !project.language) {
      setWebCode({ html: project.html || "", css: project.css || "", javascript: project.javascript || "" });
    } else {
      setCode(project.code || "");
    }
    setOutput([]);
    setProjectsOpen(false);
  };

  const deleteProject = (project) => {
    Alert.alert("Delete project", `Delete "${project.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await playgroundApi.deleteProject(project._id);
            setProjects((current) => current.filter((item) => item._id !== project._id));
            if (projectId === project._id) newProject();
          } catch (error) {
            Alert.alert("Couldn't delete project", error.message);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.languageButton} onPress={() => setPickerOpen(true)}>
          <Text style={styles.languageButtonText}>{language?.label}</Text>
        </TouchableOpacity>
        <View style={styles.toolbarActions}>
          {!fitToScreen && (
            <>
              <TouchableOpacity style={styles.iconButton} onPress={copy}><Text style={styles.iconButtonText}>Copy</Text></TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={clear}><Text style={styles.iconButtonText}>Clear</Text></TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={openProjects}><Ionicons name="folder-open-outline" size={16} color={colors.text} /></TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="bookmark-outline" size={16} color={colors.text} />}
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={[styles.fitButton, fitToScreen && styles.fitButtonActive]}
            onPress={() => setFitToScreen((value) => !value)}
          >
            <Ionicons name={fitToScreen ? "contract-outline" : "expand-outline"} size={15} color={fitToScreen ? colors.accentText : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.runButton} onPress={run} disabled={running}>
            {running ? <ActivityIndicator color={colors.accentText} size="small" /> : <Text style={styles.runButtonText}>Run</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {!fitToScreen && (
        <TextInput value={title} onChangeText={setTitle} placeholder="Project title" placeholderTextColor={colors.muted} style={styles.titleInput} />
      )}

      {isWeb ? (
        <>
          <View style={styles.webTabs}>
            {["html", "css", "javascript"].map((file) => (
              <TouchableOpacity key={file} style={[styles.webTab, webFile === file && styles.webTabActive]} onPress={() => setWebFile(file)}>
                <Text style={[styles.webTabText, webFile === file && styles.webTabTextActive]}>{file.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={styles.editorWrap} contentContainerStyle={{ flexGrow: 1 }}>
            <TextInput
              value={webCode[webFile]}
              onChangeText={(value) => setWebCode((current) => ({ ...current, [webFile]: value }))}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.editor}
              placeholderTextColor={colors.muted}
            />
          </ScrollView>
          {!fitToScreen && (
            <View style={styles.webPreviewWrap}>
              <Text style={styles.consoleLabel}>Preview</Text>
              <WebView key={webPreviewKey} originWhitelist={["*"]} source={{ html: buildWebDocument(webCode) }} style={styles.webPreview} />
            </View>
          )}
        </>
      ) : (
        <>
          <ScrollView style={styles.editorWrap} contentContainerStyle={{ flexGrow: 1 }}>
            <TextInput
              value={code}
              onChangeText={setCode}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.editor}
              placeholder="Write your code here..."
              placeholderTextColor={colors.muted}
            />
          </ScrollView>
          {!fitToScreen && (
            <>
              <TextInput
                value={stdin}
                onChangeText={setStdin}
                placeholder="Optional standard input..."
                placeholderTextColor={colors.muted}
                style={styles.stdin}
              />
              <View style={styles.consolePanel}>
                <Text style={styles.consoleLabel}>Console</Text>
                <ScrollView style={{ maxHeight: 140 }}>
                  {output.map((line, index) => (
                    <Text key={index} style={[styles.consoleLine, styles[`console_${line.type}`]]}>{line.text}</Text>
                  ))}
                </ScrollView>
              </View>
            </>
          )}
        </>
      )}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <ScrollView style={styles.modalCard}>
            {LANGUAGES.map((item) => (
              <TouchableOpacity key={item.id} style={styles.modalRow} onPress={() => selectLanguage(item.id)}>
                <Text style={styles.modalRowText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </Modal>

      <Modal visible={projectsOpen} animationType="slide" onRequestClose={() => setProjectsOpen(false)}>
        <Screen>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>My Projects</Text>
            <TouchableOpacity onPress={() => setProjectsOpen(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.newProjectButton} onPress={() => { newProject(); setProjectsOpen(false); }}>
            <Ionicons name="add" size={16} color={colors.accentText} />
            <Text style={styles.newProjectButtonText}>New project</Text>
          </TouchableOpacity>
          {projectsLoading ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.accent} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {projects.length ? projects.map((project) => (
                <View key={project._id} style={styles.projectRow}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openProject(project)}>
                    <Text style={styles.projectTitle}>{project.title}</Text>
                    <Text style={styles.projectMeta}>{LANGUAGES.find((l) => l.id === project.language)?.label || project.language}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteProject(project)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              )) : <EmptyState title="No saved projects yet" hint="Write some code and tap the save icon." />}
            </ScrollView>
          )}
        </Screen>
      </Modal>
    </Screen>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
    languageButton: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
    languageButtonText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    toolbarActions: { flexDirection: "row", gap: 6, alignItems: "center" },
    iconButton: { paddingHorizontal: 8, paddingVertical: 8 },
    iconButtonText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
    fitButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    fitButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    runButton: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 8, minWidth: 60, alignItems: "center" },
    runButtonText: { color: colors.accentText, fontWeight: "800" },
    titleInput: { marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, color: colors.text, backgroundColor: colors.surfaceSolid, fontSize: 13 },
    webTabs: { flexDirection: "row", gap: 6, marginHorizontal: 12, marginBottom: 6 },
    webTab: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    webTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    webTabText: { color: colors.muted, fontSize: 11.5, fontWeight: "800" },
    webTabTextActive: { color: colors.accentText },
    editorWrap: { flex: 1, marginHorizontal: 12, backgroundColor: colors.mode === "light" ? "#0f172a" : "#0b1220", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
    editor: { flex: 1, color: "#e2e8f0", fontFamily: "monospace", fontSize: 13, padding: 14, textAlignVertical: "top" },
    stdin: { margin: 12, marginTop: 8, backgroundColor: colors.mode === "light" ? "#0f172a" : "#0b1220", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: "#e2e8f0", padding: 12, fontFamily: "monospace", fontSize: 12.5 },
    consolePanel: { margin: 12, marginTop: 0, backgroundColor: colors.mode === "light" ? "#0f172a" : "#050913", borderRadius: radius.md, padding: 12, minHeight: 60 },
    consoleLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 6, marginLeft: 12 },
    consoleLine: { fontFamily: "monospace", fontSize: 12.5, marginBottom: 2 },
    console_info: { color: colors.muted },
    console_success: { color: colors.success },
    console_error: { color: colors.danger },
    webPreviewWrap: { height: 200, marginTop: 8 },
    webPreview: { flex: 1, marginHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 30 },
    modalCard: { backgroundColor: colors.surfaceSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, maxHeight: "70%" },
    modalRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalRowText: { color: colors.text, fontWeight: "600" },
    historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    historyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    newProjectButton: { flexDirection: "row", gap: 6, alignSelf: "flex-start", margin: 16, marginBottom: 0, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center" },
    newProjectButtonText: { color: colors.accentText, fontWeight: "800", fontSize: 13 },
    projectRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 8 },
    projectTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
    projectMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  });
