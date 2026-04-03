
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Crown,
  Flame,
  Globe2,
  Home,
  LifeBuoy,
  Medal,
  NotebookPen,
  ShoppingBag,
  ShieldCheck,
  Star,
  Trophy,
  UserRound,
  Volume2,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/client-integrations/recharts';
import {
  LANGUAGE_COOKIE_KEY,
  DEFAULT_LOCALE,
  getLocaleMeta,
  getLocalizedText,
  LANGUAGE_STORAGE_KEY,
  resolveLocale,
  supportedLocales,
  t,
} from '@/app/lib/i18n.js';
import { getCatalogProduct } from '@/app/lib/monetization';
import { SUPPORT_EMAIL } from '@/app/lib/support';
import { DEMO_EMAIL, isAdminRole } from '@/app/lib/user';

const demoEmail = DEMO_EMAIL;
const dailyXpGoal = 50;
const tabBlueprint = [
  { id: 'home', icon: Home },
  { id: 'lessons', icon: BookOpen },
  { id: 'practice', icon: NotebookPen },
  { id: 'culture', icon: Globe2 },
  { id: 'leaderboard', icon: Trophy },
  { id: 'stats', icon: BarChart3 },
  { id: 'shop', icon: ShoppingBag },
  { id: 'profile', icon: UserRound },
];
const lessonExerciseTypes = new Set(['quiz', 'textInput', 'match']);
const leaderboardPeriodFilters = ['all-time', 'weekly', 'monthly'];
const statsActivityFilters = ['all', 'lessons', 'reviews'];
const statsReviewQualityFilters = ['all', '3', '4', '5'];
const statsRangeFilters = ['7', '30', '90'];

function buildQueryString(params) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '' || value === 'all') {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function createUtcRange(startDate, daySpan) {
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + daySpan);

  return {
    startDate: rangeStart.toISOString(),
    endDate: rangeEnd.toISOString(),
  };
}

function isActivityInRange(value, range) {
  if (!range?.startDate || !range?.endDate || !value) {
    return true;
  }

  const timestamp = new Date(value).getTime();
  const start = new Date(range.startDate).getTime();
  const end = new Date(range.endDate).getTime();

  if (Number.isNaN(timestamp) || Number.isNaN(start) || Number.isNaN(end)) {
    return false;
  }

  return timestamp >= start && timestamp < end;
}

function isLessonExercise(section) {
  return lessonExerciseTypes.has(section?.type);
}

function getLessonReferenceSections(lesson) {
  return (lesson?.content ?? []).filter((section) => !isLessonExercise(section));
}

function getLessonExercises(lesson) {
  return (lesson?.content ?? []).filter(isLessonExercise);
}

function normalizeAnswer(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function triggerHapticFeedback(isSuccess) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  navigator.vibrate(isSuccess ? [18] : [24, 32, 24]);
}

function getLessonAccuracy(progress) {
  if (!progress?.total_exercises) {
    return 0;
  }

  return Math.round((progress.best_score / progress.total_exercises) * 100);
}

function getExamPrepProductSlugForLevel(levelCode) {
  const normalizedLevelCode = String(levelCode ?? '').trim().toUpperCase();

  if (normalizedLevelCode === 'A1' || normalizedLevelCode === 'A2') {
    return 'exam-prep-a2';
  }

  if (normalizedLevelCode === 'B1' || normalizedLevelCode === 'B2') {
    return 'exam-prep-b1';
  }

  if (normalizedLevelCode === 'C1' || normalizedLevelCode === 'C2') {
    return 'exam-prep-c1';
  }

  return null;
}

function getLessonCompletionOffer(lesson, ownedSlugs) {
  const productSlug = getExamPrepProductSlugForLevel(lesson?.level_code);

  if (!productSlug) {
    return null;
  }

  const product = getCatalogProduct(productSlug);

  if (!product) {
    return null;
  }

  return {
    ...product,
    owned: ownedSlugs.includes(productSlug),
    recommendedForLevel: lesson?.level_code ?? product.metadata?.levelCode ?? '',
  };
}

function QuickAction({ icon: Icon, label, active, onClick, tint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${tint} flex min-h-[92px] flex-col items-center justify-center rounded-[18px] px-4 text-center transition hover:scale-[0.98]`}
    >
      <Icon className={`h-5 w-5 ${active ? 'text-orange-500' : 'text-[#409cff]'}`} strokeWidth={2.2} />
      <span className={`mt-3 text-[12px] font-semibold ${active ? 'text-orange-500' : 'text-[#4d76f5]'}`}>
        {label}
      </span>
    </button>
  );
}

function HomeCard({ title, subtitle, gradient, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${gradient} flex w-full items-center gap-4 rounded-[16px] px-4 py-4 text-left text-white shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition hover:scale-[0.99]`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/18">
        <Icon className="h-5 w-5" strokeWidth={2.1} />
      </div>
      <div>
        <p className="text-[16px] font-semibold leading-5">{title}</p>
        <p className="mt-1 text-[12px] text-white/90">{subtitle}</p>
      </div>
    </button>
  );
}

