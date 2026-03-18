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
import { 
  IndianRupee, User, ArrowUpRight, ArrowDownRight, FileText, Clock, 
  CheckCircle, AlertTriangle, Eye, Download, Filter, Search, RefreshCw,
  CreditCard, Wallet, TrendingUp, Calendar, Phone, Mail, Building2,
  Upload, X, ImageIcon, FileCheck
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface UserWithCredit {
  id: string;
  name: string;
  email: string;
  role: string;
  personalCredit: number;
  companyCredit: number;
  company?: { name: string };
  _count?: { creditTransactions: number };
}

interface CreditTransaction {
  id: string;
  userId: string;
  transactionType: string;
  amount: number;
  paymentMode: string;
  creditType: string;
  companyBalanceAfter: number;
  personalBalanceAfter: number;
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
  chequeNumber?: string;
  chequeDate?: string;
  bankRefNumber?: string;
  utrNumber?: string;
  proofDocument?: string;
  proofType?: string;
  proofVerified: boolean;
  description?: string;
  remarks?: string;
  transactionDate: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface PersonalCreditManagerProps {
  currentUser: { id: string; role: string };
}

export default function PersonalCreditManager({ currentUser }: PersonalCreditManagerProps) {
  const [usersWithCredit, setUsersWithCredit] = useState<UserWithCredit[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithCredit | null>(null);
  const [showClearanceDialog, setShowClearanceDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<CreditTransaction | null>(null);
  const [clearanceAmount, setClearanceAmount] = useState('');
  const [clearanceRemarks, setClearanceRemarks] = useState('');
  const [clearanceMode, setClearanceMode] = useState('CASH');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isSuperAdmin) {
        // Super Admin fetches all users with personal credit
        const response = await fetch('/api/credit?action=all-personal-credits');
        const data = await response.json();
        if (data.success) {
          setUsersWithCredit(data.users);
        }
      }
      
      // Fetch current user's transactions
      const txResponse = await fetch(`/api/credit?userId=${currentUser.id}`);
      const txData = await txResponse.json();
      if (txData.success) {
        setTransactions(txData.transactions);
      }
    } catch (error) {
      console.error('Error fetching credit data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch credit data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearPersonalCredit = async () => {
    if (!selectedUser || !clearanceAmount || parseFloat(clearanceAmount) <= 0) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a valid clearance amount',
        variant: 'destructive'
      });
      return;
    }

    if (parseFloat(clearanceAmount) > selectedUser.personalCredit) {
      toast({
        title: 'Invalid Amount',
        description: 'Clearance amount cannot exceed personal credit balance',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      let proofDocumentPath = null;
      
      // Upload proof if provided
      if (proofFile) {
        const formData = new FormData();
        formData.append('file', proofFile);
        formData.append('type', 'credit-proof');
        
        const uploadResponse = await fetch('/api/upload/document', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
          proofDocumentPath = uploadData.path;
        }
      }

      const response = await fetch('/api/credit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: parseFloat(clearanceAmount),
          paymentMode: clearanceMode,
          creditType: 'PERSONAL',
          clearPersonalCredit: true,
          remarks: clearanceRemarks,
          proofDocument: proofDocumentPath,
          proofType: proofFile?.type
        })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Personal Credit Cleared',
          description: `₹${clearanceAmount} cleared from ${selectedUser.name}'s personal credit`
        });
        setShowClearanceDialog(false);
        setSelectedUser(null);
        setClearanceAmount('');
        setClearanceRemarks('');
        setProofFile(null);
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to clear personal credit',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error clearing credit:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear personal credit',
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
      minimumFractionDigits: 0
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

  const getTransactionTypeBadge = (type: string) => {
    const config: Record<string, { color: string; label: string }> = {
      CREDIT_INCREASE: { color: 'bg-emerald-100 text-emerald-800', label: 'Credit +' },
      CREDIT_DECREASE: { color: 'bg-red-100 text-red-800', label: 'Credit -' },
      PERSONAL_COLLECTION: { color: 'bg-amber-100 text-amber-800', label: 'Personal +' },
      PERSONAL_CLEARANCE: { color: 'bg-blue-100 text-blue-800', label: 'Cleared' },
      SETTLEMENT: { color: 'bg-purple-100 text-purple-800', label: 'Settlement' },
      ADJUSTMENT: { color: 'bg-gray-100 text-gray-800', label: 'Adjustment' }
    };
    const { color, label } = config[type] || { color: 'bg-gray-100 text-gray-800', label: type };
    return <Badge className={color}>{label}</Badge>;
  };

  const getPaymentModeIcon = (mode: string) => {
    switch (mode) {
      case 'CASH': return <Wallet className="h-4 w-4 text-emerald-600" />;
      case 'CHEQUE': return <FileText className="h-4 w-4 text-blue-600" />;
      case 'ONLINE':
      case 'UPI':
      case 'BANK_TRANSFER': return <CreditCard className="h-4 w-4 text-purple-600" />;
      default: return <IndianRupee className="h-4 w-4" />;
    }
  };

  const filteredUsers = usersWithCredit.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTransactions = transactions.filter(t => {
    if (filterType === 'personal' && t.creditType !== 'PERSONAL') return false;
    if (filterType === 'company' && t.creditType !== 'COMPANY') return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Total Personal Credits</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(usersWithCredit.reduce((sum, u) => sum + u.personalCredit, 0))}
                </p>
              </div>
              <IndianRupee className="h-8 w-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Total Company Credits</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(usersWithCredit.reduce((sum, u) => sum + u.companyCredit, 0))}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Users with Credit</p>
                <p className="text-2xl font-bold">{usersWithCredit.length}</p>
              </div>
              <User className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Total Transactions</p>
                <p className="text-2xl font-bold">{transactions.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="users">Users with Personal Credit</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Users with Personal Credit Balance</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                Users who have collected payments in their personal account. Clear their credit when they submit money to Super Admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No users with personal credit balance
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Personal Credit</TableHead>
                        <TableHead className="text-right">Company Credit</TableHead>
                        <TableHead className="text-center">Transactions</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-amber-100 text-amber-700">
                                  {user.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.role}</Badge>
                          </TableCell>
                          <TableCell>{user.company?.name || '-'}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-amber-600">
                              {formatCurrency(user.personalCredit)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-emerald-600">
                              {formatCurrency(user.companyCredit)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{user._count?.creditTransactions || 0}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              className="bg-blue-500 hover:bg-blue-600"
                              onClick={() => {
                                setSelectedUser(user);
                                setClearanceAmount(user.personalCredit.toString());
                                setShowClearanceDialog(true);
                              }}
                              disabled={user.personalCredit <= 0}
                            >
                              <ArrowDownRight className="h-4 w-4 mr-1" />
                              Clear Credit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Credit Transaction History</CardTitle>
                <div className="flex gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Transactions</SelectItem>
                      <SelectItem value="personal">Personal Credit</SelectItem>
                      <SelectItem value="company">Company Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Customer/Loan</TableHead>
                      <TableHead>Proof</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{formatDate(tx.transactionDate)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getTransactionTypeBadge(tx.transactionType)}
                            <Badge variant="outline" className="w-fit text-xs">
                              {tx.creditType}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentModeIcon(tx.paymentMode)}
                            <span>{tx.paymentMode}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${
                            tx.transactionType === 'CREDIT_INCREASE' || tx.transactionType === 'PERSONAL_COLLECTION'
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}>
                            {tx.transactionType === 'CREDIT_INCREASE' || tx.transactionType === 'PERSONAL_COLLECTION' ? '+' : '-'}
                            {formatCurrency(tx.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {tx.customerName && (
                            <div className="text-sm">
                              <p className="font-medium">{tx.customerName}</p>
                              <p className="text-xs text-gray-500">{tx.loanApplicationNo}</p>
                              {tx.installmentNumber && (
                                <p className="text-xs text-gray-400">EMI #{tx.installmentNumber}</p>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {tx.proofDocument ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs text-emerald-600">
                                {tx.proofVerified ? 'Verified' : 'Pending'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedTransaction(tx);
                              setShowTransactionDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Clearance Dialog */}
      <Dialog open={showClearanceDialog} onOpenChange={setShowClearanceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear Personal Credit</DialogTitle>
            <DialogDescription>
              Clear personal credit balance when the user submits money to Super Admin.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-800">User</p>
                    <p className="font-semibold">{selectedUser.name}</p>
                    <p className="text-xs text-amber-600">{selectedUser.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-amber-800">Current Balance</p>
                    <p className="text-xl font-bold text-amber-700">
                      {formatCurrency(selectedUser.personalCredit)}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label>Amount to Clear</Label>
                <Input
                  type="number"
                  value={clearanceAmount}
                  onChange={(e) => setClearanceAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <Label>Payment Mode</Label>
                <Select value={clearanceMode} onValueChange={setClearanceMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="ONLINE">Online Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {clearanceMode !== 'CASH' && (
                <div>
                  <Label>Proof Document</Label>
                  <div className="mt-1">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="proof-upload"
                    />
                    <label
                      htmlFor="proof-upload"
                      className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      {proofFile ? (
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-5 w-5 text-emerald-500" />
                          <span className="text-sm">{proofFile.name}</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-6 w-6 mx-auto text-gray-400" />
                          <span className="text-sm text-gray-500">Click to upload proof</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={clearanceRemarks}
                  onChange={(e) => setClearanceRemarks(e.target.value)}
                  placeholder="Add any remarks..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearanceDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-blue-500 hover:bg-blue-600"
              onClick={handleClearPersonalCredit}
              disabled={processing}
            >
              {processing ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-2" />
              )}
              Clear Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Transaction ID</p>
                  <p className="font-mono text-sm">{selectedTransaction.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium">{formatDate(selectedTransaction.transactionDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  {getTransactionTypeBadge(selectedTransaction.transactionType)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Credit Type</p>
                  <Badge variant="outline">{selectedTransaction.creditType}</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Mode</p>
                  <div className="flex items-center gap-1">
                    {getPaymentModeIcon(selectedTransaction.paymentMode)}
                    {selectedTransaction.paymentMode}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className={`text-xl font-bold ${
                      selectedTransaction.transactionType === 'CREDIT_INCREASE' || 
                      selectedTransaction.transactionType === 'PERSONAL_COLLECTION'
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}>
                      {formatCurrency(selectedTransaction.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Company Balance</p>
                    <p className="text-lg font-semibold">{formatCurrency(selectedTransaction.companyBalanceAfter || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Personal Balance</p>
                    <p className="text-lg font-semibold">{formatCurrency(selectedTransaction.personalBalanceAfter || 0)}</p>
                  </div>
                </div>
              </div>

              {selectedTransaction.customerName && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Customer Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Customer Name</p>
                      <p className="font-medium">{selectedTransaction.customerName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Phone</p>
                      <p>{selectedTransaction.customerPhone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Loan Application</p>
                      <p>{selectedTransaction.loanApplicationNo || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">EMI Number</p>
                      <p>{selectedTransaction.installmentNumber ? `#${selectedTransaction.installmentNumber}` : '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedTransaction.proofDocument && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Proof Document</h4>
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm">Proof uploaded</span>
                    <Badge variant={selectedTransaction.proofVerified ? "default" : "secondary"}>
                      {selectedTransaction.proofVerified ? 'Verified' : 'Pending Verification'}
                    </Badge>
                  </div>
                </div>
              )}

              {selectedTransaction.remarks && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Remarks</h4>
                  <p className="text-sm text-gray-600">{selectedTransaction.remarks}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransactionDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
