export const DEMO_LEARNER_EMAIL = 'learner.demo@languagelearning.app';

function getDatabaseHint(path, fallbackMessage) {
  const databaseBackedPaths = ['/api/lessons', '/api/user', '/api/spaced-repetition', '/api/subscriptions'];

  if (!process.env.DATABASE_URL && databaseBackedPaths.some((prefix) => path.startsWith(prefix))) {
    return 'DATABASE_URL is not configured, so learner data is unavailable in this local environment.';
  }

  return fallbackMessage;
}

export async function fetchApiJson(request, path, fallbackValue) {
  try {
    const response = await fetch(new URL(path, request.url));
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const fallbackMessage = typeof body === 'string' ? body : body?.error || `Request failed with status ${response.status}`;
      return {
        data: fallbackValue,
        error: getDatabaseHint(path, fallbackMessage),
        status: response.status,
      };
    }

    return {
      data: body,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: fallbackValue,
      error: getDatabaseHint(path, error instanceof Error ? error.message : 'Request failed'),
      status: 500,
    };
  }
}

export async function fetchDemoUser(request) {
  return fetchApiJson(
    request,
    `/api/user?email=${encodeURIComponent(DEMO_LEARNER_EMAIL)}`,
    null
  );
}

export function groupLessonsByLevel(lessons) {
  return lessons.reduce((accumulator, lesson) => {
    const level = lesson.level_code || 'Unassigned';
    accumulator[level] ||= [];
    accumulator[level].push(lesson);
    return accumulator;
  }, {});
}

export function getLessonTitle(lesson) {
  return lesson.title || lesson.name || lesson.slug || `Lesson ${lesson.order_index || lesson.id || ''}`.trim();
}

export function getLessonDescription(lesson) {
  return (
    lesson.description ||
    lesson.summary ||
    lesson.objective ||
    'Lesson metadata is available, but this record does not include a description field.'
  );
}