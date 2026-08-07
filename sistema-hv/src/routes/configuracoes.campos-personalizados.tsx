import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, IdCard, Layers, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { ClientFieldsManagerDialog } from "@/components/clients/ClientFieldsManagerDialog";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { TemaFieldDefsEditor } from "@/components/pipeline/TemaFieldDefsEditor";
import { Button } from "@/components/ui/button";
import { usePodeEditar } from "@/hooks/usePermissions";
import { useTemas } from "@/hooks/useTemas";
import { useAuth } from "@/lib/auth";

// I1 (2026-08-05) — Tela DEDICADA de "Campos personalizados" (tela cheia), em vez
// do quadradinho "Editar campos" do Kanban. NÃO muda a hierarquia (o campo continua
// abaixo da pipeline/tema); só melhora a navegação/organização.
//
// REUSA os componentes existentes sem reescrever:
//   • TemaFieldDefsEditor — campos por TEMA (pipeline), frenteSlug=null (painel padrão).
//   • ClientFieldsManagerDialog — campos do CADASTRO do cliente.
//
// Gate: B3 — só quem tem `sistema:edit` (usePodeEditar('sistema')); os writes já
// são ADMIN server-side (requireModule('sistema','edit')).
export const Route = createFileRoute("/configuracoes/campos-personalizados")({
  component: CamposPersonalizados,
});

function CamposPersonalizados() {
  const { loading } = useAuth();
  const podeGerir = usePodeEditar("sistema");
  const { data: temas, isLoading: temasLoading } = useTemas();

  // Tema (pipeline) selecionado para editar seus campos. Null = nenhum ainda.
  const [selectedTemaId, setSelectedTemaId] = useState<string | null>(null);
  // Dialog de campos do cadastro do cliente.
  const [clientFieldsOpen, setClientFieldsOpen] = useState(false);

  const temasList = temas ?? [];
  const selectedTema = temasList.find((t) => t.id === selectedTemaId) ?? null;

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Sistema", to: "/hoje" },
          { label: "Configurações", to: "/configuracoes" },
          { label: "Campos personalizados" },
        ]}
      />
      <PageHeader
        eyebrow="Sistema"
        title="Campos personalizados"
        subtitle="Crie e organize os campos de cada pipeline (tema) e do cadastro do cliente. O campo continua abaixo da sua pipeline · aqui você só edita tudo em um lugar."
      />

      {loading ? null : !podeGerir ? (
        <div className="card-editorial !p-6 text-center text-[13px] text-muted-foreground">
          A gestão de campos personalizados está restrita a administradores.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          {/* Coluna esquerda — pipelines/temas + cadastro do cliente */}
          <aside className="space-y-4">
            <section className="card-editorial !p-4">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers size={14} />
                Pipelines (temas)
              </div>
              {temasLoading ? (
                <p className="text-[13px] text-muted-foreground">Carregando pipelines…</p>
              ) : temasList.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Nenhum tema cadastrado ainda. Crie um tema na pipeline operacional.
                </p>
              ) : (
                <ul className="space-y-1">
                  {temasList.map((t) => {
                    const active = t.id === selectedTemaId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedTemaId(t.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                            active
                              ? "bg-[var(--muted)] font-medium text-[var(--navy)]"
                              : "text-[var(--navy)] hover:bg-[var(--muted)]/60"
                          }`}
                        >
                          <SlidersHorizontal
                            size={14}
                            className={active ? "text-[var(--gold-700)]" : "text-muted-foreground"}
                          />
                          <span className="flex-1 truncate">{t.name}</span>
                          {active && <ChevronRight size={14} className="text-[var(--gold-700)]" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Cadastro do cliente — reusa o gerenciador de campos do cliente. */}
            <section className="card-editorial !p-4">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <IdCard size={14} />
                Cadastro do cliente
              </div>
              <p className="mb-3 text-[12.5px] text-muted-foreground">
                Campos próprios do formulário de cadastro do cliente (podem aparecer nos casos).
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setClientFieldsOpen(true)}
              >
                <SlidersHorizontal size={14} />
                Editar campos do cliente
              </Button>
            </section>
          </aside>

          {/* Coluna direita — editor dos campos do tema selecionado */}
          <div className="min-w-0">
            {selectedTema ? (
              <section className="card-editorial !p-5">
                <div className="mb-4">
                  <div className="text-[15px] font-semibold text-[var(--navy)]">
                    {selectedTema.name}
                  </div>
                  <p className="text-[12.5px] text-muted-foreground">
                    Campos personalizados desta pipeline. Ficam na ficha do caso e no painel de
                    filtros da lista/Kanban (conforme configurado).
                  </p>
                </div>
                <TemaFieldDefsEditor
                  temaId={selectedTema.id}
                  frenteSlug={null}
                  title="Campos personalizados"
                />
              </section>
            ) : (
              <div className="card-editorial !p-8 text-center">
                <SlidersHorizontal size={28} className="mx-auto mb-3 text-muted-foreground/60" />
                <div className="text-[14px] font-medium text-[var(--navy)]">
                  Escolha uma pipeline
                </div>
                <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-muted-foreground">
                  Selecione um tema à esquerda para criar, editar, ocultar ou excluir os campos
                  daquela pipeline. Para os campos do cadastro do cliente, use “Editar campos do
                  cliente”.
                </p>
                <Link
                  to="/configuracoes"
                  className="mt-4 inline-block text-[12.5px] text-[var(--gold-700)] hover:text-[var(--gold)]"
                >
                  ← Voltar para Configurações
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <ClientFieldsManagerDialog open={clientFieldsOpen} onOpenChange={setClientFieldsOpen} />
    </div>
  );
}
