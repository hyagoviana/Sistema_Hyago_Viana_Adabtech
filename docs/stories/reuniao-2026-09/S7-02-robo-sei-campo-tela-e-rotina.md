# Story S7-02: Robô SEI — campo do processo, tela de configuração e rotina

- **Sprint:** S7 — Trilhas externas
- **ID:** S7-02 · **Item do Thiago:** 13
- **Status:** Draft (depende do resultado da S7-01)
- **Estimativa relativa:** G
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** advogado responsável por centenas de processos administrativos,
**quero** que o sistema me diga **quais tiveram movimentação** desde a última vez que olhei,
**para que** eu abra só os que mudaram.

---

## Contexto

Desenho do Thiago (bloco 1, 47:49): *"eu pensei em ter um campo personalizado, e aí vamos supor que tem os
campos personalizados dos temas que tem essa informação: número do processo SEI aqui para acompanhamento.
Aí a gente vai ter como se fosse uma paginazinha aqui, como tem para uma situação específica igual a da
distribuição (...) consulta automatizada SEI. E aí na configuração dessa paginazinha a gente vai ter uma
opção que indica em quais campos personalizados de quais temas tem esse número, para o sistema saber onde
que ele encontra esse número."*

E o resultado que ele quer ver: *"o robô me mostra isso aqui assim: processo administrativo número tal,
data da última movimentação 18/06. Data de última visualização, 26. Eu sei que eu nem preciso fazer nada
agora."*

---

## Acceptance Criteria

1. **Onde mora o número**: tela de configuração que indica, por tema, **qual campo personalizado** guarda
   o número do processo administrativo. Nada de campo fixo — é o desenho dele, e respeita a estrutura de
   campos por tema que já existe.
2. Página **Consulta automatizada (SEI)**, no mesmo espírito das telas do motor de distribuição, com:
   - lista dos processos monitorados (caso, cliente, número, tema);
   - **data da última movimentação** (do portal) e **data da última visualização** (nossa);
   - destaque para os que **mudaram desde a última visualização**;
   - ação "marcar como visto".
3. **Rotina** configurável (diária ou semanal — ele aceita semanal), com trava de segurança: só roda se
   ligada, respeita `CRON_SECRET`, e não roda em dia não operacional se assim configurado.
4. **Registro por consulta**: o que foi consultado, quando, resultado e falha — para depurar quando o
   portal mudar.
5. Falha de CAPTCHA/portal **não derruba a rotina**: marca a linha como "não consultado" e segue.
6. Limite de custo: teto de consultas por execução, configurável, para o serviço pago não escapar do
   orçamento.
7. A implementação segue a recomendação aprovada na **S7-01**.
8. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [ ] Migration: tabela de monitoramento (processo, case_id, última movimentação, última visualização,
      última consulta, status) — aditiva.
- [ ] Tela de configuração campo↔tema (AC 1).
- [ ] Página de acompanhamento (AC 2).
- [ ] Rotina + trava + teto (AC 3, 6).
- [ ] Registro e tolerância a falha (AC 4, 5).

---

## Dev Notes

- Reusar o padrão das telas do motor (Configuração/Operação/Auditoria) — a controladoria já sabe usar.
- Guardar o **texto bruto** da última movimentação, não só a data: ajuda a explicar por que o sistema
  achou que mudou.
- Se a S7-01 recomendar não construir o robô, **esta story ainda entrega valor parcial**: campo, tela e
  registro manual de "última visualização" já organizam o trabalho que hoje é feito de memória.

## Definition of Done

- [ ] Uma execução real cobre os processos de um tema e aponta os que mudaram
- [ ] Custo por execução medido e dentro do teto
