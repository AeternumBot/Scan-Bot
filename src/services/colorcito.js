// src/services/colorcito.js
// Scraper para Colorcito.com (manhwas en color)

const axios   = require('axios');
const cheerio = require('cheerio');
const logger  = require('../utils/logger');

const BASE_URL = process.env.COLORCITO_BASE_URL || 'https://colorcito.com';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.google.com/',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'cross-site',
  'upgrade-insecure-requests': '1',
  'Cache-Control': 'max-age=0',
};

/**
 * Obtiene el capítulo más reciente de un proyecto en Colorcito.
 * @param {string} projectUrl  URL de la página del manga en Colorcito
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
      $('h1').first().text().trim() ||
      $('title').text().split('–')[0].trim();

    // ── Portada ────────────────────────────────────────────────────────────
    const thumbnail =
      $('img.wp-post-image, img.img-thumbnail, .summary_image img').first().attr('src') ||
      $('div.thumb img').first().attr('src') ||
      null;

    // ── Capítulos ──────────────────────────────────────────────────────────
    // Colorcitoscan usa links con href="/ver/proyecto/capitulo-N"
    // Selector: todos los <a> que contengan "/capitulo-" en el href
    const chapterLinks = $('a[href*="/capitulo-"]');

    if (!chapterLinks.length) {
      // Fallback para otros temas WordPress
      const fallback = $('ul.version-chap li a, div.chapter-link a, li.wp-manga-chapter a, .chapters-list li a');
      if (!fallback.length) {
        logger.warn('Colorcito', `No se encontraron capítulos en: ${projectUrl}`);
        return null;
      }
      const firstFallback = fallback.first();
      const rawTextFallback = firstFallback.text().trim();
      const matchFallback = rawTextFallback.match(/[\d]+(?:[.,]\d+)?/);
      return {
        projectName,
        thumbnail,
        chapterNum: matchFallback ? matchFallback[0].replace(',', '.') : rawTextFallback,
        chapterTitle: null,
        chapterUrl: firstFallback.attr('href'),
        source: 'colorcito',
      };
    }

    // Ordenar por número de capítulo descendente y tomar el mayor
    let highestNum = -1;
    let firstLink = null;

    chapterLinks.each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/capitulo-([\d]+(?:[.,]\d+)?)/i);
      if (match) {
        const num = parseFloat(match[1].replace(',', '.'));
        if (num > highestNum) {
          highestNum = num;
          firstLink = $(el);
        }
      }
    });

    if (!firstLink) {
      logger.warn('Colorcito', `No se pudo determinar el capítulo más reciente en: ${projectUrl}`);
      return null;
    }

    const chapterUrl = firstLink.attr('href') || null;

    // Intentar obtener número del title o del href
    const titleAttr = firstLink.attr('title') || '';
    const titleMatch = titleAttr.match(/Cap\.?\s*([\d]+(?:[.,]\d+)?)/i);
    const chapterNum = titleMatch
      ? titleMatch[1].replace(',', '.')
      : String(highestNum);

    // ── Tags / Géneros ────────────────────────────────────────────────────
    // Intentar segunda petición para los tags si no se encontraron en la primera
    let tagsHtml = html;
    const tagsInPage = $('a[href*="gender="]').length;
    if (!tagsInPage) {
      try {
        await new Promise(r => setTimeout(r, 1500));
        const res2 = await axios.get(projectUrl, { headers: HEADERS, timeout: 15000 });
        tagsHtml = res2.data;
      } catch { /* usar html original */ }
    }
    const $t = require('cheerio').load(tagsHtml);
    const tags = [];
    $t('a[href*="gender="]').each((_, el) => {
      const tag = $t(el).text().trim();
      if (tag) tags.push(tag.toLowerCase());
    });
    const isEcchi = tags.some(t => t.includes('ecchi') || t.includes('erotico') || t.includes('adulto'));

    return {
      projectName,
      thumbnail,
      chapterNum,
      chapterTitle: null,
      chapterUrl: chapterUrl
        ? (chapterUrl.startsWith('http') ? chapterUrl : BASE_URL + chapterUrl)
        : null,
      source: 'colorcito',
      tags,
      isEcchi,
    };

  } catch (err) {
    logger.error('Colorcito', `Error scrapeando ${projectUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Búsqueda en Colorcito por nombre.
 */
async function searchManga(query) {
  try {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
    const { data: html } = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(html);

    const results = [];
    $('div.c-tabs-item__content, .c-image-hover').each((_, el) => {
      const name  = $(el).find('h4 a, .post-title a').first().text().trim();
      const href  = $(el).find('h4 a, .post-title a').first().attr('href');
      const img   = $(el).find('img').first().attr('src') ||
                    $(el).find('img').first().attr('data-src');

      if (name && href) results.push({ name, url: href, thumbnail: img || null });
    });

    return results.slice(0, 10);
  } catch (err) {
    logger.error('Colorcito', `Error buscando "${query}": ${err.message}`);
    return [];
  }
}

module.exports = { getLatestChapter, searchManga };
