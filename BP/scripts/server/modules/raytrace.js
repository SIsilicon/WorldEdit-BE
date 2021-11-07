import { BlockLocation, World } from 'mojang-minecraft';
// TODO: Make raytracer more accurate.
export function raytrace(dimension, start, dir, mask) {
    const dim = World.getDimension(dimension);
    for (let i = 0; i < 50; i += 0.2) {
        const point = new BlockLocation(Math.floor(start.x + dir.x * i), Math.floor(start.y + dir.y * i), Math.floor(start.z + dir.z * i));
        if (mask && mask.matchesBlock(point, dimension)) {
            return point;
        }
        else if (!mask && !dim.isEmpty(point)) {
            return point;
        }
    }
}
