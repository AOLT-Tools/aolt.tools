import {
  COURSE_CATEGORY_ORDER,
  courseCategoryLabel,
  nextAolRadiusKm,
  parseCourseCategories,
  parseCourseFilter,
  presentCourseCategories,
  resolveCourseCategory,
  serializeCourseCategories,
  type CourseCategoryId
} from '../lib/courseCategories.js';
import { vvmvpCategoryLabel } from '../lib/sources/vvmvpListings.js';
import {
  addCalendarDays,
  parseIsoDate,
  resolveOnlineTimePreset,
  todayInIndia,
  type OnlineTimePreset
} from '../lib/dateRanges.js';
import {
  LOCATION_SUGGEST_DEBOUNCE_MS,
  shouldSuggestLocationQuery,
  suggestMapboxTemporaryLocations,
  type BrowserLocation
} from './mapboxSearchJs.js';

type SearchSource = 'aol' | 'center' | 'vvmvp' | 'vds';
type SearchMode = 'in_person' | 'online';
type TimePreset = OnlineTimePreset;

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
  listingCategories?: string[];
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
const TIME_FROM_STORAGE_KEY = 'aol-guide-online-date-from';
const TIME_TO_STORAGE_KEY = 'aol-guide-online-date-to';
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];
const CATEGORY_STORAGE_KEY = 'aol-guide-course-category';
const ASHRAM_CATEGORY_STORAGE_KEY = 'aol-guide-ashram-category';
const FIRST_RADIUS_KM = 3;

const results = document.querySelector<HTMLElement>('#results');
const statusPill = document.querySelector<HTMLElement>('#status-pill');
const summaryStrip = document.querySelector<HTMLElement>('#summary-strip');
const sourceToggle = document.querySelector<HTMLElement>('#search-source');
const modeToggle = document.querySelector<HTMLElement>('#search-mode');
const locationControl = document.querySelector<HTMLElement>('#location-control');
const locationHost = document.querySelector<HTMLElement>('#location-host');
const timeControl = document.querySelector<HTMLElement>('#time-control');
const timeRangeControl = document.querySelector<HTMLButtonElement>('#time-range-control');
const timeRangeLabel = document.querySelector<HTMLElement>('#time-range-label');
const timeShortcut = document.querySelector<HTMLSelectElement>('#time-shortcut');
const timeCustomPanel = document.querySelector<HTMLElement>('#time-custom-panel');
const dateFromInput = document.querySelector<HTMLInputElement>('#date-from');
const dateToInput = document.querySelector<HTMLInputElement>('#date-to');
const categoryChips = document.querySelector<HTMLElement>('#category-chips');

let currentSource: SearchSource = readStoredSource();
let currentMode: SearchMode = readStoredMode();
let currentTimePreset: TimePreset = readStoredTime();
let customDateFrom = readStoredIsoDate(TIME_FROM_STORAGE_KEY);
let customDateTo = readStoredIsoDate(TIME_TO_STORAGE_KEY);
let selectedCategories = new Set<CourseCategoryId>(readStoredCategories());
let selectedAshramCategory = readStoredAshramCategory();
let ashramCategories: string[] = [];
let selectedLocation: BrowserLocation | undefined;
let currentRadiusKm = FIRST_RADIUS_KM;
let mergedListings: OfficialCourseListing[] = [];
let officialUrl = '';
let searchRequestId = 0;
let searchAbort: AbortController | null = null;
let timeCustomOpen = false;
let onlineRangeSelected = false;

initializeSearchPage();

function initializeSearchPage() {
  if (!results || !statusPill) return;

  setStatus('');
  renderSourceToggle();
  renderModeToggle();
  syncControls();
  renderCategoryChips();
  renderTimeControls();
  void mountLocationSearch();
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
    if (currentMode === 'online') onlineRangeSelected = false;
    renderModeToggle();
    syncControls();
    if (usesOnlineSearch() && !onlineRangeSelected) {
      showOnlineIdle();
      return;
    }
    void runCatalogSearch();
  });

  timeShortcut?.addEventListener('change', () => {
    const preset = parseTimePreset(timeShortcut.value);
    if (!preset) return;
    applyTimeShortcut(preset);
  });

  timeRangeControl?.addEventListener('click', () => {
    toggleCustomEditor();
  });

  dateFromInput?.addEventListener('change', () => {
    onDateInputsChanged();
  });

  dateToInput?.addEventListener('change', () => {
    onDateInputsChanged();
  });

  categoryChips?.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest('[data-category]') : null;
    const raw = button instanceof HTMLElement ? button.dataset.category : undefined;
    if (!raw) return;
    if (currentSource === 'vvmvp') {
      if (raw === selectedAshramCategory) return;
      selectedAshramCategory = raw;
      persistAshramCategory();
      renderCategoryChips();
      renderMergedResults();
      return;
    }
    const category = parseCourseFilter(raw);
    if (!category || selectedCategories.has(category)) return;
    selectedCategories = new Set([category]);
    persistCategories();
    renderCategoryChips();
    renderMergedResults();
  });
}

