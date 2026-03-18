import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CreditTransactionType, PaymentModeType, CreditType } from '@prisma/client';

// POST - Transfer credit to bank account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, creditType, bankAccountId, remarks, userId } = body;

    if (!amount || amount <= 0 || !creditType || !bankAccountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the user (should be SuperAdmin)
    const user = await db.user.findUnique({
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has enough credit
    const availableCredit = creditType === 'PERSONAL' ? user.personalCredit : user.companyCredit;
    if (amount > availableCredit) {
      return NextResponse.json({ 
        error: `Insufficient ${creditType.toLowerCase()} credit. Available: ₹${availableCredit}` 
      }, { status: 400 });
    }

    // Get the bank account
    const bankAccount = await db.bankAccount.findUnique({
      where: { id: bankAccountId }
    });

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // Calculate new balances
    const newPersonalCredit = creditType === 'PERSONAL' ? user.personalCredit - amount : user.personalCredit;
    const newCompanyCredit = creditType === 'COMPANY' ? user.companyCredit - amount : user.companyCredit;
    const newTotalCredit = newPersonalCredit + newCompanyCredit;
    const newBankBalance = bankAccount.currentBalance + amount;

    // Create transaction and update everything
    const result = await db.$transaction(async (tx) => {
      // Create credit transaction
      const creditTx = await tx.creditTransaction.create({
        data: {
          userId: user.id,
          transactionType: CreditTransactionType.CREDIT_DECREASE,
          amount,
          paymentMode: PaymentModeType.BANK_TRANSFER,
          creditType: creditType as CreditType,
          companyBalanceAfter: newCompanyCredit,
          personalBalanceAfter: newPersonalCredit,
          balanceAfter: newTotalCredit,
          sourceType: 'BANK_TRANSFER',
          description: `Transferred to bank: ${bankAccount.bankName} - ${bankAccount.accountNumber}`,
          remarks
        }
      });

      // Update user's credit
      await tx.user.update({
        where: { id: user.id },
        data: {
          personalCredit: newPersonalCredit,
          companyCredit: newCompanyCredit,
          credit: newTotalCredit
        }
      });

      // Update bank account balance
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: newBankBalance }
      });

      // Create bank transaction record
      await tx.bankTransaction.create({
        data: {
          bankAccountId: bankAccountId,
          transactionType: 'CREDIT',
          amount,
          balanceAfter: newBankBalance,
          description: `Credit transfer from ${creditType.toLowerCase()} credit: ${remarks || 'Transfer to bank'}`,
          referenceType: 'CREDIT_TRANSFER',
          referenceId: creditTx.id,
          createdById: user.id
        }
      });

      // Create journal entry for accounting
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId: user.companyId || 'default',
          entryNumber: `JE-${Date.now()}`,
          entryDate: new Date(),
          referenceType: 'CREDIT_TRANSFER',
          referenceId: creditTx.id,
          narration: `Credit transfer to bank: ${remarks || 'Transfer to bank'}`,
          totalDebit: amount,
          totalCredit: amount,
          isAutoEntry: true,
          createdById: user.id,
          isApproved: true,
          approvedAt: new Date(),
          approvedById: user.id
        }
      });

      // Debit the credit account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: 'credit_account_id', // Would need proper account ID
          debitAmount: amount,
          creditAmount: 0,
          narration: `${creditType} credit transferred to bank`
        }
      });

      // Credit the bank account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: bankAccountId,
          debitAmount: 0,
          creditAmount: amount,
          narration: `Amount received from ${creditType.toLowerCase()} credit`
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREDIT_TRANSFER_TO_BANK',
          module: 'CREDIT_MANAGEMENT',
          description: `Transferred ₹${amount} ${creditType.toLowerCase()} credit to ${bankAccount.bankName}`,
          oldValue: JSON.stringify({ creditBalance: availableCredit, bankBalance: bankAccount.currentBalance }),
          newValue: JSON.stringify({ creditBalance: availableCredit - amount, bankBalance: newBankBalance }),
          recordId: bankAccountId,
          recordType: 'BANK_TRANSFER'
        }
      });

      return creditTx;
    });

    return NextResponse.json({ 
      success: true, 
      transaction: result,
      newBalance: {
        personalCredit: newPersonalCredit,
        companyCredit: newCompanyCredit,
        bankBalance: newBankBalance
      }
    });

  } catch (error) {
    console.error('Credit transfer error:', error);
    return NextResponse.json({ error: 'Failed to transfer credit to bank' }, { status: 500 });
  }
}
