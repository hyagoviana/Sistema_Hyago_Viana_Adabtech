// Server-only — gestão de usuários do sistema (RBAC) e consentimento (LGPD).
// NUNCA importe este arquivo em código que roda no browser (usa service_role).
import { listCaseResponsaveis, setCaseResponsaveis } from "./case-responsaveis-service";
import { ROLES, type Role } from "./rbac";
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// URL pública do app — usada para montar o link dos e-mails de convite/reset.
// Em produção (Vercel) configure APP_URL; o fallback é o domínio oficial.
const APP_URL = (process.env.APP_URL ?? "https://www.sistemahyagoviana.com.br").replace(/\/+$/, "");

export class UsersServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "UsersServiceError";
  }
}

function check(error: { message: string } | null) {
  if (error) throw new UsersServiceError(error.message, 500);
}

function assertRole(role: string): asserts role is Role {
  if (!ROLES.includes(role as Role)) {
    throw new UsersServiceError(`Papel inválido: ${role}`, 400);
  }
}

const now = () => new Date().toISOString();

// ----------------------------------------------------------------------------
// Usuários
// ----------------------------------------------------------------------------
// M8 (2026-08-07) — cadastro real do colaborador (Perfil/Cargo/Unidade) + DUAS
// flags do motor. Domínios validados pela CHECK do banco (ver migration
// 20260808000030). Campos nascem NULL/false nos usuários existentes.
export type CadastroColaborador = {
  perfil: string | null;
  cargo: string | null;
  unidade_organizacional: string | null;
  peticionante: boolean;
  participa_distribuicao_padrao: boolean;
  status_projuris: string | null;
};

export type UserWithDistribution = CadastroColaborador & {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  status: string;
  created_at: string;
  // Distribuição (ProJuris) — join em system_projuris_executor_mapping (H5).
  projuris_responsavel_id: string | null;
  participa_distribuicao: boolean;
  weight: number | null;
  eligible_complex: boolean | null;
};

export async function listUsers(): Promise<UserWithDistribution[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users_active")
    .select(
      "id, email, full_name, phone, role, status, created_at, perfil, cargo, unidade_organizacional, peticionante, participa_distribuicao_padrao, status_projuris",
    )
    .order("created_at", { ascending: true });
  check(error);
  const users = (data ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    role: string;
    status: string;
    created_at: string;
    perfil: string | null;
    cargo: string | null;
    unidade_organizacional: string | null;
    peticionante: boolean | null;
    participa_distribuicao_padrao: boolean | null;
    status_projuris: string | null;
  }>;

  // Join com o mapping de executores (H5) — 1 lookup por lista, mapeado por
  // executor_id (= system_users.id). Não chama o ProJuris.
  const { data: mappings } = await sb
    .from("system_projuris_executor_mapping")
    .select("executor_id, projuris_responsavel_id, active, weight, eligible_complex")
    .eq("organization_id", DEFAULT_ORG_ID);
  const byExecutor = new Map(
    (mappings ?? []).map((m) => [
      (m as { executor_id: string }).executor_id,
      m as {
        projuris_responsavel_id: string;
        active: boolean;
        weight: number;
        eligible_complex: boolean;
      },
    ]),
  );

  return users.map((u) => {
    const m = byExecutor.get(u.id);
    return {
      ...u,
      peticionante: u.peticionante ?? false,
      participa_distribuicao_padrao: u.participa_distribuicao_padrao ?? false,
      projuris_responsavel_id: m?.projuris_responsavel_id ?? null,
      participa_distribuicao: m?.active ?? false,
      weight: m?.weight ?? null,
      eligible_complex: m?.eligible_complex ?? null,
    };
  });
}

/**
 * Configura a distribuição (ProJuris) de um usuário (H5). Faz upsert em
 * system_projuris_executor_mapping usando o usuário REAL (executor_id =
 * system_users.id) como fonte da verdade.
 *
 * D-merge (Opção A): um código ProJuris tem no máximo 1 executor (UNIQUE
 * projuris_responsavel_id, organization_id). Se o código já pertence a OUTRO
 * executor (ex.: o usuário sintético do seed 20260805000001), re-aponta o
 * executor_id para o usuário real — sem criar mapping órfão nem violar o UNIQUE.
 * O usuário sintético anterior fica sem mapping (deixa de distribuir).
 */
