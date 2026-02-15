export const TILE_SIZE = 512;

// Defines the number of tiles on the X and Y axis for each zoom level.
// Street View panoramas typically only support zoom levels 3 and 4 for high quality.
export const GRID_SIZES = [
    { zoom: 3, x: 8, y: 4 },  // 4096x2048
    { zoom: 4, x: 16, y: 8 }, // 8192x4096
];
