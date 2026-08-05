# -*- coding: utf-8 -*-
"""
Semeia a PONTUACAO do Motor de Distribuicao a partir da planilha
'regras pontuacao dificuldade operacional (3).xlsx' (raiz do repo) no banco
de PRODUCAO (dev=prod). IDEMPOTENTE: rodar N vezes nao duplica.

FONTE (2 abas):
  - pontuacao_tarefa: tipo_tarefa | pontuacao_tipo | ativo | Responsavel exclusivo geral
                      | Responsavel exclusivo por tema | observacao
  - pontuacao_assunto: assunto | pontuacao_assunto | ativo | Responsavel exclusivo | observacao

DESTINO:
  - system_task_type_mapping (projuris_tipo_codigo=NOME, motor_task_type_id=SLUG,
    points=pontuacao_tipo, complexity_level=0, temporal_level=0, active=(ativo=='SIM'))
  - system_theme_mapping (projuris_tema_codigo=NOME, motor_theme_id=SLUG,
    multiplier=pontuacao_assunto, temporal_level=0, active=(ativo=='SIM'))

PLACEHOLDER reconciliavel: os codigos reais do ProJuris ainda nao existem, entao
usamos o NOME exato da planilha como projuris_*_codigo. Reconciliar depois.

Responsaveis-exclusivos NAO sao semeados (dependem dos executores, que ainda nao
existem). Apenas COLETAMOS e reportamos para etapa futura em
system_distribution_exceptions.

Conexao: SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD de sistema-hv/.env.local.
Tenta db.<ref>.supabase.co:5432 e depois varre os poolers regionais (mesma
estrategia de scripts/db-apply-pg.ts).

Uso:
  python scripts/seed-distribuicao-pontuacao.py
  python scripts/seed-distribuicao-pontuacao.py --dry-run   # nao commita
"""
import os
import re
import sys
import unicodedata

import openpyxl
import psycopg2
import psycopg2.extras

DEFAULT_ORG = "00000000-0000-0000-0000-000000000001"

# ---------------------------------------------------------------------------
# Localizacao de arquivos (script roda de dentro de sistema-hv/)
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SISTEMA_HV_DIR = os.path.dirname(SCRIPT_DIR)          # .../sistema-hv
REPO_ROOT = os.path.dirname(SISTEMA_HV_DIR)           # .../Sistema_Hyago_Viana_Adabtech
XLSX_PATH = os.path.join(REPO_ROOT, "regras pontuação dificuldade operacional (3).xlsx")
ENV_PATH = os.path.join(SISTEMA_HV_DIR, ".env.local")

DRY_RUN = "--dry-run" in sys.argv


def load_env(path):
    """Le pares CHAVE=VALOR de um .env simples (sem depender de dotenv)."""
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            env[key] = val
    return env


def slugify(name):
    """Slug normalizado: MAIUSCULO, A-Z0-9_ (sem acentos)."""
    s = unicodedata.normalize("NFKD", str(name))
    s = "".join(c for c in s if not unicodedata.combining(c))  # tira acentos
    s = s.upper()
    s = re.sub(r"[^A-Z0-9]+", "_", s)  # tudo que nao for A-Z0-9 vira _
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def norm(cell):
    if cell is None:
        return None
    s = str(cell).strip()
    return s if s else None


def is_active(cell):
    return norm(cell) is not None and norm(cell).upper() == "SIM"


REGIONS = [
    "us-east-1", "us-east-2", "us-west-1", "sa-east-1", "eu-central-1",
    "eu-west-1", "eu-west-2", "eu-west-3", "ap-southeast-1", "ap-southeast-2",
    "ap-south-1", "ap-northeast-1", "ap-northeast-2", "ca-central-1",
]


def connect(ref, password):
    candidates = [
        ("direct db.%s.supabase.co" % ref, dict(
            host="db.%s.supabase.co" % ref, port=5432, user="postgres",
            password=password, dbname="postgres", sslmode="require",
            connect_timeout=8,
        )),
    ]
    for r in REGIONS:
        candidates.append(("pooler %s" % r, dict(
            host="aws-0-%s.pooler.supabase.com" % r, port=5432,
            user="postgres.%s" % ref, password=password, dbname="postgres",
            sslmode="require", connect_timeout=8,
        )))
    for label, cfg in candidates:
        try:
            conn = psycopg2.connect(**cfg)
            print("Conectado via: %s" % label)
            return conn
        except Exception as exc:  # noqa: BLE001
            print("  falhou %s: %s" % (label, str(exc).splitlines()[0]))
    return None


