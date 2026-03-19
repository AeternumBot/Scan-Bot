// src/events/interactionCreate.js
const { Events } = require('discord.js');
const logger     = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // ── Botones ────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      // Botones de reclutamiento
      if (
        interaction.customId.startsWith('reclu_leido_') ||
        interaction.customId.startsWith('reclu_cancelar_') ||
        interaction.customId.startsWith('reclu_confirmar_cancelar_') ||
        interaction.customId.startsWith('reclu_no_cancelar_')
      ) {
        const suaAgent = require('./suaAgent');
        try {
          await suaAgent.handleReclutamientoButton(interaction);
        } catch (err) {
          logger.error('Button', `Error en botón de reclutamiento: ${err.message}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'A-ay... algo salió mal con ese botón (;ω;)', ephemeral: true }).catch(() => {});
          }
        }
        return;
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
