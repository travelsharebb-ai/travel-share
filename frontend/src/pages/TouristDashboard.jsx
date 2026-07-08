import { Link } from "react-router-dom";
import { Bookmark, Compass, MapPin, QrCode, UploadCloud } from "lucide-react";
import { PageLayout, PageHeader, Section, Card, Button, EmptyState } from "../components/ui";
import { useLanguage } from "../lib/i18n";

export default function TouristDashboard() {
  const { t } = useLanguage();
  const savedTrips = [];
  const recentUploads = [];
  const eventSuggestions = [
    { title: "Sunset photo walk", location: "Harbor Point" },
    { title: "Local food tour", location: "Downtown market" },
  ];

  return (
    <PageLayout>
      <PageHeader hero title={t("tourist.hero.title", "Your travel hub.")} subtitle={t("tourist.hero.subtitle", "Saved trips, uploads, and events are organized for your next adventure.")} />

      <Section>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)" }}>{t("tourist.hero.badge", "Tourist view")}</p>
              <h1 style={{ marginTop: 8 }}>{t("tourist.hero.title", "Your travel hub.")}</h1>
              <p style={{ marginTop: 6, color: "var(--text-muted)" }}>{t("tourist.hero.subtitle", "Saved trips, uploads, and events are organized for your next adventure.")}</p>
            </div>
            <Link to="/scan"><Button><QrCode style={{ width: 14, height: 14 }} /> {t("tourist.explore.scanQR", "Scan QR")}</Button></Link>
            <Link to="/map"><Button variant="ghost"><MapPin style={{ width: 14, height: 14 }} /> {t("tourist.explore.exploreMap", "Explore Map")}</Button></Link>
          </div>
        </Card>
      </Section>

      <Section>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>{t("tourist.savedTrips.title", "Saved trips")}</h2>
                <span style={{ padding: "6px 10px", borderRadius: 999, background: "var(--role-badge-bg, #EAF7FA)", color: "var(--role-badge-color, #0F766E)", border: "1px solid var(--role-badge-border, #B8E7EC)", fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>{t("nav.tourist")}</span>
              </div>

              {savedTrips.length === 0 ? (
                <EmptyState title={t("tourist.savedTrips.emptyTitle", "No saved trips yet")} description={t("tourist.savedTrips.emptyDescription", "Save your first trip to keep your highlights and plans in one place.")} action={<Button>{t("tourist.savedTrips.emptyAction", "Save a trip")}</Button>} icon={<Bookmark />} />
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {savedTrips.map((trip) => (
                    <Card key={trip.id}>
                      <div style={{ fontWeight: 600 }}>{trip.title}</div>
                      <div style={{ marginTop: 6, color: "var(--text-muted)" }}>{trip.description}</div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div>
            <Card>
              <h2>{t("tourist.recentUploads.title", "Recent uploads")}</h2>
              {recentUploads.length === 0 ? (
                <EmptyState title={t("tourist.recentUploads.emptyTitle", "No uploads yet")} description={t("tourist.recentUploads.emptyDescription", "Your recently saved photos and videos will appear here once you upload them.")} action={<Button>{t("tourist.recentUploads.emptyAction", "Upload")}</Button>} icon={<UploadCloud />} />
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {recentUploads.map((upload) => (
                    <Card key={upload.id}>
                      <div style={{ fontWeight: 600 }}>{upload.name}</div>
                      <div style={{ marginTop: 6, color: "var(--text-muted)" }}>{upload.date}</div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </Section>

      <Section>
        <Card>
          <div style={{ textAlign: "center" }}>
            <Compass style={{ width: 36, height: 36 }} />
            <h2 style={{ marginTop: 12 }}>{t("tourist.explore.title", "Ready to explore more?")}</h2>
            <p style={{ marginTop: 8, color: "var(--text-muted)", maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>{t("tourist.explore.description", "Scan a trip QR code, discover events, or continue saving experiences while you travel.")}</p>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexDirection: "column" }}>
              <Link to="/scan"><Button fullWidth><QrCode style={{ width: 14, height: 14 }} /> {t("tourist.explore.scanQr", "Scan QR")}</Button></Link>
              <Link to="/discover"><Button variant="ghost">{t("tourist.explore.browseEvents", "Browse events")}</Button></Link>
            </div>
          </div>
        </Card>
      </Section>
    </PageLayout>
  );
}