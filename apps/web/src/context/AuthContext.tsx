import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loginUser,
  fetchCurrentUser,
  type UserProfile,
  type AuthResponse,
} from '../services/api';

const TOKEN_STORAGE_KEY = 'newtonite_auth_token';

interface AuthContextType {
  currentUser: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<AuthResponse>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  switchPersona: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setToken(null);
    setCurrentUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const user = await fetchCurrentUser(token);
      setCurrentUser(user);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 404) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(
    async (email: string, password = 'Demo@Newtonite2026!'): Promise<AuthResponse> => {
      setIsLoading(true);
      try {
        const auth = await loginUser(email, password);
        try {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, auth.token);
        } catch {
          // ignore storage errors
        }
        setToken(auth.token);
        setCurrentUser(auth.user);
        return auth;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const switchPersona = useCallback(
    async (email: string): Promise<void> => {
      await login(email);
    },
    [login]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isLoading,
        login,
        logout,
        refreshProfile,
        switchPersona,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
