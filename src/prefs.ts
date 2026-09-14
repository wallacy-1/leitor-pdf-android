import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** 0 = largura, 1 = altura, 2 = página inteira (react-native-pdf fitPolicy). */
export type FitPolicy = 0 | 1 | 2;

export type ReaderPrefs = {
  horizontal: boolean;
  night: boolean;
  fitPolicy: FitPolicy;
};

const KEY = '@leitor-pdf/prefs';

export const DEFAULT_PREFS: ReaderPrefs = { horizontal: false, night: false, fitPolicy: 2 };

export async function loadPrefs(): Promise<ReaderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ReaderPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

// Leitura-modificação-escrita serializada (dois toggles rápidos não se sobrescrevem).
let chain: Promise<unknown> = Promise.resolve();

export function savePrefs(patch: Partial<ReaderPrefs>): Promise<ReaderPrefs> {
  const op = async () => {
    const next = { ...(await loadPrefs()), ...patch };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  };
  const next = chain.then(op, op);
  chain = next.catch(() => undefined);
  return next;
}

/** Preferências de leitura carregadas do disco; `update` aplica e persiste um patch. */
export function useReaderPrefs(): {
  prefs: ReaderPrefs;
  ready: boolean;
  update: (patch: Partial<ReaderPrefs>) => void;
  reload: () => void;
} {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadPrefs().then((p) => {
      if (!alive) return;
      setPrefs(p);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const update = useCallback((patch: Partial<ReaderPrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    savePrefs(patch);
  }, []);
  const reload = useCallback(() => {
    loadPrefs().then(setPrefs);
  }, []);
  return { prefs, ready, update, reload };
}
