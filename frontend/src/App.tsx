import { BentoDashboard } from "@/components/dashboard/BentoDashboard";
import { BottomNav } from "@/components/layout/BottomNav";

function App() {
  return (
    <main className="min-h-screen bg-brand-gradient font-body">
      <BentoDashboard />
      <BottomNav />
    </main>
  );
}

export default App;
