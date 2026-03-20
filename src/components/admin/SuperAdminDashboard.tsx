'use client';

import { useState, useEffect } from 'react';
import DashboardLayout, { ROLE_MENU_ITEMS } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, FileText, CheckCircle, XCircle, Clock, Users, Wallet, AlertTriangle, Eye, Building2, UserPlus, Edit, Trash2, Settings, Save, User, ClipboardCheck, Banknote, Briefcase, Plus, TrendingUp, Activity, DollarSign, BarChart3, ArrowRight, Calculator, PieChart, X, Loader2, MapPin, Phone, Mail, Calendar, FileCheck, CreditCard, Receipt, ExternalLink, RefreshCw, Info, Hash, CreditCard as CardIcon, Landmark, UserCog, Percent } from 'lucide-react';
import { formatCurrency, formatDate, generateApplicationNo } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import AuditLogViewer from '@/components/audit/AuditLogViewer';
import LocationHistoryViewer from '@/components/admin/LocationHistoryViewer';
import EMICollectionSection from '@/components/emi/EMICollectionSection';
import EMICalendar from '@/components/emi/EMICalendar';
import OfflineLoanForm from '@/components/offline-loan/OfflineLoanForm';
import OfflineLoansList from '@/components/offline-loan/OfflineLoansList';
import PersonalCreditManager from '@/components/credit/PersonalCreditManager';
import CreditManagementPage from '@/components/credit/CreditManagementPage';
import SuperAdminMyCredit from '@/components/credit/SuperAdminMyCredit';
import LoanDetailPanel from '@/components/loan/LoanDetailPanel';
import EMISettingsDialog from '@/components/customer/EMISettingsDialog';
import SecondaryPaymentPagesSection from '@/components/payment/SecondaryPaymentPagesSection';

interface Loan {
  id: string; applicationNo: string; status: string; requestedAmount: number; loanType: string;
  createdAt: string; riskScore: number; fraudFlag: boolean; purpose: string;
  requestedTenure?: number; requestedInterestRate?: number;
  customer: { id: string; name: string; email: string; phone: string; };
  sessionForm?: any; loanForm?: any; company?: any;
}

interface UserItem {
  id: string; name: string; email: string; role: string; isActive: boolean; isLocked?: boolean; createdAt: string;
  phone?: string; company?: string | { id: string; name: string }; companyId?: string; companyObj?: { id: string; name: string };
  agentId?: string; agent?: { id: string; name: string; agentCode: string }; agentCode?: string; staffCode?: string; cashierCode?: string; accountantCode?: string;
}

