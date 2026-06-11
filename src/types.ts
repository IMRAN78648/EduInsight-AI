export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  className: string;
  section: string;
  parentMobile?: string;
}

export interface Mark {
  id: string;
  studentId: string;
  subject: string;
  weekNumber: number;
  marks: number | null;
  /**
   * Month bucket for this mark entry (e.g. "January").
   * Optional for backward compatibility with marks created before
   * the month-selection feature was added; legacy records are
   * migrated to `DEFAULT_MONTH` at app startup.
   */
  month?: string;
}

// ---------- Month Selection Constants ----------
// Used by the new Month Selection page (between Teacher Dashboard
// and Weekly Mark Entry) and the parent dashboard month filter.
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type Month = typeof MONTHS[number];

// Legacy marks (created before the month feature) are migrated to this month
// so they remain visible and don't break existing analytics.
export const DEFAULT_MONTH: Month = 'January';

// ---------- Attendance Module ----------
// Attendance is captured per (student, month, week, weekday) and stored
// separately from marks so the existing marks pipeline is never affected.
export const ATTENDANCE_STATUSES = ['P', 'A', 'L', 'ML'] as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  ML: 'Medical Leave',
};

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type Weekday = typeof WEEKDAYS[number];

export interface Attendance {
  id: string;
  studentId: string;
  month: Month;
  weekNumber: number;     // 1..4 (same scope as marks)
  weekday: Weekday;       // Monday..Friday
  status: AttendanceStatus;
}

// Threshold used across teacher + parent dashboards for the "low attendance"
// warning. Exported so the rule is defined in exactly one place.
export const ATTENDANCE_LOW_THRESHOLD = 75;

export const SUBJECTS = [
  'Tamil',
  'English',
  'Maths',
  'Physics',
  'Chemistry',
  'Computer Science',
] as const;

export type Subject = typeof SUBJECTS[number];

// ---------- School Marking System Constants ----------
// Each weekly test is conducted out of 35 marks.
// 4 weeks per subject => raw subject total out of 140.
// Each subject is then converted to a final mark out of 100.
// Final overall total is out of (SUBJECTS.length * 100) = 600.
export const MAX_WEEKLY_MARK = 35;
export const WEEKS_COUNT = 4;
export const SUBJECT_RAW_MAX = MAX_WEEKLY_MARK * WEEKS_COUNT; // 140
export const SUBJECT_FINAL_MAX = 100;
export const OVERALL_MAX = SUBJECTS.length * SUBJECT_FINAL_MAX; // 600
export const WEEKLY_RAW_MAX = SUBJECTS.length * MAX_WEEKLY_MARK; // 210
