import { getSearchSuggestions } from './searchSuggestions.js';
import {
  loadMapboxSearchJs,
  locationFromMapboxRetrieve,
  type BrowserLocation
} from './mapboxSearchJs.js';

type SearchMode = 'in_person' | 'online';
type TimePreset =
  | 'anytime'
  | 'today'
  | 'tomorrow'
  | 'this_weekend'
  | 'next_7_days';

type InterpretationRow = {
  label: string;
  value: string;
};

type OfficialCourseListing = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  city: string;
  address: string;
  pincode: string;
  location: string;
  distanceKm: number | null;
  isOnline: boolean;
  languages: string[];
  teachers: string[];
  schedule: string;
  fee: string;
  registerUrl: string;
  detailUrl: string;
};

type SourceSearchResult = {
  source: string;
  label: string;
  url: string;
  filters: Record<string, string>;
  confidence: number;
  embeddable?: boolean;
  reason: string;
  unsupportedFilters: string[];
  listings?: OfficialCourseListing[];
  listingTotal?: number;
  listingError?: string;
};

type SearchResponse = {
  success: boolean;
  interpretation?: InterpretationRow[];
  sources?: SourceSearchResult[];
  messages?: string[];
  usedGemini?: boolean;
  error?: { message?: string };
};

const MODE_STORAGE_KEY = 'aol-guide-search-mode';
const TIME_STORAGE_KEY = 'aol-guide-online-time';

const searchForm = document.querySelector<HTMLFormElement>('#search-form');
const searchInput = document.querySelector<HTMLInputElement>('#query');
const searchSuggestions = document.querySelector<HTMLElement>('#search-suggestions');
const results = document.querySelector<HTMLElement>('#results');
const statusPill = document.querySelector<HTMLElement>('#status-pill');
const summaryStrip = document.querySelector<HTMLElement>('#summary-strip');
const exampleActions = document.querySelectorAll<HTMLElement>(
  '.example-links [data-query]'
);
const modeToggle = document.querySelector<HTMLElement>('#search-mode');
const locationControl = document.querySelector<HTMLElement>('#location-control');
const locationHost = document.querySelector<HTMLElement>('#location-host');
const timeControl = document.querySelector<HTMLElement>('#time-control');
const timeSelect = document.querySelector<HTMLSelectElement>('#time-preset');

let currentMode: SearchMode = readStoredMode();
let currentTimePreset: TimePreset = readStoredTime();
let selectedLocation: BrowserLocation | undefined;

let activeSuggestionIndex = -1;
let renderedSuggestions: string[] = [];

initializeSearchPage();

function initializeSearchPage() {
  if (!searchForm || !searchInput || !results || !statusPill) {
    return;
  }

  setStatus('');
  renderModeToggle();
  syncFilterSlot();
  if (timeSelect) timeSelect.value = currentTimePreset;
  void mountMapboxSearchBox();

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    hideSuggestions();
    void runSearch(searchInput.value);
  });

  searchInput.addEventListener('input', () => {
    renderSuggestions(searchInput.value);
  });

  searchInput.addEventListener('focus', () => {
    renderSuggestions(searchInput.value);
  });

  searchInput.addEventListener('keydown', (event) => {
    handleSuggestionKeyboard(event);
  });

  document.addEventListener('mousedown', (event) => {
    const target = event.target;
    if (!(target instanceof Node) || searchForm.contains(target)) return;
    hideSuggestions();
  });

  exampleActions.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      fillSearchInput(button.dataset.query || '');
    });
  });

  modeToggle?.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest('[data-mode]') : null;
    const mode = button instanceof HTMLElement ? parseMode(button.dataset.mode) : undefined;
    if (!mode || mode === currentMode) return;
    currentMode = mode;
    persistMode(mode);
    renderModeToggle();
    syncFilterSlot();
    if (searchInput.value.trim()) void runSearch(searchInput.value);
  });

  timeSelect?.addEventListener('change', () => {
    currentTimePreset = parseTimePreset(timeSelect.value) || 'anytime';
    persistTime(currentTimePreset);
    if (currentMode === 'online' && searchInput?.value.trim()) {
      void runSearch(searchInput.value);
    }
  });
}

