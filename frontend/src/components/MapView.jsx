import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix default Leaflet icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom colored markers
const createIcon = (color, emoji) => L.divIcon({
  className: '',
  html: `<div style="
    background: ${color};
    width: 36px; height: 36px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid white;
    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <span style="transform: rotate(45deg); font-size: 15px;">${emoji}</span>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

export const getVehicleIcon = (cabType = 'sedan') => {
  const emoji = cabType === 'bike' ? '🛵' : cabType === 'auto' ? '🛺' : cabType === 'suv' ? '🚙' : '🚕';
  return L.divIcon({
    className: '',
    html: `<div style="
      background: linear-gradient(135deg, #F5A623, #E65100);
      width: 44px; height: 44px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 15px rgba(245,166,35,0.6);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
    ">${emoji}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

const pickupIcon = createIcon('#22C55E', '📍');
const dropIcon = createIcon('#EF4444', '🏁');

// Auto-fit map to markers
function MapFitter({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [positions, map]);
  return null;
}

// Click on map to select location
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
}

// Geocode a location string to lat/lng using Nominatim
export async function geocode(locationName) {
  try {
    const query = locationName.toLowerCase().includes('surat') ? locationName : `${locationName}, Surat, Gujarat, India`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=in`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.warn('Geocoding error:', err);
  }
  return null;
}

// Reverse geocode lat/lng to readable address
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data && data.display_name) {
      // Create a compact clean address
      const parts = [
        data.address.road || data.address.suburb || data.address.neighbourhood,
        data.address.city || data.address.town || 'Surat'
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 2).join(',');
    }
  } catch (err) {
    console.warn('Reverse geocoding error:', err);
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// Get route between two points using OSRM (free, no API key)
export async function getRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const distanceKm = (route.distance / 1000).toFixed(1);
      const durationMin = Math.ceil(route.duration / 60);
      return { coords, distanceKm: parseFloat(distanceKm), durationMin };
    }
  } catch (err) {
    console.warn('OSRM Route error:', err);
  }
  return null;
}

// Default Surat center
const SURAT_CENTER = [21.1702, 72.8311];

export default function MapView({
  pickupCoords,
  dropCoords,
  routeCoords,
  cabPosition,   // animated cab position during tracking
  phase,         // 'select' | 'tracking'
  pickup,
  drop,
  cabType = 'sedan',
  onMapClick,
}) {
  const positions = [];
  if (pickupCoords) positions.push([pickupCoords.lat, pickupCoords.lng]);
  if (dropCoords) positions.push([dropCoords.lat, dropCoords.lng]);

  return (
    <MapContainer
      center={pickupCoords ? [pickupCoords.lat, pickupCoords.lng] : SURAT_CENTER}
      zoom={13}
      style={{ height: '100%', width: '100%', borderRadius: 16 }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Auto-fit to markers */}
      {positions.length > 0 && <MapFitter positions={positions} />}

      {/* Map click handler for picking location */}
      <MapClickHandler onMapClick={onMapClick} />

      {/* Pickup marker */}
      {pickupCoords && (
        <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon}>
          <Popup>
            <div style={{ fontWeight: 600 }}>📍 Pickup Point</div>
            <div style={{ fontSize: 12, color: '#666' }}>{pickup || 'Selected Location'}</div>
          </Popup>
        </Marker>
      )}

      {/* Drop marker */}
      {dropCoords && (
        <Marker position={[dropCoords.lat, dropCoords.lng]} icon={dropIcon}>
          <Popup>
            <div style={{ fontWeight: 600 }}>🏁 Drop Destination</div>
            <div style={{ fontSize: 12, color: '#666' }}>{drop || 'Selected Destination'}</div>
          </Popup>
        </Marker>
      )}

      {/* Route line */}
      {routeCoords && routeCoords.length > 0 && (
        <Polyline
          positions={routeCoords}
          color="#F5A623"
          weight={6}
          opacity={0.85}
          dashArray={phase === 'tracking' ? '12, 6' : undefined}
        />
      )}

      {/* Animated vehicle during tracking */}
      {cabPosition && phase === 'tracking' && (
        <Marker position={[cabPosition.lat, cabPosition.lng]} icon={getVehicleIcon(cabType)}>
          <Popup>
            <div style={{ fontWeight: 700, color: '#F5A623' }}>Live Driver Location</div>
            <div style={{ fontSize: 12 }}>On the way to destination</div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
