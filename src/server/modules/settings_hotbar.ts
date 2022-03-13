import { TickEvent, BeforeItemUseEvent, Player } from 'mojang-minecraft';
import { Server, setTickTimeout } from '@library/Minecraft.js';
import { PlayerUtil } from './player_util.js';
import { Pattern } from './pattern.js';
import { Mask } from './mask.js';
import { RawText } from './rawtext.js';
import { PlayerSession } from '../sessions.js';
import { printDebug, print, printerr } from '../util.js';
import { SphereBrush } from '../brushes/sphere_brush.js';
import { CylinderBrush } from '../brushes/cylinder_brush.js';
import { SmoothBrush } from '../brushes/smooth_brush.js';
import { Tools } from '../tools/tool_manager.js';

const itemLock = '{"minecraft:item_lock":{"mode":"lock_in_slot"}}';

type hotbarItems = {[k: number]: string|[string, number]};
interface state {
    hotbar: hotbarItems,
    entered?: () => void,
    input?: (itemType: string) => void,
    tick?: () => void,
    exiting?: () => void,
    [key: string]: any
}

export class SettingsHotbar {
    private state: state;
    private session: PlayerSession;
    private player: Player;
    private states: {[k: string]: state} = {
        main: {
            hotbar: {
            0: 'wedit:inc_entities_on_button',
            1: 'wedit:inc_air_on_button',
            4: 'wedit:brush_config_button',
            8: ['wedit:cancel_button', 1]
            },
            entered: () => {
                if (this.session.includeEntities) {
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_entities_off_button', 'wedit:inc_entities_on_button');
                } else {
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_entities_on_button', 'wedit:inc_entities_off_button');
                }
                if (this.session.includeAir) {
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_air_off_button', 'wedit:inc_air_on_button');
                } else {
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_air_on_button', 'wedit:inc_air_off_button');
                }
            },
            input: (itemType) => {
                if (itemType == 'wedit:inc_entities_off_button') {
                    this.session.includeEntities = true;
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_entities_off_button', 'wedit:inc_entities_on_button');
                } else if (itemType == 'wedit:inc_entities_on_button') {
                    this.session.includeEntities = false;
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_entities_on_button', 'wedit:inc_entities_off_button');
                } else if (itemType == 'wedit:inc_air_off_button') {
                    this.session.includeAir = true;
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_air_off_button', 'wedit:inc_air_on_button');
                } else if (itemType == 'wedit:inc_air_on_button') {
                    this.session.includeAir = false;
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_air_on_button', 'wedit:inc_air_off_button');
                } else if (itemType == 'wedit:brush_config_button') {
                    this.changeState('chooseBrush');
                } else if (itemType == 'wedit:cancel_button') {
                    this.session.exitSettings();
                }
            }
        },
        chooseBrush: {
            hotbar: {
                0: 'wedit:new_brush_button',
                8: 'wedit:cancel_button'
            },
            entered: () => {
                this.state['idx'] = 0;
                this.state['update']();
                this.msg('worldedit.brushConfig.chooseBrush');
                Tools.setDisabled(this.player, true);
            },
            input: (itemType) => {
                if (itemType == 'wedit:new_brush_button') {
                    this.changeState('chooseItem');
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('main');
                } else if (itemType == 'wedit:next_button') {
                    this.state['idx']++;
                    this.state['update']();
                } else if (itemType == 'wedit:prev_button') {
                    this.state['idx']--;
                    this.state['update']();
                } else if (itemType == 'wedit:blank') {
                    return;
                } else {
                    this.currBrushItem = [itemType, 0];
                    this.changeState('editBrush');
                }
            },
            exiting: () => {
                setTickTimeout((player: Player) => {
                    Tools.setDisabled(player, false);
                }, 1, this.player);
            },
            
            idx: 0,
            update: () => {
                const tools = Tools.getBoundItems(this.player);
                let items: hotbarItems = {...this.state.hotbar};
                if (tools.length < 6) {
                    for (let i = 0; i < tools.length; i++) {
                        items[i + 2] = tools[i];
                    }
                } else {
                    const idx = this.state['idx'];
                    if (idx > 0) {
                        items[1] = 'wedit:prev_button';
                    }
                    if (idx < tools.length-5) {
                        items[7] = 'wedit:next_button';
                    }
                    for (let i = 0; i < 5; i++) {
                        items[i + 2] = tools[i+idx];
                    }
                }
                this.setHotbarItems(items);
            }
        },
        chooseItem: {
            hotbar: {
                8: 'wedit:cancel_button'
            },
            entered: () => {
                this.msg('worldedit.brushConfig.chooseItem');
                Server.runCommand('clear @s wedit:blank', this.player);
            },
            input: (itemType) => {
                if (itemType == 'wedit:cancel_button') {
                    this.changeState('chooseBrush');
                }
            },
            tick: () => {
                let item = Server.player.getHeldItem(this.player);
                if (this.player.selectedSlot != 8 && item) {
                    try {
                        Tools.bind('selection_wand', this.player);
                        item = Server.player.getHeldItem(this.player);
                        this.currBrushItem = [item.id, item.data] as [string, number];
                        Tools.unbind(this.player);
                        this.changeState('editBrush');
                    } catch (e) {
                        this.err(e);
                    }
                }
            }
        },
        editBrush: {
            hotbar: {
                3: 'wedit:sphere_button',
                4: 'wedit:cylinder_button',
                5: 'wedit:smooth_button',
                8: 'wedit:cancel_button'
            },
            entered: () => {
                this.editingBrush = '';
                this.brushData = [];
                this.msg('worldedit.brushConfig.chooseKind');
            },
            input: (itemType) => {
                if (itemType == 'wedit:sphere_button') {
                    this.editingBrush = 'sphere';
                    this.changeState(this.brushMenus['sphere'][0])
                } else if (itemType == 'wedit:cylinder_button') {
                    this.editingBrush = 'cylinder';
                    this.changeState(this.brushMenus['cylinder'][0])
                } else if (itemType == 'wedit:smooth_button') {
                    this.editingBrush = 'smooth';
                    this.changeState(this.brushMenus['smooth'][0])
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('chooseBrush');
                }
            }
        },
        selectNumber: {
            hotbar: {
                1: 'wedit:one_button',
                2: 'wedit:two_button',
                3: 'wedit:three_button',
                4: 'wedit:four_button',
                5: 'wedit:five_button',
                6: 'wedit:six_button',
                8: 'wedit:cancel_button'
            },
            entered: () => {
                if (this.brushData.length == 0) {
                    this.msg('worldedit.brushConfig.selectRadius');
                } else if (this.brushData.length == 1 && this.editingBrush == 'cylinder') {
                    this.msg('worldedit.brushConfig.selectHeight');
                } else if (this.brushData.length == 1 && this.editingBrush == 'smooth') {
                    this.msg('worldedit.brushConfig.selectSmooth');
                }
            },
            input: (itemType) => {
                let num: number;
                if (itemType == 'wedit:one_button') {
                    num = 1;
                } else if (itemType == 'wedit:two_button') {
                    num = 2;
                } else if (itemType == 'wedit:three_button') {
                    num = 3;
                } else if (itemType == 'wedit:four_button') {
                    num = 4;
                } else if (itemType == 'wedit:five_button') {
                    num = 5;
                } else if (itemType == 'wedit:six_button') {
                    num = 6;
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('editBrush');
                    return;
                }
                if (num) {
                    this.brushData.push(num);
                    this.changeState(this.brushMenus[this.editingBrush][this.brushData.length]);
                }
            }
        },
        patternAndMask: {
            hotbar: {
                3: 'wedit:pattern_picker',
                5: 'wedit:mask_picker',
                7: 'wedit:confirm_button',
                8: 'wedit:cancel_button'
            },
            entered: () => {
                this.stashedPattern = this.session.globalPattern;
                this.stashedMask = this.session.globalMask;
                this.session.globalPattern = new Pattern();
                this.session.globalMask = new Mask();
                
                this.msg('worldedit.brushConfig.patternMask');
            },
            input: (itemType) => {
                if (itemType == 'wedit:confirm_button') {
                    this.brushData.push([this.session.globalPattern, this.session.globalMask]);
                    this.changeState(this.brushMenus[this.editingBrush][this.brushData.length]);
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('editBrush');
                }
            },
            exiting: () => {
                this.session.globalPattern = this.stashedPattern;
                this.session.globalMask = this.stashedMask;
            }
        },
        mask: {
            hotbar: {
                4: 'wedit:mask_picker',
                7: 'wedit:confirm_button',
                8: 'wedit:cancel_button'
            },
            entered: () => {
                this.stashedMask = this.session.globalMask;
                this.session.globalMask = new Mask();
                this.msg('worldedit.brushConfig.mask');
            },
            input: (itemType) => {
                if (itemType == 'wedit:confirm_button') {
                    this.brushData.push(this.session.globalMask);
                    this.changeState(this.brushMenus[this.editingBrush][this.brushData.length]);
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('editBrush');
                }
            },
            exiting: () => {
                this.session.globalMask = this.stashedMask;
            }
        },
        confirmBrush: {
            hotbar: {
                3: 'wedit:confirm_button',
                5: 'wedit:cancel_button'
            },
            input: (itemType) => {
                if (itemType == 'wedit:confirm_button') {
                    Server.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 destroy ${this.currBrushItem[0]} 1 ${this.currBrushItem[1]}`, this.player);
                    
                    if (this.editingBrush == 'sphere') {
                        this.session.bindTool('brush', new SphereBrush(this.brushData[0], this.brushData[1][0], false), this.brushData[1][1]);
                    } else if (this.editingBrush == 'cylinder') {
                        this.session.bindTool('brush', new CylinderBrush(this.brushData[0], this.brushData[1], this.brushData[2][0], false), this.brushData[2][1]);
                    } else if (this.editingBrush == 'smooth') {
                        this.session.bindTool('brush', new SmoothBrush(this.brushData[0], this.brushData[1], this.brushData[2]));
                    }
                    
                    this.changeState('chooseBrush');
                    if (!PlayerUtil.hasItem(this.player, ...this.currBrushItem)) {
                        Server.runCommand(`give @s ${this.currBrushItem[0]} 1 ${this.currBrushItem[1]}`, this.player);
                        this.msg('worldedit.brushConfig.setGive');
                    } else {
                        this.msg('worldedit.brushConfig.set');
                    }
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('editBrush');
                }
            },
            tick: () => {
                let msg = RawText.translate('worldedit.brushConfig.confirm').append('text', '\n');
                msg = msg.append('translate', `item.wedit:${this.editingBrush}_button`).append('text', this.brushData.length ? ':\n ' : '');
                
                if (this.editingBrush == 'sphere') {
                    msg.append('translate', 'worldedit.brushConfig.radius').with(this.brushData[0]);
                    let pattern = this.brushData[1][0].getBlockSummary();
                    let mask = this.brushData[1][1].getBlockSummary();
                    if (pattern) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.brushConfig.creates').with(pattern);
                    }
                    if (mask) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.brushConfig.affects').with(mask);
                    }
                } else if (this.editingBrush == 'cylinder') {
                    msg.append('translate', 'worldedit.brushConfig.radius').with(this.brushData[0]);
                    msg.append('text', '\n ');
                    msg.append('translate', 'worldedit.brushConfig.height').with(this.brushData[1]);
                    let pattern = this.brushData[2][0].getBlockSummary();
                    let mask = this.brushData[2][1].getBlockSummary();
                    
                    if (pattern) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.brushConfig.creates').with(pattern);
                    }
                    if (mask) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.brushConfig.affects').with(mask);
                    }
                } else if (this.editingBrush == 'smooth') {
                    msg.append('translate', 'worldedit.brushConfig.radius').with(this.brushData[0]);
                    msg.append('text', '\n ');
                    msg.append('translate', 'worldedit.brushConfig.smooth').with(this.brushData[1]);
                    let mask = this.brushData[2].getBlockSummary();
                    
                    if (mask) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.brushConfig.affects').with(mask);
                    }
                }
                this.msg(msg);
            }
        }
    };
    
    private currBrushItem: [string, number]; // Id and data value
    private editingBrush: string = '';
    private brushData: any[] = [];
    private brushMenus: {[k: string]: string[]} = {
        'sphere': ['selectNumber', 'patternAndMask', 'confirmBrush'],
        'cylinder': ['selectNumber', 'selectNumber', 'patternAndMask', 'confirmBrush'],
        'smooth': ['selectNumber', 'selectNumber', 'mask', 'confirmBrush']
    }
    
    private stashedPattern: Pattern;
    private stashedMask: Mask;
    
    constructor(session: PlayerSession) {
        this.session = session;
        this.player = session.getPlayer();
        PlayerUtil.stashHotbar(session.getPlayer());
        this.changeState('main');
    }
    
    onTick(ev: TickEvent) {
        this.state?.tick?.();
    }
    
    onItemUse(ev: BeforeItemUseEvent) {
        if (ev.item) {
            this.state?.input?.(ev.item.id);
        }
    }
    
    setHotbarItems(items: hotbarItems) {
        const player = this.player;
        for (let i = 0; i < 9; i++) {
            const [item, data] = Array.isArray(items[i]) ? <[string, number]>items[i] : [<string>items[i] ?? 'wedit:blank', 0];
            Server.runCommand(`replaceitem entity @s slot.hotbar ${i} ${item} 1 ${data} ${itemLock}`, player);
        }
    }
    
    changeState(state: string) {
        this.state?.exiting?.();
        this.state = this.states[state];
        this.setHotbarItems(this.state.hotbar);
        this.state.entered?.();
    }
    
    msg(msg: string | RawText, ...sub: string[]) {
        let raw = msg;
        if (typeof msg == 'string') {
            raw = RawText.translate(msg);
            for (const text of sub) raw = raw.with(text);
        }
        print(raw, this.player, true);
    }
    
    err(msg: string | RawText, ...sub: string[]) {
        let raw = msg;
        if (typeof msg == 'string') {
            raw = RawText.translate(msg);
            for (const text of sub) raw = raw.with(text);
        }
        printerr(raw, this.player, true);
    }
    
    exit() {
        this.state?.exiting?.();
        PlayerUtil.restoreHotbar(this.player);
        this.session = null;
        this.player = null;
    }
}