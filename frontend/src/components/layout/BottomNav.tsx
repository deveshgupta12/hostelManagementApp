import { BarChart3, Building2, MenuSquare, UserRound } from "lucide-react";

const navItems = [
  { label: "Overview", icon: BarChart3, active: true },
  { label: "Rooms", icon: Building2, active: false },
  { label: "Residents", icon: UserRound, active: false },
  { label: "More", icon: MenuSquare, active: false },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-emerald-900/20 bg-white/95 backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-4 px-2 py-2">
        {navItems.map(({ label, icon: Icon, active }) => (
          <li key={label}>
            <button
              type="button"
              className="mx-auto flex min-h-[44px] min-w-[44px] w-full flex-col items-center justify-center rounded-xl px-1 py-1 text-xs"
            >
              <Icon className={active ? "text-emerald-700" : "text-slate-500"} size={20} />
              <span className={active ? "text-emerald-700" : "text-slate-500"}>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
