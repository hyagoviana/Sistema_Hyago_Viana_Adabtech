import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createTypeFolderFn,
  linkTypeFolderFn,
  listProcuracaoFolderIdsFn,
  listRootModelFoldersFn,
  listTypeFoldersFn,
  unlinkTypeFolderFn,
} from "@/rpc/service-type-folders";

export type FolderKind = "caso" | "procuracao";

export type DriveFolderOption = { id: string; name: string; url: string };

// T3 — subpastas existentes na raiz de "modelos"/"procuração" (para vincular ao
// tema). `enabled` (default true) permite adiar a chamada ao Drive se preciso.
export function useRootModelFolders(kind: FolderKind, enabled = true) {
  const fn = useServerFn(listRootModelFoldersFn);
  return useQuery({
    queryKey: ["root-model-folders", kind],
    queryFn: () => fn({ data: { kind } }) as Promise<DriveFolderOption[]>,
    enabled,
    staleTime: 60 * 1000,
  });
}

// S2-04 — pastas de onde tirar modelo de contrato/procuração. Fonte única: a
// categoria "CONTRATO E PROCURAÇÃO" de cada tipo MAIS os vínculos de procuração
// legados. Antes cada tela derivava isso de `useTypeFolders(id, "procuracao")`,
// que só enxerga o legado — com a estrutura nova, o popup ficaria vazio.
export function useProcuracaoFolderIds(serviceTypeId: string | null | undefined) {
  const fn = useServerFn(listProcuracaoFolderIdsFn);
  return useQuery({
    queryKey: ["procuracao-folder-ids", serviceTypeId ?? "none"],
    queryFn: () => fn({ data: { serviceTypeId: serviceTypeId! } }) as Promise<string[]>,
    enabled: !!serviceTypeId,
    staleTime: 60 * 1000,
  });
}

export type ServiceTypeFolder = {
  id: string;
  service_type_id: string;
  kind: FolderKind;
  drive_folder_id: string;
  name: string;
  ordem: number;
  frente_slug: string | null;
  // S2-04 — estrutura MODELOS/{3 categorias} dentro da pasta do TIPO.
  // NULL = tipo ainda sem a estrutura nova (o fluxo antigo assume).
  drive_modelos_folder_id: string | null;
  drive_judicial_folder_id: string | null;
  drive_contrato_folder_id: string | null;
  drive_administrativo_folder_id: string | null;
};

// S2-04 — as três categorias de modelo definidas pelo Thiago. Fixas: são pastas
// com nome literal no Drive, não uma lista configurável.
export const CATEGORIAS_MODELO = [
  { id: "judicial", rotulo: "Documento judicial", campo: "drive_judicial_folder_id" },
  { id: "contrato", rotulo: "Contrato e procuração", campo: "drive_contrato_folder_id" },
  {
    id: "administrativo",
    rotulo: "Documento administrativo",
    campo: "drive_administrativo_folder_id",
  },
] as const;

export type CategoriaModelo = (typeof CATEGORIAS_MODELO)[number]["id"];

export function pastaDaCategoria(
  folder: ServiceTypeFolder | undefined,
  categoria: CategoriaModelo,
): string | null {
  if (!folder) return null;
  const campo = CATEGORIAS_MODELO.find((c) => c.id === categoria)!.campo;
  return (folder[campo] as string | null) ?? null;
}

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
      /** Subpasta de destino dentro do tipo. Sem ela o arquivo cairia na raiz,
       *  onde a geração de documento não procura. */
      categoria: CategoriaModelo;
    }) => {
      const body = new FormData();
      body.append("file", vars.file);
      body.append("kind", vars.kind);
      body.append("folderId", vars.folderId);
      body.append("categoria", vars.categoria);
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
