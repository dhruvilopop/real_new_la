'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Wallet, Building, User, ArrowRight, IndianRupee, Clock, CheckCircle, XCircle,
  Banknote, FileText, TrendingUp, TrendingDown, RefreshCw, Loader2, AlertCircle,
  CreditCard, ArrowUpRight, ArrowDownRight, History, Plus, Minus
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface CreditTransaction {
  id: string;
  transactionType: string;
  amount: number;
  paymentMode: string;
  creditType: string;
  description: string;
  balanceAfter: number;
  companyBalanceAfter: number;
  personalBalanceAfter: number;
  createdAt: string;
  sourceType: string;
  proofDocument?: string;
  proofVerified: boolean;
  remarks?: string;
  user?: {
    id: string;
    name: string;
    role: string;
  };
}

interface Settlement {
  id: string;
  settlementNumber: string;
  amount: number;
  paymentMode: string;
  status: string;
  createdAt: string;
  remarks?: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    personalCredit: number;
    companyCredit: number;
  };
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  currentBalance: number;
  isActive: boolean;
}

export default function SuperAdminMyCredit() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [personalCredit, setPersonalCredit] = useState(0);
  const [companyCredit, setCompanyCredit] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<Settlement[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dialogs
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [showBankTransferDialog, setShowBankTransferDialog] = useState(false);
  const [showMinusCreditDialog, setShowMinusCreditDialog] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Forms
  const [settlementCreditType, setSettlementCreditType] = useState('COMPANY');
  const [settlementNotes, setSettlementNotes] = useState('');
  
  const [transferForm, setTransferForm] = useState({
    bankAccountId: '',
    amount: 0,
    creditType: 'COMPANY',
    reference: '',
    notes: ''
  });
  
  const [minusForm, setMinusForm] = useState({
    amount: 0,
    creditType: 'COMPANY',
    notes: ''
  });

  useEffect(() => {
    fetchCreditData();
    fetchPendingSettlements();
    fetchBankAccounts();
  }, [user?.id]);

  const fetchCreditData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/credit?userId=${user.id}&action=summary`);
      const data = await response.json();
      if (data.success) {
        setPersonalCredit(data.summary?.personalCredit || 0);
        setCompanyCredit(data.summary?.companyCredit || 0);
      }
      
      // Fetch transactions
      const txResponse = await fetch(`/api/credit?userId=${user.id}&limit=20`);
      const txData = await txResponse.json();
      if (txData.success) {
        setTransactions(txData.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching credit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingSettlements = async () => {
    try {
      const response = await fetch('/api/credit/settlement?action=pending');
      const data = await response.json();
      if (data.success) {
        setPendingSettlements(data.settlements || []);
      }
    } catch (error) {
      console.error('Error fetching settlements:', error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/accounting/bank-accounts');
      const data = await response.json();
      if (data.success) {
        setBankAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const handleCompleteSettlement = async () => {
    if (!selectedSettlement || !user?.id) return;
    
    setProcessing(true);
    try {
      const response = await fetch('/api/credit/settlement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementId: selectedSettlement.id,
          action: 'complete',
          superAdminId: user.id,
          creditType: settlementCreditType,
          notes: settlementNotes
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Settlement Completed',
          description: `₹${formatCurrency(selectedSettlement.amount)} received. Credit updated successfully.`
        });
        setShowSettlementDialog(false);
        setSelectedSettlement(null);
        setSettlementNotes('');
        fetchCreditData();
        fetchPendingSettlements();
      } else {
        throw new Error(data.error || 'Failed to complete settlement');
      }
    } catch (error) {
      console.error('Error completing settlement:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to complete settlement',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectSettlement = async () => {
    if (!selectedSettlement || !user?.id) return;
    
    setProcessing(true);
    try {
      const response = await fetch('/api/credit/settlement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementId: selectedSettlement.id,
          action: 'reject',
          superAdminId: user.id,
          notes: settlementNotes
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Settlement Rejected',
          description: 'The settlement request has been rejected.'
        });
        setShowSettlementDialog(false);
        setSelectedSettlement(null);
        setSettlementNotes('');
        fetchPendingSettlements();
      } else {
        throw new Error(data.error || 'Failed to reject settlement');
      }
    } catch (error) {
      console.error('Error rejecting settlement:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject settlement',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBankTransfer = async () => {
    if (!user?.id) return;
    if (transferForm.amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    
    const availableCredit = transferForm.creditType === 'COMPANY' ? companyCredit : personalCredit;
    if (transferForm.amount > availableCredit) {
      toast({ title: 'Insufficient Credit', description: `Available: ₹${formatCurrency(availableCredit)}`, variant: 'destructive' });
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch('/api/credit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: transferForm.amount,
          paymentMode: 'BANK_TRANSFER',
          creditType: transferForm.creditType,
          clearPersonalCredit: transferForm.creditType === 'PERSONAL',
          bankRefNumber: transferForm.reference,
          remarks: `Bank Transfer - ${transferForm.notes}`
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Transfer Recorded',
          description: `₹${formatCurrency(transferForm.amount)} transferred to bank account.`
        });
        setShowBankTransferDialog(false);
        setTransferForm({ bankAccountId: '', amount: 0, creditType: 'COMPANY', reference: '', notes: '' });
        fetchCreditData();
      } else {
        throw new Error(data.error || 'Failed to record transfer');
      }
    } catch (error) {
      console.error('Error recording bank transfer:', error);
      toast({
        title: 'Error',
        description: 'Failed to record bank transfer',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleMinusCredit = async () => {
    if (!user?.id) return;
    if (minusForm.amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    
    const availableCredit = minusForm.creditType === 'COMPANY' ? companyCredit : personalCredit;
    if (minusForm.amount > availableCredit) {
      toast({ title: 'Insufficient Credit', description: `Available: ₹${formatCurrency(availableCredit)}`, variant: 'destructive' });
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch('/api/credit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: minusForm.amount,
          paymentMode: 'CASH',
          creditType: minusForm.creditType,
          clearPersonalCredit: minusForm.creditType === 'PERSONAL',
          remarks: `Credit Adjustment - ${minusForm.notes}`
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Credit Adjusted',
          description: `₹${formatCurrency(minusForm.amount)} deducted from ${minusForm.creditType.toLowerCase()} credit.`
        });
        setShowMinusCreditDialog(false);
        setMinusForm({ amount: 0, creditType: 'COMPANY', notes: '' });
        fetchCreditData();
      } else {
        throw new Error(data.error || 'Failed to adjust credit');
      }
    } catch (error) {
      console.error('Error adjusting credit:', error);
      toast({
        title: 'Error',
        description: 'Failed to adjust credit',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'CREDIT_INCREASE':
      case 'PERSONAL_COLLECTION':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'CREDIT_DECREASE':
      case 'PERSONAL_CLEARANCE':
        return <ArrowDownRight className="h-4 w-4 text-red-600" />;
      default:
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      CREDIT_INCREASE: 'Credit Received',
      PERSONAL_COLLECTION: 'Personal Collection',
      CREDIT_DECREASE: 'Credit Decreased',
      PERSONAL_CLEARANCE: 'Personal Cleared',
      ADJUSTMENT: 'Adjustment'
    };
    return labels[type] || type;
  };

  const totalCredit = companyCredit + personalCredit;

  return (
    <div className="space-y-6">
      {/* Credit Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Total Credit</p>
                  <p className="text-3xl font-bold mt-1">₹{formatCurrency(totalCredit)}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Wallet className="h-6 w-6" />
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
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Company Credit</p>
                  <p className="text-3xl font-bold mt-1">₹{formatCurrency(companyCredit)}</p>
                  <p className="text-blue-200 text-xs mt-1">From CASH payments</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Building className="h-6 w-6" />
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
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">Personal Credit</p>
                  <p className="text-3xl font-bold mt-1">₹{formatCurrency(personalCredit)}</p>
                  <p className="text-amber-200 text-xs mt-1">From non-CASH payments</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <User className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setShowBankTransferDialog(true)}
            >
              <Banknote className="h-4 w-4" />
              Transfer to Bank
            </Button>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setShowMinusCreditDialog(true)}
            >
              <Minus className="h-4 w-4" />
              Minus Credit
            </Button>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => fetchCreditData()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settlements">
            Pending Settlements
            {pendingSettlements.length > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">{pendingSettlements.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION') 
                            ? 'bg-green-100' 
                            : 'bg-red-100'
                        }`}>
                          {getTransactionIcon(tx.transactionType)}
                        </div>
                        <div>
                          <p className="font-medium">{getTransactionLabel(tx.transactionType)}</p>
                          <p className="text-xs text-gray-500">{tx.description}</p>
                          <p className="text-xs text-gray-400">{formatDate(tx.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${
                          tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION')
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION') ? '+' : '-'}₹{formatCurrency(tx.amount)}
                        </p>
                        <p className="text-xs text-gray-500">{tx.creditType}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlements" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Settlement Requests
              </CardTitle>
              <CardDescription>
                Roles who want to clear their credit by giving you money
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingSettlements.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-300" />
                  <p className="text-lg font-medium">No pending settlements</p>
                  <p className="text-sm">All settlement requests have been processed</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingSettlements.map((settlement) => (
                    <motion.div
                      key={settlement.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 border rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                            <IndianRupee className="h-6 w-6 text-amber-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-lg">₹{formatCurrency(settlement.amount)}</p>
                              <Badge className="bg-amber-100 text-amber-700">{settlement.paymentMode}</Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              From: <strong>{settlement.user.name}</strong> ({settlement.user.role})
                            </p>
                            <p className="text-xs text-gray-500">{settlement.user.email}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              Requested: {formatDate(settlement.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right text-sm">
                            <p className="text-gray-500">Available Credit:</p>
                            <p className="text-blue-600">Company: ₹{formatCurrency(settlement.user.companyCredit)}</p>
                            <p className="text-amber-600">Personal: ₹{formatCurrency(settlement.user.personalCredit)}</p>
                          </div>
                          <Button
                            className="bg-emerald-500 hover:bg-emerald-600"
                            onClick={() => {
                              setSelectedSettlement(settlement);
                              setShowSettlementDialog(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Process
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 border-b">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION')
                              ? 'bg-green-100'
                              : 'bg-red-100'
                          }`}>
                            {getTransactionIcon(tx.transactionType)}
                          </div>
                          <div>
                            <p className="font-medium">{getTransactionLabel(tx.transactionType)}</p>
                            <p className="text-sm text-gray-500">{tx.description}</p>
                            <p className="text-xs text-gray-400">{formatDate(tx.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${
                            tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION')
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {tx.transactionType.includes('INCREASE') || tx.transactionType.includes('COLLECTION') ? '+' : '-'}₹{formatCurrency(tx.amount)}
                          </p>
                          <p className="text-xs text-gray-500">{tx.creditType}</p>
                          <p className="text-xs text-gray-400">Balance: ₹{formatCurrency(tx.balanceAfter)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settlement Dialog */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              Process Settlement
            </DialogTitle>
            <DialogDescription>
              Receive ₹{formatCurrency(selectedSettlement?.amount || 0)} from {selectedSettlement?.user?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-700">
                When you complete this settlement, the role's credit will be <strong>decreased</strong> and your credit will be <strong>increased</strong> by the same amount.
              </p>
            </div>
            
            <div>
              <Label>Credit Type to Clear</Label>
              <Select value={settlementCreditType} onValueChange={setSettlementCreditType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Company Credit (from CASH)</SelectItem>
                  <SelectItem value="PERSONAL">Personal Credit (from non-CASH)</SelectItem>
                </SelectContent>
              </Select>
              {selectedSettlement && (
                <p className="text-xs text-gray-500 mt-1">
                  Available: ₹{formatCurrency(settlementCreditType === 'COMPANY' ? selectedSettlement.user.companyCredit : selectedSettlement.user.personalCredit)}
                </p>
              )}
            </div>
            
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                placeholder="Add any notes..."
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50"
              onClick={handleRejectSettlement}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600"
              onClick={handleCompleteSettlement}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Complete Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Transfer Dialog */}
      <Dialog open={showBankTransferDialog} onOpenChange={setShowBankTransferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-blue-600" />
              Transfer to Bank Account
            </DialogTitle>
            <DialogDescription>
              Record a transfer of credit to a bank account
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Credit Type</Label>
              <Select 
                value={transferForm.creditType} 
                onValueChange={(v) => setTransferForm({ ...transferForm, creditType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Company Credit (₹{formatCurrency(companyCredit)})</SelectItem>
                  <SelectItem value="PERSONAL">Personal Credit (₹{formatCurrency(personalCredit)})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={transferForm.amount || ''}
                onChange={(e) => setTransferForm({ ...transferForm, amount: parseFloat(e.target.value) || 0 })}
                placeholder="Enter amount"
              />
            </div>
            
            <div>
              <Label>Bank Reference</Label>
              <Input
                value={transferForm.reference}
                onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })}
                placeholder="Transaction ID / Reference number"
              />
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                placeholder="Add notes..."
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBankTransferDialog(false)}>Cancel</Button>
            <Button onClick={handleBankTransfer} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Banknote className="h-4 w-4 mr-2" />}
              Record Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Minus Credit Dialog */}
      <Dialog open={showMinusCreditDialog} onOpenChange={setShowMinusCreditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Minus className="h-5 w-5 text-red-600" />
              Minus Credit
            </DialogTitle>
            <DialogDescription>
              Deduct credit with a note (adjustment)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                This will decrease your credit balance. Use this for adjustments or corrections.
              </p>
            </div>
            
            <div>
              <Label>Credit Type</Label>
              <Select 
                value={minusForm.creditType} 
                onValueChange={(v) => setMinusForm({ ...minusForm, creditType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Company Credit (₹{formatCurrency(companyCredit)})</SelectItem>
                  <SelectItem value="PERSONAL">Personal Credit (₹{formatCurrency(personalCredit)})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={minusForm.amount || ''}
                onChange={(e) => setMinusForm({ ...minusForm, amount: parseFloat(e.target.value) || 0 })}
                placeholder="Enter amount"
              />
            </div>
            
            <div>
              <Label>Reason / Note *</Label>
              <Textarea
                value={minusForm.notes}
                onChange={(e) => setMinusForm({ ...minusForm, notes: e.target.value })}
                placeholder="Explain why you're deducting credit..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMinusCreditDialog(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleMinusCredit} 
              disabled={processing || !minusForm.notes}
            >
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Minus className="h-4 w-4 mr-2" />}
              Deduct Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
