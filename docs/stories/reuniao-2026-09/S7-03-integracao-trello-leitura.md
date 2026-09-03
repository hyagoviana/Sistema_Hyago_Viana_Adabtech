# Story S7-03: Trello — spike e leitura do quadro Cobrança HV

- **Sprint:** S7 — Trilhas externas
- **ID:** S7-03 · **Item do Thiago:** 12 · **Decisão:** D6
- **Status:** Draft (bloqueada por insumo externo)
- **Estimativa relativa:** G (spike de 1 dia + implementação)
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** escritório que ainda controla parte da cobrança no Trello,
**quero** ver dentro do caso o que está no card correspondente,
**para que** a informação pare de viver em dois lugares sem conversa entre eles.

---

## Contexto

Fecho da reunião (bloco 2, 23:35): *"Matheus, você tinha me mandado um negócio, precisa do Trello (...)
vou só te mostrar os casos que a gente vai puxar. É do tema cobrança HV. (...) eles todos vão estar nessa
aba aqui do Trello que a gente deixou só eles. Já tem aquele identificador do ID card e tal, aquele
negócio lá que você me pediu."* E sobre acesso: *"tu tem Trello? Se tiver conta do Trello, libera essa aba
(...) eu acho que precisa gerar essa aba como premium para poder fazer isso (...) se precisar para fins da
API, a gente gera como prêmio."*

No sistema já existe o campo **IDCARDTRELLO** nos campos do tema (visível no print do "Preencher campos do
tema"). É por ele que o casamento acontece.

**Decisão D6:** por último, e ainda depende do acesso e da leitura da documentação da API.

---

## Bloqueios

- Acesso de administrador ao quadro **Cobrança HV** para a conta do Matheus.
- Confirmação de que o plano do quadro permite o uso de API (Premium, se necessário).

---

## Acceptance Criteria

### Spike (primeiro)

1. Documento curto: como autenticar (chave/token), limites de requisição, quais campos do card estão
   disponíveis, e se dá para receber webhook de alteração.
2. Prova de conceito lendo **um** card real do quadro pelo `IDCARDTRELLO`.

### Implementação (leitura)

3. Configuração da integração (credenciais + id do quadro) na tela de **Integrações**, no mesmo padrão do
   ProJuris, com credencial **fora do código**.
4. Sincronização que casa `IDCARDTRELLO` → caso e traz para a ficha: **lista/coluna atual**, **título**,
   **etiquetas**, **data de vencimento** e **último comentário**, num painel "Trello" somente leitura,
   com link para o card.
5. Caso sem `IDCARDTRELLO`, ou id que não existe mais no quadro: painel não aparece e o problema é
   registrado num relatório de divergências (não polui a tela).
6. Nada é escrito no Trello nesta story.
7. Frequência: junto do cron diário existente, com trava de ligado/desligado.
8. Falha da API do Trello não derruba o cron nem esconde o resto da ficha.
9. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [ ] Cobrar acesso ao quadro (bloqueio).
- [ ] Spike + documento (AC 1, 2).
- [ ] Configuração da integração (AC 3).
- [ ] Sync + painel na ficha (AC 4, 5, 7, 8).
- [ ] Relatório de divergências (AC 5).

---

## Dev Notes

- O `IDCARDTRELLO` hoje é campo de texto preenchido à mão — validar formato e avisar quando estiver
  claramente errado, senão a integração vira caça ao id digitado torto.
- Escrever no Trello (mover card, comentar) foi **descartado** para esta leva; se o owner mudar de ideia,
  é story nova — o risco de laço com os workflows internos precisa de desenho próprio.

## Definition of Done

- [ ] Um caso do tema Cobrança HV mostra o estado do card correspondente
- [ ] Divergências listadas em vez de silenciadas
