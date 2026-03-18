import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, CacheKeys } from '@/lib/cache';

// GET - List all products or get single product (CACHED)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const isActive = searchParams.get('isActive');

    if (id) {
      const product = await db.cMSService.findUnique({
        where: { id }
      });
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      return NextResponse.json({ product });
    }

    // Cache active products for 30 seconds
    if (isActive === 'true') {
      const products = await cache.getOrSet(
        CacheKeys.CMS_SERVICES,
        () => db.cMSService.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            icon: true,
            loanType: true,
            minInterestRate: true,
            maxInterestRate: true,
            defaultInterestRate: true,
            minTenure: true,
            maxTenure: true,
            defaultTenure: true,
            minAmount: true,
            maxAmount: true,
            processingFeePercent: true,
            isActive: true,
            order: true
          }
        }),
        30000
      );
      return NextResponse.json({ products });
    }

    const products = await db.cMSService.findMany({
      orderBy: { order: 'asc' }
    });

    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST - Create new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title, description, icon, loanType,
      minInterestRate, maxInterestRate, defaultInterestRate,
      minTenure, maxTenure, defaultTenure,
      minAmount, maxAmount,
      processingFeePercent, processingFeeMin, processingFeeMax,
      latePaymentPenaltyPercent, gracePeriodDays, bounceCharges,
      allowMoratorium, maxMoratoriumMonths,
      allowPrepayment, prepaymentCharges,
      isActive, order
    } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const maxOrder = await db.cMSService.aggregate({
      _max: { order: true }
    });

    const product = await db.cMSService.create({
      data: {
        title,
        description,
        icon: icon || '📝',
        loanType: loanType || 'PERSONAL',
        minInterestRate: parseFloat(minInterestRate) || 8,
        maxInterestRate: parseFloat(maxInterestRate) || 24,
        defaultInterestRate: parseFloat(defaultInterestRate) || 12,
        minTenure: parseInt(minTenure) || 6,
        maxTenure: parseInt(maxTenure) || 60,
        defaultTenure: parseInt(defaultTenure) || 12,
        minAmount: parseFloat(minAmount) || 10000,
        maxAmount: parseFloat(maxAmount) || 10000000,
        processingFeePercent: parseFloat(processingFeePercent) || 1,
        processingFeeMin: parseFloat(processingFeeMin) || 500,
        processingFeeMax: parseFloat(processingFeeMax) || 10000,
        latePaymentPenaltyPercent: parseFloat(latePaymentPenaltyPercent) || 2,
        gracePeriodDays: parseInt(gracePeriodDays) || 5,
        bounceCharges: parseFloat(bounceCharges) || 500,
        allowMoratorium: allowMoratorium !== false,
        maxMoratoriumMonths: parseInt(maxMoratoriumMonths) || 3,
        allowPrepayment: allowPrepayment !== false,
        prepaymentCharges: parseFloat(prepaymentCharges) || 2,
        isActive: isActive !== false,
        order: parseInt(order) || (maxOrder._max.order || 0) + 1
      }
    });

    // Clear cache
    cache.delete(CacheKeys.CMS_SERVICES);

    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

// PUT - Update product
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    const numericFields = [
      'minInterestRate', 'maxInterestRate', 'defaultInterestRate',
      'minTenure', 'maxTenure', 'defaultTenure',
      'minAmount', 'maxAmount',
      'processingFeePercent', 'processingFeeMin', 'processingFeeMax',
      'latePaymentPenaltyPercent', 'gracePeriodDays', 'bounceCharges',
      'maxMoratoriumMonths', 'prepaymentCharges', 'order'
    ];

    const intFields = ['minTenure', 'maxTenure', 'defaultTenure', 'gracePeriodDays', 'maxMoratoriumMonths', 'order'];

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (numericFields.includes(key)) {
          updateData[key] = intFields.includes(key) ? parseInt(value as string) : parseFloat(value as string);
        } else if (key === 'allowMoratorium' || key === 'allowPrepayment' || key === 'isActive') {
          updateData[key] = value === true || value === 'true';
        } else {
          updateData[key] = value;
        }
      }
    }

    const product = await db.cMSService.update({
      where: { id },
      data: updateData
    });

    // Clear cache
    cache.delete(CacheKeys.CMS_SERVICES);

    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// DELETE - Delete product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await db.cMSService.delete({
      where: { id }
    });

    // Clear cache
    cache.delete(CacheKeys.CMS_SERVICES);

    return NextResponse.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