UPSERT_TASK = """
INSERT INTO system_task_type_mapping
  (organization_id, projuris_tipo_codigo, motor_task_type_id, points,
   complexity_level, temporal_level, active)
VALUES (%s, %s, %s, %s, 0, 0, %s)
ON CONFLICT (projuris_tipo_codigo, organization_id) DO UPDATE SET
  points             = EXCLUDED.points,
  motor_task_type_id = EXCLUDED.motor_task_type_id,
  active             = EXCLUDED.active,
  updated_at         = NOW()
RETURNING (xmax = 0) AS inserted;
"""

UPSERT_THEME = """
INSERT INTO system_theme_mapping
  (organization_id, projuris_tema_codigo, motor_theme_id, multiplier,
   temporal_level, active)
VALUES (%s, %s, %s, %s, 0, %s)
ON CONFLICT (projuris_tema_codigo, organization_id) DO UPDATE SET
  multiplier      = EXCLUDED.multiplier,
  motor_theme_id  = EXCLUDED.motor_theme_id,
  active          = EXCLUDED.active,
  updated_at      = NOW()
RETURNING (xmax = 0) AS inserted;
"""


def read_sheet(wb, name):
    ws = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    data = [r for r in rows[1:] if any(c is not None and str(c).strip() != "" for c in r)]
    return header, data


