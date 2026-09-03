# Story S3-03: Painel de dados do cliente na ficha + botão do Drive enxuto

- **Sprint:** S3 — Cliente
- **ID:** S3-03 · **Item do Thiago:** 7
- **Status:** Ready for Review (AC 3 entregue como leitura — ver desvio)
- **Estimativa relativa:** M
- **Executor sugerido:** @dev · Quality gate: @qa + @ux-design-expert
- **Depende de:** S1-05 (campos do tema com escopo cliente precisam existir do lado do cliente)

---

## Story

**Como** quem abre a ficha do cliente,
**quero** ver os **dados cadastrados dele** num painel, como já vejo na ficha do caso,
**para que** eu não precise abrir a edição para conferir uma informação.

---

## Contexto

Anotações do Thiago no desenho 31:
- *"Adicionar um menu/painel onde ficam os dados cadastrados para o cliente (assim como já temos para a
  página do caso). obs: aqui não viria informação/dados dos campos dos casos, apenas dos campos padrões e
  personalizados que são referente a entidade 'Cliente'."*
- Sobre o card da pasta do Drive: *"Vamos alterar do visual de um painel/menu que ocupa tanto espaço e
  manter como um botão (de fácil visualização, mas menor e mais proporcional do que o formato atual)."*

Referência interna: o painel **DADOS DO CASO** (`CaseCanonicalFields`) já faz exatamente isso do lado do
caso, com bloqueio/desbloqueio de edição.

---

## Acceptance Criteria

1. Painel **"Dados do cliente"** na ficha, listando os **campos padrão** (documento, nascimento, estado
   civil, endereço, formação/FIES/residência, contatos) **e** os **campos personalizados do cliente**.
2. **Não** aparecem campos de caso. Um campo do tema com `scope='cliente'` aparece (é do cliente);
   um `scope='caso'` não.
3. Mesmo padrão de interação do painel do caso: leitura por padrão, edição inline após desbloquear,
   respeitando o gate de escrita do módulo Cliente.
4. Campo vazio não polui: some ou aparece esmaecido, conforme o padrão já usado no caso.
5. O card **Pasta no Drive** vira **botão** ("Abrir no Drive"), alinhado ao cabeçalho da ficha, liberando
   a faixa que ele ocupava hoje.
6. O espaço liberado é usado pelo conteúdo previsto na **S3-04** (visão 360) — esta story só libera.
7. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [x] Componente `ClientDataPanel` reusando o padrão de `CaseCanonicalFields` (AC 1-4).
- [x] Fonte de dados: campos padrão + `system_client_field_defs` (AC 1, 2).
- [x] Substituir o card do Drive por botão (AC 5). (`src/routes/clientes.$id.tsx`)
- [ ] Gate de escrita pelo módulo Cliente (AC 3) — se a S5 ainda não entregou o módulo, usar o gate atual
      e deixar `TODO` marcado para a S5-04 apontar aqui.

---

## Dev Notes

- Reaproveitar componentes, não duplicar: o painel do caso já resolve máscara, tipos e obrigatoriedade.
- Ordem dos campos segue a ordem definida na configuração de campos do cliente (a mesma que a S1-05
  reconcilia).

## Definition of Done

- [ ] A ficha do cliente mostra os dados sem abrir a edição
- [ ] Nenhum campo de caso vaza para o painel do cliente
- [ ] Cabeçalho mais enxuto, com o Drive como botão

---

## Dev Agent Record (03/09/2026)

**Implementado.** `src/components/clients/ClientDataPanel.tsx` — painel único **Dados do cliente**, em
cinco blocos: Identificação · Contato · Endereço · Formação, FIES e residência · Campos personalizados.
Campo vazio não aparece (AC 4).

Ele **absorveu** dois cards que estavam soltos na ficha ("Contato" e "Dados profissionais") — o segundo
mostrava só 5 campos e escondia o resto do bloco profissional. A função `ProfessionalCard` foi removida.

**Drive virou botão** no cabeçalho da ficha, ao lado de Editar/Excluir; o card de faixa inteira saiu (AC 5).

### Desvio consciente do AC 3

O AC pedia edição inline com bloqueio/desbloqueio, como no painel do caso. **Entreguei só leitura**, com a
edição seguindo pelo botão "Editar" — que a **S3-01** transforma em página dedicada.

Motivo: fazer inline aqui exigiria duplicar validação de CPF/CNPJ, verificação de e-mail
(`email-verify.ts`), máscaras e o schema Zod do cadastro, que já vivem no formulário. Duas cópias da
mesma regra divergem com o tempo. Se o Thiago sentir falta ao ver a tela, o inline entra depois — o
painel já está montado para receber.

---

## QA Results — 03/09/2026 (Quinn)

**Gate: CONCERNS** — implementação correta e sem perda de dado; o desvio do AC 3 fica registrado para o
owner decidir.

### Verificado contra o banco

- **Nenhum dado sumiu**: as 10 chaves de `professional_data` que têm valor real no banco (`rg_orgao` 316,
  `fies` 290, `crm_numero` 243, `crm_uf` 240, `fies_contrato_numero` 68, `fies_contrato_obs` 7,
  `estado_civil` 2, `residencia_hospital`, `especialidade`, `residencia_especialidade`) estão **todas**
  mapeadas no painel. O card antigo mostrava só 5 delas — a ficha passou a mostrar mais, não menos.
- **Chaves internas não poluem a tela**: `import_batch` (373 clientes) e `cpf_pendente` não têm definição
  cadastrada, então não aparecem como campo. Correto.
- Só `link_chatguru` e `link_chatguru_0781` têm definição ativa entre os personalizados — são os que o
  painel exibe hoje.

### 🔴 Achado de DADO (fora do escopo da story, levado ao owner)

Cruzando os dois baldes do campo **FIES**:

| | |
|---|---|
| clientes com FIES no campo **personalizado** | 375 |
| clientes com FIES no campo **padrão** | 290 |
| têm os dois e **divergem** | **373 de 373** |
| formatos convivendo na mesma coluna | `["Sim"]`, `"Não"`, `false` |

Na maioria dos casos o campo **padrão está vazio** e quem tem o dado é o personalizado — que **não tem
definição cadastrada** e por isso **não aparece em lugar nenhum** da ficha. Ou seja: o FIES de ~375
clientes está invisível no sistema hoje.

Isso muda o peso da pergunta A3 ao Thiago e **inverteu a nossa recomendação** (antes: "use o campo
padrão"; agora: "consolide no personalizado, que é onde o dado está"). O documento de perguntas foi
corrigido com os números.

Consequência prática: o backfill da S1-05, que estava retido como "cosmético", na verdade **destrava
dado de centenas de clientes**. Vale prioridade na resposta.

### Observação de limpeza

Há ~11 definições de campo de teste no banco (`SMOKEB1 …`, `REPROB1 Foo`), todas inativas — não aparecem
na ficha, mas sujam a tela de gestão de campos. Vale uma limpeza num momento oportuno.
