// SuperAdmin Custom Hook for State Management

import { useState, useEffect, useCallback } from 'react';
import { Loan, UserItem, CompanyItem, Product, Settings, defaultProductForm, defaultUserForm, defaultSettings, ProductForm, UserForm } from './types';
import { toast } from '@/hooks/use-toast';

export function useSuperAdmin() {
  // Data state
  const [loans, setLoans] = useState<Loan[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected items
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Dialog visibility
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showLoanDetailsDialog, setShowLoanDetailsDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);

  // Form state
  const [savingUser, setSavingUser] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>(defaultUserForm);
  const [productForm, setProductForm] = useState<ProductForm>(defaultProductForm);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  // Approval state
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [remarks, setRemarks] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Bulk selection state
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [showBulkApprovalDialog, setShowBulkApprovalDialog] = useState(false);
  const [bulkApprovalAction, setBulkApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [bulkCompanyId, setBulkCompanyId] = useState<string>('');
  const [bulkAgentId, setBulkAgentId] = useState<string>('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [agentsList, setAgentsList] = useState<UserItem[]>([]);

  // Loan details state
  const [loanDetails, setLoanDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showComprehensiveLoanDialog, setShowComprehensiveLoanDialog] = useState(false);
  const [detailsTab, setDetailsTab] = useState('customer');

  // Active loans filter state
  const [activeLoanFilter, setActiveLoanFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [allActiveLoans, setAllActiveLoans] = useState<any[]>([]);
  const [activeLoanStats, setActiveLoanStats] = useState<any>({ 
    totalOnline: 0, totalOffline: 0, totalOnlineAmount: 0, totalOfflineAmount: 0 
  });

  // Delete loan state
  const [showDeleteLoanDialog, setShowDeleteLoanDialog] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Fetch functions
  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/loan/list?role=SUPER_ADMIN');
      const data = await response.json();
      setLoans(data.loans || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/user');
      const data = await response.json();
      if (data.users && data.users.length > 0) {
        setUsers(data.users.map((u: any) => ({
          id: u.id, name: u.name || 'Unknown', email: u.email, role: u.role, isActive: u.isActive,
          createdAt: u.createdAt, phone: u.phone, company: u.company?.name, companyId: u.companyId,
          companyObj: u.company, agentId: u.agentId, agent: u.agent, agentCode: u.agentCode,
          staffCode: u.staffCode, cashierCode: u.cashierCode, accountantCode: u.accountantCode
        })));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await fetch('/api/company?isActive=true');
      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/cms/product');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.settings) {
        setSettings((prev: Settings) => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  const fetchAllActiveLoans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/loan/all-active');
      const data = await response.json();
      setAllActiveLoans(data.loans || []);
      setActiveLoanStats(data.stats || { totalOnline: 0, totalOffline: 0, totalOnlineAmount: 0, totalOfflineAmount: 0 });
    } catch (error) {
      console.error('Error fetching all active loans:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLoanDetails = useCallback(async (loanId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/loan/details?loanId=${loanId}`);
      const data = await response.json();
      if (data.success) {
        setLoanDetails(data);
        setShowComprehensiveLoanDialog(true);
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to fetch loan details', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error fetching loan details:', error);
      toast({ title: 'Error', description: 'Failed to fetch loan details', variant: 'destructive' });
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  // Initialize data
  useEffect(() => {
    fetchLoans();
    fetchUsers();
    fetchCompanies();
    fetchProducts();
    fetchSettings();
  }, [fetchLoans, fetchUsers, fetchCompanies, fetchProducts, fetchSettings]);

  // Derived data
  const pendingForSA = loans.filter(l => l.status === 'SUBMITTED');
  const pendingForFinal = loans.filter(l => l.status === 'CUSTOMER_SESSION_APPROVED');
  const activeLoans = loans.filter(l => ['ACTIVE', 'DISBURSED'].includes(l.status));
  const inProgressLoans = loans.filter(l => !['SUBMITTED', 'ACTIVE', 'DISBURSED', 'CLOSED', 'REJECTED_BY_SA', 'REJECTED_BY_COMPANY', 'REJECTED_FINAL', 'SESSION_REJECTED'].includes(l.status));
  const rejectedLoans = loans.filter(l => ['REJECTED_BY_SA', 'REJECTED_BY_COMPANY', 'REJECTED_FINAL', 'SESSION_REJECTED'].includes(l.status));
  const highRiskLoans = loans.filter(l => (l.riskScore || 0) >= 50);

  const companyUsers = users.filter(u => u.role === 'COMPANY');
  const agents = users.filter(u => u.role === 'AGENT');
  const staff = users.filter(u => u.role === 'STAFF');
  const cashiers = users.filter(u => u.role === 'CASHIER');
  const accountants = users.filter(u => u.role === 'ACCOUNTANT');
  const customers = users.filter(u => u.role === 'CUSTOMER');

  const totalDisbursed = activeLoans.reduce((sum, l) => sum + (l.sessionForm?.approvedAmount || l.requestedAmount), 0);

  return {
    // Data
    loans, setLoans,
    users, setUsers,
    companies, setCompanies,
    products, setProducts,
    loading, setLoading,

    // UI
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,

    // Selected items
    selectedLoan, setSelectedLoan,
    selectedUser, setSelectedUser,
    selectedProduct, setSelectedProduct,

    // Dialog visibility
    showApprovalDialog, setShowApprovalDialog,
    showUserDialog, setShowUserDialog,
    showDeleteConfirmDialog, setShowDeleteConfirmDialog,
    showLoanDetailsDialog, setShowLoanDetailsDialog,
    showProductDialog, setShowProductDialog,

    // Form state
    savingUser, setSavingUser,
    savingSettings, setSavingSettings,
    userForm, setUserForm,
    productForm, setProductForm,
    settings, setSettings,

    // Approval
    approvalAction, setApprovalAction,
    remarks, setRemarks,
    selectedCompanyId, setSelectedCompanyId,

    // Bulk selection
    selectedLoanIds, setSelectedLoanIds,
    showBulkApprovalDialog, setShowBulkApprovalDialog,
    bulkApprovalAction, setBulkApprovalAction,
    bulkCompanyId, setBulkCompanyId,
    bulkAgentId, setBulkAgentId,
    bulkSaving, setBulkSaving,
    agentsList, setAgentsList,

    // Loan details
    loanDetails, setLoanDetails,
    loadingDetails, setLoadingDetails,
    showComprehensiveLoanDialog, setShowComprehensiveLoanDialog,
    detailsTab, setDetailsTab,

    // Active loans
    activeLoanFilter, setActiveLoanFilter,
    allActiveLoans, setAllActiveLoans,
    activeLoanStats, setActiveLoanStats,

    // Delete loan
    showDeleteLoanDialog, setShowDeleteLoanDialog,
    loanToDelete, setLoanToDelete,
    deleteReason, setDeleteReason,
    deleting, setDeleting,

    // Fetch functions
    fetchLoans,
    fetchUsers,
    fetchCompanies,
    fetchProducts,
    fetchSettings,
    fetchAllActiveLoans,
    fetchLoanDetails,

    // Derived data
    pendingForSA,
    pendingForFinal,
    activeLoans,
    inProgressLoans,
    rejectedLoans,
    highRiskLoans,
    companyUsers,
    agents,
    staff,
    cashiers,
    accountants,
    customers,
    totalDisbursed
  };
}
