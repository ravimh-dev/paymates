export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

export interface JWTPayload {
  id: string;
  name: string;
  email: string;
  role: string;
}
