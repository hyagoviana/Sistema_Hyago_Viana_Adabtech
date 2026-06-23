import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useClientsList } from "@/hooks/useClients";
import {
  useCreateCase,
  useCreateComercialProcuracao,
  usePreviewProcuracao,
} from "@/hooks/useCases";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { useServiceTypes } from "@/hooks/usePipeline";
import { formatCpfCnpj, isCpfCnpjField } from "@/lib/format";
import { caseCreateSchema, type CaseCreateInput } from "@/lib/validators/case";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetClientId?: string;
};

export function CaseFormDialog({ open, onOpenChange, presetClientId }: Props) {
  const { data: clients } = useClientsList();
  const { data: serviceTypes } = useServiceTypes();
  const create = useCreateCase();
  const [clientPopOpen, setClientPopOpen] = useState(false);
  const [procPopOpen, setProcPopOpen] = useState(false);
  const [procuracaoTemplateId, setProcuracaoTemplateId] = useState("");
  // Fluxo de procuração em 2 etapas: "form" coleta os dados do caso; "review"
  // mostra os campos <...> preenchidos com o cadastro para revisão + envio.
  const [step, setStep] = useState<"form" | "review">("form");
  const [pendingData, setPendingData] = useState<CaseCreateInput | null>(null);

  const firstType = serviceTypes?.[0]?.slug ?? "";

  const form = useForm<CaseCreateInput>({
    resolver: zodResolver(caseCreateSchema),
    defaultValues: {
      client_id: presetClientId ?? "",
      case_type: firstType,
      proximo_passo: "",
      responsavel: "",
      municipio: "",
    },
  });

  // Modelos de procuração disponíveis para o tipo selecionado (procurações
  // soltas, sem tipo, valem para qualquer caso). Busca por nome no popover.
  const caseType = form.watch("case_type");
  const { data: templates } = useDocumentTemplates(caseType);
  const selectedTemplate = (templates ?? []).find((t) => t.id === procuracaoTemplateId);

  useEffect(() => {
    if (open) {
      form.reset({
        client_id: presetClientId ?? "",
        case_type: serviceTypes?.[0]?.slug ?? "",
        proximo_passo: "",
        responsavel: "",
        municipio: "",
      });
      setProcuracaoTemplateId("");
      setStep("form");
      setPendingData(null);
    }
  }, [open, presetClientId, form, serviceTypes]);

  async function onSubmit(data: CaseCreateInput, comercial: boolean) {
    // Comercial COM procuração escolhida → revisa os campos antes de enviar.
    if (comercial && procuracaoTemplateId) {
      setPendingData(data);
      setStep("review");
      return;
    }
    // Demais casos (operacional direto, ou comercial sem modelo) → cria já.
    try {
      const created = await create.mutateAsync({
        ...data,
        comercial,
        procuracao_template_id: undefined,
      });
      if (comercial) {
        toast.success(
          `Caso ${created.case_code} criado na aba Comercial — escolha a procuração na ficha do caso.`,
        );
      } else {
        toast.success(`Caso ${created.case_code} criado`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar caso");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        {step === "review" && pendingData ? (
          <ProcuracaoReviewStep
            caseData={pendingData}
            templateId={procuracaoTemplateId}
            templateName={selectedTemplate?.name ?? "Procuração"}
            onBack={() => setStep("form")}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Novo caso</DialogTitle>
              <DialogDescription>
                O código do caso é gerado automaticamente. Cliente é obrigatório.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => onSubmit(d, true))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => {
                    const selectedClient = (clients ?? []).find((c) => c.id === field.value);
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Cliente *</FormLabel>
                        <Popover open={clientPopOpen} onOpenChange={setClientPopOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={clientPopOpen}
                                disabled={!!presetClientId}
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {selectedClient?.full_name ?? "Buscar cliente…"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0"
                            align="start"
                          >
                            <Command>
                              <CommandInput placeholder="Digite o nome do cliente…" />
                              <CommandList>
                                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {(clients ?? []).map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.full_name}
                                      onSelect={() => {
                                        field.onChange(c.id);
                                        setClientPopOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          c.id === field.value ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      {c.full_name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="case_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(serviceTypes ?? []).map((t) => (
                            <SelectItem key={t.id} value={t.slug}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Procuração — abre a revisão de campos antes do envio ao ZapSign */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium leading-none">
                    Procuração (enviada ao ZapSign)
                  </span>
                  <Popover open={procPopOpen} onOpenChange={setProcPopOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={procPopOpen}
                        className={cn(
                          "w-full justify-between font-normal",
                          !procuracaoTemplateId && "text-muted-foreground",
                        )}
                      >
                        {selectedTemplate?.name ?? "Buscar procuração…"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar pelo nome (ex.: covid)…" />
                        <CommandList>
                          <CommandEmpty>
                            Nenhum modelo. Sincronize os modelos na aba Documentos primeiro.
                          </CommandEmpty>
                          <CommandGroup>
                            {(templates ?? []).map((t) => (
                              <CommandItem
                                key={t.id}
                                value={t.name}
                                onSelect={() => {
                                  setProcuracaoTemplateId(
                                    t.id === procuracaoTemplateId ? "" : t.id,
                                  );
                                  setProcPopOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    t.id === procuracaoTemplateId ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {t.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Ao criar com a procuração escolhida, você revisa os campos preenchidos com os
                    dados do cliente e confirma — então a procuração é enviada ao ZapSign e o
                    cliente recebe o e-mail de assinatura. Opcional.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="proximo_passo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Próximo passo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Protocolar petição inicial"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="responsavel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="municipio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Município</FormLabel>
                        <FormControl>
                          <Input placeholder="Cidade/UF" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={create.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-input shadow-sm font-medium"
                    onClick={form.handleSubmit((d) => onSubmit(d, false))}
                    disabled={create.isPending}
                    title="Cria o caso direto no funil operacional, sem procuração"
                  >
                    Só criar caso
                  </Button>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending
                      ? "Criando…"
                      : procuracaoTemplateId
                        ? "Revisar procuração"
                        : "Criar caso / gerar procuração"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Etapa 2 — Revisão da procuração: mostra os campos <...> preenchidos com os
// dados do cliente (editáveis), permite completar os que faltarem e confirma o
// signatário. Ao enviar, cria o caso + gera + finaliza + envia ao ZapSign.
// --------------------------------------------------------------------------
function ProcuracaoReviewStep({
  caseData,
  templateId,
  templateName,
  onBack,
  onClose,
}: {
  caseData: CaseCreateInput;
  templateId: string;
  templateName: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const preview = usePreviewProcuracao({
    clientId: caseData.client_id,
    templateId,
    municipio: caseData.municipio,
    responsavel: caseData.responsavel,
  });
  const send = useCreateComercialProcuracao();

  const [values, setValues] = useState<Record<string, string>>({});
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Inicializa os campos uma vez, quando o preview chega.
  useEffect(() => {
    if (preview.data && !initialized) {
      setValues(preview.data.values ?? {});
      setSignerName(preview.data.signer?.name ?? "");
      setSignerEmail(preview.data.signer?.email ?? "");
      setInitialized(true);
    }
  }, [preview.data, initialized]);

  const fields = preview.data?.fields ?? [];
  const faltando = fields.filter((f) => f.required && !String(values[f.key] ?? "").trim());

  async function confirmar() {
    if (faltando.length) {
      toast.error(`Preencha os campos obrigatórios: ${faltando.map((f) => f.label).join(", ")}`);
      return;
    }
    if (!signerName.trim()) {
      toast.error("Informe o nome do signatário.");
      return;
    }
    // Envia só os campos com valor (o servidor completa o resto pelo cadastro).
    const nonEmpty: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (String(v).trim()) nonEmpty[k] = v;
    }
    try {
      const res = await send.mutateAsync({
        case: caseData,
        template_id: templateId,
        values: nonEmpty,
        signer: {
          name: signerName.trim(),
          email: signerEmail.trim() || undefined,
          sendAutomaticEmail: true,
        },
      });
      toast.success(
        res.emailSent
          ? `Procuração enviada — e-mail de assinatura disparado para ${signerEmail.trim()}.`
          : "Procuração enviada ao ZapSign — link de assinatura gerado (sem e-mail: informe um e-mail para o cliente receber o link).",
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar a procuração");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Revisar procuração</DialogTitle>
        <DialogDescription>
          {templateName} — confira os campos preenchidos com os dados do cliente. Edite o que
          precisar; os vazios você completa à mão. Ao confirmar, a procuração é enviada ao ZapSign e
          o cliente recebe o e-mail de assinatura.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {preview.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 size={14} className="animate-spin" /> Lendo os campos do modelo…
          </div>
        ) : preview.isError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {preview.error instanceof Error
              ? preview.error.message
              : "Falha ao ler os campos do modelo."}
          </div>
        ) : (
          <>
            {fields.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Nenhum campo &lt;…&gt; detectado neste modelo. A procuração será enviada como está.
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Campos com <span className="text-emerald-600 font-medium">(preenchido)</span> vieram
                do cadastro do cliente. Os marcados com <span className="text-destructive">*</span>{" "}
                são obrigatórios.
              </div>
            )}

            {fields.map((f) => {
              const isDoc = isCpfCnpjField(f.key, f.label);
              const hasValue = !!String(values[f.key] ?? "").trim();
              return (
                <div key={f.key}>
                  <Label className="flex items-center gap-1.5">
                    <span>{f.label}</span>
                    {f.required && <span className="text-destructive">*</span>}
                    {hasValue ? (
                      <span className="text-emerald-600 text-xs">(preenchido)</span>
                    ) : (
                      <span className="text-amber-600 text-xs">(preencha manualmente)</span>
                    )}
                  </Label>
                  <Input
                    value={values[f.key] ?? ""}
                    inputMode={isDoc ? "numeric" : undefined}
                    maxLength={isDoc ? 18 : undefined}
                    onChange={(e) =>
                      setValues((s) => ({
                        ...s,
                        [f.key]: isDoc ? formatCpfCnpj(e.target.value) : e.target.value,
                      }))
                    }
                    placeholder={isDoc ? "000.000.000-00" : f.label}
                  />
                </div>
              );
            })}

            <div className="border-t border-[var(--border)] pt-4 space-y-3">
              <p className="text-sm font-medium text-[var(--navy)]">Signatário</p>
              <div>
                <Label>Nome *</Label>
                <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
              </div>
              <div>
                <Label>E-mail (recebe o link de assinatura)</Label>
                <Input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="cliente@email.com"
                />
                {!signerEmail.trim() && (
                  <p className="mt-1 text-xs text-amber-600">
                    Sem e-mail, o cliente não recebe o link automaticamente (só ficará disponível o
                    link manual).
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onBack} disabled={send.isPending}>
          Voltar
        </Button>
        <Button
          type="button"
          onClick={confirmar}
          disabled={preview.isLoading || preview.isError || send.isPending || faltando.length > 0}
        >
          {send.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
          {send.isPending ? "Enviando…" : "Confirmar e enviar ao ZapSign"}
        </Button>
      </DialogFooter>
    </>
  );
}
