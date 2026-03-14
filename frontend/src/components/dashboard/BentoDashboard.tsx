import { useMemo, useState } from "react";
import { BellRing, IndianRupee, ShieldCheck, UtensilsCrossed } from "lucide-react";

import { Switch } from "@/components/ui/switch";

interface FeatureState {
  mess: boolean;
  gate_access: boolean;
  gst: boolean;
}

export function BentoDashboard() {
  const [features, setFeatures] = useState<FeatureState>({
    mess: true,
    gate_access: true,
    gst: true,
  });

  const cards = useMemo(
    () => [
      {
        title: "Mess Module",
        key: "mess" as const,
        icon: UtensilsCrossed,
        desc: "Enable meal operations and attendance for all hostels.",
      },
      {
        title: "Gate Access",
        key: "gate_access" as const,
        icon: ShieldCheck,
        desc: "Control resident in/out logs and security checkpoints.",
      },
      {
        title: "GST Billing",
        key: "gst" as const,
        icon: IndianRupee,
        desc: "Apply GST rules to eligible transactions.",
      },
    ],
    [],
  );

  const toggleFeature = (key: keyof FeatureState) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="mx-auto max-w-md px-4 pb-24 pt-6">
      <header className="mb-5 rounded-3xl bg-gradient-to-r from-emerald-900 to-teal-700 p-5 text-white shadow-panel">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">HostelHub India</p>
        <h1 className="font-display text-2xl">Super Admin Console</h1>
        <p className="mt-2 text-sm text-emerald-50">Unified controls for compliance and operations.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <article className="col-span-2 rounded-3xl bg-white p-4 shadow-panel">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg text-slate-900">Live Residents</h2>
              <p className="text-sm text-slate-600">Directory sync with network-first cache</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">428</span>
          </div>
        </article>

        {cards.map(({ title, key, icon: Icon, desc }) => (
          <article key={key} className="col-span-2 rounded-3xl bg-white p-4 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex rounded-xl bg-teal-50 p-2 text-teal-700">
                  <Icon size={18} />
                </div>
                <h3 className="font-display text-base text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{desc}</p>
              </div>
              <div className="flex min-h-[44px] min-w-[44px] items-center justify-center">
                <Switch
                  checked={features[key]}
                  onCheckedChange={() => toggleFeature(key)}
                  aria-label={`Toggle ${title}`}
                />
              </div>
            </div>
          </article>
        ))}

        <article className="col-span-2 rounded-3xl bg-slate-900 p-4 text-white shadow-panel">
          <div className="flex items-center gap-2">
            <BellRing size={18} />
            <h3 className="font-display text-base">Policy Alert</h3>
          </div>
          <p className="mt-2 text-sm text-slate-200">GST auto-applies at 12% when rent exceeds INR 1000 per day.</p>
        </article>
      </div>

      <form className="mt-4 rounded-3xl bg-white p-4 shadow-panel">
        <h3 className="font-display text-base text-slate-900">Quick Owner Invite</h3>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <input
            type="text"
            placeholder="Owner full name"
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
          <input
            type="email"
            placeholder="Owner email"
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
          <button
            type="button"
            className="min-h-[44px] rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
          >
            Send Invite
          </button>
        </div>
      </form>
    </section>
  );
}
