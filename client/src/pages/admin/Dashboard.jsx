import {
  Check,
  Eye,
  EyeOff,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BlockEditor from '../../components/notes/BlockEditor.jsx';
import BulkImportModal from '../../components/notes/BulkImportModal.jsx';
import { cleanBlocks, legacyToBlocks } from '../../components/notes/blockTypes.js';
import NoteRenderer from '../../components/notes/NoteRenderer.jsx';
import { invalidateNotesCache } from '../../services/notesCache.js';
import { useAuth } from '../../context/AuthContext.jsx';
import request, { absoluteAsset } from '../../services/api.js';
import '../../styles/admin.css';
import '../../styles/notes-blocks.css';

const emptyProject = {
  title: '',
  description: '',
  technologies: '',
  githubLink: '',
  liveLink: '',
  featured: false,
  image: null,
};

const emptyNote = {
  title: '',
  description: '',
  category: '',
  tags: '',
  difficulty: 'Beginner',
  thumbnail: '',
  published: false,
  blocks: [],
};

const Dashboard = () => {
  const { logout, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [resume, setResume] = useState(null);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyProject);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingUserId, setEditingUserId] = useState(null);
  const [userEditForm, setUserEditForm] = useState({
    name: '',
    username: '',
    email: '',
  });
  const [userStatus, setUserStatus] = useState('');

  const [notes, setNotes] = useState([]);
  const [noteForm, setNoteForm] = useState(emptyNote);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showNotePreview, setShowNotePreview] = useState(true);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [noteStatus, setNoteStatus] = useState('');
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  const stats = useMemo(
    () => [
      ['Projects', projects.length],
      ['Featured', projects.filter((project) => project.featured).length],
      ['Messages', messages.length],
      ['Users', users.length],
      ['Notes', notes.length],
    ],
    [messages.length, projects, users.length, notes.length]
  );

  const loadData = async () => {
    setLoading(true);

    try {
      const [
        projectData,
        messageData,
        resumeData,
        userData,
        noteData,
      ] = await Promise.all([
        request('/projects'),
        request('/contact/messages'),
        request('/resume/latest').catch(() => null),
        request('/admin/users').catch(() => []),
        request('/notes/admin/all').catch(() => []),
      ]);

      setProjects(projectData);
      setMessages(messageData);
      setResume(resumeData);
      setUsers(userData);
      setNotes(noteData);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = (event) => {
    const { name, value, checked, type, files } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'file'
            ? files[0]
            : value,
    }));
  };

  const resetForm = () => {
    setForm(emptyProject);
    setEditingId(null);
  };

  const editProject = (project) => {
    setEditingId(project._id);

    setForm({
      title: project.title,
      description: project.description,
      technologies: project.technologies.join(', '),
      githubLink: project.githubLink || '',
      liveLink: project.liveLink || '',
      featured: project.featured,
      image: null,
    });
  };

  const saveProject = async (event) => {
    event.preventDefault();

    const payload = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (value !== null) {
        payload.append(key, value);
      }
    });

    try {
      if (editingId) {
        await request(`/projects/${editingId}`, {
          method: 'PUT',
          body: payload,
        });

        setStatus('Project updated.');
      } else {
        await request('/projects', {
          method: 'POST',
          body: payload,
        });

        setStatus('Project added.');
      }

      resetForm();
      loadData();
    } catch (error) {
      setStatus(error.message);
    }
  };

  const removeProject = async (id) => {
    if (!confirm('Delete this project?')) return;

    try {
      await request(`/projects/${id}`, {
        method: 'DELETE',
      });

      setStatus('Project deleted.');
      loadData();
    } catch (error) {
      setStatus(error.message);
    }
  };

  const uploadResume = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const payload = new FormData();
    payload.append('resume', file);

    try {
      const data = await request('/resume/upload', {
        method: 'POST',
        body: payload,
      });

      setResume(data);
      setStatus('Resume uploaded.');
    } catch (error) {
      setStatus(error.message);
    }
  };

  const changeUserRole = async (targetUser, role) => {
    setUserStatus('');

    try {
      await request(`/admin/users/${targetUser._id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });

      setUserStatus(
        `${targetUser.name} is now ${
          role === 'admin' ? 'an administrator' : 'a regular user'
        }.`
      );

      loadData();
    } catch (error) {
      setUserStatus(error.message);
    }
  };

  const startEditUser = (targetUser) => {
    setEditingUserId(targetUser._id);

    setUserEditForm({
      name: targetUser.name,
      username: targetUser.username,
      email: targetUser.email,
    });
  };

  const cancelEditUser = () => {
    setEditingUserId(null);

    setUserEditForm({
      name: '',
      username: '',
      email: '',
    });
  };

  const saveEditUser = async (id) => {
    setUserStatus('');

    try {
      await request(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(userEditForm),
      });

      setUserStatus('User updated.');
      cancelEditUser();
      loadData();
    } catch (error) {
      setUserStatus(error.message);
    }
  };

  const removeUser = async (id) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;

    setUserStatus('');

    try {
      await request(`/admin/users/${id}`, {
        method: 'DELETE',
      });

      setUserStatus('User deleted.');
      loadData();
    } catch (error) {
      setUserStatus(error.message);
    }
  };

  const updateNoteField = (event) => {
    const { name, value, checked, type } = event.target;

    setNoteForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const openAddNote = () => {
    setEditingNoteId(null);
    setNoteForm({
      ...emptyNote,
      blocks: [],
    });
    setShowNoteForm(true);
  };

  const editNote = async (note) => {
    setNoteStatus('');

    try {
      // The notes list doesn't include blocks/content (kept light on
      // purpose), so fetch the full note before opening the editor.
      const full = await request(`/notes/admin/${note._id}`);

      setEditingNoteId(full._id);

      setNoteForm({
        title: full.title,
        description: full.description,
        category: full.category,
        tags: (full.tags || []).join(', '),
        difficulty: full.difficulty || 'Beginner',
        thumbnail: full.thumbnail || '',
        published: Boolean(full.published),
        blocks: full.blocks?.length
          ? full.blocks
          : legacyToBlocks(full),
      });

      setShowNoteForm(true);
    } catch (error) {
      setNoteStatus(error.message);
    }
  };

  const cancelNoteForm = () => {
    setShowNoteForm(false);
    setEditingNoteId(null);
    setNoteForm({
      ...emptyNote,
      blocks: [],
    });
  };

  const uploadThumbnail = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const payload = new FormData();
    payload.append('thumbnail', file);

    setThumbnailUploading(true);
    setNoteStatus('');

    try {
      const data = await request('/notes/admin/thumbnail', {
        method: 'POST',
        body: payload,
      });

      setNoteForm((current) => ({
        ...current,
        thumbnail: data.url,
      }));

      setNoteStatus('Thumbnail uploaded.');
    } catch (error) {
      setNoteStatus(error.message);
    } finally {
      setThumbnailUploading(false);
      event.target.value = '';
    }
  };

  const removeThumbnail = () => {
    setNoteForm((current) => ({
      ...current,
      thumbnail: '',
    }));
  };

  const saveNote = async (event) => {
    event.preventDefault();
    setNoteStatus('');

    const payload = {
      ...noteForm,
      blocks: cleanBlocks(noteForm.blocks),
    };

    try {
      if (editingNoteId) {
        await request(`/notes/${editingNoteId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        setNoteStatus('Note updated.');
      } else {
        await request('/notes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        setNoteStatus('Note added.');
      }

      invalidateNotesCache();
      cancelNoteForm();
      loadData();
    } catch (error) {
      setNoteStatus(error.message);
    }
  };

  const removeNote = async (id) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    setNoteStatus('');

    try {
      await request(`/notes/${id}`, {
        method: 'DELETE',
      });

      invalidateNotesCache();
      setNoteStatus('Note deleted.');
      loadData();
    } catch (error) {
      setNoteStatus(error.message);
    }
  };

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <strong>VK Admin</strong>
        <span>{user?.email}</span>

        <button
          className="btn ghost"
          onClick={logout}
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <section className="admin-content">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">Dashboard</span>
            <h1>Portfolio control center</h1>
          </div>

          <button
            className="btn ghost"
            onClick={loadData}
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        <div className="admin-stats">
          {stats.map(([label, value]) => (
            <article
              className="panel"
              key={label}
            >
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        {status && <p className="notice">{status}</p>}
        {loading && <p className="notice">Loading admin data...</p>}

        <div className="admin-grid">
          <form
            className="form panel"
            onSubmit={saveProject}
          >
            <h2>{editingId ? 'Edit Project' : 'Add Project'}</h2>

            <label>
              Title
              <input
                name="title"
                value={form.title}
                onChange={updateField}
                required
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                required
              />
            </label>

            <label>
              Technologies
              <input
                name="technologies"
                value={form.technologies}
                onChange={updateField}
                placeholder="React, Node.js, MongoDB"
                required
              />
            </label>

            <label>
              GitHub Link
              <input
                name="githubLink"
                value={form.githubLink}
                onChange={updateField}
              />
            </label>

            <label>
              Live Demo Link
              <input
                name="liveLink"
                value={form.liveLink}
                onChange={updateField}
              />
            </label>

            <label>
              Project Image
              <input
                name="image"
                type="file"
                accept="image/*"
                onChange={updateField}
              />
            </label>

            <label className="checkbox">
              <input
                name="featured"
                type="checkbox"
                checked={form.featured}
                onChange={updateField}
              />
              Featured project
            </label>

            <div className="actions">
              <button className="btn primary">
                <Plus size={18} />
                {editingId ? 'Save Changes' : 'Add Project'}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="panel">
            <h2>Resume Upload</h2>

            <label className="upload-box">
              <Upload size={22} />
              <span>Upload latest resume</span>

              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={uploadResume}
              />
            </label>

            {resume && (
              <a
                className="inline-link"
                href={absoluteAsset(resume.fileUrl)}
                target="_blank"
                rel="noreferrer"
              >
                View latest resume
              </a>
            )}
          </div>
        </div>

        <div className="admin-sections">
          <section className="panel">
            <h2>Manage Projects</h2>

            <div className="admin-list">
              {projects.map((project) => (
                <article key={project._id}>
                  <img
                    src={
                      absoluteAsset(project.image) ||
                      '/profile-placeholder.svg'
                    }
                    alt={project.title}
                  />

                  <div>
                    <strong>{project.title}</strong>
                    <span>{project.technologies.join(', ')}</span>
                  </div>

                  <button
                    className="btn ghost"
                    onClick={() => editProject(project)}
                  >
                    Edit
                  </button>

                  <button
                    className="icon-btn danger"
                    onClick={() => removeProject(project._id)}
                    aria-label="Delete project"
                  >
                    <Trash2 size={18} />
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Manage Users</h2>

            {userStatus && (
              <p className="notice">{userStatus}</p>
            )}

            <div className="table-scroll">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Provider</th>
                    <th>Verified</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((target) => {
                    const isEditing =
                      editingUserId === target._id;

                    const providerLabel =
                      target.providers?.length
                        ? target.providers
                            .map((entry) => entry.provider)
                            .join(', ')
                        : 'email';

                    return (
                      <tr key={target._id}>
                        <td>
                          <img
                            className="user-avatar-thumb"
                            src={
                              absoluteAsset(
                                target.avatar?.url
                              ) || '/profile-placeholder.svg'
                            }
                            alt=""
                          />
                        </td>

                        <td>
                          {isEditing ? (
                            <input
                              value={userEditForm.name}
                              onChange={(event) =>
                                setUserEditForm({
                                  ...userEditForm,
                                  name: event.target.value,
                                })
                              }
                            />
                          ) : (
                            target.name
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input
                              value={userEditForm.username}
                              onChange={(event) =>
                                setUserEditForm({
                                  ...userEditForm,
                                  username: event.target.value,
                                })
                              }
                            />
                          ) : (
                            `@${target.username}`
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input
                              type="email"
                              value={userEditForm.email}
                              onChange={(event) =>
                                setUserEditForm({
                                  ...userEditForm,
                                  email: event.target.value,
                                })
                              }
                            />
                          ) : (
                            target.email
                          )}
                        </td>

                        <td>
                          <span className="badge">
                            {target.role}
                          </span>
                        </td>

                        <td>{providerLabel}</td>

                        <td>
                          <span
                            className={`badge ${
                              target.isEmailVerified
                                ? 'verified'
                                : 'pending'
                            }`}
                          >
                            {target.isEmailVerified
                              ? 'Verified'
                              : 'Pending'}
                          </span>
                        </td>

                        <td>
                          {new Date(
                            target.createdAt
                          ).toLocaleDateString()}
                        </td>

                        <td className="user-actions">
                          {isEditing ? (
                            <>
                              <button
                                className="icon-btn"
                                onClick={() =>
                                  saveEditUser(target._id)
                                }
                                aria-label="Save user"
                              >
                                <Check size={16} />
                              </button>

                              <button
                                className="icon-btn"
                                onClick={cancelEditUser}
                                aria-label="Cancel edit"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="icon-btn"
                                onClick={() =>
                                  startEditUser(target)
                                }
                                aria-label="Edit user"
                              >
                                <Pencil size={16} />
                              </button>

                              {target.role === 'admin' ? (
                                <button
                                  className="btn ghost small"
                                  onClick={() =>
                                    changeUserRole(
                                      target,
                                      'user'
                                    )
                                  }
                                >
                                  <ShieldOff size={14} />
                                  Make User
                                </button>
                              ) : (
                                <button
                                  className="btn ghost small"
                                  onClick={() =>
                                    changeUserRole(
                                      target,
                                      'admin'
                                    )
                                  }
                                >
                                  <ShieldCheck size={14} />
                                  Make Admin
                                </button>
                              )}

                              <button
                                className="icon-btn danger"
                                onClick={() =>
                                  removeUser(target._id)
                                }
                                aria-label="Delete user"
                                disabled={
                                  target._id === user?.id
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="section-title-row">
              <h2>Manage Notes</h2>

              {!showNoteForm && (
                <button
                  className="btn primary small"
                  onClick={openAddNote}
                >
                  <Plus size={16} />
                  Add Note
                </button>
              )}
            </div>

            {noteStatus && (
              <p className="notice">{noteStatus}</p>
            )}

            {showNoteForm && (
              <form
                className="form note-admin-form"
                onSubmit={saveNote}
              >
                <div className="section-title-row">
                  <h3>
                    {editingNoteId
                      ? 'Edit Note'
                      : 'Add Note'}
                  </h3>

                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      setShowNotePreview(
                        (value) => !value
                      )
                    }
                  >
                    {showNotePreview ? (
                      <EyeOff size={14} />
                    ) : (
                      <Eye size={14} />
                    )}

                    {showNotePreview
                      ? 'Hide Preview'
                      : 'Show Preview'}
                  </button>
                </div>

                <label>
                  Title
                  <input
                    name="title"
                    value={noteForm.title}
                    onChange={updateNoteField}
                    required
                  />
                </label>

                <label>
                  Description
                  <textarea
                    name="description"
                    value={noteForm.description}
                    onChange={updateNoteField}
                    maxLength={500}
                    required
                  />
                </label>

                <div className="form-grid">
                  <label>
                    Category
                    <input
                      name="category"
                      value={noteForm.category}
                      onChange={updateNoteField}
                      placeholder="Java, React, DSA..."
                      required
                    />
                  </label>

                  <label>
                    Difficulty
                    <select
                      name="difficulty"
                      value={noteForm.difficulty}
                      onChange={updateNoteField}
                    >
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                    </select>
                  </label>
                </div>

                <label>
                  Tags
                  <input
                    name="tags"
                    value={noteForm.tags}
                    onChange={updateNoteField}
                    placeholder="loops, arrays, basics"
                  />
                </label>

                <div className="thumbnail-label">
                  <span>Thumbnail</span>

                  <div className="thumbnail-field">
                    {noteForm.thumbnail ? (
                      <img
                        className="thumbnail-field-preview"
                        src={absoluteAsset(
                          noteForm.thumbnail
                        )}
                        alt=""
                      />
                    ) : (
                      <span className="thumbnail-field-empty">
                        No image selected
                      </span>
                    )}

                    <div className="thumbnail-field-actions">
                      <label className="btn ghost">
                        <Upload size={15} />

                        {thumbnailUploading
                          ? 'Uploading...'
                          : noteForm.thumbnail
                            ? 'Replace image'
                            : 'Upload image'}

                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={uploadThumbnail}
                          disabled={thumbnailUploading}
                        />
                      </label>

                      {noteForm.thumbnail && (
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={removeThumbnail}
                          disabled={thumbnailUploading}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={
                    showNotePreview
                      ? 'note-editor-layout'
                      : ''
                  }
                >
                  <div>
                    <span className="block-editor-section-label">
                      Content
                    </span>

                    <BlockEditor
                      blocks={noteForm.blocks}
                      onChange={(blocks) =>
                        setNoteForm({
                          ...noteForm,
                          blocks,
                        })
                      }
                      onBulkImportClick={() =>
                        setShowBulkImport(true)
                      }
                    />
                  </div>

                  {showNotePreview && (
                    <div className="note-editor-preview">
                      <span className="eyebrow">
                        Live Preview — this is exactly how
                        the note will look
                      </span>

                      {noteForm.title ||
                      noteForm.blocks.length > 0 ? (
                        <>
                          <h1>
                            {noteForm.title ||
                              'Untitled note'}
                          </h1>

                          {noteForm.description && (
                            <p className="lead">
                              {noteForm.description}
                            </p>
                          )}

                          <div className="note-reader-body">
                            <NoteRenderer
                              note={{
                                ...noteForm,
                                blocks: cleanBlocks(
                                  noteForm.blocks
                                ),
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <p className="note-editor-preview-empty">
                          Start adding a title and blocks
                          to see a live preview.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <label className="checkbox">
                  <input
                    name="published"
                    type="checkbox"
                    checked={noteForm.published}
                    onChange={updateNoteField}
                  />
                  Published (visible on the public Notes
                  page)
                </label>

                <div className="actions">
                  <button className="btn primary">
                    <Plus size={18} />
                    {editingNoteId
                      ? 'Save Changes'
                      : 'Add Note'}
                  </button>

                  <button
                    type="button"
                    className="btn ghost"
                    onClick={cancelNoteForm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="table-scroll">
              <table className="notes-table">
                <thead>
                  <tr>
                    <th>Note</th>
                    <th>Category</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {notes.map((note) => (
                    <tr key={note._id}>
                      <td>
                        <div className="note-title-cell">
                          <img
                            className="user-avatar-thumb"
                            src={
                              absoluteAsset(
                                note.thumbnail
                              ) ||
                              '/profile-placeholder.svg'
                            }
                            alt=""
                          />
                          <span>{note.title}</span>
                        </div>
                      </td>

                      <td>{note.category}</td>
                      <td>{note.author?.name || '—'}</td>

                      <td>
                        <span
                          className={`badge ${
                            note.published
                              ? 'verified'
                              : 'pending'
                          }`}
                        >
                          {note.published
                            ? 'Published'
                            : 'Draft'}
                        </span>
                      </td>

                      <td>
                        {new Date(
                          note.createdAt
                        ).toLocaleDateString()}
                      </td>

                      <td>
                        {new Date(
                          note.updatedAt
                        ).toLocaleDateString()}
                      </td>

                      <td className="user-actions">
                        <button
                          className="icon-btn"
                          onClick={() =>
                            editNote(note)
                          }
                          aria-label="Edit note"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="icon-btn danger"
                          onClick={() =>
                            removeNote(note._id)
                          }
                          aria-label="Delete note"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Manage Emails</h2>

            <div className="message-list">
              {messages.map((message) => (
                <article key={message._id}>
                  <strong>{message.subject}</strong>
                  <span>
                    {message.name} • {message.email}
                  </span>
                  <p>{message.message}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onImport={(imported) => {
            setNoteForm((current) => ({
              ...current,
              blocks: [
                ...current.blocks,
                ...imported,
              ],
            }));

            setShowBulkImport(false);

            setNoteStatus(
              `Imported ${imported.length} block${
                imported.length === 1 ? '' : 's'
              } — review them below, then save.`
            );
          }}
        />
      )}
    </main>
  );
};

export default Dashboard;