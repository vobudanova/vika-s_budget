'use client';

import { useTransition } from 'react';
import {
  ActionIcon,
  Alert,
  Card,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import type { YearSheet } from '@/queries/year';
import type { SheetSection, SheetRow } from '@/queries/month';
import { RU_MONTHS } from '@/lib/dates';
import { fmtNumber, fmtMoney } from '@/lib/money';
import { deleteCategoryHard } from '@/actions/reference';

const TONE_BG: Record<SheetSection['tone'], string> = {
  plain: 'transparent',
  purchases: '#FFF4E2',
  amortization: '#F1EFFA',
  trips: '#E9F4EF',
  transfers: '#EAF2FB',
  ks: '#FDECEF',
  savings: '#F1F7E8',
};

export function YearView({ data }: { data: YearSheet }) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Stack gap="md">
      {data.pendingWarnings.filter((w) => w.months.length > 0).length > 0 && (
        <Alert color="red" variant="light" radius="lg" title="Категории, помеченные к удалению, ещё содержат данные">
          <Stack gap={4}>
            {data.pendingWarnings
              .filter((w) => w.months.length > 0)
              .map((w) => (
                <Text key={w.name} fz="sm">
                  «{w.groupName} → {w.name}»: {fmtMoney(w.total)} в месяцах {w.months.join(', ')}.
                  Перенесите записи — корзинка появится, когда всё обнулится.
                </Text>
              ))}
          </Stack>
        </Alert>
      )}

      <Card p={0}>
        <ScrollArea type="auto" offsetScrollbars>
          <Table className="sheet" fz={13} verticalSpacing={7} horizontalSpacing={12} miw={1100} stickyHeader withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={firstCol}>Категория</Table.Th>
                <Table.Th ta="right" style={{ minWidth: 96 }}>
                  Σ год
                </Table.Th>
                {months.map((m) => (
                  <Table.Th key={m} ta="center" px={8} style={{ minWidth: 86 }}>
                    <Text fz={13} fw={600} c="dimmed" tt="capitalize">
                      {RU_MONTHS[m - 1].slice(0, 3)}
                    </Text>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td style={firstCol}>
                  <Text fz={13} fw={700}>
                    Начисленные
                  </Text>
                </Table.Td>
                <NumCell v={data.accruedTotal} strong />
                {months.map((m) => (
                  <NumCell key={m} v={data.accruedTotals[m]} strong />
                ))}
              </Table.Tr>
              <Table.Tr>
                <Table.Td style={firstCol}>
                  <Text fz={13} c="gray.5">
                    фактические
                  </Text>
                </Table.Td>
                <NumCell v={data.actualTotal} muted />
                {months.map((m) => (
                  <NumCell key={m} v={data.actualTotals[m]} muted />
                ))}
              </Table.Tr>

              {data.sections.map((s) => (
                <Section key={s.key} s={s} months={months} />
              ))}

              {/* Доходы и баланс года */}
              <Table.Tr bg="var(--mantine-color-gray-0)">
                <Table.Td style={{ ...firstCol, background: 'var(--mantine-color-gray-0)' }}>
                  <Text fz={13} fw={700} c="ink.8">
                    Доходы
                  </Text>
                </Table.Td>
                <NumCell v={data.incomeYear} strong />
                {months.map((m) => (
                  <NumCell key={m} v={data.incomeTotals[m]} strong />
                ))}
              </Table.Tr>
              {data.income.map((r) => (
                <Table.Tr key={r.key}>
                  <Table.Td style={firstCol}>
                    <Text fz={13} pl={14} c="dark.4" truncate>
                      {r.name}
                    </Text>
                  </Table.Td>
                  <NumCell v={r.total} mutedTotal />
                  {months.map((m) => (
                    <NumCell key={m} v={r.days[m]} />
                  ))}
                </Table.Tr>
              ))}
              <Table.Tr style={{ borderTop: '2px solid var(--ink-line)' }}>
                <Table.Td style={firstCol}>
                  <Text fz={13} fw={700}>
                    Доходы − расходы
                  </Text>
                </Table.Td>
                <DiffCell v={data.incomeYear - data.actualTotal} />
                {months.map((m) => (
                  <DiffCell key={m} v={data.incomeTotals[m] - data.actualTotals[m]} />
                ))}
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Text fz="xs" c="dimmed">
        Компенсировано из КС за год: {fmtMoney(data.ksReimbursedYear)} · теневые расходы:{' '}
        {fmtMoney(data.coveredYear)} — в итоги расходов не входят. «Доходы − расходы» считается по
        фактическому методу.
      </Text>
    </Stack>
  );
}

function Section({ s, months }: { s: SheetSection; months: number[] }) {
  const bg = TONE_BG[s.tone];
  const rowBg = bg === 'transparent' ? undefined : bg;
  return (
    <>
      <Table.Tr bg={bg === 'transparent' ? 'var(--mantine-color-gray-0)' : bg}>
        <Table.Td style={{ ...firstCol, background: bg === 'transparent' ? 'var(--mantine-color-gray-0)' : bg }}>
          <Text fz={13} fw={700}>
            {s.title}
          </Text>
        </Table.Td>
        <NumCell v={s.total} strong />
        {months.map((m) => (
          <NumCell key={m} v={s.dayTotals[m]} strong />
        ))}
      </Table.Tr>
      {s.rows.map((r) => (
        <Table.Tr key={r.key} bg={rowBg}>
          <Table.Td style={{ ...firstCol, background: rowBg ?? 'var(--mantine-color-white)' }}>
            <Group gap={6} wrap="nowrap">
              <Text
                fz={13}
                pl={14}
                c={r.pendingDelete ? 'red.7' : 'dark.4'}
                truncate
                td={r.pendingDelete ? 'line-through' : undefined}
              >
                {r.name}
              </Text>
              {r.pendingDelete && Math.abs(r.total) < 0.005 && <DeleteCategoryButton row={r} />}
            </Group>
          </Table.Td>
          <NumCell v={r.total} mutedTotal />
          {months.map((m) => (
            <NumCell key={m} v={r.days[m]} />
          ))}
        </Table.Tr>
      ))}
    </>
  );
}

/** Красная корзинка: окончательное удаление обнулённой категории. */
function DeleteCategoryButton({ row }: { row: SheetRow }) {
  const [pending, startTransition] = useTransition();
  const remove = () =>
    startTransition(async () => {
      if (!confirm(`Навсегда удалить категорию «${row.name}»? Она исчезнет отовсюду.`)) return;
      const res = await deleteCategoryHard(Number(row.key));
      notifications.show(
        res.ok ? { message: `Категория «${row.name}» удалена` } : { color: 'red', message: res.error },
      );
    });
  return (
    <Tooltip label="Удалить навсегда (данных не осталось)">
      <ActionIcon size="xs" color="red" variant="subtle" onClick={remove} loading={pending} aria-label="Удалить категорию">
        <IconTrash size={13} />
      </ActionIcon>
    </Tooltip>
  );
}

function NumCell({
  v,
  strong,
  muted,
  mutedTotal,
}: {
  v: number;
  strong?: boolean;
  muted?: boolean;
  mutedTotal?: boolean;
}) {
  const isZero = Math.abs(v) < 0.005;
  return (
    <Table.Td
      ta="right"
      className="money"
      fw={strong ? 700 : undefined}
      c={muted ? 'gray.5' : isZero ? 'gray.4' : mutedTotal ? 'gray.6' : undefined}
    >
      {isZero ? '0' : fmtNumber(v, 0)}
    </Table.Td>
  );
}

function DiffCell({ v }: { v: number }) {
  const isZero = Math.abs(v) < 0.005;
  return (
    <Table.Td ta="right" className="money" fw={700} c={isZero ? 'gray.4' : v > 0 ? 'teal.8' : 'red.8'}>
      {isZero ? '0' : fmtNumber(v, 0)}
    </Table.Td>
  );
}

const firstCol: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--mantine-color-white)',
  minWidth: 210,
  zIndex: 1,
};
