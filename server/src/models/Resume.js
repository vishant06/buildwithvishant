import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    fileUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const Resume = mongoose.model('Resume', resumeSchema);
export default Resume;
