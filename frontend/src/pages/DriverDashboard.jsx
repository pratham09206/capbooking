import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import socket, { joinDriver } from '../api/socket';

function playRideChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {}
}

const SIDEBAR_ITEMS = [
  { icon: '🏠', label: 'Dashboard', key: 'dashboard' },
  { icon: '🔔', label: 'Ride Requests', key: 'requests' },
  { icon: '🚗', label: 'Active Ride', key: 'active' },
  { icon: '📋', label: 'My Trips', key: 'trips' },
  { icon: '💰', label: 'Earnings', key: 'earnings' },
  { icon: '👤', label: 'Profile', key: 'profile' },
];

const phaseLabel = { going_pickup: 'Going to Pickup', arrived: 'Arrived at Pickup', ride_started: 'Ride In Progress', completed: 'Ride Completed' };
const phaseColor = { going_pickup: '#F59E0B', arrived: '#3B82F6', ride_started: '#22C55E', completed: '#8B5CF6' };
const phaseBtn = { going_pickup: '✅ I Arrived', arrived: '🚕 Start Ride', ride_started: '🏁 Complete Ride', completed: '✔ Done' };

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [requests, setRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [ridePhase, setRidePhase] = useState('going_pickup');
  const [earnings, setEarnings] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [incomingPopup, setIncomingPopup] = useState(null);
  const [popupTimer, setPopupTimer] = useState(30);

  // Check if driver is approved
  const isApproved = user?.isApproved;

  // Real-time socket events for driver (Uber / Rapido working)
  useEffect(() => {
    if (!isOnline || !isApproved || !user?._id) return;
    joinDriver(user._id);

    const onNewRide = (booking) => {
      setRequests(prev => {
        if (prev.some(r => r._id === booking._id)) return prev;
        return [booking, ...prev];
      });
      if (!activeRide) {
        setIncomingPopup(booking);
        setPopupTimer(30);
        playRideChime();
        toast('🔔 New Ride Request received!', { icon: '🛵', duration: 4000 });
      }
    };

    const onRideTaken = ({ bookingId }) => {
      setRequests(prev => prev.filter(r => r._id !== bookingId));
      setIncomingPopup(prev => prev?._id === bookingId ? null : prev);
    };

    socket.on('new_ride_request', onNewRide);
    socket.on('ride_taken', onRideTaken);

    return () => {
      socket.off('new_ride_request', onNewRide);
      socket.off('ride_taken', onRideTaken);
    };
  }, [isOnline, isApproved, user?._id, activeRide]);

  // Countdown timer for incoming request popup
  useEffect(() => {
    if (!incomingPopup) return;
    if (popupTimer > 0) {
      const t = setTimeout(() => setPopupTimer(s => s - 1), 1000);
      return () => clearTimeout(t);
    }
    if (popupTimer === 0) {
      setIncomingPopup(null);
    }
  }, [incomingPopup, popupTimer]);

  // Fetch pending ride requests
  const fetchRequests = useCallback(async () => {
    if (!isOnline || !isApproved) return;
    setLoadingRequests(true);
    try {
      const { data } = await api.get('/bookings/driver/requests');
      setRequests(data.bookings || []);
    } catch {
      // Silently handle (offline or no bookings)
    } finally {
      setLoadingRequests(false);
    }
  }, [isOnline, isApproved]);

  // Fetch active ride
  const fetchActiveRide = useCallback(async () => {
    try {
      const { data } = await api.get('/bookings/driver/active');
      if (data.booking) {
        setActiveRide(data.booking);
        // Map backend status to frontend phase
        const statusMap = {
          accepted: 'going_pickup',
          driver_arriving: 'going_pickup',
          driver_arrived: 'arrived',
          ride_started: 'ride_started',
        };
        setRidePhase(statusMap[data.booking.status] || 'going_pickup');
      }
    } catch { }
  }, []);

  // Fetch earnings
  const fetchEarnings = useCallback(async () => {
    try {
      const { data } = await api.get('/driver/earnings');
      setEarnings(data);
    } catch { }
  }, []);

  // Fetch trips
  const fetchTrips = useCallback(async () => {
    try {
      const { data } = await api.get('/driver/trips');
      setTrips(data.bookings || []);
    } catch { }
  }, []);

  useEffect(() => {
    fetchActiveRide();
    fetchEarnings();
  }, []);

  // Poll requests every 8s when online
  useEffect(() => {
    if (!isOnline || !isApproved) return;
    fetchRequests();
    const interval = setInterval(fetchRequests, 8000);
    return () => clearInterval(interval);
  }, [isOnline, isApproved, fetchRequests]);

  useEffect(() => {
    if (activeTab === 'trips') fetchTrips();
    if (activeTab === 'earnings') fetchEarnings();
    if (activeTab === 'requests') fetchRequests();
  }, [activeTab]);

  // Toggle online status
  const toggleOnline = async () => {
    if (!isApproved) {
      toast.error('Your account is pending admin approval.');
      return;
    }
    try {
      const { data } = await api.put('/driver/status');
      setIsOnline(data.isOnline);
      toast.success(data.message);
      if (data.isOnline) fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
    }
  };

  // Accept ride
  const acceptRide = async (req) => {
    try {
      const { data } = await api.put(`/bookings/${req._id}/accept`);
      setActiveRide(data.booking);
      setRidePhase('going_pickup');
      setRequests(prev => prev.filter(r => r._id !== req._id));
      setActiveTab('active');
      toast.success('Ride accepted! Head to pickup location.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not accept ride.');
    }
  };

  // Reject ride
  const rejectRide = (id) => setRequests(prev => prev.filter(r => r._id !== id));

  // Update ride phase
  const nextPhase = async () => {
    if (!activeRide) return;

    if (ridePhase === 'arrived' && !enteredOtp.trim()) {
      toast.error('Please enter the 4-digit passenger OTP to start the ride.');
      return;
    }

    const apiStatusMap = {
      going_pickup: 'driver_arrived',
      arrived: 'ride_started',
      ride_started: 'completed',
      completed: null,
    };

    const nextStatus = apiStatusMap[ridePhase];

    if (!nextStatus) {
      // Done
      setActiveRide(null);
      setRidePhase('going_pickup');
      setActiveTab('dashboard');
      fetchEarnings();
      return;
    }

    const nextFrontendPhase = {
      going_pickup: 'arrived',
      arrived: 'ride_started',
      ride_started: 'completed',
    };

    try {
      const payload = { status: nextStatus };
      if (nextStatus === 'ride_started') {
        payload.otp = enteredOtp.trim();
      }

      await api.put(`/bookings/${activeRide._id}/status`, payload);
      setRidePhase(nextFrontendPhase[ridePhase] || 'completed');
      setEnteredOtp('');
      toast.success('Status updated successfully!');

      if (nextStatus === 'completed') {
        setActiveRide(null);
        setRidePhase('going_pickup');
        setActiveTab('dashboard');
        fetchEarnings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
    }
  };

  return (
    <div className="sidebar-layout">
      {/* UBER / RAPIDO STYLE INCOMING RIDE REQUEST POPUP */}
      {incomingPopup && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: 'white',
            borderRadius: 24,
            maxWidth: 440,
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            border: '2px solid #F5A623',
          }}>
            {/* Header with Countdown */}
            <div style={{
              background: 'linear-gradient(135deg, #1E293B, #0F172A)',
              padding: '20px 24px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 32, animation: 'bounce 1s infinite' }}>{incomingPopup.cabIcon || '🛵'}</span>
                <div>
                  <div style={{ fontSize: 11, color: '#F5A623', fontWeight: 800, letterSpacing: 1 }}>NEW RIDE REQUEST</div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{incomingPopup.cabName || 'Bike Taxi'}</div>
                </div>
              </div>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '3px solid #F5A623',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 900,
                color: '#F5A623'
              }}>
                {popupTimer}s
              </div>
            </div>

            {/* Fare & Trip distance */}
            <div style={{ padding: '24px 24px 16px', textAlign: 'center', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>ESTIMATED EARNINGS</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
                ₹{incomingPopup.totalFare}
              </div>
              <div style={{ display: 'inline-block', background: '#ECFDF5', color: '#059669', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20, marginTop: 6 }}>
                📍 {incomingPopup.distance} km • {incomingPopup.paymentMethod === 'cash' ? '💵 Cash' : '💳 Online'}
              </div>
            </div>

            {/* Route Details */}
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22C55E', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>PICKUP POINT</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{incomingPopup.pickup?.address}</div>
                </div>
              </div>
              <div style={{ width: 2, height: 14, background: '#CBD5E1', marginLeft: 5, marginBottom: 6 }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: '3px', background: '#EF4444', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>DROP DESTINATION</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{incomingPopup.drop?.address}</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, padding: '16px 24px 24px' }}>
              <button
                onClick={() => setIncomingPopup(null)}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: 14,
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#64748B',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer'
                }}
              >
                ✕ Decline
              </button>
              <button
                onClick={async () => {
                  const req = incomingPopup;
                  setIncomingPopup(null);
                  await acceptRide(req);
                }}
                style={{
                  flex: 2,
                  padding: '14px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: 16,
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(34, 197, 94, 0.4)'
                }}
              >
                ✅ Accept Ride (₹{incomingPopup.totalFare})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🚕</div>
          <span>Cab<span style={{ color: '#F5A623' }}>Go</span></span>
        </div>

        {/* ONLINE TOGGLE */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Status</span>
            <div className={`toggle ${isOnline ? 'on' : ''}`} onClick={toggleOnline}>
              <div className="toggle-thumb" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <div className={`online-dot ${isOnline ? 'online' : 'offline'}`} />
            <span style={{ fontWeight: 600, color: isOnline ? '#22C55E' : '#6B7280' }}>
              {isOnline ? 'Online — Accepting Rides' : 'Offline'}
            </span>
          </div>
          {!isApproved && (
            <div style={{ fontSize: 12, color: '#DC2626', marginTop: 6, background: '#FEE2E2', padding: '6px 10px', borderRadius: 6 }}>
              ⏳ Pending admin approval
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {SIDEBAR_ITEMS.map(item => (
            <div key={item.key} className={`sidebar-item ${activeTab === item.key ? 'active' : ''}`} onClick={() => setActiveTab(item.key)}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.key === 'requests' && requests.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#EF4444', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{requests.length}</span>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="sidebar-profile-avatar">{user?.name?.[0]}</div>
            <div className="sidebar-profile-info">
              <div className="sidebar-profile-name">{user?.name}</div>
              <div className="sidebar-profile-role">Driver Partner</div>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} style={{ background: 'none', fontSize: 16, cursor: 'pointer' }} title="Logout">🚪</button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
        <div className="page-content">

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <>
              <div className="page-header">
                <h1>Good to see you, {user?.name?.split(' ')[0]}! 👋</h1>
                <p>{isOnline ? '🟢 You are online and accepting rides' : '🔴 Go online to start accepting rides'}</p>
              </div>

              {!isOnline && (
                <div style={{ background: 'linear-gradient(135deg, #1A1A2E, #0F3460)', borderRadius: 16, padding: 28, marginBottom: 24, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Start Earning Today! 💰</div>
                    <div style={{ opacity: 0.7, fontSize: 14 }}>Go online to receive ride requests in your area</div>
                  </div>
                  <button className="btn btn-primary btn-lg" onClick={toggleOnline}>🟢 Go Online</button>
                </div>
              )}

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon orange">💰</div>
                  <div><div className="stat-value">₹{earnings?.today?.earnings || 0}</div><div className="stat-label">Today's Earnings</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green">🚕</div>
                  <div><div className="stat-value">{earnings?.today?.rides || 0}</div><div className="stat-label">Rides Today</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon blue">📅</div>
                  <div><div className="stat-value">₹{earnings?.week?.earnings || 0}</div><div className="stat-label">This Week</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon purple">⭐</div>
                  <div><div className="stat-value">{earnings?.rating || user?.rating || '0'}</div><div className="stat-label">Avg Rating</div></div>
                </div>
              </div>

              {/* WEEKLY CHART */}
              <div className="card" style={{ padding: 24, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>📊 This Week's Earnings</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120, paddingBottom: 8, borderBottom: '2px solid #F3F4F6' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                    const val = earnings?.daily?.[i] || 0;
                    const max = Math.max(...(earnings?.daily || [1]));
                    return (
                      <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>₹{val}</div>
                        <div style={{ width: '100%', height: `${max > 0 ? (val / max) * 100 : 8}px`, background: '#F5A623', borderRadius: '4px 4px 0 0', minHeight: 8 }} />
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{day}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 14 }}>
                  <span style={{ color: '#6B7280' }}>Weekly Total</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: '#F5A623' }}>₹{earnings?.week?.earnings || 0}</span>
                </div>
              </div>
            </>
          )}

          {/* REQUESTS TAB */}
          {activeTab === 'requests' && (
            <>
              <div className="page-header">
                <h1>🔔 Ride Requests</h1>
                <p>{requests.length} pending request{requests.length !== 1 ? 's' : ''}</p>
              </div>

              {!isOnline && (
                <div style={{ background: '#FEF9C3', border: '1px solid #F59E0B', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 24 }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>You are Offline</div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>Go online to start receiving ride requests</div>
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={toggleOnline}>Go Online</button>
                </div>
              )}

              {requests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔔</div>
                  <div className="empty-title">No ride requests</div>
                  <div className="empty-desc">{isOnline ? 'Waiting for new requests...' : 'Go online to receive requests'}</div>
                  {isOnline && <div style={{ marginTop: 16, fontSize: 13, color: '#9CA3AF' }}>Auto-refreshing every 8 seconds</div>}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {requests.map(req => (
                    <div key={req._id} className="booking-request">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 17 }}>🔔 New Ride Request</div>
                          <div style={{ fontSize: 12, color: '#9CA3AF' }}>#{req._id.slice(-6).toUpperCase()}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 26, fontWeight: 900, color: '#F5A623' }}>₹{req.totalFare}</div>
                          <div style={{ fontSize: 12, color: '#9CA3AF' }}>{req.distance} km</div>
                        </div>
                      </div>

                      <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 20 }}>👤</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{req.user?.name}</div>
                            <div style={{ fontSize: 12, color: '#6B7280' }}>📱 {req.user?.phone}</div>
                          </div>
                        </div>
                        <div className="route-point" style={{ marginBottom: 6 }}>
                          <div className="route-dot pickup"></div>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{req.pickup?.address}</span>
                        </div>
                        <div style={{ width: 2, height: 14, background: '#E5E7EB', marginLeft: 4 }}></div>
                        <div className="route-point">
                          <div className="route-dot drop"></div>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{req.drop?.address}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => rejectRide(req._id)}>❌ Reject</button>
                        <button className="btn btn-success" style={{ flex: 2 }} onClick={() => acceptRide(req)}>✅ Accept Ride</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ACTIVE RIDE TAB */}
          {activeTab === 'active' && (
            <>
              <div className="page-header"><h1>🚗 Active Ride</h1></div>
              {!activeRide ? (
                <div className="empty-state">
                  <div className="empty-icon">🚗</div>
                  <div className="empty-title">No active ride</div>
                  <div className="empty-desc">Accept a ride request to start</div>
                </div>
              ) : (
                <div style={{ maxWidth: 560 }}>
                  <div style={{ background: `${phaseColor[ridePhase]}20`, border: `2px solid ${phaseColor[ridePhase]}`, borderRadius: 14, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>🚗</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: phaseColor[ridePhase] }}>{phaseLabel[ridePhase]}</div>
                      <div style={{ fontSize: 13, color: '#6B7280' }}>Update status as ride progresses</div>
                    </div>
                  </div>

                  <div style={{ height: 220, background: 'linear-gradient(135deg, #E0F2FE, #BAE6FD)', borderRadius: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 48, animation: 'bounce 1s infinite' }}>🚕</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0369A1', marginTop: 8 }}>{activeRide.pickup?.address} → {activeRide.drop?.address}</div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F5A623', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22 }}>{activeRide.user?.name?.[0]}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{activeRide.user?.name}</div>
                        <div style={{ fontSize: 13, color: '#6B7280' }}>📱 {activeRide.user?.phone}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#F5A623' }}>₹{activeRide.totalFare}</div>
                        <div style={{ fontSize: 12, color: '#9CA3AF' }}>{activeRide.distance} km</div>
                      </div>
                    </div>
                    <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 14px' }}>
                      <div className="route-point" style={{ marginBottom: 6 }}><div className="route-dot pickup"></div><span style={{ fontSize: 13 }}>{activeRide.pickup?.address}</span></div>
                      <div style={{ width: 2, height: 12, background: '#E5E7EB', marginLeft: 4 }}></div>
                      <div className="route-point"><div className="route-dot drop"></div><span style={{ fontSize: 13 }}>{activeRide.drop?.address}</span></div>
                    </div>
                  </div>

                  {ridePhase === 'arrived' && (
                    <div style={{ background: '#FEF3C7', border: '2px solid #F59E0B', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#92400E', marginBottom: 4 }}>
                        🔒 VERIFY PASSENGER START OTP
                      </div>
                      <div style={{ fontSize: 12, color: '#78350F', marginBottom: 10 }}>
                        Ask passenger for the 4-digit OTP shown on their screen to start this trip.
                      </div>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="Enter 4-Digit OTP"
                        value={enteredOtp}
                        onChange={e => setEnteredOtp(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          fontSize: 22,
                          fontWeight: 900,
                          letterSpacing: 8,
                          textAlign: 'center',
                          borderRadius: 10,
                          border: '2px solid #D97706',
                          outline: 'none',
                          background: 'white',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  )}

                  <button className="btn btn-primary btn-full btn-lg" onClick={nextPhase} style={{ borderRadius: 12, fontWeight: 800 }}>
                    {phaseBtn[ridePhase]}
                  </button>
                </div>
              )}
            </>
          )}

          {/* EARNINGS TAB */}
          {activeTab === 'earnings' && (
            <>
              <div className="page-header"><h1>💰 Earnings & Payouts</h1></div>
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                {[
                  { icon: '💵', label: "Today's Earnings", val: `₹${earnings?.today?.earnings || 0}`, color: 'orange' },
                  { icon: '📅', label: 'This Week', val: `₹${earnings?.week?.earnings || 0}`, color: 'green' },
                  { icon: '📆', label: 'This Month', val: `₹${earnings?.month?.earnings || 0}`, color: 'blue' },
                  { icon: '🚕', label: 'Total Rides', val: earnings?.totalRides || 0, color: 'purple' },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                    <div><div className="stat-value" style={{ fontSize: 20 }}>{s.val}</div><div className="stat-label">{s.label}</div></div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TRIPS TAB */}
          {activeTab === 'trips' && (
            <>
              <div className="page-header"><h1>📋 My Trips</h1></div>
              <div className="table-wrap">
                <div className="table-header">
                  <div className="table-title">Trip History</div>
                  <span className="badge badge-info">{trips.length} trips</span>
                </div>
                <table>
                  <thead><tr><th>ID</th><th>Passenger</th><th>Route</th><th>Fare</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {trips.map(t => (
                      <tr key={t._id}>
                        <td style={{ fontWeight: 600, color: '#6B7280' }}>#{t._id.slice(-6).toUpperCase()}</td>
                        <td>{t.user?.name || '-'}</td>
                        <td>{t.pickup?.address} → {t.drop?.address}</td>
                        <td style={{ fontWeight: 700, color: '#F5A623' }}>₹{t.totalFare}</td>
                        <td><span className={`badge ${t.status === 'completed' || t.status === 'paid' || t.status === 'rated' ? 'badge-success' : t.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>{t.status}</span></td>
                        <td style={{ color: '#6B7280', fontSize: 13 }}>{new Date(t.createdAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                    {trips.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>No trips yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <>
              <div className="page-header"><h1>👤 Driver Profile</h1></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
                <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F5A623', color: 'white', fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>{user?.name?.[0]}</div>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{user?.name}</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>{user?.email}</div>
                  <span className={`badge ${isApproved ? 'badge-success' : 'badge-warning'}`}>{isApproved ? '✅ Verified Driver' : '⏳ Pending Approval'}</span>
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: 20, color: '#F5A623' }}>{earnings?.rating || '0'}</div><div style={{ fontSize: 12, color: '#9CA3AF' }}>Rating</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: 20 }}>{earnings?.totalRides || 0}</div><div style={{ fontSize: 12, color: '#9CA3AF' }}>Trips</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: 20 }}>₹{earnings?.totalEarnings || 0}</div><div style={{ fontSize: 12, color: '#9CA3AF' }}>Total</div></div>
                  </div>
                </div>
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Personal Information</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[{ label: 'Full Name', val: user?.name }, { label: 'Email', val: user?.email }, { label: 'Phone', val: user?.phone }].map(f => (
                      <div key={f.label} className="form-group">
                        <label className="form-label">{f.label}</label>
                        <input className="form-input" defaultValue={f.val} readOnly style={{ background: '#F9FAFB' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
