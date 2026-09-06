import { useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { usePresence } from '../stores/presence';

const BEAT_MS = 30000;

export function useSitePresence() {
  const token = useAuth((s) => s.token);
  const setSelfOnline = usePresence((s) => s.setSelfOnline);

  useEffect(() => {
    if (!token) {
      setSelfOnline(false);
      return;
    }
    let alive = true;
    let timer: number | undefined;

    const beat = async () => {
      try {
        await api('/api/presence/beat', { method: 'POST' });
        if (alive) setSelfOnline(true);
      } catch {
        if (alive) setSelfOnline(false);
      }
    };

    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        beat();
        if (timer === undefined) timer = window.setInterval(beat, BEAT_MS);
      } else {
        stop();
      }
    };

    beat();
    timer = window.setInterval(beat, BEAT_MS);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      alive = false;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      setSelfOnline(false);
    };
  }, [token, setSelfOnline]);
}