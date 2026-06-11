import { useState } from 'react';
import { BookOpenCheck, Lock, Smartphone, User } from 'lucide-react';
import { parentLogin } from '../api/mockDb';
import { Student } from '../types';

interface ParentLoginProps {
  onLogin: (student: Student) => void;
  /** Routes to the secure Teacher Login page (NOT directly into the portal). */
  onTeacherLoginClick: () => void;
}

export default function ParentLogin({ onLogin, onTeacherLoginClick }: ParentLoginProps) {
  const [rollNumber, setRollNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const student = await parentLogin(rollNumber, mobileNumber);
      if (student) {
        setOtpSent(true);
      } else {
        setError('Invalid Roll Number or Mobile Number. Please check your details.');
      }
    } catch (err) {
      setError('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp !== '1234') { // Mock OTP
      setError('Invalid OTP. Use 1234 for testing.');
      return;
    }

    setLoading(true);
    const student = await parentLogin(rollNumber, mobileNumber);
    if (student) {
      onLogin(student);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-indigo-600">
          <BookOpenCheck className="w-12 h-12" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Parent Portal
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Access your child's performance securely
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {!otpSent ? (
            <form className="space-y-6" onSubmit={handleSendOtp}>
              <div>
                <label htmlFor="rollNumber" className="block text-sm font-medium text-gray-700">
                  Student Roll Number
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="rollNumber"
                    name="rollNumber"
                    type="text"
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                    placeholder="e.g. 101"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="mobile" className="block text-sm font-medium text-gray-700">
                  Registered Mobile Number
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Smartphone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="mobile"
                    name="mobile"
                    type="text"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading || !rollNumber || !mobileNumber}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Send OTP'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleVerifyOtp}>
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                  Enter OTP sent to {mobileNumber.slice(-4).padStart(10, '*')}
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                    placeholder="Enter 1234 to test"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">For testing, use OTP: 1234</p>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading || !otp}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Login'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Are you a teacher?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={onTeacherLoginClick}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-indigo-200 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Teacher Login
              </button>
              <p className="mt-2 text-center text-xs text-gray-500">
                Authorized staff only — secure sign-in required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}