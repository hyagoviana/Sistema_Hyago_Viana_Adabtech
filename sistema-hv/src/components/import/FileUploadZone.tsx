import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";

export type ParsedFile = {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: Record<string, string>[];
};

type Props = {
  onFileParsed: (result: ParsedFile) => void;
};

export function FileUploadZone({ onFileParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback(
    async (file: File) => {
      setError(null);
      setFileName(file.name);

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["csv", "xlsx", "xls", "ods"].includes(ext)) {
        setError("Formato nao suportado. Use CSV, XLSX, XLS ou ODS.");
        setFileName(null);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Arquivo muito grande (max 10 MB).");
        setFileName(null);
        return;
      }

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", codepage: 65001 });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });

        if (jsonData.length === 0) {
          setError("A planilha esta vazia.");
          setFileName(null);
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const rows = jsonData.map((row) => {
          const clean: Record<string, string> = {};
          for (const h of headers) {
            clean[h] = String(row[h] ?? "");
          }
          return clean;
        });

        onFileParsed({ fileName: file.name, fileSize: file.size, headers, rows });
      } catch {
        setError("Erro ao ler o arquivo. Verifique se e uma planilha valida.");
        setFileName(null);
      }
    },
    [onFileParsed],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  return (
    <div className="space-y-3">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-[var(--gold)] bg-[var(--gold)]/5"
            : "border-muted-foreground/25 hover:border-[var(--gold)]/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.ods"
          className="hidden"
          onChange={handleChange}
        />

        {fileName ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet size={24} className="text-green-600" />
            <span className="text-sm font-medium text-[var(--navy)]">{fileName}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setFileName(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload size={32} className="mx-auto text-muted-foreground/50" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-[var(--gold-700)]">Clique para selecionar</span> ou
              arraste sua planilha aqui
            </div>
            <div className="text-xs text-muted-foreground/70">CSV, XLSX, XLS ou ODS (max 10 MB)</div>
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
