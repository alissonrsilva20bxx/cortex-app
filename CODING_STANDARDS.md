# CODING_STANDARDS.md

Só o que nenhuma checagem automática pega. O resto está no `package.json`, no lint e em `tests/wiring/`.

## Tela

- Faça cada ação existir uma vez só. Dois cards vizinhos não têm o mesmo botão.
- Todo botão faz alguma coisa. Se ainda não pode agir, deixe-o desabilitado e mostre o motivo na tela.
- A escolha visual é do capitão. Mostre prints das opções e espere a escolha antes de construir.
- Compare com a tela aprovada (GLOSSARY e protótipo) antes de entregar. Diferença da aprovada é bug.
- Escreva o texto da tela em constantes (`lib/jornada/textos.ts`), não solto no componente.

## Testes

- Conserte o código quando um teste falhar. Não afrouxe o teste para ele passar.
- Se o teste está errado de verdade, explique por quê no commit e mude só isso.
- Teste verde não prova uso real: diga o que ele não cobre.

## Commits

- Um assunto por commit. Rename, formatação e limpeza alheia vão em commit separado.
- Escreva a mensagem em português, dizendo o que mudou e por quê.
