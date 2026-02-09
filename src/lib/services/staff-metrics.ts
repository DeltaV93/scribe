import { prisma } from "@/lib/db";
import { CallStatus, EnrollmentStatus, MessageSenderType, Prisma } from "@prisma/client";
import { UserRole } from "@/types";

// ============================================
// TYPES
// ============================================

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ActivityMetrics {
  callsCompleted: number;
  messagesSent: number;
  formsCompleted: number;
  sessionsDelivered: number;
  clientsContacted: number;
}

export interface OutcomeMetrics {
  caseClosureRate: number;
  programCompletionRate: number;
  goalAchievement: number;
  totalCasesHandled: number;
  totalCasesClosed: number;
  totalEnrollments: number;
  totalCompletions: number;
}

export interface TrendDataPoint {
  date: string;
  callsCompleted: number;
  messagesSent: number;
  formsCompleted: number;
  sessionsDelivered: number;
}

export interface ProgramContribution {
  programId: string;
  programName: string;
  callsCompleted: number;
  formsCompleted: number;
  sessionsDelivered: number;
  clientsContacted: number;
  totalActivities: number;
}

export interface StaffMetrics {
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  dateRange: DateRange;
  activity: ActivityMetrics;
  outcomes: OutcomeMetrics;
  trend: TrendDataPoint[];
  programContributions: ProgramContribution[];
  linkedOKRs: LinkedOKR[];
}

export interface LinkedOKR {
  objectiveId: string;
  objectiveTitle: string;
  progress: number;
  keyResultCount: number;
  completedKeyResults: number;
}

export interface TeamMemberMetrics {
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  activity: ActivityMetrics;
  outcomes: OutcomeMetrics;
}

export interface TeamMetrics {
  supervisorId: string;
  teamSize: number;
  dateRange: DateRange;
  aggregateActivity: ActivityMetrics;
  aggregateOutcomes: OutcomeMetrics;
  memberMetrics: TeamMemberMetrics[];
  trend: TrendDataPoint[];
}

export interface ProgramMetrics {
  programId: string;
  programName: string;
  dateRange: DateRange;
  activity: ActivityMetrics;
  outcomes: {
    enrollmentCount: number;
    completionCount: number;
    completionRate: number;
    avgAttendanceRate: number;
  };
  contributorCount: number;
  linkedGrants: Array<{
    grantId: string;
    grantName: string;
    deliverableProgress: number;
  }>;
}

export interface OrgSummaryMetrics {
  orgId: string;
  dateRange: DateRange;
  totalStaff: number;
  activeStaff: number;
  aggregateActivity: ActivityMetrics;
  aggregateOutcomes: OutcomeMetrics;
  topContributors: Array<{
    userId: string;
    userName: string | null;
    totalActivities: number;
  }>;
  programPerformance: Array<{
    programId: string;
    programName: string;
    completionRate: number;
    activityCount: number;
  }>;
}

// ============================================
// STAFF METRIC EVENT TYPES
// ============================================

export enum StaffMetricEventType {
  CALL_COMPLETED = "CALL_COMPLETED",
  MESSAGE_SENT = "MESSAGE_SENT",
  FORM_SUBMITTED = "FORM_SUBMITTED",
  SESSION_DELIVERED = "SESSION_DELIVERED",
  CLIENT_CONTACTED = "CLIENT_CONTACTED",
}

export interface StaffMetricEvent {
  orgId: string;
  userId: string;
  eventType: StaffMetricEventType;
  clientId?: string;
  programId?: string;
  sourceType: string;
  sourceId: string;
  timestamp?: Date;
}

// ============================================
// GET STAFF METRICS
// ============================================

/**
 * Get metrics for an individual staff member
 */
