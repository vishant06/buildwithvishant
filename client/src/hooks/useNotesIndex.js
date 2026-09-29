import { useEffect, useState } from 'react';
import { loadNotesIndex, peekNotesIndex } from '../services/notesCache.js';

const EMPTY = [];

// Lightweight list of published notes (no blocks/content) — the same
// GET /notes response the Notes library page uses. Shared through the cache,
// so it's fetched once no matter how many notes the reader opens.
export default function useNotesIndex() {
  const [notes, setNotes] = useState(() => peekNotesIndex());
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    loadNotesIndex()
      .then((data) => {
        if (!active) return;
        setNotes(data);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { notes: notes || EMPTY, loading: notes === null && !error, error };
}
