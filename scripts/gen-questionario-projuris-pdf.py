# -*- coding: utf-8 -*-
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT

NAVY = colors.HexColor("#1E2044")
GOLD = colors.HexColor("#C9A227")
LIGHT = colors.HexColor("#F5F1E6")
GREY = colors.HexColor("#8A8266")

styles = getSampleStyleSheet()
h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=NAVY, fontName="Helvetica-Bold", fontSize=17, spaceAfter=2)
sub = ParagraphStyle("sub", parent=styles["Normal"], textColor=GREY, fontSize=9.5, spaceAfter=10)
block = ParagraphStyle("block", parent=styles["Heading2"], textColor=colors.white, backColor=NAVY,
                       fontName="Helvetica-Bold", fontSize=11, leftIndent=6, spaceBefore=12, spaceAfter=6,
                       leading=20, borderPadding=(4, 4, 4, 4))
q = ParagraphStyle("q", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, textColor=NAVY, spaceBefore=6, spaceAfter=1, leading=13)
a = ParagraphStyle("a", parent=styles["Normal"], fontName="Helvetica", fontSize=10, textColor=colors.HexColor("#333333"), leftIndent=10, spaceAfter=4, leading=13)
li = ParagraphStyle("li", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leftIndent=12, spaceAfter=4, leading=13, bulletIndent=2)

out = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "reunioes", "Questionario-ProJuris-Preenchido.pdf"))
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm,
                        title="Questionário ProJuris — preenchido", author="Sistema HV")
S = []

S.append(Paragraph("Questionário do Motor de Distribuição (ProJuris)", h1))
S.append(Paragraph("Reunião com Dr. Thiago Correia — 07/08/2026 · Respostas registradas + o que ainda falta", sub))

def QA(pergunta, resposta):
    S.append(Paragraph("P: " + pergunta, q))
    S.append(Paragraph("R: " + resposta, a))

# Bloco A
S.append(Paragraph("Bloco A — Executores (quem entra na distribuição)", block))
QA("Quais usuários entram no rodízio de distribuição?",
   "Os <b>Sêniores</b> (o Hyago vai mandar os nomes). A distribuição vai para o time (sênior+júnior+estagiário aparecem na agenda), mas quem <b>distribui</b> é o sênior. <b>Ação:</b> criar campo de nível (Estagiário/Júnior/Sênior) no cadastro, preenchido ao convidar.")
QA("Qual o peso de cada um? Pode pegar caso complexo?",
   "Todo mundo começa <b>peso 100</b> (distribui igual). Criar mecanismo para <b>reduzir</b> o peso quando a pessoa está saindo (recebe menos) e aumentar quando entra. O motor usa sempre o peso <b>atual na data</b>.")
QA("A Patrícia (TEMFC) é a 'Ana Patrícia Cruz' do ProJuris?", "Sim, é a mesma pessoa.")
QA("Confirma Thiago = 128858 e Thaíse = 204546?", "Sim, confirmado.")

# Bloco B
S.append(Paragraph("Bloco B — Responsável exclusivo (exceções)", block))
QA("As exceções são: Audiência→Thiago; Sustentação Oral→Thiago; INDENIZAÇÃO PMMB→Thaíse; TEMFC→Patrícia. Falta alguma?",
   "Está correto, perfeito. Fica na configuração da tarefa (campo 'pessoa obrigatória').")

# Bloco C
S.append(Paragraph("Bloco C — Tipos de tarefa e prazos", block))
QA("'Diligências/Balcão' — no ProJuris tem 3 parecidos, qual usar?",
   "O Thiago vai <b>apagar os 2 duplicados no ProJuris</b> e deixar só 1 — usamos esse.")
QA("'Emenda' é 'Emenda à Inicial'?", "Sim, é a mesma coisa.")
QA("'Manifestação' tem 5, 10 e 15 dias — qual usar?", "Fazer <b>uma lógica para cada</b> prazo.")
QA("'Réplica' é 'Réplica à Contestação'?", "Sim.")
QA("14 tipos existem no ProJuris mas não têm pontos — pontuar ou ignorar?",
   "Vai mandar o retorno (amanhã) com <b>quais ficam e quais saem</b> (ex.: 'Lembrete' sai) e a <b>pontuação</b>. Por ora: refletir no sistema e na lista com a <b>menor pontuação</b> como placeholder.")
QA("Prazo previsto e fatal (dias) de cada tipo?",
   "O motor <b>puxa do ProJuris</b> (cada tarefa tem lá); quando muda no ProJuris, reflete no sistema. Manter também registro interno.")

# Bloco D
S.append(Paragraph("Bloco D — Onde fica a complexidade (o ponto crítico)", block))
QA("Complexo / individual / coletivo / prioritário — é marcador ou campo personalizado?",
   "Hoje são <b>marcadores</b>. V1: o motor puxa de marcador (fallback: sem info = individual/não-complexo). Depois migram para campo personalizado e a gente só troca a fonte. <b>Urgente/prioritário NÃO existe no ProJuris</b> — precisamos <b>adicionar um campo no nosso sistema</b>.")

# Bloco E
S.append(Paragraph("Bloco E — Envio real (write-back)", block))
QA("Posso usar 1 caso de teste? Confirma o endpoint de responsável?",
   "Usar o caso <b>0733583-07.2026.8.07.0016</b> — identificador <b>PRO.0007713</b> (caso pessoal do Thiago, pode gerar/apagar à vontade).")
QA("A API deixa criar tipo de tarefa por fora, ou cria no ProJuris primeiro?",
   "V1: <b>criar no ProJuris primeiro</b> e o sync espelha no sistema. Futuro: criar no sistema e espelhar no ProJuris (quando a agenda estiver 100%).")

# O que falta
S.append(Paragraph("O QUE AINDA FALTA O THIAGO MANDAR", block))
faltas = [
    "<b>Lista de colaboradores</b> (planilha enviada em anexo): nome, cargo (estagiário/júnior/sênior), time, <b>ID ProJuris</b>, e-mail, participa da distribuição, peso e permissões.",
    "<b>Os 14 tipos</b>: quais ficam e quais saem + a pontuação de cada um que ficar.",
    "<b>Ajuste no ProJuris</b>: apagar os 'Diligência/Balcão' duplicados (deixar 1) e conferir os prazos (previsto/fatal) dos tipos.",
    "<b>Print do Trello</b>: o visual da linha do tempo/comentários que ele quer replicar.",
    "<b>Login/senha admin do Trello</b> (para a importação dos comentários — fase seguinte).",
]
for f in faltas:
    S.append(Paragraph("• " + f, li))

doc.build(S)
print("OK:", out)