function syncControls() {
  const courses = currentSource === 'aol';
  const inPerson = usesLocationSearch();
  const online = usesOnlineSearch();
  if (modeToggle) modeToggle.hidden = !courses;
  if (locationControl) locationControl.hidden = !inPerson;
  if (timeControl) timeControl.hidden = !online;
  if (!online) timeCustomOpen = false;
  const filterSlot = document.querySelector<HTMLElement>('#filter-slot');
  if (filterSlot) filterSlot.hidden = !inPerson;
  renderTimeControls();
  if (categoryChips && currentSource !== 'aol' && currentSource !== 'vvmvp') {
    categoryChips.hidden = true;
    categoryChips.replaceChildren();
  }
}

function usesLocationSearch(): boolean {
  return currentSource === 'center' || (currentSource === 'aol' && currentMode === 'in_person');
}

function usesOnlineSearch(): boolean {
  return currentSource === 'aol' && currentMode === 'online';
}

function renderIdleState() {
  if (!results) return;
  if (currentSource === 'vvmvp' || currentSource === 'vds') {
    results.replaceChildren(emptyNode('Loading official programs…'));
    void runCatalogSearch();
    return;
  }
  if (usesLocationSearch() && !selectedLocation) {
    showLocationIdle();
    return;
  }
  if (usesOnlineSearch() && !onlineRangeSelected) {
    showOnlineIdle();
    return;
  }
  void runCatalogSearch();
}

function showLocationIdle() {
  if (summaryStrip) summaryStrip.hidden = true;
  setStatus('');
  if (categoryChips) {
    categoryChips.hidden = true;
    categoryChips.replaceChildren();
  }
  results?.replaceChildren(emptyNode('Pick a location to see programs nearby.'));
}

function showOnlineIdle() {
  if (summaryStrip) summaryStrip.hidden = true;
  setStatus('');
  if (categoryChips) {
    categoryChips.hidden = true;
    categoryChips.replaceChildren();
  }
  results?.replaceChildren(emptyNode('Pick a date range to see programs.'));
}

