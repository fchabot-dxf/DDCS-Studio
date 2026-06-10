import sys
from lxml import etree

# Usage: python check_rename_targets.py <svg_file> <check_md>

def parse_check_file(check_md):
    ids = []
    with open(check_md, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('|') and '| ❌ |' in line:
                id_ = line.split('|')[1].strip()
                if '_2' in id_ and '_2axis' not in id_:
                    ids.append(id_)
    return ids


def main(svg_path, check_md):
    ids = parse_check_file(check_md)
    tree = etree.parse(svg_path)
    root = tree.getroot()

    # build map id -> element tag
    id_map = {}
    for elem in root.iter():
        id_ = elem.get('id')
        if id_:
            # local name (without namespace)
            tag_local = etree.QName(elem).localname
            id_map[id_] = tag_local

    found = []
    missing = []
    non_group = []
    for id_ in ids:
        if id_ in id_map:
            if id_map[id_] == 'g':
                found.append(id_)
            else:
                non_group.append((id_, id_map[id_]))
        else:
            missing.append(id_)

    print(f'Total _2 (❌) IDs in check file (excluding _2axis): {len(ids)}')
    print(f'Found as <g>: {len(found)}')
    print(f'Found but not <g>: {len(non_group)}')
    print(f'Not found in SVG: {len(missing)}')
    print('\n--- sample lists (up to 40) ---')
    if found:
        print('\nGroup IDs (will be renamed):')
        for i, s in enumerate(found[:40], 1):
            print(f'{i}. {s}')
    if non_group:
        print('\nNon-group IDs (present but not <g>):')
        for i, (s,t) in enumerate(non_group[:40], 1):
            print(f'{i}. {s}  (tag={t})')
    if missing:
        print('\nIDs in check file but missing in SVG:')
        for i, s in enumerate(missing[:40], 1):
            print(f'{i}. {s}')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: python check_rename_targets.py <svg_file> <check_md>')
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])