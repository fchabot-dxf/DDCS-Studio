#!/usr/bin/env python
"""
Fix misnamed duplicate IDs by renaming them to match their parent hierarchy.

Detects "break in pattern" where element ID diverges from parent path,
then renames to match actual location. Checks for conflicts before renaming.

Usage:
    python fix_misnamed_duplicates.py <svg_file> <location_md> <output_svg> [--log <log_md>]
"""

import sys
import re
import argparse
from lxml import etree


def parse_location_report(location_md):
    """
    Parse location report to extract duplicate pairs.

    Returns list of dicts:
    [
        {
            'id_2': 'middle_probe_boss_Y_neg_1axis_XY_2',
            'id_base': 'middle_probe_boss_Y_neg_1axis_XY',
            'id_2_line': 1129,
            'id_2_parent': 'g#middle_probe_boss > g#middle_probe_boss_Y_neg > ...',
            'id_base_line': 952,
            'id_base_parent': 'g#middle_probe_boss > g#middle_probe_boss_X_pos > ...'
        },
        ...
    ]
    """
    pairs = []
    current_pair = {}

    with open(location_md, 'r', encoding='utf-8') as f:
        for line in f:
            # Match ID headers: ### `middle_probe_boss_Y_neg_1axis_XY_2` (with _2)
            m_id = re.match(r'^###\s*`([^`]+)`\s*\((with|without)\s+_2\)', line)
            if m_id:
                id_val = m_id.group(1)
                has_2 = m_id.group(2) == 'with'

                if has_2:
                    current_pair = {'id_2': id_val}
                else:
                    current_pair['id_base'] = id_val
                continue

            # Match line number: - **Line:** 1129
            m_line = re.match(r'^-\s*\*\*Line:\*\*\s*(\d+)', line)
            if m_line and current_pair:
                line_num = m_line.group(1)
                if 'id_2' in current_pair and 'id_2_line' not in current_pair:
                    current_pair['id_2_line'] = line_num
                elif 'id_base' in current_pair:
                    current_pair['id_base_line'] = line_num
                continue

            # Match parent path: - **Parent path:** g#id1 > g#id2
            m_parent = re.match(r'^-\s*\*\*Parent path:\*\*\s*(.+)', line)
            if m_parent and current_pair:
                parent_path = m_parent.group(1).strip()
                if 'id_2' in current_pair and 'id_2_parent' not in current_pair:
                    current_pair['id_2_parent'] = parent_path
                elif 'id_base' in current_pair:
                    current_pair['id_base_parent'] = parent_path
                    # Pair is complete
                    pairs.append(current_pair)
                    current_pair = {}

    return pairs


def extract_parent_ids(parent_path_string):
    """
    Extract ID components from parent path.

    Input: "g#middle_probe_boss > g#middle_probe_boss_Y_neg > g#middle_probe_boss_Y_neg_1axis"
    Output: ["middle_probe_boss", "middle_probe_boss_Y_neg", "middle_probe_boss_Y_neg_1axis"]
    """
    if not parent_path_string or parent_path_string == "(root)":
        return []

    # Split by ' > ' and extract IDs after '#'
    parts = parent_path_string.split(' > ')
    ids = []
    for part in parts:
        # Extract ID from "g#id_name" or "tag#id_name"
        m = re.match(r'^[^#]+#(.+)$', part.strip())
        if m:
            ids.append(m.group(1))

    return ids


