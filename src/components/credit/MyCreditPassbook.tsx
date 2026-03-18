'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  IndianRupee, User, ArrowUpRight, ArrowDownRight, FileText, Clock, 
  CheckCircle, AlertTriangle, Eye, Download, Filter, Search, RefreshCw,
  CreditCard, Wallet, TrendingUp, Calendar, Phone, Mail, Building2,
  Upload, X, ImageIcon, FileCheck, MinusCircle, PlusCircle, History,
  AlertCircle, Loader2, ArrowDown, Receipt, BookOpen, Send,
  ChevronRight, ChevronLeft, MapPin, Briefcase, Banknote, Home,
  Percent, Timer, Repeat, Pause, Play
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface CreditTransaction {
  id: string;
  userId: string;
  transactionType: string;
  amount: number;
  paymentMode: string;
  creditType: string;
  companyBalanceAfter?: number;
  personalBalanceAfter?: number;
  balanceAfter: number;
  sourceType: string;
  loanApplicationId?: string;
  emiScheduleId?: string;
  customerId?: string;
  installmentNumber?: number;
  customerName?: string;
  customerPhone?: string;
  loanApplicationNo?: string;
  emiDueDate?: string;
  emiAmount?: number;
  principalComponent?: number;
  interestComponent?: number;
  chequeNumber?: string;
  chequeDate?: string;
  bankRefNumber?: string;
  utrNumber?: string;
  proofDocument?: string;
  proofType?: string;
  proofVerified: boolean;
  proofUploadedAt?: string;
  description?: string;
  remarks?: string;
  collectedFrom?: string;
  collectedFromPhone?: string;
  collectionLocation?: string;
  transactionDate: string;
  createdAt: string;
}

interface LoanDetail {
  id: string;
  applicationNo: string;
  status: string;
  loanType: string;
  requestedAmount: number;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  sessionForm?: {
    approvedAmount: number;
    interestRate: number;
    tenure: number;
    emiAmount: number;
    totalAmount: number;
    totalInterest: number;
    processingFee: number;
  };
  emiSchedules?: Array<{
    id: string;
    installmentNumber: number;
    dueDate: string;
    totalAmount: number;
    principalAmount: number;
    interestAmount: number;
    paidAmount: number;
    paymentStatus: string;
    paidDate?: string;
    paymentMode?: string;
    penaltyAmount: number;
    daysOverdue: number;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    paymentMode: string;
    createdAt: string;
    status: string;
  }>;
  createdAt: string;
  disbursedAt?: string;
}

interface CreditSummary {
  totalCredit: number;
  companyCredit: number;
  personalCredit: number;
  todayTotal: number;
  todayCompanyCreditIncrease: number;
  todayPersonalCreditIncrease: number;
  cashCollected: number;
  chequeCollected: number;
  onlineCollected: number;
  todayTransactions: number;
  totalTransactions: number;
  pendingProofs: number;
}

