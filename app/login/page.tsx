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
    <div className="min-h-screen bg-[#0B111E] text-slate-200 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans antialiased selection:bg-emerald-500/25 selection:text-emerald-200">
      {/* Soft Diffused Aurora Background (Soothing, Low-Contrast) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(214, 40, 40, 0.12), transparent 45%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.11), transparent 50%), radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.5), transparent 80%)",
        }}
      />

      {/* Subtle Ambient Floating Glows */}
      <div className="absolute -top-32 left-1/4 w-[480px] h-[480px] bg-[#D62828]/[0.08] rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 w-[480px] h-[480px] bg-teal-500/[0.08] rounded-full blur-[130px] pointer-events-none" />

      {/* Main Centered Container */}
      <div className="w-full max-w-[420px] relative z-10 flex flex-col items-center">
        {/* Frosted Glass Card */}
        <div className="w-full bg-slate-900/55 backdrop-blur-2xl rounded-[32px] p-8 sm:p-10 border border-slate-700/40 shadow-[0_32px_90px_-16px_rgba(2,6,23,0.85)] relative overflow-hidden">
          {/* Soft Top Glass Rim Light */}
          <div className="absolute inset-x-10 top-0 h-[1px] bg-gradient-to-r from-transparent via-slate-300/25 to-transparent" />

          {/* Brand & Title Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-5">
              <div className="absolute -inset-1.5 bg-[#D62828]/30 rounded-2xl blur-md" />
              <div className="relative bg-gradient-to-br from-[#E03131] to-[#B91C1C] text-white font-black text-2xl px-4.5 py-1 rounded-xl tracking-tighter shadow-md">
                huga
              </div>
            </div>

            <h1 className="text-[22px] font-semibold tracking-tight text-slate-100">
              Retail Control Deck
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-[260px]">
              Sign in to manage store inventory, barcode audits, and stock transfers
            </p>
          </div>

          {/* Soft Error Banner */}
          {error && (
            <div className="mb-6 bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs p-3.5 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Staff Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-300 pl-1"
              >
                Staff Email
              </label>
              <div className="relative group">
                <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-emerald-400 transition-colors absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@huga.com"
                  className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600/70 text-sm pl-11 pr-4 py-3.5 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:bg-slate-950/70 focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-300 pl-1"
              >
                Password
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-emerald-400 transition-colors absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600/70 text-sm pl-11 pr-12 py-3.5 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:bg-slate-950/70 focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Soothing Emerald-Teal Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_12px_30px_-8px_rgba(16,185,129,0.4)]"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Subtle Security & Branch Footer Inside Card */}
          <div className="mt-8 pt-5 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
              <span>Audited Session</span>
            </div>
            <span className="text-slate-500">Trinoma • Makati • Colon</span>
          </div>
        </div>
      </div>
    </div>
  );
}