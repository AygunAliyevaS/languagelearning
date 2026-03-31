import { Link } from 'react-router';
import { useI18n } from '@/lib/language-context';

export function PrivacyLink({ className = "" }) {
  const { t } = useI18n();

  return (
    <Link 
      to="/privacy/policy" 
      className={`text-blue-600 hover:text-blue-800 underline ${className}`}
    >
      {t('common.privacyPolicy')}
    </Link>
  );
}

export function FooterWithPrivacy({ className = "" }) {
  const { t } = useI18n();

  return (
    <footer className={`border-t mt-auto py-4 px-4 text-sm text-gray-600 ${className}`}>
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-4">
          <PrivacyLink />
          <span>•</span>
          <a href="mailto:support@languagelearning.app" className="hover:text-gray-900">
            {t('common.contactSupport')}
          </a>
        </div>
        <div className="text-xs">
          © {new Date().getFullYear()} {t('common.appName')}. {t('common.allRightsReserved')}
        </div>
      </div>
    </footer>
  );
}
