'use client';

import { useState, useEffect } from 'react';
import DashboardLayout, { ROLE_MENU_ITEMS } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, CheckCircle, XCircle, Clock, Users, Eye, ClipboardList, User, FileSearch, Upload, MapPin, Phone, Mail, Building, Briefcase, Banknote, AlertTriangle, ArrowLeft, ArrowRight, Navigation, Calendar, Loader2, FileEdit, Info, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate, validatePAN, validateAadhaar, validateIFSC, validatePhone, validateEmail } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import LoanDetailPanel from '@/components/loan/LoanDetailPanel';
import MyCreditPassbook from '@/components/credit/MyCreditPassbook';
import SecondaryPaymentPagesSection from '@/components/payment/SecondaryPaymentPagesSection';

interface Loan {
  id: string; applicationNo: string; status: string; requestedAmount: number; loanType: string;
  createdAt: string; riskScore: number; fraudFlag: boolean; purpose: string;
  customer: { id: string; name: string; email: string; phone: string; };
  sessionForm?: any; loanForm?: any; company?: any;
  requestedTenure?: number; requestedInterestRate?: number;
  currentHandlerId?: string;
  title?: string; firstName?: string; lastName?: string; fatherName?: string;
  panNumber?: string; aadhaarNumber?: string; dateOfBirth?: string;
  employmentType?: string; employerName?: string; monthlyIncome?: number;
  bankAccountNumber?: string; bankIfsc?: string; bankName?: string;
  address?: string; city?: string; state?: string; pincode?: string;
}

const STEPS = [
  { id: 1, title: 'Personal Info', icon: User, description: 'Basic personal details' },
  { id: 2, title: 'Contact', icon: MapPin, description: 'Address & contact info' },
  { id: 3, title: 'KYC', icon: FileSearch, description: 'Identity documents' },
  { id: 4, title: 'Employment', icon: Briefcase, description: 'Work & income details' },
  { id: 5, title: 'Bank', icon: Banknote, description: 'Bank account details' },
  { id: 6, title: 'Guardian', icon: Users, description: 'Guardian details' },
  { id: 7, title: 'Documents', icon: Upload, description: 'Upload documents' },
  { id: 8, title: 'Signature', icon: FileText, description: 'Applicant signature' },
  { id: 9, title: 'Review', icon: ClipboardList, description: 'Final review & submit' },
];

