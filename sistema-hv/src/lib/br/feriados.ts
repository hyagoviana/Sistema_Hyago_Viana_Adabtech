// Feriados nacionais brasileiros — função pura, sem dependência externa.
//
// S1-02 / A3 (Thiago, 04/09): "pode carregar os feriados nacionais automaticamente,
// beleza." O motor de distribuição já pula sábado e domingo por regra de código;
// feriado depende de estar bloqueado no calendário, e cadastrar à mão todo ano é
// justamente o tipo de tarefa que o sistema deveria poupar.
//
// O que ESTE arquivo NÃO faz: feriado estadual/municipal e recesso do escritório.
// Esses continuam sendo cadastrados na tela do calendário — são decisão de quem
// administra, não regra federal.

/** Um feriado com a data em ISO (YYYY-MM-DD) e o nome, para o relatório. */
export type Feriado = { date: string; nome: string; movel: boolean };

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário gregoriano).
 * É a âncora dos feriados móveis: Carnaval, Sexta-feira Santa e Corpus Christi.
 */
export function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somaDias(base: Date, dias: number): string {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + dias);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Feriados nacionais do ano, ordenados por data.
 *
 * Inclui Carnaval e Corpus Christi: tecnicamente são ponto facultativo, mas o
 * fórum não funciona e o escritório não trabalha — tratá-los como dia útil faria
 * o motor distribuir tarefa para um dia em que ninguém vai executar. Quem quiser
 * o contrário remove o dia pela tela do calendário.
 */
export function feriadosNacionais(ano: number): Feriado[] {
  const pascoa = domingoDePascoa(ano);

  const lista: Feriado[] = [
    { date: iso(ano, 1, 1), nome: "Confraternização Universal", movel: false },
    { date: somaDias(pascoa, -48), nome: "Carnaval (segunda)", movel: true },
    { date: somaDias(pascoa, -47), nome: "Carnaval (terça)", movel: true },
    { date: somaDias(pascoa, -2), nome: "Sexta-feira Santa", movel: true },
    { date: iso(ano, 4, 21), nome: "Tiradentes", movel: false },
    { date: iso(ano, 5, 1), nome: "Dia do Trabalho", movel: false },
    { date: somaDias(pascoa, 60), nome: "Corpus Christi", movel: true },
    { date: iso(ano, 9, 7), nome: "Independência do Brasil", movel: false },
    { date: iso(ano, 10, 12), nome: "Nossa Senhora Aparecida", movel: false },
    { date: iso(ano, 11, 2), nome: "Finados", movel: false },
    { date: iso(ano, 11, 15), nome: "Proclamação da República", movel: false },
    // Feriado nacional desde a Lei 14.759/2023.
    { date: iso(ano, 11, 20), nome: "Consciência Negra", movel: false },
    { date: iso(ano, 12, 25), nome: "Natal", movel: false },
  ];

  return lista.sort((a, b) => a.date.localeCompare(b.date));
}

/** Feriados de um intervalo de anos (inclusive). */
export function feriadosNacionaisEntre(anoInicial: number, anoFinal: number): Feriado[] {
  const out: Feriado[] = [];
  for (let ano = anoInicial; ano <= anoFinal; ano++) out.push(...feriadosNacionais(ano));
  return out;
}
