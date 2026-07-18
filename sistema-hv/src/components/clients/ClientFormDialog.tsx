import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { HOSPITAIS_RESIDENCIA, INSTITUICOES_GRADUACAO } from "@/lib/br/instituicoes";
import { formatCep, formatCpfCnpj, formatPhone, formatRg } from "@/lib/format";
import { useClientFieldDefs } from "@/hooks/useClientFields";
import { useFindOrCreateClient, useUpdateClient } from "@/hooks/useClients";
import { checkEmailFn } from "@/rpc/clients";
import { CepError, lookupCep, useMunicipios } from "@/hooks/useLocalidades";
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

// Hyago 2 (2026-07-06): TIPO passa a ser Médico / Previdenciário / Outro.
const TIPOS = ["Médico", "Previdenciário", "Outro"];

// Especialidades médicas — lista FIXA para padronizar a busca no CRM (Hyago 2).
const ESPECIALIDADES = [
  "Clínica Médica",
  "Cardiologia",
  "Pediatria",
  "Ginecologia e Obstetrícia",
  "Ortopedia e Traumatologia",
  "Anestesiologia",
  "Cirurgia Geral",
  "Dermatologia",
  "Psiquiatria",
  "Radiologia e Diagnóstico por Imagem",
  "Oftalmologia",
  "Neurologia",
  "Endocrinologia e Metabologia",
  "Gastroenterologia",
  "Pneumologia",
  "Nefrologia",
  "Urologia",
  "Oncologia Clínica",
  "Medicina de Família e Comunidade",
  "Medicina Intensiva",
  "Otorrinolaringologia",
  "Infectologia",
  "Reumatologia",
  "Hematologia e Hemoterapia",
  "Medicina do Trabalho",
  "Geriatria",
  "Cirurgia Vascular",
  "Mastologia",
  "Patologia",
  "Medicina Legal e Perícia Médica",
  "Outra",
];

// Sugestões de graduação/residência: fonte única curada e ampliada em
// `@/lib/br/instituicoes` (datalist). São só SUGESTÕES — o usuário pode digitar
// um valor fora da lista (entrada livre), que persiste em professional_data.

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
  rg_orgao: "",
  estado_civil: "",
  oab_numero: "",
  oab_uf: "",
  vinculo_institucional: "",
  especialidade: "",
  instituicao_graduacao: "",
  ano_formatura: "",
  fies: "",
  fies_contrato_numero: "",
  fies_contrato_obs: "",
  residencia_hospital: "",
  residencia_inicio: "",
  residencia_termino: "",
  residencia_especialidade: "",
  tags: [] as string[],
  observacoes: "",
};

