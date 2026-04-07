# svg_map_generator.py
"""
Usage:
    python svg_map_generator.py ../src/assets/middleViz.svg ../docs/middleViz_map.md

This script parses the SVG file and outputs a Markdown map of the group hierarchy.
The first four parent group levels are colored differently using HTML in Markdown.
"""
import sys
import xml.etree.ElementTree as ET

LEVEL_COLORS = [
    '#d32f2f',  # Level 1 - Red
    '#1976d2',  # Level 2 - Blue
    '#388e3c',  # Level 3 - Green
    '#fbc02d',  # Level 4 - Yellow
]

def colorize(text, level):
    if level < len(LEVEL_COLORS):
        return f'<span style="color:{LEVEL_COLORS[level]}">{text}</span>'
    return text

def map_groups(elem, level=0):
    out = ''
    if elem.tag.endswith('g'):
        gid = elem.attrib.get('id')
        if gid:
            out += f"{'  ' * level}- {colorize(gid, level)}\n"
        for child in elem:
            out += map_groups(child, level + 1)
    else:
        for child in elem:
            out += map_groups(child, level)
    return out

def main():
    if len(sys.argv) != 3:
        print('Usage: python svg_map_generator.py <input-svg> <output-md>')
        sys.exit(1)
    input_svg, output_md = sys.argv[1:3]
    tree = ET.parse(input_svg)
    root = tree.getroot()
    map_md = map_groups(root)
    header = '# SVG Group Hierarchy Map\n\n'
    with open(output_md, 'w', encoding='utf-8') as f:
        f.write(header + map_md)
    print(f'SVG map written to {output_md}')

if __name__ == '__main__':
    main()
