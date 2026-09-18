import {
  COURSE_CATEGORY_ORDER,
  COURSE_FILTER_ORDER,
  courseCategoryLabel,
  nextAolRadiusKm,
  parseCourseFilter,
  type CourseCategoryId,
  type CourseFilterId
} from '../lib/courseCategories.js';
import {
  loadMapboxSearchJs,
  locationFromMapboxRetrieve,
  type BrowserLocation
} from './mapboxSearchJs.js';

type SearchSource = 'aol' | 'vvmvp' | 'vds';
type SearchMode = 'in_person' | 'online';
type TimePreset =
  | 'anytime'
  | 'today'
  | 'tomorrow'
  | 'this_weekend'
  | 'next_7_days';

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
  courseTypeId?: string;
  category?: string;
};

type SourceSearchResult = {
  source: string;
  label: string;
  url: string;
  filters: Record<string, string>;
  listings?: OfficialCourseListing[];
  listingTotal?: number;
  listingError?: string;
};

type SearchResponse = {
  success: boolean;
  sources?: SourceSearchResult[];
  messages?: string[];
  error?: { message?: string };
};

const SOURCE_STORAGE_KEY = 'aol-guide-search-source';
const MODE_STORAGE_KEY = 'aol-guide-search-mode';
const TIME_STORAGE_KEY = 'aol-guide-online-time';
const CATEGORY_STORAGE_KEY = 'aol-guide-course-category';
const FIRST_RADIUS_KM = 3;

const results = document.querySelector<HTMLElement>('#results');
const statusPill = document.querySelector<HTMLElement>('#status-pill');
const summaryStrip = document.querySelector<HTMLElement>('#summary-strip');
const sourceToggle = document.querySelector<HTMLElement>('#search-source');
const modeToggle = document.querySelector<HTMLElement>('#search-mode');
const locationControl = document.querySelector<HTMLElement>('#location-control');
const locationHost = document.querySelector<HTMLElement>('#location-host');
const timeControl = document.querySelector<HTMLElement>('#time-control');
const timeSelect = document.querySelector<HTMLSelectElement>('#time-preset');
const categoryChips = document.querySelector<HTMLElement>('#category-chips');

let currentSource: SearchSource = readStoredSource();
let currentMode: SearchMode = readStoredMode();
let currentTimePreset: TimePreset = readStoredTime();
let currentCategory: CourseFilterId = readStoredCategory();
let selectedLocation: BrowserLocation | undefined;
let currentRadiusKm = FIRST_RADIUS_KM;
let mergedListings: OfficialCourseListing[] = [];
let officialUrl = '';

initializeSearchPage();

function initializeSearchPage() {
  if (!results || !statusPill) return;

  setStatus('');
  renderSourceToggle();
  renderModeToggle();
  syncControls();
  renderCategoryChips();
  if (timeSelect) timeSelect.value = currentTimePreset;
  void mountMapboxSearchBox();
  renderIdleState();

  sourceToggle?.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest('[data-source]') : null;
    const source =
      button instanceof HTMLElement ? parseSource(button.dataset.source) : undefined;
    if (!source || source === currentSource) return;
    currentSource = source;
    persistSource(source);
    resetListings();
    renderSourceToggle();
    syncControls();
    renderCategoryChips();
    void runCatalogSearch();
  });

  modeToggle?.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest('[data-mode]') : null;
    const mode = button instanceof HTMLElement ? parseMode(button.dataset.mode) : undefined;
    if (!mode || mode === currentMode) return;
    currentMode = mode;
    persistMode(mode);
    resetListings();
    renderModeToggle();
    syncControls();
    void runCatalogSearch();
  });

  timeSelect?.addEventListener('change', () => {
    currentTimePreset = parseTimePreset(timeSelect.value) || 'anytime';
    persistTime(currentTimePreset);
    resetListings();
    void runCatalogSearch();
  });

  categoryChips?.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest('[data-category]') : null;
    const category =
      button instanceof HTMLElement
        ? parseCourseFilter(button.dataset.category)
        : undefined;
    if (!category || category === currentCategory) return;
    currentCategory = category;
    persistCategory(category);
    renderCategoryChips();
    renderMergedResults();
  });
}

function syncControls() {
  const courses = currentSource === 'aol';
  const inPerson = courses && currentMode === 'in_person';
  const online = courses && currentMode === 'online';
  if (modeToggle) modeToggle.hidden = !courses;
  if (locationControl) locationControl.hidden = !inPerson;
  if (timeControl) timeControl.hidden = !online;
  const filterSlot = document.querySelector<HTMLElement>('#filter-slot');
  if (filterSlot) filterSlot.hidden = !inPerson && !online;
  if (categoryChips) categoryChips.hidden = !courses;
}

function renderIdleState() {
  if (!results) return;
  if (currentSource !== 'aol') {
    results.replaceChildren(emptyNode('Loading official programs…'));
    void runCatalogSearch();
    return;
  }
  if (currentMode === 'in_person' && !selectedLocation) {
    results.replaceChildren(emptyNode('Pick a location to see programs nearby.'));
    return;
  }
  void runCatalogSearch();
}

