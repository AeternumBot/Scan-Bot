// src/services/tmoScraper.js
// Scraper para TuMangaOnline / LectorTMO
// Usa axios + cheerio (sin browser headless) para mayor velocidad.

const axios   = require('axios');
const cheerio = require('cheerio');
const logger  = require('../utils/logger');

const BASE_URL = process.env.TMO_BASE_URL || 'https://lectortmo.com';

// Headers que imitan un navegador real para evitar bloqueos básicos
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Referer': BASE_URL,
};

/**
 * Obtiene el capítulo más reciente de un proyecto en TMO.
 * @param {string} projectUrl  URL de la página del manga en TMO
 * @returns {{ chapterNum, chapterTitle, chapterUrl, thumbnail, projectName } | null}
 */
async function getLatestChapter(projectUrl) {
  if (!projectUrl) return null;

  try {
    const { data: html } = await axios.get(projectUrl, {
      headers: HEADERS,
      timeout: 15000,
    });

    const $ = cheerio.load(html);

    // ── Nombre del proyecto ────────────────────────────────────────────────
    const projectName =
      $('h1.element-title').first().text().trim() ||
      $('h2.element-title').first().text().trim() ||
      $('title').text().split('|')[0].trim();

    // ── Portada ────────────────────────────────────────────────────────────
    const thumbnail =
      $('img.book-thumbnail').attr('src') ||
      $('div.book-thumbnail img').attr('src') ||
      $('aside img').first().attr('src') ||
      null;

    // ── Lista de capítulos ─────────────────────────────────────────────────
    // ZonaTMO usa <div class="card chapters" id="chapters"> con <li> por capítulo
    const chaptersRows = $('#chapters li, div.card.chapters li, ul.chapters li, div.chapters-list .chapter-item');

    if (!chaptersRows.length) {
      logger.warn('TMO', `No se encontraron capítulos en: ${projectUrl}`);
      return null;
    }

    // El primer elemento es el capítulo más reciente
    const firstRow = chaptersRows.first();

    // ZonaTMO estructura:
    // - Número en <a class="btn-collapse">: "Capítulo 19.00"
    // - Link en el botón play dentro del collapsible: <a href="/view_uploads/ID">
    // El firstRow es el <li> del capítulo, el link está en su collapsible hermano

    // Obtener el número del capítulo desde btn-collapse
    const chapterText =
      firstRow.find('a.btn-collapse').text().trim() ||
      firstRow.find('.chapter-title, .num-chapter, a').first().text().trim();

    // Obtener el ID del collapsible para buscar el link dentro
    const collapseBtn = firstRow.find('a.btn-collapse');
    const onclickAttr = collapseBtn.attr('onclick') || '';
    const collapseIdMatch = onclickAttr.match(/collapseChapter\('(collapsible\d+)'\)/);
    const collapseId = collapseIdMatch ? collapseIdMatch[1] : null;

    // Buscar el link de lectura dentro del div collapsible correspondiente
    // TMO usa /viewer/HASH/cascade como URL real del capítulo
    let chapterUrl = null;
    if (collapseId) {
      const collapseDiv = $(`#${collapseId}`);
      // Intentar primero el link /viewer/ (URL real navegable)
      chapterUrl = collapseDiv.find('a[href*="/viewer/"]').attr('href') ||
                   collapseDiv.find('a.btn[href*="/view_uploads/"]').attr('href') || null;
    }
    // Fallback: buscar en el li y el siguiente elemento
    if (!chapterUrl) {
      chapterUrl = firstRow.find('a[href*="/viewer/"]').attr('href') ||
                   firstRow.next().find('a[href*="/viewer/"]').attr('href') ||
                   firstRow.find('a[href*="/view_uploads/"]').attr('href') ||
                   firstRow.next().find('a[href*="/view_uploads/"]').attr('href') || null;
    }
    // Fallback final: buscar en toda la página el primer link /viewer/
    if (!chapterUrl) {
      chapterUrl = $('a[href*="/viewer/"]').first().attr('href') || null;
    }

    const chapterNumMatch = chapterText.match(/[\d]+(?:[.,]\d+)?/);
    const chapterNum = chapterNumMatch ? chapterNumMatch[0].replace(',', '.') : chapterText;

    // Título opcional
    const chapterTitle =
      firstRow.find('.chapter-name, .chapter-title-text').text().trim() || null;

    return {
      projectName,
      thumbnail: thumbnail ? (thumbnail.startsWith('http') ? thumbnail : BASE_URL + thumbnail) : null,
      chapterNum,
      chapterTitle,
      chapterUrl: chapterUrl
        ? (chapterUrl.startsWith('http') ? chapterUrl : BASE_URL + chapterUrl)
        : null,
      source: 'tmo',
    };

  } catch (err) {
    logger.error('TMO', `Error scrapeando ${projectUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Búsqueda de un manga en TMO por nombre.
 * Útil al configurar un proyecto nuevo con /proyecto add
 * @param {string} query
 * @returns {Array<{ name, url, thumbnail, type }>}
 */
async function searchManga(query) {
  try {
    const searchUrl = `${BASE_URL}/library?title=${encodeURIComponent(query)}&order_item=likes_count&order_dir=desc&type=manga,manhwa,manhua,novel,one_shot,doujinshi`;
    const { data: html } = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(html);

    const results = [];

    $('div.element, .book-element').each((_, el) => {
      const name  = $(el).find('.element-title, h4').first().text().trim();
      const href  = $(el).find('a').first().attr('href');
      const img   = $(el).find('img').first().attr('src') ||
                    $(el).find('img').first().attr('data-src');
      const type  = $(el).find('.book-type, .type-label').text().trim();

      if (name && href) {
        results.push({
          name,
          url: href.startsWith('http') ? href : BASE_URL + href,
          thumbnail: img ? (img.startsWith('http') ? img : BASE_URL + img) : null,
          type: type || 'manga',
        });
      }
    });

    return results.slice(0, 10); // máx 10 resultados
  } catch (err) {
    logger.error('TMO', `Error buscando "${query}": ${err.message}`);
    return [];
  }
}

module.exports = { getLatestChapter, searchManga };
