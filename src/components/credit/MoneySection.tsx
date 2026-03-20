'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  IndianRupee, Calendar, Wallet, Building2, Users, CreditCard, Banknote,
  TrendingUp, TrendingDown, RefreshCw, Loader2, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, FileText, CheckCircle, Clock, ArrowRight,
  Landmark, PiggyBank, ArrowRightLeft, AlertCircle, Eye
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface MoneySummary {
  totalEMI: number;
  totalCollected: number;
  transactionCount: number;
  breakdownByMode: {
    CASH: number;
    UPI: number;
    BANK_TRANSFER: number;
    CHEQUE: number;
    ONLINE: number;
    OTHER: number;
  };
  countByMode: {
    CASH: number;
    UPI: number;
    BANK_TRANSFER: number;
    CHEQUE: number;
    ONLINE: number;
    OTHER: number;
  };
}

interface CompanyWiseData {
  id: string;
  name: string;
  totalEMI: number;
  companyCredit: number;
  personalCredit: number;
  transactionCount: number;
}

interface CollectorWiseData {
  id: string;
  name: string;
  role: string;
  company: string;
  totalCollected: number;
  companyCredit: number;
  personalCredit: number;
  transactionCount: number;
}

interface CompanyCreditSummary {
  id: string;
  name: string;
  code: string;
  companyCredit: number;
  usersTotalPersonal: number;
  usersTotalCompany: number;
  totalCredit: number;
  userCount: number;
}

interface BankAccountData {
  id: string;
  bankName: string;
  accountNumber: string;
  currentBalance: number;
  isDefault: boolean;
}

interface UserWithCredit {
  id: string;
  name: string;
  email: string;
  role: string;
  personalCredit: number;
  companyCredit: number;
  totalCredit: number;
  company?: string;
}

interface MoneyFlow {
  bankAccounts: BankAccountData[];
  totalBankBalance: number;
  creditManagement: {
    usersWithCredit: UserWithCredit[];
    totalPersonalCredit: number;
    totalCompanyCredit: number;
    grandTotal: number;
  };
}

interface MoneySummaryResponse {
  success: boolean;
  dateRange: {
    start: string;
    end: string;
  };
  summary: MoneySummary;
  companyWiseData: CompanyWiseData[];
  collectorWiseData: CollectorWiseData[];
  companyCreditSummary: CompanyCreditSummary[];
  moneyFlow: MoneyFlow;
}

