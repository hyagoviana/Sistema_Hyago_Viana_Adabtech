// R2 / AJUSTE #2 (2026-08-04) — VINCULAR CASO a um TEMA ou a um KANBAN.
//
// Passo 1: o usuário escolhe o ALVO do vínculo:
//   • TEMA   → reatribui a pipeline do caso para o service_type INTERNO (motor)
//              do tema de destino (fluxo R2 original: mover/duplicar entre temas).
//   • KANBAN → posiciona o caso em outro KANBAN (board custom) DENTRO do tema
//              atual do caso. NÃO altera tema_id/service_type_id — só a posição em
//              system_case_board_positions (via addCaseToBoard). O board principal
//              já contém todo caso; por isso o alvo é sempre um board custom.
//
// Em ambos os alvos o usuário escolhe MOVER ou DUPLICAR. No alvo KANBAN, como o
// board principal (operacional) sempre espelha todo caso, "mover" e "duplicar"
// posicionam o caso no board de destino sem desvinculá-lo do tema — a distinção é
// conceitual (o caso nunca sai do tema). O evento é registrado na timeline pelo
// próprio addCaseToBoard.
//
// Gate: casos.manage (o botão que abre este diálogo já é gate-ado na ficha).

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDuplicarCasoParaTema, useMoverCasoParaTema } from "@/hooks/useCases";
import { useAddCaseToBoard, useBoards } from "@/hooks/useBoards";
import { useTemas } from "@/hooks/useTemas";

type Tema = { id: string; name: string };
type Modo = "mover" | "duplicar";
type Alvo = "tema" | "kanban";

