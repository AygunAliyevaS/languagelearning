import {
  ArrowLeft,
  Clock3,
  LifeBuoy,
  Mail,
  SendHorizonal,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_EMAIL,
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_RESPONSE_HOURS,
  SUPPORT_SUBJECT_MAX_LENGTH,
  normalizeSupportTicketReference,
} from '@/app/lib/support';

const initialForm = {
  name: '',
  email: '',
  category: SUPPORT_CATEGORIES[0].id,
  subject: '',
  message: '',
};

function formatDateTime(value) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function SupportPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [requestState, setRequestState] = useState({
    submitting: false,
    error: null,
    ticket: null,
  });
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupTicketNumber, setLookupTicketNumber] = useState('');
  const [lookupState, setLookupState] = useState({
    loading: false,
    error: null,
    tickets: [],
    mode: null,
  });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: null }));
  }

  async function loadTicketsByEmail(email) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();

    if (!normalizedEmail) {
      setLookupState({
        loading: false,
        error: 'Enter the same email you used when creating the ticket.',
        tickets: [],
        mode: 'email',
      });
      return;
    }

    setLookupState((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await fetch(`/api/support-tickets?email=${encodeURIComponent(normalizedEmail)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'We could not load your support tickets.');
      }

      setLookupState({
        loading: false,
        error: null,
        tickets: payload.tickets ?? [],
        mode: 'email',
      });
    } catch (error) {
      setLookupState({
        loading: false,
        error: error instanceof Error ? error.message : 'We could not load your support tickets.',
        tickets: [],
        mode: 'email',
      });
    }
  }

  async function loadTicketByNumber(ticketNumber) {
    const normalizedTicketNumber = normalizeSupportTicketReference(ticketNumber);

    if (!normalizedTicketNumber) {
      setLookupState({
        loading: false,
        error: 'Enter the ticket number you received after creating the request.',
        tickets: [],
        mode: 'ticket',
      });
      return;
    }

    setLookupState((current) => ({ ...current, loading: true, error: null, mode: 'ticket' }));

    try {
      const response = await fetch(`/api/support-tickets?ticketNumber=${encodeURIComponent(normalizedTicketNumber)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'We could not load that support ticket.');
      }

      setLookupTicketNumber(normalizedTicketNumber);
      setLookupState({
        loading: false,
        error: null,
        tickets: payload.tickets ?? [],
        mode: 'ticket',
      });
    } catch (error) {
      setLookupState({
        loading: false,
        error: error instanceof Error ? error.message : 'We could not load that support ticket.',
        tickets: [],
        mode: 'ticket',
      });
    }
  }

  async function handleLookupSubmit(event) {
    event.preventDefault();
    await loadTicketsByEmail(lookupEmail);
  }

  async function handleTicketLookupSubmit(event) {
    event.preventDefault();
    await loadTicketByNumber(lookupTicketNumber);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setRequestState((current) => ({ ...current, submitting: true, error: null }));

    try {
      const response = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sourcePath: '/support' }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setErrors(payload.errors ?? {});
        throw new Error(payload.error ?? 'We could not create your support ticket.');
      }

      setRequestState({
        submitting: false,
        error: null,
        ticket: payload.ticket,
      });
      setErrors({});
      setLookupEmail(form.email);
      await loadTicketsByEmail(form.email);
      setForm((current) => ({
        ...current,
        category: SUPPORT_CATEGORIES[0].id,
        subject: '',
        message: '',
      }));
    } catch (error) {
      setRequestState((current) => ({
        ...current,
        submitting: false,
        error: error instanceof Error ? error.message : 'We could not create your support ticket.',
      }));
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_0%,rgba(224,242,254,0.65)_20%,transparent_46%),linear-gradient(180deg,#f8fafc_0%,#fff7ed_100%)] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </a>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[32px] border border-white/80 bg-white/88 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#fff4ea] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff8b26]">
                Support
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] text-slate-600">
                Ticket-based help desk
              </span>
            </div>

            <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Reach support and get a tracked ticket number.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Use the form to send product questions, report a bug, or submit a privacy request. Every
              submission creates a support ticket so follow-up is easier for both sides.
            </p>

            {requestState.ticket ? (
              <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-5 text-emerald-900">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Ticket created
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{requestState.ticket.ticket_number}</p>
                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  We received your request with status <span className="font-semibold">{requestState.ticket.status}</span>.
                  Replies will be sent to <span className="font-semibold">{requestState.ticket.requester_email}</span>.
                </p>
              </div>
            ) : null}

            {requestState.error ? (
              <div className="mt-6 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {requestState.error}
              </div>
            ) : null}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Name</span>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-[#ff8b26] focus:bg-white"
                    placeholder="Your name"
                    autoComplete="name"
                  />
                  {errors.name ? <p className="mt-2 text-sm text-rose-600">{errors.name}</p> : null}
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={updateField}
                    className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-[#ff8b26] focus:bg-white"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {errors.email ? <p className="mt-2 text-sm text-rose-600">{errors.email}</p> : null}
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Support topic</span>
                <select
                  name="category"
                  value={form.category}
                  onChange={updateField}
                  className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-[#ff8b26] focus:bg-white"
                >
                  {SUPPORT_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
                {errors.category ? <p className="mt-2 text-sm text-rose-600">{errors.category}</p> : null}
              </label>

              <label className="block">
                <span className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                  Subject
                  <span className="text-xs text-slate-400">{form.subject.length}/{SUPPORT_SUBJECT_MAX_LENGTH}</span>
                </span>
                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={updateField}
                  maxLength={SUPPORT_SUBJECT_MAX_LENGTH}
                  className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-[#ff8b26] focus:bg-white"
                  placeholder="Short summary of the issue"
                />
                {errors.subject ? <p className="mt-2 text-sm text-rose-600">{errors.subject}</p> : null}
              </label>

              <label className="block">
                <span className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                  Message
                  <span className="text-xs text-slate-400">{form.message.length}/{SUPPORT_MESSAGE_MAX_LENGTH}</span>
                </span>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={updateField}
                  maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
                  rows={7}
                  className="mt-2 w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-[#ff8b26] focus:bg-white"
                  placeholder="Tell us what happened, what you expected, and any steps needed to reproduce it."
                />
                {errors.message ? <p className="mt-2 text-sm text-rose-600">{errors.message}</p> : null}
              </label>

              <div className="flex flex-col gap-3 rounded-[22px] bg-slate-50 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Submitting a ticket means we will store the message and contact details needed to answer it.
                  Full details are in our <a className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4" href="/privacy-policy">Privacy Policy</a>.
                </p>
                <button
                  type="submit"
                  disabled={requestState.submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SendHorizonal className="h-4 w-4" />
                  {requestState.submitting ? 'Submitting...' : 'Create ticket'}
                </button>
              </div>
            </form>

            <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50/85 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Ticket tracker</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Track one ticket or review recent updates.</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use your ticket number for the fastest lookup, or enter the email address used when opening a support request to review recent tickets.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <form className="rounded-[22px] border border-[#ffe2bf] bg-[linear-gradient(180deg,#fffaf5_0%,#fff3e8_100%)] p-4" onSubmit={handleTicketLookupSubmit}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c96b12]">Lookup by ticket number</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Paste the ticket reference you received after submitting your request.</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={lookupTicketNumber}
                      onChange={(event) => setLookupTicketNumber(event.target.value.toUpperCase())}
                      className="w-full rounded-[18px] border border-[#ffd7b0] bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-[#ff8b26]"
                      placeholder="AZ-1234ABCD"
                      autoCapitalize="characters"
                      autoCorrect="off"
                    />
                    <button
                      type="submit"
                      disabled={lookupState.loading}
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {lookupState.loading && lookupState.mode === 'ticket' ? 'Checking...' : 'Find ticket'}
                    </button>
                  </div>
                </form>

                <form className="rounded-[22px] border border-slate-200 bg-white p-4" onSubmit={handleLookupSubmit}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Lookup by email</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Enter the same email address used when opening a support request to see recent ticket activity.</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="email"
                      value={lookupEmail}
                      onChange={(event) => setLookupEmail(event.target.value)}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-[#ff8b26]"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    <button
                      type="submit"
                      disabled={lookupState.loading}
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {lookupState.loading && lookupState.mode === 'email' ? 'Checking...' : 'Check tickets'}
                    </button>
                  </div>
                </form>
              </div>

              {lookupState.error ? (
                <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {lookupState.error}
                </div>
              ) : null}

              {lookupState.tickets.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {lookupState.tickets.map((ticket) => (
                    <article key={ticket.ticket_number} className="rounded-[22px] border border-white bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{ticket.ticket_number}</p>
                          <h3 className="mt-2 text-base font-semibold text-slate-950">{ticket.subject}</h3>
                          <p className="mt-1 text-sm text-slate-600">Category: {ticket.category}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                          {ticket.status}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[16px] bg-slate-50 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Created</p>
                          <p className="mt-2 text-sm text-slate-700">{formatDateTime(ticket.created_at)}</p>
                        </div>
                        <div className="rounded-[16px] bg-slate-50 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">First response</p>
                          <p className="mt-2 text-sm text-slate-700">{formatDateTime(ticket.first_response_at)}</p>
                        </div>
                        <div className="rounded-[16px] bg-slate-50 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Resolved</p>
                          <p className="mt-2 text-sm text-slate-700">{ticket.resolved_at ? formatDateTime(ticket.resolved_at) : 'Still open'}</p>
                        </div>
                      </div>

                      {ticket.customer_reply ? (
                        <div className="mt-4 rounded-[18px] border border-[#ffe2bf] bg-[linear-gradient(180deg,#fff9f3_0%,#fff1e7_100%)] px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c96b12]">Latest team reply</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.customer_reply}</p>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-slate-500">No public reply has been posted to this ticket yet.</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : lookupState.mode && !lookupState.loading && !lookupState.error ? (
                <div className="mt-5 rounded-[18px] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                  {lookupState.mode === 'ticket'
                    ? 'No ticket matched that reference.'
                    : 'No recent tickets were found for that email address.'}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[30px] border border-[#ffe2bf] bg-[linear-gradient(180deg,#fff9f3_0%,#fff1e7_100%)] p-6 shadow-[0_18px_60px_rgba(249,115,22,0.10)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#ff8b26] shadow-sm">
                <LifeBuoy className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">Direct support contact</h2>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-4 inline-flex items-center gap-2 text-base font-semibold text-slate-950 underline decoration-[#ff8b26]/40 underline-offset-4"
              >
                <Mail className="h-4 w-4" />
                {SUPPORT_EMAIL}
              </a>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Use the address above for direct email support, or submit the form to create a ticket we can track.
              </p>
            </div>

            <div className="rounded-[30px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-[#ff8b26]" />
                <p className="text-sm font-semibold text-slate-900">Response target</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                We aim to respond to new tickets within {SUPPORT_RESPONSE_HOURS} hours on business days.
              </p>
            </div>

            <div className="rounded-[30px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-900">What to include</p>
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>Share the device, browser, and page where the issue happened.</li>
                <li>Explain what you expected to happen and what actually happened.</li>
                <li>Avoid sending passwords or payment card details through the form.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}