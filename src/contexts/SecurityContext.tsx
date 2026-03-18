'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface SecurityContextType {
  // Session management
  sessionTimeout: number; // in milliseconds
  lastActivity: number;
  isAuthenticated: boolean;
  
  // Activity tracking
  trackActivity: () => void;
  resetSession: () => void;
  
  // Session warnings
  showWarning: boolean;
  warningTimeRemaining: number;
  extendSession: () => void;
  
  // Security settings
  enableSecurityFeatures: boolean;
  setEnableSecurityFeatures: (enabled: boolean) => void;
  
  // Real-time updates
  isRealTimeEnabled: boolean;
  setRealTimeEnabled: (enabled: boolean) => void;
  lastUpdate: number;
  refreshData: () => void;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

// Default session timeout: 30 minutes
const DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1000;
// Warning shown 5 minutes before timeout
const WARNING_THRESHOLD = 5 * 60 * 1000;
// Activity check interval: 1 minute
const ACTIVITY_CHECK_INTERVAL = 60 * 1000;

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  
  // Session state
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [warningTimeRemaining, setWarningTimeRemaining] = useState(0);
  
  // Security settings
  const [sessionTimeout, setSessionTimeout] = useState(DEFAULT_SESSION_TIMEOUT);
  const [enableSecurityFeatures, setEnableSecurityFeatures] = useState(true);
  
  // Real-time updates
  const [isRealTimeEnabled, setRealTimeEnabled] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  // Refs
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle session timeout - defined first since it's used by other functions
  const handleSessionTimeout = useCallback(() => {
    if (!enableSecurityFeatures) return;
    
    // Clear auth data
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    sessionStorage.clear();
    
    setIsAuthenticated(false);
    
    toast.error('Session Expired', {
      description: 'Your session has expired due to inactivity. Please log in again.'
    });
    
    // Redirect to login
    router.push('/login');
  }, [enableSecurityFeatures, router]);
  
  // Track user activity
  const trackActivity = useCallback(() => {
    if (!enableSecurityFeatures) return;
    
    setLastActivity(Date.now());
    setShowWarning(false);
    
    // Store last activity in localStorage
    localStorage.setItem('lastActivity', Date.now().toString());
    
    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    // Set new timeout
    activityTimeoutRef.current = setTimeout(() => {
      handleSessionTimeout();
    }, sessionTimeout);
  }, [enableSecurityFeatures, sessionTimeout, handleSessionTimeout]);
  
  // Reset session
  const resetSession = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
    setIsAuthenticated(true);
    localStorage.setItem('lastActivity', Date.now().toString());
  }, []);
  
  // Extend session
  const extendSession = useCallback(() => {
    trackActivity();
    setShowWarning(false);
    toast.success('Session Extended', { description: 'Your session has been extended.' });
  }, [trackActivity]);
  
  // Refresh data callback
  const refreshData = useCallback(() => {
    setLastUpdate(Date.now());
    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { timestamp: Date.now() } }));
  }, []);
  
  // Check for session timeout on mount and activity
  useEffect(() => {
    if (!enableSecurityFeatures) return;
    
    // Check if session was already expired
    const storedActivity = localStorage.getItem('lastActivity');
    if (storedActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(storedActivity);
      if (timeSinceLastActivity > sessionTimeout) {
        handleSessionTimeout();
        return;
      }
    }
    
    // Set up activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleUserActivity = () => {
      trackActivity();
    };
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });
    
    // Initial activity tracking
    trackActivity();
    
    // Set up warning check interval
    warningIntervalRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      const timeRemaining = sessionTimeout - timeSinceActivity;
      
      if (timeRemaining <= WARNING_THRESHOLD && timeRemaining > 0) {
        setShowWarning(true);
        setWarningTimeRemaining(Math.ceil(timeRemaining / 1000 / 60)); // in minutes
      } else {
        setShowWarning(false);
      }
    }, ACTIVITY_CHECK_INTERVAL);
    
    // Set up real-time update interval (if enabled)
    if (isRealTimeEnabled) {
      realTimeIntervalRef.current = setInterval(() => {
        refreshData();
      }, 30000); // Every 30 seconds
    }
    
    // Handle page visibility change (refresh/logout on tab switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if session expired while tab was hidden
        const storedActivity = localStorage.getItem('lastActivity');
        if (storedActivity) {
          const timeSinceLastActivity = Date.now() - parseInt(storedActivity);
          if (timeSinceLastActivity > sessionTimeout) {
            handleSessionTimeout();
          } else {
            // Refresh data when tab becomes visible
            refreshData();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle beforeunload (page refresh/close)
    const handleBeforeUnload = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
      if (realTimeIntervalRef.current) clearInterval(realTimeIntervalRef.current);
    };
  }, [enableSecurityFeatures, sessionTimeout, isRealTimeEnabled, trackActivity, handleSessionTimeout, lastActivity, refreshData]);
  
  // Effect for real-time updates toggle
  useEffect(() => {
    if (isRealTimeEnabled && !realTimeIntervalRef.current) {
      realTimeIntervalRef.current = setInterval(() => {
        refreshData();
      }, 30000);
    } else if (!isRealTimeEnabled && realTimeIntervalRef.current) {
      clearInterval(realTimeIntervalRef.current);
      realTimeIntervalRef.current = null;
    }
  }, [isRealTimeEnabled, refreshData]);
  
  const value: SecurityContextType = {
    sessionTimeout,
    lastActivity,
    isAuthenticated,
    trackActivity,
    resetSession,
    showWarning,
    warningTimeRemaining,
    extendSession,
    enableSecurityFeatures,
    setEnableSecurityFeatures,
    isRealTimeEnabled,
    setRealTimeEnabled,
    lastUpdate,
    refreshData
  };
  
  return (
    <SecurityContext.Provider value={value}>
      {children}
      
      {/* Session Warning Dialog */}
      {showWarning && enableSecurityFeatures && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Session Timeout Warning</h3>
                <p className="text-sm text-gray-500">Your session will expire soon</p>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              Due to inactivity, your session will expire in <span className="font-bold text-amber-600">{warningTimeRemaining} minute{warningTimeRemaining !== 1 ? 's' : ''}</span>. 
              Would you like to extend your session?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  handleSessionTimeout();
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Logout Now
              </button>
              <button
                onClick={extendSession}
                className="flex-1 px-4 py-2 text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Extend Session
              </button>
            </div>
          </div>
        </div>
      )}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}

// HOC for protected routes
export function withSecurity<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, trackActivity } = useSecurity();
    const router = useRouter();
    
    useEffect(() => {
      if (!isAuthenticated) {
        router.push('/login');
      }
    }, [isAuthenticated, router]);
    
    useEffect(() => {
      trackActivity();
    }, [trackActivity]);
    
    if (!isAuthenticated) {
      return null;
    }
    
    return <Component {...props} />;
  };
}
