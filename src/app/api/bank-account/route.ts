import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch all bank accounts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const action = searchParams.get('action');

    // Get default bank account for a company
    if (action === 'default') {
      if (!companyId) {
        return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
      }

      const defaultAccount = await db.bankAccount.findFirst({
        where: {
          companyId,
          isActive: true,
          isDefault: true
        }
      });

      return NextResponse.json({
        success: true,
        account: defaultAccount
      });
    }

    const where: any = { isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }

    const accounts = await db.bankAccount.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
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
      accountType = 'CURRENT',
      openingBalance = 0,
      upiId,
      qrCodeUrl,
      isDefault
    } = body;

    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // If setting as default, unset any existing default for this company
    if (isDefault && companyId) {
      await db.bankAccount.updateMany({
        where: {
          companyId,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });
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
        isActive: true,
        isDefault: isDefault ?? false,
        upiId,
        qrCodeUrl
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

// PUT - Update bank account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      bankName,
      accountNumber,
      accountName,
      ifscCode,
      branchName,
      accountType,
      upiId,
      qrCodeUrl,
      isDefault,
      companyId
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Bank Account ID is required' }, { status: 400 });
    }

    // If setting as default, unset any existing default for this company
    if (isDefault && companyId) {
      await db.bankAccount.updateMany({
        where: {
          companyId,
          isDefault: true,
          id: { not: id }
        },
        data: {
          isDefault: false
        }
      });
    }

    const updateData: any = {};
    if (bankName !== undefined) updateData.bankName = bankName;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
    if (accountName !== undefined) updateData.accountName = accountName;
    if (ifscCode !== undefined) updateData.ifscCode = ifscCode;
    if (branchName !== undefined) updateData.branchName = branchName;
    if (accountType !== undefined) updateData.accountType = accountType;
    if (upiId !== undefined) updateData.upiId = upiId;
    if (qrCodeUrl !== undefined) updateData.qrCodeUrl = qrCodeUrl;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const account = await db.bankAccount.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      account
    });
  } catch (error) {
    console.error('Error updating bank account:', error);
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 });
  }
}

// DELETE - Soft delete bank account
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bank Account ID is required' }, { status: 400 });
    }

    // Check if this is the default account
    const account = await db.bankAccount.findUnique({
      where: { id }
    });

    if (account?.isDefault) {
      return NextResponse.json({
        error: 'Cannot delete default bank account. Set another account as default first.'
      }, { status: 400 });
    }

    // Soft delete
    await db.bankAccount.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Bank account deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 500 });
  }
}
