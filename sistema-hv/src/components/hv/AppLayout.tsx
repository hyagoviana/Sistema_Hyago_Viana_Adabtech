import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div
        className="flex-1 min-w-0 flex flex-col"
        style={{
          // Handoff v3 — fundo creme em degradê para o branco quente (nunca chapado).
          background: "var(--hv-bg-app)",
        }}
      >
        <Topbar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
