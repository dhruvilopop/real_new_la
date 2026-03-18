// Active Loans Section - SuperAdmin
// Enhanced with EMI Management Features

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { 
  Wallet, DollarSign, FileText, Receipt, RefreshCw, Trash2, Eye, 
  Calendar, IndianRupee, Clock, AlertTriangle, ChevronDown, ChevronUp, Edit,
  Settings, ToggleLeft, ToggleRight
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ActiveLoan {
  id: string;
  identifier: string;
  loanType: 'ONLINE' | 'OFFLINE';
  status: string;
  approvedAmount: number;
  interestRate: number;
  tenure: number;
  emiAmount: number;
  customer?: { name: string; phone?: string; email?: string; id?: string };
  company?: { name: string };
  nextEmi?: { id?: string; dueDate: string; amount: number; status: string; installmentNumber?: number };
  disbursementDate?: string;
  createdAt: string;
  emiSchedules?: any[];
}

interface ActiveLoansSectionProps {
  loans: ActiveLoan[];
  stats: {
    totalOnline: number;
    totalOffline: number;
    totalOnlineAmount: number;
    totalOfflineAmount: number;
  };
  filter: 'all' | 'online' | 'offline';
  loading: boolean;
  userRole?: string;
  userId?: string;
  onFilterChange: (filter: 'all' | 'online' | 'offline') => void;
  onRefresh: () => void;
  onDelete: (loan: ActiveLoan) => void;
  onView: (loan: ActiveLoan) => void;
  onPaymentComplete?: () => void;
}

export function ActiveLoansSection({
  loans,
  stats,
  filter,
  loading,
  userRole = 'SUPER_ADMIN',
  userId,
  onFilterChange,
  onRefresh,
  onDelete,
  onView,
  onPaymentComplete
}: ActiveLoansSectionProps) {
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showEmiDateDialog, setShowEmiDateDialog] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [selectedEmi, setSelectedEmi] = useState<any>(null);
  const [paymentType, setPaymentType] = useState<'FULL_EMI' | 'PARTIAL_PAYMENT' | 'INTEREST_ONLY'>('FULL_EMI');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [partialAmount, setPartialAmount] = useState('');
  const [nextPaymentDate, setNextPaymentDate] = useState<Date | undefined>(undefined);
  const [newEmiDate, setNewEmiDate] = useState<Date | undefined>(undefined);
  const [processing, setProcessing] = useState(false);
  const [emiDateReason, setEmiDateReason] = useState('');

  // EMI Settings State
  const [emiSettings, setEmiSettings] = useState<{[key: string]: {
    allowPartialPayment: boolean;
    allowInterestOnly: boolean;
    autoAdjustDates: boolean;
  }}>({});

  // Accountant cannot manage EMIs
  const canManageEmi = userRole !== 'ACCOUNTANT';

  // Update EMI setting
  const updateEmiSetting = async (emiId: string, field: string, value: boolean) => {
    try {
      const response = await fetch('/api/emi/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emiId, [field]: value })
      });
      
      if (response.ok) {
        setEmiSettings(prev => ({
          ...prev,
          [emiId]: {
            ...prev[emiId],
            [field]: value
          }
        }));
        toast({ title: 'Setting Updated', description: `${field} has been ${value ? 'enabled' : 'disabled'}` });
      } else {
        toast({ title: 'Error', description: 'Failed to update setting', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update setting', variant: 'destructive' });
    }
  };

  const filteredLoans = loans.filter(loan => {
    if (filter === 'all') return true;
    return loan.loanType === filter.toUpperCase();
  });

  const handlePayEmi = (loan: ActiveLoan, emi?: any) => {
    setSelectedLoan(loan);
    setSelectedEmi(emi || loan.nextEmi);
    setPaymentType('FULL_EMI');
    setPaymentMode('CASH');
    setPartialAmount('');
    setNextPaymentDate(undefined);
    setShowPaymentDialog(true);
  };

  const handleChangeEmiDate = (loan: ActiveLoan, emi?: any) => {
    setSelectedLoan(loan);
    setSelectedEmi(emi || loan.nextEmi);
    if (emi?.dueDate || loan.nextEmi?.dueDate) {
      setNewEmiDate(new Date(emi?.dueDate || loan.nextEmi?.dueDate));
    } else {
      setNewEmiDate(new Date());
    }
    setEmiDateReason('');
    setShowEmiDateDialog(true);
  };

  const processPayment = async () => {
    if (!selectedLoan || !selectedEmi || !userId) return;

    // Validation for partial payment
    if (paymentType === 'PARTIAL_PAYMENT') {
      if (!partialAmount || parseFloat(partialAmount) <= 0) {
        toast({ title: 'Error', description: 'Please enter a valid partial amount', variant: 'destructive' });
        return;
      }
      if (!nextPaymentDate) {
        toast({ title: 'Error', description: 'Please select when the remaining amount will be paid', variant: 'destructive' });
        return;
      }
    }

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('emiId', selectedEmi.id || selectedLoan.nextEmi?.id || '');
      formData.append('loanId', selectedLoan.id);
      formData.append('amount', paymentType === 'PARTIAL_PAYMENT' ? partialAmount : selectedEmi.amount?.toString() || '0');
      formData.append('paymentMode', paymentMode);
      formData.append('paidBy', userId);
      formData.append('paymentType', paymentType);

      if (paymentType === 'PARTIAL_PAYMENT') {
        formData.append('partialAmount', partialAmount);
        formData.append('nextPaymentDate', nextPaymentDate?.toISOString() || '');
      }

      const response = await fetch('/api/emi/pay', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Payment Successful',
          description: data.message || `EMI payment of ${formatCurrency(data.data?.paidAmount || 0)} processed successfully`
        });
        setShowPaymentDialog(false);
        onPaymentComplete?.();
        onRefresh();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to process payment', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({ title: 'Error', description: 'Failed to process payment', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const updateEmiDate = async () => {
    if (!selectedLoan || !selectedEmi || !newEmiDate || !userId) return;

    setProcessing(true);
    try {
      const response = await fetch('/api/emi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emiId: selectedEmi.id || selectedLoan.nextEmi?.id,
          action: 'change-due-date',
          data: {
            newDueDate: newEmiDate.toISOString(),
            reason: emiDateReason
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'EMI Date Updated',
          description: `Due date changed to ${format(newEmiDate, 'dd MMM yyyy')}`
        });
        setShowEmiDateDialog(false);
        onRefresh();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to update EMI date', variant: 'destructive' });
      }
    } catch (error) {
      console.error('EMI date update error:', error);
      toast({ title: 'Error', description: 'Failed to update EMI date', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const getPaymentDetails = () => {
    if (!selectedEmi) return { amount: 0, remaining: 0, principal: 0, interest: 0 };
    
    const totalAmount = selectedEmi.amount || 0;
    const paidAmount = selectedEmi.paidAmount || 0;
    const remaining = totalAmount - paidAmount;
    
    if (paymentType === 'FULL_EMI') {
      return { amount: remaining, remaining: 0, principal: remaining * 0.7, interest: remaining * 0.3 };
    } else if (paymentType === 'PARTIAL_PAYMENT') {
      const partial = parseFloat(partialAmount) || 0;
      return { amount: partial, remaining: remaining - partial, principal: partial * 0.7, interest: partial * 0.3 };
    } else {
      return { amount: remaining * 0.3, remaining: remaining, principal: 0, interest: remaining * 0.3 };
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Toggle Bar */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Filter by Type:</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filter === 'all' ? 'default' : 'outline'}
                  className={filter === 'all' ? 'bg-gray-700 hover:bg-gray-800' : ''}
                  onClick={() => onFilterChange('all')}
                >
                  All ({stats.totalOnline + stats.totalOffline})
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'online' ? 'default' : 'outline'}
                  className={filter === 'online' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}
                  onClick={() => onFilterChange('online')}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Online ({stats.totalOnline})
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'offline' ? 'default' : 'outline'}
                  className={filter === 'offline' ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-200 text-purple-700 hover:bg-purple-50'}
                  onClick={() => onFilterChange('offline')}
                >
                  <Receipt className="h-4 w-4 mr-1" />
                  Offline ({stats.totalOffline})
                </Button>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Active Loans</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.totalOnline + stats.totalOffline}</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Online Loans</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalOnline}</p>
                <p className="text-xs text-gray-400">{formatCurrency(stats.totalOnlineAmount)}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Offline Loans</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalOffline}</p>
                <p className="text-xs text-gray-400">{formatCurrency(stats.totalOfflineAmount)}</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg">
                <Receipt className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Disbursed</p>
                <p className="text-2xl font-bold text-teal-600">{formatCurrency(stats.totalOnlineAmount + stats.totalOfflineAmount)}</p>
              </div>
              <div className="p-2 bg-teal-50 rounded-lg">
                <DollarSign className="h-5 w-5 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Loans List */}
      <Card className="bg-white shadow-sm border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600" />
                Active Loans
                {filter !== 'all' && (
                  <Badge className={filter === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                    {filter.toUpperCase()} ONLY
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {filter === 'all' ? 'All disbursed loans (online + offline)' :
                 filter === 'online' ? 'Online loans from digital applications' :
                 'Offline loans created manually'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No {filter !== 'all' ? filter : ''} loans found</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh}>
                Load Loans
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredLoans.map((loan, index) => {
                const isOnline = loan.loanType === 'ONLINE';
                const bgColor = isOnline ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100';
                const gradientColors = isOnline ? 'from-blue-400 to-cyan-500' : 'from-purple-400 to-pink-500';
                const isExpanded = expandedLoan === loan.id;

                return (
                  <motion.div
                    key={`${loan.loanType}-${loan.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`border rounded-xl hover:shadow-md transition-all ${bgColor}`}
                  >
                    <div className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <Avatar className={`h-12 w-12 bg-gradient-to-br ${gradientColors}`}>
                            <AvatarFallback className="bg-transparent text-white font-semibold">
                              {loan.customer?.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-gray-900">{loan.identifier}</h4>
                              <Badge className={isOnline ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                                {loan.loanType}
                              </Badge>
                              {loan.status && (
                                <Badge className="bg-green-100 text-green-700">{loan.status}</Badge>
                              )}
                              {loan.nextEmi && loan.nextEmi.status === 'OVERDUE' && (
                                <Badge className="bg-red-100 text-red-700">EMI Overdue</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.phone || loan.customer?.email}</p>
                            {loan.company && (
                              <p className="text-xs text-gray-400">Company: {loan.company.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.approvedAmount)}</p>
                            <p className="text-xs text-gray-500">{loan.interestRate}% • {loan.tenure} months</p>
                            {loan.emiAmount > 0 && (
                              <p className="text-xs text-emerald-600">EMI: {formatCurrency(loan.emiAmount)}/mo</p>
                            )}
                            {loan.nextEmi && (
                              <p className="text-xs text-gray-400">Next EMI: {formatDate(loan.nextEmi.dueDate)}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {canManageEmi && loan.nextEmi && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="bg-emerald-500 hover:bg-emerald-600"
                                  onClick={() => handlePayEmi(loan)}
                                >
                                  <IndianRupee className="h-4 w-4 mr-1" />Pay EMI
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-amber-200 text-amber-600 hover:bg-amber-50"
                                  onClick={() => handleChangeEmiDate(loan)}
                                >
                                  <Calendar className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => onDelete(loan)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" className={isOnline ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'} onClick={() => onView(loan)}>
                              <Eye className="h-4 w-4 mr-1" />View
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded EMI Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-gray-100"
                        >
                          <div className="p-4 bg-white/50">
                            <h5 className="font-medium text-gray-700 mb-3">EMI Schedule</h5>
                            {loan.emiSchedules && loan.emiSchedules.length > 0 ? (
                              <div className="space-y-3">
                                {/* Toggle Settings for Loan */}
                                <div className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg border border-gray-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Settings className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-700">EMI Payment Options</span>
                                  </div>
                                  <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <Switch
                                        checked={emiSettings[loan.id]?.allowPartialPayment ?? true}
                                        onCheckedChange={(checked) => updateEmiSetting(loan.id, 'allowPartialPayment', checked)}
                                      />
                                      <span className="text-xs text-gray-600">Allow Partial</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <Switch
                                        checked={emiSettings[loan.id]?.allowInterestOnly ?? true}
                                        onCheckedChange={(checked) => updateEmiSetting(loan.id, 'allowInterestOnly', checked)}
                                      />
                                      <span className="text-xs text-gray-600">Allow Interest Only</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <Switch
                                        checked={emiSettings[loan.id]?.autoAdjustDates ?? true}
                                        onCheckedChange={(checked) => updateEmiSetting(loan.id, 'autoAdjustDates', checked)}
                                      />
                                      <span className="text-xs text-gray-600">Auto-Adjust Dates</span>
                                    </label>
                                  </div>
                                </div>
                                
                                {/* EMI List */}
                                <div className="grid gap-2">
                                  {loan.emiSchedules.slice(0, 6).map((emi: any, idx: number) => (
                                    <div 
                                      key={emi.id || idx}
                                      className={`flex items-center justify-between p-3 rounded-lg ${
                                        emi.paymentStatus === 'PAID' ? 'bg-green-50 border border-green-100' :
                                        emi.paymentStatus === 'OVERDUE' ? 'bg-red-50 border border-red-100' :
                                        emi.paymentStatus === 'PARTIALLY_PAID' ? 'bg-orange-50 border border-orange-100' :
                                        'bg-gray-50 border border-gray-100'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                          emi.paymentStatus === 'PAID' ? 'bg-green-200 text-green-700' :
                                          emi.paymentStatus === 'OVERDUE' ? 'bg-red-200 text-red-700' :
                                          emi.paymentStatus === 'PARTIALLY_PAID' ? 'bg-orange-200 text-orange-700' :
                                          'bg-gray-200 text-gray-700'
                                        }`}>
                                          #{emi.installmentNumber}
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium">{formatDate(emi.dueDate)}</p>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-xs text-gray-500">
                                              {emi.paymentStatus === 'PAID' ? 'Paid' : 
                                               emi.paymentStatus === 'OVERDUE' ? 'Overdue' :
                                               emi.paymentStatus === 'PARTIALLY_PAID' ? 'Partial' : 'Pending'}
                                            </p>
                                            {emi.paymentStatus === 'PARTIALLY_PAID' && emi.paidAmount && (
                                              <span className="text-xs text-orange-600">
                                                Remaining: {formatCurrency(emi.totalAmount - emi.paidAmount)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="text-right">
                                          <p className="font-medium">{formatCurrency(emi.totalAmount)}</p>
                                          {emi.paidAmount && emi.paidAmount > 0 && emi.paymentStatus !== 'PAID' && (
                                            <p className="text-xs text-emerald-600">Paid: {formatCurrency(emi.paidAmount)}</p>
                                          )}
                                        </div>
                                        {canManageEmi && emi.paymentStatus !== 'PAID' && (
                                          <div className="flex gap-1">
                                            <Button 
                                              size="sm" 
                                              variant="ghost"
                                              className="h-7 w-7 p-0"
                                              onClick={() => handlePayEmi(loan, emi)}
                                              title="Pay EMI"
                                            >
                                              <IndianRupee className="h-3 w-3" />
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="ghost"
                                              className="h-7 w-7 p-0"
                                              onClick={() => handleChangeEmiDate(loan, emi)}
                                              title="Change Date"
                                            >
                                              <Edit className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No EMI schedules available</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pay EMI Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-500" />
              Pay EMI
            </DialogTitle>
            <DialogDescription>
              {selectedLoan?.identifier} - {selectedLoan?.customer?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedEmi && (
            <div className="space-y-4 py-4">
              {/* EMI Details */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">EMI Number</span>
                  <span className="font-medium">#{selectedEmi.installmentNumber || 'Current'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Due Date</span>
                  <span className="font-medium">{formatDate(selectedEmi.dueDate)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedEmi.amount || 0)}</span>
                </div>
              </div>

              {/* Payment Type Selection */}
              <div className="space-y-2">
                <Label className="font-medium">Payment Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={paymentType === 'FULL_EMI' ? 'default' : 'outline'}
                    className={paymentType === 'FULL_EMI' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                    onClick={() => setPaymentType('FULL_EMI')}
                  >
                    Full EMI
                  </Button>
                  <Button
                    type="button"
                    variant={paymentType === 'PARTIAL_PAYMENT' ? 'default' : 'outline'}
                    className={paymentType === 'PARTIAL_PAYMENT' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                    onClick={() => setPaymentType('PARTIAL_PAYMENT')}
                  >
                    Partial
                  </Button>
                  <Button
                    type="button"
                    variant={paymentType === 'INTEREST_ONLY' ? 'default' : 'outline'}
                    className={paymentType === 'INTEREST_ONLY' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                    onClick={() => setPaymentType('INTEREST_ONLY')}
                  >
                    Interest Only
                  </Button>
                </div>
              </div>

              {/* Partial Payment Fields */}
              {paymentType === 'PARTIAL_PAYMENT' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Partial Amount</Label>
                    <Input
                      type="number"
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder="Enter amount..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>When will you pay the remaining amount?</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <Calendar className="h-4 w-4 mr-2" />
                          {nextPaymentDate ? format(nextPaymentDate, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={nextPaymentDate}
                          onSelect={setNextPaymentDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                      <p className="text-sm text-amber-700">
                        Subsequent EMI dates will be shifted based on your selected date.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Interest Only Info */}
              {paymentType === 'INTEREST_ONLY' && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium">Interest Only Payment</p>
                      <p className="mt-1">Only the interest portion will be paid. The principal will be added to next month's EMI.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Mode */}
              <div className="space-y-2">
                <Label className="font-medium">Payment Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Summary */}
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-700">Amount to Collect</span>
                  <span className="text-xl font-bold text-emerald-700">
                    {formatCurrency(getPaymentDetails().amount)}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  className="bg-emerald-500 hover:bg-emerald-600"
                  onClick={processPayment}
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Confirm Payment'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change EMI Date Dialog */}
      <Dialog open={showEmiDateDialog} onOpenChange={setShowEmiDateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-500" />
              Change EMI Date
            </DialogTitle>
            <DialogDescription>
              {selectedLoan?.identifier} - EMI #{selectedEmi?.installmentNumber || 'Current'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Current Due Date</span>
                <span className="font-medium">
                  {selectedEmi?.dueDate ? formatDate(selectedEmi.dueDate) : 'N/A'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>New Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    {newEmiDate ? format(newEmiDate, 'PPP') : 'Select new date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={newEmiDate}
                    onSelect={setNewEmiDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Input
                value={emiDateReason}
                onChange={(e) => setEmiDateReason(e.target.value)}
                placeholder="e.g., Customer request, financial hardship..."
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                <p className="text-sm text-amber-700">
                  Changing the EMI date will shift this EMI's due date. Subsequent EMIs may also be affected.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmiDateDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600"
              onClick={updateEmiDate}
              disabled={processing || !newEmiDate}
            >
              {processing ? 'Updating...' : 'Update Date'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
