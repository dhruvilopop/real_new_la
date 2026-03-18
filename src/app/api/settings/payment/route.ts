import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentOptionSettings } from '@prisma/client';

// Cache for payment settings (in-memory)
let cachedSettings: PaymentOptionSettings | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

// GET - Fetch payment settings (global)
export async function GET(request: NextRequest) {
  try {
    // Use cache if valid
    const now = Date.now();
    if (cachedSettings && (now - cacheTime) < CACHE_TTL) {
      return NextResponse.json({ success: true, settings: formatSettings(cachedSettings) });
    }

    // Find global settings
    let settings = await db.paymentOptionSettings.findFirst({
      where: { scope: 'GLOBAL' }
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await db.paymentOptionSettings.create({
        data: {
          scope: 'GLOBAL',
          enableFullPayment: true,
          enablePartialPayment: true,
          enableInterestOnly: true,
          maxPartialPayments: 2,
          maxInterestOnlyPerLoan: 3,
          acceptedPaymentMethods: 'UPI,BANK_TRANSFER,CASH',
          defaultUpiId: '',
          defaultQrCodeUrl: '',
          defaultBankDetails: '',
          createdById: 'system'
        }
      });
    }

    // Update cache
    cachedSettings = settings;
    cacheTime = now;

    return NextResponse.json({ success: true, settings: formatSettings(settings) });
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// Format settings for frontend
function formatSettings(settings: PaymentOptionSettings) {
  const formattedSettings: any = {
    companyUpiId: settings.defaultUpiId || '',
    companyQrCodeUrl: settings.defaultQrCodeUrl || '',
    bankName: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    bankBranch: ''
  };

  // Parse bank details if exists
  if (settings.defaultBankDetails) {
    try {
      const bankDetails = JSON.parse(settings.defaultBankDetails);
      formattedSettings.bankName = bankDetails.bankName || '';
      formattedSettings.bankAccountNumber = bankDetails.accountNumber || '';
      formattedSettings.bankIfscCode = bankDetails.ifscCode || '';
      formattedSettings.bankBranch = bankDetails.branch || '';
    } catch (e) {
      // Ignore parse errors
    }
  }

  return formattedSettings;
}

// POST - Update payment settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyUpiId, companyQrCodeUrl, bankName, bankAccountNumber, bankIfscCode, bankBranch } = body;

    // Format bank details as JSON
    const bankDetails = JSON.stringify({
      bankName: bankName || '',
      accountNumber: bankAccountNumber || '',
      ifscCode: bankIfscCode || '',
      branch: bankBranch || ''
    });

    // Find existing global settings
    const existingSettings = await db.paymentOptionSettings.findFirst({
      where: { scope: 'GLOBAL' }
    });

    let settings;
    if (existingSettings) {
      // Update existing settings
      settings = await db.paymentOptionSettings.update({
        where: { id: existingSettings.id },
        data: {
          defaultUpiId: companyUpiId || '',
          defaultQrCodeUrl: companyQrCodeUrl || '',
          defaultBankDetails: bankDetails
        }
      });
    } else {
      // Create new settings
      settings = await db.paymentOptionSettings.create({
        data: {
          scope: 'GLOBAL',
          enableFullPayment: true,
          enablePartialPayment: true,
          enableInterestOnly: true,
          maxPartialPayments: 2,
          maxInterestOnlyPerLoan: 3,
          acceptedPaymentMethods: 'UPI,BANK_TRANSFER,CASH',
          defaultUpiId: companyUpiId || '',
          defaultQrCodeUrl: companyQrCodeUrl || '',
          defaultBankDetails: bankDetails,
          createdById: 'system'
        }
      });
    }

    // Update cache
    cachedSettings = settings;
    cacheTime = Date.now();

    return NextResponse.json({ success: true, settings: formatSettings(settings) });
  } catch (error) {
    console.error('Error saving payment settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
