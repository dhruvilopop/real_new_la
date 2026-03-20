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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Banknote, FileText, CheckCircle, XCircle, Clock, Users, Eye, TrendingUp, DollarSign, 
  CreditCard, Building2, ArrowRight, AlertCircle, Receipt, Send, Activity, Loader2,
  User, Mail, Phone, MapPin, Briefcase, FileCheck, Wallet, Landmark, AlertTriangle,
  ChevronDown, ChevronUp, Calendar, Percent, Hash
} from 'lucide-react';
import { formatCurrency, formatDate, generateTransactionId, generateReceiptNumber } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import PaymentRequestsSection from '@/components/payment/PaymentRequestsSection';
import SecondaryPaymentPagesSection from '@/components/payment/SecondaryPaymentPagesSection';

interface Loan {
  id: string; applicationNo: string; status: string; requestedAmount: number; loanType: string;
  createdAt: string; riskScore: number; fraudFlag: boolean; purpose: string;
  customer: { id: string; name: string; email: string; phone: string; };
  sessionForm?: any; loanForm?: any; company?: any;
  requestedTenure?: number; requestedInterestRate?: number;
  disbursedAmount?: number; disbursedAt?: string; disbursementMode?: string; disbursementRef?: string;
  firstName?: string; lastName?: string; middleName?: string;
  phone?: string; address?: string; city?: string; state?: string; pincode?: string;
  panNumber?: string; aadhaarNumber?: string; dateOfBirth?: string;
  employmentType?: string; employerName?: string; monthlyIncome?: number;
  bankAccountNumber?: string; bankIfsc?: string; bankName?: string;
  bankBranch?: string; accountHolderName?: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  currentBalance: number;
  ifscCode?: string;
  branchName?: string;
  isDefault: boolean;
}

