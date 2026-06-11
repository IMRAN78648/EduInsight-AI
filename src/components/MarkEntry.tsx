import { useState, useEffect } from 'react';
import {
  Save, CalendarDays, Loader2, CheckCircle2, ShieldAlert, KeyRound, X, BarChart3,
} from 'lucide-react';
import { getStudents, getMarksByWeek, saveMarks } from '../api/mockDb';
import {
  Student, Mark, SUBJECTS, Subject, MAX_WEEKLY_MARK, WEEKLY_RAW_MAX,
  Month, MONTHS,
} from '../types';
import { isPinUnlocked, markPinUnlocked, verifyAdminPin } from '../auth';
import StudentInsightSheet from './StudentInsightSheet';

export default function MarkEntry() {
  // NEW: Month selection now lives directly inside this page (no separate
  // routing step). Defaults to the current calendar month so teachers can
  // start typing immediately. Switching it just re-scopes the (week, month)
  // bucket used by the existing data layer — no logic was changed.
  const [activeMonth, setActiveMonth] = useState<Month>(
    () => MONTHS[new Date().getMonth()]
  );

  const [week, setWeek] = useState<number>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, number | null>>>({});
  const [prevMarks, setPrevMarks] = useState<Record<string, Record<string, number | null>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 🔐 Optional Admin PIN gate — required ONCE per session before any save.
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // 👁️ Live analytics drawer
  const [insightStudent, setInsightStudent] = useState<Student | null>(null);

  useEffect(() => {
    loadData();
    // Re-load whenever the week OR the active month changes so the table
    // reflects the right (week, month) bucket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, activeMonth]);

  const loadData = async () => {
    setLoading(true);
    setSaveMessage(null);
    try {
      const [studentsData, weekMarksData, prevWeekMarksData] = await Promise.all([
        getStudents(),
        getMarksByWeek(week, activeMonth),
        week > 1 ? getMarksByWeek(week - 1, activeMonth) : Promise.resolve([])
      ]);
      setStudents(studentsData);
      
      const marksMap: Record<string, Record<string, number | null>> = {};
      const prevMap: Record<string, Record<string, number | null>> = {};
      
      studentsData.forEach(student => {
        marksMap[student.id] = {};
        prevMap[student.id] = {};
        SUBJECTS.forEach(sub => {
          marksMap[student.id][sub] = null;
          prevMap[student.id][sub] = null;
        });
      });

      weekMarksData.forEach(mark => {
        if (marksMap[mark.studentId]) {
          marksMap[mark.studentId][mark.subject] = mark.marks;
        }
      });

      prevWeekMarksData.forEach(mark => {
        if (prevMap[mark.studentId]) {
          prevMap[mark.studentId][mark.subject] = mark.marks;
        }
      });

      setMarks(marksMap);
      setPrevMarks(prevMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (studentId: string, subject: Subject, value: string) => {
    const numericValue = value === '' ? null : Number(value);
    
    // Prevent invalid input
    if (numericValue !== null && (isNaN(numericValue) || numericValue < 0 || numericValue > MAX_WEEKLY_MARK)) return;

    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subject]: numericValue
      }
    }));
  };

  // Click handler — intercepts and asks for Admin PIN if not yet unlocked
  // this session. Otherwise, proceeds straight to save.
  const handleSaveClick = () => {
    if (!isPinUnlocked()) {
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
      return;
    }
    void doSave();
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyAdminPin(pinInput)) {
      setPinError('Incorrect PIN. Please try again.');
      return;
    }
    markPinUnlocked();
    setShowPinModal(false);
    setPinInput('');
    setPinError('');
    void doSave();
  };

  const doSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    const marksToSave: Omit<Mark, 'id'>[] = [];

    Object.entries(marks).forEach(([studentId, subjectMarks]) => {
      Object.entries(subjectMarks).forEach(([subject, markValue]) => {
        if (markValue !== null) {
          marksToSave.push({
            studentId,
            subject,
            weekNumber: week,
            marks: markValue,
            month: activeMonth,
          });
        }
      });
    });

    try {
      await saveMarks(week, activeMonth, marksToSave);
      setSaveMessage('Marks saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Error saving marks.';
      // Catch backend authorization rejection nicely.
      if (msg.toLowerCase().includes('unauthorized')) {
        setSaveMessage('Unauthorized access — only teachers can save marks.');
      } else {
        setSaveMessage('Error saving marks.');
      }
    } finally {
      setSaving(false);
    }
  };

  const calculateTotal = (studentId: string): number => {
    let total = 0;
    const studentMarks = marks[studentId] || {};
    Object.values(studentMarks).forEach(m => {
      if (m !== null) total += m;
    });
    return total;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <CalendarDays className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Weekly Marks Entry</h2>
            {/* Selected month displayed in the page header, per spec */}
            <p className="text-sm text-gray-600 mt-0.5">
              Month: <span className="font-semibold text-indigo-700">{activeMonth}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Each weekly test is out of <span className="font-semibold text-indigo-600">{MAX_WEEKLY_MARK}</span> marks
            </p>
          </div>
        </div>

        {/* NEW: Month + Week dropdowns side by side, followed by Save button */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="month-select"
              className="text-xs font-medium text-gray-600 uppercase tracking-wider"
            >
              Select Month
            </label>
            <select
              id="month-select"
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value as Month)}
              className="border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm font-medium text-gray-800 min-w-[140px]"
            >
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="week-select"
              className="text-xs font-medium text-gray-600 uppercase tracking-wider"
            >
              Select Week
            </label>
            <select
              id="week-select"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm font-medium text-gray-800 min-w-[120px]"
            >
              {[1, 2, 3, 4].map(w => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSaveClick}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2 rounded-md font-medium transition h-[42px]"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Marks
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          {saveMessage}
        </div>
      )}

      <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs px-3 py-2 rounded-md flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-500" />
        <span>
          <strong>Tip:</strong> click any student&rsquo;s name to open a live 4-week analytics panel
          showing their trend graph, subject strengths/weaknesses, and week-by-week breakdown.
        </span>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-gray-50 border-b text-sm text-gray-600">
              <tr>
                <th className="px-6 py-4 font-semibold sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Student Details
                </th>
                {SUBJECTS.map(subject => (
                  <th key={subject} className="px-4 py-4 font-semibold text-center w-24">
                    <div>{subject}</div>
                    <div className="text-[10px] font-normal text-gray-400 mt-0.5">/ {MAX_WEEKLY_MARK}</div>
                  </th>
                ))}
                <th className="px-6 py-4 font-bold text-indigo-700 text-right">
                  <div>Total</div>
                  <div className="text-[10px] font-normal text-indigo-400 mt-0.5">/ {WEEKLY_RAW_MAX}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {loading ? (
                <tr>
                  <td colSpan={SUBJECTS.length + 2} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading data for Week {week}...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={SUBJECTS.length + 2} className="px-6 py-12 text-center text-gray-500">
                    No students found. Please add students first.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const total = calculateTotal(student.id);
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50 group">
                      <td className="px-6 py-3 sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <button
                          type="button"
                          onClick={() => setInsightStudent(student)}
                          className="text-left w-full group/btn focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md -mx-1 px-1 py-0.5 transition-colors"
                          title="View live analytics for this student"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 group-hover/btn:text-indigo-700 underline-offset-2 group-hover/btn:underline transition-colors">
                              {student.name}
                            </span>
                            <BarChart3 className="w-3.5 h-3.5 text-gray-300 group-hover/btn:text-indigo-500 transition-colors" />
                          </div>
                          <div className="text-xs text-gray-500">
                            Roll: {student.rollNumber} • Class: {student.className}-{student.section}
                          </div>
                        </button>
                      </td>
                      
                      {SUBJECTS.map(subject => {
                        const currentMark = marks[student.id]?.[subject];
                        const prevMark = prevMarks[student.id]?.[subject];
                        let diffStr = '';
                        let diffClass = '';
                        
                        if (week > 1 && currentMark !== null && currentMark !== undefined && prevMark !== null && prevMark !== undefined) {
                          const diff = currentMark - prevMark;
                          if (diff > 0) {
                            diffStr = `+${diff}`;
                            diffClass = 'text-green-600';
                          } else if (diff < 0) {
                            diffStr = `${diff}`;
                            diffClass = 'text-red-600';
                          } else {
                            diffStr = '0';
                            diffClass = 'text-gray-400';
                          }
                        }

                        return (
                          <td key={subject} className="px-2 py-3 text-center align-top pt-4 relative">
                            <input
                              type="number"
                              min="0"
                              max={MAX_WEEKLY_MARK}
                              value={currentMark ?? ''}
                              onChange={(e) => handleMarkChange(student.id, subject, e.target.value)}
                              className="w-16 text-center border rounded-md px-1 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none hover:border-indigo-300 transition-colors"
                              placeholder="-"
                            />
                            {diffStr && (
                              <div className={`text-[10px] font-medium absolute bottom-0.5 left-0 right-0 text-center ${diffClass}`}>
                                {diffStr}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      
                      <td className="px-6 py-3 text-right">
                        <div className="inline-block bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-md min-w-[3rem] text-center">
                          {total}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 👁️ Live per-student insights drawer */}
      {insightStudent && (
        <StudentInsightSheet
          student={insightStudent}
          draftMarksThisWeek={marks[insightStudent.id]}
          draftWeek={week}
          onClose={() => setInsightStudent(null)}
        />
      )}

      {/* 🔐 Optional Admin PIN confirmation modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-gray-200">
            <div className="flex items-start justify-between p-5 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Confirm Admin PIN</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Required before editing or saving marks.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePinSubmit} className="p-5 space-y-4">
              <div>
                <label htmlFor="adminPin" className="block text-sm font-medium text-gray-700 mb-1">
                  Admin PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="adminPin"
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      if (pinError) setPinError('');
                    }}
                    className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none tracking-widest"
                    placeholder="••••"
                    maxLength={6}
                  />
                </div>
                {pinError && (
                  <p className="mt-2 text-sm text-red-600">{pinError}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Demo PIN: <code className="font-mono">1234</code>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!pinInput}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-md"
                >
                  Confirm &amp; Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
