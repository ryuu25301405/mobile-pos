"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/scanview");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#050810] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Architectural Background Layers */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      {/* Subtle Ambient Light Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[520px] h-[520px] bg-[#D62828]/[0.09] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[520px] h-[520px] bg-emerald-500/[0.07] rounded-full blur-[120px] pointer-events-none" />

      {/* Top Minimalist Header Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 pt-7 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-[#D62828] text-white font-black text-lg px-3 py-0.5 rounded-lg tracking-tighter shadow-md shadow-red-600/25">
            huga
          </div>
          <div className="h-4 w-[1px] bg-white/10" />
          <span className="text-xs font-medium tracking-wide text-slate-400">
            Retail Operations Suite
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-white/[0.03] border border-white/[0.07] px-3 py-1.5 rounded-full backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>System Operational</span>
        </div>
      </header>

      {/* Center Stage */}
      <main className="w-full max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Editorial Column (Desktop) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col space-y-8 pr-6">
          <div className="space-y-4">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400/90">
              Inventory & Audit Intelligence
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white leading-[1.15]">
              Precision stock control across every{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                retail branch.
              </span>
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              Unified workspace for real-time barcode auditing, variance reconciliation, delivery receipts, and pull-out manifests.
            </p>
          </div>

          {/* Minimalist Branch Coverage List */}
          <div className="space-y-3 pt-2">
            <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
              Active Store Network
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Landmark Trinoma",
                "Landmark Makati",
                "Metro Gaisano Colon",
              ].map((branch) => (
                <span
                  key={branch}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/[0.03] border border-white/[0.07] px-3 py-1.5 rounded-lg"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80" />
                  {branch}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Glassmorphic Login Card */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-[420px] bg-[#0B101D]/80 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 sm:p-10 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] relative">
            
            {/* Subtle Top Rim Highlight */}
            <div className="absolute inset-x-10 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="space-y-2 mb-8">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Welcome back
              </h2>
              <p className="text-xs text-slate-400">
                Sign in with your authorized staff credentials to continue.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-slate-300"
                >
                  Email address
                </label>
                <div className="relative group">
                  <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-slate-200 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@huga.com"
                    className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] text-sm pl-10 pr-4 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:bg-white/[0.05] focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-slate-300"
                >
                  Password
                </label>
                <div className="relative group">
                  <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-slate-200 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] text-sm pl-10 pr-11 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:bg-white/[0.05] focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-200 rounded-lg transition cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white hover:bg-slate-100 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_10px_30px_-10px_rgba(255,255,255,0.3)]"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Subtle Bottom Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 pb-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 relative z-10">
        <span>© {new Date().getFullYear()} HUGA Retail Control Deck</span>
        <span className="font-mono">Encrypted Session • Audit Logging Active</span>
      </footer>
    </div>
  );
}