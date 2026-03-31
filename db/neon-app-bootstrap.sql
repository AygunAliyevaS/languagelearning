CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  cefr_level TEXT NOT NULL DEFAULT 'A1',
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_code TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  pronunciation_url TEXT,
  level_code TEXT NOT NULL DEFAULT 'A1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spaced_repetition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  next_review_date TIMESTAMPTZ NOT NULL,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  interval INTEGER NOT NULL DEFAULT 1,
  repetition_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, word_id)
);

CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cefr_level TEXT NOT NULL,
  session_duration INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  interval TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES pricing_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  payment_method_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  region TEXT,
  annual BOOLEAN NOT NULL DEFAULT FALSE,
  discount_codes TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (id, username, email, xp, streak, cefr_level, last_active)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'learner.demo',
  'learner.demo@languagelearning.app',
  1280,
  7,
  'B1',
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
  username = EXCLUDED.username,
  xp = EXCLUDED.xp,
  streak = EXCLUDED.streak,
  cefr_level = EXCLUDED.cefr_level,
  last_active = EXCLUDED.last_active;

INSERT INTO lessons (id, level_code, order_index, title, description, slug, duration_minutes)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'A1', 1, 'Azerbaijani Alphabet', 'Learn the alphabet, core sounds, and basic pronunciation patterns.', 'azerbaijani-alphabet', 18),
  ('20000000-0000-0000-0000-000000000002', 'A1', 2, 'First Greetings', 'Practice hello, goodbye, introductions, and polite small talk.', 'first-greetings', 16),
  ('20000000-0000-0000-0000-000000000003', 'A2', 1, 'Daily Routines', 'Talk about your day, common actions, and time expressions.', 'daily-routines', 22),
  ('20000000-0000-0000-0000-000000000004', 'B1', 1, 'Travel and Directions', 'Ask for directions, navigate cities, and manage travel situations.', 'travel-and-directions', 27),
  ('20000000-0000-0000-0000-000000000005', 'B2', 1, 'Opinions and Debate', 'Express nuanced opinions and support arguments in discussion.', 'opinions-and-debate', 31)
ON CONFLICT (id) DO UPDATE SET
  level_code = EXCLUDED.level_code,
  order_index = EXCLUDED.order_index,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  slug = EXCLUDED.slug,
  duration_minutes = EXCLUDED.duration_minutes;

INSERT INTO vocabulary (id, word, translation, pronunciation_url, level_code)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'salam', 'hello', NULL, 'A1'),
  ('30000000-0000-0000-0000-000000000002', 'sağ ol', 'thank you', NULL, 'A1'),
  ('30000000-0000-0000-0000-000000000003', 'haradadır', 'where is it', NULL, 'A2'),
  ('30000000-0000-0000-0000-000000000004', 'fikrimcə', 'in my opinion', NULL, 'B1')
ON CONFLICT (id) DO UPDATE SET
  word = EXCLUDED.word,
  translation = EXCLUDED.translation,
  pronunciation_url = EXCLUDED.pronunciation_url,
  level_code = EXCLUDED.level_code;

INSERT INTO spaced_repetition (id, user_id, word_id, next_review_date, ease_factor, interval, repetition_count)
VALUES
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '2 hours', 2.5, 1, 0),
  ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000002', CURRENT_TIMESTAMP - INTERVAL '1 hour', 2.7, 3, 2),
  ('40000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP - INTERVAL '30 minutes', 2.3, 2, 1)
ON CONFLICT (user_id, word_id) DO UPDATE SET
  next_review_date = EXCLUDED.next_review_date,
  ease_factor = EXCLUDED.ease_factor,
  interval = EXCLUDED.interval,
  repetition_count = EXCLUDED.repetition_count;

INSERT INTO learning_sessions (id, user_id, cefr_level, session_duration, created_at)
VALUES
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A2', 720, CURRENT_TIMESTAMP - INTERVAL '20 days'),
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'A2', 810, CURRENT_TIMESTAMP - INTERVAL '12 days'),
  ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'B1', 960, CURRENT_TIMESTAMP - INTERVAL '6 days'),
  ('50000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'B1', 1100, CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  cefr_level = EXCLUDED.cefr_level,
  session_duration = EXCLUDED.session_duration,
  created_at = EXCLUDED.created_at;

INSERT INTO pricing_plans (id, name, price, interval, features, limits)
VALUES
  (
    'basic',
    'Basic',
    6.99,
    'month',
    '{"lessons":["A1","A2","B1","B2"],"dailyQuizzes":true,"exercises":"unlimited","offlineMode":true,"ads":false,"aiPersonalization":false,"speechRecognition":false,"analytics":"basic","liveTutorSessions":0,"certificationPrep":false,"culturalImmersion":false}'::jsonb,
    '{"lessonsPerDay":"unlimited","quizzesPerDay":"unlimited","exercisesPerDay":"unlimited","storageMB":500}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  interval = EXCLUDED.interval,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits;

INSERT INTO user_subscriptions (
  id,
  user_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  expires_at,
  cancel_at_period_end,
  region,
  annual,
  created_at,
  updated_at
)
VALUES (
  '60000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'basic',
  'active',
  CURRENT_TIMESTAMP - INTERVAL '10 days',
  CURRENT_TIMESTAMP + INTERVAL '20 days',
  CURRENT_TIMESTAMP + INTERVAL '20 days',
  FALSE,
  'US',
  FALSE,
  CURRENT_TIMESTAMP - INTERVAL '10 days',
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  plan_id = EXCLUDED.plan_id,
  status = EXCLUDED.status,
  current_period_start = EXCLUDED.current_period_start,
  current_period_end = EXCLUDED.current_period_end,
  expires_at = EXCLUDED.expires_at,
  cancel_at_period_end = EXCLUDED.cancel_at_period_end,
  region = EXCLUDED.region,
  annual = EXCLUDED.annual,
  updated_at = EXCLUDED.updated_at;

INSERT INTO user_purchases (id, user_id, purchase_type, item_id, payment_id, status, metadata, expires_at)
VALUES (
  '70000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'ai_credits',
  '25',
  'seed-payment-001',
  'active',
  '{"credits":25,"label":"Demo AI tutor credits"}'::jsonb,
  CURRENT_TIMESTAMP + INTERVAL '180 days'
)
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  purchase_type = EXCLUDED.purchase_type,
  item_id = EXCLUDED.item_id,
  payment_id = EXCLUDED.payment_id,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  expires_at = EXCLUDED.expires_at;