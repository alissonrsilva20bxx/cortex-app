# Checklist de smoke test — conta nova, beta fechado

Roteiro manual pra rodar antes de convidar cada novo grupo de amigos (ou
depois de qualquer merge que toque login/onboarding/PIN/dados). Usar sempre
uma conta real descartável, nunca dado fictício misturado com contas de
produção de verdade. Cada passo: o que fazer, o que esperar. Marcar
✅/❌ e anotar o achado se falhar.

## 1. Cadastro / login

- [ ] Abrir `/login` sem sessão — landing carrega, sem erro no console.
- [ ] Cadastrar por e-mail/senha (conta nova) — confirma e-mail se exigido,
      cai logada.
- [ ] Sair e logar de novo pelo mesmo e-mail/senha — entra sem erro.
- [ ] (Se aplicável) logar via Google com uma conta que nunca usou o app.

## 2. Onboarding

- [ ] Conta nova cai direto no onboarding (não pula pra home).
- [ ] Passo de meta: salvar uma meta real — onboarding **não** ejeta pra
      home no meio do fluxo (bug histórico, T17/#70 — confirmar que segue
      pro próximo passo).
- [ ] Passo de "job"/atendimento: preencher ou pular, sem travar.
- [ ] Passo "aha": completa normalmente.
- [ ] Onboarding termina e volta pra home normal.
- [ ] Recarregar a página logo depois — onboarding **não** reaparece
      (`jobapp-onboarding-done:<userId>` deve estar gravado).

## 3. Criação do PIN

- [ ] Ativar PIN em Ajustes → Segurança e PIN.
- [ ] Fechar a aba/PWA e reabrir (ou só recarregar) — cai na tela de PIN
      (`PinScreen`, contexto "app"), não direto no conteúdo.
- [ ] Digitar PIN errado — mensagem de erro, shake, não desbloqueia.
- [ ] Digitar PIN certo — desbloqueia direto pro app, **sem** aparecer
      nenhuma segunda tela de carregamento com a marca "JobApp" no meio
      (achado corrigido nesta rodada — confirmar que continua assim).

## 4. Criar atendimento

- [ ] FAB na aba Início ou Jobs → abre formulário de novo atendimento.
- [ ] Salvar com dados válidos — toast de sucesso, aparece na lista.

## 5. Agenda / Jobs

- [ ] Aba Jobs mostra o atendimento criado.
- [ ] Editar um atendimento — salva e atualiza a lista.

## 6. Financeiro

- [ ] Adicionar uma despesa e uma receita avulsa — datas usam o fuso local
      corretamente (bug de UTC já corrigido, `bc57f2d` — confirmar).
- [ ] Aba Financeiro reflete os valores.

## 7. Cofre

- [ ] Entrar na aba Cofre com PIN ativo — pede o PIN de novo, com o
      contexto "Cofre" (tela diferente da entrada do app, mesmo componente
      com rótulo/copy próprios).
- [ ] Enviar um arquivo — aparece na lista.
- [ ] Sair da aba Cofre e voltar — pede PIN de novo.

## 8. Rede

- [ ] Abrir a aba Rede — vitrine/gate aparece (beta fechado, ainda atrás de
      convite/código).
- [ ] (Se tiver convite/código de teste) resgatar e confirmar acesso ao
      feed.

## 9. Ajustes

- [ ] Abrir Ajustes — lista de grupos (Conta, Preferências, Aplicativo).
- [ ] Entrar em "Segurança e PIN" — navegação estilo WhatsApp (desliza pra
      a página interna, botão voltar funciona, botão **físico/gesto de
      voltar do navegador também fecha a página interna**, não sai do app).
- [ ] Exportar dados (CSV) — baixa sem erro.

## 10. Logout

- [ ] Sair da conta — volta pro `/login`, sem lixo de sessão anterior
      vazando (recarregar `/login` não reloga sozinho).
- [ ] Logar de novo com a mesma conta — não repete onboarding, não pede
      PIN a mais que o esperado.

---

**Achados devem virar issue/nota separada**, não ficar só marcados aqui.
Este checklist é pra rodar de novo a cada leva de convites — não é
descartável depois da primeira vez.
