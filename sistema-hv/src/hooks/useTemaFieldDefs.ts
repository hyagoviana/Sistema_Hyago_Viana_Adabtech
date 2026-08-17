import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createTemaFieldDefFn,
  deleteTemaFieldDefFn,
  listTemaFieldDefsAdminFn,
  listTemaFieldDefsFn,
  updateTemaFieldDefFn,
} from "@/rpc/tema-field-defs";

export type TemaFieldType =
  | "text"
  | "select"
  | "multiselect"
  | "money"
  | "number"
  | "date"
  | "boolean"
  | "link";

// Origem do VALOR do campo: 'caso' → system_cases.canonical_fields (por caso);
// 'cliente' → system_clients.custom_fields (compartilhado entre casos do cliente).
export type TemaFieldScope = "caso" | "cliente";

export type TemaFieldDef = {
  id: string;
  tema_id: string;
  frente_slug: string | null;
  key: string;
  label: string;
  type: string;
  options: unknown;
  ordem: number;
  required: boolean;
  active: boolean;
  // Reunião 2026-07-29: origem (#3), ocultar só na lista (#5), nº de ocorrências (#6).
  scope: TemaFieldScope;
  hidden_in_list: boolean;
  // A2 (2026-08-03): oculta a def do PAINEL DE FILTROS (lista + Kanban) sem tirar
  // da ficha nem da coluna da lista. Independente de active/hidden_in_list.
  hidden_in_filters: boolean;
  max_occurrences: number;
  // A5 (2026-08-05): nº de LINHAS mostradas de largada no campo multi-linha (<= teto).
  // O usuário adiciona mais com o botão "+" até `max_occurrences`.
  initial_occurrences: number;
  // A5 5c (2026-08-03): CHECKBOX de auto-avanço. Quando type='boolean' e este slug
  // está setado, marcar "Sim" na ficha MOVE o caso para essa etapa op. NULL = não move.
  move_to_stage_slug: string | null;
  // A4 (2026-08-05): campo PAI de quem este depende (mesmo tema/frente). NULL = sem
  // dependência. Na ficha, o filho só edita quando o valor do pai está preenchido.
  parent_field_def_id: string | null;
  // #8 (2026-08-17): subtítulo por linha (multi-ocorrência). 'auto' = rótulo
  // enumerado; 'custom' = textos em `subtitles`; NULL = sem subtítulo.
  subtitle_mode: string | null;
  subtitles: string[];
};

// FICHA do caso — defs do tema (frente NULL) + as da frente do caso, ordenadas.
export function useTemaFieldDefs(temaId: string | null | undefined, frenteSlug?: string | null) {
  const fn = useServerFn(listTemaFieldDefsFn);
  return useQuery({
    queryKey: ["tema-field-defs", temaId, frenteSlug ?? null],
    queryFn: () => fn({ data: { temaId: temaId as string, frenteSlug: frenteSlug ?? null } }),
    enabled: !!temaId,
    staleTime: 5 * 60 * 1000,
  });
}

// UI ADMIN — todas as defs do tema (ou de uma frente). `frenteSlug`:
// undefined = todas; null = só padrão do tema; string = só a frente.
export function useTemaFieldDefsAdmin(
  temaId: string | null | undefined,
  frenteSlug?: string | null,
) {
  const fn = useServerFn(listTemaFieldDefsAdminFn);
  return useQuery({
    queryKey: ["tema-field-defs-admin", temaId, frenteSlug ?? "ALL"],
    queryFn: () =>
      fn({
        data: {
          temaId: temaId as string,
          ...(frenteSlug === undefined ? {} : { frenteSlug }),
        },
      }),
    enabled: !!temaId,
    staleTime: 60 * 1000,
  });
}

function useInvalidateFieldDefs(temaId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["tema-field-defs", temaId] });
    qc.invalidateQueries({ queryKey: ["tema-field-defs-admin", temaId] });
  };
}

export function useCreateTemaFieldDef(temaId: string) {
  const fn = useServerFn(createTemaFieldDefFn);
  const invalidate = useInvalidateFieldDefs(temaId);
  return useMutation({
    mutationFn: (input: {
      frenteSlug?: string | null;
      key?: string;
      label: string;
      type: TemaFieldType;
      options?: string[] | null;
      ordem?: number;
      required?: boolean;
      scope?: "caso" | "cliente";
      hiddenInList?: boolean;
      hiddenInFilters?: boolean;
      maxOccurrences?: number;
      // A5 (2026-08-05) — nº de linhas mostradas de largada (<= teto).
      initialOccurrences?: number;
      // #8 (2026-08-17) — subtítulo por linha (multi-ocorrência).
      subtitleMode?: string | null;
      subtitles?: string[];
      moveToStageSlug?: string | null;
      // A4 (2026-08-05) — campo pai (dependência); null = sem dependência.
      parentFieldDefId?: string | null;
      // A7 (2026-08-05) — libera a checagem do balde compartilhado do cliente.
      allowSharedClientKey?: boolean;
    }) => fn({ data: { temaId, ...input } }),
    onSuccess: invalidate,
  });
}

export function useUpdateTemaFieldDef(temaId: string) {
  const fn = useServerFn(updateTemaFieldDefFn);
  const invalidate = useInvalidateFieldDefs(temaId);
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: {
        label?: string;
        type?: TemaFieldType;
        options?: string[] | null;
        ordem?: number;
        required?: boolean;
        active?: boolean;
        scope?: "caso" | "cliente";
        hiddenInList?: boolean;
        hiddenInFilters?: boolean;
        maxOccurrences?: number;
        // A5 (2026-08-05) — nº de linhas mostradas de largada (<= teto).
        initialOccurrences?: number;
        // #8 (2026-08-17) — subtítulo por linha (multi-ocorrência).
        subtitleMode?: string | null;
        subtitles?: string[];
        moveToStageSlug?: string | null;
        // A4 (2026-08-05) — reatribui/remove a dependência pai (null = remove).
        parentFieldDefId?: string | null;
        // A7 (2026-08-05) — libera a checagem do balde compartilhado do cliente.
        allowSharedClientKey?: boolean;
      };
    }) => fn({ data: vars }),
    onSuccess: invalidate,
  });
}

export function useDeleteTemaFieldDef(temaId: string) {
  const fn = useServerFn(deleteTemaFieldDefFn);
  const invalidate = useInvalidateFieldDefs(temaId);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}
