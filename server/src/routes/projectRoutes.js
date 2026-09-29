import express from 'express';
import {
  createProject,
  deleteProject,
  getProject,
  getProjects,
  updateProject
} from '../controllers/projectController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { uploadProjectImage } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', protect, authorize('admin'), uploadProjectImage.single('image'), createProject);
router.put('/:id', protect, authorize('admin'), uploadProjectImage.single('image'), updateProject);
router.delete('/:id', protect, authorize('admin'), deleteProject);

export default router;
