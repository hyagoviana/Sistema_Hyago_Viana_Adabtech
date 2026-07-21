import { createFileRoute } from "@tanstack/react-router";
import { Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
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
  useUpdateDocumentTemplate,
  type TemplateFieldInput,
} from "@/hooks/useDocumentTemplates";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";
import { useServiceTypes } from "@/hooks/usePipeline";

export const Route = createFileRoute("/modelos")({
  component: ModelosPage,
});

type TemplateRow = { id: string; name: string; fields: unknown };

function ModelosPage() {
  const { data: templates, isLoading } = useDocumentTemplates();
  const del = useDeleteDocumentTemplate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);

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
          <div className="p-8 text-center text-muted-foreground text-sm">
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
                    {t.case_type
                      ? (CASE_TYPE_LABELS[t.case_type as CaseType] ?? t.case_type)
                      : "Todos os casos"}{" "}
                    · {Array.isArray(t.fields) ? t.fields.length : 0} campo(s)
                  </div>
                </div>
                {t.goes_to_zapsign && (
                  <Badge className="bg-[var(--gold-700)] text-white">ZapSign</Badge>
                )}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-[var(--navy)] p-1"
                  title="Editar campos"
                  onClick={() => setEditing({ id: t.id, name: t.name, fields: t.fields })}
                >
                  <SlidersHorizontal size={15} />
                </button>
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
      <EditTemplateFieldsDialog
        key={editing?.id ?? "none"}
        template={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

// Origem de um campo AUTOMÁTICO (auto_field). O sentinela "__label__" = sem
// auto_field: o motor resolve pelo RÓTULO (campos do caso, financeiro, município).
const AUTO_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "__label__", label: "Automático pelo rótulo (caso / financeiro / município)" },
  { value: "dados_pessoais", label: "Dados pessoais (bloco completo)" },
  { value: "client_name", label: "Nome do cliente" },
  { value: "cpf", label: "CPF / CNPJ" },
  { value: "rg", label: "RG" },
  { value: "orgao_expedidor", label: "Órgão emissor do RG" },
  { value: "estado_civil", label: "Estado civil" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "data_nascimento", label: "Data de nascimento" },
  { value: "nacionalidade", label: "Nacionalidade" },
  { value: "endereco", label: "Endereço completo" },
  { value: "logradouro", label: "Rua / Logradouro" },
  { value: "bairro", label: "Bairro" },
  { value: "cep", label: "CEP" },
  { value: "cidade", label: "Cidade" },
  { value: "estado", label: "Estado / UF" },
  { value: "municipio", label: "Município" },
  { value: "crm", label: "CRM" },
  { value: "crm_uf", label: "UF do CRM" },
  { value: "oab", label: "OAB" },
  { value: "oab_uf", label: "UF da OAB" },
  { value: "especialidade", label: "Especialidade" },
  { value: "vinculo_institucional", label: "Vínculo institucional" },
  { value: "case_code", label: "Código do caso" },
  { value: "responsavel", label: "Responsável" },
];

// Buraco B (owner, 2026-07-21) — "motor classifica, admin ajusta". Edita a
// classificação dos campos de um modelo JÁ sincronizado: origem (auto/manual/em
// branco), qual dado automático (auto_field), rótulo e obrigatoriedade. A `key`
// (placeholder <campo> do Doc) é imutável — mudá-la quebraria a substituição.
function EditTemplateFieldsDialog({
  template,
  onClose,
}: {
  template: TemplateRow | null;
  onClose: () => void;
}) {
  const update = useUpdateDocumentTemplate();
  const initial = (Array.isArray(template?.fields) ? template?.fields : []) as TemplateFieldInput[];
  const [fields, setFields] = useState<TemplateFieldInput[]>(initial);

  function patchField(i: number, patch: Partial<TemplateFieldInput>) {
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function save() {
    if (!template) return;
    const clean = fields.map((f) => ({
      key: f.key,
      // Rótulo em branco/whitespace → cai na própria chave (evita violar min(1)).
      label: f.label?.trim() || f.key,
      source: f.source,
      required: !!f.required,
      ...(f.source === "auto" && f.auto_field ? { auto_field: f.auto_field } : {}),
    }));
    try {
      await update.mutateAsync({ id: template.id, patch: { fields: clean } });
      toast.success("Campos atualizados");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  return (
    <Dialog open={!!template} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Campos de “{template?.name}”</DialogTitle>
          <DialogDescription>
            Ajuste de onde cada campo é preenchido. <strong>Automático</strong> = o motor puxa
            sozinho (cliente/caso/financeiro/município). <strong>Manual</strong> = você digita ao
            gerar e o valor fica salvo no caso (preenche 1× e reusa). <strong>Em branco</strong> =
            ignora o campo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {fields.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Este modelo não tem campos (placeholders <code>&lt;campo&gt;</code>). Sincronize o
              modelo do Drive para extraí-los.
            </div>
          ) : (
            fields.map((f, i) => (
              <div
                key={f.key || i}
                className="grid grid-cols-[1fr,auto] gap-2 items-start rounded-md border border-[var(--border)] p-2.5"
              >
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground truncate" title={f.key}>
                    &lt;{f.key}&gt;
                  </div>
                  <Input
                    className="mt-1 h-8"
                    value={f.label ?? ""}
                    onChange={(e) => patchField(i, { label: e.target.value })}
                    placeholder="rótulo exibido na geração"
                  />
                  {f.source === "auto" && (
                    <Select
                      value={f.auto_field || "__label__"}
                      onValueChange={(v) =>
                        patchField(i, { auto_field: v === "__label__" ? undefined : v })
                      }
                    >
                      <SelectTrigger className="mt-1.5 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {AUTO_FIELD_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Select
                    value={f.source}
                    onValueChange={(v) =>
                      patchField(i, { source: v as TemplateFieldInput["source"] })
                    }
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="blank">Em branco</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Checkbox
                      checked={!!f.required}
                      onCheckedChange={(v) => patchField(i, { required: !!v })}
                    />
                    obrigatório
                  </label>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={update.isPending || fields.length === 0}>
            {update.isPending ? "Salvando…" : "Salvar campos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { data: serviceTypes } = useServiceTypes();
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Declaração COVID"
            />
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
            <Label>Tipo de caso</Label>
            <Select
              value={caseType || "__none__"}
              onValueChange={(v) => setCaseType(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os casos (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todos os casos</SelectItem>
                {(serviceTypes ?? []).map((st) => (
                  <SelectItem key={st.id} value={st.slug}>
                    {st.name}
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
                  <Select
                    value={f.source}
                    onValueChange={(v) =>
                      patchField(i, { source: v as TemplateFieldInput["source"] })
                    }
                  >
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
