import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileSpreadsheet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useImportRuns, type ImportRunRow } from "@/hooks/useImport";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  completed: { label: "Concluido", className: "bg-green-100 text-green-800" },
  partial: { label: "Parcial", className: "bg-amber-100 text-amber-800" },
  failed: { label: "Falhou", className: "bg-red-100 text-red-800" },
};

const TARGET_LABELS: Record<string, string> = {
  client: "Clientes",
  case: "Casos",
  "client+case": "Clientes + Casos",
};

export function ImportHistoryTable() {
  const { data: runs, isLoading } = useImportRuns();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <FileSpreadsheet size={32} className="mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nenhuma importacao realizada ainda.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Data</TableHead>
          <TableHead className="text-xs">Arquivo</TableHead>
          <TableHead className="text-xs">Tipo</TableHead>
          <TableHead className="text-xs text-center">Importados</TableHead>
          <TableHead className="text-xs text-center">Pulados</TableHead>
          <TableHead className="text-xs text-center">Erros</TableHead>
          <TableHead className="text-xs text-center">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run: ImportRunRow) => {
          const badge = STATUS_BADGE[run.status] ?? STATUS_BADGE.failed;
          return (
            <TableRow key={run.id}>
              <TableCell className="text-xs">
                {format(new Date(run.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell className="text-xs font-medium max-w-[200px] truncate">
                {run.file_name}
              </TableCell>
              <TableCell className="text-xs">{TARGET_LABELS[run.target_entity] ?? run.target_entity}</TableCell>
              <TableCell className="text-xs text-center text-green-700">{run.imported_rows}</TableCell>
              <TableCell className="text-xs text-center text-amber-700">{run.skipped_rows}</TableCell>
              <TableCell className="text-xs text-center text-red-700">{run.error_rows}</TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className={`text-xs ${badge.className}`}>
                  {badge.label}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
