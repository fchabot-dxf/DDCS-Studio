import sys
from lxml import etree

# Usage: python svg_verify_non_2_exists_lxml.py <svg_file> <ids_md> <output_md>

def main(svg_path, ids_md, output_md):
    tree = etree.parse(svg_path)
    root = tree.getroot()
    nsmap = root.nsmap.copy()
    ns = nsmap.get(None, '')
    if ns:
        ns = f'{{{ns}}}'
    else:
        ns = ''

    # Collect all IDs in the SVG
    all_ids = set()
    for elem in root.iter():
        id_ = elem.get('id')
        if id_:
            all_ids.add(id_)

    # Read _2 IDs from the markdown file
    _2_ids = []
    with open(ids_md, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('- '):
                id_ = line[2:]
                if id_.endswith('_2') or '_2_' in id_:
                    _2_ids.append(id_)

    # Check if non-_2 version exists
    def non_2_version(id_):
        if id_.endswith('_2'):
            return id_[:-2]
        return id_.replace('_2_', '_')

    results = []
    for id_ in _2_ids:
        non2 = non_2_version(id_)
        exists = '✅' if non2 in all_ids else '❌'
        results.append((id_, exists))

    # Write output
    with open(output_md, 'w', encoding='utf-8') as f:
        f.write('# _2 IDs and non-_2 existence check\n\n')
        f.write('| _2 ID | non-_2 exists? |\n')
        f.write('|-------|:--------------:|\n')
        for id_, exists in results:
            f.write(f'| {id_} | {exists} |\n')

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print('Usage: python svg_verify_non_2_exists_lxml.py <svg_file> <ids_md> <output_md>')
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
