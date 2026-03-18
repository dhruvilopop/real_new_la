'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout, { ROLE_MENU_ITEMS } from '@/components/layout/DashboardLayout';
import FixedAssetsPage from './FixedAssetsPage';
import CompanySelector from './CompanySelector';
import ExcelExportSection from './ExcelExportSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton, CardSkeleton, TableSkeleton, EmptyState, PageLoader } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Calculator, FileText, TrendingUp, TrendingDown, Wallet, Building2, 
  Receipt, PieChart, Calendar, Users, CreditCard, AlertTriangle,
  Plus, Eye, Download, ChevronRight, BookOpen, RefreshCw, Trash2,
  Landmark, FileSpreadsheet, ClipboardList, DollarSign, Sparkles, Loader2,
  Activity, Zap, Shield, LogOut
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// TYPES
// ============================================

interface ChartOfAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  currentBalance: number;
  description?: string;
  isActive: boolean;
  isSystemAccount: boolean;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: Date;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  referenceType: string;
  isAutoEntry: boolean;
  isApproved: boolean;
  lines: Array<{
    id: string;
    accountId: string;
    account: ChartOfAccount;
    debitAmount: number;
    creditAmount: number;
    narration?: string;
    loanId?: string;
    customerId?: string;
  }>;
}

interface FinancialYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  currentBalance: number;
  isDefault: boolean;
  transactions?: BankTransaction[];
  totalCredits?: number;
  totalDebits?: number;
}

interface BankTransaction {
  id: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceType: string;
  transactionDate: Date;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
  };
}

interface Expense {
  id: string;
  expenseNumber: string;
  expenseType: string;
  description: string;
  amount: number;
  paymentDate: Date;
  paymentMode: string;
  isApproved: boolean;
}

interface ActiveLoan {
  id: string;
  identifier: string;
  loanType: 'ONLINE' | 'OFFLINE';
  status: string;
  requestedAmount: number;
  approvedAmount: number;
  interestRate: number;
  tenure: number;
  emiAmount: number;
  disbursementDate?: Date;
  createdAt: Date;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  company?: {
    id: string;
    name: string;
    code: string;
  };
  nextEmi?: {
    dueDate: Date;
    amount: number;
    status: string;
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AccountantDashboard() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // Company Selection State
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  
  // Real-time Updates State
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false); // Disabled by default to prevent DB connection limit
  const realTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Activity Tracking State
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  
  // Data states
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [loanStats, setLoanStats] = useState({ totalOnline: 0, totalOffline: 0, totalOnlineAmount: 0, totalOfflineAmount: 0 });
  const [loanFilter, setLoanFilter] = useState<'all' | 'online' | 'offline'>('all');
  
  // Money Logs State
  const [moneyLogs, setMoneyLogs] = useState<any[]>([]);
  const [moneyLogStats, setMoneyLogStats] = useState({
    totalEMICollection: 0,
    totalDisbursements: 0,
    totalCredits: 0,
    totalDebits: 0,
    totalExpenses: 0,
    emiCount: 0,
    disbursementCount: 0,
    expenseCount: 0
  });
  const [moneyLogFilter, setMoneyLogFilter] = useState<'all' | 'emi' | 'disbursement' | 'credit' | 'expense'>('all');
  
  // Report states
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [profitAndLoss, setProfitAndLoss] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [portfolioReport, setPortfolioReport] = useState<any>(null);
  
