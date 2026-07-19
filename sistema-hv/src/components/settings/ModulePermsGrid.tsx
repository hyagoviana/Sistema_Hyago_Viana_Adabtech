import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODULE_LABELS, MODULES, type Module, type ModuleAccess } from "@/lib/rbac";

// Editor de permissões por módulo/aba (R3, 2026-07-19). Reutilizado no convite e
// na edição de um usuário. Cada aba tem 4 opções: "Padrão do papel" (sem
// override → cai no papel base), "Não ver" (none), "Visualizar" (view) e
// "Editar" (edit). O estado é o mapa de OVERRIDES: módulo ausente/null = padrão.
//
// Sentinela "default" no Select porque o Radix não lida bem com value="".
const DEFAULT = "default";

export type ModulePermsValue = Partial<Record<Module, ModuleAccess | null>>;

export function ModulePermsGrid({
  value,
  onChange,
  disabled = false,
}: {
  value: ModulePermsValue;
  onChange: (next: ModulePermsValue) => void;
  disabled?: boolean;
}) {
  const set = (mod: Module, raw: string) => {
    const access = raw === DEFAULT ? null : (raw as ModuleAccess);
    onChange({ ...value, [mod]: access });
  };

  return (
    <div className="space-y-2">
      <p className="text-[12.5px] font-medium text-[var(--navy)]">Permissões por aba</p>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Defina, por aba, o que este colaborador pode fazer. "Padrão do papel" segue o cargo
        escolhido; os demais sobrescrevem só aquela aba.
      </p>
      <div className="space-y-1.5 pt-1">
        {MODULES.map((mod) => (
          <div key={mod} className="flex items-center gap-3">
            <span className="text-[12.5px] text-[var(--navy)] flex-1">{MODULE_LABELS[mod]}</span>
            <div className="w-[160px] shrink-0">
              <Select
                value={value[mod] ?? DEFAULT}
                onValueChange={(v) => set(mod, v)}
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
          </div>
        ))}
      </div>
    </div>
  );
}
