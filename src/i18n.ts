// Lightweight message catalogue (§11.8). Ships en, en-IN, en-US, hi, gu for the app
// chrome; region-specific calculator terminology is handled per-field via labelByRegion.
// t(key, locale) falls back locale → base language → 'en' → the key itself.

type Dict = Record<string, string>;

const en: Dict = {
  'app.tagline': 'Financial calculators for India & the US',
  'nav.search': 'Search calculators…',
  'nav.settings': 'Settings',
  'nav.history': 'History',
  'action.save': 'Save',
  'action.export': 'Export',
  'action.share': 'Share',
  'action.print': 'Print',
  'palette.title': 'Search calculators and actions',
  'palette.empty': 'No matches',
  'history.empty': 'No saved calculations yet.',
  'settings.title': 'Settings',
  'disclaimer.default':
    'Indicative figures for planning only. Your provider’s calculation may differ due to rounding, day-count conventions, fees, and taxes. This is not financial advice.',
};

const hi: Dict = {
  'app.tagline': 'भारत और अमेरिका के लिए वित्तीय कैलकुलेटर',
  'nav.search': 'कैलकुलेटर खोजें…',
  'nav.settings': 'सेटिंग्स',
  'nav.history': 'इतिहास',
  'action.save': 'सहेजें',
  'action.export': 'निर्यात',
  'action.share': 'साझा करें',
  'action.print': 'प्रिंट',
  'palette.empty': 'कोई मिलान नहीं',
  'history.empty': 'अभी तक कोई सहेजी गई गणना नहीं।',
  'settings.title': 'सेटिंग्स',
};

const gu: Dict = {
  'app.tagline': 'ભારત અને યુએસ માટે નાણાકીય કેલ્ક્યુલેટર',
  'nav.search': 'કેલ્ક્યુલેટર શોધો…',
  'nav.settings': 'સેટિંગ્સ',
  'nav.history': 'ઇતિહાસ',
  'action.save': 'સાચવો',
  'action.export': 'નિકાસ',
  'action.share': 'શેર કરો',
  'action.print': 'પ્રિન્ટ',
  'settings.title': 'સેટિંગ્સ',
};

const CATALOGUES: Record<string, Dict> = {
  en,
  'en-IN': en,
  'en-US': en,
  hi,
  'hi-IN': hi,
  gu,
  'gu-IN': gu,
};

export function t(key: string, locale = 'en'): string {
  const base = locale.split('-')[0]!;
  return CATALOGUES[locale]?.[key] ?? CATALOGUES[base]?.[key] ?? en[key] ?? key;
}
