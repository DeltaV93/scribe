import { prisma } from "@/lib/db";
import {
  QuizQuestionType,
  QuizAttemptStatus,
  QuizAudience,
  Prisma,
} from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateQuizInput {
  organizationId: string;
  createdById: string;
  title: string;
  description?: string | null;
  audience?: QuizAudience;
  passingScore?: number;
  maxAttempts?: number | null;
  questions: CreateQuestionInput[];
}

export interface UpdateQuizInput {
  title?: string;
  description?: string | null;
  audience?: QuizAudience;
  passingScore?: number;
  maxAttempts?: number | null;
  isActive?: boolean;
}

export interface CreateQuestionInput {
  type: QuizQuestionType;
  question: string;
  options?: QuestionOptions | null;
  correctAnswer: CorrectAnswer | null;
  points?: number;
  order: number;
}

export interface UpdateQuestionInput {
  type?: QuizQuestionType;
  question?: string;
  options?: QuestionOptions | null;
  correctAnswer?: CorrectAnswer;
  points?: number;
  order?: number;
}

// Question options structure varies by type
export interface QuestionOptions {
  // For SINGLE_CHOICE / MULTIPLE_CHOICE
  choices?: string[];
  // For MATCHING
  leftItems?: string[];
  rightItems?: string[];
  // For ORDERING
  items?: string[];
  // For SCALE
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
  // For FILE_UPLOAD
  allowedTypes?: string[];
  maxSizeBytes?: number;
}

// Correct answer format varies by question type
export type CorrectAnswer =
  | string            // SINGLE_CHOICE: selected choice
  | string[]          // MULTIPLE_CHOICE: array of selected choices
  | null              // FREE_TEXT, FILE_UPLOAD: manual review
  | { keywords?: string[] }  // FREE_TEXT with keyword matching
  | number            // SCALE: always correct, but store expected value
  | Record<string, string>  // MATCHING: { leftItem: rightItem, ... }
  | string[];         // ORDERING: correct sequence

// User answer format varies by question type
export type UserAnswer =
  | string            // SINGLE_CHOICE, FREE_TEXT
  | string[]          // MULTIPLE_CHOICE, ORDERING
  | number            // SCALE
  | Record<string, string>  // MATCHING
  | { fileUrl: string; fileName: string };  // FILE_UPLOAD

export interface QuizFilters {
  audience?: QuizAudience;
  isActive?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface QuizWithRelations {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  audience: QuizAudience;
  passingScore: number;
  maxAttempts: number | null;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  questions: QuestionWithRelations[];
  _count?: {
    questions: number;
    attempts: number;
  };
}

export interface QuestionWithRelations {
  id: string;
  quizId: string;
  type: QuizQuestionType;
  question: string;
  options: QuestionOptions | null;
  correctAnswer: CorrectAnswer;
  points: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttemptWithRelations {
  id: string;
  quizId: string;
  userId: string;
  score: number | null;
  totalPoints: number | null;
  maxPoints: number | null;
  status: QuizAttemptStatus;
  startedAt: Date;
  completedAt: Date | null;
  answers: AnswerWithRelations[];
  quiz?: {
    id: string;
    title: string;
    passingScore: number;
    questions: QuestionWithRelations[];
  };
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface AnswerWithRelations {
  id: string;
  attemptId: string;
  questionId: string;
  answer: UserAnswer;
  isCorrect: boolean | null;
  pointsEarned: number | null;
  fileUrl: string | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  question?: QuestionWithRelations;
}

export interface GradeResult {
  isCorrect: boolean | null;  // null = pending manual review
  pointsEarned: number | null;
}

// ============================================
// QUIZ CRUD OPERATIONS
// ============================================

/**
 * Create a new quiz with questions
 */
export async function createQuiz(
  input: CreateQuizInput
): Promise<QuizWithRelations> {
  const quiz = await prisma.quiz.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      title: input.title,
      description: input.description,
      audience: input.audience ?? QuizAudience.BOTH,
      passingScore: input.passingScore ?? 80,
      maxAttempts: input.maxAttempts,
      questions: {
        create: input.questions.map((q) => ({
          type: q.type,
          question: q.question,
          options: (q.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          correctAnswer: (q.correctAnswer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          points: q.points ?? 1,
          order: q.order,
        })),
      },
    },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      _count: {
        select: { questions: true, attempts: true },
      },
    },
  });

