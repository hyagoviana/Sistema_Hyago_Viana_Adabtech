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
import { useCreateCase } from "@/hooks/useCases";
import { useServiceTypes } from "@/hooks/usePipeline";
import { useTemas, useTemaServiceType } from "@/hooks/useTemas";
import { useTypeFolders } from "@/hooks/useServiceTypeFolders";
import { useAssignableUsers } from "@/hooks/useUsers";
import { useAuth } from "@/lib/auth";
import { isAdvogado, ROLE_LABELS, type Role } from "@/lib/rbac";
import { caseCreateSchema, type CaseCreateInput } from "@/lib/validators/case";

// Caso recém-criado devolvido ao chamador (para abrir a geração de documentos
// do tema logo em seguida — escolher pasta/documento de caso e procuração).
export type CreatedCaseLite = {
  id: string;
  case_type: string;
  frente_slug: string | null;
  /** Tema do caso — usado no pop-up de filtros pós-Word (R2-09). */
  tema_id?: string | null;
  case_code?: string;
  municipio?: string | null;
  /** Pasta de caso (drive_folder_id) escolhida na criação — pula a etapa de
   *  seleção de pasta no fluxo de geração de documentos. */
  casoFolderId?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetClientId?: string;
  // Cadastro exclusivo (2026-07-19) — a "situação inicial" do caso NÃO é mais
  // escolhida no popup (era redundante): ela é derivada do estado do CADASTRO.
  // Cadastro já é CLIENTE → o caso nasce direto no Operacional; cadastro é LEAD
  // → nasce no Comercial (aguardando assinatura).
  clienteEhCliente?: boolean;
  // Chamado após criar o caso, para o chamador abrir a geração de documentos
  // (pasta de casos/procurações do tema → documento → variáveis → Word → ZapSign).
  onCreated?: (created: CreatedCaseLite) => void;
};

