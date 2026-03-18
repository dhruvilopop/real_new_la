'use client';

import { useState, useEffect } from 'react';
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
import { 
  Wallet, Building, User, Users, ArrowDown, ArrowUp, ArrowLeftRight, 
  Eye, RefreshCw, CreditCard, Banknote, FileText, Download,
  Loader2, CheckCircle, AlertCircle, TrendingUp, TrendingDown,
  Send, Receipt, Landmark
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface UserWithCredit {
  id: string;
  name: string;
  email: string;
  role: string;
  personalCredit: number;
  companyCredit: number;
  credit: number;
  company?: { name: string };
  lastActivity?: string;
}

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  creditType: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
  relatedUser?: { name: string; role: string };
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  currentBalance: number;
  ifscCode: string;
  branchName: string;
}

export default function CreditManagementSection() {
  const [usersWithCredit, setUsersWithCredit] = useState<UserWithCredit[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  
  // Stats
  const [stats, setStats] = useState({
    totalPersonalCredit: 0,
    totalCompanyCredit: 0,
    myPersonalCredit: 0,
    myCompanyCredit: 0
  });
  
  // Dialogs
  const [showDeductDialog, setShowDeductDialog] = useState(false);
  const [showTransferToBankDialog, setShowTransferToBankDialog] = useState(false);
  const [showPassbookDialog, setShowPassbookDialog] = useState(false);
  
  // Selected items
  const [selectedUser, setSelectedUser] = useState<UserWithCredit | null>(null);
  const [userTransactions, setUserTransactions] = useState<CreditTransaction[]>([]);
  
  // Forms
  const [deductForm, setDeductForm] = useState({
    amount: 0,
    creditType: 'PERSONAL',
    remarks: ''
  });
  const [transferForm, setTransferForm] = useState({
    amount: 0,
    creditType: 'PERSONAL',
    bankAccountId: '',
    remarks: ''
  });
  
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
    // No polling - data only refreshes on user action
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all users with credit
      const usersRes = await fetch('/api/credit?action=all-personal-credits');
      const usersData = await usersRes.json();
      
      if (usersData.success) {
        setUsersWithCredit(usersData.users || []);
        setStats(prev => ({
          ...prev,
          totalPersonalCredit: usersData.totalPersonalCredit || 0,
          totalCompanyCredit: usersData.users?.reduce((sum: number, u: UserWithCredit) => sum + (u.companyCredit || 0), 0) || 0
        }));
      }
      
      // Fetch SuperAdmin's credit
      const myCreditRes = await fetch('/api/credit?action=summary&userId=current');
      const myCreditData = await myCreditRes.json();
      
      if (myCreditData.success) {
        setStats(prev => ({
          ...prev,
          myPersonalCredit: myCreditData.user?.personalCredit || 0,
          myCompanyCredit: myCreditData.user?.companyCredit || 0
        }));
        setTransactions(myCreditData.transactions || []);
      }
      
      // Fetch bank accounts
      const banksRes = await fetch('/api/bank-account');
      const banksData = await banksRes.json();
      setBankAccounts(banksData.accounts || []);
      
    } catch (error) {
      console.error('Error fetching credit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeductCredit = async () => {
    if (!selectedUser || !deductForm.amount || deductForm.amount <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    
    const availableCredit = deductForm.creditType === 'PERSONAL' 
      ? selectedUser.personalCredit 
      : selectedUser.companyCredit;
    
    if (deductForm.amount > availableCredit) {
      toast({ title: 'Insufficient Credit', description: `Available: ₹${formatCurrency(availableCredit)}`, variant: 'destructive' });
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch('/api/credit/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: deductForm.amount,
          creditType: deductForm.creditType,
          remarks: deductForm.remarks,
          deductedBy: 'SUPER_ADMIN'
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({ 
          title: 'Credit Deducted', 
          description: `₹${formatCurrency(deductForm.amount)} deducted from ${selectedUser.name}'s ${deductForm.creditType.toLowerCase()} credit` 
        });
        setShowDeductDialog(false);
        setDeductForm({ amount: 0, creditType: 'PERSONAL', remarks: '' });
        fetchData();
        
        // Emit real-time update event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('credit-updated', { 
            detail: { userId: selectedUser.id, type: deductForm.creditType, amount: -deductForm.amount }
          }));
        }
      } else {
        throw new Error(data.error || 'Failed to deduct credit');
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to deduct credit', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleTransferToBank = async () => {
    if (!transferForm.amount || transferForm.amount <= 0 || !transferForm.bankAccountId) {
      toast({ title: 'Error', description: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    
    const availableCredit = transferForm.creditType === 'PERSONAL' 
      ? stats.myPersonalCredit 
      : stats.myCompanyCredit;
    
    if (transferForm.amount > availableCredit) {
      toast({ title: 'Insufficient Credit', description: `Available: ₹${formatCurrency(availableCredit)}`, variant: 'destructive' });
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch('/api/credit/transfer-to-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferForm)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({ 
          title: 'Transfer Successful', 
          description: `₹${formatCurrency(transferForm.amount)} transferred to bank account` 
        });
        setShowTransferToBankDialog(false);
        setTransferForm({ amount: 0, creditType: 'PERSONAL', bankAccountId: '', remarks: '' });
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to transfer');
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to transfer', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const fetchUserTransactions = async (userId: string) => {
    try {
      const response = await fetch(`/api/credit?userId=${userId}&limit=50`);
      const data = await response.json();
      if (data.success) {
        setUserTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching user transactions:', error);
    }
  };

  const openPassbook = (user: UserWithCredit) => {
    setSelectedUser(user);
    fetchUserTransactions(user.id);
    setShowPassbookDialog(true);
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-700',
      COMPANY: 'bg-blue-100 text-blue-700',
      AGENT: 'bg-emerald-100 text-emerald-700',
      STAFF: 'bg-orange-100 text-orange-700',
      CASHIER: 'bg-teal-100 text-teal-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600">My Personal Credit</p>
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(stats.myPersonalCredit)}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600">My Company Credit</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(stats.myCompanyCredit)}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Building className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600">Total Users Credit</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(stats.totalPersonalCredit + stats.totalCompanyCredit)}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-pink-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600">Bank Accounts</p>
                <p className="text-2xl font-bold text-purple-700">{bankAccounts.length}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Landmark className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">Users Credit</TabsTrigger>
          <TabsTrigger value="mycredit">My Credit</TabsTrigger>
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
        </TabsList>

        {/* Users Credit Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-600" />
                    All Users with Credit
                  </CardTitle>
                  <CardDescription>Manage credit for all roles - deduct and transfer instantly</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersWithCredit.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No users with credit found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {usersWithCredit.map((user, index) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="p-4 border rounded-xl bg-white hover:shadow-md transition-all"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 bg-gradient-to-br from-emerald-400 to-teal-500">
                            <AvatarFallback className="bg-transparent text-white font-semibold">
                              {user.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{user.name}</h4>
                              <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                            </div>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            {user.company && (
                              <p className="text-xs text-gray-400">Company: {user.company.name}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-amber-600">Personal</p>
                              <p className="font-bold text-amber-700">{formatCurrency(user.personalCredit)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-blue-600">Company</p>
                              <p className="font-bold text-blue-700">{formatCurrency(user.companyCredit)}</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPassbook(user)}
                            >
                              <Eye className="h-4 w-4 mr-1" /> Passbook
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-500 hover:bg-red-600"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeductDialog(true);
                              }}
                            >
                              <ArrowDown className="h-4 w-4 mr-1" /> Deduct
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
        </TabsContent>

        {/* My Credit Tab */}
        <TabsContent value="mycredit" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Credit Balance Cards */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                  My Credit Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-amber-600 flex items-center gap-2">
                        <User className="h-4 w-4" /> Personal Credit
                      </p>
                      <p className="text-3xl font-bold text-amber-700 mt-1">{formatCurrency(stats.myPersonalCredit)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setTransferForm(f => ({ ...f, creditType: 'PERSONAL' }));
                          setShowTransferToBankDialog(true);
                        }}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600"
                        onClick={() => {
                          setTransferForm(f => ({ ...f, creditType: 'PERSONAL' }));
                          setShowTransferToBankDialog(true);
                        }}
                      >
                        <Landmark className="h-4 w-4 mr-1" /> To Bank
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 flex items-center gap-2">
                        <Building className="h-4 w-4" /> Company Credit
                      </p>
                      <p className="text-3xl font-bold text-blue-700 mt-1">{formatCurrency(stats.myCompanyCredit)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setTransferForm(f => ({ ...f, creditType: 'COMPANY' }));
                          setShowTransferToBankDialog(true);
                        }}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-blue-500 hover:bg-blue-600"
                        onClick={() => {
                          setTransferForm(f => ({ ...f, creditType: 'COMPANY' }));
                          setShowTransferToBankDialog(true);
                        }}
                      >
                        <Landmark className="h-4 w-4 mr-1" /> To Bank
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Accounts */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-purple-600" />
                  Bank Accounts
                </CardTitle>
                <CardDescription>Transfer credit to bank accounts</CardDescription>
              </CardHeader>
              <CardContent>
                {bankAccounts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Landmark className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No bank accounts configured</p>
                    <p className="text-xs">Add bank accounts in Accountant portal</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bankAccounts.map((account) => (
                      <div key={account.id} className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setTransferForm(f => ({ ...f, bankAccountId: account.id }));
                          setShowTransferToBankDialog(true);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{account.bankName}</p>
                            <p className="text-xs text-gray-500">{account.accountNumber}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(account.currentBalance)}</p>
                            <p className="text-xs text-gray-500">Balance</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-teal-600" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            tx.type === 'CREDIT_INCREASE' || tx.type === 'PERSONAL_COLLECTION' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {tx.type === 'CREDIT_INCREASE' || tx.type === 'PERSONAL_COLLECTION' ? (
                              <ArrowUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{tx.description}</p>
                            <p className="text-xs text-gray-500">{formatDate(tx.createdAt)}</p>
                          </div>
                        </div>
                        <p className={`font-bold ${tx.type === 'CREDIT_INCREASE' || tx.type === 'PERSONAL_COLLECTION' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'CREDIT_INCREASE' || tx.type === 'PERSONAL_COLLECTION' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>All Credit Transactions</CardTitle>
              <CardDescription>System-wide credit movement history</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs">{formatDate(tx.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.creditType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={tx.type === 'CREDIT_INCREASE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={`font-bold ${tx.type === 'CREDIT_INCREASE' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'CREDIT_INCREASE' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-xs">{tx.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Deduct Credit Dialog */}
      <Dialog open={showDeductDialog} onOpenChange={setShowDeductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-red-600" />
              Deduct Credit from {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Credit will be instantly deducted and added to your balance
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-600">Personal Credit</p>
                <p className="text-xl font-bold text-amber-700">{formatCurrency(selectedUser?.personalCredit || 0)}</p>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-600">Company Credit</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(selectedUser?.companyCredit || 0)}</p>
              </div>
            </div>

            <div>
              <Label>Credit Type to Deduct</Label>
              <Select 
                value={deductForm.creditType} 
                onValueChange={(v) => setDeductForm(f => ({ ...f, creditType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSONAL">Personal Credit</SelectItem>
                  <SelectItem value="COMPANY">Company Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amount to Deduct (₹) *</Label>
              <Input 
                type="number" 
                value={deductForm.amount || ''} 
                onChange={(e) => setDeductForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="Enter amount"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available: {formatCurrency(deductForm.creditType === 'PERSONAL' ? (selectedUser?.personalCredit || 0) : (selectedUser?.companyCredit || 0))}
              </p>
            </div>

            <div>
              <Label>Remarks *</Label>
              <Textarea 
                value={deductForm.remarks} 
                onChange={(e) => setDeductForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Reason for deduction..."
              />
            </div>

            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm text-emerald-700">
                <CheckCircle className="h-4 w-4 inline mr-1" />
                Deducted amount will be added to your <strong>{deductForm.creditType.toLowerCase()} credit</strong>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeductDialog(false)}>Cancel</Button>
            <Button 
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDeductCredit}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowDown className="h-4 w-4 mr-2" />}
              Deduct Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer to Bank Dialog */}
      <Dialog open={showTransferToBankDialog} onOpenChange={setShowTransferToBankDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-purple-600" />
              Transfer Credit to Bank Account
            </DialogTitle>
            <DialogDescription>
              Credit will be deducted and added to selected bank account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div 
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  transferForm.creditType === 'PERSONAL' 
                    ? 'bg-amber-100 border-2 border-amber-400' 
                    : 'bg-gray-50 border hover:bg-gray-100'
                }`}
                onClick={() => setTransferForm(f => ({ ...f, creditType: 'PERSONAL' }))}
              >
                <p className="text-xs text-amber-600">Personal Credit</p>
                <p className="text-xl font-bold text-amber-700">{formatCurrency(stats.myPersonalCredit)}</p>
              </div>
              <div 
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  transferForm.creditType === 'COMPANY' 
                    ? 'bg-blue-100 border-2 border-blue-400' 
                    : 'bg-gray-50 border hover:bg-gray-100'
                }`}
                onClick={() => setTransferForm(f => ({ ...f, creditType: 'COMPANY' }))}
              >
                <p className="text-xs text-blue-600">Company Credit</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(stats.myCompanyCredit)}</p>
              </div>
            </div>

            <div>
              <Label>Select Bank Account *</Label>
              <Select 
                value={transferForm.bankAccountId} 
                onValueChange={(v) => setTransferForm(f => ({ ...f, bankAccountId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amount to Transfer (₹) *</Label>
              <Input 
                type="number" 
                value={transferForm.amount || ''} 
                onChange={(e) => setTransferForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <Label>Remarks</Label>
              <Textarea 
                value={transferForm.remarks} 
                onChange={(e) => setTransferForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Transfer note..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferToBankDialog(false)}>Cancel</Button>
            <Button 
              className="bg-purple-500 hover:bg-purple-600"
              onClick={handleTransferToBank}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Transfer to Bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Passbook Dialog */}
      <Dialog open={showPassbookDialog} onOpenChange={setShowPassbookDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-teal-600" />
              Passbook - {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              <Badge className={getRoleColor(selectedUser?.role || '')}>{selectedUser?.role}</Badge>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-amber-600">Personal Credit</p>
              <p className="text-lg font-bold text-amber-700">{formatCurrency(selectedUser?.personalCredit || 0)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600">Company Credit</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(selectedUser?.companyCredit || 0)}</p>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            {userTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.type === 'CREDIT_INCREASE' || tx.type === 'PERSONAL_COLLECTION' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {tx.type === 'CREDIT_INCREASE' || tx.type === 'PERSONAL_COLLECTION' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">{formatDate(tx.createdAt)}</p>
                          <Badge variant="outline" className="text-xs">{tx.creditType}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.type === 'CREDIT_INCREASE' || tx.type === 'PERSONAL_COLLECTION' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'CREDIT_INCREASE' || tx.type === 'PERSONAL_COLLECTION' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <p className="text-xs text-gray-500">Bal: {formatCurrency(tx.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPassbookDialog(false)}>Close</Button>
            <Button 
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                setShowPassbookDialog(false);
                setShowDeductDialog(true);
              }}
            >
              <ArrowDown className="h-4 w-4 mr-2" /> Deduct Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