  return transformQuiz(quiz);
}

/**
 * Get a quiz by ID with questions
 */
export async function getQuizById(
  quizId: string,
  organizationId: string
): Promise<QuizWithRelations | null> {
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      organizationId,
      archivedAt: null,
    },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      _count: {
        select: { questions: true, attempts: true },
      },
    },
  });

  if (!quiz) return null;
  return transformQuiz(quiz);
}

/**
 * Get a quiz for taking (without correct answers)
 */
export async function getQuizForTaking(
  quizId: string,
  organizationId: string
): Promise<QuizWithRelations | null> {
  const quiz = await getQuizById(quizId, organizationId);

  if (!quiz) return null;

  // Remove correct answers from questions for taking
  return {
    ...quiz,
    questions: quiz.questions.map((q) => ({
      ...q,
      correctAnswer: null as CorrectAnswer,
    })),
  };
}

/**
 * Update a quiz
 */
export async function updateQuiz(
  quizId: string,
  organizationId: string,
  input: UpdateQuizInput
): Promise<QuizWithRelations> {
  const quiz = await prisma.quiz.update({
    where: {
      id: quizId,
      organizationId,
    },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.audience !== undefined && { audience: input.audience }),
      ...(input.passingScore !== undefined && { passingScore: input.passingScore }),
      ...(input.maxAttempts !== undefined && { maxAttempts: input.maxAttempts }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      _count: {
        select: { questions: true, attempts: true },
      },
    },
  });

  return transformQuiz(quiz);
}

/**
 * Archive a quiz (soft delete)
 */
export async function archiveQuiz(
  quizId: string,
  organizationId: string
): Promise<void> {
  await prisma.quiz.update({
    where: {
      id: quizId,
      organizationId,
    },
    data: {
      archivedAt: new Date(),
      isActive: false,
    },
  });
}

/**
 * List quizzes with filtering and pagination
 */
