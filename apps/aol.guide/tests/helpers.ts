import type { ResolvedSearchIntent } from '../lib/searchIntent.js';

export const SAMPLE_COORDS = {
  latitude: 13.041018,
  longitude: 77.621558,
  city: 'Bengaluru'
} as const;

export function testIntent(
  overrides: Partial<ResolvedSearchIntent> = {}
): ResolvedSearchIntent {
  return {
    rawQuery: '',
    confidence: 'high',
    courseTypeIds: [],
    ashramMentioned: false,
    vdsMentioned: false,
    courseMentioned: false,
    pincodeResolved: false,
    messages: [],
    ...overrides
  };
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

export function sampleVvmvpEvent(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: '4134',
    name: 'Sahaj Samadhi Dhyan Yoga (18 - 20 September 2026)',
    ashram_id: '1',
    slug: 'bangalore',
    category_id: '2',
    category: 'Beginner Programs',
    program_category: 'Beginner Programs',
    event_start: '2026-09-18 17:15:00',
    event_end: '2026-09-20 13:00:00',
    mode: 'residential',
    languages: ['1', '2'],
    ashramName: 'Bangalore Ashram, Bangalore, Karnataka',
    from: '18th',
    to: '20th Sep, 2026',
    ...overrides
  };
}

export function sampleVvmvpPageHtml(
  events: Record<string, unknown>[] = [
    sampleVvmvpEvent(),
    sampleVvmvpEvent({
      id: '4200',
      name: 'Weekly 4 Days AMP (24 - 27 September 2026)',
      category_id: '1',
      category: 'Advanced Programs',
      program_category: 'Advanced Programs',
      event_start: '2026-09-24 06:30:00',
      event_end: '2026-09-27 13:00:00',
      from: '24th',
      to: '27th Sep, 2026'
    }),
    sampleVvmvpEvent({
      id: '4300',
      name: 'Intuition Process for Teens',
      category_id: '6',
      category: 'Children and Teens',
      program_category: 'Children and Teens',
      event_start: '2026-10-02 09:00:00',
      event_end: '2026-10-04 17:00:00',
      from: '2nd',
      to: '4th Oct, 2026'
    }),
    sampleVvmvpEvent({
      id: '4400',
      name: 'Online Home-Grown Home Cooked',
      category_id: '7',
      category: 'Online Programs',
      program_category: 'Online Programs',
      event_start: '2026-10-03 09:00:00',
      event_end: '2026-10-10 23:30:00',
      mode: 'online',
      from: '3rd',
      to: '10th Oct, 2026'
    }),
    sampleVvmvpEvent({
      id: '99',
      name: 'Guru Puja',
      category_id: '4',
      category: 'Guru Puja Programs',
      program_category: 'Guru Puja Programs',
      event_start: '2026-11-01 09:00:00',
      event_end: '2026-11-01 11:00:00',
      from: '1st',
      to: '1st Nov, 2026'
    }),
    sampleVvmvpEvent({
      id: '5000',
      name: 'Vasad Happiness Program',
      ashram_id: '2',
      slug: 'vasad',
      ashramName: 'Vasad Ashram'
    })
  ]
): string {
  const payload = {
    nonce: 'test',
    url: 'https://programs.vvmvp.org/wp-json/vvmvp/v2',
    programs: [
      { id: '15', category: 'Advanced Programs', category_id: '1', program: 'AMP' },
      { id: '1', category: 'Beginner Programs', category_id: '2', program: 'HP' },
      { id: '20', category: 'Health', category_id: '8', program: 'Health' },
      { id: '30', category: 'Children and Teens', category_id: '6', program: 'Kids' },
      { id: '39', category: 'Online Programs', category_id: '7', program: 'Online' },
      { id: '40', category: 'Guru Puja Programs', category_id: '4', program: 'Guru Puja' }
    ],
    languages: [
      { id: '1', language: 'English' },
      { id: '2', language: 'Hindi' }
    ],
    ashrams: [
      {
        id: '1',
        slug: 'bangalore',
        ashram: 'Bangalore Ashram',
        city: 'Bangalore',
        address: '21st KM, Kanakapura Road, Udayapura, Bangalore – 560082'
      },
      { id: '2', slug: 'vasad', ashram: 'Vasad Ashram' }
    ],
    events
  };
  return `<!doctype html><html><body><script>
var vvmvp_event_list = ${JSON.stringify(payload)};
//# sourceURL=vvmvp-event-list-js-extra
</script></body></html>`;
}
