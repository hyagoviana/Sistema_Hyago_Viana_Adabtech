// M3 (2026-08-07) — SUBMENU DOCUMENTOS do caso (aba no topo, ao lado de Judicial).
// Antes o CaseDocumentsTab ficava como bloco no FIM da ficha (casos.$id.index.tsx)
// e "virava bagunça com muito documento". Aqui ele passa a ser uma página própria.
//
// O `docAutoFill` (usado pelo CaseDocumentsTab para pré-preencher os modelos) é
// reconstruído aqui do jeito idêntico ao da ficha — a geração de documentos NÃO é
// gate-ada por financeiro; qualquer pessoa que gere doc precisa do autofill.

import { createFileRoute, useParams } from "@tanstack/react-router";

import { CaseDocumentsTab } from "@/components/cases/CaseDocumentsTab";
import { Skeleton } from "@/components/ui/skeleton";
import { usePodeEditar } from "@/hooks/usePermissions";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";
import { useClient } from "@/hooks/useClients";
import { useMunicipios, usePerfis } from "@/hooks/useReferencias";
import {
  augmentWithHonorarios,
  augmentWithMunicipio,
  augmentWithPerfil,
  augmentWithResponsaveis,
  buildAutoFillFromClient,
} from "@/lib/cases/document-autofill";
import { useCaseHonorarios } from "@/hooks/useTermo";
import { useCase, useCaseResponsaveis } from "@/hooks/useCases";

export const Route = createFileRoute("/casos/$id/documentos")({
  component: CasoDocumentos,
});

function CasoDocumentos() {
  const { id } = useParams({ from: "/casos/$id/documentos" });
  const { data: caso, isLoading } = useCase(id);
  const { data: cliente } = useClient(caso?.client_id ?? "");
  const { data: municipios } = useMunicipios();
  const { data: perfis } = usePerfis();
  const { data: honorarios } = useCaseHonorarios(id);
  const { data: responsaveis } = useCaseResponsaveis(id);
  const podeGerirCaso = usePodeEditar("operacional");

  useDocumentTitle(
    `${resolveEntityLabel(caso?.case_code, { notFoundLabel: "Caso" })} · Documentos`,
  );

  if (isLoading || !caso) {
    return (
      <div className="page-container">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // docAutoFill idêntico ao da ficha (casos.$id.index.tsx).
  let docAutoFill = buildAutoFillFromClient(cliente ?? {}, caso);
  const municipioRow = (municipios ?? []).find(
    (m) => m.nome.trim().toLowerCase() === (caso.municipio ?? "").trim().toLowerCase(),
  );
  docAutoFill = augmentWithMunicipio(docAutoFill, municipioRow);
  const perfilNum = Object.entries(docAutoFill.canonical ?? {}).find(
    ([k]) => /perfil/i.test(k) && !/informa/i.test(k),
  )?.[1];
  const perfilRow = perfilNum
    ? (perfis ?? []).find((p) => p.nome.trim().toLowerCase() === perfilNum.trim().toLowerCase())
    : undefined;
  docAutoFill = augmentWithPerfil(docAutoFill, perfilRow);
  docAutoFill = augmentWithHonorarios(docAutoFill, honorarios);
  docAutoFill = augmentWithResponsaveis(docAutoFill, responsaveis);

  // podeGerirCaso não é consumido diretamente pelo CaseDocumentsTab hoje, mas o
  // mantemos calculado para paridade e futuros gates; evita warning de var não usada.
  void podeGerirCaso;

  return (
    <div className="page-container">
      <CaseDocumentsTab
        caseId={caso.id}
        caseType={caso.case_type}
        frenteSlug={caso.frente_slug}
        temaId={(caso as { tema_id?: string | null }).tema_id ?? null}
        clientId={caso.client_id}
        canonicalFields={
          (caso as { canonical_fields?: Record<string, unknown> | null }).canonical_fields ?? null
        }
        clientName={cliente?.full_name}
        clientCpf={cliente?.cpf_cnpj}
        municipio={caso.municipio ?? undefined}
        autoFillExtra={docAutoFill}
      />
    </div>
  );
}
