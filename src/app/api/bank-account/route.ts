import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch all bank accounts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    const where: any = { isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }

    const accounts = await db.bankAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ 
      success: true, 
      accounts 
    });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch bank accounts' }, { status: 500 });
  }
}

// POST - Create new bank account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bankName,
      accountNumber,
      accountName,
      ifscCode,
      branchName,
      companyId,
      accountType = 'SAVINGS',
      openingBalance = 0
    } = body;

    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const account = await db.bankAccount.create({
      data: {
        companyId: companyId || 'default',
        bankName,
        accountNumber,
        accountName,
        ifscCode,
        branchName,
        accountType,
        openingBalance,
        currentBalance: openingBalance,
        isActive: true
      }
    });

    return NextResponse.json({ 
      success: true, 
      account 
    });
  } catch (error) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 });
  }
}
