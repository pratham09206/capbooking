import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export const joinUser = (userId) => {
  if (userId) {
    socket.emit('join', { userId, role: 'user' });
  }
};

export const joinDriver = (driverId) => {
  if (driverId) {
    socket.emit('join', { userId: driverId, role: 'driver' });
    socket.emit('driver_online', { driverId });
  }
};

export const joinBookingRoom = (bookingId) => {
  if (bookingId) {
    socket.emit('join_booking', { bookingId });
  }
};

export default socket;
