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
    sub.setName('tareas')
      .setDescription('Configura el canal de tareas y alertas de estancamiento')
      .addChannelOption(o =>
        o.setName('canal')
          .setDescription('Canal donde Sua publicará recordatorios de tareas y alertas')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('registros')
      .setDescription('Configura el canal de registros generales de Sua')
      .addChannelOption(o =>
        o.setName('canal')
          .setDescription('Canal para deploys, tickets, postulaciones y ausencias vencidas')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('ausencias')
      .setDescription('Configura el canal de registro de ausencias activas')
      .addChannelOption(o =>
        o.setName('canal')
          .setDescription('Canal donde Sua muestra las ausencias activas del staff')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('tickets')
      .setDescription('Configura el canal de tickets de error (servidor de lectores)')
      .addChannelOption(o =>
        o.setName('canal')
          .setDescription('Canal donde los lectores pueden abrir tickets de error')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('reclutamiento')
      .setDescription('Configura el canal de reclutamiento')
      .addChannelOption(o =>
        o.setName('canal')
          .setDescription('Canal donde los candidatos se postulan')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('estancado')
      .setDescription('Configura días de alerta de capítulos estancados para un proyecto')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
      )
      .addIntegerOption(o =>
        o.setName('dias')
          .setDescription('Días sin actividad antes de alertar (0 = desactivar)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(60)
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

  if (sub === 'canal')        return handleCanal(interaction);
  if (sub === 'reacciones')   return handleReacciones(interaction);
  if (sub === 'rol')          return handleRol(interaction);
  if (sub === 'verificar')    return handleVerificar(interaction);
  if (sub === 'avisos')       return handleAvisos(interaction);
  if (sub === 'tareas')       return handleCanalEnv(interaction, 'TASKS_CHANNEL_ID', 'tareas y alertas');
  if (sub === 'registros')    return handleCanalEnv(interaction, 'RECORDS_CHANNEL_ID', 'registros generales');
  if (sub === 'ausencias')    return handleCanalEnv(interaction, 'ABSENCES_CHANNEL_ID', 'ausencias');
  if (sub === 'tickets')      return handleCanalEnv(interaction, 'RECRUIT_CHANNEL_READER_ID', 'tickets de error');
  if (sub === 'reclutamiento')return handleCanalEnv(interaction, 'RECRUIT_CHANNEL_READER_ID', 'reclutamiento');
  if (sub === 'estancado')    return handleEstancado(interaction);
  if (sub === 'info')         return handleInfo(interaction);
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

  const noticeStaff  = process.env.STAFF_NOTICE_ID      ? `<#${process.env.STAFF_NOTICE_ID}>`      : 'No configurado';
  const noticeReader = process.env.NOTICE_CHANNEL_ID   ? `<#${process.env.NOTICE_CHANNEL_ID}>`   : 'No configurado';
  const canalTareas  = process.env.TASKS_CHANNEL_ID    ? `<#${process.env.TASKS_CHANNEL_ID}>`    : 'No configurado';
  const canalRegistros = process.env.RECORDS_CHANNEL_ID? `<#${process.env.RECORDS_CHANNEL_ID}>` : 'No configurado';
  const canalAusencias = process.env.ABSENCES_CHANNEL_ID?`<#${process.env.ABSENCES_CHANNEL_ID}>`:'No configurado';
  const canalReclu   = process.env.RECRUIT_CHANNEL_READER_ID ? `<#${process.env.RECRUIT_CHANNEL_READER_ID}>` : 'No configurado';

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('⚙️ Configuración del bot')
    .addFields(
      { name: '📢 Canal de anuncios',       value: channel,          inline: true },
      { name: '📋 Proyectos totales',        value: String(projects.length), inline: true },
      { name: '✅ Proyectos activos',        value: String(active),   inline: true },
      { name: '📣 Avisos (staff)',           value: noticeStaff,      inline: true },
      { name: '📣 Avisos (lectores)',        value: noticeReader,     inline: true },
      { name: '📋 Tareas y alertas',         value: canalTareas,      inline: true },
      { name: '📁 Registros',               value: canalRegistros,   inline: true },
      { name: '🏖️ Ausencias',              value: canalAusencias,   inline: true },
      { name: '🎫 Reclutamiento',           value: canalReclu,       inline: true },
      { name: '⏱️ Intervalo de check',       value: `Cada ${process.env.CHECK_INTERVAL_MINUTES || 25} minutos`, inline: true },
      { name: '🕐 Zona horaria',             value: process.env.TIMEZONE || 'America/Bogota', inline: true },
      { name: '📦 Node.js',                  value: process.version,  inline: true },
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

// ── Handler genérico para canales de entorno ─────────────────────────────────
async function handleCanalEnv(interaction, envKey, label) {
  const canal = interaction.options.getChannel('canal');
  process.env[envKey] = canal.id;
  await interaction.reply({
    content: `✅ Canal de **${label}** actualizado a ${canal}.

⚠️ Para que persista al reiniciar el bot, actualiza \`${envKey}\` en tu archivo \`.env\`.`,
    ephemeral: true,
  });
}

// ── Handler estancado ─────────────────────────────────────────────────────────
async function handleEstancado(interaction) {
  const projectId = interaction.options.getString('proyecto');
  const dias      = interaction.options.getInteger('dias');
  const { Projects } = require('../utils/storage');

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.reply({ content: `❌ Proyecto \`${projectId}\` no encontrado.`, ephemeral: true });
  }

  project.staleAlertDays = dias > 0 ? dias : null;
  Projects.save(project);

  await interaction.reply({
    content: dias > 0
      ? `✅ Alerta de estancado para **${project.name}** configurada a **${dias} días**.`
      : `✅ Alerta de estancado para **${project.name}** desactivada.`,
    ephemeral: true,
  });
}

module.exports = { data, execute, autocomplete };
