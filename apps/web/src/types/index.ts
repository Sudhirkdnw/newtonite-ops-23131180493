export * from '@newtonite/shared';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  systemRole: string;
}

export interface AuthState {
  user: UserSession | null;
  token: string | null;
  isAuthenticated: boolean;
}
