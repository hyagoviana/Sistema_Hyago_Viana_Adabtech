import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, ExternalLink, FileSignature } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge, Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useComercialDocuments, useConfirmarAssinaturaDoc } from "@/hooks/useCases";

export const Route = createFileRoute("/comercial/assinaturas")({
  component: ComercialAssinaturas,
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function kindLabel(kind: string | null): string {
  if (kind === "procuracao") return "Procuração";
  if (kind === "contrato") return "Contrato";
  return "Documento";
}

function ComercialAssinaturas() {
  const { data, isLoading, isError, error } = useComercialDocuments();
  // Confirmar a assinatura por DOCUMENTO — mesmo efeito do webhook do ZapSign:
  // procuração assinada → GANHO comercial; contrato assinado → CLIENTE (operacional).
  const confirmar = useConfirmarAssinaturaDoc();

  const docs = useMemo(() => data ?? [], [data]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return docs;
    return docs.filter(
      (d) =>
        d.client_name.toLowerCase().includes(term) ||
        d.case_code.toLowerCase().includes(term) ||
        d.title.toLowerCase().includes(term),
    );
  }, [docs, query]);

  async function handleConfirmar(id: string, title: string, kind: string | null) {
    const efeito =
      kind === "contrato"
        ? "O caso vira CLIENTE (funil operacional)."
        : kind === "procuracao"
          ? "O caso avança no comercial (procuração assinada)."
          : "";
    if (!confirm(`Confirmar a assinatura de "${title}"? ${efeito}`)) return;
    try {
      await confirmar.mutateAsync(id);
      toast.success("Assinatura confirmada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao confirmar assinatura");
    }
  }

  const total = filtered.length;

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Comercial", to: "/comercial" }, { label: "Assinaturas" }]} />
      <PageHeader
        eyebrow="Comercial"
        title="Aguardando assinatura"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${docs.length} documento${docs.length === 1 ? "" : "s"} enviado${docs.length === 1 ? "" : "s"} ao ZapSign aguardando assinatura`
        }
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && docs.length > 0 && (
        <div className="mb-4 max-w-sm">
          <Input
            placeholder="Filtrar por cliente, caso ou documento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="card-editorial !p-10 text-center text-muted-foreground">
          Nenhum documento aguardando assinatura. Documentos aparecem aqui somente depois de
          enviados ao ZapSign, e saem quando a assinatura é confirmada.
        </div>
      ) : total === 0 ? (
        <div className="card-editorial !p-10 text-center text-muted-foreground">
          Nenhum documento corresponde ao filtro “{query}”.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((d) => (
            <div key={d.id} className="card-editorial !p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--gold-pale)] flex items-center justify-center text-[var(--gold-700)] shrink-0">
                <FileSignature size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-semibold text-[var(--navy)] truncate">
                    {d.title}
                  </span>
                  <Badge tone="gold">{kindLabel(d.doc_kind)}</Badge>
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  {d.client_name} · {d.case_code} · enviado em {formatDate(d.created_at)}
                </div>
              </div>
              {d.zapsign_sign_url && (
                <a
                  href={d.zapsign_sign_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-[var(--gold-700)] hover:underline"
                >
                  <ExternalLink size={13} /> Link ZapSign
                </a>
              )}
              <Btn
                variant="outline"
                onClick={() => handleConfirmar(d.id, d.title, d.doc_kind)}
                disabled={confirmar.isPending}
              >
                <CheckCircle2 size={14} />
                Confirmar assinatura
              </Btn>
              {d.case_id && (
                <Link
                  to="/casos/$id"
                  params={{ id: d.case_id }}
                  className="text-[var(--gold)] hover:text-[var(--gold-700)]"
                >
                  <ChevronRight size={18} />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
