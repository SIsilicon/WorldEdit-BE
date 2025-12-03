import { Vector3 } from "@minecraft/server";

// KD-tree helpers for faster nearest center queries
class KDNode {
    public point: Vector3;
    public axis: 0 | 1 | 2;
    public left?: KDNode;
    public right?: KDNode;

    constructor(point: Vector3, axis: 0 | 1 | 2) {
        this.point = point;
        this.axis = axis;
    }

    nearest(target: Vector3) {
        let bestNode: KDNode | undefined;
        let bestDist = Infinity;

        function recurse(node?: KDNode) {
            if (!node) return;
            const d = squaredDist(node.point, target);
            if (d < bestDist) {
                bestDist = d;
                bestNode = node;
            }
            const axisCoord = node.axis === 0 ? target.x - node.point.x : node.axis === 1 ? target.y - node.point.y : target.z - node.point.z;
            const near = axisCoord <= 0 ? node.left : node.right;
            const far = axisCoord <= 0 ? node.right : node.left;
            recurse(near);
            if (axisCoord * axisCoord < bestDist) recurse(far);
        }

        recurse(this);
        return bestNode?.point;
    }
}

function squaredDist(a: Vector3, b: Vector3) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

export function buildKDTree(points: Vector3[], depth = 0): KDNode | undefined {
    if (!points || points.length === 0) return undefined;
    const axis = (depth % 3) as 0 | 1 | 2;
    const pts = points.slice();
    pts.sort((p, q) => (axis === 0 ? p.x - q.x : axis === 1 ? p.y - q.y : p.z - q.z));
    const mid = Math.floor(pts.length / 2);
    const node = new KDNode(pts[mid], axis);
    node.left = buildKDTree(pts.slice(0, mid), depth + 1);
    node.right = buildKDTree(pts.slice(mid + 1), depth + 1);
    return node;
}
