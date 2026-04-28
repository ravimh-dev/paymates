export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  timezone: string;
  currency: string;
  email_verified: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateProfileInput {
  name?: string;
  avatar_url?: string;
  timezone?: string;
  currency?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
