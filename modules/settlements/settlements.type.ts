export interface SettlementTransaction {
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  amount: number;
  currency: string;
}

export interface SettlementPlan {
  group_id: string;
  transactions: SettlementTransaction[];
  total_transactions: number;
  computed_at: string;
}

export interface ExecuteSettlementInput {
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  settlement_type?: 'full' | 'partial';
  notes?: string;
  idempotency_key?: string;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'cancelled';
  settlement_type: 'full' | 'partial';
  notes?: string;
  settled_at?: Date;
  created_at: Date;
}

export interface SettlementHistory extends Settlement {
  from_name: string;
  to_name: string;
}

// Heap node used internally by the settlement algorithm
export interface BalanceNode {
  userId: string;
  name: string;
  balance: number;
}
