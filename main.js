;var Util = {};

Util.getPieChartColors = function(items) {
	var arr = [];
	
	var r = 140;
	var g = 0;
	var b = 255;
	
	var i;
	
	var step = Math.floor(255 / items);
	var step2 = Math.floor((255 - 140) / items);
	
	for(i = 0; i < items; i++) {
		arr[i] = "rgba(" + (255 - (i * step2)) + "," + (255 - (i * step)) + "," + b + ", 0.8)";
	}
	
	return arr;
}

Util.swapClass = function(prefix, newClass, elem) {
	if (elem === null) {
		console.log("swapClass, No element found");
		return;
	}
	var className = elem.className;
	if(typeof className.split('newClass')[1] !== 'undefined') return;
	className = className.split(prefix);
	if(typeof className[1] === 'undefined') {
		console.log("swapClass function error: Tried to replace a class that doesn't exist at [" + elem.className + "] using " + prefix + " as prefix and " + newClass + " as target class.");
		elem.className += " " + newClass;
		return;
	} 
	var classEnd = className[1].indexOf(' ');
	if (classEnd >= 0)
		className = className[0] + newClass + className[1].slice(classEnd, className[1].length);
	else
		className = className[0] + newClass;
	elem.className = className;
}

Object.freeze(Util);

var Simulator = (function() {
	/*
		data : {
			mode // "voids" or "zones"
			heirloomPrc
			achievementBonus
			highestLevelCleared
			lastPortal
			voidMaxLevel
            boneVoidMaps
			arrGoldenUpgrades
			targetVoidMapsInRestOfRun	//if mode === "zones"
			lastVoidMap					//if mode === "zones"
			startZone					//if mode === "zones"
			startCell					//if mode === "zones"
		}
	*/
	function Simulator(data) {
		var CHART_UPDATE_INTERVAL = 15;
		var chartUpdateClock = 0;
		
		var mode = data.mode;
		
		var heirloomPrc = data.heirloomPrc;
		var achievementBonus = data.achievementBonus;
		var highestLevelCleared = data.highestLevelCleared;
		var lastPortal = data.lastPortal;
		var voidMaxLevel = data.voidMaxLevel;
        var boneVoidMaps = data.boneVoidMaps;
		var arrGoldenUpgrades = data.arrGoldenUpgrades;
		
		var lastVoidMap = 0;
		var startZone = 1;
		var startCell = 0;
		var targetVoidMapsInRestOfRun = 1;
		var targetZone = data.targetZone;
        var tracker = 0;
		
		if(mode === "zones") {
			lastVoidMap = data.lastVoidMap;
			startZone = data.startZone;
			startCell = data.startCell;
			targetVoidMapsInRestOfRun = data.targetVoidMapsInRestOfRun;
			targetZone = 1000;
		}
		
		
		
		var textResultDropChance = document.getElementById("text_result_drop_chance");
		var textResultGoldenInterval = document.getElementById("text_result_golden_interval");
		var textResultFinalGoldenVoidPrc = document.getElementById("text_result_final_golden_void_prc");
		var textResultVoidMaxLevel = document.getElementById("text_result_void_max_level");
        var textResultBoneVoidMaps = document.getElementById("text_result_bone_void_maps");
		var textResultTargetZone = document.getElementById("text_result_target_zone");
		var textResultRuns = document.getElementById("text_result_runs");
		var containerResult = document.getElementById("container_result");
		var canvasPieDrops = document.getElementById("canvas_pie_drops");
		
		var chartPieDrops = new Chart (canvasPieDrops, {
			type: "bar",
			data: {
				labels: [],
				datasets: [{
					label: 'VM drop',
					data: [],
					backgroundColor: [],
					borderColor: ["black"],
					borderWidth: 1
				}]
			},
			options: {
				tooltips: {
					callbacks: {
						label: function(tooltipItem, data) {
							var dataset = data.datasets[tooltipItem.datasetIndex];
							var total = dataset.data.reduce(
								function(previousValue, currentValue, currentIndex, array) {
									return previousValue + currentValue;
								}
							);
							var currentValue = 0;
							
							if(mode === "zones") {
								var i, l = tooltipItem.index + 1;
								for(i = 0; i < l; i++) {
									currentValue += dataset.data[i];
								}
								var prc = Math.floor(((currentValue / total) * 100) + 0.5);

								return "Summed chance: " + prc + "% (" + currentValue + ")";
							}
							else if(mode === "voids") {
								currentValue = dataset.data[tooltipItem.index];
								var prc = Math.floor(((currentValue / total) * 100) + 0.5);

								return "Chance: " + prc + "% (" + currentValue + ")";
							}
						}
					}
				},
				scales: {
					yAxes: [{
						ticks: {
							beginAtZero:true
						}
					}]
				}
			}
		});
		
		heirloomPrc = heirloomPrc / 100;
		
		var goldenInterval = -1;
		var z1golden = Math.max(0, Math.floor((achievementBonus - 2000) / 500));
		
		if(achievementBonus >= 2000)
			goldenInterval = 25;
		else if(achievementBonus >= 1000)
			goldenInterval = 30;
		else if(achievementBonus >= 600)
			goldenInterval = 35;
		else if(achievementBonus >= 300)
			goldenInterval = 40;
		else if(achievementBonus >= 100)
			goldenInterval = 45;
		else if(achievementBonus >= 15)
			goldenInterval = 50;
		
		var h, i, j;
		var min, max;
		var drops, seed;
		var goldenBonus = 0;
		var totalDrops = 0;
		
		var minimum = Number.MAX_VALUE;
		var maximum = 0;
		var runsAmount = 0;
		var arrOfAmounts = {};
		var fastestVoidDropInSingleRunInCells = Number.MAX_VALUE;
		
		var arrOfZones = {};
		var zoneCount = 0;
		var totalZones = 0;
		
		var _voidMaxLevel;
		var _lastVoidMap;
		
		this.run = function(loops) {
			runsAmount += loops;
			
			for(h = 0; h < loops; h++) {	//RUNS
				zoneCount = 0; //prevent errors with targetZone hard cap breaking zones mode
			
				_lastVoidMap = lastVoidMap;
				goldenBonus = 0;
				drops = 0;
				seed = Math.floor(Math.random() * 1000000);
				
				_voidMaxLevel = voidMaxLevel;
				
				for (i = 0; i < z1golden; i++) { // Z1 GU
					if(arrGoldenUpgrades[i])
						goldenBonus += 0.02 * (i + 1);
				}

				loopZones:
				for(i = 1; i < targetZone; i++) {	//ZONES
					if(goldenInterval != -1 && i % goldenInterval == 0) {
						if(arrGoldenUpgrades[i / goldenInterval + z1golden - 1]) {
							goldenBonus += 0.02 * (i / goldenInterval + z1golden);
						}
					}
					
					if(i >= startZone) {
						if(i === startZone)
							j = startCell;
						else
							j = 0;
						
						for( ; j < 100; j++) {	//CELLS
							max = _voidMaxLevel;
							if(_voidMaxLevel < i) {
								_voidMaxLevel = i;
								if((lastPortal + 25) < i)
									_voidMaxLevel = highestLevelCleared;
							}
							if ((max - lastPortal) < 25) {
								max = lastPortal;
							}
							
							if(max > 200) max = 200;
							min = (max > 80) ? (1000 + ((max - 80) * 13)) : 1000;
							min *= (1 - heirloomPrc);
							min *= (1 - goldenBonus);
							
							var chance = (Math.floor((_lastVoidMap - min) / 10) / 50000);
							_lastVoidMap++;
							
							if(mode === "zones" && i === targetZone - 1) {	//TODO find a better solution
								if(arrOfZones[targetZone - 1] === undefined)
									arrOfZones[targetZone - 1] = 1;
								else
									arrOfZones[targetZone - 1]++;
								
								totalZones += targetZone - 1;
								zoneCount = 0;
								
								break loopZones;
							}
							
							if(chance < 0)
								continue;
							if(Simulator.seededRandom(seed++) >= chance)
								continue;
							
							
							_lastVoidMap = 0;
							drops++;
                            tracker += boneVoidMaps;
                            if (tracker >= 100) {
                                tracker -= 100;
                                drops++;
                            }
							
							if(mode === "zones") {
								zoneCount++;
								if(zoneCount >= targetVoidMapsInRestOfRun) {
									
									if(arrOfZones[i] === undefined)
										arrOfZones[i] = 1;
									else
										arrOfZones[i]++;
									
									totalZones += i;
									zoneCount = 0;
									
									break loopZones;
								}
								
							}
							
							var cell = ((i - 1) * 100) + j;
							if(cell < fastestVoidDropInSingleRunInCells)
								fastestVoidDropInSingleRunInCells = cell;
							
						}
					}
				}
				
				totalDrops += drops;
				
				if(mode === "voids") {
				
					if(minimum > drops)
						minimum = drops;
					if(maximum < drops)
						maximum = drops;
					
					if(arrOfAmounts[drops] === undefined)
						arrOfAmounts[drops] = 1;
					else
						arrOfAmounts[drops]++;
				}
			}		
			this.updateSwitches();
		}
		
		this.updateSwitches = function() {
			textResultDropChance.innerHTML = ((1 - heirloomPrc) * (1 - goldenBonus));
			textResultGoldenInterval.innerHTML = goldenInterval ? goldenInterval : "none";
			textResultFinalGoldenVoidPrc.innerHTML = goldenBonus * 100;
			textResultVoidMaxLevel.innerHTML = max;
            textResultBoneVoidMaps.innerHTML = boneVoidMaps;
			textResultTargetZone.innerHTML = targetZone;
			textResultRuns.innerHTML = runsAmount;
			
			containerResult.innerHTML = "Average drops: " + totalDrops / runsAmount;
			
			if(mode === "voids")
				containerResult.innerHTML += "<br>(min: " + minimum + ", max: " + maximum + ")<br><br>Earliest Void Map drop at zone " + (Math.floor(fastestVoidDropInSingleRunInCells / 100) + 1) + ", cell " + fastestVoidDropInSingleRunInCells % 100 + " (" + fastestVoidDropInSingleRunInCells + ")<br><br>";
			else if(mode === "zones")
				containerResult.innerHTML += "<br>Average zones: " + totalZones / runsAmount;
			/*
			var i;
			for(i in arrOfAmounts)
				if(arrOfAmounts[i] > 0)
					containerResult.innerHTML += i + " VM's: " + arrOfAmounts[i] + " times<br>";
				
			*/
			chartUpdateClock++;
			
			if(chartUpdateClock >= CHART_UPDATE_INTERVAL) {
				if(mode === "zones")
					updatePie(arrOfZones, "Average zone until which (including) " + targetVoidMapsInRestOfRun + " Void Map" + (targetVoidMapsInRestOfRun > 1 ? "s" : "") + " will drop in rest of run");
				else if(mode === "voids")
					updatePie(arrOfAmounts, "Average number of Void Maps per run");
				
				chartUpdateClock = 0;
			}
		}
		
		//damn you chart.js
		this.destroy = function() {
			chartPieDrops.destroy();
		}
		
		this.finalize = function() {
			this.updateSwitches();
		}
		
		function updatePie(arr, title) {
			//remember when this simulation used to run fast?
			//i member
			var _data = chartPieDrops.config.data;
			var labels = _data.labels;
			var _dataset = _data.datasets[0];
			var data = _dataset.data;
			var i;
			
			_dataset.label = title;
			
			var isUpdateColors = false;
			
			for(i in arr) {
				var item = arr[i];
				
				var index = labels.indexOf(i);
				if(index === -1) {
					labels.push(i);
					labels = labels.sort(function(a, b) {
						return a - b;
					});
					
					isUpdateColors = true;
				}
			}
			
			if(isUpdateColors) {
				var l = labels.length;
				_dataset.backgroundColor = Util.getPieChartColors(l);
				for(i = 0; i < l; i++) {
					_dataset.borderColor[i] = "black";
				}
			}
			
			var l = labels.length;
			for(i = 0; i < l; i++) {
				data[i] = arr[labels[i]];
			}
			
			
			chartPieDrops.update();
		}
	}

	Simulator.seededRandom = function(seed) {
		var x = Math.sin(seed++) * 10000;
		return x - Math.floor(x);
		//the game updated to use parseFloat and toFixed, however, it's ludicrously slow, so I can't include it
		//return parseFloat((x - Math.floor(x)).toFixed(7));
	}
	
	return Simulator;
})();

