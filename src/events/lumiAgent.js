// src/events/lumiAgent.js
// Agente limitado de Lumi Nums — solo maneja flujos concretos:
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

// ── Selector de kaomojis de Lumi ──────────────────────────────────────────────
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const K = {
  timida:  () => pick(['( 〃. .〃 )','(๑•́ ₃ •̀๑)','(｡•ㅅ•｡)','(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)','(っ. .ς)','(〃ω〃)','(*ノωノ)','(//∇//)','(〃>_<;〃)']),
  altiva:  () => pick(['(￣^￣)','( ¬ _ ¬ )','(๑˘ ᵕ ˘)','( -_ -)✧','╮(╯_╰)╭','( ≖.≖)','( ๑ `꒳´ )','(｀-´)>','(￣ー￣)','(¬‿¬)']),
  sonrojo: () => pick(['(///￣ ￣///)','( 💢 〃. 〃 )','(つ 〃/// 〃 )','(>///<)','(≧///≦)','(〃////〃)','(＃>_<)','(*////*)ゞ','(#^.^#)']),
  social:  () => pick(['(｡･ω･)ﾉﾞ','( - . - ) _旦~','(๑・ω-)～','( ´ ▽ ` )b','(ㅅ´ ˘ `)','(◡‿◡✿)','(●´ω`●)','(。•́‿•̀｡)','(˘▽˘>ʃƪ)']),
  hartazgo:() => pick(['(＃￣0￣)','(︶皿︶๑)','(눈_눈)','( º _ º )','(ㆆ_ㆆ)','(눈‸눈)','(¬_¬;)','(-‸ლ)','(›_‹)','(ˉ ˘ ˉ；)']),
  triste:  () => pick(['(｡•ㅅ•｡)','(っ. .ς)','(๑•́ ₃ •̀๑)','( 〃. .〃 )','(。ŕ﹏ŏ)']),
};

// ── Flujo de TICKET ───────────────────────────────────────────────────────────
async function iniciarTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  if (!readerGuildId) {
    return interaction.editReply(`No encuentro la configuración del servidor de lectores ${K.triste()}`);
  }

  let readerGuild;
  try {
    readerGuild = await interaction.client.guilds.fetch(readerGuildId);
  } catch {
    return interaction.editReply(`No pude acceder al servidor de lectores ${K.triste()}`);
  }

  // Verificar que el usuario no tenga ya un ticket abierto
  const yaAbierto = [...sessions.values()].find(
    s => s.type === 'ticket' && s.userId === interaction.user.id
  );
  if (yaAbierto) {
    return interaction.editReply(`Ya tienes un ticket abierto. Búscalo entre tus canales ${K.altiva()}`);
  }

  // Crear canal privado con nombre corto
  const suffix = Math.random().toString(36).slice(2, 6);
  const channelName = `ticket-${suffix}`;

  let canal;
  try {
    canal = await readerGuild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: readerGuild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id,           allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: readerGuild.members.me.id,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
  } catch (err) {
    logger.error('LumiAgent', `Error creando canal de ticket: ${err.message}`);
    return interaction.editReply(`No pude crear el canal de ticket ${K.triste()}`);
  }

  sessions.set(canal.id, {
    type: 'ticket',
    step: 'awaitProyecto',
    data: {},
    userId:  interaction.user.id,
    userTag: interaction.user.tag,
  });

  await interaction.editReply(`✅ Canal creado: <#${canal.id}>`);

  // ── Mensaje de bienvenida al ticket ──────────────────────────────────────
  await canal.send(
    `<@${interaction.user.id}> ${K.social()}\n\n` +
    `Así que encontraste un error. Bien, cuéntame. **¿En qué obra es el problema?**\n\n` +
    `_(Escribe \`cancelar\` en cualquier momento si cambias de opinión)_`
  );
}

