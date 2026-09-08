import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  supabase,
  fetchAdminSettingsDb,
  saveAdminSettingsDb,
  fetchClientAccountsDb,
  saveClientAccountDb,
  deleteClientAccountDb,
} from '../lib/supabase';

export interface ClientAccount {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
  role: 'client' | 'tenant' | 'viewer';
  assignedTenant?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'client' | 'tenant' | 'viewer';
  assignedTenant?: string;
  loginTime: string;
}

interface AdminStoredCredentials {
  email: string;
  name: string;
  password?: string;
}

interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  adminPassword?: string;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateAdminProfile: (updates: { name: string; email: string; password?: string }) => Promise<{ success: boolean; error?: string; warning?: string }>;
  resetToEnvDefaults: () => void;
  // Client account management
  clientAccounts: ClientAccount[];
  addClientAccount: (account: Omit<ClientAccount, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string; warning?: string }>;
  updateClientAccount: (id: string, updates: Partial<ClientAccount>) => Promise<{ success: boolean; error?: string; warning?: string }>;
  deleteClientAccount: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const AUTH_STORAGE_KEY = 'bms_admin_auth_session';
const CUSTOM_CREDS_KEY = 'bms_admin_custom_credentials';
const CLIENT_ACCOUNTS_KEY = 'bms_client_accounts';

