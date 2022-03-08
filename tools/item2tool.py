import os, re, json5 as json

dirBP = '../temp/BP/items'
dirRP = '../temp/RP/items'
dirTool = '../BP/items/tools'

baseitems = [];

def savejson(path, data):
    with open(path, 'w') as f:
        js = json.dumps(data, indent=4)
        js = re.sub(r'\n(\s+)([^"\n]+?): ', r'\n\1"\2": ', js)
        js = re.sub(r',(\n\s*[}\]])', r'\1', js)
        f.write(js)

with open('../temp/RP/textures/item_texture.json') as f:
    baseTex = json.load(f)['texture_data']
with open('../RP/textures/item_texture.json') as f:
    itemTex = json.load(f)

for filename in os.listdir(dirBP):
    tool = {
        'format_version': '1.16.100',
        'minecraft:item': {
            'description': {
                'category': 'commands'
            },
            'components': {
                'minecraft:max_stack_size': 1,
                'minecraft:foil': True,
                'minecraft:liquid_clipped': True,
                'minecraft:on_use': {
                    'on_use': {
                        'event': 'wedit:on_use'
                    }
                }
            },
            'events': {
                'wedit:on_use': {}
            }
        }
    }
    toolitem = tool['minecraft:item']
    toolcomp = toolitem['components']
    
    with open(os.path.join(dirBP, filename)) as f:
        itemBP = json.load(f)['minecraft:item']
        desc = itemBP['description']
        print(desc['identifier'])
        baseitems.append(desc['identifier'])
        comp = itemBP.get('components', {})
    with open(os.path.join(dirRP, filename)) as f:
        itemRP = json.load(f)['minecraft:item']
        compRP = itemRP.get('components', {})
        defaultname = 'item.' + desc['identifier'].replace('minecraft:', '') + '.name'
        displayname = itemRP['components'].get('minecraft:display_name', {'value': defaultname})
        if not 'value' in displayname:
            displayname['value'] = defaultname
    
    toolitem['description']['identifier'] = desc['identifier'].replace('minecraft:', 'wedit:_tool_')
    toolcomp['minecraft:display_name'] = displayname
    
    for component in ['minecraft:render_offsets', 'minecraft:icon', 'minecraft:hand_equipped', 'minecraft:mining_speed', 'minecraft:damage', 'minecraft:can_destroy_in_creative', 'minecraft:digger']:
        if component in comp:
            toolcomp[component] = comp[component]
        elif component in compRP:
            toolcomp[component] = compRP[component]
    
    icon = toolcomp['minecraft:icon']
    if isinstance(icon, str):
        icon = {
            'texture': icon,
        }
        toolcomp['minecraft:icon'] = icon
    elif 'frame_index' in icon:
        icon['frame'] = icon['frame_index']
        del icon['frame_index']
    
    frame = icon.get('frame', 0)
    if frame:
        texture = baseTex[icon['texture']]['textures'][frame]
        itemTex['texture_data'][f'{icon["texture"]}_{frame}'] = {
            'textures': texture
        }
        icon['texture'] += f'_{frame}'
        icon['frame'] = 0
    
    savejson(os.path.join(dirTool, filename), tool)

savejson('../RP/textures/item_texture.json', itemTex)

with open('../src/server/tools/tool_manager.ts', 'r+') as f:
    file = f.read()
    file = re.sub(r'(// AUTO GENERATED\n).+?(\n// AUTO GENERATED)', rf'\1const baseItems = {json.dumps(baseitems)};\2', file)
    f.seek(0)
    f.write(file)