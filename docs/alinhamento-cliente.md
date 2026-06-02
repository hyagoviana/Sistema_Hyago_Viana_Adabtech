# 📋 Alinhamento com o Cliente (Hyago Viana) — Perguntas para destravar Projetos 1 e 2

> Documento de alinhamento. Para cada item há um **padrão sugerido** — basta o dono
> **confirmar** ("ok") ou **ajustar**. As respostas destravam a construção sem retrabalho.
>
> Como responder: marque a resposta ao lado de cada número (ex.: `1.1 → ok` ou `1.1 → 20%`).
>
> Atualizado: 2026-06-02 · Orquestração: Orion (aios-master)

---

## BLOCO A — Termo de Acerto (núcleo da monetização — FIES)

### A.1 Parâmetros do cálculo de honorários
- **1.1** Percentual de honorários sobre o valor efetivo do abatimento. *(Sugerido: **15%**)*
- **1.2** Valor padrão de cada parcela. *(Sugerido: **R$ 500**)*
- **1.3** Desconto para pagamento à vista. *(Sugerido: **10%**)*
- **1.4** Regra do resto da divisão das parcelas: se sobrar **menos de R$ 100**, somamos na última parcela; se sobrar mais, criamos uma parcela extra. *(Confirmar)*
- **1.5** O percentual/parcela/desconto pode ser **alterado manualmente** caso a caso, ou é fixo? *(Sugerido: pré-preenchido, mas editável pelo financeiro)*

### A.2 Valores de entrada do cálculo
- **2.1** De onde vêm **saldo FIES antes**, **saldo depois** e **parcelas pagas durante o processo**? *(Sugerido no MVP: o financeiro **digita** no momento de elaborar o Termo. Futuramente, puxar de um cadastro FIES.)*
- **2.2** **Suspensão FIES**: quando o cliente está com FIES suspenso e **não** pagou parcelas no processo, consideramos parcelas pagas = 0? E quando pagou voluntariamente, lançamos o valor real? *(Confirmar os 2 cenários)*

### A.3 Tipos e cláusulas do Termo
- **3.1** Existe Termo **PARCIAL** (1º abatimento) e **COMPLEMENTAR** (abatimentos seguintes)? Como difere o cálculo entre eles?
- **3.2** Há **cláusulas especiais** que mudam de caso a caso? Quais as mais comuns? *(Para definir o template)*

### A.4 Conferência e aprovação
- **4.1** A regra "quem elabora não pode conferir" (segregação) deve valer **desde já**? *(Obs.: hoje só existe 1 usuário — você. Sugerido: no MVP o admin pode tudo; a segregação passa a valer quando entrarem outros usuários financeiro/jurídico.)*
- **4.2** Critérios para **aprovação automática** (sem precisar do advogado): Termo padrão, honorários em **15%**, sem cláusula especial, procuração válida, caso sem risco, valor dos honorários entre **R$ 1.000 e R$ 20.000**. Confirma essa faixa e critérios? *(Ajustar a faixa se quiser)*
- **4.3** Quando cai para **aprovação manual**, quem é o aprovador? *(Sugerido: o advogado responsável pelo caso; se não houver, o titular.)*

### A.5 Documento (PDF) do Termo
- **5.1** Você tem um **modelo/template do Termo de Acerto** atual (Word/PDF)? Se sim, **envie o arquivo** — vamos reproduzir o layout.
- **5.2** O que precisa aparecer no documento? *(Sugerido: dados do cliente, do caso, valores calculados, parcelas, dados bancários/PIX, cláusulas, local/data, assinatura.)*
- **5.3** Dados bancários / chave **PIX** que entram no Termo para pagamento.

### A.6 Aceite e cancelamento
- **6.1** Por quais **canais** o cliente aceita o Termo? *(Opções: Portal do cliente, WhatsApp, presencial, ZapSign. Sugerido no MVP: registro de aceite manual + WhatsApp; Portal e ZapSign depois.)*
- **6.2** Precisa de **assinatura digital com validade jurídica** (ex.: ZapSign/gov.br) ou basta **evidência de aceite** (data, canal, IP)? *(Sugerido: evidência no MVP; assinatura formal depois.)*
- **6.3** Depois que o cliente aceita e os boletos são gerados, o Termo **pode ser cancelado**? *(Sugerido: não; após aceite, só renegociação — gera nova versão.)*

---

## BLOCO B — Cobrança / Financeiro

- **7.1** Qual plataforma de cobrança vamos usar: **Conta Azul**, **Asaas**, outra? *(Precisamos das credenciais de API.)*
- **7.2** Forma de cobrança: **boleto**, **PIX**, **cartão**? Quais habilitar?
- **7.3** **Régua de cobrança** (lembretes): quantos dias antes/depois do vencimento e por qual canal (WhatsApp/e-mail)?
- **7.4** **Juros e multa** por atraso: quais percentuais? A partir de quantos dias um cliente vira **inadimplente**? *(Sugerido: inadimplente com 30 dias de atraso.)*
- **7.5** **Renegociação**: regras (parcelar de novo, desconto, etc.)?

---

## BLOCO C — Tipos de caso e fluxo (Projeto 1 / Anexo II)

