const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Optimizaciones de bajo nivel para Sharp (Ahorro de RAM en Railway)
sharp.cache(false); 
sharp.concurrency(1);

/**
 * Motor "Sua-Coser" (´｡• ᵕ •｡`)
 * Optimizado para consumir el mínimo de RAM mediante Virtual Mapping y Composite.
 */
class SuaCoser {
    constructor(options = {}) {
        this.enforceWidth = options.enforceWidth || 720;
        this.splitHeight = options.splitHeight || 10000;
        this.outputFormat = options.outputFormat || 'jpg';
        this.quality = options.quality || 85; // Bajamos un poco para ahorrar RAM/Espacio
        this.sensitivity = options.sensitivity || 15;
        this.scanStep = options.scanStep || 8; // Más rápido el escaneo
    }

    /**
     * Procesa una lista de rutas de archivos de imagen en disco.
     * @param {string[]} imagePaths 
     * @returns {Promise<Buffer[]>} Recortes finales
     */
    async process(imagePaths) {
        if (!imagePaths || imagePaths.length === 0) return [];

        console.log(`[Sua-Coser] ¡Empezando a coser ${imagePaths.length} imágenes! (o^▽^o)`);

        // 1. Mapeo Virtual: Calculamos dónde iría cada imagen sin cargarlas en RAM
        const virtualMap = [];
        let totalHeight = 0;

        for (const imgPath of imagePaths) {
            try {
                const metadata = await sharp(imgPath).metadata();
                const scale = this.enforceWidth / metadata.width;
                const resizedHeight = Math.round(metadata.height * scale);

                virtualMap.push({
                    path: imgPath,
                    originalWidth: metadata.width,
                    originalHeight: metadata.height,
                    resizedHeight: resizedHeight,
                    yStart: totalHeight,
                    yEnd: totalHeight + resizedHeight
                });

                totalHeight += resizedHeight;
            } catch (e) {
                console.warn(`[Sua-Coser] Omitiendo imagen corrupta: ${imgPath}`);
            }
        }

        console.log(`[Sua-Coser] Altura virtual total: ${totalHeight}px. Buscando dónde cortar con mis tijeras...`);

        // 2. Búsqueda de puntos de corte (Smart Slicing Virtual)
        const slicePoints = [0];
        let currentY = 0;

        while (currentY + this.splitHeight < totalHeight) {
            let targetY = currentY + this.splitHeight;
            let foundSafeCut = false;

            // Escaneamos hacia arriba desde targetY buscando una línea uniforme
            const searchLimit = Math.max(currentY + 2000, targetY - 3000);
            
            for (let y = targetY; y >= searchLimit; y -= this.scanStep) {
                if (await this._isVirtualLineUniform(virtualMap, y)) {
                    targetY = y;
                    foundSafeCut = true;
                    break;
                }
            }

            if (!foundSafeCut) {
                console.log(`[Sua-Coser] (;ω;) No encontré un lugar bonito para cortar cerca de ${targetY}px, ¡lo siento! Usaré tijeras a la fuerza.`);
            }

            slicePoints.push(targetY);
            currentY = targetY;
        }
        
        slicePoints.push(totalHeight);

        // 3. Generación de Recortes mediante Composición (Stream-like)
        console.log(`[Sua-Coser] ¡Listo! Generando ${slicePoints.length - 1} recortes finales...`);
        const finalSlices = [];

        for (let i = 0; i < slicePoints.length - 1; i++) {
            const startY = slicePoints[i];
            const endY = slicePoints[i + 1];
            const sliceHeight = endY - startY;

            // Encontramos qué imágenes originales participan en este recorte
            const overlappingImages = virtualMap.filter(img => 
                img.yEnd > startY && img.yStart < endY
            );

            // Creamos la composición para este fragmento
            const composites = await Promise.all(overlappingImages.map(async (img) => {
                // Calculamos qué parte de la imagen original necesitamos extraer
                const scale = img.resizedHeight / img.originalHeight;
                
                // Coordenadas relativas de la sección en la imagen RE-ESCALADA
                const localYStart = Math.max(0, startY - img.yStart);
                const localYEnd = Math.min(img.resizedHeight, endY - img.yStart);
                const localHeight = localYEnd - localYStart;

                // Coordenadas en la imagen ORIGINAL (para el .extract de sharp)
                const extractTop = Math.floor(localYStart / scale);
                const extractHeight = Math.ceil(localHeight / scale);

                // Evitamos errores de redondeo que se salgan de la imagen original
                const safeExtractHeight = Math.min(extractHeight, img.originalHeight - extractTop);

                // Extraemos y redimensionamos solo el trozo necesario
                const partBuffer = await sharp(img.path)
                    .extract({ left: 0, top: extractTop, width: img.originalWidth, height: safeExtractHeight })
                    .resize({ width: this.enforceWidth, height: localHeight, fit: 'fill' })
                    .toBuffer();

                return {
                    input: partBuffer,
                    top: Math.max(0, img.yStart - startY),
                    left: 0
                };
            }));

            // Creamos el lienzo base para el recorte y pegamos los trozos
            const sliceBuffer = await sharp({
                create: {
                    width: this.enforceWidth,
                    height: sliceHeight,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            })
            .composite(composites)
            .toFormat(this.outputFormat, { quality: this.quality })
            .toBuffer();

            finalSlices.push(sliceBuffer);
            console.log(`[Sua-Coser] Fragmento ${i + 1} terminado (${sliceHeight}px).`);
        }

        return finalSlices;
    }

    /**
     * Revisa si una línea horizontal virtual es uniforme extrayendo solo 1px de la imagen necesaria.
     */
    async _isVirtualLineUniform(virtualMap, targetY) {
        // Encontramos qué imagen contiene esta línea Y
        const img = virtualMap.find(m => targetY >= m.yStart && targetY < m.yEnd);
        if (!img) return true;

        const scale = img.resizedHeight / img.originalHeight;
        const localY = Math.floor((targetY - img.yStart) / scale);

        try {
            // Extraemos solo una fila de 1 píxel de alto de la imagen original
            const rowBuffer = await sharp(img.path)
                .extract({ left: 0, top: localY, width: img.originalWidth, height: 1 })
                .raw()
                .toBuffer();

            // Análisis de uniformidad (mismo algoritmo pero sobre un buffer minúsculo)
            const refR = rowBuffer[0];
            const refG = rowBuffer[1];
            const refB = rowBuffer[2];
            const channels = rowBuffer.length / img.originalWidth;

            for (let x = 0; x < img.originalWidth; x++) {
                const idx = x * channels;
                const diff = Math.abs(refR - rowBuffer[idx]) + 
                             Math.abs(refG - rowBuffer[idx + 1]) + 
                             Math.abs(refB - rowBuffer[idx + 2]);
                
                if (diff > this.sensitivity) return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }
}

module.exports = SuaCoser;
