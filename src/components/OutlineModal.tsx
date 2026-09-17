import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { OutlineItem, usePdfEngine } from './PdfEngine';
import ScreenModal from './ScreenModal';
import { EmptyState, PillButton } from './ui';
import { fonts, useTheme } from '../theme';
import { PdfDoc } from '../types';

type Props = {
  visible: boolean;
  doc: PdfDoc;
  password?: string;
  onSelect: (page: number) => void;
  /** Sem sumário: atalho para a grade de páginas. */
  onOpenGrid: () => void;
  onClose: () => void;
};

export default function OutlineModal({
  visible,
  doc,
  password,
  onSelect,
  onOpenGrid,
  onClose,
}: Props) {
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
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(it, i) => `${it.page}-${i}`}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            error ? (
              <EmptyState title="Não deu para ler o sumário" body={error} />
            ) : (
              <EmptyState
                title="Este PDF não tem sumário"
                body="Nada foi embutido no arquivo. Use a grade de páginas ou a busca para navegar."
              >
                <PillButton
                  label="Ver páginas"
                  variant="secondary"
                  onPress={onOpenGrid}
                  style={styles.gridBtn}
                  textStyle={styles.gridBtnText}
                />
              </EmptyState>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item.page)}
              style={({ pressed }) => [
                styles.row,
                { paddingLeft: 12 + item.depth * 18 },
                pressed && { backgroundColor: t.neutral[200] },
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.title,
                  { color: t.text },
                  item.depth === 0 ? styles.top : styles.sub,
                ]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text style={[styles.page, { color: t.neutral[600] }]}>{item.page}</Text>
            </Pressable>
          )}
        />
      )}
    </ScreenModal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 },
  gridBtn: { alignSelf: 'flex-start', marginTop: 10, minHeight: 44, paddingHorizontal: 20 },
  gridBtnText: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    minHeight: 48,
    paddingVertical: 10,
    paddingRight: 12,
    borderRadius: 16,
  },
  title: { flex: 1, lineHeight: 20 },
  top: { fontFamily: fonts.bodySemi, fontSize: 14.5 },
  sub: { fontFamily: fonts.body, fontSize: 13.5 },
  page: { fontFamily: fonts.body, fontSize: 12 },
});
