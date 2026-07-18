import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createTypeFolderFn,
  linkTypeFolderFn,
  listTypeFoldersFn,
  unlinkTypeFolderFn,
} from "@/rpc/service-type-folders";

export type FolderKind = "caso" | "procuracao";

export type ServiceTypeFolder = {
  id: string;
  service_type_id: string;
  kind: FolderKind;
  drive_folder_id: string;
  name: string;
  ordem: number;
  frente_slug: string | null;
};

// Lista as pastas de uma categoria (opcionalmente filtrando por kind).
// `frenteSlug` (R2-04): passe a frente do CASO p/ ver pastas da frente + comuns.
// `undefined` (padrão, ex.: editor de vínculo) = todas as pastas do tema.
export function useTypeFolders(
  serviceTypeId: string | null | undefined,
  kind?: FolderKind,
  frenteSlug?: string | null,
) {
  const fn = useServerFn(listTypeFoldersFn);
  return useQuery({
    queryKey: [
      "service-type-folders",
      serviceTypeId ?? "none",
      kind ?? "all",
      frenteSlug === undefined ? "all-frentes" : (frenteSlug ?? "no-frente"),
    ],
    queryFn: () =>
      fn({ data: { serviceTypeId: serviceTypeId!, kind, frenteSlug } }) as Promise<
        ServiceTypeFolder[]
      >,
    enabled: !!serviceTypeId,
    staleTime: 60 * 1000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["service-type-folders"] });
  qc.invalidateQueries({ queryKey: ["document-templates"] });
}

// Cria uma pasta NOVA no Drive e vincula à categoria.
// `frenteSlug` (R2-04, opcional): vincula a pasta só a uma frente do tema.
export function useCreateTypeFolder() {
  const fn = useServerFn(createTypeFolderFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      serviceTypeId: string;
      kind: FolderKind;
      name: string;
      frenteSlug?: string | null;
    }) => fn({ data: vars }),
    onSuccess: () => invalidate(qc),
  });
}

// Vincula uma pasta EXISTENTE (id do Drive) à categoria.
export function useLinkTypeFolder() {
  const fn = useServerFn(linkTypeFolderFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      serviceTypeId: string;
      kind: FolderKind;
      driveFolderId: string;
      name: string;
      frenteSlug?: string | null;
    }) => fn({ data: vars }),
    onSuccess: () => invalidate(qc),
  });
}

export function useUnlinkTypeFolder() {
  const fn = useServerFn(unlinkTypeFolderFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => invalidate(qc),
  });
}

// Upload de um modelo Word para uma pasta da categoria (multipart → API route).
export function useUploadTypeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      serviceTypeId: string;
      kind: FolderKind;
      folderId: string;
      file: File;
    }) => {
      const body = new FormData();
      body.append("file", vars.file);
      body.append("kind", vars.kind);
      body.append("folderId", vars.folderId);
      const res = await fetch(`/api/service-types/${vars.serviceTypeId}/templates/upload`, {
        method: "POST",
        body,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha no upload do modelo");
      return json;
    },
    onSuccess: () => invalidate(qc),
  });
}
