import Project from '../models/Project.js';
import {
  deleteCloudinaryAsset,
  uploadProjectImage
} from '../services/cloudinaryService.js';

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const getProjects = async (_req, res) => {
  const projects = await Project.find().sort({ featured: -1, createdAt: -1 });
  res.json(projects);
};

export const getProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  res.json(project);
};

export const createProject = async (req, res) => {
  let uploadedImage;

  try {
    if (req.file) uploadedImage = await uploadProjectImage(req.file);

    const project = await Project.create({
      title: req.body.title,
      description: req.body.description,
      technologies: toArray(req.body.technologies),
      image: uploadedImage?.secure_url || req.body.image || '',
      githubLink: req.body.githubLink,
      liveLink: req.body.liveLink,
      featured: req.body.featured === 'true' || req.body.featured === true
    });

    res.status(201).json(project);
  } catch (error) {
    if (uploadedImage?.secure_url) await deleteCloudinaryAsset(uploadedImage.secure_url).catch(() => null);
    res.status(error.status || 500).json({ message: error.message || 'Unable to create project' });
  }
};

export const updateProject = async (req, res) => {
  let uploadedImage;

  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const previousImage = project.image;
    if (req.file) uploadedImage = await uploadProjectImage(req.file);

    project.title = req.body.title ?? project.title;
    project.description = req.body.description ?? project.description;
    project.technologies = req.body.technologies ? toArray(req.body.technologies) : project.technologies;
    project.githubLink = req.body.githubLink ?? project.githubLink;
    project.liveLink = req.body.liveLink ?? project.liveLink;
    project.featured = req.body.featured === undefined ? project.featured : req.body.featured === 'true' || req.body.featured === true;
    if (uploadedImage?.secure_url) project.image = uploadedImage.secure_url;

    const updated = await project.save();
    if (uploadedImage?.secure_url) await deleteCloudinaryAsset(previousImage).catch(() => null);

    res.json(updated);
  } catch (error) {
    if (uploadedImage?.secure_url) await deleteCloudinaryAsset(uploadedImage.secure_url).catch(() => null);
    res.status(error.status || 500).json({ message: error.message || 'Unable to update project' });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    await deleteCloudinaryAsset(project.image).catch(() => null);
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Unable to delete project' });
  }
};
