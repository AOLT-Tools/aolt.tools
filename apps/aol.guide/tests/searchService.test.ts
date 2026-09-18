import { describe, expect, it, vi } from 'vitest';
import { FOLLOW_UP_COURSE_TYPE_IDS } from '../lib/courseAliases.js';
import { OfficialSearchService } from '../lib/searchService.js';
import {
  aolListingsFetchMock,
  sampleAolCourse,
  sampleVvmvpPageHtml,
  sequentialAolListingsFetchMock,
  testPincodeResolver
} from './helpers.js';

const now = new Date('2026-09-04T06:30:00.000Z');

function createService(fetchImpl?: typeof fetch) {
  return new OfficialSearchService({
    pincodeResolver: testPincodeResolver(),
    now,
    fetchImpl: fetchImpl || aolListingsFetchMock([sampleAolCourse()])
  });
}

describe('official search service', () => {
  it('does not call Gemini when the deterministic parser already handles the query', async () => {
    const parse = vi.fn(async () => null);
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      nlpParser: { parse },
      now,
      fetchImpl: aolListingsFetchMock([sampleAolCourse()])
    });
    const result = await service.search('HP near 560045 within 10km');
    expect(parse).not.toHaveBeenCalled();
    expect(result.usedGemini).toBe(false);
    expect(result.sources[0]?.source).toBe('aol');
    expect(result.sources[0]?.url).toContain('distance=10');
    expect(result.intent.pincodeResolved).toBe(true);
  });

  it('returns many official HP listings for PIN 560045 within 60km', async () => {
    const requested: string[] = [];
    const courses = [
      sampleAolCourse({ title: 'Happiness Program (3 Days)', sao_id: 1050180 }),
      sampleAolCourse({
        title: 'Online Meditation and Breath Workshop',
        sao_id: 961209,
        is_online_event: 1,
        city: 'Bengaluru'
      }),
      sampleAolCourse({ title: 'Happiness Program', sao_id: 1050400 })
    ];
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      now,
      fetchImpl: aolListingsFetchMock(courses, 3523, requested)
    });

    const result = await service.search('HP near 560045 within 60km');
    const aol = result.sources[0];
    const requestedUrl = requested[0] || '';

    expect(aol?.source).toBe('aol');
    expect(aol?.url).toContain('distance=60');
    expect(aol?.url).toContain('lat=13.041018');
    expect(aol?.url).not.toContain('is_online_event');
    expect(requestedUrl).toContain('https://www.artofliving.org/new-search-course');
    expect(requestedUrl).toContain('distance=60');
    expect(requestedUrl).toContain('ctype=313040');
    expect(requestedUrl).not.toContain('is_online_event');
    expect(aol?.listingTotal).toBe(3523);
    expect(aol?.listings).toHaveLength(3);
    expect(aol?.listings?.map((listing) => listing.title)).toEqual([
      'Happiness Program (3 Days)',
      'Online Meditation and Breath Workshop',
      'Happiness Program'
    ]);
  });

  it('keeps an unresolved PIN without substituting another location', async () => {
    const service = new OfficialSearchService({
      pincodeResolver: {
        resolve: async () => null
      },
      now,
      fetchImpl: aolListingsFetchMock([])
    });
    const result = await service.search('HP 999999');
    expect(result.intent.pincode).toBe('999999');
    expect(result.intent.latitude).toBeUndefined();
    expect(result.intent.longitude).toBeUndefined();
    expect(result.messages.join(' ')).toMatch(/could not be resolved/i);
    expect(result.sources[0]?.url).toContain('selectedLocName=999999');
    expect(result.sources[0]?.url).not.toContain('lat=');
  });

  it('uses VVMVP search= for Bangalore Ashram AMP', async () => {
    const service = createService();
    const result = await service.search('AMP Bangalore Ashram next weekend');
    expect(result.sources[0]?.source).toBe('vvmvp');
    expect(result.sources[0]?.url).toContain(
      'https://programs.vvmvp.org/ashrams/bangalore/'
    );
    expect(result.sources[0]?.url).toContain('search=AMP');
  });

  it('opens the canonical Vaidic Puja page for Rudra Puja', async () => {
    const service = createService();
    const result = await service.search('Rudra Puja this weekend');
    expect(result.sources.map((source) => source.source)).toEqual(['vds']);
    expect(result.sources[0]?.url).toBe('https://register.vaidicpujas.in/');
    expect(result.sources[0]?.listings).toBeUndefined();
  });

  it('searches Follow Up first when the query includes a teacher', async () => {
    const requested: string[] = [];
    const followUp = sampleAolCourse({
      title: 'Sudarshan Kriya Follow Up',
      sao_id: 2001,
      ctype: FOLLOW_UP_COURSE_TYPE_IDS[0],
      teachers: ['Alex']
    });
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      now,
      fetchImpl: sequentialAolListingsFetchMock(
        [
          {
            when: (url) => url.includes('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]),
            courses: [followUp],
            total: 1
          }
        ],
        requested
      )
    });

    const result = await service.search('teacher Alex near 560045 within 10km');
    const aol = result.sources[0];

    expect(requested).toHaveLength(1);
    expect(requested[0]).toContain('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]);
    expect(result.intent.courseCode).toBe('FOLLOW_UP');
    expect(result.interpretation).toEqual(
      expect.arrayContaining([{ label: 'Looking for', value: 'Follow Up' }])
    );
    expect(aol?.url).toContain('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]);
    expect(aol?.filters.course).toBe('Follow Up');
    expect(aol?.listings?.[0]?.title).toBe('Sudarshan Kriya Follow Up');
  });

  it('falls back to other programs when Follow Up has no listings', async () => {
    const requested: string[] = [];
    const other = sampleAolCourse({ title: 'Happiness Program', sao_id: 3001 });
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      now,
      fetchImpl: sequentialAolListingsFetchMock(
        [
          {
            when: (url) => url.includes('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]),
            courses: [],
            total: 0
          },
          {
            when: (url) =>
              url.includes('new-search-course') &&
              !url.includes('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]),
            courses: [other],
            total: 1
          }
        ],
        requested
      )
    });

    const result = await service.search('teacher Alex near 560045 within 10km');
    const aol = result.sources[0];

    expect(requested).toHaveLength(2);
    expect(requested[0]).toContain('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]);
    expect(requested[1]).not.toContain('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]);
    expect(result.intent.courseCode).toBeUndefined();
    expect(result.messages.join(' ')).toMatch(/No Follow Up/i);
    expect(aol?.listings?.[0]?.title).toBe('Happiness Program');
    expect(aol?.url).not.toContain('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]);
  });

  it('uses Mapbox coordinates for teacher search the same way as other in-person searches', async () => {
    const requested: string[] = [];
    const alexFollowUp = sampleAolCourse({
      title: 'Sudarshan Kriya Follow Up',
      sao_id: 2001,
      ctype: FOLLOW_UP_COURSE_TYPE_IDS[0],
      teachers: ['Alex Kumar']
    });
    const otherFollowUp = sampleAolCourse({
      title: 'Follow Up with Sam',
      sao_id: 2002,
      ctype: FOLLOW_UP_COURSE_TYPE_IDS[0],
      teachers: ['Sam']
    });
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      now,
      fetchImpl: aolListingsFetchMock([otherFollowUp, alexFollowUp], 2, requested)
    });
    const result = await service.search({
      query: 'teacher Alex',
      mode: 'in_person',
      location: {
        label: 'HSR Layout',
        latitude: 12.9121,
        longitude: 77.6446,
        city: 'Bengaluru',
        pincode: '560102'
      }
    });
    expect(result.sources.map((source) => source.source)).toEqual(['aol']);
    expect(result.intent.teacher).toBe('Alex');
    expect(result.intent.latitude).toBe(12.9121);
    expect(result.intent.longitude).toBe(77.6446);
    expect(result.intent.pincode).toBeUndefined();
    expect(requested[0]).toContain('lat=12.9121');
    expect(requested[0]).toContain('lng=77.6446');
    expect(requested[0]).toContain('is_online_event=0');
    expect(requested[0]).not.toContain('560102');
    expect(result.sources[0]?.listings?.map((listing) => listing.title)).toEqual([
      'Sudarshan Kriya Follow Up'
    ]);
  });

  it('keeps Mapbox coordinates when Follow Up has no matching teacher', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      now,
      fetchImpl: sequentialAolListingsFetchMock(
        [
          {
            when: (url) => url.includes('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]),
            courses: [
              sampleAolCourse({
                title: 'Follow Up with Sam',
                sao_id: 2002,
                ctype: FOLLOW_UP_COURSE_TYPE_IDS[0],
                teachers: ['Sam']
              })
            ],
            total: 1
          },
          {
            when: (url) =>
              url.includes('new-search-course') &&
              !url.includes('ctype=' + FOLLOW_UP_COURSE_TYPE_IDS[0]),
            courses: [
              sampleAolCourse({
                title: 'Happiness Program',
                sao_id: 3001,
                teachers: ['Alex Kumar']
              })
            ],
            total: 1
          }
        ],
        requested
      )
    });
    const result = await service.search({
      query: 'teacher Alex',
      mode: 'in_person',
      location: {
        label: 'HSR Layout',
        latitude: 12.9121,
        longitude: 77.6446,
        city: 'Bengaluru'
      }
    });
    expect(requested).toHaveLength(2);
    expect(requested[0]).toContain('lat=12.9121');
    expect(requested[1]).toContain('lat=12.9121');
    expect(result.intent.courseCode).toBeUndefined();
    expect(result.sources[0]?.listings?.[0]?.title).toBe('Happiness Program');
  });

  it('uses the In-person toggle with a Mapbox-selected location', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      now,
      fetchImpl: aolListingsFetchMock([sampleAolCourse()], 1, requested)
    });
    const result = await service.search({
      query: 'HP this weekend',
      mode: 'in_person',
      location: {
        label: 'HSR Layout',
        latitude: 12.9121,
        longitude: 77.6446,
        city: 'Bengaluru',
        pincode: '560102'
      }
    });
    expect(result.intent.deliveryMode).toBe('in_person');
    expect(result.intent.latitude).toBe(12.9121);
    expect(result.intent.longitude).toBe(77.6446);
    expect(result.intent.pincode).toBeUndefined();
    expect(requested[0]).toContain('lat=12.9121');
    expect(requested[0]).toContain('lng=77.6446');
    expect(requested[0]).not.toContain('560102');
    expect(requested[0]).toContain('is_online_event=0');
    expect(requested[0]).toContain('distance=10');
    expect(result.sources[0]?.url).toContain('lat=12.9121');
    expect(result.sources[0]?.url).toContain('lng=77.6446');
    expect(result.sources[0]?.url).toContain('selectedLocName=Bengaluru');
    expect(result.sources[0]?.url).not.toContain('selectedLocName=560102');
    expect(result.sources[0]?.url).not.toContain('560102');
  });

  it('uses the Online toggle and ignores location coordinates', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      now,
      fetchImpl: aolListingsFetchMock(
        [sampleAolCourse({ is_online_event: 1, dist: undefined })],
        1,
        requested
      )
    });
    const result = await service.search({
      query: 'HP this weekend',
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

  it('applies the Online time selector over query dates', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      now,
      fetchImpl: aolListingsFetchMock([sampleAolCourse()], 1, requested)
    });
    const result = await service.search({
      query: 'HP this weekend',
      mode: 'online',
      datePreset: 'today'
    });
    expect(result.intent.dateLabel).toBe('Today');
    expect(result.intent.dateFrom).toBe('2026-09-04');
    expect(requested[0]).toContain('start_date_from=2026-09-04');
    expect(requested[0]).toContain('start_date_to=2026-09-04');
  });

  it('uses a custom online date range on the official listings API', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
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
    const resolve = vi.fn();
    const service = new OfficialSearchService({
      pincodeResolver: { resolve },
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
        city: 'Bengaluru',
        pincode: '560077'
      } as never
    });
    expect(resolve).not.toHaveBeenCalled();
    expect(result.usedGemini).toBe(false);
    expect(result.intent.courseTypeIds).toEqual([]);
    expect(result.intent.radiusKm).toBe(3);
    expect(result.intent.latitude).toBe(13.041018);
    expect(result.intent.longitude).toBe(77.621558);
    expect(result.intent.pincode).toBeUndefined();
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

  it('loads live Bangalore Ashram listings for the Ashram catalogue', async () => {
    const requested: string[] = [];
    const service = new OfficialSearchService({
      pincodeResolver: testPincodeResolver(),
      now,
      fetchImpl: (async (input: Parameters<typeof fetch>[0]) => {
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
      }) as typeof fetch
    });
    const result = await service.search({ source: 'vvmvp' });
    expect(requested[0]).toContain('https://programs.vvmvp.org/ashrams/bangalore/');
    expect(result.usedGemini).toBe(false);
    expect(result.intent.ashramMentioned).toBe(true);
    expect(result.sources[0]?.source).toBe('vvmvp');
    expect(result.sources[0]?.listingCategories).toEqual([
      'Advanced Programs',
      'Beginner Programs',
      'Children and Teens',
      'Online Programs',
      'Guru Puja Programs'
    ]);
    expect(result.sources[0]?.listings?.some((listing) => listing.title === 'Vasad Happiness Program')).toBe(
      false
    );
    expect(result.sources[0]?.listings?.[0]?.category).toBe('Beginner Programs');
    expect(result.sources[0]?.listings?.find((listing) => listing.id === '4134')?.registerUrl).toBe(
      'https://programs.vvmvp.org/events/4134'
    );
  });
});