export function LinkCaseToTemaDialog({
  open,
  onOpenChange,
  caseId,
  caseCode,
  currentTemaId,
  serviceTypeId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  caseId: string;
  caseCode: string;
  currentTemaId?: string | null;
  // AJUSTE #2 — service_type interno (motor) do tema atual do caso; usado para
  // listar os kanbans (boards) do tema no alvo KANBAN.
  serviceTypeId?: string | null;
}) {
  const { data: temas, isLoading: temasLoading } = useTemas();
  const { data: boards } = useBoards(serviceTypeId ?? "");
  const [alvo, setAlvo] = useState<Alvo>("tema");
  const [temaId, setTemaId] = useState<string>("");
  // KANBAN — board de destino (só custom; o principal já contém todo caso).
  const [boardId, setBoardId] = useState<string>("");
  // A4 (2026-08-03) — igual ao envio ao financeiro: o usuário escolhe DUPLICAR
  // (fica nos dois) ou MOVER/transferir (sai da origem, entra no destino).
  const [modo, setModo] = useState<Modo>("mover");
  const mover = useMoverCasoParaTema();
  const duplicar = useDuplicarCasoParaTema();
  const addToBoard = useAddCaseToBoard();
  const pending = mover.isPending || duplicar.isPending || addToBoard.isPending;

  // Ao reabrir, reseta para o estado inicial (alvo tema, sem destino, modo mover).
  useEffect(() => {
    if (open) {
      setAlvo("tema");
      setTemaId("");
      setBoardId("");
      setModo("mover");
    }
  }, [open]);

  const temaList = (temas as Tema[] | undefined) ?? [];
  const nomeTema = (id?: string | null) => temaList.find((t) => t.id === id)?.name ?? "—";
  const origemNome = currentTemaId ? nomeTema(currentTemaId) : null;
  const destinoNome = temaId ? nomeTema(temaId) : null;

  // Só kanbans CUSTOM são alvo (o principal contém todo caso automaticamente).
  const customBoards = (boards ?? []).filter((b) => !b.is_principal);
  const boardDestinoNome = customBoards.find((b) => b.id === boardId)?.label ?? "—";

  async function confirmar() {
    if (alvo === "tema") {
      if (!temaId) return;
      try {
        if (modo === "duplicar") {
          await duplicar.mutateAsync({ id: caseId, temaId, frenteSlug: null });
          toast.success(`Caso duplicado no tema "${destinoNome}" — o original foi preservado`);
        } else {
          const res = await mover.mutateAsync({ id: caseId, temaId, frenteSlug: null });
          toast.success(
            res?.opResetado
              ? `Caso transferido para "${destinoNome}" — a etapa foi reiniciada para a 1ª da pipeline`
              : `Caso transferido para "${destinoNome}"`,
          );
        }
        onOpenChange(false);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : modo === "duplicar"
              ? "Falha ao duplicar caso"
              : "Falha ao transferir caso",
        );
      }
      return;
    }

    // Alvo KANBAN — posiciona o caso no board custom do tema atual (não troca de
    // tema). O caso permanece no board principal por design; "mover" e "duplicar"
    // apenas o inserem no board de destino.
    if (!boardId) return;
    try {
      await addToBoard.mutateAsync({ caseId, boardId });
      toast.success(
        modo === "duplicar"
          ? `Caso adicionado ao kanban "${boardDestinoNome}" (permanece no principal)`
          : `Caso movido para o kanban "${boardDestinoNome}" (segue no mesmo tema)`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao vincular ao kanban");
    }
  }

  const confirmDisabled = pending || (alvo === "tema" ? !temaId : !boardId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular {caseCode} ao tema ou kanban</DialogTitle>
          <DialogDescription>
            Escolha vincular a outro <strong>tema</strong> (troca a pipeline) ou a outro{" "}
            <strong>kanban</strong> deste mesmo tema (sem trocar de tema).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Passo 1 — alvo do vínculo: TEMA ou KANBAN. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAlvo("tema")}
              className={`rounded-md border px-3 py-2 text-left text-[12px] transition-colors ${
                alvo === "tema"
                  ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                  : "border-[var(--border)] hover:bg-[var(--ink-50)]"
              }`}
            >
              <div className="font-semibold">Tema</div>
              <div className="opacity-80">Vincula a outro tema (troca a pipeline).</div>
            </button>
            <button
              type="button"
              onClick={() => setAlvo("kanban")}
              disabled={!serviceTypeId}
              className={`rounded-md border px-3 py-2 text-left text-[12px] transition-colors disabled:opacity-40 ${
                alvo === "kanban"
                  ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                  : "border-[var(--border)] hover:bg-[var(--ink-50)]"
              }`}
            >
              <div className="font-semibold">Kanban</div>
              <div className="opacity-80">Outro kanban deste tema (não troca de tema).</div>
            </button>
          </div>

          {/* Destino: tema OU kanban, conforme o alvo. */}
          {alvo === "tema" ? (
            <div>
              <Label>Tema de destino</Label>
              <Select value={temaId} onValueChange={setTemaId}>
                <SelectTrigger>
                  <SelectValue placeholder={temasLoading ? "Carregando…" : "Selecione o tema"} />
                </SelectTrigger>
                <SelectContent>
                  {temaList
                    .filter((t) => t.id !== currentTemaId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>Kanban de destino</Label>
              {customBoards.length === 0 ? (
                <p className="text-[12px] text-muted-foreground pt-1">
                  Este tema ainda não tem outros kanbans. Crie um em "Criar novo kanban" na barra do
                  tema (Pipeline).
                </p>
              ) : (
                <Select value={boardId} onValueChange={setBoardId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o kanban" />
                  </SelectTrigger>
                  <SelectContent>
                    {customBoards.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Escolha do modo — espelha o popup do financeiro (duplicar × mover). */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModo("mover")}
              className={`rounded-md border px-3 py-2 text-left text-[12px] transition-colors ${
                modo === "mover"
                  ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                  : "border-[var(--border)] hover:bg-[var(--ink-50)]"
              }`}
            >
              <div className="font-semibold">Mover / Transferir</div>
              <div className="opacity-80">
                {alvo === "tema"
                  ? "Sai do tema atual e entra no destino."
                  : "Posiciona o caso no kanban de destino."}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setModo("duplicar")}
              className={`rounded-md border px-3 py-2 text-left text-[12px] transition-colors ${
                modo === "duplicar"
                  ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                  : "border-[var(--border)] hover:bg-[var(--ink-50)]"
              }`}
            >
              <div className="font-semibold">Duplicar</div>
              <div className="opacity-80">
                {alvo === "tema"
                  ? "Cria uma cópia no destino; mantém o original."
                  : "Mantém o caso no kanban principal também."}
              </div>
            </button>
          </div>

          {/* Confirmação explícita com os nomes do destino. */}
          {alvo === "tema" && temaId && (
            <Alert>
              <AlertDescription className="text-[12px]">
                {modo === "duplicar" ? (
                  <>
                    Você está <strong>duplicando</strong> o caso no tema{" "}
                    <strong>{destinoNome}</strong>
                    {origemNome ? (
                      <>
                        {" "}
                        (o original permanece em <strong>{origemNome}</strong>)
                      </>
                    ) : null}
                    . A cópia entra na 1ª etapa do funil do destino.
                  </>
                ) : (
                  <>
                    Você está <strong>transferindo</strong> o caso
                    {origemNome ? (
                      <>
                        {" "}
                        do tema <strong>{origemNome}</strong>
                      </>
                    ) : null}{" "}
                    para o tema <strong>{destinoNome}</strong>. Se a etapa atual não existir no
                    destino, ela será reiniciada para a primeira. O histórico é preservado.
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {alvo === "kanban" && boardId && (
            <Alert>
              <AlertDescription className="text-[12px]">
                O caso será posicionado no kanban <strong>{boardDestinoNome}</strong> deste mesmo
                tema. Ele <strong>continua vinculado ao tema</strong> — muda apenas de kanban, sem
                sair do principal.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={confirmDisabled}>
            {pending
              ? modo === "duplicar"
                ? "Duplicando…"
                : alvo === "tema"
                  ? "Transferindo…"
                  : "Movendo…"
              : alvo === "tema"
                ? modo === "duplicar"
                  ? "Duplicar no tema"
                  : "Mover para o tema"
                : modo === "duplicar"
                  ? "Duplicar no kanban"
                  : "Mover para o kanban"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
