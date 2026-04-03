// src/events/interactionCreate.js
const { Events } = require('discord.js');
const logger     = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // ── Botones ────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const suaAgent = require('./suaAgent');
      
      // Botones de inicio de flujos conversacionales
      if (interaction.customId === 'btn_crear_ticket') {
        try { return await suaAgent.startTicketButtonFlow(interaction); } 
        catch (err) { logger.error('Button', `Error ticket flow: ${err.message}`); }
      }
      
      if (interaction.customId === 'btn_crear_reclutamiento') {
        try { return await suaAgent.startReclutamientoButtonFlow(interaction); } 
        catch (err) { logger.error('Button', `Error reclu flow: ${err.message}`); }
      }

      // Botones de reclutamiento (staff)
      if (
        interaction.customId.startsWith('reclu_leido_') ||
        interaction.customId.startsWith('reclu_cancelar_') ||
        interaction.customId.startsWith('reclu_confirmar_') ||
        interaction.customId.startsWith('reclu_no_cancelar_') ||
        interaction.customId.startsWith('reclu_aceptar_') ||
        interaction.customId.startsWith('reclu_rechazar_') ||
        interaction.customId.startsWith('reclu_no_aceptar_') ||
        interaction.customId.startsWith('reclu_no_rechazar_')
      ) {
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
