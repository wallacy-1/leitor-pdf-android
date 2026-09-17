import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Icon, { IconName } from './Icon';
import { fonts, useTheme } from '../theme';

/** Botão redondo só com ícone (44px, área de toque confortável). */
export function IconButton({
  icon,
  onPress,
  label,
  color,
  bg,
  size = 44,
  filled,
  disabled,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  bg?: string;
  size?: number;
  filled?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size, backgroundColor: bg ?? 'transparent' },
        pressed && { backgroundColor: t.accentRamp[100] },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} color={color ?? t.text} filled={filled} />
    </Pressable>
  );
}

/** Botão-pílula: `primary` (accent cheio) ou `secondary` (contorno). */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  style,
  textStyle,
  grow,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  grow?: boolean;
}) {
  const t = useTheme();
  const primary = variant === 'primary';
  const ink = primary ? t.onAccent : t.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.pill,
        grow && styles.grow,
        primary
          ? { backgroundColor: pressed ? t.accentRamp[600] : t.accent }
          : variant === 'secondary'
            ? {
                borderWidth: 1,
                borderColor: t.divider,
                backgroundColor: pressed ? t.accentRamp[100] : 'transparent',
              }
            : { backgroundColor: pressed ? t.neutral[200] : 'transparent' },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={20} color={ink} />}
      <Text style={[styles.pillText, { color: ink }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

/** Rótulo de seção em caixa alta (Caprasimo, espaçado). */
export function Kicker({ children, style }: { children: string; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[styles.kicker, { color: t.neutral[600] }, style]}>{children}</Text>;
}

/** Seletor de opções em pílula (tema, ajuste de página). */
export function Segmented<K extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.surface }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && { backgroundColor: t.accent }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, { color: active ? t.onAccent : t.neutral[700] }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Interruptor 52x32 do protótipo (trilha verde quando ligado). */
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={[styles.track, { backgroundColor: value ? t.accent2Ramp[600] : t.neutral[400] }]}
    >
      <View
        style={[
          styles.knob,
          { backgroundColor: t.neutral[100], transform: [{ translateX: value ? 20 : 0 }] },
        ]}
      />
    </Pressable>
  );
}

/** Estado vazio: título Caprasimo + texto explicativo, alinhados à esquerda. */
export function EmptyState({
  title,
  body,
  icon,
  children,
}: {
  title: string;
  body: string;
  icon?: IconName;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.emptyWrap}>
      {icon && (
        <View style={[styles.emptyIcon, { backgroundColor: t.accentRamp[200] }]}>
          <Icon name={icon} size={34} color={t.accentRamp[700]} />
        </View>
      )}
      <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: t.neutral[700] }]}>{body}</Text>
      {children}
    </View>
  );
}

/** Linha de ação de menu/sheet: ícone + rótulo + valor à direita. */
export function MenuRow({
  icon,
  label,
  value,
  onPress,
  color,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  color?: string;
}) {
  const t = useTheme();
  const ink = color ?? t.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.menuRow,
        pressed && { backgroundColor: color ? t.accentRamp[100] : t.neutral[200] },
      ]}
    >
      <Icon name={icon} size={20} color={color ?? t.neutral[700]} />
      <Text style={[styles.menuLabel, { color: ink }]}>{label}</Text>
      {value ? <Text style={[styles.menuValue, { color: t.neutral[600] }]}>{value}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconBtn: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  pill: {
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  grow: { flex: 1 },
  pillText: { fontFamily: fonts.heading, fontSize: 15 },
  kicker: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  segmented: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999 },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontFamily: fonts.body, fontSize: 13.5 },
  track: { width: 52, height: 32, borderRadius: 999, padding: 3, justifyContent: 'center' },
  knob: { width: 26, height: 26, borderRadius: 999, elevation: 1 },
  emptyWrap: { paddingVertical: 34, paddingHorizontal: 8, gap: 6 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 19 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  menuLabel: { flex: 1, fontFamily: fonts.body, fontSize: 14.5 },
  menuValue: { fontFamily: fonts.body, fontSize: 12.5 },
});
