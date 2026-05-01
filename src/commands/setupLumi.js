// src/commands/setupLumi.js
const { 
  SlashCommandBuilder, EmbedBuilder, 
  ActionRowBuilder, ButtonBuilder, 
  ButtonStyle, PermissionFlagsBits 
} = require('discord.js');
const { COLORS } = require('../../config/config');

const data = new SlashCommandBuilder()
  .setName('setuplumi')
  .setDescription('Despliega los paneles interactivos de Lumi')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub.setName('tickets')
      .setDescription('Panel de reporte de errores para lectores')
  )
  .addSubcommand(sub =>
    sub.setName('reclutamiento')
      .setDescription('Panel de postulación al equipo para lectores')
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'tickets') {
    const embed = new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle('🎫 ¡A-ayuda! Reportar un Error')
      .setDescription(
        'E-esto... hola... (〃>_<;〃) Si encontraste algún problemita en los capítulos, como globos vacíos o páginas que se ven cortadas, ¡por favor avísame!\n\n' +
        'No quiero que nadie tenga una mala experiencia leyendo... (´；ω；`) Así que si presionas el botón de abajo, voy a crear un canal privado para que me cuentes qué pasó y lo arreglemos juntitos (◕‿◕✿)'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_ticket_iniciar')
        .setLabel('Reportar error')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ 
      content: 'L-listo... panel de tickets desplegado... (*ノωノ)', 
      ephemeral: true 
    });
  }

  if (sub === 'reclutamiento') {
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📝 Únete al equipo de Aeternum Translations')
      .setDescription(
        'E-eh... ¿Te gustaría formar parte de nuestro equipo? (//>/<//) Estamos buscando personas amables para ayudarnos:\n\n' +
        '▸ **Typer** — pone el texto bonito en las páginas\n' +
        '▸ **Cleaner** — limpia y redibuja las cositas que estorban\n' +
        '▸ **Traductor** — traduce desde inglés o coreano para que todos entendamos\n\n' +
        '¡N-no necesitas experiencia previa! Solo muchas ganas de aprender (っ˘ω˘ς) Presiona el botón y te haré algunas preguntitas rápidas...'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_reclu_iniciar')
        .setLabel('Postularme')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ 
      content: '¡Y-ya puse el panel de reclutamiento! Espero que se una mucha gente linda... (✿◠‿◠)', 
      ephemeral: true 
    });
  }
}

module.exports = { data, execute };
