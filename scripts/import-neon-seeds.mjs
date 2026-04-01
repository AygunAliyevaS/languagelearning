import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const lessonsPath = path.join(rootDir, 'seeds', 'lessons.json');
const vocabularyPath = path.join(rootDir, 'seeds', 'vocabulary.json');

function readDatabaseUrl(envText) {
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) {
      continue;
    }

    const [key, ...rest] = line.split('=');
    if (key === 'DATABASE_URL') {
      return rest.join('=').trim();
    }
  }

  return undefined;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value, field, fileName, index) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fileName}[${index}].${field} must be a non-empty string`);
  }
  return value.trim();
}

function assertOptionalString(value, field, fileName, index) {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fileName}[${index}].${field} must be a string when provided`);
  }
  return value.trim();
}

function assertLocalizedText(value, field, fileName, index) {
  if (!isObject(value) || Object.keys(value).length === 0) {
    throw new Error(`${fileName}[${index}].${field} must be a non-empty object`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([locale, text]) => {
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error(`${fileName}[${index}].${field}.${locale} must be a non-empty string`);
      }

      return [locale, text.trim()];
    })
  );
}

function assertOptionalLocalizedText(value, field, fileName, index) {
  if (value == null || value === '') {
    return {};
  }

  return assertLocalizedText(value, field, fileName, index);
}

