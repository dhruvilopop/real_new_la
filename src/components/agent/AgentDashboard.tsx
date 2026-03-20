'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { User, FileText, CheckCircle, XCircle, Clock, Users, Wallet, Eye, TrendingUp, DollarSign, UserPlus, Calculator, Settings, Percent, Calendar, IndianRupee, ClipboardCheck, X, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate, calculateEMI } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import EMICollectionSection from '@/components/emi/EMICollectionSection';
import EMICalendar from '@/components/emi/EMICalendar';
import OfflineLoanForm from '@/components/offline-loan/OfflineLoanForm';
import OfflineLoansList from '@/components/offline-loan/OfflineLoansList';
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
}

interface Staff {
  id: string; name: string; email: string; staffCode: string; isActive: boolean;
}

export default function AgentDashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showSanctionDialog, setShowSanctionDialog] = useState(false);
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [showLoanDetailsDialog, setShowLoanDetailsDialog] = useState(false);
  const [showLoanDetailPanel, setShowLoanDetailPanel] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [remarks, setRemarks] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [saving, setSaving] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '' });
  
  // Bulk selection state
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [showBulkApprovalDialog, setShowBulkApprovalDialog] = useState(false);
  const [bulkApprovalAction, setBulkApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [bulkStaffId, setBulkStaffId] = useState<string>('');
  const [bulkSaving, setBulkSaving] = useState(false);
  
  // Sanction form state
  const [sessionForm, setSessionForm] = useState({
    approvedAmount: 0,
    interestRate: 12,
    tenure: 12,
    processingFee: 1,
    processingFeeType: 'PERCENTAGE',
    specialConditions: ''
  });
  const [calculatedEMI, setCalculatedEMI] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (sessionForm.approvedAmount && sessionForm.interestRate && sessionForm.tenure) {
      const calc = calculateEMI(sessionForm.approvedAmount, sessionForm.interestRate, sessionForm.tenure);
      setCalculatedEMI(calc);
    }
  }, [sessionForm.approvedAmount, sessionForm.interestRate, sessionForm.tenure]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch loans for this agent with role parameter
      const loansRes = await fetch(`/api/loan/list?role=AGENT&agentId=${user.id}`);
      const loansData = await loansRes.json();
      setLoans(loansData.loans || []);

      // Fetch staff under this agent
      const usersRes = await fetch('/api/user');
      const usersData = await usersRes.json();
      const myStaff = (usersData.users || [])
        .filter((u: any) => u.role === 'STAFF' && u.agentId === user.id)
        .map((u: any) => ({
          id: u.id, name: u.name, email: u.email, 
          staffCode: u.staffCode || 'N/A', isActive: u.isActive
        }));
      setStaffList(myStaff);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!selectedLoan) return;
    if (approvalAction === 'approve' && !selectedStaffId) {
      toast({ title: 'Staff Required', description: 'Please select a staff member to assign this loan.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoan.id, 
          action: approvalAction, 
          remarks, 
          role: 'AGENT',
          userId: user?.id || 'system', 
          staffId: approvalAction === 'approve' ? selectedStaffId : undefined
        })
      });
      if (response.ok) {
        toast({ 
          title: approvalAction === 'approve' ? 'Loan Approved' : 'Loan Rejected', 
          description: `Application ${selectedLoan.applicationNo} has been ${approvalAction}d.` 
        });
        setShowApprovalDialog(false);
        setRemarks('');
        setSelectedStaffId('');
        fetchData();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to process', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to process approval', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSanction = async () => {
    if (!selectedLoan) return;
    if (!sessionForm.approvedAmount || !sessionForm.interestRate || !sessionForm.tenure) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanApplicationId: selectedLoan.id,
          agentId: user?.id,
          approvedAmount: sessionForm.approvedAmount,
          interestRate: sessionForm.interestRate,
          tenure: sessionForm.tenure,
          processingFee: sessionForm.processingFee,
          processingFeeType: sessionForm.processingFeeType,
          specialConditions: sessionForm.specialConditions
        })
      });
      if (response.ok) {
        toast({ title: 'Success', description: 'Loan session created successfully!' });
        setShowSanctionDialog(false);
        setSessionForm({ approvedAmount: 0, interestRate: 12, tenure: 12, processingFee: 1, processingFeeType: 'PERCENTAGE', specialConditions: '' });
        fetchData();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to create sanction', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create sanction', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStaff = async () => {
    if (!staffForm.name || !staffForm.email || !staffForm.password) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...staffForm,
          role: 'STAFF',
          agentId: user?.id
        })
      });
      if (response.ok) {
        toast({ title: 'Success', description: 'Staff member created successfully' });
        setShowStaffDialog(false);
        setStaffForm({ name: '', email: '', password: '' });
        fetchData();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to create staff', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create staff', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openSanctionDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setSessionForm({
      approvedAmount: loan.requestedAmount,
      interestRate: 12,
      tenure: loan.requestedTenure || 12,
      processingFee: 1,
      processingFeeType: 'PERCENTAGE',
      specialConditions: ''
    });
    setShowSanctionDialog(true);
  };

  // Bulk selection handlers
  const handleSelectLoan = (loanId: string) => {
    setSelectedLoanIds(prev => 
      prev.includes(loanId) 
        ? prev.filter(id => id !== loanId)
        : [...prev, loanId]
    );
  };

  const handleSelectAll = (loanIds: string[]) => {
    if (selectedLoanIds.length === loanIds.length) {
      setSelectedLoanIds([]);
    } else {
      setSelectedLoanIds(loanIds);
    }
  };

  const clearSelection = () => {
    setSelectedLoanIds([]);
    setBulkStaffId('');
  };

  // Bulk approval handler
  const handleBulkApproval = async () => {
    if (selectedLoanIds.length === 0) return;
    
    if (bulkApprovalAction === 'approve' && !bulkStaffId) {
      toast({ title: 'Staff Required', description: 'Please select a staff member to assign the loans.', variant: 'destructive' });
      return;
    }
    
    setBulkSaving(true);
    try {
      const response = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanIds: selectedLoanIds,
          action: bulkApprovalAction,
          role: 'AGENT',
          userId: user?.id || 'system',
          staffId: bulkApprovalAction === 'approve' ? bulkStaffId : undefined,
          isBulk: true
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({ 
          title: bulkApprovalAction === 'approve' ? 'Loans Approved' : 'Loans Rejected', 
          description: `${data.successCount} applications have been ${bulkApprovalAction}d successfully.` 
        });
        setShowBulkApprovalDialog(false);
        clearSelection();
        fetchData();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to process bulk approval', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Bulk approval error:', error);
      toast({ title: 'Error', description: 'Failed to process bulk approval. Please try again.', variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      SUBMITTED: { className: 'bg-blue-100 text-blue-700', label: 'New' },
      SA_APPROVED: { className: 'bg-emerald-100 text-emerald-700', label: 'SA Approved' },
      COMPANY_APPROVED: { className: 'bg-teal-100 text-teal-700', label: 'Company Approved' },
      AGENT_APPROVED_STAGE1: { className: 'bg-cyan-100 text-cyan-700', label: 'Agent Approved' },
      LOAN_FORM_COMPLETED: { className: 'bg-violet-100 text-violet-700', label: 'Form Complete' },
      SESSION_CREATED: { className: 'bg-amber-100 text-amber-700', label: 'Sanction Created' },
      CUSTOMER_SESSION_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Customer Approved' },
      FINAL_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Final Approved' },
      DISBURSED: { className: 'bg-green-100 text-green-700', label: 'Disbursed' },
      ACTIVE: { className: 'bg-green-100 text-green-700', label: 'Active' },
      REJECTED_BY_SA: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
      REJECTED_BY_COMPANY: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
      REJECTED_FINAL: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  // Filter loans
  // Include both COMPANY_APPROVED and SA_APPROVED loans assigned to this agent
  const pendingForAgent = loans.filter(l => 
    l.status === 'COMPANY_APPROVED' || 
    (l.status === 'SA_APPROVED' && l.currentHandlerId === user?.id)
  );
  const formCompleted = loans.filter(l => l.status === 'LOAN_FORM_COMPLETED');
  const sanctionCreated = loans.filter(l => l.status === 'SESSION_CREATED');
  const inProgress = loans.filter(l => ['AGENT_APPROVED_STAGE1'].includes(l.status));
  const activeLoans = loans.filter(l => ['ACTIVE', 'DISBURSED', 'CUSTOMER_SESSION_APPROVED', 'FINAL_APPROVED'].includes(l.status));

  const stats = [
    { label: 'Pending Approvals', value: pendingForAgent.length, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', onClick: () => setActiveTab('pending') },
    { label: 'Awaiting Sanction', value: formCompleted.length, icon: ClipboardCheck, color: 'text-violet-600', bg: 'bg-violet-50', onClick: () => setActiveTab('session') },
    { label: 'In Progress', value: inProgress.length, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => setActiveTab('active') },
    { label: 'Active Loans', value: activeLoans.length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', onClick: () => setActiveTab('active') }
  ];

  const menuItems = ROLE_MENU_ITEMS.AGENT.map(item => ({
    ...item,
    count: item.id === 'pending' ? pendingForAgent.length : 
           item.id === 'session' ? formCompleted.length :
           item.id === 'staff' ? staffList.length :
           item.id === 'active' ? activeLoans.length : undefined
  }));

  const renderLoanCard = (loan: Loan, index: number, actions?: React.ReactNode) => (
    <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
      className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all bg-white">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 bg-gradient-to-br from-cyan-400 to-blue-500">
            <AvatarFallback className="bg-transparent text-white font-semibold">
              {loan.customer?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
              {getStatusBadge(loan.status)}
            </div>
            <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.email}</p>
            <p className="text-xs text-gray-400 mt-1">{formatDate(loan.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
            <p className="text-xs text-gray-500">{loan.loanType}</p>
          </div>
          {actions || (
            <Button size="sm" variant="outline" onClick={() => { setSelectedLoanId(loan.id); setShowLoanDetailPanel(true); }}>
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'pending':
        const pendingLoanIds = pendingForAgent.map(l => l.id);
        return (
          <div className="space-y-4">
            {/* Bulk Action Bar */}
            {selectedLoanIds.length > 0 && (
              <Card className="bg-cyan-50 border-cyan-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-cyan-600 text-white text-sm px-3 py-1">
                        {selectedLoanIds.length} selected
                      </Badge>
                      <span className="text-sm text-cyan-700">
                        {formatCurrency(selectedLoanIds.reduce((sum, id) => {
                          const loan = pendingForAgent.find(l => l.id === id);
                          return sum + (loan?.requestedAmount || 0);
                        }, 0))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => { setBulkApprovalAction('reject'); setShowBulkApprovalDialog(true); }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />Reject All
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-cyan-500 hover:bg-cyan-600"
                        onClick={() => { setBulkApprovalAction('approve'); setShowBulkApprovalDialog(true); }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />Approve All
                      </Button>
                      <Button size="sm" variant="ghost" onClick={clearSelection}>
                        <X className="h-4 w-4 mr-1" />Clear
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card className="bg-white shadow-sm border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-orange-600" />Pending Approvals
                    </CardTitle>
                    <CardDescription>Applications approved by Company. Assign a staff member to verify.</CardDescription>
                  </div>
                  {pendingForAgent.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-agent"
                        checked={selectedLoanIds.length === pendingLoanIds.length && pendingLoanIds.length > 0}
                        onCheckedChange={() => handleSelectAll(pendingLoanIds)}
                      />
                      <Label htmlFor="select-all-agent" className="text-sm font-medium cursor-pointer">
                        Select All ({pendingForAgent.length})
                      </Label>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pendingForAgent.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>No pending applications</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingForAgent.map((loan, index) => (
                      <motion.div 
                        key={loan.id} 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: index * 0.03 }}
                        className={`p-4 border rounded-xl hover:bg-gray-50 transition-all bg-white ${
                          selectedLoanIds.includes(loan.id) ? 'border-cyan-300 bg-cyan-50' : 'border-gray-100'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <Checkbox
                              checked={selectedLoanIds.includes(loan.id)}
                              onCheckedChange={() => handleSelectLoan(loan.id)}
                            />
                            <Avatar className="h-12 w-12 bg-gradient-to-br from-cyan-400 to-blue-500">
                              <AvatarFallback className="bg-transparent text-white font-semibold">
                                {loan.customer?.name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
                                {getStatusBadge(loan.status)}
                              </div>
                              <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.email}</p>
                              <p className="text-xs text-gray-400 mt-1">{formatDate(loan.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
                              <p className="text-xs text-gray-500">{loan.loanType}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setSelectedLoan(loan); setShowLoanDetailsDialog(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" 
                                onClick={() => { setSelectedLoan(loan); setApprovalAction('reject'); setShowApprovalDialog(true); }}>
                                <XCircle className="h-4 w-4 mr-1" />Reject
                              </Button>
                              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" 
                                onClick={() => { setSelectedLoan(loan); setApprovalAction('approve'); setShowApprovalDialog(true); }}>
                                <CheckCircle className="h-4 w-4 mr-1" />Approve
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'session':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-violet-600" />Create Sanction
              </CardTitle>
              <CardDescription>Applications with completed verification. Create loan sanction for customer approval.</CardDescription>
            </CardHeader>
            <CardContent>
              {formCompleted.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No applications awaiting sanction creation</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formCompleted.map((loan, index) => renderLoanCard(loan, index,
                    <Button size="sm" className="bg-violet-500 hover:bg-violet-600" onClick={() => openSanctionDialog(loan)}>
                      <Calculator className="h-4 w-4 mr-1" />Create Sanction
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'staff':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Staff Management</CardTitle>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowStaffDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />Add Staff
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {staffList.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No staff members created yet</p>
                  <Button className="mt-4 bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowStaffDialog(true)}>
                    Create First Staff
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {staffList.map((staff, index) => (
                    <motion.div key={staff.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                      className="p-4 border border-gray-100 rounded-xl bg-white flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-cyan-100 text-cyan-700">{staff.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold">{staff.name}</h4>
                          <p className="text-sm text-gray-500">{staff.email}</p>
                          <p className="text-xs text-gray-400">Code: {staff.staffCode}</p>
                        </div>
                      </div>
                      <Badge className={staff.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {staff.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'active':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle>Active & Completed Loans</CardTitle>
            </CardHeader>
            <CardContent>
              {activeLoans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No active loans</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeLoans.map((loan, index) => renderLoanCard(loan, index))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'emi-collection':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">EMI Collection</h2>
                <p className="text-gray-500">Today's EMI collection and tracking</p>
              </div>
            </div>
            <EMICollectionSection 
              userId={user?.id || ''} 
              userRole={user?.role || 'AGENT'}
              onPaymentComplete={() => {
                toast({ title: 'Payment Collected', description: 'EMI payment collected and credit updated' });
              }}
            />
            
            {/* Secondary Payment Pages Section */}
            <SecondaryPaymentPagesSection userId={user?.id} />
          </div>
        );

      case 'emi-calendar':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">EMI Calendar</h2>
                <p className="text-gray-500">View and manage EMIs by date</p>
              </div>
            </div>
            <EMICalendar 
              userId={user?.id || ''} 
              userRole={user?.role || 'AGENT'}
            />
          </div>
        );

      case 'offline-loans':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Offline Loans</h2>
                <p className="text-gray-500">Create and manage offline loans</p>
              </div>
              <OfflineLoanForm 
                createdById={user?.id || ''} 
                createdByRole={user?.role || 'AGENT'}
                companyId={user?.companyId || ''}
                onLoanCreated={() => {
                  toast({ title: 'Loan Created', description: 'Offline loan created successfully' });
                }}
              />
            </div>
            <OfflineLoansList 
              userId={user?.id}
              userRole={user?.role || 'AGENT'}
            />
          </div>
        );

      case 'calculator':
        return <EMICalculatorSection />;

      case 'myCredit':
        return <MyCreditPassbook />;

      case 'performance':
        return (
          <div className="space-y-6">
            {/* Performance Stats */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Processed</p>
                      <p className="text-2xl font-bold text-gray-900">{loans.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Approved</p>
                      <p className="text-2xl font-bold text-green-600">{activeLoans.length + sanctionCreated.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">In Progress</p>
                      <p className="text-2xl font-bold text-orange-600">{pendingForAgent.length + formCompleted.length + inProgress.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                      <Clock className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Staff Members</p>
                      <p className="text-2xl font-bold text-cyan-600">{staffList.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-cyan-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Performance Overview
                </CardTitle>
                <CardDescription>Your loan processing statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Approval Rate */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Approval Rate</span>
                      <span className="text-sm text-gray-500">
                        {loans.length > 0 ? Math.round(((activeLoans.length + sanctionCreated.length) / loans.length) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${loans.length > 0 ? Math.round(((activeLoans.length + sanctionCreated.length) / loans.length) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Processing Rate */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Processing Rate</span>
                      <span className="text-sm text-gray-500">
                        {loans.length > 0 ? Math.round(((loans.length - pendingForAgent.length) / loans.length) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${loans.length > 0 ? Math.round(((loans.length - pendingForAgent.length) / loans.length) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Loan Type Distribution */}
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-4">Loan Type Distribution</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(loans.reduce((acc, loan) => {
                        acc[loan.loanType] = (acc[loan.loanType] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)).map(([type, count]) => (
                        <div key={type} className="p-3 bg-gray-50 rounded-lg text-center">
                          <p className="text-2xl font-bold text-gray-900">{count}</p>
                          <p className="text-xs text-gray-500">{type}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Activity */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Monthly Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {loans.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No activity data yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.from(new Set(loans.map(l => new Date(l.createdAt).getMonth()))).slice(0, 6).map(month => {
                      const monthLoans = loans.filter(l => new Date(l.createdAt).getMonth() === month);
                      const monthName = new Date(2024, month).toLocaleString('default', { month: 'long' });
                      return (
                        <div key={month} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                          <div className="w-20 text-sm font-medium text-gray-700">{monthName}</div>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-cyan-500 rounded-full"
                              style={{ width: `${(monthLoans.length / loans.length) * 100}%` }}
                            />
                          </div>
                          <div className="w-12 text-sm text-gray-600 text-right">{monthLoans.length}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'dashboard':
      default:
        return (
          <div className="space-y-6">
            {/* Action Cards */}
            {(pendingForAgent.length > 0 || formCompleted.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {pendingForAgent.length > 0 && (
                  <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                          <Clock className="h-6 w-6 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-orange-800">{pendingForAgent.length} Pending Approvals</h4>
                          <p className="text-sm text-orange-600">Review and assign staff</p>
                        </div>
                        <Button onClick={() => setActiveTab('pending')}>Review</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {formCompleted.length > 0 && (
                  <Card className="border-violet-200 bg-violet-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
                          <ClipboardCheck className="h-6 w-6 text-violet-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-violet-800">{formCompleted.length} Sanctions to Create</h4>
                          <p className="text-sm text-violet-600">Create loan sanction for customer approval</p>
                        </div>
                        <Button className="bg-violet-500 hover:bg-violet-600" onClick={() => setActiveTab('session')}>Create</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
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
                    <p>No loan activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {loans.slice(0, 5).map((loan) => (
                      <div key={loan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-cyan-100 text-cyan-700">{loan.customer?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{loan.applicationNo}</p>
                            <p className="text-sm text-gray-500">{loan.customer?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(loan.status)}
                          <p className="font-semibold">{formatCurrency(loan.requestedAmount)}</p>
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
      title="Agent Dashboard"
      subtitle="Manage loan approvals and create sanctions"
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      stats={stats}
      gradient="bg-gradient-to-br from-cyan-600 to-blue-700"
      logoIcon={User}
    >
      {renderContent()}

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approvalAction === 'approve' ? 'Approve & Assign Staff' : 'Reject Application'}</DialogTitle>
            <DialogDescription>{selectedLoan?.applicationNo} - {selectedLoan?.customer?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLoan && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="font-semibold">{formatCurrency(selectedLoan.requestedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Type</p>
                    <p className="font-semibold">{selectedLoan.loanType}</p>
                  </div>
                </div>
              </div>
            )}
            {approvalAction === 'approve' && (
              <div>
                <Label>Assign to Staff *</Label>
                {staffList.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-lg text-amber-700 text-sm">
                    No staff available. Please create a staff member first.
                    <Button size="sm" className="ml-2" onClick={() => { setShowApprovalDialog(false); setShowStaffDialog(true); }}>
                      Create Staff
                    </Button>
                  </div>
                ) : (
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger><SelectValue placeholder="Select Staff" /></SelectTrigger>
                    <SelectContent>
                      {staffList.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.staffCode})</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div>
              <Label>Remarks</Label>
              <Textarea placeholder="Add remarks..." value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancel</Button>
            <Button className={approvalAction === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} onClick={handleApproval} disabled={saving}>
              {saving ? 'Processing...' : approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sanction Creation Dialog */}
      <Dialog open={showSanctionDialog} onOpenChange={setShowSanctionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Create Loan Sanction</DialogTitle>
            <DialogDescription>{selectedLoan?.applicationNo} - {selectedLoan?.customer?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Approved Amount (₹) *</Label>
                <Input type="number" value={sessionForm.approvedAmount} onChange={(e) => setSessionForm({...sessionForm, approvedAmount: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Label>Interest Rate (% p.a.) *</Label>
                <Input type="number" step="0.1" value={sessionForm.interestRate} onChange={(e) => setSessionForm({...sessionForm, interestRate: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Label>Tenure (months) *</Label>
                <Input type="number" value={sessionForm.tenure} onChange={(e) => setSessionForm({...sessionForm, tenure: parseInt(e.target.value) || 0})} />
              </div>
              <div>
                <Label>Processing Fee</Label>
                <Input type="number" value={sessionForm.processingFee} onChange={(e) => setSessionForm({...sessionForm, processingFee: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            
            {calculatedEMI && (
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-emerald-800 mb-3">EMI Calculation</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-emerald-600">Monthly EMI</p>
                      <p className="text-2xl font-bold text-emerald-700">{formatCurrency(calculatedEMI.emi)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-600">Total Interest</p>
                      <p className="text-lg font-semibold text-emerald-700">{formatCurrency(calculatedEMI.totalInterest)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-600">Total Amount</p>
                      <p className="text-lg font-semibold text-emerald-700">{formatCurrency(calculatedEMI.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-600">Principal</p>
                      <p className="text-lg font-semibold text-emerald-700">{formatCurrency(sessionForm.approvedAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <Label>Special Conditions</Label>
              <Textarea placeholder="Any special terms or conditions..." value={sessionForm.specialConditions} onChange={(e) => setSessionForm({...sessionForm, specialConditions: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSanctionDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleCreateSanction} disabled={saving}>
              {saving ? 'Creating...' : 'Create Sanction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Staff Dialog */}
      <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input placeholder="Staff Name" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" placeholder="staff@example.com" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Password *</Label>
              <Input type="password" placeholder="Min 6 characters" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStaffDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleCreateStaff} disabled={saving}>
              {saving ? 'Creating...' : 'Create Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan Details Dialog */}
      <Dialog open={showLoanDetailsDialog} onOpenChange={setShowLoanDetailsDialog}>
        <DialogContent className="max-w-2xl">
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
                  <p className="text-sm text-gray-500">{selectedLoan.customer?.email}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedLoan.status)}
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-semibold">{formatCurrency(selectedLoan.requestedAmount)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Loan Type</p>
                  <p className="font-semibold">{selectedLoan.loanType}</p>
                </div>
              </div>
              {selectedLoan.sessionForm && (
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Sanction Details</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Approved Amount</p>
                      <p className="font-semibold">{formatCurrency(selectedLoan.sessionForm.approvedAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Interest Rate</p>
                      <p className="font-semibold">{selectedLoan.sessionForm.interestRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">EMI</p>
                      <p className="font-semibold">{formatCurrency(selectedLoan.sessionForm.emiAmount)}/mo</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Approval Dialog */}
      <Dialog open={showBulkApprovalDialog} onOpenChange={setShowBulkApprovalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkApprovalAction === 'approve' ? (
                <><CheckCircle className="h-5 w-5 text-cyan-600" />Bulk Approve Applications</>
              ) : (
                <><XCircle className="h-5 w-5 text-red-600" />Bulk Reject Applications</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedLoanIds.length} applications selected for {bulkApprovalAction}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">Total Applications</span>
                <span className="font-semibold">{selectedLoanIds.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Amount</span>
                <span className="font-semibold">
                  {formatCurrency(selectedLoanIds.reduce((sum, id) => {
                    const loan = pendingForAgent.find(l => l.id === id);
                    return sum + (loan?.requestedAmount || 0);
                  }, 0))}
                </span>
              </div>
            </div>

            {bulkApprovalAction === 'approve' && (
              <div>
                <Label className="text-sm font-medium">Assign to Staff *</Label>
                {staffList.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-lg text-amber-700 text-sm">
                    No staff available. Please create a staff member first.
                  </div>
                ) : (
                  <Select value={bulkStaffId} onValueChange={setBulkStaffId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.staffCode})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkApprovalDialog(false)}>Cancel</Button>
            <Button 
              className={bulkApprovalAction === 'approve' ? 'bg-cyan-500 hover:bg-cyan-600' : 'bg-red-500 hover:bg-red-600'} 
              onClick={handleBulkApproval}
              disabled={bulkSaving || (bulkApprovalAction === 'approve' && !bulkStaffId)}
            >
              {bulkSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>{bulkApprovalAction === 'approve' ? 'Approve All' : 'Reject All'} ({selectedLoanIds.length})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan Detail Panel */}
      <LoanDetailPanel
        open={showLoanDetailPanel}
        loanId={selectedLoanId}
        onClose={() => { setShowLoanDetailPanel(false); setSelectedLoanId(null); }}
        onEMIPaid={() => fetchData()}
      />
    </DashboardLayout>
  );
}

// Flat Interest Calculator
function calculateFlatInterest(principal: number, annualRate: number, tenureMonths: number) {
  // Flat Interest: Interest is calculated on the principal for the entire tenure
  const totalInterest = principal * (annualRate / 100) * (tenureMonths / 12);
  const totalAmount = principal + totalInterest;
  const emi = totalAmount / tenureMonths;
  return {
    emi,
    totalInterest,
    totalAmount,
    principal
  };
}

// EMI Calculator Section Component - Both calculators side by side with independent inputs
function EMICalculatorSection() {
  // Shared Principal (Loan Amount)
  const [principal, setPrincipal] = useState(100000);

  // Reducing Calculator State
  const [reducingInput, setReducingInput] = useState({
    interestRate: 12,
    tenure: 12
  });

  // Flat Calculator State
  const [flatInput, setFlatInput] = useState({
    interestRate: 12,
    tenure: 12
  });

  // Reducing EMI Result
  const reducingResult = useMemo(() => {
    if (principal > 0 && reducingInput.interestRate > 0 && reducingInput.tenure > 0) {
      return calculateEMI(
        principal,
        reducingInput.interestRate,
        reducingInput.tenure
      );
    }
    return null;
  }, [principal, reducingInput]);

  // Flat Interest Result
  const flatResult = useMemo(() => {
    if (principal > 0 && flatInput.interestRate > 0 && flatInput.tenure > 0) {
      return calculateFlatInterest(
        principal,
        flatInput.interestRate,
        flatInput.tenure
      );
    }
    return null;
  }, [principal, flatInput]);

  // Comparison between Flat and Reducing
  const comparison = useMemo(() => {
    if (reducingResult && flatResult) {
      const emiDiff = flatResult.emi - reducingResult.emi;
      const interestDiff = flatResult.totalInterest - reducingResult.totalInterest;
      const totalDiff = flatResult.totalAmount - reducingResult.totalAmount;

      return {
        emiDifference: emiDiff,
        interestDifference: interestDiff,
        totalDifference: totalDiff,
        flatIsHigher: emiDiff > 0,
        savingWithReducing: totalDiff > 0 ? totalDiff : -totalDiff,
        reducingSaves: totalDiff > 0
      };
    }
    return null;
  }, [reducingResult, flatResult]);

  return (
    <div className="space-y-6">
      {/* Shared Principal Input */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-cyan-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Calculator className="h-6 w-6 text-emerald-600" />
            EMI Calculator - Compare Flat vs Reducing Interest
          </CardTitle>
          <CardDescription>
            Enter loan amount and configure each calculator independently to compare
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label className="flex items-center gap-2 mb-2 text-base font-medium">
              <IndianRupee className="h-5 w-5 text-emerald-600" /> Loan Amount (Shared)
            </Label>
            <Input
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(parseFloat(e.target.value) || 0)}
              className="text-lg h-12 border-2 focus:border-emerald-500"
            />
            <input
              type="range"
              min="10000"
              max="10000000"
              step="10000"
              value={principal}
              onChange={(e) => setPrincipal(parseInt(e.target.value))}
              className="w-full mt-3 accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>₹10K</span>
              <span className="font-medium text-emerald-600">{formatCurrency(principal)}</span>
              <span>₹1Cr</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Both Calculators Side by Side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Reducing Balance Calculator */}
        <Card className="border-2 border-emerald-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Reducing Balance EMI
            </CardTitle>
            <CardDescription className="text-emerald-100">
              Interest calculated on outstanding balance
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {/* Editable Inputs for Reducing Calculator */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <Percent className="h-4 w-4 text-emerald-600" /> Interest Rate (% p.a.)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={reducingInput.interestRate}
                  onChange={(e) => setReducingInput({ ...reducingInput, interestRate: parseFloat(e.target.value) || 0 })}
                  className="h-10 border-2 focus:border-emerald-500"
                />
                <input
                  type="range"
                  min="1"
                  max="36"
                  step="0.5"
                  value={reducingInput.interestRate}
                  onChange={(e) => setReducingInput({ ...reducingInput, interestRate: parseFloat(e.target.value) })}
                  className="w-full mt-2 accent-emerald-500"
                />
                <div className="text-center text-xs text-gray-500 mt-1">{reducingInput.interestRate}%</div>
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-emerald-600" /> Tenure (months)
                </Label>
                <Input
                  type="number"
                  value={reducingInput.tenure}
                  onChange={(e) => setReducingInput({ ...reducingInput, tenure: parseInt(e.target.value) || 0 })}
                  className="h-10 border-2 focus:border-emerald-500"
                />
                <input
                  type="range"
                  min="3"
                  max="84"
                  step="1"
                  value={reducingInput.tenure}
                  onChange={(e) => setReducingInput({ ...reducingInput, tenure: parseInt(e.target.value) })}
                  className="w-full mt-2 accent-emerald-500"
                />
                <div className="text-center text-xs text-gray-500 mt-1">{reducingInput.tenure} months</div>
              </div>
            </div>

            {reducingResult && (
              <div className="space-y-4">
                <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Monthly EMI</p>
                  <p className="text-4xl font-bold text-emerald-600">{formatCurrency(reducingResult.emi)}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Principal</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(principal)}</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-xs text-gray-500">Interest</p>
                    <p className="text-lg font-bold text-orange-600">{formatCurrency(reducingResult.totalInterest)}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(reducingResult.totalAmount)}</p>
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border">
                  <h4 className="font-medium text-gray-900 mb-3">Payment Breakdown</h4>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(principal / reducingResult.totalAmount) * 100}%` }}
                    />
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${(reducingResult.totalInterest / reducingResult.totalAmount) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded" />
                      <span className="text-gray-600">Principal {((principal / reducingResult.totalAmount) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded" />
                      <span className="text-gray-600">Interest {((reducingResult.totalInterest / reducingResult.totalAmount) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Flat Interest Calculator */}
        <Card className="border-2 border-cyan-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-lg">
              <IndianRupee className="h-5 w-5" />
              Flat Interest EMI
            </CardTitle>
            <CardDescription className="text-cyan-100">
              Interest calculated on full principal
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {/* Editable Inputs for Flat Calculator */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <Percent className="h-4 w-4 text-cyan-600" /> Interest Rate (% p.a.)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={flatInput.interestRate}
                  onChange={(e) => setFlatInput({ ...flatInput, interestRate: parseFloat(e.target.value) || 0 })}
                  className="h-10 border-2 focus:border-cyan-500"
                />
                <input
                  type="range"
                  min="1"
                  max="36"
                  step="0.5"
                  value={flatInput.interestRate}
                  onChange={(e) => setFlatInput({ ...flatInput, interestRate: parseFloat(e.target.value) })}
                  className="w-full mt-2 accent-cyan-500"
                />
                <div className="text-center text-xs text-gray-500 mt-1">{flatInput.interestRate}%</div>
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-cyan-600" /> Tenure (months)
                </Label>
                <Input
                  type="number"
                  value={flatInput.tenure}
                  onChange={(e) => setFlatInput({ ...flatInput, tenure: parseInt(e.target.value) || 0 })}
                  className="h-10 border-2 focus:border-cyan-500"
                />
                <input
                  type="range"
                  min="3"
                  max="84"
                  step="1"
                  value={flatInput.tenure}
                  onChange={(e) => setFlatInput({ ...flatInput, tenure: parseInt(e.target.value) })}
                  className="w-full mt-2 accent-cyan-500"
                />
                <div className="text-center text-xs text-gray-500 mt-1">{flatInput.tenure} months</div>
              </div>
            </div>

            {flatResult && (
              <div className="space-y-4">
                <div className="text-center p-6 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Monthly EMI</p>
                  <p className="text-4xl font-bold text-cyan-600">{formatCurrency(flatResult.emi)}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Principal</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(principal)}</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-xs text-gray-500">Interest</p>
                    <p className="text-lg font-bold text-orange-600">{formatCurrency(flatResult.totalInterest)}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(flatResult.totalAmount)}</p>
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border">
                  <h4 className="font-medium text-gray-900 mb-3">Payment Breakdown</h4>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-cyan-500"
                      style={{ width: `${(principal / flatResult.totalAmount) * 100}%` }}
                    />
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${(flatResult.totalInterest / flatResult.totalAmount) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-cyan-500 rounded" />
                      <span className="text-gray-600">Principal {((principal / flatResult.totalAmount) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded" />
                      <span className="text-gray-600">Interest {((flatResult.totalInterest / flatResult.totalAmount) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison/Difference Section */}
      {comparison && reducingResult && flatResult && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <Calculator className="h-6 w-6" />
              Comparison - Flat vs Reducing
            </CardTitle>
            <CardDescription className="text-violet-200">
              See the difference between both interest calculation methods with your settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Settings Comparison */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-6">
              <h4 className="font-medium text-white mb-3">Calculator Settings</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-emerald-500/20 rounded-lg p-3">
                  <p className="text-emerald-200 text-sm">Reducing Balance</p>
                  <p className="text-white font-semibold">{reducingInput.interestRate}% for {reducingInput.tenure} months</p>
                </div>
                <div className="bg-cyan-500/20 rounded-lg p-3">
                  <p className="text-cyan-200 text-sm">Flat Interest</p>
                  <p className="text-white font-semibold">{flatInput.interestRate}% for {flatInput.tenure} months</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-5 bg-white/10 backdrop-blur rounded-xl text-center">
                <p className="text-violet-200 text-sm mb-1">EMI Difference</p>
                <p className="text-3xl font-bold text-white">
                  {comparison.emiDifference >= 0 ? '+' : ''}{formatCurrency(comparison.emiDifference)}
                </p>
                <p className="text-xs text-violet-300 mt-1">
                  {comparison.emiDifference >= 0 ? 'Flat EMI higher' : 'Reducing EMI higher'}
                </p>
              </div>
              <div className="p-5 bg-white/10 backdrop-blur rounded-xl text-center">
                <p className="text-violet-200 text-sm mb-1">Interest Difference</p>
                <p className={`text-3xl font-bold ${comparison.interestDifference >= 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {comparison.interestDifference >= 0 ? '+' : ''}{formatCurrency(comparison.interestDifference)}
                </p>
                <p className="text-xs text-violet-300 mt-1">
                  {comparison.interestDifference >= 0 ? 'More interest in flat' : 'More interest in reducing'}
                </p>
              </div>
              <div className="p-5 bg-white/10 backdrop-blur rounded-xl text-center">
                <p className="text-violet-200 text-sm mb-1">Total Amount Difference</p>
                <p className={`text-3xl font-bold ${comparison.totalDifference >= 0 ? 'text-orange-300' : 'text-emerald-300'}`}>
                  {comparison.totalDifference >= 0 ? '+' : ''}{formatCurrency(comparison.totalDifference)}
                </p>
                <p className="text-xs text-violet-300 mt-1">
                  {comparison.totalDifference >= 0 ? 'Flat costs more' : 'Reducing costs more'}
                </p>
              </div>
              <div className="p-5 bg-white/10 backdrop-blur rounded-xl text-center">
                <p className="text-violet-200 text-sm mb-1">Best Option</p>
                <p className="text-2xl font-bold text-emerald-300">
                  {comparison.reducingSaves ? 'Reducing' : 'Flat'}
                </p>
                <p className="text-xs text-violet-300 mt-1">
                  Save {formatCurrency(comparison.savingWithReducing)}
                </p>
              </div>
            </div>

            {/* Detailed Breakdown Table */}
            <div className="bg-white rounded-xl p-4 text-gray-900">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Detailed Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-gray-500">Parameter</th>
                      <th className="text-right py-2 text-emerald-600">Reducing ({reducingInput.interestRate}%, {reducingInput.tenure}mo)</th>
                      <th className="text-right py-2 text-cyan-600">Flat ({flatInput.interestRate}%, {flatInput.tenure}mo)</th>
                      <th className="text-right py-2 text-violet-600">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 font-medium">Monthly EMI</td>
                      <td className="text-right py-3 font-semibold text-emerald-600">{formatCurrency(reducingResult.emi)}</td>
                      <td className="text-right py-3 font-semibold text-cyan-600">{formatCurrency(flatResult.emi)}</td>
                      <td className={`text-right py-3 font-semibold ${comparison.emiDifference >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {comparison.emiDifference >= 0 ? '+' : ''}{formatCurrency(comparison.emiDifference)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 font-medium">Total Interest</td>
                      <td className="text-right py-3 font-semibold text-emerald-600">{formatCurrency(reducingResult.totalInterest)}</td>
                      <td className="text-right py-3 font-semibold text-cyan-600">{formatCurrency(flatResult.totalInterest)}</td>
                      <td className={`text-right py-3 font-semibold ${comparison.interestDifference >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {comparison.interestDifference >= 0 ? '+' : ''}{formatCurrency(comparison.interestDifference)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 font-medium">Total Amount</td>
                      <td className="text-right py-3 font-semibold text-emerald-600">{formatCurrency(reducingResult.totalAmount)}</td>
                      <td className="text-right py-3 font-semibold text-cyan-600">{formatCurrency(flatResult.totalAmount)}</td>
                      <td className={`text-right py-3 font-semibold ${comparison.totalDifference >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {comparison.totalDifference >= 0 ? '+' : ''}{formatCurrency(comparison.totalDifference)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 font-medium">Interest to Principal Ratio</td>
                      <td className="text-right py-3 font-semibold text-emerald-600">
                        {((reducingResult.totalInterest / principal) * 100).toFixed(1)}%
                      </td>
                      <td className="text-right py-3 font-semibold text-cyan-600">
                        {((flatResult.totalInterest / principal) * 100).toFixed(1)}%
                      </td>
                      <td className={`text-right py-3 font-semibold ${comparison.interestDifference >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {comparison.interestDifference >= 0 ? '+' : ''}{(((flatResult.totalInterest - reducingResult.totalInterest) / principal) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommendation */}
            <div className={`mt-4 p-4 ${comparison.reducingSaves ? 'bg-emerald-500/20' : 'bg-cyan-500/20'} backdrop-blur rounded-xl`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${comparison.reducingSaves ? 'bg-emerald-500' : 'bg-cyan-500'} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white">
                    Recommendation: Choose {comparison.reducingSaves ? 'Reducing Balance' : 'Flat Interest'}
                  </p>
                  <p className={`text-sm mt-1 ${comparison.reducingSaves ? 'text-emerald-200' : 'text-cyan-200'}`}>
                    With {comparison.reducingSaves ? 'reducing balance' : 'flat interest'} method, you save <strong>{formatCurrency(comparison.savingWithReducing)}</strong> over the loan tenure.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
