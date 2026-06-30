export default function Admin() {
  const cards = [
    ["Users", "Manage accounts and roles"],
    ["Events", "Review platform events"],
    ["Uploads", "Moderate guest content"],
    ["Store", "Manage premium items"],
    ["Settings", "Platform configuration"],
    ["Reports", "Review flagged activity"]
  ];

  const stats = [
    { label: "Active users", value: "1.2k", detail: "Logged in last 30 days" },
    { label: "Events live", value: "18", detail: "Currently accepting uploads" },
    { label: "Pending reviews", value: "7", detail: "Uploads needing moderation" }
  ];

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">Platform admin</p>
        <h1 className="mt-3 text-5xl font-black font-serif">Admin control center</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">
          Monitor platform health, moderate content, and make high-impact decisions across Travel Share from one polished dashboard.
        </p>
      </section>

      <section className="grid gap-5 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5 bg-slate-950/90 border border-white/10">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{stat.label}</p>
            <p className="mt-3 text-4xl font-black font-serif">{stat.value}</p>
            <p className="mt-2 text-slatebody text-sm">{stat.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="card p-5 bg-slate-950/90 border border-white/10">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">Actions</p>
            <h2 className="mt-3 text-3xl font-black font-serif">Quick admin tools</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {cards.map(([title, copy]) => (
                <div key={title} className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
                  <p className="text-sm uppercase tracking-[0.28em] text-primary">{title}</p>
                  <p className="mt-2 text-slatebody text-sm">{copy}</p>
                  <button className="btn-ghost mt-4 w-full">Open</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card p-5 bg-slate-950/90 border border-white/10">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">Moderation</p>
            <h2 className="mt-3 text-3xl font-black font-serif">Review activity</h2>
            <p className="mt-4 text-slatebody leading-7">
              Use this section to stay on top of flagged uploads, pending reports, and user feedback.
            </p>
            <div className="mt-5 space-y-3 text-slatebody text-sm">
              <p>• 3 new reports</p>
              <p>• 7 uploads awaiting review</p>
              <p>• 2 account flags</p>
            </div>
            <button className="btn-primary mt-5 w-full">View moderation</button>
          </div>

          <div className="card p-5 bg-slate-950/90 border border-white/10">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">Platform health</p>
            <h2 className="mt-3 text-3xl font-black font-serif">Reports & settings</h2>
            <p className="mt-4 text-slatebody leading-7">
              Access analytics, audit logs, and configuration controls in a secure admin workflow.
            </p>
            <button className="btn-indigo mt-5 w-full">Open platform tools</button>
          </div>
        </aside>
      </section>

      <section className="card p-5 bg-slate-950/90 border border-white/10">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">Reports</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
            <p className="text-sm uppercase tracking-[0.28em] text-primary">Safety alerts</p>
            <p className="mt-2 text-slatebody text-sm">No critical alerts in the last 24 hours.</p>
          </div>
          <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
            <p className="text-sm uppercase tracking-[0.28em] text-primary">System status</p>
            <p className="mt-2 text-slatebody text-sm">All services online and responding normally.</p>
          </div>
          <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
            <p className="text-sm uppercase tracking-[0.28em] text-primary">Content queue</p>
            <p className="mt-2 text-slatebody text-sm">7 pending items awaiting review.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
