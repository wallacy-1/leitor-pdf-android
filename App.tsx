import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import { PdfEngineProvider, usePdfEngine } from './src/components/PdfEngine';
import { ToastProvider } from './src/components/Toast';
import HomeScreen from './src/screens/HomeScreen';
import ViewerScreen from './src/screens/ViewerScreen';
import {
  cleanupOcrTemp,
  findDuplicate,
  generateThumbnail,
  generateThumbnailViaEngine,
  importPdf,
  importPdfFromUrl,
  loadRecents,
  mutateRecents,
  removeDocFiles,
  updateDoc,
} from './src/storage';
import { SettingsProvider, useSettings } from './src/settings';
import { useTheme } from './src/theme';
import { PdfDoc } from './src/types';

function isPdfIntent(url: string | null): url is string {
  return !!url && /^(content|file|https):\/\//i.test(url);
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <SafeAreaProvider>
          <PdfEngineProvider>
            <ToastProvider>
              <Main />
            </ToastProvider>
          </PdfEngineProvider>
        </SafeAreaProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

function Main() {
  const t = useTheme();
  const engine = usePdfEngine();
  const { settings, ready: settingsReady } = useSettings();
  const [current, setCurrent] = useState<PdfDoc | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chrome, setChrome] = useState(true);
  // getInitialURL é processado uma vez por montagem; eventos 'url' sempre (reabrir o mesmo
  // arquivo pelo Files precisa funcionar — a dedupe é feita por findDuplicate).
  const initialHandled = useRef(false);

  const openDoc = useCallback(async (doc: PdfDoc) => {
    await updateDoc(doc.id, { openedAt: Date.now() });
    setCurrent(doc);
  }, []);

  // PDF vindo de outro app ("Abrir com"): copia para o app e abre.
  const importFromIntent = useCallback(
    async (url: string) => {
      try {
        const doc = /^https:/i.test(url) ? await importPdfFromUrl(url) : await importPdf(url);
        const recents = await loadRecents();
        // Mesmo arquivo já importado antes: reaproveita (mantém progresso e marcadores).
        const dup = findDuplicate(recents, doc);
        if (dup) {
          removeDocFiles(doc);
          await openDoc(dup);
          return;
        }
        await mutateRecents((docs) => [doc, ...docs]);
        setCurrent(doc);
        const thumbUri =
          (await generateThumbnail(doc)) ?? (await generateThumbnailViaEngine(engine, doc));
        if (thumbUri) await updateDoc(doc.id, { thumbUri });
      } catch (e) {
        Alert.alert('Erro', `Não foi possível abrir o PDF.\n${String(e)}`);
      }
    },
    [openDoc, engine],
  );

  useEffect(() => {
    if (!settingsReady) return;
    cleanupOcrTemp();
    if (!initialHandled.current) {
      initialHandled.current = true;
      Linking.getInitialURL().then(async (url) => {
        if (isPdfIntent(url)) {
          importFromIntent(url);
        } else if (settings.resumeLast) {
          // Sem intent: retoma o último documento aberto, se configurado.
          const [last] = (await loadRecents()).sort((a, b) => b.openedAt - a.openedAt);
          if (last) setCurrent(last);
        }
      });
    }
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isPdfIntent(url)) importFromIntent(url);
    });
    return () => sub.remove();
  }, [importFromIntent, settingsReady, settings.resumeLast]);

  const handleProgress = useCallback(
    (page: number, total: number) => {
      if (current) updateDoc(current.id, { lastPage: page, totalPages: total });
    },
    [current],
  );

  const handleBookmarks = useCallback(
    (bookmarks: number[]) => {
      if (current) updateDoc(current.id, { bookmarks });
    },
    [current],
  );

  // PDF protegido: nada de miniatura em disco; marca o doc para a lista mostrar o cadeado.
  const handleUnlocked = useCallback(() => {
    if (current && !current.protected) updateDoc(current.id, { protected: true });
  }, [current]);

  const handleBack = useCallback(() => {
    setChrome(true);
    setCurrent(null);
    setRefreshKey((k) => k + 1);
  }, []);

  // Sem as configurações o tema ainda não foi aplicado: segura o primeiro frame na cor do splash.
  if (!settingsReady) return <View style={[styles.root, { backgroundColor: t.accentRamp[700] }]} />;

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: chrome ? t.bg : '#000' }]}
      edges={chrome ? ['top', 'bottom'] : []}
    >
      <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      {current ? (
        <ViewerScreen
          key={current.id}
          doc={current}
          onBack={handleBack}
          onProgress={handleProgress}
          onBookmarksChange={handleBookmarks}
          onUnlocked={handleUnlocked}
          onChromeChange={setChrome}
        />
      ) : (
        <HomeScreen onOpen={openDoc} refreshKey={refreshKey} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
