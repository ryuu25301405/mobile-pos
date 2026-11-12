"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Redirect to scanner or analytics deck upon successful login
    router.push("/scanview");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        
        {/* HUGA Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-block bg-[#D62828] text-white font-black text-2xl px-4 py-1 rounded-xl tracking-tighter shadow-lg">
            huga
          </div>
          <h1 className="text-lg font-black text-white uppercase tracking-wide pt-2">
            Retail Control Deck
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Authorized Store & Audit Personnel Only
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Staff Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@huga.com"
                className="w-full bg-slate-950 border border-slate-800 text-xs pl-10 pr-4 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 text-xs pl-10 pr-4 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            <span>{loading ? "Authenticating..." : "Sign In to System"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}