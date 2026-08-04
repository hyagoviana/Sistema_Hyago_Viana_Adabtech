#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETL — Importação da base "Mais Médicos" (MM_BASE_SISTEMA_BETA_v1.xlsx) para o
sistema HV. Story A8 (reunião 2026-08-03).

DUAS FASES:
  --dry-run  (DEFAULT)  → só LÊ a planilha (+ opcionalmente metadados do banco),
                          resolve o mapeamento, valida, imprime contagens e
                          anomalias. NÃO grava NADA.
  --execute             → grava em PRODUÇÃO (find-or-create idempotente). Cria
                          tema+campos+checklist-defs, 381 clientes, 381 casos,
                          notas, andamentos e checklist-items. As PASTAS DO DRIVE
                          são criadas por um subprocesso Node (idempotente e
                          NÃO-FATAL) — ver import-mais-medicos-drive.mjs. Habilitado
                          após aprovação do dry-run pelo owner (2026-08-04).

Decisões travadas (ver docs/stories/reuniao-2026-08-03/A8-importacao-mais-medicos.md):
  - CPF ausente → marcador = ID_CLIENTE_INTERNO ("CL-XXXX") em cpf_cnpj.
  - Vínculos Opção A: 1 cliente = 1 caso; vínculo ATUAL nos canonical_fields +
    histórico dos antigos num bloco JSON.
  - Parcelas SISGIMM: resumo em canonical_fields; NÃO em system_parcelas (→ A3).
  - Board SISGIMM → A3. Só o board "Contratos" (op) entra aqui.
  - Usuários → TEXTO na autoria (não cria usuário-que-loga).
  - EVENTOS_AUDITORIA → descartar.
  - REUSO DO service_type (decisão do owner, 2026-08-04): já existe um
    system_service_types "Mais Médicos" (slug MAIS_MEDICOS) SEM tema_id. Em vez de
    deixar o createTema criar um MAIS_MEDICOS_T, REUSAMOS esse service_type como o
    espelho do tema: criamos o system_temas e fazemos
    UPDATE system_service_types SET tema_id=<novo tema>. As 7 etapas op ("Contratos")
    são semeadas/garantidas nesse service_type (as etapas op genéricas pré-existentes
    são soft-deletadas, pois há 0 casos). Fin/comercial ficam intactas.

Uso:
  python sistema-hv/scripts/import-mais-medicos.py --dry-run
  python sistema-hv/scripts/import-mais-medicos.py --dry-run --no-db   # só planilha
  python sistema-hv/scripts/import-mais-medicos.py --execute           # GRAVA em produção
  python sistema-hv/scripts/import-mais-medicos.py --execute --skip-drive  # sem pastas Drive
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("ERRO: openpyxl não instalado (pip install openpyxl)", file=sys.stderr)
    sys.exit(1)

# --------------------------------------------------------------------------- #
# Caminhos / constantes
# --------------------------------------------------------------------------- #
REPO_ROOT = Path(__file__).resolve().parents[2]  # .../Sistema_Hyago_Viana_Adabtech
SISTEMA_HV = REPO_ROOT / "sistema-hv"
XLSX_PATH = REPO_ROOT / "MM_BASE_SISTEMA_BETA_v1.xlsx"
ENV_PATH = SISTEMA_HV / ".env.local"

DEFAULT_ORG = "00000000-0000-0000-0000-000000000001"
IMPORT_BATCH = "MM_2026_08_03"
TEMA_NAME = "Mais Médicos"

# Prefixo do case_code — deriva do NOME do tema, EXATAMENTE como caseCodePrefix()
# em src/lib/cases-service.ts (NFD, remove acentos, upper, só [A-Z0-9]).
def case_code_prefix(name: str) -> str:
    cleaned = "".join(
        c for c in unicodedata.normalize("NFD", name or "")
        if unicodedata.category(c) != "Mn"
    ).upper()
    cleaned = re.sub(r"[^A-Z0-9]", "", cleaned)
    return cleaned or "CASO"

CASE_CODE_PREFIX = case_code_prefix(TEMA_NAME)  # -> "MAISMEDICOS"

# Board "Contratos" — etapas op (slug = valor gravado em macrostatus_op; o trigger
# system_fn_sync_stage_ids casa o slug com a pipeline stage para setar stage_op_id).
OP_STAGES = [
    ("INICIAL_CONTRATO_NOVO", "Inicial - contrato novo", "normal", 0),
    ("DOCUMENTOS_INICIAIS", "Documentos iniciais", "normal", 1),
    ("ADMINISTRATIVO_FEITO", "Administrativo feito", "normal", 2),
    ("JUDICIAL", "Judicial", "normal", 3),
    ("STAND_BY", "Stand by", "normal", 4),
    ("RESCISAO", "Rescisão", "closed", 5),
    ("ENCERRADO", "Encerrado", "closed", 6),
]
OP_STAGE_SLUGS = {s[0] for s in OP_STAGES}

# STATUS_CASO (da planilha, já com mojibake normalizado) -> slug da etapa op.
# Chave = STATUS_CASO normalizado por norm_key() (sem acento/mojibake, minúsculo).
STATUS_TO_STAGE = {
    "novo contrato - organizacao adm": "INICIAL_CONTRATO_NOVO",
    "novo contrato - organizacao docs": "DOCUMENTOS_INICIAIS",
    "administrativo feito": "ADMINISTRATIVO_FEITO",
    "judicial": "JUDICIAL",
    "stand by": "STAND_BY",
    "rescisao": "RESCISAO",
    "encerrado": "ENCERRADO",
}
FALLBACK_STAGE = "INICIAL_CONTRATO_NOVO"  # nulo/desconhecido

# Normalização IVS -> 5 níveis canônicos.
IVS_LEVELS = ["Muito Baixa", "Baixa", "Média", "Alta", "Muito Alta"]


# --------------------------------------------------------------------------- #
# Helpers de string / mojibake
# --------------------------------------------------------------------------- #
REPLACEMENT = "�"  # caractere de substituição já baked na planilha (lossy)

def clean_text(v) -> str | None:
    """Trim + normaliza espaços. Mantém o texto legível; o REPLACEMENT char
    (U+FFFD) que já veio na origem é irrecuperável (bytes perdidos) — apenas
    reportamos sua presença, não inventamos o acento."""
    if v is None:
        return None
    s = str(v).strip()
    if s == "" or s == "-":
        return None
    s = re.sub(r"\s+", " ", s)
    return s

def norm_key(v) -> str:
    """Chave de comparação: sem acento, sem mojibake, minúsculo, espaços colapsados.
    Trata U+FFFD como um caractere qualquer (removido junto dos não-alfanum de acento)."""
    if v is None:
        return ""
    s = str(v).strip().lower()
    s = s.replace(REPLACEMENT, "")  # descarta o caractere corrompido para casar
    s = "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )
    s = re.sub(r"\s+", " ", s).strip()
    return s

def has_mojibake(v) -> bool:
    return v is not None and REPLACEMENT in str(v)

def to_bool(v):
    """Sim/Não -> bool; vazio/None -> None."""
    if v is None:
        return None
    s = norm_key(v)
    if s in ("sim", "s", "true", "1"):
        return True
    if s in ("nao", "n", "false", "0"):
        return False
    return None

def to_iso_date(v) -> str | None:
    """datetime/date/'YYYY-MM-DD'/'DD/MM/YYYY' -> 'YYYY-MM-DD'. Falha -> None."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = str(v).strip()
    if not s or s == "-":
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None  # não parseável — reportar

def to_iso_ts(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat(sep=" ")
    if isinstance(v, date):
        return v.isoformat()
    s = str(v).strip()
    return s or None

def to_number(v):
    """IVS/percentuais: aceita float, '0,412' (vírgula BR), '10%' -> 0.10. None/'-' -> None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s or s == "-":
        return None
    pct = s.endswith("%")
    s = s.replace("%", "").replace(",", ".").strip()
    try:
        n = float(s)
        return n / 100.0 if pct else n
    except ValueError:
        return None

