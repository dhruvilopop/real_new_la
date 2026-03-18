'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Download, Printer, FileText, Building, User, Phone, Mail, MapPin, Calendar, Briefcase, Banknote, Users, CreditCard, CheckCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';

interface LoanApplicationFormProps {
  loanData: {
    id: string;
    applicationNo: string;
    status: string;
    loanType: string;
    purpose?: string;
    createdAt: string;
    requestedAmount: number;
    requestedTenure?: number;
    requestedInterestRate?: number;
    title?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    fatherName?: string;
    motherName?: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    nationality?: string;
    panNumber?: string;
    aadhaarNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    employmentType?: string;
    employerName?: string;
    employerAddress?: string;
    designation?: string;
    yearsInEmployment?: number;
    totalWorkExperience?: number;
    monthlyIncome?: number;
    annualIncome?: number;
    businessName?: string;
    businessType?: string;
    yearsInBusiness?: string;
    annualTurnover?: string;
    companyName?: string;
    companyType?: string;
    yearsInOperation?: string;
    annualRevenue?: string;
    professionType?: string;
    practiceName?: string;
    yearsOfPractice?: string;
    professionalRegNo?: string;
    previousEmployer?: string;
    retirementDate?: string;
    pensionAmount?: string;
    spouseName?: string;
    spouseOccupation?: string;
    spouseIncome?: string;
    familyIncome?: string;
    institutionName?: string;
    courseProgram?: string;
    expectedCompletion?: string;
    guardianName?: string;
    guardianIncome?: string;
    sourceOfFunds?: string;
    monthlySupportAmount?: string;
    supportProviderName?: string;
    bankAccountNumber?: string;
    bankIfsc?: string;
    bankName?: string;
    bankBranch?: string;
    accountType?: string;
    applicantSignature?: string;
    ref1Name?: string;
    ref1Phone?: string;
    ref1Relation?: string;
    ref1Address?: string;
    ref2Name?: string;
    ref2Phone?: string;
    ref2Relation?: string;
    ref2Address?: string;
    panCardDoc?: string;
    aadhaarFrontDoc?: string;
    aadhaarBackDoc?: string;
    incomeProofDoc?: string;
    addressProofDoc?: string;
    photoDoc?: string;
    electionCardDoc?: string;
    housePhotoDoc?: string;
    customer?: {
      id: string;
      name: string;
      email: string;
      phone: string;
    };
    company?: {
      id: string;
      name: string;
      code?: string;
      address?: string;
      city?: string;
      state?: string;
      contactEmail?: string;
      contactPhone?: string;
      logo?: string;
    };
    sessionForm?: {
      approvedAmount: number;
      interestRate: number;
      tenure: number;
      emiAmount: number;
      totalAmount: number;
      totalInterest: number;
      processingFee?: number;
      startDate?: string;
    };
  };
  companyLogo?: string;
}

