import {
  Student,
  Mark,
  SUBJECTS,
  Subject,
  MAX_WEEKLY_MARK,
  WEEKS_COUNT,
  SUBJECT_FINAL_MAX,
  OVERALL_MAX,
} from '../types';

export interface SubjectComparison {
  week: number;
  diff: number | null;
}

export interface SubjectAnalysis {
  subject: string;
  rawTotal: number;            // sum of recorded weekly marks (max 140 if all 4 weeks recorded)
  rawMax: number;              // 35 * weeksRecorded (the achievable max for what's been taken)
  finalMark: number;           // converted to /100, integer-rounded. Spec: round((subject_total/140)*100)
  weeksRecorded: number;
  trend: 'Improving' | 'Declining' | 'Stable' | 'Fluctuating' | 'N/A';
  trendDelta: number;          // first->last recorded week diff (raw marks)
  weeklyMarks: (number | null)[]; // index 0..3 -> week 1..4 (null if not recorded)
}

export interface AIInsights {
  remarks: string[];
  summary: string;
  isAtRisk: boolean;
  alerts: string[];
  // Structured insight blocks per spec output format
  strength: string | null;
  weakness: string | null;
  improvingSubjects: string[];
  decliningSubjects: string[];
  // Map of subject -> final converted mark (out of 100). Insights are based on these per spec.
  subjectFinalMarks: Record<string, number>;
}

export interface StudentPerformance {
  student: Student;

  // ---- Marks data ----
  weeklyTotals: Record<number, number>;        // raw weekly totals (each out of 210 if full)
  weeklyComparisons: Record<number, number | null>; // diff between adjacent weeks (raw, only common subjects)
  subjectComparisons: Record<string, SubjectComparison[]>;
  subjectAnalyses: SubjectAnalysis[];

  // ---- School-standard converted figures ----
  finalSubjectMarks: Record<string, number>;   // each out of 100
  totalMarks: number;                          // sum of finalSubjectMarks => out of 600
  percentage: number;                          // (totalMarks / 600) * 100, 1 decimal
  maxTotal: number;                            // OVERALL_MAX = 600

  // ---- Ranking & status ----
  rank: number;
  trend: 'Improving' | 'Declining' | 'Stable' | 'Fluctuating' | 'N/A';
  status: 'Good' | 'Average' | 'Needs Improvement' | 'N/A';
  strongestSubject: string;
  weakestSubject: string;
  hasEntries: boolean;

  // ---- AI ----
  insights: AIInsights;

  // Helper: latest recorded week (raw total of that week)
  latestTotal: number;
}

// =====================================================================
// CORE CONVERSION HELPERS (Backend-equivalent functions)
// =====================================================================

/**
 * Convert a subject's raw total to a final mark out of 100.
 * Spec: final_subject_mark = (subject_total / 140) * 100, rounded.
 *
 * Edge case: if some weeks are missing, we proportionally scale based
 * only on the weeks actually recorded so the converted mark fairly
 * reflects performance on the tests that WERE taken
 * (raw / (35 * weeksRecorded)) * 100.
 */
export function convertToHundred(rawTotal: number, weeksRecorded: number): number {
  if (weeksRecorded <= 0) return 0;
  const max = MAX_WEEKLY_MARK * weeksRecorded;
  if (max <= 0) return 0;
  return Math.round((rawTotal / max) * SUBJECT_FINAL_MAX);
}

/**
 * Backend-equivalent: calculateFinalTotal(student_id)
 * Sums the converted (out of 100) marks for every subject the student has data for.
 * Returns total out of 600 (when all 6 subjects have data).
 */
export function calculateFinalTotal(
  studentId: string,
  students: Student[],
  marks: Mark[]
): number {
  const perf = analyzeStudentPerformance(studentId, students, marks);
  return perf ? perf.totalMarks : 0;
}

// =====================================================================
// TREND DETECTION
// =====================================================================

