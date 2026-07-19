import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MODULE_HAS_VALUES,
  MODULE_LABELS,
  MODULES,
  type Module,
  type ModuleAccess,
} from "@/lib/rbac";

// Editor de permissões por módulo/aba (R3 + Fase B, 2026-07-19). Reutilizado no
// convite e na edição de um usuário. Cada aba tem:
//  - ACESSO: "Padrão do papel" / "Não ver" / "Visualizar" / "Editar".
//  - VER VALORES (só nas abas que exibem R$): "Padrão" / "Ver R$" / "Ocultar R$"
//    — liga/desliga a exibição de valores para o colaborador, independente do
//    acesso à aba.
// O estado é o mapa de OVERRIDES (access + values); ausência/null = padrão do papel.
//
// Sentinelas no Select porque o Radix não lida bem com value="".
const DEFAULT = "default";
const VAL_SEE = "see";
const VAL_HIDE = "hide";

export type ModulePermsValue = {
  access: Partial<Record<Module, ModuleAccess | null>>;
  values: Partial<Record<Module, boolean | null>>;
};

export function ModulePermsGrid({
  value,
  onChange,
  disabled = false,
}: {
  value: ModulePermsValue;
  onChange: (next: ModulePermsValue) => void;
  disabled?: boolean;
}) {
  const setAccess = (mod: Module, raw: string) => {
    const access = raw === DEFAULT ? null : (raw as ModuleAccess);
    onChange({ ...value, access: { ...value.access, [mod]: access } });
  };
  const setValues = (mod: Module, raw: string) => {
    const v = raw === VAL_SEE ? true : raw === VAL_HIDE ? false : null;
    onChange({ ...value, values: { ...value.values, [mod]: v } });
  };
  const valSel = (mod: Module) => {
    const v = value.values[mod];
    return v === true ? VAL_SEE : v === false ? VAL_HIDE : DEFAULT;
  };

  return (
    <div className="space-y-2">
      <p className="text-[12.5px] font-medium text-[var(--navy)]">Permissões por aba</p>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Por aba: o que o colaborador pode fazer. Nas abas com valores (R$), a 2ª chave liga/desliga
        a exibição dos valores. &quot;Padrão&quot; segue o cargo escolhido.
      </p>
      <div className="space-y-1.5 pt-1">
        {MODULES.map((mod) => (
          <div key={mod} className="flex items-center gap-2">
            <span className="text-[12.5px] text-[var(--navy)] flex-1 min-w-0 truncate">
              {MODULE_LABELS[mod]}
            </span>
            <div className="w-[140px] shrink-0">
              <Select
                value={value.access[mod] ?? DEFAULT}
                onValueChange={(v) => setAccess(mod, v)}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT}>Padrão do papel</SelectItem>
                  <SelectItem value="none">Não ver</SelectItem>
                  <SelectItem value="view">Visualizar</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[120px] shrink-0">
              {MODULE_HAS_VALUES[mod] ? (
                <Select
                  value={valSel(mod)}
                  onValueChange={(v) => setValues(mod, v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT}>Valores: padrão</SelectItem>
                    <SelectItem value={VAL_SEE}>Ver R$</SelectItem>
                    <SelectItem value={VAL_HIDE}>Ocultar R$</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="block text-[10.5px] text-[var(--ink-300)] text-center select-none">
                  sem valores
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
