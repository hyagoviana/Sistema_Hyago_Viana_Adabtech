// G4 — reflexo CLIENT da regra de sigilo do Judicial (espelha isAutorizadoJudicial
// do servidor). Substitui o stub `podeVerJudicial` que a G1 deixou (sempre true).
//
// Regra: admin sempre; caso não-sigiloso → todos; caso sigiloso → só admin +
// autorizados (criador/responsável do caso entram por padrão — D-G4).
//
// SEGURANÇA: isto é conforto de UI (esconder o menu). A garantia real é o gate
// server-side (requireJudicial nos RPCs de dados). Enquanto o status carrega,
// tratamos como "pode ver" apenas se NÃO for sigiloso; em dúvida (loading) o
// consumidor pode aguardar `isLoading`.

import { useAuth } from "@/lib/auth";
import { useCaseSigiloStatus } from "@/hooks/useJudicial";

export function usePodeVerJudicial(caseId: string): { podeVer: boolean; isLoading: boolean } {
  const { role, profile } = useAuth();
  const userId = profile?.id ?? null;
  const { data, isLoading } = useCaseSigiloStatus(caseId);

  if (role === "admin") return { podeVer: true, isLoading: false };

  // Sem status ainda → não decide (deixa o consumidor aguardar). Default
  // conservador: enquanto carrega, não revela o menu.
  if (!data) return { podeVer: false, isLoading };

  if (!data.sigiloso) return { podeVer: true, isLoading: false };

  const autorizado =
    !!userId &&
    (data.created_by === userId ||
      data.responsavel === userId ||
      data.autorizados.includes(userId));
  return { podeVer: autorizado, isLoading: false };
}