// Novo caso — ITEM 5 (2026-07-06): o caso NÃO entra direto no operacional. Ele
// nasce no COMERCIAL (aguardando assinatura): o Kanban operacional esconde casos
// com `aguardando_assinatura_at` e o card aparece no board Comercial. A entrada no
// operacional acontece por assinatura (webhook/manual) OU pelo botão "Enviar para
// operacional" no board Comercial. O contrato/procuração e o envio ao ZapSign
// ficam na ficha do caso.
export function CaseFormDialog({
  open,
  onOpenChange,
  presetClientId,
  clienteEhCliente,
  onCreated,
}: Props) {
  const { data: clients } = useClientsList();
  const { data: serviceTypes } = useServiceTypes();
  // R2-05 — TEMA→FRENTE é o fluxo principal quando há temas cadastrados. Categorias
  // legadas (service_types sem tema) continuam como fallback.
  const { data: temas } = useTemas();
  const { data: users } = useAssignableUsers();
  const { profile, role } = useAuth();
  const create = useCreateCase();
  const [clientPopOpen, setClientPopOpen] = useState(false);
  const [respPopOpen, setRespPopOpen] = useState(false);
  // Tema selecionado (dirige o select de frente e o dual-write). Vazio = usar o
  // caminho legado por categoria (case_type).
  const [temaId, setTemaId] = useState<string>("");
  // Pasta de caso (drive folder) selecionada dentro do tema.
  const [casoFolderId, setCasoFolderId] = useState<string>("");
  const hasTemas = (temas ?? []).length > 0;

  // Resolve o service_type interno do tema para carregar as pastas de caso.
  const selectedTema = (temas ?? []).find((t) => t.id === temaId);
  const temaServiceTypeId =
    (selectedTema as { service_type_id?: string | null } | undefined)?.service_type_id ?? null;
  const { data: casoFolders } = useTypeFolders(temaServiceTypeId, "caso");

  // Responsáveis selecionáveis: advogados (titular/associado) + ADMIN (ajuste A8,
  // 2026-07-20 — o admin deve aparecer no seletor). Só usuários ATIVOS.
  const advogados = (users ?? []).filter(
    (u) => (isAdvogado(u.role as Role) || u.role === "admin") && u.status === "ACTIVE",
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
      setCasoFolderId("");
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
    // T1 (2026-07-19) — com temas cadastrados, o tema é OBRIGATÓRIO (o caso nasce
    // sempre por tema). Sem isso, o default de case_type cairia num tipo legado.
    if (hasTemas && !temaId) {
      toast.error("Selecione um tema para o caso.");
      return;
    }
    // Caso (pasta) obrigatório quando o tema tem pastas vinculadas.
    const folders = casoFolders ?? [];
    if (hasTemas && temaId && folders.length > 0 && !casoFolderId) {
      toast.error("Selecione o caso dentro do tema.");
      return;
    }
    // Resolve o nome da pasta selecionada para gravar no caso.
    const selectedFolder = folders.find((f) => f.drive_folder_id === casoFolderId);
    try {
      const comoCliente = clienteEhCliente === true;
      const created = await create.mutateAsync({
        ...data,
        tema_id: temaId || null,
        caso_pasta_nome: selectedFolder?.name ?? null,
        caso_pasta_drive_id: casoFolderId || null,
        comercial: !comoCliente,
        iniciar_como_cliente: comoCliente,
        procuracao_template_id: undefined,
      });
      toast.success(`Caso ${created.case_code} criado · agora escolha os documentos`);
      onOpenChange(false);
      onCreated?.({
        id: created.id,
        case_type: created.case_type,
        frente_slug: (created as { frente_slug?: string | null }).frente_slug ?? null,
        tema_id: temaId || null,
        case_code: created.case_code,
        municipio: (created as { municipio?: string | null }).municipio ?? null,
        casoFolderId: casoFolderId || null,
      });
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
            Escolha o tema e o caso deste cadastro. Ao criar, você escolhe o documento para gerar. A
            situação (Comercial × Operacional) é definida pelo estado do cadastro.
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
                service_type interno, resolvido no servidor).
                T1 (2026-07-19) — com temas cadastrados, o caso nasce SEMPRE por
                tema: o tema é obrigatório e a "categoria legada" some (o dono só
                quer os temas no seletor). Sem temas, cai no tipo legado (abaixo). */}
            {hasTemas && (
              <div className="space-y-2">
                <Label>Tema *</Label>
                <Select
                  value={temaId}
                  onValueChange={(v) => {
                    setTemaId(v);
                    // Placeholder de case_type (o servidor sobrescreve pelo slug do
                    // service_type interno do tema). Usa o slug do tema p/ passar o
                    // schema (case_type min(1)) e refletir a intenção.
                    const tema = (temas ?? []).find((t) => t.id === v);
                    if (tema) form.setValue("case_type", tema.slug);
                    // Reseta a frente e o caso ao trocar de tema.
                    form.setValue("frente_slug", null);
                    setCasoFolderId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tema" />
                  </SelectTrigger>
                  <SelectContent>
                    {(temas ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seletor de CASO (pasta de caso do tema). Aparece quando o tema
                selecionado tem pastas de caso vinculadas. */}
            {hasTemas && temaId && (casoFolders ?? []).length > 0 && (
              <div className="space-y-2">
                <Label>Caso *</Label>
                <Select value={casoFolderId} onValueChange={(v) => setCasoFolderId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o caso" />
                  </SelectTrigger>
                  <SelectContent>
                    {(casoFolders ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.drive_folder_id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Categoria legada (fallback). SÓ aparece quando NÃO há temas
                cadastrados. Com temas, o caso nasce sempre por TEMA→FRENTE (o dono
                não quer os tipos legados no seletor de criação — T1, 2026-07-19). */}
            {!hasTemas && (
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

            {/* Situação inicial REMOVIDA (2026-07-19) — era redundante: a situação
                do caso é derivada do estado do cadastro (LEAD → Comercial; CLIENTE →
                Operacional). Ver `clienteEhCliente` no onSubmit. */}

            {/* "Próximo passo" REMOVIDO do popup (2026-07-19) — não é necessário na
                criação do caso. Pode ser preenchido depois na ficha do caso. */}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="responsavelIds"
                render={({ field }) => {
                  const selected = (field.value ?? []) as string[];
                  const labelFor = (id: string) => {
                    const a = advogados.find((x) => x.id === id);
                    return a?.full_name || a?.email || "·";
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
                {create.isPending ? "Criando…" : "Criar e escolher documentos"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
