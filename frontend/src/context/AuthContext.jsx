import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('cabgo_user');
    const token = localStorage.getItem('cabgo_token');
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('cabgo_user', JSON.stringify(userData));
    localStorage.setItem('cabgo_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('cabgo_user');
    localStorage.removeItem('cabgo_token');
    setUser(null);
  };

  // Refresh user data from backend
  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      const updated = data.user;
      localStorage.setItem('cabgo_user', JSON.stringify(updated));
      setUser(updated);
      return updated;
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