export async function setUserDistribution(
  userId: string,
  input: {
    projuris_responsavel_id?: string | null;
    participa?: boolean;
    weight?: number | null;
    eligible_complex?: boolean | null;
  },
) {
  const sb = getSupabaseAdmin();

  const codigo = (input.projuris_responsavel_id ?? "").trim();
  const participa = !!input.participa;
  // M9 (2026-08-07) — peso em BASE 100 (100 = distribui igual). Default 100.
  const weight = input.weight != null && input.weight > 0 ? input.weight : 100;
  const eligibleComplex = input.eligible_complex ?? true;

  // Mapping ATUAL deste usuário (por executor_id), se houver.
  const { data: existingByUser } = await sb
    .from("system_projuris_executor_mapping")
    .select("id, projuris_responsavel_id")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("executor_id", userId)
    .maybeSingle();

  // Sem código ProJuris: só faz sentido DESLIGAR/ajustar um mapping existente.
  // (a UI orienta a não "participar" sem código.)
  if (!codigo) {
    if (existingByUser) {
      const { error } = await sb
        .from("system_projuris_executor_mapping")
        .update({ active: false, weight, eligible_complex: eligibleComplex } as never)
        .eq("id", (existingByUser as { id: string }).id);
      check(error);
    }
    if (participa) {
      throw new UsersServiceError(
        "Informe o ID ProJuris antes de marcar o usuário como participante da distribuição.",
        400,
      );
    }
    return { ok: true as const, executor_id: userId, projuris_responsavel_id: null };
  }

  // Mapping que já usa ESTE código (pode ser de outro executor — ex.: sintético).
  const { data: existingByCode } = await sb
    .from("system_projuris_executor_mapping")
    .select("id, executor_id")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("projuris_responsavel_id", codigo)
    .maybeSingle();

  const fields = {
    projuris_responsavel_id: codigo,
    executor_id: userId,
    active: participa,
    weight,
    eligible_complex: eligibleComplex,
  };

  if (existingByCode) {
    const codeRow = existingByCode as { id: string; executor_id: string };
    // Se o código pertencia a outro executor, re-aponta para o usuário real
    // (D-merge). Também remove o mapping ANTIGO deste usuário (se apontava p/
    // outro código) para não deixá-lo com 2 mappings.
    if (existingByUser && (existingByUser as { id: string }).id !== codeRow.id) {
      const { error: delErr } = await sb
        .from("system_projuris_executor_mapping")
        .delete()
        .eq("id", (existingByUser as { id: string }).id);
      check(delErr);
    }
    const { error } = await sb
      .from("system_projuris_executor_mapping")
      .update(fields as never)
      .eq("id", codeRow.id);
    check(error);
  } else if (existingByUser) {
    // Usuário já tinha mapping (com OUTRO código) → troca o código no registro.
    const { error } = await sb
      .from("system_projuris_executor_mapping")
      .update(fields as never)
      .eq("id", (existingByUser as { id: string }).id);
    check(error);
  } else {
    // Novo mapping.
    const { error } = await sb
      .from("system_projuris_executor_mapping")
      .insert({ organization_id: DEFAULT_ORG_ID, ...fields } as never);
    check(error);
  }

  return { ok: true as const, executor_id: userId, projuris_responsavel_id: codigo };
}

/**
 * Edita dados de perfil de um usuário (nome e telefone). Chamado tanto pelo
 * próprio usuário quanto pelo admin — a autorização é feita no RPC.
 */
export type CadastroColaboradorPatch = Partial<{
  full_name: string | null;
  phone: string | null;
  perfil: string | null;
  cargo: string | null;
  unidade_organizacional: string | null;
  peticionante: boolean;
  participa_distribuicao_padrao: boolean;
  status_projuris: string | null;
}>;