export async function getStaffMetrics(
  userId: string,
  dateRange: DateRange
): Promise<StaffMetrics | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      orgId: true,
    },
  });

  if (!user) return null;

  const dateFilter = {
    gte: dateRange.startDate,
    lte: dateRange.endDate,
  };

  // Get activity metrics
  const [
    callsCompleted,
    messagesSent,
    formsCompleted,
    sessionsDelivered,
    uniqueClientsContacted,
  ] = await Promise.all([
    // Calls completed by this user
    prisma.call.count({
      where: {
        caseManagerId: userId,
        status: CallStatus.COMPLETED,
        startedAt: dateFilter,
      },
    }),

    // Messages sent by this user
    prisma.message.count({
      where: {
        senderId: userId,
        senderType: MessageSenderType.CASE_MANAGER,
        sentAt: dateFilter,
      },
    }),

    // Form submissions by this user
    prisma.formSubmission.count({
      where: {
        submittedById: userId,
        isComplete: true,
        submittedAt: dateFilter,
      },
    }),

    // Sessions facilitated by this user
    prisma.sessionAttendance.count({
      where: {
        recordedById: userId,
        recordedAt: dateFilter,
        attendanceType: "PRESENT",
      },
    }),

    // Unique clients contacted
    getUniqueClientsContacted(userId, dateRange),
  ]);

  // Get outcome metrics
  const outcomes = await getOutcomeMetrics(userId, user.orgId, dateRange);

  // Get trend data (daily breakdown)
  const trend = await getActivityTrend(userId, dateRange);

  // Get program contributions
  const programContributions = await getProgramContributions(userId, dateRange);

  // Get linked OKRs
  const linkedOKRs = await getLinkedOKRs(userId);

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    dateRange,
    activity: {
      callsCompleted,
      messagesSent,
      formsCompleted,
      sessionsDelivered,
      clientsContacted: uniqueClientsContacted,
    },
    outcomes,
    trend,
    programContributions,
    linkedOKRs,
  };
}

// ============================================
// GET TEAM METRICS
// ============================================

/**
 * Get metrics for a team (supervisor view)
 * Supervisors can see metrics for users with role CASE_MANAGER in their org
 */
