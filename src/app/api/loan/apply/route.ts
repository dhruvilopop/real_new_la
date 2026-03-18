import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateApplicationNo } from '@/utils/helpers';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, loanType, requestedAmount, requestedTenure, purpose } = body;

    if (!customerId || !requestedAmount || !requestedTenure) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const applicationNo = generateApplicationNo();

    const loan = await db.loanApplication.create({
      data: {
        applicationNo,
        customerId,
        loanType: loanType || 'PERSONAL',
        requestedAmount: parseFloat(requestedAmount),
        requestedTenure: parseInt(requestedTenure),
        purpose,
        status: 'SUBMITTED'
      }
    });

    await db.auditLog.create({
      data: {
        userId: customerId,
        action: 'CREATE',
        module: 'LOAN',
        description: `Loan application ${applicationNo} submitted`,
        recordId: loan.id,
        recordType: 'LoanApplication',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      loan
    });
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json(
      { error: 'Failed to create loan application' },
      { status: 500 }
    );
  }
}

// Define valid LoanApplication fields from schema
const VALID_LOAN_APPLICATION_FIELDS = [
  // Personal Info
  'title', 'firstName', 'middleName', 'lastName', 'fatherName', 'motherName',
  'gender', 'maritalStatus', 'dateOfBirth', 'nationality',
  // Contact
  'phone', 'address', 'city', 'state', 'pincode',
  // KYC
  'panNumber', 'aadhaarNumber',
  // Employment - Common
  'employmentType', 'employerName', 'employerAddress', 'designation',
  'yearsInEmployment', 'totalWorkExperience', 'officePhone', 'officeEmail',
  'monthlyIncome', 'annualIncome', 'otherIncome', 'incomeSource',
  // Employment - Self-Employed
  'businessName', 'businessType', 'yearsInBusiness', 'annualTurnover', 'businessAddress',
  // Employment - Business Owner
  'companyName', 'companyType', 'yearsInOperation', 'annualRevenue', 'numberOfEmployees',
  // Employment - Professional
  'professionType', 'practiceName', 'yearsOfPractice', 'professionalRegNo',
  // Employment - Retired
  'previousEmployer', 'retirementDate', 'pensionAmount',
  // Employment - Housewife
  'spouseName', 'spouseOccupation', 'spouseIncome', 'familyIncome',
  // Employment - Student
  'institutionName', 'courseProgram', 'expectedCompletion', 'guardianName', 'guardianIncome',
  // Employment - Unemployed
  'sourceOfFunds', 'monthlySupportAmount', 'supportProviderName',
  // Bank Details
  'bankAccountNumber', 'bankIfsc', 'bankName', 'bankBranch', 'accountType', 'accountHolderName',
  // References
  'reference1Name', 'reference1Phone', 'reference1Relation', 'reference1Address',
  'reference2Name', 'reference2Phone', 'reference2Relation', 'reference2Address',
  // Documents
  'panCardDoc', 'aadhaarFrontDoc', 'aadhaarBackDoc', 'incomeProofDoc',
  'addressProofDoc', 'photoDoc', 'bankStatementDoc', 'salarySlipDoc',
  'electionCardDoc', 'housePhotoDoc', 'otherDocs',
  // Signature
  'digitalSignature', 'signatureHash', 'consentGiven', 'consentTimestamp', 'consentIp',
  // Risk
  'riskScore', 'fraudFlag', 'fraudReason', 'rejectionReason',
];

// Field type mappings for proper conversion
const FLOAT_FIELDS = [
  'monthlyIncome', 'annualIncome', 'otherIncome', 'annualTurnover', 'annualRevenue',
  'pensionAmount', 'spouseIncome', 'familyIncome', 'guardianIncome', 'monthlySupportAmount',
  'requestedAmount', 'requestedInterestRate', 'loanAmount', 'interestRate', 'emiAmount',
  'processingFee', 'disbursedAmount'
];

const INT_FIELDS = [
  'yearsInEmployment', 'totalWorkExperience', 'yearsInBusiness', 'yearsInOperation',
  'numberOfEmployees', 'yearsOfPractice', 'requestedTenure', 'tenure', 'riskScore', 'creditScore'
];

const DATE_FIELDS = [
  'dateOfBirth', 'retirementDate', 'expectedCompletion', 'consentTimestamp'
];

const BOOLEAN_FIELDS = [
  'panVerified', 'aadhaarVerified', 'bankVerified', 'consentGiven', 'fraudFlag'
];

