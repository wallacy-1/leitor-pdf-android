import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Application from 'expo-application';
import ScreenModal from '../components/ScreenModal';
import { formatSize } from '../components/RecentItem';
import { FitPolicy, useReaderPrefs } from '../prefs';
import { ThemeMode, useSettings } from '../settings';
import { clearCaches, removeAllDocs, storageUsage } from '../storage';
import { useTheme } from '../theme';

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
  const { settings, update } = useSettings();
  const { prefs, update: updatePrefs, reload: reloadPrefs } = useReaderPrefs();
  const [usage, setUsage] = useState({ documents: 0, caches: 0 });

  const refreshUsage = useCallback(() => setUsage(storageUsage()), []);
  // Ao abrir: recalcula uso de disco e relê prefs (o leitor pode ter mudado rolagem/noturno).
  const onShow = () => {
    refreshUsage();
    reloadPrefs();
  };

  const onClearCaches = () => {
    Alert.alert(
      'Limpar caches',
      'Remove texto extraído/OCR e miniaturas. Os documentos ficam; tudo é regenerado quando necessário.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          onPress: async () => {
            await clearCaches();
            refreshUsage();
            onDataChanged();
          },
        },
      ],
    );
  };

  const onRemoveAll = () => {
    Alert.alert(
      'Remover todos os documentos',
      'Apaga todos os PDFs importados, marcadores e progresso. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover tudo',
          style: 'destructive',
          onPress: async () => {
            await removeAllDocs();
            refreshUsage();
            onDataChanged();
          },
        },
      ],
    );
  };

  return (
    <ScreenModal visible={visible} title="Configurações" onClose={onClose} onShow={onShow}>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Aparência" t={t}>
          <Segmented
            options={THEMES}
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            t={t}
          />
          <Text style={[styles.hint, { color: t.textMuted }]}>
            {settings.theme === 'system'
              ? `Seguindo o sistema (agora: ${t.dark ? 'escuro' : 'claro'}).`
              : 'Tema fixo; o modo noturno do leitor é independente.'}
          </Text>
        </Section>

        <Section title="Leitura" t={t}>
          <Row label="Rolagem horizontal" hint="Uma página por vez, deslizando de lado" t={t}>
            <Switch
              value={prefs.horizontal}
              onValueChange={(v) => updatePrefs({ horizontal: v })}
            />
          </Row>
          <Row label="Modo noturno" hint="Inverte as cores da página" t={t}>
            <Switch value={prefs.night} onValueChange={(v) => updatePrefs({ night: v })} />
          </Row>
          <Row label="Manter tela ligada" hint="Enquanto um documento está aberto" t={t}>
            <Switch value={settings.keepAwake} onValueChange={(v) => update({ keepAwake: v })} />
          </Row>
          <Text style={[styles.label, { color: t.text, marginTop: 12 }]}>Ajustar página à</Text>
          <Segmented
            options={FITS}
            value={prefs.fitPolicy}
            onChange={(fitPolicy) => updatePrefs({ fitPolicy })}
            t={t}
          />
        </Section>

        <Section title="Busca e links" t={t}>
          <Row
            label="OCR automático"
            hint="Reconhece texto em páginas escaneadas na primeira busca (mais lento)"
            t={t}
          >
            <Switch value={settings.ocr} onValueChange={(v) => update({ ocr: v })} />
          </Row>
          <Row label="Confirmar links externos" hint="Pergunta antes de abrir http(s)/mailto" t={t}>
            <Switch
              value={settings.confirmLinks}
              onValueChange={(v) => update({ confirmLinks: v })}
            />
          </Row>
          <Row label="Retomar último documento" hint="Ao abrir o app, volta para onde parou" t={t}>
            <Switch value={settings.resumeLast} onValueChange={(v) => update({ resumeLast: v })} />
          </Row>
        </Section>

        <Section title="Armazenamento" t={t}>
          <Row label="Documentos" t={t}>
            <Text style={[styles.value, { color: t.textMuted }]}>
              {formatSize(usage.documents)}
            </Text>
          </Row>
          <Row label="Caches (texto, miniaturas)" t={t}>
            <Text style={[styles.value, { color: t.textMuted }]}>{formatSize(usage.caches)}</Text>
          </Row>
          <Pressable
            style={[styles.button, { borderColor: t.primary }]}
            onPress={onClearCaches}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: t.primary }]}>Limpar caches</Text>
          </Pressable>
          <Pressable
            style={[styles.button, { borderColor: t.danger }]}
            onPress={onRemoveAll}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: t.danger }]}>
              Remover todos os documentos
            </Text>
          </Pressable>
        </Section>

        <Section title="Sobre" t={t}>
          <Row label="Versão" t={t}>
            <Text style={[styles.value, { color: t.textMuted }]}>
              {Application.nativeApplicationVersion ?? '?'} ({Application.nativeBuildVersion ?? '?'}
              )
            </Text>
          </Row>
          <Text style={[styles.hint, { color: t.textMuted }]}>
            Leitura nativa (pdfium), busca e sumário via pdf.js, OCR offline (ML Kit). Nenhum dado
            sai do aparelho.
          </Text>
        </Section>
      </ScrollView>
    </ScreenModal>
  );
}

type T = ReturnType<typeof useTheme>;

function Section({ title, t, children }: { title: string; t: T; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: t.card }]}>
      <Text style={[styles.sectionTitle, { color: t.primary }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  hint,
  t,
  children,
}: {
  label: string;
  hint?: string;
  t: T;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: t.text }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: t.textMuted }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Segmented<K extends string | number>({
  options,
  value,
  onChange,
  t,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  t: T;
}) {
  return (
    <View style={[styles.segmented, { borderColor: t.border }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && { backgroundColor: t.primary }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, { color: active ? '#fff' : t.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  section: { borderRadius: 12, padding: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  rowText: { flex: 1 },
  label: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 12, marginTop: 2 },
  value: { fontSize: 14 },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
  button: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
