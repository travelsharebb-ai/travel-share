import { BarChart3, CalendarDays, MapPin, Plus, QrCode, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { PageLayout, PageHeader, Section, Card, Button, StatCard, EmptyState } from "../components/ui";
import { api, currentUser } from "../lib/api";
import { useLanguage } from "../lib/i18n";

export default function Dashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const user = currentUser();

  // determine if user has organizer privileges (compute early so effect can use it)
  const canCreateEvent = user && (user.role === "organizer" || user.role === "platform_admin");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trips, setTrips] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // trips is accessible to any authenticated user
        const tripData = await api("/api/trips");
        if (!mounted) return;
        setTrips(tripData.trips || []);

        // events: fetch only for organizers/platform admins. Tourists/normal users do not call the endpoint.
        if (canCreateEvent) {
          try {
            const eventsData = await api("/api/events");
            if (!mounted) return;
            setEvents(eventsData.events || []);
          } catch (evErr) {
            // If events endpoint returns 403 or error, treat as empty instead of failing whole dashboard
            setEvents([]);
          }
        } else {
          // explicit: don't call events API for non-organizers
          setEvents([]);
        }
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // derive stats
  const tripsCount = trips.length;
  const uploadsCount = trips.reduce((acc, t) => acc + ((t._count && t._count.uploads) || 0), 0);



  const stats = [
    { label: t("dashboard.stats.trips", "Trips"), value: loading ? "…" : (error ? "—" : String(tripsCount)), detail: t("dashboard.stats.activeItineraries", "Active itineraries") },
    { label: t("dashboard.stats.events", "Events"), value: loading ? "…" : (canCreateEvent ? (String(events.length)) : t("dashboard.stats.organizerOnly", "Organizer only")), detail: t("dashboard.stats.upcomingSessions", "Upcoming sessions") },
    { label: t("dashboard.stats.uploads", "Uploads"), value: loading ? "…" : (error ? "—" : (uploadsCount > 0 ? String(uploadsCount) : "—")), detail: t("dashboard.stats.mediaAssets", "Media assets") },
    { label: t("dashboard.stats.storage", "Storage"), value: "—", detail: t("dashboard.stats.usedThisMonth", "Used this month") },
  ];

  const quickActions = [
    { label: t("dashboard.quickActions.createTrip", "Create Trip"), icon: Plus, helper: t("dashboard.quickActions.createTripHelper", "Build an itinerary from scratch"), action: "create-trip" },
    { label: t("dashboard.quickActions.createEvent", "Create Event"), icon: CalendarDays, helper: canCreateEvent ? t("dashboard.quickActions.createEventHelper", "Plan a meetup or workshop") : t("dashboard.quickActions.organizerAccessRequired", "Organizer access required."), action: "create-event" },
    { label: t("dashboard.quickActions.exploreMap", "Explore Map"), icon: MapPin, helper: t("dashboard.quickActions.exploreMapHelper", "Discover trips, posts, and places nearby"), action: "map" },
    { label: t("dashboard.quickActions.scanQr", "Scan QR"), icon: QrCode, helper: t("dashboard.quickActions.scanQrHelper", "Add uploads from the field"), action: "scan" },
    { label: t("dashboard.quickActions.viewStore", "View Store"), icon: ShoppingBag, helper: t("dashboard.quickActions.viewStoreHelper", "Manage frames and upgrades"), action: "store" },
  ];

  // build recent activity from accessible trips + events
  const recentActivity = (() => {
    if (loading) return [];
    if (error) return [];
    const items = [];
    for (const trip of trips) {
      items.push({ id: `trip-${trip.id}`, title: `${t("dashboard.recentActivity.tripPrefix", "Trip:")} ${trip.title || t("dashboard.recentActivity.untitledTrip", "Untitled")}`, description: trip.destination || "", when: new Date(trip.createdAt).toLocaleString(), createdAt: trip.createdAt });
    }
    for (const ev of events) {
      items.push({ id: `event-${ev.id}`, title: `${t("dashboard.recentActivity.eventPrefix", "Event:")} ${ev.title || t("dashboard.recentActivity.untitledEvent", "Untitled")}`, description: ev.location || "", when: new Date(ev.createdAt).toLocaleString(), createdAt: ev.createdAt });
    }
    // sort by createdAt desc and take up to 6
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return items.slice(0, 6);
  })();

  return (
    <PageLayout>
    <PageHeader hero title={t("dashboard.hero.title", "Creator Dashboard")} subtitle={t("dashboard.hero.subtitle", "Manage trips, events, and uploads")} />

      <Section>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <p style={{ textTransform: "uppercase", fontSize: 12, letterSpacing: "0.14em", color: "var(--color-primary)" }}>{t("dashboard.hero.badge", "Creator dashboard")}</p>
              <h1 style={{ marginTop: 8 }}>{t("dashboard.hero.welcome", "Welcome back, creator.")}</h1>
              <p style={{ marginTop: 6, color: "var(--text-muted)" }}>{t("dashboard.hero.description", "Everything you need to manage trips, events, uploads, and guest interactions from one mobile-first workspace.")}</p>
            </div>
            <div className="creator-tools-pill" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 18 }}>
              <BarChart3 style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t("dashboard.creatorToolsAtAGlance", "Creator tools at a glance")}</span>
            </div>
          </div>
        </Card>
      </Section>

      <Section>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr" }}>
          <div>
            <Card>
              <h2>{t("dashboard.quickActions.title", "Quick actions")}</h2>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  const handle = () => {
                    if (action.action === "create-event") return canCreateEvent ? navigate("/events/new") : null;
                    if (action.action === "scan") return navigate("/scan");
                    if (action.action === "store") return navigate("/store");
                    if (action.action === "create-trip") return navigate('/trips/new');
                    if (action.action === "map") return navigate('/map');
                  };

                  const disabled = action.action === "create-event" && !canCreateEvent;

                  return (
                    <Button key={action.label} variant="ghost" type="button" onClick={handle} className="quick-action-card" disabled={disabled}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span className="quick-action-icon" style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
                          <Icon style={{ width: 18, height: 18, color: "currentColor" }} />
                        </span>
                        <div>
                          <div className="quick-action-label" style={{ fontWeight: 600 }}>{action.label}</div>
                          <div className="quick-action-helper" style={{ fontSize: 13 }}>{action.helper}</div>
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </Card>
          </div>

          <div>
            <Card>
              <h2>{t("dashboard.performance.title", "Performance")}</h2>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {stats.map((stat) => (
                  <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </Section>

      <Section>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
                  <h2>{t("dashboard.recentActivity.title", "Recent activity")}</h2>
                  <p style={{ color: "var(--text-muted)" }}>{t("dashboard.recentActivity.description", "Track recent uploads, event updates, and trip changes in one place.")}</p>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 20 }}>{t("dashboard.recentActivity.loading", "Loading recent activity…")}</div>
          ) : error ? (
            <EmptyState title={t("dashboard.recentActivity.errorTitle", "Activity unavailable")} description={error} action={<Button type="button" disabled>{t("dashboard.recentActivity.retryLater", "Retry later")}</Button>} />
          ) : recentActivity.length === 0 ? (
            <EmptyState title={t("dashboard.recentActivity.emptyTitle", "No recent activity yet")} description={t("dashboard.recentActivity.emptyDescription", "No recent trips or events. Create a trip, event, or upload to see activity here.")} action={<Button type="button" onClick={() => navigate('/trips/new')}>{t("dashboard.recentActivity.emptyAction", "Create a trip")}</Button>} />
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {recentActivity.map((item) => (
                <Card key={item.id}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                    <div style={{ marginTop: 6, color: "var(--text-muted)" }}>{item.description}</div>
                    <div style={{ marginTop: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>{item.when}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </Section>
    </PageLayout>
  );
}