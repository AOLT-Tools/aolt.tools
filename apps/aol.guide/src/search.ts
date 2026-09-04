import { getSearchSuggestions } from './searchSuggestions.js';

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

const searchForm = document.querySelector<HTMLFormElement>('#search-form');
const searchInput = document.querySelector<HTMLInputElement>('#query');
const searchSuggestions = document.querySelector<HTMLElement>('#search-suggestions');
const results = document.querySelector<HTMLElement>('#results');
const statusPill = document.querySelector<HTMLElement>('#status-pill');
const summaryStrip = document.querySelector<HTMLElement>('#summary-strip');
const exampleActions = document.querySelectorAll<HTMLElement>(
  '.example-links [data-query]'
);

let activeSuggestionIndex = -1;
let renderedSuggestions: string[] = [];

initializeSearchPage();

function initializeSearchPage() {
  if (!searchForm || !searchInput || !results || !statusPill) {
    return;
  }

  setStatus('');

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
}

function renderSuggestions(value: string) {
  if (!searchInput || !searchSuggestions) return;

  const suggestions = getSearchSuggestions(value);
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
    body: JSON.stringify({ query })
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

  const header = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = item.title;
  header.append(title);
  if (item.isOnline) {
    const labels = document.createElement('div');
    labels.className = 'result-card-labels';
    const online = document.createElement('span');
    online.className = 'badge online-badge';
    online.textContent = 'Online';
    labels.append(online);
    header.append(labels);
  }

  const meta = document.createElement('div');
  meta.className = 'result-meta';
  appendMetaRow(meta, 'calendar', item.schedule);
  appendMetaRow(meta, 'location', item.location);

  const secondary = document.createElement('div');
  secondary.className = 'result-meta-secondary';
  for (const part of [
    typeof item.distanceKm === 'number' ? item.distanceKm.toFixed(1) + ' km' : '',
    item.languages.join(', '),
    item.fee
  ].filter(Boolean)) {
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
