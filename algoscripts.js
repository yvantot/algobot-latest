// Robot 0
// Task: Till & Water
while (true) {
	for (var y = 0; y < rows(); y++) {
		for (var x = 0; x < columns(); x++) {
			bot.jump(y, x);

			if (!bot.is_tilled()) {
				bot.till();
				bot.water();
			} else {
				if (!bot.is_watered()) if (!bot.is_harvestable()) bot.water();
			}
		}
	}
}

// Robot 1
// Task: Plant & Remove Destroyed Crops
while (true) {
	for (var y = 0; y < rows(); y++) {
		for (var x = 0; x < columns(); x++) {
			bot.jump(y, x);

			if (bot.is_tilled()) bot.plant("wheat");
			if (bot.is_dead()) bot.destroy();
		}
	}
}

// Robot 2
// Task: Harvest
while (true) {
	for (var y = 0; y < rows(); y++) {
		for (var x = 0; x < columns(); x++) {
			bot.jump(y, x);
			if (bot.is_harvestable()) bot.harvest();
		}
	}
}

while (true) {
	var y = randint(0, rows() - 1)
	var x = randint(0, columns() - 1)
	bot.jump(x, y)
	bot.till()
	bot.water()
	bot.plant("corn")
}

// Test Corn Buff
for (var i = 0; i < rows(); i++) {
	bot.jump(0, i);
	bot.till()
	bot.water()
	bot.plant("corn")
}

bot.up()
bot.wait(20)
bot.destroy()

bot.till()
bot.water()
bot.plant("sugarcane")
bot.harvest()