def find_break_point(element_id, parent_id_chain):
    """
    Find where element_id diverges from parent_id_chain.

    Also detects if the immediate parent is itself misnamed (break in parent chain).

    Args:
        element_id: Like "middle_probe_boss_Y_neg_1axis_XY"
        parent_id_chain: Like ["middle_probe_boss", "middle_probe_boss_X_pos", ...]

    Returns:
        (break_index, remaining_suffix) or (None, None) if no break
    """
    if not parent_id_chain:
        return (None, None)

    # Build expected ID prefix from parent chain
    # The last parent's ID should be the prefix of element ID
    last_parent_id = parent_id_chain[-1]

    # Check if the immediate parent itself is misnamed
    # by comparing it with the second-to-last parent
    if len(parent_id_chain) >= 2:
        second_last_parent = parent_id_chain[-2]
        # If last parent doesn't start with second-to-last parent, it's misnamed
        if not last_parent_id.startswith(second_last_parent + '_'):
            # Parent is misnamed - element should be renamed relative to grandparent
            # Extract suffix: parent's LAST component + element's type suffix
            # This preserves the unique identifier without the misnamed hierarchy
            if element_id.startswith(last_parent_id + '_'):
                # Get the last meaningful component of the parent
                # For "middle_probe_boss_Y_neg_1axis_XY", take "XY"
                parent_parts = last_parent_id.split('_')
                parent_last_component = parent_parts[-1] if parent_parts else ""

                # Get element's suffix after parent
                element_suffix = element_id[len(last_parent_id) + 1:]

                # Combine: parent's last component + element's suffix
                # For example: "XY" + "endarrow" = "XY_endarrow"
                if parent_last_component and element_suffix:
                    suffix = f"{parent_last_component}_{element_suffix}"
                elif parent_last_component:
                    suffix = parent_last_component
                else:
                    suffix = element_suffix

                return (len(parent_id_chain) - 2, suffix)

    # Check if element ID starts with last parent ID
    if element_id.startswith(last_parent_id + '_'):
        # No break - ID correctly follows parent
        return (None, None)

    # Find the break by comparing ID components with parent chain
    # Use the deepest parent ID as the expected base
    expected_base = last_parent_id

    # Element ID doesn't match - this is a misnamed element
    # The break is after the last common ancestor

    # Extract suffix (parts after the break)
    # Try to find common prefix
    id_parts = element_id.split('_')
    parent_parts = last_parent_id.split('_')

    # Find last common component
    common_len = 0
    for i, (id_part, parent_part) in enumerate(zip(id_parts, parent_parts)):
        if id_part == parent_part:
            common_len = i + 1
        else:
            break

    # Suffix is everything after the common prefix in the element ID
    suffix_parts = id_parts[len(parent_parts):]
    suffix = '_'.join(suffix_parts) if suffix_parts else ''

    return (len(parent_id_chain) - 1, suffix)


def extract_semantic_suffix(stranger_id):
    """
    Extract semantic information (Axis Dir + Quad) from stranger ID.

    Args:
        stranger_id: Like "middle_probe_boss_Y_neg_1axis_XY_endarrow"

    Returns:
        Formatted suffix like "_ref_Y_neg_XY", or "" if not found

    Pattern:
        <base>_<AxisDir>_<AxisType>_<Quad>_<elementType>
        Extract: AxisDir and Quad, skip AxisType (1axis/2axis)
    """
    # Known axis directions
    axis_dirs = ['X_pos', 'X_neg', 'Y_pos', 'Y_neg', 'Z_pos', 'Z_neg']
    # Known axis types to skip
    axis_types = ['1axis', '2axis']
    # Known quad patterns (simplified - matches XY, XZ, YZ, XtoY_neg, etc.)

    parts = stranger_id.split('_')

    # Find axis direction
    axis_dir = None
    axis_dir_idx = -1
    for i, part in enumerate(parts):
        # Check if this part + next part form an axis direction
        if i + 1 < len(parts):
            candidate = f"{part}_{parts[i+1]}"
            if candidate in axis_dirs:
                axis_dir = candidate
                axis_dir_idx = i
                break

    if not axis_dir:
        return ""

    # Skip axis type and find quad
    # Quad should be after axis type (1axis or 2axis)
    quad = None
    search_start = axis_dir_idx + 2  # Skip the two parts of axis_dir

    # Check if next part is axis type
    if search_start < len(parts) and parts[search_start] in axis_types:
        search_start += 1  # Skip axis type

    # Now extract quad - it could be multi-part (like XtoY_neg)
    # Look for uppercase combinations or known patterns
    if search_start < len(parts):
        quad_parts = []
        for i in range(search_start, len(parts)):
            part = parts[i]
            # Stop at known element types (lowercase patterns)
            if part in ['endarrow', 'startarrow', 'jog', 'jogpath', 'miniprobe',
                       'spindle', 'retractarrowneg', 'retractarrowpos',
                       'retractpathneg', 'retractpathpos', 'probepath1', 'probepath2']:
                break
            # Include parts that look like quad components
            # (uppercase combos or specific patterns like "neg", "pos" after "XtoY")
            if part.isupper() or (quad_parts and part in ['neg', 'pos']):
                quad_parts.append(part)
            elif quad_parts:
                # Already started collecting quad, this might be end
                break

        if quad_parts:
            quad = '_'.join(quad_parts)

    if axis_dir and quad:
        return f"_ref_{axis_dir}_{quad}"
    elif axis_dir:
        return f"_ref_{axis_dir}"

    return ""


