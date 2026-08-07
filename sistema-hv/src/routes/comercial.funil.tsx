import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StageChecklistEditor } from "@/components/pipeline/StageChecklistEditor";
import { Breadcrumb, Eyebrow } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  useCreateStage,
  useDeleteStage,
  useServiceTypes,
  useStages,
  useUpdateStage,
} from "@/hooks/usePipeline";

export const Route = createFileRoute("/comercial/funil")({
  component: FunilEditor,
});

type Stage = {
  id: string;
  slug: string;
  label: string;
  stage_role: string;
  ordem: number;
  active: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  normal: "Normal",
  won: "Ganho",
  lost: "Perdido",
  closed: "Encerrado",
};

function StageList({
  serviceTypeId,
  kind,
  canEdit,
}: {
  serviceTypeId: string;
  kind: "op" | "fin";
  canEdit: boolean;
}) {
  const { data: stages, isLoading } = useStages(serviceTypeId, kind);
  const updateMut = useUpdateStage(serviceTypeId, kind);
  const createMut = useCreateStage(serviceTypeId, kind);
  const deleteMut = useDeleteStage(serviceTypeId, kind);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const list = (stages ?? []) as Stage[];

  async function saveLabel(s: Stage, label: string) {
    if (label === s.label || !label.trim()) return;
    try {
      await updateMut.mutateAsync({ id: s.id, patch: { label: label.trim() } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar etapa");
    }
  }

  async function saveRole(s: Stage, role: string) {
    try {
      await updateMut.mutateAsync({ id: s.id, patch: { stage_role: role } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar papel");
    }
  }

  async function createStage() {
    const label = newLabel.trim();
    const slug = newSlug.trim().toUpperCase().replace(/\s+/g, "_");
    if (!label || !slug) {
      toast.error("Informe rótulo e slug da nova etapa");
      return;
    }
    try {
      await createMut.mutateAsync({
        service_type_id: serviceTypeId,
        kind,
        slug,
        label,
        ordem: list.length,
      });
      toast.success("Etapa criada");
      setNewLabel("");
      setNewSlug("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar etapa");
    }
  }

  async function removeStage(s: Stage) {
    if (!confirm(`Excluir a etapa "${s.label}"?`)) return;
    try {
      await deleteMut.mutateAsync(s.id);
      toast.success("Etapa excluída");
    } catch (err) {
      // 409 do serviço: etapa em uso (casos ou checklist items ancorados).
      toast.error(err instanceof Error ? err.message : "Falha ao excluir etapa");
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando etapas…</p>;

  return (
    <div className="space-y-2">
      {list.map((s) => (
        <div key={s.id} className="rounded-lg border">
          <div className="flex items-center gap-3 px-3 py-2">
            <button
              type="button"
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="text-muted-foreground hover:text-foreground"
              title="Itens de checklist desta etapa"
            >
              {expanded === s.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <Input
              defaultValue={s.label}
              disabled={!canEdit}
              onBlur={(e) => saveLabel(s, e.target.value)}
              className="max-w-[240px]"
            />
            <span className="text-[11px] font-mono text-muted-foreground" title="Slug (imutável)">
              {s.slug}
            </span>
            <Select value={s.stage_role} onValueChange={(v) => saveRole(s, v)} disabled={!canEdit}>
              <SelectTrigger className="w-[130px] ml-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && (
              <button
                type="button"
                title="Excluir etapa (bloqueado se houver casos/checklist)"
                onClick={() => removeStage(s)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {expanded === s.id && (
            <div className="border-t bg-muted/20 px-4 py-3">
              <StageChecklistEditor
                serviceTypeId={serviceTypeId}
                stageSlug={s.slug}
                canEdit={canEdit}
              />
            </div>
          )}
        </div>
      ))}

      {canEdit && (
        <div className="flex items-end gap-2 rounded-lg border border-dashed p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Nova etapa · rótulo</label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Ex.: Análise documental"
              className="max-w-[240px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Slug (novo)</label>
            <Input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="ANALISE_DOC"
              className="max-w-[180px] font-mono"
            />
          </div>
          <Button type="button" onClick={createStage} disabled={createMut.isPending}>
            <Plus size={14} className="mr-1" /> Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}

function FunilEditor() {
  const { data: types } = useServiceTypes();
  const { role } = useAuth();
  const canEdit = can(role, "config.manage");
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const typeList = useMemo(() => (types ?? []) as { id: string; name: string }[], [types]);
  const current = selected ?? typeList[0]?.id;

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Comercial", to: "/comercial" }, { label: "Funil" }]} />
      <header className="mb-6">
        <Eyebrow>Comercial</Eyebrow>
        <h1 className="font-display text-[32px] font-bold text-[var(--navy)] mt-1">
          Editor de funil por tipo de serviço
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ajuste as etapas de cada tipo (rótulo, papel) e os itens de checklist de cada etapa. O
          slug de uma etapa em uso não muda · para uma etapa diferente, crie uma nova.
        </p>
      </header>

      {!canEdit && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Você está em modo leitura · apenas administradores editam o funil.
        </p>
      )}

      <div className="mb-6 max-w-xs">
        <label className="text-sm font-medium">Tipo de serviço</label>
        <Select value={current} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um tipo" />
          </SelectTrigger>
          <SelectContent>
            {typeList.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {current && (
        <div className="grid lg:grid-cols-2 gap-8">
          <section>
            <h2 className="font-display text-lg font-semibold text-[var(--navy)] mb-3">
              Etapas operacionais
            </h2>
            <StageList serviceTypeId={current} kind="op" canEdit={canEdit} />
          </section>
          <section>
            <h2 className="font-display text-lg font-semibold text-[var(--navy)] mb-3">
              Etapas financeiras
            </h2>
            <StageList serviceTypeId={current} kind="fin" canEdit={canEdit} />
          </section>
        </div>
      )}
    </div>
  );
}
