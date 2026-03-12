# 🎙️ Gemini Audio Analyzer - 1-on-1 & Feedback Edition

Este projeto utiliza a API do Google Gemini para automatizar a transcrição e análise de reuniões de 1-on-1 e sessões de feedback. O script monitora uma pasta no Google Drive, processa arquivos de áudio e gera documentos estruturados com insights executivos e transcrição diarizada.

## ✨ Diferenciais desta Solução
- **Bypass de Limites:** Algoritmo de fatiamento (chunks) que contorna o limite de 50MB do Google Apps Script, suportando arquivos de áudio grandes.
- **Diarização de Oradores:** Identifica automaticamente a troca de vozes (Orador 1, Orador 2, etc.).
- **Foco em Gestão:** Prompt especializado para extrair pontos positivos, oportunidades de desenvolvimento e acionáveis para gestor e liderado.
- **Logs Detalhados:** Sistema de log para monitoramento em tempo real do progresso de upload e processamento.

---

## 🚀 Guia de Configuração Passo a Passo

### 1. Preparação no Google Drive
1. Crie uma pasta para carregar seus áudios (ex: `01_Entrada_Audios`).
2. Crie uma pasta para os documentos gerados (ex: `02_Resumos_Docs`).
3. Copie o **ID** de cada pasta (o código alfanumérico que aparece na URL após `/folders/`).

### 2. Obtenção da API Key
1. Acesse o [Google AI Studio](https://aistudio.google.com/).
2. Clique em **"Get API key"** e gere uma nova chave (API Key).

### 3. Configuração do Script
1. Acesse o [Google Apps Script](https://script.google.com/).
2. Crie um **Novo Projeto**.
3. Apague o código padrão e cole o conteúdo do arquivo `code.gs` deste repositório.
4. Clique no ícone de engrenagem (**Configurações do Projeto**) no menu lateral.
5. Em **Propriedades do script**, adicione as seguintes chaves:
   - `GEMINI_API_KEY`: Cole sua chave gerada no AI Studio.
   - `FOLDER_ID`: Cole o ID da pasta de entrada dos áudios.
   - `OUTPUT_FOLDER_ID`: Cole o ID da pasta de saída dos documentos.

### 4. Ativação de Serviços
1. No editor do script, clique no botão **+** ao lado de **Serviços** na barra lateral esquerda.
2. Procure por **Drive API**.
3. Selecione a versão **v3** e clique em **Adicionar**.

---

## 🛠️ Como Executar

### Execução Inicial (Autorização)
1. No editor, selecione a função `processarAudios` no menu superior.
2. Clique em **Executar**.
3. O Google exibirá um aviso de "Permissões necessárias". Clique em **Revisar permissões**.
4. Selecione sua conta e, se aparecer o aviso de "App não verificado", clique em **Avançado** e depois em **Acessar [Nome do Projeto] (inseguro)** para conceder o acesso.

### Automação (Trigger)
Para que o script funcione sozinho sempre que você subir um arquivo:
1. No menu lateral esquerdo, clique no ícone de relógio (**Gatilhos**).
2. Clique no botão **+ Adicionar Gatilho** no canto inferior direito.
3. Configure:
   - Função: `processarAudios`.
   - Fonte do evento: **Baseado no tempo**.
   - Tipo de gatilho: **Temporizador de minutos**.
   - Intervalo: **A cada 15 minutos** (ou conforme sua necessidade).

---

## 📝 Notas de Uso
- **Marcação de Processado:** O script adiciona a palavra `| processado` na descrição do arquivo original para evitar duplicidade.
- **Reprocessar:** Se desejar gerar o resumo novamente para um áudio, limpe o campo "Descrição" do arquivo no Google Drive.
- **Cotas:** O limite de Tokens por Minuto (TPM) da versão gratuita da API pode afetar arquivos muito longos. O script possui logs para avisar caso a cota seja atingida.

---

## 🛠️ Tecnologias Utilizadas
- **Google Apps Script**
- **Google Gemini API** (`gemini-2.5-flash` ou superior)
- **Google Drive API v3**
