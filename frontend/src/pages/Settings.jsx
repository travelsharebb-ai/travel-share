import { useState } from "react";

export default function Settings() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    uploadAlerts: true,
    locationPrivacy: "approximate",
    theme: "dark"
  });

  function update(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">Account settings</p>
        <h1 className="mt-3 text-5xl font-black font-serif">Refine your Travel Share experience</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">
          Keep your profile polished, update preferences, and control privacy from one premium settings panel.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">Profile</p>
            <h2 className="mt-2 text-3xl font-black font-serif">Account overview</h2>
          </div>
          <div className="space-y-4 text-slatebody">
            <div>
              <label className="text-sm uppercase tracking-[0.28em] text-slatebody/70">Name</label>
              <input className="field w-full mt-2 bg-slate-950/70 text-white" value="Traveler" readOnly />
            </div>
            <div>
              <label className="text-sm uppercase tracking-[0.28em] text-slatebody/70">Email</label>
              <input className="field w-full mt-2 bg-slate-950/70 text-white" value="you@example.com" readOnly />
            </div>
            <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">Membership</p>
              <p className="mt-2 text-white">Travel Share Standard</p>
              <p className="mt-1 text-sm">Manage your plan and upgrade anytime in the Store.</p>
            </div>
          </div>
        </div>

        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Quick action</p>
          <div className="rounded-3xl border border-borderline bg-slate-950/70 p-5 text-slatebody">
            <p className="font-semibold text-white">Theme mode active</p>
            <p className="mt-2 text-sm">Dark mode is enabled for a premium viewing experience.</p>
          </div>
          <button className="btn-ghost w-full">View privacy help</button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">Notifications</p>
            <h2 className="mt-2 text-2xl font-black font-serif">Stay in the loop</h2>
          </div>
          <Toggle label="Email notifications" checked={settings.emailNotifications} onChange={(v) => update("emailNotifications", v)} />
          <Toggle label="Upload alerts" checked={settings.uploadAlerts} onChange={(v) => update("uploadAlerts", v)} />
        </div>

        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">Privacy</p>
            <h2 className="mt-2 text-2xl font-black font-serif">Control your footprint</h2>
          </div>
          <div className="space-y-4">
            <label className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">Default location privacy</label>
            <select
              value={settings.locationPrivacy}
              onChange={(e) => update("locationPrivacy", e.target.value)}
              className="field w-full bg-slate-950/70 text-white"
            >
              <option value="exact">Exact</option>
              <option value="approximate">Approximate</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
          <div className="space-y-4">
            <label className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">Theme</label>
            <select
              value={settings.theme}
              onChange={(e) => update("theme", e.target.value)}
              className="field w-full bg-slate-950/70 text-white"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
      </section>

      <button className="btn-primary w-full py-4">Save changes</button>
    </main>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={styles.toggle}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const styles = {
  toggle: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }
};