import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CreditType, CreditTransactionType, PaymentModeType, SettlementStatus } from '@prisma/client';

// ============================================
// CREDIT SETTLEMENT API
// When role gives money to Super Admin:
// 1. Role's credit is DECREASED
// 2. Super Admin's credit is INCREASED (same type - personal→personal, company→company)
// ============================================

// GET - Fetch settlement requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const superAdminId = searchParams.get('superAdminId');

    // Get pending settlements for Super Admin to review
    if (action === 'pending') {
      const pendingSettlements = await db.cashierSettlement.findMany({
        where: { status: SettlementStatus.PENDING },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              personalCredit: true,
              companyCredit: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({ success: true, settlements: pendingSettlements });
    }

    // Get all settlements for a specific user
    if (userId) {
      const settlements = await db.cashierSettlement.findMany({
        where: { userId },
        include: {
          cashier: {
            select: { id: true, name: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({ success: true, settlements });
    }

    // Get all settlements (Super Admin view)
    const allSettlements = await db.cashierSettlement.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, personalCredit: true, companyCredit: true }
        },
        cashier: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json({ success: true, settlements: allSettlements });
  } catch (error) {
    console.error('Settlement fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch settlements' }, { status: 500 });
  }
}

// POST - Create settlement request (Role requests to give money to Super Admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,           // User giving money
      superAdminId,     // Super Admin receiving money
      amount,
      creditType,       // PERSONAL or COMPANY
      paymentMode,      // CASH, CHEQUE, BANK_TRANSFER
      chequeNumber,
      chequeDate,
      bankRefNumber,
      utrNumber,
      remarks
    } = body;

    if (!userId || !superAdminId || !amount || !creditType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user's current credit
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        name: true,
        role: true,
        personalCredit: true,
        companyCredit: true,
        credit: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check sufficient credit
    const availableCredit = creditType === 'COMPANY' ? user.companyCredit : user.personalCredit;
    if (amount > availableCredit) {
      return NextResponse.json({ 
        error: `Insufficient ${creditType.toLowerCase()} credit. Available: ₹${availableCredit}`,
        available: availableCredit
      }, { status: 400 });
    }

    // Get Super Admin
    const superAdmin = await db.user.findUnique({
      where: { id: superAdminId },
      select: { id: true, name: true, role: true, personalCredit: true, companyCredit: true, credit: true }
    });

    if (!superAdmin || superAdmin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Invalid Super Admin' }, { status: 400 });
    }

    // Generate settlement number
    const settlementCount = await db.cashierSettlement.count();
    const settlementNumber = `SET-${String(settlementCount + 1).padStart(6, '0')}`;

    // Create settlement request
    const settlement = await db.cashierSettlement.create({
      data: {
        settlementNumber,
        userId,
        cashierId: superAdminId,
        amount,
        paymentMode: paymentMode as PaymentModeType || PaymentModeType.CASH,
        chequeNumber,
        chequeDate: chequeDate ? new Date(chequeDate) : null,
        bankRefNumber,
        utrNumber,
        status: SettlementStatus.PENDING,
        remarks
      }
    });

    return NextResponse.json({
      success: true,
      settlement,
      message: 'Settlement request created. Please wait for Super Admin to verify and complete.'
    });
  } catch (error) {
    console.error('Settlement creation error:', error);
    return NextResponse.json({ error: 'Failed to create settlement' }, { status: 500 });
  }
}

