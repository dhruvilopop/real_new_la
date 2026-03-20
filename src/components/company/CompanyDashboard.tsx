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
import { Building2, FileText, CheckCircle, XCircle, Clock, Users, Wallet, AlertTriangle, Eye, TrendingUp, DollarSign, BarChart3, UserCheck, UserPlus, Target, X, Loader2, Calendar, IndianRupee } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import LoanDetailPanel from '@/components/loan/LoanDetailPanel';
import EMICollectionSection from '@/components/emi/EMICollectionSection';
import EMICalendar from '@/components/emi/EMICalendar';
import OfflineLoanForm from '@/components/offline-loan/OfflineLoanForm';
import OfflineLoansList from '@/components/offline-loan/OfflineLoansList';
import MyCreditPassbook from '@/components/credit/MyCreditPassbook';
import SecondaryPaymentPagesSection from '@/components/payment/SecondaryPaymentPagesSection';

interface Loan {
  id: string; applicationNo: string; status: string; requestedAmount: number; loanType: string;
  createdAt: string; riskScore: number; fraudFlag: boolean; purpose: string;
  customer: { id: string; name: string; email: string; phone: string; };
  sessionForm?: any; loanForm?: any; company?: any;
  requestedTenure?: number;
}

interface Agent {
  id: string; name: string; email: string; agentCode: string; isActive: boolean;
}

