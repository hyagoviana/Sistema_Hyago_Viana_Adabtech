import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type ImportError = { row: number; field?: string; message: string };

type Props = {
  imported: number;
  skipped: number;
  errors: ImportError[];
  status: "completed" | "partial" | "failed";
};

export function ValidationResults({ imported, skipped, errors, status }: Props) {
  const icon =
    status === "completed" ? (
      <CheckCircle2 size={20} className="text-green-600" />
    ) : status === "partial" ? (
      <AlertTriangle size={20} className="text-amber-500" />
    ) : (
      <XCircle size={20} className="text-red-500" />
    );

  const statusLabel =
    status === "completed"
      ? "Importacao concluida"
      : status === "partial"
        ? "Importacao parcial"
        : "Importacao falhou";

  const conflitos = errors.filter((e) => e.message.startsWith("Conflito:"));
  const realErrors = errors.filter((e) => !e.message.startsWith("Conflito:"));

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
        {icon}
        <div className="flex-1">
          <div className="text-sm font-semibold text-[var(--navy)]">{statusLabel}</div>
        </div>
        <div className="flex gap-2">
          <Badge variant="default" className="bg-green-100 text-green-800">
            {imported} importados
          </Badge>
          {skipped > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              {skipped} pulados
            </Badge>
          )}
        </div>
      </div>

      {/* Conflitos (nao sao erros, so alertas) */}
      {conflitos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-sm font-medium text-amber-700">
              {conflitos.length} conflito(s) detectado(s)
            </span>
          </div>
          <ScrollArea className="max-h-[200px] rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="space-y-1">
              {conflitos.map((e, i) => (
                <div key={i} className="text-xs text-amber-800">
                  <span className="font-medium">Linha {e.row}</span>
                  {e.field && <span className="text-amber-600"> · {e.field}</span>}
                  <span> — {e.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Erros reais */}
      {realErrors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-red-500" />
            <span className="text-sm font-medium text-red-700">
              {realErrors.length} erro(s)
            </span>
          </div>
          <ScrollArea className="max-h-[200px] rounded-md border border-red-200 bg-red-50 p-3">
            <div className="space-y-1">
              {realErrors.map((e, i) => (
                <div key={i} className="text-xs text-red-800">
                  <span className="font-medium">Linha {e.row}</span>
                  {e.field && <span className="text-red-600"> · {e.field}</span>}
                  <span> — {e.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
