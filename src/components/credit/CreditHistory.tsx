'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  IndianRupee, ArrowUpRight, ArrowDownRight, Clock, Banknote,
  CreditCard, Receipt, Calendar, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';

interface CreditTransaction {
  id: string;
  transactionType: string;
  amount: number;
  paymentMode: string;
  balanceAfter: number;
  sourceType: string;
  loanApplicationId: string | null;
  installmentNumber: number | null;
  description: string | null;
  createdAt: string;
  settlement?: {
    settlementNumber: string;
    status: string;
    cashier: { name: string; role: string };
  } | null;
}

interface CreditHistoryProps {
  userId: string;
  limit?: number;
  showTitle?: boolean;
}

export default function CreditHistory({ userId, limit = 20, showTitle = true }: CreditHistoryProps) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [user, setUser] = useState<{ name: string; role: string; credit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    fetchCreditHistory();
  }, [userId, page, filter]);

  const fetchCreditHistory = async () => {
    try {
      setLoading(true);
      let url = `/api/credit?userId=${userId}&page=${page}&limit=${limit}`;
      if (filter) {
        url += `&type=${filter}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTransactions(data.transactions || []);
          setUser(data.user);
          setTotalPages(data.pagination?.totalPages || 1);
        }
      } else {
        setError('Failed to load credit history');
      }
    } catch (err) {
      setError('Failed to load credit history');
    } finally {
      setLoading(false);
    }
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CREDIT_INCREASE':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'CREDIT_DECREASE':
        return <ArrowDownRight className="h-4 w-4 text-red-600" />;
      case 'SETTLEMENT':
        return <Banknote className="h-4 w-4 text-blue-600" />;
      default:
        return <IndianRupee className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'CREDIT_INCREASE':
        return 'Credit Added';
      case 'CREDIT_DECREASE':
        return 'Credit Reduced';
      case 'SETTLEMENT':
        return 'Settlement';
      case 'ADJUSTMENT':
        return 'Adjustment';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CREDIT_INCREASE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'CREDIT_DECREASE':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'SETTLEMENT':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getPaymentModeIcon = (mode: string) => {
    switch (mode) {
      case 'CASH':
        return <Banknote className="h-3 w-3" />;
      case 'ONLINE':
      case 'UPI':
        return <CreditCard className="h-3 w-3" />;
      case 'CHEQUE':
        return <Receipt className="h-3 w-3" />;
      default:
        return <IndianRupee className="h-3 w-3" />;
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
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
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500 text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {showTitle && (
        <CardHeader className="pb-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Credit History
            </CardTitle>
            {user && (
              <Badge className="bg-white/20 text-white border-0">
                Balance: {formatCurrency(user.credit)}
              </Badge>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        {/* Filter */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-100">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={filter === '' ? 'default' : 'outline'}
              className={filter === '' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
              onClick={() => { setFilter(''); setPage(1); }}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filter === 'CREDIT_INCREASE' ? 'default' : 'outline'}
              className={filter === 'CREDIT_INCREASE' ? 'bg-green-500 hover:bg-green-600' : ''}
              onClick={() => { setFilter('CREDIT_INCREASE'); setPage(1); }}
            >
              Increases
            </Button>
            <Button
              size="sm"
              variant={filter === 'CREDIT_DECREASE' ? 'default' : 'outline'}
              className={filter === 'CREDIT_DECREASE' ? 'bg-red-500 hover:bg-red-600' : ''}
              onClick={() => { setFilter('CREDIT_DECREASE'); setPage(1); }}
            >
              Decreases
            </Button>
          </div>
        </div>

        {/* Transactions List */}
        <ScrollArea className="h-[400px]">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <IndianRupee className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No credit transactions found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-full ${
                    tx.transactionType === 'CREDIT_INCREASE' ? 'bg-green-100' :
                    tx.transactionType === 'CREDIT_DECREASE' ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    {getTypeIcon(tx.transactionType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {tx.description || getTypeLabel(tx.transactionType)}
                      </p>
                      <Badge variant="outline" className={getTypeColor(tx.transactionType)}>
                        {getTypeLabel(tx.transactionType)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(tx.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        {getPaymentModeIcon(tx.paymentMode)}
                        {tx.paymentMode}
                      </span>
                      {tx.installmentNumber && (
                        <span>EMI #{tx.installmentNumber}</span>
                      )}
                    </div>
                    {tx.settlement && (
                      <p className="text-xs text-gray-500 mt-1">
                        Settlement: {tx.settlement.settlementNumber} • 
                        Status: {tx.settlement.status}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      tx.transactionType === 'CREDIT_INCREASE' ? 'text-green-600' :
                      tx.transactionType === 'CREDIT_DECREASE' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {tx.transactionType === 'CREDIT_INCREASE' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Balance: {formatCurrency(tx.balanceAfter)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
