import { Text, type TextProps } from '@mantine/core';
import { fmtMoney, fmtSigned } from '@/lib/money';

type Props = TextProps & {
  value: number | string;
  currency?: 'RUB' | 'USD';
  signed?: boolean;
  colored?: boolean;
};

/** Сумма в моноширинных табличных цифрах. */
export function Money({ value, currency = 'RUB', signed, colored, ...rest }: Props) {
  const n = typeof value === 'string' ? Number(value) : value;
  const text = signed ? fmtSigned(n, currency) : fmtMoney(n, currency);
  const color = colored ? (n > 0 ? 'ink.7' : n < 0 ? 'red.8' : undefined) : undefined;
  return (
    <Text span className="money" c={color} {...rest}>
      {text}
    </Text>
  );
}
