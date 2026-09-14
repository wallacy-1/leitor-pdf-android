import React, { useRef, useState } from 'react';
import {
  KeyboardTypeOptions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  selectAll?: boolean;
  confirmLabel?: string;
  initialValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export default function PromptModal({
  visible,
  title,
  message,
  placeholder,
  keyboardType,
  secure,
  selectAll,
  confirmLabel = 'OK',
  initialValue = '',
  onConfirm,
  onCancel,
}: Props) {
  const t = useTheme();
  const [value, setValue] = useState(initialValue);
  const input = useRef<TextInput>(null);

  // Ao abrir: reseta o valor e foca (autoFocus dentro de Modal no Android nem sempre abre o teclado).
  const onShow = () => {
    setValue(initialValue);
    // Espera a animação do Modal terminar antes de focar (senão o teclado não abre no Android).
    setTimeout(() => input.current?.focus(), 250);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      onShow={onShow}
    >
      <View style={styles.backdrop}>
        <View style={[styles.box, { backgroundColor: t.card }]}>
          <Text style={[styles.title, { color: t.text }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: t.textMuted }]}>{message}</Text> : null}
          <TextInput
            ref={input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={t.textMuted}
            keyboardType={keyboardType}
            secureTextEntry={secure}
            selectTextOnFocus={selectAll}
            onSubmitEditing={() => onConfirm(value)}
            style={[
              styles.input,
              { color: t.text, backgroundColor: t.inputBg, borderColor: t.border },
            ]}
          />
          <View style={styles.row}>
            <Pressable onPress={onCancel} style={styles.btn}>
              <Text style={[styles.btnText, { color: t.textMuted }]}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(value)} style={styles.btn}>
              <Text style={[styles.btnText, { color: t.primary }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: { width: '100%', maxWidth: 400, borderRadius: 14, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  message: { fontSize: 14, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  btn: { paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
