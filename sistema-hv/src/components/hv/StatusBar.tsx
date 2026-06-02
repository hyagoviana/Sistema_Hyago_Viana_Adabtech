import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";

import { useAuth } from "@/lib/auth";

export function StatusBar() {
  const { session } = useAuth();
  const email = session?.user?.email ?? "";
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("pt-BR", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center px-4 gap-3 text-[11px] glass-panel"
      style={{
        height: 28,
        borderTop: "1px solid var(--border)",
        color: "var(--ink-500)",
      }}
    >
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
        Sistema online
      </span>
      <span className="text-[var(--ink-300)]">·</span>
      <span>Hyago Viana Advocacia</span>
      <span className="text-[var(--ink-300)]">·</span>
      <span className="truncate max-w-[220px]">Sessão: {email || "—"}</span>
      <span className="text-[var(--ink-300)]">·</span>
      <span className="tabular" suppressHydrationWarning>
        {time || "--:--:--"}
      </span>
      <span className="text-[var(--ink-300)]">·</span>
      <span className="font-mono text-[10px]">v1.0.0</span>
      <div className="flex-1" />
      <button
        className="group relative inline-flex items-center gap-1.5 hover:text-[#1a1a1f]"
        title="Atalhos de teclado"
      >
        <Keyboard size={12} strokeWidth={1.6} />
        Atalhos
        <span
          className="hidden group-hover:block absolute right-0 bottom-7 w-60 p-3 rounded-xl text-left text-[#1a1a1f]"
          style={{
            background: "var(--card)",
            border: "1px solid rgba(120,96,30,0.14)",
            boxShadow: "0 12px 28px -10px rgba(60,50,20,0.22)",
          }}
        >
          <div className="text-[10px] uppercase tracking-wider text-[var(--ink-400)] mb-1.5">
            Atalhos
          </div>
          {[
            ["⌘K", "Busca global"],
            ["g c", "Ir para Casos"],
            ["g t", "Ir para Tarefas"],
            ["c", "Criar novo"],
            ["?", "Ajuda"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-0.5 text-[11.5px]">
              <kbd className="font-mono text-[var(--ink-500)]">{k}</kbd>
              <span>{v}</span>
            </div>
          ))}
        </span>
      </button>
    </footer>
  );
}
