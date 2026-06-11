import { Student, Mark, DEFAULT_MONTH, Attendance } from '../types';
import { requireTeacher } from '../auth';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Helper to init storage
const initStorage = () => {
  if (!localStorage.getItem('spt_students')) {
    localStorage.setItem('spt_students', JSON.stringify([
      { id: '1', name: 'Arun Kumar', rollNumber: '101', className: '12', section: 'A', parentMobile: '9876543210' },
      { id: '2', name: 'Bala Murugan', rollNumber: '102', className: '12', section: 'A', parentMobile: '9876543211' },
      { id: '3', name: 'Chitra Devi', rollNumber: '103', className: '12', section: 'B', parentMobile: '9876543212' },
    ]));
  }
  if (!localStorage.getItem('spt_marks')) {
    localStorage.setItem('spt_marks', JSON.stringify([]));
  }
  // NEW: attendance storage bucket (kept separate from marks).
  if (!localStorage.getItem('spt_attendance')) {
    localStorage.setItem('spt_attendance', JSON.stringify([]));
  }

  // One-time migration: any existing marks without a `month` field are
  // bucketed into DEFAULT_MONTH so they remain visible and aggregations
  // still work after the month-selection feature was introduced.
  try {
    const raw = localStorage.getItem('spt_marks');
    if (raw) {
      const marks: Mark[] = JSON.parse(raw);
      let migrated = false;
      const updated = marks.map(m => {
        if (!m.month) {
          migrated = true;
          return { ...m, month: DEFAULT_MONTH };
        }
        return m;
      });
      if (migrated) {
        localStorage.setItem('spt_marks', JSON.stringify(updated));
      }
    }
  } catch {
    // ignore malformed storage — handled by downstream reads
  }
};

initStorage();

export const getStudents = async (): Promise<Student[]> => {
  await delay(300);
  return JSON.parse(localStorage.getItem('spt_students') || '[]');
};

export const addStudent = async (student: Omit<Student, 'id'>): Promise<Student> => {
  // 🔒 Backend security check (role-based access control).
  requireTeacher();
  await delay(300);
  const students: Student[] = JSON.parse(localStorage.getItem('spt_students') || '[]');
  const newStudent: Student = { ...student, id: Date.now().toString() };
  students.push(newStudent);
  localStorage.setItem('spt_students', JSON.stringify(students));
  return newStudent;
};

export const deleteStudent = async (id: string): Promise<void> => {
  // 🔒 Backend security check (role-based access control).
  requireTeacher();
  await delay(200);
  const students: Student[] = JSON.parse(localStorage.getItem('spt_students') || '[]');
  const filtered = students.filter(s => s.id !== id);
  localStorage.setItem('spt_students', JSON.stringify(filtered));

  const marks: Mark[] = JSON.parse(localStorage.getItem('spt_marks') || '[]');
  const filteredMarks = marks.filter(m => m.studentId !== id);
  localStorage.setItem('spt_marks', JSON.stringify(filteredMarks));

  // Also clean up any attendance records belonging to this student so
  // the storage stays consistent. (Read-only side-effect of delete.)
  const attendance: Attendance[] = JSON.parse(localStorage.getItem('spt_attendance') || '[]');
  const filteredAttendance = attendance.filter(a => a.studentId !== id);
  localStorage.setItem('spt_attendance', JSON.stringify(filteredAttendance));
};

export const parentLogin = async (rollNumber: string, mobileNumber: string): Promise<Student | null> => {
  await delay(500);
  const students: Student[] = JSON.parse(localStorage.getItem('spt_students') || '[]');
  // MOCK: If parentMobile isn't set for the student, we just check rollNumber to make it easier to test
  // In a real scenario, both must match exactly.
  const student = students.find(s => s.rollNumber === rollNumber && (!s.parentMobile || s.parentMobile === mobileNumber));
  return student || null;
};

export const getAllMarks = async (): Promise<Mark[]> => {
  await delay(300);
  return JSON.parse(localStorage.getItem('spt_marks') || '[]');
};

/**
 * Fetch marks for a given week.
 * If `month` is supplied, results are additionally scoped to that month.
 * Calling without `month` returns marks across ALL months (legacy callers
 * keep working unchanged).
 */
