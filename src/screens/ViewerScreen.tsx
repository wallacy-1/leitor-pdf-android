import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Pdf from 'react-native-pdf';
import Slider from '@react-native-community/slider';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ActionSheet from '../components/ActionSheet';
import BookmarksModal from '../components/BookmarksModal';
import OutlineModal from '../components/OutlineModal';
import PagesGrid from '../components/PagesGrid';
import { PdfLink, usePdfEngine } from '../components/PdfEngine';
import PromptModal from '../components/PromptModal';
import SearchModal from '../components/SearchModal';
import { FitPolicy, useReaderPrefs } from '../prefs';
import { useSettings } from '../settings';
import { useTheme } from '../theme';
import { PdfDoc } from '../types';

type Props = {
  doc: PdfDoc;
  onBack: () => void;
  onProgress: (page: number, total: number) => void;
  onBookmarksChange: (bookmarks: number[]) => void;
  /** Chamado quando o viewer descobre a senha de um PDF protegido (miniatura via pdf.js). */
  onUnlocked: (password: string) => void;
  /** Tela cheia (header/rodapé ocultos) — o App remove as safe areas. */
  onChromeChange: (visible: boolean) => void;
};

// Animação do jumpTo nativo dura ~400 ms; margem para eventos atrasados.
const JUMP_WINDOW_MS = 700;

const FIT_LABEL: Record<FitPolicy, string> = {
  0: 'largura',
  1: 'altura',
  2: 'página inteira',
};

