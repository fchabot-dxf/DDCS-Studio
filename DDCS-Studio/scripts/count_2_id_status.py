import sys
from pathlib import Path

if len(sys.argv) != 2:
    print('Usage: python count_2_id_status.py <check_md>')
    sys.exit(1)

p = Path(sys.argv[1])
text = p.read_text(encoding='utf-8')
lines = [l.strip() for l in text.splitlines() if l.strip().startswith('|') and '|' in l]
# count ✅ and ❌ appearances
count_yes = text.count('✅')
count_no = text.count('❌')
# total IDs is number of table rows excluding header (lines that look like '| id | status |')
rows = [l for l in text.splitlines() if l.strip().startswith('|') and '|' in l]
# filter out header separator line
rows = [r for r in rows if not set(r.strip()) <= set('|- :')]
print('total_rows_in_table=', len(rows))
print('has_non_2_yes=', count_yes)
print('has_non_2_no=', count_no)
print('\nSample _2 IDs with ❌ (up to 40):')
for r in rows[:40]:
    parts = [c.strip() for c in r.split('|')]
    if len(parts) >= 3 and '❌' in parts[2]:
        print(parts[1])
