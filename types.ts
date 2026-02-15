export interface Progress {
    loaded: number;
    total: number;
}

export interface Resolution {
    zoom: number;
    width: number;
    height: number;
    label: string;
    tileCount: number;
}
