import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CreditTransactionType, PaymentModeType, CreditType } from '@prisma/client';

// POST - Deduct credit from a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, creditType, remarks, deductedBy } = body;

    if (!userId || !amount || amount <= 0 || !creditType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the user whose credit is being deducted
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        personalCredit: true,
        companyCredit: true,
        companyId: true
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has enough credit
    const availableCredit = creditType === 'PERSONAL' ? targetUser.personalCredit : targetUser.companyCredit;
    if (amount > availableCredit) {
      return NextResponse.json({ 
        error: `Insufficient ${creditType.toLowerCase()} credit. Available: ₹${availableCredit}` 
      }, { status: 400 });
    }

    // Get SuperAdmin (the one deducting)
    const superAdmin = await db.user.findFirst({
      where: { role: 'SUPER_ADMIN', isActive: true },
      select: { id: true, personalCredit: true, companyCredit: true }
    });

    if (!superAdmin) {
      return NextResponse.json({ error: 'SuperAdmin not found' }, { status: 404 });
    }

    // Calculate new balances
    const newTargetPersonalCredit = creditType === 'PERSONAL' 
      ? targetUser.personalCredit - amount 
      : targetUser.personalCredit;
    const newTargetCompanyCredit = creditType === 'COMPANY' 
      ? targetUser.companyCredit - amount 
      : targetUser.companyCredit;
    const newTargetTotalCredit = newTargetPersonalCredit + newTargetCompanyCredit;

    // SuperAdmin's new balance (same type as deducted)
    const newSAPersonalCredit = creditType === 'PERSONAL' 
      ? superAdmin.personalCredit + amount 
      : superAdmin.personalCredit;
    const newSACompanyCredit = creditType === 'COMPANY' 
      ? superAdmin.companyCredit + amount 
      : superAdmin.companyCredit;

    // Create transaction and update both users in a single transaction
    const result = await db.$transaction(async (tx) => {
      // Create credit transaction for the user being deducted
      const deductionTx = await tx.creditTransaction.create({
        data: {
          userId: targetUser.id,
          transactionType: CreditTransactionType.CREDIT_DECREASE,
          amount,
          paymentMode: PaymentModeType.SYSTEM,
          creditType: creditType as CreditType,
          companyBalanceAfter: newTargetCompanyCredit,
          personalBalanceAfter: newTargetPersonalCredit,
          balanceAfter: newTargetTotalCredit,
          sourceType: 'ADMIN_DEDUCTION',
          description: `Credit deducted by SuperAdmin: ${remarks || 'No reason provided'}`,
          remarks
        }
      });

      // Update the target user's credit
      await tx.user.update({
        where: { id: targetUser.id },
        data: {
          personalCredit: newTargetPersonalCredit,
          companyCredit: newTargetCompanyCredit,
          credit: newTargetTotalCredit
        }
      });

      // Create credit transaction for SuperAdmin (receiving the credit)
      await tx.creditTransaction.create({
        data: {
          userId: superAdmin.id,
          transactionType: creditType === 'PERSONAL' 
            ? CreditTransactionType.PERSONAL_COLLECTION 
            : CreditTransactionType.CREDIT_INCREASE,
          amount,
          paymentMode: PaymentModeType.SYSTEM,
          creditType: creditType as CreditType,
          companyBalanceAfter: newSACompanyCredit,
          personalBalanceAfter: newSAPersonalCredit,
          balanceAfter: newSAPersonalCredit + newSACompanyCredit,
          sourceType: 'CREDIT_TRANSFER',
          sourceId: targetUser.id,
          description: `Credit received from ${targetUser.name} (${targetUser.role})`,
          remarks
        }
      });

      // Update SuperAdmin's credit
      await tx.user.update({
        where: { id: superAdmin.id },
        data: {
          personalCredit: newSAPersonalCredit,
          companyCredit: newSACompanyCredit,
          credit: newSAPersonalCredit + newSACompanyCredit
        }
      });

      // If company credit was deducted, also update company's credit
      if (creditType === 'COMPANY' && targetUser.companyId) {
        await tx.company.update({
          where: { id: targetUser.companyId },
          data: { companyCredit: { decrement: amount } }
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: superAdmin.id,
          action: 'CREDIT_DEDUCTION',
          module: 'CREDIT_MANAGEMENT',
          description: `Deducted ₹${amount} ${creditType.toLowerCase()} credit from ${targetUser.name} (${targetUser.email})`,
          oldValue: JSON.stringify({ personalCredit: targetUser.personalCredit, companyCredit: targetUser.companyCredit }),
          newValue: JSON.stringify({ personalCredit: newTargetPersonalCredit, companyCredit: newTargetCompanyCredit }),
          recordId: targetUser.id,
          recordType: 'USER_CREDIT'
        }
      });

      return deductionTx;
    });

    return NextResponse.json({ 
      success: true, 
      transaction: result,
      newBalance: {
        personalCredit: newTargetPersonalCredit,
        companyCredit: newTargetCompanyCredit
      }
    });

  } catch (error) {
    console.error('Credit deduction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to deduct credit';
    return NextResponse.json({ 
      error: 'Failed to deduct credit',
      details: errorMessage 
    }, { status: 500 });
  }
}
