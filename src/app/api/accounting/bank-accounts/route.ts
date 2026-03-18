import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper function to get or create default company
async function getOrCreateDefaultCompany(providedCompanyId: string | null) {
  if (providedCompanyId && providedCompanyId !== 'default') {
    // Check if company exists
    const company = await db.company.findUnique({
      where: { id: providedCompanyId },
    });
    if (company) {
      return providedCompanyId;
    }
  }
  
  // Try to find any existing company
  const anyCompany = await db.company.findFirst();
  if (anyCompany) {
    return anyCompany.id;
  }
  
  // Create a default company if none exists
  const defaultCompany = await db.company.create({
    data: {
      name: 'Default Company',
      code: 'DEFAULT',
      isActive: true,
    },
  });
  return defaultCompany.id;
}

// GET - Fetch bank accounts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default';
    const isActive = searchParams.get('isActive');

    // Get all bank accounts (ignore company filter if 'default' or not found)
    let where: any = {};
    
    if (companyId && companyId !== 'default') {
      const company = await db.company.findUnique({ where: { id: companyId } });
      if (company) {
        where.companyId = companyId;
      }
    }
    
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const bankAccounts = await db.bankAccount.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { bankName: 'asc' },
      ],
    });

    return NextResponse.json({ bankAccounts });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ bankAccounts: [] });
  }
}

// POST - Create new bank account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      companyId: providedCompanyId,
      bankName, 
      accountNumber, 
      accountName, 
      branchName, 
      ifscCode, 
      accountType,
      openingBalance = 0,
      isDefault = false,
    } = body;

    // Get or create a valid company ID
    const companyId = await getOrCreateDefaultCompany(providedCompanyId);

    // Check if account number already exists for this company
    const existing = await db.bankAccount.findFirst({
      where: { 
        companyId, 
        accountNumber 
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Bank account number already exists' }, { status: 400 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.bankAccount.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const bankAccount = await db.bankAccount.create({
      data: {
        companyId,
        bankName,
        accountNumber,
        accountName: accountName || bankName,
        branchName,
        ifscCode,
        accountType: accountType || 'SAVINGS',
        openingBalance,
        currentBalance: openingBalance,
        isDefault,
        isActive: true,
      },
    });

    return NextResponse.json({ bankAccount });
  } catch (error) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 });
  }
}

// PUT - Update bank account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, bankName, accountName, branchName, ifscCode, isDefault, isActive } = body;

    const bankAccount = await db.bankAccount.findUnique({ where: { id } });
    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.bankAccount.updateMany({
        where: { companyId: bankAccount.companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await db.bankAccount.update({
      where: { id },
      data: {
        bankName,
        accountName,
        branchName,
        ifscCode,
        isDefault,
        isActive,
      },
    });

    return NextResponse.json({ bankAccount: updated });
  } catch (error) {
    console.error('Error updating bank account:', error);
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 });
  }
}

// DELETE - Deactivate bank account
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bank account ID required' }, { status: 400 });
    }

    // Soft delete - just deactivate
    const bankAccount = await db.bankAccount.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: 'Bank account deactivated', bankAccount });
  } catch (error) {
    console.error('Error deactivating bank account:', error);
    return NextResponse.json({ error: 'Failed to deactivate bank account' }, { status: 500 });
  }
}
