'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CreditCard, Wallet, Percent, Calendar, IndianRupee, Upload, QrCode, Copy, 
  Building2, AlertCircle, CheckCircle, Clock, FileText, Image as ImageIcon, Info,
  ChevronRight, Shield, Smartphone, Banknote
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';

interface EMISchedule {
  id: string;
  installmentNumber: number;
  dueDate: string;
  originalDueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  partialPaymentCount: number;
  isInterestOnly: boolean;
  principalDeferred: boolean;
  interestOnlyPaidAt: string | null;
}

interface PaymentSettings {
  enableFullPayment: boolean;
  enablePartialPayment: boolean;
  enableInterestOnly: boolean;
  maxPartialPayments: number;
  maxInterestOnlyPerLoan: number;
  acceptedPaymentMethods?: string;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emi: EMISchedule | null;
  loanId: string;
  customerId: string;
  companyUpiId?: string;
  companyQrCodeUrl?: string;
  bankDetails?: any;
  onPaymentSubmitted: () => void;
}

export default function PaymentDialog({
  open,
  onOpenChange,
  emi,
  loanId,
  customerId,
  companyUpiId = 'moneymitra@upi',
  companyQrCodeUrl,
  bankDetails,
  onPaymentSubmitted
}: PaymentDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'FULL' | 'PARTIAL' | 'INTEREST_ONLY'>('FULL');
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Payment form state
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK_TRANSFER' | 'CASH'>('UPI');
  const [utrNumber, setUtrNumber] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string>('');
  const [step, setStep] = useState(1); // 1: Select Option, 2: Payment Details

  useEffect(() => {
    if (open && emi) {
      fetchSettings();
      // Reset state
      setSelectedOption('FULL');
      setPartialAmount(Math.floor(emi.totalAmount / 2));
      setNewDueDate('');
      setUtrNumber('');
      setProofFile(null);
      setProofPreview('');
      setStep(1);
    }
  }, [open, emi]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/payment-request?action=settings&loanApplicationId=${loanId}`);
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: 'File too large', description: 'Maximum file size is 5MB', variant: 'destructive' });
        return;
      }
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: `${text} copied to clipboard` });
  };

  const getRemainingAmount = () => {
    if (!emi) return 0;
    return emi.totalAmount - (emi.paidAmount || 0) - partialAmount;
  };

  const getMinPartialDate = () => {
    if (!emi) return '';
    const dueDate = new Date(emi.dueDate);
    dueDate.setDate(dueDate.getDate() + 1); // Must be after due date
    return dueDate.toISOString().split('T')[0];
  };

  const getMaxPartialDate = () => {
    if (!emi) return '';
    // Max 30 days from due date
    const dueDate = new Date(emi.dueDate);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate.toISOString().split('T')[0];
  };

  const validatePartialPayment = () => {
    if (!emi) return false;
    
    // Check max partial payments
    if (emi.partialPaymentCount >= (settings?.maxPartialPayments || 2)) {
      toast({ 
        title: 'Not Allowed', 
        description: `Maximum ${settings?.maxPartialPayments || 2} partial payments already used`, 
        variant: 'destructive' 
      });
      return false;
    }

    // Validate partial amount
    const remaining = emi.totalAmount - (emi.paidAmount || 0);
    if (partialAmount <= 0 || partialAmount >= remaining) {
      toast({ 
        title: 'Invalid Amount', 
        description: 'Partial amount must be greater than 0 and less than total amount', 
        variant: 'destructive' 
      });
      return false;
    }

    // Validate date
    if (!newDueDate) {
      toast({ 
        title: 'Date Required', 
        description: 'Please select a new due date for the remaining amount', 
        variant: 'destructive' 
      });
      return false;
    }

    const selectedDate = new Date(newDueDate);
    const dueDate = new Date(emi.dueDate);
    if (selectedDate <= dueDate) {
      toast({ 
        title: 'Invalid Date', 
        description: 'New due date must be after the original due date', 
        variant: 'destructive' 
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!emi) return;

    // Validation
    if (!utrNumber) {
      toast({ title: 'UTR Required', description: 'Please enter UTR/Reference number', variant: 'destructive' });
      return;
    }

    if (!proofFile) {
      toast({ title: 'Proof Required', description: 'Please upload payment proof/screenshot', variant: 'destructive' });
      return;
    }

    if (selectedOption === 'PARTIAL' && !validatePartialPayment()) {
      return;
    }

    setSubmitting(true);
    try {
      // First upload the proof file
      const formData = new FormData();
      formData.append('file', proofFile);
      formData.append('type', 'payment-proof');
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const uploadData = await uploadResponse.json();
      const proofUrl = uploadData.url || '';

      // Create payment request
      const requestBody: any = {
        loanApplicationId: loanId,
        emiScheduleId: emi.id,
        customerId,
        paymentType: selectedOption === 'FULL' ? 'FULL_EMI' : selectedOption,
        requestedAmount: selectedOption === 'PARTIAL' ? partialAmount : 
                        selectedOption === 'INTEREST_ONLY' ? emi.interestAmount : 
                        emi.totalAmount,
        paymentMethod,
        utrNumber,
        proofUrl,
        proofFileName: proofFile.name
      };

      if (selectedOption === 'PARTIAL') {
        requestBody.partialAmount = partialAmount;
        requestBody.remainingAmount = getRemainingAmount();
        requestBody.newDueDate = newDueDate;
      }

      const response = await fetch('/api/payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.success) {
        toast({ 
          title: 'Payment Request Submitted', 
          description: 'Your payment is pending verification. You will be notified once approved.' 
        });
        onPaymentSubmitted();
        onOpenChange(false);
      } else {
        toast({ 
          title: 'Error', 
          description: data.error || 'Failed to submit payment request', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to submit payment request', 
        variant: 'destructive' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!emi) return null;

  const remainingEMIAmount = emi.totalAmount - (emi.paidAmount || 0);
  const isFirstPartial = emi.partialPaymentCount === 0;
  const isSecondPartial = emi.partialPaymentCount === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-white">
              <CreditCard className="h-6 w-6" /> Pay EMI
            </DialogTitle>
            <DialogDescription className="text-emerald-100">
              EMI #{emi.installmentNumber} • Due: {formatDate(emi.dueDate)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(95vh-120px)]">
          <div className="p-6">
            {/* EMI Summary */}
            <Card className="mb-6 border-emerald-200 bg-emerald-50">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600">Total EMI</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(emi.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Already Paid</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(emi.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Remaining</p>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency(remainingEMIAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="text-center py-8">Loading payment options...</div>
            ) : (
              <>
                {step === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg mb-4">Select Payment Option</h3>
                    
                    {/* Full Payment Option */}
                    {settings?.enableFullPayment && (
                      <Card 
                        className={`cursor-pointer transition-all ${selectedOption === 'FULL' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200 hover:border-emerald-300'}`}
                        onClick={() => setSelectedOption('FULL')}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedOption === 'FULL' ? 'bg-emerald-500 text-white' : 'bg-gray-100'}`}>
                              <Wallet className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold">Full Payment</h4>
                                {selectedOption === 'FULL' && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">Pay the complete EMI amount in one go</p>
                              <p className="text-lg font-bold text-emerald-600 mt-2">{formatCurrency(remainingEMIAmount)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Partial Payment Option */}
                    {settings?.enablePartialPayment && emi.partialPaymentCount < (settings.maxPartialPayments || 2) && (
                      <Card 
                        className={`cursor-pointer transition-all ${selectedOption === 'PARTIAL' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 hover:border-orange-300'}`}
                        onClick={() => setSelectedOption('PARTIAL')}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedOption === 'PARTIAL' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}>
                              <Banknote className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">Partial Payment</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {emi.partialPaymentCount + 1} of {settings?.maxPartialPayments || 2}
                                  </Badge>
                                </div>
                                {selectedOption === 'PARTIAL' && <CheckCircle className="h-5 w-5 text-orange-500" />}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">Pay part now, rest later with new due date</p>
                              
                              {isSecondPartial && (
                                <Alert className="mt-2 bg-yellow-50 border-yellow-200">
                                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                                  <AlertDescription className="text-yellow-700 text-xs">
                                    This is your last partial payment. Remaining amount must be paid in full.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Interest Only Option */}
                    {settings?.enableInterestOnly && !emi.isInterestOnly && (
                      <Card 
                        className={`cursor-pointer transition-all ${selectedOption === 'INTEREST_ONLY' ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200 hover:border-purple-300'}`}
                        onClick={() => setSelectedOption('INTEREST_ONLY')}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedOption === 'INTEREST_ONLY' ? 'bg-purple-500 text-white' : 'bg-gray-100'}`}>
                              <Percent className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold">Interest Only</h4>
                                {selectedOption === 'INTEREST_ONLY' && <CheckCircle className="h-5 w-5 text-purple-500" />}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">Pay only interest now. Principal + new interest added as new EMI</p>
                              <p className="text-lg font-bold text-purple-600 mt-2">{formatCurrency(emi.interestAmount)}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                New EMI with ₹{emi.principalAmount.toFixed(0)} principal + new interest will be created
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedOption === 'PARTIAL' && (
                      <Card className="border-orange-200 bg-orange-50 mt-4">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Partial Payment Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="partialAmount">Amount to Pay Now *</Label>
                              <div className="relative mt-1">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  id="partialAmount"
                                  type="number"
                                  value={partialAmount}
                                  onChange={(e) => setPartialAmount(Number(e.target.value))}
                                  className="pl-8"
                                  min={1}
                                  max={remainingEMIAmount - 1}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Remaining: {formatCurrency(getRemainingAmount())}</p>
                            </div>
                            <div>
                              <Label htmlFor="newDueDate">New Due Date for Remaining *</Label>
                              <Input
                                id="newDueDate"
                                type="date"
                                value={newDueDate}
                                onChange={(e) => setNewDueDate(e.target.value)}
                                min={getMinPartialDate()}
                                max={getMaxPartialDate()}
                                className="mt-1"
                              />
                              <p className="text-xs text-gray-500 mt-1">Must be after {formatDate(emi.dueDate)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="flex justify-end gap-3 mt-6">
                      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                      <Button 
                        className="bg-emerald-500 hover:bg-emerald-600"
                        onClick={() => setStep(2)}
                      >
                        Continue <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                        ← Back
                      </Button>
                      <h3 className="font-semibold text-lg">Payment Details</h3>
                    </div>

                    {/* Payment Summary */}
                    <Card className="border-emerald-200 bg-emerald-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">
                              {selectedOption === 'FULL' && 'Full Payment'}
                              {selectedOption === 'PARTIAL' && `Partial Payment (${emi.partialPaymentCount + 1}/${settings?.maxPartialPayments || 2})`}
                              {selectedOption === 'INTEREST_ONLY' && 'Interest Only Payment'}
                            </p>
                            <p className="text-2xl font-bold text-emerald-600">
                              {formatCurrency(
                                selectedOption === 'FULL' ? remainingEMIAmount :
                                selectedOption === 'PARTIAL' ? partialAmount :
                                emi.interestAmount
                              )}
                            </p>
                          </div>
                          {selectedOption === 'PARTIAL' && newDueDate && (
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Remaining due on</p>
                              <p className="font-medium">{formatDate(newDueDate)}</p>
                            </div>
                          )}
                          {selectedOption === 'INTEREST_ONLY' && (
                            <div className="text-right">
                              <p className="text-xs text-gray-500">New EMI will be created</p>
                              <p className="font-medium text-purple-600">₹{emi.principalAmount.toFixed(0)} + Interest</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Payment Methods */}
                    <Tabs defaultValue="UPI" onValueChange={(v) => setPaymentMethod(v as any)}>
                      <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="UPI" className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" /> UPI
                        </TabsTrigger>
                        <TabsTrigger value="BANK_TRANSFER" className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" /> Bank
                        </TabsTrigger>
                        <TabsTrigger value="CASH" className="flex items-center gap-2">
                          <Banknote className="h-4 w-4" /> Cash
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="UPI" className="mt-4 space-y-4">
                        <Card>
                          <CardContent className="p-6 text-center">
                            {companyQrCodeUrl ? (
                              <img src={companyQrCodeUrl} alt="QR Code" className="w-48 h-48 mx-auto border rounded-lg" />
                            ) : (
                              <div className="w-48 h-48 mx-auto border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                                <QrCode className="h-20 w-20 text-gray-300" />
                              </div>
                            )}
                            <p className="mt-4 text-sm text-gray-600">Scan QR code to pay</p>
                            <div className="mt-4 flex items-center justify-center gap-2">
                              <div className="bg-gray-100 px-4 py-2 rounded-lg font-mono font-medium">
                                {companyUpiId}
                              </div>
                              <Button variant="outline" size="sm" onClick={() => copyToClipboard(companyUpiId)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="BANK_TRANSFER" className="mt-4 space-y-4">
                        <Card>
                          <CardContent className="p-6">
                            <h4 className="font-medium mb-4">Bank Account Details</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Account Name</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Money Mitra Finance</span>
                                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard('Money Mitra Finance')}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Account Number</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">1234567890123</span>
                                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard('1234567890123')}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">IFSC Code</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">SBIN0001234</span>
                                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard('SBIN0001234')}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600">Bank Name</span>
                                <span className="font-medium">State Bank of India</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="CASH" className="mt-4">
                        <Card>
                          <CardContent className="p-6 text-center">
                            <Banknote className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                            <p className="font-medium">Cash Payment at Branch</p>
                            <p className="text-sm text-gray-500 mt-2">
                              Visit your nearest branch to make cash payment. Collect receipt after payment.
                            </p>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>

                    {/* Payment Proof Upload */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Shield className="h-4 w-4 text-emerald-500" />
                          Payment Verification
                        </CardTitle>
                        <CardDescription>Upload proof of payment for verification</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="utrNumber">UTR / Reference Number *</Label>
                          <Input
                            id="utrNumber"
                            value={utrNumber}
                            onChange={(e) => setUtrNumber(e.target.value)}
                            placeholder="Enter 12-digit UTR number"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="proofUpload">Payment Screenshot / Proof *</Label>
                          <div className="mt-1">
                            <label htmlFor="proofUpload" className="cursor-pointer">
                              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${proofPreview ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-500'}`}>
                                {proofPreview ? (
                                  <div className="relative">
                                    <img src={proofPreview} alt="Proof preview" className="max-h-40 mx-auto rounded-lg" />
                                    <p className="mt-2 text-sm text-emerald-600">{proofFile?.name}</p>
                                  </div>
                                ) : (
                                  <>
                                    <ImageIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-600">Click to upload payment screenshot</p>
                                    <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                                  </>
                                )}
                              </div>
                            </label>
                            <input
                              id="proofUpload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Your payment will be verified by our team. EMI will be marked as paid after verification.
                      </AlertDescription>
                    </Alert>

                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                      <Button 
                        className="bg-emerald-500 hover:bg-emerald-600"
                        onClick={handleSubmit}
                        disabled={submitting || !utrNumber || !proofFile}
                      >
                        {submitting ? 'Submitting...' : 'Submit Payment Request'}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
