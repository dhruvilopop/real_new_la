// SuperAdmin Constants

export const STATUS_BADGES: Record<string, { className: string; label: string }> = {
  SUBMITTED: { className: 'bg-blue-100 text-blue-700', label: 'New' },
  SA_APPROVED: { className: 'bg-emerald-100 text-emerald-700', label: 'SA Approved' },
  COMPANY_APPROVED: { className: 'bg-teal-100 text-teal-700', label: 'Company Approved' },
  AGENT_APPROVED_STAGE1: { className: 'bg-cyan-100 text-cyan-700', label: 'Agent Approved' },
  LOAN_FORM_COMPLETED: { className: 'bg-violet-100 text-violet-700', label: 'Form Complete' },
  SESSION_CREATED: { className: 'bg-amber-100 text-amber-700', label: 'Sanction Created' },
  CUSTOMER_SESSION_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Customer Accepted' },
  FINAL_APPROVED: { className: 'bg-green-100 text-green-700', label: 'Final Approved' },
  DISBURSED: { className: 'bg-green-100 text-green-700', label: 'Disbursed' },
  ACTIVE: { className: 'bg-green-100 text-green-700', label: 'Active' },
  REJECTED_BY_SA: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
  REJECTED_BY_COMPANY: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
  REJECTED_FINAL: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
  SESSION_REJECTED: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
};

export const LOAN_TYPE_OPTIONS = [
  { value: 'PERSONAL', label: 'Personal Loan' },
  { value: 'BUSINESS', label: 'Business Loan' },
  { value: 'HOME', label: 'Home Loan' },
  { value: 'VEHICLE', label: 'Vehicle Loan' },
  { value: 'EDUCATION', label: 'Education Loan' },
  { value: 'GOLD', label: 'Gold Loan' },
  { value: 'OTHER', label: 'Other' },
];

export const USER_ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
  { value: 'CUSTOMER', label: 'Customer' },
];

export const MODULE_ICONS: Record<string, string> = {
  AUTH: 'Shield',
  USER: 'User',
  COMPANY: 'Building2',
  LOAN: 'FileText',
  PAYMENT: 'CreditCard',
  SYSTEM: 'Settings',
  NOTIFICATION: 'Activity',
  DEFAULT: 'Activity'
};

export const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-purple-100 text-purple-700',
  LOGOUT: 'bg-gray-100 text-gray-700',
  APPROVE: 'bg-emerald-100 text-emerald-700',
  REJECT: 'bg-red-100 text-red-700',
  DISBURSE: 'bg-cyan-100 text-cyan-700',
  VERIFY: 'bg-amber-100 text-amber-700',
  LOCK: 'bg-orange-100 text-orange-700',
  UNLOCK: 'bg-teal-100 text-teal-700',
  DEFAULT: 'bg-gray-100 text-gray-700'
};
