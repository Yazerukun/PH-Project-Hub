import { useCallback, useEffect, useState } from 'react';
import { detectCountry, countryFlagUrl } from '../lib/country';

interface CountryFlag {
  code: string;
  flagUrl: string;
}

export function useCountryFlag(): CountryFlag {
  const [flag, setFlag] = useState<CountryFlag>(() => {
    const code = 'PH';
    return { code, flagUrl: countryFlagUrl(code) };
  });
  const getFlag = useCallback(async () => {
    const code = await detectCountry();
    setFlag({ code, flagUrl: countryFlagUrl(code) });
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    const refresh = () => {
      void getFlag().then(() => {
        if (!alive) return;
        if (timer !== undefined) {
          window.clearInterval(timer);
        }
        timer = window.setInterval(refresh, 300000);
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onFocus = () => refresh();

    refresh();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      alive = false;
      if (timer !== undefined) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [getFlag]);

  return flag;
}