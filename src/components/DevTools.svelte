<!-- 
    This is enough for now, but for future improvement, I suggest:
    - Timeline editor (so timings is easier to edit)
    - Copy text is just copy paste, no need to download
    - KAPLAY to editor, editor to KAPLAY (already exists)
    - Replay the animation when a property was deleted
    - Add an image and edit the animation, currently this tool operates on the current
-->
<script>
  import { k } from "../lib/kaplay.js";

  const anchor = ["bot", "botleft", "topleft", "top", "topright", "left", "center", "right", "botright"];
  const direction = ["forward", "reverse", "ping-pong"];
  const interpolation = ["linear", "none", "slerp", "spline"];
  const easings = ["linear", "easeInSine", "easeOutSine", "easeInOutSine", "easeInQuad", "easeOutQuad", "easeInOutQuad", "easeInCubic", "easeOutCubic", "easeInOutCubic", "easeInQuart", "easeOutQuart", "easeInOutQuart", "easeInQuint", "easeOutQuint", "easeInOutQuint", "easeInExpo", "easeOutExpo", "easeInOutExpo", "easeInCirc", "easeOutCirc", "easeInOutCirc", "easeInBack", "easeOutBack", "easeInOutBack", "easeInElastic", "easeOutElastic", "easeInOutElastic", "easeInBounce", "easeOutBounce", "easeInOutBounce"];
  const obj_properties = [
    {
      name: "pos",
      description: "Position only accepts vector2 (x,y)",
      example: "(200, 200) > (250, 200) > (250, 250)",
    },
    {
      name: "scale",
      description: "Scale only accepts vector2 (x,y), in scale 1 is the normal scale",
      example: "(1, 1.5) > (1, 1.3) > (1, 1)",
    },
    {
      name: "angle",
      description: "Rotation only accepts numbers in degrees",
      example: "0 > 40 > 80 > 160",
    },
    {
      name: "color",
      description: "Color RGB",
      example: "(0, 255, 255) > (0, 200, 200)",
    },
    {
      name: "opacity",
      description: "Opacity only accepts numbers between 0 and 1",
      example: "1 > 0.5 > 0.3 > 0",
    },
  ];

  let objs = [];
  let objs_id = $state([]);
  let animation = $state({});

  let selected_id = $state(null);
  let loaded = $state(false);

  function animationAsText() {
    if (!selected_id || !animation[selected_id]) {
      k.debug.log("No animation selected!");
      k.addKaboom(k.center());
      return;
    }

    const objName = selected_id;
    const anims = Object.keys(animation[selected_id]);
    let output = "";

    for (let property of anims) {
      const config = animation[selected_id][property];

      const raw_values = config.value
        .replaceAll(/ +/g, "")
        .split(">")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      const values = raw_values.map((v) => {
        if (v.startsWith("(") && v.endsWith(")")) {
          const inside = v.slice(1, -1);
          const nums = inside.split(",").map((n) => n.trim());

          if (property === "pos" || property === "scale") {
            return `k.vec2(${nums[0]}, ${nums[1]})`;
          } else if (property === "color") {
            return `rgb(${nums.join(", ")})`;
          }
          return `[${nums.join(", ")}]`;
        }

        const num = Number(v);
        if (!isNaN(num)) {
          return v;
        }

        if (v === "true" || v === "false") {
          return v;
        }

        return `"${v}"`;
      });

      output += `${objName}.animate("${property}", [\n`;
      output += `\t${values.join(",\n\t")}\n`;
      output += `], {\n`;
      output += `\tduration: ${config.duration},\n`;
      output += `\tloops: ${config.loops},\n`;
      output += `\tdirection: "${config.direction}",\n`;

      if (config.easing && config.easing !== "linear") {
        output += `\teasing: k.easings.${config.easing},\n`;
      } else {
        output += `\teasing: k.easings.linear,\n`;
      }

      if (config.interpolation && config.interpolation !== "linear") {
        output += `\tinterpolation: "${config.interpolation}",\n`;
      }

      output = output.slice(0, -2) + "\n";
      output += `});\n\n`;
    }

    const blob = new Blob([output], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${objName}_animation.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function parseValue(str) {
    if (typeof str !== "string") return str;

    const trimmed = str.trim();

    // Detect vector format like "(1, 2)" or "(0, 255, 255)"
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      const inside = trimmed.slice(1, -1);
      const nums = inside.split(",").map((n) => Number(n.trim()));

      if (nums.length === 2) return k.vec2(nums[0], nums[1]);
      if (nums.length === 3) return [nums[0], nums[1], nums[2]];

      k.debug.log("Invalid number of vector!");
      k.addKaboom(k.center());

      return;
    }

    // Otherwise treat as number
    const num = Number(trimmed);
    return isNaN(num) ? str : num;
  }

  function parseVal(str) {
    str = str.replaceAll(/ +/g, "");
    if (str.startsWith("(") && str.endsWith(")")) {
      const inside = str.slice(1, -1);
      const nums = str.split(",").map((n) => Number(n));

      if (nums.length === 2) return k.vec2(nums[0], nums[1]);
      if (nums.length === 3) return [nums[0], nums[1], nums[2]];

      return nums;
    }
    const num = Number(str);
    return isNaN(num) ? str : num;
  }

  function playAnimation() {
    if (!selected_id || !animation[selected_id]) return;
    const params = animation[selected_id];
    const index = objs.findIndex((obj) => obj.id === selected_id);
    const obj = objs[index];
    const anims = Object.keys(animation[selected_id]);
    if (!obj) return;

    if (!obj.has("animate")) obj.use(k.animate());
    if (anims.includes("scale")) obj.use(k.scale(1, 1));
    else obj.unuse("scale");
    if (anims.includes("angle")) obj.use(k.rotate());
    else obj.unuse("rotate");
    if (anims.includes("color")) obj.use(k.color(255, 255, 255));
    else obj.unuse("color");
    if (anims.includes("opacity")) obj.use(k.opacity(1));
    else obj.unuse("opacity");
    if (anims.includes("anchor")) obj.use(k.anchor("topleft"));
    else obj.unuse("anchor");

    obj.unanimateAll();
    obj.animation.seek(0);

    for (let property of anims) {
      const config = animation[selected_id][property];
      const raw_values = config.value
        .replaceAll(/ +/g, "")
        .split(">")
        .map((v) => parseValue(v));

      obj.anchor = config.anchor;

      obj.animate(property, raw_values, {
        duration: Number(config.duration),
        loops: Number(config.loops),
        direction: config.direction,
        easing: k.easings?.[config.easing],
        interpolation: config.interpolation,
      });
    }
  }

  function addAnimation(name) {
    if (!selected_id) {
      k.debug.log("Select an object first!");
      k.addKaboom(k.center());
      return;
    }
    const index = obj_properties.findIndex((value) => value.name === name);
    if (!animation[selected_id])
      animation[selected_id] = {
        ...animation[selected_id],
        [name]: {
          value: obj_properties[index].example,
          duration: 1,
          loops: 1,
          direction: direction[0],
          easing: easings[0],
          interpolation: interpolation[0],
        },
      };
    if (animation[selected_id]?.[name] == null) animation[selected_id][name] = {};

    animation[selected_id][name].value = obj_properties[index].example;
    animation[selected_id][name].duration = 1;
    animation[selected_id][name].loops = 1;
    animation[selected_id][name].anchor = anchor[0];
    animation[selected_id][name].direction = direction[0];
    animation[selected_id][name].easing = easings[0];
    animation[selected_id][name].interpolation = interpolation[0];
  }
  function fetchObjects() {
    objs = k.get("*");
    for (let i = 0; i < objs.length; i++) {
      objs_id[i] = objs[i].id;
    }
    loaded = true;
  }
  function showEverything() {
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      if (!obj.has("opacity")) {
        obj.use(k.opacity(1));
      } else {
        obj.opacity = 1;
      }
    }
  }
  function selectObject(id) {
    selected_id = id;

    const index = objs.findIndex((obj) => obj.id === id);
    const selected = objs[index];

    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      if (!obj.has("opacity")) {
        obj.use(k.opacity(0));
      } else {
        obj.opacity = 0;
      }

      if (selected.id === obj.id) {
        selected.opacity = 1;
      }
    }
  }
