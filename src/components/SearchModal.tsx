import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePdfEngine } from './PdfEngine';
import ScreenModal from './ScreenModal';
import { getDocText, IndexProgress, searchTexts } from '../textIndex';
import { useSettings } from '../settings';
import { useTheme } from '../theme';
import { PdfDoc, SearchHit } from '../types';

type Props = {
  visible: boolean;
  doc: PdfDoc;
  password?: string;
  onSelect: (page: number) => void;
  onClose: () => void;
};

const describe = (p: IndexProgress) =>
  p.phase === 'extract'
    ? `Extraindo texto… ${p.page}/${p.total}`
    : `OCR (página sem texto) ${p.done + 1}/${p.total} — pág. ${p.page}`;

/** Busca de texto no documento. Extração (e OCR) roda na primeira busca e fica em memória. */
export default function SearchModal({ visible, doc, password, onSelect, onClose }: Props) {
  const t = useTheme();
  const engine = usePdfEngine();
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const textsRef = useRef<string[] | null>(null);
  const token = useRef(0);

  // Fechar o modal cancela OCR em andamento.
  useEffect(() => {
    if (!visible) token.current += 1;
  }, [visible]);

  const run = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;
    const mine = ++token.current;
    const cancelled = () => token.current !== mine;
    setHits(null);
    setProgress('Buscando…');
    try {
      if (!textsRef.current) {
        textsRef.current = await getDocText(
          engine,
          doc,
          password,
          (p) => {
            if (!cancelled()) setProgress(describe(p));
          },
          cancelled,
          settings.ocr,
        );
      }
      if (cancelled()) return;
      const found = searchTexts(textsRef.current, q);
      setHits(found);
      setProgress(`${found.length} ocorrência(s)`);
    } catch (e) {
      if (cancelled()) return;
      setHits([]);
      setProgress(`Erro: ${(e as Error).message}`);
    }
  }, [query, doc, password, engine, settings.ocr]);

  return (
    <ScreenModal visible={visible} title="Buscar texto" onClose={onClose}>
      <View style={styles.bar}>
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={run}
          returnKeyType="search"
          placeholder="Digite ao menos 2 caracteres"
          placeholderTextColor={t.textMuted}
          accessibilityLabel="Texto a buscar"
          style={[
            styles.input,
            { color: t.text, backgroundColor: t.inputBg, borderColor: t.border },
          ]}
        />
        <Pressable
          onPress={run}
          style={[styles.btn, { backgroundColor: t.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>Buscar</Text>
        </Pressable>
      </View>
      {progress && <Text style={[styles.progress, { color: t.textMuted }]}>{progress}</Text>}
      <FlatList
        data={hits ?? []}
        keyExtractor={(h, i) => `${h.page}-${i}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          hits && hits.length === 0 ? (
            <Text style={[styles.empty, { color: t.textMuted }]}>Nenhuma ocorrência.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { backgroundColor: t.card }]}
            onPress={() => onSelect(item.page)}
            accessibilityRole="button"
          >
            <Text style={[styles.rowPage, { color: t.primary }]}>Página {item.page}</Text>
            <Text style={[styles.rowSnippet, { color: t.text }]} numberOfLines={2}>
              {item.snippet}
            </Text>
          </Pressable>
        )}
      />
    </ScreenModal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', padding: 12, gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  btn: { borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  progress: { paddingHorizontal: 16, fontSize: 13 },
  list: { padding: 16 },
  empty: { textAlign: 'center', marginTop: 32, paddingHorizontal: 24 },
  row: { borderRadius: 10, padding: 14, marginBottom: 8 },
  rowPage: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  rowSnippet: { fontSize: 14 },
});
