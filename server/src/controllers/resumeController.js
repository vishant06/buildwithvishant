import Resume from '../models/Resume.js';
import { uploadResumePdf } from '../services/cloudinaryService.js';

// export const uploadLatestResume = async (req, res) => {
  

//   if (!req.file) {
//     return res.status(400).json({ message: "Resume file is required" });
//   }

 
// }

export const getLatestResume = async (_req, res) => {
  const resume = await Resume.findOne().sort({ uploadedAt: -1 });
  if (!resume) return res.status(404).json({ message: 'Resume has not been uploaded yet' });
  res.json(resume);
};

export const uploadLatestResume = async (req, res) => {
console.log("🔥 NEW RESUME CONTROLLER RUNNING");

  if (!req.file) return res.status(400).json({ message: 'Resume file is required' });

  try {
    const uploadedResume = await uploadResumePdf(req.file);
    const resume = await Resume.create({
      fileUrl: uploadedResume.secure_url,
      uploadedAt: new Date()
    });

    res.status(201).json(resume);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Unable to upload resume' });
  }
};
