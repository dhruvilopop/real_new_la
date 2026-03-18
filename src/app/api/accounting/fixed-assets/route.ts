import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AssetCategory, AssetStatus, DepreciationMethod } from '@prisma/client';

// GET - List all fixed assets with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default';
    const category = searchParams.get('category') as AssetCategory | null;
    const status = searchParams.get('status') as AssetStatus | null;
    const search = searchParams.get('search');
    const includeDepreciation = searchParams.get('includeDepreciation') === 'true';

    const where: any = { companyId };
    if (category) where.assetCategory = category;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { assetCode: { contains: search } },
        { assetName: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const assets = await db.fixedAsset.findMany({
      where,
      include: includeDepreciation ? {
        depreciationLogs: {
          orderBy: { depreciationDate: 'desc' },
          take: 12, // Last 12 depreciation entries
        }
      } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary statistics
    const summary = {
      totalAssets: assets.length,
      totalCost: assets.reduce((sum, a) => sum + a.totalCost, 0),
      totalDepreciation: assets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0),
      totalBookValue: assets.reduce((sum, a) => sum + a.currentBookValue, 0),
      activeCount: assets.filter(a => a.status === 'ACTIVE').length,
      disposedCount: assets.filter(a => ['DISPOSED', 'SOLD'].includes(a.status)).length,
      byCategory: {} as Record<string, { count: number; value: number }>,
    };

    // Group by category
    assets.forEach(asset => {
      if (!summary.byCategory[asset.assetCategory]) {
        summary.byCategory[asset.assetCategory] = { count: 0, value: 0 };
      }
      summary.byCategory[asset.assetCategory].count++;
      summary.byCategory[asset.assetCategory].value += asset.currentBookValue;
    });

    return NextResponse.json({ assets, summary });
  } catch (error) {
    console.error('Error fetching fixed assets:', error);
    return NextResponse.json({ error: 'Failed to fetch fixed assets' }, { status: 500 });
  }
}

