import SessionSync from "./components/SessionSync.jsx";
import ScreenshotGuard from "./components/ScreenshotGuard.jsx";
import AppBackground from "./components/AppBackground.jsx";

import Landing from "./pages/Landing.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import GuestMode from "./pages/GuestMode.jsx";
import DiscoverEvents from "./pages/DiscoverEvents.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import OAuthCallback from "./pages/OAuthCallback";

import Dashboard from "./pages/Dashboard.jsx";
import TouristDashboard from "./pages/TouristDashboard.jsx";

import TripDetails from "./pages/TripDetails.jsx";
import TripUpload from "./pages/TripUpload.jsx";

import EventsDashboard from "./pages/EventsDashboard.jsx";
import EventDetails from "./pages/EventDetails.jsx";

import Store from "./pages/Store.jsx";
import Settings from "./pages/Settings.jsx";
import Admin from "./pages/Admin.jsx";

import PublicTripJoin from "./pages/PublicTripJoin.jsx";
import PublicUpload from "./pages/PublicUpload.jsx";
import UploadSuccess from "./pages/UploadSuccess.jsx";

import ShareAlbum from "./pages/ShareAlbum.jsx";
import Legal from "./pages/Legal.jsx";
import MapView from "./pages/MapView.jsx";

import QRResolver from "./pages/QRResolver.jsx";
import QRScanner from "./components/QRScanner.jsx";

import BottomAd from "./components/BottomAd.jsx";

import PrivateRoute from "./components/PrivateRoute.jsx";

import { Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <>
      <SessionSync />
      <ScreenshotGuard />
      <AppBackground />

      <Routes>

        {/* =========================
            CORE PUBLIC ROUTES
        ========================== */}

        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/guest" element={<GuestMode />} />

        <Route path="/discover" element={<DiscoverEvents />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        {/* =========================
            PRIVATE APP ROUTES
        ========================== */}

        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/tourist" element={<PrivateRoute><TouristDashboard /></PrivateRoute>} />

        <Route path="/trips/:tripId" element={<PrivateRoute><TripDetails /></PrivateRoute>} />
        <Route path="/trips/:tripId/upload" element={<PrivateRoute><TripUpload /></PrivateRoute>} />

        <Route path="/events" element={<PrivateRoute roles={["organizer", "platform_admin"]}><EventsDashboard /></PrivateRoute>} />
        <Route path="/events/:eventId" element={<PrivateRoute roles={["organizer", "platform_admin"]}><EventDetails /></PrivateRoute>} />

        <Route path="/store" element={<PrivateRoute><Store /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute roles={["platform_admin"]}><Admin /></PrivateRoute>} />

        {/* =========================
            🔥 QR SYSTEM (ONLY SYSTEM)
        ========================== */}

        <Route path="/scan" element={<QRScanner />} />
        <Route path="/qr/:qrToken" element={<QRResolver />} />
        <Route path="/qr/:qrToken/upload" element={<PublicUpload type="trip" />} />
        <Route path="/qr/:qrToken/success" element={<UploadSuccess />} />

        {/* =========================
            SHARING + LEGAL + MAP
        ========================== */}

        <Route path="/share/:token" element={<ShareAlbum />} />
        <Route path="/privacy" element={<Legal type="privacy" />} />
        <Route path="/terms" element={<Legal type="terms" />} />
        <Route path="/map" element={<MapView />} />

      </Routes>

      <BottomAd />
    </>
  );
}