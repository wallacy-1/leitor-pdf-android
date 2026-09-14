import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { usePdfEngine } from './PdfEngine';
import ScreenModal from './ScreenModal';
import { getPageThumbnail } from '../storage';
import { useTheme } from '../theme';
import { PdfDoc } from '../types';

type Props = {
  visible: boolean;
  doc: PdfDoc;
  total: number;
  current: number;
  bookmarks: number[];
  password?: string;
  onSelect: (page: number) => void;
  onClose: () => void;
};

const COLS = 3;

export default function PagesGrid({
  visible,
  doc,
  total,
  current,
  bookmarks,
  password,
  onSelect,
  onClose,
}: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 16 * 2 - 8 * (COLS - 1)) / COLS);
  const pages = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <ScreenModal visible={visible} title={`Páginas (${total})`} onClose={onClose}>
      <FlatList
        data={pages}
        keyExtractor={(p) => String(p)}
        numColumns={COLS}
        initialScrollIndex={Math.max(0, Math.floor((current - 1) / COLS))}
        getItemLayout={(_, index) => ({
          length: cell * 1.41 + 30,
          offset: (cell * 1.41 + 30) * index,
          index,
        })}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        windowSize={5}
        renderItem={({ item }) => (
          <PageCell
            doc={doc}
            page={item}
            password={password}
            size={cell}
            active={item === current}
            bookmarked={bookmarks.includes(item)}
            onPress={() => onSelect(item)}
            color={t.primary}
            textColor={t.textMuted}
            cardColor={t.card}
          />
        )}
      />
    </ScreenModal>
  );
}

type CellProps = {
  doc: PdfDoc;
  page: number;
  password?: string;
  size: number;
  active: boolean;
  bookmarked: boolean;
  onPress: () => void;
  color: string;
  textColor: string;
  cardColor: string;
};

function PageCell({
  doc,
  page,
  password,
  size,
  active,
  bookmarked,
  onPress,
  color,
  textColor,
  cardColor,
}: CellProps) {
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
    <Pressable
      onPress={onPress}
      style={styles.cellWrap}
      accessibilityRole="button"
      accessibilityLabel={`Página ${page}`}
    >
      <View
        style={[
          styles.cell,
          { width: size, height: size * 1.41, backgroundColor: cardColor },
          active && { borderColor: color, borderWidth: 3 },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.img} resizeMode="contain" />
        ) : (
          <ActivityIndicator color={color} />
        )}
        {bookmarked && <Text style={styles.star}>★</Text>}
      </View>
      <Text style={[styles.label, { color: active ? color : textColor }]}>{page}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  row: { gap: 8, marginBottom: 8 },
  cellWrap: { alignItems: 'center' },
  cell: {
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
  },
  img: { width: '100%', height: '100%' },
  star: { position: 'absolute', top: 4, right: 6, color: '#f9a825', fontSize: 18 },
  label: { marginTop: 4, fontSize: 12, fontWeight: '600', height: 18 },
});
