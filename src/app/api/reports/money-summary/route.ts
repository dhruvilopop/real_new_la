import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// MONEY SUMMARY API
// Provides daily/period money collection summary
// ============================================

// Simple in-memory cache
const summaryCache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute cache

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Check cache
    const cacheKey = `${dateStr || 'today'}_${startDateStr || ''}_${endDateStr || ''}`;
    const cached = summaryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Determine date range
    let startDate: Date;
    let endDate: Date;

    if (startDateStr && endDateStr) {
      // Date range provided
      startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    } else if (dateStr) {
      // Single date provided
      startDate = new Date(dateStr);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dateStr);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to today
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // Fetch all credit transactions in the date range
    const transactions = await db.creditTransaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        transactionType: {
          in: ['CREDIT_INCREASE', 'PERSONAL_COLLECTION']
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            companyId: true,
            company: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate totals
    const totalEMI = transactions
      .filter(t => t.sourceType === 'EMI_PAYMENT')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCollected = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Breakdown by payment mode
    const breakdownByMode = {
      CASH: transactions.filter(t => t.paymentMode === 'CASH').reduce((sum, t) => sum + t.amount, 0),
      UPI: transactions.filter(t => t.paymentMode === 'UPI').reduce((sum, t) => sum + t.amount, 0),
      BANK_TRANSFER: transactions.filter(t => t.paymentMode === 'BANK_TRANSFER').reduce((sum, t) => sum + t.amount, 0),
      CHEQUE: transactions.filter(t => t.paymentMode === 'CHEQUE').reduce((sum, t) => sum + t.amount, 0),
      ONLINE: transactions.filter(t => t.paymentMode === 'ONLINE').reduce((sum, t) => sum + t.amount, 0),
      OTHER: transactions.filter(t => !['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].includes(t.paymentMode)).reduce((sum, t) => sum + t.amount, 0)
    };

    // Count by payment mode
    const countByMode = {
      CASH: transactions.filter(t => t.paymentMode === 'CASH').length,
      UPI: transactions.filter(t => t.paymentMode === 'UPI').length,
      BANK_TRANSFER: transactions.filter(t => t.paymentMode === 'BANK_TRANSFER').length,
      CHEQUE: transactions.filter(t => t.paymentMode === 'CHEQUE').length,
      ONLINE: transactions.filter(t => t.paymentMode === 'ONLINE').length,
      OTHER: transactions.filter(t => !['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].includes(t.paymentMode)).length
    };

    // Company-wise breakdown
    const companyMap = new Map<string, {
      id: string;
      name: string;
      totalEMI: number;
      companyCredit: number;
      personalCredit: number;
      transactionCount: number;
    }>();

    transactions.forEach(t => {
      const companyId = t.user.companyId || 'no-company';
      const companyName = t.user.company?.name || 'No Company';

      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, {
          id: companyId,
          name: companyName,
          totalEMI: 0,
          companyCredit: 0,
          personalCredit: 0,
          transactionCount: 0
        });
      }

      const company = companyMap.get(companyId)!;
      company.transactionCount++;

      if (t.sourceType === 'EMI_PAYMENT') {
        company.totalEMI += t.amount;
      }

      if (t.creditType === 'COMPANY') {
        company.companyCredit += t.amount;
      } else {
        company.personalCredit += t.amount;
      }
    });

    const companyWiseData = Array.from(companyMap.values()).sort((a, b) => b.totalEMI - a.totalEMI);

    // User-wise breakdown (collectors)
    const collectorMap = new Map<string, {
      id: string;
      name: string;
      role: string;
      company: string;
      totalCollected: number;
      companyCredit: number;
      personalCredit: number;
      transactionCount: number;
    }>();

    transactions.forEach(t => {
      const collectorId = t.userId;

      if (!collectorMap.has(collectorId)) {
        collectorMap.set(collectorId, {
          id: collectorId,
          name: t.user.name || 'Unknown',
          role: t.user.role,
          company: t.user.company?.name || 'No Company',
          totalCollected: 0,
          companyCredit: 0,
          personalCredit: 0,
          transactionCount: 0
        });
      }

      const collector = collectorMap.get(collectorId)!;
      collector.totalCollected += t.amount;
      collector.transactionCount++;

      if (t.creditType === 'COMPANY') {
        collector.companyCredit += t.amount;
      } else {
        collector.personalCredit += t.amount;
      }
    });

    const collectorWiseData = Array.from(collectorMap.values()).sort((a, b) => b.totalCollected - a.totalCollected);

    // Get all companies with their current credit status
    const allCompanies = await db.company.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        companyCredit: true,
        users: {
          where: {
            role: { in: ['COMPANY', 'AGENT', 'STAFF', 'CASHIER'] }
          },
          select: {
            id: true,
            name: true,
            role: true,
            personalCredit: true,
            companyCredit: true
          }
        }
      }
    });

    // Calculate total credit per company (company credit + sum of user credits)
    const companyCreditSummary = allCompanies.map(company => {
      const usersTotalPersonal = company.users.reduce((sum, u) => sum + u.personalCredit, 0);
      const usersTotalCompany = company.users.reduce((sum, u) => sum + u.companyCredit, 0);

      return {
        id: company.id,
        name: company.name,
        code: company.code,
        companyCredit: company.companyCredit,
        usersTotalPersonal,
        usersTotalCompany,
        totalCredit: company.companyCredit + usersTotalPersonal + usersTotalCompany,
        userCount: company.users.length
      };
    });

    // Money Flow Tracking - Where money goes
    // 1. Bank Accounts
    const bankAccounts = await db.bankAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        currentBalance: true,
        companyId: true,
        isDefault: true
      }
    });

    // 2. Credit Management (User-wise)
    const usersWithCredit = await db.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'COMPANY', 'AGENT', 'STAFF', 'CASHIER'] },
        OR: [
          { personalCredit: { gt: 0 } },
          { companyCredit: { gt: 0 } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        personalCredit: true,
        companyCredit: true,
        companyId: true,
        company: {
          select: { name: true }
        }
      }
    });

    const totalPersonalCredit = usersWithCredit.reduce((sum, u) => sum + u.personalCredit, 0);
    const totalCompanyCredit = usersWithCredit.reduce((sum, u) => sum + u.companyCredit, 0);

    // 3. Total bank balance
    const totalBankBalance = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);

    const responseData = {
      success: true,
      dateRange: {
        start: startDate,
        end: endDate
      },
      summary: {
        totalEMI,
        totalCollected,
        transactionCount: transactions.length,
        breakdownByMode,
        countByMode
      },
      companyWiseData,
      collectorWiseData,
      companyCreditSummary,
      moneyFlow: {
        bankAccounts: bankAccounts.map(b => ({
          id: b.id,
          bankName: b.bankName,
          accountNumber: b.accountNumber,
          currentBalance: b.currentBalance,
          isDefault: b.isDefault
        })),
        totalBankBalance,
        creditManagement: {
          usersWithCredit: usersWithCredit.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            personalCredit: u.personalCredit,
            companyCredit: u.companyCredit,
            totalCredit: u.personalCredit + u.companyCredit,
            company: u.company?.name
          })),
          totalPersonalCredit,
          totalCompanyCredit,
          grandTotal: totalPersonalCredit + totalCompanyCredit
        }
      }
    };

    // Cache the result
    summaryCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    // Clean old cache entries
    if (summaryCache.size > 50) {
      const oldestKeys = Array.from(summaryCache.keys()).slice(0, 25);
      oldestKeys.forEach(key => summaryCache.delete(key));
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Money summary fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch money summary' }, { status: 500 });
  }
}
