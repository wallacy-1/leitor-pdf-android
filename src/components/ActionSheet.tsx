import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon, { IconName } from './Icon';
import { MenuRow } from './ui';
import { fonts, useTheme } from '../theme';

export type SheetAction = {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Valor atual mostrado à direita (ex.: "vertical"). */
  value?: string;
  destructive?: boolean;
};

export type SheetTile = {
  label: string;
  icon: IconName;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  /** Atalhos em grade no topo (Buscar, Sumário…). */
  tiles?: SheetTile[];
  actions: SheetAction[];
  onClose: () => void;
};

/** Folha inferior do protótipo: alça, grade de atalhos e linhas de ação. */
export default function ActionSheet({ visible, title, tiles, actions, onClose }: Props) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.bg, maxHeight: height * 0.92 }]}>
          <View style={[styles.handle, { backgroundColor: t.neutral[400] }]} />
          <ScrollView bounces={false}>
            {title ? (
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {tiles?.length ? (
              <View style={styles.tiles}>
                {tiles.map((tile) => (
                  <Pressable
                    key={tile.label}
                    accessibilityRole="button"
                    onPress={run(tile.onPress)}
                    style={({ pressed }) => [
                      styles.tile,
                      { backgroundColor: pressed ? t.accentRamp[200] : t.accentRamp[100] },
                    ]}
                  >
                    <Icon name={tile.icon} color={t.accentRamp[800]} />
                    <Text style={[styles.tileText, { color: t.accentRamp[800] }]}>
                      {tile.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {actions.map((a) => (
              <MenuRow
                key={a.label}
                icon={a.icon}
                label={a.label}
                value={a.value}
                onPress={run(a.onPress)}
                color={a.destructive ? t.accentRamp[700] : undefined}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(46,43,37,0.42)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
    elevation: 12,
  },
  handle: { width: 44, height: 5, borderRadius: 999, alignSelf: 'center', marginBottom: 12 },
  title: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
  },
  tiles: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tile: {
    flex: 1,
    minHeight: 88,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tileText: { fontFamily: fonts.body, fontSize: 11.5, textAlign: 'center' },
});
