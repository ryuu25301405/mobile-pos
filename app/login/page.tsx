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
  ShieldCheck,
  Database,
  ScanBarcode,
  Store,
} from "lucide-react";

export default function HomeLoginPage() {
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
    <div className="min-h-screen bg-[#060913] text-slate-100 flex items-center justify-center p-4 lg:p-8 relative overflow-hidden font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Subtle Ambient Background Grid & Glow */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(#94a3b8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#D62828]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-[#0B1120]/90 backdrop-blur-2xl border border-slate-800/80 rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] overflow-hidden relative z-10">
        
        {/* LEFT PANEL: Operational Telemetry & Brand Context (Hidden on small mobile, visible on Desktop) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between p-10 bg-gradient-to-br from-[#0F172A] via-[#0B1120] to-[#060913] border-r border-slate-800/80 relative">
          <div className="space-y-6">
            {/* Brand Pill */}
            <div className="flex items-center gap-3">
              <div className="bg-[#D62828] text-white font-black text-xl px-3.5 py-1 rounded-xl tracking-tighter shadow-lg shadow-red-600/20">
                huga
              </div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 border border-slate-800 bg-slate-900/80 px-2.5 py-1 rounded-full">
                POS & Inventory Hub
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <h2 className="text-2xl font-black text-white tracking-tight leading-snug">
                Centralized Retail Control & Stock Audit Deck
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time barcode scanning, stock variance reconciliation, delivery receipts, and pull-out manifest tracking across retail branches.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                  <ScanBarcode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">
                    Live Audit & Variance Reconciliation
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Instant comparison between physical barcode counts and live branch stock.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">
                    Multi-Branch Operations
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Landmark Trinoma • Landmark Makati • Metro Gaisano Colon
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* System Status Footer */}
          <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400 font-semibold">CLOUD DB ONLINE</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Database className="w-3.5 h-3.5" />
              <span>Supabase + SSMS Sync</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Authentication Form */}
        <div className="lg:col-span-6 p-7 sm:p-10 lg:p-12 flex flex-col justify-center">
          {/* Mobile-only Brand Header */}
          <div className="lg:hidden text-center space-y-2 mb-6">
            <div className="inline-block bg-[#D62828] text-white font-black text-2xl px-4 py-1 rounded-xl tracking-tighter shadow-lg">
              huga
            </div>
            <h1 className="text-base font-black text-white uppercase tracking-wider pt-1">
              Retail Control Deck
            </h1>
          </div>

          <div className="space-y-1.5 mb-6">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Authorized Personnel</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Sign in to Workspace
            </h1>
            <p className="text-xs text-slate-400">
              Enter your assigned staff credentials to access inventory and scan logs.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs p-3.5 rounded-xl flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-300"
              >
                Staff Email
              </label>
              <div className="relative group">
                <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@huga.com"
                  className="w-full bg-[#060913] border border-slate-800 hover:border-slate-700 text-xs pl-10 pr-4 py-3.5 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-300"
                >
                  Password
                </label>
              </div>
              <div className="relative group">
                <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#060913] border border-slate-800 hover:border-slate-700 text-xs pl-10 pr-11 py-3.5 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-black py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Control Deck</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Note */}
          <p className="text-[11px] text-slate-500 text-center mt-6 font-mono">
            All scan & audit sessions are logged by user ID.
          </p>
        </div>
      </div>
    </div>
  );
}