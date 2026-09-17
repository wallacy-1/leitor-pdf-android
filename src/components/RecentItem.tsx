import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { IconButton } from './ui';
import { fonts, useTheme } from '../theme';
import { PdfDoc } from '../types';

type Props = {
  doc: PdfDoc;
  onOpen: (doc: PdfDoc) => void;
  onMenu: (doc: PdfDoc) => void;
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function progressLabel(doc: PdfDoc): string {
  if (doc.protected && !doc.totalPages) return 'protegido por senha';
  return doc.totalPages > 0 ? `pág. ${doc.lastPage}/${doc.totalPages}` : 'não aberto';
}

export default function RecentItem({ doc, onOpen, onMenu }: Props) {
  const t = useTheme();
  const progress = progressLabel(doc);
  const pct = doc.totalPages > 0 ? Math.round((doc.lastPage / doc.totalPages) * 100) : 0;
  const marks = doc.bookmarks.length;
  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        onPress={() => onOpen(doc)}
        onLongPress={() => onMenu(doc)}
        accessibilityRole="button"
        accessibilityLabel={`${doc.name}, ${progress}`}
        accessibilityHint="Toque para abrir, segure para opções"
      >
        <View
          style={[styles.thumb, { backgroundColor: doc.protected ? t.surface : t.neutral[100] }]}
        >
          {doc.thumbUri ? (
            <Image source={{ uri: doc.thumbUri }} style={styles.thumbImg} />
          ) : (
            <Icon name={doc.protected ? 'lock' : 'file'} size={18} color={t.neutral[600]} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
            {doc.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: t.neutral[700] }]}>
              {progress} · {formatSize(doc.size)}
            </Text>
            {marks > 0 && (
              <View style={styles.marks}>
                <Icon name="bookmark" size={12} color={t.accentRamp[700]} filled />
                <Text style={[styles.meta, { color: t.accentRamp[700] }]}>{marks}</Text>
              </View>
            )}
          </View>
          <View style={[styles.bar, { backgroundColor: t.neutral[300] }]}>
            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: t.accent }]} />
          </View>
        </View>
      </Pressable>
      <IconButton
        icon="more"
        size={44}
        color={t.neutral[700]}
        onPress={() => onMenu(doc)}
        label={`Opções de ${doc.name}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 22,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  pressed: { opacity: 0.7 },
  thumb: {
    width: 42,
    height: 56,
    borderRadius: 9,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  thumbImg: { width: '100%', height: '100%' },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodySemi, fontSize: 14.5, lineHeight: 19 },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' },
  meta: { fontFamily: fonts.body, fontSize: 12 },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bar: { height: 3, borderRadius: 999, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 3 },
});
