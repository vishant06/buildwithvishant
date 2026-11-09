import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupConversations, groupLabel, historyForApi } from '../src/lib/history.js';
import { parseMarkdown, parseTextBlocks, splitCodeFences } from '../src/lib/markdownBlocks.js';

test('code fences: closed, unclosed (while a reply is cut off) and language labels', () => {
  const parts = splitCodeFences('Intro\n```js\nconst a = 1;\n```\nMiddle\n```python\nprint(1)');
  assert.deepEqual(parts.map((p) => p.type), ['text', 'code', 'text', 'code']);
  assert.equal(parts[1].language, 'js');
  assert.equal(parts[1].code, 'const a = 1;');
  assert.equal(parts[3].code, 'print(1)');
  assert.deepEqual(splitCodeFences('no code here'), [{ type: 'text', text: 'no code here' }]);
});

test('blocks: headings, lists, quotes, rules, paragraphs', () => {
  const blocks = parseTextBlocks('# Title\nSome **bold** text\ncontinues here\n\n- one\n- two\n  wrapped\n\n1. first\n2) second\n\n> quoted\n> more\n\n---\nEnd');
  assert.deepEqual(blocks.map((b) => b.type), ['heading', 'p', 'list', 'list', 'quote', 'hr', 'p']);
  assert.equal(blocks[1].text, 'Some **bold** text continues here');
  assert.deepEqual(blocks[2], { type: 'list', ordered: false, start: 1, items: ['one', 'two wrapped'] });
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[4].text, 'quoted more');
});

test('tables: header, alignment and rows', () => {
  const [table] = parseTextBlocks('| Name | Big-O | Notes |\n|:--|:-:|--:|\n| Binary search | O(log n) | sorted |\n| Linear | O(n) | any |');
  assert.equal(table.type, 'table');
  assert.deepEqual(table.header, ['Name', 'Big-O', 'Notes']);
  assert.deepEqual(table.align, ['left', 'center', 'right']);
  assert.deepEqual(table.rows[0], ['Binary search', 'O(log n)', 'sorted']);
  assert.equal(parseTextBlocks('a | b')[0].type, 'p');
});

test('HTML is never interpreted (it stays plain text for the renderer to escape)', () => {
  const [block] = parseMarkdown('<img src=x onerror=alert(1)> <script>x</script>');
  assert.equal(block.type, 'p');
  assert.match(block.text, /<script>/);
});

test('conversation grouping by day, search and ordering', () => {
  const now = new Date(2026, 9, 30, 15, 0);
  const at = (days, hour = 10) => new Date(2026, 9, 30 - days, hour).toISOString();
  const chats = [
    { _id: 'a', title: 'Binary search', updatedAt: at(0) }, { _id: 'b', title: 'Recursion', updatedAt: at(1) }, { _id: 'c', title: 'SQL joins', updatedAt: at(5) },
    { _id: 'd', title: 'Old chat', updatedAt: at(20) }, { _id: 'e', title: 'Ancient', createdAt: at(90) }, { _id: 'f', title: 'Later today', updatedAt: at(0, 14) }
  ];
  const groups = groupConversations(chats, { now });
  assert.deepEqual(groups.map((g) => g.label), ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older']);
  assert.deepEqual(groups[0].chats.map((c) => c._id), ['f', 'a']);
  assert.deepEqual(groupConversations(chats, { now, query: 'SQL' }).flatMap((g) => g.chats.map((c) => c._id)), ['c']);
  assert.equal(groupLabel(undefined, now), 'Older');
});

test('history sent to the API drops failed replies and caps the length', () => {
  const messages = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}`, time: 'x' }));
  messages.push({ role: 'assistant', content: 'Sorry, error', error: true });
  const history = historyForApi(messages);
  assert.equal(history.length, 8);
  assert.ok(history.every((m) => Object.keys(m).join() === 'role,content' && !m.content.includes('Sorry')));
});
