import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppError } from './errors.js';

export function queryValue(req: VercelRequest, name: string): string {
  const value = req.query[name];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

export function bodyRecord(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  throw new AppError('VALIDATION_ERROR', 'A JSON object body is required.', 400);
}

export function methodNotAllowed(res: VercelResponse, allow: string): never {
  res.setHeader('Allow', allow);
  throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
}

export async function rawBody(req: VercelRequest, maxBytes: number): Promise<Buffer> {
  const explicit = (req as VercelRequest & { rawBody?: unknown }).rawBody;
  if (explicit !== undefined) {
    const result = Buffer.isBuffer(explicit)
      ? explicit
      : Buffer.from(String(explicit), 'utf8');
    if (result.byteLength > maxBytes) {
      throw new AppError('VALIDATION_ERROR', 'Request body is too large.', 413);
    }
    return result;
  }
  const stream = req as VercelRequest & AsyncIterable<unknown>;
  if (typeof stream[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      size += buffer.byteLength;
      if (size > maxBytes) {
        throw new AppError('VALIDATION_ERROR', 'Request body is too large.', 413);
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks, size);
  }
  const body = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === 'string'
      ? Buffer.from(req.body)
      : Buffer.from(JSON.stringify(req.body || {}));
  if (body.byteLength > maxBytes) {
    throw new AppError('VALIDATION_ERROR', 'Request body is too large.', 413);
  }
  return body;
}
