import { Download } from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { TARGET_FIELDS, type TargetFieldDef } from "@/lib/validators/import";

type Props = {
  extraFields?: TargetFieldDef[];
  temaName?: string;
};

// Dados de exemplo para cada campo
const EXAMPLES: Record<string, string[]> = {
  full_name: ["Maria Silva Santos", "Joao Pedro Oliveira", "Ana Carolina Lima"],
  cpf_cnpj: ["123.456.789-00", "987.654.321-00", "111.222.333-44"],
  rg: ["12.345.678-9", "98.765.432-1", "11.222.333-4"],
  birth_date: ["15/03/1990", "22/07/1985", "01/12/1995"],
  email: ["maria@email.com", "joao@email.com", "ana@email.com"],
  phone: ["(11) 99999-0001", "(21) 98888-0002", "(31) 97777-0003"],
  tipo: ["Pessoa Fisica", "Pessoa Fisica", "Pessoa Juridica"],
  "address.street": ["Rua das Flores", "Av Brasil", "Rua XV de Novembro"],
  "address.number": ["123", "456", "789"],
  "address.complement": ["Apto 101", "", "Sala 5"],
  "address.neighborhood": ["Centro", "Copacabana", "Boa Vista"],
  "address.city": ["Sao Paulo", "Rio de Janeiro", "Curitiba"],
  "address.state": ["SP", "RJ", "PR"],
  "address.zipcode": ["01001-000", "22041-080", "80060-000"],
  "professional_data.crm_numero": ["123456", "789012", "345678"],
  "professional_data.crm_uf": ["SP", "RJ", "PR"],
  "professional_data.especialidade": ["Clinica Geral", "Pediatria", "Cardiologia"],
  "professional_data.instituicao_graduacao": ["USP", "UFRJ", "UFPR"],
  "professional_data.ano_formatura": ["2015", "2018", "2020"],
  "professional_data.observacoes": ["", "", ""],
  case_type: ["MAIS_MEDICOS", "FIES_ESF", "COVID"],
  municipio: ["Sao Paulo - SP", "Rio de Janeiro - RJ", "Curitiba - PR"],
  proximo_passo: ["Aguardando documentos", "Em analise", "Manifestacao"],
  responsavel: ["Dr. Fulano", "Dra. Ciclana", "Dr. Beltrano"],
  observacoes: ["Caso urgente", "", "Recontratacao"],
};

export function DownloadTemplate({ extraFields = [], temaName }: Props) {
  const handleDownload = () => {
    const allFields = [...TARGET_FIELDS, ...extraFields];

    // Cabecalhos
    const headers = allFields.map((f) => {
      let col = f.label;
      if (f.required) col += " *";
      return col;
    });

    // 3 linhas de exemplo
    const rows: string[][] = [];
    for (let r = 0; r < 3; r++) {
      const row: string[] = [];
      for (const f of allFields) {
        const examples = EXAMPLES[f.key];
        if (examples) {
          row.push(examples[r] ?? "");
        } else {
          // Campo custom do tema — exemplo generico
          if (f.fieldType === "multiselect") {
            row.push(r === 0 ? "opcao1; opcao2" : "opcao1");
          } else if (f.fieldType === "boolean" || f.fieldType === "sim/nao") {
            row.push(r === 0 ? "Sim" : "Nao");
          } else if (f.fieldType === "date") {
            row.push("01/01/2025");
          } else if (f.fieldType === "money") {
            row.push("1500.00");
          } else if (f.fieldType === "select") {
            row.push("(preencher)");
          } else {
            row.push("");
          }
        }
      }
      rows.push(row);
    }

    // Montar planilha
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajustar largura das colunas
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 18) }));

    const wb = XLSX.utils.book_new();
    const sheetName = temaName ? `Modelo - ${temaName}`.slice(0, 31) : "Modelo importacao";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Aba de instrucoes
    const instrucoes = [
      ["INSTRUCOES DE PREENCHIMENTO"],
      [""],
      ["1. Preencha os dados seguindo o exemplo das primeiras linhas"],
      ["2. Campos com * sao obrigatorios (Nome e obrigatorio, CPF e opcional)"],
      ["3. Apague as linhas de exemplo antes de importar"],
      ["4. Salve como .xlsx, .csv ou .ods"],
      [""],
      ["FORMATOS ESPERADOS:"],
      ["Campo", "Formato", "Exemplo"],
      ["CPF", "000.000.000-00 ou so numeros", "12345678900"],
      ["CNPJ", "00.000.000/0000-00 ou so numeros", "12345678000100"],
      ["Telefone", "(00) 00000-0000", "(11) 99999-0001"],
      ["Data", "DD/MM/AAAA", "25/12/2024"],
      ["CEP", "00000-000", "01001-000"],
      ["UF", "Sigla de 2 letras", "SP"],
      ["Multipla escolha", "Valores separados por ;", "valor1; valor2; valor3"],
      [""],
      ["DICAS:"],
      ["- Se nao tem CPF, deixe em branco — o sistema gera um codigo temporario"],
      ["- E-mail e telefone em branco serao preenchidos com valores padrao"],
      ["- Endereco em branco sera preenchido com 'A definir'"],
      ["- Ao importar, selecione a Pipeline/Tema para criar o caso automaticamente"],
    ];
    const wsInstrucoes = XLSX.utils.aoa_to_sheet(instrucoes);
    wsInstrucoes["!cols"] = [{ wch: 30 }, { wch: 40 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, "Instrucoes");

    // Download
    const fileName = temaName
      ? `modelo-importacao-${temaName.toLowerCase().replace(/\s+/g, "-")}.xlsx`
      : "modelo-importacao.xlsx";
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
      <Download size={14} />
      Baixar modelo de planilha
    </Button>
  );
}
