import { ArrowLeft, ArrowRight, Download, Loader2, Play, Save } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateImportTemplate, useExecuteImport, useImportTemplates, type ImportTemplateRow } from "@/hooks/useImport";
import { useTemaFieldDefs, type TemaFieldDef } from "@/hooks/useTemaFieldDefs";
import { useTemas } from "@/hooks/useTemas";
import { TARGET_FIELDS, type ColumnMapping, type TargetFieldDef } from "@/lib/validators/import";

import { ColumnMapper } from "./ColumnMapper";
import { DataPreviewTable } from "./DataPreviewTable";
import { DownloadTemplate } from "./DownloadTemplate";
import { FileUploadZone, type ParsedFile } from "./FileUploadZone";
import { ValidationResults } from "./ValidationResults";

const STEP_LABELS = ["Upload", "Mapear", "Importar"] as const;
type Step = 0 | 1 | 2;

// Campos de cliente vs caso (chaves fixas)
const CLIENT_FIELD_KEYS = new Set(
  TARGET_FIELDS.filter((f) => f.entity === "client").map((f) => f.key),
);
const CASE_FIELD_KEYS = new Set(
  TARGET_FIELDS.filter((f) => f.entity === "case").map((f) => f.key),
);

function detectTargetEntity(mappings: ColumnMapping[]): "client" | "case" | "client+case" {
  const active = mappings.filter((m) => m.targetField && m.targetField !== "");
  let hasClient = false;
  let hasCase = false;
  for (const m of active) {
    if (CLIENT_FIELD_KEYS.has(m.targetField) || m.targetField.startsWith("custom_client.") || m.targetField.startsWith("address.") || m.targetField.startsWith("professional_data.")) {
      hasClient = true;
    }
    if (CASE_FIELD_KEYS.has(m.targetField) || m.targetField.startsWith("custom_case.")) {
      hasCase = true;
    }
  }
  if (hasClient && hasCase) return "client+case";
  if (hasCase) return "case";
  return "client";
}

