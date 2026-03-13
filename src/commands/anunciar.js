// src/commands/anunciar.js
const { SlashCommandBuilder } = require('discord.js');
const { Projects }  = require('../utils/storage');
const logger        = require('../utils/logger');
const SUA           = require('../utils/sua');
const { COLORS, SOURCES } = require('../../config/config');
const announcer     = require('../services/announcer');
const tmo           = require('../services/tmoScraper');
const colorcito     = require('../services/colorcito');

const data = new SlashCommandBuilder()
  .setName('anunciar')
  .setDescription('Publica manualmente el anuncio de un capítulo')
  .addStringOption(o =>
    o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
  )
  .addStringOption(o =>
    o.setName('capitulo').setDescription('Número de capítulo').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('mensaje').setDescription('Mensaje personalizado (opcional)')
  )
  .addStringOption(o =>
    o.setName('portada_url').setDescription('URL directa de la imagen de portada')
  )
  .addStringOption(o => o.setName('traductores').setDescription('IDs separados por coma'))
  .addStringOption(o => o.setName('cleaners').setDescription('IDs separados por coma'))
  .addStringOption(o => o.setName('typeos').setDescription('IDs separados por coma'))
  .addStringOption(o => o.setName('otros').setDescription('IDs separados por coma'))
  .addStringOption(o =>
    o.setName('fuente').setDescription('Plataforma a anunciar')
      .addChoices(
        { name: 'Ambas',      value: 'ambas' },
        { name: 'TMO',        value: 'tmo' },
        { name: 'Colorcito',  value: 'colorcito' },
      )
  )
  .addStringOption(o =>
    o.setName('tmo_link').setDescription('Link directo al capítulo en TMO (opcional)')
  )
  .addRoleOption(o =>
    o.setName('rol_extra').setDescription('Rol adicional a mencionar (opcional)')
  );

// ── Autocomplete: solo IDs ────────────────────────────────────────────────────
async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = Projects.list()
      .filter(p => p.id.includes(focused) || p.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(p => ({ name: p.id, value: p.id }));
    await interaction.respond(choices);
  } catch { /* interacción expirada */ }
}

