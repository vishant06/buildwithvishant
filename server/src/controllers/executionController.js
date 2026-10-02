import { executionLanguages } from '../config/playgroundLanguages.js';
import { buildProjectRequest } from '../utils/executionPayload.js';
import { WorkspaceError } from '../utils/workspaceCore.js';

const MAX_CODE_LENGTH = 100_000;
const MAX_INPUT_LENGTH = 20_000;

export const execute = async (req, res) => {
  const language = String(req.body.language || '');
  const stdin = String(req.body.stdin || '');

  const config = executionLanguages[language];

  if (!config) {
    return res.status(400).json({
      message: 'This language is not supported by the execution service.'
    });
  }

  if (stdin.length > MAX_INPUT_LENGTH) {
    return res.status(400).json({
      message: 'Code or standard input is too large.'
    });
  }

  // Two request shapes:
  //  - project:  { language, files: [{ path, content }], entryFile?, stdin }
  //  - classic:  { language, code, stdin }  (older clients and the mobile app)
  let files;
  let extra = {};
  let entry = config.filename;

  if (Array.isArray(req.body.files)) {
    try {
      const project = buildProjectRequest(config, language, req.body);
      files = project.payload.files;
      entry = project.entry;
      extra = Object.fromEntries(
        Object.entries(project.payload).filter(([key]) => key !== 'files')
      );
    } catch (error) {
      if (error instanceof WorkspaceError) {
        return res.status(422).json({
          message: error.message,
          errors: error.details || undefined
        });
      }
      console.error('Project payload error:', error);
      return res.status(400).json({ message: 'The project could not be read.' });
    }
  } else {
    const code = String(req.body.code || '');

    if (!code.trim() || code.length > MAX_CODE_LENGTH) {
      return res.status(400).json({
        message: 'Code or standard input is too large.'
      });
    }

    files = [{ name: config.filename, content: code }];
  }

  const baseUrl = (process.env.PISTON_URL || '').replace(/\/$/, '');

  if (!baseUrl) {
    return res.status(503).json({
      message: 'Code execution is not configured. Set PISTON_URL on the server.'
    });
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 12_000);

  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (process.env.PISTON_TOKEN) {
      headers.Authorization = 'Bearer ' + process.env.PISTON_TOKEN;
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,

      body: JSON.stringify({
        language: config.runtime,
        version: '*',

        files,

        ...extra,

        stdin,

        compile_timeout: 8_000,
        run_timeout: 3_000,

        compile_cpu_time: 8_000,
        run_cpu_time: 3_000,

        compile_memory_limit: 134_217_728,
        run_memory_limit: 67_108_864
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(502).json({
        message:
          data.message ||
          'The execution provider rejected the request.',
        provider: data
      });
    }

    // Cloudflare Worker returns:
    // {
    //   judge0Response: {
    //     stdout,
    //     stderr,
    //     compile_output,
    //     status: {
    //       id,
    //       description
    //     },
    //     time,
    //     memory,
    //     message
    //   }
    // }

    const result = data.judge0Response || data;

    const statusId = result.status?.id;

    const success = statusId === 3;

    return res.json({
      success,

      stdout: result.stdout || '',

      stderr: result.stderr || '',

      compileOutput: result.compile_output || '',

      status:
        result.status?.description ||
        'error',

      time: result.time ?? null,

      memory: result.memory ?? null,

      message: result.message || '',

      entry
    });

  } catch (error) {
    console.error('Execution error:', error);

    return res.status(502).json({
      message:
        error.name === 'AbortError'
          ? 'The execution service timed out.'
          : 'Unable to reach the execution service.'
    });

  } finally {
    clearTimeout(timeout);
  }
};