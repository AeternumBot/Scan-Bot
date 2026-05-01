// src/events/lumiAgent.js
// Agente limitado de Lumi — solo maneja flujos concretos:
//   1. Tickets de error (canal privado en lectores)
//   2. Reclutamiento (canal privado en lectores)
// Solo actúa en el servidor de STAFF o en canales creados por Lumi en LECTORES.

const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Projects } = require('../utils/storage');
const { COLORS } = require('../../config/config');
const logger = require('../utils/logger');

// ── Sesiones activas ──────────────────────────────────────────────────────────
// Map<channelId, { type: 'ticket'|'reclu', step, data, userId }>
const sessions = new Map();

const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1368818622750789633';

function isMod(member) {
  return member?.roles?.cache?.has(MOD_ROLE_ID) 
    || member?.permissions?.has('ManageGuild');
}

// ── Tipos de error para tickets ───────────────────────────────────────────────
const TIPOS_ERROR = {
  globos:   'Globos en blanco',
  cortadas: 'Tiras cortadas',
  desorden: 'Páginas desordenadas',
  otro:     'Otro',
};

// ── Flujo de TICKET ───────────────────────────────────────────────────────────
async function iniciarTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  if (!readerGuildId) {
    return interaction.editReply('A-ay... no encuentro mi configuración del servidor de lectores (´；ω；`)');
  }

  let readerGuild;
  try {
    readerGuild = await interaction.client.guilds.fetch(readerGuildId);
  } catch {
    return interaction.editReply('P-perdón... no pude acceder al servidor de lectores (〃>_<;〃)');
  }

  // Verificar que el usuario no tenga ya un ticket abierto
  const yaAbierto = [...sessions.values()].find(
    s => s.type === 'ticket' && s.userId === interaction.user.id
  );
  if (yaAbierto) {
    return interaction.editReply('Y-ya tienes un ticket abierto... (´• ω •`)ゞ Búscalo en tus canales por favor.');
  }

  let canal;
  try {
    const nombre = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    canal = await readerGuild.channels.create({
      name: `ticket-${nombre}`,
      type: ChannelType.GuildText,
      topic: `Ticket de error — ${interaction.user.username}`,
      permissionOverwrites: [
        { id: readerGuild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
  } catch (err) {
    return interaction.editReply(`Uhm... no pude crear el canal... (；￣ω￣) ${err.message}`);
  }

  sessions.set(canal.id, {
    type: 'ticket',
    step: 'awaitProyecto',
    data: {},
    userId: interaction.user.id,
    userTag: interaction.user.tag,
  });

  await interaction.editReply(`¡L-listo! Canal creado aquí: <#${canal.id}> (✿◠‿◠)`);

  const proyectos = Projects.list().filter(p => p.active);
  const lista = proyectos.map(p => `• ${p.name}`).join('\n') || 'Sin proyectos activos';

  await canal.send(
    `H-hola <@${interaction.user.id}>... voy a intentar ayudarte a reportar el error (//∇//)\n\n` +
    `¿Me podrías decir en qué proyecto está el problema? (〃ω〃)\n\n${lista}`
  );
}

async function continuarTicket(message, session) {
  const { step, data } = session;
  const texto = message.content.trim();

  if (step === 'awaitProyecto') {
    const proyectos = Projects.list().filter(p => p.active);
    const match = proyectos.find(p =>
      p.name.toLowerCase().includes(texto.toLowerCase()) ||
      p.id.toLowerCase().includes(texto.toLowerCase())
    );
    if (!match) {
      return message.reply('Uhm... no logré reconocer ese proyecto (´• ω •`)ゞ ¿Podrías escribir el nombre tal como aparece en la lista?');
    }
    data.proyectoId = match.id;
    data.proyectoName = match.name;
    session.step = 'awaitCapitulo';
    return message.reply(`¿En qué capítulo encontraste el error? (solo pon el numerito, ej: \`15\`) (´＿｀。)`);
  }

  if (step === 'awaitCapitulo') {
    const num = texto.match(/\d+(?:[.,]\d+)?/);
    if (!num) return message.reply('E-eh... no pude encontrar el número (〃>_<;〃) Por favor, escríbelo así: `15` o `15.5`');
    data.capitulo = num[0];
    session.step = 'awaitTipo';
    return message.reply(
      '¿Y... qué tipo de error es el que viste? (´；ω；`)\n\n' +
      '`globos` — Globos en blanco\n' +
      '`cortadas` — Tiras cortadas\n' +
      '`desorden` — Páginas desordenadas\n' +
      '`otro` — Otro problema'
    );
  }

  if (step === 'awaitTipo') {
    const t = texto.toLowerCase();
    if (t.includes('globo'))         data.tipoError = 'globos';
    else if (t.includes('corta'))    data.tipoError = 'cortadas';
    else if (t.includes('desor'))    data.tipoError = 'desorden';
    else                             data.tipoError = 'otro';
    session.step = 'awaitDescripcion';
    return message.reply('¿Te gustaría agregar alguna descripción o detalle extra? (si no, solo dime `no`) (っ˘ω˘ς)');
  }

  if (step === 'awaitDescripcion') {
    data.descripcion = /^no$/i.test(texto) ? null : texto;
    session.step = 'done';
    await enviarResumenTicket(message, session);
  }
}

async function enviarResumenTicket(message, session) {
  const { data, userId, userTag } = session;

  // Embed para el canal del lector
  await message.channel.send(
    `¡Listo! (ﾉ◕ヮ◕)ﾉ Ya le mandé tu reporte al equipo. Lo revisaremos pronto y te avisaremos por aquí mismo.`
  );

  // Embed para el staff
  const staffGuildId = process.env.DISCORD_GUILD_ID;
  const staffChannelId = process.env.RECORDS_CHANNEL_ID;
  if (!staffGuildId || !staffChannelId) return;

  try {
    const staffGuild = await message.client.guilds.fetch(staffGuildId);
    const staffChannel = await staffGuild.channels.fetch(staffChannelId).catch(() => null);
    if (!staffChannel) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle('🎫 Nuevo reporte de error')
      .addFields(
        { name: '👤 Reportado por', value: `${userTag} (<@${userId}>)`, inline: true },
        { name: '📖 Proyecto',      value: data.proyectoName,           inline: true },
        { name: '📄 Capítulo',      value: data.capitulo,               inline: true },
        { name: '⚠️ Tipo de error', value: TIPOS_ERROR[data.tipoError], inline: true },
      )
      .setTimestamp();

    if (data.descripcion) {
      embed.addFields({ name: '📝 Descripción', value: data.descripcion });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_corregido_${message.channelId}`)
        .setLabel('Corregido')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket_revision_${message.channelId}`)
        .setLabel('En revisión')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket_rechazado_${message.channelId}`)
        .setLabel('No aplica')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    await staffChannel.send({ 
      content: `<@&${MOD_ROLE_ID}>`, 
      embeds: [embed], 
      components: [row],
      allowedMentions: { roles: [MOD_ROLE_ID] }
    });
  } catch (err) {
    logger.error('LumiAgent', `Error enviando ticket al staff: ${err.message}`);
  }
}

// ── Flujo de RECLUTAMIENTO ────────────────────────────────────────────────────
async function iniciarReclutamiento(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  if (!readerGuildId) {
    return interaction.editReply('A-ay... no hay servidor de lectores configurado (´；ω；`)');
  }

  let readerGuild;
  try {
    readerGuild = await interaction.client.guilds.fetch(readerGuildId);
  } catch {
    return interaction.editReply('P-perdón... no pude acceder al servidor de lectores (〃>_<;〃)');
  }

  // Verificar que no tenga una postulación abierta
  const yaAbierto = [...sessions.values()].find(
    s => s.type === 'reclu' && s.userId === interaction.user.id
  );
  if (yaAbierto) {
    return interaction.editReply('Y-ya tienes una postulación en curso... búscala en tus canales porfa (´• ω •`)ゞ');
  }

  let canal;
  try {
    const nombre = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    canal = await readerGuild.channels.create({
      name: `postulacion-${nombre}`,
      type: ChannelType.GuildText,
      topic: `Postulación — ${interaction.user.username}`,
      permissionOverwrites: [
        { id: readerGuild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
  } catch (err) {
    return interaction.editReply(`Uhm... no pude crear el canal: ${err.message} (；￣ω￣)`);
  }

  sessions.set(canal.id, {
    type: 'reclu',
    step: 'awaitRol',
    data: {},
    userId: interaction.user.id,
    userTag: interaction.user.tag,
  });

  await interaction.editReply(`¡A-aquí está tu canal! <#${canal.id}> (✿◠‿◠)`);

  await canal.send(
    `¡H-hola <@${interaction.user.id}>! (//>/<//) ¡M-muchas gracias por querer unirte a nuestro equipo!\n\n` +
    `¿En qué te gustaría ayudarnos? (◕‿◕✿)\n\n` +
    `\`typer\` — pone el texto bonito en las páginas\n` +
    `\`cleaner\` — limpia y redibuja las cositas que estorban\n` +
    `\`traductor\` — traduce desde inglés o coreano`
  );
}

async function continuarReclutamiento(message, session) {
  const { step, data } = session;
  const texto = message.content.trim().toLowerCase();

  if (step === 'awaitRol') {
    if (texto.includes('type'))        data.rol = 'Typer';
    else if (texto.includes('clean'))  data.rol = 'Cleaner';
    else if (texto.includes('tradu'))  data.rol = 'Traductor';
    else {
      return message.reply('E-esto... no logré entender qué rol dijiste (；￣ω￣) Podrías escribir `typer`, `cleaner` o `traductor`, por favor?');
    }

    if (data.rol === 'Traductor') {
      session.step = 'awaitIdioma';
      return message.reply('¡Qué bien! (ﾉ´ヮ`)ﾉ*: ･ﾟ ¿Traduces desde inglés o desde coreano?');
    }

    session.step = 'awaitExperiencia';
    return message.reply(`¿Y ya tienes experiencia haciendo de ${data.rol}? (solo dime \`sí\` o \`no\`) (っ˘ω˘ς)`);
  }

  if (step === 'awaitIdioma') {
    if (texto.includes('ingles') || texto.includes('inglés') || texto.includes('english')) {
      data.idioma = 'Inglés';
    } else if (texto.includes('corean') || texto.includes('korean')) {
      data.idioma = 'Coreano';
    } else {
      return message.reply('Perdón... sigo sin entender (´• ω •`)ゞ ¿es inglés o coreano?');
    }
    session.step = 'awaitExperiencia';
    return message.reply('¿Y ya tienes experiencia previa como Traductor? (solo dime \`sí\` o \`no\`) (っ˘ω˘ς)');
  }

  if (step === 'awaitExperiencia') {
    data.experiencia = /^s[ií]/i.test(texto) ? 'Sí' : 'No';
    session.step = 'done';
    await enviarResumenReclutamiento(message, session);
  }
}

async function enviarResumenReclutamiento(message, session) {
  const { data, userId, userTag } = session;

  await message.channel.send(
    `¡T-todo listo! (✿◠‿◠) Ya le pasé tus datos al equipo. Lo revisaremos y te diremos algo prontito por aquí mismo.`
  );

  const staffGuildId   = process.env.DISCORD_GUILD_ID;
  const staffChannelId = process.env.RECORDS_CHANNEL_ID;
  if (!staffGuildId || !staffChannelId) return;

  try {
    const staffGuild   = await message.client.guilds.fetch(staffGuildId);
    const staffChannel = await staffGuild.channels.fetch(staffChannelId).catch(() => null);
    if (!staffChannel) return;

    const campos = [
      { name: '👤 Candidato', value: `${userTag} (<@${userId}>)`, inline: true },
      { name: '🎭 Rol',       value: data.rol,                    inline: true },
    ];
    if (data.idioma) campos.push({ name: '🌐 Idioma', value: data.idioma, inline: true });
    campos.push({ name: '💼 Experiencia previa', value: data.experiencia, inline: true });

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📝 Nueva postulación')
      .addFields(campos)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reclu_aceptado_${message.channelId}`)
        .setLabel('Aceptar')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reclu_revision_${message.channelId}`)
        .setLabel('En revisión')
        .setEmoji('👀')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`reclu_rechazado_${message.channelId}`)
        .setLabel('Rechazar')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    await staffChannel.send({
      content: `<@&${MOD_ROLE_ID}>`,
      embeds: [embed],
      components: [row],
      allowedMentions: { roles: [MOD_ROLE_ID] }
    });
  } catch (err) {
    logger.error('LumiAgent', `Error enviando postulación al staff: ${err.message}`);
  }
}

// ── Handler de botones del staff ──────────────────────────────────────────────
async function handleStaffButton(interaction) {
  if (!isMod(interaction.member)) {
    return interaction.reply({ content: '❌ Solo los moderadores pueden usar estos botones.', ephemeral: true });
  }

  const id = interaction.customId;
  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;

  // Determinar tipo, resultado y channelId del lector
  let tipo, resultado, canalLectorId;

  if (id.startsWith('ticket_')) {
    tipo = 'ticket';
    canalLectorId = id.split('_').pop();
    if (id.includes('corregido'))  resultado = 'corregido';
    if (id.includes('revision'))   resultado = 'revision';
    if (id.includes('rechazado'))  resultado = 'rechazado';
  } else if (id.startsWith('reclu_')) {
    tipo = 'reclu';
    canalLectorId = id.split('_').pop();
    if (id.includes('aceptado'))   resultado = 'aceptado';
    if (id.includes('revision'))   resultado = 'revision';
    if (id.includes('rechazado'))  resultado = 'rechazado';
  } else {
    return;
  }

  // Mensajes de DM según resultado
  const mensajesDM = {
    ticket: {
      corregido: '¡H-hola! (ﾉ◕ヮ◕)ﾉ Solo pasaba a avisarte que tu reporte fue procesado y el error ya se arregló. ¡Muchísimas gracias por avisarnos!',
      revision:  'Uhmm... tu reporte está siendo revisado por el equipo (´• ω •`) Te diremos cuando sepamos algo.',
      rechazado: 'P-perdón... (〃>_<;〃) Revisamos tu reporte pero no pudimos encontrar el error o tal vez no aplica esta vez. Pero ¡muchas gracias por intentar ayudarnos!',
    },
    reclu: {
      aceptado:  '¡F-felicitaciones! (//∇//) ¡Aceptamos tu postulación! Alguien del staff te escribirá muy prontito para darte la bienvenida.',
      revision:  '¡Hola de nuevo! (っ˘ω˘ς) Solo quería decirte que tu postulación está en revisión... cruza los dedos.',
      rechazado: 'A-ay... lo siento muchísimo (´；ω；`) Por ahora no podemos invitarte a entrar al equipo, pero esperamos que te animes a intentarlo en el futuro...',
    },
  };

  // Obtener sesión para saber el userId
  const session = sessions.get(canalLectorId);
  const userId = session?.userId;

  // Enviar DM al usuario
  if (userId) {
    try {
      const user = await interaction.client.users.fetch(userId);
      await user.send(mensajesDM[tipo][resultado]);
    } catch {
      logger.warn('LumiAgent', `No pude enviar DM a ${userId}`);
    }
  }

  // Actualizar el embed del staff (deshabilitar botones)
  const nuevoEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(
      resultado === 'corregido' || resultado === 'aceptado' ? COLORS.success :
      resultado === 'rechazado' ? COLORS.error : COLORS.warning
    )
    .setFooter({ text: `Marcado como "${resultado}" por ${interaction.user.tag}` });

  await interaction.update({ embeds: [nuevoEmbed], components: [] });

  // Eliminar canal en lectores si es resultado final
  const esFinal = resultado !== 'revision';
  if (esFinal && readerGuildId && canalLectorId) {
    try {
      const readerGuild = await interaction.client.guilds.fetch(readerGuildId);
      const canal = await readerGuild.channels.fetch(canalLectorId).catch(() => null);
      if (canal) {
        await canal.send(`V-voy a cerrar este canal en 10 segunditos... ¡muchas gracias por tu ayuda! (✿◠‿◠)`);
        setTimeout(() => canal.delete().catch(() => {}), 10_000);
      }
    } catch (err) {
      logger.warn('LumiAgent', `No pude eliminar canal ${canalLectorId}: ${err.message}`);
    }
    sessions.delete(canalLectorId);
  }
}

// ── Evento messageCreate ──────────────────────────────────────────────────────
module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    // Solo actuar en canales con sesión activa (tickets y reclutamiento)
    const session = sessions.get(message.channelId);
    if (!session || session.step === 'done') return;

    // Solo el usuario dueño de la sesión puede avanzar el flujo
    if (message.author.id !== session.userId) return;

    try {
      if (session.type === 'ticket') {
        await continuarTicket(message, session);
      } else if (session.type === 'reclu') {
        await continuarReclutamiento(message, session);
      }
    } catch (err) {
      logger.error('LumiAgent', `Error en flujo ${session.type}: ${err.message}`);
      await message.reply('O-ocurrió un error intentando entender tu respuesta... ¿puedes intentar de nuevo? (；￣ω￣)').catch(() => {});
    }
  },

  // Exportar funciones para interactionCreate
  iniciarTicket,
  iniciarReclutamiento,
  handleStaffButton,
};
