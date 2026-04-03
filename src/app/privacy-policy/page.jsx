import { ArrowLeft, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { SUPPORT_EMAIL } from '@/app/lib/support';

const sections = [
  {
    title: 'Information we collect',
    body:
      'We collect the account details you provide, learning activity such as lesson progress and review history, language preferences, and support messages you send through the product.',
  },
  {
    title: 'How we use information',
    body:
      'We use your information to operate the learning experience, save progress, personalize language settings, respond to support tickets, improve lesson quality, and maintain product security.',
  },
  {
    title: 'Support tickets',
    body:
      'When you submit a support request, we store your name, email address, message content, ticket category, ticket status, and basic request metadata needed to investigate and answer the request.',
  },
  {
    title: 'Sharing and processing',
    body:
      'We do not sell personal information. We may use infrastructure and support providers to host the service, store support tickets, and secure the application, but only as needed to operate the product.',
  },
  {
    title: 'Retention',
    body:
      'We keep learning records and support tickets for as long as they are needed to provide the service, comply with legal obligations, resolve disputes, and enforce our agreements.',
  },
  {
    title: 'Your choices',
    body:
      'You may request access, correction, export, or deletion of your personal information by contacting support. We may ask for reasonable verification before completing a request.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#fde68a_0%,rgba(253,230,138,0.28)_18%,transparent_38%),linear-gradient(180deg,#fffaf5_0%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </a>

        <section className="mt-6 rounded-[34px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Privacy Policy
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] text-slate-600">Updated April 1, 2026</span>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Clear rules for how Azdili handles learner and support data.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
                This policy explains what information we collect through the web app, how we use it, and how
                you can contact us about your privacy choices.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <LockKeyhole className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-900">Privacy contact</p>
              </div>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-4 inline-flex items-center gap-2 text-base font-semibold text-slate-950 underline decoration-emerald-300 underline-offset-4"
              >
                <Mail className="h-4 w-4" />
                {SUPPORT_EMAIL}
              </a>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                For privacy or data rights requests, email us directly or use the tracked request form on the
                support page.
              </p>
              <a
                href="/support"
                className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open support form
              </a>
            </div>
          </div>

          <div className="mt-10 grid gap-4">
            {sections.map((section) => (
              <article key={section.title} className="rounded-[26px] border border-slate-200/80 bg-white px-5 py-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-[28px] border border-[#ffe2bf] bg-[linear-gradient(180deg,#fff9f3_0%,#fff3e8_100%)] px-5 py-5">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Questions about this policy?</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Contact <a className="font-semibold text-slate-900 underline decoration-[#ff8b26]/40 underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and include enough detail for us to verify and respond to your request.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}