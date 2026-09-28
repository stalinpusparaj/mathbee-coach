import { useCallback } from 'react';
import type { Msg } from '../engine/types';
import { t, type Lang } from './i18n';
import { useStore } from '../app/store';

export function useLang(): Lang {
  return useStore((s) => s.app.profiles.find((p) => p.id === s.app.activeProfileId)?.language ?? 'en');
}

export function useT() {
  const lang = useLang();
  return useCallback((m: Msg | string, p?: Msg['p']) => t(m, lang, p), [lang]);
}
