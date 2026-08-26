# Texto para mandar ao Thiago

> Copiar daqui para baixo.

---

Thiago, bom dia!

Terminei os ajustes que a gente conversou na reunião. Fiz tudo o que estava na sua lista, mais as coisas que apareceram durante a conversa. Vou te contar o que mudou, por partes, para você saber o que esperar quando abrir.

**Na controladoria**, a fila da manhã foi a maior mudança. Ela agora separa o que é intimação do que é andamento, com uma etiqueta colorida em cada linha, e abre mostrando só as intimações — os andamentos continuam sendo puxados normalmente, mas ficam escondidos atrás de um seletor, do jeito que você pediu. O botão de marcar como lido só aparece nos andamentos; na intimação ele sumiu, porque o ProJuris não aceita esse status ali, como você mesmo viu na hora. O histórico ganhou busca pelo número do processo, e você pode digitar com ponto e traço ou só os números, tanto faz. O quadro agora tem barra para rolar para o lado, e a lista de andamentos ficou com a mesma cara do resto do sistema, aquele fundo bege com os cartões brancos.

**As tarefas** passaram a usar os mesmos status do ProJuris: em andamento, concluída com sucesso, concluída sem sucesso e cancelada. O "pendente" saiu, porque a gente concluiu que tarefa distribuída já é trabalho em andamento e os dois nomes queriam dizer a mesma coisa. Na agenda do dia você agora vê a situação real de cada tarefa, puxada de lá, e consegue filtrar por situação e por responsável.

**O tipo de tarefa** virou uma configuração só. Ficou a que está em Configurações, e a antiga, dentro da Distribuição, leva você para lá — quem tiver o link salvo continua chegando no lugar certo. Antes de aposentar a antiga eu conferi campo por campo e levei junto a complexidade e a temporalidade, que só existiam nela. E em todo lugar onde se escolhe um tipo de tarefa — criando tarefa no caso, montando workflow ou distribuindo — agora você escolhe primeiro a classe e a lista já vem limpa, como você desenhou.

**Nos workflows**, cada um ganhou um código, tipo WF-0001. Quando o workflow gera uma tarefa ou um comentário, esse código aparece junto, então dá para descobrir na hora qual deles fez aquilo — que era exatamente o problema que você levantou, de aparecer tarefa errada para todo mundo e ninguém saber de onde veio. Também dá para editar um workflow existente, coisa que antes não existia (só criava e excluía), agrupar por um nome livre e filtrar por nome, tema ou situação. O "desativar" virou "suspender", para ficar claro que dá para voltar atrás.

**Na ficha do caso**, o nome do tema lá em cima agora é clicável e te devolve para o quadro daquele tema, em vez de jogar você na primeira página. A linha do tempo passou a falar português: em vez daquele código, aparece "mudou de etapa: entrar em contato → dado judicial". E as alterações de campo saíram da linha do tempo e foram para um menu novo de auditoria, que mostra quem mexeu, quando e o que era antes e o que virou. Essa auditoria está no menu principal e também dentro do próprio caso, para você não precisar sair procurando.

**No Drive**, todo caso passou a ter uma subpasta chamada "Documentos automáticos". Tudo o que o sistema gera cai lá dentro: procuração, contrato, documento do caso e o arquivo assinado que volta do ZapSign. O que a pessoa anexa à mão continua na pasta do caso, exatamente como você pediu. Os documentos que já existiam foram movidos para o lugar novo, e os links antigos continuam funcionando.

**Os campos personalizados do cliente** ficaram no mesmo nível dos campos do caso. Agora aceitam link, valor em reais, várias linhas com um rótulo em cada uma, campo que só libera depois que o outro é preenchido e a opção de esconder da lista. Criei também aquele campo vinculado que você pediu: quando você marca que dois campos são vinculados, eles passam a aparecer sempre juntos — é o caso dos dois links que você comentou. E agora dá para arrastar os campos para mudar a ordem, tanto nos do cliente quanto nos do caso.

**A tela de configurações** ficou dividida entre "meu perfil" e "sistema", como você sugeriu.

**Sobre o financeiro**, já comecei e a primeira parte está pronta. Dentro do caso existe agora um espaço para registrar as receitas e as despesas, com os tipos e as categorias que você mandou no documento, incluindo aquela divisão entre fiscal e gerencial. Cada registro nasce como "aguardando" e você decide se ele vai para o Conta Azul ou se fica só aqui — que era justamente o ponto que você levantou, de ter valores que dependem de uma coisa futura e que a gente precisa enxergar mesmo antes de lançar. Também dá para dispensar um registro quando aquela hipótese não se confirma.

Nas receitas parceladas, ao informar o número de parcelas o sistema já mostra todas elas antes de salvar, e você pode mudar o vencimento ou o valor de qualquer uma — o "revisar parcelas" do seu desenho. Na despesa, quando você escolhe uma categoria reembolsável, aparece a chave de reembolso e, ao salvar, o sistema cria sozinho a receita correspondente já em aguardando. A descrição da despesa sai no formato que você definiu, com o tipo, o tema e o nome do cliente. E tem um painel em cima mostrando, por tipo, quanto é devido, quanto está vencido, quanto já entrou e quanto ainda vai vencer, com o detalhamento parcela por parcela quando você abre.

Na configuração de cada tema entrou uma aba de financeiro, onde a gente amarra o centro de custo e o serviço do Conta Azul àquele tema, como no seu último desenho. Assim tudo que for registrado num caso daquele tema já sai classificado.

**O que falta no financeiro** é a conversa com o Conta Azul de verdade — hoje o botão de lançar registra a decisão aqui, mas ainda não cria o registro lá. É o próximo passo. E aqui preciso de duas coisas suas:

A primeira é que o acesso do sistema ao Conta Azul venceu e precisa ser autorizado de novo. Sem isso eu não consigo nem testar. Quando você puder fazer isso, me avisa que eu sigo.

A segunda é uma boa notícia possível. Você descreveu no documento aquele processo trabalhoso de criar a venda recorrente e ficar forçando o sistema a gerar mais 24 parcelas por vez. Olhando por dentro, tudo indica que essa limitação é da tela do Conta Azul, e não do caminho que o sistema usa para conversar com ele — pelo que vi, dá para mandar as 72 parcelas de uma vez só. Se confirmar, a gente elimina a parte mais chata daquele procedimento. Mas só vou poder afirmar depois de testar, e para testar preciso do acesso renovado.

Ah, e sobre o ProJuris: achei o código de "pendente" e o de "concluída com sucesso", mas não achei o de "concluída sem sucesso" na documentação. Por enquanto, quando alguém marca assim, a tarefa fecha lá como concluída e o detalhe fica registrado aqui no nosso sistema. Se você souber onde encontrar esse código, me passa que eu ajusto.

Sobre o Trello, como a gente combinou, deixei para um segundo momento.

Estou terminando de revisar tudo e te aviso assim que subir, para vocês testarem com calma. Qualquer coisa me chama.

Abraço!
