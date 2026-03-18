'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Building2, Check, ChevronsUpDown, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

export default function CompanySelector() {
  const { user } = useAuth();
  const { 
    selectedCompanyId, 
    setSelectedCompanyId, 
    companies, 
    loading,
    isMultiCompanyView 
  } = useCompany();

  // Only show for roles that need company selection
  const shouldShow = user?.role === 'SUPER_ADMIN' || user?.role === 'ACCOUNTANT';

  if (!shouldShow) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-48 bg-gray-100 animate-pulse rounded-md" />
      </div>
    );
  }

  if (companies.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-gray-500" />
      <Select
        value={selectedCompanyId}
        onValueChange={(value) => setSelectedCompanyId(value as string | 'all')}
      >
        <SelectTrigger className="w-[200px] bg-white">
          <SelectValue placeholder="Select Company" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-600" />
              <span className="font-medium">All Companies</span>
              <Badge variant="outline" className="ml-auto text-xs bg-purple-50 text-purple-700 border-purple-200">
                Consolidated
              </Badge>
            </div>
          </SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                <span>{company.name}</span>
                <span className="text-xs text-gray-500">({company.code})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {isMultiCompanyView && (
        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
          <Layers className="h-3 w-3 mr-1" />
          Multi-Company View
        </Badge>
      )}
      
      {selectedCompanyId !== 'all' && (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
          <Building2 className="h-3 w-3 mr-1" />
          {companies.find(c => c.id === selectedCompanyId)?.name || 'Company'}
        </Badge>
      )}
    </div>
  );
}
