import { faker } from "@faker-js/faker/locale/pt_BR";
faker.seed(42);
faker.setDefaultRefDate("2026-05-15T12:00:00.000Z");

export type CaseType = "FIES_ESF" | "FIES_DGM" | "COVID" | "MAIS_MEDICOS" | "RESIDENCIA" | "CFM_CRM";
export type MacroOp =
  | "ONBOARDING" | "ANALISE" | "CONFERENCIA" | "PRONTO_AJUIZAR" | "EM_ANDAMENTO"
  | "AGUARDANDO_DECISAO" | "IMPLANTADO" | "IMPLANTACAO_PARCIAL" | "ENCERRADO" | "CANCELADO";
export type MacroFin =
  | "ELABORANDO" | "APROVACAO" | "AGUARDANDO_ATIVACAO" | "ATIVO" | "QUITANDO" | "QUITADO"
  | "INADIMPLENTE" | "PARCIAL" | "RENEGOCIADO" | "SUSPENSO" | "CANCELADO";

export const caseTypeLabels: Record<CaseType, string> = {
  FIES_ESF: "FIES ESF",
  FIES_DGM: "FIES DGM",
  COVID: "COVID",
  MAIS_MEDICOS: "Mais Médicos",
  RESIDENCIA: "Residência",
  CFM_CRM: "CFM/CRM",
};

export const macroOpLabels: Record<MacroOp, string> = {
  ONBOARDING: "Onboarding",
  ANALISE: "Análise",
  CONFERENCIA: "Conferência",
  PRONTO_AJUIZAR: "Pronto p/ ajuizar",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_DECISAO: "Aguardando decisão",
  IMPLANTADO: "Implantado",
  IMPLANTACAO_PARCIAL: "Implantação parcial",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
};

export const macroFinLabels: Record<MacroFin, string> = {
  ELABORANDO: "Elaborando",
  APROVACAO: "Aprovação",
  AGUARDANDO_ATIVACAO: "Aguardando ativação",
  ATIVO: "Ativo",
  QUITANDO: "Quitando",
  QUITADO: "Quitado",
  INADIMPLENTE: "Inadimplente",
  PARCIAL: "Parcial",
  RENEGOCIADO: "Renegociado",
  SUSPENSO: "Suspenso",
  CANCELADO: "Cancelado",
};

const types: CaseType[] = ["FIES_ESF", "FIES_DGM", "COVID", "MAIS_MEDICOS", "RESIDENCIA", "CFM_CRM"];
const opStates: MacroOp[] = Object.keys(macroOpLabels) as MacroOp[];
const finStates: MacroFin[] = Object.keys(macroFinLabels) as MacroFin[];

export const casos = Array.from({ length: 180 }, (_, i) => {
  const tipo = faker.helpers.arrayElement(types);
  return {
    id: `case-${i}`,
    codigo: `${tipo.split("_")[0]}-2024-${String(1000 + i).padStart(4, "0")}`,
    clienteNome: faker.person.fullName(),
    clienteId: `cli-${i % 80}`,
    clienteCpf: faker.string.numeric(11),
    tipo,
    macrostatusOp: faker.helpers.arrayElement(opStates),
    macrostatusFin: faker.helpers.arrayElement(finStates),
    diasNoEstado: faker.number.int({ min: 1, max: 90 }),
    municipio: faker.location.city() + "/AL",
    valor: faker.number.int({ min: 5000, max: 80000 }),
    proximoPasso: faker.helpers.arrayElement([
      "Protocolar petição inicial",
      "Aguardar parecer do MEC",
      "Enviar termo de acerto ao cliente",
      "Confirmar implantação no SISFIES",
      "Cobrar parcela em atraso",
    ]),
    inadimplente: faker.datatype.boolean({ probability: 0.18 }),
    responsavel: faker.person.firstName(),
  };
});

