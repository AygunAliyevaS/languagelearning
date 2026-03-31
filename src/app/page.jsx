
import { Link, useLoaderData } from 'react-router';
import PricingEngine from '@/lib/pricingEngine';
import { getAvailablePurchasesCatalog } from '@/lib/purchaseCatalog';
import { useI18n, useLocalizedDocument } from '@/lib/language-context';
import { DEFAULT_LANGUAGE, getTranslation } from '@/lib/languages';
import { fetchApiJson, groupLessonsByLevel } from './lib/api-loader';

const pricingEngine = new PricingEngine();

export const meta = () => {
  return [
    { title: getTranslation(DEFAULT_LANGUAGE, 'home.metaTitle') },
    {
      name: 'description',
      content: getTranslation(DEFAULT_LANGUAGE, 'home.metaDescription'),
    },
  ];
};

export async function loader({ request }) {
  const [lessonsResult] = await Promise.all([
    fetchApiJson(request, '/api/lessons', []),
  ]);
  const plans = ['freemium', 'basic', 'pro', 'premium'].map((planId) =>
    pricingEngine.getPricing(planId, 'US', false)
  );
  const purchases = getAvailablePurchasesCatalog();

  const lessons = Array.isArray(lessonsResult.data) ? lessonsResult.data : [];
  const lessonLevels = Object.entries(groupLessonsByLevel(lessons)).map(([level, entries]) => ({
    level,
    count: entries.length,
  }));

  return {
    lessons,
    lessonLevels,
    lessonsError: lessonsResult.error,
    plans,
    plansError: null,
    purchases,
    purchasesError: null,
  };
}

export default function Page() {
  const { t } = useI18n();
  const loaderData = useLoaderData() ?? {
    lessons: [],
    lessonLevels: [],
    lessonsError: t('common.loaderUnavailable'),
    plans: [],
    plansError: null,
    purchases: {},
    purchasesError: null,
  };
  const { lessonLevels, lessonsError, plans, plansError, purchases, purchasesError } = loaderData;
  const purchaseCategories = Object.entries(purchases || {}).slice(0, 3);
  const lessonTotal = lessonLevels.reduce((total, item) => total + item.count, 0);

  useLocalizedDocument(t('home.metaTitle'), t('home.metaDescription'));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7_0%,#fffdf5_28%,#f5f7fb_58%,#edf2ff_100%)] text-slate-900">
      <section className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-12 sm:px-8 lg:px-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-slate-300 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 backdrop-blur">
                {t('home.badge')}
              </span>
              <h1 className="max-w-4xl text-5xl font-semibold leading-none tracking-tight text-slate-950 sm:text-6xl">
                {t('home.title')}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                {t('home.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/lessons"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {t('home.browseLessons')}
              </Link>
              <Link
                to="/practice"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {t('home.startPractice')}
              </Link>
              <Link
                to="/progress"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {t('home.viewProgress')}
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <h2 className="text-lg font-semibold text-slate-900">{t('home.lessonLibrary')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {lessonsError
                    ? lessonsError
                    : t('home.lessonLibrarySummary', {
                        bandCount: lessonLevels.length,
                        lessonCount: lessonTotal,
                      })}
                </p>
              </article>
              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <h2 className="text-lg font-semibold text-slate-900">{t('home.livePricing')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {plansError ? plansError : t('home.livePricingSummary', { planCount: plans.length })}
                </p>
              </article>
              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <h2 className="text-lg font-semibold text-slate-900">{t('home.practiceSurfaces')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {t('home.practiceSurfacesSummary')}
                </p>
              </article>
              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <h2 className="text-lg font-semibold text-slate-900">{t('home.addOnCatalog')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {purchasesError
                    ? purchasesError
                    : t('home.addOnCatalogSummary', { categoryCount: purchaseCategories.length })}
                </p>
              </article>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">{t('home.learningSnapshot')}</p>
                <h2 className="mt-2 text-2xl font-semibold">{t('home.weeklyRhythm')}</h2>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-sm text-cyan-100">{t('common.live')}</div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm text-slate-300">{t('home.lessonApiStatus')}</p>
                <p className="mt-1 text-2xl font-semibold">
                  {lessonsError ? t('home.needsDatabase') : t('common.connected')}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {lessonsError || t('home.lessonStatusSummary')}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-2xl font-semibold">{lessonTotal}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{t('home.lessonsLabel')}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-2xl font-semibold">{plans.length}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{t('home.plansLabel')}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-2xl font-semibold">{purchaseCategories.length}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{t('home.catalogsLabel')}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{t('common.lessons')}</p>
              <h2 className="text-3xl font-semibold text-slate-950">{t('home.lessonsSectionTitle')}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              {t('home.lessonsSectionDescription')}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {(lessonLevels.length > 0 ? lessonLevels : [{ level: t('home.unavailableLevel'), count: 0 }]).map((level) => (
              <article
                key={level.level}
                className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.14)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{level.level}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{t('home.lessonCount', { count: level.count })}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {lessonsError
                    ? t('home.configureDatabase')
                    : t('home.groupedByLevel')}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{t('home.plansLabel')}</p>
            <h2 className="text-3xl font-semibold text-slate-950">{t('home.plansSectionTitle')}</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {plans.length > 0 ? plans.map((plan) => (
              <article key={plan.name} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
                <div className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  {plan.name}
                </div>
                <p className="mt-4 text-4xl font-semibold text-slate-950">${plan.currentPrice}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {Array.isArray(plan.features.lessons)
                    ? t('home.curriculumSummary', {
                        range: plan.features.lessons.join('-'),
                        exercises: plan.features.exercises,
                        sessions: plan.features.liveTutorSessions,
                      })
                    : t('home.pricingDetailsLoaded')}
                </p>
              </article>
            )) : (
              <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950 lg:col-span-4">
                <h3 className="text-lg font-semibold">{t('home.pricingUnavailableTitle')}</h3>
                <p className="mt-2 text-sm leading-6">{t('home.pricingUnavailableDescription')}</p>
              </article>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{t('home.catalogsLabel')}</p>
            <h2 className="text-3xl font-semibold text-slate-950">{t('home.catalogSectionTitle')}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {purchaseCategories.length > 0 ? purchaseCategories.map(([key, entry]) => (
              <article key={key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{key.replaceAll('_', ' ')}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{entry.name}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{entry.description}</p>
              </article>
            )) : (
              <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950 md:col-span-3">
                <h3 className="text-lg font-semibold">{t('home.catalogUnavailableTitle')}</h3>
                <p className="mt-2 text-sm leading-6">{t('home.catalogUnavailableDescription')}</p>
              </article>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
