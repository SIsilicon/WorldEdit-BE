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

const gradients3D = [
    [1, 1, 0],
    [-1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0],
    [1, 0, 1],
    [-1, 0, 1],
    [1, 0, -1],
    [-1, 0, -1],
    [0, 1, 1],
    [0, -1, 1],
    [0, 1, -1],
    [0, -1, -1],
];

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

    private dotGridGradient3D(ix: number, iy: number, iz: number, x: number, y: number, z: number): number {
        const hash = this.permutations[wrap(ix + this.permutations[wrap(iy + this.permutations[wrap(iz, 256)], 256)], 256)];

        const gradient = gradients3D[hash % gradients3D.length];

        const dx = x - ix;
        const dy = y - iy;
        const dz = z - iz;

        return (dx * gradient[0] + dy * gradient[1] + dz * gradient[2]) / Math.SQRT2;
    }

    private hash3D(x: number, y: number, z: number): number {
        return this.permutations[wrap(x + this.permutations[wrap(y + this.permutations[wrap(z, 256)], 256)], 256)];
    }

    private valueAt3D(x: number, y: number, z: number): number {
        return this.hash3D(x, y, z) / 255;
    }

    private simplexContribution(hash: number, x: number, y: number, z: number): number {
        let attenuation = 0.6 - x * x - y * y - z * z;
        if (attenuation <= 0) return 0;

        const gradient = gradients3D[hash % gradients3D.length];
        attenuation *= attenuation;
        return attenuation * attenuation * (x * gradient[0] + y * gradient[1] + z * gradient[2]);
    }

    private pingPong(value: number): number {
        const wrapped = ((value % 2) + 2) % 2;
        return wrapped < 1 ? wrapped : 2 - wrapped;
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

    public perlin3D(x: number, y: number, z: number): number {
        const x0 = Math.floor(x);
        const x1 = x0 + 1;
        const y0 = Math.floor(y);
        const y1 = y0 + 1;
        const z0 = Math.floor(z);
        const z1 = z0 + 1;

        const sx = this.fade(x - x0);
        const sy = this.fade(y - y0);
        const sz = this.fade(z - z0);

        const n000 = this.dotGridGradient3D(x0, y0, z0, x, y, z);
        const n100 = this.dotGridGradient3D(x1, y0, z0, x, y, z);
        const n010 = this.dotGridGradient3D(x0, y1, z0, x, y, z);
        const n110 = this.dotGridGradient3D(x1, y1, z0, x, y, z);

        const n001 = this.dotGridGradient3D(x0, y0, z1, x, y, z);
        const n101 = this.dotGridGradient3D(x1, y0, z1, x, y, z);
        const n011 = this.dotGridGradient3D(x0, y1, z1, x, y, z);
        const n111 = this.dotGridGradient3D(x1, y1, z1, x, y, z);

        const nx00 = this.lerp(n000, n100, sx);
        const nx10 = this.lerp(n010, n110, sx);
        const nx01 = this.lerp(n001, n101, sx);
        const nx11 = this.lerp(n011, n111, sx);

        const nxy0 = this.lerp(nx00, nx10, sy);
        const nxy1 = this.lerp(nx01, nx11, sy);

        const value = this.lerp(nxy0, nxy1, sz);

        return Math.min(1, Math.max(0, (value + 1) / 2));
    }

    public value3D(x: number, y: number, z: number): number {
        const x0 = Math.floor(x);
        const x1 = x0 + 1;
        const y0 = Math.floor(y);
        const y1 = y0 + 1;
        const z0 = Math.floor(z);
        const z1 = z0 + 1;

        const sx = this.fade(x - x0);
        const sy = this.fade(y - y0);
        const sz = this.fade(z - z0);

        const nx00 = this.lerp(this.valueAt3D(x0, y0, z0), this.valueAt3D(x1, y0, z0), sx);
        const nx10 = this.lerp(this.valueAt3D(x0, y1, z0), this.valueAt3D(x1, y1, z0), sx);
        const nx01 = this.lerp(this.valueAt3D(x0, y0, z1), this.valueAt3D(x1, y0, z1), sx);
        const nx11 = this.lerp(this.valueAt3D(x0, y1, z1), this.valueAt3D(x1, y1, z1), sx);

        const nxy0 = this.lerp(nx00, nx10, sy);
        const nxy1 = this.lerp(nx01, nx11, sy);

        return this.lerp(nxy0, nxy1, sz);
    }

    public simplex3D(x: number, y: number, z: number): number {
        const skewFactor = 1 / 3;
        const unskewFactor = 1 / 6;

        const skew = (x + y + z) * skewFactor;
        const i = Math.floor(x + skew);
        const j = Math.floor(y + skew);
        const k = Math.floor(z + skew);

        const unskew = (i + j + k) * unskewFactor;
        const x0 = x - (i - unskew);
        const y0 = y - (j - unskew);
        const z0 = z - (k - unskew);

        let i1: number;
        let j1: number;
        let k1: number;
        let i2: number;
        let j2: number;
        let k2: number;

        if (x0 >= y0) {
            if (y0 >= z0) {
                i1 = 1;
                j1 = 0;
                k1 = 0;
                i2 = 1;
                j2 = 1;
                k2 = 0;
            } else if (x0 >= z0) {
                i1 = 1;
                j1 = 0;
                k1 = 0;
                i2 = 1;
                j2 = 0;
                k2 = 1;
            } else {
                i1 = 0;
                j1 = 0;
                k1 = 1;
                i2 = 1;
                j2 = 0;
                k2 = 1;
            }
        } else if (y0 < z0) {
            i1 = 0;
            j1 = 0;
            k1 = 1;
            i2 = 0;
            j2 = 1;
            k2 = 1;
        } else if (x0 < z0) {
            i1 = 0;
            j1 = 1;
            k1 = 0;
            i2 = 0;
            j2 = 1;
            k2 = 1;
        } else {
            i1 = 0;
            j1 = 1;
            k1 = 0;
            i2 = 1;
            j2 = 1;
            k2 = 0;
        }

        const x1 = x0 - i1 + unskewFactor;
        const y1 = y0 - j1 + unskewFactor;
        const z1 = z0 - k1 + unskewFactor;
        const x2 = x0 - i2 + 2 * unskewFactor;
        const y2 = y0 - j2 + 2 * unskewFactor;
        const z2 = z0 - k2 + 2 * unskewFactor;
        const x3 = x0 - 1 + 3 * unskewFactor;
        const y3 = y0 - 1 + 3 * unskewFactor;
        const z3 = z0 - 1 + 3 * unskewFactor;

        const n0 = this.simplexContribution(this.hash3D(i, j, k), x0, y0, z0);
        const n1 = this.simplexContribution(this.hash3D(i + i1, j + j1, k + k1), x1, y1, z1);
        const n2 = this.simplexContribution(this.hash3D(i + i2, j + j2, k + k2), x2, y2, z2);
        const n3 = this.simplexContribution(this.hash3D(i + 1, j + 1, k + 1), x3, y3, z3);

        const value = 32 * (n0 + n1 + n2 + n3);
        return Math.min(1, Math.max(0, (value + 1) / 2));
    }

    public pingPong3D(x: number, y: number, z: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2, strength: number = 2): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            const sample = this.perlin3D(x * frequency, y * frequency, z * frequency);
            value += this.pingPong(sample * strength * 2) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue;
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

    public octaveNoise3D(x: number, y: number, z: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.perlin3D(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue;
    }

    public turbulence3D(x: number, y: number, z: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            const sample = this.perlin3D(x * frequency, y * frequency, z * frequency) * 2 - 1;
            value += Math.abs(sample) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue;
    }

    public ridged3D(x: number, y: number, z: number): number {
        return 1 - Math.abs(this.perlin3D(x, y, z) * 2 - 1);
    }

    public warpedPerlin3D(x: number, y: number, z: number, strength: number = 1.5): number {
        const warpX = (this.perlin3D(x + 17.17, y + 8.13, z + 2.71) * 2 - 1) * strength;
        const warpY = (this.perlin3D(x - 5.47, y + 29.31, z + 11.73) * 2 - 1) * strength;
        const warpZ = (this.perlin3D(x + 13.91, y - 7.19, z + 37.41) * 2 - 1) * strength;

        return this.perlin3D(x + warpX, y + warpY, z + warpZ);
    }
}
