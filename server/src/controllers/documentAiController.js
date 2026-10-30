import NoteDocument from '../models/NoteDocument.js';
import { DocumentAiUsage, DocumentText } from '../models/DocumentExtras.js';
import { documentConfig } from '../config/documents.js';
import { AiError, completeChat } from '../services/aiProvider.js';
import { accessFor } from '../utils/documentAccess.js';
import { ACTIONS, buildMessages, sanitizeCitations, selectExcerpts } from '../utils/documentAi.js';

// POST /api/documents/:slug/ai   (login required, rate limited, daily quota)
//   { action: ask | summarize | explain_page | practice | explain_code, question?, page?, selection? }
//
// Order matters: (1) the person must be allowed to read this document, (2) their daily quota is
// consumed, (3) only then is any of the document's text read and sent to the provider.
export const askAboutDocument = async (req, res) => {
  try {
    const slug = req.params.slug;
    const doc = typeof slug === 'string' && /^[a-z0-9-]{3,80}$/.test(slug) ? await NoteDocument.findOne({ slug }) : null;
    const access = accessFor(doc, req.user, 'ai');
    if (!doc || !access.allowed || access.statusOnly) return res.status(404).json({ message: 'This note is not available.' });

    const action = req.body?.action;
    if (!ACTIONS.includes(action)) return res.status(400).json({ message: 'Choose what you want help with.' });
    const question = typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 1000) : '';
    if (action === 'ask' && question.length < 3) return res.status(400).json({ message: 'Type your question first.' });
    const page = Number.parseInt(req.body?.page, 10);
    if (action === 'explain_page' && !(page >= 1 && page <= doc.file.pages)) return res.status(400).json({ message: `Choose a page between 1 and ${doc.file.pages}.` });
    const selection = typeof req.body?.selection === 'string' ? req.body.selection.trim().slice(0, 1500) : '';
    if (action === 'explain_code' && !doc.codeExample?.code) return res.status(400).json({ message: 'This note has no code example.' });

    const stored = action === 'explain_code' ? null : await DocumentText.findOne({ document: doc._id });
    if (action !== 'explain_code' && (!stored?.pages?.length || !doc.file.hasText)) {
      return res.status(422).json({ message: 'This PDF has no readable text (it may be scanned images), so the assistant cannot read it.' });
    }

    const day = new Date().toISOString().slice(0, 10);
    const usage = await DocumentAiUsage.findOneAndUpdate({ user: req.user._id, day }, { $inc: { count: 1 } }, { upsert: true, new: true });
    if (usage.count > documentConfig().aiDailyQuota) return res.status(429).json({ message: `You have used today's ${documentConfig().aiDailyQuota} AI requests for notes. Try again tomorrow.` });

    const { excerpts } = action === 'explain_code' ? { excerpts: [] } : selectExcerpts({ action, pages: stored.pages, question, page });
    const messages = buildMessages({
      action, title: doc.title, excerpts, question, page: Number.isFinite(page) ? page : undefined, selection,
      code: action === 'explain_code' ? doc.codeExample : undefined
    });
    let reply;
    try {
      reply = await completeChat({ messages, temperature: 0.3, maxTokens: 900 });
    } catch (error) {
      await DocumentAiUsage.updateOne({ _id: usage._id }, { $inc: { count: -1 } }).catch(() => null); // a failed request does not use up the quota
      throw error;
    }
    const { text, pages } = sanitizeCitations(reply, excerpts.map((item) => item.n));
    res.set('Cache-Control', 'private, no-store');
    res.json({ reply: text, citedPages: pages, usedPages: excerpts.map((item) => item.n), remaining: Math.max(0, documentConfig().aiDailyQuota - usage.count) });
  } catch (error) {
    if (error instanceof AiError) return res.status(error.status).json({ message: error.message });
    console.error('Document AI error:', error);
    res.status(500).json({ message: 'The assistant could not answer right now. Please try again.' });
  }
};
