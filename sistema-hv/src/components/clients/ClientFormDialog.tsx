import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { useCreateClient, useUpdateClient } from "@/hooks/useClients";
import { useCreateCase } from "@/hooks/useCases";
import { useServiceTypes } from "@/hooks/usePipeline";
import type { Database } from "@/lib/supabase/types";
import {
  clientCreateSchema,
  PROGRAMA_LABELS,
  PROGRAMAS_GOVERNAMENTAIS,
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

function pickAddress(address: Client["address"]): { city?: string; state?: string } {
  if (!address || typeof address !== "object" || Array.isArray(address)) return {};
  const a = address as Record<string, unknown>;
  return {
    city: typeof a.city === "string" ? a.city : undefined,
    state: typeof a.state === "string" ? a.state : undefined,
  };
}

type Programa = (typeof PROGRAMAS_GOVERNAMENTAIS)[number];

const EMPTY_PROFESSIONAL = {
  crm_numero: "",
  crm_uf: "",
  oab_numero: "",
  oab_uf: "",
  vinculo_institucional: "",
  especialidade: "",
  programas: [] as Programa[],
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
    programas: Array.isArray(p.programas)
      ? (p.programas.filter((x): x is Programa =>
          (PROGRAMAS_GOVERNAMENTAIS as readonly string[]).includes(x as string),
        ) as Programa[])
      : [],
    observacoes: str("observacoes"),
  };
}

export function ClientFormDialog({ open, onOpenChange, mode, client }: Props) {
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const createCaseMutation = useCreateCase();
  const { data: serviceTypes } = useServiceTypes();
  const [linkedCaseType, setLinkedCaseType] = useState("");
  const isLoading = createMutation.isPending || updateMutation.isPending || createCaseMutation.isPending;

  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: {
      full_name: "",
      cpf_cnpj: "",
      tipo: "",
      email: "",
      phone: "",
      address: {},
      professional_data: { ...EMPTY_PROFESSIONAL },
    },
  });

  useEffect(() => {
    if (!open) return;
    setLinkedCaseType("");
    if (mode === "edit" && client) {
      const addr = pickAddress(client.address);
      form.reset({
        full_name: client.full_name,
        cpf_cnpj: client.cpf_cnpj,
        tipo: client.tipo ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        address: { city: addr.city ?? "", state: addr.state ?? "" },
        professional_data: pickProfessional(client.professional_data),
      });
    } else {
      form.reset({
        full_name: "",
        cpf_cnpj: "",
        tipo: "",
        email: "",
        phone: "",
        address: {},
        professional_data: { ...EMPTY_PROFESSIONAL },
      });
    }
  }, [open, mode, client, form]);

  const onSubmit = async (data: ClientCreateInput) => {
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
        // Cria caso vinculado se um tipo foi selecionado
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Atualize os dados do cliente. CPF/CNPJ não pode ser editado por segurança."
              : "Cadastro mínimo — uma pasta no Google Drive é criada automaticamente."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Maria da Silva" {...field} />
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
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
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(82) 99999-9999" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-[1fr,80px] gap-3">
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Município</FormLabel>
                    <FormControl>
                      <Input placeholder="Maceió" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl>
                      <Input placeholder="AL" maxLength={2} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dados profissionais — atributos estruturados (P1 item 1) */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dados profissionais
              </p>

              <div className="grid grid-cols-[1fr_72px] gap-3">
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
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input placeholder="AL" maxLength={2} {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-[1fr_72px] gap-3">
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
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input placeholder="AL" maxLength={2} {...field} value={field.value ?? ""} />
                      </FormControl>
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

              <div>
                <p className="text-sm font-medium leading-none">Programas governamentais</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {PROGRAMAS_GOVERNAMENTAIS.map((p) => {
                    const selected = form.watch("professional_data.programas") ?? [];
                    return (
                      <label
                        key={p}
                        className="flex items-center gap-2 text-sm text-[var(--navy)] cursor-pointer"
                      >
                        <Checkbox
                          checked={selected.includes(p)}
                          onCheckedChange={(v) => {
                            const cur = form.getValues("professional_data.programas") ?? [];
                            const next = v ? [...cur, p] : cur.filter((x) => x !== p);
                            form.setValue("professional_data.programas", next, {
                              shouldDirty: true,
                            });
                          }}
                        />
                        {PROGRAMA_LABELS[p]}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

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
