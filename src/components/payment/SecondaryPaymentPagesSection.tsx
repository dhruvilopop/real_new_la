'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Plus, Trash2, Loader2, Building2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SecondaryPaymentPage {
  id: string;
  name: string;
  description: string | null;
  upiId: string | null;
  qrCodeUrl: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  ifscCode: string | null;
  companyId: string;
  company?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  createdAt: string;
}

interface SecondaryPaymentPagesSectionProps {
  userId?: string;
  companyId?: string; // If provided, only show pages for this company
  showCompanyFilter?: boolean; // If true, show company dropdown filter
}

export default function SecondaryPaymentPagesSection({ 
  userId, 
  companyId: propCompanyId, 
  showCompanyFilter = true 
}: SecondaryPaymentPagesSectionProps) {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<SecondaryPaymentPage[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(propCompanyId || 'all');
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    upiId: '',
    qrCodeUrl: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    ifscCode: '',
    companyId: ''
  });

  const [qrPreview, setQrPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies();
    fetchPages();
  }, []);

  useEffect(() => {
    if (propCompanyId) {
      setSelectedCompanyId(propCompanyId);
    }
  }, [propCompanyId]);

  useEffect(() => {
    fetchPages();
  }, [selectedCompanyId]);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/company?isActive=true');
      const data = await response.json();
      if (data.companies) {
        setCompanies(data.companies);
        // Set default company for new page
        if (!formData.companyId && data.companies.length > 0) {
          setFormData(prev => ({ ...prev, companyId: data.companies[0].id }));
        }
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const fetchPages = async () => {
    setLoading(true);
    try {
      let url = '/api/emi-payment-settings?action=secondary-pages';
      if (selectedCompanyId && selectedCompanyId !== 'all') {
        url += `&companyId=${selectedCompanyId}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setPages(data.pages || []);
      }
    } catch (error) {
      console.error('Error fetching secondary payment pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQrCodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Only PNG, JPG, WEBP, and GIF images are allowed.',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Maximum file size is 5MB.',
        variant: 'destructive'
      });
      return;
    }

    setUploadingQr(true);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/upload/qr-code', {
        method: 'POST',
        body: formDataUpload
      });

      const data = await response.json();

      if (data.success && data.url) {
        setFormData(prev => ({ ...prev, qrCodeUrl: data.url }));
        setQrPreview(data.url);
        toast({
          title: 'QR Code Uploaded',
          description: 'QR code image has been uploaded successfully.'
        });
      } else {
        throw new Error(data.error || 'Failed to upload QR code');
      }
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload QR code image',
        variant: 'destructive'
      });
    } finally {
      setUploadingQr(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveQrCode = () => {
    setFormData(prev => ({ ...prev, qrCodeUrl: '' }));
    setQrPreview(null);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.companyId) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a name and select a company',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/emi-payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-secondary-page',
          ...formData,
          createdById: userId
        })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Payment Page Created',
          description: 'Secondary payment page has been created successfully'
        });
        setShowDialog(false);
        resetForm();
        fetchPages();
      } else {
        throw new Error(data.error || 'Failed to create payment page');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create payment page',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this payment page?')) return;
    
    setDeleting(pageId);
    try {
      const response = await fetch(`/api/emi-payment-settings?pageId=${pageId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Payment Page Deleted',
          description: 'Secondary payment page has been deleted'
        });
        fetchPages();
      } else {
        throw new Error(data.error || 'Failed to delete payment page');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete payment page',
        variant: 'destructive'
      });
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      upiId: '',
      qrCodeUrl: '',
      bankName: '',
      accountNumber: '',
      accountName: '',
      ifscCode: '',
      companyId: companies[0]?.id || ''
    });
    setQrPreview(null);
  };

  const filteredPages = selectedCompanyId === 'all' 
    ? pages 
    : pages.filter(p => p.companyId === selectedCompanyId);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-600" />
                Secondary Payment Pages
              </CardTitle>
              <CardDescription>
                Additional payment pages with different UPI/QR/Bank details. Money is tracked in the default company bank account.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {showCompanyFilter && companies.length > 1 && (
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={() => {
                resetForm();
                setShowDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-2" /> Add Payment Page
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No secondary payment pages</p>
              <p className="text-sm mt-2">Create additional payment pages to show different UPI/QR/Bank details to customers</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPages.map((page) => (
                <Card key={page.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{page.name}</h4>
                        <p className="text-sm text-muted-foreground">{page.description || 'No description'}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(page.id)}
                        disabled={deleting === page.id}
                      >
                        {deleting === page.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {page.company && (
                      <div className="mb-3">
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="h-3 w-3 mr-1" />
                          {page.company.name}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="space-y-2 text-sm">
                      {page.upiId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">UPI ID:</span>
                          <span className="font-mono">{page.upiId}</span>
                        </div>
                      )}
                      {page.bankName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bank:</span>
                          <span>{page.bankName}</span>
                        </div>
                      )}
                      {page.accountNumber && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Account:</span>
                          <span className="font-mono">{page.accountNumber}</span>
                        </div>
                      )}
                      {page.qrCodeUrl && (
                        <div className="mt-3">
                          <img 
                            src={page.qrCodeUrl} 
                            alt="QR Code" 
                            className="w-24 h-24 rounded-lg border object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-qr.png';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Payment Page Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Secondary Payment Page</DialogTitle>
            <DialogDescription>
              Create an additional payment page with different UPI/QR/Bank details. 
              Money will still be tracked in the default company bank account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Page Name *</Label>
                <Input 
                  placeholder="e.g., Partner Collection Point 1" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Company *</Label>
                <Select 
                  value={formData.companyId} 
                  onValueChange={(value) => setFormData({ ...formData, companyId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                placeholder="Brief description of this payment page" 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>UPI ID</Label>
                <Input 
                  placeholder="e.g., partner@upi" 
                  value={formData.upiId}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>QR Code Image</Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQrCodeUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingQr}
                    className="w-full"
                  >
                    {uploadingQr ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {uploadingQr ? 'Uploading...' : 'Upload QR'}
                  </Button>
                </div>
              </div>
            </div>

            {/* QR Code Preview */}
            {(qrPreview || formData.qrCodeUrl) && (
              <div className="relative inline-block">
                <img 
                  src={qrPreview || formData.qrCodeUrl} 
                  alt="QR Code Preview" 
                  className="w-32 h-32 rounded-lg border object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0"
                  onClick={handleRemoveQrCode}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input 
                  placeholder="e.g., HDFC Bank" 
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input 
                  placeholder="1234567890" 
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input 
                  placeholder="Name on account" 
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>IFSC Code</Label>
                <Input 
                  placeholder="HDFC0001234" 
                  value={formData.ifscCode}
                  onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Payment Page'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
