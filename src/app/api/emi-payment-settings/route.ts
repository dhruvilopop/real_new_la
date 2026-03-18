import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch EMI Payment Settings
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const emiScheduleId = searchParams.get('emiScheduleId');
    const loanApplicationId = searchParams.get('loanApplicationId');
    const action = searchParams.get('action');

    // Get all secondary payment pages for a company
    if (action === 'secondary-pages') {
      const companyId = searchParams.get('companyId');
      if (!companyId) {
        return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
      }

      const pages = await db.secondaryPaymentPage.findMany({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({ success: true, pages });
    }

    // Get company default bank account for payment
    if (action === 'company-default') {
      const companyId = searchParams.get('companyId');
      if (!companyId) {
        return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
      }

      // Get company's default bank account
      const defaultBankAccount = await db.bankAccount.findFirst({
        where: { 
          companyId,
          isActive: true,
          isDefault: true 
        }
      });

      // Get company payment settings for UPI/QR
      const paymentSettings = await db.companyPaymentSettings.findUnique({
        where: { companyId }
      });

      return NextResponse.json({ 
        success: true, 
        bankAccount: defaultBankAccount,
        paymentSettings 
      });
    }

    // Get settings for a specific EMI
    if (emiScheduleId) {
      let settings = await db.eMIPaymentSetting.findUnique({
        where: { emiScheduleId },
        include: {
          secondaryPaymentPage: true
        }
      });

      if (!settings) {
        // Create default settings
        const emi = await db.eMISchedule.findUnique({
          where: { id: emiScheduleId },
          include: {
            loanApplication: {
              select: { companyId: true }
            }
          }
        });

        if (emi) {
          settings = await db.eMIPaymentSetting.create({
            data: {
              emiScheduleId,
              loanApplicationId: emi.loanApplicationId,
              enableFullPayment: true,
              enablePartialPayment: true,
              enableInterestOnly: true,
              useDefaultCompanyPage: true
            },
            include: {
              secondaryPaymentPage: true
            }
          });
        }
      }

      return NextResponse.json({ success: true, settings });
    }

    // Get all settings for a loan application
    if (loanApplicationId) {
      const settings = await db.eMIPaymentSetting.findMany({
        where: { loanApplicationId },
        include: {
          secondaryPaymentPage: true
        }
      });

      return NextResponse.json({ success: true, settings });
    }

    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching EMI payment settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST - Create or Update EMI Payment Settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      emiScheduleId,
      loanApplicationId,
      enableFullPayment,
      enablePartialPayment,
      enableInterestOnly,
      useDefaultCompanyPage,
      secondaryPaymentPageId,
      modifiedById
    } = body;

    if (!emiScheduleId || !loanApplicationId) {
      return NextResponse.json({ error: 'EMI Schedule ID and Loan Application ID are required' }, { status: 400 });
    }

    // Upsert settings
    const settings = await db.eMIPaymentSetting.upsert({
      where: { emiScheduleId },
      create: {
        emiScheduleId,
        loanApplicationId,
        enableFullPayment: enableFullPayment ?? true,
        enablePartialPayment: enablePartialPayment ?? true,
        enableInterestOnly: enableInterestOnly ?? true,
        useDefaultCompanyPage: useDefaultCompanyPage ?? true,
        secondaryPaymentPageId,
        lastModifiedById: modifiedById
      },
      update: {
        enableFullPayment,
        enablePartialPayment,
        enableInterestOnly,
        useDefaultCompanyPage,
        secondaryPaymentPageId,
        lastModifiedById: modifiedById
      },
      include: {
        secondaryPaymentPage: true
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Error saving EMI payment settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

// PUT - Create Secondary Payment Page
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      name,
      description,
      upiId,
      qrCodeUrl,
      bankName,
      accountNumber,
      accountName,
      ifscCode,
      createdById
    } = body;

    if (!companyId || !name || !createdById) {
      return NextResponse.json({ error: 'Company ID, name, and creator ID are required' }, { status: 400 });
    }

    const page = await db.secondaryPaymentPage.create({
      data: {
        companyId,
        name,
        description,
        upiId,
        qrCodeUrl,
        bankName,
        accountNumber,
        accountName,
        ifscCode,
        createdById
      }
    });

    return NextResponse.json({ success: true, page });
  } catch (error) {
    console.error('Error creating secondary payment page:', error);
    return NextResponse.json({ error: 'Failed to create payment page' }, { status: 500 });
  }
}

// DELETE - Delete Secondary Payment Page
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    // Soft delete by setting isActive to false
    await db.secondaryPaymentPage.update({
      where: { id: pageId },
      data: { isActive: false }
    });

    return NextResponse.json({ success: true, message: 'Payment page deactivated' });
  } catch (error) {
    console.error('Error deleting secondary payment page:', error);
    return NextResponse.json({ error: 'Failed to delete payment page' }, { status: 500 });
  }
}
