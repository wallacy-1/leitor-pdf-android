import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme';

export type SheetAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
};

export default function ActionSheet({ visible, title, actions, onClose }: Props) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: t.card, maxHeight: height * 0.85 }]}
          onPress={() => {}}
        >
          <ScrollView bounces={false}>
            {title ? (
              <Text style={[styles.title, { color: t.textMuted }]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {actions.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: t.bg }]}
                onPress={() => {
                  onClose();
                  a.onPress();
                }}
              >
                <Text style={[styles.itemText, { color: a.destructive ? t.danger : t.text }]}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.item} onPress={onClose} accessibilityRole="button">
              <Text style={[styles.itemText, styles.cancel, { color: t.textMuted }]}>Cancelar</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 16, paddingTop: 8 },
  title: { fontSize: 13, paddingHorizontal: 20, paddingVertical: 8 },
  item: { paddingVertical: 14, paddingHorizontal: 20 },
  itemText: { fontSize: 16 },
  cancel: { textAlign: 'center', fontWeight: '600' },
});
