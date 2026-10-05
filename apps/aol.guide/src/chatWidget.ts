import type { OfficialCourseListing } from '../lib/searchIntent.js';
import {
  normalizeAolListing,
  sortListingsByDistance
} from '../lib/sources/aolListings.js';
import type { BrowserLocation } from './mapboxSearchJs.js';
import { createLocationPickerControl, mountLocationPicker } from './locationPicker.js';

type ToolUIInteractionState = 'waiting' | 'ready' | 'submitting' | 'resolved';

type ToolRenderer = (
  container: HTMLDivElement,
  ui: unknown,
  context: {
    dispatch: (action: { type: string; payload?: unknown }) => void;
    initialValues?: unknown;
    requestSubmit?: () => Promise<void>;
    requestCancel?: () => Promise<void>;
  }
) =>
  | void
  | (() => void)
  | {
      cleanup?: () => void;
      getValues?: () => unknown;
      validate?: () => boolean | Promise<boolean>;
      onInteractionStateChange?: (state: ToolUIInteractionState) => void;
    };

type AgentEmbedModule = {
  default?: {
    initStandard: (options: {
      agentName: string;
      apiHost?: string;
      apiStreamHost?: string;
      agentUi?: {
        css?: string;
        components?: Record<string, ToolRenderer>;
      };
    }) => void;
  };
};

export type ChatListingCardOptions = {
  online: boolean;
  showOnlineBadge: boolean;
  actionLabel: string;
  includeLocation: boolean;
  includeDistance: boolean;
};

export type AolGuideChatOptions = {
  mapboxToken: string;
  renderListingCard: (
    item: OfficialCourseListing,
    options: ChatListingCardOptions
  ) => HTMLElement;
};

const CHAT_COURSE_RESULT_LIMIT = 20;
const AGENT_EMBED_MODULE_URL =
  'https://cdn.jsdelivr.net/npm/@agent-embed/js@2.1.0/dist/web.js';

