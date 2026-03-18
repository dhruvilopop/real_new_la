// SuperAdmin Dashboard Types

export interface Loan {
  id: string;
  applicationNo: string;
  status: string;
  requestedAmount: number;
  loanType: string;
  createdAt: string;
  riskScore: number;
  fraudFlag: boolean;
  purpose: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  sessionForm?: any;
  loanForm?: any;
  company?: any;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isLocked?: boolean;
  createdAt: string;
  phone?: string;
  company?: string;
  companyId?: string;
  companyObj?: { id: string; name: string };
  agentId?: string;
  agent?: { id: string; name: string; agentCode: string };
  agentCode?: string;
  staffCode?: string;
  cashierCode?: string;
  accountantCode?: string;
}

export interface CompanyItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface ProductForm {
  title: string;
  description: string;
  icon: string;
  loanType: string;
  minInterestRate: number;
  maxInterestRate: number;
  defaultInterestRate: number;
  minTenure: number;
  maxTenure: number;
  defaultTenure: number;
  minAmount: number;
  maxAmount: number;
  processingFeePercent: number;
  processingFeeMin: number;
  processingFeeMax: number;
  latePaymentPenaltyPercent: number;
  gracePeriodDays: number;
  bounceCharges: number;
  allowMoratorium: boolean;
  maxMoratoriumMonths: number;
  allowPrepayment: boolean;
  prepaymentCharges: number;
  isActive: boolean;
}

export const DEFAULT_PRODUCT_FORM: ProductForm = {
  title: '',
  description: '',
  icon: '💰',
  loanType: 'PERSONAL',
  minInterestRate: 8,
  maxInterestRate: 24,
  defaultInterestRate: 12,
  minTenure: 6,
  maxTenure: 60,
  defaultTenure: 12,
  minAmount: 10000,
  maxAmount: 10000000,
  processingFeePercent: 1,
  processingFeeMin: 500,
  processingFeeMax: 10000,
  latePaymentPenaltyPercent: 2,
  gracePeriodDays: 5,
  bounceCharges: 500,
  allowMoratorium: true,
  maxMoratoriumMonths: 3,
  allowPrepayment: true,
  prepaymentCharges: 2,
  isActive: true
};

export interface UserForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  companyId: string;
  agentId: string;
  commissionRate: number;
}

export const DEFAULT_USER_FORM: UserForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'COMPANY',
  companyId: '',
  agentId: '',
  commissionRate: 5
};
