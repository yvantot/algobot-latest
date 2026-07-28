<script>
  import { onMount, onDestroy } from "svelte";
  import * as Blockly from "blockly";
  import "blockly/blocks";
  import { javascriptGenerator } from "blockly/javascript";
  import { CONFIG, DOCUMENT_DATA } from "../game/global/global";
  import { robots, robots_state, UNLOCK_VERSION } from "./global.svelte.js";
  import { trackQuest } from "./global.svelte.js";
  import { createResizable } from "./interface.svelte.js";
  import { createInit } from "../game/global/interpreter.js";

  const resize = createResizable();

  let blocklyDiv;
  let workspace;
  let selected_robot = $state(0);
  let is_command_ready = $state(false);

  const slateTheme = Blockly.Theme.defineTheme("slate", {
    base: Blockly.Themes.Classic,
    blockStyles: {
      logic_blocks: {
        colourPrimary: "#475569",
        colourSecondary: "#334155",
        colourTertiary: "#1e293b",
      },
      loop_blocks: {
        colourPrimary: "#475569",
        colourSecondary: "#334155",
        colourTertiary: "#1e293b",
      },
      math_blocks: {
        colourPrimary: "#475569",
        colourSecondary: "#334155",
        colourTertiary: "#1e293b",
      },
      text_blocks: {
        colourPrimary: "#475569",
        colourSecondary: "#334155",
        colourTertiary: "#1e293b",
      },
      list_blocks: {
        colourPrimary: "#475569",
        colourSecondary: "#334155",
        colourTertiary: "#1e293b",
      },
      variable_blocks: {
        colourPrimary: "#64748b",
        colourSecondary: "#475569",
        colourTertiary: "#334155",
      },
      procedure_blocks: {
        colourPrimary: "#64748b",
        colourSecondary: "#475569",
        colourTertiary: "#334155",
      },
    },
    componentStyles: {
      workspaceBackgroundColour: "#f8fafc",
      toolboxBackgroundColour: "#e2e8f0",
      toolboxForegroundColour: "#334155",
      flyoutBackgroundColour: "#f1f5f9",
      flyoutForegroundColour: "#1e293b",
      flyoutOpacity: 1,
      scrollbarColour: "#94a3b8",
      insertionMarkerColour: "#334155",
      insertionMarkerOpacity: 0.4,
      scrollbarOpacity: 0.6,
      cursorColour: "#6366f1",
    },
  });

  function cropDropdown() {
    const options = [];
    if (DOCUMENT_DATA.crops) {
      for (const [name, item] of Object.entries(DOCUMENT_DATA.crops)) {
        if (item.is_unlocked) {
          options.push([name, name]);
        }
      }
    }
    return options.length > 0 ? options : [["wheat", "wheat"]];
  }

  function registerBlocks() {
    // === BOT ACTIONS ===
    Blockly.Blocks["bot_say"] = {
      init() {
        this.appendValueInput("TEXT").setCheck(null).appendField("bot.say");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#6366f1");
      },
    };
    Blockly.Blocks["bot_jump"] = {
      init() {
        this.appendValueInput("X").setCheck(null).appendField("bot.jump x");
        this.appendValueInput("Y").setCheck(null).appendField("y");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#6366f1");
      },
    };
    Blockly.Blocks["bot_up"] = {
      init() {
        this.appendDummyInput().appendField("bot.up");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#6366f1");
      },
    };
    Blockly.Blocks["bot_down"] = {
      init() {
        this.appendDummyInput().appendField("bot.down");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#6366f1");
      },
    };
    Blockly.Blocks["bot_left"] = {
      init() {
        this.appendDummyInput().appendField("bot.left");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#6366f1");
      },
    };
    Blockly.Blocks["bot_right"] = {
      init() {
        this.appendDummyInput().appendField("bot.right");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#6366f1");
      },
    };
    Blockly.Blocks["bot_wait"] = {
      init() {
        this.appendValueInput("AMOUNT")
          .setCheck("Number")
          .appendField("bot.wait");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#6366f1");
      },
    };

    // === FARM ACTIONS ===
    Blockly.Blocks["bot_till"] = {
      init() {
        this.appendDummyInput().appendField("bot.till");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#854d0e");
      },
    };
    Blockly.Blocks["bot_water"] = {
      init() {
        this.appendDummyInput().appendField("bot.water");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#0369a1");
      },
    };
    Blockly.Blocks["bot_harvest"] = {
      init() {
        this.appendDummyInput().appendField("bot.harvest");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#15803d");
      },
    };
    Blockly.Blocks["bot_plant"] = {
      init() {
        this.appendDummyInput()
          .appendField("bot.plant")
          .appendField(new Blockly.FieldDropdown(cropDropdown), "TYPE");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#15803d");
      },
    };
    Blockly.Blocks["bot_destroy"] = {
      init() {
        this.appendDummyInput().appendField("bot.destroy");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#b91c1c");
      },
    };
    Blockly.Blocks["bot_kill_bug"] = {
      init() {
        this.appendDummyInput().appendField("bot.kill_bug");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#b91c1c");
      },
    };
    Blockly.Blocks["bot_extinguish"] = {
      init() {
        this.appendDummyInput().appendField("bot.extinguish");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#0369a1");
      },
    };

    // === CHECKS ===
    Blockly.Blocks["bot_check_tilled"] = {
      init() {
        this.appendDummyInput().appendField("bot.is_tilled");
        this.setOutput(true, "Boolean");
        this.setColour("#854d0e");
      },
    };
    Blockly.Blocks["bot_check_watered"] = {
      init() {
        this.appendDummyInput().appendField("bot.is_watered");
        this.setOutput(true, "Boolean");
        this.setColour("#0369a1");
      },
    };
    Blockly.Blocks["bot_check_planted"] = {
      init() {
        this.appendDummyInput().appendField("bot.is_planted");
        this.setOutput(true, "Boolean");
        this.setColour("#15803d");
      },
    };
    Blockly.Blocks["bot_is_harvestable"] = {
      init() {
        this.appendDummyInput().appendField("bot.is_harvestable");
        this.setOutput(true, "Boolean");
        this.setColour("#15803d");
      },
    };
    Blockly.Blocks["bot_is_bug"] = {
      init() {
        this.appendDummyInput().appendField("bot.is_bug");
        this.setOutput(true, "Boolean");
        this.setColour("#b91c1c");
      },
    };
    Blockly.Blocks["bot_is_fire"] = {
      init() {
        this.appendDummyInput().appendField("bot.is_fire");
        this.setOutput(true, "Boolean");
        this.setColour("#b91c1c");
      },
    };
    Blockly.Blocks["bot_is_dead"] = {
      init() {
        this.appendDummyInput().appendField("bot.is_dead");
        this.setOutput(true, "Boolean");
        this.setColour("#333333");
      },
    };

    // === GLOBALS & MATH ===
    Blockly.Blocks["math_randint"] = {
      init() {
        this.appendDummyInput()
          .appendField("randint lower")
          .appendField(new Blockly.FieldNumber(0), "LOWER")
          .appendField("upper")
          .appendField(new Blockly.FieldNumber(10), "UPPER");
        this.setOutput(true, "Number");
        this.setColour("#5C68A6");
      },
    };
    Blockly.Blocks["math_randfloat"] = {
      init() {
        this.appendDummyInput()
          .appendField("randfloat lower")
          .appendField(new Blockly.FieldNumber(0), "LOWER")
          .appendField("upper")
          .appendField(new Blockly.FieldNumber(1), "UPPER");
        this.setOutput(true, "Number");
        this.setColour("#5C68A6");
      },
    };
    Blockly.Blocks["global_rows"] = {
      init() {
        this.appendDummyInput().appendField("rows");
        this.setOutput(true, "Number");
        this.setColour("#5C68A6");
      },
    };
    Blockly.Blocks["global_columns"] = {
      init() {
        this.appendDummyInput().appendField("columns");
        this.setOutput(true, "Number");
        this.setColour("#5C68A6");
      },
    };

    // === INVENTORY ===
    Blockly.Blocks["inventory_seeds"] = {
      init() {
        this.appendDummyInput()
          .appendField("inventory.seeds")
          .appendField(new Blockly.FieldDropdown(cropDropdown), "TYPE");
        this.setOutput(true, "Number");
        this.setColour("#745CA6");
      },
    };
    Blockly.Blocks["inventory_coins"] = {
      init() {
        this.appendDummyInput().appendField("inventory.coins");
        this.setOutput(true, "Number");
        this.setColour("#745CA6");
      },
    };

    // === SHOP ===
    Blockly.Blocks["shop_buy_seed"] = {
      init() {
        this.appendValueInput("AMOUNT")
          .setCheck("Number")
          .appendField("shop.buy_seed")
          .appendField(new Blockly.FieldDropdown(cropDropdown), "TYPE")
          .appendField("amount");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#A65C81");
      },
    };
    Blockly.Blocks["shop_buy_row"] = {
      init() {
        this.appendDummyInput().appendField("shop.buy_row");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#A65C81");
      },
    };
    Blockly.Blocks["shop_buy_column"] = {
      init() {
        this.appendDummyInput().appendField("shop.buy_column");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#A65C81");
      },
    };
    Blockly.Blocks["shop_upgrade_bot_action"] = {
      init() {
        this.appendDummyInput()
          .appendField("shop.upgrade_bot_action")
          .appendField(new Blockly.FieldNumber(0, 0), "BOT");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#A65C81");
      },
    };
    Blockly.Blocks["shop_upgrade_bot_check"] = {
      init() {
        this.appendDummyInput()
          .appendField("shop.upgrade_bot_check")
          .appendField(new Blockly.FieldNumber(0, 0), "BOT");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#A65C81");
      },
    };
    Blockly.Blocks["shop_upgrade_bot_move"] = {
      init() {
        this.appendDummyInput()
          .appendField("shop.upgrade_bot_move")
          .appendField(new Blockly.FieldNumber(0, 0), "BOT");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#A65C81");
      },
    };
  }

  function registerGenerators() {
    const O = javascriptGenerator.ORDER_ATOMIC;
    const ON = javascriptGenerator.ORDER_NONE;

    javascriptGenerator.STATEMENT_PREFIX = "highlightBlock(%1);\n";
    javascriptGenerator.addReservedWords("highlightBlock");

    javascriptGenerator.forBlock["bot_say"] = (b) => {
      const text = javascriptGenerator.valueToCode(b, "TEXT", O) || "''";
      return `bot.say(${text});\n`;
    };
    javascriptGenerator.forBlock["bot_jump"] = (b) => {
      const x = javascriptGenerator.valueToCode(b, "X", O) || 0;
      const y = javascriptGenerator.valueToCode(b, "Y", O) || 0;
      return `bot.jump(${x}, ${y});\n`;
    };
    javascriptGenerator.forBlock["bot_up"] = () => `bot.up();\n`;
    javascriptGenerator.forBlock["bot_down"] = () => `bot.down();\n`;
    javascriptGenerator.forBlock["bot_left"] = () => `bot.left();\n`;
    javascriptGenerator.forBlock["bot_right"] = () => `bot.right();\n`;
    javascriptGenerator.forBlock["bot_wait"] = (b) =>
      `bot.wait(${javascriptGenerator.valueToCode(b, "AMOUNT", O) || 0});\n`;

    javascriptGenerator.forBlock["bot_till"] = () => `bot.till();\n`;
    javascriptGenerator.forBlock["bot_water"] = () => `bot.water();\n`;
    javascriptGenerator.forBlock["bot_harvest"] = () => `bot.harvest();\n`;
    javascriptGenerator.forBlock["bot_plant"] = (b) =>
      `bot.plant("${b.getFieldValue("TYPE")}");\n`;
    javascriptGenerator.forBlock["bot_destroy"] = () => `bot.destroy();\n`;
    javascriptGenerator.forBlock["bot_kill_bug"] = () => `bot.kill_bug();\n`;
    javascriptGenerator.forBlock["bot_extinguish"] = () =>
      `bot.extinguish();\n`;

    javascriptGenerator.forBlock["bot_check_tilled"] = () => [
      `bot.is_tilled()`,
      ON,
    ];
    javascriptGenerator.forBlock["bot_check_watered"] = () => [
      `bot.is_watered()`,
      ON,
    ];
    javascriptGenerator.forBlock["bot_check_planted"] = () => [
      `bot.is_planted()`,
      ON,
    ];
    javascriptGenerator.forBlock["bot_is_harvestable"] = () => [
      `bot.is_harvestable()`,
      ON,
    ];
    javascriptGenerator.forBlock["bot_is_bug"] = () => [`bot.is_bug()`, ON];
    javascriptGenerator.forBlock["bot_is_fire"] = () => [`bot.is_fire()`, ON];
    javascriptGenerator.forBlock["bot_is_dead"] = () => [`bot.is_dead()`, ON];

    javascriptGenerator.forBlock["math_randint"] = (b) => [
      `randint(${b.getFieldValue("LOWER")}, ${b.getFieldValue("UPPER")})`,
      ON,
    ];
    javascriptGenerator.forBlock["math_randfloat"] = (b) => [
      `randfloat(${b.getFieldValue("LOWER")}, ${b.getFieldValue("UPPER")})`,
      ON,
    ];
    javascriptGenerator.forBlock["global_rows"] = () => [`rows()`, ON];
    javascriptGenerator.forBlock["global_columns"] = () => [`columns()`, ON];

    javascriptGenerator.forBlock["inventory_seeds"] = (b) => [
      `inventory.seeds("${b.getFieldValue("TYPE")}")`,
      ON,
    ];
    javascriptGenerator.forBlock["inventory_coins"] = () => [
      `inventory.coins()`,
      ON,
    ];

    javascriptGenerator.forBlock["shop_buy_seed"] = (b) =>
      `shop.buy_seed("${b.getFieldValue("TYPE")}", ${javascriptGenerator.valueToCode(b, "AMOUNT", O) || 0});\n`;
    javascriptGenerator.forBlock["shop_buy_row"] = () => `shop.buy_row();\n`;
    javascriptGenerator.forBlock["shop_buy_column"] = () =>
      `shop.buy_column();\n`;
    javascriptGenerator.forBlock["shop_upgrade_bot_action"] = (b) =>
      `shop.upgrade_bot_action(${b.getFieldValue("BOT")});\n`;
    javascriptGenerator.forBlock["shop_upgrade_bot_check"] = (b) =>
      `shop.upgrade_bot_check(${b.getFieldValue("BOT")});\n`;
    javascriptGenerator.forBlock["shop_upgrade_bot_move"] = (b) =>
      `shop.upgrade_bot_move(${b.getFieldValue("BOT")});\n`;
  }

  const BLOCK_UNLOCK_MAP = {
    bot_jump: ["bot_movement", "jump"],
    bot_wait: ["bot_farm_actions", "wait"],
    bot_kill_bug: ["bot_farm_actions", "kill_bug"],
    bot_extinguish: ["bot_farm_actions", "extinguish"],
    bot_check_tilled: ["bot_checks", "is_tilled"],
    bot_check_watered: ["bot_checks", "is_watered"],
    bot_check_planted: ["bot_checks", "is_planted"],
    bot_is_harvestable: ["bot_checks", "is_harvestable"],
    bot_is_bug: ["bot_checks", "is_bug"],
    bot_is_fire: ["bot_checks", "is_fire"],
    bot_is_dead: ["bot_checks", "is_dead"],
    shop_buy_seed: ["shop", "buy_seed"],
    shop_buy_row: ["shop", "buy_row"],
    shop_buy_column: ["shop", "buy_column"],
    shop_upgrade_bot_action: ["shop", "upgrade_bot_action"],
    shop_upgrade_bot_check: ["shop", "upgrade_bot_check"],
    shop_upgrade_bot_move: ["shop", "upgrade_bot_move"],
    controls_if: ["syntax", "if"],
    logic_compare: ["syntax", "if"],
    logic_operation: ["syntax", "if"],
    logic_negate: ["syntax", "!"],
    logic_boolean: ["syntax", "true"],
    controls_repeat_ext: ["syntax", "for"],
    controls_whileUntil: ["syntax", "while"],
    controls_for: ["syntax", "for"],
    controls_flow_statements: ["syntax", "break"],
    math_randint: ["globals", "randint"],
    math_randfloat: ["globals", "randfloat"],
    global_rows: ["globals", "rows"],
    global_columns: ["globals", "columns"],
  };

  function isBlockUnlocked(blockType) {
    const map = BLOCK_UNLOCK_MAP[blockType];
    if (!map) return true;
    return DOCUMENT_DATA[map[0]]?.[map[1]]?.is_unlocked ?? true;
  }

  function buildToolbox() {
    const rawCategories = [
      {
        kind: "category",
        name: "🤖  Bot",
        colour: "#6366f1",
        contents: [
          {
            kind: "block",
            type: "bot_say",
            inputs: {
              TEXT: { shadow: { type: "text", fields: { TEXT: "Hello!" } } },
            },
          },
          {
            kind: "block",
            type: "bot_jump",
            inputs: {
              X: { shadow: { type: "math_number", fields: { NUM: 0 } } },
              Y: { shadow: { type: "math_number", fields: { NUM: 0 } } },
            },
          },
          { kind: "block", type: "bot_up" },
          { kind: "block", type: "bot_down" },
          { kind: "block", type: "bot_left" },
          { kind: "block", type: "bot_right" },
          {
            kind: "block",
            type: "bot_wait",
            inputs: {
              AMOUNT: { shadow: { type: "math_number", fields: { NUM: 1 } } },
            },
          },
        ],
      },
      {
        kind: "category",
        name: "🌾  Farm",
        colour: "#15803d",
        contents: [
          { kind: "block", type: "bot_till" },
          { kind: "block", type: "bot_water" },
          { kind: "block", type: "bot_harvest" },
          { kind: "block", type: "bot_plant" },
          { kind: "block", type: "bot_destroy" },
          { kind: "block", type: "bot_kill_bug" },
          { kind: "block", type: "bot_extinguish" },
        ],
      },
      {
        kind: "category",
        name: "🔍  Check",
        colour: "#0369a1",
        contents: [
          { kind: "block", type: "bot_check_tilled" },
          { kind: "block", type: "bot_check_watered" },
          { kind: "block", type: "bot_check_planted" },
          { kind: "block", type: "bot_is_harvestable" },
          { kind: "block", type: "bot_is_bug" },
          { kind: "block", type: "bot_is_fire" },
          { kind: "block", type: "bot_is_dead" },
        ],
      },
      {
        kind: "category",
        name: "💰  Shop",
        colour: "#A65C81",
        contents: [
          {
            kind: "block",
            type: "shop_buy_seed",
            inputs: {
              AMOUNT: { shadow: { type: "math_number", fields: { NUM: 1 } } },
            },
          },
          { kind: "block", type: "shop_buy_row" },
          { kind: "block", type: "shop_buy_column" },
          { kind: "block", type: "shop_upgrade_bot_action" },
          { kind: "block", type: "shop_upgrade_bot_check" },
          { kind: "block", type: "shop_upgrade_bot_move" },
        ],
      },
      {
        kind: "category",
        name: "🎒  Inventory",
        colour: "#745CA6",
        contents: [
          { kind: "block", type: "inventory_seeds" },
          { kind: "block", type: "inventory_coins" },
        ],
      },
      {
        kind: "category",
        name: "🔢  Logic",
        colour: "#5C81A6",
        contents: [
          { kind: "block", type: "controls_if" },
          { kind: "block", type: "logic_compare" },
          { kind: "block", type: "logic_operation" },
          { kind: "block", type: "logic_negate" },
          { kind: "block", type: "logic_boolean" },
        ],
      },
      {
        kind: "category",
        name: "🔁  Loops",
        colour: "#5CA65C",
        contents: [
          {
            kind: "block",
            type: "controls_repeat_ext",
            inputs: {
              TIMES: { shadow: { type: "math_number", fields: { NUM: 10 } } },
            },
          },
          { kind: "block", type: "controls_whileUntil" },
          {
            kind: "block",
            type: "controls_for",
            inputs: {
              FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } },
              TO: { shadow: { type: "math_number", fields: { NUM: 10 } } },
              BY: { shadow: { type: "math_number", fields: { NUM: 1 } } },
            },
          },
          { kind: "block", type: "controls_flow_statements" },
        ],
      },
      {
        kind: "category",
        name: "🔣  Math",
        colour: "#5C68A6",
        contents: [
          { kind: "block", type: "math_number", fields: { NUM: 0 } },
          { kind: "block", type: "math_arithmetic" },
          { kind: "block", type: "math_randint" },
          { kind: "block", type: "math_randfloat" },
          { kind: "block", type: "global_rows" },
          { kind: "block", type: "global_columns" },
        ],
      },
      {
        kind: "category",
        name: "📝  Text",
        colour: "#5CA68D",
        contents: [
          { kind: "block", type: "text", fields: { TEXT: "" } },
          { kind: "block", type: "text_join" },
          {
            kind: "block",
            type: "text_append",
            inputs: {
              TEXT: { shadow: { type: "text", fields: { TEXT: "" } } },
            },
          },
          { kind: "block", type: "text_length" },
          { kind: "block", type: "text_isEmpty" },
        ],
      },
      {
        kind: "category",
        name: "📋  Arrays",
        colour: "#0891b2",
        contents: [
          { kind: "block", type: "lists_create_with" },
          { kind: "block", type: "lists_create_empty" },
          {
            kind: "block",
            type: "lists_repeat",
            inputs: {
              NUM: { shadow: { type: "math_number", fields: { NUM: 5 } } },
            },
          },
          { kind: "block", type: "lists_length" },
          { kind: "block", type: "lists_isEmpty" },
          { kind: "block", type: "lists_indexOf" },
          { kind: "block", type: "lists_getIndex" },
          { kind: "block", type: "lists_setIndex" },
          { kind: "block", type: "lists_getSublist" },
          { kind: "block", type: "lists_sort" },
          {
            kind: "block",
            type: "lists_split",
            inputs: {
              DELIM: { shadow: { type: "text", fields: { TEXT: "," } } },
            },
          },
        ],
      },
    ];

    const finalCategories = [];

    for (const cat of rawCategories) {
      const filteredContents = cat.contents.filter((item) =>
        isBlockUnlocked(item.type),
      );
      if (filteredContents.length > 0) {
        finalCategories.push({ ...cat, contents: filteredContents });
      }
    }

    if (DOCUMENT_DATA.syntax.var?.is_unlocked) {
      finalCategories.push({
        kind: "category",
        name: "📦  Variables",
        colour: "#A65C81",
        custom: "VARIABLE",
      });
    }

    if (DOCUMENT_DATA.syntax["function"]?.is_unlocked) {
      finalCategories.push({
        kind: "category",
        name: "⚙️  Functions",
        colour: "#9A5CA6",
        custom: "PROCEDURE",
      });
    }

    return {
      kind: "categoryToolbox",
      contents: finalCategories,
    };
  }

  const START_XML = `<xml>
    <block type="bot_say">
      <value name="TEXT">
        <shadow type="text">
          <field name="TEXT">Hello!</field>
        </shadow>
      </value>
    </block>
  </xml>`;

  $effect(() => {
    robots.forEach((bot, index) => {
      if (!robots_state[index]) {
        robots_state[index] = {
          robot: bot,
          text_code: `// Robot ${index} Script\nbot.right()\nbot.down()\nbot.left()\nbot.up()`,
          block_code: ``,
          interpreter: null,
          is_running: false,
          interval: null,
        };
      }
      if (robots_state[index].blockly_xml === undefined) {
        robots_state[index].blockly_xml = START_XML;
      }
      if (robots_state[index].block_code === undefined) {
        robots_state[index].block_code = ``;
      }
    });
  });

  // JS-Interpreter execution loop logic
  function isLine(stack) {
    var state = stack[stack.length - 1];
    var node = state.node;
    var type = node.type;

    if (type !== "VariableDeclaration" && type.substr(-9) !== "Statement") {
      return false;
    }

    if (type === "BlockStatement") {
      return false;
    }

    if (
      type === "VariableDeclaration" &&
      stack[stack.length - 2].node.type === "ForStatement"
    ) {
      return false;
    }

    if (isLine.oldStack_[isLine.oldStack_.length - 1] === state) {
      return false;
    }

    if (
      isLine.oldStack_.indexOf(state) !== -1 &&
      type !== "ForStatement" &&
      type !== "WhileStatement" &&
      type !== "DoWhileStatement"
    ) {
      return false;
    }

    isLine.oldStack_ = stack.slice();
    return true;
  }
  isLine.oldStack_ = [];

  function handleResetAll() {
    robots_state.forEach((_, index) => {
      handleReset(index);
    });
  }

  function handleStartAll() {
    robots_state.forEach((_, index) => {
      if (!robots_state[index].is_running) {
        handleStart(index);
      }
    });
  }

  function handleStepAll() {
    robots_state.forEach((_, index) => {
      if (!robots_state[index].is_running) {
        handleStep(index);
      }
    });
  }

  function handleStep(index) {
    if (!robots_state[index].interpreter) {
      if (index === selected_robot && workspace) {
        robots_state[index].block_code =
          javascriptGenerator.workspaceToCode(workspace);
      }
      robots_state[index].interpreter = new Interpreter(
        robots_state[index].block_code,
        createInit(
          robots_state[index].robot,
          index === selected_robot ? workspace : null,
          trackQuest,
        ),
      );
    }

    var stack = robots_state[index].interpreter.getStateStack();
    var step_again = !isLine(stack);

    if (stack.length > 0) {
      const node = stack[stack.length - 1].node;
      if (node && node.type === "ForStatement") trackQuest("cs_loop_0", 1);
      if (node && node.type === "IfStatement") trackQuest("cs_if_0", 1);
    }

    try {
      var ok = robots_state[index].interpreter.step();
    } finally {
      if (!ok) {
        handleReset(index);
        step_again = false;
      }
    }

    if (step_again) {
      try {
        handleStep(index);
      } catch (error) {
        null;
      }
    }
  }

  function handleStart(index) {
    if (index === selected_robot && workspace) {
      robots_state[index].block_code =
        javascriptGenerator.workspaceToCode(workspace);
    }
    robots_state[index].interpreter = new Interpreter(
      robots_state[index].block_code,
      createInit(
        robots_state[index].robot,
        index === selected_robot ? workspace : null,
        trackQuest,
      ),
    );
    robots_state[index].is_running = !robots_state[index].is_running;

    clearInterval(robots_state[index].interval);

    if (robots_state[index].is_running) {
      robots_state[index].interval = setInterval(() => {
        if (robots_state[index].is_running) {
          handleStep(index);
        }
      }, 0);
    }
  }

  function handleReset(index) {
    robots_state[index].interpreter = null;
    robots_state[index].is_running = false;
    clearInterval(robots_state[index].interval);
    if (index === selected_robot && workspace) {
      workspace.highlightBlock(null);
    }
  }

  function selectRobot(index) {
    if (workspace && robots_state[selected_robot]) {
      const dom = Blockly.Xml.workspaceToDom(workspace);
      robots_state[selected_robot].blockly_xml = Blockly.Xml.domToText(dom);
      robots_state[selected_robot].block_code =
        javascriptGenerator.workspaceToCode(workspace);
    }

    selected_robot = index;

    if (workspace && robots_state[selected_robot]) {
      workspace.clear();
      Blockly.Xml.domToWorkspace(
        Blockly.utils.xml.textToDom(robots_state[selected_robot].blockly_xml),
        workspace,
      );
    }
  }

  onMount(() => {
    setTimeout(() => (is_command_ready = true), 2000);
    registerBlocks();
    registerGenerators();

    workspace = Blockly.inject(blocklyDiv, {
      toolbox: buildToolbox(),
      theme: slateTheme,
      grid: { spacing: 20, length: 3, colour: "#cbd5e1", snap: true },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      trashcan: true,
      sounds: false,
      renderer: "zelos",
      scrollbars: true,
    });

    workspace.addChangeListener(() => {
      if (robots_state[selected_robot]) {
        robots_state[selected_robot].block_code =
          javascriptGenerator.workspaceToCode(workspace);
      }
    });

    if (
      robots_state[selected_robot] &&
      robots_state[selected_robot].blockly_xml
    ) {
      Blockly.Xml.domToWorkspace(
        Blockly.utils.xml.textToDom(robots_state[selected_robot].blockly_xml),
        workspace,
      );
    } else {
      Blockly.Xml.domToWorkspace(
        Blockly.utils.xml.textToDom(START_XML),
        workspace,
      );
    }
  });

  // Dynamically update toolbox whenever unlock version changes
  $effect(() => {
    const _ = UNLOCK_VERSION.count;
    if (workspace) {
      workspace.updateToolbox(buildToolbox());
    }
  });

  // Notify Blockly to reflow its SVG whenever the panel is resized
  $effect(() => {
    const _ = resize.width; // track reactive dependency
    if (workspace) {
      Blockly.svgResize(workspace);
    }
  });

  onDestroy(() => {
    if (workspace && robots_state[selected_robot]) {
      const dom = Blockly.Xml.workspaceToDom(workspace);
      robots_state[selected_robot].blockly_xml = Blockly.Xml.domToText(dom);
    }
    workspace?.dispose();
  });