export function ImportStepper() {
  const [step, setStep] = useState<Step>(0);

  // Step 0 — upload
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);

  // Pipeline/tema
  const [selectedTemaId, setSelectedTemaId] = useState<string>("");

  // Step 1 — mapeamento
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  // Step 2 — resultado
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: Array<{ row: number; field?: string; message: string }>;
    status: "completed" | "partial" | "failed";
  } | null>(null);

  // Template
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Hooks
  const executeImport = useExecuteImport();
  const createTemplate = useCreateImportTemplate();
  const { data: templates } = useImportTemplates();
  const { data: temas } = useTemas();
  const { data: temaFieldDefs } = useTemaFieldDefs(selectedTemaId || null);

  // Converte campos do tema em TargetFieldDef para o ColumnMapper
  const extraFields: TargetFieldDef[] = useMemo(() => {
    if (!temaFieldDefs || !Array.isArray(temaFieldDefs)) return [];
    const temaName = (temas as { id: string; name: string }[] | undefined)
      ?.find((t) => t.id === selectedTemaId)?.name ?? "Pipeline";
    return (temaFieldDefs as TemaFieldDef[]).map((fd) => ({
      key: fd.scope === "cliente" ? `custom_client.${fd.key}` : `custom_case.${fd.key}`,
      label: fd.label,
      entity: fd.scope === "cliente" ? "client" as const : "case" as const,
      group: `${temaName} (${fd.scope === "cliente" ? "cliente" : "caso"})`,
      fieldType: fd.type,
    }));
  }, [temaFieldDefs, temas, selectedTemaId]);

  const selectedTemaName = useMemo(() => {
    if (!selectedTemaId || !temas) return undefined;
    return (temas as { id: string; name: string }[])?.find((t) => t.id === selectedTemaId)?.name;
  }, [selectedTemaId, temas]);

  // Detecta automaticamente o que importar baseado nas colunas mapeadas
  const detectedTarget = useMemo(() => detectTargetEntity(mappings), [mappings]);
  const detectedLabel = detectedTarget === "client+case"
    ? "Clientes + Casos"
    : detectedTarget === "case"
      ? "Casos"
      : "Clientes";

  const handleFileParsed = useCallback((file: ParsedFile) => {
    setParsedFile(file);
    setMappings([]);
    setResult(null);
  }, []);

  const handleSelectTemplate = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId);
      const tmpl = templates?.find((t: ImportTemplateRow) => t.id === templateId);
      if (tmpl) {
        setMappings(tmpl.column_mappings as ColumnMapping[]);
      }
    },
    [templates],
  );

  const handleImport = useCallback(async () => {
    if (!parsedFile) return;

    const activeMappings = mappings.filter((m) => m.targetField && m.targetField !== "");
    if (activeMappings.length === 0) return;

    try {
      const res = await executeImport.mutateAsync({
        rows: parsedFile.rows,
        mappings: activeMappings,
        targetEntity: detectedTarget,
        templateId: selectedTemplateId || null,
        temaId: selectedTemaId || null,
        fileName: parsedFile.fileName,
        fileSize: parsedFile.fileSize,
      });

      const errorRows = res.errors.filter(
        (e: { message: string }) => !e.message.startsWith("Conflito:"),
      ).length;

      setResult({
        imported: res.imported,
        skipped: res.skipped,
        errors: res.errors,
        status: errorRows === 0 ? "completed" : res.skipped === parsedFile.rows.length ? "failed" : "partial",
      });
      setStep(2);
    } catch {
      setResult({
        imported: 0,
        skipped: parsedFile.rows.length,
        errors: [{ row: 0, message: "Erro ao executar importacao. Tente novamente." }],
        status: "failed",
      });
      setStep(2);
    }
  }, [parsedFile, mappings, detectedTarget, selectedTemplateId, executeImport]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) return;

    const activeMappings = mappings.filter((m) => m.targetField && m.targetField !== "");
    await createTemplate.mutateAsync({
      name: templateName.trim(),
      source_system: null,
      target_entity: detectedTarget,
      column_mappings: activeMappings,
    });

    setShowSaveTemplate(false);
    setTemplateName("");
  }, [templateName, mappings, detectedTarget, createTemplate]);

  const handleReset = useCallback(() => {
    setStep(0);
    setParsedFile(null);
    setMappings([]);
    setResult(null);
    setSelectedTemplateId("");
    setSelectedTemaId("");
    setShowSaveTemplate(false);
  }, []);

  const activeMappings = mappings.filter((m) => m.targetField && m.targetField !== "");
  const canProceedToMap = !!parsedFile;
  const canProceedToImport = activeMappings.length > 0;

  return (
    <div className="space-y-6">
      {/* Stepper indicator */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === step
                  ? "bg-[var(--gold)] text-white"
                  : i < step
                    ? "bg-green-100 text-green-800"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span>{i + 1}.</span>
              <span>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="w-8 h-px bg-muted-foreground/20" />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="space-y-5">
          {/* Template selector */}
          {templates && templates.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Usar template salvo (opcional)</Label>
              <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Selecionar template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t: ImportTemplateRow) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="max-w-sm space-y-2">
            <Label className="text-sm">Pipeline / Tema</Label>
            <Select value={selectedTemaId} onValueChange={setSelectedTemaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar pipeline..." />
              </SelectTrigger>
              <SelectContent>
                {(temas as { id: string; name: string; active: boolean }[] | undefined)
                  ?.filter((t) => t.active)
                  ?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Selecione para ter acesso aos campos personalizados da pipeline no mapeamento.
            </p>
          </div>

          <DownloadTemplate extraFields={extraFields} temaName={selectedTemaName} />

          <FileUploadZone onFileParsed={handleFileParsed} />

          {parsedFile && (
            <>
              <DataPreviewTable headers={parsedFile.headers} rows={parsedFile.rows} />

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(1)}
                  disabled={!canProceedToMap}
                  className="gap-2"
                >
                  Mapear colunas
                  <ArrowRight size={14} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 1: Mapeamento */}
      {step === 1 && parsedFile && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{parsedFile.fileName}</Badge>
              <Badge variant="outline">
                {activeMappings.length} de {parsedFile.headers.length} colunas mapeadas
              </Badge>
              {activeMappings.length > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Vai importar: {detectedLabel}
                </Badge>
              )}
            </div>
          </div>

          <DataPreviewTable headers={parsedFile.headers} rows={parsedFile.rows} maxPreviewRows={3} />

          <ColumnMapper
            headers={parsedFile.headers}
            sampleRows={parsedFile.rows}
            targetEntity="client+case"
            mappings={mappings}
            onChange={setMappings}
            extraFields={extraFields}
          />

          {/* Salvar template */}
          {!showSaveTemplate ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowSaveTemplate(true)}
              disabled={!canProceedToImport}
            >
              <Save size={14} />
              Salvar como template
            </Button>
          ) : (
            <div className="flex items-center gap-2 max-w-md">
              <Input
                placeholder="Nome do template (ex.: Base Mais Medicos)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || createTemplate.isPending}
              >
                {createTemplate.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(false)}>
                Cancelar
              </Button>
            </div>
          )}

          {/* Navegacao */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => setStep(0)} className="gap-2">
              <ArrowLeft size={14} />
              Voltar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!canProceedToImport || executeImport.isPending}
              className="gap-2"
            >
              {executeImport.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Importar {parsedFile.rows.length} linhas
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Resultado */}
      {step === 2 && result && (
        <div className="space-y-5">
          <ValidationResults
            imported={result.imported}
            skipped={result.skipped}
            errors={result.errors}
            status={result.status}
          />

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleReset} className="gap-2">
              Nova importacao
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
