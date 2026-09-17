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
import Icon from './Icon';
import { usePdfEngine } from './PdfEngine';
import ScreenModal from './ScreenModal';
import { getPageThumbnail } from '../storage';
import { fonts, Theme, useTheme } from '../theme';
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
const PAD = 14;
const GAP = 12;
const LABEL = 24;

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
  const cell = Math.floor((width - PAD * 2 - GAP * (COLS - 1)) / COLS);
  const rowH = (cell * 4) / 3 + LABEL + GAP;
  const pages = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <ScreenModal
      visible={visible}
      title="Páginas"
      onClose={onClose}
      headerRight={
        <Text style={[styles.counter, { color: t.neutral[700] }]}>
          {current} / {total}
        </Text>
      }
    >
      <FlatList
        data={pages}
        keyExtractor={(p) => String(p)}
        numColumns={COLS}
        initialScrollIndex={Math.max(0, Math.floor((current - 1) / COLS))}
        getItemLayout={(_, index) => ({ length: rowH, offset: rowH * index, index })}
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
            t={t}
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
  t: Theme;
};

function PageCell({ doc, page, password, size, active, bookmarked, onPress, t }: CellProps) {
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
      style={[styles.cellWrap, { width: size }]}
      accessibilityRole="button"
      accessibilityLabel={`Página ${page}`}
      accessibilityState={{ selected: active }}
    >
      <View
        style={[
          styles.cell,
          { width: size, height: (size * 4) / 3, backgroundColor: t.neutral[100] },
          active && { borderColor: t.accent, borderWidth: 3 },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.img} resizeMode="contain" />
        ) : (
          <ActivityIndicator color={t.accent} />
        )}
        {bookmarked && (
          <View style={styles.mark}>
            <Icon name="bookmark" size={13} color={t.accent} filled />
          </View>
        )}
      </View>
      <Text
        style={[
          styles.label,
          active ? styles.labelActive : null,
          { color: active ? t.accentRamp[700] : t.neutral[700] },
        ]}
      >
        {page}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  counter: { fontFamily: fonts.body, fontSize: 12.5, marginRight: 12 },
  list: { padding: PAD },
  row: { gap: GAP, marginBottom: GAP },
  cellWrap: { alignItems: 'stretch', gap: 6 },
  cell: {
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  img: { width: '100%', height: '100%' },
  mark: { position: 'absolute', top: 5, right: 5 },
  label: { fontFamily: fonts.body, fontSize: 11.5, height: LABEL - 6 },
  labelActive: { fontFamily: fonts.bodyBold },
});
