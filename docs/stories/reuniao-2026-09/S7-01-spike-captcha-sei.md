# Story S7-01: Spike — viabilidade da consulta automatizada ao SEI (CAPTCHA)

- **Sprint:** S7 — Trilhas externas
- **ID:** S7-01 · **Item do Thiago:** 13 · **Decisão:** D4
- **Status:** Draft (bloqueada por insumo externo)
- **Estimativa relativa:** M (timebox: 3 dias)
- **Executor sugerido:** @dev + @architect · Quality gate: decisão do owner

---

## Story

**Como** time de desenvolvimento,
**quero** provar, num protótipo, que dá para consultar um processo no portal do Ministério da Saúde
passando pelo CAPTCHA,
**para que** a decisão de construir o robô seja tomada com número na mão, não com promessa.

---

## Contexto

Thiago, na reunião (bloco 1, 40:11-53:12): ele abre **300 a 400 processos administrativos por mês** na
mão, um a um, só para descobrir se houve movimentação. *"Se eu fosse contratar uma pessoa para olhar isso
todo dia (...) seriam 2 estagiários."* O que ele precisa é simples: **data da última movimentação** ×
**data da última visualização** — se não mudou, nem abre.

Sobre a frequência: *"E nem precisa ser todo dia, viu? Cara, a cada 5 dias, uma vez por semana, já é mais
do que a gente faz hoje."*
Sobre custo: *"tem essa opção que o custo é zero e tem essa outra que o custo é R$80 por mês (...) mas que
essa aqui é mais segura, que vai rodar 6 meses sem problema. Bota essa outra que é R$50 por mês, que é boa."*

Adavio: *"manda o site, eu vou tentar via Playwright. Só que assim, eu tenho que visualizar como é que a
gente vai montar, porque o Playwright normalmente ele precisa de uma máquina operando. Como a gente tem um
n8n, talvez eu consiga fazer essa operação."*

---

## Bloqueio

**Insumo do Thiago, ainda não recebido:** link do portal e um número de processo de exemplo.
A story não começa sem isso.

---

## Acceptance Criteria

1. Protótipo funcional que, dado um número de processo, **retorna a data da última movimentação**
   — rodando fora do sistema, em script isolado.
2. Comparação escrita de **pelo menos duas** abordagens de CAPTCHA, com custo mensal estimado para o
   volume real (400 consultas/semana): serviço pago de resolução × alternativa gratuita.
3. **Taxa de sucesso medida** em pelo menos 30 execuções reais, com os erros classificados.
4. Definição de **onde roda**: n8n com navegador, máquina dedicada, ou serviço externo — com o custo e a
   fragilidade de cada opção (o próprio Adavio levantou que Playwright quebra se o portal mudar de layout).
5. Recomendação objetiva ao owner: **vai** (com custo e prazo da S7-02) ou **não vai** (com o que
   entregamos no lugar).
6. Nada é integrado ao sistema nesta story — é spike.

---

## Tasks / Subtasks

- [ ] Cobrar o insumo do Thiago (link + processo de exemplo).
- [ ] Protótipo de navegação + extração (AC 1).
- [ ] Testar as opções de CAPTCHA e medir (AC 2, 3).
- [ ] Documento de recomendação em `docs/reunioes/` (AC 4, 5).

---

## Dev Notes

- Verificar antes se o portal tem consulta pública por API ou algum endpoint JSON — economizaria tudo.
  O Thiago acha que não (*"70% deles não tem acesso externo"*), mas custa uma hora conferir.
- Guardar as respostas brutas: se o layout mudar, o histórico ajuda a consertar rápido.
- **Ética/termos de uso:** conferir se o portal proíbe automação. Se proibir, a recomendação muda —
  e isso precisa chegar ao owner antes de qualquer construção.

## Definition of Done

- [ ] Recomendação entregue com número medido, não estimativa
- [ ] Owner decidiu se a S7-02 acontece
