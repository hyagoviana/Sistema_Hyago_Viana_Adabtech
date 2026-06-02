# 📋 Alinhamento com o Cliente (Hyago Viana) — **Projetos 1 e 2**

> Escopo deste documento: **somente Projeto 1 (Plataforma + FIES)** e **Projeto 2 (Controladoria
> Jurídica)**. Não cobre os Projetos 3–6.
>
> Para cada item há um **padrão sugerido** — basta o dono **confirmar** ("ok") ou **ajustar**.
> Responda por número (ex.: `1.1 → ok` ou `1.1 → 20%`).
>
> Atualizado: 2026-06-02 · Orquestração: Orion (aios-master)

---

# ════════ PROJETO 1 — Plataforma Unificada + FIES ════════

## BLOCO A — Termo de Acerto (núcleo da monetização)

### A.1 Parâmetros do cálculo de honorários
- **1.1** Percentual de honorários sobre o valor efetivo do abatimento. *(Sugerido: **15%**)*
- **1.2** Valor padrão de cada parcela. *(Sugerido: **R$ 500**)*
- **1.3** Desconto para pagamento à vista. *(Sugerido: **10%**)*
- **1.4** Regra do resto da divisão: sobrou **< R$ 100** → soma na última parcela; sobrou mais → cria parcela extra. *(Confirmar)*
- **1.5** Esses valores podem ser **alterados manualmente** caso a caso, ou são fixos? *(Sugerido: pré-preenchidos, editáveis pelo financeiro)*

### A.2 Valores de entrada do cálculo
- **2.1** De onde vêm **saldo FIES antes**, **saldo depois** e **parcelas pagas no processo**? *(Sugerido no MVP: o financeiro **digita** ao elaborar o Termo; cadastro FIES automático fica para depois.)*
- **2.2** **Suspensão FIES**: sem pagamento no processo → parcelas pagas = 0; com pagamento voluntário → lança o valor real. *(Confirmar os 2 cenários)*

### A.3 Tipos e cláusulas do Termo
- **3.1** Existe Termo **PARCIAL** (1º abatimento) e **COMPLEMENTAR** (seguintes)? Muda o cálculo entre eles?
- **3.2** Há **cláusulas especiais** que variam por caso? Quais as mais comuns? *(Para o template)*

### A.4 Conferência e aprovação
- **4.1** A regra "quem elabora não confere" (segregação) vale **desde já**? *(Hoje só há 1 usuário — você. Sugerido: no MVP o admin pode tudo; a segregação passa a valer quando entrarem outros usuários financeiro/jurídico.)*
- **4.2** Critérios de **aprovação automática**: Termo padrão, honorários **15%**, sem cláusula especial, procuração válida, caso sem risco, honorários entre **R$ 1.000 e R$ 20.000**. Confirma faixa e critérios?
- **4.3** Na **aprovação manual**, quem aprova? *(Sugerido: advogado responsável pelo caso; se não houver, o titular.)*

### A.5 Documento (PDF) do Termo
- **5.1** Você tem um **modelo atual do Termo** (Word/PDF)? **Envie o arquivo** — reproduzimos o layout.
- **5.2** O que deve constar? *(Sugerido: dados do cliente/caso, valores, parcelas, dados de pagamento, cláusulas, local/data, assinatura.)*
- **5.3** **Dados bancários / chave PIX** que entram no Termo.

### A.6 Aceite e cancelamento
- **6.1** Por quais **canais** o cliente aceita? *(Sugerido no MVP: aceite registrado manualmente + WhatsApp; Portal/ZapSign depois.)*
- **6.2** Precisa de **assinatura digital com validade jurídica** ou basta **evidência de aceite** (data/canal/IP)? *(Sugerido: evidência no MVP.)*
- **6.3** Após aceite e geração de boletos, o Termo **pode ser cancelado**? *(Sugerido: não; só renegociação → nova versão.)*

## BLOCO B — Cobrança / Financeiro
- **7.1** Plataforma de cobrança: **Conta Azul**, **Asaas**, outra? *(Precisamos das credenciais de API.)*
- **7.2** Formas: **boleto**, **PIX**, **cartão** — quais habilitar?
- **7.3** **Régua de cobrança**: quantos dias antes/depois e por qual canal (WhatsApp/e-mail)?
- **7.4** **Juros/multa** por atraso e a partir de quantos dias vira **inadimplente**? *(Sugerido: 30 dias.)*
- **7.5** Regras de **renegociação**.

## BLOCO C — Tipos de caso e fluxo (Anexo II)
- **8.1** Lista **definitiva** dos tipos de caso do MVP. *(Hoje: FIES ESF/DGM, COVID, Mais Médicos, Residência, CFM/CRM. O escopo cita também **possessórias**, **trabalhistas individuais** e **Médicos pelo Brasil — Eixo Formação** — incluir já?)*
- **8.2** O **fluxo de etapas** é o mesmo do FIES para todos, ou muda por tipo? Se muda, quais as etapas de cada um?
- **8.3** O **Anexo II** (fluxo FIES) é a versão final, ou houve mudanças desde então?

