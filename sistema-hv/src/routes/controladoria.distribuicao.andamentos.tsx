// TELA 1 do motor (doc "21.08 _ Controladoria") — ANDAMENTOS PENDENTES.
//
// "Nessa página, o sistema apenas faz a listagem, a partir dos registros do
//  ProJuris (para a data de referência), das intimações e andamentos."
//
// O sistema NÃO decide nada aqui. Por linha, uma pessoa escolhe:
//   • Arquivar intimação   • Marcar lido (movimentação)   • Distribuir tarefa
// Ao escolher "Distribuir tarefa", ela também escolhe QUAL tipo — e a linha
// passa para a Tela 2 (Tarefas a distribuir) com as variáveis pré-preenchidas.

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Archive, CheckCheck, Download, Send } from "lucide-react";
import { toast } from "sonner";

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
import { useMovements, useSyncMovements, useDecideMovement } from "@/hooks/useDistribuicaoStaging";
import { usePodeEditar } from "@/hooks/usePermissions";
import { TaskTypePicker } from "@/components/hv/TaskTypePicker";

export const Route = createFileRoute("/controladoria/distribuicao/andamentos")({
  component: AndamentosPendentesPage,
});

// MO1 (reunião 2026-08-26) — INTIMAÇÃO × ANDAMENTO.
//
// Thiago: "quando é intimação, o juiz já abriu o nosso prazo, e aí a gente não
// faz, morreu. O que é andamento é só monitoramento." Por isso a tela abre
// mostrando SÓ as intimações — e o sync continua trazendo as duas coisas.
//
// A terceira origem (INICIAL_SHV) não vem do ProJuris: é a inicial mandada da
// ficha Judicial do caso. Ela NUNCA é escondida pelo filtro — some da fila
// significaria perder trabalho que o próprio escritório mandou distribuir.
const ORIGEM_META: Record<string, { label: string; cls: string; title: string }> = {
  INTIMACAO: {
    label: "Intimação",
    cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    title: "Intimação: o prazo já foi aberto pelo juiz",
  },
  ANDAMENTO: {
    label: "Andamento",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
    title: "Movimentação do processo (monitoramento)",
  },
  INICIAL_SHV: {
    label: "Inicial (SHV)",
    cls: "bg-[var(--muted)] text-[var(--navy)] border-[var(--border)]",
    title: "Inicial mandada da ficha Judicial do caso — sempre visível",
  },
};

// O banco guarda o estado em maiúsculas; a tela fala português.
const DECISAO_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  ARQUIVADO: "Arquivado",
  LIDO: "Marcado lido",
  DISTRIBUIR: "Distribuiu tarefa",
  // S1-03 — status próprio, diferente de "Arquivado": esta não foi lida uma a
  // uma, foi junto com outra intimação do MESMO processo no mesmo dia.
  ARQUIVADO_REPETICAO: "Arquivado por repetição",
};
const SITUACAO_PROJURIS_LABEL: Record<string, string> = {
  ARQUIVADA: "Arquivada no ProJuris",
  ATIVA: "Ativa no ProJuris",
  PENDENTE: "Pendente no ProJuris",
  PROCESSADA: "Processada no ProJuris",
};

