/**
 * Metric Aggregation Engine
 *
 * Calculates metric values from database data based on metric definitions.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { MetricCalculation, MetricFilter, PreBuiltMetric, DataSource, AggregationType } from "./pre-built-metrics";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AggregationContext {
  orgId: string;
  dateRange: DateRange;
  programIds?: string[];
  clientIds?: string[];
}

export interface MetricResult {
  metricId: string;
  value: number;
  formattedValue: string;
  rawData?: Record<string, unknown>;
  breakdown?: Array<{
    label: string;
    value: number;
  }>;
  benchmarkStatus?: "below" | "good" | "excellent";
}

/**
 * Calculate a single metric
 */
export async function calculateMetric(
  metric: PreBuiltMetric,
  context: AggregationContext
): Promise<MetricResult> {
  const value = await executeCalculation(metric.calculation, context);

  // Format the value
  const formattedValue = formatMetricValue(value, metric.displayFormat);

  // Determine benchmark status
  let benchmarkStatus: "below" | "good" | "excellent" | undefined;
  if (metric.benchmark) {
    if (value >= metric.benchmark.excellent) {
      benchmarkStatus = "excellent";
    } else if (value >= metric.benchmark.good) {
      benchmarkStatus = "good";
    } else {
      benchmarkStatus = "below";
    }
  }

  return {
    metricId: metric.id,
    value,
    formattedValue,
    benchmarkStatus,
  };
}

/**
 * Calculate multiple metrics in batch
 */
export async function calculateMetrics(
  metrics: PreBuiltMetric[],
  context: AggregationContext
): Promise<MetricResult[]> {
  const results: MetricResult[] = [];

  for (const metric of metrics) {
    try {
      const result = await calculateMetric(metric, context);
      results.push(result);
    } catch (error) {
      console.error(`Error calculating metric ${metric.id}:`, error);
      results.push({
        metricId: metric.id,
        value: 0,
        formattedValue: "Error",
      });
    }
  }

  return results;
}

/**
 * Execute a metric calculation against the database
 */
async function executeCalculation(
  calculation: MetricCalculation,
  context: AggregationContext
): Promise<number> {
  // Handle percentage calculations
  if (calculation.aggregation === "percentage" && calculation.numerator && calculation.denominator) {
    const numerator = await executeCalculation(
      {
        dataSource: calculation.numerator.dataSource,
        aggregation: calculation.numerator.aggregation,
        field: calculation.numerator.field,
        filters: calculation.numerator.filters,
      },
      context
    );

    const denominator = await executeCalculation(
      {
        dataSource: calculation.denominator.dataSource,
        aggregation: calculation.denominator.aggregation,
        field: calculation.denominator.field,
        filters: calculation.denominator.filters,
      },
      context
    );

    if (denominator === 0) return 0;
    return (numerator / denominator) * 100;
  }

  // Build and execute query based on data source
  const result = await queryDataSource(
    calculation.dataSource,
    calculation.aggregation,
    calculation.field,
    calculation.filters,
    calculation.groupBy,
    context
  );

  return result;
}

/**
 * Query a specific data source with aggregation
 */
async function queryDataSource(
  dataSource: DataSource,
  aggregation: AggregationType,
  field?: string,
  filters?: MetricFilter[],
  groupBy?: string,
  context?: AggregationContext
): Promise<number> {
  // Build base where clause
  const baseWhere = buildWhereClause(filters, context);

  switch (dataSource) {
    case "clients":
      return queryClients(aggregation, field, baseWhere, groupBy, context);
    case "enrollments":
      return queryEnrollments(aggregation, field, baseWhere, groupBy, context);
    case "attendance":
      return queryAttendance(aggregation, field, baseWhere, groupBy, context);
    case "submissions":
      return querySubmissions(aggregation, field, baseWhere, groupBy, context);
    case "notes":
      return queryNotes(aggregation, field, baseWhere, groupBy, context);
    case "calls":
      return queryCalls(aggregation, field, baseWhere, groupBy, context);
    default:
      throw new Error(`Unknown data source: ${dataSource}`);
  }
}

/**
 * Build Prisma where clause from filters
 */
