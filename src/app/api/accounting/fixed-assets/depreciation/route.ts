import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format } from 'date-fns';

// POST - Calculate and record depreciation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      assetId, 
      companyId = 'default',
      calculationDate = new Date(),
      period, // e.g., "March 2024"
      financialYear, // e.g., "2024-25"
      createJournalEntry = true,
      createdById,
    } = body;

    // Get all active assets to calculate depreciation
    const where: any = { companyId, status: 'ACTIVE' };
    if (assetId) where.id = assetId;

    const assets = await db.fixedAsset.findMany({ where });

    if (assets.length === 0) {
      return NextResponse.json({ message: 'No active assets found for depreciation', results: [] });
    }

    const results: any[] = [];
    const journalLines: any[] = [];
    let totalDepreciation = 0;

    for (const asset of assets) {
      // Skip if fully depreciated
      if (asset.currentBookValue <= asset.salvageValue) {
        results.push({
          assetId: asset.id,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          status: 'skipped',
          reason: 'Already fully depreciated',
        });
        continue;
      }

      // Calculate depreciation based on method
      let depreciationAmount = 0;
      
      switch (asset.depreciationMethod) {
        case 'STRAIGHT_LINE':
          // Annual depreciation = (Cost - Salvage) / Useful Life
          const annualDepreciation = (asset.totalCost - asset.salvageValue) / asset.usefulLifeYears;
          depreciationAmount = annualDepreciation / 12; // Monthly depreciation
          break;

        case 'DIMINISHING_BALANCE':
        case 'WRITTEN_DOWN_VALUE':
          // WDV: Depreciation = Book Value * Rate / 12
          const monthlyRate = (asset.depreciationRate || 0) / 100 / 12;
          depreciationAmount = asset.currentBookValue * monthlyRate;
          break;

        case 'UNITS_OF_PRODUCTION':
          // This would require production units data - use straight line as fallback
          const fallbackAnnual = (asset.totalCost - asset.salvageValue) / asset.usefulLifeYears;
          depreciationAmount = fallbackAnnual / 12;
          break;

        default:
          depreciationAmount = 0;
      }

      // Ensure we don't depreciate below salvage value
      const maxAllowedDepreciation = asset.currentBookValue - asset.salvageValue;
      depreciationAmount = Math.min(depreciationAmount, maxAllowedDepreciation);

      if (depreciationAmount <= 0) {
        results.push({
          assetId: asset.id,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          status: 'skipped',
          reason: 'No depreciation to record',
        });
        continue;
      }

      // Calculate new book value
      const newBookValue = asset.currentBookValue - depreciationAmount;
      const newAccumulatedDepreciation = asset.accumulatedDepreciation + depreciationAmount;

      // Create depreciation log
      const depreciationLog = await db.assetDepreciationLog.create({
        data: {
          assetId: asset.id,
          depreciationDate: new Date(calculationDate),
          financialYear: financialYear || getCurrentFinancialYear(),
          period: period || format(new Date(calculationDate), 'MMMM yyyy'),
          openingBookValue: asset.currentBookValue,
          depreciationAmount,
          closingBookValue: newBookValue,
          calculatedById: createdById,
        },
      });

      // Update asset
      await db.fixedAsset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: newAccumulatedDepreciation,
          currentBookValue: newBookValue,
          lastDepreciationDate: new Date(calculationDate),
        },
      });

      totalDepreciation += depreciationAmount;

      results.push({
        assetId: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        status: 'success',
        depreciationAmount,
        previousBookValue: asset.currentBookValue,
        newBookValue,
        logId: depreciationLog.id,
      });

      // Prepare journal entry line
      journalLines.push({
        assetId: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        depreciationAmount,
      });
    }

    // Create journal entry for total depreciation
    if (createJournalEntry && totalDepreciation > 0 && journalLines.length > 0) {
      try {
        // Get Depreciation Expense account
        let depreciationExpenseAccount = await db.chartOfAccount.findFirst({
          where: { companyId, accountCode: { startsWith: '51' }, accountName: { contains: 'Depreciation' } },
        });

        if (!depreciationExpenseAccount) {
          // Create if not exists
          depreciationExpenseAccount = await db.chartOfAccount.create({
            data: {
              companyId,
              accountCode: '5100',
              accountName: 'Depreciation Expense',
              accountType: 'EXPENSE',
              description: 'Depreciation on fixed assets',
              isSystemAccount: true,
            },
          });
        }

        // Get Accumulated Depreciation account
        let accumulatedDepAccount = await db.chartOfAccount.findFirst({
          where: { companyId, accountCode: { startsWith: '13' }, accountName: { contains: 'Accumulated Depreciation' } },
        });

        if (!accumulatedDepAccount) {
          accumulatedDepAccount = await db.chartOfAccount.create({
            data: {
              companyId,
              accountCode: '1310',
              accountName: 'Accumulated Depreciation',
              accountType: 'ASSET',
              description: 'Accumulated depreciation on fixed assets',
              isSystemAccount: true,
            },
          });
        }

        // Get last journal entry number
        const lastEntry = await db.journalEntry.findFirst({
          where: { companyId },
          orderBy: { entryNumber: 'desc' },
        });
        const entryNumber = lastEntry ? `JE-${String(parseInt(lastEntry.entryNumber.replace('JE-', '')) + 1).padStart(6, '0')}` : 'JE-000001';

        await db.journalEntry.create({
          data: {
            companyId,
            entryNumber,
            entryDate: new Date(calculationDate),
            referenceType: 'DEPRECIATION',
            narration: `Depreciation for ${period || format(new Date(calculationDate), 'MMMM yyyy')}`,
            totalDebit: totalDepreciation,
            totalCredit: totalDepreciation,
            isAutoEntry: true,
            isApproved: true,
            createdById,
            lines: {
              create: [
                {
                  accountId: depreciationExpenseAccount.id,
                  debitAmount: totalDepreciation,
                  creditAmount: 0,
                  narration: `Depreciation expense - ${period || format(new Date(calculationDate), 'MMMM yyyy')}`,
                },
                {
                  accountId: accumulatedDepAccount.id,
                  debitAmount: 0,
                  creditAmount: totalDepreciation,
                  narration: `Accumulated depreciation - ${period || format(new Date(calculationDate), 'MMMM yyyy')}`,
                },
              ],
            },
          },
        });
      } catch (journalError) {
        console.error('Failed to create depreciation journal entry:', journalError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Depreciation calculated for ${results.filter(r => r.status === 'success').length} assets`,
      totalDepreciation,
      results,
    });
  } catch (error) {
    console.error('Error calculating depreciation:', error);
    return NextResponse.json({ error: 'Failed to calculate depreciation', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// GET - Get depreciation schedule for an asset
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    const companyId = searchParams.get('companyId') || 'default';
    const financialYear = searchParams.get('financialYear');

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    const where: any = { assetId };
    if (financialYear) where.financialYear = financialYear;

    const depreciationLogs = await db.assetDepreciationLog.findMany({
      where,
      orderBy: { depreciationDate: 'asc' },
    });

    // Get asset details
    const asset = await db.fixedAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Calculate future depreciation schedule
    const schedule: any[] = [];
    let remainingValue = asset.currentBookValue;
    let remainingLife = asset.usefulLifeMonths - (depreciationLogs.length);
    
    for (let month = 1; month <= remainingLife && remainingValue > asset.salvageValue; month++) {
      let monthlyDep = 0;
      
      switch (asset.depreciationMethod) {
        case 'STRAIGHT_LINE':
          monthlyDep = (asset.totalCost - asset.salvageValue) / asset.usefulLifeMonths;
          break;
        case 'DIMINISHING_BALANCE':
        case 'WRITTEN_DOWN_VALUE':
          const monthlyRate = (asset.depreciationRate || 0) / 100 / 12;
          monthlyDep = remainingValue * monthlyRate;
          break;
        default:
          monthlyDep = (asset.totalCost - asset.salvageValue) / asset.usefulLifeMonths;
      }

      monthlyDep = Math.min(monthlyDep, remainingValue - asset.salvageValue);
      remainingValue -= monthlyDep;

      schedule.push({
        month,
        depreciationAmount: monthlyDep,
        bookValueAfter: remainingValue,
      });
    }

    return NextResponse.json({
      asset,
      depreciationHistory: depreciationLogs,
      futureSchedule: schedule,
      summary: {
        totalDepreciated: asset.accumulatedDepreciation,
        remainingToDepreciate: Math.max(0, asset.currentBookValue - asset.salvageValue),
        currentBookValue: asset.currentBookValue,
        monthsRemaining: remainingLife,
      },
    });
  } catch (error) {
    console.error('Error fetching depreciation schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch depreciation schedule' }, { status: 500 });
  }
}

// Helper function to get current financial year
function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  
  // In India, financial year starts in April
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
}
