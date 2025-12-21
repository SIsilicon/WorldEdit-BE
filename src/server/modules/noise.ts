// Simple noise library for terrain generation
// Based on Perlin noise algorithm

import { Vector2 } from "@minecraft/server";
import { wrap } from "server/util";

// Initialize gradients
const gradients: Vector2[] = [];
for (let i = 0; i < 256; i++) {
    const angle = (i * 2 * Math.PI) / 256;
    gradients.push({
        x: Math.cos(angle),
        y: Math.sin(angle),
    });
}

export class Noise {
    private permutations: number[] = [];

    constructor(seed?: number) {
        seed ??= Math.floor(Math.random() * 1000000);

        // Initialize permutations
        this.permutations = Array.from({ length: 256 }, (_, i) => i);
        const random = this.seededRandom(seed);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [this.permutations[i], this.permutations[j]] = [this.permutations[j], this.permutations[i]];
        }
        // Duplicate for overflow
        this.permutations = this.permutations.concat(this.permutations);
    }

    private seededRandom(seed: number) {
        return function () {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    private dotGridGradient(ix: number, iy: number, x: number, y: number): number {
        const gradientIndex = this.permutations[wrap(ix + this.permutations[wrap(iy, 256)], 256)];
        const gradient = gradients[gradientIndex];

        const dx = x - ix;
        const dy = y - iy;

        return dx * gradient.x + dy * gradient.y;
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(a: number, b: number, t: number): number {
        return a + t * (b - a);
    }

    public perlin(x: number, y: number): number {
        // Determine grid cell coordinates
        const x0 = Math.floor(x);
        const x1 = x0 + 1;
        const y0 = Math.floor(y);
        const y1 = y0 + 1;

        // Determine interpolation weights
        const sx = this.fade(x - x0);
        const sy = this.fade(y - y0);

        // Interpolate between grid point gradients
        const n0 = this.dotGridGradient(x0, y0, x, y);
        const n1 = this.dotGridGradient(x1, y0, x, y);
        const ix0 = this.lerp(n0, n1, sx);

        const n2 = this.dotGridGradient(x0, y1, x, y);
        const n3 = this.dotGridGradient(x1, y1, x, y);
        const ix1 = this.lerp(n2, n3, sx);

        const value = this.lerp(ix0, ix1, sy);

        // Normalize to [-1, 1] and then to [0, 1]
        return (value + 1) / 2;
    }

    // Octave noise for more complex patterns
    public octaveNoise(x: number, y: number, octaves: number = 4, persistence: number = 0.5, scale: number = 0.1): number {
        let value = 0;
        let amplitude = 1;
        let frequency = scale;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.perlin(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return value / maxValue;
    }
}
