'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, Wallet, Calendar, Clock, IndianRupee, Percent, CreditCard, 
  CheckCircle, AlertCircle, AlertTriangle, ChevronRight, Loader2,
  CalendarClock, TrendingUp, FileText, Building2, Phone, Mail
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

import { Building2 as Building2Icon } from 'lucide-react';

interface EMISchedule {
  id: string;
  installmentNumber: number;
  dueDate: string;
  originalDueDate?: string;
  totalAmount: number;
  principalAmount: number;
  interestAmount: number;
  outstandingPrincipal?: number;
  outstandingInterest?: number;
  paymentStatus: string;
  paidAmount: number;
  paidPrincipal?: number;
  paidInterest?: number;
  paidDate?: string;
  penaltyAmount: number;
  daysOverdue: number;
  isPartialPayment?: boolean;
  nextPaymentDate?: string;
  isInterestOnly?: boolean;
  principalDeferred?: boolean;
}

interface SessionForm {
  approvedAmount: number;
  interestRate: number;
  tenure: number;
  emiAmount: number;
  totalInterest: number;
  totalAmount: number;
  processingFee: number;
}

interface LoanDetails {
  id: string;
  applicationNo: string;
  status: string;
  loanType: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  company?: {
    id: string;
    name: string;
  };
  sessionForm?: SessionForm;
}

