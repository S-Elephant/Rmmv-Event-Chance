"use strict";
/*:
╔════════════════╗
║ Plugin Manager ║
╚════════════════╝
 * @plugindesc v1.10 - Randomizes events through disabling specific marked events.
 * @author Squirting Elephant
   ╔════════════╗
   ║ Parameters ║
   ╚════════════╝
 * @param DefaultRegularSectionChance
 * @text Default Regular Section Chance
 * @desc The chance for NOT disabling events for regular sections when no chance-notetag was found. Value must be between 0.00 and 1.00 (inclusive).
 * @type number
 * @min 0.00
 * @max 1.00
 * @decimals 2
 * @default 0.50
 *
   ╔══════╗
   ║ Help ║
   ╚══════╝
 * @help
 * License: Attribution 4.0 International (CC BY 4.0) (https://creativecommons.org/licenses/by/4.0/)
 *
 * Note that the exclusive-section is never disabled for the map if there is only 1 exclusive section for that map.
 *
 * Events disabled through self-switches and exclusive-events are saved between maps and saving&loading the game.
 * Regular sections are randomized each time the player visits the map again or loads a savegame.
 *
 *--------------------------------------
 * Event Notetags
 *--------------------------------------
 * <evc_chance:value> // value 0-100 or 0.0 - 1.0. both are valid and the same
 * <evc_section:value>
 * <evc_excl_section:value>
 * <evc_disable_mode:value1, value2, value3> // value1: switch/erase, value2: A, B, C or D, value3: ON/OFF
 *
 * Examples:
 * <evc_chance:50> // 50% chance to be disabled. If evc_section is included then this is the chance for the section instead. Does not apply to exclusive sections.
 * <evc_section:towns> // Only disable when the town-section is disabled
 * <evc_excl_section:towns> // only 1 exclusive section can be enabled at any time, all other events tagged with a different section will be disabled
 * <evc_disable_mode:switch A> // switch can be either "switch A/B/C/D" or "erase" (default: erase)
 * <evc_disable_mode:switch A ON> // The last value can be ON or OFF. If the 3rd value is omitted, it will default to "ON".
 *
 * Examples for 3 exclusive-sections. Note that EITHER "towns 1" or "towns 2" or "towns C" are kept, the other 2 sections (and all of their events) are erased/switched.
 * <evc_excl_section:towns 1><evc_disable_mode:switch A>
 * <evc_excl_section:towns 1><evc_disable_mode:switch B OFF>
 * <evc_excl_section:towns 2>
 * <evc_excl_section:towns C>
 *
 * Examples for a regular section:
 * <evc_section:towns1><evc_chance:90>
 * <evc_section:towns3>
 * <evc_section:towns4><evc_disable_mode:switch A ON>
 *
 * Example for chancing a single event:
 * <evc_chance:75>
 *
 * Alias created for:
 * * Game_Map.prototype.setup()
 *
 * Version History:
 * v1.10 (28 September 2019)
 * - Updated this plugin for the latest version of RMMV.
 *
 * v1.01 (25 December 2015)
 * - Now supports unlimited (instead of just 1) exclusive section per map.
 * - Applied my new coding standards.
 *
 * v.1.00 (22 December 2015)
 * - First Release.
 */

/*╔═══════════════════════╗
  ║ Plugin Initialization ║
  ╚═══════════════════════╝*/
var Imported = Imported || {};
Imported.SE_EventChance = { name: 'SE_EventChance', version: 1.10, author: 'Squirting Elephant', date:'2019-09-28'};

/*╔════════════╗
  ║ Parameters ║
  ╚════════════╝*/
var SE = SE || {};
SE.Params = SE.Params || {};
SE.Params.SE_EventChance = PluginManager.parameters('SE_EventChance');
SE.Params.SE_EventChance.DefaultRegularSectionChance = parseFloat(SE.Params.SE_EventChance.DefaultRegularSectionChance);

/*╔═══════════╗
  ║ Utilities ║
  ╚═══════════╝*/
SE.EvChance = SE.EvChance || {}
// chance parameter: between 0.0 and 1.0
SE.EvChance.Chance = function(chance)
{
	return (Math.random() < chance);
};

SE.EvChance.DisableEv = function(mapId, event, storedEvent)
{
	if (storedEvent.disableMode === 'erase')
	{
		event.erase();
	}
	else
	{
		$gameSelfSwitches.setValue([mapId, storedEvent.id, storedEvent.disableModeLetter], storedEvent.disableModeValue);
	}
};

/*╔══════════╗
  ║ Game Map ║
  ╚══════════╝*/
Game_Map.prototype.initEVCSections = function()
{
	this.sections                = {};
	this.sections.regular        = {};
	this.sections.regularArray   = [];
	this.sections.exclusives     = {};
};

var SEA_Game_Map_setup = Game_Map.prototype.setup;
Game_Map.prototype.setup = function(mapId)
{
	SEA_Game_Map_setup.apply(this, arguments);
	this.setupEventChance(mapId);
};