function buildWhereClause(
  filters?: MetricFilter[],
  context?: AggregationContext
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  // Add org filter
  if (context?.orgId) {
    where.orgId = context.orgId;
  }

  // Add date range filter
  if (context?.dateRange) {
    where.createdAt = {
      gte: context.dateRange.start,
      lte: context.dateRange.end,
    };
  }

  // Add program filter if specified
  if (context?.programIds && context.programIds.length > 0) {
    where.programId = { in: context.programIds };
  }

  // Add client filter if specified
  if (context?.clientIds && context.clientIds.length > 0) {
    where.clientId = { in: context.clientIds };
  }

  // Process metric-specific filters
  if (filters) {
    for (const filter of filters) {
      // Handle template variables
      let value = filter.value;
      if (typeof value === "string") {
        value = replaceTemplateVariables(value, context);
      } else if (Array.isArray(value)) {
        value = value.map((v) =>
          typeof v === "string" ? replaceTemplateVariables(v, context) : v
        );
      }

      switch (filter.operator) {
        case "eq":
          where[filter.field] = value;
          break;
        case "neq":
          where[filter.field] = { not: value };
          break;
        case "gt":
          where[filter.field] = { gt: value };
          break;
        case "gte":
          where[filter.field] = { gte: value };
          break;
        case "lt":
          where[filter.field] = { lt: value };
          break;
        case "lte":
          where[filter.field] = { lte: value };
          break;
        case "in":
          where[filter.field] = { in: value };
          break;
        case "notIn":
          where[filter.field] = { notIn: value };
          break;
        case "contains":
          where[filter.field] = { contains: value };
          break;
        case "between":
          if (Array.isArray(value) && value.length === 2) {
            where[filter.field] = { gte: value[0], lte: value[1] };
          }
          break;
      }
    }
  }

  return where;
}

function replaceTemplateVariables(value: string, context?: AggregationContext): unknown {
  if (!context) return value;

  if (value === "{{periodStart}}") {
    return context.dateRange.start;
  }
  if (value === "{{periodEnd}}") {
    return context.dateRange.end;
  }
  if (value === "{{orgId}}") {
    return context.orgId;
  }

  return value;
}

// Data source query functions
async function queryClients(
  aggregation: AggregationType,
  field?: string,
  where?: Record<string, unknown>,
  groupBy?: string,
  context?: AggregationContext
): Promise<number> {
  const whereClause = { ...where, orgId: context?.orgId } as Prisma.ClientWhereInput;

  switch (aggregation) {
    case "count":
      if (groupBy) {
        const grouped = await prisma.client.groupBy({
          by: [groupBy as Prisma.ClientScalarFieldEnum],
          where: whereClause,
          _count: true,
        });
        return grouped.length;
      }
      return prisma.client.count({ where: whereClause });

    case "sum":
    case "average":
    case "min":
    case "max":
      // These would require form submission data for client fields
      // For now, return count as fallback
      return prisma.client.count({ where: whereClause });

    default:
      return 0;
  }
}

async function queryEnrollments(
  aggregation: AggregationType,
  field?: string,
  where?: Record<string, unknown>,
  groupBy?: string,
  context?: AggregationContext
): Promise<number> {
  // Build where clause with program filter
  const whereClause: Prisma.ProgramEnrollmentWhereInput = {
    program: {
      orgId: context?.orgId,
      ...(context?.programIds && { id: { in: context.programIds } }),
    },
  };

  // Add additional filters
  if (where) {
    for (const [key, value] of Object.entries(where)) {
      if (key !== "orgId" && key !== "programId" && key !== "createdAt") {
        (whereClause as Record<string, unknown>)[key] = value;
      }
    }
  }

  // Add date filter
  if (context?.dateRange) {
    whereClause.enrolledDate = {
      gte: context.dateRange.start,
      lte: context.dateRange.end,
    };
  }

  switch (aggregation) {
    case "count":
      if (groupBy) {
        const grouped = await prisma.programEnrollment.groupBy({
          by: [groupBy as Prisma.ProgramEnrollmentScalarFieldEnum],
          where: whereClause,
          _count: true,
        });
        return grouped.length;
      }
      return prisma.programEnrollment.count({ where: whereClause });

    default:
      return prisma.programEnrollment.count({ where: whereClause });
  }
}

async function queryAttendance(
  aggregation: AggregationType,
  field?: string,
  where?: Record<string, unknown>,
  groupBy?: string,
  context?: AggregationContext
): Promise<number> {
  const whereClause: Prisma.SessionAttendanceWhereInput = {
    session: {
      program: {
        orgId: context?.orgId,
        ...(context?.programIds && { id: { in: context.programIds } }),
      },
      ...(context?.dateRange && {
        date: {
          gte: context.dateRange.start,
          lte: context.dateRange.end,
        },
      }),
    },
  };

  // Add additional filters
  if (where) {
    for (const [key, value] of Object.entries(where)) {
      if (key !== "orgId" && key !== "createdAt") {
        (whereClause as Record<string, unknown>)[key] = value;
      }
    }
  }

  switch (aggregation) {
    case "count":
      return prisma.sessionAttendance.count({ where: whereClause });

    case "sum":
      if (field === "hoursAttended") {
        const result = await prisma.sessionAttendance.aggregate({
          where: whereClause,
          _sum: { hoursAttended: true },
        });
        return result._sum.hoursAttended?.toNumber() || 0;
      }
      return 0;

    case "average":
      if (field === "hoursAttended") {
        const result = await prisma.sessionAttendance.aggregate({
          where: whereClause,
          _avg: { hoursAttended: true },
        });
        return result._avg.hoursAttended?.toNumber() || 0;
      }
      return 0;

    default:
      return prisma.sessionAttendance.count({ where: whereClause });
  }
}

