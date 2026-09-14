import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onShow?: () => void;
  children: React.ReactNode;
};

/** Modal de tela cheia com header padrão do app e safe area. */
export default function ScreenModal({ visible, title, onClose, onShow, children }: Props) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={onShow}>
      <SafeAreaView style={[styles.flex, { backgroundColor: t.primary }]} edges={['top', 'bottom']}>
        <View style={[styles.flex, { backgroundColor: t.bg }]}>
          <View style={[styles.header, { backgroundColor: t.primary }]}>
            <Pressable
              onPress={onClose}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Text style={styles.headerBtnText}>Fechar</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.headerBtn} />
          </View>
          {children}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, height: 52 },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 6, minWidth: 64, alignItems: 'center' },
  headerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
