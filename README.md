# PF2E Encounter Generator

A Foundry VTT module for generating Pathfinder Second Edition encounters from PF2E compendium actors.

The module uses the PF2E encounter-building math and quick adventure group guidance from Archives of Nethys:

- Encounter design rules: https://2e.aonprd.com/Rules.aspx?ID=2715
- Quick adventure groups: https://2e.aonprd.com/Rules.aspx?ID=2717

## Features

- Generate random PF2E encounters by party level, party size, threat, and maximum number of entries.
- Use GM Core quick adventure group compositions, including Boss and Lackeys, Mated Pair, Troop, and Mook Squad.
- Automatically updates quick group threat to match the selected quick adventure group.
- Import generated creatures and hazards from compendia into a world Actor folder for the encounter.
- Reuse an existing Actor folder when the GM enters a matching encounter name.
- Create numbered folders for auto-generated encounter names so repeated generations stay separate.
- Import repeated monsters once and show their quantity in the encounter chat card.
- Whisper generated encounter cards to GMs only.
- Filter generation by rarity, source publication, name/source text, and traits.
- Use environment presets to populate editable trait filters.

## Trait And Environment Filters

The Environment selector populates the trait filter with a themed preset. For example, Underwater starts with aquatic, amphibious, azarketi, water, locathah, merfolk, and sea-devil traits.

After selecting an environment, the generated trait chips can be edited manually. The first trait starts the filter, and each later trait can be combined with AND or OR. This lets a GM build broad environments such as "aquatic OR amphibious" or tighter filters such as "undead AND incorporeal."

## Source Filters

Sources are built from PF2E compendium publication data, matching the general approach used by the PF2E system compendium browser. The source list is searchable and has a toggle for visible entries.

## Usage

Enable the module in a PF2E world, then use **Configure Settings > PF2E Encounter Generator > Open encounter generator** or the **Generate Encounter** button in the Actors sidebar.

Enter an encounter name if you want to target or reuse a specific Actor folder. Leave it blank to use an auto-generated name based on composition, level, and threat.
