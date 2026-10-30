// Related-note scoring from metadata only (no PDF is opened). Candidates come from one indexed
// query; ranking happens here so it stays cheap and easy to test.
const norm = (value) => String(value || '').trim().toLowerCase();
const words = (value) => new Set(norm(value).split(/[^a-z0-9+#]+/).filter((w) => w.length > 2));

export const scoreRelated = (current, candidate) => {
  let score = 0;
  if (norm(candidate.subject) && norm(candidate.subject) === norm(current.subject)) score += 6;
  if (norm(candidate.category) === norm(current.category)) score += 3;
  if (norm(current.subjectCode) && norm(candidate.subjectCode) === norm(current.subjectCode)) score += 4;
  if (norm(current.course) && norm(candidate.course) === norm(current.course)) score += 2;
  if (norm(current.university) && norm(candidate.university) === norm(current.university)) score += 1;
  if (norm(current.semester) && norm(candidate.semester) === norm(current.semester)) score += 1;
  if (norm(current.language) && norm(candidate.language) === norm(current.language)) score += 2;
  if (norm(current.topic) && norm(candidate.topic) === norm(current.topic)) score += 3;
  const mine = new Set((current.tags || []).map(norm));
  score += 2 * (candidate.tags || []).filter((tag) => mine.has(norm(tag))).length;
  const a = words(`${current.title} ${current.description}`);
  const b = words(`${candidate.title} ${candidate.description}`);
  let overlap = 0;
  a.forEach((w) => { if (b.has(w)) overlap += 1; });
  score += Math.min(4, overlap * 0.5);
  // Real popularity is only a tie-breaker.
  score += Math.min(1, Math.log10(1 + (candidate.views || 0) + 2 * (candidate.bookmarks || 0)) / 4);
  return score;
};

export const rankRelated = (current, candidates, limit = 6) =>
  candidates
    .filter((candidate) => String(candidate._id) !== String(current._id) && candidate.slug !== current.slug)
    .map((candidate) => ({ candidate, score: scoreRelated(current, candidate) }))
    .sort((a, b) => b.score - a.score || new Date(b.candidate.createdAt || 0) - new Date(a.candidate.createdAt || 0))
    .slice(0, limit)
    .map((item) => item.candidate);