// POST - Create new fixed asset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId = 'default',
      assetCode,
      assetName,
      assetCategory,
      description,
      serialNumber,
      location,
      department,
      purchaseDate,
      purchaseCost,
      additionalCosts = 0,
      salvageValue = 0,
      usefulLifeYears,
      usefulLifeMonths,
      depreciationMethod = 'STRAIGHT_LINE',
      depreciationRate,
      insuranceProvider,
      insurancePolicyNo,
      insuranceExpiryDate,
      warrantyProvider,
      warrantyExpiryDate,
      invoiceNumber,
      invoiceDate,
      invoiceUrl,
      imageUrl,
      createdById,
    } = body;

    // Validate required fields
    if (!assetCode || !assetName || !assetCategory || !purchaseDate || !purchaseCost || !usefulLifeYears) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if asset code already exists
    const existingAsset = await db.fixedAsset.findUnique({
      where: { companyId_assetCode: { companyId, assetCode } },
    });

    if (existingAsset) {
      return NextResponse.json({ error: 'Asset code already exists' }, { status: 400 });
    }

    // Calculate total cost and depreciation rate if not provided
    const totalCost = purchaseCost + (additionalCosts || 0);
    const months = usefulLifeMonths || (usefulLifeYears * 12);
    
    let calculatedDepreciationRate = depreciationRate;
    if (!calculatedDepreciationRate) {
      if (depreciationMethod === 'STRAIGHT_LINE') {
        // Annual depreciation rate = (Cost - Salvage) / (Useful Life * Cost) * 100
        calculatedDepreciationRate = ((totalCost - salvageValue) / (usefulLifeYears * totalCost)) * 100;
      } else if (depreciationMethod === 'DIMINISHING_BALANCE' || depreciationMethod === 'WRITTEN_DOWN_VALUE') {
        // WDV rate formula: 1 - (salvageValue/cost)^(1/usefulLife)
        calculatedDepreciationRate = (1 - Math.pow(salvageValue / totalCost, 1 / usefulLifeYears)) * 100;
      }
    }

    // Calculate initial book value (same as total cost for new asset)
    const currentBookValue = totalCost;

    const asset = await db.fixedAsset.create({
      data: {
        companyId,
        assetCode,
        assetName,
        assetCategory: assetCategory as AssetCategory,
        description,
        serialNumber,
        location,
        department,
        purchaseDate: new Date(purchaseDate),
        purchaseCost,
        additionalCosts,
        totalCost,
        salvageValue,
        usefulLifeYears,
        usefulLifeMonths: months,
        depreciationMethod: depreciationMethod as DepreciationMethod,
        depreciationRate: calculatedDepreciationRate,
        accumulatedDepreciation: 0,
        currentBookValue,
        status: 'ACTIVE' as AssetStatus,
        acquisitionDate: new Date(purchaseDate),
        insuranceProvider,
        insurancePolicyNo,
        insuranceExpiryDate: insuranceExpiryDate ? new Date(insuranceExpiryDate) : null,
        warrantyProvider,
        warrantyExpiryDate: warrantyExpiryDate ? new Date(warrantyExpiryDate) : null,
        invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        invoiceUrl,
        imageUrl,
        createdById,
      },
    });

    // Create automatic journal entry for asset acquisition
    try {
      // Get or create the Fixed Asset account
      let fixedAssetAccount = await db.chartOfAccount.findFirst({
        where: { companyId, accountCode: { startsWith: '13' }, accountName: { contains: assetCategory } },
      });

      if (!fixedAssetAccount) {
        // Get default Fixed Assets account
        fixedAssetAccount = await db.chartOfAccount.findFirst({
          where: { companyId, accountCode: '1300' },
        });
      }

      // Get Bank/Cash account
      const bankAccount = await db.chartOfAccount.findFirst({
        where: { companyId, accountCode: { startsWith: '12' } },
      });

      if (fixedAssetAccount && bankAccount) {
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
            entryDate: new Date(purchaseDate),
            referenceType: 'ASSET_ACQUISITION',
            referenceId: asset.id,
            narration: `Fixed Asset Acquisition: ${assetName} (${assetCode})`,
            totalDebit: totalCost,
            totalCredit: totalCost,
            isAutoEntry: true,
            isApproved: true,
            createdById,
            lines: {
              create: [
                {
                  accountId: fixedAssetAccount.id,
                  debitAmount: totalCost,
                  creditAmount: 0,
                  narration: `Fixed Asset - ${assetName}`,
                },
                {
                  accountId: bankAccount.id,
                  debitAmount: 0,
                  creditAmount: totalCost,
                  narration: `Payment for ${assetName}`,
                },
              ],
            },
          },
        });
      }
    } catch (journalError) {
      console.error('Failed to create journal entry for asset:', journalError);
      // Don't fail the asset creation if journal entry fails
    }

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error('Error creating fixed asset:', error);
    return NextResponse.json({ error: 'Failed to create fixed asset', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// PUT - Update fixed asset
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    // Get current asset
    const currentAsset = await db.fixedAsset.findUnique({ where: { id } });
    if (!currentAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Prepare update data
    const data: any = { ...updateData };
    
    // Handle date fields
    if (updateData.purchaseDate) data.purchaseDate = new Date(updateData.purchaseDate);
    if (updateData.disposalDate) data.disposalDate = new Date(updateData.disposalDate);
    if (updateData.insuranceExpiryDate) data.insuranceExpiryDate = new Date(updateData.insuranceExpiryDate);
    if (updateData.warrantyExpiryDate) data.warrantyExpiryDate = new Date(updateData.warrantyExpiryDate);
    if (updateData.invoiceDate) data.invoiceDate = new Date(updateData.invoiceDate);
    
    // Recalculate total cost if purchase cost or additional costs changed
    if (updateData.purchaseCost !== undefined || updateData.additionalCosts !== undefined) {
      data.totalCost = (updateData.purchaseCost ?? currentAsset.purchaseCost) + 
                       (updateData.additionalCosts ?? currentAsset.additionalCosts);
    }

    // Handle status change to disposed/sold
    if (updateData.status && ['DISPOSED', 'SOLD'].includes(updateData.status)) {
      data.disposalDate = updateData.disposalDate ? new Date(updateData.disposalDate) : new Date();
    }

    const asset = await db.fixedAsset.update({
      where: { id },
      data,
    });

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Error updating fixed asset:', error);
    return NextResponse.json({ error: 'Failed to update fixed asset' }, { status: 500 });
  }
}

// DELETE - Delete fixed asset
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    // Check if asset exists
    const asset = await db.fixedAsset.findUnique({
      where: { id },
      include: { depreciationLogs: true },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Delete depreciation logs first (cascade)
    await db.assetDepreciationLog.deleteMany({
      where: { assetId: id },
    });

    // Delete the asset
    await db.fixedAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting fixed asset:', error);
    return NextResponse.json({ error: 'Failed to delete fixed asset' }, { status: 500 });
  }
}
