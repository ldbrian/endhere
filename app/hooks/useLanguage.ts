import { useState, useEffect } from 'react';
import { EN, CN, LangDict } from '../lib/lang';

export function useLanguage(): LangDict {
  const [lang, setLang] = useState<LangDict>(CN);

  useEffect(() => {
    const isEnglish = window.location.hostname.includes('en.') ||
                      window.location.hostname.includes('nightshift');
    setLang(isEnglish ? EN : CN);
  }, []);

  return lang;
}
