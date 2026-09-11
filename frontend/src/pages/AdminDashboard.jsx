import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const SIDEBAR_ITEMS = [
  { icon: '📊', label: 'Dashboard', key: 'dashboard' },
  { icon: '👤', label: 'Users', key: 'users' },
  { icon: '🚕', label: 'Drivers', key: 'drivers' },
  { icon: '📋', label: 'Bookings', key: 'bookings' },
  { icon: '💰', label: 'Payments', key: 'payments' },
  { icon: '⭐', label: 'Reviews', key: 'reviews' },
];

const STATUS_COLOR = { completed: 'badge-success', cancelled: 'badge-danger', started: 'badge-info', pending: 'badge-warning', accepted: 'badge-warning', paid: 'badge-success', rated: 'badge-success', ride_started: 'badge-info', driver_arriving: 'badge-info', driver_arrived: 'badge-info', active: 'badge-success', inactive: 'badge-gray' };

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data.stats);
      setRecentBookings(data.recentBookings || []);
    } catch (err) {
      toast.error('Failed to load stats.');
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.users || []);
    } catch { }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/drivers');
      setDrivers(data.drivers || []);
    } catch { }
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/bookings');
      setBookings(data.bookings || []);
    } catch { }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/payments');
      setPayments(data.payments || []);
    } catch { }
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/reviews');
      setReviews(data.reviews || []);
    } catch { }
  }, []);

  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'drivers') fetchDrivers();
    if (activeTab === 'bookings') fetchBookings();
    if (activeTab === 'payments') fetchPayments();
    if (activeTab === 'reviews') fetchReviews();
  }, [activeTab]);

  const approveDriver = async (id, approve) => {
    try {
      await api.put(`/admin/drivers/${id}/approve`, { isApproved: approve });
      toast.success(approve ? '✅ Driver approved!' : '❌ Driver rejected.');
      fetchDrivers();
      fetchStats();
    } catch {
      toast.error('Action failed.');
    }
  };

  const toggleUser = async (id) => {
    try {
      await api.put(`/admin/users/${id}/toggle`);
      toast.success('User status updated.');
      fetchUsers();
    } catch {
      toast.error('Action failed.');
    }
  };

  const toggleReview = async (id) => {
    try {
      await api.put(`/admin/reviews/${id}/toggle`);
      toast.success('Review visibility toggled.');
      fetchReviews();
    } catch {
      toast.error('Action failed.');
    }
  };

  const pendingDrivers = drivers.filter(d => !d.isApproved);

  return (
    <div className="sidebar-layout">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🚕</div>
          <span>Cab<span style={{ color: '#F5A623' }}>Go</span></span>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Admin Panel</div>
          {SIDEBAR_ITEMS.map(item => (
            <div key={item.key} className={`sidebar-item ${activeTab === item.key ? 'active' : ''}`} onClick={() => setActiveTab(item.key)}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.key === 'drivers' && pendingDrivers.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#EF4444', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{pendingDrivers.length}</span>
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="sidebar-profile-avatar">{user?.name?.[0]}</div>
            <div className="sidebar-profile-info">
              <div className="sidebar-profile-name">{user?.name}</div>
              <div className="sidebar-profile-role">Administrator</div>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} style={{ background: 'none', fontSize: 16, cursor: 'pointer' }}>🚪</button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main-content">
        <div className="page-content">

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              <div className="page-header">
                <h1>📊 Admin Dashboard</h1>
                <p>Welcome back, {user?.name}! Here's what's happening.</p>
              </div>

              <div className="stats-grid">
                {[
                  { icon: '👤', label: 'Total Users', val: stats?.users ?? '...', color: 'blue' },
                  { icon: '🚕', label: 'Total Drivers', val: stats?.drivers ?? '...', color: 'orange' },
                  { icon: '📋', label: 'Total Bookings', val: stats?.bookings?.total ?? '...', color: 'purple' },
                  { icon: '✅', label: 'Completed', val: stats?.bookings?.completed ?? '...', color: 'green' },
                  { icon: '💰', label: 'Total Revenue', val: stats ? `₹${stats.revenue.total.toLocaleString()}` : '...', color: 'green' },
                  { icon: '🔴', label: 'Active Rides', val: stats?.bookings?.active ?? '...', color: 'orange' },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                    <div>
                      <div className="stat-value">{s.val}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* RECENT BOOKINGS */}
              <div className="table-wrap" style={{ marginTop: 24 }}>
                <div className="table-header">
                  <div className="table-title">🔄 Recent Bookings</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('bookings')}>View All</button>
                </div>
                <table>
                  <thead><tr><th>ID</th><th>User</th><th>Driver</th><th>Route</th><th>Fare</th><th>Status</th></tr></thead>
                  <tbody>
                    {recentBookings.map(b => (
                      <tr key={b._id}>
                        <td style={{ fontWeight: 600, color: '#6B7280' }}>#{b._id.slice(-6).toUpperCase()}</td>
                        <td>{b.user?.name || '-'}</td>
                        <td>{b.driver?.name || '-'}</td>
                        <td>{b.pickup?.address} → {b.drop?.address}</td>
                        <td style={{ fontWeight: 700, color: '#F5A623' }}>₹{b.totalFare}</td>
                        <td><span className={`badge ${STATUS_COLOR[b.status] || 'badge-gray'}`}>{b.status}</span></td>
                      </tr>
                    ))}
                    {recentBookings.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>No bookings yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <>
              <div className="page-header"><h1>👤 User Management</h1><p>Manage all registered users</p></div>
              <div className="table-wrap">
                <div className="table-header">
                  <div className="table-title">All Users <span className="badge badge-info" style={{ marginLeft: 8 }}>{users.length}</span></div>
                </div>
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Rides</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id}>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.phone}</td>
                        <td>{u.totalRides}</td>
                        <td style={{ color: '#6B7280', fontSize: 13 }}>{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                        <td><span className={`badge ${u.isActive ? 'badge-success' : 'badge-gray'}`}>{u.isActive ? 'active' : 'inactive'}</span></td>
                        <td><button className="action-btn" onClick={() => toggleUser(u._id)}>{u.isActive ? '🚫 Block' : '✅ Activate'}</button></td>
                      </tr>
                    ))}
                    {users.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>No users yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* DRIVERS TAB */}
          {activeTab === 'drivers' && (
            <>
              <div className="page-header"><h1>🚕 Driver Management</h1><p>Approve, manage and monitor drivers</p></div>

              {pendingDrivers.length > 0 && (
                <div style={{ background: '#FEF9C3', border: '1px solid #F59E0B', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>⏳ Pending Approvals ({pendingDrivers.length})</div>
                  {pendingDrivers.map(d => (
                    <div key={d._id} style={{ background: 'white', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20 }}>{d.name[0]}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{d.name}</div>
                        <div style={{ fontSize: 13, color: '#6B7280' }}>{d.email} • {d.phone}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-danger btn-sm" onClick={() => approveDriver(d._id, false)}>❌ Reject</button>
                        <button className="btn btn-success btn-sm" onClick={() => approveDriver(d._id, true)}>✅ Approve</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="table-wrap">
                <div className="table-header"><div className="table-title">All Drivers ({drivers.length})</div></div>
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Rating</th><th>Rides</th><th>Online</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {drivers.map(d => (
                      <tr key={d._id}>
                        <td style={{ fontWeight: 600 }}>{d.name}</td>
                        <td>{d.email}</td>
                        <td>{d.phone}</td>
                        <td>{d.totalRatings > 0 ? `⭐ ${(d.rating / d.totalRatings).toFixed(1)}` : '-'}</td>
                        <td>{d.totalRides}</td>
                        <td><div className={`online-dot ${d.isOnline ? 'online' : 'offline'}`} /></td>
                        <td><span className={`badge ${d.isApproved ? 'badge-success' : 'badge-warning'}`}>{d.isApproved ? 'approved' : 'pending'}</span></td>
                        <td>
                          <div className="table-actions">
                            {!d.isApproved
                              ? <button className="action-btn" onClick={() => approveDriver(d._id, true)}>✅</button>
                              : <button className="action-btn" onClick={() => approveDriver(d._id, false)}>❌</button>
                            }
                          </div>
                        </td>
                      </tr>
                    ))}
                    {drivers.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>No drivers yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* BOOKINGS TAB */}
          {activeTab === 'bookings' && (
            <>
              <div className="page-header"><h1>📋 Booking Management</h1><p>All bookings across the platform</p></div>
              <div className="table-wrap">
                <div className="table-header">
                  <div className="table-title">All Bookings <span className="badge badge-info" style={{ marginLeft: 8 }}>{bookings.length}</span></div>
                </div>
                <table>
                  <thead><tr><th>ID</th><th>User</th><th>Driver</th><th>Route</th><th>Fare</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr key={b._id}>
                        <td style={{ fontWeight: 600, color: '#6B7280' }}>#{b._id.slice(-6).toUpperCase()}</td>
                        <td>{b.user?.name || '-'}</td>
                        <td>{b.driver?.name || '-'}</td>
                        <td style={{ fontSize: 13 }}>{b.pickup?.address} → {b.drop?.address}</td>
                        <td style={{ fontWeight: 700, color: '#F5A623' }}>₹{b.totalFare}</td>
                        <td style={{ color: '#6B7280', fontSize: 13 }}>{new Date(b.createdAt).toLocaleDateString('en-IN')}</td>
                        <td><span className={`badge ${STATUS_COLOR[b.status] || 'badge-gray'}`}>{b.status}</span></td>
                      </tr>
                    ))}
                    {bookings.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>No bookings yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <>
              <div className="page-header"><h1>💰 Payment Management</h1></div>
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                {[
                  { icon: '💵', label: 'Total Revenue', val: `₹${payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0).toLocaleString()}`, color: 'green' },
                  { icon: '✅', label: 'Paid', val: payments.filter(p => p.status === 'paid').length, color: 'green' },
                  { icon: '⏳', label: 'Pending', val: payments.filter(p => p.status === 'pending').length, color: 'orange' },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                    <div><div className="stat-value" style={{ fontSize: 20 }}>{s.val}</div><div className="stat-label">{s.label}</div></div>
                  </div>
                ))}
              </div>
              <div className="table-wrap">
                <div className="table-header"><div className="table-title">Payment Records</div></div>
                <table>
                  <thead><tr><th>Booking</th><th>User</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p._id}>
                        <td style={{ color: '#6B7280' }}>#{p.booking?._id?.slice(-6).toUpperCase() || '-'}</td>
                        <td>{p.user?.name || '-'}</td>
                        <td style={{ fontWeight: 700, color: '#F5A623' }}>₹{p.amount}</td>
                        <td><span className="badge badge-gray">{p.method === 'cash' ? '💵 Cash' : '💳 Online'}</span></td>
                        <td style={{ color: '#6B7280', fontSize: 13 }}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                        <td><span className={`badge ${p.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                      </tr>
                    ))}
                    {payments.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>No payments yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* REVIEWS TAB */}
          {activeTab === 'reviews' && (
            <>
              <div className="page-header"><h1>⭐ Reviews Management</h1></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {reviews.map(r => (
                  <div key={r._id} className="card" style={{ padding: 20, opacity: r.isVisible ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{r.user?.name || 'User'}</div>
                        <div style={{ fontSize: 13, color: '#6B7280' }}>for driver {r.driver?.name || '-'} • {new Date(r.createdAt).toLocaleDateString('en-IN')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ color: '#F5A623', fontSize: 16 }}>{'⭐'.repeat(r.rating)}</div>
                        {!r.isVisible && <span className="badge badge-gray">Hidden</span>}
                        <button className="action-btn" title={r.isVisible ? 'Hide review' : 'Show review'} onClick={() => toggleReview(r._id)}>{r.isVisible ? '🙈' : '👁'}</button>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6 }}>{r.comment || <em style={{ color: '#9CA3AF' }}>No comment</em>}</p>
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div className="empty-state"><div className="empty-icon">⭐</div><div className="empty-title">No reviews yet</div></div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