export async function updateUserProfile(id: string, patch: CadastroColaboradorPatch) {
  const sb = getSupabaseAdmin();
  const fields: Record<string, unknown> = {};
  // M8 — nome/telefone + cadastro do colaborador (perfil/cargo/unidade/flags).
  const keys = [
    "full_name",
    "phone",
    "perfil",
    "cargo",
    "unidade_organizacional",
    "peticionante",
    "participa_distribuicao_padrao",
    "status_projuris",
  ] as const;
  for (const k of keys) {
    if (patch[k] !== undefined) fields[k] = patch[k];
  }
  if (Object.keys(fields).length === 0) {
    throw new UsersServiceError("Nada para atualizar.", 400);
  }
  const { data, error } = await sb
    .from("system_users")
    .update(fields as never)
    .eq("id", id)
    .select("id, email, full_name, phone, role, status")
    .single();
  check(error);
  return data;
}

/**
 * Convida um usuário: cria a conta no Supabase Auth (envia e-mail de convite)
 * e registra o perfil em system_users com status INVITED.
 */
export async function inviteUser(
  input: {
    email: string;
    full_name?: string;
    role: string;
    redirectTo?: string;
  } & CadastroColaboradorPatch,
) {
  assertRole(input.role);
  const sb = getSupabaseAdmin();

  const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.full_name ?? null },
    redirectTo: input.redirectTo ?? `${APP_URL}/nova-senha`,
  });
  if (inviteErr || !invited?.user) {
    throw new UsersServiceError(inviteErr?.message ?? "Falha ao convidar usuário.", 400);
  }

  // M8 — grava também o cadastro do colaborador (perfil/cargo/unidade/flags) no
  // mesmo insert. Campos ausentes ficam no default (NULL/false).
  const insertFields: Record<string, unknown> = {
    id: invited.user.id,
    organization_id: DEFAULT_ORG_ID,
    email: input.email,
    full_name: input.full_name ?? null,
    role: input.role,
    status: "INVITED",
  };
  for (const k of [
    "perfil",
    "cargo",
    "unidade_organizacional",
    "peticionante",
    "participa_distribuicao_padrao",
    "status_projuris",
  ] as const) {
    if (input[k] !== undefined) insertFields[k] = input[k];
  }

  const { data, error } = await sb
    .from("system_users")
    .insert(insertFields as never)
    .select("id, email, full_name, role, status, created_at")
    .single();
  check(error);
  return data;
}

/**
 * Ativa o usuário recém-convidado depois que ele define a senha (INVITED → ACTIVE).
 * O papel (admin/comercial/financeiro/…) já foi gravado no convite e é preservado.
 * Idempotente: se já estiver ACTIVE (ex.: reset de senha), não altera nada.
 */
export async function activateUser(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .update({ status: "ACTIVE" })
    .eq("id", id)
    .eq("status", "INVITED")
    .select("id, email, role, status")
    .maybeSingle();
  check(error);
  return data ?? { id, status: "ACTIVE" as const };
}

/** Perfil do próprio usuário (inclui telefone) — para a tela de configurações. */
export async function getMyProfile(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .select("id, email, full_name, phone, role, status")
    .eq("id", id)
    .maybeSingle();
  check(error);
  return data;
}

// ─── Relatório de tudo que está vinculado a um usuário (item 2026-07-09) ───────
// Casos onde é responsável/criador, tarefas atribuídas e itens de checklist sob
// sua responsabilidade — com destaque para as PENDÊNCIAS.
export type UserReport = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    role: string;
    status: string;
  } | null;
  casos: Array<{
    case_id: string;
    case_code: string;
    client_name: string;
    case_type: string;
    macrostatus_op: string | null;
    macrostatus_fin: string | null;
    is_responsavel: boolean;
    is_creator: boolean;
  }>;
  tarefas: Array<{
    id: string;
    case_id: string;
    case_code: string;
    client_name: string;
    title: string;
    status: string;
    due_date: string | null;
  }>;
  checklist: Array<{
    id: string;
    case_id: string;
    case_code: string;
    client_name: string;
    label: string;
    stage_slug: string;
    done: boolean;
  }>;
  resumo: { total_casos: number; tarefas_pendentes: number; checklist_pendentes: number };
};

