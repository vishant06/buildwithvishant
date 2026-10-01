
import Conversation from "../models/Conversation.js";

// Builds a short title from the first user message
const generateTitle = (messages) => {
  const firstUser = messages.find((item) => item.role === "user");

  const source = (firstUser?.content || "New conversation")
    .replace(/\s+/g, " ")
    .trim();

  const words = source.split(" ").slice(0, 8).join(" ");

  const title = words.length < source.length ? `${words}…` : words;

  return title.slice(0, 80) || "New conversation";
};

// Sanitize messages before saving them to MongoDB
const sanitizeMessages = (input) => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "")
        .trim()
        .slice(0, 8000),
      time:
        item?.time && !Number.isNaN(Date.parse(item.time))
          ? new Date(item.time)
          : new Date(),
    }))
    .filter((item) => item.content);
};

// ============================================================
// POST /api/ai/chat
// Gemini AI Chat
// ============================================================
export const chat = async (req, res) => {
  const message = String(req.body.message || "").trim();

  if (!message || message.length > 8000) {
    return res.status(400).json({
      message: "Please provide a valid question under 8,000 characters",
    });
  }

  // Check Gemini API key
  if (!process.env.AI_API_KEY) {
    return res.status(503).json({
      message:
        "AI service is not configured yet. Add AI_API_KEY on the server to enable it.",
    });
  }

  // This controller uses Gemini
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  if (provider !== "gemini") {
    return res.status(400).json({
      message: `Unsupported AI provider: ${provider}. Set AI_PROVIDER=gemini.`,
    });
  }

  // Get recent conversation history
  const history = Array.isArray(req.body.history)
    ? req.body.history
        .slice(-10)
        .map((item) => ({
          role: item?.role === "assistant" ? "model" : "user",
          content: String(item?.content || "")
            .trim()
            .slice(0, 8000),
        }))
        .filter((item) => item.content)
    : [];

  try {
    const model = process.env.AI_MODEL || "gemini-2.5-flash";

    // Convert history into Gemini format
    const contents = history.map((item) => ({
      role: item.role,
      parts: [
        {
          text: item.content,
        },
      ],
    }));

    // Add current user message
    contents.push({
      role: "user",
      parts: [
        {
          text: message,
        },
      ],
    });

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent` +
      `?key=${encodeURIComponent(process.env.AI_API_KEY)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are a helpful and intelligent developer learning assistant. " +
                "Explain programming and computer science concepts clearly. " +
                "Help debug code and provide practical solutions. " +
                "Use Markdown and fenced code blocks for code examples. " +
                "Never claim that you executed code unless you actually executed it. " +
                "If you are uncertain, say so instead of inventing information. " +
                "Keep answers accurate, useful, and easy to understand.",
            },
          ],
        },

        contents,

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      }),
    });

    const data = await response.json();

    // Gemini returned an error
    if (!response.ok) {
      console.error(
        "Gemini API error:",
        data?.error?.message || `HTTP ${response.status}`
      );

      return res.status(502).json({
        message:
          data?.error?.message ||
          "The Gemini AI service is temporarily unavailable. Please try again.",
      });
    }

    // Extract Gemini text response
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Gemini returned an empty response:", data);

      return res.status(502).json({
        message:
          "Gemini returned an empty response. Please try again.",
      });
    }

    return res.json({
      reply,
    });
  } catch (error) {
    console.error("Gemini request failed:", error);

    return res.status(502).json({
      message:
        "Unable to reach the Gemini AI service. Please try again.",
    });
  }
};

// ============================================================
// GET /api/ai/conversations
// List current user's saved chats
// ============================================================
export const listConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      user: req.user._id,
    })
      .select("title createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(conversations);
  } catch (error) {
    console.error(
      "Failed to list conversations:",
      error.message
    );

    return res.status(500).json({
      message:
        "Unable to load saved chats. Please try again.",
    });
  }
};

// ============================================================
// GET /api/ai/conversations/:id
// Open a saved chat
// ============================================================
export const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).lean();

    if (!conversation) {
      return res.status(404).json({
        message: "That conversation could not be found.",
      });
    }

    return res.json(conversation);
  } catch (error) {
    return res.status(404).json({
      message: "That conversation could not be found.",
    });
  }
};

// ============================================================
// POST /api/ai/conversations
// Save a new conversation
// ============================================================
export const saveConversation = async (req, res) => {
  const messages = sanitizeMessages(req.body.messages);

  if (!messages.length) {
    return res.status(400).json({
      message:
        "There's nothing to save yet — send a message first.",
    });
  }

  const title =
    String(req.body.title || "")
      .trim()
      .slice(0, 80) || generateTitle(messages);

  try {
    const conversation = await Conversation.create({
      user: req.user._id,
      title,
      messages,
    });

    return res.status(201).json(conversation);
  } catch (error) {
    console.error(
      "Failed to save conversation:",
      error.message
    );

    return res.status(500).json({
      message:
        "Could not save this conversation. Please try again.",
    });
  }
};

// ============================================================
// PUT /api/ai/conversations/:id
// Update an existing conversation
// ============================================================
export const updateConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        message: "That conversation could not be found.",
      });
    }

    if (
      typeof req.body.title === "string" &&
      req.body.title.trim()
    ) {
      conversation.title = req.body.title.trim().slice(0, 80);
    }

    if (Array.isArray(req.body.messages)) {
      const messages = sanitizeMessages(req.body.messages);

      if (messages.length) {
        conversation.messages = messages;
      }
    }

    await conversation.save();

    return res.json(conversation);
  } catch (error) {
    console.error(
      "Failed to update conversation:",
      error.message
    );

    return res.status(500).json({
      message:
        "Could not update this conversation. Please try again.",
    });
  }
};

// ============================================================
// DELETE /api/ai/conversations/:id
// Delete a saved conversation
// ============================================================
export const deleteConversation = async (req, res) => {
  try {
    const conversation =
      await Conversation.findOneAndDelete({
        _id: req.params.id,
        user: req.user._id,
      });

    if (!conversation) {
      return res.status(404).json({
        message: "That conversation could not be found.",
      });
    }

    return res.json({
      message: "Conversation deleted.",
    });
  } catch (error) {
    return res.status(404).json({
      message: "That conversation could not be found.",
    });
  }
};

