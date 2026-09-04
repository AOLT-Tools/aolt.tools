import { describe, expect, it } from 'vitest';

import {
  extractGeminiCandidateText,
  generateGeminiJson,
  geminiGenerateContentUrl
} from '@aolt/integrations/gemini/json';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('Gemini JSON client', () => {
  it('builds the generateContent URL without embedding the API key', () => {
    expect(geminiGenerateContentUrl('gemini-2.5-flash-lite')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'
    );
  });

  it('extracts concatenated candidate text', () => {
    expect(
      extractGeminiCandidateText({
        candidates: [{ content: { parts: [{ text: '{"ok":' }, { text: 'true}' }] } }]
      })
    ).toBe('{"ok":true}');
  });

  it('sends the key in a header and returns parsed JSON', async () => {
    let requestedUrl = '';
    let requestedHeaders: HeadersInit | undefined;
    let requestedBody: unknown;
    const result = await generateGeminiJson({
      apiKey: 'secret-key',
      prompt: 'HP 560045',
      systemInstruction: 'Return JSON.',
      responseSchema: { type: 'object' },
      fetchImpl: (async (url, init) => {
        requestedUrl = String(url);
        requestedHeaders = init?.headers;
        requestedBody = init?.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: '{"pincode":"560045"}' }] } }]
        });
      }) as typeof fetch
    });

    expect(result).toEqual({ pincode: '560045' });
    expect(requestedUrl).not.toContain('secret-key');
    expect(JSON.stringify(requestedHeaders)).toContain('secret-key');
    expect(requestedBody).toMatchObject({
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: { type: 'object' }
      }
    });
  });

  it('returns null when the model response is not JSON', async () => {
    const result = await generateGeminiJson({
      apiKey: 'secret-key',
      prompt: 'hello',
      fetchImpl: (async () =>
        jsonResponse({
          candidates: [{ content: { parts: [{ text: 'not json' }] } }]
        })) as typeof fetch
    });
    expect(result).toBeNull();
  });
});
