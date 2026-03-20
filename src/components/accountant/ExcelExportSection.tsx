'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  Download, FileSpreadsheet, FileText, Building2, Calendar, 
  Banknote, Users, Receipt, TrendingUp, PieChart, Loader2,
  Landmark, CreditCard, Wallet, Table2, FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Company {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface ExcelExportSectionProps {
  selectedCompanyIds: string[];
  onCompanyChange: (ids: string[]) => void;
}

const REPORT_TYPES = [
  { 
    id: 'customer-loan-details', 
    name: 'Customer-Wise Loan Details', 
    description: 'Complete customer data with all EMI due dates and payment history',
    icon: Users,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50'
  },
  { 
    id: 'full', 
    name: 'Complete Financial Report', 
    description: 'All-in-one comprehensive report for government filing',
    icon: FileSpreadsheet,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  { 
    id: 'emi-collection', 
    name: 'EMI Collection Report', 
    description: 'All EMI payments with customer and loan details',
    icon: CreditCard,
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  { 
    id: 'disbursements', 
    name: 'Loan Disbursement Report', 
    description: 'All loan disbursements with complete details',
    icon: Banknote,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  { 
    id: 'customers', 
    name: 'Customer Report', 
    description: 'Complete customer database with loan history',
    icon: Users,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
  { 
    id: 'loans', 
    name: 'Loan Portfolio Report', 
    description: 'All loans with EMI schedules and outstanding',
    icon: Wallet,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50'
  },
  { 
    id: 'transactions', 
    name: 'Bank Transaction Report', 
    description: 'All bank transactions with reconciliation',
    icon: Landmark,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50'
  },
  { 
    id: 'trial-balance', 
    name: 'Trial Balance', 
    description: 'Chart of accounts with debit/credit balances',
    icon: Table2,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50'
  },
  { 
    id: 'profit-loss', 
    name: 'Profit & Loss Statement', 
    description: 'Income and expense statement',
    icon: TrendingUp,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50'
  },
  { 
    id: 'bank-reconciliation', 
    name: 'Bank Reconciliation', 
    description: 'Bank account balances and reconciliation',
    icon: Receipt,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50'
  }
];

export default function ExcelExportSection({ selectedCompanyIds, onCompanyChange }: ExcelExportSectionProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date()
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedReports, setSelectedReports] = useState<string[]>(['full']);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/company');
      const data = await res.json();
      setCompanies(data.companies || []);
      
      // If no companies selected, select all by default
      if (selectedCompanyIds.length === 0 && data.companies?.length > 0) {
        onCompanyChange(data.companies.map((c: Company) => c.id));
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (reportType: string) => {
    setDownloadingReport(reportType);
    
    try {
      const params = new URLSearchParams({
        type: reportType,
        companyIds: selectedCompanyIds.join(','),
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        format: 'csv'
      });

      const response = await fetch(`/api/accounting/excel-export?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success('Report Downloaded', {
        description: `${REPORT_TYPES.find(r => r.id === reportType)?.name} has been downloaded successfully.`
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Download Failed', {
        description: 'Failed to generate report. Please try again.'
      });
    } finally {
      setDownloadingReport(null);
    }
  };

  const handlePreviewReport = async (reportType: string) => {
    setLoading(true);
    setShowPreview(true);
    
    try {
      const params = new URLSearchParams({
        type: reportType,
        companyIds: selectedCompanyIds.join(','),
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      });

      const response = await fetch(`/api/accounting/excel-export?${params}`);
      const data = await response.json();
      
      setPreviewData(data);
    } catch (error) {
      console.error('Error previewing report:', error);
      toast.error('Preview Failed', {
        description: 'Failed to load preview data.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAllSelected = async () => {
    if (selectedReports.length === 0) {
      toast.error('No Reports Selected', {
        description: 'Please select at least one report to download.'
      });
      return;
    }

    for (const reportId of selectedReports) {
      await handleDownloadReport(reportId);
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const toggleCompany = (companyId: string) => {
    if (selectedCompanyIds.includes(companyId)) {
      onCompanyChange(selectedCompanyIds.filter(id => id !== companyId));
    } else {
      onCompanyChange([...selectedCompanyIds, companyId]);
    }
  };

  const selectAllCompanies = () => {
    onCompanyChange(companies.map(c => c.id));
  };

  const clearCompanySelection = () => {
    onCompanyChange([]);
  };

  const toggleReport = (reportId: string) => {
    if (selectedReports.includes(reportId)) {
      setSelectedReports(selectedReports.filter(id => id !== reportId));
    } else {
      setSelectedReports([...selectedReports, reportId]);
    }
  };

  const selectAllReports = () => {
    setSelectedReports(REPORT_TYPES.map(r => r.id));
  };

  return (
    <div className="space-y-6">
      {/* Company Selection */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Company Selection
              </CardTitle>
              <CardDescription>
                Select one or multiple companies to include in the report
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllCompanies}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearCompanySelection}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {companies.map(company => (
              <motion.div
                key={company.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleCompany(company.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedCompanyIds.includes(company.id)
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedCompanyIds.includes(company.id)}
                    onCheckedChange={() => toggleCompany(company.id)}
                    className="pointer-events-none"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{company.name}</p>
                    <p className="text-xs text-gray-500">{company.code}</p>
                  </div>
                  {company.isActive && (
                    <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          
          {selectedCompanyIds.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <span className="font-medium">{selectedCompanyIds.length}</span> compan{selectedCompanyIds.length === 1 ? 'y' : 'ies'} selected
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date Range */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Date Range
          </CardTitle>
          <CardDescription>
            Select the period for the report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={format(dateRange.startDate, 'yyyy-MM-dd')}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: new Date(e.target.value) }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={format(dateRange.endDate, 'yyyy-MM-dd')}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: new Date(e.target.value) }))}
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="mt-4 flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const today = new Date();
                setDateRange({
                  startDate: new Date(today.getFullYear(), today.getMonth(), 1),
                  endDate: today
                });
              }}
            >
              This Month
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const today = new Date();
                setDateRange({
                  startDate: new Date(today.getFullYear(), today.getMonth() - 1, 1),
                  endDate: new Date(today.getFullYear(), today.getMonth(), 0)
                });
              }}
            >
              Last Month
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const today = new Date();
                setDateRange({
                  startDate: new Date(today.getFullYear(), 0, 1),
                  endDate: today
                });
              }}
            >
              This Year
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const today = new Date();
                setDateRange({
                  startDate: new Date(today.getFullYear() - 1, 0, 1),
                  endDate: new Date(today.getFullYear() - 1, 11, 31)
                });
              }}
            >
              Last Year
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Types */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5 text-green-600" />
                Available Reports
              </CardTitle>
              <CardDescription>
                Select reports to download (compatible with Excel, Google Sheets, and government portals)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllReports}>
                Select All
              </Button>
              <Button 
                variant="default" 
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600"
                onClick={handleDownloadAllSelected}
                disabled={selectedReports.length === 0 || downloadingReport !== null}
              >
                {downloadingReport ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download {selectedReports.length} Report{selectedReports.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REPORT_TYPES.map(report => {
              const Icon = report.icon;
              const isDownloading = downloadingReport === report.id;
              const isSelected = selectedReports.includes(report.id);
              
              return (
                <motion.div
                  key={report.id}
                  whileHover={{ y: -2 }}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleReport(report.id)}
                    />
                    <div className={`w-10 h-10 ${report.bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${report.color}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{report.name}</h4>
                      <p className="text-xs text-gray-500">{report.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePreviewReport(report.id)}
                      disabled={loading}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      onClick={() => handleDownloadReport(report.id)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-1" />
                          CSV
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {previewData?.title || 'Report Preview'}
            </DialogTitle>
            <DialogDescription>
              Preview of the report data
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-200px)]">
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                </div>
              ) : previewData ? (
                <div className="space-y-4">
                  {/* Summary */}
                  {previewData.summary && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-2">Summary</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(previewData.summary).map(([key, value]) => (
                          <div key={key} className="bg-white p-3 rounded-lg">
                            <p className="text-xs text-gray-500">{key}</p>
                            <p className="font-bold">
                              {typeof value === 'number' ? value.toLocaleString('en-IN', { 
                                style: 'currency', 
                                currency: 'INR',
                                maximumFractionDigits: 0 
                              }) : JSON.stringify(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Records Table */}
                  {previewData.records && previewData.records.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            {Object.keys(previewData.records[0]).map(header => (
                              <th key={header} className="p-2 text-left font-medium text-gray-700 whitespace-nowrap">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.records.slice(0, 20).map((record: any, index: number) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              {Object.values(record).map((value: any, i: number) => (
                                <td key={i} className="p-2 whitespace-nowrap">
                                  {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {previewData.records.length > 20 && (
                        <p className="text-center text-gray-500 text-sm mt-4">
                          Showing 20 of {previewData.records.length} records. Download to see all records.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">No data available</p>
              )}
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-4 border-t">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button 
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={() => {
                if (previewData?.title) {
                  const reportType = REPORT_TYPES.find(r => 
                    r.name.toLowerCase().includes(previewData.title.toLowerCase())
                  )?.id || 'full';
                  handleDownloadReport(reportType);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Eye icon component
function Eye({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
