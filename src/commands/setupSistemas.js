// src/commands/setupSistemas.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { COLORS } = require('../../config/config');

const data = new SlashCommandBuilder()
  .setName('setupsistemas')
  .setDescription('Crea el panel interactivo con botones (Solo Mods)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub.setName('tickets')
      .setDescription('Genera el panel de pedir ticket de errores')
  )
  .addSubcommand(sub =>
    sub.setName('reclutamiento')
      .setDescription('Genera el panel de postulación al equipo')
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'tickets') {
    const embed = new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle('🎫 Reportar un Error en un Capítulo')
      .setDescription(
        'Si encontraste algún error en nuestros capítulos (globos en blanco, tiras cortadas, mal organizadas u otros problemas), puedes *abrir un ticket* para que lo arreglemos.\n\n' +
        'Haz clic en el botón de abajo para que Sua te asista de forma privada en un canal exclusivo.'
      )
      .setThumbnail('https://i.imgur.com/example.png'); // Puedes cambiar esta imagen lgtm

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_crear_ticket')
        .setLabel('Pedir Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Panel de tickets creado con éxito en este canal.', ephemeral: true });
  }

  if (sub === 'reclutamiento') {
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📝 ¡Únete al equipo de Aeternum Translations!')
      .setDescription(
        '¿Quieres formar parte de nuestro scan y ayudarnos a traer más capítulos? Buscamos:\n' +
        '▸ Traductores\n' +
        '▸ Cleaners y Redibujadores\n' +
        '▸ Typesetters\n' +
        '▸ Control de Calidad (QC)\n\n' +
        '¡Enseñamos desde cero! Presiona el botón de abajo para abrir tu canal de postulación. Sua te hará un par de preguntas para conocerte.'
      )
      .setThumbnail('https://i.imgur.com/example2.png');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_crear_reclutamiento')
        .setLabel('Postularme')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Panel de reclutamiento creado con éxito en este canal.', ephemeral: true });
  }
}

module.exports = { data, execute };
