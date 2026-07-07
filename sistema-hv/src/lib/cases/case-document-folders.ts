// ITEM 4 (2026-07-07) — as 6 PASTAS do Drive que alimentam o caminho
// "Documento de caso" do popup de geração. O usuário escolhe 1 destas 6 pastas
// (passo 1) e só então vê os documentos daquela pasta (passo 2). Só os docs
// dessas pastas podem aparecer nesse caminho.
//
// O `label` é o NOME REAL da pasta no Drive (lido via Drive API em 2026-07-07),
// só com trim no espaço final. Se o owner renomear/adicionar pastas, ajuste aqui
// (id) e rode o sync (syncCaseDocumentFoldersFn).
export type CaseDocumentFolder = {
  id: string;
  label: string;
};

export const CASE_DOCUMENT_FOLDERS: CaseDocumentFolder[] = [
  { id: "16ySv_cUciMNT9_YzrtAAsp8OwTReYRmI", label: "01- Abatimento ESF DGM" },
  { id: "1AQjL14THUGA5MyJ_9JXB8c4a2OTLGIAL", label: "02- Abatimento ESF Censo 05" },
  { id: "1NJ8OYXhn2ZhScyGfyiLbJjQpLh0zDdiq", label: "03- Abatimento ESF Portaria" },
  { id: "1cxylOE61H2PuMI-cii2b5Vn-Dh4pIoLI", label: "04- Abatimento Militar" },
  { id: "1NHISSQSsq17Jvlg5D-NqOnhHUgI4K4mL", label: "05- Abatimento COVID" },
  { id: "1vnyy0FbIyH4r_4H1xS5FA4jv1yY1-WW_", label: "06- Emails de cobrança" },
];

export const CASE_DOCUMENT_FOLDER_IDS = CASE_DOCUMENT_FOLDERS.map((f) => f.id);