// PUT - Complete settlement (Super Admin receives money and clears credit)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      settlementId,
      action,
      superAdminId,
      creditType,       // Which credit to clear: PERSONAL or COMPANY
      notes
    } = body;

    if (!settlementId || !action || !superAdminId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get settlement details
    const settlement = await db.cashierSettlement.findUnique({
      where: { id: settlementId },
      include: {
        user: {
          select: { id: true, name: true, personalCredit: true, companyCredit: true, credit: true }
        },
        cashier: {
          select: { id: true, name: true, role: true, personalCredit: true, companyCredit: true, credit: true }
        }
      }
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    if (settlement.status !== SettlementStatus.PENDING) {
      return NextResponse.json({ error: 'Settlement already processed' }, { status: 400 });
    }

    // Verify Super Admin
    const superAdmin = await db.user.findUnique({
      where: { id: superAdminId },
      select: { id: true, name: true, role: true, personalCredit: true, companyCredit: true, credit: true }
    });

    if (!superAdmin || superAdmin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can complete settlements' }, { status: 403 });
    }

    // Reject settlement
    if (action === 'reject') {
      const updated = await db.cashierSettlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.REJECTED,
          rejectionReason: notes
        }
      });

      return NextResponse.json({ success: true, settlement: updated, message: 'Settlement rejected' });
    }

    // Complete settlement
    if (action === 'complete') {
      const amount = settlement.amount;
      const actualCreditType: CreditType = creditType || CreditType.COMPANY;

      // Check user has enough credit in specified type
      const userAvailableCredit = actualCreditType === CreditType.COMPANY 
        ? settlement.user.companyCredit 
        : settlement.user.personalCredit;

      if (amount > userAvailableCredit) {
        return NextResponse.json({ 
          error: `User doesn't have enough ${actualCreditType.toLowerCase()} credit. Available: ₹${userAvailableCredit}` 
        }, { status: 400 });
      }

      // Calculate new balances
      // User's credit DECREASES
      const newUserCompanyCredit = actualCreditType === CreditType.COMPANY 
        ? settlement.user.companyCredit - amount 
        : settlement.user.companyCredit;
      const newUserPersonalCredit = actualCreditType === CreditType.PERSONAL 
        ? settlement.user.personalCredit - amount 
        : settlement.user.personalCredit;
      const newUserTotalCredit = newUserCompanyCredit + newUserPersonalCredit;

      // Super Admin's credit INCREASES (same type)
      const newSACompanyCredit = actualCreditType === CreditType.COMPANY 
        ? superAdmin.companyCredit + amount 
        : superAdmin.companyCredit;
      const newSAPersonalCredit = actualCreditType === CreditType.PERSONAL 
        ? superAdmin.personalCredit + amount 
        : superAdmin.personalCredit;
      const newSATotalCredit = newSACompanyCredit + newSAPersonalCredit;

      // Process in transaction
      const result = await db.$transaction(async (tx) => {
        // Update settlement status
        const updatedSettlement = await tx.cashierSettlement.update({
          where: { id: settlementId },
          data: {
            status: SettlementStatus.COMPLETED,
            remarks: notes ? `${settlement.remarks || ''} | ${notes}` : settlement.remarks
          }
        });

        // Decrease user's credit
        await tx.user.update({
          where: { id: settlement.userId },
          data: {
            companyCredit: newUserCompanyCredit,
            personalCredit: newUserPersonalCredit,
            credit: newUserTotalCredit
          }
        });

        // Increase Super Admin's credit
        await tx.user.update({
          where: { id: superAdminId },
          data: {
            companyCredit: newSACompanyCredit,
            personalCredit: newSAPersonalCredit,
            credit: newSATotalCredit
          }
        });

        // Create credit transaction for user (DECREASE)
        await tx.creditTransaction.create({
          data: {
            userId: settlement.userId,
            transactionType: CreditTransactionType.CREDIT_DECREASE,
            amount: amount,
            paymentMode: settlement.paymentMode,
            creditType: actualCreditType,
            companyBalanceAfter: newUserCompanyCredit,
            personalBalanceAfter: newUserPersonalCredit,
            balanceAfter: newUserTotalCredit,
            sourceType: 'SETTLEMENT',
            sourceId: settlementId,
            settlementId: settlementId,
            description: `Credit cleared by Super Admin (${superAdmin.name}) - Settlement #${settlement.settlementNumber}`,
            remarks: notes
          }
        });

        // Create credit transaction for Super Admin (INCREASE)
        await tx.creditTransaction.create({
          data: {
            userId: superAdminId,
            transactionType: actualCreditType === CreditType.PERSONAL 
              ? CreditTransactionType.PERSONAL_COLLECTION 
              : CreditTransactionType.CREDIT_INCREASE,
            amount: amount,
            paymentMode: settlement.paymentMode,
            creditType: actualCreditType,
            companyBalanceAfter: newSACompanyCredit,
            personalBalanceAfter: newSAPersonalCredit,
            balanceAfter: newSATotalCredit,
            sourceType: 'SETTLEMENT_RECEIVED',
            sourceId: settlementId,
            settlementId: settlementId,
            description: `Credit received from ${settlement.user.name} - Settlement #${settlement.settlementNumber}`,
            remarks: notes
          }
        });

        return updatedSettlement;
      });

      return NextResponse.json({
        success: true,
        settlement: result,
        message: `Settlement completed. ₹${amount} transferred from ${settlement.user.name}'s ${actualCreditType.toLowerCase()} credit to your ${actualCreditType.toLowerCase()} credit.`,
        creditBreakdown: {
          companyCredit: newSACompanyCredit,
          personalCredit: newSAPersonalCredit,
          totalCredit: newSATotalCredit
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Settlement completion error:', error);
    return NextResponse.json({ error: 'Failed to complete settlement' }, { status: 500 });
  }
}
