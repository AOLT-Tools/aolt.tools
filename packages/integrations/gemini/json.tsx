import { withTimeout } from '@aolt/core/retry';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const DEFAULT_GEMINI_TIMEOUT_MS = 7000;

export type GeminiJsonOptions = {
  apiKey: string;
  prompt: string;
  model?: string;
  systemInstruction?: string;
  responseSchema?: unknown;
  temperature?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function geminiGenerateContentUrl(model: string): string {
  return (
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) +
    ':generateContent'
  );
}

export function extractGeminiCandidateText(payload: unknown): string {
  const candidates = readRecord(payload)?.candidates;
  if (!Array.isArray(candidates)) return '';
  const content = readRecord(candidates[0])?.content;
  const parts = readRecord(content)?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => {
      const text = readRecord(part)?.text;
      return typeof text === 'string' ? text : '';
    })
    .join('')
    .trim();
}

export async function generateGeminiJson(
  options: GeminiJsonOptions
): Promise<unknown | null> {
  const apiKey = options.apiKey.trim();
  const prompt = options.prompt.trim();
  if (!apiKey || !prompt) return null;

  const model = options.model || DEFAULT_GEMINI_MODEL;
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || DEFAULT_GEMINI_TIMEOUT_MS;

  try {
    const response = await withTimeout(
      (signal) =>
        fetchImpl(geminiGenerateContentUrl(model), {
          method: 'POST',
          signal,
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            ...(options.systemInstruction
              ? {
                  systemInstruction: {
                    parts: [{ text: options.systemInstruction }]
                  }
                }
              : {}),
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: options.temperature ?? 0,
              responseMimeType: 'application/json',
              ...(options.responseSchema
                ? { responseSchema: options.responseSchema }
                : {})
            }
          })
        }),
      timeoutMs,
      'GEMINI_TIMEOUT'
    );

    if (!response.ok) return null;
    const text = extractGeminiCandidateText(await response.json());
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
