import {
  AlertCircle,
  BookCopy,
  ChevronDown,
  ChevronUp,
  Headphones,
  KeyRound,
  LibraryBig,
  LifeBuoy,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ADMIN_STORAGE_KEY,
  LESSON_SECTION_TEMPLATES,
  SUPPORT_STATUS_OPTIONS,
  cloneTemplateSection,
  createCultureCategoryDraft,
  createCultureEntryDraft,
  createLessonDraft,
  createVocabularyDraft,
  normalizeLocalizedValue,
  stringifyEditorJson,
} from '@/app/lib/admin';
import { supportedLocales } from '@/app/lib/i18n.js';
import { DEMO_EMAIL, USER_ROLE_ADMIN, USER_ROLE_LEARNER, isAdminRole } from '@/app/lib/user';
import useUpload from '@/utils/useUpload';

const ADMIN_ACCESS_HEADER = 'x-admin-access-key';
const ADMIN_USER_EMAIL_HEADER = 'x-user-email';
const NEW_RECORD_ID = '__new__';
const USER_ROLE_OPTIONS = [USER_ROLE_LEARNER, USER_ROLE_ADMIN];
const adminTabs = [
  { id: 'lessons', label: 'Lessons', icon: BookCopy },
  { id: 'vocabulary', label: 'Vocabulary', icon: Headphones },
  { id: 'culture', label: 'Culture', icon: LibraryBig },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'monetization', label: 'Monetization', icon: ShoppingBag },
  { id: 'users', label: 'Users', icon: Users },
];

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function readJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function cloneData(value) {
  return structuredClone(value);
}

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

function createManagedUserDraft(user = {}) {
  return {
    id: user.id ?? null,
    username: user.username ?? '',
    email: user.email ?? '',
    role: user.effective_role ?? user.role ?? USER_ROLE_LEARNER,
    effective_role: user.effective_role ?? user.role ?? USER_ROLE_LEARNER,
    is_configured_admin: Boolean(user.is_configured_admin),
    xp: user.xp ?? 0,
    streak: user.streak ?? 0,
    cefr_level: user.cefr_level ?? '',
    locale: user.locale ?? 'en',
    last_active: user.last_active ?? null,
    created_at: user.created_at ?? null,
  };
}

