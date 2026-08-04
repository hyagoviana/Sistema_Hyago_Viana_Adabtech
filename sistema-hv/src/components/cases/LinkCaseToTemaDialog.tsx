// R2 — VINCULAR CASO EXISTENTE a um TEMA. Reatribui a pipeline do caso para o
// service_type INTERNO (motor) do tema (Opção 1, design R2-03) e grava tema_id.
// A etapa operacional pode ser RESETADA para a 1ª etapa se a etapa atual não
// existir na pipeline do tema — avisamos o usuário disso.
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
import { useTemas } from "@/hooks/useTemas";

type Tema = { id: string; name: string };
type Modo = "mover" | "duplicar";

export function LinkCaseToTemaDialog({
  open,
  onOpenChange,
  caseId,
  caseCode,
  currentTemaId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  caseId: string;
  caseCode: string;
  currentTemaId?: string | null;
}) {
  const { data: temas, isLoading: temasLoading } = useTemas();
  const [temaId, setTemaId] = useState<string>("");
  // A4 (2026-08-03) — igual ao envio ao financeiro: o usuário escolhe DUPLICAR
  // (fica nos dois temas) ou MOVER/transferir (sai da origem, entra no destino).
  const [modo, setModo] = useState<Modo>("mover");
  const mover = useMoverCasoParaTema();
  const duplicar = useDuplicarCasoParaTema();
  const pending = mover.isPending || duplicar.isPending;

  // Ao reabrir, começa sem destino escolhido (o destino tem que ser DIFERENTE da
  // origem) e no modo Mover.
  useEffect(() => {
    if (open) {
      setTemaId("");
      setModo("mover");
    }
  }, [open]);

  const temaList = (temas as Tema[] | undefined) ?? [];
  const nomeTema = (id?: string | null) => temaList.find((t) => t.id === id)?.name ?? "—";
  const origemNome = currentTemaId ? nomeTema(currentTemaId) : null;
  const destinoNome = temaId ? nomeTema(temaId) : null;

  async function confirmar() {
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
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular {caseCode} a um tema</DialogTitle>
          <DialogDescription>
            Escolha o tema de destino e se quer <strong>duplicar</strong> (fica nos dois temas) ou{" "}
            <strong>mover</strong> (transfere para o outro tema).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Confirmação explícita com os nomes dos temas. */}
          {temaId && (
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={pending || !temaId}>
            {pending
              ? modo === "duplicar"
                ? "Duplicando…"
                : "Transferindo…"
              : modo === "duplicar"
                ? "Duplicar no tema"
                : "Mover para o tema"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
