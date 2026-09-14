import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export type AppSettings = {
  /** Tema do app: segue o sistema ou força claro/escuro. */
  theme: ThemeMode;
  /** Mantém a tela ligada enquanto lê. */
  keepAwake: boolean;
  /** OCR automático em páginas sem camada de texto (busca mais lenta na 1ª vez). */
  ocr: boolean;
  /** Pede confirmação antes de abrir link externo de um PDF. */
  confirmLinks: boolean;
  /** Retoma o último documento aberto ao iniciar o app. */
  resumeLast: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  keepAwake: true,
  ocr: true,
  confirmLinks: true,
  resumeLast: false,
};

const KEY = '@leitor-pdf/settings';

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let chain: Promise<unknown> = Promise.resolve();

export function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const op = async () => {
    const next = { ...(await loadSettings()), ...patch };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  };
  const next = chain.then(op, op);
  chain = next.catch(() => undefined);
  return next;
}

/** Aplica o tema no RN inteiro (useColorScheme, diálogos nativos). `system` volta a seguir o SO. */
export function applyTheme(mode: ThemeMode): void {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

type Ctx = {
  settings: AppSettings;
  ready: boolean;
  update: (patch: Partial<AppSettings>) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSettings().then((s) => {
      if (!alive) return;
      applyTheme(s.theme);
      setSettings(s);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    if (patch.theme) applyTheme(patch.theme);
    setSettings((s) => ({ ...s, ...patch }));
    saveSettings(patch);
  }, []);

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return React.createElement(SettingsContext.Provider, { value }, children);
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('SettingsProvider ausente');
  return ctx;
}
