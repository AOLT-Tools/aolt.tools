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
const interpretation = document.querySelector<HTMLElement>('#interpretation');
const resultsHeading = document.querySelector<HTMLElement>('#results-heading');
const resultsCount = document.querySelector<HTMLElement>('#results-count');
const exampleActions = document.querySelectorAll<HTMLElement>(
  '.example-links [data-query]'
);

let activeSuggestionIndex = -1;
let renderedSuggestions: string[] = [];

initializeSearchPage();

function initializeSearchPage() {
  if (!searchForm || !searchInput || !results || !statusPill || !summaryStrip) {
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

  setStatus('Searching', 'loading');
  hideResultCount();
  if (summaryStrip) summaryStrip.hidden = true;
  if (interpretation) interpretation.hidden = true;
  results.replaceChildren(emptyNode('Interpreting your search...'));

  try {
    const payload = await fetchSearch(trimmed, controller.signal);
    if (requestId !== searchRequestId) return;
    if (!payload.success) {
      throw new Error(payload.error?.message || 'Search failed.');
    }
    renderMessages(payload.messages || []);
    renderInterpretation(payload.interpretation || []);
    renderSources(payload.sources || []);
    setStatus(payload.usedGemini ? 'Gemini assisted' : '');
  } catch (error) {
    if (controller.signal.aborted || requestId !== searchRequestId) return;
    hideResultCount();
    if (interpretation) interpretation.hidden = true;
    results.replaceChildren(
      emptyNode(error instanceof Error ? error.message : 'Search failed.')
    );
    setStatus('');
  }
}

async function fetchSearch(query: string, signal: AbortSignal): Promise<SearchResponse> {
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

function renderInterpretation(rows: InterpretationRow[]) {
  if (!interpretation) return;
  if (!rows.length) {
    interpretation.hidden = true;
    interpretation.replaceChildren();
    return;
  }

  const heading = document.createElement('h2');
  heading.textContent = 'Interpreted search';
  const list = document.createElement('dl');
  for (const row of rows) {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.textContent = row.label;
    value.textContent = row.value;
    item.append(term, value);
    list.append(item);
  }
  interpretation.className = 'interpretation';
  interpretation.replaceChildren(heading, list);
  interpretation.hidden = false;
}

function renderSources(items: SourceSearchResult[]) {
  if (!results) return;
  if (!items.length) {
    hideResultCount();
    results.replaceChildren(
      emptyNode('No matching official source. Try a course, ashram, or puja search.')
    );
    return;
  }

  const nodes: HTMLElement[] = [];
  for (const item of items) {
    nodes.push(renderSourceCard(item));
    if (item.listingError && !item.listings?.length) {
      nodes.push(emptyNode(item.listingError));
    }
    for (const listing of item.listings || []) {
      nodes.push(renderListingCard(listing));
    }
    if (
      item.source === 'aol' &&
      typeof item.listingTotal === 'number' &&
      item.listingTotal === 0 &&
      !item.listingError
    ) {
      nodes.push(emptyNode('No matching programs on the official Art of Living search.'));
    }
  }

  results.replaceChildren(...nodes);
  renderResultCount(items);
}

function renderResultCount(items: SourceSearchResult[]) {
  if (!resultsHeading || !resultsCount) return;

  const listingSources = items.filter(
    (item) => typeof item.listingTotal === 'number' && !item.listingError
  );
  if (listingSources.length) {
    const shown = listingSources.reduce(
      (count, item) => count + (item.listings?.length || 0),
      0
    );
    const total = listingSources.reduce(
      (count, item) => count + (item.listingTotal || 0),
      0
    );
    resultsCount.textContent =
      total > shown
        ? 'Showing ' + String(shown) + ' of ' + formatCount(total) + ' listings'
        : formatCount(total) + (total === 1 ? ' listing' : ' listings');
    resultsHeading.hidden = false;
    return;
  }

  resultsCount.textContent =
    items.length === 1 ? '1 official source' : String(items.length) + ' official sources';
  resultsHeading.hidden = false;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-IN');
}

function renderSourceCard(item: SourceSearchResult): HTMLElement {
  const card = document.createElement('article');
  card.className =
    'result-card' + (item.listings?.length ? ' source-card' : '');

  const header = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = item.label;
  const labels = document.createElement('div');
  labels.className = 'result-card-labels';
  const badge = document.createElement('span');
  badge.className =
    'badge' +
    (item.source === 'vvmvp' ? ' vvmvp-badge' : item.source === 'vds' ? ' vds-badge' : '');
  badge.textContent = sourceBadge(item.source);
  labels.append(badge);
  if (typeof item.listingTotal === 'number' && !item.listingError) {
    const count = document.createElement('span');
    count.className = 'course-code';
    count.textContent = formatCount(item.listingTotal) + ' official listings';
    labels.append(count);
  }
  header.append(title, labels);

  const reason = document.createElement('p');
  reason.className = 'm-0 text-sm leading-6 text-stone-600';
  reason.textContent = item.reason;

  const filters = document.createElement('ul');
  filters.className = 'filter-list';
  for (const [key, value] of Object.entries(item.filters)) {
    const row = document.createElement('li');
    row.textContent = titleCase(key) + ': ' + value;
    filters.append(row);
  }

  card.append(header, reason);
  if (!item.listings?.length) card.append(filters);

  const url = document.createElement('p');
  url.className = 'source-url';
  url.textContent = item.url;
  if (!item.listings?.length) card.append(url);

  for (const note of item.unsupportedFilters) {
    const warning = document.createElement('p');
    warning.className = 'result-note';
    warning.textContent = note;
    card.append(warning);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const link = document.createElement('a');
  link.className = 'result-link';
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent =
    typeof item.listingTotal === 'number' && item.listingTotal > (item.listings?.length || 0)
      ? 'View all official results'
      : 'View official results';
  actions.append(link);

  if (item.embeddable && !item.listings?.length) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'preview-toggle';
    toggle.textContent = 'Preview official page';
    const frame = document.createElement('iframe');
    frame.className = 'source-preview';
    frame.title = item.label + ' preview';
    frame.hidden = true;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    toggle.addEventListener('click', () => {
      if (frame.hidden) {
        frame.src = item.url;
        frame.hidden = false;
        toggle.textContent = 'Hide preview';
      } else {
        frame.hidden = true;
        frame.removeAttribute('src');
        toggle.textContent = 'Preview official page';
      }
    });
    actions.append(toggle);
    card.append(actions, frame);
  } else {
    card.append(actions);
  }

  return card;
}

function renderListingCard(item: OfficialCourseListing): HTMLElement {
  const card = document.createElement('article');
  card.className = 'result-card';

  const header = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = item.title;
  const labels = document.createElement('div');
  labels.className = 'result-card-labels';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = 'Course';
  labels.append(badge);
  if (item.isOnline) {
    const online = document.createElement('span');
    online.className = 'badge online-badge';
    online.textContent = 'Online';
    labels.append(online);
  }
  header.append(title, labels);

  const meta = document.createElement('div');
  meta.className = 'result-meta';
  appendMetaRow(meta, 'calendar', item.schedule);
  appendMetaRow(meta, 'location', item.location);

  const secondary = document.createElement('div');
  secondary.className = 'result-meta-secondary';
  for (const part of [
    typeof item.distanceKm === 'number' ? item.distanceKm.toFixed(1) + ' km away' : '',
    item.languages.join(', '),
    item.teachers.join(', '),
    item.fee
  ].filter(Boolean)) {
    const span = document.createElement('span');
    span.textContent = part;
    secondary.append(span);
  }

  card.append(header, meta);
  if (secondary.childElementCount) card.append(secondary);

  const url = item.registerUrl || item.detailUrl;
  if (url) {
    makeCardClickable(card, url);
    const link = document.createElement('a');
    link.className = 'listing-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Register / details';
    link.addEventListener('click', (event) => event.stopPropagation());
    card.append(link);
  }

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

function titleCase(value: string): string {
  return value.replace(/(^|[_\s])([a-z])/g, (_, prefix: string, letter: string) => {
    return (prefix === '_' ? ' ' : prefix) + letter.toUpperCase();
  });
}

function hideResultCount() {
  if (!resultsHeading || !resultsCount) return;
  resultsHeading.hidden = true;
  resultsCount.textContent = '';
}

function emptyNode(label: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = label;
  return empty;
}
