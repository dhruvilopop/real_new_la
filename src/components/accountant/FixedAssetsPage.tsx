'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Building2, Plus, Search, Eye, Edit, Trash2, Calculator, 
  FileText, TrendingDown, AlertTriangle, CheckCircle, Clock,
  Printer, Download, RefreshCw, Package, Truck, Monitor,
  Car, Factory, Home, Cpu, Zap, FileCode, MoreHorizontal,
  Calendar, IndianRupee, Percent, Shield, Wrench
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface FixedAsset {
  id: string;
  assetCode: string;
  assetName: string;
  assetCategory: string;
  description?: string;
  serialNumber?: string;
  location?: string;
  department?: string;
  purchaseDate: Date | string;
  purchaseCost: number;
  additionalCosts: number;
  totalCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  depreciationRate: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
  lastDepreciationDate?: Date | string;
  status: string;
  disposalDate?: Date | string;
  disposalValue?: number;
  disposalReason?: string;
  insuranceProvider?: string;
  insurancePolicyNo?: string;
  insuranceExpiryDate?: Date | string;
  warrantyProvider?: string;
  warrantyExpiryDate?: Date | string;
  invoiceNumber?: string;
  invoiceDate?: Date | string;
  imageUrl?: string;
  createdAt: Date | string;
  depreciationLogs?: DepreciationLog[];
}

interface DepreciationLog {
  id: string;
  depreciationDate: Date | string;
  financialYear: string;
  period: string;
  openingBookValue: number;
  depreciationAmount: number;
  closingBookValue: number;
}

interface AssetSummary {
  totalAssets: number;
  totalCost: number;
  totalDepreciation: number;
  totalBookValue: number;
  activeCount: number;
  disposedCount: number;
  byCategory: Record<string, { count: number; value: number }>;
}

// Asset Category Options
const ASSET_CATEGORIES = [
  { value: 'FURNITURE_FIXTURES', label: 'Furniture & Fixtures', icon: Package },
  { value: 'OFFICE_EQUIPMENT', label: 'Office Equipment', icon: Monitor },
  { value: 'VEHICLES', label: 'Vehicles', icon: Car },
  { value: 'MACHINERY_PLANT', label: 'Machinery & Plant', icon: Factory },
  { value: 'BUILDINGS', label: 'Buildings', icon: Home },
  { value: 'LAND', label: 'Land', icon: Building2 },
  { value: 'ELECTRONICS', label: 'Electronics', icon: Cpu },
  { value: 'ELECTRICAL_INSTALLATIONS', label: 'Electrical Installations', icon: Zap },
  { value: 'INTANGIBLE_ASSETS', label: 'Intangible Assets', icon: FileCode },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal },
];

const DEPRECIATION_METHODS = [
  { value: 'STRAIGHT_LINE', label: 'Straight Line Method' },
  { value: 'DIMINISHING_BALANCE', label: 'Diminishing Balance Method' },
  { value: 'WRITTEN_DOWN_VALUE', label: 'Written Down Value (WDV)' },
  { value: 'UNITS_OF_PRODUCTION', label: 'Units of Production' },
];

const ASSET_STATUS = [
  { value: 'ACTIVE', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'DISPOSED', label: 'Disposed', color: 'bg-red-100 text-red-800' },
  { value: 'WRITTEN_OFF', label: 'Written Off', color: 'bg-gray-100 text-gray-800' },
  { value: 'SOLD', label: 'Sold', color: 'bg-blue-100 text-blue-800' },
  { value: 'IDLE', label: 'Idle', color: 'bg-orange-100 text-orange-800' },
];

interface FixedAssetsPageProps {
  user?: any;
}

