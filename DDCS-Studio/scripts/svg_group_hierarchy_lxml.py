import sys
from lxml import etree

# Usage: python svg_group_hierarchy_lxml.py <svg_file> <output_md>

def get_group_hierarchy(elem, level=0):
    lines = []
    if elem.tag.endswith('g'):
        id_ = elem.get('id', None)
        if id_:
            lines.append('  ' * level + f'- {id_}')
        else:
            lines.append('  ' * level + '- (no id)')
        for child in elem:
            lines.extend(get_group_hierarchy(child, level + 1))
    else:
        # Only descend into children if they might contain <g>
        for child in elem:
            lines.extend(get_group_hierarchy(child, level))
    return lines

def main(svg_path, output_md):
    tree = etree.parse(svg_path)
    root = tree.getroot()
    lines = ['# SVG Group Hierarchy Map', '']
    for elem in root:
        lines.extend(get_group_hierarchy(elem))
    with open(output_md, 'w', encoding='utf-8') as f:
        for line in lines:
            f.write(line + '\n')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: python svg_group_hierarchy_lxml.py <svg_file> <output_md>')
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
