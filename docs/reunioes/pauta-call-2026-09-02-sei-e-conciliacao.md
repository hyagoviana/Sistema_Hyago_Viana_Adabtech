# Pauta da call — quarta, 02/09/2026

Dois temas: **SEI** (Ministério da Saúde e AGSUS) e **conciliação ContaAzul ↔ Asaas**.

O primeiro já tem resposta técnica; o segundo depende de ver a rotina atual.

---

## 1. SEI — a porta existe, e é melhor do que esperávamos

O Thiago apostou que não haveria API ("acho muito difícil ter esse acesso via
API"). A investigação encontrou o contrário — pelo menos na AGSUS.

### O que foi testado (31/08)

| Alvo | Resultado |
|---|---|
| `sei.agenciasus.org.br` | **Responde.** O SEI da AGSUS está no ar e acessível |
| `…/sei/controlador_ws.php?servico=sei&wsdl` | **HTTP 200 — devolve o WSDL completo** |
| Operações expostas | **60+**, incluindo as que interessam |
| `sei.saude.gov.br` | DNS resolve (189.28.130.1), mas **a conexão é recusada da nossa rede** — não deu para testar daqui |

### O achado

O SEI tem um **web service SOAP nativo** (`SeiWS`) — não é o `mod-wssei`, é parte
do próprio SEI. E o da AGSUS está **ligado e publicamente visível**.

As operações que resolvem o problema do escritório:

- **`consultarProcedimento`** — consulta o processo pelo número e devolve
  assuntos, interessados, observações, unidades onde está aberto, processos
  relacionados e anexados, **e os andamentos** (geração, conclusão, último).
- **`listarAndamentos`** — a movimentação completa do processo.
- `consultarDocumento`, `listarUnidades`, `listarUsuarios`, entre outras.

Assinatura real, extraída do WSDL da AGSUS:

```
consultarProcedimento(
  SiglaSistema,            ← credencial
  IdentificacaoServico,    ← credencial
  IdUnidade,
  ProtocoloProcedimento,   ← o número do processo
  SinRetornarAssuntos, SinRetornarInteressados, SinRetornarObservacoes,
  SinRetornarAndamentoGeracao, SinRetornarAndamentoConclusao,
  SinRetornarUltimoAndamento, SinRetornarUnidadesProcedimentoAberto,
  SinRetornarProcedimentosRelacionados, SinRetornarProcedimentosAnexados
)
```

### O que falta — e não é técnico

`SiglaSistema` e `IdentificacaoServico` são credenciais que **o órgão cadastra**
para um sistema externo autorizado. Ou seja:

> A porta existe e está aberta. O que falta é a AGSUS liberar a chave para o SHV.

Isso é um **pedido administrativo**, não um problema de engenharia. E é
exatamente o oposto de burlar CAPTCHA: é o caminho oficial que o próprio SEI
oferece para integração entre sistemas.

### Decisões para a call

1. **Quem pede a credencial à AGSUS?** Precisa ser o escritório, formalmente.
   Vale checar se algum contrato/convênio existente já dá base para o pedido.
2. **Ministério da Saúde:** preciso que alguém rode este comando **da rede do
   escritório** (leva 10 segundos e não escreve nada):

   ```
   curl -sSI "https://sei.saude.gov.br/sei/controlador_ws.php?servico=sei&wsdl"
   ```

   Se responder **200**, o MS tem a mesma porta da AGSUS e o caminho é o mesmo.
   Se der timeout também aí, o serviço está fechado para fora e sobra só o
   pedido formal.
3. **Se as credenciais vierem:** o processo entra no SHV como andamento do caso,
   igual ao que o motor já faz com o ProJuris. A mecânica de "puxar andamento →
   virar tarefa" já existe e seria reaproveitada.

### O que continua descartado

A Pesquisa Pública (anônima) exige CAPTCHA em qualquer busca textual —
confirmado na tela. Contornar isso segue fora de cogitação: risco jurídico,
bloqueio de acesso e manutenção infinita. Com a porta oficial disponível, nem
faz sentido discutir.

---

## 2. Conciliação ContaAzul ↔ Asaas

O Thiago corrigiu o entendimento: **não é sobre cobrar pelo Asaas**, é sobre
conciliar os dois sistemas. Hoje isso não existe de forma nativa — só via Pluga.

### O que o SHV já tem (e por que ele é candidato natural)

O sistema **já faz uma conciliação** hoje, e ela funciona:

`syncContaAzulPagamentos` roda todo dia às 08:30 (e sob demanda pelo botão
"Sincronizar Conta Azul" no caso). Ele:

1. lê as parcelas do SHV que estão pendentes;
2. busca no ContaAzul as contas a receber **recebidas**;
3. **casa as duas pontas** — primeiro pelo ID do lançamento e, quando não há ID,
   por uma heurística de código do caso + valor + vencimento;
4. marca a parcela como paga.

Ou seja, a mecânica de "casar o que entrou lá com o registro daqui" **já está
escrita e rodando**. Estender isso ao Asaas é aproveitar o que existe, não
começar do zero.

### As duas assimetrias que definem o desenho

| | ContaAzul | Asaas |
|---|---|---|
| Avisa quando algo acontece? | **Não** — a API não tem webhook | **Sim**, webhook em tempo real |
| Como o SHV descobre | Consulta periódica (cron 08:30) | Recebe o aviso na hora |

É por isso que o Pluga também precisaria de varredura: a limitação é do
ContaAzul, não da ferramenta. Qualquer solução vai ter esse mesmo teto.

### As três perguntas que destravam o desenho

1. **O que hoje não bate, na prática?** É valor, é data, ou é identificar *qual*
   lançamento do ContaAzul corresponde a cada entrada do Asaas?
2. **Quem faz a conferência hoje, e com que frequência?**
3. **O resultado esperado é um relatório do que divergiu, ou o sistema
   corrigindo sozinho?**

A terceira é a que mais muda o tamanho do trabalho: apontar divergência é
pequeno; corrigir sozinho mexe em dinheiro e exige trilha de auditoria.

### O pedido para a call

Ver a conferência sendo feita **do jeito atual**, mesmo que rápido, com a tela
compartilhada. É ali que aparece o que realmente precisa ser automatizado — e
normalmente é diferente do que se imagina descrevendo por escrito.

### Comparação honesta com o Pluga (a fechar depois das respostas)

| | Pluga | SHV |
|---|---|---|
| Custo | mensalidade recorrente | desenvolvimento uma vez |
| Enxerga o caso | não | **sim** — é o que dá sentido ao lançamento |
| Depende de varredura no CA | sim (limitação do ContaAzul) | sim (mesma limitação) |
| Controle do de-para de categoria | limitado | total |
| Manutenção | do fornecedor | nossa |

Sem as respostas às três perguntas, essa comparação é opinião. Com elas, vira
número.

---

## Resumo do que preciso levar da call

- [ ] Quem pede a credencial do SEI à AGSUS, e com que base
- [ ] Resultado do teste do `curl` no SEI do Ministério da Saúde
- [ ] As três respostas da conciliação
- [ ] Ver a rotina de conferência atual sendo executada
