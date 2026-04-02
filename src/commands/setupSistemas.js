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
      .setTitle('🎫 ¡A-ayuda! Reportar un Error')
      .setDescription(
        'E-esto... hola. (〃>_<;〃) Si encontraste algún problemita en los capítulos, como globos vacíos o páginas que se ven cortadas, ¡por favor avísame!\n\n' +
        'No quiero que nadie tenga una mala experiencia leyendo... (´；ω；`) Así que si presionas el botón de abajo, Sua te creará un canal privado para que me cuentes qué pasó y lo arreglemos juntitos. (◕‿◕✿)'
      )
      .setImage('https://media.tenor.com/DhZaHLNdMGAAAAAC/tenor.gif');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_crear_ticket')
        .setLabel('Pedir Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary)
    );

    // Mención a everyone y envío del panel
    await interaction.channel.send({ 
      content: '@everyone — 📢 ¡Sua al reporte! (〃ω〃)', 
      embeds: [embed], 
      components: [row] 
    });
    return interaction.reply({ content: '✅ Panel de tickets creado con éxito en este canal con mucha personalidad. (〃ω〃)', ephemeral: true });
  }

  if (sub === 'reclutamiento') {
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📝 ¡Sua busca nuevos amigos para el equipo!')
      .setDescription(
        '¡H-hola! (´ ∀ ` *) ¿Te gustaría ayudarnos en Aeternum Translations? ¡Me haría muchísima ilusión trabajar contigo! (〃ω〃)\n\n' +
        'Buscamos personitas con ganas de aprender para ser:\n' +
        '▸ **Traductores** (¡los que pasan el texto!)\n' +
        '▸ **Cleaners / Redibujadores** (¡los que limpian las páginas!)\n' +
        '▸ **Typer** (¡los que ponen las letras bonitas!)\n\n' +
        '¡N-no tengas miedo si no sabes nada! (〃>_<;〃) Aquí te enseñaremos con mucho cariño desde cero. ¡Dale al botón y hablemos! (◕‿◕✿)'
      )
      .setImage('https://media.tenor.com/fAS0_kCyse8AAAAC/tenor.gif');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_crear_reclutamiento')
        .setLabel('Postularme')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ 
      content: '@everyone — 🌸 ¡Únete a nuestra familia! (〃ω〃)', 
      embeds: [embed], 
      components: [row] 
    });
    return interaction.reply({ content: '✅ Panel de reclutamiento creado con éxito en este canal con mucha personalidad. (〃ω〃)', ephemeral: true });
  }
}

module.exports = { data, execute };
