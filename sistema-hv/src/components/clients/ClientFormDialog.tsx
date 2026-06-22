import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CustomFieldsSection,
  missingRequiredCustom,
} from "@/components/clients/CustomFieldsSection";
import { ESTADOS_BR } from "@/lib/br/estados";
import { useClientFieldDefs } from "@/hooks/useClientFields";
import { useCreateClient, useUpdateClient } from "@/hooks/useClients";
import { useCreateCase } from "@/hooks/useCases";
import { CepError, lookupCep, useMunicipios } from "@/hooks/useLocalidades";
import { useServiceTypes } from "@/hooks/usePipeline";
import type { Database } from "@/lib/supabase/types";
import {
  clientCreateSchema,
  sanitizeCpfCnpj,
  type ClientCreateInput,
} from "@/lib/validators/client";

type Client = Database["public"]["Tables"]["system_clients"]["Row"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  client?: Client | null;
};

const TIPOS = ["Médico", "Dentista", "Enfermeiro", "Outro profissional", "Pessoa jurídica"];

const EMPTY_ADDRESS = {
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zipcode: "",
};

function pickAddress(address: Client["address"]): typeof EMPTY_ADDRESS {
  if (!address || typeof address !== "object" || Array.isArray(address))
    return { ...EMPTY_ADDRESS };
  const a = address as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  return {
    street: str("street"),
    number: str("number"),
    complement: str("complement"),
    neighborhood: str("neighborhood"),
    city: str("city"),
    state: str("state"),
    zipcode: str("zipcode"),
  };
}

const EMPTY_PROFESSIONAL = {
  crm_numero: "",
  crm_uf: "",
  oab_numero: "",
  oab_uf: "",
  vinculo_institucional: "",
  especialidade: "",
  observacoes: "",
};

function pickProfessional(pd: Client["professional_data"]): typeof EMPTY_PROFESSIONAL {
  if (!pd || typeof pd !== "object" || Array.isArray(pd)) return { ...EMPTY_PROFESSIONAL };
  const p = pd as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  return {
    crm_numero: str("crm_numero"),
    crm_uf: str("crm_uf"),
    oab_numero: str("oab_numero"),
    oab_uf: str("oab_uf"),
    vinculo_institucional: str("vinculo_institucional"),
    especialidade: str("especialidade"),
    observacoes: str("observacoes"),
  };
}

function pickCustom(cf: Client["custom_fields"]): Record<string, unknown> {
  if (!cf || typeof cf !== "object" || Array.isArray(cf)) return {};
  return cf as Record<string, unknown>;
}

function emptyDefaults(): ClientCreateInput {
  return {
    full_name: "",
    cpf_cnpj: "",
    rg: "",
    tipo: "",
    email: "",
    phone: "",
    address: { ...EMPTY_ADDRESS },
    professional_data: { ...EMPTY_PROFESSIONAL },
    custom_fields: {},
  };
}

