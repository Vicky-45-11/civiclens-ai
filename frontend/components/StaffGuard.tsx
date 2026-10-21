"use client";

import { useAuth } from "./AuthProvider";
import { NeedSignIn, Spinner } from "./ui";

export function StaffGuard({ next, children }: { next: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <NeedSignIn next={next} />;
  if (user.role === "resident")
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl">Staff only</h1>
        <p className="mt-1 text-sm text-ink-soft">Your account does not have access to the staff dashboard.</p>
      </div>
    );
  return <>{children}</>;
}
