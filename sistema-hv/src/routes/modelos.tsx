import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eyebrow } from "@/components/hv/primitives";
import {
  useCreateDocumentTemplate,
  useDeleteDocumentTemplate,
  useDocumentTemplates,
  type TemplateFieldInput,
} from "@/hooks/useDocumentTemplates";
import { CASE_TYPES, CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";

export const Route = createFileRoute("/modelos")({
  component: ModelosPage,
});

function ModelosPage() {
  const { data: templates, isLoading } = useDocumentTemplates();
  const del = useDeleteDocumentTemplate();
  const [open, setOpen] = useState(false);

  return (
    <div className="page-container">
      <Eyebrow>Configuração</Eyebrow>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[32px] font-bold text-[var(--navy)]">
          Modelos de documento
        </h1>
        <Button onClick={() => setOpen(true)}>
          <Plus size={15} className="mr-1.5" /> Novo modelo
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
        Cada modelo aponta para um <strong>Google Doc</strong> (com placeholders no formato{" "}
        <code>&lt;campo&gt;</code>) na conta-sistema. Defina os campos e, se o documento vai para
        assinatura, marque “Vai para ZapSign”.
      </p>

      <div className="card-editorial !p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando…</div>
        ) : (templates ?? []).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground italic text-sm">
            Nenhum modelo cadastrado.
          </div>
        ) : (
          <ul>
            {(templates ?? []).map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-[var(--navy)]">{t.name}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {t.case_type ? CASE_TYPE_LABELS[t.case_type as CaseType] ?? t.case_type : "Sem tipo"}{" "}
                    · {Array.isArray(t.fields) ? t.fields.length : 0} campo(s)
                  </div>
                </div>
                {t.goes_to_zapsign && <Badge className="bg-[var(--gold-700)] text-white">ZapSign</Badge>}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Excluir"
                  onClick={async () => {
                    try {
                      await del.mutateAsync(t.id);
                      toast.success("Modelo removido");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Falha");
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateTemplateDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const create = useCreateDocumentTemplate();
  const [name, setName] = useState("");
  const [googleDocId, setGoogleDocId] = useState("");
  const [caseType, setCaseType] = useState<string>("");
  const [goesZap, setGoesZap] = useState(false);
  const [fields, setFields] = useState<TemplateFieldInput[]>([]);

  function reset() {
    setName("");
    setGoogleDocId("");
    setCaseType("");
    setGoesZap(false);
    setFields([]);
  }

  function addField() {
    setFields((f) => [...f, { key: "", label: "", source: "manual", required: false }]);
  }
  function patchField(i: number, patch: Partial<TemplateFieldInput>) {
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function submit() {
    if (!name.trim() || !googleDocId.trim()) {
      toast.error("Nome e ID do Google Doc são obrigatórios");
      return;
    }
    // Aceita ID puro ou URL completa do Google Doc.
    const docMatch = googleDocId.match(/[-\w]{25,}/);
    const docId = docMatch ? docMatch[0] : googleDocId.trim();
    try {
      await create.mutateAsync({
        name: name.trim(),
        google_doc_id: docId,
        case_type: caseType || null,
        goes_to_zapsign: goesZap,
        fields: fields.filter((f) => f.key.trim()),
      });
      toast.success("Modelo criado");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo modelo</DialogTitle>
          <DialogDescription>
            Cole o ID (ou a URL) do Google Doc base e defina os campos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Declaração COVID" />
          </div>
          <div>
            <Label>Google Doc (ID ou URL) *</Label>
            <Input
              value={googleDocId}
              onChange={(e) => setGoogleDocId(e.target.value)}
              placeholder="https://docs.google.com/document/d/XXXX/edit"
            />
          </div>
          <div>
            <Label>Tipo de serviço</Label>
            <Select value={caseType} onValueChange={setCaseType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)…" />
              </SelectTrigger>
              <SelectContent>
                {CASE_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>
                    {CASE_TYPE_LABELS[ct]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={goesZap} onCheckedChange={(v) => setGoesZap(!!v)} />
            Vai para ZapSign (documento de assinatura)
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Campos (placeholders)</Label>
              <Button variant="outline" size="sm" onClick={addField}>
                <Plus size={13} className="mr-1" /> Campo
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="w-32"
                    value={f.key}
                    onChange={(e) => patchField(i, { key: e.target.value })}
                    placeholder="chave"
                  />
                  <Input
                    className="flex-1"
                    value={f.label}
                    onChange={(e) => patchField(i, { label: e.target.value })}
                    placeholder="rótulo"
                  />
                  <Select value={f.source} onValueChange={(v) => patchField(i, { source: v as TemplateFieldInput["source"] })}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="blank">Em branco</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Checkbox
                      checked={!!f.required}
                      onCheckedChange={(v) => patchField(i, { required: !!v })}
                    />
                    obrig.
                  </label>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive p-1"
                    onClick={() => setFields((arr) => arr.filter((_, idx) => idx !== i))}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Criando…" : "Criar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
