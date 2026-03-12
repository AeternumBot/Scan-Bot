// src/commands/anunciar.js
// /anunciar — anuncio manual con mensaje personalizado, portada, créditos y roles

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Projects }  = require('../utils/storage');
const logger = require('../utils/logger');
const SUA = require('../utils/sua');
const { COLORS, SOURCES }    = require('../../config/config');
const announcer     = require('../services/announcer');
const tmo           = require('../services/tmoScraper');
const colorcito     = require('../services/colorcito');

const data = new SlashCommandBuilder()
  .setName('anunciar')
  .setDescription('Publica manualmente el anuncio de un capítulo')
  .addStringOption(o =>
    o.setName('proyecto').setDescription('Proyecto a anunciar').setRequired(true).setAutocomplete(true)
  )
  .addStringOption(o =>
    o.setName('capitulo').setDescription('Número de capítulo').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('mensaje').setDescription('Mensaje personalizado para el anuncio (opcional)')
  )
  .addStringOption(o =>
    o.setName('portada_url').setDescription('URL directa de la imagen de portada (clic derecho en la imagen → Copiar enlace)')
  )
  // Créditos por ID de usuario (se convertirán en @mención)
  .addStringOption(o => o.setName('traductores').setDescription('IDs de traductores separados por coma'))
  .addStringOption(o => o.setName('cleaners').setDescription('IDs de cleaners separados por coma'))
  .addStringOption(o => o.setName('typeos').setDescription('IDs de typeadores/finalizadores separados por coma'))
  .addStringOption(o => o.setName('otros_ids').setDescription('IDs de otros colaboradores separados por coma'))
  // Roles extra a mencionar (además del rol fijo del proyecto)
  .addStringOption(o =>
    o.setName('tmo_link').setDescription('Link directo del capítulo en TMO (opcional, sobreescribe el automático)')
  )
  .addRoleOption(o =>
    o.setName('rol').setDescription('Rol a mencionar en el anuncio (opcional, además de @everyone)')
  )
  .addStringOption(o =>
    o.setName('fuente')
      .setDescription('Fuente del capítulo')
      .addChoices(
        { name: '📖 TuMangaOnline', value: 'tmo'       },
        { name: '🎨 Colorcito',     value: 'colorcito'  },
        { name: '🔗 Ambas',         value: 'ambas'      },
      )
  );

async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = Projects.list()
      .filter(p => p.name.toLowerCase().includes(focused) || p.id.includes(focused))
      .slice(0, 25)
      .map(p => ({ name: `${p.name} [${p.id}]`, value: p.id }));
    await interaction.respond(choices);
  } catch { /* interacción expirada */ }
}

async function execute(interaction) {
  const ALLOWED_ROLE = process.env.ANNOUNCER_ROLE_ID;
  const hasRole = ALLOWED_ROLE
    ? interaction.member.roles.cache.has(ALLOWED_ROLE)
    : interaction.member.permissions.has('ManageGuild');
  if (!hasRole) {
    return interaction.reply({ content: SUA.sinPermisos, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const projectId   = interaction.options.getString('proyecto');
  const capNum      = interaction.options.getString('capitulo');
  const mensaje     = interaction.options.getString('mensaje') || null;
  const portadaUrl  = interaction.options.getString('portada_url') || null;
  const traductoresRaw = interaction.options.getString('traductores') || null;
  const cleanersRaw    = interaction.options.getString('cleaners') || null;
  const typeosRaw      = interaction.options.getString('typeos') || null;
  const otrosRaw       = interaction.options.getString('otros_ids') || null;
  const tmoLinkManual = interaction.options.getString('tmo_link') || null;
  const rolMencion  = interaction.options.getRole('rol') || null;
  const fuenteOpt   = interaction.options.getString('fuente') || 'ambas';

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.editReply({ content: SUA.proyecto.noEncontrado(projectId) });
  }

  // ── Construir datos del capítulo ─────────────────────────────────────────
  // Intentar obtener URL real del capítulo desde la fuente
  let chapterUrl = null;
  let chapterUrlTmo = null;
  let chapterUrlColor = null;

  if ((fuenteOpt === 'tmo' || fuenteOpt === 'ambas') && project.sources?.tmo) {
    const d = await tmo.getLatestChapter(project.sources.tmo);
    if (d) chapterUrlTmo = d.chapterUrl;
  }
  let isEcchi = false;
  if ((fuenteOpt === 'colorcito' || fuenteOpt === 'ambas') && project.sources?.colorcito) {
    const d = await colorcito.getLatestChapter(project.sources.colorcito);
    if (d) {
      chapterUrlColor = d.chapterUrl;
      if (d.isEcchi) isEcchi = true;
      logger.info('Anunciar', `Tags Colorcito: [${(d.tags||[]).join(', ')}] | isEcchi=${d.isEcchi}`);
    } else {
      logger.warn('Anunciar', 'Colorcito devolvió null — no se pudieron leer los tags');
    }
  }

  // portadaUrl ya es la URL directa — no hay nada que resolver

  const chapData = {
    chapterNum: capNum,
    chapterTitle: null,
    chapterUrl: tmoLinkManual || chapterUrlTmo || chapterUrlColor || null,
    thumbnail: portadaUrl || project.thumbnail || null,
    // TMO: usa el link manual si se proporcionó, si no el automático
    urlTmo: tmoLinkManual || chapterUrlTmo || null,
    // Colorcito: siempre usa la URL base del proyecto (sin /capitulo-N)
    urlColorcito: project.sources?.colorcito || chapterUrlColor || null,
  };

  // ── Construir créditos desde IDs de usuario ────────────────────────────
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

  // Si no se especificó nada, usar los créditos por defecto del proyecto
  if (!credits.length && project.defaultCredits) {
    credits.push(project.defaultCredits);
  }

  // ── Rol extra ────────────────────────────────────────────────────────────
  const extraRoles = rolMencion ? [rolMencion.id] : [];

  // ── Enviar anuncio ───────────────────────────────────────────────────────
  const channelId = project.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    return interaction.editReply({ content: SUA.anunciar.sinCanal });
  }

  // Añadir nota de Sua si el proyecto tiene tag Ecchi
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

  // Anti-repetición: guardar las últimas 5 frases usadas
  if (!global._ecchiUsadas) global._ecchiUsadas = [];
  const disponibles = ECCHI_FRASES.filter(f => !global._ecchiUsadas.includes(f));
  const pool = disponibles.length >= 5 ? disponibles : ECCHI_FRASES;
  const frase = pool[Math.floor(Math.random() * pool.length)];
  if (isEcchi) {
    global._ecchiUsadas.push(frase);
    if (global._ecchiUsadas.length > 5) global._ecchiUsadas.shift();
  }

  const ecchiNote = isEcchi ? ('\n\n*' + frase + '*') : '';

  const mensajeFinal = (mensaje || '') + ecchiNote;

  const message = await announcer.sendManualAnnouncement(
    interaction.client,
    project,
    chapData,
    { customMessage: mensajeFinal.trim() || null, imageUrl: portadaUrl, credits, extraRoles }
  );

  if (!message) {
    return interaction.editReply({ content: SUA.anunciar.errorEnvio });
  }

  await interaction.editReply({ content: SUA.anunciar.enviado(project.name, capNum) });
}

module.exports = { data, execute, autocomplete };
