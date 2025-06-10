import { Vector } from "@notbeer-api";
import { HalfEdge as IHalfEdge } from "./halfedge.js";
import { Vertex } from "./vertex.js";

export enum Mark {
    Visible = 0,
    NonConvex,
    Deleted,
}

export class Face {
    normal: Vector;
    centroid: Vector;
    offset: number;
    outside: Vertex;
    mark: Mark;
    edge: HalfEdge;
    nVertices: number;
    area: number;

    constructor() {
        this.normal = Vector.ZERO;
        this.centroid = Vector.ZERO;
        // signed distance from face to the origin
        this.offset = 0;
        // pointer to the a vertex in a double linked list this face can see
        this.outside = null;
        this.mark = Mark.Visible;
        this.edge = null;
        this.nVertices = 0;
    }

    getEdge(i: number) {
        let it = this.edge;
        while (i > 0) {
            it = it.next;
            i -= 1;
        }
        while (i < 0) {
            it = it.prev;
            i += 1;
        }
        return it;
    }

    computeNormal() {
        const e0 = this.edge;
        const e1 = e0.next;
        let e2 = e1.next;
        let v2 = e1.head().point.sub(e0.head().point);
        let v1: Vector;

        this.nVertices = 2;
        this.normal = Vector.ZERO;
        // console.log(this.normal)
        while (e2 !== e0) {
            v1 = v2.clone();
            v2 = e2.head().point.sub(e0.head().point);
            this.normal = this.normal.add(v1.cross(v2));
            e2 = e2.next;
            this.nVertices += 1;
        }
        this.area = this.normal.length;
        // normalize the vector, since we've already calculated the area
        // it's cheaper to scale the vector using this quantity instead of
        // doing the same operation again
        this.normal = this.normal.normalized();
    }

    computeNormalMinArea(minArea: number) {
        this.computeNormal();
        if (this.area < minArea) {
            // compute the normal without the longest edge
            let maxEdge: HalfEdge;
            let maxSquaredLength = 0;
            let edge = this.edge;

            // find the longest edge (in length) in the chain of edges
            do {
                const lengthSquared = edge.lengthSquared();
                if (lengthSquared > maxSquaredLength) {
                    maxEdge = edge;
                    maxSquaredLength = lengthSquared;
                }
                edge = edge.next;
            } while (edge !== this.edge);

            const p1 = maxEdge.tail().point;
            const p2 = maxEdge.head().point;
            let maxVector = p2.sub(p1);
            const maxLength = Math.sqrt(maxSquaredLength);
            // maxVector is normalized after this operation
            maxVector = maxVector.mul(1 / maxLength);
            // compute the projection of maxVector over this face normal
            const maxProjection = this.normal.dot(maxVector);
            // subtract the quantity maxEdge adds on the normal
            this.normal = this.normal.add(maxVector.mul(-maxProjection));
            // renormalize `this.normal`
            this.normal = this.normal.normalized();
        }
    }

    computeCentroid() {
        this.centroid = Vector.ZERO;
        let edge = this.edge;
        do {
            this.centroid = this.centroid.add(edge.head().point);
            edge = edge.next;
        } while (edge !== this.edge);
        this.centroid = this.centroid.mul(1 / this.nVertices);
    }

    computeNormalAndCentroid(minArea?: number) {
        if (typeof minArea !== "undefined") this.computeNormalMinArea(minArea);
        else this.computeNormal();
        this.computeCentroid();
        this.offset = this.normal.dot(this.centroid);
    }

    distanceToPlane(point: Vector) {
        return this.normal.dot(point) - this.offset;
    }

    /**
     * @private
     *
     * Connects two edges assuming that prev.head().point === next.tail().point
     *
     * @param {HalfEdge} prev
     * @param {HalfEdge} next
     */
    connectHalfEdges(prev: HalfEdge, next: HalfEdge) {
        let discardedFace: Face;
        if (prev.opposite.face === next.opposite.face) {
            // `prev` is remove a redundant edge
            const oppositeFace = next.opposite.face;
            let oppositeEdge: HalfEdge;
            if (prev === this.edge) {
                this.edge = next;
            }
            if (oppositeFace.nVertices === 3) {
                // case:
                // remove the face on the right
                //
                //       /|\
                //      / | \ the face on the right
                //     /  |  \ --> opposite edge
                //    / a |   \
                //   *----*----*
                //  /     b  |  \
                //           ▾
                //      redundant edge
                //
                // Note: the opposite edge is actually in the face to the right
                // of the face to be destroyed
                oppositeEdge = next.opposite.prev.opposite;
                oppositeFace.mark = Mark.Deleted;
                discardedFace = oppositeFace;
            } else {
                // case:
                //          t
                //        *----
                //       /| <- right face's redundant edge
                //      / | opposite edge
                //     /  |  ▴   /
                //    / a |  |  /
                //   *----*----*
                //  /     b  |  \
                //           ▾
                //      redundant edge
                oppositeEdge = next.opposite.next;
                // make sure that the link `oppositeFace.edge` points correctly even
                // after the right face redundant edge is removed
                if (oppositeFace.edge === oppositeEdge.prev) {
                    oppositeFace.edge = oppositeEdge;
                }

                //       /|   /
                //      / | t/opposite edge
                //     /  | / ▴  /
                //    / a |/  | /
                //   *----*----*
                //  /     b     \
                oppositeEdge.prev = oppositeEdge.prev.prev;
                oppositeEdge.prev.next = oppositeEdge;
            }
            //       /|
            //      / |
            //     /  |
            //    / a |
            //   *----*----*
            //  /     b  ▴  \
            //           |
            //     redundant edge
            next.prev = prev.prev;
            next.prev.next = next;

            //       / \  \
            //      /   \->\
            //     /     \<-\ opposite edge
            //    / a     \  \
            //   *----*----*
            //  /     b  ^  \
            next.setOpposite(oppositeEdge);

            oppositeFace.computeNormalAndCentroid();
        } else {
            // trivial case
            //        *
            //       /|\
            //      / | \
            //     /  |--> next
            //    / a |   \
            //   *----*----*
            //    \ b |   /
            //     \  |--> prev
            //      \ | /
            //       \|/
            //        *
            prev.next = next;
            next.prev = prev;
        }
        return discardedFace;
    }

