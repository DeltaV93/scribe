import { PrismaClient, Tier, UserRole, FormType, FormStatus, FieldType, FieldPurpose } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-nonprofit' },
    update: {},
    create: {
      name: 'Demo Nonprofit',
      slug: 'demo-nonprofit',
      tier: Tier.PROFESSIONAL,
      purchasedFormPacks: 0,
      settings: {},
    },
  });
  console.log('Created organization:', org.name);

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'admin@demo.org' },
    update: {},
    create: {
      email: 'admin@demo.org',
      name: 'Demo Admin',
      role: UserRole.ADMIN,
      orgId: org.id,
      supabaseUserId: 'demo-supabase-id', // This will be updated when you sign up via Supabase
    },
  });
  console.log('Created user:', user.email);

  // Create a sample form
  const form = await prisma.form.upsert({
    where: { id: 'demo-intake-form' },
    update: {},
    create: {
      id: 'demo-intake-form',
      orgId: org.id,
      name: 'Client Intake Form',
      description: 'Standard intake form for new clients',
      type: FormType.INTAKE,
      status: FormStatus.DRAFT,
      version: 1,
      settings: {
        allowPartialSaves: true,
        requireSupervisorReview: false,
        autoArchiveDays: null,
        activityTriggers: ['submissions'],
      },
      createdById: user.id,
    },
  });
  console.log('Created form:', form.name);

  // Create some sample fields
  const fields = [
    {
      id: 'field-1',
      formId: form.id,
      slug: 'full_name',
      name: 'Full Name',
      type: FieldType.TEXT_SHORT,
      purpose: FieldPurpose.INTERNAL_OPS,
      isRequired: true,
      isSensitive: false,
      isAiExtractable: true,
      order: 0,
      section: 'Personal Information',
    },
    {
      id: 'field-2',
      formId: form.id,
      slug: 'date_of_birth',
      name: 'Date of Birth',
      type: FieldType.DATE,
      purpose: FieldPurpose.COMPLIANCE,
      isRequired: true,
      isSensitive: true,
      isAiExtractable: true,
      order: 1,
      section: 'Personal Information',
    },
    {
      id: 'field-3',
      formId: form.id,
      slug: 'phone_number',
      name: 'Phone Number',
      type: FieldType.PHONE,
      purpose: FieldPurpose.INTERNAL_OPS,
      isRequired: false,
      isSensitive: false,
      isAiExtractable: true,
      order: 2,
      section: 'Contact Information',
    },
    {
      id: 'field-4',
      formId: form.id,
      slug: 'email',
      name: 'Email Address',
      type: FieldType.EMAIL,
      purpose: FieldPurpose.INTERNAL_OPS,
      isRequired: false,
      isSensitive: false,
      isAiExtractable: true,
      order: 3,
      section: 'Contact Information',
    },
    {
      id: 'field-5',
      formId: form.id,
      slug: 'housing_status',
      name: 'Current Housing Status',
      type: FieldType.DROPDOWN,
      purpose: FieldPurpose.GRANT_REQUIREMENT,
      isRequired: true,
      isSensitive: false,
      isAiExtractable: true,
      order: 4,
      section: 'Housing Status',
      options: [
        { value: 'housed', label: 'Currently Housed' },
        { value: 'homeless', label: 'Currently Homeless' },
        { value: 'at_risk', label: 'At Risk of Homelessness' },
        { value: 'transitional', label: 'Transitional Housing' },
      ],
    },
  ];

  for (const field of fields) {
    await prisma.formField.upsert({
      where: { id: field.id },
      update: {},
      create: field,
    });
  }
  console.log(`Created ${fields.length} form fields`);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