## BLOCO D — Migração da base atual (~2.500 casos)
- **9.1** Formato atual: **Excel**, **Trello**, ambos? *(Precisamos dos arquivos exportados.)*
- **9.2** Quais **colunas/campos** existem hoje? *(Envie um exemplo/print das planilhas.)*
- **9.3** Volume real e quais estão **ativos** no go-live.
- **9.4** Quem do escritório **valida** o plano e confere os dados migrados?

## BLOCO E — Usuários, papéis e segurança
- **10.1** **Quem** vai usar o sistema e o **papel** de cada um (nome + e-mail + papel: admin, advogado titular/associado, prestador externo, controladoria, comercial, financeiro).
- **10.2** **MFA (2 fatores)** obrigatório para quais papéis? *(Sugerido: admin, titular, financeiro.)*
- **10.3** Algum dado tem **acesso restrito** especial (ex.: financeiro só o titular vê)?

## BLOCO F — LGPD
- **11.1** Há **termo de consentimento / política de privacidade** oficial? *(Envie o texto.)*
- **11.2** Prazo de **retenção** dos dados após encerrar o caso (exigência legal?).
- **11.3** Quem é o **encarregado (DPO)** pelos dados?

## BLOCO G — Automação FIES (integrações do Projeto 1)
- **12.1** Fontes a monitorar: **SEI**, **Gov.br**, **MEC/FNDE**, **CNES** — confirmar a lista.
- **12.2** **Credenciais/acessos** de cada fonte (quem fornece).
- **12.3** Frequência de verificação aceitável (ex.: 1x/dia).
- **12.4** O e-mail `Emailcontatohyago` (já usado no onboarding) é o canal oficial dos documentos assinados?

## BLOCO H — Identidade / infra (Projeto 1)
- **13.1** Confirmar identidade visual (navy/dourado) e enviar **logo em alta** se houver versão melhor.
- **13.2** **Domínio** definitivo (já temos `sistemahyagoviana.com.br`?) e e-mails de envio (cobrança/notificações).

---

# ════════ PROJETO 2 — Controladoria Jurídica ════════

## BLOCO I — Integração Projuris
- **14.1** Vocês usam **Projuris**? Têm **API oficial** habilitada? *(Precisamos de credenciais + documentação da API.)*
- **14.2** O que sincronizar: processos, partes, movimentações, prazos, documentos — **tudo** ou parte?
- **14.3** Frequência mínima de sincronização. *(Sugerido: a cada 1–4 horas.)*
- **14.4** Caso **não** seja Projuris, qual sistema processual vocês usam hoje?

## BLOCO J — Prazos e tarefas
- **15.1** Antecedência mínima para protocolar antes do prazo fatal. *(Sugerido: **3 dias úteis**.)*
- **15.2** A partir de quantos dias sem movimentação um processo é **"parado"**? *(Sugerido: 30 dias.)*
- **15.3** **Responsáveis** padrão por tipo de demanda/comarca (para sugestão automática).
- **15.4** Distribuição de tarefas: precisa de **aceite/recusa** pelo responsável? *(Sugerido: sim.)*

## BLOCO K — Inteligência (IA)
- **16.1** Podemos usar **provedor de IA** (OpenAI/Anthropic) para classificar movimentações e busca de teses? Há **restrição de sigilo** para enviar dados de processos à IA? *(Crítico — define a arquitetura.)*
- **16.2** **Base de teses/decisões**: você tem material para povoar? Em que formato? *(O povoamento inicial é do escritório; entregamos a ferramenta + roteiro.)*
- **16.3** Classificação/sugestões de IA exigem **confirmação humana** sempre? *(Sugerido: sim em prazos críticos.)*

## BLOCO L — Centro de Exceções
- **17.1** Quais situações são **alertas prioritários**? *(Ex.: prazo sem responsável, prazo conflitante, tarefa vencida, processo parado, movimentação não classificada, erro de integração.)* — confirmar/priorizar.

---

## 🔝 Top 5 que **mais destravam** (se quiser priorizar)
1. **A.5.1** — modelo atual do **Termo de Acerto** (arquivo)
2. **B.7.1** — **plataforma de cobrança** + credenciais
3. **D.9.1/9.2** — **arquivos da base** atual (Excel/Trello)
4. **I.14.1** — **Projuris** tem API oficial? credenciais?
5. **K.16.1** — pode usar **IA com dados de processos**? (sigilo)

## 🔐 Lembrete de segurança (interno — não é pergunta ao cliente)
Rotacionar: chave Google Service Account · senha admin · API key n8n (vazaram no chat).