const AOL_GUIDE_WIDGET_CSS = `
  .aol-tool-results {
    display: grid;
    gap: 10px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .aol-tool-results .tool-results-meta {
    color: #64748b;
    font-size: 13px;
    line-height: 20px;
  }

  .aol-tool-results .result-card {
    display: grid;
    gap: 8px;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: #ffffff;
    padding: 14px;
  }

  .aol-tool-results .result-card[data-clickable='true'] {
    cursor: pointer;
  }

  .aol-tool-results .result-card[data-clickable='true']:active {
    background: #f8fafc;
  }

  .aol-tool-results .result-card:focus-visible {
    outline: 2px solid #1b3a6e;
    outline-offset: 2px;
  }

  .aol-tool-results .result-card h2 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.35;
  }

  .aol-tool-results .result-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .aol-tool-results .result-card-heading {
    min-width: 0;
    flex: 1;
  }

  .aol-tool-results .result-card-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 4px;
  }

  .aol-tool-results .register-affordance {
    flex-shrink: 0;
    padding-top: 2px;
    color: #ee6b1f;
    font-size: 13px;
    font-weight: 700;
  }

  .aol-tool-results .badge {
    display: inline-flex;
    min-height: 20px;
    align-items: center;
    border-radius: 999px;
    background: rgb(27 58 110 / 0.08);
    padding: 2px 8px;
    color: #1b3a6e;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .aol-tool-results .online-badge {
    background: #eef2ff;
    color: #3730a3;
  }

  .aol-tool-results .result-meta {
    display: grid;
    gap: 6px;
    color: #475569;
    font-size: 14px;
    line-height: 20px;
  }

  .aol-tool-results .result-meta-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .aol-tool-results .result-meta-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 2px;
    color: #94a3b8;
  }

  .aol-tool-results .result-meta-icon svg {
    width: 16px;
    height: 16px;
  }

  .aol-tool-results .result-meta-secondary {
    display: flex;
    flex-wrap: wrap;
    column-gap: 12px;
    row-gap: 4px;
    color: #64748b;
    font-size: 12px;
    line-height: 20px;
  }

  .aol-tool-results .empty {
    border-radius: 16px;
    background: #f8fafc;
    padding: 24px 16px;
    color: #64748b;
    text-align: center;
    font-size: 14px;
    line-height: 24px;
  }

  .agent-host-bubble-wrapper:has(.aol-location-form) {
    width: 100%;
  }

  .agent-host-bubble-content:has(.aol-location-form) {
    width: calc(100% - 2rem);
  }

  .agent-tool-render-container:has(.aol-location-form) {
    width: 100%;
  }

  .aol-location-form {
    display: grid;
    gap: 8px;
    width: 100%;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .aol-location-form label {
    color: #0f172a;
    font-size: 13px;
    font-weight: 600;
  }

  .aol-location-form .filter-control {
    box-sizing: border-box;
    position: relative;
    display: flex;
    height: 32px;
    width: 100%;
    align-items: center;
    gap: 4px;
    overflow: visible;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: #f8fafc;
    padding-right: 4px;
    padding-left: 8px;
  }

  .aol-location-form .filter-control:focus-within {
    border-color: #1b3a6e;
    box-shadow: 0 0 0 2px rgb(27 58 110 / 0.14);
  }

  .aol-location-form .filter-control[data-invalid='true'] {
    border-color: #b91c1c;
    box-shadow: 0 0 0 2px rgb(185 28 28 / 0.12);
  }

  .aol-location-form .filter-control[data-disabled='true'] {
    opacity: 0.72;
  }

  .aol-location-form .filter-icon {
    flex-shrink: 0;
    font-size: 13px;
    line-height: 1;
  }

  .aol-location-form .filter-control-body {
    position: relative;
    min-width: 0;
    flex: 1;
  }

  .aol-location-form .filter-input {
    box-sizing: border-box;
    height: 32px;
    width: 100%;
    min-width: 0;
    border: 0;
    background: transparent;
    padding-right: 8px;
    color: #0f172a;
    outline: none;
    font: inherit;
    font-size: 13px;
  }

  .aol-location-form .filter-input:disabled {
    cursor: not-allowed;
  }

  .aol-location-form .filter-input[type='search']::-webkit-search-decoration,
  .aol-location-form .filter-input[type='search']::-webkit-search-results-button,
  .aol-location-form .filter-input[type='search']::-webkit-search-results-decoration {
    display: none;
  }

  .aol-location-form .filter-input:focus-visible {
    outline: none;
  }

  .aol-location-form .filter-input[aria-invalid='true'] {
    outline: none;
  }

  .aol-location-form .suggestions,
  .aol-location-popover.suggestions {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    left: 0;
    z-index: 50;
    max-height: 240px;
    overflow: hidden auto;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 12px 24px rgb(15 23 42 / 0.14);
  }

  .aol-location-form .suggestions[hidden],
  .aol-location-popover.suggestions[hidden] {
    display: none;
  }

  .aol-location-form .suggestion-option,
  .aol-location-popover .suggestion-option {
    display: block;
    width: 100%;
    cursor: pointer;
    border: 0;
    border-bottom: 1px solid #f1f5f9;
    background: #ffffff;
    padding: 10px 12px;
    color: #0f172a;
    text-align: left;
    font: inherit;
    font-size: 13px;
  }

  .aol-location-form .suggestion-option:last-child,
  .aol-location-popover .suggestion-option:last-child {
    border-bottom: 0;
  }

  .aol-location-form .suggestion-option:hover,
  .aol-location-form .suggestion-option[aria-selected='true'],
  .aol-location-popover .suggestion-option:hover,
  .aol-location-popover .suggestion-option[aria-selected='true'] {
    background: #eff6ff;
  }

  .aol-location-error {
    min-height: 18px;
    color: #b91c1c;
    font-size: 12px;
    line-height: 18px;
  }
`;

let chatAgentInitPromise: Promise<void> | null = null;
let locationFormId = 0;

export function initAolGuideChatAgent(options: AolGuideChatOptions): Promise<void> {
  if (!chatAgentInitPromise) {
    // To use the local workspace build again, switch back to:
    // chatAgentInitPromise = import('../../../../../pd/agent-embed/js/dist/web.js')
    chatAgentInitPromise = import(/* @vite-ignore */ AGENT_EMBED_MODULE_URL)
      .then((module) => {
        const agentModule = module as AgentEmbedModule;
        agentModule.default?.initStandard({
          agentName: 'AOL Guide',
          agentUi: {
            css: AOL_GUIDE_WIDGET_CSS,
            components: {
              search_courses: (container, output) => {
                renderSearchCoursesToolResult(container, output, options);
              },
              get_user_location: (container, ui, context) =>
                renderUserLocationInput(container, ui, context, options.mapboxToken)
            }
          }
        });
      })
      .catch((error: unknown) => {
        console.error('Unable to load AOL Guide chat agent.', error);
      });
  }
  return chatAgentInitPromise;
}

