import {
  PrismaClient,
  Prisma,
  Tier,
  UserRole,
  FormType,
  FormStatus,
  FieldType,
  FieldPurpose,
  ClientStatus,
  CallStatus,
  ProcessingStatus,
  GrantStatus,
  DeliverableStatus,
  MetricType,
  GoalType,
  GoalStatus,
  ClientGoalStatus,
  ClientOutcomeType,
  KpiMetricType,
} from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Set faker seed for reproducible data
faker.seed(42);

// Deterministic ID generator
const SEED_PREFIX = 'demo-seed-v1';
function demoId(type: string, index: number): string {
  return `${SEED_PREFIX}-${type}-${String(index).padStart(3, '0')}`;
}

// Demo user email
const DEMO_USER_EMAIL = 'valerie@techbychoice.org';

// Use existing form for extraction
const DEMO_FORM_ID = 'e9f4bf54-9350-43b0-a376-319bb3207d0d';

// Client data
const DEMO_CLIENTS = [
  { firstName: 'Maria', lastName: 'Rodriguez', status: ClientStatus.ACTIVE },
  { firstName: 'James', lastName: 'Washington', status: ClientStatus.ACTIVE },
  { firstName: 'Aisha', lastName: 'Johnson', status: ClientStatus.ACTIVE },
  { firstName: 'David', lastName: 'Chen', status: ClientStatus.ON_HOLD },
  { firstName: 'Keisha', lastName: 'Williams', status: ClientStatus.ACTIVE },
  { firstName: 'Robert', lastName: 'Martinez', status: ClientStatus.PENDING },
  { firstName: 'Tamara', lastName: 'Thompson', status: ClientStatus.ACTIVE },
  { firstName: 'Michael', lastName: 'Brown', status: ClientStatus.CLOSED },
];

// Grant data
const DEMO_GRANTS = [
  {
    name: 'HUD Continuum of Care Grant',
    funderName: 'U.S. Department of Housing and Urban Development',
    grantNumber: 'CA-500-H-26-001',
    status: GrantStatus.ACTIVE,
    reportingFrequency: 'quarterly',
    description: 'Federal funding for homeless assistance programs including permanent supportive housing, rapid rehousing, and coordinated entry.',
    deliverables: [
      { name: 'Serve 100 homeless individuals', targetValue: 100, currentValue: 67, metricType: MetricType.CLIENTS_ENROLLED },
      { name: 'Place 50 in permanent housing', targetValue: 50, currentValue: 21, metricType: MetricType.CLIENTS_HOUSED },
    ],
  },
  {
    name: 'DOL Workforce Innovation Grant',
    funderName: 'Department of Labor',
    grantNumber: 'DOL-WIF-2025-4521',
    status: GrantStatus.ACTIVE,
    reportingFrequency: 'monthly',
    description: 'Workforce development funding to provide job training, career counseling, and employment placement services.',
    deliverables: [
      { name: 'Enroll 75 in job training', targetValue: 75, currentValue: 48, metricType: MetricType.CLIENTS_ENROLLED },
      { name: 'Complete 200 training sessions', targetValue: 200, currentValue: 134, metricType: MetricType.SESSIONS_DELIVERED },
    ],
  },
  {
    name: 'State Emergency Assistance Fund',
    funderName: 'California Department of Social Services',
    grantNumber: 'CDSS-EAF-2025-789',
    status: GrantStatus.ACTIVE,
    reportingFrequency: 'quarterly',
    description: 'State funding for emergency assistance including rapid rehousing, utility assistance, and emergency shelter.',
    deliverables: [
      { name: 'Provide emergency assistance to 150 households', targetValue: 150, currentValue: 98, metricType: MetricType.CLIENT_CONTACTS },
      { name: 'Achieve 85% housing stability rate', targetValue: 85, currentValue: 78, metricType: MetricType.CUSTOM },
    ],
  },
  {
    name: 'Foundation Family Services Grant',
    funderName: 'Community Foundation of Greater LA',
    grantNumber: 'CFGLA-2025-FSG-102',
    status: GrantStatus.ACTIVE,
    reportingFrequency: 'quarterly',
    description: 'Private foundation support for comprehensive case management services for families experiencing housing instability.',
    deliverables: [
      { name: 'Serve 40 families with case management', targetValue: 40, currentValue: 32, metricType: MetricType.CLIENTS_ENROLLED },
      { name: 'Complete 500 case management sessions', targetValue: 500, currentValue: 387, metricType: MetricType.SESSIONS_DELIVERED },
    ],
  },
];

