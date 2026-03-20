import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, CacheTTL, CacheKeys } from '@/lib/cache';

// Minimal select for loan list - only essential fields
const LOAN_LIST_SELECT = {
  id: true,
  applicationNo: true,
  status: true,
  loanType: true,
  requestedAmount: true,
  requestedTenure: true,
  createdAt: true,
  customerId: true,
  companyId: true,
  currentHandlerId: true,
  customer: { select: { id: true, name: true, email: true, phone: true } },
  company: { select: { id: true, name: true, code: true } },
  sessionForm: {
    select: {
      approvedAmount: true,
      interestRate: true,
      tenure: true,
      emiAmount: true
    }
  }
} as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const customerId = searchParams.get('customerId');
    const companyId = searchParams.get('companyId');
    const agentId = searchParams.get('agentId');
    const staffId = searchParams.get('staffId');
    const status = searchParams.get('status');

    // Create cache key from all params
    const cacheKey = CacheKeys.loansByRole(role || 'all', `${customerId || ''}-${companyId || ''}-${agentId || ''}-${staffId || ''}-${status || ''}`);
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ loans: cached });
    }

    const where: Record<string, unknown> = {};
    
    if (customerId) where.customerId = customerId;
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;

    // Role-based filtering
    if (role === 'SUPER_ADMIN') {
      // Super admin sees all loans
    } else if (role === 'COMPANY') {
      if (companyId) where.companyId = companyId;
    } else if (role === 'AGENT' && agentId) {
      // For agent queries, we need to get their company first
      const agent = await db.user.findUnique({
        where: { id: agentId },
        select: { companyId: true }
      });
      
      where.OR = [
        { currentHandlerId: agentId },
        { status: 'COMPANY_APPROVED', companyId: agent?.companyId },
        { status: 'SA_APPROVED', currentHandlerId: agentId },
        { 
          status: { in: ['AGENT_APPROVED_STAGE1', 'LOAN_FORM_COMPLETED', 'SESSION_CREATED', 'CUSTOMER_SESSION_APPROVED', 'FINAL_APPROVED', 'ACTIVE', 'DISBURSED'] },
          currentHandlerId: agentId 
        }
      ];
    } else if (role === 'STAFF' && staffId) {
      where.currentHandlerId = staffId;
    } else if (role === 'CASHIER') {
      where.status = { in: ['FINAL_APPROVED', 'ACTIVE', 'DISBURSED'] };
    } else if (role === 'ACCOUNTANT') {
      where.status = { in: ['ACTIVE', 'DISBURSED'] };
    } else if (agentId) {
      where.currentHandlerId = agentId;
    }

    const loans = await db.loanApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: LOAN_LIST_SELECT
    });

    // Cache for 1 minute
    cache.set(cacheKey, loans, CacheTTL.MEDIUM);

    return NextResponse.json({ loans });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 });
  }
}
