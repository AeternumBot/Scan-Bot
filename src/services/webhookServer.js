// src/services/webhookServer.js
// Servidor HTTP mínimo para recibir el webhook de Railway
// Railway → POST /webhook → Sua notifica en canal de registros
// ────────────────────────────────────────────────────────────────────────────

const http   = require('http');
const crypto = require('crypto');
const logger = require('../utils/logger');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const K = {
  feliz:   () => pick(['(◕‿◕✿)', '(ﾉ◕ヮ◕)ﾉ', '(*´▽`*)']),
  timida:  () => pick(['(〃>_<;〃)', '(/ω＼)', '(〃ω〃)']),
  triste:  () => pick(['(;ω;)', '(´；ω；`)', '(╥_╥)']),
  tranqui: () => pick(['(˘ω˘)', '(っ˘ω˘ς)', '(￣▽￣)']),
};

let _client = null;
let _server = null;

// ── Verificar firma HMAC de Railway (opcional pero recomendado) ───────────────

function verifySignature(body, signature) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // sin secret configurado, aceptar todo
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expected)
  );
}

// ── Parsear payload de Railway ────────────────────────────────────────────────
// Railway envía: { type, timestamp, project, environment, deployment, status }

function buildDeployMessage(payload) {
  const { status, deployment, project, environment } = payload;

  const commitMsg   = deployment?.meta?.commitMessage || 'Sin mensaje de commit';
  const commitHash  = deployment?.meta?.commitHash?.slice(0, 7) || '???????';
  const author      = deployment?.meta?.commitAuthor || 'Desconocido';
  const envName     = environment?.name || 'producción';
  const projectName = project?.name || 'Sua';

  if (status === 'SUCCESS' || status === 'COMPLETE') {
    return pick([
      `✅ ¡Deploy exitoso! **${projectName}** (${envName}) está al día ${K.feliz()}\n> \`${commitHash}\` ${commitMsg}\n> — ${author}`,
      `✅ Todo listo en **${projectName}** ${K.feliz()} El deploy de \`${commitHash}\` fue un éxito.\n> ${commitMsg} — ${author}`,
      `✅ ¡Está viva de nuevo! Deploy de **${projectName}** completado ${K.feliz()}\n> \`${commitHash}\` — ${commitMsg}`,
    ]);
  }

  if (status === 'FAILED' || status === 'CRASHED') {
    return pick([
      `❌ ¡El deploy de **${projectName}** falló! ${K.triste()} Commit: \`${commitHash}\` — ${commitMsg}\n> Por favor revisen los logs en Railway.`,
      `❌ A-ay... el deploy de **${projectName}** se cayó ${K.triste()}\n> \`${commitHash}\` — ${commitMsg}\n> Alguien tiene que revisar Railway...`,
      `❌ Deploy fallido en **${projectName}** ${K.triste()} \`${commitHash}\` — ${commitMsg}\n> Valk, creo que me rompiste algo... revisa los logs ${K.timida()}`,
    ]);
  }

  if (status === 'BUILDING' || status === 'DEPLOYING') {
    return `🔄 Deploy en progreso para **${projectName}**... \`${commitHash}\` — ${commitMsg} ${K.tranqui()}`;
  }

  return `ℹ️ Evento de deploy en **${projectName}**: \`${status}\` — \`${commitHash}\` ${commitMsg}`;
}

// ── Handler HTTP ──────────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Leer body
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    const rawBody  = Buffer.concat(chunks).toString();
    const signature = req.headers['x-railway-signature'] || req.headers['x-hub-signature-256'];

    if (!verifySignature(rawBody, signature)) {
      logger.warn('Webhook', 'Firma inválida — request rechazado');
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    res.writeHead(200);
    res.end('OK');

    try {
      const payload = JSON.parse(rawBody);
      logger.info('Webhook', `Deploy event: ${payload.status || payload.type}`);

      if (!_client) return;

      const channelId = process.env.RECORDS_CHANNEL_ID;
      if (!channelId) return;

      const canal = await _client.channels.fetch(channelId).catch(() => null);
      if (!canal) return;

      const mensaje = buildDeployMessage(payload);
      await canal.send(mensaje);

    } catch (err) {
      logger.error('Webhook', `Error procesando payload: ${err.message}`);
    }
  });
}

// ── Inicio ────────────────────────────────────────────────────────────────────

function start(client) {
  _client = client;
  const port = parseInt(process.env.WEBHOOK_PORT || '3000', 10);

  _server = http.createServer(handleRequest);
  _server.listen(port, () => {
    logger.info('Webhook', `✅ Servidor webhook escuchando en puerto ${port}`);
  });

  _server.on('error', err => {
    logger.error('Webhook', `Error en servidor webhook: ${err.message}`);
  });
}

function stop() {
  if (_server) _server.close();
}

module.exports = { start, stop };
