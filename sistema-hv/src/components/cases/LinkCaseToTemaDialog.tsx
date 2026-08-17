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
import {
  useAddCaseToBoard,
  useBoards,
  useBoardStages,
  useCaseBoards,
  useMoveCaseBetweenBoards,
} from "@/hooks/useBoards";
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
  // AJUSTE #2 (item 5) — boards CUSTOM em que o caso já está (p/ excluir do destino).
  const { data: caseBoardIds } = useCaseBoards(caseId);
  const [alvo, setAlvo] = useState<Alvo>("tema");
  const [temaId, setTemaId] = useState<string>("");
  // KANBAN — board de destino (todos do tema: principal + custom).
  const [boardId, setBoardId] = useState<string>("");
  // Item 3 — etapa/funil escolhida do kanban de destino (só p/ board custom).
  const [stageId, setStageId] = useState<string>("");
  // A4 (2026-08-03) — igual ao envio ao financeiro: o usuário escolhe DUPLICAR
  // (fica nos dois) ou MOVER/transferir (sai da origem, entra no destino).
  const [modo, setModo] = useState<Modo>("mover");
  const mover = useMoverCasoParaTema();
  const duplicar = useDuplicarCasoParaTema();
  const addToBoard = useAddCaseToBoard();
  const moveBetweenBoards = useMoveCaseBetweenBoards();
  const pending =
    mover.isPending || duplicar.isPending || addToBoard.isPending || moveBetweenBoards.isPending;

  // Ao reabrir, reseta para o estado inicial (alvo tema, sem destino, modo mover).
  useEffect(() => {
    if (open) {
      setAlvo("tema");
      setTemaId("");
      setBoardId("");
      setStageId("");
      setModo("mover");
    }
  }, [open]);

  // Ao trocar o kanban de destino, zera a etapa (as etapas são por board).
  useEffect(() => {
    setStageId("");
  }, [boardId]);

  const temaList = (temas as Tema[] | undefined) ?? [];
  const nomeTema = (id?: string | null) => temaList.find((t) => t.id === id)?.name ?? "·";
  const origemNome = currentTemaId ? nomeTema(currentTemaId) : null;
  const destinoNome = temaId ? nomeTema(temaId) : null;

  // AJUSTE #2 (item 5) + A4 — DESTINO = TODOS os kanbans do tema (principal + custom).
  // O caso está no principal quando NÃO foi movido exclusivamente; e nos custom
  // onde foi adicionado. O PRINCIPAL NÃO bloqueia "voltar" (item 4): selecioná-lo é
  // exatamente o "voltar ao principal". "já está nesse kanban" só vale para um
  // board CUSTOM em que o caso já está (posição ativa).
  const targetBoards = boards ?? [];
  const boardsById = new Map((boards ?? []).map((b) => [b.id, b]));
  const destBoard = boardId ? boardsById.get(boardId) : null;
  const destIsPrincipal = !!destBoard?.is_principal;
  const boardJaContem = !!boardId && !destIsPrincipal && (caseBoardIds ?? []).includes(boardId);
  const boardDestinoNome = destBoard?.label ?? "·";

  // Item 3 — etapas do kanban de destino (só custom têm etapas próprias; o
  // principal espelha o operacional e não usa positions).
  const { data: destStages, isLoading: destStagesLoading } = useBoardStages(
    destBoard && !destIsPrincipal ? boardId : null,
  );
  const destSemEtapas =
    !!destBoard && !destIsPrincipal && !destStagesLoading && (destStages ?? []).length === 0;

  async function confirmar() {
    if (alvo === "tema") {
      if (!temaId) return;
      try {
        if (modo === "duplicar") {
          await duplicar.mutateAsync({ id: caseId, temaId, frenteSlug: null });
          toast.success(`Caso duplicado no tema "${destinoNome}" · o original foi preservado`);
        } else {
          const res = await mover.mutateAsync({ id: caseId, temaId, frenteSlug: null });
          toast.success(
            res?.opResetado
              ? `Caso transferido para "${destinoNome}" · a etapa foi reiniciada para a 1ª da pipeline`
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

    // Alvo KANBAN — posiciona o caso num kanban do tema atual (NÃO troca de tema).
    //   • Destino = PRINCIPAL → "voltar ao principal": remove posições custom.
    //   • Destino custom → sempre ADITIVO (#5: o caso nunca sai do principal).
    if (!boardId) return;

    // Voltar ao principal (mover para o board principal). Duplicar-no-principal
    // não faz sentido → tratamos qualquer modo como "voltar".
    if (destIsPrincipal) {
      try {
        await moveBetweenBoards.mutateAsync({ caseId, toBoardId: boardId });
        toast.success(`Caso devolvido ao kanban principal "${boardDestinoNome}"`);
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao voltar ao principal");
      }
      return;
    }

    // Destino custom: trava se já contém (mesmo board) ou se não tem etapa.
    if (boardJaContem || destSemEtapas || !stageId) return;
    try {
      // #5 (2026-08-17) — o caso NUNCA sai do board PRINCIPAL: adicionar a um
      // kanban custom é sempre ADITIVO (a antiga opção "mover exclusivo", que
      // retirava do principal, foi removida).
      await addToBoard.mutateAsync({ caseId, boardId, exclusive: false, stageId });
      toast.success(`Caso adicionado ao kanban "${boardDestinoNome}" (continua no principal)`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao vincular ao kanban");
    }
  }

  const confirmDisabled =
    pending ||
    (alvo === "tema"
      ? !temaId
      : !boardId ||
        boardJaContem ||
        // custom sem etapa escolhida, ou o kanban não tem etapas: trava (item 3).
        (!destIsPrincipal && (destSemEtapas || !stageId)));

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
            <div className="space-y-2">
              <div>
                <Label>Kanban de destino</Label>
                {targetBoards.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground pt-1">
                    Nenhum kanban disponível neste tema.
                  </p>
                ) : (
                  <Select value={boardId} onValueChange={setBoardId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o kanban" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetBoards.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                          {b.is_principal ? " (principal · voltar)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Item 3 — etapa/funil do kanban de destino (só para board CUSTOM). */}
              {destBoard && !destIsPrincipal && (
                <div>
                  <Label>Etapa (funil) de destino</Label>
                  {destStagesLoading ? (
                    <p className="text-[12px] text-muted-foreground pt-1">Carregando etapas…</p>
                  ) : destSemEtapas ? (
                    <Alert className="mt-1">
                      <AlertDescription className="text-[12px]">
                        Crie uma etapa no kanban escolhido antes de mover/duplicar o caso.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Select value={stageId} onValueChange={setStageId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {(destStages ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {boardJaContem && (
                <Alert>
                  <AlertDescription className="text-[12px]">
                    Esse caso já está nesse kanban.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Escolha do modo (duplicar × mover) — SÓ no alvo TEMA. No alvo KANBAN
              o caso nunca sai do principal (#5): adicionar a um kanban custom é
              sempre aditivo, e o principal é só "voltar". */}
          {alvo === "tema" && (
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
                <div className="opacity-80">Sai do tema atual e entra no destino.</div>
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
                <div className="opacity-80">Cria uma cópia no destino; mantém o original.</div>
              </button>
            </div>
          )}

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

          {alvo === "kanban" && boardId && !boardJaContem && (
            <Alert>
              <AlertDescription className="text-[12px]">
                {destIsPrincipal ? (
                  <>
                    O caso <strong>volta ao kanban principal</strong> ({boardDestinoNome}) e sai de
                    todos os kanbans extras. Ele continua vinculado ao mesmo tema.
                  </>
                ) : (
                  <>
                    O caso é <strong>adicionado</strong> ao kanban{" "}
                    <strong>{boardDestinoNome}</strong> · continua também no kanban principal (um
                    caso nunca sai do principal).
                  </>
                )}
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
              ? alvo === "tema" && modo === "duplicar"
                ? "Duplicando…"
                : alvo === "tema"
                  ? "Transferindo…"
                  : "Salvando…"
              : alvo === "tema"
                ? modo === "duplicar"
                  ? "Duplicar no tema"
                  : "Mover para o tema"
                : destIsPrincipal
                  ? "Voltar ao principal"
                  : "Adicionar ao kanban"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