- **8.1** Lista **definitiva** dos tipos de caso do MVP. *(Hoje temos: FIES ESF, FIES DGM, COVID, Mais Médicos, Residência, CFM/CRM. O escopo cita também **possessórias** e **trabalhistas individuais** — incluir já? E "Médicos pelo Brasil — Eixo Formação"?)*
- **8.2** Para cada tipo, o **fluxo de etapas (pipeline)** é o mesmo do FIES ou muda? Se muda, quais as etapas de cada um?
- **8.3** O documento do **Anexo II** (fluxo FIES completo) — confirma que o que está no anexo é a versão final, ou houve mudanças?

---

## BLOCO D — Migração da base atual (~2.500 casos)

- **9.1** Em que formato está a base hoje: **Excel**, **Trello**, ambos? *(Precisamos dos arquivos exportados.)*
- **9.2** Quais **campos/colunas** existem hoje (cliente, CPF, tipo, status, valores, responsável…)? *(Envie um exemplo/print das planilhas.)*
- **9.3** Volume real e quais estão **ativos** no go-live.
- **9.4** Quem do escritório vai **validar** o plano de migração e conferir os dados migrados?

---

## BLOCO E — Usuários, papéis e segurança

- **10.1** Quem são as **pessoas** que vão usar o sistema e o **papel** de cada uma? *(admin, advogado titular, advogado associado, prestador externo, controladoria, comercial, financeiro.)* — nome + e-mail + papel.
- **10.2** **MFA (2 fatores)** obrigatório para quais papéis? *(Sugerido: admin, titular e financeiro.)*
- **10.3** Algum dado é **sensível/sigiloso** com regra especial de acesso (ex.: financeiro só o titular vê)?

---

## BLOCO F — LGPD

- **11.1** Há um **termo de consentimento / política de privacidade** oficial do escritório? *(Envie o texto, se houver.)*
- **11.2** Prazo de **retenção** dos dados (quanto tempo guardar após encerrar o caso) — há exigência legal específica? *(Sugerido: conforme OAB/legislação.)*
- **11.3** Quem é o **responsável (DPO/encarregado)** pelos dados no escritório?

---

## BLOCO G — Automação FIES (Projeto 1 — integrações)

- **12.1** Quais **fontes** precisamos monitorar automaticamente: **SEI**, **Gov.br**, **MEC/FNDE**, **CNES**? Confirmar a lista.
- **12.2** **Credenciais/acessos** de cada fonte (login institucional, certificado, etc.) — quem fornece.
- **12.3** Frequência de verificação aceitável (ex.: 1x/dia).
- **12.4** O e-mail `Emailcontatohyago` (já usado no fluxo de onboarding) é o canal oficial para receber os documentos assinados?

---

## BLOCO H — Projeto 2: Controladoria Jurídica

### H.1 Integração Projuris
- **13.1** Vocês usam **Projuris**? Têm contrato com **API oficial** habilitada? *(Precisamos de credenciais + documentação da API.)*
- **13.2** O que sincronizar: processos, partes, movimentações, prazos, documentos — **tudo** ou um subconjunto?
- **13.3** Frequência mínima de sincronização. *(Sugerido: a cada 1–4 horas.)*

### H.2 Prazos e tarefas
- **14.1** Antecedência mínima para protocolar antes do prazo fatal. *(Sugerido: **3 dias úteis**.)*
- **14.2** A partir de quantos dias sem movimentação um processo é considerado **"parado"**? *(Sugerido: 30 dias.)*
- **14.3** Quem são os **responsáveis** padrão por tipo de demanda/comarca (para sugestão automática de responsável)?

### H.3 Inteligência (IA)
- **15.1** Podemos usar um **provedor de IA** (ex.: OpenAI/Anthropic) para classificar movimentações e fazer busca de teses? Há restrição de **sigilo** quanto a enviar dados de processos para a IA? *(Importante definir por causa de dados sensíveis.)*
- **15.2** **Base de teses e decisões**: você tem material para povoar (decisões relevantes, entendimentos de turmas/tribunais)? Em que formato? *(O povoamento inicial é responsabilidade do escritório; nós entregamos a ferramenta.)*
- **15.3** A classificação automática e as sugestões de IA precisam de **confirmação humana** sempre, ou algumas ações podem ser automáticas? *(Sugerido: sempre confirmação humana em prazos críticos.)*

### H.4 Centro de Exceções
- **16.1** Quais situações são **alertas prioritários** para vocês? *(Ex.: prazo sem responsável, prazo conflitante, tarefa vencida, processo parado, erro de integração.)* — confirmar/priorizar.

---

## BLOCO I — Identidade e gerais

- **17.1** Confirmar a **identidade visual** (cores navy/dourado já aplicadas) e enviar **logo em alta** se houver versão melhor.
- **17.2** **Domínio** definitivo do sistema (já temos `sistemahyagoviana.com.br`?) e e-mails de envio (cobrança, notificações).
- **17.3** Existe alguma **prioridade de negócio** entre as frentes? (Ex.: "preciso cobrar primeiro" vs "preciso da controladoria primeiro".) — isso define a ordem da fila.

---

## 🔐 Itens de segurança (lembrete — rotacionar credenciais que vazaram no chat)
- Chave do Google Service Account
- Senha do admin do sistema
- API key do n8n

---

### ✅ Resumo do que **mais destrava** agora (se quiser priorizar 5 respostas)
1. **A.5.1** — modelo atual do Termo de Acerto (arquivo)
2. **B.7.1** — qual plataforma de cobrança + credenciais
3. **D.9.1/9.2** — arquivos da base atual (Excel/Trello) para migração
4. **H.13.1** — Projuris tem API oficial? credenciais?
5. **H.15.1** — pode usar IA com dados de processos? (sigilo)
