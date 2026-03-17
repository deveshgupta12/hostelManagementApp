import { BarChart3, Building2, MenuSquare, Settings, UserRound } from "lucide-react";

export type DashboardTab = "overview" | "rooms" | "residents" | "settings" | "more";

const navItems = [
  { label: "Overview", icon: BarChart3, key: "overview" },
  { label: "Rooms", icon: Building2, key: "rooms" },
  { label: "Residents", icon: UserRound, key: "residents" },
  { label: "Settings", icon: Settings, key: "settings" },
  { label: "More", icon: MenuSquare, key: "more" },
] as const;

type BottomNavProps = {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
};

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-emerald-900/20 bg-white/95 backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-5 px-2 py-2">
        {navItems.map(({ label, icon: Icon, key }) => {
          const isActive = activeTab === key;
          return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onTabChange(key)}
              className="mx-auto flex min-h-[44px] min-w-[44px] w-full flex-col items-center justify-center rounded-xl px-1 py-1 text-xs"
            >
              <Icon className={isActive ? "text-emerald-700" : "text-slate-500"} size={20} />
              <span className={isActive ? "text-emerald-700" : "text-slate-500"}>{label}</span>
            </button>
          </li>
          );
        })}
      </ul>
    </nav>
  );
}