export default function FixedAssetsPage({ user }: FixedAssetsPageProps) {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDepreciationDialog, setShowDepreciationDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  
  // Selected asset
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [depreciationSchedule, setDepreciationSchedule] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    assetCode: '',
    assetName: '',
    assetCategory: 'OFFICE_EQUIPMENT',
    description: '',
    serialNumber: '',
    location: '',
    department: '',
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    purchaseCost: 0,
    additionalCosts: 0,
    salvageValue: 0,
    usefulLifeYears: 5,
    usefulLifeMonths: 60,
    depreciationMethod: 'STRAIGHT_LINE',
    depreciationRate: 0,
    insuranceProvider: '',
    insurancePolicyNo: '',
    insuranceExpiryDate: '',
    warrantyProvider: '',
    warrantyExpiryDate: '',
    invoiceNumber: '',
    invoiceDate: '',
  });

  const companyId = user?.companyId || 'default';
  const createdById = user?.id || 'system';

  useEffect(() => {
    fetchAssets();
  }, [categoryFilter, statusFilter]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId });
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/accounting/fixed-assets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to fetch fixed assets');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchAssets();
  };

  const handleAddAsset = async () => {
    // Validate required fields
    if (!formData.assetCode || !formData.assetName || !formData.purchaseCost || !formData.usefulLifeYears) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const res = await fetch('/api/accounting/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyId,
          createdById,
        }),
      });

      if (res.ok) {
        toast.success('Fixed asset added successfully');
        setShowAddDialog(false);
        resetForm();
        fetchAssets();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to add fixed asset');
      }
    } catch (error) {
      toast.error('Failed to add fixed asset');
    }
  };

  const handleUpdateAsset = async () => {
    if (!selectedAsset) return;

    try {
      const res = await fetch('/api/accounting/fixed-assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAsset.id,
          ...formData,
        }),
      });

      if (res.ok) {
        toast.success('Asset updated successfully');
        setShowEditDialog(false);
        setSelectedAsset(null);
        fetchAssets();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update asset');
      }
    } catch (error) {
      toast.error('Failed to update asset');
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;

    try {
      const res = await fetch(`/api/accounting/fixed-assets?id=${selectedAsset.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Asset deleted successfully');
        setShowDeleteDialog(false);
        setSelectedAsset(null);
        fetchAssets();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to delete asset');
      }
    } catch (error) {
      toast.error('Failed to delete asset');
    }
  };

  const handleCalculateDepreciation = async () => {
    try {
      const res = await fetch('/api/accounting/fixed-assets/depreciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          calculationDate: new Date(),
          period: format(new Date(), 'MMMM yyyy'),
          financialYear: getCurrentFinancialYear(),
          createJournalEntry: true,
          createdById,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Depreciation calculated for ${data.results.filter((r: any) => r.status === 'success').length} assets`);
        setShowDepreciationDialog(false);
        fetchAssets();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to calculate depreciation');
      }
    } catch (error) {
      toast.error('Failed to calculate depreciation');
    }
  };

  const fetchDepreciationSchedule = async (assetId: string) => {
    try {
      const res = await fetch(`/api/accounting/fixed-assets/depreciation?assetId=${assetId}&companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setDepreciationSchedule(data);
      }
    } catch (error) {
      console.error('Error fetching depreciation schedule:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      assetCode: '',
      assetName: '',
      assetCategory: 'OFFICE_EQUIPMENT',
      description: '',
      serialNumber: '',
      location: '',
      department: '',
      purchaseDate: format(new Date(), 'yyyy-MM-dd'),
      purchaseCost: 0,
      additionalCosts: 0,
      salvageValue: 0,
      usefulLifeYears: 5,
      usefulLifeMonths: 60,
      depreciationMethod: 'STRAIGHT_LINE',
      depreciationRate: 0,
      insuranceProvider: '',
      insurancePolicyNo: '',
      insuranceExpiryDate: '',
      warrantyProvider: '',
      warrantyExpiryDate: '',
      invoiceNumber: '',
      invoiceDate: '',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (date: Date | string) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy');
  };

  const getCategoryLabel = (category: string) => {
    const cat = ASSET_CATEGORIES.find(c => c.value === category);
    return cat?.label || category;
  };

  const getStatusBadge = (status: string) => {
    const st = ASSET_STATUS.find(s => s.value === status);
    return (
      <Badge className={st?.color || 'bg-gray-100 text-gray-800'}>
        {st?.label || status}
      </Badge>
    );
  };

  const getCurrentFinancialYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    if (month >= 4) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  };

  const getDepreciationProgress = (asset: FixedAsset) => {
    if (asset.totalCost === 0) return 0;
    return Math.min(100, (asset.accumulatedDepreciation / (asset.totalCost - asset.salvageValue)) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fixed Assets</h1>
          <p className="text-muted-foreground">Manage company assets and track depreciation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDepreciationDialog(true)}>
            <Calculator className="h-4 w-4 mr-2" /> Calculate Depreciation
          </Button>
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Asset
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold">{summary.totalAssets}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalCost)}</p>
                </div>
                <IndianRupee className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accumulated Dep.</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalDepreciation)}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Book Value</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalBookValue)}</p>
                </div>
                <Building2 className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Search by code, name, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ASSET_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {ASSET_STATUS.map(st => (
                  <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSearch}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Book Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading assets...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">No fixed assets found</p>
                      <Button className="mt-4" onClick={() => { resetForm(); setShowAddDialog(true); }}>
                        <Plus className="h-4 w-4 mr-2" /> Add First Asset
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  assets.map((asset) => (
                    <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono font-bold">{asset.assetCode}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{asset.assetName}</p>
                          {asset.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{asset.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryLabel(asset.assetCategory)}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(asset.purchaseDate)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(asset.totalCost)}</TableCell>
                      <TableCell className="text-right font-mono">
                        <div>
                          <p className="font-bold text-green-600">{formatCurrency(asset.currentBookValue)}</p>
                          <Progress value={getDepreciationProgress(asset)} className="h-1 mt-1" />
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(asset.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAsset(asset);
                              fetchDepreciationSchedule(asset.id);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setFormData({
                                assetCode: asset.assetCode,
                                assetName: asset.assetName,
                                assetCategory: asset.assetCategory,
                                description: asset.description || '',
                                serialNumber: asset.serialNumber || '',
                                location: asset.location || '',
                                department: asset.department || '',
                                purchaseDate: format(new Date(asset.purchaseDate), 'yyyy-MM-dd'),
                                purchaseCost: asset.purchaseCost,
                                additionalCosts: asset.additionalCosts,
                                salvageValue: asset.salvageValue,
                                usefulLifeYears: asset.usefulLifeYears,
                                usefulLifeMonths: asset.usefulLifeMonths,
                                depreciationMethod: asset.depreciationMethod,
                                depreciationRate: asset.depreciationRate,
                                insuranceProvider: asset.insuranceProvider || '',
                                insurancePolicyNo: asset.insurancePolicyNo || '',
                                insuranceExpiryDate: asset.insuranceExpiryDate ? format(new Date(asset.insuranceExpiryDate), 'yyyy-MM-dd') : '',
                                warrantyProvider: asset.warrantyProvider || '',
                                warrantyExpiryDate: asset.warrantyExpiryDate ? format(new Date(asset.warrantyExpiryDate), 'yyyy-MM-dd') : '',
                                invoiceNumber: asset.invoiceNumber || '',
                                invoiceDate: asset.invoiceDate ? format(new Date(asset.invoiceDate), 'yyyy-MM-dd') : '',
                              });
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Asset Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Fixed Asset</DialogTitle>
            <DialogDescription>Enter the details of the new fixed asset</DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="insurance">Insurance</TabsTrigger>
              <TabsTrigger value="invoice">Invoice</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Asset Code *</Label>
                  <Input
                    value={formData.assetCode}
                    onChange={(e) => setFormData({ ...formData, assetCode: e.target.value })}
                    placeholder="e.g., FA-001"
                  />
                </div>
                <div>
                  <Label>Asset Name *</Label>
                  <Input
                    value={formData.assetName}
                    onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                    placeholder="e.g., Dell Laptop"
                  />
                </div>
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={formData.assetCategory} onValueChange={(v) => setFormData({ ...formData, assetCategory: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of the asset..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Serial Number</Label>
                  <Input
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="Serial/Asset tag"
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Physical location"
                  />
                </div>
                <div>
                  <Label>Department</Label>
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Using department"
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="financial" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Purchase Date *</Label>
                  <Input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Purchase Cost *</Label>
                  <Input
                    type="number"
                    value={formData.purchaseCost}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Additional Costs</Label>
                  <Input
                    type="number"
                    value={formData.additionalCosts}
                    onChange={(e) => setFormData({ ...formData, additionalCosts: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Total Cost</Label>
                  <Input
                    disabled
                    value={formatCurrency(formData.purchaseCost + formData.additionalCosts)}
                    className="bg-muted"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Salvage Value</Label>
                  <Input
                    type="number"
                    value={formData.salvageValue}
                    onChange={(e) => setFormData({ ...formData, salvageValue: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Useful Life (Years) *</Label>
                  <Input
                    type="number"
                    value={formData.usefulLifeYears}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      usefulLifeYears: parseInt(e.target.value) || 1,
                      usefulLifeMonths: (parseInt(e.target.value) || 1) * 12
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Depreciation Method</Label>
                  <Select value={formData.depreciationMethod} onValueChange={(v) => setFormData({ ...formData, depreciationMethod: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPRECIATION_METHODS.map(method => (
                        <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Depreciation Rate (%)</Label>
                  <Input
                    type="number"
                    value={formData.depreciationRate}
                    onChange={(e) => setFormData({ ...formData, depreciationRate: parseFloat(e.target.value) || 0 })}
                    placeholder="Auto-calculated if empty"
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="insurance" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Insurance Provider</Label>
                  <Input
                    value={formData.insuranceProvider}
                    onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Policy Number</Label>
                  <Input
                    value={formData.insurancePolicyNo}
                    onChange={(e) => setFormData({ ...formData, insurancePolicyNo: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Insurance Expiry Date</Label>
                  <Input
                    type="date"
                    value={formData.insuranceExpiryDate}
                    onChange={(e) => setFormData({ ...formData, insuranceExpiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Warranty Provider</Label>
                  <Input
                    value={formData.warrantyProvider}
                    onChange={(e) => setFormData({ ...formData, warrantyProvider: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Warranty Expiry Date</Label>
                <Input
                  type="date"
                  value={formData.warrantyExpiryDate}
                  onChange={(e) => setFormData({ ...formData, warrantyExpiryDate: e.target.value })}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="invoice" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Number</Label>
                  <Input
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddAsset}>Add Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {selectedAsset?.assetName}
            </DialogTitle>
            <DialogDescription>{selectedAsset?.assetCode}</DialogDescription>
          </DialogHeader>
          
          {selectedAsset && (
            <div className="space-y-6">
              {/* Asset Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Asset Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span>{getCategoryLabel(selectedAsset.assetCategory)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      {getStatusBadge(selectedAsset.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span>{selectedAsset.location || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Serial No:</span>
                      <span>{selectedAsset.serialNumber || '-'}</span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Financial Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Cost:</span>
                      <span className="font-mono">{formatCurrency(selectedAsset.purchaseCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Cost:</span>
                      <span className="font-mono font-bold">{formatCurrency(selectedAsset.totalCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Accum. Depreciation:</span>
                      <span className="font-mono text-orange-600">{formatCurrency(selectedAsset.accumulatedDepreciation)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">Current Book Value:</span>
                      <span className="font-mono font-bold text-green-600">{formatCurrency(selectedAsset.currentBookValue)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Depreciation Progress */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Depreciation Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={getDepreciationProgress(selectedAsset)} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>0%</span>
                    <span>{getDepreciationProgress(selectedAsset).toFixed(1)}% depreciated</span>
                    <span>100%</span>
                  </div>
                </CardContent>
              </Card>
              
              {/* Depreciation History */}
              {depreciationSchedule?.depreciationHistory?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Depreciation History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-40">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Depreciation</TableHead>
                            <TableHead className="text-right">Book Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {depreciationSchedule.depreciationHistory.map((log: DepreciationLog) => (
                            <TableRow key={log.id}>
                              <TableCell>{log.period}</TableCell>
                              <TableCell className="text-right font-mono text-orange-600">
                                {formatCurrency(log.depreciationAmount)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(log.closingBookValue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            <Button onClick={() => {
              setShowDetailDialog(false);
              if (selectedAsset) {
                fetchDepreciationSchedule(selectedAsset.id);
                setShowScheduleDialog(true);
              }
            }}>
              <Calculator className="h-4 w-4 mr-2" /> View Full Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Fixed Asset</DialogTitle>
            <DialogDescription>Update the details of {selectedAsset?.assetCode}</DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="insurance">Insurance</TabsTrigger>
              <TabsTrigger value="invoice">Invoice</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Asset Code</Label>
                  <Input disabled value={formData.assetCode} className="bg-muted" />
                </div>
                <div>
                  <Label>Asset Name</Label>
                  <Input
                    value={formData.assetName}
                    onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.assetCategory} onValueChange={(v) => setFormData({ ...formData, assetCategory: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Serial Number</Label>
                  <Input
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Department</Label>
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="financial" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Purchase Date</Label>
                  <Input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Purchase Cost</Label>
                  <Input
                    type="number"
                    value={formData.purchaseCost}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Additional Costs</Label>
                  <Input
                    type="number"
                    value={formData.additionalCosts}
                    onChange={(e) => setFormData({ ...formData, additionalCosts: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Salvage Value</Label>
                  <Input
                    type="number"
                    value={formData.salvageValue}
                    onChange={(e) => setFormData({ ...formData, salvageValue: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="insurance" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Insurance Provider</Label>
                  <Input
                    value={formData.insuranceProvider}
                    onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Policy Number</Label>
                  <Input
                    value={formData.insurancePolicyNo}
                    onChange={(e) => setFormData({ ...formData, insurancePolicyNo: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Insurance Expiry</Label>
                  <Input
                    type="date"
                    value={formData.insuranceExpiryDate}
                    onChange={(e) => setFormData({ ...formData, insuranceExpiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Warranty Expiry</Label>
                  <Input
                    type="date"
                    value={formData.warrantyExpiryDate}
                    onChange={(e) => setFormData({ ...formData, warrantyExpiryDate: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="invoice" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Number</Label>
                  <Input
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateAsset}>Update Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Depreciation Calculation Dialog */}
      <Dialog open={showDepreciationDialog} onOpenChange={setShowDepreciationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculate Depreciation</DialogTitle>
            <DialogDescription>
              This will calculate monthly depreciation for all active assets and create journal entries.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm"><strong>Period:</strong> {format(new Date(), 'MMMM yyyy')}</p>
              <p className="text-sm"><strong>Financial Year:</strong> {getCurrentFinancialYear()}</p>
              <p className="text-sm"><strong>Active Assets:</strong> {summary?.activeCount || 0}</p>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>Depreciation will be calculated using each asset's configured method:</p>
              <ul className="list-disc list-inside mt-2">
                <li>Straight Line Method</li>
                <li>Diminishing Balance / WDV Method</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepreciationDialog(false)}>Cancel</Button>
            <Button onClick={handleCalculateDepreciation}>
              <Calculator className="h-4 w-4 mr-2" /> Calculate Depreciation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Fixed Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedAsset?.assetCode} - {selectedAsset?.assetName}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">This action cannot be undone</p>
                <p className="text-sm text-red-600 mt-1">
                  This will permanently delete the asset and all its depreciation history.
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAsset}>Delete Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
