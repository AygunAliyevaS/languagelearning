import { Form, Link, useActionData, useLoaderData, useNavigation } from 'react-router';
import { DEMO_LEARNER_EMAIL, fetchApiJson, fetchDemoUser } from '../lib/api-loader';

export const meta = () => {
  return [
    { title: 'Practice' },
    { name: 'description', content: 'Review spaced repetition items and practice with live learner APIs.' },
  ];
};

export async function loader({ request }) {
  const [userResult, purchasesResult] = await Promise.all([
    fetchDemoUser(request),
    fetchApiJson(request, '/api/purchases?action=available', {}),
  ]);

  const reviewResult = userResult.data?.id
    ? await fetchApiJson(request, `/api/spaced-repetition?userId=${userResult.data.id}`, [])
    : { data: [], error: userResult.error, status: userResult.status };

  return {
    learner: userResult.data,
    learnerError: userResult.error,
    reviewItems: Array.isArray(reviewResult.data) ? reviewResult.data : [],
    reviewError: reviewResult.error,
    aiCredits: purchasesResult.data?.ai_credits?.items || {},
    demoEmail: DEMO_LEARNER_EMAIL,
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  const userId = formData.get('userId');
  const wordId = formData.get('wordId');
  const quality = Number(formData.get('quality'));

  const response = await fetch(new URL('/api/spaced-repetition', request.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, wordId, quality }),
  });

  const payload = await response.json();
  if (!response.ok) {
    return { error: payload?.error || 'Failed to update review item.' };
  }

  return { success: true, payload };
}

export default function PracticePage() {
  const loaderData = useLoaderData() ?? {
    learner: null,
    learnerError: 'Live loader data is temporarily unavailable in this render path.',
    reviewItems: [],
    reviewError: null,
    aiCredits: {},
    demoEmail: DEMO_LEARNER_EMAIL,
  };
  const { learner, learnerError, reviewItems, reviewError, aiCredits, demoEmail } = loaderData;
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Practice</p>
          <h1 className="text-4xl font-semibold tracking-tight">Spaced repetition queue</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-300">
            This page uses `/api/user` and `/api/spaced-repetition` with a demo learner record at {demoEmail}.
          </p>
        </div>

        {actionData?.error ? (
          <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {actionData.error}
          </div>
        ) : null}

        {learnerError || reviewError ? (
          <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-6 text-amber-50">
            <h2 className="text-xl font-semibold">Practice data is unavailable</h2>
            <p className="mt-2 text-sm leading-6">{reviewError || learnerError}</p>
          </div>
        ) : null}

        {learner ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Learner</p>
              <p className="mt-2 text-2xl font-semibold">{learner.username || learner.email}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Due now</p>
              <p className="mt-2 text-2xl font-semibold">{reviewItems.length}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
              <p className="mt-2 text-2xl font-semibold">{reviewItems.length > 0 ? 'Ready' : 'Cleared'}</p>
            </div>
          </div>
        ) : null}

        {reviewItems.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {reviewItems.map((item) => (
              <article key={`${item.user_id}-${item.word_id}`} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Review due</p>
                  <h2 className="text-3xl font-semibold text-white">{item.word || `Word ${item.word_id}`}</h2>
                  <p className="text-lg text-slate-300">{item.translation || 'Translation unavailable'}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-white/10 px-3 py-1">Interval {item.interval || 0}d</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">Repetitions {item.repetition_count || 0}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">Ease {(item.ease_factor || 0).toFixed?.(2) || item.ease_factor}</span>
                  </div>
                </div>

                <Form method="post" className="mt-6 flex flex-wrap gap-3">
                  <input type="hidden" name="userId" value={item.user_id} />
                  <input type="hidden" name="wordId" value={item.word_id} />
                  <button type="submit" name="quality" value="2" disabled={isSubmitting} className="rounded-full border border-rose-400/50 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/10">
                    Again
                  </button>
                  <button type="submit" name="quality" value="3" disabled={isSubmitting} className="rounded-full border border-amber-400/50 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/10">
                    Hard
                  </button>
                  <button type="submit" name="quality" value="4" disabled={isSubmitting} className="rounded-full border border-cyan-400/50 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/10">
                    Good
                  </button>
                  <button type="submit" name="quality" value="5" disabled={isSubmitting} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                    Easy
                  </button>
                </Form>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold">No practice items due</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              The live spaced repetition endpoint did not return any due items. That can mean the queue is empty, or the learner dataset is not available yet.
            </p>
          </div>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">AI tutor credit packs</h2>
            <Link to="/progress" className="text-sm font-semibold text-cyan-200">Go to progress</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(aiCredits).map(([key, item]) => (
              <article key={key} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pack {key}</p>
                <h3 className="mt-2 text-xl font-semibold">{item.name}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p>
                <p className="mt-4 text-2xl font-semibold text-cyan-200">${item.price}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}