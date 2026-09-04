async function inspect(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await response.text();
  const headers = Object.fromEntries(response.headers.entries());
  const scripts = [...html.matchAll(/src=["']([^"']+)["']/gi)].map((match) => match[1]);
  return {
    url,
    finalUrl: response.url,
    status: response.status,
    frame: headers['x-frame-options'] || null,
    csp: (headers['content-security-policy'] || '').slice(0, 600),
    length: html.length,
    scripts,
    html
  };
}

function findSnippets(source, needles) {
  const hits = [];
  for (const needle of needles) {
    const index = source.toLowerCase().indexOf(needle.toLowerCase());
    if (index >= 0) {
      hits.push({
        needle,
        snippet: source.slice(Math.max(0, index - 160), index + 280)
      });
    }
  }
  return hits;
}

function summarizeHtml(info) {
  const { html, ...rest } = info;
  return {
    ...rest,
    title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '',
    nextData: Boolean(html.match(/<script id="__NEXT_DATA__"/i)),
    vvmvpPayload: Boolean(html.match(/var\s+vvmvp_event_list\s*=/)),
    hashHints: findSnippets(html, [
      'ctype',
      'selectedLocName',
      'is_online_event',
      'searchParams',
      'filter',
      '/api'
    ])
  };
}

const pages = {};
for (const url of [
  'https://www.artofliving.org/in-en/search/course',
  'https://programs.vvmvp.org/ashrams/bangalore/',
  'https://register.vaidicpujas.in/',
  'https://register.vaidicpujas.in/?search=rudra',
  'https://register.vaidicpujas.in/?q=rudra'
]) {
  try {
    const info = await inspect(url);
    pages[url] = summarizeHtml(info);
    if (url === 'https://www.artofliving.org/in-en/search/course') {
      pages.aolScripts = info.scripts;
      pages.aolHtml = info.html;
    }
    if (url === 'https://programs.vvmvp.org/ashrams/bangalore/') {
      pages.vvmvpScripts = info.scripts;
      pages.vvmvpHtml = info.html;
    }
    if (url === 'https://register.vaidicpujas.in/') {
      pages.vdsScripts = info.scripts;
      pages.vdsHtml = info.html;
    }
  } catch (error) {
    pages[url] = { error: String(error) };
  }
}

const aolHtml = pages.aolHtml || '';
const aolScriptCandidates = (pages.aolScripts || [])
  .filter((src) => /course|search|filter|bundle/i.test(src))
  .slice(0, 20);

console.log(
  JSON.stringify(
    {
      aol: pages['https://www.artofliving.org/in-en/search/course'],
      vvmvp: pages['https://programs.vvmvp.org/ashrams/bangalore/'],
      vds: pages['https://register.vaidicpujas.in/'],
      vdsSearch: pages['https://register.vaidicpujas.in/?search=rudra'],
      vdsQ: pages['https://register.vaidicpujas.in/?q=rudra'],
      aolScriptCandidates
    },
    null,
    2
  )
);

const nextData = (pages.vdsHtml || '').match(
  /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
);
if (nextData?.[1]) {
  const payload = JSON.parse(nextData[1]);
  console.log(
    'VDS NEXT',
    JSON.stringify(
      {
        page: payload.page,
        query: payload.query,
        buildId: payload.buildId,
        dataKeys: Object.keys(payload.props?.pageProps || {}),
        pagePropsSample: Object.fromEntries(
          Object.entries(payload.props?.pageProps || {}).map(([key, value]) => [
            key,
            Array.isArray(value)
              ? { arrayLength: value.length, sample: value[0] }
              : typeof value
          ])
        )
      },
      null,
      2
    )
  );
}

const vvmvpPayload = (pages.vvmvpHtml || '').match(
  /var\s+vvmvp_event_list\s*=\s*(\{[\s\S]*?\});\s*\/\/# sourceURL=vvmvp-event-list-js-extra/
);
console.log('VVMVP inline payload found', Boolean(vvmvpPayload));

for (const src of aolScriptCandidates.slice(0, 8)) {
  const url = src.startsWith('http')
    ? src
    : new URL(src, 'https://www.artofliving.org/in-en/search/course').toString();
  try {
    const text = await (await fetch(url)).text();
    console.log(
      JSON.stringify(
        {
          url,
          bytes: text.length,
          hits: findSnippets(text, [
            'selectedLocName',
            'is_online_event',
            'course_language',
            'start_date_from',
            'ctype',
            'location.hash',
            'new-search-course',
            'distance'
          ])
        },
        null,
        2
      )
    );
  } catch (error) {
    console.log(JSON.stringify({ url, error: String(error) }));
  }
}

const vdsChunks = (pages.vdsScripts || [])
  .filter((src) => /chunk|page|app/i.test(src))
  .slice(0, 12);
for (const src of vdsChunks) {
  const url = src.startsWith('http')
    ? src
    : new URL(src, 'https://register.vaidicpujas.in/').toString();
  try {
    const text = await (await fetch(url)).text();
    const hits = findSnippets(text, [
      'searchParams',
      'useSearchParams',
      'filter',
      'query',
      'router.push',
      '/api',
      'event_id'
    ]);
    if (hits.length) {
      console.log(JSON.stringify({ url, bytes: text.length, hits }, null, 2));
    }
  } catch (error) {
    console.log(JSON.stringify({ url, error: String(error) }));
  }
}

const vvmvpScripts = (pages.vvmvpScripts || [])
  .filter((src) => /list-event|event|filter|search/i.test(src))
  .slice(0, 8);
for (const src of vvmvpScripts) {
  const url = src.startsWith('http')
    ? src
    : new URL(src, 'https://programs.vvmvp.org/ashrams/bangalore/').toString();
  try {
    const text = await (await fetch(url)).text();
    console.log(
      JSON.stringify(
        {
          url,
          bytes: text.length,
          hits: findSnippets(text, [
            'URLSearchParams',
            'location.search',
            'location.hash',
            'filter',
            'ashram',
            'history.pushState'
          ])
        },
        null,
        2
      )
    );
  } catch (error) {
    console.log(JSON.stringify({ url, error: String(error) }));
  }
}
