# Story N1: Voltar ao Kanban do tema pelo caminho da ficha + Configurações separadas (sistema × meu perfil)

**Épico:** Reunião 2026-08-26 · **ID:** N1 (item 8 do owner + pedido da reunião) · **Onda:** 2 · **Status:** Draft
**Executor:** @dev · Quality gate: @qa
**Risco:** BAIXO — navegação e layout. Sem banco, sem RPC.

---

## Story

**Como** advogado que abre um caso a partir do Kanban do tema,
**quero** clicar no **nome do tema** no caminho (breadcrumb) da ficha e **voltar para aquele Kanban**,
**para que** eu não caia na primeira página e tenha que reencontrar tudo de novo.

Thiago, ao vivo: "eu tô aqui na página do caso. Se eu clico aqui em casos, ele vai me voltar lá para a primeira aba. Agora eu não consigo clicar aqui e cair naquela área do tema… eu queria clicar aqui e poder voltar para aquele Kanban que eu tava."

E, na mesma tela de configurações: "eu tenho as configurações do meu usuário, mas eu tenho também as do sistema — separar como menu."

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Breadcrumb da ficha:** `src/routes/casos.$id.tsx:70` —
  `<Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: caso?.case_code }]} />`.
  É exatamente o ponto do reclame: só tem "Casos" e o código.
- **O Kanban do tema já é endereçável por URL.** `src/routes/pipeline.tsx` valida os search params
  (linhas 53-71): `cat` (= `service_type_id`, uuid), `catName`, `temaId`, `frente`, `board`, `picker`.
  Os cards navegam para lá com `search: { cat: stId, catName: t.name, temaId: t.id }` (linha ~224).
- **O caso tem o que precisa:** `system_cases.service_type_id` e `tema_id` (já vêm no `useCase`).
- **Primitivo:** `Breadcrumb` em `src/components/hv/primitives`.
- **Configurações:** `src/routes/configuracoes.index.tsx` é uma página só, empilhando, nesta ordem:
  perfil do usuário logado (linha ~42), `MyProfileSection`, `ChangePasswordSection`, `AppearanceSettings`
  e os atalhos de sistema (Campos personalizados :83, Importação :102, Integrações :120,
  Tipos de tarefa :138, Workflows :156, Permissões :173).
- **Gate já existente:** `usePodeEditar("sistema")` controla os atalhos de sistema (linha ~30).

### NOVO

1. Breadcrumb da ficha com **3 níveis**: Casos → **{Tema}** (link para o Kanban daquele tema) → {case_code}.
2. Configurações reorganizadas em **duas seções/abas**: **Meu perfil** e **Sistema** (esta só para quem tem `sistema:view`).

---

## Acceptance Criteria

1. **Breadcrumb com o tema.** Na ficha do caso (e nas sub-abas: Documentos, Financeiro, Judicial, Termo), o caminho mostra `Casos › {Nome do tema} › {case_code}`.
2. **O clique leva ao Kanban certo.** Clicar no nome do tema navega para `/pipeline` com `cat = service_type_id do caso`, `catName = nome do tema` e `temaId = tema_id do caso` — ou seja, abre **o Kanban daquele tema**, não a página de escolha.
3. **Caso sem tema não quebra.** Se o caso não tiver tema/service_type, o breadcrumb volta ao formato atual (2 níveis), sem link morto.
4. **Configurações separadas.** `/configuracoes` passa a ter duas seções claramente rotuladas: **Meu perfil** (dados, senha, aparência) e **Sistema** (campos personalizados, importação, integrações, tipos de tarefa, workflows, permissões).
5. **Gate preservado.** A seção **Sistema** só aparece para quem tem permissão de sistema — exatamente a mesma régua de hoje (`usePodeEditar("sistema")` / `requireModule` nas telas de destino). Usuário comum vê só "Meu perfil".
6. **Nada muda de endereço.** As rotas filhas (`/configuracoes/campos-personalizados`, `/tipos-tarefa`, `/workflows`, `/importacao`, `/integracoes`, `/permissoes`) continuam com as mesmas URLs.
7. **Regressão.** `typecheck` + `lint` limpos; nenhum atalho some.

---

## Tasks / Subtasks

### T1 — Breadcrumb (@dev)
- [ ] Em `casos.$id.tsx`, montar o item do meio a partir de `caso.service_type_id` / `caso.tema_id` / nome do tema (o nome já vem no detalhe do caso; se não vier, buscar do catálogo de temas já carregado). (AC-1, AC-2)
- [ ] Guard: sem `service_type_id`, renderizar só os 2 itens. (AC-3)
- [ ] Conferir que as sub-abas herdam o mesmo breadcrumb (ele fica no layout `casos.$id.tsx`, então herdam — validar no navegador). (AC-1)

### T2 — Configurações (@dev)
- [ ] `configuracoes.index.tsx`: agrupar em duas seções com títulos ("Meu perfil" / "Sistema"), mantendo os mesmos componentes e links; a de Sistema condicionada à permissão. (AC-4, AC-5, AC-6)

### T3 — QA (@qa)
- [ ] Abrir caso a partir do Kanban de um tema, clicar no tema no caminho: volta ao Kanban daquele tema, com a categoria certa selecionada. (AC-2)
- [ ] Repetir a partir da Lista e da busca (casos que não vieram do Kanban): o link continua levando ao Kanban do tema do caso. (AC-2)
- [ ] Caso sem tema: breadcrumb de 2 níveis, sem erro. (AC-3)
- [ ] Usuário sem permissão de sistema: só vê "Meu perfil". (AC-5)

---

## Dev Notes

- **Não inventar rota nova.** O Kanban do tema **não** é uma rota própria — é `/pipeline` com search params. Criar `/temas/$id` seria retrabalho e quebraria o `cat` que já governa a navegação.
- **`catName` é só cosmético** (título enquanto carrega), mas mandar junto evita o piscar de "·" no cabeçalho.
- **Voltar para a etapa exata** (a coluna onde o card estava) **não** faz parte desta story — o Thiago pediu "voltar para aquele Kanban". Se ele quiser a coluna depois, o `board` já existe nos search params e dá para evoluir.
- **Configurações:** é só reagrupar visualmente. Não mover rota, não mexer em permissão — o risco aqui é justamente alguém "aproveitar" e mexer no gate.

## Testing

- **UI:** breadcrumb nas 5 telas do caso; configurações com e sem permissão de sistema.
- **Gates:** typecheck + lint.

## Dependências

- Toca `casos.$id.tsx` (layout), que **nenhuma outra story desta onda** altera. Independente.

## File List

**Alterados**
- `sistema-hv/src/routes/casos.$id.tsx`
- `sistema-hv/src/routes/configuracoes.index.tsx`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial | @sm (River) |
