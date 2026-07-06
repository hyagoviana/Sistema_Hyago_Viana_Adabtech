import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, FileSignature } from "lucide-react";
import { toast } from "sonner";

import { Badge, Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useComercialCases, usePromoverCasoManual } from "@/hooks/useCases";

export const Route = createFileRoute("/comercial/assinaturas")({
  component: ComercialAssinaturas,
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ComercialAssinaturas() {
  const { data, isLoading, isError, error } = useComercialCases();
  // S9-12 — documento COMBINADO: confirmar a assinatura promove o caso a CLIENTE
  // (operacional), espelhando o efeito do webhook do contrato (S9-05). Fallback
  // manual quando o webhook não chega.
  const promover = usePromoverCasoManual();

  const cases = data ?? [];
  const total = cases.length;

  async function handleLiberar(id: string, code: string) {
    if (
      !confirm(
        `Confirmar que o contrato e procuração do caso ${code} foi assinado? O caso vira CLIENTE (funil operacional).`,
      )
    ) {
      return;
    }
    try {
      await promover.mutateAsync(id);
      toast.success(`Caso ${code} promovido a cliente (operacional)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao promover caso");
    }
  }

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Comercial", to: "/comercial" }, { label: "Assinaturas" }]} />
      <PageHeader
        eyebrow="Comercial"
        title="Aguardando assinatura"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} aguardando a assinatura do contrato e procuração`
        }
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="card-editorial !p-10 text-center text-muted-foreground">
          Nenhum caso aguardando assinatura. Casos com o contrato e procuração enviado ao ZapSign
          aparecem aqui até ser assinado (quando viram cliente).
        </div>
      ) : (
        <div className="grid gap-3">
          {cases.map((c) => {
            const caso = c as typeof c & {
              client_name?: string;
              aguardando_assinatura_at?: string | null;
            };
            return (
              <div key={c.id} className="card-editorial !p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--gold-pale)] flex items-center justify-center text-[var(--gold-700)] shrink-0">
                  <FileSignature size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-[var(--navy)]">
                      {c.case_code}
                    </span>
                    <Badge tone="gold">Aguardando assinatura</Badge>
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">
                    {caso.client_name ?? "Cliente"} · enviado em{" "}
                    {formatDate(caso.aguardando_assinatura_at ?? null)}
                  </div>
                </div>
                <Btn
                  variant="outline"
                  onClick={() => handleLiberar(c.id, c.case_code)}
                  disabled={promover.isPending}
                >
                  <CheckCircle2 size={14} />
                  Confirmar assinatura
                </Btn>
                <Link
                  to="/casos/$id"
                  params={{ id: c.id }}
                  className="text-[var(--gold)] hover:text-[var(--gold-700)]"
                >
                  <ChevronRight size={18} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
