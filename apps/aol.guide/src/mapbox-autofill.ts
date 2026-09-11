import {
  loadMapboxSearchJs,
  type MapboxSearchJs
} from './mapboxSearchJs.js';

const statusEl = document.querySelector<HTMLElement>('#status');
const resultEl = document.querySelector<HTMLElement>('#result');
const searchBoxHost = document.querySelector<HTMLElement>('#searchbox-host');

void start();

async function start() {
  const token = (import.meta.env.AOL_GUIDE_MAPBOX_TOKEN || '').trim();
  if (!token) {
    setStatus(
      'AOL_GUIDE_MAPBOX_TOKEN is missing. Put a pk. token in apps/aol.guide/.env.local and restart Vite.',
      false
    );
    return;
  }
  if (!token.startsWith('pk.')) {
    setStatus(
      'Token is present but is not a public pk. token. Address Autofill in the browser needs a public token.',
      false
    );
    return;
  }

  const probe = await probeSearchBoxFromBrowser(token);
  if (!probe.ok) {
    setStatus(
      'Public token loaded, but Mapbox Search Box failed from the browser.\n' +
        probe.detail,
      false
    );
    return;
  }

  try {
    const searchJs = await loadMapboxSearchJs();
    searchJs.autofill({
      accessToken: token,
      options: { country: 'IN', language: 'en' }
    });
    mountSearchBox(searchJs, token);
    setStatus(
      'Public token loaded in the browser.\n' +
        probe.detail +
        '\nType in Address or Search Box below; pick a suggestion.',
      true
    );
  } catch (error) {
    setStatus(
      probe.detail +
        '\nMapbox Search JS failed to load: ' +
        (error instanceof Error ? error.message : 'unknown error'),
      false
    );
  }
}

function mountSearchBox(searchJs: MapboxSearchJs, token: string) {
  if (!searchBoxHost) return;
  const box = new searchJs.MapboxSearchBox();
  box.accessToken = token;
  box.options = {
    language: 'en',
    country: 'IN'
  };
  box.addEventListener('retrieve', (event: Event) => {
    const detail = (event as CustomEvent).detail as unknown;
    showResult(detail);
  });
  searchBoxHost.replaceChildren(box);
}

function showResult(detail: unknown) {
  if (!resultEl) return;
  resultEl.textContent = JSON.stringify(redactAccessTokens(detail), null, 2);
}

function redactAccessTokens(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.includes('access_token=')
      ? value.replace(/access_token=[^&]+/g, 'access_token=REDACTED')
      : value;
  }
  if (Array.isArray(value)) return value.map(redactAccessTokens);
  if (!value || typeof value !== 'object') return value;
  const copy: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    copy[key] = key.toLowerCase().includes('token')
      ? '[redacted]'
      : redactAccessTokens(entry);
  }
  return copy;
}

async function probeSearchBoxFromBrowser(
  token: string
): Promise<{ ok: boolean; detail: string }> {
  const url = new URL('https://api.mapbox.com/search/searchbox/v1/suggest');
  url.searchParams.set('q', 'HSR Layout Bengaluru');
  url.searchParams.set('access_token', token);
  url.searchParams.set('session_token', crypto.randomUUID());
  url.searchParams.set('country', 'in');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', '5');
  try {
    const response = await fetch(url);
    const payload = (await response.json()) as {
      suggestions?: unknown[];
      message?: string;
    };
    const count = Array.isArray(payload.suggestions)
      ? payload.suggestions.length
      : 0;
    if (!response.ok) {
      return {
        ok: false,
        detail:
          'HTTP ' +
          String(response.status) +
          (payload.message ? ': ' + payload.message : '')
      };
    }
    return {
      ok: count > 0,
      detail:
        'Search Box suggest from this page: HTTP ' +
        String(response.status) +
        ', ' +
        String(count) +
        ' suggestions for “HSR Layout Bengaluru”.'
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        'Browser fetch to Mapbox failed: ' +
        (error instanceof Error ? error.message : 'unknown error')
    };
  }
}

function setStatus(message: string, ok: boolean) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('ok', ok);
  statusEl.classList.toggle('fail', !ok);
}
