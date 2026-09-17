import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { fonts } from '../theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

// Tokens do tema claro fixos: aqui não dá para depender de hooks/contexto (pode ser o que quebrou).
const C = {
  bg: '#f5ead8',
  text: '#201e1d',
  muted: '#645c50',
  accent: '#c67139',
  accent200: '#ffe1d0',
  accent800: '#643312',
  divider: 'rgba(32,30,29,0.16)',
};

/**
 * Última linha de defesa: exceção em render não derruba o app sem explicação.
 * Oferece reiniciar a árvore e, se persistir, limpar os dados locais (lista de recentes/preferências).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  clearData = async () => {
    try {
      await AsyncStorage.clear();
    } finally {
      this.reset();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <View style={styles.icon}>
          <Icon name="alert" size={36} color={C.accent800} />
        </View>
        <Text style={styles.title}>Algo deu errado</Text>
        <Text style={styles.body}>
          O app não conseguiu continuar. Seus documentos e marcadores continuam no aparelho. Se o
          erro voltar, limpar os dados apaga a lista, não os arquivos originais.
        </Text>
        <Text style={styles.msg} numberOfLines={4}>
          {this.state.error.message}
        </Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={this.reset}
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, styles.btnPrimaryText]}>Tentar novamente</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={this.clearData}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Limpar dados do app</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingVertical: 30,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 16,
  },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: C.accent200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.heading, fontSize: 27, color: C.text },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: C.muted },
  msg: { fontFamily: 'monospace', fontSize: 12, color: C.muted },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  btn: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: C.accent },
  btnSecondary: { borderWidth: 1, borderColor: C.divider },
  btnText: { fontFamily: fonts.heading, fontSize: 15, color: C.text },
  btnPrimaryText: { color: C.bg },
});
