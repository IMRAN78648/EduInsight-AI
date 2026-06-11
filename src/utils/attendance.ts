import { Attendance, AttendanceStatus, ATTENDANCE_LOW_THRESHOLD } from '../types';

export interface AttendanceStats {
  totalDays: number;       // total working-day records found
  presentDays: number;     // P + L (late still counts as present-in-class)
  absentDays: number;      // A only
  lateDays: number;
  medicalLeaveDays: number;
  percentage: number;      // (presentDays / totalDays) * 100, one decimal
  isLow: boolean;          // percentage < ATTENDANCE_LOW_THRESHOLD
  hasData: boolean;        // false when no records at all
}

const EMPTY_STATS: AttendanceStats = {
  totalDays: 0,
  presentDays: 0,
  absentDays: 0,
  lateDays: 0,
  medicalLeaveDays: 0,
  percentage: 0,
  isLow: false,
  hasData: false,
};

/**
 * Compute attendance stats for an arbitrary slice of records.
 * Late (L) is treated as "present" for percentage purposes — the student
 * was physically in class. Medical Leave (ML) is excluded from BOTH the
 * numerator and denominator (it's an authorised absence, not a working day).
 */
export function computeAttendanceStats(records: Attendance[]): AttendanceStats {
  if (records.length === 0) return EMPTY_STATS;

  let present = 0;
  let absent = 0;
  let late = 0;
  let medical = 0;

  for (const r of records) {
    const status: AttendanceStatus = r.status;
    if (status === 'P') present++;
    else if (status === 'A') absent++;
    else if (status === 'L') late++;
    else if (status === 'ML') medical++;
  }

  // ML doesn't count as a working day, per spec interpretation.
  const totalDays = present + absent + late;
  const presentDays = present + late;
  const percentage = totalDays > 0 ? +((presentDays / totalDays) * 100).toFixed(1) : 0;

  return {
    totalDays,
    presentDays,
    absentDays: absent,
    lateDays: late,
    medicalLeaveDays: medical,
    percentage,
    isLow: totalDays > 0 && percentage < ATTENDANCE_LOW_THRESHOLD,
    hasData: true,
  };
}

/**
 * Compute attendance stats for a single student, optionally scoped to a month.
 */
export function computeStudentAttendance(
  studentId: string,
  allAttendance: Attendance[],
  month?: string,
): AttendanceStats {
  const filtered = allAttendance.filter(a => {
    if (a.studentId !== studentId) return false;
    if (month && a.month !== month) return false;
    return true;
  });
  return computeAttendanceStats(filtered);
}

/**
 * Generate one or two short, parent-friendly attendance remarks that can be
 * appended to the existing AI insights without modifying the marks engine.
 */
export function buildAttendanceRemarks(
  stats: AttendanceStats,
  hasMarksTrendDeclining: boolean,
): string[] {
  if (!stats.hasData) return [];
  const remarks: string[] = [];
  if (stats.percentage >= 95) {
    remarks.push(`Excellent attendance (${stats.percentage}%).`);
  } else if (stats.percentage >= 85) {
    remarks.push(`Good attendance (${stats.percentage}%).`);
  } else if (stats.percentage >= ATTENDANCE_LOW_THRESHOLD) {
    remarks.push(`Attendance is satisfactory (${stats.percentage}%) but can be improved.`);
  } else {
    remarks.push(`Attendance needs improvement (${stats.percentage}%).`);
  }
  if (stats.isLow && hasMarksTrendDeclining) {
    remarks.push('Attendance may be affecting academic performance.');
  }
  return remarks;
}