async function continuarTicket(message, session) {
  const { step, data } = session;
  const texto = message.content.trim();

  if (texto.toLowerCase() === 'cancelar') {
    sessions.delete(message.channelId);
    await message.reply(`Entendido. Cerrando ticket ${K.tranqui()}`);
    setTimeout(() => message.channel.delete().catch(() => {}), 3000);
    return;
  }

  if (step === 'awaitProyecto') {
    const proyectos = Projects.list();
    const match = proyectos.find(
      p => p.name.toLowerCase().includes(texto.toLowerCase()) || p.id.includes(texto.toLowerCase())
    );

    if (!match) {
      return message.reply(
        `No encontré ningún proyecto con ese nombre ${K.hartazgo()}\n` +
        `Proyectos disponibles: ${proyectos.map(p => `\`${p.name}\``).join(', ')}`
      );
    }

    data.proyecto = match;
    session.step = 'awaitCapitulo';
    return message.reply(
      `**${match.name}** ${K.altiva()} ¿En qué capítulo está el error? Escribe solo el número.`
    );
  }

  if (step === 'awaitCapitulo') {
    const cap = texto.replace(/[^0-9]/g, '');
    if (!cap) {
      return message.reply(`Necesito el número del capítulo, no texto ${K.hartazgo()}`);
    }
    data.capitulo = cap;
    session.step = 'awaitTipoError';

    return message.reply(
      `Capítulo **${cap}**. ¿Qué tipo de error es? Escribe uno de estos:\n\n` +
      `\`globos\` — Globos en blanco\n` +
      `\`cortadas\` — Tiras cortadas\n` +
      `\`desorden\` — Páginas desordenadas\n` +
      `\`otro\` — Otro tipo de problema`
    );
  }

  if (step === 'awaitTipoError') {
    const tipo = texto.toLowerCase();
    if (!TIPOS_ERROR[tipo]) {
      return message.reply(
        `Eso no es una opción válida ${K.hartazgo()} Usa \`globos\`, \`cortadas\`, \`desorden\` o \`otro\`.`
      );
    }
    data.tipoError = TIPOS_ERROR[tipo];

    if (tipo === 'otro') {
      session.step = 'awaitDescripcion';
      return message.reply(`Descríbeme el problema entonces. Sé específico ${K.altiva()}`);
    }

    session.step = 'done';
    data.descripcion = null;
    await enviarResumenTicket(message, session);
  }

  if (step === 'awaitDescripcion') {
    data.descripcion = texto;
    session.step = 'done';
    await enviarResumenTicket(message, session);
  }
}

async function enviarResumenTicket(message, session) {
  const { data, userId, userTag } = session;

  await message.channel.send(
    `Tu reporte fue enviado al equipo ${K.social()} Lo revisaremos a la brevedad.`
  );

  // Renombrar canal con datos reales
  const capPadded = data.capitulo.padStart(3, '0');
  const projectSlug = data.proyecto.id.slice(0, 20);
  try {
    await message.channel.setName(`ticket-${capPadded}-${projectSlug}`);
  } catch { /* no crítico */ }

  const staffGuildId   = process.env.DISCORD_GUILD_ID;
  const staffChannelId = process.env.RECORDS_CHANNEL_ID;
  if (!staffGuildId || !staffChannelId) return;

  try {
    const staffGuild   = await message.client.guilds.fetch(staffGuildId);
    const staffChannel = await staffGuild.channels.fetch(staffChannelId).catch(() => null);
    if (!staffChannel) return;

    const campos = [
      { name: '📖 Obra',       value: data.proyecto.name,   inline: true },
      { name: '📄 Capítulo',   value: `#${data.capitulo}`,  inline: true },
      { name: '⚠️ Tipo',       value: data.tipoError,        inline: true },
      { name: '👤 Reportado por', value: `${userTag} (<@${userId}>)`, inline: false },
    ];

    if (data.descripcion) {
      campos.push({ name: '📝 Descripción', value: data.descripcion, inline: false });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle('🎫 Nuevo reporte de error')
      .addFields(campos)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_corregido_${message.channelId}`)
        .setLabel('Corregido')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket_revision_${message.channelId}`)
        .setLabel('En revisión')
        .setEmoji('👀')
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
    return interaction.editReply(`No encuentro la configuración del servidor de lectores ${K.triste()}`);
  }

  let readerGuild;
  try {
    readerGuild = await interaction.client.guilds.fetch(readerGuildId);
  } catch {
    return interaction.editReply(`No pude acceder al servidor de lectores ${K.triste()}`);
  }

  const yaAbierto = [...sessions.values()].find(
    s => s.type === 'reclu' && s.userId === interaction.user.id
  );
  if (yaAbierto) {
    return interaction.editReply(`Ya tienes una postulación en curso ${K.altiva()}`);
  }

  // Crear canal privado con nombre corto tipo r-01
  const num = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
  const channelName = `r-${num}`;

  let canal;
  try {
    canal = await readerGuild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: readerGuild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id,           allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: readerGuild.members.me.id,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
  } catch (err) {
    logger.error('LumiAgent', `Error creando canal de reclutamiento: ${err.message}`);
    return interaction.editReply(`No pude crear el canal de postulación ${K.triste()}`);
  }

  sessions.set(canal.id, {
    type: 'reclu',
    step: 'awaitRol',
    data: {},
    userId:  interaction.user.id,
    userTag: interaction.user.tag,
  });

  await interaction.editReply(`✅ Canal creado: <#${canal.id}>`);

  // ── Mensaje de bienvenida al reclutamiento ────────────────────────────────
  await canal.send(
    `<@${interaction.user.id}> ${K.altiva()}\n\n` +
    `Así que quieres unirte al equipo de **Aeternum Translations**. Bien.\n\n` +
    `Voy a necesitar que seas claro desde el principio. **¿En qué área te especializas?**\n\n` +
    `\`typer\` — Pone el texto en las páginas\n` +
    `\`cleaner\` — Limpieza y redibujado\n` +
    `\`traductor\` — Traducción desde otro idioma\n\n` +
    `_(Escribe \`cancelar\` si cambias de opinión)_`
  );
}