function createMatchPairDraft() {
  return {
    id: `pair-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    left: normalizeLocalizedValue({}),
    right: '',
  };
}

function createRequestHeaders(accessKey, userEmail, extra = {}) {
  const headers = new Headers(extra);

  if (accessKey) {
    headers.set(ADMIN_ACCESS_HEADER, accessKey);
  }

  if (userEmail) {
    headers.set(ADMIN_USER_EMAIL_HEADER, userEmail);
  }

  return headers;
}

function LocalizedFields({ label, value, onChange, multiline = false, rows = 3 }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {supportedLocales.map((locale) => {
          const Component = multiline ? 'textarea' : 'input';
          return (
            <label key={`${label}-${locale.id}`} className="block rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{locale.label}</span>
              <Component
                rows={multiline ? rows : undefined}
                type={multiline ? undefined : 'text'}
                value={value?.[locale.id] ?? ''}
                onChange={(event) => onChange(locale.id, event.target.value)}
                className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PanelShell({ title, description, actions, children }) {
  return (
    <section className="rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SectionSummary({ section, index, active, onClick, onMoveUp, onMoveDown, onDelete }) {
  return (
    <div
      className={[
        'rounded-[20px] border p-4 transition',
        active ? 'border-[#ff8b26] bg-[#fff7ed]' : 'border-slate-200 bg-white hover:border-slate-300',
      ].join(' ')}
    >
      <button type="button" onClick={onClick} className="w-full text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Section {index + 1}</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">{section.type}</p>
        <p className="mt-1 text-sm text-slate-600">{section.title?.en || section.title?.az || 'Untitled section'}</p>
      </button>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onMoveUp} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
          <ChevronUp className="mr-1 inline h-3.5 w-3.5" /> Up
        </button>
        <button type="button" onClick={onMoveDown} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
          <ChevronDown className="mr-1 inline h-3.5 w-3.5" /> Down
        </button>
        <button type="button" onClick={onDelete} className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600">
          <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}

function LocalizedListEditor({ label, values, onChange, addLabel = 'Add row' }) {
  const items = Array.isArray(values) ? values : [];

  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...items, normalizeLocalizedValue({})])}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" /> {addLabel}
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="rounded-[18px] border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Row {index + 1}</p>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
              >
                <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Remove
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {supportedLocales.map((locale) => (
                <label key={`${label}-${locale.id}-${index}`} className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{locale.label}</span>
                  <textarea
                    rows={3}
                    value={item?.[locale.id] ?? ''}
                    onChange={(event) => {
                      const nextItems = [...items];
                      nextItems[index] = {
                        ...normalizeLocalizedValue(item),
                        [locale.id]: event.target.value,
                      };
                      onChange(nextItems);
                    }}
                    className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StringListEditor({ label, values, onChange, addLabel = 'Add item', placeholder = '' }) {
  const items = Array.isArray(values) ? values : [];

  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" /> {addLabel}
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-3">
            <input
              type="text"
              value={item}
              placeholder={placeholder}
              onChange={(event) => {
                const nextItems = [...items];
                nextItems[index] = event.target.value;
                onChange(nextItems);
              }}
              className="w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchPairsEditor({ value, onChange }) {
  const pairs = Array.isArray(value) ? value : [];

  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">Match pairs</span>
        <button
          type="button"
          onClick={() => onChange([...pairs, createMatchPairDraft()])}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" /> Add pair
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {pairs.map((pair, index) => (
          <div key={pair?.id ?? `pair-${index}`} className="rounded-[18px] border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pair {index + 1}</p>
              <button
                type="button"
                onClick={() => onChange(pairs.filter((_, pairIndex) => pairIndex !== index))}
                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
              >
                <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Remove
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {supportedLocales.map((locale) => (
                <label key={`${pair?.id ?? index}-${locale.id}`} className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Left · {locale.label}</span>
                  <input
                    type="text"
                    value={pair?.left?.[locale.id] ?? ''}
                    onChange={(event) => {
                      const nextPairs = [...pairs];
                      nextPairs[index] = {
                        ...pair,
                        left: {
                          ...normalizeLocalizedValue(pair?.left),
                          [locale.id]: event.target.value,
                        },
                      };
                      onChange(nextPairs);
                    }}
                    className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Right answer</span>
              <input
                type="text"
                value={pair?.right ?? ''}
                onChange={(event) => {
                  const nextPairs = [...pairs];
                  nextPairs[index] = {
                    ...pair,
                    right: event.target.value,
                  };
                  onChange(nextPairs);
                }}
                className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [uploadAudio, uploadState] = useUpload();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('lessons');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [uploadContext, setUploadContext] = useState('');

  const [lessons, setLessons] = useState([]);
  const [lessonId, setLessonId] = useState(null);
  const [lessonDraft, setLessonDraft] = useState(createLessonDraft());
  const [lessonSectionIndex, setLessonSectionIndex] = useState(0);
  const [lessonSectionJson, setLessonSectionJson] = useState(stringifyEditorJson(createLessonDraft().content[0]));

  const [vocabulary, setVocabulary] = useState([]);
  const [vocabularyId, setVocabularyId] = useState(null);
  const [vocabularyDraft, setVocabularyDraft] = useState(createVocabularyDraft());

  const [culture, setCulture] = useState([]);
  const [cultureCategoryId, setCultureCategoryId] = useState(null);
  const [cultureEntryId, setCultureEntryId] = useState(null);
  const [cultureCategoryDraft, setCultureCategoryDraft] = useState(createCultureCategoryDraft());
  const [cultureEntryDraft, setCultureEntryDraft] = useState(createCultureEntryDraft());
  const [cultureTakeawaysJson, setCultureTakeawaysJson] = useState(stringifyEditorJson(createCultureEntryDraft().takeaways));

  const [tickets, setTickets] = useState([]);
  const [ticketId, setTicketId] = useState(null);
  const [ticketDraft, setTicketDraft] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');

  const [users, setUsers] = useState([]);
  const [managedUserId, setManagedUserId] = useState(null);
  const [managedUserDraft, setManagedUserDraft] = useState(null);
  const [userSearch, setUserSearch] = useState('');

  const [monetizationSummary, setMonetizationSummary] = useState({
    purchases: 0,
    activePurchases: 0,
    checkoutSessions: 0,
    completedSessions: 0,
  });
  const [purchaseRows, setPurchaseRows] = useState([]);
  const [checkoutSessionRows, setCheckoutSessionRows] = useState([]);
  const [monetizationSearch, setMonetizationSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAccess() {
      if (typeof window !== 'undefined') {
        setAccessKey(window.sessionStorage.getItem(ADMIN_STORAGE_KEY) ?? '');
      }

      try {
        const response = await fetch(`/api/user?email=${encodeURIComponent(DEMO_EMAIL)}`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load admin user.');
        }

        if (!cancelled) {
          setCurrentUser(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(getErrorMessage(error, 'Failed to load admin user.'));
        }
      } finally {
        if (!cancelled) {
          setBootstrapped(true);
        }
      }
    }

    bootstrapAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  async function requestJson(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: createRequestHeaders(accessKey, currentUser?.email, options.headers),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || 'Request failed.');
    }

    return payload;
  }

  async function loadDashboard() {
    setLoading(true);
    setAuthError('');

    try {
      const [lessonPayload, vocabularyPayload, culturePayload, ticketPayload, userPayload, monetizationPayload] = await Promise.all([
        requestJson('/api/admin/lessons'),
        requestJson('/api/admin/vocabulary'),
        requestJson('/api/admin/culture'),
        requestJson('/api/admin/support-tickets'),
        requestJson('/api/admin/users'),
        requestJson('/api/admin/monetization'),
      ]);

      setLessons(lessonPayload.items ?? []);
      setVocabulary(vocabularyPayload.items ?? []);
      setCulture(culturePayload.items ?? []);
      setTickets(ticketPayload.items ?? []);
      setUsers(userPayload.items ?? []);
      setMonetizationSummary(monetizationPayload.summary ?? {
        purchases: 0,
        activePurchases: 0,
        checkoutSessions: 0,
        completedSessions: 0,
      });
      setPurchaseRows(monetizationPayload.purchases ?? []);
      setCheckoutSessionRows(monetizationPayload.checkoutSessions ?? []);
      setBanner({ type: '', message: '' });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load admin data.');
      setAuthError(message);
      setBanner({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (bootstrapped && currentUser?.email) {
      loadDashboard();
    }
  }, [bootstrapped, currentUser?.email]);

  const selectedLesson = useMemo(() => lessons.find((item) => item.id === lessonId) ?? null, [lessons, lessonId]);
  const selectedVocabulary = useMemo(() => vocabulary.find((item) => item.id === vocabularyId) ?? null, [vocabulary, vocabularyId]);
  const selectedCultureCategory = useMemo(
    () => culture.find((item) => item.id === cultureCategoryId) ?? null,
    [culture, cultureCategoryId]
  );
  const selectedCultureEntry = useMemo(
    () => selectedCultureCategory?.entries?.find((item) => item.id === cultureEntryId) ?? null,
    [selectedCultureCategory, cultureEntryId]
  );
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesStatus = ticketStatusFilter === 'all' || ticket.status === ticketStatusFilter;
      const haystack = [ticket.ticket_number, ticket.requester_name, ticket.requester_email, ticket.subject, ticket.message, ticket.customer_reply]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !ticketSearch || haystack.includes(ticketSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [ticketSearch, ticketStatusFilter, tickets]);
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const haystack = [user.username, user.email, user.role, user.locale, user.cefr_level].join(' ').toLowerCase();
      return !userSearch || haystack.includes(userSearch.toLowerCase());
    });
  }, [userSearch, users]);
  const filteredPurchases = useMemo(() => {
    return purchaseRows.filter((row) => {
      const haystack = [row.user_email, row.product_slug, row.product_name, row.product_category, row.source, row.status]
        .join(' ')
        .toLowerCase();
      return !monetizationSearch || haystack.includes(monetizationSearch.toLowerCase());
    });
  }, [monetizationSearch, purchaseRows]);
  const filteredCheckoutSessions = useMemo(() => {
    return checkoutSessionRows.filter((row) => {
      const haystack = [row.user_email, row.product_slug, row.stripe_session_id, row.source, row.status]
        .join(' ')
        .toLowerCase();
      return !monetizationSearch || haystack.includes(monetizationSearch.toLowerCase());
    });
  }, [checkoutSessionRows, monetizationSearch]);

  useEffect(() => {
    if (lessonId === NEW_RECORD_ID) {
      return;
    }

    if (lessons.length === 0) {
      setLessonId(null);
      setLessonDraft(createLessonDraft());
      setLessonSectionIndex(0);
      setLessonSectionJson(stringifyEditorJson(createLessonDraft().content[0]));
      return;
    }

    const current = selectedLesson ?? lessons[0];
    setLessonId(current.id);
    const nextDraft = {
      id: current.id,
      level_code: current.level_code,
      order_index: current.order_index,
      title_translations: normalizeLocalizedValue(current.title_translations ?? current.title),
      description_translations: normalizeLocalizedValue(current.description_translations ?? current.description),
      content: Array.isArray(current.content) && current.content.length > 0 ? cloneData(current.content) : [cloneTemplateSection('goal')],
    };
    setLessonDraft(nextDraft);
    setLessonSectionIndex(0);
    setLessonSectionJson(stringifyEditorJson(nextDraft.content[0]));
  }, [lessons, selectedLesson]);

  useEffect(() => {
    if (vocabularyId === NEW_RECORD_ID) {
      return;
    }

    if (!selectedVocabulary && vocabulary.length === 0) {
      setVocabularyDraft(createVocabularyDraft());
      return;
    }

    const current = selectedVocabulary ?? vocabulary[0];
    if (!current) {
      return;
    }

    setVocabularyId(current.id);
    setVocabularyDraft({
      id: current.id,
      word: current.word,
      translation_translations: normalizeLocalizedValue(current.translation_translations ?? current.translation),
      pronunciation_url: current.pronunciation_url ?? '',
    });
  }, [selectedVocabulary, vocabulary]);

  useEffect(() => {
    if (cultureCategoryId === NEW_RECORD_ID) {
      return;
    }

    if (culture.length === 0) {
      setCultureCategoryId(null);
      setCultureEntryId(null);
      setCultureCategoryDraft(createCultureCategoryDraft());
      const nextEntry = createCultureEntryDraft();
      setCultureEntryDraft(nextEntry);
      setCultureTakeawaysJson(stringifyEditorJson(nextEntry.takeaways));
      return;
    }

    const category = selectedCultureCategory ?? culture[0];
    setCultureCategoryId(category.id);
    setCultureCategoryDraft({
      id: category.id,
      emoji: category.emoji,
      order_index: category.order_index,
      title: normalizeLocalizedValue(category.title),
      description: normalizeLocalizedValue(category.description),
    });

    const entry = selectedCultureEntry ?? category.entries?.[0] ?? null;
    if (cultureEntryId === NEW_RECORD_ID) {
      return;
    }

    setCultureEntryId(entry?.id ?? null);

    if (entry) {
      const nextEntry = {
        id: entry.id,
        category_id: entry.category_id,
        type: entry.type,
        order_index: entry.order_index,
        title: normalizeLocalizedValue(entry.title),
        period: normalizeLocalizedValue(entry.period),
        blurb: normalizeLocalizedValue(entry.blurb),
        takeaways: Array.isArray(entry.takeaways) ? cloneData(entry.takeaways) : [],
      };
      setCultureEntryDraft(nextEntry);
      setCultureTakeawaysJson(stringifyEditorJson(nextEntry.takeaways));
    } else {
      const nextEntry = createCultureEntryDraft(category.id);
      setCultureEntryDraft(nextEntry);
      setCultureTakeawaysJson(stringifyEditorJson(nextEntry.takeaways));
    }
  }, [culture, selectedCultureCategory, selectedCultureEntry]);

  useEffect(() => {
    const current = tickets.find((item) => item.id === ticketId) ?? filteredTickets[0] ?? null;
    setTicketId(current?.id ?? null);
    setTicketDraft(current ? { ...current } : null);
  }, [filteredTickets, ticketId, tickets]);

  useEffect(() => {
    if (managedUserId === NEW_RECORD_ID) {
      return;
    }

    const current = users.find((item) => item.id === managedUserId) ?? filteredUsers[0] ?? null;
    setManagedUserId(current?.id ?? null);
    setManagedUserDraft(current ? createManagedUserDraft(current) : null);
  }, [filteredUsers, managedUserId, users]);

  function persistAccessKey(event) {
    event.preventDefault();
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ADMIN_STORAGE_KEY, accessKey);
    }
    loadDashboard();
  }

  function updateLocalizedState(setter, key) {
    return (localeId, nextValue) => {
      setter((current) => ({
        ...current,
        [key]: {
          ...current[key],
          [localeId]: nextValue,
        },
      }));
    };
  }

  function newLesson() {
    const next = createLessonDraft();
    setLessonId(NEW_RECORD_ID);
    setLessonDraft(next);
    setLessonSectionIndex(0);
    setLessonSectionJson(stringifyEditorJson(next.content[0]));
  }

  function selectLesson(item) {
    setLessonId(item.id);
  }

  function addLessonSection(type) {
    setLessonDraft((current) => {
      const nextSection = cloneTemplateSection(type);
      const nextContent = [...current.content, nextSection];
      setLessonSectionIndex(nextContent.length - 1);
      setLessonSectionJson(stringifyEditorJson(nextSection));
      return { ...current, content: nextContent };
    });
  }

  function syncLessonSectionJson(nextIndex, nextContent) {
    const safeIndex = Math.max(0, Math.min(nextIndex, nextContent.length - 1));
    setLessonSectionIndex(safeIndex);
    setLessonSectionJson(stringifyEditorJson(nextContent[safeIndex] ?? cloneTemplateSection('goal')));
  }

  function replaceLessonSection(index, updater) {
    setLessonDraft((current) => {
      const nextContent = current.content.map((section, sectionIndex) => (sectionIndex === index ? updater(section) : section));
      setLessonSectionJson(stringifyEditorJson(nextContent[index]));
      return { ...current, content: nextContent };
    });
  }

  function moveLessonSection(index, direction) {
    setLessonDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.content.length) {
        return current;
      }

      const nextContent = [...current.content];
      const [section] = nextContent.splice(index, 1);
      nextContent.splice(nextIndex, 0, section);
      syncLessonSectionJson(nextIndex, nextContent);
      return { ...current, content: nextContent };
    });
  }

  function deleteLessonSection(index) {
    setLessonDraft((current) => {
      const nextContent = current.content.filter((_, sectionIndex) => sectionIndex !== index);
      const safeContent = nextContent.length > 0 ? nextContent : [cloneTemplateSection('goal')];
      syncLessonSectionJson(Math.max(0, index - 1), safeContent);
      return { ...current, content: safeContent };
    });
  }

  function applyLessonSectionJson() {
    try {
      const nextSection = readJson(lessonSectionJson, 'Lesson section JSON');
      replaceLessonSection(lessonSectionIndex, () => nextSection);
      setBanner({ type: 'success', message: 'Section JSON applied.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to apply section JSON.') });
    }
  }

  function updateCurrentLessonSection(updater) {
    replaceLessonSection(lessonSectionIndex, updater);
  }

  async function uploadAudioAsset(file, onComplete, contextLabel) {
    if (!file) {
      return;
    }

    setUploadContext(contextLabel);
    const result = await uploadAudio({ file });
    setUploadContext('');

    if (result?.error) {
      setBanner({ type: 'error', message: result.error });
      return;
    }

    if (result?.url) {
      onComplete(result.url);
      setBanner({ type: 'success', message: `${contextLabel} uploaded.` });
    }
  }

  async function handleLessonAudioUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    await uploadAudioAsset(
      file,
      (url) => updateCurrentLessonSection((section) => ({ ...section, audioUrl: url })),
      'Lesson audio'
    );
  }

  async function handleVocabularyAudioUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    await uploadAudioAsset(
      file,
      (url) => setVocabularyDraft((current) => ({ ...current, pronunciation_url: url })),
      'Pronunciation audio'
    );
  }

  async function saveLesson() {
    try {
      const method = lessonDraft.id ? 'PATCH' : 'POST';
      const payload = await requestJson('/api/admin/lessons', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonDraft),
      });
      setLessonId(payload.item?.id ?? null);
      await loadDashboard();
      setBanner({ type: 'success', message: lessonDraft.id ? 'Lesson updated.' : 'Lesson created.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to save lesson.') });
    }
  }

  async function removeLesson() {
    if (!lessonDraft.id) {
      newLesson();
      return;
    }

    try {
      await requestJson('/api/admin/lessons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lessonDraft.id }),
      });
      await loadDashboard();
      setBanner({ type: 'success', message: 'Lesson deleted.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to delete lesson.') });
    }
  }

  function newVocabulary() {
    setVocabularyId(NEW_RECORD_ID);
    setVocabularyDraft(createVocabularyDraft());
  }

  async function saveVocabulary() {
    try {
      const method = vocabularyDraft.id ? 'PATCH' : 'POST';
      const payload = await requestJson('/api/admin/vocabulary', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vocabularyDraft),
      });
      setVocabularyId(payload.item?.id ?? null);
      await loadDashboard();
      setBanner({ type: 'success', message: vocabularyDraft.id ? 'Vocabulary updated.' : 'Vocabulary created.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to save vocabulary.') });
    }
  }

  async function removeVocabulary() {
    if (!vocabularyDraft.id) {
      newVocabulary();
      return;
    }

    try {
      await requestJson('/api/admin/vocabulary', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vocabularyDraft.id }),
      });
      await loadDashboard();
      setBanner({ type: 'success', message: 'Vocabulary deleted.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to delete vocabulary.') });
    }
  }

  function newCultureCategory() {
    setCultureCategoryId(NEW_RECORD_ID);
    setCultureCategoryDraft(createCultureCategoryDraft());
    const nextEntry = createCultureEntryDraft();
    setCultureEntryId(NEW_RECORD_ID);
    setCultureEntryDraft(nextEntry);
    setCultureTakeawaysJson(stringifyEditorJson(nextEntry.takeaways));
  }

  async function saveCultureCategory() {
    try {
      const isUpdating = Boolean(cultureCategoryId && cultureCategoryId !== NEW_RECORD_ID);
      const payload = {
        ...cultureCategoryDraft,
        entityType: 'category',
        id:
          cultureCategoryDraft.id ||
          slugify(cultureCategoryDraft.title.en || cultureCategoryDraft.title.az || cultureCategoryDraft.description.en),
      };
      const method = isUpdating ? 'PATCH' : 'POST';
      await requestJson('/api/admin/culture', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setCultureCategoryId(payload.id);
      await loadDashboard();
      setBanner({ type: 'success', message: isUpdating ? 'Category updated.' : 'Category created.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to save culture category.') });
    }
  }

  async function removeCultureCategory() {
    if (!cultureCategoryDraft.id) {
      newCultureCategory();
      return;
    }

    try {
      await requestJson('/api/admin/culture', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'category', id: cultureCategoryDraft.id }),
      });
      await loadDashboard();
      setBanner({ type: 'success', message: 'Category deleted.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to delete culture category.') });
    }
  }

  function newCultureEntry() {
    const next = createCultureEntryDraft(cultureCategoryDraft.id || selectedCultureCategory?.id || '');
    setCultureEntryId(NEW_RECORD_ID);
    setCultureEntryDraft(next);
    setCultureTakeawaysJson(stringifyEditorJson(next.takeaways));
  }

  async function saveCultureEntry() {
    try {
      const isUpdating = Boolean(cultureEntryId && cultureEntryId !== NEW_RECORD_ID);
      const payload = {
        ...cultureEntryDraft,
        entityType: 'entry',
        category_id: cultureEntryDraft.category_id || cultureCategoryDraft.id || selectedCultureCategory?.id || '',
        id:
          cultureEntryDraft.id ||
          slugify(cultureEntryDraft.title.en || cultureEntryDraft.title.az || cultureEntryDraft.blurb.en),
        takeaways: readJson(cultureTakeawaysJson, 'Culture takeaways JSON'),
      };
      const method = isUpdating ? 'PATCH' : 'POST';
      await requestJson('/api/admin/culture', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setCultureEntryId(payload.id);
      await loadDashboard();
      setBanner({ type: 'success', message: isUpdating ? 'Entry updated.' : 'Entry created.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to save culture entry.') });
    }
  }

  async function removeCultureEntry() {
    if (!cultureEntryDraft.id) {
      newCultureEntry();
      return;
    }

    try {
      await requestJson('/api/admin/culture', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'entry', id: cultureEntryDraft.id }),
      });
      await loadDashboard();
      setBanner({ type: 'success', message: 'Entry deleted.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to delete culture entry.') });
    }
  }

  async function saveTicket() {
    if (!ticketDraft) {
      return;
    }

    try {
      await requestJson('/api/admin/support-tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ticketDraft.id,
          status: ticketDraft.status,
          admin_note: ticketDraft.admin_note ?? '',
          customer_reply: ticketDraft.customer_reply ?? '',
        }),
      });
      await loadDashboard();
      setBanner({ type: 'success', message: 'Support ticket updated.' });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to update support ticket.') });
    }
  }

  function newManagedUser() {
    setManagedUserId(NEW_RECORD_ID);
    setManagedUserDraft(createManagedUserDraft());
  }

  async function saveManagedUser() {
    if (!managedUserDraft) {
      return;
    }

    try {
      const payload = await requestJson('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: managedUserDraft.email,
          username: managedUserDraft.username,
          role: managedUserDraft.role,
        }),
      });
      setManagedUserId(payload.item?.id ?? null);
      await loadDashboard();
      setBanner({
        type: 'success',
        message: managedUserDraft.id ? 'User access updated.' : 'User created and role saved.',
      });
    } catch (error) {
      setBanner({ type: 'error', message: getErrorMessage(error, 'Failed to save user access.') });
    }
  }

  const currentSection = lessonDraft.content[lessonSectionIndex] ?? lessonDraft.content[0] ?? null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,rgba(219,234,254,0.7)_22%,transparent_48%),radial-gradient(circle_at_bottom_right,#ffedd5_0%,rgba(255,237,213,0.75)_26%,transparent_56%),linear-gradient(180deg,#f8fafc_0%,#fffdf8_100%)] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,247,237,0.92))] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
                <ShieldCheck className="h-4 w-4" />
                Admin Panel
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Manage lessons, media, vocabulary, culture, and support.</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                This workspace editor is built against the current Neon schema. Admin access now uses the app user role first, with the legacy access key kept only as an optional fallback.
              </p>
            </div>

            <form onSubmit={persistAccessKey} className="w-full max-w-md rounded-[26px] border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Current admin user</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{currentUser?.email ?? DEMO_EMAIL}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {isAdminRole(currentUser?.role)
                        ? 'This user has admin access through the users.role field.'
                        : 'This user is not marked as admin yet. Add it to ADMIN_EMAILS or set users.role to admin.'}
                    </p>
                  </div>
                  <span
                    className={[
                      'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                      isAdminRole(currentUser?.role) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                    ].join(' ')}
                  >
                    {currentUser?.role ?? 'loading'}
                  </span>
                </div>
              </div>
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <KeyRound className="h-4 w-4 text-[#ff8b26]" />
                  Access key fallback
                </span>
                <input
                  type="password"
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  placeholder="Optional when ADMIN_ACCESS_KEY is set"
                  className="mt-3 w-full rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                />
              </label>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-slate-500">In local development, {DEMO_EMAIL} is automatically promoted to admin unless you override ADMIN_EMAILS.</p>
                <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                  Refresh access
                </button>
              </div>
              {authError ? <p className="mt-3 text-sm text-rose-600">{authError}</p> : null}
            </form>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          {adminTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                  active ? 'bg-slate-950 text-white shadow-lg' : 'border border-white/80 bg-white/90 text-slate-700',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={loadDashboard}
            className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <RefreshCw className={['h-4 w-4', loading ? 'animate-spin' : ''].join(' ')} />
            Refresh
          </button>
        </div>

        {banner.message ? (
          <div
            className={[
              'rounded-[22px] border px-4 py-3 text-sm',
              banner.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
            ].join(' ')}
          >
            {banner.message}
          </div>
        ) : null}

        {activeTab === 'lessons' ? (
          <PanelShell
            title="Lesson CMS"
            description="Create or edit lesson shells, translations, reading text, listening sections, and exercise JSON against the existing lessons.content schema."
            actions={[
              <button key="new" type="button" onClick={newLesson} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                <Plus className="mr-2 inline h-4 w-4" /> New lesson
              </button>,
              <button key="save" type="button" onClick={saveLesson} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                <Save className="mr-2 inline h-4 w-4" /> Save lesson
              </button>,
              <button key="delete" type="button" onClick={removeLesson} className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600">
                <Trash2 className="mr-2 inline h-4 w-4" /> Delete
              </button>,
            ]}
          >
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
              <div className="space-y-3">
                {lessons.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectLesson(item)}
                    className={[
                      'w-full rounded-[22px] border px-4 py-4 text-left transition',
                      lessonDraft.id === item.id ? 'border-[#ff8b26] bg-[#fff7ed]' : 'border-slate-200 bg-white',
                    ].join(' ')}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{item.level_code} · order {item.order_index}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{item.title?.en || item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{Array.isArray(item.content) ? item.content.length : 0} sections</p>
                  </button>
                ))}
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Level</span>
                    <input
                      type="text"
                      value={lessonDraft.level_code}
                      onChange={(event) => setLessonDraft((current) => ({ ...current, level_code: event.target.value }))}
                      className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Order index</span>
                    <input
                      type="number"
                      value={lessonDraft.order_index}
                      onChange={(event) => setLessonDraft((current) => ({ ...current, order_index: Number(event.target.value) }))}
                      className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                </div>

                <LocalizedFields label="Lesson title" value={lessonDraft.title_translations} onChange={updateLocalizedState(setLessonDraft, 'title_translations')} />
                <LocalizedFields label="Lesson description" value={lessonDraft.description_translations} onChange={updateLocalizedState(setLessonDraft, 'description_translations')} multiline rows={4} />

                <div className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Lesson sections</p>
                      <p className="mt-1 text-sm text-slate-600">Use the structured editor for reading, listening, vocabulary-style drills, and exercises. Raw JSON is still available for advanced edits.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(LESSON_SECTION_TEMPLATES).map((type) => (
                        <button key={type} type="button" onClick={() => addLessonSection(type)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                          <Plus className="mr-1 inline h-3.5 w-3.5" /> {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-3">
                      {lessonDraft.content.map((section, index) => (
                        <SectionSummary
                          key={`${section.type}-${index}`}
                          section={section}
                          index={index}
                          active={index === lessonSectionIndex}
                          onClick={() => {
                            setLessonSectionIndex(index);
                            setLessonSectionJson(stringifyEditorJson(section));
                          }}
                          onMoveUp={() => moveLessonSection(index, -1)}
                          onMoveDown={() => moveLessonSection(index, 1)}
                          onDelete={() => deleteLessonSection(index)}
                        />
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Structured section editor</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Current section type: {currentSection?.type ?? 'n/a'}</p>
                          </div>
                          {uploadState.loading ? (
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff8b26]">Uploading {uploadContext || 'audio'}...</span>
                          ) : null}
                        </div>

                        {currentSection ? (
                          <div className="mt-4 space-y-4">
                            <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                              <span className="text-sm font-semibold text-slate-900">Section type</span>
                              <input type="text" readOnly value={currentSection.type} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500" />
                            </label>

                            <LocalizedFields
                              label="Section title"
                              value={normalizeLocalizedValue(currentSection.title)}
                              onChange={(localeId, nextValue) =>
                                updateCurrentLessonSection((section) => ({
                                  ...section,
                                  title: {
                                    ...normalizeLocalizedValue(section.title),
                                    [localeId]: nextValue,
                                  },
                                }))
                              }
                            />

                            {'prompt' in currentSection ? (
                              <LocalizedFields
                                label="Section prompt"
                                value={normalizeLocalizedValue(currentSection.prompt)}
                                onChange={(localeId, nextValue) =>
                                  updateCurrentLessonSection((section) => ({
                                    ...section,
                                    prompt: {
                                      ...normalizeLocalizedValue(section.prompt),
                                      [localeId]: nextValue,
                                    },
                                  }))
                                }
                                multiline
                                rows={4}
                              />
                            ) : null}

                            {'audioUrl' in currentSection || currentSection.type === 'listening' ? (
                              <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-sm font-semibold text-slate-900">Audio source</span>
                                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                                    <Headphones className="h-4 w-4" /> Upload audio
                                    <input type="file" accept="audio/*" onChange={handleLessonAudioUpload} className="hidden" />
                                  </label>
                                </div>
                                <input
                                  type="url"
                                  value={currentSection.audioUrl ?? ''}
                                  onChange={(event) => updateCurrentLessonSection((section) => ({ ...section, audioUrl: event.target.value }))}
                                  className="mt-3 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm"
                                  placeholder="https://.../lesson-audio.mp3"
                                />
                                {currentSection.audioUrl ? <audio controls preload="none" className="mt-4 w-full" src={currentSection.audioUrl} /> : null}
                              </div>
                            ) : null}

                            {Array.isArray(currentSection.items) ? (
                              <LocalizedListEditor
                                label="Bullet items"
                                values={currentSection.items}
                                onChange={(nextItems) => updateCurrentLessonSection((section) => ({ ...section, items: nextItems }))}
                                addLabel="Add bullet"
                              />
                            ) : null}

                            {Array.isArray(currentSection.lines) ? (
                              <LocalizedListEditor
                                label={currentSection.type === 'dialogue' ? 'Dialogue lines' : 'Text lines'}
                                values={currentSection.lines}
                                onChange={(nextLines) => updateCurrentLessonSection((section) => ({ ...section, lines: nextLines }))}
                                addLabel="Add line"
                              />
                            ) : null}

                            {Array.isArray(currentSection.options) ? (
                              <StringListEditor
                                label="Quiz options"
                                values={currentSection.options}
                                onChange={(nextOptions) => updateCurrentLessonSection((section) => ({ ...section, options: nextOptions }))}
                                addLabel="Add option"
                                placeholder="Option text"
                              />
                            ) : null}

                            {'correctIndex' in currentSection ? (
                              <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                                <span className="text-sm font-semibold text-slate-900">Correct option index</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={currentSection.correctIndex ?? 0}
                                  onChange={(event) =>
                                    updateCurrentLessonSection((section) => ({
                                      ...section,
                                      correctIndex: Number(event.target.value),
                                    }))
                                  }
                                  className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm"
                                />
                              </label>
                            ) : null}

                            {'placeholder' in currentSection ? (
                              <LocalizedFields
                                label="Input placeholder"
                                value={normalizeLocalizedValue(currentSection.placeholder)}
                                onChange={(localeId, nextValue) =>
                                  updateCurrentLessonSection((section) => ({
                                    ...section,
                                    placeholder: {
                                      ...normalizeLocalizedValue(section.placeholder),
                                      [localeId]: nextValue,
                                    },
                                  }))
                                }
                              />
                            ) : null}

                            {Array.isArray(currentSection.acceptedAnswers) ? (
                              <StringListEditor
                                label="Accepted answers"
                                values={currentSection.acceptedAnswers}
                                onChange={(nextAnswers) => updateCurrentLessonSection((section) => ({ ...section, acceptedAnswers: nextAnswers }))}
                                addLabel="Add answer"
                                placeholder="Accepted answer"
                              />
                            ) : null}

                            {Array.isArray(currentSection.pairs) ? (
                              <MatchPairsEditor
                                value={currentSection.pairs}
                                onChange={(nextPairs) => updateCurrentLessonSection((section) => ({ ...section, pairs: nextPairs }))}
                              />
                            ) : null}

                            {'explanation' in currentSection ? (
                              <LocalizedFields
                                label="Explanation"
                                value={normalizeLocalizedValue(currentSection.explanation)}
                                onChange={(localeId, nextValue) =>
                                  updateCurrentLessonSection((section) => ({
                                    ...section,
                                    explanation: {
                                      ...normalizeLocalizedValue(section.explanation),
                                      [localeId]: nextValue,
                                    },
                                  }))
                                }
                                multiline
                                rows={4}
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Advanced JSON editor</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Use this for section fields that are not covered by the structured controls.</p>
                          </div>
                          <button type="button" onClick={applyLessonSectionJson} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                            Apply JSON
                          </button>
                        </div>
                        <textarea
                          value={lessonSectionJson}
                          onChange={(event) => setLessonSectionJson(event.target.value)}
                          rows={18}
                          className="mt-4 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PanelShell>
        ) : null}

        {activeTab === 'vocabulary' ? (
          <PanelShell
            title="Vocabulary and audio"
            description="Manage vocabulary records, localized translations, and pronunciation audio URLs used in review flows."
            actions={[
              <button key="new" type="button" onClick={newVocabulary} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                <Plus className="mr-2 inline h-4 w-4" /> New term
              </button>,
              <button key="save" type="button" onClick={saveVocabulary} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                <Save className="mr-2 inline h-4 w-4" /> Save term
              </button>,
              <button key="delete" type="button" onClick={removeVocabulary} className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600">
                <Trash2 className="mr-2 inline h-4 w-4" /> Delete
              </button>,
            ]}
          >
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
              <div className="space-y-3">
                {vocabulary.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setVocabularyId(item.id)}
                    className={[
                      'w-full rounded-[22px] border px-4 py-4 text-left transition',
                      vocabularyDraft.id === item.id ? 'border-[#ff8b26] bg-[#fff7ed]' : 'border-slate-200 bg-white',
                    ].join(' ')}
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.word}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.translation?.en || item.translation}</p>
                    <p className="mt-2 text-xs text-slate-400">{item.pronunciation_url ? 'Audio attached' : 'No audio URL'}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-5">
                <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <span className="text-sm font-semibold text-slate-900">Word</span>
                  <input
                    type="text"
                    value={vocabularyDraft.word}
                    onChange={(event) => setVocabularyDraft((current) => ({ ...current, word: event.target.value }))}
                    className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <LocalizedFields label="Translation" value={vocabularyDraft.translation_translations} onChange={updateLocalizedState(setVocabularyDraft, 'translation_translations')} />
                <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-semibold text-slate-900">Pronunciation audio</span>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                      <Headphones className="h-4 w-4" /> Upload audio
                      <input type="file" accept="audio/*" onChange={handleVocabularyAudioUpload} className="hidden" />
                    </label>
                  </div>
                  <input
                    type="url"
                    value={vocabularyDraft.pronunciation_url}
                    onChange={(event) => setVocabularyDraft((current) => ({ ...current, pronunciation_url: event.target.value }))}
                    className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="https://.../word.mp3"
                  />
                  {uploadState.loading && uploadContext === 'Pronunciation audio' ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#ff8b26]">Uploading pronunciation audio...</p>
                  ) : null}
                  {vocabularyDraft.pronunciation_url ? (
                    <audio controls preload="none" className="mt-4 w-full" src={vocabularyDraft.pronunciation_url} />
                  ) : null}
                </label>
              </div>
            </div>
          </PanelShell>
        ) : null}

        {activeTab === 'culture' ? (
          <PanelShell
            title="Culture collections"
            description="Manage category groupings and entry cards for cultural reading content, including localized summaries and takeaway lists."
            actions={[
              <button key="refresh" type="button" onClick={loadDashboard} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                <RefreshCw className="mr-2 inline h-4 w-4" /> Reload culture
              </button>,
            ]}
          >
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1fr_1fr]">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button type="button" onClick={newCultureCategory} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                    <Plus className="mr-2 inline h-4 w-4" /> New category
                  </button>
                  <button type="button" onClick={saveCultureCategory} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                    <Save className="mr-2 inline h-4 w-4" /> Save
                  </button>
                </div>
                {culture.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCultureCategoryId(item.id)}
                    className={[
                      'w-full rounded-[22px] border px-4 py-4 text-left transition',
                      cultureCategoryDraft.id === item.id ? 'border-[#ff8b26] bg-[#fff7ed]' : 'border-slate-200 bg-white',
                    ].join(' ')}
                  >
                    <p className="text-lg">{item.emoji}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{item.title?.en || item.id}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.entries?.length ?? 0} entries</p>
                  </button>
                ))}
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">Category editor</h3>
                  <button type="button" onClick={removeCultureCategory} className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600">
                    <Trash2 className="mr-2 inline h-4 w-4" /> Delete
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-[0.6fr_1.4fr_0.8fr]">
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">ID</span>
                    <input type="text" value={cultureCategoryDraft.id} onChange={(event) => setCultureCategoryDraft((current) => ({ ...current, id: event.target.value }))} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </label>
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Emoji</span>
                    <input type="text" value={cultureCategoryDraft.emoji} onChange={(event) => setCultureCategoryDraft((current) => ({ ...current, emoji: event.target.value }))} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </label>
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Order</span>
                    <input type="number" value={cultureCategoryDraft.order_index} onChange={(event) => setCultureCategoryDraft((current) => ({ ...current, order_index: Number(event.target.value) }))} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </label>
                </div>
                <LocalizedFields label="Category title" value={cultureCategoryDraft.title} onChange={updateLocalizedState(setCultureCategoryDraft, 'title')} />
                <LocalizedFields label="Category description" value={cultureCategoryDraft.description} onChange={updateLocalizedState(setCultureCategoryDraft, 'description')} multiline rows={4} />
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">Entry editor</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={newCultureEntry} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                      <Plus className="mr-2 inline h-4 w-4" /> New entry
                    </button>
                    <button type="button" onClick={removeCultureEntry} className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600">
                      <Trash2 className="mr-2 inline h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {(selectedCultureCategory?.entries ?? []).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setCultureEntryId(entry.id)}
                      className={[
                        'w-full rounded-[18px] border px-4 py-3 text-left transition',
                        cultureEntryDraft.id === entry.id ? 'border-[#ff8b26] bg-[#fff7ed]' : 'border-slate-200 bg-white',
                      ].join(' ')}
                    >
                      <p className="text-sm font-semibold text-slate-900">{entry.title?.en || entry.id}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{entry.type}</p>
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Entry ID</span>
                    <input type="text" value={cultureEntryDraft.id} onChange={(event) => setCultureEntryDraft((current) => ({ ...current, id: event.target.value }))} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </label>
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Entry type</span>
                    <input type="text" value={cultureEntryDraft.type} onChange={(event) => setCultureEntryDraft((current) => ({ ...current, type: event.target.value }))} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </label>
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Category ID</span>
                    <input type="text" value={cultureEntryDraft.category_id} onChange={(event) => setCultureEntryDraft((current) => ({ ...current, category_id: event.target.value }))} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </label>
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Order</span>
                    <input type="number" value={cultureEntryDraft.order_index} onChange={(event) => setCultureEntryDraft((current) => ({ ...current, order_index: Number(event.target.value) }))} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </label>
                </div>
                <LocalizedFields label="Entry title" value={cultureEntryDraft.title} onChange={updateLocalizedState(setCultureEntryDraft, 'title')} />
                <LocalizedFields label="Entry period" value={cultureEntryDraft.period} onChange={updateLocalizedState(setCultureEntryDraft, 'period')} />
                <LocalizedFields label="Entry blurb" value={cultureEntryDraft.blurb} onChange={updateLocalizedState(setCultureEntryDraft, 'blurb')} multiline rows={4} />
                <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <span className="text-sm font-semibold text-slate-900">Takeaways JSON</span>
                  <textarea value={cultureTakeawaysJson} onChange={(event) => setCultureTakeawaysJson(event.target.value)} rows={12} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 font-mono text-xs text-slate-900" />
                </label>
                <button type="button" onClick={saveCultureEntry} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                  <Save className="mr-2 inline h-4 w-4" /> Save entry
                </button>
              </div>
            </div>
          </PanelShell>
        ) : null}

        {activeTab === 'support' ? (
          <PanelShell
            title="Support queue"
            description="Review incoming support tickets, keep internal notes, send customer-facing replies, and move tickets through open, in progress, resolved, and closed states."
          >
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Status filter</span>
                    <select value={ticketStatusFilter} onChange={(event) => setTicketStatusFilter(event.target.value)} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="all">All statuses</option>
                      {SUPPORT_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-900">Search</span>
                    <input type="text" value={ticketSearch} onChange={(event) => setTicketSearch(event.target.value)} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Ticket number, email, subject" />
                  </label>
                </div>
                <div className="space-y-3">
                  {filteredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setTicketId(ticket.id)}
                      className={[
                        'w-full rounded-[22px] border px-4 py-4 text-left transition',
                        ticketDraft?.id === ticket.id ? 'border-[#ff8b26] bg-[#fff7ed]' : 'border-slate-200 bg-white',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{ticket.ticket_number}</p>
                          <p className="mt-1 text-sm text-slate-600">{ticket.subject}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">{ticket.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{ticket.requester_name} · {ticket.requester_email}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {ticketDraft ? (
                  <div className="space-y-5 rounded-[26px] border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{ticketDraft.ticket_number}</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{ticketDraft.subject}</h3>
                        <p className="mt-2 text-sm text-slate-600">{ticketDraft.requester_name} · {ticketDraft.requester_email}</p>
                      </div>
                      <AlertCircle className="h-5 w-5 text-[#ff8b26]" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <span className="text-sm font-semibold text-slate-900">Status</span>
                        <select value={ticketDraft.status} onChange={(event) => setTicketDraft((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm">
                          {SUPPORT_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <span className="text-sm font-semibold text-slate-900">Category</span>
                        <input type="text" value={ticketDraft.category} readOnly className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500" />
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Created</p>
                        <p className="mt-2 text-sm text-slate-700">{ticketDraft.created_at ? new Date(ticketDraft.created_at).toLocaleString() : 'N/A'}</p>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">First response</p>
                        <p className="mt-2 text-sm text-slate-700">{ticketDraft.first_response_at ? new Date(ticketDraft.first_response_at).toLocaleString() : 'Not yet'}</p>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Resolved</p>
                        <p className="mt-2 text-sm text-slate-700">{ticketDraft.resolved_at ? new Date(ticketDraft.resolved_at).toLocaleString() : 'Open'}</p>
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{ticketDraft.message}</div>

                    <label className="block rounded-[20px] border border-[#ffe2bf] bg-[linear-gradient(180deg,#fff9f3_0%,#fff1e7_100%)] p-4">
                      <span className="text-sm font-semibold text-slate-900">Customer reply</span>
                      <textarea
                        value={ticketDraft.customer_reply ?? ''}
                        onChange={(event) => setTicketDraft((current) => ({ ...current, customer_reply: event.target.value }))}
                        rows={6}
                        className="mt-2 w-full rounded-[18px] border border-white bg-white px-4 py-3 text-sm text-slate-900"
                        placeholder="Share the next step, answer, or resolution message the requester should see."
                      />
                      <p className="mt-2 text-xs text-slate-500">Visible in the public ticket tracker for the requester's email address.</p>
                    </label>

                    <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                      <span className="text-sm font-semibold text-slate-900">Internal note</span>
                      <textarea
                        value={ticketDraft.admin_note ?? ''}
                        onChange={(event) => setTicketDraft((current) => ({ ...current, admin_note: event.target.value }))}
                        rows={8}
                        className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                        placeholder="Record next actions, follow-ups, or resolution notes."
                      />
                    </label>

                    <button type="button" onClick={saveTicket} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                      <Save className="mr-2 inline h-4 w-4" /> Save ticket
                    </button>
                  </div>
                ) : (
                  <div className="rounded-[26px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm text-slate-500">No support ticket matches the current filters.</div>
                )}
              </div>
            </div>
          </PanelShell>
        ) : null}

        {activeTab === 'monetization' ? (
          <PanelShell
            title="Monetization reporting"
            description="Inspect recent entitlements and Stripe checkout sessions without leaving the admin panel. This is read-only reporting for support and operations."
            actions={[
              <button key="refresh" type="button" onClick={loadDashboard} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                <RefreshCw className="mr-2 inline h-4 w-4" /> Refresh reporting
              </button>,
            ]}
          >
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Purchases</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{monetizationSummary.purchases}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active purchases</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{monetizationSummary.activePurchases}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Checkout sessions</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{monetizationSummary.checkoutSessions}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Completed sessions</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{monetizationSummary.completedSessions}</p>
                </div>
              </div>

              <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                <span className="text-sm font-semibold text-slate-900">Search monetization records</span>
                <input
                  type="text"
                  value={monetizationSearch}
                  onChange={(event) => setMonetizationSearch(event.target.value)}
                  className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Email, product slug, session id"
                />
              </label>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="space-y-3 rounded-[26px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Purchase ledger</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Recent entitlements</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">{filteredPurchases.length}</span>
                  </div>
                  <div className="space-y-3">
                    {filteredPurchases.map((row) => (
                      <article key={`purchase-${row.id}`} className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{row.product_name || row.product_slug}</p>
                            <p className="mt-1 text-sm text-slate-600">{row.user_email || 'No email'} · {row.product_slug}</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">{row.status}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-white px-2.5 py-1">source {row.source}</span>
                          <span className="rounded-full bg-white px-2.5 py-1">category {row.product_category}</span>
                          <span className="rounded-full bg-white px-2.5 py-1">granted {formatDateTime(row.granted_at)}</span>
                          <span className="rounded-full bg-white px-2.5 py-1">expires {formatDateTime(row.expires_at)}</span>
                        </div>
                      </article>
                    ))}
                    {filteredPurchases.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">No purchases match the current search.</div>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-3 rounded-[26px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Stripe checkout</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Recent sessions</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">{filteredCheckoutSessions.length}</span>
                  </div>
                  <div className="space-y-3">
                    {filteredCheckoutSessions.map((row) => (
                      <article key={`session-${row.id}`} className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{row.product_slug}</p>
                            <p className="mt-1 break-all text-sm text-slate-600">{row.stripe_session_id}</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">{row.status}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-white px-2.5 py-1">user {row.user_email || 'No email'}</span>
                          <span className="rounded-full bg-white px-2.5 py-1">amount {(Number(row.amount_cents ?? 0) / 100).toFixed(2)} {String(row.currency ?? 'usd').toUpperCase()}</span>
                          <span className="rounded-full bg-white px-2.5 py-1">created {formatDateTime(row.created_at)}</span>
                          <span className="rounded-full bg-white px-2.5 py-1">completed {formatDateTime(row.completed_at)}</span>
                        </div>
                      </article>
                    ))}
                    {filteredCheckoutSessions.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">No checkout sessions match the current search.</div>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          </PanelShell>
        ) : null}

        {activeTab === 'users' ? (
          <PanelShell
            title="Admin users"
            description="Grant or revoke admin access from the panel by managing the users.role field, without hand-editing the database. Configured ADMIN_EMAILS entries stay admin until removed from the environment."
            actions={[
              <button key="new" type="button" onClick={newManagedUser} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                <Plus className="mr-2 inline h-4 w-4" /> New user
              </button>,
              <button key="save" type="button" onClick={saveManagedUser} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                <Save className="mr-2 inline h-4 w-4" /> Save access
              </button>,
            ]}
          >
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Users</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{users.length}</p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Admins</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{users.filter((user) => isAdminRole(user.effective_role)).length}</p>
                  </div>
                </div>

                <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <span className="text-sm font-semibold text-slate-900">Search users</span>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Email, username, locale"
                  />
                </label>

                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setManagedUserId(user.id)}
                      className={[
                        'w-full rounded-[22px] border px-4 py-4 text-left transition',
                        managedUserDraft?.id === user.id ? 'border-[#ff8b26] bg-[#fff7ed]' : 'border-slate-200 bg-white',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{user.username || user.email}</p>
                          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                        </div>
                        <span
                          className={[
                            'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                            isAdminRole(user.effective_role) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                          ].join(' ')}
                        >
                          {user.effective_role}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">locale {user.locale || 'n/a'}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">xp {user.xp ?? 0}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">streak {user.streak ?? 0}</span>
                        {user.is_configured_admin ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">configured admin</span> : null}
                      </div>
                    </button>
                  ))}
                  {filteredUsers.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">No users match the current search.</div>
                  ) : null}
                </div>
              </div>

              <div>
                {managedUserDraft ? (
                  <div className="space-y-5 rounded-[26px] border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{managedUserDraft.id ? 'User access editor' : 'Create user access'}</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{managedUserDraft.username || managedUserDraft.email || 'New user'}</h3>
                        <p className="mt-2 text-sm text-slate-600">Use this panel to create a user record or change whether an existing account is an admin or learner.</p>
                      </div>
                      <Users className="h-5 w-5 text-[#ff8b26]" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <span className="text-sm font-semibold text-slate-900">Username</span>
                        <input
                          type="text"
                          value={managedUserDraft.username}
                          onChange={(event) => setManagedUserDraft((current) => ({ ...current, username: event.target.value }))}
                          className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <span className="text-sm font-semibold text-slate-900">Email</span>
                        <input
                          type="email"
                          value={managedUserDraft.email}
                          onChange={(event) => setManagedUserDraft((current) => ({ ...current, email: event.target.value }))}
                          readOnly={Boolean(managedUserDraft.id)}
                          className={[
                            'mt-2 w-full rounded-[14px] border px-3 py-2 text-sm',
                            managedUserDraft.id ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-200 bg-white text-slate-900',
                          ].join(' ')}
                          placeholder="name@example.com"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <span className="text-sm font-semibold text-slate-900">Role</span>
                        <select
                          value={managedUserDraft.role}
                          onChange={(event) => setManagedUserDraft((current) => ({ ...current, role: event.target.value }))}
                          disabled={managedUserDraft.is_configured_admin}
                          className={[
                            'mt-2 w-full rounded-[14px] border px-3 py-2 text-sm',
                            managedUserDraft.is_configured_admin ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-200 bg-white text-slate-900',
                          ].join(' ')}
                        >
                          {USER_ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </label>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-sm font-semibold text-slate-900">Effective access</p>
                        <div className="mt-2 flex items-center gap-3">
                          <span
                            className={[
                              'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                              isAdminRole(managedUserDraft.role) || managedUserDraft.is_configured_admin ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                            ].join(' ')}
                          >
                            {managedUserDraft.is_configured_admin ? USER_ROLE_ADMIN : managedUserDraft.role}
                          </span>
                          <p className="text-xs text-slate-500">
                            {managedUserDraft.is_configured_admin
                              ? 'Pinned by ADMIN_EMAILS and cannot be demoted from this screen.'
                              : 'Saved into users.role and enforced by the admin API.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Locale</p>
                        <p className="mt-2 text-sm text-slate-700">{managedUserDraft.locale || 'N/A'}</p>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">CEFR</p>
                        <p className="mt-2 text-sm text-slate-700">{managedUserDraft.cefr_level || 'N/A'}</p>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">XP / streak</p>
                        <p className="mt-2 text-sm text-slate-700">{managedUserDraft.xp ?? 0} / {managedUserDraft.streak ?? 0}</p>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Last active</p>
                        <p className="mt-2 text-sm text-slate-700">{formatDateTime(managedUserDraft.last_active)}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Created</p>
                        <p className="mt-2 text-sm text-slate-700">{formatDateTime(managedUserDraft.created_at)}</p>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Guidance</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Create a record for a new email, save it as admin, and the same address will be recognized by the admin APIs the next time that user is loaded by the app.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[26px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm text-slate-500">No user is selected. Pick a user from the list or create a new one.</div>
                )}
              </div>
            </div>
          </PanelShell>
        ) : null}
      </div>
    </main>
  );
}