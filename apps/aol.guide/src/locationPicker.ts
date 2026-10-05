import {
  LOCATION_SUGGEST_DEBOUNCE_MS,
  shouldSuggestLocationQuery,
  suggestMapboxTemporaryLocations,
  type BrowserLocation
} from './mapboxSearchJs.js';

type LocationPickerOptions = {
  host: HTMLElement;
  input: HTMLInputElement;
  suggestionList: HTMLElement;
  token: string;
  floatingSuggestions?: boolean;
  floatingClassName?: string;
  onSelect?: (location: BrowserLocation) => void;
  onClear?: () => void;
  onEdit?: () => void;
  onInput?: () => void;
};

type LocationPickerControlOptions = {
  id: string;
  placeholder?: string;
};

export function createLocationPickerControl(options: LocationPickerControlOptions) {
  const control = document.createElement('div');
  control.className = 'filter-control';

  const icon = document.createElement('span');
  icon.className = 'filter-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '📍';

  const host = document.createElement('div');
  host.className = 'filter-control-body';

  const input = document.createElement('input');
  input.id = options.id;
  input.className = 'filter-input';
  input.name = 'label';
  input.type = 'search';
  input.autocomplete = 'off';
  input.enterKeyHint = 'search';
  input.placeholder = options.placeholder || 'Pick a location';

  const suggestionList = document.createElement('div');
  suggestionList.id = input.id + '-suggestions';
  suggestionList.className = 'suggestions';
  suggestionList.hidden = true;
  suggestionList.setAttribute('role', 'listbox');
  suggestionList.setAttribute('aria-label', 'Location suggestions');

  host.append(input, suggestionList);
  control.append(icon, host);

  return { control, host, input, suggestionList };
}

