import { Server } from '../../library/Minecraft.js';
import { PlayerUtil } from './player_util.js';
import { Pattern } from './pattern.js';
import { Mask } from './mask.js';
import { RawText } from './rawtext.js';
import { print } from '../util.js';
import { SphereBrush } from '../brushes/sphere_brush.js';
import { CylinderBrush } from '../brushes/cylinder_brush.js';
export class SettingsHotbar {
    constructor(session) {
        this.state = 'main';
        this.menus = {
            main: {
                0: 'wedit:inc_entities_on_button',
                1: 'wedit:inc_air_on_button',
                4: 'wedit:brush_config_button',
                8: ['wedit:cancel_button', 1]
            },
            chooseBrush: {
                1: 'wedit:wooden_brush',
                2: 'wedit:stone_brush',
                3: 'wedit:iron_brush',
                4: 'wedit:golden_brush',
                5: 'wedit:diamond_brush',
                6: 'wedit:netherite_brush',
                8: 'wedit:cancel_button'
            },
            editBrush: {
                3: 'wedit:sphere_button',
                5: 'wedit:cylinder_button',
                8: 'wedit:cancel_button'
            },
            selectNumber: {
                1: 'wedit:one_button',
                2: 'wedit:two_button',
                3: 'wedit:three_button',
                4: 'wedit:four_button',
                5: 'wedit:five_button',
                6: 'wedit:six_button',
                8: 'wedit:cancel_button'
            },
            patternAndMask: {
                3: 'wedit:pattern_picker',
                5: 'wedit:mask_picker',
                7: 'wedit:confirm_button',
                8: 'wedit:cancel_button'
            },
            confirmBrush: {
                3: 'wedit:confirm_button',
                5: 'wedit:cancel_button'
            }
        };
        this.states = {
            main: {
                enterState: () => {
                    const player = this.session.getPlayer();
                    if (this.session.includeEntities) {
                        PlayerUtil.replaceItem(player, 'wedit:inc_entities_off_button', 'wedit:inc_entities_on_button');
                    }
                    else {
                        PlayerUtil.replaceItem(player, 'wedit:inc_entities_on_button', 'wedit:inc_entities_off_button');
                    }
                    if (this.session.includeAir) {
                        PlayerUtil.replaceItem(player, 'wedit:inc_air_off_button', 'wedit:inc_air_on_button');
                    }
                    else {
                        PlayerUtil.replaceItem(player, 'wedit:inc_air_on_button', 'wedit:inc_air_off_button');
                    }
                },
                processState: () => {
                    const player = this.session.getPlayer();
                    if (this.removeTag('config_include_entities_off')) {
                        this.session.includeEntities = false;
                        PlayerUtil.replaceItem(player, 'wedit:inc_entities_on_button', 'wedit:inc_entities_off_button');
                    }
                    else if (this.removeTag('config_include_entities_on')) {
                        this.session.includeEntities = true;
                        PlayerUtil.replaceItem(player, 'wedit:inc_entities_off_button', 'wedit:inc_entities_on_button');
                    }
                    else if (this.removeTag('config_include_air_off')) {
                        this.session.includeAir = false;
                        PlayerUtil.replaceItem(player, 'wedit:inc_air_on_button', 'wedit:inc_air_off_button');
                    }
                    else if (this.removeTag('config_include_air_on')) {
                        this.session.includeAir = true;
                        PlayerUtil.replaceItem(player, 'wedit:inc_air_off_button', 'wedit:inc_air_on_button');
                    }
                    else if (this.removeTag('config_brush_config')) {
                        this.changeState('chooseBrush');
                    }
                    else if (this.removeTag('config_cancel')) {
                        this.exit();
                    }
                }
            },
            chooseBrush: {
                enterState: () => {
                    this.msg('worldedit.brush-config.choose-brush');
                },
                processState: () => {
                    if (this.removeTag('use_wooden_brush')) {
                        this.currBrushTier = 'wooden_brush';
                        this.changeState('editBrush');
                    }
                    else if (this.removeTag('use_stone_brush')) {
                        this.currBrushTier = 'stone_brush';
                        this.changeState('editBrush');
                    }
                    else if (this.removeTag('use_iron_brush')) {
                        this.currBrushTier = 'iron_brush';
                        this.changeState('editBrush');
                    }
                    else if (this.removeTag('use_golden_brush')) {
                        this.currBrushTier = 'golden_brush';
                        this.changeState('editBrush');
                    }
                    else if (this.removeTag('use_diamond_brush')) {
                        this.currBrushTier = 'diamond_brush';
                        this.changeState('editBrush');
                    }
                    else if (this.removeTag('use_netherite_brush')) {
                        this.currBrushTier = 'netherite_brush';
                        this.changeState('editBrush');
                    }
                    else if (this.removeTag('config_cancel')) {
                        this.changeState('main');
                    }
                }
            },
            editBrush: {
                enterState: () => {
                    this.editingBrush = '';
                    this.brushData = [];
                    this.msg('worldedit.brush-config.choose-kind');
                },
                processState: () => {
                    if (this.removeTag('config_sphere')) {
                        this.editingBrush = 'sphere';
                        this.changeState(this.brushMenus['sphere'][0]);
                    }
                    else if (this.removeTag('config_cylinder')) {
                        this.editingBrush = 'cylinder';
                        this.changeState(this.brushMenus['cylinder'][0]);
                    }
                    else if (this.removeTag('config_cancel')) {
                        this.changeState('chooseBrush');
                    }
                }
            },
            selectNumber: {
                enterState: () => {
                    if (this.brushData.length == 0) {
                        this.msg('worldedit.brush-config.select-radius');
                    }
                    else if (this.brushData.length == 1 && this.editingBrush == 'cylinder') {
                        this.msg('worldedit.brush-config.select-height');
                    }
                },
                processState: () => {
                    let num;
                    if (this.removeTag('config_one')) {
                        num = 1;
                    }
                    else if (this.removeTag('config_two')) {
                        num = 2;
                    }
                    else if (this.removeTag('config_three')) {
                        num = 3;
                    }
                    else if (this.removeTag('config_four')) {
                        num = 4;
                    }
                    else if (this.removeTag('config_five')) {
                        num = 5;
                    }
                    else if (this.removeTag('config_six')) {
                        num = 6;
                    }
                    else if (this.removeTag('config_cancel')) {
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
                enterState: () => {
                    this.stashedPattern = this.session.globalPattern;
                    this.stashedMask = this.session.globalMask;
                    this.session.globalPattern = new Pattern();
                    this.session.globalMask = new Mask();
                    this.msg('worldedit.brush-config.pattern-mask');
                },
                processState: () => {
                    if (this.removeTag('config_confirm')) {
                        this.brushData.push([this.session.globalPattern, this.session.globalMask]);
                        this.changeState(this.brushMenus[this.editingBrush][this.brushData.length]);
                    }
                    else if (this.removeTag('config_cancel')) {
                        this.changeState('editBrush');
                    }
                },
                exitState: () => {
                    this.session.globalPattern = this.stashedPattern;
                    this.session.globalMask = this.stashedMask;
                }
            },
            confirmBrush: {
                processState: () => {
                    let msg = RawText.translate('worldedit.brush-config.confirm').append('text', '\n');
                    msg = msg.append('translate', `item.wedit:${this.editingBrush}_button`).append('text', this.brushData.length ? ':\n ' : '');
                    if (this.editingBrush == 'sphere') {
                        msg.append('translate', 'worldedit.brush-config.radius').with(this.brushData[0]);
                        let pattern = this.brushData[1][0].getBlockSummary();
                        let mask = this.brushData[1][1].getBlockSummary();
                        if (pattern) {
                            msg.append('text', '\n ');
                            msg.append('translate', 'worldedit.brush-config.creates').with(pattern);
                        }
                        if (mask) {
                            msg.append('text', '\n ');
                            msg.append('translate', 'worldedit.brush-config.affects').with(mask);
                        }
                    }
                    else if (this.editingBrush == 'cylinder') {
                        msg.append('translate', 'worldedit.brush-config.radius').with(this.brushData[0]);
                        msg.append('text', '\n ');
                        msg.append('translate', 'worldedit.brush-config.height').with(this.brushData[1]);
                        let pattern = this.brushData[2][0].getBlockSummary();
                        let mask = this.brushData[2][1].getBlockSummary();
                        if (pattern) {
                            msg.append('text', '\n ');
                            msg.append('translate', 'worldedit.brush-config.creates').with(pattern);
                        }
                        if (mask) {
                            msg.append('text', '\n ');
                            msg.append('translate', 'worldedit.brush-config.affects').with(mask);
                        }
                    }
                    this.msg(msg);
                    if (this.removeTag('config_confirm')) {
                        if (this.editingBrush == 'sphere') {
                            this.session.setTool(this.currBrushTier, new SphereBrush(this.brushData[0], this.brushData[1][0], false));
                            this.session.setToolProperty(this.currBrushTier, 'mask', this.brushData[1][1]);
                        }
                        else if (this.editingBrush == 'cylinder') {
                            this.session.setTool(this.currBrushTier, new CylinderBrush(this.brushData[0], this.brushData[1], this.brushData[2][0], false));
                            this.session.setToolProperty(this.currBrushTier, 'mask', this.brushData[2][1]);
                        }
                        this.msg('worldedit.brush-config.set');
                        this.changeState('main');
                    }
                    else if (this.removeTag('config_cancel')) {
                        this.changeState('editBrush');
                    }
                }
            }
        };
        this.editingBrush = '';
        this.brushData = [];
        this.brushMenus = {
            'sphere': ['selectNumber', 'patternAndMask', 'confirmBrush'],
            'cylinder': ['selectNumber', 'selectNumber', 'patternAndMask', 'confirmBrush']
        };
        this.session = session;
        PlayerUtil.stashHotbar(session.getPlayer());
        this.changeState('main');
    }
    onTick(tick) {
        this.states[this.state].processState();
    }
    setHotbarItems(items) {
        const player = this.session.getPlayer();
        for (let i = 0; i < 9; i++) {
            const [item, data] = Array.isArray(items[i]) ? items[i] : [items[i] ?? 'wedit:blank', 0];
            Server.runCommand(`replaceitem entity "${player.nameTag}" slot.hotbar ${i} ${item} 1 ${data} {"minecraft:item_lock":{"mode":"lock_in_slot"}}`);
        }
    }
    changeState(state) {
        this.states[this.state].exitState?.();
        this.state = state;
        this.setHotbarItems(this.menus[state]);
        this.states[this.state].enterState?.();
    }
    msg(msg, ...sub) {
        let raw = msg;
        if (typeof msg == 'string') {
            raw = RawText.translate(msg);
            for (const text of sub)
                raw = raw.with(text);
        }
        print(raw, this.session.getPlayer(), true);
    }
    removeTag(tag) {
        return !Server.runCommand(`tag "${this.session.getPlayer().nameTag}" remove wedit:${tag}`).error;
    }
    exit() {
        PlayerUtil.restoreHotbar(this.session.getPlayer());
        this.session.settingsHotbar = null;
        this.session = null;
    }
}
