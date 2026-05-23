import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { Database } from "@/lib/supabase/types";
import { clientCreateSchema, type ClientCreateInput } from "@/lib/validators/client";

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

export function ClientFormDialog({ open, onOpenChange, mode, client }: Props) {
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: {
      full_name: "",
      cpf_cnpj: "",
      tipo: "",
      email: "",
      phone: "",
      address: {},
    },
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && client) {
      const addr = pickAddress(client.address);
      form.reset({
        full_name: client.full_name,
        cpf_cnpj: client.cpf_cnpj,
        tipo: client.tipo ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        address: { city: addr.city ?? "", state: addr.state ?? "" },
      });
    } else {
      form.reset({
        full_name: "",
        cpf_cnpj: "",
        tipo: "",
        email: "",
        phone: "",
        address: {},
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
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
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
