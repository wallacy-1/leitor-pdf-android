import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ScreenModal from './ScreenModal';
import { useTheme } from '../theme';

type Props = {
  visible: boolean;
  bookmarks: number[];
  onSelect: (page: number) => void;
  onRemove: (page: number) => void;
  onClose: () => void;
};

export default function BookmarksModal({ visible, bookmarks, onSelect, onRemove, onClose }: Props) {
  const t = useTheme();
  return (
    <ScreenModal visible={visible} title="Marcadores" onClose={onClose}>
      <FlatList
        data={bookmarks}
        keyExtractor={(b) => String(b)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: t.textMuted }]}>
            Nenhum marcador. Toque em ☆ no leitor para marcar a página atual.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: t.card }]}>
            <Pressable
              style={styles.main}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
            >
              <Text style={[styles.text, { color: t.text }]}>Página {item}</Text>
            </Pressable>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remover marcador da página ${item}`}
              onPress={() => onRemove(item)}
            >
              <Text style={[styles.del, { color: t.danger }]}>Remover</Text>
            </Pressable>
          </View>
        )}
      />
    </ScreenModal>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  empty: { textAlign: 'center', marginTop: 32, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  main: { flex: 1 },
  text: { fontSize: 16 },
  del: { fontSize: 14, fontWeight: '600', paddingLeft: 12 },
});