def normalize_ivs(v):
    """~19 variações de caixa/acento/mojibake -> um dos 5 níveis canônicos, ou None."""
    if v is None:
        return None
    k = norm_key(v)  # ex.: "media vulnerabilidade", "muito alta vulnerabilidade"
    if not k or k == "-":
        return None
    k = k.replace("vulnerabilidade", "").strip()
    k = k.replace("muita", "muito")  # "Muita alta" -> "muito alta"
    if k.startswith("muito baixa"):
        return "Muito Baixa"
    if k.startswith("muito alta"):
        return "Muito Alta"
    if k.startswith("baixa"):
        return "Baixa"
    if k.startswith("alta"):
        return "Alta"
    if k.startswith("media"):
        return "Média"
    return "__UNMAPPED__"  # sentinela p/ relatório


# --------------------------------------------------------------------------- #
# Leitura da planilha
# --------------------------------------------------------------------------- #
def load_sheets(path: Path) -> dict[str, list[dict]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheets: dict[str, list[dict]] = {}
    for ws in wb.worksheets:
        data = list(ws.iter_rows(values_only=True))
        if not data:
            sheets[ws.title] = []
            continue
        header = [str(h) if h is not None else f"col{i}" for i, h in enumerate(data[0])]
        rows = []
        for r in data[1:]:
            if any(c is not None and str(c).strip() != "" for c in r):
                rows.append(dict(zip(header, r)))
        sheets[ws.title] = rows
    wb.close()
    return sheets


# --------------------------------------------------------------------------- #
# Campos do tema (system_tema_field_defs) — derivados de CONFIG_FILTROS_PADRAO + CASOS
# type ∈ {text, select, multiselect, money, number, date, boolean}
# --------------------------------------------------------------------------- #
def build_field_defs(casos: list[dict]) -> list[dict]:
    def distinct(col, transform=lambda x: x):
        vals = set()
        for r in casos:
            t = transform(clean_text(r.get(col)))
            if t:
                vals.add(t)
        return sorted(vals)

    ivs_opts = IVS_LEVELS
    tipo_opts = [f"G{i}" for i in range(0, 14)]
    ciclo_opts = distinct("CICLO_ATUAL")
    edital_opts = distinct("EDITAL_ATUAL")
    art_opts = ["10%", "20%", "Não", "N/A"]

    defs = [
        ("status_caso", "Status", "select", [s[1] for s in OP_STAGES]),
        ("ativo_mais_medicos", "Mais Médicos ativo", "boolean", None),
        ("fies", "FIES", "boolean", None),
        ("contrato_operacional_ativo", "Contrato operacional ativo", "boolean", None),
        # DSEI_ATUAL na aba CASOS é um flag Sim/Não ("atua em DSEI?"), não o nome do
        # distrito — 346 'Não', 6 'Sim', 29 nulos. Modelado como boolean (não select).
        ("dsei", "Atua em DSEI", "boolean", None),
        ("municipio_entrada", "Município de entrada", "text", None),
        ("alerta_multiplos_municipios", "Município com alerta", "boolean", None),
        ("classificacao_ivs", "Classificação IVS", "select", ivs_opts),
        ("ivs", "IVS", "number", None),
        ("tipo_grupo", "Tipo/Grupo", "multiselect", tipo_opts),
        ("edital", "Edital", "select", edital_opts),
        ("ciclo", "Ciclo", "multiselect", ciclo_opts),
        ("art_19a_edital", "Art. 19-A (edital)", "multiselect", art_opts),
        ("art_19b_edital", "Art. 19-B (edital)", "multiselect", art_opts),
        ("art_19a_portaria", "Art. 19-A (portaria)", "multiselect", art_opts),
        ("art_19b_portaria", "Art. 19-B (portaria)", "multiselect", art_opts),
        ("cnes", "CNES", "text", None),
        ("classificacao_udh", "Classificação UDH", "text", None),
        ("classificacao_ibp", "Classificação IBP", "text", None),
        ("data_fechamento", "Data de fechamento", "date", None),
        ("data_ultimo_andamento", "Último andamento", "date", None),
    ]
    out = []
    for ordem, (key, label, typ, options) in enumerate(defs):
        out.append({
            "key": key, "label": label, "type": typ,
            "options": options, "ordem": ordem, "scope": "caso",
        })
    return out


# 7 defs de checklist (CONFIG_DOCUMENTOS_SISGIMM), ancoradas na etapa "Documentos iniciais".
CHECKLIST_STAGE_SLUG = "DOCUMENTOS_INICIAIS"

def build_checklist_defs(cfg: list[dict]) -> list[dict]:
    out = []
    for ordem, r in enumerate(cfg):
        cid = clean_text(r.get("ID_CONFIG_DOCUMENTO"))
        name = clean_text(r.get("NOME_DOCUMENTO")) or cid
        key = (cid or f"doc{ordem}").lower().replace("-", "_")
        out.append({
            "key": key,
            "label": name,
            "stage_slug": CHECKLIST_STAGE_SLUG,
            "required": to_bool(r.get("OBRIGATORIO_19A")) or to_bool(r.get("OBRIGATORIO_19B")) or False,
            "config_id": cid,
            "meta": {
                "obrigatorio_19a": to_bool(r.get("OBRIGATORIO_19A")),
                "obrigatorio_19b": to_bool(r.get("OBRIGATORIO_19B")),
                "aplicavel_fies": to_bool(r.get("APLICAVEL_FIES")),
                "aplicavel_nao_fies": to_bool(r.get("APLICAVEL_NAO_FIES")),
            },
        })
    return out


# --------------------------------------------------------------------------- #
# canonical_fields por caso (Opção A)
# --------------------------------------------------------------------------- #
def build_canonical_fields(caso, vinculos_por_caso, periodos_por_caso,
                           sisgimm_por_caso, parcelas_por_caso, warns):
    cf = {}
    cf["status_caso"] = clean_text(caso.get("STATUS_CASO"))
    cf["ativo_mais_medicos"] = to_bool(caso.get("ATIVO_MAIS_MEDICOS"))
    cf["fies"] = to_bool(caso.get("FIES"))
    cf["contrato_operacional_ativo"] = to_bool(caso.get("CONTRATO_OPERACIONAL_ATIVO"))
    cf["dsei"] = to_bool(caso.get("DSEI_ATUAL"))  # flag Sim/Não na origem
    cf["municipio_entrada"] = clean_text(caso.get("MUNICIPIO_ENTRADA_ATUAL"))
    cf["alerta_multiplos_municipios"] = to_bool(caso.get("ALERTA_MULTIPLOS_MUNICIPIOS_EDITAL"))
    ivs_cls = normalize_ivs(caso.get("CLASSIFICACAO_IVS_ATUAL"))
    if ivs_cls == "__UNMAPPED__":
        warns["ivs_unmapped"].append((caso.get("ID_CASO"), repr(caso.get("CLASSIFICACAO_IVS_ATUAL"))))
        ivs_cls = None
    cf["classificacao_ivs"] = ivs_cls
    cf["ivs"] = to_number(caso.get("IVS_ATUAL"))
    cf["tipo_grupo"] = clean_text(caso.get("TIPO_GRUPO"))
    cf["edital"] = clean_text(caso.get("EDITAL_ATUAL"))
    cf["ciclo"] = clean_text(caso.get("CICLO_ATUAL"))
    for src, dst in [("ART_19A_EDITAL_ATUAL", "art_19a_edital"),
                     ("ART_19B_EDITAL_ATUAL", "art_19b_edital"),
                     ("ART_19A_PORTARIA_ATUAL", "art_19a_portaria"),
                     ("ART_19B_PORTARIA_ATUAL", "art_19b_portaria")]:
        n = to_number(caso.get(src))
        raw = clean_text(caso.get(src))
        cf[dst] = (f"{round(n*100)}%" if (n is not None and n <= 1) else raw)
    cf["cnes"] = clean_text(caso.get("CNES"))
    cf["classificacao_udh"] = clean_text(caso.get("CLASSIFICACAO_UDH"))
    cf["classificacao_ibp"] = clean_text(caso.get("CLASSIFICACAO_IBP"))
    cf["data_fechamento"] = to_iso_date(caso.get("DATA_FECHAMENTO"))
    cf["data_ultimo_andamento"] = to_iso_date(caso.get("DATA_ULTIMO_ANDAMENTO"))

    cf["periodo_atual"] = {
        "inicio": to_iso_date(caso.get("PERIODO_ATUAL_INICIO")),
        "fim": to_iso_date(caso.get("PERIODO_ATUAL_FIM")),
        "texto": clean_text(caso.get("PERIODO_ATUAL_TEXTO")),
    }

    cid = caso.get("ID_CASO")

    # SISGIMM (estado atual — board completo fica p/ A3)
    sg = sisgimm_por_caso.get(cid)
    if sg:
        cf["sisgimm"] = {
            "etapa": clean_text(sg.get("ETAPA_SISGIMM_ATUAL")),
            "status_doc": clean_text(sg.get("STATUS_DOCUMENTACAO_CALCULADO")),
            "comunicacao_feita": to_bool(sg.get("COMUNICACAO_SISGIMM_FEITA")),
            "acesso": clean_text(sg.get("ACESSO_SISGIMM")),
            "solicitado_1a_parcela": to_bool(sg.get("SOLICITADO_SISGIMM_1_PARCELA")),
            "status_pedido": clean_text(sg.get("STATUS_PEDIDO_SISGIMM")),
            "obs": clean_text(sg.get("OBSERVACOES_SISGIMM")),
        }

    # Resumo de parcelas (contagem por status) — NÃO vai p/ system_parcelas.
    parc = parcelas_por_caso.get(cid, [])
    if parc:
        counter = Counter(norm_key(p.get("STATUS_PARCELA")) for p in parc)
        cf["parcelas_resumo"] = {
            "nao_solicitada": counter.get("nao solicitada", 0),
            "solicitada": counter.get("solicitada", 0),
            "deferida": counter.get("deferida", 0),
            "indeferida": counter.get("indeferida", 0),
            "paga": counter.get("paga", 0),
            "total": len(parc),
        }

    # Histórico de vínculos (Opção A) — todos os vínculos que NÃO são o atual.
    hist = []
    for v in vinculos_por_caso.get(cid, []):
        if to_bool(v.get("E_VINCULO_ATUAL")) is True:
            continue
        hist.append({
            "id": clean_text(v.get("ID_VINCULO")),
            "ordem": clean_text(v.get("ORDEM_VINCULO")),
            "dsei": clean_text(v.get("DSEI")),
            "municipio": clean_text(v.get("MUNICIPIO")),
            "ivs_classificacao": normalize_ivs(v.get("CLASSIFICACAO_IVS")),
            "edital": clean_text(v.get("EDITAL")),
            "ciclo": clean_text(v.get("CICLO")),
            "periodo": clean_text(v.get("PERIODO_TEXTO")),
            "periodo_inicio": to_iso_date(v.get("PERIODO_INICIO")),
            "periodo_fim": to_iso_date(v.get("PERIODO_FIM")),
        })
    if hist:
        cf["vinculos_historico"] = hist

    per = []
    for p in periodos_por_caso.get(cid, []):
        per.append({
            "vinculo": clean_text(p.get("ID_VINCULO")),
            "inicio": to_iso_date(p.get("DATA_INICIO")),
            "fim": to_iso_date(p.get("DATA_FIM")),
            "atual": to_bool(p.get("E_PERIODO_ATUAL")),
        })
    if per:
        cf["periodos_atuacao"] = per

    cf["import_batch"] = IMPORT_BATCH
    # Chave de idempotência ESTÁVEL do caso = ID_CASO (globalmente único na origem).
    # NÃO usamos só o case_code como chave pq há ID_CASO hex (ex.: CASO-3fa6552b)
    # que colidiriam no NNNN derivado. O src_id é a fonte de verdade do find-or-create.
    if cid is not None:
        cf["import_src_id"] = str(cid)
    # remove chaves None de topo p/ enxugar (mantém sub-objetos)
    return {k: v for k, v in cf.items() if v is not None}


# --------------------------------------------------------------------------- #
# DB (opcional no dry-run) — só LEITURA de metadados
# --------------------------------------------------------------------------- #
def read_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.split("#", 1)[0].strip() if not v.strip().startswith('"') else v.strip()
    return env

def connect_db(env):
    try:
        import psycopg2
    except ImportError:
        return None, "psycopg2 não instalado"
    ref = env.get("SUPABASE_PROJECT_REF")
    pw = env.get("SUPABASE_DB_PASSWORD")
    if not ref or not pw:
        return None, "faltam SUPABASE_PROJECT_REF/PASSWORD"
    hosts = [(f"db.{ref}.supabase.co", "postgres")] + [
        (f"aws-0-{r}.pooler.supabase.com", f"postgres.{ref}")
        for r in ("sa-east-1", "us-east-1", "us-east-2", "us-west-1", "eu-central-1")
    ]
    for h, u in hosts:
        try:
            conn = psycopg2.connect(host=h, port=5432, user=u, password=pw,
                                    dbname="postgres", sslmode="require", connect_timeout=8)
            return conn, h
        except Exception:
            continue
    return None, "sem conexão em nenhum host"

def probe_db(conn):
    """Lê metadados relevantes p/ o dry-run (existência de tema/service_type, casos já importados)."""
    info = {}
    cur = conn.cursor()
    cur.execute("select id,name,slug from system_temas where deleted_at is null and (name ilike %s or slug ilike %s)",
                ("%dico%", "%MEDICO%"))
    info["temas_mm"] = cur.fetchall()
    cur.execute("select id,name,slug,tema_id from system_service_types where deleted_at is null and (name ilike %s or slug ilike %s)",
                ("%dico%", "%MEDICO%"))
    info["service_types_mm"] = cur.fetchall()
    cur.execute("select count(*) from system_cases where case_code like %s and deleted_at is null",
                (f"{CASE_CODE_PREFIX}-%",))
    info["cases_prefix"] = cur.fetchone()[0]
    cur.execute("select count(*) from system_clients where cpf_cnpj like 'CL-%%' and organization_id=%s and deleted_at is null",
                (DEFAULT_ORG,))
    info["clients_marker"] = cur.fetchone()[0]
    cur.close()
    return info


# --------------------------------------------------------------------------- #
# DRY-RUN
# --------------------------------------------------------------------------- #
def group_by(rows, col):
    d = defaultdict(list)
    for r in rows:
        d[r.get(col)].append(r)
    return d

def run_dry(sheets, env, use_db):
    L = []
    def p(*a):
        L.append(" ".join(str(x) for x in a))

    casos = sheets.get("CASOS", [])
    vinculos = sheets.get("VINCULOS_ATUACAO", [])
    periodos = sheets.get("PERIODOS_ATUACAO", [])
    sisgimm = sheets.get("SISGIMM", [])
    parcelas = sheets.get("PARCELAS_SISGIMM", [])
    documentos = sheets.get("DOCUMENTOS_SISGIMM", [])
    cfg_docs = sheets.get("CONFIG_DOCUMENTOS_SISGIMM", [])
    observ = sheets.get("OBSERVACOES_CASO", [])
    andamentos = sheets.get("ANDAMENTOS_CASO", [])
    cfg_filtros = sheets.get("CONFIG_FILTROS_PADRAO", [])
    cfg_etapas = sheets.get("CONFIG_ETAPAS_FLUXO", [])
    docs_iniciais = sheets.get("DOCUMENTOS_INICIAIS", [])

    vin_por_caso = group_by(vinculos, "ID_CASO")
    per_por_caso = group_by(periodos, "ID_CASO")
    sg_por_caso = {r.get("ID_CASO"): r for r in sisgimm}
    parc_por_caso = group_by(parcelas, "ID_CASO")
    doc_por_caso = group_by(documentos, "ID_CASO")

    warns = defaultdict(list)

    p("=" * 78)
    p("  RELATÓRIO DRY-RUN — Importação Mais Médicos (Story A8)")
    p("  gerado em", datetime.now().isoformat(timespec="seconds"))
    p("  fonte:", XLSX_PATH.name)
    p("  MODO: DRY-RUN — NENHUMA linha escrita. Grava só no --execute (não rodado).")
    p("=" * 78)

    # --- 1. Metadados do banco -------------------------------------------- #
    p("\n[1] BANCO (leitura de metadados)")
    db_info = None
    if use_db:
        conn, host = connect_db(env)
        if conn:
            p("    conectado via:", host)
            try:
                db_info = probe_db(conn)
                p("    temas 'Mais Médicos' existentes:", db_info["temas_mm"] or "nenhum")
                p("    service_types 'Mais Médicos' existentes:")
                for st in db_info["service_types_mm"]:
                    p("       id=%s slug=%s tema_id=%s" % (st[0], st[2], st[3]))
                p("    casos com prefixo %s-* já no banco:" % CASE_CODE_PREFIX, db_info["cases_prefix"])
                p("    clientes com cpf_cnpj 'CL-*' já no banco:", db_info["clients_marker"])
            finally:
                conn.close()
        else:
            p("    SEM conexão (%s) — validando só a planilha." % host)
    else:
        p("    --no-db: pulando leitura do banco (validando só a planilha).")

    # --- 2. Tema / service_type / etapas ---------------------------------- #
    p("\n[2] TEMA + SERVICE_TYPE + ETAPAS OP (board 'Contratos')")
    p("    tema a criar: '%s' (slug MAIS_MEDICOS) — 1 registro" % TEMA_NAME)
    p("    prefixo case_code derivado do nome do tema: '%s' (case_code = %s-2026-NNNN)"
      % (CASE_CODE_PREFIX, CASE_CODE_PREFIX))
    p("    NOTA: prefixo real é '%s' (NÃO 'MM' como o resumo da task sugeria) —" % CASE_CODE_PREFIX)
    p("          caseCodePrefix('Mais Médicos') remove acentos/espaços.")
    p("    etapas op a criar (kind=op):", len(OP_STAGES))
    for slug, label, role, ordem in OP_STAGES:
        p("       - %-22s %-26s role=%s" % (slug, label, role))
    p("    board SISGIMM: NÃO criado nesta story (fica p/ A3).")
    # anomalia: service_type já existe sem tema
    if db_info and db_info.get("service_types_mm"):
        sts = db_info["service_types_mm"]
        orphan = [s for s in sts if s[3] is None]
        if orphan:
            warns["service_type_orfao"] = orphan
            p("    ⚠ ATENÇÃO: já existe service_type 'Mais Médicos' SEM tema vinculado:")
            for s in orphan:
                p("        id=%s slug=%s (tema_id NULL)" % (s[0], s[2]))
            p("      → No --execute o createTema criará o service_type ESPELHO com slug")
            p("        sufixado (ex.: MAIS_MEDICOS_T) p/ não colidir na UNIQUE(org,slug).")
            p("        DECISÃO p/ owner: (a) reusar este service_type legado como espelho")
            p("        do tema, ou (b) deixar o createTema criar um novo (MAIS_MEDICOS_T).")

    # --- 3. Campos do tema ------------------------------------------------- #
    p("\n[3] CAMPOS DO TEMA (system_tema_field_defs)")
    field_defs = build_field_defs(casos)
    p("    defs a criar:", len(field_defs))
    by_type = Counter(d["type"] for d in field_defs)
    p("    por type:", dict(by_type))
    for d in field_defs:
        opts = ("[%d opts]" % len(d["options"])) if d["options"] else ""
        p("       - %-28s %-11s %s" % (d["key"], d["type"], opts))
    # campos *_CALCULADO explicitamente descartados como def editável
    calc = [clean_text(r.get("CAMPO_BASE")) for r in cfg_filtros
            if clean_text(r.get("CAMPO_BASE")) and "CALCULADO" in str(r.get("CAMPO_BASE"))]
    p("    campos *_CALCULADO (NÃO viram def editável, derivam de canonical.sisgimm):", calc)

    # --- 4. Checklist defs ------------------------------------------------- #
    p("\n[4] CHECKLIST DEFS (system_stage_checklist_defs)")
    chk_defs = build_checklist_defs(cfg_docs)
    p("    defs a criar:", len(chk_defs), "| ancoradas na etapa:", CHECKLIST_STAGE_SLUG)
    for d in chk_defs:
        p("       - %-14s %-46s req=%s" % (d["key"], (d["label"] or "")[:46], d["required"]))
    if docs_iniciais:
        p("    CONFIG_DOCUMENTOS_INICIAIS: %d defs; DOCUMENTOS_INICIAIS instâncias: %d"
          % (len(sheets.get("CONFIG_DOCUMENTOS_INICIAIS", [])), len(docs_iniciais)))
    else:
        p("    DOCUMENTOS_INICIAIS: 0 instâncias → descartado (confirmar 2ª lista com owner p/ depois).")

    # --- 5. Clientes ------------------------------------------------------- #
    p("\n[5] CLIENTES (system_clients)")
    p("    linhas em CASOS:", len(casos))
    blank_nome = [r for r in casos if not clean_text(r.get("NOME"))]
    dup_cli = [k for k, n in Counter(r.get("ID_CLIENTE_INTERNO") for r in casos).items() if n > 1]
    marker_cpf = sum(1 for r in casos if clean_text(r.get("ID_CLIENTE_INTERNO")))
    p("    clientes a criar (find-or-create por cpf_cnpj=ID_CLIENTE_INTERNO):", len(casos))
    p("    CPFs → marcador 'CL-XXXX' (todos, base sem CPF):", marker_cpf)
    p("    email/phone: nulos (preencher depois via ficha)")
    p("    pasta no Drive: CRIADA no --execute (dry-run apenas reporta que criaria %d pastas)" % len(casos))
    if blank_nome:
        warns["nome_vazio"] = [r.get("ID_CLIENTE_INTERNO") for r in blank_nome]
    if dup_cli:
        warns["cliente_duplicado"] = dup_cli

    # --- 6. Casos ---------------------------------------------------------- #
    p("\n[6] CASOS (system_cases, lifecycle=CLIENTE)")
    stage_counter = Counter()
    multi_vinculo = 0
    unknown_status = []
    sample_cf = None
    for r in casos:
        cid = r.get("ID_CASO")
        stkey = norm_key(r.get("STATUS_CASO"))
        stage = STATUS_TO_STAGE.get(stkey)
        if stage is None:
            stage = FALLBACK_STAGE
            unknown_status.append((cid, repr(r.get("STATUS_CASO"))))
        stage_counter[stage] += 1
        if len(vin_por_caso.get(cid, [])) > 1:
            multi_vinculo += 1
        cf = build_canonical_fields(r, vin_por_caso, per_por_caso, sg_por_caso, parc_por_caso, warns)
        if cid == "CASO-0001":
            sample_cf = cf
    p("    casos a criar (find-or-create por case_code):", len(casos))
    p("    lifecycle: CLIENTE (todos)")
    p("    distribuição macrostatus_op (mapeado de STATUS_CASO):")
    for slug, label, *_ in OP_STAGES:
        p("       - %-22s %-26s %d" % (slug, label, stage_counter.get(slug, 0)))
    p("    casos com MÚLTIPLOS vínculos (histórico preservado, Opção A):", multi_vinculo)
    p("    STATUS_CASO nulo/desconhecido → fallback '%s':" % FALLBACK_STAGE, len(unknown_status))
    for cid, raw in unknown_status:
        p("        - %s status=%s" % (cid, raw))
    if sample_cf is not None:
        p("    exemplo canonical_fields (CASO-0001):")
        for line in json.dumps(sample_cf, ensure_ascii=False, indent=2, default=str).splitlines():
            p("        " + line)

    # --- 7. Notas + Andamentos -------------------------------------------- #
    p("\n[7] TIMELINE (notas + andamentos)")
    valid_case_ids = set(r.get("ID_CASO") for r in casos)
    obs_orfa = [r for r in observ if r.get("ID_CASO") not in valid_case_ids]
    obs_sem_autor = [r for r in observ if not clean_text(r.get("USUARIO_NOME"))]
    p("    OBSERVACOES_CASO → system_case_notes:", len(observ),
      "(autoria em TEXTO no corpo: '[Beta: <nome>] ...')")
    p("       observações órfãs (ID_CASO inexistente em CASOS):", len(obs_orfa))
    p("       observações sem autor:", len(obs_sem_autor))
    p("       autores distintos:", dict(Counter(clean_text(r.get("USUARIO_NOME")) or "(vazio)" for r in observ)))
    and_orfa = [r for r in andamentos if r.get("ID_CASO") not in valid_case_ids]
    p("    ANDAMENTOS_CASO → system_case_events:", len(andamentos), "(autor em diff.autor_texto)")
    p("       andamentos órfãos:", len(and_orfa))
    p("       tipos:", dict(Counter(norm_key(r.get("TIPO_ANDAMENTO")) for r in andamentos)))
    if obs_orfa:
        warns["obs_orfa"] = [r.get("ID_OBSERVACAO") for r in obs_orfa]
    if and_orfa:
        warns["and_orfa"] = [r.get("ID_ANDAMENTO") for r in and_orfa]

    # --- 8. Checklist por caso -------------------------------------------- #
    p("\n[8] CHECKLIST POR CASO (system_case_checklist_items)")
    doc_status = Counter(norm_key(r.get("STATUS_DOCUMENTO")) for r in documentos)
    p("    DOCUMENTOS_SISGIMM → items:", len(documentos))
    p("    casos distintos com documentos:", len(doc_por_caso))
    p("    status: OK=%d pendente=%d outros=%d"
      % (doc_status.get("ok", 0), doc_status.get("pendente", 0),
         len(documentos) - doc_status.get("ok", 0) - doc_status.get("pendente", 0)))
    doc_orfao = [r for r in documentos if r.get("ID_CASO") not in valid_case_ids]
    p("    itens órfãos (ID_CASO inexistente):", len(doc_orfao))
    casos_sem_doc = valid_case_ids - set(doc_por_caso.keys())
    p("    casos SEM nenhum documento na base:", len(casos_sem_doc))
    if doc_orfao:
        warns["doc_orfao"] = [r.get("ID_DOCUMENTO_CASO") for r in doc_orfao]

    # --- 9. Parcelas / escopo A3 ------------------------------------------ #
    p("\n[9] PARCELAS SISGIMM (NÃO importadas — resumo em canonical_fields)")
    p("    PARCELAS_SISGIMM lidas:", len(parcelas),
      "| status:", dict(Counter(norm_key(r.get("STATUS_PARCELA")) for r in parcelas)))
    p("    system_parcelas a inserir: 0 (esteira completa → story A3)")
    p("    SISGIMM (estado atual) resumido em canonical.sisgimm p/", len(sisgimm), "casos")

    # --- 10. Descartados --------------------------------------------------- #
    p("\n[10] DESCARTADOS / ADIADOS")
    p("    EVENTOS_AUDITORIA:", len(sheets.get("EVENTOS_AUDITORIA", [])), "linhas → DESCARTAR")
    p("    USUARIOS_SISTEMA:", len(sheets.get("USUARIOS_SISTEMA", [])),
      "→ NÃO cria usuário-que-loga (autoria = texto; Auth → item 11)")
    p("    board SISGIMM + esteira de parcelas → A3")

    # --- 11. Encoding / mojibake ------------------------------------------ #
    p("\n[11] ENCODING / MOJIBAKE")
    moji_fields = Counter()
    for r in casos:
        for col in ("NOME", "STATUS_CASO", "MUNICIPIO_ENTRADA_ATUAL", "CLASSIFICACAO_IVS_ATUAL",
                    "CICLO_ATUAL", "DSEI_ATUAL", "EDITAL_ATUAL"):
            if has_mojibake(r.get(col)):
                moji_fields[col] += 1
    moji_nome = [r.get("ID_CLIENTE_INTERNO") for r in casos if has_mojibake(r.get("NOME"))]
    p("    caractere U+FFFD (irrecuperável na origem) por coluna em CASOS:", dict(moji_fields) or "nenhum")
    if moji_nome:
        p("    ⚠ NOME de cliente com mojibake (afeta pasta Drive + case_code):", moji_nome)
        warns["nome_mojibake"] = moji_nome
    else:
        p("    NOMEs de cliente: sem mojibake (pastas do Drive OK).")
    p("    OBS: STATUS_CASO/IVS com mojibake (ex.: 'Rescis�o', 'M�dia') são")
    p("         normalizados por norm_key() → o mapeamento de etapa/IVS casa mesmo assim.")

    # --- 12. Resumo de anomalias ------------------------------------------ #
    p("\n[12] ANOMALIAS / AVISOS (resumo)")
    if not warns:
        p("    nenhuma anomalia bloqueante.")
    for k, v in warns.items():
        n = len(v) if isinstance(v, list) else v
        sample = v[:5] if isinstance(v, list) else v
        p("    - %-22s %s   ex.: %s" % (k, n, sample))

    # --- 13. Idempotência -------------------------------------------------- #
    p("\n[13] ESTRATÉGIA DE IDEMPOTÊNCIA (aplicada no --execute)")
    p("    - tema:      find-or-create por (organization_id, slug='MAIS_MEDICOS')")
    p("    - campo def: por (tema_id, key)")
    p("    - checklist def: por (service_type_id, stage_slug, key)")
    p("    - cliente:   por (organization_id, cpf_cnpj='CL-XXXX')  [UNIQUE parcial]")
    p("    - caso:      por case_code (%s-2026-NNNN) OU por client_id+tema_id" % CASE_CODE_PREFIX)
    p("    - nota:      body carimba '[src:ID_OBSERVACAO]'; skip se já existe p/ o caso")
    p("    - evento:    diff.src_id=ID_ANDAMENTO; skip se já existe")
    p("    - checklist item: por (case_id, def_id); pastas do Drive só se drive_folder_id NULL")
    p("    Re-rodar --execute NÃO duplica; retoma de onde parou (útil p/ rate limit do Drive).")

    p("\n" + "=" * 78)
    total_anom = sum((len(v) if isinstance(v, list) else v) for v in warns.values())
    p("  FIM DO DRY-RUN. Nada foi escrito. Total de avisos:", total_anom)
    p("=" * 78)

    report = "\n".join(L)
    print(report)
    # salva cópia p/ anexar à story
    out = REPO_ROOT / "docs" / "stories" / "reuniao-2026-08-03" / "A8-dry-run-report.md"
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("```\n" + report + "\n```\n", encoding="utf-8")
        print("\n[relatório salvo em %s]" % out.relative_to(REPO_ROOT))
    except Exception as e:
        print("\n[não consegui salvar o relatório: %s]" % e)
    return warns


# --------------------------------------------------------------------------- #
# EXECUTE — gravação em PRODUÇÃO (idempotente, transação por etapa)
# --------------------------------------------------------------------------- #
def _connect_execute(env):
    """Conexão dedicada p/ o --execute (autocommit por bloco controlado a mão)."""
    conn, host = connect_db(env)
    if not conn:
        print("ERRO: sem conexão ao banco (%s). Abortando --execute." % host, file=sys.stderr)
        sys.exit(2)
    conn.autocommit = False
    return conn, host


def _jsonb(v):
    """Serializa p/ jsonb no psycopg2 (usa Json wrapper)."""
    from psycopg2.extras import Json
    return Json(v)


def run_execute(sheets, env, skip_drive=False):
    import subprocess
    from psycopg2.extras import execute_values

    casos = sheets.get("CASOS", [])
    vinculos = sheets.get("VINCULOS_ATUACAO", [])
    periodos = sheets.get("PERIODOS_ATUACAO", [])
    sisgimm = sheets.get("SISGIMM", [])
    parcelas = sheets.get("PARCELAS_SISGIMM", [])
    documentos = sheets.get("DOCUMENTOS_SISGIMM", [])
    cfg_docs = sheets.get("CONFIG_DOCUMENTOS_SISGIMM", [])
    observ = sheets.get("OBSERVACOES_CASO", [])
    andamentos = sheets.get("ANDAMENTOS_CASO", [])

    vin_por_caso = group_by(vinculos, "ID_CASO")
    per_por_caso = group_by(periodos, "ID_CASO")
    sg_por_caso = {r.get("ID_CASO"): r for r in sisgimm}
    parc_por_caso = group_by(parcelas, "ID_CASO")
    doc_por_caso = group_by(documentos, "ID_CASO")
    warns = defaultdict(list)

    field_defs = build_field_defs(casos)
    chk_defs = build_checklist_defs(cfg_docs)

    conn, host = _connect_execute(env)
    print("=" * 78)
    print("  EXECUTE — Importação Mais Médicos (Story A8) — GRAVANDO EM PRODUÇÃO")
    print("  conectado via:", host)
    print("  início:", datetime.now().isoformat(timespec="seconds"))
    print("=" * 78)

    counts = defaultdict(int)
    cur = conn.cursor()

    # ---------------------------------------------------------------- 1) TEMA
    # Idempotência: find por (org, slug='MAIS_MEDICOS') ativo. Se não existe, cria.
    cur.execute(
        "select id from system_temas where organization_id=%s and slug=%s and deleted_at is null",
        (DEFAULT_ORG, "MAIS_MEDICOS"),
    )
    row = cur.fetchone()
    if row:
        tema_id = row[0]
        print("[1] TEMA já existe (reuso): %s" % tema_id)
    else:
        cur.execute(
            "insert into system_temas (organization_id, name, slug, ordem) "
            "values (%s,%s,%s,%s) returning id",
            (DEFAULT_ORG, TEMA_NAME, "MAIS_MEDICOS", 0),
        )
        tema_id = cur.fetchone()[0]
        counts["tema"] += 1
        print("[1] TEMA criado: %s" % tema_id)
    conn.commit()

    # --------------------------------------------- 2) SERVICE_TYPE (REUSO) + etapas
    # Decisão #1 do owner: REUSAR o service_type MAIS_MEDICOS já existente (sem
    # tema_id) como espelho — vincular tema_id. NÃO criar MAIS_MEDICOS_T.
    cur.execute(
        "select id, tema_id from system_service_types "
        "where organization_id=%s and slug=%s and deleted_at is null",
        (DEFAULT_ORG, "MAIS_MEDICOS"),
    )
    strow = cur.fetchone()
    if not strow:
        print("ERRO: service_type MAIS_MEDICOS esperado (decisão #1) não encontrado. "
              "Abortando p/ decisão do owner.", file=sys.stderr)
        conn.rollback(); conn.close(); sys.exit(2)
    service_type_id, st_tema_id = strow
    if st_tema_id is None:
        cur.execute(
            "update system_service_types set tema_id=%s, name=%s where id=%s",
            (tema_id, TEMA_NAME, service_type_id),
        )
        print("[2] service_type %s VINCULADO ao tema (tema_id set)" % service_type_id)
    elif st_tema_id != tema_id:
        print("ERRO: service_type MAIS_MEDICOS já vinculado a OUTRO tema (%s). "
              "Abortando p/ decisão do owner." % st_tema_id, file=sys.stderr)
        conn.rollback(); conn.close(); sys.exit(2)
    else:
        print("[2] service_type %s já vinculado a este tema (idempotente)" % service_type_id)

    # Garante as 7 etapas op "Contratos". A UNIQUE(service_type_id, kind, slug) é
    # FULL (ignora deleted_at) — existem etapas op pré-existentes ATIVAS e também
    # SOFT-DELETADAS (ex.: um 'ENCERRADO' soft-deletado antigo). Por isso NÃO fazemos
    # insert-if-absent (colidiria com a linha soft-deletada): fazemos REVIVE/UPSERT.
    #   1) soft-delete das etapas op que NÃO são do board Contratos (seguro: 0 casos);
    #   2) para cada slug Contratos: se já existe (ativo OU soft-deletado) → UPDATE
    #      revivendo (deleted_at=NULL, active=true, label/role/ordem certos); senão INSERT.
    cur.execute(
        "update system_pipeline_stages set deleted_at=now(), active=false "
        "where service_type_id=%s and kind='op' and deleted_at is null and slug <> ALL(%s)",
        (service_type_id, list(OP_STAGE_SLUGS)),
    )
    soft_deleted = cur.rowcount
    seeded = 0
    revived = 0
    for slug, label, role, ordem in OP_STAGES:
        cur.execute(
            "select id, deleted_at from system_pipeline_stages "
            "where service_type_id=%s and kind='op' and slug=%s",
            (service_type_id, slug),
        )
        r = cur.fetchone()
        if r:
            cur.execute(
                "update system_pipeline_stages "
                "set deleted_at=NULL, active=true, label=%s, stage_role=%s, ordem=%s "
                "where id=%s",
                (label, role, ordem, r[0]),
            )
            if r[1] is not None:
                revived += 1
        else:
            cur.execute(
                "insert into system_pipeline_stages "
                "(organization_id, service_type_id, kind, slug, label, stage_role, ordem) "
                "values (%s,%s,'op',%s,%s,%s,%s)",
                (DEFAULT_ORG, service_type_id, slug, label, role, ordem),
            )
            seeded += 1
    counts["op_stages"] += seeded
    print("[2] etapas op Contratos: %d inseridas, %d revividas, %d genéricas soft-deletadas"
          % (seeded, revived, soft_deleted))
    conn.commit()

    # ---------------------------------------------------- 3) CAMPOS DO TEMA (defs)
    for d in field_defs:
        cur.execute(
            "select id from system_tema_field_defs "
            "where tema_id=%s and coalesce(frente_slug,'')='' and key=%s and deleted_at is null",
            (tema_id, d["key"]),
        )
        if cur.fetchone():
            continue
        cur.execute(
            "insert into system_tema_field_defs "
            "(organization_id, tema_id, key, label, type, options, ordem, scope) "
            "values (%s,%s,%s,%s,%s,%s,%s,%s)",
            (DEFAULT_ORG, tema_id, d["key"], d["label"], d["type"],
             _jsonb(d["options"]) if d["options"] else None, d["ordem"], d["scope"]),
        )
        counts["field_defs"] += 1
    print("[3] campos do tema inseridos:", counts["field_defs"])
    conn.commit()

    # ---------------------------------------------------- 4) CHECKLIST DEFS
    # key = doc_config_00X (de ID_CONFIG_DOCUMENTO). Mapeia config_id -> def_id p/
    # instanciar os itens depois. Idempotência por (service_type, stage_slug, key).
    config_to_def = {}
    for d in chk_defs:
        cur.execute(
            "select id from system_stage_checklist_defs "
            "where service_type_id=%s and stage_slug=%s and key=%s and coalesce(frente_slug,'')='' "
            "and deleted_at is null",
            (service_type_id, d["stage_slug"], d["key"]),
        )
        r = cur.fetchone()
        if r:
            def_id = r[0]
        else:
            cur.execute(
                "insert into system_stage_checklist_defs "
                "(organization_id, service_type_id, stage_slug, key, label, ordem, required) "
                "values (%s,%s,%s,%s,%s,%s,%s) returning id",
                (DEFAULT_ORG, service_type_id, d["stage_slug"], d["key"], d["label"],
                 chk_defs.index(d), d["required"]),
            )
            def_id = cur.fetchone()[0]
            counts["checklist_defs"] += 1
        if d.get("config_id"):
            config_to_def[str(d["config_id"]).strip()] = def_id
    print("[4] checklist defs inseridos:", counts["checklist_defs"])
    conn.commit()

    # ---------------------------------------------------- 5) CLIENTES
    # Idempotência por (org, cpf_cnpj='CL-XXXX'). custom_fields marca o batch +
    # cpf_pendente. Pasta do Drive: criada depois pelo helper Node (NÃO-FATAL).
    cliente_por_cid = {}   # ID_CLIENTE_INTERNO -> client uuid
    for r in casos:
        cli = clean_text(r.get("ID_CLIENTE_INTERNO"))
        nome = clean_text(r.get("NOME")) or (cli or "SEM NOME")
        if not cli:
            warns["cliente_sem_marcador"].append(r.get("ID_CASO"))
            continue
        cur.execute(
            "select id from system_clients where organization_id=%s and cpf_cnpj=%s and deleted_at is null",
            (DEFAULT_ORG, cli),
        )
        ex = cur.fetchone()
        if ex:
            cliente_por_cid[cli] = ex[0]
            continue
        cf = {"import_batch": IMPORT_BATCH, "cpf_pendente": True}
        cur.execute(
            "insert into system_clients "
            "(organization_id, full_name, cpf_cnpj, person_type, custom_fields, drive_sync_failed) "
            "values (%s,%s,%s,'PF',%s,false) returning id",
            (DEFAULT_ORG, nome, cli, _jsonb(cf)),
        )
        cliente_por_cid[cli] = cur.fetchone()[0]
        counts["clientes"] += 1
    conn.commit()
    print("[5] clientes inseridos:", counts["clientes"],
          "| total resolvidos:", len(cliente_por_cid))

    # ---------------------------------------------------- 6) CASOS
    # Idempotência ESTÁVEL por canonical_fields->>'import_src_id' = ID_CASO (a fonte
    # de verdade — ID_CASO é único na origem). O case_code é apenas o rótulo público:
    # MAISMEDICOS-2026-NNNN derivado do NNNN de "CASO-NNNN". ATENÇÃO: 13 ID_CASO são
    # hex (ex.: CASO-3fa6552b) cujo NNNN derivado colidiria com CASO-0003 etc.; quando
    # o code natural já está tomado (nesta run OU no banco), alocamos via a sequence
    # nextval_seq_system_case_code (mesma do app) p/ garantir UNIQUE(case_code).
    caso_por_cid = {}  # ID_CASO -> case uuid
    used_codes = set()

    def natural_code(id_caso):
        m = re.match(r"^CASO-(\d{1,4})$", str(id_caso or "").strip())
        if m:
            return "%s-2026-%04d" % (CASE_CODE_PREFIX, int(m.group(1)))
        return None

    def alloc_code(id_caso):
        code = natural_code(id_caso)
        if code and code not in used_codes:
            cur.execute("select 1 from system_cases where case_code=%s", (code,))
            if not cur.fetchone():
                used_codes.add(code)
                return code
        # Colisão (hex id ou já usado) → aloca da sequence do app até achar livre.
        for _ in range(1000):
            cur.execute("select nextval_seq_system_case_code()")
            n = cur.fetchone()[0]
            cand = "%s-2026-%04d" % (CASE_CODE_PREFIX, int(n))
            if cand in used_codes:
                continue
            cur.execute("select 1 from system_cases where case_code=%s", (cand,))
            if cur.fetchone():
                continue
            used_codes.add(cand)
            return cand
        raise RuntimeError("não consegui alocar case_code único p/ %s" % id_caso)

    for r in casos:
        id_caso = r.get("ID_CASO")
        cli = clean_text(r.get("ID_CLIENTE_INTERNO"))
        client_uuid = cliente_por_cid.get(cli)
        if not client_uuid:
            warns["caso_sem_cliente"].append(id_caso)
            continue
        # find-or-create pela chave estável (import_src_id).
        cur.execute(
            "select id, case_code from system_cases "
            "where tema_id=%s and canonical_fields->>'import_src_id'=%s and deleted_at is null",
            (tema_id, str(id_caso)),
        )
        ex = cur.fetchone()
        if ex:
            caso_por_cid[id_caso] = ex[0]
            used_codes.add(ex[1])
            continue
        code = alloc_code(id_caso)
        stkey = norm_key(r.get("STATUS_CASO"))
        stage = STATUS_TO_STAGE.get(stkey) or FALLBACK_STAGE
        cf = build_canonical_fields(r, vin_por_caso, per_por_caso, sg_por_caso, parc_por_caso, warns)
        municipio = clean_text(r.get("MUNICIPIO_ENTRADA_ATUAL"))
        # lifecycle=CLIENTE exige (CHECK) que NÃO seja LEAD quando assinatura_liberada
        # está preenchida; aqui setamos lifecycle=CLIENTE + assinatura_liberada_at
        # (base já é de clientes assinados/operacionais).
        now_iso = datetime.now().isoformat()
        cur.execute(
            "insert into system_cases "
            "(organization_id, client_id, case_code, case_type, tema_id, service_type_id, "
            " macrostatus_op, macrostatus_fin, lifecycle, assinatura_liberada_at, "
            " municipio, canonical_fields) "
            "values (%s,%s,%s,%s,%s,%s,%s,'NAO_APLICAVEL','CLIENTE',%s,%s,%s) returning id",
            (DEFAULT_ORG, client_uuid, code, "MAIS_MEDICOS", tema_id, service_type_id,
             stage, now_iso, municipio, _jsonb(cf)),
        )
        caso_por_cid[id_caso] = cur.fetchone()[0]
        counts["casos"] += 1
        # 'created' event (idempotente: só p/ casos recém-criados)
        cur.execute(
            "insert into system_case_events (case_id, organization_id, action, to_macrostatus_op, diff) "
            "values (%s,%s,'created',%s,%s)",
            (caso_por_cid[id_caso], DEFAULT_ORG, stage,
             _jsonb({"import_batch": IMPORT_BATCH, "src_id": id_caso})),
        )
        if counts["casos"] % 100 == 0:
            conn.commit()
            print("    ... %d casos" % counts["casos"])
    conn.commit()
    print("[6] casos inseridos:", counts["casos"], "| total resolvidos:", len(caso_por_cid))

    # ---------------------------------------------------- 7) NOTAS (OBSERVACOES_CASO)
    # Idempotência: body carimba '[src:ID_OBSERVACAO]'; skip se já existe p/ o caso.
    # Autoria em TEXTO: prefixo '[Beta: <nome>]' (system_case_notes não tem autor-texto).
    for r in observ:
        id_obs = clean_text(r.get("ID_OBSERVACAO"))
        case_uuid = caso_por_cid.get(r.get("ID_CASO"))
        if not case_uuid:
            warns["nota_orfa"].append(id_obs)
            continue
        texto = clean_text(r.get("TEXTO")) or ""
        autor = clean_text(r.get("USUARIO_NOME"))
        data = to_iso_ts(r.get("DATA_HORA"))
        marker = "[src:%s]" % id_obs
        cur.execute(
            "select 1 from system_case_notes where case_id=%s and body like %s and deleted_at is null limit 1",
            (case_uuid, "%" + marker + "%"),
        )
        if cur.fetchone():
            continue
        prefix = ("[Beta: %s] " % autor) if autor else ""
        body = "%s%s %s" % (prefix, texto, marker)
        if data:
            cur.execute(
                "insert into system_case_notes (organization_id, case_id, body, created_at) "
                "values (%s,%s,%s,%s)",
                (DEFAULT_ORG, case_uuid, body, data),
            )
        else:
            cur.execute(
                "insert into system_case_notes (organization_id, case_id, body) values (%s,%s,%s)",
                (DEFAULT_ORG, case_uuid, body),
            )
        counts["notas"] += 1
    conn.commit()
    print("[7] notas inseridas:", counts["notas"])

    # ---------------------------------------------------- 8) ANDAMENTOS (timeline)
    # → system_case_events. Idempotência: diff->>'src_id' = ID_ANDAMENTO.
    for r in andamentos:
        id_and = clean_text(r.get("ID_ANDAMENTO"))
        case_uuid = caso_por_cid.get(r.get("ID_CASO"))
        if not case_uuid:
            warns["andamento_orfao"].append(id_and)
            continue
        cur.execute(
            "select 1 from system_case_events where case_id=%s and diff->>'src_id'=%s limit 1",
            (case_uuid, id_and),
        )
        if cur.fetchone():
            continue
        diff = {
            "src_id": id_and,
            "import_batch": IMPORT_BATCH,
            "tipo": clean_text(r.get("TIPO_ANDAMENTO")),
            "autor_texto": clean_text(r.get("USUARIO_NOME")),
            "descricao": clean_text(r.get("DESCRICAO")),
            "etapa_anterior": clean_text(r.get("ETAPA_ANTERIOR")),
            "etapa_nova": clean_text(r.get("ETAPA_NOVA")),
            "anexo_link": clean_text(r.get("ANEXO_LINK")),
        }
        diff = {k: v for k, v in diff.items() if v is not None}
        data = to_iso_ts(r.get("DATA_HORA"))
        if data:
            cur.execute(
                "insert into system_case_events (case_id, organization_id, action, diff, created_at) "
                "values (%s,%s,'andamento_importado',%s,%s)",
                (case_uuid, DEFAULT_ORG, _jsonb(diff), data),
            )
        else:
            cur.execute(
                "insert into system_case_events (case_id, organization_id, action, diff) "
                "values (%s,%s,'andamento_importado',%s)",
                (case_uuid, DEFAULT_ORG, _jsonb(diff)),
            )
        counts["andamentos"] += 1
    conn.commit()
    print("[8] andamentos inseridos:", counts["andamentos"])

    # ---------------------------------------------------- 9) CHECKLIST ITEMS
    # DOCUMENTOS_SISGIMM → system_case_checklist_items, ancorados na etapa
    # DOCUMENTOS_INICIAIS, ligados à def por ID_CONFIG_DOCUMENTO. done = STATUS_DOCUMENTO=OK.
    # Idempotência por (case_id, def_id) — 1 item por doc-config por caso.
    for r in documentos:
        case_uuid = caso_por_cid.get(r.get("ID_CASO"))
        if not case_uuid:
            warns["doc_orfao"].append(r.get("ID_DOCUMENTO_CASO"))
            continue
        cfg = clean_text(r.get("ID_CONFIG_DOCUMENTO"))
        def_id = config_to_def.get(cfg) if cfg else None
        if not def_id:
            warns["doc_sem_config"].append(r.get("ID_DOCUMENTO_CASO"))
            continue
        status = norm_key(r.get("STATUS_DOCUMENTO"))
        done = status == "ok"
        cur.execute(
            "select id from system_case_checklist_items where case_id=%s and def_id=%s and deleted_at is null",
            (case_uuid, def_id),
        )
        if cur.fetchone():
            continue
        done_at = to_iso_ts(r.get("DATA_RECEBIMENTO")) if done else None
        req = to_bool(r.get("OBRIGATORIO_APLICAVEL"))
        cur.execute(
            "insert into system_case_checklist_items "
            "(organization_id, case_id, def_id, stage_slug, done, done_at, required, source) "
            "values (%s,%s,%s,%s,%s,%s,%s,'manual')",
            (DEFAULT_ORG, case_uuid, def_id, CHECKLIST_STAGE_SLUG, done, done_at,
             req if req is not None else True),
        )
        counts["checklist_items"] += 1
        if counts["checklist_items"] % 500 == 0:
            conn.commit()
    conn.commit()
    print("[9] checklist items inseridos:", counts["checklist_items"])

    cur.close()
    conn.close()

    # ---------------------------------------------------- 10) PASTAS NO DRIVE
    drive_result = {"pending": 0, "created": 0, "failed": 0}
    if skip_drive:
        print("[10] --skip-drive: pulando criação de pastas no Drive.")
    else:
        print("[10] criando pastas no Drive (subprocesso Node, NÃO-FATAL)...")
        try:
            proc = subprocess.run(
                ["node", str(SISTEMA_HV / "scripts" / "import-mais-medicos-drive.mjs")],
                cwd=str(SISTEMA_HV), capture_output=True, text=True, timeout=3600,
            )
            if proc.stderr:
                print(proc.stderr.strip())
            last = (proc.stdout.strip().splitlines() or [""])[-1]
            try:
                drive_result = json.loads(last)
            except Exception:
                print("    [drive] saída não-JSON:", proc.stdout.strip()[:500])
        except Exception as e:
            print("    [drive] falha ao rodar o helper (NÃO-FATAL):", e)

    # ---------------------------------------------------- RESUMO
    print("\n" + "=" * 78)
    print("  EXECUTE CONCLUÍDO —", datetime.now().isoformat(timespec="seconds"))
    print("  inseridos nesta execução:")
    for k in ("tema", "op_stages", "field_defs", "checklist_defs",
              "clientes", "casos", "notas", "andamentos", "checklist_items"):
        print("    - %-18s %d" % (k, counts.get(k, 0)))
    print("  Drive: pastas criadas=%d falhadas=%d (pendentes no início=%d)"
          % (drive_result.get("created", 0), drive_result.get("failed", 0),
             drive_result.get("pending", 0)))
    total_w = sum((len(v) if isinstance(v, list) else v) for v in warns.values())
    print("  avisos:", total_w)
    for k, v in warns.items():
        n = len(v) if isinstance(v, list) else v
        print("    - %-20s %s  ex.: %s" % (k, n, (v[:5] if isinstance(v, list) else v)))
    print("=" * 78)
    return counts, drive_result


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description="ETL Mais Médicos (Story A8)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--dry-run", action="store_true", help="(default) só lê/valida, não grava")
    g.add_argument("--execute", action="store_true", help="grava em produção (idempotente)")
    ap.add_argument("--no-db", action="store_true", help="não conectar ao banco (valida só a planilha)")
    ap.add_argument("--skip-drive", action="store_true", help="no --execute, não criar pastas no Drive")
    args = ap.parse_args()

    if not XLSX_PATH.exists():
        print("ERRO: planilha não encontrada em", XLSX_PATH, file=sys.stderr)
        sys.exit(1)

    sheets = load_sheets(XLSX_PATH)
    env = read_env(ENV_PATH)

    if args.execute:
        run_execute(sheets, env, skip_drive=args.skip_drive)
    else:
        run_dry(sheets, env, use_db=not args.no_db)


if __name__ == "__main__":
    main()
