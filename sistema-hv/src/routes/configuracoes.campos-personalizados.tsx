import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, IdCard, Layers, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { ClientFieldsManagerPanel } from "@/components/clients/ClientFieldsManagerDialog";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { TemaFieldDefsEditor } from "@/components/pipeline/TemaFieldDefsEditor";
import { CategoryFoldersEditor } from "@/components/pipeline/CategoryFoldersEditor";
import { TemaDistribuicaoPanel } from "@/components/pipeline/TemaDistribuicaoPanel";
import { useTemaServiceType } from "@/hooks/useTemas";
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

  // O que está aberto no painel à direita: um TEMA (pipeline) ou o CADASTRO DO
  // CLIENTE. Selecionar um minimiza o outro (abre ao lado, sem drawer).
  type View = { kind: "tema"; id: string } | { kind: "client" } | null;
  const [view, setView] = useState<View>(null);

  const temasList = temas ?? [];
  const selectedTema =
    view?.kind === "tema" ? (temasList.find((t) => t.id === view.id) ?? null) : null;
  const clientSelected = view?.kind === "client";

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
                    const active = view?.kind === "tema" && view.id === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setView({ kind: "tema", id: t.id })}
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
              <button
                type="button"
                onClick={() => setView({ kind: "client" })}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                  clientSelected
                    ? "bg-[var(--muted)] font-medium text-[var(--navy)]"
                    : "text-[var(--navy)] hover:bg-[var(--muted)]/60"
                }`}
              >
                <SlidersHorizontal
                  size={14}
                  className={clientSelected ? "text-[var(--gold-700)]" : "text-muted-foreground"}
                />
                <span className="flex-1 truncate">Editar campos do cliente</span>
                {clientSelected && <ChevronRight size={14} className="text-[var(--gold-700)]" />}
              </button>
            </section>
          </aside>

          {/* Coluna direita — editor do que estiver selecionado (tema ou cliente) */}
          <div className="min-w-0">
            {selectedTema ? (
              <section className="card-editorial !p-5">
                <div className="mb-4">
                  <div className="text-[15px] font-semibold text-[var(--navy)]">
                    {selectedTema.name}
                  </div>
                  <p className="text-[12.5px] text-muted-foreground">
                    Tudo que é configuração deste tema em um só lugar: campos da ficha, pastas de
                    modelos no Drive e os parâmetros do motor de distribuição.
                  </p>
                </div>
                {/* A key é obrigatória aqui: sem ele, o painel mantém o estado
                    digitado no tema anterior e "Salvar" gravaria esse valor no
                    tema recém-selecionado. */}
                <TemaConfigTabs key={selectedTema.id} tema={selectedTema} />
              </section>
            ) : clientSelected ? (
              <section className="card-editorial !p-5">
                <div className="mb-4">
                  <div className="text-[15px] font-semibold text-[var(--navy)]">
                    Cadastro do cliente
                  </div>
                  <p className="text-[12.5px] text-muted-foreground">
                    Veja como está o formulário de cadastro e acrescente campos próprios. Os campos
                    fixos não podem ser alterados; os que você cria podem ser editados, ocultados ou
                    excluídos.
                  </p>
                </div>
                <ClientFieldsManagerPanel />
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configuração do TEMA em um só lugar (doc 21.08). Cada aba é o painel que já
// existia — só deixaram de morar em telas diferentes.
// ---------------------------------------------------------------------------
type AbaTema = "campos" | "pastas" | "distribuicao";

const ABAS: Array<{ id: AbaTema; label: string; hint: string }> = [
  {
    id: "campos",
    label: "Campos",
    hint: "Aparecem na ficha do caso e nos filtros da lista/Kanban.",
  },
  {
    id: "pastas",
    label: "Pastas do Drive",
    hint: "Onde ficam os modelos de documento deste tema (casos e procurações).",
  },
  {
    id: "distribuicao",
    label: "Distribuição",
    hint: "Peso e responsável exclusivo do tema no motor de distribuição.",
  },
];

function TemaConfigTabs({ tema }: { tema: { id: string; name: string } }) {
  const [aba, setAba] = useState<AbaTema>("campos");
  // As pastas do Drive são vinculadas ao service_type por trás do tema.
  const { data: serviceType } = useTemaServiceType(aba === "pastas" ? tema.id : null);
  const atual = ABAS.find((a) => a.id === aba)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`px-3 py-2 text-[13px] border-b-2 -mb-px transition-colors ${
              aba === a.id
                ? "border-[var(--gold)] font-medium text-[var(--navy)]"
                : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-muted-foreground">{atual.hint}</p>

      {aba === "campos" && (
        <TemaFieldDefsEditor temaId={tema.id} frenteSlug={null} title="Campos personalizados" />
      )}

      {aba === "pastas" &&
        (serviceType?.id ? (
          <CategoryFoldersEditor serviceTypeId={serviceType.id} />
        ) : (
          <p className="text-[13px] text-muted-foreground">Carregando as pastas deste tema…</p>
        ))}

      {aba === "distribuicao" && (
        <TemaDistribuicaoPanel key={tema.id} temaId={tema.id} temaNome={tema.name} />
      )}
    </div>
  );
}