(function() {
	var loopsPerFrame = 10;

	var btnAddGolden = document.getElementById("btn_add_golden");
	var btnCalculate = document.getElementById("btn_calculate");
	var btnSavePull = document.getElementById("btn_save_pull");
	var btnSaveClear = document.getElementById("btn_save_clear");
	var progressCalculate = document.getElementById("progress_calculate");
	var textProgressCalculate = document.getElementById("text_progress_calculate");
	var textSelectedGoldenVoidPrc = document.getElementById("text_selected_golden_void_prc");
	var containerGolden = document.getElementById("container_golden");
	var inputSaveExport = document.getElementById("input_save_export");
	
	var formRadioMode = document.getElementById("form_radio_mode");
	var inputRadioModeZones = document.getElementById("input_radio_mode_zones");
	var tableModeZones = document.getElementById("table_mode_zones");
	var tableModeVoids = document.getElementById("table_mode_voids");
	
	var inputHeirloomDrop = document.getElementById("input_heirloom_drop");
	var inputAchievementBonus = document.getElementById("input_achievement_bonus");
	var inputHighestZone = document.getElementById("input_highest_zone");
	var inputLastPortal = document.getElementById("input_last_portal");
	var inputVoidMaxLevel = document.getElementById("input_void_max_level");
    var inputBoneVoidMaps = document.getElementById("input_bone_void_maps");
	var inputTargetZone = document.getElementById("input_target_zone");
	var inputRuns = document.getElementById("input_runs");
	var inputGoldenArr = [];
	var inputTargetVoids = document.getElementById("input_target_voids");
	var inputLastVoidMap = document.getElementById("input_last_map_cells_ago");
	var inputStartingZone = document.getElementById("input_starting_zone");
	var inputStartingCell = document.getElementById("input_starting_cell");
	
	var mainTimeout = null;
	var simulator = null;
	
	(function() {
		try {
			var save = JSON.parse(localStorage.getItem("cache"));
			var i, l;
			if(save) {
				if(save.mode !== undefined) {
					var i, elems = formRadioMode.elements["mode"], l = elems.length, elem;
					for(i = 0; i < l; i++) {
						elem = elems[i];
						if(elem.value === save.mode) {
							elem.checked = true;
						}
					}
				}
				if(save.heirloomPrc !== undefined) 		inputHeirloomDrop.value = save.heirloomPrc;
				if(save.achievementBonus !== undefined) inputAchievementBonus.value = save.achievementBonus;
				if(save.highestZone !== undefined) 		inputHighestZone.value = save.highestZone;
				if(save.lastPortal !== undefined) 		inputLastPortal.value = save.lastPortal;
				if(save.voidMaxLevel !== undefined) 	inputVoidMaxLevel.value = save.voidMaxLevel;
                if(save.boneVoidMaps !== undefined) 	inputBoneVoidMaps.value = save.boneVoidMaps;
				if(save.targetZone !== undefined) 		inputTargetZone.value = save.targetZone;
				if(save.runs !== undefined) 			inputRuns.value = save.runs;
				if(save.targetVoidMapsInRestOfRun !== undefined) inputTargetVoids.value = save.targetVoidMapsInRestOfRun;
				if(save.lastVoidMap !== undefined) 		inputLastVoidMap.value = save.lastVoidMap;
				if(save.startZone !== undefined) 		inputStartingZone.value = save.startZone;
				if(save.startCell !== undefined) 		inputStartingCell.value = save.startCell;
				
				l = save.arrGoldenUpgrades.length;
				for(i = l - 1; i >= 0; i--) {
					if(save.arrGoldenUpgrades[i]) {
						save.arrGoldenUpgrades = save.arrGoldenUpgrades.slice(0, i + 1);
						break;
					}
					if(i == 0) {
						save.arrGoldenUpgrades = [];
						break;
					}
				}
					
				l = save.arrGoldenUpgrades.length;
				for(i = 0; i < l; i++)
					onAddGolden(null, save.arrGoldenUpgrades[i]);
				
				if(l < 6)
					for(i = l; i < 6; i++)
						onAddGolden(null, false);
			}
			else {
				for(i = 0; i < 6; i++) {
					onAddGolden(null, false);
				}
			}
		}
		catch(e) {
			console.warn(e);
		}
	})();
	
	onFormRadioModeChange();
	
	textSelectedGoldenVoidPrc.innerHTML = getSelectedTotalGoldenVoidPercentage() + "%";
	
	btnAddGolden.onclick = onAddGolden;
	btnCalculate.onclick = onCalculate;
	
	inputTargetZone.onchange = function() {
		var number, min, max;
		
		number = inputTargetZone.value !== undefined ? parseInt(inputTargetZone.value) : 200;
		min = inputTargetZone.min !== undefined ? parseInt(inputTargetZone.min) : 1;
		max = inputTargetZone.max !== undefined ? parseInt(inputTargetZone.max) : 1000;
		
		if(number > max)
			inputTargetZone.value = max;
		else if(number < min)
			inputTargetZone.value = min;
	}
	
	formRadioMode.onchange = onFormRadioModeChange;
	
	function onFormRadioModeChange() {
		if(inputRadioModeZones.checked) {
			tableModeVoids.style.display = "none";
			tableModeZones.style.display = "initial";
			
			//Util.swapClass("text-color-", "text-color-default", tableModeZones);
		}
		else {
			tableModeZones.style.display = "none";
			tableModeVoids.style.display = "initial";
			
			//Util.swapClass("text-color-", "text-color-disabled", tableModeZones);
		}
	}
	
	inputSaveExport.oninput = function() {
		Util.swapClass("btn-border-", "btn-border-clickme", btnSavePull);
	}
	
	btnSavePull.onclick = function(e) {
		Util.swapClass("btn-border-", "btn-border-none", btnSavePull);
		
		var i, j, l, temp;
		var game = JSON.parse(LZString.decompressFromBase64(inputSaveExport.value));
		
		temp = 0;
		l = game.global.ShieldEquipped.mods.length;
		for(i = 0; i < l; i++) {
			if(game.global.ShieldEquipped.mods[i][0] === "voidMaps") {
				temp = Number(game.global.ShieldEquipped.mods[i][1]);
				break;
			}
		}
		var universe = game.global.universe;
		if(universe == 2 && game.global.fluffyExp2 < 5000) temp /= 10;
		inputHeirloomDrop.value = temp;
		inputAchievementBonus.value = Number(game.global.achievementBonus);
		inputHighestZone.value = Number(universe === 2 ? (game.global.highestRadonLevelCleared + 1) : (game.global.highestLevelCleared + 1));
		inputLastPortal.value = Number(universe === 2 ? game.global.lastRadonPortal : game.global.lastPortal);
		inputVoidMaxLevel.value = Number(universe === 2 ? game.global.voidMaxLevel2 : game.global.voidMaxLevel);
        inputBoneVoidMaps.value = Number(game.permaBoneBonuses.voidMaps.owned);
		inputTargetZone.value = Number(game.global.world);
		inputLastVoidMap.value = Number(game.global.lastVoidMap);
		inputStartingZone.value = Number(game.global.world);
		inputStartingCell.value = Number(game.global.lastClearedCell + 1);
		
		l = inputGoldenArr.length;
		for(i = 0; i < l; i++) {
			inputGoldenArr[i].checked = false;
		}
		
		l = game.goldenUpgrades.Void.purchasedAt.length;
		for(i = 0; i < l; i++) {
			for(j = 0; j < 10; j++) {
				if(inputGoldenArr[game.goldenUpgrades.Void.purchasedAt[i]] !== undefined) {
					inputGoldenArr[game.goldenUpgrades.Void.purchasedAt[i]].checked = true;
				}
				else {
					onAddGolden(e, false);
				}
			}
		}
		
		onGoldenStateChange(e);
		
	}
	
	btnSaveClear.onclick = function() {
		Util.swapClass("btn-border-", "btn-border-none", btnSavePull);
		
		inputSaveExport.value = "";
	}
	
	function getSelectedTotalGoldenVoidPercentage() {
		var i, l = inputGoldenArr.length, total = 0;
		for(i = 0; i < l; i++) {
			if(inputGoldenArr[i].checked)
				total += (i + 1) * 2;
		}
		return total;
	}
	
	function onGoldenStateChange(e) {
		var total = getSelectedTotalGoldenVoidPercentage();
		
		if(e.target.checked && total > 72)
			e.target.checked = false;
		
		textSelectedGoldenVoidPrc.innerHTML = getSelectedTotalGoldenVoidPercentage() + "%";
	}
	
	function onAddGolden(e, isPreselect) {
		var prc = ((inputGoldenArr.length + 1) * 2);
		if(prc > 72)
			return;
		
		var span = document.createElement("span");
		var input = document.createElement("input");
		var br = document.createElement("br");
		
		span.innerHTML = prc + "% ";
		input.type = "checkbox";
		
		if(isPreselect)
			input.checked = true;
		
		inputGoldenArr.push(input);
		
		input.onchange = onGoldenStateChange;
		
		containerGolden.appendChild(span);
		containerGolden.appendChild(input);
		containerGolden.appendChild(br);
	}
	
	function onCalculate(e) {
		if(mainTimeout) {
			clearTimeout(mainTimeout);
			mainTimeout = null;
			onFinalize();
			
			btnCalculate.innerHTML = "Calculate";
			return;
		}
		btnCalculate.innerHTML = "Stop";
		
		var mode				= formRadioMode.elements["mode"].value;
		var heirloomPrc 		= Number(inputHeirloomDrop.value);
		var achievementBonus 	= Number(inputAchievementBonus.value);
		var highestZone 		= parseInt(inputHighestZone.value);
		var lastPortal			= parseInt(inputLastPortal.value);
		var voidMaxLevel 		= parseInt(inputVoidMaxLevel.value);
        var boneVoidMaps        = parseInt(inputBoneVoidMaps.value);
		var targetZone 			= parseInt(inputTargetZone.value);
		var runs 				= parseInt(inputRuns.value);
		var targetVoidMapsInRestOfRun = parseInt(inputTargetVoids.value);
		var lastVoidMap			= parseInt(inputLastVoidMap.value);
		var startZone			= parseInt(inputStartingZone.value);
		var startCell			= parseInt(inputStartingCell.value);
		
		var arrGoldenUpgrades = [];
		(function() {
			var i, l = inputGoldenArr.length;
			for(i = 0; i < l; i++) {
				arrGoldenUpgrades[i] = inputGoldenArr[i].checked;
			}
		})();
		
		try {
			localStorage.setItem("cache", JSON.stringify({
				mode : mode,
				heirloomPrc : heirloomPrc,
				achievementBonus : achievementBonus,
				highestZone : highestZone,
				voidMaxLevel : voidMaxLevel,
                boneVoidMaps: boneVoidMaps,
				lastPortal : lastPortal,
				targetZone : targetZone,
				runs : runs,
				arrGoldenUpgrades : arrGoldenUpgrades,
				targetVoidMapsInRestOfRun : targetVoidMapsInRestOfRun,
				lastVoidMap : lastVoidMap,
				startZone : startZone,
				startCell : startCell
			}));
		} 
		catch(e) {
			console.warn(e);
		}
		
		if(simulator !== null)
			simulator.destroy();
		
		simulator = new Simulator({
			mode : mode,
			heirloomPrc : heirloomPrc,
			achievementBonus : achievementBonus,
			highestLevelCleared : highestZone - 1,
			lastPortal : lastPortal,
			targetZone : targetZone,
			voidMaxLevel : voidMaxLevel,
            boneVoidMaps : boneVoidMaps,
			arrGoldenUpgrades : arrGoldenUpgrades,
			targetVoidMapsInRestOfRun : targetVoidMapsInRestOfRun,
			lastVoidMap : lastVoidMap,
			startZone : startZone,
			startCell : startCell
		});
		
		function onNextFrame(loops) {
			simulator.run(loops);
		}
		function onFinalize() {
			resetProgressBar();
			mainTimeout = null;
			if(simulator) {
				simulator.finalize();
			}
			btnCalculate.innerHTML = "Calculate";
		}
		function resetProgressBar() {
			progressCalculate.style.width = "0%";
			textProgressCalculate.innerHTML = "0%";
		}
		
		(function() {
			var i = runs;
				
			onTimeout(i >= loopsPerFrame ? loopsPerFrame : i);
			
			function onTimeout(loops) {
				onNextFrame(loops);
				var prc = Math.round((1 - i / runs) * 100);
				progressCalculate.style.width = prc + "%";
				textProgressCalculate.innerHTML = prc + "%";

				i -= loopsPerFrame;
				
				if(i > 0) {
					mainTimeout = setTimeout(
						(function(loops) {
							return function() {
								onTimeout(loops);
							}
						})(i >= loopsPerFrame ? loopsPerFrame : i)
					, 0);
				}
				else {
					onFinalize();
				}
			}
		})();
	}
})();

(function() {
	var btnHelp = document.getElementById("btn_help");
	var colLeft = document.getElementById("col_left");
	var colRight = document.getElementById("col_right");
	var descHelp = document.getElementById("desc_help");
	
	var isHelp = false;
	
	function onHelp() {
		if(isHelp) {
			colRight.className = "col-md-2";
			colLeft.className = "col-md-2";
			descHelp.style.display = "none";
			isHelp = false;
		}
		else {
			colRight.className = "col-md-4";
			colLeft.className = "";
			descHelp.style.display = "inherit";
			isHelp = true;
		}
	}
	
	btnHelp.onclick = onHelp;
})();








