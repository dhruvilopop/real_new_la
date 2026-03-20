'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Home, FileText, CheckCircle, XCircle, Clock, Wallet, TrendingUp, Percent, Calendar, IndianRupee, PenLine, AlertCircle, CreditCard, User, Briefcase, Building2, ChevronRight, LogOut, Bell, Settings, History, BarChart3, Calculator, Gift, RefreshCw, Download, Share2, ClockIcon, AlertTriangle, Sparkles, ArrowUpRight, PiggyBank, FileDown, RefreshCcw } from 'lucide-react';
import SecondaryPaymentPagesSection from '@/components/payment/SecondaryPaymentPagesSection';
import { formatCurrency, calculateEMI, formatDate } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { motion, AnimatePresence } from 'framer-motion';

interface Loan {
  id: string; applicationNo: string; status: string; requestedAmount: number; loanType: string;
  createdAt: string; riskScore: number; fraudFlag: boolean; purpose: string;
  customer: { id: string; name: string; email: string; phone: string; };
  sessionForm?: {
    approvedAmount: number; interestRate: number; tenure: number; emiAmount: number;
    totalInterest: number; totalAmount: number; processingFee: number;
  };
  loanForm?: any; company?: any;
  requestedTenure?: number; emiAmount?: number;
}

interface EMISchedule {
  id: string; installmentNumber: number; dueDate: string; totalAmount: number;
  principalAmount: number; interestAmount: number; paymentStatus: string;
  paidAmount: number; paidDate: string; penaltyAmount: number; daysOverdue: number;
}

interface PreApprovedOffer {
  id: string; offerAmount: number; interestRate: number; maxTenure: number;
  validTill: string; company: { name: string }; status: string;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  
  // Location tracking hook - auto-track APP_OPEN on mount
  const { trackLocation, isPermissionDenied } = useLocationTracking({
    userId: user?.id,
    autoTrackOnMount: true,
    autoTrackAction: 'APP_OPEN',
  });
  
