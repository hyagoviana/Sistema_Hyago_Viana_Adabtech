// TIPOS DE TAREFA — catálogo único do sistema (doc "21.08 _ Controladoria").
//
// O tipo de tarefa saiu de dentro do motor de distribuição e virou configuração
// do SISTEMA: o motor, os workflows, o dossiê do caso e o comercial passam a
// puxar daqui. Cada tipo carrega tudo que o resto do sistema precisa saber:
// classe, pontuação, prazos em dias, se entra no motor, se espelha no ProJuris,
// e o responsável exclusivo (geral + as exceções por tema).
//
// Gate: sistema (view p/ ver, edit p/ mexer) — herda dos RPCs.

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Breadcrumb, PageHeader, Eyebrow } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useTaskTypesCatalog,
  useCreateTaskType,
  useUpdateTaskType,
  useSetTaskTypeArchived,
  useSetThemeExclusive,
  useRemoveThemeExclusive,
  type TaskType,
} from "@/hooks/useTaskTypes";
import { useTemas } from "@/hooks/useTemas";
import { useAssignableUsers } from "@/hooks/useUsers";
import { usePodeEditar } from "@/hooks/usePermissions";
import { useSyncTaskTypes } from "@/hooks/useDistribuicao";
import { useCriarTipoNoProjuris } from "@/hooks/useTaskTypes";
import { TASK_TYPE_CLASSE_LABEL, TASK_TYPE_CLASSES } from "@/lib/task-types-service";

export const Route = createFileRoute("/configuracoes/tipos-tarefa")({
  component: TiposTarefaPage,
});

const NENHUM = "__nenhum__";
const TODAS = "__todas__";

