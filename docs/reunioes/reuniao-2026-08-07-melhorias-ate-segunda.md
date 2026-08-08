# Reunião com Thiago (2026-08-07) — Melhorias até segunda-feira + pendências

Fonte: transcrições "Matheus Torquato [0601] Opa, Thiago" (parte 1) + "Dr. Thiago Correia [0000] se tiver" (parte 2) + roteiro-validacao-projuris-thiago.md (respostas do Thiago).
Contexto: semana que vem o pessoal já começa a usar (indenização + Mais Médicos). Segunda tem reunião com o Iago — o sistema precisa estar "redondo".

---

## 🟢 MELHORIAS PARA IMPLEMENTAR ATÉ SEGUNDA

### Ficha do caso (UI/UX)
- **M1 — Linha do tempo + comentários = um fluxo só (estilo Trello).** Hoje estão separados e "grande e pequeno". Unificar num fluxo cronológico visual (cards), substituindo os comentários do Trello. Renomear **"Notas" → "Notas / Linha do tempo"**; o bloco sobe pra perto do topo. Deve permitir **comentar** na linha do tempo. **Editar/excluir:** cada usuário edita/exclui o **próprio** comentário; **admin** pode excluir de qualquer um (metodologia Trello). Barra de rolagem quando ficar grande. ⏳ *Aguardar o print do Trello que o Thiago vai mandar (referência visual).*
- **M2 — Campo "Observações".** Um campo de **texto grande e livre** (observações do caso inteiro), separado da linha do tempo, na última aba (embaixo). Não vai pra lugar nenhum, só fica registrado no caso.
- **M3 — "Documentos" vira ABA no topo do caso.** Hoje é bloco embaixo (vira bagunça com muito documento). Criar aba **Documentos** ao lado da aba **Judicial**.
- **M4 — "Termo" migra para dentro da aba Financeiro.** O termo é 100% financeiro; sai de solto e entra como parte do Financeiro.
- **M7 — Campos do CLIENTE abrem AO LADO (não pop-up).** A tela de "editar campos do cliente" deve abrir como página lateral, igual à de campos da pipeline (não em pop-up). *(refinamento do B1/I1)*

### Aba Judicial / Financeiro (vínculos de identificação)
- **M5 — Aba Judicial:** campo para adicionar manualmente o **identificador do processo no ProJuris** (ex.: `PRO.0007713`). Os ~400 casos importados podem ter judicial; esse campo casa o caso ↔ ProJuris.
- **M6 — Aba Financeiro:** campo para adicionar manualmente o **nº da fatura do Conta Azul** por cobrança (identificação, já que um caso pode ter várias cobranças lá).

### Cadastro de colaboradores / Permissões / Motor
- **M8 — Nível do colaborador + participa da distribuição.** Adicionar no cadastro o campo **nível: Estagiário / Júnior / Sênior** e a flag **"Participa da distribuição" (sim/não)**. Regra: **só o sênior participa** do rodízio; o time (júnior/estagiário) **não** distribui, mas aparece na agenda junto. Preencher ao **convidar** a pessoa. **A tela de convite está diferente da de editar (falta campo) — igualar as duas** (ID ProJuris + nível + participa).
- **M9 — Peso.** Padrão **peso 100** (distribui igual). Criar mecanismo de **reduzir o peso quando a pessoa está saindo** (recebe menos) ou aumentar quando entra. O motor sempre considera o **peso atual na data** da distribuição (conferir se a regra atual já faz isso).
- **M10 — Manifestação (5/10/15 dias):** criar **uma lógica/tipo para cada** prazo (não juntar).
- **M11 — Prazo previsto/fatal:** o motor **puxa do ProJuris** (cada tarefa tem lá); quando muda no ProJuris, reflete no sistema. Manter também **registro interno** no sistema (decisão do Thiago: "fica melhor ter interno").
- **M12 — 14 tipos sem pontuação:** refletir no sistema **e** na lista, com a **menor pontuação** existente como placeholder (o Thiago ajusta depois). Alguns saem (ex.: "Lembrete"). ⏳ *Aguardar o Thiago mandar quais ficam/saem + a pontuação de cada um.*
- **M13 — Complexidade/coletivo/urgente:** puxar **complexo e coletivo de MARCADOR** do ProJuris (v1). **Fallback:** sem info = individual e não-complexo. **Urgente/prioritário NÃO existe no ProJuris** — precisamos **adicionar um campo no nosso sistema** para isso.
- **M14 — Responsável exclusivo (exceções):** confirmado — Audiência→Thiago, Sustentação Oral→Thiago, INDENIZAÇÃO PMMB→Thaíse, TEMFC→Patrícia (= Ana Patrícia Cruz). Fica na **configuração da tarefa** ("pessoa obrigatória").