export async function listQuizzes(
  organizationId: string,
  filters: QuizFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ quizzes: QuizWithRelations[]; total: number; hasMore: boolean }> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where: Prisma.QuizWhereInput = {
    organizationId,
    archivedAt: null,
    ...(filters.audience && { audience: filters.audience }),
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const [quizzes, total] = await Promise.all([
    prisma.quiz.findMany({
      where,
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { questions: true, attempts: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.quiz.count({ where }),
  ]);

  return {
    quizzes: quizzes.map(transformQuiz),
    total,
    hasMore: skip + quizzes.length < total,
  };
}

/**
 * List quizzes available for a user to take
 */
export async function listAvailableQuizzes(
  organizationId: string,
  userId: string,
  isStaff: boolean,
  pagination: PaginationOptions = {}
): Promise<{ quizzes: (QuizWithRelations & { userAttemptCount: number; canAttempt: boolean })[]; total: number }> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  // Determine allowed audiences
  const allowedAudiences = isStaff
    ? [QuizAudience.STAFF, QuizAudience.BOTH]
    : [QuizAudience.CLIENT, QuizAudience.BOTH];

  const where: Prisma.QuizWhereInput = {
    organizationId,
    archivedAt: null,
    isActive: true,
    audience: { in: allowedAudiences },
  };

  const [quizzes, total] = await Promise.all([
    prisma.quiz.findMany({
      where,
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        attempts: {
          where: { userId },
          select: { id: true, status: true },
        },
        _count: {
          select: { questions: true, attempts: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.quiz.count({ where }),
  ]);

  return {
    quizzes: quizzes.map((quiz) => {
      const userAttemptCount = quiz.attempts.length;
      const hasPassed = quiz.attempts.some((a) => a.status === QuizAttemptStatus.PASSED);
      const canAttempt = !hasPassed && (quiz.maxAttempts === null || userAttemptCount < quiz.maxAttempts);

      return {
        ...transformQuiz(quiz),
        userAttemptCount,
        canAttempt,
      };
    }),
    total,
  };
}

// ============================================
// QUESTION OPERATIONS
// ============================================

/**
 * Add a question to a quiz
 */
export async function addQuestion(
  quizId: string,
  input: CreateQuestionInput
): Promise<QuestionWithRelations> {
  const question = await prisma.quizQuestion.create({
    data: {
      quizId,
      type: input.type,
      question: input.question,
      options: (input.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      correctAnswer: (input.correctAnswer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      points: input.points ?? 1,
      order: input.order,
    },
  });

  return transformQuestion(question);
}

/**
 * Update a question
 */
export async function updateQuestion(
  questionId: string,
  input: UpdateQuestionInput
): Promise<QuestionWithRelations> {
  const updateData: Prisma.QuizQuestionUpdateInput = {};
  if (input.type !== undefined) updateData.type = input.type;
  if (input.question !== undefined) updateData.question = input.question;
  if (input.options !== undefined) updateData.options = (input.options as Prisma.InputJsonValue) ?? Prisma.JsonNull;
  if (input.correctAnswer !== undefined) updateData.correctAnswer = (input.correctAnswer ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  if (input.points !== undefined) updateData.points = input.points;
  if (input.order !== undefined) updateData.order = input.order;

  const question = await prisma.quizQuestion.update({
    where: { id: questionId },
    data: updateData,
  });

  return transformQuestion(question);
}

/**
 * Delete a question
 */
export async function deleteQuestion(questionId: string): Promise<void> {
  await prisma.quizQuestion.delete({
    where: { id: questionId },
  });
}

/**
 * Reorder questions
 */
export async function reorderQuestions(
  quizId: string,
  questionOrders: { questionId: string; order: number }[]
): Promise<void> {
  await prisma.$transaction(
    questionOrders.map((qo) =>
      prisma.quizQuestion.update({
        where: { id: qo.questionId, quizId },
        data: { order: qo.order },
      })
    )
  );
}

// ============================================
// ATTEMPT OPERATIONS
// ============================================

/**
 * Start a new quiz attempt
 */
export async function startAttempt(
  quizId: string,
  userId: string,
  organizationId: string
): Promise<AttemptWithRelations> {
  // Verify quiz exists and is active
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      organizationId,
      isActive: true,
      archivedAt: null,
    },
    include: {
      questions: { orderBy: { order: "asc" } },
    },
  });

  if (!quiz) {
    throw new Error("Quiz not found or not active");
  }

  // Check if user has already passed
  const passedAttempt = await prisma.quizAttempt.findFirst({
    where: {
      quizId,
      userId,
      status: QuizAttemptStatus.PASSED,
    },
  });

  if (passedAttempt) {
    throw new Error("You have already passed this quiz");
  }

  // Check attempt limit
  if (quiz.maxAttempts !== null) {
    const attemptCount = await prisma.quizAttempt.count({
      where: { quizId, userId },
    });

    if (attemptCount >= quiz.maxAttempts) {
      throw new Error(`Maximum attempts (${quiz.maxAttempts}) reached for this quiz`);
    }
  }

  // Calculate max points
  const maxPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);

  // Create the attempt
  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId,
      userId,
      maxPoints,
      status: QuizAttemptStatus.IN_PROGRESS,
    },
    include: {
      answers: true,
      quiz: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          questions: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  return transformAttempt(attempt);
}

/**
 * Get an attempt by ID
 */
export async function getAttemptById(
  attemptId: string,
  userId?: string
): Promise<AttemptWithRelations | null> {
  const where: Prisma.QuizAttemptWhereInput = {
    id: attemptId,
    ...(userId && { userId }),
  };

  const attempt = await prisma.quizAttempt.findFirst({
    where,
    include: {
      answers: {
        include: {
          question: true,
        },
      },
      quiz: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          questions: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!attempt) return null;
  return transformAttempt(attempt);
}

/**
 * Submit an answer to a question
 */
export async function submitAnswer(
  attemptId: string,
  questionId: string,
  answer: UserAnswer,
  fileUrl?: string
): Promise<AnswerWithRelations> {
  // Get the attempt and question
  const [attempt, question] = await Promise.all([
    prisma.quizAttempt.findUnique({
      where: { id: attemptId },
    }),
    prisma.quizQuestion.findUnique({
      where: { id: questionId },
    }),
  ]);

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
    throw new Error("Cannot submit answer to a completed attempt");
  }

  if (!question) {
    throw new Error("Question not found");
  }

  if (question.quizId !== attempt.quizId) {
    throw new Error("Question does not belong to this quiz");
  }

  // Grade the answer
  const gradeResult = gradeAnswer(
    question.type,
    answer,
    question.correctAnswer as CorrectAnswer,
    question.points
  );

  // Create or update the answer
  const quizAnswer = await prisma.quizAnswer.upsert({
    where: {
      attemptId_questionId: {
        attemptId,
        questionId,
      },
    },
    create: {
      attemptId,
      questionId,
      answer: (answer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      isCorrect: gradeResult.isCorrect,
      pointsEarned: gradeResult.pointsEarned,
      fileUrl: fileUrl || null,
    },
    update: {
      answer: (answer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      isCorrect: gradeResult.isCorrect,
      pointsEarned: gradeResult.pointsEarned,
      fileUrl: fileUrl || null,
    },
    include: {
      question: true,
    },
  });

  return transformAnswer(quizAnswer);
}

/**
 * Complete a quiz attempt
 */
export async function completeAttempt(
  attemptId: string,
  userId: string
): Promise<AttemptWithRelations> {
  // Get the attempt with answers
  const attempt = await prisma.quizAttempt.findFirst({
    where: {
      id: attemptId,
      userId,
    },
    include: {
      answers: true,
      quiz: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          questions: true,
        },
      },
    },
  });

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
    throw new Error("Attempt is already completed");
  }

  // Calculate total points earned
  const totalPoints = attempt.answers.reduce(
    (sum, a) => sum + (a.pointsEarned ?? 0),
    0
  );

  // Calculate score percentage
  const maxPoints = attempt.maxPoints ?? 0;
  const score = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  // Determine pass/fail status
  // Check if any answers need manual review
  const pendingReview = attempt.answers.some((a) => a.isCorrect === null);

  // If there are pending reviews, we can't determine final status yet
  // But for now, we'll calculate based on what we have
  const status = score >= attempt.quiz.passingScore
    ? QuizAttemptStatus.PASSED
    : QuizAttemptStatus.FAILED;

  // Update the attempt
  const updatedAttempt = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: {
      score,
      totalPoints,
      status: pendingReview ? QuizAttemptStatus.IN_PROGRESS : status,
      completedAt: new Date(),
    },
    include: {
      answers: {
        include: {
          question: true,
        },
      },
      quiz: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          questions: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  return transformAttempt(updatedAttempt);
}

/**
 * Get user's attempt history for a quiz
 */
export async function getAttemptHistory(
  quizId: string,
  userId: string,
  pagination: PaginationOptions = {}
): Promise<{ attempts: AttemptWithRelations[]; total: number }> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const [attempts, total] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { quizId, userId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
        quiz: {
          select: {
            id: true,
            title: true,
            passingScore: true,
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.quizAttempt.count({ where: { quizId, userId } }),
  ]);

  return {
    attempts: attempts.map(transformAttempt),
    total,
  };
}

/**
 * Get all attempts for a quiz (admin view)
 */
export async function getAllAttempts(
  quizId: string,
  pagination: PaginationOptions = {}
): Promise<{
  attempts: (AttemptWithRelations & { user: { id: string; name: string | null; email: string } })[];
  total: number;
}> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const [attempts, total] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { quizId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        quiz: {
          select: {
            id: true,
            title: true,
            passingScore: true,
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.quizAttempt.count({ where: { quizId } }),
  ]);

  return {
    attempts: attempts.map((a) => ({
      ...transformAttempt(a),
      user: a.user,
    })),
    total,
  };
}

/**
 * Review a free text or file upload answer (manual grading)
 */
export async function reviewAnswer(
  answerId: string,
  reviewerId: string,
  isCorrect: boolean,
  pointsEarned: number
): Promise<AnswerWithRelations> {
  const answer = await prisma.quizAnswer.update({
    where: { id: answerId },
    data: {
      isCorrect,
      pointsEarned,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
    include: {
      question: true,
      attempt: true,
    },
  });

  // Recalculate attempt score if completed
  if (answer.attempt.completedAt) {
    await recalculateAttemptScore(answer.attemptId);
  }

  return transformAnswer(answer);
}

/**
 * Recalculate attempt score after manual review
 */
async function recalculateAttemptScore(attemptId: string): Promise<void> {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      quiz: true,
    },
  });

  if (!attempt) return;

  const totalPoints = attempt.answers.reduce(
    (sum, a) => sum + (a.pointsEarned ?? 0),
    0
  );

  const maxPoints = attempt.maxPoints ?? 0;
  const score = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  // Check if all answers have been reviewed
  const pendingReview = attempt.answers.some((a) => a.isCorrect === null);

  if (!pendingReview) {
    const status = score >= attempt.quiz.passingScore
      ? QuizAttemptStatus.PASSED
      : QuizAttemptStatus.FAILED;

    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score,
        totalPoints,
        status,
      },
    });
  } else {
    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score,
        totalPoints,
      },
    });
  }
}

