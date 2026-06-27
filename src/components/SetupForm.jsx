import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function SetupForm() {
  const { login, register, googleLogin } = useAuth();
  const [view, setView] = useState('login'); // 'login' | 'register' | 'complete-profile'
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const googleBtnRef = useRef(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({ full_name: '', email: '', password: '', role: 'collector', area: '' });
  const [profileForm, setProfileForm] = useState({ role: 'collector', area: '' });

  // Load Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => initGoogleButton();
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script) } catch {} };
  }, []);

  // Re-render button when view changes back to login
  useEffect(() => {
    if (view === 'login' && window.google?.accounts?.id) initGoogleButton();
  }, [view]);

  function initGoogleButton() {
    if (!googleBtnRef.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      width: googleBtnRef.current.offsetWidth || 360,
      logo_alignment: 'left',
    });
  }

  async function handleGoogleCredential({ credential }) {
    setLoading(true);
    setError('');
    try {
      const user = await googleLogin(credential);
      if (user.needs_profile) {
        setPendingGoogleUser(user);
        setView('complete-profile');
      }
      // if !needs_profile, AuthContext.login() already set isAuthenticated
    } catch (e) {
      setError(e.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) { setError('Email and password are required.'); return; }
    setLoading(true); setError('');
    try { await login(loginForm); }
    catch (e) { setError(e.message || 'Login failed.'); setLoading(false); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const { full_name, email, password, role, area } = regForm;
    if (!full_name || !email || !password) { setError('Name, email and password are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try { await register({ full_name, email, password, role, area }); }
    catch (e) { setError(e.message || 'Registration failed.'); setLoading(false); }
  }

  async function handleCompleteProfile(e) {
    e.preventDefault();
    if (!profileForm.area) { setError('Please enter your area.'); return; }
    setLoading(true); setError('');
    try {
      await base44.entities.User.update(pendingGoogleUser.id, profileForm);
      await login({ _refresh: true });
    } catch (e) { setError(e.message || 'Failed to save profile.'); setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="EcoTrack" className="w-32 h-32 object-contain drop-shadow-md" />
          <p className="text-emerald-600 text-sm mt-2">E-Waste Tracking Platform</p>
        </div>

        <Card className="border-none shadow-xl">
          {/* ── COMPLETE PROFILE (after Google login for new users) ── */}
          {view === 'complete-profile' && (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-center">Complete Your Profile</CardTitle>
                <p className="text-sm text-gray-500 text-center">
                  Welcome, {pendingGoogleUser?.full_name}! Tell us a bit more.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCompleteProfile} className="space-y-4">
                  <div>
                    <Label>Role</Label>
                    <Select value={profileForm.role} onValueChange={v => setProfileForm(f => ({ ...f, role: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collector">Collector</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Area / Region</Label>
                    <Input
                      value={profileForm.area}
                      onChange={e => setProfileForm(f => ({ ...f, area: e.target.value }))}
                      placeholder="e.g. Soweto, Gauteng"
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save & Continue'}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {/* ── LOGIN ── */}
          {view === 'login' && (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-center">Sign In</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Google button */}
                {GOOGLE_CLIENT_ID && (
                  <>
                    <div ref={googleBtnRef} className="w-full flex justify-center" />
                    <div className="flex items-center gap-3 text-gray-400 text-xs">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span>or sign in with email</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  </>
                )}

                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={loginForm.email}
                      onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com" className="mt-1" autoFocus
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={loginForm.password}
                        onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 mt-1" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign In'}
                  </Button>
                </form>

                <p className="text-sm text-center text-gray-500 pt-1">
                  No account?{' '}
                  <button onClick={() => { setView('register'); setError(''); }}
                    className="text-emerald-600 hover:underline font-medium">
                    Create one
                  </button>
                </p>
              </CardContent>
            </>
          )}

          {/* ── REGISTER ── */}
          {view === 'register' && (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-center">Create Account</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <Label>Full Name</Label>
                    <Input value={regForm.full_name}
                      onChange={e => setRegForm(f => ({ ...f, full_name: e.target.value }))}
                      placeholder="e.g. Thabo Nkosi" className="mt-1" autoFocus
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={regForm.email}
                      onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com" className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={regForm.password}
                        onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Min. 6 characters"
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={regForm.role} onValueChange={v => setRegForm(f => ({ ...f, role: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collector">Collector</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Area / Region <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input value={regForm.area}
                      onChange={e => setRegForm(f => ({ ...f, area: e.target.value }))}
                      placeholder="e.g. Soweto, Gauteng" className="mt-1"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 mt-1" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Account'}
                  </Button>
                </form>
                <p className="text-sm text-center text-gray-500 pt-3">
                  Already have an account?{' '}
                  <button onClick={() => { setView('login'); setError(''); }}
                    className="text-emerald-600 hover:underline font-medium">
                    Sign in
                  </button>
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
