import { Navigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { QrCode, Users, MapPin, ShieldCheck } from "lucide-react";
import Shell from "../components/Shell";
import { currentUser } from "../lib/api";

export default function Landing() {
  const user = currentUser();
  if (user) return <Navigate to="/dashboard" replace />;
  
  return (
    <Shell>
      <main className="page-shell grid min-h-[calc(100vh-74px)] content-center gap-8 py-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <section className="hero-copy-panel min-w-0 space-y-6">
          <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
            QR-powered travel and event memories
          </p>
          <h1 className="max-w-3xl break-words font-serif text-5xl font-black leading-tight sm:text-6xl">
            TravelShare
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slatebody">
            Collect memories from tourists, guests, and event crowds. Map the journey, replay the experience, and manage the whole platform from one business control panel.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link className="btn-primary" to="/signup">
              <QrCode size={19} /> Create account
            </Link>
            <Link className="btn-ghost" to="/guest">
              <Users size={19} /> Continue as guest
            </Link>
            <Link className="btn-ghost" to="/discover">
              <MapPin size={19} /> Discover events
            </Link>
            <Link className="btn-ghost" to="/privacy">
              <ShieldCheck size={19} /> Privacy
            </Link>
            <Link className="btn-ghost" to="/terms">
              <ShieldCheck size={19} /> Terms
            </Link>
          </div>
        </section>
        
        <section className="grid gap-4">
          {[
            ["Tourist Mode", "Personal albums, memory maps, route replay, and QR photo collection."],
            ["Events Mode", "Custom event maps, zones, crowd status, and location-specific QR uploads."],
            ["Business Admin", "Users, organizers, ads, store items, reports, analytics, and settings."]
          ].map(([title, copy]) => {
            // Make 'Events Mode' card clickable to open the Events page
            if (title === "Events Mode") {
              return (
                <Link key={title} to="/events" className="card p-5 block">
                  <p className="font-serif text-2xl font-black">{title}</p>
                  <p className="mt-2 text-slatebody">{copy}</p>
                </Link>
              );
            }
            return (
              <div className="card p-5" key={title}>
                <p className="font-serif text-2xl font-black">{title}</p>
                <p className="mt-2 text-slatebody">{copy}</p>
              </div>
            );
          })}
        </section>
      </main>
    </Shell>
  );
}