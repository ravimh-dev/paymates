export interface Expense {
  id: string;
  group_id: string;
  paid_by: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  split_type: 'equal' | 'percentage' | 'custom';
  expense_date: Date;
  notes?: string;
  receipt_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SplitInput {
  user_id: string;
  amount?: number;       // for custom splits
  percentage?: number;   // for percentage splits
}

export interface CreateExpenseInput {
  group_id: string;
  paid_by: string;
  description: string;
  amount: number;
  currency?: string;
  category?: string;
  split_type: 'equal' | 'percentage' | 'custom';
  participants?: string[];           // for equal splits
  splits?: SplitInput[];             // for custom/percentage splits
  expense_date?: string;
  notes?: string;
  receipt_url?: string;
}

export interface UpdateExpenseInput {
  description?: string;
  amount?: number;
  category?: string;
  split_type?: 'equal' | 'percentage' | 'custom';
  participants?: string[];
  splits?: SplitInput[];
  expense_date?: string;
  notes?: string;
}

export interface ExpenseFilters {
  groupId: string;
  category?: string;
  paidBy?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface ExpenseWithSplits extends Expense {
  splits: Array<{
    user_id: string;
    name: string;
    email: string;
    amount: number;
    percentage?: number;
    is_settled: boolean;
  }>;
  payer_name: string;
}
