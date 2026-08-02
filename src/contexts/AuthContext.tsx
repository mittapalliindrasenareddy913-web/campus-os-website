import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';

export interface UserProfile {
  _id?: string;
  fullName: string;
  role: string;
  collegeCode?: string;
  collegeName?: string;
  department?: string;
  assignedDepartment?: string;
  jobTitle?: string;
  assignedClasses?: { subject: string; year: number; section: string }[];
  semester?: number;
  section?: string;
  rollNumber?: string;
  bio?: string;
  mobileNumber?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  branch?: string;
  employeeId?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (collegeCode: string, emailOrEmployeeId: string, password: string, role: string) => Promise<{ success: boolean; requireFaceAuth?: boolean; tempToken?: string; error?: string }>;
  verifyFace: (tempToken: string, faceImageBase64: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshSession: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Helper: persist session to localStorage ───────────────────
const STORAGE_TOKEN_KEY = 'campus_web_token';
const STORAGE_REFRESH_KEY = 'campus_web_refresh_token';
const STORAGE_USER_KEY = 'campus_web_user';

const buildUserProfile = (data: any): UserProfile => ({
  _id: data.id || data._id,
  fullName: data.fullName,
  role: data.role,
  collegeCode: data.collegeCode,
  collegeName: data.collegeName || '',
  department: data.department,
  assignedDepartment: data.assignedDepartment || data.department || '',
  jobTitle: data.jobTitle,
  assignedClasses: data.assignedClasses,
  semester: data.semester,
  section: data.section,
  rollNumber: data.rollNumber,
});

const persistSession = (accessToken: string, refreshToken: string, user: UserProfile) => {
  localStorage.setItem(STORAGE_TOKEN_KEY, accessToken);
  localStorage.setItem(STORAGE_REFRESH_KEY, refreshToken);
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_REFRESH_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
};

// ── Provider ──────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const storedUserStr = localStorage.getItem(STORAGE_USER_KEY);
    if (storedToken && storedUserStr) {
      setToken(storedToken);
      const parsedUser = JSON.parse(storedUserStr);
      setUser(parsedUser);

      // Auto-heal: Resolve college name dynamically if missing in legacy session
      if (parsedUser.collegeCode && !parsedUser.collegeName) {
        api.get(`/college/details/${parsedUser.collegeCode}`)
          .then(res => {
            if (res.data && res.data.name) {
              const updatedUser = { ...parsedUser, collegeName: res.data.name };
              localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
              setUser(updatedUser);
              console.log('✅ College name auto-resolved and updated:', res.data.name);
            }
          })
          .catch(() => {});
      }
    }
    setLoading(false);
  }, []);

  // ── Refresh access token using stored refresh token ──────────
  const refreshSession = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem(STORAGE_REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const res = await api.post('/auth/campus/refresh', { refreshToken });
      const newAccessToken: string = res.data.accessToken;
      localStorage.setItem(STORAGE_TOKEN_KEY, newAccessToken);
      setToken(newAccessToken);
      return newAccessToken;
    } catch {
      // Refresh token itself expired — force logout
      clearSession();
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // ── Login ─────────────────────────────────────────────────────
  const login = async (
    collegeCode: string,
    emailOrEmployeeId: string,
    password: string,
    role: string
  ) => {
    try {
      const response = await api.post('/auth/campus/login', {
        collegeCode,
        emailOrEmployeeId,
        password,
        role,
      });

      const { data } = response;

      // Face auth step required
      if (data.requireFaceAuth) {
        return { success: true, requireFaceAuth: true, tempToken: data.tempToken };
      }

      // ✅ FIX: backend returns `accessToken` (not `token`)
      const accessToken: string = data.accessToken || data.token;
      const refreshToken: string = data.refreshToken || '';
      const userProfile = buildUserProfile(data);

      persistSession(accessToken, refreshToken, userProfile);
      setToken(accessToken);
      setUser(userProfile);

      return { success: true };
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Login failed. Connection refused.';
      return { success: false, error: errMsg };
    }
  };

  // ── Face verification ─────────────────────────────────────────
  const verifyFace = async (tempToken: string, faceImageBase64: string) => {
    try {
      const response = await api.post('/auth/campus/verify-face', {
        tempToken,
        faceImageBase64,
      });

      const { data } = response;
      const accessToken: string = data.accessToken || data.token;
      const refreshToken: string = data.refreshToken || '';
      const userProfile = buildUserProfile(data);

      persistSession(accessToken, refreshToken, userProfile);
      setToken(accessToken);
      setUser(userProfile);

      return { success: true };
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Face matching mismatch.';
      return { success: false, error: errMsg };
    }
  };

  // ── Logout ────────────────────────────────────────────────────
  const logout = () => {
    clearSession();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, verifyFace, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};
