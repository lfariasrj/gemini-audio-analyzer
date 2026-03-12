/**
 * ============ CONFIG ============
 * Propriedades do Script: GEMINI_API_KEY, FOLDER_ID, OUTPUT_FOLDER_ID
 * SERVIÇO ATIVO: Drive API (v3)
 ================================= */

function getCfg() {
  const props = PropertiesService.getScriptProperties();
  return {
    FOLDER_ID: props.getProperty('FOLDER_ID') || '',
    OUTPUT_FOLDER_ID: props.getProperty('OUTPUT_FOLDER_ID') || '',
    GEMINI_KEY: props.getProperty('GEMINI_API_KEY') || '',
    GEMINI_MODEL: 'gemini-2.5-flash', 
    TIMEZONE: 'America/Sao_Paulo'
  };
}

function processarAudios() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(1000); 
  } catch (e) {
    Logger.log('⚠️ Já existe uma execução em andamento. Saindo para evitar conflitos.');
    return;
  }

  const CFG = getCfg();
  Logger.log('🚀 Iniciando script de processamento...');
  
  if (!CFG.GEMINI_KEY || !CFG.FOLDER_ID) {
    Logger.log('❌ ERRO: Verifique se GEMINI_API_KEY e FOLDER_ID estão configurados nas Propriedades do Script.');
    lock.releaseLock();
    return;
  }

  try {
    const folder = DriveApp.getFolderById(CFG.FOLDER_ID);
    const files = folder.getFiles();
    Logger.log(`📂 Pasta acessada: "${folder.getName()}"`);

    let totalArquivos = 0;
    while (files.hasNext()) {
      totalArquivos++;
      const file = files.next();
      const name = file.getName();
      const desc = file.getDescription() || '';
      const mime = file.getMimeType();

      Logger.log(`--- Verificando arquivo [${totalArquivos}]: ${name} ---`);

      // Verificação 1: Já processado?
      if (desc.includes('processado')) {
        Logger.log(`⏭️ Pulando: "${name}" já contém a marca 'processado' na descrição.`);
        continue;
      }

      // Verificação 2: É áudio?
      const isAudio = mime.startsWith('audio/') || /\.(m4a|mp3|wav|aac|ogg)$/i.test(name);
      if (!isAudio) {
        Logger.log(`🚫 Pulando: "${name}" não parece ser um arquivo de áudio suportado (Mime: ${mime}).`);
        continue;
      }

      Logger.log(`✅ Arquivo qualificado para processamento: ${name} (${(file.getSize() / 1024 / 1024).toFixed(2)} MB)`);
      
      // Início do Processamento Real
      const transcricaoCompleta = gerarTranscricaoDiarizada(file.getId(), name, mime, file.getSize());
      
      if (transcricaoCompleta && transcricaoCompleta.length > 10) {
        Logger.log(`📝 Transcrição obtida (${transcricaoCompleta.length} caracteres). Gerando resumo...`);
        
        const resumoFeedbackMd = gerarResumoFeedback(transcricaoCompleta);
        const docUrl = criarDocumentoEstruturado(name, resumoFeedbackMd, transcricaoCompleta);
        
        // Marca como processado
        file.setDescription((desc ? desc + ' | ' : '') + 'processado');
        Logger.log(`🎉 SUCESSO FINAL: Documento criado em: ${docUrl}`);
      } else {
        Logger.log(`⚠️ Aviso: A transcrição de "${name}" retornou vazia ou muito curta.`);
      }
    }

    if (totalArquivos === 0) {
      Logger.log('ℹ️ Nenhum arquivo foi encontrado na pasta especificada.');
    } else {
      Logger.log(`🏁 Fim da varredura. Total de arquivos analisados: ${totalArquivos}`);
    }

  } catch (err) {
    Logger.log(`❌ ERRO CRÍTICO na função principal: ${err.message}`);
    Logger.log(`Pilha do erro: ${err.stack}`);
  } finally {
    lock.releaseLock();
  }
}

