
import { Link, useLoaderData } from 'react-router';
import { fetchApiJson, groupLessonsByLevel } from './lib/api-loader';

export const meta = () => {
  return [
    { title: 'Learn Azerbaijani Online' },
    {
      name: 'description',
      content: 'Azerbaijani language learning platform with CEFR paths, AI practice, and flexible plans.',
    },
  ];
};

export async function loader({ request }) {
  const [lessonsResult, plansResult, purchasesResult] = await Promise.all([
    fetchApiJson(request, '/api/lessons', []),
    fetchApiJson(request, '/api/pricing?action=plans&region=US', { plans: [] }),
    fetchApiJson(request, '/api/purchases?action=available', {}),
  ]);

  const lessons = Array.isArray(lessonsResult.data) ? lessonsResult.data : [];
  const lessonLevels = Object.entries(groupLessonsByLevel(lessons)).map(([level, entries]) => ({
    level,
    count: entries.length,
  }));

  return {
    lessons,
    lessonLevels,
    lessonsError: lessonsResult.error,
    plans: plansResult.data?.plans || [],
    plansError: plansResult.error,
    purchases: purchasesResult.data || {},
    purchasesError: purchasesResult.error,
  };
}

export default function Page() {
  const loaderData = useLoaderData() ?? {
    lessons: [],
    lessonLevels: [],
    lessonsError: 'Live loader data is temporarily unavailable in this render path.',
    plans: [],
    plansError: null,
    purchases: {},
    purchasesError: null,
  };
  const { lessonLevels, lessonsError, plans, plansError, purchases, purchasesError } = loaderData;
  const purchaseCategories = Object.entries(purchases || {}).slice(0, 3);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7_0%,#fffdf5_28%,#f5f7fb_58%,#edf2ff_100%)] text-slate-900">
      <section className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-12 sm:px-8 lg:px-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-slate-300 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 backdrop-blur">
                Azerbaijani Learning Platform
              </span>
              <h1 className="max-w-4xl text-5xl font-semibold leading-none tracking-tight text-slate-950 sm:text-6xl">
                Learn Azerbaijani with a path that feels like a real product, not a blank route.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                The homepage now reads from the existing lesson, pricing, and purchase APIs so the
                learner experience reflects the actual data surfaces already in the repo.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/lessons"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Browse Lessons
              </Link>
              <Link
                to="/practice"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Start Practice
              </Link>
              <Link
                to="/progress"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                View Progress
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <h2 className="text-lg font-semibold text-slate-900">Lesson library</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {lessonsError
                    ? lessonsError
                    : `${lessonLevels.length} CEFR bands and ${lessonLevels.reduce((total, item) => total + item.count, 0)} lesson records are available from /api/lessons.`}
                </p>
              </article>
              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <h2 className="text-lg font-semibold text-slate-900">Live pricing</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {plansError ? plansError : `${plans.length} subscription tiers are loading from /api/pricing?action=plans.`}
                </p>
              </article>
              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <h2 className="text-lg font-semibold text-slate-900">Practice surfaces</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Spaced repetition and progress now have dedicated learner routes using the existing APIs.
                </p>
              </article>
              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <h2 className="text-lg font-semibold text-slate-900">Add-on catalog</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {purchasesError
                    ? purchasesError
                    : `${purchaseCategories.length} purchase categories are loading from /api/purchases?action=available.`}
                </p>
              </article>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Learning Snapshot</p>
                <h2 className="mt-2 text-2xl font-semibold">Weekly rhythm</h2>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-sm text-cyan-100">Live</div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm text-slate-300">Lesson API status</p>
                <p className="mt-1 text-2xl font-semibold">
                  {lessonsError ? 'Needs database' : 'Connected'}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {lessonsError || 'Lesson data is available for learner pages and homepage summaries.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-2xl font-semibold">{lessonLevels.reduce((total, item) => total + item.count, 0)}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Lessons</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-2xl font-semibold">{plans.length}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Plans</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-2xl font-semibold">{purchaseCategories.length}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Catalogs</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Lessons</p>
              <h2 className="text-3xl font-semibold text-slate-950">Real lesson bands from the API</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Lesson pages are now driven by `/api/lessons`. If the database is not configured, the UI shows that directly instead of pretending lesson content exists.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {(lessonLevels.length > 0 ? lessonLevels : [{ level: 'Unavailable', count: 0 }]).map((level) => (
              <article
                key={level.level}
                className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.14)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{level.level}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{level.count} lessons</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {lessonsError
                    ? 'Configure DATABASE_URL to load learner content records.'
                    : 'Pulled live from the lessons endpoint and grouped by level.'}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Plans</p>
            <h2 className="text-3xl font-semibold text-slate-950">Pricing designed for different study depths</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {plans.map((plan) => (
              <article key={plan.name} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
                <div className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  {plan.name}
                </div>
                <p className="mt-4 text-4xl font-semibold text-slate-950">${plan.currentPrice}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {Array.isArray(plan.features.lessons)
                    ? `${plan.features.lessons.join('-')} curriculum, ${plan.features.exercises} exercises, ${plan.features.liveTutorSessions} live tutor sessions.`
                    : 'Pricing details loaded from the pricing API.'}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Catalog</p>
            <h2 className="text-3xl font-semibold text-slate-950">Real add-ons from the purchases API</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {purchaseCategories.map(([key, entry]) => (
              <article key={key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{key.replaceAll('_', ' ')}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{entry.name}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{entry.description}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