function AndamentosPendentesPage() {
  const podeEditar = usePodeEditar("controladoria");
  const [filtro, setFiltro] = useState<"PENDENTE" | "ARQUIVADO" | "LIDO" | "DISTRIBUIR" | "TODAS">(
    "PENDENTE",
  );
  const [data, setData] = useState<string>("");
  // O Thiago explicou (24/08) que as intimações nascem PENDENTES: as que
  // aparecem arquivadas são as que a controladoria já tratou na varredura manual
  // do início do dia. Como o cron agora monta a fila às 06h BRT — antes dessa
  // varredura — o padrão passa a ser ESCONDER as arquivadas: o que sobra é
  // exatamente o trabalho ainda não visto. O toggle continua, para conferência.
  const [ocultarArquivadas, setOcultarArquivadas] = useState(true);
  // MO1 — abre em "Intimações" (o que de fato tem prazo correndo).
  const [visao, setVisao] = useState<"INTIMACAO" | "ANDAMENTO" | "TODAS">("INTIMACAO");

  const {
    data: movs,
    isLoading,
    isError,
    error,
  } = useMovements(filtro, data || null, ocultarArquivadas);
  const sync = useSyncMovements();

  // Filtro de VISUALIZAÇÃO (o sync segue trazendo intimação e andamento).
  // INICIAL_SHV passa sempre — ver a nota em ORIGEM_META.
  const listaVisivel = (movs ?? []).filter(
    (m) => visao === "TODAS" || m.origem === visao || m.origem === "INICIAL_SHV",
  );

  async function handleSync() {
    try {
      const r = await sync.mutateAsync({ data: data || null });
      toast.success(
        `${r.lidos} lido(s) no ProJuris · ${r.novos} novo(s) na fila · ${r.ignoradas} descartada(s)/duplicada(s)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao buscar no ProJuris");
    }
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Registro</Label>
          <Select value={visao} onValueChange={(v) => setVisao(v as typeof visao)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INTIMACAO">Intimações</SelectItem>
              <SelectItem value="ANDAMENTO">Andamentos</SelectItem>
              <SelectItem value="TODAS">Intimações e andamentos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Situação</Label>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDENTE">Pendentes de análise</SelectItem>
              <SelectItem value="DISTRIBUIR">Mandados distribuir</SelectItem>
              <SelectItem value="ARQUIVADO">Arquivados</SelectItem>
              <SelectItem value="LIDO">Marcados como lidos</SelectItem>
              <SelectItem value="TODAS">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Data de referência</Label>
          <Input
            type="date"
            className="w-[170px]"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>
        <Button
          variant={ocultarArquivadas ? "default" : "outline"}
          onClick={() => setOcultarArquivadas((v) => !v)}
          title="No ProJuris do escritório quase tudo já está arquivado — esconder pode zerar a lista"
        >
          {ocultarArquivadas ? "Escondendo arquivadas" : "Mostrando arquivadas"}
        </Button>
        {podeEditar && (
          <Button variant="outline" onClick={handleSync} disabled={sync.isPending}>
            <Download size={14} className="mr-1" />
            {sync.isPending ? "Buscando…" : "Buscar no ProJuris"}
          </Button>
        )}
      </div>

      <p className="text-[12px] text-muted-foreground max-w-3xl">
        Esta lista é o que o ProJuris registrou (intimações e movimentações) e o que foi mandado da
        ficha Judicial dos casos. Nada é distribuído automaticamente: a análise é sua. O que você
        marcar como <strong>distribuir</strong> segue para a aba "A distribuir".
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        // Sem isto, uma falha de rede/permissão aparecia como "Nada aqui" — e a
        // pessoa concluía que não havia trabalho na fila.
        <div className="rounded-md border border-[var(--danger)] p-6 text-[13px]">
          Não foi possível carregar a fila.{" "}
          {error instanceof Error ? error.message : "Tente recarregar a página."}
        </div>
      ) : listaVisivel.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-[13px] text-muted-foreground">
          {(movs ?? []).length > 0 ? (
            <>
              Nenhum registro do tipo escolhido nesta data. Há {(movs ?? []).length} registro(s) em
              outra origem — troque o filtro <strong>Registro</strong> para ver.
            </>
          ) : (
            <>Nada aqui. Use "Buscar no ProJuris" para trazer as intimações do período.</>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {listaVisivel.map((m) => (
            <LinhaMovimento key={m.id} mov={m} podeEditar={podeEditar} />
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaMovimento({
  mov,
  podeEditar,
}: {
  mov: {
    id: string;
    origem: string;
    numero_cnj: string | null;
    descricao: string | null;
    cliente_nome: string | null;
    data_referencia: string | null;
    case_id: string | null;
    decisao: string;
    situacao_projuris: string | null;
    projuris_sync_at: string | null;
    projuris_sync_error: string | null;
    /** S1-03 — quantas do mesmo processo, no mesmo dia, esta linha representa. */
    repetidas?: number;
  };
  podeEditar: boolean;
}) {
  const decidir = useDecideMovement();
  const [tipoId, setTipoId] = useState<string>("");

  async function decide(decisao: "ARQUIVADO" | "LIDO" | "DISTRIBUIR") {
    if (decisao === "DISTRIBUIR" && !tipoId) return toast.error("Escolha o tipo de tarefa");
    try {
      const r = await decidir.mutateAsync({
        movementId: mov.id,
        decisao,
        taskTypeId: decisao === "DISTRIBUIR" ? tipoId : null,
      });
      const base =
        decisao === "DISTRIBUIR"
          ? "Tarefa enviada para a aba 'A distribuir'"
          : decisao === "ARQUIVADO"
            ? "Intimação arquivada"
            : "Marcado como lido";
      // Deixa claro se a ação chegou (ou não) ao ProJuris — nunca falha em silêncio.
      const eco = r?.projuris?.enviado
        ? " · refletido no ProJuris"
        : r?.projuris?.motivo?.includes("desligado")
          ? " · só no sistema (write-back desligado)"
          : r?.projuris?.motivo
            ? ` · NÃO refletido no ProJuris: ${r.projuris.motivo.slice(0, 80)}`
            : "";
      // S1-03 — diz quantas repetidas foram junto, para a pessoa não achar que
      // ficou trabalho pendente do mesmo processo.
      const repetidas = r?.repetidasArquivadas
        ? ` · ${r.repetidasArquivadas} repetida(s) do mesmo processo arquivada(s) junto`
        : "";
      toast.success(base + eco + repetidas);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar decisão");
    }
  }

  const origem = ORIGEM_META[mov.origem];

  return (
    <div className="card-editorial p-4 space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className="text-[14px] font-medium whitespace-pre-line">{mov.descricao ?? "—"}</div>
          <div className="text-[12px] text-muted-foreground">
            {mov.numero_cnj ?? "sem CNJ"}
            {mov.cliente_nome ? ` · ${mov.cliente_nome}` : ""}
            {mov.data_referencia ? ` · ${mov.data_referencia}` : ""}
          </div>
        </div>
        {/* MO1 — bate o olho e sabe: intimação (prazo correndo) ou andamento. */}
        {origem && (
          <Badge variant="outline" className={origem.cls} title={origem.title}>
            {origem.label}
          </Badge>
        )}
        {!mov.case_id && (
          <Badge variant="outline">
            {mov.cliente_nome ? "Cliente sem caso vinculado" : "Sem caso vinculado"}
          </Badge>
        )}
        {mov.situacao_projuris && (
          <Badge variant="outline" title="Situação no ProJuris">
            {SITUACAO_PROJURIS_LABEL[mov.situacao_projuris] ?? mov.situacao_projuris}
          </Badge>
        )}
        {mov.decisao !== "PENDENTE" && (
          <Badge variant="secondary">{DECISAO_LABEL[mov.decisao] ?? mov.decisao}</Badge>
        )}
        {/* S1-03 — Thiago: "dá até para trabalhar uma informação de que existem
            outras intimações ou algo assim". O selo evita a dúvida "será que já
            olhei esse processo?" que gerava o retrabalho. */}
        {(mov.repetidas ?? 1) > 1 && (
          <Badge
            variant="outline"
            className="border-[var(--gold)] text-[var(--gold-700)]"
            title="Outras intimações deste mesmo processo, no mesmo dia, estão em stand by. Elas serão arquivadas junto com a sua decisão."
          >
            {mov.repetidas} do mesmo processo hoje
          </Badge>
        )}
        {mov.projuris_sync_at && <Badge variant="secondary">no ProJuris</Badge>}
        {mov.projuris_sync_error && (
          <Badge variant="destructive" title={mov.projuris_sync_error}>
            falhou no ProJuris
          </Badge>
        )}
      </div>

      {podeEditar && mov.decisao === "PENDENTE" && (
        <div className="flex flex-wrap items-end gap-2">
          {/* T1 — mesmo seletor (classe → tipo) usado no caso e no workflow. */}
          <TaskTypePicker value={tipoId} onChange={(v) => setTipoId(v ?? "")} somenteMotor />

          <Button size="sm" onClick={() => decide("DISTRIBUIR")} disabled={decidir.isPending}>
            <Send size={13} className="mr-1" /> Distribuir tarefa
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => decide("ARQUIVADO")}
            disabled={decidir.isPending}
          >
            <Archive size={13} className="mr-1" /> Arquivar
          </Button>
          {/* MO1 — "marcar lido" só existe para ANDAMENTO. O Thiago conferiu no
              ProJuris ao vivo: intimação lá só arquiva/desarquiva; quem tem o
              status de lido é a movimentação. Mandar o verbo errado dá erro na API. */}
          {mov.origem === "ANDAMENTO" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => decide("LIDO")}
              disabled={decidir.isPending}
            >
              <CheckCheck size={13} className="mr-1" /> Marcar lido
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
