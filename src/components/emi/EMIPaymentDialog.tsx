'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  IndianRupee, Banknote, CreditCard, Receipt, AlertCircle,
  Calculator, TrendingUp, Clock, CalendarIcon, Info, AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';

interface EMIItem {
  id: string;
  installmentNumber: number;
  totalAmount: number;
  principalAmount: number;
  interestAmount: number;
  dueDate: string;
  paymentStatus: string;
  paidAmount: number;
  paidPrincipal: number;
  paidInterest: number;
  outstandingPrincipal: number;
  isPartialPayment?: boolean;
  isInterestOnly?: boolean;
  nextPaymentDate?: string;
  offlineLoan?: {
    id: string;
    loanNumber: string;
    customerName: string;
    customerPhone: string;
    loanAmount: number;
    interestRate: number;
    tenure: number;
    company?: { name: string };
  };
  loanApplication?: {
    id: string;
    applicationNo: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

interface EMIPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emi: EMIItem | null;
  type: 'online' | 'offline';
  userId: string;
  userRole: string;
  onPaymentComplete: () => void;
}

type PaymentTypeOption = 'FULL_EMI' | 'PARTIAL_PAYMENT' | 'INTEREST_ONLY';

export default function EMIPaymentDialog({
  open,
  onOpenChange,
  emi,
  type,
  userId,
  userRole,
  onPaymentComplete
}: EMIPaymentDialogProps) {
  const [paymentType, setPaymentType] = useState<PaymentTypeOption>('FULL_EMI');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [partialAmount, setPartialAmount] = useState('');
  const [nextPaymentDate, setNextPaymentDate] = useState<Date | undefined>(undefined);
  const [paymentReference, setPaymentReference] = useState('');
  const [processing, setProcessing] = useState(false);
  const [interestOnlyConfirmed, setInterestOnlyConfirmed] = useState(false);

  if (!emi) return null;

  const customerName = type === 'offline'
    ? emi.offlineLoan?.customerName
    : `${emi.loanApplication?.firstName || ''} ${emi.loanApplication?.lastName || ''}`.trim();

  const loanNumber = type === 'offline'
    ? emi.offlineLoan?.loanNumber
    : emi.loanApplication?.applicationNo;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate amounts based on payment type
  const getPaymentDetails = () => {
    const remainingAmount = emi.totalAmount - (emi.paidAmount || 0);
    const remainingPrincipal = emi.principalAmount - (emi.paidPrincipal || 0);
    const remainingInterest = emi.interestAmount - (emi.paidInterest || 0);
    
    switch (paymentType) {
      case 'FULL_EMI':
        return {
          amount: remainingAmount,
          principal: remainingPrincipal,
          interest: remainingInterest,
          description: 'Full EMI Payment',
          remainingAfter: 0
        };
      case 'PARTIAL_PAYMENT':
        const partialValue = parseFloat(partialAmount) || 0;
        const ratio = remainingAmount > 0 ? partialValue / remainingAmount : 0;
        return {
          amount: partialValue,
          principal: remainingPrincipal * ratio,
          interest: remainingInterest * ratio,
          description: `Partial Payment (${(ratio * 100).toFixed(1)}% of remaining)`,
          remainingAfter: remainingAmount - partialValue
        };
      case 'INTEREST_ONLY':
        return {
          amount: remainingInterest,
          principal: 0,
          interest: remainingInterest,
          description: 'Interest Only Payment',
          remainingAfter: remainingPrincipal // Principal will be deferred
        };
    }
  };

  const details = getPaymentDetails();
  const remainingAmount = emi.totalAmount - (emi.paidAmount || 0);
  const remainingPrincipal = emi.principalAmount - (emi.paidPrincipal || 0);
  const remainingInterest = emi.interestAmount - (emi.paidInterest || 0);

  // Calculate future EMI adjustment for partial payments
  const calculateFutureAdjustment = () => {
    if (paymentType !== 'PARTIAL_PAYMENT' || type !== 'offline') return null;

    const partialValue = parseFloat(partialAmount) || 0;
    const outstandingPrincipal = emi.outstandingPrincipal;
    const interestRate = emi.offlineLoan?.interestRate || 12;
    const remainingTenure = (emi.offlineLoan?.tenure || 12) - emi.installmentNumber;

    if (remainingTenure <= 0) return null;

    // Calculate how much principal was actually paid
    const ratio = remainingAmount > 0 ? partialValue / remainingAmount : 0;
    const principalPaid = remainingPrincipal * ratio;

    // Calculate new outstanding principal
    const newOutstandingPrincipal = outstandingPrincipal - principalPaid;

    // Calculate new EMI for remaining tenure
    const monthlyRate = interestRate / 100 / 12;
    const newEmi = newOutstandingPrincipal * monthlyRate * Math.pow(1 + monthlyRate, remainingTenure) 
                   / (Math.pow(1 + monthlyRate, remainingTenure) - 1);

    return {
      principalPaid,
      newOutstandingPrincipal,
      newEmi: Math.round(newEmi),
      remainingTenure
    };
  };

  const adjustment = calculateFutureAdjustment();

  const handlePayment = async () => {
    // Validation for partial payment
    if (paymentType === 'PARTIAL_PAYMENT') {
      if (!partialAmount || parseFloat(partialAmount) <= 0) {
        toast({ title: 'Error', description: 'Please enter a valid partial amount', variant: 'destructive' });
        return;
      }
      if (parseFloat(partialAmount) > remainingAmount) {
        toast({ title: 'Error', description: 'Partial amount cannot exceed remaining amount', variant: 'destructive' });
        return;
      }
      if (!nextPaymentDate) {
        toast({ title: 'Error', description: 'Please select when you will pay the remaining amount', variant: 'destructive' });
        return;
      }
    }

    // Validation for interest only payment
    if (paymentType === 'INTEREST_ONLY' && !interestOnlyConfirmed) {
      toast({ title: 'Error', description: 'Please confirm that you understand the principal will be deferred', variant: 'destructive' });
      return;
    }

    try {
      setProcessing(true);

      const formData = new FormData();
      formData.append('emiId', emi.id);
      formData.append('loanId', type === 'offline' ? emi.offlineLoan?.id || '' : emi.loanApplication?.id || '');
      formData.append('amount', details.amount.toString());
      formData.append('paymentMode', paymentMode);
      formData.append('paidBy', userId);
      formData.append('paymentType', paymentType);
      formData.append('remarks', paymentType === 'PARTIAL_PAYMENT' ? `Partial payment - remaining due: ${formatCurrency(details.remainingAfter)}` : '');

      if (paymentType === 'PARTIAL_PAYMENT') {
        formData.append('partialAmount', partialAmount);
        formData.append('nextPaymentDate', nextPaymentDate?.toISOString() || '');
      }

      const res = await fetch('/api/emi/pay', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast({
            title: 'Payment Successful',
            description: data.message || `${formatCurrency(details.amount)} collected successfully.`
          });
          onPaymentComplete();
          onOpenChange(false);
          // Reset form
          setPaymentType('FULL_EMI');
          setPartialAmount('');
          setNextPaymentDate(undefined);
          setPaymentReference('');
          setInterestOnlyConfirmed(false);
        }
      } else {
        const error = await res.json();
        toast({ title: 'Error', description: error.error || 'Failed to process payment', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({ title: 'Error', description: 'Failed to process payment', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  // Get minimum date for next payment date (should be after current due date)
  const minNextPaymentDate = addDays(new Date(emi.dueDate), 1);
  const maxNextPaymentDate = addDays(new Date(), 60); // Max 60 days from now

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-emerald-500" />
            Collect EMI Payment
          </DialogTitle>
          <DialogDescription>
            {type === 'offline' ? 'Offline Loan' : 'Online Loan'} - {loanNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* EMI Details */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium">{customerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">EMI Number</span>
              <span className="font-medium">#{emi.installmentNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Due Date</span>
              <span className="font-medium">{formatDate(emi.dueDate)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Total Amount</span>
              <span className="font-bold text-lg">{formatCurrency(emi.totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Principal</span>
              <span>{formatCurrency(emi.principalAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Interest</span>
              <span>{formatCurrency(emi.interestAmount)}</span>
            </div>
            {emi.paidAmount > 0 && (
              <>
                <div className="flex justify-between items-center text-sm text-green-600">
                  <span>Already Paid</span>
                  <span>{formatCurrency(emi.paidAmount)}</span>
                </div>
                <div className="flex justify-between items-center font-medium pt-2 border-t">
                  <span className="text-gray-600">Remaining</span>
                  <span className="text-orange-600">{formatCurrency(remainingAmount)}</span>
                </div>
              </>
            )}
          </div>

          {/* Payment Type Selection */}
          <div className="space-y-2">
            <Label className="font-medium">Payment Type</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={paymentType === 'FULL_EMI' ? 'default' : 'outline'}
                className={`h-auto py-3 flex-col ${paymentType === 'FULL_EMI' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                onClick={() => setPaymentType('FULL_EMI')}
              >
                <IndianRupee className="h-4 w-4 mb-1" />
                <span className="text-xs">Full EMI</span>
              </Button>
              <Button
                type="button"
                variant={paymentType === 'PARTIAL_PAYMENT' ? 'default' : 'outline'}
                className={`h-auto py-3 flex-col ${paymentType === 'PARTIAL_PAYMENT' ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                onClick={() => setPaymentType('PARTIAL_PAYMENT')}
              >
                <Calculator className="h-4 w-4 mb-1" />
                <span className="text-xs">Partial</span>
              </Button>
              <Button
                type="button"
                variant={paymentType === 'INTEREST_ONLY' ? 'default' : 'outline'}
                className={`h-auto py-3 flex-col ${paymentType === 'INTEREST_ONLY' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                onClick={() => setPaymentType('INTEREST_ONLY')}
              >
                <TrendingUp className="h-4 w-4 mb-1" />
                <span className="text-xs">Interest Only</span>
              </Button>
            </div>
          </div>

          {/* Full EMI Info */}
          {paymentType === 'FULL_EMI' && (
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
                <div className="text-sm text-emerald-700">
                  <p className="font-medium">Full EMI Payment</p>
                  <p className="mt-1">Pay the complete remaining amount of {formatCurrency(remainingAmount)}</p>
                  <div className="mt-2 text-xs text-emerald-600">
                    <p>Principal: {formatCurrency(remainingPrincipal)}</p>
                    <p>Interest: {formatCurrency(remainingInterest)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Partial Payment Section */}
          {paymentType === 'PARTIAL_PAYMENT' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Partial Amount (Max: {formatCurrency(remainingAmount)})</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="number"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="Enter amount..."
                    max={remainingAmount}
                    className="pl-8"
                  />
                </div>
                {partialAmount && parseFloat(partialAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Remaining after payment:</span>
                    <span className="font-medium text-orange-600">
                      {formatCurrency(remainingAmount - parseFloat(partialAmount))}
                    </span>
                  </div>
                )}
              </div>

              {/* Date Picker for Next Payment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  When will you pay the remaining amount?
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${!nextPaymentDate && 'text-muted-foreground'}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {nextPaymentDate ? format(nextPaymentDate, 'PPP') : 'Select a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={nextPaymentDate}
                      onSelect={setNextPaymentDate}
                      disabled={(date) => date < minNextPaymentDate || date > maxNextPaymentDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {nextPaymentDate && (
                  <p className="text-xs text-gray-500">
                    Subsequent EMI due dates will be shifted accordingly
                  </p>
                )}
              </div>

              {adjustment && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm border border-blue-200">
                  <p className="font-medium text-blue-700 mb-2">Future EMI Adjustment:</p>
                  <div className="space-y-1 text-blue-600">
                    <p>Principal paid now: {formatCurrency(adjustment.principalPaid)}</p>
                    <p>New outstanding: {formatCurrency(adjustment.newOutstandingPrincipal)}</p>
                    <p className="font-medium">Adjusted EMI: {formatCurrency(adjustment.newEmi)}/month</p>
                    <p className="text-xs text-blue-500">Remaining tenure: {adjustment.remainingTenure} months</p>
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <p className="font-medium">Important Note</p>
                    <p>The remaining amount will be rescheduled to the selected date. All subsequent EMI due dates will be shifted.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interest Only Section */}
          {paymentType === 'INTEREST_ONLY' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Interest Only Payment</p>
                    <p className="mt-1">You will pay only the interest component:</p>
                    <p className="text-xl font-bold mt-2">{formatCurrency(remainingInterest)}</p>
                    <div className="mt-3 p-2 bg-blue-100 rounded text-xs">
                      <p className="font-medium">Principal of {formatCurrency(remainingPrincipal)} will be:</p>
                      <ul className="mt-1 list-disc list-inside">
                        <li>Added to next month's EMI</li>
                        <li>Interest recalculated on outstanding balance</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <p className="font-medium">Warning</p>
                    <p>The principal amount will increase your next EMI. This option should only be used for temporary cash flow issues.</p>
                  </div>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="flex items-start space-x-2 p-3 border rounded-lg bg-gray-50">
                <Checkbox
                  id="interest-only-confirm"
                  checked={interestOnlyConfirmed}
                  onCheckedChange={(checked) => setInterestOnlyConfirmed(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="interest-only-confirm"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I understand and confirm
                  </label>
                  <p className="text-xs text-gray-500">
                    The principal amount ({formatCurrency(remainingPrincipal)}) will be added to next month's EMI
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Mode Selection */}
          <div className="space-y-2">
            <Label className="font-medium">Payment Mode</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={paymentMode === 'CASH' ? 'default' : 'outline'}
                className={paymentMode === 'CASH' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                onClick={() => setPaymentMode('CASH')}
              >
                <Banknote className="h-4 w-4 mr-1" /> Cash
              </Button>
              <Button
                type="button"
                variant={paymentMode === 'ONLINE' ? 'default' : 'outline'}
                className={paymentMode === 'ONLINE' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                onClick={() => setPaymentMode('ONLINE')}
              >
                <CreditCard className="h-4 w-4 mr-1" /> Online
              </Button>
              <Button
                type="button"
                variant={paymentMode === 'CHEQUE' ? 'default' : 'outline'}
                className={paymentMode === 'CHEQUE' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                onClick={() => setPaymentMode('CHEQUE')}
              >
                <Receipt className="h-4 w-4 mr-1" /> Cheque
              </Button>
            </div>
          </div>

          {/* Payment Reference */}
          {(paymentMode === 'ONLINE' || paymentMode === 'CHEQUE') && (
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={paymentMode === 'CHEQUE' ? 'Cheque number' : 'Transaction ID'}
              />
            </div>
          )}

          {/* Payment Summary */}
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-sm text-emerald-700 font-medium mb-2">{details.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-emerald-600">Amount to Collect</span>
              <span className="text-xl font-bold text-emerald-700">{formatCurrency(details.amount)}</span>
            </div>
            {paymentType === 'PARTIAL_PAYMENT' && details.remainingAfter > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-200">
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600">Remaining Balance:</span>
                  <span className="font-medium text-orange-600">{formatCurrency(details.remainingAfter)}</span>
                </div>
                {nextPaymentDate && (
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-500">Due by:</span>
                    <span>{format(nextPaymentDate, 'dd MMM yyyy')}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2 text-sm text-emerald-600">
              <Clock className="h-4 w-4" />
              <span>Your credit will increase by {formatCurrency(details.amount)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              onClick={handlePayment}
              disabled={
                processing || 
                (paymentType === 'PARTIAL_PAYMENT' && (!partialAmount || !nextPaymentDate)) ||
                (paymentType === 'INTEREST_ONLY' && !interestOnlyConfirmed)
              }
            >
              {processing ? 'Processing...' : `Collect ${formatCurrency(details.amount)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
