import { INVENTORY, SHOP_DATA, CONFIG } from "./global.js"
import { addSoilToGrid, addFarmbot } from "../components-kaplay/components.js"
import { robots } from "../../components/global.svelte.js"
import { farm_grid_index, createLandBackground } from "../game.js"

function hasEnoughCoins(amount){
	if(INVENTORY.coins >= amount) return true
	return false
}

export function buyBot(){
	if (!SHOP_DATA.bots.bot.unlocked) return false;
	const total_amount = SHOP_DATA.bots.bot.price;
	const can_buy = hasEnoughCoins(total_amount);
	if(can_buy) {
		INVENTORY.changeCoins(-total_amount);
		addFarmbot(robots.length, farm_grid_index)
	}
	return can_buy;
}

export function buyPlants(crop_type, amount = 1) {
	if (!SHOP_DATA.seeds[crop_type]?.unlocked) return false;
	const total_amount = SHOP_DATA.seeds[crop_type].price * amount;
	const can_buy = hasEnoughCoins(total_amount)
	if(can_buy) {
		INVENTORY.changeCoins(-total_amount)
		INVENTORY.changeCrops(crop_type, amount)
	}
	return can_buy;
}

export function buyUpgrade(upgrade_type, index) {
	if (!SHOP_DATA.bot_upgrades[upgrade_type]?.unlocked) return false;
	const total_amount = SHOP_DATA.bot_upgrades[upgrade_type].price;
	const can_buy = hasEnoughCoins(total_amount)
	if(can_buy) {
		if(upgrade_type === "move_speed") {
			if(robots[index].botmove_duration - 0.1 <= 0.01) return false
			robots[index].botmove_duration -= 0.1
			INVENTORY.changeCoins(-total_amount)
		}
		if(upgrade_type === "action_speed") {
			if(robots[index].botact_duration - 0.1 <= 0.01) return false
			robots[index].botact_duration -= 0.1
			INVENTORY.changeCoins(-total_amount)
		}
		if(upgrade_type === "check_speed") {
			if(robots[index].botcheck_duration - 0.1 <= 0.01) return false
			robots[index].botcheck_duration -= 0.1
			INVENTORY.changeCoins(-total_amount)
		}
		robots[index].showEffects("upgrade", "large", 1);
	}
	return can_buy;
}

export function buyLand(land_type, amount = 1) {
	if (!SHOP_DATA.land[land_type]?.unlocked) return false;
	const total_amount = SHOP_DATA.land[land_type].price * amount;
	const can_buy = hasEnoughCoins(total_amount)
	if(can_buy) {
		if(land_type === "row"){
			CONFIG.FARM.rows += amount
			for(let x = 0; x < CONFIG.FARM.columns; x++){
				const row = CONFIG.FARM.rows - 1
				const soil = addSoilToGrid(x, row);
				farm_grid_index.set(`${row}-${x}`, { soil });		
			}
		}
		if(land_type === "column"){
			CONFIG.FARM.columns += amount
			for(let y = 0; y < CONFIG.FARM.rows; y++){
				const column = CONFIG.FARM.columns - 1
				const soil = addSoilToGrid(column, y);
				farm_grid_index.set(`${y}-${column}`, { soil });		
			}
		}
		createLandBackground();
		INVENTORY.changeCoins(-total_amount)
	}
	return can_buy;
}