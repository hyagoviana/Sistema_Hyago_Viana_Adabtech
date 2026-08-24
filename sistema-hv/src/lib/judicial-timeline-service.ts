// MENU JUDICIAL — promover um andamento do ProJuris para a linha do tempo do caso.
//
// Doc "21.08 _ Controladoria": cada andamento tem uma opção para marcar se ele
// "também aparece na linha do tempo da ficha do caso". As tarefas já aparecem
// sempre no painel próprio, então a marcação vale só para andamentos.
//
// Como os andamentos não são persistidos (vêm ao vivo do ProJuris), guardamos a
// marcação em `system_case_judicial_andamento_pins` junto com o id do evento
// gerado — assim desmarcar remove exatamente aquele evento da timeline, sem
// deixar rastro órfão.

import { AuthError } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface AndamentoPin {
  id: string;
  andamento_key: string;
  event_id: string | null;
  descricao: string | null;
  data_andamento: string | null;
}

export async function listAndamentoPins(caseId: string): Promise<AndamentoPin[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_judicial_andamento_pins")
    .select("id, andamento_key, event_id, descricao, data_andamento")
    .eq("organization_id", ORG_ID)
    .eq("case_id", caseId);
  if (error) throw new AuthError(`Falha ao ler marcações: ${error.message}`, 500);
  return data ?? [];
}

/**
 * Marca o andamento: cria o evento na linha do tempo do caso e guarda o pin.
 * Idempotente — marcar duas vezes não duplica o evento.
 */
export async function pinAndamento(
  caseId: string,
  input: { key: string; descricao: string | null; data: string | null; autor?: string | null },
  userId: string,
): Promise<{ jaExistia: boolean }> {
  const sb = getSupabaseAdmin();

  const { data: existente } = await sb
    .from("system_case_judicial_andamento_pins")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("case_id", caseId)
    .eq("andamento_key", input.key)
    .maybeSingle();
  if (existente) return { jaExistia: true };

  // A action `andamento_importado` já é renderizada pelo feed e pela timeline.
  const { data: evento, error: errEvento } = await sb
    .from("system_case_events")
    .insert({
      case_id: caseId,
      organization_id: ORG_ID,
      action: "andamento_importado",
      diff: {
        descricao: input.descricao,
        autor_texto: input.autor ?? "ProJuris",
        data_andamento: input.data,
      } as never,
      triggered_by: userId,
    })
    .select("id")
    .single();
  if (errEvento || !evento)
    throw new AuthError(`Falha ao lançar na linha do tempo: ${errEvento?.message ?? "?"}`, 500);

  const { error } = await sb.from("system_case_judicial_andamento_pins").insert({
    organization_id: ORG_ID,
    case_id: caseId,
    andamento_key: input.key,
    event_id: evento.id,
    descricao: input.descricao,
    data_andamento: input.data,
    created_by: userId,
  });
  if (error) {
    // Não deixa o evento órfão se o pin falhar.
    await sb.from("system_case_events").delete().eq("id", evento.id);
    throw new AuthError(`Falha ao marcar andamento: ${error.message}`, 500);
  }
  return { jaExistia: false };
}

/** Desmarca: apaga o pin e o evento que ele criou. */
export async function unpinAndamento(caseId: string, key: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data: pin } = await sb
    .from("system_case_judicial_andamento_pins")
    .select("id, event_id")
    .eq("organization_id", ORG_ID)
    .eq("case_id", caseId)
    .eq("andamento_key", key)
    .maybeSingle();
  if (!pin) return;

  if (pin.event_id) await sb.from("system_case_events").delete().eq("id", pin.event_id);
  const { error } = await sb.from("system_case_judicial_andamento_pins").delete().eq("id", pin.id);
  if (error) throw new AuthError(`Falha ao desmarcar: ${error.message}`, 500);
}
