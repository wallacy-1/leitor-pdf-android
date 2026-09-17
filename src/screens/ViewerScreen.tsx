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
import ActionSheet, { SheetAction, SheetTile } from '../components/ActionSheet';
import BookmarksModal from '../components/BookmarksModal';
import OutlineModal from '../components/OutlineModal';
import PagesGrid from '../components/PagesGrid';
import { PdfLink, usePdfEngine } from '../components/PdfEngine';
import PromptModal from '../components/PromptModal';
import SearchModal from '../components/SearchModal';
import { useToast } from '../components/Toast';
import { IconButton } from '../components/ui';
import { formatSize } from '../components/RecentItem';
import { FitPolicy, useReaderPrefs } from '../prefs';
import { useSettings } from '../settings';
import { fonts, useTheme } from '../theme';
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
  2: 'página',
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
  const toast = useToast();

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
  const [linkToOpen, setLinkToOpen] = useState<string | null>(null);

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
    const had = bookmarks.includes(page);
    const next = had
      ? bookmarks.filter((b) => b !== page)
      : [...bookmarks, page].sort((a, b) => a - b);
    setBookmarks(next);
    onBookmarksChange(next);
    toast(had ? `Marcador removido da pág. ${page}` : `Pág. ${page} marcada`);
  }, [page, bookmarks, onBookmarksChange, toast]);

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
      setLinkToOpen(url);
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

  const menuTiles = useMemo<SheetTile[]>(
    () => [
      { label: 'Buscar', icon: 'search', onPress: () => setSearchOpen(true) },
      { label: 'Sumário', icon: 'list', onPress: () => setOutlineOpen(true) },
      { label: 'Páginas', icon: 'grid', onPress: () => setGridOpen(true) },
      {
        label: bookmarks.length ? `Marcadores (${bookmarks.length})` : 'Marcadores',
        icon: 'bookmark',
        onPress: () => setBookmarksOpen(true),
      },
    ],
    [bookmarks.length],
  );

  const menuActions = useMemo<SheetAction[]>(
    () => [
      {
        label: 'Ir para página',
        icon: 'hash',
        value: `${page} / ${total || '?'}`,
        onPress: () => setGotoOpen(true),
      },
      {
        label: 'Rolagem',
        icon: 'scroll',
        value: prefs.horizontal ? 'horizontal' : 'vertical',
        onPress: () => {
          updatePrefs({ horizontal: !prefs.horizontal });
          toast(`Rolagem ${prefs.horizontal ? 'vertical contínua' : 'horizontal paginada'}`);
        },
      },
      {
        label: 'Ajustar',
        icon: 'fit',
        value: FIT_LABEL[prefs.fitPolicy],
        onPress: () => {
          updatePrefs({ fitPolicy: nextFit });
          toast(`Ajustar à ${FIT_LABEL[nextFit]}`);
        },
      },
      {
        label: 'Modo noturno',
        icon: 'moon',
        value: prefs.night ? 'ligado' : 'desligado',
        onPress: () => {
          updatePrefs({ night: !prefs.night });
          toast(`Modo noturno ${prefs.night ? 'desligado' : 'ligado'}`);
        },
      },
      { label: 'Imprimir', icon: 'print', onPress: print },
      { label: 'Compartilhar', icon: 'share', onPress: share },
    ],
    [page, total, prefs, nextFit, updatePrefs, print, share, toast],
  );

  return (
    <View style={[styles.container, { backgroundColor: prefs.night ? '#000' : t.readerBg }]}>
      <StatusBar
        hidden={!chrome}
        barStyle={t.dark ? 'light-content' : 'dark-content'}
        backgroundColor={t.bg}
      />

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
            style={[styles.pdf, { width, backgroundColor: 'transparent' }]}
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
          <View style={[styles.loading, { backgroundColor: t.bg }]}>
            <ActivityIndicator size="large" color={t.accent} />
            <Text style={[styles.loadingText, { color: t.neutral[700] }]}>Abrindo documento…</Text>
          </View>
        )}
      </View>

      {chrome && (
        <View style={[styles.header, { backgroundColor: t.bg, borderBottomColor: t.divider }]}>
          <IconButton icon="back" size={46} onPress={onBack} label="Voltar para a lista" />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
              {doc.name}
            </Text>
            <Text style={[styles.headerSub, { color: t.neutral[700] }]} numberOfLines={1}>
              {doc.protected ? 'protegido · ' : ''}
              {formatSize(doc.size)}
            </Text>
          </View>
          <IconButton
            icon="bookmark"
            size={46}
            filled={isBookmarked}
            color={isBookmarked ? t.accentRamp[700] : t.text}
            bg={isBookmarked ? t.accentRamp[200] : undefined}
            onPress={toggleBookmark}
            label={isBookmarked ? 'Remover marcador' : 'Marcar página'}
          />
          <IconButton icon="more" size={46} onPress={() => setMenu(true)} label="Menu de ações" />
        </View>
      )}

      {chrome && (
        <View style={styles.footer} pointerEvents="box-none">
          <Pressable
            onPress={() => setGotoOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Ir para página"
            style={[styles.counter, { backgroundColor: t.neutral[900] }]}
          >
            <Text style={[styles.counterText, { color: t.neutral[100] }]}>
              {sliderPage ?? page} / {total || '?'}
            </Text>
          </Pressable>
          <View style={[styles.navBar, { backgroundColor: t.bg }]}>
            <IconButton
              icon="chevronLeft"
              onPress={() => goTo(page - 1)}
              disabled={atStart}
              label="Página anterior"
            />
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={Math.max(total, 1)}
              step={1}
              value={page}
              disabled={!total}
              minimumTrackTintColor={t.accent}
              maximumTrackTintColor={t.neutral[300]}
              thumbTintColor={t.accent}
              onValueChange={(v) => setSliderPage(Math.round(v))}
              onSlidingComplete={(v) => {
                setSliderPage(null);
                goTo(Math.round(v));
              }}
              accessibilityLabel="Navegar por página"
            />
            <IconButton
              icon="chevronRight"
              onPress={() => goTo(page + 1)}
              disabled={atEnd}
              label="Próxima página"
            />
          </View>
        </View>
      )}

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        tiles={menuTiles}
        actions={menuActions}
      />

      <PromptModal
        visible={gotoOpen}
        title="Ir para página"
        message={total ? `Digite um número entre 1 e ${total}.` : undefined}
        keyboardType="number-pad"
        placeholder={total ? `1 – ${total}` : String(page)}
        confirmLabel="Ir"
        validate={(v) => {
          const n = parseInt(v, 10);
          if (Number.isNaN(n) || n < 1 || (total && n > total)) {
            return `Fora do intervalo: use 1 a ${total || '?'}.`;
          }
          return undefined;
        }}
        onCancel={() => setGotoOpen(false)}
        onConfirm={(v) => {
          setGotoOpen(false);
          goTo(parseInt(v, 10));
        }}
      />

      <PromptModal
        visible={askPassword}
        title="Documento protegido"
        message="Este PDF pede senha. Ela fica só na memória enquanto o documento estiver aberto e nada é gravado em disco."
        placeholder="Senha"
        secure
        confirmLabel="Abrir"
        note={password ? 'Senha incorreta. Tente de novo.' : undefined}
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

      <PromptModal
        visible={!!linkToOpen}
        noField
        title="Sair do app?"
        message={`O PDF aponta para ${linkToOpen ?? ''} — abrir no navegador?`}
        confirmLabel="Abrir"
        onCancel={() => setLinkToOpen(null)}
        onConfirm={() => {
          const url = linkToOpen;
          setLinkToOpen(null);
          if (url) Linking.openURL(url).catch(() => Alert.alert('Link', 'Não foi possível abrir.'));
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
        onOpenGrid={() => {
          setOutlineOpen(false);
          setGridOpen(true);
        }}
        onClose={() => setOutlineOpen(false)}
      />

      <BookmarksModal
        visible={bookmarksOpen}
        doc={doc}
        password={password}
        bookmarks={bookmarks}
        onSelect={goToAfterModal}
        onRemove={(p) => {
          const next = bookmarks.filter((b) => b !== p);
          setBookmarks(next);
          onBookmarksChange(next);
          toast('Marcador removido');
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
  pdf: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { fontFamily: fonts.body, fontSize: 13.5 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    opacity: 0.96,
  },
  headerText: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  headerTitle: { fontFamily: fonts.bodySemi, fontSize: 14 },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5 },
  footer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    alignItems: 'center',
    gap: 10,
  },
  counter: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  counterText: { fontFamily: fonts.heading, fontSize: 13 },
  navBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    elevation: 4,
    opacity: 0.97,
  },
  slider: { flex: 1, height: 44 },
});
