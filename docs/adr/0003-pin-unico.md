# ADR 0003 — PIN único para desbloqueio global e rotas sensíveis

**Status:** Aceito

## Contexto

O app precisa de dois tipos de bloqueio: global (app inteiro ao abrir) e por rota (Jobs, Financeiro, Cofre). A alternativa considerada foi ter PINs separados — um para o app e outro para rotas sensíveis.

## Decisão

Um único PIN de 4 dígitos serve para ambos os fins: desbloqueio do app na abertura e acesso às Rotas Sensíveis. O PIN é configurado e alterado nos Ajustes. A sessão de PIN numa Rota Sensível expira em 5 minutos.

## Razões

- PINs separados aumentam a carga cognitiva sem ganho de segurança significativo para o modelo de ameaça deste app (acesso físico ao dispositivo por terceiro não autorizado).
- Um único PIN é mais simples de implementar e testar.
- O timeout de 5 minutos nas Rotas Sensíveis equilibra conveniência e proteção.
- O usuário pediu explicitamente a opção de configurar o PIN nos Ajustes — um PIN é mais fácil de gerenciar.

## Consequências

- Quem conhece o PIN do app pode entrar em todas as rotas sensíveis — aceitável dado que o modelo de ameaça é acesso físico por desconhecido, não por alguém que já conhece o PIN.
- Se o usuário esquecer o PIN, o único caminho de recuperação é via reset de dados (documentar claramente).