export default function MyCreditPassbook() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companyCredit, setCompanyCredit] = useState(0);
  const [personalCredit, setPersonalCredit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCreditType, setFilterCreditType] = useState('all');
  
  // Auto-refresh state - disabled by default to prevent DB connection limit issues
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Dialogs
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [showLoanDetailDialog, setShowLoanDetailDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<CreditTransaction | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanDetail | null>(null);
  const [loadingLoanDetail, setLoadingLoanDetail] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Settlement form
  const [settlementForm, setSettlementForm] = useState({
    amount: 0,
    paymentMode: 'CASH',
    creditType: 'COMPANY',
    remarks: ''
  });

  const hasFetchedRef = useRef(false);

  // Fetch data function with callback
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      // Fetch credit summary
      const summaryRes = await fetch(`/api/credit?userId=${user?.id}&action=summary`);
      const summaryData = await summaryRes.json();
      
      if (summaryData.success && summaryData.summary) {
        setSummary(summaryData.summary);
        setCompanyCredit(summaryData.summary.companyCredit || 0);
        setPersonalCredit(summaryData.summary.personalCredit || 0);
        setTotalCredit(summaryData.summary.totalCredit || 0);
      }
      
      // Fetch transactions with pagination
      const txRes = await fetch(`/api/credit?userId=${user?.id}&limit=100`);
      const txData = await txRes.json();
      
      if (txData.success) {
        setTransactions(txData.transactions || []);
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching credit data:', error);
      if (!isRefresh) {
        toast({
          title: 'Error',
          description: 'Failed to fetch credit data',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    if (user?.id && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [user?.id, fetchData]);

  // Auto-refresh polling every 30 seconds (reduced to prevent DB connection limit issues)
  useEffect(() => {
    if (autoRefresh && user?.id) {
      intervalRef.current = setInterval(() => {
        fetchData(true);
      }, 30000); // Refresh every 30 seconds (reduced from 1 second)
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, user?.id, fetchData]);

  // Fetch loan details
  const fetchLoanDetail = async (loanId: string) => {
    setLoadingLoanDetail(true);
    try {
      const response = await fetch(`/api/loan/details?loanId=${loanId}`);
      const data = await response.json();
      if (data.success) {
        setSelectedLoan(data.loan || data);
        setShowLoanDetailDialog(true);
      } else {
        toast({ title: 'Error', description: 'Failed to fetch loan details', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error fetching loan details:', error);
      toast({ title: 'Error', description: 'Failed to fetch loan details', variant: 'destructive' });
    } finally {
      setLoadingLoanDetail(false);
    }
  };

  const handleRequestSettlement = async () => {
    if (!user?.id) return;
    
    if (settlementForm.amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
        variant: 'destructive'
      });
      return;
    }
    
    const availableCredit = settlementForm.creditType === 'COMPANY' ? companyCredit : personalCredit;
    if (settlementForm.amount > availableCredit) {
      toast({
        title: 'Insufficient Credit',
        description: `Available ${settlementForm.creditType.toLowerCase()} credit: ${formatCurrency(availableCredit)}`,
        variant: 'destructive'
      });
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch('/api/credit/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: settlementForm.amount,
          paymentMode: settlementForm.paymentMode,
          creditType: settlementForm.creditType,
          remarks: settlementForm.remarks
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Settlement Requested',
          description: `Settlement request for ${formatCurrency(settlementForm.amount)} submitted to Super Admin`
        });
        setShowSettlementDialog(false);
        setSettlementForm({ amount: 0, paymentMode: 'CASH', creditType: 'COMPANY', remarks: '' });
        fetchData(true);
      } else {
        throw new Error(data.error || 'Failed to create settlement request');
      }
    } catch (error) {
      console.error('Error creating settlement:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create settlement request',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTransactionTypeConfig = (type: string) => {
    const config: Record<string, { className: string; label: string; icon: React.ElementType; color: string }> = {
      CREDIT_INCREASE: { 
        className: 'bg-emerald-100 text-emerald-800', 
        label: 'Credit Added', 
        icon: PlusCircle,
        color: 'text-emerald-600'
      },
      CREDIT_DECREASE: { 
        className: 'bg-red-100 text-red-800', 
        label: 'Credit Deducted', 
        icon: MinusCircle,
        color: 'text-red-600'
      },
      PERSONAL_COLLECTION: { 
        className: 'bg-amber-100 text-amber-800', 
        label: 'Personal Collection', 
        icon: PlusCircle,
        color: 'text-amber-600'
      },
      PERSONAL_CLEARANCE: { 
        className: 'bg-blue-100 text-blue-800', 
        label: 'Personal Cleared', 
        icon: CheckCircle,
        color: 'text-blue-600'
      },
      SETTLEMENT: { 
        className: 'bg-purple-100 text-purple-800', 
        label: 'Settlement', 
        icon: ArrowDown,
        color: 'text-purple-600'
      },
      ADJUSTMENT: { 
        className: 'bg-gray-100 text-gray-800', 
        label: 'Adjustment', 
        icon: ArrowDownRight,
        color: 'text-gray-600'
      }
    };
    return config[type] || { 
      className: 'bg-gray-100 text-gray-800', 
      label: type, 
      icon: IndianRupee,
      color: 'text-gray-600'
    };
  };

  const getPaymentModeConfig = (mode: string) => {
    const config: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
      CASH: { icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-100' },
      CHEQUE: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
      ONLINE: { icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-100' },
      UPI: { icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-100' },
      BANK_TRANSFER: { icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-100' },
      SYSTEM: { icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-100' }
    };
    return config[mode] || { icon: IndianRupee, color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  const getPaymentStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      PENDING: { className: 'bg-amber-100 text-amber-700', label: 'Pending' },
      PAID: { className: 'bg-emerald-100 text-emerald-700', label: 'Paid' },
      PARTIALLY_PAID: { className: 'bg-blue-100 text-blue-700', label: 'Partial' },
      OVERDUE: { className: 'bg-red-100 text-red-700', label: 'Overdue' }
    };
    const { className, label } = config[status] || { className: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={className}>{label}</Badge>;
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = !searchQuery || 
      tx.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.loanApplicationNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || tx.transactionType === filterType;
    const matchesCreditType = filterCreditType === 'all' || tx.creditType === filterCreditType;
    
    return matchesSearch && matchesType && matchesCreditType;
  });

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, tx) => {
    const date = formatDateShort(tx.transactionDate);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(tx);
    return groups;
  }, {} as Record<string, CreditTransaction[]>);

  return (
    <div className="space-y-6">
      {/* Header with Auto-Refresh Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Credit</h2>
          <p className="text-gray-500">View your credit balance, passbook, and request settlements</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
            {autoRefresh ? (
              <Repeat className="h-4 w-4 text-emerald-600" />
            ) : (
              <Pause className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm font-medium">
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="h-6 w-6 p-0"
            >
              {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Live Update Indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
        <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
        {autoRefresh && <span className="text-emerald-600">(Auto-refresh every 1 second)</span>}
      </div>

      {/* Credit Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Company Credit</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(companyCredit)}</p>
                  <p className="text-emerald-200 text-xs mt-1">From CASH collections</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Building2 className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">Personal Credit</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(personalCredit)}</p>
                  <p className="text-amber-200 text-xs mt-1">From non-CASH collections</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <User className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Credit</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(totalCredit)}</p>
                  <p className="text-blue-200 text-xs mt-1">Your collection balance</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Today's Summary */}
      {summary && (
        <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">Today's Collection</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.todayTotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">CASH</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.cashCollected)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">CHEQUE</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.chequeCollected)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">ONLINE/UPI</p>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(summary.onlineCollected)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Transactions</p>
                <p className="text-lg font-bold text-gray-900">{summary.todayTransactions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Credit System Rules:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li><strong>Company Credit:</strong> Increases when you collect EMI via CASH payment</li>
                <li><strong>Personal Credit:</strong> Increases when you collect via CHEQUE, UPI, or ONLINE (proof required)</li>
                <li><strong>Settlement:</strong> Request settlement to transfer your credit to Super Admin</li>
                <li><strong>Auto-Refresh:</strong> Data refreshes automatically every 1 second</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="passbook" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Passbook
          </TabsTrigger>
          <TabsTrigger value="settlement" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Settlement
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600" />
                Recent Transactions
              </CardTitle>
              <CardDescription>Your latest credit activities (refreshes every 1 second)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No transactions yet</p>
                  <p className="text-sm">Start collecting EMIs to build your credit</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 10).map((tx) => {
                    const typeConfig = getTransactionTypeConfig(tx.transactionType);
                    const TypeIcon = typeConfig.icon;
                    
                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedTransaction(tx);
                          setShowTransactionDetail(true);
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION') 
                              ? 'bg-emerald-100' 
                              : 'bg-red-100'
                          }`}>
                            <TypeIcon className={`h-6 w-6 ${
                              tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION')
                                ? 'text-emerald-600'
                                : 'text-red-600'
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{typeConfig.label}</p>
                              <Badge variant="outline" className="text-xs">
                                {tx.creditType}
                              </Badge>
                            </div>
                            {tx.customerName && (
                              <p className="text-sm text-gray-600">{tx.customerName}</p>
                            )}
                            <p className="text-xs text-gray-500">{formatDate(tx.transactionDate)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION')
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}>
                            {tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION') ? '+' : '-'}
                            {formatCurrency(tx.amount)}
                          </p>
                          <p className="text-xs text-gray-500">Balance: {formatCurrency(tx.balanceAfter)}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Passbook Tab */}
        <TabsContent value="passbook" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                    Complete Passbook
                  </CardTitle>
                  <CardDescription>All your credit transactions with complete details</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search by customer, loan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-56"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="CREDIT_INCREASE">Credit Added</SelectItem>
                      <SelectItem value="PERSONAL_COLLECTION">Personal +</SelectItem>
                      <SelectItem value="CREDIT_DECREASE">Credit Deducted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCreditType} onValueChange={setFilterCreditType}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Credit Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Credits</SelectItem>
                      <SelectItem value="COMPANY">Company</SelectItem>
                      <SelectItem value="PERSONAL">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No transactions found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-6">
                    {Object.entries(groupedTransactions).map(([date, txs]) => (
                      <div key={date}>
                        <div className="sticky top-0 bg-gray-50 py-2 px-3 rounded-lg mb-2 z-10">
                          <p className="text-sm font-semibold text-gray-700">{date}</p>
                          <p className="text-xs text-gray-500">
                            {txs.length} transaction{txs.length > 1 ? 's' : ''} • 
                            Total: {formatCurrency(txs.reduce((sum, tx) => 
                              tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION')
                                ? sum + tx.amount 
                                : sum - tx.amount, 0
                            ))}
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          {txs.map((tx) => {
                            const typeConfig = getTransactionTypeConfig(tx.transactionType);
                            const paymentConfig = getPaymentModeConfig(tx.paymentMode);
                            const PaymentIcon = paymentConfig.icon;
                            const TypeIcon = typeConfig.icon;
                            
                            return (
                              <motion.div
                                key={tx.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="border rounded-xl p-4 bg-white hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => {
                                  setSelectedTransaction(tx);
                                  setShowTransactionDetail(true);
                                }}
                              >
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                  <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${paymentConfig.bg}`}>
                                      <PaymentIcon className={`h-6 w-6 ${paymentConfig.color}`} />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <Badge className={typeConfig.className}>
                                          <TypeIcon className="h-3 w-3 mr-1" />
                                          {typeConfig.label}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                          {tx.creditType}
                                        </Badge>
                                      </div>
                                      {tx.customerName && (
                                        <p className="font-medium text-gray-900 mt-1">{tx.customerName}</p>
                                      )}
                                      <p className="text-xs text-gray-500">{formatTime(tx.transactionDate)}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap items-center gap-6">
                                    {tx.loanApplicationNo && (
                                      <div className="text-center">
                                        <p className="text-xs text-gray-500">Loan No.</p>
                                        <p className="text-sm font-medium text-blue-600">{tx.loanApplicationNo}</p>
                                      </div>
                                    )}
                                    {tx.installmentNumber && (
                                      <div className="text-center">
                                        <p className="text-xs text-gray-500">EMI #</p>
                                        <p className="text-sm font-medium">#{tx.installmentNumber}</p>
                                      </div>
                                    )}
                                    {tx.emiAmount && (
                                      <div className="text-center">
                                        <p className="text-xs text-gray-500">EMI Amount</p>
                                        <p className="text-sm font-medium">{formatCurrency(tx.emiAmount)}</p>
                                      </div>
                                    )}
                                    <div className="text-center">
                                      <p className="text-xs text-gray-500">Payment Mode</p>
                                      <p className="text-sm font-medium">{tx.paymentMode}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-lg font-bold ${
                                        tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION')
                                          ? 'text-emerald-600'
                                          : 'text-red-600'
                                      }`}>
                                        {tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION') ? '+' : '-'}
                                        {formatCurrency(tx.amount)}
                                      </p>
                                      <p className="text-xs text-gray-500">Bal: {formatCurrency(tx.balanceAfter)}</p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-gray-400" />
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlement Tab */}
        <TabsContent value="settlement" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request Settlement Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-purple-600" />
                  Request Settlement
                </CardTitle>
                <CardDescription>
                  Submit your collected credit to Super Admin for clearance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-sm text-gray-600">Company Credit</p>
                    <p className="text-2xl font-bold text-emerald-700">{formatCurrency(companyCredit)}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-sm text-gray-600">Personal Credit</p>
                    <p className="text-2xl font-bold text-amber-700">{formatCurrency(personalCredit)}</p>
                  </div>
                </div>

                <div>
                  <Label>Credit Type to Settle</Label>
                  <Select 
                    value={settlementForm.creditType} 
                    onValueChange={(v) => setSettlementForm({ ...settlementForm, creditType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPANY">
                        Company Credit ({formatCurrency(companyCredit)})
                      </SelectItem>
                      <SelectItem value="PERSONAL">
                        Personal Credit ({formatCurrency(personalCredit)})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Amount to Settle</Label>
                  <div className="relative">
                    <IndianRupee className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="number"
                      value={settlementForm.amount || ''}
                      onChange={(e) => setSettlementForm({ ...settlementForm, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="Enter amount"
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Available: {formatCurrency(settlementForm.creditType === 'COMPANY' ? companyCredit : personalCredit)}
                  </p>
                </div>

                <div>
                  <Label>Payment Mode</Label>
                  <Select 
                    value={settlementForm.paymentMode} 
                    onValueChange={(v) => setSettlementForm({ ...settlementForm, paymentMode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="ONLINE">Online Transfer</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Remarks (Optional)</Label>
                  <Textarea
                    value={settlementForm.remarks}
                    onChange={(e) => setSettlementForm({ ...settlementForm, remarks: e.target.value })}
                    placeholder="Add any notes..."
                    rows={2}
                  />
                </div>

                <Button 
                  className="w-full bg-purple-500 hover:bg-purple-600"
                  onClick={() => setShowSettlementDialog(true)}
                  disabled={companyCredit <= 0 && personalCredit <= 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Request Settlement
                </Button>
              </CardContent>
            </Card>

            {/* Settlement Info Card */}
            <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
              <CardContent className="p-6">
                <h3 className="font-semibold text-purple-800 mb-4">How Settlement Works</h3>
                <div className="space-y-4 text-sm text-purple-700">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold">1</span>
                    </div>
                    <p>Collect EMI payments from customers. Your credit increases automatically.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold">2</span>
                    </div>
                    <p>When you're ready to submit the collected money, request a settlement.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold">3</span>
                    </div>
                    <p>Super Admin will receive your settlement request and process it.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold">4</span>
                    </div>
                    <p>Once processed, your credit is cleared and transferred to Super Admin.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Transaction Detail Dialog - A-Z Details */}
      <Dialog open={showTransactionDetail} onOpenChange={setShowTransactionDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              Complete Transaction Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <ScrollArea className="max-h-[75vh]">
              <div className="space-y-6 pr-4">
                {/* Transaction Header */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        selectedTransaction.transactionType.includes('INCREASE') || selectedTransaction.transactionType.includes('COLLECTION')
                          ? 'bg-emerald-100'
                          : 'bg-red-100'
                      }`}>
                        {selectedTransaction.transactionType.includes('INCREASE') || selectedTransaction.transactionType.includes('COLLECTION') ? (
                          <PlusCircle className="h-7 w-7 text-emerald-600" />
                        ) : (
                          <MinusCircle className="h-7 w-7 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-xl">
                          {selectedTransaction.transactionType.includes('INCREASE') || selectedTransaction.transactionType.includes('COLLECTION') ? '+' : '-'}
                          {formatCurrency(selectedTransaction.amount)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {getTransactionTypeConfig(selectedTransaction.transactionType).label}
                        </p>
                      </div>
                    </div>
                    <Badge className={getTransactionTypeConfig(selectedTransaction.transactionType).className}>
                      {selectedTransaction.creditType} Credit
                    </Badge>
                  </div>
                </div>

                {/* Transaction ID & Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-500">Transaction ID</p>
                    <p className="font-mono text-sm">{selectedTransaction.id}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-gray-500">Date & Time</p>
                    <p className="font-medium">{formatDate(selectedTransaction.transactionDate)}</p>
                  </div>
                </div>

                {/* Payment Mode Section */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    {(() => {
                      const config = getPaymentModeConfig(selectedTransaction.paymentMode);
                      const Icon = config.icon;
                      return <Icon className={`h-5 w-5 ${config.color}`} />;
                    })()}
                    Payment Information
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Mode:</span>
                      <span className="font-medium">{selectedTransaction.paymentMode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Source Type:</span>
                      <span className="font-medium">{selectedTransaction.sourceType}</span>
                    </div>
                    {(selectedTransaction.chequeNumber || selectedTransaction.utrNumber || selectedTransaction.bankRefNumber) && (
                      <Separator />
                    )}
                    {selectedTransaction.chequeNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cheque Number:</span>
                        <span className="font-mono">{selectedTransaction.chequeNumber}</span>
                      </div>
                    )}
                    {selectedTransaction.chequeDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cheque Date:</span>
                        <span>{formatDateShort(selectedTransaction.chequeDate)}</span>
                      </div>
                    )}
                    {selectedTransaction.utrNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">UTR Number:</span>
                        <span className="font-mono">{selectedTransaction.utrNumber}</span>
                      </div>
                    )}
                    {selectedTransaction.bankRefNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bank Reference:</span>
                        <span className="font-mono">{selectedTransaction.bankRefNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer & Loan Details */}
                {selectedTransaction.customerName && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      Customer Details
                    </h4>
                    <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer Name:</span>
                        <span className="font-medium">{selectedTransaction.customerName}</span>
                      </div>
                      {selectedTransaction.customerPhone && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Phone:</span>
                          <a href={`tel:${selectedTransaction.customerPhone}`} className="text-blue-600 hover:underline">
                            {selectedTransaction.customerPhone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Loan & EMI Details */}
                {selectedTransaction.loanApplicationNo && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-purple-600" />
                      Loan & EMI Details
                    </h4>
                    <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Loan Application No:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-blue-600">{selectedTransaction.loanApplicationNo}</span>
                          {selectedTransaction.loanApplicationId && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7"
                              onClick={() => {
                                fetchLoanDetail(selectedTransaction.loanApplicationId!);
                              }}
                              disabled={loadingLoanDetail}
                            >
                              {loadingLoanDetail ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                              <span className="ml-1">View Loan</span>
                            </Button>
                          )}
                        </div>
                      </div>
                      {selectedTransaction.installmentNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">EMI Number:</span>
                          <Badge className="bg-purple-100 text-purple-700">#{selectedTransaction.installmentNumber}</Badge>
                        </div>
                      )}
                      {selectedTransaction.emiAmount && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">EMI Amount:</span>
                          <span className="font-bold">{formatCurrency(selectedTransaction.emiAmount)}</span>
                        </div>
                      )}
                      {selectedTransaction.emiDueDate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">EMI Due Date:</span>
                          <span>{formatDateShort(selectedTransaction.emiDueDate)}</span>
                        </div>
                      )}
                      {selectedTransaction.principalComponent !== undefined && selectedTransaction.interestComponent !== undefined && (
                        <div className="pt-2 border-t border-purple-200">
                          <p className="text-xs text-gray-500 mb-2">Amount Breakup:</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-2 bg-white rounded-lg">
                              <p className="text-xs text-gray-500">Principal</p>
                              <p className="font-semibold">{formatCurrency(selectedTransaction.principalComponent)}</p>
                            </div>
                            <div className="text-center p-2 bg-white rounded-lg">
                              <p className="text-xs text-gray-500">Interest</p>
                              <p className="font-semibold">{formatCurrency(selectedTransaction.interestComponent)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Balance After */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                    Balance After Transaction
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-600">Company Credit</p>
                      <p className="text-xl font-bold text-emerald-700">{formatCurrency(selectedTransaction.companyBalanceAfter || 0)}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-600">Personal Credit</p>
                      <p className="text-xl font-bold text-amber-700">{formatCurrency(selectedTransaction.personalBalanceAfter || 0)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-600">Total Balance</p>
                      <p className="text-xl font-bold text-blue-700">{formatCurrency(selectedTransaction.balanceAfter)}</p>
                    </div>
                  </div>
                </div>

                {/* Proof Status */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-teal-600" />
                    Proof Status
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {selectedTransaction.proofDocument ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          {selectedTransaction.proofVerified ? (
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-600" />
                          )}
                          <Badge className={selectedTransaction.proofVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                            {selectedTransaction.proofVerified ? 'Proof Verified' : 'Pending Verification'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Proof Type:</span>
                          <span className="text-sm font-medium">{selectedTransaction.proofType || 'Document'}</span>
                        </div>
                        {selectedTransaction.proofUploadedAt && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Uploaded At:</span>
                            <span className="text-sm">{formatDate(selectedTransaction.proofUploadedAt)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <AlertCircle className="h-5 w-5" />
                        <span>No proof required for this transaction</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collection Details */}
                {(selectedTransaction.collectedFrom || selectedTransaction.collectionLocation) && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-red-600" />
                      Collection Details
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      {selectedTransaction.collectedFrom && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Collected From:</span>
                          <span>{selectedTransaction.collectedFrom}</span>
                        </div>
                      )}
                      {selectedTransaction.collectedFromPhone && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Contact:</span>
                          <a href={`tel:${selectedTransaction.collectedFromPhone}`} className="text-blue-600 hover:underline">
                            {selectedTransaction.collectedFromPhone}
                          </a>
                        </div>
                      )}
                      {selectedTransaction.collectionLocation && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Location:</span>
                          <span>{selectedTransaction.collectionLocation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Remarks */}
                {selectedTransaction.remarks && (
                  <div>
                    <h4 className="font-semibold mb-3">Remarks</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">{selectedTransaction.remarks}</p>
                  </div>
                )}

                {/* Description */}
                {selectedTransaction.description && (
                  <div>
                    <h4 className="font-semibold mb-3">Description</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">{selectedTransaction.description}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Loan Detail Dialog - A-Z Loan Details */}
      <Dialog open={showLoanDetailDialog} onOpenChange={setShowLoanDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-purple-600" />
              Complete Loan Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedLoan && (
            <ScrollArea className="max-h-[75vh]">
              <div className="space-y-6 pr-4">
                {/* Loan Header */}
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">Loan Application</p>
                      <p className="text-2xl font-bold">{selectedLoan.applicationNo}</p>
                      <Badge className="mt-2 bg-white/20 text-white">{selectedLoan.loanType}</Badge>
                    </div>
                    <Badge className="bg-white text-purple-700 text-lg px-4 py-2">
                      {selectedLoan.status}
                    </Badge>
                  </div>
                </div>

                {/* Customer Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Name</p>
                        <p className="font-medium">{selectedLoan.customer?.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <a href={`mailto:${selectedLoan.customer?.email}`} className="text-blue-600 hover:underline">
                          {selectedLoan.customer?.email}
                        </a>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <a href={`tel:${selectedLoan.customer?.phone}`} className="text-blue-600 hover:underline">
                          {selectedLoan.customer?.phone}
                        </a>
                      </div>
                      {selectedLoan.customer?.address && (
                        <div className="col-span-2 md:col-span-3">
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-medium">
                            {selectedLoan.customer.address}
                            {selectedLoan.customer.city && `, ${selectedLoan.customer.city}`}
                            {selectedLoan.customer.state && `, ${selectedLoan.customer.state}`}
                            {selectedLoan.customer.pincode && ` - ${selectedLoan.customer.pincode}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Loan Details */}
                {selectedLoan.sessionForm && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-emerald-600" />
                        Loan Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-emerald-50 p-4 rounded-lg text-center">
                          <p className="text-xs text-gray-500">Approved Amount</p>
                          <p className="text-xl font-bold text-emerald-700">
                            {formatCurrency(selectedLoan.sessionForm.approvedAmount)}
                          </p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                          <p className="text-xs text-gray-500">Interest Rate</p>
                          <p className="text-xl font-bold text-blue-700">
                            {selectedLoan.sessionForm.interestRate}% p.a.
                          </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg text-center">
                          <p className="text-xs text-gray-500">Tenure</p>
                          <p className="text-xl font-bold text-purple-700">
                            {selectedLoan.sessionForm.tenure} months
                          </p>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg text-center">
                          <p className="text-xs text-gray-500">EMI Amount</p>
                          <p className="text-xl font-bold text-amber-700">
                            {formatCurrency(selectedLoan.sessionForm.emiAmount)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-gray-500">Total Amount</p>
                          <p className="font-medium">{formatCurrency(selectedLoan.sessionForm.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Total Interest</p>
                          <p className="font-medium">{formatCurrency(selectedLoan.sessionForm.totalInterest)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Processing Fee</p>
                          <p className="font-medium">{formatCurrency(selectedLoan.sessionForm.processingFee)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* EMI Schedule */}
                {selectedLoan.emiSchedules && selectedLoan.emiSchedules.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-purple-600" />
                        EMI Schedule ({selectedLoan.emiSchedules.length} installments)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">EMI</TableHead>
                            <TableHead className="text-right">Principal</TableHead>
                            <TableHead className="text-right">Interest</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedLoan.emiSchedules.map((emi) => (
                            <TableRow key={emi.id}>
                              <TableCell className="font-medium">{emi.installmentNumber}</TableCell>
                              <TableCell>{formatDateShort(emi.dueDate)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(emi.totalAmount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(emi.principalAmount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(emi.interestAmount)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(emi.paidAmount)}</TableCell>
                              <TableCell>{getPaymentStatusBadge(emi.paymentStatus)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Payment History */}
                {selectedLoan.payments && selectedLoan.payments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-teal-600" />
                        Payment History ({selectedLoan.payments.length} payments)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedLoan.payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>{formatDateShort(payment.createdAt)}</TableCell>
                              <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                              <TableCell>{payment.paymentMode}</TableCell>
                              <TableCell>
                                <Badge className={payment.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                  {payment.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-600" />
                      Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        <div>
                          <p className="text-sm font-medium">Application Created</p>
                          <p className="text-xs text-gray-500">{formatDate(selectedLoan.createdAt)}</p>
                        </div>
                      </div>
                      {selectedLoan.disbursedAt && (
                        <div className="flex items-center gap-4">
                          <div className="w-3 h-3 bg-green-500 rounded-full" />
                          <div>
                            <p className="text-sm font-medium">Disbursed</p>
                            <p className="text-xs text-gray-500">{formatDate(selectedLoan.disbursedAt)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Settlement Confirmation Dialog */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-purple-600" />
              Confirm Settlement Request
            </DialogTitle>
            <DialogDescription>
              Submit your credit for clearance by Super Admin
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-purple-700">Amount to Settle:</span>
                <span className="text-xl font-bold text-purple-800">
                  {formatCurrency(settlementForm.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-purple-700">Credit Type:</span>
                <Badge className={settlementForm.creditType === 'COMPANY' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                  {settlementForm.creditType}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-purple-700">Payment Mode:</span>
                <span className="font-medium">{settlementForm.paymentMode}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                After submission, Super Admin will review and process your settlement. Your credit will be cleared once approved.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettlementDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-purple-500 hover:bg-purple-600"
              onClick={handleRequestSettlement}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
