#!/usr/bin/env python
import argparse
import re
import shutil
from lxml import etree

# Rename all elements that have an `_2` ID (excluding `_2axis`) and are marked
# ❌ in the check markdown. Preserve uniqueness. Do NOT update references (separate
# step).

USAGE = "python rename_unique_2_group_ids.py <svg_file> <check_md> <output_svg> [--dry-run]"

RENAME_LOG_DEFAULT = 'docs/middleViz_2_rename_map.md'

id_row_re = re.compile(r'^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|')


def parse_check_file(check_md):
    """Return a set of _2 IDs (excluding _2axis-only) that are marked ❌ in the check MD.

    Only exclude IDs where '_2axis' is the SOLE '_2' occurrence.
    Include IDs that have '_2axis' AND other '_2' suffixes.
    """
    ids = []
    with open(check_md, 'r', encoding='utf-8') as f:
        for line in f:
            m = id_row_re.match(line)
            if not m:
                continue
            id_col = m.group(1).strip()
            status_col = m.group(2).strip()
            # accept explicit '❌' or common negative markers
            if ('❌' in status_col) or (status_col.lower() in ('no', 'false', 'x')):
                if '_2' in id_col:
                    # Exclude only when the sole '_2' is within '_2axis'
                    count = id_col.count('_2')
                    if count == 1 and '_2axis' in id_col:
                        continue  # Skip _2axis-only IDs
                    ids.append(id_col)
    return ids


def non_2_version(id_):
    """Produce the intended non-_2 form of the ID.
    - If ID ends with '_2' -> strip that suffix.
    - Else replace the first occurrence of '_2_' with '_' (middle-of-name case).
    """
    if id_.endswith('_2'):
        return id_[:-2]
    return id_.replace('_2_', '_', 1)


def local_name(elem):
    return etree.QName(elem).localname


def make_unique(base, existing):
    """Return a unique candidate not in `existing` by appending _renamedN if needed."""
    if base not in existing:
        return base
    i = 1
    while True:
        candidate = f"{base}_renamed{i}"
        if candidate not in existing:
            return candidate
        i += 1


def write_rename_log(rename_map, path):
    with open(path, 'w', encoding='utf-8') as f:
        f.write('# Renamed _2 group IDs\n\n')
        f.write('| old_id | new_id |\n')
        f.write('|--------|--------|\n')
        for old, new in sorted(rename_map.items()):
            f.write(f'| {old} | {new} |\n')


def main(svg_path, check_md, output_svg, dry_run=False, backup=False, log_path=RENAME_LOG_DEFAULT):
    targets = set(parse_check_file(check_md))
    if not targets:
        print('No _2 (❌) targets found in check file. Nothing to do.')
        return

    tree = etree.parse(svg_path)
    root = tree.getroot()

    # Build id -> element map and set of existing ids
    id_to_elem = {}
    existing_ids = set()
    for el in root.iter():
        idv = el.get('id')
        if idv:
            id_to_elem[idv] = el
            existing_ids.add(idv)

    will_rename = []
    missing = []
    for id_ in sorted(targets):
        if id_ not in id_to_elem:
            missing.append(id_)
            continue
        will_rename.append(id_)

    print(f'Parsed {len(targets)} targets from check file: {len(will_rename)} element(s) will be renamed, {len(missing)} missing.')

    if not will_rename:
        return

    if backup and not dry_run:
        bak = svg_path + '.bak'
        shutil.copy2(svg_path, bak)
        print(f'Backup written to {bak}')

    rename_map = {}
    # Perform renames (in-memory)
    for old_id in will_rename:
        el = id_to_elem.get(old_id)
        if el is None:
            continue
        proposed = non_2_version(old_id)
        new_id = make_unique(proposed, existing_ids)
        if dry_run:
            rename_map[old_id] = new_id
        else:
            el.set('id', new_id)
            # update maps
            existing_ids.remove(old_id)
            existing_ids.add(new_id)
            id_to_elem.pop(old_id, None)
            id_to_elem[new_id] = el
            rename_map[old_id] = new_id

    # Write output SVG
    if dry_run:
        print('Dry-run mode: no file written.')
    else:
        tree.write(output_svg, encoding='utf-8', xml_declaration=True)
        print(f'Wrote updated SVG to {output_svg} (renamed {len(rename_map)} IDs).')

    # Write rename log
    if rename_map:
        write_rename_log(rename_map, log_path)
        print(f'Rename map written to {log_path}')

    # Print summary
    if rename_map:
        print('\nRenamed IDs:')
        for old, new in sorted(rename_map.items()):
            print(f'{old} -> {new}')
    if missing:
        print('\nIDs in check file but not found in SVG:')
        for id_ in missing[:40]:
            print(id_)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description='Rename unique _2 element IDs (all element types).')
    p.add_argument('svg', help='input SVG path')
    p.add_argument('check_md', help='check markdown file (docs/middleViz_2_id_check.md)')
    p.add_argument('out_svg', help='output SVG path')
    p.add_argument('--dry-run', action='store_true', help='do not write files; only report')
    p.add_argument('--backup', action='store_true', help='save a .bak copy of the input SVG before writing')
    p.add_argument('--log', default=RENAME_LOG_DEFAULT, help='path to write rename map (markdown)')
    args = p.parse_args()

    main(args.svg, args.check_md, args.out_svg, dry_run=args.dry_run, backup=args.backup, log_path=args.log)

