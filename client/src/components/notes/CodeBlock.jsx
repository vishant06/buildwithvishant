import { Check, Copy, Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import useCodeRunner from '../../hooks/useCodeRunner.js';
import { CODE_LANGUAGE_LABELS } from './blockTypes.js';
import OutputBlock from './OutputBlock.jsx';

// Only the languages we actually offer in the editor are registered, so the
// bundle doesn't ship every Prism grammar.
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rust);

// `runnable` adds a Run button (only when the language is supported by the
// execution backend). Off by default so other users of this component, like
// the AI chat, are unchanged.
export default function CodeBlock({
  language = 'javascript',
  content = '',
  title = '',
  runnable = false,
}) {
  const [copied, setCopied] = useState(false);

  const known =
    Object.prototype.hasOwnProperty.call(CODE_LANGUAGE_LABELS, language) &&
    language !== 'other';

  const { canRun, status, result, run, clear } = useCodeRunner({
    language,
    code: content,
  });

  const showRun = runnable && canRun;
  const running = status === 'running';
  const lineCount = content.split('\n').length;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — button simply
      // won't confirm; nothing else to do here.
    }
  };

  return (
    <div className="note-code-block">
      <div className="note-code-bar">
        <span className="note-code-lang">
          {title || CODE_LANGUAGE_LABELS[language] || language}
        </span>

        <div className="note-code-actions">
          <button
            type="button"
            className="note-code-copy"
            onClick={copyCode}
            aria-label={
              copied
                ? 'Code copied to clipboard'
                : 'Copy code to clipboard'
            }
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {showRun && (
            <button
              type="button"
              className={`note-code-run${running ? ' is-running' : ''}${
                status === 'success' ? ' is-success' : ''
              }${status === 'error' ? ' is-error' : ''}`}
              onClick={run}
              disabled={running}
              aria-busy={running}
              aria-label={running ? 'Running code' : 'Run code'}
              title={running ? 'Running…' : 'Run code'}
            >
              {running ? (
                <Loader2 size={14} className="note-code-spin" />
              ) : (
                <Play size={14} />
              )}
              <span>{running ? 'Running…' : 'Run'}</span>
            </button>
          )}
        </div>
      </div>

      {known ? (
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: 'transparent',
            padding: '16px 18px',
            fontSize: '0.86rem',
          }}
          codeTagProps={{ style: { fontFamily: 'inherit' } }}
          showLineNumbers={lineCount > 4}
          lineNumberStyle={{
            minWidth: '2.4em',
            paddingRight: '1em',
            color: '#475569',
            userSelect: 'none',
          }}
          wrapLongLines={false}
        >
          {content}
        </SyntaxHighlighter>
      ) : (
        <pre className="note-code-plain">
          <code>{content}</code>
        </pre>
      )}

      {showRun && result && (
        <OutputBlock
          embedded
          live
          variant={result.ok ? 'success' : 'error'}
          title={result.title}
          meta={result.meta}
          content={
            result.empty
              ? 'Execution completed with no output.'
              : result.text
          }
          onClear={clear}
        />
      )}
    </div>
  );
}