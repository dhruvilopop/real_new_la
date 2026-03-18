// SuperAdmin Dashboard Utilities

import { Badge } from '@/components/ui/badge';

// Status badge configuration
export const STATUS_CONFIG: Record<string, { className: string; label: string }> = {
  SUBMITTED: { className: 'bg-blue-100 text-blue-700', label: 'New' },
  SA_APPROVED: { className: 'bg-emerald-100 text-emerald-700', label: 'SA Approved' },
  COMPANY_APPROVED: { className: 'bg-teal-100 text-teal-700', label: 'Company Approved' },
  AGENT_APPROVED_STAGE1: { className: 'bg-cyan-100 text-cyan-700', label: 'Agent Approved' },
  LOAN_FORM_COMPLETED: { className: 'bg-violet-100 text-violet-700', label: 'Form Complete' },
  SESSION_CREATED: { className: 'bg-amber-100 text-amber-700', label: 'Sanction Created' },
  CUSTOMER_SESSION_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Awaiting Final' },
  FINAL_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Final Approved' },
  DISBURSED: { className: 'bg-green-100 text-green-700', label: 'Disbursed' },
  ACTIVE: { className: 'bg-green-100 text-green-700', label: 'Active' },
  REJECTED_BY_SA: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
  REJECTED_BY_COMPANY: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
  REJECTED_FINAL: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
  SESSION_REJECTED: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
};

// Get status badge component
export function getStatusBadge(status: string) {
  const config = STATUS_CONFIG[status] || { className: 'bg-gray-100 text-gray-700', label: status };
  return <Badge className={config.className}>{config.label}</Badge>;
}

// Status filter helpers
export const STATUS_FILTERS = {
  isPending: (status: string) => status === 'SUBMITTED',
  isPendingFinal: (status: string) => status === 'CUSTOMER_SESSION_APPROVED',
  isActive: (status: string) => ['ACTIVE', 'DISBURSED'].includes(status),
  isInProgress: (status: string) => !['SUBMITTED', 'ACTIVE', 'DISBURSED', 'CLOSED', 'REJECTED_BY_SA', 'REJECTED_BY_COMPANY', 'REJECTED_FINAL', 'SESSION_REJECTED'].includes(status),
  isRejected: (status: string) => ['REJECTED_BY_SA', 'REJECTED_BY_COMPANY', 'REJECTED_FINAL', 'SESSION_REJECTED'].includes(status),
  isHighRisk: (riskScore: number) => riskScore >= 50,
};

// Role labels
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY: 'Company',
  AGENT: 'Agent',
  STAFF: 'Staff',
  CASHIER: 'Cashier',
  ACCOUNTANT: 'Accountant',
  CUSTOMER: 'Customer',
};

// Role colors
export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  COMPANY: 'bg-blue-100 text-blue-700',
  AGENT: 'bg-emerald-100 text-emerald-700',
  STAFF: 'bg-teal-100 text-teal-700',
  CASHIER: 'bg-cyan-100 text-cyan-700',
  ACCOUNTANT: 'bg-amber-100 text-amber-700',
  CUSTOMER: 'bg-gray-100 text-gray-700',
};