function renderSuggestions(value: string) {
  if (!searchInput || !searchSuggestions) return;

  const suggestions = getSearchSuggestions(value, {
    locationLabel: currentMode === 'in_person' ? selectedLocation?.label : undefined
  });
  renderedSuggestions = suggestions;
  activeSuggestionIndex = -1;

  if (!suggestions.length) {
    hideSuggestions();
    return;
  }

  searchSuggestions.replaceChildren(
    ...suggestions.map((suggestion, index) =>
      suggestionButton(suggestion, index, value)
    )
  );
  searchSuggestions.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
}

function suggestionButton(
  suggestion: string,
  index: number,
  query: string
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'suggestion-option';
  button.id = 'search-suggestion-' + String(index);
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', 'false');
  button.innerHTML = highlightedSuggestion(suggestion, query);

  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    fillSearchInput(suggestion);
  });

  return button;
}

function highlightedSuggestion(suggestion: string, query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return escapeHtml(suggestion);

  const index = suggestion.toLowerCase().indexOf(trimmed.toLowerCase());
  if (index < 0) return escapeHtml(suggestion);

  return (
    escapeHtml(suggestion.slice(0, index)) +
    '<strong>' +
    escapeHtml(suggestion.slice(index, index + trimmed.length)) +
    '</strong>' +
    escapeHtml(suggestion.slice(index + trimmed.length))
  );
}

function handleSuggestionKeyboard(event: KeyboardEvent) {
  if (!searchInput || !searchSuggestions || searchSuggestions.hidden) return;

  if (event.key === 'Escape') {
    hideSuggestions();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setActiveSuggestion(
      Math.min(activeSuggestionIndex + 1, renderedSuggestions.length - 1)
    );
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    setActiveSuggestion(Math.max(activeSuggestionIndex - 1, -1));
    return;
  }

  if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
    event.preventDefault();
    fillSearchInput(renderedSuggestions[activeSuggestionIndex] || '');
  }
}

function setActiveSuggestion(index: number) {
  if (!searchInput || !searchSuggestions) return;

  activeSuggestionIndex = index;
  const options =
    searchSuggestions.querySelectorAll<HTMLButtonElement>('.suggestion-option');

  options.forEach((option, optionIndex) => {
    option.setAttribute('aria-selected', String(optionIndex === index));
  });

  if (index >= 0) {
    searchInput.setAttribute('aria-activedescendant', 'search-suggestion-' + index);
  } else {
    searchInput.removeAttribute('aria-activedescendant');
  }
}

function fillSearchInput(query: string) {
  if (!searchInput) return;
  searchInput.value = query;
  hideSuggestions();
  searchInput.focus();
}

function hideSuggestions() {
  if (!searchInput || !searchSuggestions) return;
  searchSuggestions.hidden = true;
  searchSuggestions.replaceChildren();
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.removeAttribute('aria-activedescendant');
  activeSuggestionIndex = -1;
  renderedSuggestions = [];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    return (
      {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character] || character
    );
  });
}

function setStatus(label: string, state: 'idle' | 'loading' | 'error' = 'idle') {
  if (!statusPill) return;
  statusPill.hidden = state === 'idle' || !label;
  statusPill.textContent = label;
  statusPill.dataset.state = state;
}

let searchRequestId = 0;
let searchAbort: AbortController | null = null;

async function runSearch(query: string) {
  if (!results) return;
  const trimmed = query.trim();
  if (!trimmed) return;

  searchAbort?.abort();
  const controller = new AbortController();
  searchAbort = controller;
  const requestId = ++searchRequestId;

  setStatus('Searching…', 'loading');
  if (summaryStrip) summaryStrip.hidden = true;
  results.replaceChildren(emptyNode('Searching…'));

  try {
    const payload = await fetchSearch(trimmed, controller.signal);
    if (requestId !== searchRequestId) return;
    if (!payload.success) {
      throw new Error(payload.error?.message || 'Search failed.');
    }
    renderMessages(payload.messages || []);
    renderSources(payload.sources || []);
    setStatus('');
  } catch (error) {
    if (controller.signal.aborted || requestId !== searchRequestId) return;
    results.replaceChildren(
      emptyNode(error instanceof Error ? error.message : 'Search failed.')
    );
    setStatus('');
  }
}

