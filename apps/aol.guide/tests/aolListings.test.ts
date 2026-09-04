import { describe, expect, it } from 'vitest';
import {
  buildAolApiSearchUrl,
  normalizeAolListing,
  sortListingsByDistance
} from '../lib/sources/aolListings.js';
import { sampleAolCourse } from './helpers.js';

describe('Art of Living live listings', () => {
  it('calls the public new-search-course API without hash-only or empty params', () => {
    const url = new URL(
      buildAolApiSearchUrl(
        {
          ctype: '313040,12371',
          lat: '13.032583',
          lng: '77.620806',
          distance: '60',
          type: 'search',
          country: 'in',
          has_voucher: '0',
          start_date_from: '2026-09-04',
          start_date_to: '2027-09-04',
          selectedLocName: '560045',
          mode: 'In Person',
          course_language: ''
        },
        { limit: 20, offset: 1 }
      )
    );

    expect(url.origin).toBe('https://www.artofliving.org');
    expect(url.pathname).toBe('/new-search-course');
    expect(url.searchParams.get('distance')).toBe('60');
    expect(url.searchParams.get('ctype')).toContain('313040');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('1');
    expect(url.searchParams.has('selectedLocName')).toBe(false);
    expect(url.searchParams.has('mode')).toBe(false);
    expect(url.searchParams.has('course_language')).toBe(false);
    expect(url.searchParams.has('is_online_event')).toBe(false);
  });

  it('normalizes official course JSON into listing cards', () => {
    const listing = normalizeAolListing(sampleAolCourse());
    expect(listing).toMatchObject({
      id: '1050180',
      title: 'Happiness Program (3 Days)',
      city: 'Bengaluru',
      pincode: '560060',
      location: 'MBR Shangri La Kengeri, Bengaluru, 560060',
      distanceKm: 19.2,
      isOnline: false,
      languages: ['English'],
      teachers: [],
      fee: '₹2500'
    });
    expect(listing?.registerUrl).toContain('artofliving.online');
    expect(listing?.detailUrl).toBe(
      'https://www.artofliving.org/in-en/program/1050180'
    );
    expect(listing?.schedule).toContain('2026-09-04 to 2026-09-06');
  });

  it('sorts listings by distance from the search location', () => {
    const far = normalizeAolListing(sampleAolCourse({ sao_id: 1, dist: 18000, title: 'Far' }));
    const near = normalizeAolListing(sampleAolCourse({ sao_id: 2, dist: 3000, title: 'Near' }));
    const unknown = normalizeAolListing(
      sampleAolCourse({
        sao_id: 3,
        title: 'Unknown',
        is_online_event: 1,
        dist: undefined
      })
    );
    const mid = normalizeAolListing(sampleAolCourse({ sao_id: 4, dist: 9000, title: 'Mid' }));
    expect(
      sortListingsByDistance([far, unknown, mid, near].filter((item) => item != null)).map(
        (item) => item.title
      )
    ).toEqual(['Near', 'Mid', 'Far', 'Unknown']);
  });
});
