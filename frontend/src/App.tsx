import { useMemo, useState } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { BentoDashboard } from "@/components/dashboard/BentoDashboard";
import { BottomNav, type DashboardTab } from "@/components/layout/BottomNav";

const TOKEN_STORAGE_KEY = "hostelhub_token";

function App() {
  const initialToken = useMemo(() => localStorage.getItem(TOKEN_STORAGE_KEY), []);
  const [token, setToken] = useState<string | null>(initialToken);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  const handleLoginSuccess = (nextToken: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
    setActiveTab("overview");
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setActiveTab("overview");
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-brand-gradient font-body">
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-gradient font-body">
      <div className="mx-auto max-w-md px-4 pt-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[44px] rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Logout
          </button>
        </div>
      </div>
      <BentoDashboard activeTab={activeTab} token={token} onAuthError={handleLogout} />
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}

export default App;