// ============================================
// GRADING FUNCTIONS
// ============================================

/**
 * Grade an individual answer based on question type
 */
export function gradeAnswer(
  questionType: QuizQuestionType,
  userAnswer: UserAnswer,
  correctAnswer: CorrectAnswer,
  maxPoints: number
): GradeResult {
  switch (questionType) {
    case QuizQuestionType.SINGLE_CHOICE:
      return gradeSingleChoice(userAnswer as string, correctAnswer as string, maxPoints);

    case QuizQuestionType.MULTIPLE_CHOICE:
      return gradeMultipleChoice(userAnswer as string[], correctAnswer as string[], maxPoints);

    case QuizQuestionType.FREE_TEXT:
      return gradeFreeText(userAnswer as string, correctAnswer as { keywords?: string[] } | null, maxPoints);

    case QuizQuestionType.SCALE:
      // Scale is always correct (self-assessment)
      return { isCorrect: true, pointsEarned: maxPoints };

    case QuizQuestionType.MATCHING:
      return gradeMatching(
        userAnswer as Record<string, string>,
        correctAnswer as Record<string, string>,
        maxPoints
      );

    case QuizQuestionType.ORDERING:
      return gradeOrdering(userAnswer as string[], correctAnswer as string[], maxPoints);

    case QuizQuestionType.FILE_UPLOAD:
      // File upload requires manual review
      return { isCorrect: null, pointsEarned: null };

    default:
      return { isCorrect: null, pointsEarned: null };
  }
}

