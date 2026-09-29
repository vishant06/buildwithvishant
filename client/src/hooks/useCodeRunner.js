import { useCallback, useEffect, useRef, useState } from 'react';
import { getExecutionLanguage } from '../components/notes/executionLanguages.js';
import request from '../services/api.js';

// The server gives the execution provider 12s; this is a safety net so the
// button can never spin forever if the network itself hangs.
const CLIENT_TIMEOUT_MS = 20000;

// Turns the /playground/execute response into what the output panel shows.
// Same fields the Playground page reads: stdout, compileOutput, stderr,
// message, status, success.
const toDisplayResult = (data) => {
  const stdout = data.stdout || '';
  const stderr = data.stderr || '';
  const compileOutput = data.compileOutput || '';
  const message = data.message || '';

  if (data.success) {
    const text = [stdout, stderr].filter(Boolean).join('\n');
    return { ok: true, title: 'Output', text, empty: !text.trim() };
  }

  const isCompileError = /compil/i.test(data.status || '') || Boolean(compileOutput);
  const text = [stdout, compileOutput, stderr, message].filter(Boolean).join('\n');
  return {
    ok: false,
    title: isCompileError ? 'Compilation error' : 'Error',
    meta: data.status && data.status !== 'error' ? data.status : '',
    text: text.trim() ? text : data.status || 'The program exited with an error.'
  };
};

const toErrorResult = (message) => ({ ok: false, title: 'Error', text: message });

// Runs one code block through the existing execution API. `status` is
// 'idle' | 'running' | 'success' | 'error'; `result` is null until a run
// finishes (or is cleared).
export default function useCodeRunner({ language, code }) {
  const executionLanguage = getExecutionLanguage(language);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const runningRef = useRef(false);
  const controllerRef = useRef(null);

  // Abort an in-flight request if the block unmounts (e.g. the reader
  // navigates to another note mid-run).
  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(async () => {
    if (!executionLanguage || runningRef.current) return;
    runningRef.current = true;
    setStatus('running');

    const controller = new AbortController();
    controllerRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    try {
      const data = await request('/playground/execute', {
        method: 'POST',
        body: JSON.stringify({ language: executionLanguage, code }),
        signal: controller.signal
      });
      const next = toDisplayResult(data);
      setResult(next);
      setStatus(next.ok ? 'success' : 'error');
    } catch (error) {
      if (controller.signal.aborted && !timedOut) return; // unmounted
      const message =
        error.name === 'AbortError'
          ? 'Execution timed out. Please try again.'
          : error.message || 'Could not run the code.';
      setResult(toErrorResult(message));
      setStatus('error');
    } finally {
      clearTimeout(timer);
      runningRef.current = false;
    }
  }, [executionLanguage, code]);

  const clear = useCallback(() => {
    if (runningRef.current) return;
    setResult(null);
    setStatus('idle');
  }, []);

  return { canRun: Boolean(executionLanguage), status, result, run, clear };
}
