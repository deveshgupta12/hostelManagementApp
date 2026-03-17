import { FormEvent, useState } from "react";

type LoginFormProps = {
  onLoginSuccess: (token: string) => void;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("superadmin@hostelhub.in");
  const [password, setPassword] = useState("Admin@123");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail ?? "Login failed. Please check your credentials.");
      }

      const payload = (await response.json()) as { access_token: string };
      onLoginSuccess(payload.access_token);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to login.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
      <form onSubmit={onSubmit} className="w-full rounded-3xl bg-white p-5 shadow-panel">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">HostelHub India</p>
        <h1 className="mt-1 font-display text-2xl text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Use your Super Admin credentials to continue.</p>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="min-h-[44px] rounded-xl border border-slate-300 px-3"
              required
            />
          </label>
          <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="min-h-[44px] rounded-xl border border-slate-300 px-3"
              required
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={isLoading}
            className="min-h-[44px] rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </section>
  );
}