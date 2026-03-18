// EMI Calculation Engine
export interface EMICalculation {
  emi: number;
  totalAmount: number;
  totalInterest: number;
  schedule: EMIScheduleItem[];
}

export interface EMIScheduleItem {
  installmentNumber: number;
  dueDate: Date;
  principal: number;
  interest: number;
  totalAmount: number;
  outstandingPrincipal: number;
}

export function calculateEMI(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
  startDate: Date = new Date()
): EMICalculation {
  const monthlyRate = annualInterestRate / 12 / 100;
  
  let emi: number;
  if (monthlyRate === 0) {
    emi = principal / tenureMonths;
  } else {
    const ratePowerN = Math.pow(1 + monthlyRate, tenureMonths);
    emi = (principal * monthlyRate * ratePowerN) / (ratePowerN - 1);
  }
  
  const totalAmount = emi * tenureMonths;
  const totalInterest = totalAmount - principal;
  
  const schedule: EMIScheduleItem[] = [];
  let outstandingPrincipal = principal;
  
  for (let i = 1; i <= tenureMonths; i++) {
    const interestForMonth = outstandingPrincipal * monthlyRate;
    const principalForMonth = emi - interestForMonth;
    outstandingPrincipal = Math.max(0, outstandingPrincipal - principalForMonth);
    
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    schedule.push({
      installmentNumber: i,
      dueDate,
      principal: Math.round(principalForMonth * 100) / 100,
      interest: Math.round(interestForMonth * 100) / 100,
      totalAmount: Math.round(emi * 100) / 100,
      outstandingPrincipal: Math.round(outstandingPrincipal * 100) / 100
    });
  }
  
  return {
    emi: Math.round(emi * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    schedule
  };
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

export function generateApplicationNo(): string {
  const prefix = 'LA';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

export function generateTransactionId(): string {
  const prefix = 'TXN';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

export function generateReceiptNo(): string {
  const prefix = 'RCP';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

export function validatePAN(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
}

export function validateIFSC(ifsc: string): boolean {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
}

export function validateAadhaar(aadhaar: string): boolean {
  const aadhaarRegex = /^[2-9]{1}[0-9]{3}[0-9]{4}[0-9]{4}$/;
  return aadhaarRegex.test(aadhaar.replace(/\s/g, ''));
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[6-9][0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function calculateRiskScore(params: {
  multipleApplications: boolean;
  activeLoans: number;
  income: number;
  requestedAmount: number;
  overdueHistory: boolean;
  employmentType: string;
}): number {
  let score = 0;
  
  if (params.multipleApplications) score += 15;
  if (params.activeLoans > 3) score += 20;
  else if (params.activeLoans > 1) score += 10;
  
  const ratio = params.requestedAmount / (params.income * 12);
  if (ratio > 5) score += 25;
  else if (ratio > 3) score += 15;
  else if (ratio > 1) score += 5;
  
  if (params.overdueHistory) score += 30;
  
  if (params.employmentType === 'UNEMPLOYED') score += 20;
  else if (params.employmentType === 'SELF_EMPLOYED') score += 5;
  
  return Math.min(100, score);
}

export function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score < 20) return 'LOW';
  if (score < 40) return 'MEDIUM';
  if (score < 60) return 'HIGH';
  return 'CRITICAL';
}

export function generateCode(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// Alias for generateReceiptNo
export const generateReceiptNumber = generateReceiptNo;

// Password validation
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 6) errors.push('Password must be at least 6 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  return { valid: errors.length === 0, errors };
}

// Get status color class
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    SUBMITTED: 'bg-blue-100 text-blue-700',
    SA_APPROVED: 'bg-emerald-100 text-emerald-700',
    COMPANY_APPROVED: 'bg-teal-100 text-teal-700',
    AGENT_APPROVED_STAGE1: 'bg-cyan-100 text-cyan-700',
    LOAN_FORM_COMPLETED: 'bg-violet-100 text-violet-700',
    SESSION_CREATED: 'bg-amber-100 text-amber-700',
    CUSTOMER_SESSION_APPROVED: 'bg-green-100 text-green-700',
    FINAL_APPROVED: 'bg-green-100 text-green-700',
    ACTIVE: 'bg-green-100 text-green-700',
    DISBURSED: 'bg-blue-100 text-blue-700',
    REJECTED_BY_SA: 'bg-red-100 text-red-700',
    REJECTED_BY_COMPANY: 'bg-red-100 text-red-700',
    REJECTED_FINAL: 'bg-red-100 text-red-700',
    SESSION_REJECTED: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

// Get status label
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    SUBMITTED: 'New Application',
    SA_APPROVED: 'SA Approved',
    COMPANY_APPROVED: 'Company Approved',
    AGENT_APPROVED_STAGE1: 'Agent Approved',
    LOAN_FORM_COMPLETED: 'Verification Complete',
    SESSION_CREATED: 'Sanction Created',
    CUSTOMER_SESSION_APPROVED: 'Customer Approved',
    FINAL_APPROVED: 'Final Approved',
    ACTIVE: 'Active',
    DISBURSED: 'Disbursed',
    REJECTED_BY_SA: 'Rejected',
    REJECTED_BY_COMPANY: 'Rejected',
    REJECTED_FINAL: 'Rejected',
    SESSION_REJECTED: 'Sanction Rejected',
  };
  return labels[status] || status;
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Copy to clipboard utility
export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  return new Promise((resolve, reject) => {
    if (document.execCommand('copy')) {
      resolve();
    } else {
      reject(new Error('Failed to copy text'));
    }
    textArea.remove();
  });
}
// Force recompile Thu Mar 12 19:07:56 UTC 2026
