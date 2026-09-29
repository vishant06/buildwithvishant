import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DownloadPdfButton from "../components/DownloadPdfButton.jsx";
import request, { absoluteAsset } from "../services/api.js";
export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  useEffect(() => {
    request("/notes")
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, []);
  const filtered = useMemo(
    () =>
      notes.filter(
        (n) =>
          (!search ||
            `${n.title} ${n.description} ${n.tags.join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (!difficulty || n.difficulty === difficulty),
      ),
    [notes, search, difficulty],
  );
  return (
    <section>
      <div className="section-header">
        <span>Learning library</span>
        <h1>Programming notes that make concepts click.</h1>
        <p>
          Search clear, practical notes created and published from the admin
          workspace.
        </p>
      </div>
      <div className="note-filters panel">
        <input
          placeholder="Search notes, tags, concepts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">All difficulties</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
      </div>
      {loading ? (
        <p className="notice">Loading notes...</p>
      ) : filtered.length ? (
        <div className="note-grid">
          {filtered.map((n) => (
            <article className="note-card" key={n._id}>
              {n.thumbnail && <img src={absoluteAsset(n.thumbnail)} alt="" />}
              <div>
                <div className="chips">
                  <span>{n.category}</span>
                  <span>{n.difficulty}</span>
                </div>
                <h2>{n.title}</h2>
                <p>{n.description}</p>
                <div className="chips">
                  {n.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <div className="card-actions">
                  <Link className="btn primary" to={`/notes/${n.slug}`}>
                    Read note
                  </Link>
                  <DownloadPdfButton slug={n.slug} className="btn ghost" />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="notice">No notes found. Try another search.</p>
      )}
    </section>
  );
}
