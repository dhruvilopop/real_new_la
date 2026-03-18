'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  User, Phone, MapPin, Calendar, IndianRupee, Percent, FileText, 
  Building2, Clock, CheckCircle, XCircle, AlertTriangle, Eye, 
  CreditCard, Banknote, Wallet, ArrowRight, Calculator, Receipt,
  ChevronDown, ChevronUp, Printer, Download, Mail, MessageSquare
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface OfflineLoanDetailPanelProps {
  loanId: string | null;
  open: boolean;
  onClose: () => void;
  userId?: string;
  userRole?: string;
  onPaymentSuccess?: () => void;
}

interface LoanDetail {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAadhaar?: string;
  customerPan?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerPincode?: string;
  customerDOB?: string;
  customerOccupation?: string;
  customerMonthlyIncome?: number;
  reference1Name?: string;
  reference1Phone?: string;
  reference1Relation?: string;
  reference2Name?: string;
  reference2Phone?: string;
  reference2Relation?: string;
  loanType: string;
  loanAmount: number;
  interestRate: number;
  tenure: number;
  emiAmount: number;
  processingFee: number;
  disbursementDate: string;
  disbursementMode: string;
  disbursementRef?: string;
  startDate: string;
  status: string;
  notes?: string;
  internalNotes?: string;
  createdAt: string;
  createdByRole: string;
  company?: { id: string; name: string; code: string };
  customerId?: string;
  allowInterestOnly?: boolean;
  allowPartialPayment?: boolean;
  emis: EMI[];
}

interface EMI {
  id: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  outstandingPrincipal: number;
  paidAmount: number;
  paidPrincipal: number;
  paidInterest: number;
  paymentStatus: string;
  paidDate?: string;
  paymentMode?: string;
  paymentReference?: string;
  collectedById?: string;
  collectedByName?: string;
}

