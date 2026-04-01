// src/events/rawsListener.js
// Escucha mensajes con archivos .zip en el canal de raws configurado
// y delega el procesamiento a src/commands/raws.js.
//
// Este evento es independiente del agente (suaMention/suaAgent) — no necesita
// mención a Sua, solo que el archivo llegue al canal correcto con el formato correcto.

const { Events } = require('discord.js');
const { processRawsUpload } = require('../commands/raws');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    // Ignorar bots
    if (message.author.bot) return;

    // Solo procesar si hay adjuntos
    if (!message.attachments.size) return;

    // Solo actuar en el canal de raws configurado
    const rawsChannelId = process.env.RAWS_CHANNEL_ID;
    if (!rawsChannelId || message.channelId !== rawsChannelId) return;

    // Verificar que haya al menos un .zip
    const hasZip = message.attachments.some(a => a.name && a.name.toLowerCase().endsWith('.zip'));
    if (!hasZip) return;

    try {
      await processRawsUpload(message);
    } catch (err) {
      logger.error('RawsListener', `Error no capturado: ${err.message}`);
      await message.reply(`❌ Error interno procesando el archivo: ${err.message}`).catch(() => {});
    }
  },
};
