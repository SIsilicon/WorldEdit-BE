import { BlockLocation, BlockPermutation, IBlockProperty, Dimension } from 'mojang-minecraft';
import { commandSyntaxError } from '@library/@types/build/classes/CommandBuilder';
import { CustomArgType } from '@library/build/classes/commandBuilder.js';
import { Server } from '@library/Minecraft.js';
import { printDebug, printLocation } from '../util.js';
import { Token, Tokenizr } from './extern/tokenizr.js';
import { tokenize, throwTokenError, mergeTokens, parseBlock, AstNode, processOps, parseBlockStates, parsedBlock } from './parser.js';

export class Mask implements CustomArgType {
    private condition: MaskNode;
    private stringObj = '';

    constructor(mask: string = '') {
        if (mask) {
            const obj = Mask.parseArgs([mask]).result;
            this.condition = obj.condition;
            this.stringObj = obj.stringObj;
        }
    }

    matchesBlock(loc: BlockLocation, dimension: Dimension) {
        if (this.empty()) {
            return true;
        }
        return this.condition.matchesBlock(loc, dimension);
    };

    clear() {
        this.condition = null;
        this.stringObj = '';
    }
    
    empty() {
        return this.condition == null;
    }
    
    addBlock(block: BlockPermutation) {
        const states: parsedBlock['states'] = new Map();
        block.getAllProperties().forEach(state => {
            if (!state.name.startsWith('wall_connection_type') && !state.name.startsWith('liquid_depth')) {
                states.set(state.name, state.value);
            }
        })
        
        if (this.condition == null) {
            this.condition = new ChainMask(null);
        }
        
        this.condition.nodes.push(new BlockMask(null, {
            id: block.type.id,
            data: -1,
            states: states
        }));
        this.stringObj = '(picked)';
    }
    
    getBlockSummary() {
        if (!this.condition || !(this.condition instanceof ChainMask)) {
            return '';
        }
        
        let text = '';
        let i = 0;
        for (const mask of this.condition.nodes) {
            let sub = (<BlockMask> mask).block.id.replace('minecraft:', '');
            for (const state of (<BlockMask> mask).block.states) {
                const val = state[1];
                if (typeof val == 'string' && val != 'x' && val != 'y' && val != 'z') {
                    sub += `(${val})`;
                    break;
                }
            }
            text += sub;
            if (i < this.condition.nodes.length-1) text += ', ';
            i++;
        }
        return text;
    }
    
    static parseArgs(args: Array<string>, index = 0) {
        const input = args[index];
        if (!input) {
            return {result: new Mask(), argIndex: index+1};
        }
        
        const tokens = tokenize(input);
        let token: Token;
        
        function processTokens(inBracket: boolean) {
            let ops: MaskNode[] = [];
            let out: MaskNode[] = [];
            const start = tokens.curr(); 
            
            function nodeToken() {
                return mergeTokens(token, tokens.curr(), input);
            }
            
            while (token = tokens.next()) {
                if (token.type == 'id') {
                    let block = parseBlock(tokens);
                    out.push(new BlockMask(nodeToken(), block));
                } else if (token.type == 'comma') {
                    processOps(out, ops, new ChainMask(token));
                } else if (token.type == 'space') {
                    processOps(out, ops, new IntersectMask(token));
                } else if (token.type == 'exclamation') {
                    processOps(out, ops, new NegateMask(token));
                } else if (token.type == 'bracket') {
                    if (token.value == '<') {
                        processOps(out, ops, new OffsetMask(token, 0,  1, 0));
                    } else if (token.value == '>') {
                        processOps(out, ops, new OffsetMask(token, 0, -1, 0));
                    } else if (token.value == '(') {
                        out.push(processTokens(true));
                    } else if (token.value == ')') {
                        if (!inBracket) {
                            throwTokenError(token);
                        } else {
                            processOps(out, ops);
                            break;
                        }
                    } else {
                        throwTokenError(token);
                    }
                } else if (token.type == 'hash') {
                    const t = tokens.next();
                    if (t.value == 'existing') {
                        out.push(new ExistingMask(nodeToken()));
                    } else if (t.value == 'surface' || t.value == 'exposed') {
                        out.push(new SurfaceMask(nodeToken()));
                    } else if (t.value == '#') {
                        const id = tokens.next();
                        if (id.type != 'id') {
                            throwTokenError(id);
                        }
                        out.push(new TagMask(nodeToken(), id.value));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.type == 'percent') {
                    const num = tokens.next();
                    if (num.type != 'number') {
                        throwTokenError(num);
                    }
                    out.push(new PercentMask(nodeToken(), num.value / 100));
                } else if (token.type == 'caret') {
                    let states: parsedBlock['states'];
                    let strict = false;
                    let t = tokens.next();
                    if (t.value == '=') {
                        strict = true;
                        t = tokens.next();
                        if (t.value != '[') {
                            throwTokenError(t);
                        }
                        states = parseBlockStates(tokens);
                    } else if (token.value == '[') {
                        states = parseBlockStates(tokens);
                    } else {
                        throwTokenError(t);
                    }
                    out.push(new StateMask(nodeToken(), states, strict));
                } else if (token.type == 'EOF') {
                    if (inBracket) {
                        throwTokenError(token);
                    } else {
                        processOps(out, ops);
                    }
                } else {
                    throwTokenError(token);
                }
            }
            
            if (out.length > 1) {
                throwTokenError(out.slice(-1)[0].token);
            } else if (!out.length) {
                throwTokenError(start);
            } else if (ops.length) {
                const op = ops.slice(-1)[0];
                throwTokenError(op instanceof Token ? op : op.token);
            }
            
            return out[0];
        }
        
        let out: MaskNode;
        try {
            out = processTokens(false);
            out.postProcess();
        } catch (error) {
            if (error.pos != undefined) {
                const err: commandSyntaxError = {
                    isSyntaxError: true,
                    idx: index,
                    start: error.pos,
                    end: error.pos+1,
                    stack: error.stack
                };
                throw err;
            }
            throw error;
        }
        
        const mask = new Mask();
        mask.stringObj = args[index];
        mask.condition = out;
        
        return {result: mask, argIndex: index+1};
    }
    
    static clone(original: Mask) {
        const mask = new Mask();
        mask.condition = original.condition;
        mask.stringObj = original.stringObj;
        return mask;
    }
    
    toString() {
        return `[mask: ${this.stringObj}]`;
    }
}

abstract class MaskNode implements AstNode {
    public nodes: MaskNode[] = [];
    abstract readonly prec: number;
    abstract readonly opCount: number;
    
