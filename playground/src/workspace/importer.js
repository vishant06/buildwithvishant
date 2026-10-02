import { LIMITS, WorkspaceError, byteLength, validateName } from "@shared/workspace/core.js";
import { readZip } from "./zip.js";

// Turns files picked by the user into workspace content. Nothing is executed;
// everything is size-limited and must decode as UTF-8 text.

const readText = async (file) => {
  if (file.size > LIMITS.maxFileBytes) throw new WorkspaceError(`"${file.name}" is too large (max ${Math.round(LIMITS.maxFileBytes / 1000)} KB per file).`);
  const buffer = await file.arrayBuffer();
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new WorkspaceError(`"${file.name}" is not a text file.`);
  }
  if (text.includes("\u0000")) throw new WorkspaceError(`"${file.name}" is not a text file.`);
  if (byteLength(text) > LIMITS.maxFileBytes) throw new WorkspaceError(`"${file.name}" is too large.`);
  return text;
};

// If every path starts with the same folder ("proj/..."), drop it and use it as the project name.
export const stripCommonRoot = (files) => {
  if (!files.length || !files.every((file) => file.path.includes("/"))) return { files, root: "" };
  const root = files[0].path.split("/")[0];
  if (!files.every((file) => file.path.startsWith(`${root}/`))) return { files, root: "" };
  return { files: files.map((file) => ({ ...file, path: file.path.slice(root.length + 1) })), root };
};

// Returns { kind: "zip", name, files, skipped } or { kind: "files", files: [{ name, content }], skipped }.
export const readUploads = async (fileList) => {
  const picked = [...fileList];
  const zip = picked.find((file) => /\.zip$/i.test(file.name));
  if (zip) {
    if (zip.size > LIMITS.maxProjectBytes * 4) throw new WorkspaceError("That ZIP file is too large.");
    const { files, skipped } = await readZip(await zip.arrayBuffer());
    if (!files.length) throw new WorkspaceError("The ZIP did not contain any supported text files.");
    const stripped = stripCommonRoot(files);
    let name = stripped.root || zip.name.replace(/\.zip$/i, "");
    try {
      name = validateName(name, "Project name");
    } catch {
      name = "Imported project";
    }
    return { kind: "zip", name, files: stripped.files, skipped };
  }
  const files = [];
  const skipped = [];
  for (const file of picked) {
    try {
      files.push({ name: validateName(file.name, "File name"), content: await readText(file) });
    } catch (error) {
      skipped.push({ path: file.name, reason: error.message });
    }
  }
  if (!files.length) throw new WorkspaceError(skipped[0]?.reason || "No files were added.");
  return { kind: "files", files, skipped };
};