// ── Execute ───────────────────────────────────────────────────────────────────
async function execute(interaction) {
  if (interaction.replied || interaction.deferred) return;

  const ALLOWED_ROLE = process.env.ANNOUNCER_ROLE_ID;
  const MOD_ROLE     = process.env.MOD_ROLE_ID || '1368818622750789633';
  const rolesPermitidos = [ALLOWED_ROLE, MOD_ROLE].filter(Boolean);
  const hasRole = rolesPermitidos.some(r => interaction.member.roles.cache.has(r))
    || interaction.member.permissions.has('ManageGuild');

  if (!hasRole) {
    return interaction.reply({ content: SUA.sinPermisos, flags: 64 });
  }

  await interaction.deferReply({ ephemeral: true });

  const projectId      = interaction.options.getString('proyecto');
  const capNum         = interaction.options.getString('capitulo');
  const mensaje        = interaction.options.getString('mensaje');
  const portadaUrl     = interaction.options.getString('portada_url');
  const traductoresRaw = interaction.options.getString('traductores');
  const cleanersRaw    = interaction.options.getString('cleaners');
  const typeosRaw      = interaction.options.getString('typeos');
  const otrosRaw       = interaction.options.getString('otros');
  const fuenteOpt      = interaction.options.getString('fuente') || 'ambas';
  const tmoLinkManual  = interaction.options.getString('tmo_link');
  const rolMencion     = interaction.options.getRole('rol_extra');

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.editReply({ content: SUA.proyecto.noEncontrado(projectId) });
  }

  // ── Obtener URLs de capítulo en paralelo ──────────────────────────────────
  let chapterUrlTmo   = null;
  let chapterUrlColor = null;
  let isEcchi         = false;

  const promises = [];

  if ((fuenteOpt === 'tmo' || fuenteOpt === 'ambas') && project.sources?.tmo) {
    promises.push(
      tmo.getLatestChapter(project.sources.tmo)
        .then(d => { if (d) chapterUrlTmo = d.chapterUrl; })
        .catch(() => {})
    );
  }

  if ((fuenteOpt === 'colorcito' || fuenteOpt === 'ambas') && project.sources?.colorcito) {
    promises.push(
      colorcito.getLatestChapter(project.sources.colorcito)
        .then(d => {
          if (d) {
            chapterUrlColor = d.chapterUrl;
            if (d.isEcchi) isEcchi = true;
            logger.info('Anunciar', `Tags Colorcito: [${(d.tags||[]).join(', ')}] | isEcchi=${d.isEcchi}`);
          }
        })
        .catch(() => {})
    );
  }

  await Promise.all(promises);

  const chapData = {
    chapterNum:  capNum,
    chapterTitle: null,
    chapterUrl:  tmoLinkManual || chapterUrlTmo || chapterUrlColor || null,
    thumbnail:   portadaUrl || project.thumbnail || null,
    urlTmo:      tmoLinkManual || chapterUrlTmo || null,
    urlColorcito: project.sources?.colorcito || chapterUrlColor || null,
  };

  // ── Créditos ──────────────────────────────────────────────────────────────
  function idsToMentions(raw) {
    if (!raw) return null;
    return raw.split(',')
      .map(id => id.trim())
      .filter(id => /^\d{17,20}$/.test(id))
      .map(id => `<@${id}>`)
      .join(' ');
  }

  const credits = [];
  const mencTraductores = idsToMentions(traductoresRaw);
  const mencCleaners    = idsToMentions(cleanersRaw);
  const mencTypeos      = idsToMentions(typeosRaw);
  const mencOtros       = idsToMentions(otrosRaw);

  if (mencTraductores) credits.push(`📝 **Traducción:** ${mencTraductores}`);
  if (mencCleaners)    credits.push(`🧹 **Clean:** ${mencCleaners}`);
  if (mencTypeos)      credits.push(`✏️ **Typeo/Final:** ${mencTypeos}`);
  if (mencOtros)       credits.push(`🌟 **Otros:** ${mencOtros}`);

  if (!credits.length && project.defaultCredits) {
    credits.push(project.defaultCredits);
  }

  const extraRoles = rolMencion ? [rolMencion.id] : [];

  // ── Nota Ecchi ────────────────────────────────────────────────────────────
  const ECCHI_FRASES = [
    'S-s-sua no aprueba este capítulo... p-pero aquí está (〃>_<;〃)',
    'A-ay... este capítulo es un poco... ya saben. Sua se tapa los ojos (//>/<//)',
    'Sua deja esto aquí y se va sin mirar... (*ノωノ)',
    'E-este... es un capítulo especial. Sua no dice nada más (//∇//)',
    'P-para mayores de edad, dice la advertencia. Sua lo cumple sin chistar (〃ω〃)',
    'S-sua no sabe nada de este capítulo. Nada. No lo vio. (〃>_<;〃)',
    'E-eh... Sua solo es la mensajera, ¿de acuerdo? No la culpen (/ω＼)',
    'A-aquí está el capítulo... Sua se esconde detrás del servidor (//∇//)',
    'S-Sua pone esto aquí con los ojos cerrados. Con mucho cuidado. (〃ω〃)',
    '...Sua miró sin querer y ahora está muy roja. Disfruten (*ノωノ)',
    'E-este capítulo requiere discreción. Sua tiene mucha. Demasiada. (〃>_<;〃)',
    'S-sua cumple con su deber aunque le cueste la tranquilidad (//>/<//)',
    'A-ay... el equipo trabajó con mucho... esfuerzo en este. Sua también. Con los ojos cerrados (//∇//)',
    'S-sua entrega esto sin preguntas ni comentarios. Buenos días (〃ω〃)',
    'E-eh... Sua recomienda leer esto en privado. Por respeto. A Sua (〃>_<;〃)',
    'A-aquí está. Sua ya cumplió. Sua se va a leer algo inocente ahora (*ノωノ)',
    'S-sua no sabe qué pasa en este capítulo. Tampoco quiere saberlo (/ω＼)',
    'E-el equipo puso mucho cariño aquí... y otras cosas. Sua no dice más (//∇//)',
    'A-ay, ay, ay... Sua entrega esto y sale corriendo (〃>_<;〃)',
    'S-sua se disculpa de antemano con los lectores sensibles. Y con ella misma (//>/<//)',
    'E-este capítulo tiene contenido... interesante. Sua lo deja aquí sin más comentarios (〃ω〃)',
    'S-sua solo trabaja aquí. No es responsable del contenido. Para nada (*ノωノ)',
    'A-aquí lo tienen... Sua pide que no la juzguen por entregar esto (//∇//)',
    'E-eh... Sua notó el tag. Sua finge que no notó el tag. Aquí está el capítulo (〃>_<;〃)',
    'S-sua tiene valores. Sua también tiene trabajo. El trabajo ganó hoy (/ω＼)',
    'A-ay... Sua va a necesitar un té después de esto. Aquí está el capítulo (〃ω〃)',
    'E-el capítulo está listo. Sua también estará lista... en unos minutos... cuando se recupere (//>/<//)',
    'S-sua entrega esto con dignidad. Poca, pero la hay (*ノωノ)',
    'A-aquí está. Sua cierra los ojos, cuenta hasta diez y sigue con su día (〃>_<;〃)',
    'E-este capítulo es para valientes. O curiosos. Sua no juzga... mucho (//∇//)',
  ];

  if (!global._ecchiUsadas) global._ecchiUsadas = [];
  const disponibles = ECCHI_FRASES.filter(f => !global._ecchiUsadas.includes(f));
  const pool  = disponibles.length >= 5 ? disponibles : ECCHI_FRASES;
  const frase = pool[Math.floor(Math.random() * pool.length)];
  if (isEcchi) {
    global._ecchiUsadas.push(frase);
    if (global._ecchiUsadas.length > 5) global._ecchiUsadas.shift();
  }

  const ecchiNote  = isEcchi ? ('\n\n*' + frase + '*') : '';
  const mensajeFinal = ((mensaje || '') + ecchiNote).trim() || null;

  // ── Enviar ────────────────────────────────────────────────────────────────
  const channelId = project.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    return interaction.editReply({ content: SUA.anunciar.sinCanal });
  }

  const message = await announcer.sendManualAnnouncement(
    interaction.client,
    project,
    chapData,
    { customMessage: mensajeFinal, imageUrl: portadaUrl, credits, extraRoles }
  );

  if (!message) {
    return interaction.editReply({ content: SUA.anunciar.errorEnvio });
  }

  await interaction.editReply({ content: SUA.anunciar.enviado(project.name, capNum) });
}

module.exports = { data, execute, autocomplete };
