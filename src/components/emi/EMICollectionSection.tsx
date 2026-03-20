'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar, IndianRupee, Clock, AlertTriangle, CheckCircle,
  Phone, MapPin, User, Wallet, CreditCard, Banknote, Receipt,
  Upload, FileCheck, Building2, Info, X, ImageIcon, Settings
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import EMISettingsDialog from '@/components/customer/EMISettingsDialog';

interface EMIItem {
  id: string;
  installmentNumber: number;
  totalAmount: number;
  dueDate: string;
  paymentStatus: string;
  paidAmount: number;
  loanApplication?: {
    id: string;
    applicationNo: string;
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
  };
  offlineLoan?: {
    id: string;
    loanNumber: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
  };
}

interface EMICollectionSectionProps {
  userId: string;
  userRole: string;
  onPaymentComplete?: () => void;
}

export default function EMICollectionSection({ userId, userRole, onPaymentComplete }: EMICollectionSectionProps) {
  const [loading, setLoading] = useState(true);
  const [todayEmis, setTodayEmis] = useState<{ online: EMIItem[]; offline: EMIItem[] }>({ online: [], offline: [] });
  const [tomorrowEmis, setTomorrowEmis] = useState<{ online: EMIItem[]; offline: EMIItem[] }>({ online: [], offline: [] });
  const [overdueEmis, setOverdueEmis] = useState<{ online: EMIItem[]; offline: EMIItem[] }>({ online: [], offline: [] });
  const [summary, setSummary] = useState({ today: { count: 0, amount: 0 }, tomorrow: { count: 0, amount: 0 }, overdue: { count: 0, amount: 0 } });
  
  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedEmi, setSelectedEmi] = useState<EMIItem | null>(null);
  const [selectedType, setSelectedType] = useState<'online' | 'offline'>('offline');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [creditType, setCreditType] = useState<'COMPANY' | 'PERSONAL'>('COMPANY');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [chequeNumber, setChequeNumber] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [paying, setPaying] = useState(false);
  
  // Active tab
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'overdue'>('today');
  
  // EMI Settings dialog
  const [showEmiSettingsDialog, setShowEmiSettingsDialog] = useState(false);
  const [selectedEmiForSettings, setSelectedEmiForSettings] = useState<any>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchEmis();
  }, [userId, userRole]);

  const fetchEmis = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/emi-reminder?action=today-tomorrow&userId=${userId}&userRole=${userRole}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTodayEmis(data.todayEmis);
          setTomorrowEmis(data.tomorrowEmis);
          setOverdueEmis(data.overdueEmis);
          setSummary(data.summary);
        }
      }
    } catch (error) {
      console.error('Failed to fetch EMIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayEmi = async () => {
    if (!selectedEmi) return;

    // Validate proof requirement
    const requiresProof = paymentMode !== 'CASH' || creditType === 'PERSONAL';
    if (requiresProof && !proofFile) {
      toast({
        title: 'Proof Required',
        description: `Please upload proof for ${paymentMode !== 'CASH' ? paymentMode.toLowerCase() : 'personal'} transactions`,
        variant: 'destructive'
      });
      return;
    }

    // Validate cheque number for cheque payments
    if (paymentMode === 'CHEQUE' && !chequeNumber) {
      toast({
        title: 'Cheque Number Required',
        description: 'Please enter the cheque number',
        variant: 'destructive'
      });
      return;
    }

    // Validate UTR for online payments
    if ((paymentMode === 'ONLINE' || paymentMode === 'UPI' || paymentMode === 'BANK_TRANSFER') && !utrNumber) {
      toast({
        title: 'UTR/Reference Required',
        description: 'Please enter the UTR or transaction reference number',
        variant: 'destructive'
      });
      return;
    }

    try {
      setPaying(true);
      
      // Upload proof if provided
      let proofDocumentPath = null;
      if (proofFile) {
        const formData = new FormData();
        formData.append('file', proofFile);
        formData.append('type', 'emi-proof');
        
        const uploadRes = await fetch('/api/upload/document', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          proofDocumentPath = uploadData.path;
        }
      }
      
      // Create credit transaction with dual credit system
      const customerName = selectedType === 'offline' 
        ? selectedEmi.offlineLoan?.customerName 
        : `${selectedEmi.loanApplication?.firstName || ''} ${selectedEmi.loanApplication?.lastName || ''}`.trim();
      const customerPhone = selectedType === 'offline'
        ? selectedEmi.offlineLoan?.customerPhone
        : selectedEmi.loanApplication?.phone;
      const loanNo = selectedType === 'offline'
        ? selectedEmi.offlineLoan?.loanNumber
        : selectedEmi.loanApplication?.applicationNo;
      
      // Create credit transaction
      const creditRes = await fetch('/api/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: selectedEmi.totalAmount,
          paymentMode,
          creditType,
          sourceType: 'EMI_PAYMENT',
          loanApplicationId: selectedType === 'online' ? selectedEmi.loanApplication?.id : null,
          emiScheduleId: selectedEmi.id,
          customerId: selectedType === 'online' ? selectedEmi.loanApplication?.id : null,
          installmentNumber: selectedEmi.installmentNumber,
          customerName,
          customerPhone,
          loanApplicationNo: loanNo,
          emiDueDate: selectedEmi.dueDate,
          emiAmount: selectedEmi.totalAmount,
          chequeNumber: paymentMode === 'CHEQUE' ? chequeNumber : null,
          utrNumber: ['ONLINE', 'UPI', 'BANK_TRANSFER'].includes(paymentMode) ? utrNumber : null,
          proofDocument: proofDocumentPath,
          proofType: proofFile?.type,
          description: `EMI #${selectedEmi.installmentNumber} collection`,
          remarks
        })
      });
      
      const creditData = await creditRes.json();
      
      if (!creditData.success) {
        throw new Error(creditData.error || 'Failed to update credit');
      }
      
      // Update EMI status
      const endpoint = selectedType === 'offline' ? '/api/offline-loan' : '/api/customer/payment';
      
      const body = selectedType === 'offline' ? {
        action: 'pay-emi',
        emiId: selectedEmi.id,
        userId,
        paymentMode,
        amount: selectedEmi.totalAmount
      } : {
        loanId: selectedEmi.loanApplication?.id,
        emiScheduleId: selectedEmi.id,
        customerId: selectedEmi.loanApplication?.id,
        amount: selectedEmi.totalAmount,
        paidById: userId,
        paymentMode
      };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Reset form
          setPaymentDialogOpen(false);
          setProofFile(null);
          setChequeNumber('');
          setUtrNumber('');
          setRemarks('');
          setCreditType('COMPANY');
          setPaymentMode('CASH');
          
          fetchEmis();
          onPaymentComplete?.();
          
          toast({
            title: 'Payment Collected',
            description: `EMI collected successfully. ${creditType === 'COMPANY' && paymentMode === 'CASH' ? 'Company credit' : 'Personal credit'} increased by ${formatCurrency(selectedEmi.totalAmount)}`,
          });
        }
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to process payment');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process payment',
        variant: 'destructive'
      });
    } finally {
      setPaying(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openPaymentDialog = (emi: EMIItem, type: 'online' | 'offline') => {
    setSelectedEmi(emi);
    setSelectedType(type);
    setPaymentDialogOpen(true);
  };

  const getCreditInfo = () => {
    if (paymentMode === 'CASH' && creditType === 'COMPANY') {
      return {
        type: 'Company Credit',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        description: 'This CASH payment will increase your company credit.'
      };
    } else {
      return {
        type: 'Personal Credit',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        description: 'This transaction will increase your personal credit. You need to settle with Super Admin.'
      };
    }
  };

  const renderEmiCard = (emi: EMIItem, type: 'online' | 'offline', isOverdue: boolean = false) => {
    const customerName = type === 'offline' 
      ? emi.offlineLoan?.customerName 
      : `${emi.loanApplication?.firstName || ''} ${emi.loanApplication?.lastName || ''}`.trim();
    const loanNumber = type === 'offline' 
      ? emi.offlineLoan?.loanNumber 
      : emi.loanApplication?.applicationNo;
    const phone = type === 'offline' 
      ? emi.offlineLoan?.customerPhone 
      : emi.loanApplication?.phone;
    const address = type === 'offline' 
      ? emi.offlineLoan?.customerAddress 
      : emi.loanApplication?.address;

    return (
      <motion.div
        key={emi.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'} hover:shadow-md transition-shadow`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={type === 'offline' ? 'secondary' : 'outline'}>
                {type === 'offline' ? 'Offline' : 'Online'}
              </Badge>
              <span className="text-sm font-medium text-gray-600">EMI #{emi.installmentNumber}</span>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900">{customerName}</span>
            </div>
            
            <div className="text-sm text-gray-500 space-y-1">
              <div className="flex items-center gap-2">
                <Receipt className="h-3 w-3" />
                <span>{loanNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3" />
                <span>{phone}</span>
              </div>
              {address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">{address}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{formatCurrency(emi.totalAmount)}</p>
            <p className="text-xs text-gray-500">Due: {formatDate(emi.dueDate)}</p>
            <div className="flex gap-1 mt-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setSelectedEmiForSettings({
                    ...emi,
                    loanApplicationId: emi.loanApplication?.id
                  });
                  setShowEmiSettingsDialog(true);
                }}
                title="Payment Settings"
              >
                <Settings className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600"
                onClick={() => openPaymentDialog(emi, type)}
              >
                <IndianRupee className="h-4 w-4 mr-1" />
                Pay
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalToday = todayEmis.online.length + todayEmis.offline.length;
  const totalTomorrow = tomorrowEmis.online.length + tomorrowEmis.offline.length;
  const totalOverdue = overdueEmis.online.length + overdueEmis.offline.length;

  const creditInfo = getCreditInfo();
  const requiresProof = paymentMode !== 'CASH' || creditType === 'PERSONAL';

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              EMI Collection
            </CardTitle>
            <div className="flex gap-2">
              <Badge className="bg-white/20 text-white border-0">
                Today: {totalToday} ({formatCurrency(summary.today.amount)})
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'today' 
                ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('today')}
          >
            <div className="flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4" />
              Today ({totalToday})
            </div>
          </button>
          <button
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'tomorrow' 
                ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('tomorrow')}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-4 w-4" />
              Tomorrow ({totalTomorrow})
            </div>
          </button>
          <button
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'overdue' 
                ? 'text-red-600 border-b-2 border-red-500 bg-red-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('overdue')}
          >
            <div className="flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue ({totalOverdue})
            </div>
          </button>
        </div>
        
        <CardContent className="p-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium">Today</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(summary.today.amount)}</p>
              <p className="text-xs text-emerald-500">{summary.today.count} EMIs</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-600 font-medium">Tomorrow</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(summary.tomorrow.amount)}</p>
              <p className="text-xs text-blue-500">{summary.tomorrow.count} EMIs</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-50 border border-red-100">
              <p className="text-xs text-red-600 font-medium">Overdue</p>
              <p className="text-lg font-bold text-red-700">{formatCurrency(summary.overdue.amount)}</p>
              <p className="text-xs text-red-500">{summary.overdue.count} EMIs</p>
            </div>
          </div>

          {/* EMI List */}
          <ScrollArea className="h-[300px]">
            {activeTab === 'today' && (
              <>
                {totalToday === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No EMIs to collect today</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayEmis.offline.map(emi => renderEmiCard(emi, 'offline'))}
                    {todayEmis.online.map(emi => renderEmiCard(emi, 'online'))}
                  </div>
                )}
              </>
            )}
            
            {activeTab === 'tomorrow' && (
              <>
                {totalTomorrow === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No EMIs for tomorrow</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tomorrowEmis.offline.map(emi => renderEmiCard(emi, 'offline'))}
                    {tomorrowEmis.online.map(emi => renderEmiCard(emi, 'online'))}
                  </div>
                )}
              </>
            )}
            
            {activeTab === 'overdue' && (
              <>
                {totalOverdue === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No overdue EMIs</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {overdueEmis.offline.map(emi => renderEmiCard(emi, 'offline', true))}
                    {overdueEmis.online.map(emi => renderEmiCard(emi, 'online', true))}
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Collect EMI Payment</DialogTitle>
            <DialogDescription>
              Select payment mode and credit type. Only CASH increases company credit.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEmi && (
            <div className="space-y-4 pt-4">
              {/* EMI Details */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">EMI Number</span>
                  <span className="font-medium">#{selectedEmi.installmentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedEmi.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Due Date</span>
                  <span className="font-medium">{formatDate(selectedEmi.dueDate)}</span>
                </div>
              </div>

              {/* Payment Mode Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Payment Mode</label>
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
                    className={paymentMode === 'ONLINE' ? 'bg-purple-500 hover:bg-purple-600' : ''}
                    onClick={() => setPaymentMode('ONLINE')}
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    Online
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMode === 'CHEQUE' ? 'default' : 'outline'}
                    className={paymentMode === 'CHEQUE' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                    onClick={() => setPaymentMode('CHEQUE')}
                  >
                    <Receipt className="h-4 w-4 mr-1" />
                    Cheque
                  </Button>
                </div>
              </div>

              {/* Credit Type Selection - Only for CASH payments */}
              {paymentMode === 'CASH' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Credit Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={creditType === 'COMPANY' ? 'default' : 'outline'}
                      className={creditType === 'COMPANY' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                      onClick={() => setCreditType('COMPANY')}
                    >
                      <Building2 className="h-4 w-4 mr-1" />
                      Company Credit
                    </Button>
                    <Button
                      type="button"
                      variant={creditType === 'PERSONAL' ? 'default' : 'outline'}
                      className={creditType === 'PERSONAL' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                      onClick={() => setCreditType('PERSONAL')}
                    >
                      <User className="h-4 w-4 mr-1" />
                      Personal Credit
                    </Button>
                  </div>
                </div>
              )}

              {/* Cheque Details */}
              {paymentMode === 'CHEQUE' && (
                <div className="space-y-2">
                  <Label>Cheque Number *</Label>
                  <Input
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="Enter cheque number"
                  />
                </div>
              )}

              {/* UTR for Online */}
              {['ONLINE', 'UPI', 'BANK_TRANSFER'].includes(paymentMode) && (
                <div className="space-y-2">
                  <Label>UTR / Transaction Reference *</Label>
                  <Input
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="Enter UTR or reference number"
                  />
                </div>
              )}

              {/* Proof Upload */}
              {requiresProof && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Proof Document *
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  </Label>
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="proof-upload"
                    />
                    <label
                      htmlFor="proof-upload"
                      className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      {proofFile ? (
                        <div className="flex items-center gap-2">
                          {proofFile.type.startsWith('image/') ? (
                            <ImageIcon className="h-5 w-5 text-blue-500" />
                          ) : (
                            <FileCheck className="h-5 w-5 text-emerald-500" />
                          )}
                          <span className="text-sm font-medium">{proofFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-2"
                            onClick={(e) => {
                              e.preventDefault();
                              setProofFile(null);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                          <span className="text-sm text-gray-500">Click to upload proof</span>
                          <p className="text-xs text-gray-400">Image or PDF</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Remarks */}
              <div className="space-y-2">
                <Label>Remarks (Optional)</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any notes..."
                  rows={2}
                />
              </div>

              {/* Credit Info */}
              <div className={`${creditInfo.bgColor} p-3 rounded-lg`}>
                <div className="flex items-start gap-2">
                  <Info className={`h-4 w-4 mt-0.5 ${creditInfo.color}`} />
                  <div>
                    <p className={`text-sm font-medium ${creditInfo.color}`}>
                      {creditInfo.type}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {creditInfo.description}
                    </p>
                    <p className="text-sm font-bold mt-1">
                      Amount: {formatCurrency(selectedEmi.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setPaymentDialogOpen(false);
                    setProofFile(null);
                    setChequeNumber('');
                    setUtrNumber('');
                    setRemarks('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                  onClick={handlePayEmi}
                  disabled={paying}
                >
                  {paying ? 'Processing...' : 'Confirm & Collect'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EMI Settings Dialog */}
      <EMISettingsDialog
        open={showEmiSettingsDialog}
        onOpenChange={setShowEmiSettingsDialog}
        emi={selectedEmiForSettings}
        loanId={selectedEmiForSettings?.loanApplicationId}
        onSettingsSaved={() => {
          fetchEmis();
          onPaymentComplete?.();
        }}
      />
    </>
  );
}
