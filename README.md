# PF2E Encounter Generator

A Foundry VTT module for generating Pathfinder Second Edition encounters from PF2E compendium actors.

Generated actors are imported into a world Actor folder named after the encounter. If no name is entered, the module creates one from the selected composition, party level, and threat.

The generator follows the GM Core encounter design budget:

| Threat | XP Budget | Character Adjustment |
| --- | ---: | ---: |
| Trivial | 40 or less | 10 or less |
| Low | 60 | 20 |
| Moderate | 80 | 20 |
| Severe | 120 | 30 |
| Extreme | 160 | 40 |

Creature and hazard XP costs are calculated by level difference from the party level, from party level -4 through party level +4.

The form also includes the GM Core quick adventure groups:

| Group | Structure | XP |
| --- | --- | ---: |
| Boss and Lackeys | One party level +2 creature, four party level -4 creatures | 120 |
| Boss and Lieutenant | One party level +2 creature, one party level creature | 120 |
| Elite Enemies | Three party level creatures | 120 |
| Lieutenant and Lackeys | One party level creature, four party level -4 creatures | 80 |
| Mated Pair | Two party level creatures | 80 |
| Troop | One party level creature, two party level -2 creatures | 80 |
| Mook Squad | Six party level -4 creatures | 60 |

Rules reference: https://2e.aonprd.com/Rules.aspx?ID=2715

## Usage

Enable the module in a PF2E world, then use **Configure Settings > PF2E Encounter Generator > Open encounter generator** or the **Generate Encounter** button in the Actors sidebar.

Generated results are posted to chat as compendium links so you can inspect, drag, or import the selected creatures and hazards as needed.
