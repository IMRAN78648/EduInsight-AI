import { useEffect, useMemo, useState } from 'react';
import { getStudents, getAllMarks, getAllAttendance } from '../api/mockDb';
import { calculatePerformance, StudentPerformance } from '../utils/performance';
import {
  Student, SUBJECTS, Mark, OVERALL_MAX, WEEKLY_RAW_MAX,
  MONTHS, Month, DEFAULT_MONTH,
  Attendance, ATTENDANCE_LOW_THRESHOLD,
} from '../types';
import {
  computeStudentAttendance, AttendanceStats, buildAttendanceRemarks,
} from '../utils/attendance';
import {
  Trophy, TrendingUp, TrendingDown, Minus, AlertCircle,
  BookOpen, Brain, Star, ChevronDown, ChevronUp, CalendarDays, CalendarCheck,
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

interface ParentDashboardProps {
  student: Student;
  onLogout: () => void;
}

export default function ParentDashboard({ student, onLogout }: ParentDashboardProps) {
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allRawMarks, setAllRawMarks] = useState<Mark[]>([]);
  // Attendance kept in its OWN state — separate from marks pipeline.
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(4);
  const [loading, setLoading] = useState(true);

  // NEW: month filter (defaults to the latest month with data for this child).
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);

  // 1. Load students + ALL marks + attendance once. We then recompute per-month
  //    views in useMemo below so switching months is instant and never re-fetches.
  useEffect(() => {
    async function loadData() {
      const [studentsData, marksData, attendanceData] = await Promise.all([
        getStudents(),
        getAllMarks(),
        getAllAttendance(),
      ]);
      setAllStudents(studentsData);
      setAllRawMarks(marksData);
      setAllAttendance(attendanceData);
      setLoading(false);
    }
    loadData();
  }, [student.id]);

  // 2. Figure out which months actually have marks for THIS student
  //    so the dropdown only shows useful options.
  const monthsWithData = useMemo<Month[]>(() => {
    const mySet = new Set<string>();
    for (const m of allRawMarks) {
      if (m.studentId === student.id && m.month && m.marks !== null) {
        mySet.add(m.month);
      }
    }
    // Preserve calendar order
    return MONTHS.filter(m => mySet.has(m));
  }, [allRawMarks, student.id]);

  // 3. Default the dropdown to the LATEST month with data (calendar order).
  //    Falls back to DEFAULT_MONTH if the child has no data yet.
  useEffect(() => {
    if (selectedMonth !== null) return;
    if (monthsWithData.length > 0) {
      setSelectedMonth(monthsWithData[monthsWithData.length - 1]);
    } else {
      setSelectedMonth(DEFAULT_MONTH);
    }
  }, [monthsWithData, selectedMonth]);

  // 4. Build a per-month marks slice. Filtering BEFORE the engine means
  //    rank / percentage / insights / topper are all naturally scoped to
  //    the selected month — no changes to the calculation logic required.
  const performance = useMemo<StudentPerformance | null>(() => {
    if (!selectedMonth || allStudents.length === 0) return null;
    const monthMarks = allRawMarks.filter(m => (m.month || DEFAULT_MONTH) === selectedMonth);
    const all = calculatePerformance(allStudents, monthMarks);
    return all.find(p => p.student.id === student.id) || null;
  }, [allRawMarks, allStudents, selectedMonth, student.id]);

  const topper = useMemo<StudentPerformance | null>(() => {
    if (!selectedMonth || allStudents.length === 0) return null;
    const monthMarks = allRawMarks.filter(m => (m.month || DEFAULT_MONTH) === selectedMonth);
    const all = calculatePerformance(allStudents, monthMarks);
    return all.find(p => p.rank === 1 && p.hasEntries) || null;
  }, [allRawMarks, allStudents, selectedMonth]);

  // Marks (raw entries) for this student, scoped to the selected month —
  // used by the week-by-week breakdown and bar chart below.
  const allMarks = useMemo<Mark[]>(() => {
    if (!selectedMonth) return [];
    return allRawMarks.filter(m => (m.month || DEFAULT_MONTH) === selectedMonth);
  }, [allRawMarks, selectedMonth]);

  // Attendance stats for THIS student, scoped to the currently-viewed month.
  // Computed separately so attendance never affects marks/ranks/insights.
  const attendanceStats: AttendanceStats = useMemo(() => {
    if (!selectedMonth) {
      return { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0,
        medicalLeaveDays: 0, percentage: 0, isLow: false, hasData: false };
    }
    return computeStudentAttendance(student.id, allAttendance, selectedMonth);
  }, [allAttendance, selectedMonth, student.id]);

  // Lightweight attendance remarks appended after AI insights (additive only).
  const attendanceRemarks = useMemo(() => {
    return buildAttendanceRemarks(
      attendanceStats,
      performance?.trend === 'Declining',
    );
  }, [attendanceStats, performance?.trend]);

  if (loading || !performance || !selectedMonth) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // ---- CORRECTED MARKS CALCULATION ----
  // performance.totalMarks is already the sum of each subject's converted /100 mark,
  // so it is naturally out of OVERALL_MAX (600). The percentage is also pre-computed
  // by the engine against /600. We do NOT recompute against weekly raw totals here.
  const activeWeeksCount = Object.values(performance.weeklyTotals).filter(v => v > 0).length || 1;
  const maxPossibleMarks = OVERALL_MAX;            // always 600 — independent of active weeks
  const percentage = performance.percentage.toFixed(1);

  // Visual Analytics Data
  const lineChartData = [1, 2, 3, 4].map(w => ({
    week: `Week ${w}`,
    marks: performance.weeklyTotals[w] || 0
  }));

  // ---- Final Subject Scores (out of 100) ----
  // Uses ALL FOUR WEEKS of the selected month, not just the latest week.
  // Math: subject_total = W1+W2+W3+W4 (out of 140) → (total/140)*100 rounded.
  // The engine has already computed this in `subjectAnalyses[*].finalMark`
  // for the active month's marks slice, so we just read it here.
  const barChartData = SUBJECTS.map(sub => {
    const analysis = performance.subjectAnalyses.find(s => s.subject === sub);
    return {
      subject: sub.substring(0, 3),        // short label used on the X-axis
      fullName: sub,                       // full name used inside the tooltip
      marks: analysis?.finalMark ?? 0,     // already rounded /100 score
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-indigo-600 text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <h1 className="font-bold text-lg">Parent Portal</h1>
          </div>
          <button
            onClick={onLogout}
            className="text-indigo-100 hover:text-white text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6 mt-4">

        {/* NEW: Month filter — affects ALL sections below (marks, %, rank, insights). */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Viewing month</p>
              <p className="text-sm text-gray-700">
                Switch months to see your child's marks, rank and insights for that month.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="month-filter" className="text-sm font-medium text-gray-700">
              Month:
            </label>
            <select
              id="month-filter"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value as Month)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {MONTHS.map((m) => {
                const has = monthsWithData.includes(m);
                return (
                  <option key={m} value={m}>
                    {m}{has ? '' : ' (no data)'}
                  </option>
                );
              })}
            </select>
          </div>
        </section>

        {/* Empty state when chosen month has no data yet */}
        {!performance.hasEntries && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">No marks recorded for {selectedMonth} yet.</p>
              <p className="mt-0.5 text-amber-700">
                Pick a different month from the dropdown above to view available results.
              </p>
            </div>
          </section>
        )}

        {/* SECTION 1: CHILD PERFORMANCE (TOP PRIORITY) */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy className="w-32 h-32" />
          </div>
          
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-gray-900">{student.name}</h2>
            <p className="text-gray-500">Class {student.className} • Section {student.section}</p>
            <p className="text-xs text-indigo-600 font-semibold mt-1 mb-5 inline-flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              Showing data for {selectedMonth}
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="bg-indigo-50 p-4 rounded-xl">
                <p className="text-indigo-600 text-sm font-semibold mb-1">Total Marks</p>
                <p className="text-3xl font-bold text-indigo-900">{performance.totalMarks}</p>
                <p className="text-xs text-indigo-500 mt-1">out of {maxPossibleMarks}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-blue-600 text-sm font-semibold mb-1">Percentage</p>
                <p className="text-3xl font-bold text-blue-900">{percentage}%</p>
              </div>

              <div className="bg-yellow-50 p-4 rounded-xl col-span-2 sm:col-span-2 flex items-center justify-between">
                <div>
                  <p className="text-yellow-700 text-sm font-semibold mb-1">Class Rank</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-yellow-900">#{performance.rank || '-'}</p>
                  </div>
                </div>
                <Trophy className="w-10 h-10 text-yellow-500" />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: ALERTS */}
        {performance.insights.alerts.length > 0 && (
          <section className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0" />
            <div>
              <h3 className="text-orange-800 font-semibold">Attention</h3>
              <ul className="text-orange-700 text-sm mt-1 list-disc list-inside">
                {performance.insights.alerts.map((alert, idx) => (
                  <li key={idx}>{alert}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* NEW: Attendance Card (additive — does not affect marks/rank/insights engine) */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-500" />
              Attendance · {selectedMonth}
            </h3>
            {attendanceStats.hasData && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  attendanceStats.isLow
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : attendanceStats.percentage >= 90
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}
              >
                {attendanceStats.percentage}%
              </span>
            )}
          </div>

          {!attendanceStats.hasData ? (
            <p className="text-sm text-gray-500">
              No attendance records yet for {selectedMonth}.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 p-3 rounded-xl text-center">
                  <p className="text-xs text-green-700 font-semibold mb-0.5">Present Days</p>
                  <p className="text-2xl font-bold text-green-800">
                    {attendanceStats.presentDays}
                  </p>
                  {attendanceStats.lateDays > 0 && (
                    <p className="text-[10px] text-green-600">incl. {attendanceStats.lateDays} late</p>
                  )}
                </div>
                <div className="bg-red-50 p-3 rounded-xl text-center">
                  <p className="text-xs text-red-700 font-semibold mb-0.5">Absent Days</p>
                  <p className="text-2xl font-bold text-red-800">
                    {attendanceStats.absentDays}
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl text-center">
                  <p className="text-xs text-blue-700 font-semibold mb-0.5">Attendance %</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {attendanceStats.percentage}%
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    attendanceStats.isLow
                      ? 'bg-red-500'
                      : attendanceStats.percentage >= 90
                        ? 'bg-emerald-500'
                        : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.min(100, attendanceStats.percentage)}%` }}
                />
              </div>

              {attendanceStats.medicalLeaveDays > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Plus {attendanceStats.medicalLeaveDays} medical-leave day{attendanceStats.medicalLeaveDays === 1 ? '' : 's'} (not counted toward total working days).
                </p>
              )}

              {attendanceStats.isLow && (
                <div className="mt-4 bg-red-50 border-l-4 border-red-500 px-3 py-2 rounded-r-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">
                    <span className="font-bold">⚠ Low Attendance Alert</span> — below the {ATTENDANCE_LOW_THRESHOLD}% expected threshold.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* SECTION 3: TOPPER COMPARISON */}
        {topper && topper.student.id !== student.id && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full flex-shrink-0">
              <Star className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Topper Comparison</h3>
              <p className="text-gray-900 font-medium mt-1">
                {student.name} scored <span className="font-bold text-indigo-600">{performance.totalMarks} / {OVERALL_MAX}</span>,
                Class Topper scored <span className="font-bold text-green-600">{topper.totalMarks} / {OVERALL_MAX}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Difference: {Math.max(0, topper.totalMarks - performance.totalMarks)} marks
                {topper.totalMarks > 0 && (
                  <span className="ml-1">
                    ({(((topper.totalMarks - performance.totalMarks) / OVERALL_MAX) * 100).toFixed(1)}%)
                  </span>
                )}
              </p>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SECTION 4: SUBJECT PERFORMANCE */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-500" />
              Subject Performance
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-green-800 font-medium">Strongest Subject</span>
                <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-bold">
                  {performance.strongestSubject !== 'N/A' ? performance.strongestSubject : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="text-red-800 font-medium">Needs Improvement</span>
                <span className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
                  {performance.weakestSubject !== 'N/A' ? performance.weakestSubject : '-'}
                </span>
              </div>
            </div>
          </section>

          {/* SECTION 6: AI INSIGHTS */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              AI Insights
            </h3>
            <ul className="space-y-3">
              {(performance.insights.remarks.length > 0 || attendanceRemarks.length > 0) ? (
                <>
                  {performance.insights.remarks.map((remark, idx) => (
                    <li key={`acad-${idx}`} className="flex items-start gap-2 text-gray-700 text-sm">
                      <span className="text-indigo-500 mt-1">•</span>
                      {remark}
                    </li>
                  ))}
                  {/* Attendance-derived remarks appended without altering the AI engine. */}
                  {attendanceRemarks.map((remark, idx) => (
                    <li key={`att-${idx}`} className="flex items-start gap-2 text-gray-700 text-sm">
                      <span className="text-emerald-500 mt-1">•</span>
                      {remark}
                    </li>
                  ))}
                </>
              ) : (
                <li className="text-gray-500 text-sm">Not enough data for insights yet.</li>
              )}
            </ul>
          </section>
        </div>

        {/* SECTION 5: VISUAL ANALYTICS */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Performance Trends</h3>
          
          <div className="space-y-8">
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-4 text-center">
                Weekly Raw Total Marks <span className="text-gray-400">(each week out of {WEEKLY_RAW_MAX})</span>
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, WEEKLY_RAW_MAX]} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="marks" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-6 border-t">
              <h4 className="text-sm font-semibold text-gray-500 mb-4 text-center">
                Final Subject Scores <span className="text-gray-400">(out of 100)</span>
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="subject" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f3f4f6' }}
                      // Show "Final Monthly Score: X / 100" with the full subject name
                      formatter={(v) => [`${v} / 100`, 'Final Monthly Score']}
                      labelFormatter={(_label, payload) => {
                        const entry = payload && payload[0] ? (payload[0].payload as { fullName?: string }) : undefined;
                        return entry?.fullName || '';
                      }}
                    />
                    <Bar
                      dataKey="marks"
                      fill="#818cf8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: WEEK-WISE MARKS */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Detailed Week-wise Marks</h3>
            <p className="text-sm text-gray-500">Click a week to see subject details</p>
          </div>
          
          <div className="divide-y divide-gray-100">
            {[4, 3, 2, 1].map((weekNum) => {
              const weekMarks = allMarks.filter(m => m.studentId === student.id && m.weekNumber === weekNum);
              const prevWeekMarks = allMarks.filter(m => m.studentId === student.id && m.weekNumber === weekNum - 1);
              
              const hasMarks = weekMarks.some(m => m.marks !== null);
              if (!hasMarks && weekNum > activeWeeksCount) return null; // Hide future weeks

              const isExpanded = expandedWeek === weekNum;

              return (
                <div key={weekNum} className="bg-white">
                  <button
                    onClick={() => setExpandedWeek(isExpanded ? null : weekNum)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-indigo-100 text-indigo-700 w-10 h-10 rounded-lg flex items-center justify-center font-bold">
                        W{weekNum}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">Week {weekNum}</p>
                        <p className="text-sm text-gray-500">
                          Raw Total: {performance.weeklyTotals[weekNum] || 0} / {WEEKLY_RAW_MAX}
                          <span className="text-gray-400"> &nbsp;(each subject /35)</span>
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {SUBJECTS.map(sub => {
                          const markEntry = weekMarks.find(m => m.subject === sub);
                          const prevEntry = prevWeekMarks.find(m => m.subject === sub);
                          const mark = markEntry?.marks;
                          const prevMark = prevEntry?.marks;
                          
                          let diff = null;
                          if (mark !== undefined && mark !== null && prevMark !== undefined && prevMark !== null) {
                            diff = mark - prevMark;
                          }

                          return (
                            <div key={sub} className="bg-white p-3 rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 truncate mb-1">{sub}</p>
                              <div className="flex items-end justify-between">
                                <p className="text-lg font-bold text-gray-900">
                                  {mark !== null && mark !== undefined ? mark : '-'}
                                  <span className="text-xs font-medium text-gray-400"> / 35</span>
                                </p>
                                {diff !== null && diff !== 0 && (
                                  <div className={`flex items-center text-xs font-medium ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {diff > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                                    {Math.abs(diff)}
                                  </div>
                                )}
                                {diff === 0 && (
                                  <div className="flex items-center text-xs font-medium text-gray-400">
                                    <Minus className="w-3 h-3 mr-0.5" /> 0
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}