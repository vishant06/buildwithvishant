import assert from "node:assert/strict";
import { test } from "node:test";
import * as S from "../src/workspace/state.js";

test("a note's code example becomes a NEW, unsaved workspace holding only that file", () => {
  const ws = S.workspaceFromExample({ documentTitle: "Recursion basics", title: "Factorial", language: "python", code: "def f(n):\n    return 1 if n < 2 else n * f(n - 1)\nprint(f(5))\n" });
  assert.equal(ws.projectId, null);
  assert.equal(ws.serverUpdatedAt, null);
  assert.equal(S.isProjectDirty(ws), true, "nothing is marked as saved");
  assert.deepEqual(ws.nodes.filter((n) => n.type === "file").length, 1);
  assert.equal(ws.name, "Recursion basics - Factorial");
  assert.match(S.entryPath(ws), /\.py$/);
});

test("Java examples get a file name that matches the public class", () => {
  const ws = S.workspaceFromExample({ documentTitle: "Perms", language: "java", code: "public class PrintPerm {\n  public static void main(String[] a) {}\n}\n" });
  assert.equal(S.entryPath(ws), "PrintPerm.java");
  assert.equal(S.workspaceFromExample({ documentTitle: "x", language: "java", code: "class Helper {}" }).nodes[0].path, "Helper.java");
});

test("web examples replace the template with a single page; oversized or odd input is refused, never half-applied", () => {
  const ws = S.workspaceFromExample({ documentTitle: "Page", language: "web", code: "<h1>Hello</h1>" });
  assert.equal(S.entryPath(ws), "index.html");
  assert.equal(ws.nodes.length, 1);
  assert.throws(() => S.workspaceFromExample({ documentTitle: "Big", language: "python", code: "x".repeat(2_100_000) }), /too large/);
});

test("opening an example never touches other workspaces (pure function, returns a fresh object)", () => {
  const before = S.templateWorkspace("python");
  const snapshot = JSON.stringify(before);
  S.workspaceFromExample({ documentTitle: "x", language: "python", code: "print(1)" });
  assert.equal(JSON.stringify(before), snapshot);
});
