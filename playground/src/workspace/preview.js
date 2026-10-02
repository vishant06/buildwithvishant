import { basename, dirname, extname, joinPath } from "@shared/workspace/core.js";

// Builds the sandboxed-iframe document for a "web" project from its files.
//  - index.html (or the entry .html file) is the page.
//  - <link rel="stylesheet" href="x.css"> and <script src="x.js"> that point at
//    project files are inlined, so multi-file web projects work offline.
//  - A root style.css / script.js that the page does not reference are still
//    applied (this is how projects from the single-file Playground behave).
// console.* and errors are forwarded to the Console panel via postMessage.

const BRIDGE =
  '<script>const send=(type,args)=>parent.postMessage({source:"vk-playground",type,text:args.map(a=>typeof a==="string"?a:JSON.stringify(a)).join(" ")},"*");["log","info","warn","error"].forEach(type=>{const original=console[type];console[type]=(...args)=>{send(type,args);original(...args)}});window.onerror=(message)=>send("error",[message]);<\/script>';

const escapeClose = (text, tag) => text.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);

const resolve = (from, ref) => {
  const clean = ref.split(/[?#]/)[0].replace(/^\.\//, "");
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(clean)) return null; // external URL
  const parts = (clean.startsWith("/") ? clean.slice(1) : joinPath(from, clean)).split("/");
  const out = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
};

export const buildPreview = (nodes, entryPath = "") => {
  const files = new Map(nodes.filter((node) => node.type === "file").map((node) => [node.path.toLowerCase(), node]));
  const htmlFiles = nodes.filter((node) => node.type === "file" && [".html", ".htm"].includes(extname(basename(node.path))));
  const page =
    htmlFiles.find((node) => node.path === entryPath) ||
    htmlFiles.find((node) => node.path.toLowerCase() === "index.html") ||
    htmlFiles[0];
  const dir = page ? dirname(page.path) : "";
  const used = new Set();
  const lookup = (ref) => {
    const path = resolve(dir, ref);
    return path ? files.get(path.toLowerCase()) : null;
  };

  let html = page ? page.content : "";
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const file = href && lookup(href);
    if (!file) return tag;
    used.add(file.path);
    return `<style>${escapeClose(file.content, "style")}</style>`;
  });
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
    const file = lookup(src);
    if (!file) return tag;
    used.add(file.path);
    const attrs = `${before} ${after}`.replace(/\s+/g, " ").trim();
    return `<script${attrs ? ` ${attrs}` : ""}>${escapeClose(file.content, "script")}</script>`;
  });

  const extraCss = ["style.css"].map((name) => files.get(name)).filter((file) => file && !used.has(file.path) && !dir);
  const extraJs = ["script.js"].map((name) => files.get(name)).filter((file) => file && !used.has(file.path) && !dir);
  const css = extraCss.map((file) => `<style>${escapeClose(file.content, "style")}</style>`).join("");
  const js = extraJs.map((file) => `<script>${escapeClose(file.content, "script")}</script>`).join("");

  const isDocument = /<html[\s>]|<body[\s>]|<!doctype/i.test(html);
  if (!isDocument) return `<!doctype html><html><head>${css}</head><body>${html}${BRIDGE}${js}</body></html>`;

  let doc = html;
  doc = /<head[^>]*>/i.test(doc) ? doc.replace(/<head[^>]*>/i, (m) => `${m}${BRIDGE}${css}`) : `${BRIDGE}${css}${doc}`;
  doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${js}</body>`) : `${doc}${js}`;
  return doc;
};
