// src/commands/setupLumi.js
const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder,
  ButtonStyle, PermissionFlagsBits
} = require('discord.js');
const { COLORS } = require('../../config/config');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const K = {
  altiva:  () => pick(['(￣^￣)', '( ¬ _ ¬ )', '(๑˘ ᵕ ˘)', '( -_ -)✧', '( ≖.≖)', '(¬‿¬)']),
  social:  () => pick(['(｡･ω･)ﾉﾞ', '( ´ ▽ ` )b', '(ㅅ´ ˘ `)', '(◡‿◡✿)', '(●´ω`●)']),
  sonrojo: () => pick(['(///￣ ￣///)', '(>///<)', '(〃////〃)', '(≧///≦)', '(#^.^#)']),
};

const data = new SlashCommandBuilder()
  .setName('setuplumi')
  .setDescription('Despliega los paneles interactivos de Lumi Nums')
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
    // ── Panel de reporte de errores ───────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle('🎫 Reporte de Errores')
      .setDescription(
        '¿Encontraste algo que no está bien en algún capítulo? Globos vacíos, páginas cortadas, texto mal colocado...\n\n' +
        'Los errores existen para ser corregidos. No los ignores.\n\n' +
        '**Presiona el botón** y abre un reporte. Te haré algunas preguntas para entender el problema correctamente. ' +
        'Si me das la información que necesito, el equipo puede actuar de inmediato.\n\n' +
        '*No es complicado. Solo requiere un mínimo de atención.*'
      )
      .setImage('https://files.catbox.moe/vq9tn6.gif')
      .setFooter({ text: 'Aeternum Translations — Reportes' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_ticket_iniciar')
        .setLabel('Reportar error')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({
      content: `Panel de tickets desplegado ${K.altiva()}`,
      ephemeral: true
    });
  }

  if (sub === 'reclutamiento') {
    // ── Panel de reclutamiento ─────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('✨ Únete al Equipo — Aeternum Translations')
      .setDescription(
        'Estamos buscando personas que se tomen su trabajo en serio. Si tienes habilidades y disposición para aprender, esto puede ser para ti.\n\n' +
        '**Roles disponibles:**\n' +
        '▸ **Typer** — Coloca el texto traducido en las páginas con precisión\n' +
        '▸ **Cleaner** — Limpieza, redibujado y preparación de páginas\n' +
        '▸ **Traductor** — Traducción desde inglés o coreano\n\n' +
        'No exigimos experiencia previa — pero sí exigimos compromiso.\n\n' +
        '**Presiona el botón** si estás dispuesto a ser parte de algo que vale la pena.'
      )
      .setImage('https://files.catbox.moe/d94w8i.gif')
      .setFooter({ text: 'Aeternum Translations — Reclutamiento' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_reclu_iniciar')
        .setLabel('Postularme')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({
      content: `Panel de reclutamiento desplegado ${K.social()}`,
      ephemeral: true
    });
  }
}

module.exports = { data, execute };
