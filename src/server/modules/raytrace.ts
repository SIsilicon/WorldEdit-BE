import { BlockLocation, World, Location } from 'mojang-minecraft';
import { dimension } from '../../library/@types/index.js';
import { Mask } from './mask.js';

// TODO: Make raytracer more accurate.
export function raytrace(dimension: dimension, start: Location, dir: Location, range?: number, mask?: Mask) {
	const dim = World.getDimension(dimension);
	for (let i = 0; i < 50; i += 0.2) {
		const point = new BlockLocation(
			Math.floor(start.x + dir.x * i),
			Math.floor(start.y + dir.y * i),
			Math.floor(start.z + dir.z * i)
		);
		
		if (mask && mask.matchesBlock(point, dimension)) {
			return point;
		} else if (!mask && !dim.isEmpty(point)) {
			return point;
		} else if (range && range > 0 && i >= range) {
			return point;
		}
	}	
}