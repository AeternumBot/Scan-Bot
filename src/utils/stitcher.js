const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

/**
 * Une múltiples imágenes verticalmente y luego las recorta inteligentemente
 * basándose en una altura máxima elegida, asegurándose de no cortar
 * a la mitad de un dibujo buscando un espacio horizontal continuo sin variaciones.
 */
class SmartStitcher {
    constructor(options = {}) {
        this.enforceWidth = options.enforceWidth || 720;
        this.splitHeight = options.splitHeight || 10000;
        this.outputFormat = options.outputFormat || 'jpg';
        this.quality = options.quality || 90;
        
        // Sensibilidad: Cuánto puede variar un pixel en la fila para seguir considerándola "blanca" o "negra" o uniforme.
        // Entre más alto, más estricto. (Rango 0-255 de diferencia)
        this.sensitivity = options.sensitivity || 10;
        
        // Scan step: Cuántos pixeles saltamos al escanear para hacerlo más rápido
        this.scanStep = options.scanStep || 5;
    }

    /**
     * Procesa un array de buffers de imagen.
     * @param {Buffer[]} imageBuffers 
     * @returns {Promise<Buffer[]>} Las imágenes resultantes recortadas
     */
    async process(imageBuffers) {
        if (!imageBuffers || imageBuffers.length === 0) return [];

        console.log(`[SmartStitch] Iniciando procesamiento de ${imageBuffers.length} imágenes...`);
        
        // 1. Redimensionar imágenes al ancho unificado
        const resizedImages = [];
        let totalHeight = 0;

        for (const buf of imageBuffers) {
            const metadata = await sharp(buf).metadata();
            
            // Calculamos la nueva altura manteniendo la relación de aspecto
            const aspectRatio = metadata.width / metadata.height;
            const newHeight = Math.round(this.enforceWidth / aspectRatio);

            const resizedBuf = await sharp(buf)
                .resize({ width: this.enforceWidth })
                // Convertimos el frame a raw buffer (RGB) para poder inspeccionarlo fácilmente
                .raw()
                .toBuffer({ resolveWithObject: true });

            resizedImages.push({
                buffer: resizedBuf.data,
                info: resizedBuf.info
            });

            totalHeight += resizedBuf.info.height;
        }

        console.log(`[SmartStitch] Altura total combinada: ${totalHeight}px`);

        // 2. Concatenar todo en un gran buffer "crudo" (Raw RGB)
        const channels = 3; // Suponemos RGB (sin alpha para la matemática)
        const stitchedRawBuffer = Buffer.alloc(this.enforceWidth * totalHeight * channels);
        
        let currentOffset = 0;
        for (const img of resizedImages) {
            img.buffer.copy(stitchedRawBuffer, currentOffset);
            currentOffset += img.buffer.length;
        }

        // 3. Fase de Recorte Inteligente (Smart Slicing)
        console.log(`[SmartStitch] Iniciando recorte inteligente (Altura Max: ${this.splitHeight}px)`);
        const finalImages = [];
        let sliceStartPoint = 0;

        while (sliceStartPoint < totalHeight) {
            let sliceEndPoint = sliceStartPoint + this.splitHeight;
            let foundSafeCut = false;

            if (sliceEndPoint >= totalHeight) {
                // Si la última porción es menor que el máximo, cortamos hasta el final directamente.
                sliceEndPoint = totalHeight;
                foundSafeCut = true;
            } else {
                // Buscamos una línea segura "hacia arriba" desde el límite (sliceEndPoint)
                // Usamos scanStep para saltarnos algunas líneas y no hacerlo super lento
                const searchLimit = Math.max(sliceStartPoint, sliceEndPoint - 3000); // Buscar hasta 3000px hacia arriba
                
                for (let y = sliceEndPoint; y >= searchLimit; y -= this.scanStep) {
                    if (this._isLineUniform(stitchedRawBuffer, this.enforceWidth, y, channels)) {
                        sliceEndPoint = y;
                        foundSafeCut = true;
                        break;
                    }
                }

                // Fallback: Si no encontró una línea limpia (ej. una ilustración gigante)
                if (!foundSafeCut) {
                    console.log(`[SmartStitch] Advertencia: No se encontró corte seguro cerca de ${sliceEndPoint}. Forzando corte.`);
                }
            }

            const currentSliceHeight = sliceEndPoint - sliceStartPoint;
            
            // Extraer la porción cruda
            const sliceStartByte = sliceStartPoint * this.enforceWidth * channels;
            const sliceEndByte = sliceEndPoint * this.enforceWidth * channels;
            const sliceBuffer = stitchedRawBuffer.subarray(sliceStartByte, sliceEndByte);

            // Reconvertir la porción cruda a JPG/Webp usando sharp
            const finalImageBuf = await sharp(sliceBuffer, {
                raw: {
                    width: this.enforceWidth,
                    height: currentSliceHeight,
                    channels: channels
                }
            })
            .toFormat(this.outputFormat, { quality: this.quality })
            .toBuffer();

            finalImages.push(finalImageBuf);
            console.log(`[SmartStitch] Creado fragmento de ${currentSliceHeight}px de alto.`);

            sliceStartPoint = sliceEndPoint;
        }

        return finalImages;
    }

    /**
     * Revisa si una fila horizontal (línea de pixeles) es de un color uniforme (segura para cortar)
     */
    _isLineUniform(buffer, width, yIndex, channels) {
        const rowStartIndex = yIndex * width * channels;
        let isUniform = true;

        // Tomamos el primer pixel de referencia para la fila completa
        const refR = buffer[rowStartIndex];
        const refG = buffer[rowStartIndex + 1];
        const refB = buffer[rowStartIndex + 2];

        // Revisamos cada pixel de la fila
        for (let x = 0; x < width; x++) {
            const pxIndex = rowStartIndex + (x * channels);
            const r = buffer[pxIndex];
            const g = buffer[pxIndex + 1];
            const b = buffer[pxIndex + 2];

            // Calculamos la diferencia aproximada de color
            const diff = Math.abs(refR - r) + Math.abs(refG - g) + Math.abs(refB - b);

            if (diff > this.sensitivity) {
                 // Demasiada variación de color en esta fila, significa que hay dibujo o letras
                isUniform = false;
                break;
            }
        }

        return isUniform;
    }
}

module.exports = SmartStitcher;
