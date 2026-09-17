import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePdfEngine } from './PdfEngine';
import ScreenModal from './ScreenModal';
import { EmptyState, Kicker, PillButton } from './ui';
import { getDocText, IndexProgress, searchTexts } from '../textIndex';
import { useSettings } from '../settings';
import { fonts, useTheme } from '../theme';
import { PdfDoc, SearchHit } from '../types';

type Props = {
  visible: boolean;
  doc: PdfDoc;
  password?: string;
  onSelect: (page: number) => void;
  onClose: () => void;
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'working'; label: string; detail: string; pct: number }
  | { kind: 'done'; hits: SearchHit[]; query: string }
  | { kind: 'error'; message: string };

const describe = (p: IndexProgress): Extract<Phase, { kind: 'working' }> =>
  p.phase === 'extract'
    ? {
        kind: 'working',
        label: 'Extraindo texto do documento',
        detail: `${p.page}/${p.total} páginas · a próxima busca neste documento é instantânea`,
        pct: p.total ? p.page / p.total : 0,
      }
    : {
        kind: 'working',
        label: 'Reconhecendo texto nas páginas escaneadas',
        detail: `OCR ${p.done + 1}/${p.total} — pág. ${p.page} · cerca de 1 s por página`,
        pct: p.total ? p.done / p.total : 0,
      };

/** Busca de texto no documento. Extração (e OCR) roda na primeira busca e fica em memória. */
export default function SearchModal({ visible, doc, password, onSelect, onClose }: Props) {
  const t = useTheme();
  const engine = usePdfEngine();
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [hint, setHint] = useState<string | null>(null);
  const textsRef = useRef<string[] | null>(null);
  const token = useRef(0);

  const cancel = useCallback(() => {
    token.current += 1;
    setPhase({ kind: 'idle' });
  }, []);

  // Fechar o modal cancela OCR em andamento.
  useEffect(() => {
    if (!visible) token.current += 1;
  }, [visible]);

  const run = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) {
      setHint('Digite pelo menos 2 caracteres');
      return;
    }
    setHint(null);
    const mine = ++token.current;
    const cancelled = () => token.current !== mine;
    setPhase({ kind: 'working', label: 'Buscando…', detail: '', pct: 0 });
    try {
      if (!textsRef.current) {
        textsRef.current = await getDocText(
          engine,
          doc,
          password,
          (p) => {
            if (!cancelled()) setPhase(describe(p));
          },
          cancelled,
          settings.ocr,
        );
      }
      if (cancelled()) return;
      setPhase({ kind: 'done', hits: searchTexts(textsRef.current, q), query: q });
    } catch (e) {
      if (cancelled()) return;
      setPhase({ kind: 'error', message: (e as Error).message });
    }
  }, [query, doc, password, engine, settings.ocr]);

  const hits = phase.kind === 'done' ? phase.hits : [];

  return (
    <ScreenModal
      visible={visible}
      title=""
      closeIcon="close"
      onClose={onClose}
      headerRight={
        <>
          <View style={[styles.field, { backgroundColor: t.surface }]}>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={run}
              returnKeyType="search"
              placeholder="Buscar no documento"
              placeholderTextColor={t.neutral[600]}
              accessibilityLabel="Texto a buscar"
              style={[styles.input, { color: t.text }]}
            />
          </View>
          <PillButton
            label="Buscar"
            onPress={run}
            style={styles.runBtn}
            textStyle={styles.runText}
          />
        </>
      }
    >
      <FlatList
        data={hits}
        keyExtractor={(h, i) => `${h.page}-${i}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {hint && <Text style={[styles.hint, { color: t.accentRamp[700] }]}>{hint}</Text>}
            {phase.kind === 'idle' && (
              <EmptyState
                title="Buscar dentro do PDF"
                body={
                  settings.ocr
                    ? 'Mínimo de 2 caracteres. Acentos e maiúsculas são ignorados. Se o documento tiver páginas escaneadas, a primeira busca extrai o texto e reconhece as imagens — depois fica instantâneo.'
                    : 'Mínimo de 2 caracteres. Acentos e maiúsculas são ignorados. A primeira busca extrai o texto do documento — depois fica instantâneo.'
                }
              />
            )}
            {phase.kind === 'working' && (
              <View style={styles.working}>
                <Text style={[styles.workLabel, { color: t.text }]}>{phase.label}</Text>
                <View style={[styles.bar, { backgroundColor: t.neutral[300] }]}>
                  <View
                    style={[
                      styles.barFill,
                      { backgroundColor: t.accent, width: `${Math.round(phase.pct * 100)}%` },
                    ]}
                  />
                </View>
                {phase.detail ? (
                  <Text style={[styles.workDetail, { color: t.neutral[700] }]}>{phase.detail}</Text>
                ) : null}
                <PillButton
                  label="Cancelar"
                  variant="secondary"
                  onPress={cancel}
                  style={styles.cancelBtn}
                  textStyle={styles.runText}
                />
              </View>
            )}
            {phase.kind === 'done' && phase.hits.length > 0 && (
              <Kicker style={styles.resultsLabel}>
                {`${phase.hits.length} ${phase.hits.length === 1 ? 'ocorrência' : 'ocorrências'} de “${phase.query}”`}
              </Kicker>
            )}
            {phase.kind === 'done' && phase.hits.length === 0 && (
              <EmptyState
                title="Nenhuma ocorrência"
                body={`“${phase.query}” não aparece neste documento. O texto já está indexado, então uma nova busca é imediata.`}
              />
            )}
            {phase.kind === 'error' && (
              <EmptyState title="Não deu para buscar" body={phase.message} />
            )}
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.neutral[200] }]}
            onPress={() => onSelect(item.page)}
            accessibilityRole="button"
            accessibilityLabel={`Página ${item.page}: ${item.snippet}`}
          >
            <View style={[styles.pagePill, { backgroundColor: t.accentRamp[200] }]}>
              <Text style={[styles.pageText, { color: t.accentRamp[800] }]}>p. {item.page}</Text>
            </View>
            <Text style={[styles.snippet, { color: t.neutral[800] }]} numberOfLines={3}>
              {item.snippet}
            </Text>
          </Pressable>
        )}
      />
    </ScreenModal>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: { fontFamily: fonts.body, fontSize: 14.5, padding: 0 },
  runBtn: { minHeight: 44, paddingHorizontal: 18 },
  runText: { fontSize: 14 },
  list: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 },
  hint: { fontFamily: fonts.body, fontSize: 12.5, marginBottom: 4 },
  working: { paddingVertical: 24, gap: 14 },
  workLabel: { fontFamily: fonts.bodySemi, fontSize: 15.5 },
  bar: { height: 8, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  workDetail: { fontFamily: fonts.body, fontSize: 12.5 },
  cancelBtn: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 20 },
  resultsLabel: { fontSize: 12, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderRadius: 18,
    minHeight: 56,
  },
  pagePill: {
    minWidth: 46,
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  snippet: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20 },
});
