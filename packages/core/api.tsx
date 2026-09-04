export type ApiRequest = {
  method?: string;
  headers: {
    cookie?: string;
    [key: string]: string | string[] | undefined;
  };
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  setHeader: (name: string, value: string | string[]) => void;
  getHeader: (name: string) => number | string | string[] | undefined;
  end: (body?: string | Buffer | Uint8Array) => void;
};

export function firstQueryValue(req: ApiRequest, name: string): string {
  const value = req.query[name];
  if (Array.isArray(value)) {
    return String(value[0] || '');
  }
  return String(value || '');
}

export function headerValue(headers: ApiRequest['headers'], name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return String(value[0] || '');
  }
  return String(value || '');
}

export function bodyAsBuffer(body: unknown): Buffer {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === 'string') {
    return Buffer.from(body, 'utf8');
  }

  if (body == null) {
    return Buffer.alloc(0);
  }

  return Buffer.from(JSON.stringify(body) ?? '', 'utf8');
}

function assertMaxBytes(size: number, maxBytes: number): void {
  if (size > maxBytes) {
    throw new Error('REQUEST_BODY_TOO_LARGE');
  }
}

export async function readRawBody(req: ApiRequest, maxBytes: number): Promise<Buffer> {
  const explicitRawBody = (req as ApiRequest & { rawBody?: unknown }).rawBody;
  if (explicitRawBody !== undefined) {
    const rawBody = bodyAsBuffer(explicitRawBody);
    assertMaxBytes(rawBody.byteLength, maxBytes);
    return rawBody;
  }

  const stream = req as ApiRequest & AsyncIterable<unknown>;
  if (typeof stream[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of stream) {
      const buffer = bodyAsBuffer(chunk);
      totalBytes += buffer.byteLength;
      assertMaxBytes(totalBytes, maxBytes);
      chunks.push(buffer);
    }
    return Buffer.concat(chunks, totalBytes);
  }

  if (req.body !== undefined) {
    const rawBody = bodyAsBuffer(req.body);
    assertMaxBytes(rawBody.byteLength, maxBytes);
    return rawBody;
  }

  return Buffer.alloc(0);
}
