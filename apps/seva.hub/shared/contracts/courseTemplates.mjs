import {
  normalizeActivityType,
  normalizeCourseType,
  normalizeProgramCode,
  programsForCourseType
} from './courseDefaults.mjs';

export const DEFAULT_COURSE_WHATSAPP_TEMPLATE =
  'Hi {name}, you are invited to {course}.';

export const DEFAULT_EVENT_WHATSAPP_TEMPLATE =
  'Hi {name}, you are invited to {course}.\n\nPlease reply here for details.';

export const DEFAULT_HP_WHATSAPP_TEMPLATE = `_*🌿✨HAPPINESS PROGRAM by The Art of Living ✨🌿*_

😌 Feeling stressed, tired, or overwhelmed?
Take a pause and discover the power of your breath through Sudarshan Kriya™️ — a life-transforming breathing technique practiced by millions across the globe. 🌍💙

*Benefits You'll Experience:*
*Reduces Stress & Anxiety 😌*
*Improves Sleep Quality 😴✨*
*Boosts Energy Levels ⚡*
*Enhances Focus & Mental Clarity 🎯🧠*
*Strengthens Immunity 💪🛡️*
*Promotes Emotional Balance 😊🌸*
*Increases Self-Confidence 🌟*
*Improves Productivity & Creativity 💡🚀*
*Relieves Body Aches & Tension 🧘‍♀️💆‍♂️*
*Brings More Joy, Peace & Happiness 💖🌈*

📅 Dates: *28 – 30 August*
🌅 Morning Batch: *6:30 – 9:30 A.M.*
🌇 Evening Batch: *6:00 – 9:00 P.M.*

_📍Venue:_
*Art of Living Nagavara Center*
*Manyata Tech Park,*
*Behind Elements Mall*
*North Bengaluru*

📞 For Registration & Details:
https://aolt.in/874234

📲 8884560660
📲 8884561661

 _🌸 A simple breath. A powerful shift. A happier you. 🌸_`;

export const DEFAULT_COURSE_TEMPLATE_TYPES = Object.freeze([
  'HP',
  'VTP',
  'DSN',
  'IP',
  'IP2',
  'Sahaj',
  'YES+'
]);

export function templateLookupKeys(courseType, programCode) {
  const type = normalizeCourseType(courseType);
  const code = normalizeProgramCode(courseType, programCode);
  if (code) {
    return [type + '-' + code, type];
  }
  return [type];
}

export function templateForCourseType(courseType, programCode) {
  const type = normalizeCourseType(courseType).toUpperCase();
  const code = normalizeProgramCode(courseType, programCode);
  if (type === 'HP' && !code) {
    return DEFAULT_HP_WHATSAPP_TEMPLATE;
  }
  return DEFAULT_COURSE_WHATSAPP_TEMPLATE;
}

export function templateForActivity(activityType, courseType, programCode) {
  if (normalizeActivityType(activityType) === 'Event') {
    return DEFAULT_EVENT_WHATSAPP_TEMPLATE;
  }
  return templateForCourseType(courseType, programCode);
}

export function defaultCourseTemplateRows() {
  const rows = [];
  DEFAULT_COURSE_TEMPLATE_TYPES.forEach((courseType) => {
    const programs = programsForCourseType(courseType);
    if (programs.length) {
      programs.forEach((program) => {
        rows.push([
          courseType + '-' + program.code,
          templateForCourseType(courseType, program.code)
        ]);
      });
      return;
    }
    rows.push([courseType, templateForCourseType(courseType)]);
  });
  return rows;
}

export function defaultCourseTemplates() {
  return defaultCourseTemplateRows().map(([courseType, template]) => ({
    courseType,
    template
  }));
}