function ShopProductCard({ product, locale, onUnlock, isUnlocking, canPurchase }) {
  const accessUntil = product.access?.expiresAt
    ? new Date(product.access.expiresAt).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <article className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{product.priceLabel}</p>
          <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-slate-950">
            {getLocalizedText(locale, product.title)}
          </h3>
          <p className="mt-2 text-[13px] leading-6 text-slate-600">{getLocalizedText(locale, product.description)}</p>
        </div>
        {product.owned ? (
          <span className="rounded-full bg-[#ecfdf5] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#059669]">
            {t(locale, 'shop.owned')}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#fff4ea] px-3 py-1.5 text-[12px] font-semibold text-[#c45a00]">
          {t(locale, 'shop.validity')}: {getLocalizedText(locale, product.validityLabel)}
        </span>
        {accessUntil ? (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
            {t(locale, 'shop.accessUntil', { date: accessUntil })}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {(product.highlights ?? []).map((highlight, index) => (
          <div key={`${product.slug}-highlight-${index}`} className="flex gap-3 text-[13px] leading-6 text-slate-600">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#ff8b26]" />
            <span>{getLocalizedText(locale, highlight)}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[20px] font-semibold tracking-tight text-slate-950">{product.priceLabel}</p>
        <button
          type="button"
          disabled={product.owned || isUnlocking || !canPurchase}
          onClick={() => onUnlock(product.slug)}
          className="rounded-[16px] bg-[#ff8b26] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#f97316] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {product.owned
            ? t(locale, 'shop.owned')
            : isUnlocking
              ? t(locale, 'shop.unlocking')
              : canPurchase
                ? t(locale, 'shop.unlockNow')
                : t(locale, 'shop.unavailable')}
        </button>
      </div>
    </article>
  );
}

function ExamPrepPackCard({ item, locale, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full rounded-[20px] border px-4 py-4 text-left transition',
        active
          ? 'border-[#ff8b26] bg-[#fff4ea] shadow-[0_12px_28px_rgba(255,139,38,0.15)]'
          : 'border-slate-200 bg-white hover:border-[#ffcf9e]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.levelCode}</p>
          <h3 className="mt-2 text-[17px] font-semibold tracking-tight text-slate-950">{getLocalizedText(locale, item.title)}</h3>
          <p className="mt-2 text-[13px] leading-6 text-slate-600">{getLocalizedText(locale, item.overview)}</p>
        </div>
        <span
          className={[
            'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
            item.access ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-slate-100 text-slate-500',
          ].join(' ')}
        >
          {item.access ? t(locale, 'shop.owned') : t(locale, 'shop.studioLocked')}
        </span>
      </div>
    </button>
  );
}

function MiniLessonCard({ lesson, selected, onClick, locale, progress }) {
  const accuracy = getLessonAccuracy(progress);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-[18px] border px-4 py-4 text-left transition',
        selected
          ? 'border-[#ff8b26] bg-[#fff4ea] shadow-[0_12px_28px_rgba(255,139,38,0.15)]'
          : 'border-[#eceff4] bg-white hover:border-[#ffcf9e]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {lesson.level_code} {t(locale, 'lessons.lessonLabel')} {lesson.order_index}
          </p>
          <p className="mt-2 text-[16px] font-semibold leading-5 text-slate-900">
            {getLocalizedText(locale, lesson.title)}
          </p>
          <p className="mt-2 text-[12px] leading-5 text-slate-500">
            {getLocalizedText(locale, lesson.description)}
          </p>
          {progress ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#fff4ea] px-2.5 py-1 text-[11px] font-semibold text-[#ff8b26]">
                {t(locale, 'lessons.completedBadge')}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {t(locale, 'lessons.bestScore')}: {progress.best_score}/{progress.total_exercises}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {accuracy}%
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function SectionBlock({ section, locale }) {
  if (!section) {
    return null;
  }

  return (
    <div className="rounded-[18px] bg-[#f8fafc] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {t(locale, `sectionTypes.${section.type}`)}
      </p>
      <h4 className="mt-2 text-[16px] font-semibold text-slate-900">{getLocalizedText(locale, section.title)}</h4>
      {section.prompt ? (
        <p className="mt-2 text-[13px] leading-6 text-slate-600">{getLocalizedText(locale, section.prompt)}</p>
      ) : null}
      {section.audioUrl ? (
        <div className="mt-3 rounded-[14px] border border-[#fde6cc] bg-white px-3 py-3">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#ff8b26]">
            <Volume2 className="h-4 w-4" />
            Audio
          </div>
          <audio controls preload="none" className="w-full" src={section.audioUrl} />
        </div>
      ) : null}
      {Array.isArray(section.items) ? (
        <div className="mt-3 space-y-2">
          {section.items.map((item, index) => (
            <div key={`${section.type}-${index}`} className="flex gap-3 text-[13px] leading-6 text-slate-600">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#ff8b26]" />
              <span>{getLocalizedText(locale, item)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {Array.isArray(section.lines) ? (
        <div className="mt-3 space-y-2 rounded-[14px] bg-white px-3 py-3 text-[13px] leading-6 text-slate-700">
          {section.lines.map((line, index) => (
            <p key={`${section.type}-line-${index}`}>{getLocalizedText(locale, line)}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Flashcard({ card, flipped, onFlip, onRate, disabled, labels, locale }) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onFlip}
        className="w-full rounded-[22px] bg-[linear-gradient(160deg,#fef3c7_0%,#ffffff_55%,#eff6ff_100%)] px-5 py-6 text-left shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {flipped ? labels.translation : labels.word}
        </p>
        <div className="flex min-h-[150px] items-center justify-center">
          <p className="text-center text-[34px] font-semibold leading-tight tracking-tight text-slate-950">
            {flipped ? getLocalizedText(locale, card.translation) : getLocalizedText(locale, card.word)}
          </p>
        </div>
        <p className="text-center text-[12px] text-slate-500">
          {flipped ? labels.flipBack : labels.flipForward}
        </p>
      </button>

      {card.pronunciation_url ? (
        <div className="rounded-[18px] border border-[#ebedf2] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Volume2 className="h-4 w-4 text-[#ff8b26]" />
            Pronunciation
          </div>
          <audio controls preload="none" className="w-full" src={card.pronunciation_url} />
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((quality) => (
          <button
            key={quality}
            type="button"
            disabled={disabled}
            onClick={() => onRate(quality)}
            className="rounded-[14px] border border-[#ebedf2] bg-white px-3 py-3 text-[13px] font-semibold text-slate-600 transition hover:border-[#ff8b26] hover:text-[#ff8b26] disabled:opacity-50"
          >
            {quality}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div className="rounded-[18px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-2 text-[28px] font-semibold tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}

function ActivityBars({ items, emptyLabel }) {
  if (items.length === 0) {
    return <p className="text-[13px] leading-6 text-slate-500">{emptyLabel}</p>;
  }

  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id}>
          <div className="flex items-center justify-between gap-3 text-[12px] font-medium text-slate-500">
            <span>{item.label}</span>
            <span>
              {item.value}
              {item.suffix ?? ''}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-[linear-gradient(90deg,#60a5fa_0%,#7c3aed_100%)]"
              style={{ width: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 10 : 0)}%` }}
            />
          </div>
          {item.meta ? <p className="mt-2 text-[12px] leading-5 text-slate-500">{item.meta}</p> : null}
        </div>
      ))}
    </div>
  );
}

function LeaderboardRow({ entry, isCurrentUser, locale }) {
  const displayName = entry?.username || entry?.email || t(locale, 'leaderboard.learnerFallback');
  const rankToneClassName =
    entry?.rank === 1 ? 'bg-amber-100 text-amber-700' : entry?.rank <= 3 ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600';

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-[18px] border px-4 py-4',
        isCurrentUser ? 'border-[#ffcf9e] bg-[#fff7ed]' : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-semibold ${rankToneClassName}`}>
        {entry.rank === 1 ? <Crown className="h-4 w-4" strokeWidth={2.2} /> : entry.rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-semibold text-slate-950">{displayName}</p>
          {isCurrentUser ? (
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
              {t(locale, 'leaderboard.you')}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] text-slate-500">
          {t(locale, 'leaderboard.rowMeta', {
            completed: entry.completed_lessons ?? 0,
            accuracy: entry.lesson_accuracy ?? 0,
          })}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[18px] font-semibold tracking-tight text-slate-950">{entry.xp ?? 0}</p>
        <p className="mt-1 text-[12px] text-slate-500">
          {entry.streak ?? 0} {t(locale, 'leaderboard.streakShort')}
        </p>
      </div>
    </div>
  );
}

function FilterPill({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-3 py-2 text-[12px] font-semibold transition',
        active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function ChartTooltipMetric({ label, value, tone = 'slate' }) {
  const toneClassName = {
    purple: 'text-[#7c3aed]',
    cyan: 'text-[#0ea5e9]',
    orange: 'text-[#f97316]',
    slate: 'text-slate-900',
  }[tone];

  return (
    <div className="rounded-[14px] bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-1 text-[15px] font-semibold ${toneClassName}`}>{value}</p>
    </div>
  );
}

function TrendChartTooltip({ active, payload, label, locale, activityType }) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }

  const showLessons = activityType !== 'reviews';
  const showReviews = activityType !== 'lessons';

  return (
    <div className="min-w-[220px] rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
      <p className="text-[13px] font-semibold text-slate-950">{label}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {showLessons ? (
          <ChartTooltipMetric label={t(locale, 'stats.chartLessons')} value={row.lessonAttempts ?? 0} tone="purple" />
        ) : null}
        {showReviews ? (
          <ChartTooltipMetric label={t(locale, 'stats.chartReviews')} value={row.reviewAttempts ?? 0} tone="cyan" />
        ) : null}
        <ChartTooltipMetric label={t(locale, 'stats.xp')} value={row.xpEarned ?? 0} tone="orange" />
      </div>
      <p className="mt-3 text-[12px] leading-5 text-slate-500">{row.meta}</p>
    </div>
  );
}

function LevelChartTooltip({ active, payload, label, locale }) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }

  return (
    <div className="min-w-[220px] rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
      <p className="text-[13px] font-semibold text-slate-950">{label}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ChartTooltipMetric label={t(locale, 'lessons.attempts')} value={row.attempts ?? 0} tone="orange" />
        <ChartTooltipMetric label={t(locale, 'stats.xp')} value={row.xp ?? 0} tone="purple" />
        <ChartTooltipMetric label={t(locale, 'stats.lessonAccuracy')} value={`${row.bestAccuracy ?? 0}%`} tone="slate" />
      </div>
      <p className="mt-3 text-[12px] leading-5 text-slate-500">{row.meta}</p>
    </div>
  );
}

function TrendChartCard({
  title,
  subtitle,
  rows,
  locale,
  emptyLabel,
  activityType = 'all',
  activeRowId = null,
  onSelectRow,
}) {
  const hasData = rows.some((row) => row.lessonAttempts > 0 || row.reviewAttempts > 0 || row.xpEarned > 0);
  const barSize = rows.length > 45 ? 8 : rows.length > 20 ? 12 : rows.length > 10 ? 18 : 26;
  const hasActiveRow = Boolean(activeRowId);
  const tickInterval = rows.length > 45 ? 9 : rows.length > 20 ? 4 : 0;

  return (
    <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{subtitle}</p>
        <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-slate-900">{title}</h3>
      </div>
      <div className="mt-4 h-[250px] rounded-[18px] bg-slate-50/80 px-2 py-3">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
                minTickGap={rows.length > 20 ? 18 : 6}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                content={<TrendChartTooltip locale={locale} activityType={activityType} />}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => {
                  if (value === 'lessonAttempts') {
                    return t(locale, 'stats.chartLessons');
                  }
                  if (value === 'reviewAttempts') {
                    return t(locale, 'stats.chartReviews');
                  }
                  return t(locale, 'stats.xp');
                }}
              />
              {activityType !== 'reviews' ? (
                <Bar
                  dataKey="lessonAttempts"
                  name="lessonAttempts"
                  fill="#7c3aed"
                  radius={[8, 8, 0, 0]}
                  barSize={barSize}
                  onClick={(data) => onSelectRow?.(data?.payload)}
                >
                  {rows.map((row) => (
                    <Cell
                      key={`lesson-${row.id}`}
                      fill={hasActiveRow && row.id !== activeRowId ? '#c4b5fd' : '#7c3aed'}
                      cursor={onSelectRow ? 'pointer' : 'default'}
                    />
                  ))}
                </Bar>
              ) : null}
              {activityType !== 'lessons' ? (
                <Bar
                  dataKey="reviewAttempts"
                  name="reviewAttempts"
                  fill="#0ea5e9"
                  radius={[8, 8, 0, 0]}
                  barSize={barSize}
                  onClick={(data) => onSelectRow?.(data?.payload)}
                >
                  {rows.map((row) => (
                    <Cell
                      key={`review-${row.id}`}
                      fill={hasActiveRow && row.id !== activeRowId ? '#7dd3fc' : '#0ea5e9'}
                      cursor={onSelectRow ? 'pointer' : 'default'}
                    />
                  ))}
                </Bar>
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-[13px] leading-6 text-slate-500">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
}

function HorizontalBarChartCard({ title, subtitle, rows, locale, emptyLabel, activeRowId = null, onSelectRow }) {
  const hasData = rows.length > 0;
  const hasActiveRow = Boolean(activeRowId);

  return (
    <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{subtitle}</p>
        <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-slate-900">{title}</h3>
      </div>
      <div className="mt-4 h-[250px] rounded-[18px] bg-slate-50/80 px-2 py-3">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                content={<LevelChartTooltip locale={locale} />}
              />
              <Bar dataKey="attempts" fill="#f97316" radius={[0, 8, 8, 0]} barSize={22} onClick={(data) => onSelectRow?.(data?.payload)}>
                {rows.map((row) => (
                  <Cell
                    key={`level-${row.id}`}
                    fill={hasActiveRow && row.id !== activeRowId ? '#fdba74' : '#f97316'}
                    cursor={onSelectRow ? 'pointer' : 'default'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-[13px] leading-6 text-slate-500">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
}

function BottomTab({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <button type="button" onClick={onClick} className="flex flex-1 flex-col items-center gap-1 py-2">
      <Icon className={`h-[18px] w-[18px] ${active ? 'text-[#ff8b26]' : 'text-slate-500'}`} strokeWidth={2.2} />
      <span className={`text-[10px] font-medium ${active ? 'text-[#ff8b26]' : 'text-slate-500'}`}>{tab.label}</span>
    </button>
  );
}

function SidebarTab({ tab, active, onClick }) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left transition',
        active
          ? 'bg-[linear-gradient(135deg,#fff1e4_0%,#ffffff_100%)] text-slate-950 shadow-[0_16px_30px_rgba(255,139,38,0.16)]'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-10 w-10 items-center justify-center rounded-[14px] transition',
          active ? 'bg-[#ff8b26] text-white' : 'bg-slate-100 text-slate-500',
        ].join(' ')}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
      </span>
      <span>
        <span className="block text-[14px] font-semibold">{tab.label}</span>
      </span>
    </button>
  );
}

function LanguageModal({ isOpen, locale, onClose, onSelect }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-3 pb-5 pt-10 backdrop-blur-sm md:items-center md:px-6 md:pb-6">
      <div className="w-full max-w-[480px] rounded-[24px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[20px] font-semibold tracking-tight text-slate-900">{t(locale, 'profile.languageModalTitle')}</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-500">{t(locale, 'profile.languageModalSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600"
          >
            {t(locale, 'common.close')}
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {supportedLocales.map((option) => {
            const active = option.id === locale;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={[
                  'flex items-center justify-between rounded-[18px] border px-4 py-4 text-left transition',
                  active
                    ? 'border-[#ff8b26] bg-[#fff4ea] shadow-[0_12px_28px_rgba(255,139,38,0.15)]'
                    : 'border-[#eceff4] bg-white hover:border-[#ffcf9e]',
                ].join(' ')}
              >
                <span className="flex items-center gap-3">
                  <span className="text-[20px]">{option.flag}</span>
                  <span>
                    <span className="block text-[14px] font-semibold text-slate-900">{option.label}</span>
                    <span className="block text-[12px] text-slate-500">{option.id.toUpperCase()}</span>
                  </span>
                </span>
                <span className={`text-[12px] font-semibold ${active ? 'text-[#ff8b26]' : 'text-slate-400'}`}>
                  {active ? t(locale, 'common.active') : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LessonExerciseLab({
  lesson,
  locale,
  onComplete,
  savedProgress,
  isSavingProgress,
  completionOffer,
  onSelectCompletionOffer,
}) {
  const exercises = useMemo(() => getLessonExercises(lesson), [lesson]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [pendingLeftId, setPendingLeftId] = useState(null);
  const [matchSelections, setMatchSelections] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [score, setScore] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    setExerciseIndex(0);
    setSelectedOptionIndex(null);
    setTypedAnswer('');
    setPendingLeftId(null);
    setMatchSelections({});
    setSubmitted(false);
    setLastResult(null);
    setScore(0);
    setCompletedCount(0);
  }, [lesson?.id]);

  const activeExercise = exercises[exerciseIndex] ?? null;
  const activePrompt = getLocalizedText(locale, activeExercise?.prompt);
  const activeExplanation = getLocalizedText(locale, activeExercise?.explanation);
  const isLastExercise = exerciseIndex === exercises.length - 1;
  const isFinished = exercises.length > 0 && completedCount >= exercises.length;
  const savedAccuracy = getLessonAccuracy(savedProgress);
  const allPairsSelected =
    activeExercise?.type === 'match' &&
    Object.keys(matchSelections).length === (activeExercise?.pairs?.length ?? 0);

  function resetCurrentExerciseState() {
    setSelectedOptionIndex(null);
    setTypedAnswer('');
    setPendingLeftId(null);
    setMatchSelections({});
    setSubmitted(false);
    setLastResult(null);
  }

  function submitResult(isCorrect) {
    setSubmitted(true);
    setLastResult(isCorrect);
    triggerHapticFeedback(isCorrect);
    if (isCorrect) {
      setScore((current) => current + 1);
    }
  }

  function handleCheckAnswer() {
    if (!activeExercise || submitted) {
      return;
    }

    if (activeExercise.type === 'quiz') {
      submitResult(selectedOptionIndex === activeExercise.correctIndex);
      return;
    }

    if (activeExercise.type === 'textInput') {
      const normalizedAnswer = normalizeAnswer(typedAnswer);
      const acceptedAnswers = (activeExercise.acceptedAnswers ?? []).map(normalizeAnswer);
      submitResult(acceptedAnswers.includes(normalizedAnswer));
      return;
    }

    if (activeExercise.type === 'match') {
      const isCorrect = (activeExercise.pairs ?? []).every((pair) => {
        return normalizeAnswer(matchSelections[pair.id]) === normalizeAnswer(pair.right);
      });
      submitResult(isCorrect);
    }
  }

  function handleNextExercise() {
    if (!activeExercise) {
      return;
    }

    if (isLastExercise) {
      onComplete?.({
        lessonId: lesson?.id,
        score,
        totalExercises: exercises.length,
      });
      setCompletedCount(exercises.length);
      setSubmitted(false);
      setLastResult(null);
      return;
    }

    setCompletedCount((current) => current + 1);
    setExerciseIndex((current) => current + 1);
    resetCurrentExerciseState();
  }

  function handleRestart() {
    setExerciseIndex(0);
    setScore(0);
    setCompletedCount(0);
    resetCurrentExerciseState();
  }

  function assignMatch(leftId, rightValue) {
    setMatchSelections((current) => {
      const next = { ...current };
      for (const [existingLeftId, existingRightValue] of Object.entries(next)) {
        if (existingRightValue === rightValue) {
          delete next[existingLeftId];
        }
      }
      next[leftId] = rightValue;
      return next;
    });
    setPendingLeftId(null);
  }

  if (exercises.length === 0) {
    return (
      <section className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {t(locale, 'lessons.interactiveTitle')}
        </p>
        <p className="mt-3 text-[14px] leading-6 text-slate-600">{t(locale, 'lessons.noExercises')}</p>
      </section>
    );
  }

  if (isFinished || !activeExercise) {
    return (
      <section className="rounded-[24px] bg-[linear-gradient(160deg,#eff6ff_0%,#ffffff_60%,#fff7ed_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {t(locale, 'lessons.interactiveTitle')}
        </p>
        <h4 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">
          {t(locale, 'lessons.completedTitle')}
        </h4>
        <p className="mt-3 text-[14px] leading-7 text-slate-600">
          {t(locale, 'lessons.completedCopy', { score, total: exercises.length })}
        </p>
        <div className="mt-5 flex items-center justify-between rounded-[18px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'lessons.score')}</p>
            <p className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">{score} / {exercises.length}</p>
          </div>
          <button
            type="button"
            onClick={handleRestart}
            className="rounded-[16px] bg-[#ff8b26] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#f97316]"
          >
            {t(locale, 'lessons.restart')}
          </button>
        </div>
        {savedProgress ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t(locale, 'lessons.bestScore')}</p>
              <p className="mt-2 text-[20px] font-semibold tracking-tight text-slate-950">
                {savedProgress.best_score} / {savedProgress.total_exercises}
              </p>
            </div>
            <div className="rounded-[18px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t(locale, 'lessons.attempts')}</p>
              <p className="mt-2 text-[20px] font-semibold tracking-tight text-slate-950">
                {savedProgress.attempts_count} · {savedAccuracy}%
              </p>
            </div>
          </div>
        ) : null}
        {completionOffer ? (
          <div className="mt-4 rounded-[18px] border border-[#fde6cc] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c45a00]">
              {t(locale, 'lessons.recommendedPack')}
            </p>
            <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="max-w-[34rem]">
                <h5 className="text-[18px] font-semibold tracking-tight text-slate-950">
                  {getLocalizedText(locale, completionOffer.title)}
                </h5>
                <p className="mt-2 text-[13px] leading-6 text-slate-600">
                  {completionOffer.owned
                    ? t(locale, 'lessons.recommendedPackOwnedCopy', {
                        pack: getLocalizedText(locale, completionOffer.title),
                      })
                    : t(locale, 'lessons.recommendedPackCopy', {
                        level: completionOffer.recommendedForLevel,
                        pack: getLocalizedText(locale, completionOffer.title),
                      })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectCompletionOffer?.(completionOffer.slug)}
                className="rounded-[16px] bg-slate-950 px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-slate-800"
              >
                {completionOffer.owned ? t(locale, 'lessons.openPack') : t(locale, 'lessons.viewPack')}
              </button>
            </div>
            {!completionOffer.owned ? (
              <p className="mt-3 text-[12px] font-medium text-slate-500">
                {completionOffer.priceLabel} · {getLocalizedText(locale, completionOffer.validityLabel)}
              </p>
            ) : null}
          </div>
        ) : null}
        {isSavingProgress ? (
          <p className="mt-4 text-[12px] font-medium text-slate-500">{t(locale, 'common.saving')}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-[24px] bg-[linear-gradient(160deg,#fff7ed_0%,#ffffff_45%,#eff6ff_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {t(locale, 'lessons.interactiveTitle')}
          </p>
          <h4 className="mt-2 text-[22px] font-semibold tracking-tight text-slate-950">
            {getLocalizedText(locale, activeExercise.title)}
          </h4>
          <p className="mt-2 text-[13px] leading-6 text-slate-600">{t(locale, 'lessons.interactiveSubtitle')}</p>
        </div>
        <div className="grid min-w-[160px] grid-cols-2 gap-3">
          <div className="rounded-[18px] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t(locale, 'lessons.progress')}</p>
            <p className="mt-2 text-[18px] font-semibold text-slate-900">
              {t(locale, 'lessons.questionCounter', { current: exerciseIndex + 1, total: exercises.length })}
            </p>
          </div>
          <div className="rounded-[18px] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t(locale, 'lessons.score')}</p>
            <p className="mt-2 text-[18px] font-semibold text-slate-900">{score}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        {activePrompt ? <p className="text-[15px] font-medium leading-7 text-slate-800">{activePrompt}</p> : null}

        {activeExercise.type === 'quiz' ? (
          <div className="mt-4 grid gap-3">
            {(activeExercise.options ?? []).map((option, index) => {
              const isSelected = selectedOptionIndex === index;
              const isCorrectOption = submitted && index === activeExercise.correctIndex;
              const isIncorrectSelection = submitted && isSelected && index !== activeExercise.correctIndex;

              return (
                <button
                  key={`${activeExercise.title?.en ?? 'quiz'}-${index}`}
                  type="button"
                  disabled={submitted}
                  onClick={() => setSelectedOptionIndex(index)}
                  className={[
                    'rounded-[18px] border px-4 py-4 text-left text-[14px] font-medium transition',
                    isCorrectOption
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : isIncorrectSelection
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : isSelected
                          ? 'border-[#ff8b26] bg-[#fff4ea] text-slate-900'
                          : 'border-[#eceff4] bg-[#fafafa] text-slate-700 hover:border-[#ffcf9e]',
                  ].join(' ')}
                >
                  {getLocalizedText(locale, option)}
                </button>
              );
            })}
          </div>
        ) : null}

        {activeExercise.type === 'textInput' ? (
          <div className="mt-4">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" htmlFor="lesson-text-answer">
              {t(locale, 'lessons.answerLabel')}
            </label>
            <input
              id="lesson-text-answer"
              type="text"
              value={typedAnswer}
              disabled={submitted}
              onChange={(event) => setTypedAnswer(event.target.value)}
              placeholder={getLocalizedText(locale, activeExercise.placeholder) || t(locale, 'lessons.typeAnswer')}
              className="mt-3 w-full rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#ff8b26] focus:bg-white"
            />
          </div>
        ) : null}

        {activeExercise.type === 'match' ? (
          <div className="mt-4 space-y-4">
            <p className="text-[13px] leading-6 text-slate-500">
              {pendingLeftId
                ? `${t(locale, 'lessons.matchPrompt')}: ${getLocalizedText(locale, activeExercise.pairs.find((pair) => pair.id === pendingLeftId)?.left)}`
                : t(locale, 'lessons.choosePair')}
            </p>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                {(activeExercise.pairs ?? []).map((pair) => {
                  const selected = pendingLeftId === pair.id;
                  const assignedRight = matchSelections[pair.id];

                  return (
                    <button
                      key={pair.id}
                      type="button"
                      disabled={submitted}
                      onClick={() => setPendingLeftId((current) => (current === pair.id ? null : pair.id))}
                      className={[
                        'w-full rounded-[18px] border px-4 py-4 text-left transition',
                        selected
                          ? 'border-[#7c3aed] bg-[#f5edff]'
                          : 'border-[#eceff4] bg-[#fafafa] hover:border-[#d4b5ff]',
                      ].join(' ')}
                    >
                      <p className="text-[14px] font-medium text-slate-900">{getLocalizedText(locale, pair.left)}</p>
                      {assignedRight ? (
                        <p className="mt-2 text-[12px] font-semibold text-[#7c3aed]">{assignedRight}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                {(activeExercise.pairs ?? []).map((pair) => {
                  const ownerId = Object.entries(matchSelections).find(([, value]) => value === pair.right)?.[0];
                  const isSelectedRight = ownerId != null;

                  return (
                    <button
                      key={`${pair.id}-right`}
                      type="button"
                      disabled={submitted || !pendingLeftId}
                      onClick={() => assignMatch(pendingLeftId, pair.right)}
                      className={[
                        'w-full rounded-[18px] border px-4 py-4 text-left transition',
                        isSelectedRight
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-[#eceff4] bg-white text-slate-700 hover:border-[#ffcf9e]',
                        pendingLeftId ? '' : 'opacity-60',
                      ].join(' ')}
                    >
                      <p className="text-[14px] font-medium">{pair.right}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {submitted ? (
          <div
            className={[
              'mt-4 rounded-[18px] px-4 py-4',
              lastResult ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
            ].join(' ')}
          >
            <p className="text-[14px] font-semibold">{lastResult ? t(locale, 'lessons.correct') : t(locale, 'lessons.incorrect')}</p>
            {activeExplanation ? (
              <p className="mt-2 text-[13px] leading-6">
                <span className="font-semibold">{t(locale, 'lessons.explanation')}:</span> {activeExplanation}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submitted ? handleNextExercise : handleCheckAnswer}
            disabled={
              submitted
                ? false
                : activeExercise.type === 'quiz'
                  ? selectedOptionIndex == null
                  : activeExercise.type === 'textInput'
                    ? typedAnswer.trim().length === 0
                    : !allPairsSelected
            }
            className="rounded-[16px] bg-[#ff8b26] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#f97316] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitted ? t(locale, 'lessons.next') : t(locale, 'lessons.checkAnswer')}
          </button>

          {!submitted && activeExercise.type === 'match' && allPairsSelected ? (
            <p className="text-[12px] font-medium text-slate-500">{t(locale, 'lessons.readyToCheck')}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  const [activeTab, setActiveTab] = useState('home');
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('all-time');
  const [statsRangeFilter, setStatsRangeFilter] = useState('7');
  const [statsLevelFilter, setStatsLevelFilter] = useState('all');
  const [statsActivityFilter, setStatsActivityFilter] = useState('all');
  const [statsReviewQualityFilter, setStatsReviewQualityFilter] = useState('all');
  const [statsDrilldown, setStatsDrilldown] = useState(null);
  const [user, setUser] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [lessonProgress, setLessonProgress] = useState([]);
  const [lessonActivity, setLessonActivity] = useState([]);
  const [reviewActivity, setReviewActivity] = useState([]);
  const [activitySummary, setActivitySummary] = useState({ daily: [], weekly: [] });
  const [vocabulary, setVocabulary] = useState([]);
  const [cultureCategories, setCultureCategories] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [leaderboardState, setLeaderboardState] = useState({
    entries: [],
    currentUserEntry: null,
    totalUsers: 0,
    loading: true,
    error: null,
  });
  const [examPrepState, setExamPrepState] = useState({ items: [], loading: true, error: null, selectedSlug: null });
  const [shopState, setShopState] = useState({
    sections: [],
    ownedSlugs: [],
    checkoutMode: 'catalog-only',
    loading: true,
    error: null,
    notice: null,
    purchasingSlug: null,
  });
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [selectedCultureCategoryId, setSelectedCultureCategoryId] = useState(null);
  const [selectedCultureEntryId, setSelectedCultureEntryId] = useState(null);
  const [cultureSearchQuery, setCultureSearchQuery] = useState('');
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [savingLessonId, setSavingLessonId] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: null, savingReview: false });

  function readStoredLocale() {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  }

  function readUrlState() {
    if (typeof window === 'undefined') {
      return { activeTab: null, checkout: null, sessionId: null };
    }

    const searchParams = new URLSearchParams(window.location.search);
    return {
      activeTab: searchParams.get('tab'),
      checkout: searchParams.get('checkout'),
      sessionId: searchParams.get('session_id'),
    };
  }

  function clearCheckoutQueryParams() {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    url.searchParams.delete('session_id');
    url.searchParams.delete('product');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  useEffect(() => {
    const storedLocale = readStoredLocale();
    const urlState = readUrlState();
    if (storedLocale) {
      setLocale(resolveLocale(storedLocale));
    }
    if (urlState.activeTab && tabBlueprint.some((tab) => tab.id === urlState.activeTab)) {
      setActiveTab(urlState.activeTab);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const normalizedLocale = resolveLocale(locale);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLocale);
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${encodeURIComponent(normalizedLocale)}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = normalizedLocale;
  }, [locale]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setStatus((current) => ({ ...current, loading: true, error: null }));

      try {
        const storedLocale = readStoredLocale();
        const userResponse = await fetch(`/api/user?email=${encodeURIComponent(demoEmail)}`);
        const nextUser = await userResponse.json();
        const preferredLocale = resolveLocale(nextUser?.locale ?? storedLocale ?? DEFAULT_LOCALE);

        const [
          lessonsResponse,
          vocabularyResponse,
          reviewsResponse,
          lessonProgressResponse,
        ] = await Promise.all([
          fetch('/api/lessons'),
          fetch('/api/vocabulary?limit=100'),
          fetch(`/api/spaced-repetition?userId=${encodeURIComponent(nextUser.id)}`),
          fetch(`/api/lesson-progress?userId=${encodeURIComponent(nextUser.id)}`),
        ]);

        const [analytics, cultureResponse] = await Promise.all([
          fetchAnalytics(nextUser.id, { level: 'all', activityType: 'all', minQuality: 'all', rangeDays: '7' }),
          fetch('/api/culture'),
        ]);

        const [
          nextLessons,
          nextVocabulary,
          nextReviews,
          nextLessonProgress,
          nextCulture,
        ] = await Promise.all([
          lessonsResponse.json(),
          vocabularyResponse.json(),
          reviewsResponse.json(),
          lessonProgressResponse.json(),
          cultureResponse.json(),
        ]);

        if (cancelled) {
          return;
        }

        setUser(nextUser);
        setLocale(preferredLocale);
        setLessons(Array.isArray(nextLessons) ? nextLessons : []);
        setLessonProgress(Array.isArray(nextLessonProgress) ? nextLessonProgress : []);
        setLessonActivity(analytics.lessonActivity);
        setReviewActivity(analytics.reviewActivity);
        setActivitySummary(analytics.activitySummary);
        setVocabulary(Array.isArray(nextVocabulary) ? nextVocabulary : []);
        setCultureCategories(Array.isArray(nextCulture) ? nextCulture : []);
        setReviews(Array.isArray(nextReviews) ? nextReviews : []);
        setSelectedLessonId(nextLessons?.[0]?.id ?? null);
        setSelectedCultureCategoryId(nextCulture?.[0]?.id ?? null);
        setStatus({ loading: false, error: null, savingReview: false });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus({
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load app data.',
          savingReview: false,
        });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.id || status.loading) {
      return;
    }

    let cancelled = false;

    async function syncAnalyticsFilters() {
      try {
        const analytics = await fetchAnalytics(user.id, {
          level: statsLevelFilter,
          activityType: statsActivityFilter,
          minQuality: statsReviewQualityFilter,
          rangeDays: statsRangeFilter,
        });

        if (cancelled) {
          return;
        }

        setLessonActivity(analytics.lessonActivity);
        setReviewActivity(analytics.reviewActivity);
        setActivitySummary(analytics.activitySummary);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus((current) => ({
          ...current,
          error: error instanceof Error ? error.message : 'Failed to refresh analytics.',
        }));
      }
    }

    syncAnalyticsFilters();
    return () => {
      cancelled = true;
    };
  }, [statsActivityFilter, statsLevelFilter, statsRangeFilter, statsReviewQualityFilter, status.loading, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    async function loadShopCatalog() {
      setShopState((current) => ({ ...current, loading: true, error: null }));

      try {
        const query = buildQueryString({ action: 'available', userId: user.id });
        const response = await fetch(`/api/purchases${query}`);

        if (!response.ok) {
          throw new Error('Failed to load the shop catalog.');
        }

        const payload = await response.json();

        if (cancelled) {
          return;
        }

        setShopState((current) => ({
          ...current,
          sections: Array.isArray(payload?.sections) ? payload.sections : [],
          ownedSlugs: Array.isArray(payload?.ownedSlugs) ? payload.ownedSlugs : [],
          checkoutMode: payload?.checkoutMode ?? 'catalog-only',
          loading: false,
          error: null,
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setShopState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load the shop catalog.',
        }));
      }
    }

    loadShopCatalog();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    async function loadLeaderboard() {
      setLeaderboardState((current) => ({ ...current, loading: true, error: null }));

      try {
        const query = buildQueryString({ userId: user.id, limit: 20, period: leaderboardPeriod });
        const response = await fetch(`/api/leaderboard${query}`);

        if (!response.ok) {
          throw new Error('Failed to load leaderboard.');
        }

        const payload = await response.json();

        if (cancelled) {
          return;
        }

        setLeaderboardState({
          entries: Array.isArray(payload?.entries) ? payload.entries : [],
          currentUserEntry: payload?.currentUserEntry ?? null,
          totalUsers: Number(payload?.totalUsers ?? 0),
          loading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLeaderboardState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load leaderboard.',
        }));
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [leaderboardPeriod, user?.id, user?.xp, user?.streak, lessonProgress.length, reviewActivity.length]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    async function loadExamPrepStudio() {
      setExamPrepState((current) => ({ ...current, loading: true, error: null }));

      try {
        const query = buildQueryString({ userId: user.id });
        const response = await fetch(`/api/exam-prep${query}`);

        if (!response.ok) {
          throw new Error('Failed to load exam prep packs.');
        }

        const payload = await response.json();
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const firstOwned = items.find((item) => item.access)?.productSlug ?? null;

        if (cancelled) {
          return;
        }

        setExamPrepState((current) => ({
          ...current,
          items,
          loading: false,
          error: null,
          selectedSlug:
            current.selectedSlug && items.some((item) => item.productSlug === current.selectedSlug)
              ? current.selectedSlug
              : firstOwned ?? items[0]?.productSlug ?? null,
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setExamPrepState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load exam prep packs.',
        }));
      }
    }

    loadExamPrepStudio();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const urlState = readUrlState();

    if (urlState.checkout === 'cancel') {
      setActiveTab('shop');
      setShopState((current) => ({
        ...current,
        notice: t(locale, 'shop.checkoutCancelled'),
      }));
      clearCheckoutQueryParams();
      return;
    }

    if (urlState.checkout !== 'success' || !urlState.sessionId) {
      return;
    }

    let cancelled = false;

    async function confirmCheckout() {
      setActiveTab('shop');
      setShopState((current) => ({
        ...current,
        purchasingSlug: null,
        error: null,
        notice: null,
      }));

      try {
        const query = buildQueryString({ action: 'confirm-checkout', userId: user.id, sessionId: urlState.sessionId });
        const response = await fetch(`/api/purchases${query}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? t(locale, 'shop.checkoutError'));
        }

        if (cancelled) {
          return;
        }

        setShopState((current) => ({
          ...current,
          sections: Array.isArray(payload?.catalog?.sections) ? payload.catalog.sections : current.sections,
          ownedSlugs: Array.isArray(payload?.catalog?.ownedSlugs) ? payload.catalog.ownedSlugs : current.ownedSlugs,
          checkoutMode: payload?.checkoutMode ?? current.checkoutMode,
          notice: payload?.paid ? t(locale, 'shop.checkoutSuccess') : t(locale, 'shop.checkoutPending'),
          error: null,
        }));

        if (payload?.paid && payload?.product?.slug) {
          setExamPrepState((current) => ({
            ...current,
            items: current.items.map((item) =>
              item.productSlug === payload.product.slug
                ? {
                    ...item,
                    access: item.access ?? {
                      grantedAt: new Date().toISOString(),
                      expiresAt: payload?.purchase?.expires_at ?? null,
                      source: payload?.purchase?.source ?? 'stripe',
                    },
                  }
                : item
            ),
            selectedSlug: payload.product.slug,
          }));
        }

        clearCheckoutQueryParams();
      } catch (error) {
        if (cancelled) {
          return;
        }

        setShopState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : t(locale, 'shop.checkoutError'),
          notice: null,
        }));
      }
    }

    confirmCheckout();

    return () => {
      cancelled = true;
    };
  }, [locale, user?.id]);

  useEffect(() => {
    setStatsDrilldown(null);
  }, [statsActivityFilter, statsLevelFilter, statsRangeFilter, statsReviewQualityFilter]);

  const selectedLesson = useMemo(() => {
    return lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0] ?? null;
  }, [lessons, selectedLessonId]);

  const deferredCultureSearchQuery = useDeferredValue(cultureSearchQuery.trim().toLowerCase());

  const filteredCultureCategories = useMemo(() => {
    if (!deferredCultureSearchQuery) {
      return cultureCategories;
    }

    return cultureCategories
      .map((category) => {
        const categoryText = [
          getLocalizedText(locale, category.title),
          getLocalizedText(locale, category.description),
        ]
          .join(' ')
          .toLowerCase();

        const matchingEntries = (category.entries ?? []).filter((entry) => {
          const entryText = [
            getLocalizedText(locale, entry.title),
            getLocalizedText(locale, entry.period),
            getLocalizedText(locale, entry.blurb),
            ...(entry.takeaways ?? []).map((item) => getLocalizedText(locale, item)),
          ]
            .join(' ')
            .toLowerCase();

          return entryText.includes(deferredCultureSearchQuery);
        });

        if (categoryText.includes(deferredCultureSearchQuery)) {
          return category;
        }

        if (matchingEntries.length === 0) {
          return null;
        }

        return {
          ...category,
          entries: matchingEntries,
        };
      })
      .filter(Boolean);
  }, [cultureCategories, deferredCultureSearchQuery, locale]);

  const selectedCultureCategory = useMemo(() => {
    return (
      filteredCultureCategories.find((category) => category.id === selectedCultureCategoryId) ??
      filteredCultureCategories[0] ??
      null
    );
  }, [filteredCultureCategories, selectedCultureCategoryId]);

  useEffect(() => {
    const hasSelectedCategory = filteredCultureCategories.some((category) => category.id === selectedCultureCategoryId);
    if (!hasSelectedCategory) {
      setSelectedCultureCategoryId(filteredCultureCategories[0]?.id ?? null);
    }
  }, [filteredCultureCategories, selectedCultureCategoryId]);

  useEffect(() => {
    const hasSelectedEntry = selectedCultureCategory?.entries?.some((entry) => entry.id === selectedCultureEntryId);
    if (!hasSelectedEntry) {
      setSelectedCultureEntryId(selectedCultureCategory?.entries?.[0]?.id ?? null);
    }
  }, [selectedCultureCategory, selectedCultureEntryId]);

  const selectedCultureEntry = useMemo(() => {
    return (
      selectedCultureCategory?.entries?.find((entry) => entry.id === selectedCultureEntryId) ??
      selectedCultureCategory?.entries?.[0] ??
      null
    );
  }, [selectedCultureCategory, selectedCultureEntryId]);

  const tabs = useMemo(() => {
    return tabBlueprint.map((tab) => ({ ...tab, label: t(locale, `tabs.${tab.id}`) }));
  }, [locale]);

  const localeMeta = useMemo(() => getLocaleMeta(locale), [locale]);
  const levelFilterOptions = useMemo(() => {
    return ['all', ...new Set(lessons.map((lesson) => lesson.level_code).filter(Boolean))];
  }, [lessons]);
  const reviewQualityFilterOptions = useMemo(() => statsReviewQualityFilters, []);
  const rangeFilterOptions = useMemo(() => statsRangeFilters, []);
  const lessonProgressMap = useMemo(() => {
    return Object.fromEntries(lessonProgress.map((item) => [item.lesson_id, item]));
  }, [lessonProgress]);
  const selectedRangeDays = Number(statsRangeFilter);
  const selectedRangeWeeks = Math.max(1, Math.ceil(selectedRangeDays / 7));

  const activeCard = vocabulary[activeCardIndex] ?? null;
  const canPurchaseFromShop = shopState.checkoutMode === 'prototype-grant' || shopState.checkoutMode === 'stripe-checkout';
  const xp = user?.xp ?? 0;
  const xpProgress = Math.min((xp / dailyXpGoal) * 100, 100);
  const streak = user?.streak ?? reviews.length;
  const completedLessonsCount = lessonProgress.length;
  const totalLessonAttempts = lessonProgress.reduce((sum, item) => sum + (item.attempts_count ?? 0), 0);
  const bestLessonAccuracy =
    lessonProgress.length > 0
      ? Math.round(lessonProgress.reduce((sum, item) => sum + getLessonAccuracy(item), 0) / lessonProgress.length)
      : 0;
  const selectedLessonProgress = selectedLesson ? lessonProgressMap[selectedLesson.id] ?? null : null;
  const selectedLessonCompletionOffer = useMemo(() => {
    return getLessonCompletionOffer(selectedLesson, shopState.ownedSlugs);
  }, [selectedLesson, shopState.ownedSlugs]);
  const selectedExamPrepPack = useMemo(() => {
    return examPrepState.items.find((item) => item.productSlug === examPrepState.selectedSlug) ?? examPrepState.items[0] ?? null;
  }, [examPrepState.items, examPrepState.selectedSlug]);
  const filteredLessonActivity = useMemo(() => {
    return lessonActivity.filter((item) => isActivityInRange(item.completed_at, statsDrilldown));
  }, [lessonActivity, statsDrilldown]);
  const filteredReviewActivity = useMemo(() => {
    return reviewActivity.filter((item) => isActivityInRange(item.completed_at, statsDrilldown));
  }, [reviewActivity, statsDrilldown]);
  const recentLessonActivity = useMemo(() => {
    return filteredLessonActivity.slice(0, 7).map((item) => {
      const completedAt = item.completed_at ? new Date(item.completed_at) : null;
      const label = completedAt
        ? completedAt.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
        : item.level_code;

      return {
        id: item.id,
        label,
        value: item.accuracy_percent ?? 0,
        suffix: '%',
        meta: `${item.level_code} · ${getLocalizedText(locale, item.title_translations ?? item.title)}`,
      };
    });
  }, [filteredLessonActivity, locale]);
  const recentReviewActivity = useMemo(() => {
    return filteredReviewActivity.slice(0, 7).map((item) => {
      const completedAt = item.completed_at ? new Date(item.completed_at) : null;
      const label = completedAt
        ? completedAt.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
        : t(locale, 'stats.reviewed');
      const wordLabel = getLocalizedText(locale, item.translation_translations ?? item.translation) || item.translation;

      return {
        id: item.id,
        label,
        value: item.quality ?? 0,
        suffix: '/5',
        meta: t(locale, 'stats.reviewMeta', {
          word: item.word,
          translation: wordLabel,
          xp: item.xp_earned ?? 0,
        }),
      };
    });
  }, [filteredReviewActivity, locale]);
  const dailyTrendRows = useMemo(() => {
    return (activitySummary.daily ?? []).map((item) => {
      const range = createUtcRange(item.startDate, 1);

      return {
        id: item.id,
        label: new Date(item.startDate).toLocaleDateString(locale, { weekday: 'short' }),
        lessonAttempts: item.lessonAttempts ?? 0,
        reviewAttempts: item.reviewAttempts ?? 0,
        xpEarned: item.xpEarned ?? 0,
        startDate: range.startDate,
        endDate: range.endDate,
        meta: t(locale, 'stats.trendMeta', {
          lessons: item.lessonAttempts ?? 0,
          reviews: item.reviewAttempts ?? 0,
          xp: item.xpEarned ?? 0,
        }),
      };
    });
  }, [activitySummary.daily, locale]);
  const weeklyTrendRows = useMemo(() => {
    return (activitySummary.weekly ?? []).map((item) => {
      const startDate = new Date(item.startDate);
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 6);
      const range = createUtcRange(item.startDate, 7);

      return {
        id: item.id,
        label: `${startDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`,
        lessonAttempts: item.lessonAttempts ?? 0,
        reviewAttempts: item.reviewAttempts ?? 0,
        xpEarned: item.xpEarned ?? 0,
        startDate: range.startDate,
        endDate: range.endDate,
        meta: t(locale, 'stats.trendMeta', {
          lessons: item.lessonAttempts ?? 0,
          reviews: item.reviewAttempts ?? 0,
          xp: item.xpEarned ?? 0,
        }),
      };
    });
  }, [activitySummary.weekly, locale]);
  const levelProgressRows = useMemo(() => {
    const grouped = lessonActivity.reduce((accumulator, item) => {
      const level = item.level_code ?? 'A1';
      const current = accumulator[level] ?? { attempts: 0, xp: 0, bestAccuracy: 0 };
      current.attempts += 1;
      current.xp += item.xp_earned ?? 0;
      current.bestAccuracy = Math.max(current.bestAccuracy, item.accuracy_percent ?? 0);
      accumulator[level] = current;
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([level, metrics]) => ({
        id: level,
        label: level,
        attempts: metrics.attempts,
        xp: metrics.xp,
        bestAccuracy: metrics.bestAccuracy,
        meta: t(locale, 'stats.levelMeta', { xp: metrics.xp, accuracy: metrics.bestAccuracy }),
      }));
  }, [lessonActivity, locale]);

  const activeDrilldownLabel = statsDrilldown
    ? t(locale, 'stats.activeDrilldown', {
        label: statsDrilldown.label,
      })
    : null;

  async function fetchAnalytics(userId, filters = {}) {
    const lessonActivityQuery = buildQueryString({ userId, level: filters.level });
    const activitySummaryQuery = buildQueryString({
      userId,
      level: filters.level,
      activityType: filters.activityType,
      minQuality: filters.minQuality,
      rangeDays: filters.rangeDays,
    });
    const reviewActivityQuery = buildQueryString({ userId, minQuality: filters.minQuality, rangeDays: filters.rangeDays });
    const lessonActivityScopedQuery = buildQueryString({ userId, level: filters.level, rangeDays: filters.rangeDays });

    const [lessonActivityResponse, reviewActivityResponse, activitySummaryResponse] = await Promise.all([
      fetch(`/api/lesson-activity${lessonActivityScopedQuery || lessonActivityQuery}`),
      fetch(`/api/review-activity${reviewActivityQuery}`),
      fetch(`/api/activity-summary${activitySummaryQuery}`),
    ]);

    if (!lessonActivityResponse.ok || !reviewActivityResponse.ok || !activitySummaryResponse.ok) {
      throw new Error('Failed to fetch analytics');
    }

    const [nextLessonActivity, nextReviewActivity, nextActivitySummary] = await Promise.all([
      lessonActivityResponse.json(),
      reviewActivityResponse.json(),
      activitySummaryResponse.json(),
    ]);

    return {
      lessonActivity: Array.isArray(nextLessonActivity) ? nextLessonActivity : [],
      reviewActivity: Array.isArray(nextReviewActivity) ? nextReviewActivity : [],
      activitySummary: {
        daily: Array.isArray(nextActivitySummary?.daily) ? nextActivitySummary.daily : [],
        weekly: Array.isArray(nextActivitySummary?.weekly) ? nextActivitySummary.weekly : [],
      },
    };
  }

  async function refreshActivitySummary(userId) {
    if (!userId) {
      return;
    }

    const analytics = await fetchAnalytics(userId, {
      level: statsLevelFilter,
      activityType: statsActivityFilter,
      minQuality: statsReviewQualityFilter,
      rangeDays: statsRangeFilter,
    });

    setLessonActivity(analytics.lessonActivity);
    setReviewActivity(analytics.reviewActivity);
    setActivitySummary(analytics.activitySummary);
  }

  function handleTrendDrilldown(row, bucketType) {
    if (!row?.id) {
      return;
    }

    setStatsDrilldown((current) => {
      if (current?.bucketType === bucketType && current?.id === row.id) {
        return null;
      }

      return {
        id: row.id,
        label: row.label,
        bucketType,
        startDate: row.startDate,
        endDate: row.endDate,
      };
    });
  }

  function handleLevelDrilldown(row) {
    if (!row?.id) {
      return;
    }

    setStatsLevelFilter((current) => (current === row.id ? 'all' : row.id));
  }

  async function patchUser(updates) {
    if (!user?.email) {
      return;
    }

    const response = await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, ...updates }),
    });

    if (!response.ok) {
      throw new Error('Failed to update user progress');
    }

    const nextUser = await response.json();
    setUser(nextUser);
  }

  async function handleReview(quality) {
    if (!activeCard || !user) {
      return;
    }

    setStatus((current) => ({ ...current, savingReview: true, error: null }));

    try {
      const response = await fetch('/api/spaced-repetition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, wordId: activeCard.id, quality }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (payload?.code === 'FREE_TIER_LIMIT_REACHED') {
          handleFreeTierLimit(payload);
          setStatus((current) => ({ ...current, savingReview: false, error: null }));
          return;
        }

        throw new Error(payload?.error ?? 'Failed to save review');
      }

      const savedReview = payload.review ?? payload;

      setReviews((current) => {
        const index = current.findIndex((item) => item.word_id === savedReview.word_id);
        if (index === -1) {
          return [savedReview, ...current];
        }
        const next = current.slice();
        next[index] = { ...next[index], ...savedReview };
        return next;
      });
      if (payload.user) {
        setUser(payload.user);
      }
      setReviewActivity((current) => {
        const nextItem = payload.reviewActivity
          ? {
              ...payload.reviewActivity,
              word: activeCard.word,
              translation: activeCard.translation,
              translation_translations: activeCard.translation_translations,
            }
          : null;

        return nextItem ? [nextItem, ...current].slice(0, 60) : current;
      });
      await refreshActivitySummary(user.id);

      setCardFlipped(false);
      setActiveCardIndex((current) => (vocabulary.length > 1 ? (current + 1) % vocabulary.length : 0));
      setStatus((current) => ({ ...current, savingReview: false }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        savingReview: false,
        error: error instanceof Error ? error.message : 'Failed to save review.',
      }));
    }
  }

  async function handleLessonCompletion({ lessonId, score, totalExercises }) {
    if (!user?.id || !lessonId || !Number.isInteger(score) || !Number.isInteger(totalExercises)) {
      return;
    }

    setSavingLessonId(lessonId);

    try {
      const response = await fetch('/api/lesson-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, lessonId, score, totalExercises }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (payload?.code === 'FREE_TIER_LIMIT_REACHED') {
          handleFreeTierLimit(payload);
          return;
        }

        throw new Error(payload?.error ?? 'Failed to save lesson progress');
      }

      const savedProgress = payload.progress ?? payload;
      setLessonProgress((current) => {
        const index = current.findIndex((item) => item.lesson_id === savedProgress.lesson_id);
        if (index === -1) {
          return [savedProgress, ...current];
        }

        const next = current.slice();
        next[index] = { ...next[index], ...savedProgress };
        return next;
      });
      if (payload.user) {
        setUser(payload.user);
      }
      setLessonActivity((current) => {
        const titleTranslations = selectedLesson?.title_translations ?? selectedLesson?.title ?? {};

        return [
          {
            id: `${lessonId}-${Date.now()}`,
            lesson_id: lessonId,
            level_code: selectedLesson?.level_code ?? '',
            title: selectedLesson?.title ?? titleTranslations,
            title_translations: titleTranslations,
            score,
            total_exercises: totalExercises,
            accuracy_percent: totalExercises > 0 ? Math.round((score / totalExercises) * 100) : 0,
            xp_earned: payload.xpEarned ?? 0,
            completed_at: new Date().toISOString(),
          },
          ...current,
        ].slice(0, 60);
      });
      await refreshActivitySummary(user.id);
    } catch (error) {
      setStatus((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Failed to save lesson progress.',
      }));
    } finally {
      setSavingLessonId(null);
    }
  }

  async function handleUnlockProduct(productSlug) {
    if (!user?.id || !user?.email || !productSlug) {
      return;
    }

    setShopState((current) => ({ ...current, purchasingSlug: productSlug, error: null }));

    try {
      const response = await fetch('/api/purchases?action=purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, productSlug }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to unlock product.');
      }

      setShopState((current) => ({
        ...current,
        sections: Array.isArray(payload?.catalog?.sections) ? payload.catalog.sections : current.sections,
        ownedSlugs: Array.isArray(payload?.catalog?.ownedSlugs) ? payload.catalog.ownedSlugs : current.ownedSlugs,
        checkoutMode: payload?.catalog?.checkoutMode ?? current.checkoutMode,
        purchasingSlug: payload?.checkoutUrl ? productSlug : null,
        error: null,
        notice: null,
      }));

      setExamPrepState((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.productSlug === productSlug
            ? {
                ...item,
                access: item.access ?? { grantedAt: new Date().toISOString(), expiresAt: null, source: payload?.checkoutMode ?? 'prototype' },
              }
            : item
        ),
      }));

      if (payload?.checkoutUrl && typeof window !== 'undefined') {
        window.location.assign(payload.checkoutUrl);
        return;
      }

      setShopState((current) => ({
        ...current,
        purchasingSlug: null,
      }));
    } catch (error) {
      setShopState((current) => ({
        ...current,
        purchasingSlug: null,
        error: error instanceof Error ? error.message : 'Failed to unlock product.',
        notice: null,
      }));
    }
  }

  function handleOpenLessonCompletionOffer(productSlug) {
    if (!productSlug) {
      return;
    }

    const product = getCatalogProduct(productSlug);

    setExamPrepState((current) => ({
      ...current,
      selectedSlug: productSlug,
    }));
    setShopState((current) => ({
      ...current,
      notice: product
        ? t(locale, 'shop.lessonRecommendation', {
            pack: getLocalizedText(locale, product.title),
          })
        : current.notice,
      error: null,
    }));
    setActiveTab('shop');
  }

  function handleFreeTierLimit(payload) {
    const recommendedProductSlug = payload?.recommendedProductSlug ?? 'exam-prep-a2';
    const product = getCatalogProduct(recommendedProductSlug);
    const featureLabel = t(locale, `paywall.${payload?.activityType ?? 'lesson'}`);

    setExamPrepState((current) => ({
      ...current,
      selectedSlug: recommendedProductSlug,
    }));
    setShopState((current) => ({
      ...current,
      notice: product
        ? t(locale, 'shop.freeTierUpgradePrompt', {
            feature: featureLabel,
            limit: payload?.limit ?? 0,
            pack: getLocalizedText(locale, product.title),
          })
        : t(locale, 'shop.freeTierUpgradeFallback', {
            feature: featureLabel,
            limit: payload?.limit ?? 0,
          }),
      error: null,
      purchasingSlug: null,
    }));
    setStatus((current) => ({ ...current, error: null }));
    setActiveTab('shop');
  }

  function renderHome() {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#1e293b_0%,#0f172a_40%,#1d4ed8_100%)] px-5 py-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] md:px-7 md:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[34rem]">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
                <Flame className="h-3.5 w-3.5" strokeWidth={2.4} />
                <span>{streak} day streak</span>
              </div>
              <h1 className="mt-4 text-[30px] font-semibold tracking-tight md:text-[40px]">{t(locale, 'home.greeting')}</h1>
              <p className="mt-3 max-w-[30rem] text-[14px] leading-7 text-white/78 md:text-[15px]">
                {t(locale, 'home.ready')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:max-w-[24rem] lg:w-[22rem]">
              <div className="rounded-[22px] bg-white/12 px-4 py-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">XP</p>
                <p className="mt-3 text-[28px] font-semibold tracking-tight">{xp}</p>
              </div>
              <div className="rounded-[22px] bg-white/12 px-4 py-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">{t(locale, 'stats.completedLessons')}</p>
                <p className="mt-3 text-[28px] font-semibold tracking-tight">{completedLessonsCount}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-semibold text-white/92">{t(locale, 'home.dailyGoal')}</p>
                <p className="mt-1 text-[12px] text-white/68">{xp} / {dailyXpGoal} XP</p>
              </div>
              <p className="text-[12px] font-medium text-white/70">{Math.round(xpProgress)}%</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/15">
              <div
                className="h-2 rounded-full bg-[linear-gradient(90deg,#fbbf24_0%,#fb923c_55%,#f97316_100%)]"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <QuickAction
                icon={Star}
                label={t(locale, 'home.review')}
                active={false}
                tint="bg-[#eaf3ff]"
                onClick={() => setActiveTab('practice')}
              />
              <QuickAction
                icon={Trophy}
                label={t(locale, 'tabs.leaderboard')}
                active
                tint="bg-[#f3e8ff]"
                onClick={() => setActiveTab('leaderboard')}
              />
              <QuickAction
                icon={BrainCircuit}
                label={t(locale, 'tabs.culture')}
                active={false}
                tint="bg-[#eefbf4]"
                onClick={() => setActiveTab('culture')}
              />
              <QuickAction
                icon={UserRound}
                label={t(locale, 'tabs.profile')}
                active={false}
                tint="bg-[#fff5dd]"
                onClick={() => setActiveTab('profile')}
              />
            </section>

            <section>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[14px] font-semibold text-slate-800">{t(locale, 'home.nextLessons')}</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('lessons')}
                  className="text-[12px] font-semibold text-[#2d6ee8]"
                >
                  {t(locale, 'tabs.lessons')}
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <HomeCard
                  title={t(locale, 'home.spacedRepetition')}
                  subtitle={t(locale, 'home.spacedRepetitionSubtitle', {
                    count: Math.max(vocabulary.length - reviews.length, 0),
                  })}
                  gradient="bg-[linear-gradient(135deg,#3fa9ff_0%,#2d6ee8_100%)]"
                  icon={BookOpen}
                  onClick={() => setActiveTab('practice')}
                />
                <HomeCard
                  title={t(locale, 'home.culturalImmersion')}
                  subtitle={
                    getLocalizedText(locale, selectedCultureCategory?.description) ||
                    t(locale, 'home.cultureSubtitle', { count: cultureCategories.length })
                  }
                  gradient="bg-[linear-gradient(135deg,#d972ff_0%,#9333ea_100%)]"
                  icon={Star}
                  onClick={() => setActiveTab('culture')}
                />
                <HomeCard
                  title={t(locale, 'home.premium')}
                  subtitle={t(locale, 'home.premiumSubtitle')}
                  gradient="bg-[linear-gradient(135deg,#ff9c1a_0%,#ff6b00_100%)]"
                  icon={Crown}
                  onClick={() => setActiveTab('shop')}
                />
              </div>
            </section>
          </div>

          <section className="rounded-[28px] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t(locale, 'tabs.lessons')}</p>
                <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-slate-900">
                  {selectedLesson ? getLocalizedText(locale, selectedLesson.title) : t(locale, 'lessons.title')}
                </h2>
              </div>
              <div className="rounded-full bg-[#fff4ea] px-3 py-1.5 text-[12px] font-semibold text-[#ff8b26]">
                {lessons.length} total
              </div>
            </div>

            {selectedLesson ? (
              <>
                <p className="mt-3 text-[13px] leading-6 text-slate-500">
                  {getLocalizedText(locale, selectedLesson.description)}
                </p>
                {selectedLessonProgress ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#fff4ea] px-3 py-1.5 text-[12px] font-semibold text-[#ff8b26]">
                      {t(locale, 'lessons.bestScore')}: {selectedLessonProgress.best_score}/{selectedLessonProgress.total_exercises}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                      {t(locale, 'lessons.attempts')}: {selectedLessonProgress.attempts_count}
                    </span>
                  </div>
                ) : null}
                <div className="mt-5 space-y-3">
                  {getLessonReferenceSections(selectedLesson).slice(0, 2).map((section, index) => (
                    <SectionBlock key={`${selectedLesson.id}-preview-${index}`} section={section} locale={locale} />
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 text-[13px] text-slate-500">{t(locale, 'common.loading')}</p>
            )}
          </section>
        </div>
      </div>
    );
  }

  function renderLessons() {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">{t(locale, 'lessons.title')}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{t(locale, 'lessons.subtitle')}</p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.2fr)]">
          <section className="space-y-3">
            {lessons.map((lesson) => (
              <MiniLessonCard
                key={lesson.id}
                lesson={lesson}
                locale={locale}
                progress={lessonProgressMap[lesson.id]}
                selected={selectedLesson?.id === lesson.id}
                onClick={() => setSelectedLessonId(lesson.id)}
              />
            ))}
          </section>

          {selectedLesson ? (
            <section className="space-y-3 rounded-[24px] bg-white px-5 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {selectedLesson.level_code} {t(locale, 'lessons.lessonLabel')} {selectedLesson.order_index}
                </p>
                <h3 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-900">
                  {getLocalizedText(locale, selectedLesson.title)}
                </h3>
                <p className="mt-2 text-[14px] leading-7 text-slate-600">
                  {getLocalizedText(locale, selectedLesson.description)}
                </p>
                {selectedLessonProgress ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#fff4ea] px-3 py-1.5 text-[12px] font-semibold text-[#ff8b26]">
                      {t(locale, 'lessons.bestScore')}: {selectedLessonProgress.best_score}/{selectedLessonProgress.total_exercises}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                      {t(locale, 'lessons.attempts')}: {selectedLessonProgress.attempts_count}
                    </span>
                  </div>
                ) : null}
              </div>
              {getLessonReferenceSections(selectedLesson).map((section, index) => (
                <SectionBlock key={`${selectedLesson.id}-${index}`} section={section} locale={locale} />
              ))}
              <LessonExerciseLab
                key={`${selectedLesson.id}-lab`}
                lesson={selectedLesson}
                locale={locale}
                savedProgress={selectedLessonProgress}
                isSavingProgress={savingLessonId === selectedLesson.id}
                completionOffer={selectedLessonCompletionOffer}
                onSelectCompletionOffer={handleOpenLessonCompletionOffer}
                onComplete={handleLessonCompletion}
              />
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  function renderPractice() {
    const flashcardLabels = {
      word: t(locale, 'practice.word'),
      translation: t(locale, 'practice.translation'),
      flipForward: t(locale, 'practice.flipForward'),
      flipBack: t(locale, 'practice.flipBack'),
    };

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">{t(locale, 'practice.title')}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{t(locale, 'practice.subtitle')}</p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_320px]">
          <section>
            {activeCard ? (
              <Flashcard
                card={activeCard}
                flipped={cardFlipped}
                onFlip={() => setCardFlipped((current) => !current)}
                onRate={handleReview}
                disabled={status.savingReview}
                labels={flashcardLabels}
                locale={locale}
              />
            ) : (
              <div className="rounded-[18px] bg-white px-4 py-5 text-[13px] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                {t(locale, 'practice.empty')}
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Deck</p>
              <p className="mt-2 text-[26px] font-semibold tracking-tight text-slate-900">{vocabulary.length}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">
                {Math.max(vocabulary.length - reviews.length, 0)} cards still need a fresh review cycle.
              </p>
            </div>
            <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Progress</p>
              <p className="mt-2 text-[26px] font-semibold tracking-tight text-slate-900">{reviews.length}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">
                Completed reviews are synced to your spaced repetition schedule.
              </p>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  function renderCulture() {
    if (!selectedCultureCategory || !selectedCultureEntry) {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">{t(locale, 'culture.title')}</h2>
            <p className="mt-1 text-[13px] text-slate-500">{t(locale, 'culture.subtitle')}</p>
          </div>
          <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400" htmlFor="culture-search-empty">
              {t(locale, 'culture.searchLabel')}
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="culture-search-empty"
                type="search"
                value={cultureSearchQuery}
                onChange={(event) => setCultureSearchQuery(event.target.value)}
                placeholder={t(locale, 'culture.searchPlaceholder')}
                className="w-full rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#7c3aed] focus:bg-white"
              />
              {cultureSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setCultureSearchQuery('')}
                  className="rounded-[16px] bg-slate-100 px-4 py-3 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  {t(locale, 'culture.clearSearch')}
                </button>
              ) : null}
            </div>
          </section>
          <div className="rounded-[18px] bg-white px-4 py-5 text-[13px] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <p className="font-semibold text-slate-900">{t(locale, 'culture.noResultsTitle')}</p>
            <p className="mt-2 leading-6 text-slate-500">
              {cultureSearchQuery ? t(locale, 'culture.noResultsCopy') : t(locale, 'culture.empty')}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">{t(locale, 'culture.title')}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{t(locale, 'culture.subtitle')}</p>
        </div>

        <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400" htmlFor="culture-search">
                {t(locale, 'culture.searchLabel')}
              </label>
              <input
                id="culture-search"
                type="search"
                value={cultureSearchQuery}
                onChange={(event) => setCultureSearchQuery(event.target.value)}
                placeholder={t(locale, 'culture.searchPlaceholder')}
                className="mt-3 w-full rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#7c3aed] focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#f5edff] px-3 py-2 text-[12px] font-semibold text-[#7c3aed]">
                {t(locale, 'culture.results', { count: filteredCultureCategories.length })}
              </span>
              {cultureSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setCultureSearchQuery('')}
                  className="rounded-[16px] bg-slate-100 px-4 py-3 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  {t(locale, 'culture.clearSearch')}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.2fr)]">
          <div className="space-y-5">
            <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t(locale, 'culture.categories')}</p>
                <span className="text-[12px] font-semibold text-[#7c3aed]">{filteredCultureCategories.length}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-1">
                {filteredCultureCategories.map((category) => {
                  const active = category.id === selectedCultureCategory.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCultureCategoryId(category.id)}
                      className={[
                        'rounded-[18px] border px-3 py-3 text-left transition',
                        active
                          ? 'border-[#7c3aed] bg-[#f5edff] shadow-[0_12px_28px_rgba(124,58,237,0.12)]'
                          : 'border-[#eceff4] bg-[#fafafa] hover:border-[#d4b5ff]',
                      ].join(' ')}
                    >
                      <p className="text-[18px]">{category.emoji}</p>
                      <p className="mt-2 text-[13px] font-semibold text-slate-900">{getLocalizedText(locale, category.title)}</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">{getLocalizedText(locale, category.description)}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t(locale, 'culture.insights')}</p>
              <div className="mt-3 space-y-3">
                {(selectedCultureEntry.takeaways ?? []).map((item) => (
                  <div key={getLocalizedText(locale, item)} className="flex gap-3 rounded-[16px] bg-[#f8fafc] px-3 py-3">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-[#ff8b26]" />
                    <p className="text-[13px] leading-6 text-slate-600">{getLocalizedText(locale, item)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-[22px] bg-[linear-gradient(160deg,#fff7ed_0%,#ffffff_55%,#f5edff_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'culture.featured')}</p>
                  <h3 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight text-slate-950">
                    {getLocalizedText(locale, selectedCultureEntry.title)}
                  </h3>
                  <p className="mt-2 text-[12px] font-medium text-[#7c3aed]">
                    {t(locale, `sectionTypes.${selectedCultureEntry.type}`)} · {getLocalizedText(locale, selectedCultureEntry.period)}
                  </p>
                </div>
                <div className="rounded-full bg-white px-3 py-2 text-[18px] shadow-sm">{selectedCultureCategory.emoji}</div>
              </div>
              <p className="mt-4 text-[13px] leading-6 text-slate-600">{getLocalizedText(locale, selectedCultureEntry.blurb)}</p>
              <p className="mt-3 text-[12px] font-medium text-slate-500">{t(locale, 'culture.explore')}</p>
            </section>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {selectedCultureCategory.entries.map((entry) => {
                const active = entry.id === selectedCultureEntry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedCultureEntryId(entry.id)}
                    className={[
                      'w-full rounded-[18px] border px-4 py-4 text-left transition',
                      active
                        ? 'border-[#ff8b26] bg-[#fff4ea] shadow-[0_12px_28px_rgba(255,139,38,0.15)]'
                        : 'border-[#eceff4] bg-white hover:border-[#ffcf9e]',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {t(locale, `sectionTypes.${entry.type}`)}
                        </p>
                        <p className="mt-2 text-[16px] font-semibold text-slate-900">{getLocalizedText(locale, entry.title)}</p>
                        <p className="mt-2 text-[12px] leading-5 text-slate-500">{getLocalizedText(locale, entry.period)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderStats() {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">{t(locale, 'stats.title')}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{t(locale, 'stats.subtitle')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <StatTile label={t(locale, 'stats.xp')} value={xp} accent="text-[#ff8b26]" />
          <StatTile label={t(locale, 'stats.streak')} value={streak} accent="text-[#2d6ee8]" />
          <StatTile label={t(locale, 'stats.lessons')} value={lessons.length} accent="text-[#7c3aed]" />
          <StatTile label={t(locale, 'stats.reviewed')} value={reviews.length} accent="text-[#059669]" />
          <StatTile label={t(locale, 'stats.completedLessons')} value={completedLessonsCount} accent="text-[#f97316]" />
          <StatTile label={t(locale, 'stats.lessonAccuracy')} value={`${bestLessonAccuracy}%`} accent="text-[#7c3aed]" />
        </div>
        <div className="rounded-[18px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-slate-700">{t(locale, 'stats.momentum')}</span>
            <Medal className="h-4 w-4 text-[#ff8b26]" strokeWidth={2.2} />
          </div>
          <p className="mt-3 text-[13px] leading-6 text-slate-600">
            {t(locale, 'stats.momentumCopy', {
              reviews: reviews.length,
              completed: completedLessonsCount,
              attempts: totalLessonAttempts,
            })}
          </p>
        </div>

        <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="grid gap-4 xl:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'stats.filterRangeLabel')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {rangeFilterOptions.map((filter) => (
                  <FilterPill
                    key={filter}
                    active={statsRangeFilter === filter}
                    label={t(locale, `stats.rangeFilters.${filter}`)}
                    onClick={() => setStatsRangeFilter(filter)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'stats.filterLevelLabel')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {levelFilterOptions.map((level) => (
                  <FilterPill
                    key={level}
                    active={statsLevelFilter === level}
                    label={level === 'all' ? t(locale, 'stats.filterAllLevels') : level}
                    onClick={() => setStatsLevelFilter(level)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'stats.filterActivityLabel')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {statsActivityFilters.map((filter) => (
                  <FilterPill
                    key={filter}
                    active={statsActivityFilter === filter}
                    label={t(locale, `stats.activityFilters.${filter}`)}
                    onClick={() => setStatsActivityFilter(filter)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'stats.filterQualityLabel')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {reviewQualityFilterOptions.map((filter) => (
                  <FilterPill
                    key={filter}
                    active={statsReviewQualityFilter === filter}
                    label={t(locale, `stats.qualityFilters.${filter}`)}
                    onClick={() => setStatsReviewQualityFilter(filter)}
                  />
                ))}
              </div>
            </div>
          </div>

          {statsDrilldown ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[18px] bg-slate-50 px-4 py-3 text-[12px] text-slate-600">
              <span className="font-semibold text-slate-800">{activeDrilldownLabel}</span>
              <button
                type="button"
                onClick={() => setStatsDrilldown(null)}
                className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition hover:text-slate-950"
              >
                {t(locale, 'stats.clearDrilldown')}
              </button>
            </div>
          ) : (
            <p className="mt-4 text-[12px] leading-5 text-slate-500">{t(locale, 'stats.chartDrilldownHint')}</p>
          )}
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <TrendChartCard
            title={t(locale, 'stats.dailyTrendTitle', { count: selectedRangeDays })}
            subtitle={t(locale, 'stats.dailyTrend')}
            rows={dailyTrendRows}
            locale={locale}
            activityType={statsActivityFilter}
            emptyLabel={t(locale, 'stats.noTrendData')}
            activeRowId={statsDrilldown?.bucketType === 'day' ? statsDrilldown.id : null}
            onSelectRow={(row) => handleTrendDrilldown(row, 'day')}
          />

          <TrendChartCard
            title={t(locale, 'stats.weeklyTrendTitle', { count: selectedRangeWeeks })}
            subtitle={t(locale, 'stats.weeklyTrend')}
            rows={weeklyTrendRows}
            locale={locale}
            activityType={statsActivityFilter}
            emptyLabel={t(locale, 'stats.noTrendData')}
            activeRowId={statsDrilldown?.bucketType === 'week' ? statsDrilldown.id : null}
            onSelectRow={(row) => handleTrendDrilldown(row, 'week')}
          />

          <HorizontalBarChartCard
            title={t(locale, 'stats.levelBreakdownTitle')}
            subtitle={t(locale, 'stats.levelBreakdown')}
            rows={levelProgressRows}
            locale={locale}
            emptyLabel={t(locale, 'stats.noLessonActivity')}
            activeRowId={statsLevelFilter === 'all' ? null : statsLevelFilter}
            onSelectRow={handleLevelDrilldown}
          />

          <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'stats.recentActivity')}</p>
                <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-slate-900">{t(locale, 'stats.recentActivityTitle')}</h3>
              </div>
              <span className="rounded-full bg-[#eef2ff] px-3 py-1.5 text-[12px] font-semibold text-[#4f46e5]">
                {filteredLessonActivity.length}
              </span>
            </div>
            <div className="mt-4">
              <ActivityBars items={recentLessonActivity} emptyLabel={t(locale, 'stats.noLessonActivity')} />
            </div>
          </section>

          <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'stats.reviewed')}</p>
                <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-slate-900">{t(locale, 'stats.reviewActivityTitle')}</h3>
              </div>
              <span className="rounded-full bg-[#ecfdf5] px-3 py-1.5 text-[12px] font-semibold text-[#059669]">
                {filteredReviewActivity.length}
              </span>
            </div>
            <div className="mt-4">
              <ActivityBars
                items={recentReviewActivity}
                emptyLabel={
                  statsReviewQualityFilter === 'all'
                    ? t(locale, 'stats.noReviewActivity')
                    : t(locale, 'stats.noReviewActivityFiltered')
                }
              />
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderLeaderboard() {
    const visibleEntries = leaderboardState.entries;
    const isCurrentUserVisible = visibleEntries.some((entry) => entry.id === leaderboardState.currentUserEntry?.id);
    const leaderboardPeriodLabel = t(locale, `leaderboard.periods.${leaderboardPeriod}`);

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">{t(locale, 'leaderboard.title')}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{t(locale, 'leaderboard.subtitle')}</p>
        </div>

        <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_45%,#fff7ed_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{leaderboardPeriodLabel}</p>
              <h3 className="mt-2 text-[26px] font-semibold tracking-tight text-slate-950">{t(locale, 'leaderboard.heroTitle')}</h3>
              <p className="mt-3 max-w-[34rem] text-[14px] leading-7 text-slate-600">{t(locale, 'leaderboard.heroCopy')}</p>
            </div>
            <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'leaderboard.totalLearners')}</p>
              <p className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">{leaderboardState.totalUsers}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'leaderboard.periodLabel')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {leaderboardPeriodFilters.map((period) => (
                <FilterPill
                  key={period}
                  active={leaderboardPeriod === period}
                  label={t(locale, `leaderboard.periods.${period}`)}
                  onClick={() => setLeaderboardPeriod(period)}
                />
              ))}
            </div>
          </div>
        </section>

        {leaderboardState.error ? (
          <div className="rounded-[16px] bg-[#fff1f2] px-4 py-3 text-[13px] text-rose-700">{leaderboardState.error}</div>
        ) : null}

        {leaderboardState.loading ? (
          <div className="rounded-[18px] bg-white px-4 py-5 text-[13px] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            {t(locale, 'common.loading')}
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="rounded-[18px] bg-white px-4 py-5 text-[13px] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            {t(locale, 'leaderboard.empty')}
          </div>
        ) : (
          <section className="space-y-3 rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'leaderboard.rankings')}</p>
                <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-slate-900">{t(locale, 'leaderboard.topLearners')}</h3>
              </div>
              {leaderboardState.currentUserEntry ? (
                <span className="rounded-full bg-[#eef2ff] px-3 py-1.5 text-[12px] font-semibold text-[#4f46e5]">
                  {t(locale, 'leaderboard.currentRank', { rank: leaderboardState.currentUserEntry.rank ?? '-' })}
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              {visibleEntries.map((entry) => (
                <LeaderboardRow
                  key={entry.id}
                  entry={entry}
                  locale={locale}
                  isCurrentUser={entry.id === leaderboardState.currentUserEntry?.id}
                />
              ))}
            </div>

            {leaderboardState.currentUserEntry && !isCurrentUserVisible ? (
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t(locale, 'leaderboard.yourPosition')}
                </p>
                <LeaderboardRow entry={leaderboardState.currentUserEntry} locale={locale} isCurrentUser />
              </div>
            ) : null}
          </section>
        )}
      </div>
    );
  }

  function renderShop() {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">{t(locale, 'shop.title')}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{t(locale, 'shop.subtitle')}</p>
        </div>

        <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#fff4ea_0%,#fffdf8_35%,#eef4ff_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c45a00]">{t(locale, 'shop.eyebrow')}</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[40rem]">
              <h3 className="text-[26px] font-semibold tracking-tight text-slate-950">{t(locale, 'shop.heroTitle')}</h3>
              <p className="mt-3 text-[14px] leading-7 text-slate-600">{t(locale, 'shop.heroCopy')}</p>
            </div>
            <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'shop.featured')}</p>
              <p className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">
                {shopState.ownedSlugs.filter((slug) => slug.startsWith('exam-prep-')).length}
              </p>
              <p className="mt-1 text-[12px] text-slate-500">exam-prep products owned</p>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <p className="text-[13px] leading-6 text-slate-600">
            {shopState.checkoutMode === 'stripe-checkout'
              ? t(locale, 'shop.stripeReady')
              : canPurchaseFromShop
                ? t(locale, 'shop.prototypeMode')
                : t(locale, 'shop.catalogOnly')}
          </p>
        </section>

        {shopState.notice ? (
          <div className="rounded-[16px] bg-[#ecfdf5] px-4 py-3 text-[13px] text-emerald-700">{shopState.notice}</div>
        ) : null}

        {shopState.error ? (
          <div className="rounded-[16px] bg-[#fff1f2] px-4 py-3 text-[13px] text-rose-700">{shopState.error}</div>
        ) : null}

        {shopState.loading ? (
          <div className="rounded-[18px] bg-white px-4 py-5 text-[13px] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            {t(locale, 'common.loading')}
          </div>
        ) : shopState.sections.length === 0 ? (
          <div className="rounded-[18px] bg-white px-4 py-5 text-[13px] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            {t(locale, 'shop.empty')}
          </div>
        ) : (
          <div className="space-y-5">
            {shopState.sections.map((section) => (
              <section key={section.id} className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{section.id}</p>
                    <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-slate-950">
                      {getLocalizedText(locale, section.title)}
                    </h3>
                    <p className="mt-2 text-[13px] leading-6 text-slate-500">{getLocalizedText(locale, section.description)}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                    {section.products.length}
                  </span>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {section.products.map((product) => (
                    <ShopProductCard
                      key={product.slug}
                      product={product}
                      locale={locale}
                      onUnlock={handleUnlockProduct}
                      isUnlocking={shopState.purchasingSlug === product.slug}
                      canPurchase={canPurchaseFromShop}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="space-y-4 rounded-[24px] bg-[linear-gradient(160deg,#ffffff_0%,#f8fafc_50%,#fff7ed_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div>
            <h3 className="text-[22px] font-semibold tracking-tight text-slate-950">{t(locale, 'shop.studioTitle')}</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">{t(locale, 'shop.studioSubtitle')}</p>
          </div>

          {examPrepState.error ? (
            <div className="rounded-[16px] bg-[#fff1f2] px-4 py-3 text-[13px] text-rose-700">{examPrepState.error}</div>
          ) : null}

          {examPrepState.loading ? (
            <div className="rounded-[18px] bg-white px-4 py-5 text-[13px] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              {t(locale, 'common.loading')}
            </div>
          ) : examPrepState.items.length === 0 ? (
            <div className="rounded-[18px] bg-white px-4 py-5 text-[13px] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              {t(locale, 'shop.studioEmpty')}
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.2fr)]">
              <div className="space-y-3">
                {examPrepState.items.map((item) => (
                  <ExamPrepPackCard
                    key={item.productSlug}
                    item={item}
                    locale={locale}
                    active={selectedExamPrepPack?.productSlug === item.productSlug}
                    onSelect={() => setExamPrepState((current) => ({ ...current, selectedSlug: item.productSlug }))}
                  />
                ))}
              </div>

              {selectedExamPrepPack ? (
                <div className="space-y-4 rounded-[22px] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{selectedExamPrepPack.levelCode}</p>
                    <h4 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">
                      {getLocalizedText(locale, selectedExamPrepPack.title)}
                    </h4>
                    <p className="mt-3 text-[14px] leading-7 text-slate-600">
                      {getLocalizedText(locale, selectedExamPrepPack.overview)}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'shop.focusAreas')}</p>
                    <div className="mt-3 space-y-2">
                      {(selectedExamPrepPack.focusAreas ?? []).map((item, index) => (
                        <div key={`${selectedExamPrepPack.productSlug}-focus-${index}`} className="flex gap-3 text-[13px] leading-6 text-slate-600">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#ff8b26]" />
                          <span>{getLocalizedText(locale, item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!selectedExamPrepPack.access ? (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-[13px] leading-6 text-slate-600">
                      {t(locale, 'shop.accessRequired')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'shop.packModules')}</p>
                        <span className="rounded-full bg-[#ecfdf5] px-3 py-1.5 text-[12px] font-semibold text-[#059669]">
                          {t(locale, 'shop.studioOpen')}
                        </span>
                      </div>
                      {selectedExamPrepPack.modules.map((module) => (
                        <section key={module.id} className="space-y-3 rounded-[20px] bg-[#f8fafc] px-4 py-4">
                          <h5 className="text-[18px] font-semibold tracking-tight text-slate-900">{getLocalizedText(locale, module.title)}</h5>
                          {module.sections.map((section, index) => (
                            <SectionBlock key={`${module.id}-${index}`} section={section} locale={locale} />
                          ))}
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderProfile() {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">{t(locale, 'profile.title')}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{t(locale, 'profile.subtitle')}</p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
          <div className="rounded-[22px] bg-[linear-gradient(135deg,#fff4ea_0%,#ffffff_70%)] px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff8b26] text-white">
                <UserRound className="h-6 w-6" strokeWidth={2.1} />
              </div>
              <div>
                <p className="text-[18px] font-semibold text-slate-900">{user?.username ?? 'Learner'}</p>
                <p className="text-[13px] text-slate-500">{user?.email ?? demoEmail}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-[16px] bg-white px-3 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">XP</p>
                <p className="mt-1 text-[18px] font-semibold text-slate-900">{xp}</p>
              </div>
              <div className="rounded-[16px] bg-white px-3 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{t(locale, 'stats.streak')}</p>
                <p className="mt-1 text-[18px] font-semibold text-slate-900">{streak}</p>
              </div>
              <div className="rounded-[16px] bg-white px-3 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{t(locale, 'profile.deck')}</p>
                <p className="mt-1 text-[18px] font-semibold text-slate-900">{vocabulary.length}</p>
              </div>
              <div className="rounded-[16px] bg-white px-3 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{t(locale, 'profile.completedLessons')}</p>
                <p className="mt-1 text-[18px] font-semibold text-slate-900">{completedLessonsCount}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsLanguageModalOpen(true)}
              className="mt-5 flex w-full items-center justify-between rounded-[18px] bg-white px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
            >
              <span>
                <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t(locale, 'profile.language')}
                </span>
                <span className="mt-2 block text-[14px] font-semibold text-slate-900">{t(locale, 'profile.languageHelp')}</span>
              </span>
              <span className="rounded-full bg-[#fff4ea] px-3 py-2 text-[13px] font-semibold text-[#ff8b26]">
                {localeMeta.flag} {localeMeta.label}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'stats.reviewed')}</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight text-slate-900">{reviews.length}</p>
            </div>
            <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t(locale, 'stats.lessonAttempts')}</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight text-slate-900">{totalLessonAttempts}</p>
            </div>
            <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Locale</p>
              <p className="mt-2 text-[20px] font-semibold tracking-tight text-slate-900">
                {localeMeta.flag} {localeMeta.label}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const content = {
    home: renderHome(),
    lessons: renderLessons(),
    practice: renderPractice(),
    culture: renderCulture(),
    leaderboard: renderLeaderboard(),
    stats: renderStats(),
    shop: renderShop(),
    profile: renderProfile(),
  }[activeTab];

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? t(locale, 'tabs.home');

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff1e4_0%,rgba(255,241,228,0.7)_18%,transparent_38%),radial-gradient(circle_at_top_right,#dbeafe_0%,rgba(219,234,254,0.7)_16%,transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-3 py-4 sm:px-5 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1440px] gap-4 lg:gap-6">
        <aside className="hidden w-[290px] shrink-0 lg:flex lg:flex-col">
          <div className="sticky top-8 flex min-h-[calc(100vh-4rem)] flex-col rounded-[32px] border border-white/70 bg-white/88 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Azdili</p>
              <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">Language practice that scales beyond mobile.</h1>
            </div>

            <div className="mt-6 rounded-[24px] bg-[linear-gradient(135deg,#fff3e8_0%,#ffffff_100%)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">{user?.username ?? 'Learner'}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{user?.email ?? demoEmail}</p>
                </div>
                <div className="rounded-full bg-[#ff8b26] px-3 py-2 text-[12px] font-semibold text-white">
                  {streak} day
                </div>
              </div>
            </div>

            <nav className="mt-6 space-y-2">
              {tabs.map((tab) => (
                <SidebarTab key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
              ))}
            </nav>

            <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
              <div className="rounded-[20px] bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">XP</p>
                <p className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">{xp}</p>
              </div>
              <div className="rounded-[20px] bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Deck</p>
                <p className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">{vocabulary.length}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-[28px] border-b border-slate-200/80 bg-white/88 px-4 py-4 backdrop-blur sm:px-6 lg:px-7">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{activeTabLabel}</p>
                <p className="mt-1 text-[14px] text-slate-500">{localeMeta.flag} {localeMeta.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLanguageModalOpen(true)}
                className="rounded-full bg-[#fff4ea] px-3 py-2 text-[12px] font-semibold text-[#ff8b26]"
              >
                {t(locale, 'profile.language')}
              </button>
            </header>

            <div className="px-4 pb-24 pt-5 sm:px-6 lg:px-7 lg:pb-8 lg:pt-6">
              {status.error ? (
                <div className="mb-5 rounded-[16px] bg-[#fff1f2] px-4 py-3 text-[13px] text-rose-700">
                  {status.error}
                </div>
              ) : null}

              <div className="min-h-[calc(100vh-15rem)]">
                {status.loading ? (
                  <div className="rounded-[18px] bg-white px-4 py-5 text-[13px] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    {t(locale, 'common.loading')}
                  </div>
                ) : (
                  content
                )}
              </div>
            </div>
          </div>

          <nav className="fixed inset-x-3 bottom-3 z-20 rounded-[22px] border border-[#ebeef3] bg-white/95 px-2 py-1 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur sm:inset-x-5 lg:hidden">
            <div className="flex items-end justify-between gap-1">
              {tabs.map((tab) => (
                <BottomTab key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
              ))}
            </div>
          </nav>
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-[1440px] rounded-[28px] border border-white/70 bg-white/85 px-5 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-6 lg:px-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Support and legal</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Need help or a privacy answer? Contact us at{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>
              {' '}or use the tracked support form.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/support"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <LifeBuoy className="h-4 w-4" />
              Contact support
            </a>
            {isAdminRole(user?.role) ? (
              <a
                href="/admin"
                className="inline-flex items-center gap-2 rounded-full border border-[#ffd7b0] bg-[#fff4ea] px-4 py-2 text-sm font-semibold text-[#c45a00] transition hover:border-[#ffbf86] hover:text-[#9f4700]"
              >
                <Crown className="h-4 w-4" />
                Open admin panel
              </a>
            ) : null}
            <a
              href="/privacy-policy"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              <ShieldCheck className="h-4 w-4" />
              Privacy Policy
            </a>
          </div>
        </div>
      </div>

      <LanguageModal
        isOpen={isLanguageModalOpen}
        locale={locale}
        onClose={() => setIsLanguageModalOpen(false)}
        onSelect={async (nextLocale) => {
          const resolvedLocale = resolveLocale(nextLocale);
          setLocale(resolvedLocale);
          setIsLanguageModalOpen(false);

          try {
            await patchUser({ locale: resolvedLocale });
          } catch (error) {
            setStatus((current) => ({
              ...current,
              error: error instanceof Error ? error.message : 'Failed to save language preference.',
            }));
          }
        }}
      />
    </main>
  );
}
