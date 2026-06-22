import { useQuery } from "@tanstack/react-query";

// ----------------------------------------------------------------------------
// Lookups de localidade BR — ViaCEP (endereço por CEP) e IBGE (municípios por
// UF). Chamadas direto do browser (APIs públicas gratuitas, sem auth).
// ----------------------------------------------------------------------------

export type CepResult = {
  cep: string;
  logradouro: string; // rua
  complemento: string;
  bairro: string;
  localidade: string; // município
  uf: string;
};

export class CepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CepError";
  }
}

// Busca endereço por CEP no ViaCEP. Lança CepError se CEP inválido/não achado.
export async function lookupCep(rawCep: string): Promise<CepResult> {
  const cep = rawCep.replace(/\D/g, "");
  if (cep.length !== 8) throw new CepError("CEP deve ter 8 dígitos");

  let res: Response;
  try {
    res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  } catch {
    throw new CepError("Não foi possível consultar o CEP (sem conexão?)");
  }
  if (!res.ok) throw new CepError("Falha ao consultar o CEP");

  const data = (await res.json()) as Partial<CepResult> & { erro?: boolean };
  if (data.erro) throw new CepError("CEP não encontrado");

  return {
    cep,
    logradouro: data.logradouro ?? "",
    complemento: data.complemento ?? "",
    bairro: data.bairro ?? "",
    localidade: data.localidade ?? "",
    uf: (data.uf ?? "").toUpperCase(),
  };
}

export type Municipio = { id: number; nome: string };

// Lista de municípios de uma UF (IBGE), ordenada por nome. Cache longo — a
// lista praticamente não muda.
export function useMunicipios(uf: string | null | undefined) {
  const sigla = (uf ?? "").toUpperCase();
  return useQuery({
    queryKey: ["ibge", "municipios", sigla],
    enabled: sigla.length === 2,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${sigla}/municipios?orderBy=nome`,
      );
      if (!res.ok) throw new Error("Falha ao carregar municípios do IBGE");
      const data = (await res.json()) as Municipio[];
      return data.map((m) => m.nome);
    },
  });
}
