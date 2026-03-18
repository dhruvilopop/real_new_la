'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { 
  Building2, ChevronDown, Check, X, Loader2, Settings, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  bankAccounts?: BankAccount[];
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  currentBalance: number;
  isDefault: boolean;
}

interface CompanySelectorProps {
  selectedCompanyIds: string[];
  onSelectionChange: (ids: string[]) => void;
  selectedBankAccountId?: string;
  onBankAccountChange?: (id: string) => void;
}

export default function CompanySelector({ 
  selectedCompanyIds, 
  onSelectionChange,
  selectedBankAccountId,
  onBankAccountChange
}: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  useEffect(() => {
    fetchCompanies();
  }, []);
  
  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/company');
      const data = await res.json();
      const companiesWithBanks = await Promise.all(
        (data.companies || []).map(async (company: Company) => {
          try {
            const bankRes = await fetch(`/api/accounting/bank-accounts?companyId=${company.id}`);
            const bankData = await bankRes.json();
            return { ...company, bankAccounts: bankData.bankAccounts || [] };
          } catch {
            return { ...company, bankAccounts: [] };
          }
        })
      );
      setCompanies(companiesWithBanks);
      
      // Auto-select first company's default bank account if none selected
      if (!selectedBankAccountId && companiesWithBanks.length > 0) {
        const firstCompany = companiesWithBanks[0];
        const defaultBank = firstCompany.bankAccounts?.find(b => b.isDefault);
        if (defaultBank && onBankAccountChange) {
          onBankAccountChange(defaultBank.id);
        }
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleCompany = (companyId: string) => {
    if (selectedCompanyIds.includes(companyId)) {
      onSelectionChange(selectedCompanyIds.filter(id => id !== companyId));
    } else {
      onSelectionChange([...selectedCompanyIds, companyId]);
    }
  };
  
  const selectAll = () => {
    onSelectionChange(companies.map(c => c.id));
  };
  
  const clearAll = () => {
    onSelectionChange([]);
  };
  
  const selectedCompanies = companies.filter(c => selectedCompanyIds.includes(c.id));
  const displayText = selectedCompanyIds.length === 0 
    ? 'All Companies' 
    : selectedCompanyIds.length === 1 
      ? selectedCompanies[0]?.name 
      : `${selectedCompanyIds.length} Companies`;
  
  // Get bank accounts for selected companies
  const availableBankAccounts = selectedCompanies.flatMap(c => 
    (c.bankAccounts || []).map(b => ({ ...b, companyName: c.name, companyId: c.id }))
  );
  
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 min-w-[200px] justify-between"
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-600" />
          <span className="truncate">{displayText}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 border-b bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <DialogTitle className="text-xl flex items-center gap-2 text-white">
              <Building2 className="h-6 w-6" />
              Company Selection
            </DialogTitle>
            <DialogDescription className="text-blue-100">
              Select companies for reporting and operations. Each company has its own bank accounts.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-200px)]">
            <div className="p-6 space-y-4">
              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear Selection
                </Button>
              </div>
              
              <Separator />
              
              {/* Company List */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="space-y-3">
                  {companies.map(company => {
                    const isSelected = selectedCompanyIds.includes(company.id);
                    const bankCount = company.bankAccounts?.length || 0;
                    const totalBalance = company.bankAccounts?.reduce((sum, b) => sum + b.currentBalance, 0) || 0;
                    
                    return (
                      <motion.div
                        key={company.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => toggleCompany(company.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCompany(company.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">{company.name}</h4>
                                <Badge variant="outline" className="text-xs">{company.code}</Badge>
                              </div>
                              <p className="text-sm text-gray-500">
                                {bankCount} bank account{bankCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">
                              ₹{totalBalance.toLocaleString('en-IN')}
                            </p>
                            <p className="text-xs text-gray-500">Total Balance</p>
                          </div>
                        </div>
                        
                        {/* Show Bank Accounts */}
                        {isSelected && bankCount > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="mt-3 pt-3 border-t"
                          >
                            <p className="text-xs text-gray-500 mb-2">Bank Accounts:</p>
                            <div className="grid grid-cols-2 gap-2">
                              {company.bankAccounts?.map(account => (
                                <div
                                  key={account.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onBankAccountChange) {
                                      onBankAccountChange(account.id);
                                    }
                                  }}
                                  className={`p-2 rounded-lg border cursor-pointer transition-all ${
                                    selectedBankAccountId === account.id
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <p className="text-xs font-medium">{account.bankName}</p>
                                  <p className="text-xs text-gray-500">
                                    ****{account.accountNumber.slice(-4)}
                                  </p>
                                  <p className="text-xs font-bold text-emerald-600">
                                    ₹{account.currentBalance.toLocaleString('en-IN')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-gray-500">
                {selectedCompanyIds.length} compan{selectedCompanyIds.length === 1 ? 'y' : 'ies'} selected
              </p>
              <Button onClick={() => setOpen(false)} className="bg-emerald-500 hover:bg-emerald-600">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
