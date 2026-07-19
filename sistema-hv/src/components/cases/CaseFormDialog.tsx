import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { useCreateCase } from "@/hooks/useCases";
import { useServiceTypes } from "@/hooks/usePipeline";
import { useFrentes, useTemas } from "@/hooks/useTemas";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/lib/auth";
import { isAdvogado, ROLE_LABELS, type Role } from "@/lib/rbac";
import { caseCreateSchema, type CaseCreateInput } from "@/lib/validators/case";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetClientId?: string;
};

// Novo caso — ITEM 5 (2026-07-06): o caso NÃO entra direto no operacional. Ele
// nasce no COMERCIAL (aguardando assinatura): o Kanban operacional esconde casos
// com `aguardando_assinatura_at` e o card aparece no board Comercial. A entrada no
// operacional acontece por assinatura (webhook/manual) OU pelo botão "Enviar para
// operacional" no board Comercial. O contrato/procuração e o envio ao ZapSign
// ficam na ficha do caso.
export function CaseFormDialog({ open, onOpenChange, presetClientId }: Props) {
  const { data: clients } = useClientsList();
  const { data: serviceTypes } = useServiceTypes();
  // R2-05 — TEMA→FRENTE é o fluxo principal quando há temas cadastrados. Categorias
  // legadas (service_types sem tema) continuam como fallback.
  const { data: temas } = useTemas();
  const { data: users } = useUsers();
  const { profile, role } = useAuth();
  const create = useCreateCase();
  const [clientPopOpen, setClientPopOpen] = useState(false);
  const [respPopOpen, setRespPopOpen] = useState(false);
  // Situação inicial do caso (cadastro exclusivo, 2026-07-19). "lead" (padrão) =
  // nasce no Comercial aguardando assinatura; "cliente" = nasce já assinado, direto
  // no Operacional. A virada automática lead→cliente ao assinar segue valendo.
  const [situacaoInicial, setSituacaoInicial] = useState<"lead" | "cliente">("lead");
  // Tema selecionado (dirige o select de frente e o dual-write). Vazio = usar o
  // caminho legado por categoria (case_type).
  const [temaId, setTemaId] = useState<string>("");
  const { data: frentes } = useFrentes(temaId || undefined);
  const hasTemas = (temas ?? []).length > 0;

  // Advogados ativos (titular/associado) selecionáveis como responsáveis.
  const advogados = (users ?? []).filter(
    (u) => isAdvogado(u.role as Role) && u.status === "ACTIVE",
  );
  const iAmAdvogado = isAdvogado(role);
  const myId = profile?.id ?? null;

  const firstType = serviceTypes?.[0]?.slug ?? "";

  const form = useForm<CaseCreateInput>({
    resolver: zodResolver(caseCreateSchema),
    defaultValues: {
      client_id: presetClientId ?? "",
      case_type: firstType,
      tema_id: null,
      frente_slug: null,
      proximo_passo: "",
      responsavel: "",
      responsavelIds: iAmAdvogado && myId ? [myId] : [],
      municipio: "",
    },
  });

  useEffect(() => {
    if (open) {
      setTemaId("");
      setSituacaoInicial("lead");
      form.reset({
        client_id: presetClientId ?? "",
        case_type: serviceTypes?.[0]?.slug ?? "",
        tema_id: null,
        frente_slug: null,
        proximo_passo: "",
        responsavel: "",
        responsavelIds: iAmAdvogado && myId ? [myId] : [],
        municipio: "",
      });
    }
  }, [open, presetClientId, form, serviceTypes, iAmAdvogado, myId]);

  async function onSubmit(data: CaseCreateInput) {
    try {
      // R2-05 — quando o caso nasce por TEMA, `case_type` é um placeholder (o slug
      // do tema): o servidor (createCase) resolve o service_type INTERNO do tema e
      // sobrescreve `case_type` com o slug interno. `tema_id`+`frente_slug` vão no
      // dual-write. Sem tema, usa o `case_type` do select de categoria (legado).
      const comoCliente = situacaoInicial === "cliente";
      const created = await create.mutateAsync({
        ...data,
        tema_id: temaId || null,
        // ITEM 5: por padrão entra no COMERCIAL (aguardando assinatura). Quando o
        // usuário marca "Cliente (já assinado)", nasce direto como CLIENTE no
        // operacional (cadastro exclusivo, 2026-07-19).
        comercial: !comoCliente,
        iniciar_como_cliente: comoCliente,
        procuracao_template_id: undefined,
      });
      toast.success(
        comoCliente
          ? `Caso ${created.case_code} criado — Cliente (no Operacional)`
          : `Caso ${created.case_code} criado — no Comercial (aguardando assinatura)`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar caso");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Novo caso</DialogTitle>
          <DialogDescription>
            O código do caso é gerado automaticamente. Cliente é obrigatório. O caso entra no
            Comercial (aguardando assinatura); vai ao Operacional quando o documento for assinado ou
            você usar "Enviar para operacional" no board Comercial.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            {/* R2-05 — TEMA (fluxo principal quando há temas). Escolher um tema
                dirige o select de FRENTE e o dual-write (tema_id + case_type do
                service_type interno, resolvido no servidor). */}
            {hasTemas && (
              <FormItem>
                <FormLabel>Tema {temaId ? "*" : ""}</FormLabel>
                <Select
                  value={temaId}
                  onValueChange={(v) => {
                    setTemaId(v);
                    // Placeholder de case_type (o servidor sobrescreve pelo slug do
                    // service_type interno do tema). Usa o slug do tema p/ passar o
                    // schema (case_type min(1)) e refletir a intenção.
                    const tema = (temas ?? []).find((t) => t.id === v);
                    if (tema) form.setValue("case_type", tema.slug);
                    // Reseta a frente ao trocar de tema.
                    form.setValue("frente_slug", null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tema (ou use uma categoria abaixo)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(temas ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}

            {/* Frente do tema (só quando um tema está escolhido). Documentos e
                checklist do caso são puxados por esta frente (R2-04). */}
            {temaId && (
              <FormField
                control={form.control}
                name="frente_slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frente</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a frente (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(frentes ?? []).map((f) => (
                          <SelectItem key={f.id} value={f.slug}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Categoria legada (fallback). Só é o campo principal quando NÃO há
                temas; com temas, aparece como alternativa para tipos legados sem
                tema e fica oculta quando um tema já foi escolhido. */}
            {!temaId && (
              <FormField
                control={form.control}
                name="case_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{hasTemas ? "Ou categoria (legado)" : "Tipo *"}</FormLabel>
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
            )}

            {/* Situação inicial (cadastro exclusivo, 2026-07-19) — Lead (padrão) ou
                Cliente (já assinado). A pessoa aparece só em Leads OU só em Clientes;
                se depois um caso dela for assinado, vira Cliente automaticamente. */}
            <FormItem>
              <FormLabel>Situação inicial *</FormLabel>
              <Select
                value={situacaoInicial}
                onValueChange={(v) => setSituacaoInicial(v as "lead" | "cliente")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">
                    Lead — vai para o Comercial (aguardando assinatura)
                  </SelectItem>
                  <SelectItem value="cliente">
                    Cliente — já assinado (vai direto ao Operacional)
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormItem>

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
                name="responsavelIds"
                render={({ field }) => {
                  const selected = (field.value ?? []) as string[];
                  const labelFor = (id: string) => {
                    const a = advogados.find((x) => x.id === id);
                    return a?.full_name || a?.email || "—";
                  };
                  const toggle = (id: string) => {
                    if (iAmAdvogado) return; // advogado fica travado em si mesmo
                    field.onChange(
                      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
                    );
                  };
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Responsável</FormLabel>
                      {iAmAdvogado ? (
                        <div className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-muted-foreground">
                          {(myId && labelFor(myId)) || profile?.full_name || "Você"} (você)
                        </div>
                      ) : (
                        <Popover open={respPopOpen} onOpenChange={setRespPopOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              type="button"
                              className="justify-between font-normal"
                            >
                              <span className="truncate">
                                {selected.length === 0
                                  ? "Selecionar advogados"
                                  : selected.length === 1
                                    ? labelFor(selected[0])
                                    : `${selected.length} advogados`}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                            <Command>
                              <CommandInput placeholder="Buscar advogado…" />
                              <CommandList>
                                <CommandEmpty>Nenhum advogado ativo.</CommandEmpty>
                                <CommandGroup>
                                  {advogados.map((a) => (
                                    <CommandItem
                                      key={a.id}
                                      value={a.full_name || a.email}
                                      onSelect={() => toggle(a.id)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selected.includes(a.id) ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      <span className="flex-1">{a.full_name || a.email}</span>
                                      <span className="text-[11px] text-muted-foreground">
                                        {ROLE_LABELS[a.role as Role]}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Criando…" : "Criar caso"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
