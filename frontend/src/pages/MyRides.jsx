import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const STATUS_COLOR = { completed: 'badge-success', cancelled: 'badge-danger', pending: 'badge-warning', started: 'badge-info', paid: 'badge-success', rated: 'badge-success', ride_started: 'badge-info', driver_arriving: 'badge-info', driver_arrived: 'badge-info', accepted: 'badge-warning' };

export default function MyRides() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRides();
  }, []);

  const fetchRides = async () => {
    try {
      const { data } = await api.get('/bookings/my');
      setRides(data.bookings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all'
    ? rides
    : rides.filter(r => {
        if (filter === 'completed') return ['completed', 'paid', 'rated'].includes(r.status);
        return r.status === filter;
      });

  const completedRides = rides.filter(r => ['completed', 'paid', 'rated'].includes(r.status));
  const totalSpent = completedRides.reduce((s, r) => s + r.totalFare, 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div className="page-header">
        <h1>🚕 My Rides</h1>
        <p>View all your past and upcoming bookings</p>
      </div>

      {/* STATS */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon orange">🚕</div>
          <div><div className="stat-value">{completedRides.length}</div><div className="stat-label">Completed Rides</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">💰</div>
          <div><div className="stat-value">₹{totalSpent}</div><div className="stat-label">Total Spent</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">📋</div>
          <div><div className="stat-value">{rides.length}</div><div className="stat-label">Total Bookings</div></div>
        </div>
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'completed', 'cancelled', 'pending'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} style={{ textTransform: 'capitalize' }}>
            {f === 'all' ? '📋 All' : f === 'completed' ? '✅ Completed' : f === 'cancelled' ? '❌ Cancelled' : '⏳ Pending'}
          </button>
        ))}
      </div>

      {/* RIDES LIST */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #F3F4F6', borderTopColor: '#F5A623', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6B7280' }}>Loading your rides...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🚕</div>
          <div className="empty-title">No rides found</div>
          <div className="empty-desc">Book your first ride today!</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/book')}>Book a Ride</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(ride => (
            <div key={ride._id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#9CA3AF', fontSize: 13 }}>#{ride._id.slice(-6).toUpperCase()}</span>
                    <span className={`badge ${STATUS_COLOR[ride.status] || 'badge-gray'}`}>{ride.status}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280' }}>
                    📅 {new Date(ride.createdAt).toLocaleDateString('en-IN')} • {ride.cabName} {ride.cabIcon}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#F5A623' }}>₹{ride.totalFare}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{ride.distance} km</div>
                </div>
              </div>

              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                <div className="route-point" style={{ marginBottom: 6 }}>
                  <div className="route-dot pickup"></div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{ride.pickup?.address}</span>
                </div>
                <div style={{ width: 2, height: 14, background: '#E5E7EB', marginLeft: 4 }}></div>
                <div className="route-point">
                  <div className="route-dot drop"></div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{ride.drop?.address}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {ride.driver && <span>👤 {ride.driver.name}</span>}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/book')}>🔄 Rebook</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
