// The one place that talks to the AI provider (Groq today). The general chat assistant and the
// document assistant both go through here, so keys, timeouts and error handling live once.
export class AiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'AiError';
  }
}

export const completeChat = async ({ messages, temperature = 0.7, maxTokens = 1000, timeoutMs = 30_000, fetchImpl = fetch }) => {
  if (!process.env.AI_API_KEY) throw new AiError(503, 'AI service is not configured yet. Add AI_API_KEY on the server to enable it.');
  const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  if (provider !== 'groq') throw new AiError(501, `The ${provider} adapter has not been configured yet.`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'llama-3.1-8b-instant', messages, temperature, max_tokens: maxTokens })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Groq response error:', data?.error?.message || response.status);
      throw new AiError(502, data?.error?.message || 'The AI service is temporarily unavailable. Please try again.');
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) throw new AiError(502, 'The AI service returned an empty response. Please try again.');
    return reply;
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error?.name === 'AbortError') throw new AiError(504, 'The AI service took too long to answer. Please try again.');
    console.error('Groq request failed:', error.message);
    throw new AiError(502, 'Unable to reach the AI service. Please try again.');
  } finally {
    clearTimeout(timer);
  }
};
