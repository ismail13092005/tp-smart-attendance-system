import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api, getErrorMessage } from '../lib/api';
import { getRoleRoot } from '../config/navigation';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth, isAuthenticated, user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  // Already logged in — redirect to role root
  if (isAuthenticated && user) {
    return <Navigate to={getRoleRoot(user.role)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.login(email, password);
      const { user, accessToken, refreshToken, sessionId } = response.data;
      clearAuth(); // clear any stale state first
      setAuth(user, accessToken, refreshToken, sessionId);
      navigate(getRoleRoot(user.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">SmartAttend</h1>
          <p className="text-sm text-muted-foreground mt-1">Multi-factor attendance verification</p>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <LogIn className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-center text-foreground">Sign In</h2>

          {error && (
            <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">Email</label>
              <input
                id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="you@university.edu" required autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  id="password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 pr-9 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="••••••••" required autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">Register</Link>
          </p>

          <div className="border-t border-border pt-4 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Demo credentials</p>
            <p>Admin: admin@greenfield.edu / Admin@123456</p>
            <p>Faculty: john.doe@greenfield.edu / Faculty@123</p>
            <p>Student: alice.johnson@student.greenfield.edu / Student@123</p>
            <p>Parent: robert.johnson@gmail.com / Parent@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