export default function MoneySection() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('today');

  // Date filter state
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');

  // Data state
  const [data, setData] = useState<MoneySummaryResponse | null>(null);

  // Expanded sections
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [expandedCollector, setExpandedCollector] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      let url = '/api/reports/money-summary?';

      if (dateMode === 'range' && startDate && endDate) {
        url += `startDate=${startDate}&endDate=${endDate}`;
      } else {
        url += `date=${selectedDate}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setData(result);
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching money summary:', error);
      if (!isRefresh) {
        toast({
          title: 'Error',
          description: 'Failed to fetch money summary',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, startDate, endDate, dateMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getPaymentModeIcon = (mode: string) => {
    switch (mode) {
      case 'CASH': return <Banknote className="h-4 w-4 text-emerald-600" />;
      case 'UPI': return <Smartphone className="h-4 w-4 text-purple-600" />;
      case 'BANK_TRANSFER': return <Landmark className="h-4 w-4 text-blue-600" />;
      case 'CHEQUE': return <FileText className="h-4 w-4 text-amber-600" />;
      case 'ONLINE': return <CreditCard className="h-4 w-4 text-cyan-600" />;
      default: return <IndianRupee className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPaymentModeColor = (mode: string) => {
    const colors: Record<string, string> = {
      CASH: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      UPI: 'bg-purple-100 text-purple-700 border-purple-200',
      BANK_TRANSFER: 'bg-blue-100 text-blue-700 border-blue-200',
      CHEQUE: 'bg-amber-100 text-amber-700 border-amber-200',
      ONLINE: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      OTHER: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return colors[mode] || colors.OTHER;
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { className: string; label: string }> = {
      SUPER_ADMIN: { className: 'bg-purple-100 text-purple-700', label: 'Super Admin' },
      COMPANY: { className: 'bg-blue-100 text-blue-700', label: 'Company' },
      AGENT: { className: 'bg-emerald-100 text-emerald-700', label: 'Agent' },
      STAFF: { className: 'bg-amber-100 text-amber-700', label: 'Staff' },
      CASHIER: { className: 'bg-cyan-100 text-cyan-700', label: 'Cashier' }
    };
    const { className, label } = config[role] || { className: 'bg-gray-100 text-gray-700', label: role };
    return <Badge className={className}>{label}</Badge>;
  };

  // Calculate percentages for payment mode breakdown
  const getModePercentage = (amount: number) => {
    if (!data?.summary.totalCollected) return 0;
    return Math.round((amount / data.summary.totalCollected) * 100);
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
      {/* Header with Date Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Money Section</h2>
          <p className="text-sm text-gray-500">
            Track collections, company income, and money flow
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              size="sm"
              variant={dateMode === 'single' ? 'default' : 'ghost'}
              onClick={() => setDateMode('single')}
              className={dateMode === 'single' ? 'bg-white shadow-sm' : ''}
            >
              Single Date
            </Button>
            <Button
              size="sm"
              variant={dateMode === 'range' ? 'default' : 'ghost'}
              onClick={() => setDateMode('range')}
              className={dateMode === 'range' ? 'bg-white shadow-sm' : ''}
            >
              Date Range
            </Button>
          </div>

          {/* Date Inputs */}
          {dateMode === 'single' ? (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
                placeholder="Start"
              />
              <span className="text-gray-400">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
                placeholder="End"
              />
            </div>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Today's Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Total EMI Collected</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(data?.summary.totalEMI || 0)}
                  </p>
                  <p className="text-emerald-200 text-xs mt-1">
                    {data?.summary.transactionCount || 0} transactions
                  </p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <IndianRupee className="h-6 w-6" />
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
                  <p className="text-blue-100 text-sm">Total Money Collected</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(data?.summary.totalCollected || 0)}
                  </p>
                  <p className="text-blue-200 text-xs mt-1">
                    All sources
                  </p>
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
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Company Credits</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(
                      data?.companyWiseData.reduce((sum, c) => sum + c.companyCredit, 0) || 0
                    )}
                  </p>
                  <p className="text-purple-200 text-xs mt-1">
                    CASH payments
                  </p>
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
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">Personal Credits</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(
                      data?.companyWiseData.reduce((sum, c) => sum + c.personalCredit, 0) || 0
                    )}
                  </p>
                  <p className="text-amber-200 text-xs mt-1">
                    Non-CASH payments
                  </p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Payment Mode Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Collection by Payment Mode
          </CardTitle>
          <CardDescription>
            Breakdown of today&apos;s collection by payment method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(data?.summary.breakdownByMode || {}).map(([mode, amount]) => (
              <div
                key={mode}
                className={`p-4 rounded-xl border ${getPaymentModeColor(mode)}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getPaymentModeIcon(mode)}
                  <span className="text-sm font-medium">{mode}</span>
                </div>
                <p className="text-xl font-bold">{formatCurrency(amount)}</p>
                <p className="text-xs opacity-75 mt-1">
                  {data?.summary.countByMode[mode as keyof typeof data.summary.countByMode] || 0} transactions
                </p>
                <div className="mt-2">
                  <Progress
                    value={getModePercentage(amount)}
                    className="h-1.5 bg-white/50"
                  />
                  <p className="text-xs opacity-75 mt-1">{getModePercentage(amount)}%</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="today" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Company-wise Income
          </TabsTrigger>
          <TabsTrigger value="collectors" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Collector Performance
          </TabsTrigger>
          <TabsTrigger value="flow" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Money Flow
          </TabsTrigger>
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4" />
            Credit Summary
          </TabsTrigger>
        </TabsList>

        {/* Company-wise Income Tab */}
        <TabsContent value="today" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Company-wise Collection
              </CardTitle>
              <CardDescription>
                EMI and credit breakdown by company for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.companyWiseData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No company collections for this period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Transactions</TableHead>
                        <TableHead className="text-right">EMI Collected</TableHead>
                        <TableHead className="text-right">Company Credit</TableHead>
                        <TableHead className="text-right">Personal Credit</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.companyWiseData.map((company) => (
                        <TableRow key={company.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center text-white font-bold">
                                {company.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{company.name}</p>
                                <p className="text-xs text-gray-500">{company.id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{company.transactionCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
                            {formatCurrency(company.totalEMI)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-blue-600">{formatCurrency(company.companyCredit)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-amber-600">{formatCurrency(company.personalCredit)}</span>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(company.companyCredit + company.personalCredit)}
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

        {/* Collector Performance Tab */}
        <TabsContent value="collectors" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Collector Performance
              </CardTitle>
              <CardDescription>
                Collection breakdown by staff members
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.collectorWiseData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No collector data for this period</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Collector</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Transactions</TableHead>
                        <TableHead className="text-right">Total Collected</TableHead>
                        <TableHead className="text-right">Company Credit</TableHead>
                        <TableHead className="text-right">Personal Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.collectorWiseData.map((collector) => (
                        <TableRow key={collector.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                {collector.name.charAt(0)}
                              </div>
                              <p className="font-medium">{collector.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(collector.role)}</TableCell>
                          <TableCell className="text-gray-600">{collector.company}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{collector.transactionCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
                            {formatCurrency(collector.totalCollected)}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            {formatCurrency(collector.companyCredit)}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(collector.personalCredit)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Money Flow Tab */}
        <TabsContent value="flow" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bank Accounts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-blue-600" />
                  Bank Accounts
                </CardTitle>
                <CardDescription>
                  Where the money goes - Bank balances
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Total Bank Balance */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600">Total Bank Balance</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {formatCurrency(data?.moneyFlow.totalBankBalance || 0)}
                        </p>
                      </div>
                      <Landmark className="h-8 w-8 text-blue-400" />
                    </div>
                  </div>

                  {/* Bank Accounts List */}
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {data?.moneyFlow.bankAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="p-3 bg-gray-50 rounded-lg border flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Landmark className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{account.bankName}</p>
                                {account.isDefault && (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                ****{account.accountNumber.slice(-4)}
                              </p>
                            </div>
                          </div>
                          <p className="font-semibold text-blue-600">
                            {formatCurrency(account.currentBalance)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            {/* Credit Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-amber-600" />
                  Credit Management
                </CardTitle>
                <CardDescription>
                  Who holds the credit
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Credit Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                      <p className="text-sm text-blue-600">Company Credit</p>
                      <p className="text-xl font-bold text-blue-700">
                        {formatCurrency(data?.moneyFlow.creditManagement.totalCompanyCredit || 0)}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <p className="text-sm text-amber-600">Personal Credit</p>
                      <p className="text-xl font-bold text-amber-700">
                        {formatCurrency(data?.moneyFlow.creditManagement.totalPersonalCredit || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Grand Total */}
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-emerald-600">Total Credit Held</p>
                        <p className="text-2xl font-bold text-emerald-700">
                          {formatCurrency(data?.moneyFlow.creditManagement.grandTotal || 0)}
                        </p>
                      </div>
                      <PiggyBank className="h-8 w-8 text-emerald-400" />
                    </div>
                  </div>

                  {/* Users with Credit */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Users Holding Credit ({data?.moneyFlow.creditManagement.usersWithCredit.length || 0})
                    </p>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {data?.moneyFlow.creditManagement.usersWithCredit.map((user) => (
                          <div
                            key={user.id}
                            className="p-3 bg-gray-50 rounded-lg border flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-sm font-bold">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{user.name}</p>
                                <p className="text-xs text-gray-500">{user.role} • {user.company || 'No Company'}</p>
                              </div>
                            </div>
                            <p className="font-semibold text-amber-600">
                              {formatCurrency(user.totalCredit)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Credit Summary Tab */}
        <TabsContent value="credits" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                Company Credit Summary
              </CardTitle>
              <CardDescription>
                Current credit status of all companies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead className="text-right">Company Credit</TableHead>
                      <TableHead className="text-right">Users&apos; Company Credit</TableHead>
                      <TableHead className="text-right">Users&apos; Personal Credit</TableHead>
                      <TableHead className="text-right">Total Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.companyCreditSummary.map((company) => (
                      <TableRow key={company.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold">
                              {company.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{company.name}</p>
                              <p className="text-xs text-gray-500">{company.code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{company.userCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatCurrency(company.companyCredit)}
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          {formatCurrency(company.usersTotalCompany)}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          {formatCurrency(company.usersTotalPersonal)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-purple-600">
                          {formatCurrency(company.totalCredit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Missing import helper component
function Smartphone({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}
