import { contentLog, Server } from "@notbeer-api";

Server.uiForms.register("$configMenu", {
  "title": "Config Menu",
  "buttons": [
    {
      "text": "Clipboard Options",
      "icon": "textures/items/paste",
      "action": (_, ctx) => ctx.goto("$clipboardOptions")
    },
    {
      "text": "Tools",
      "icon": "textures/ui/tool_config",
      "action": (_, ctx) => null
    },
    {
      "text": "Brushes",
      "icon": "textures/ui/brush_config",
      "action": () => null
    }
  ],
  "cancel": () => null
});

Server.uiForms.register("$clipboardOptions", {
  "title": "Clipboard Options",
  "inputs": {
    "$includeEntities": {
      "name": "Include Entities",
      "type": "toggle",
      "default": false
    },
    "$includeAir": {
      "name": "Include Air",
      "type": "toggle",
      "default": false
    }
  },
  "submit": (_, ctx, input) => {
    contentLog.debug("Include Entities", input.$includeEntities);
    contentLog.debug("Include Air", input.$includeAir);
    ctx.returnto("$configMenu");
  },
  "cancel": (_, ctx) => ctx.returnto("$configMenu")
});