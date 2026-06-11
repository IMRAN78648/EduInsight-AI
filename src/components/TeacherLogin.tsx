import { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { teacherLogin } from '../auth';

interface TeacherLoginProps {
  onLoginSuccess: () => void;
  onBackToParent: () => void;
}

export default function TeacherLogin({ onLoginSuccess, onBackToParent }: TeacherLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await teacherLogin(email, password);
    if (result.ok) {
      onLoginSuccess();
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-indigo-400">
          <ShieldCheck className="w-14 h-14" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Teacher Portal — Secure Login
        </h2>
        <p className="mt-2 text-center text-sm text-indigo-200">
          Authorized staff only. All actions are logged.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-xl sm:px-10 border border-indigo-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder="teacher@school.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verifying credentials…' : 'Sign in to Teacher Portal'}
            </button>

            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3 leading-relaxed">
              <p className="font-semibold text-gray-700 mb-1">Demo credentials:</p>
              <p>Email: <code className="font-mono">teacher@school.com</code></p>
              <p>Password: <code className="font-mono">admin123</code></p>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={onBackToParent}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-gray-600 hover:text-indigo-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Parent Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
