import { Link } from "react-router-dom";
import { MapPin, Calendar, Lock, QrCode } from "lucide-react";
import Shell from "../components/Shell";

function HeaderBlock({ eyebrow, title, copy }) {
  return (
    <section>
      <p className="text-sm font-black uppercase text-primary">{eyebrow}</p>
      <h1 className="mt-2 break-words font-serif text-4xl font-black">{title}</h1>
      {copy && <p className="mt-2 max-w-3xl text-slatebody">{copy}</p>}
    </section>
  );
}

export default function GuestMode() {
  return (
    <Shell>
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <HeaderBlock 
            eyebrow="Guest Access" 
            title="Use TravelShare without signing up" 
            copy="Guests can enter from QR links, public event pages, or shared albums. You can view allowed spaces and upload memories for 3 days, then create an account to keep them." 
          />
        </section>
        
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <MapPin className="text-primary" size={32} />
            <h2 className="mt-3 font-serif text-2xl font-black">Tourist Guest</h2>
            <p className="mt-2 text-slatebody">
              Scan a trip QR, upload photos/videos, add captions, choose location privacy, and wait for album-owner approval.
            </p>
          </div>
          
          <div className="card p-5">
            <Calendar className="text-primary" size={32} />
            <h2 className="mt-3 font-serif text-2xl font-black">Event Guest</h2>
            <p className="mt-2 text-slatebody">
              Open public events, scan zone QR codes, contribute memories to stages, vendors, photo hotspots, and live event maps.
            </p>
          </div>
          
          <div className="card p-5">
            <Lock className="text-primary" size={32} />
            <h2 className="mt-3 font-serif text-2xl font-black">After 3 Days</h2>
            <p className="mt-2 text-slatebody">
              Sign in to continue, claim guest uploads, buy add-ons, create albums, host events, or manage business tools.
            </p>
          </div>
        </section>
        
        <section className="hero-copy-panel flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
            <Link className="btn-primary" to="/discover">
              <MapPin size={18} /> Discover public events
            </Link>
            <Link className="btn-primary" to="/signup">
              <QrCode size={18} /> Create account to host
            </Link>
          </div>
        </section>
      </main>
    </Shell>
  );
}