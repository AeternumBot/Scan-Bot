// src/events/interactionCreate.js
const { Events } = require('discord.js');
const logger     = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
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
