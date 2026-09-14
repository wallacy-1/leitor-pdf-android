import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { OutlineItem, usePdfEngine } from './PdfEngine';
import ScreenModal from './ScreenModal';
import { useTheme } from '../theme';
import { PdfDoc } from '../types';

type Props = {
  visible: boolean;
  doc: PdfDoc;
  password?: string;
  onSelect: (page: number) => void;
  onClose: () => void;
};

export default function OutlineModal({ visible, doc, password, onSelect, onClose }: Props) {
  const t = useTheme();
  const engine = usePdfEngine();
  const [items, setItems] = useState<OutlineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || items) return;
    engine
      .getOutline(doc.uri, password)
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [visible, items, engine, doc.uri, password]);

  return (
    <ScreenModal visible={visible} title="Sumário" onClose={onClose}>
      {!items && !error ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(it, i) => `${it.page}-${i}`}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: t.textMuted }]}>
              {error ? `Erro: ${error}` : 'Este PDF não tem sumário.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item.page)}
              style={[styles.row, { backgroundColor: t.card, paddingLeft: 14 + item.depth * 18 }]}
              accessibilityRole="button"
            >
              <Text
                style={[styles.title, { color: t.text }, item.depth === 0 && styles.bold]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text style={[styles.page, { color: t.textMuted }]}>{item.page}</Text>
            </Pressable>
          )}
        />
      )}
    </ScreenModal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  empty: { textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    paddingRight: 14,
    marginBottom: 6,
  },
  title: { flex: 1, fontSize: 15 },
  bold: { fontWeight: '600' },
  page: { fontSize: 13, marginLeft: 12 },
});