export default function OfflineLoanDetailPanel({
  loanId,
  open,
  onClose,
  userId,
  userRole,
  onPaymentSuccess
}: OfflineLoanDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [summary, setSummary] = useState<any>(null);
  
  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedEmi, setSelectedEmi] = useState<EMI | null>(null);
  const [paymentType, setPaymentType] = useState<'FULL' | 'PARTIAL' | 'INTEREST_ONLY'>('FULL');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [creditType, setCreditType] = useState<'COMPANY' | 'PERSONAL'>('COMPANY');
  const [bankAccountId, setBankAccountId] = useState('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    if (loanId && open) {
      fetchLoanDetails();
      fetchBankAccounts();
    }
  }, [loanId, open]);

  const fetchLoanDetails = async () => {
    if (!loanId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/offline-loan?loanId=${loanId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLoan(data.loan);
          setSummary(data.summary);
        }
      }
    } catch (error) {
      console.error('Error fetching loan details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await fetch('/api/accounting/bank?action=list');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBankAccounts(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const openPaymentDialog = (emi: EMI) => {
    if (emi.paymentStatus === 'PAID') return;
    setSelectedEmi(emi);
    setPaymentAmount(emi.totalAmount - (emi.paidAmount || 0));
    setPaymentType('FULL');
    setPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedEmi || !userId) return;
    
    if (paymentType === 'PARTIAL' && paymentAmount <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    setProcessingPayment(true);
    try {
      const res = await fetch('/api/offline-loan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay-emi',
          emiId: selectedEmi.id,
          userId,
          userRole,
          paymentType,
          amount: paymentType === 'PARTIAL' ? paymentAmount : undefined,
          paymentMode,
          paymentReference,
          bankAccountId,
          creditType
        })
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Payment Successful',
          description: `EMI #${selectedEmi.installmentNumber} paid. Credit added: ₹${data.creditAdded}`
        });
        setPaymentDialogOpen(false);
        fetchLoanDetails();
        onPaymentSuccess?.();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to process payment', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({ title: 'Error', description: 'Failed to process payment', variant: 'destructive' });
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-700 border-green-200';
      case 'PENDING': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'OVERDUE': return 'bg-red-100 text-red-700 border-red-200';
      case 'PARTIALLY_PAID': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'INTEREST_ONLY_PAID': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getLoanStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-700';
      case 'CLOSED': return 'bg-gray-100 text-gray-700';
      case 'DEFAULTED': return 'bg-red-100 text-red-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  if (!loan) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Loan Details</SheetTitle>
          </SheetHeader>
          <div className="flex items-center justify-center h-64">
            {loading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            ) : (
              <p className="text-gray-500">Select a loan to view details</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  {loan.loanNumber}
                </SheetTitle>
                <SheetDescription>
                  Complete loan details and EMI management
                </SheetDescription>
              </div>
              <Badge className={getLoanStatusColor(loan.status)}>{loan.status}</Badge>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Quick Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
                <CardContent className="p-3">
                  <p className="text-xs text-emerald-600">Loan Amount</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(loan.loanAmount)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="p-3">
                  <p className="text-xs text-blue-600">Interest Rate</p>
                  <p className="text-lg font-bold text-blue-700">{loan.interestRate}% p.a.</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
                <CardContent className="p-3">
                  <p className="text-xs text-purple-600">Monthly EMI</p>
                  <p className="text-lg font-bold text-purple-700">{formatCurrency(loan.emiAmount)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                <CardContent className="p-3">
                  <p className="text-xs text-amber-600">Outstanding</p>
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(summary?.totalOutstanding || 0)}</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="customer" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="customer">Customer</TabsTrigger>
                <TabsTrigger value="loan">Loan Info</TabsTrigger>
                <TabsTrigger value="emi">EMIs</TabsTrigger>
                <TabsTrigger value="documents">More</TabsTrigger>
              </TabsList>

              {/* Customer Tab */}
              <TabsContent value="customer" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" /> Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Full Name</p>
                        <p className="font-medium">{loan.customerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="font-medium flex items-center gap-1">
                          <Phone className="h-3 w-3" />{loan.customerPhone}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="font-medium">{loan.customerEmail || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">PAN Number</p>
                        <p className="font-medium font-mono">{loan.customerPan || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Aadhaar Number</p>
                        <p className="font-medium font-mono">{loan.customerAadhaar ? `XXXX-XXXX-${loan.customerAadhaar.slice(-4)}` : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Date of Birth</p>
                        <p className="font-medium">{loan.customerDOB ? formatDate(loan.customerDOB) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Occupation</p>
                        <p className="font-medium">{loan.customerOccupation || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Monthly Income</p>
                        <p className="font-medium">{loan.customerMonthlyIncome ? formatCurrency(loan.customerMonthlyIncome) : 'N/A'}</p>
                      </div>
                      <div className="col-span-2 md:col-span-3">
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="font-medium flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {loan.customerAddress || 'N/A'}
                          {loan.customerCity && `, ${loan.customerCity}`}
                          {loan.customerState && `, ${loan.customerState}`}
                          {loan.customerPincode && ` - ${loan.customerPincode}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Guardians */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" /> Guardian / References
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {loan.reference1Name && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium">{loan.reference1Name}</p>
                          <p className="text-sm text-gray-500">{loan.reference1Phone}</p>
                          <p className="text-xs text-gray-400">{loan.reference1Relation}</p>
                        </div>
                      )}
                      {loan.reference2Name && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium">{loan.reference2Name}</p>
                          <p className="text-sm text-gray-500">{loan.reference2Phone}</p>
                          <p className="text-xs text-gray-400">{loan.reference2Relation}</p>
                        </div>
                      )}
                      {!loan.reference1Name && !loan.reference2Name && (
                        <p className="text-gray-500 col-span-2">No guardians/references added</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Loan Info Tab */}
              <TabsContent value="loan" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <IndianRupee className="h-4 w-4" /> Loan Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Loan Type</p>
                        <p className="font-medium">{loan.loanType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Loan Amount</p>
                        <p className="font-bold text-lg text-emerald-600">{formatCurrency(loan.loanAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Interest Rate</p>
                        <p className="font-medium">{loan.interestRate}% p.a.</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tenure</p>
                        <p className="font-medium">{loan.tenure} months</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">EMI Amount</p>
                        <p className="font-bold text-purple-600">{formatCurrency(loan.emiAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Processing Fee</p>
                        <p className="font-medium">{formatCurrency(loan.processingFee)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Interest</p>
                        <p className="font-medium">{formatCurrency((loan.emiAmount * loan.tenure) - loan.loanAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Repayment</p>
                        <p className="font-bold text-blue-600">{formatCurrency(loan.emiAmount * loan.tenure)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Company</p>
                        <p className="font-medium flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{loan.company?.name || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Disbursement Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Disbursement Date</p>
                        <p className="font-medium">{formatDate(loan.disbursementDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Disbursement Mode</p>
                        <p className="font-medium">{loan.disbursementMode}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Reference Number</p>
                        <p className="font-medium font-mono">{loan.disbursementRef || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">EMI Start Date</p>
                        <p className="font-medium">{formatDate(loan.startDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Created By</p>
                        <p className="font-medium">{loan.createdByRole}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Created At</p>
                        <p className="font-medium">{formatDate(loan.createdAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Summary */}
                <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wallet className="h-4 w-4" /> Payment Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Total EMIs</p>
                        <p className="text-xl font-bold">{summary?.totalEMIs || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Paid EMIs</p>
                        <p className="text-xl font-bold text-green-600">{summary?.paidEMIs || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pending EMIs</p>
                        <p className="text-xl font-bold text-amber-600">{summary?.pendingEMIs || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Overdue EMIs</p>
                        <p className="text-xl font-bold text-red-600">{summary?.overdueEMIs || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Amount</p>
                        <p className="font-bold">{formatCurrency(summary?.totalAmount || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Paid</p>
                        <p className="font-bold text-green-600">{formatCurrency(summary?.totalPaid || 0)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Outstanding</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(summary?.totalOutstanding || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* EMI Tab */}
              <TabsContent value="emi" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> EMI Schedule
                    </CardTitle>
                    <CardDescription>Click on pending EMIs to make payment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {loan.emis.map((emi) => (
                          <motion.div
                            key={emi.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-3 rounded-lg border ${
                              emi.paymentStatus === 'PAID' 
                                ? 'bg-green-50 border-green-200' 
                                : emi.paymentStatus === 'OVERDUE'
                                  ? 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100'
                                  : 'bg-white border-gray-200 cursor-pointer hover:bg-gray-50'
                            }`}
                            onClick={() => openPaymentDialog(emi)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  emi.paymentStatus === 'PAID' 
                                    ? 'bg-green-200 text-green-700' 
                                    : emi.paymentStatus === 'OVERDUE'
                                      ? 'bg-red-200 text-red-700'
                                      : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {emi.paymentStatus === 'PAID' ? (
                                    <CheckCircle className="h-5 w-5" />
                                  ) : (
                                    <span className="font-bold">{emi.installmentNumber}</span>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">EMI #{emi.installmentNumber}</p>
                                    <Badge className={getStatusColor(emi.paymentStatus)}>
                                      {emi.paymentStatus.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-500">Due: {formatDate(emi.dueDate)}</p>
                                  {emi.paidDate && (
                                    <p className="text-xs text-green-600">Paid: {formatDate(emi.paidDate)}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">{formatCurrency(emi.totalAmount)}</p>
                                <p className="text-xs text-gray-500">
                                  Principal: {formatCurrency(emi.principalAmount)} | Interest: {formatCurrency(emi.interestAmount)}
                                </p>
                                {emi.paymentStatus !== 'PAID' && emi.paymentStatus !== 'PENDING' && (
                                  <p className="text-xs text-amber-600">
                                    Paid: {formatCurrency(emi.paidAmount)} | Remaining: {formatCurrency(emi.totalAmount - emi.paidAmount)}
                                  </p>
                                )}
                                {emi.collectedByName && (
                                  <p className="text-xs text-gray-400">Collected by: {emi.collectedByName}</p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* More Tab */}
              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Notes & Additional Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loan.notes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Notes</p>
                        <p className="p-3 bg-gray-50 rounded-lg">{loan.notes}</p>
                      </div>
                    )}
                    {loan.internalNotes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Internal Notes</p>
                        <p className="p-3 bg-amber-50 rounded-lg border border-amber-200">{loan.internalNotes}</p>
                      </div>
                    )}
                    {!loan.notes && !loan.internalNotes && (
                      <p className="text-gray-500">No additional notes</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              Pay EMI #{selectedEmi?.installmentNumber}
            </DialogTitle>
            <DialogDescription>
              EMI Amount: {selectedEmi && formatCurrency(selectedEmi.totalAmount)}
              {selectedEmi && selectedEmi.paidAmount > 0 && (
                <span className="text-amber-600"> (Already paid: {formatCurrency(selectedEmi.paidAmount)})</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Payment Type Selection */}
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={(v) => {
                setPaymentType(v as any);
                if (v === 'FULL' && selectedEmi) {
                  setPaymentAmount(selectedEmi.totalAmount - (selectedEmi.paidAmount || 0));
                } else if (v === 'INTEREST_ONLY' && selectedEmi) {
                  setPaymentAmount(selectedEmi.interestAmount);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">Full Payment ({selectedEmi && formatCurrency(selectedEmi.totalAmount - (selectedEmi.paidAmount || 0))})</SelectItem>
                  <SelectItem value="PARTIAL" disabled={loan?.allowPartialPayment === false}>
                    Partial Payment {loan?.allowPartialPayment === false && '(Disabled)'}
                  </SelectItem>
                  <SelectItem value="INTEREST_ONLY" disabled={loan?.allowInterestOnly === false}>
                    Interest Only ({selectedEmi && formatCurrency(selectedEmi.interestAmount)}) {loan?.allowInterestOnly === false && '(Disabled)'}
                  </SelectItem>
                </SelectContent>
              </Select>
              {loan?.allowInterestOnly === false && loan?.allowPartialPayment === false && (
                <p className="text-xs text-amber-600">Only full payments are allowed for this loan</p>
              )}
            </div>

            {/* Partial Amount Input */}
            {paymentType === 'PARTIAL' && loan?.allowPartialPayment !== false && (
              <div className="space-y-2">
                <Label>Amount to Pay</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Enter amount"
                />
                <p className="text-xs text-gray-500">
                  Remaining: {selectedEmi && formatCurrency(selectedEmi.totalAmount - (selectedEmi.paidAmount || 0))}
                </p>
              </div>
            )}

            {/* Payment Mode */}
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bank Account Selection */}
            {(paymentMode === 'BANK_TRANSFER' || paymentMode === 'CASH') && bankAccounts.length > 0 && (
              <div className="space-y-2">
                <Label>Select Bank Account</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.bankName} - {acc.accountNumber} (₹{acc.currentBalance?.toLocaleString()})
                        {acc.isDefault && ' ★'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Credit Type Selection */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <Label className="text-purple-800">Increase Which Credit?</Label>
              <Select value={creditType} onValueChange={(v) => setCreditType(v as any)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Company Credit
                    </div>
                  </SelectItem>
                  <SelectItem value="PERSONAL">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Personal Credit
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-purple-600 mt-2">
                The collected amount will be added to your selected credit balance
              </p>
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label>Reference Number (Optional)</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transaction ID, Cheque No., etc."
              />
            </div>

            {/* Summary */}
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex justify-between items-center">
                <span className="text-emerald-700">Amount to Pay:</span>
                <span className="font-bold text-emerald-700">{formatCurrency(paymentAmount)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button 
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={handlePayment}
              disabled={processingPayment}
            >
              {processingPayment ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
