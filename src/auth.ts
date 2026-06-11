// Lightweight session-based auth module.
// Uses sessionStorage so credentials don't survive tab close — slightly safer than localStorage.

export type Role = 'parent' | 'teacher';

export interface Session {
  role: Role;
  // For parents: the student id they are allowed to view.
  studentId?: string;
  // For teachers: their email.
  email?: string;
  // Issued-at timestamp (acts as a tiny pseudo-JWT marker).
  iat: number;
}

const SESSION_KEY = 'spt_session';

// --- HARDCODED TEACHER CREDENTIALS (per spec) ---
export const TEACHER_EMAIL = 'teacher@school.com';
export const TEACHER_PASSWORD = 'admin123';

// --- HARDCODED ADMIN PIN (optional extra security, per spec) ---
export const ADMIN_PIN = '1234';

export const getSession = (): Session | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

export const setSession = (session: Omit<Session, 'iat'>): Session => {
  const full: Session = { ...session, iat: Date.now() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(full));
  return full;
};

export const clearSession = (): void => {
  sessionStorage.removeItem(SESSION_KEY);
  // Also clear the per-session PIN unlock so the next teacher must re-confirm.
  sessionStorage.removeItem('spt_pin_unlocked');
};

export const getCurrentRole = (): Role | null => getSession()?.role ?? null;

export const isTeacher = (): boolean => getCurrentRole() === 'teacher';

/**
 * Backend-style guard. Throws "Unauthorized access" if the current
 * session is not a teacher. Used by mockDb to protect write APIs.
 */
export const requireTeacher = (): void => {
  if (!isTeacher()) {
    throw new Error('Unauthorized access: teacher role required.');
  }
};

// --- Teacher login ---
export const teacherLogin = async (
  email: string,
  password: string
): Promise<{ ok: true; session: Session } | { ok: false; error: string }> => {
  // Simulate a small network delay so the UX feels real.
  await new Promise((r) => setTimeout(r, 400));

  if (email.trim().toLowerCase() !== TEACHER_EMAIL) {
    return { ok: false, error: 'Invalid email or password.' };
  }
  if (password !== TEACHER_PASSWORD) {
    return { ok: false, error: 'Invalid email or password.' };
  }
  const session = setSession({ role: 'teacher', email: TEACHER_EMAIL });
  return { ok: true, session };
};

// --- Admin PIN (optional extra security before edits) ---
export const verifyAdminPin = (pin: string): boolean => pin === ADMIN_PIN;

export const isPinUnlocked = (): boolean =>
  sessionStorage.getItem('spt_pin_unlocked') === '1';

export const markPinUnlocked = (): void => {
  sessionStorage.setItem('spt_pin_unlocked', '1');
};
