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
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { useServiceTypes } from "@/hooks/usePipeline";
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
    }
  }, [open, presetClientId, form, serviceTypes]);

  async function onSubmit(data: CaseCreateInput, comercial: boolean) {
    try {
      const created = await create.mutateAsync({
        ...data,
        comercial,
        procuracao_template_id: comercial ? procuracaoTemplateId || undefined : undefined,
      });
      if (comercial) {
        toast.success(
          procuracaoTemplateId
            ? `Caso ${created.case_code} criado — procuração preenchida com os dados do cliente. Revise e envie ao ZapSign na aba Comercial.`
            : `Caso ${created.case_code} criado na aba Comercial — escolha a procuração na ficha do caso.`,
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

            {/* Procuração — gera o documento preenchido ao criar como comercial */}
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
                              setProcuracaoTemplateId(t.id === procuracaoTemplateId ? "" : t.id);
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
                Em "Criar caso / gerar procuração", o documento é preenchido com os dados do cliente
                e fica para revisão antes do envio ao ZapSign. Opcional.
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
                {create.isPending ? "Criando…" : "Criar caso / gerar procuração"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