export const getMarksByWeek = async (
  weekNumber: number,
  month?: string
): Promise<Mark[]> => {
  await delay(300);
  const marks: Mark[] = JSON.parse(localStorage.getItem('spt_marks') || '[]');
  return marks.filter(m => {
    if (m.weekNumber !== weekNumber) return false;
    if (month && m.month !== month) return false;
    return true;
  });
};

/**
 * Save marks for a specific week (and optionally a specific month).
 *
 * When `month` is supplied, ONLY records matching the (week, month) pair
 * are replaced — so saving January / Week 1 will NOT wipe February / Week 1.
 *
 * When `month` is omitted, the legacy behaviour is preserved (replace all
 * records for the given week regardless of month). This keeps any external
 * callers compatible.
 */
export const saveMarks = async (
  week: number,
  newMarksOrMonth: string | Omit<Mark, 'id'>[],
  maybeNewMarks?: Omit<Mark, 'id'>[]
): Promise<void> => {
  // 🔒 Backend security check — only teachers can add/edit/delete marks.
  requireTeacher();
  await delay(500);

  // Normalise arguments to support both call signatures:
  //   saveMarks(week, marks)                  // legacy
  //   saveMarks(week, month, marks)           // new month-aware
  let month: string | undefined;
  let newMarks: Omit<Mark, 'id'>[];
  if (typeof newMarksOrMonth === 'string') {
    month = newMarksOrMonth;
    newMarks = maybeNewMarks || [];
  } else {
    newMarks = newMarksOrMonth;
  }

  const marks: Mark[] = JSON.parse(localStorage.getItem('spt_marks') || '[]');

  // Remove records being replaced. Scope the replacement to the
  // (week, month) pair when a month is provided.
  const otherMarks = marks.filter(m => {
    if (m.weekNumber !== week) return true;
    if (month && m.month !== month) return true;
    return false;
  });

  // Ensure every new mark carries a month so the data stays consistent.
  const toAdd = newMarks.map(nm => ({
    ...nm,
    month: nm.month || month || DEFAULT_MONTH,
    id: Date.now().toString() + Math.random().toString(),
  }));

  localStorage.setItem('spt_marks', JSON.stringify([...otherMarks, ...toAdd]));
};

// =====================================================================
// ATTENDANCE APIs (separate storage bucket from marks)
// =====================================================================

/**
 * Fetch ALL attendance records. Used by the parent dashboard + teacher
 * analytics to compute attendance percentages across all data.
 */
export const getAllAttendance = async (): Promise<Attendance[]> => {
  await delay(200);
  return JSON.parse(localStorage.getItem('spt_attendance') || '[]');
};

/**
 * Fetch attendance records for a specific (month, week) bucket so the
 * Attendance Entry page can load just what it needs.
 */
export const getAttendanceByWeek = async (
  month: string,
  weekNumber: number,
): Promise<Attendance[]> => {
  await delay(200);
  const all: Attendance[] = JSON.parse(localStorage.getItem('spt_attendance') || '[]');
  return all.filter(a => a.month === month && a.weekNumber === weekNumber);
};

/**
 * Save attendance for a specific (month, week) bucket.
 *
 * Replaces ALL existing records for that exact (month, week) pair, so the
 * teacher's latest entry is always authoritative for that week. Other
 * months/weeks are untouched.
 *
 * Protected by `requireTeacher()` — parents cannot write attendance.
 */
export const saveAttendance = async (
  month: string,
  weekNumber: number,
  records: Omit<Attendance, 'id'>[],
): Promise<void> => {
  requireTeacher();
  await delay(400);

  const all: Attendance[] = JSON.parse(localStorage.getItem('spt_attendance') || '[]');

  // Drop existing entries for this bucket so we don't accumulate duplicates.
  const others = all.filter(a => !(a.month === month && a.weekNumber === weekNumber));

  const toAdd: Attendance[] = records.map(r => ({
    ...r,
    id: Date.now().toString() + Math.random().toString(),
  }));

  localStorage.setItem('spt_attendance', JSON.stringify([...others, ...toAdd]));
};