interface FormErrors {
  [key: string]: string;
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showLoanFormDialog, setShowLoanFormDialog] = useState(false);
  const [showLoanDetailsDialog, setShowLoanDetailsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Loan Detail Panel state
  const [showLoanDetailPanel, setShowLoanDetailPanel] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  
  // Loan form state
  const [loanForm, setLoanForm] = useState({
    title: '', firstName: '', lastName: '', middleName: '', fatherName: '', motherName: '',
    dateOfBirth: '', gender: '', maritalStatus: '', nationality: 'Indian',
    panNumber: '', aadhaarNumber: '', panVerified: false, aadhaarVerified: false,
    address: '', city: '', state: '', pincode: '', phone: '',
    employmentType: '', employerName: '', employerAddress: '', designation: '',
    yearsInEmployment: '', totalWorkExperience: '', monthlyIncome: '', annualIncome: '',
    // Employment-specific fields
    businessName: '', businessType: '', yearsInBusiness: '', annualTurnover: '', businessAddress: '',
    companyName: '', companyType: '', yearsInOperation: '', annualRevenue: '', numberOfEmployees: '',
    professionType: '', practiceName: '', yearsOfPractice: '', professionalRegNo: '',
    previousEmployer: '', retirementDate: '', pensionAmount: '',
    spouseName: '', spouseOccupation: '', spouseIncome: '', familyIncome: '',
    institutionName: '', courseProgram: '', expectedCompletion: '', guardianName: '', guardianIncome: '',
    sourceOfFunds: '', monthlySupportAmount: '', supportProviderName: '',
    officePhone: '', officeEmail: '',
    bankAccountNumber: '', bankIfsc: '', bankName: '', accountType: '', bankVerified: false,
    verificationRemarks: '', riskScore: 0, fraudFlag: false, visitDate: '', visitRemarks: '',
    // Reference fields
    ref1Name: '', ref1Phone: '', ref1Relation: '', ref1Address: '',
    ref2Name: '', ref2Phone: '', ref2Relation: '', ref2Address: '',
    creditScore: 0,
    // Signature
    applicantSignature: '',
  });

  // Document upload state
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { url: string; name: string; uploading: boolean }>>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Document types
  const DOCUMENT_TYPES = [
    { id: 'pan_card', name: 'PAN Card', desc: 'Front side', required: true },
    { id: 'aadhaar_front', name: 'Aadhaar Front', desc: 'Front side', required: true },
    { id: 'aadhaar_back', name: 'Aadhaar Back', desc: 'Back side', required: true },
    { id: 'income_proof', name: 'Income Proof', desc: 'Salary slip/ITR', required: true },
    { id: 'address_proof', name: 'Address Proof', desc: 'Utility bill', required: false },
    { id: 'photo', name: 'Photo', desc: 'Passport size', required: false },
    { id: 'election_card', name: 'Election Card', desc: 'Voter ID', required: false },
    { id: 'house_photo', name: 'House Photo', desc: 'Residence photo', required: false },
  ];

  useEffect(() => {
    fetchLoans();
    fetchActiveLoans();
  }, [user]);

  const fetchLoans = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/loan/list?role=STAFF&staffId=${user.id}`);
      const data = await response.json();
      setLoans(data.loans || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast({ title: 'Error', description: 'Failed to fetch loan applications', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveLoans = async () => {
    try {
      const response = await fetch('/api/loan/all-active');
      const data = await response.json();
      setActiveLoans(data.loans || []);
    } catch (error) {
      console.error('Error fetching active loans:', error);
    }
  };

  const openLoanFormDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setFormErrors({});
    setSubmitError(null);
    // Pre-fill form with existing data
    setLoanForm({
      title: loan.title || '',
      firstName: loan.firstName || loan.customer?.name?.split(' ')[0] || '',
      lastName: loan.lastName || loan.customer?.name?.split(' ').slice(1).join(' ') || '',
      middleName: '',
      fatherName: loan.fatherName || '',
      motherName: '',
      dateOfBirth: loan.dateOfBirth ? new Date(loan.dateOfBirth).toISOString().split('T')[0] : '',
      gender: '',
      maritalStatus: '',
      nationality: 'Indian',
      panNumber: loan.panNumber || '',
      aadhaarNumber: loan.aadhaarNumber || '',
      panVerified: false,
      aadhaarVerified: false,
      address: loan.address || '',
      city: loan.city || '',
      state: loan.state || '',
      pincode: loan.pincode || '',
      phone: loan.customer?.phone || '',
      employmentType: loan.employmentType || '',
      employerName: loan.employerName || '',
      employerAddress: '',
      designation: '',
      yearsInEmployment: '',
      totalWorkExperience: '',
      monthlyIncome: loan.monthlyIncome?.toString() || '',
      annualIncome: '',
      // Employment-specific fields
      businessName: '', businessType: '', yearsInBusiness: '', annualTurnover: '', businessAddress: '',
      companyName: '', companyType: '', yearsInOperation: '', annualRevenue: '', numberOfEmployees: '',
      professionType: '', practiceName: '', yearsOfPractice: '', professionalRegNo: '',
      previousEmployer: '', retirementDate: '', pensionAmount: '',
      spouseName: '', spouseOccupation: '', spouseIncome: '', familyIncome: '',
      institutionName: '', courseProgram: '', expectedCompletion: '', guardianName: '', guardianIncome: '',
      sourceOfFunds: '', monthlySupportAmount: '', supportProviderName: '',
      officePhone: '', officeEmail: '',
      bankAccountNumber: loan.bankAccountNumber || '',
      bankIfsc: loan.bankIfsc || '',
      bankName: loan.bankName || '',
      accountType: '',
      bankVerified: false,
      verificationRemarks: '',
      riskScore: 0,
      fraudFlag: false,
      visitDate: '',
      visitRemarks: '',
      ref1Name: '', ref1Phone: '', ref1Relation: '', ref1Address: '',
      ref2Name: '', ref2Phone: '', ref2Relation: '', ref2Address: '',
      creditScore: 0,
      applicantSignature: '',
    });
    setUploadedDocs({});
    setCurrentStep(1);
    setShowLoanFormDialog(true);
  };

  // Handle document upload
  const handleDocumentUpload = async (documentType: string, file: File) => {
    if (!selectedLoan) return;
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({ 
        title: 'Invalid File Type', 
        description: 'Only images (PNG, JPG, WEBP) and PDF files are allowed.', 
        variant: 'destructive' 
      });
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({ 
        title: 'File Too Large', 
        description: 'Maximum file size is 10MB.', 
        variant: 'destructive' 
      });
      return;
    }
    
    setUploadingDoc(documentType);
    setUploadedDocs(prev => ({
      ...prev,
      [documentType]: { url: '', name: file.name, uploading: true }
    }));
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      formData.append('loanId', selectedLoan.id);
      formData.append('uploadedBy', user?.id || '');
      
      const response = await fetch('/api/upload/document', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      
      setUploadedDocs(prev => ({
        ...prev,
        [documentType]: { url: data.url, name: file.name, uploading: false }
      }));
      
      toast({ 
        title: 'Upload Successful', 
        description: `${DOCUMENT_TYPES.find(d => d.id === documentType)?.name || documentType} uploaded successfully.` 
      });
    } catch (error) {
      setUploadedDocs(prev => {
        const newDocs = { ...prev };
        delete newDocs[documentType];
        return newDocs;
      });
      toast({ 
        title: 'Upload Failed', 
        description: error instanceof Error ? error.message : 'Failed to upload document.', 
        variant: 'destructive' 
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  // Remove uploaded document
  const handleRemoveDocument = (documentType: string) => {
    setUploadedDocs(prev => {
      const newDocs = { ...prev };
      delete newDocs[documentType];
      return newDocs;
    });
    toast({ title: 'Document Removed', description: 'The document has been removed.' });
  };

  const validateCurrentStep = (): boolean => {
    const errors: FormErrors = {};
    
    switch (currentStep) {
      case 1:
        if (!loanForm.firstName.trim()) errors.firstName = 'First name is required';
        if (!loanForm.lastName.trim()) errors.lastName = 'Last name is required';
        break;
      case 2:
        if (!loanForm.address.trim()) errors.address = 'Address is required';
        if (!loanForm.city.trim()) errors.city = 'City is required';
        if (!loanForm.state.trim()) errors.state = 'State is required';
        if (!loanForm.pincode.trim()) errors.pincode = 'Pincode is required';
        else if (!/^\d{6}$/.test(loanForm.pincode)) errors.pincode = 'Invalid pincode (6 digits required)';
        break;
      case 3:
        if (!loanForm.panNumber.trim()) errors.panNumber = 'PAN number is required';
        else if (!validatePAN(loanForm.panNumber)) errors.panNumber = 'Invalid PAN format (e.g., ABCDE1234F)';
        if (!loanForm.aadhaarNumber.trim()) errors.aadhaarNumber = 'Aadhaar number is required';
        else if (!validateAadhaar(loanForm.aadhaarNumber)) errors.aadhaarNumber = 'Invalid Aadhaar (12 digits required)';
        break;
      case 4:
        if (!loanForm.employmentType) errors.employmentType = 'Employment type is required';
        // Dynamic validation based on employment type
        if (loanForm.employmentType === 'Salaried') {
          if (!loanForm.employerName.trim()) errors.employerName = 'Employer name is required';
          if (!loanForm.monthlyIncome.trim()) errors.monthlyIncome = 'Monthly income is required';
        } else if (loanForm.employmentType === 'Self-Employed') {
          if (!loanForm.businessName.trim()) errors.businessName = 'Business name is required';
          if (!loanForm.annualTurnover.trim()) errors.annualTurnover = 'Annual turnover is required';
        } else if (loanForm.employmentType === 'Business') {
          if (!loanForm.companyName.trim()) errors.companyName = 'Company name is required';
          if (!loanForm.annualRevenue.trim()) errors.annualRevenue = 'Annual revenue is required';
        } else if (loanForm.employmentType === 'Professional') {
          if (!loanForm.professionType.trim()) errors.professionType = 'Profession type is required';
          if (!loanForm.monthlyIncome.trim()) errors.monthlyIncome = 'Monthly income is required';
        } else if (loanForm.employmentType === 'Housewife') {
          if (!loanForm.spouseName.trim()) errors.spouseName = 'Spouse name is required';
          if (!loanForm.familyIncome.trim()) errors.familyIncome = 'Family income is required';
        } else if (loanForm.employmentType === 'Student') {
          if (!loanForm.institutionName.trim()) errors.institutionName = 'Institution name is required';
          if (!loanForm.guardianName.trim()) errors.guardianName = 'Guardian name is required';
        } else if (loanForm.employmentType === 'Retired') {
          if (!loanForm.previousEmployer.trim()) errors.previousEmployer = 'Previous employer is required';
          if (!loanForm.pensionAmount.trim()) errors.pensionAmount = 'Pension amount is required';
        } else if (loanForm.employmentType === 'Unemployed') {
          if (!loanForm.sourceOfFunds.trim()) errors.sourceOfFunds = 'Source of funds is required';
        }
        if (loanForm.monthlyIncome && parseFloat(loanForm.monthlyIncome) <= 0) errors.monthlyIncome = 'Income must be greater than 0';
        break;
      case 5:
        if (!loanForm.bankAccountNumber.trim()) errors.bankAccountNumber = 'Account number is required';
        if (!loanForm.bankIfsc.trim()) errors.bankIfsc = 'IFSC code is required';
        else if (!validateIFSC(loanForm.bankIfsc)) errors.bankIfsc = 'Invalid IFSC format (e.g., SBIN0001234)';
        if (!loanForm.bankName.trim()) errors.bankName = 'Bank name is required';
        break;
      case 6:
        // Guardians are optional but if provided, need phone validation
        if (loanForm.ref1Phone && !validatePhone(loanForm.ref1Phone)) {
          errors.ref1Phone = 'Invalid phone number';
        }
        if (loanForm.ref2Phone && !validatePhone(loanForm.ref2Phone)) {
          errors.ref2Phone = 'Invalid phone number';
        }
        break;
      case 7:
        // Documents - no validation for now
        break;
      case 8:
        // Signature - optional for now
        break;
      case 9:
        // Final review - no additional validation
        break;
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setFormErrors({});
    }
  };

  const handleCompleteForm = async () => {
    if (!selectedLoan) return;
    
    if (!validateCurrentStep()) return;
    
    setSaving(true);
    setSubmitError(null);
    
    try {
      const response = await fetch('/api/loan/apply', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          ...loanForm,
          status: 'LOAN_FORM_COMPLETED',
          userId: user?.id
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit form');
      }
      
      toast({ 
        title: 'Success!', 
        description: 'Loan form submitted successfully. The agent will create a session.', 
      });
      setShowLoanFormDialog(false);
      fetchLoans();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit loan form';
      setSubmitError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLoan) return;
    if (!loanForm.verificationRemarks.trim()) {
      setFormErrors({ verificationRemarks: 'Please provide a reason for rejection' });
      return;
    }
    
    setSaving(true);
    setSubmitError(null);
    
    try {
      const response = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          action: 'reject',
          role: 'STAFF',
          userId: user?.id,
          remarks: loanForm.verificationRemarks
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reject loan');
      }
      
      toast({ title: 'Loan Rejected', description: 'The loan application has been rejected.', variant: 'destructive' });
      setShowLoanFormDialog(false);
      fetchLoans();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject loan';
      setSubmitError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      AGENT_APPROVED_STAGE1: { className: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Pending Form' },
      LOAN_FORM_COMPLETED: { className: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Form Completed' },
      SESSION_CREATED: { className: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Sanction Created' },
      REJECTED_FINAL: { className: 'bg-red-100 text-red-700 border-red-200', label: 'Rejected' },
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700 border-gray-200', label: status };
    return <Badge className={c.className} variant="outline">{c.label}</Badge>;
  };

  const pendingLoans = loans.filter(l => l.status === 'AGENT_APPROVED_STAGE1');
  const completedLoans = loans.filter(l => l.status === 'LOAN_FORM_COMPLETED');
  const inProgressLoans = loans.filter(l => ['SESSION_CREATED', 'CUSTOMER_SESSION_APPROVED', 'FINAL_APPROVED', 'ACTIVE'].includes(l.status));

  const stats = [
    { label: 'Pending Forms', value: pendingLoans.length, icon: FileEdit, color: 'text-orange-600', bg: 'bg-orange-50', onClick: () => setActiveTab('pending') },
    { label: 'Completed', value: completedLoans.length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', onClick: () => setActiveTab('completed') },
    { label: 'In Progress', value: inProgressLoans.length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => setActiveTab('activeLoans') },
    { label: 'Active Loans', value: activeLoans.length, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setActiveTab('activeLoans') }
  ];

  const menuItems = ROLE_MENU_ITEMS.STAFF.map(item => ({
    ...item,
    count: item.id === 'pending' ? pendingLoans.length : 
           item.id === 'completed' ? completedLoans.length :
           item.id === 'activeLoans' ? activeLoans.length : undefined
  }));

  const renderStepContent = () => {
    const inputClass = (field: string) => `w-full ${formErrors[field] ? 'border-red-500 focus-visible:ring-red-500' : ''}`;
    
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-lg">Personal Information</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Select value={loanForm.title} onValueChange={(v) => setLoanForm({...loanForm, title: v})}>
                  <SelectTrigger id="title"><SelectValue placeholder="Select title" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Dr">Dr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" className={inputClass('firstName')} value={loanForm.firstName} onChange={(e) => setLoanForm({...loanForm, firstName: e.target.value})} placeholder="Enter first name" />
                {formErrors.firstName && <p className="text-xs text-red-500 mt-1">{formErrors.firstName}</p>}
              </div>
              <div>
                <Label htmlFor="middleName">Middle Name</Label>
                <Input id="middleName" value={loanForm.middleName} onChange={(e) => setLoanForm({...loanForm, middleName: e.target.value})} placeholder="Enter middle name" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" className={inputClass('lastName')} value={loanForm.lastName} onChange={(e) => setLoanForm({...loanForm, lastName: e.target.value})} placeholder="Enter last name" />
                {formErrors.lastName && <p className="text-xs text-red-500 mt-1">{formErrors.lastName}</p>}
              </div>
              <div>
                <Label htmlFor="fatherName">Father's Name</Label>
                <Input id="fatherName" value={loanForm.fatherName} onChange={(e) => setLoanForm({...loanForm, fatherName: e.target.value})} placeholder="Enter father's name" />
              </div>
              <div>
                <Label htmlFor="motherName">Mother's Name</Label>
                <Input id="motherName" value={loanForm.motherName} onChange={(e) => setLoanForm({...loanForm, motherName: e.target.value})} placeholder="Enter mother's name" />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input id="dateOfBirth" type="date" value={loanForm.dateOfBirth} onChange={(e) => setLoanForm({...loanForm, dateOfBirth: e.target.value})} />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select value={loanForm.gender} onValueChange={(v) => setLoanForm({...loanForm, gender: v})}>
                  <SelectTrigger id="gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="maritalStatus">Marital Status</Label>
                <Select value={loanForm.maritalStatus} onValueChange={(v) => setLoanForm({...loanForm, maritalStatus: v})}>
                  <SelectTrigger id="maritalStatus"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Divorced">Divorced</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Input id="nationality" value={loanForm.nationality} onChange={(e) => setLoanForm({...loanForm, nationality: e.target.value})} />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-lg">Contact & Address</h4>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="address">Full Address *</Label>
                <Textarea id="address" className={inputClass('address')} value={loanForm.address} onChange={(e) => setLoanForm({...loanForm, address: e.target.value})} placeholder="Enter complete address" rows={3} />
                {formErrors.address && <p className="text-xs text-red-500 mt-1">{formErrors.address}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" className={inputClass('city')} value={loanForm.city} onChange={(e) => setLoanForm({...loanForm, city: e.target.value})} placeholder="Enter city" />
                  {formErrors.city && <p className="text-xs text-red-500 mt-1">{formErrors.city}</p>}
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input id="state" className={inputClass('state')} value={loanForm.state} onChange={(e) => setLoanForm({...loanForm, state: e.target.value})} placeholder="Enter state" />
                  {formErrors.state && <p className="text-xs text-red-500 mt-1">{formErrors.state}</p>}
                </div>
                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input id="pincode" className={inputClass('pincode')} value={loanForm.pincode} onChange={(e) => setLoanForm({...loanForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})} placeholder="6-digit pincode" maxLength={6} />
                  {formErrors.pincode && <p className="text-xs text-red-500 mt-1">{formErrors.pincode}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" value={loanForm.phone} onChange={(e) => setLoanForm({...loanForm, phone: e.target.value})} placeholder="10-digit mobile number" maxLength={10} />
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <FileSearch className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-lg">KYC Documents</h4>
            </div>
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 text-sm">
                Enter valid PAN and Aadhaar numbers. Mark as verified after checking the documents.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="panNumber">PAN Number *</Label>
                <Input id="panNumber" className={inputClass('panNumber')} value={loanForm.panNumber} onChange={(e) => setLoanForm({...loanForm, panNumber: e.target.value.toUpperCase()})} placeholder="ABCDE1234F" maxLength={10} />
                {formErrors.panNumber && <p className="text-xs text-red-500 mt-1">{formErrors.panNumber}</p>}
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="panVerified" checked={loanForm.panVerified} onCheckedChange={(checked) => setLoanForm({...loanForm, panVerified: checked as boolean})} />
                  <label htmlFor="panVerified" className="text-sm font-medium cursor-pointer">PAN Verified</label>
                </div>
              </div>
              <div>
                <Label htmlFor="aadhaarNumber">Aadhaar Number *</Label>
                <Input id="aadhaarNumber" className={inputClass('aadhaarNumber')} value={loanForm.aadhaarNumber} onChange={(e) => setLoanForm({...loanForm, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12)})} placeholder="123456789012" />
                {formErrors.aadhaarNumber && <p className="text-xs text-red-500 mt-1">{formErrors.aadhaarNumber}</p>}
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="aadhaarVerified" checked={loanForm.aadhaarVerified} onCheckedChange={(checked) => setLoanForm({...loanForm, aadhaarVerified: checked as boolean})} />
                  <label htmlFor="aadhaarVerified" className="text-sm font-medium cursor-pointer">Aadhaar Verified</label>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-lg">Employment Details</h4>
            </div>
            
            {/* Employment Type Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employmentType">Employment Type *</Label>
                <Select value={loanForm.employmentType} onValueChange={(v) => setLoanForm({...loanForm, employmentType: v})}>
                  <SelectTrigger id="employmentType" className={inputClass('employmentType')}><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Salaried">Salaried Employee</SelectItem>
                    <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                    <SelectItem value="Business">Business Owner</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Housewife">Housewife</SelectItem>
                    <SelectItem value="Student">Student</SelectItem>
                    <SelectItem value="Retired">Retired</SelectItem>
                    <SelectItem value="Unemployed">Unemployed</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.employmentType && <p className="text-xs text-red-500 mt-1">{formErrors.employmentType}</p>}
              </div>
            </div>

            {/* Dynamic Fields Based on Employment Type */}
            {loanForm.employmentType === 'Salaried' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <h5 className="sm:col-span-2 font-medium text-blue-800 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Salaried Employee Details
                </h5>
                <div>
                  <Label htmlFor="employerName">Employer Name *</Label>
                  <Input id="employerName" className={inputClass('employerName')} value={loanForm.employerName} onChange={(e) => setLoanForm({...loanForm, employerName: e.target.value})} placeholder="Company name" />
                  {formErrors.employerName && <p className="text-xs text-red-500 mt-1">{formErrors.employerName}</p>}
                </div>
                <div>
                  <Label htmlFor="designation">Designation</Label>
                  <Input id="designation" value={loanForm.designation} onChange={(e) => setLoanForm({...loanForm, designation: e.target.value})} placeholder="Job title" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="employerAddress">Employer Address</Label>
                  <Textarea id="employerAddress" value={loanForm.employerAddress} onChange={(e) => setLoanForm({...loanForm, employerAddress: e.target.value})} placeholder="Office address" rows={2} />
                </div>
                <div>
                  <Label htmlFor="officePhone">Office Phone</Label>
                  <Input id="officePhone" value={loanForm.officePhone} onChange={(e) => setLoanForm({...loanForm, officePhone: e.target.value})} placeholder="Office contact" />
                </div>
                <div>
                  <Label htmlFor="officeEmail">Office Email</Label>
                  <Input id="officeEmail" type="email" value={loanForm.officeEmail} onChange={(e) => setLoanForm({...loanForm, officeEmail: e.target.value})} placeholder="Official email" />
                </div>
                <div>
                  <Label htmlFor="yearsInEmployment">Years in Current Job</Label>
                  <Input id="yearsInEmployment" type="number" value={loanForm.yearsInEmployment} onChange={(e) => setLoanForm({...loanForm, yearsInEmployment: e.target.value})} placeholder="Years" min="0" />
                </div>
                <div>
                  <Label htmlFor="totalWorkExperience">Total Work Experience</Label>
                  <Input id="totalWorkExperience" type="number" value={loanForm.totalWorkExperience} onChange={(e) => setLoanForm({...loanForm, totalWorkExperience: e.target.value})} placeholder="Total years" min="0" />
                </div>
                <div>
                  <Label htmlFor="monthlyIncome">Monthly Income (₹) *</Label>
                  <Input id="monthlyIncome" type="number" className={inputClass('monthlyIncome')} value={loanForm.monthlyIncome} onChange={(e) => setLoanForm({...loanForm, monthlyIncome: e.target.value})} placeholder="Amount" min="0" />
                  {formErrors.monthlyIncome && <p className="text-xs text-red-500 mt-1">{formErrors.monthlyIncome}</p>}
                </div>
                <div>
                  <Label htmlFor="annualIncome">Annual Income (₹)</Label>
                  <Input id="annualIncome" type="number" value={loanForm.annualIncome} onChange={(e) => setLoanForm({...loanForm, annualIncome: e.target.value})} placeholder="Amount" min="0" />
                </div>
              </div>
            )}

            {loanForm.employmentType === 'Self-Employed' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <h5 className="sm:col-span-2 font-medium text-purple-800 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Self-Employed Details
                </h5>
                <div>
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input id="businessName" className={inputClass('businessName')} value={loanForm.businessName} onChange={(e) => setLoanForm({...loanForm, businessName: e.target.value})} placeholder="Your business name" />
                  {formErrors.businessName && <p className="text-xs text-red-500 mt-1">{formErrors.businessName}</p>}
                </div>
                <div>
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select value={loanForm.businessType} onValueChange={(v) => setLoanForm({...loanForm, businessType: v})}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Proprietorship">Proprietorship</SelectItem>
                      <SelectItem value="Partnership">Partnership</SelectItem>
                      <SelectItem value="LLP">LLP</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Textarea id="businessAddress" value={loanForm.businessAddress} onChange={(e) => setLoanForm({...loanForm, businessAddress: e.target.value})} placeholder="Business address" rows={2} />
                </div>
                <div>
                  <Label htmlFor="yearsInBusiness">Years in Business</Label>
                  <Input id="yearsInBusiness" type="number" value={loanForm.yearsInBusiness} onChange={(e) => setLoanForm({...loanForm, yearsInBusiness: e.target.value})} placeholder="Years" min="0" />
                </div>
                <div>
                  <Label htmlFor="annualTurnover">Annual Turnover (₹) *</Label>
                  <Input id="annualTurnover" type="number" className={inputClass('annualTurnover')} value={loanForm.annualTurnover} onChange={(e) => setLoanForm({...loanForm, annualTurnover: e.target.value})} placeholder="Annual turnover" min="0" />
                  {formErrors.annualTurnover && <p className="text-xs text-red-500 mt-1">{formErrors.annualTurnover}</p>}
                </div>
                <div>
                  <Label htmlFor="monthlyIncome">Monthly Income (₹)</Label>
                  <Input id="monthlyIncome" type="number" value={loanForm.monthlyIncome} onChange={(e) => setLoanForm({...loanForm, monthlyIncome: e.target.value})} placeholder="Monthly draw" min="0" />
                </div>
              </div>
            )}

            {loanForm.employmentType === 'Business' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <h5 className="sm:col-span-2 font-medium text-amber-800 flex items-center gap-2">
                  <Building className="h-4 w-4" /> Business Owner Details
                </h5>
                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input id="companyName" className={inputClass('companyName')} value={loanForm.companyName} onChange={(e) => setLoanForm({...loanForm, companyName: e.target.value})} placeholder="Company name" />
                  {formErrors.companyName && <p className="text-xs text-red-500 mt-1">{formErrors.companyName}</p>}
                </div>
                <div>
                  <Label htmlFor="companyType">Company Type</Label>
                  <Select value={loanForm.companyType} onValueChange={(v) => setLoanForm({...loanForm, companyType: v})}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pvt Ltd">Private Limited</SelectItem>
                      <SelectItem value="Public Ltd">Public Limited</SelectItem>
                      <SelectItem value="LLP">LLP</SelectItem>
                      <SelectItem value="Partnership">Partnership</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="businessAddress">Company Address</Label>
                  <Textarea id="businessAddress" value={loanForm.businessAddress} onChange={(e) => setLoanForm({...loanForm, businessAddress: e.target.value})} placeholder="Company address" rows={2} />
                </div>
                <div>
                  <Label htmlFor="yearsInOperation">Years in Operation</Label>
                  <Input id="yearsInOperation" type="number" value={loanForm.yearsInOperation} onChange={(e) => setLoanForm({...loanForm, yearsInOperation: e.target.value})} placeholder="Years" min="0" />
                </div>
                <div>
                  <Label htmlFor="numberOfEmployees">Number of Employees</Label>
                  <Input id="numberOfEmployees" type="number" value={loanForm.numberOfEmployees} onChange={(e) => setLoanForm({...loanForm, numberOfEmployees: e.target.value})} placeholder="Employee count" min="0" />
                </div>
                <div>
                  <Label htmlFor="annualRevenue">Annual Revenue (₹) *</Label>
                  <Input id="annualRevenue" type="number" className={inputClass('annualRevenue')} value={loanForm.annualRevenue} onChange={(e) => setLoanForm({...loanForm, annualRevenue: e.target.value})} placeholder="Annual revenue" min="0" />
                  {formErrors.annualRevenue && <p className="text-xs text-red-500 mt-1">{formErrors.annualRevenue}</p>}
                </div>
                <div>
                  <Label htmlFor="monthlyIncome">Monthly Income (₹)</Label>
                  <Input id="monthlyIncome" type="number" value={loanForm.monthlyIncome} onChange={(e) => setLoanForm({...loanForm, monthlyIncome: e.target.value})} placeholder="Monthly draw" min="0" />
                </div>
              </div>
            )}

            {loanForm.employmentType === 'Professional' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-teal-50 rounded-xl border border-teal-100">
                <h5 className="sm:col-span-2 font-medium text-teal-800 flex items-center gap-2">
                  <User className="h-4 w-4" /> Professional Details
                </h5>
                <div>
                  <Label htmlFor="professionType">Profession Type *</Label>
                  <Select value={loanForm.professionType} onValueChange={(v) => setLoanForm({...loanForm, professionType: v})}>
                    <SelectTrigger className={inputClass('professionType')}><SelectValue placeholder="Select profession" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Doctor">Doctor</SelectItem>
                      <SelectItem value="CA">Chartered Accountant</SelectItem>
                      <SelectItem value="Lawyer">Lawyer</SelectItem>
                      <SelectItem value="Architect">Architect</SelectItem>
                      <SelectItem value="Consultant">Consultant</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.professionType && <p className="text-xs text-red-500 mt-1">{formErrors.professionType}</p>}
                </div>
                <div>
                  <Label htmlFor="practiceName">Practice/Business Name</Label>
                  <Input id="practiceName" value={loanForm.practiceName} onChange={(e) => setLoanForm({...loanForm, practiceName: e.target.value})} placeholder="Clinic/Firm name" />
                </div>
                <div>
                  <Label htmlFor="professionalRegNo">Registration Number</Label>
                  <Input id="professionalRegNo" value={loanForm.professionalRegNo} onChange={(e) => setLoanForm({...loanForm, professionalRegNo: e.target.value})} placeholder="Professional registration" />
                </div>
                <div>
                  <Label htmlFor="yearsOfPractice">Years of Practice</Label>
                  <Input id="yearsOfPractice" type="number" value={loanForm.yearsOfPractice} onChange={(e) => setLoanForm({...loanForm, yearsOfPractice: e.target.value})} placeholder="Years" min="0" />
                </div>
                <div>
                  <Label htmlFor="monthlyIncome">Monthly Income (₹) *</Label>
                  <Input id="monthlyIncome" type="number" className={inputClass('monthlyIncome')} value={loanForm.monthlyIncome} onChange={(e) => setLoanForm({...loanForm, monthlyIncome: e.target.value})} placeholder="Amount" min="0" />
                  {formErrors.monthlyIncome && <p className="text-xs text-red-500 mt-1">{formErrors.monthlyIncome}</p>}
                </div>
                <div>
                  <Label htmlFor="annualIncome">Annual Income (₹)</Label>
                  <Input id="annualIncome" type="number" value={loanForm.annualIncome} onChange={(e) => setLoanForm({...loanForm, annualIncome: e.target.value})} placeholder="Amount" min="0" />
                </div>
              </div>
            )}

            {loanForm.employmentType === 'Housewife' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-pink-50 rounded-xl border border-pink-100">
                <h5 className="sm:col-span-2 font-medium text-pink-800 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Housewife Details
                </h5>
                <div>
                  <Label htmlFor="spouseName">Spouse Name *</Label>
                  <Input id="spouseName" className={inputClass('spouseName')} value={loanForm.spouseName} onChange={(e) => setLoanForm({...loanForm, spouseName: e.target.value})} placeholder="Husband/Wife name" />
                  {formErrors.spouseName && <p className="text-xs text-red-500 mt-1">{formErrors.spouseName}</p>}
                </div>
                <div>
                  <Label htmlFor="spouseOccupation">Spouse Occupation</Label>
                  <Input id="spouseOccupation" value={loanForm.spouseOccupation} onChange={(e) => setLoanForm({...loanForm, spouseOccupation: e.target.value})} placeholder="Spouse's occupation" />
                </div>
                <div>
                  <Label htmlFor="spouseIncome">Spouse Monthly Income (₹)</Label>
                  <Input id="spouseIncome" type="number" value={loanForm.spouseIncome} onChange={(e) => setLoanForm({...loanForm, spouseIncome: e.target.value})} placeholder="Spouse income" min="0" />
                </div>
                <div>
                  <Label htmlFor="familyIncome">Total Family Income (₹) *</Label>
                  <Input id="familyIncome" type="number" className={inputClass('familyIncome')} value={loanForm.familyIncome} onChange={(e) => setLoanForm({...loanForm, familyIncome: e.target.value})} placeholder="Total family income" min="0" />
                  {formErrors.familyIncome && <p className="text-xs text-red-500 mt-1">{formErrors.familyIncome}</p>}
                </div>
              </div>
            )}

            {loanForm.employmentType === 'Student' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-cyan-50 rounded-xl border border-cyan-100">
                <h5 className="sm:col-span-2 font-medium text-cyan-800 flex items-center gap-2">
                  <User className="h-4 w-4" /> Student Details
                </h5>
                <div>
                  <Label htmlFor="institutionName">Institution Name *</Label>
                  <Input id="institutionName" className={inputClass('institutionName')} value={loanForm.institutionName} onChange={(e) => setLoanForm({...loanForm, institutionName: e.target.value})} placeholder="School/College name" />
                  {formErrors.institutionName && <p className="text-xs text-red-500 mt-1">{formErrors.institutionName}</p>}
                </div>
                <div>
                  <Label htmlFor="courseProgram">Course/Program</Label>
                  <Input id="courseProgram" value={loanForm.courseProgram} onChange={(e) => setLoanForm({...loanForm, courseProgram: e.target.value})} placeholder="Course name" />
                </div>
                <div>
                  <Label htmlFor="expectedCompletion">Expected Completion</Label>
                  <Input id="expectedCompletion" type="date" value={loanForm.expectedCompletion} onChange={(e) => setLoanForm({...loanForm, expectedCompletion: e.target.value})} />
                </div>
                <div>
                  <Label htmlFor="guardianName">Guardian Name *</Label>
                  <Input id="guardianName" className={inputClass('guardianName')} value={loanForm.guardianName} onChange={(e) => setLoanForm({...loanForm, guardianName: e.target.value})} placeholder="Parent/Guardian name" />
                  {formErrors.guardianName && <p className="text-xs text-red-500 mt-1">{formErrors.guardianName}</p>}
                </div>
                <div>
                  <Label htmlFor="guardianIncome">Guardian Income (₹)</Label>
                  <Input id="guardianIncome" type="number" value={loanForm.guardianIncome} onChange={(e) => setLoanForm({...loanForm, guardianIncome: e.target.value})} placeholder="Guardian income" min="0" />
                </div>
              </div>
            )}

            {loanForm.employmentType === 'Retired' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h5 className="sm:col-span-2 font-medium text-gray-800 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Retired Person Details
                </h5>
                <div>
                  <Label htmlFor="previousEmployer">Previous Employer *</Label>
                  <Input id="previousEmployer" className={inputClass('previousEmployer')} value={loanForm.previousEmployer} onChange={(e) => setLoanForm({...loanForm, previousEmployer: e.target.value})} placeholder="Last employer name" />
                  {formErrors.previousEmployer && <p className="text-xs text-red-500 mt-1">{formErrors.previousEmployer}</p>}
                </div>
                <div>
                  <Label htmlFor="designation">Last Designation</Label>
                  <Input id="designation" value={loanForm.designation} onChange={(e) => setLoanForm({...loanForm, designation: e.target.value})} placeholder="Last position" />
                </div>
                <div>
                  <Label htmlFor="retirementDate">Retirement Date</Label>
                  <Input id="retirementDate" type="date" value={loanForm.retirementDate} onChange={(e) => setLoanForm({...loanForm, retirementDate: e.target.value})} />
                </div>
                <div>
                  <Label htmlFor="pensionAmount">Monthly Pension (₹) *</Label>
                  <Input id="pensionAmount" type="number" className={inputClass('pensionAmount')} value={loanForm.pensionAmount} onChange={(e) => setLoanForm({...loanForm, pensionAmount: e.target.value})} placeholder="Pension amount" min="0" />
                  {formErrors.pensionAmount && <p className="text-xs text-red-500 mt-1">{formErrors.pensionAmount}</p>}
                </div>
                <div>
                  <Label htmlFor="monthlyIncome">Other Monthly Income (₹)</Label>
                  <Input id="monthlyIncome" type="number" value={loanForm.monthlyIncome} onChange={(e) => setLoanForm({...loanForm, monthlyIncome: e.target.value})} placeholder="Other income" min="0" />
                </div>
              </div>
            )}

            {loanForm.employmentType === 'Unemployed' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-red-50 rounded-xl border border-red-100">
                <h5 className="sm:col-span-2 font-medium text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Unemployed Details
                </h5>
                <div>
                  <Label htmlFor="sourceOfFunds">Source of Funds *</Label>
                  <Select value={loanForm.sourceOfFunds} onValueChange={(v) => setLoanForm({...loanForm, sourceOfFunds: v})}>
                    <SelectTrigger className={inputClass('sourceOfFunds')}><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Family Support">Family Support</SelectItem>
                      <SelectItem value="Savings">Savings</SelectItem>
                      <SelectItem value="Rental Income">Rental Income</SelectItem>
                      <SelectItem value="Investment">Investment Returns</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.sourceOfFunds && <p className="text-xs text-red-500 mt-1">{formErrors.sourceOfFunds}</p>}
                </div>
                <div>
                  <Label htmlFor="monthlySupportAmount">Monthly Support Amount (₹)</Label>
                  <Input id="monthlySupportAmount" type="number" value={loanForm.monthlySupportAmount} onChange={(e) => setLoanForm({...loanForm, monthlySupportAmount: e.target.value})} placeholder="Amount" min="0" />
                </div>
                <div>
                  <Label htmlFor="supportProviderName">Support Provider Name</Label>
                  <Input id="supportProviderName" value={loanForm.supportProviderName} onChange={(e) => setLoanForm({...loanForm, supportProviderName: e.target.value})} placeholder="Who supports you" />
                </div>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Banknote className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-lg">Bank Details</h4>
            </div>
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 text-sm">
                Loan amount will be disbursed to this bank account. Verify details carefully.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bankAccountNumber">Account Number *</Label>
                <Input id="bankAccountNumber" className={inputClass('bankAccountNumber')} value={loanForm.bankAccountNumber} onChange={(e) => setLoanForm({...loanForm, bankAccountNumber: e.target.value})} placeholder="Account number" />
                {formErrors.bankAccountNumber && <p className="text-xs text-red-500 mt-1">{formErrors.bankAccountNumber}</p>}
              </div>
              <div>
                <Label htmlFor="accountType">Account Type</Label>
                <Select value={loanForm.accountType} onValueChange={(v) => setLoanForm({...loanForm, accountType: v})}>
                  <SelectTrigger id="accountType"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Savings">Savings</SelectItem>
                    <SelectItem value="Current">Current</SelectItem>
                    <SelectItem value="Salary">Salary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bankIfsc">IFSC Code *</Label>
                <Input id="bankIfsc" className={inputClass('bankIfsc')} value={loanForm.bankIfsc} onChange={(e) => setLoanForm({...loanForm, bankIfsc: e.target.value.toUpperCase()})} placeholder="SBIN0001234" maxLength={11} />
                {formErrors.bankIfsc && <p className="text-xs text-red-500 mt-1">{formErrors.bankIfsc}</p>}
              </div>
              <div>
                <Label htmlFor="bankName">Bank Name *</Label>
                <Input id="bankName" className={inputClass('bankName')} value={loanForm.bankName} onChange={(e) => setLoanForm({...loanForm, bankName: e.target.value})} placeholder="Bank name" />
                {formErrors.bankName && <p className="text-xs text-red-500 mt-1">{formErrors.bankName}</p>}
              </div>
              <div className="sm:col-span-2 pt-2">
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <Checkbox id="bankVerified" checked={loanForm.bankVerified} onCheckedChange={(checked) => setLoanForm({...loanForm, bankVerified: checked as boolean})} />
                  <label htmlFor="bankVerified" className="text-sm font-medium cursor-pointer">Bank Account Verified (Check passed)</label>
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-lg">Guardians</h4>
            </div>
            <p className="text-sm text-gray-500">Add at least two guardians for verification purposes.</p>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h5 className="font-medium mb-3 text-gray-700">Guardian 1</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ref1Name">Full Name</Label>
                    <Input id="ref1Name" value={loanForm.ref1Name} onChange={(e) => setLoanForm({...loanForm, ref1Name: e.target.value})} placeholder="Reference name" />
                  </div>
                  <div>
                    <Label htmlFor="ref1Phone">Phone Number</Label>
                    <Input id="ref1Phone" className={inputClass('ref1Phone')} value={loanForm.ref1Phone} onChange={(e) => setLoanForm({...loanForm, ref1Phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} placeholder="10-digit number" maxLength={10} />
                    {formErrors.ref1Phone && <p className="text-xs text-red-500 mt-1">{formErrors.ref1Phone}</p>}
                  </div>
                  <div>
                    <Label htmlFor="ref1Relation">Relationship</Label>
                    <Select value={loanForm.ref1Relation} onValueChange={(v) => setLoanForm({...loanForm, ref1Relation: v})}>
                      <SelectTrigger id="ref1Relation"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="family">Family Member</SelectItem>
                        <SelectItem value="friend">Friend</SelectItem>
                        <SelectItem value="colleague">Colleague</SelectItem>
                        <SelectItem value="neighbor">Neighbor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ref1Address">Address</Label>
                    <Input id="ref1Address" value={loanForm.ref1Address} onChange={(e) => setLoanForm({...loanForm, ref1Address: e.target.value})} placeholder="Address" />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h5 className="font-medium mb-3 text-gray-700">Guardian 2</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ref2Name">Full Name</Label>
                    <Input id="ref2Name" value={loanForm.ref2Name} onChange={(e) => setLoanForm({...loanForm, ref2Name: e.target.value})} placeholder="Reference name" />
                  </div>
                  <div>
                    <Label htmlFor="ref2Phone">Phone Number</Label>
                    <Input id="ref2Phone" className={inputClass('ref2Phone')} value={loanForm.ref2Phone} onChange={(e) => setLoanForm({...loanForm, ref2Phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} placeholder="10-digit number" maxLength={10} />
                    {formErrors.ref2Phone && <p className="text-xs text-red-500 mt-1">{formErrors.ref2Phone}</p>}
                  </div>
                  <div>
                    <Label htmlFor="ref2Relation">Relationship</Label>
                    <Select value={loanForm.ref2Relation} onValueChange={(v) => setLoanForm({...loanForm, ref2Relation: v})}>
                      <SelectTrigger id="ref2Relation"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="family">Family Member</SelectItem>
                        <SelectItem value="friend">Friend</SelectItem>
                        <SelectItem value="colleague">Colleague</SelectItem>
                        <SelectItem value="neighbor">Neighbor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ref2Address">Address</Label>
                    <Input id="ref2Address" value={loanForm.ref2Address} onChange={(e) => setLoanForm({...loanForm, ref2Address: e.target.value})} placeholder="Address" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-lg">Document Upload</h4>
            </div>
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 text-sm">
                Upload clear scanned copies or photos. Supported formats: PNG, JPG, WEBP, PDF. Max size: 10MB.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {DOCUMENT_TYPES.map((doc) => {
                const uploaded = uploadedDocs[doc.id];
                const isUploading = uploadingDoc === doc.id;
                
                return (
                  <div key={doc.id} className="relative">
                    <input
                      type="file"
                      id={`doc-${doc.id}`}
                      className="hidden"
                      accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDocumentUpload(doc.id, file);
                        e.target.value = ''; // Reset for re-upload
                      }}
                      disabled={isUploading}
                    />
                    <label
                      htmlFor={`doc-${doc.id}`}
                      className={`block p-4 border-2 rounded-xl text-center transition-all cursor-pointer ${
                        uploaded
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50'
                      } ${isUploading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                      {uploaded ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                          <p className="text-sm font-medium text-emerald-700">{doc.name}</p>
                          <p className="text-xs text-emerald-600 truncate max-w-full">{uploaded.name}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveDocument(doc.id);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : isUploading ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-2" />
                          <p className="text-sm font-medium text-gray-600">Uploading...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-gray-500">{doc.desc}</p>
                          {doc.required && (
                            <span className="text-xs text-red-500 mt-1">*Required</span>
                          )}
                        </div>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
            
            {/* Upload Summary */}
            {Object.keys(uploadedDocs).length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>{Object.keys(uploadedDocs).length}</strong> of {DOCUMENT_TYPES.filter(d => d.required).length} required documents uploaded
                </p>
              </div>
            )}
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-lg">Applicant Signature</h4>
            </div>
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 text-sm">
                The applicant can sign below using mouse or touch. This signature will be included in the loan application form.
              </AlertDescription>
            </Alert>
            
            {/* Signature Canvas */}
            <div className="space-y-3">
              <Label>Applicant Signature</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50">
                <canvas 
                  id="signatureCanvas"
                  className="w-full h-40 bg-white border border-gray-200 rounded-lg cursor-crosshair"
                  onMouseDown={(e) => {
                    const canvas = e.target as HTMLCanvasElement;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.beginPath();
                      ctx.strokeStyle = '#1a1a1a';
                      ctx.lineWidth = 2;
                      ctx.lineCap = 'round';
                      const rect = canvas.getBoundingClientRect();
                      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                    }
                  }}
                  onMouseMove={(e) => {
                    if (e.buttons !== 1) return;
                    const canvas = e.target as HTMLCanvasElement;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      const rect = canvas.getBoundingClientRect();
                      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                      ctx.stroke();
                    }
                  }}
                  onMouseUp={() => {
                    const canvas = document.getElementById('signatureCanvas') as HTMLCanvasElement;
                    if (canvas) {
                      const dataUrl = canvas.toDataURL();
                      setLoanForm({...loanForm, applicantSignature: dataUrl});
                    }
                  }}
                  onTouchStart={(e) => {
                    const canvas = e.target as HTMLCanvasElement;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.beginPath();
                      ctx.strokeStyle = '#1a1a1a';
                      ctx.lineWidth = 2;
                      ctx.lineCap = 'round';
                      const rect = canvas.getBoundingClientRect();
                      const touch = e.touches[0];
                      ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                    }
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    const canvas = e.target as HTMLCanvasElement;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      const rect = canvas.getBoundingClientRect();
                      const touch = e.touches[0];
                      ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
                      ctx.stroke();
                    }
                  }}
                  onTouchEnd={() => {
                    const canvas = document.getElementById('signatureCanvas') as HTMLCanvasElement;
                    if (canvas) {
                      const dataUrl = canvas.toDataURL();
                      setLoanForm({...loanForm, applicantSignature: dataUrl});
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const canvas = document.getElementById('signatureCanvas') as HTMLCanvasElement;
                    if (canvas) {
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        setLoanForm({...loanForm, applicantSignature: ''});
                      }
                    }
                  }}
                >
                  Clear Signature
                </Button>
                {loanForm.applicantSignature && (
                  <Badge className="bg-green-100 text-green-700">Signature Captured</Badge>
                )}
              </div>
            </div>
            
            {/* Declaration */}
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-start gap-2">
                <Checkbox id="declaration" className="mt-1" />
                <label htmlFor="declaration" className="text-sm text-gray-700">
                  I hereby declare that the information provided above is true and correct to the best of my knowledge. 
                  I understand that providing false information may result in rejection of my loan application and/or 
                  legal action.
                </label>
              </div>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-lg">Review & Submit</h4>
            </div>
            
            {submitError && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">{submitError}</AlertDescription>
              </Alert>
            )}

            {/* Verification Checklist */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <h5 className="font-medium mb-3">Verification Checklist</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: 'PAN Verified', checked: loanForm.panVerified },
                  { label: 'Aadhaar Verified', checked: loanForm.aadhaarVerified },
                  { label: 'Bank Verified', checked: loanForm.bankVerified },
                  { label: 'Employment Added', checked: !!loanForm.employmentType },
                  { label: 'Address Filled', checked: !!loanForm.address },
                  { label: 'Guardians Added', checked: !!(loanForm.ref1Name || loanForm.ref2Name) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <CheckCircle className={`h-4 w-4 ${item.checked ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className={item.checked ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Summary */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-gray-500">Applicant</p>
                <p className="font-medium">{loanForm.firstName} {loanForm.lastName}</p>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-gray-500">PAN</p>
                <p className="font-medium">{loanForm.panNumber || 'N/A'}</p>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-gray-500">Monthly Income</p>
                <p className="font-medium">{loanForm.monthlyIncome ? `₹${parseInt(loanForm.monthlyIncome).toLocaleString()}` : 'N/A'}</p>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-gray-500">Employment</p>
                <p className="font-medium">{loanForm.employmentType || 'N/A'}</p>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <Label htmlFor="remarks">Verification Remarks</Label>
              <Textarea id="remarks" value={loanForm.verificationRemarks} onChange={(e) => setLoanForm({...loanForm, verificationRemarks: e.target.value})} placeholder="Add any notes or remarks about the verification..." rows={3} />
              {formErrors.verificationRemarks && <p className="text-xs text-red-500 mt-1">{formErrors.verificationRemarks}</p>}
            </div>

            {/* Risk Assessment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="riskScore">Risk Score (0-100)</Label>
                <Input id="riskScore" type="number" min="0" max="100" value={loanForm.riskScore} onChange={(e) => setLoanForm({...loanForm, riskScore: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))})} />
                <p className="text-xs text-gray-500 mt-1">0 = Low Risk, 100 = High Risk</p>
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg border border-red-200">
                  <Checkbox id="fraudFlag" checked={loanForm.fraudFlag} onCheckedChange={(checked) => setLoanForm({...loanForm, fraudFlag: checked as boolean})} />
                  <label htmlFor="fraudFlag" className="text-sm font-medium text-red-600 cursor-pointer">Flag as Potential Fraud</label>
                </div>
              </div>
            </div>

            {/* Credit Score */}
            <div className="mt-4">
              <Label htmlFor="creditScore">Credit Score</Label>
              <Input id="creditScore" type="number" min="300" max="900" placeholder="Enter credit score (300-900)" value={loanForm.creditScore || ''} onChange={(e) => setLoanForm({...loanForm, creditScore: parseInt(e.target.value) || 0})} />
              <p className="text-xs text-gray-500 mt-1">Customer's credit score (CIBIL score: 300-900)</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'pending':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-orange-600" />
                Pending Loan Forms
              </CardTitle>
              <CardDescription>Applications waiting for you to complete the loan form</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLoans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">All caught up!</p>
                  <p className="text-sm">No pending loan forms to complete</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingLoans.map((loan, index) => (
                    <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                      className="p-4 border border-gray-100 rounded-xl bg-white hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 bg-gradient-to-br from-orange-400 to-red-500">
                          <AvatarFallback className="bg-transparent text-white font-semibold">
                            {loan.customer?.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
                          <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.email}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatDate(loan.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
                          <p className="text-xs text-gray-500">{loan.loanType}</p>
                        </div>
                        <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => openLoanFormDialog(loan)}>
                          <FileEdit className="h-4 w-4 mr-2" />Fill Form
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'completed':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Completed Forms
              </CardTitle>
              <CardDescription>Loan forms you have completed</CardDescription>
            </CardHeader>
            <CardContent>
              {completedLoans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No completed forms yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedLoans.map((loan, index) => (
                    <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                      className="p-4 border border-gray-100 rounded-xl bg-white flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 bg-green-100">
                          <AvatarFallback className="text-green-700">{loan.customer?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold">{loan.applicationNo}</h4>
                          <p className="text-sm text-gray-500">{loan.customer?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(loan.status)}
                        <p className="font-semibold">{formatCurrency(loan.requestedAmount)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'activeLoans':
        return (
          <div className="space-y-6">
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                  Active Loans
                </CardTitle>
                <CardDescription>All active loans - Click View to see details and pay EMI</CardDescription>
              </CardHeader>
            <CardContent>
              {activeLoans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Banknote className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No active loans found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {activeLoans.map((loan: any, index: number) => (
                    <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                      className="p-4 border border-gray-100 rounded-xl bg-white hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 bg-gradient-to-br from-emerald-400 to-teal-500">
                          <AvatarFallback className="bg-transparent text-white font-semibold">
                            {loan.customer?.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-gray-900">{loan.identifier}</h4>
                          <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.phone || loan.customer?.email}</p>
                          {loan.company && <p className="text-xs text-gray-400">Company: {loan.company.name}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.approvedAmount)}</p>
                          <p className="text-xs text-gray-500">{loan.interestRate}% • {loan.tenure} months</p>
                          {loan.emiAmount > 0 && <p className="text-xs text-emerald-600">EMI: {formatCurrency(loan.emiAmount)}/mo</p>}
                        </div>
                        <Button
                          size="sm"
                          className="bg-emerald-500 hover:bg-emerald-600"
                          onClick={() => { setSelectedLoanId(loan.id); setShowLoanDetailPanel(true); }}
                        >
                          <Eye className="h-4 w-4 mr-1" />View
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        );

      case 'payment-pages':
        return (
          <div className="space-y-6">
            <SecondaryPaymentPagesSection userId={user?.id} />
          </div>
        );

      case 'field':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-teal-600" />
                Field Visits
              </CardTitle>
              <CardDescription>Track and manage field visit assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <Navigation className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Field Visit Tracking</p>
                <p className="text-sm mt-2">Field visit management features coming soon</p>
                <p className="text-xs text-gray-400 mt-1">You'll be able to view assigned visits, update statuses, and capture location data</p>
              </div>
            </CardContent>
          </Card>
        );

      case 'myCredit':
        return <MyCreditPassbook />;

      case 'dashboard':
      default:
        return (
          <div className="space-y-6">
            {/* Pending Alert */}
            {pendingLoans.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <FileEdit className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-orange-800">{pendingLoans.length} Loan Form{pendingLoans.length > 1 ? 's' : ''} Pending</h4>
                      <p className="text-sm text-orange-600">Complete the forms to move loans forward</p>
                    </div>
                    <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setActiveTab('pending')}>
                      Start Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {loans.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No loans assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {loans.slice(0, 5).map((loan) => (
                      <div key={loan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-orange-100 text-orange-700">{loan.customer?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{loan.applicationNo}</p>
                            <p className="text-sm text-gray-500">{loan.customer?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(loan.status)}
                          <p className="font-semibold hidden sm:block">{formatCurrency(loan.requestedAmount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <DashboardLayout
      title="Staff Dashboard"
      subtitle="Complete loan application forms"
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      stats={stats}
      gradient="bg-gradient-to-br from-orange-500 to-red-600"
      logoIcon={User}
    >
      {renderContent()}

      {/* Loan Form Wizard Dialog */}
      <Dialog open={showLoanFormDialog} onOpenChange={setShowLoanFormDialog}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[95vh] p-0 gap-0">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-6 border-b bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl text-white">Loan Application Form</DialogTitle>
                <DialogDescription className="text-emerald-100">
                  {selectedLoan?.applicationNo} • {selectedLoan?.customer?.name} • {selectedLoan ? formatCurrency(selectedLoan.requestedAmount) : ''}
                </DialogDescription>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-emerald-100">Step {currentStep} of {STEPS.length}</p>
                <p className="text-sm font-medium">{STEPS[currentStep - 1].title}</p>
              </div>
            </div>
          </DialogHeader>

          {/* Step Indicators */}
          <div className="px-4 sm:px-6 py-3 border-b bg-gray-50 overflow-x-auto">
            <div className="flex items-center justify-between min-w-max gap-1">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                        currentStep === step.id 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : currentStep > step.id 
                            ? 'text-emerald-600 cursor-pointer hover:bg-emerald-50' 
                            : 'text-gray-400'
                      }`}
                      disabled={currentStep <= step.id}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        currentStep > step.id 
                          ? 'bg-emerald-500 text-white' 
                          : currentStep === step.id 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-gray-200 text-gray-400'
                      }`}>
                        {currentStep > step.id ? <CheckCircle className="h-4 w-4" /> : step.id}
                      </div>
                      <span className="text-xs sm:text-sm font-medium hidden md:inline">{step.title}</span>
                    </button>
                    {index < STEPS.length - 1 && (
                      <div className={`w-4 sm:w-8 h-0.5 mx-1 ${currentStep > step.id ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Content */}
          <ScrollArea className="flex-1 max-h-[50vh] sm:max-h-[55vh]">
            <div className="p-4 sm:p-6">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentStep} 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Footer */}
          <DialogFooter className="p-4 sm:p-6 border-t bg-gray-50 rounded-b-lg">
            <div className="flex items-center justify-between w-full gap-2">
              <div>
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handlePrevStep}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Previous
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowLoanFormDialog(false)}>Cancel</Button>
                {currentStep < STEPS.length ? (
                  <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleNextStep}>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={handleReject} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Reject
                    </Button>
                    <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleCompleteForm} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Submit Form
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan Details Dialog */}
      <Dialog open={showLoanDetailsDialog} onOpenChange={setShowLoanDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
            <DialogDescription>{selectedLoan?.applicationNo}</DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-semibold">{selectedLoan.customer?.name}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-semibold">{formatCurrency(selectedLoan.requestedAmount)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Loan Detail Panel */}
      <LoanDetailPanel
        loanId={selectedLoanId}
        open={showLoanDetailPanel}
        onClose={() => { setShowLoanDetailPanel(false); setSelectedLoanId(null); }}
        userRole={user?.role || 'STAFF'}
        userId={user?.id || ''}
        onPaymentSuccess={() => { fetchLoans(); fetchActiveLoans(); }}
      />
    </DashboardLayout>
  );
}
