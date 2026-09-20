import { describe, expect, it } from 'vitest';
import { findCourseAliasByCode } from '../lib/courseAliases.js';
import { resolveDatePreset } from '../lib/dateRanges.js';
import { buildAolFilters, buildAolSearchUrl } from '../lib/sources/aolSearchAdapter.js';
import { SAMPLE_COORDS, testIntent } from './helpers.js';

const now = new Date('2026-09-04T06:30:00.000Z');

function hpIntent(overrides: Parameters<typeof testIntent>[0] = {}) {
  const alias = findCourseAliasByCode('HP');
  return testIntent({
    courseCode: 'HP',
    courseLabel: alias?.label,
    courseTypeIds: [...(alias?.typeIds || [])],
    courseMentioned: true,
    latitude: SAMPLE_COORDS.latitude,
    longitude: SAMPLE_COORDS.longitude,
    city: SAMPLE_COORDS.city,
    pincodeResolved: true,
    ...overrides
  });
}

describe('Art of Living official URL generation', () => {
  it('builds a filtered AOL URL for HP near Bengaluru within 10km', () => {
    const intent = hpIntent({ radiusKm: 10 });
    const filters = buildAolFilters(intent, now);
    const url = buildAolSearchUrl(filters);

    expect(url.startsWith('https://www.artofliving.org/in-en/search/course#')).toBe(
      true
    );
    expect(url).toContain('selectedLocName=Bengaluru');
    expect(url).toContain('distance=10');
    expect(url).toContain('lat=' + String(SAMPLE_COORDS.latitude));
    expect(url).toContain('lng=' + String(SAMPLE_COORDS.longitude));
    expect(url).toContain('country=in');
    expect(url).toContain('type=search');
    expect(filters.ctype.split(',')).toContain('313040');
    expect(url).toContain('313040');
    expect(url).not.toContain('is_online_event');
    expect(filters).not.toHaveProperty('is_online_event');
    expect(filters).not.toHaveProperty('course_language');
  });

  it('builds a 60km HP search without empty online/language hash params', () => {
    const intent = hpIntent({ radiusKm: 60 });
    const filters = buildAolFilters(intent, now);
    const url = buildAolSearchUrl(filters);

    expect(filters.distance).toBe('60');
    expect(url).toContain('distance=60');
    expect(url).toContain('selectedLocName=Bengaluru');
    expect(url).toContain('lat=' + String(SAMPLE_COORDS.latitude));
    expect(url).toContain('lng=' + String(SAMPLE_COORDS.longitude));
    expect(url).not.toMatch(/is_online_event=/);
    expect(url).not.toMatch(/course_language=/);
    expect(url).not.toMatch(/include_private=/);
    expect(filters.ctype.split(',')).toEqual(
      expect.arrayContaining(['313040', '12371', '338000', '510212', '74889'])
    );
  });

  it('maps Hindi, weekend dates, and in-person/online when specified', () => {
    const weekend = resolveDatePreset('this_weekend', now);
    const weekendFilters = buildAolFilters(
      hpIntent({
        language: 'Hindi',
        dateFrom: weekend?.start,
        dateTo: weekend?.end,
        dateLabel: weekend?.label
      }),
      now
    );
    expect(weekendFilters.course_language).toBe('hi');
    expect(weekendFilters.start_date_from).toBe('2026-09-05');
    expect(weekendFilters.start_date_to).toBe('2026-09-06');
    expect(weekendFilters.selectedLocName).toBe('Bengaluru');
    expect(weekendFilters).not.toHaveProperty('is_online_event');

    const online = buildAolFilters(
      hpIntent({
        deliveryMode: 'online',
        latitude: undefined,
        longitude: undefined,
        city: undefined,
        radiusKm: undefined,
        pincodeResolved: false
      }),
      now
    );
    expect(online.is_online_event).toBe('1');
    expect(online.mode).toBe('Online');

    const inPersonFilters = buildAolFilters(
      hpIntent({ deliveryMode: 'in_person' }),
      now
    );
    expect(inPersonFilters.is_online_event).toBe('0');
    expect(inPersonFilters.mode).toBe('In Person');
  });
});