function detectSubjectTrend(weekValues: (number | null)[]): {
  trend: SubjectAnalysis['trend'];
  delta: number;
} {
  const recorded: number[] = [];
  weekValues.forEach(v => {
    if (v !== null) recorded.push(v);
  });

  if (recorded.length < 2) {
    return { trend: 'N/A', delta: 0 };
  }

  let ups = 0;
  let downs = 0;
  let same = 0;
  for (let i = 1; i < recorded.length; i++) {
    const diff = recorded[i] - recorded[i - 1];
    if (diff > 0) ups++;
    else if (diff < 0) downs++;
    else same++;
  }

  const delta = recorded[recorded.length - 1] - recorded[0];

  if (ups > 0 && downs === 0) return { trend: 'Improving', delta };
  if (downs > 0 && ups === 0) return { trend: 'Declining', delta };
  if (ups === 0 && downs === 0 && same > 0) return { trend: 'Stable', delta };
  return { trend: 'Fluctuating', delta };
}

function detectOverallTrend(
  weeklyTotals: Record<number, number>,
  weeklyCount: Record<number, number>
): {
  trend: StudentPerformance['trend'];
  recordedWeeks: number[];
} {
  const recordedWeeks: number[] = [];
  for (let w = 1; w <= WEEKS_COUNT; w++) {
    if (weeklyCount[w] > 0) recordedWeeks.push(weeklyTotals[w]);
  }

  if (recordedWeeks.length < 2) {
    return { trend: 'N/A', recordedWeeks };
  }

  let ups = 0;
  let downs = 0;
  let same = 0;
  for (let i = 1; i < recordedWeeks.length; i++) {
    const diff = recordedWeeks[i] - recordedWeeks[i - 1];
    if (diff > 0) ups++;
    else if (diff < 0) downs++;
    else same++;
  }

  if (ups > 0 && downs === 0) return { trend: 'Improving', recordedWeeks };
  if (downs > 0 && ups === 0) return { trend: 'Declining', recordedWeeks };
  if (ups === 0 && downs === 0 && same > 0) return { trend: 'Stable', recordedWeeks };
  return { trend: 'Fluctuating', recordedWeeks };
}

// =====================================================================
// AI INSIGHTS (now driven by FINAL converted marks out of 100)
// =====================================================================

