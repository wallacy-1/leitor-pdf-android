import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Application from 'expo-application';
import PromptModal from '../components/PromptModal';
import { formatSize } from '../components/RecentItem';
import ScreenModal from '../components/ScreenModal';
import { useToast } from '../components/Toast';
import { Kicker, PillButton, Segmented, Toggle } from '../components/ui';
import { FitPolicy, useReaderPrefs } from '../prefs';
import { ThemeMode, useSettings } from '../settings';
import { clearCaches, removeAllDocs, storageUsage } from '../storage';
import { fonts, useTheme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Lista de recentes mudou (limpeza). */
  onDataChanged: () => void;
};

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'Sistema' },
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Escuro' },
];

const FITS: { key: FitPolicy; label: string }[] = [
  { key: 0, label: 'Largura' },
  { key: 1, label: 'Altura' },
  { key: 2, label: 'Página' },
];

export default function SettingsScreen({ visible, onClose, onDataChanged }: Props) {
  const t = useTheme();
  const toast = useToast();
  const { settings, update } = useSettings();
  const { prefs, update: updatePrefs, reload: reloadPrefs } = useReaderPrefs();
  const [usage, setUsage] = useState({ documents: 0, caches: 0 });
  const [confirm, setConfirm] = useState<'cache' | 'all' | null>(null);

  const refreshUsage = useCallback(() => setUsage(storageUsage()), []);
  // Ao abrir: recalcula uso de disco e relê prefs (o leitor pode ter mudado rolagem/noturno).
  const onShow = () => {
    refreshUsage();
    reloadPrefs();
  };

  const onConfirm = async () => {
    const which = confirm;
    setConfirm(null);
    if (which === 'cache') {
      const freed = usage.caches;
      await clearCaches();
      toast(`Caches limpos · ${formatSize(freed)} liberados`);
    } else if (which === 'all') {
      await removeAllDocs();
      toast('Lista apagada');
    }
    refreshUsage();
    onDataChanged();
  };

  return (
    <ScreenModal visible={visible} title="Configurações" onClose={onClose} onShow={onShow}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Kicker style={styles.kicker}>Aparência</Kicker>
          <Segmented
            options={THEMES}
            value={settings.theme}
            onChange={(theme) => update({ theme })}
          />
          <Text style={[styles.hint, { color: t.neutral[700], marginTop: 8 }]}>
            {settings.theme === 'system'
              ? `O sistema está em ${t.dark ? 'escuro' : 'claro'} agora.`
              : 'Tema fixo; o modo noturno do leitor é independente.'}
          </Text>
        </View>

        <View>
          <Kicker style={styles.kickerTight}>Leitura</Kicker>
          <Row label="Rolagem horizontal" hint="Uma página por vez, deslizando de lado">
            <Toggle
              label="Rolagem horizontal"
              value={prefs.horizontal}
              onChange={(v) => updatePrefs({ horizontal: v })}
            />
          </Row>
          <Row label="Modo noturno" hint="Inverte as cores da página, independente do tema">
            <Toggle
              label="Modo noturno"
              value={prefs.night}
              onChange={(v) => updatePrefs({ night: v })}
            />
          </Row>
          <Row label="Manter a tela ligada" hint="Enquanto um documento estiver aberto">
            <Toggle
              label="Manter a tela ligada"
              value={settings.keepAwake}
              onChange={(v) => update({ keepAwake: v })}
            />
          </Row>
          <Text style={[styles.label, { color: t.text, marginTop: 14, marginBottom: 8 }]}>
            Ajuste da página
          </Text>
          <Segmented
            options={FITS}
            value={prefs.fitPolicy}
            onChange={(fitPolicy) => updatePrefs({ fitPolicy })}
          />
        </View>

        <View>
          <Kicker style={styles.kickerTight}>Busca e links</Kicker>
          <Row
            label="OCR automático"
            hint="Reconhece texto em páginas escaneadas na primeira busca"
          >
            <Toggle
              label="OCR automático"
              value={settings.ocr}
              onChange={(v) => update({ ocr: v })}
            />
          </Row>
          <Row label="Confirmar links externos" hint="Mostra o endereço antes de sair do app">
            <Toggle
              label="Confirmar links externos"
              value={settings.confirmLinks}
              onChange={(v) => update({ confirmLinks: v })}
            />
          </Row>
          <Row label="Retomar último documento" hint="Ao abrir o app, volta direto para a leitura">
            <Toggle
              label="Retomar último documento"
              value={settings.resumeLast}
              onChange={(v) => update({ resumeLast: v })}
            />
          </Row>
        </View>

        <View>
          <Kicker style={styles.kicker}>Armazenamento</Kicker>
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <View style={styles.usageRow}>
              <Text style={[styles.usage, { color: t.text }]}>Documentos</Text>
              <Text style={[styles.usage, { color: t.text }]}>{formatSize(usage.documents)}</Text>
            </View>
            <View style={styles.usageRow}>
              <Text style={[styles.usage, { color: t.neutral[700] }]}>
                Caches (miniaturas, texto)
              </Text>
              <Text style={[styles.usage, { color: t.neutral[700] }]}>
                {formatSize(usage.caches)}
              </Text>
            </View>
            <View style={styles.cardBtns}>
              <PillButton
                label="Limpar caches"
                variant="secondary"
                onPress={() => setConfirm('cache')}
                style={styles.smallBtn}
                textStyle={styles.smallBtnText}
              />
              <PillButton
                label="Remover tudo"
                variant="secondary"
                onPress={() => setConfirm('all')}
                style={[styles.smallBtn, { borderColor: t.accentRamp[300] }]}
                textStyle={[styles.smallBtnText, { color: t.accentRamp[700] }]}
              />
            </View>
          </View>
        </View>

        <View>
          <Kicker style={styles.kickerTight}>Sobre</Kicker>
          <Text style={[styles.about, { color: t.neutral[700] }]}>
            Versão {Application.nativeApplicationVersion ?? '?'} (
            {Application.nativeBuildVersion ?? '?'}) · Nenhum dado sai do aparelho: não há conta,
            nuvem, sincronização nem anúncios. Leitura nativa (pdfium), busca e sumário via pdf.js,
            OCR offline (ML Kit).
          </Text>
        </View>
      </ScrollView>

      <PromptModal
        visible={confirm === 'cache'}
        noField
        title="Limpar caches"
        message="Miniaturas e texto extraído serão gerados de novo na próxima vez. Progresso e marcadores ficam."
        confirmLabel="Limpar"
        onCancel={() => setConfirm(null)}
        onConfirm={onConfirm}
      />
      <PromptModal
        visible={confirm === 'all'}
        noField
        title="Remover todos os documentos"
        message="Apaga a lista, o progresso de leitura e todos os marcadores. Os arquivos originais continuam no aparelho."
        confirmLabel="Remover tudo"
        onCancel={() => setConfirm(null)}
        onConfirm={onConfirm}
      />
    </ScreenModal>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.divider }]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: t.text }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: t.neutral[700] }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 30, gap: 22 },
  kicker: { marginBottom: 10 },
  kickerTight: { marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  rowText: { flex: 1 },
  label: { fontFamily: fonts.body, fontSize: 14.5 },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  card: { borderRadius: 22, padding: 16 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  usage: { fontFamily: fonts.body, fontSize: 13.5 },
  cardBtns: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  smallBtn: { minHeight: 44, paddingHorizontal: 16 },
  smallBtnText: { fontSize: 13.5 },
  about: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
});
