import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string || 'other';
    const loanId = formData.get('loanId') as string;
    const uploadedBy = formData.get('uploadedBy') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Allow images and PDFs for documents
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
      'application/pdf',
      'image/heic', 'image/heif' // For mobile uploads
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only images (PNG, JPG, WEBP) and PDF allowed.' 
      }, { status: 400 });
    }

    // Max 10MB for documents
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || 'bin';
    const filename = `doc-${documentType}-${timestamp}-${randomStr}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    const url = `/uploads/documents/${filename}`;

    // Save to database
    const uploadedFile = await db.uploadedFile.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        path: url,
        uploadedBy: uploadedBy || null
      }
    });

    // If loanId is provided, update the loan application with the document
    if (loanId) {
      const docFieldMap: Record<string, string> = {
        'pan_card': 'panCardDoc',
        'aadhaar_front': 'aadhaarFrontDoc',
        'aadhaar_back': 'aadhaarBackDoc',
        'income_proof': 'incomeProofDoc',
        'address_proof': 'addressProofDoc',
        'photo': 'photoDoc',
        'bank_statement': 'bankStatementDoc',
        'salary_slip': 'salarySlipDoc',
        'other': 'otherDocs'
      };

      const fieldName = docFieldMap[documentType] || 'otherDocs';
      
      await db.loanApplication.update({
        where: { id: loanId },
        data: { [fieldName]: url }
      });
    }

    return NextResponse.json({ 
      success: true, 
      url,
      filename,
      id: uploadedFile.id
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to upload document',
      details: (error as Error).message 
    }, { status: 500 });
  }
}
