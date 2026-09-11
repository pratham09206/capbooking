import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'user' });
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
      const { data } = await api.post('/auth/register', form);
      login(data.user, data.token);
      if (data.user.role === 'driver') {
        // Driver needs admin approval
        navigate('/login');
        return;
      }
      navigate('/book');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-left-logo">Cab<span>Go</span> 🚕</div>
          <div className="auth-left-tagline">Join thousands of<br />happy riders today!</div>
          <div className="auth-left-sub">Create your account and start booking rides in seconds. Safe, reliable, and affordable cab service.</div>
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['✅ Book in under 60 seconds', '🔒 100% Safe & Secure rides', '💳 Multiple payment options', '⭐ Top-rated drivers'].map(f => (
              <div key={f} style={{ fontSize: 15, opacity: 0.85 }}>{f}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-wrap">
          <div className="auth-form-title">Create Account ✨</div>
          <div className="auth-form-sub">Fill in your details to get started</div>

          {error && (
            <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
              ⚠️ {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-icon-wrap">
                <span className="icon">👤</span>
                <input className="form-input" type="text" name="name" placeholder="Rahul Patel" value={form.name} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-icon-wrap">
                <span className="icon">✉️</span>
                <input className="form-input" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div className="input-icon-wrap">
                <span className="icon">📱</span>
                <input className="form-input" type="tel" name="phone" placeholder="+91 98765 43210" value={form.phone} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-icon-wrap">
                <span className="icon">🔒</span>
                <input className="form-input" type="password" name="password" placeholder="Min. 6 characters" value={form.password} onChange={handleChange} required minLength={6} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Register As</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ value: 'user', label: '👤 Rider', desc: 'Book rides' }, { value: 'driver', label: '🚕 Driver', desc: 'Drive & earn' }].map(r => (
                  <label key={r.value} style={{
                    flex: 1, padding: '12px 14px', border: `2px solid ${form.role === r.value ? '#F5A623' : '#E5E7EB'}`,
                    borderRadius: 10, cursor: 'pointer', background: form.role === r.value ? 'rgba(245,166,35,0.06)' : 'white',
                    transition: 'all 0.2s'
                  }}>
                    <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={handleChange} style={{ display: 'none' }} />
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{r.desc}</div>
                  </label>
                ))}
              </div>
            </div>
            {form.role === 'driver' && (
              <div style={{ background: '#FEF9C3', border: '1px solid #F59E0B', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400E' }}>
                ⚠️ Driver accounts need <b>Admin approval</b> before you can accept rides.
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? '⏳ Creating account...' : '🚀 Create Account'}
            </button>
          </form>

          <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', margin: '14px 0' }}>
            By signing up, you agree to our Terms & Privacy Policy
          </div>

          <div className="auth-bottom">
            Already have an account? <Link to="/login">Login here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
