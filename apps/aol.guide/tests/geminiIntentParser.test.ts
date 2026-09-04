import { describe, expect, it } from 'vitest';
import { GeminiIntentParser } from '../lib/geminiIntentParser.js';

function fakeFetch(output: object): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }]
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )) as typeof fetch;
}

describe('GeminiIntentParser', () => {
  it('normalizes Gemini output through application rules', async () => {
    const parser = new GeminiIntentParser({
      apiKey: 'test',
      now: new Date('2026-09-04T06:30:00.000Z'),
      fetchImpl: fakeFetch({
        courseCode: 'HP',
        pincode: '560045',
        radiusKm: 10,
        language: 'Hindi',
        datePreset: 'this_weekend'
      })
    });
    const result = await parser.parse('can you find happiness near that bangalore pin this weekend in hindi within 10 km');
    expect(result?.courseCode).toBe('HP');
    expect(result?.pincode).toBe('560045');
    expect(result?.radiusKm).toBe(10);
    expect(result?.language).toBe('Hindi');
    expect(result?.dateLabel).toBe('This weekend');
  });

  it('maps offline to in_person', async () => {
    const parser = new GeminiIntentParser({
      apiKey: 'test',
      fetchImpl: fakeFetch({
        courseCode: 'HP',
        deliveryMode: 'offline'
      })
    });
    const result = await parser.parse('happiness program offline');
    expect(result?.deliveryMode).toBe('in_person');
  });

  it('sends the API key in a header instead of the URL', async () => {
    let requestedUrl = '';
    let requestedHeaders: HeadersInit | undefined;
    const parser = new GeminiIntentParser({
      apiKey: 'secret-key',
      fetchImpl: (async (url, init) => {
        requestedUrl = String(url);
        requestedHeaders = init?.headers;
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({}) }] } }]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }) as typeof fetch
    });
    await parser.parse('HP 560045');
    expect(requestedUrl).not.toContain('secret-key');
    expect(JSON.stringify(requestedHeaders)).toContain('secret-key');
  });
});
