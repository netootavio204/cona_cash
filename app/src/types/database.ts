export type UserRole = 'user' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'blocked';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  sound_enabled: boolean;
  week_starts_on: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: number;
  signup_open: boolean;
  schema_version: string;
  app_version: string;
  created_at: string;
  updated_at: string;
}