// Environment-configured Administrator credentials
const ENV_ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@intersys.com').trim().toLowerCase();
const ENV_ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD || 'admin12345.intersys').trim();
const ENV_ADMIN_USER = ENV_ADMIN_EMAIL.split('@')[0];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [clientAccounts, setClientAccounts] = useState<ClientAccount[]>([]);
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_CREDS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.password) return parsed.password;
      }
    } catch {}
    return ENV_ADMIN_PASSWORD;
  });

  // Load client accounts from storage and sync from Supabase
  useEffect(() => {
    let localClientsList: ClientAccount[] = [];
    try {
      const storedClients = localStorage.getItem(CLIENT_ACCOUNTS_KEY);
      if (storedClients) {
        localClientsList = JSON.parse(storedClients);
        setClientAccounts(localClientsList);
      }
    } catch (err) {
      console.warn('Failed to load client accounts from storage:', err);
    }

    // Fetch latest Admin Settings from Supabase
    fetchAdminSettingsDb().then(async (dbAdmin) => {
      if (dbAdmin) {
        localStorage.setItem(CUSTOM_CREDS_KEY, JSON.stringify(dbAdmin));
        if (dbAdmin.password) {
          setAdminPassword(dbAdmin.password);
        }
        setUser((prev) => {
          if (prev && prev.role === 'admin') {
            const updated = { ...prev, name: dbAdmin.name, email: dbAdmin.email };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
            return updated;
          }
          return prev;
        });
      } else {
        // Supabase does not have admin record yet: push current creds up to Supabase
        const custom = getCustomCreds();
        const initialCreds = custom || {
          name: 'System Administrator',
          email: ENV_ADMIN_EMAIL,
          password: ENV_ADMIN_PASSWORD,
        };
        await saveAdminSettingsDb(initialCreds);
      }
    });

    // Fetch latest Client Accounts from Supabase & bi-directional sync
    fetchClientAccountsDb().then(async (dbClients) => {
      if (dbClients && dbClients.length > 0) {
        setClientAccounts(dbClients);
        localStorage.setItem(CLIENT_ACCOUNTS_KEY, JSON.stringify(dbClients));

        // If local storage has accounts that aren't yet in Supabase, push them up
        const dbIds = new Set(dbClients.map((c) => c.id));
        for (const localAcc of localClientsList) {
          if (!dbIds.has(localAcc.id)) {
            await saveClientAccountDb(localAcc);
          }
        }
      } else if (localClientsList.length > 0) {
        // Supabase returned 0 rows, sync all local accounts up to Supabase
        for (const localAcc of localClientsList) {
          await saveClientAccountDb(localAcc);
        }
      }
    });

    // Realtime channel for live multi-user sync
    const realtimeChannel = supabase
      .channel('realtime_auth_and_clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_settings' }, (payload) => {
        const row: any = payload.new;
        if (row && row.name && row.email) {
          const creds = { name: row.name, email: row.email, password: row.password };
          localStorage.setItem(CUSTOM_CREDS_KEY, JSON.stringify(creds));
          if (row.password) {
            setAdminPassword(row.password);
          }
          setUser((prev) => (prev && prev.role === 'admin' ? { ...prev, name: row.name, email: row.email } : prev));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_accounts' }, () => {
        fetchClientAccountsDb().then((dbClients) => {
          if (dbClients) {
            setClientAccounts(dbClients);
            localStorage.setItem(CLIENT_ACCOUNTS_KEY, JSON.stringify(dbClients));
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const saveClientAccounts = (accounts: ClientAccount[]) => {
    setClientAccounts(accounts);
    try {
      localStorage.setItem(CLIENT_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {}
  };

  // Helper to load custom credentials if configured by user
  const getCustomCreds = (): AdminStoredCredentials | null => {
    try {
      const stored = localStorage.getItem(CUSTOM_CREDS_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  // Restore session from localStorage on initial mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: UserSession = JSON.parse(stored);
        if (parsed && parsed.id) {
          setUser(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to restore auth session from storage:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      return { success: false, error: 'Please enter both username/email and password.' };
    }

    const customCreds = getCustomCreds();

    // 1. Check custom saved Admin credentials (if edited)
    if (customCreds) {
      const customEmail = customCreds.email.toLowerCase().trim();
      const customUser = customEmail.split('@')[0];
      const customPass = customCreds.password ? customCreds.password.trim() : ENV_ADMIN_PASSWORD;

      const isCustomMatch =
        (cleanId === customEmail || cleanId === customUser || cleanId === 'admin') &&
        cleanPass === customPass;

      if (isCustomMatch) {
        const session: UserSession = {
          id: 'admin-001',
          email: customCreds.email,
          name: customCreds.name || 'System Administrator',
          role: 'admin',
          loginTime: new Date().toISOString(),
        };

        setUser(session);
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        } catch {}
        return { success: true };
      }
    }

    // 2. Check environment-configured Administrator credentials
    const isBuiltInAdmin =
      (cleanId === ENV_ADMIN_EMAIL || cleanId === ENV_ADMIN_USER || cleanId === 'admin') &&
      cleanPass === ENV_ADMIN_PASSWORD;

    if (isBuiltInAdmin) {
      const session: UserSession = {
        id: 'admin-001',
        email: cleanId.includes('@') ? cleanId : ENV_ADMIN_EMAIL,
        name: customCreds?.name || 'System Administrator',
        role: 'admin',
        loginTime: new Date().toISOString(),
      };

      setUser(session);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      } catch {}
      return { success: true };
    }

    // 3. Check Registered Client Accounts
    const clientAccountsList: ClientAccount[] = (() => {
      try {
        const stored = localStorage.getItem(CLIENT_ACCOUNTS_KEY);
        return stored ? JSON.parse(stored) : clientAccounts;
      } catch {
        return clientAccounts;
      }
    })();

    const matchedClient = clientAccountsList.find((c) => {
      const cEmail = (c.email || '').toLowerCase().trim();
      const cUser = (c.username || cEmail.split('@')[0]).toLowerCase().trim();
      return (cleanId === cEmail || cleanId === cUser) && cleanPass === (c.password || '').trim();
    });

    if (matchedClient) {
      if (matchedClient.status === 'SUSPENDED') {
        return {
          success: false,
          error: 'This account has been suspended by the administrator.',
        };
      }

      const session: UserSession = {
        id: matchedClient.id,
        email: matchedClient.email,
        name: matchedClient.name,
        role: matchedClient.role,
        assignedTenant: matchedClient.assignedTenant,
        loginTime: new Date().toISOString(),
      };

      setUser(session);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      } catch {}
      return { success: true };
    }

    // 4. Attempt Supabase Auth login if registered
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanId,
        password: cleanPass,
      });

      if (!error && data.user) {
        const session: UserSession = {
          id: data.user.id,
          email: data.user.email || cleanId,
          name: data.user.user_metadata?.full_name || 'System Administrator',
          role: 'admin',
          loginTime: new Date().toISOString(),
        };

        setUser(session);
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        } catch {}
        return { success: true };
      }
    } catch {
      // Ignore Supabase auth network error if offline
    }

    return {
      success: false,
      error: 'Invalid credentials. Please check your username/email and password.',
    };
  };

  // Add new client account
  const addClientAccount = async (
    account: Omit<ClientAccount, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; error?: string; warning?: string }> => {
    const cleanName = account.name.trim();
    const cleanEmail = account.email.trim().toLowerCase();
    const cleanUser = (account.username || cleanEmail.split('@')[0]).trim().toLowerCase();
    const cleanPass = account.password.trim();

    if (!cleanName) return { success: false, error: 'Client account name is required.' };
    if (!cleanEmail) return { success: false, error: 'Client email is required.' };
    if (!cleanPass) return { success: false, error: 'Password is required.' };
    if (cleanPass.length < 4) return { success: false, error: 'Password must be at least 4 characters.' };

    const exists = clientAccounts.some(
      (c) => c.email.toLowerCase() === cleanEmail || (c.username && c.username.toLowerCase() === cleanUser)
    );
    if (exists || cleanEmail === ENV_ADMIN_EMAIL || cleanUser === 'admin') {
      return { success: false, error: 'An account with this email or username already exists.' };
    }

    const newAccount: ClientAccount = {
      ...account,
      id: `client-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      email: cleanEmail,
      username: cleanUser,
      password: cleanPass,
      createdAt: new Date().toISOString(),
    };

    const next = [newAccount, ...clientAccounts];
    saveClientAccounts(next);
    const dbRes = await saveClientAccountDb(newAccount);
    if (!dbRes.success) {
      console.warn('Supabase client account save notice:', dbRes.error);
      return {
        success: true,
        warning: `Account created locally, but Supabase blocked sync: "${dbRes.error}". Check Row-Level Security in Supabase.`,
      };
    }
    return { success: true };
  };

  // Update existing client account
  const updateClientAccount = async (
    id: string,
    updates: Partial<ClientAccount>
  ): Promise<{ success: boolean; error?: string; warning?: string }> => {
    const next = clientAccounts.map((c) => (c.id === id ? { ...c, ...updates } : c));
    saveClientAccounts(next);
    const updated = next.find((c) => c.id === id);
    if (updated) {
      const dbRes = await saveClientAccountDb(updated);
      if (!dbRes.success) {
        return {
          success: true,
          warning: `Updated locally, but Supabase blocked sync: "${dbRes.error}".`,
        };
      }
    }
    return { success: true };
  };

  // Delete client account
  const deleteClientAccount = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const next = clientAccounts.filter((c) => c.id !== id);
    saveClientAccounts(next);
    await deleteClientAccountDb(id);
    return { success: true };
  };

  // Update Admin Profile (name, email, password)
  const updateAdminProfile = async (updates: {
    name: string;
    email: string;
    password?: string;
  }): Promise<{ success: boolean; error?: string; warning?: string }> => {
    const cleanName = updates.name.trim();
    const cleanEmail = updates.email.trim().toLowerCase();
    const cleanPassword = updates.password ? updates.password.trim() : undefined;

    if (!cleanName) {
      return { success: false, error: 'Administrator name cannot be empty.' };
    }
    if (!cleanEmail) {
      return { success: false, error: 'Administrator email cannot be empty.' };
    }
    if (cleanPassword && cleanPassword.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }

    const currentCreds = getCustomCreds();
    const nextCreds: AdminStoredCredentials = {
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword || currentCreds?.password || ENV_ADMIN_PASSWORD,
    };

    try {
      localStorage.setItem(CUSTOM_CREDS_KEY, JSON.stringify(nextCreds));
      const updatedSession: UserSession = {
        id: user?.id || 'admin-001',
        name: cleanName,
        email: cleanEmail,
        role: 'admin',
        loginTime: user?.loginTime || new Date().toISOString(),
      };
      setUser(updatedSession);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedSession));
      const dbRes = await saveAdminSettingsDb(nextCreds);
      if (!dbRes.success) {
        console.warn('Supabase admin settings save notice:', dbRes.error);
        return {
          success: true,
          warning: `Saved locally, but Supabase blocked sync: "${dbRes.error}". Check Row-Level Security in Supabase.`,
        };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save admin profile updates.' };
    }
  };

  // Reset to .env defaults
  const resetToEnvDefaults = () => {
    try {
      localStorage.removeItem(CUSTOM_CREDS_KEY);
      const defaultCreds = {
        name: 'System Administrator',
        email: ENV_ADMIN_EMAIL,
        password: ENV_ADMIN_PASSWORD,
      };
      saveAdminSettingsDb(defaultCreds).catch(() => {});
      const defaultSession: UserSession = {
        id: 'admin-001',
        name: 'System Administrator',
        email: ENV_ADMIN_EMAIL,
        role: 'admin',
        loginTime: new Date().toISOString(),
      };
      setAdminPassword(ENV_ADMIN_PASSWORD);
      setUser(defaultSession);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(defaultSession));
    } catch {}
  };

  const logout = async (): Promise<void> => {
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      await supabase.auth.signOut().catch(() => {});
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLoading,
        adminPassword,
        login,
        logout,
        updateAdminProfile,
        resetToEnvDefaults,
        clientAccounts,
        addClientAccount,
        updateClientAccount,
        deleteClientAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
