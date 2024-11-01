import { Vector3 } from "@minecraft/server";
import { axis } from "./vector";

type matrixElements = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

export class Matrix {
    public readonly vals: matrixElements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    static fromTranslation(vec: Vector3) {
        return new Matrix([1, 0, 0, vec.x, 0, 1, 0, vec.y, 0, 0, 1, vec.z, 0, 0, 0, 1]);
    }

    static fromRotation(degrees: number, axis: axis) {
        // Based on http://www.gamedev.net/reference/articles/article1199.asp
        const radians = degrees * (Math.PI / 180);
        const c = Math.cos(radians);
        const s = Math.sin(radians);
        const t = 1 - c;
        const x = axis === "x" ? 1 : 0;
        const y = axis === "y" ? 1 : 0;
        const z = axis === "z" ? 1 : 0;
        const tx = t * x;
        const ty = t * y;

        return new Matrix([tx * x + c, tx * y - s * z, tx * z + s * y, 0, tx * y + s * z, ty * y + c, ty * z - s * x, 0, tx * z - s * y, ty * z + s * x, t * z * z + c, 0, 0, 0, 0, 1]);
    }

    static fromScale(vec: Vector3) {
        return new Matrix([vec.x, 0, 0, 0, 0, vec.y, 0, 0, 0, 0, vec.z, 0, 0, 0, 0, 1]);
    }

    constructor(values?: matrixElements) {
        if (values) this.vals = [...values];
    }

    clone() {
        return new Matrix(this.vals);
    }

    rotate(degrees: number, axis: axis) {
        return this.multiply(Matrix.fromRotation(degrees, axis));
    }

    translate(vec: Vector3) {
        return this.multiply(Matrix.fromTranslation(vec));
    }

    scale(vec: Vector3) {
        return this.multiply(Matrix.fromScale(vec));
    }

    transpose() {
        const vals = <matrixElements>[...this.vals];
        vals[1] = this.vals[4];
        vals[4] = this.vals[1];
        vals[2] = this.vals[8];
        vals[8] = this.vals[2];
        vals[6] = this.vals[9];
        vals[9] = this.vals[6];
        vals[3] = this.vals[12];
        vals[12] = this.vals[3];
        vals[7] = this.vals[13];
        vals[13] = this.vals[7];
        vals[11] = this.vals[14];
        vals[14] = this.vals[11];
        return new Matrix(vals);
    }

    invert() {
        // based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm
        const result = new Matrix();
        const vals = result.vals,
            n11 = vals[0],
            n21 = vals[1],
            n31 = vals[2],
            n41 = vals[3],
            n12 = vals[4],
            n22 = vals[5],
            n32 = vals[6],
            n42 = vals[7],
            n13 = vals[8],
            n23 = vals[9],
            n33 = vals[10],
            n43 = vals[11],
            n14 = vals[12],
            n24 = vals[13],
            n34 = vals[14],
            n44 = vals[15],
            t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44,
            t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44,
            t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44,
            t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

        const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

        if (det === 0) return new Matrix([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

        const detInv = 1 / det;

        vals[0] = t11 * detInv;
        vals[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
        vals[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
        vals[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;

        vals[4] = t12 * detInv;
        vals[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
        vals[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
        vals[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;

        vals[8] = t13 * detInv;
        vals[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
        vals[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
        vals[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;

        vals[12] = t14 * detInv;
        vals[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
        vals[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
        vals[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;

        return result;
    }

    multiply(mat: Matrix) {
        const result = new Matrix();
        const vals = result.vals;

        const a11 = this.vals[0],
            a12 = this.vals[4],
            a13 = this.vals[8],
            a14 = this.vals[12];
        const a21 = this.vals[1],
            a22 = this.vals[5],
            a23 = this.vals[9],
            a24 = this.vals[13];
        const a31 = this.vals[2],
            a32 = this.vals[6],
            a33 = this.vals[10],
            a34 = this.vals[14];
        const a41 = this.vals[3],
            a42 = this.vals[7],
            a43 = this.vals[11],
            a44 = this.vals[15];

        const b11 = mat.vals[0],
            b12 = mat.vals[4],
            b13 = mat.vals[8],
            b14 = mat.vals[12];
        const b21 = mat.vals[1],
            b22 = mat.vals[5],
            b23 = mat.vals[9],
            b24 = mat.vals[13];
        const b31 = mat.vals[2],
            b32 = mat.vals[6],
            b33 = mat.vals[10],
            b34 = mat.vals[14];
        const b41 = mat.vals[3],
            b42 = mat.vals[7],
            b43 = mat.vals[11],
            b44 = mat.vals[15];

        vals[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
        vals[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
        vals[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
        vals[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

        vals[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
        vals[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
        vals[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
        vals[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

        vals[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
        vals[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
        vals[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
        vals[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

        vals[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
        vals[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
        vals[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
        vals[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

        return result;
    }
}

new Matrix();
