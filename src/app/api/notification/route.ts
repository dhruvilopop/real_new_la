import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, CacheTTL } from '@/lib/cache';

// Cache TTL for notifications - 30 seconds (notifications change frequently)
const CACHE_TTL = CacheTTL.SHORT;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `notifications:${userId}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, ...cached });
    }

    // Parallel queries for speed
    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
          data: true
        }
      }),
      db.notification.count({
        where: { userId, isRead: false }
      })
    ]);

    const result = { notifications, unreadCount };
    
    // Cache the result
    cache.set(cacheKey, result, CACHE_TTL);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, title, message, data } = body;

    if (!userId || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const notification = await db.notification.create({
      data: {
        userId,
        type: type || 'GENERAL',
        title,
        message,
        data: data ? JSON.stringify(data) : null
      }
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isRead, markAllRead, userId } = body;

    if (markAllRead && userId) {
      await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
      });
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    const notification = await db.notification.update({
      where: { id },
      data: { isRead }
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
