import { Route, Routes, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import PrivateRoute from "./components/PrivateRoute.jsx";
import SessionSync from "./components/SessionSync.jsx";
import ScreenshotGuard from "./components/ScreenshotGuard.jsx";
import AppBackground from "./components/AppBackground.jsx";
import BottomAd from "./components/BottomAd.jsx";
import Shell from "./components/Shell.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Landing from "./pages/Landing.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import GuestMode from "./pages/GuestMode.jsx";
import GuestAccess from "./pages/GuestAccess.jsx";
import Legal from "./pages/Legal.jsx";
import MapView from "./pages/MapView.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import TouristDashboard from "./pages/TouristDashboard.jsx";
import EventsDashboard from "./pages/EventsDashboard.jsx";
import EventDetails from "./pages/EventDetails.jsx";
import EventCreate from "./pages/EventCreate.jsx";
import Trips from "./pages/Trips.jsx";
import TripCreate from "./pages/TripCreate.jsx";
import TripDetails from "./pages/TripDetails.jsx";
import TripUpload from "./pages/TripUpload.jsx";
import MyUploads from "./pages/MyUploads.jsx";
import Approvals from "./pages/Approvals.jsx";
import SharedAlbums from "./pages/SharedAlbums.jsx";
import Store from "./pages/Store.jsx";
import Settings from "./pages/Settings.jsx";
import Admin from "./pages/Admin.jsx";
import VerifyEmailChange from "./pages/VerifyEmailChange.jsx";
import AdminUsers from "./pages/admin/Users.jsx";
import AdminModeration from "./pages/admin/Moderation.jsx";
import AdminReports from "./pages/admin/Reports.jsx";
import AdminSettings from "./pages/admin/Settings.jsx";
import AdminTools from "./pages/admin/Tools.jsx";
import AdminManagement from "./pages/admin/Management.jsx";
import DiscoverEvents from "./pages/DiscoverEvents.jsx";
import OAuthCallback from "./pages/OAuthCallback.jsx";
import QRScanner from "./components/QRScanner.jsx";
import UploadSuccess from "./pages/UploadSuccess.jsx";
import ShareAlbum from "./pages/ShareAlbum.jsx";
import PublicTripJoin from "./pages/PublicTripJoin.jsx";
import PublicUpload from "./pages/PublicUpload.jsx";
import QRResolver from "./pages/QRResolver.jsx";
import GuestDashboard from "./pages/GuestDashboard.jsx";
import QRSpaces from "./pages/QRSpaces.jsx";
import QRSpaceCreate from "./pages/QRSpaceCreate.jsx";
import QRSpaceDetails from "./pages/QRSpaceDetails.jsx";
import { currentUser } from "./lib/api";

export default function App() {
  const [user, setUser] = useState(() => currentUser());

  useEffect(() => {
    const syncUser = () => setUser(currentUser());
    window.addEventListener("travelShareUserChanged", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("travelShareUserChanged", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.geolocation) return;
    if (localStorage.getItem("travelShareLocationPermissionRequested")) return;

    const markRequested = () => {
      try {
        localStorage.setItem("travelShareLocationPermissionRequested", "1");
      } catch (err) {
        // ignore
      }
    };

    const requestLocation = () => {
      navigator.geolocation.getCurrentPosition(
        () => markRequested(),
        () => markRequested(),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "prompt") {
          requestLocation();
        } else {
          markRequested();
        }
      }).catch(() => {
        requestLocation();
      });
    } else {
      requestLocation();
    }
  }, []);

  function DashboardRoute() {
    if (!user) return <Navigate to="/login" replace />;
    return user.role === "guest" ? <GuestDashboard /> : <Dashboard />;
  }

  function EventsRoute() {
    if (!user) return <Navigate to="/login" replace />;
    if (["organizer", "admin", "platform_admin"].includes(user.role)) {
      return <EventsDashboard />;
    }
    return <DiscoverEvents />;
  }
  return (
    <>
      <SessionSync />
      <ScreenshotGuard />
      <AppBackground />

      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/guest" element={<GuestMode />} />
      <Route path="/guest/access/:resumeToken" element={<GuestAccess />} />
      <Route path="/discover" element={<Shell><DiscoverEvents /></Shell>} />
      <Route path="/privacy" element={<Legal type="privacy" />} />
      <Route path="/terms" element={<Legal type="terms" />} />
      <Route path="/verify-email-change" element={<VerifyEmailChange />} />
      <Route path="/map" element={<PrivateRoute><MapView /></PrivateRoute>} />
      <Route path="/trips" element={<PrivateRoute><Trips /></PrivateRoute>} />
      <Route path="/trips/new" element={<PrivateRoute><TripCreate /></PrivateRoute>} />
      <Route path="/trips/:tripId/upload" element={<PrivateRoute><TripUpload /></PrivateRoute>} />
      <Route path="/trips/:tripId" element={<PrivateRoute><TripDetails /></PrivateRoute>} />
      <Route path="/my-uploads" element={<PrivateRoute><MyUploads /></PrivateRoute>} />
      <Route path="/approvals" element={<PrivateRoute><Approvals /></PrivateRoute>} />
      <Route path="/shared-albums" element={<PrivateRoute><SharedAlbums /></PrivateRoute>} />
      <Route path="/events/new" element={<PrivateRoute><EventCreate /></PrivateRoute>} />
      <Route path="/events/:eventId" element={<PrivateRoute><EventDetails /></PrivateRoute>} />
      <Route path="/events" element={<PrivateRoute><EventsRoute /></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><DashboardRoute /></PrivateRoute>} />
      <Route path="/tourist" element={<PrivateRoute><TouristDashboard /></PrivateRoute>} />
      <Route path="/store" element={<PrivateRoute><Store /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/qr-spaces" element={<PrivateRoute><QRSpaces /></PrivateRoute>} />
      <Route path="/qr-spaces/new" element={<PrivateRoute><QRSpaceCreate /></PrivateRoute>} />
      <Route path="/qr-spaces/:id" element={<PrivateRoute><QRSpaceDetails /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute roles={["admin", "platform_admin"]}><Admin /></PrivateRoute>} />
      <Route path="/admin/users" element={<PrivateRoute roles={["admin", "platform_admin"]}><AdminUsers /></PrivateRoute>} />
      <Route path="/admin/moderation" element={<PrivateRoute roles={["admin", "platform_admin"]}><AdminModeration /></PrivateRoute>} />
      <Route path="/admin/reports" element={<PrivateRoute roles={["admin", "platform_admin"]}><AdminReports /></PrivateRoute>} />
      <Route path="/admin/settings" element={<PrivateRoute roles={["admin", "platform_admin"]}><AdminSettings /></PrivateRoute>} />
      <Route path="/admin/tools" element={<PrivateRoute roles={["admin", "platform_admin"]}><AdminTools /></PrivateRoute>} />
      <Route path="/admin/management" element={<PrivateRoute roles={["admin", "platform_admin"]}><AdminManagement /></PrivateRoute>} />
      <Route path="/share/:token" element={<ShareAlbum />} />
      <Route path="/join/:tripId" element={<PublicTripJoin />} />
      <Route path="/qr/:qrToken/upload" element={<Shell><PublicUpload /></Shell>} />
      <Route path="/qr/:qrToken/success" element={<UploadSuccess />} />
      <Route path="/scan" element={<PrivateRoute><QRScanner /></PrivateRoute>} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      <Route path="/qr" element={<QRResolver />} />
      <Route path="/qr/:qrToken" element={<QRResolver />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomAd />
    </>
  );
}
