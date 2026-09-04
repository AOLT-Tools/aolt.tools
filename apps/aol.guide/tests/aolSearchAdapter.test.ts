import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from '../lib/queryParser.js';
import { resolvePincodeCoordinates } from '../lib/searchService.js';
import { buildAolFilters, buildAolSearchUrl } from '../lib/sources/aolSearchAdapter.js';
import { SAMPLE_PIN_560045, testPincodeResolver } from './helpers.js';

const now = new Date('2026-09-04T06:30:00.000Z');

describe('Art of Living official URL generation', () => {
  it('builds a filtered AOL URL for HP near 560045 within 10km', async () => {
    const resolver = testPincodeResolver();
    const pin = await resolver.resolve('560045');
    expect(pin).toMatchObject({
      pincode: '560045',
      latitude: SAMPLE_PIN_560045.latitude,
      longitude: SAMPLE_PIN_560045.longitude
    });

    const intent = await resolvePincodeCoordinates(
      parseSearchQuery('HP near 560045 within 10km', { now }),
      resolver
    );
    const filters = buildAolFilters(intent, now);
    const url = buildAolSearchUrl(filters);

    expect(url.startsWith('https://www.artofliving.org/in-en/search/course#')).toBe(
      true
    );
    expect(url).toContain('selectedLocName=560045');
    expect(url).toContain('distance=10');
    expect(url).toContain('lat=' + String(pin!.latitude));
    expect(url).toContain('lng=' + String(pin!.longitude));
    expect(url).toContain('country=in');
    expect(url).toContain('type=search');
    expect(filters.ctype.split(',')).toContain('313040');
    expect(url).toContain('313040');
    expect(url).not.toContain('is_online_event');
    expect(filters).not.toHaveProperty('is_online_event');
    expect(filters).not.toHaveProperty('course_language');
  });

  it('builds a 60km HP search without empty online/language hash params', async () => {
    const resolver = testPincodeResolver();
    const pin = await resolver.resolve('560045');
    const intent = await resolvePincodeCoordinates(
      parseSearchQuery('HP near 560045 within 60km', { now }),
      resolver
    );
    const filters = buildAolFilters(intent, now);
    const url = buildAolSearchUrl(filters);

    expect(filters.distance).toBe('60');
    expect(url).toContain('distance=60');
    expect(url).toContain('selectedLocName=560045');
    expect(url).toContain('lat=' + String(pin!.latitude));
    expect(url).toContain('lng=' + String(pin!.longitude));
    expect(url).not.toMatch(/is_online_event=/);
    expect(url).not.toMatch(/course_language=/);
    expect(url).not.toMatch(/include_private=/);
    expect(filters.ctype.split(',')).toEqual(
      expect.arrayContaining(['313040', '12371', '338000', '510212', '74889'])
    );
  });

  it('maps Hindi, weekend dates, and in-person/online when specified', async () => {
    const resolver = testPincodeResolver();
    const weekend = await resolvePincodeCoordinates(
      parseSearchQuery('HP 560045 Hindi this weekend', { now }),
      resolver
    );
    const weekendFilters = buildAolFilters(weekend, now);
    expect(weekendFilters.course_language).toBe('hi');
    expect(weekendFilters.start_date_from).toBe('2026-09-05');
    expect(weekendFilters.start_date_to).toBe('2026-09-06');
    expect(weekendFilters.selectedLocName).toBe('560045');
    expect(weekendFilters).not.toHaveProperty('is_online_event');

    const online = buildAolFilters(parseSearchQuery('HP online', { now }), now);
    expect(online.is_online_event).toBe('1');
    expect(online.mode).toBe('Online');

    const inPersonFilters = buildAolFilters(
      await resolvePincodeCoordinates(
        parseSearchQuery('HP 560045 in person', { now }),
        resolver
      ),
      now
    );
    expect(inPersonFilters.is_online_event).toBe('0');
    expect(inPersonFilters.mode).toBe('In Person');
  });
});