// Organization-level goals
const DEMO_GOALS = [
  {
    name: 'Q1 2026 Housing Placements',
    description: 'Place 50 clients in stable housing by end of Q1 2026. This includes permanent supportive housing, rapid rehousing, and subsidized housing placements.',
    type: GoalType.GRANT,
    status: GoalStatus.IN_PROGRESS,
    progress: 42,
  },
  {
    name: 'Workforce Development Outcomes',
    description: 'Achieve 75% job placement rate for all program graduates within 90 days of completing training.',
    type: GoalType.KPI,
    status: GoalStatus.ON_TRACK,
    progress: 68,
  },
  {
    name: 'Client Engagement Initiative',
    description: 'Increase monthly client touchpoints by 25% through improved outreach, follow-up calls, and proactive check-ins.',
    type: GoalType.TEAM_INITIATIVE,
    status: GoalStatus.IN_PROGRESS,
    progress: 55,
  },
  {
    name: 'Program Completion Rate',
    description: 'Increase program completion rate from 65% to 80% by implementing retention strategies and barrier removal support.',
    type: GoalType.OKR,
    status: GoalStatus.AT_RISK,
    progress: 38,
  },
  {
    name: 'Documentation Compliance',
    description: 'Achieve 95% compliance rate for required documentation across all grant-funded programs.',
    type: GoalType.KPI,
    status: GoalStatus.ON_TRACK,
    progress: 91,
  },
];

// Client goal templates
const CLIENT_GOAL_TEMPLATES = [
  {
    title: 'Obtain Stable Housing',
    outcomeType: ClientOutcomeType.HOUSING,
    description: 'Find and secure stable housing within 90 days through rapid rehousing or subsidized housing program.',
    metricType: KpiMetricType.COUNT,
    targetValue: 1,
  },
  {
    title: 'Complete Job Readiness Training',
    outcomeType: ClientOutcomeType.EMPLOYMENT,
    description: 'Complete 4-week job readiness program including resume building, interview skills, and workplace etiquette.',
    metricType: KpiMetricType.COUNT,
    targetValue: 4,
  },
  {
    title: 'Obtain Industry Certification',
    outcomeType: ClientOutcomeType.CERTIFICATION,
    description: 'Pass certification exam for chosen trade (HVAC, Welding, CNA, or Forklift).',
    metricType: KpiMetricType.COUNT,
    targetValue: 1,
  },
  {
    title: 'Secure Full-Time Employment',
    outcomeType: ClientOutcomeType.EMPLOYMENT,
    description: 'Obtain full-time employment (32+ hours/week) earning at least $15/hour with benefits.',
    metricType: KpiMetricType.CURRENCY,
    targetValue: 15,
  },
  {
    title: 'Complete GED Program',
    outcomeType: ClientOutcomeType.EDUCATION,
    description: 'Complete GED preparation classes and pass all four GED exam sections.',
    metricType: KpiMetricType.PERCENTAGE,
    targetValue: 100,
  },
];

