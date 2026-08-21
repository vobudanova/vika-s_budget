import type { TxRow } from '@/queries/core';

export type SelectGroup = { group: string; items: { value: string; label: string }[] };

/** Категории трат → данные для Select с группами (без «Покупки» и «Амортизация»). */
export function categorySelectData(
  groups: { id: number; name: string }[],
  categories: { id: number; groupId: number; name: string }[],
  opts?: { exclude?: string[] },
): SelectGroup[] {
  const exclude = new Set(opts?.exclude ?? ['Покупки', 'Амортизация']);
  return groups
    .filter((g) => !exclude.has(g.name))
    .map((g) => ({
      group: g.name,
      items: categories
        .filter((c) => c.groupId === g.id)
        .map((c) => ({ value: String(c.id), label: c.name })),
    }))
    .filter((g) => g.items.length > 0);
}

export function accountSelectData(accounts: { id: number; name: string }[]) {
  return accounts.map((a) => ({ value: String(a.id), label: a.name }));
}

/** Человекочитаемое описание операции для лент. */
export function txLabel(t: TxRow): { title: string; detail: string | null } {
  switch (t.kind) {
    case 'expense':
      return {
        title: t.categoryName ?? 'Расход',
        detail:
          [t.amountExpr ? `= ${t.amountExpr}` : null, t.covered ? 'теневой' : null, t.note]
            .filter(Boolean)
            .join(' · ') || null,
      };
    case 'purchase':
      return { title: `Покупка: ${t.note ?? t.categoryName ?? ''}`.trim(), detail: t.categoryName };
    case 'income':
      return { title: t.incomeSourceName ?? 'Доход', detail: t.note };
    case 'transfer':
      return {
        title: `${t.accountName ?? '—'} → ${t.counterAccountName ?? '—'}`,
        detail:
          [
            t.fundAllocation === 'cap' ? 'размещение КАП' : t.fundAllocation === 'ks' ? 'размещение КС' : null,
            t.note,
          ]
            .filter(Boolean)
            .join(' · ') || null,
      };
    case 'saving':
      return {
        title: `Сбережение → ${t.counterAccountName ?? ''}`,
        detail: [t.acquiredNote, t.note].filter(Boolean).join(' · ') || null,
      };
    case 'reimbursement':
      return { title: `Из КС: ${t.fundCategoryName ?? ''}`, detail: t.note };
    case 'asset_resale':
      return { title: 'Перепродажа', detail: t.note };
    case 'coverage_in':
      return { title: 'Покрытие компенсацией', detail: t.note };
    default:
      return { title: t.kind, detail: t.note };
  }
}

/** Знак движения денег для отображения в ленте (с точки зрения «денег стало»). */
export function txSign(t: TxRow): number {
  switch (t.kind) {
    case 'income':
    case 'coverage_in':
    case 'asset_resale':
      return +1;
    case 'expense':
    case 'purchase':
    case 'reimbursement':
      return -1;
    default:
      return 0; // переводы и сбережения — внутренние
  }
}
