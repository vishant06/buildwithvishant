import assert from "node:assert/strict";
import { test } from "node:test";
import { createZip, readZip } from "../src/workspace/zip.js";
import { LIMITS } from "@shared/workspace/core.js";

test("limits: 2 MB per file, 10 MB per project", () => {
  assert.equal(LIMITS.maxFileBytes, 2_000_000);
  assert.equal(LIMITS.maxProjectBytes, 10_000_000);
});

test("a ZIP with large files (1.5 MB each, 6 MB total) imports completely", async () => {
  const big = (n) => `// file ${n}\n` + "const x = 1234567890;\n".repeat(70_000);
  const entries = [1, 2, 3, 4].map((n) => ({ path: `src/big${n}.js`, content: big(n) }));
  assert.ok(entries[0].content.length > 1_400_000);
  const { files, skipped } = await readZip(await createZip(entries).arrayBuffer());
  assert.equal(skipped.length, 0);
  assert.equal(files.length, 4);
  assert.equal(files[3].content, entries[3].content);
});

test("files over the per-file limit are skipped with a reason; a project over the total limit is refused", async () => {
  const tooBig = "x".repeat(LIMITS.maxFileBytes + 1);
  const { files, skipped } = await readZip(await createZip([{ path: "a.txt", content: "ok" }, { path: "big.txt", content: tooBig }]).arrayBuffer());
  assert.deepEqual(files.map((f) => f.path), ["a.txt"]);
  assert.match(skipped[0].reason, /too large/);
  const chunk = "y".repeat(1_900_000);
  await assert.rejects(async () => readZip(await createZip([1, 2, 3, 4, 5, 6].map((n) => ({ path: `f${n}.txt`, content: chunk }))).arrayBuffer()), /allowed project size/);
});