export const clientes = Array.from({ length: 80 }, (_, i) => ({
  id: `cli-${i}`,
  nome: faker.person.fullName(),
  cpf: faker.string.numeric(11),
  email: faker.internet.email(),
  telefone: faker.phone.number(),
  municipio: faker.location.city() + "/AL",
  oab: `OAB/AL ${faker.number.int({ min: 1000, max: 99999 })}`,
  totalCasos: faker.number.int({ min: 1, max: 6 }),
  receita: faker.number.int({ min: 8000, max: 280000 }),
  ltv: faker.number.int({ min: 12000, max: 380000 }),
  tipo: faker.helpers.arrayElement(["Médico", "Dentista", "Enfermeiro", "Residente"]),
}));

export const tarefas = Array.from({ length: 40 }, (_, i) => ({
  id: `task-${i}`,
  titulo: faker.helpers.arrayElement([
    "Conferir documentação FIES",
    "Ligar para cliente sobre pendência",
    "Revisar minuta da petição",
    "Validar cálculo de honorários",
    "Protocolar recurso administrativo",
  ]),
  caso: casos[i % casos.length].codigo,
  cliente: casos[i % casos.length].clienteNome,
  prioridade: faker.helpers.arrayElement(["urgente", "alta", "normal"] as const),
  dueDate: faker.date.soon({ days: 7 }),
  responsavel: faker.person.firstName(),
}));

export const leads = Array.from({ length: 60 }, (_, i) => ({
  id: `lead-${i}`,
  nome: faker.person.fullName(),
  source: faker.helpers.arrayElement(["WhatsApp", "Site", "Meta Ads", "Google", "Indicação"]),
  demanda: faker.helpers.arrayElement(["FIES ESF", "FIES DGM", "Mais Médicos", "CFM/CRM", "Residência"]),
  score: faker.number.int({ min: 1, max: 5 }),
  etapa: faker.helpers.arrayElement([
    "Lead captado", "Contato inicial", "Qualificado", "Proposta enviada", "Negociação", "Convertido", "Perdido",
  ]),
  responsavel: faker.person.firstName(),
  criadoEm: faker.date.recent({ days: 30 }),
}));

export const conversas = Array.from({ length: 24 }, (_, i) => ({
  id: `conv-${i}`,
  cliente: faker.person.fullName(),
  ultimaMsg: faker.lorem.sentence(8),
  tempo: `${faker.number.int({ min: 1, max: 59 })}min`,
  classificacao: faker.helpers.arrayElement([
    "Dúvida processual", "Documentação", "Financeiro", "Cobrança",
    "Pós-vitória", "Reclamação", "Indicação", "Outros",
  ]),
  iaRespondeu: faker.datatype.boolean(),
  naoLidas: faker.number.int({ min: 0, max: 5 }),
}));

export const minutas = Array.from({ length: 18 }, (_, i) => ({
  id: `min-${i}`,
  titulo: faker.helpers.arrayElement([
    "Petição inicial — FIES revisão",
    "Recurso administrativo MEC",
    "Mandado de segurança CFM",
    "Embargos de declaração",
    "Contrarrazões — apelação",
  ]) + ` #${1000 + i}`,
  tipo: faker.helpers.arrayElement(["Petição inicial", "Recurso", "Mandado", "Embargos"]),
  status: faker.helpers.arrayElement(["Rascunho", "Gerando", "Em revisão", "Aprovada", "Protocolada"]),
  iaGerada: faker.datatype.boolean({ probability: 0.6 }),
  ultimaEdicao: `há ${faker.number.int({ min: 1, max: 72 })}h`,
  responsavel: faker.person.firstName(),
}));

export const dashSeries = Array.from({ length: 12 }, (_, i) => ({
  mes: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i],
  receita: faker.number.int({ min: 280, max: 540 }),
  casos: faker.number.int({ min: 80, max: 180 }),
  conversao: faker.number.int({ min: 18, max: 42 }),
}));

export function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
export function maskCPF(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4");
}
