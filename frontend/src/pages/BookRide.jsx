import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import MapView, { geocode, reverseGeocode, getRoute } from '../components/MapView';
import socket, { joinBookingRoom } from '../api/socket';

const CAB_TYPES = [
  { id: 'bike',  name: 'Bike Taxi (Moto)', icon: '🛵', seats: 1, rate: 5,  desc: 'Fastest in Traffic • Sanitized Helmet Provided', baseFare: 15, eta: '2 min', tag: '⚡ Fastest & Cheapest' },
  { id: 'auto',  name: 'Auto',             icon: '🛺', seats: 3, rate: 8,  desc: 'Doorstep Pickup • 3 Seats • Economical',       baseFare: 20, eta: '3 min', tag: '🛺 Economical' },
  { id: 'mini',  name: 'Mini Cab',         icon: '🚗', seats: 4, rate: 12, desc: 'Compact AC • 4 Seats • Budget Friendly',     baseFare: 30, eta: '4 min', tag: '❄️ Budget AC' },
  { id: 'sedan', name: 'Sedan Prime',      icon: '🚕', seats: 4, rate: 16, desc: 'Top Rated Captains • Extra Legroom • AC',     baseFare: 50, eta: '5 min', tag: '⭐ Popular' },
  { id: 'suv',   name: 'SUV XL',           icon: '🚙', seats: 6, rate: 22, desc: 'Spacious 6-Seater • AC • Luggage Space',      baseFare: 80, eta: '7 min', tag: '👑 Premium' },
];

const POPULAR_HUBS = [
  'Surat Railway Station',
  'Surat Airport, Dumas Rd',
  'VR Mall, Dumas Rd',
  'Adajan Patiya',
  'Vesu Canal Road',
  'Ghod Dod Road',
  'Katargam Darwaja',
];

const SURAT_LOCATIONS = [
  'Adajan, Surat', 'Vesu, Surat', 'Citylight, Surat', 'Athwa, Surat',
  'Althan, Surat', 'Dumas Road, Surat', 'Varachha, Surat', 'Katargam, Surat',
  'Udhna, Surat', 'Piplod, Surat', 'Bhatar, Surat', 'Palanpur Patiya, Surat',
  'Ring Road, Surat', 'Ghod Dod Road, Surat', 'Pal, Surat', 'Umra, Surat',
  'Nanpura, Surat', 'Rander, Surat', 'Bardoli, Surat', 'Ichchhapor, Surat',
  'Surat Railway Station', 'Surat Airport', 'VR Mall, Surat'
];

