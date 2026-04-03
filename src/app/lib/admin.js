import { DEFAULT_LOCALE, supportedLocales } from '@/app/lib/i18n.js';

export const ADMIN_STORAGE_KEY = 'azdili.admin.accessKey';

export const SUPPORT_STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];

export const LESSON_SECTION_TEMPLATES = {
  goal: {
    type: 'goal',
    title: createLocalizedValue('What you will learn'),
    items: [createLocalizedValue('Add a short learning objective')],
  },
  dialogue: {
    type: 'dialogue',
    title: createLocalizedValue('Mini dialogue'),
    lines: [createLocalizedValue('A: Add the first dialogue line')],
  },
  reading: {
    type: 'reading',
    title: createLocalizedValue('Reading passage'),
    prompt: createLocalizedValue('Paste a short reading passage or instructions.'),
    lines: [createLocalizedValue('Add the first reading paragraph')],
  },
  listening: {
    type: 'listening',
    title: createLocalizedValue('Listening practice'),
    prompt: createLocalizedValue('Add a short prompt for the listening task.'),
    audioUrl: '',
    lines: [createLocalizedValue('Optional transcript line')],
  },
  practice: {
    type: 'practice',
    title: createLocalizedValue('Speak out loud'),
    prompt: createLocalizedValue('Add a short speaking prompt.'),
  },
  quiz: {
    type: 'quiz',
    title: createLocalizedValue('Quick check'),
    prompt: createLocalizedValue('Write the quiz question.'),
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
    correctIndex: 0,
    explanation: createLocalizedValue('Explain why this answer is correct.'),
  },
  textInput: {
    type: 'textInput',
    title: createLocalizedValue('Write your answer'),
    prompt: createLocalizedValue('Add the text input instruction.'),
    placeholder: createLocalizedValue('Type the expected answer'),
    acceptedAnswers: ['Example answer'],
    explanation: createLocalizedValue('Explain the expected answer.'),
  },
  match: {
    type: 'match',
    title: createLocalizedValue('Matching task'),
    prompt: createLocalizedValue('Match the prompts with the correct answers.'),
    pairs: [
      {
        id: 'pair-1',
        left: createLocalizedValue('Left side prompt'),
        right: 'Right side answer',
      },
    ],
    explanation: createLocalizedValue('Explain the matching logic.'),
  },
};

export function createLocalizedValue(seed = '') {
  return Object.fromEntries(supportedLocales.map((locale) => [locale.id, locale.id === DEFAULT_LOCALE ? seed : '']));
}

export function normalizeLocalizedValue(value, fallback = '') {
  const seed = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return Object.fromEntries(
    supportedLocales.map((locale) => {
      const candidate = typeof seed[locale.id] === 'string' ? seed[locale.id] : '';
      return [locale.id, candidate];
    })
  );
}

export function getPrimaryLocalizedValue(value, fallback = '') {
  const normalized = normalizeLocalizedValue(value, fallback);
  return normalized.en || normalized[DEFAULT_LOCALE] || Object.values(normalized).find(Boolean) || fallback;
}

export function createLessonDraft() {
  return {
    id: null,
    level_code: 'A1',
    order_index: 1,
    title_translations: createLocalizedValue('New lesson'),
    description_translations: createLocalizedValue('Add a lesson description.'),
    content: [structuredClone(LESSON_SECTION_TEMPLATES.goal)],
  };
}

export function createVocabularyDraft() {
  return {
    id: null,
    word: '',
    translation_translations: createLocalizedValue(''),
    pronunciation_url: '',
  };
}

export function createCultureCategoryDraft() {
  return {
    id: '',
    emoji: '📚',
    order_index: 0,
    title: createLocalizedValue('New category'),
    description: createLocalizedValue('Add a short category description.'),
  };
}

export function createCultureEntryDraft(categoryId = '') {
  return {
    id: '',
    category_id: categoryId,
    type: 'topic',
    order_index: 0,
    title: createLocalizedValue('New entry'),
    period: createLocalizedValue(''),
    blurb: createLocalizedValue('Add a short cultural summary.'),
    takeaways: [createLocalizedValue('Add one takeaway')],
  };
}

export function stringifyEditorJson(value) {
  return JSON.stringify(value, null, 2);
}

export function cloneTemplateSection(type) {
  return structuredClone(LESSON_SECTION_TEMPLATES[type] ?? LESSON_SECTION_TEMPLATES.goal);
}