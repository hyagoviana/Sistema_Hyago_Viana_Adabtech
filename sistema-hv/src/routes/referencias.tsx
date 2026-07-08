import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteMunicipio,
  useDeletePerfil,
  useMunicipios,
  usePerfis,
  useUpsertMunicipio,
  useUpsertPerfil,
} from "@/hooks/useReferencias";

export const Route = createFileRoute("/referencias")({
  component: Referencias,
});

type MunForm = {
  id?: string;
  nome: string;
  populacao: string;
  densidade: string;
  salario_medio: string;
  percentual: string;
  ibge: string;
  secretario_nome: string;
  secretario_cargo: string;
};

const EMPTY_MUN: MunForm = {
  nome: "",
  populacao: "",
  densidade: "",
  salario_medio: "",
  percentual: "",
  ibge: "",
  secretario_nome: "",
  secretario_cargo: "",
};

function MunicipiosSection() {
  const { data, isLoading } = useMunicipios();
  const upsert = useUpsertMunicipio();
  const del = useDeleteMunicipio();
  const [form, setForm] = useState<MunForm | null>(null);

  async function save() {
    if (!form?.nome.trim()) return toast.error("Informe o município");
    try {
      await upsert.mutateAsync(form);
      toast.success("Município salvo");
      setForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  const field = (k: keyof MunForm, ph: string) => (
    <Input
      placeholder={ph}
      value={form?.[k] ?? ""}
      onChange={(e) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f))}
    />
  );

  return (
    <div className="card-editorial !p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[20px] font-bold text-[var(--navy)]">Municípios</h2>
        {!form && (
          <Button size="sm" onClick={() => setForm({ ...EMPTY_MUN })}>
            <Plus size={14} className="mr-1.5" /> Novo município
          </Button>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        Preencha 1x por cidade — população, densidade, salário médio, percentual, IBGE e secretário
        são puxados no documento (e continuam editáveis na geração).
      </p>

      {form && (
        <div className="border border-[var(--border)] rounded-md p-3 mb-4 grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            {field("nome", "Município - UF (ex.: São Paulo - SP)")}
            {field("ibge", "Código IBGE (ex.: 355030)")}
            {field("populacao", "População (ex.: 11.451.245)")}
            {field("densidade", "Densidade (ex.: 7.527,76)")}
            {field("salario_medio", "Salário médio (ex.: 4,3)")}
            {field("percentual", "Percentual (ex.: 31,6%)")}
            {field("secretario_nome", "Secretário(a) de Saúde")}
            {field("secretario_cargo", "Cargo (Secretário / Secretária)")}
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setForm(null)}>
              <X size={14} className="mr-1.5" /> Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={upsert.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-20" />
      ) : (data ?? []).length === 0 ? (
        <div className="text-[13px] text-muted-foreground italic">Nenhum município cadastrado.</div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {(data ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-[13px]">
              <div>
                <span className="font-medium text-[var(--navy)]">{m.nome}</span>
                <span className="text-muted-foreground ml-2">
                  IBGE {m.ibge ?? "—"} · pop. {m.populacao ?? "—"} · sec. {m.secretario_nome ?? "—"}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setForm({
                      id: m.id,
                      nome: m.nome ?? "",
                      populacao: m.populacao ?? "",
                      densidade: m.densidade ?? "",
                      salario_medio: m.salario_medio ?? "",
                      percentual: m.percentual ?? "",
                      ibge: m.ibge ?? "",
                      secretario_nome: m.secretario_nome ?? "",
                      secretario_cargo: m.secretario_cargo ?? "",
                    })
                  }
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Excluir o município "${m.nome}"?`)) del.mutate(m.id);
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PerfisSection() {
  const { data, isLoading } = usePerfis();
  const upsert = useUpsertPerfil();
  const del = useDeletePerfil();
  const [form, setForm] = useState<{ id?: string; nome: string; texto: string } | null>(null);

  async function save() {
    if (!form?.nome.trim()) return toast.error("Informe o nome do perfil");
    try {
      await upsert.mutateAsync(form);
      toast.success("Perfil salvo");
      setForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  return (
    <div className="card-editorial !p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[20px] font-bold text-[var(--navy)]">Perfis</h2>
        {!form && (
          <Button size="sm" onClick={() => setForm({ nome: "", texto: "" })}>
            <Plus size={14} className="mr-1.5" /> Novo perfil
          </Button>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        Nº do perfil (ex.: PERFIL 3) → texto padrão inserido no documento.
      </p>

      {form && (
        <div className="border border-[var(--border)] rounded-md p-3 mb-4 grid gap-2">
          <Input
            placeholder="Nome do perfil (ex.: PERFIL 3)"
            value={form.nome}
            onChange={(e) => setForm((f) => (f ? { ...f, nome: e.target.value } : f))}
          />
          <textarea
            className="w-full min-h-[90px] rounded-md border border-[var(--border)] p-2 text-[13px]"
            placeholder="Texto padrão do perfil"
            value={form.texto}
            onChange={(e) => setForm((f) => (f ? { ...f, texto: e.target.value } : f))}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setForm(null)}>
              <X size={14} className="mr-1.5" /> Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={upsert.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-20" />
      ) : (data ?? []).length === 0 ? (
        <div className="text-[13px] text-muted-foreground italic">Nenhum perfil cadastrado.</div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {(data ?? []).map((p) => (
            <li key={p.id} className="flex items-start justify-between py-2 text-[13px] gap-3">
              <div className="min-w-0">
                <span className="font-medium text-[var(--navy)]">{p.nome}</span>
                <p className="text-muted-foreground line-clamp-2">{p.texto ?? "—"}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setForm({ id: p.id, nome: p.nome ?? "", texto: p.texto ?? "" })}
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Excluir o perfil "${p.nome}"?`)) del.mutate(p.id);
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Referencias() {
  return (
    <div className="page-container">
      <Breadcrumb
        items={[{ label: "Configurações", to: "/configuracoes" }, { label: "Referências" }]}
      />
      <PageHeader
        eyebrow="Autofill"
        title="Referências"
        subtitle="Municípios e perfis usados para preencher os documentos automaticamente."
      />
      <div className="grid gap-5">
        <MunicipiosSection />
        <PerfisSection />
      </div>
    </div>
  );
}
