import { NavLink } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FooterWithPrivacy } from '@/components/PrivacyLink';
import { useI18n } from '@/lib/language-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout({children}) {
  const { language, setLanguage, t, supportedLanguages, isSaving } = useI18n();

  const navigationItems = [
    { to: '/', label: t('common.home') },
    { to: '/lessons', label: t('common.lessons') },
    { to: '/practice', label: t('common.practice') },
    { to: '/progress', label: t('common.progress') },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t('common.appName')}</p>
              <h1 className="text-lg font-semibold text-slate-950">{t('shell.title')}</h1>
              <p className="text-sm text-slate-600">{t('shell.subtitle')}</p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <nav className="flex flex-wrap gap-2">
                {navigationItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-slate-950 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <label className="flex items-center gap-3 text-sm text-slate-600">
                <span>{t('shell.switcherLabel')}</span>
                <select
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  disabled={isSaving}
                >
                  {supportedLanguages.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </header>
        {children}
        <FooterWithPrivacy />
      </div>
    </QueryClientProvider>
  );
}