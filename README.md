# 🚖 CabGo - Cab Booking Platform

A full-stack, real-time Cab Booking & Ride Sharing application built with **React (Vite)**, **Node.js/Express**, **MongoDB**, **Socket.io**, and **Leaflet (OpenStreetMap)**.

---

## ✨ Features

- 👤 **Role-Based Authentication**: Rider, Driver, and Admin roles (JWT-based).
- 📍 **Interactive Map & Geocoding**: Real-time pickup & drop selection using Leaflet & OpenStreetMap Nominatim.
- 🚗 **Multiple Cab Categories**: Economy, Sedan, SUV, Premium with dynamic fare calculation.
- ⚡ **Real-Time Booking & Tracking**: Live driver dispatch, booking acceptance, status updates via Socket.IO.
- 💳 **Payment Flow**: Cash / Card payment simulation with receipts.
- ⭐ **Reviews & Ratings**: Driver ratings and feedback system.
- 📊 **Driver & Admin Dashboards**: Live driver toggle (available/offline), earnings tracking, and fleet management.

---

## 🛠️ Tech Stack

### Frontend
- **React.js** (Vite)
- **Vanilla CSS** with modern UI / glassmorphism
- **Leaflet & React-Leaflet** for maps
- **Axios & Socket.io Client**
- **Lucide Icons**

### Backend
- **Node.js** & **Express.js**
- **MongoDB** & **Mongoose**
- **Socket.io** (WebSockets)
- **JWT & bcryptjs**

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+ recommended)
- MongoDB Atlas or local MongoDB instance

### 2. Backend Setup
```bash
cd backend
npm install
# Create .env based on .env.example
cp .env.example .env
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📄 License
ISC
