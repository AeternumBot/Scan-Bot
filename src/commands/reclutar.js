// src/commands/reclutar.js
// /reclutar — sistema de reclutamiento
// El candidato usa el comando en el canal de reclutamiento del servidor de lectores
// Sua crea un canal temporal en el servidor de staff y guía al candidato
// ────────────────────────────────────────────────────────────────────────────

const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { Reclutamiento } = require('../utils/storage');
const { COLORS }        = require('../../config/config');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const K = {
  feliz:   () => pick(['(◕‿◕✿)', '(ﾉ◕ヮ◕)ﾉ', '(*´▽`*)']),
  timida:  () => pick(['(〃>_<;〃)', '(/ω＼)', '(〃ω〃)']),
  triste:  () => pick(['(;ω;)', '(´；ω；`)', '(╥_╥)']),
  tranqui: () => pick(['(˘ω˘)', '(っ˘ω˘ς)', '(￣▽￣)']),
};

const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1368818622750789633';

function isMod(member) {
  return member.roles.cache.has(MOD_ROLE_ID)
    || member.permissions.has('ManageGuild')
    || member.permissions.has('BanMembers');
}

// Roles disponibles para postulación
const ROLES_POSTULACION = {
  traductor:  'Traductor',
  cleaner:    'Cleaner / Redibujador',
  typesetter: 'Typer',
};

