# Documentação da API do ProJuris

Baixada de <https://docs.projurisadv.com.br> em 24/08/2026. São os arquivos que a
própria ferramenta publica (gerados pelo Enunciate), não uma transcrição nossa.

| arquivo            | o que é                                                        |
| ------------------ | -------------------------------------------------------------- |
| `application.wadl` | a **lista de endereços** — 978 recursos, com os verbos de cada um |
| `ns1.xsd`          | a **descrição dos campos** de cada corpo de requisição/resposta   |
| `ns2.xsd`          | o mesmo, para os relatórios                                      |
| `ns0.xsd`          | só amarra os dois acima                                          |

O WADL sozinho diz que existe `POST /tarefa`; o `ns1.xsd` diz **quais campos** esse
POST espera. Foi a segunda metade que destravou a criação de tarefa e de processo.

## Como consultar

Para descobrir o corpo de um endpoint, ache no WADL o `element` da requisição e
depois procure esse nome no `ns1.xsd`:

```
POST /tarefa  →  <wadl:representation ... element="ns1:tarefaWs"/>
                 →  <xs:element name="tarefaWs"> no ns1.xsd
```

## Onde o XSD mente

Vale registrar, porque custou caro descobrir (ver `src/lib/projuris/criar-tarefa.ts`):

- **Datas são epoch em milissegundos**, não `YYYY-MM-DD`. O XSD diz `xs:date`.
  Mandar a string devolve `HTTP 500` genérico, sem dizer qual campo está errado.
- **`modulo` vai em MAIÚSCULAS** (`"PROCESSO"`). O XSD aponta para o enum
  `moduloType`, que é minúsculo; o que a API aceita é o `moduloTarefaType`.
- **Campos opcionais que na verdade são obrigatórios**: em `tarefaWs`, o XSD marca
  `dataBase`, `dataLimite` e `tarefaEventoSituacaoWs` como `minOccurs="0"`, mas a
  API recusa sem eles.

Quando a validação passa, o erro vira `HTTP 412` com o campo nomeado
(`erro.validacao.tarefa.dataBase.naoInformado`) — um de cada vez. Um `500` genérico
quase sempre significa erro de **formato**; um `412` significa erro de **conteúdo**.
