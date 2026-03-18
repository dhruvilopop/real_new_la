// SuperAdmin Dashboard Custom Hook

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loan, UserItem, CompanyItem, ProductForm, DEFAULT_PRODUCT_FORM, UserForm, DEFAULT_USER_FORM } from './types';

export function useSuperAdminData() {
  const { user } = useAuth();
  
  // Data state
  const [loans, setLoans] = useState<Loan[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    companyName: 'SMFC Finance',
    companyLogo: '',
    companyTagline: 'Your Dreams, Our Support',
    companyEmail: 'support@smfc.com',
    companyPhone: '+91 1800-123-4567',
    companyAddress: '123 Finance Street, Mumbai, MH 400001',
    defaultInterestRate: 12,
    minInterestRate: 8,
    maxInterestRate: 24,
  });
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Dialog states
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showLoanDetailsDialog, setShowLoanDetailsDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showBulkApprovalDialog, setShowBulkApprovalDialog] = useState(false);
  const [showComprehensiveLoanDialog, setShowComprehensiveLoanDialog] = useState(false);

  // Selection states
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);

  // Form states
  const [userForm, setUserForm] = useState<UserForm>(DEFAULT_USER_FORM);
  const [productForm, setProductForm] = useState<ProductForm>(DEFAULT_PRODUCT_FORM);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [bulkApprovalAction, setBulkApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [bulkCompanyId, setBulkCompanyId] = useState<string>('');
  const [bulkAgentId, setBulkAgentId] = useState<string>('');
  const [agentsList, setAgentsList] = useState<UserItem[]>([]);
  const [remarks, setRemarks] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loanDetails, setLoanDetails] = useState<any>(null);
  const [detailsTab, setDetailsTab] = useState('customer');

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
          id: u.id,
          name: u.name || 'Unknown',
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          isLocked: u.isLocked,
          createdAt: u.createdAt,
          phone: u.phone,
          company: u.company?.name,
          companyId: u.companyId,
          companyObj: u.company,
          agentId: u.agentId,
          agent: u.agent,
          agentCode: u.agentCode,
          staffCode: u.staffCode,
          cashierCode: u.cashierCode,
          accountantCode: u.accountantCode
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
        setSettings((prev: any) => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
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

  const fetchAgentsForCompany = useCallback(async (companyId: string) => {
    if (companyId) {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        const companyAgents = (data.users || [])
          .filter((u: any) => u.role === 'AGENT' && u.companyId === companyId)
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            isActive: u.isActive,
            createdAt: u.createdAt
          }));
        setAgentsList(companyAgents);
      } catch (error) {
        console.error('Error fetching agents:', error);
        setAgentsList([]);
      }
    } else {
      setAgentsList([]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLoans();
    fetchUsers();
    fetchCompanies();
    fetchProducts();
    fetchSettings();
  }, [fetchLoans, fetchUsers, fetchCompanies, fetchProducts, fetchSettings]);

  // Action handlers
  const handleCreateUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password || !userForm.role) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setSavingUser(true);
    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: 'User Created', description: `${userForm.name} has been created successfully` });
        setShowUserDialog(false);
        setUserForm(DEFAULT_USER_FORM);
        fetchUsers();
        fetchCompanies();
      } else {
        throw new Error(data.error || data.details || 'Failed to create user');
      }
    } catch (error) {
      const message = (error as Error).message || 'Failed to create user';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      const response = await fetch(`/api/user?id=${selectedUser.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'User Deleted', description: 'User has been deleted successfully' });
        setShowDeleteConfirmDialog(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete user', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' });
    }
  };

  const handleUnlockUser = async (userId: string) => {
    try {
      const response = await fetch('/api/user/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Account Unlocked', description: 'User account has been unlocked successfully' });
        fetchUsers();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to unlock user', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to unlock user', variant: 'destructive' });
    }
  };

  const handleApproval = async () => {
    if (!selectedLoan) return;
    if (selectedLoan.status === 'SUBMITTED' && approvalAction === 'approve' && !selectedCompanyId) {
      toast({ title: 'Company Required', description: 'Please select a company to assign this loan.', variant: 'destructive' });
      return;
    }
    try {
      const response = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          action: approvalAction,
          remarks,
          role: 'SUPER_ADMIN',
          userId: user?.id || 'system',
          companyId: selectedLoan.status === 'SUBMITTED' ? selectedCompanyId : undefined
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: approvalAction === 'approve' ? 'Loan Approved' : 'Loan Rejected', description: `Application ${selectedLoan.applicationNo} has been ${approvalAction}d.` });
        setShowApprovalDialog(false);
        setRemarks('');
        setSelectedCompanyId('');
        fetchLoans();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to process approval', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to process approval.', variant: 'destructive' });
    }
  };

  const handleBulkApproval = async () => {
    if (selectedLoanIds.length === 0) return;
    if (bulkApprovalAction === 'approve' && !bulkCompanyId) {
      toast({ title: 'Company Required', description: 'Please select a company.', variant: 'destructive' });
      return;
    }
    if (bulkApprovalAction === 'approve' && bulkCompanyId && !bulkAgentId) {
      toast({ title: 'Agent Required', description: 'Please select an agent.', variant: 'destructive' });
      return;
    }
    setBulkSaving(true);
    try {
      const response = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanIds: selectedLoanIds,
          action: bulkApprovalAction,
          role: 'SUPER_ADMIN',
          userId: user?.id || 'system',
          companyId: bulkApprovalAction === 'approve' ? bulkCompanyId : undefined,
          agentId: bulkApprovalAction === 'approve' ? bulkAgentId : undefined,
          isBulk: true
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: bulkApprovalAction === 'approve' ? 'Loans Approved' : 'Loans Rejected', description: `${selectedLoanIds.length} applications processed.` });
        setShowBulkApprovalDialog(false);
        clearSelection();
        fetchLoans();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to process', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to process bulk approval.', variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  const handleSaveProduct = async () => {
    try {
      const url = selectedProduct ? `/api/cms/product?id=${selectedProduct.id}` : '/api/cms/product';
      const method = selectedProduct ? 'PUT' : 'POST';
      const body = selectedProduct ? { id: selectedProduct.id, ...productForm } : productForm;
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: selectedProduct ? 'Product Updated' : 'Product Created', description: 'Loan product saved successfully' });
        setShowProductDialog(false);
        setSelectedProduct(null);
        setProductForm(DEFAULT_PRODUCT_FORM);
        fetchProducts();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save product', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save product', variant: 'destructive' });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const response = await fetch(`/api/cms/product?id=${productId}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Product Deleted', description: 'Loan product deleted successfully' });
        fetchProducts();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete product', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete product', variant: 'destructive' });
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      if (response.ok) {
        toast({ title: 'Success', description: 'Settings saved successfully' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Selection handlers
  const handleSelectLoan = (loanId: string) => {
    setSelectedLoanIds(prev => prev.includes(loanId) ? prev.filter(id => id !== loanId) : [...prev, loanId]);
  };

  const handleSelectAll = (loanIds: string[]) => {
    setSelectedLoanIds(prev => prev.length === loanIds.length ? [] : loanIds);
  };

  const clearSelection = () => {
    setSelectedLoanIds([]);
    setBulkCompanyId('');
    setBulkAgentId('');
    setAgentsList([]);
  };

  const handleBulkCompanyChange = (companyId: string) => {
    setBulkCompanyId(companyId);
    setBulkAgentId('');
    fetchAgentsForCompany(companyId);
  };

  const openEditProduct = (product: any) => {
    setSelectedProduct(product);
    setProductForm({
      title: product.title,
      description: product.description,
      icon: product.icon || '💰',
      loanType: product.loanType || 'PERSONAL',
      minInterestRate: product.minInterestRate,
      maxInterestRate: product.maxInterestRate,
      defaultInterestRate: product.defaultInterestRate,
      minTenure: product.minTenure,
      maxTenure: product.maxTenure,
      defaultTenure: product.defaultTenure,
      minAmount: product.minAmount,
      maxAmount: product.maxAmount,
      processingFeePercent: product.processingFeePercent,
      processingFeeMin: product.processingFeeMin,
      processingFeeMax: product.processingFeeMax,
      latePaymentPenaltyPercent: product.latePaymentPenaltyPercent,
      gracePeriodDays: product.gracePeriodDays,
      bounceCharges: product.bounceCharges,
      allowMoratorium: product.allowMoratorium,
      maxMoratoriumMonths: product.maxMoratoriumMonths,
      allowPrepayment: product.allowPrepayment,
      prepaymentCharges: product.prepaymentCharges,
      isActive: product.isActive
    });
    setShowProductDialog(true);
  };

  return {
    // Data
    loans, users, companies, products, settings,
    // Loading
    loading, savingUser, savingSettings, loadingDetails, bulkSaving,
    // Dialog states
    showApprovalDialog, setShowApprovalDialog,
    showUserDialog, setShowUserDialog,
    showDeleteConfirmDialog, setShowDeleteConfirmDialog,
    showLoanDetailsDialog, setShowLoanDetailsDialog,
    showProductDialog, setShowProductDialog,
    showBulkApprovalDialog, setShowBulkApprovalDialog,
    showComprehensiveLoanDialog, setShowComprehensiveLoanDialog,
    // Selection
    selectedLoan, setSelectedLoan,
    selectedUser, setSelectedUser,
    selectedProduct, setSelectedProduct,
    selectedCompanyId, setSelectedCompanyId,
    selectedLoanIds,
    // Forms
    userForm, setUserForm,
    productForm, setProductForm,
    approvalAction, setApprovalAction,
    bulkApprovalAction, setBulkApprovalAction,
    bulkCompanyId, handleBulkCompanyChange,
    bulkAgentId, setBulkAgentId,
    agentsList,
    remarks, setRemarks,
    searchQuery, setSearchQuery,
    loanDetails, detailsTab, setDetailsTab,
    // Actions
    fetchLoans, fetchUsers, fetchCompanies, fetchProducts, fetchLoanDetails,
    handleCreateUser, handleDeleteUser, handleUnlockUser,
    handleApproval, handleBulkApproval,
    handleSaveProduct, handleDeleteProduct, handleSaveSettings,
    handleSelectLoan, handleSelectAll, clearSelection,
    openEditProduct,
  };
}
