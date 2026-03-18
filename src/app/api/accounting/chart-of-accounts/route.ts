import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AccountingService, DEFAULT_CHART_OF_ACCOUNTS } from '@/lib/accounting-service';

// GET - Fetch chart of accounts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default';
    const accountType = searchParams.get('accountType');
    const isActive = searchParams.get('isActive');

    const where: any = { companyId };
    if (accountType && accountType !== 'all') {
      where.accountType = accountType;
    }
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const accounts = await db.chartOfAccount.findMany({
      where,
      orderBy: [
        { accountType: 'asc' },
        { accountCode: 'asc' },
      ],
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching chart of accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// POST - Create new account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      companyId, 
      accountCode, 
      accountName, 
      accountType, 
      description, 
      openingBalance,
      parentAccountId,
      isSystemAccount = false 
    } = body;

    // Check if account code already exists
    const existing = await db.chartOfAccount.findFirst({
      where: { 
        companyId: companyId || 'default', 
        accountCode 
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 });
    }

    const account = await db.chartOfAccount.create({
      data: {
        companyId: companyId || 'default',
        accountCode,
        accountName,
        accountType,
        description,
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
        parentAccountId,
        isSystemAccount,
        isActive: true,
      },
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

// PUT - Update account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, accountName, description, isActive } = body;

    const account = await db.chartOfAccount.update({
      where: { id },
      data: {
        accountName,
        description,
        isActive,
      },
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

// DELETE - Deactivate account (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    // Check if account is a system account
    const account = await db.chartOfAccount.findUnique({ where: { id } });
    if (account?.isSystemAccount) {
      return NextResponse.json({ error: 'Cannot delete system account' }, { status: 400 });
    }

    // Check if account has transactions
    const lines = await db.journalEntryLine.count({
      where: { accountId: id },
    });

    if (lines > 0) {
      // Soft delete - just deactivate
      await db.chartOfAccount.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: 'Account deactivated (has transactions)' });
    }

    // Hard delete if no transactions
    await db.chartOfAccount.delete({ where: { id } });
    return NextResponse.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
