import { Route, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import PrivateRoute from "./components/PrivateRoute.jsx";
import SessionSync from "./components/SessionSync.jsx";
import ScreenshotGuard from "./components/ScreenshotGuard.jsx";
import AppBackground from "./components/AppBackground.jsx";
import BottomAd from "./components/BottomAd.jsx";
import Shell from "./components/Shell.jsx";
import AppTopbar from "./components/AppTopbar.jsx";
import { currentUser } from "./lib/api";
import { useLanguage } from "./lib/i18n";

const AuthPage = lazy(() => import("./pages/AuthPage.jsx"));
const Landing = lazy(() => import("./pages/Landing.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const GuestMode = lazy(() => import("./pages/GuestMode.jsx"));
const GuestAccess = lazy(() => import("./pages/GuestAccess.jsx"));
const Legal = lazy(() => import("./pages/Legal.jsx"));
const MapView = lazy(() => import("./pages/MapView.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const TouristDashboard = lazy(() => import("./pages/TouristDashboard.jsx"));
const EventsDashboard = lazy(() => import("./pages/EventsDashboard.jsx"));
const EventDetails = lazy(() => import("./pages/EventDetails.jsx"));
const EventCreate = lazy(() => import("./pages/EventCreate.jsx"));
const Trips = lazy(() => import("./pages/Trips.jsx"));
const TripCreate = lazy(() => import("./pages/TripCreate.jsx"));
const TripDetails = lazy(() => import("./pages/TripDetails.jsx"));
const TripUpload = lazy(() => import("./pages/TripUpload.jsx"));
const MyUploads = lazy(() => import("./pages/MyUploads.jsx"));
const Approvals = lazy(() => import("./pages/Approvals.jsx"));
const SharedAlbums = lazy(() => import("./pages/SharedAlbums.jsx"));
const Store = lazy(() => import("./pages/Store.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const VerifyEmailChange = lazy(() => import("./pages/VerifyEmailChange.jsx"));
const AdminUsers = lazy(() => import("./pages/admin/Users.jsx"));
const AdminModeration = lazy(() => import("./pages/admin/Moderation.jsx"));
const AdminReports = lazy(() => import("./pages/admin/Reports.jsx"));
const AdminSettings = lazy(() => import("./pages/admin/Settings.jsx"));
const AdminTools = lazy(() => import("./pages/admin/Tools.jsx"));
const AdminManagement = lazy(() => import("./pages/admin/Management.jsx"));
const AdminData = lazy(() => import("./pages/admin/AdminData.jsx"));
const AdminAds = lazy(() => import("./pages/admin/Ads.jsx"));
const DiscoverEvents = lazy(() => import("./pages/DiscoverEvents.jsx"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback.jsx"));
const QRScanner = lazy(() => import("./components/QRScanner.jsx"));
const UploadSuccess = lazy(() => import("./pages/UploadSuccess.jsx"));
const ShareAlbum = lazy(() => import("./pages/ShareAlbum.jsx"));
const PublicTripJoin = lazy(() => import("./pages/PublicTripJoin.jsx"));
const PublicUpload = lazy(() => import("./pages/PublicUpload.jsx"));
const QRResolver = lazy(() => import("./pages/QRResolver.jsx"));
const GuestDashboard = lazy(() => import("./pages/GuestDashboard.jsx"));
const QRSpaces = lazy(() => import("./pages/QRSpaces.jsx"));
const QRSpaceCreate = lazy(() => import("./pages/QRSpaceCreate.jsx"));
const QRSpaceDetails = lazy(() => import("./pages/QRSpaceDetails.jsx"));

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

  function PublicPage({ children }) {
    return (
      <>
        <AppTopbar variant="public" />
        {children}
      </>
    );
  }

  function LoadingFallback() {
    const { t } = useLanguage();
    return (
      <div className="page-shell p-12">
        <p className="text-lg text-white">{t("common.loading", "Loading…")}</p>
      </div>
    );
  }

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
      return <Suspense fallback={<LoadingFallback />}><EventsDashboard /></Suspense>;
    }
    return <DiscoverEvents />;
  }
  return (
    <>
      <SessionSync />
      <ScreenshotGuard />
      <AppBackground />

      <Suspense fallback={<LoadingFallback />}>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/guest" element={<GuestMode />} />
      <Route path="/guest/access/:resumeToken" element={<GuestAccess />} />
      <Route path="/discover" element={<Shell><DiscoverEvents /></Shell>} />
      <Route path="/privacy" element={<PublicPage><Legal type="privacy" /></PublicPage>} />
      <Route path="/terms" element={<PublicPage><Legal type="terms" /></PublicPage>} />
      <Route path="/verify-email-change" element={<PublicPage><VerifyEmailChange /></PublicPage>} />
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
      <Route path="/admin/data" element={<PrivateRoute roles={["admin", "platform_admin"]}><AdminData /></PrivateRoute>} />
      <Route path="/admin/ads" element={<PrivateRoute roles={["admin", "platform_admin"]}><AdminAds /></PrivateRoute>} />
      <Route path="/share/:token" element={<PublicPage><ShareAlbum /></PublicPage>} />
      <Route path="/join/:tripId" element={<PublicPage><PublicTripJoin /></PublicPage>} />
      <Route path="/qr/:qrToken/upload" element={<PublicPage><PublicUpload /></PublicPage>} />
      <Route path="/qr/:qrToken/success" element={<PublicPage><UploadSuccess /></PublicPage>} />
      <Route path="/scan" element={<PrivateRoute><QRScanner /></PrivateRoute>} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      <Route path="/qr" element={<PublicPage><QRResolver /></PublicPage>} />
      <Route path="/qr/:qrToken" element={<PublicPage><QRResolver /></PublicPage>} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <BottomAd />
    </>
  );
}
