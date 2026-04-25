import { query } from '../../db/index.ts';

export interface SettlementPlan {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export const settlementService = {
  async computeOptimizedPlan(groupId: string): Promise<SettlementPlan[]> {
    // 1. Get all expenses and members for the group
    const expensesRes = await query('SELECT id, payer_id, amount FROM expenses WHERE group_id = $1', [groupId]);
    const expenses = expensesRes.rows;
    
    const membersRes = await query(`
      SELECT u.id, u.name 
      FROM users u
      JOIN group_members gm ON u.id = gm.user_id
      WHERE gm.group_id = $1
    `, [groupId]);
    const members = membersRes.rows;

    // Get all splits for all expenses in this group in one go
    const splitsRes = await query(`
      SELECT es.user_id, es.amount, es.expense_id 
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      WHERE e.group_id = $1
    `, [groupId]);
    const allSplits = splitsRes.rows;

    // map to store user balances
    const balances: Record<string, number> = {};
    const nameMap: Record<string, string> = {};

    members.forEach(m => {
      balances[m.id] = 0;
      nameMap[m.id] = m.name;
    });

    expenses.forEach(exp => {
      // Payer's balance increases by full amount
      balances[exp.payer_id] = (balances[exp.payer_id] || 0) + parseFloat(exp.amount);
      
      // Filter splits for this specific expense
      const expenseSplits = allSplits.filter(s => s.expense_id === exp.id);
      expenseSplits.forEach(split => {
        balances[split.user_id] = (balances[split.user_id] || 0) - parseFloat(split.amount);
      });
    });


    // 2. Classify Debtors and Creditors
    const debtors: { id: string; amount: number }[] = [];
    const creditors: { id: string; amount: number }[] = [];

    for (const [userId, balance] of Object.entries(balances)) {
      // Precision handling
      const fixedBalance = Math.round(balance * 100) / 100;
      if (fixedBalance < 0) {
        debtors.push({ id: userId, amount: Math.abs(fixedBalance) });
      } else if (fixedBalance > 0) {
        creditors.push({ id: userId, amount: fixedBalance });
      }
    }

    // 3. Greedy Matching Algorithm (Optimized Settlements)
    const plan: SettlementPlan[] = [];
    
    // Sort so we always match biggest debtor with biggest creditor
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d];
      const creditor = creditors[c];

      const settlementAmount = Math.min(debtor.amount, creditor.amount);
      if (settlementAmount > 0.01) { // Ignore dust amounts
        plan.push({
          from: debtor.id,
          fromName: nameMap[debtor.id],
          to: creditor.id,
          toName: nameMap[creditor.id],
          amount: Math.round(settlementAmount * 100) / 100
        });
      }

      debtor.amount -= settlementAmount;
      creditor.amount -= settlementAmount;

      if (debtor.amount < 0.01) d++;
      if (creditor.amount < 0.01) c++;
    }

    return plan;
  }
};