### Decisões já fechadas na reunião (só executar)
- **Diligências/Balcão:** o Thiago vai **apagar os 2 duplicados no ProJuris** e deixar 1 só → usamos esse.
- **Emenda** = "Emenda à Inicial". **Réplica** = "Réplica à Contestação".
- **Criar tipo de tarefa:** v1 = **criar no ProJuris primeiro** e o sync espelha no sistema; v2 (futuro) = criar no sistema e espelhar no ProJuris.
- **Teste de write-back:** usar o caso `0733583-07.2026.8.07.0016` (identificador **PRO.0007713**) — é caso pessoal do Thiago, pode gerar/apagar à vontade.

---

## 🔵 FUTURO (depois de segunda — não bloqueia a semana)

- **F1 — Trello via API (histórico de comentários).** Puxar do Trello os **comentários + data + usuário**, vinculando **card → caso** (o vínculo pode ser manual: "tal card = tal caso"). Espelhamento em tempo real até migrarem; depois desliga. *(2ª fase: escrita bidirecional sistema↔Trello.)* Precisa do **login/senha admin do Trello**. → **Na segunda, dar a resposta ao Thiago de que É POSSÍVEL puxar.**
- **F2 — Importação dos demais temas.** Criar um **processo/script de importação** (formato JSON) para o Thiago fornecer os dados organizados (ele vai montar um "motor intermediário" com GPT/Gemini). Fazer **depois** da reunião de segunda.
- **F3 — Campos com FÓRMULA (estilo Excel).** Campo cujo valor é calculado a partir de outros (ex.: período + 3 anos). Alta complexidade → adiado; por ora mapear a lógica em código quando necessário.
- **F4 — Integração Conta Azul + ProJuris** (definir quais campos aparecem) — a projetar.
- **F5 — Senha/onboarding:** dispara e-mail → pessoa clica no link → cria a própria senha → entra conforme permissões (já existe). Vínculo por e-mail corporativo; ao apagar o e-mail, o usuário **não some** do banco (histórico preservado). Suspender/excluir com reatribuição já existe.

---

## ⏳ O QUE FALTA O THIAGO MANDAR (bloqueia o motor)
1. **Lista de colaboradores** — nome, cargo (estagiário/júnior/sênior), time, **ID ProJuris**, e-mail corporativo, participa da distribuição (sim/não), peso. *(o Hyago também vai mandar os identificadores.)*
2. **Os 14 tipos** — quais ficam e quais saem + a **pontuação** de cada um que fica.
3. **Ajuste no ProJuris** — apagar os Diligência/Balcão duplicados (deixar 1) e conferir os prazos (previsto/fatal) dos tipos.
4. **Print do Trello** — o visual da linha do tempo/comentários que ele quer replicar (M1).
5. **Login/senha admin do Trello** — para F1 (quando formos fazer).

## Ordem sugerida do fim de semana
Front primeiro (M1–M7, independem do Thiago) → depois cadastro/motor (M8–M14, conforme os dados chegarem). F1–F5 ficam pós-segunda.