function buildInsights(
  student: Student,
  subjectAnalyses: SubjectAnalysis[],
  trend: StudentPerformance['trend'],
  status: StudentPerformance['status'],
  weeklyComparisons: Record<number, number | null>,
  totalMarks: number,
  activeWeeks: number,
  percentage: number
): AIInsights {
  const remarks: string[] = [];
  const alerts: string[] = [];
  let isAtRisk = false;

  // ---------- Edge case: insufficient data ----------
  if (activeWeeks === 0) {
    return {
      remarks: [],
      alerts: [],
      isAtRisk: false,
      summary: `Not enough data to analyze ${student.name}'s performance yet.`,
      strength: null,
      weakness: null,
      improvingSubjects: [],
      decliningSubjects: [],
      subjectFinalMarks: {},
    };
  }

  // Subjects with at least one mark — these drive every insight
  const recordedSubjects = subjectAnalyses.filter(s => s.weeksRecorded > 0);

  // ---------- Subject final marks (out of 100) — the basis of analysis ----------
  const subjectFinalMarks: Record<string, number> = {};
  recordedSubjects.forEach(s => {
    subjectFinalMarks[s.subject] = s.finalMark;
  });

  // ---------- Strength / Weakness based on FINAL MARKS (/100) per spec ----------
  let strength: string | null = null;
  let weakness: string | null = null;
  let balanced = false;

  if (recordedSubjects.length > 0) {
    const sortedByFinal = [...recordedSubjects].sort((a, b) => b.finalMark - a.finalMark);
    const top = sortedByFinal[0];
    const bottom = sortedByFinal[sortedByFinal.length - 1];

    // Edge case: balanced (spread under 2 marks out of 100)
    const spread = top.finalMark - bottom.finalMark;
    if (recordedSubjects.length >= 2 && spread < 2) {
      balanced = true;
    } else {
      strength = top.subject;
      weakness = bottom.subject;
    }
  }

  // ---------- Per-subject trend lists ----------
  const improvingSubjects = recordedSubjects
    .filter(s => s.trend === 'Improving')
    .map(s => s.subject);
  const decliningSubjects = recordedSubjects
    .filter(s => s.trend === 'Declining')
    .map(s => s.subject);

  // ---------- Build remarks ----------
  if (trend === 'Improving') {
    remarks.push(`Performance improving — total marks have risen across recorded weeks.`);
  } else if (trend === 'Declining') {
    remarks.push(`Performance declining — total marks have dropped across recorded weeks.`);
  } else if (trend === 'Fluctuating') {
    remarks.push(`Performance fluctuating — weekly totals are inconsistent.`);
  } else if (trend === 'Stable') {
    remarks.push(`Performance is stable across the recorded weeks.`);
  }

  if (balanced) {
    remarks.push(`Balanced performance across subjects (final marks within 2 of each other out of 100).`);
  } else {
    if (strength) {
      const top = recordedSubjects.find(s => s.subject === strength)!;
      remarks.push(`Strong in ${strength} (${top.finalMark}/100).`);
    }
    if (weakness && weakness !== strength) {
      const bot = recordedSubjects.find(s => s.subject === weakness)!;
      remarks.push(`Needs improvement in ${weakness} (${bot.finalMark}/100).`);
    }
  }

  improvingSubjects.forEach(sub => {
    const s = recordedSubjects.find(x => x.subject === sub)!;
    remarks.push(`Improving in ${sub} (+${s.trendDelta} since first recorded week).`);
  });
  decliningSubjects.forEach(sub => {
    const s = recordedSubjects.find(x => x.subject === sub)!;
    remarks.push(`Declining in ${sub} (${s.trendDelta} since first recorded week).`);
  });

  // ---------- Alerts based on most recent weekly delta (raw marks) ----------
  let latestComparison: number | null = null;
  let latestComparisonWeek: number | null = null;
  for (let w = WEEKS_COUNT; w >= 2; w--) {
    if (weeklyComparisons[w] !== null && weeklyComparisons[w] !== undefined) {
      latestComparison = weeklyComparisons[w] as number;
      latestComparisonWeek = w;
      break;
    }
  }
  if (latestComparison !== null && latestComparisonWeek !== null) {
    // Thresholds scaled to weekly raw max (210 if all 6 subjects taken).
    if (latestComparison <= -15) {
      alerts.push(`Marks dropped significantly in Week ${latestComparisonWeek} (${latestComparison}).`);
    } else if (latestComparison < 0) {
      alerts.push(`Marks decreased slightly in Week ${latestComparisonWeek} (${latestComparison}).`);
    } else if (latestComparison >= 15) {
      alerts.push(`Significant improvement in Week ${latestComparisonWeek} (+${latestComparison}).`);
    } else if (latestComparison > 0) {
      alerts.push(`Slight improvement in Week ${latestComparisonWeek} (+${latestComparison}).`);
    }
  }

  // ---------- At-risk detection (based on overall percentage out of 600) ----------
  if (percentage < 40 || (trend === 'Declining' && percentage < 50)) {
    isAtRisk = true;
  }

  // ---------- Dynamic Summary ----------
  const trendPhrase =
    trend === 'Improving' ? 'is on an upward trajectory' :
    trend === 'Declining' ? 'is currently on a downward trajectory' :
    trend === 'Fluctuating' ? 'shows fluctuating results week to week' :
    trend === 'Stable' ? 'is holding a steady level' :
    'has only one recorded week so far';

  const parts: string[] = [];
  parts.push(`${student.name} ${trendPhrase}, scoring ${totalMarks}/${OVERALL_MAX} (${percentage.toFixed(1)}%) across ${activeWeeks} recorded week${activeWeeks > 1 ? 's' : ''}.`);

  if (balanced) {
    parts.push(`Subject performance is balanced — no single standout strong or weak area.`);
  } else if (strength && weakness && strength !== weakness) {
    const top = recordedSubjects.find(s => s.subject === strength)!;
    const bot = recordedSubjects.find(s => s.subject === weakness)!;
    parts.push(`Strongest is ${strength} (${top.finalMark}/100), while ${weakness} (${bot.finalMark}/100) pulls the average down most.`);
  } else if (strength) {
    const top = recordedSubjects.find(s => s.subject === strength)!;
    parts.push(`Best results are in ${strength} (${top.finalMark}/100).`);
  }

  if (improvingSubjects.length > 0 && decliningSubjects.length > 0) {
    parts.push(`Gaining ground in ${improvingSubjects.join(', ')} but losing ground in ${decliningSubjects.join(', ')}.`);
  } else if (improvingSubjects.length > 0) {
    parts.push(`Positive momentum visible in ${improvingSubjects.join(', ')}.`);
  } else if (decliningSubjects.length > 0) {
    parts.push(`Concerning drops detected in ${decliningSubjects.join(', ')}.`);
  }

  if (isAtRisk) {
    parts.push(`Marked as At Risk — early intervention recommended.`);
  } else if (status === 'Good') {
    parts.push(`Overall standing: Good.`);
  }

  const summary = parts.join(' ');

  return {
    remarks,
    alerts,
    isAtRisk,
    summary,
    strength,
    weakness,
    improvingSubjects,
    decliningSubjects,
    subjectFinalMarks,
  };
}

