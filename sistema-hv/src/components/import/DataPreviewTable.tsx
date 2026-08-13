import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  headers: string[];
  rows: Record<string, string>[];
  maxPreviewRows?: number;
};

export function DataPreviewTable({ headers, rows, maxPreviewRows = 5 }: Props) {
  const preview = rows.slice(0, maxPreviewRows);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--navy)]">Preview dos dados</span>
        <Badge variant="secondary" className="text-xs">
          {rows.length} linhas · {headers.length} colunas
        </Badge>
      </div>

      <ScrollArea className="w-full rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center text-xs">#</TableHead>
              {headers.map((h) => (
                <TableHead key={h} className="text-xs whitespace-nowrap min-w-[120px]">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {i + 1}
                </TableCell>
                {headers.map((h) => (
                  <TableCell key={h} className="text-xs max-w-[200px] truncate">
                    {row[h] || <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {rows.length > maxPreviewRows && (
        <p className="text-xs text-muted-foreground">
          Mostrando {maxPreviewRows} de {rows.length} linhas.
        </p>
      )}
    </div>
  );
}