def generate_correct_id(parent_id_chain, suffix, semantic_suffix="", break_index=None):
    """
    Generate correct ID using parent chain + suffix + semantic suffix.

    Args:
        parent_id_chain: ["middle_probe_boss", "...", "middle_probe_boss_X_pos_2axis_XtoY_neg"]
        suffix: "endarrow" (element type suffix)
        semantic_suffix: "_ref_Y_neg_XY" (semantic info from stranger)
        break_index: Index of parent where break occurs (use this parent as base)

    Returns:
        "middle_probe_boss_X_pos_2axis_XtoY_neg_endarrow_ref_Y_neg_XY"
    """
    if not parent_id_chain:
        return None

    # Use the parent at break_index as the base, or the last parent if no break_index
    if break_index is not None and break_index < len(parent_id_chain):
        base = parent_id_chain[break_index]
    else:
        base = parent_id_chain[-1]  # Deepest parent

    result = base
    if suffix:
        result = f"{result}_{suffix}"
    if semantic_suffix:
        result = f"{result}{semantic_suffix}"

    return result


def identify_stranger(pair):
    """
    Identify which ID in the pair is the "stranger" (misnamed).

    Args:
        pair: Dict with id_2, id_base, and their parent paths

    Returns:
        'id_2' or 'id_base' indicating which one is the stranger, or None
    """
    # The one with _2 should be under the correct parent
    # The one without _2 is likely the stranger

    # Extract parent IDs
    parent_2 = extract_parent_ids(pair['id_2_parent'])
    parent_base = extract_parent_ids(pair['id_base_parent'])

    # Check if id_2 follows its parent naming
    if parent_2:
        last_parent_2 = parent_2[-1]
        # id_2 should start with last_parent_2
        id_2_clean = pair['id_2'].replace('_2', '')  # Check without the _2 suffix
        if last_parent_2 in id_2_clean or id_2_clean.startswith(last_parent_2.rsplit('_', 1)[0]):
            # id_2 follows parent - so id_base is the stranger
            return 'id_base'

    # Default: assume id_base (without _2) is the stranger
    return 'id_base'


