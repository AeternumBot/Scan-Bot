// src/events/interactionCreate.js
const { Events } = require('discord.js');
const logger     = require('../utils/logger');

// ── Constantes y utilidades para los botones ─────────────────────────────────
const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1368818622750789633';

const ROLES_RECLU = { traductor: 'Traductor', cleaner: 'Cleaner / Redibujador', typesetter: 'Typer' };

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const K = {
  feliz:    () => pick(['(◕‿◕✿)','(ﾉ◕ヮ◕)ﾉ','(✿◠‿◠)','(*´▽`*)','(ﾉ´ヮ`)ﾉ*: ･ﾟ']),
  timida:   () => pick(['(〃>_<;〃)','(//>/<//)', '(〃ω〃)','(*ノωノ)','(//∇//)']),
  triste:   () => pick(['(;ω;)','(´；ω；`)','( ´•̥̥̥ω•̥̥̥` )','(╥_╥)']),
  tranqui:  () => pick(['(˘ω˘)','(っ˘ω˘ς)','( ´ ▽ ` )','(。◕‿◕。)','(￣▽￣)']),
};



// ────────────────────────────────────────────────────────────────────────────

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // ── Botones ────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const lumiAgent = require('./lumiAgent');

      // Paneles de lectores
      if (interaction.customId === 'btn_ticket_iniciar') {
        return lumiAgent.iniciarTicket(interaction);
      }
      if (interaction.customId === 'btn_reclu_iniciar') {
        return lumiAgent.iniciarReclutamiento(interaction);
      }

      // Botones de staff (ticket y reclutamiento)
      if (
        interaction.customId.startsWith('ticket_') ||
        interaction.customId.startsWith('reclu_')
      ) {
        return lumiAgent.handleStaffButton(interaction);
      }
    }

    // ── Slash commands ─────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error('Interaction', `Error en /${interaction.commandName}: ${err.message}`);
        const msg = { content: 'A-ay... algo salió mal al ejecutar ese comando (;ω;) ¿Podrías intentarlo de nuevo?', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
    }

    // ── Autocomplete ───────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        logger.error('Autocomplete', `Error en /${interaction.commandName}: ${err.message}`);
      }
    }
  },
};