async function querySubmissions(
  aggregation: AggregationType,
  field?: string,
  where?: Record<string, unknown>,
  _groupBy?: string,
  context?: AggregationContext
): Promise<number> {
  const whereClause: Prisma.FormSubmissionWhereInput = {
    orgId: context?.orgId,
    ...(context?.dateRange && {
      createdAt: {
        gte: context.dateRange.start,
        lte: context.dateRange.end,
      },
    }),
  };

  // Add additional filters
  if (where) {
    for (const [key, value] of Object.entries(where)) {
      if (key !== "orgId" && key !== "createdAt") {
        (whereClause as Record<string, unknown>)[key] = value;
      }
    }
  }

  switch (aggregation) {
    case "count":
      return prisma.formSubmission.count({ where: whereClause });

    default:
      return prisma.formSubmission.count({ where: whereClause });
  }
}

async function queryNotes(
  aggregation: AggregationType,
  field?: string,
  where?: Record<string, unknown>,
  _groupBy?: string,
  context?: AggregationContext
): Promise<number> {
  const whereClause: Prisma.NoteWhereInput = {
    client: {
      orgId: context?.orgId,
    },
    ...(context?.dateRange && {
      createdAt: {
        gte: context.dateRange.start,
        lte: context.dateRange.end,
      },
    }),
    deletedAt: null,
  };

  switch (aggregation) {
    case "count":
      return prisma.note.count({ where: whereClause });

    default:
      return prisma.note.count({ where: whereClause });
  }
}

async function queryCalls(
  aggregation: AggregationType,
  field?: string,
  where?: Record<string, unknown>,
  _groupBy?: string,
  context?: AggregationContext
): Promise<number> {
  const whereClause: Prisma.CallWhereInput = {
    client: {
      orgId: context?.orgId,
    },
    ...(context?.dateRange && {
      startedAt: {
        gte: context.dateRange.start,
        lte: context.dateRange.end,
      },
    }),
  };

  switch (aggregation) {
    case "count":
      return prisma.call.count({ where: whereClause });

    case "sum":
      if (field === "durationSeconds") {
        const result = await prisma.call.aggregate({
          where: whereClause,
          _sum: { durationSeconds: true },
        });
        return result._sum.durationSeconds || 0;
      }
      return 0;

    case "average":
      if (field === "durationSeconds") {
        const result = await prisma.call.aggregate({
          where: whereClause,
          _avg: { durationSeconds: true },
        });
        return result._avg.durationSeconds || 0;
      }
      return 0;

    default:
      return prisma.call.count({ where: whereClause });
  }
}

/**
 * Format metric value based on display type
 */
function formatMetricValue(value: number, format: string): string {
  switch (format) {
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);
    case "duration":
      // Format as hours:minutes
      const hours = Math.floor(value / 60);
      const minutes = Math.round(value % 60);
      return `${hours}h ${minutes}m`;
    case "number":
    default:
      return new Intl.NumberFormat("en-US").format(Math.round(value));
  }
}

/**
 * Calculate year-over-year comparison
 */
export async function calculateComparison(
  metric: PreBuiltMetric,
  context: AggregationContext
): Promise<{
  current: MetricResult;
  previous: MetricResult;
  change: number;
  changePercentage: number;
}> {
  // Calculate current period
  const current = await calculateMetric(metric, context);

  // Calculate previous period (same duration, shifted back)
  const duration = context.dateRange.end.getTime() - context.dateRange.start.getTime();
  const previousContext: AggregationContext = {
    ...context,
    dateRange: {
      start: new Date(context.dateRange.start.getTime() - duration),
      end: new Date(context.dateRange.end.getTime() - duration),
    },
  };
  const previous = await calculateMetric(metric, previousContext);

  const change = current.value - previous.value;
  const changePercentage = previous.value !== 0 ? (change / previous.value) * 100 : 0;

  return {
    current,
    previous,
    change,
    changePercentage,
  };
}
