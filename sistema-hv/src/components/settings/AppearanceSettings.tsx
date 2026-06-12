import { useEffect, useState } from "react";
import { Palette, Type, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "hv:theme-overrides";

type ThemeOverrides = {
  gold: string;
  navy: string;
  bgPage: string;
  fontSans: string;
};

const DEFAULTS: ThemeOverrides = {
  gold: "#987814",
  navy: "#1e2044",
  bgPage: "#f1ead9",
  fontSans: '"Inter Variable", "Inter", system-ui, sans-serif',
};

const FONT_OPTIONS = [
  { label: "Inter (padrão)", value: '"Inter Variable", "Inter", system-ui, sans-serif' },
  { label: "System UI", value: "system-ui, -apple-system, sans-serif" },
  { label: "Roboto", value: '"Roboto", system-ui, sans-serif' },
  { label: "Poppins", value: '"Poppins", system-ui, sans-serif' },
  { label: "Nunito", value: '"Nunito", system-ui, sans-serif' },
];

const COLOR_PRESETS = [
  { label: "Clássico (Dourado)", gold: "#987814", navy: "#1e2044", bgPage: "#f1ead9" },
  { label: "Azul Profissional", gold: "#2563eb", navy: "#1e293b", bgPage: "#f1f5f9" },
  { label: "Verde Advocacia", gold: "#15803d", navy: "#1a2e1a", bgPage: "#f0fdf4" },
  { label: "Bordô Elegante", gold: "#9f1239", navy: "#2d1b2e", bgPage: "#fdf2f8" },
  { label: "Grafite Moderno", gold: "#525252", navy: "#171717", bgPage: "#f5f5f5" },
];

function loadOverrides(): ThemeOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function applyOverrides(o: ThemeOverrides) {
  const root = document.documentElement;
  root.style.setProperty("--gold", o.gold);
  root.style.setProperty("--navy", o.navy);
  root.style.setProperty("--bg-page", o.bgPage);
  root.style.setProperty("--background", o.bgPage);
  root.style.setProperty("--font-sans", o.fontSans);
  // Derive related tones from gold
  root.style.setProperty("--ring", hexToRgba(o.gold, 0.4));
  root.style.setProperty("--primary", o.gold);
  root.style.setProperty("--secondary-foreground", o.navy);
  root.style.setProperty("--sidebar-primary", o.navy);
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function AppearanceSettings() {
  const [overrides, setOverrides] = useState<ThemeOverrides>(loadOverrides);

  useEffect(() => {
    applyOverrides(overrides);
  }, [overrides]);

  function update(patch: Partial<ThemeOverrides>) {
    const next = { ...overrides, ...patch };
    setOverrides(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function reset() {
    setOverrides({ ...DEFAULTS });
    localStorage.removeItem(STORAGE_KEY);
    // Remove inline styles so CSS file defaults take over
    const root = document.documentElement;
    for (const prop of ["--gold", "--navy", "--bg-page", "--background", "--font-sans", "--ring", "--primary", "--secondary-foreground", "--sidebar-primary"]) {
      root.style.removeProperty(prop);
    }
    toast.success("Aparência restaurada ao padrão");
  }

  return (
    <section className="card-editorial !p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-[var(--gold)]" />
          <h3 className="text-[15px] font-semibold text-[var(--navy)]">Aparência</h3>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-[var(--navy)] transition-colors"
        >
          <RotateCcw size={12} />
          Restaurar padrão
        </button>
      </div>

      {/* Presets */}
      <div className="mb-5">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
          Tema
        </label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((p) => {
            const active = overrides.gold === p.gold && overrides.navy === p.navy;
            return (
              <button
                key={p.label}
                onClick={() => update({ gold: p.gold, navy: p.navy, bgPage: p.bgPage })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[12.5px] font-medium transition-all"
                style={{
                  borderColor: active ? p.gold : "var(--border)",
                  background: active ? hexToRgba(p.gold, 0.08) : "var(--card)",
                  color: active ? p.navy : "var(--foreground)",
                  boxShadow: active ? `0 0 0 2px ${hexToRgba(p.gold, 0.2)}` : undefined,
                }}
              >
                <span
                  className="w-4 h-4 rounded-full border"
                  style={{ background: p.gold, borderColor: hexToRgba(p.navy, 0.2) }}
                />
                <span
                  className="w-4 h-4 rounded-full border"
                  style={{ background: p.navy, borderColor: hexToRgba(p.navy, 0.2) }}
                />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom colors */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div>
          <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
            Cor principal
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={overrides.gold}
              onChange={(e) => update({ gold: e.target.value })}
              className="w-8 h-8 rounded-lg border border-[var(--border)] cursor-pointer"
            />
            <input
              type="text"
              value={overrides.gold}
              onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && update({ gold: e.target.value })}
              className="flex-1 h-8 px-2 rounded-md border border-[var(--border)] bg-transparent text-[12px] font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
            Cor escura (sidebar)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={overrides.navy}
              onChange={(e) => update({ navy: e.target.value })}
              className="w-8 h-8 rounded-lg border border-[var(--border)] cursor-pointer"
            />
            <input
              type="text"
              value={overrides.navy}
              onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && update({ navy: e.target.value })}
              className="flex-1 h-8 px-2 rounded-md border border-[var(--border)] bg-transparent text-[12px] font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
            Cor de fundo
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={overrides.bgPage}
              onChange={(e) => update({ bgPage: e.target.value })}
              className="w-8 h-8 rounded-lg border border-[var(--border)] cursor-pointer"
            />
            <input
              type="text"
              value={overrides.bgPage}
              onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && update({ bgPage: e.target.value })}
              className="flex-1 h-8 px-2 rounded-md border border-[var(--border)] bg-transparent text-[12px] font-mono"
            />
          </div>
        </div>
      </div>

      {/* Font */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Type size={13} className="text-muted-foreground" />
          <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
            Fonte
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {FONT_OPTIONS.map((f) => {
            const active = overrides.fontSans === f.value;
            return (
              <button
                key={f.value}
                onClick={() => update({ fontSans: f.value })}
                className="px-3 py-1.5 rounded-lg border text-[12.5px] font-medium transition-all"
                style={{
                  fontFamily: f.value,
                  borderColor: active ? "var(--gold)" : "var(--border)",
                  background: active ? "var(--gold-pale, #faf4e2)" : "var(--card)",
                  color: active ? "var(--navy)" : "var(--foreground)",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Aplica overrides salvos no carregamento da app (chamar no root/layout). */
export function initThemeOverrides() {
  const saved = loadOverrides();
  const hasCustom = localStorage.getItem(STORAGE_KEY);
  if (hasCustom) applyOverrides(saved);
}
