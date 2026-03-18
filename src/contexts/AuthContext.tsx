'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth, signInWithGoogle, signInWithEmail } from '@/lib/firebase';
import { UserRole } from '@prisma/client';

export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  phone?: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
  isLocked: boolean;
  profilePicture?: string;
  loginType?: string;
  lastActivityAt?: Date | string;
  lastLocation?: string;
  companyId?: string | null;
  company?: { id: string; name: string; code: string } | null;
  agentId?: string | null;
  agent?: { id: string; name: string; agentCode: string } | null;
  agentCode?: string;
  staffCode?: string;
  cashierCode?: string;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  signInGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginAsDemo: (role: string) => void;
  customerRegister: (data: CustomerRegisterData) => Promise<{ success: boolean; error?: string; user?: User }>;
  customerLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string; verificationCode?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  staffLogin: (email: string, password: string, verificationCode?: string) => Promise<{ success: boolean; error?: string; requiresCode?: boolean; user?: User }>;
  trackLocation: (action: string, loanApplicationId?: string) => Promise<void>;
}

interface CustomerRegisterData {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  dateOfBirth?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchUserData = useCallback(async (fbUser: FirebaseUser) => {
    try {
      const idToken = await fbUser.getIdToken();
      const response = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          email: fbUser.email,
          firebaseUid: fbUser.uid,
          name: fbUser.displayName,
          profilePicture: fbUser.photoURL,
          phone: fbUser.phoneNumber
        })
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, []);

  useEffect(() => {
    // Prevent double initialization
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // Check if we have a cached user (client-side only)
    let demoUser: User | null = null;
    if (typeof window !== 'undefined') {
      try {
        const demoUserStr = localStorage.getItem('demoUser');
        if (demoUserStr) {
          demoUser = JSON.parse(demoUserStr);
        }
      } catch {}
    }
    
    if (demoUser) {
      // Set user from localStorage - use queueMicrotask to avoid synchronous setState warning
      queueMicrotask(() => {
        setUser(demoUser);
        setLoading(false);
      });
      
      // Verify in background
      fetch('/api/auth/check-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: demoUser.email,
          firebaseUid: demoUser.firebaseUid
        })
      })
      .then(res => res.json())
      .then(checkData => {
        if (!checkData.canLogin) {
          localStorage.removeItem('demoUser');
          setUser(null);
          return;
        }
        
        // User is valid, sync with backend if needed
        if (demoUser?.id?.startsWith('demo-')) {
          fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: demoUser.email,
              firebaseUid: demoUser.firebaseUid,
              name: demoUser.name,
              role: demoUser.role
            })
          })
          .then(res => res.json())
          .then(data => {
            if (data.deleted || data.error?.includes('deleted')) {
              localStorage.removeItem('demoUser');
              setUser(null);
              return;
            }
            
            if (data.user?.id) {
              const actualUser = {
                ...demoUser,
                id: data.user.id,
                companyId: data.user.companyId,
                company: data.user.company,
                agentId: data.user.agentId,
                agent: data.user.agent,
                agentCode: data.user.agentCode,
                staffCode: data.user.staffCode,
                cashierCode: data.user.cashierCode
              } as User;
              localStorage.setItem('demoUser', JSON.stringify(actualUser));
              setUser(actualUser);
            }
          })
          .catch(() => {});
        }
      })
      .catch(() => {});
      return;
    }

    // No cached user, check Firebase auth
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await fetchUserData(fbUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const result = await signInWithEmail(email, password);
    if (!result.success) {
      setLoading(false);
      return { success: false, error: result.error };
    }
    return { success: true };
  };

  const signUp = async (email: string, password: string, name?: string) => {
    setLoading(true);
    const result = await signInWithEmail(email, password);
    if (!result.success) {
      setLoading(false);
      return { success: false, error: result.error };
    }
    return { success: true };
  };

  const signInGoogle = async () => {
    setLoading(true);
    const result = await signInWithGoogle();
    if (!result.success) {
      setLoading(false);
      return { success: false, error: result.error };
    }
    return { success: true };
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('demoUser');
    }
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      await fetchUserData(firebaseUser);
    }
  };

  const customerRegister = async (data: CustomerRegisterData): Promise<{ success: boolean; error?: string; user?: User }> => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/customer-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUser(result.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('demoUser', JSON.stringify(result.user));
        }
        setLoading(false);
        return { success: true, user: result.user };
      }

      setLoading(false);
      return { success: false, error: result.error || 'Registration failed' };
    } catch {
      setLoading(false);
      return { success: false, error: 'Network error' };
    }
  };

  const customerLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/customer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUser(result.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('demoUser', JSON.stringify(result.user));
        }
        setLoading(false);
        return { success: true, user: result.user };
      }

      setLoading(false);
      return { success: false, error: result.error || 'Login failed' };
    } catch {
      setLoading(false);
      return { success: false, error: 'Network error' };
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string; verificationCode?: string }> => {
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      return { 
        success: response.ok, 
        error: result.error,
        verificationCode: result.verificationCode 
      };
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const resetPassword = async (email: string, code: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, verificationCode: code, newPassword })
      });

      const result = await response.json();
      return { success: response.ok, error: result.error };
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const staffLogin = async (email: string, password: string, verificationCode?: string): Promise<{ success: boolean; error?: string; requiresCode?: boolean; user?: User }> => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, verificationCode })
      });

      const result = await response.json();

      if (result.requiresCode) {
        setLoading(false);
        return { success: false, requiresCode: true };
      }

      if (response.ok && result.success) {
        setUser(result.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('demoUser', JSON.stringify(result.user));
        }
        setLoading(false);
        return { success: true, user: result.user };
      }

      setLoading(false);
      return { success: false, error: result.error || 'Login failed' };
    } catch {
      setLoading(false);
      return { success: false, error: 'Network error' };
    }
  };

  const trackLocation = async (action: string, loanApplicationId?: string) => {
    if (!user?.id) return;

    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            await fetch('/api/location/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                action,
                loanApplicationId
              })
            });
          }
        );
      }
    } catch (error) {
      console.error('Location tracking error:', error);
    }
  };

  const loginAsDemo = useCallback(async () => {
    console.log('Demo login disabled - use email/password authentication');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      loading,
      signIn,
      signUp,
      signInGoogle,
      signOut,
      refreshUser,
      loginAsDemo,
      customerRegister,
      customerLogin,
      forgotPassword,
      resetPassword,
      staffLogin,
      trackLocation
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
