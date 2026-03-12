// src/index.js — Punto de entrada principal del bot
require('dotenv').config();

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const fs     = require('fs');
const path   = require('path');
const logger = require('./utils/logger');

// ── Validar variables de entorno mínimas ──────────────────────────────────────
const REQUIRED_ENV = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);

if (missing.length) {
  console.error(`\n❌ Variables de entorno faltantes: ${missing.join(', ')}`);
  console.error('   Copia .env.example → .env y completa los valores.\n');
  process.exit(1);
}

// ── Crear cliente de Discord ──────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,

  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

client.commands = new Collection();

// ── Cargar comandos ───────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    logger.info('Loader', `Comando cargado: /${command.data.name}`);
  } else {
    logger.warn('Loader', `Archivo de comando inválido: ${file}`);
  }
}

// ── Cargar eventos ────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  logger.info('Loader', `Evento cargado: ${event.name}`);
}

// ── Reaction Roles ───────────────────────────────────────────────────────────
const reactionRoles = require('./events/reactionRoles');
client.on('messageReactionAdd',    (reaction, user) => reactionRoles.handleReaction(reaction, user, true));
client.on('messageReactionRemove', (reaction, user) => reactionRoles.handleReaction(reaction, user, false));

// ── Manejo de errores globales ────────────────────────────────────────────────
client.on('error', err => logger.error('Discord', err.message));
client.on('warn',  msg => logger.warn('Discord', msg));

process.on('unhandledRejection', (reason) => {
  logger.error('Process', `Unhandled rejection: ${reason}`);
});

process.on('SIGINT', () => {
  logger.info('Process', 'Cerrando bot...');
  client.destroy();
  process.exit(0);
});

// ── Login ─────────────────────────────────────────────────────────────────────
logger.info('Bot', 'Iniciando bot...');
client.login(process.env.DISCORD_TOKEN).catch(err => {
  logger.error('Bot', `Error de login: ${err.message}`);
  process.exit(1);
});
