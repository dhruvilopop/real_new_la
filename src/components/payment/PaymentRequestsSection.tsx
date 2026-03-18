'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, CheckCircle, XCircle, Eye, Search, Filter, IndianRupee,
  CreditCard, Wallet, Percent, Banknote, FileText, Image as ImageIcon,
  Calendar, User, Building2, AlertCircle, RefreshCw, MessageSquare,
  Settings, Upload, QrCode, Save, Landmark
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentRequest {
  id: string;
  requestNumber: string;
  loanApplicationId: string;
  emiScheduleId: string;
  customerId: string;
  paymentType: string;
  requestedAmount: number;
  partialAmount: number | null;
  remainingAmount: number | null;
  newDueDate: string | null;
  partialPaymentNumber: number | null;
  interestAmount: number | null;
  principalDeferred: boolean;
  paymentMethod: string;
  utrNumber: string;
  proofUrl: string;
  proofFileName: string;
  status: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewRemarks: string | null;
  rejectionReason: string | null;
  createdAt: string;
  loanApplication: {
    id: string;
    applicationNo: string;
    customer: { id: string; name: string; email: string; phone: string };
    sessionForm?: { emiAmount: number; interestRate: number; tenure: number };
  };
  emiSchedule?: {
    id: string;
    installmentNumber: number;
    dueDate: string;
    totalAmount: number;
    principalAmount: number;
    interestAmount: number;
    partialPaymentCount: number;
  };
  customer: { id: string; name: string; email: string; phone: string };
  reviewer?: { id: string; name: string; role: string };
}

interface PaymentRequestsSectionProps {
  cashierId: string;
}

interface PaymentSettings {
  companyUpiId?: string;
  companyQrCodeUrl?: string;
  collectionBankAccountId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankBranch?: string;
}

