import { useEffect, useState } from 'react';
import {
  X, Award, TrendingUp, TrendingDown, Minus, Sparkles,
  ChevronDown, ChevronUp, Trophy, AlertTriangle,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { getAllMarks, getStudents } from '../api/mockDb';
import {
  Student, Mark, SUBJECTS, MAX_WEEKLY_MARK, WEEKLY_RAW_MAX, OVERALL_MAX,
} from '../types';
import { calculatePerformance, StudentPerformance } from '../utils/performance';

interface StudentInsightSheetProps {
  student: Student;
  /**
   * Optional unsaved/in-progress marks for the currently selected week
   * (subject → mark). Lets the drawer preview live data the teacher is
   * still typing in MarkEntry, before clicking Save.
   */
  draftMarksThisWeek?: Record<string, number | null>;
  draftWeek?: number;
  onClose: () => void;
}

export default function StudentInsightSheet({
  student,
  draftMarksThisWeek,
  draftWeek,
  onClose,
}: StudentInsightSheetProps) {
  const [perf, setPerf] = useState<StudentPerformance | null>(null);
  const [rawMarks, setRawMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  // Load + recompute analytics whenever the selected student changes
  // OR the teacher's draft marks change.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [students, savedMarks] = await Promise.all([
        getStudents(),
        getAllMarks(),
      ]);
      if (!active) return;

      // Build the marks list used for analytics: saved marks +
      // overlay this student's in-progress draft marks for the active week.
      let marksForAnalytics: Mark[] = savedMarks;
      if (draftMarksThisWeek && draftWeek) {
        // Remove the saved marks for this student/week so the draft replaces them
        marksForAnalytics = savedMarks.filter(
          m => !(m.studentId === student.id && m.weekNumber === draftWeek)
        );
        Object.entries(draftMarksThisWeek).forEach(([subject, value]) => {
          if (value !== null && value !== undefined) {
            marksForAnalytics.push({
              id: `draft-${subject}`,
              studentId: student.id,
              subject,
              weekNumber: draftWeek,
              marks: value,
            });
          }
        });
      }

      const all = calculatePerformance(students, marksForAnalytics);
      const me = all.find(p => p.student.id === student.id) || null;
      setPerf(me);
      setRawMarks(marksForAnalytics.filter(m => m.studentId === student.id));

      // Auto-expand the most recent active week so teachers see fresh data first
      if (me) {
        for (let w = 4; w >= 1; w--) {
          if (me.weeklyTotals[w] > 0) {
            setExpandedWeek(w);
            break;
          }
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [student.id, draftMarksThisWeek, draftWeek]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Helpers ----------------------------------------------------------
  const trendIcon = (t?: string) => {
    switch (t) {
      case 'Improving': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'Declining': return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'Stable': return <Minus className="w-4 h-4 text-gray-500" />;
      case 'Fluctuating': return <TrendingUp className="w-4 h-4 text-amber-500 rotate-45" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const statusColor = (s?: string) => {
    switch (s) {
      case 'Good': return 'bg-green-100 text-green-800';
      case 'Average': return 'bg-yellow-100 text-yellow-800';
      case 'Needs Improvement': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Chart data -------------------------------------------------------
  const weeklyLineData = perf
    ? [1, 2, 3, 4].map(w => ({
        name: `W${w}`,
        marks: perf.weeklyTotals[w] || 0,
        recorded: perf.weeklyTotals[w] > 0,
      }))
    : [];

  // Final subject marks (out of 100) – the *clearest* read on strengths/weaknesses
  const subjectFinalData = perf
    ? SUBJECTS.map(sub => {
        const a = perf.subjectAnalyses.find(s => s.subject === sub);
        return {
          subject: sub,
          short: sub.length > 8 ? sub.slice(0, 7) + '…' : sub,
          mark: a?.finalMark ?? 0,
          weeksRecorded: a?.weeksRecorded ?? 0,
        };
      })
    : [];

  // Subject color helper: green ≥ 75, amber 50–74, red < 50, gray no data
  const subjectColor = (m: number, weeksRecorded: number) => {
    if (weeksRecorded === 0) return '#E5E7EB';
    if (m >= 75) return '#10B981';
    if (m >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_120ms_ease-out]"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label={`${student.name} performance details`}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[640px] max-w-full bg-gray-50 shadow-2xl flex flex-col animate-[slideInRight_220ms_ease-out] border-l border-gray-200"
      >
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 truncate">{student.name}</h2>
              {perf?.insights?.isAtRisk && (
                <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  At Risk
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Roll {student.rollNumber} · Class {student.className}-{student.section}
            </p>
            {draftMarksThisWeek && draftWeek && (
              <p className="mt-1 text-[11px] text-indigo-600 font-medium">
                ⚡ Live preview includes Week {draftWeek} unsaved entries
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading || !perf ? (
            <div className="flex justify-center items-center h-40 text-gray-500 text-sm">
              Loading analytics…
            </div>
          ) : !perf.hasEntries ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="font-medium text-gray-700">No marks recorded yet</p>
              <p className="text-sm mt-1">Enter at least one weekly mark to see analytics.</p>
            </div>
          ) : (
            <>
              {/* Quick stat cards */}
              <section className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase">Total</p>
                  <p className="text-xl font-bold text-indigo-700 mt-0.5">
                    {perf.totalMarks}
                    <span className="text-xs text-gray-400 font-medium"> /{OVERALL_MAX}</span>
                  </p>
                  <p className="text-[11px] text-gray-500">{perf.percentage.toFixed(1)}%</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase">Rank</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5 flex items-center gap-1">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    {perf.rank > 0 ? `#${perf.rank}` : '—'}
                  </p>
                  <p className="text-[11px] text-gray-500">class standing</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase">Status</p>
                  <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColor(perf.status)}`}>
                    {perf.status}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                    {trendIcon(perf.trend)} {perf.trend}
                  </div>
                </div>
              </section>

              {/* Weekly Performance Line Chart */}
              <section className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-semibold text-gray-800 text-sm">4-Week Performance Trend</h3>
                  <span className="text-[11px] text-gray-400">each week /{WEEKLY_RAW_MAX}</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">Raw weekly total across all subjects</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyLineData} margin={{ top: 5, right: 16, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} domain={[0, WEEKLY_RAW_MAX]} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 8px rgb(0 0 0 / 0.08)', fontSize: 12 }}
                        formatter={(v) => [`${v} / ${WEEKLY_RAW_MAX}`, 'Raw total']}
                      />
                      <Line
                        type="monotone"
                        dataKey="marks"
                        stroke="#4F46E5"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Week-by-week deltas */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[2, 3, 4].map(w => {
                    const d = perf.weeklyComparisons[w];
                    const cls = d == null ? 'text-gray-300' : d > 0 ? 'text-green-600' : d < 0 ? 'text-red-600' : 'text-gray-500';
                    return (
                      <div key={w} className="text-center bg-gray-50 rounded-md py-1.5 border border-gray-100">
                        <p className="text-[10px] text-gray-500">W{w - 1} → W{w}</p>
                        <p className={`text-sm font-bold ${cls}`}>
                          {d == null ? '—' : d > 0 ? `+${d}` : d}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Subject-wise Bar Chart with strong/weak coloring */}
              <section className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-semibold text-gray-800 text-sm">Subject Performance</h3>
                  <span className="text-[11px] text-gray-400">each subject /100</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Converted from raw weekly tests. Green = strong (≥75), Amber = average, Red = needs work.
                </p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectFinalData} margin={{ top: 5, right: 16, bottom: 22, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis
                        dataKey="short"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 11 }}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} domain={[0, 100]} />
                      <ReferenceLine y={75} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <Tooltip
                        cursor={{ fill: '#F3F4F6' }}
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 8px rgb(0 0 0 / 0.08)', fontSize: 12 }}
                        formatter={(v, _n, item) => {
                          const subj = (item as { payload?: { subject?: string } })?.payload?.subject;
                          return [`${v} / 100`, subj || 'Mark'];
                        }}
                      />
                      <Bar dataKey="mark" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {subjectFinalData.map((d, i) => (
                          <Cell key={i} fill={subjectColor(d.mark, d.weeksRecorded)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Strong / Weak pills */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {perf.strongestSubject !== 'N/A' && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
                      <Award className="w-3.5 h-3.5" /> Strong: {perf.strongestSubject}
                    </span>
                  )}
                  {perf.weakestSubject !== 'N/A' && perf.weakestSubject !== perf.strongestSubject && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">
                      <TrendingDown className="w-3.5 h-3.5" /> Weak: {perf.weakestSubject}
                    </span>
                  )}
                  {perf.insights.improvingSubjects.map(s => (
                    <span key={`up-${s}`} className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <TrendingUp className="w-3.5 h-3.5" /> Improving in {s}
                    </span>
                  ))}
                  {perf.insights.decliningSubjects.map(s => (
                    <span key={`dn-${s}`} className="inline-flex items-center gap-1 text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full">
                      <TrendingDown className="w-3.5 h-3.5" /> Declining in {s}
                    </span>
                  ))}
                </div>
              </section>

              {/* Smart Insights summary */}
              <section className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-4">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Smart Insights
                </h3>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {perf.insights.summary}
                </p>
                {perf.insights.remarks.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {perf.insights.remarks.map((r, i) => (
                      <li key={i} className="text-xs text-gray-700 flex gap-2 items-start">
                        <span className="text-indigo-400 mt-0.5">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Week-wise breakdown (collapsible) */}
              <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 text-sm">Week-by-Week Marks</h3>
                  <p className="text-xs text-gray-500">Tap a week to expand subject details.</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {[1, 2, 3, 4].map(w => {
                    const recorded = perf.weeklyTotals[w] > 0;
                    const isOpen = expandedWeek === w;
                    return (
                      <div key={w} className={recorded ? '' : 'opacity-60'}>
                        <button
                          onClick={() => setExpandedWeek(isOpen ? null : w)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                              recorded ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'
                            }`}>
                              W{w}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Week {w}</p>
                              <p className="text-xs text-gray-500">
                                Raw total: {perf.weeklyTotals[w] || 0} / {WEEKLY_RAW_MAX}
                                {w >= 2 && perf.weeklyComparisons[w] != null && (
                                  <span className={`ml-2 font-medium ${
                                    (perf.weeklyComparisons[w] as number) > 0 ? 'text-green-600' :
                                    (perf.weeklyComparisons[w] as number) < 0 ? 'text-red-600' : 'text-gray-400'
                                  }`}>
                                    {(perf.weeklyComparisons[w] as number) > 0 ? '+' : ''}
                                    {perf.weeklyComparisons[w]}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          {recorded && (isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />)}
                        </button>

                        {isOpen && recorded && (
                          <div className="px-4 pb-4 bg-gray-50 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {SUBJECTS.map(sub => {
                              const entry = rawMarks.find(m => m.subject === sub && m.weekNumber === w);
                              const mark = entry?.marks ?? null;
                              const prev = rawMarks.find(m => m.subject === sub && m.weekNumber === w - 1);
                              const diff = mark !== null && prev?.marks != null ? mark - prev.marks : null;
                              const pct = mark !== null ? (mark / MAX_WEEKLY_MARK) * 100 : 0;
                              const bar = mark === null ? 'bg-gray-200' :
                                pct >= 75 ? 'bg-green-500' :
                                pct >= 50 ? 'bg-amber-400' : 'bg-red-400';

                              return (
                                <div key={sub} className="bg-white border border-gray-200 rounded-lg p-2.5">
                                  <p className="text-[11px] text-gray-500 truncate">{sub}</p>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <p className="text-base font-bold text-gray-900">
                                      {mark !== null ? mark : '—'}
                                      <span className="text-[10px] text-gray-400 font-medium">/{MAX_WEEKLY_MARK}</span>
                                    </p>
                                    {diff != null && diff !== 0 && (
                                      <span className={`text-[10px] font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {diff > 0 ? '+' : ''}{diff}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                                    <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
          >
            Close
          </button>
        </footer>
      </aside>

      {/* Animations */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
