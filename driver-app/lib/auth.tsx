import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import "./backgroundLocation";
import { login as apiLogin } from "./api";
import type { Driver } from "./types";

const TOKEN_KEY = "lamatic_driver_token";
const DRIVER_KEY = "lamatic_driver_profile";

type AuthState = {
  token: string | null;
  driver: Driver | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedDriver = await SecureStore.getItemAsync(DRIVER_KEY);
        if (storedToken && storedDriver) {
          setToken(storedToken);
          setDriver(JSON.parse(storedDriver) as Driver);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    await SecureStore.setItemAsync(DRIVER_KEY, JSON.stringify(res.driver));
    setToken(res.token);
    setDriver(res.driver);
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(DRIVER_KEY);
    setToken(null);
    setDriver(null);
  }, []);

  const value = useMemo(
    () => ({ token, driver, loading, login, logout }),
    [token, driver, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
