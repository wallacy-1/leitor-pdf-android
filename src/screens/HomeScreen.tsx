import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ActionSheet from '../components/ActionSheet';
import Icon from '../components/Icon';
import { usePdfEngine } from '../components/PdfEngine';
import PromptModal from '../components/PromptModal';
import RecentItem, { progressLabel } from '../components/RecentItem';
import { useToast } from '../components/Toast';
import { IconButton, PillButton } from '../components/ui';
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
import { fonts, useTheme } from '../theme';
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
  const toast = useToast();
  const [docs, setDocs] = useState<PdfDoc[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [menuDoc, setMenuDoc] = useState<PdfDoc | null>(null);
  const [renameDocTarget, setRenameDocTarget] = useState<PdfDoc | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PdfDoc | null>(null);
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

  // "Continuar lendo": o documento aberto por último que já tem progresso.
  const hero = useMemo(
    () =>
      docs
        .filter((d) => d.openedAt > 0 && d.totalPages > 0)
        .sort((a, b) => b.openedAt - a.openedAt)[0] ?? null,
    [docs],
  );

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
      if (added.length > 1) toast(`${added.length} arquivos adicionados · o primeiro abriu`);
      onOpen(added[0]);
      for (const d of added) await makeThumb(d);
    },
    [onOpen, makeThumb, toast],
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
      setBusy('Baixando…');
      toast('Baixando…');
      try {
        await addAll([await importPdfFromUrl(url.trim())]);
      } catch (e) {
        Alert.alert('Erro', `Não foi possível baixar o PDF.\n${String(e)}`);
      } finally {
        setBusy(null);
      }
    },
    [addAll, toast],
  );

  const print = useCallback(async (doc: PdfDoc) => {
    try {
      await Print.printAsync({ uri: doc.uri });
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      if (!/cancel/i.test(msg)) Alert.alert('Imprimir', msg);
    }
  }, []);

  const share = useCallback(async (doc: PdfDoc) => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Compartilhar', 'Compartilhamento indisponível neste dispositivo.');
      return;
    }
    await Sharing.shareAsync(doc.uri, { mimeType: 'application/pdf', dialogTitle: doc.name });
  }, []);

  const empty = docs.length === 0;

  const header = (
    <>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.text }]}>Leitor PDF</Text>
        <IconButton icon="sliders" onPress={() => setSettingsOpen(true)} label="Configurações" />
      </View>

      {hero && !empty && (
        <Pressable
          onPress={() => onOpen(hero)}
          accessibilityRole="button"
          accessibilityLabel={`Continuar lendo ${hero.name}`}
          style={({ pressed }) => [
            styles.hero,
            { backgroundColor: pressed ? t.accent2Ramp[300] : t.accent2Ramp[200] },
          ]}
        >
          <View style={[styles.heroThumb, { backgroundColor: t.neutral[100] }]}>
            {hero.thumbUri ? (
              <Image source={{ uri: hero.thumbUri }} style={styles.heroThumbImg} />
            ) : (
              <Icon name={hero.protected ? 'lock' : 'file'} size={22} color={t.neutral[600]} />
            )}
          </View>
          <View style={styles.heroInfo}>
            <View>
              <Text style={[styles.heroKicker, { color: t.accent2Ramp[700] }]}>
                Continuar lendo
              </Text>
              <Text style={[styles.heroName, { color: t.text }]} numberOfLines={2}>
                {hero.name}
              </Text>
            </View>
            <View>
              <Text style={[styles.heroProgress, { color: t.accent2Ramp[800] }]}>
                {progressLabel(hero)} ·{' '}
                {Math.round((hero.lastPage / Math.max(hero.totalPages, 1)) * 100)}%
              </Text>
              <View style={[styles.heroBar, { backgroundColor: t.accent2Ramp[100] }]}>
                <View
                  style={[
                    styles.heroBarFill,
                    {
                      backgroundColor: t.accent2Ramp[600],
                      width: `${Math.round((hero.lastPage / Math.max(hero.totalPages, 1)) * 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </Pressable>
      )}

      {!empty && (
        <>
          <View style={styles.btnRow}>
            <PillButton label="Abrir PDF" icon="plus" onPress={pick} grow />
            <PillButton
              label="URL"
              icon="download"
              variant="secondary"
              onPress={() => setUrlOpen(true)}
              style={styles.urlBtn}
            />
          </View>
          {busy && <Text style={[styles.busy, { color: t.neutral[700] }]}>{busy}</Text>}

          <View style={[styles.search, { backgroundColor: t.surface }]}>
            <Icon name="search" size={19} color={t.neutral[700]} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nome"
              placeholderTextColor={t.neutral[600]}
              style={[styles.searchInput, { color: t.text }]}
              accessibilityLabel="Buscar por nome"
            />
          </View>

          <View style={styles.sortRow}>
            {SORTS.map((s) => {
              const active = s.key === sort;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setSort(s.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? t.accent : t.divider,
                      backgroundColor: active ? t.accent : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? t.onAccent : t.neutral[700] }]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {empty ? (
        <View style={styles.emptyRoot}>
          {header}
          <View style={styles.emptyBody}>
            <View style={[styles.emptyIcon, { backgroundColor: t.accent2Ramp[200] }]}>
              <Icon name="file" size={52} color={t.accent2Ramp[700]} />
            </View>
            <Text style={[styles.emptyTitle, { color: t.text }]}>Nenhum PDF por aqui ainda</Text>
            <Text style={[styles.emptyText, { color: t.neutral[700] }]}>
              Abra um arquivo do aparelho ou baixe por endereço. Você também pode mandar um PDF de
              qualquer app pelo “Abrir com” — ele cai direto no leitor.
            </Text>
            <View style={styles.emptyBtns}>
              <PillButton label="Abrir PDF" onPress={pick} />
              <PillButton label="Por URL" variant="secondary" onPress={() => setUrlOpen(true)} />
            </View>
            {busy && <Text style={[styles.busy, { color: t.neutral[700] }]}>{busy}</Text>}
          </View>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(d) => d.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => <RecentItem doc={item} onOpen={onOpen} onMenu={setMenuDoc} />}
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Text style={[styles.noResultsTitle, { color: t.text }]}>Nada com esse nome</Text>
              <Text style={[styles.emptyText, { color: t.neutral[700] }]}>
                Nenhum documento corresponde a “{query.trim()}”. A busca aqui é só por nome do
                arquivo — para procurar dentro de um PDF, abra o documento e use Buscar.
              </Text>
            </View>
          }
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <ActionSheet
        visible={!!menuDoc}
        title={menuDoc?.name}
        onClose={() => setMenuDoc(null)}
        actions={
          menuDoc
            ? [
                { label: 'Abrir', icon: 'file', onPress: () => onOpen(menuDoc) },
                { label: 'Renomear', icon: 'rename', onPress: () => setRenameDocTarget(menuDoc) },
                { label: 'Compartilhar', icon: 'share', onPress: () => share(menuDoc) },
                { label: 'Imprimir', icon: 'print', onPress: () => print(menuDoc) },
                {
                  label: 'Remover da lista',
                  icon: 'trash',
                  destructive: true,
                  onPress: () => setRemoveTarget(menuDoc),
                },
              ]
            : []
        }
      />

      <PromptModal
        visible={!!renameDocTarget}
        title="Renomear"
        message="O nome vale só dentro do app; o arquivo original não muda."
        placeholder="Nome do documento"
        initialValue={renameDocTarget?.name ?? ''}
        selectAll
        confirmLabel="Salvar"
        onCancel={() => setRenameDocTarget(null)}
        onConfirm={async (v) => {
          const target = renameDocTarget;
          setRenameDocTarget(null);
          if (target && v.trim()) {
            setDocs(await renameDoc(target.id, v));
            toast('Renomeado');
          }
        }}
      />

      <PromptModal
        visible={!!removeTarget}
        noField
        title="Remover documento"
        message="Sai da lista de recentes, junto com o progresso e os marcadores. O arquivo no aparelho não é apagado."
        confirmLabel="Remover"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={async () => {
          const doc = removeTarget;
          setRemoveTarget(null);
          if (!doc) return;
          removeDocFiles(doc);
          setDocs(await mutateRecents((docs) => docs.filter((d) => d.id !== doc.id)));
          toast('Documento removido da lista');
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
        message="Endereço https direto de um PDF. Limite de 100 MB."
        placeholder="https://exemplo.com/arquivo.pdf"
        initialValue="https://"
        keyboardType="url"
        confirmLabel="Baixar"
        validate={(v) =>
          /^https:\/\/./i.test(v.trim())
            ? undefined
            : 'Use um endereço começando com https:// (http sem TLS não é aceito).'
        }
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
  container: { flex: 1 },
  list: { paddingHorizontal: 10, paddingBottom: 26 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 8,
    minHeight: 48,
  },
  title: { fontFamily: fonts.heading, fontSize: 26 },
  hero: {
    marginHorizontal: 8,
    marginTop: 6,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 28,
  },
  heroThumb: {
    width: 66,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  heroThumbImg: { width: '100%', height: '100%' },
  heroInfo: { flex: 1, justifyContent: 'space-between', gap: 8 },
  heroKicker: {
    fontFamily: fonts.heading,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroName: { fontFamily: fonts.bodySemi, fontSize: 15.5, lineHeight: 19, marginTop: 3 },
  heroProgress: { fontFamily: fonts.body, fontSize: 12.5, marginBottom: 6 },
  heroBar: { height: 6, borderRadius: 999, overflow: 'hidden' },
  heroBarFill: { height: '100%', borderRadius: 999 },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 10,
  },
  urlBtn: { paddingHorizontal: 18 },
  busy: { fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginBottom: 6 },
  search: {
    marginHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, padding: 0 },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.body, fontSize: 13 },
  noResults: { paddingVertical: 40, paddingHorizontal: 12, gap: 6 },
  noResultsTitle: { fontFamily: fonts.heading, fontSize: 19 },
  emptyRoot: { flex: 1, paddingHorizontal: 10 },
  emptyBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 18,
    paddingHorizontal: 10,
    paddingBottom: 40,
  },
  emptyIcon: {
    width: 132,
    height: 132,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 27, lineHeight: 32 },
  emptyText: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21 },
  emptyBtns: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
