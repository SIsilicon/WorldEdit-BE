import { TickEvent, BeforeItemUseEvent, Player, BeforeItemUseOnEvent } from 'mojang-minecraft';
import { Server, setTickTimeout } from '@library/Minecraft.js';
import { PlayerUtil } from './player_util.js';
import { Pattern } from './pattern.js';
import { Mask } from './mask.js';
import { RawText } from '@library/Minecraft.js';
import { PlayerSession } from '../sessions.js';
import { print, printerr } from '../util.js';
import { SphereBrush } from '../brushes/sphere_brush.js';
import { CylinderBrush } from '../brushes/cylinder_brush.js';
import { SmoothBrush } from '../brushes/smooth_brush.js';
import { Tools } from '../tools/tool_manager.js';

type hotbarItems = { [k: number]: string | [string, number] };
interface state {
    hotbar: hotbarItems,
    entered?: () => void,
    input?: (itemType: string, itemData?: number) => void | boolean,
    tick?: () => void,
    exiting?: () => void,
    [key: string]: any
}

export class SettingsHotbar {
    private state: state;
    private session: PlayerSession;
    private player: Player;
    private states: { [k: string]: state } = {
        main: {
            hotbar: {
                0: 'wedit:inc_entities_on_button',
                1: 'wedit:inc_air_on_button',
                3: 'wedit:tool_config_button',
                5: 'wedit:brush_config_button',
                8: ['wedit:cancel_button', 1]
            },
            entered: () => {
                if (this.session.includeEntities) {
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_entities_off_button', 'wedit:inc_entities_on_button', true);
                } else {
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_entities_on_button', 'wedit:inc_entities_off_button', true);
                }
                if (this.session.includeAir) {
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_air_off_button', 'wedit:inc_air_on_button', true);
                } else {
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_air_on_button', 'wedit:inc_air_off_button', true);
                }
            },
            input: (itemType) => {
                if (itemType == 'wedit:inc_entities_off_button') {
                    this.session.includeEntities = true;
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_entities_off_button', 'wedit:inc_entities_on_button', true);
                } else if (itemType == 'wedit:inc_entities_on_button') {
                    this.session.includeEntities = false;
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_entities_on_button', 'wedit:inc_entities_off_button', true);
                } else if (itemType == 'wedit:inc_air_off_button') {
                    this.session.includeAir = true;
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_air_off_button', 'wedit:inc_air_on_button', true);
                } else if (itemType == 'wedit:inc_air_on_button') {
                    this.session.includeAir = false;
                    PlayerUtil.replaceItem(this.player, 'wedit:inc_air_on_button', 'wedit:inc_air_off_button', true);
                } else if (itemType == 'wedit:tool_config_button') {
                    this.state['editMode'] = 'tool';
                    this.changeState('chooseTool');
                } else if (itemType == 'wedit:brush_config_button') {
                    this.state['editMode'] = 'brush';
                    this.changeState('chooseTool');
                } else if (itemType == 'wedit:cancel_button') {
                    this.session.exitSettings();
                }
            },
            editMode: 'brush'
        },
        chooseTool: {
            hotbar: {
                0: 'wedit:new_brush_button',
                8: 'wedit:cancel_button'
            },
            entered: () => {
                this.state.idx = 0;
                this.state.update();
                this.msg('worldedit.config.editTool');
                Tools.setDisabled(this.player, true);
            },
            input: (itemType, itemData) => {
                if (itemType == 'wedit:new_brush_button') {
                    this.changeState('chooseItem');
                    this.newTool = true;
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('main');
                } else if (itemType == 'wedit:next_button') {
                    this.state.idx++;
                    this.state.update();
                } else if (itemType == 'wedit:prev_button') {
                    this.state.idx--;
                    this.state.update();
                } else if (itemType == 'wedit:blank') {
                    return;
                } else {
                    this.currBindItem = [itemType, itemData];
                    this.newTool = false;
                    this.changeState('editTool');
                    return true;
                }
            },
            exiting: () => {
                setTickTimeout((player: Player) => {
                    Tools.setDisabled(player, false);
                }, 1, this.player);
            },

            idx: 0,
            update: () => {
                const tools = Tools.getBoundItems(this.player, this.states.main.editMode == 'brush' ? 'brush' : /^.*(?<!brush)$/);
                let items: hotbarItems = { ...this.state.hotbar };
                if (tools.length < 6) {
                    for (let i = 0; i < tools.length; i++) {
                        items[i + 2] = tools[i];
                    }
                } else {
                    const idx = this.state.idx;
                    if (idx > 0) {
                        items[1] = 'wedit:prev_button';
                    }
                    if (idx < tools.length - 5) {
                        items[7] = 'wedit:next_button';
                    }
                    for (let i = 0; i < 5; i++) {
                        items[i + 2] = tools[i + idx];
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
                this.msg(`worldedit.config.chooseItem`);
                Server.runCommand('clear @s wedit:blank', this.player);
            },
            input: (itemType) => {
                if (itemType == 'wedit:cancel_button') {
                    this.changeState('chooseTool');
                }
            },
            tick: () => {
                let item = Server.player.getHeldItem(this.player);
                if (this.player.selectedSlot != 8 && item) {
                    this.currBindItem = [item.id, item.data];
                    this.changeState('editTool');
                }
            }
        },
        editTool: {
            hotbar: {
                0: 'wedit:delete_button',
                3: 'wedit:sphere_button',
                4: 'wedit:cylinder_button',
                5: 'wedit:smooth_button',
                8: 'wedit:cancel_button'
            },
            entered: () => {
                let hotbarItems = { ...this.state.hotbar };
                if (this.states.main.editMode == 'tool') {
                    hotbarItems = {
                        0: 'wedit:delete_button',
                        2: 'wedit:selection_button',
                        3: 'wedit:far_selection_button',
                        5: 'wedit:navigation_button',
                        6: 'wedit:stacker_button',
                        8: 'wedit:cancel_button'
                    };
                }
                if (this.newTool) {
                    delete hotbarItems[0];
                }

                this.editingTool = '';
                this.toolData = [];
                this.setHotbarItems(hotbarItems);
                this.msg('worldedit.config.choose.' + this.states.main.editMode);
            },
            input: (itemType) => {
                if (itemType == 'wedit:sphere_button') {
                    this.editingTool = 'sphere';
                    this.changeState(this.toolMenus['sphere'][0]);
                } else if (itemType == 'wedit:cylinder_button') {
                    this.editingTool = 'cylinder';
                    this.changeState(this.toolMenus['cylinder'][0]);
                } else if (itemType == 'wedit:smooth_button') {
                    this.editingTool = 'smooth';
                    this.changeState(this.toolMenus['smooth'][0]);
                } else if (itemType == 'wedit:selection_button') {
                    this.editingTool = 'selection';
                    this.changeState('confirmTool');
                } else if (itemType == 'wedit:far_selection_button') {
                    this.editingTool = 'far_selection';
                    this.changeState('confirmTool');
                } else if (itemType == 'wedit:navigation_button') {
                    this.editingTool = 'navigation';
                    this.changeState('confirmTool');
                } else if (itemType == 'wedit:stacker_button') {
                    this.editingTool = 'stacker';
                    this.changeState(this.toolMenus['stacker'][0]);
                } else if (itemType == 'wedit:delete_button') {
                    this.editingTool = 'unbind';
                    this.changeState('confirmTool');
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('chooseTool');
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
                if (this.states.main.editMode == 'tool') {
                    if (this.editingTool == 'stacker') {
                        this.msg('worldedit.config.selectRange.tool');
                    }
                } else {
                    if (this.toolData.length == 0) {
                        this.msg('worldedit.config.selectRadius.brush');
                    } else if (this.toolData.length == 1 && this.editingTool == 'cylinder') {
                        this.msg('worldedit.config.selectHeight.brush');
                    } else if (this.toolData.length == 1 && this.editingTool == 'smooth') {
                        this.msg('worldedit.config.selectSmooth.brush');
                    }
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
                    this.changeState('editTool');
                    return;
                }
                if (num) {
                    this.toolData.push(num);
                    this.changeState(this.toolMenus[this.editingTool][this.toolData.length]);
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

                this.msg('worldedit.config.paternMask.' + this.states.main.editMode);
            },
            input: (itemType) => {
                if (itemType == 'wedit:confirm_button') {
                    this.toolData.push([this.session.globalPattern, this.session.globalMask]);
                    this.changeState(this.toolMenus[this.editingTool][this.toolData.length]);
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('editTool');
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
                this.msg('worldedit.config.mask.' + this.states.main.editMode);
            },
            input: (itemType) => {
                if (itemType == 'wedit:confirm_button') {
                    this.toolData.push(this.session.globalMask);
                    this.changeState(this.toolMenus[this.editingTool][this.toolData.length]);
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('editTool');
                }
            },
            exiting: () => {
                this.session.globalMask = this.stashedMask;
            }
        },
        confirmTool: {
            hotbar: {
                3: 'wedit:confirm_button',
                5: 'wedit:cancel_button'
            },
            input: (itemType) => {
                if (itemType == 'wedit:confirm_button') {
                    const item = this.currBindItem;

                    if (this.editingTool == 'unbind') {
                        this.session.unbindTool(item);
                        this.changeState('chooseTool');
                        this.msg('worldedit.config.unbind');
                        return;
                    }

                    if (this.editingTool == 'sphere') {
                        this.session.bindTool('brush', item, new SphereBrush(this.toolData[0], this.toolData[1][0], false), this.toolData[1][1]);
                    } else if (this.editingTool == 'cylinder') {
                        this.session.bindTool('brush', item, new CylinderBrush(this.toolData[0], this.toolData[1], this.toolData[2][0], false), this.toolData[2][1]);
                    } else if (this.editingTool == 'smooth') {
                        this.session.bindTool('brush', item, new SmoothBrush(this.toolData[0], this.toolData[1], this.toolData[2]));
                    } else if (this.editingTool == 'selection') {
                        this.session.bindTool('selection_wand', item);
                    } else if (this.editingTool == 'far_selection') {
                        this.session.bindTool('far_selection_wand', item);
                    } else if (this.editingTool == 'navigation') {
                        this.session.bindTool('navigation_wand', item);
                    } else if (this.editingTool == 'stacker') {
                        this.session.bindTool('stacker_wand', item, this.toolData[0], this.toolData[1]);
                    }

                    this.changeState('chooseTool');
                    if (!PlayerUtil.hasItem(this.player, ...item)) {
                        Server.runCommand(`give @s ${item[0]} 1 ${item[1]}`, this.player);
                        this.msg('worldedit.config.setGive.' + this.states.main.editMode);
                    } else {
                        this.msg('worldedit.config.set.' + this.states.main.editMode);
                    }
                } else if (itemType == 'wedit:cancel_button') {
                    this.changeState('editTool');
                }
            },
            tick: () => {
                if (this.editingTool == 'unbind') {
                    this.msg('worldedit.config.confirm.delete');
                    return;
                }

                let msg = RawText.translate('worldedit.config.confirm').append('text', '\n');
                msg = msg.append('translate', `item.wedit:${this.editingTool}_button`).append('text', this.toolData.length ? ':\n ' : '');

                if (this.editingTool == 'sphere') {
                    msg.append('translate', 'worldedit.config.radius').with(this.toolData[0]);
                    let pattern = this.toolData[1][0].getBlockSummary();
                    let mask = this.toolData[1][1].getBlockSummary();
                    if (pattern) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.config.creates').with(pattern);
                    }
                    if (mask) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.config.affects').with(mask);
                    }
                } else if (this.editingTool == 'cylinder') {
                    msg.append('translate', 'worldedit.config.radius').with(this.toolData[0]);
                    msg.append('text', '\n ');
                    msg.append('translate', 'worldedit.config.height').with(this.toolData[1]);
                    let pattern = this.toolData[2][0].getBlockSummary();
                    let mask = this.toolData[2][1].getBlockSummary();

                    if (pattern) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.config.creates').with(pattern);
                    }
                    if (mask) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.config.affects').with(mask);
                    }
                } else if (this.editingTool == 'smooth') {
                    msg.append('translate', 'worldedit.config.radius').with(this.toolData[0]);
                    msg.append('text', '\n ');
                    msg.append('translate', 'worldedit.config.smooth').with(this.toolData[1]);
                    let mask = this.toolData[2].getBlockSummary();

                    if (mask) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.config.affects').with(mask);
                    }
                } else if (this.editingTool == 'stacker') {
                    msg.append('translate', 'worldedit.config.range').with(this.toolData[0]);
                    let mask = this.toolData[1].getBlockSummary();
                    if (mask) {
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.config.affects').with(mask);
                    }
                }
                this.msg(msg);
            }
        }
    };

