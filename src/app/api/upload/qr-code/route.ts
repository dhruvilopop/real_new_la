import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Allow only images for QR codes
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only images (PNG, JPG, WEBP, GIF) allowed.' 
      }, { status: 400 });
    }

    // Max 5MB for QR codes
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'qr-codes');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || 'png';
    const filename = `qr-${timestamp}-${randomStr}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    const url = `/uploads/qr-codes/${filename}`;

    return NextResponse.json({ 
      success: true, 
      url,
      filename
    });
  } catch (error) {
    console.error('QR code upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to upload QR code',
      details: (error as Error).message 
    }, { status: 500 });
  }
}
