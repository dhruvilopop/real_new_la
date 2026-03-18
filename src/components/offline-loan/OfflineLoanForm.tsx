'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User, Phone, IndianRupee, Percent, Calendar,
  FileText, Plus, Save, X, ChevronDown, ChevronUp, Building2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Company {
  id: string;
  name: string;
  code: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  currentBalance: number;
  isDefault: boolean;
}

interface OfflineLoanFormProps {
  createdById: string;
  createdByRole: string;
  companyId?: string;
  onLoanCreated?: () => void;
}

export default function OfflineLoanForm({ createdById, createdByRole, onLoanCreated }: OfflineLoanFormProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAadhaar: '',
    customerPan: '',
    customerAddress: '',
    customerCity: '',
    customerState: '',
    customerPincode: '',
    customerDOB: '',
    customerOccupation: '',
    customerMonthlyIncome: '',
    reference1Name: '',
    reference1Phone: '',
    reference1Relation: '',
    reference2Name: '',
    reference2Phone: '',
    reference2Relation: '',
    loanType: 'PERSONAL',
    loanAmount: '',
    interestRate: '12',
    tenure: '12',
    emiAmount: '',
    processingFee: '0',
    disbursementDate: new Date().toISOString().slice(0, 10),
    disbursementMode: 'CASH',
    disbursementRef: '',
    startDate: new Date().toISOString().slice(0, 10),
    notes: '',
    internalNotes: '',
    // Company selection - REQUIRED for all roles
    companyId: '',
    // Bank account for disbursement
    bankAccountId: ''
  });

  // Fetch companies and bank accounts on mount
  useEffect(() => {
    if (open) {
      fetchCompanies();
      fetchBankAccounts();
    }
  }, [open]);

  const fetchCompanies = async () => {
    try {
      setLoadingCompanies(true);
      const res = await fetch('/api/company?isActive=true');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
        // Auto-select first company if only one exists
        if (data.companies?.length === 1) {
          setFormData(prev => ({ ...prev, companyId: data.companies[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await fetch('/api/accounting/bank?action=list');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBankAccounts(data.data || []);
          // Auto-select default bank
          const defaultBank = data.data?.find((b: BankAccount) => b.isDefault);
          if (defaultBank) {
            setFormData(prev => ({ ...prev, bankAccountId: defaultBank.id }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch bank accounts:', error);
    }
  };

  const calculateEmi = () => {
    const P = parseFloat(formData.loanAmount) || 0;
    const r = (parseFloat(formData.interestRate) || 0) / 100 / 12;
    const n = parseInt(formData.tenure) || 1;

    if (P > 0 && r > 0 && n > 0) {
      const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      return Math.round(emi);
    }
    return 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (['loanAmount', 'interestRate', 'tenure'].includes(field)) {
      setTimeout(() => {
        const emi = calculateEmi();
        setFormData(prev => ({ ...prev, emiAmount: emi.toString() }));
      }, 100);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields including company
    if (!formData.customerName || !formData.customerPhone || !formData.loanAmount || 
        !formData.interestRate || !formData.tenure || !formData.disbursementDate || 
        !formData.startDate || !formData.companyId) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all required fields including Company',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmitting(true);
      
      const res = await fetch('/api/offline-loan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createdById,
          createdByRole,
          ...formData,
          loanAmount: parseFloat(formData.loanAmount),
          interestRate: parseFloat(formData.interestRate),
          tenure: parseInt(formData.tenure),
          emiAmount: parseFloat(formData.emiAmount) || calculateEmi(),
          processingFee: parseFloat(formData.processingFee) || 0,
          customerMonthlyIncome: formData.customerMonthlyIncome ? parseFloat(formData.customerMonthlyIncome) : null,
          customerDOB: formData.customerDOB || null,
          bankAccountId: formData.bankAccountId || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast({
            title: 'Loan Created',
            description: `Offline loan ${data.loan.loanNumber} created successfully`
          });
          setOpen(false);
          resetForm();
          onLoanCreated?.();
        }
      } else {
        const error = await res.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create loan',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Loan creation error:', error);
      toast({
        title: 'Error',
        description: 'Failed to create loan',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '', customerPhone: '', customerEmail: '', customerAadhaar: '', customerPan: '',
      customerAddress: '', customerCity: '', customerState: '', customerPincode: '', customerOccupation: '',
      customerMonthlyIncome: '', customerDOB: '', reference1Name: '', reference1Phone: '', reference1Relation: '',
      reference2Name: '', reference2Phone: '', reference2Relation: '', loanType: 'PERSONAL',
      loanAmount: '', interestRate: '12', tenure: '12', emiAmount: '', processingFee: '0',
      disbursementDate: new Date().toISOString().slice(0, 10), disbursementMode: 'CASH',
      disbursementRef: '', startDate: new Date().toISOString().slice(0, 10), notes: '', internalNotes: '',
      companyId: '', bankAccountId: ''
    });
    setShowAdvanced(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500">
        <Plus className="h-4 w-4 mr-2" /> Create Offline Loan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Create Offline Loan</DialogTitle>
            <DialogDescription>Fill in the customer and loan details below</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Company Selection - REQUIRED for all roles */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="font-semibold flex items-center gap-2 text-amber-800 mb-3">
                <Building2 className="h-4 w-4" /> Select Company *
              </h3>
              <Select value={formData.companyId} onValueChange={(v) => handleInputChange('companyId', v)}>
                <SelectTrigger className={formData.companyId ? '' : 'border-red-300'}>
                  <SelectValue placeholder="Select company for this loan..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.companyId && (
                <p className="text-xs text-red-500 mt-1">Company selection is required</p>
              )}
            </div>

            {/* Customer Details */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Customer Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Customer Name *</Label><Input value={formData.customerName} onChange={(e) => handleInputChange('customerName', e.target.value)} placeholder="Full name" /></div>
                <div className="space-y-2"><Label>Phone Number *</Label><Input value={formData.customerPhone} onChange={(e) => handleInputChange('customerPhone', e.target.value)} placeholder="10-digit number" /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.customerEmail} onChange={(e) => handleInputChange('customerEmail', e.target.value)} /></div>
                <div className="space-y-2"><Label>PAN Number</Label><Input value={formData.customerPan} onChange={(e) => handleInputChange('customerPan', e.target.value.toUpperCase())} maxLength={10} /></div>
                <div className="space-y-2"><Label>Aadhaar Number</Label><Input value={formData.customerAadhaar} onChange={(e) => handleInputChange('customerAadhaar', e.target.value)} maxLength={12} /></div>
                <div className="space-y-2"><Label>Occupation</Label><Input value={formData.customerOccupation} onChange={(e) => handleInputChange('customerOccupation', e.target.value)} /></div>
                <div className="space-y-2"><Label>Monthly Income</Label><Input type="number" value={formData.customerMonthlyIncome} onChange={(e) => handleInputChange('customerMonthlyIncome', e.target.value)} /></div>
                <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={formData.customerDOB} onChange={(e) => handleInputChange('customerDOB', e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Address *</Label><Input value={formData.customerAddress} onChange={(e) => handleInputChange('customerAddress', e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>City</Label><Input value={formData.customerCity} onChange={(e) => handleInputChange('customerCity', e.target.value)} /></div>
                <div className="space-y-2"><Label>State</Label><Input value={formData.customerState} onChange={(e) => handleInputChange('customerState', e.target.value)} /></div>
                <div className="space-y-2"><Label>Pincode</Label><Input value={formData.customerPincode} onChange={(e) => handleInputChange('customerPincode', e.target.value)} maxLength={6} /></div>
              </div>
            </div>

            {/* Loan Details */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Loan Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loan Type</Label>
                  <Select value={formData.loanType} onValueChange={(v) => handleInputChange('loanType', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSONAL">Personal Loan</SelectItem>
                      <SelectItem value="BUSINESS">Business Loan</SelectItem>
                      <SelectItem value="HOME">Home Loan</SelectItem>
                      <SelectItem value="VEHICLE">Vehicle Loan</SelectItem>
                      <SelectItem value="GOLD">Gold Loan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Loan Amount *</Label><Input type="number" value={formData.loanAmount} onChange={(e) => handleInputChange('loanAmount', e.target.value)} /></div>
                <div className="space-y-2"><Label>Interest Rate (% p.a.) *</Label><Input type="number" step="0.1" value={formData.interestRate} onChange={(e) => handleInputChange('interestRate', e.target.value)} /></div>
                <div className="space-y-2"><Label>Tenure (months) *</Label><Input type="number" value={formData.tenure} onChange={(e) => handleInputChange('tenure', e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>EMI Amount</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={formData.emiAmount || calculateEmi()} onChange={(e) => handleInputChange('emiAmount', e.target.value)} className="bg-emerald-50" />
                    <Badge variant="outline">{formatCurrency(parseFloat(String(formData.emiAmount || calculateEmi())) || 0)}</Badge>
                  </div>
                </div>
                <div className="space-y-2"><Label>Processing Fee</Label><Input type="number" value={formData.processingFee} onChange={(e) => handleInputChange('processingFee', e.target.value)} /></div>
              </div>
            </div>

            {/* Dates & Disbursement */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Dates & Disbursement</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Disbursement Date *</Label><Input type="date" value={formData.disbursementDate} onChange={(e) => handleInputChange('disbursementDate', e.target.value)} /></div>
                <div className="space-y-2"><Label>EMI Start Date *</Label><Input type="date" value={formData.startDate} onChange={(e) => handleInputChange('startDate', e.target.value)} /></div>
              </div>
              
              {/* Bank Account Selection */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Disbursement Account
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select value={formData.disbursementMode} onValueChange={(v) => handleInputChange('disbursementMode', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference Number</Label>
                    <Input value={formData.disbursementRef} onChange={(e) => handleInputChange('disbursementRef', e.target.value)} placeholder="Cheque No. / Ref" />
                  </div>
                </div>
                
                {bankAccounts.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label>Select Bank Account for Disbursement</Label>
                    <Select 
                      value={formData.bankAccountId || ''} 
                      onValueChange={(v) => handleInputChange('bankAccountId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.bankName} - {acc.accountNumber}
                            <span className="text-gray-500 ml-1">(Bal: ₹{acc.currentBalance?.toLocaleString()})</span>
                            {acc.isDefault && <span className="text-amber-600 ml-1">★ Default</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-blue-600">
                      The loan amount will be deducted from the selected bank account
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Toggle */}
            <div className="pt-4 border-t">
              <button type="button" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900" onClick={() => setShowAdvanced(!showAdvanced)}>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Reference Contacts & Notes
              </button>
              
              {showAdvanced && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Guardian 1</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Name" value={formData.reference1Name} onChange={(e) => handleInputChange('reference1Name', e.target.value)} />
                      <Input placeholder="Phone" value={formData.reference1Phone} onChange={(e) => handleInputChange('reference1Phone', e.target.value)} />
                      <Input placeholder="Relation" value={formData.reference1Relation} onChange={(e) => handleInputChange('reference1Relation', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Guardian 2</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Name" value={formData.reference2Name} onChange={(e) => handleInputChange('reference2Name', e.target.value)} />
                      <Input placeholder="Phone" value={formData.reference2Phone} onChange={(e) => handleInputChange('reference2Phone', e.target.value)} />
                      <Input placeholder="Relation" value={formData.reference2Relation} onChange={(e) => handleInputChange('reference2Relation', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Notes</Label><Input value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Internal Notes</Label><Input value={formData.internalNotes} onChange={(e) => handleInputChange('internalNotes', e.target.value)} /></div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); resetForm(); }}><X className="h-4 w-4 mr-2" /> Cancel</Button>
              <Button className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500" onClick={handleSubmit} disabled={submitting || !formData.companyId}>
                <Save className="h-4 w-4 mr-2" /> {submitting ? 'Creating...' : 'Create Loan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