    private currBindItem: [string, number]; // Id and data value
    private newTool: boolean;
    private editingTool: string = '';
    private toolData: any[] = [];
    private toolMenus: { [k: string]: string[] } = {
        'sphere': ['selectNumber', 'patternAndMask', 'confirmTool'],
        'cylinder': ['selectNumber', 'selectNumber', 'patternAndMask', 'confirmTool'],
        'smooth': ['selectNumber', 'selectNumber', 'mask', 'confirmTool'],
        'stacker': ['selectNumber', 'mask', 'confirmTool']
    }

    private cancelItemUseOn = (ev: BeforeItemUseOnEvent) => {
        if (ev.source.id == 'minecraft:player' && (ev.source as Player).name == this.player.name) {
            ev.cancel = true;
        }
    }
            
    private stashedPattern: Pattern;
    private stashedMask: Mask;

    constructor(session: PlayerSession) {
        this.session = session;
        this.player = session.getPlayer();
        PlayerUtil.stashHotbar(session.getPlayer());
        this.changeState('main');
        Server.on('beforeItemUseOn', this.cancelItemUseOn);
    }

    onTick(ev: TickEvent) {
        this.state?.tick?.();
    }

    onItemUse(ev: BeforeItemUseEvent) {
        if (ev.item) {
            if (this.state?.input?.(ev.item.id, ev.item.data)) {
                ev.cancel = true;
            }
        }
    }

    setHotbarItems(items: hotbarItems) {
        const player = this.player;
        for (let i = 0; i < 9; i++) {
            const [item, data] = Array.isArray(items[i]) ? <[string, number]>items[i] : [<string>items[i] ?? 'wedit:blank', 0];
            Server.runCommand(`replaceitem entity @s slot.hotbar ${i} ${item} 1 ${data} {"minecraft:item_lock":{"mode":"lock_in_slot"}}`, player);
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
        Server.off('beforeItemUseOn', this.cancelItemUseOn);
    }
}