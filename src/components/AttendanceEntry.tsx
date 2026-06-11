import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck, CalendarDays, Loader2, Save, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { getStudents, getAttendanceByWeek, saveAttendance } from '../api/mockDb';
import {
  Student, Attendance, Month, MONTHS,
  Weekday, WEEKDAYS,
  AttendanceStatus, ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS,
} from '../types';
import { computeAttendanceStats } from '../utils/attendance';

/**
 * Attendance Entry page.
 *
 * Designed to mirror the existing Mark Entry structure (Select Month +
 * Select Week + table) so teachers feel at home. Attendance is stored in
 * its OWN bucket — marks, rankings, conversions, and insights are not
 * touched in any way by this page.
 */
export default function AttendanceEntry() {
  // Default to the current calendar month, Week 1.
  const [month, setMonth] = useState<Month>(() => MONTHS[new Date().getMonth()]);
  const [week, setWeek] = useState<number>(1);

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // attendance[studentId][weekday] = status | undefined
  const [attendance, setAttendance] = useState<
    Record<string, Partial<Record<Weekday, AttendanceStatus>>>
  >({});

  // Load students + existing attendance whenever (month, week) changes.
  useEffect(() => {
    (async () => {
      setLoading(true);
      setSaveMessage(null);
      setErrorMessage(null);
      try {
        const [studentsData, weekAttendance] = await Promise.all([
          getStudents(),
          getAttendanceByWeek(month, week),
        ]);
        setStudents(studentsData);

        // Seed the editable map from any existing saved data.
        const initial: Record<string, Partial<Record<Weekday, AttendanceStatus>>> = {};
        studentsData.forEach(s => { initial[s.id] = {}; });
        weekAttendance.forEach(rec => {
          if (!initial[rec.studentId]) initial[rec.studentId] = {};
          initial[rec.studentId][rec.weekday] = rec.status;
        });
        setAttendance(initial);
      } catch (e) {
        console.error(e);
        setErrorMessage('Failed to load attendance.');
      } finally {
        setLoading(false);
      }
    })();
  }, [month, week]);

  const setCell = (studentId: string, day: Weekday, value: AttendanceStatus | '') => {
    setAttendance(prev => {
      const next = { ...prev };
      const row = { ...(next[studentId] || {}) };
      if (value === '') delete row[day];
      else row[day] = value;
      next[studentId] = row;
      return next;
    });
  };

  // Quick per-student weekly stats for the right-most column.
  const perStudentStats = useMemo(() => {
    const out: Record<string, ReturnType<typeof computeAttendanceStats>> = {};
    for (const s of students) {
      const row = attendance[s.id] || {};
      const list: Attendance[] = WEEKDAYS
        .filter(d => row[d])
        .map(d => ({
          id: '',
          studentId: s.id,
          month,
          weekNumber: week,
          weekday: d,
          status: row[d] as AttendanceStatus,
        }));
      out[s.id] = computeAttendanceStats(list);
    }
    return out;
  }, [students, attendance, month, week]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    const records: Omit<Attendance, 'id'>[] = [];
    Object.entries(attendance).forEach(([studentId, row]) => {
      WEEKDAYS.forEach(day => {
        const status = row[day];
        if (status) {
          records.push({ studentId, month, weekNumber: week, weekday: day, status });
        }
      });
    });

    try {
      await saveAttendance(month, week, records);
      setSaveMessage(`Attendance saved for ${month} · Week ${week}.`);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save attendance.';
      setErrorMessage(
        msg.toLowerCase().includes('unauthorized')
          ? 'Unauthorized — only teachers can save attendance.'
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  // Style helper for each status pill in the dropdown background.
  const statusBg = (s?: AttendanceStatus) => {
    switch (s) {
      case 'P': return 'bg-green-50 border-green-200 text-green-700';
      case 'A': return 'bg-red-50 border-red-200 text-red-700';
      case 'L': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'ML': return 'bg-blue-50 border-blue-200 text-blue-700';
      default: return 'bg-white border-gray-300 text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <CalendarCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Attendance Entry</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Month: <span className="font-semibold text-emerald-700">{month}</span>
              <span className="mx-1.5 text-gray-300">·</span>
              Week: <span className="font-semibold text-emerald-700">Week {week}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              P = Present · A = Absent · L = Late · ML = Medical Leave
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="att-month" className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              Select Month
            </label>
            <select
              id="att-month"
              value={month}
              onChange={(e) => setMonth(e.target.value as Month)}
              className="border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm font-medium text-gray-800 min-w-[140px]"
            >
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="att-week" className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              Select Week
            </label>
            <select
              id="att-week"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm font-medium text-gray-800 min-w-[120px]"
            >
              {[1, 2, 3, 4].map(w => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-5 py-2 rounded-md font-medium transition h-[42px]"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Attendance
          </button>
        </div>
      </div>

      {/* Status messages */}
      {saveMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> {saveMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {errorMessage}
        </div>
      )}

      {/* Tip banner */}
      <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs px-3 py-2 rounded-md flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-emerald-500" />
        <span>
          <strong>Tip:</strong> attendance is saved per <em>(Month, Week)</em>.
          Switching either dropdown loads that bucket independently — saving Week 1
          will not affect Week 2 data.
        </span>
      </div>

      {/* Attendance table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b text-sm text-gray-600">
              <tr>
                <th className="px-6 py-3 font-semibold sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Student Name
                </th>
                {WEEKDAYS.map(d => (
                  <th key={d} className="px-3 py-3 font-semibold text-center w-28">{d}</th>
                ))}
                <th className="px-6 py-3 font-semibold text-right">Week %</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {loading ? (
                <tr>
                  <td colSpan={WEEKDAYS.length + 2} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading attendance…
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={WEEKDAYS.length + 2} className="px-6 py-12 text-center text-gray-500">
                    No students yet. Add students in the Students tab.
                  </td>
                </tr>
              ) : (
                students.map(student => {
                  const row = attendance[student.id] || {};
                  const stats = perStudentStats[student.id];
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="font-medium text-gray-900">{student.name}</div>
                        <div className="text-xs text-gray-500">
                          Roll: {student.rollNumber} · {student.className}-{student.section}
                        </div>
                      </td>

                      {WEEKDAYS.map(day => {
                        const value = row[day] || '';
                        return (
                          <td key={day} className="px-2 py-2 text-center">
                            <select
                              value={value}
                              onChange={(e) => setCell(student.id, day, e.target.value as AttendanceStatus | '')}
                              className={`w-20 text-center text-xs font-semibold border rounded-md py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 ${statusBg(value as AttendanceStatus | undefined)}`}
                              aria-label={`${student.name} ${day}`}
                            >
                              <option value="">—</option>
                              {ATTENDANCE_STATUSES.map(s => (
                                <option key={s} value={s}>
                                  {s} ({ATTENDANCE_STATUS_LABELS[s]})
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}

                      <td className="px-6 py-3 text-right">
                        {stats.hasData ? (
                          <div className="inline-flex flex-col items-end">
                            <span className={`font-bold text-base ${
                              stats.isLow ? 'text-red-600' : stats.percentage >= 90 ? 'text-emerald-600' : 'text-gray-700'
                            }`}>
                              {stats.percentage}%
                            </span>
                            <span className="text-[10px] text-gray-500">
                              P:{stats.presentDays + stats.lateDays} A:{stats.absentDays}
                              {stats.medicalLeaveDays > 0 && ` ML:${stats.medicalLeaveDays}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
