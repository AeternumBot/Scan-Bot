// src/events/ready.js
const { Events } = require('discord.js');
const monitor    = require('../services/monitor');
const scheduler  = require('../services/scheduler');
const webhook    = require('../services/webhookServer');
const logger     = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    logger.success('Bot', `Conectado como ${client.user.tag}`);
    logger.info('Bot', `Sirviendo en ${client.guilds.cache.size} servidor(es)`);

    // ── Actividad del bot — rota cada 3 minutos ───────────────────────────────
    const estados = [
      { name: 'los capítulos nuevos (◕‿◕✿)',      type: 3 },
      { name: 'manga en secreto... (/ω＼)',         type: 3 },
      { name: 'con el equipo de Aeternum',          type: 2 },
      { name: 'al monitor de scans (っ˘ω˘ς)',       type: 3 },
      { name: 'organizando carpetas~ (〃>_<;〃)',    type: 3 },
      { name: 'si me mencionan... (´• ω •`)',       type: 3 },
      { name: 'los anuncios con cariño (｡>﹏<)',    type: 3 },
      { name: 'capítulos nuevos llegar (//>/<//)',  type: 3 },
    ];
    let estadoIdx = 0;
    const setEstado = () => {
      const e = estados[estadoIdx % estados.length];
      client.user.setPresence({ activities: [e], status: 'online' });
      estadoIdx++;
    };
    setEstado();
    setInterval(setEstado, 3 * 60 * 1000);

    // ── Servicios ─────────────────────────────────────────────────────────────
    monitor.start(client);
    scheduler.start(client);

    // Webhook server solo si está configurado el puerto
    if (process.env.WEBHOOK_PORT) {
      webhook.start(client);
    }

    await logger.discord(client, 'success', 'Bot', `Bot iniciado correctamente: \`${client.user.tag}\``);
  },
};