function pickProfessional(pd: Client["professional_data"]): typeof EMPTY_PROFESSIONAL {
  if (!pd || typeof pd !== "object" || Array.isArray(pd)) return { ...EMPTY_PROFESSIONAL };
  const p = pd as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  return {
    crm_numero: str("crm_numero"),
    crm_uf: str("crm_uf"),
    rg_orgao: str("rg_orgao"),
    estado_civil: str("estado_civil"),
    oab_numero: str("oab_numero"),
    oab_uf: str("oab_uf"),
    vinculo_institucional: str("vinculo_institucional"),
    especialidade: str("especialidade"),
    instituicao_graduacao: str("instituicao_graduacao"),
    ano_formatura: str("ano_formatura"),
    fies: str("fies"),
    fies_contrato_numero: str("fies_contrato_numero"),
    fies_contrato_obs: str("fies_contrato_obs"),
    residencia_hospital: str("residencia_hospital"),
    residencia_inicio: str("residencia_inicio"),
    residencia_termino: str("residencia_termino"),
    residencia_especialidade: str("residencia_especialidade"),
    tags: Array.isArray(p.tags)
      ? (p.tags as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
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
  const createMutation = useFindOrCreateClient();
  const updateMutation = useUpdateClient();
  const { data: fieldDefs } = useClientFieldDefs();
  // Campos ocultos (active=false) não aparecem no cadastro.
  const activeFieldDefs = (fieldDefs ?? []).filter((d) => d.active);
  const [cepLoading, setCepLoading] = useState(false);
  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Verificação de entregabilidade do e-mail (DNS/MX + sugestão de typo). Auxiliar:
  // avisa/sugere no onBlur; o bloqueio duro fica no servidor (createClient).
  const checkEmail = useServerFn(checkEmailFn);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailWarn, setEmailWarn] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const handleEmailCheck = async () => {
    const email = (form.getValues("email") || "").trim();
    setEmailWarn(null);
    setEmailSuggestion(null);
    if (!email || !email.includes("@")) return;
    setEmailChecking(true);
    try {
      const r = await checkEmail({ data: { email } });
      if (!r.ok) setEmailWarn(r.reason ?? "Domínio de e-mail suspeito.");
      if (r.suggestion) setEmailSuggestion(r.suggestion);
    } catch {
      // Verificação é auxiliar — se falhar, não trava o cadastro.
    } finally {
      setEmailChecking(false);
    }
  };

  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: emptyDefaults(),
  });

  // useWatch (não form.watch) garante re-render confiável de campos aninhados —
  // sem isso a UF "trava" e o município selecionado não reflete na tela.
  const cpfValue = useWatch({ control: form.control, name: "cpf_cnpj" }) || "";
  const cpfDigits = sanitizeCpfCnpj(cpfValue);
  const isPF = cpfDigits.length !== 14;
  // UF selecionada governa a lista de municípios.
  const selectedUf = (useWatch({ control: form.control, name: "address.state" }) || "") as string;
  const { data: municipios, isLoading: loadingMunicipios } = useMunicipios(selectedUf);

  useEffect(() => {
    if (!open) return;
    setEmailWarn(null);
    setEmailSuggestion(null);
    if (mode === "edit" && client) {
      form.reset({
        full_name: client.full_name,
        cpf_cnpj: formatCpfCnpj(client.cpf_cnpj ?? ""),
        rg: client.rg ? formatRg(client.rg) : "",
        tipo: client.tipo ?? "",
        email: client.email ?? "",
        phone: client.phone ? formatPhone(client.phone) : "",
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
      // S1-08: falha/timeout do lookup de CEP NÃO trava o cadastro. Degradar para
      // preenchimento manual com aviso não-fatal — os campos de endereço seguem
      // editáveis e o save conclui normalmente.
      const detalhe = err instanceof CepError ? ` (${err.message})` : "";
      toast.warning(
        `Não foi possível buscar o endereço pelo CEP — preencha manualmente${detalhe}.`,
      );
    } finally {
      setCepLoading(false);
    }
  };

  const onSubmit = async (data: ClientCreateInput) => {
    // Valida campos customizados obrigatórios (fora do alcance do zodResolver).
    const missing = missingRequiredCustom(
      activeFieldDefs,
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
        // S1-04: find-or-create — reutiliza a pessoa se o CPF já existir (ativo)
        // em vez de estourar erro de unicidade; nunca sobrescreve dados existentes.
        const res = await createMutation.mutateAsync(data);
        const created = res.client;
        if (!res.created) {
          toast.info("CPF já cadastrado — reutilizando o cadastro existente.");
        } else if (created.drive_sync_failed) {
          toast.warning(
            "Cliente criado, mas a pasta no Drive falhou — tente sincronizar na ficha.",
          );
        } else {
          toast.success("Cliente criado com pasta no Drive");
        }
        if (res.conflitos.length > 0) {
          toast.warning(
            `Dados divergentes mantidos do cadastro existente: ${res.conflitos
              .map((c) => c.campo)
              .join(", ")}. Edite na ficha se precisar corrigir.`,
          );
        }
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg);
    }
  };

  // Município: garante que o valor atual apareça mesmo antes da lista carregar.
  const cityValue = (useWatch({ control: form.control, name: "address.city" }) || "") as string;
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
                      <Input
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        disabled={mode === "edit"}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
                      />
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
                          placeholder="12.345.678-9"
                          disabled={mode === "edit" && !!client?.rg}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(formatRg(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {isPF && (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="professional_data.rg_orgao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Órgão emissor do RG</FormLabel>
                      <FormControl>
                        <Input placeholder="SSP/BA" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="professional_data.estado_civil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado civil</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="solteira / casado / ..."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

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
                        onBlur={() => {
                          field.onBlur();
                          void handleEmailCheck();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    {emailChecking && (
                      <p className="text-[11px] text-muted-foreground">Verificando e-mail…</p>
                    )}
                    {emailWarn && <p className="text-[11px] text-amber-600">{emailWarn}</p>}
                    {emailSuggestion && (
                      <button
                        type="button"
                        className="text-[11px] text-[var(--gold-700)] hover:underline"
                        onClick={() => {
                          form.setValue("email", emailSuggestion, { shouldValidate: true });
                          setEmailSuggestion(null);
                          setEmailWarn(null);
                        }}
                      >
                        Usar {emailSuggestion}
                      </button>
                    )}
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
                      <Input
                        placeholder="(82) 99999-9999"
                        inputMode="numeric"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(formatPhone(e.target.value))}
                      />
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
                        inputMode="numeric"
                        maxLength={9}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(formatCep(e.target.value))}
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
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                        value={field.value || "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="__none__">—</SelectItem>
                          {ESPECIALIDADES.map((e) => (
                            <SelectItem key={e} value={e}>
                              {e}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Formação, FIES e Residência (Hyago 2) — persistido em professional_data */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Formação, FIES e Residência
              </p>

              <datalist id="instituicoes-graduacao">
                {INSTITUICOES_GRADUACAO.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
              <datalist id="hospitais-residencia">
                {HOSPITAIS_RESIDENCIA.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="professional_data.instituicao_graduacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instituição de graduação</FormLabel>
                      <FormControl>
                        <Input
                          list="instituicoes-graduacao"
                          placeholder="Ex.: UFBA"
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
                  name="professional_data.ano_formatura"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano de formatura</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="2018"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="professional_data.fies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FIES</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                        value={field.value || "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="professional_data.fies_contrato_numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº do contrato FIES</FormLabel>
                      <FormControl>
                        <Input placeholder="Contrato FIES" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="professional_data.fies_contrato_obs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dados do contrato FIES (observações)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Instituição financeira, valor, situação…"
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
                  name="professional_data.residencia_hospital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residência — hospital</FormLabel>
                      <FormControl>
                        <Input
                          list="hospitais-residencia"
                          placeholder="Hospital de residência"
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
                  name="professional_data.residencia_especialidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residência — especialidade</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                        value={field.value || "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="__none__">—</SelectItem>
                          {ESPECIALIDADES.map((e) => (
                            <SelectItem key={e} value={e}>
                              {e}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="professional_data.residencia_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residência — início</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="professional_data.residencia_termino"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residência — término</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Campos customizados (Melhoria 1) — definidos pelo admin */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <CustomFieldsSection defs={activeFieldDefs} control={form.control as any} />

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