// Transcript templates matching Client Intake form fields (25 fields)
// Fields: first_name, last_name, date_of_birth, phone_number, email_address, gender, race_ethnicity,
// veteran_status, current_living_situation, length_current_stay, times_homeless_3_years,
// employment_status, monthly_income, income_sources, has_health_insurance, physical_health_problems,
// mental_health_issues, substance_use_issues, aces_score, experienced_childhood_trauma,
// primary_goals, immediate_needs, referral_source, consent_to_services, additional_notes
const TRANSCRIPT_TEMPLATES = [
  {
    context: 'initial_intake',
    raw: `Case Manager: Good morning, thank you for calling TechByChoice Community Services. My name is Valerie. Before we get started, can I get your full name?

Client: Yes, my name is {firstName} {lastName}.

Case Manager: Thank you {firstName}. And what is your date of birth?

Client: {dob}.

Case Manager: Great. And the best phone number to reach you at?

Client: {phone}.

Case Manager: Do you have an email address?

Client: Yes, it's {email}.

Case Manager: Perfect. Now, how did you hear about our services?

Client: I was referred by the homeless outreach team downtown.

Case Manager: Okay, the outreach team - great. Let me ask you some questions about your current situation. Where are you currently staying?

Client: I've been staying at a shelter for the past three weeks. Before that I was sleeping in my car.

Case Manager: I'm sorry to hear that. In the last three years, how many times have you experienced homelessness?

Client: This is my second time. The first time was about two years ago when I lost my job.

Case Manager: I understand. Are you currently employed?

Client: No, I'm unemployed right now. I'm actively looking for work though.

Case Manager: What was your monthly income when you were last working?

Client: About $2,400 a month.

Case Manager: And do you have any current income sources - SSI, disability, anything like that?

Client: No, just what I had saved up. That's running out.

Case Manager: Do you have health insurance?

Client: Yes, I have Medicaid.

Case Manager: Good. Do you have any physical health conditions we should know about?

Client: I have high blood pressure that I take medication for.

Case Manager: Okay. And are you currently experiencing any mental health challenges - depression, anxiety, anything like that?

Client: I've been dealing with some depression since losing my job. It's been tough.

Case Manager: I understand, and we can connect you with resources for that. Any history of substance use?

Client: No, I don't use drugs or alcohol.

Case Manager: Thank you for sharing that. Are you a veteran?

Client: No, I'm not.

Case Manager: What would you say are your primary goals right now?

Client: I really need to find stable housing first. Then I want to get back to work.

Case Manager: And what are your most immediate needs - what do you need help with today?

Client: I need help finding a place to live and getting into a job training program.

Case Manager: We can definitely help with that. {firstName}, do you consent to receiving services through our program? I want to make sure you're comfortable before we proceed.

Client: Yes, I do. I really appreciate the help.

Case Manager: Wonderful. We're going to get you connected with our housing navigator and our workforce development program. Is there anything else you'd like me to know?

Client: Just that I'm really motivated to get back on my feet. I have retail and food service experience from before.`,
  },
  {
    context: 'initial_intake_2',
    raw: `Case Manager: Hello, this is Valerie with TechByChoice Community Services. How can I help you today?

Client: Hi, I'm looking for help with housing. My name is {firstName} {lastName}.

Case Manager: Nice to meet you {firstName}. Let me get some information from you. What's your date of birth?

Client: {dob}.

Case Manager: And a phone number where I can reach you?

Client: {phone}.

Case Manager: Email address?

Client: {email}.

Case Manager: How did you find out about our services?

Client: My friend told me about you. She got help here last year.

Case Manager: That's great to hear. Tell me about your current living situation.

Client: Right now I'm staying with my cousin, but it's temporary. I've been there for about two months.

Case Manager: Have you been homeless before in the past three years?

Client: Yes, this is my third time actually. It's been a cycle I can't seem to break.

Case Manager: We're going to work on that. What's your employment status?

Client: I'm working part-time right now, about 20 hours a week at a fast food place.

Case Manager: What's your monthly income from that?

Client: Around $1,200 a month after taxes.

Case Manager: Any other income - benefits, support from family?

Client: I get SNAP benefits for food, that's it.

Case Manager: Do you have health insurance?

Client: Yes, Medicaid.

Case Manager: Any physical health issues?

Client: I have diabetes that I manage with medication.

Case Manager: Mental health - are you dealing with any anxiety, depression, PTSD?

Client: I have anxiety. I see a counselor once a month.

Case Manager: Good that you're getting support. Any substance use history?

Client: I used to drink heavily but I've been sober for eight months now.

Case Manager: That's a big accomplishment, congratulations. Are you a veteran?

Client: No, I'm not.

Case Manager: What are your main goals?

Client: I want to get my own apartment and increase my work hours to full-time.

Case Manager: What do you need most urgently right now?

Client: I need help finding affordable housing before I have to leave my cousin's place.

Case Manager: Do you consent to us providing services and support?

Client: Yes, absolutely.

Case Manager: Great. We'll get you set up with our rapid rehousing program. Anything else you want to add?

Client: I'm really committed to making this work. I'm tired of moving around.`,
  },
  {
    context: 'initial_intake_3',
    raw: `Case Manager: TechByChoice Community Services, this is Valerie speaking.

Client: Hi, I need help. I don't know where to start.

Case Manager: That's okay, we're here to help. Let's start with your name.

Client: {firstName} {lastName}.

Case Manager: {firstName}, what's your date of birth?

Client: {dob}.

Case Manager: And a good phone number for you?

Client: {phone}.

Case Manager: Do you have email?

Client: Yes, {email}.

Case Manager: Who referred you to us?

Client: The emergency room at the hospital. I went there last week.

Case Manager: I see. Can you tell me about your living situation?

Client: I'm homeless right now. I've been sleeping outside for about a week.

Case Manager: I'm sorry you're going through this. How many times have you been homeless in the last three years?

Client: This is my first time ever being homeless.

Case Manager: Are you working?

Client: No, I lost my job when my car broke down. I couldn't get to work anymore.

Case Manager: What was your income before?

Client: I was making about $2,800 a month as a CNA.

Case Manager: Any current income?

Client: I just applied for unemployment but haven't received anything yet.

Case Manager: Health insurance?

Client: I lost it when I lost my job. I'm uninsured right now.

Case Manager: Any health conditions?

Client: I have asthma but I'm out of my inhaler.

Case Manager: Mental health concerns?

Client: I've been really depressed and anxious since all this happened.

Case Manager: Understandable. Any substance use?

Client: No, never.

Case Manager: Are you a veteran?

Client: Yes, I served in the Army for four years.

Case Manager: Thank you for your service. We have special resources for veterans. What are your goals?

Client: I just want to get back to normal. Get housing, get a job, get my life back.

Case Manager: What's your most pressing need right now?

Client: I need somewhere safe to sleep tonight and my asthma medication.

Case Manager: Do you consent to receiving services?

Client: Yes, please. I really need help.

Case Manager: We're going to take care of you. As a veteran, you qualify for additional programs. Anything else I should know?

Client: I have a clean driving record and I'm certified as a nursing assistant. I just need a chance.`,
  },
];

