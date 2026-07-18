// R2 — VINCULAR CASO EXISTENTE a um TEMA. Reatribui a pipeline do caso para o
// service_type INTERNO (motor) do tema (Opção 1, design R2-03) e grava
// tema_id/frente_slug. A etapa operacional pode ser RESETADA para a 1ª etapa se a
// etapa atual não existir na pipeline do tema — avisamos o usuário disso.
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
import { useMoverCasoParaTema } from "@/hooks/useCases";
import { useFrentes, useTemas } from "@/hooks/useTemas";

type Tema = { id: string; name: string };
type Frente = { slug: string; label: string };

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
  const [temaId, setTemaId] = useState<string>(currentTemaId ?? "");
  const [frenteSlug, setFrenteSlug] = useState<string>(""); // "" = sem frente
  const { data: frentes } = useFrentes(temaId || null);
  const mover = useMoverCasoParaTema();

  // Ao reabrir, sincroniza com o tema atual do caso e limpa a frente.
  useEffect(() => {
    if (open) {
      setTemaId(currentTemaId ?? "");
      setFrenteSlug("");
    }
  }, [open, currentTemaId]);

  // Trocar de tema invalida a frente selecionada (frentes são por tema).
  function onTemaChange(v: string) {
    setTemaId(v);
    setFrenteSlug("");
  }

  async function confirmar() {
    if (!temaId) return;
    try {
      const res = await mover.mutateAsync({
        id: caseId,
        temaId,
        frenteSlug: frenteSlug || null,
      });
      if (res?.opResetado) {
        toast.success("Caso vinculado ao tema — a etapa foi reiniciada para a 1ª da pipeline");
      } else {
        toast.success("Caso vinculado ao tema");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao vincular caso ao tema");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular {caseCode} a um tema</DialogTitle>
          <DialogDescription>
            O caso passa a rodar na pipeline do tema escolhido. Se a etapa atual não existir na
            pipeline do tema, ela será reiniciada para a primeira etapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tema</Label>
            <Select value={temaId} onValueChange={onTemaChange}>
              <SelectTrigger>
                <SelectValue placeholder={temasLoading ? "Carregando…" : "Selecione o tema"} />
              </SelectTrigger>
              <SelectContent>
                {(temas as Tema[] | undefined)?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {temaId && (frentes as Frente[] | undefined)?.length ? (
            <div>
              <Label>Frente (opcional)</Label>
              <Select
                value={frenteSlug || "__none__"}
                onValueChange={(v) => setFrenteSlug(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem frente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem frente</SelectItem>
                  {(frentes as Frente[]).map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Alert>
            <AlertDescription className="text-[12px]">
              A etapa do caso pode ser reiniciada se a pipeline do tema não tiver uma etapa
              equivalente. O histórico (rastro operacional/financeiro) é preservado.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mover.isPending}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={mover.isPending || !temaId}>
            {mover.isPending ? "Vinculando…" : "Vincular ao tema"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