export async function getUserReport(userId: string): Promise<UserReport> {
  const sb = getSupabaseAdmin();

  const user = await getMyProfile(userId);

  const { data: resp } = await sb
    .from("system_case_responsaveis_active")
    .select("case_id")
    .eq("user_id", userId);
  const respIds = new Set((resp ?? []).map((r) => (r as { case_id: string }).case_id));

  const { data: created } = await sb
    .from("system_cases")
    .select("id")
    .eq("created_by", userId)
    .is("deleted_at", null);
  const createdIds = new Set((created ?? []).map((c) => c.id));

  const { data: tasks } = await sb
    .from("system_case_tasks")
    .select("id, case_id, title, status, due_date")
    .eq("assignee_id", userId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });

  const { data: chk } = await sb
    .from("system_case_checklist_items")
    .select("id, case_id, stage_slug, label, done, def:system_stage_checklist_defs(label)")
    .eq("assigned_to", userId)
    .is("deleted_at", null);

  // Lookup de código do caso + nome do cliente para todas as entidades envolvidas.
  const allCaseIds = [
    ...new Set([
      ...respIds,
      ...createdIds,
      ...(tasks ?? []).map((t) => t.case_id),
      ...(chk ?? []).map((c) => c.case_id),
    ]),
  ];
  const { data: cases } = await sb
    .from("system_cases")
    .select("id, case_code, client_id, case_type, macrostatus_op, macrostatus_fin")
    .in("id", allCaseIds);
  const caseMap = new Map((cases ?? []).map((c) => [c.id, c]));
  const clientIds = [...new Set((cases ?? []).map((c) => c.client_id))];
  const { data: clients } = await sb
    .from("system_clients")
    .select("id, full_name")
    .in("id", clientIds);
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
  const nameOf = (caseId: string) => {
    const c = caseMap.get(caseId);
    return {
      case_code: c?.case_code ?? "·",
      client_name: clientMap.get(c?.client_id ?? "") ?? "·",
    };
  };

  const casos = [...new Set([...respIds, ...createdIds])].map((id) => {
    const c = caseMap.get(id);
    return {
      case_id: id,
      ...nameOf(id),
      case_type: c?.case_type ?? "",
      macrostatus_op: c?.macrostatus_op ?? null,
      macrostatus_fin: c?.macrostatus_fin ?? null,
      is_responsavel: respIds.has(id),
      is_creator: createdIds.has(id),
    };
  });

  const tarefas = (tasks ?? []).map((t) => ({
    id: t.id,
    case_id: t.case_id,
    ...nameOf(t.case_id),
    title: t.title,
    status: t.status,
    due_date: t.due_date,
  }));

  const checklist = (chk ?? []).map((it) => ({
    id: it.id,
    case_id: it.case_id,
    ...nameOf(it.case_id),
    label: (it as { def?: { label?: string } | null }).def?.label ?? it.label ?? "·",
    stage_slug: it.stage_slug,
    done: it.done,
  }));

  return {
    user,
    casos,
    tarefas,
    checklist,
    resumo: {
      total_casos: casos.length,
      tarefas_pendentes: tarefas.filter((t) => t.status !== "CONCLUIDA").length,
      checklist_pendentes: checklist.filter((c) => !c.done).length,
    },
  };
}

/** Papel atual de um usuário (para checagens de autorização no RPC). */
export async function getUserRole(id: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("system_users").select("role").eq("id", id).maybeSingle();
  return data?.role ?? null;
}

export async function setUserRole(id: string, role: string) {
  assertRole(role);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .update({ role })
    .eq("id", id)
    .select("id, email, full_name, role, status")
    .single();
  check(error);
  return data;
}

