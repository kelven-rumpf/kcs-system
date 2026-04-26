// js/services/sectorDirectory.js

import { SECTORS } from '../config.js';
import { getCustomSectorsFromCloud } from '../auth.js';

let cachedSectors = null;

function normalize(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export async function getAllSectors() {
    if (cachedSectors) return cachedSectors;

    try {
        const custom = await getCustomSectorsFromCloud();

        const merged = [...SECTORS];

        custom.forEach(c => {
            const exists = merged.some(s => normalize(s.id) === normalize(c.id));
            if (!exists) merged.push(c);
        });

        cachedSectors = merged;
        return merged;

    } catch (error) {
        console.warn('[sectorDirectory] fallback para setores padrão', error);
        return SECTORS;
    }
}

export async function getSectorById(sectorId) {
    if (!sectorId) return null;

    const sectors = await getAllSectors();
    const normalizedId = normalize(sectorId);

    return sectors.find(s =>
        normalize(s.id) === normalizedId ||
        normalize(s.name) === normalizedId
    ) || null;
}

export async function getSectorDisplayName(sectorId) {
    if (!sectorId) return 'Não informado';

    const sector = await getSectorById(sectorId);

    if (sector) return sector.name;

    // fallback seguro
    return sectorId;
}

export function clearSectorCache() {
    cachedSectors = null;
}