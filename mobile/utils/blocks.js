// Ported verbatim from client/src/components/notes/blockTypes.js so a note
// saved with only the legacy `content` + `codeExamples` fields (e.g. one
// created from the mobile admin form) still renders with real code blocks
// here, instead of a wall of plain text.
export const legacyToBlocks = (note) => {
  const blocks = [];
  (note?.content || "").split("\n").forEach((line) => {
    if (!line.trim()) return;
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, content: headingMatch[2] });
    } else {
      blocks.push({ type: "text", content: line });
    }
  });
  (note?.codeExamples || []).forEach((example) => {
    if (example?.title) blocks.push({ type: "heading", level: 4, content: example.title });
    blocks.push({ type: "code", language: example?.language || "javascript", content: example?.code || "" });
  });
  return blocks;
};

export const resolveBlocks = (note) => (note?.blocks?.length ? note.blocks : legacyToBlocks(note));