def main():
    if not os.path.exists(XLSX_PATH):
        print("ERRO: planilha nao encontrada em %s" % XLSX_PATH)
        sys.exit(1)

    env = load_env(ENV_PATH)
    ref = env.get("SUPABASE_PROJECT_REF") or os.environ.get("SUPABASE_PROJECT_REF")
    password = env.get("SUPABASE_DB_PASSWORD") or os.environ.get("SUPABASE_DB_PASSWORD")
    if not ref or not password:
        print("ERRO: faltam SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD em %s" % ENV_PATH)
        sys.exit(1)

    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)

    # --- Parse pontuacao_tarefa -------------------------------------------
    thdr, trows = read_sheet(wb, "pontuacao_tarefa")
    # colunas esperadas: tipo_tarefa | pontuacao_tipo | ativo | resp geral | resp por tema | obs
    expected_task = ["tipo_tarefa", "pontuacao_tipo", "ativo"]
    hdr_lc = [str(h).strip().lower() if h else "" for h in thdr]
    for col in expected_task:
        if col not in hdr_lc:
            print("ERRO: coluna '%s' faltando na aba pontuacao_tarefa. Header=%s" % (col, thdr))
            sys.exit(1)

    task_rows = []
    task_exclusives = []  # (tipo, tipo_de_exclusivo, pessoa)
    seen_task_codes = set()
    for r in trows:
        nome = norm(r[0])
        if nome is None:
            continue
        if nome in seen_task_codes:
            print("AVISO: tipo_tarefa duplicado na planilha, ignorando 2a ocorrencia: %r" % nome)
            continue
        seen_task_codes.add(nome)
        pontos = r[1]
        ativo = is_active(r[2])
        resp_geral = norm(r[3]) if len(r) > 3 else None
        resp_tema = norm(r[4]) if len(r) > 4 else None
        task_rows.append((nome, slugify(nome), pontos, ativo))
        if resp_geral:
            task_exclusives.append((nome, "geral", resp_geral))
        if resp_tema:
            task_exclusives.append((nome, "por_tema", resp_tema))

    # --- Parse pontuacao_assunto ------------------------------------------
    ahdr, arows = read_sheet(wb, "pontuacao_assunto")
    expected_assunto = ["assunto", "pontuacao_assunto", "ativo"]
    ahdr_lc = [str(h).strip().lower() if h else "" for h in ahdr]
    for col in expected_assunto:
        if col not in ahdr_lc:
            print("ERRO: coluna '%s' faltando na aba pontuacao_assunto. Header=%s" % (col, ahdr))
            sys.exit(1)

    theme_rows = []
    theme_exclusives = []  # (assunto, pessoa)
    seen_theme_codes = set()
    for r in arows:
        nome = norm(r[0])
        if nome is None:
            continue
        if nome in seen_theme_codes:
            print("AVISO: assunto duplicado na planilha, ignorando 2a ocorrencia: %r" % nome)
            continue
        seen_theme_codes.add(nome)
        mult = r[1]
        ativo = is_active(r[2])
        resp = norm(r[3]) if len(r) > 3 else None
        theme_rows.append((nome, slugify(nome), mult, ativo))
        if resp:
            theme_exclusives.append((nome, resp))

    print("\nPlanilha lida: %d tipos de tarefa, %d assuntos." % (len(task_rows), len(theme_rows)))
    print("Exclusivos coletados (NAO semeados): %d de tarefa, %d de assunto." % (
        len(task_exclusives), len(theme_exclusives)))

    # --- Conectar ---------------------------------------------------------
    conn = connect(ref, password)
    if conn is None:
        print("ERRO: nao consegui conectar em nenhum host/regiao.")
        sys.exit(2)

    inserted_task = updated_task = 0
    inserted_theme = updated_theme = 0
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            for nome, slug, pontos, ativo in task_rows:
                cur.execute(UPSERT_TASK, (DEFAULT_ORG, nome, slug, pontos, ativo))
                was_insert = cur.fetchone()[0]
                if was_insert:
                    inserted_task += 1
                else:
                    updated_task += 1

            for nome, slug, mult, ativo in theme_rows:
                cur.execute(UPSERT_THEME, (DEFAULT_ORG, nome, slug, mult, ativo))
                was_insert = cur.fetchone()[0]
                if was_insert:
                    inserted_theme += 1
                else:
                    updated_theme += 1

            # --- Validacao pos-upsert (dentro da mesma transacao) ---------
            cur.execute(
                "SELECT count(*) FROM system_task_type_mapping WHERE organization_id = %s",
                (DEFAULT_ORG,))
            count_task = cur.fetchone()[0]
            cur.execute(
                "SELECT count(*) FROM system_theme_mapping WHERE organization_id = %s",
                (DEFAULT_ORG,))
            count_theme = cur.fetchone()[0]

            cur.execute(
                "SELECT projuris_tipo_codigo, motor_task_type_id, points, active "
                "FROM system_task_type_mapping WHERE organization_id = %s "
                "ORDER BY points DESC, projuris_tipo_codigo LIMIT 5", (DEFAULT_ORG,))
            sample_task = cur.fetchall()
            cur.execute(
                "SELECT projuris_tema_codigo, motor_theme_id, multiplier, active "
                "FROM system_theme_mapping WHERE organization_id = %s "
                "ORDER BY multiplier DESC, projuris_tema_codigo LIMIT 5", (DEFAULT_ORG,))
            sample_theme = cur.fetchall()

        if DRY_RUN:
            conn.rollback()
            print("\n[DRY-RUN] rollback executado (nada foi commitado).")
        else:
            conn.commit()
            print("\nCOMMIT executado.")
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        print("ERRO durante seed (rollback): %s" % exc)
        sys.exit(1)
    finally:
        conn.close()

    # --- Relatorio --------------------------------------------------------
    print("\n" + "=" * 68)
    print("RESULTADO DO SEED")
    print("=" * 68)
    print("system_task_type_mapping : inseridos=%d  atualizados=%d  total_org=%d"
          % (inserted_task, updated_task, count_task))
    print("system_theme_mapping     : inseridos=%d  atualizados=%d  total_org=%d"
          % (inserted_theme, updated_theme, count_theme))

    print("\nAmostra system_task_type_mapping (nome | slug | points | active):")
    for row in sample_task:
        print("  %-32s | %-28s | %s | %s" % row)
    print("\nAmostra system_theme_mapping (nome | slug | multiplier | active):")
    for row in sample_theme:
        print("  %-24s | %-24s | %s | %s" % row)

    print("\n" + "-" * 68)
    print("EXCLUSIVOS PENDENTES (coletados, NAO semeados — etapa futura em")
    print("system_distribution_exceptions quando existirem os executores):")
    print("-" * 68)
    print("Tarefas:")
    if task_exclusives:
        for tipo, kind, pessoa in task_exclusives:
            print("  [%s] %s -> %s" % (kind, tipo, pessoa))
    else:
        print("  (nenhum)")
    print("Assuntos:")
    if theme_exclusives:
        for assunto, pessoa in theme_exclusives:
            print("  %s -> %s" % (assunto, pessoa))
    else:
        print("  (nenhum)")

    print("\nOK.")


if __name__ == "__main__":
    main()
