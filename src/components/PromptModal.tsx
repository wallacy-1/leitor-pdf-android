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
import { fonts, useTheme } from '../theme';

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
  /** Sem campo de texto: só confirmação. */
  noField?: boolean;
  /** Aviso em destaque abaixo do campo (erro de validação). */
  note?: string;
  /** Retorna uma mensagem para manter o diálogo aberto com aviso; vazio/undefined confirma. */
  validate?: (value: string) => string | undefined;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

/** Diálogo do protótipo: cartão arredondado, campo em pílula, ações à direita. */
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
  noField,
  note,
  validate,
  onConfirm,
  onCancel,
}: Props) {
  const t = useTheme();
  const [value, setValue] = useState(initialValue);
  const [localNote, setLocalNote] = useState<string | undefined>();
  const input = useRef<TextInput>(null);

  // Ao abrir: reseta o valor e foca (autoFocus dentro de Modal no Android nem sempre abre o teclado).
  const onShow = () => {
    setValue(initialValue);
    setLocalNote(undefined);
    // Espera a animação do Modal terminar antes de focar (senão o teclado não abre no Android).
    if (!noField) setTimeout(() => input.current?.focus(), 250);
  };

  const confirm = () => {
    const err = validate?.(value);
    if (err) {
      setLocalNote(err);
      return;
    }
    onConfirm(value);
  };

  const shownNote = localNote ?? note;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      onShow={onShow}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.box, { backgroundColor: t.bg }]}>
          <Text style={[styles.title, { color: t.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: t.neutral[700] }]}>{message}</Text>
          ) : null}
          {!noField && (
            <TextInput
              ref={input}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={t.neutral[600]}
              keyboardType={keyboardType}
              secureTextEntry={secure}
              selectTextOnFocus={selectAll}
              onSubmitEditing={confirm}
              style={[
                styles.input,
                { color: t.text, backgroundColor: t.neutral[100], borderColor: t.divider },
              ]}
            />
          )}
          {shownNote ? (
            <Text style={[styles.note, { color: t.accentRamp[700] }]}>{shownNote}</Text>
          ) : null}
          <View style={styles.row}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, pressed && { backgroundColor: t.neutral[200] }]}
            >
              <Text style={[styles.btnText, { color: t.text }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.btn,
                styles.btnOk,
                { backgroundColor: pressed ? t.accentRamp[600] : t.accent },
              ]}
            >
              <Text style={[styles.btnText, { color: t.onAccent }]}>{confirmLabel}</Text>
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
    backgroundColor: 'rgba(46,43,37,0.46)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: { width: '100%', maxWidth: 420, borderRadius: 28, padding: 22, elevation: 8 },
  title: { fontFamily: fonts.heading, fontSize: 21, marginBottom: 8 },
  message: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  note: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 18 },
  btn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOk: { paddingHorizontal: 20 },
  btnText: { fontFamily: fonts.heading, fontSize: 14 },
});