async function runCatalogSearch(options: { append?: boolean } = {}) {
  if (!results) return;
  if (usesLocationSearch() && !selectedLocation) {
    showLocationIdle();
    return;
  }
  if (usesOnlineSearch() && !onlineRangeSelected) {
    showOnlineIdle();
    return;
  }
  if (
    currentSource === 'aol' &&
    currentMode === 'online' &&
    currentTimePreset === 'custom' &&
    !customDateRange()
  ) {
    results.replaceChildren(emptyNode('Pick a start and end date.'));
    return;
  }

  searchAbort?.abort();
  const controller = new AbortController();
  searchAbort = controller;
  const requestId = ++searchRequestId;
  const radiusKm = usesLocationSearch()
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
    ashramCategories =
      currentSource === 'vvmvp'
        ? presentAshramCategories(source?.listingCategories)
        : [];
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
      dateFrom:
        currentSource === 'aol' &&
        currentMode === 'online' &&
        currentTimePreset === 'custom'
          ? customDateFrom || undefined
          : undefined,
      dateTo:
        currentSource === 'aol' &&
        currentMode === 'online' &&
        currentTimePreset === 'custom'
          ? customDateTo || undefined
          : undefined,
      radiusKm,
      location: usesLocationSearch() ? searchLocationCoords(selectedLocation) : undefined
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

function ashramCategory(item: OfficialCourseListing): string {
  return item.category || '';
}

function visibleListings(): OfficialCourseListing[] {
  if (currentSource === 'vvmvp') {
    if (!selectedAshramCategory) return mergedListings;
    return mergedListings.filter(
      (item) => ashramCategory(item) === selectedAshramCategory
    );
  }
  if (currentSource === 'center') return mergedListings;
  if (!selectedCategories.size) return [];
  return mergedListings.filter((item) => selectedCategories.has(listingCategory(item)));
}

function presentCategories(): CourseCategoryId[] {
  return presentCourseCategories(
    mergedListings.map((item) => ({ category: listingCategory(item) }))
  );
}

function presentAshramCategories(order?: string[]): string[] {
  const present = new Set(
    mergedListings.map(ashramCategory).filter(Boolean)
  );
  const fromServer = (order || []).filter((name) => present.has(name));
  if (fromServer.length) {
    for (const name of present) {
      if (!fromServer.includes(name)) fromServer.push(name);
    }
    return fromServer;
  }
  return [...present];
}

function pruneSelectedCategories() {
  const next = resolveCourseCategory(presentCategories(), selectedCategories);
  selectedCategories = new Set(next ? [next] : []);
  persistCategories();
}

function pruneAshramCategory() {
  const present = presentAshramCategories(ashramCategories);
  ashramCategories = present;
  if (!present.length) {
    selectedAshramCategory = '';
    return;
  }
  if (!selectedAshramCategory || !present.includes(selectedAshramCategory)) {
    selectedAshramCategory = present[0];
  }
  persistAshramCategory();
}

function renderCategoryChips() {
  if (!categoryChips) return;
  if (currentSource === 'vvmvp') {
    pruneAshramCategory();
    if (!ashramCategories.length) {
      categoryChips.hidden = true;
      categoryChips.replaceChildren();
      return;
    }
    categoryChips.hidden = false;
    categoryChips.replaceChildren(
      ...ashramCategories.map((name) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-chip';
        button.dataset.category = name;
        button.setAttribute('role', 'radio');
        button.setAttribute(
          'aria-checked',
          String(name === selectedAshramCategory)
        );
        button.textContent = vvmvpCategoryLabel(name);
        return button;
      })
    );
    return;
  }
  const present = presentCategories();
  if (currentSource !== 'aol' || !present.length) {
    categoryChips.hidden = true;
    categoryChips.replaceChildren();
    return;
  }
  pruneSelectedCategories();
  categoryChips.hidden = false;
  categoryChips.replaceChildren(
    ...present.map((id) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-chip';
      button.dataset.category = id;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(selectedCategories.has(id)));
      button.textContent = courseCategoryLabel(id);
      return button;
    })
  );
}