export default function ViewerScreen({
  doc,
  onBack,
  onProgress,
  onBookmarksChange,
  onUnlocked,
  onChromeChange,
}: Props) {
  const { settings } = useSettings();
  const t = useTheme();

  useEffect(() => {
    if (!settings.keepAwake) return;
    const tag = 'viewer';
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [settings.keepAwake]);
  const { width } = useWindowDimensions();
  const engine = usePdfEngine();

  const [page, setPage] = useState(doc.lastPage || 1);
  // Prop `page` do <Pdf> só na (re)montagem. Passar o `page` do scroll de volta como prop faz a lib
  // chamar setPage/drawPdf a cada troca de página — a tela "treme" e pula para o topo da página.
  const [initialPage, setInitialPage] = useState(doc.lastPage || 1);
  const [total, setTotal] = useState(doc.totalPages);
  const [loading, setLoading] = useState(true);
  const { prefs, ready: prefsReady, update: updatePrefsRaw } = useReaderPrefs();
  // Rolagem/ajuste remontam o <Pdf> (key): preserva a página atual.
  const updatePrefs = useCallback(
    (patch: Parameters<typeof updatePrefsRaw>[0]) => {
      if (patch.horizontal !== undefined || patch.fitPolicy !== undefined) setInitialPage(page);
      updatePrefsRaw(patch);
    },
    [updatePrefsRaw, page],
  );
  const [chrome, setChrome] = useState(true);
  const [bookmarks, setBookmarks] = useState<number[]>(doc.bookmarks);
  const [password, setPassword] = useState<string | undefined>();
  const [askPassword, setAskPassword] = useState(false);
  const [menu, setMenu] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sliderPage, setSliderPage] = useState<number | null>(null);

  const pdfRef = useRef<React.ComponentRef<typeof Pdf>>(null);
  const linksCache = useRef(new Map<number, PdfLink[]>());

  useEffect(() => {
    onChromeChange(chrome);
  }, [chrome, onChromeChange]);

  const anyModal = searchOpen || bookmarksOpen || outlineOpen || gridOpen || gotoOpen || menu;
  const closeAll = useCallback(() => {
    setSearchOpen(false);
    setBookmarksOpen(false);
    setOutlineOpen(false);
    setGridOpen(false);
    setGotoOpen(false);
    setMenu(false);
  }, []);

  // Botão físico/gesto de voltar: fecha modal aberto, sai da tela cheia, ou volta para a lista.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (anyModal) {
        closeAll();
        return true;
      }
      if (!chrome) {
        setChrome(true);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, anyModal, closeAll, chrome]);

  // Salto programático animado: a lib emite onPageChanged do destino na hora e depois das páginas
  // intermediárias enquanto anima. Durante a janela do salto, só o destino passa (slider não "volta").
  const jumpTarget = useRef<{ page: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const clearJump = useCallback(() => {
    if (jumpTarget.current) clearTimeout(jumpTarget.current.timer);
    jumpTarget.current = null;
  }, []);

  const goTo = useCallback(
    (p: number) => {
      if (p < 1 || (total && p > total)) return;
      clearJump();
      jumpTarget.current = { page: p, timer: setTimeout(clearJump, JUMP_WINDOW_MS) };
      pdfRef.current?.setPage(p);
      setPage(p);
    },
    [total, clearJump],
  );

  // Salto vindo de um Modal full-screen: espera o modal fechar, senão o comando nativo se perde.
  const goToAfterModal = useCallback(
    (p: number) => {
      closeAll();
      setTimeout(() => goTo(p), 350);
    },
    [goTo, closeAll],
  );

  const toggleBookmark = useCallback(() => {
    setBookmarks((prev) => {
      const next = prev.includes(page)
        ? prev.filter((b) => b !== page)
        : [...prev, page].sort((a, b) => a - b);
      onBookmarksChange(next);
      return next;
    });
  }, [page, onBookmarksChange]);

  const share = useCallback(async () => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(doc.uri, { mimeType: 'application/pdf', dialogTitle: doc.name });
    }
  }, [doc]);

  const print = useCallback(async () => {
    try {
      await Print.printAsync({ uri: doc.uri });
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      if (!/cancel/i.test(msg)) Alert.alert('Imprimir', msg);
    }
  }, [doc.uri]);

  // Só esquemas inofensivos: intent://, content://, tel:, sms: etc. vindos de um PDF não são seguidos.
  const openLink = useCallback(
    (url: string) => {
      if (!/^(https?:\/\/|mailto:)/i.test(url)) {
        Alert.alert('Link bloqueado', `Este tipo de link não é aberto pelo app:\n${url}`);
        return;
      }
      const go = () =>
        Linking.openURL(url).catch(() => Alert.alert('Link', 'Não foi possível abrir.'));
      if (!settings.confirmLinks) {
        go();
        return;
      }
      Alert.alert('Abrir link', url, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir', onPress: go },
      ]);
    },
    [settings.confirmLinks],
  );

  // Toque simples: se cair em um link (anotação lida via pdf.js), segue o link; senão alterna tela cheia.
  const onSingleTap = useCallback(
    async (_p: number, _x: number, _y: number, hit?: { nx: number; ny: number; page: number }) => {
      if (hit && hit.nx >= 0 && hit.nx <= 1 && hit.ny >= 0 && hit.ny <= 1) {
        let links = linksCache.current.get(hit.page);
        if (!links) {
          try {
            links = await engine.getLinks(doc.uri, hit.page, password);
          } catch {
            links = [];
          }
          linksCache.current.set(hit.page, links);
        }
        const link = links.find(
          (l) => hit.nx >= l.x0 && hit.nx <= l.x1 && hit.ny >= l.y0 && hit.ny <= l.y1,
        );
        if (link?.url) {
          openLink(link.url);
          return;
        }
        if (link?.page) {
          goTo(link.page);
          return;
        }
      }
      setChrome((c) => !c);
    },
    [engine, doc.uri, password, openLink, goTo],
  );

  const isBookmarked = bookmarks.includes(page);
  const atStart = page <= 1;
  const atEnd = !!total && page >= total;
  const nextFit = ((prefs.fitPolicy + 1) % 3) as FitPolicy;

  const menuActions = useMemo(
    () => [
      { label: 'Ir para página…', onPress: () => setGotoOpen(true) },
      { label: 'Páginas (grade)', onPress: () => setGridOpen(true) },
      { label: 'Sumário', onPress: () => setOutlineOpen(true) },
      { label: 'Buscar texto…', onPress: () => setSearchOpen(true) },
      {
        label: isBookmarked ? 'Remover marcador desta página' : 'Marcar esta página',
        onPress: toggleBookmark,
      },
      { label: `Marcadores (${bookmarks.length})`, onPress: () => setBookmarksOpen(true) },
      {
        label: prefs.horizontal ? 'Rolagem vertical' : 'Rolagem horizontal',
        onPress: () => updatePrefs({ horizontal: !prefs.horizontal }),
      },
      {
        label: `Ajustar à ${FIT_LABEL[nextFit]} (atual: ${FIT_LABEL[prefs.fitPolicy]})`,
        onPress: () => updatePrefs({ fitPolicy: nextFit }),
      },
      {
        label: prefs.night ? 'Desativar modo noturno' : 'Modo noturno',
        onPress: () => updatePrefs({ night: !prefs.night }),
      },
      { label: 'Imprimir', onPress: print },
      { label: 'Compartilhar', onPress: share },
    ],
    [isBookmarked, toggleBookmark, bookmarks.length, prefs, nextFit, updatePrefs, print, share],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: t.dark || prefs.night ? '#000' : '#e5e5e5' }]}
    >
      <StatusBar hidden={!chrome} />
      {chrome && (
        <View style={[styles.header, { backgroundColor: t.primary }]}>
          <Pressable
            onPress={onBack}
            style={styles.headerBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Voltar para a lista"
          >
            <Text style={styles.headerBtnText}>Voltar</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {doc.name}
          </Text>
          <Pressable
            onPress={toggleBookmark}
            style={styles.headerBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remover marcador' : 'Marcar página'}
            accessibilityState={{ selected: isBookmarked }}
          >
            <Text style={[styles.headerBtnText, styles.star]}>{isBookmarked ? '★' : '☆'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setMenu(true)}
            style={styles.headerBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mais opções"
          >
            <Text style={[styles.headerBtnText, styles.dots]}>⋮</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.body}>
        {prefsReady && (
          <Pdf
            key={`${password ?? ''}-${prefs.horizontal}-${prefs.fitPolicy}`}
            ref={pdfRef}
            source={{ uri: doc.uri, cache: false }}
            password={password}
            page={initialPage}
            horizontal={prefs.horizontal}
            enablePaging={prefs.horizontal}
            fitPolicy={prefs.fitPolicy}
            nightMode={prefs.night}
            style={[styles.pdf, { width }]}
            trustAllCerts={false}
            onPageSingleTap={onSingleTap}
            onPressLink={openLink}
            onLoadComplete={(numberOfPages) => {
              setLoading(false);
              setTotal(numberOfPages);
              onProgress(page, numberOfPages);
              if (password) onUnlocked(password);
            }}
            onPageChanged={(p, n) => {
              if (jumpTarget.current && p !== jumpTarget.current.page) return;
              setPage(p);
              setTotal(n);
              onProgress(p, n);
            }}
            onError={(err) => {
              setLoading(false);
              const msg = String((err as Error)?.message ?? err);
              if (/password/i.test(msg)) {
                setAskPassword(true);
                return;
              }
              Alert.alert('Erro ao abrir PDF', msg, [{ text: 'OK', onPress: onBack }]);
            }}
          />
        )}
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={t.primary} />
          </View>
        )}
      </View>

      {chrome && (
        <View style={[styles.footer, { backgroundColor: t.card, borderTopColor: t.border }]}>
          <Pressable
            onPress={() => goTo(page - 1)}
            style={styles.navBtn}
            disabled={atStart}
            accessibilityRole="button"
            accessibilityLabel="Página anterior"
          >
            <Text style={[styles.navText, { color: atStart ? t.border : t.primary }]}>{'<'}</Text>
          </Pressable>
          <View style={styles.sliderWrap}>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={Math.max(total, 1)}
              step={1}
              value={page}
              disabled={!total}
              minimumTrackTintColor={t.primary}
              maximumTrackTintColor={t.border}
              thumbTintColor={t.primary}
              onValueChange={(v) => setSliderPage(Math.round(v))}
              onSlidingComplete={(v) => {
                setSliderPage(null);
                goTo(Math.round(v));
              }}
              accessibilityLabel="Navegar por página"
            />
            <Pressable
              onPress={() => setGotoOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Ir para página"
            >
              <Text style={[styles.pageText, { color: t.text }]}>
                {sliderPage ?? page} / {total || '?'}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => goTo(page + 1)}
            style={styles.navBtn}
            disabled={atEnd}
            accessibilityRole="button"
            accessibilityLabel="Próxima página"
          >
            <Text style={[styles.navText, { color: atEnd ? t.border : t.primary }]}>{'>'}</Text>
          </Pressable>
        </View>
      )}

      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={menuActions} />

      <PromptModal
        visible={gotoOpen}
        title="Ir para página"
        message={total ? `1 – ${total}` : undefined}
        keyboardType="number-pad"
        placeholder={String(page)}
        confirmLabel="Ir"
        onCancel={() => setGotoOpen(false)}
        onConfirm={(v) => {
          const n = parseInt(v, 10);
          setGotoOpen(false);
          if (!Number.isNaN(n)) goTo(n);
        }}
      />

      <PromptModal
        visible={askPassword}
        title="PDF protegido"
        message="Digite a senha do documento."
        secure
        confirmLabel="Abrir"
        onCancel={() => {
          setAskPassword(false);
          onBack();
        }}
        onConfirm={(v) => {
          setAskPassword(false);
          setLoading(true);
          setInitialPage(page);
          setPassword(v);
        }}
      />

      <PagesGrid
        visible={gridOpen}
        doc={doc}
        total={total}
        current={page}
        bookmarks={bookmarks}
        password={password}
        onSelect={goToAfterModal}
        onClose={() => setGridOpen(false)}
      />

      <OutlineModal
        visible={outlineOpen}
        doc={doc}
        password={password}
        onSelect={goToAfterModal}
        onClose={() => setOutlineOpen(false)}
      />

      <BookmarksModal
        visible={bookmarksOpen}
        bookmarks={bookmarks}
        onSelect={goToAfterModal}
        onRemove={(p) => {
          const next = bookmarks.filter((b) => b !== p);
          setBookmarks(next);
          onBookmarksChange(next);
        }}
        onClose={() => setBookmarksOpen(false)}
      />

      <SearchModal
        visible={searchOpen}
        doc={doc}
        password={password}
        onSelect={goToAfterModal}
        onClose={() => setSearchOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, height: 52 },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 6, minWidth: 48, alignItems: 'center' },
  headerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  star: { fontSize: 22 },
  dots: { fontSize: 22 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  pdf: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  navBtn: { paddingHorizontal: 14, paddingVertical: 4 },
  navText: { fontSize: 26, fontWeight: '700' },
  sliderWrap: { flex: 1, alignItems: 'center' },
  slider: { width: '100%', height: 28 },
  pageText: { fontSize: 13, textAlign: 'center' },
});
