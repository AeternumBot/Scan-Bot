// src/commands/raws.js
// Sistema de subida de raws a Google Drive.
//
// Flujo de /raws (escucha pasiva en el canal configurado):
//   El usuario sube un .zip con nombre "NombreProyecto - NumeroCapitulo.zip"
//   Sua lo descarga, descomprime en memoria, sube las imágenes a Drive
//   en la carpeta Raw del capítulo correspondiente.
//
// Comandos slash:
//   /raws espacio           → muestra el uso de almacenamiento de Drive
//   /raws eliminar          → borra carpetas Raw de un proyecto

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ChannelType,
} = require('discord.js');

const AdmZip          = require('adm-zip');
const path            = require('path');
const { Projects }    = require('../utils/storage');
const drive           = require('../services/driveService');
const logger          = require('../utils/logger');
const { COLORS }      = require('../../config/config');

// ── MIME types aceptados como imágenes ────────────────────────────────────────
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MIME_MAP   = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

// ── Slash command ─────────────────────────────────────────────────────────────
const data = new SlashCommandBuilder()
  .setName('raws')
  .setDescription('Gestión de raws en Google Drive')
  .addSubcommand(sub =>
    sub.setName('espacio')
      .setDescription('Muestra el uso actual de almacenamiento de Drive')
  )
  .addSubcommand(sub =>
    sub.setName('eliminar')
      .setDescription('Elimina carpetas Raw de los capítulos de un proyecto')
      .addStringOption(o =>
        o.setName('proyecto')
          .setDescription('ID del proyecto')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(o =>
        o.setName('capitulos')
          .setDescription('Números de capítulo separados por coma (vacío = todos). Ej: 01,02,05')
      )
  );

// ── Autocomplete ──────────────────────────────────────────────────────────────
async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = Projects.list()
    .filter(p => p.name.toLowerCase().includes(focused) || p.id.includes(focused))
    .slice(0, 25)
    .map(p => ({ name: `${p.name} (${p.id})`, value: p.id }));
  await interaction.respond(choices);
}

// ── Execute ───────────────────────────────────────────────────────────────────
async function execute(interaction) {
  if (!interaction.member.permissions.has('ManageGuild')) {
    return interaction.reply({
      content: '❌ Necesitas el permiso **Gestionar Servidor** para usar `/raws`.',
      ephemeral: true,
    });
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'espacio')  return handleEspacio(interaction);
  if (sub === 'eliminar') return handleEliminar(interaction);
}

// ── /raws espacio ─────────────────────────────────────────────────────────────
async function handleEspacio(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const { used, limit, percent } = await drive.getStorageUsage();

    const fmt = bytes => {
      if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
      if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
      return `${(bytes / 1e3).toFixed(0)} KB`;
    };

    const bar  = buildBar(percent);
    const color = percent >= 95 ? COLORS.error
                : percent >= 80 ? COLORS.warning
                : COLORS.success;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('📦 Almacenamiento de Google Drive')
      .setDescription(`${bar} **${percent}%**`)
      .addFields(
        { name: '🗂️ Usado',      value: fmt(used),              inline: true },
        { name: '💾 Límite',     value: limit > 0 ? fmt(limit) : 'Sin límite', inline: true },
        { name: '📊 Estado',     value: percent >= 95 ? '🔴 Crítico' : percent >= 80 ? '🟡 Atención' : '🟢 Normal', inline: true },
      )
      .setTimestamp();

    if (percent >= 95) {
      embed.addFields({ name: '⚠️ Advertencia', value: 'El almacenamiento está casi lleno. Considera limpiar Raws antiguas con `/raws eliminar`.' });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    await interaction.editReply(`❌ Error consultando Drive: ${err.message}`);
  }
}

// ── /raws eliminar ────────────────────────────────────────────────────────────
async function handleEliminar(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectId = interaction.options.getString('proyecto');
  const capsRaw   = interaction.options.getString('capitulos') || '';

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.editReply(`❌ Proyecto \`${projectId}\` no encontrado.`);
  }

  // Parsear lista de capítulos si se proporcionó
  const chapterNums = capsRaw
    ? capsRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const target = chapterNums.length > 0
    ? `capítulos: ${chapterNums.join(', ')}`
    : 'todos los capítulos';

  await interaction.editReply(`🔄 Eliminando Raws de **${project.name}** (${target})...`);

  try {
    const result = await drive.deleteRawsFromProject(
      project.driveFolder || project.name,
      project.category,
      chapterNums
    );

    const lines = [
      `✅ Raws eliminadas de **${project.name}**`,
      `📁 Capítulos procesados: ${result.deleted + result.skipped}`,
      `🗑️ Carpetas Raw eliminadas: **${result.deleted}**`,
      `⏭️ Sin carpeta Raw (omitidos): ${result.skipped}`,
    ];

    if (result.errors.length) {
      lines.push(`⚠️ Errores (${result.errors.length}): ${result.errors.slice(0, 3).join(', ')}`);
    }

    await interaction.editReply(lines.join('\n'));

  } catch (err) {
    await interaction.editReply(`❌ Error eliminando Raws: ${err.message}`);
  }
}

