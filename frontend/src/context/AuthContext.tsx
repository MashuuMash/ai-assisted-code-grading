import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken } from '../api/client';
import { ForgotPasswordResponse, OtpResendResponse, User } from '../types';
import { demoUser } from '../data/demoFixtures';

interface RegisterInput {
  full_name: string;
  username: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username_or_email: string, password: string) => Promise<void>;
  register: (payload: RegisterInput) => Promise<User>;
  verifyOtp: (email_or_username: string, otp_code: string) => Promise<void>;
  resendOtp: (email_or_username: string) => Promise<OtpResendResponse>;
  forgotPassword: (email_or_username: string) => Promise<ForgotPasswordResponse>;
  resetPassword: (email_or_username: string, otp_code: string, new_password: string) => Promise<void>;
  updateProfile: (full_name: string) => Promise<void>;
  changePassword: (current_password: string, new_password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const u = await api.auth.getMe();
        setUser(u);
      } catch {
        const isDemo = typeof window !== 'undefined' && localStorage.getItem('is_demo_mode') === 'true';
        if (isDemo) {
          try {
            const stored = localStorage.getItem('demo_seed_data');
            const parsed = stored ? JSON.parse(stored) : null;
            if (parsed?.user) {
              setUser(parsed.user);
              return;
            }
          } catch {
            // ignore
          }
          setUser(demoUser);
          return;
        }
        setToken(null);
        setTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  const login = async (username_or_email: string, password: string) => {
    const res = await api.auth.loginJson(username_or_email, password);
    setTokenState(res.access_token);
    const u = await api.auth.getMe();
    setUser(u);
  };

  const register = async (payload: RegisterInput): Promise<User> => {
    const registeredUser = await api.auth.register(payload);
    if (registeredUser.is_email_verified && !registeredUser.otp_required) {
      const res = await api.auth.loginJson(payload.username, payload.password);
      setTokenState(res.access_token);
      const u = await api.auth.getMe();
      setUser(u);
    }
    return registeredUser;
  };

  const verifyOtp = async (email_or_username: string, otp_code: string): Promise<void> => {
    const res = await api.auth.verifyOtp(email_or_username, otp_code);
    setTokenState(res.access_token);
    const u = await api.auth.getMe();
    setUser(u);
  };

  const resendOtp = async (email_or_username: string): Promise<OtpResendResponse> => {
    return await api.auth.resendOtp(email_or_username);
  };

  const forgotPassword = async (email_or_username: string): Promise<ForgotPasswordResponse> => {
    return await api.auth.forgotPassword(email_or_username);
  };

  const resetPassword = async (
    email_or_username: string,
    otp_code: string,
    new_password: string
  ): Promise<void> => {
    const res = await api.auth.resetPassword({
      email_or_username,
      otp_code,
      new_password,
    });
    if (res.access_token) {
      setTokenState(res.access_token);
      const u = await api.auth.getMe();
      setUser(u);
    }
  };

  const updateProfile = async (full_name: string): Promise<void> => {
    const updated = await api.auth.updateProfile(full_name);
    setUser(updated);
  };

  const changePassword = async (current_password: string, new_password: string): Promise<void> => {
    await api.auth.changePassword(current_password, new_password);
  };

  const logout = () => {
    localStorage.removeItem('is_demo_mode');
    localStorage.removeItem('demo_seed_data');
    api.auth.logout();
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        verifyOtp,
        resendOtp,
        forgotPassword,
        resetPassword,
        updateProfile,
        changePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