function gerarTranscricaoDiarizada(fileId, filename, mimeType, fileSize) {
  const CFG = getCfg();
  const apiKey = CFG.GEMINI_KEY;
  const authToken = ScriptApp.getOAuthToken();
  
  Logger.log(`📤 Iniciando upload para o Gemini (v1beta)...`);

  const initRes = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: 'post',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ file: { displayName: filename } })
  });

  const uploadUrl = initRes.getHeaders()['X-Goog-Upload-URL'] || initRes.getHeaders()['x-goog-upload-url'];
  const chunkSize = 8 * 1024 * 1024; 
  let start = 0;
  let fileInfo = null;

  while (start < fileSize) {
    let end = Math.min(start + chunkSize, fileSize);
    const chunkData = UrlFetchApp.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + authToken, 'Range': `bytes=${start}-${end - 1}` }
    }).getContent();

    const res = UrlFetchApp.fetch(uploadUrl, {
      method: 'post',
      headers: {
        'X-Goog-Upload-Command': (end === fileSize) ? 'upload, finalize' : 'upload',
        'X-Goog-Upload-Offset': start.toString()
      },
      payload: chunkData,
      muteHttpExceptions: true
    });

    if (end === fileSize) fileInfo = JSON.parse(res.getContentText());
    start += (end - start);
    Logger.log(`   Progresso do Upload: ${((start / fileSize) * 100).toFixed(0)}%`);
  }

  const fileServerName = fileInfo.file.name;
  Logger.log(`⏳ Áudio enviado. Nome no servidor: ${fileServerName}. Aguardando processamento do Google...`);

  let status = "PROCESSING";
  let tentativas = 0;
  while (status === "PROCESSING" && tentativas < 60) {
    Utilities.sleep(10000);
    const check = JSON.parse(UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/${fileServerName}?key=${apiKey}`).getContentText());
    status = check.state;
    tentativas++;
    Logger.log(`   Status atual: ${status} (${tentativas * 10}s)`);
  }

  if (status !== "ACTIVE") throw new Error("O áudio não ficou pronto no tempo esperado ou falhou no Google.");

  Logger.log(`🎙️ Solicitando transcrição com identificação de vozes...`);
  const response = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CFG.GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: 'Transcreva este áudio integralmente em português do Brasil. Identifique os diferentes oradores (ex: Orador 1, Orador 2) sempre que a voz mudar. Formate como: "Orador X: [fala]".' },
          { fileData: { mimeType: mimeType, fileUri: fileInfo.file.uri } }
        ]
      }]
    })
  });

  // Limpeza
  try { UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/${fileServerName}?key=${apiKey}`, { method: 'delete' }); } catch(e) {}

  return JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;
}

function gerarResumoFeedback(transcricao) {
  const CFG = getCfg();
  Logger.log(`🧠 Inteligência Artificial analisando o conteúdo do feedback...`);
  
  const prompt = `
Analise a transcrição de uma reunião de 1-on-1 / Feedback abaixo.
Gere um resumo estruturado em Markdown com as seguintes seções:
# 📝 Resumo da Sessão
# 🎯 Pontos de Feedback (Positivos e Desenvolvimento)
# ✅ Acionáveis e Próximos Passos (Para GESTOR e LIDERADO)
# 🚀 Carreira e Expectativas
# 💡 Observações de Sentimento

TRANSCRIÇÃO:
${transcricao}
`;

  const res = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CFG.GEMINI_MODEL}:generateContent?key=${CFG.GEMINI_KEY}`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
  });

  return JSON.parse(res.getContentText()).candidates[0].content.parts[0].text;
}

function criarDocumentoEstruturado(originalName, resumoMd, transcricao) {
  const CFG = getCfg();
  const dateStr = Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy-MM-dd HH:mm');
  const doc = DocumentApp.create(`1on1 — ${originalName} (${dateStr})`);
  const body = doc.getBody();

  Logger.log(`📄 Criando Google Doc: ${doc.getName()}`);

  body.appendParagraph("INSIGHTS DA CONVERSA").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(resumoMd);
  body.appendPageBreak();
  body.appendParagraph("TRANSCRICÃO COMPLETA (DIARIZADA)").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(transcricao);

  doc.saveAndClose();

  if (CFG.OUTPUT_FOLDER_ID) {
    try {
      const file = DriveApp.getFileById(doc.getId());
      DriveApp.getFolderById(CFG.OUTPUT_FOLDER_ID).addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    } catch(e) {
      Logger.log("⚠️ Documento criado, mas houve erro ao mover para a pasta de saída.");
    }
  }
  return doc.getUrl();
}
