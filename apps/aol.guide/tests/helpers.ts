import {
  createStaticPincodeCoordinateResolver,
  type PincodeCoordinate,
  type PincodeCoordinateResolver
} from '../lib/pincodeCoordinates.js';

export const SAMPLE_PIN_560045: PincodeCoordinate = {
  pincode: '560045',
  latitude: 13.041018,
  longitude: 77.621558,
  city: 'Bengaluru',
  state: 'Karnataka'
};

export function testPincodeResolver(
  records: readonly PincodeCoordinate[] = [SAMPLE_PIN_560045]
): PincodeCoordinateResolver {
  return createStaticPincodeCoordinateResolver(records);
}

export function sampleAolCourse(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Happiness Program (3 Days)',
    sao_id: 1050180,
    course_id: 'P133813',
    ctype: '74889',
    start_date: '2026-09-04 00:00:00',
    end_date: '2026-09-06 00:00:00',
    weekday_timings: '12:00 AM  - 8:00 PM ',
    weekend_timings: '2:00 PM  - 4:00 PM ',
    address_short: 'MBR Shangri La Kengeri, Bengaluru, 560060',
    city: 'Bengaluru',
    zip_postal_code: '560060',
    dist: 19152.01029893596,
    is_online_event: 0,
    course_language: ['en'],
    teachers: [],
    course_fee: '2500.00',
    currency: 'INR',
    register_url:
      'https://www.artofliving.online/registration.php?event_id=1050180&ct_id=535',
    link: 'www.artofliving.org/in-en/program/1050180',
    ...overrides
  };
}

export function sequentialAolListingsFetchMock(
  pages: Array<{
    when: (url: string) => boolean;
    courses: unknown[];
    total?: number;
  }>,
  requestedUrls?: string[]
): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0]) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    requestedUrls?.push(url);
    const page = pages.find((entry) => entry.when(url)) || {
      courses: [] as unknown[],
      total: 0
    };
    return new Response(
      JSON.stringify({
        courses: page.courses,
        total: page.total ?? page.courses.length,
        limit: 20,
        offset: 1
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  }) as typeof fetch;
}

export function aolListingsFetchMock(
  courses: unknown[],
  total = courses.length,
  requestedUrls?: string[]
): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0]) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    requestedUrls?.push(url);
    return new Response(
      JSON.stringify({
        courses,
        total,
        limit: 20,
        offset: 1
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  }) as typeof fetch;
}
