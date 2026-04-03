function localized(en, overrides = {}) {
  return {
    en,
    az: overrides.az ?? en,
    es: overrides.es ?? en,
    ru: overrides.ru ?? en,
    tr: overrides.tr ?? en,
  };
}

const examPrepCatalog = [
  {
    productSlug: 'exam-prep-a2',
    levelCode: 'A2',
    title: localized('A2 Prep'),
    overview: localized('Foundational certification prep focused on everyday communication, reading support, and simple writing tasks.'),
    focusAreas: [
      localized('Core vocabulary refresh'),
      localized('Short-form reading strategies'),
      localized('Practical dialogue rehearsal'),
    ],
    modules: [
      {
        id: 'a2-foundation',
        title: localized('Foundation Review'),
        sections: [
          {
            type: 'goal',
            title: localized('What this pack trains'),
            items: [
              localized('Recognize common exam prompts quickly.'),
              localized('Respond with short, clear Azerbaijani sentences.'),
              localized('Review practical travel, family, and daily routine themes.'),
            ],
          },
          {
            type: 'reading',
            title: localized('Reading strategy'),
            prompt: localized('Skim for dates, names, and action verbs before reading line by line.'),
            lines: [
              localized('Mark key nouns first, then pair them with the main verb in each sentence.'),
              localized('When two answer choices seem similar, choose the one that matches the exact context instead of the general topic.'),
            ],
          },
        ],
      },
      {
        id: 'a2-speaking',
        title: localized('Speaking and Writing Drills'),
        sections: [
          {
            type: 'dialogue',
            title: localized('Mini speaking prompt'),
            lines: [
              localized('A: Introduce yourself and mention where you live.'),
              localized('B: Ask one follow-up question about work or study.'),
              localized('A: Answer with one detail and one future plan.'),
            ],
          },
          {
            type: 'practice',
            title: localized('Writing rehearsal'),
            prompt: localized('Write a 5-6 sentence response about your daily routine using time markers and one preference statement.'),
          },
        ],
      },
    ],
  },
  {
    productSlug: 'exam-prep-b1',
    levelCode: 'B1',
    title: localized('B1 Prep'),
    overview: localized('Intermediate exam practice centered on connected writing, inference in reading, and opinion-based speaking.'),
    focusAreas: [
      localized('Inference-based reading practice'),
      localized('Connected paragraph writing'),
      localized('Opinion and justification speaking tasks'),
    ],
    modules: [
      {
        id: 'b1-reading',
        title: localized('Reading and Listening Review'),
        sections: [
          {
            type: 'goal',
            title: localized('B1 exam focus'),
            items: [
              localized('Identify tone, purpose, and implication instead of only literal meaning.'),
              localized('Track contrasting ideas in longer texts.'),
              localized('Summarize the main point before choosing an answer.'),
            ],
          },
          {
            type: 'listening',
            title: localized('Listening review routine'),
            prompt: localized('Listen once for the topic, once for the speaker’s opinion, and once for supporting detail.'),
            lines: [
              localized('Write down transition words that signal contrast or conclusion.'),
              localized('Ignore isolated unfamiliar words if the argument remains clear.'),
            ],
          },
        ],
      },
      {
        id: 'b1-output',
        title: localized('Written and Oral Output'),
        sections: [
          {
            type: 'practice',
            title: localized('Opinion task'),
            prompt: localized('Explain whether online learning or classroom learning is more effective for language study, giving two reasons and one example.'),
          },
          {
            type: 'reading',
            title: localized('Writing checklist'),
            prompt: localized('Use a short introduction, two linked support ideas, and a one-sentence conclusion.'),
            lines: [
              localized('Add connectors such as “because”, “however”, and “for example”.'),
              localized('Keep each sentence focused on one idea before linking them into a paragraph.'),
            ],
          },
        ],
      },
    ],
  },
  {
    productSlug: 'exam-prep-c1',
    levelCode: 'C1',
    title: localized('C1 Prep'),
    overview: localized('Advanced certification prep designed for complex reading, argument structure, and high-control written production.'),
    focusAreas: [
      localized('Advanced argument tracking'),
      localized('Long-form response planning'),
      localized('Register control and nuance'),
    ],
    modules: [
      {
        id: 'c1-analysis',
        title: localized('Analytical Reading'),
        sections: [
          {
            type: 'goal',
            title: localized('C1 exam focus'),
            items: [
              localized('Separate the author’s claim from evidence and implied assumptions.'),
              localized('Recognize subtle shifts in register and tone.'),
              localized('Evaluate distractors by testing how precisely they match the passage.'),
            ],
          },
          {
            type: 'reading',
            title: localized('Annotation method'),
            prompt: localized('Mark thesis, contrast, concession, and conclusion before reviewing answer options.'),
            lines: [
              localized('If an option is broader than the source text, it is often wrong even when it sounds persuasive.'),
              localized('Treat hedging language carefully: “may”, “often”, and “tends to” change the claim strength.'),
            ],
          },
        ],
      },
      {
        id: 'c1-writing',
        title: localized('Structured Response Lab'),
        sections: [
          {
            type: 'practice',
            title: localized('Essay planning task'),
            prompt: localized('Plan a response comparing the social impact of migration and digitalization on language preservation, then draft a thesis and three supporting claims.'),
          },
          {
            type: 'dialogue',
            title: localized('High-control speaking rehearsal'),
            lines: [
              localized('A: Present a position on how institutions should support minority languages.'),
              localized('B: Challenge the argument with one policy-based concern.'),
              localized('A: Refine the position and address the concern with evidence.'),
            ],
          },
        ],
      },
    ],
  },
];

function cloneLocalizedValue(value) {
  return { ...value };
}

function cloneSection(section) {
  return {
    ...section,
    title: cloneLocalizedValue(section.title),
    prompt: section.prompt ? cloneLocalizedValue(section.prompt) : undefined,
    items: Array.isArray(section.items) ? section.items.map(cloneLocalizedValue) : undefined,
    lines: Array.isArray(section.lines) ? section.lines.map(cloneLocalizedValue) : undefined,
  };
}

function cloneModule(module) {
  return {
    ...module,
    title: cloneLocalizedValue(module.title),
    sections: module.sections.map(cloneSection),
  };
}

function cloneExamPrepItem(item) {
  return {
    ...item,
    title: cloneLocalizedValue(item.title),
    overview: cloneLocalizedValue(item.overview),
    focusAreas: item.focusAreas.map(cloneLocalizedValue),
    modules: item.modules.map(cloneModule),
  };
}

export function getExamPrepCatalog() {
  return examPrepCatalog.map(cloneExamPrepItem);
}

export function getExamPrepItem(productSlug) {
  const item = examPrepCatalog.find((entry) => entry.productSlug === productSlug);
  return item ? cloneExamPrepItem(item) : null;
}
