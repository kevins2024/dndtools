# One-time migration (2026-09-01): converted every class/subclass file's
# features_by_level from bare name-string arrays to id-string arrays, backed
# by src/data/published_features.json (backfilling a stable id onto every
# entry that lacked one) and the SRD features cache (using its own `index`
# as id). Also generates engine/data/feature-catalog.json, the flat id->name
# index engine/rules/featureCatalog.js reads at runtime.
#
# Not meant to be re-run routinely — a NEW feature added after this point
# should just get a real id assigned by hand when it's written (matching the
# existing prefix convention: hb_ for a fresh hand-authored catalog entry,
# pub_/an SRD index for something already catalogued, gen_ as a last-resort
# synthetic id for an uncatalogued feature). Re-running this script would
# still work (it's idempotent — already-id'd entries pass through
# unchanged), but "did I break the id conventions" isn't something it checks
# for you.
import json, glob, re

ROOT = '/Users/kevinsmith/github/dndtools'

def slugify(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip('-')

srd = json.load(open(f'{ROOT}/src/data/api_data_cache/features.json'))
pub = json.load(open(f'{ROOT}/src/data/published_features.json'))

# 1. Backfill missing ids on published_features.json
seen_ids = {f['id'] for f in pub if 'id' in f}
backfilled = 0
for f in pub:
    if 'id' not in f:
        candidate = 'pub_' + slugify(f['name'])
        if candidate in seen_ids:
            candidate = candidate + '_2'
        # id first for readability
        f2 = {'id': candidate}
        f2.update(f)
        f.clear()
        f.update(f2)
        seen_ids.add(candidate)
        backfilled += 1

pub_by_name = {}
for f in pub:
    pub_by_name.setdefault(f['name'], []).append(f)

srd_by_name = {}
for f in srd:
    srd_by_name.setdefault(f['name'], []).append(f)

class_files = sorted(glob.glob(f'{ROOT}/engine/data/classes/*.json'))
subclass_files = sorted(glob.glob(f'{ROOT}/engine/data/subclasses/*.json'))

new_stub_entries = []
stub_ids_seen = set()
warnings = []

def resolve(file_path, class_name, subclass_name, level, name):
    if name in pub_by_name:
        entries = pub_by_name[name]
        return entries[0]['id']
    if name in srd_by_name:
        candidates = srd_by_name[name]
        class_matches = [c for c in candidates if c.get('class', {}).get('name', '').lower() == (class_name or '').lower()]
        if class_matches:
            return class_matches[0]['index']
        warnings.append(f"SRD name match for {name!r} but no class match ({class_name}) in {file_path} - using first candidate")
        return candidates[0]['index']
    parts = [slugify(class_name or 'unknown')]
    parts.append(slugify(subclass_name) if subclass_name else 'base')
    parts.append(slugify(name))
    synth_id = 'gen_' + '_'.join(parts)
    if synth_id not in stub_ids_seen:
        stub_ids_seen.add(synth_id)
        new_stub_entries.append({
            'id': synth_id,
            'name': name,
            'class': f"{class_name} ({subclass_name})" if subclass_name else class_name,
            'level_gained': int(level),
            'homebrew': False,
            'source': None,
            'needs_description': True,
            'description': None,
        })
    return synth_id

# 2. Rewrite each class/subclass file's features_by_level: names -> ids
files_changed = 0
for fp in class_files + subclass_files:
    d = json.load(open(fp))
    class_name = d.get('class') or d.get('name')
    subclass_name = d.get('name') if 'class' in d else None
    fbl = d.get('features_by_level', {})
    new_fbl = {}
    for level, names in fbl.items():
        new_fbl[level] = [resolve(fp, class_name, subclass_name, level, n) for n in names]
    d['features_by_level'] = new_fbl
    with open(fp, 'w') as f:
        json.dump(d, f, indent=2)
        f.write('\n')
    files_changed += 1

# 3. Append new stub entries to published_features.json, write it back out
pub.extend(new_stub_entries)
with open(f'{ROOT}/src/data/published_features.json', 'w', encoding='utf-8') as f:
    json.dump(pub, f, indent=2, ensure_ascii=False)
    f.write('\n')

# 4. Build engine/data/feature-catalog.json: flat id -> name index, engine-local
# (keeps engine/ self-contained — this is a lightweight name-only mirror of
# published_features.json + the SRD features cache, both of which live
# outside engine/ in src/data. Regenerate by re-running this script if new
# ids are ever added to either source.)
catalog = {}
for f in srd:
    catalog.setdefault(f['index'], f['name'])
for f in pub:
    catalog[f['id']] = f['name']  # published wins on id collision (shouldn't happen — different prefixes)

catalog_path = f'{ROOT}/engine/data/feature-catalog.json'
with open(catalog_path, 'w') as f:
    json.dump(catalog, f, indent=2, sort_keys=True)
    f.write('\n')

print(f"Backfilled {backfilled} ids in published_features.json")
print(f"Rewrote features_by_level (name -> id) in {files_changed} class/subclass files")
print(f"Added {len(new_stub_entries)} new stub entries to published_features.json (total now {len(pub)})")
print(f"Wrote engine/data/feature-catalog.json with {len(catalog)} id->name entries")
print(f"Warnings: {len(warnings)}")
for w in warnings:
    print(" ", w)
