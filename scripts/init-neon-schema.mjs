import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

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

const envText = await readFile(envPath, 'utf8');
const connectionString = readDatabaseUrl(envText);

if (!connectionString) {
  throw new Error('DATABASE_URL was not found in .env');
}

const pool = new Pool({ connectionString });

const schema = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  cefr_level TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  last_active TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  title_translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  description_translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  level_code TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS lessons_level_order_idx
  ON lessons (level_code, order_index);

CREATE TABLE IF NOT EXISTS vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  translation_translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  pronunciation_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  best_score INTEGER NOT NULL DEFAULT 0,
  last_score INTEGER NOT NULL DEFAULT 0,
  total_exercises INTEGER NOT NULL DEFAULT 0,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lesson_progress_user_lesson_unique UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_progress_user_updated_idx
  ON lesson_progress (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS lesson_attempt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_exercises INTEGER NOT NULL DEFAULT 0,
  accuracy_percent INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS lesson_attempt_history_user_completed_idx
  ON lesson_attempt_history (user_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS review_attempt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  word_id UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  quality INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS review_attempt_history_user_completed_idx
  ON review_attempt_history (user_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS culture_categories (
  id TEXT PRIMARY KEY,
  emoji TEXT NOT NULL,
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS culture_entries (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES culture_categories(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  period JSONB NOT NULL DEFAULT '{}'::jsonb,
  blurb JSONB NOT NULL DEFAULT '{}'::jsonb,
  takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS culture_entries_category_order_idx
  ON culture_entries (category_id, order_index);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS title_translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS description_translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS translation_translations JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS spaced_repetition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  word_id UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  next_review_date TIMESTAMPTZ NOT NULL,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  interval INTEGER NOT NULL DEFAULT 0,
  repetition_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT spaced_repetition_user_word_unique UNIQUE (user_id, word_id)
);

CREATE INDEX IF NOT EXISTS spaced_repetition_due_idx
  ON spaced_repetition (user_id, next_review_date);

CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  type TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  access_token TEXT,
  expires_at BIGINT,
  refresh_token TEXT,
  id_token TEXT,
  scope TEXT,
  session_state TEXT,
  token_type TEXT,
  password TEXT,
  UNIQUE (provider, "providerAccountId")
);

CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx
  ON auth_accounts ("userId");

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  "sessionToken" TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
  ON auth_sessions ("userId");

CREATE TABLE IF NOT EXISTS auth_verification_token (
  identifier TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  PRIMARY KEY (identifier, token)
);
`;

try {
  await pool.query(schema);
  console.log('Neon schema initialized successfully.');
} finally {
  await pool.end();
}