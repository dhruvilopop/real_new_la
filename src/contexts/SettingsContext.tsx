'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AppSettings {
  companyName: string;
  companyLogo: string;
  companyTagline: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  defaultCurrency: string;
  currencySymbol: string;
  timezone: string;
  defaultInterestRate: number;
  minInterestRate: number;
  maxInterestRate: number;
  sessionTimeout: number;
  maxLoginAttempts: number;
  emailNotifications: boolean;
  smsNotifications: boolean;
  emiReminders: boolean;
  fraudAlerts: boolean;
  twoFactorAuth: boolean;
  ipWhitelist: boolean;
}

const defaultSettings: AppSettings = {
  companyName: 'Money Mitra Financial Advisor',
  companyLogo: '',
  companyTagline: 'Your Dreams, Our Support',
  companyEmail: 'support@smfc.com',
  companyPhone: '+91 1800-123-4567',
  companyAddress: '123 Finance Street, Mumbai, MH 400001',
  defaultCurrency: 'INR',
  currencySymbol: '₹',
  timezone: 'Asia/Kolkata',
  defaultInterestRate: 12,
  minInterestRate: 8,
  maxInterestRate: 24,
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  emailNotifications: true,
  smsNotifications: true,
  emiReminders: true,
  fraudAlerts: true,
  twoFactorAuth: false,
  ipWhitelist: false,
};

interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
