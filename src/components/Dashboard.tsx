import { useEffect, useState } from 'react';
import {
  Users, GraduationCap, BarChart3, TrendingUp, TrendingDown, Minus, Award,
  AlertTriangle, Bell, UserX,
} from 'lucide-react';
import { getStudents, getAllMarks, getAllAttendance } from '../api/mockDb';
import { calculatePerformance, StudentPerformance } from '../utils/performance';
import {
  Student, OVERALL_MAX, WEEKLY_RAW_MAX, Attendance, ATTENDANCE_LOW_THRESHOLD,
} from '../types';
import { computeStudentAttendance, AttendanceStats } from '../utils/attendance';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  onSelectStudent: (student: Student) => void;
}

export default function Dashboard({ onSelectStudent }: DashboardProps) {
  const [studentCount, setStudentCount] = useState(0);
  const [performanceData, setPerformanceData] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  // Attendance state (additive — does not affect marks logic).
  const [attendanceByStudent, setAttendanceByStudent] = useState<Record<string, AttendanceStats>>({});
  const [studentsById, setStudentsById] = useState<Record<string, Student>>({});

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const students = await getStudents();
        setStudentCount(students.length);

        const marks = await getAllMarks();
        const perf = calculatePerformance(students, marks);
        setPerformanceData(perf);

        // Load attendance separately and compute per-student stats.
        const attendance: Attendance[] = await getAllAttendance();
        const map: Record<string, AttendanceStats> = {};
        const byId: Record<string, Student> = {};
        for (const s of students) {
          map[s.id] = computeStudentAttendance(s.id, attendance);
          byId[s.id] = s;
        }
        setAttendanceByStudent(map);
        setStudentsById(byId);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  // Derive the "Students Requiring Attention" list:
  // any student whose attendance percentage is below the threshold.
  const lowAttendanceStudents = Object.entries(attendanceByStudent)
    .filter(([_id, s]) => s.hasData && s.isLow)
    .map(([id, stats]) => ({ student: studentsById[id], stats }))
    .filter(e => !!e.student)
    .sort((a, b) => a.stats.percentage - b.stats.percentage);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Improving': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'Declining': return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'Stable': return <Minus className="w-5 h-5 text-gray-500" />;
      case 'Fluctuating': return <TrendingUp className="w-5 h-5 text-amber-500 rotate-45" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string, isAtRisk?: boolean) => {
    if (isAtRisk) {
      return <span className="bg-red-600 text-white shadow-sm border border-red-700 text-xs px-2.5 py-1 rounded-full font-bold flex items-center justify-center gap-1 w-max mx-auto"><AlertTriangle className="w-3 h-3" />At Risk</span>;
    }
    switch (status) {
      case 'Good': return <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-medium">Good</span>;
      case 'Average': return <span className="bg-yellow-100 text-yellow-800 text-xs px-2.5 py-1 rounded-full font-medium">Average</span>;
      case 'Needs Improvement': return <span className="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-medium">Needs Improvement</span>;
      default: return <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-full font-medium">N/A</span>;
    }
  };

  const validPerformance = performanceData.filter(d => d.hasEntries);
  const topStudents = [...validPerformance].sort((a, b) => b.totalMarks - a.totalMarks).slice(0, 5);
  const bottomStudents = [...validPerformance].sort((a, b) => a.totalMarks - b.totalMarks).slice(0, 5);

  // Class averages = average raw weekly total (out of WEEKLY_RAW_MAX = 210) per week
  const classAverages = [1, 2, 3, 4].map(w => {
    const studentsWithMarks = performanceData.filter(d => d.weeklyTotals[w] > 0);
    const avg = studentsWithMarks.length > 0
      ? studentsWithMarks.reduce((sum, d) => sum + d.weeklyTotals[w], 0) / studentsWithMarks.length
      : 0;
    return { name: `Week ${w}`, average: Math.round(avg) };
  });

  // Class-wide average converted total (out of 600) — what teachers actually care about
  const avgFinalTotal = validPerformance.length > 0
    ? Math.round(validPerformance.reduce((sum, d) => sum + d.totalMarks, 0) / validPerformance.length)
    : 0;

  const allAlerts = validPerformance.flatMap(d => d.insights?.alerts.map(a => ({ studentName: d.student.name, alert: a })) || []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Teacher Dashboard</h1>
          <p className="text-gray-500">Welcome to the Student Performance Tracker. Monitor progress and analyze class trends.</p>
        </div>
        {allAlerts.length > 0 && (
          <div className="flex-shrink-0 bg-orange-50 border border-orange-100 px-4 py-2 rounded-lg flex items-start gap-3 max-w-sm">
             <Bell className="w-5 h-5 text-orange-500 mt-0.5" />
             <div className="text-sm">
                <span className="font-bold text-orange-800 block mb-1">Recent Alerts</span>
                <ul className="text-orange-700 space-y-1">
                  {allAlerts.slice(0, 3).map((a, i) => (
                    <li key={i}><strong>{a.studentName}:</strong> {a.alert}</li>
                  ))}
                  {allAlerts.length > 3 && <li><span className="text-xs font-bold text-orange-600">+{allAlerts.length - 3} more alerts...</span></li>}
                </ul>
             </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-full">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Students</p>
            <p className="text-2xl font-bold text-gray-800">{studentCount}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-full">
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Class Avg Total</p>
            <p className="text-2xl font-bold text-gray-800">
              {avgFinalTotal}
              <span className="text-sm font-medium text-gray-400"> / {OVERALL_MAX}</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition" onClick={() => topStudents[0] && onSelectStudent(topStudents[0].student)}>
          <div className="bg-yellow-100 p-3 rounded-full">
            <Award className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Top Performer</p>
            <p className="text-2xl font-bold text-gray-800 truncate max-w-[120px]">
              {topStudents[0]?.student.name || 'N/A'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-full">
            <GraduationCap className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Weeks</p>
            <p className="text-2xl font-bold text-gray-800">
              {classAverages.filter(w => w.average > 0).length || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Average Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-bold text-gray-800">Average Class Performance</h2>
          <p className="text-xs text-gray-500 mb-4">Avg raw weekly total per week (out of {WEEKLY_RAW_MAX})</p>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={classAverages} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="average" 
                  name="Avg Marks"
                  stroke="#10B981" 
                  strokeWidth={3} 
                  dot={{ r: 6, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 / Bottom 5 Lists */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-500" />
              Top Performers
            </h2>
            <div className="space-y-3">
              {topStudents.map((d, i) => (
                <div key={d.student.id} className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors" onClick={() => onSelectStudent(d.student)}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400 w-4">{i + 1}.</span>
                    <span className="text-sm font-medium text-gray-900">{d.student.name}</span>
                  </div>
                  <span className="text-sm font-bold text-indigo-600">{d.totalMarks}<span className="text-xs text-gray-400 font-medium">/{OVERALL_MAX}</span></span>
                </div>
              ))}
              {topStudents.length === 0 && <p className="text-sm text-gray-500">No data available.</p>}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Needs Attention
            </h2>
            <div className="space-y-3">
              {bottomStudents.map((d) => (
                <div key={d.student.id} className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors" onClick={() => onSelectStudent(d.student)}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">{d.student.name}</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">{d.totalMarks}<span className="text-xs text-gray-400 font-medium">/{OVERALL_MAX}</span></span>
                </div>
              ))}
              {bottomStudents.length === 0 && <p className="text-sm text-gray-500">No data available.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Students Requiring Attention — attendance-based, additive section */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-500" />
              Students Requiring Attention
            </h2>
            <p className="text-sm text-gray-500">
              Students with attendance below {ATTENDANCE_LOW_THRESHOLD}%.
            </p>
          </div>
          {lowAttendanceStudents.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1 w-max">
              <AlertTriangle className="w-3.5 h-3.5" />
              {lowAttendanceStudents.length} student{lowAttendanceStudents.length === 1 ? '' : 's'} flagged
            </span>
          )}
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">Loading attendance…</div>
        ) : lowAttendanceStudents.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            No students currently below the {ATTENDANCE_LOW_THRESHOLD}% attendance threshold. 🎉
          </div>
        ) : (
          <div className="divide-y">
            {lowAttendanceStudents.map(({ student, stats }) => (
              <button
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className="w-full text-left flex items-center justify-between px-6 py-3 hover:bg-red-50/40 transition-colors"
              >
                <div>
                  <div className="font-medium text-gray-900">{student.name}</div>
                  <div className="text-xs text-gray-500">
                    Roll: {student.rollNumber} · Class {student.className}-{student.section}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-600">{stats.percentage}%</div>
                  <div className="text-[11px] text-gray-500">
                    Present: {stats.presentDays} · Absent: {stats.absentDays}
                    {stats.medicalLeaveDays > 0 && ` · ML: ${stats.medicalLeaveDays}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Performance Overview Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800">Performance Overview</h2>
          <p className="text-sm text-gray-500">Student rankings, trends, and weekly comparisons.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-gray-50 border-b text-sm text-gray-600">
              <tr>
                <th className="px-6 py-4 font-semibold w-16 text-center">Rank</th>
                <th className="px-6 py-4 font-semibold">Student Name</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Trend</th>
                <th className="px-6 py-4 font-semibold text-center">W1 → W2</th>
                <th className="px-6 py-4 font-semibold text-center">W2 → W3</th>
                <th className="px-6 py-4 font-semibold text-center">W3 → W4</th>
                <th className="px-6 py-4 font-semibold text-center">Total / {OVERALL_MAX}</th>
                <th className="px-6 py-4 font-semibold text-center">%</th>
                <th className="px-6 py-4 font-semibold">Strongest / Weakest</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    Loading performance data...
                  </td>
                </tr>
              ) : performanceData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    No students found or no marks entered.
                  </td>
                </tr>
              ) : (
                performanceData.map((data) => (
                  <tr 
                    key={data.student.id} 
                    className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                    onClick={() => onSelectStudent(data.student)}
                  >
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                        data.rank === 1 ? 'bg-yellow-100 text-yellow-700' : 
                        data.rank === 2 ? 'bg-gray-200 text-gray-700' :
                        data.rank === 3 ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {data.rank > 0 ? data.rank : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{data.student.name}</div>
                      <div className="text-xs text-gray-500">Roll: {data.student.rollNumber}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(data.status, data.insights?.isAtRisk)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {getTrendIcon(data.trend)}
                        <span className="text-gray-600">{data.trend}</span>
                      </div>
                    </td>
                    
                    {/* Weekly total comparisons */}
                    {[2, 3, 4].map(w => {
                      const diff = data.weeklyComparisons[w];
                      return (
                        <td key={w} className="px-6 py-4 text-center font-medium">
                          {diff !== undefined && diff !== null ? (
                            <span className={diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500'}>
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    
                    <td className="px-6 py-4 text-center font-bold text-gray-700">
                      {data.hasEntries ? data.totalMarks : '-'}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600 font-medium">
                      {data.hasEntries ? `${data.percentage}%` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 inline-block w-max">
                          ↑ {data.strongestSubject}
                        </span>
                        <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100 inline-block w-max">
                          ↓ {data.weakestSubject}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