function renderMergedResults(source?: SourceSearchResult) {
  if (!results) return;
  renderCategoryChips();

  if (currentSource === 'vds') {
    if (source?.listingError) {
      results.replaceChildren(emptyNode(source.listingError));
      return;
    }
    results.replaceChildren(
      source ? renderOfficialLinkCard(source) : emptyNode('No programs found.')
    );
    return;
  }

  if (currentSource === 'vvmvp' && source?.listingError && !mergedListings.length) {
    results.replaceChildren(emptyNode(source.listingError));
    return;
  }

  const listings = visibleListings();
  const nodes: HTMLElement[] = [];
  nodes.push(resultsMetaNode(listings.length));

  if (currentSource === 'vvmvp') {
    if (!listings.length) {
      nodes.push(emptyNode('No matching programs at Bangalore Ashram.'));
    } else {
      for (const listing of listings) nodes.push(renderListingCard(listing));
    }
    if (officialUrl) nodes.push(moreResultsLink(officialUrl));
    results.replaceChildren(...nodes);
    return;
  }

  if (!listings.length) {
    nodes.push(
      emptyNode(
        usesLocationSearch()
          ? 'No matching programs within ' + String(currentRadiusKm) + ' km.'
          : 'No matching programs in this date range.'
      )
    );
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
  const label = selectedCategoryLabel();
  if (currentSource === 'vvmvp') {
    meta.textContent =
      label + ' · ' + String(count) + (count === 1 ? ' program' : ' programs');
    return meta;
  }
  if (usesLocationSearch()) {
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

function selectedCategoryLabel(): string {
  if (currentSource === 'vvmvp') {
    return selectedAshramCategory
      ? vvmvpCategoryLabel(selectedAshramCategory)
      : 'Programs';
  }
  if (currentSource === 'center') return 'Follow-up & Satsang';
  const selected = COURSE_CATEGORY_ORDER.find((id) => selectedCategories.has(id));
  return selected ? courseCategoryLabel(selected) : 'Programs';
}

function nextShowMoreRadius(): number | undefined {
  if (!usesLocationSearch()) return undefined;
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
  const online = currentSource !== 'center' && (currentMode === 'online' || item.isOnline);

  const header = document.createElement('header');
  header.className = 'result-card-header';
  const heading = document.createElement('div');
  heading.className = 'result-card-heading';
  const title = document.createElement('h2');
  title.textContent = item.title;
  heading.append(title);
  if (online) {
    const labels = document.createElement('div');
    labels.className = 'result-card-labels';
    const badge = document.createElement('span');
    badge.className = 'badge online-badge';
    badge.textContent = 'Online';
    labels.append(badge);
    heading.prepend(labels);
  }
  header.append(heading);

  const url = item.registerUrl || item.detailUrl;
  if (url) {
    const register = document.createElement('span');
    register.className = 'register-affordance';
    register.textContent =
      currentSource === 'center' ? 'More Info →' : 'Register →';
    header.append(register);
    makeCardClickable(card, url);
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
  ashramCategories = [];
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

function renderTimeControls() {
  if (currentTimePreset !== 'anytime' && currentTimePreset !== 'custom') {
    applyPresetDates(currentTimePreset);
  } else if (currentTimePreset === 'custom') {
    ensureCustomDates();
  }
  const anytime = currentTimePreset === 'anytime';
  const showCustom = Boolean(timeCustomOpen && timeControl && !timeControl.hidden);
  if (timeShortcut) timeShortcut.value = onlineRangeSelected ? currentTimePreset : '';
  if (timeRangeLabel) {
    timeRangeLabel.textContent =
      !onlineRangeSelected || anytime
        ? 'Anytime'
        : formatCompactDateRange(customDateFrom, customDateTo);
  }
  if (timeRangeControl) {
    timeRangeControl.setAttribute('aria-expanded', String(showCustom));
  }
  if (timeCustomPanel) timeCustomPanel.hidden = !showCustom;
  const today = todayInIndia();
  const max = addCalendarDays(today, 365);
  if (dateFromInput) {
    dateFromInput.min = today;
    dateFromInput.max = max;
    dateFromInput.value = anytime ? '' : customDateFrom;
  }
  if (dateToInput) {
    dateToInput.min = anytime ? today : customDateFrom || today;
    dateToInput.max = max;
    dateToInput.value = anytime ? '' : customDateTo;
  }
}

function applyTimeShortcut(preset: TimePreset) {
  currentTimePreset = preset;
  persistTime(preset);
  onlineRangeSelected = true;
  timeCustomOpen = preset === 'custom';
  if (preset === 'anytime') {
    customDateFrom = '';
    customDateTo = '';
    persistCustomDates();
  } else if (preset === 'custom') {
    ensureCustomDates();
  } else {
    applyPresetDates(preset);
    persistCustomDates();
  }
  renderTimeControls();
  resetListings();
  void runCatalogSearch();
}

function toggleCustomEditor() {
  if (timeCustomOpen) {
    timeCustomOpen = false;
    renderTimeControls();
    return;
  }
  timeCustomOpen = true;
  if (currentTimePreset === 'anytime') {
    applyTimeShortcut('custom');
    return;
  }
  if (currentTimePreset !== 'custom') {
    currentTimePreset = 'custom';
    persistTime('custom');
  }
  renderTimeControls();
}

function formatCompactDateRange(from: string, to: string): string {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return 'Anytime';
  const startParts = start.split('-').map(Number);
  const endParts = end.split('-').map(Number);
  const startMonth = SHORT_MONTHS[(startParts[1] || 1) - 1] || '';
  const endMonth = SHORT_MONTHS[(endParts[1] || 1) - 1] || '';
  const startDay = startParts[2] || 1;
  const endDay = endParts[2] || 1;
  if (start === end) return startDay + ' ' + startMonth;
  if (startParts[0] === endParts[0] && startParts[1] === endParts[1]) {
    return startDay + '–' + endDay + ' ' + startMonth;
  }
  if (startParts[0] === endParts[0]) {
    return startDay + ' ' + startMonth + ' – ' + endDay + ' ' + endMonth;
  }
  return (
    startDay +
    ' ' +
    startMonth +
    ' ' +
    startParts[0] +
    ' – ' +
    endDay +
    ' ' +
    endMonth +
    ' ' +
    endParts[0]
  );
}

function applyPresetDates(preset: Exclude<TimePreset, 'anytime' | 'custom'>) {
  const range = resolveOnlineTimePreset(preset);
  if (!range) return;
  customDateFrom = range.start;
  customDateTo = range.end;
}

function onDateInputsChanged() {
  customDateFrom = parseIsoDate(dateFromInput?.value) || '';
  customDateTo = parseIsoDate(dateToInput?.value) || '';
  if (customDateFrom && !customDateTo) customDateTo = customDateFrom;
  if (customDateTo && !customDateFrom) customDateFrom = customDateTo;
  if (customDateFrom && customDateTo && customDateTo < customDateFrom) {
    customDateTo = customDateFrom;
  }
  persistCustomDates();
  onlineRangeSelected = true;
  currentTimePreset = presetMatchingDates(customDateFrom, customDateTo);
  persistTime(currentTimePreset);
  renderTimeControls();
  resetListings();
  void runCatalogSearch();
}

function presetMatchingDates(from: string, to: string): TimePreset {
  if (!from && !to) return 'anytime';
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return 'anytime';
  const shortcuts: Array<Exclude<TimePreset, 'anytime' | 'custom'>> = [
    'today',
    'tomorrow',
    'this_weekend',
    'next_7_days'
  ];
  for (const preset of shortcuts) {
    const range = resolveOnlineTimePreset(preset);
    if (range?.start === start && range.end === end) return preset;
  }
  return 'custom';
}

function ensureCustomDates() {
  const today = todayInIndia();
  if (!parseIsoDate(customDateFrom)) customDateFrom = today;
  if (!parseIsoDate(customDateTo)) customDateTo = addCalendarDays(customDateFrom, 6);
  if (customDateTo < customDateFrom) customDateTo = customDateFrom;
  persistCustomDates();
}

function customDateRange(): { from: string; to: string } | undefined {
  const from = parseIsoDate(customDateFrom);
  const to = parseIsoDate(customDateTo);
  if (!from || !to) return undefined;
  return from <= to ? { from, to } : { from: to, to: from };
}

function setStatus(label: string, state: 'idle' | 'loading' | 'error' = 'idle') {
  if (!statusPill) return;
  statusPill.hidden = state === 'idle' || !label;
  statusPill.textContent = label;
  statusPill.dataset.state = state;
}

async function mountLocationSearch() {
  if (!locationHost) return;
  const token = (import.meta.env.AOL_GUIDE_MAPBOX_TOKEN || '').trim();
  const input = locationHost.querySelector<HTMLInputElement>('#location-input');
  const clearButton =
    locationHost.querySelector<HTMLButtonElement>('#location-clear');
  const suggestionList = locationHost.querySelector<HTMLElement>(
    '#location-suggestions'
  );
  if (!input || !suggestionList) return;
  if (!token.startsWith('pk.')) {
    input.placeholder = 'Mapbox token missing';
    return;
  }

  input.disabled = false;
  let debounceTimer = 0;
  let suggestAbort: AbortController | null = null;
  let highlightIndex = -1;

  const hideSuggestions = () => {
    suggestionList.hidden = true;
    suggestionList.replaceChildren();
    highlightIndex = -1;
  };

  const syncClearButton = () => {
    if (!clearButton) return;
    clearButton.hidden = !input.value.trim();
  };

  const clearLocation = () => {
    suggestAbort?.abort();
    window.clearTimeout(debounceTimer);
    selectedLocation = undefined;
    input.value = '';
    syncClearButton();
    hideSuggestions();
    searchAbort?.abort();
    searchRequestId += 1;
    resetListings();
    showLocationIdle();
  };

  const chooseSuggestion = (location: BrowserLocation) => {
    suggestAbort?.abort();
    window.clearTimeout(debounceTimer);
    selectedLocation = location;
    input.value = location.label;
    syncClearButton();
    hideSuggestions();
    resetListings();
    void runCatalogSearch();
  };

  const renderSuggestions = (locations: BrowserLocation[]) => {
    suggestionList.replaceChildren();
    if (!locations.length) {
      hideSuggestions();
      return;
    }
    locations.forEach((location, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'suggestion-option';
      option.setAttribute('role', 'option');
      option.dataset.index = String(index);
      option.textContent = location.label;
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
        chooseSuggestion(location);
      });
      suggestionList.append(option);
    });
    suggestionList.hidden = false;
    highlightIndex = -1;
  };

  const requestSuggestions = async (query: string) => {
    suggestAbort?.abort();
    if (!shouldSuggestLocationQuery(query)) {
      hideSuggestions();
      return;
    }
    const controller = new AbortController();
    suggestAbort = controller;
    try {
      const locations = await suggestMapboxTemporaryLocations(query, token, {
        signal: controller.signal
      });
      if (controller.signal.aborted || input.value.trim() !== query.trim()) {
        return;
      }
      renderSuggestions(locations);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Mapbox temporary geocode failed', error);
      hideSuggestions();
    }
  };

  input.addEventListener('input', () => {
    const query = input.value;
    syncClearButton();
    if (!query.trim()) {
      clearLocation();
      return;
    }
    if (selectedLocation && query.trim() !== selectedLocation.label) {
      selectedLocation = undefined;
    }
    window.clearTimeout(debounceTimer);
    if (!shouldSuggestLocationQuery(query)) {
      hideSuggestions();
      return;
    }
    debounceTimer = window.setTimeout(() => {
      void requestSuggestions(query);
    }, LOCATION_SUGGEST_DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (event) => {
    const options = [
      ...suggestionList.querySelectorAll<HTMLButtonElement>('.suggestion-option')
    ];
    if (event.key === 'Escape') {
      hideSuggestions();
      return;
    }
    if (!options.length || suggestionList.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlightIndex = (highlightIndex + 1) % options.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlightIndex = (highlightIndex - 1 + options.length) % options.length;
    } else if (event.key === 'Enter' && highlightIndex >= 0) {
      event.preventDefault();
      options[highlightIndex]?.dispatchEvent(new Event('mousedown'));
      return;
    } else {
      return;
    }
    options.forEach((option, index) => {
      option.setAttribute(
        'aria-selected',
        index === highlightIndex ? 'true' : 'false'
      );
    });
  });

  input.addEventListener('blur', () => {
    window.setTimeout(hideSuggestions, 120);
  });

  clearButton?.addEventListener('click', () => {
    clearLocation();
    input.focus();
  });

  document.addEventListener('click', (event) => {
    if (event.target instanceof Node && locationHost.contains(event.target)) {
      return;
    }
    hideSuggestions();
  });

  syncClearButton();
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
  return value === 'aol' || value === 'center' ? value : undefined;
}

function parseMode(value: string | undefined): SearchMode | undefined {
  return value === 'online' || value === 'in_person' ? value : undefined;
}

function parseTimePreset(value: string | undefined): TimePreset | undefined {
  return value === 'anytime' ||
    value === 'today' ||
    value === 'tomorrow' ||
    value === 'this_weekend' ||
    value === 'next_7_days' ||
    value === 'custom'
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

function readStoredIsoDate(key: string): string {
  try {
    return parseIsoDate(localStorage.getItem(key) || '') || '';
  } catch {
    return '';
  }
}

function persistCustomDates() {
  try {
    if (customDateFrom) localStorage.setItem(TIME_FROM_STORAGE_KEY, customDateFrom);
    if (customDateTo) localStorage.setItem(TIME_TO_STORAGE_KEY, customDateTo);
  } catch {
    // Ignore storage failures; the selected custom dates still apply for this visit.
  }
}

function readStoredCategories(): CourseCategoryId[] {
  try {
    const stored = parseCourseCategories(localStorage.getItem(CATEGORY_STORAGE_KEY) || '');
    return stored.length ? [stored[0]] : ['beginner'];
  } catch {
    return ['beginner'];
  }
}

function persistCategories() {
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, serializeCourseCategories(selectedCategories));
  } catch {
    // Ignore storage failures; the selected categories still apply for this visit.
  }
}

function readStoredAshramCategory(): string {
  try {
    return (localStorage.getItem(ASHRAM_CATEGORY_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function persistAshramCategory() {
  try {
    if (selectedAshramCategory) {
      localStorage.setItem(ASHRAM_CATEGORY_STORAGE_KEY, selectedAshramCategory);
    }
  } catch {
    // Ignore storage failures; the selected ashram category still applies for this visit.
  }
}
