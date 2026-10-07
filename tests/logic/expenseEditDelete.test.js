import { calculateBalances } from '@/logic/balance';

// Mirrors the app's edit/delete semantics in divvy.html:
//  - edit replaces payer/amount/description/beneficiaries and bumps lastModified
//  - delete is a soft delete (deleted: true); balances use only non-deleted expenses
const visible = (expenses) => expenses.filter((e) => !e.deleted);
const edit = (exp, changes) => ({ ...exp, ...changes, lastModified: 'later' });
const softDelete = (exp) => ({ ...exp, deleted: true, lastModified: 'later' });

describe('Editing and deleting expenses', () => {
  const people = ['Alice', 'Bob', 'Carol'];
  const base = () => ([
    { id: 'a', payer: 'Alice', amount: 90, description: 'Dinner', beneficiaries: [...people], deleted: false, lastModified: 'first' },
    { id: 'b', payer: 'Bob', amount: 30, description: 'Taxi', beneficiaries: ['Alice', 'Bob'], deleted: false, lastModified: 'first' },
  ]);

  test('editing the amount updates balances', () => {
    const expenses = base().map((e) => (e.id === 'a' ? edit(e, { amount: 60 }) : e));
    const b = calculateBalances(visible(expenses), people);
    expect(b.get('Alice')).toBeCloseTo(60 - 20 - 15);
    expect(b.get('Carol')).toBeCloseTo(-20);
  });

  test('editing the payer moves the credit', () => {
    const expenses = base().map((e) => (e.id === 'a' ? edit(e, { payer: 'Carol' }) : e));
    const b = calculateBalances(visible(expenses), people);
    expect(b.get('Carol')).toBeCloseTo(90 - 30);
    expect(b.get('Alice')).toBeCloseTo(-30 - 15);
  });

  test('editing beneficiaries changes who owes', () => {
    const expenses = base().map((e) => (e.id === 'a' ? edit(e, { beneficiaries: ['Alice', 'Bob'] }) : e));
    const b = calculateBalances(visible(expenses), people);
    expect(b.get('Carol')).toBeCloseTo(0);
  });

  test('deleted expenses are excluded from balances', () => {
    const expenses = base().map((e) => (e.id === 'a' ? softDelete(e) : e));
    const b = calculateBalances(visible(expenses), people);
    expect(b.get('Bob')).toBeCloseTo(30 - 15);
    expect(b.get('Alice')).toBeCloseTo(-15);
    expect(b.get('Carol')).toBeCloseTo(0);
  });

  test('delete keeps the record and bumps lastModified for sync', () => {
    const [orig] = base();
    const deleted = softDelete(orig);
    expect(deleted.deleted).toBe(true);
    expect(deleted.id).toBe(orig.id);
    expect(deleted.lastModified).not.toBe(orig.lastModified);
  });

  test('deleting everything leaves zero balances', () => {
    const b = calculateBalances(visible(base().map(softDelete)), people);
    people.forEach((p) => expect(b.get(p)).toBeCloseTo(0));
  });
});