export default function PaymentRequestsSection({ cashierId }: PaymentRequestsSectionProps) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings>({});
  const [settingsForm, setSettingsForm] = useState({
    companyUpiId: '',
    companyQrCodeUrl: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    bankBranch: ''
  });

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/payment');
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings || {});
        setSettingsForm({
          companyUpiId: data.settings?.companyUpiId || '',
          companyQrCodeUrl: data.settings?.companyQrCodeUrl || '',
          bankName: data.settings?.bankName || '',
          bankAccountNumber: data.settings?.bankAccountNumber || '',
          bankIfscCode: data.settings?.bankIfscCode || '',
          bankBranch: data.settings?.bankBranch || ''
        });
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  const savePaymentSettings = async () => {
    setSavingSettings(true);
    try {
    const response = await fetch('/api/settings/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm)
      });
      const data = await response.json();
      if (data.success) {
        toast({ 
          title: 'Settings Saved', 
          description: 'Payment settings have been updated successfully. Customers will see the new details.' 
        });
        setShowSettingsDialog(false);
        fetchSettings();
      } else {
        toast({ 
          title: 'Error', 
          description: data.error || 'Failed to save settings', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error saving payment settings:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to save payment settings', 
        variant: 'destructive' 
      });
    } finally {
      setSavingSettings(false);
      }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const status = statusFilter === 'ALL' ? '' : statusFilter;
      const response = await fetch(`/api/payment-request?role=CASHIER&status=${status}`);
      const data = await response.json();
      if (data.success) {
        setRequests(data.paymentRequests || []);
      }
    } catch (error) {
      console.error('Error fetching payment requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedRequest) return;

    if (actionType === 'reject' && !rejectionReason) {
      toast({ title: 'Reason Required', description: 'Please provide a reason for rejection', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/payment-request', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          paymentRequestId: selectedRequest.id,
          reviewedById: cashierId,
          reviewRemarks,
          rejectionReason
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({ 
          title: `Payment ${actionType === 'approve' ? 'Approved' : 'Rejected'}`, 
          description: actionType === 'approve' 
            ? 'EMI has been updated successfully' 
            : 'Customer has been notified' 
        });
        setShowActionDialog(false);
        setShowDetailDialog(false);
        fetchRequests();
        resetActionState();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to process', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error processing payment request:', error);
      toast({ title: 'Error', description: 'Failed to process request', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const resetActionState = () => {
    setReviewRemarks('');
    setRejectionReason('');
    setActionType('approve');
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string; icon: any }> = {
      PENDING: { className: 'bg-yellow-100 text-yellow-700', label: 'Pending', icon: Clock },
      UNDER_REVIEW: { className: 'bg-blue-100 text-blue-700', label: 'Under Review', icon: Eye },
      APPROVED: { className: 'bg-green-100 text-green-700', label: 'Approved', icon: CheckCircle },
      REJECTED: { className: 'bg-red-100 text-red-700', label: 'Rejected', icon: XCircle },
      EXPIRED: { className: 'bg-gray-100 text-gray-700', label: 'Expired', icon: AlertCircle },
      CANCELLED: { className: 'bg-gray-100 text-gray-700', label: 'Cancelled', icon: XCircle },
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700', label: status, icon: Clock };
    const Icon = c.icon;
    return (
      <Badge className={c.className}>
        <Icon className="h-3 w-3 mr-1" /> {c.label}
      </Badge>
    );
  };

  const getPaymentTypeBadge = (type: string) => {
    const config: Record<string, { className: string; label: string; icon: any }> = {
      FULL_EMI: { className: 'bg-emerald-100 text-emerald-700', label: 'Full Payment', icon: Wallet },
      PARTIAL_PAYMENT: { className: 'bg-orange-100 text-orange-700', label: 'Partial', icon: Banknote },
      INTEREST_ONLY: { className: 'bg-purple-100 text-purple-700', label: 'Interest Only', icon: Percent },
    };
    const c = config[type] || { className: 'bg-gray-100 text-gray-700', label: type, icon: CreditCard };
    const Icon = c.icon;
    return (
      <Badge className={c.className}>
        <Icon className="h-3 w-3 mr-1" /> {c.label}
      </Badge>
    );
  };

  const filteredRequests = requests.filter(req => 
    req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.loanApplication.applicationNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.customer.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedToday = requests.filter(r => 
    r.status === 'APPROVED' && 
    r.reviewedAt && 
    new Date(r.reviewedAt).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Requests</p>
                <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Approved Today</p>
                <p className="text-2xl font-bold text-emerald-600">{approvedToday}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{requests.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by request #, loan #, or customer name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Requests</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchRequests}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowSettingsDialog(true)}>
              <Settings className="h-4 w-4 mr-2" /> Payment Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings Preview Card */}
      {(settings.companyUpiId || settings.bankName) && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <QrCode className="h-5 w-5 text-emerald-600" />
              <span className="font-medium text-emerald-800">Active Payment Configuration</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {settings.companyUpiId && (
                <div className="text-center">
                  <p className="text-gray-500">UPI ID</p>
                  <p className="font-mono font-medium">{settings.companyUpiId}</p>
                </div>
              )}
              {settings.companyQrCodeUrl && (
                <div className="text-center">
                  <p className="text-gray-500">QR Code</p>
                  <p className="font-medium text-emerald-600">✓ Uploaded</p>
                </div>
              )}
              {settings.bankName && (
                <div className="text-center">
                  <p className="text-gray-500">Bank</p>
                  <p className="font-medium">{settings.bankName}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Payment Requests</CardTitle>
          <CardDescription>
            Review and approve customer payment submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading payment requests...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No payment requests found</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredRequests.map((req, index) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.03 }}
                      className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all bg-white"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 bg-gradient-to-br from-orange-400 to-red-500">
                            <AvatarFallback className="bg-transparent text-white font-semibold">
                              {req.customer.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">{req.requestNumber}</h4>
                              {getStatusBadge(req.status)}
                              {getPaymentTypeBadge(req.paymentType)}
                            </div>
                            <p className="text-sm text-gray-500">
                              {req.loanApplication.applicationNo} • {req.customer.name} • EMI #{req.emiSchedule?.installmentNumber}
                            </p>
                            <p className="text-xs text-gray-400">{formatDate(req.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-lg text-gray-900">{formatCurrency(req.requestedAmount)}</p>
                            <p className="text-xs text-gray-500">UTR: {req.utrNumber}</p>
                          </div>
                          {req.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setShowDetailDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" /> View
                              </Button>
                              <Button 
                                size="sm"
                                className="bg-emerald-500 hover:bg-emerald-600"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setActionType('approve');
                                  setShowActionDialog(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" /> Approve
                              </Button>
                            </div>
                          )}
                          {req.status !== 'PENDING' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(req);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Partial Payment Info */}
                      {req.paymentType === 'PARTIAL_PAYMENT' && req.partialAmount && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex gap-4 text-sm">
                            <span className="text-gray-500">Partial: <span className="font-medium text-orange-600">{formatCurrency(req.partialAmount)}</span></span>
                            <span className="text-gray-500">Remaining: <span className="font-medium">{formatCurrency(req.remainingAmount || 0)}</span></span>
                            {req.newDueDate && (
                              <span className="text-gray-500">New Due: <span className="font-medium">{formatDate(req.newDueDate)}</span></span>
                            )}
                            {req.partialPaymentNumber && (
                              <Badge variant="outline" className="text-xs">Payment {req.partialPaymentNumber}/2</Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Interest Only Info */}
                      {req.paymentType === 'INTEREST_ONLY' && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex gap-4 text-sm">
                            <span className="text-gray-500">Interest Paid: <span className="font-medium text-purple-600">{formatCurrency(req.interestAmount || 0)}</span></span>
                            <Badge variant="outline" className="text-xs text-purple-600">Principal deferred to new EMI</Badge>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[95vh] p-0">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 text-white">
                <CreditCard className="h-6 w-6" /> Payment Request Details
              </DialogTitle>
              <DialogDescription className="text-blue-100">
                {selectedRequest?.requestNumber}
              </DialogDescription>
            </DialogHeader>
          </div>

          {selectedRequest && (
            <ScrollArea className="max-h-[calc(95vh-120px)]">
              <div className="p-6 space-y-6">
                {/* Customer & Loan Info */}
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-500">Customer Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{selectedRequest.customer.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{selectedRequest.customer.name}</p>
                          <p className="text-sm text-gray-500">{selectedRequest.customer.phone}</p>
                          <p className="text-xs text-gray-400">{selectedRequest.customer.email}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-500">Loan Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedRequest.loanApplication.applicationNo}</p>
                      <p className="text-sm text-gray-500">EMI #{selectedRequest.emiSchedule?.installmentNumber}</p>
                      {selectedRequest.loanApplication.sessionForm && (
                        <p className="text-xs text-gray-400">
                          EMI: {formatCurrency(selectedRequest.loanApplication.sessionForm.emiAmount)}/mo
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Payment Details */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Payment Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Payment Type</p>
                        <div className="mt-1">{getPaymentTypeBadge(selectedRequest.paymentType)}</div>
                      </div>
                      <div className="text-center p-4 bg-emerald-50 rounded-lg">
                        <p className="text-xs text-emerald-600">Amount</p>
                        <p className="text-xl font-bold text-emerald-700">{formatCurrency(selectedRequest.requestedAmount)}</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600">Method</p>
                        <p className="font-medium text-blue-700">{selectedRequest.paymentMethod}</p>
                      </div>
                    </div>

                    {selectedRequest.paymentType === 'PARTIAL_PAYMENT' && selectedRequest.partialAmount && (
                      <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h4 className="font-medium text-orange-800 mb-2">Partial Payment Details</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Partial Amount</p>
                            <p className="font-medium">{formatCurrency(selectedRequest.partialAmount)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Remaining Amount</p>
                            <p className="font-medium">{formatCurrency(selectedRequest.remainingAmount || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">New Due Date</p>
                            <p className="font-medium">{selectedRequest.newDueDate ? formatDate(selectedRequest.newDueDate) : 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRequest.paymentType === 'INTEREST_ONLY' && (
                      <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h4 className="font-medium text-purple-800 mb-2">Interest Only Payment</h4>
                        <p className="text-sm text-purple-600">
                          Customer paid only interest. A new EMI with principal + new interest will be created upon approval.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment Proof */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Payment Proof
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">UTR / Reference</p>
                        <p className="font-mono font-medium">{selectedRequest.utrNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Submitted On</p>
                        <p className="font-medium">{formatDate(selectedRequest.createdAt)}</p>
                      </div>
                    </div>
                    
                    {selectedRequest.proofUrl && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">Payment Screenshot</p>
                        <a href={selectedRequest.proofUrl} target="_blank" rel="noopener noreferrer" className="block">
                          <img 
                            src={selectedRequest.proofUrl} 
                            alt="Payment proof" 
                            className="max-h-60 rounded-lg border hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Review History */}
                {selectedRequest.status !== 'PENDING' && selectedRequest.reviewer && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Review History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{selectedRequest.reviewer.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{selectedRequest.reviewer.name}</p>
                          <p className="text-sm text-gray-500">
                            {selectedRequest.status} on {formatDate(selectedRequest.reviewedAt || '')}
                          </p>
                          {selectedRequest.reviewRemarks && (
                            <p className="text-sm mt-1">{selectedRequest.reviewRemarks}</p>
                          )}
                          {selectedRequest.rejectionReason && (
                            <p className="text-sm text-red-600 mt-1">Reason: {selectedRequest.rejectionReason}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                {selectedRequest.status === 'PENDING' && (
                  <div className="flex justify-end gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowDetailDialog(false);
                        setActionType('reject');
                        setShowActionDialog(true);
                      }}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                    <Button 
                      className="bg-emerald-500 hover:bg-emerald-600"
                      onClick={() => {
                        setShowDetailDialog(false);
                        setActionType('approve');
                        setShowActionDialog(true);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Approve Payment
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' ? (
                <><CheckCircle className="h-5 w-5 text-emerald-500" /> Approve Payment</>
              ) : (
                <><XCircle className="h-5 w-5 text-red-500" /> Reject Payment</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.requestNumber} - {formatCurrency(selectedRequest?.requestedAmount || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionType === 'approve' && (
              <Alert className="bg-emerald-50 border-emerald-200">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-700">
                  This will mark the EMI as paid and update the loan schedule.
                  {selectedRequest?.paymentType === 'INTEREST_ONLY' && (
                    <span className="block mt-1 font-medium">A new EMI will be created with principal + new interest.</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {actionType === 'reject' && (
              <div>
                <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejection..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            )}

            <div>
              <Label htmlFor="reviewRemarks">Additional Remarks (Optional)</Label>
              <Textarea
                id="reviewRemarks"
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="Any additional notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowActionDialog(false); resetActionState(); }}>
              Cancel
            </Button>
            <Button 
              className={actionType === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}
              onClick={handleAction}
              disabled={processing || (actionType === 'reject' && !rejectionReason)}
            >
              {processing ? 'Processing...' : actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl max-h-[95vh] p-0">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 text-white">
                <Settings className="h-6 w-6" /> Payment Settings
              </DialogTitle>
              <DialogDescription className="text-emerald-100">
                Configure QR code, UPI ID, and bank details for customer payments
              </DialogDescription>
            </DialogHeader>
          </div>

          <ScrollArea className="max-h-[calc(95vh-120px)]">
            <div className="p-6 space-y-6">
              <Tabs defaultValue="upi" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upi" className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" /> UPI / QR Code
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="flex items-center gap-2">
                    <Landmark className="h-4 w-4" /> Bank Details
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upi" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-500">UPI Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="companyUpiId">UPI ID</Label>
                        <Input
                          id="companyUpiId"
                          value={settingsForm.companyUpiId}
                          onChange={(e) => setSettingsForm({ ...settingsForm, companyUpiId: e.target.value })}
                          placeholder="example@upi"
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">Customers will see this UPI ID for payments</p>
                      </div>
                      <div>
                        <Label htmlFor="companyQrCodeUrl">QR Code Image URL</Label>
                        <Input
                          id="companyQrCodeUrl"
                          value={settingsForm.companyQrCodeUrl}
                          onChange={(e) => setSettingsForm({ ...settingsForm, companyQrCodeUrl: e.target.value })}
                          placeholder="https://example.com/qr-code.png"
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">URL to your QR code image</p>
                      </div>
                      {settingsForm.companyQrCodeUrl && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-500 mb-2">QR Code Preview:</p>
                          <img 
                            src={settingsForm.companyQrCodeUrl} 
                            alt="QR Code Preview" 
                            className="max-h-40 rounded-lg border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Invalid+URL';
                            }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="bank" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-500">Bank Account Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="bankName">Bank Name</Label>
                          <Input
                            id="bankName"
                            value={settingsForm.bankName}
                            onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                            placeholder="State Bank of India"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="bankBranch">Branch</Label>
                          <Input
                            id="bankBranch"
                            value={settingsForm.bankBranch}
                            onChange={(e) => setSettingsForm({ ...settingsForm, bankBranch: e.target.value })}
                            placeholder="Main Branch"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="bankAccountNumber">Account Number</Label>
                          <Input
                            id="bankAccountNumber"
                            value={settingsForm.bankAccountNumber}
                            onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountNumber: e.target.value })}
                            placeholder="1234567890123456"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="bankIfscCode">IFSC Code</Label>
                          <Input
                            id="bankIfscCode"
                            value={settingsForm.bankIfscCode}
                            onChange={(e) => setSettingsForm({ ...settingsForm, bankIfscCode: e.target.value.toUpperCase() })}
                            placeholder="SBIN0001234"
                            className="mt-1"
                            maxLength={11}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  Changes will be immediately visible to customers on the payment page. Make sure the details are correct.
                </AlertDescription>
              </Alert>
            </div>
          </ScrollArea>

          <div className="p-4 border-t flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={savePaymentSettings}
              disabled={savingSettings}
            >
              {savingSettings ? (
                <>Saving...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Save Settings</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
