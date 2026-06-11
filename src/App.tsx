import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, BookOpenCheck, LogOut, Menu, ShieldCheck, CalendarCheck,
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import MarkEntry from './components/MarkEntry';
import StudentDetail from './components/StudentDetail';
import ParentLogin from './components/ParentLogin';
import ParentDashboard from './components/ParentDashboard';
import TeacherLogin from './components/TeacherLogin';
import AttendanceEntry from './components/AttendanceEntry';
import { Student } from './types';
import { getSession, clearSession, setSession, isTeacher } from './auth';

type Tab = 'dashboard' | 'students' | 'marks' | 'attendance';
type View = 'parent-login' | 'teacher-login' | 'parent-dashboard' | 'teacher-dashboard';

function App() {
  // Resolve the initial view from any persisted session so a refresh
  // doesn't drop the user back onto the login page unexpectedly.
  const [view, setView] = useState<View>(() => {
    const session = getSession();
    if (session?.role === 'teacher') return 'teacher-dashboard';
    if (session?.role === 'parent') return 'parent-dashboard';
    return 'parent-login';
  });

  const [parentStudent, setParentStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Defensive: if a parent session was persisted but we lost the student
  // object on refresh, kick them back to login.
  useEffect(() => {
    if (view === 'parent-dashboard' && !parentStudent) {
      clearSession();
      setView('parent-login');
    }
  }, [view, parentStudent]);

  const handleSignOut = () => {
    clearSession();
    setParentStudent(null);
    setActiveStudent(null);
    setActiveTab('dashboard');
    setView('parent-login');
  };

  // ------------------------------------------------------------------
  // 1) PARENT LOGIN  (default landing — no privileged access by default)
  // ------------------------------------------------------------------
  if (view === 'parent-login') {
    return (
      <ParentLogin
        onLogin={(student) => {
          setSession({ role: 'parent', studentId: student.id });
          setParentStudent(student);
          setView('parent-dashboard');
        }}
        // 🔐 The "Teacher Login" button now routes to the SECURE login
        //    page — it does NOT grant portal access directly.
        onTeacherLoginClick={() => setView('teacher-login')}
      />
    );
  }

  // ------------------------------------------------------------------
  // 2) TEACHER LOGIN  (email + password — sets teacher session on success)
  // ------------------------------------------------------------------
  if (view === 'teacher-login') {
    return (
      <TeacherLogin
        onLoginSuccess={() => setView('teacher-dashboard')}
        onBackToParent={() => setView('parent-login')}
      />
    );
  }

  // ------------------------------------------------------------------
  // 3) PARENT DASHBOARD  (view-only, scoped to their own child)
  // ------------------------------------------------------------------
  if (view === 'parent-dashboard' && parentStudent) {
    return (
      <ParentDashboard
        student={parentStudent}
        onLogout={handleSignOut}
      />
    );
  }

  // ------------------------------------------------------------------
  // 4) TEACHER DASHBOARD  (full access — guarded by isTeacher())
  // ------------------------------------------------------------------
  // Hard frontend guard: a non-teacher cannot reach this branch even if
  // `view` was tampered with, because we re-check the live session.
  if (view === 'teacher-dashboard' && !isTeacher()) {
    clearSession();
    setView('teacher-login');
    return null;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'marks', label: 'Mark Entry', icon: BookOpenCheck },
    { id: 'attendance', label: 'Attendance Entry', icon: CalendarCheck },
  ] as const;

  const NavContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center gap-3 text-indigo-600 mb-2">
          <BookOpenCheck className="w-8 h-8" />
          <h1 className="text-xl font-bold text-gray-900">EduTracker</h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 w-fit mb-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          Teacher · Full access
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setActiveStudent(null);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="p-6 border-t mt-auto">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 h-screen w-64 bg-white border-r flex flex-col transition-transform duration-300 z-30 print:hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2 text-indigo-600">
            <BookOpenCheck className="w-6 h-6" />
            <h1 className="font-bold text-gray-900">EduTracker</h1>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-x-hidden print:p-0">
          <div className="max-w-7xl mx-auto">
            {activeStudent ? (
              <StudentDetail
                student={activeStudent}
                onBack={() => setActiveStudent(null)}
              />
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <Dashboard onSelectStudent={(student) => setActiveStudent(student)} />
                )}
                {activeTab === 'students' && (
                  <StudentList onSelectStudent={(student) => setActiveStudent(student)} />
                )}
                {activeTab === 'marks' && <MarkEntry />}
                {activeTab === 'attendance' && <AttendanceEntry />}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
