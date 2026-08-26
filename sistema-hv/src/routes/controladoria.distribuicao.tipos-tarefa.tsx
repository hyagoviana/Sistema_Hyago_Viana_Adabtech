// APOSENTADA (T1 — reunião 2026-08-26).
//
// Havia DUAS telas de tipo de tarefa: esta, do motor, e a de Configurações. O
// Thiago viu as duas na tela e pediu uma só: "eu tô configurando tipo de tarefa,
// como que isso é interpretado lá no motor… jogar para um só". O owner escolheu
// a de Configurações, que é o catálogo do sistema (doc 21.08) e já fazia tudo o
// que esta fazia — inclusive sincronizar e criar tipo no ProJuris.
//
// Antes de aposentar, os campos foram conferidos um a um. Os dois que existiam
// só aqui — COMPLEXIDADE e TEMPORALIDADE (os multiplicadores de pontuação) —
// foram levados para lá; o resto já estava coberto.
//
// A rota continua existindo e REDIRECIONA: o time tem link salvo e vai clicar
// nele. Redirecionar é mais barato que explicar um 404.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/controladoria/distribuicao/tipos-tarefa")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes/tipos-tarefa" });
  },
});
