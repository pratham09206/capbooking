import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CAB_TYPES = [
  { id: 'bike', name: 'Bike Taxi', icon: '🛵', seats: 1, rate: 5, desc: 'Fastest & Cheapest', eta: '2 min' },
  { id: 'auto', name: 'Auto', icon: '🛺', seats: 3, rate: 8, desc: 'Budget Friendly', eta: '3 min' },
  { id: 'mini', name: 'Mini', icon: '🚗', seats: 4, rate: 12, desc: 'Compact & Economical', eta: '4 min' },
  { id: 'sedan', name: 'Sedan', icon: '🚕', seats: 4, rate: 16, desc: 'Comfortable & Popular', eta: '5 min' },
  { id: 'suv', name: 'SUV', icon: '🚙', seats: 6, rate: 22, desc: 'Spacious & Premium', eta: '7 min' },
];

const LOCATIONS = [
  'Adajan, Surat', 'Vesu, Surat', 'Citylight, Surat', 'Athwa, Surat',
  'Althan, Surat', 'Palanpur, Surat', 'Dumas Road, Surat', 'Varachha, Surat',
  'Katargam, Surat', 'Udhna, Surat', 'Piplod, Surat', 'Bhatar, Surat',
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [pickupSuggest, setPickupSuggest] = useState([]);
  const [dropSuggest, setDropSuggest] = useState([]);

  const filterLocations = (val) => LOCATIONS.filter(l => l.toLowerCase().includes(val.toLowerCase()));

  return (
    <div>
      {/* HERO */}
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-text">
            <h1>Your Ride,<br /><span>Your Way 🚕</span></h1>
            <p>Book a cab in seconds. Safe, reliable & affordable.<br />Available 24/7 across Surat city.</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {['⭐ 4.9 Rated', '🚕 500+ Drivers', '📍 All Surat Areas', '💰 Best Prices'].map(f => (
                <div key={f} style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '8px 16px', borderRadius: 30, fontSize: 13, color: 'white', fontWeight: 600 }}>{f}</div>
              ))}
            </div>
          </div>

          {/* BOOKING CARD */}
          <div className="hero-booking-card">
            <h3>📍 Where do you want to go?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {/* PICKUP */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Pickup Location</label>
                <div className="input-icon-wrap">
                  <span className="icon" style={{ color: '#22C55E' }}>🟢</span>
                  <input className="form-input" placeholder="Enter pickup location" value={pickup}
                    onChange={e => { setPickup(e.target.value); setPickupSuggest(e.target.value ? filterLocations(e.target.value) : []); }} />
                </div>
                {pickupSuggest.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, zIndex: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}>
                    {pickupSuggest.map(l => (
                      <div key={l} onClick={() => { setPickup(l); setPickupSuggest([]); }}
                        style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={e => e.target.style.background = '#FEF9C3'}
                        onMouseLeave={e => e.target.style.background = 'white'}>
                        📍 {l}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DROP */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Drop Location</label>
                <div className="input-icon-wrap">
                  <span className="icon" style={{ color: '#EF4444' }}>🔴</span>
                  <input className="form-input" placeholder="Enter destination" value={drop}
                    onChange={e => { setDrop(e.target.value); setDropSuggest(e.target.value ? filterLocations(e.target.value) : []); }} />
                </div>
                {dropSuggest.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, zIndex: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}>
                    {dropSuggest.map(l => (
                      <div key={l} onClick={() => { setDrop(l); setDropSuggest([]); }}
                        style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={e => e.target.style.background = '#FEF9C3'}
                        onMouseLeave={e => e.target.style.background = 'white'}>
                        📍 {l}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button className="btn btn-primary btn-full btn-lg"
              onClick={() => { if (!user) navigate('/login'); else navigate(`/book?pickup=${encodeURIComponent(pickup)}&drop=${encodeURIComponent(drop)}`); }}>
              🔍 Search Cabs
            </button>

            {!user && <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#6B7280' }}>
              <Link to="/login" style={{ color: '#F5A623', fontWeight: 600 }}>Login</Link> or <Link to="/register" style={{ color: '#F5A623', fontWeight: 600 }}>Register</Link> to book a ride
            </div>}
          </div>
        </div>
      </section>

      {/* CAB TYPES */}
      <section className="section" style={{ background: 'white' }}>
        <div className="section-inner">
          <div className="section-header">
            <h2>Popular Rides for Every Budget</h2>
            <p>Choose from a wide range of vehicles that suit your needs</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {CAB_TYPES.map(cab => (
              <div key={cab.id} className="card card-hover" style={{ textAlign: 'center', padding: 28 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>{cab.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{cab.name}</h3>
                <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>{cab.desc}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span className="badge badge-gray">👥 {cab.seats} Seats</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: '#F5A623' }}>₹{cab.rate}/km</span>
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>⏱ ETA: {cab.eta}</div>
                <button className="btn btn-primary btn-full btn-sm" onClick={() => navigate(user ? `/book?cab=${cab.id}` : '/login')}>
                  Select {cab.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" style={{ background: '#F9FAFB' }}>
        <div className="section-inner">
          <div className="section-header">
            <h2>How CabGo Works in 3 Steps</h2>
            <p>Experience seamless cab booking designed for convenience & reliability</p>
          </div>
          <div className="steps-grid">
            {[
              { n: 1, icon: '📍', title: 'Enter Pickup & Drop', desc: 'Enter your current location and destination. We will find the best route and nearest drivers for you.' },
              { n: 2, icon: '🚕', title: 'Select Your Ride', desc: 'Choose from Mini, Sedan, SUV or Auto based on your budget and comfort preferences.' },
              { n: 3, icon: '🎯', title: 'Confirm & Arrive', desc: 'Book instantly and track your driver in real-time. Pay by cash or online — your choice!' },
            ].map(s => (
              <div key={s.n} className="step-card">
                <div className="step-number">{s.n}</div>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section" style={{ background: 'white' }}>
        <div className="section-inner">
          <div className="section-header">
            <h2>Surat's Highest Rated Cab Experience</h2>
            <p>What our customers say about us</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              { name: 'Priya Shah', rating: 5, text: 'Amazing service! Driver was very polite and the cab was clean. Reached on time!', loc: 'Adajan, Surat' },
              { name: 'Rohan Mehta', rating: 5, text: 'Best cab app in Surat. Affordable prices and very quick driver assignment. Love it!', loc: 'Vesu, Surat' },
              { name: 'Kavya Patel', rating: 4, text: 'Smooth booking experience. The real-time tracking feature is excellent!', loc: 'Citylight, Surat' },
            ].map(t => (
              <div key={t.name} className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F5A623', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>{t.name[0]}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{t.loc}</div>
                  </div>
                </div>
                <div style={{ color: '#F5A623', marginBottom: 10 }}>{'⭐'.repeat(t.rating)}</div>
                <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6 }}>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!user && (
        <section style={{ background: 'linear-gradient(135deg, #1A1A2E, #0F3460)', padding: '60px 24px', textAlign: 'center', color: 'white' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Ready to ride? 🚕</h2>
          <p style={{ opacity: 0.7, marginBottom: 28, fontSize: 16 }}>Join 50,000+ users who trust CabGo for their daily commute</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/register" className="btn btn-primary btn-lg">Get Started Free</Link>
            <Link to="/login" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '16px 32px', fontSize: 16, fontWeight: 600, borderRadius: 10 }}>Login</Link>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer style={{ background: '#111827', color: '#9CA3AF', padding: '40px 24px 24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 12 }}>Cab<span style={{ color: '#F5A623' }}>Go</span> 🚕</div>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>Surat's most trusted cab booking platform. Available 24/7.</p>
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 600, marginBottom: 12 }}>Quick Navigation</div>
              {['Home', 'Book Ride', 'My Rides', 'Driver Signup'].map(l => <div key={l} style={{ fontSize: 14, marginBottom: 8, cursor: 'pointer' }} onMouseEnter={e => e.target.style.color = '#F5A623'} onMouseLeave={e => e.target.style.color = '#9CA3AF'}>{l}</div>)}
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 600, marginBottom: 12 }}>Safety & Legal</div>
              {['Terms of Service', 'Privacy Policy', 'Cancellation Policy', 'Emergency Contact'].map(l => <div key={l} style={{ fontSize: 14, marginBottom: 8, cursor: 'pointer' }} onMouseEnter={e => e.target.style.color = '#F5A623'} onMouseLeave={e => e.target.style.color = '#9CA3AF'}>{l}</div>)}
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 600, marginBottom: 12 }}>24/7 Helpline</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F5A623', marginBottom: 8 }}>+91 98102 43210</div>
              <div style={{ fontSize: 14, marginBottom: 4 }}>📧 support@cabgo.in</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {['📱 App Store', '🤖 Play Store'].map(s => (
                  <div key={s} style={{ background: '#1F2937', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>{s}</div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #1F2937', paddingTop: 20, textAlign: 'center', fontSize: 13 }}>
            © 2025 CabGo Travel Mobility Services Pvt. Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
