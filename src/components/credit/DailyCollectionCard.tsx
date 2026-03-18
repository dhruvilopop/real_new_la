'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  IndianRupee, Banknote, CreditCard, Receipt, TrendingUp,
  Calendar, Users, ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react';

interface DailyCollectionData {
  date: string;
  totalCash: number;
  totalCheque: number;
  totalOnline: number;
  totalAmount: number;
  totalTransactions: number;
  emiPaymentsCount: number;
  settlementsCount: number;
  superAdminCollection: number;
  companyCollection: number;
  agentCollection: number;
  staffCollection: number;
  cashierCollection: number;
  customerDirect: number;
}

interface DailyCollectionCardProps {
  showRoleBreakdown?: boolean;
  compact?: boolean;
}

export default function DailyCollectionCard({ showRoleBreakdown = false, compact = false }: DailyCollectionCardProps) {
  const [collection, setCollection] = useState<DailyCollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayCollection();
  }, []);

  const fetchTodayCollection = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/collection?action=today');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCollection(data.collection || data.summary);
        }
      } else {
        setError('Failed to load collection data');
      }
    } catch (err) {
      setError('Failed to load collection data');
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

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !collection) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <p className="text-gray-500 text-center">{error || 'No collection data available'}</p>
        </CardContent>
      </Card>
    );
  }

  const total = collection.totalAmount || 0;
  const cash = collection.totalCash || 0;
  const cheque = collection.totalCheque || 0;
  const online = collection.totalOnline || 0;

  if (compact) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Today's Collection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
              <p className="text-xs text-gray-500">{collection.totalTransactions} transactions</p>
            </div>
            <div className="flex gap-1">
              {cash > 0 && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Cash</Badge>}
              {online > 0 && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Online</Badge>}
              {cheque > 0 && <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Cheque</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Today's Collection
            </CardTitle>
            <Badge className="bg-white/20 text-white border-0">
              {formatDate(collection.date)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Total Amount */}
          <div className="text-center mb-6 pb-6 border-b border-gray-100">
            <p className="text-sm text-gray-500 mb-1">Total Collected</p>
            <motion.p 
              className="text-4xl font-bold text-gray-900"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {formatCurrency(total)}
            </motion.p>
            <p className="text-sm text-gray-500 mt-1">
              {collection.totalTransactions} transactions • {collection.emiPaymentsCount} EMI payments
            </p>
          </div>

          {/* Payment Mode Breakdown */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <motion.div 
              className="text-center p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100"
              whileHover={{ scale: 1.02 }}
            >
              <div className="p-2 bg-green-100 rounded-full w-fit mx-auto mb-2">
                <Banknote className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-xs text-green-600 font-medium">Cash</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(cash)}</p>
              <p className="text-xs text-green-500">
                {total > 0 ? ((cash / total) * 100).toFixed(0) : 0}%
              </p>
            </motion.div>

            <motion.div 
              className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100"
              whileHover={{ scale: 1.02 }}
            >
              <div className="p-2 bg-blue-100 rounded-full w-fit mx-auto mb-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-xs text-blue-600 font-medium">Online/UPI</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(online)}</p>
              <p className="text-xs text-blue-500">
                {total > 0 ? ((online / total) * 100).toFixed(0) : 0}%
              </p>
            </motion.div>

            <motion.div 
              className="text-center p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100"
              whileHover={{ scale: 1.02 }}
            >
              <div className="p-2 bg-purple-100 rounded-full w-fit mx-auto mb-2">
                <Receipt className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-xs text-purple-600 font-medium">Cheque</p>
              <p className="text-lg font-bold text-purple-700">{formatCurrency(cheque)}</p>
              <p className="text-xs text-purple-500">
                {total > 0 ? ((cheque / total) * 100).toFixed(0) : 0}%
              </p>
            </motion.div>
          </div>

          {/* Role-wise Breakdown (if enabled) */}
          {showRoleBreakdown && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Collection by Role
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {collection.superAdminCollection > 0 && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-600">Super Admin</span>
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(collection.superAdminCollection)}</span>
                  </div>
                )}
                {collection.companyCollection > 0 && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-600">Company</span>
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(collection.companyCollection)}</span>
                  </div>
                )}
                {collection.agentCollection > 0 && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-600">Agent</span>
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(collection.agentCollection)}</span>
                  </div>
                )}
                {collection.staffCollection > 0 && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-600">Staff</span>
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(collection.staffCollection)}</span>
                  </div>
                )}
                {collection.cashierCollection > 0 && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-600">Cashier</span>
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(collection.cashierCollection)}</span>
                  </div>
                )}
                {collection.customerDirect > 0 && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-600">Customer Direct</span>
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(collection.customerDirect)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