async function fetchSearch(
  query: string,
  signal: AbortSignal
): Promise<SearchResponse> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      query,
      mode: currentMode,
      datePreset: currentMode === 'online' ? currentTimePreset : undefined,
      location: currentMode === 'in_person' ? searchLocationCoords(selectedLocation) : undefined
    })
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      success: false,
      error: { message: response.ok ? 'Search failed.' : await response.text() }
    };
  }
  return (await response.json()) as SearchResponse;
}

function renderMessages(messages: string[]) {
  if (!summaryStrip) return;
  if (!messages.length) {
    summaryStrip.hidden = true;
    return;
  }
  summaryStrip.textContent = messages.join(' ');
  summaryStrip.hidden = false;
}

function renderSources(items: SourceSearchResult[]) {
  if (!results) return;
  if (!items.length) {
    results.replaceChildren(emptyNode('No matching programs. Try another search.'));
    return;
  }

  const nodes: HTMLElement[] = [];
  let moreUrl = '';

  for (const item of items) {
    const listings = item.listings || [];
    if (listings.length) {
      for (const listing of listings) {
        nodes.push(renderListingCard(listing));
      }
      if (
        typeof item.listingTotal === 'number' &&
        item.listingTotal > listings.length
      ) {
        moreUrl = item.url;
      }
      continue;
    }

    if (item.listingError) {
      nodes.push(emptyNode(item.listingError));
      continue;
    }

    if (
      item.source === 'aol' &&
      typeof item.listingTotal === 'number' &&
      item.listingTotal === 0
    ) {
      nodes.push(emptyNode('No matching programs nearby.'));
      continue;
    }

    nodes.push(renderOfficialLinkCard(item));
  }

  if (moreUrl) {
    nodes.push(moreResultsLink(moreUrl));
  }

  results.replaceChildren(...nodes);
}

function renderOfficialLinkCard(item: SourceSearchResult): HTMLElement {
  const card = document.createElement('article');
  card.className = 'result-card';
  makeCardClickable(card, item.url);

  const row = document.createElement('div');
  row.className = 'source-compact';
  const copy = document.createElement('div');
  const badge = document.createElement('span');
  badge.className =
    'badge' +
    (item.source === 'vvmvp'
      ? ' vvmvp-badge'
      : item.source === 'vds'
        ? ' vds-badge'
        : '');
  badge.textContent = sourceBadge(item.source);
  const title = document.createElement('h2');
  title.className = 'mt-1';
  title.textContent = item.label;
  copy.append(badge, title);
  const action = document.createElement('span');
  action.className = 'listing-link';
  action.textContent = 'Open';
  row.append(copy, action);
  card.append(row);
  return card;
}

function moreResultsLink(url: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'more-link';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = 'More on official site';
  return link;
}

function renderListingCard(item: OfficialCourseListing): HTMLElement {
  const card = document.createElement('article');
  card.className = 'result-card';
  const online = currentMode === 'online' || item.isOnline;

  const header = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = item.title;
  header.append(title);
  if (online) {
    const labels = document.createElement('div');
    labels.className = 'result-card-labels';
    const badge = document.createElement('span');
    badge.className = 'badge online-badge';
    badge.textContent = 'Online';
    labels.append(badge);
    header.append(labels);
  }

  const meta = document.createElement('div');
  meta.className = 'result-meta';
  appendMetaRow(meta, 'calendar', item.schedule);
  if (!online) appendMetaRow(meta, 'location', item.location);

  const secondary = document.createElement('div');
  secondary.className = 'result-meta-secondary';
  const secondaryParts = online
    ? [item.languages.join(', '), item.fee]
    : [
        typeof item.distanceKm === 'number' ? item.distanceKm.toFixed(1) + ' km' : '',
        item.languages.join(', '),
        item.fee
      ];
  for (const part of secondaryParts.filter(Boolean)) {
    const span = document.createElement('span');
    span.textContent = part;
    secondary.append(span);
  }

  card.append(header, meta);
  if (secondary.childElementCount) card.append(secondary);

  const url = item.registerUrl || item.detailUrl;
  if (url) makeCardClickable(card, url);
  return card;
}

function appendMetaRow(
  wrapper: HTMLElement,
  icon: 'calendar' | 'location',
  value: string
) {
  if (!value.trim()) return;
  const row = document.createElement('div');
  row.className = 'result-meta-item';
  const iconNode = document.createElement('span');
  iconNode.className = 'result-meta-icon';
  iconNode.setAttribute('aria-hidden', 'true');
  iconNode.innerHTML = iconSvg(icon);
  const text = document.createElement('span');
  text.textContent = value;
  row.append(iconNode, text);
  wrapper.append(row);
}