// ── Procesamiento de zips (llamado desde el evento de mensajes) ───────────────

/**
 * Procesa un mensaje con adjunto .zip en el canal de raws.
 * Descarga, descomprime, sube a Drive y responde con resumen.
 *
 * @param {import('discord.js').Message} message
 */
async function processRawsUpload(message) {
  const attachment = message.attachments.find(a =>
    a.name && a.name.toLowerCase().endsWith('.zip')
  );

  if (!attachment) return; // no hay zip, ignorar

  const rawsChannelId = process.env.RAWS_CHANNEL_ID;
  if (!rawsChannelId || message.channelId !== rawsChannelId) return;

  // Solo staff con permisos
  if (!message.member || !message.member.permissions.has('ManageMessages')) return;

  // Parsear nombre del zip: "NombreProyecto - NumeroCapitulo.zip"
  const parsed = parseZipName(attachment.name);
  if (!parsed) {
    await message.reply(
      `❌ Nombre de archivo inválido: \`${attachment.name}\`\n` +
      `Formatos aceptados:\n` +
      `▸ \`NombreProyecto - NumeroCapitulo.zip\`\n` +
      `▸ \`NombreProyecto_NumeroCapitulo.zip\`\n` +
      `▸ \`NombreProyecto-NumeroCapitulo.zip\`\n` +
      `Ejemplo: \`La_Joven_Rebelde_31.zip\` o \`Sin Reinicio - 07.zip\``
    );
    return;
  }

  const { projectName, chapterNum } = parsed;

  // Buscar el proyecto por nombre (comparación insensible a mayúsculas)
  const projects = Projects.list();
  const project  = projects.find(p =>
    p.name.toLowerCase() === projectName.toLowerCase() ||
    (p.driveFolder && p.driveFolder.toLowerCase() === projectName.toLowerCase())
  );

  if (!project) {
    await message.reply(
      `❌ No encontré un proyecto llamado **\`${projectName}\`** en el bot.\n` +
      `Verifica que el nombre en el archivo coincida exactamente con el nombre registrado en \`/proyecto list\`.`
    );
    return;
  }

  // Indicador de procesamiento
  const typing = await message.channel.sendTyping().catch(() => {});
  let statusMsg;

  try {
    statusMsg = await message.reply(`⏳ Procesando \`${attachment.name}\`... descargando`);

    // 1. Descargar el zip
    const zipBuffer = await downloadAttachment(attachment.url);
    await statusMsg.edit(`⏳ Procesando \`${attachment.name}\`... descomprimiendo`);

    // 2. Descomprimir en memoria y extraer imágenes
    const images = extractImagesFromZip(zipBuffer, attachment.name);

    if (!images.length) {
      await statusMsg.edit(
        `❌ No encontré imágenes válidas en \`${attachment.name}\`.\n` +
        `Formatos aceptados: ${[...IMAGE_EXTS].join(', ')}`
      );
      return;
    }

    await statusMsg.edit(`⏳ Subiendo ${images.length} imágenes a Drive...`);

    // 3. Subir a Drive
    const result = await drive.uploadRawImages(
      project.driveFolder || project.name,
      project.category,
      chapterNum,
      images
    );

    // 4. Construir respuesta
    const embed = buildUploadEmbed(project, chapterNum, images.length, result);
    await statusMsg.edit({ content: '', embeds: [embed] });

    // 5. Loguear en canal de registros
    await logger.discord(
      message.client,
      'info',
      'Raws',
      `📦 **${project.name}** cap. ${chapterNum} — ${result.uploaded}/${images.length} imágenes subidas por <@${message.author.id}>`
    );

    // 6. Alerta de almacenamiento si corresponde
    if (result.storageWarning) {
      const recordsCh = process.env.RECORDS_CHANNEL_ID;
      if (recordsCh) {
        const warnEmbed = new EmbedBuilder()
          .setColor(COLORS.error)
          .setTitle('⚠️ Almacenamiento de Drive casi lleno')
          .setDescription(
            `El almacenamiento está al **${result.storagePercent}%** después de subir las Raws de **${project.name}** cap. ${chapterNum}.\n` +
            `Considera limpiar Raws antiguas con \`/raws eliminar\`.`
          )
          .setTimestamp();

        try {
          const ch = await message.client.channels.fetch(recordsCh);
          await ch.send({ embeds: [warnEmbed] });
        } catch { }
      }
    }

  } catch (err) {
    logger.error('Raws', `Error procesando zip: ${err.message}`);
    const errMsg = `❌ Error procesando \`${attachment.name}\`: ${err.message}`;
    if (statusMsg) await statusMsg.edit(errMsg).catch(() => message.reply(errMsg));
    else await message.reply(errMsg);
  }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * Parsea el nombre del zip y devuelve { projectName, chapterNum } o null.
 * Formato: "NombreProyecto - NumeroCapitulo.zip"
 * También acepta: "NombreProyecto-NumeroCapitulo.zip" (sin espacios)
 */
function parseZipName(filename) {
  // Normalizar guiones bajos a espacios: Discord (o algunos SO) reemplaza
  // los espacios del nombre de archivo con '_' al subir el adjunto.
  // «La_Joven_Rebelde_-_31.zip» → «La Joven Rebelde - 31.zip»
  // «La_Joven_Rebelde_31.zip»   → «La Joven Rebelde 31»
  const normalized = path.basename(filename, '.zip')
    .replace(/_/g, ' ')
    .trim();

  // Patrón 1 — separador con espacios: "Nombre - 07"
  const matchSpaced = normalized.match(/^(.+?)\s+-\s+(\d+(?:\.\d+)?)$/);
  if (matchSpaced) {
    return {
      projectName: matchSpaced[1].trim(),
      chapterNum:  matchSpaced[2].trim(),
    };
  }

  // Patrón 2 — separador con guión sin espacios: "Nombre-07"
  const matchDash = normalized.match(/^(.+?)-(\d+(?:\.\d+)?)$/);
  if (matchDash) {
    return {
      projectName: matchDash[1].trim(),
      chapterNum:  matchDash[2].trim(),
    };
  }

  // Patrón 3 — solo espacio antes del número: "Nombre 07"
  // Cubre el caso La_Joven_Rebelde_31 → «La Joven Rebelde 31»
  const matchSpace = normalized.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
  if (matchSpace) {
    return {
      projectName: matchSpace[1].trim(),
      chapterNum:  matchSpace[2].trim(),
    };
  }

  return null;
}

/**
 * Descarga un archivo desde una URL y devuelve un Buffer.
 */
async function downloadAttachment(url) {
  const https = require('https');
  const http  = require('http');

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const chunks   = [];

    protocol.get(url, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} al descargar el archivo`));
      }
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Descomprime un zip desde un Buffer y devuelve solo las imágenes.
 * @returns {Array<{name: string, buffer: Buffer, mimeType: string}>}
 */
function extractImagesFromZip(zipBuffer, zipName) {
  let zip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch (err) {
    throw new Error(`No se pudo leer el zip: ${err.message}`);
  }

  const entries  = zip.getEntries();
  const images   = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // Ignorar archivos de sistema (macOS, etc.)
    const entryName = entry.entryName;
    if (entryName.includes('__MACOSX') || path.basename(entryName).startsWith('.')) continue;

    const ext = path.extname(entryName).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;

    const buffer   = entry.getData();
    const mimeType = MIME_MAP[ext] || 'application/octet-stream';
    const name     = path.basename(entryName); // Solo el nombre del archivo, sin rutas internas

    images.push({ name, buffer, mimeType });
  }

  // Ordenar por nombre para mantener el orden de páginas
  images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return images;
}

/**
 * Construye el embed de respuesta tras una subida exitosa.
 */
function buildUploadEmbed(project, chapterNum, totalImages, result) {
  const successRate = Math.round((result.uploaded / totalImages) * 100);

  const embed = new EmbedBuilder()
    .setColor(result.uploaded === totalImages ? COLORS.success : COLORS.warning)
    .setTitle(`📦 Raws subidas — ${project.name}`)
    .addFields(
      { name: '📁 Proyecto',    value: project.name,         inline: true },
      { name: '🔢 Capítulo',    value: `Cap. ${chapterNum}`, inline: true },
      { name: '🖼️ Imágenes',   value: `${result.uploaded}/${totalImages}`, inline: true },
    )
    .setTimestamp();

  if (result.chapterCreated) {
    embed.addFields({ name: '🆕 Carpeta creada', value: `Se creó la carpeta del capítulo \`${chapterNum}\` en Drive.`, inline: false });
  }

  if (result.foldersCreated && result.foldersCreated.length > 0) {
    embed.addFields({ name: '📂 Subcarpetas creadas', value: result.foldersCreated.join(', '), inline: false });
  }

  if (result.uploaded < totalImages) {
    embed.addFields({
      name: '⚠️ Advertencia',
      value: `${totalImages - result.uploaded} imagen(es) no se pudieron subir. Revisa los logs para más detalles.`,
    });
  }

  if (result.storageWarning) {
    embed.addFields({
      name: '🔴 Almacenamiento crítico',
      value: `Drive está al **${result.storagePercent}%**. Se ha notificado al canal de registros.`,
    });
  }

  embed.addFields({
    name: '🔗 Ver en Drive',
    value: `[Abrir carpeta](https://drive.google.com/drive/folders/${result.chapterFolderId})`,
  });

  return embed;
}

/**
 * Genera una barra de progreso ASCII para el porcentaje de almacenamiento.
 */
function buildBar(percent, length = 10) {
  const filled = Math.round((percent / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

module.exports = { data, execute, autocomplete, processRawsUpload };