export default function CustomerLoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const loanId = params?.id as string;

  const [loan, setLoan] = useState<LoanDetails | null>(null);
  const [emiSchedules, setEmiSchedules] = useState<EMISchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmi, setSelectedEmi] = useState<EMISchedule | null>(null);
  
  // Payment dialogs
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPartialDialog, setShowPartialDialog] = useState(false);
  const [showInterestOnlyDialog, setShowInterestOnlyDialog] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  // Payment forms
  const [partialAmount, setPartialAmount] = useState('');
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');

  const fetchLoanDetails = useCallback(async () => {
    if (!loanId) return;
    setLoading(true);
    try {
      const [loanRes, emiRes] = await Promise.all([
        fetch(`/api/loan/details?loanId=${loanId}`),
        fetch(`/api/emi?loanId=${loanId}`)
      ]);
      
      if (loanRes.ok) {
        const loanData = await loanRes.json();
        setLoan(loanData.loan || loanData);
      }
      
      if (emiRes.ok) {
        const emiData = await emiRes.json();
        setEmiSchedules(emiData.schedules || []);
      }
    } catch (error) {
      console.error('Error fetching loan details:', error);
      toast({ title: 'Error', description: 'Failed to load loan details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    fetchLoanDetails();
  }, [fetchLoanDetails]);

  // Full EMI Payment
  const handleFullPayment = async () => {
    if (!selectedEmi) {
      toast({ title: 'Error', description: 'No EMI selected', variant: 'destructive' });
      return;
    }
    if (!user) {
      toast({ title: 'Error', description: 'Please log in to make payment', variant: 'destructive' });
      return;
    }
    if (!loanId) {
      toast({ title: 'Error', description: 'Loan ID is missing', variant: 'destructive' });
      return;
    }

    setPaymentLoading(true);
    console.log('Processing full payment:', { loanId, customerId: user.id, emiScheduleId: selectedEmi.id, amount: selectedEmi.totalAmount });
    
    try {
      const response = await fetch('/api/customer/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: loanId,
          customerId: user.id,
          emiScheduleId: selectedEmi.id,
          paymentType: 'FULL_EMI',
          amount: selectedEmi.totalAmount
        })
      });
      
      const data = await response.json();
      console.log('Payment response:', data);
      
      if (response.ok) {
        toast({ title: 'Payment Successful', description: 'Your EMI payment has been processed!' });
        setShowPaymentDialog(false);
        setSelectedEmi(null);
        fetchLoanDetails();
      } else {
        toast({ title: 'Error', description: data.error || 'Payment failed', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({ title: 'Error', description: 'Payment failed. Please try again.', variant: 'destructive' });
    } finally {
      setPaymentLoading(false);
    }
  };

  // Partial Payment with Date Shift
  const handlePartialPayment = async () => {
    if (!selectedEmi || !user || !partialAmount || !nextPaymentDate || !loanId) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    
    const amount = parseFloat(partialAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    if (amount >= selectedEmi.totalAmount) {
      toast({ title: 'Error', description: 'Partial amount must be less than total EMI', variant: 'destructive' });
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await fetch('/api/customer/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: loanId,
          customerId: user.id,
          emiScheduleId: selectedEmi.id,
          paymentType: 'PARTIAL',
          amount: amount,
          nextPaymentDate: nextPaymentDate,
          remarks: paymentRemarks
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({ 
          title: 'Partial Payment Successful', 
          description: `Payment of ${formatCurrency(amount)} processed. Remaining due on ${formatDate(nextPaymentDate)}` 
        });
        setShowPartialDialog(false);
        setPartialAmount('');
        setNextPaymentDate('');
        setPaymentRemarks('');
        setSelectedEmi(null);
        fetchLoanDetails();
      } else {
        toast({ title: 'Error', description: data.error || 'Payment failed', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Partial payment error:', error);
      toast({ title: 'Error', description: 'Payment failed', variant: 'destructive' });
    } finally {
      setPaymentLoading(false);
    }
  };

  // Interest Only Payment
  const handleInterestOnlyPayment = async () => {
    if (!selectedEmi || !user || !loanId) {
      toast({ title: 'Error', description: 'Missing required information', variant: 'destructive' });
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await fetch('/api/customer/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: loanId,
          customerId: user.id,
          emiScheduleId: selectedEmi.id,
          paymentType: 'INTEREST_ONLY',
          amount: selectedEmi.interestAmount,
          remarks: paymentRemarks || 'Interest only payment - principal deferred'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({ 
          title: 'Interest Payment Successful', 
          description: `Interest of ${formatCurrency(selectedEmi.interestAmount)} paid. Principal shifted to next EMI.` 
        });
        setShowInterestOnlyDialog(false);
        setPaymentRemarks('');
        setSelectedEmi(null);
        fetchLoanDetails();
      } else {
        toast({ title: 'Error', description: data.error || 'Payment failed', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Interest only payment error:', error);
      toast({ title: 'Error', description: 'Payment failed', variant: 'destructive' });
    } finally {
      setPaymentLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      PENDING: { className: 'bg-amber-100 text-amber-700', label: 'Pending' },
      PAID: { className: 'bg-emerald-100 text-emerald-700', label: 'Paid' },
      OVERDUE: { className: 'bg-red-100 text-red-700', label: 'Overdue' },
      PARTIALLY_PAID: { className: 'bg-orange-100 text-orange-700', label: 'Partial' },
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  // Calculate stats
  const paidEmis = emiSchedules.filter(e => e.paymentStatus === 'PAID');
  const pendingEmis = emiSchedules.filter(e => e.paymentStatus === 'PENDING' || e.paymentStatus === 'PARTIALLY_PAID');
  const overdueEmis = emiSchedules.filter(e => e.paymentStatus === 'OVERDUE');
  const progress = emiSchedules.length > 0 ? (paidEmis.length / emiSchedules.length) * 100 : 0;
  const totalPaid = paidEmis.reduce((sum, e) => sum + e.paidAmount, 0);
  const totalOutstanding = pendingEmis.reduce((sum, e) => sum + (e.totalAmount - e.paidAmount), 0) + overdueEmis.reduce((sum, e) => sum + e.totalAmount, 0);

  // Sequential EMI Payment - Check if this EMI can be paid
  const canPayEmi = (emi: EMISchedule) => {
    // If already paid, no need to pay
    if (emi.paymentStatus === 'PAID') return { canPay: false, reason: 'Already paid' };
    
    // Find the first unpaid EMI
    const sortedEmis = [...emiSchedules].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const firstUnpaidEmi = sortedEmis.find(e => e.paymentStatus !== 'PAID');
    
    // If this is the first unpaid EMI, allow payment
    if (firstUnpaidEmi && firstUnpaidEmi.id === emi.id) {
      return { canPay: true, reason: '' };
    }
    
    // If trying to pay an EMI before the first unpaid one
    if (firstUnpaidEmi && emi.installmentNumber > firstUnpaidEmi.installmentNumber) {
      return { 
        canPay: false, 
        reason: `Please pay EMI #${firstUnpaidEmi.installmentNumber} first` 
      };
    }
    
    return { canPay: true, reason: '' };
  };

  // Get first unpaid EMI for sequential payment
  const getFirstUnpaidEmi = () => {
    const sortedEmis = [...emiSchedules].sort((a, b) => a.installmentNumber - b.installmentNumber);
    return sortedEmis.find(e => e.paymentStatus !== 'PAID');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Loan not found</p>
          <Button className="mt-4" onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Loans</span>
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">{loan.applicationNo}</h1>
              <p className="text-emerald-100">{loan.loanType} Loan</p>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 text-lg px-4 py-1">
              Active
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <IndianRupee className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Loan Amount</p>
                  <p className="font-bold text-lg">{formatCurrency(loan.sessionForm?.approvedAmount || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Paid</p>
                  <p className="font-bold text-lg text-blue-600">{formatCurrency(totalPaid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Outstanding</p>
                  <p className="font-bold text-lg text-amber-600">{formatCurrency(totalOutstanding)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Progress</p>
                  <p className="font-bold text-lg">{Math.round(progress)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Repayment Progress</span>
              <span className="text-sm text-gray-500">{paidEmis.length} of {emiSchedules.length} EMIs paid</span>
            </div>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>

        {/* Overdue Alert */}
        {overdueEmis.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800">{overdueEmis.length} Overdue EMI(s)</p>
                  <p className="text-sm text-red-600">
                    Total overdue: {formatCurrency(overdueEmis.reduce((s, e) => s + e.totalAmount, 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loan Details */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Interest Rate</p>
                <p className="font-semibold">{loan.sessionForm?.interestRate || 0}% p.a.</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tenure</p>
                <p className="font-semibold">{loan.sessionForm?.tenure || 0} months</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">EMI Amount</p>
                <p className="font-semibold">{formatCurrency(loan.sessionForm?.emiAmount || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Interest</p>
                <p className="font-semibold">{formatCurrency(loan.sessionForm?.totalInterest || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="font-semibold">{formatCurrency(loan.sessionForm?.totalAmount || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Processing Fee</p>
                <p className="font-semibold">{formatCurrency(loan.sessionForm?.processingFee || 0)}</p>
              </div>
            </div>
            
            {loan.company && (
              <>
                <Separator className="my-4" />
                <div className="flex items-center gap-3">
                  <Building2Icon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Lender</p>
                    <p className="font-semibold">{loan.company.name}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* EMI Schedule - Customer sees only EMI numbers, no money */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">EMI Schedule</CardTitle>
            <CardDescription>Click on pending EMI to make payment (must pay in order)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {emiSchedules.sort((a, b) => a.installmentNumber - b.installmentNumber).map((emi, index) => {
                  const isPaid = emi.paymentStatus === 'PAID';
                  const isOverdue = emi.paymentStatus === 'OVERDUE';
                  const isPartial = emi.paymentStatus === 'PARTIALLY_PAID';
                  const { canPay, reason } = canPayEmi(emi);
                  const firstUnpaid = getFirstUnpaidEmi();
                  const isNextToPay = firstUnpaid && firstUnpaid.id === emi.id;
                  
                  return (
                    <motion.div
                      key={emi.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 ${!isPaid && canPay ? 'cursor-pointer hover:bg-gray-50' : ''} ${!isPaid && !canPay ? 'opacity-60 bg-gray-50' : ''}`}
                      onClick={() => {
                        if (!isPaid && canPay) {
                          setSelectedEmi(emi);
                          setShowPaymentDialog(true);
                        } else if (!isPaid && !canPay) {
                          toast({ 
                            title: 'Sequential Payment Required', 
                            description: reason,
                            variant: 'destructive' 
                          });
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            isPaid ? 'bg-emerald-100' : isOverdue ? 'bg-red-100' : isNextToPay ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-gray-100'
                          }`}>
                            {isPaid ? (
                              <CheckCircle className="h-6 w-6 text-emerald-600" />
                            ) : isOverdue ? (
                              <AlertTriangle className="h-6 w-6 text-red-600" />
                            ) : (
                              <span className={`font-bold ${isNextToPay ? 'text-amber-600' : 'text-gray-400'}`}>#{emi.installmentNumber}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">EMI #{emi.installmentNumber}</p>
                              {getStatusBadge(emi.paymentStatus)}
                              {isNextToPay && !isPaid && (
                                <Badge className="bg-amber-500 text-white text-xs">Pay Next</Badge>
                              )}
                              {isPartial && emi.nextPaymentDate && (
                                <span className="text-xs text-gray-500">
                                  Next: {formatDate(emi.nextPaymentDate)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              Due: {formatDate(emi.dueDate)}
                            </p>
                            {!isPaid && !canPay && (
                              <p className="text-xs text-red-500 mt-1">{reason}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {/* Hide money amount - only show status */}
                          {isPaid && emi.paidDate && (
                            <div className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">Paid</span>
                            </div>
                          )}
                          {isPartial && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm">Partial</span>
                            </div>
                          )}
                          {isOverdue && emi.daysOverdue > 0 && (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm">{emi.daysOverdue}d overdue</span>
                            </div>
                          )}
                          {!isPaid && canPay && (
                            <ChevronRight className="h-5 w-5 text-amber-500 ml-auto" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Payment Options Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => {
        setShowPaymentDialog(open);
        if (!open) setSelectedEmi(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay EMI #{selectedEmi?.installmentNumber}</DialogTitle>
            <DialogDescription>
              Due: {selectedEmi && formatDate(selectedEmi.dueDate)}
            </DialogDescription>
          </DialogHeader>
          
          {/* Sequential payment warning */}
          {selectedEmi && (() => {
            const { canPay, reason } = canPayEmi(selectedEmi);
            return !canPay ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">{reason}</span>
                </div>
              </div>
            ) : null;
          })()}
          
          <div className="space-y-3 py-4">
            {/* Full Payment Option */}
            <Button 
              className="w-full h-16 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              onClick={handleFullPayment}
              disabled={paymentLoading}
            >
              {paymentLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex flex-col items-center">
                  <IndianRupee className="h-5 w-5 mb-1" />
                  <span className="font-semibold">Pay Full EMI</span>
                  <span className="text-xs opacity-80">{selectedEmi && formatCurrency(selectedEmi.totalAmount)}</span>
                </div>
              )}
            </Button>
            
            <div className="text-center text-sm text-gray-500">— or choose flexible payment —</div>
            
            {/* Partial Payment Option */}
            <Button 
              variant="outline"
              className="w-full h-16 border-amber-300 hover:bg-amber-50"
              onClick={() => {
                setShowPaymentDialog(false);
                setShowPartialDialog(true);
              }}
            >
              <div className="flex flex-col items-center">
                <CreditCard className="h-5 w-5 mb-1 text-amber-600" />
                <span className="font-semibold">Partial Payment</span>
                <span className="text-xs text-gray-500">Pay part now, rest later</span>
              </div>
            </Button>
            
            {/* Interest Only Option */}
            <Button 
              variant="outline"
              className="w-full h-16 border-blue-300 hover:bg-blue-50"
              onClick={() => {
                setShowPaymentDialog(false);
                setShowInterestOnlyDialog(true);
              }}
            >
              <div className="flex flex-col items-center">
                <Percent className="h-5 w-5 mb-1 text-blue-600" />
                <span className="font-semibold">Interest Only</span>
                <span className="text-xs text-gray-500">Pay interest, defer principal</span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partial Payment Dialog */}
      <Dialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Partial Payment</DialogTitle>
            <DialogDescription>
              Pay a portion of your EMI now and schedule the remaining payment
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                Total EMI: <strong>{selectedEmi && formatCurrency(selectedEmi.totalAmount)}</strong>
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Principal: {selectedEmi && formatCurrency(selectedEmi.principalAmount)} • 
                Interest: {selectedEmi && formatCurrency(selectedEmi.interestAmount)}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Payment Amount *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Next Payment Date *</Label>
              <Input
                type="date"
                value={nextPaymentDate}
                onChange={(e) => setNextPaymentDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Remarks (Optional)</Label>
              <Input
                placeholder="Any notes..."
                value={paymentRemarks}
                onChange={(e) => setPaymentRemarks(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPartialDialog(false)}>Cancel</Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600"
              onClick={handlePartialPayment}
              disabled={paymentLoading || !partialAmount || !nextPaymentDate}
            >
              {paymentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Partial Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interest Only Dialog */}
      <Dialog open={showInterestOnlyDialog} onOpenChange={setShowInterestOnlyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Interest Only Payment</DialogTitle>
            <DialogDescription>
              Pay only the interest amount and defer the principal to next month
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-800">Interest Amount:</span>
                <span className="font-bold text-blue-800 text-lg">
                  {selectedEmi && formatCurrency(selectedEmi.interestAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-600">Principal (deferred):</span>
                <span className="text-blue-600">{selectedEmi && formatCurrency(selectedEmi.principalAmount)}</span>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>How it works:</strong>
              </p>
              <ul className="text-xs text-amber-700 mt-2 space-y-1 list-disc list-inside">
                <li>You pay only the interest portion now</li>
                <li>The principal amount is added to next month's EMI</li>
                <li>Your EMI schedule shifts accordingly</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Label>Remarks (Optional)</Label>
              <Input
                placeholder="Any notes..."
                value={paymentRemarks}
                onChange={(e) => setPaymentRemarks(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterestOnlyDialog(false)}>Cancel</Button>
            <Button 
              className="bg-blue-500 hover:bg-blue-600"
              onClick={handleInterestOnlyPayment}
              disabled={paymentLoading}
            >
              {paymentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${selectedEmi && formatCurrency(selectedEmi.interestAmount)} Interest`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
