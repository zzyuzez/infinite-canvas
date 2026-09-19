export type ProductionReference = {
    id: string;
    title: string;
    nodeId: string;
    description: string;
    createdAt: string;
};

export type ProductionShot = ProductionReference & {
    order: number;
    durationMs: number;
    track: "video" | "overlay";
    transition: "cut" | "dissolve" | "fade";
};

export type CanvasProduction = {
    research: ProductionReference[];
    worlds: ProductionReference[];
    characters: ProductionReference[];
    scenes: ProductionReference[];
    shots: ProductionShot[];
    aspectRatio: "16:9" | "9:16" | "1:1";
    fps: 24 | 25 | 30;
    activeShotId: string | null;
};

export const createEmptyProduction = (): CanvasProduction => ({
    research: [],
    worlds: [],
    characters: [],
    scenes: [],
    shots: [],
    aspectRatio: "16:9",
    fps: 24,
    activeShotId: null,
});
