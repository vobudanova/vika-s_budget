'use client';

import { createTheme, rem, MantineColorsTuple } from '@mantine/core';

/** Фирменный лососевый (#FA8072 — базовый тон в позиции 5). */
const ink: MantineColorsTuple = [
  '#FFF1EE',
  '#FFE2DC',
  '#FEC8BE',
  '#FDAEA0',
  '#FC9686',
  '#FA8072',
  '#EE6857',
  '#D14A3C',
  '#A93A2E',
  '#7E2B22',
];

export const theme = createTheme({
  primaryColor: 'ink',
  primaryShade: 7,
  colors: { ink },
  defaultRadius: 'md',
  cursorType: 'pointer',
  fontFamily:
    'var(--font-golos), -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: 'var(--font-jbmono), ui-monospace, SFMono-Regular, Menlo, monospace',
  headings: {
    fontFamily:
      'var(--font-golos), -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: rem(26), lineHeight: '1.25' },
      h2: { fontSize: rem(20), lineHeight: '1.3' },
      h3: { fontSize: rem(16), lineHeight: '1.35' },
      h4: { fontSize: rem(14), lineHeight: '1.4' },
    },
  },
  components: {
    Card: {
      defaultProps: { withBorder: true, shadow: 'none', radius: 'lg', padding: 'md' },
    },
    Paper: {
      defaultProps: { withBorder: true, shadow: 'none', radius: 'lg' },
    },
    Button: {
      defaultProps: { radius: 'md' },
    },
    Table: {
      defaultProps: { verticalSpacing: 6, horizontalSpacing: 'sm' },
    },
    Modal: {
      defaultProps: { radius: 'lg', overlayProps: { backgroundOpacity: 0.35, blur: 2 } },
    },
    Drawer: {
      defaultProps: { overlayProps: { backgroundOpacity: 0.35, blur: 2 } },
    },
    Tooltip: {
      defaultProps: { withArrow: true },
    },
    Skeleton: {
      defaultProps: { radius: 'md' },
    },
  },
});
