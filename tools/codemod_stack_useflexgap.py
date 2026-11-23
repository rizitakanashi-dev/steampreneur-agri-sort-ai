"""
Codemod: tambahkan prop useFlexGap pada <Stack> yang punya spacing= dan
sx flexWrap:'wrap'. Tanpa useFlexGap, MUI Stack memberi jarak hanya via
margin horizontal/vertikal satu sisi sehingga item yang wrap ke baris
baru menempel (tanpa rowGap) dengan baris sebelumnya.

Pemakaian (satu file per invokasi):
  python3 tools/codemod_stack_useflexgap.py src/components/Foo.jsx [--dry]
"""
import re
import sys


def scan_tag_end(src, start):
    """Indeks '>' penutup opening tag <Stack ...> (sadar brace & string)."""
    j = start
    depth = 0
    in_str = None
    while j < len(src):
        c = src[j]
        if in_str:
            if c == in_str and src[j - 1] != '\\':
                in_str = None
        elif c in '"\'`':
            in_str = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        elif c == '>' and depth == 0:
            return j
        j += 1
    return -1


def transform_file(src):
    out = []
    i = 0
    changed = 0
    tag_re = re.compile(r'<Stack\b')
    while True:
        m = tag_re.search(src, i)
        if not m:
            out.append(src[i:])
            break
        end = scan_tag_end(src, m.start())
        if end == -1:
            out.append(src[i:])
            break
        tag = src[m.start():end + 1]
        seg = tag
        has_spacing = re.search(r'\bspacing\s*=', seg)
        has_wrap = 'flexWrap' in seg
        has_flexgap = re.search(r'\buseFlexGap\b', seg)
        if has_spacing and has_wrap and not has_flexgap:
            # sisipkan useFlexGap sebelum '>' penutup tag
            new_tag = tag[:end - m.start()] + ' useFlexGap' + tag[end - m.start():]
            out.append(src[i:m.start()])
            out.append(new_tag)
            changed += 1
        else:
            out.append(src[i:end + 1])
        i = end + 1
    return ''.join(out), changed


if __name__ == '__main__':
    path = sys.argv[1]
    dry = '--dry' in sys.argv
    src = open(path, encoding='utf-8').read()
    new, n = transform_file(src)
    if dry:
        print(f'{path}: {n} tag akan diubah')
    elif n:
        open(path, 'w', encoding='utf-8').write(new)
        print(f'{path}: {n} tag diubah')
    else:
        print(f'{path}: tidak ada perubahan')
