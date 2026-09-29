import Conversation from "../models/Conversation.js";

// Builds a short, human-readable title from the first user message —
// e.g. "How does Node.js event loop work?" -> "How does Node.js event loop work"
const generateTitle = (messages) => {
  const firstUser = messages.find((item) => item.role === "user");
  const source = (firstUser?.content || "New conversation")
    .replace(/\s+/g, " ")
    .trim();
  const words = source.split(" ").slice(0, 8).join(" ");
  const title = words.length < source.length ? `${words}…` : words;
  return title.slice(0, 80) || "New conversation";
};

// Normalizes/validates a messages array coming from the client before it
// touches the database — never trust role/content/time from the request.
const sanitizeMessages = (input) => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim().slice(0, 8000),
      time: item?.time && !Number.isNaN(Date.parse(item.time)) ? new Date(item.time) : new Date(),
    }))
    .filter((item) => item.content);
};

export const chat = async (req, res) => {
  const message = String(req.body.message || "").trim();

  if (!message || message.length > 8000) {
    return res.status(400).json({
      message: "Please provide a valid question under 8,000 characters",
    });
  }

  if (!process.env.AI_API_KEY) {
    return res.status(503).json({
      message:
        "AI service is not configured yet. Add AI_API_KEY on the server to enable it.",
    });
  }

  const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();

  if (provider !== "groq") {
    return res.status(501).json({
      message: `The ${provider} adapter has not been configured yet.`,
    });
  }

  const history = Array.isArray(req.body.history)
    ? req.body.history
        .slice(-10)
        .map((item) => ({
          role: item?.role === "assistant" ? "assistant" : "user",
          content: String(item?.content || "").slice(0, 8000),
        }))
        .filter((item) => item.content)
    : [];

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "llama-3.1-8b-instant",

          messages: [
            {
              role: "system",
              content:
                "You are a concise, helpful developer learning assistant. Explain concepts clearly, help debug code, and put code examples in fenced Markdown blocks. Never claim to have run code you have not run.",
            },

            ...history,

            {
              role: "user",
              content: message,
            },
          ],

          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Groq response error:",
        data?.error?.message || response.status
      );

      return res.status(502).json({
        message:
          data?.error?.message ||
          "The AI service is temporarily unavailable. Please try again.",
      });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        message:
          "The AI service returned an empty response. Please try again.",
      });
    }

    return res.json({
      reply,
    });
  } catch (error) {
    console.error("Groq request failed:", error.message);

    return res.status(502).json({
      message: "Unable to reach the AI service. Please try again.",
    });
  }
};
// GET /api/ai/conversations — list the current user's saved chats
// (lightweight: no message bodies, just enough for a sidebar list).
export const listConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ user: req.user._id })
      .select("title createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(conversations);
  } catch (error) {
    console.error("Failed to list conversations:", error.message);
    return res.status(500).json({ message: "Unable to load saved chats. Please try again." });
  }
};

// GET /api/ai/conversations/:id — open a single saved chat (with messages).
export const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id }).lean();

    if (!conversation) {
      return res.status(404).json({ message: "That conversation could not be found." });
    }

    return res.json(conversation);
  } catch (_error) {
    return res.status(404).json({ message: "That conversation could not be found." });
  }
};

// POST /api/ai/conversations — "Save Chat". Creates a new saved
// conversation owned by the authenticated user.
export const saveConversation = async (req, res) => {
  const messages = sanitizeMessages(req.body.messages);

  if (!messages.length) {
    return res.status(400).json({ message: "There's nothing to save yet — send a message first." });
  }

  const title = String(req.body.title || "").trim().slice(0, 80) || generateTitle(messages);

  try {
    const conversation = await Conversation.create({
      user: req.user._id,
      title,
      messages,
    });

    return res.status(201).json(conversation);
  } catch (error) {
    console.error("Failed to save conversation:", error.message);
    return res.status(500).json({ message: "Could not save this conversation. Please try again." });
  }
};

// PUT /api/ai/conversations/:id — update an existing saved chat: rename it,
// and/or persist newly exchanged messages (used for auto-save after a
// successful AI reply, and for the rename UI).
export const updateConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });

    if (!conversation) {
      return res.status(404).json({ message: "That conversation could not be found." });
    }

    if (typeof req.body.title === "string" && req.body.title.trim()) {
      conversation.title = req.body.title.trim().slice(0, 80);
    }

    if (Array.isArray(req.body.messages)) {
      const messages = sanitizeMessages(req.body.messages);
      if (messages.length) conversation.messages = messages;
    }

    await conversation.save();
    return res.json(conversation);
  } catch (error) {
    console.error("Failed to update conversation:", error.message);
    return res.status(500).json({ message: "Could not update this conversation. Please try again." });
  }
};

// DELETE /api/ai/conversations/:id
export const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!conversation) {
      return res.status(404).json({ message: "That conversation could not be found." });
    }

    return res.json({ message: "Conversation deleted." });
  } catch (_error) {
    return res.status(404).json({ message: "That conversation could not be found." });
  }
};