// Generate transcript segments from raw transcript
function generateTranscriptSegments(rawTranscript: string): object[] {
  const lines = rawTranscript.trim().split('\n\n');
  let currentTime = 0;
  const segments: object[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const speakerRaw = line.substring(0, colonIndex).trim();
    const text = line.substring(colonIndex + 1).trim();

    // Determine speaker type
    let speaker: string;
    if (speakerRaw.toLowerCase().includes('case manager') || speakerRaw.toLowerCase().includes('valerie')) {
      speaker = 'CASE_MANAGER';
    } else if (speakerRaw.toLowerCase().includes('client')) {
      speaker = 'CLIENT';
    } else {
      speaker = 'UNCERTAIN';
    }

    // Estimate duration based on word count (150 words per minute average)
    const wordCount = text.split(/\s+/).length;
    const duration = (wordCount / 150) * 60; // Convert to seconds

    segments.push({
      speaker,
      text,
      startTime: currentTime,
      endTime: currentTime + duration,
      confidence: faker.number.float({ min: 0.92, max: 0.99, fractionDigits: 2 }),
      words: text.split(/\s+/).map((word, i) => ({
        word,
        start: currentTime + (i * duration / wordCount),
        end: currentTime + ((i + 1) * duration / wordCount),
        confidence: faker.number.float({ min: 0.90, max: 0.99, fractionDigits: 2 }),
      })),
    });

    currentTime += duration + 0.5; // Add small pause between speakers
  }

  return segments;
}