let searchRequestId = 0;
let searchAbort: AbortController | null = null;

async function runCatalogSearch(options: { append?: boolean } = {}) {
  if (!results) return;
  if (currentSource === 'aol' && currentMode === 'in_person' && !selectedLocation) {
    results.replaceChildren(emptyNode('Pick a location to see programs nearby.'));
    return;
  }

  searchAbort?.abort();
  const controller = new AbortController();
  searchAbort = controller;
  const requestId = ++searchRequestId;
  const radiusKm =
    currentSource === 'aol' && currentMode === 'in_person'
      ? options.append
        ? currentRadiusKm
        : FIRST_RADIUS_KM
      : undefined;
  if (radiusKm && !options.append) currentRadiusKm = radiusKm;

  setStatus('Searching…', 'loading');
  if (!options.append) {
    if (summaryStrip) summaryStrip.hidden = true;
    results.replaceChildren(emptyNode('Searching…'));
  }

  try {
    const payload = await fetchCatalog(controller.signal, radiusKm);
    if (requestId !== searchRequestId) return;
    if (!payload.success) {
      throw new Error(payload.error?.message || 'Search failed.');
    }
    const source = payload.sources?.[0];
    officialUrl = source?.url || '';
    const incoming = source?.listings || [];
    mergedListings = options.append
      ? mergeListings(mergedListings, incoming)
      : incoming;
    if (source?.listingError && !mergedListings.length) {
      results.replaceChildren(emptyNode(source.listingError));
    } else {
      renderMessages(payload.messages || []);
      renderMergedResults(source);
    }
    setStatus('');
  } catch (error) {
    if (controller.signal.aborted || requestId !== searchRequestId) return;
    results.replaceChildren(
      emptyNode(error instanceof Error ? error.message : 'Search failed.')
    );
    setStatus('');
  }
}

async function fetchCatalog(
  signal: AbortSignal,
  radiusKm?: number
): Promise<SearchResponse> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      source: currentSource,
      mode: currentSource === 'aol' ? currentMode : undefined,
      datePreset:
        currentSource === 'aol' && currentMode === 'online'
          ? currentTimePreset
          : undefined,
      radiusKm,
      location:
        currentSource === 'aol' && currentMode === 'in_person'
          ? searchLocationCoords(selectedLocation)
          : undefined
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

function mergeListings(
  existing: OfficialCourseListing[],
  incoming: OfficialCourseListing[]
): OfficialCourseListing[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    const previous = byId.get(item.id);
    if (!previous || closerListing(item, previous)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((left, right) => {
    if (isFiniteDistance(left.distanceKm) && isFiniteDistance(right.distanceKm)) {
      return left.distanceKm - right.distanceKm;
    }
    if (isFiniteDistance(left.distanceKm)) return -1;
    if (isFiniteDistance(right.distanceKm)) return 1;
    return 0;
  });
}

function closerListing(
  candidate: OfficialCourseListing,
  current: OfficialCourseListing
): boolean {
  if (!isFiniteDistance(candidate.distanceKm)) return false;
  if (!isFiniteDistance(current.distanceKm)) return true;
  return candidate.distanceKm < current.distanceKm;
}

function isFiniteDistance(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function listingCategory(item: OfficialCourseListing): CourseCategoryId {
  return COURSE_CATEGORY_ORDER.includes(item.category as CourseCategoryId)
    ? (item.category as CourseCategoryId)
    : 'other';
}

function visibleListings(): OfficialCourseListing[] {
  if (currentCategory === 'all') return mergedListings;
  return mergedListings.filter((item) => listingCategory(item) === currentCategory);
}

function categoryCount(id: CourseFilterId): number {
  if (id === 'all') return mergedListings.length;
  return mergedListings.filter((item) => listingCategory(item) === id).length;
}

function renderCategoryChips() {
  if (!categoryChips) return;
  const searched = mergedListings.length > 0;
  const chips = COURSE_FILTER_ORDER.map((id) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-chip';
    button.dataset.category = id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(id === currentCategory));
    if (
      searched &&
      id !== currentCategory &&
      id !== 'all' &&
      categoryCount(id) === 0
    ) {
      button.classList.add('category-chip-empty');
    }
    button.textContent = courseCategoryLabel(id);
    return button;
  });
  const scroll = document.createElement('div');
  scroll.className = 'category-chips-scroll';
  scroll.append(...chips.filter((chip) => chip.dataset.category !== 'all'));
  const allChip = chips.find((chip) => chip.dataset.category === 'all');
  categoryChips.replaceChildren(scroll, ...(allChip ? [allChip] : []));
}