async function continuarReclutamiento(message, session) {
  const { step, data } = session;
  const texto = message.content.trim().toLowerCase();

  if (texto === 'cancelar') {
    sessions.delete(message.channelId);
    await message.reply(`Entendido ${K.altiva()} Canal cerrado.`);
    setTimeout(() => message.channel.delete().catch(() => {}), 3000);
    return;
  }

  if (step === 'awaitRol') {
    if (texto.includes('type'))        data.rol = 'Typer';
    else if (texto.includes('clean'))  data.rol = 'Cleaner';
    else if (texto.includes('tradu'))  data.rol = 'Traductor';
    else {
      return message.reply(
        `No entendí lo que escribiste ${K.hartazgo()} Escribe \`typer\`, \`cleaner\` o \`traductor\`.`
      );
    }

    if (data.rol === 'Traductor') {
      session.step = 'awaitIdioma';
      return message.reply(
        `Traductor ${K.altiva()} ¿Desde qué idioma? Escribe \`inglés\` o \`coreano\`.`
      );
    }

    session.step = 'awaitExperiencia';
    return message.reply(
      `${data.rol} ${K.altiva()} ¿Tienes experiencia previa? (escribe \`sí\` o \`no\`)`
    );
  }

  if (step === 'awaitIdioma') {
    if (texto.includes('ingles') || texto.includes('inglés') || texto.includes('english')) {
      data.idioma = 'Inglés';
    } else if (texto.includes('corean') || texto.includes('korean')) {
      data.idioma = 'Coreano';
    } else {
      return message.reply(
        `Eso no es una opción válida ${K.hartazgo()} Escribe \`inglés\` o \`coreano\`.`
      );
    }
    session.step = 'awaitExperiencia';
    return message.reply(
      `${data.idioma} ${K.altiva()} ¿Tienes experiencia previa como Traductor? (\`sí\` o \`no\`)`
    );
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
    `Datos recibidos ${K.social()} El equipo revisará tu postulación y te responderá por aquí.`
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
      .setTitle('✨ Nueva postulación')
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
    return interaction.reply({ content: `Solo los moderadores pueden usar estos botones ${K.altiva()}`, ephemeral: true });
  }

  const id = interaction.customId;
  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;

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

  // Mensajes de DM según resultado — con la personalidad de Lumi
  const mensajesDM = {
    ticket: {
      corregido: `${K.social()} Solo pasaba a avisarte que tu reporte fue procesado y el error ya fue corregido. Gracias por tomarte el tiempo de reportarlo.`,
      revision:  `Tu reporte está siendo revisado por el equipo ${K.tranqui()} Te avisaremos cuando tengamos una respuesta.`,
      rechazado: `Revisamos tu reporte pero no pudimos confirmar el error o no aplica en este caso ${K.altiva()} Aun así, se agradece que te hayas molestado en reportarlo.`,
    },
    reclu: {
      aceptado:  `Tu postulación fue aceptada ${K.sonrojo()} Alguien del equipo se pondrá en contacto contigo pronto para darte los detalles.`,
      revision:  `Tu postulación está siendo evaluada ${K.tranqui()} Te pedimos paciencia mientras el equipo delibera.`,
      rechazado: `Por ahora no podemos incorporarte al equipo ${K.altiva()} No significa que no seas capaz — simplemente no es el momento. Puedes intentarlo de nuevo en el futuro.`,
    },
  };

  const session = sessions.get(canalLectorId);
  const userId = session?.userId;

  if (userId) {
    try {
      const user = await interaction.client.users.fetch(userId);
      await user.send(mensajesDM[tipo][resultado]);
    } catch {
      logger.warn('LumiAgent', `No pude enviar DM a ${userId}`);
    }
  }

  const nuevoEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(
      resultado === 'corregido' || resultado === 'aceptado' ? COLORS.success :
      resultado === 'rechazado' ? COLORS.error : COLORS.warning
    );

  const row = new ActionRowBuilder().addComponents(
    ...interaction.message.components[0].components.map(btn =>
      ButtonBuilder.from(btn).setDisabled(true)
    )
  );

  const etiquetas = {
    corregido: '✅ Corregido',
    revision:  '👀 En revisión',
    rechazado: '❌ Rechazado / No aplica',
    aceptado:  '✅ Aceptado',
  };

  await interaction.update({
    embeds: [nuevoEmbed.setFooter({ text: etiquetas[resultado] || resultado })],
    components: [row],
  });
}

// ── Evento principal ──────────────────────────────────────────────────────────
module.exports = {
  name: Events.MessageCreate,

  iniciarTicket,
  iniciarReclutamiento,
  handleStaffButton,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild)     return;

    const session = sessions.get(message.channelId);
    if (!session) return;
    if (message.author.id !== session.userId) return;

    if (session.type === 'ticket') return continuarTicket(message, session);
    if (session.type === 'reclu')  return continuarReclutamiento(message, session);
  },
};
