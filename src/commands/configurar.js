// src/commands/configurar.js
// /configurar — panel de configuración del bot en Discord

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
} = require('discord.js');

const { Projects } = require('../utils/storage');
const { COLORS, REACTIONS } = require('../../config/config');
const monitor = require('../services/monitor');

const data = new SlashCommandBuilder()
  .setName('configurar')
  .setDescription('Panel de configuración del bot (solo admins)')
  .addSubcommand(sub =>
    sub.setName('canal')
      .setDescription('Cambia el canal de anuncios por defecto o de un proyecto específico')
      .addChannelOption(o =>
        o.setName('canal')
          .setDescription('Canal donde se publicarán los anuncios')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addStringOption(o =>
        o.setName('proyecto')
          .setDescription('Proyecto específico (vacío = canal global por defecto)')
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('reacciones')
      .setDescription('Configura las reacciones de un proyecto')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
      )
      .addStringOption(o =>
        o.setName('emojis')
          .setDescription('Emojis separados por espacio, ej: ❤️ 🔥 👏')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('rol')
      .setDescription('Asigna el rol de ping del servidor de LECTORES a un proyecto')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
      )
      .addStringOption(o =>
        o.setName('rol_id').setDescription('ID del rol en el servidor de lectores (clic derecho → Copiar ID)')
      )
  )
  .addSubcommand(sub =>
    sub.setName('verificar')
      .setDescription('Fuerza una verificación de nuevos capítulos ahora mismo')
  )
  .addSubcommand(sub =>
    sub.setName('avisos')
      .setDescription('Cambia el canal donde /avisar publica los avisos')
      .addChannelOption(o =>
        o.setName('canal')
          .setDescription('Canal de avisos')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('Muestra la configuración actual del bot')
  );

// ── Autocomplete ──────────────────────────────────────────────────────────────

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = Projects.list()
    .filter(p => p.name.toLowerCase().includes(focused) || p.id.includes(focused))
    .slice(0, 25)
    .map(p => ({ name: p.id, value: p.id }));
  await interaction.respond(choices);
}

// ── Execute ───────────────────────────────────────────────────────────────────

async function execute(interaction) {
  // Solo admins
  if (!interaction.member.permissions.has('ManageGuild')) {
    return interaction.reply({
      content: '❌ Necesitas el permiso **Gestionar Servidor** para usar `/configurar`.',
      ephemeral: true,
    });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'canal')      return handleCanal(interaction);
  if (sub === 'reacciones') return handleReacciones(interaction);
  if (sub === 'rol')        return handleRol(interaction);
  if (sub === 'verificar')  return handleVerificar(interaction);
  if (sub === 'avisos')     return handleAvisos(interaction);
  if (sub === 'info')       return handleInfo(interaction);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleCanal(interaction) {
  const canal     = interaction.options.getChannel('canal');
  const projectId = interaction.options.getString('proyecto');

  if (projectId) {
    // Canal específico para un proyecto
    const project = Projects.get(projectId);
    if (!project) {
      return interaction.reply({ content: `❌ Proyecto \`${projectId}\` no encontrado.`, ephemeral: true });
    }
    project.announcementChannel = canal.id;
    Projects.save(project);
    return interaction.reply({
      content: `✅ Canal de **${project.name}** actualizado a ${canal}.`,
      ephemeral: true,
    });
  }

  // Canal global
  process.env.ANNOUNCEMENT_CHANNEL_ID = canal.id;

  // Nota: para persistir entre reinicios hay que escribir en .env manualmente
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ Canal de anuncios actualizado')
    .setDescription(`Los anuncios se publicarán en ${canal}.\n\n⚠️ Para que este cambio persista al reiniciar el bot, actualiza \`ANNOUNCEMENT_CHANNEL_ID\` en tu archivo \`.env\`.`)
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleReacciones(interaction) {
  const projectId = interaction.options.getString('proyecto');
  const emojisRaw = interaction.options.getString('emojis');

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.reply({ content: `❌ Proyecto \`${projectId}\` no encontrado.`, ephemeral: true });
  }

  // Parsear emojis (estándar y custom <:nombre:id>)
  const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|<a?:\w+:\d+>)/gu;
  const emojis = emojisRaw.match(emojiRegex) || [];

  if (!emojis.length) {
    return interaction.reply({
      content: '❌ No se detectaron emojis válidos. Usa emojis estándar o emojis custom del servidor.',
      ephemeral: true,
    });
  }

  project.reactions = emojis;
  Projects.save(project);

  await interaction.reply({
    content: `✅ Reacciones de **${project.name}** actualizadas: ${emojis.join(' ')}`,
    ephemeral: true,
  });
}

async function handleRol(interaction) {
  const projectId = interaction.options.getString('proyecto');
  // El rol está en el servidor de LECTORES, no en el de staff.
  // Por eso se acepta el ID como string (no se puede hacer @mention cross-server).
  const rolId = interaction.options.getString('rol_id')?.trim() || null;

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.reply({ content: `❌ Proyecto \`${projectId}\` no encontrado.`, ephemeral: true });
  }

  // Validar que sea un ID numérico válido de Discord
  if (rolId && !/^\d{17,20}$/.test(rolId)) {
    return interaction.reply({
      content: '❌ El ID del rol no parece válido. Activa el Modo Desarrollador en Discord, luego clic derecho en el rol del servidor de lectores → **Copiar ID**.',
      ephemeral: true,
    });
  }

  project.readerRoleId = rolId;
  Projects.save(project);

  await interaction.reply({
    content: rolId
      ? `✅ Rol de ping de **${project.name}** actualizado.\n> ID: \`${rolId}\`\n> Se usará este rol al anunciar en el servidor de lectores.`
      : `✅ Rol de ping de **${project.name}** eliminado.`,
    ephemeral: true,
  });
}

