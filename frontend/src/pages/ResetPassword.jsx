import { useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function ResetPassword() {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const canSubmit = password.length >= 8 && password === confirm;

  return (
    <main className="page-shell flex min-h-[calc(100vh-74px)] items-center justify-center py-10">
      <section className="card w-full max-w-md p-6 bg-slate-950/90 border border-white/10 space-y-5">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Reset Password</p>
          <h1 className="mt-3 text-4xl font-black font-serif">Create a new password</h1>
          <p className="mt-3 text-slatebody">Secure your account and sign in with your updated credentials.</p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field w-full bg-slate-950/70 text-white"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field w-full bg-slate-950/70 text-white"
          />
        </div>

        {password && password.length < 8 && <p className="text-sm text-red-400">Password must be at least 8 characters.</p>}
        {confirm && password !== confirm && <p className="text-sm text-red-400">Passwords do not match.</p>}

        <button disabled={!canSubmit} className="btn-primary w-full" style={{ opacity: canSubmit ? 1 : 0.55 }}>
          Reset Password
        </button>

        <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody text-sm">
          <span className="font-semibold">Token</span>
          <p className="mt-2 break-words">{token}</p>
        </div>

        <Link to="/login" className="btn-ghost w-full text-center">
          Back to Login
        </Link>
      </section>
    </main>
  );
}

// Styles are handled by the old Travel Share CSS classes.