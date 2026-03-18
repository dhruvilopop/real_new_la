import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, CACHE_KEYS } from '@/lib/cache';

export async function GET() {
  try {
    // Use cache for settings (cache for 60 seconds)
    const settings = await cache.getOrSet(
      CACHE_KEYS.SETTINGS,
      async () => {
        const result = await db.systemSetting.findMany({
          select: { key: true, value: true }
        });
        return result;
      },
      60000 // 1 minute cache
    );

    const settingsObj: Record<string, string> = {};
    for (const setting of settings) {
      settingsObj[setting.key] = setting.value;
    }

    return NextResponse.json({ settings: settingsObj });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Settings object is required' }, { status: 400 });
    }

    // Batch upsert using transaction
    const updates = Object.entries(settings).map(([key, value]) =>
      db.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    );

    await db.$transaction(updates);

    // Clear cache after update
    cache.delete(CACHE_KEYS.SETTINGS);

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