export async function getTeamMetrics(
  supervisorId: string,
  dateRange: DateRange
): Promise<TeamMetrics | null> {
  // Get supervisor info
  const supervisor = await prisma.user.findUnique({
    where: { id: supervisorId },
    select: { id: true, orgId: true, role: true },
  });

  if (!supervisor) return null;

  // Only ADMIN, SUPER_ADMIN, or PROGRAM_MANAGER can view team metrics
  const allowedRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROGRAM_MANAGER];
  if (!allowedRoles.includes(supervisor.role as UserRole)) {
    return null;
  }

  // Get team members (Case Managers in the same org)
  const teamMembers = await prisma.user.findMany({
    where: {
      orgId: supervisor.orgId,
      role: UserRole.CASE_MANAGER,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  // Get metrics for each team member
  const memberMetricsPromises = teamMembers.map(async (member): Promise<TeamMemberMetrics | null> => {
    const metrics = await getStaffMetrics(member.id, dateRange);
    if (!metrics) return null;

    return {
      userId: member.id,
      userName: member.name,
      userEmail: member.email,
      userRole: member.role as string,
      activity: metrics.activity,
      outcomes: metrics.outcomes,
    };
  });

  const memberMetricsResults = await Promise.all(memberMetricsPromises);
  const memberMetrics = memberMetricsResults.filter(
    (m): m is TeamMemberMetrics => m !== null
  );

  // Calculate aggregate metrics
  const aggregateActivity: ActivityMetrics = {
    callsCompleted: memberMetrics.reduce((sum, m) => sum + m.activity.callsCompleted, 0),
    messagesSent: memberMetrics.reduce((sum, m) => sum + m.activity.messagesSent, 0),
    formsCompleted: memberMetrics.reduce((sum, m) => sum + m.activity.formsCompleted, 0),
    sessionsDelivered: memberMetrics.reduce((sum, m) => sum + m.activity.sessionsDelivered, 0),
    clientsContacted: memberMetrics.reduce((sum, m) => sum + m.activity.clientsContacted, 0),
  };

  const aggregateOutcomes = calculateAggregateOutcomes(memberMetrics);

  // Get team trend data
  const trend = await getTeamActivityTrend(
    teamMembers.map((m) => m.id),
    dateRange
  );

  return {
    supervisorId,
    teamSize: teamMembers.length,
    dateRange,
    aggregateActivity,
    aggregateOutcomes,
    memberMetrics,
    trend,
  };
}

// ============================================
// GET PROGRAM METRICS
// ============================================

/**
 * Get metrics for a specific program
 */
export async function getProgramMetrics(
  programId: string,
  dateRange: DateRange
): Promise<ProgramMetrics | null> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: {
      id: true,
      name: true,
      orgId: true,
    },
  });

  if (!program) return null;

  const dateFilter = {
    gte: dateRange.startDate,
    lte: dateRange.endDate,
  };

  // Get all clients enrolled in this program
  const enrollments = await prisma.programEnrollment.findMany({
    where: { programId },
    select: { clientId: true, status: true, enrolledDate: true, completionDate: true },
  });

  const clientIds = enrollments.map((e) => e.clientId);

  // Get activity metrics for this program's clients
  const [callsCompleted, formsCompleted, sessionsDelivered] = await Promise.all([
    prisma.call.count({
      where: {
        clientId: { in: clientIds },
        status: CallStatus.COMPLETED,
        startedAt: dateFilter,
      },
    }),

    prisma.formSubmission.count({
      where: {
        clientId: { in: clientIds },
        isComplete: true,
        submittedAt: dateFilter,
      },
    }),

    prisma.sessionAttendance.count({
      where: {
        session: { programId },
        attendanceType: "PRESENT",
        recordedAt: dateFilter,
      },
    }),
  ]);

  // Get unique contributors
  const contributors = await prisma.call.groupBy({
    by: ["caseManagerId"],
    where: {
      clientId: { in: clientIds },
      status: CallStatus.COMPLETED,
      startedAt: dateFilter,
    },
  });

  // Get enrollment/completion stats
  const enrollmentsInPeriod = enrollments.filter(
    (e) => e.enrolledDate >= dateRange.startDate && e.enrolledDate <= dateRange.endDate
  );
  const completionsInPeriod = enrollments.filter(
    (e) =>
      e.status === EnrollmentStatus.COMPLETED &&
      e.completionDate &&
      e.completionDate >= dateRange.startDate &&
      e.completionDate <= dateRange.endDate
  );

  // Get attendance rate
  const totalAttendance = await prisma.sessionAttendance.count({
    where: {
      session: { programId },
      recordedAt: dateFilter,
    },
  });
  const presentAttendance = await prisma.sessionAttendance.count({
    where: {
      session: { programId },
      attendanceType: "PRESENT",
      recordedAt: dateFilter,
    },
  });
  const avgAttendanceRate = totalAttendance > 0 ? (presentAttendance / totalAttendance) * 100 : 0;

  // Get linked grants
  const linkedGrants = await prisma.grantProgramLink.findMany({
    where: { programId },
    include: {
      grant: {
        select: {
          id: true,
          name: true,
          deliverables: {
            select: {
              currentValue: true,
              targetValue: true,
            },
          },
        },
      },
    },
  });

  return {
    programId: program.id,
    programName: program.name,
    dateRange,
    activity: {
      callsCompleted,
      messagesSent: 0, // Messages not directly linked to programs
      formsCompleted,
      sessionsDelivered,
      clientsContacted: clientIds.length,
    },
    outcomes: {
      enrollmentCount: enrollmentsInPeriod.length,
      completionCount: completionsInPeriod.length,
      completionRate:
        enrollmentsInPeriod.length > 0
          ? (completionsInPeriod.length / enrollmentsInPeriod.length) * 100
          : 0,
      avgAttendanceRate,
    },
    contributorCount: contributors.length,
    linkedGrants: linkedGrants.map((lg) => {
      const totalTarget = lg.grant.deliverables.reduce((sum, d) => sum + d.targetValue, 0);
      const totalCurrent = lg.grant.deliverables.reduce((sum, d) => sum + d.currentValue, 0);
      return {
        grantId: lg.grant.id,
        grantName: lg.grant.name,
        deliverableProgress: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0,
      };
    }),
  };
}

// ============================================
// GET ORG SUMMARY
// ============================================

/**
 * Get org-wide metrics summary (admin only)
 */
