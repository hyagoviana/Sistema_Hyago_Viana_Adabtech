import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createTemaFieldDefFn,
  deleteTemaFieldDefFn,
  listTemaFieldDefsAdminFn,
  listTemaFieldDefsFn,
  updateTemaFieldDefFn,
} from "@/rpc/tema-field-defs";

export type TemaFieldType = "text" | "select" | "money" | "number" | "date";

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
