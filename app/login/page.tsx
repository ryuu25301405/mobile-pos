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
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans antialiased selection:bg-[#D62828]/30 selection:text-white">
      {/* Subtle Top-Center Radial Spotlight */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(214, 40, 40, 0.18), rgba(16, 185, 129, 0.06) 45%, transparent 75%)",
        }}
      />

      {/* Fine Dot Matrix Texture */}
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Main Centered Container */}
      <div className="w-full max-w-[400px] relative z-10 flex flex-col items-center">
        {/* Top Live Status Pill */}
        <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md text-[11px] font-medium text-slate-400 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span>HUGA Retail Operations • Online</span>
        </div>

        {/* Glassmorphic Spotlight Card */}
        <div className="w-full bg-[#0D111A]/90 backdrop-blur-2xl rounded-[28px] p-8 sm:p-9 border border-white/[0.08] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.9)] relative overflow-hidden">
          {/* Top Edge Metallic Shimmer */}
          <div className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="bg-[#D62828] text-white font-black text-2xl px-4 py-1 rounded-xl tracking-tighter shadow-[0_8px_24px_-4px_rgba(214,40,40,0.5)] mb-4">
              huga
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Control Deck Sign In
            </h1>
            <p className="text-xs text-slate-400 mt-1.5">
              Enter your staff credentials to access inventory &amp; audits
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs p-3.5 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-300 pl-0.5"
              >
                Staff Email
              </label>
              <div className="relative group">
                <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-white transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@huga.com"
                  className="w-full bg-[#07090E]/80 border border-white/[0.08] hover:border-white/[0.16] text-sm pl-10 pr-4 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-white/30 focus:ring-4 focus:ring-white/[0.04] transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-300 pl-0.5"
              >
                Password
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-white transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#07090E]/80 border border-white/[0.08] hover:border-white/[0.16] text-sm pl-10 pr-11 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-white/30 focus:ring-4 focus:ring-white/[0.04] transition-all"
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

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-b from-white to-slate-200 hover:from-white hover:to-white active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.4),0_12px_28px_-6px_rgba(255,255,255,0.22)]"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Minimalist Branch & Security Caption Below Card */}
        <div className="mt-7 text-center space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">
            Trinoma • Makati • Metro Gaisano Colon
          </p>
          <p className="text-[10px] font-mono text-slate-600">
            Authorized Personnel Only • Session Audited
          </p>
        </div>
      </div>
    </div>
  );
}