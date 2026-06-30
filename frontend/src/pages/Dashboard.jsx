import { BarChart3, CalendarDays, Plus, QrCode, ShoppingBag } from "lucide-react";
import { PageLayout, PageHeader, Section, Card, Button, StatCard, EmptyState } from "../components/ui";

export default function Dashboard() {
  const stats = [
    { label: "Trips", value: "8", detail: "Active itineraries" },
    { label: "Events", value: "14", detail: "Upcoming sessions" },
    { label: "Uploads", value: "42", detail: "Media assets" },
    { label: "Storage", value: "24.8 GB", detail: "Used this month" },
  ];

  const quickActions = [
    { label: "Create Trip", icon: Plus, helper: "Build an itinerary from scratch" },
    { label: "Create Event", icon: CalendarDays, helper: "Plan a meetup or workshop" },
    { label: "Scan QR", icon: QrCode, helper: "Add uploads from the field" },
    { label: "View Store", icon: ShoppingBag, helper: "Manage frames and upgrades" },
  ];

  const recentActivity = [];

  return (
    <PageLayout>
      <PageHeader title="Creator Dashboard" subtitle="Manage trips, events, and uploads" />

      <Section>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <p style={{ textTransform: "uppercase", fontSize: 12, letterSpacing: "0.14em", color: "var(--color-primary)" }}>Creator dashboard</p>
              <h1 style={{ marginTop: 8 }}>Welcome back, creator.</h1>
              <p style={{ marginTop: 6, color: "var(--text-muted)" }}>Everything you need to manage trips, events, uploads, and guest interactions from one mobile-first workspace.</p>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 18, background: "var(--muted)" }}>
              <BarChart3 style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Creator tools at a glance</span>
            </div>
          </div>
        </Card>
      </Section>

      <Section>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr" }}>
          <div>
            <Card>
              <h2>Quick actions</h2>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button key={action.label} variant="tertiary" style={{ textAlign: "left" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "var(--muted)" }}>
                          <Icon style={{ width: 18, height: 18 }} />
                        </span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{action.label}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{action.helper}</div>
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
              <h2>Performance</h2>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {stats.map((stat) => (
                  <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.detail} />
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
              <h2>Recent activity</h2>
              <p style={{ color: "var(--text-muted)" }}>Track recent uploads, event updates, and trip changes in one place.</p>
            </div>
          </div>

          {recentActivity.length === 0 ? (
            <EmptyState title="No recent activity yet" description="Once you create a trip, add an event, or upload media, you’ll see your latest activity here." action={<Button>Create a trip</Button>} />
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