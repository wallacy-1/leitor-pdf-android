import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

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
        <Text style={styles.title}>Algo deu errado</Text>
        <Text style={styles.msg} numberOfLines={6}>
          {this.state.error.message}
        </Text>
        <Pressable style={styles.btn} onPress={this.reset} accessibilityRole="button">
          <Text style={styles.btnText}>Tentar novamente</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnDanger]}
          onPress={this.clearData}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>Limpar dados do app</Text>
        </Pressable>
        <Text style={styles.hint}>
          Limpar remove a lista de recentes e preferências; os PDFs ficam no dispositivo.
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  msg: { color: '#bbb', fontSize: 14, marginBottom: 24, fontFamily: 'monospace' },
  btn: {
    backgroundColor: '#1976d2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDanger: { backgroundColor: '#d32f2f' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