interface CompanyItem {
  id: string; name: string; code: string; isActive: boolean;
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showLoanDetailsDialog, setShowLoanDetailsDialog] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', phone: '', password: '', role: 'COMPANY', companyId: '', agentId: '' });
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [remarks, setRemarks] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState<any[]>([]);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    title: '', description: '', icon: '💰', loanType: 'PERSONAL',
    minInterestRate: 8, maxInterestRate: 24, defaultInterestRate: 12,
    minTenure: 6, maxTenure: 60, defaultTenure: 12,
    minAmount: 10000, maxAmount: 10000000,
    processingFeePercent: 1, processingFeeMin: 500, processingFeeMax: 10000,
    latePaymentPenaltyPercent: 2, gracePeriodDays: 5, bounceCharges: 500,
    allowMoratorium: true, maxMoratoriumMonths: 3,
    allowPrepayment: true, prepaymentCharges: 2, isActive: true
  });
  // Interest-only loan states
  const [interestOnlyLoans, setInterestOnlyLoans] = useState<any[]>([]);
  const [showInterestOnlyDialog, setShowInterestOnlyDialog] = useState(false);
  const [showStartEMIDialog, setShowStartEMIDialog] = useState(false);
  const [selectedInterestOnlyLoan, setSelectedInterestOnlyLoan] = useState<any>(null);
  const [interestOnlyForm, setInterestOnlyForm] = useState({
    customerId: '',
    principalAmount: 10000,
    interestRate: 12,
    purpose: '',
    disbursementMode: 'BANK_TRANSFER',
    disbursementDate: new Date().toISOString().split('T')[0],
    documents: {} as Record<string, string>
  });
  const [settings, setSettings] = useState<any>({
    companyName: 'Money Mitra Financial Advisor', companyLogo: '', companyTagline: 'Your Dreams, Our Support',
    companyEmail: 'support@smfc.com', companyPhone: '+91 1800-123-4567', companyAddress: '123 Finance Street, Mumbai, MH 400001',
    defaultInterestRate: 12, minInterestRate: 8, maxInterestRate: 24,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bulk selection state
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [showBulkApprovalDialog, setShowBulkApprovalDialog] = useState(false);
  const [bulkApprovalAction, setBulkApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [bulkCompanyId, setBulkCompanyId] = useState<string>('');
  const [bulkAgentId, setBulkAgentId] = useState<string>('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [agentsList, setAgentsList] = useState<UserItem[]>([]);
  
  // Comprehensive loan details state
  const [loanDetails, setLoanDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showComprehensiveLoanDialog, setShowComprehensiveLoanDialog] = useState(false);
  const [detailsTab, setDetailsTab] = useState('customer');
  
  // Active loans filter state
  const [activeLoanFilter, setActiveLoanFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [allActiveLoans, setAllActiveLoans] = useState<any[]>([]);
  const [activeLoanStats, setActiveLoanStats] = useState<any>({ totalOnline: 0, totalOffline: 0, totalOnlineAmount: 0, totalOfflineAmount: 0 });
  
  // Delete loan state
  const [showDeleteLoanDialog, setShowDeleteLoanDialog] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Loan Detail Panel state
  const [showLoanDetailPanel, setShowLoanDetailPanel] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  
  // User Details View state
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  
  // Role Selection Dialog
  const [showRoleSelectDialog, setShowRoleSelectDialog] = useState(false);
  const [selectedRoleForCreate, setSelectedRoleForCreate] = useState<string>('COMPANY');
  
  // Detail Sheet - Right side panel for A-Z details
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [detailSheetData, setDetailSheetData] = useState<any>(null);
  const [detailSheetType, setDetailSheetType] = useState<'user' | 'company' | 'loan'>('user');
  const [loadingDetailSheet, setLoadingDetailSheet] = useState(false);
  
  // System Reset state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  
  // EMI Settings Dialog state
  const [showEmiSettingsDialog, setShowEmiSettingsDialog] = useState(false);
  const [selectedEmiForSettings, setSelectedEmiForSettings] = useState<any>(null);
  const [selectedLoanIdForSettings, setSelectedLoanIdForSettings] = useState<string | null>(null);
  const [selectedCompanyIdForSettings, setSelectedCompanyIdForSettings] = useState<string | null>(null);

  useEffect(() => {
    fetchLoans();
    fetchUsers();
    fetchCompanies();
    fetchProducts();
    fetchSettings();
    fetchAllActiveLoans();
    fetchInterestOnlyLoans();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/company?isActive=true');
      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.settings) {
        setSettings((prev: any) => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchLoanDetails = async (loanId: string) => {
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
  };

  const saveSettings = async () => {
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

  const fetchLoans = async () => {
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
  };

  const fetchUsers = async () => {
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
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/cms/product');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // Fetch all active loans (both online and offline)
  const fetchAllActiveLoans = async () => {
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
  };

  // Delete loan handler
  const handleDeleteLoan = async () => {
    if (!loanToDelete || !deleteReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason for deletion', variant: 'destructive' });
      return;
    }
    setDeleting(true);
    try {
      const params = new URLSearchParams({
        loanId: loanToDelete.id,
        userId: user?.id || 'system',
        reason: deleteReason,
        loanType: loanToDelete.loanType || 'ONLINE'
      });
      const response = await fetch(`/api/loan/delete?${params}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Loan Deleted', description: `${loanToDelete.identifier} has been deleted successfully` });
        setShowDeleteLoanDialog(false);
        setLoanToDelete(null);
        setDeleteReason('');
        // Refresh both loan lists
        fetchLoans();
        fetchAllActiveLoans();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete loan', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting loan:', error);
      toast({ title: 'Error', description: 'Failed to delete loan', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const fetchInterestOnlyLoans = async () => {
    try {
      const response = await fetch('/api/offline-loan?isInterestOnly=true');
      const data = await response.json();
      if (data.success) {
        setInterestOnlyLoans(data.loans || []);
      }
    } catch (error) {
      console.error('Error fetching interest-only loans:', error);
    }
  };

  const handleCreateUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password || !userForm.role) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setSavingUser(true);
    console.log('[handleCreateUser] Creating user:', userForm);
    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });
      
      console.log('[handleCreateUser] Response status:', response.status);
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[handleCreateUser] Non-JSON response:', text);
        throw new Error('Server returned an invalid response. Please try again.');
      }
      
      const data = await response.json();
      console.log('[handleCreateUser] Response data:', data);
      
      if (response.ok) {
        toast({ title: 'User Created', description: `${userForm.name} has been created successfully` });
        setShowUserDialog(false);
        setUserForm({ name: '', email: '', phone: '', password: '', role: 'COMPANY', companyId: '', agentId: '' });
        fetchUsers();
        fetchCompanies(); // Refresh companies list if a company user was created
      } else {
        const errorMsg = data.error || data.details || 'Failed to create user';
        console.error('[handleCreateUser] Error:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('[handleCreateUser] Exception:', error);
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
        toast({ 
          title: 'Error', 
          description: data.error || 'Failed to delete user', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
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

  const handleSaveProduct = async () => {
    try {
      const url = selectedProduct ? `/api/cms/product?id=${selectedProduct.id}` : '/api/cms/product';
      const method = selectedProduct ? 'PUT' : 'POST';
      
      const body = selectedProduct 
        ? { id: selectedProduct.id, ...productForm }
        : productForm;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: selectedProduct ? 'Product Updated' : 'Product Created', description: 'Loan product saved successfully' });
        setShowProductDialog(false);
        setSelectedProduct(null);
        setProductForm({
          title: '', description: '', icon: '💰', loanType: 'PERSONAL',
          minInterestRate: 8, maxInterestRate: 24, defaultInterestRate: 12,
          minTenure: 6, maxTenure: 60, defaultTenure: 12,
          minAmount: 10000, maxAmount: 10000000,
          processingFeePercent: 1, processingFeeMin: 500, processingFeeMax: 10000,
          latePaymentPenaltyPercent: 2, gracePeriodDays: 5, bounceCharges: 500,
          allowMoratorium: true, maxMoratoriumMonths: 3,
          allowPrepayment: true, prepaymentCharges: 2, isActive: true
        });
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

  // System Reset Handler
  const handleSystemReset = async () => {
    if (resetConfirmText !== 'RESET_SYSTEM') {
      toast({ title: 'Error', description: 'Please type RESET_SYSTEM to confirm', variant: 'destructive' });
      return;
    }

    setResetting(true);
    try {
      const response = await fetch('/api/system/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmReset: 'RESET_SYSTEM',
          userId: user?.id
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'System Reset Complete',
          description: `All data cleared in ${data.stats?.duration || 'a few seconds'}. Users preserved.`
        });
        setShowResetDialog(false);
        setResetConfirmText('');
        // Refresh all data
        fetchLoans();
        fetchUsers();
        fetchCompanies();
        fetchAllActiveLoans();
      } else {
        toast({
          title: 'Reset Failed',
          description: data.error || 'Failed to reset system',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('System reset error:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset system. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setResetting(false);
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
          loanId: selectedLoan.id, action: approvalAction, remarks, role: 'SUPER_ADMIN',
          userId: user?.id || 'system', companyId: selectedLoan.status === 'SUBMITTED' ? selectedCompanyId : undefined
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
      console.error('Approval error:', error);
      toast({ title: 'Error', description: 'Failed to process approval. Please try again.', variant: 'destructive' });
    }
  };

  // Bulk selection handlers
  const handleSelectLoan = (loanId: string) => {
    setSelectedLoanIds(prev => 
      prev.includes(loanId) 
        ? prev.filter(id => id !== loanId)
        : [...prev, loanId]
    );
  };

  const handleSelectAll = (loanIds: string[]) => {
    if (selectedLoanIds.length === loanIds.length) {
      setSelectedLoanIds([]);
    } else {
      setSelectedLoanIds(loanIds);
    }
  };

  const clearSelection = () => {
    setSelectedLoanIds([]);
    setBulkCompanyId('');
    setBulkAgentId('');
    setAgentsList([]);
  };

  // Fetch agents when company is selected for bulk approval
  const handleBulkCompanyChange = async (companyId: string) => {
    setBulkCompanyId(companyId);
    setBulkAgentId('');
    if (companyId) {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        const companyAgents = (data.users || [])
          .filter((u: any) => u.role === 'AGENT' && u.companyId === companyId)
          .map((u: any) => ({
            id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt
          }));
        setAgentsList(companyAgents);
      } catch (error) {
        console.error('Error fetching agents:', error);
        setAgentsList([]);
      }
    } else {
      setAgentsList([]);
    }
  };

  // Bulk approval handler
  const handleBulkApproval = async () => {
    if (selectedLoanIds.length === 0) return;
    
    if (bulkApprovalAction === 'approve' && !bulkCompanyId) {
      toast({ title: 'Company Required', description: 'Please select a company to assign the loans.', variant: 'destructive' });
      return;
    }
    
    if (bulkApprovalAction === 'approve' && bulkCompanyId && !bulkAgentId) {
      toast({ title: 'Agent Required', description: 'Please select an agent to assign the loans.', variant: 'destructive' });
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
        toast({ 
          title: bulkApprovalAction === 'approve' ? 'Loans Approved' : 'Loans Rejected', 
          description: `${selectedLoanIds.length} applications have been ${bulkApprovalAction}d successfully.` 
        });
        setShowBulkApprovalDialog(false);
        clearSelection();
        fetchLoans();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to process bulk approval', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Bulk approval error:', error);
      toast({ title: 'Error', description: 'Failed to process bulk approval. Please try again.', variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      SUBMITTED: { className: 'bg-blue-100 text-blue-700', label: 'New' },
      SA_APPROVED: { className: 'bg-emerald-100 text-emerald-700', label: 'SA Approved' },
      COMPANY_APPROVED: { className: 'bg-teal-100 text-teal-700', label: 'Company Approved' },
      AGENT_APPROVED_STAGE1: { className: 'bg-cyan-100 text-cyan-700', label: 'Agent Approved' },
      LOAN_FORM_COMPLETED: { className: 'bg-violet-100 text-violet-700', label: 'Form Complete' },
      SESSION_CREATED: { className: 'bg-amber-100 text-amber-700', label: 'Sanction Created' },
      CUSTOMER_SESSION_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Awaiting Final' },
      FINAL_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Final Approved' },
      DISBURSED: { className: 'bg-green-100 text-green-700', label: 'Disbursed' },
      ACTIVE: { className: 'bg-green-100 text-green-700', label: 'Active' },
      REJECTED_BY_SA: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
      REJECTED_BY_COMPANY: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
      REJECTED_FINAL: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
      SESSION_REJECTED: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const pendingForSA = loans.filter(l => l.status === 'SUBMITTED');
  const pendingForFinal = loans.filter(l => l.status === 'CUSTOMER_SESSION_APPROVED');
  const activeLoans = loans.filter(l => ['ACTIVE', 'DISBURSED'].includes(l.status));
  const inProgressLoans = loans.filter(l => !['SUBMITTED', 'ACTIVE', 'DISBURSED', 'CLOSED', 'REJECTED_BY_SA', 'REJECTED_BY_COMPANY', 'REJECTED_FINAL', 'SESSION_REJECTED'].includes(l.status));
  const rejectedLoans = loans.filter(l => ['REJECTED_BY_SA', 'REJECTED_BY_COMPANY', 'REJECTED_FINAL', 'SESSION_REJECTED'].includes(l.status));
  const highRiskLoans = loans.filter(l => (l.riskScore || 0) >= 50);

  // Users by role
  const companyUsers = users.filter(u => u.role === 'COMPANY');
  const agents = users.filter(u => u.role === 'AGENT');
  const staff = users.filter(u => u.role === 'STAFF');
  const cashiers = users.filter(u => u.role === 'CASHIER');
  const accountants = users.filter(u => u.role === 'ACCOUNTANT');
  const customers = users.filter(u => u.role === 'CUSTOMER');

  const totalDisbursed = activeLoans.reduce((sum, l) => sum + (l.sessionForm?.approvedAmount || l.requestedAmount), 0);
  const totalRequested = loans.reduce((sum, l) => sum + l.requestedAmount, 0);

  const stats = [
    { label: 'Total Applications', value: loans.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => setActiveTab('pending') },
    { label: 'Pending Approvals', value: pendingForSA.length + pendingForFinal.length, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', onClick: () => setActiveTab('pending') },
    { label: 'Active Loans', value: activeLoans.length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', onClick: () => setActiveTab('activeLoans') },
    { label: 'Total Disbursed', value: formatCurrency(totalDisbursed), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setActiveTab('activeLoans') }
  ];

  const menuItems = ROLE_MENU_ITEMS.SUPER_ADMIN.map(item => ({
    ...item,
    count: item.id === 'pending' ? pendingForSA.length : 
           item.id === 'final' ? pendingForFinal.length :
           item.id === 'activeLoans' ? activeLoans.length :
           item.id === 'users' ? users.length :
           item.id === 'customers' ? customers.length :
           item.id === 'companies' ? companyUsers.length :
           item.id === 'agents' ? agents.length :
           item.id === 'staff' ? staff.length :
           item.id === 'cashiers' ? cashiers.length :
           item.id === 'accountants' ? accountants.length :
           item.id === 'risk' ? highRiskLoans.length : undefined
  }));

  const renderLoanCard = (loan: Loan, index: number, showActions: boolean = true, actions?: React.ReactNode) => {
    // For CUSTOMER_SESSION_APPROVED, show session details
    const showSanctionDetails = loan.status === 'CUSTOMER_SESSION_APPROVED' && loan.sessionForm;
    const displayAmount = showSanctionDetails ? loan.sessionForm.approvedAmount : loan.requestedAmount;
    const displayTenure = showSanctionDetails ? loan.sessionForm.tenure : loan.requestedTenure;
    const displayInterest = showSanctionDetails ? loan.sessionForm.interestRate : loan.requestedInterestRate;
    const displayEMI = showSanctionDetails ? loan.sessionForm.emiAmount : null;
    
    return (
      <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
        className={`p-4 border rounded-xl hover:bg-gray-50 transition-all bg-white ${
          showSanctionDetails ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'
        }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 bg-gradient-to-br from-emerald-400 to-teal-500">
              <AvatarFallback className="bg-transparent text-white font-semibold">
                {loan.customer?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
                {getStatusBadge(loan.status)}
                {loan.fraudFlag && <Badge className="bg-red-100 text-red-700">High Risk</Badge>}
                {showSanctionDetails && (
                  <Badge className="bg-emerald-100 text-emerald-700">Sanction: {formatCurrency(displayAmount)}</Badge>
                )}
              </div>
              <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.email}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDate(loan.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              {showSanctionDetails ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-gray-400 line-through">{formatCurrency(loan.requestedAmount)}</span>
                    <ArrowRight className="h-3 w-3 text-emerald-500" />
                    <p className="font-bold text-lg text-emerald-700">{formatCurrency(displayAmount)}</p>
                  </div>
                  <div className="flex items-center gap-2 justify-end text-xs text-gray-500">
                    <span>{displayTenure} mo</span>
                    <span>•</span>
                    <span>{displayInterest}%</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">EMI: {formatCurrency(displayEMI)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
                  <p className="text-xs text-gray-500">{loan.loanType}</p>
                </>
              )}
            </div>
            {actions || (showActions && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setSelectedLoan(loan); setShowLoanDetailsDialog(true); }}>
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'pending':
        const pendingLoanIds = pendingForSA.map(l => l.id);
        return (
          <div className="space-y-4">
            {/* Bulk Action Bar */}
            {selectedLoanIds.length > 0 && (
              <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-emerald-600 text-white text-sm px-3 py-1">
                        {selectedLoanIds.length} selected
                      </Badge>
                      <span className="text-sm text-emerald-700">
                        {formatCurrency(selectedLoanIds.reduce((sum, id) => {
                          const loan = pendingForSA.find(l => l.id === id);
                          return sum + (loan?.requestedAmount || 0);
                        }, 0))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => { setBulkApprovalAction('reject'); setShowBulkApprovalDialog(true); }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />Reject All
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-emerald-500 hover:bg-emerald-600"
                        onClick={() => { setBulkApprovalAction('approve'); setShowBulkApprovalDialog(true); }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />Approve All
                      </Button>
                      <Button size="sm" variant="ghost" onClick={clearSelection}>
                        <X className="h-4 w-4 mr-1" />Clear
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />New Loan Applications
                    </CardTitle>
                    <CardDescription>Applications awaiting initial approval. Assign a company to approve.</CardDescription>
                  </div>
                  {pendingForSA.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-pending"
                        checked={selectedLoanIds.length === pendingLoanIds.length && pendingLoanIds.length > 0}
                        onCheckedChange={() => handleSelectAll(pendingLoanIds)}
                      />
                      <Label htmlFor="select-all-pending" className="text-sm font-medium cursor-pointer">
                        Select All ({pendingForSA.length})
                      </Label>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pendingForSA.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>No pending applications</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingForSA.map((loan, index) => (
                      <motion.div 
                        key={loan.id} 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: index * 0.03 }}
                        className={`p-4 border rounded-xl hover:bg-gray-50 transition-all bg-white ${
                          selectedLoanIds.includes(loan.id) ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <Checkbox
                              checked={selectedLoanIds.includes(loan.id)}
                              onCheckedChange={() => handleSelectLoan(loan.id)}
                            />
                            <Avatar className="h-12 w-12 bg-gradient-to-br from-emerald-400 to-teal-500">
                              <AvatarFallback className="bg-transparent text-white font-semibold">
                                {loan.customer?.name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
                                {getStatusBadge(loan.status)}
                                {loan.fraudFlag && <Badge className="bg-red-100 text-red-700">High Risk</Badge>}
                              </div>
                              <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.email}</p>
                              <p className="text-xs text-gray-400 mt-1">{formatDate(loan.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
                              <p className="text-xs text-gray-500">{loan.loanType}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setSelectedLoan(loan); setShowLoanDetailsDialog(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" 
                                onClick={() => { setSelectedLoan(loan); setApprovalAction('reject'); setShowApprovalDialog(true); }}>
                                <XCircle className="h-4 w-4 mr-1" />Reject
                              </Button>
                              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" 
                                onClick={() => { setSelectedLoan(loan); setApprovalAction('approve'); setShowApprovalDialog(true); }}>
                                <CheckCircle className="h-4 w-4 mr-1" />Approve
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'final':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />Final Approval Queue
              </CardTitle>
              <CardDescription>Customer-approved sanctions awaiting final authorization for disbursement</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingForFinal.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p>No applications awaiting final approval</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingForFinal.map((loan, index) => renderLoanCard(loan, index, false,
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" 
                        onClick={() => { setSelectedLoan(loan); setApprovalAction('reject'); setShowApprovalDialog(true); }}>
                        <XCircle className="h-4 w-4 mr-1" />Reject
                      </Button>
                      <Button size="sm" className="bg-green-500 hover:bg-green-600" 
                        onClick={() => { setSelectedLoan(loan); setApprovalAction('approve'); setShowApprovalDialog(true); }}>
                        <CheckCircle className="h-4 w-4 mr-1" />Final Approve
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'progress':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle>In Progress Applications</CardTitle>
              <CardDescription>Applications currently moving through the workflow</CardDescription>
            </CardHeader>
            <CardContent>
              {inProgressLoans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No applications in progress</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inProgressLoans.map((loan, index) => renderLoanCard(loan, index))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'active':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle>Active Loans</CardTitle>
              <CardDescription>Currently running loans with active EMI schedules</CardDescription>
            </CardHeader>
            <CardContent>
              {activeLoans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No active loans</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeLoans.map((loan, index) => renderLoanCard(loan, index))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'activeLoans':
        // Filter loans based on activeLoanFilter
        const filteredActiveLoans = allActiveLoans.filter(loan => {
          if (activeLoanFilter === 'all') return true;
          return loan.loanType === activeLoanFilter.toUpperCase();
        });
        
        return (
          <div className="space-y-6">
            {/* Filter Toggle Bar */}
            <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Filter by Type:</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={activeLoanFilter === 'all' ? 'default' : 'outline'}
                        className={activeLoanFilter === 'all' ? 'bg-gray-700 hover:bg-gray-800' : ''}
                        onClick={() => setActiveLoanFilter('all')}
                      >
                        All ({activeLoanStats.totalOnline + activeLoanStats.totalOffline})
                      </Button>
                      <Button
                        size="sm"
                        variant={activeLoanFilter === 'online' ? 'default' : 'outline'}
                        className={activeLoanFilter === 'online' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}
                        onClick={() => setActiveLoanFilter('online')}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Online ({activeLoanStats.totalOnline})
                      </Button>
                      <Button
                        size="sm"
                        variant={activeLoanFilter === 'offline' ? 'default' : 'outline'}
                        className={activeLoanFilter === 'offline' ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-200 text-purple-700 hover:bg-purple-50'}
                        onClick={() => setActiveLoanFilter('offline')}
                      >
                        <Receipt className="h-4 w-4 mr-1" />
                        Offline ({activeLoanStats.totalOffline})
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { fetchAllActiveLoans(); }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Active Loans</p>
                      <p className="text-2xl font-bold text-emerald-600">{activeLoanStats.totalOnline + activeLoanStats.totalOffline}</p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Online Loans</p>
                      <p className="text-2xl font-bold text-blue-600">{activeLoanStats.totalOnline}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(activeLoanStats.totalOnlineAmount)}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm border-l-4 border-l-purple-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Offline Loans</p>
                      <p className="text-2xl font-bold text-purple-600">{activeLoanStats.totalOffline}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(activeLoanStats.totalOfflineAmount)}</p>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Receipt className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Disbursed</p>
                      <p className="text-2xl font-bold text-teal-600">{formatCurrency(activeLoanStats.totalOnlineAmount + activeLoanStats.totalOfflineAmount)}</p>
                    </div>
                    <div className="p-2 bg-teal-50 rounded-lg">
                      <DollarSign className="h-5 w-5 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Active Loans List */}
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                      Active Loans
                      {activeLoanFilter !== 'all' && (
                        <Badge className={activeLoanFilter === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                          {activeLoanFilter.toUpperCase()} ONLY
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {activeLoanFilter === 'all' ? 'All disbursed loans (online + offline)' : 
                       activeLoanFilter === 'online' ? 'Online loans from digital applications' : 
                       'Offline loans created manually'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : filteredActiveLoans.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No {activeLoanFilter !== 'all' ? activeLoanFilter : ''} loans found</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchAllActiveLoans()}>
                      Load Loans
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredActiveLoans.map((loan, index) => {
                      const isOnline = loan.loanType === 'ONLINE';
                      const bgColor = isOnline ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100';
                      const gradientColors = isOnline ? 'from-blue-400 to-cyan-500' : 'from-purple-400 to-pink-500';
                      
                      return (
                        <motion.div
                          key={`${loan.loanType}-${loan.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={`p-4 border rounded-xl hover:shadow-md transition-all ${bgColor}`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <Avatar className={`h-12 w-12 bg-gradient-to-br ${gradientColors}`}>
                                <AvatarFallback className="bg-transparent text-white font-semibold">
                                  {loan.customer?.name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold text-gray-900">{loan.identifier}</h4>
                                  <Badge className={isOnline ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                                    {loan.loanType}
                                  </Badge>
                                  {loan.status && (
                                    <Badge className="bg-green-100 text-green-700">{loan.status}</Badge>
                                  )}
                                  {loan.nextEmi && loan.nextEmi.status === 'OVERDUE' && (
                                    <Badge className="bg-red-100 text-red-700">EMI Overdue</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.phone || loan.customer?.email}</p>
                                {loan.company && (
                                  <p className="text-xs text-gray-400">Company: {loan.company.name}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.approvedAmount)}</p>
                                <p className="text-xs text-gray-500">{loan.interestRate}% • {loan.tenure} months</p>
                                {loan.emiAmount > 0 && (
                                  <p className="text-xs text-emerald-600">EMI: {formatCurrency(loan.emiAmount)}/mo</p>
                                )}
                                {loan.nextEmi && (
                                  <p className="text-xs text-gray-400">Next EMI: {formatDate(loan.nextEmi.dueDate)}</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => { setLoanToDelete(loan); setShowDeleteLoanDialog(true); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  className={isOnline ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'}
                                  onClick={() => {
                                    setSelectedLoanId(loan.id);
                                    setShowLoanDetailPanel(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />View
                                </Button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'rejected':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle>Rejected Applications</CardTitle>
              <CardDescription>Applications that were rejected at various stages</CardDescription>
            </CardHeader>
            <CardContent>
              {rejectedLoans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <XCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No rejected applications</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rejectedLoans.map((loan, index) => renderLoanCard(loan, index))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'users':
        // Unified User Management - All users in one place
        const filteredByRole = userRoleFilter === 'all' ? users : users.filter(u => u.role === userRoleFilter);
        const filteredBySearch = filteredByRole.filter(u => 
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          u.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        // Fetch user details
        const handleViewUserDetails = async (userId: string) => {
          setLoadingUserDetails(true);
          try {
            const response = await fetch(`/api/user/details?userId=${userId}`);
            const data = await response.json();
            if (data.success) {
              setSelectedUserDetails(data.user);
              setShowUserDetailsDialog(true);
            } else {
              toast({ title: 'Error', description: 'Failed to fetch user details', variant: 'destructive' });
            }
          } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch user details', variant: 'destructive' });
          } finally {
            setLoadingUserDetails(false);
          }
        };

        return (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Users</p>
                      <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                    </div>
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Companies</p>
                      <p className="text-2xl font-bold text-blue-600">{companyUsers.length}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Agents</p>
                      <p className="text-2xl font-bold text-cyan-600">{agents.length}</p>
                    </div>
                    <div className="p-2 bg-cyan-50 rounded-lg">
                      <User className="h-5 w-5 text-cyan-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Staff & Others</p>
                      <p className="text-2xl font-bold text-violet-600">{staff.length + cashiers.length + accountants.length}</p>
                    </div>
                    <div className="p-2 bg-violet-50 rounded-lg">
                      <ClipboardCheck className="h-5 w-5 text-violet-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Users Table */}
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-600" />
                    User Management
                  </CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        <SelectItem value="COMPANY">Company</SelectItem>
                        <SelectItem value="AGENT">Agent</SelectItem>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="CASHIER">Cashier</SelectItem>
                        <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-48" />
                    <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowRoleSelectDialog(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />Add User
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredBySearch.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-2">No users found</p>
                    <p className="text-sm text-gray-400">Create a user to get started</p>
                    <Button className="mt-4 bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowRoleSelectDialog(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />Add First User
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Company/Agent</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBySearch.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">{u.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{u.name}</p>
                                  <div className="flex gap-2">
                                    {u.agentCode && <Badge variant="outline" className="text-xs">{u.agentCode}</Badge>}
                                    {u.staffCode && <Badge variant="outline" className="text-xs">{u.staffCode}</Badge>}
                                    {u.cashierCode && <Badge variant="outline" className="text-xs">{u.cashierCode}</Badge>}
                                    {u.accountantCode && <Badge variant="outline" className="text-xs">{u.accountantCode}</Badge>}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{u.email}</p>
                                {u.phone && <p className="text-xs text-gray-500">{u.phone}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                                u.role === 'COMPANY' ? 'bg-blue-100 text-blue-700' :
                                u.role === 'AGENT' ? 'bg-cyan-100 text-cyan-700' :
                                u.role === 'STAFF' ? 'bg-orange-100 text-orange-700' :
                                u.role === 'CASHIER' ? 'bg-green-100 text-green-700' :
                                u.role === 'ACCOUNTANT' ? 'bg-teal-100 text-teal-700' :
                                'bg-gray-100 text-gray-700'
                              }>
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {u.company && typeof u.company === 'object' && <p className="text-sm">{u.company.name}</p>}
                              {u.company && typeof u.company === 'string' && <p className="text-sm">{u.company}</p>}
                              {u.agent && <p className="text-sm text-gray-500">{u.agent.name}</p>}
                              {!u.company && !u.agent && <span className="text-gray-400">-</span>}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="text-emerald-600">Co: ₹{((u as any).companyCredit || 0).toLocaleString()}</p>
                                <p className="text-amber-600">Pr: ₹{((u as any).personalCredit || 0).toLocaleString()}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge className={u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {u.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                                {u.isLocked && (
                                  <Badge className="bg-orange-100 text-orange-700 text-xs">Locked</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleViewUserDetails(u.id)} title="View Details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {u.isLocked && (
                                  <Button size="sm" variant="outline" className="text-orange-600 hover:bg-orange-50" onClick={() => handleUnlockUser(u.id)} title="Unlock">
                                    <Shield className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => { setSelectedUser(u); setShowDeleteConfirmDialog(true); }} title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'customers':
        // Customer Management Section with A-Z details
        const allCustomers = users.filter(u => u.role === 'CUSTOMER');
        const customerSearchQuery = searchQuery.toLowerCase();
        const filteredCustomers = allCustomers.filter(c => 
          c.name.toLowerCase().includes(customerSearchQuery) || 
          c.email.toLowerCase().includes(customerSearchQuery) ||
          (c.phone && c.phone.includes(customerSearchQuery))
        );

        return (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Customers</p>
                      <p className="text-2xl font-bold text-gray-900">{allCustomers.length}</p>
                    </div>
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Active</p>
                      <p className="text-2xl font-bold text-green-600">{allCustomers.filter(c => c.isActive).length}</p>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">With Active Loans</p>
                      <p className="text-2xl font-bold text-blue-600">{loans.filter(l => ['ACTIVE', 'DISBURSED'].includes(l.status)).length}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Wallet className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Applications</p>
                      <p className="text-2xl font-bold text-violet-600">{loans.length}</p>
                    </div>
                    <div className="p-2 bg-violet-50 rounded-lg">
                      <FileText className="h-5 w-5 text-violet-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Customer List */}
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-emerald-600" />
                    Customer Directory
                  </CardTitle>
                  <Input placeholder="Search customers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64" />
                </div>
              </CardHeader>
              <CardContent>
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-2">No customers found</p>
                    <p className="text-sm text-gray-400">Customers will appear here when they register</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Loans</TableHead>
                          <TableHead>Active Loan</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomers.map((customer) => {
                          const customerLoans = loans.filter(l => l.customer?.id === customer.id);
                          const activeLoan = customerLoans.find(l => ['ACTIVE', 'DISBURSED'].includes(l.status));
                          const totalBorrowed = customerLoans.reduce((sum, l) => sum + (l.sessionForm?.approvedAmount || l.requestedAmount), 0);
                          
                          return (
                            <TableRow key={customer.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">{customer.name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{customer.name}</p>
                                    <p className="text-xs text-gray-500">{customer.email}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{customer.phone || 'N/A'}</p>
                              </TableCell>
                              <TableCell>
                                <Badge className={customer.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {customer.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{customerLoans.length}</span>
                                  {customerLoans.length > 0 && (
                                    <span className="text-xs text-gray-500">(₹{totalBorrowed.toLocaleString()})</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {activeLoan ? (
                                  <div>
                                    <p className="font-medium text-green-600">{formatCurrency(activeLoan.sessionForm?.approvedAmount || activeLoan.requestedAmount)}</p>
                                    <p className="text-xs text-gray-500">{activeLoan.applicationNo}</p>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">None</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{formatDate(customer.createdAt)}</p>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => { 
                                      setSelectedUser(customer); 
                                      handleViewUserDetails(customer.id); 
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'companies':
        // Function to fetch and show company details
        const handleViewCompanyDetails = async (companyId: string) => {
          setLoadingDetailSheet(true);
          setDetailSheetType('company');
          setShowDetailSheet(true);
          try {
            const response = await fetch(`/api/company/details?companyId=${companyId}`);
            const data = await response.json();
            if (data.success) {
              setDetailSheetData(data.company);
            } else {
              toast({ title: 'Error', description: 'Failed to fetch company details', variant: 'destructive' });
            }
          } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch company details', variant: 'destructive' });
          } finally {
            setLoadingDetailSheet(false);
          }
        };

        return (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Companies</p>
                      <p className="text-2xl font-bold text-blue-600">{companyUsers.length}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Active</p>
                      <p className="text-2xl font-bold text-green-600">{companyUsers.filter(c => c.isActive).length}</p>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Agents</p>
                      <p className="text-2xl font-bold text-cyan-600">{agents.length}</p>
                    </div>
                    <div className="p-2 bg-cyan-50 rounded-lg">
                      <User className="h-5 w-5 text-cyan-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Loans</p>
                      <p className="text-2xl font-bold text-violet-600">{loans.length}</p>
                    </div>
                    <div className="p-2 bg-violet-50 rounded-lg">
                      <FileText className="h-5 w-5 text-violet-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Company Management
                  </CardTitle>
                  <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => { setUserForm({...userForm, role: 'COMPANY'}); setShowUserDialog(true); }}>
                    <UserPlus className="h-4 w-4 mr-2" />Add Company
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {companyUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">No companies found</p>
                    <Button className="mt-4 bg-blue-500 hover:bg-blue-600" onClick={() => { setUserForm({...userForm, role: 'COMPANY'}); setShowUserDialog(true); }}>
                      <UserPlus className="h-4 w-4 mr-2" />Add First Company
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {companyUsers.map((company) => (
                      <div key={company.id} className="p-4 border rounded-lg hover:bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-blue-100 text-blue-700">{company.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{company.name}</p>
                            <p className="text-sm text-gray-500">{company.email}</p>
                            <div className="flex gap-2 mt-1">
                              {(company.companyObj as { id: string; name: string; code?: string })?.code && <Badge variant="outline" className="text-xs">{(company.companyObj as { id: string; name: string; code?: string })?.code}</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={company.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {company.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => handleViewCompanyDetails(company.companyObj?.id || company.id)}>
                            <Eye className="h-4 w-4 mr-1" />View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'products':
        return (
          <div className="space-y-6">
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Loan Products</CardTitle>
                    <CardDescription>Manage loan products and their configurations</CardDescription>
                  </div>
                  <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => {
                    setSelectedProduct(null);
                    setProductForm({
                      title: '', description: '', icon: '💰', loanType: 'PERSONAL',
                      minInterestRate: 8, maxInterestRate: 24, defaultInterestRate: 12,
                      minTenure: 6, maxTenure: 60, defaultTenure: 12,
                      minAmount: 10000, maxAmount: 10000000,
                      processingFeePercent: 1, processingFeeMin: 500, processingFeeMax: 10000,
                      latePaymentPenaltyPercent: 2, gracePeriodDays: 5, bounceCharges: 500,
                      allowMoratorium: true, maxMoratoriumMonths: 3,
                      allowPrepayment: true, prepaymentCharges: 2, isActive: true
                    });
                    setShowProductDialog(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No loan products configured</p>
                    <Button className="mt-4 bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowProductDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />Create First Product
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((product: any) => (
                      <Card key={product.id} className={`border hover:shadow-md transition-shadow ${!product.isActive ? 'opacity-60' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-2xl">
                                {product.icon || '💰'}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{product.title}</h4>
                                  {!product.isActive && <Badge variant="secondary">Inactive</Badge>}
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{product.description}</p>
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {product.minInterestRate}% - {product.maxInterestRate}% p.a.
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {product.minTenure}-{product.maxTenure} months
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                  ₹{Number(product.minAmount).toLocaleString()} - ₹{Number(product.maxAmount).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" onClick={() => openEditProduct(product)}>
                              <Edit className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteProduct(product.id)}>
                              <Trash2 className="h-3 w-3 mr-1" />Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'emi-collection':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">EMI Collection</h2>
                <p className="text-gray-500">Today's EMI collection and tracking</p>
              </div>
            </div>
            <EMICollectionSection 
              userId={user?.id || ''} 
              userRole={user?.role || 'SUPER_ADMIN'}
              onPaymentComplete={() => {
                toast({ title: 'Payment Collected', description: 'EMI payment collected and credit updated' });
              }}
            />
          </div>
        );

      case 'emi-calendar':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">EMI Calendar</h2>
                <p className="text-gray-500">View and manage EMIs by date</p>
              </div>
            </div>
            <EMICalendar 
              userId={user?.id || ''} 
              userRole={user?.role || 'SUPER_ADMIN'}
            />
          </div>
        );

      case 'offline-loans':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Offline Loans</h2>
                <p className="text-gray-500">Manage offline loans created directly</p>
              </div>
              <OfflineLoanForm 
                createdById={user?.id || ''} 
                createdByRole={user?.role || 'SUPER_ADMIN'}
                onLoanCreated={() => {
                  toast({ title: 'Loan Created', description: 'Offline loan created successfully' });
                }}
              />
            </div>
            <OfflineLoansList 
              userId={user?.id}
              userRole={user?.role || 'SUPER_ADMIN'}
            />
          </div>
        );

      case 'interest-only':
        return (
          <div className="space-y-6">
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="h-5 w-5 text-purple-600" />
                      Interest-Only Loans
                    </CardTitle>
                    <CardDescription>
                      Special loan products where customers pay only interest until EMI is activated
                    </CardDescription>
                  </div>
                  <Button 
                    className="bg-purple-500 hover:bg-purple-600"
                    onClick={() => setShowInterestOnlyDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Interest-Only Loan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {interestOnlyLoans.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                      <Percent className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No interest-only loans created yet</p>
                      <p className="text-sm text-gray-400 mt-1">Create loans where customers pay only interest monthly</p>
                    </div>
                  ) : (
                    interestOnlyLoans.map((loan: any) => (
                      <Card key={loan.id} className={`border ${loan.status === 'ACTIVE' ? 'border-green-200 bg-green-50/30' : loan.status === 'INTEREST_PHASE' ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Percent className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">{loan.customer?.name || 'Unknown Customer'}</h4>
                                <p className="text-xs text-gray-500">{loan.applicationNo}</p>
                              </div>
                            </div>
                            <Badge className={loan.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : loan.status === 'INTEREST_PHASE' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}>
                              {loan.status === 'INTEREST_PHASE' ? 'Interest Phase' : loan.status}
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Principal Amount:</span>
                              <span className="font-medium">₹{formatCurrency(loan.principalAmount || loan.requestedAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Interest Rate:</span>
                              <span className="font-medium">{loan.interestRate}% p.a.</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Monthly Interest:</span>
                              <span className="font-medium text-purple-600">₹{formatCurrency((loan.principalAmount || loan.requestedAmount) * (loan.interestRate / 100) / 12)}</span>
                            </div>
                            {loan.status === 'INTEREST_PHASE' && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Interest Paid:</span>
                                <span className="font-medium text-green-600">₹{formatCurrency(loan.totalInterestPaid || 0)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 mt-4 pt-4 border-t">
                            {loan.status === 'INTEREST_PHASE' && (
                              <Button 
                                size="sm" 
                                className="bg-emerald-500 hover:bg-emerald-600 flex-1"
                                onClick={() => {
                                  setSelectedInterestOnlyLoan(loan);
                                  setShowStartEMIDialog(true);
                                }}
                              >
                                Start EMI
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setSelectedLoan(loan);
                                setSelectedLoanId(loan.id);
                                setShowLoanDetailPanel(true);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'myCredit':
        return <SuperAdminMyCredit />;

      case 'audit':
        return <AuditLogViewer />;

      case 'locationHistory':
        return <LocationHistoryViewer />;

      case 'personalCredits':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Personal Credit Management</h2>
                <p className="text-gray-500">Manage and clear personal credits - only CASH increases company credit</p>
              </div>
            </div>
            <PersonalCreditManager currentUser={{ id: user?.id || '', role: user?.role || 'SUPER_ADMIN' }} />
          </div>
        );

      case 'creditManagement':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Credit Management</h2>
                <p className="text-gray-500">Manage other users' credits - Company, Agent, Staff, Cashier</p>
              </div>
            </div>
            <CreditManagementPage />
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            {/* Company Profile Settings */}
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-gray-700" />System Settings</CardTitle>
                <CardDescription>Configure your company profile and system preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Company Logo Section */}
                <div className="flex flex-col md:flex-row gap-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center overflow-hidden">
                      {settings.companyLogo ? (
                        <img src={settings.companyLogo} alt="Company Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Landmark className="h-12 w-12 text-white" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h4 className="font-semibold text-gray-900">Company Logo</h4>
                    <p className="text-sm text-gray-500">Upload your company logo (recommended: 200x200px, PNG or JPG)</p>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Enter logo URL or paste image link"
                        value={settings.companyLogo || ''}
                        onChange={(e) => setSettings({ ...settings, companyLogo: e.target.value })}
                      />
                      {settings.companyLogo && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSettings({ ...settings, companyLogo: '' })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Basic Company Info */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Company Profile
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <Label>Company Name</Label>
                        <Input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} />
                      </div>
                      <div>
                        <Label>Tagline</Label>
                        <Input 
                          value={settings.companyTagline || ''} 
                          placeholder="Your tagline here..."
                          onChange={(e) => setSettings({ ...settings, companyTagline: e.target.value })} 
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input type="email" value={settings.companyEmail} onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })} />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input value={settings.companyPhone} onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })} />
                      </div>
                      <div>
                        <Label>Address</Label>
                        <Textarea value={settings.companyAddress} onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  {/* Interest Rate Settings */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Interest Rates
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <Label>Default Interest Rate (%)</Label>
                        <Input type="number" step="0.1" value={settings.defaultInterestRate} onChange={(e) => setSettings({ ...settings, defaultInterestRate: parseFloat(e.target.value) })} />
                      </div>
                      <div>
                        <Label>Minimum Rate (%)</Label>
                        <Input type="number" step="0.1" value={settings.minInterestRate} onChange={(e) => setSettings({ ...settings, minInterestRate: parseFloat(e.target.value) })} />
                      </div>
                      <div>
                        <Label>Maximum Rate (%)</Label>
                        <Input type="number" step="0.1" value={settings.maxInterestRate} onChange={(e) => setSettings({ ...settings, maxInterestRate: parseFloat(e.target.value) })} />
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <h5 className="font-medium text-emerald-800 mb-2">Quick Info</h5>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Total Users</p>
                          <p className="font-semibold text-gray-900">{users.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Companies</p>
                          <p className="font-semibold text-gray-900">{companyUsers.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Active Loans</p>
                          <p className="font-semibold text-gray-900">{activeLoans.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total Disbursed</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(totalDisbursed)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={saveSettings} disabled={savingSettings}>
                    <Save className="h-4 w-4 mr-2" />{savingSettings ? 'Saving...' : 'Save Settings'}
                  </Button>
                  <Button variant="outline" onClick={fetchSettings}>
                    <RefreshCw className="h-4 w-4 mr-2" />Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Loan Configuration Settings */}
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-gray-700" />Loan Configuration</CardTitle>
                <CardDescription>Default loan parameters and processing settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div>
                      <Label>Default Tenure (months)</Label>
                      <Input 
                        type="number" 
                        value={settings.defaultTenure || 12} 
                        onChange={(e) => setSettings({ ...settings, defaultTenure: parseInt(e.target.value) })} 
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Processing Fee (%)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={settings.processingFeePercent || 1} 
                        onChange={(e) => setSettings({ ...settings, processingFeePercent: parseFloat(e.target.value) })} 
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Late Payment Penalty (%)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={settings.latePaymentPenalty || 2} 
                        onChange={(e) => setSettings({ ...settings, latePaymentPenalty: parseFloat(e.target.value) })} 
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Reset Section */}
            <Card className="bg-white shadow-sm border-0 border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions that affect the entire system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <h4 className="font-semibold text-gray-900">Reset Entire System</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      This will delete all loans, EMIs, payments, transactions, and reset all credits to zero.
                      <span className="font-semibold text-red-600"> Users will NOT be deleted.</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      ⚠️ This action cannot be undone. All data will be permanently erased.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700 shrink-0"
                    onClick={() => setShowResetDialog(true)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset System
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Reset Dialog */}
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Confirm System Reset
                  </DialogTitle>
                  <DialogDescription>
                    This will permanently delete all data in the system except user accounts.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h5 className="font-semibold text-red-700 mb-2">The following will be deleted:</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• All loan applications</li>
                      <li>• All EMI schedules and payments</li>
                      <li>• All credit transactions</li>
                      <li>• All notifications and reminders</li>
                      <li>• All offline loans</li>
                      <li>• All journal entries and expenses</li>
                      <li>• All audit logs and workflow logs</li>
                    </ul>
                    <h5 className="font-semibold text-green-700 mt-3">Preserved:</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• All user accounts (roles remain intact)</li>
                      <li>• Company profiles</li>
                      <li>• System settings</li>
                    </ul>
                  </div>
                  <div>
                    <Label>Type <span className="font-mono font-bold">RESET_SYSTEM</span> to confirm:</Label>
                    <Input
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder="RESET_SYSTEM"
                      className="mt-2 font-mono"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowResetDialog(false); setResetConfirmText(''); }}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleSystemReset}
                    disabled={resetting || resetConfirmText !== 'RESET_SYSTEM'}
                  >
                    {resetting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reset System
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Secondary Payment Pages Section */}
            <SecondaryPaymentPagesSection userId={user?.id} />
          </div>
        );

      case 'analytics':
        // Calculate analytics data
        const conversionRate = loans.length > 0 ? ((activeLoans.length / loans.length) * 100).toFixed(1) : '0';
        const avgLoanAmount = loans.length > 0 ? Math.round(totalRequested / loans.length) : 0;
        const approvalRate = loans.length > 0 ? (((activeLoans.length + inProgressLoans.length) / loans.length) * 100).toFixed(1) : '0';
        
        // Group loans by month for trends
        const loansByMonth: Record<string, { total: number; disbursed: number; rejected: number }> = {};
        loans.forEach(loan => {
          const month = new Date(loan.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          if (!loansByMonth[month]) loansByMonth[month] = { total: 0, disbursed: 0, rejected: 0 };
          loansByMonth[month].total++;
          if (['ACTIVE', 'DISBURSED'].includes(loan.status)) loansByMonth[month].disbursed++;
          if (['REJECTED_BY_SA', 'REJECTED_BY_COMPANY', 'REJECTED_FINAL', 'SESSION_REJECTED'].includes(loan.status)) loansByMonth[month].rejected++;
        });
        const sortedMonths = Object.keys(loansByMonth).slice(-6);

        // Loan type distribution
        const loansByType: Record<string, number> = {};
        loans.forEach(loan => {
          const type = loan.loanType || 'Other';
          loansByType[type] = (loansByType[type] || 0) + 1;
        });

        return (
          <div className="space-y-6">
            {/* Analytics Overview */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Conversion Rate</p>
                      <p className="text-2xl font-bold text-emerald-600">{conversionRate}%</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Avg. Loan Amount</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(avgLoanAmount)}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Approval Rate</p>
                      <p className="text-2xl font-bold text-green-600">{approvalRate}%</p>
                    </div>
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Disbursed</p>
                      <p className="text-2xl font-bold text-violet-600">{formatCurrency(totalDisbursed)}</p>
                    </div>
                    <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                      <Wallet className="h-6 w-6 text-violet-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Monthly Application Trends */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Monthly Application Trends
                  </CardTitle>
                  <CardDescription>Applications, disbursements, and rejections by month</CardDescription>
                </CardHeader>
                <CardContent>
                  {sortedMonths.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                      <p>No data available yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedMonths.map(month => {
                        const data = loansByMonth[month];
                        const maxVal = Math.max(data.total, 1);
                        return (
                          <div key={month} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-gray-700">{month}</span>
                              <span className="text-gray-500">{data.total} applications</span>
                            </div>
                            <div className="flex gap-1 h-6">
                              <div className="bg-blue-500 rounded-l" style={{ width: `${(data.total / maxVal) * 100}%` }} title={`${data.total} Total`} />
                              <div className="bg-green-500" style={{ width: `${(data.disbursed / maxVal) * 100}%` }} title={`${data.disbursed} Disbursed`} />
                              <div className="bg-red-500 rounded-r" style={{ width: `${(data.rejected / maxVal) * 100}%` }} title={`${data.rejected} Rejected`} />
                            </div>
                            <div className="flex gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded" /> Total: {data.total}</span>
                              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded" /> Disbursed: {data.disbursed}</span>
                              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded" /> Rejected: {data.rejected}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Loan Type Distribution */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-600" />
                    Loan Type Distribution
                  </CardTitle>
                  <CardDescription>Breakdown of applications by loan type</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(loansByType).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                      <p>No loan data available</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(loansByType)
                        .sort(([,a], [,b]) => b - a)
                        .map(([type, count], index) => {
                          const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
                          const color = colors[index % colors.length];
                          const percentage = loans.length > 0 ? ((count / loans.length) * 100).toFixed(1) : '0';
                          return (
                            <div key={type} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-gray-700">{type}</span>
                                <span className="text-gray-500">{count} ({percentage}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Status Pipeline */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Application Status Pipeline</CardTitle>
                <CardDescription>Detailed breakdown of all application statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'New', count: pendingForSA.length, color: 'bg-blue-100 text-blue-700' },
                    { label: 'In Progress', count: inProgressLoans.length, color: 'bg-amber-100 text-amber-700' },
                    { label: 'Awaiting Final', count: pendingForFinal.length, color: 'bg-cyan-100 text-cyan-700' },
                    { label: 'Active', count: activeLoans.length, color: 'bg-green-100 text-green-700' },
                    { label: 'Rejected', count: rejectedLoans.length, color: 'bg-red-100 text-red-700' },
                    { label: 'High Risk', count: highRiskLoans.length, color: 'bg-orange-100 text-orange-700' },
                  ].map((item) => (
                    <div key={item.label} className={`p-4 rounded-xl ${item.color.split(' ')[1]}`}>
                      <p className="text-2xl font-bold">{item.count}</p>
                      <p className="text-sm">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'risk':
        // Risk analysis
        const lowRiskLoans = loans.filter(l => (l.riskScore || 0) < 30);
        const mediumRiskLoans = loans.filter(l => (l.riskScore || 0) >= 30 && (l.riskScore || 0) < 50);
        const flaggedLoans = loans.filter(l => l.fraudFlag);
        const avgRiskScore = loans.length > 0 
          ? (loans.reduce((sum, l) => sum + (l.riskScore || 0), 0) / loans.length).toFixed(1) 
          : '0';

        // Risk by loan type
        const riskByType: Record<string, { count: number; totalRisk: number }> = {};
        highRiskLoans.forEach(loan => {
          const type = loan.loanType || 'Other';
          if (!riskByType[type]) riskByType[type] = { count: 0, totalRisk: 0 };
          riskByType[type].count++;
          riskByType[type].totalRisk += loan.riskScore || 0;
        });

        return (
          <div className="space-y-6">
            {/* Risk Overview Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">High Risk Loans</p>
                      <p className="text-2xl font-bold text-red-600">{highRiskLoans.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Fraud Flags</p>
                      <p className="text-2xl font-bold text-orange-600">{flaggedLoans.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                      <Shield className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Avg. Risk Score</p>
                      <p className="text-2xl font-bold text-amber-600">{avgRiskScore}</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                      <Activity className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Low Risk Loans</p>
                      <p className="text-2xl font-bold text-green-600">{lowRiskLoans.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk Distribution and High Risk by Type */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Risk Score Distribution */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-600" />
                    Risk Score Distribution
                  </CardTitle>
                  <CardDescription>Breakdown of loans by risk category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: 'Low Risk (0-29)', count: lowRiskLoans.length, color: 'bg-green-500', bgLight: 'bg-green-50' },
                      { label: 'Medium Risk (30-49)', count: mediumRiskLoans.length, color: 'bg-amber-500', bgLight: 'bg-amber-50' },
                      { label: 'High Risk (50+)', count: highRiskLoans.length, color: 'bg-red-500', bgLight: 'bg-red-50' },
                    ].map((item) => {
                      const total = lowRiskLoans.length + mediumRiskLoans.length + highRiskLoans.length;
                      const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={item.label} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-700">{item.label}</span>
                            <span className="text-gray-500">{item.count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-3">
                            <div className={`${item.color} h-3 rounded-full transition-all`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* High Risk by Loan Type */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-red-600" />
                    High Risk by Loan Type
                  </CardTitle>
                  <CardDescription>Which loan types have the most risk</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(riskByType).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                      <p>No high-risk loans detected</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(riskByType)
                        .sort(([,a], [,b]) => b.count - a.count)
                        .map(([type, data]) => {
                          const avgRisk = (data.totalRisk / data.count).toFixed(0);
                          return (
                            <div key={type} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                              <div>
                                <p className="font-medium text-gray-900">{type}</p>
                                <p className="text-sm text-gray-500">{data.count} high-risk loans</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-red-600">Avg: {avgRisk}</p>
                                <p className="text-xs text-gray-500">Risk Score</p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* High Risk Loans List */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  High Risk Loans
                </CardTitle>
                <CardDescription>Loans with risk score of 50 or higher requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                {highRiskLoans.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>No high-risk loans detected</p>
                    <p className="text-sm mt-1">All loans are within acceptable risk parameters</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {highRiskLoans
                      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
                      .map((loan, index) => (
                        <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                          className="p-4 border border-red-100 rounded-xl hover:bg-red-50 transition-all bg-white">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
                                  {getStatusBadge(loan.status)}
                                  {loan.fraudFlag && <Badge className="bg-orange-100 text-orange-700">Fraud Flag</Badge>}
                                </div>
                                <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
                                <p className="text-xs text-gray-500">{loan.loanType}</p>
                              </div>
                              <div className="flex flex-col items-end">
                                <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1">
                                  Risk: {loan.riskScore || 0}
                                </Badge>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => { setSelectedLoan(loan); setShowLoanDetailsDialog(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fraud Flagged Loans */}
            {flaggedLoans.length > 0 && (
              <Card className="border-0 shadow-sm border-l-4 border-l-orange-500">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-600" />
                    Fraud Flagged Applications
                  </CardTitle>
                  <CardDescription>Applications flagged for potential fraud - requires immediate review</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {flaggedLoans.map((loan, index) => (
                      <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                        className="p-4 border border-orange-100 rounded-xl hover:bg-orange-50 transition-all bg-white">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                              <Shield className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
                                {getStatusBadge(loan.status)}
                              </div>
                              <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
                              <p className="text-xs text-gray-500">{loan.loanType}</p>
                            </div>
                            <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => { setSelectedLoan(loan); setShowLoanDetailsDialog(true); }}>
                              Review
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'dashboard':
      default:
        return (
          <div className="space-y-6">
            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Application Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: 'New Applications', count: pendingForSA.length, color: 'bg-blue-500', width: loans.length ? (pendingForSA.length / loans.length * 100) : 0 },
                      { label: 'In Progress', count: inProgressLoans.length, color: 'bg-amber-500', width: loans.length ? (inProgressLoans.length / loans.length * 100) : 0 },
                      { label: 'Active Loans', count: activeLoans.length, color: 'bg-green-500', width: loans.length ? (activeLoans.length / loans.length * 100) : 0 },
                      { label: 'Rejected', count: rejectedLoans.length, color: 'bg-red-500', width: loans.length ? (rejectedLoans.length / loans.length * 100) : 0 },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-medium">{item.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${item.width}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">User Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Companies', count: companyUsers.length, icon: Building2, color: 'text-blue-600 bg-blue-50' },
                      { label: 'Agents', count: agents.length, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
                      { label: 'Staff', count: staff.length, icon: User, color: 'text-purple-600 bg-purple-50' },
                      { label: 'Cashiers', count: cashiers.length, icon: Banknote, color: 'text-orange-600 bg-orange-50' },
                      { label: 'Accountants', count: accountants.length, icon: Calculator, color: 'text-teal-600 bg-teal-50' },
                    ].map((item) => (
                      <div key={item.label} className={`p-4 rounded-xl ${item.color.split(' ')[1]}`}>
                        <item.icon className={`h-5 w-5 ${item.color.split(' ')[0]} mb-2`} />
                        <p className="text-2xl font-bold">{item.count}</p>
                        <p className="text-sm text-gray-600">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Pending Applications */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Pending Applications</CardTitle>
                  {pendingForSA.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('pending')}>
                      View All <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pendingForSA.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                    <p>All caught up! No pending applications.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingForSA.slice(0, 5).map((loan, index) => (
                      <div key={loan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-blue-100 text-blue-700">{loan.customer?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{loan.applicationNo}</p>
                            <p className="text-sm text-gray-500">{loan.customer?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-semibold">{formatCurrency(loan.requestedAmount)}</p>
                          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" 
                            onClick={() => { setSelectedLoan(loan); setApprovalAction('approve'); setShowApprovalDialog(true); }}>
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <DashboardLayout
      title="Super Admin Dashboard"
      subtitle="Manage the entire loan management system"
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      stats={stats}
      gradient="bg-gradient-to-br from-purple-600 to-indigo-700"
      logoIcon={Shield}
    >
      {renderContent()}

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className={selectedLoan?.status === 'CUSTOMER_SESSION_APPROVED' ? 'max-w-2xl' : ''}>
          <DialogHeader>
            <DialogTitle>{approvalAction === 'approve' ? 'Approve Application' : 'Reject Application'}</DialogTitle>
            <DialogDescription>
              {selectedLoan?.applicationNo} - {selectedLoan?.customer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLoan && (
              <>
                {/* Show Sanction Details for Final Approval */}
                {selectedLoan.status === 'CUSTOMER_SESSION_APPROVED' && selectedLoan.sessionForm ? (
                  <div className="space-y-4">
                    {/* Original vs Sanction Comparison */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Sanction Changes (Modified Details)
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-xs text-amber-600 font-medium uppercase">Original Request</p>
                          <div className="bg-white p-3 rounded border border-amber-100 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Amount:</span>
                              <span className="font-medium line-through text-gray-400">{formatCurrency(selectedLoan.requestedAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Tenure:</span>
                              <span className="font-medium">{selectedLoan.requestedTenure || 'N/A'} months</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Interest:</span>
                              <span className="font-medium">{selectedLoan.requestedInterestRate || 'N/A'}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-emerald-600 font-medium uppercase">Sanction Approved</p>
                          <div className="bg-emerald-50 p-3 rounded border border-emerald-200 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Amount:</span>
                              <span className="font-bold text-emerald-700">{formatCurrency(selectedLoan.sessionForm.approvedAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Tenure:</span>
                              <span className="font-bold text-emerald-700">{selectedLoan.sessionForm.tenure} months</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Interest:</span>
                              <span className="font-bold text-emerald-700">{selectedLoan.sessionForm.interestRate}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* EMI Details */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-3">EMI & Charges</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-blue-600">Monthly EMI</p>
                          <p className="text-xl font-bold text-blue-800">{formatCurrency(selectedLoan.sessionForm.emiAmount)}</p>
                        </div>
                        <div>
                          <p className="text-blue-600">Total Interest</p>
                          <p className="text-xl font-bold text-blue-800">{formatCurrency(selectedLoan.sessionForm.totalInterest)}</p>
                        </div>
                        <div>
                          <p className="text-blue-600">Total Repayment</p>
                          <p className="text-xl font-bold text-blue-800">{formatCurrency(selectedLoan.sessionForm.totalAmount)}</p>
                        </div>
                      </div>
                      {selectedLoan.sessionForm.processingFee > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-200 flex justify-between text-sm">
                          <span className="text-blue-600">Processing Fee:</span>
                          <span className="font-semibold text-blue-800">
                            {selectedLoan.sessionForm.processingFeeType === 'PERCENTAGE' 
                              ? `${selectedLoan.sessionForm.processingFee}%` 
                              : formatCurrency(selectedLoan.sessionForm.processingFee)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Customer Approval Info */}
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">Customer has approved this sanction</p>
                        <p className="text-sm text-green-600">Approved on: {selectedLoan.sessionForm.customerApprovedAt ? formatDate(selectedLoan.sessionForm.customerApprovedAt) : 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Original Details for Non-Final Approval */
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Amount</p>
                        <p className="font-semibold">{formatCurrency(selectedLoan.requestedAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Type</p>
                        <p className="font-semibold">{selectedLoan.loanType}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Tenure</p>
                        <p className="font-semibold">{selectedLoan.requestedTenure || 'N/A'} months</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Purpose</p>
                        <p className="font-semibold">{selectedLoan.purpose || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {approvalAction === 'approve' && selectedLoan?.status === 'SUBMITTED' && (
              <div>
                <Label>Assign to Company *</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Remarks</Label>
              <Textarea placeholder="Add remarks (optional)..." value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancel</Button>
            <Button className={approvalAction === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} onClick={handleApproval}>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan Details Dialog */}
      <Dialog open={showLoanDetailsDialog} onOpenChange={setShowLoanDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
            <DialogDescription>{selectedLoan?.applicationNo}</DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-semibold">{selectedLoan.customer?.name}</p>
                  <p className="text-sm text-gray-500">{selectedLoan.customer?.email}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedLoan.status)}
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-semibold">{formatCurrency(selectedLoan.requestedAmount)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Loan Type</p>
                  <p className="font-semibold">{selectedLoan.loanType}</p>
                </div>
              </div>
              {selectedLoan.company && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Assigned Company</p>
                  <p className="font-semibold">{selectedLoan.company.name}</p>
                </div>
              )}
              {selectedLoan.sessionForm && (
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Sanction Details</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Approved Amount</p>
                      <p className="font-semibold">{formatCurrency(selectedLoan.sessionForm.approvedAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Interest Rate</p>
                      <p className="font-semibold">{selectedLoan.sessionForm.interestRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">EMI</p>
                      <p className="font-semibold">{formatCurrency(selectedLoan.sessionForm.emiAmount)}/mo</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User Create Dialog */}
      {/* Company Creation Dialog */}
      <Dialog open={showUserDialog && userForm.role === 'COMPANY'} onOpenChange={(open) => !open && setShowUserDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-6 w-6 text-blue-600" />
              Create Company Account
            </DialogTitle>
            <DialogDescription>Create a new company. A company profile will be auto-generated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Company Name *</Label>
              <Input placeholder="Enter company name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email Address *</Label>
              <Input type="email" placeholder="company@example.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone Number</Label>
              <Input placeholder="+91 9876543210" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password *</Label>
              <Input type="password" placeholder="Min 6 characters" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleCreateUser} disabled={savingUser}>
              {savingUser ? 'Creating...' : 'Create Company'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Creation Dialog */}
      <Dialog open={showUserDialog && userForm.role === 'AGENT'} onOpenChange={(open) => !open && setShowUserDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <User className="h-6 w-6 text-cyan-600" />
              Create Agent Account
            </DialogTitle>
            <DialogDescription>
              Create a new agent who can manage loan applications. Agents are common for all companies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Full Name *</Label>
              <Input placeholder="Agent name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email Address *</Label>
              <Input type="email" placeholder="agent@example.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone Number</Label>
              <Input placeholder="+91 9876543210" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
            </div>
            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
              <p className="text-sm text-cyan-700">
                <strong>Note:</strong> Agents in this system are common for all companies. They can work with any company's loans.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password *</Label>
              <Input type="password" placeholder="Min 6 characters" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={handleCreateUser} disabled={savingUser}>
              {savingUser ? 'Creating...' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Creation Dialog */}
      <Dialog open={showUserDialog && userForm.role === 'STAFF'} onOpenChange={(open) => !open && setShowUserDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Briefcase className="h-6 w-6 text-purple-600" />
              Create Staff Account
            </DialogTitle>
            <DialogDescription>Create a staff member who will collect loan forms from customers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Full Name *</Label>
              <Input placeholder="Staff name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email Address *</Label>
              <Input type="email" placeholder="staff@example.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone Number *</Label>
              <Input placeholder="+91 9876543210" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assign to Agent *</Label>
              <Select value={userForm.agentId} onValueChange={(v) => setUserForm({ ...userForm, agentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name} ({a.agentCode})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password *</Label>
              <Input type="password" placeholder="Min 6 characters" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
            <Button className="bg-purple-500 hover:bg-purple-600" onClick={handleCreateUser} disabled={savingUser}>
              {savingUser ? 'Creating...' : 'Create Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cashier Creation Dialog - Ecosystem Wide */}
      <Dialog open={showUserDialog && userForm.role === 'CASHIER'} onOpenChange={(open) => !open && setShowUserDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Banknote className="h-6 w-6 text-orange-600" />
              Create Cashier Account
            </DialogTitle>
            <DialogDescription>
              Create an ecosystem-wide cashier who can handle payment collections across all companies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-700">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Ecosystem-Wide Access</span>
              </div>
              <p className="text-xs text-orange-600 mt-1">
                This cashier will have access to handle payments from ALL companies in the system.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Full Name *</Label>
              <Input placeholder="Cashier name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email Address *</Label>
              <Input type="email" placeholder="cashier@example.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone Number *</Label>
              <Input placeholder="+91 9876543210" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password *</Label>
              <Input type="password" placeholder="Min 6 characters" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleCreateUser} disabled={savingUser}>
              {savingUser ? 'Creating...' : 'Create Cashier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accountant Creation Dialog - Ecosystem Wide */}
      <Dialog open={showUserDialog && userForm.role === 'ACCOUNTANT'} onOpenChange={(open) => !open && setShowUserDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Calculator className="h-6 w-6 text-teal-600" />
              Create Accountant Account
            </DialogTitle>
            <DialogDescription>
              Create an ecosystem-wide accountant who can manage financial records across all companies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="flex items-center gap-2 text-teal-700">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Ecosystem-Wide Access</span>
              </div>
              <p className="text-xs text-teal-600 mt-1">
                This accountant will have access to financial data from ALL companies in the system.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Full Name *</Label>
              <Input placeholder="Accountant name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email Address *</Label>
              <Input type="email" placeholder="accountant@example.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone Number *</Label>
              <Input placeholder="+91 9876543210" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password *</Label>
              <Input type="password" placeholder="Min 6 characters" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
            <Button className="bg-teal-500 hover:bg-teal-600" onClick={handleCreateUser} disabled={savingUser}>
              {savingUser ? 'Creating...' : 'Create Accountant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprehensive Loan Details Dialog */}
      <Dialog open={showComprehensiveLoanDialog} onOpenChange={setShowComprehensiveLoanDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : loanDetails ? (
            <>
              <DialogHeader className="p-6 pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl flex items-center gap-2">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      {loanDetails.loan.applicationNo}
                    </DialogTitle>
                    <DialogDescription>
                      {loanDetails.loan.customer?.name} • {loanDetails.loan.loanType} Loan
                    </DialogDescription>
                  </div>
                  {getStatusBadge(loanDetails.loan.status)}
                </div>
              </DialogHeader>
              
              <div className="p-6 pt-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                <Tabs value={detailsTab} onValueChange={setDetailsTab}>
                  <TabsList className="grid grid-cols-6 mb-6">
                    <TabsTrigger value="customer" className="text-xs">Customer</TabsTrigger>
                    <TabsTrigger value="verification" className="text-xs">Verification</TabsTrigger>
                    <TabsTrigger value="session" className="text-xs">Sanction</TabsTrigger>
                    <TabsTrigger value="workflow" className="text-xs">Workflow</TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                    <TabsTrigger value="emi" className="text-xs">EMI</TabsTrigger>
                  </TabsList>

                  {/* Customer Details Tab */}
                  <TabsContent value="customer" className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Personal Info */}
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600" />
                            Personal Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500">Full Name</p>
                              <p className="font-medium">{loanDetails.loan.customer?.name || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Date of Birth</p>
                              <p className="font-medium">{loanDetails.loan.customer?.dateOfBirth ? formatDate(loanDetails.loan.customer.dateOfBirth) : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">PAN Number</p>
                              <p className="font-medium font-mono">{loanDetails.loan.customer?.panNumber || loanDetails.loan.panNumber || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Aadhaar Number</p>
                              <p className="font-medium font-mono">{loanDetails.loan.customer?.aadhaarNumber ? `XXXX-XXXX-${loanDetails.loan.customer.aadhaarNumber.slice(-4)}` : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Gender</p>
                              <p className="font-medium">{loanDetails.loan.gender || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Marital Status</p>
                              <p className="font-medium">{loanDetails.loan.maritalStatus || 'N/A'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Contact Info */}
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-600" />
                            Contact Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="col-span-2">
                              <p className="text-gray-500">Email</p>
                              <p className="font-medium flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                {loanDetails.loan.customer?.email || 'N/A'}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-gray-500">Phone</p>
                              <p className="font-medium flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                {loanDetails.loan.customer?.phone || loanDetails.loan.phone || 'N/A'}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-gray-500">Address</p>
                              <p className="font-medium flex items-start gap-2">
                                <MapPin className="h-3 w-3 mt-1" />
                                {[
                                  loanDetails.loan.customer?.address || loanDetails.loan.address,
                                  loanDetails.loan.customer?.city || loanDetails.loan.city,
                                  loanDetails.loan.customer?.state || loanDetails.loan.state,
                                  loanDetails.loan.customer?.pincode || loanDetails.loan.pincode
                                ].filter(Boolean).join(', ') || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Employment Info */}
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-purple-600" />
                            Employment Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500">Employment Type</p>
                              <p className="font-medium">{loanDetails.loan.customer?.employmentType || loanDetails.loan.employmentType || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Monthly Income</p>
                              <p className="font-medium">{loanDetails.loan.customer?.monthlyIncome ? formatCurrency(loanDetails.loan.customer.monthlyIncome) : 'N/A'}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-gray-500">Employer Name</p>
                              <p className="font-medium">{loanDetails.loan.employerName || 'N/A'}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-gray-500">Designation</p>
                              <p className="font-medium">{loanDetails.loan.designation || 'N/A'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Bank Info */}
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-orange-600" />
                            Bank Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500">Bank Name</p>
                              <p className="font-medium">{loanDetails.loan.customer?.bankName || loanDetails.loan.bankName || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Account Type</p>
                              <p className="font-medium">{loanDetails.loan.accountType || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Account Number</p>
                              <p className="font-medium font-mono">
                                {loanDetails.loan.customer?.bankAccountNumber || loanDetails.loan.bankAccountNumber 
                                  ? `XXXX-XXXX-${(loanDetails.loan.customer?.bankAccountNumber || loanDetails.loan.bankAccountNumber).slice(-4)}` 
                                  : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">IFSC Code</p>
                              <p className="font-medium font-mono">{loanDetails.loan.customer?.bankIfsc || loanDetails.loan.bankIfsc || 'N/A'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Verification Tab */}
                  <TabsContent value="verification" className="space-y-4">
                    <Card className="border shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-teal-600" />
                          Verification Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {loanDetails.loan.loanForm ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                              { label: 'PAN Verified', value: loanDetails.loan.loanForm.panVerified },
                              { label: 'Aadhaar Verified', value: loanDetails.loan.loanForm.aadhaarVerified },
                              { label: 'Bank Verified', value: loanDetails.loan.loanForm.bankVerified },
                              { label: 'Employment Verified', value: loanDetails.loan.loanForm.employmentVerified },
                              { label: 'Address Verified', value: loanDetails.loan.loanForm.addressVerified },
                              { label: 'Income Verified', value: loanDetails.loan.loanForm.incomeVerified },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                {item.value ? (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-400" />
                                )}
                                <span className="text-sm font-medium">{item.label}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <FileCheck className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                            <p>No verification data available</p>
                          </div>
                        )}
                        {loanDetails.loan.loanForm?.verificationRemarks && (
                          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-500">Verification Remarks</p>
                            <p className="text-sm">{loanDetails.loan.loanForm.verificationRemarks}</p>
                          </div>
                        )}
                        {loanDetails.loan.loanForm?.riskScore !== undefined && (
                          <div className="mt-4 flex items-center gap-4">
                            <div className="p-3 bg-amber-50 rounded-lg">
                              <p className="text-xs text-gray-500">Risk Score</p>
                              <p className="text-lg font-bold text-amber-600">{loanDetails.loan.loanForm.riskScore}</p>
                            </div>
                            {loanDetails.loan.loanForm.fraudFlag && (
                              <Badge className="bg-red-100 text-red-700">
                                <AlertTriangle className="h-3 w-3 mr-1" />Fraud Flag
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Sanction Tab */}
                  <TabsContent value="session" className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card className="border shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-blue-600" />
                            Loan Terms
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {loanDetails.loan.sessionForm ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-emerald-50 rounded-lg">
                                  <p className="text-xs text-gray-500">Approved Amount</p>
                                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(loanDetails.loan.sessionForm.approvedAmount)}</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-lg">
                                  <p className="text-xs text-gray-500">Interest Rate</p>
                                  <p className="text-xl font-bold text-blue-600">{loanDetails.loan.sessionForm.interestRate}%</p>
                                </div>
                                <div className="p-3 bg-purple-50 rounded-lg">
                                  <p className="text-xs text-gray-500">Tenure</p>
                                  <p className="text-xl font-bold text-purple-600">{loanDetails.loan.sessionForm.tenure} months</p>
                                </div>
                                <div className="p-3 bg-orange-50 rounded-lg">
                                  <p className="text-xs text-gray-500">EMI Amount</p>
                                  <p className="text-xl font-bold text-orange-600">{formatCurrency(loanDetails.loan.sessionForm.emiAmount)}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-500">Processing Fee</p>
                                  <p className="font-medium">{formatCurrency(loanDetails.loan.sessionForm.processingFee || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Total Interest</p>
                                  <p className="font-medium">{formatCurrency(loanDetails.loan.sessionForm.totalInterest || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Total Amount</p>
                                  <p className="font-medium">{formatCurrency(loanDetails.loan.sessionForm.totalAmount || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Moratorium Period</p>
                                  <p className="font-medium">{loanDetails.loan.sessionForm.moratoriumPeriod || 0} months</p>
                                </div>
                              </div>
                              {loanDetails.loan.sessionForm.agent && (
                                <div className="pt-4 border-t">
                                  <p className="text-xs text-gray-500 mb-2">Sanction Created By</p>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                                        {loanDetails.loan.sessionForm.agent.name?.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="text-sm font-medium">{loanDetails.loan.sessionForm.agent.name}</p>
                                      <p className="text-xs text-gray-500">{loanDetails.loan.sessionForm.agent.agentCode}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <Calculator className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                              <p>No sanction data available</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-green-600" />
                            Disbursement Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Disbursed Amount</p>
                                <p className="font-bold text-lg">{formatCurrency(loanDetails.loan.disbursedAmount || loanDetails.loan.sessionForm?.approvedAmount || 0)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Disbursement Date</p>
                                <p className="font-medium">{loanDetails.loan.disbursedAt ? formatDate(loanDetails.loan.disbursedAt) : 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Mode</p>
                                <p className="font-medium">{loanDetails.loan.disbursementMode || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Reference</p>
                                <p className="font-medium font-mono">{loanDetails.loan.disbursementRef || 'N/A'}</p>
                              </div>
                            </div>
                            {loanDetails.loan.disbursedBy && (
                              <div className="pt-4 border-t">
                                <p className="text-xs text-gray-500 mb-2">Disbursed By</p>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-orange-100 text-orange-700">
                                      {loanDetails.loan.disbursedBy.name?.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <p className="text-sm font-medium">{loanDetails.loan.disbursedBy.name}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Workflow Tab */}
                  <TabsContent value="workflow" className="space-y-4">
                    <Card className="border shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4 text-indigo-600" />
                          Workflow Pipeline
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="relative">
                          {loanDetails.workflowPipeline?.map((stage: any, index: number) => (
                            <div key={stage.status} className="flex items-start gap-4 pb-6 last:pb-0">
                              {/* Timeline connector */}
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  stage.isCompleted 
                                    ? 'bg-green-500 text-white' 
                                    : stage.isCurrent 
                                      ? 'bg-blue-500 text-white ring-4 ring-blue-100' 
                                      : 'bg-gray-200 text-gray-500'
                                }`}>
                                  {stage.isCompleted ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : (
                                    <span className="text-xs font-bold">{index + 1}</span>
                                  )}
                                </div>
                                {index < loanDetails.workflowPipeline.length - 1 && (
                                  <div className={`w-0.5 h-full min-h-[40px] mt-1 ${
                                    stage.isCompleted ? 'bg-green-500' : 'bg-gray-200'
                                  }`} />
                                )}
                              </div>
                              
                              {/* Stage content */}
                              <div className="flex-1 pb-4">
                                <div className="flex items-center gap-2">
                                  <p className={`font-medium ${stage.isCompleted || stage.isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {stage.label}
                                  </p>
                                  {stage.isCurrent && (
                                    <Badge className="bg-blue-100 text-blue-700 text-xs">Current</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">{stage.role}</p>
                                {stage.timestamp && (
                                  <p className="text-xs text-gray-400 mt-1">{formatDate(stage.timestamp)}</p>
                                )}
                                {stage.actionBy && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="text-[8px] bg-gray-100">
                                        {stage.actionBy.name?.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-gray-600">{stage.actionBy.name}</span>
                                    <Badge variant="outline" className="text-xs">{stage.actionBy.role}</Badge>
                                  </div>
                                )}
                                {stage.remarks && (
                                  <p className="text-xs text-gray-500 mt-1 italic">"{stage.remarks}"</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Workflow Logs */}
                    <Card className="border shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-sm">Workflow History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-60 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Action</TableHead>
                                <TableHead className="text-xs">From</TableHead>
                                <TableHead className="text-xs">To</TableHead>
                                <TableHead className="text-xs">By</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loanDetails.loan.workflowLogs?.map((log: any) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-xs">{formatDate(log.createdAt)}</TableCell>
                                  <TableCell className="text-xs font-medium capitalize">{log.action}</TableCell>
                                  <TableCell className="text-xs">{log.previousStatus?.replace(/_/g, ' ')}</TableCell>
                                  <TableCell className="text-xs">{log.newStatus?.replace(/_/g, ' ')}</TableCell>
                                  <TableCell className="text-xs">{log.actionBy?.name || 'System'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Documents Tab */}
                  <TabsContent value="documents" className="space-y-4">
                    <Card className="border shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4 text-amber-600" />
                          Uploaded Documents
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { label: 'PAN Card', key: 'panCardDoc', icon: FileText },
                            { label: 'Aadhaar Front', key: 'aadhaarFrontDoc', icon: FileText },
                            { label: 'Aadhaar Back', key: 'aadhaarBackDoc', icon: FileText },
                            { label: 'Income Proof', key: 'incomeProofDoc', icon: FileText },
                            { label: 'Address Proof', key: 'addressProofDoc', icon: MapPin },
                            { label: 'Photo', key: 'photoDoc', icon: User },
                            { label: 'Bank Statement', key: 'bankStatementDoc', icon: Receipt },
                            { label: 'Salary Slip', key: 'salarySlipDoc', icon: Receipt },
                          ].map((doc) => {
                            const docUrl = loanDetails.loan[doc.key];
                            return (
                              <div 
                                key={doc.key} 
                                className={`p-4 rounded-lg border ${docUrl ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <doc.icon className={`h-4 w-4 ${docUrl ? 'text-gray-600' : 'text-gray-300'}`} />
                                  <span className={`text-sm font-medium ${docUrl ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {doc.label}
                                  </span>
                                </div>
                                {docUrl ? (
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" asChild>
                                      <a href={docUrl} target="_blank" rel="noopener noreferrer">
                                        <Eye className="h-3 w-3 mr-1" />View
                                      </a>
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">Not uploaded</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* EMI Tab */}
                  <TabsContent value="emi" className="space-y-4">
                    {/* EMI Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="border shadow-sm">
                        <CardContent className="p-4">
                          <p className="text-xs text-gray-500">Total EMIs</p>
                          <p className="text-2xl font-bold text-gray-900">{loanDetails.emiSummary.totalEMIs}</p>
                        </CardContent>
                      </Card>
                      <Card className="border shadow-sm">
                        <CardContent className="p-4">
                          <p className="text-xs text-gray-500">Paid</p>
                          <p className="text-2xl font-bold text-green-600">{loanDetails.emiSummary.paidEMIs}</p>
                        </CardContent>
                      </Card>
                      <Card className="border shadow-sm">
                        <CardContent className="p-4">
                          <p className="text-xs text-gray-500">Pending</p>
                          <p className="text-2xl font-bold text-blue-600">{loanDetails.emiSummary.pendingEMIs}</p>
                        </CardContent>
                      </Card>
                      <Card className="border shadow-sm">
                        <CardContent className="p-4">
                          <p className="text-xs text-gray-500">Overdue</p>
                          <p className="text-2xl font-bold text-red-600">{loanDetails.emiSummary.overdueEMIs}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* EMI Schedule Table */}
                    <Card className="border shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-sm">EMI Schedule</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-80 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">#</TableHead>
                                <TableHead className="text-xs">Due Date</TableHead>
                                <TableHead className="text-xs">Principal</TableHead>
                                <TableHead className="text-xs">Interest</TableHead>
                                <TableHead className="text-xs">Total</TableHead>
                                <TableHead className="text-xs">Paid</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loanDetails.loan.emiSchedules?.map((emi: any) => {
                                const isPaid = emi.paymentStatus === 'PAID' || emi.paymentStatus === 'INTEREST_ONLY_PAID';
                                return (
                                <TableRow key={emi.id}>
                                  <TableCell className="text-xs font-medium">{emi.installmentNumber}</TableCell>
                                  <TableCell className="text-xs">{formatDate(emi.dueDate)}</TableCell>
                                  <TableCell className="text-xs">{formatCurrency(emi.principalAmount)}</TableCell>
                                  <TableCell className="text-xs">{formatCurrency(emi.interestAmount)}</TableCell>
                                  <TableCell className="text-xs font-medium">{formatCurrency(emi.totalAmount)}</TableCell>
                                  <TableCell className="text-xs text-green-600">{emi.paidAmount > 0 ? formatCurrency(emi.paidAmount) : '-'}</TableCell>
                                  <TableCell>
                                    <Badge className={`text-xs ${
                                      isPaid ? 'bg-green-100 text-green-700' :
                                      emi.paymentStatus === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                      emi.paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {emi.paymentStatus === 'INTEREST_ONLY_PAID' ? 'Interest Paid' : emi.paymentStatus}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        setSelectedEmiForSettings(emi);
                                        setSelectedLoanIdForSettings(loanDetails.loan.id);
                                        setSelectedCompanyIdForSettings(loanDetails.loan.company?.id || null);
                                        setShowEmiSettingsDialog(true);
                                      }}
                                      title="Payment Settings"
                                    >
                                      <Settings className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );})}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Payment History */}
                    {loanDetails.loan.payments?.length > 0 && (
                      <Card className="border shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm">Recent Payments</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-60 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Date</TableHead>
                                  <TableHead className="text-xs">Amount</TableHead>
                                  <TableHead className="text-xs">Mode</TableHead>
                                  <TableHead className="text-xs">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {loanDetails.loan.payments.map((payment: any) => (
                                  <TableRow key={payment.id}>
                                    <TableCell className="text-xs">{formatDate(payment.createdAt)}</TableCell>
                                    <TableCell className="text-xs font-medium">{formatCurrency(payment.amount)}</TableCell>
                                    <TableCell className="text-xs">{payment.paymentMode || 'N/A'}</TableCell>
                                    <TableCell>
                                      <Badge className={`text-xs ${
                                        payment.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                        payment.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        {payment.status}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete <strong>{selectedUser?.name}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EMI Settings Dialog */}
      <EMISettingsDialog
        open={showEmiSettingsDialog}
        onOpenChange={setShowEmiSettingsDialog}
        emi={selectedEmiForSettings}
        loanId={selectedLoanIdForSettings}
        companyId={selectedCompanyIdForSettings}
        onSettingsSaved={() => {
          // Refresh loan details if we have a loan selected
          if (selectedLoanIdForSettings) {
            fetchLoanDetails(selectedLoanIdForSettings);
          }
        }}
      />

      {/* Product Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProduct ? 'Edit Loan Product' : 'Create Loan Product'}</DialogTitle>
            <DialogDescription>
              {selectedProduct ? 'Update product details' : 'Configure a new loan product for your customers'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input placeholder="e.g., Personal Loan" value={productForm.title} onChange={(e) => setProductForm({...productForm, title: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Icon (Emoji)</Label>
                  <Input placeholder="💰" value={productForm.icon} onChange={(e) => setProductForm({...productForm, icon: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Input placeholder="Short description of the loan product" value={productForm.description} onChange={(e) => setProductForm({...productForm, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loan Type</Label>
                  <Select value={productForm.loanType} onValueChange={(v) => setProductForm({...productForm, loanType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSONAL">Personal Loan</SelectItem>
                      <SelectItem value="BUSINESS">Business Loan</SelectItem>
                      <SelectItem value="HOME">Home Loan</SelectItem>
                      <SelectItem value="EDUCATION">Education Loan</SelectItem>
                      <SelectItem value="VEHICLE">Vehicle Loan</SelectItem>
                      <SelectItem value="GOLD">Gold Loan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={productForm.isActive ? 'active' : 'inactive'} onValueChange={(v) => setProductForm({...productForm, isActive: v === 'active'})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Interest & Tenure */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Interest Rate & Tenure</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Min Interest (%)</Label>
                  <Input type="number" step="0.1" value={productForm.minInterestRate} onChange={(e) => setProductForm({...productForm, minInterestRate: parseFloat(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Max Interest (%)</Label>
                  <Input type="number" step="0.1" value={productForm.maxInterestRate} onChange={(e) => setProductForm({...productForm, maxInterestRate: parseFloat(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Default (%)</Label>
                  <Input type="number" step="0.1" value={productForm.defaultInterestRate} onChange={(e) => setProductForm({...productForm, defaultInterestRate: parseFloat(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Min Tenure (months)</Label>
                  <Input type="number" value={productForm.minTenure} onChange={(e) => setProductForm({...productForm, minTenure: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Max Tenure (months)</Label>
                  <Input type="number" value={productForm.maxTenure} onChange={(e) => setProductForm({...productForm, maxTenure: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Default (months)</Label>
                  <Input type="number" value={productForm.defaultTenure} onChange={(e) => setProductForm({...productForm, defaultTenure: parseInt(e.target.value)})} />
                </div>
              </div>
            </div>

            {/* Loan Amount */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Loan Amount</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Amount (₹)</Label>
                  <Input type="number" value={productForm.minAmount} onChange={(e) => setProductForm({...productForm, minAmount: parseFloat(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Max Amount (₹)</Label>
                  <Input type="number" value={productForm.maxAmount} onChange={(e) => setProductForm({...productForm, maxAmount: parseFloat(e.target.value)})} />
                </div>
              </div>
            </div>

            {/* Fees & Charges */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Fees & Charges</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Processing Fee (%)</Label>
                  <Input type="number" step="0.1" value={productForm.processingFeePercent} onChange={(e) => setProductForm({...productForm, processingFeePercent: parseFloat(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Min Fee (₹)</Label>
                  <Input type="number" value={productForm.processingFeeMin} onChange={(e) => setProductForm({...productForm, processingFeeMin: parseFloat(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Max Fee (₹)</Label>
                  <Input type="number" value={productForm.processingFeeMax} onChange={(e) => setProductForm({...productForm, processingFeeMax: parseFloat(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Late Payment Penalty (%)</Label>
                  <Input type="number" step="0.1" value={productForm.latePaymentPenaltyPercent} onChange={(e) => setProductForm({...productForm, latePaymentPenaltyPercent: parseFloat(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Grace Period (days)</Label>
                  <Input type="number" value={productForm.gracePeriodDays} onChange={(e) => setProductForm({...productForm, gracePeriodDays: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Bounce Charges (₹)</Label>
                  <Input type="number" value={productForm.bounceCharges} onChange={(e) => setProductForm({...productForm, bounceCharges: parseFloat(e.target.value)})} />
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Additional Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <Label>Allow Moratorium</Label>
                    <p className="text-xs text-gray-500">Allow repayment holiday period</p>
                  </div>
                  <input type="checkbox" checked={productForm.allowMoratorium} onChange={(e) => setProductForm({...productForm, allowMoratorium: e.target.checked})} className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <Label>Max Moratorium (months)</Label>
                  <Input type="number" value={productForm.maxMoratoriumMonths} onChange={(e) => setProductForm({...productForm, maxMoratoriumMonths: parseInt(e.target.value)})} disabled={!productForm.allowMoratorium} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <Label>Allow Prepayment</Label>
                    <p className="text-xs text-gray-500">Allow early loan closure</p>
                  </div>
                  <input type="checkbox" checked={productForm.allowPrepayment} onChange={(e) => setProductForm({...productForm, allowPrepayment: e.target.checked})} className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <Label>Prepayment Charges (%)</Label>
                  <Input type="number" step="0.1" value={productForm.prepaymentCharges} onChange={(e) => setProductForm({...productForm, prepaymentCharges: parseFloat(e.target.value)})} disabled={!productForm.allowPrepayment} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleSaveProduct}>
              {selectedProduct ? 'Update Product' : 'Create Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interest-Only Loan Dialog */}
      <Dialog open={showInterestOnlyDialog} onOpenChange={setShowInterestOnlyDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-purple-600" />
              Create Interest-Only Loan
            </DialogTitle>
            <DialogDescription>
              Create a loan where customer pays only monthly interest until EMI is activated
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Select Customer *</Label>
              <Select value={interestOnlyForm.customerId} onValueChange={(v) => setInterestOnlyForm({...interestOnlyForm, customerId: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.filter((c: any) => c.role === 'CUSTOMER').map((customer: any) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Loan Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Principal Amount (₹) *</Label>
                <Input 
                  type="number" 
                  value={interestOnlyForm.principalAmount} 
                  onChange={(e) => setInterestOnlyForm({...interestOnlyForm, principalAmount: parseFloat(e.target.value) || 0})}
                  placeholder="10000"
                />
              </div>
              <div className="space-y-2">
                <Label>Interest Rate (% p.a.) *</Label>
                <Input 
                  type="number" 
                  step="0.1"
                  value={interestOnlyForm.interestRate} 
                  onChange={(e) => setInterestOnlyForm({...interestOnlyForm, interestRate: parseFloat(e.target.value) || 0})}
                  placeholder="12"
                />
              </div>
            </div>

            {/* Monthly Interest Display */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex justify-between items-center">
                <span className="text-purple-700 font-medium">Monthly Interest Payment:</span>
                <span className="text-2xl font-bold text-purple-600">
                  ₹{formatCurrency((interestOnlyForm.principalAmount * interestOnlyForm.interestRate / 100) / 12)}
                </span>
              </div>
              <p className="text-xs text-purple-600 mt-2">
                Customer will pay this amount monthly until EMI is activated
              </p>
            </div>

            {/* Purpose */}
            <div className="space-y-2">
              <Label>Purpose of Loan</Label>
              <Input 
                value={interestOnlyForm.purpose} 
                onChange={(e) => setInterestOnlyForm({...interestOnlyForm, purpose: e.target.value})}
                placeholder="e.g., Business expansion, Personal needs"
              />
            </div>

            {/* Disbursement Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Disbursement Mode *</Label>
                <Select 
                  value={interestOnlyForm.disbursementMode} 
                  onValueChange={(v) => setInterestOnlyForm({...interestOnlyForm, disbursementMode: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Disbursement Date *</Label>
                <Input 
                  type="date" 
                  value={interestOnlyForm.disbursementDate} 
                  onChange={(e) => setInterestOnlyForm({...interestOnlyForm, disbursementDate: e.target.value})}
                />
              </div>
            </div>

            {/* Documents Upload */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Documents</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'panCard', label: 'PAN Card' },
                  { id: 'aadhaarFront', label: 'Aadhaar Front' },
                  { id: 'aadhaarBack', label: 'Aadhaar Back' },
                  { id: 'incomeProof', label: 'Income Proof' },
                  { id: 'addressProof', label: 'Address Proof' },
                  { id: 'photo', label: 'Photo' },
                ].map((doc) => (
                  <div key={doc.id} className="space-y-1">
                    <Label className="text-xs">{doc.label}</Label>
                    <Input 
                      type="file"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('documentType', doc.id);
                          try {
                            const res = await fetch('/api/upload/document', {
                              method: 'POST',
                              body: formData
                            });
                            const data = await res.json();
                            if (data.url) {
                              setInterestOnlyForm({
                                ...interestOnlyForm,
                                documents: { ...interestOnlyForm.documents, [doc.id]: data.url }
                              });
                              toast({ title: 'Uploaded', description: `${doc.label} uploaded successfully` });
                            }
                          } catch (error) {
                            toast({ title: 'Error', description: `Failed to upload ${doc.label}`, variant: 'destructive' });
                          }
                        }
                      }}
                      className="text-xs"
                    />
                    {interestOnlyForm.documents[doc.id] && (
                      <p className="text-xs text-green-600">✓ Uploaded</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">How Interest-Only Loans Work:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>Phase 1:</strong> Customer pays only monthly interest</li>
                    <li><strong>Phase 2:</strong> Super Admin activates EMI when ready</li>
                    <li>Principal remains unchanged until EMI starts</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterestOnlyDialog(false)}>Cancel</Button>
            <Button 
              className="bg-purple-500 hover:bg-purple-600"
              onClick={async () => {
                if (!interestOnlyForm.customerId) {
                  toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' });
                  return;
                }
                if (interestOnlyForm.principalAmount <= 0) {
                  toast({ title: 'Error', description: 'Please enter a valid principal amount', variant: 'destructive' });
                  return;
                }
                
                try {
                  const response = await fetch('/api/offline-loan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      createdById: user?.id,
                      createdByRole: user?.role,
                      customerId: interestOnlyForm.customerId,
                      loanAmount: interestOnlyForm.principalAmount,
                      interestRate: interestOnlyForm.interestRate,
                      tenure: 0, // No tenure initially
                      purpose: interestOnlyForm.purpose,
                      disbursementMode: interestOnlyForm.disbursementMode,
                      disbursementDate: interestOnlyForm.disbursementDate,
                      isInterestOnly: true,
                      documents: interestOnlyForm.documents,
                      status: 'INTEREST_PHASE'
                    })
                  });
                  
                  const data = await response.json();
                  if (data.success) {
                    toast({ title: 'Success', description: 'Interest-Only Loan created successfully!' });
                    setShowInterestOnlyDialog(false);
                    setInterestOnlyForm({
                      customerId: '',
                      principalAmount: 10000,
                      interestRate: 12,
                      purpose: '',
                      disbursementMode: 'BANK_TRANSFER',
                      disbursementDate: new Date().toISOString().split('T')[0],
                      documents: {}
                    });
                    // Refresh interest only loans list
                    fetchInterestOnlyLoans();
                  } else {
                    toast({ title: 'Error', description: data.error || 'Failed to create loan', variant: 'destructive' });
                  }
                } catch (error) {
                  toast({ title: 'Error', description: 'Failed to create interest-only loan', variant: 'destructive' });
                }
              }}
            >
              Create Interest-Only Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start EMI Dialog */}
      <Dialog open={showStartEMIDialog} onOpenChange={setShowStartEMIDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Start EMI for Loan
            </DialogTitle>
            <DialogDescription>
              Convert interest-only loan to regular EMI schedule
            </DialogDescription>
          </DialogHeader>
          
          {selectedInterestOnlyLoan && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex justify-between">
                  <span className="text-purple-700">Principal Amount:</span>
                  <span className="font-semibold">₹{formatCurrency(selectedInterestOnlyLoan.principalAmount || selectedInterestOnlyLoan.requestedAmount)}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-purple-700">Interest Already Paid:</span>
                  <span className="font-semibold text-green-600">₹{formatCurrency(selectedInterestOnlyLoan.totalInterestPaid || 0)}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>EMI Tenure (months) *</Label>
                <Input type="number" placeholder="12" defaultValue={12} id="emi-tenure" />
              </div>
              
              <div className="space-y-2">
                <Label>New Interest Rate (% p.a.)</Label>
                <Input type="number" step="0.1" placeholder="12" defaultValue={selectedInterestOnlyLoan.interestRate || 12} id="emi-rate" />
              </div>
              
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-sm text-emerald-800">
                  EMI will be calculated based on the principal amount and new tenure. The interest paid during the interest-only phase will be recorded separately.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartEMIDialog(false)}>Cancel</Button>
            <Button 
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={async () => {
                if (!selectedInterestOnlyLoan) return;
                
                const tenure = parseInt((document.getElementById('emi-tenure') as HTMLInputElement)?.value || '12');
                const rate = parseFloat((document.getElementById('emi-rate') as HTMLInputElement)?.value || selectedInterestOnlyLoan.interestRate || 12);
                
                try {
                  const response = await fetch('/api/offline-loan', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      loanId: selectedInterestOnlyLoan.id,
                      action: 'start-emi',
                      tenure,
                      interestRate: rate
                    })
                  });
                  
                  const data = await response.json();
                  if (data.success) {
                    toast({ title: 'Success', description: 'EMI schedule activated successfully!' });
                    setShowStartEMIDialog(false);
                    fetchInterestOnlyLoans();
                  } else {
                    toast({ title: 'Error', description: data.error || 'Failed to start EMI', variant: 'destructive' });
                  }
                } catch (error) {
                  toast({ title: 'Error', description: 'Failed to start EMI schedule', variant: 'destructive' });
                }
              }}
            >
              Start EMI Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approval Dialog */}
      <Dialog open={showBulkApprovalDialog} onOpenChange={setShowBulkApprovalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkApprovalAction === 'approve' ? (
                <><CheckCircle className="h-5 w-5 text-emerald-600" />Bulk Approve Applications</>
              ) : (
                <><XCircle className="h-5 w-5 text-red-600" />Bulk Reject Applications</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedLoanIds.length} applications selected for {bulkApprovalAction}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary of selected loans */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">Total Applications</span>
                <span className="font-semibold">{selectedLoanIds.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Amount</span>
                <span className="font-semibold">
                  {formatCurrency(selectedLoanIds.reduce((sum, id) => {
                    const loan = pendingForSA.find(l => l.id === id);
                    return sum + (loan?.requestedAmount || 0);
                  }, 0))}
                </span>
              </div>
            </div>

            {bulkApprovalAction === 'approve' && (
              <>
                <div>
                  <Label className="text-sm font-medium">Assign to Company *</Label>
                  <Select value={bulkCompanyId} onValueChange={handleBulkCompanyChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {bulkCompanyId && (
                  <div>
                    <Label className="text-sm font-medium">Assign to Agent *</Label>
                    {agentsList.length === 0 ? (
                      <div className="p-3 bg-amber-50 rounded-lg text-amber-700 text-sm">
                        No agents found for this company. Please add agents first.
                      </div>
                    ) : (
                      <Select value={bulkAgentId} onValueChange={setBulkAgentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {agentsList.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.email})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkApprovalDialog(false)}>Cancel</Button>
            <Button 
              className={bulkApprovalAction === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} 
              onClick={handleBulkApproval}
              disabled={bulkSaving || (bulkApprovalAction === 'approve' && (!bulkCompanyId || !bulkAgentId))}
            >
              {bulkSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>{bulkApprovalAction === 'approve' ? 'Approve All' : 'Reject All'} ({selectedLoanIds.length})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Loan Dialog */}
      <Dialog open={showDeleteLoanDialog} onOpenChange={setShowDeleteLoanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Loan
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The loan will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          {loanToDelete && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${loanToDelete.loanType === 'ONLINE' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                <div className="flex items-center gap-3">
                  <Badge className={loanToDelete.loanType === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                    {loanToDelete.loanType}
                  </Badge>
                  <div>
                    <p className="font-semibold">{loanToDelete.identifier}</p>
                    <p className="text-sm text-gray-500">{loanToDelete.customer?.name}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="font-medium">{formatCurrency(loanToDelete.approvedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">EMI</p>
                    <p className="font-medium">{formatCurrency(loanToDelete.emiAmount)}/mo</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Reason for Deletion *</Label>
                <Textarea
                  placeholder="Please provide a reason for deleting this loan..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> This will permanently delete the loan record, all EMI schedules, 
                  payment history, and related documents. The deletion will be recorded in the audit log.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteLoanDialog(false); setLoanToDelete(null); setDeleteReason(''); }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteLoan} 
              disabled={deleting || !deleteReason.trim()}
            >
              {deleting ? 'Deleting...' : 'Delete Loan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Role Selection Dialog - First step when adding user */}
      <Dialog open={showRoleSelectDialog} onOpenChange={setShowRoleSelectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              Select User Role
            </DialogTitle>
            <DialogDescription>
              Choose the type of user you want to create
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-3 py-4">
            {[
              { role: 'COMPANY', icon: Building2, label: 'Company', desc: 'Create a lending company', color: 'blue' },
              { role: 'AGENT', icon: User, label: 'Agent', desc: 'Common for all companies', color: 'cyan' },
              { role: 'STAFF', icon: ClipboardCheck, label: 'Staff', desc: 'Works under an agent', color: 'orange' },
              { role: 'CASHIER', icon: Banknote, label: 'Cashier', desc: 'Common for all companies', color: 'green' },
              { role: 'ACCOUNTANT', icon: Calculator, label: 'Accountant', desc: 'Manages all accounting', color: 'teal' },
            ].map((item) => (
              <button
                key={item.role}
                onClick={() => {
                  setSelectedRoleForCreate(item.role);
                  setShowRoleSelectDialog(false);
                  setUserForm({...userForm, role: item.role});
                  setShowUserDialog(true);
                }}
                className={`p-4 border rounded-lg hover:border-${item.color}-300 hover:bg-${item.color}-50 transition-all text-left group`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-${item.color}-100 rounded-lg group-hover:bg-${item.color}-200 transition-colors`}>
                    <item.icon className={`h-5 w-5 text-${item.color}-600`} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleSelectDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Detail Sheet - Right side panel for A-Z details */}
      <Sheet open={showDetailSheet} onOpenChange={setShowDetailSheet}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {detailSheetType === 'company' && <Building2 className="h-5 w-5 text-blue-600" />}
              {detailSheetType === 'user' && <Users className="h-5 w-5 text-emerald-600" />}
              {detailSheetType === 'loan' && <FileText className="h-5 w-5 text-violet-600" />}
              {detailSheetType === 'company' ? 'Company Details' : detailSheetType === 'user' ? 'User Details' : 'Loan Details'}
            </SheetTitle>
            <SheetDescription>
              Complete A-Z information and activity
            </SheetDescription>
          </SheetHeader>
          
          {loadingDetailSheet ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : detailSheetData ? (
            <div className="mt-6 space-y-6">
              {/* Header Card */}
              <Card className="border-0 shadow-sm bg-gradient-to-r from-gray-50 to-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className={
                        detailSheetType === 'company' ? 'bg-blue-100 text-blue-700 text-xl' :
                        detailSheetType === 'user' ? 'bg-emerald-100 text-emerald-700 text-xl' :
                        'bg-violet-100 text-violet-700 text-xl'
                      }>
                        {detailSheetData.name?.charAt(0) || detailSheetData.title?.charAt(0) || 'N'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{detailSheetData.name || detailSheetData.title}</h3>
                      <p className="text-gray-500">{detailSheetData.email || detailSheetData.code}</p>
                      <div className="flex gap-2 mt-2">
                        {detailSheetData.code && <Badge variant="outline">{detailSheetData.code}</Badge>}
                        <Badge className={detailSheetData.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {detailSheetData.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Basic Information */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4 text-gray-400" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {detailSheetData.contactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="text-sm font-medium">{detailSheetData.contactEmail}</p>
                        </div>
                      </div>
                    )}
                    {detailSheetData.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="text-sm font-medium">{detailSheetData.contactPhone}</p>
                        </div>
                      </div>
                    )}
                    {detailSheetData.address && (
                      <div className="flex items-center gap-2 col-span-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Address</p>
                          <p className="text-sm font-medium">{detailSheetData.address}</p>
                          {(detailSheetData.city || detailSheetData.state) && (
                            <p className="text-xs text-gray-500">{detailSheetData.city}, {detailSheetData.state} {detailSheetData.pincode}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {detailSheetData.createdAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Created</p>
                          <p className="text-sm font-medium">{formatDate(detailSheetData.createdAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Financial Details */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    Financial Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {detailSheetData.companyCredit !== undefined && (
                      <div className="p-3 bg-emerald-50 rounded-lg">
                        <p className="text-xs text-emerald-600">Company Credit</p>
                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(detailSheetData.companyCredit || 0)}</p>
                      </div>
                    )}
                    {detailSheetData.maxLoanAmount && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600">Max Loan</p>
                        <p className="text-lg font-bold text-blue-700">{formatCurrency(detailSheetData.maxLoanAmount)}</p>
                      </div>
                    )}
                    {detailSheetData.minLoanAmount && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600">Min Loan</p>
                        <p className="text-lg font-bold text-gray-700">{formatCurrency(detailSheetData.minLoanAmount)}</p>
                      </div>
                    )}
                    {detailSheetData.defaultInterestRate && (
                      <div className="p-3 bg-violet-50 rounded-lg">
                        <p className="text-xs text-violet-600">Interest Rate</p>
                        <p className="text-lg font-bold text-violet-700">{detailSheetData.defaultInterestRate}%</p>
                      </div>
                    )}
                    {detailSheetData.maxTenureMonths && (
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <p className="text-xs text-orange-600">Max Tenure</p>
                        <p className="text-lg font-bold text-orange-700">{detailSheetData.maxTenureMonths} months</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Users Under This Company */}
              {detailSheetType === 'company' && detailSheetData._count && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      Users & Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-cyan-50 rounded-lg">
                        <p className="text-2xl font-bold text-cyan-700">{detailSheetData._count.users || 0}</p>
                        <p className="text-xs text-cyan-600">Total Users</p>
                      </div>
                      <div className="text-center p-3 bg-violet-50 rounded-lg">
                        <p className="text-2xl font-bold text-violet-700">{detailSheetData._count.loanApplications || 0}</p>
                        <p className="text-xs text-violet-600">Loan Applications</p>
                      </div>
                      <div className="text-center p-3 bg-emerald-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-700">{detailSheetData._count.agents || 0}</p>
                        <p className="text-xs text-emerald-600">Agents</p>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <p className="text-2xl font-bold text-orange-700">{detailSheetData._count.staff || 0}</p>
                        <p className="text-xs text-orange-600">Staff</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Recent Activity */}
              {detailSheetData.recentActivity && detailSheetData.recentActivity.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-gray-400" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {detailSheetData.recentActivity.map((activity: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                            <Badge variant="outline" className="text-xs">{activity.module || activity.action}</Badge>
                            <span className="flex-1 truncate">{activity.description || activity.action}</span>
                            <span className="text-xs text-gray-400">{formatDate(activity.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
              
              {/* Quick Actions */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4 mr-1" />View Full
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4 mr-1" />Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Users className="h-12 w-12 mb-3 text-gray-300" />
              <p>No data available</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
      
      {/* User Details Dialog */}
      <Dialog open={showUserDetailsDialog} onOpenChange={setShowUserDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              User Details - {selectedUserDetails?.name}
            </DialogTitle>
            <DialogDescription>
              Complete overview of user activity and information
            </DialogDescription>
          </DialogHeader>
          
          {loadingUserDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : selectedUserDetails ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Basic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm font-medium">{selectedUserDetails.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="text-sm font-medium">{selectedUserDetails.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Role</p>
                      <Badge className={
                        selectedUserDetails.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                        selectedUserDetails.role === 'COMPANY' ? 'bg-blue-100 text-blue-700' :
                        selectedUserDetails.role === 'AGENT' ? 'bg-cyan-100 text-cyan-700' :
                        selectedUserDetails.role === 'STAFF' ? 'bg-orange-100 text-orange-700' :
                        selectedUserDetails.role === 'CASHIER' ? 'bg-green-100 text-green-700' :
                        selectedUserDetails.role === 'ACCOUNTANT' ? 'bg-teal-100 text-teal-700' :
                        'bg-gray-100 text-gray-700'
                      }>
                        {selectedUserDetails.role}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <Badge className={selectedUserDetails.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {selectedUserDetails.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Company Credit</p>
                      <p className="text-sm font-medium text-emerald-600">₹{(selectedUserDetails.companyCredit || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Personal Credit</p>
                      <p className="text-sm font-medium text-amber-600">₹{(selectedUserDetails.personalCredit || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="text-sm font-medium">{formatDate(selectedUserDetails.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Last Login</p>
                      <p className="text-sm font-medium">{selectedUserDetails.lastLoginAt ? formatDate(selectedUserDetails.lastLoginAt) : 'Never'}</p>
                    </div>
                  </div>
                  
                  {/* Codes */}
                  {(selectedUserDetails.agentCode || selectedUserDetails.staffCode || selectedUserDetails.cashierCode || selectedUserDetails.accountantCode) && (
                    <div className="mt-4 flex gap-2 flex-wrap">
                      {selectedUserDetails.agentCode && <Badge variant="outline">Agent: {selectedUserDetails.agentCode}</Badge>}
                      {selectedUserDetails.staffCode && <Badge variant="outline">Staff: {selectedUserDetails.staffCode}</Badge>}
                      {selectedUserDetails.cashierCode && <Badge variant="outline">Cashier: {selectedUserDetails.cashierCode}</Badge>}
                      {selectedUserDetails.accountantCode && <Badge variant="outline">Accountant: {selectedUserDetails.accountantCode}</Badge>}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Role-Specific Stats */}
              {selectedUserDetails.roleSpecificData && Object.keys(selectedUserDetails.roleSpecificData).length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Role-Specific Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(selectedUserDetails.roleSpecificData).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <p className="text-lg font-bold text-gray-900">
                            {typeof value === 'number' ? value.toLocaleString() : 
                             Array.isArray(value) ? value.length : 
                             String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Activity Counts */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Activity Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{selectedUserDetails._count?.loanApplications || 0}</p>
                      <p className="text-xs text-gray-500">Loan Applications</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{selectedUserDetails._count?.disbursedLoans || 0}</p>
                      <p className="text-xs text-gray-500">Disbursed Loans</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{selectedUserDetails._count?.payments || 0}</p>
                      <p className="text-xs text-gray-500">Payments</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{selectedUserDetails._count?.auditLogs || 0}</p>
                      <p className="text-xs text-gray-500">Audit Logs</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{selectedUserDetails._count?.notifications || 0}</p>
                      <p className="text-xs text-gray-500">Notifications</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Recent Activity */}
              {selectedUserDetails.recentActivity?.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedUserDetails.recentActivity.map((activity: any) => (
                        <div key={activity.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                          <Badge variant="outline" className="text-xs">{activity.module}</Badge>
                          <span className="flex-1">{activity.description}</span>
                          <span className="text-xs text-gray-400">{formatDate(activity.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>User not found</p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Loan Detail Panel */}
      <LoanDetailPanel
        loanId={selectedLoanId}
        open={showLoanDetailPanel}
        onClose={() => { setShowLoanDetailPanel(false); setSelectedLoanId(null); }}
        userRole={user?.role || 'SUPER_ADMIN'}
        userId={user?.id || ''}
        onPaymentSuccess={() => { fetchLoans(); fetchAllActiveLoans(); }}
      />
    </DashboardLayout>
  );
}