def main(svg_path, location_md, output_svg, log_path='docs/strangers_rename_map.md', dry_run=False):
    # Parse location report
    pairs = parse_location_report(location_md)
    print(f'Found {len(pairs)} duplicate pairs in location report')

    if not pairs:
        print('No duplicate pairs to process')
        return

    # Load SVG
    tree = etree.parse(svg_path)
    root = tree.getroot()

    # Build ID -> element map and existing IDs set
    id_to_elem = {}
    existing_ids = set()
    for el in root.iter():
        idv = el.get('id')
        if idv:
            id_to_elem[idv] = el
            existing_ids.add(idv)

    # Process each pair
    renames = []
    conflicts = []
    skipped = []

    for pair in pairs:
        # Identify stranger
        stranger_key = identify_stranger(pair)
        if not stranger_key:
            skipped.append(pair)
            continue

        stranger_id = pair[stranger_key]
        stranger_parent = pair[f'{stranger_key}_parent']

        # Extract parent chain
        parent_chain = extract_parent_ids(stranger_parent)
        if not parent_chain:
            skipped.append(pair)
            continue

        # Find break point
        break_idx, suffix = find_break_point(stranger_id, parent_chain)

        if break_idx is None:
            # No break detected - ID matches parent
            skipped.append(pair)
            continue

        # Extract semantic suffix from stranger ID
        semantic_suffix = extract_semantic_suffix(stranger_id)

        # Generate correct ID with semantic suffix and break index
        correct_id = generate_correct_id(parent_chain, suffix, semantic_suffix, break_idx)

        if not correct_id or correct_id == stranger_id:
            skipped.append(pair)
            continue

        # **CRITICAL CHECK**: Does the correct ID already exist?
        if correct_id in existing_ids:
            conflicts.append({
                'stranger_id': stranger_id,
                'correct_id': correct_id,
                'reason': 'Target ID already exists',
                'pair': pair
            })
            print(f'CONFLICT: Cannot rename {stranger_id} -> {correct_id} (already exists)')
            continue

        # Safe to rename
        renames.append({
            'old_id': stranger_id,
            'new_id': correct_id,
            'semantic_suffix': semantic_suffix,
            'pair': pair
        })

    print(f'\nAnalysis complete:')
    print(f'  - {len(renames)} strangers to rename')
    print(f'  - {len(conflicts)} conflicts (set aside)')
    print(f'  - {len(skipped)} skipped (no break detected)')

    if dry_run:
        print('\nDry run - no changes made')
        return

    # Apply renames
    for rename in renames:
        old_id = rename['old_id']
        new_id = rename['new_id']

        if old_id in id_to_elem:
            elem = id_to_elem[old_id]
            elem.set('id', new_id)
            # Update tracking
            existing_ids.remove(old_id)
            existing_ids.add(new_id)
            id_to_elem[new_id] = elem
            del id_to_elem[old_id]

    # Write output SVG
    tree.write(output_svg, encoding='utf-8', xml_declaration=True)
    print(f'\nWrote updated SVG to {output_svg}')

    # Write rename log
    with open(log_path, 'w', encoding='utf-8') as f:
        f.write('# Stranger Rename Map\n\n')
        f.write('## Successfully Renamed\n\n')
        f.write('| old_id | new_id |\n')
        f.write('|--------|--------|\n')
        for r in renames:
            f.write(f'| {r["old_id"]} | {r["new_id"]} |\n')

        f.write('\n## Conflicts (Set Aside)\n\n')
        if conflicts:
            f.write('These could not be renamed because the target ID already exists.\n\n')
            f.write('| stranger_id | would_rename_to | reason |\n')
            f.write('|-------------|-----------------|--------|\n')
            for c in conflicts:
                f.write(f'| {c["stranger_id"]} | {c["correct_id"]} | {c["reason"]} |\n')
        else:
            f.write('None\n')

    print(f'Rename log written to {log_path}')

    # Print summary
    if renames:
        print('\nRenamed strangers:')
        for r in renames[:10]:
            print(f'  {r["old_id"]} -> {r["new_id"]}')
        if len(renames) > 10:
            print(f'  ... and {len(renames) - 10} more')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fix misnamed duplicate IDs')
    parser.add_argument('svg', help='Input SVG file')
    parser.add_argument('location_md', help='Location report markdown')
    parser.add_argument('output_svg', help='Output SVG file')
    parser.add_argument('--log', default='docs/strangers_rename_map.md', help='Rename log output')
    parser.add_argument('--dry-run', action='store_true', help='Dry run (no changes)')

    args = parser.parse_args()

    main(args.svg, args.location_md, args.output_svg, log_path=args.log, dry_run=args.dry_run)