// =====================================================================
// MAIN ENGINE
// =====================================================================

export function calculatePerformance(students: Student[], marks: Mark[]): StudentPerformance[] {
  const result: StudentPerformance[] = [];

  students.forEach(student => {
    const studentMarks = marks.filter(m => m.studentId === student.id);

    // Raw weekly totals (out of 210 max if all 6 subjects taken)
    const weeklyTotals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const weeklyCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    // Per-subject per-week marks (out of 35)
    const subjectMarks: Record<string, Record<number, number | null>> = {};
    SUBJECTS.forEach(sub => {
      subjectMarks[sub] = { 1: null, 2: null, 3: null, 4: null };
    });

    studentMarks.forEach(m => {
      if (m.marks !== null) {
        // Defensive clamp: weekly mark cannot exceed MAX_WEEKLY_MARK
        const clamped = Math.max(0, Math.min(MAX_WEEKLY_MARK, m.marks));
        weeklyTotals[m.weekNumber] = (weeklyTotals[m.weekNumber] || 0) + clamped;
        weeklyCount[m.weekNumber] = (weeklyCount[m.weekNumber] || 0) + 1;
        if (SUBJECTS.includes(m.subject as Subject)) {
          subjectMarks[m.subject][m.weekNumber] = clamped;
        }
      }
    });

    // Subject-level analyses + comparisons + final converted marks
    const subjectComparisons: Record<string, SubjectComparison[]> = {};
    const subjectAnalyses: SubjectAnalysis[] = [];
    const finalSubjectMarks: Record<string, number> = {};

    SUBJECTS.forEach(sub => {
      subjectComparisons[sub] = [];

      for (let w = 2; w <= WEEKS_COUNT; w++) {
        const current = subjectMarks[sub][w];
        const prev = subjectMarks[sub][w - 1];
        if (current !== null && prev !== null) {
          subjectComparisons[sub].push({ week: w, diff: current - prev });
        } else {
          subjectComparisons[sub].push({ week: w, diff: null });
        }
      }

      // Compute raw subject total + final mark (out of 100)
      let rawTotal = 0;
      let weeksRecorded = 0;
      const orderedValues: (number | null)[] = [];
      for (let w = 1; w <= WEEKS_COUNT; w++) {
        const val = subjectMarks[sub][w];
        orderedValues.push(val);
        if (val !== null) {
          rawTotal += val;
          weeksRecorded++;
        }
      }

      const rawMax = MAX_WEEKLY_MARK * weeksRecorded;
      const finalMark = convertToHundred(rawTotal, weeksRecorded);
      finalSubjectMarks[sub] = finalMark;

      const { trend: subTrend, delta } = detectSubjectTrend(orderedValues);
      subjectAnalyses.push({
        subject: sub,
        rawTotal,
        rawMax,
        finalMark,
        weeksRecorded,
        trend: subTrend,
        trendDelta: delta,
        weeklyMarks: orderedValues,
      });
    });

    // Final total = sum of converted subject marks (out of 600)
    const totalMarks = SUBJECTS.reduce((acc, sub) => acc + finalSubjectMarks[sub], 0);

    // Strongest / weakest by FINAL MARK (out of 100)
    const recordedSubjects = subjectAnalyses.filter(s => s.weeksRecorded > 0);
    let strongestSubject = 'N/A';
    let weakestSubject = 'N/A';
    if (recordedSubjects.length > 0) {
      const sorted = [...recordedSubjects].sort((a, b) => b.finalMark - a.finalMark);
      const top = sorted[0];
      const bot = sorted[sorted.length - 1];
      const spread = top.finalMark - bot.finalMark;
      if (!(recordedSubjects.length >= 2 && spread < 2)) {
        strongestSubject = top.subject;
        weakestSubject = bot.subject;
      }
    }

    // Weekly comparisons (raw deltas across only-shared subjects)
    const weeklyComparisons: Record<number, number | null> = {};
    for (let w = 2; w <= WEEKS_COUNT; w++) {
      let diffSum = 0;
      let validSubjs = 0;
      SUBJECTS.forEach(sub => {
        const current = subjectMarks[sub][w];
        const prev = subjectMarks[sub][w - 1];
        if (current !== null && prev !== null) {
          diffSum += current - prev;
          validSubjs++;
        }
      });
      weeklyComparisons[w] = validSubjs > 0 ? diffSum : null;
    }

    // Overall trend (based on raw weekly totals — direction is what matters)
    const { trend } = detectOverallTrend(weeklyTotals, weeklyCount);

    // Active weeks
    let activeWeeks = 0;
    for (let w = 1; w <= WEEKS_COUNT; w++) if (weeklyCount[w] > 0) activeWeeks++;

    // Latest week's raw total
    let latestTotal = 0;
    for (let w = WEEKS_COUNT; w >= 1; w--) {
      if (weeklyCount[w] > 0) {
        latestTotal = weeklyTotals[w];
        break;
      }
    }

    // Percentage now strictly based on FINAL TOTAL out of 600
    const percentage = activeWeeks > 0
      ? +((totalMarks / OVERALL_MAX) * 100).toFixed(1)
      : 0;

    // Status thresholds based on the converted overall percentage
    let status: StudentPerformance['status'] = 'N/A';
    if (activeWeeks > 0) {
      if (percentage >= 75) status = 'Good';
      else if (percentage >= 50) status = 'Average';
      else status = 'Needs Improvement';
      if (trend === 'Declining' && percentage < 60) status = 'Needs Improvement';
    }

    // Build dynamic insights using the converted marks
    const insights = buildInsights(
      student,
      subjectAnalyses,
      trend,
      status,
      weeklyComparisons,
      totalMarks,
      activeWeeks,
      percentage
    );

    result.push({
      student,
      weeklyTotals,
      weeklyComparisons,
      subjectComparisons,
      subjectAnalyses,
      finalSubjectMarks,
      totalMarks,
      percentage,
      maxTotal: OVERALL_MAX,
      rank: 0,
      trend,
      status,
      strongestSubject,
      weakestSubject,
      hasEntries: activeWeeks > 0,
      insights,
      latestTotal,
    });
  });

  // Rank calculation — STRICTLY by totalMarks (out of 600), with tie handling.
  // Students with no entries are pushed to the bottom and unranked (rank=0).
  result.sort((a, b) => {
    if (a.hasEntries !== b.hasEntries) return a.hasEntries ? -1 : 1;
    return b.totalMarks - a.totalMarks;
  });

  let currentRank = 1;
  let prevScore = -1;
  let rankCounter = 1;
  result.forEach(res => {
    if (!res.hasEntries) {
      res.rank = 0;
    } else {
      if (res.totalMarks !== prevScore) {
        currentRank = rankCounter;
        prevScore = res.totalMarks;
      }
      res.rank = currentRank;
      rankCounter++;
    }
  });

  return result;
}

/**
 * Standalone API-shaped function — analyze a single student's performance.
 * Backend-equivalent: analyzeStudentPerformance(student_id)
 */
export function analyzeStudentPerformance(
  studentId: string,
  students: Student[],
  marks: Mark[]
): StudentPerformance | null {
  const all = calculatePerformance(students, marks);
  return all.find(p => p.student.id === studentId) || null;
}
