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
 * Checks if a tile is essentially entirely black or blank.
 * This is useful because missing tiles from the Google API sometimes return as a solid color image.
 */
const isTileBlack = (img: HTMLImageElement): boolean => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    // willReadFrequently optimization
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    let isBlack = true;
    for (let i = 0; i < imageData.length; i += 4 * 10) {
        if (imageData[i] > 15 || imageData[i + 1] > 15 || imageData[i + 2] > 15) {
            isBlack = false;
            break;
        }
    }
    return isBlack;
};

/**
 * Crops solid black borders from the edges of a canvas.
 * This ensures that half-empty tiles or unpopulated edges are perfectly trimmed.
 */
const cropBlackEdges = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;

    const width = canvas.width;
    const height = canvas.height;

    let top = 0, bottom = height - 1, left = 0, right = width - 1;
    const thresh = 15;

    const isRowBlack = (y: number) => {
        const data = ctx.getImageData(0, y, width, 1).data;
        for (let i = 0; i < data.length; i += 4 * 2) {
            if (data[i] > thresh || data[i + 1] > thresh || data[i + 2] > thresh) return false;
        }
        return true;
    };

    const isColBlack = (x: number) => {
        const data = ctx.getImageData(x, 0, 1, height).data;
        for (let i = 0; i < data.length; i += 4 * 2) {
            if (data[i] > thresh || data[i + 1] > thresh || data[i + 2] > thresh) return false;
        }
        return true;
    };

    // Fast scanning to find true borders
    while (top <= bottom && isRowBlack(top)) top++;
    while (bottom >= top && isRowBlack(bottom)) bottom--;
    while (left <= right && isColBlack(left)) left++;
    while (right >= left && isColBlack(right)) right--;

    if (top > bottom || left > right) {
        return canvas; // Totally black
    }

    if (top === 0 && bottom === height - 1 && left === 0 && right === width - 1) {
        return canvas; // No cropping needed
    }

    const cropWidth = right - left + 1;
    const cropHeight = bottom - top + 1;

    const cropped = document.createElement('canvas');
    cropped.width = cropWidth;
    cropped.height = cropHeight;
    const cctx = cropped.getContext('2d');
    if (cctx) {
        cctx.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        return cropped;
    }
    return canvas;
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

    const tileCoords: { x: number; y: number }[] = [];
    for (let y = 0; y < grid.y; y++) {
        for (let x = 0; x < grid.x; x++) {
            tileCoords.push({ x, y });
        }
    }

    let loadedTiles = 0;
    const totalTiles = tileCoords.length;

    onProgress({ loaded: 0, total: totalTiles });

    // Store loaded images
    const images: { [key: string]: HTMLImageElement | null } = {};
    const hashes: { [key: string]: string } = {};

    const getTileHash = (img: HTMLImageElement): string => {
        const hCanvas = document.createElement('canvas');
        hCanvas.width = img.width;
        hCanvas.height = 1;
        const hCtx = hCanvas.getContext('2d', { willReadFrequently: true });
        if (!hCtx) return '';
        hCtx.drawImage(img, 0, -Math.floor(img.height / 2));
        const data = hCtx.getImageData(0, 0, img.width, 1).data;
        let hash = 0;
        for (let i = 0; i < data.length; i += 4) {
            hash = ((hash << 5) - hash) + data[i] + data[i + 1] + data[i + 2];
            hash = hash & hash;
        }
        return hash.toString();
    };

    const processTile = async (coord: { x: number; y: number }) => {
        const tileUrl = `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${panoId}&x=${coord.x}&y=${coord.y}&zoom=${zoom}&nbt=1&fover=2`;
        try {
            const img = await fetchTileWithRetry(tileUrl);
            const isBlack = isTileBlack(img);
            if (!isBlack) {
                images[`${coord.x},${coord.y}`] = img;
                hashes[`${coord.x},${coord.y}`] = getTileHash(img);
            } else {
                images[`${coord.x},${coord.y}`] = null;
            }
        } catch (e) {
            console.warn(`Skipping missing tile at x=${coord.x}, y=${coord.y}, zoom=${zoom}`);
            images[`${coord.x},${coord.y}`] = null;
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

    // Detect wrapping width horizontally to eliminate repeating tiles
    let actualCols = grid.x;
    for (let repeatX = 1; repeatX < grid.x; repeatX++) {
        let isMatch = true;
        let hasValidTile = false;

        for (let y = 0; y < grid.y; y++) {
            const hashRepeat = hashes[`${repeatX},${y}`];
            const hashOriginal = hashes[`0,${y}`];

            if (hashRepeat && hashOriginal) {
                hasValidTile = true;
                if (hashRepeat !== hashOriginal) {
                    isMatch = false;
                    break;
                }
            } else if (!hashRepeat && !hashOriginal) {
                // Both missing/black matches
            } else {
                // One missing and the other available
                isMatch = false;
                break;
            }
        }

        if (isMatch && hasValidTile) {
            actualCols = repeatX;
            break;
        }
    }

    const canvasWidth = actualCols * TILE_SIZE;
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

    for (let y = 0; y < grid.y; y++) {
        for (let x = 0; x < actualCols; x++) {
            const img = images[`${x},${y}`];
            if (img) {
                ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE);
            }
        }
    }

    // Crop continuous black padding at a pixel level exactly
    const croppedCanvas = cropBlackEdges(canvas);

    return croppedCanvas.toDataURL('image/jpeg', 0.95);
};