export function mountLocationPicker(options: LocationPickerOptions) {
  const { host, input, suggestionList, token } = options;
  let selectedLocation: BrowserLocation | undefined;
  let debounceTimer = 0;
  let blurTimer = 0;
  let positionFrame = 0;
  let suggestAbort: AbortController | null = null;
  let highlightIndex = -1;
  let disposed = false;
  const originalSuggestionParent = suggestionList.parentNode;
  const originalSuggestionNextSibling = suggestionList.nextSibling;
  const floatingSuggestions = options.floatingSuggestions === true;
  const floatingClassName = options.floatingClassName || 'location-suggestions-popover';

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  if (suggestionList.id) input.setAttribute('aria-controls', suggestionList.id);

  const floatingRoot = () => {
    const root = host.getRootNode();
    return root instanceof ShadowRoot ? root : document.body;
  };

  const mountFloatingSuggestions = () => {
    if (!floatingSuggestions) return;
    suggestionList.classList.add(floatingClassName);
    const root = floatingRoot();
    if (suggestionList.parentNode !== root) root.append(suggestionList);
  };

  const positionFloatingSuggestions = () => {
    if (!floatingSuggestions || suggestionList.hidden) return;
    const rect = host.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const gutter = 12;
    const top = rect.bottom + 6;
    const maxHeight = Math.max(120, viewportHeight - top - gutter);
    suggestionList.style.position = 'fixed';
    suggestionList.style.top = `${top}px`;
    suggestionList.style.left = `${rect.left}px`;
    suggestionList.style.width = `${rect.width}px`;
    suggestionList.style.maxHeight = `${Math.min(240, maxHeight)}px`;
  };

  const queueFloatingPosition = () => {
    if (!floatingSuggestions || suggestionList.hidden) return;
    window.cancelAnimationFrame(positionFrame);
    positionFrame = window.requestAnimationFrame(positionFloatingSuggestions);
  };

  const hideSuggestions = () => {
    suggestionList.hidden = true;
    suggestionList.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    highlightIndex = -1;
  };

  if (!token.startsWith('pk.')) {
    input.placeholder = 'Mapbox token missing';
    input.disabled = true;
    return { getSelection: () => undefined, cleanup: () => {} };
  }

  input.disabled = false;

  const clearLocation = () => {
    suggestAbort?.abort();
    window.clearTimeout(debounceTimer);
    selectedLocation = undefined;
    input.value = '';
    hideSuggestions();
    options.onClear?.();
  };

  const chooseSuggestion = (location: BrowserLocation) => {
    suggestAbort?.abort();
    window.clearTimeout(debounceTimer);
    window.clearTimeout(blurTimer);
    selectedLocation = location;
    input.value = location.label;
    hideSuggestions();
    options.onSelect?.(location);
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
      option.id = `${suggestionList.id}-option-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.dataset.index = String(index);
      option.textContent = location.label;
      option.addEventListener('click', () => chooseSuggestion(location));
      suggestionList.append(option);
    });
    mountFloatingSuggestions();
    suggestionList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlightIndex = -1;
    positionFloatingSuggestions();
  };

  const requestSuggestions = async (query: string) => {
    suggestAbort?.abort();
    const controller = new AbortController();
    suggestAbort = controller;
    try {
      const locations = await suggestMapboxTemporaryLocations(query, token, {
        signal: controller.signal
      });
      if (disposed || controller.signal.aborted || input.value.trim() !== query.trim())
        return;
      renderSuggestions(locations);
    } catch (error) {
      if (disposed || controller.signal.aborted) return;
      console.error('Mapbox temporary geocode failed', error);
      hideSuggestions();
    }
  };

  const onInput = () => {
    options.onInput?.();
    const query = input.value;
    if (!query.trim()) {
      clearLocation();
      return;
    }
    if (selectedLocation && query.trim() !== selectedLocation.label) {
      selectedLocation = undefined;
      options.onEdit?.();
    }
    suggestAbort?.abort();
    window.clearTimeout(debounceTimer);
    hideSuggestions();
    if (!shouldSuggestLocationQuery(query)) {
      return;
    }
    debounceTimer = window.setTimeout(() => {
      void requestSuggestions(query);
    }, LOCATION_SUGGEST_DEBOUNCE_MS);
  };

  const onKeydown = (event: KeyboardEvent) => {
    const choices = [
      ...suggestionList.querySelectorAll<HTMLButtonElement>('.suggestion-option')
    ];
    if (event.key === 'Escape') {
      hideSuggestions();
      return;
    }
    if (!choices.length || suggestionList.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlightIndex = (highlightIndex + 1) % choices.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlightIndex = (highlightIndex - 1 + choices.length) % choices.length;
    } else if (event.key === 'Enter' && highlightIndex >= 0) {
      event.preventDefault();
      choices[highlightIndex]?.click();
      return;
    } else {
      return;
    }
    choices.forEach((choice, index) => {
      choice.setAttribute('aria-selected', String(index === highlightIndex));
    });
    const active = choices[highlightIndex];
    if (active) input.setAttribute('aria-activedescendant', active.id);
  };

  const onFocusOut = (event: FocusEvent) => {
    if (
      event.relatedTarget instanceof Node &&
      (host.contains(event.relatedTarget) ||
        suggestionList.contains(event.relatedTarget))
    ) {
      return;
    }
    suggestAbort?.abort();
    window.clearTimeout(debounceTimer);
    blurTimer = window.setTimeout(hideSuggestions, 120);
  };
  const onSearch = () => {
    if (!input.value.trim() && selectedLocation) clearLocation();
  };
  const onDocumentClick = (event: MouseEvent) => {
    const path = event.composedPath();
    if (path.includes(host) || path.includes(suggestionList)) return;
    hideSuggestions();
  };

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);
  host.addEventListener('focusout', onFocusOut);
  input.addEventListener('search', onSearch);
  document.addEventListener('click', onDocumentClick);
  if (floatingSuggestions) {
    window.addEventListener('resize', queueFloatingPosition);
    window.addEventListener('scroll', queueFloatingPosition, true);
    window.visualViewport?.addEventListener('resize', queueFloatingPosition);
    window.visualViewport?.addEventListener('scroll', queueFloatingPosition);
  }

  return {
    getSelection: () => selectedLocation,
    cleanup: () => {
      disposed = true;
      suggestAbort?.abort();
      window.clearTimeout(debounceTimer);
      window.clearTimeout(blurTimer);
      window.cancelAnimationFrame(positionFrame);
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeydown);
      host.removeEventListener('focusout', onFocusOut);
      input.removeEventListener('search', onSearch);
      document.removeEventListener('click', onDocumentClick);
      if (floatingSuggestions) {
        window.removeEventListener('resize', queueFloatingPosition);
        window.removeEventListener('scroll', queueFloatingPosition, true);
        window.visualViewport?.removeEventListener('resize', queueFloatingPosition);
        window.visualViewport?.removeEventListener('scroll', queueFloatingPosition);
        suggestionList.classList.remove(floatingClassName);
        suggestionList.removeAttribute('style');
        if (originalSuggestionParent?.isConnected) {
          originalSuggestionParent.insertBefore(
            suggestionList,
            originalSuggestionNextSibling?.parentNode === originalSuggestionParent
              ? originalSuggestionNextSibling
              : null
          );
        } else {
          suggestionList.remove();
        }
      }
      hideSuggestions();
    }
  };
}
