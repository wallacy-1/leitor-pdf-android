import React, { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePdfEngine } from './PdfEngine';
import ScreenModal from './ScreenModal';
import { EmptyState, IconButton } from './ui';
import { getPageThumbnail } from '../storage';
import { fonts, useTheme } from '../theme';
import { PdfDoc } from '../types';

type Props = {
  visible: boolean;
  doc: PdfDoc;
  password?: string;
  bookmarks: number[];
  onSelect: (page: number) => void;
  onRemove: (page: number) => void;
  onClose: () => void;
};

export default function BookmarksModal({
  visible,
  doc,
  password,
  bookmarks,
  onSelect,
  onRemove,
  onClose,
}: Props) {
  const t = useTheme();
  return (
    <ScreenModal visible={visible} title="Marcadores" onClose={onClose}>
      <FlatList
        data={bookmarks}
        keyExtractor={(b) => String(b)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="bookmark"
            title="Nenhuma página marcada"
            body="No leitor, toque no marcador na barra de cima para guardar a página em que você está. Ela aparece aqui."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.main, pressed && styles.pressed]}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`Ir para a página ${item}`}
            >
              <Thumb doc={doc} page={item} password={password} />
              <Text style={[styles.text, { color: t.text }]}>Página {item}</Text>
            </Pressable>
            <IconButton
              icon="trash"
              color={t.neutral[700]}
              label={`Remover marcador da página ${item}`}
              onPress={() => onRemove(item)}
            />
          </View>
        )}
      />
    </ScreenModal>
  );
}

function Thumb({ doc, page, password }: { doc: PdfDoc; page: number; password?: string }) {
  const t = useTheme();
  const engine = usePdfEngine();
  const [uri, setUri] = useState<string | undefined>();
  useEffect(() => {
    let alive = true;
    getPageThumbnail(engine, doc, page, password).then((u) => {
      if (alive) setUri(u);
    });
    return () => {
      alive = false;
    };
  }, [engine, doc, page, password]);
  return (
    <View style={[styles.thumb, { backgroundColor: t.neutral[100] }]}>
      {uri && <Image source={{ uri }} style={styles.img} resizeMode="cover" />}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 20,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  pressed: { opacity: 0.7 },
  thumb: { width: 38, height: 50, borderRadius: 8, overflow: 'hidden', elevation: 1 },
  img: { width: '100%', height: '100%' },
  text: { fontFamily: fonts.bodySemi, fontSize: 14.5 },
});