function assertOptionalTimestamp(value, field, fileName, index) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fileName}[${index}].${field} must be a valid ISO date string when provided`);
  }
  return parsed.toISOString();
}

function assertInteger(value, field, fileName, index) {
  if (!Number.isInteger(value)) {
    throw new Error(`${fileName}[${index}].${field} must be an integer`);
  }
  return value;
}

function assertUuid(value, field, fileName, index) {
  const normalized = assertString(value, field, fileName, index);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`${fileName}[${index}].${field} must be a valid UUID`);
  }
  return normalized;
}

function validateLessons(rows) {
  if (!Array.isArray(rows)) {
    throw new Error('lessons.json must contain a top-level array');
  }

  return rows.map((row, index) => {
    if (!isObject(row)) {
      throw new Error(`lessons.json[${index}] must be an object`);
    }

    return {
      id: assertUuid(row.id, 'id', 'lessons.json', index),
      title: assertString(row.title, 'title', 'lessons.json', index),
      description: assertOptionalString(row.description, 'description', 'lessons.json', index),
      title_translations: assertOptionalLocalizedText(
        row.title_translations,
        'title_translations',
        'lessons.json',
        index
      ),
      description_translations: assertOptionalLocalizedText(
        row.description_translations,
        'description_translations',
        'lessons.json',
        index
      ),
      level_code: assertString(row.level_code, 'level_code', 'lessons.json', index),
      order_index: assertInteger(row.order_index, 'order_index', 'lessons.json', index),
      content: Array.isArray(row.content) || isObject(row.content) ? row.content : [],
      created_at: assertOptionalTimestamp(row.created_at, 'created_at', 'lessons.json', index),
    };
  });
}

function validateVocabulary(rows) {
  if (!Array.isArray(rows)) {
    throw new Error('vocabulary.json must contain a top-level array');
  }

  return rows.map((row, index) => {
    if (!isObject(row)) {
      throw new Error(`vocabulary.json[${index}] must be an object`);
    }

    return {
      id: assertUuid(row.id, 'id', 'vocabulary.json', index),
      word: assertString(row.word, 'word', 'vocabulary.json', index),
      translation: assertString(row.translation, 'translation', 'vocabulary.json', index),
      translation_translations: assertOptionalLocalizedText(
        row.translation_translations,
        'translation_translations',
        'vocabulary.json',
        index
      ),
      pronunciation_url: assertOptionalString(
        row.pronunciation_url,
        'pronunciation_url',
        'vocabulary.json',
        index
      ),
      created_at: assertOptionalTimestamp(row.created_at, 'created_at', 'vocabulary.json', index),
    };
  });
}

function validateCultureCategories(rows) {
  if (!Array.isArray(rows)) {
    throw new Error('culture content must contain a top-level array');
  }

  return rows.map((row, index) => {
    if (!isObject(row)) {
      throw new Error(`culture[${index}] must be an object`);
    }

    if (!Array.isArray(row.entries)) {
      throw new Error(`culture[${index}].entries must be an array`);
    }

    return {
      id: assertString(row.id, 'id', 'culture', index),
      emoji: assertString(row.emoji, 'emoji', 'culture', index),
      title: assertLocalizedText(row.title, 'title', 'culture', index),
      description: assertLocalizedText(row.description, 'description', 'culture', index),
      entries: row.entries.map((entry, entryIndex) => {
        if (!isObject(entry)) {
          throw new Error(`culture[${index}].entries[${entryIndex}] must be an object`);
        }

        return {
          id: assertString(entry.id, 'id', `culture[${index}].entries`, entryIndex),
          type: assertString(entry.type, 'type', `culture[${index}].entries`, entryIndex),
          title: assertLocalizedText(entry.title, 'title', `culture[${index}].entries`, entryIndex),
          period: assertLocalizedText(entry.period, 'period', `culture[${index}].entries`, entryIndex),
          blurb: assertLocalizedText(entry.blurb, 'blurb', `culture[${index}].entries`, entryIndex),
          takeaways: Array.isArray(entry.takeaways)
            ? entry.takeaways.map((takeaway, takeawayIndex) =>
                assertLocalizedText(
                  takeaway,
                  'takeaways',
                  `culture[${index}].entries[${entryIndex}]`,
                  takeawayIndex
                )
              )
            : [],
        };
      }),
    };
  });
}

async function readJsonFile(filePath) {
  const fileText = await readFile(filePath, 'utf8');
  return JSON.parse(fileText);
}

const envText = await readFile(envPath, 'utf8');
const connectionString = readDatabaseUrl(envText);

if (!connectionString) {
  throw new Error('DATABASE_URL was not found in .env');
}

const lessons = validateLessons(await readJsonFile(lessonsPath));
const vocabulary = validateVocabulary(await readJsonFile(vocabularyPath));
const cultureModulePath = pathToFileURL(path.join(rootDir, 'src', 'app', 'content', 'culture.js')).href;
const { cultureCategories: cultureSource } = await import(cultureModulePath);
const cultureCategories = validateCultureCategories(cultureSource);

const pool = new Pool({ connectionString });

try {
  await pool.query('BEGIN');

  for (const lesson of lessons) {
    await pool.query(
      `
        INSERT INTO lessons (
          id,
          title,
          description,
          title_translations,
          description_translations,
          level_code,
          order_index,
          content,
          created_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8::jsonb, COALESCE($9::timestamptz, CURRENT_TIMESTAMP))
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          title_translations = EXCLUDED.title_translations,
          description_translations = EXCLUDED.description_translations,
          level_code = EXCLUDED.level_code,
          order_index = EXCLUDED.order_index,
          content = EXCLUDED.content,
          created_at = EXCLUDED.created_at
      `,
      [
        lesson.id,
        lesson.title,
        lesson.description,
        JSON.stringify(lesson.title_translations),
        JSON.stringify(lesson.description_translations),
        lesson.level_code,
        lesson.order_index,
        JSON.stringify(lesson.content),
        lesson.created_at,
      ]
    );
  }

  for (const entry of vocabulary) {
    await pool.query(
      `
        INSERT INTO vocabulary (
          id,
          word,
          translation,
          translation_translations,
          pronunciation_url,
          created_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, COALESCE($6::timestamptz, CURRENT_TIMESTAMP))
        ON CONFLICT (id) DO UPDATE SET
          word = EXCLUDED.word,
          translation = EXCLUDED.translation,
          translation_translations = EXCLUDED.translation_translations,
          pronunciation_url = EXCLUDED.pronunciation_url,
          created_at = EXCLUDED.created_at
      `,
      [
        entry.id,
        entry.word,
        entry.translation,
        JSON.stringify(entry.translation_translations),
        entry.pronunciation_url,
        entry.created_at,
      ]
    );
  }

  for (const [categoryIndex, category] of cultureCategories.entries()) {
    await pool.query(
      `
        INSERT INTO culture_categories (id, emoji, title, description, order_index)
        VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
        ON CONFLICT (id) DO UPDATE SET
          emoji = EXCLUDED.emoji,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          order_index = EXCLUDED.order_index
      `,
      [category.id, category.emoji, JSON.stringify(category.title), JSON.stringify(category.description), categoryIndex]
    );

    for (const [entryIndex, cultureEntry] of category.entries.entries()) {
      await pool.query(
        `
          INSERT INTO culture_entries (id, category_id, type, title, period, blurb, takeaways, order_index)
          VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8)
          ON CONFLICT (id) DO UPDATE SET
            category_id = EXCLUDED.category_id,
            type = EXCLUDED.type,
            title = EXCLUDED.title,
            period = EXCLUDED.period,
            blurb = EXCLUDED.blurb,
            takeaways = EXCLUDED.takeaways,
            order_index = EXCLUDED.order_index
        `,
        [
          cultureEntry.id,
          category.id,
          cultureEntry.type,
          JSON.stringify(cultureEntry.title),
          JSON.stringify(cultureEntry.period),
          JSON.stringify(cultureEntry.blurb),
          JSON.stringify(cultureEntry.takeaways),
          entryIndex,
        ]
      );
    }
  }

  await pool.query('COMMIT');
  console.log(
    JSON.stringify(
      {
        importedLessons: lessons.length,
        importedVocabulary: vocabulary.length,
        importedCultureCategories: cultureCategories.length,
        importedCultureEntries: cultureCategories.reduce((total, category) => total + category.entries.length, 0),
      },
      null,
      2
    )
  );
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
} finally {
  await pool.end();
}