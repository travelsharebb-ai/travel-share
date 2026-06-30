import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Shell from "../components/Shell";
import { api, setSession } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const data = await api(`/api/auth/${isSignup ? "signup" : "login"}`, { method: "POST", body: JSON.stringify(form) });
      setSession(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  async function oauth(provider) {
    window.location.href = `${API_URL}/api/auth/oauth/${provider}`;
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[75vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-5 sm:p-7">
          <h1 className="font-serif text-3xl font-black">{isSignup ? "Create your TravelShare account" : "Welcome back"}</h1>
          
          {isSignup && (
            <input 
              className="field" 
              placeholder="Name" 
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
            />
          )}
          
          <input 
            className="field" 
            type="email" 
            placeholder="Email" 
            value={form.email} 
            onChange={(e) => setForm({ ...form, email: e.target.value })} 
          />
          
          <div className="relative">
            <input 
              className="field pr-14" 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={form.password} 
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
            />
            <button 
              type="button" 
              aria-label={showPassword ? "Hide password" : "Show password"} 
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-report hover:bg-skysoft" 
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          
          {error && (
            <p className="break-words rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>
          )}
          
          <button className="btn-primary w-full" type="submit">
            {isSignup ? "Sign up" : "Login"}
          </button>
          
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn-ghost" onClick={() => oauth("google")}>
              Google
            </button>
            <button type="button" className="btn-ghost" onClick={() => oauth("microsoft")}>
              Microsoft
            </button>
          </div>
          
          {!isSignup && (
            <Link className="block text-center text-sm font-bold text-primary" to="/forgot-password">
              Forgot password?
            </Link>
          )}
          
          <div className="border-t border-borderline pt-4 text-center">
            <Link to={isSignup ? "/login" : "/signup"} className="text-sm font-bold text-primary">
              {isSignup ? "Already have an account? Log in" : "New to Travel Share? Create an account"}
            </Link>
          </div>
          
          <Link to="/guest" className="block">
            <button type="button" className="btn-ghost w-full">
              Continue as Guest
            </button>
          </Link>
          
          <div className="border-t border-borderline pt-4 text-center text-sm text-slatebody">
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/privacy" className="text-primary hover:underline font-bold">
                Privacy
              </Link>
              <span>•</span>
              <Link to="/terms" className="text-primary hover:underline font-bold">
                Terms
              </Link>
            </div>
          </div>
        </form>
      </main>
    </Shell>
  );
}