import { Link, useLoaderData } from 'react-router';
import { useI18n, useLocalizedDocument } from '@/lib/language-context';
import { DEFAULT_LANGUAGE, getTranslation } from '@/lib/languages';
import {
  fetchApiJson,
  getLessonDescription,
  getLessonTitle,
  groupLessonsByLevel,
} from '../lib/api-loader';

export const meta = () => {
  return [
    { title: getTranslation(DEFAULT_LANGUAGE, 'lessonsPage.metaTitle') },
    { name: 'description', content: getTranslation(DEFAULT_LANGUAGE, 'lessonsPage.metaDescription') },
  ];
};

export async function loader({ request }) {
  const [lessonsResult, plansResult] = await Promise.all([
    fetchApiJson(request, '/api/lessons', []),
    fetchApiJson(request, '/api/pricing?action=plans&region=US', { plans: [] }),
  ]);

  return {
    lessons: Array.isArray(lessonsResult.data) ? lessonsResult.data : [],
    lessonsError: lessonsResult.error,
    plans: plansResult.data?.plans || [],
  };
}

export default function LessonsPage() {
  const { t } = useI18n();
  const loaderData = useLoaderData() ?? {
    lessons: [],
    lessonsError: t('common.loaderUnavailable'),
    plans: [],
  };
  const { lessons, lessonsError, plans } = loaderData;
  const lessonsByLevel = groupLessonsByLevel(lessons);

  useLocalizedDocument(t('lessonsPage.metaTitle'), t('lessonsPage.metaDescription'));

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t('lessonsPage.eyebrow')}</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{t('lessonsPage.title')}</h1>
            <p className="max-w-3xl text-base leading-7 text-slate-600">
              {t('lessonsPage.subtitle')}
            </p>
          </div>

          {lessonsError ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
              <h2 className="text-xl font-semibold">{t('lessonsPage.dataUnavailable')}</h2>
              <p className="mt-2 text-sm leading-6">{lessonsError}</p>
            </section>
          ) : null}

          {Object.keys(lessonsByLevel).length > 0 ? (
            Object.entries(lessonsByLevel).map(([level, items]) => (
              <section key={level} className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{level}</p>
                    <h2 className="text-2xl font-semibold text-slate-950">{t('home.lessonCount', { count: items.length })}</h2>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((lesson) => (
                    <article key={lesson.id || `${level}-${lesson.order_index || getLessonTitle(lesson)}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-slate-950">{getLessonTitle(lesson)}</h3>
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                          #{lesson.order_index || lesson.id || 'n/a'}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{getLessonDescription(lesson)}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">{t('lessonsPage.levelLabel', { level: lesson.level_code || level })}</span>
                        {lesson.duration_minutes ? <span className="rounded-full bg-slate-100 px-3 py-1">{t('lessonsPage.minutesLabel', { minutes: lesson.duration_minutes })}</span> : null}
                        {lesson.slug ? <span className="rounded-full bg-slate-100 px-3 py-1">{lesson.slug}</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-950">{t('lessonsPage.noLessonRecords')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {t('lessonsPage.noLessonRecordsDescription')}
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t('lessonsPage.navigation')}</p>
            <div className="mt-4 flex flex-col gap-3 text-sm font-semibold">
              <Link to="/" className="rounded-2xl bg-slate-950 px-4 py-3 text-white">{t('common.home')}</Link>
              <Link to="/practice" className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-700">{t('lessonsPage.practiceQueue')}</Link>
              <Link to="/progress" className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-700">{t('lessonsPage.progressOverview')}</Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t('lessonsPage.accessTiers')}</p>
            <div className="mt-4 space-y-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-950">{plan.name}</h3>
                    <span className="text-sm text-slate-600">${plan.currentPrice}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{Array.isArray(plan.features.lessons) ? t('lessonsPage.curriculumAccess', { range: plan.features.lessons.join('-') }) : t('lessonsPage.curriculumVaries')}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}