  // Filter states
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
  });
  const [selectedAccountType, setSelectedAccountType] = useState<string>('all');
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string>('');
  const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
  
  // Dialog states
  const [showJournalDialog, setShowJournalDialog] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showEntryDetailDialog, setShowEntryDetailDialog] = useState(false);
  const [showAccountDetailDialog, setShowAccountDetailDialog] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [showLedgerDetailDialog, setShowLedgerDetailDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showBankDetailDialog, setShowBankDetailDialog] = useState(false);
  const [showExpenseDetailDialog, setShowExpenseDetailDialog] = useState(false);
  
  // Selected items for dialogs
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{type: string; id: string; name: string} | null>(null);
  
  // Form states
  const [newJournalLines, setNewJournalLines] = useState([{ accountId: '', debit: 0, credit: 0 }]);
  const [newJournalDate, setNewJournalDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newJournalNarration, setNewJournalNarration] = useState('');
  const [newJournalRefType, setNewJournalRefType] = useState('MANUAL_ENTRY');
  
  const [newAccountData, setNewAccountData] = useState({
    code: '', name: '', type: 'ASSET', description: '', openingBalance: 0
  });
  
  const [newExpenseData, setNewExpenseData] = useState({
    type: 'MISCELLANEOUS', description: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd'), paymentMode: 'BANK_TRANSFER', reference: ''
  });
  
  const [newBankData, setNewBankData] = useState({
    bankName: '', accountNumber: '', accountName: '', ifscCode: '', accountType: 'SAVINGS', openingBalance: 0
  });

  // Menu items for accountant
  const menuItems = ROLE_MENU_ITEMS.ACCOUNTANT.map(item => ({
    ...item,
    count: item.id === 'journal' ? journalEntries.length : item.id === 'loans' ? activeLoans.length : undefined
  }));

  // Fetch data on mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Real-time updates effect
  useEffect(() => {
    if (isRealTimeEnabled) {
      realTimeIntervalRef.current = setInterval(() => {
        setLastUpdate(Date.now());
        // Dispatch event for components to refresh
        window.dispatchEvent(new CustomEvent('accountantDataRefresh'));
      }, 30000); // Every 30 seconds
    }
    
    return () => {
      if (realTimeIntervalRef.current) {
        clearInterval(realTimeIntervalRef.current);
      }
    };
  }, [isRealTimeEnabled]);
  
  // Activity tracking effect
  useEffect(() => {
    const trackActivity = () => setLastActivity(Date.now());
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity);
      });
    };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Use selected company IDs if available, otherwise use user's company
      const companyFilter = selectedCompanyIds.length > 0 
        ? selectedCompanyIds.join(',') 
        : (user?.companyId || 'default');

      // Fetch money management data (comprehensive)
      const moneyMgmtRes = await fetch(`/api/accounting/money-management?companyId=${companyFilter}`);
      if (moneyMgmtRes.ok) {
        const moneyData = await moneyMgmtRes.json();
        
        // Set all data from money management API
        setBankAccounts(moneyData.bankAccounts || []);
        setBankTransactions(moneyData.bankTransactions || []);
        setJournalEntries(moneyData.journalEntries || []);
        setActiveLoans(moneyData.allLoans || []);
        setTrialBalance(moneyData.trialBalance || null);
        setProfitAndLoss(moneyData.profitAndLoss || null);
        setBalanceSheet(moneyData.balanceSheet || null);
        
        // Set loan stats
        if (moneyData.loanStats) {
          setLoanStats({
            totalOnline: moneyData.loanStats.totalOnlineLoans || 0,
            totalOffline: moneyData.loanStats.totalOfflineLoans || 0,
            totalOnlineAmount: moneyData.loanStats.onlineLoanAmount || 0,
            totalOfflineAmount: moneyData.loanStats.offlineLoanAmount || 0
          });
        }
      }

      // Fetch additional data in parallel
      const [accountsRes, fyRes, expenseRes] = await Promise.all([
        fetch(`/api/accounting/chart-of-accounts?companyId=${companyFilter}`),
        fetch(`/api/accounting/financial-year?companyId=${companyFilter}`),
        fetch(`/api/accounting/expenses?companyId=${companyFilter}`),
      ]);

      if (accountsRes.ok) setAccounts((await accountsRes.json()).accounts || []);
      if (fyRes.ok) setFinancialYears((await fyRes.json()).financialYears || []);
      if (expenseRes.ok) setExpenses((await expenseRes.json()).expenses || []);

      // Fetch money logs for ecosystem-wide transactions
      fetchMoneyLogs();

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    const companyId = user?.companyId || 'default';
    try {
      const [tbRes, plRes, bsRes, prRes] = await Promise.all([
        fetch(`/api/accounting/reports?type=trial-balance&companyId=${companyId}`),
        fetch(`/api/accounting/reports?type=profit-loss&companyId=${companyId}&startDate=${dateRange.startDate.toISOString()}&endDate=${dateRange.endDate.toISOString()}`),
        fetch(`/api/accounting/reports?type=balance-sheet&companyId=${companyId}`),
        fetch(`/api/accounting/reports?type=portfolio&companyId=${companyId}`),
      ]);
      if (tbRes.ok) setTrialBalance(await tbRes.json());
      if (plRes.ok) setProfitAndLoss(await plRes.json());
      if (bsRes.ok) setBalanceSheet(await bsRes.json());
      if (prRes.ok) setPortfolioReport(await prRes.json());
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const fetchLedgerTransactions = async (accountId: string) => {
    const companyId = user?.companyId || 'default';
    try {
      const res = await fetch(`/api/accounting/ledger?accountId=${accountId}&companyId=${companyId}`);
      if (res.ok) setLedgerTransactions((await res.json()).transactions || []);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      setLedgerTransactions([]);
    }
  };

  // ============================================
  // ACTION HANDLERS
  // ============================================

  const handleSaveJournalEntry = async () => {
    const totalDebit = newJournalLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = newJournalLines.reduce((sum, l) => sum + l.credit, 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast.error('Debit and Credit must be equal');
      return;
    }
    if (!newJournalNarration) {
      toast.error('Please enter narration');
      return;
    }
    
    try {
      const res = await fetch('/api/accounting/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: user?.companyId,
          entryDate: newJournalDate,
          referenceType: newJournalRefType,
          narration: newJournalNarration,
          lines: newJournalLines.filter(l => l.accountId && (l.debit > 0 || l.credit > 0)),
          createdById: user?.id
        })
      });
      
      if (res.ok) {
        toast.success('Journal entry created successfully');
        setShowJournalDialog(false);
        resetJournalForm();
        fetchDashboardData();
      } else {
        toast.error((await res.json()).error || 'Failed to create journal entry');
      }
    } catch (error) {
      toast.error('Failed to create journal entry');
    }
  };

  const handleSaveAccount = async () => {
    if (!newAccountData.code || !newAccountData.name) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      const res = await fetch('/api/accounting/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: user?.companyId,
          accountCode: newAccountData.code,
          accountName: newAccountData.name,
          accountType: newAccountData.type,
          description: newAccountData.description,
          openingBalance: newAccountData.openingBalance
        })
      });
      if (res.ok) {
        toast.success('Account created successfully');
        setShowAccountDialog(false);
        resetAccountForm();
        fetchDashboardData();
      } else {
        toast.error((await res.json()).error || 'Failed to create account');
      }
    } catch (error) {
      toast.error('Failed to create account');
    }
  };

  const handleSaveExpense = async () => {
    if (!newExpenseData.description || newExpenseData.amount <= 0) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      const res = await fetch('/api/accounting/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: user?.companyId,
          ...newExpenseData,
          createdById: user?.id
        })
      });
      if (res.ok) {
        toast.success('Expense recorded successfully');
        setShowExpenseDialog(false);
        resetExpenseForm();
        fetchDashboardData();
      } else {
        toast.error((await res.json()).error || 'Failed to record expense');
      }
    } catch (error) {
      toast.error('Failed to record expense');
    }
  };

  const handleSaveBankAccount = async () => {
    if (!newBankData.bankName || !newBankData.accountNumber) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      const res = await fetch('/api/accounting/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: user?.companyId,
          ...newBankData
        })
      });
      if (res.ok) {
        toast.success('Bank account added successfully');
        setShowBankDialog(false);
        resetBankForm();
        fetchDashboardData();
      } else {
        toast.error((await res.json()).error || 'Failed to add bank account');
      }
    } catch (error) {
      toast.error('Failed to add bank account');
    }
  };

  const handleExportReport = (reportType: string) => {
    let csv = '';
    let filename = '';
    
    switch (reportType) {
      case 'trial-balance':
        csv = 'Account Code,Account Name,Type,Debit,Credit\n';
        trialBalance?.forEach((item: any) => {
          csv += `${item.accountCode},${item.accountName},${item.accountType},${item.debitBalance},${item.creditBalance}\n`;
        });
        filename = 'trial_balance.csv';
        break;
      case 'journal-entries':
        csv = 'Entry Number,Date,Type,Narration,Debit,Credit\n';
        journalEntries.forEach((entry) => {
          csv += `${entry.entryNumber},${formatDate(entry.entryDate)},${entry.referenceType},"${entry.narration}",${entry.totalDebit},${entry.totalCredit}\n`;
        });
        filename = 'journal_entries.csv';
        break;
      default:
        toast.info('Export feature coming soon');
        return;
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  const resetJournalForm = () => {
    setNewJournalLines([{ accountId: '', debit: 0, credit: 0 }]);
    setNewJournalDate(format(new Date(), 'yyyy-MM-dd'));
    setNewJournalNarration('');
    setNewJournalRefType('MANUAL_ENTRY');
  };

  const resetAccountForm = () => {
    setNewAccountData({ code: '', name: '', type: 'ASSET', description: '', openingBalance: 0 });
  };

  const resetExpenseForm = () => {
    setNewExpenseData({ type: 'MISCELLANEOUS', description: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd'), paymentMode: 'BANK_TRANSFER', reference: '' });
  };

  const resetBankForm = () => {
    setNewBankData({ bankName: '', accountNumber: '', accountName: '', ifscCode: '', accountType: 'SAVINGS', openingBalance: 0 });
  };

  const confirmDelete = (type: string, id: string, name: string) => {
    setDeleteTarget({ type, id, name });
    setShowDeleteConfirmDialog(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const endpoints: Record<string, string> = {
      bank: '/api/accounting/bank-accounts',
      expense: '/api/accounting/expenses',
      journal: '/api/accounting/journal-entries',
      account: '/api/accounting/chart-of-accounts',
    };
    
    try {
      const res = await fetch(`${endpoints[deleteTarget.type]}?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`${deleteTarget.type} deleted successfully`);
        fetchDashboardData();
      } else {
        toast.error((await res.json()).error || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
    setShowDeleteConfirmDialog(false);
    setDeleteTarget(null);
  };

  // ============================================
  // RENDER HELPERS (must be before usage)
  // ============================================

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (date: Date | string) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy');
  };

  const getAccountTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ASSET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      LIABILITY: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      INCOME: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      EXPENSE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      EQUITY: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getReferenceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      LOAN_DISBURSEMENT: 'Loan Disbursement',
      EMI_PAYMENT: 'EMI Payment',
      PROCESSING_FEE_COLLECTION: 'Processing Fee',
      MANUAL_ENTRY: 'Manual Entry',
      BANK_TRANSFER: 'Bank Transfer',
      OPENING_BALANCE: 'Opening Balance',
      EXPENSE: 'Expense',
      COMMISSION_PAYOUT: 'Commission',
    };
    return labels[type] || type;
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const totalLoanAmount = activeLoans.reduce((sum, loan) => sum + loan.approvedAmount, 0);
  const totalEmiAmount = activeLoans.reduce((sum, loan) => sum + loan.emiAmount, 0);

  const dashboardStats = {
    totalAssets: balanceSheet?.totalAssets || 0,
    totalLiabilities: balanceSheet?.totalLiabilities || 0,
    totalIncome: profitAndLoss?.totalIncome || 0,
    totalExpenses: profitAndLoss?.totalExpenses || 0,
    netProfit: profitAndLoss?.netProfit || 0,
    loanOutstanding: portfolioReport?.totalOutstanding || totalLoanAmount,
    bankBalance: bankAccounts.reduce((sum, ba) => sum + ba.currentBalance, 0),
    activeLoanCount: activeLoans.length,
    totalLoanAmount: totalLoanAmount,
    monthlyEmiCollection: totalEmiAmount,
  };

  const stats = [
    { label: 'Total Assets', value: formatCurrency(dashboardStats.totalAssets), icon: Building2, color: 'text-blue-600' },
    { label: 'Net Profit', value: formatCurrency(dashboardStats.netProfit), icon: TrendingUp, color: 'text-green-600' },
    { label: 'Bank Balance', value: formatCurrency(dashboardStats.bankBalance), icon: Landmark, color: 'text-purple-600' },
    { label: 'Loan Outstanding', value: formatCurrency(dashboardStats.loanOutstanding), icon: CreditCard, color: 'text-orange-600' },
    { label: 'Active Loans', value: dashboardStats.activeLoanCount, icon: Wallet, color: 'text-cyan-600' },
    { label: 'Monthly EMI', value: formatCurrency(dashboardStats.monthlyEmiCollection), icon: Calculator, color: 'text-pink-600' }
  ];

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.accountType]) acc[account.accountType] = [];
    acc[account.accountType].push(account);
    return acc;
  }, {} as Record<string, ChartOfAccount[]>);

  // ============================================
  // RENDER CONTENT
  // ============================================

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverview();
      case 'excel-export':
        return <ExcelExportSection 
          selectedCompanyIds={selectedCompanyIds}
          onCompanyChange={setSelectedCompanyIds}
        />;
      case 'loans':
        return renderActiveLoans();
      case 'money-logs':
        return renderMoneyLogs();
      case 'journal':
        return renderJournalEntries();
      case 'expenses':
        return renderExpenses();
      case 'chart-of-accounts':
        return renderChartOfAccounts();
      case 'fixed-assets':
        return <FixedAssetsPage user={user} />;
      case 'bank':
        return renderBankAccounts();
      case 'trial-balance':
        return renderTrialBalance();
      case 'reports':
        return renderProfitLoss();
      case 'year-end':
        return renderYearEnd();
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Assets</p>
                <p className="text-2xl font-bold">{formatCurrency(dashboardStats.totalAssets)}</p>
              </div>
              <Building2 className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Net Profit</p>
                <p className="text-2xl font-bold">{formatCurrency(dashboardStats.netProfit)}</p>
              </div>
              <TrendingUp className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveSection('loans')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Active Loans</p>
                <p className="text-2xl font-bold">{dashboardStats.activeLoanCount}</p>
              </div>
              <CreditCard className="h-8 w-8 opacity-80" />
            </div>
            <p className="text-xs mt-2 opacity-75">{formatCurrency(dashboardStats.totalLoanAmount)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Bank Balance</p>
                <p className="text-2xl font-bold">{formatCurrency(dashboardStats.bankBalance)}</p>
              </div>
              <Landmark className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveSection('loans')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Loan Outstanding</p>
                <p className="text-2xl font-bold">{formatCurrency(dashboardStats.loanOutstanding)}</p>
              </div>
              <Wallet className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Monthly EMI Collection</p>
                <p className="text-2xl font-bold">{formatCurrency(dashboardStats.monthlyEmiCollection)}</p>
              </div>
              <Calculator className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Net Income</p>
                <p className="text-2xl font-bold">{formatCurrency(dashboardStats.totalIncome - dashboardStats.totalExpenses)}</p>
              </div>
              <PieChart className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setActiveSection('loans')}>
              <CreditCard className="h-5 w-5" />
              <span className="text-xs">View Loans</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => { setActiveSection('journal'); setShowJournalDialog(true); }}>
              <Plus className="h-5 w-5" />
              <span className="text-xs">New Journal Entry</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => { setActiveSection('expenses'); setShowExpenseDialog(true); }}>
              <Receipt className="h-5 w-5" />
              <span className="text-xs">Record Expense</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => { setActiveSection('bank'); setShowBankDialog(true); }}>
              <Landmark className="h-5 w-5" />
              <span className="text-xs">Add Bank Account</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setActiveSection('trial-balance')}>
              <FileSpreadsheet className="h-5 w-5" />
              <span className="text-xs">View Reports</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Active Loans Preview */}
      {activeLoans.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-500" /> Recent Active Loans
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setActiveSection('loans')}>
                View All <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {activeLoans.slice(0, 5).map((loan) => (
                  <div
                    key={loan.id}
                    className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => setActiveSection('loans')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${loan.loanType === 'ONLINE' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                        <CreditCard className={`h-5 w-5 ${loan.loanType === 'ONLINE' ? 'text-blue-600' : 'text-purple-600'}`} />
                      </div>
                      <div>
                        <p className="font-medium">{loan.identifier}</p>
                        <p className="text-sm text-muted-foreground">{loan.customer?.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(loan.approvedAmount)}</p>
                      <Badge className={loan.loanType === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                        {loan.loanType}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" /> Income Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-3">
                {profitAndLoss?.income?.map((item: any) => (
                  <div key={item.accountCode} className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div>
                      <p className="font-medium text-sm">{item.accountName}</p>
                      <p className="text-xs text-muted-foreground">{item.accountCode}</p>
                    </div>
                    <span className="font-bold text-green-600">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between items-center p-2 bg-green-100 dark:bg-green-900/30 rounded font-bold">
                  <span>Total Income</span>
                  <span className="text-green-600">{formatCurrency(dashboardStats.totalIncome)}</span>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" /> Expense Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-3">
                {profitAndLoss?.expenses?.map((item: any) => (
                  <div key={item.accountCode} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <div>
                      <p className="font-medium text-sm">{item.accountName}</p>
                      <p className="text-xs text-muted-foreground">{item.accountCode}</p>
                    </div>
                    <span className="font-bold text-red-600">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between items-center p-2 bg-red-100 dark:bg-red-900/30 rounded font-bold">
                  <span>Total Expenses</span>
                  <span className="text-red-600">{formatCurrency(dashboardStats.totalExpenses)}</span>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setActiveSection('journal')}>
              View All <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {journalEntries.slice(0, 5).map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => { setSelectedEntry(entry); setShowEntryDetailDialog(true); }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{entry.entryNumber}</p>
                      <p className="text-sm text-muted-foreground">{entry.narration}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(entry.totalDebit)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.entryDate)}</p>
                  </div>
                </div>
              ))}
              {journalEntries.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No journal entries yet</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderJournalEntries = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">All financial transactions with double-entry bookkeeping</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExportReport('journal-entries')}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={() => setShowJournalDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Entry
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Entries</p>
            <p className="text-2xl font-bold">{journalEntries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Debit</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(journalEntries.reduce((sum, e) => sum + e.totalDebit, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Credit</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(journalEntries.reduce((sum, e) => sum + e.totalCredit, 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Journal Entries Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Narration</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journalEntries.map((entry) => (
                  <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedEntry(entry); setShowEntryDetailDialog(true); }}>
                    <TableCell className="font-mono font-bold">{entry.entryNumber}</TableCell>
                    <TableCell>{formatDate(entry.entryDate)}</TableCell>
                    <TableCell><Badge variant="outline">{getReferenceTypeLabel(entry.referenceType)}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{entry.narration}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(entry.totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(entry.totalCredit)}</TableCell>
                    <TableCell>
                      {entry.isApproved ? <Badge className="bg-green-500">Approved</Badge> : <Badge variant="destructive">Pending</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); setShowEntryDetailDialog(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderActiveLoans = () => {
    const filteredLoans = activeLoans.filter(loan => {
      if (loanFilter === 'all') return true;
      return loan.loanType === loanFilter.toUpperCase();
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Active Loans</h1>
            <p className="text-muted-foreground">All disbursed and active loans (Online & Offline)</p>
          </div>
          <Button variant="outline" onClick={() => fetchDashboardData()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Loan Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Online Loans</p>
                  <p className="text-2xl font-bold">{loanStats.totalOnline}</p>
                </div>
                <FileText className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-xs mt-2 opacity-75">{formatCurrency(loanStats.totalOnlineAmount)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Offline Loans</p>
                  <p className="text-2xl font-bold">{loanStats.totalOffline}</p>
                </div>
                <Receipt className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-xs mt-2 opacity-75">{formatCurrency(loanStats.totalOfflineAmount)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Active</p>
                  <p className="text-2xl font-bold">{loanStats.totalOnline + loanStats.totalOffline}</p>
                </div>
                <CreditCard className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(loanStats.totalOnlineAmount + loanStats.totalOfflineAmount)}</p>
                </div>
                <Wallet className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Buttons */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Filter:</span>
              <Button
                size="sm"
                variant={loanFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setLoanFilter('all')}
              >
                All ({loanStats.totalOnline + loanStats.totalOffline})
              </Button>
              <Button
                size="sm"
                variant={loanFilter === 'online' ? 'default' : 'outline'}
                className={loanFilter === 'online' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                onClick={() => setLoanFilter('online')}
              >
                <FileText className="h-4 w-4 mr-1" /> Online ({loanStats.totalOnline})
              </Button>
              <Button
                size="sm"
                variant={loanFilter === 'offline' ? 'default' : 'outline'}
                className={loanFilter === 'offline' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                onClick={() => setLoanFilter('offline')}
              >
                <Receipt className="h-4 w-4 mr-1" /> Offline ({loanStats.totalOffline})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loans Table */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {filteredLoans.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active loans found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Rate/Tenure</TableHead>
                      <TableHead className="text-right">EMI</TableHead>
                      <TableHead>Next EMI</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan) => (
                      <TableRow key={loan.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-mono font-bold">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${loan.loanType === 'ONLINE' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                            {loan.identifier}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={loan.loanType === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                            {loan.loanType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{loan.customer?.name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{loan.customer?.phone || loan.customer?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{loan.company?.name || 'N/A'}</p>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {formatCurrency(loan.approvedAmount)}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{loan.interestRate}%</p>
                          <p className="text-xs text-muted-foreground">{loan.tenure} mo</p>
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {formatCurrency(loan.emiAmount)}
                        </TableCell>
                        <TableCell>
                          {loan.nextEmi ? (
                            <div>
                              <p className="text-sm">{formatDate(loan.nextEmi.dueDate)}</p>
                              <Badge variant={loan.nextEmi.status === 'OVERDUE' ? 'destructive' : 'outline'} className="text-xs mt-1">
                                {loan.nextEmi.status}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-700">{loan.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Fetch money logs
  const fetchMoneyLogs = async () => {
    try {
      const res = await fetch('/api/accounting/money-logs?limit=500');
      const data = await res.json();
      if (data.success) {
        setMoneyLogs(data.logs || []);
        setMoneyLogStats(data.stats || moneyLogStats);
      }
    } catch (error) {
      console.error('Error fetching money logs:', error);
    }
  };

  // Render Money Logs - All ecosystem money transactions
  const renderMoneyLogs = () => {
    const filteredLogs = moneyLogs.filter(log => {
      if (moneyLogFilter === 'all') return true;
      if (moneyLogFilter === 'emi') return log.type === 'EMI_PAYMENT';
      if (moneyLogFilter === 'disbursement') return log.type === 'LOAN_DISBURSEMENT' || log.type === 'OFFLINE_LOAN_DISBURSEMENT';
      if (moneyLogFilter === 'credit') return log.type === 'CREDIT' || log.type === 'BANK_TRANSACTION';
      if (moneyLogFilter === 'expense') return log.type === 'EXPENSE';
      return true;
    });

    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'EMI_PAYMENT': return <Wallet className="h-4 w-4 text-green-600" />;
        case 'LOAN_DISBURSEMENT': 
        case 'OFFLINE_LOAN_DISBURSEMENT': return <CreditCard className="h-4 w-4 text-blue-600" />;
        case 'CREDIT': return <TrendingUp className="h-4 w-4 text-emerald-600" />;
        case 'DEBIT': return <TrendingDown className="h-4 w-4 text-red-600" />;
        case 'EXPENSE': return <Receipt className="h-4 w-4 text-orange-600" />;
        case 'BANK_TRANSACTION': return <Landmark className="h-4 w-4 text-purple-600" />;
        default: return <DollarSign className="h-4 w-4" />;
      }
    };

    const getTypeBadge = (type: string, category: string) => {
      const colors: Record<string, string> = {
        'EMI_PAYMENT': 'bg-green-100 text-green-700',
        'LOAN_DISBURSEMENT': 'bg-blue-100 text-blue-700',
        'OFFLINE_LOAN_DISBURSEMENT': 'bg-purple-100 text-purple-700',
        'CREDIT': 'bg-emerald-100 text-emerald-700',
        'DEBIT': 'bg-red-100 text-red-700',
        'EXPENSE': 'bg-orange-100 text-orange-700',
        'BANK_TRANSACTION': category.includes('Credit') ? 'bg-cyan-100 text-cyan-700' : 'bg-pink-100 text-pink-700',
      };
      return <Badge className={colors[type] || 'bg-gray-100 text-gray-700'}>{category}</Badge>;
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Money Logs</h1>
            <p className="text-muted-foreground">All ecosystem money transactions - EMI, Credits, Disbursements, Expenses</p>
          </div>
          <Button variant="outline" onClick={() => { fetchMoneyLogs(); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <p className="text-sm opacity-90">EMI Collection</p>
              <p className="text-2xl font-bold">{formatCurrency(moneyLogStats.totalEMICollection)}</p>
              <p className="text-xs mt-1 opacity-75">{moneyLogStats.emiCount} payments</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <p className="text-sm opacity-90">Disbursements</p>
              <p className="text-2xl font-bold">{formatCurrency(moneyLogStats.totalDisbursements)}</p>
              <p className="text-xs mt-1 opacity-75">{moneyLogStats.disbursementCount} loans</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <p className="text-sm opacity-90">Total Credits</p>
              <p className="text-2xl font-bold">{formatCurrency(moneyLogStats.totalCredits)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <p className="text-sm opacity-90">Total Debits</p>
              <p className="text-2xl font-bold">{formatCurrency(moneyLogStats.totalDebits)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <p className="text-sm opacity-90">Expenses</p>
              <p className="text-2xl font-bold">{formatCurrency(moneyLogStats.totalExpenses)}</p>
              <p className="text-xs mt-1 opacity-75">{moneyLogStats.expenseCount} records</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Buttons */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Filter:</span>
              <Button
                size="sm"
                variant={moneyLogFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setMoneyLogFilter('all')}
              >
                All ({moneyLogs.length})
              </Button>
              <Button
                size="sm"
                variant={moneyLogFilter === 'emi' ? 'default' : 'outline'}
                className={moneyLogFilter === 'emi' ? 'bg-green-600 hover:bg-green-700' : ''}
                onClick={() => setMoneyLogFilter('emi')}
              >
                <Wallet className="h-4 w-4 mr-1" /> EMI ({moneyLogs.filter(l => l.type === 'EMI_PAYMENT').length})
              </Button>
              <Button
                size="sm"
                variant={moneyLogFilter === 'disbursement' ? 'default' : 'outline'}
                className={moneyLogFilter === 'disbursement' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                onClick={() => setMoneyLogFilter('disbursement')}
              >
                <CreditCard className="h-4 w-4 mr-1" /> Disbursements ({moneyLogs.filter(l => l.type === 'LOAN_DISBURSEMENT' || l.type === 'OFFLINE_LOAN_DISBURSEMENT').length})
              </Button>
              <Button
                size="sm"
                variant={moneyLogFilter === 'credit' ? 'default' : 'outline'}
                className={moneyLogFilter === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                onClick={() => setMoneyLogFilter('credit')}
              >
                <TrendingUp className="h-4 w-4 mr-1" /> Credits ({moneyLogs.filter(l => l.type === 'CREDIT' || l.type === 'BANK_TRANSACTION').length})
              </Button>
              <Button
                size="sm"
                variant={moneyLogFilter === 'expense' ? 'default' : 'outline'}
                className={moneyLogFilter === 'expense' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                onClick={() => setMoneyLogFilter('expense')}
              >
                <Receipt className="h-4 w-4 mr-1" /> Expenses ({moneyLogs.filter(l => l.type === 'EXPENSE').length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Money Logs Table */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No money transactions found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Customer/Reference</TableHead>
                      <TableHead>Payment Mode</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Created By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={`${log.type}-${log.id}`} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(log.type)}
                            {getTypeBadge(log.type, log.category)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{log.description}</p>
                          {log.loanApplicationNo && (
                            <p className="text-xs text-muted-foreground">{log.loanApplicationNo}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.customerName ? (
                            <div>
                              <p className="font-medium text-sm">{log.customerName}</p>
                              {log.customerPhone && <p className="text-xs text-muted-foreground">{log.customerPhone}</p>}
                            </div>
                          ) : log.bankName ? (
                            <div>
                              <p className="font-medium text-sm">{log.bankName}</p>
                              {log.accountNumber && <p className="text-xs text-muted-foreground font-mono">{log.accountNumber}</p>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.paymentMode ? (
                            <Badge variant="outline" className="text-xs">{log.paymentMode}</Badge>
                          ) : log.disbursementMode ? (
                            <Badge variant="outline" className="text-xs">{log.disbursementMode}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-bold ${
                            log.type === 'EMI_PAYMENT' || log.type === 'CREDIT' || (log.type === 'BANK_TRANSACTION' && log.category === 'Bank Credit') ? 'text-green-600' :
                            log.type === 'EXPENSE' || log.type === 'DEBIT' || (log.type === 'BANK_TRANSACTION' && log.category === 'Bank Debit') ? 'text-red-600' :
                            'text-blue-600'
                          }`}>
                            {log.type === 'EMI_PAYMENT' || log.type === 'CREDIT' || (log.type === 'BANK_TRANSACTION' && log.category === 'Bank Credit') ? '+' :
                             log.type === 'EXPENSE' || log.type === 'DEBIT' || (log.type === 'BANK_TRANSACTION' && log.category === 'Bank Debit') ? '-' : ''}
                            {formatCurrency(log.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {log.companyBalanceAfter !== undefined ? (
                            <div className="text-xs">
                              <p className="text-emerald-600">Co: {formatCurrency(log.companyBalanceAfter)}</p>
                              {log.personalBalanceAfter !== undefined && (
                                <p className="text-amber-600">Pr: {formatCurrency(log.personalBalanceAfter)}</p>
                              )}
                            </div>
                          ) : log.balanceAfter !== undefined ? (
                            <p className="text-xs font-mono">{formatCurrency(log.balanceAfter)}</p>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{formatDate(log.transactionDate || log.createdAt)}</p>
                        </TableCell>
                        <TableCell>
                          {log.createdBy ? (
                            <div className="text-xs">
                              <p className="font-medium">{log.createdBy.name}</p>
                              <p className="text-muted-foreground">{log.createdBy.role}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">System</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderExpenses = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Record and manage company expenses</p>
        </div>
        <Button onClick={() => setShowExpenseDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Record Expense
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-2xl font-bold">{formatCurrency(expenses.filter(e => new Date(e.paymentDate).getMonth() === new Date().getMonth()).reduce((sum, e) => sum + e.amount, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-green-600">{expenses.filter(e => e.isApproved).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-orange-600">{expenses.filter(e => !e.isApproved).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono">{expense.expenseNumber}</TableCell>
                    <TableCell><Badge variant="outline">{expense.expenseType}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>{formatDate(expense.paymentDate)}</TableCell>
                    <TableCell>
                      {expense.isApproved ? <Badge className="bg-green-500">Approved</Badge> : <Badge variant="destructive">Pending</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedExpense(expense); setShowExpenseDetailDialog(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!expense.isApproved && (
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => confirmDelete('expense', expense.id, expense.expenseNumber)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderChartOfAccounts = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage all ledger accounts</p>
        </div>
        <Button onClick={() => setShowAccountDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Account
        </Button>
      </div>

      {/* Account Type Summary */}
      <div className="grid grid-cols-5 gap-4">
        {['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'].map((type) => {
          const typeAccounts = groupedAccounts[type] || [];
          const total = typeAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
          return (
            <Card key={type} className={`cursor-pointer hover:shadow-md transition-all ${selectedAccountType === type ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedAccountType(selectedAccountType === type ? 'all' : type)}>
              <CardContent className="p-4 text-center">
                <Badge className={getAccountTypeColor(type)}>{type}</Badge>
                <p className="text-xl font-bold mt-2">{formatCurrency(Math.abs(total))}</p>
                <p className="text-xs text-muted-foreground">{typeAccounts.length} accounts</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Accounts Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedAccounts)
                  .filter(([type]) => selectedAccountType === 'all' || type === selectedAccountType)
                  .flatMap(([_, accounts]) => accounts.map((account) => (
                    <TableRow key={account.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedAccount(account); setShowAccountDetailDialog(true); }}>
                      <TableCell className="font-mono">{account.accountCode}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{account.accountName}</p>
                          {account.description && <p className="text-xs text-muted-foreground">{account.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell><Badge className={getAccountTypeColor(account.accountType)}>{account.accountType}</Badge></TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(account.currentBalance)}</span>
                      </TableCell>
                      <TableCell>
                        {account.isActive ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                        {account.isSystemAccount && <Badge variant="outline" className="ml-1">System</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLedgerAccount(account.id); fetchLedgerTransactions(account.id); setShowLedgerDetailDialog(true); }}>
                            <BookOpen className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedAccount(account); setShowAccountDetailDialog(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!account.isSystemAccount && (
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); confirmDelete('account', account.id, account.accountName); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const [scanningLoans, setScanningLoans] = useState(false);
  const [scanResults, setScanResults] = useState<any>(null);

  const scanPastLoanTransactions = async () => {
    setScanningLoans(true);
    try {
      const res = await fetch('/api/accounting/scan-loan-transactions');
      const data = await res.json();
      if (data.success) {
        setScanResults(data);
        toast.success(`Found ${data.totalTransactions} transactions from ${data.totalLoans} loans`);
        fetchDashboardData();
      } else {
        toast.error(data.error || 'Failed to scan transactions');
      }
    } catch (error) {
      console.error('Error scanning transactions:', error);
      toast.error('Failed to scan loan transactions');
    } finally {
      setScanningLoans(false);
    }
  };

  const renderBankAccounts = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bank Accounts & Transactions</h1>
          <p className="text-muted-foreground">Real-time bank balance with all loan and EMI transactions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={scanPastLoanTransactions}
            disabled={scanningLoans}
          >
            {scanningLoans ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Scan Past Transactions
          </Button>
          <Button onClick={() => setShowBankDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Bank Account
          </Button>
        </div>
      </div>

      {/* Scan Results */}
      {scanResults && (
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-emerald-800">Scan Results</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">{scanResults.totalLoans}</p>
                <p className="text-xs text-gray-500">Loans Scanned</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{scanResults.totalTransactions}</p>
                <p className="text-xs text-gray-500">Transactions Found</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(scanResults.totalCredits || 0)}</p>
                <p className="text-xs text-gray-500">Total Credits</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-2xl font-bold text-red-600">{formatCurrency(scanResults.totalDebits || 0)}</p>
                <p className="text-xs text-gray-500">Total Debits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
          <CardContent className="p-4">
            <p className="text-sm opacity-90">Total Bank Balance</p>
            <p className="text-2xl font-bold">{formatCurrency(dashboardStats.bankBalance)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-teal-500 text-white">
          <CardContent className="p-4">
            <p className="text-sm opacity-90">Total Credits</p>
            <p className="text-2xl font-bold">{formatCurrency(bankAccounts.reduce((sum, a) => sum + (a.totalCredits || 0), 0))}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
          <CardContent className="p-4">
            <p className="text-sm opacity-90">Total Debits</p>
            <p className="text-2xl font-bold">{formatCurrency(bankAccounts.reduce((sum, a) => sum + (a.totalDebits || 0), 0))}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
          <CardContent className="p-4">
            <p className="text-sm opacity-90">Active Loans</p>
            <p className="text-2xl font-bold">{activeLoans.length}</p>
            <p className="text-xs opacity-75">{formatCurrency(dashboardStats.totalLoanAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bankAccounts.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No bank accounts configured</p>
              <p className="text-sm mt-2">Bank accounts are required to track loan disbursements and EMI collections</p>
              <Button className="mt-4" onClick={() => setShowBankDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Bank Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          bankAccounts.map((account) => (
            <Card key={account.id} className={`cursor-pointer hover:shadow-md transition-all ${account.isDefault ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold">{account.bankName}</h4>
                    <p className="text-sm text-muted-foreground">{account.accountName}</p>
                  </div>
                  {account.isDefault && <Badge>Default</Badge>}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Account No:</span>
                    <span className="font-mono text-sm">{account.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Balance:</span>
                    <span className={`font-bold ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(account.currentBalance)}
                    </span>
                  </div>
                  {(account.totalCredits || account.totalDebits) && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600">+ {formatCurrency(account.totalCredits || 0)}</span>
                        <span className="text-red-600">- {formatCurrency(account.totalDebits || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedBankAccount(account); setShowBankDetailDialog(true); }}>
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedLedgerAccount(account.id); fetchLedgerTransactions(account.id); setShowLedgerDetailDialog(true); }}>
                    <BookOpen className="h-3 w-3 mr-1" /> Ledger
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => confirmDelete('bank', account.id, account.bankName)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Bank Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> Recent Bank Transactions
          </CardTitle>
          <CardDescription>All loan disbursements (debit) and EMI collections (credit)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {bankTransactions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No bank transactions yet</p>
                <p className="text-sm mt-2">Transactions will appear here when loans are disbursed or EMIs are collected</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDate(tx.transactionDate)}</TableCell>
                      <TableCell>
                        <Badge className={tx.transactionType === 'CREDIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {tx.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tx.referenceType}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {tx.transactionType === 'DEBIT' ? formatCurrency(tx.amount) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {tx.transactionType === 'CREDIT' ? formatCurrency(tx.amount) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(tx.balanceAfter)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderTrialBalance = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">As on {formatDate(new Date())}</p>
        </div>
        <Button variant="outline" onClick={() => handleExportReport('trial-balance')}>
          <Download className="h-4 w-4 mr-2" /> Export
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialBalance?.map((item: any) => (
                  <TableRow key={item.accountCode}>
                    <TableCell className="font-mono">{item.accountCode}</TableCell>
                    <TableCell>{item.accountName}</TableCell>
                    <TableCell><Badge className={getAccountTypeColor(item.accountType)}>{item.accountType}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{item.debitBalance > 0 ? formatCurrency(item.debitBalance) : '-'}</TableCell>
                    <TableCell className="text-right font-mono">{item.creditBalance > 0 ? formatCurrency(item.creditBalance) : '-'}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(trialBalance?.reduce((sum: number, item: any) => sum + item.debitBalance, 0) || 0)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(trialBalance?.reduce((sum: number, item: any) => sum + item.creditBalance, 0) || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderProfitLoss = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Profit & Loss Statement</h1>
          <p className="text-muted-foreground">{formatDate(dateRange.startDate)} to {formatDate(dateRange.endDate)}</p>
        </div>
        <Button variant="outline" onClick={() => handleExportReport('profit-loss')}>
          <Download className="h-4 w-4 mr-2" /> Export
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="bg-green-50 dark:bg-green-900/20">
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" /> INCOME
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {profitAndLoss?.income?.map((item: any) => (
                  <TableRow key={item.accountCode}>
                    <TableCell className="font-mono text-xs">{item.accountCode}</TableCell>
                    <TableCell>{item.accountName}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-green-50 dark:bg-green-900/20">
                  <TableCell colSpan={2}>Total Income</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(profitAndLoss?.totalIncome || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-red-50 dark:bg-red-900/20">
            <CardTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-5 w-5" /> EXPENSES
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {profitAndLoss?.expenses?.map((item: any) => (
                  <TableRow key={item.accountCode}>
                    <TableCell className="font-mono text-xs">{item.accountCode}</TableCell>
                    <TableCell>{item.accountName}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-red-50 dark:bg-red-900/20">
                  <TableCell colSpan={2}>Total Expenses</TableCell>
                  <TableCell className="text-right font-mono text-red-600">{formatCurrency(profitAndLoss?.totalExpenses || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Net Profit */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
        <CardContent className="p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm opacity-90">NET PROFIT / (LOSS)</p>
              <p className="text-4xl font-bold">{formatCurrency(profitAndLoss?.netProfit || 0)}</p>
            </div>
            {(profitAndLoss?.netProfit || 0) >= 0 ? <TrendingUp className="h-16 w-16 opacity-50" /> : <TrendingDown className="h-16 w-16 opacity-50" />}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderYearEnd = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Year-End Closing</h1>
          <p className="text-muted-foreground">Manage financial year closing and carry forward balances</p>
        </div>
      </div>

      {/* Financial Years List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Financial Years
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialYears.map((fy) => (
                <TableRow key={fy.id}>
                  <TableCell className="font-medium">{fy.name}</TableCell>
                  <TableCell>{formatDate(fy.startDate)}</TableCell>
                  <TableCell>{formatDate(fy.endDate)}</TableCell>
                  <TableCell>
                    {fy.isClosed ? (
                      <Badge className="bg-gray-500">Closed</Badge>
                    ) : (
                      <Badge className="bg-green-500">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!fy.isClosed && (
                      <Button size="sm" variant="outline">
                        Close Year
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {financialYears.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No financial years configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Year-End Process Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Year-End Process</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold text-sm">1</span>
              </div>
              <div>
                <p className="font-medium">Review Trial Balance</p>
                <p className="text-sm text-muted-foreground">Ensure all accounts are balanced before closing</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 font-bold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium">Post Adjusting Entries</p>
                <p className="text-sm text-muted-foreground">Record any year-end adjustments</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-bold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium">Close Income & Expense</p>
                <p className="text-sm text-muted-foreground">Transfer net profit/loss to Retained Earnings</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 font-bold text-sm">4</span>
              </div>
              <div>
                <p className="font-medium">Carry Forward Balances</p>
                <p className="text-sm text-muted-foreground">Asset & Liability balances carry to new year</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Year Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-sm">Total Income</span>
              <span className="font-bold text-green-600">{formatCurrency(profitAndLoss?.totalIncome || 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <span className="text-sm">Total Expenses</span>
              <span className="font-bold text-red-600">{formatCurrency(profitAndLoss?.totalExpenses || 0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="font-medium">Net Profit/Loss</span>
              <span className={`font-bold text-xl ${(profitAndLoss?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(profitAndLoss?.netProfit || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <DashboardLayout
      title="Accountant Portal"
      subtitle="Financial Management"
      menuItems={menuItems}
      activeTab={activeSection}
      onTabChange={setActiveSection}
      stats={stats}
      gradient="bg-gradient-to-br from-teal-500 to-emerald-600"
      logoIcon={Calculator}
      headerRight={
        <div className="flex items-center gap-3">
          <CompanySelector
            selectedCompanyIds={selectedCompanyIds}
            onSelectionChange={setSelectedCompanyIds}
            selectedBankAccountId={selectedBankAccountId}
            onBankAccountChange={setSelectedBankAccountId}
          />
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
            <Activity className={`h-4 w-4 ${isRealTimeEnabled ? 'text-green-500' : 'text-gray-400'}`} />
            <span className="text-xs text-gray-600">
              {isRealTimeEnabled ? 'Live' : 'Paused'}
            </span>
          </div>
        </div>
      }
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Modern Loading Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32 mb-6" />
                  <TableSkeleton rows={5} cols={3} />
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32 mb-6" />
                  <TableSkeleton rows={5} cols={3} />
                </CardContent>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      {/* Journal Entry Dialog */}
      <Dialog open={showJournalDialog} onOpenChange={setShowJournalDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Journal Entry</DialogTitle>
            <DialogDescription>Total debits must equal total credits.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Entry Date</Label>
                <Input type="date" value={newJournalDate} onChange={(e) => setNewJournalDate(e.target.value)} />
              </div>
              <div>
                <Label>Reference Type</Label>
                <Select value={newJournalRefType} onValueChange={setNewJournalRefType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL_ENTRY">Manual Entry</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="OPENING_BALANCE">Opening Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Narration</Label>
              <Textarea placeholder="Enter description..." value={newJournalNarration} onChange={(e) => setNewJournalNarration(e.target.value)} />
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold">Journal Lines</h4>
                <Button size="sm" variant="outline" onClick={() => setNewJournalLines([...newJournalLines, { accountId: '', debit: 0, credit: 0 }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add Line
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newJournalLines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select value={line.accountId} onValueChange={(val) => {
                          const updated = [...newJournalLines];
                          updated[idx].accountId = val;
                          setNewJournalLines(updated);
                        }}>
                          <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>
                            {accounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>{acc.accountCode} - {acc.accountName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" className="text-right" value={line.debit || ''} onChange={(e) => {
                          const updated = [...newJournalLines];
                          updated[idx].debit = parseFloat(e.target.value) || 0;
                          setNewJournalLines(updated);
                        }} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" className="text-right" value={line.credit || ''} onChange={(e) => {
                          const updated = [...newJournalLines];
                          updated[idx].credit = parseFloat(e.target.value) || 0;
                          setNewJournalLines(updated);
                        }} />
                      </TableCell>
                      <TableCell>
                        {newJournalLines.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => setNewJournalLines(newJournalLines.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between mt-4 p-3 bg-muted rounded-lg text-sm">
                <span>Total Debit: {formatCurrency(newJournalLines.reduce((sum, l) => sum + l.debit, 0))}</span>
                <span>Total Credit: {formatCurrency(newJournalLines.reduce((sum, l) => sum + l.credit, 0))}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowJournalDialog(false); resetJournalForm(); }}>Cancel</Button>
            <Button onClick={handleSaveJournalEntry}>Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Expense Type</Label>
              <Select value={newExpenseData.type} onValueChange={(val) => setNewExpenseData({ ...newExpenseData, type: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALARY">Staff Salary</SelectItem>
                  <SelectItem value="RENT">Office Rent</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="COMMISSION">Commission Paid</SelectItem>
                  <SelectItem value="SOFTWARE">Software & Hosting</SelectItem>
                  <SelectItem value="BANK_CHARGES">Bank Charges</SelectItem>
                  <SelectItem value="UTILITIES">Utilities</SelectItem>
                  <SelectItem value="MISCELLANEOUS">Miscellaneous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newExpenseData.description} onChange={(e) => setNewExpenseData({ ...newExpenseData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount</Label>
                <Input type="number" value={newExpenseData.amount || ''} onChange={(e) => setNewExpenseData({ ...newExpenseData, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={newExpenseData.date} onChange={(e) => setNewExpenseData({ ...newExpenseData, date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={newExpenseData.paymentMode} onValueChange={(val) => setNewExpenseData({ ...newExpenseData, paymentMode: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="PAYABLE">Payable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowExpenseDialog(false); resetExpenseForm(); }}>Cancel</Button>
            <Button onClick={handleSaveExpense}>Record Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Account Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bank Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bank Name <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g., State Bank of India" value={newBankData.bankName} onChange={(e) => setNewBankData({ ...newBankData, bankName: e.target.value })} />
            </div>
            <div>
              <Label>Account Number <span className="text-red-500">*</span></Label>
              <Input value={newBankData.accountNumber} onChange={(e) => setNewBankData({ ...newBankData, accountNumber: e.target.value })} />
            </div>
            <div>
              <Label>Account Name</Label>
              <Input value={newBankData.accountName} onChange={(e) => setNewBankData({ ...newBankData, accountName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account Type</Label>
                <Select value={newBankData.accountType} onValueChange={(val) => setNewBankData({ ...newBankData, accountType: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAVINGS">Savings</SelectItem>
                    <SelectItem value="CURRENT">Current</SelectItem>
                    <SelectItem value="OVERDRAFT">Overdraft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>IFSC Code</Label>
                <Input value={newBankData.ifscCode} onChange={(e) => setNewBankData({ ...newBankData, ifscCode: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Opening Balance</Label>
              <Input type="number" value={newBankData.openingBalance || ''} onChange={(e) => setNewBankData({ ...newBankData, openingBalance: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBankDialog(false); resetBankForm(); }}>Cancel</Button>
            <Button onClick={handleSaveBankAccount}>Add Bank Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Dialog */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account Code</Label>
              <Input placeholder="e.g., 1600" value={newAccountData.code} onChange={(e) => setNewAccountData({ ...newAccountData, code: e.target.value })} />
            </div>
            <div>
              <Label>Account Name</Label>
              <Input placeholder="e.g., Other Receivables" value={newAccountData.name} onChange={(e) => setNewAccountData({ ...newAccountData, name: e.target.value })} />
            </div>
            <div>
              <Label>Account Type</Label>
              <Select value={newAccountData.type} onValueChange={(val) => setNewAccountData({ ...newAccountData, type: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSET">Asset</SelectItem>
                  <SelectItem value="LIABILITY">Liability</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="EQUITY">Equity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Opening Balance</Label>
              <Input type="number" value={newAccountData.openingBalance || ''} onChange={(e) => setNewAccountData({ ...newAccountData, openingBalance: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAccountDialog(false); resetAccountForm(); }}>Cancel</Button>
            <Button onClick={handleSaveAccount}>Add Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialogs */}
      <Dialog open={showEntryDetailDialog} onOpenChange={setShowEntryDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Journal Entry Details</DialogTitle></DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="flex justify-between">
                <div>
                  <h3 className="text-xl font-bold">{selectedEntry.entryNumber}</h3>
                  <p className="text-muted-foreground">{formatDate(selectedEntry.entryDate)}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{getReferenceTypeLabel(selectedEntry.referenceType)}</Badge>
                  {selectedEntry.isApproved ? <Badge className="bg-green-500">Approved</Badge> : <Badge variant="destructive">Pending</Badge>}
                </div>
              </div>
              <p className="p-3 bg-muted rounded-lg">{selectedEntry.narration}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">DEBIT</p>
                  {selectedEntry.lines.filter(l => l.debitAmount > 0).map((line) => (
                    <div key={line.id} className="flex justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded mb-1">
                      <span className="text-sm">{line.account?.accountName}</span>
                      <span className="font-mono">{formatCurrency(line.debitAmount)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">CREDIT</p>
                  {selectedEntry.lines.filter(l => l.creditAmount > 0).map((line) => (
                    <div key={line.id} className="flex justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded mb-1">
                      <span className="text-sm">{line.account?.accountName}</span>
                      <span className="font-mono">{formatCurrency(line.creditAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowEntryDetailDialog(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAccountDetailDialog} onOpenChange={setShowAccountDetailDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Account Details</DialogTitle></DialogHeader>
          {selectedAccount && (
            <div className="space-y-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Code</p>
                  <p className="text-2xl font-mono font-bold">{selectedAccount.accountCode}</p>
                </div>
                <Badge className={getAccountTypeColor(selectedAccount.accountType)}>{selectedAccount.accountType}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Name</p>
                <p className="text-xl font-semibold">{selectedAccount.accountName}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className={`text-3xl font-bold ${selectedAccount.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(selectedAccount.currentBalance)}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccountDetailDialog(false)}>Close</Button>
            <Button onClick={() => { setShowAccountDetailDialog(false); if (selectedAccount) { setSelectedLedgerAccount(selectedAccount.id); fetchLedgerTransactions(selectedAccount.id); setShowLedgerDetailDialog(true); }}}>
              <BookOpen className="h-4 w-4 mr-2" /> View Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBankDetailDialog} onOpenChange={setShowBankDetailDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bank Account Details</DialogTitle></DialogHeader>
          {selectedBankAccount && (
            <div className="space-y-4">
              <div className="flex justify-between">
                <div>
                  <h3 className="text-xl font-bold">{selectedBankAccount.bankName}</h3>
                  <p className="text-muted-foreground">{selectedBankAccount.accountName}</p>
                </div>
                {selectedBankAccount.isDefault && <Badge>Default</Badge>}
              </div>
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Number:</span>
                  <span className="font-mono">{selectedBankAccount.accountNumber}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Balance:</span>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(selectedBankAccount.currentBalance)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBankDetailDialog(false)}>Close</Button>
            <Button onClick={() => { setShowBankDetailDialog(false); if (selectedBankAccount) { setSelectedLedgerAccount(selectedBankAccount.id); fetchLedgerTransactions(selectedBankAccount.id); setShowLedgerDetailDialog(true); }}}>
              <BookOpen className="h-4 w-4 mr-2" /> View Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExpenseDetailDialog} onOpenChange={setShowExpenseDetailDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Expense Details</DialogTitle></DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expense Number</p>
                  <p className="text-xl font-mono font-bold">{selectedExpense.expenseNumber}</p>
                </div>
                <div className="flex gap-2">
                  <Badge>{selectedExpense.expenseType}</Badge>
                  {selectedExpense.isApproved ? <Badge className="bg-green-500">Approved</Badge> : <Badge variant="destructive">Pending</Badge>}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{selectedExpense.description}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="text-2xl font-bold text-red-600">{formatCurrency(selectedExpense.amount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Date:</span>
                  <span>{formatDate(selectedExpense.paymentDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Mode:</span>
                  <span>{selectedExpense.paymentMode}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowExpenseDetailDialog(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLedgerDetailDialog} onOpenChange={setShowLedgerDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader><DialogTitle>Account Ledger</DialogTitle></DialogHeader>
          <ScrollArea className="h-[400px]">
            {selectedLedgerAccount && ledgerTransactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry No</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerTransactions.map((tx: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{formatDate(tx.date)}</TableCell>
                      <TableCell className="font-mono text-sm">{tx.entryNumber}</TableCell>
                      <TableCell>{tx.narration}</TableCell>
                      <TableCell className="text-right font-mono">{tx.debit > 0 ? formatCurrency(tx.debit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{tx.credit > 0 ? formatCurrency(tx.credit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatCurrency(tx.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions found</p>
              </div>
            )}
          </ScrollArea>
          <DialogFooter><Button variant="outline" onClick={() => setShowLedgerDetailDialog(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirm Delete</DialogTitle>
            <DialogDescription>Are you sure you want to delete this {deleteTarget?.type}? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Warning</span>
              </div>
              <p className="text-sm mt-2">You are about to delete: <strong>{deleteTarget?.name}</strong></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteConfirmDialog(false); setDeleteTarget(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
