"""
Codemod: pindahkan prop CSS yang no-op pada <Stack> MUI ke dalam sx.

Latar: MUI Stack hanya mengenali direction/spacing/divider/useFlexGap.
Prop seperti flexWrap, gap, alignItems, justifyContent, flex, flexGrow
diteruskan ke DOM sebagai atribut tak valid (no-op CSS).

Pemakaian (satu file per invokasi):
  python3 tools/codemod_stack_sx.py src/components/Foo.jsx          # terapkan
  python3 tools/codemod_stack_sx.py src/components/Foo.jsx --dry    # pratinjau
"""
import re
import sys

INVALID = {'alignItems', 'justifyContent', 'flexWrap', 'gap', 'flex', 'flexDirection', 'flexGrow'}


def scan_tag_end(src, start):
    """Kembalikan indeks '>' penutup opening tag <Stack ...> (sadar brace & string)."""
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


def parse_value(src, j):
    while src[j] in ' \n\t':
        j += 1
    c = src[j]
    if c == '"':
        k = src.find('"', j + 1)
        return src[j + 1:k], k + 1
    if c == "'":
        k = src.find("'", j + 1)
        return src[j + 1:k], k + 1
    if c == '{':
        depth = 0
        k = j
        while k < len(src):
            if src[k] == '{':
                depth += 1
            elif src[k] == '}':
                depth -= 1
                if depth == 0:
                    return src[j + 1:k], k + 1
            k += 1
    raise ValueError(f'nilai JSX tak terurai di posisi {j}: {src[j:j + 40]!r}')


def fmt_val(v):
    v = v.strip()
    if re.fullmatch(r'-?[\d.]+', v):
        return v
    if v.startswith('{') or v.startswith('('):
        return v
    if v.startswith('"') and v.endswith('"'):
        v = v[1:-1]
    return "'" + v.replace("'", "\\'") + "'"


def transform_file(src):
    changed = 0
    out = []
    i = 0
    while True:
        m = re.compile(r'<Stack\b').search(src, i)
        if not m:
            out.append(src[i:])
            break
        tag_start = m.start()
        gt = scan_tag_end(src, tag_start + len('<Stack') - 1)
        if gt == -1:
            out.append(src[i:])
            break
        tag = src[tag_start:gt]

        # Kumpulkan prop no-op di level atas tag
        invalids = []
        k = len('<Stack')
        depth = 0
        in_str = None
        while k < len(tag):
            c = tag[k]
            if in_str:
                if c == in_str and tag[k - 1] != '\\':
                    in_str = None
            elif c in '"\'`':
                in_str = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            elif depth == 0 and c in ' \n\t':
                mm = re.match(r'\s*(alignItems|justifyContent|flexWrap|gap|flex|flexDirection|flexGrow)\s*=', tag[k:])
                if mm and mm.group(1) in INVALID:
                    name = mm.group(1)
                    try:
                        val, vend = parse_value(tag, k + mm.end())
                        invalids.append((name, val, k, vend))
                    except ValueError:
                        pass
                    k = vend
                    continue
            k += 1

        if invalids:
            newtag = tag
            # Hapus prop (dari belakang agar indeks tetap valid)
            for name, val, s, e in reversed(invalids):
                s2 = s
                while s2 > 0 and newtag[s2 - 1] in ' \n\t':
                    s2 -= 1
                newtag = newtag[:s2] + newtag[e:]

            # Cek sx yang sudah ada agar tidak duplikat key
            sxm = re.search(r'sx=\{\{', newtag)
            existing_keys = set()
            if sxm:
                d = 0
                k = sxm.start() + 4
                while k < len(newtag):
                    if newtag[k] == '{':
                        d += 1
                    elif newtag[k] == '}':
                        d -= 1
                        if d == 0:
                            break
                    k += 1
                existing_keys = set(re.findall(r'(?:^|[,{\s])([a-zA-Z]+)\s*:', newtag[sxm.start() + 4:k]))

            css_entries = [f"{n}: {fmt_val(v)}" for n, v, _, _ in invalids if n not in existing_keys]
            if css_entries:
                if sxm:
                    ins = newtag[sxm.end():]
                    newtag = newtag[:sxm.end()] + ', '.join(css_entries) + (', ' if ins.strip() else '') + ins
                else:
                    newtag = newtag + ' sx={{ ' + ', '.join(css_entries) + ' }}'
            changed += 1
            out.append(src[i:tag_start])
            out.append(newtag)
            i = gt
        else:
            out.append(src[i:gt])
            i = gt
    return ''.join(out), changed


if __name__ == '__main__':
    path = sys.argv[1]
    src = open(path).read()
    new, n = transform_file(src)
    if '--dry' in sys.argv:
        print(f'[DRY] {path}: {n} tag akan diubah')
    else:
        open(path, 'w').write(new)
        print(f'[OK] {path}: {n} tag diubah')