/**
 * Grade SINGLE_CHOICE: Exact match
 */
function gradeSingleChoice(
  userAnswer: string,
  correctAnswer: string,
  maxPoints: number
): GradeResult {
  const isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  return {
    isCorrect,
    pointsEarned: isCorrect ? maxPoints : 0,
  };
}

/**
 * Grade MULTIPLE_CHOICE: All correct selections, no wrong ones
 */
function gradeMultipleChoice(
  userAnswer: string[],
  correctAnswer: string[],
  maxPoints: number
): GradeResult {
  const userSet = new Set(userAnswer.map((a) => a.toLowerCase().trim()));
  const correctSet = new Set(correctAnswer.map((a) => a.toLowerCase().trim()));

  // Check if sets are equal
  const isCorrect =
    userSet.size === correctSet.size &&
    [...userSet].every((a) => correctSet.has(a));

  return {
    isCorrect,
    pointsEarned: isCorrect ? maxPoints : 0,
  };
}

/**
 * Grade FREE_TEXT: Keyword matching or pending manual review
 */
function gradeFreeText(
  userAnswer: string,
  correctAnswer: { keywords?: string[] } | null,
  maxPoints: number
): GradeResult {
  // If no keywords defined, requires manual review
  if (!correctAnswer || !correctAnswer.keywords || correctAnswer.keywords.length === 0) {
    return { isCorrect: null, pointsEarned: null };
  }

  // Check if answer contains all required keywords (case-insensitive)
  const lowerAnswer = userAnswer.toLowerCase();
  const containsAllKeywords = correctAnswer.keywords.every(
    (keyword) => lowerAnswer.includes(keyword.toLowerCase())
  );

  return {
    isCorrect: containsAllKeywords,
    pointsEarned: containsAllKeywords ? maxPoints : 0,
  };
}