export default function LoanApplicationForm({ loanData, companyLogo }: LoanApplicationFormProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Loan Application Form - ${loanData.applicationNo}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #333; }
          .page { max-width: 210mm; margin: 0 auto; background: white; }
          .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 15px; margin-bottom: 20px; }
          .company-logo { width: 80px; height: 80px; margin: 0 auto 10px; }
          .company-name { font-size: 22pt; font-weight: bold; color: #0d9488; margin: 0; }
          .company-tagline { font-size: 10pt; color: #666; margin-top: 5px; }
          .form-title { font-size: 16pt; font-weight: bold; text-align: center; margin: 20px 0; padding: 10px; background: #f0fdfa; border: 1px solid #0d9488; border-radius: 5px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 12pt; font-weight: bold; color: white; background: #0d9488; padding: 8px 12px; margin: 0 0 10px 0; border-radius: 4px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 20px; }
          .field { margin-bottom: 8px; }
          .field-label { font-size: 9pt; color: #666; margin-bottom: 2px; }
          .field-value { font-size: 11pt; font-weight: 500; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
          .full-width { grid-column: 1 / -1; }
          .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          .signature-box { text-align: center; }
          .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; }
          .declaration { background: #fffbeb; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 10pt; }
          .declaration-title { font-weight: bold; margin-bottom: 8px; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #0d9488; text-align: center; font-size: 9pt; color: #666; }
          .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60pt; color: rgba(13, 148, 136, 0.05); z-index: -1; pointer-events: none; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 5px 0; vertical-align: top; }
          .doc-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .doc-table th, .doc-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .doc-table th { background: #f0fdfa; }
        </style>
      </head>
      <body>
        <div class="watermark">LOAN APPLICATION</div>
        <div class="page">
          ${printContent.innerHTML}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownload = async () => {
    // For now, we'll use print which allows saving as PDF
    handlePrint();
  };

  const getApplicantName = () => {
    const parts = [loanData.title, loanData.firstName, loanData.middleName, loanData.lastName].filter(Boolean);
    return parts.join(' ') || loanData.customer?.name || 'N/A';
  };

  const getIncomeDisplay = () => {
    if (loanData.employmentType === 'Salaried' || loanData.employmentType === 'Professional') {
      return {
        label: 'Monthly Income',
        value: loanData.monthlyIncome ? formatCurrency(loanData.monthlyIncome) : 'N/A'
      };
    } else if (loanData.employmentType === 'Self-Employed') {
      return {
        label: 'Annual Turnover',
        value: loanData.annualTurnover ? formatCurrency(parseFloat(loanData.annualTurnover)) : 'N/A'
      };
    } else if (loanData.employmentType === 'Business') {
      return {
        label: 'Annual Revenue',
        value: loanData.annualRevenue ? formatCurrency(parseFloat(loanData.annualRevenue)) : 'N/A'
      };
    } else if (loanData.employmentType === 'Housewife') {
      return {
        label: 'Family Income',
        value: loanData.familyIncome ? formatCurrency(parseFloat(loanData.familyIncome)) : 'N/A'
      };
    } else if (loanData.employmentType === 'Retired') {
      return {
        label: 'Pension Amount',
        value: loanData.pensionAmount ? formatCurrency(parseFloat(loanData.pensionAmount)) : 'N/A'
      };
    } else if (loanData.employmentType === 'Student') {
      return {
        label: 'Guardian Income',
        value: loanData.guardianIncome ? formatCurrency(parseFloat(loanData.guardianIncome)) : 'N/A'
      };
    }
    return { label: 'Income', value: 'N/A' };
  };

  const incomeInfo = getIncomeDisplay();

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      {/* Form Content */}
      <Card className="border-0 shadow-lg" ref={printRef}>
        <div className="p-8 bg-white">
          {/* Header with Company Info */}
          <div className="text-center border-b-2 border-emerald-600 pb-4 mb-6">
            {companyLogo && (
              <img src={companyLogo} alt="Company Logo" className="w-20 h-20 mx-auto mb-2 object-contain" />
            )}
            <h1 className="text-2xl font-bold text-emerald-700">{loanData.company?.name || 'Money Mitra'}</h1>
            {loanData.company?.address && (
              <p className="text-sm text-gray-500 mt-1">
                {loanData.company.address}, {loanData.company.city}, {loanData.company.state}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {loanData.company?.contactEmail && <span>Email: {loanData.company.contactEmail}</span>}
              {loanData.company?.contactPhone && <span className="ml-4">Phone: {loanData.company.contactPhone}</span>}
            </p>
          </div>

          {/* Form Title */}
          <div className="text-center mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <h2 className="text-xl font-bold text-emerald-800 flex items-center justify-center gap-2">
              <FileText className="h-6 w-6" />
              LOAN APPLICATION FORM
            </h2>
            <p className="text-sm text-emerald-600 mt-1">Application No: <strong>{loanData.applicationNo}</strong></p>
          </div>

          {/* Application Details */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white bg-emerald-600 px-3 py-2 rounded-t-lg flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> APPLICATION DETAILS
            </h3>
            <div className="border border-gray-200 rounded-b-lg p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Application Date</p>
                  <p className="font-medium">{formatDate(loanData.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Loan Type</p>
                  <p className="font-medium">{loanData.loanType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Purpose</p>
                  <p className="font-medium">{loanData.purpose || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Requested Amount</p>
                  <p className="font-bold text-lg text-emerald-700">{formatCurrency(loanData.requestedAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Requested Tenure</p>
                  <p className="font-medium">{loanData.requestedTenure ? `${loanData.requestedTenure} months` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Requested Interest Rate</p>
                  <p className="font-medium">{loanData.requestedInterestRate ? `${loanData.requestedInterestRate}%` : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white bg-emerald-600 px-3 py-2 rounded-t-lg flex items-center gap-2">
              <User className="h-4 w-4" /> PERSONAL DETAILS
            </h3>
            <div className="border border-gray-200 rounded-b-lg p-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Full Name</p>
                  <p className="font-medium text-lg">{getApplicantName()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gender</p>
                  <p className="font-medium">{loanData.gender || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Father's Name</p>
                  <p className="font-medium">{loanData.fatherName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Mother's Name</p>
                  <p className="font-medium">{loanData.motherName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date of Birth</p>
                  <p className="font-medium">{loanData.dateOfBirth ? formatDate(loanData.dateOfBirth) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Marital Status</p>
                  <p className="font-medium">{loanData.maritalStatus || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Nationality</p>
                  <p className="font-medium">{loanData.nationality || 'Indian'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white bg-emerald-600 px-3 py-2 rounded-t-lg flex items-center gap-2">
              <MapPin className="h-4 w-4" /> CONTACT & ADDRESS
            </h3>
            <div className="border border-gray-200 rounded-b-lg p-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3">
                  <p className="text-xs text-gray-500">Full Address</p>
                  <p className="font-medium">{loanData.address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">City</p>
                  <p className="font-medium">{loanData.city || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">State</p>
                  <p className="font-medium">{loanData.state || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pincode</p>
                  <p className="font-medium">{loanData.pincode || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p>
                  <p className="font-medium">{loanData.phone || loanData.customer?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
                  <p className="font-medium">{loanData.customer?.email || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* KYC Details */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white bg-emerald-600 px-3 py-2 rounded-t-lg flex items-center gap-2">
              <FileText className="h-4 w-4" /> KYC DOCUMENTS
            </h3>
            <div className="border border-gray-200 rounded-b-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">PAN Number</p>
                  <p className="font-bold text-lg">{loanData.panNumber || 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Aadhaar Number</p>
                  <p className="font-bold text-lg">{loanData.aadhaarNumber ? `XXXX-XXXX-${loanData.aadhaarNumber.slice(-4)}` : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white bg-emerald-600 px-3 py-2 rounded-t-lg flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> EMPLOYMENT DETAILS
            </h3>
            <div className="border border-gray-200 rounded-b-lg p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Employment Type</p>
                  <p className="font-bold text-emerald-700">{loanData.employmentType || 'N/A'}</p>
                </div>
                {loanData.employmentType === 'Salaried' && (
                  <>
                    <div><p className="text-xs text-gray-500">Employer Name</p><p className="font-medium">{loanData.employerName}</p></div>
                    <div><p className="text-xs text-gray-500">Designation</p><p className="font-medium">{loanData.designation}</p></div>
                    <div className="col-span-2"><p className="text-xs text-gray-500">Employer Address</p><p className="font-medium">{loanData.employerAddress}</p></div>
                    <div><p className="text-xs text-gray-500">Years in Job</p><p className="font-medium">{loanData.yearsInEmployment}</p></div>
                    <div><p className="text-xs text-gray-500">Monthly Income</p><p className="font-bold text-emerald-700">{loanData.monthlyIncome ? formatCurrency(loanData.monthlyIncome) : 'N/A'}</p></div>
                  </>
                )}
                {loanData.employmentType === 'Self-Employed' && (
                  <>
                    <div><p className="text-xs text-gray-500">Business Name</p><p className="font-medium">{loanData.businessName}</p></div>
                    <div><p className="text-xs text-gray-500">Business Type</p><p className="font-medium">{loanData.businessType}</p></div>
                    <div className="col-span-2"><p className="text-xs text-gray-500">Business Address</p><p className="font-medium">{loanData.employerAddress}</p></div>
                    <div><p className="text-xs text-gray-500">Years in Business</p><p className="font-medium">{loanData.yearsInBusiness}</p></div>
                    <div><p className="text-xs text-gray-500">Annual Turnover</p><p className="font-bold text-emerald-700">{loanData.annualTurnover ? formatCurrency(parseFloat(loanData.annualTurnover)) : 'N/A'}</p></div>
                  </>
                )}
                {loanData.employmentType === 'Business' && (
                  <>
                    <div><p className="text-xs text-gray-500">Company Name</p><p className="font-medium">{loanData.companyName}</p></div>
                    <div><p className="text-xs text-gray-500">Company Type</p><p className="font-medium">{loanData.companyType}</p></div>
                    <div><p className="text-xs text-gray-500">Years in Operation</p><p className="font-medium">{loanData.yearsInOperation}</p></div>
                    <div><p className="text-xs text-gray-500">Annual Revenue</p><p className="font-bold text-emerald-700">{loanData.annualRevenue ? formatCurrency(parseFloat(loanData.annualRevenue)) : 'N/A'}</p></div>
                  </>
                )}
                {loanData.employmentType === 'Professional' && (
                  <>
                    <div><p className="text-xs text-gray-500">Profession</p><p className="font-medium">{loanData.professionType}</p></div>
                    <div><p className="text-xs text-gray-500">Practice Name</p><p className="font-medium">{loanData.practiceName}</p></div>
                    <div><p className="text-xs text-gray-500">Registration No.</p><p className="font-medium">{loanData.professionalRegNo}</p></div>
                    <div><p className="text-xs text-gray-500">Years of Practice</p><p className="font-medium">{loanData.yearsOfPractice}</p></div>
                    <div><p className="text-xs text-gray-500">Monthly Income</p><p className="font-bold text-emerald-700">{loanData.monthlyIncome ? formatCurrency(loanData.monthlyIncome) : 'N/A'}</p></div>
                  </>
                )}
                {loanData.employmentType === 'Housewife' && (
                  <>
                    <div><p className="text-xs text-gray-500">Spouse Name</p><p className="font-medium">{loanData.spouseName}</p></div>
                    <div><p className="text-xs text-gray-500">Spouse Occupation</p><p className="font-medium">{loanData.spouseOccupation}</p></div>
                    <div><p className="text-xs text-gray-500">Family Income</p><p className="font-bold text-emerald-700">{loanData.familyIncome ? formatCurrency(parseFloat(loanData.familyIncome)) : 'N/A'}</p></div>
                  </>
                )}
                {loanData.employmentType === 'Student' && (
                  <>
                    <div><p className="text-xs text-gray-500">Institution Name</p><p className="font-medium">{loanData.institutionName}</p></div>
                    <div><p className="text-xs text-gray-500">Course/Program</p><p className="font-medium">{loanData.courseProgram}</p></div>
                    <div><p className="text-xs text-gray-500">Expected Completion</p><p className="font-medium">{loanData.expectedCompletion}</p></div>
                    <div><p className="text-xs text-gray-500">Guardian Name</p><p className="font-medium">{loanData.guardianName}</p></div>
                    <div><p className="text-xs text-gray-500">Guardian Income</p><p className="font-bold text-emerald-700">{loanData.guardianIncome ? formatCurrency(parseFloat(loanData.guardianIncome)) : 'N/A'}</p></div>
                  </>
                )}
                {loanData.employmentType === 'Retired' && (
                  <>
                    <div><p className="text-xs text-gray-500">Previous Employer</p><p className="font-medium">{loanData.previousEmployer}</p></div>
                    <div><p className="text-xs text-gray-500">Last Designation</p><p className="font-medium">{loanData.designation}</p></div>
                    <div><p className="text-xs text-gray-500">Retirement Date</p><p className="font-medium">{loanData.retirementDate}</p></div>
                    <div><p className="text-xs text-gray-500">Monthly Pension</p><p className="font-bold text-emerald-700">{loanData.pensionAmount ? formatCurrency(parseFloat(loanData.pensionAmount)) : 'N/A'}</p></div>
                  </>
                )}
                {loanData.employmentType === 'Unemployed' && (
                  <>
                    <div><p className="text-xs text-gray-500">Source of Funds</p><p className="font-medium">{loanData.sourceOfFunds}</p></div>
                    <div><p className="text-xs text-gray-500">Monthly Support</p><p className="font-medium">{loanData.monthlySupportAmount}</p></div>
                    <div><p className="text-xs text-gray-500">Support Provider</p><p className="font-medium">{loanData.supportProviderName}</p></div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white bg-emerald-600 px-3 py-2 rounded-t-lg flex items-center gap-2">
              <Banknote className="h-4 w-4" /> BANK DETAILS
            </h3>
            <div className="border border-gray-200 rounded-b-lg p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Account Number</p>
                  <p className="font-medium">{loanData.bankAccountNumber ? `XXXX-XXXX-${loanData.bankAccountNumber.slice(-4)}` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Bank Name</p>
                  <p className="font-medium">{loanData.bankName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">IFSC Code</p>
                  <p className="font-medium">{loanData.bankIfsc || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Type</p>
                  <p className="font-medium">{loanData.accountType || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reference/Guardian Details */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white bg-emerald-600 px-3 py-2 rounded-t-lg flex items-center gap-2">
              <Users className="h-4 w-4" /> REFERENCES / GUARDIANS
            </h3>
            <div className="border border-gray-200 rounded-b-lg p-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2 text-emerald-700">Reference 1</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Name:</span> {loanData.ref1Name || 'N/A'}</p>
                    <p><span className="text-gray-500">Phone:</span> {loanData.ref1Phone || 'N/A'}</p>
                    <p><span className="text-gray-500">Relation:</span> {loanData.ref1Relation || 'N/A'}</p>
                    <p><span className="text-gray-500">Address:</span> {loanData.ref1Address || 'N/A'}</p>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2 text-emerald-700">Reference 2</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Name:</span> {loanData.ref2Name || 'N/A'}</p>
                    <p><span className="text-gray-500">Phone:</span> {loanData.ref2Phone || 'N/A'}</p>
                    <p><span className="text-gray-500">Relation:</span> {loanData.ref2Relation || 'N/A'}</p>
                    <p><span className="text-gray-500">Address:</span> {loanData.ref2Address || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Documents Checklist */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white bg-emerald-600 px-3 py-2 rounded-t-lg flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> DOCUMENTS CHECKLIST
            </h3>
            <div className="border border-gray-200 rounded-b-lg p-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'PAN Card', value: loanData.panCardDoc },
                  { label: 'Aadhaar Front', value: loanData.aadhaarFrontDoc },
                  { label: 'Aadhaar Back', value: loanData.aadhaarBackDoc },
                  { label: 'Income Proof', value: loanData.incomeProofDoc },
                  { label: 'Address Proof', value: loanData.addressProofDoc },
                  { label: 'Photo', value: loanData.photoDoc },
                  { label: 'Election Card', value: loanData.electionCardDoc },
                  { label: 'House Photo', value: loanData.housePhotoDoc },
                ].map((doc) => (
                  <div key={doc.label} className={`flex items-center gap-2 p-2 rounded ${doc.value ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                    {doc.value ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 border rounded" />}
                    <span className="text-xs">{doc.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sanction Details (if available) */}
          {loanData.sessionForm && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-white bg-purple-600 px-3 py-2 rounded-t-lg flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> SANCTION DETAILS
              </h3>
              <div className="border border-gray-200 rounded-b-lg p-4 bg-purple-50">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Approved Amount</p>
                    <p className="font-bold text-lg text-purple-700">{formatCurrency(loanData.sessionForm.approvedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Interest Rate</p>
                    <p className="font-medium">{loanData.sessionForm.interestRate}% p.a.</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tenure</p>
                    <p className="font-medium">{loanData.sessionForm.tenure} months</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">EMI Amount</p>
                    <p className="font-bold text-emerald-700">{formatCurrency(loanData.sessionForm.emiAmount)}/month</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Interest</p>
                    <p className="font-medium">{formatCurrency(loanData.sessionForm.totalInterest)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Amount</p>
                    <p className="font-medium">{formatCurrency(loanData.sessionForm.totalAmount)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Declaration */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="font-bold text-amber-800 mb-2">DECLARATION</h4>
            <p className="text-sm text-amber-700">
              I/We hereby declare that the information furnished above is true, correct and complete to the best of my/our knowledge and belief. 
              I/We understand that the information is being used for evaluating my/our loan application and that any false information may result 
              in rejection of the application or legal action. I/We authorize {loanData.company?.name || 'Money Mitra'} to verify all information 
              provided and contact relevant parties for verification purposes.
            </p>
          </div>

          {/* Signature Section */}
          <div className="grid grid-cols-2 gap-10 mt-8 pt-6 border-t">
            <div className="text-center">
              {loanData.applicantSignature ? (
                <img src={loanData.applicantSignature} alt="Applicant Signature" className="h-16 mx-auto" />
              ) : (
                <div className="h-16 border-b-2 border-gray-300"></div>
              )}
              <p className="text-sm text-gray-600 mt-2">Applicant's Signature</p>
              <p className="text-xs text-gray-400 mt-1">{getApplicantName()}</p>
            </div>
            <div className="text-center">
              <div className="h-16 border-b-2 border-gray-300"></div>
              <p className="text-sm text-gray-600 mt-2">Authorized Signatory</p>
              <p className="text-xs text-gray-400 mt-1">{loanData.company?.name || 'Money Mitra'}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t-2 border-emerald-600 text-center text-xs text-gray-500">
            <p>This is a computer-generated document. No signature is required unless otherwise stated.</p>
            <p className="mt-1">Generated on {formatDate(new Date().toISOString())} | Application No: {loanData.applicationNo}</p>
            <p className="mt-2 text-emerald-600 font-medium">{loanData.company?.name || 'Money Mitra'} - Your Trusted Financial Partner</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
