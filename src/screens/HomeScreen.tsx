import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ActionSheet from '../components/ActionSheet';
import { usePdfEngine } from '../components/PdfEngine';
import PromptModal from '../components/PromptModal';
import RecentItem from '../components/RecentItem';
import SettingsScreen from './SettingsScreen';
import {
  generateThumbnail,
  generateThumbnailViaEngine,
  importPdf,
  importPdfFromUrl,
  loadRecents,
  mutateRecents,
  removeDocFiles,
  renameDoc,
  updateDoc,
} from '../storage';
import { useTheme } from '../theme';
import { PdfDoc, SortMode } from '../types';

type Props = {
  onOpen: (doc: PdfDoc) => void;
  refreshKey: number;
};

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'recent', label: 'Recentes' },
  { key: 'name', label: 'Nome' },
  { key: 'added', label: 'Adicionado' },
];

export default function HomeScreen({ onOpen, refreshKey }: Props) {
  const t = useTheme();
  const engine = usePdfEngine();
  const [docs, setDocs] = useState<PdfDoc[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [menuDoc, setMenuDoc] = useState<PdfDoc | null>(null);
  const [renameDocTarget, setRenameDocTarget] = useState<PdfDoc | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    loadRecents().then(setDocs);
  }, [refreshKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? docs.filter((d) => d.name.toLowerCase().includes(q)) : docs.slice();
    filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      if (sort === 'added') return b.addedAt - a.addedAt;
      return b.openedAt - a.openedAt;
    });
    return filtered;
  }, [docs, query, sort]);

  const makeThumb = useCallback(
    async (doc: PdfDoc) => {
      const thumbUri =
        (await generateThumbnail(doc)) ?? (await generateThumbnailViaEngine(engine, doc));
      if (thumbUri) setDocs(await updateDoc(doc.id, { thumbUri }));
    },
    [engine],
  );

  /** Adiciona vários; abre o primeiro. Miniaturas em background. */
  const addAll = useCallback(
    async (added: PdfDoc[]) => {
      if (!added.length) return;
      const next = await mutateRecents((docs) => [...added, ...docs]);
      setDocs(next);
      onOpen(added[0]);
      for (const d of added) await makeThumb(d);
    },
    [onOpen, makeThumb],
  );

  const pick = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const added: PdfDoc[] = [];
    const failed: string[] = [];
    for (const asset of result.assets) {
      try {
        added.push(await importPdf(asset.uri, asset.name, asset.size));
      } catch {
        failed.push(asset.name);
      } finally {
        // O picker já copiou para o cache; depois da nossa cópia esse arquivo só ocupa espaço.
        try {
          const tmp = new File(asset.uri);
          if (tmp.exists) tmp.delete();
        } catch {
          // ignora
        }
      }
    }
    if (failed.length) Alert.alert('Erro', `Não foi possível importar: ${failed.join(', ')}`);
    await addAll(added);
  }, [addAll]);

  const openUrl = useCallback(
    async (url: string) => {
      const u = url.trim();
      if (!/^https:\/\//i.test(u)) {
        Alert.alert(
          'URL inválida',
          'Use um endereço começando com https:// (http sem TLS não é aceito).',
        );
        return;
      }
      setBusy('Baixando…');
      try {
        await addAll([await importPdfFromUrl(u)]);
      } catch (e) {
        Alert.alert('Erro', `Não foi possível baixar o PDF.\n${String(e)}`);
      } finally {
        setBusy(null);
      }
    },
    [addAll],
  );

  const print = useCallback(async (doc: PdfDoc) => {
    try {
      await Print.printAsync({ uri: doc.uri });
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      if (!/cancel/i.test(msg)) Alert.alert('Imprimir', msg);
    }
  }, []);

  const remove = useCallback((doc: PdfDoc) => {
    Alert.alert('Remover', `Remover "${doc.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          removeDocFiles(doc);
          setDocs(await mutateRecents((docs) => docs.filter((d) => d.id !== doc.id)));
        },
      },
    ]);
  }, []);

  const share = useCallback(async (doc: PdfDoc) => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Compartilhar', 'Compartilhamento indisponível neste dispositivo.');
      return;
    }
    await Sharing.shareAsync(doc.uri, { mimeType: 'application/pdf', dialogTitle: doc.name });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.text }]}>Leitor PDF</Text>
        <Pressable
          onPress={() => setSettingsOpen(true)}
          hitSlop={10}
          style={styles.gear}
          accessibilityRole="button"
          accessibilityLabel="Configurações"
        >
          <Text style={[styles.gearText, { color: t.textMuted }]}>⚙</Text>
        </Pressable>
      </View>
      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: t.primary },
            pressed && styles.pressed,
          ]}
          onPress={pick}
          accessibilityRole="button"
          accessibilityLabel="Abrir PDF do dispositivo"
        >
          <Text style={styles.buttonText}>Abrir PDF</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonSecondary,
            { borderColor: t.primary },
            pressed && styles.pressed,
          ]}
          onPress={() => setUrlOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Abrir PDF por URL"
        >
          <Text style={[styles.buttonText, { color: t.primary }]}>Por URL</Text>
        </Pressable>
      </View>
      {busy && <Text style={[styles.busy, { color: t.textMuted }]}>{busy}</Text>}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar nos recentes…"
        placeholderTextColor={t.textMuted}
        style={[
          styles.search,
          { backgroundColor: t.inputBg, color: t.text, borderColor: t.border },
        ]}
        clearButtonMode="while-editing"
      />

      <View style={styles.sortRow}>
        {SORTS.map((s) => {
          const active = s.key === sort;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSort(s.key)}
              style={[
                styles.chip,
                {
                  borderColor: active ? t.primary : t.border,
                  backgroundColor: active ? t.primary : 'transparent',
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? '#fff' : t.textMuted }]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <RecentItem doc={item} onOpen={onOpen} onMenu={setMenuDoc} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: t.textMuted }]}>
            {docs.length ? 'Nenhum resultado.' : 'Nenhum PDF ainda. Toque em "Abrir PDF".'}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      />

      <ActionSheet
        visible={!!menuDoc}
        title={menuDoc?.name}
        onClose={() => setMenuDoc(null)}
        actions={
          menuDoc
            ? [
                { label: 'Abrir', onPress: () => onOpen(menuDoc) },
                { label: 'Renomear…', onPress: () => setRenameDocTarget(menuDoc) },
                { label: 'Compartilhar', onPress: () => share(menuDoc) },
                { label: 'Imprimir', onPress: () => print(menuDoc) },
                { label: 'Remover', destructive: true, onPress: () => remove(menuDoc) },
              ]
            : []
        }
      />

      <PromptModal
        visible={!!renameDocTarget}
        title="Renomear"
        initialValue={renameDocTarget?.name ?? ''}
        selectAll
        confirmLabel="Salvar"
        onCancel={() => setRenameDocTarget(null)}
        onConfirm={async (v) => {
          const target = renameDocTarget;
          setRenameDocTarget(null);
          if (target && v.trim()) setDocs(await renameDoc(target.id, v));
        }}
      />

      <SettingsScreen
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDataChanged={() => loadRecents().then(setDocs)}
      />

      <PromptModal
        visible={urlOpen}
        title="Abrir por URL"
        message="Endereço direto de um arquivo PDF."
        placeholder="https://exemplo.com/arquivo.pdf"
        keyboardType="url"
        confirmLabel="Baixar"
        onCancel={() => setUrlOpen(false)}
        onConfirm={(v) => {
          setUrlOpen(false);
          openUrl(v);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', flex: 1 },
  gear: { padding: 6 },
  gearText: { fontSize: 26 },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  button: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonSecondary: {
    flex: 0,
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  busy: { fontSize: 13, marginBottom: 8, textAlign: 'center' },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    marginBottom: 10,
  },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 32 },
});