function renderMergedResults(source?: SourceSearchResult) {
  if (!results) return;
  renderCategoryChips();

  if (currentSource !== 'aol') {
    if (source?.listingError) {
      results.replaceChildren(emptyNode(source.listingError));
      return;
    }
    results.replaceChildren(
      source ? renderOfficialLinkCard(source) : emptyNode('No programs found.')
    );
    return;
  }

  const listings = visibleListings();
  const nodes: HTMLElement[] = [];
  nodes.push(resultsMetaNode(listings.length));

  if (!listings.length) {
    nodes.push(
      emptyNode(
        currentMode === 'in_person'
          ? 'No ' +
              courseCategoryLabel(currentCategory).toLowerCase() +
              ' programs within ' +
              String(currentRadiusKm) +
              ' km.'
          : 'No ' +
              courseCategoryLabel(currentCategory).toLowerCase() +
              ' programs in this date range.'
      )
    );
  } else if (currentCategory === 'all') {
    for (const category of COURSE_CATEGORY_ORDER) {
      const group = listings.filter((item) => listingCategory(item) === category);
      if (!group.length) continue;
      const heading = document.createElement('h2');
      heading.className = 'category-heading';
      heading.textContent = courseCategoryLabel(category);
      nodes.push(heading);
      for (const listing of group) nodes.push(renderListingCard(listing));
    }
  } else {
    for (const listing of listings) nodes.push(renderListingCard(listing));
  }

  const nextRadius = nextShowMoreRadius();
  if (nextRadius) nodes.push(showMoreButton(nextRadius));
  else if (officialUrl) nodes.push(moreResultsLink(officialUrl));

  results.replaceChildren(...nodes);
}

function resultsMetaNode(count: number): HTMLElement {
  const meta = document.createElement('div');
  meta.className = 'results-meta';
  const label = courseCategoryLabel(currentCategory);
  if (currentMode === 'in_person') {
    const place = selectedLocation?.city || selectedLocation?.label || 'this location';
    meta.textContent =
      label +
      ' · within ' +
      String(currentRadiusKm) +
      ' km · ' +
      place +
      ' · ' +
      String(count) +
      (count === 1 ? ' program' : ' programs');
  } else {
    meta.textContent =
      label + ' · ' + String(count) + (count === 1 ? ' program' : ' programs');
  }
  return meta;
}

function nextShowMoreRadius(): number | undefined {
  if (currentSource !== 'aol' || currentMode !== 'in_person') return undefined;
  return nextAolRadiusKm(currentRadiusKm);
}

function showMoreButton(radiusKm: number): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'more-link';
  button.textContent = 'Show more within ' + String(radiusKm) + ' km';
  button.addEventListener('click', () => {
    currentRadiusKm = radiusKm;
    void runCatalogSearch({ append: true });
  });
  return button;
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

function resetListings() {
  mergedListings = [];
  officialUrl = '';
  currentRadiusKm = FIRST_RADIUS_KM;
}

function renderSourceToggle() {
  sourceToggle?.querySelectorAll<HTMLButtonElement>('[data-source]').forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.source === currentSource));
  });
}

function renderModeToggle() {
  modeToggle?.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.mode === currentMode));
  });
}

function setStatus(label: string, state: 'idle' | 'loading' | 'error' = 'idle') {
  if (!statusPill) return;
  statusPill.hidden = state === 'idle' || !label;
  statusPill.textContent = label;
  statusPill.dataset.state = state;
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
    box.placeholder = 'Pick a location';
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
        '.SearchIcon{display:none;}',
        '.Input{background:transparent;color:#0f172a;padding:0.15em 0;}',
        '.Results,.ResultsList,.Suggestion{background:#ffffff;opacity:1;}',
        '.Results{color:#0f172a;}',
        '.SuggestionName,.SuggestionText,.Label{color:#0f172a;}',
        '.SuggestionDesc{color:#475569;}'
      ].join('')
    };
    box.addEventListener('retrieve', (event: Event) => {
      selectedLocation = locationFromMapboxRetrieve((event as CustomEvent).detail);
      resetListings();
      void runCatalogSearch();
    });
    box.addEventListener('clear', () => {
      selectedLocation = undefined;
      resetListings();
      renderIdleState();
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

function parseSource(value: string | undefined): SearchSource | undefined {
  return value === 'aol' || value === 'vvmvp' || value === 'vds' ? value : undefined;
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

function readStoredSource(): SearchSource {
  try {
    return parseSource(localStorage.getItem(SOURCE_STORAGE_KEY) || '') || 'aol';
  } catch {
    return 'aol';
  }
}

function persistSource(source: SearchSource) {
  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, source);
  } catch {
    // Ignore storage failures; the selected catalogue still applies for this visit.
  }
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

function readStoredCategory(): CourseFilterId {
  try {
    return parseCourseFilter(localStorage.getItem(CATEGORY_STORAGE_KEY) || '') || 'beginner';
  } catch {
    return 'beginner';
  }
}

function persistCategory(category: CourseFilterId) {
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, category);
  } catch {
    // Ignore storage failures; the selected category still applies for this visit.
  }
}
