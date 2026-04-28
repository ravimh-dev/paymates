export interface Group {
  id: string;
  name: string;
  description?: string;
  currency: string;
  status: 'active' | 'settling' | 'archived';
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  currency?: string;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  status?: 'active' | 'settling' | 'archived';
}

export interface GroupMember {
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: 'admin' | 'member' | 'viewer';
  joined_at: Date;
}

export interface GroupSummary extends Group {
  members: GroupMember[];
  total_expenses: number;
  member_count: number;
  settlement_status: 'settled' | 'pending';
}

export interface MemberBalance {
  user_id: string;
  name: string;
  email: string;
  balance: number; // positive = creditor, negative = debtor
}

export interface AddMemberInput {
  email: string;
  role?: 'member' | 'viewer';
}
