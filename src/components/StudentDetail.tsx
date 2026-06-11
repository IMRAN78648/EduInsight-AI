import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Award, Printer, Bot, AlertTriangle } from 'lucide-react';
import { Student } from '../types';
import { getStudents, getAllMarks } from '../api/mockDb';
import { calculatePerformance, StudentPerformance } from '../utils/performance';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StudentDetailProps {
  student: Student;
  onBack: () => void;
}

export default function StudentDetail({ student, onBack }: StudentDetailProps) {
  const [performance, setPerformance] = useState<StudentPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<number>(4);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const students = await getStudents();
        const marks = await getAllMarks();
        const perfData = calculatePerformance(students, marks);
        const stPerf = perfData.find(p => p.student.id === student.id);
        if (stPerf) {
          setPerformance(stPerf);
          
          // Auto-select latest active week
          let latest = 1;
          for (let w = 4; w >= 1; w--) {
            if (stPerf.weeklyTotals[w] > 0) {
              latest = w;
              break;
            }
          }
          setSelectedWeek(latest);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [student]);

  if (loading || !performance) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading student data...</div>
      </div>
    );
  }

  // Prepare Data for Weekly Line Chart
  const weeklyData = [1, 2, 3, 4].map(w => ({
    name: `Week ${w}`,
    marks: performance.weeklyTotals[w] || 0
  }));

  // Prepare Data for Subject-wise Bar Chart
  const subjectMarks: Record<string, Record<number, number>> = {};
  ['Tamil', 'English', 'Maths', 'Physics', 'Chemistry', 'Computer Science'].forEach(sub => {
    subjectMarks[sub] = { 1: 0, 2: 0, 3: 0, 4: 0 };
  });

  // We need the raw marks to build the subject chart correctly. 
  // Let's fetch the marks again or we can derive it if we had it in performance.
  // Actually, performance.ts doesn't export raw marks. We'll fetch just for this student.
  const [rawMarks, setRawMarks] = useState<any[]>([]);
  useEffect(() => {
    getAllMarks().then(marks => setRawMarks(marks.filter(m => m.studentId === student.id)));
  }, [student]);

  const subjectData = ['Tamil', 'English', 'Maths', 'Physics', 'Chemistry', 'Computer Science'].map(sub => {
    const markEntry = rawMarks.find(m => m.subject === sub && m.weekNumber === selectedWeek);
    return {
      subject: sub,
      marks: markEntry?.marks || 0
    };
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Improving': return <TrendingUp className="w-6 h-6 text-green-500" />;
      case 'Declining': return <TrendingDown className="w-6 h-6 text-red-500" />;
      case 'Stable': return <Minus className="w-6 h-6 text-gray-500" />;
      case 'Fluctuating': return <TrendingUp className="w-6 h-6 text-amber-500 rotate-45" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Good': return <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">Good</span>;
      case 'Average': return <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">Average</span>;
      case 'Needs Improvement': return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">Needs Improvement</span>;
      default: return <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-semibold">N/A</span>;
    }
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Printer className="w-4 h-4" />
          Download PDF Report
        </button>
      </div>

      <div className="hidden print:block text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Monthly Performance Report</h1>
        <p className="text-gray-500 mt-2">EduTracker Academic System</p>
      </div>

      {performance.insights?.isAtRisk && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
          <div>
            <h3 className="text-red-800 font-bold">Academic Alert: At Risk</h3>
            <p className="text-red-700 text-sm mt-1">This student is currently showing a significant decline in performance or scoring consistently below passing thresholds. Immediate intervention is recommended.</p>
          </div>
        </div>
      )}

      {/* Header Profile */}
      <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:shadow-none print:border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
          <p className="text-gray-500">
            Roll No: {student.rollNumber} | Class: {student.className} - {student.section}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500 font-medium">Class Rank</p>
            <div className="flex items-center gap-1 justify-end">
              <Award className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold text-gray-900">
                {performance.rank > 0 ? `#${performance.rank}` : 'N/A'}
              </span>
            </div>
          </div>
          <div className="w-px h-12 bg-gray-200"></div>
          <div className="text-right">
            <p className="text-sm text-gray-500 font-medium">Status</p>
            <div className="mt-1">{getStatusBadge(performance.status)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
        {/* Total Marks */}
        <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col justify-center print:shadow-none print:border-gray-200">
          <p className="text-sm text-gray-500 font-medium mb-1">Total Marks</p>
          <p className="text-3xl font-bold text-indigo-600">
            {performance.totalMarks}
            <span className="text-base font-medium text-gray-400"> / {performance.maxTotal}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">{performance.percentage.toFixed(1)}%</p>
        </div>
        
        {/* Trend */}
        <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col justify-center print:shadow-none print:border-gray-200">
          <p className="text-sm text-gray-500 font-medium mb-1">Overall Trend</p>
          <div className="flex items-center gap-2">
            {getTrendIcon(performance.trend)}
            <span className="text-xl font-bold text-gray-800">{performance.trend}</span>
          </div>
        </div>

        {/* Strong / Weak */}
        <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col justify-center gap-2 print:shadow-none print:border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 font-medium">Strongest Subject</span>
            <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
              ↑ {performance.strongestSubject}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 font-medium">Weakest Subject</span>
            <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
              ↓ {performance.weakestSubject}
            </span>
          </div>
        </div>
      </div>

      {/* AI-Powered Smart Insights Box */}
      {performance.hasEntries && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow-sm border border-indigo-100 p-6 print:border-gray-200 print:bg-none print:bg-gray-50">
          <div className="flex items-center gap-2 mb-4 text-indigo-800 font-bold">
            <Bot className="w-5 h-5 text-indigo-600" />
            <h2>AI Smart Insights & Remarks</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Performance Summary</h3>
              <p className="text-gray-800 leading-relaxed text-sm">
                {performance.insights?.summary || "Sufficient data is required to build a performance profile."}
              </p>
            </div>
            
            <div className="md:border-l md:border-indigo-100 md:pl-6 print:border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Key Observations</h3>
              <ul className="space-y-2">
                {performance.insights?.remarks.map((remark, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-800">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    {remark}
                  </li>
                ))}
                {(!performance.insights?.remarks || performance.insights.remarks.length === 0) && (
                  <li className="text-sm text-gray-500 italic">No significant observations logged yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
        {/* Line Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Weekly Performance Trend</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="marks" 
                  stroke="#4F46E5" 
                  strokeWidth={3} 
                  dot={{ r: 6, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6 print:shadow-none print:border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Subject-wise Marks</h2>
            <div className="print:hidden">
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                {[1, 2, 3, 4].map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>
            <div className="hidden print:block text-sm font-bold text-gray-600">
              Week {selectedWeek} Selected
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="subject" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12 }} 
                  angle={-45} 
                  textAnchor="end" 
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="marks" fill="#60A5FA" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
