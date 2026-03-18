'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wallet, Building, User, ArrowRight, IndianRupee, Clock, CheckCircle, XCircle,
  Banknote, FileText, TrendingUp, TrendingDown, RefreshCw, Loader2, AlertCircle,
  ArrowUpRight, ArrowDownRight, History, Plus, Minus, Send
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

interface SettlementRequest {
  id: string;
  settlementNumber: string;
  amount: number;
  paymentMode: string;
  status: string;
  createdAt: string;
  remarks?: string;
  cashier: {
    id: string;
    name: string;
    role: string;
  };
}

export default function CreditSettlementRequest() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [personalCredit, setPersonalCredit] = useState(0);
  const [companyCredit, setCompanyCredit] = useState(0);
  const [settlements, setSettlements] = useState<SettlementRequest[]>([]);
  const [superAdmins, setSuperAdmins] = useState<any[]>([]);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [requestForm, setRequestForm] = useState({
    superAdminId: '',
    amount: 0,
    creditType: 'COMPANY',
    paymentMode: 'CASH',
    remarks: ''
  });

  useEffect(() => {
    if (user?.id) {
      fetchCreditData();
      fetchSettlements();
      fetchSuperAdmins();
    }
  }, [user?.id]);

  const fetchCreditData = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`/api/credit?userId=${user.id}&action=summary`);
      const data = await response.json();
      if (data.success) {
        setPersonalCredit(data.summary?.personalCredit || 0);
        setCompanyCredit(data.summary?.companyCredit || 0);
      }
    } catch (error) {
      console.error('Error fetching credit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettlements = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`/api/credit/settlement?userId=${user.id}`);
      const data = await response.json();
      if (data.success) {
        setSettlements(data.settlements || []);
      }
    } catch (error) {
      console.error('Error fetching settlements:', error);
    }
  };

  const fetchSuperAdmins = async () => {
    try {
      const response = await fetch('/api/user?role=SUPER_ADMIN');
      const data = await response.json();
      if (data.users) {
        setSuperAdmins(data.users.filter((u: any) => u.isActive));
      }
    } catch (error) {
      console.error('Error fetching super admins:', error);
    }
  };

  const handleSubmitRequest = async () => {
    if (!user?.id) return;
    
    if (!requestForm.superAdminId) {
      toast({ title: 'Error', description: 'Please select a Super Admin', variant: 'destructive' });
      return;
    }
    
    if (requestForm.amount <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    
    const availableCredit = requestForm.creditType === 'COMPANY' ? companyCredit : personalCredit;
    if (requestForm.amount > availableCredit) {
      toast({ title: 'Error', description: `Insufficient ${requestForm.creditType.toLowerCase()} credit. Available: ₹${formatCurrency(availableCredit)}`, variant: 'destructive' });
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch('/api/credit/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          superAdminId: requestForm.superAdminId,
          amount: requestForm.amount,
          creditType: requestForm.creditType,
          paymentMode: requestForm.paymentMode,
          remarks: requestForm.remarks
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Settlement Request Submitted',
          description: `Your request to clear ₹${formatCurrency(requestForm.amount)} has been submitted. Wait for Super Admin to verify and complete.`
        });
        setShowRequestDialog(false);
        setRequestForm({
          superAdminId: '',
          amount: 0,
          creditType: 'COMPANY',
          paymentMode: 'CASH',
          remarks: ''
        });
        fetchCreditData();
        fetchSettlements();
      } else {
        throw new Error(data.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Error submitting settlement request:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit settlement request',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      PENDING: { className: 'bg-amber-100 text-amber-700', label: 'Pending' },
      COMPLETED: { className: 'bg-green-100 text-green-700', label: 'Completed' },
      REJECTED: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
      VERIFIED: { className: 'bg-blue-100 text-blue-700', label: 'Verified' }
    };
    const c = config[status] || { className: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const totalCredit = companyCredit + personalCredit;

  return (
    <div className="space-y-6">
      {/* Credit Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Total Credit</p>
                  <p className="text-3xl font-bold mt-1">₹{formatCurrency(totalCredit)}</p>
                  <p className="text-emerald-200 text-xs mt-1">Awaiting settlement</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Company Credit</p>
                  <p className="text-3xl font-bold mt-1">₹{formatCurrency(companyCredit)}</p>
                  <p className="text-blue-200 text-xs mt-1">From CASH payments</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Building className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">Personal Credit</p>
                  <p className="text-3xl font-bold mt-1">₹{formatCurrency(personalCredit)}</p>
                  <p className="text-amber-200 text-xs mt-1">From non-CASH payments</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <User className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold">How Settlement Works:</p>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Submit a request to clear your credit with Super Admin</li>
                <li>Give the money to Super Admin</li>
                <li>Super Admin will verify and complete the settlement</li>
                <li>Your credit will be deducted and cleared</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Credit Settlement</CardTitle>
              <CardDescription>Request to clear your credit with Super Admin</CardDescription>
            </div>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={() => setShowRequestDialog(true)}
              disabled={totalCredit === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              Request Settlement
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {totalCredit === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-300" />
              <p className="font-medium">No Credit to Settle</p>
              <p className="text-sm">Your credit balance is zero. Collect EMI payments to build credit.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                You have ₹{formatCurrency(totalCredit)} total credit that can be settled with Super Admin.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Settlement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No settlement requests yet</p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {settlements.map((settlement) => (
                  <div key={settlement.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        settlement.status === 'COMPLETED' ? 'bg-green-100' :
                        settlement.status === 'REJECTED' ? 'bg-red-100' :
                        'bg-amber-100'
                      }`}>
                        {settlement.status === 'COMPLETED' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : settlement.status === 'REJECTED' ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{settlement.settlementNumber}</p>
                        <p className="text-sm text-gray-500">
                          To: {settlement.cashier?.name || 'Super Admin'}
                        </p>
                        <p className="text-xs text-gray-400">{formatDate(settlement.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{formatCurrency(settlement.amount)}</p>
                      {getStatusBadge(settlement.status)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-600" />
              Request Settlement
            </DialogTitle>
            <DialogDescription>
              Submit a request to clear your credit with Super Admin
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-700">
                After submitting, you need to give the money to Super Admin. They will verify and complete the settlement to clear your credit.
              </p>
            </div>
            
            <div>
              <Label>Select Super Admin</Label>
              <Select 
                value={requestForm.superAdminId} 
                onValueChange={(v) => setRequestForm({ ...requestForm, superAdminId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Super Admin" />
                </SelectTrigger>
                <SelectContent>
                  {superAdmins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.name} ({admin.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Credit Type to Clear</Label>
              <Select 
                value={requestForm.creditType} 
                onValueChange={(v) => setRequestForm({ ...requestForm, creditType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Company Credit (₹{formatCurrency(companyCredit)})</SelectItem>
                  <SelectItem value="PERSONAL">Personal Credit (₹{formatCurrency(personalCredit)})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={requestForm.amount || ''}
                onChange={(e) => setRequestForm({ ...requestForm, amount: parseFloat(e.target.value) || 0 })}
                placeholder="Enter amount"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available: ₹{formatCurrency(requestForm.creditType === 'COMPANY' ? companyCredit : personalCredit)}
              </p>
            </div>
            
            <div>
              <Label>Payment Mode</Label>
              <Select 
                value={requestForm.paymentMode} 
                onValueChange={(v) => setRequestForm({ ...requestForm, paymentMode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Remarks (Optional)</Label>
              <Textarea
                value={requestForm.remarks}
                onChange={(e) => setRequestForm({ ...requestForm, remarks: e.target.value })}
                placeholder="Add any notes..."
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={handleSubmitRequest}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
