```
==============================================================================
  RELATÓRIO DRY-RUN — Importação Mais Médicos (Story A8)
  gerado em 2026-08-04T12:05:28
  fonte: MM_BASE_SISTEMA_BETA_v1.xlsx
  MODO: DRY-RUN — NENHUMA linha escrita. Grava só no --execute (não rodado).
==============================================================================

[1] BANCO (leitura de metadados)
    conectado via: db.sptfmfeoikukrhbekitl.supabase.co
    temas 'Mais Médicos' existentes: nenhum
    service_types 'Mais Médicos' existentes:
       id=f91b1900-c741-4429-8fbe-44711fe3d5b0 slug=MAIS_MEDICOS tema_id=None
    casos com prefixo MAISMEDICOS-* já no banco: 0
    clientes com cpf_cnpj 'CL-*' já no banco: 0

[2] TEMA + SERVICE_TYPE + ETAPAS OP (board 'Contratos')
    tema a criar: 'Mais Médicos' (slug MAIS_MEDICOS) — 1 registro
    prefixo case_code derivado do nome do tema: 'MAISMEDICOS' (case_code = MAISMEDICOS-2026-NNNN)
    NOTA: prefixo real é 'MAISMEDICOS' (NÃO 'MM' como o resumo da task sugeria) —
          caseCodePrefix('Mais Médicos') remove acentos/espaços.
    etapas op a criar (kind=op): 7
       - INICIAL_CONTRATO_NOVO  Inicial - contrato novo    role=normal
       - DOCUMENTOS_INICIAIS    Documentos iniciais        role=normal
       - ADMINISTRATIVO_FEITO   Administrativo feito       role=normal
       - JUDICIAL               Judicial                   role=normal
       - STAND_BY               Stand by                   role=normal
       - RESCISAO               Rescisão                   role=closed
       - ENCERRADO              Encerrado                  role=closed
    board SISGIMM: NÃO criado nesta story (fica p/ A3).
    ⚠ ATENÇÃO: já existe service_type 'Mais Médicos' SEM tema vinculado:
        id=f91b1900-c741-4429-8fbe-44711fe3d5b0 slug=MAIS_MEDICOS (tema_id NULL)
      → No --execute o createTema criará o service_type ESPELHO com slug
        sufixado (ex.: MAIS_MEDICOS_T) p/ não colidir na UNIQUE(org,slug).
        DECISÃO p/ owner: (a) reusar este service_type legado como espelho
        do tema, ou (b) deixar o createTema criar um novo (MAIS_MEDICOS_T).

[3] CAMPOS DO TEMA (system_tema_field_defs)
    defs a criar: 21
    por type: {'select': 3, 'boolean': 5, 'text': 4, 'number': 1, 'multiselect': 6, 'date': 2}
       - status_caso                  select      [7 opts]
       - ativo_mais_medicos           boolean     
       - fies                         boolean     
       - contrato_operacional_ativo   boolean     
       - dsei                         boolean     
       - municipio_entrada            text        
       - alerta_multiplos_municipios  boolean     
       - classificacao_ivs            select      [5 opts]
       - ivs                          number      
       - tipo_grupo                   multiselect [14 opts]
       - edital                       select      [25 opts]
       - ciclo                        multiselect [24 opts]
       - art_19a_edital               multiselect [4 opts]
       - art_19b_edital               multiselect [4 opts]
       - art_19a_portaria             multiselect [4 opts]
       - art_19b_portaria             multiselect [4 opts]
       - cnes                         text        
       - classificacao_udh            text        
       - classificacao_ibp            text        
       - data_fechamento              date        
       - data_ultimo_andamento        date        
    campos *_CALCULADO (NÃO viram def editável, derivam de canonical.sisgimm): ['RESUMO_SISGIMM_CALCULADO', 'STATUS_DOCUMENTACAO_CALCULADO']

[4] CHECKLIST DEFS (system_stage_checklist_defs)
    defs a criar: 7 | ancoradas na etapa: DOCUMENTOS_INICIAIS
       - doc_config_001 Documento de identificação                     req=True
       - doc_config_002 Termo/contrato de adesão ao Mais Médicos       req=True
       - doc_config_003 Comprovante/declaração de período de atuação   req=True
       - doc_config_004 Comprovante de município/DSEI de atuação       req=True
       - doc_config_005 Contrato ou comprovante FIES                   req=True
       - doc_config_006 Procuração/autorização                         req=True
       - doc_config_007 Documentos complementares                      req=False
    DOCUMENTOS_INICIAIS: 0 instâncias → descartado (confirmar 2ª lista com owner p/ depois).

[5] CLIENTES (system_clients)
    linhas em CASOS: 381
    clientes a criar (find-or-create por cpf_cnpj=ID_CLIENTE_INTERNO): 381
    CPFs → marcador 'CL-XXXX' (todos, base sem CPF): 381
    email/phone: nulos (preencher depois via ficha)
    pasta no Drive: CRIADA no --execute (dry-run apenas reporta que criaria 381 pastas)

[6] CASOS (system_cases, lifecycle=CLIENTE)
    casos a criar (find-or-create por case_code): 381
    lifecycle: CLIENTE (todos)
    distribuição macrostatus_op (mapeado de STATUS_CASO):
       - INICIAL_CONTRATO_NOVO  Inicial - contrato novo    2
       - DOCUMENTOS_INICIAIS    Documentos iniciais        8
       - ADMINISTRATIVO_FEITO   Administrativo feito       122
       - JUDICIAL               Judicial                   244
       - STAND_BY               Stand by                   1
       - RESCISAO               Rescisão                   2
       - ENCERRADO              Encerrado                  2
    casos com MÚLTIPLOS vínculos (histórico preservado, Opção A): 141
    STATUS_CASO nulo/desconhecido → fallback 'INICIAL_CONTRATO_NOVO': 2
        - CASO-0239 status=None
        - CASO-0247 status=None
    exemplo canonical_fields (CASO-0001):
        {
          "status_caso": "Administrativo Feito",
          "ativo_mais_medicos": true,
          "fies": true,
          "contrato_operacional_ativo": true,
          "dsei": false,
          "municipio_entrada": "BANABUIU/CE",
          "alerta_multiplos_municipios": false,
          "classificacao_ivs": "Alta",
          "ivs": 0.469,
          "tipo_grupo": "G2",
          "edital": "Edital SAPS nº 10/2025",
          "ciclo": "43º",
          "data_ultimo_andamento": "2026-07-13",
          "periodo_atual": {
            "inicio": "2026-01-01",
            "fim": "2030-01-01",
            "texto": "01/01/2026 a 01/01/2030"
          },
          "sisgimm": {
            "etapa": null,
            "status_doc": null,
            "comunicacao_feita": false,
            "acesso": "Não",
            "solicitado_1a_parcela": false,
            "status_pedido": null,
            "obs": null
          },
          "periodos_atuacao": [
            {
              "vinculo": "CL-0001-C01",
              "inicio": "2026-01-01",
              "fim": "2030-01-01",
              "atual": true
            }
          ],
          "import_batch": "MM_2026_08_03"
        }

[7] TIMELINE (notas + andamentos)
    OBSERVACOES_CASO → system_case_notes: 476 (autoria em TEXTO no corpo: '[Beta: <nome>] ...')
       observações órfãs (ID_CASO inexistente em CASOS): 0
       observações sem autor: 0
       autores distintos: {'IMPORTAÇÃO BASE ORIGINAL': 168, 'IMPORTAÇÃO SISGIMM': 157, 'thiago correia': 1, 'Thaise Francelino': 4, 'Maria Clara Batista': 118, 'Pablo Silva': 28}
    ANDAMENTOS_CASO → system_case_events: 180 (autor em diff.autor_texto)
       andamentos órfãos: 0
       tipos: {'parcela': 29, 'comunicacao_sisgimm': 32, 'encerramento': 1, 'manual': 118}

[8] CHECKLIST POR CASO (system_case_checklist_items)
    DOCUMENTOS_SISGIMM → items: 2469
    casos distintos com documentos: 358
    status: OK=641 pendente=1828 outros=0
    itens órfãos (ID_CASO inexistente): 0
    casos SEM nenhum documento na base: 23

[9] PARCELAS SISGIMM (NÃO importadas — resumo em canonical_fields)
    PARCELAS_SISGIMM lidas: 652 | status: {'nao solicitada': 599, 'solicitada': 52, 'deferida': 1}
    system_parcelas a inserir: 0 (esteira completa → story A3)
    SISGIMM (estado atual) resumido em canonical.sisgimm p/ 354 casos

[10] DESCARTADOS / ADIADOS
    EVENTOS_AUDITORIA: 2224 linhas → DESCARTAR
    USUARIOS_SISTEMA: 6 → NÃO cria usuário-que-loga (autoria = texto; Auth → item 11)
    board SISGIMM + esteira de parcelas → A3

[11] ENCODING / MOJIBAKE
    caractere U+FFFD (irrecuperável na origem) por coluna em CASOS: nenhum
    NOMEs de cliente: sem mojibake (pastas do Drive OK).
    OBS: STATUS_CASO/IVS com mojibake (ex.: 'Rescis�o', 'M�dia') são
         normalizados por norm_key() → o mapeamento de etapa/IVS casa mesmo assim.

[12] ANOMALIAS / AVISOS (resumo)
    - service_type_orfao     1   ex.: [('f91b1900-c741-4429-8fbe-44711fe3d5b0', 'Mais Médicos', 'MAIS_MEDICOS', None)]

[13] ESTRATÉGIA DE IDEMPOTÊNCIA (aplicada no --execute)
    - tema:      find-or-create por (organization_id, slug='MAIS_MEDICOS')
    - campo def: por (tema_id, key)
    - checklist def: por (service_type_id, stage_slug, key)
    - cliente:   por (organization_id, cpf_cnpj='CL-XXXX')  [UNIQUE parcial]
    - caso:      por case_code (MAISMEDICOS-2026-NNNN) OU por client_id+tema_id
    - nota:      body carimba '[src:ID_OBSERVACAO]'; skip se já existe p/ o caso
    - evento:    diff.src_id=ID_ANDAMENTO; skip se já existe
    - checklist item: por (case_id, def_id); pastas do Drive só se drive_folder_id NULL
    Re-rodar --execute NÃO duplica; retoma de onde parou (útil p/ rate limit do Drive).

==============================================================================
  FIM DO DRY-RUN. Nada foi escrito. Total de avisos: 1
==============================================================================
```
