export interface Group {
  id: string;
  name: string;
  description: string;
  created_by: string;
  status: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  name?: string;
  email?: string;
}
