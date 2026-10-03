// Shared building blocks: buttons, cards, rows, sheets, dialogs, inputs.

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon.tsx';
import { radius, space, type, useTheme } from './theme.ts';
import { getState } from '../state/store.ts';

/**
 * Run `fn` once a closing sheet has finished animating away. iOS will not
 * present a new modal while another is still being dismissed — it fails
 * silently — so any sheet that opens another sheet or a dialog goes through
 * here. The browser has no such rule.
 */
export function afterModal(fn: () => void) {
  if (Platform.OS === 'ios') setTimeout(fn, 450);
  else fn();
}

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web' || !getState().db.settings.haptics) return;
  try {
    const H = require('expo-haptics') as typeof import('expo-haptics');
    if (kind === 'success') void H.notificationAsync(H.NotificationFeedbackType.Success);
    else if (kind === 'warning') void H.notificationAsync(H.NotificationFeedbackType.Warning);
    else void H.impactAsync(kind === 'medium' ? H.ImpactFeedbackStyle.Medium : H.ImpactFeedbackStyle.Light);
  } catch {}
}

export function T({
  children,
  style,
  v = 'body',
  dim,
  faint,
  color,
  numberOfLines,
  center,
  testID,
}: {
  testID?: string;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  v?: keyof typeof type;
  dim?: boolean;
  faint?: boolean;
  color?: string;
  numberOfLines?: number;
  center?: boolean;
}) {
  const c = useTheme();
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[type[v], { color: color ?? (faint ? c.textFaint : dim ? c.textDim : c.text) }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  style,
  small,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const c = useTheme();
  const bg = kind === 'primary' ? c.accent : kind === 'secondary' ? c.surfaceAlt : kind === 'danger' ? c.dangerSoft : 'transparent';
  const fg = kind === 'primary' ? c.accentText : kind === 'danger' ? c.danger : kind === 'ghost' ? c.accent : c.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={small ? 16 : 19} color={fg} strokeWidth={2.3} />}
      <Text style={[small ? type.smallStrong : type.bodyStrong, { color: fg, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  color,
  size = 22,
  label,
  style,
  bg,
}: {
  name: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
  style?: StyleProp<ViewStyle>;
  bg?: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, bg ? { backgroundColor: bg } : null, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Icon name={name} size={size} color={color ?? c.text} />
    </Pressable>
  );
}

export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const c = useTheme();
  const base = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (!onPress) return <View style={base} testID={testID}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.8 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function SectionLabel({ children, right, style }: { children: React.ReactNode; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionLabel, style]}>
      <T v="label" dim>
        {children}
      </T>
      {right}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  left,
  right,
  onPress,
  chevron,
  danger,
  testID,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  const c = useTheme();
  const body = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="bodyStrong" color={danger ? c.danger : undefined} numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T v="small" dim numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
      {chevron && <Icon name="chevron" size={18} color={c.textFaint} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      {body}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: inset }} />;
}

export function Chip({
  label,
  active,
  onPress,
  color,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: IconName;
}) {
  const c = useTheme();
  const fg = active ? c.accentText : color ?? c.textDim;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? c.accent : c.surfaceAlt, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon && <Icon name={icon} size={14} color={fg} strokeWidth={2.2} />}
      <Text style={[type.caption, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surfaceAlt }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: c.raised }]}
          >
            <Text style={[type.smallStrong, { color: on ? c.text : c.textDim }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const c = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space(1.5) }}>
      {label ? (
        <T v="label" dim>
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={c.textFaint}
        {...rest}
        style={[styles.field, { backgroundColor: c.surfaceAlt, color: c.text, borderColor: c.border }, style]}
      />
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.surfaceAlt }]}>
        <Icon name={icon} size={30} color={c.textDim} />
      </View>
      <T v="heading" center>
        {title}
      </T>
      <T dim center style={{ maxWidth: 300 }}>
        {body}
      </T>
      {action}
    </View>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T v="label" faint>
        {label}
      </T>
      <T v="title" color={accent ? c.accent : undefined} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
      {sub ? (
        <T v="caption" dim>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bottom sheet

export function Sheet({
  visible,
  onClose,
  title,
  children,
  full,
  right,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  full?: boolean;
  right?: React.ReactNode;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, space(4)) },
            full ? { height: '92%' } : { maxHeight: '88%' },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          {title ? (
            <View style={styles.sheetHeader}>
              <T v="title" style={{ flex: 1 }} numberOfLines={1}>
                {title}
              </T>
              {right}
              <IconButton name="close" label="Close" onPress={onClose} bg={c.surfaceAlt} size={18} />
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function SheetScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space(5), paddingBottom: space(4), gap: space(3) }}>
      {children}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Dialogs. Alert.alert does nothing on web, so the app draws its own.

export interface DialogButton {
  label: string;
  kind?: 'default' | 'cancel' | 'danger' | 'primary';
  onPress?: () => void;
}

interface DialogSpec {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let showDialog: ((d: DialogSpec | null) => void) | null = null;

export function ask(title: string, message: string | undefined, buttons: DialogButton[]) {
  showDialog?.({ title, message, buttons });
}

export function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void, danger = true) {
  ask(title, message, [
    { label: 'Cancel', kind: 'cancel' },
    { label: confirmLabel, kind: danger ? 'danger' : 'primary', onPress: onConfirm },
  ]);
}

export function DialogHost() {
  const c = useTheme();
  const [spec, setSpec] = useState<DialogSpec | null>(null);
  useEffect(() => {
    showDialog = setSpec;
    return () => {
      showDialog = null;
    };
  }, []);
  if (!spec) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setSpec(null)}>
      <View style={[styles.dialogWrap, { backgroundColor: c.overlay }]}>
        <View style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.border }]}>
          <T v="heading" center>
            {spec.title}
          </T>
          {spec.message ? (
            <T dim center v="small">
              {spec.message}
            </T>
          ) : null}
          <View style={{ gap: space(2), marginTop: space(3) }}>
            {spec.buttons.map((b) => (
              <Button
                key={b.label}
                label={b.label}
                kind={b.kind === 'danger' ? 'danger' : b.kind === 'primary' ? 'primary' : b.kind === 'cancel' ? 'ghost' : 'secondary'}
                onPress={() => {
                  setSpec(null);
                  b.onPress?.();
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Toasts

let showToast: ((t: { text: string; icon?: IconName } | null) => void) | null = null;

export function toast(text: string, icon?: IconName) {
  showToast?.({ text, icon });
}

export function ToastHost() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [t, setT] = useState<{ text: string; icon?: IconName } | null>(null);
  useEffect(() => {
    showToast = setT;
    return () => {
      showToast = null;
    };
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 2600);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return (
    <View pointerEvents="none" style={[styles.toast, { top: insets.top + space(2), backgroundColor: c.raised, borderColor: c.border }]}>
      {t.icon && <Icon name={t.icon} size={18} color={c.accent} />}
      <T v="smallStrong">{t.text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: space(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space(3.5), borderRadius: radius.sm },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space(4) },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space(5),
    marginBottom: space(2),
    paddingHorizontal: space(1),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), minHeight: 52 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: space(2), borderRadius: radius.sm + 1 },
  field: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
    fontSize: 16,
  },
  empty: { alignItems: 'center', gap: space(2.5), paddingVertical: space(10), paddingHorizontal: space(6) },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: space(1) },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: space(2) },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: space(2) },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(5),
    paddingBottom: space(3),
  },
  dialogWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8) },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    padding: space(5),
    gap: space(2),
    borderWidth: StyleSheet.hairlineWidth,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
  },
});
