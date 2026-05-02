// src/events/messageCreate.js
// Escucha mensajes en canales de tickets y reclutamiento activos
const { Events } = require('discord.js');
const lumiAgent  = require('./lumiAgent');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    await lumiAgent.execute(message);
  },
};
