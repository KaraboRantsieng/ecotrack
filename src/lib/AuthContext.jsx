import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const isLoadingPublicSettings = false;
  const appPublicSettings = null;

  useEffect(() => {
    checkAppState();
    const showLogin = () => setAuthError({ type: 'auth_required' });
    window.addEventListener('ecotrack:show-login', showLogin);
    return () => window.removeEventListener('ecotrack:show-login', showLogin);
  }, []);

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch {
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required' });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Email + password login
  const login = async (credentials) => {
    if (credentials?._refresh) { await checkAppState(); return; }
    const loggedInUser = await base44.auth.login(credentials);
    setUser(loggedInUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return loggedInUser;
  };

  // Email + password registration
  const register = async (userData) => {
    const newUser = await base44.auth.register(userData);
    setUser(newUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return newUser;
  };

  // Google OAuth — returns user (caller checks needs_profile)
  const googleLogin = async (credential) => {
    const loggedInUser = await base44.auth.googleLogin(credential);
    if (!loggedInUser.needs_profile) {
      setUser(loggedInUser);
      setIsAuthenticated(true);
      setAuthError(null);
    }
    return loggedInUser;
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await base44.auth.logout('/').catch(() => {});
    setAuthError({ type: 'auth_required' });
  };

  const navigateToLogin = () => setAuthError({ type: 'auth_required' });

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth,
      isLoadingPublicSettings, authError, appPublicSettings,
      login, register, googleLogin, logout, navigateToLogin, checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
