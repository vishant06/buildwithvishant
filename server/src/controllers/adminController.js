import User from '../models/User.js';
import Note from '../models/Note.js';
import Project from '../models/Project.js';
import PlaygroundProject from '../models/PlaygroundProject.js';
import { deleteCloudinaryAsset } from '../services/cloudinaryService.js';

export const users = async (_req, res) => res.json(await User.find().select('-password').sort({
    createdAt: -1
}));
export const stats = async (_req, res) => {
    const [users, notes, projects, playgrounds] = await Promise.all([User.countDocuments(), Note.countDocuments(), Project.countDocuments(), PlaygroundProject.countDocuments()]);
    res.json({
        users,
        notes,
        projects,
        playgrounds
    });
};

// Roles are the sensitive bit here, so this endpoint is deliberately separate
// from the general-purpose updateUser below and always re-checks the
// last-admin rule against the database rather than trusting the client.
export const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Role must be either "user" or "admin"' });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (target.role === 'admin' && role === 'user') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
            return res.status(400).json({ message: 'Cannot remove the last administrator.' });
        }
    }

    target.role = role;
    await target.save();
    res.json({ message: 'Role updated', user: { id: target._id, role: target.role } });
};

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, username, email } = req.body;

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (username && username.toLowerCase() !== target.username) {
        const taken = await User.exists({ username: username.toLowerCase(), _id: { $ne: id } });
        if (taken) return res.status(409).json({ message: 'That username is already in use' });
        target.username = username.toLowerCase();
    }

    if (email && email.toLowerCase() !== target.email) {
        const taken = await User.exists({ email: email.toLowerCase(), _id: { $ne: id } });
        if (taken) return res.status(409).json({ message: 'That email is already in use' });
        target.email = email.toLowerCase();
    }

    if (name) target.name = name;

    await target.save();

    const safeUser = target.toObject();
    delete safeUser.password;
    res.json({ message: 'User updated', user: safeUser });
};

export const deleteUser = async (req, res) => {
    const { id } = req.params;

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (String(target._id) === String(req.user._id)) {
        return res.status(400).json({ message: 'You cannot delete your own account from here.' });
    }

    if (target.role === 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
            return res.status(400).json({ message: 'Cannot delete the last administrator.' });
        }
    }

    if (target.avatar?.publicId) {
        try {
            await deleteCloudinaryAsset(target.avatar.url, 'image');
        } catch (error) {
            console.error('Failed to delete user avatar from Cloudinary:', error);
        }
    }

    await target.deleteOne();
    res.json({ message: 'User deleted' });
};