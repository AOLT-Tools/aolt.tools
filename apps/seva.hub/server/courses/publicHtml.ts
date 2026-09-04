import {
  programLabelFor,
  publicCourseProgramKey,
  publicCoursesPath
} from '../../shared/contracts/courseDefaults.mjs';
import { fillCourseWhatsappTemplate } from '../../shared/contracts/courseMatching.js';

export const PUBLIC_COURSE_CONTENT_FIELDS = [
  'title',
  'detailsText',
  'imageUrl'
] as const;

export type PublicCourseView = {
  id: string;
  title: string;
  courseType: string;
  programCode: string;
  programLabel: string;
  detailsText: string;
  hasImage: boolean;
  imageUrl: string;
};

function escapeHtml(value: string): string {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatWhatsappHtml(raw: string): string {
  const placeholders: string[] = [];
  const stash = (html: string): string => {
    const token = '\u0000PH' + String(placeholders.length) + '\u0000';
    placeholders.push(html);
    return token;
  };

  let text = String(raw || '');
  text = text.replace(/```([^`]+)```/g, (_match, code: string) =>
    stash('<code>' + escapeHtml(code) + '</code>')
  );
  text = text.replace(/https?:\/\/[^\s<]+|www\.[^\s<]+/gi, (url: string) => {
    const clean = url.replace(/[),.;!?*_~]+$/g, '');
    const suffix = url.slice(clean.length);
    const href = /^https?:\/\//i.test(clean) ? clean : 'https://' + clean;
    return (
      stash(
        '<a href="' +
          escapeHtml(href) +
          '" rel="noopener noreferrer" target="_blank">' +
          escapeHtml(clean) +
          '</a>'
      ) + suffix
    );
  });
  text = text.replace(/(?<!\d)(?:\+91[\s-]*)?[6-9]\d{9}(?!\d)/g, (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const href =
      digits.length === 12 && digits.startsWith('91') ? '+' + digits : digits;
    return stash(
      '<a href="tel:' + escapeHtml(href) + '">' + escapeHtml(phone) + '</a>'
    );
  });
  text = text.replace(/_\*([^*\n]+)\*_/g, (_match, inner: string) =>
    stash('<em><strong>' + escapeHtml(inner) + '</strong></em>')
  );
  text = text.replace(/\*_([^_\n]+)_\*/g, (_match, inner: string) =>
    stash('<strong><em>' + escapeHtml(inner) + '</em></strong>')
  );
  text = text.replace(/\*([^*\n]+)\*/g, (_match, inner: string) =>
    stash('<strong>' + escapeHtml(inner) + '</strong>')
  );
  text = text.replace(/_([^_\n]+)_/g, (_match, inner: string) =>
    stash('<em>' + escapeHtml(inner) + '</em>')
  );
  text = text.replace(/~([^~\n]+)~/g, (_match, inner: string) =>
    stash('<s>' + escapeHtml(inner) + '</s>')
  );
  text = escapeHtml(text);
  for (let index = placeholders.length - 1; index >= 0; index -= 1) {
    text = text.replaceAll('\u0000PH' + String(index) + '\u0000', placeholders[index]);
  }
  return text;
}

function absoluteImageUrl(origin: string, course: PublicCourseView): string {
  void origin;
  const stored = String(course.imageUrl || '').trim();
  if (/^https:\/\//i.test(stored)) {
    return stored;
  }
  return '';
}

export function toPublicCourseView(course: {
  id: string;
  title?: string;
  courseType?: string;
  programCode?: string;
  whatsappTemplate?: string;
  hasImage?: boolean;
  imageUrl?: string;
}): PublicCourseView {
  const courseType = course.courseType || '';
  const programCode = course.programCode || '';
  const title = course.title || '';
  const detailsText = fillCourseWhatsappTemplate(course.whatsappTemplate || '', {
    name: '',
    course: title,
    dates: '',
    registrationLink: ''
  }).trim();
  return {
    id: course.id,
    title,
    courseType,
    programCode,
    programLabel: programLabelFor(courseType, programCode),
    detailsText,
    hasImage: Boolean(course.hasImage || course.imageUrl),
    imageUrl: String(course.imageUrl || '').trim()
  };
}

function courseDisplayTitle(course: PublicCourseView): string {
  return (
    String(course.title || '').trim() ||
    String(course.programLabel || '').trim() ||
    String(course.courseType || '').trim() ||
    'Course'
  );
}

function courseMetaLabel(course: PublicCourseView): string {
  const type = String(course.courseType || '').trim();
  const program = String(course.programLabel || '').trim();
  return [type, program].filter(Boolean).join(' - ');
}

function renderPanel(
  origin: string,
  course: PublicCourseView,
  selected: boolean
): string {
  const imageUrl = absoluteImageUrl(origin, course);
  const title = courseDisplayTitle(course);
  const meta = courseMetaLabel(course);
  const image = imageUrl
    ? `<figure class="media"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="${selected ? 'eager' : 'lazy'}" /></figure>`
    : '<div class="media placeholder" aria-hidden="true"><span>Art of Living</span></div>';
  const eyebrow = meta ? `<p class="eyebrow">${escapeHtml(meta)}</p>` : '';
  const heading = `<header class="course-heading">${eyebrow}<h1>${escapeHtml(title)}</h1></header>`;
  const details = course.detailsText
    ? `<div class="details">${formatWhatsappHtml(course.detailsText)}</div>`
    : '<p class="empty-details">Details will be shared soon.</p>';
  return `<article class="course-layout">${image}<section class="content">${heading}${details}</section></article>`;
}

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Course not found</title>
  </head>
  <body>
    <main>
      <h1>Course not found</h1>
      <p>This course is not available.</p>
    </main>
  </body>
</html>`;

export function renderPublicCourseHtml(options: {
  selected?: PublicCourseView | null;
  courses?: PublicCourseView[];
  origin: string;
  programKey?: string;
}): { status: number; html: string } {
  const courses = (
    options.courses && options.courses.length
      ? options.courses
      : options.selected
        ? [options.selected]
        : []
  ).filter(Boolean);
  const selected = options.selected || courses[0] || null;
  if (!selected) {
    return { status: 404, html: NOT_FOUND_HTML };
  }

  const origin = options.origin.replace(/\/$/, '');
  const programKey = String(options.programKey || '')
    .trim()
    .toLowerCase();
  const pageUrl = origin + publicCoursesPath(programKey);
  const pageTitle = programKey ? courseDisplayTitle(selected) : 'Seva Hub Courses';
  const showTabs = courses.length > 1;
  let tabs = '';
  let panels = `<div class="panels"><section class="panel active">${renderPanel(origin, selected, true)}</section></div>`;
  if (showTabs) {
    tabs =
      '<nav class="tabs" role="tablist" aria-label="Active programs">' +
      courses
        .map((course) => {
          const title = courseDisplayTitle(course);
          return `<a role="tab" aria-selected="${course.id === selected.id ? 'true' : 'false'}" class="${course.id === selected.id ? 'active' : ''}" href="${escapeHtml(
            publicCoursesPath(
              publicCourseProgramKey(course.courseType, course.programCode)
            )
          )}">${escapeHtml(title)}</a>`;
        })
        .join('') +
      '</nav>';
    panels =
      '<div class="panels">' +
      courses
        .map((course) => {
          const isSelected = course.id === selected.id;
          return (
            `<section class="panel${isSelected ? ' active' : ''}" role="tabpanel">` +
            renderPanel(origin, course, isSelected) +
            '</section>'
          );
        })
        .join('') +
      '</div>';
  }

  return {
    status: 200,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Explore current Art of Living courses and registration details."
    />
    <title>${escapeHtml(pageTitle)}</title>
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <style>
      :root {
        color-scheme: light;
        --ink: #15171d;
        --muted: #667085;
        --line: #e4e7ec;
        --green: #0f766e;
        --gold: #d69e2e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: linear-gradient(180deg, #fffaf1 0%, #f6f8fb 42%, #eef4f3 100%);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      main {
        width: min(100%, 76rem);
        margin: 0 auto;
        padding: 1rem 1rem 2.5rem;
      }
      .page-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 0 1rem;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        color: #344054;
        font-size: 0.82rem;
        font-weight: 750;
      }
      .brand-mark {
        display: grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 999px;
        background: #ffffff;
        border: 1px solid rgba(15, 118, 110, 0.18);
        color: var(--green);
        box-shadow: 0 8px 24px rgba(16, 24, 40, 0.08);
      }
      .home-link {
        color: var(--green);
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none;
      }
      .home-link:focus-visible,
      .tabs a:focus-visible {
        outline: 2px solid var(--green);
        outline-offset: 3px;
      }
      .tabs {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        padding: 0.25rem 0 1rem;
        scrollbar-width: thin;
      }
      .tabs a {
        flex: 0 0 auto;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.82);
        color: #475467;
        padding: 0.58rem 0.9rem;
        font-size: 0.86rem;
        font-weight: 750;
        text-decoration: none;
        white-space: nowrap;
      }
      .tabs a.active {
        border-color: rgba(15, 118, 110, 0.35);
        background: #ecfdf3;
        color: var(--green);
      }
      .panel { display: none; }
      .panel.active { display: block; }
      .course-layout {
        display: grid;
        gap: 1.25rem;
        align-items: start;
      }
      .media {
        margin: 0;
        border-radius: 1.25rem;
        background: #f2f4f7;
        border: 1px solid rgba(16, 24, 40, 0.08);
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(16, 24, 40, 0.12);
      }
      .media img {
        display: block;
        width: 100%;
        height: auto;
      }
      .placeholder {
        min-height: 18rem;
        display: grid;
        place-items: center;
        color: #98a2b3;
        font-weight: 800;
      }
      .content {
        border: 1px solid rgba(16, 24, 40, 0.08);
        border-radius: 1.25rem;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 14px 40px rgba(16, 24, 40, 0.08);
        padding: 1.1rem;
      }
      .course-heading {
        border-bottom: 1px solid var(--line);
        margin-bottom: 1rem;
        padding-bottom: 0.85rem;
      }
      .eyebrow {
        margin: 0 0 0.4rem;
        color: var(--gold);
        font-size: 0.76rem;
        font-weight: 850;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        color: #101828;
        font-size: 1.65rem;
        line-height: 1.08;
      }
      .details,
      .empty-details {
        white-space: pre-wrap;
        font-size: 1rem;
        line-height: 1.55;
      }
      .details a {
        color: var(--green);
        text-decoration: underline;
        text-decoration-thickness: 0.08em;
        text-underline-offset: 0.16em;
        word-break: break-word;
      }
      .details code {
        font-family: ui-monospace, monospace;
        font-size: 0.9em;
      }
      .empty-details { color: var(--muted); margin: 0; }
      @media (min-width: 860px) {
        main { padding: 1.25rem 1.5rem 3rem; }
        .page-head { padding: 1rem 0 1.25rem; }
        .course-layout {
          grid-template-columns: minmax(0, 1.05fr) minmax(22rem, 0.95fr);
          gap: 1.5rem;
        }
        .content {
          position: sticky;
          top: 1rem;
          padding: 1.35rem;
        }
        h1 { font-size: 2.35rem; }
      }
    </style>
  </head>
  <body>
    <main>
      <header class="page-head">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">A</span>
          <span>Seva Hub</span>
        </div>
        <a class="home-link" href="/">Home</a>
      </header>
      ${tabs}
      ${panels}
    </main>
  </body>
</html>`
  };
}
