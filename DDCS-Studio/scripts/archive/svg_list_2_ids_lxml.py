import sys
from lxml import etree
from collections import defaultdict

# Usage: python svg_list_2_ids_lxml.py <svg_file> <output_md>

def main(svg_path, output_md):
    tree = etree.parse(svg_path)
    root = tree.getroot()
    nsmap = root.nsmap.copy()
    ns = nsmap.get(None, '')
    if ns:
        ns = f'{{{ns}}}'
    else:
        ns = ''

    ids = set()
    for elem in root.iter():
        id_ = elem.get('id')
        if id_ and '_2' in id_:
            ids.add(id_)

    with open(output_md, 'w', encoding='utf-8') as f:
        f.write('# All SVG IDs containing _2\n\n')
        for id_ in sorted(ids):
            f.write(f'- {id_}\n')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: python svg_list_2_ids_lxml.py <svg_file> <output_md>')
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