/**
 * Grade MATCHING: All pairs correct
 */
function gradeMatching(
  userAnswer: Record<string, string>,
  correctAnswer: Record<string, string>,
  maxPoints: number
): GradeResult {
  const userKeys = Object.keys(userAnswer);
  const correctKeys = Object.keys(correctAnswer);

  // Must have same number of pairs
  if (userKeys.length !== correctKeys.length) {
    return { isCorrect: false, pointsEarned: 0 };
  }

  // All pairs must match
  const isCorrect = correctKeys.every(
    (key) =>
      userAnswer[key]?.toLowerCase().trim() ===
      correctAnswer[key]?.toLowerCase().trim()
  );

  return {
    isCorrect,
    pointsEarned: isCorrect ? maxPoints : 0,
  };
}

/**
 * Grade ORDERING: Exact sequence match
 */
function gradeOrdering(
  userAnswer: string[],
  correctAnswer: string[],
  maxPoints: number
): GradeResult {
  // Must have same length
  if (userAnswer.length !== correctAnswer.length) {
    return { isCorrect: false, pointsEarned: 0 };
  }

  // Each position must match
  const isCorrect = userAnswer.every(
    (item, index) =>
      item.toLowerCase().trim() === correctAnswer[index]?.toLowerCase().trim()
  );

  return {
    isCorrect,
    pointsEarned: isCorrect ? maxPoints : 0,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function transformQuiz(quiz: Prisma.QuizGetPayload<{
  include: {
    questions: true;
    _count: { select: { questions: true; attempts: true } };
  };
}>): QuizWithRelations {
  return {
    id: quiz.id,
    organizationId: quiz.organizationId,
    title: quiz.title,
    description: quiz.description,
    audience: quiz.audience,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    isActive: quiz.isActive,
    createdById: quiz.createdById,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
    archivedAt: quiz.archivedAt,
    questions: quiz.questions.map(transformQuestion),
    _count: quiz._count,
  };
}

function transformQuestion(question: Prisma.QuizQuestionGetPayload<{}>): QuestionWithRelations {
  return {
    id: question.id,
    quizId: question.quizId,
    type: question.type,
    question: question.question,
    options: question.options as QuestionOptions | null,
    correctAnswer: question.correctAnswer as CorrectAnswer,
    points: question.points,
    order: question.order,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

function transformAttempt(attempt: {
  id: string;
  quizId: string;
  userId: string;
  score: number | null;
  totalPoints: number | null;
  maxPoints: number | null;
  status: QuizAttemptStatus;
  startedAt: Date;
  completedAt: Date | null;
  answers: Array<{
    id: string;
    attemptId: string;
    questionId: string;
    answer: Prisma.JsonValue;
    isCorrect: boolean | null;
    pointsEarned: number | null;
    fileUrl: string | null;
    reviewedAt: Date | null;
    reviewedById: string | null;
    createdAt: Date;
    updatedAt: Date;
    question?: Prisma.QuizQuestionGetPayload<{}>;
  }>;
  quiz?: {
    id: string;
    title: string;
    passingScore: number;
    questions?: Prisma.QuizQuestionGetPayload<{}>[];
  };
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}): AttemptWithRelations & { user?: { id: string; name: string | null; email: string } } {
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    userId: attempt.userId,
    score: attempt.score,
    totalPoints: attempt.totalPoints,
    maxPoints: attempt.maxPoints,
    status: attempt.status,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    answers: attempt.answers.map((a) => transformAnswer(a as Prisma.QuizAnswerGetPayload<{ include: { question: true } }>)),
    quiz: attempt.quiz
      ? {
          id: attempt.quiz.id,
          title: attempt.quiz.title,
          passingScore: attempt.quiz.passingScore,
          questions: attempt.quiz.questions?.map(transformQuestion) ?? [],
        }
      : undefined,
    user: attempt.user,
  };
}

function transformAnswer(answer: Prisma.QuizAnswerGetPayload<{
  include?: {
    question?: true;
    attempt?: true;
  };
}>): AnswerWithRelations {
  return {
    id: answer.id,
    attemptId: answer.attemptId,
    questionId: answer.questionId,
    answer: answer.answer as UserAnswer,
    isCorrect: answer.isCorrect,
    pointsEarned: answer.pointsEarned,
    fileUrl: answer.fileUrl,
    reviewedAt: answer.reviewedAt,
    reviewedById: answer.reviewedById,
    createdAt: answer.createdAt,
    updatedAt: answer.updatedAt,
    question: 'question' in answer && answer.question
      ? transformQuestion(answer.question as Prisma.QuizQuestionGetPayload<{}>)
      : undefined,
  };
}

// ============================================
// STATISTICS
// ============================================

export interface QuizStats {
  totalAttempts: number;
  passedAttempts: number;
  failedAttempts: number;
  inProgressAttempts: number;
  passRate: number;
  averageScore: number;
  averageTimeToComplete: number | null; // in seconds
}

/**
 * Get statistics for a quiz
 */
export async function getQuizStats(quizId: string): Promise<QuizStats> {
  const [statusCounts, scoreStats, completionTimes] = await Promise.all([
    prisma.quizAttempt.groupBy({
      by: ["status"],
      where: { quizId },
      _count: { status: true },
    }),
    prisma.quizAttempt.aggregate({
      where: { quizId, score: { not: null } },
      _avg: { score: true },
    }),
    prisma.quizAttempt.findMany({
      where: {
        quizId,
        completedAt: { not: null },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  let totalAttempts = 0;
  for (const sc of statusCounts) {
    statusMap[sc.status] = sc._count.status;
    totalAttempts += sc._count.status;
  }

  const passedAttempts = statusMap[QuizAttemptStatus.PASSED] || 0;
  const failedAttempts = statusMap[QuizAttemptStatus.FAILED] || 0;
  const completedAttempts = passedAttempts + failedAttempts;

  // Calculate average completion time
  let averageTimeToComplete: number | null = null;
  if (completionTimes.length > 0) {
    const totalSeconds = completionTimes.reduce((sum, t) => {
      if (t.completedAt) {
        return sum + (t.completedAt.getTime() - t.startedAt.getTime()) / 1000;
      }
      return sum;
    }, 0);
    averageTimeToComplete = Math.round(totalSeconds / completionTimes.length);
  }

  return {
    totalAttempts,
    passedAttempts,
    failedAttempts,
    inProgressAttempts: statusMap[QuizAttemptStatus.IN_PROGRESS] || 0,
    passRate: completedAttempts > 0 ? Math.round((passedAttempts / completedAttempts) * 100) : 0,
    averageScore: Math.round(scoreStats._avg.score ?? 0),
    averageTimeToComplete,
  };
}