function makeCardClickable(card: HTMLElement, url: string) {
  card.dataset.clickable = 'true';
  card.tabIndex = 0;
  card.setAttribute('role', 'link');

  const open = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  card.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) return;
    open();
  });

  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
}

function iconSvg(icon: 'calendar' | 'location'): string {
  if (icon === 'calendar') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
}

function sourceBadge(source: string): string {
  if (source === 'vvmvp') return 'Ashram';
  if (source === 'vds') return 'Vaidic Puja';
  return 'Art of Living';
}

function emptyNode(label: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = label;
  return empty;
}

function renderModeToggle() {
  modeToggle?.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.mode === currentMode));
  });
}

function syncFilterSlot() {
  const inPerson = currentMode === 'in_person';
  if (locationControl) locationControl.hidden = !inPerson;
  if (timeControl) timeControl.hidden = inPerson;
}

async function mountMapboxSearchBox() {
  if (!locationHost) return;
  const token = (import.meta.env.AOL_GUIDE_MAPBOX_TOKEN || '').trim();
  const fallback = locationHost.querySelector<HTMLInputElement>('#location-fallback');
  if (!token.startsWith('pk.')) {
    if (fallback) fallback.placeholder = 'Mapbox token missing';
    return;
  }
  try {
    const searchJs = await loadMapboxSearchJs();
    const box = new searchJs.MapboxSearchBox();
    box.accessToken = token;
    box.placeholder = 'Location';
    box.options = { language: 'en', country: 'IN' };
    box.theme = {
      variables: {
        fontFamily: 'inherit',
        unit: '13px',
        padding: '0.5em 0.75em',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
        colorBackground: '#ffffff',
        colorBackgroundHover: '#fff7ed',
        colorText: '#0f172a',
        colorSecondary: '#475569',
        minWidth: 'min(18rem, calc(100vw - 2rem))'
      },
      cssText: [
        '.SearchBox{background:transparent;border:none;box-shadow:none;border-radius:0;min-width:0;width:100%;}',
        '.Input{background:transparent;color:#0f172a;padding:0.15em;}',
        '.Results,.ResultsList,.Suggestion{background:#ffffff;opacity:1;}',
        '.Results{color:#0f172a;}',
        '.SuggestionName,.SuggestionText,.Label{color:#0f172a;}',
        '.SuggestionDesc{color:#475569;}'
      ].join('')
    };
    box.addEventListener('retrieve', (event: Event) => {
      selectedLocation = locationFromMapboxRetrieve((event as CustomEvent).detail);
      if (searchInput?.value.trim()) void runSearch(searchInput.value);
    });
    box.addEventListener('clear', () => {
      selectedLocation = undefined;
    });
    locationHost.replaceChildren(box);
  } catch (error) {
    console.error('Mapbox Search Box failed to mount', error);
    if (fallback) fallback.placeholder = 'Location unavailable';
  }
}

function searchLocationCoords(location: BrowserLocation | undefined) {
  if (!location) return undefined;
  return {
    label: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    city: location.city
  };
}

function parseMode(value: string | undefined): SearchMode | undefined {
  return value === 'online' || value === 'in_person' ? value : undefined;
}

function parseTimePreset(value: string | undefined): TimePreset | undefined {
  return value === 'anytime' ||
    value === 'today' ||
    value === 'tomorrow' ||
    value === 'this_weekend' ||
    value === 'next_7_days'
    ? value
    : undefined;
}

function readStoredMode(): SearchMode {
  try {
    return parseMode(localStorage.getItem(MODE_STORAGE_KEY) || '') || 'in_person';
  } catch {
    return 'in_person';
  }
}

function persistMode(mode: SearchMode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures; the selected mode still applies for this visit.
  }
}

function readStoredTime(): TimePreset {
  try {
    return parseTimePreset(localStorage.getItem(TIME_STORAGE_KEY) || '') || 'anytime';
  } catch {
    return 'anytime';
  }
}

function persistTime(preset: TimePreset) {
  try {
    localStorage.setItem(TIME_STORAGE_KEY, preset);
  } catch {
    // Ignore storage failures; the selected range still applies for this visit.
  }
}