</script>

<div
  style="width: {resize.width}px;"
  class="text-slate-700 h-[95vh] bottom-4 flex flex-col w-[30vw] bg-gray-100 border-4 border-slate-500 rounded-xl shadow-xl overflow-hidden text-sm z-50"
>
  <div
    role="separator"
    class="resize-handle {resize.is_resizing ? 'resizing-active' : ''}"
    onmousedown={resize.startResize}
  ></div>
  <div class="py-2 border-b-2 border-slate-400">
    <h1 class="text-center font-bold text-base">Bot Command</h1>
  </div>

  <div>
    <div
      class="flex flex-wrap bg-slate-200 border-b-2 border-slate-400 shrink-0"
    >
      {#each robots as robot, index}
        <button
          onclick={() => selectRobot(index)}
          class:opacity-100={selected_robot === index}
          class="opacity-80 border-r-2 border-slate-600 px-3 py-1 bg-[#262737] text-[#82F54C] flex-grow text-center cursor-pointer select-none bot-index-font"
          >BOT {robot.display_text}</button
        >
      {/each}
    </div>
  </div>

  <div class="flex-1 bg-white min-h-0 overflow-hidden relative">
    <div class="absolute inset-0 w-full h-full" bind:this={blocklyDiv}></div>
  </div>

  <div
    class="p-2 bg-slate-200 border-t-2 border-slate-400 flex flex-col gap-2 shrink-0"
  >
    <div class="grid grid-cols-3 gap-2">
      {#if robots_state[selected_robot]}
        <button
          disabled={!is_command_ready}
          onclick={() => handleStart(selected_robot)}
          class="btn-primary"
          >{robots_state[selected_robot].is_running ? "Stop" : "Start"}</button
        >
        <button
          onclick={() => handleStep(selected_robot)}
          class="btn-primary"
          disabled={!is_command_ready ||
            robots_state[selected_robot].is_running}>Step</button
        >
        <button
          disabled={!is_command_ready}
          onclick={() => handleReset(selected_robot)}
          class="btn-primary">Reset</button
        >
      {/if}
    </div>
  </div>
  {#if robots.length > 1}
    <div
      class="p-2 bg-slate-300 border-t-2 border-slate-400 flex flex-col gap-2 shrink-0"
    >
      <div class="grid grid-cols-3 gap-2">
        <button
          disabled={!is_command_ready}
          onclick={handleStartAll}
          class="btn-primary">{false ? "Stop All" : "Start All"}</button
        >
        <button
          disabled={!is_command_ready}
          onclick={handleStepAll}
          class="btn-primary">Step All</button
        >
        <button
          disabled={!is_command_ready}
          onclick={handleResetAll}
          class="btn-primary">Reset All</button
        >
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.blocklyMainBackground) {
    fill: #ffffff !important;
  }
  :global(.blocklyToolboxDiv) {
    background: #e2e8f0 !important;
    border-right: 2px solid #94a3b8 !important;
  }
  :global(.blocklyTreeRow) {
    border-radius: 4px !important;
    margin: 1px 4px !important;
  }
  :global(.blocklyTreeRow:hover) {
    background: #cbd5e1 !important;
  }
  :global(.blocklyTreeSelected) {
    background: #94a3b8 !important;
  }
  :global(.blocklyTreeLabel) {
    font-family: ui-sans-serif, system-ui, sans-serif !important;
    font-size: 12.5px !important;
    font-weight: 600 !important;
    color: #334155 !important;
  }
  :global(.blocklyFlyoutBackground) {
    fill: #f1f5f9 !important;
    fill-opacity: 1 !important;
  }
  :global(.blocklyScrollbarKnob) {
    fill: #94a3b8 !important;
    fill-opacity: 0.8 !important;
  }
  :global(.blocklyScrollbarBackground) {
    fill: transparent !important;
  }
  /* Hide scrollbar inside the toolbox flyout panel */
  :global(.blocklyFlyoutScrollbar) {
    display: none !important;
  }
</style>
