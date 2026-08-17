// #13 (2026-08-17) — Painel "Casos vinculados": liga o caso a outro(s) e mostra
// um espelho (cliente · tema · etapa · dias no estado); clicar abre o caso. O
// vínculo é manual (busca por código do caso ou nome do cliente).

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, X, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLinkedCases,
  useSearchCasesForLink,
  useAddCaseLink,
  useRemoveCaseLink,
} from "@/hooks/useCaseLinks";
import type { CaseSearchHit } from "@/rpc/case-links";

export function CaseLinkedCases({ caseId, canEdit }: { caseId: string; canEdit: boolean }) {
  const { data, isLoading } = useLinkedCases(caseId);
  const linked = data ?? [];
  const search = useSearchCasesForLink();
  const add = useAddCaseLink(caseId);
  const remove = useRemoveCaseLink(caseId);

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CaseSearchHit[]>([]);
  const [adding, setAdding] = useState(false);

  function onSearch(v: string) {
    setTerm(v);
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    search.mutate(
      { query: v, excludeCaseId: caseId },
      { onSuccess: (hits) => setResults(hits as CaseSearchHit[]) },
    );
  }

  async function handleAdd(hit: CaseSearchHit) {
    try {
      await add.mutateAsync(hit.caseId);
      setTerm("");
      setResults([]);
      setAdding(false);
      toast.success("Caso vinculado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao vincular");
    }
  }

  async function handleRemove(linkId: string) {
    try {
      await remove.mutateAsync(linkId);
      toast.success("Vínculo removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Eyebrow>Casos vinculados</Eyebrow>
        {canEdit && !adding && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--gold-700)] hover:underline"
            onClick={() => setAdding(true)}
          >
            <Plus size={14} /> Vincular caso
          </button>
        )}
      </div>

      {canEdit && adding && (
        <div className="mb-3">
          <Input
            autoFocus
            value={term}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar por código do caso ou nome do cliente…"
          />
          {term.trim().length >= 2 && (
            <div className="mt-1 rounded-md border border-[var(--border)] bg-white max-h-56 overflow-y-auto">
              {search.isPending ? (
                <div className="p-2 text-[12px] text-muted-foreground">Buscando…</div>
              ) : results.length === 0 ? (
                <div className="p-2 text-[12px] text-muted-foreground">Nenhum caso encontrado.</div>
              ) : (
                results.map((h) => (
                  <button
                    key={h.caseId}
                    type="button"
                    onClick={() => handleAdd(h)}
                    className="block w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--ink-50)] border-b border-[var(--border)] last:border-0"
                  >
                    <span className="font-medium text-[var(--navy)]">
                      {h.clientName ?? h.caseName ?? "Caso"}
                    </span>
                    <span className="text-muted-foreground"> · {h.caseCode ?? "—"}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <button
            type="button"
            className="mt-1 text-[11px] text-muted-foreground hover:underline"
            onClick={() => {
              setAdding(false);
              setTerm("");
              setResults([]);
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : linked.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1 flex items-center gap-1.5">
          <Link2 size={14} /> Nenhum caso vinculado.
        </p>
      ) : (
        <ul className="space-y-2">
          {linked.map((c) => (
            <li
              key={c.linkId}
              className="group rounded-[10px] border border-[var(--border)] bg-white p-3 hover:border-[var(--gold)] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <Link to="/casos/$id" params={{ id: c.caseId }} className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[var(--navy)] truncate">
                    {c.clientName ?? c.caseName ?? "Caso"}
                    <ExternalLink
                      size={12}
                      className="inline ml-1 text-muted-foreground align-baseline"
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.temaName ?? "·"} · {c.stageLabel ?? "·"}
                    {c.daysInState != null ? ` · há ${c.daysInState} dia(s)` : ""}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">{c.caseCode}</div>
                </Link>
                {canEdit && (
                  <button
                    type="button"
                    aria-label="Remover vínculo"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                    onClick={() => handleRemove(c.linkId)}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