async function handleVerificar(interaction) {
  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply('🔄 Iniciando verificación manual...');

  try {
    await monitor.forceCheck(interaction.client);
    await interaction.editReply('✅ Verificación completada. Revisa el canal de anuncios si hay novedades.');
  } catch (err) {
    await interaction.editReply(`❌ Error durante la verificación: ${err.message}`);
  }
}

async function handleAvisos(interaction) {
  const canal  = interaction.options.getChannel('canal');
  const esStaff = interaction.guildId === process.env.DISCORD_GUILD_ID;

  if (esStaff) {
    process.env.STAFF_NOTICE_ID = canal.id;
  } else {
    process.env.NOTICE_CHANNEL_ID = canal.id;
  }

  await interaction.reply({
    content: `✅ Canal de avisos actualizado a ${canal}.\n\n⚠️ Para que persista al reiniciar el bot, actualiza \`${esStaff ? 'STAFF_NOTICE_ID' : 'NOTICE_CHANNEL_ID'}\` en tu archivo \`.env\`.`,
    ephemeral: true,
  });
}

async function handleInfo(interaction) {
  const projects = Projects.list();
  const active   = projects.filter(p => p.active).length;
  const channel  = process.env.ANNOUNCEMENT_CHANNEL_ID
    ? `<#${process.env.ANNOUNCEMENT_CHANNEL_ID}>`
    : 'No configurado';

  const noticeStaff  = process.env.STAFF_NOTICE_ID
    ? `<#${process.env.STAFF_NOTICE_ID}>`
    : 'No configurado';
  const noticeReader = process.env.NOTICE_CHANNEL_ID
    ? `<#${process.env.NOTICE_CHANNEL_ID}>`
    : 'No configurado';

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('⚙️ Configuración del bot')
    .addFields(
      { name: '📢 Canal de anuncios',       value: channel,                                              inline: true },
      { name: '📋 Proyectos totales',        value: String(projects.length),                             inline: true },
      { name: '✅ Proyectos activos',        value: String(active),                                      inline: true },
      { name: '📣 Avisos (staff)',           value: noticeStaff,                                         inline: true },
      { name: '📣 Avisos (lectores)',        value: noticeReader,                                        inline: true },
      { name: '⏱️ Intervalo de check',       value: `Cada ${process.env.CHECK_INTERVAL_MINUTES || 25} minutos`, inline: true },
      { name: '🕐 Zona horaria',             value: process.env.TIMEZONE || 'America/Bogota',            inline: true },
      { name: '📦 Node.js',                  value: process.version,                                     inline: true },
    )
    .addFields({
      name: '🔧 Comandos disponibles',
      value:
        '`/proyecto add/remove/list/info/toggle/setstatus`\n' +
        '`/status [proyecto]`\n' +
        '`/configurar canal/reacciones/rol/avisos/verificar/info`\n' +
        '`/buscar <nombre> <fuente>`\n' +
        '`/anunciar <proyecto>`',
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { data, execute, autocomplete };