export default function CompanyDashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showLoanDetailsDialog, setShowLoanDetailsDialog] = useState(false);
  const [showLoanDetailPanel, setShowLoanDetailPanel] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [remarks, setRemarks] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [saving, setSaving] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: '', email: '', password: '', commissionRate: 5 });
  
  // Bulk selection state
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [showBulkApprovalDialog, setShowBulkApprovalDialog] = useState(false);
  const [bulkApprovalAction, setBulkApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [bulkAgentId, setBulkAgentId] = useState<string>('');
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch loans for this company with role parameter
      // Use companyId if available, otherwise fetch all (shouldn't happen for COMPANY role)
      const companyId = user?.companyId;
      if (companyId) {
        const loansRes = await fetch(`/api/loan/list?role=COMPANY&companyId=${companyId}`);
        const loansData = await loansRes.json();
        setLoans(loansData.loans || []);
      } else {
        setLoans([]);
      }

      // Fetch ALL agents - Agents are ecosystem-wide (common for ALL companies)
      // Company can see ALL agents to assign loans to any agent
      const usersRes = await fetch('/api/user?role=AGENT');
      const usersData = await usersRes.json();
      const allAgents = (usersData.users || []).map((u: any) => ({
        id: u.id, 
        name: u.name, 
        email: u.email, 
        agentCode: u.agentCode || 'N/A', 
        isActive: u.isActive,
        companyId: u.companyId
      }));
      console.log('[CompanyDashboard] Fetched agents:', allAgents.length, allAgents);
      setAgents(allAgents);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!selectedLoan) return;
    if (approvalAction === 'approve' && !selectedAgentId) {
      toast({ title: 'Agent Required', description: 'Please select an agent to assign this loan.', variant: 'destructive' });
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
          role: 'COMPANY',
          userId: user?.id || 'system', 
          agentId: approvalAction === 'approve' ? selectedAgentId : undefined
        })
      });
      if (response.ok) {
        toast({ 
          title: approvalAction === 'approve' ? 'Loan Approved' : 'Loan Rejected', 
          description: `Application ${selectedLoan.applicationNo} has been ${approvalAction}d.` 
        });
        setShowApprovalDialog(false);
        setRemarks('');
        setSelectedAgentId('');
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

  const handleCreateAgent = async () => {
    if (!agentForm.name || !agentForm.email || !agentForm.password) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...agentForm,
          role: 'AGENT'
          // Note: Agents are ecosystem-wide, no companyId assignment
        })
      });
      if (response.ok) {
        toast({ title: 'Success', description: 'Agent created successfully' });
        setShowAgentDialog(false);
        setAgentForm({ name: '', email: '', password: '', commissionRate: 5 });
        fetchData();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to create agent', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create agent', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
    setBulkAgentId('');
  };

  // Bulk approval handler
  const handleBulkApproval = async () => {
    if (selectedLoanIds.length === 0) return;
    
    if (bulkApprovalAction === 'approve' && !bulkAgentId) {
      toast({ title: 'Agent Required', description: 'Please select an agent to assign the loans.', variant: 'destructive' });
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
          role: 'COMPANY',
          userId: user?.id || 'system',
          agentId: bulkApprovalAction === 'approve' ? bulkAgentId : undefined,
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

  // Filter loans by status
  const pendingForCompany = loans.filter(l => l.status === 'SA_APPROVED');
  const approvedByCompany = loans.filter(l => l.status === 'COMPANY_APPROVED');
  const inProgressLoans = loans.filter(l => [
    'AGENT_APPROVED_STAGE1', 'LOAN_FORM_COMPLETED', 'SESSION_CREATED', 
    'CUSTOMER_SESSION_APPROVED', 'FINAL_APPROVED'
  ].includes(l.status));
  const activeLoans = loans.filter(l => ['ACTIVE', 'DISBURSED'].includes(l.status));
  const rejectedLoans = loans.filter(l => ['REJECTED_BY_COMPANY', 'REJECTED_FINAL'].includes(l.status));

  const totalDisbursed = activeLoans.reduce((sum, l) => sum + (l.sessionForm?.approvedAmount || l.requestedAmount), 0);
  const totalPending = pendingForCompany.reduce((sum, l) => sum + l.requestedAmount, 0);

  const stats = [
    { label: 'Pending Approvals', value: pendingForCompany.length, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', onClick: () => setActiveTab('pending') },
    { label: 'In Progress', value: inProgressLoans.length, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => setActiveTab('progress') },
    { label: 'Active Loans', value: activeLoans.length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', onClick: () => setActiveTab('active') },
    { label: 'Total Disbursed', value: formatCurrency(totalDisbursed), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setActiveTab('active') }
  ];

  const menuItems = ROLE_MENU_ITEMS.COMPANY.map(item => ({
    ...item,
    count: item.id === 'pending' ? pendingForCompany.length : 
           item.id === 'agents' ? agents.length :
           item.id === 'active' ? activeLoans.length :
           item.id === 'progress' ? inProgressLoans.length : undefined
  }));

  const renderLoanCard = (loan: Loan, index: number, actions?: React.ReactNode) => (
    <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
      className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all bg-white">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 bg-gradient-to-br from-teal-400 to-emerald-500">
            <AvatarFallback className="bg-transparent text-white font-semibold">
              {loan.customer?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
              {getStatusBadge(loan.status)}
              {loan.fraudFlag && <Badge className="bg-red-100 text-red-700">High Risk</Badge>}
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
        const pendingLoanIds = pendingForCompany.map(l => l.id);
        return (
          <div className="space-y-4">
            {/* Bulk Action Bar */}
            {selectedLoanIds.length > 0 && (
              <Card className="bg-teal-50 border-teal-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-teal-600 text-white text-sm px-3 py-1">
                        {selectedLoanIds.length} selected
                      </Badge>
                      <span className="text-sm text-teal-700">
                        {formatCurrency(selectedLoanIds.reduce((sum, id) => {
                          const loan = pendingForCompany.find(l => l.id === id);
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
                        className="bg-teal-500 hover:bg-teal-600"
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
                    <CardDescription>Applications approved by Super Admin, awaiting your approval. Assign an agent to proceed.</CardDescription>
                  </div>
                  {pendingForCompany.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-company"
                        checked={selectedLoanIds.length === pendingLoanIds.length && pendingLoanIds.length > 0}
                        onCheckedChange={() => handleSelectAll(pendingLoanIds)}
                      />
                      <Label htmlFor="select-all-company" className="text-sm font-medium cursor-pointer">
                        Select All ({pendingForCompany.length})
                      </Label>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pendingForCompany.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>No pending applications</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingForCompany.map((loan, index) => (
                      <motion.div 
                        key={loan.id} 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: index * 0.03 }}
                        className={`p-4 border rounded-xl hover:bg-gray-50 transition-all bg-white ${
                          selectedLoanIds.includes(loan.id) ? 'border-teal-300 bg-teal-50' : 'border-gray-100'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <Checkbox
                              checked={selectedLoanIds.includes(loan.id)}
                              onCheckedChange={() => handleSelectLoan(loan.id)}
                            />
                            <Avatar className="h-12 w-12 bg-gradient-to-br from-teal-400 to-emerald-500">
                              <AvatarFallback className="bg-transparent text-white font-semibold">
                                {loan.customer?.name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
                                {getStatusBadge(loan.status)}
                                {loan.fraudFlag && <Badge className="bg-red-100 text-red-700">High Risk</Badge>}
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

      case 'agents':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Agent Management</CardTitle>
                  <CardDescription>All ecosystem agents (common for all companies)</CardDescription>
                </div>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowAgentDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />Add Agent
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No agents created yet</p>
                  <Button className="mt-4 bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowAgentDialog(true)}>
                    Create First Agent
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent, index) => (
                    <motion.div key={agent.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                      className="p-4 border border-gray-100 rounded-xl bg-white flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-emerald-100 text-emerald-700">{agent.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold">{agent.name}</h4>
                          <p className="text-sm text-gray-500">{agent.email}</p>
                          <p className="text-xs text-gray-400">Code: {agent.agentCode}</p>
                        </div>
                      </div>
                      <Badge className={agent.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {agent.isActive ? 'Active' : 'Inactive'}
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
              <CardTitle>Active Loans</CardTitle>
              <CardDescription>Loans that are currently active with EMI schedules</CardDescription>
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

      case 'progress':
        return (
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />In Progress Loans
              </CardTitle>
              <CardDescription>Loans currently in the approval and verification pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              {inProgressLoans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No loans in progress</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inProgressLoans.map((loan, index) => renderLoanCard(loan, index))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'portfolio':
        return (
          <div className="space-y-6">
            {/* Portfolio Stats */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Portfolio</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalDisbursed)}</p>
                    </div>
                    <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Active Loans</p>
                      <p className="text-2xl font-bold text-green-600">{activeLoans.length}</p>
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
                      <p className="text-sm text-gray-500">Pending Amount</p>
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalPending)}</p>
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
                      <p className="text-sm text-gray-500">Total Agents</p>
                      <p className="text-2xl font-bold text-cyan-600">{agents.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-cyan-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Portfolio Distribution */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-teal-600" />
                  Portfolio Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Status Distribution */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-4">By Status</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-orange-50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-orange-600">{pendingForCompany.length}</p>
                        <p className="text-xs text-gray-500">Pending</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-blue-600">{inProgressLoans.length}</p>
                        <p className="text-xs text-gray-500">In Progress</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-green-600">{activeLoans.length}</p>
                        <p className="text-xs text-gray-500">Active</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-red-600">{rejectedLoans.length}</p>
                        <p className="text-xs text-gray-500">Rejected</p>
                      </div>
                    </div>
                  </div>

                  {/* Loan Type Distribution */}
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-4">By Loan Type</h4>
                    <div className="space-y-3">
                      {Object.entries(loans.reduce((acc, loan) => {
                        acc[loan.loanType] = (acc[loan.loanType] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)).map(([type, count]) => {
                        const percentage = loans.length > 0 ? (count / loans.length) * 100 : 0;
                        return (
                          <div key={type} className="flex items-center gap-4">
                            <div className="w-28 text-sm font-medium text-gray-700">{type}</div>
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="w-16 text-sm text-gray-600 text-right">{count} ({percentage.toFixed(0)}%)</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Amount Distribution */}
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-4">By Amount Range</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Under ₹1L', min: 0, max: 100000 },
                        { label: '₹1L - ₹5L', min: 100000, max: 500000 },
                        { label: '₹5L - ₹10L', min: 500000, max: 1000000 },
                        { label: 'Above ₹10L', min: 1000000, max: Infinity }
                      ].map((range) => {
                        const count = loans.filter(l => l.requestedAmount >= range.min && l.requestedAmount < range.max).length;
                        return (
                          <div key={range.label} className="p-3 bg-gray-50 rounded-lg text-center">
                            <p className="text-2xl font-bold text-gray-900">{count}</p>
                            <p className="text-xs text-gray-500">{range.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Disbursement Trend */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Monthly Disbursement Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {loans.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No disbursement data yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.from(new Set(loans.map(l => new Date(l.createdAt).getMonth()))).slice(0, 6).map(month => {
                      const monthLoans = loans.filter(l => new Date(l.createdAt).getMonth() === month);
                      const monthAmount = monthLoans.reduce((sum, l) => sum + l.requestedAmount, 0);
                      const monthName = new Date(2024, month).toLocaleString('default', { month: 'long' });
                      const maxAmount = Math.max(...Array.from(new Set(loans.map(l => new Date(l.createdAt).getMonth()))).map(m => 
                        loans.filter(l => new Date(l.createdAt).getMonth() === m).reduce((sum, l) => sum + l.requestedAmount, 0)
                      ));
                      return (
                        <div key={month} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                          <div className="w-20 text-sm font-medium text-gray-700">{monthName}</div>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-teal-500 rounded-full"
                              style={{ width: `${maxAmount > 0 ? (monthAmount / maxAmount) * 100 : 0}%` }}
                            />
                          </div>
                          <div className="w-28 text-sm text-gray-600 text-right">{formatCurrency(monthAmount)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'risk':
        return (
          <div className="space-y-6">
            {/* Risk Overview Stats */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">High Risk Loans</p>
                      <p className="text-2xl font-bold text-red-600">{loans.filter(l => l.riskScore > 60).length}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Medium Risk</p>
                      <p className="text-2xl font-bold text-orange-600">{loans.filter(l => l.riskScore >= 30 && l.riskScore <= 60).length}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Low Risk</p>
                      <p className="text-2xl font-bold text-green-600">{loans.filter(l => l.riskScore < 30).length}</p>
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
                      <p className="text-sm text-gray-500">Fraud Flags</p>
                      <p className="text-2xl font-bold text-red-600">{loans.filter(l => l.fraudFlag).length}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk Distribution Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-teal-600" />
                  Risk Score Distribution
                </CardTitle>
                <CardDescription>Loans categorized by risk score levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Low Risk (0-30)', range: [0, 30], color: 'bg-green-500', bgColor: 'bg-green-50' },
                    { label: 'Medium Risk (30-60)', range: [30, 60], color: 'bg-orange-500', bgColor: 'bg-orange-50' },
                    { label: 'High Risk (60-80)', range: [60, 80], color: 'bg-red-400', bgColor: 'bg-red-50' },
                    { label: 'Critical Risk (80-100)', range: [80, 100], color: 'bg-red-600', bgColor: 'bg-red-100' }
                  ].map((category) => {
                    const count = loans.filter(l => l.riskScore >= category.range[0] && l.riskScore < category.range[1]).length;
                    const percentage = loans.length > 0 ? (count / loans.length) * 100 : 0;
                    return (
                      <div key={category.label} className="flex items-center gap-4">
                        <div className="w-40 text-sm font-medium text-gray-700">{category.label}</div>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${category.color} rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-20 text-sm text-gray-600 text-right">{count} ({percentage.toFixed(0)}%)</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Flagged Loans */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Flagged for Review
                </CardTitle>
                <CardDescription>Loans with high risk scores or fraud indicators</CardDescription>
              </CardHeader>
              <CardContent>
                {loans.filter(l => l.fraudFlag || l.riskScore > 60).length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>No flagged loans requiring attention</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {loans.filter(l => l.fraudFlag || l.riskScore > 60).map((loan, index) => (
                      <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                        className="p-4 border border-red-200 rounded-xl bg-red-50">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                              <AlertTriangle className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">{loan.applicationNo}</h4>
                                {loan.fraudFlag && <Badge className="bg-red-100 text-red-700">Fraud Flag</Badge>}
                              </div>
                              <p className="text-sm text-gray-500">{loan.customer?.name} • {loan.customer?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Risk Score</p>
                              <p className={`text-lg font-bold ${loan.riskScore > 80 ? 'text-red-600' : 'text-orange-600'}`}>{loan.riskScore || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
                              <p className="text-xs text-gray-500">{loan.loanType}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedLoan(loan); setShowLoanDetailsDialog(true); }}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risk Factors Summary */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Risk Factors Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="font-medium text-gray-900 mb-3">Average Risk Score</h4>
                    <p className="text-3xl font-bold text-gray-900">
                      {loans.length > 0 
                        ? (loans.reduce((sum, l) => sum + (l.riskScore || 0), 0) / loans.length).toFixed(1)
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="font-medium text-gray-900 mb-3">Highest Risk Loan</h4>
                    {loans.length > 0 ? (
                      <>
                        <p className="text-xl font-bold text-red-600">{Math.max(...loans.map(l => l.riskScore || 0))}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {loans.find(l => l.riskScore === Math.max(...loans.map(l => l.riskScore || 0)))?.applicationNo}
                        </p>
                      </>
                    ) : (
                      <p className="text-xl font-bold text-gray-400">N/A</p>
                    )}
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="font-medium text-gray-900 mb-3">Risk Exposure</h4>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(loans.filter(l => l.riskScore > 60).reduce((sum, l) => sum + l.requestedAmount, 0))}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">High risk portfolio value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'emi-collection':
        return (
          <div className="space-y-6">
            <EMICollectionSection userId={user?.id || ''} userRole={user?.role || 'COMPANY'} />
          </div>
        );

      case 'payment-pages':
        return (
          <div className="space-y-6">
            <SecondaryPaymentPagesSection userId={user?.id} companyId={user?.companyId} />
          </div>
        );
      
      case 'emi-calendar':
        return <EMICalendar userId={user?.id || ''} userRole={user?.role || 'COMPANY'} />;
      
      case 'offline-loans':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">Offline Loans</h1>
                <p className="text-muted-foreground">Manage offline loan applications</p>
              </div>
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create Offline Loan</CardTitle>
                </CardHeader>
                <CardContent>
                  <OfflineLoanForm createdById={user?.id || ''} createdByRole={user?.role || 'COMPANY'} onLoanCreated={fetchData} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Offline Loans List</CardTitle>
                </CardHeader>
                <CardContent>
                  <OfflineLoansList userRole={user?.role || 'COMPANY'} />
                </CardContent>
              </Card>
            </div>
          </div>
        );
      
      case 'personalCredits':
        return <MyCreditPassbook />;
      
      case 'dashboard':
      default:
        return (
          <div className="space-y-6">
            {/* Pipeline */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Loan Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  {[
                    { label: 'Pending', count: pendingForCompany.length, color: 'bg-orange-500' },
                    { label: 'In Progress', count: inProgressLoans.length, color: 'bg-blue-500' },
                    { label: 'Active', count: activeLoans.length, color: 'bg-green-500' },
                    { label: 'Rejected', count: rejectedLoans.length, color: 'bg-red-500' },
                  ].map((item) => (
                    <div key={item.label} className="p-4 bg-gray-50 rounded-xl">
                      <div className={`w-10 h-10 ${item.color} rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold`}>
                        {item.count}
                      </div>
                      <p className="text-sm text-gray-600">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Pending */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Pending Approvals</CardTitle>
                  {pendingForCompany.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('pending')}>
                      View All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pendingForCompany.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                    <p>All caught up! No pending approvals.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingForCompany.slice(0, 5).map((loan, index) => (
                      <div key={loan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-teal-100 text-teal-700">{loan.customer?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{loan.applicationNo}</p>
                            <p className="text-sm text-gray-500">{loan.customer?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-semibold">{formatCurrency(loan.requestedAmount)}</p>
                          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" 
                            onClick={() => { setSelectedLoan(loan); setApprovalAction('approve'); setShowApprovalDialog(true); }}>
                            Review
                          </Button>
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
      title="Company Dashboard"
      subtitle={user?.company?.name || "Manage your company's loan portfolio"}
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      stats={stats}
      gradient="bg-gradient-to-br from-teal-600 to-emerald-700"
      logoIcon={Building2}
    >
      {renderContent()}

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approvalAction === 'approve' ? 'Approve & Assign Agent' : 'Reject Application'}</DialogTitle>
            <DialogDescription>
              {selectedLoan?.applicationNo} - {selectedLoan?.customer?.name}
            </DialogDescription>
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
                  <div>
                    <p className="text-gray-500">Tenure</p>
                    <p className="font-semibold">{selectedLoan.requestedTenure || 'N/A'} months</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Purpose</p>
                    <p className="font-semibold">{selectedLoan.purpose || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
            {approvalAction === 'approve' && (
              <div>
                <Label>Assign to Agent *</Label>
                {agents.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-lg text-amber-700 text-sm">
                    No agents available. Please create an agent first.
                    <Button size="sm" className="ml-2" onClick={() => { setShowApprovalDialog(false); setShowAgentDialog(true); }}>
                      Create Agent
                    </Button>
                  </div>
                ) : (
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name} ({a.agentCode})</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div>
              <Label>Remarks</Label>
              <Textarea placeholder="Add remarks (optional)..." value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancel</Button>
            <Button 
              className={approvalAction === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} 
              onClick={handleApproval}
              disabled={saving}
            >
              {saving ? 'Processing...' : approvalAction === 'approve' ? 'Approve' : 'Reject'}
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
                  <p className="text-sm text-gray-500">{selectedLoan.customer?.phone}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedLoan.status)}
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Requested Amount</p>
                  <p className="font-semibold">{formatCurrency(selectedLoan.requestedAmount)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Loan Type</p>
                  <p className="font-semibold">{selectedLoan.loanType}</p>
                </div>
              </div>
              {selectedLoan.sessionForm && (
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Approved Details</h4>
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

      {/* Create Agent Dialog */}
      <Dialog open={showAgentDialog} onOpenChange={setShowAgentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input placeholder="Agent Name" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" placeholder="agent@example.com" value={agentForm.email} onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Password *</Label>
              <Input type="password" placeholder="Min 6 characters" value={agentForm.password} onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })} />
            </div>
            <div>
              <Label>Commission Rate (%)</Label>
              <Input type="number" value={agentForm.commissionRate} onChange={(e) => setAgentForm({ ...agentForm, commissionRate: parseInt(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgentDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleCreateAgent} disabled={saving}>
              {saving ? 'Creating...' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approval Dialog */}
      <Dialog open={showBulkApprovalDialog} onOpenChange={setShowBulkApprovalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkApprovalAction === 'approve' ? (
                <><CheckCircle className="h-5 w-5 text-teal-600" />Bulk Approve Applications</>
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
                    const loan = pendingForCompany.find(l => l.id === id);
                    return sum + (loan?.requestedAmount || 0);
                  }, 0))}
                </span>
              </div>
            </div>

            {bulkApprovalAction === 'approve' && (
              <div>
                <Label className="text-sm font-medium">Assign to Agent *</Label>
                {agents.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-lg text-amber-700 text-sm">
                    No agents available. Please create an agent first.
                  </div>
                ) : (
                  <Select value={bulkAgentId} onValueChange={setBulkAgentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.agentCode})</SelectItem>
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
              className={bulkApprovalAction === 'approve' ? 'bg-teal-500 hover:bg-teal-600' : 'bg-red-500 hover:bg-red-600'} 
              onClick={handleBulkApproval}
              disabled={bulkSaving || (bulkApprovalAction === 'approve' && !bulkAgentId)}
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