export default function BookRide() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form state
  const [pickup, setPickup] = useState(searchParams.get('pickup') || '');
  const [drop, setDrop] = useState(searchParams.get('drop') || '');
  const [pickupSuggest, setPickupSuggest] = useState([]);
  const [dropSuggest, setDropSuggest] = useState([]);
  const [selectedCab, setSelectedCab] = useState(searchParams.get('cab') || 'bike');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Map state
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords, setDropCoords] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [cabPosition, setCabPosition] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const animFrameRef = useRef(null);

  // Booking flow state
  const [step, setStep] = useState('select'); // select | confirm | searching | driver_found | tracking | completed | rating
  const [booking, setBooking] = useState(null);
  const [assignedDriver, setAssignedDriver] = useState(null);
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sosActive, setSosActive] = useState(false);

  // Rating
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  // Online Drivers list for customer selection
  const [onlineDrivers, setOnlineDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Fetch online drivers
  const fetchOnlineDrivers = useCallback(async () => {
    try {
      const { data } = await api.get('/driver/online');
      setOnlineDrivers(data.drivers || []);
    } catch { }
  }, []);

  useEffect(() => {
    fetchOnlineDrivers();
    const interval = setInterval(fetchOnlineDrivers, 10000);
    return () => clearInterval(interval);
  }, [fetchOnlineDrivers]);

  const selectedCabData = CAB_TYPES.find(c => c.id === selectedCab) || CAB_TYPES[0];
  const distance = routeDistance || 5;
  const fare = selectedCabData ? selectedCabData.baseFare + Math.round(distance * selectedCabData.rate) : 0;

  const filterLoc = (val) => SURAT_LOCATIONS.filter(l => l.toLowerCase().includes(val.toLowerCase()));

  // GPS Current Location fetch (Rapido style)
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('GPS Geolocation is not supported by your browser.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPickupCoords({ lat: latitude, lng: longitude });
        const addr = await reverseGeocode(latitude, longitude);
        setPickup(addr || 'My Current Location');
        setLocatingGps(false);
        toast.success('📍 Current location detected!');
      },
      (err) => {
        setLocatingGps(false);
        // Default to central Surat if permission denied or unavailable
        setPickup('Adajan, Surat');
        toast('Using Adajan as default pickup point.');
      },
      { timeout: 8000 }
    );
  };

  // Map Click handler (Rapido style pin dropping)
  const handleMapClick = async (latlng) => {
    if (step !== 'select') return;
    const { lat, lng } = latlng;
    toast('Fetching address for pinned point...');
    const address = await reverseGeocode(lat, lng);
    if (!pickup) {
      setPickup(address);
      setPickupCoords({ lat, lng });
      toast.success(`📍 Pickup set: ${address}`);
    } else {
      setDrop(address);
      setDropCoords({ lat, lng });
      toast.success(`🏁 Destination set: ${address}`);
    }
  };

  // Geocode pickup when selected
  useEffect(() => {
    if (!pickup) { setPickupCoords(null); setRouteCoords(null); return; }
    const timerId = setTimeout(async () => {
      setGeocoding(true);
      const coords = await geocode(pickup);
      if (coords) setPickupCoords(coords);
      setGeocoding(false);
    }, 500);
    return () => clearTimeout(timerId);
  }, [pickup]);

  // Geocode drop when selected
  useEffect(() => {
    if (!drop) { setDropCoords(null); setRouteCoords(null); return; }
    const timerId = setTimeout(async () => {
      setGeocoding(true);
      const coords = await geocode(drop);
      if (coords) setDropCoords(coords);
      setGeocoding(false);
    }, 500);
    return () => clearTimeout(timerId);
  }, [drop]);

  // Draw route when both coords available
  useEffect(() => {
    if (!pickupCoords || !dropCoords) return;
    const fetchRoute = async () => {
      setGeocoding(true);
      const route = await getRoute(pickupCoords, dropCoords);
      if (route) {
        setRouteCoords(route.coords);
        setRouteDistance(route.distanceKm);
        setRouteDuration(route.durationMin);
      }
      setGeocoding(false);
    };
    fetchRoute();
  }, [pickupCoords, dropCoords]);

  // Animate cab along route during tracking
  useEffect(() => {
    if (step !== 'tracking' || !routeCoords || routeCoords.length < 2) return;
    let idx = 0;
    const animate = () => {
      if (idx >= routeCoords.length) {
        setCabPosition({ lat: routeCoords[routeCoords.length - 1][0], lng: routeCoords[routeCoords.length - 1][1] });
        return;
      }
      setCabPosition({ lat: routeCoords[idx][0], lng: routeCoords[idx][1] });
      idx++;
      animFrameRef.current = setTimeout(animate, 150);
    };
    // Start from pickup
    setCabPosition({ lat: routeCoords[0][0], lng: routeCoords[0][1] });
    animFrameRef.current = setTimeout(animate, 800);
    return () => clearTimeout(animFrameRef.current);
  }, [step, routeCoords]);

  // Create booking on backend
  const handleBook = async () => {
    if (!pickup || !drop || !selectedCab) return;
    setLoading(true);
    try {
      const { data } = await api.post('/bookings', {
        pickupAddress: pickup,
        dropAddress: drop,
        cabType: selectedCab,
        distance: distance,
        paymentMethod,
        driverId: selectedDriverId || undefined,
      });
      setBooking(data.booking);
      setOtp(data.booking.otp);
      setStep('searching');
      setTimer(15);
      toast.success(selectedDriverId ? '🚀 Request sent directly to chosen Driver!' : '🚀 Request sent! Finding nearby Captain...');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Real-time socket events (Uber / Rapido working)
  useEffect(() => {
    if (!booking?._id) return;
    joinBookingRoom(booking._id);

    const onRideAccepted = ({ booking: b }) => {
      setAssignedDriver(b.driver);
      setBooking(b);
      setStep('driver_found');
      toast.success('🎉 Rapido Captain found and accepted your ride!');
    };

    const onStatusUpdate = ({ status, booking: b }) => {
      setBooking(b);
      if (status === 'driver_arrived') {
        toast('📍 Captain has arrived at your pickup location!', { icon: '🚖', duration: 6000 });
      } else if (status === 'ride_started') {
        setStep('tracking');
        toast.success('🚀 Ride started! Live tracking active.');
      } else if (status === 'completed') {
        setStep('completed');
        toast.success('🏁 Destination reached! Ride completed.');
      }
    };

    const onLocationUpdate = ({ lat, lng }) => {
      if (lat && lng) {
        setCabPosition({ lat, lng });
      }
    };

    socket.on('ride_accepted', onRideAccepted);
    socket.on('ride_status_update', onStatusUpdate);
    socket.on('driver_location_update', onLocationUpdate);

    return () => {
      socket.off('ride_accepted', onRideAccepted);
      socket.off('ride_status_update', onStatusUpdate);
      socket.off('driver_location_update', onLocationUpdate);
    };
  }, [booking?._id]);

  // Fallback count down + poll for driver
  useEffect(() => {
    if (step !== 'searching') return;
    if (timer > 0) {
      const t = setTimeout(() => setTimer(t => t - 1), 1000);
      return () => clearTimeout(t);
    }
    if (timer === 0) pollForDriver();
  }, [step, timer]);

  const pollForDriver = useCallback(async () => {
    if (!booking?._id) return;
    try {
      const { data } = await api.get(`/bookings/${booking._id}`);
      if (data.booking.driver) {
        setAssignedDriver(data.booking.driver);
        setBooking(data.booking);
        setStep('driver_found');
        toast.success('🎉 Rapido Captain Accepted Your Ride!');
      } else {
        setTimeout(pollForDriver, 4000);
      }
    } catch {
      setTimeout(pollForDriver, 4000);
    }
  }, [booking]);

  // Confirm payment
  const handlePayment = async () => {
    if (!booking?._id) return;
    setLoading(true);
    try {
      await api.post('/payments', { bookingId: booking._id, method: paymentMethod });
      setStep('rating');
      toast.success('Payment confirmed! 💰');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  // Submit rating
  const handleRating = async () => {
    if (!rating) return;
    setLoading(true);
    try {
      await api.post('/reviews', { bookingId: booking._id, rating, comment: ratingComment });
      toast.success('⭐ Thanks for rating your Captain!');
      navigate('/');
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  // Share ride details
  const shareRide = () => {
    const text = `🚕 Tracking My Ride with CabGo!\nCaptain: ${assignedDriver?.name} (${selectedCabData?.name})\nVehicle: ${assignedDriver?.vehicleDetails?.number || 'GJ-05'}\nOTP: ${otp}\nPickup: ${pickup}\nDrop: ${drop}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success('📋 Ride details copied to clipboard!');
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#F9FAFB' }}>

      {/* SOS Modal */}
      {sosActive && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 50, marginBottom: 12 }}>🚨</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#DC2626', marginBottom: 8 }}>Emergency Safety SOS</h3>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
              If you feel unsafe, use the direct helpline numbers below or share your live ride status with friends/family.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <a href="tel:112" style={{ background: '#DC2626', color: 'white', padding: '12px 16px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                📞 Call Police Emergency (112)
              </a>
              <a href="tel:1091" style={{ background: '#EA580C', color: 'white', padding: '12px 16px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                🛡️ Women Helpline (1091)
              </a>
              <button onClick={shareRide} style={{ background: '#2563EB', color: 'white', border: 'none', padding: '12px 16px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                📲 Share Live Trip with Family
              </button>
            </div>
            <button onClick={() => setSosActive(false)} style={{ background: '#E5E7EB', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* RAPIDO-STYLE LAYOUT: Left panel + Full map */}
      {(step === 'select' || step === 'confirm') && (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

          {/* ── LEFT PANEL ─────────────────────────────────── */}
          <div style={{ width: 420, flexShrink: 0, background: 'white', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 20px rgba(0,0,0,0.08)', zIndex: 10, overflowY: 'auto' }}>

            {step === 'select' && (
              <div style={{ padding: 20, flex: 1 }}>
                
                {/* Header Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}>🛵</span> Rapido Fast Booking
                  </div>
                  <span style={{ fontSize: 11, background: '#FEF3C7', color: '#B45309', padding: '3px 8px', borderRadius: 12, fontWeight: 700 }}>
                    ⚡ Lowest Fares
                  </span>
                </div>

                {/* Location inputs — Rapido style */}
                <div style={{ background: '#F8FAFC', borderRadius: 16, padding: 16, marginBottom: 16, border: '1px solid #E2E8F0' }}>
                  
                  {/* PICKUP */}
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid #22C55E', borderRadius: 12, padding: '10px 12px', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                      <input
                        style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontWeight: 600, background: 'transparent' }}
                        placeholder="Enter Pickup Location"
                        value={pickup}
                        onChange={e => { setPickup(e.target.value); setPickupSuggest(filterLoc(e.target.value)); }}
                      />
                      <button
                        onClick={handleCurrentLocation}
                        title="Use Current GPS Location"
                        style={{ background: '#DCFCE7', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#15803D', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {locatingGps ? '⏳' : '📍 GPS'}
                      </button>
                      {pickup && <button onClick={() => { setPickup(''); setPickupCoords(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16 }}>✕</button>}
                    </div>

                    {pickupSuggest.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto' }}>
                        {pickupSuggest.slice(0, 6).map(l => (
                          <div key={l} onClick={() => { setPickup(l); setPickupSuggest([]); }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #F1F5F9' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FEF3C7'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                            <span style={{ color: '#22C55E' }}>📍</span> {l}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Divider line */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 4px', margin: '4px 0' }}>
                    <div style={{ width: 2, height: 16, background: '#CBD5E1', marginLeft: 5 }} />
                  </div>

                  {/* DROP */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid #EF4444', borderRadius: 12, padding: '10px 12px', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '3px', background: '#EF4444', flexShrink: 0 }} />
                      <input
                        style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontWeight: 600, background: 'transparent' }}
                        placeholder="Where to? (Drop destination)"
                        value={drop}
                        onChange={e => { setDrop(e.target.value); setDropSuggest(filterLoc(e.target.value)); }}
                      />
                      {drop && <button onClick={() => { setDrop(''); setDropCoords(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16 }}>✕</button>}
                    </div>

                    {dropSuggest.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto' }}>
                        {dropSuggest.slice(0, 6).map(l => (
                          <div key={l} onClick={() => { setDrop(l); setDropSuggest([]); }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #F1F5F9' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FEF3C7'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                            <span style={{ color: '#EF4444' }}>🏁</span> {l}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hotspot Quick Select */}
                {(!pickup || !drop) && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>🔥 POPULAR LOCATIONS IN SURAT</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {POPULAR_HUBS.map(hub => (
                        <button
                          key={hub}
                          onClick={() => {
                            if (!pickup) setPickup(hub);
                            else if (!drop) setDrop(hub);
                          }}
                          style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 20, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, color: '#334155' }}
                        >
                          + {hub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Route info pill */}
                {geocoding && (
                  <div style={{ textAlign: 'center', padding: '10px', fontSize: 13, color: '#64748B', background: '#F8FAFC', borderRadius: 10, marginBottom: 14 }}>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Calculating road route with OSRM...
                  </div>
                )}

                {routeDistance && !geocoding && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: '#ECFDF5', borderRadius: 12, padding: '10px 14px', textAlign: 'center', border: '1px solid #A7F3D0' }}>
                      <div style={{ fontWeight: 800, color: '#059669', fontSize: 18 }}>{routeDistance} km</div>
                      <div style={{ fontSize: 11, color: '#047857' }}>Road Distance</div>
                    </div>
                    <div style={{ flex: 1, background: '#FEF3C7', borderRadius: 12, padding: '10px 14px', textAlign: 'center', border: '1px solid #FDE68A' }}>
                      <div style={{ fontWeight: 800, color: '#D97706', fontSize: 18 }}>{routeDuration} min</div>
                      <div style={{ fontSize: 11, color: '#B45309' }}>Est. Travel Time</div>
                    </div>
                  </div>
                )}

                {/* CAB OPTIONS — Rapido style vertical list */}
                {pickup && drop && routeDistance && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>SELECT RIDE</span>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>Fares include platform fee</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                      {CAB_TYPES.map(cab => {
                        const totalFare = cab.baseFare + Math.round(routeDistance * cab.rate) + 5;
                        const isSelected = selectedCab === cab.id;
                        return (
                          <div key={cab.id}
                            onClick={() => setSelectedCab(cab.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                              border: `2px solid ${isSelected ? '#F5A623' : '#E2E8F0'}`,
                              borderRadius: 14, cursor: 'pointer',
                              background: isSelected ? 'rgba(245,166,35,0.06)' : 'white',
                              transition: 'all 0.2s',
                              position: 'relative'
                            }}>
                            
                            {/* Tag */}
                            {cab.tag && (
                              <div style={{
                                position: 'absolute', top: -9, right: 12,
                                background: cab.id === 'bike' ? '#E11D48' : cab.tag.includes('Popular') ? '#F5A623' : cab.tag.includes('Economical') ? '#10B981' : '#64748B',
                                color: 'white', fontSize: 10, fontWeight: 800,
                                padding: '2px 8px', borderRadius: 10,
                              }}>{cab.tag}</div>
                            )}

                            <div style={{ fontSize: 34 }}>{cab.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>{cab.name}</div>
                              <div style={{ fontSize: 12, color: '#64748B' }}>{cab.desc}</div>
                              <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, marginTop: 2 }}>⚡ Arrives in {cab.eta}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 900, fontSize: 19, color: isSelected ? '#F5A623' : '#0F172A' }}>₹{totalFare}</div>
                              <div style={{ fontSize: 11, color: '#94A3B8' }}>₹{cab.rate}/km</div>
                            </div>
                            {isSelected && (
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F5A623', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>✓</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Bike Helmet Safety Banner */}
                    {selectedCab === 'bike' && (
                      <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>⛑️</span>
                        <div style={{ fontSize: 12, color: '#9F1239', fontWeight: 600 }}>
                          Helmet Mandatory: Your Rapido Captain carries a sanitized helmet for you!
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* CTA Button */}
                {selectedCabData && routeDistance && (
                  <button
                    className="btn btn-primary btn-full btn-lg"
                    onClick={() => setStep('confirm')}
                    style={{ position: 'sticky', bottom: 0, borderRadius: 14, fontSize: 16, fontWeight: 800 }}
                  >
                    Proceed with {selectedCabData.name} → ₹{fare + 5}
                  </button>
                )}

                {!pickup || !drop ? (
                  <div style={{ textAlign: 'center', marginTop: 24, padding: 16, background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
                    💡 Tip: Click anywhere on the map or choose popular places above to pick location
                  </div>
                ) : null}
              </div>
            )}

            {/* ── CONFIRM STEP ── */}
            {step === 'confirm' && selectedCabData && (
              <div style={{ padding: 20, flex: 1 }}>
                <button onClick={() => setStep('select')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  ← Back to vehicle selection
                </button>
                
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: '#0F172A' }}>📋 Booking Review</div>

                {/* Route */}
                <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 16, border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22C55E' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{pickup}</span>
                  </div>
                  <div style={{ width: 2, height: 16, background: '#CBD5E1', marginLeft: 5, marginBottom: 8 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '3px', background: '#EF4444' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{drop}</span>
                  </div>
                </div>

                {/* Selected cab */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(245,166,35,0.08)', border: '2px solid #F5A623', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                  <span style={{ fontSize: 36 }}>{selectedCabData.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{selectedCabData.name}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{selectedCabData.desc}</div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: '#F5A623' }}>₹{fare + 5}</div>
                </div>

                {/* Fare breakdown */}
                <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16, marginBottom: 16, fontSize: 13, border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#64748B' }}>
                    <span>Base Fare</span><span>₹{selectedCabData.baseFare}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#64748B' }}>
                    <span>Distance Fare ({routeDistance} km × ₹{selectedCabData.rate}/km)</span>
                    <span>₹{Math.round(routeDistance * selectedCabData.rate)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: '#64748B' }}>
                    <span>Platform Fee & Taxes</span><span>₹5</span>
                  </div>
                  <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18 }}>
                    <span>Final Total</span><span style={{ color: '#F5A623' }}>₹{fare + 5}</span>
                  </div>
                </div>

                {/* Payment Options */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#1E293B' }}>💳 PAYMENT MODE</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[{ val: 'cash', label: '💵 Cash to Captain', desc: 'Pay after ride' }, { val: 'online', label: '💳 UPI / Online', desc: 'Prepaid' }].map(p => (
                      <label key={p.val} style={{ flex: 1, padding: '12px', border: `2px solid ${paymentMethod === p.val ? '#F5A623' : '#E2E8F0'}`, borderRadius: 12, cursor: 'pointer', background: paymentMethod === p.val ? 'rgba(245,166,35,0.08)' : 'white', textAlign: 'center' }}>
                        <input type="radio" value={p.val} checked={paymentMethod === p.val} onChange={() => setPaymentMethod(p.val)} style={{ display: 'none' }} />
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{p.label}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>{p.desc}</div>
                      </label>
                    ))}
                  </div>
                </div>

                <button className="btn btn-primary btn-full btn-lg" onClick={handleBook} disabled={loading} style={{ borderRadius: 14, fontSize: 16, fontWeight: 800 }}>
                  {loading ? '⏳ Contacting Captains...' : `⚡ Book ${selectedCabData.name} — ₹${fare + 5}`}
                </button>
              </div>
            )}
          </div>

          {/* ── FULL MAP ─────────────────────────────────── */}
          <div style={{ flex: 1, position: 'relative' }}>
            <MapView
              pickupCoords={pickupCoords}
              dropCoords={dropCoords}
              routeCoords={routeCoords}
              pickup={pickup}
              drop={drop}
              cabType={selectedCab}
              phase="select"
              onMapClick={handleMapClick}
            />
            {geocoding && (
              <div style={{ position: 'absolute', top: 16, right: 16, background: 'white', borderRadius: 24, padding: '8px 18px', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 1000 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #F5A623', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                Updating route...
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 20, left: 20, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#334155', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 900 }}>
              💡 Click on map to set Pickup / Destination pin
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCHING STEP ── */}
      {step === 'searching' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
          <div style={{ textAlign: 'center', maxWidth: 440, padding: 40, background: 'white', borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 72, marginBottom: 20, animation: 'bounce 1s infinite' }}>{selectedCabData.icon}</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#0F172A' }}>Connecting Rapido Captain...</h2>
            <p style={{ color: '#64748B', marginBottom: 28, fontSize: 14 }}>
              Locating the closest online captain near <span style={{ fontWeight: 700, color: '#0F172A' }}>{pickup}</span>
            </p>

            {/* Progress bar */}
            <div style={{ background: '#F1F5F9', borderRadius: 10, height: 8, marginBottom: 24, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #F5A623, #EF4444)', borderRadius: 10, width: `${((15 - timer) / 15) * 100}%`, transition: 'width 1s linear' }} />
            </div>

            <div style={{ width: 64, height: 64, borderRadius: '50%', border: '4px solid #F1F5F9', borderTopColor: '#F5A623', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            {timer > 0 && <div style={{ fontSize: 26, fontWeight: 900, color: '#F5A623' }}>{timer}s</div>}
            {timer === 0 && <div style={{ color: '#64748B', fontSize: 14 }}>Assigning nearby Captain... please wait</div>}

            <div style={{ marginTop: 24, background: '#F8FAFC', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
              <span>Booking ID:</span>
              <span style={{ fontWeight: 700, color: '#0F172A' }}>#{booking?._id?.slice(-6).toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── DRIVER FOUND STEP ── */}
      {step === 'driver_found' && assignedDriver && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 20 }}>
          <div style={{ maxWidth: 440, width: '100%' }}>
            
            {/* DRIVER FOUND CARD */}
            <div style={{
              background: 'white',
              borderRadius: 20,
              boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0'
            }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #0F172A, #1E293B)',
                padding: '18px 20px',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 26 }}>🚕</span>
                  <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 1 }}>DRIVER FOUND</span>
                </div>
                <div style={{ background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E50', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>
                  CONFIRMED
                </div>
              </div>

              {/* Driver Profile */}
              <div style={{ padding: '24px 24px 16px', textAlign: 'center', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F5A623, #EA580C)',
                  color: 'white',
                  fontSize: 28,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 8px 20px rgba(245,166,35,0.3)'
                }}>
                  {assignedDriver.name?.[0] || '👤'}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>
                  👤 {assignedDriver.name || 'Amit Patel'}
                </h3>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEF3C7', color: '#B45309', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                  <span>⭐</span>
                  <span>{assignedDriver.rating > 0 ? (assignedDriver.rating / (assignedDriver.totalRatings || 1)).toFixed(1) : '4.8'} / 5</span>
                </div>

                <div style={{ marginTop: 12 }}>
                  <a
                    href={`tel:${assignedDriver.phone}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#F1F5F9',
                      color: '#0284C7',
                      padding: '8px 16px',
                      borderRadius: 12,
                      textDecoration: 'none',
                      fontSize: 14,
                      fontWeight: 700
                    }}
                  >
                    📞 {assignedDriver.phone}
                  </a>
                </div>
              </div>

              {/* Cab & Vehicle Details */}
              <div style={{ padding: '16px 24px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', letterSpacing: 0.5, marginBottom: 10 }}>
                  VEHICLE DETAILS
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{selectedCabData?.icon || '🚕'}</span>
                    <span>{assignedDriver.vehicleDetails?.model || (selectedCab === 'bike' ? 'Honda Activa 6G' : selectedCab === 'auto' ? 'Bajaj Compact RE' : 'Swift Dzire')}</span>
                  </span>
                  <span style={{ background: '#E2E8F0', padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 800, color: '#334155' }}>
                    🚘 {assignedDriver.vehicleDetails?.number || 'GJ-05-AB-1234'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>👥</span>
                  <span>{assignedDriver.vehicleDetails?.seats || selectedCabData?.seats || 4} Seats Capacity</span>
                </div>
              </div>

              {/* Trip & Fare Info */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', letterSpacing: 0.5, marginBottom: 10 }}>
                  TRIP & FARE
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#22C55E' }}>📍</span>
                    <span style={{ color: '#64748B' }}>Pickup:</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{pickup}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#EF4444' }}>🏁</span>
                    <span style={{ color: '#64748B' }}>Drop:</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{drop}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingTop: 6, borderTop: '1px dashed #E2E8F0' }}>
                    <span>💰</span>
                    <span style={{ color: '#64748B' }}>Fare:</span>
                    <span style={{ fontWeight: 900, fontSize: 16, color: '#F5A623' }}>₹{fare + 5}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>({paymentMethod === 'cash' ? 'Cash' : 'Online'})</span>
                  </div>
                </div>
              </div>

              {/* Driver is Coming Badge + OTP */}
              <div style={{ padding: '16px 24px', background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E', animation: 'pulse 1.5s infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#15803D' }}>🟢 Driver is coming</span>
                </div>
                <div style={{ background: 'white', border: '1px solid #FDE68A', padding: '4px 10px', borderRadius: 8, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', display: 'block' }}>START OTP</span>
                  <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 2, color: '#D97706' }}>{otp}</span>
                </div>
              </div>

              {/* Track Driver CTA Button */}
              <div style={{ padding: '20px 24px' }}>
                <button
                  className="btn btn-primary btn-full btn-lg"
                  style={{ borderRadius: 14, fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => setStep('tracking')}
                >
                  📍 Track Driver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TRACKING STEP ── Rapido style split view with live map ── */}
      {step === 'tracking' && assignedDriver && (
        <div style={{ display: 'flex', height: '100%' }}>
          {/* Sidebar */}
          <div style={{ width: 380, flexShrink: 0, background: 'white', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 20px rgba(0,0,0,0.08)', zIndex: 10, padding: 20 }}>
            
            <div style={{ background: 'linear-gradient(135deg, #F5A623, #EA580C)', borderRadius: 16, padding: 16, color: 'white', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 4 }}>{selectedCabData.icon}</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Ride In Progress</div>
              <div style={{ opacity: 0.9, fontSize: 13, marginTop: 2 }}>{pickup} → {drop}</div>
            </div>

            {/* Captain details */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#F8FAFC', borderRadius: 14, padding: '14px 16px', marginBottom: 14, border: '1px solid #E2E8F0' }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#F5A623', color: 'white', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {assignedDriver.name?.[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: '#0F172A' }}>{assignedDriver.name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{selectedCabData?.name} • {assignedDriver.vehicleDetails?.number || 'GJ-05-BK-9921'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, color: '#F5A623', fontSize: 18 }}>₹{fare + 5}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{paymentMethod === 'cash' ? '💵 Cash' : '💳 Online'}</div>
              </div>
            </div>

            {/* OTP display */}
            <div style={{ background: '#FEF3C7', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #FDE68A' }}>
              <span style={{ fontWeight: 700, color: '#92400E' }}>Start OTP:</span>
              <span style={{ fontWeight: 900, fontSize: 20, color: '#D97706', letterSpacing: 4 }}>{otp}</span>
            </div>

            {/* Quick Actions (Call, SOS, Share) */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <a href={`tel:${assignedDriver.phone}`} style={{ flex: 1, textDecoration: 'none', background: '#F1F5F9', color: '#1E293B', padding: '10px 6px', borderRadius: 10, textAlign: 'center', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                📞 Call
              </a>
              <button onClick={shareRide} style={{ flex: 1, background: '#F1F5F9', border: 'none', color: '#1E293B', padding: '10px 6px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                📤 Share
              </button>
              <button onClick={() => setSosActive(true)} style={{ flex: 1, background: '#FEE2E2', border: 'none', color: '#DC2626', padding: '10px 6px', borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                🚨 SOS
              </button>
            </div>

            {/* Route details */}
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{pickup}</span>
              </div>
              <div style={{ width: 2, height: 12, background: '#CBD5E1', marginLeft: 3, marginBottom: 8 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '2px', background: '#EF4444' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{drop}</span>
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <button className="btn btn-success btn-full btn-lg" style={{ borderRadius: 14, fontWeight: 800 }} onClick={() => setStep('completed')}>
              ✅ Complete Ride
            </button>
          </div>

          {/* Live Map */}
          <div style={{ flex: 1, position: 'relative' }}>
            <MapView
              pickupCoords={pickupCoords}
              dropCoords={dropCoords}
              routeCoords={routeCoords}
              cabPosition={cabPosition}
              pickup={pickup}
              drop={drop}
              cabType={selectedCab}
              phase="tracking"
            />
            <div style={{ position: 'absolute', top: 16, left: 16, background: 'white', borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 1000 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite' }} />
              RAPIDO LIVE GPS TRACKING
            </div>
          </div>
        </div>
      )}

      {/* ── COMPLETED STEP ── */}
      {step === 'completed' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
          <div style={{ maxWidth: 480, width: '100%', padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8, color: '#0F172A' }}>Ride Completed!</h2>
            <p style={{ color: '#64748B', marginBottom: 24 }}>Hope you had a safe and swift ride with Captain {assignedDriver?.name}!</p>

            <div className="card" style={{ padding: 24, marginBottom: 20, textAlign: 'left', borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                <span style={{ color: '#64748B' }}>📍 {pickup}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14 }}>
                <span style={{ color: '#64748B' }}>🏁 {drop}</span>
              </div>
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14, color: '#64748B' }}>
                  <span>Distance Travelled</span><span>{routeDistance} km</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14, color: '#64748B' }}>
                  <span>Ride Duration</span><span>~{routeDuration} min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 900, marginTop: 10 }}>
                  <span>Total Due</span><span style={{ color: '#F5A623' }}>₹{fare + 5}</span>
                </div>
              </div>
            </div>

            <button className="btn btn-primary btn-full btn-lg" onClick={handlePayment} disabled={loading} style={{ borderRadius: 14, marginBottom: 10, fontWeight: 800 }}>
              {loading ? '⏳ Processing Payment...' : `💳 Pay ₹${fare + 5} — ${paymentMethod === 'cash' ? 'Cash' : 'Online'}`}
            </button>
          </div>
        </div>
      )}

      {/* ── RATING STEP ── */}
      {step === 'rating' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
          <div style={{ maxWidth: 440, width: '100%', padding: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 60, marginBottom: 12 }}>⭐</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A' }}>Rate Your Captain</h2>
              <p style={{ color: '#64748B' }}>How was your ride experience with {assignedDriver?.name}?</p>
            </div>

            <div className="card" style={{ padding: 24, borderRadius: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5A623', color: 'white', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {assignedDriver?.name?.[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{assignedDriver?.name}</div>
                  <div style={{ fontSize: 13, color: '#64748B' }}>{selectedCabData?.name}</div>
                  <div style={{ fontWeight: 800, color: '#10B981', fontSize: 14, marginTop: 2 }}>₹{fare + 5} Paid ✅</div>
                </div>
              </div>

              {/* Star rating */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} onClick={() => setRating(s)} style={{ fontSize: 44, cursor: 'pointer', filter: s <= rating ? 'none' : 'grayscale(1)', transition: 'all 0.2s', transform: s <= rating ? 'scale(1.15)' : 'scale(1)' }}>⭐</span>
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: 14, color: '#64748B', marginBottom: 20, fontWeight: 600 }}>
                {rating === 0 ? 'Tap stars to rate' : rating === 5 ? 'Superb! 5 Stars 🎉' : rating >= 4 ? 'Great Ride! 👍' : rating >= 3 ? 'Good 👌' : 'Needs improvement 😕'}
              </div>

              <textarea
                style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: 12, padding: '12px 14px', fontSize: 14, resize: 'none', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
                placeholder="Write a review for your captain (optional)..."
                rows={3}
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" style={{ flex: 1, borderRadius: 12 }} onClick={() => navigate('/')}>Skip</button>
                <button className="btn btn-primary" style={{ flex: 2, borderRadius: 12, fontWeight: 800 }} disabled={!rating || loading} onClick={handleRating}>
                  {loading ? '⏳ Submitting...' : '✅ Submit Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
