// S3-03 (reunião 02/09) — painel DADOS DO CLIENTE na ficha.
//
// Thiago (desenho 31): "Adicionar um menu/painel onde ficam os dados cadastrados
// para o cliente (assim como já temos para a página do caso). obs: aqui não viria
// informação/dados dos campos dos casos, apenas dos campos padrões e
// personalizados que são referente a entidade 'Cliente'."
//
// Consolida o que estava espalhado em dois cards ("Contato" e "Dados
// profissionais") e acrescenta o que faltava: documento, nascimento, endereço,
// bloco FIES/residência e os CAMPOS PERSONALIZADOS do cliente — inclusive os que
// nasceram num tema com escopo cliente (S1-05).
//
// Só leitura. A edição continua no formulário do cadastro (botão "Editar" no
// cabeçalho da ficha), que a S3-01 transforma em página — em vez de duplicar aqui
// as validações de CPF, e-mail e máscaras que já vivem lá.

import { useMemo } from "react";
import { IdCard } from "lucide-react";

import { Eyebrow } from "@/components/hv/primitives";
import { useClientFieldDefs } from "@/hooks/useClientFields";
import { PROGRAMA_LABELS } from "@/lib/validators/client";

type Registro = Record<string, unknown>;

export type ClientDataPanelProps = {
  cliente: Registro;
};

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function dataBr(v: unknown): string | null {
  const s = texto(v);
  if (!s) return null;
  // Aceita ISO (2026-09-03) e o que já vier formatado.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function maskCpfCnpj(v: unknown): string | null {
  const d = texto(v)?.replace(/\D/g, "");
  if (!d) return texto(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return texto(v);
}

function maskPhone(v: unknown): string | null {
  const d = texto(v)?.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return texto(v);
}

function Bloco({ titulo, linhas }: { titulo: string; linhas: Array<[string, string]> }) {
  if (linhas.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
        {titulo}
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-[var(--border)] pb-1">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-[var(--navy)] font-medium text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ClientDataPanel({ cliente }: ClientDataPanelProps) {
  const { data: defs } = useClientFieldDefs();

  // Memoizados: sem isto, cada render recria os objetos e todos os useMemo abaixo
  // recalculam (o lint avisa).
  const prof = useMemo(() => (cliente.professional_data ?? {}) as Registro, [cliente]);
  const end = useMemo(() => (cliente.address ?? {}) as Registro, [cliente]);
  const custom = useMemo(() => (cliente.custom_fields ?? {}) as Registro, [cliente]);

  const identificacao = useMemo(() => {
    const l: Array<[string, string]> = [];
    const add = (k: string, v: string | null) => v && l.push([k, v]);
    add("CPF/CNPJ", maskCpfCnpj(cliente.cpf_cnpj));
    add("RG", texto(cliente.rg));
    add("Órgão emissor (RG)", texto(prof.rg_orgao));
    add("Nascimento", dataBr(cliente.birth_date));
    add("Estado civil", texto(prof.estado_civil));
    add(
      "Pessoa",
      cliente.person_type ? (cliente.person_type === "PJ" ? "Jurídica" : "Física") : null,
    );
    add("Tipo", texto(cliente.tipo));
    return l;
  }, [cliente, prof]);

  const contato = useMemo(() => {
    const l: Array<[string, string]> = [];
    const add = (k: string, v: string | null) => v && l.push([k, v]);
    add("E-mail", texto(cliente.email));
    add("Telefone", maskPhone(cliente.phone));
    add("Cadastrado em", dataBr(cliente.created_at));
    return l;
  }, [cliente]);

  const endereco = useMemo(() => {
    const l: Array<[string, string]> = [];
    const add = (k: string, v: string | null) => v && l.push([k, v]);
    // Rótulos conforme o pedido do Thiago (S3-02): "Endereço" e "Número endereço".
    add("Endereço", texto(end.street));
    add("Número endereço", texto(end.number));
    add("Complemento", texto(end.complement));
    add("Bairro", texto(end.neighborhood));
    add("Município", texto(end.city));
    add("UF", texto(end.state));
    add("CEP", texto(end.zipcode));
    return l;
  }, [end]);

  const profissional = useMemo(() => {
    const l: Array<[string, string]> = [];
    const add = (k: string, v: string | null) => v && l.push([k, v]);
    const crm = texto(prof.crm_numero);
    add("CRM", crm ? `${crm}${texto(prof.crm_uf) ? `/${texto(prof.crm_uf)}` : ""}` : null);
    const oab = texto(prof.oab_numero);
    add("OAB", oab ? `${oab}${texto(prof.oab_uf) ? `/${texto(prof.oab_uf)}` : ""}` : null);
    add("Especialidade", texto(prof.especialidade));
    add("Vínculo institucional", texto(prof.vinculo_institucional));
    add("Instituição de graduação", texto(prof.instituicao_graduacao));
    add("Ano de formatura", texto(prof.ano_formatura));
    add("FIES", texto(prof.fies));
    add("Nº do contrato FIES", texto(prof.fies_contrato_numero));
    add("Dados do contrato FIES", texto(prof.fies_contrato_obs));
    add("Residência · hospital", texto(prof.residencia_hospital));
    add("Residência · especialidade", texto(prof.residencia_especialidade));
    add("Residência · início", dataBr(prof.residencia_inicio));
    add("Residência · término", dataBr(prof.residencia_termino));
    const programas = Array.isArray(prof.programas) ? (prof.programas as string[]) : [];
    if (programas.length) {
      add(
        "Programas",
        programas.map((p) => PROGRAMA_LABELS[p as keyof typeof PROGRAMA_LABELS] ?? p).join(", "),
      );
    }
    add("Observações", texto(prof.observacoes));
    return l;
  }, [prof]);

  // Campos personalizados DO CLIENTE — inclui os que nasceram num tema com
  // escopo cliente (a S1-05 passou a criá-los aqui também). Campos de CASO não
  // entram: eles vivem no balde do caso, não no do cliente.
  const personalizados = useMemo(() => {
    const l: Array<[string, string]> = [];
    for (const d of (defs ?? []) as Array<{ key: string; label: string; active?: boolean }>) {
      if (d.active === false) continue;
      const v = texto(custom[d.key]);
      if (v) l.push([d.label, v]);
    }
    return l;
  }, [defs, custom]);

  const vazio =
    identificacao.length === 0 &&
    contato.length === 0 &&
    endereco.length === 0 &&
    profissional.length === 0 &&
    personalizados.length === 0;

  return (
    <div className="card-hero p-6 mb-8">
      <div className="flex items-center gap-2">
        <IdCard size={16} className="text-[var(--gold-700)]" />
        <Eyebrow>Dados do cliente</Eyebrow>
      </div>

      {vazio ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum dado preenchido ainda. Use “Editar” no topo da ficha.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <Bloco titulo="Identificação" linhas={identificacao} />
          <Bloco titulo="Contato" linhas={contato} />
          <Bloco titulo="Endereço" linhas={endereco} />
          <Bloco titulo="Formação, FIES e residência" linhas={profissional} />
          <Bloco titulo="Campos personalizados" linhas={personalizados} />
        </div>
      )}
    </div>
  );
}
