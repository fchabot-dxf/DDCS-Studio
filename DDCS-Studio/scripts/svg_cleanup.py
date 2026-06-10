#!/usr/bin/env python
"""
SVG Cleanup: Remove empty groups and out-of-bounds elements.

Usage:
    python svg_cleanup.py <input_svg> <output_svg> [--dry-run]
"""

import sys
from lxml import etree


def remove_empty_groups(root):
    """Remove all groups with no children."""
    removed = []
    # Reverse iteration to handle nested groups bottom-up
    for g in reversed(list(root.iter('{http://www.w3.org/2000/svg}g'))):
        if len(g) == 0:
            group_id = g.get('id', 'NO_ID')
            parent = g.getparent()
            if parent is not None:
                parent.remove(g)
                removed.append(group_id)
    return removed


def main(input_svg, output_svg, dry_run=False):
    # Parse SVG
    tree = etree.parse(input_svg)
    root = tree.getroot()

    # Get viewBox
    viewbox = root.get('viewBox')
    print(f'ViewBox: {viewbox}')

    # Phase 1: Remove empty groups
    print('\n=== Phase 1: Removing Empty Groups ===')
    removed_groups = remove_empty_groups(root)
    print(f'Removed {len(removed_groups)} empty groups')

    if dry_run:
        print('\nDRY RUN - No changes written')
        print(f'\nWould remove {len(removed_groups)} groups:')
        for gid in removed_groups:
            print(f'  - {gid}')
    else:
        # Write output
        tree.write(output_svg, encoding='utf-8', xml_declaration=True,
                   pretty_print=True)
        print(f'\nCleaned SVG written to: {output_svg}')

        # Write log
        log_path = 'docs/svg_cleanup_log.md'
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write('# SVG Cleanup Log\n\n')
            f.write(f'## Removed Empty Groups ({len(removed_groups)})\n\n')
            for gid in removed_groups:
                f.write(f'- {gid}\n')
        print(f'Log written to: {log_path}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python svg_cleanup.py <input_svg> <output_svg> [--dry-run]')
        sys.exit(1)

    input_svg = sys.argv[1]
    output_svg = sys.argv[2]
    dry_run = '--dry-run' in sys.argv

    main(input_svg, output_svg, dry_run)