export async function setUserStatus(id: string, status: string) {
  if (!["INVITED", "ACTIVE", "SUSPENDED"].includes(status)) {
    throw new UsersServiceError(`Status inválido: ${status}`, 400);
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .update({ status })
    .eq("id", id)
    .select("id, email, full_name, role, status")
    .single();
  check(error);
  return data;
}

/** Soft-delete: remove o perfil do sistema (a conta Auth permanece). */
export async function removeUser(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_users")
    .update({ deleted_at: now(), status: "SUSPENDED" })
    .eq("id", id);
  check(error);
  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// EXCLUSÃO DEFINITIVA com reatribuição (item por item)
// ----------------------------------------------------------------------------
// Tudo que amarra "trabalho" a um colaborador, para o admin reatribuir antes de
// excluí-lo de vez (perfil + conta Auth). É a base da tela de exclusão.
export type UserWorkload = {
  user: { id: string; full_name: string | null; email: string } | null;
  responsaveis: { case_id: string; case_code: string; client_name: string }[];
  casesCreated: { case_id: string; case_code: string; client_name: string }[];
  clientsCreated: { client_id: string; client_name: string }[];
  tasks: { id: string; case_id: string; case_code: string; title: string }[];
  checklist: { id: string; case_id: string; case_code: string; label: string }[];
};

export async function getUserWorkload(userId: string): Promise<UserWorkload> {
  const sb = getSupabaseAdmin();
  const prof = await getMyProfile(userId);
  const user = prof ? { id: prof.id, full_name: prof.full_name, email: prof.email } : null;

  const { data: resp } = await sb
    .from("system_case_responsaveis_active")
    .select("case_id")
    .eq("user_id", userId);
  const respIds = [...new Set((resp ?? []).map((r) => (r as { case_id: string }).case_id))];

  const { data: created } = await sb
    .from("system_cases")
    .select("id")
    .eq("created_by", userId)
    .is("deleted_at", null);
  const createdIds = (created ?? []).map((c) => c.id);

  const { data: clientsCreated } = await sb
    .from("system_clients")
    .select("id, full_name")
    .eq("created_by", userId)
    .is("deleted_at", null);

  const { data: tasks } = await sb
    .from("system_case_tasks")
    .select("id, case_id, title")
    .eq("assignee_id", userId)
    .is("deleted_at", null);

  const { data: chk } = await sb
    .from("system_case_checklist_items")
    .select("id, case_id, label, def:system_stage_checklist_defs(label)")
    .eq("assigned_to", userId)
    .is("deleted_at", null);

  const allCaseIds = [
    ...new Set([
      ...respIds,
      ...createdIds,
      ...(tasks ?? []).map((t) => t.case_id),
      ...(chk ?? []).map((c) => c.case_id),
    ]),
  ];
  const { data: cases } = allCaseIds.length
    ? await sb.from("system_cases").select("id, case_code, client_id").in("id", allCaseIds)
    : { data: [] as { id: string; case_code: string; client_id: string }[] };
  const caseMap = new Map((cases ?? []).map((c) => [c.id, c]));
  const clientIds = [...new Set((cases ?? []).map((c) => c.client_id))];
  const { data: cli } = clientIds.length
    ? await sb.from("system_clients").select("id, full_name").in("id", clientIds)
    : { data: [] as { id: string; full_name: string }[] };
  const clientMap = new Map((cli ?? []).map((c) => [c.id, c.full_name]));
  const codeOf = (cid: string) => caseMap.get(cid)?.case_code ?? "·";
  const clientOf = (cid: string) => clientMap.get(caseMap.get(cid)?.client_id ?? "") ?? "·";

  return {
    user,
    responsaveis: respIds.map((cid) => ({
      case_id: cid,
      case_code: codeOf(cid),
      client_name: clientOf(cid),
    })),
    casesCreated: createdIds.map((cid) => ({
      case_id: cid,
      case_code: codeOf(cid),
      client_name: clientOf(cid),
    })),
    clientsCreated: (clientsCreated ?? []).map((c) => ({
      client_id: c.id,
      client_name: c.full_name,
    })),
    tasks: (tasks ?? []).map((t) => ({
      id: t.id,
      case_id: t.case_id,
      case_code: codeOf(t.case_id),
      title: t.title,
    })),
    checklist: (chk ?? []).map((it) => ({
      id: it.id,
      case_id: it.case_id,
      case_code: codeOf(it.case_id),
      label: (it as { def?: { label?: string } | null }).def?.label ?? it.label ?? "·",
    })),
  };
}

export type ReassignMapping = {
  responsaveis: { case_id: string; to: string }[];
  casesCreated: { case_id: string; to: string }[];
  clientsCreated: { client_id: string; to: string }[];
  tasks: { id: string; to: string }[];
  checklist: { id: string; to: string }[];
};

/**
 * Reatribui TODO o trabalho do colaborador (item por item) para os destinos
 * escolhidos e então EXCLUI o usuário DE VEZ (perfil + conta Auth → perde acesso).
 * Só deve ser chamado pelo admin (gate no RPC). Não permite excluir a si mesmo.
 */
export async function reassignAndDeleteUser(userId: string, map: ReassignMapping, actorId: string) {
  const sb = getSupabaseAdmin();
  if (userId === actorId) {
    throw new UsersServiceError("Você não pode excluir a si mesmo.", 400);
  }

  // 1) Responsáveis: em cada caso, troca o excluído pelo destino (mantém os demais).
  for (const r of map.responsaveis) {
    const current = await listCaseResponsaveis(r.case_id);
    const ids = current.map((c) => c.user_id).filter((id) => id !== userId);
    if (r.to && !ids.includes(r.to)) ids.push(r.to);
    await setCaseResponsaveis(r.case_id, ids, actorId);
  }
  // 2) Casos criados → novo criador.
  for (const c of map.casesCreated) {
    await sb.from("system_cases").update({ created_by: c.to }).eq("id", c.case_id);
  }
  // 3) Clientes criados → novo criador.
  for (const c of map.clientsCreated) {
    await sb.from("system_clients").update({ created_by: c.to }).eq("id", c.client_id);
  }
  // 4) Tarefas → novo responsável (trigger sincroniza o cache de nome).
  for (const t of map.tasks) {
    await sb.from("system_case_tasks").update({ assignee_id: t.to }).eq("id", t.id);
  }
  // 5) Itens de checklist → novo responsável.
  for (const it of map.checklist) {
    await sb.from("system_case_checklist_items").update({ assigned_to: it.to }).eq("id", it.id);
  }

  // 6) Exclusão definitiva. Remove o perfil (cascade limpa vínculos residuais de
  //    responsáveis) e a conta Auth (o colaborador perde acesso à plataforma).
  const { error: delErr } = await sb.from("system_users").delete().eq("id", userId);
  check(delErr);
  const { error: authErr } = await sb.auth.admin.deleteUser(userId);
  if (authErr) {
    throw new UsersServiceError(
      `Perfil removido, mas falhou remover do login (Auth): ${authErr.message}`,
      500,
    );
  }
  return { ok: true as const, id: userId };
}

// ----------------------------------------------------------------------------
// Senha — reset e alteração
// ----------------------------------------------------------------------------

/**
 * Envia e-mail de recuperação de senha via Supabase Auth.
 * Não requer autenticação (endpoint público).
 */
export async function requestPasswordReset(email: string, redirectTo: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new UsersServiceError(error.message, 400);
  return { ok: true as const };
}

/**
 * Altera a senha de um usuário autenticado.
 * Requer que o chamador passe o userId já validado pelo auth-guard.
 */
export async function updateUserPassword(userId: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new UsersServiceError("A senha deve ter no mínimo 6 caracteres.", 400);
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw new UsersServiceError(error.message, 400);

  // Ativar usuário convidado que está definindo senha pela primeira vez
  const { data: profile } = await sb
    .from("system_users")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.status === "INVITED") {
    await sb.from("system_users").update({ status: "ACTIVE" }).eq("id", userId);
  }

  return { ok: true as const };
}

// ----------------------------------------------------------------------------
// LGPD — consentimento
// ----------------------------------------------------------------------------
export async function recordConsent(input: {
  client_id?: string | null;
  cpf_cnpj?: string | null;
  finalidade: string;
  channel?: string | null;
  policy_version?: string;
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_consent_records")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      client_id: input.client_id ?? null,
      cpf_cnpj: input.cpf_cnpj ?? null,
      finalidade: input.finalidade,
      channel: input.channel ?? "SISTEMA",
      policy_version: input.policy_version ?? "1.0.0",
    })
    .select()
    .single();
  check(error);
  return data;
}

export async function listConsents(clientId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_consent_records")
    .select("*")
    .eq("client_id", clientId)
    .order("granted_at", { ascending: false });
  check(error);
  return data ?? [];
}

export async function revokeConsent(id: string, reason?: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_consent_records")
    .update({ revoked_at: now(), revoke_reason: reason ?? null })
    .eq("id", id)
    .select()
    .single();
  check(error);
  return data;
}