// Select de UF reutilizado (cadastral e profissional). Sem digitação.
function UfSelect({
  value,
  onChange,
  includeEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  includeEmpty?: boolean;
}) {
  return (
    <Select onValueChange={(v) => onChange(v === "__none__" ? "" : v)} value={value || "__none__"}>
      <SelectTrigger>
        <SelectValue placeholder="UF" />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {includeEmpty && <SelectItem value="__none__">—</SelectItem>}
        {ESTADOS_BR.map((e) => (
          <SelectItem key={e.sigla} value={e.sigla}>
            {e.sigla} · {e.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ClientFormDialog({ open, onOpenChange, mode, client }: Props) {
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const createCaseMutation = useCreateCase();
  const { data: serviceTypes } = useServiceTypes();
  const { data: fieldDefs } = useClientFieldDefs();
  const [linkedCaseType, setLinkedCaseType] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const isLoading =
    createMutation.isPending || updateMutation.isPending || createCaseMutation.isPending;

  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: emptyDefaults(),
  });

  // CPF (11) → pessoa física → mostra/exige RG. CNPJ (14) → PJ → sem RG.
  const cpfDigits = sanitizeCpfCnpj(form.watch("cpf_cnpj") || "");
  const isPF = cpfDigits.length !== 14;
  // UF selecionada governa a lista de municípios.
  const selectedUf = form.watch("address.state") || "";
  const { data: municipios, isLoading: loadingMunicipios } = useMunicipios(selectedUf);

  useEffect(() => {
    if (!open) return;
    setLinkedCaseType("");
    if (mode === "edit" && client) {
      form.reset({
        full_name: client.full_name,
        cpf_cnpj: client.cpf_cnpj,
        rg: client.rg ?? "",
        tipo: client.tipo ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        address: pickAddress(client.address),
        professional_data: pickProfessional(client.professional_data),
        custom_fields: pickCustom(client.custom_fields),
      });
    } else {
      form.reset(emptyDefaults());
    }
  }, [open, mode, client, form]);

  // Busca endereço pelo CEP (ViaCEP) e preenche rua, bairro, UF e município.
  const handleCepLookup = async () => {
    const raw = form.getValues("address.zipcode") || "";
    if (raw.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    try {
      const r = await lookupCep(raw);
      if (r.logradouro) form.setValue("address.street", r.logradouro, { shouldValidate: true });
      if (r.bairro) form.setValue("address.neighborhood", r.bairro);
      if (r.uf) form.setValue("address.state", r.uf, { shouldValidate: true });
      if (r.localidade) form.setValue("address.city", r.localidade, { shouldValidate: true });
      toast.success("Endereço preenchido pelo CEP");
    } catch (err) {
      const msg = err instanceof CepError ? err.message : "Falha ao buscar CEP";
      toast.error(msg);
    } finally {
      setCepLoading(false);
    }
  };

  const onSubmit = async (data: ClientCreateInput) => {
    // Valida campos customizados obrigatórios (fora do alcance do zodResolver).
    const missing = missingRequiredCustom(
      fieldDefs ?? [],
      data.custom_fields as Record<string, unknown> | undefined,
    );
    if (missing.length > 0) {
      missing.forEach((key) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setError(`custom_fields.${key}` as any, { message: "Campo obrigatório" }),
      );
      toast.error("Preencha os campos adicionais obrigatórios");
      return;
    }

    try {
      if (mode === "edit" && client) {
        await updateMutation.mutateAsync({ id: client.id, input: data });
        toast.success("Cliente atualizado");
      } else {
        const created = await createMutation.mutateAsync(data);
        if (created.drive_sync_failed) {
          toast.warning(
            "Cliente criado, mas a pasta no Drive falhou — tente sincronizar na ficha.",
          );
        } else {
          toast.success("Cliente criado com pasta no Drive");
        }
        if (linkedCaseType) {
          try {
            const caso = await createCaseMutation.mutateAsync({
              client_id: created.id,
              case_type: linkedCaseType,
            });
            toast.success(`Caso ${caso.case_code} vinculado ao cliente`);
          } catch (caseErr) {
            toast.error(
              `Cliente criado, mas falha ao criar caso: ${caseErr instanceof Error ? caseErr.message : "erro"}`,
            );
          }
        }
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg);
    }
  };

  // Município: garante que o valor atual apareça mesmo antes da lista carregar.
  const cityValue = form.watch("address.city") || "";
  const municipioOptions =
    municipios && municipios.length > 0
      ? cityValue && !municipios.includes(cityValue)
        ? [cityValue, ...municipios]
        : municipios
      : cityValue
        ? [cityValue]
        : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Nome, CPF/CNPJ e RG não podem ser alterados. Os demais campos são editáveis."
              : "Cadastro do cliente — uma pasta no Google Drive é criada automaticamente."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Identificação — campos imutáveis após o cadastro */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Maria da Silva" disabled={mode === "edit"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF / CNPJ *</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" disabled={mode === "edit"} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isPF && (
                <FormField
                  control={form.control}
                  name="rg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RG *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0000000"
                          disabled={mode === "edit" && !!client?.rg}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Contato — editável futuramente */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="maria@exemplo.com"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input placeholder="(82) 99999-9999" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Endereço — CEP busca rua/bairro/UF/município automaticamente */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Endereço
              </p>

              <FormField
                control={form.control}
                name="address.zipcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="57000-000"
                        maxLength={9}
                        {...field}
                        value={field.value ?? ""}
                        onBlur={() => {
                          field.onBlur();
                          void handleCepLookup();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    {cepLoading && (
                      <p className="text-[11px] text-muted-foreground">Buscando endereço…</p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rua *</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua das Flores" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-[120px_1fr] gap-3">
                <FormField
                  control={form.control}
                  name="address.number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número *</FormLabel>
                      <FormControl>
                        <Input placeholder="123 / S/N" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.complement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Apto 101, Bloco B…"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-[160px_1fr] gap-3">
                <FormField
                  control={form.control}
                  name="address.state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF *</FormLabel>
                      <UfSelect
                        value={field.value ?? ""}
                        onChange={(v) => {
                          field.onChange(v);
                          // Trocou de UF → limpa município (não pertence mais).
                          form.setValue("address.city", "", { shouldValidate: true });
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Município *</FormLabel>
                      <Combobox
                        options={municipioOptions}
                        value={field.value ?? ""}
                        onChange={(v) => field.onChange(v)}
                        placeholder={selectedUf ? "Selecione o município" : "Escolha a UF primeiro"}
                        searchPlaceholder="Buscar município…"
                        emptyText="Município não encontrado."
                        disabled={!selectedUf}
                        loading={loadingMunicipios}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Classificação */}
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dados profissionais — atributos estruturados (P1 item 1) */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dados profissionais
              </p>

              <div className="grid grid-cols-[1fr_140px] gap-3">
                <FormField
                  control={form.control}
                  name="professional_data.crm_numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CRM</FormLabel>
                      <FormControl>
                        <Input placeholder="123456" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="professional_data.crm_uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF do CRM</FormLabel>
                      <UfSelect value={field.value ?? ""} onChange={field.onChange} includeEmpty />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-[1fr_140px] gap-3">
                <FormField
                  control={form.control}
                  name="professional_data.oab_numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OAB</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="professional_data.oab_uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF da OAB</FormLabel>
                      <UfSelect value={field.value ?? ""} onChange={field.onChange} includeEmpty />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="professional_data.vinculo_institucional"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vínculo institucional</FormLabel>
                      <FormControl>
                        <Input placeholder="ANMR, AMPB…" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="professional_data.especialidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especialidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Cardiologia…" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Campos customizados (Melhoria 1) — definidos pelo admin */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <CustomFieldsSection defs={fieldDefs ?? []} control={form.control as any} />

            {mode === "create" && (serviceTypes ?? []).length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vincular a um caso (opcional)
                </p>
                <Select
                  onValueChange={(v) => setLinkedCaseType(v === "__none__" ? "" : v)}
                  value={linkedCaseType || "__none__"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum — criar só o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum — criar só o cliente</SelectItem>
                    {(serviceTypes ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.slug}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando…" : mode === "edit" ? "Salvar" : "Criar cliente"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
