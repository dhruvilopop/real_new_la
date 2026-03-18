'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IndianRupee, Banknote, CreditCard, Receipt, Send, CheckCircle,
  Clock, XCircle, User, AlertCircle, Wallet
} from 'lucide-react';

interface Cashier {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Settlement {
  id: string;
  settlementNumber: string;
  userId: string;
  cashierId: string;
  amount: number;
  paymentMode: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
  cashier: { id: string; name: string; role: string };
}

interface CashierSettlementProps {
  userId: string;
  userCredit: number;
  onSettlementComplete?: () => void;
}

export default function CashierSettlement({ userId, userCredit, onSettlementComplete }: CashierSettlementProps) {
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankRefNumber, setBankRefNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetchCashiers();
    fetchSettlements();
  }, [userId]);

  const fetchCashiers = async () => {
    try {
      const res = await fetch('/api/user?role=CASHIER');
      if (res.ok) {
        const data = await res.json();
        setCashiers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch cashiers:', error);
    }
  };

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/settlement?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSettlements(data.settlements || []);
      }
    } catch (error) {
      console.error('Failed to fetch settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCashier || !amount) {
      alert('Please fill all required fields');
      return;
    }

    const settlementAmount = parseFloat(amount);
    if (settlementAmount > userCredit) {
      alert('Amount exceeds your credit balance');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          cashierId: selectedCashier,
          amount: settlementAmount,
          paymentMode,
          chequeNumber: paymentMode === 'CHEQUE' ? chequeNumber : null,
          bankRefNumber: paymentMode === 'ONLINE' || paymentMode === 'BANK_TRANSFER' ? bankRefNumber : null,
          remarks
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDialogOpen(false);
          resetForm();
          fetchSettlements();
          onSettlementComplete?.();
        } else {
          alert(data.error || 'Failed to create settlement');
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to create settlement');
      }
    } catch (error) {
      alert('Failed to create settlement');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCashier('');
    setAmount('');
    setPaymentMode('CASH');
    setChequeNumber('');
    setBankRefNumber('');
    setRemarks('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'VERIFIED':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'VERIFIED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMPLETED':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Settlement with Cashier
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-teal-600 hover:bg-gray-100">
                <Send className="h-4 w-4 mr-2" />
                New Settlement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Settle Credit with Cashier</DialogTitle>
                <DialogDescription>
                  Transfer your credit balance to a cashier. Your credit will be reduced.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-sm text-emerald-600">Your Current Credit</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(userCredit)}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cashier">Select Cashier *</Label>
                  <Select value={selectedCashier} onValueChange={setSelectedCashier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a cashier" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashiers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-10"
                      max={userCredit}
                    />
                  </div>
                  {parseFloat(amount) > userCredit && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Amount exceeds your credit balance
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={paymentMode === 'CASH' ? 'default' : 'outline'}
                      className={paymentMode === 'CASH' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                      onClick={() => setPaymentMode('CASH')}
                    >
                      <Banknote className="h-4 w-4 mr-1" />
                      Cash
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMode === 'ONLINE' ? 'default' : 'outline'}
                      className={paymentMode === 'ONLINE' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                      onClick={() => setPaymentMode('ONLINE')}
                    >
                      <CreditCard className="h-4 w-4 mr-1" />
                      Online
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMode === 'CHEQUE' ? 'default' : 'outline'}
                      className={paymentMode === 'CHEQUE' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                      onClick={() => setPaymentMode('CHEQUE')}
                    >
                      <Receipt className="h-4 w-4 mr-1" />
                      Cheque
                    </Button>
                  </div>
                </div>

                {paymentMode === 'CHEQUE' && (
                  <div className="space-y-2">
                    <Label htmlFor="chequeNumber">Cheque Number</Label>
                    <Input
                      id="chequeNumber"
                      placeholder="Enter cheque number"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                    />
                  </div>
                )}

                {(paymentMode === 'ONLINE' || paymentMode === 'BANK_TRANSFER') && (
                  <div className="space-y-2">
                    <Label htmlFor="bankRef">Bank Reference Number</Label>
                    <Input
                      id="bankRef"
                      placeholder="Enter reference number"
                      value={bankRefNumber}
                      onChange={(e) => setBankRefNumber(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Input
                    id="remarks"
                    placeholder="Optional remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                    onClick={handleSubmit}
                    disabled={submitting || !selectedCashier || !amount || parseFloat(amount) > userCredit}
                  >
                    {submitting ? 'Processing...' : 'Submit Settlement'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : settlements.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No settlements yet</p>
            <p className="text-sm">Create your first settlement to transfer credit</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="divide-y divide-gray-50">
              {settlements.map((s, index) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-full ${
                    s.status === 'COMPLETED' ? 'bg-green-100' :
                    s.status === 'PENDING' ? 'bg-yellow-100' :
                    s.status === 'VERIFIED' ? 'bg-blue-100' : 'bg-red-100'
                  }`}>
                    {getStatusIcon(s.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {s.settlementNumber}
                      </p>
                      <Badge variant="outline" className={getStatusColor(s.status)}>
                        {s.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      To: {s.cashier?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(s.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.paymentMode}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