function renderUserLocationInput(
  container: HTMLDivElement,
  _ui: unknown,
  { initialValues, requestSubmit }: Parameters<ToolRenderer>[2],
  mapboxToken: string
) {
  const formId = ++locationFormId;
  const form = document.createElement('section');
  form.className = 'aol-location-form';

  const label = document.createElement('label');
  label.textContent = 'Choose a location';
  const { control, host, input, suggestionList } = createLocationPickerControl({
    id: 'aol-location-' + formId,
    placeholder: 'Pick a location'
  });
  const error = document.createElement('span');
  error.id = input.id + '-error';
  error.className = 'aol-location-error';
  error.setAttribute('role', 'alert');
  input.setAttribute('aria-describedby', error.id);
  label.htmlFor = input.id;
  form.append(label, control, error);
  container.replaceChildren(form);

  const restoredLocation = readLocationValue(initialValues);
  if (restoredLocation) {
    input.value = restoredLocation.label;
  }
  const clearError = () => {
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    control.removeAttribute('data-invalid');
  };
  const setDisabled = (disabled: boolean) => {
    input.disabled = disabled || !mapboxToken.startsWith('pk.');
    control.dataset.disabled = String(input.disabled);
  };
  const picker = mountLocationPicker({
    host,
    input,
    suggestionList,
    token: mapboxToken,
    floatingSuggestions: true,
    floatingClassName: 'aol-location-popover',
    onInput: clearError,
    onSelect: () => {
      clearError();
      void requestSubmit?.();
    }
  });

  return {
    cleanup: picker.cleanup,
    getValues: () => locationCoords(picker.getSelection()) || restoredLocation,
    validate: () => {
      if (picker.getSelection() || restoredLocation) {
        clearError();
        return true;
      }
      error.textContent = mapboxToken.startsWith('pk.')
        ? 'Choose a location from the suggestions.'
        : 'Location search is unavailable.';
      input.setAttribute('aria-invalid', 'true');
      control.dataset.invalid = 'true';
      return false;
    },
    onInteractionStateChange: (state: ToolUIInteractionState) => {
      setDisabled(state !== 'ready');
    }
  };
}

function readLocationValue(value: unknown) {
  if (!isRecord(value)) return undefined;
  const { label, latitude, longitude, city } = value;
  if (
    typeof label !== 'string' ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude)
  ) {
    return undefined;
  }
  return {
    label,
    latitude,
    longitude,
    city: typeof city === 'string' ? city : undefined
  };
}

function locationCoords(location: BrowserLocation | undefined) {
  if (!location) return undefined;
  return {
    label: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    city: location.city
  };
}

function renderSearchCoursesToolResult(
  container: HTMLElement,
  output: unknown,
  options: AolGuideChatOptions
) {
  const rawCourses = readToolCourses(output);
  const listings = sortListingsByDistance(
    rawCourses
      .map(readToolCourseListing)
      .filter((listing): listing is OfficialCourseListing => listing != null)
  );
  const shownListings = listings.slice(0, CHAT_COURSE_RESULT_LIMIT);

  const wrapper = document.createElement('section');
  wrapper.className = 'aol-tool-results';

  if (!shownListings.length) {
    wrapper.append(emptyNode('No courses found.'));
    container.replaceChildren(wrapper);
    return;
  }

  const meta = document.createElement('div');
  meta.className = 'tool-results-meta';
  meta.textContent = chatResultsLabel(
    shownListings.length,
    listings.length,
    readToolTotal(output)
  );
  wrapper.append(meta);

  for (const listing of shownListings) {
    wrapper.append(
      options.renderListingCard(listing, {
        online: listing.isOnline,
        showOnlineBadge: listing.isOnline,
        actionLabel: listing.registerUrl ? 'Register' : 'More Info',
        includeLocation: !listing.isOnline,
        includeDistance: !listing.isOnline
      })
    );
  }

  container.replaceChildren(wrapper);
}

function readToolCourses(output: unknown): unknown[] {
  const record = isRecord(output) ? output : null;
  return record && Array.isArray(record.courses) ? record.courses : [];
}

function readToolTotal(output: unknown): number | undefined {
  const record = isRecord(output) ? output : null;
  const value = record?.total;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readToolCourseListing(raw: unknown): OfficialCourseListing | null {
  if (isOfficialCourseListing(raw)) return raw;
  return normalizeAolListing(raw);
}

function isOfficialCourseListing(value: unknown): value is OfficialCourseListing {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.schedule === 'string' &&
    typeof value.location === 'string' &&
    Array.isArray(value.languages) &&
    typeof value.isOnline === 'boolean' &&
    typeof value.registerUrl === 'string' &&
    typeof value.detailUrl === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function chatResultsLabel(
  shownCount: number,
  normalizedCount: number,
  total: number | undefined
): string {
  const totalCount = total && total > normalizedCount ? total : normalizedCount;
  const noun = totalCount === 1 ? 'program' : 'programs';
  if (shownCount < totalCount) {
    return 'Showing ' + String(shownCount) + ' of ' + String(totalCount) + ' ' + noun;
  }
  return String(totalCount) + ' ' + noun;
}

function emptyNode(label: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = label;
  return empty;
}
