# Desenha Aí! — versão online

- **TV:** abra `tv.html` (https://netocatto.github.io/desenha-ai/tv.html) — cria uma sala e mostra o QR code
- **Celulares:** leem o QR (ou abrem https://netocatto.github.io/desenha-ai/ e digitam o código da sala)

A TV roda as regras do jogo (`core.js`); o Firebase Realtime Database só leva as mensagens
entre a TV e os celulares (`online.js`). Configuração em `firebase-config.js`.
As palavras vêm do repositório `desenha-ai-palavras` (editadas pelo Terminal).
