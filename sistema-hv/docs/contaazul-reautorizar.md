# ContaAzul — reautorizar o acesso (e por que ele caiu)

## O que aconteceu, sem rodeio

O cadastro do app no ContaAzul **está válido** — `client_id` e `client_secret`
continuam funcionando e não precisam ser pedidos de novo.

O que caiu foi o **refresh token** (a chave que o sistema usa para renovar o
acesso sozinho, sem ninguém logar).

E há uma parte que provavelmente **eu causei**: existe uma cópia ANTIGA desse
refresh token no `.env.local`. O ContaAzul usa refresh token **rotativo** — a
cada renovação o antigo morre e nasce um novo, que o sistema guarda no banco
(`system_integrations`). Ao rodar o diagnóstico, usei a cópia do `.env` (velha).
Provedores que rotacionam tratam o **reuso de um refresh antigo como sinal de
vazamento e revogam a família inteira de tokens** — inclusive o que estava bom.

Evidência de que o acesso estava vivo antes disso: o registro no banco foi
atualizado hoje às **09:50 UTC**, e só passou a recusar depois.

**Consequência prática:** o sync diário do ContaAzul (cron das 6h) vai falhar até
alguém reautorizar. Nada foi perdido — é só reconectar.

---

## O que você precisa fazer (2 minutos)

Não precisa solicitar nada ao suporte do ContaAzul. Precisa apenas de alguém
**logado na conta do escritório** abrindo este link e aprovando o acesso:

```
https://auth.contaazul.com/oauth2/authorize?response_type=code&client_id=1admi9jkvanob02avsqqi8q8so&redirect_uri=https%3A%2F%2Fwww.sistemahyagoviana.com.br%2Fapi%2Fcontaazul%2Fcallback&scope=openid+profile+aws.cognito.signin.user.admin&state=shv
```

O que acontece: o ContaAzul pede o login, mostra a tela de autorização e devolve
para o nosso sistema, que salva o token novo no banco automaticamente. Aparece a
mensagem **"Conta Azul conectada!"** — é só fechar a aba.

**Se der erro de `scope` ou `redirect_uri`:** significa que o app cadastrado no
painel de desenvolvedor do ContaAzul espera outros valores. Nesse caso preciso de
duas informações de lá:

1. os **escopos** que o app declara;
2. as **URLs de callback** cadastradas (tem de existir exatamente
   `https://www.sistemahyagoviana.com.br/api/contaazul/callback`).

---

## Como ficar definitivo

O mecanismo certo **já existe** e é o que o sistema usa:

- o refresh token mora no **banco**, não no `.env`;
- toda renovação salva o token novo por cima (rotação tratada);
- o **cron diário das 6h** chama o ContaAzul todo dia, o que mantém a cadeia viva
  sozinha — token rotativo morre por desuso, e esse uso diário evita isso.

Ou seja: uma vez reautorizado, ele se mantém. Nos últimos meses funcionou assim
(o registro é de 08/07 e vinha renovando todo dia).

**As três coisas que faltam para não repetir:**

1. **Apagar `CONTAAZUL_REFRESH_TOKEN` do `.env.local`** (e da Vercel, se estiver
   lá). Ele é um fallback que só serve para uma coisa: guardar um valor velho que,
   quando usado, derruba o token bom. Foi exatamente o que aconteceu aqui.
   O código busca do banco primeiro — sem o fallback, nada muda no funcionamento.

2. **Avisar quando falhar.** Hoje, se o token cai, ninguém fica sabendo até alguém
   reparar que o financeiro parou de sincronizar. Um aviso na tela de integrações
   (ou um e-mail no erro do cron) resolve.

3. **Nunca testar autenticação com token de arquivo.** Qualquer diagnóstico deve
   usar `getAccessToken()` — o mesmo caminho do sistema. O script
   `scripts/diag-contaazul-fn2.ts` já foi corrigido para isso.

---

## Depois de reautorizar

```bash
npx tsx scripts/diag-contaazul-fn2.ts
```

Só leitura. Ele responde as três perguntas que ficaram abertas da FN2 (contrato
recorrente, contas a pagar, importação por IA) e imprime o status de cada
endereço testado. Com essa saída, a integração com o ContaAzul fica dimensionada.
