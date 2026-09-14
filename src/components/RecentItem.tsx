import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { PdfDoc } from '../types';

type Props = {
  doc: PdfDoc;
  onOpen: (doc: PdfDoc) => void;
  onMenu: (doc: PdfDoc) => void;
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RecentItem({ doc, onOpen, onMenu }: Props) {
  const t = useTheme();
  const progress = doc.totalPages > 0 ? `pág. ${doc.lastPage}/${doc.totalPages}` : 'não aberto';
  const pct = doc.totalPages > 0 ? Math.round((doc.lastPage / doc.totalPages) * 100) : 0;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, { backgroundColor: t.card }, pressed && styles.pressed]}
      onPress={() => onOpen(doc)}
      onLongPress={() => onMenu(doc)}
      accessibilityRole="button"
      accessibilityLabel={`${doc.name}, ${progress}`}
      accessibilityHint="Toque para abrir, segure para opções"
    >
      {doc.thumbUri ? (
        <Image source={{ uri: doc.thumbUri }} style={[styles.thumb, { borderColor: t.border }]} />
      ) : doc.protected ? (
        <View style={[styles.thumb, styles.thumbFallback, styles.thumbLocked]}>
          <Text style={styles.lock} accessibilityLabel="Protegido por senha">
            🔒
          </Text>
        </View>
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Text style={styles.iconText}>PDF</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
          {doc.name}
        </Text>
        <Text style={[styles.meta, { color: t.textMuted }]}>
          {formatSize(doc.size)} · {progress}
          {doc.bookmarks.length ? ` · ${doc.bookmarks.length} marcador(es)` : ''}
        </Text>
        <View style={[styles.bar, { backgroundColor: t.border }]}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: t.primary }]} />
        </View>
      </View>
      <Pressable
        onPress={() => onMenu(doc)}
        hitSlop={12}
        style={styles.more}
        accessibilityRole="button"
        accessibilityLabel={`Opções de ${doc.name}`}
      >
        <Text style={[styles.moreText, { color: t.textMuted }]}>⋮</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
  },
  pressed: { opacity: 0.7 },
  thumb: {
    width: 52,
    height: 68,
    borderRadius: 6,
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#fff',
  },
  thumbFallback: {
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  iconText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  thumbLocked: { backgroundColor: '#555' },
  lock: { fontSize: 22 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 4 },
  bar: { height: 3, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 3 },
  more: { paddingLeft: 8, paddingVertical: 8 },
  moreText: { fontSize: 22, fontWeight: '700' },
});
