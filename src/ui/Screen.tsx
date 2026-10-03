// Page chrome: a large title header and a scrolling body.

import React from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, T } from './kit.tsx';
import { useNav } from './nav.ts';
import { space, useTheme } from './theme.ts';

export function Header({
  title,
  back,
  right,
  subtitle,
  small,
}: {
  title: string;
  back?: boolean | (() => void);
  right?: React.ReactNode;
  subtitle?: string;
  small?: boolean;
}) {
  const nav = useNav();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space(2), backgroundColor: c.bg }]}>
      <View style={styles.headerRow}>
        {back ? (
          <IconButton name="back" label="Back" onPress={typeof back === 'function' ? back : nav.pop} style={{ marginLeft: -space(2) }} />
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v={small || back ? 'title' : 'display'} numberOfLines={1}>
            {title}
          </T>
          {subtitle ? (
            <T v="small" dim numberOfLines={1}>
              {subtitle}
            </T>
          ) : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

export function Body({ children, ...rest }: ScrollViewProps & { children: React.ReactNode }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...rest}
      contentContainerStyle={[{ paddingHorizontal: space(4), paddingBottom: space(32) }, rest.contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space(4), paddingBottom: space(2) },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: 44 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
});