// Main seeding function
async function main() {
  console.log('Starting demo data seeding...');

  // 1. Find or create demo user
  let user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    include: { organization: true },
  });

  let orgId: string;
  let userId: string;
  let orgName: string;

  if (user) {
    console.log(`Found existing user: ${user.email}`);
    orgId = user.orgId;
    userId = user.id;
    orgName = user.organization.name;
  } else {
    console.log(`User ${DEMO_USER_EMAIL} not found, creating demo organization and user...`);

    // Create organization
    const org = await prisma.organization.upsert({
      where: { slug: 'techbychoice-demo' },
      update: {},
      create: {
        name: 'TechByChoice Demo',
        slug: 'techbychoice-demo',
        tier: Tier.PROFESSIONAL,
        purchasedFormPacks: 0,
        settings: {},
      },
    });

    // Create user
    const createdUser = await prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: {},
      create: {
        email: DEMO_USER_EMAIL,
        name: 'Valerie Sharp',
        role: UserRole.ADMIN,
        orgId: org.id,
        supabaseUserId: 'demo-supabase-placeholder',
        canCreateForms: true,
        canReadForms: true,
        canUpdateForms: true,
        canDeleteForms: true,
        canPublishForms: true,
      },
    });

    orgId = org.id;
    userId = createdUser.id;
    orgName = org.name;
    console.log(`Created organization: ${org.name} and user: ${createdUser.email}`);
  }

  // 2. Ensure demo form exists with version
  const form = await prisma.form.upsert({
    where: { id: demoId('form', 1) },
    update: {},
    create: {
      id: demoId('form', 1),
      orgId,
      name: 'Client Intake Form',
      description: 'Standard intake form for new clients seeking services',
      type: FormType.INTAKE,
      status: FormStatus.PUBLISHED,
      version: 1,
      settings: {
        allowPartialSaves: true,
        requireSupervisorReview: false,
        autoArchiveDays: null,
        activityTriggers: ['submissions'],
      },
      createdById: userId,
    },
  });

  // Define form fields first (needed for form version snapshot)
  const formFields = [
    { id: demoId('field', 1), slug: 'full_name', name: 'Full Name', type: FieldType.TEXT_SHORT, purpose: FieldPurpose.INTERNAL_OPS, isRequired: true, section: 'Personal Information', order: 0 },
    { id: demoId('field', 2), slug: 'date_of_birth', name: 'Date of Birth', type: FieldType.DATE, purpose: FieldPurpose.COMPLIANCE, isRequired: true, section: 'Personal Information', order: 1, isSensitive: true },
    { id: demoId('field', 3), slug: 'phone_number', name: 'Phone Number', type: FieldType.PHONE, purpose: FieldPurpose.INTERNAL_OPS, section: 'Contact Information', order: 2 },
    { id: demoId('field', 4), slug: 'email', name: 'Email Address', type: FieldType.EMAIL, purpose: FieldPurpose.INTERNAL_OPS, section: 'Contact Information', order: 3 },
    { id: demoId('field', 5), slug: 'housing_status', name: 'Current Housing Status', type: FieldType.DROPDOWN, purpose: FieldPurpose.GRANT_REQUIREMENT, isRequired: true, section: 'Housing', order: 4 },
    { id: demoId('field', 6), slug: 'employment_status', name: 'Employment Status', type: FieldType.DROPDOWN, purpose: FieldPurpose.GRANT_REQUIREMENT, isRequired: true, section: 'Employment', order: 5 },
    { id: demoId('field', 7), slug: 'needs_assessment', name: 'Services Needed', type: FieldType.CHECKBOX, purpose: FieldPurpose.INTERNAL_OPS, section: 'Needs Assessment', order: 6 },
  ];

  for (const field of formFields) {
    await prisma.formField.upsert({
      where: { id: field.id },
      update: {},
      create: {
        ...field,
        formId: form.id,
        isAiExtractable: true,
        isSensitive: field.isSensitive || false,
        isRequired: field.isRequired || false,
      },
    });
  }
  console.log(`Created ${formFields.length} form fields`);

  // Create form version (after fields are defined)
  await prisma.formVersion.upsert({
    where: { id: demoId('form-version', 1) },
    update: {},
    create: {
      id: demoId('form-version', 1),
      formId: form.id,
      version: 1,
      snapshot: { fields: formFields },
      aiExtractionPrompt: 'Extract client intake information from the call transcript including name, contact information, housing status, employment status, and services needed.',
      publishedAt: new Date(),
      publishedById: userId,
    },
  });
  console.log('Created form version');

  // 3. Seed clients
  const clients: { id: string; firstName: string; lastName: string }[] = [];
  for (let i = 0; i < DEMO_CLIENTS.length; i++) {
    const clientData = DEMO_CLIENTS[i];
    const clientId = demoId('client', i + 1);

    const client = await prisma.client.upsert({
      where: { id: clientId },
      update: {},
      create: {
        id: clientId,
        orgId,
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        phone: faker.phone.number({ style: 'national' }).replace(/\D/g, '').slice(0, 10),
        email: faker.internet.email({ firstName: clientData.firstName, lastName: clientData.lastName }),
        address: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: 'CA',
          zip: faker.location.zipCode(),
          formatted: '',
        },
        status: clientData.status,
        assignedTo: userId,
        createdBy: userId,
      },
    });

    clients.push({ id: client.id, firstName: clientData.firstName, lastName: clientData.lastName });
  }
  console.log(`Seeded ${clients.length} clients`);

  // 4. Seed grants with deliverables
  for (let i = 0; i < DEMO_GRANTS.length; i++) {
    const grantData = DEMO_GRANTS[i];
    const grantId = demoId('grant', i + 1);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6); // Started 6 months ago
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6); // Ends in 6 months

    await prisma.grant.upsert({
      where: { id: grantId },
      update: {},
      create: {
        id: grantId,
        orgId,
        name: grantData.name,
        funderName: grantData.funderName,
        grantNumber: grantData.grantNumber,
        description: grantData.description,
        status: grantData.status,
        startDate,
        endDate,
        reportingFrequency: grantData.reportingFrequency,
        createdById: userId,
      },
    });

    // Create deliverables
    for (let j = 0; j < grantData.deliverables.length; j++) {
      const deliverable = grantData.deliverables[j];
      const deliverableId = demoId(`deliverable-${i + 1}`, j + 1);

      const progress = deliverable.currentValue / deliverable.targetValue;
      let deliverableStatus: DeliverableStatus;
      if (progress >= 1) {
        deliverableStatus = DeliverableStatus.COMPLETED;
      } else if (progress >= 0.7) {
        deliverableStatus = DeliverableStatus.IN_PROGRESS;
      } else if (progress >= 0.4) {
        deliverableStatus = DeliverableStatus.AT_RISK;
      } else {
        deliverableStatus = DeliverableStatus.NOT_STARTED;
      }

      await prisma.grantDeliverable.upsert({
        where: { id: deliverableId },
        update: {},
        create: {
          id: deliverableId,
          grantId,
          name: deliverable.name,
          metricType: deliverable.metricType,
          targetValue: deliverable.targetValue,
          currentValue: deliverable.currentValue,
          status: deliverableStatus,
          dueDate: endDate,
        },
      });
    }
  }
  console.log(`Seeded ${DEMO_GRANTS.length} grants with deliverables`);

  // 5. Seed organization-level goals
  for (let i = 0; i < DEMO_GOALS.length; i++) {
    const goalData = DEMO_GOALS[i];
    const goalId = demoId('goal', i + 1);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 2);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 4);

    await prisma.goal.upsert({
      where: { id: goalId },
      update: {},
      create: {
        id: goalId,
        orgId,
        name: goalData.name,
        description: goalData.description,
        type: goalData.type,
        status: goalData.status,
        progress: goalData.progress,
        startDate,
        endDate,
        ownerId: userId,
        createdById: userId,
      },
    });
  }
  console.log(`Seeded ${DEMO_GOALS.length} organization goals`);

  // 6. Get FormVersion for the Client Intake form
  let formVersionId: string | null = null;
  const existingFormVersion = await prisma.formVersion.findFirst({
    where: { formId: DEMO_FORM_ID },
    orderBy: { version: 'desc' },
    select: { id: true },
  });

  if (existingFormVersion) {
    formVersionId = existingFormVersion.id;
    console.log(`Found existing form version: ${formVersionId}`);
  } else {
    // Fall back to demo form version if real form doesn't exist
    formVersionId = demoId('form-version', 1);
    console.log(`Using demo form version: ${formVersionId}`);
  }

  // 7. Seed calls with transcripts and FormSubmissions
  let callIndex = 0;
  const callsWithClients: { callId: string; clientId: string; startedAt: Date }[] = [];

  for (const client of clients) {
    // Each client gets 2-3 calls
    const numCalls = faker.number.int({ min: 2, max: 3 });

    for (let c = 0; c < numCalls; c++) {
      callIndex++;
      const callId = demoId('call', callIndex);

      // Select a transcript template
      const template = TRANSCRIPT_TEMPLATES[c % TRANSCRIPT_TEMPLATES.length];

      // Generate fake data for placeholders
      const dob = faker.date.birthdate({ min: 25, max: 65, mode: 'age' });
      const dobFormatted = dob.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const phone = faker.phone.number({ style: 'national' });
      const email = faker.internet.email({ firstName: client.firstName, lastName: client.lastName }).toLowerCase();

      // Replace placeholders in transcript
      const rawTranscript = template.raw
        .replace(/{clientName}/g, `${client.firstName} ${client.lastName}`)
        .replace(/{firstName}/g, client.firstName)
        .replace(/{lastName}/g, client.lastName)
        .replace(/{dob}/g, dobFormatted)
        .replace(/{phone}/g, phone)
        .replace(/{email}/g, email);

      const transcriptSegments = generateTranscriptSegments(rawTranscript);
      const totalDuration = transcriptSegments.length > 0
        ? (transcriptSegments[transcriptSegments.length - 1] as { endTime: number }).endTime
        : 300;

      // Generate call date (random within last 90 days)
      const startedAt = faker.date.recent({ days: 90 });
      const endedAt = new Date(startedAt.getTime() + totalDuration * 1000);

      await prisma.call.upsert({
        where: { id: callId },
        update: {
          // Clear AI fields so extraction can be re-tested
          aiSummary: Prisma.DbNull,
          extractedFields: Prisma.DbNull,
          confidenceScores: Prisma.DbNull,
          aiProcessingStatus: ProcessingStatus.PENDING,
          transcriptRaw: rawTranscript,
          transcriptJson: transcriptSegments,
          formIds: [DEMO_FORM_ID],
        },
        create: {
          id: callId,
          clientId: client.id,
          caseManagerId: userId,
          formIds: [DEMO_FORM_ID],
          status: CallStatus.COMPLETED,
          startedAt,
          endedAt,
          durationSeconds: Math.round(totalDuration),
          transcriptRaw: rawTranscript,
          transcriptJson: transcriptSegments,
          // Leave AI fields empty so extraction can be tested
          aiSummary: Prisma.DbNull,
          extractedFields: Prisma.DbNull,
          confidenceScores: Prisma.DbNull,
          aiProcessingStatus: ProcessingStatus.PENDING,
          isRecorded: true,
          consentGrantedAt: startedAt,
          consentMethod: 'VERBAL',
        },
      });

      // Track for FormSubmission creation
      callsWithClients.push({ callId, clientId: client.id, startedAt });
    }
  }
  console.log(`Seeded ${callIndex} calls with transcripts`);

  // 8. Create FormSubmissions for each call (links calls to client activity)
  let submissionCount = 0;
  for (const { callId, clientId, startedAt } of callsWithClients) {
    submissionCount++;
    const submissionId = demoId('submission', submissionCount);

    await prisma.formSubmission.upsert({
      where: { id: submissionId },
      update: {},
      create: {
        id: submissionId,
        orgId,
        formId: DEMO_FORM_ID,
        formVersionId: formVersionId!,
        clientId,
        callId,
        data: {}, // Will be populated when AI extraction runs
        status: 'SUBMITTED',
        isComplete: false,
        isDraft: false,
        aiExtractedData: Prisma.DbNull, // Will be populated when AI extraction runs
        aiConfidence: Prisma.DbNull,
        flaggedFields: [],
        submittedById: userId,
        submittedAt: startedAt,
      },
    });
  }
  console.log(`Created ${submissionCount} form submissions`);

  // 9. Seed client goals (manually created by case managers in the app)
  let clientGoalIndex = 0;
  for (const client of clients) {
    // Each client gets 2-3 goals
    const numGoals = faker.number.int({ min: 2, max: 3 });
    const shuffledTemplates = faker.helpers.shuffle([...CLIENT_GOAL_TEMPLATES]);

    for (let g = 0; g < numGoals; g++) {
      clientGoalIndex++;
      const clientGoalId = demoId('client-goal', clientGoalIndex);
      const template = shuffledTemplates[g % shuffledTemplates.length];

      // Randomize status and progress
      const statuses = [
        ClientGoalStatus.NOT_STARTED,
        ClientGoalStatus.IN_PROGRESS,
        ClientGoalStatus.IN_PROGRESS,
        ClientGoalStatus.ACHIEVED,
      ];
      const status = faker.helpers.arrayElement(statuses);

      let progress = 0;
      let currentValue = 0;
      if (status === ClientGoalStatus.IN_PROGRESS) {
        progress = faker.number.int({ min: 20, max: 80 });
        currentValue = Math.round((progress / 100) * template.targetValue);
      } else if (status === ClientGoalStatus.ACHIEVED) {
        progress = 100;
        currentValue = template.targetValue;
      }

      const startDate = faker.date.recent({ days: 60 });

      await prisma.clientGoal.upsert({
        where: { id: clientGoalId },
        update: {},
        create: {
          id: clientGoalId,
          orgId,
          clientId: client.id,
          title: template.title,
          description: template.description,
          outcomeType: template.outcomeType,
          status,
          metricType: template.metricType,
          targetValue: template.targetValue,
          currentValue,
          progress,
          startDate,
          clientVisibility: true,
          clientCanEdit: false,
          assignedToId: userId,
          createdById: userId,
        },
      });
    }
  }
  console.log(`Seeded ${clientGoalIndex} client goals`);

  console.log('\nDemo data seeding completed successfully!');
  console.log(`
Summary:
- Organization: ${orgName}
- User: ${DEMO_USER_EMAIL}
- Clients: ${clients.length}
- Calls: ${callIndex}
- Form Submissions: ${submissionCount}
- Grants: ${DEMO_GRANTS.length}
- Organization Goals: ${DEMO_GOALS.length}
- Client Goals: ${clientGoalIndex}

Next steps:
1. Run 'npm run db:process-demo' to extract fields from transcripts
2. Login as ${DEMO_USER_EMAIL} to view the demo data
3. Forms should now appear in client activity feeds
  `);
}

main()
  .catch((e) => {
    console.error('Demo seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
