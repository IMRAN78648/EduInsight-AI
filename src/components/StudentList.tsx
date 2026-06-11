import { useState, useEffect } from 'react';
import { UserPlus, Trash2, GraduationCap, Trophy } from 'lucide-react';
import { getStudents, addStudent, deleteStudent, getAllMarks } from '../api/mockDb';
import { calculatePerformance } from '../utils/performance';
import { Student } from '../types';

interface StudentListProps {
  onSelectStudent?: (student: Student) => void;
}

export default function StudentList({ onSelectStudent }: StudentListProps) {
  const [students, setStudents] = useState<(Student & { rank?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [parentMobile, setParentMobile] = useState('');

  const loadStudents = async () => {
    setLoading(true);
    const [data, marks] = await Promise.all([getStudents(), getAllMarks()]);
    
    if (marks.length > 0) {
      const performance = calculatePerformance(data, marks);
      const studentWithRanks = data.map(s => {
        const perf = performance.find(p => p.student.id === s.id);
        return { ...s, rank: perf?.rank || 0 };
      });
      setStudents(studentWithRanks);
    } else {
      setStudents(data.map(s => ({ ...s, rank: 0 })));
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rollNumber || !className || !section) return;

    try {
      await addStudent({ name, rollNumber, className, section, parentMobile });
      setName('');
      setRollNumber('');
      setClassName('');
      setSection('');
      setParentMobile('');
      loadStudents();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add student.';
      alert(msg.toLowerCase().includes('unauthorized')
        ? 'Unauthorized access — only teachers can add students.'
        : msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await deleteStudent(id);
        loadStudents();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to delete student.';
        alert(msg.toLowerCase().includes('unauthorized')
          ? 'Unauthorized access — only teachers can delete students.'
          : msg);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-indigo-600" />
          Add New Student
        </h2>
        <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. John Doe"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. 101"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. 12"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. A"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Mobile (Optional)</label>
            <input
              type="text"
              value={parentMobile}
              onChange={(e) => setParentMobile(e.target.value)}
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. 9876543210"
            />
          </div>
          <div className="md:col-span-5 flex justify-end">
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
            >
              Add Student
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            Student List
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b text-sm text-gray-600">
              <tr>
                <th className="px-6 py-3 font-medium w-16 text-center">Rank</th>
                <th className="px-6 py-3 font-medium">Roll Number</th>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Class</th>
                <th className="px-6 py-3 font-medium">Section</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading students...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No students found. Add one above.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr 
                    key={student.id} 
                    className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                    onClick={() => onSelectStudent?.(student)}
                  >
                    <td className="px-6 py-4 text-center">
                      {student.rank && student.rank > 0 ? (
                        <div className={`inline-flex items-center gap-1 justify-center px-2 py-1 rounded-full text-xs font-bold ${
                          student.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                          student.rank === 2 ? 'bg-gray-200 text-gray-700' :
                          student.rank === 3 ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {student.rank <= 3 && <Trophy className="w-3 h-3" />}
                          {student.rank}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium">{student.rollNumber}</td>
                    <td className="px-6 py-4 font-medium">{student.name}</td>
                    <td className="px-6 py-4 text-gray-600">{student.className}</td>
                    <td className="px-6 py-4 text-gray-600">{student.section}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(student.id);
                        }}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition"
                        title="Delete Student"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
