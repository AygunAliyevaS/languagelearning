import { Link, useLoaderData } from 'react-router';
import { fetchApiJson, fetchDemoUser } from '../lib/api-loader';

export const meta = () => {
  return [
    { title: 'Progress' },
    { name: 'description', content: 'Track learner profile, entitlements, and upgrade recommendations.' },
  ];
};

export async function loader({ request }) {
  const userResult = await fetchDemoUser(request);
  const plansResult = await fetchApiJson(request, '/api/pricing?action=plans&region=US', { plans: [] });

  const [subscriptionResult, recommendationsResult] = userResult.data?.id
    ? await Promise.all([
        fetchApiJson(request, `/api/subscriptions?action=current&userId=${userResult.data.id}`, null),
        fetchApiJson(request, `/api/pricing?action=upgrade-recommendations&userId=${userResult.data.id}`, []),
      ])
    : [
        { data: null, error: userResult.error, status: userResult.status },
        { data: [], error: userResult.error, status: userResult.status },
      ];

  return {
    learner: userResult.data,
    learnerError: userResult.error,
    subscription: subscriptionResult.data,
    subscriptionError: subscriptionResult.error,
    recommendations: Array.isArray(recommendationsResult.data) ? recommendationsResult.data : [],
    recommendationsError: recommendationsResult.error,
    plans: plansResult.data?.plans || [],
  };
}

export default function ProgressPage() {
  const loaderData = useLoaderData() ?? {
    learner: null,
    learnerError: 'Live loader data is temporarily unavailable in this render path.',
    subscription: null,
    subscriptionError: null,
    recommendations: [],
    recommendationsError: null,
    plans: [],
  };
  const {
    learner,
    learnerError,
    subscription,
    subscriptionError,
    recommendations,
    recommendationsError,
    plans,
  } = loaderData;

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Progress</p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Learner profile and access</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            This route reads from `/api/user`, `/api/subscriptions`, and pricing recommendation endpoints.
          </p>
        </div>

        {learnerError || subscriptionError || recommendationsError ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h2 className="text-xl font-semibold">Progress data is partially unavailable</h2>
            <p className="mt-2 text-sm leading-6">{learnerError || subscriptionError || recommendationsError}</p>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="CEFR level" value={learner?.cefr_level || 'n/a'} />
          <MetricCard label="XP" value={learner?.xp ?? 'n/a'} />
          <MetricCard label="Streak" value={learner?.streak ?? 'n/a'} />
          <MetricCard label="Plan" value={subscription?.subscription?.planName || subscription?.planId || 'Free'} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Current entitlements</h2>
            <div className="mt-4 grid gap-3">
              <EntitlementRow label="Access level" value={subscription?.accessLevel || 'free'} />
              <EntitlementRow label="Offline mode" value={subscription?.features?.offlineMode ? 'Enabled' : 'Locked'} />
              <EntitlementRow label="AI personalization" value={subscription?.features?.aiPersonalization ? 'Enabled' : 'Locked'} />
              <EntitlementRow label="Speech recognition" value={subscription?.features?.speechRecognition ? 'Enabled' : 'Locked'} />
              <EntitlementRow label="Storage" value={subscription?.limits?.storageMB ? `${subscription.limits.storageMB} MB` : 'n/a'} />
              <EntitlementRow label="AI credits" value={subscription?.limits?.aiCredits ?? 0} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-slate-950">Upgrade recommendations</h2>
              <Link to="/practice" className="text-sm font-semibold text-slate-700">Practice queue</Link>
            </div>
            <div className="mt-4 space-y-4">
              {recommendations.length > 0 ? (
                recommendations.map((recommendation, index) => (
                  <article key={`${recommendation.targetPlan}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-semibold text-slate-950">Upgrade to {recommendation.targetPlan}</h3>
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                        {recommendation.urgency}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{recommendation.reason}</p>
                  </article>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-600">
                  No live recommendation records were returned. That usually means the learner profile is missing or there is not enough usage data yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-950">Available plans</h2>
            <Link to="/lessons" className="text-sm font-semibold text-slate-700">Open lessons</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <article key={plan.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{plan.id}</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">{plan.name}</h3>
                <p className="mt-3 text-3xl font-semibold text-slate-950">${plan.currentPrice}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {Array.isArray(plan.features.lessons) ? `${plan.features.lessons.join('-')} curriculum access` : 'Live plan metadata from pricing API.'}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
    </article>
  );
}

function EntitlementRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}