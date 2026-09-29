// Minimal markdown handling: just enough to render AI replies properly —
// split on fenced code blocks (```lang\n...\n```) and treat everything
// else as plain paragraph text. Full markdown (tables, bold, links) isn't
// attempted; it's a poor return on complexity for a chat transcript.
export const splitIntoSegments = (content = "") => {
  const segments = [];
  const fenceRe = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fenceRe.exec(content))) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: "text", content: text });
    }
    segments.push({ type: "code", language: match[1] || "text", content: match[2].replace(/\n$/, "") });
    lastIndex = fenceRe.lastIndex;
  }
  const rest = content.slice(lastIndex).trim();
  if (rest) segments.push({ type: "text", content: rest });
  return segments.length ? segments : [{ type: "text", content }];
};