</script>

<div class="bg-gray-800 p-2 rounded-lg flex flex-col gap-5">
  <div class="flex flex-col gap-2">
    <p class="font-bold">Objects to animate</p>
    <p>These are the available objects in the scene, select to animate them</p>
    <div class="flex gap-2 justify-between flex-wrap">
      {#each objs_id as obj_id}
        <button onclick={() => selectObject(obj_id)} class="btn">{obj_id}</button>
      {/each}
    </div>

    {#if objs_id.length === 0}
      <button class="btn" onclick={fetchObjects}>Load objects</button>
    {/if}
    {#if loaded}
      <button class="btn" onclick={showEverything}>Show everything</button>
    {/if}
  </div>
  <div class="flex flex-col gap-2">
    <p class="font-bold">Properties to animate</p>
    <p>These are the properties of the object that is animatable</p>

    {#if selected_id && animation[selected_id]}
      <div class="flex-col flex gap-2 p-2 border-2 border-gray-600 rounded-lg">
        <div class="flex flex-col gap-1">
          <p class="font-bold">Object id: {selected_id}</p>
          {#each Object.keys(animation[selected_id] ?? {}) as property}
            <div class="flex flex-col gap-1 p-2 rounded-lg border-2 border-gray-700">
              <div class="flex justify-between items-center">
                <p class="font-bold">Object Property: {property}</p>
                <button class="btn" onclick={() => delete animation[selected_id][property]}>Delete</button>
              </div>

              <div class="flex gap-2 p-2 bg-gray-900 rounded-lg items-center">
                <p class="font-bold w-1/3">value</p>
                <input class="grow border-2 border-gray-700 p-2 rounded-lg" type="text" bind:value={animation[selected_id][property].value} />
              </div>
              <div class="flex gap-2 p-2 bg-gray-900 rounded-lg items-center">
                <p class="font-bold w-1/3">duration</p>
                <input class="grow border-2 border-gray-700 p-2 rounded-lg" type="text" bind:value={animation[selected_id][property].duration} />
              </div>
              <div class="flex gap-2 p-2 bg-gray-900 rounded-lg items-center">
                <p class="font-bold w-1/3">loops</p>
                <input class="grow border-2 border-gray-700 p-2 rounded-lg" type="text" bind:value={animation[selected_id][property].loops} />
              </div>
              <div class="flex gap-2 p-2 bg-gray-900 rounded-lg items-center">
                <p class="font-bold w-1/3">Easing</p>
                <select bind:value={animation[selected_id][property].easing} class="select grow" name="easing" id="easing">
                  {#each easings as ease}
                    <option value={ease}>{ease}</option>
                  {/each}
                </select>
              </div>
              <div class="flex gap-2 p-2 bg-gray-900 rounded-lg items-center">
                <p class="font-bold w-1/3">Interpolation</p>

                <select bind:value={animation[selected_id][property].interpolation} class="select grow" name="interpolation" id="interpolation">
                  {#each interpolation as interpolate}
                    <option value={interpolate}>{interpolate}</option>
                  {/each}
                </select>
              </div>
              <div class="flex gap-2 p-2 bg-gray-900 rounded-lg items-center">
                <p class="font-bold w-1/3">Anchor</p>
                <select bind:value={animation[selected_id][property].anchor} class="select grow" name="anchor" id="anchor">
                  {#each anchor as anc}
                    <option value={anc}>{anc}</option>
                  {/each}
                </select>
              </div>
              <div class="flex gap-2 p-2 bg-gray-900 rounded-lg items-center">
                <p class="font-bold w-1/3">Direction</p>

                <select bind:value={animation[selected_id][property].direction} class="select grow" name="direction" id="direction">
                  {#each direction as dir}
                    <option value={dir}>{dir}</option>
                  {/each}
                </select>
              </div>
            </div>
          {/each}
        </div>

        <div class="flex flex-col gap-2">
          <p class="font-bold">Options</p>
          <div class="flex gap-2 justify-between">
            <button class="btn font-bold" onclick={playAnimation}>Play</button>
            <button class="btn font-bold" onclick={animationAsText}>Copy as text</button>
          </div>
        </div>
      </div>
    {/if}

    <div class=" flex flex-col gap-2">
      {#each obj_properties as property}
        <div class="border-2 border-gray-600 bg-gray-900 rounded-lg p-2 flex justify-between gap-4 items-center">
          <div>
            <p class="font-bold">{property.name}</p>
            <div>
              <p>{property.description}</p>
              <p class="italic">Example: {property.example}</p>
            </div>
          </div>
          <button class="btn h-fit min-w-1/3" onclick={() => addAnimation(property.name)}>Add</button>
        </div>
      {/each}
    </div>
  </div>
</div>
