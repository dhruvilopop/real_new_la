'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText, Search, IndianRupee, Calendar, User, Phone,
  ChevronLeft, ChevronRight, Eye, CheckCircle, Clock, AlertTriangle,
  Trash2, Building2, Undo2, Redo2, Wallet, Receipt
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import OfflineLoanDetailPanel from './OfflineLoanDetailPanel';

interface OfflineLoan {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  loanAmount: number;
  interestRate: number;
  tenure: number;
  emiAmount: number;
  status: string;
  disbursementDate: string;
  createdAt: string;
  createdByRole: string;
  createdById: string;
  company?: { id: string; name: string; code: string };
  summary: {
    totalEMIs: number;
    paidEMIs: number;
    pendingEMIs: number;
    overdueEMIs: number;
    lastPaidEMI?: string;
    nextDueEMI?: string;
  };
}

interface OfflineLoansListProps {
  userId?: string;
  userRole: string;
  onLoanSelect?: (loanId: string) => void;
}

export default function OfflineLoansList({ userId, userRole, onLoanSelect }: OfflineLoansListProps) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<OfflineLoan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  
  // Detail panel
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Delete confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<OfflineLoan | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Undo/Redo actions
  const [undoableActions, setUndoableActions] = useState<any[]>([]);
  const [redoableActions, setRedoableActions] = useState<any[]>([]);

  useEffect(() => {
    fetchLoans();
    fetchCompanies();
    fetchActionableItems();
  }, [userId, userRole, page, statusFilter, companyFilter]);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      let url = `/api/offline-loan?page=${page}&limit=10`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (companyFilter !== 'all') url += `&companyId=${companyFilter}`;
      // No userId filter - show all company loans to everyone

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLoans(data.loans);
          setTotal(data.pagination.total);
        }
      }
    } catch (error) {
      console.error('Failed to fetch loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/company?isActive=true');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const fetchActionableItems = async () => {
    if (!userId) return;
    try {
      const [undoRes, redoRes] = await Promise.all([
        fetch(`/api/action-log?action=undoable&userId=${userId}`),
        fetch(`/api/action-log?action=redoable&userId=${userId}`)
      ]);
      
      if (undoRes.ok) {
        const data = await undoRes.json();
        setUndoableActions(data.actions || []);
      }
      if (redoRes.ok) {
        const data = await redoRes.json();
        setRedoableActions(data.actions || []);
      }
    } catch (error) {
      console.error('Failed to fetch actionable items:', error);
    }
  };

  const handleViewLoan = (loan: OfflineLoan) => {
    setSelectedLoanId(loan.id);
    setDetailOpen(true);
  };

  const handleDeleteClick = (loan: OfflineLoan) => {
    if (userRole !== 'SUPER_ADMIN') {
      toast({ title: 'Permission Denied', description: 'Only SuperAdmin can delete loans', variant: 'destructive' });
      return;
    }
    setLoanToDelete(loan);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!loanToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/offline-loan?loanId=${loanToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast({ title: 'Loan Deleted', description: `Loan ${loanToDelete.loanNumber} has been deleted` });
          setDeleteConfirmOpen(false);
          setLoanToDelete(null);
          fetchLoans();
          fetchActionableItems();
        }
      } else {
        const error = await res.json();
        toast({ title: 'Error', description: error.error || 'Failed to delete loan', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete loan', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleUndo = async () => {
    if (undoableActions.length === 0) return;
    try {
      const action = undoableActions[0];
      const res = await fetch('/api/action-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo', actionLogId: action.id, userId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast({ title: 'Action Undone', description: 'The action has been successfully undone' });
          fetchLoans();
          fetchActionableItems();
        }
      }
    } catch (error) {
      console.error('Undo error:', error);
      toast({ title: 'Error', description: 'Failed to undo action', variant: 'destructive' });
    }
  };

  const handleRedo = async () => {
    if (redoableActions.length === 0) return;
    try {
      const action = redoableActions[0];
      const res = await fetch('/api/action-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redo', actionLogId: action.id, userId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast({ title: 'Action Redone', description: 'The action has been successfully redone' });
          fetchLoans();
          fetchActionableItems();
        }
      }
    } catch (error) {
      console.error('Redo error:', error);
      toast({ title: 'Error', description: 'Failed to redo action', variant: 'destructive' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-50 text-green-700 border-green-200';
      case 'CLOSED': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'DEFAULTED': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const filteredLoans = loans.filter(loan =>
    loan.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.loanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.customerPhone.includes(searchQuery) ||
    loan.company?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded"></div>)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" /> Offline Loans (All Companies)
            </CardTitle>
            <div className="flex items-center gap-2">
              {undoableActions.length > 0 && (
                <Button size="sm" variant="secondary" onClick={handleUndo} className="bg-white/20 hover:bg-white/30">
                  <Undo2 className="h-4 w-4 mr-1" /> Undo
                </Button>
              )}
              {redoableActions.length > 0 && (
                <Button size="sm" variant="secondary" onClick={handleRedo} className="bg-white/20 hover:bg-white/30">
                  <Redo2 className="h-4 w-4 mr-1" /> Redo
                </Button>
              )}
              <Badge className="bg-white/20 text-white border-0">{total} Loans</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-10" placeholder="Search by name, loan#, phone, company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Companies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="DEFAULTED">Defaulted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loans List */}
          <ScrollArea className="h-[500px]">
            {filteredLoans.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No offline loans found</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredLoans.map((loan, index) => (
                    <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.03 }}
                      className="p-4 rounded-lg border border-gray-100 bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={getStatusColor(loan.status)}>{loan.status}</Badge>
                            <span className="text-sm font-medium text-gray-600">{loan.loanNumber}</span>
                            <Badge variant="outline">{loan.createdByRole}</Badge>
                            {loan.company && (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700"><Building2 className="h-3 w-3 mr-1" />{loan.company.name}</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{loan.customerName}</span>
                          </div>

                          <div className="text-sm text-gray-500 flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{loan.customerPhone}</div>
                            <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(loan.disbursementDate)}</div>
                          </div>

                          {/* EMI Progress */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-500">EMI Progress</span>
                              <span className="font-medium">{loan.summary.paidEMIs}/{loan.summary.totalEMIs}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                                style={{ width: `${(loan.summary.paidEMIs / loan.summary.totalEMIs) * 100}%` }} />
                            </div>
                            {loan.summary.overdueEMIs > 0 && (
                              <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                                <AlertTriangle className="h-3 w-3" />{loan.summary.overdueEMIs} overdue
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right ml-4">
                          <p className="text-lg font-bold text-gray-900">{formatCurrency(loan.loanAmount)}</p>
                          <p className="text-xs text-gray-500">@{loan.interestRate}% for {loan.tenure} months</p>
                          <p className="text-sm font-medium text-emerald-600 mt-1">EMI: {formatCurrency(loan.emiAmount)}</p>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewLoan(loan)}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                            {userRole === 'SUPER_ADMIN' && (
                              <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteClick(loan)}><Trash2 className="h-4 w-4" /></Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {total > 10 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 10)}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / 10)} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loan Detail Panel */}
      <OfflineLoanDetailPanel
        loanId={selectedLoanId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        userId={userId}
        userRole={userRole}
        onPaymentSuccess={fetchLoans}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Loan?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete loan <strong>{loanToDelete?.loanNumber}</strong>? This action can be undone within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Loan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