    mergeAdjacentFaces(adjacentEdge: HalfEdge, discardedFaces: Array<Face>) {
        const oppositeEdge = adjacentEdge.opposite;
        const oppositeFace = oppositeEdge.face;

        discardedFaces.push(oppositeFace);
        oppositeFace.mark = Mark.Deleted;

        // find the chain of edges whose opposite face is `oppositeFace`
        //
        //                ===>
        //      \         face         /
        //       * ---- * ---- * ---- *
        //      /     opposite face    \
        //                <===
        //
        let adjacentEdgePrev = adjacentEdge.prev;
        let adjacentEdgeNext = adjacentEdge.next;
        let oppositeEdgePrev = oppositeEdge.prev;
        let oppositeEdgeNext = oppositeEdge.next;

        // left edge
        while (adjacentEdgePrev.opposite.face === oppositeFace) {
            adjacentEdgePrev = adjacentEdgePrev.prev;
            oppositeEdgeNext = oppositeEdgeNext.next;
        }
        // right edge
        while (adjacentEdgeNext.opposite.face === oppositeFace) {
            adjacentEdgeNext = adjacentEdgeNext.next;
            oppositeEdgePrev = oppositeEdgePrev.prev;
        }
        // adjacentEdgePrev  \         face         / adjacentEdgeNext
        //                    * ---- * ---- * ---- *
        // oppositeEdgeNext  /     opposite face    \ oppositeEdgePrev

        // fix the face reference of all the opposite edges that are not part of
        // the edges whose opposite face is not `face` i.e. all the edges that
        // `face` and `oppositeFace` do not have in common
        let edge: HalfEdge;
        for (edge = oppositeEdgeNext; edge !== oppositeEdgePrev.next; edge = edge.next) {
            edge.face = this;
        }

        // make sure that `face.edge` is not one of the edges to be destroyed
        // Note: it's important for it to be a `next` edge since `prev` edges
        // might be destroyed on `connectHalfEdges`
        this.edge = adjacentEdgeNext;

        // connect the extremes
        // Note: it might be possible that after connecting the edges a triangular
        // face might be redundant
        let discardedFace;
        discardedFace = this.connectHalfEdges(oppositeEdgePrev, adjacentEdgeNext);
        if (discardedFace) {
            discardedFaces.push(discardedFace);
        }
        discardedFace = this.connectHalfEdges(adjacentEdgePrev, oppositeEdgeNext);
        if (discardedFace) {
            discardedFaces.push(discardedFace);
        }

        this.computeNormalAndCentroid();
        // TODO: additional consistency checks
        return discardedFaces;
    }

    collectIndices(): number[] {
        const indices = [];
        let edge = this.edge;
        do {
            indices.push(edge.head().index);
            edge = edge.next;
        } while (edge !== this.edge);
        return indices;
    }

    static fromVertices(vertices: Vertex[], minArea = 0) {
        const face = new Face();
        const e0 = new HalfEdge(vertices[0], face);
        let lastE = e0;
        for (let i = 1; i < vertices.length; i += 1) {
            const e = new HalfEdge(vertices[i], face);
            e.prev = lastE;
            lastE.next = e;
            lastE = e;
        }
        lastE.next = e0;
        e0.prev = lastE;

        face.edge = e0;
        face.computeNormalAndCentroid(minArea);
        return face;
    }

    static createTriangle(v0: Vertex, v1: Vertex, v2: Vertex, minArea = 0) {
        const face = new Face();
        const e0 = new HalfEdge(v0, face);
        const e1 = new HalfEdge(v1, face);
        const e2 = new HalfEdge(v2, face);

        // join edges
        e0.next = e2.prev = e1;
        e1.next = e0.prev = e2;
        e2.next = e1.prev = e0;

        // main half edge reference
        face.edge = e0;
        face.computeNormalAndCentroid(minArea);
        return face;
    }
}

class HalfEdge implements IHalfEdge {
    vertex: Vertex;
    face: Face;
    next: IHalfEdge | null;
    prev: IHalfEdge | null;
    opposite: IHalfEdge | null;

    constructor(vertex: Vertex, face: Face) {
        this.vertex = vertex;
        this.face = face;
        this.next = null;
        this.prev = null;
        this.opposite = null;
    }

    head() {
        return this.vertex;
    }

    tail() {
        return this.prev ? this.prev.vertex : null;
    }

    length() {
        return this.tail() ? this.tail().point.distanceTo(this.head().point) : -1;
    }

    lengthSquared() {
        return this.tail() ? this.tail().point.sub(this.head().point).lengthSqr : -1;
    }

    setOpposite(edge: HalfEdge) {
        this.opposite = edge;
        edge.opposite = this;
    }
}
