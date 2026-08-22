import { Text, type TextProps } from '@mantine/core';
import { fmtMoney, fmtMoneyExact, fmtSigned } from '@/lib/money';

type Props = TextProps & {
  value: number | string;
  currency?: 'RUB' | 'USD';
  signed?: boolean;
  colored?: boolean;
  /** всегда показывать копейки: 100 → «100,00 ₽» */
  exact?: boolean;
};

/** Сумма в моноширинных табличных цифрах. */
export function Money({ value, currency = 'RUB', signed, colored, exact, c, ...rest }: Props) {
  const n = typeof value === 'string' ? Number(value) : value;
  const text = signed ? fmtSigned(n, currency) : exact ? fmtMoneyExact(n, currency) : fmtMoney(n, currency);
  // exact-режим гасит нули серым; явный c от вызывающего важнее
  const auto = colored
    ? n > 0 ? 'ink.7' : n < 0 ? 'red.8' : undefined
    : exact && Math.abs(n) < 0.005 ? 'dimmed' : undefined;
  return (
    <Text span className="money" c={c ?? auto} {...rest}>
      {text}
    </Text>
  );
}
