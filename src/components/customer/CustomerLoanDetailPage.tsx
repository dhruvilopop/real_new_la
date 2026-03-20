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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, Wallet, Calendar, Clock, IndianRupee, Percent, CreditCard, 
  CheckCircle, AlertCircle, AlertTriangle, ChevronRight, Loader2,
  CalendarClock, TrendingUp, FileText, Building2, Phone, Mail,
  QrCode, Copy, Upload, Image as ImageIcon, Info
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

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
  partialPaymentCount?: number;
  remainingAmount?: number;
  partialPaymentNumber?: number;
  loanApplicationId?: string;
}

interface PaymentSettings {
  enableFullPayment: boolean;
  enablePartialPayment: boolean;
  enableInterestOnly: boolean;
  maxPartialPayments: number;
  maxInterestOnlyPerLoan: number;
  companyUpiId?: string;
  companyQrCodeUrl?: string;
  collectionBankAccountId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankBranch?: string;
}

interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
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
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [emiSpecificSettings, setEmiSpecificSettings] = useState<{
    enableFullPayment: boolean;
    enablePartialPayment: boolean;
    enableInterestOnly: boolean;
  } | null>(null);
  
  // Payment dialogs
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<'FULL_EMI' | 'PARTIAL' | 'INTEREST_ONLY'>('FULL_EMI');
  
  // Payment forms
  const [partialAmount, setPartialAmount] = useState('');
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

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

  // Fetch payment settings
  const fetchPaymentSettings = useCallback(async () => {
    if (!loanId) return;
    try {
      const response = await fetch(`/api/payment-request?action=settings&loanApplicationId=${loanId}`);
      const data = await response.json();
      if (data.success && data.settings) {
        setPaymentSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  }, [loanId]);

  // Fetch EMI-specific payment settings
  const fetchEmiSpecificSettings = useCallback(async (emiScheduleId: string) => {
    try {
      const response = await fetch(`/api/emi-payment-settings?emiScheduleId=${emiScheduleId}`);
      const data = await response.json();
      if (data.success && data.settings) {
        setEmiSpecificSettings({
          enableFullPayment: data.settings.enableFullPayment,
          enablePartialPayment: data.settings.enablePartialPayment,
          enableInterestOnly: data.settings.enableInterestOnly
        });
      }
    } catch (error) {
      console.error('Error fetching EMI specific settings:', error);
      setEmiSpecificSettings(null);
    }
  }, []);

  useEffect(() => {
    fetchLoanDetails();
    fetchPaymentSettings();
  }, [fetchLoanDetails, fetchPaymentSettings]);

  // Handle proof file upload
  const handleProofUpload = async (file: File): Promise<string | null> => {
    console.log('handleProofUpload called with file:', file?.name, 'size:', file?.size, 'type:', file?.type);
    
    if (!file) {
      console.log('handleProofUpload: No file provided');
      return null;
    }
    
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', 'emi_proof');
      
      console.log('Uploading proof to /api/upload/document...');
      
      const response = await fetch('/api/upload/document', {
        method: 'POST',
        body: formData
      });
      
      console.log('Upload response status:', response.status);
      
      const data = await response.json();
      console.log('Upload response data:', data);
      
      if (data.success && data.url) {
        console.log('Upload successful, URL:', data.url);
        return data.url;
      }
      
      console.log('Upload failed:', data.error);
      throw new Error(data.error || 'Upload failed');
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast({ title: 'Upload Error', description: `Failed to upload proof: ${(error as Error).message}`, variant: 'destructive' });
      return null;
    } finally {
      setUploadingProof(false);
      console.log('handleProofUpload completed');
    }
  };

  // Submit payment request
  const handleSubmitPayment = async () => {
    console.log('=== handleSubmitPayment STARTED ===');
    console.log('Form values:', {
      selectedEmi: selectedEmi?.id,
      user: user?.id,
      loanId,
      selectedPaymentType,
      partialAmount,
      nextPaymentDate,
      utrNumber,
      proofFile: proofFile?.name,
      proofPreview: proofPreview ? 'exists' : null,
      paymentLoading,
      uploadingProof
    });

    // Validate required info
    if (!selectedEmi || !user || !loanId) {
      console.log('VALIDATION FAILED: Missing required info');
      toast({ title: 'Error', description: 'Missing required information. Please try again.', variant: 'destructive' });
      return;
    }

    // Validate based on payment type
    if (selectedPaymentType === 'PARTIAL') {
      console.log('Validating PARTIAL payment...');
      
      const partialNum = parseFloat(partialAmount);
      console.log('Partial amount parsed:', partialNum);
      
      if (!partialAmount || isNaN(partialNum) || partialNum <= 0) {
        console.log('VALIDATION FAILED: Invalid partial amount');
        toast({ title: 'Error', description: 'Please enter a valid partial amount', variant: 'destructive' });
        return;
      }
      
      if (partialNum >= selectedEmi.totalAmount) {
        console.log('VALIDATION FAILED: Partial amount >= total');
        toast({ title: 'Error', description: 'Partial amount must be less than total EMI amount', variant: 'destructive' });
        return;
      }
      
      if (!nextPaymentDate) {
        console.log('VALIDATION FAILED: Missing next payment date');
        toast({ title: 'Error', description: 'Please select a date for remaining payment', variant: 'destructive' });
        return;
      }
      
      // Validate date is after original due date
      const newDate = new Date(nextPaymentDate + 'T00:00:00');
      const dueDate = new Date(selectedEmi.dueDate);
      console.log('Date validation:', { 
        nextPaymentDate, 
        newDate: newDate.toISOString(), 
        dueDate: dueDate.toISOString(), 
        isValid: newDate > dueDate 
      });
      
      if (newDate <= dueDate) {
        console.log('VALIDATION FAILED: Date not after due date');
        toast({ title: 'Error', description: 'New date must be after the original due date', variant: 'destructive' });
        return;
      }
      console.log('PARTIAL payment validation PASSED');
    }

    if (!utrNumber || utrNumber.trim() === '') {
      console.log('VALIDATION FAILED: Missing UTR number');
      toast({ title: 'Error', description: 'Please enter UTR/Reference number', variant: 'destructive' });
      return;
    }

    if (!proofFile && !proofPreview) {
      console.log('VALIDATION FAILED: Missing proof file');
      toast({ title: 'Error', description: 'Please upload payment proof screenshot', variant: 'destructive' });
      return;
    }

    console.log('=== ALL VALIDATIONS PASSED ===');
    console.log('Starting payment submission...');

    setPaymentLoading(true);
    try {
      // Upload proof first if there's a file
      let proofUrl: string | null = null;
      
      if (proofFile) {
        console.log('Proof file exists, uploading...');
        try {
          proofUrl = await handleProofUpload(proofFile);
          if (!proofUrl) {
            console.log('Proof upload returned null');
            setPaymentLoading(false);
            return;
          }
          console.log('Proof uploaded successfully, URL:', proofUrl);
        } catch (uploadError) {
          console.error('Proof upload error:', uploadError);
          setPaymentLoading(false);
          toast({ title: 'Error', description: 'Failed to upload proof. Please try again.', variant: 'destructive' });
          return;
        }
      } else if (proofPreview) {
        // If no file but preview exists, something went wrong
        console.log('No proof file but preview exists - this should not happen');
        proofUrl = proofPreview;
      } else {
        console.log('No proof file or preview');
        setPaymentLoading(false);
        toast({ title: 'Error', description: 'Please upload payment proof', variant: 'destructive' });
        return;
      }

      // Calculate amounts based on payment type
      let requestedAmount = selectedEmi.totalAmount;
      let partialAmt: number | null = null;
      let remainingAmt: number | null = null;
      let newDue: Date | null = null;

      if (selectedPaymentType === 'PARTIAL') {
        partialAmt = parseFloat(partialAmount);
        remainingAmt = selectedEmi.totalAmount - partialAmt;
        newDue = new Date(nextPaymentDate + 'T00:00:00');
        requestedAmount = partialAmt;
      } else if (selectedPaymentType === 'INTEREST_ONLY') {
        requestedAmount = selectedEmi.interestAmount;
      }

      const requestBody = {
        loanApplicationId: loanId,
        emiScheduleId: selectedEmi.id,
        customerId: user.id,
        paymentType: selectedPaymentType === 'PARTIAL' ? 'PARTIAL_PAYMENT' : selectedPaymentType,
        requestedAmount,
        partialAmount: partialAmt,
        remainingAmount: remainingAmt,
        newDueDate: newDue ? newDue.toISOString() : null,
        paymentMethod: 'UPI',
        utrNumber,
        proofUrl,
        proofFileName: proofFile?.name
      };
      
      console.log('Sending API request with body:', JSON.stringify(requestBody, null, 2));

      // Create payment request
      let response;
      try {
        response = await fetch('/api/payment-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        console.log('Fetch completed, response status:', response.status);
      } catch (fetchError) {
        console.error('FETCH ERROR:', fetchError);
        throw new Error('Network error: Failed to connect to server');
      }

      let data;
      try {
        data = await response.json();
        console.log('API Response:', { status: response.status, data });
      } catch (jsonError) {
        console.error('JSON PARSE ERROR:', jsonError);
        throw new Error('Invalid server response');
      }

      if (response.ok) {
        console.log('=== PAYMENT REQUEST SUCCESS ===');
        toast({ 
          title: 'Payment Request Submitted', 
          description: 'Your payment is being verified. You will be notified once approved.' 
        });
        setShowPaymentPage(false);
        setShowPaymentDialog(false);
        resetPaymentForm();
        setSelectedEmi(null);
        fetchLoanDetails();
      } else {
        console.log('API ERROR:', data.error);
        toast({ title: 'Error', description: data.error || 'Failed to submit payment request', variant: 'destructive' });
      }
    } catch (error) {
      console.error('=== PAYMENT ERROR ===', error);
      toast({ title: 'Error', description: 'Failed to submit payment request. Please try again.', variant: 'destructive' });
    } finally {
      setPaymentLoading(false);
      console.log('handleSubmitPayment COMPLETED');
    }
  };

  const resetPaymentForm = () => {
    setPartialAmount('');
    setNextPaymentDate('');
    setUtrNumber('');
    setProofFile(null);
    setProofPreview(null);
    setSelectedPaymentType('FULL_EMI');
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Copied to clipboard' });
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      PENDING: { className: 'bg-amber-100 text-amber-700', label: 'Pending' },
      PAID: { className: 'bg-emerald-100 text-emerald-700', label: 'Paid' },
      OVERDUE: { className: 'bg-red-100 text-red-700', label: 'Overdue' },
      PARTIALLY_PAID: { className: 'bg-orange-100 text-orange-700', label: 'Partial' },
      INTEREST_ONLY_PAID: { className: 'bg-purple-100 text-purple-700', label: 'Interest Paid' },
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  // Calculate stats
  const paidEmis = emiSchedules.filter(e => e.paymentStatus === 'PAID' || e.paymentStatus === 'INTEREST_ONLY_PAID');
  const pendingEmis = emiSchedules.filter(e => 
    e.paymentStatus === 'PENDING' || 
    e.paymentStatus === 'PARTIALLY_PAID' ||
    e.paymentStatus === 'OVERDUE'
  );
  const overdueEmis = emiSchedules.filter(e => e.paymentStatus === 'OVERDUE');
  const progress = emiSchedules.length > 0 ? (paidEmis.length / emiSchedules.length) * 100 : 0;
  const totalPaid = paidEmis.reduce((sum, e) => sum + e.paidAmount, 0);
  const totalOutstanding = pendingEmis.reduce((sum, e) => sum + (e.totalAmount - e.paidAmount), 0) + overdueEmis.reduce((sum, e) => sum + e.totalAmount, 0);

  // Sequential EMI Payment - Check if this EMI can be paid
  const canPayEmi = (emi: EMISchedule) => {
    // INTEREST_ONLY_PAID means the interest is paid and a new EMI was created for principal
    if (emi.paymentStatus === 'PAID' || emi.paymentStatus === 'INTEREST_ONLY_PAID') {
      return { canPay: false, reason: 'Already paid' };
    }
    
    const sortedEmis = [...emiSchedules].sort((a, b) => a.installmentNumber - b.installmentNumber);
    // Find first unpaid EMI (excluding INTEREST_ONLY_PAID as they are considered paid)
    const firstUnpaidEmi = sortedEmis.find(e => 
      e.paymentStatus !== 'PAID' && e.paymentStatus !== 'INTEREST_ONLY_PAID'
    );
    
    if (firstUnpaidEmi && firstUnpaidEmi.id === emi.id) {
      return { canPay: true, reason: '' };
    }
    
    if (firstUnpaidEmi && emi.installmentNumber > firstUnpaidEmi.installmentNumber) {
      return { 
        canPay: false, 
        reason: `Please pay EMI #${firstUnpaidEmi.installmentNumber} first` 
      };
    }
    
    return { canPay: true, reason: '' };
  };

  const getFirstUnpaidEmi = () => {
    const sortedEmis = [...emiSchedules].sort((a, b) => a.installmentNumber - b.installmentNumber);
    // Find first unpaid EMI (excluding INTEREST_ONLY_PAID as they are considered paid)
    return sortedEmis.find(e => 
      e.paymentStatus !== 'PAID' && e.paymentStatus !== 'INTEREST_ONLY_PAID'
    );
  };

  // Get min date for partial payment (must be after due date)
  const getMinPartialDate = () => {
    if (!selectedEmi) return new Date().toISOString().split('T')[0];
    const dueDate = new Date(selectedEmi.dueDate);
    dueDate.setDate(dueDate.getDate() + 1);
    return dueDate.toISOString().split('T')[0];
  };

  // Get max date for partial payment (before next EMI due date)
  const getMaxPartialDate = () => {
    if (!selectedEmi) return '';
    const nextEmi = emiSchedules.find(e => e.installmentNumber === selectedEmi.installmentNumber + 1);
    if (nextEmi) {
      const nextDue = new Date(nextEmi.dueDate);
      nextDue.setDate(nextDue.getDate() - 1);
      return nextDue.toISOString().split('T')[0];
    }
    // If no next EMI, allow up to 30 days
    const maxDate = new Date(selectedEmi.dueDate);
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
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
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Lender</p>
                    <p className="font-semibold">{loan.company.name}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* EMI Schedule */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">EMI Schedule</CardTitle>
            <CardDescription>Click on pending EMI to make payment (must pay in order)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {emiSchedules.sort((a, b) => a.installmentNumber - b.installmentNumber).map((emi, index) => {
                  // INTEREST_ONLY_PAID is considered as paid - interest is paid and new EMI created for principal
                  const isPaid = emi.paymentStatus === 'PAID' || emi.paymentStatus === 'INTEREST_ONLY_PAID';
                  const isFullyPaid = emi.paymentStatus === 'PAID';
                  const isOverdue = emi.paymentStatus === 'OVERDUE';
                  const isPartial = emi.paymentStatus === 'PARTIALLY_PAID';
                  const isInterestPaid = emi.paymentStatus === 'INTEREST_ONLY_PAID';
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
                          fetchEmiSpecificSettings(emi.id);
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
                            isFullyPaid ? 'bg-emerald-100' : isInterestPaid ? 'bg-purple-100' : isOverdue ? 'bg-red-100' : isNextToPay ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-gray-100'
                          }`}>
                            {isFullyPaid ? (
                              <CheckCircle className="h-6 w-6 text-emerald-600" />
                            ) : isInterestPaid ? (
                              <CheckCircle className="h-6 w-6 text-purple-600" />
                            ) : isOverdue ? (
                              <AlertTriangle className="h-6 w-6 text-red-600" />
                            ) : (
                              <span className={`font-bold ${isNextToPay ? 'text-amber-600' : 'text-gray-400'}`}>#{emi.installmentNumber}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">EMI #{emi.installmentNumber}</p>
                              {getStatusBadge(emi.paymentStatus)}
                              {isNextToPay && !isPaid && (
                                <Badge className="bg-amber-500 text-white text-xs">Pay Next</Badge>
                              )}
                              {emi.isInterestOnly && (
                                <Badge className="bg-purple-500 text-white text-xs">Interest Only</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              Due: {formatDate(emi.dueDate)}
                            </p>
                            {/* Show partial payment details */}
                            {isPartial && (
                              <div className="mt-2 p-2 bg-orange-50 rounded-md border border-orange-200">
                                <p className="text-xs font-medium text-orange-700">
                                  Partial Payment Progress
                                </p>
                                <div className="mt-1 space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-600">Total EMI:</span>
                                    <span className="font-medium">{formatCurrency(emi.totalAmount)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-emerald-600">Already Paid:</span>
                                    <span className="font-medium text-emerald-600">{formatCurrency(emi.paidAmount || 0)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-orange-600 font-medium">Remaining:</span>
                                    <span className="font-bold text-orange-600">{formatCurrency(emi.totalAmount - (emi.paidAmount || 0))}</span>
                                  </div>
                                  {emi.nextPaymentDate && (
                                    <p className="text-xs text-orange-600 mt-1">
                                      Next payment due: {formatDate(emi.nextPaymentDate)}
                                    </p>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center gap-1">
                                  <div className="flex-1 bg-orange-200 rounded-full h-2">
                                    <div 
                                      className="bg-orange-500 h-2 rounded-full" 
                                      style={{ width: `${((emi.paidAmount || 0) / emi.totalAmount) * 100}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-orange-600 font-medium">
                                    {Math.round(((emi.paidAmount || 0) / emi.totalAmount) * 100)}%
                                  </span>
                                </div>
                                <p className="text-xs text-orange-600 mt-1">
                                  Partial payments: {emi.partialPaymentCount || 0}/2 used
                                </p>
                              </div>
                            )}
                            {!isPaid && !canPay && (
                              <p className="text-xs text-red-500 mt-1">{reason}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
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
                          {isInterestPaid && (
                            <div className="flex items-center gap-1 text-purple-600">
                              <Percent className="h-4 w-4" />
                              <span className="text-sm">Interest Paid</span>
                            </div>
                          )}
                          {isOverdue && emi.daysOverdue > 0 && (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm">{emi.daysOverdue}d overdue</span>
                            </div>
                          )}
                          {!isPaid && canPay && (
                            <ChevronRight className="h-5 w-5 text-amber-500" />
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
              Due: {selectedEmi && formatDate(selectedEmi.dueDate)} • Total: {selectedEmi && formatCurrency(selectedEmi.totalAmount)}
            </DialogDescription>
          </DialogHeader>
          
          {/* Show Partial Payment Summary if exists */}
          {selectedEmi && selectedEmi.paidAmount > 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                <div className="space-y-1">
                  <p className="font-semibold">Partial Payment Summary:</p>
                  <div className="text-sm space-y-1">
                    <p>• Already Paid: {formatCurrency(selectedEmi.paidAmount)}</p>
                    <p>• Remaining Balance: <strong>{formatCurrency(selectedEmi.totalAmount - selectedEmi.paidAmount)}</strong></p>
                    <p>• Partial Payments Used: {selectedEmi.partialPaymentCount || 0}/2</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-3 py-4">
            {/* Full Payment Option */}
            {(emiSpecificSettings?.enableFullPayment ?? (!paymentSettings || paymentSettings.enableFullPayment)) && (
              <Button 
                className="w-full h-16 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                onClick={() => {
                  setSelectedPaymentType('FULL_EMI');
                  setShowPaymentDialog(false);
                  setShowPaymentPage(true);
                }}
              >
                <div className="flex flex-col items-center">
                  <IndianRupee className="h-5 w-5 mb-1" />
                  <span className="font-semibold">Pay Full EMI</span>
                  <span className="text-xs opacity-80">
                    {selectedEmi && selectedEmi.paidAmount > 0 
                      ? `${formatCurrency(selectedEmi.totalAmount - selectedEmi.paidAmount)} (Remaining)`
                      : selectedEmi && formatCurrency(selectedEmi.totalAmount)
                    }
                  </span>
                </div>
              </Button>
            )}
            
            <div className="text-center text-sm text-gray-500">— or choose flexible payment —</div>
            
            {/* Partial Payment Option */}
            {(emiSpecificSettings?.enablePartialPayment ?? (!paymentSettings || paymentSettings.enablePartialPayment)) && selectedEmi && (selectedEmi.partialPaymentCount || 0) < 2 && (
              <Button 
                variant="outline"
                className="w-full h-16 border-amber-300 hover:bg-amber-50"
                onClick={() => {
                  setSelectedPaymentType('PARTIAL');
                  setShowPaymentDialog(false);
                  setShowPaymentPage(true);
                }}
              >
                <div className="flex flex-col items-center">
                  <CreditCard className="h-5 w-5 mb-1 text-amber-600" />
                  <span className="font-semibold">Partial Payment</span>
                  <span className="text-xs text-gray-500">
                    Pay part now, rest later ({2 - (selectedEmi?.partialPaymentCount || 0)} left)
                  </span>
                </div>
              </Button>
            )}

            {/* Warning if partial payment count reached */}
            {selectedEmi && (selectedEmi.partialPaymentCount || 0) >= 2 && (emiSpecificSettings?.enablePartialPayment ?? (!paymentSettings || paymentSettings.enablePartialPayment)) && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-700 text-sm">
                  You have used both partial payments for this EMI. Full payment of {formatCurrency(selectedEmi.totalAmount - selectedEmi.paidAmount)} required.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Interest Only Option */}
            {(emiSpecificSettings?.enableInterestOnly ?? (!paymentSettings || paymentSettings.enableInterestOnly)) && selectedEmi && !selectedEmi.isPartialPayment && selectedEmi.paidAmount === 0 && (
              <Button 
                variant="outline"
                className="w-full h-16 border-purple-300 hover:bg-purple-50"
                onClick={() => {
                  setSelectedPaymentType('INTEREST_ONLY');
                  setShowPaymentDialog(false);
                  setShowPaymentPage(true);
                }}
              >
                <div className="flex flex-col items-center">
                  <Percent className="h-5 w-5 mb-1 text-purple-600" />
                  <span className="font-semibold">Interest Only</span>
                  <span className="text-xs text-gray-500">
                    Pay {selectedEmi && formatCurrency(selectedEmi.interestAmount)} interest
                  </span>
                </div>
              </Button>
            )}

            {/* Info for interest only */}
            {selectedPaymentType === 'INTEREST_ONLY' && (
              <Alert className="bg-purple-50 border-purple-200">
                <Info className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-700 text-xs">
                  Principal ({selectedEmi && formatCurrency(selectedEmi.principalAmount)}) will be added as a new EMI with additional interest.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Page Dialog */}
      <Dialog open={showPaymentPage} onOpenChange={(open) => {
        setShowPaymentPage(open);
        if (!open) resetPaymentForm();
      }}>
        <DialogContent className="sm:max-w-lg max-h-[95vh] p-0 flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl text-white">
                {selectedPaymentType === 'FULL_EMI' && 'Full EMI Payment'}
                {selectedPaymentType === 'PARTIAL' && 'Partial Payment'}
                {selectedPaymentType === 'INTEREST_ONLY' && 'Interest Only Payment'}
              </DialogTitle>
              <DialogDescription className="text-emerald-100">
                EMI #{selectedEmi?.installmentNumber} • {selectedEmi && formatDate(selectedEmi.dueDate)}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Amount Summary */}
              <Card className="border-0 bg-gray-50">
                <CardContent className="p-4">
                  {selectedPaymentType === 'FULL_EMI' && (
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="text-3xl font-bold text-emerald-600">
                        {selectedEmi && formatCurrency(selectedEmi.totalAmount)}
                      </p>
                      <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Principal: {selectedEmi && formatCurrency(selectedEmi.principalAmount)}</span>
                        <span>Interest: {selectedEmi && formatCurrency(selectedEmi.interestAmount)}</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedPaymentType === 'PARTIAL' && (
                    <div className="space-y-4">
                      <div className="bg-amber-50 rounded-lg p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total EMI:</span>
                          <span className="font-medium">{selectedEmi && formatCurrency(selectedEmi.totalAmount)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Amount to Pay Now *</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            type="number"
                            placeholder="Enter amount"
                            value={partialAmount}
                            onChange={(e) => setPartialAmount(e.target.value)}
                            className="pl-10"
                            max={selectedEmi?.totalAmount}
                          />
                        </div>
                        {partialAmount && selectedEmi && (
                          <p className="text-xs text-gray-500">
                            Remaining: {formatCurrency(selectedEmi.totalAmount - parseFloat(partialAmount || '0'))}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Pay Remaining By *</Label>
                        <Input
                          type="date"
                          value={nextPaymentDate}
                          onChange={(e) => setNextPaymentDate(e.target.value)}
                          min={getMinPartialDate()}
                          max={getMaxPartialDate()}
                        />
                        <p className="text-xs text-gray-500">
                          Must be after due date ({selectedEmi && formatDate(selectedEmi.dueDate)})
                        </p>
                        {selectedEmi && (selectedEmi.partialPaymentCount || 0) === 1 && (
                          <Alert className="bg-orange-50 border-orange-200 mt-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            <AlertDescription className="text-orange-700 text-xs">
                              This is your last partial payment. Remaining amount must be paid in full.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedPaymentType === 'INTEREST_ONLY' && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Interest Amount</p>
                        <p className="text-3xl font-bold text-purple-600">
                          {selectedEmi && formatCurrency(selectedEmi.interestAmount)}
                        </p>
                      </div>
                      <Alert className="bg-purple-50 border-purple-200">
                        <Info className="h-4 w-4 text-purple-600" />
                        <AlertDescription className="text-purple-700 text-sm">
                          Principal ({selectedEmi && formatCurrency(selectedEmi.principalAmount)}) will be added as a new EMI with additional interest. Your loan tenure will increase by 1 month.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Wallet className="h-5 w-5" /> Payment Methods
                </h3>

                {/* QR Code */}
                {(paymentSettings?.companyQrCodeUrl || loan.company) && (
                  <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-24 bg-white rounded-lg border flex items-center justify-center">
                          {paymentSettings?.companyQrCodeUrl ? (
                            <img src={paymentSettings.companyQrCodeUrl} alt="QR Code" className="w-20 h-20" />
                          ) : (
                            <QrCode className="h-12 w-12 text-gray-300" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">Scan QR Code</p>
                          <p className="text-sm text-gray-500">Use any UPI app to pay</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* UPI ID */}
                {paymentSettings?.companyUpiId && (
                  <Card className="border-0">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">UPI ID</p>
                          <p className="font-mono font-medium text-lg">{paymentSettings.companyUpiId}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(paymentSettings.companyUpiId || '')}
                        >
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bank Details */}
                <Card className="border-0">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Bank Account Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Account Holder:</span>
                        <span className="font-medium">{loan.company?.name || 'Money Mitra'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bank Name:</span>
                        <span className="font-medium">{paymentSettings?.bankName || 'HDFC Bank'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Account Number:</span>
                        <span className="font-mono">{paymentSettings?.bankAccountNumber || '50100212345678'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">IFSC Code:</span>
                        <span className="font-mono">{paymentSettings?.bankIfscCode || 'HDFC0001234'}</span>
                      </div>
                      {paymentSettings?.bankBranch && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Branch:</span>
                          <span className="font-medium">{paymentSettings.bankBranch}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Proof Upload */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Upload className="h-5 w-5" /> Payment Proof
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="utr">UTR / Reference Number *</Label>
                    <Input
                      id="utr"
                      placeholder="Enter 12-digit UTR number"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      maxLength={16}
                    />
                    <p className="text-xs text-gray-500">Found in your payment app after transaction</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Screenshot *</Label>
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                      {proofPreview ? (
                        <div className="relative">
                          <img 
                            src={proofPreview} 
                            alt="Proof preview" 
                            className="max-h-40 mx-auto rounded-lg"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setProofFile(null);
                              setProofPreview(null);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center cursor-pointer">
                          <Upload className="h-10 w-10 text-gray-300 mb-2" />
                          <span className="text-sm text-gray-500">Click to upload screenshot</span>
                          <span className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50 flex-shrink-0">
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setShowPaymentPage(false);
                  resetPaymentForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                onClick={handleSubmitPayment}
                disabled={paymentLoading || uploadingProof}
              >
                {paymentLoading || uploadingProof ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Submit Payment'
                )}
              </Button>
            </div>
            <p className="text-xs text-center text-gray-500 mt-2">
              Payment will be verified by cashier before confirmation
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
