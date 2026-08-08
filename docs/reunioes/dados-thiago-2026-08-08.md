# Retorno do Thiago (2026-08-08) — planilha preenchida + regras dos áudios

Fontes: `Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx` (planilha devolvida) + 5 áudios de WhatsApp + print do Trello.

## 1) Colunas REAIS da planilha (Thiago expandiu o template)
`Nome completo | Perfil | E-mail corporativo | Telefone | Status colaborador/e-mail | Unidade Organizacional | Cargo | Time/Equipe | ID ProJuris | Status usuário projuris | Peticionante | Participa da distribuição padrão | Peso | Ver Operacional | Ver Comercial | Ver Financeiro | Ver Judicial | Ver Controladoria | Vê valores (R$) | Observações`

- **Perfil:** Administrador / Usuário padrão / Coordenador / Financeiro.
- **Cargo (nível):** Sênior / Júnior / Estagiário / Prestador de serviço / Administrador.
- **Status colaborador/e-mail:** ativo / Inativo.
- **Status usuário projuris:** Habilitado / Desabilitado (= arquivado no ProJuris).
- **ID ProJuris:** formato **`PES.XXXXXXX`** (ex.: THIAGO=PES.0000030, Thaíse=PES.0003673). ⚠️ mudou do que tínhamos (antes eram números tipo 128858) — o de-para de executores tem que casar por `PES.*`.
- ~30 colaboradores; telefones ficaram em branco (Thiago vai passar depois).

## 2) Regras do MOTOR (áudios) — importantes

### Duas flags distintas (não confundir):
- **Peticionante (Sim/Não):** se **Não → a pessoa NEM é considerada pelo motor**. Se Sim → pode receber tarefas (pela fila geral OU específica/exceção).
- **Participa da distribuição padrão / geral (Sim/Não):** quem entra na **fila ordinária/geral**. Só **sêniores marcados "Sim"**. Sêniores "Não" (ex.: Thiago, Ana Patrícia, Thaíse) recebem **só por regra específica/exceção**. Júnior/estagiário = **Não** (não recebem agenda direto — vêm do sênior).
  - Na planilha, "Sim" na distribuição padrão: **Keilane, Maxwel, Wdyson**.

### Times / Equipes (conceito NOVO — importante para o write-back):
A distribuição vai para o **sênior**; na hora de **criar a tarefa no ProJuris**, adiciona o **time inteiro** (sênior + júnior + estagiário da mesma equipe). Ex.: "time do Bruno = Pedro + Amanda → cria a tarefa com Bruno, Pedro e Amanda".
Equipes da planilha:
- **Equipe 1:** Ana Patrícia Cruz (Sênior)
- **Equipe 2:** Maxwel (Sênior) + Amanda Campos (Estagiário) + Pedro Holanda (Júnior)
- **Equipe 3:** Keilane (Sênior) + Sarah Helena (Júnior)
- **Equipe 4:** Wdyson (Sênior) + Leslie Souza (Júnior)
- **Equipe 5:** Thaíse (Sênior)

### Complexidade (o Thiago ESQUECEU a coluna — passou por áudio):
"recebe complexidade" = **Não para todos, EXCETO 4 pessoas**: **Bruno, Hudson, Patrícia e Keilane** → `eligible_complex = true`.
> ⚠️ **INTERPRETAÇÃO A CONFIRMAR** (os nomes "Bruno" e "Hudson" não estão literais na planilha):
> - **Bruno** = **Maxwel Bruno Santos Costa** (bate: o áudio diz "time do Bruno = Pedro + Amanda", que é a Equipe 2 = Maxwel).
> - **Hudson** = **Wdyson Neres Moreira da Costa** (grafia fonética).
> - **Patrícia** = Ana Patrícia Cruz · **Keilane** = Keilane Alves.
> **Confirmar com o Thiago antes de gravar no sistema.**

### Usuários ARQUIVADOS (áudio 4):
Usuários **Desabilitado/Inativo** (ex.: Nicole júnior, Micael, Rodrigo, Matheus Rocha da Silva) entram como **REGISTRO no sistema, SEM acesso** (sem convite/e-mail — o e-mail do Drive já foi excluído).
Motivo: eles **aparecem nas tarefas do ProJuris** que vamos espelhar na aba do processo; se não existirem no nosso sistema, o espelhamento quebra. São **só arquivo/vínculo**, não logam.

### Permissão por CARGO/Perfil (áudio 4 — FUTURO):
Ele deixou Perfil/Cargo (Coordenador, Prestador de serviço, etc.) pensando em **regra de visualização por cargo** (definir permissão por cargo, não só pessoa a pessoa). Feature futura.

## 3) Trello (áudio 3 + print)
O print confirma o visual: cada comentário é um card com **autor + data + texto** (ex.: "thiago correia · 11 de jun. de 2026, 09:52 · ATENÇÃO!!!") + Editar/Excluir por item. Thiago diz que o formato "igual aparece em notas" já fica bom (M1). Print serve de referência visual.

## 4) O que AINDA falta o Thiago mandar (amanhã)
- **Telefones** dos colaboradores.
- Os 14 tipos (quais ficam/saem + pontuação) — ainda pendente.
- Confirmar a interpretação Bruno=Maxwel / Hudson=Wdyson (complexidade).
- "outros pontos que ficou de passar".