Game_Map.prototype.setupEventChance = function(mapId)
{
	// Init custom-map-variables
	this.initEVCSections();
	
	// Loop through all map-events
	var events = this.events();
	for (var evIdx=0; evIdx<events.length; evIdx++)
	{
		var event = events[evIdx];
		var storedEvent = { id:event._eventId, disableMode:'erase' };
		
		//------------------------------------------------------------------------------------------------------------------------------------
		// Disable mode
		//------------------------------------------------------------------------------------------------------------------------------------
		if ('evc_disable_mode' in  $dataMap.events[storedEvent.id].meta)
		{
			var disableModeData = $dataMap.events[storedEvent.id].meta.evc_disable_mode.split(' ');

			// Sanity Check
			if (disableModeData.length < 2) { throw new Error('Disablemode expects 2 values, the "switch" and the variable to switch (A, B, C or D). Exmaple: "switch A". Received value: ' + $dataMap.events[storedEvent.id].meta.evc_disable_mode); }

			// Check for switch-disable-mode
			if (disableModeData[0].toLowerCase() === 'switch')
			{
				storedEvent.disableMode = 'switch';
				storedEvent.disableModeLetter = disableModeData[1].toUpperCase();
				
				if (disableModeData.length >= 3)
				{
					storedEvent.disableModeValue = (disableModeData[2].toUpperCase() === 'ON');
				}
				else
				{
					storedEvent.disableModeValue = true;
				}
			}
		}
		//------------------------------------------------------------------------------------------------------------------------------------
		// Process Notetags
		//------------------------------------------------------------------------------------------------------------------------------------
		if ('evc_excl_section' in  $dataMap.events[storedEvent.id].meta) // Exclusive section
		{
			var tagSplitted = $dataMap.events[storedEvent.id].meta.evc_excl_section.toLowerCase().split(' ');
			var exclusiveCategory;
			var exclusiveSection;
			
			if (tagSplitted.length == 1)
			{
				exclusiveCategory = 'default';
				exclusiveSection = tagSplitted[0];				
			}
			else
			{
				exclusiveCategory = tagSplitted[0];
				exclusiveSection = tagSplitted[1];
			}
			
			if (typeof this.sections.exclusives[exclusiveCategory] === 'undefined') { this.sections.exclusives[exclusiveCategory] = {}; }
			if (typeof this.sections.exclusives[exclusiveCategory][exclusiveSection] === "undefined") { this.sections.exclusives[exclusiveCategory][exclusiveSection] = []; }
			this.sections.exclusives[exclusiveCategory][exclusiveSection].push(storedEvent); // $gameMap.sections.exclusives.dungeon.a = [storedevent]
		}
		else if ('evc_section' in $dataMap.events[storedEvent.id].meta) // Regular section
		{
			var sectionName = $dataMap.events[storedEvent.id].meta.evc_section;
			if (typeof this.sections.regular[sectionName] === 'undefined')
			{
				this.sections.regular[sectionName] = { enabled:false, chance:SE.Params.SE_EventChance.DefaultRegularSectionChance, events:[storedEvent] };
				this.sections.regularArray.push(this.sections.regular[sectionName]);
			}
			else
			{
				this.sections.regular[sectionName].events.push(storedEvent);
			}
			
			// Section Chance
			if ('evc_chance' in $dataMap.events[storedEvent.id].meta)
			{
				var chance = parseFloat( $dataMap.events[storedEvent.id].meta.evc_chance);
				this.sections.regular[sectionName].chance = ((chance <= 1) ? chance : chance / 100.0); // Only add a chance between 0.0 and 1.0. So convert values 1.01 - 100.0 to fit this range.
			}
		}
		else if ('evc_chance' in $dataMap.events[storedEvent.id].meta) // Chance (no section)
		{ 
			var chance = parseFloat( $dataMap.events[storedEvent.id].meta.evc_chance);
			var chance = ((chance <= 1) ? chance : chance / 100.0); // Only add a chance between 0.0 and 1.0. So convert values 1.01 - 100.0 to fit this range.
			if (SE.EvChance.Chance(chance)) { SE.EvChance.DisableEv(mapId, event, storedEvent); }
		}
	};
	
	//------------------------------------------------------------------------------------------------------------------------------------
	// Enable a random exclusive section in each category
	//------------------------------------------------------------------------------------------------------------------------------------
	
	for (var cat in this.sections.exclusives)
	{
		if (this.sections.exclusives.hasOwnProperty(cat)) // cat content examples: dungeons, towns
		{
			var category = this.sections.exclusives[cat];
			var sections = [];
			for (var section in category)
			{
				var section = category[section];
				sections.push(section);
			}
			
			if (sections.length > 1) // do not erase exclusive sections that have only 1 entry
			{
				var randomExclusiveIdx = Math.floor(Math.random() * sections.length);
				for (var sectionIdx=0; sectionIdx<sections.length; sectionIdx++)
				{
					var section = sections[sectionIdx];
					if (sectionIdx !== randomExclusiveIdx)
					{
						for (var storedEventIdx=0; storedEventIdx<sections[sectionIdx].length; storedEventIdx++)
						{
							var storedEvent = section[storedEventIdx];
							SE.EvChance.DisableEv(mapId, this.event(storedEvent.id), storedEvent);
							this.event(storedEvent.id).erase();
						}
					}
				}
			}
		}
	}
	//------------------------------------------------------------------------------------------------------------------------------------
	// Now process the regular sections
	//------------------------------------------------------------------------------------------------------------------------------------
	for (var sectionIdx=0; sectionIdx<this.sections.regularArray.length; sectionIdx++)
	{
		var section = this.sections.regularArray[sectionIdx];
		section.enabled = SE.EvChance.Chance(section.chance);
		if (!section.enabled)
		{
			for (var sectionEventIdx=0; sectionEventIdx<section.events.length; sectionEventIdx++)
			{
				var storedEvent = section.events[sectionEventIdx];
				SE.EvChance.DisableEv(mapId, this.event(storedEvent.id), storedEvent);
			}
		}
	}
	//------------------------------------------------------------------------------------------------------------------------------------
	this.refreshTileEvents();
};
/*╔═════════════╗
  ║ End of File ║
  ╚═════════════╝*/