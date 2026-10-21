"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { ErrorBox } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/"; // never redirect off-site
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isLogin) await login(email, password);
      else await register(email, password, name);
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-6" noValidate={false}>
      <h1 className="text-3xl">{isLogin ? "Sign in" : "Create your account"}</h1>
      {error && <ErrorBox message={error} />}
      {!isLogin && (
        <div>
          <label className="label" htmlFor="name">
            Name shown on your reports (only staff see it)
          </label>
          <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password {isLogin ? "" : "(at least 10 characters)"}
        </label>
        <input id="password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isLogin ? 1 : 10} maxLength={128} autoComplete={isLogin ? "current-password" : "new-password"} />
      </div>
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
      </button>
      <p className="text-center text-sm text-ink-soft">
        {isLogin ? "New here? " : "Already have an account? "}
        <Link className="font-semibold text-civic underline" href={`${isLogin ? "/register" : "/login"}?next=${encodeURIComponent(next)}`}>
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
