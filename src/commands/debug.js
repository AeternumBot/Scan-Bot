// src/commands/debug.js — comando temporal de diagnóstico de Drive
const { SlashCommandBuilder } = require('discord.js');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs-extra');

const data = new SlashCommandBuilder()
  .setName('debug')
  .setDescription('Diagnóstico de conexión con Google Drive (solo admins)');

async function execute(interaction) {
  if (!interaction.member.permissions.has('ManageGuild')) {
    return interaction.reply({ content: '❌ Sin permisos.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const keyValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './config/google-credentials.json';
    let auth;

    if (keyValue.trim().startsWith('{')) {
      const credentials = JSON.parse(keyValue);
      auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    } else {
      const keyPath = path.resolve(keyValue);
      if (!fs.existsSync(keyPath)) {
        return interaction.editReply(`❌ Archivo de credenciales NO encontrado en:\n\`${keyPath}\``);
      }
      auth = new google.auth.GoogleAuth({ keyFile: keyPath, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    }
    const drive = google.drive({ version: 'v3', auth });

    const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
    if (!rootId) return interaction.editReply('❌ GDRIVE_ROOT_FOLDER_ID no configurado.');

    // Listar carpetas en la raíz
    const res = await drive.files.list({
      q: `'${rootId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name)',
      pageSize: 50,
    });

    const folders = res.data.files || [];

    if (!folders.length) {
      return interaction.editReply(
        `✅ Credenciales OK, carpeta raíz encontrada.\n\n` +
        `⚠️ Pero no hay subcarpetas visibles dentro de la carpeta raíz.\n` +
        `Verifica que compartiste la carpeta correcta con la cuenta de servicio.`
      );
    }

    const lista = folders.map(f => `📁 \`${f.name}\` — ID: \`${f.id}\``).join('\n');

    await interaction.editReply(
      `✅ Conexión con Drive OK\n\n` +
      `**Carpetas encontradas dentro de la raíz:**\n${lista}\n\n` +
      `Si ves las categorías (Manhwas, Mangas, etc.) aquí arriba, la conexión funciona correctamente.`
    );

  } catch (err) {
    await interaction.editReply(`❌ Error conectando con Drive:\n\`\`\`${err.message}\`\`\``);
  }
}

module.exports = { data, execute };