const data = new SlashCommandBuilder()
  .setName('reclutar')
  .setDescription('Postúlate para unirte al equipo de Aeternum Translations')
  .addSubcommand(sub =>
    sub.setName('postular')
      .setDescription('Inicia tu proceso de postulación')
      .addStringOption(o =>
        o.setName('rol').setDescription('¿En qué rol te interesa colaborar?').setRequired(true)
          .addChoices(
            { name: 'Traductor',                value: 'traductor'  },
            { name: 'Cleaner / Redibujador',    value: 'cleaner'    },
            { name: 'Typer',                    value: 'typesetter' },
          )
      )
      .addStringOption(o =>
        o.setName('experiencia').setDescription('¿Tienes experiencia previa? (No es obligatoria)').setRequired(true)
          .addChoices(
            { name: 'Sí, tengo experiencia',           value: 'si'       },
            { name: 'No, pero quiero aprender',        value: 'no'       },
            { name: 'Poca, he hecho algo por mi cuenta', value: 'poca'  },
          )
      )
      .addStringOption(o =>
        o.setName('disponibilidad')
          .setDescription('¿Cuántas horas a la semana podrías dedicar aproximadamente?')
          .setRequired(true)
          .addChoices(
            { name: 'Menos de 5 horas',    value: 'menos5'  },
            { name: 'Entre 5 y 10 horas',  value: '5a10'    },
            { name: 'Más de 10 horas',     value: 'mas10'   },
          )
      )
      .addStringOption(o =>
        o.setName('motivacion')
          .setDescription('¿Qué proyecto o cosa de Aeternum te motivó a postularte?')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('cerrar')
      .setDescription('Cierra una solicitud de reclutamiento (solo mods)')
      .addStringOption(o =>
        o.setName('id').setDescription('ID de la solicitud').setRequired(true)
      )
      .addStringOption(o =>
        o.setName('resultado').setDescription('Resultado de la postulación').setRequired(true)
          .addChoices(
            { name: 'Aceptado',  value: 'aceptado'  },
            { name: 'Rechazado', value: 'rechazado' },
            { name: 'Cerrado',   value: 'cerrado'   },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('lista')
      .setDescription('Lista las solicitudes pendientes (solo mods)')
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'postular') return handlePostular(interaction);
  if (sub === 'cerrar')   return handleCerrar(interaction);
  if (sub === 'lista')    return handleLista(interaction);
}

// ── /reclutar postular ────────────────────────────────────────────────────────

async function handlePostular(interaction) {
  await interaction.deferReply({ ephemeral: true });

  // Verificar que el comando se use en el canal de reclutamiento
  const canalRecluId = process.env.RECRUIT_CHANNEL_READER_ID;
  if (canalRecluId && interaction.channelId !== canalRecluId) {
    return interaction.editReply(pick([
      `E-eh... este comando solo funciona en el canal de reclutamiento ${K.timida()} ¡Busca el canal correcto!`,
      `N-no puedo procesar tu postulación aquí ${K.tranqui()} Ve al canal de reclutamiento e inténtalo allí.`,
    ]));
  }

  // Verificar si ya tiene una solicitud activa
  const yaActiva = Reclutamiento.getByUsuario(interaction.user.id);
  if (yaActiva) {
    return interaction.editReply(pick([
      `Ya tienes una postulación pendiente ${K.timida()} El equipo está revisando tu solicitud. ¡Ten paciencia!`,
      `E-eh... ya te postulaste antes y tu solicitud sigue en revisión ${K.tranqui()} Espera a que el staff te contacte.`,
    ]));
  }

  const rolInteres    = interaction.options.getString('rol');
  const experiencia   = interaction.options.getString('experiencia');
  const disponibilidad = interaction.options.getString('disponibilidad');
  const motivacion    = interaction.options.getString('motivacion');

  const dispLabels = { menos5: 'Menos de 5h/semana', '5a10': '5 a 10h/semana', mas10: 'Más de 10h/semana' };
  const expLabels  = { si: 'Sí, tiene experiencia', no: 'Sin experiencia (aprende)', poca: 'Poca experiencia propia' };

  // Crear canal temporal en servidor de staff
  const staffGuildId = process.env.DISCORD_GUILD_ID;
  if (!staffGuildId) {
    return interaction.editReply(`A-ay... no está configurado el servidor de staff ${K.triste()}`);
  }

  let staffGuild;
  try {
    staffGuild = await interaction.client.guilds.fetch(staffGuildId);
  } catch {
    return interaction.editReply(`No pude acceder al servidor de staff ${K.triste()}`);
  }

  // Contar solicitudes para numerar el canal
  const totalSolicitudes = Reclutamiento.list().length + 1;
  const canalNombre = `postulacion-${String(totalSolicitudes).padStart(3, '0')}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}`;

  let canal;
  try {
    canal = await staffGuild.channels.create({
      name:   canalNombre,
      type:   ChannelType.GuildText,
      topic:  `Postulación de ${interaction.user.username} — ${ROLES_POSTULACION[rolInteres]}`,
      permissionOverwrites: [
        {
          id:   staffGuild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id:    MOD_ROLE_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id:    staffGuild.members.me.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ],
    });
  } catch (err) {
    return interaction.editReply(`N-no pude crear el canal de postulación ${K.triste()} Error: ${err.message}`);
  }

  // Crear solicitud en storage
  const solicitud = Reclutamiento.create({
    usuarioId:     interaction.user.id,
    usuarioName:   interaction.user.username,
    rolInteres,
    experiencia,
    disponibilidad,
    motivacion,
    proyectoInteres: motivacion, // reutilizamos motivación como proyecto de interés
    channelId:     canal.id,
  });

  // Enviar resumen en el canal de staff
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📋 Nueva postulación — ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: '🎭 Rol de interés',   value: ROLES_POSTULACION[rolInteres], inline: true  },
      { name: '💼 Experiencia',      value: expLabels[experiencia],         inline: true  },
      { name: '⏰ Disponibilidad',   value: dispLabels[disponibilidad],     inline: true  },
      { name: '💬 Motivación',       value: motivacion,                     inline: false },
      { name: '🆔 ID solicitud',     value: `\`${solicitud.id}\``,          inline: true  },
      { name: '👤 Usuario Discord',  value: `<@${interaction.user.id}>`,    inline: true  },
    )
    .setTimestamp()
    .setFooter({ text: 'Usa /reclutar cerrar <id> cuando finalice el proceso' });

  // Nota sobre remuneración y aprendizaje
  let notaExtra = '';
  if (experiencia === 'no') {
    notaExtra = '\n\n> 📌 El candidato indicó no tener experiencia previa. Recuerden mencionar que enseñamos desde cero.';
  }
  notaExtra += '\n> ⚠️ Recuerden informar que el trabajo no es remunerado.';

  await canal.send({
    content: pick([
      `<@&${MOD_ROLE_ID}> — Nueva postulación recibida ${K.feliz()} Por favor revisen y contacten al candidato.${notaExtra}`,
      `<@&${MOD_ROLE_ID}> — ¡Alguien quiere unirse al equipo! ${K.feliz()} Revisen los detalles.${notaExtra}`,
    ]),
    embeds: [embed],
    allowedMentions: { roles: [MOD_ROLE_ID] },
  });

  // Notificar en registros
  const canalRegistros = process.env.RECORDS_CHANNEL_ID;
  if (canalRegistros) {
    const reg = await interaction.client.channels.fetch(canalRegistros).catch(() => null);
    if (reg) {
      await reg.send(
        `📋 Nueva postulación \`${solicitud.id}\` — **${interaction.user.username}** (${ROLES_POSTULACION[rolInteres]})\nCanal: ${canal}`
      );
    }
  }

  await interaction.editReply(pick([
    `¡Tu postulación fue enviada! ${K.feliz()} El equipo ya fue notificado y alguien se comunicará contigo pronto. ¡Mucha suerte!`,
    `¡Postulación recibida! ${K.tranqui()} Ya avisé al staff. Estarán en contacto contigo en breve. ¡Gracias por tu interés!`,
    `¡Todo listo! ${K.feliz()} Tu solicitud para **${ROLES_POSTULACION[rolInteres]}** ya está en manos del equipo. ¡Paciencia y mucha suerte!`,
  ]));
}

// ── /reclutar cerrar ──────────────────────────────────────────────────────────

async function handleCerrar(interaction) {
  if (!isMod(interaction.member)) {
    return interaction.reply({
      content: `E-eh... solo los moderadores pueden cerrar solicitudes de reclutamiento ${K.timida()}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const solicitudId = interaction.options.getString('id');
  const resultado   = interaction.options.getString('resultado');
  const solicitud   = Reclutamiento.get(solicitudId);

  if (!solicitud) {
    return interaction.editReply(`No encontré la solicitud \`${solicitudId}\` ${K.timida()}`);
  }
  if (solicitud.estado !== 'pendiente') {
    return interaction.editReply(`Esa solicitud ya fue cerrada (estado: ${solicitud.estado}) ${K.tranqui()}`);
  }

  Reclutamiento.cerrar(solicitudId, interaction.user.id, resultado);

  // Enviar DM al candidato
  try {
    const usuario = await interaction.client.users.fetch(solicitud.usuarioId);
    if (usuario) {
      const dmMensajes = {
        aceptado: [
          `¡Hola **${solicitud.usuarioName}**! ${K.feliz()} Me alegra muchísimo contarte que tu postulación para **${ROLES_POSTULACION[solicitud.rolInteres]}** en Aeternum Translations fue **aceptada**. ¡Bienvenido/a al equipo! El staff se comunicará contigo con los próximos pasos.`,
          `¡Buenas noticias! ${K.feliz()} Tu solicitud para unirte como **${ROLES_POSTULACION[solicitud.rolInteres]}** fue **aceptada**. ¡El equipo de Aeternum te da la bienvenida! Pronto recibirás más instrucciones.`,
        ],
        rechazado: [
          `Hola **${solicitud.usuarioName}** ${K.tranqui()} Gracias por tu interés en Aeternum Translations. En este momento, lamentablemente tu postulación para **${ROLES_POSTULACION[solicitud.rolInteres]}** no pudo continuar. ¡No te desanimes, en el futuro podrías volver a intentarlo!`,
          `Hola ${K.tranqui()} Gracias por postularte. Desafortunadamente por ahora no podemos continuar con tu solicitud para **${ROLES_POSTULACION[solicitud.rolInteres]}**. ¡Mucho ánimo y gracias por tu interés!`,
        ],
        cerrado: [
          `Hola **${solicitud.usuarioName}** ${K.tranqui()} Te escribo para informarte que tu solicitud de postulación fue cerrada. Si tienes alguna duda, puedes escribir nuevamente en el canal de reclutamiento.`,
        ],
      };
      const pool = dmMensajes[resultado] || dmMensajes.cerrado;
      await usuario.send(pick(pool)).catch(() => {/* DMs cerrados */});
    }
  } catch { /* usuario no encontrado */ }

  // Eliminar canal temporal después de 15 segundos
  const staffGuildId = process.env.DISCORD_GUILD_ID;
  if (solicitud.channelId && staffGuildId) {
    try {
      const staffGuild = await interaction.client.guilds.fetch(staffGuildId);
      const canal = await staffGuild.channels.fetch(solicitud.channelId).catch(() => null);
      if (canal) {
        const emoji = resultado === 'aceptado' ? '✅' : resultado === 'rechazado' ? '❌' : '🔒';
        await canal.send(pick([
          `${emoji} Proceso cerrado por <@${interaction.user.id}> — Resultado: **${resultado}**. Canal eliminándose en 15 segundos ${K.tranqui()}`,
          `${emoji} Postulación finalizada. Resultado: **${resultado}**. Este canal se cerrará en 15 segundos.`,
        ]));
        setTimeout(() => canal.delete('Postulación cerrada').catch(() => {}), 15_000);
      }
    } catch { /* canal ya no existe */ }
  }

  await interaction.editReply(pick([
    `¡Solicitud \`${solicitudId}\` cerrada! ${K.feliz()} Resultado: **${resultado}**. Le envié un DM al candidato.`,
    `Cerrada ${K.tranqui()} \`${solicitudId}\` — ${resultado}. El candidato ya fue notificado y el canal se eliminará en breve.`,
  ]));
}

// ── /reclutar lista ───────────────────────────────────────────────────────────

async function handleLista(interaction) {
  if (!isMod(interaction.member)) {
    return interaction.reply({
      content: `E-eh... solo los moderadores pueden ver las postulaciones ${K.timida()}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const pendientes = Reclutamiento.listPendientes();

  if (!pendientes.length) {
    return interaction.editReply(pick([
      `No hay postulaciones pendientes en este momento ${K.feliz()}`,
      `La bandeja de postulaciones está vacía ${K.tranqui()}`,
    ]));
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📋 Postulaciones pendientes (${pendientes.length})`)
    .setTimestamp()
    .setFooter({ text: 'Usa /reclutar cerrar <id> cuando finalice el proceso (っ˘ω˘ς)' });

  for (const s of pendientes.slice(0, 10)) {
    embed.addFields({
      name: `\`${s.id}\` — ${s.usuarioName}`,
      value: `**Rol:** ${ROLES_POSTULACION[s.rolInteres]}\n**Canal:** <#${s.channelId}>\n**Fecha:** <t:${Math.floor(new Date(s.creadoAt).getTime()/1000)}:D>`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
