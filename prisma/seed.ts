import { db } from '@/lib/db';
import * as bcrypt from 'bcryptjs';

// Permanent Super Admin Credentials
const SUPER_ADMIN_EMAIL = 'moneymitra@gmail.com';
const SUPER_ADMIN_PASSWORD = '1122334455';

async function main() {
  console.log('Cleaning database and seeding fresh data...');

  // Step 1: Delete all existing data (clean slate)
  console.log('Deleting existing data...');
  
  // Delete in order of foreign key dependencies
  await db.workflowLog.deleteMany({});
  await db.auditLog.deleteMany({});
  await db.payment.deleteMany({});
  await db.eMISchedule.deleteMany({});
  await db.sessionForm.deleteMany({});
  await db.loanForm.deleteMany({});
  await db.loanApplication.deleteMany({});
  
  // Delete users except permanent super admin
  await db.user.deleteMany({
    where: {
      email: { not: SUPER_ADMIN_EMAIL }
    }
  });
  
  // Delete old companies
  await db.company.deleteMany({});
  
  // Delete other related data
  await db.notification.deleteMany({});
  await db.reminder.deleteMany({});
  await db.locationLog.deleteMany({});
  await db.deletedUser.deleteMany({});
  await db.blacklist.deleteMany({});
  await db.deviceFingerprint.deleteMany({});
  
  console.log('Existing data deleted.');

  // Step 2: Create Permanent Super Admin
  const superAdminPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  const superAdmin = await db.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      password: superAdminPassword,
      plainPassword: SUPER_ADMIN_PASSWORD,
      name: 'Money Mitra Admin',
      isActive: true,
      role: 'SUPER_ADMIN',
      isLocked: false,
      failedLoginAttempts: 0,
      lastLoginAt: new Date()
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      password: superAdminPassword,
      plainPassword: SUPER_ADMIN_PASSWORD,
      name: 'Money Mitra Admin',
      firebaseUid: 'super-admin-permanent',
      role: 'SUPER_ADMIN',
      isActive: true,
      lastLoginAt: new Date()
    }
  });
  console.log('Created/Updated Permanent Super Admin:', superAdmin.email);

  // Step 3: Create System Settings
  await db.systemSetting.upsert({
    where: { key: 'companyName' },
    update: { value: 'Money Mitra Financial Advisor' },
    create: { key: 'companyName', value: 'Money Mitra Financial Advisor' }
  });

  await db.systemSetting.upsert({
    where: { key: 'companyEmail' },
    update: { value: SUPER_ADMIN_EMAIL },
    create: { key: 'companyEmail', value: SUPER_ADMIN_EMAIL }
  });

  await db.systemSetting.upsert({
    where: { key: 'companyPhone' },
    update: { value: '+91 1800-123-4567' },
    create: { key: 'companyPhone', value: '+91 1800-123-4567' }
  });

  await db.systemSetting.upsert({
    where: { key: 'companyAddress' },
    update: { value: '123 Finance Street, Mumbai, MH 400001' },
    create: { key: 'companyAddress', value: '123 Finance Street, Mumbai, MH 400001' }
  });

  await db.systemSetting.upsert({
    where: { key: 'defaultInterestRate' },
    update: { value: '12' },
    create: { key: 'defaultInterestRate', value: '12' }
  });

  console.log('Created System Settings');

  // No default company - companies will be created as needed
  console.log('No default company created - create companies as needed');

  // Step 5: Create Loan Products
  const products = [
    {
      title: 'Personal Loan',
      description: 'Quick approval, low rates for your personal needs',
      icon: '👤',
      loanType: 'PERSONAL',
      minInterestRate: 10,
      maxInterestRate: 18,
      defaultInterestRate: 12,
      minTenure: 6,
      maxTenure: 60,
      defaultTenure: 24,
      minAmount: 50000,
      maxAmount: 5000000,
      isActive: true,
      order: 1
    },
    {
      title: 'Business Loan',
      description: 'Grow your business with our flexible financing options',
      icon: '🏢',
      loanType: 'BUSINESS',
      minInterestRate: 12,
      maxInterestRate: 20,
      defaultInterestRate: 15,
      minTenure: 12,
      maxTenure: 84,
      defaultTenure: 36,
      minAmount: 100000,
      maxAmount: 10000000,
      isActive: true,
      order: 2
    },
    {
      title: 'Home Loan',
      description: 'Make your dream home a reality with competitive rates',
      icon: '🏠',
      loanType: 'HOME',
      minInterestRate: 8,
      maxInterestRate: 12,
      defaultInterestRate: 9,
      minTenure: 60,
      maxTenure: 360,
      defaultTenure: 240,
      minAmount: 500000,
      maxAmount: 50000000,
      isActive: true,
      order: 3
    },
    {
      title: 'Education Loan',
      description: 'Invest in education, invest in the future',
      icon: '📚',
      loanType: 'EDUCATION',
      minInterestRate: 8,
      maxInterestRate: 14,
      defaultInterestRate: 10,
      minTenure: 12,
      maxTenure: 120,
      defaultTenure: 60,
      minAmount: 100000,
      maxAmount: 5000000,
      isActive: true,
      order: 4
    }
  ];

  for (const product of products) {
    await db.cMSService.create({ data: product });
  }
  console.log('Created Loan Products:', products.length);

  // Step 6: Create Testimonials
  const testimonials = [
    {
      customerName: 'Rahul Sharma',
      designation: 'Business Owner',
      content: 'Money Mitra Financial Advisor helped me expand my business with their quick loan approval. The process was smooth and the team was very supportive.',
      rating: 5,
      isActive: true,
      order: 1
    },
    {
      customerName: 'Priya Patel',
      designation: 'Homeowner',
      content: 'Got my dream home with Money Mitra Financial Advisor\'s home loan. The interest rates were very competitive and the staff was helpful throughout.',
      rating: 5,
      isActive: true,
      order: 2
    },
    {
      customerName: 'Amit Kumar',
      designation: 'Software Engineer',
      content: 'Quick personal loan when I needed it the most. The entire process was digital and hassle-free.',
      rating: 5,
      isActive: true,
      order: 3
    }
  ];

  for (const testimonial of testimonials) {
    await db.cMSTestimonial.create({ data: testimonial });
  }
  console.log('Created Testimonials:', testimonials.length);

  console.log('\n✅ Database seeding completed!');
  console.log('\n📋 Permanent Super Admin Credentials:');
  console.log('-----------------------------------');
  console.log(`Email: ${SUPER_ADMIN_EMAIL}`);
  console.log(`Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log('\n💡 This super admin account is permanent and cannot be deleted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
