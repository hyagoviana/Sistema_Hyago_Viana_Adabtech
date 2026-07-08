// Server-only — CRUD das tabelas de referência do autofill (municípios, perfis).
// Preenchidas 1x e reusadas na geração de documentos. NUNCA importe no browser.
// Os tipos das tabelas ainda não estão no types.ts gerado (rodar db:types após o
// db:push) — usamos casts pontuais `as never` até lá.

import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class ReferenciaServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ReferenciaServiceError";
  }
}

export type Municipio = {
  id: string;
  nome: string;
  populacao: string | null;
  densidade: string | null;
  salario_medio: string | null;
  percentual: string | null;
  ibge: string | null;
  secretario_nome: string | null;
  secretario_cargo: string | null;
};

export type Perfil = {
  id: string;
  nome: string;
  texto: string | null;
};

// ----------------------------------------------------------------------------
// MUNICÍPIOS
// ----------------------------------------------------------------------------
export async function listMunicipios(): Promise<Municipio[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_municipios_active" as never)
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw new ReferenciaServiceError(error.message, 500);
  return (data ?? []) as unknown as Municipio[];
}

/** Busca 1 município por nome (case-insensitive) — usado pelo autofill. */
export async function getMunicipioByNome(nome: string): Promise<Municipio | null> {
  const term = nome.trim();
  if (!term) return null;
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_municipios_active" as never)
    .select("*")
    .ilike("nome", term)
    .limit(1)
    .maybeSingle();
  return (data as unknown as Municipio) ?? null;
}

export async function upsertMunicipio(input: Omit<Municipio, "id"> & { id?: string }) {
  const sb = getSupabaseAdmin();
  const payload = {
    organization_id: DEFAULT_ORG,
    nome: input.nome.trim(),
    populacao: input.populacao || null,
    densidade: input.densidade || null,
    salario_medio: input.salario_medio || null,
    percentual: input.percentual || null,
    ibge: input.ibge || null,
    secretario_nome: input.secretario_nome || null,
    secretario_cargo: input.secretario_cargo || null,
  };
  if (input.id) {
    const { data, error } = await sb
      .from("system_municipios" as never)
      .update(payload as never)
      .eq("id", input.id)
      .is("deleted_at", null)
      .select()
      .single();
    if (error) throw new ReferenciaServiceError(error.message, 500);
    return data as unknown as Municipio;
  }
  const { data, error } = await sb
    .from("system_municipios" as never)
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new ReferenciaServiceError(error.message, 500);
  return data as unknown as Municipio;
}

export async function deleteMunicipio(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_municipios" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new ReferenciaServiceError(error.message, 500);
  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// PERFIS
// ----------------------------------------------------------------------------
export async function listPerfis(): Promise<Perfil[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_perfis_active" as never)
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw new ReferenciaServiceError(error.message, 500);
  return (data ?? []) as unknown as Perfil[];
}

/** Busca 1 perfil por nome (case-insensitive) — usado pelo autofill. */
export async function getPerfilByNome(nome: string): Promise<Perfil | null> {
  const term = nome.trim();
  if (!term) return null;
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_perfis_active" as never)
    .select("*")
    .ilike("nome", term)
    .limit(1)
    .maybeSingle();
  return (data as unknown as Perfil) ?? null;
}

export async function upsertPerfil(input: Omit<Perfil, "id"> & { id?: string }) {
  const sb = getSupabaseAdmin();
  const payload = {
    organization_id: DEFAULT_ORG,
    nome: input.nome.trim(),
    texto: input.texto || null,
  };
  if (input.id) {
    const { data, error } = await sb
      .from("system_perfis" as never)
      .update(payload as never)
      .eq("id", input.id)
      .is("deleted_at", null)
      .select()
      .single();
    if (error) throw new ReferenciaServiceError(error.message, 500);
    return data as unknown as Perfil;
  }
  const { data, error } = await sb
    .from("system_perfis" as never)
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new ReferenciaServiceError(error.message, 500);
  return data as unknown as Perfil;
}

export async function deletePerfil(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_perfis" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new ReferenciaServiceError(error.message, 500);
  return { ok: true as const, id };
}
