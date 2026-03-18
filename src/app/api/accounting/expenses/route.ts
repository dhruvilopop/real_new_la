import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AccountingService, ACCOUNT_CODES } from '@/lib/accounting-service';

// Expense type to account code mapping
const EXPENSE_ACCOUNT_CODES: Record<string, string> = {
  'SALARY': '4000',
  'OFFICE_RENT': '4100',
  'MARKETING': '4200',
  'COMMISSION': '4300',
  'SOFTWARE': '4400',
  'BANK_CHARGES': '4500',
  'UTILITIES': '4600',
  'TRAVEL': '4700',
  'MISCELLANEOUS': '4800',
  'DEPRECIATION': '4900',
  'OFFICE_SUPPLIES': '4800',
  'TELECOMMUNICATION': '4600',
  'PROFESSIONAL_FEES': '4800',
  'INSURANCE': '4800',
  'TAX_PAID': '4800',
  'MAINTENANCE': '4800',
  'CONVEYANCE': '4700',
  'ADVERTISEMENT': '4200',
};

// GET - Fetch expenses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default';
    const expenseType = searchParams.get('expenseType');
    const isApproved = searchParams.get('isApproved');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = { companyId };

    if (expenseType) where.expenseType = expenseType;
    if (isApproved !== null && isApproved !== undefined) {
      where.isApproved = isApproved === 'true';
    }
    if (startDate && endDate) {
      where.paymentDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.expense.count({ where }),
    ]);

    // Calculate totals
    const totals = await db.expense.aggregate({
      where: { ...where, isApproved: true },
      _sum: { amount: true },
    });

    return NextResponse.json({ 
      expenses, 
      total,
      totalAmount: totals._sum.amount || 0,
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST - Create new expense with full accounting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      companyId,
      expenseType,
      description,
      amount,
      paymentDate,
      paymentMode,
      paymentReference,
      payeeName,
      bankAccountId,
      receiptUrl,
      remarks,
      createdById,
    } = body;

    // Validate required fields
    if (!description || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Description and valid amount are required' }, { status: 400 });
    }

    // Get company ID
    let effectiveCompanyId = companyId || 'default';
    if (effectiveCompanyId === 'default') {
      const anyCompany = await db.company.findFirst();
      if (anyCompany) {
        effectiveCompanyId = anyCompany.id;
      }
    }

    // Get default bank account if not provided
    let bankAccount: Awaited<ReturnType<typeof db.bankAccount.findUnique>> | null = null;
    if (paymentMode === 'BANK_TRANSFER' || paymentMode === 'ONLINE' || paymentMode === 'UPI') {
      if (bankAccountId) {
        bankAccount = await db.bankAccount.findUnique({
          where: { id: bankAccountId },
        });
      } else {
        bankAccount = await db.bankAccount.findFirst({
          where: { isActive: true, isDefault: true },
        });
        if (!bankAccount) {
          bankAccount = await db.bankAccount.findFirst({
            where: { isActive: true },
          });
        }
      }
    }

    // Generate expense number
    const count = await db.expense.count({
      where: { companyId: effectiveCompanyId },
    });
    const expenseNumber = `EXP${String(count + 1).padStart(6, '0')}`;

    // Get account code for expense type
    const accountCode = EXPENSE_ACCOUNT_CODES[expenseType] || '4800';

    // Create expense with journal entry and bank update
    const result = await db.$transaction(async (tx) => {
      // 1. Create expense record
      const expense = await tx.expense.create({
        data: {
          companyId: effectiveCompanyId,
          expenseNumber,
          expenseType: expenseType || 'MISCELLANEOUS',
          description,
          amount,
          paymentDate: new Date(paymentDate),
          paymentMode: paymentMode || 'CASH',
          paymentReference,
          payeeName,
          createdById: createdById || 'system',
          receiptUrl,
          remarks,
          isApproved: true,
        },
      });

      // 2. Update bank account balance if payment is via bank
      let newBankBalance: number | undefined;
      if (bankAccount) {
        newBankBalance = bankAccount.currentBalance - amount;
        
        await tx.bankAccount.update({
          where: { id: bankAccount.id },
          data: { currentBalance: newBankBalance },
        });

        // Create bank transaction record
        await tx.bankTransaction.create({
          data: {
            bankAccountId: bankAccount.id,
            transactionType: 'DEBIT',
            amount,
            balanceAfter: newBankBalance,
            description: `Expense: ${description}`,
            referenceType: 'EXPENSE_ENTRY',
            referenceId: expense.id,
            createdById: createdById || 'system',
            transactionDate: new Date(paymentDate),
          },
        });
      }

      // 3. Create journal entry
      try {
        const accountingService = new AccountingService(effectiveCompanyId);
        await accountingService.initializeChartOfAccounts();
        
        await accountingService.recordExpense({
          expenseId: expense.id,
          expenseType: expenseType || 'MISCELLANEOUS',
          expenseAccountCode: accountCode,
          amount,
          description,
          expenseDate: new Date(paymentDate),
          createdById: createdById || 'system',
          paymentMode: paymentMode || 'CASH',
          bankAccountId: bankAccount?.id,
          isPayable: false,
        });
      } catch (accError) {
        console.error('Journal entry creation failed:', accError);
        // Continue - expense is still recorded
      }

      return { expense, newBankBalance, bankAccount };
    });

    return NextResponse.json({ 
      success: true,
      expense: result.expense,
      newBankBalance: result.newBankBalance,
      bankName: result.bankAccount?.bankName,
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

// DELETE - Delete expense (only if not approved)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Expense ID required' }, { status: 400 });
    }

    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.isApproved) {
      return NextResponse.json({ error: 'Cannot delete approved expense' }, { status: 400 });
    }

    await db.expense.delete({ where: { id } });

    return NextResponse.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
