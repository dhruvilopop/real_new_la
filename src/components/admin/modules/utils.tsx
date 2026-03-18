// SuperAdmin Utility Functions

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGES, ACTION_COLORS } from './constants';

// Get status badge component
export function getStatusBadge(status: string) {
  const config = STATUS_BADGES[status] || { className: 'bg-gray-100 text-gray-700', label: status };
  return <Badge className={config.className}>{config.label}</Badge>;
}

// Get action color for audit logs
export function getActionColor(action: string): string {
  return ACTION_COLORS[action] || ACTION_COLORS.DEFAULT;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Download CSV file
export function downloadCSV(data: any[], filename: string) {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const value = row[h];
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Calculate EMI
export function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / tenureMonths;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
}

// Calculate total interest
export function calculateTotalInterest(principal: number, annualRate: number, tenureMonths: number): number {
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  return (emi * tenureMonths) - principal;
}

// Calculate processing fee
export function calculateProcessingFee(amount: number, feePercent: number, minFee: number, maxFee: number): number {
  const fee = amount * (feePercent / 100);
  return Math.min(Math.max(fee, minFee), maxFee);
}

// Validate email
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate phone (Indian)
export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''));
}

// Validate PAN
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}\d{4}[A-Z]{1}$/.test(pan.toUpperCase());
}

// Mask Aadhaar number
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 4) return 'XXXX-XXXX-XXXX';
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
}

// Get initials from name
export function getInitials(name: string): string {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'UN';
}

// Generate random password
export function generatePassword(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Parse JSON safely
export function safeJsonParse<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): T {
  let inThrottle = false;
  return ((...args: any[]) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}
