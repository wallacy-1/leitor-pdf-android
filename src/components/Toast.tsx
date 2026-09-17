import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { fonts, useTheme } from '../theme';

type Ctx = (message: string) => void;

const ToastContext = createContext<Ctx>(() => {});

/** Aviso curto na base da tela (marcador salvo, rolagem alterada…). Some sozinho em ~2 s. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<Ctx>(
    (message) => {
      if (timer.current) clearTimeout(timer.current);
      setMsg(message);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
          setMsg(null),
        );
      }, 2200);
    },
    [opacity],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <View pointerEvents="none" style={styles.wrap}>
          <Animated.View style={[styles.toast, { backgroundColor: t.neutral[900], opacity }]}>
            <Text style={[styles.text, { color: t.neutral[100] }]}>{msg}</Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    alignItems: 'center',
  },
  toast: {
    maxWidth: '100%',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    elevation: 6,
  },
  text: { fontFamily: fonts.body, fontSize: 13 },
});