export default function CashierDashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showDisbursementDialog, setShowDisbursementDialog] = useState(false);
  const [showLoanDetailPanel, setShowLoanDetailPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [saving, setSaving] = useState(false);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  // Disbursement form state
  const [disbursementForm, setDisbursementForm] = useState({
    disbursedAmount: 0,
    disbursementMode: 'BANK_TRANSFER',
    disbursementRef: '',
    remarks: '',
    selectedBankAccountId: '',
    agreementSigned: false
  });
  
  // Expanded loan details in disbursement dialog
  const [expandedSections, setExpandedSections] = useState({
    customer: true,
    loan: true,
    bank: true,
    employment: false,
    references: false
  });

  // Daily limits
  const dailyLimit = (user as any)?.dailyLimit || 500000;
  const todayDisbursed = 0;
  const remainingLimit = dailyLimit - todayDisbursed;

  useEffect(() => {
    fetchLoans();
    fetchActiveLoans();
    fetchBankAccounts();
  }, [user]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/loan/list?role=CASHIER');
      const data = await response.json();
      setLoans(data.loans || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveLoans = async () => {
    try {
      const response = await fetch('/api/loan/all-active');
      const data = await response.json();
      setActiveLoans(data.loans || []);
    } catch (error) {
      console.error('Error fetching active loans:', error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/accounting/bank?action=list');
      const data = await response.json();
      if (data.success) {
        setBankAccounts(data.data || []);
        // Set default bank account
        const defaultAccount = data.data?.find((a: BankAccount) => a.isDefault);
        if (defaultAccount) {
          setDisbursementForm(prev => ({ ...prev, selectedBankAccountId: defaultAccount.id }));
        }
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const openDisbursementDialog = async (loan: Loan) => {
    // Fetch full loan details
    try {
      const response = await fetch(`/api/loan/details?loanId=${loan.id}`);
      const data = await response.json();
      if (data.success && data.loan) {
        setSelectedLoan({ ...loan, ...data.loan });
      } else {
        setSelectedLoan(loan);
      }
    } catch {
      setSelectedLoan(loan);
    }
    
    setDisbursementForm({
      disbursedAmount: loan.sessionForm?.approvedAmount || loan.requestedAmount,
      disbursementMode: 'BANK_TRANSFER',
      disbursementRef: generateTransactionId(),
      remarks: '',
      selectedBankAccountId: bankAccounts.find(a => a.isDefault)?.id || '',
      agreementSigned: false
    });
    setExpandedSections({
      customer: true,
      loan: true,
      bank: true,
      employment: false,
      references: false
    });
    setShowDisbursementDialog(true);
  };

  const handleDisburse = async () => {
    if (!selectedLoan) return;
    if (!disbursementForm.disbursedAmount || !disbursementForm.disbursementRef) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    if (!disbursementForm.agreementSigned) {
      toast({ title: 'Error', description: 'Please confirm that the loan agreement has been signed', variant: 'destructive' });
      return;
    }
    if (!disbursementForm.selectedBankAccountId) {
      toast({ title: 'Error', description: 'Please select a bank account for disbursement', variant: 'destructive' });
      return;
    }
    if (disbursementForm.disbursedAmount > remainingLimit) {
      toast({ title: 'Error', description: 'Amount exceeds daily limit', variant: 'destructive' });
      return;
    }
    
    // Check bank balance
    const selectedBank = bankAccounts.find(a => a.id === disbursementForm.selectedBankAccountId);
    if (selectedBank && selectedBank.currentBalance < disbursementForm.disbursedAmount) {
      toast({ 
        title: 'Insufficient Bank Balance', 
        description: `Bank account has only ${formatCurrency(selectedBank.currentBalance)}. Please add funds or select another account.`, 
        variant: 'destructive' 
      });
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          action: 'disburse',
          role: 'CASHIER',
          userId: user?.id,
          disbursementData: {
            amount: disbursementForm.disbursedAmount,
            mode: disbursementForm.disbursementMode,
            reference: disbursementForm.disbursementRef,
            bankAccountId: disbursementForm.selectedBankAccountId
          },
          remarks: disbursementForm.remarks,
          agreementSigned: disbursementForm.agreementSigned
        })
      });
      
      if (response.ok) {
        // Generate EMI schedule
        await fetch('/api/emi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loanId: selectedLoan.id })
        });

        toast({ 
          title: 'Disbursement Successful', 
          description: `${formatCurrency(disbursementForm.disbursedAmount)} disbursed to ${selectedLoan.customer?.name}` 
        });
        setShowDisbursementDialog(false);
        fetchLoans();
        fetchBankAccounts();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to disburse', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to process disbursement', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      FINAL_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Ready for Disbursement' },
      DISBURSED: { className: 'bg-blue-100 text-blue-700', label: 'Disbursed' },
      ACTIVE: { className: 'bg-green-100 text-green-700', label: 'Active' },
      SESSION_CREATED: { className: 'bg-amber-100 text-amber-700', label: 'Sanction Created' },
      CUSTOMER_SESSION_APPROVED: { className: 'bg-teal-100 text-teal-700', label: 'Customer Approved' },
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  // Filter loans
  const readyForDisbursement = loans.filter(l => l.status === 'FINAL_APPROVED');
  const disbursedToday = loans.filter(l => l.status === 'ACTIVE' && l.disbursedAt && new Date(l.disbursedAt).toDateString() === new Date().toDateString());
  const allDisbursed = loans.filter(l => ['ACTIVE', 'DISBURSED'].includes(l.status));

  const totalDisbursedToday = disbursedToday.reduce((sum, l) => sum + (l.disbursedAmount || l.sessionForm?.approvedAmount || 0), 0);
  const totalDisbursedAll = allDisbursed.reduce((sum, l) => sum + (l.disbursedAmount || l.sessionForm?.approvedAmount || 0), 0);

  const stats = [
    { label: 'Ready for Disbursement', value: readyForDisbursement.length, icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50', onClick: () => setActiveTab('pending') },
    { label: 'Today\'s Disbursement', value: formatCurrency(totalDisbursedToday), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Daily Limit', value: formatCurrency(remainingLimit), icon: Banknote, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total Disbursed', value: formatCurrency(totalDisbursedAll), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setActiveTab('history') }
  ];

  const menuItems = ROLE_MENU_ITEMS.CASHIER.map(item => ({
    ...item,
    count: item.id === 'pending' ? readyForDisbursement.length : 
           item.id === 'history' ? allDisbursed.length : 
           item.id === 'audit' ? allDisbursed.length :
           item.id === 'activeLoans' ? activeLoans.length : undefined
  }));

  const renderLoanCard = (loan: Loan, index: number, actions?: React.ReactNode) => (
    <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
      className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all bg-white">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 bg-gradient-to-br from-orange-400 to-red-500">
            <AvatarFallback className="bg-transparent text-white font-semibold">
              {loan.customer?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
              {getStatusBadge(loan.status)}
            </div>
            <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.email}</p>
            <p className="text-xs text-gray-400">{formatDate(loan.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.sessionForm?.approvedAmount || loan.requestedAmount)}</p>
            {loan.sessionForm && (
              <p className="text-xs text-gray-500">EMI: {formatCurrency(loan.sessionForm.emiAmount)}/mo</p>
            )}
          </div>
          {actions || (
            <Button size="sm" variant="outline" onClick={() => { setSelectedLoan(loan); setShowLoanDetailPanel(true); }}>
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'pending':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-600" />Ready for Disbursement
              </CardTitle>
              <CardDescription>Final approved loans awaiting disbursement</CardDescription>
            </CardHeader>
            <CardContent>
              {readyForDisbursement.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p>No loans pending disbursement</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {readyForDisbursement.map((loan, index) => renderLoanCard(loan, index,
                    <Button className="bg-green-500 hover:bg-green-600" onClick={() => openDisbursementDialog(loan)}>
                      <Send className="h-4 w-4 mr-2" />Disburse
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'history':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />Recent Disbursements
              </CardTitle>
              <CardDescription>History of disbursed loans</CardDescription>
            </CardHeader>
            <CardContent>
              {allDisbursed.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Banknote className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No disbursed loans yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {allDisbursed.map((loan, index) => renderLoanCard(loan, index))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'audit':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />Audit Logs
              </CardTitle>
              <CardDescription>Record of all disbursement activities</CardDescription>
            </CardHeader>
            <CardContent>
              {allDisbursed.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No audit logs available</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {allDisbursed.map((loan, index) => (
                    <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                      className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all bg-white">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
                              <Badge className="bg-green-100 text-green-700">Disbursed</Badge>
                            </div>
                            <p className="text-sm text-gray-500">{loan.customer?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.disbursedAmount || loan.sessionForm?.approvedAmount || loan.requestedAmount)}</p>
                            <p className="text-xs text-gray-500">Mode: {loan.disbursementMode || 'N/A'}</p>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            <p className="font-medium">{loan.disbursedAt ? formatDate(loan.disbursedAt) : 'N/A'}</p>
                            <p className="text-xs">Ref: {loan.disbursementRef || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'activeLoans':
        return (
          <div className="space-y-6">
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                  Active Loans
                </CardTitle>
                <CardDescription>All active loans with EMI details</CardDescription>
            </CardHeader>
            <CardContent>
              {activeLoans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Banknote className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No active loans found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {activeLoans.map((loan: any, index: number) => (
                    <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                      className="p-4 border border-gray-100 rounded-xl bg-white hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 bg-gradient-to-br from-emerald-400 to-teal-500">
                          <AvatarFallback className="bg-transparent text-white font-semibold">
                            {loan.customer?.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-gray-900">{loan.identifier}</h4>
                          <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.phone || loan.customer?.email}</p>
                          {loan.company && <p className="text-xs text-gray-400">Company: {loan.company.name}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.approvedAmount)}</p>
                          <p className="text-xs text-gray-500">{loan.interestRate}% • {loan.tenure} months</p>
                          {loan.emiAmount > 0 && <p className="text-xs text-emerald-600">EMI: {formatCurrency(loan.emiAmount)}/mo</p>}
                        </div>
                        <Button
                          size="sm"
                          className="bg-emerald-500 hover:bg-emerald-600"
                          onClick={() => { setSelectedLoan(loan); setShowLoanDetailPanel(true); }}
                        >
                          <Eye className="h-4 w-4 mr-1" />View
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        );

      case 'payment-pages':
        return (
          <div className="space-y-6">
            <SecondaryPaymentPagesSection userId={user?.id} />
          </div>
        );

      case 'paymentRequests':
        return (
          <div className="space-y-6">
            <PaymentRequestsSection cashierId={user?.id || ''} />
          </div>
        );

      case 'dashboard':
      default:
        return (
          <div className="space-y-6">
            {/* Bank Balance Summary */}
            {bankAccounts.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-blue-600" />
                    Bank Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    {bankAccounts.slice(0, 3).map(account => (
                      <div key={account.id} className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{account.bankName}</span>
                          {account.isDefault && <Badge className="bg-blue-500 text-xs">Default</Badge>}
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{account.accountNumber}</p>
                        <p className="text-xl font-bold text-blue-600">{formatCurrency(account.currentBalance)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Daily Limit Progress */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Daily Limit Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used: {formatCurrency(totalDisbursedToday)}</span>
                    <span>Limit: {formatCurrency(dailyLimit)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all" 
                      style={{ width: `${Math.min((totalDisbursedToday / dailyLimit) * 100, 100)}%` }} 
                    />
                  </div>
                  <p className="text-sm text-gray-500">Remaining: {formatCurrency(dailyLimit - totalDisbursedToday)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Pending Disbursements */}
            {readyForDisbursement.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-800">{readyForDisbursement.length} Loans Ready for Disbursement</h4>
                      <p className="text-sm text-green-600">Process disbursements to activate loans</p>
                    </div>
                    <Button className="bg-green-500 hover:bg-green-600" onClick={() => setActiveTab('pending')}>
                      Process
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Activity</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loans.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {loans.slice(0, 5).map((loan) => (
                      <div key={loan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-orange-100 text-orange-700">{loan.customer?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{loan.applicationNo}</p>
                            <p className="text-sm text-gray-500">{loan.customer?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(loan.status)}
                          <p className="font-semibold">{formatCurrency(loan.sessionForm?.approvedAmount || loan.requestedAmount)}</p>
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

  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <DashboardLayout
      title="Cashier Dashboard"
      subtitle="Process loan disbursements"
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      stats={stats}
      gradient="bg-gradient-to-br from-orange-500 to-red-600"
      logoIcon={Banknote}
    >
      {renderContent()}

      {/* Disbursement Dialog - Full Page Style */}
      <Dialog open={showDisbursementDialog} onOpenChange={setShowDisbursementDialog}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-0 gap-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 text-white">
                <Send className="h-6 w-6" /> Disburse Loan
              </DialogTitle>
              <DialogDescription className="text-green-100">
                {selectedLoan?.applicationNo} - {selectedLoan?.customer?.name}
              </DialogDescription>
            </DialogHeader>
          </div>

          <ScrollArea className="max-h-[calc(95vh-200px)]">
            {selectedLoan && (
              <div className="p-6 space-y-4">
                {/* Customer Information Section */}
                <Card className="border-0 shadow-sm">
                  <button 
                    onClick={() => toggleSection('customer')}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      Customer Information
                    </CardTitle>
                    {expandedSections.customer ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  <AnimatePresence>
                    {expandedSections.customer && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="pt-0">
                          <div className="flex items-start gap-4 mb-4">
                            <Avatar className="h-16 w-16 bg-gradient-to-br from-blue-400 to-indigo-500">
                              <AvatarFallback className="bg-transparent text-white text-xl">
                                {selectedLoan.customer?.name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold">{selectedLoan.customer?.name}</h3>
                              <p className="text-gray-500">{selectedLoan.customer?.email}</p>
                            </div>
                            {getStatusBadge(selectedLoan.status)}
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-500">Phone</p>
                                <p className="font-medium">{selectedLoan.customer?.phone || selectedLoan.phone}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-500">PAN</p>
                                <p className="font-medium">{selectedLoan.panNumber || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-500">Aadhaar</p>
                                <p className="font-medium">{selectedLoan.aadhaarNumber ? `XXXX-XXXX-${selectedLoan.aadhaarNumber.slice(-4)}` : 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-500">Address</p>
                                <p className="font-medium text-sm">{selectedLoan.address || selectedLoan.city || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-500">DOB</p>
                                <p className="font-medium">{selectedLoan.dateOfBirth ? formatDate(selectedLoan.dateOfBirth) : 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-500">Employment</p>
                                <p className="font-medium">{selectedLoan.employmentType || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>

                {/* Loan Details Section */}
                <Card className="border-0 shadow-sm">
                  <button 
                    onClick={() => toggleSection('loan')}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                      Loan Details
                    </CardTitle>
                    {expandedSections.loan ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  <AnimatePresence>
                    {expandedSections.loan && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-4 gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg text-center">
                              <p className="text-xs text-gray-500 mb-1">Requested</p>
                              <p className="text-xl font-bold">{formatCurrency(selectedLoan.requestedAmount)}</p>
                              <p className="text-xs text-gray-400">{selectedLoan.requestedTenure} mo @ {selectedLoan.requestedInterestRate}%</p>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-lg text-center border-2 border-emerald-200">
                              <p className="text-xs text-emerald-600 mb-1">Approved</p>
                              <p className="text-xl font-bold text-emerald-700">{formatCurrency(selectedLoan.sessionForm?.approvedAmount || selectedLoan.requestedAmount)}</p>
                              <p className="text-xs text-emerald-500">{selectedLoan.sessionForm?.tenure} mo @ {selectedLoan.sessionForm?.interestRate}%</p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg text-center">
                              <p className="text-xs text-blue-600 mb-1">EMI Amount</p>
                              <p className="text-xl font-bold text-blue-700">{formatCurrency(selectedLoan.sessionForm?.emiAmount || 0)}</p>
                              <p className="text-xs text-blue-500">/month</p>
                            </div>
                            <div className="p-4 bg-purple-50 rounded-lg text-center">
                              <p className="text-xs text-purple-600 mb-1">Total Interest</p>
                              <p className="text-xl font-bold text-purple-700">{formatCurrency(selectedLoan.sessionForm?.totalInterest || 0)}</p>
                              <p className="text-xs text-purple-500">Total Payable: {formatCurrency(selectedLoan.sessionForm?.totalAmount || 0)}</p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Loan Type</p>
                              <p className="font-medium">{selectedLoan.loanType}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Purpose</p>
                              <p className="font-medium">{selectedLoan.purpose || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Processing Fee</p>
                              <p className="font-medium">{formatCurrency(selectedLoan.sessionForm?.processingFee || 0)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>

                {/* Bank Account Details */}
                <Card className="border-0 shadow-sm">
                  <button 
                    onClick={() => toggleSection('bank')}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <CardTitle className="text-base flex items-center gap-2">
                      <Landmark className="h-5 w-5 text-purple-600" />
                      Bank Account Details
                    </CardTitle>
                    {expandedSections.bank ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  <AnimatePresence>
                    {expandedSections.bank && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Account Holder</p>
                              <p className="font-medium">{selectedLoan.accountHolderName || selectedLoan.customer?.name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Bank Name</p>
                              <p className="font-medium">{selectedLoan.bankName || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Account Number</p>
                              <p className="font-medium">{selectedLoan.bankAccountNumber || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">IFSC Code</p>
                              <p className="font-medium">{selectedLoan.bankIfsc || 'N/A'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>

                <Separator />

                {/* Disbursement Form */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg flex items-center gap-2">
                    <Send className="h-5 w-5 text-green-600" />
                    Disbursement Details
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Disbursement Amount (₹) *</Label>
                      <Input 
                        type="number" 
                        value={disbursementForm.disbursedAmount} 
                        onChange={(e) => setDisbursementForm({...disbursementForm, disbursedAmount: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                    <div>
                      <Label>Disbursement Mode *</Label>
                      <Select value={disbursementForm.disbursementMode} onValueChange={(v) => setDisbursementForm({...disbursementForm, disbursementMode: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</SelectItem>
                          <SelectItem value="CHEQUE">Cheque</SelectItem>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Transaction Reference *</Label>
                      <Input 
                        value={disbursementForm.disbursementRef} 
                        onChange={(e) => setDisbursementForm({...disbursementForm, disbursementRef: e.target.value})} 
                        placeholder="UTR/Transaction ID"
                      />
                    </div>
                    <div>
                      <Label>Select Bank Account for Disbursement *</Label>
                      <Select 
                        value={disbursementForm.selectedBankAccountId} 
                        onValueChange={(v) => setDisbursementForm({...disbursementForm, selectedBankAccountId: v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank account" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map(account => (
                            <SelectItem key={account.id} value={account.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{account.bankName} - {account.accountNumber}</span>
                                <span className="ml-2 text-xs text-gray-500">Bal: {formatCurrency(account.currentBalance)}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Bank Balance Warning */}
                  {disbursementForm.selectedBankAccountId && (() => {
                    const selectedBank = bankAccounts.find(a => a.id === disbursementForm.selectedBankAccountId);
                    if (selectedBank && selectedBank.currentBalance < disbursementForm.disbursedAmount) {
                      return (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-700">Insufficient Bank Balance</p>
                            <p className="text-sm text-red-600">
                              Selected bank account has only {formatCurrency(selectedBank.currentBalance)}. 
                              You need {formatCurrency(disbursementForm.disbursedAmount - selectedBank.currentBalance)} more.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Selected Bank Balance Display */}
                  {disbursementForm.selectedBankAccountId && (() => {
                    const selectedBank = bankAccounts.find(a => a.id === disbursementForm.selectedBankAccountId);
                    if (selectedBank && selectedBank.currentBalance >= disbursementForm.disbursedAmount) {
                      return (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Landmark className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="font-medium text-green-700">{selectedBank.bankName}</p>
                              <p className="text-sm text-green-600">Current Balance: {formatCurrency(selectedBank.currentBalance)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-green-600">After Disbursement</p>
                            <p className="font-bold text-green-700">{formatCurrency(selectedBank.currentBalance - disbursementForm.disbursedAmount)}</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div>
                    <Label>Remarks</Label>
                    <Textarea 
                      value={disbursementForm.remarks} 
                      onChange={(e) => setDisbursementForm({...disbursementForm, remarks: e.target.value})} 
                      placeholder="Any additional notes..."
                      rows={2}
                    />
                  </div>

                  {/* Agreement Checkbox */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="agreement-signed"
                        checked={disbursementForm.agreementSigned}
                        onCheckedChange={(checked) => setDisbursementForm({...disbursementForm, agreementSigned: checked as boolean})}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor="agreement-signed" className="font-medium text-amber-800 cursor-pointer">
                          ✓ I confirm that the loan agreement form has been signed
                        </label>
                        <p className="text-sm text-amber-600 mt-1">
                          The customer has signed all necessary loan documents and agreement forms before disbursement.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Warning for limit */}
                  {disbursementForm.disbursedAmount > remainingLimit && (
                    <div className="p-3 bg-red-50 rounded-lg text-red-700 text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Amount exceeds your daily limit of {formatCurrency(dailyLimit)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-6 border-t">
            <Button variant="outline" onClick={() => setShowDisbursementDialog(false)}>Cancel</Button>
            <Button 
              className="bg-green-500 hover:bg-green-600" 
              onClick={handleDisburse} 
              disabled={saving || !disbursementForm.agreementSigned}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Confirm Disbursement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan Detail Panel */}
      {selectedLoan && showLoanDetailPanel && (
        <LoanDetailPanel
          loanId={selectedLoan.id}
          open={showLoanDetailPanel}
          onClose={() => { setShowLoanDetailPanel(false); setSelectedLoan(null); }}
          onEMIPaid={() => { fetchLoans(); fetchActiveLoans(); }}
        />
      )}
    </DashboardLayout>
  );
}

// Loan Detail Panel Component
function LoanDetailPanel({ loanId, open, onClose, onEMIPaid }: { 
  loanId: string; 
  open: boolean; 
  onClose: () => void; 
  onEMIPaid?: () => void;
}) {
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loanId && open) {
      fetchLoanDetails();
    }
  }, [loanId, open]);

  const fetchLoanDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/loan/details?loanId=${loanId}`);
      const data = await response.json();
      if (data.success) {
        setLoan(data.loan);
      }
    } catch (error) {
      console.error('Error fetching loan details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {/* Backdrop Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <motion.div
        key={loanId || 'cashier-loan-panel'}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div>
            <h2 className="font-bold text-lg">Loan Details</h2>
            <p className="text-sm text-white/80">{loan?.applicationNo || loanId}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <XCircle className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : loan ? (
            <div className="p-4 space-y-4">
              {/* Customer Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Customer</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">{loan.customer?.name}</p>
                  <p className="text-sm text-gray-500">{loan.customer?.email}</p>
                  <p className="text-sm text-gray-500">{loan.customer?.phone}</p>
                </CardContent>
              </Card>

              {/* Loan Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Loan Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Amount</p>
                      <p className="font-semibold">{formatCurrency(loan.sessionForm?.approvedAmount || loan.requestedAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">EMI</p>
                      <p className="font-semibold">{formatCurrency(loan.sessionForm?.emiAmount)}/mo</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Interest</p>
                      <p className="font-semibold">{loan.sessionForm?.interestRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Tenure</p>
                      <p className="font-semibold">{loan.sessionForm?.tenure} months</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Loan not found
            </div>
          )}
        </ScrollArea>
      </motion.div>
    </AnimatePresence>
  );
}
