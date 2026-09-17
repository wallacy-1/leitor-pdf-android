import React from 'react';
import { Modal, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from './ui';
import { fonts, useTheme } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onShow?: () => void;
  /** Ícone do botão de fechar: seta (padrão) ou X (busca). */
  closeIcon?: 'back' | 'close';
  /** Conteúdo extra no cabeçalho, à direita do título. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
};

/** Painel de tela cheia: cabeçalho com botão de voltar, título Caprasimo e linha divisória. */
export default function ScreenModal({
  visible,
  title,
  onClose,
  onShow,
  closeIcon = 'back',
  headerRight,
  children,
}: Props) {
  const t = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent={false}
    >
      <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      <SafeAreaView style={[styles.flex, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: t.divider }]}>
          <IconButton icon={closeIcon} onPress={onClose} label="Voltar" />
          {title ? (
            <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {headerRight}
        </View>
        {children}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 58,
    borderBottomWidth: 1,
  },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 20 },
});
