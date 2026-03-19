// src/commands/ausencia.js
// /ausencia — sistema de solicitudes de ausencia temporal del staff
// ────────────────────────────────────────────────────────────────────────────

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Ausencias }  = require('../utils/storage');
const { COLORS }     = require('../../config/config');

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

const data = new SlashCommandBuilder()
  .setName('ausencia')
  .setDescription('Gestiona las ausencias temporales del staff')
  .addSubcommand(sub =>
    sub.setName('pedir')
      .setDescription('Registra tu ausencia temporal')
      .addStringOption(o =>
        o.setName('razon').setDescription('Motivo de la ausencia').setRequired(true)
      )
      .addStringOption(o =>
        o.setName('hasta').setDescription('Fecha de regreso (DD/MM/AAAA)').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('registrar')
      .setDescription('Registra la ausencia de otro miembro del staff (solo mods)')
      .addUserOption(o =>
        o.setName('usuario').setDescription('Miembro del staff').setRequired(true)
      )
      .addStringOption(o =>
        o.setName('razon').setDescription('Motivo de la ausencia').setRequired(true)
      )
      .addStringOption(o =>
        o.setName('hasta').setDescription('Fecha de regreso (DD/MM/AAAA)').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('cancelar')
      .setDescription('Cancela una ausencia activa')
      .addStringOption(o =>
        o.setName('id').setDescription('ID de la ausencia (vacío = cancela la tuya activa)').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('lista')
      .setDescription('Muestra las ausencias activas')
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'pedir')     return handlePedir(interaction, interaction.user, interaction.user.id);
  if (sub === 'registrar') return handleRegistrar(interaction);
  if (sub === 'cancelar')  return handleCancelar(interaction);
  if (sub === 'lista')     return handleLista(interaction);
}

// ── Parsear fecha DD/MM/AAAA ──────────────────────────────────────────────────

function parseDate(str) {
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  if (isNaN(date.getTime())) return null;
  if (date <= new Date()) return null; // no puede ser en el pasado
  return date.toISOString();
}

// ── Publicar en canal de ausencias ────────────────────────────────────────────

async function publicarEnCanalAusencias(client, ausencia) {
  const canalId = process.env.ABSENCES_CHANNEL_ID;
  if (!canalId) return null;
  const canal = await client.channels.fetch(canalId).catch(() => null);
  if (!canal) return null;

  const hasta    = new Date(ausencia.hasta);
  const hastaTs  = Math.floor(hasta.getTime() / 1000);

  const mensajes = [
    `🏖️ **${ausencia.usuarioName}** estará ausente hasta <t:${hastaTs}:D>\n**Motivo:** ${ausencia.razon}\nID: \`${ausencia.id}\``,
    `🏖️ <@${ausencia.usuarioId}> registró una ausencia hasta <t:${hastaTs}:D>\n> ${ausencia.razon}\nID: \`${ausencia.id}\``,
  ];

  const msg = await canal.send(pick(mensajes));
  // Guardar ID del mensaje para editarlo cuando venza
  ausencia.mensajeId = msg.id;
  Ausencias.save(ausencia);
  return msg;
}

// ── /ausencia pedir ───────────────────────────────────────────────────────────

async function handlePedir(interaction, usuario, creadoPor) {
  await interaction.deferReply({ ephemeral: true });

  const razonRaw  = interaction.options.getString('razon');
  const hastaRaw  = interaction.options.getString('hasta');
  const hastaISO  = parseDate(hastaRaw);

  if (!hastaISO) {
    return interaction.editReply(pick([
      `E-eh... esa fecha no la entendí ${K.timida()} Usa el formato **DD/MM/AAAA** y asegúrate de que sea una fecha futura.`,
      `Mmm, la fecha no es válida ${K.tranqui()} Intenta con **DD/MM/AAAA**, por ejemplo: 25/03/2026`,
    ]));
  }

  // Verificar si ya tiene una ausencia activa
  const yaActiva = Ausencias.list().find(
    a => a.usuarioId === usuario.id && a.estado === 'activa'
  );
  if (yaActiva) {
    return interaction.editReply(pick([
      `Ya tienes una ausencia activa registrada (hasta <t:${Math.floor(new Date(yaActiva.hasta).getTime()/1000)}:D>) ${K.timida()} Cancélala primero con \`/ausencia cancelar\`.`,
      `E-eh... ya hay una ausencia activa para ti ${K.tranqui()} Usa \`/ausencia cancelar\` si quieres modificarla.`,
    ]));
  }

  const ausencia = Ausencias.create({
    usuarioId:   usuario.id,
    usuarioName: usuario.username,
    razon:       razonRaw,
    hasta:       hastaISO,
    creadoPor,
  });

  await publicarEnCanalAusencias(interaction.client, ausencia);

  // Notificar en registros
  const canalRegistros = process.env.RECORDS_CHANNEL_ID;
  if (canalRegistros) {
    const canal = await interaction.client.channels.fetch(canalRegistros).catch(() => null);
    if (canal) {
      await canal.send(
        `📋 Nueva ausencia registrada: **${usuario.username}** hasta <t:${Math.floor(new Date(hastaISO).getTime()/1000)}:D>\n> ${razonRaw}\nID: \`${ausencia.id}\``
      );
    }
  }

  await interaction.editReply(pick([
    `¡Registré tu ausencia! ${K.feliz()} Estarás de vuelta el <t:${Math.floor(new Date(hastaISO).getTime()/1000)}:D>. ¡Descansa mucho y vuelve con energías!`,
    `Ausencia registrada hasta <t:${Math.floor(new Date(hastaISO).getTime()/1000)}:D> ${K.tranqui()} ID: \`${ausencia.id}\` — ¡Te esperamos con los brazos abiertos!`,
    `Listo ${K.feliz()} Tu ausencia queda anotada hasta el <t:${Math.floor(new Date(hastaISO).getTime()/1000)}:D>. Cualquier cosa que necesites, avísame.`,
  ]));
}

// ── /ausencia registrar ───────────────────────────────────────────────────────

async function handleRegistrar(interaction) {
  if (!isMod(interaction.member)) {
    return interaction.reply({
      content: `E-eh... solo los moderadores pueden registrar ausencias de otros ${K.timida()}`,
      ephemeral: true,
    });
  }

  const usuario = interaction.options.getUser('usuario');
  // Reutilizar lógica de pedir pero con otro usuario
  const originalGetString = interaction.options.getString.bind(interaction.options);
  await handlePedir(interaction, usuario, interaction.user.id);
}

// ── /ausencia cancelar ────────────────────────────────────────────────────────

async function handleCancelar(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const idParam = interaction.options.getString('id');
  let ausencia;

  if (idParam) {
    ausencia = Ausencias.get(idParam);
    if (!ausencia) {
      return interaction.editReply(`No encontré la ausencia \`${idParam}\` ${K.timida()}`);
    }
    // Solo el propio usuario o un mod puede cancelar
    if (ausencia.usuarioId !== interaction.user.id && !isMod(interaction.member)) {
      return interaction.editReply(`N-no puedes cancelar la ausencia de otra persona ${K.timida()}`);
    }
  } else {
    // Buscar la ausencia activa del usuario actual
    ausencia = Ausencias.list().find(
      a => a.usuarioId === interaction.user.id && a.estado === 'activa'
    );
    if (!ausencia) {
      return interaction.editReply(pick([
        `No tienes ninguna ausencia activa en este momento ${K.tranqui()}`,
        `Mmm, no encontré ausencias activas tuyas ${K.timida()}`,
      ]));
    }
  }

  if (ausencia.estado !== 'activa') {
    return interaction.editReply(`Esa ausencia ya no está activa (estado: ${ausencia.estado}) ${K.tranqui()}`);
  }

  Ausencias.cancelar(ausencia.id);

  // Editar mensaje en canal de ausencias
  const canalId = process.env.ABSENCES_CHANNEL_ID;
  if (canalId && ausencia.mensajeId) {
    const canal = await interaction.client.channels.fetch(canalId).catch(() => null);
    if (canal) {
      try {
        const msg = await canal.messages.fetch(ausencia.mensajeId);
        if (msg) await msg.edit(`~~${msg.content}~~\n🔄 **Cancelada** por el usuario.`);
      } catch { /* mensaje ya no existe */ }
    }
  }

  await interaction.editReply(pick([
    `¡Ausencia cancelada! ${K.feliz()} Qué alegría que puedas seguir con nosotros.`,
    `Cancelada ${K.tranqui()} Bienvenido/a de vuelta, aunque nunca te fuiste del todo.`,
    `Listo, ausencia cancelada ${K.feliz()} ¡Nos alegra tenerte aquí!`,
  ]));
}

// ── /ausencia lista ───────────────────────────────────────────────────────────

async function handleLista(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ausencias = Ausencias.listActivas();

  if (!ausencias.length) {
    return interaction.editReply(pick([
      `¡No hay ausencias activas! ${K.feliz()} Todo el equipo está disponible.`,
      `El equipo completo está presente ${K.feliz()} Ninguna ausencia registrada.`,
    ]));
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle('🏖️ Ausencias activas del staff')
    .setTimestamp()
    .setFooter({ text: 'Sua las revisa cada hora (っ˘ω˘ς)' });

  for (const a of ausencias) {
    const hastaTs = Math.floor(new Date(a.hasta).getTime() / 1000);
    embed.addFields({
      name: a.usuarioName,
      value: `**Hasta:** <t:${hastaTs}:D>\n**Motivo:** ${a.razon}\n**ID:** \`${a.id}\``,
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
