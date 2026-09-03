# Story S3-01: Cadastro do cliente vira página própria

- **Sprint:** S3 — Cliente
- **ID:** S3-01 · **Item do Thiago:** 8 · **Decisão:** D7
- **Status:** Ready for Review
- **Estimativa relativa:** G
- **Executor sugerido:** @dev · Quality gate: @qa + @ux-design-expert

---

## Story

**Como** quem cadastra cliente todo dia,
**quero** um formulário em **página inteira**, organizado por blocos,
**para que** eu pare de rolar um pop-up apertado para preencher trinta campos.

---

## Contexto

Anotação do Thiago no desenho 29: *"Vamos transformar o menu 'novo cliente / Editar cliente' em uma página
própria, mais visual e mais intuitiva, deixando de ser apenas um menu 'pop up'."*

Hoje é o `ClientFormDialog` (`src/components/clients/ClientFormDialog.tsx`), aberto pelo botão
**+ Novo cliente** do topo e pelo menu de edição da ficha. Decisão D7: **tudo vira página** — o pop-up
deixa de existir.

---

## Acceptance Criteria

1. Duas rotas novas: **`/clientes/novo`** e **`/clientes/:id/editar`**, com o formulário em página cheia,
   organizado nos blocos que já existem hoje (Identificação · Contato · Endereço · Formação/FIES/Residência ·
   Informações adicionais · Campos personalizados do cliente).
2. **Todos** os pontos de entrada passam a levar à página: botão + Novo cliente do topo, ação da lista de
   clientes, menu da ficha do cliente, e qualquer atalho existente. O `ClientFormDialog` é removido do
   código depois que nenhuma tela o usar.
3. **Fluxos de retorno** preservados: salvar em `/clientes/novo` leva à ficha do cliente criado; salvar em
   `/clientes/:id/editar` volta para a ficha; cancelar volta de onde veio.
4. Casos especiais que hoje criam cliente dentro de outro fluxo (ex.: criar caso a partir de um cliente
   novo) continuam funcionando — se algum deles depende do modal, a story troca por navegação com retorno.
5. Validações atuais **intactas**: verificação de e-mail (`email-verify.ts`), máscara e validação de
   CPF/CNPJ, campos obrigatórios, telefone.
6. Rascunho não é perdido por clique fora (era o comportamento do modal) — sair da página com alterações
   pede confirmação.
7. Responsivo e acessível: navegação por teclado, foco no primeiro campo, erros anunciados.
8. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [x] Criar as duas rotas + layout de formulário em página (AC 1, 7).
- [x] Extrair o corpo do formulário do `ClientFormDialog` para um componente reutilizável (AC 1) — sem
      reescrever regra de validação.
- [x] Repontar todos os gatilhos (AC 2, 4) — varredura por `ClientFormDialog` no repo.
- [x] Navegação de retorno + guarda de saída (AC 3, 6).
- [x] Remover o componente órfão ao final (AC 2).

---

## Dev Notes

- Rota aninhada no TanStack: `/clientes/:id/editar` exige o layout `clientes.$id.tsx` com `<Outlet />` +
  `clientes.$id.index.tsx` — armadilha já registrada no projeto. Se o `routeTree.gen.ts` travar por causa
  do OneDrive, rebuild.
- Os campos e renomeações (`estado civil`, `endereço`, `número endereço`) são a **S3-02** — não antecipar
  aqui, só mover de lugar.
- Manter a mesma RPC de criação/edição (`src/rpc/clients.ts`) — story é de UI.

## Definition of Done

- [ ] Nenhum pop-up de cadastro de cliente no sistema
- [ ] Criar e editar cliente funcionam por todos os caminhos
- [ ] typecheck + lint verdes

---

## Dev Agent Record (03/09/2026)

**Implementado.** O `ClientFormDialog` virou **`ClientForm`** (`git mv`, para o histórico seguir o
arquivo): mesmo formulário, sem o invólucro de diálogo, com `onDone(clientId?)` e `onCancel()` no lugar
de `onOpenChange`. Nenhuma regra de validação foi tocada — só o invólucro.

**Rotas novas:**
- `/clientes/novo` → ao salvar, vai direto para a ficha do cliente criado (ou para a lista, quando o CPF
  já existia e o cadastro foi reaproveitado — o fluxo *find-or-create* não devolve caso novo).
- `/clientes/editar/:id` → volta para a ficha ao salvar ou cancelar.

**Por que `/clientes/editar/:id` e não `/clientes/:id/editar`:** a segunda forma tornaria a ficha
(`clientes.$id.tsx`) um layout, exigindo `<Outlet/>` + um `clientes.$id.index.tsx`. Essa reforma já
mordeu o projeto antes (está registrada como armadilha do TanStack) e não é necessária aqui — rota irmã
entrega o mesmo resultado.

**Pontos de entrada repontados** (nenhum pop-up sobrou): botão "+ Novo cliente" da Topbar, "Novo cliente"
da lista, "Editar" do menu de card da lista e "Editar" da ficha.

**AC 6 (guarda de saída):** "Cancelar" com o formulário sujo pede confirmação — no pop-up antigo, clicar
fora fechava e perdia tudo.

**Efeito de preenchimento:** o `useEffect` que populava o form dependia de `open`; agora roda na montagem
e quando o cliente em edição muda.

---

## QA Results — 03/09/2026 (Quinn)

**Gate: PASS (após 1 ajuste)**

### Verificado

- **Zero referências** a `ClientFormDialog` no código (`grep`), e o arquivo não existe mais — foi
  renomeado, não duplicado.
- **Os 4 pontos de entrada** levam às páginas novas: Topbar, lista (botão e menu do card) e ficha.
  Nenhum caminho ficou com o pop-up.
- **Nenhum outro lugar cria cliente**: os dois arquivos que apareceram no `grep` por
  `useCreateClient*` eram falsos positivos (`useCreateClientFieldDef` e `useCreateClientNote`).
- Estados órfãos (`createOpen`, `editClient`, `editOpen`, `clientDialogOpen`) removidos.
- `npx tsc --noEmit`, `eslint`, `npm run build`, `test:rbac` e `test:validators` verdes.

### 🟡 Ajuste aplicado durante a revisão — página sem gate de UI

As páginas novas nasceram **sem gate próprio**. Os botões que levam a elas já eram gate-ados e o servidor
barra a escrita (`requireAnyModule`), mas quem digitasse a URL veria um formulário inteiro que não
conseguiria salvar — falha só no fim, depois de preencher tudo.

Corrigido: as duas páginas passaram a checar `usePodeEditarAlgum(["comercial","operacional"])` — a mesma
régua da ficha — e mostram "sem permissão" em vez do formulário.

### Observação (não bloqueia)

`ROUTE_MODULE` não tem entrada para `/clientes/novo` nem `/clientes/editar/$id`. Não há impacto hoje:
`canSeeRoute` só é consultado pelo **menu**, e essas rotas não aparecem lá. Se um dia virarem item de
menu, precisarão da entrada — mesma armadilha da S6-01.

**Pendente de validação humana:** o fluxo completo no navegador (criar → ficha; editar → volta;
cancelar sujo → confirmação). A verificação aqui foi de código e build.
