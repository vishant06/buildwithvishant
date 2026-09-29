import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import CodeBlock from "../../components/CodeBlock.jsx";
import { EmptyState } from "../../components/RequestStates.jsx";
import Screen from "../../components/Screen.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import * as aiApi from "../../services/ai.js";
import { radius } from "../../constants/theme.js";
import { splitIntoSegments } from "../../utils/markdown.js";

const now = () => new Date().toISOString();
const welcome = { role: "assistant", content: "Hi — I'm your developer learning assistant. Ask me anything about code, notes, or concepts.", time: now(), isWelcome: true };

export default function AiChat() {
  const { colors } = useAppTheme();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const styles = getStyles(colors);

  const [messages, setMessages] = useState([welcome]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedChats, setSavedChats] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const listRef = useRef(null);

  // Fullscreen here means: hide the tab bar and header for a more
  // immersive, distraction-free chat — the mobile equivalent of the
  // website's fullscreen chat mode (there's no browser chrome to hide).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !fullscreen,
      tabBarStyle: fullscreen ? { display: "none" } : undefined,
    });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [fullscreen, navigation]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const loadHistory = async () => {
    if (!isAuthenticated) return;
    setHistoryLoading(true);
    try {
      setSavedChats(await aiApi.listConversations());
    } catch (_error) {
      // Leave whatever list is already on screen; the modal itself has no error state, this is low-stakes.
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    loadHistory();
  };

  const newChat = () => {
    setMessages([{ ...welcome, time: now() }]);
    setConversationId(null);
    setText("");
    setHistoryOpen(false);
  };

  const openConversation = async (id) => {
    try {
      const conversation = await aiApi.getConversation(id);
      setMessages(conversation.messages?.length ? conversation.messages : [welcome]);
      setConversationId(conversation._id);
    } catch (_error) {
      setSavedChats((current) => current.filter((item) => item._id !== id));
    } finally {
      setHistoryOpen(false);
    }
  };

  const removeConversation = async (id) => {
    try {
      await aiApi.deleteConversation(id);
      setSavedChats((current) => current.filter((item) => item._id !== id));
      if (conversationId === id) newChat();
    } catch (_error) {
      // Leave the list as-is; user can retry.
    }
  };

  const saveChat = async () => {
    if (!isAuthenticated) return;
    const toSave = messages.filter((message) => !message.isWelcome);
    if (!toSave.length) return;
    setSaving(true);
    try {
      if (conversationId) {
        await aiApi.updateConversation(conversationId, { messages: toSave });
      } else {
        const created = await aiApi.saveConversation(toSave);
        setConversationId(created._id);
      }
    } catch (_error) {
      // Non-critical — the conversation just stays unsaved for now.
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    const message = text.trim();
    if (!message || loading) return;
    setText("");

    // The backend requires auth on /ai/chat (see aiRoutes.js) — same rule
    // the website enforces in Assistant.jsx. Without this check, a logged-
    // out user's message would round-trip to a 401 and show a confusing
    // raw auth error instead of a clear next step.
    if (!isAuthenticated) {
      setMessages((items) => [
        ...items,
        { role: "user", content: message, time: now() },
        { role: "assistant", content: "Please login to use the connected AI assistant.", time: now() },
      ]);
      return;
    }

    const userMessage = { role: "user", content: message, time: now() };
    const next = [...messages, userMessage];
    setMessages(next);
    setLoading(true);

    try {
      const data = await aiApi.chat(message, next.filter((m) => !m.isWelcome).slice(-8));
      const reply = { role: "assistant", content: data?.reply || "I couldn't generate a response. Please try again.", time: now() };
      const withReply = [...next, reply];
      setMessages(withReply);
      // Auto-save once a conversation already exists, same as the website.
      if (conversationId) {
        aiApi.updateConversation(conversationId, { messages: withReply.filter((m) => !m.isWelcome) }).catch(() => {});
      }
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: `Sorry, ${error.message || "something went wrong."}`, time: now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      {!fullscreen && (
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarButton} onPress={newChat}>
            <Ionicons name="add" size={16} color={colors.text} />
            <Text style={styles.toolbarButtonText}>New</Text>
          </TouchableOpacity>
          {isAuthenticated && (
            <TouchableOpacity style={styles.toolbarButton} onPress={saveChat} disabled={saving || messages.every((m) => m.isWelcome)}>
              {saving ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="bookmark-outline" size={16} color={colors.text} />}
              <Text style={styles.toolbarButtonText}>Save</Text>
            </TouchableOpacity>
          )}
          {isAuthenticated && (
            <TouchableOpacity style={styles.toolbarButton} onPress={openHistory}>
              <Ionicons name="time-outline" size={16} color={colors.text} />
              <Text style={styles.toolbarButtonText}>History</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.toolbarButton} onPress={() => setFullscreen(true)}>
            <Ionicons name="expand-outline" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={fullscreen ? 0 : 60}>
        {fullscreen && (
          <TouchableOpacity style={styles.exitFullscreen} onPress={() => setFullscreen(false)}>
            <Ionicons name="contract-outline" size={16} color={colors.text} />
            <Text style={styles.toolbarButtonText}>Exit fullscreen</Text>
          </TouchableOpacity>
        )}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => <MessageBubble message={item} colors={colors} />}
        />
        {loading && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask something..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <TouchableOpacity style={[styles.sendButton, (!text.trim() || loading) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || loading}>
            <Ionicons name="send" size={17} color={colors.accentText} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={historyOpen} animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <Screen>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Saved chats</Text>
            <TouchableOpacity onPress={() => setHistoryOpen(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {historyLoading ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.accent} />
          ) : (
            <FlatList
              data={savedChats}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<EmptyState title="No saved chats yet" />}
              renderItem={({ item }) => (
                <View style={styles.historyRow}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openConversation(item._id)}>
                    <Text style={styles.historyRowTitle} numberOfLines={1}>{item.title}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeConversation(item._id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </Screen>
      </Modal>
    </Screen>
  );
}

function MessageBubble({ message, colors }) {
  const isUser = message.role === "user";
  const segments = splitIntoSegments(message.content);
  return (
    <View style={[bubbleStyles.row, isUser ? bubbleStyles.rowUser : bubbleStyles.rowAssistant]}>
      <View
        style={[
          bubbleStyles.bubble,
          { backgroundColor: isUser ? colors.accent : colors.surfaceSolid, borderColor: colors.border },
        ]}
      >
        {segments.map((segment, index) =>
          segment.type === "code" ? (
            <CodeBlock key={index} language={segment.language} content={segment.content} />
          ) : (
            <Text key={index} style={{ color: isUser ? colors.accentText : colors.text, fontSize: 14.5, lineHeight: 21 }}>
              {segment.content}
            </Text>
          )
        )}
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  row: { marginVertical: 5, paddingHorizontal: 14 },
  rowUser: { alignItems: "flex-end" },
  rowAssistant: { alignItems: "flex-start" },
  bubble: { maxWidth: "86%", borderRadius: 16, borderWidth: 1, padding: 12, gap: 6 },
});

const getStyles = (colors) =>
  StyleSheet.create({
    toolbar: { flexDirection: "row", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    toolbarButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    toolbarButtonText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    exitFullscreen: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", margin: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    list: { paddingVertical: 12 },
    typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingBottom: 6 },
    typingText: { color: colors.muted, fontSize: 12.5 },
    inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
    input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, backgroundColor: colors.surfaceSolid, maxHeight: 120 },
    sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    historyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    historyRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 8 },
    historyRowTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  });
