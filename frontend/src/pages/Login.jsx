import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.user, data.token);
      if (data.user.role === 'driver') navigate('/driver');
      else if (data.user.role === 'admin') navigate('/admin');
      else navigate('/book');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-left-logo">Cab<span>Go</span> 🚕</div>
          <div className="auth-left-tagline">Speed, precision,<br />and reliable daily transit.</div>
          <div className="auth-left-sub">Experience seamless, action-packed, continuously tracking, and still pushing online for every ride</div>
          <div style={{ marginTop: 40, display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[{ icon: '⭐', val: '4.9', label: 'App Rating' }, { icon: '🚕', val: '10K+', label: 'Daily Rides' }, { icon: '👤', val: '50K+', label: 'Happy Users' }].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#F5A623' }}>{s.val}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-wrap">
          <div className="auth-form-title">Welcome Back 👋</div>
          <div className="auth-form-sub">Login to your CabGo account</div>

          {error && (
            <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
              ⚠️ {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-icon-wrap">
                <span className="icon">✉️</span>
                <input className="form-input" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-icon-wrap">
                <span className="icon">🔒</span>
                <input className="form-input" type="password" name="password" placeholder="Enter password" value={form.password} onChange={handleChange} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? '⏳ Logging in...' : '🚀 Login'}
            </button>
          </form>

          {/* Demo Login Hint */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>🔑 Demo Credentials</div>
            <div style={{ color: '#6B7280', lineHeight: 1.8 }}>
              <div><b>Admin:</b> admin@cabgo.in / admin@123</div>
              <div><b>User/Driver:</b> Register karo first →</div>
            </div>
          </div>

          <div className="auth-bottom">
            Don't have an account? <Link to="/register">Sign up here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
