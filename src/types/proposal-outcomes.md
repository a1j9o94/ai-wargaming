# Proposal Types and Outcomes

This document describes the different types of proposals available in the game and their potential outcomes.

## Military Actions

Military actions are combat-based proposals where participants can engage in warfare. The outcome is determined by comparing the might of the attacking and defending forces.

### Key Components:
- **Attack Cost**: 30 (base cost to initiate an attack)
- **Outcomes depend on victory/defeat:**

#### For Attackers:
- **When Victorious:**
  - Might increases by 50% of current might
  - Economy increases by 30% of current economy (spoils of war)
- **When Defeated:**
  - Loses 40% of current might
  - Fixed economy loss of 20 points

#### For Defenders:
- **When Victorious:**
  - Might increases by 30% of current might
  - Small economy gain of 10 points
- **When Defeated:**
  - Loses 60% of current might
  - Loses 40% of current economy

Example:
```
Attacker (Might: 50, Economy: 60) wins against Defender (Might: 40, Economy: 50)
Attacker gains: +25 Might (50% of 50), +18 Economy (30% of 60)
Defender loses: -24 Might (60% of 40), -20 Economy (40% of 50)
```

## Trade Agreements

Trade proposals follow a prisoner's dilemma model where both parties can choose to cooperate or betray.

### Possible Outcomes:

#### Both Cooperate:
- No might change
- Both gain 20% of their current economy

#### One Betrays:
- **Betrayer:**
  - No might change
  - Gains 30% of their current economy
- **Betrayed:**
  - No might change
  - Loses 10% of their current economy

#### Both Betray:
- No might change
- Both lose 10 economy points

Example:
```
Trader A (Economy: 50) and Trader B (Economy: 40) both cooperate
Trader A gains: +10 Economy (20% of 50)
Trader B gains: +8 Economy (20% of 40)
```

## Alliances

Alliances represent formal agreements between participants that can be formed or broken.

### Formation:
- Might increases by 15% for all participants
- Economy increases by 15% for all participants

### Breaking:
- Fixed might loss of 10 points
- Fixed economy loss of 10 points

Example:
```
Two players form an alliance:
Player A (Might: 60, Economy: 50):
- Gains +9 Might (15% of 60)
- Gains +7.5 Economy (15% of 50)

Player B (Might: 40, Economy: 30):
- Gains +6 Might (15% of 40)
- Gains +4.5 Economy (15% of 30)
```

## Combat Resolution

Military conflicts are resolved using a combination of:
- Total might of all participants
- Group size considerations
- Efficiency penalties for attackers (90% effectiveness)
- Random factor for unpredictability

Spoils of war are distributed proportionally based on the might of the winning participants. 