function convertFieldValue(key: string, value: unknown): unknown {
  // Skip empty values
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  
  // Handle string trimming
  if (typeof value === 'string') {
    value = value.trim();
    if (value === '') return undefined;
  }
  
  // Convert based on field type
  if (FLOAT_FIELDS.includes(key)) {
    const num = parseFloat(String(value));
    return isNaN(num) ? undefined : num;
  }
  
  if (INT_FIELDS.includes(key)) {
    const num = parseInt(String(value));
    return isNaN(num) ? undefined : num;
  }
  
  if (DATE_FIELDS.includes(key)) {
    if (typeof value === 'string' && value) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    }
    return undefined;
  }
  
  if (BOOLEAN_FIELDS.includes(key)) {
    return Boolean(value);
  }
  
  return value;
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[LOAN APPLY API] Received update request:', JSON.stringify(body, null, 2));
    
    const { loanId, status, userId, ...updateData } = body;

    if (!loanId) {
      return NextResponse.json(
        { error: 'Loan ID is required' },
        { status: 400 }
      );
    }

    // Check if loan exists
    const loan = await db.loanApplication.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan application not found' },
        { status: 404 }
      );
    }

    // Build update data - only include valid fields
    const data: Record<string, unknown> = { updatedAt: new Date() };
    
    // Map frontend field names to schema field names
    const fieldMapping: Record<string, string> = {
      ref1Name: 'reference1Name',
      ref1Phone: 'reference1Phone',
      ref1Relation: 'reference1Relation',
      ref1Address: 'reference1Address',
      ref2Name: 'reference2Name',
      ref2Phone: 'reference2Phone',
      ref2Relation: 'reference2Relation',
      ref2Address: 'reference2Address',
      applicantSignature: 'digitalSignature',
    };
    
    // Process each field
    for (const [key, value] of Object.entries(updateData)) {
      // Map field name if needed
      const mappedKey = fieldMapping[key] || key;
      
      // Skip if not a valid field
      if (!VALID_LOAN_APPLICATION_FIELDS.includes(mappedKey)) {
        console.log(`[LOAN APPLY API] Skipping invalid field: ${key}`);
        continue;
      }
      
      // Convert value
      const convertedValue = convertFieldValue(mappedKey, value);
      
      // Only include if conversion was successful
      if (convertedValue !== undefined) {
        data[mappedKey] = convertedValue;
      }
    }

    // Handle status update
    if (status) {
      data.status = status;
      if (status === 'LOAN_FORM_COMPLETED') {
        data.loanFormCompletedAt = new Date();
        data.currentStage = 'SESSION_CREATION';
        
        // Reassign to agent
        if (userId) {
          const staffUser = await db.user.findUnique({
            where: { id: userId },
            select: { agentId: true }
          });
          if (staffUser?.agentId) {
            data.currentHandlerId = staffUser.agentId;
          }
        }
      }
    }

    console.log('[LOAN APPLY API] Update data:', JSON.stringify(data, null, 2));

    // Update the loan application
    const updatedLoan = await db.loanApplication.update({
      where: { id: loanId },
      data
    });

    // Create or update loan form for verification status
    const loanFormData = {
      panVerified: Boolean(updateData.panVerified),
      aadhaarVerified: Boolean(updateData.aadhaarVerified),
      bankVerified: Boolean(updateData.bankVerified),
      employmentVerified: !!(updateData.employmentType && (updateData.employerName || updateData.businessName || updateData.companyName || updateData.institutionName || updateData.spouseName || updateData.previousEmployer || updateData.sourceOfFunds)),
      addressVerified: !!(updateData.address && updateData.city),
      incomeVerified: !!(updateData.monthlyIncome || updateData.annualTurnover || updateData.annualRevenue || updateData.familyIncome || updateData.pensionAmount || updateData.guardianIncome || updateData.monthlySupportAmount),
      verificationDate: new Date(),
      verifiedById: userId || null,
      riskScore: parseInt(updateData.riskScore) || 0,
      fraudFlag: Boolean(updateData.fraudFlag),
      fraudReason: updateData.fraudFlag ? updateData.verificationRemarks : null,
      verificationRemarks: updateData.verificationRemarks || null,
      internalRemarks: updateData.verificationRemarks || null
    };

    const existingLoanForm = await db.loanForm.findUnique({
      where: { loanApplicationId: loanId }
    });

    if (existingLoanForm) {
      await db.loanForm.update({
        where: { loanApplicationId: loanId },
        data: loanFormData
      });
    } else {
      await db.loanForm.create({
        data: {
          loanApplicationId: loanId,
          ...loanFormData
        }
      });
    }

    // Create workflow log
    if (status && status !== loan.status) {
      await db.workflowLog.create({
        data: {
          loanApplicationId: loanId,
          actionById: userId || 'system',
          previousStatus: loan.status,
          newStatus: status,
          action: 'complete_form',
          remarks: updateData.verificationRemarks || 'Verification completed',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      });
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: userId || 'system',
        action: 'UPDATE',
        module: 'LOAN',
        description: `Loan application ${loan.applicationNo} updated`,
        recordId: loanId,
        recordType: 'LoanApplication',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      loan: updatedLoan
    });
    
  } catch (error) {
    console.error('[LOAN APPLY API] Error:', error);
    
    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: `Database error: ${error.code}`, details: error.message },
        { status: 400 }
      );
    }
    
    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update loan application', details: (error as Error).message },
      { status: 500 }
    );
  }
}
