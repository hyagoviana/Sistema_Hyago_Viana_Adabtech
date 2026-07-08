import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  deleteMunicipioFn,
  deletePerfilFn,
  listMunicipiosFn,
  listPerfisFn,
  upsertMunicipioFn,
  upsertPerfilFn,
} from "@/rpc/referencias";

const MUNICIPIOS_KEY = ["referencias", "municipios"];
const PERFIS_KEY = ["referencias", "perfis"];

export type MunicipioInput = {
  id?: string;
  nome: string;
  populacao?: string;
  densidade?: string;
  salario_medio?: string;
  percentual?: string;
  ibge?: string;
  secretario_nome?: string;
  secretario_cargo?: string;
};

export type PerfilInput = { id?: string; nome: string; texto?: string };

export function useMunicipios() {
  const fn = useServerFn(listMunicipiosFn);
  return useQuery({ queryKey: MUNICIPIOS_KEY, queryFn: () => fn(), staleTime: 5 * 60 * 1000 });
}

export function useUpsertMunicipio() {
  const fn = useServerFn(upsertMunicipioFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MunicipioInput) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MUNICIPIOS_KEY }),
  });
}

export function useDeleteMunicipio() {
  const fn = useServerFn(deleteMunicipioFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MUNICIPIOS_KEY }),
  });
}

export function usePerfis() {
  const fn = useServerFn(listPerfisFn);
  return useQuery({ queryKey: PERFIS_KEY, queryFn: () => fn(), staleTime: 5 * 60 * 1000 });
}

export function useUpsertPerfil() {
  const fn = useServerFn(upsertPerfilFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PerfilInput) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PERFIS_KEY }),
  });
}

export function useDeletePerfil() {
  const fn = useServerFn(deletePerfilFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PERFIS_KEY }),
  });
}
