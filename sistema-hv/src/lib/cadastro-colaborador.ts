// M8 (2026-08-07) — domínios do cadastro do colaborador (Perfil / Cargo-nível /
// Status ProJuris) com rótulos PT-BR. Os `value` espelham EXATAMENTE a CHECK da
// migration 20260808000030_system_users_cadastro_colaborador.sql. Compartilhado
// entre o diálogo de EDITAR (UsersAdmin) e o de CONVITE (InviteUserDialog) para
// as duas telas ficarem idênticas (pedido do Matheus na reunião 2026-08-07).

export const PERFIL_OPTS = [
  { value: "administrador", label: "Administrador" },
  { value: "usuario_padrao", label: "Usuário padrão" },
  { value: "coordenador", label: "Coordenador" },
  { value: "financeiro", label: "Financeiro" },
] as const;

export const CARGO_OPTS = [
  { value: "senior", label: "Sênior" },
  { value: "junior", label: "Júnior" },
  { value: "estagiario", label: "Estagiário" },
  { value: "prestador_servico", label: "Prestador de serviço" },
  { value: "administrador", label: "Administrador" },
] as const;

export const STATUS_PROJURIS_OPTS = [
  { value: "habilitado", label: "Habilitado" },
  { value: "desabilitado", label: "Desabilitado (arquivado)" },
] as const;

// Sentinela do Select para "não definido" (o shadcn Select não aceita value="").
export const NONE = "__none__";
