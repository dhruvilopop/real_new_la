'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, CreditCard, Wallet, Percent, CheckCircle, X, AlertCircle, 
  Info, QrCode, Building2, ChevronRight, Loader2, Shield, ShieldOff, Clock
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/utils/helpers';

import { useAuth } from '@/contexts/AuthContext';

interface EMISettings {
  id: string;
  emiScheduleId: string;
  enableFullPayment: boolean;
  enablePartialPayment: boolean;
  enableInterestOnly: boolean;
  useDefaultCompanyPage: boolean;
  secondaryPaymentPageId: string | null;
  lastModifiedAt: string | null;
  lastModifiedBy?: {
    id: string;
    name: string;
  } | null;
}

interface SecondaryPaymentPage {
  id: string;
  name: string;
  description: string | null;
  upiId: string | null;
  qrCodeUrl: string | null;
  bankName: string | null;
  accountNumber: string | null;
}

interface EMISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emi: {
    id: string;
    installmentNumber: number;
    totalAmount: number;
    dueDate: string;
    paymentStatus: string;
    paidAmount?: number;
    partialPaymentCount?: number;
    loanApplicationId?: string;
  } | null;
  loanId: string;
  companyId?: string;
  onSettingsSaved?: () => void;
}

export default function EMISettingsDialog({ 
  open, 
  onOpenChange, 
  emi, 
  loanId, 
  companyId,
  onSettingsSaved 
}: EMISettingsDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<EMISettings | null>(null);
  const [secondaryPages, setSecondaryPages] = useState<SecondaryPaymentPage[]>([]);
  
  const [enableFull, setEnableFull] = useState(true);
  const [enablePartial, setEnablePartial] = useState(true);
  const [enableInterestOnly, setEnableInterestOnly] = useState(true);
  const [useDefaultPage, setUseDefaultPage] = useState(true);
  const [selectedSecondaryPageId, setSelectedSecondaryPageId] = useState<string | null>(null);

  // Fetch EMI settings
  const fetchSettings = async () => {
    if (!emi) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/emi-payment-settings?emiScheduleId=${emi.id}`);
      const data = await response.json();
      
      if (data.success && data.settings) {
        setSettings(data.settings);
        setEnableFull(data.settings.enableFullPayment);
        setEnablePartial(data.settings.enablePartialPayment);
        setEnableInterestOnly(data.settings.enableInterestOnly);
        setUseDefaultPage(data.settings.useDefaultCompanyPage);
        setSelectedSecondaryPageId(data.settings.secondaryPaymentPageId);
      }
    } catch (error) {
      console.error('Error fetching EMI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch secondary payment pages
  const fetchSecondaryPages = async () => {
    if (!companyId) return;
    try {
      const response = await fetch(`/api/emi-payment-settings?action=secondary-pages&companyId=${companyId}`);
      const data = await response.json();
      
      if (data.success && data.pages) {
        setSecondaryPages(data.pages);
      }
    } catch (error) {
      console.error('Error fetching secondary payment pages:', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSettings();
      if (companyId) {
        fetchSecondaryPages();
      }
    }
  }, [open, emi?.id, companyId]);

  const handleSave = async () => {
    if (!emi || !loanId) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/emi-payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emiScheduleId: emi.id,
          loanApplicationId: loanId,
          enableFullPayment: enableFull,
          enablePartialPayment: enablePartial,
          enableInterestOnly: enableInterestOnly,
          useDefaultCompanyPage: useDefaultPage,
          secondaryPaymentPageId: selectedSecondaryPageId,
          modifiedById: user?.id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({ 
          title: 'Settings Saved', 
          description: 'Payment options updated successfully for EMI #' + emi.installmentNumber 
        });
        onOpenChange(false);
        onSettingsSaved?.();
      } else {
        toast({ 
          title: 'Error', 
          description: data.error || 'Failed to save settings', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error saving EMI settings:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to save settings', 
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600" />
            EMI #{emi?.installmentNumber} Payment Options
          </DialogTitle>
          <DialogDescription>
            Configure which payment types are available for this EMI
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* EMI Info */}
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">EMI Amount</p>
                <p className="text-lg font-bold">{formatCurrency(emi?.totalAmount || 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium">{emi?.dueDate ? formatDate(emi.dueDate) : 'N/A'}</p>
              </div>
            </div>

            <Separator />

            {/* Payment Options Toggles */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Payment Options</h4>
              <p className="text-xs text-gray-500 mb-3">Toggle which payment types customers can use for this EMI</p>
              
              {/* Full Payment Toggle */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    enableFull ? 'bg-emerald-100' : 'bg-gray-100'
                  }`}>
                    {enableFull ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <X className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Full Payment</p>
                    <p className="text-xs text-gray-500">Pay complete EMI amount</p>
                  </div>
                </div>
                <Switch
                  checked={enableFull}
                  onCheckedChange={setEnableFull}
                />
              </div>

              {/* Partial Payment Toggle */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    enablePartial ? 'bg-amber-100' : 'bg-gray-100'
                  }`}>
                    {enablePartial ? (
                      <CreditCard className="h-5 w-5 text-amber-600" />
                    ) : (
                      <X className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Partial Payment</p>
                    <p className="text-xs text-gray-500">Pay in parts (max 2 installments)</p>
                  </div>
                </div>
                <Switch
                  checked={enablePartial}
                  onCheckedChange={setEnablePartial}
                />
              </div>

              {/* Interest Only Toggle */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    enableInterestOnly ? 'bg-purple-100' : 'bg-gray-100'
                  }`}>
                    {enableInterestOnly ? (
                      <Percent className="h-5 w-5 text-purple-600" />
                    ) : (
                      <X className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Interest Only</p>
                    <p className="text-xs text-gray-500">Pay only interest, defer principal</p>
                  </div>
                </div>
                <Switch
                  checked={enableInterestOnly}
                  onCheckedChange={setEnableInterestOnly}
                />
              </div>
            </div>

            <Separator />

            {/* Payment Page Selection */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Payment Page</h4>
              <p className="text-xs text-gray-500 mb-3">Choose which payment details to show to customer</p>
              
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="radio"
                  id="default-page"
                  name="paymentPage"
                  checked={useDefaultPage}
                  onChange={() => setUseDefaultPage(true)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="default-page" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Company Default Bank Account</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Use the company's default bank account for payments
                  </p>
                </label>
              </div>

              {/* Secondary Payment Pages */}
              {secondaryPages.length > 0 && (
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-gray-400">Or use a secondary payment page:</p>
                  {secondaryPages.map((page) => (
                    <div 
                      key={page.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                        !useDefaultPage && selectedSecondaryPageId === page.id 
                          ? 'bg-indigo-50 border-indigo-200' 
                          : 'bg-white border-gray-200'
                      }`}
                      onClick={() => {
                        setUseDefaultPage(false);
                        setSelectedSecondaryPageId(page.id);
                      }}
                    >
                      <input
                        type="radio"
                        checked={!useDefaultPage && selectedSecondaryPageId === page.id}
                        onChange={() => {
                          setUseDefaultPage(false);
                          setSelectedSecondaryPageId(page.id);
                        }}
                        className="h-4 w-4 text-indigo-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-indigo-600" />
                          <span className="font-medium">{page.name}</span>
                        </div>
                        {page.description && (
                          <p className="text-xs text-gray-500 mt-1">{page.description}</p>
                        )}
                        {page.upiId && (
                          <p className="text-xs text-indigo-600 font-mono">UPI: {page.upiId}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No secondary pages available */}
              {secondaryPages.length === 0 && !useDefaultPage && (
                <Alert className="bg-amber-50 border-amber-200">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 text-xs">
                    No secondary payment pages available. The company default bank account will be used.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Last Modified Info */}
            {settings?.lastModifiedAt && settings?.lastModifiedBy && (
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Last modified: {formatDate(settings.lastModifiedAt)}</span>
                </div>
                {settings.lastModifiedBy?.name && (
                  <span>by {settings.lastModifiedBy.name}</span>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              'Save Settings'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
