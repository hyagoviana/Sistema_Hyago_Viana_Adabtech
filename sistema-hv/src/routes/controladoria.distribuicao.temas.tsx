// APOSENTADA (T2 — reunião 2026-08-26).
//
// Havia duas configurações de tema: esta, do motor, e a de Configurações (aba
// "Distribuição" dentro do próprio tema). O Thiago viu as duas na tela: "eu só
// vou tirar essa parte de tema então, dentro de distribuição, que como a gente
// vai espelhar lá do outro tema, não precisa ter aqui."
//
// Conferido antes de aposentar: o `TemaDistribuicaoPanel` (Configurações →
// Campos personalizados → tema → aba Distribuição) já edita os mesmos campos
// (multiplicador, nível temporal, executor exclusivo do tema).
//
// A rota continua existindo e REDIRECIONA — quem tem o link salvo continua
// chegando em algum lugar útil.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/controladoria/distribuicao/temas")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes/campos-personalizados" });
  },
});
