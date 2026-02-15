import type { Progress, Resolution } from '../types';
import { TILE_SIZE, GRID_SIZES } from '../constants';

const CONCURRENT_DOWNLOADS = 8;

interface ExtractedData {
    panoId: string | null;
    coords: { lat: number; lng: number } | null;
}

/**
 * Extracts the Panorama ID and coordinates from various Google Maps URL formats.
 * @param url The Google Maps URL.
 * @returns An object containing the Pano ID and coordinates, or null if not found.
 */
export const extractUrlData = (url: string): ExtractedData => {
    let panoId: string | null = null;
    let coords: { lat: number; lng: number } | null = null;

    // Regex for Pano ID
    const panoRegexes = [
        /pano=([a-zA-Z0-9_-]+)/,
        /!1s([a-zA-Z0-9_-]+)(?:!|&)/,
    ];

    for (const regex of panoRegexes) {
        const match = url.match(regex);
        if (match && match[1]) {
            panoId = match[1];
            break;
        }
    }

    // Regex for Coordinates like @lat,lng
    const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordsMatch && coordsMatch[1] && coordsMatch[2]) {
        coords = {
            lat: parseFloat(coordsMatch[1]),
            lng: parseFloat(coordsMatch[2]),
        };
    }
    
    // Fallback for URLs with `ll=` param
    if (!coords) {
        const llMatch = url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
         if (llMatch && llMatch[1] && llMatch[2]) {
            coords = {
                lat: parseFloat(llMatch[1]),
                lng: parseFloat(llMatch[2]),
            };
        }
    }

    return { panoId, coords };
};


/**
 * Generates a list of available resolutions based on hardcoded grid sizes.
 * @returns An array of Resolution objects.
 */
export const getAvailableResolutions = (): Resolution[] => {
    const resolutions: Resolution[] = [];
    const labels = ["High", "Maximum"]; // Adjusted for available zoom levels

    GRID_SIZES.forEach((grid, index) => {
        const width = grid.x * TILE_SIZE;
        const height = grid.y * TILE_SIZE;
        resolutions.push({
            zoom: grid.zoom,
            width,
            height,
            label: labels[index] || `Zoom ${grid.zoom}`,
            tileCount: grid.x * grid.y,
        });
    });

    return resolutions;
};

/**
 * Fetches a single image tile with a retry mechanism.
 * @param url The URL of the tile to fetch.
 * @param retries The number of times to retry on failure.
 * @returns A promise that resolves with an HTMLImageElement.
 */
const fetchTileWithRetry = (url: string, retries = 2): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        let attempts = 0;

        const load = () => {
            img.onload = () => resolve(img);
            img.onerror = () => {
                attempts++;
                if (attempts < retries) {
                    console.warn(`Retrying tile: ${url} (attempt ${attempts})`);
                    setTimeout(() => img.src = url, 200 * attempts);
                } else {
                    reject(new Error(`Failed to load tile after ${retries} attempts: ${url}`));
                }
            };
            img.src = url;
        };
        load();
    });
};

/**
 * Fetches and stitches all tiles for a given panorama and zoom level.
 * @param panoId The Panorama ID.
 * @param zoom The target zoom level.
 * @param onProgress A callback to report progress.
 * @returns A promise that resolves with the data URL of the stitched image.
 */
export const stitchStreetViewImage = async (
    panoId: string,
    zoom: number,
    onProgress: (progress: Progress) => void
): Promise<string> => {
    const grid = GRID_SIZES.find(g => g.zoom === zoom);
    if (!grid) {
        throw new Error(`Invalid zoom level provided: ${zoom}. Available levels are 3-4.`);
    }

    const canvasWidth = grid.x * TILE_SIZE;
    const canvasHeight = grid.y * TILE_SIZE;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error("Could not get 2D canvas context.");
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const tileCoords: { x: number; y: number }[] = [];
    for (let y = 0; y < grid.y; y++) {
        for (let x = 0; x < grid.x; x++) {
            tileCoords.push({ x, y });
        }
    }

    let loadedTiles = 0;
    const totalTiles = tileCoords.length;
    onProgress({ loaded: 0, total: totalTiles });

    const processTile = async (coord: { x: number; y: number }) => {
        const tileUrl = `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${panoId}&x=${coord.x}&y=${coord.y}&zoom=${zoom}&nbt=1&fover=2`;
        try {
            const img = await fetchTileWithRetry(tileUrl);
            ctx.drawImage(img, coord.x * TILE_SIZE, coord.y * TILE_SIZE);
        } catch (e) {
            console.warn(`Skipping missing tile at x=${coord.x}, y=${coord.y}, zoom=${zoom}`);
        } finally {
            loadedTiles++;
            onProgress({ loaded: loadedTiles, total: totalTiles });
        }
    };

    const queue = [...tileCoords];
    const workers = Array(CONCURRENT_DOWNLOADS).fill(null).map(async () => {
        while (queue.length > 0) {
            const coord = queue.shift();
            if (coord) {
                await processTile(coord);
            }
        }
    });

    await Promise.all(workers);

    return canvas.toDataURL('image/jpeg', 0.95);
};