export async function getOrgSummaryMetrics(
  orgId: string,
  dateRange: DateRange
): Promise<OrgSummaryMetrics> {
  const dateFilter = {
    gte: dateRange.startDate,
    lte: dateRange.endDate,
  };

  // Get all staff
  const allStaff = await prisma.user.findMany({
    where: { orgId },
    select: { id: true, name: true, isActive: true },
  });

  const activeStaffIds = allStaff.filter((s) => s.isActive).map((s) => s.id);

  // Get aggregate activity
  const [callsCompleted, messagesSent, formsCompleted, sessionsDelivered] = await Promise.all([
    prisma.call.count({
      where: {
        client: { orgId },
        status: CallStatus.COMPLETED,
        startedAt: dateFilter,
      },
    }),

    prisma.message.count({
      where: {
        orgId,
        senderType: MessageSenderType.CASE_MANAGER,
        sentAt: dateFilter,
      },
    }),

    prisma.formSubmission.count({
      where: {
        form: { orgId },
        isComplete: true,
        submittedAt: dateFilter,
      },
    }),

    prisma.sessionAttendance.count({
      where: {
        session: { program: { orgId } },
        attendanceType: "PRESENT",
        recordedAt: dateFilter,
      },
    }),
  ]);

  // Get unique clients contacted
  const uniqueClients = await prisma.call.groupBy({
    by: ["clientId"],
    where: {
      client: { orgId },
      status: CallStatus.COMPLETED,
      startedAt: dateFilter,
    },
  });

  // Get outcome metrics
  const [totalCases, closedCases, totalEnrollments, completedEnrollments] = await Promise.all([
    prisma.client.count({
      where: {
        orgId,
        createdAt: dateFilter,
      },
    }),

    prisma.client.count({
      where: {
        orgId,
        status: "CLOSED",
        updatedAt: dateFilter,
      },
    }),

    prisma.programEnrollment.count({
      where: {
        program: { orgId },
        enrolledDate: dateFilter,
      },
    }),

    prisma.programEnrollment.count({
      where: {
        program: { orgId },
        status: EnrollmentStatus.COMPLETED,
        completionDate: dateFilter,
      },
    }),
  ]);

  // Get top contributors
  const topContributorData = await prisma.call.groupBy({
    by: ["caseManagerId"],
    where: {
      client: { orgId },
      status: CallStatus.COMPLETED,
      startedAt: dateFilter,
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const topContributorUsers = await prisma.user.findMany({
    where: { id: { in: topContributorData.map((c) => c.caseManagerId) } },
    select: { id: true, name: true },
  });

  const topContributors = topContributorData.map((c) => {
    const user = topContributorUsers.find((u) => u.id === c.caseManagerId);
    return {
      userId: c.caseManagerId,
      userName: user?.name ?? null,
      totalActivities: c._count.id,
    };
  });

  // Get program performance
  const programs = await prisma.program.findMany({
    where: { orgId, archivedAt: null },
    select: {
      id: true,
      name: true,
      enrollments: {
        where: { enrolledDate: dateFilter },
        select: { status: true },
      },
    },
  });

  const programPerformance = programs.map((p) => {
    const completed = p.enrollments.filter((e) => e.status === EnrollmentStatus.COMPLETED).length;
    return {
      programId: p.id,
      programName: p.name,
      completionRate: p.enrollments.length > 0 ? (completed / p.enrollments.length) * 100 : 0,
      activityCount: p.enrollments.length,
    };
  });

  return {
    orgId,
    dateRange,
    totalStaff: allStaff.length,
    activeStaff: activeStaffIds.length,
    aggregateActivity: {
      callsCompleted,
      messagesSent,
      formsCompleted,
      sessionsDelivered,
      clientsContacted: uniqueClients.length,
    },
    aggregateOutcomes: {
      caseClosureRate: totalCases > 0 ? (closedCases / totalCases) * 100 : 0,
      programCompletionRate:
        totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0,
      goalAchievement: 0, // Calculated from OKRs separately
      totalCasesHandled: totalCases,
      totalCasesClosed: closedCases,
      totalEnrollments,
      totalCompletions: completedEnrollments,
    },
    topContributors,
    programPerformance,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get unique clients contacted by a user in a date range
 */
async function getUniqueClientsContacted(
  userId: string,
  dateRange: DateRange
): Promise<number> {
  const dateFilter = {
    gte: dateRange.startDate,
    lte: dateRange.endDate,
  };

  // Combine calls and messages to get unique clients
  const [callClients, messageClients] = await Promise.all([
    prisma.call.findMany({
      where: {
        caseManagerId: userId,
        status: CallStatus.COMPLETED,
        startedAt: dateFilter,
      },
      select: { clientId: true },
      distinct: ["clientId"],
    }),

    prisma.message.findMany({
      where: {
        senderId: userId,
        senderType: MessageSenderType.CASE_MANAGER,
        sentAt: dateFilter,
      },
      select: { clientId: true },
      distinct: ["clientId"],
    }),
  ]);

  const uniqueClientIds = new Set([
    ...callClients.map((c) => c.clientId),
    ...messageClients.map((m) => m.clientId),
  ]);

  return uniqueClientIds.size;
}

/**
 * Get outcome metrics for a user
 */
async function getOutcomeMetrics(
  userId: string,
  orgId: string,
  dateRange: DateRange
): Promise<OutcomeMetrics> {
  const dateFilter = {
    gte: dateRange.startDate,
    lte: dateRange.endDate,
  };

  // Get case stats for clients assigned to this user
  const [totalCases, closedCases] = await Promise.all([
    prisma.client.count({
      where: {
        assignedTo: userId,
        orgId,
      },
    }),

    prisma.client.count({
      where: {
        assignedTo: userId,
        orgId,
        status: "CLOSED",
        updatedAt: dateFilter,
      },
    }),
  ]);

  // Get enrollment stats for clients assigned to this user
  const [totalEnrollments, completedEnrollments] = await Promise.all([
    prisma.programEnrollment.count({
      where: {
        enrolledById: userId,
        enrolledDate: dateFilter,
      },
    }),

    prisma.programEnrollment.count({
      where: {
        enrolledById: userId,
        status: EnrollmentStatus.COMPLETED,
        completionDate: dateFilter,
      },
    }),
  ]);

  // Get OKR goal achievement
  const objectives = await prisma.objective.findMany({
    where: {
      ownerId: userId,
      status: "ACTIVE",
    },
    select: { progress: true },
  });

  const goalAchievement =
    objectives.length > 0
      ? objectives.reduce((sum, o) => sum + o.progress, 0) / objectives.length
      : 0;

  return {
    caseClosureRate: totalCases > 0 ? (closedCases / totalCases) * 100 : 0,
    programCompletionRate:
      totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0,
    goalAchievement,
    totalCasesHandled: totalCases,
    totalCasesClosed: closedCases,
    totalEnrollments,
    totalCompletions: completedEnrollments,
  };
}

/**
 * Get activity trend data for a user (daily breakdown)
 */
async function getActivityTrend(
  userId: string,
  dateRange: DateRange
): Promise<TrendDataPoint[]> {
  const trend: TrendDataPoint[] = [];
  const current = new Date(dateRange.startDate);

  while (current <= dateRange.endDate) {
    const dayStart = new Date(current);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    const dayFilter = { gte: dayStart, lte: dayEnd };

    const [calls, messages, forms, sessions] = await Promise.all([
      prisma.call.count({
        where: {
          caseManagerId: userId,
          status: CallStatus.COMPLETED,
          startedAt: dayFilter,
        },
      }),

      prisma.message.count({
        where: {
          senderId: userId,
          senderType: MessageSenderType.CASE_MANAGER,
          sentAt: dayFilter,
        },
      }),

      prisma.formSubmission.count({
        where: {
          submittedById: userId,
          isComplete: true,
          submittedAt: dayFilter,
        },
      }),

      prisma.sessionAttendance.count({
        where: {
          recordedById: userId,
          recordedAt: dayFilter,
          attendanceType: "PRESENT",
        },
      }),
    ]);

    trend.push({
      date: current.toISOString().split("T")[0],
      callsCompleted: calls,
      messagesSent: messages,
      formsCompleted: forms,
      sessionsDelivered: sessions,
    });

    current.setDate(current.getDate() + 1);
  }

  return trend;
}

/**
 * Get team activity trend data (aggregated for all team members)
 */
async function getTeamActivityTrend(
  userIds: string[],
  dateRange: DateRange
): Promise<TrendDataPoint[]> {
  const trend: TrendDataPoint[] = [];
  const current = new Date(dateRange.startDate);

  while (current <= dateRange.endDate) {
    const dayStart = new Date(current);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    const dayFilter = { gte: dayStart, lte: dayEnd };

    const [calls, messages, forms, sessions] = await Promise.all([
      prisma.call.count({
        where: {
          caseManagerId: { in: userIds },
          status: CallStatus.COMPLETED,
          startedAt: dayFilter,
        },
      }),

      prisma.message.count({
        where: {
          senderId: { in: userIds },
          senderType: MessageSenderType.CASE_MANAGER,
          sentAt: dayFilter,
        },
      }),

      prisma.formSubmission.count({
        where: {
          submittedById: { in: userIds },
          isComplete: true,
          submittedAt: dayFilter,
        },
      }),

      prisma.sessionAttendance.count({
        where: {
          recordedById: { in: userIds },
          recordedAt: dayFilter,
          attendanceType: "PRESENT",
        },
      }),
    ]);

    trend.push({
      date: current.toISOString().split("T")[0],
      callsCompleted: calls,
      messagesSent: messages,
      formsCompleted: forms,
      sessionsDelivered: sessions,
    });

    current.setDate(current.getDate() + 1);
  }

  return trend;
}

/**
 * Get program contributions for a user
 */
async function getProgramContributions(
  userId: string,
  dateRange: DateRange
): Promise<ProgramContribution[]> {
  const dateFilter = {
    gte: dateRange.startDate,
    lte: dateRange.endDate,
  };

  // Get all programs where user had activity
  const programs = await prisma.program.findMany({
    where: {
      OR: [
        // Programs with calls to enrolled clients
        {
          enrollments: {
            some: {
              client: {
                calls: {
                  some: {
                    caseManagerId: userId,
                    status: CallStatus.COMPLETED,
                    startedAt: dateFilter,
                  },
                },
              },
            },
          },
        },
        // Programs where user facilitated sessions
        {
          sessions: {
            some: {
              attendance: {
                some: {
                  recordedById: userId,
                  recordedAt: dateFilter,
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true, name: true },
  });

  const contributions: ProgramContribution[] = [];

  for (const program of programs) {
    // Get enrolled client IDs for this program
    const enrollments = await prisma.programEnrollment.findMany({
      where: { programId: program.id },
      select: { clientId: true },
    });
    const clientIds = enrollments.map((e) => e.clientId);

    // Get activity counts
    const [calls, forms, sessions, clients] = await Promise.all([
      prisma.call.count({
        where: {
          caseManagerId: userId,
          clientId: { in: clientIds },
          status: CallStatus.COMPLETED,
          startedAt: dateFilter,
        },
      }),

      prisma.formSubmission.count({
        where: {
          submittedById: userId,
          clientId: { in: clientIds },
          isComplete: true,
          submittedAt: dateFilter,
        },
      }),

      prisma.sessionAttendance.count({
        where: {
          session: { programId: program.id },
          recordedById: userId,
          recordedAt: dateFilter,
          attendanceType: "PRESENT",
        },
      }),

      prisma.call.findMany({
        where: {
          caseManagerId: userId,
          clientId: { in: clientIds },
          status: CallStatus.COMPLETED,
          startedAt: dateFilter,
        },
        select: { clientId: true },
        distinct: ["clientId"],
      }),
    ]);

    contributions.push({
      programId: program.id,
      programName: program.name,
      callsCompleted: calls,
      formsCompleted: forms,
      sessionsDelivered: sessions,
      clientsContacted: clients.length,
      totalActivities: calls + forms + sessions,
    });
  }

  return contributions.sort((a, b) => b.totalActivities - a.totalActivities);
}

/**
 * Get OKRs linked to a user
 */
async function getLinkedOKRs(userId: string): Promise<LinkedOKR[]> {
  const objectives = await prisma.objective.findMany({
    where: {
      ownerId: userId,
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      progress: true,
      keyResults: {
        select: {
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return objectives.map((o) => ({
    objectiveId: o.id,
    objectiveTitle: o.title,
    progress: o.progress,
    keyResultCount: o.keyResults.length,
    completedKeyResults: o.keyResults.filter((kr) => kr.status === "COMPLETED").length,
  }));
}

/**
 * Calculate aggregate outcomes from team member metrics
 */
function calculateAggregateOutcomes(members: TeamMemberMetrics[]): OutcomeMetrics {
  if (members.length === 0) {
    return {
      caseClosureRate: 0,
      programCompletionRate: 0,
      goalAchievement: 0,
      totalCasesHandled: 0,
      totalCasesClosed: 0,
      totalEnrollments: 0,
      totalCompletions: 0,
    };
  }

  const totals = members.reduce(
    (acc, m) => ({
      totalCasesHandled: acc.totalCasesHandled + m.outcomes.totalCasesHandled,
      totalCasesClosed: acc.totalCasesClosed + m.outcomes.totalCasesClosed,
      totalEnrollments: acc.totalEnrollments + m.outcomes.totalEnrollments,
      totalCompletions: acc.totalCompletions + m.outcomes.totalCompletions,
      goalAchievementSum: acc.goalAchievementSum + m.outcomes.goalAchievement,
    }),
    {
      totalCasesHandled: 0,
      totalCasesClosed: 0,
      totalEnrollments: 0,
      totalCompletions: 0,
      goalAchievementSum: 0,
    }
  );

  return {
    caseClosureRate:
      totals.totalCasesHandled > 0
        ? (totals.totalCasesClosed / totals.totalCasesHandled) * 100
        : 0,
    programCompletionRate:
      totals.totalEnrollments > 0
        ? (totals.totalCompletions / totals.totalEnrollments) * 100
        : 0,
    goalAchievement: totals.goalAchievementSum / members.length,
    totalCasesHandled: totals.totalCasesHandled,
    totalCasesClosed: totals.totalCasesClosed,
    totalEnrollments: totals.totalEnrollments,
    totalCompletions: totals.totalCompletions,
  };
}

// ============================================
// METRIC EVENT TRACKING
// ============================================

/**
 * Track a staff metric event
 * This function can be called from other services when activities occur
 */
export async function trackStaffMetricEvent(event: StaffMetricEvent): Promise<void> {
  // For now, we calculate metrics from the database on-demand
  // In the future, we could store events for faster aggregation
  // This function serves as the integration point for other services

  // Log the event for debugging/monitoring
  console.log("[Staff Metrics] Event tracked:", {
    eventType: event.eventType,
    userId: event.userId,
    sourceType: event.sourceType,
    timestamp: event.timestamp || new Date(),
  });

  // Auto-attribute to programs via client enrollment
  if (event.clientId && !event.programId) {
    const enrollments = await prisma.programEnrollment.findMany({
      where: { clientId: event.clientId },
      select: { programId: true },
    });

    // Log attribution to programs
    for (const enrollment of enrollments) {
      console.log("[Staff Metrics] Activity attributed to program:", {
        eventType: event.eventType,
        userId: event.userId,
        programId: enrollment.programId,
      });
    }
  }
}

/**
 * Helper to track call completion event
 */
export function onCallCompletedForStaffMetrics(call: {
  id: string;
  caseManagerId: string;
  clientId: string;
  orgId: string;
}): void {
  trackStaffMetricEvent({
    orgId: call.orgId,
    userId: call.caseManagerId,
    eventType: StaffMetricEventType.CALL_COMPLETED,
    clientId: call.clientId,
    sourceType: "call",
    sourceId: call.id,
  }).catch(console.error);
}

/**
 * Helper to track message sent event
 */
export function onMessageSentForStaffMetrics(message: {
  id: string;
  senderId: string;
  clientId: string;
  orgId: string;
}): void {
  trackStaffMetricEvent({
    orgId: message.orgId,
    userId: message.senderId,
    eventType: StaffMetricEventType.MESSAGE_SENT,
    clientId: message.clientId,
    sourceType: "message",
    sourceId: message.id,
  }).catch(console.error);
}

/**
 * Helper to track form submission event
 */
export function onFormSubmittedForStaffMetrics(submission: {
  id: string;
  submittedById: string;
  clientId?: string | null;
  orgId: string;
}): void {
  if (!submission.submittedById) return;

  trackStaffMetricEvent({
    orgId: submission.orgId,
    userId: submission.submittedById,
    eventType: StaffMetricEventType.FORM_SUBMITTED,
    clientId: submission.clientId || undefined,
    sourceType: "form_submission",
    sourceId: submission.id,
  }).catch(console.error);
}

/**
 * Helper to track session delivered event
 */
export function onSessionDeliveredForStaffMetrics(attendance: {
  id: string;
  recordedById: string;
  programId: string;
  orgId: string;
}): void {
  trackStaffMetricEvent({
    orgId: attendance.orgId,
    userId: attendance.recordedById,
    eventType: StaffMetricEventType.SESSION_DELIVERED,
    programId: attendance.programId,
    sourceType: "session_attendance",
    sourceId: attendance.id,
  }).catch(console.error);
}
