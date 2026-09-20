import { describe, expect, it } from 'vitest';
import { FOLLOW_UP_COURSE_TYPE_IDS } from '../lib/courseAliases.js';
import { parseSearchSource } from '../lib/searchRequest.js';
import { OfficialSearchService } from '../lib/searchService.js';
import {
  aolListingsFetchMock,
  sampleAolCourse,
  sampleVvmvpPageHtml
} from './helpers.js';

const now = new Date('2026-09-04T06:30:00.000Z');

function createService(fetchImpl?: typeof fetch) {
  return new OfficialSearchService({
    now,
    fetchImpl: fetchImpl || aolListingsFetchMock([sampleAolCourse()])
  });
}

describe('official search service', () => {
  it('uses a custom online date range on the official listings API', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      now,
      fetchImpl: aolListingsFetchMock(
        [sampleAolCourse({ is_online_event: 1, dist: undefined })],
        1,
        requested
      )
    });
    const result = await service.search({
      source: 'aol',
      mode: 'online',
      datePreset: 'custom',
      dateFrom: '2026-09-12',
      dateTo: '2026-09-20'
    });
    expect(result.intent.dateFrom).toBe('2026-09-12');
    expect(result.intent.dateTo).toBe('2026-09-20');
    expect(result.intent.dateLabel).toBe('2026-09-12 to 2026-09-20');
    expect(requested[0]).toContain('start_date_from=2026-09-12');
    expect(requested[0]).toContain('start_date_to=2026-09-20');
    expect(requested[0]).toContain('is_online_event=1');
  });

  it('searches the Courses catalogue by Mapbox coordinates and ignores the place pincode', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      now,
      fetchImpl: aolListingsFetchMock([sampleAolCourse()], 1, requested)
    });
    const result = await service.search({
      source: 'aol',
      mode: 'in_person',
      radiusKm: 3,
      location: {
        label: 'MSR North City',
        latitude: 13.041018,
        longitude: 77.621558,
        city: 'Bengaluru'
      }
    });
    expect(result.intent.courseTypeIds).toEqual([]);
    expect(result.intent.radiusKm).toBe(3);
    expect(result.intent.latitude).toBe(13.041018);
    expect(result.intent.longitude).toBe(77.621558);
    expect(result.intent.pincode).toBeUndefined();
    expect(requested).toHaveLength(1);
    expect(requested[0]).toContain('lat=13.041018');
    expect(requested[0]).toContain('lng=77.621558');
    expect(requested[0]).toContain('type=search');
    expect(requested[0]).toContain('distance=3');
    expect(requested[0]).not.toContain('ctype=');
    expect(requested[0]).not.toContain('560077');
    expect(result.sources[0]?.url).toContain('lat=13.041018');
    expect(result.sources[0]?.url).toContain('lng=77.621558');
    expect(result.sources[0]?.url).toContain('selectedLocName=Bengaluru');
    expect(result.sources[0]?.url).not.toContain('560077');
    expect(result.sources[0]?.listings?.[0]?.category).toBe('beginner');
  });

  it('parses the Center catalogue source', () => {
    expect(parseSearchSource('center')).toBe('center');
    expect(parseSearchSource('aol')).toBe('aol');
  });

  it('drops Follow-up and Satsang from the Courses catalogue', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      now,
      fetchImpl: aolListingsFetchMock(
        [
          sampleAolCourse(),
          sampleAolCourse({
            title: 'Sudarshan Kriya Follow Up',
            sao_id: 2001,
            ctype: FOLLOW_UP_COURSE_TYPE_IDS[0]
          }),
          sampleAolCourse({
            title: 'Weekly Satsang',
            sao_id: 2002,
            ctype: ''
          })
        ],
        3,
        requested
      )
    });
    const result = await service.search({
      source: 'aol',
      mode: 'in_person',
      radiusKm: 10,
      location: {
        label: 'HSR Layout',
        latitude: 12.9121,
        longitude: 77.6446,
        city: 'Bengaluru'
      }
    });
    expect(requested[0]).toContain('lat=12.9121');
    expect(result.sources[0]?.listings?.map((listing) => listing.title)).toEqual([
      'Happiness Program (3 Days)'
    ]);
  });

  it('keeps only Follow-up and Satsang in the Center catalogue', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      now,
      fetchImpl: aolListingsFetchMock(
        [
          sampleAolCourse(),
          sampleAolCourse({
            title: 'Sudarshan Kriya Follow Up',
            sao_id: 2001,
            ctype: FOLLOW_UP_COURSE_TYPE_IDS[0]
          }),
          sampleAolCourse({
            title: 'Weekly Satsang',
            sao_id: 2002,
            ctype: ''
          })
        ],
        3,
        requested
      )
    });
    const result = await service.search({
      source: 'center',
      radiusKm: 3,
      location: {
        label: 'HSR Layout',
        latitude: 12.9121,
        longitude: 77.6446,
        city: 'Bengaluru'
      }
    });
    expect(result.sources[0]?.source).toBe('center');
    expect(result.intent.deliveryMode).toBe('in_person');
    expect(requested[0]).toContain('lat=12.9121');
    expect(requested[0]).toContain('lng=77.6446');
    expect(requested[0]).toContain('distance=3');
    expect(requested[0]).toContain('is_online_event=0');
    expect(result.sources[0]?.listings?.map((listing) => listing.title)).toEqual([
      'Sudarshan Kriya Follow Up',
      'Weekly Satsang'
    ]);
  });

  it('uses the Online toggle and ignores location coordinates', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      now,
      fetchImpl: aolListingsFetchMock(
        [sampleAolCourse({ is_online_event: 1, dist: undefined })],
        1,
        requested
      )
    });
    const result = await service.search({
      source: 'aol',
      mode: 'online',
      datePreset: 'anytime',
      location: {
        label: 'HSR Layout',
        latitude: 12.9121,
        longitude: 77.6446
      }
    });
    expect(result.intent.deliveryMode).toBe('online');
    expect(result.intent.dateLabel).toBeUndefined();
    expect(requested[0]).toContain('is_online_event=1');
    expect(requested[0]).not.toContain('lat=');
  });

  it('applies the Online time selector', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      now,
      fetchImpl: aolListingsFetchMock([sampleAolCourse()], 1, requested)
    });
    const result = await service.search({
      source: 'aol',
      mode: 'online',
      datePreset: 'today'
    });
    expect(result.intent.dateLabel).toBe('Today');
    expect(result.intent.dateFrom).toBe('2026-09-04');
    expect(requested[0]).toContain('start_date_from=2026-09-04');
    expect(requested[0]).toContain('start_date_to=2026-09-04');
  });

  it('loads live Bangalore Ashram listings for the Ashram catalogue', async () => {
    const requested: string[] = [];
    const service = createService((async (input: Parameters<typeof fetch>[0]) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      requested.push(url);
      return new Response(sampleVvmvpPageHtml(), {
        status: 200,
        headers: { 'content-type': 'text/html' }
      });
    }) as typeof fetch);
    const result = await service.search({ source: 'vvmvp' });
    expect(requested[0]).toContain('https://programs.vvmvp.org/ashrams/bangalore/');
    expect(result.intent.ashramMentioned).toBe(true);
    expect(result.sources[0]?.source).toBe('vvmvp');
    expect(result.sources[0]?.listingCategories).toEqual([
      'Advanced Programs',
      'Beginner Programs',
      'Children and Teens',
      'Online Programs',
      'Guru Puja Programs'
    ]);
    expect(
      result.sources[0]?.listings?.some((listing) => listing.title === 'Vasad Happiness Program')
    ).toBe(false);
    expect(result.sources[0]?.listings?.[0]?.category).toBe('Beginner Programs');
    expect(result.sources[0]?.listings?.find((listing) => listing.id === '4134')?.registerUrl).toBe(
      'https://programs.vvmvp.org/events/4134'
    );
  });
});