  const [activeTab, setActiveTab] = useState('home');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showLoanApply, setShowLoanApply] = useState(false);
  const [showLoanDetails, setShowLoanDetails] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSanctionAcceptDialog, setShowSanctionAcceptDialog] = useState(false);
  const [selectedEmi, setSelectedEmi] = useState<EMISchedule | null>(null);
  const [emiSchedules, setEmiSchedules] = useState<EMISchedule[]>([]);
  const [loanForm, setLoanForm] = useState({ loanType: 'PERSONAL', amount: 100000, tenure: 12, purpose: '' });
  const [calculatedEMI, setCalculatedEMI] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Signature canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showSignatureError, setShowSignatureError] = useState(false);
  
  // Advanced features state
  const [preApprovedOffers, setPreApprovedOffers] = useState<PreApprovedOffer[]>([]);
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [showForeclosureDialog, setShowForeclosureDialog] = useState(false);
  const [showEMIDateDialog, setShowEMIDateDialog] = useState(false);
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [loanTimeline, setLoanTimeline] = useState<any[]>([]);
  const [topUpForm, setTopUpForm] = useState({ amount: 0, reason: '' });
  const [emiDateForm, setEmiDateForm] = useState({ newDate: 5, reason: '' });
  const [referralForm, setReferralForm] = useState({ email: '', phone: '' });
  const [referralStats, setReferralStats] = useState({ total: 0, commissioned: 0, earned: 0 });

  useEffect(() => {
    if (user) {
      fetchLoans();
      fetchServices();
      fetchNotifications();
      fetchPreApprovedOffers();
      fetchReferrals();
    }
  }, [user]);

  useEffect(() => {
    if (loanForm.amount && loanForm.tenure) {
      const calc = calculateEMI(loanForm.amount, 12, loanForm.tenure);
      setCalculatedEMI(calc);
    }
  }, [loanForm.amount, loanForm.tenure]);

  // Initialize signature canvas
  useEffect(() => {
    if (showSanctionAcceptDialog && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
    }
  }, [showSanctionAcceptDialog]);

  const fetchLoans = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/loan/list?role=CUSTOMER&customerId=${user.id}`);
      const data = await response.json();
      setLoans(data.loans || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/cms/product?isActive=true');
      const data = await response.json();
      setServices(data.products || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/notification?userId=${user.id}&limit=5`);
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchEMISchedules = async (loanId: string) => {
    try {
      const response = await fetch(`/api/emi?loanId=${loanId}`);
      const data = await response.json();
      setEmiSchedules(data.schedules || []);
    } catch (error) {
      console.error('Error fetching EMI schedules:', error);
    }
  };

  const fetchPreApprovedOffers = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/loan-features?action=pre-approved-offers&customerId=${user.id}`);
      const data = await response.json();
      if (data.success) {
        setPreApprovedOffers(data.offers || []);
      }
    } catch (error) {
      console.error('Error fetching pre-approved offers:', error);
    }
  };

  const fetchLoanTimeline = async (loanId: string) => {
    try {
      const response = await fetch(`/api/loan-features?action=loan-timeline&loanId=${loanId}`);
      const data = await response.json();
      if (data.success) {
        setLoanTimeline(data.timeline || []);
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  };

  const fetchReferrals = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/loan-features?action=referrals&customerId=${user.id}`);
      const data = await response.json();
      if (data.success) {
        const refs = data.referrals || [];
        setReferralStats({
          total: refs.length,
          commissioned: refs.filter((r: any) => r.status === 'COMMISSIONED').length,
          earned: refs.reduce((sum: number, r: any) => sum + (r.commissionPaid ? r.commissionAmount : 0), 0)
        });
      }
    } catch (error) {
      console.error('Error fetching referrals:', error);
    }
  };

  const handleApplyLoan = async () => {
    if (!user) return;
    if (!loanForm.amount || !loanForm.tenure) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/loan/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.id,
          loanType: loanForm.loanType,
          requestedAmount: loanForm.amount,
          requestedTenure: loanForm.tenure,
          purpose: loanForm.purpose
        })
      });
      if (response.ok) {
        const data = await response.json();
        toast({ title: 'Application Submitted', description: 'Your loan application has been submitted successfully!' });
        setShowLoanApply(false);
        setLoanForm({ loanType: 'PERSONAL', amount: 100000, tenure: 12, purpose: '' });
        fetchLoans();
        
        if (!isPermissionDenied && data.loan?.id) {
          trackLocation('LOAN_APPLY', { loanApplicationId: data.loan.id });
        }
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to submit application', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit application', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    setShowSignatureError(false);
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      e.preventDefault();
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleApproveSessionWithSignature = async () => {
    if (!selectedLoan || !user) return;
    
    // Validate signature
    if (!signatureData) {
      setShowSignatureError(true);
      toast({ title: 'Signature Required', description: 'Please sign to accept the sanction', variant: 'destructive' });
      return;
    }
    
    if (!termsAccepted) {
      toast({ title: 'Terms Required', description: 'Please accept the terms and conditions', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          action: 'approve_session',
          role: 'CUSTOMER',
          userId: user.id,
          remarks: 'Session approved by customer with digital signature',
          signatureData: signatureData
        })
      });
      if (response.ok) {
        toast({ title: 'Sanction Accepted', description: 'Your loan sanction has been accepted successfully!' });
        setShowSanctionAcceptDialog(false);
        setShowLoanDetails(false);
        setSignatureData(null);
        setTermsAccepted(false);
        fetchLoans();
        
        if (!isPermissionDenied) {
          trackLocation('SESSION_CONFIRM', { loanApplicationId: selectedLoan.id });
        }
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to approve session', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve session', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSession = async (loan: Loan) => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: loan.id,
          action: 'reject_session',
          role: 'CUSTOMER',
          userId: user.id,
          remarks: 'Session rejected by customer'
        })
      });
      if (response.ok) {
        toast({ title: 'Sanction Rejected', description: 'The loan sanction has been rejected.' });
        setShowLoanDetails(false);
        fetchLoans();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reject session', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedLoan || !selectedEmi || !user) return;
    setLoading(true);
    try {
      const response = await fetch('/api/customer/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          customerId: user.id,
          emiScheduleId: selectedEmi.id,
          paymentType: 'FULL_EMI',
          amount: selectedEmi.totalAmount
        })
      });
      if (response.ok) {
        const data = await response.json();
        toast({ title: 'Payment Successful', description: 'Your EMI payment has been processed!' });
        setShowPaymentDialog(false);
        fetchEMISchedules(selectedLoan.id);
        
        if (!isPermissionDenied && data.payment?.id) {
          trackLocation('EMI_PAY', { 
            loanApplicationId: selectedLoan.id, 
            paymentId: data.payment.id 
          });
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Payment failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Advanced feature handlers
  const handleAcceptPreApprovedOffer = async (offerId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch('/api/loan-features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept-pre-approved-offer',
          id: offerId
        })
      });
      if (response.ok) {
        toast({ title: 'Offer Accepted!', description: 'Your loan application is being processed.' });
        fetchPreApprovedOffers();
        fetchLoans();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to accept offer', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestTopUp = async () => {
    if (!selectedLoan || !user) return;
    setLoading(true);
    try {
      const response = await fetch('/api/loan-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-top-up',
          data: {
            loanApplicationId: selectedLoan.id,
            requestedAmount: topUpForm.amount,
            reason: topUpForm.reason
          }
        })
      });
      if (response.ok) {
        toast({ title: 'Top-Up Requested', description: 'Your loan top-up request has been submitted.' });
        setShowTopUpDialog(false);
        setTopUpForm({ amount: 0, reason: '' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to request top-up', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestForeclosure = async () => {
    if (!selectedLoan || !user) return;
    setLoading(true);
    try {
      // INTEREST_ONLY_PAID is considered as paid - interest is paid and new EMI created for principal
      const paidSchedules = emiSchedules.filter(e => e.paymentStatus === 'PAID' || e.paymentStatus === 'INTEREST_ONLY_PAID');
      const pendingSchedules = emiSchedules.filter(e => e.paymentStatus !== 'PAID' && e.paymentStatus !== 'INTEREST_ONLY_PAID');
      const outstandingPrincipal = pendingSchedules.reduce((sum, e) => sum + e.principalAmount, 0);
      const pendingInterest = pendingSchedules.reduce((sum, e) => sum + e.interestAmount, 0);
      
      const response = await fetch('/api/loan-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-foreclosure',
          data: {
            loanApplicationId: selectedLoan.id,
            requestType: 'FULL',
            outstandingPrincipal,
            pendingInterest,
            penaltyCharges: 0,
            totalSettlement: outstandingPrincipal + pendingInterest,
            requestedById: user.id
          }
        })
      });
      if (response.ok) {
        toast({ title: 'Foreclosure Requested', description: 'Your foreclosure request has been submitted for approval.' });
        setShowForeclosureDialog(false);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to request foreclosure', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEMIDateChange = async () => {
    if (!selectedLoan || !user) return;
    setLoading(true);
    try {
      const currentDueDate = emiSchedules[0]?.dueDate ? new Date(emiSchedules[0].dueDate).getDate() : 1;
      
      const response = await fetch('/api/loan-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-emi-date-change',
          data: {
            loanApplicationId: selectedLoan.id,
            currentDueDate,
            requestedDueDate: emiDateForm.newDate,
            reason: emiDateForm.reason
          }
        })
      });
      if (response.ok) {
        toast({ title: 'EMI Date Change Requested', description: 'Your request has been submitted for approval.' });
        setShowEMIDateDialog(false);
        setEmiDateForm({ newDate: 5, reason: '' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to request EMI date change', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReferral = async () => {
    if (!user) return;
    if (!referralForm.email) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/loan-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-referral',
          data: {
            referrerId: user.id,
            referredEmail: referralForm.email,
            referredPhone: referralForm.phone
          }
        })
      });
      if (response.ok) {
        toast({ title: 'Referral Sent!', description: 'Your friend will receive an invitation.' });
        setShowReferralDialog(false);
        setReferralForm({ email: '', phone: '' });
        fetchReferrals();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send referral', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadStatement = (loan: Loan, type: string) => {
    toast({ title: 'Download Started', description: `Your ${type} is being generated.` });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      SUBMITTED: { className: 'bg-blue-100 text-blue-700', label: 'Submitted' },
      SA_APPROVED: { className: 'bg-emerald-100 text-emerald-700', label: 'SA Approved' },
      COMPANY_APPROVED: { className: 'bg-teal-100 text-teal-700', label: 'Company Approved' },
      AGENT_APPROVED_STAGE1: { className: 'bg-cyan-100 text-cyan-700', label: 'Agent Approved' },
      LOAN_FORM_COMPLETED: { className: 'bg-indigo-100 text-indigo-700', label: 'Verification Complete' },
      SESSION_CREATED: { className: 'bg-amber-100 text-amber-700', label: 'Sanction Created' },
      CUSTOMER_SESSION_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Awaiting Disbursement' },
      FINAL_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Final Approved' },
      ACTIVE: { className: 'bg-green-100 text-green-700', label: 'Active' },
      CLOSED: { className: 'bg-gray-100 text-gray-700', label: 'Closed' },
      REJECTED_BY_SA: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
      REJECTED_BY_COMPANY: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
      REJECTED_FINAL: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
      SESSION_REJECTED: { className: 'bg-red-100 text-red-700', label: 'Sanction Rejected' },
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const getEMIStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      PENDING: { className: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
      PAID: { className: 'bg-green-100 text-green-700', label: 'Paid' },
      OVERDUE: { className: 'bg-red-100 text-red-700', label: 'Overdue' },
      PARTIALLY_PAID: { className: 'bg-orange-100 text-orange-700', label: 'Partial' },
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  // Filter loans
  const pendingSanctionLoans = loans.filter(l => l.status === 'SESSION_CREATED');
  const activeLoans = loans.filter(l => ['ACTIVE', 'DISBURSED'].includes(l.status));
  const inProgressLoans = loans.filter(l => !['SUBMITTED', 'ACTIVE', 'DISBURSED', 'CLOSED', 'REJECTED_BY_SA', 'REJECTED_BY_COMPANY', 'REJECTED_FINAL', 'SESSION_REJECTED'].includes(l.status));
  const rejectedLoans = loans.filter(l => ['REJECTED_BY_SA', 'REJECTED_BY_COMPANY', 'REJECTED_FINAL', 'SESSION_REJECTED'].includes(l.status));

  // Calculate totals
  const totalActiveLoan = activeLoans.reduce((sum, l) => sum + (l.sessionForm?.approvedAmount || l.requestedAmount), 0);
  // INTEREST_ONLY_PAID is considered as paid
  const totalEMIPaid = emiSchedules.filter(e => e.paymentStatus === 'PAID' || e.paymentStatus === 'INTEREST_ONLY_PAID').reduce((sum, e) => sum + e.paidAmount, 0);
  const nextEMI = emiSchedules.find(e => e.paymentStatus === 'PENDING');
  const overdueEMIs = emiSchedules.filter(e => e.paymentStatus === 'OVERDUE');

  // Bottom Navigation
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'loans', label: 'My Loans', icon: Wallet },
    { id: 'services', label: 'Services', icon: Briefcase },
    { id: 'payment-pages', label: 'Payments', icon: CreditCard },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const renderLoanCard = (loan: Loan, showAction: boolean = true) => (
    <motion.div
      key={loan.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all"
      onClick={() => {
        if (['ACTIVE', 'DISBURSED'].includes(loan.status)) {
          router.push(`/customer/loan/${loan.id}`);
        } else if (loan.status === 'SESSION_CREATED') {
          setSelectedLoan(loan);
          setShowSanctionAcceptDialog(true);
        } else {
          setSelectedLoan(loan);
          setShowLoanDetails(true);
        }
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
            {getStatusBadge(loan.status)}
            {loan.fraudFlag && <Badge className="bg-red-100 text-red-700">High Risk</Badge>}
          </div>
          <p className="text-sm text-gray-500">{loan.loanType} Loan</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-gray-900">
            {formatCurrency(loan.sessionForm?.approvedAmount || loan.requestedAmount)}
          </p>
          {loan.sessionForm && (
            <p className="text-xs text-gray-500">{loan.sessionForm.tenure} months @ {loan.sessionForm.interestRate}%</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{formatDate(loan.createdAt)}</p>
        {loan.status === 'SESSION_CREATED' && (
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600" onClick={(e) => {
            e.stopPropagation();
            setSelectedLoan(loan);
            setShowSanctionAcceptDialog(true);
          }}>
            Review & Accept
          </Button>
        )}
        {showAction && loan.status !== 'SESSION_CREATED' && (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-6">
            {/* Welcome Card */}
            <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Welcome, {user?.name?.split(' ')[0] || 'Customer'}!</h2>
                    <p className="text-emerald-100">Your trusted partner for all financial needs</p>
                  </div>
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <Wallet className="h-8 w-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Required - Pending Sanctions */}
            {pendingSanctionLoans.length > 0 && (
              <Card className="border-amber-200 bg-amber-50 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => {
                const loan = pendingSanctionLoans[0];
                setSelectedLoan(loan);
                setShowSanctionAcceptDialog(true);
              }}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-amber-800 text-lg">
                    <AlertCircle className="h-5 w-5" /> Action Required
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-amber-700 mb-4 text-sm">You have {pendingSanctionLoans.length} loan sanction(s) awaiting your approval.</p>
                  {pendingSanctionLoans.slice(0, 1).map((loan) => (
                    <div key={loan.id} className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{loan.applicationNo}</p>
                          <p className="text-sm text-gray-500">{formatCurrency(loan.sessionForm?.approvedAmount || loan.requestedAmount)}</p>
                          {loan.sessionForm && (
                            <p className="text-xs text-gray-400 mt-1">EMI: {formatCurrency(loan.sessionForm.emiAmount)}/mo</p>
                          )}
                        </div>
                        <Button size="sm" className="bg-amber-500 hover:bg-amber-600">
                          Review & Sign
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Pre-Approved Offers */}
            {preApprovedOffers.length > 0 && (
              <Card className="border-purple-200 bg-purple-50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-purple-800 text-lg">
                    <Sparkles className="h-5 w-5" /> Pre-Approved Offers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {preApprovedOffers.map((offer) => (
                    <div key={offer.id} className="bg-white p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => handleAcceptPreApprovedOffer(offer.id)}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-lg text-purple-800">{formatCurrency(offer.offerAmount)}</p>
                          <p className="text-sm text-gray-500">{offer.company.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-emerald-600">{offer.interestRate}% p.a.</p>
                          <p className="text-xs text-gray-400">Up to {offer.maxTenure} months</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-purple-600">Valid till {formatDate(offer.validTill)}</p>
                        <Button size="sm" className="bg-purple-500 hover:bg-purple-600">
                          Accept Offer
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick Stats - Only for Active Loans */}
            {activeLoans.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => setActiveTab('loans')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Active Loan</p>
                        <p className="font-bold text-lg">{formatCurrency(totalActiveLoan)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => setActiveTab('loans')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Paid</p>
                        <p className="font-bold text-lg">{formatCurrency(totalEMIPaid)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Overdue Alert */}
            {overdueEMIs.length > 0 && (
              <Card className="border-red-200 bg-red-50 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => router.push(`/customer/loan/${activeLoans[0]?.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-red-800">{overdueEMIs.length} Overdue EMI(s)</p>
                      <p className="text-sm text-red-600">Total overdue: {formatCurrency(overdueEMIs.reduce((s, e) => s + e.totalAmount, 0))}</p>
                    </div>
                    <Button size="sm" variant="destructive">
                      Pay Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Next EMI Due */}
            {nextEMI && (
              <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => router.push(`/customer/loan/${activeLoans[0]?.id}`)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-emerald-500" /> Next EMI Due
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(nextEMI.totalAmount)}</p>
                      <p className="text-sm text-gray-500">Due: {formatDate(nextEMI.dueDate)}</p>
                    </div>
                    <Button className="bg-emerald-500 hover:bg-emerald-600">
                      Pay Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="cursor-pointer hover:shadow-lg transition-all border-0 shadow-sm" onClick={() => setShowLoanApply(true)}>
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="font-medium text-gray-900 text-sm">Apply</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-lg transition-all border-0 shadow-sm" onClick={() => setActiveTab('loans')}>
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Wallet className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="font-medium text-gray-900 text-sm">My Loans</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-lg transition-all border-0 shadow-sm" onClick={() => setShowReferralDialog(true)}>
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Gift className="h-5 w-5 text-purple-600" />
                  </div>
                  <p className="font-medium text-gray-900 text-sm">Refer</p>
                </CardContent>
              </Card>
            </div>

            {/* Referral Stats */}
            {referralStats.total > 0 && (
              <Card className="border-purple-200 bg-purple-50 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => setShowReferralDialog(true)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Gift className="h-8 w-8 text-purple-600" />
                      <div>
                        <p className="font-semibold text-purple-800">Referral Rewards</p>
                        <p className="text-sm text-purple-600">{referralStats.commissioned} successful referrals</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-purple-800">{formatCurrency(referralStats.earned)}</p>
                      <p className="text-xs text-purple-600">Earned</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Services */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Our Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {(services.length > 0 ? services : [
                    { id: '1', title: 'Personal Loan', icon: '👤', minInterestRate: 10 },
                    { id: '2', title: 'Business Loan', icon: '🏢', minInterestRate: 12 },
                    { id: '3', title: 'Home Loan', icon: '🏠', minInterestRate: 8 },
                    { id: '4', title: 'Education Loan', icon: '📚', minInterestRate: 8 },
                  ]).map((service) => (
                    <div key={service.id} className="bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-all" onClick={() => setShowLoanApply(true)}>
                      <div className="text-2xl mb-1">{service.icon || '💰'}</div>
                      <p className="font-medium text-sm">{service.title}</p>
                      <p className="text-xs text-gray-500">From {service.minInterestRate}% p.a.</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'loans':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">My Loans</h2>
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowLoanApply(true)}>
                <FileText className="h-4 w-4 mr-2" /> Apply New
              </Button>
            </div>

            {loans.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wallet className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No loans yet</h3>
                  <p className="text-gray-500 mb-4">Start your journey by applying for a loan</p>
                  <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowLoanApply(true)}>
                    Apply Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="progress">In Progress</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="space-y-3">
                  {loans.map((loan) => renderLoanCard(loan))}
                </TabsContent>
                
                <TabsContent value="active" className="space-y-3">
                  {activeLoans.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No active loans</div>
                  ) : (
                    activeLoans.map((loan) => renderLoanCard(loan))
                  )}
                </TabsContent>
                
                <TabsContent value="progress" className="space-y-3">
                  {inProgressLoans.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No loans in progress</div>
                  ) : (
                    inProgressLoans.map((loan) => renderLoanCard(loan))
                  )}
                </TabsContent>
                
                <TabsContent value="rejected" className="space-y-3">
                  {rejectedLoans.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No rejected loans</div>
                  ) : (
                    rejectedLoans.map((loan) => renderLoanCard(loan, false))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        );

      case 'services':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Services</h2>
            
            <div className="grid gap-3">
              {(services.length > 0 ? services : [
                { id: '1', title: 'Personal Loan', description: 'Quick approval for personal needs', icon: '👤', minInterestRate: 10, maxInterestRate: 18, minAmount: 50000, maxAmount: 5000000 },
                { id: '2', title: 'Business Loan', description: 'Grow your business', icon: '🏢', minInterestRate: 12, maxInterestRate: 20, minAmount: 100000, maxAmount: 10000000 },
                { id: '3', title: 'Home Loan', description: 'Make your dream home a reality', icon: '🏠', minInterestRate: 8, maxInterestRate: 12, minAmount: 500000, maxAmount: 50000000 },
                { id: '4', title: 'Education Loan', description: 'Invest in education', icon: '📚', minInterestRate: 8, maxInterestRate: 14, minAmount: 100000, maxAmount: 5000000 },
              ]).map((service) => (
                <Card key={service.id} className="cursor-pointer hover:shadow-md transition-all border-0 shadow-sm" onClick={() => setShowLoanApply(true)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{service.icon || '💰'}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{service.title}</h3>
                        <p className="text-sm text-gray-500">{service.description || 'Flexible loan options'}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-emerald-600 font-medium">{service.minInterestRate}% - {service.maxInterestRate || service.minInterestRate + 5}% p.a.</span>
                          <span className="text-xs text-gray-400">Up to {formatCurrency(service.maxAmount || 5000000)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'payment-pages':
        return (
          <div className="space-y-4">
            <SecondaryPaymentPagesSection userId={user?.id} />
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">{user?.name?.charAt(0) || 'U'}</span>
                </div>
                <h2 className="text-xl font-bold">{user?.name}</h2>
                <p className="text-gray-500">{user?.email}</p>
                <p className="text-sm text-gray-400">{user?.phone}</p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50" onClick={() => toast({ title: 'Coming Soon', description: 'This feature will be available soon' })}>
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-gray-400" />
                    <span>Notifications</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
                <Separator />
                <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50" onClick={() => toast({ title: 'Coming Soon', description: 'This feature will be available soon' })}>
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-gray-400" />
                    <span>Settings</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
                <Separator />
                <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 text-red-600" onClick={signOut}>
                  <div className="flex items-center gap-3">
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                  </div>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-emerald-100">Welcome back,</p>
              <h1 className="font-semibold text-lg">{user?.name?.split(' ')[0] || 'Customer'}!</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifications.filter(n => !n.isRead).length > 0 && (
              <div className="relative">
                <Bell className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 transition-all ${isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon className={`h-5 w-5 ${isActive ? 'scale-110' : ''}`} />
                <span className={`text-xs font-medium ${isActive ? 'text-emerald-600' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Loan Apply Dialog */}
      <Dialog open={showLoanApply} onOpenChange={setShowLoanApply}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply for Loan</DialogTitle>
            <DialogDescription>Fill in the details to apply for a loan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Loan Type</Label>
              <Select value={loanForm.loanType} onValueChange={(v) => setLoanForm({ ...loanForm, loanType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSONAL">Personal Loan</SelectItem>
                  <SelectItem value="BUSINESS">Business Loan</SelectItem>
                  <SelectItem value="HOME">Home Loan</SelectItem>
                  <SelectItem value="VEHICLE">Vehicle Loan</SelectItem>
                  <SelectItem value="EDUCATION">Education Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loan Amount (₹)</Label>
              <Input type="number" value={loanForm.amount} onChange={(e) => setLoanForm({ ...loanForm, amount: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Tenure (Months)</Label>
              <Input type="number" value={loanForm.tenure} onChange={(e) => setLoanForm({ ...loanForm, tenure: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Textarea value={loanForm.purpose} onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })} placeholder="Brief description of loan purpose..." />
            </div>
            {calculatedEMI && (
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm text-emerald-600 font-medium">Estimated EMI @ 12% p.a.</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(calculatedEMI.emi)}/month</p>
                  <div className="flex gap-4 mt-2 text-xs text-emerald-600">
                    <span>Total Interest: {formatCurrency(calculatedEMI.totalInterest)}</span>
                    <span>Total: {formatCurrency(calculatedEMI.totalAmount)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoanApply(false)}>Cancel</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleApplyLoan} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan Details Dialog */}
      <Dialog open={showLoanDetails} onOpenChange={setShowLoanDetails}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
            <DialogDescription>{selectedLoan?.applicationNo}</DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedLoan.status)}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-bold text-lg">{formatCurrency(selectedLoan.sessionForm?.approvedAmount || selectedLoan.requestedAmount)}</p>
                </div>
              </div>

              {['ACTIVE', 'DISBURSED'].includes(selectedLoan.status) && emiSchedules.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-500" />
                    EMI Schedule
                  </h4>
                  
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="bg-green-50 p-2 rounded-lg">
                      <p className="text-xs text-gray-500">Paid</p>
                      <p className="font-semibold text-green-700">{emiSchedules.filter(e => e.paymentStatus === 'PAID' || e.paymentStatus === 'INTEREST_ONLY_PAID').length}</p>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded-lg">
                      <p className="text-xs text-gray-500">Pending</p>
                      <p className="font-semibold text-yellow-700">{emiSchedules.filter(e => e.paymentStatus === 'PENDING').length}</p>
                    </div>
                    <div className="bg-red-50 p-2 rounded-lg">
                      <p className="text-xs text-gray-500">Overdue</p>
                      <p className="font-semibold text-red-700">{emiSchedules.filter(e => e.paymentStatus === 'OVERDUE').length}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <Button variant="outline" size="sm" onClick={() => setShowTopUpDialog(true)}>
                      <ArrowUpRight className="h-4 w-4 mr-1" /> Top-Up
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowForeclosureDialog(true)}>
                      <PiggyBank className="h-4 w-4 mr-1" /> Foreclosure
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowEMIDateDialog(true)}>
                      <ClockIcon className="h-4 w-4 mr-1" /> Change EMI Date
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadStatement(selectedLoan, 'statement')}>
                      <FileDown className="h-4 w-4 mr-1" /> Statement
                    </Button>
                  </div>

                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {emiSchedules.map((emi) => (
                        <div key={emi.id} className={`p-3 rounded-lg border ${emi.paymentStatus === 'OVERDUE' ? 'border-red-200 bg-red-50' : (emi.paymentStatus === 'PAID' || emi.paymentStatus === 'INTEREST_ONLY_PAID') ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-sm">EMI #{emi.installmentNumber}</p>
                              <p className="text-xs text-gray-500">{formatDate(emi.dueDate)}</p>
                            </div>
                            <div className="text-right flex items-center gap-2">
                              <div>
                                <p className="font-semibold">{formatCurrency(emi.totalAmount)}</p>
                                {emi.penaltyAmount > 0 && <p className="text-xs text-red-600">+{formatCurrency(emi.penaltyAmount)} penalty</p>}
                              </div>
                              {emi.paymentStatus === 'PENDING' && <Button size="sm" onClick={() => { setSelectedEmi(emi); setShowPaymentDialog(true); }}>Pay</Button>}
                              {emi.paymentStatus !== 'PENDING' && getEMIStatusBadge(emi.paymentStatus)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sanction Accept Dialog with Signature */}
      <Dialog open={showSanctionAcceptDialog} onOpenChange={(open) => {
        setShowSanctionAcceptDialog(open);
        if (!open) {
          setSignatureData(null);
          setTermsAccepted(false);
          clearSignature();
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5 text-amber-600" />
              Accept Loan Sanction
            </DialogTitle>
            <DialogDescription>
              {selectedLoan?.applicationNo} - Review and sign to accept
            </DialogDescription>
          </DialogHeader>
          
          {selectedLoan?.sessionForm && (
            <div className="space-y-4">
              {/* Sanction Details */}
              <Card className="bg-amber-50 border-amber-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-amber-800">Sanction Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Approved Amount</p>
                      <p className="font-bold text-lg text-emerald-700">{formatCurrency(selectedLoan.sessionForm.approvedAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Interest Rate</p>
                      <p className="font-semibold">{selectedLoan.sessionForm.interestRate}% p.a.</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Tenure</p>
                      <p className="font-semibold">{selectedLoan.sessionForm.tenure} months</p>
                    </div>
                    <div>
                      <p className="text-gray-500">EMI Amount</p>
                      <p className="font-semibold">{formatCurrency(selectedLoan.sessionForm.emiAmount)}/mo</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Interest</p>
                      <p className="font-semibold">{formatCurrency(selectedLoan.sessionForm.totalInterest)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Amount</p>
                      <p className="font-semibold">{formatCurrency(selectedLoan.sessionForm.totalAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Terms and Conditions */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox 
                    id="terms" 
                    checked={termsAccepted} 
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  />
                  <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                    I have read and agree to the loan terms and conditions, including the interest rate, 
                    EMI schedule, and repayment obligations. I understand that this is a legally binding agreement.
                  </Label>
                </div>
              </div>

              {/* Signature Pad */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <PenLine className="h-4 w-4" />
                  Digital Signature *
                </Label>
                <p className="text-xs text-gray-500">Sign below to accept the loan sanction</p>
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                {showSignatureError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Please provide your signature</AlertDescription>
                  </Alert>
                )}
                <Button variant="outline" size="sm" onClick={clearSignature} className="mt-1">
                  <RefreshCcw className="h-4 w-4 mr-1" /> Clear Signature
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50" 
                  onClick={() => {
                    if (selectedLoan) handleRejectSession(selectedLoan);
                  }}
                  disabled={loading}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
                <Button 
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600" 
                  onClick={handleApproveSessionWithSignature}
                  disabled={loading || !termsAccepted}
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" /> Accept & Sign
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay EMI</DialogTitle>
          </DialogHeader>
          {selectedEmi && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">EMI Number</span>
                  <span className="font-medium">#{selectedEmi.installmentNumber}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Due Date</span>
                  <span className="font-medium">{formatDate(selectedEmi.dueDate)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Principal</span>
                  <span className="font-medium">{formatCurrency(selectedEmi.principalAmount)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Interest</span>
                  <span className="font-medium">{formatCurrency(selectedEmi.interestAmount)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(selectedEmi.totalAmount)}</span>
                </div>
                {selectedEmi.penaltyAmount > 0 && (
                  <div className="flex justify-between text-red-600 text-sm mt-2">
                    <span>Penalty</span>
                    <span>+{formatCurrency(selectedEmi.penaltyAmount)}</span>
                  </div>
                )}
              </div>
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600" onClick={handlePayment} disabled={loading}>
                {loading ? 'Processing...' : `Pay ${formatCurrency(selectedEmi.totalAmount)}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Top-Up Dialog */}
      <Dialog open={showTopUpDialog} onOpenChange={setShowTopUpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Loan Top-Up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Top-Up Amount</Label>
              <Input type="number" value={topUpForm.amount} onChange={(e) => setTopUpForm({ ...topUpForm, amount: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={topUpForm.reason} onChange={(e) => setTopUpForm({ ...topUpForm, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTopUpDialog(false)}>Cancel</Button>
            <Button onClick={handleRequestTopUp}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Foreclosure Dialog */}
      <Dialog open={showForeclosureDialog} onOpenChange={setShowForeclosureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Foreclosure</DialogTitle>
          </DialogHeader>
          {selectedLoan && emiSchedules.length > 0 && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Foreclosure will close your loan account. You will need to pay the outstanding principal and pending interest.
                </AlertDescription>
              </Alert>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span>Outstanding Principal</span>
                  <span>{formatCurrency(emiSchedules.filter(e => e.paymentStatus !== 'PAID' && e.paymentStatus !== 'INTEREST_ONLY_PAID').reduce((s, e) => s + e.principalAmount, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Interest</span>
                  <span>{formatCurrency(emiSchedules.filter(e => e.paymentStatus !== 'PAID' && e.paymentStatus !== 'INTEREST_ONLY_PAID').reduce((s, e) => s + e.interestAmount, 0))}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForeclosureDialog(false)}>Cancel</Button>
            <Button onClick={handleRequestForeclosure}>Request Foreclosure</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EMI Date Change Dialog */}
      <Dialog open={showEMIDateDialog} onOpenChange={setShowEMIDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change EMI Due Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New EMI Due Date (Day of Month)</Label>
              <Select value={emiDateForm.newDate.toString()} onValueChange={(v) => setEmiDateForm({ ...emiDateForm, newDate: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,5,10,15,20,25].map(d => <SelectItem key={d} value={d.toString()}>{d}th of every month</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={emiDateForm.reason} onChange={(e) => setEmiDateForm({ ...emiDateForm, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEMIDateDialog(false)}>Cancel</Button>
            <Button onClick={handleRequestEMIDateChange}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Referral Dialog */}
      <Dialog open={showReferralDialog} onOpenChange={setShowReferralDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refer a Friend</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Friend's Email *</Label>
              <Input type="email" value={referralForm.email} onChange={(e) => setReferralForm({ ...referralForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Friend's Phone (Optional)</Label>
              <Input value={referralForm.phone} onChange={(e) => setReferralForm({ ...referralForm, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReferralDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateReferral}>Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
