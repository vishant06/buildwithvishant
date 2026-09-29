import mongoose from 'mongoose';

// Messages are embedded directly on the conversation (same lightweight
// pattern as Note.blocks) instead of a separate collection — a saved chat
// is always read/written as a whole, so there's no need for a join.
const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, trim: true },
  time: { type: Date, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  messages: { type: [chatMessageSchema], default: [] }
}, {
  timestamps: true
});

conversationSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
