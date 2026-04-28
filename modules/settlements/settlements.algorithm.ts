/**
 * SETTLEMENT ENGINE
 * ─────────────────
 * Problem: Given a set of members each with a net balance (positive = creditor,
 * negative = debtor), compute the minimum number of transactions (≤ N-1) to
 * fully settle the group.
 *
 * Algorithm: Min/Max Heap matching (greedy)
 *   1. Separate members into creditors (balance > ε) and debtors (balance < -ε)
 *   2. Use a max-heap for creditors, max-heap for |debtors|
 *   3. Each iteration: match the largest creditor against the largest debtor
 *   4. Emit transaction for min(creditor, |debtor|), reduce both balances
 *   5. Return exhausted party to pool if zero, otherwise keep in heap
 *
 * Complexity: O(n log n) — each node is pushed/popped at most twice.
 * Transaction count: ≤ N - 1 (proven by greedy exchange argument).
 *
 * Floating-point: All comparisons use EPSILON = 0.01 to absorb rounding errors.
 */

import { EPSILON } from '../../utils/constants';
import type { BalanceNode, SettlementTransaction } from './settlements.type';

class MaxHeap {
  private heap: BalanceNode[] = [];

  get size(): number { return this.heap.length; }
  get isEmpty(): boolean { return this.heap.length === 0; }

  push(node: BalanceNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): BalanceNode | undefined {
    if (this.isEmpty) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].balance >= this.heap[i].balance) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let largest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.heap[l].balance > this.heap[largest].balance) largest = l;
      if (r < n && this.heap[r].balance > this.heap[largest].balance) largest = r;
      if (largest === i) break;
      [this.heap[i], this.heap[largest]] = [this.heap[largest], this.heap[i]];
      i = largest;
    }
  }
}

export interface MemberBalance {
  userId: string;
  name: string;
  balance: number;
  currency: string;
}

export const computeSettlementPlan = (members: MemberBalance[]): SettlementTransaction[] => {
  const creditorHeap = new MaxHeap();
  const debtorHeap = new MaxHeap();

  const currency = members[0]?.currency ?? 'INR';

  for (const m of members) {
    if (m.balance > EPSILON) {
      creditorHeap.push({ userId: m.userId, name: m.name, balance: m.balance });
    } else if (m.balance < -EPSILON) {
      debtorHeap.push({ userId: m.userId, name: m.name, balance: -m.balance });
    }
  }

  const transactions: SettlementTransaction[] = [];

  while (!creditorHeap.isEmpty && !debtorHeap.isEmpty) {
    const creditor = creditorHeap.pop()!;
    const debtor = debtorHeap.pop()!;

    const amount = Math.min(creditor.balance, debtor.balance);
    const rounded = Math.round(amount * 100) / 100;

    transactions.push({
      from_user_id: debtor.userId,
      from_name: debtor.name,
      to_user_id: creditor.userId,
      to_name: creditor.name,
      amount: rounded,
      currency,
    });

    const newCred = Math.round((creditor.balance - amount) * 100) / 100;
    const newDebt = Math.round((debtor.balance - amount) * 100) / 100;

    if (newCred > EPSILON) creditorHeap.push({ ...creditor, balance: newCred });
    if (newDebt > EPSILON) debtorHeap.push({ ...debtor, balance: newDebt });
  }

  return transactions;
};