    constructor(public readonly token: Token) {}
    
    abstract matchesBlock(loc: BlockLocation, dim: Dimension): boolean;
    
    postProcess() {}
}

class BlockMask extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;
    
    constructor(token: Token, public block: parsedBlock) {
        super(token);
    }
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        if (this.block.data == -1) {
            const block = dim.getBlock(loc).permutation;
            if (block.type.id != this.block.id) {
                return false;
            }
            if (!this.block.states) {
                return true;
            }
            
            const properties = block.getAllProperties();
            let states_passed = 0;
            for (const state of this.block.states) {
                const prop = <IBlockProperty> properties.find(value => {
                    return value.name == state[0];
                });
                if (prop && prop.value == state[1]) {
                    states_passed++;
                }
            }
            return states_passed == this.block.states.size;
        } else {
            let command = `testforblock ${printLocation(loc, false)} ${this.block.id}`;
            command += ' ' + this.block.data;
            return !Server.runCommand(command, dim).error;
        }
    }
}

class StateMask extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;
    
    constructor(token: Token, public states: parsedBlock['states'], public strict: boolean) {
        super(token);
    }
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        const block = dim.getBlock(loc).permutation;
        
        const properties = block.getAllProperties();
        let states_passed = 0;
        for (const state of this.states) {
            const prop = <IBlockProperty> properties.find(value => {
                return value.name == state[0];
            });
            if (this.strict && prop && prop.value == state[1]) {
                states_passed++;
            } else if (!this.strict && (!prop || prop.value == state[1])) {
                states_passed++;
            } 
        }
        return states_passed == this.states.size;
    }
}

class SurfaceMask extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        return !dim.isEmpty(loc) && (
            dim.isEmpty(loc.offset(0, 1, 0)) ||
            dim.isEmpty(loc.offset(0, -1, 0)) ||
            dim.isEmpty(loc.offset(-1, 0, 0)) ||
            dim.isEmpty(loc.offset(1, 0, 0)) ||
            dim.isEmpty(loc.offset(0, 0, -1)) ||
            dim.isEmpty(loc.offset(0, 0, 1))
        );
    }
}

class ExistingMask extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        return !dim.isEmpty(loc);
    }
}

class TagMask extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;
    
    constructor(token: Token, public tag: string) {
        super(token);
    }
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        return dim.getBlock(loc).hasTag(this.tag);
    }
}

class PercentMask extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;
    
    constructor(token: Token, public percent: number) {
        super(token);
    }
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        return Math.random() < this.percent;
    }
}

class ChainMask extends MaskNode {
    readonly prec = 3;
    readonly opCount = 2;
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        for (const mask of this.nodes) {
            if (mask.matchesBlock(loc, dim)) {
                return true;
            }
        }
        return false;
    }
    
    postProcess() {
        super.postProcess();
        
        const masks = this.nodes;
        this.nodes = [];
        while (masks.length) {
            const mask = masks.shift();
            if (mask instanceof ChainMask) {
                const sub = mask.nodes.reverse();
                for (const child of sub) {
                    masks.unshift(child);
                }
            } else {
                this.nodes.push(mask);
                mask.postProcess();
            }
        }
    }
}

class IntersectMask extends MaskNode {
    readonly prec = 1;
    readonly opCount = 2;
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        for (const mask of this.nodes) {
            if (!mask.matchesBlock(loc, dim)) {
                return false;
            }
        }
        return true;
    }
    
    postProcess() {
        super.postProcess();
        
        const masks = this.nodes;
        this.nodes = [];
        while (masks.length) {
            const mask = masks.shift();
            if (mask instanceof IntersectMask) {
                const sub = mask.nodes.reverse();
                for (const child of sub) {
                    masks.unshift(child);
                }
            } else {
                this.nodes.push(mask);
                mask.postProcess();
            }
        }
    }
}

class NegateMask extends MaskNode {
    readonly prec = 2;
    readonly opCount = 1;
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        return !this.nodes[0].matchesBlock(loc, dim);
    }
}

// Overlay and Underlay
class OffsetMask extends MaskNode {
    readonly prec = 2;
    readonly opCount = 1;
    
    constructor(token: Token, public x: number, public y: number, public z: number) {
        super(token);
    }
    
    matchesBlock(loc: BlockLocation, dim: Dimension) {
        return this.nodes[0].matchesBlock(loc.offset(this.x, this.y, this.z), dim);
    }
    
    postProcess() {
        while (this.nodes[0] instanceof OffsetMask) {
            this.x += this.nodes[0].x;
            this.y += this.nodes[0].y;
            this.z += this.nodes[0].z;
            this.nodes = this.nodes[0].nodes;
        }
    }
}