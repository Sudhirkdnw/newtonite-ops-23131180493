import {
  PrismaClient,
  WorkItemType,
  Priority,
  WorkItemStatus,
  TeamRole,
  SystemRole,
  ActivityAction,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Demo@Newtonite2026!';

async function main() {
  console.log('🌱 Starting database seeding for Newtonite Operations...');

  // Hash demo password
  const passwordHash = await bcrypt.hash(DEFAULT_DEMO_PASSWORD, 10);

  // 1. Clean existing records in dependency order for clean deterministic reseeding
  console.log('  Cleaning existing records...');
  await prisma.activityEvent.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.outboxJob.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed Teams
  console.log('  Seeding 4 operational teams...');
  const coreOps = await prisma.team.create({
    data: {
      name: 'Core Operations',
      slug: 'core-ops',
      description: 'Incident triage, operations management, and high-pressure emergency response.',
    },
  });

  const platformEng = await prisma.team.create({
    data: {
      name: 'Platform Engineering',
      slug: 'platform-eng',
      description: 'Core infrastructure, platform services, and developer tooling.',
    },
  });

  const secCompliance = await prisma.team.create({
    data: {
      name: 'Security & Compliance',
      slug: 'sec-compliance',
      description: 'Security incident response, regulatory compliance, and audit controls.',
    },
  });

  const customerSupport = await prisma.team.create({
    data: {
      name: 'Customer Support',
      slug: 'customer-support',
      description: 'Customer escalation resolution, SLA monitoring, and enterprise support.',
    },
  });

  // 3. Seed Users
  console.log('  Seeding 10 demo users across roles...');
  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Alice Admin',
        email: 'alice.admin@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.SYSTEM_ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Bob Lead',
        email: 'bob.lead@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Charlie Lead',
        email: 'charlie.lead@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Diana Lead',
        email: 'diana.lead@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Evan Member',
        email: 'evan.member@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Fiona Member',
        email: 'fiona.member@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'George Member',
        email: 'george.member@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Hannah Member',
        email: 'hannah.member@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Ian Viewer',
        email: 'ian.viewer@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Julia Viewer',
        email: 'julia.viewer@newtonite.dev',
        passwordHash,
        systemRole: SystemRole.USER,
      },
    }),
  ]);

  const [alice, bob, charlie, diana, evan, fiona, george, hannah, ian, julia] = users;

  // 4. Seed Memberships
  console.log('  Seeding team memberships...');
  await prisma.membership.createMany({
    data: [
      // Alice: Admin in Core Ops and Platform Eng
      { userId: alice.id, teamId: coreOps.id, role: TeamRole.ADMIN },
      { userId: alice.id, teamId: platformEng.id, role: TeamRole.ADMIN },
      // Leads
      { userId: bob.id, teamId: coreOps.id, role: TeamRole.LEAD },
      { userId: charlie.id, teamId: platformEng.id, role: TeamRole.LEAD },
      { userId: diana.id, teamId: secCompliance.id, role: TeamRole.LEAD },
      // Members
      { userId: evan.id, teamId: coreOps.id, role: TeamRole.MEMBER },
      { userId: fiona.id, teamId: platformEng.id, role: TeamRole.MEMBER },
      { userId: george.id, teamId: customerSupport.id, role: TeamRole.MEMBER },
      { userId: hannah.id, teamId: secCompliance.id, role: TeamRole.MEMBER },
      // Viewers
      { userId: ian.id, teamId: coreOps.id, role: TeamRole.VIEWER },
      { userId: julia.id, teamId: customerSupport.id, role: TeamRole.VIEWER },
    ],
  });

  // 5. Seed Work Items
  console.log('  Seeding 10 operational work items...');
  const item1 = await prisma.workItem.create({
    data: {
      title: 'Database connection pool exhaustion in EU-West cluster',
      description:
        'Active connections exceeded max_connections limit during traffic spike. Connection latency increased to >5000ms.',
      type: WorkItemType.INCIDENT,
      priority: Priority.CRITICAL,
      status: WorkItemStatus.IN_PROGRESS,
      teamId: coreOps.id,
      assigneeId: bob.id,
      creatorId: alice.id,
      version: 2,
    },
  });

  await prisma.workItem.create({
    data: {
      title: 'Intermittent 502 gateway timeouts on payment webhook ingestion',
      description:
        'Payment provider webhooks occasionally drop due to upstream proxy timeouts during high concurrency.',
      type: WorkItemType.INCIDENT,
      priority: Priority.URGENT,
      status: WorkItemStatus.TRIAGED,
      teamId: coreOps.id,
      assigneeId: null,
      creatorId: evan.id,
      version: 1,
    },
  });

  await prisma.workItem.create({
    data: {
      title: 'Enterprise tenant SSO SAML certificate expiring in 48 hours',
      description:
        'Global Corp identity provider metadata certificate expires on Sunday. Requires certificate rolling and test assertion.',
      type: WorkItemType.CUSTOMER_ISSUE,
      priority: Priority.HIGH,
      status: WorkItemStatus.IN_PROGRESS,
      teamId: customerSupport.id,
      assigneeId: george.id,
      creatorId: julia.id,
      version: 1,
    },
  });

  await prisma.workItem.create({
    data: {
      title: 'Export CSV timeout for large audit trail datasets (>500k rows)',
      description:
        'Customers with over 500k rows experience browser gateway timeout when downloading audit history.',
      type: WorkItemType.CUSTOMER_ISSUE,
      priority: Priority.MEDIUM,
      status: WorkItemStatus.BACKLOG,
      teamId: customerSupport.id,
      assigneeId: null,
      creatorId: george.id,
      version: 1,
    },
  });

  await prisma.workItem.create({
    data: {
      title: 'Stripe payout batch failure reconciliation for Q3 settlements',
      description:
        'Discrepancy detected between Stripe clearing balance and ledger entries for settlements on Sep 30.',
      type: WorkItemType.PAYMENT,
      priority: Priority.HIGH,
      status: WorkItemStatus.IN_REVIEW,
      teamId: coreOps.id,
      assigneeId: evan.id,
      creatorId: bob.id,
      version: 2,
    },
  });

  const item6 = await prisma.workItem.create({
    data: {
      title: 'Double-charge refund escalation for enterprise order #9482',
      description:
        'Webhook retry duplicate execution caused dual payment capture. Refund processed and customer notified.',
      type: WorkItemType.PAYMENT,
      priority: Priority.URGENT,
      status: WorkItemStatus.COMPLETED,
      completedAt: new Date(),
      teamId: coreOps.id,
      assigneeId: bob.id,
      creatorId: evan.id,
      version: 3,
    },
  });

  await prisma.workItem.create({
    data: {
      title: 'Annual SOC2 Type II evidence collection and access audit',
      description:
        'Collect automated evidence for privileged IAM roles, audit logs retention, and encryption at rest verification.',
      type: WorkItemType.COMPLIANCE,
      priority: Priority.HIGH,
      status: WorkItemStatus.IN_PROGRESS,
      teamId: secCompliance.id,
      assigneeId: diana.id,
      creatorId: alice.id,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      version: 1,
    },
  });

  await prisma.workItem.create({
    data: {
      title: 'GDPR right-to-erasure request batch for deactivated accounts',
      description:
        'Permanently purge customer PII from operational datastores according to 30-day regulatory timeline.',
      type: WorkItemType.COMPLIANCE,
      priority: Priority.MEDIUM,
      status: WorkItemStatus.BACKLOG,
      teamId: secCompliance.id,
      assigneeId: hannah.id,
      creatorId: diana.id,
      version: 1,
    },
  });

  await prisma.workItem.create({
    data: {
      title: 'Upgrade Kubernetes staging worker node pool to v1.31',
      description:
        'Deprecate v1.29 nodes in staging cluster and validate PodDisruptionBudgets across core microservices.',
      type: WorkItemType.TASK,
      priority: Priority.MEDIUM,
      status: WorkItemStatus.IN_PROGRESS,
      teamId: platformEng.id,
      assigneeId: charlie.id,
      creatorId: alice.id,
      version: 1,
    },
  });

  await prisma.workItem.create({
    data: {
      title: 'Implement Redis distributed lock mechanism for worker jobs',
      description:
        'Ensure outbox workers run with leader election or advisory lock to prevent duplicate task execution across replicas.',
      type: WorkItemType.TASK,
      priority: Priority.LOW,
      status: WorkItemStatus.BACKLOG,
      teamId: platformEng.id,
      assigneeId: fiona.id,
      creatorId: charlie.id,
      version: 1,
    },
  });

  // 6. Seed Activity History & Comments
  console.log('  Seeding initial activity history and comments...');
  await prisma.activityEvent.createMany({
    data: [
      {
        workItemId: item1.id,
        actorId: alice.id,
        action: ActivityAction.CREATED,
        newState: { title: item1.title, status: WorkItemStatus.BACKLOG },
      },
      {
        workItemId: item1.id,
        actorId: bob.id,
        action: ActivityAction.CLAIMED,
        previousState: { assigneeId: null, status: WorkItemStatus.BACKLOG },
        newState: { assigneeId: bob.id, status: WorkItemStatus.IN_PROGRESS },
      },
      {
        workItemId: item6.id,
        actorId: evan.id,
        action: ActivityAction.CREATED,
        newState: { title: item6.title, status: WorkItemStatus.BACKLOG },
      },
      {
        workItemId: item6.id,
        actorId: bob.id,
        action: ActivityAction.STATUS_CHANGED,
        previousState: { status: WorkItemStatus.IN_REVIEW },
        newState: { status: WorkItemStatus.COMPLETED },
      },
    ],
  });

  await prisma.comment.createMany({
    data: [
      {
        workItemId: item1.id,
        authorId: bob.id,
        body: 'PgBouncer connection limits were bumped to 250 on read-replica-1. Monitoring connection pool saturation.',
      },
      {
        workItemId: item6.id,
        authorId: evan.id,
        body: 'Refund issued via payment gateway ID txn_98319024. Audit record verified.',
      },
      {
        workItemId: item6.id,
        authorId: bob.id,
        body: 'Reviewed ledger entries and confirmed duplicate debit reversed. Marked as completed.',
      },
    ],
  });

  console.log('✅ Seeding completed successfully!');
  console.log('\n=============================================');
  console.log('Demo Credentials for Newtonite Platform:');
  console.log(`Password for all accounts: ${DEFAULT_DEMO_PASSWORD}`);
  console.log('  - alice.admin@newtonite.dev     (System Admin, Team Admin)');
  console.log('  - bob.lead@newtonite.dev        (Lead, Core Operations)');
  console.log('  - charlie.lead@newtonite.dev    (Lead, Platform Engineering)');
  console.log('  - diana.lead@newtonite.dev      (Lead, Security & Compliance)');
  console.log('  - evan.member@newtonite.dev     (Member, Core Operations)');
  console.log('  - fiona.member@newtonite.dev    (Member, Platform Engineering)');
  console.log('  - george.member@newtonite.dev   (Member, Customer Support)');
  console.log('  - hannah.member@newtonite.dev   (Member, Security & Compliance)');
  console.log('  - ian.viewer@newtonite.dev      (Viewer, Core Operations)');
  console.log('  - julia.viewer@newtonite.dev    (Viewer, Customer Support)');
  console.log('=============================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
