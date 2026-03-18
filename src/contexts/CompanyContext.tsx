'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface Company {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface CompanyContextType {
  selectedCompanyId: string | 'all';
  selectedCompany: Company | null;
  companies: Company[];
  setSelectedCompanyId: (id: string | 'all') => void;
  isMultiCompanyView: boolean;
  loading: boolean;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | 'all'>('all');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/company?isActive=true');
      const data = await response.json();
      if (data.companies) {
        setCompanies(data.companies.map((c: Company) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          isActive: c.isActive
        })));
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCompanies();
  }, [refreshCompanies]);

  const selectedCompany = selectedCompanyId === 'all' 
    ? null 
    : companies.find(c => c.id === selectedCompanyId) || null;

  const isMultiCompanyView = selectedCompanyId === 'all';

  return (
    <CompanyContext.Provider value={{
      selectedCompanyId,
      selectedCompany,
      companies,
      setSelectedCompanyId,
      isMultiCompanyView,
      loading,
      refreshCompanies,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
