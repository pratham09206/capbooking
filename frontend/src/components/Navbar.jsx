import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path ? 'navbar-link active' : 'navbar-link';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <div className="logo-icon">🚕</div>
          Cab<span>Go</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className={isActive('/')}>Home</Link>
          {user?.role === 'user' && <Link to="/book" className={isActive('/book')}>Book Ride</Link>}
          {user?.role === 'user' && <Link to="/my-rides" className={isActive('/my-rides')}>My Rides</Link>}
          {user?.role === 'driver' && <Link to="/driver" className={isActive('/driver')}>Driver Dashboard</Link>}
          {user?.role === 'admin' && <Link to="/admin" className={isActive('/admin')}>Admin</Link>}
        </div>

        <div className="navbar-actions">
          {user ? (
            <>
              <div className="navbar-avatar" title={user.name}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
