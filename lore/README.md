# Lore

Free-form campaign writing that doesn't need a UI — history, culture, myth,
named beasts, factions, people. Plain markdown, versioned with the rest of
the repo. This folder is already a valid Obsidian vault: open it as a vault
in Obsidian any time and `[[wiki-links]]` between files resolve automatically,
no conversion or setup needed. Everything here also works fine as plain text
if you never open Obsidian at all.

## How this relates to `src/data/`

`src/data/*.json` is the **structured, queryable** layer the app actually
renders — place rosters, NPC stat blocks, faction presence per district,
item/character mechanics. `lore/` is the **narrative depth** layer: the stuff
that's true about the world but that no UI widget needs to query or display.

Don't duplicate mechanical facts (district names, NPC stat blocks, faction
presence lists) — those live in `src/data/` and can drift out of sync if
copied here. Instead, **link out** to the name the JSON uses (`[[Ravenquay]]`
or just the plain name) and write the parts that don't have anywhere else to
live: why the city is called that, what its people believe, what actually
happened during the war it half-remembers.

## Folder layout

- `places/` — regions, cities, ruins, named locations. One file per place.
  For a place that already has a `src/data/places.json` entry, keep this
  file to backstory/culture/history — the districts, NPCs-present, and
  faction-presence facts stay in the JSON as the source of truth.
- `history/` — timeline events, eras, wars, things that happened before or
  during the campaign that don't belong to one single place or person.
- `beasts/` — named, storied creatures (a specific dragon, a legendary
  monster with a history) — not generic stat blocks. Generic monster stats
  belong in the app's bestiary, not here.
- `factions/` — organizations, guilds, cults, political powers.
- `people/` — historical or narratively-significant figures who aren't
  full player-facing NPCs tracked elsewhere (or deeper backstory for ones
  who are).

Add folders as new categories genuinely emerge — don't force content into
the wrong bucket to avoid creating one.

## Conventions

Every file opens with YAML frontmatter for lightweight structure — Obsidian
(and its Dataview plugin, if you ever add it) can query on these fields
later without any extra setup now:

```yaml
---
type: place # place | history | beast | faction | person
tags: [fynesmarch, city]
region: Fynesmarch # when relevant
status: active # active | historical | destroyed | unknown — when relevant
---
```

Tag loosely and consistently — reuse existing tags (region names, faction
names, era names) rather than inventing near-duplicates. Cross-link
liberally with `[[Other Entry Name]]`; a link to a page that doesn't exist
yet is fine, it just means there's a gap worth filling later.

See `_template.md` for a copy-paste starting point.