function TiposTarefaPage() {
  const podeEditar = usePodeEditar("sistema");

  const [estado, setEstado] = useState<"ativos" | "arquivados" | "todos">("ativos");
  const [classe, setClasse] = useState<string>(TODAS);
  const [busca, setBusca] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const { data: tipos, isLoading } = useTaskTypesCatalog({
    estado,
    classe: classe === TODAS ? null : classe,
  });
  const { data: temas } = useTemas();
  const { data: users } = useAssignableUsers();

  const criar = useCreateTaskType();
  const arquivar = useSetTaskTypeArchived();
  const sincronizar = useSyncTaskTypes();
  const criarNoProjuris = useCriarTipoNoProjuris();

  const [novoNome, setNovoNome] = useState("");
  const [novaClasse, setNovaClasse] = useState<string>(NENHUM);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return tipos ?? [];
    return (tipos ?? []).filter((t) => t.nome.toLowerCase().includes(termo));
  }, [tipos, busca]);

  const nomePorUsuario = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users ?? []) m.set(u.id, u.full_name || u.email);
    return m;
  }, [users]);

  async function handleCriar() {
    const nome = novoNome.trim();
    if (!nome) return toast.error("Informe o nome do tipo de tarefa");
    try {
      await criar.mutateAsync({
        nome,
        classe: novaClasse === NENHUM ? null : novaClasse,
      });
      toast.success("Tipo de tarefa criado");
      setNovoNome("");
      setNovaClasse(NENHUM);
      setCriando(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar tipo");
    }
  }

  // Puxa do ProJuris o código, o nome, a CLASSIFICAÇÃO e os PRAZOS previsto/
  // fatal de cada tipo (endpoint POST /tarefa-tipo/consulta). Só leitura lá.
  async function handleSincronizar() {
    try {
      const r = await sincronizar.mutateAsync();
      const revisar = r.nearMiss.length + r.collisions.length;
      toast.success(
        `${r.matched.length} tipo(s) casado(s) · ${r.prazosAplicados} com prazo do ProJuris` +
          (revisar ? ` · ${revisar} para revisar` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar com o ProJuris");
    }
  }

  async function handleArquivar(t: TaskType) {
    try {
      await arquivar.mutateAsync({ id: t.id, archived: !t.archived_at });
      toast.success(t.archived_at ? "Tipo reativado" : "Tipo arquivado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao arquivar");
    }
  }

  return (
    <div className="page-container">
      <Breadcrumb
        items={[{ label: "Configurações", to: "/configuracoes" }, { label: "Tipos de tarefa" }]}
      />
      <PageHeader
        eyebrow="Cadastros gerais"
        title="Tipos de tarefa"
        subtitle="Catálogo único do sistema. O motor de distribuição, os workflows e as tarefas do caso puxam daqui."
        aside={
          podeEditar && !criando ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSincronizar}
                disabled={sincronizar.isPending}
                title="Traz nome, classificação e prazos previsto/fatal do ProJuris"
              >
                <RefreshCw
                  size={14}
                  className={`mr-1 ${sincronizar.isPending ? "animate-spin" : ""}`}
                />
                {sincronizar.isPending ? "Sincronizando…" : "Sincronizar do ProJuris"}
              </Button>
              <Button onClick={() => setCriando(true)}>
                <Plus size={14} className="mr-1" /> Novo tipo de tarefa
              </Button>
            </div>
          ) : undefined
        }
      />

      {criando && (
        <div className="card-hero p-6 mb-6 space-y-4">
          <Eyebrow>Novo tipo de tarefa</Eyebrow>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Contestação"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Classe</Label>
              <Select value={novaClasse} onValueChange={setNovaClasse}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Sem classe</SelectItem>
                  {TASK_TYPE_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {TASK_TYPE_CLASSE_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCriar} disabled={criar.isPending}>
              Criar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                // Cancelar precisa limpar: senão reabrir traz o texto antigo.
                setNovoNome("");
                setNovaClasse(NENHUM);
                setCriando(false);
              }}
            >
              Cancelar
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            O tipo nasce no SHV. O código do ProJuris é preenchido depois, pelo botão "Sincronizar
            tipos" da Controladoria (casamento por nome).
          </p>
        </div>
      )}

      {/* Filtros — doc 21.08: "ativos / arquivados / todos" + caixa de seleção por classe */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="arquivados">Arquivados</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Classe</Label>
          <Select value={classe} onValueChange={setClasse}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as classes</SelectItem>
              {TASK_TYPE_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {TASK_TYPE_CLASSE_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-7"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do tipo…"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-[13px] text-muted-foreground">
          Nenhum tipo de tarefa neste filtro.
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((t) =>
            editandoId === t.id ? (
              <EditorTipo
                key={t.id}
                tipo={t}
                temas={temas ?? []}
                users={users ?? []}
                onClose={() => setEditandoId(null)}
              />
            ) : (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] px-4 py-3"
              >
                <div className="min-w-[200px] flex-1">
                  <div className="text-[14px] font-medium">{t.nome}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {t.classe ? TASK_TYPE_CLASSE_LABEL[t.classe] : "Sem classe"}
                    {t.projuris_classificacao ? ` · ${t.projuris_classificacao}` : ""}
                  </div>
                </div>

                <div className="text-[12px] text-muted-foreground w-[110px]">
                  <span className="font-medium text-foreground">{t.points}</span> pts
                </div>

                <div className="text-[12px] text-muted-foreground w-[140px]">
                  Prev/Fatal:{" "}
                  <span className="font-medium text-foreground">
                    {t.prazo_previsto_dias ?? "·"}/{t.prazo_fatal_dias ?? "·"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {t.aparece_no_motor ? (
                    <Badge variant="secondary">Motor</Badge>
                  ) : (
                    <Badge variant="outline">Fora do motor</Badge>
                  )}
                  {t.sync_projuris &&
                    (/^d+$/.test(t.projuris_tipo_codigo) ? (
                      <Badge variant="outline">ProJuris</Badge>
                    ) : (
                      <Badge variant="outline" title="Existe só aqui — ainda não foi criado lá">
                        Só no SHV
                      </Badge>
                    ))}
                  {t.exclusive_executor_id && (
                    <Badge variant="outline">
                      Exclusivo: {nomePorUsuario.get(t.exclusive_executor_id) ?? "—"}
                    </Badge>
                  )}
                  {t.excecoes.length > 0 && (
                    <Badge variant="outline">{t.excecoes.length} exceção(ões)</Badge>
                  )}
                  {t.archived_at && <Badge variant="destructive">Arquivado</Badge>}
                </div>

                {podeEditar && (
                  <div className="flex gap-1 ml-auto">
                    {/* Só aparece para tipo que ainda não existe no ProJuris e que
                        está marcado para espelhar lá (A7 do doc 21.08). */}
                    {t.sync_projuris && !/^d+$/.test(t.projuris_tipo_codigo) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7"
                        disabled={criarNoProjuris.isPending}
                        title="Cria este tipo no ProJuris com os prazos daqui"
                        onClick={async () => {
                          try {
                            const r = await criarNoProjuris.mutateAsync({ id: t.id });
                            if (r.criado)
                              toast.success(
                                r.codigo
                                  ? `Criado no ProJuris (código ${r.codigo})`
                                  : (r.motivo ?? "Criado no ProJuris"),
                              );
                            else toast.error(r.motivo ?? "Não foi criado");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Falha ao criar");
                          }
                        }}
                      >
                        Criar no ProJuris
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setEditandoId(t.id)}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={arquivar.isPending}
                      onClick={() => handleArquivar(t)}
                    >
                      {t.archived_at ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    </Button>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor de um tipo — inclui o submenu de EXCEÇÕES por tema (doc 21.08):
// "pode ser que a exclusividade dessa tarefa não seja para todos os temas".
// ---------------------------------------------------------------------------
function EditorTipo({
  tipo,
  temas,
  users,
  onClose,
}: {
  tipo: TaskType;
  temas: Array<{ id: string; name: string }>;
  users: Array<{ id: string; full_name: string | null; email: string }>;
  onClose: () => void;
}) {
  const salvar = useUpdateTaskType();
  const setExc = useSetThemeExclusive();
  const rmExc = useRemoveThemeExclusive();

  const [nome, setNome] = useState(tipo.nome);
  const [classe, setClasse] = useState(tipo.classe ?? NENHUM);
  const [points, setPoints] = useState(String(tipo.points));
  const [prev, setPrev] = useState(tipo.prazo_previsto_dias?.toString() ?? "");
  const [fatal, setFatal] = useState(tipo.prazo_fatal_dias?.toString() ?? "");
  const [noMotor, setNoMotor] = useState(tipo.aparece_no_motor);
  const [noProjuris, setNoProjuris] = useState(tipo.sync_projuris);
  const [exclusivo, setExclusivo] = useState(tipo.exclusive_executor_id ?? NENHUM);

  const [excTema, setExcTema] = useState("");
  const [excUser, setExcUser] = useState("");

  const nomeUser = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? (u.full_name ?? u.email) : "—";
  };
  const nomeTema = (id: string) => temas.find((t) => t.id === id)?.name ?? "—";

  const num = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  async function handleSalvar() {
    try {
      await salvar.mutateAsync({
        id: tipo.id,
        patch: {
          nome: nome.trim(),
          classe: classe === NENHUM ? null : classe,
          // Teclado pt-BR oferece vírgula — sem o replace, "1,5" virava 0.
          points: Number(points.replace(",", ".")) || 0,
          prazo_previsto_dias: num(prev),
          prazo_fatal_dias: num(fatal),
          aparece_no_motor: noMotor,
          sync_projuris: noProjuris,
          exclusive_executor_id: exclusivo === NENHUM ? null : exclusivo,
        },
      });
      toast.success("Tipo de tarefa salvo");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  async function handleAddExcecao() {
    if (!excTema || !excUser) return toast.error("Escolha o tema e o responsável");
    try {
      await setExc.mutateAsync({ taskTypeId: tipo.id, temaId: excTema, executorId: excUser });
      toast.success("Exceção salva");
      setExcTema("");
      setExcUser("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar exceção");
    }
  }

  return (
    <div className="card-hero p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Eyebrow>Editar tipo de tarefa</Eyebrow>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Classe</Label>
          <Select value={classe} onValueChange={setClasse}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>Sem classe</SelectItem>
              {TASK_TYPE_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {TASK_TYPE_CLASSE_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pontuação</Label>
          <Input value={points} onChange={(e) => setPoints(e.target.value)} inputMode="decimal" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Prazo previsto (dias)</Label>
          <Input value={prev} onChange={(e) => setPrev(e.target.value)} inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Prazo fatal (dias)</Label>
          <Input value={fatal} onChange={(e) => setFatal(e.target.value)} inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Responsável exclusivo (geral)</Label>
          <Select value={exclusivo} onValueChange={setExclusivo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>Não</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name ?? u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={noMotor ? "default" : "outline"}
          size="sm"
          onClick={() => setNoMotor((v) => !v)}
        >
          {noMotor ? "Aparece no motor" : "Fora do motor"}
        </Button>
        <Button
          type="button"
          variant={noProjuris ? "default" : "outline"}
          size="sm"
          onClick={() => setNoProjuris((v) => !v)}
        >
          {noProjuris ? "Espelha no ProJuris" : "Só no SHV"}
        </Button>
      </div>

      {/* Exceções por tema — só fazem sentido quando há exclusivo geral definido,
          mas deixamos sempre visível: o Thiago citou casos em que a exclusividade
          existe SÓ para alguns temas. */}
      <div className="rounded-md border border-[var(--border)] p-4 space-y-3">
        <div className="text-[13px] font-medium">Exceções de responsável por tema</div>
        <p className="text-[12px] text-muted-foreground">
          Quando este tipo de tarefa, <em>neste tema</em>, é sempre de uma pessoa específica. Tem
          precedência sobre o responsável exclusivo geral.
        </p>

        {tipo.excecoes.length > 0 && (
          <div className="space-y-1">
            {tipo.excecoes.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 text-[13px] rounded border border-[var(--border)] px-3 py-2"
              >
                <span className="flex-1">
                  {nomeTema(e.tema_id)} → <strong>{nomeUser(e.executor_id)}</strong>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await rmExc.mutateAsync({ id: e.id });
                      toast.success("Exceção removida");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Falha ao remover");
                    }
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 min-w-[180px]">
            <Label className="text-xs">Tema</Label>
            <Select value={excTema} onValueChange={setExcTema}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o tema" />
              </SelectTrigger>
              <SelectContent>
                {temas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[180px]">
            <Label className="text-xs">Responsável</Label>
            <Select value={excUser} onValueChange={setExcUser}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a pessoa" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={setExc.isPending}
            onClick={handleAddExcecao}
          >
            <Plus size={13} className="mr-1" /> Adicionar exceção
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSalvar} disabled={salvar.isPending}>
          Salvar
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
