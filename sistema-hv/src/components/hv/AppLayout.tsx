import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <div
        className="flex-1 min-w-0 flex flex-col"
        style={{
          // Degradê horizontal: creme à esquerda → esbranquiçando à direita
          background: "linear-gradient(90deg, #ece4d1 0%, #f2ecdd 45%, #f8f4ec 100%)",
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
