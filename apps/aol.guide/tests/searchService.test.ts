import { describe, expect, it, vi } from 'vitest';
import { FOLLOW_UP_COURSE_TYPE_IDS } from '../lib/courseAliases.js';
import { OfficialSearchService } from '../lib/searchService.js';
import {
  aolListingsFetchMock,
  sampleAolCourse,
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
});
