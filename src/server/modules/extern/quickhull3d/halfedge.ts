import { Face } from "./face.js";
import { Vertex } from "./vertex.js";

export interface HalfEdge {
    vertex: Vertex;
    face: Face;
    next: HalfEdge | null;
    prev: HalfEdge | null;
    opposite: HalfEdge | null;

    head(): Vertex;

    tail(): Vertex | null;

    length(): number;

    lengthSquared(): number;

    setOpposite(edge: HalfEdge): void;
}
