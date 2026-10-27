# KAIPIRA'S TECH — Lucro ML v1.4 (Capacitor 7)

Projeto **novo**, baseado no runtime oficial Capacitor. Nao reaproveita MainActivity.java dos APKs que falhavam.

## Funcionalidades preservadas da calculadora

- Pessoa Fisica (CPF) com reserva tributaria provisoria de 10% editavel.
- Botao Calcular e confirmacao antes de converter custos vazios para zero.
- Resultado de lucro, preco minimo, break-even, margem, impostos e detalhamento.
- Calculadora de ACOS/ROAS ideal e plano de Ads.
- Simulador Flex SP com regioes, peso, cubagem, motoboy e bonus estimado/manual.
- Carteira de produtos e armazenamento local no aparelho.
- Tela de importacao de links e selecao de imagens.

**Limitacoes:** importacao automatica de preco via link depende de API disponivel. OCR de textos de imagens nao esta implementado neste pacote Capacitor; selecao de imagem esta preservada. Backup/download por WebView deve ser testado no aparelho. A reserva de 10% para CPF nao e imposto fiscal confirmado. As tarifas precisam ser conferidas no Mercado Livre.

## Como gerar o APK sem Android Studio

1. Crie um repositorio privado novo no GitHub ou limpe o antigo antes de enviar os arquivos desta pasta, inclusive `.github/workflows/android-apk.yml`.
2. Envie o CONTEUDO desta pasta para a RAIZ do repositorio (nao envie o ZIP nem aninhe dentro de outra pasta).
3. Abra `Actions` e escolha `Gerar APK Capacitor - Lucro ML v1.4` (ou aguarde a execucao de push).
4. Quando estiver verde, abra a execucao e baixe `KAIPIRAS-TECH-LUCRO-ML-v1.4-CAPACITOR-APK` em Artifacts.
5. Extraia `app-debug.apk` e instale no Android. Recomenda-se remover o APK antigo apenas apos exportar backups, caso existam dados locais.

## Build local

Node 20+, Java 21, SDK Android 35 e ferramentas Gradle do projeto Capacitor.

```bash
npm install
npm test
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

## Status e precaucoes

- Testes matematicos: executados no ambiente de preparacao.
- HTML/CSS/JS: copiados da calculadora v1.4 reconstruida.
- APK: nao compilado neste ambiente (Android SDK/dependencias indisponiveis). A geracao e validacao precisam ser feitas pelo GitHub Actions.
- Instalacao no Poco X7 Pro: pendente de teste real.
