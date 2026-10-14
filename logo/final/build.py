# Dựng bộ file gốc cho icon Mon Inkdays (mẫu chốt: sổ lò xo + chữ M in lên trang)
BG1, BG2 = "#FFF3E6", "#FFD9C7"
HEAD1, HEAD2 = "#4A54C9", "#2E347F"
M1, M2 = "#FF6B5E", "#D7263D"
TAGS = ("#F9D3DF", "#C9A48C", "#CDEFD5")
RING = ("#C6A15B", "#FFF0C2", "#A47E3B")
LINES = "#D9C9B0"
MX, MY, MS, MROT = 110, 254, 0.6, 13

def M_path():
    P=[(0,210),(0,0),(62,0),(115,86),(168,0),(230,0),(230,210),(176,210),(176,96),(132,166),(98,166),(54,96),(54,210)]
    return "M"+"L".join(f"{x} {y}" for x,y in P)+"Z"
M = M_path()
MT = f"translate({MX} {MY}) rotate({MROT}) scale({MS})"
HEAD = "M130 104H358A30 30 0 0 1 388 134V170H100V134A30 30 0 0 1 130 104Z"
RINGS = ''.join(f'<rect x="{x}" y="80" width="16" height="56" rx="8"/>' for x in (150,204,258,312))
NB_T = "translate(18 -4) rotate(-5 256 270)"

DEFS = f'''<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{BG1}"/><stop offset="1" stop-color="{BG2}"/></linearGradient>
 <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{HEAD1}"/><stop offset="1" stop-color="{HEAD2}"/></linearGradient>
 <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFF4E2"/></linearGradient>
 <linearGradient id="ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{RING[0]}"/><stop offset=".5" stop-color="{RING[1]}"/><stop offset="1" stop-color="{RING[2]}"/></linearGradient>
 <linearGradient id="mf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{M1}"/><stop offset="1" stop-color="{M2}"/></linearGradient>
 <clipPath id="page"><rect x="100" y="104" width="288" height="290" rx="30"/></clipPath>
 <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#6B3A2A" flood-opacity=".3"/></filter>
</defs>'''

NOTEBOOK = f'''<g transform="{NB_T}">
 <g filter="url(#sh)">
  <rect x="112" y="128" width="288" height="306" rx="30" fill="{TAGS[2]}"/>
  <rect x="108" y="120" width="288" height="300" rx="30" fill="{TAGS[1]}"/>
  <rect x="104" y="112" width="288" height="294" rx="30" fill="{TAGS[0]}"/>
  <rect x="100" y="104" width="288" height="290" rx="30" fill="url(#paper)"/>
 </g>
 <g clip-path="url(#page)"><g transform="{MT}"><path d="{M}" fill="url(#mf)" stroke="url(#mf)" stroke-width="10" stroke-linejoin="round"/></g></g>
 <path d="{HEAD}" fill="url(#top)"/>
 <rect x="100" y="104" width="288" height="30" rx="30" fill="#fff" opacity=".15"/>
 <g stroke="{LINES}" stroke-width="9" stroke-linecap="round"><path d="M146 210H344"/><path d="M146 240H344"/><path d="M260 284H344"/><path d="M260 316H330"/></g>
 <g fill="url(#ring)">{RINGS}</g>
</g>'''

# Bóng in đơn sắc: hình cuốn sổ, chữ M và đầu sổ được khoét rỗng (cho themed icon Android 13+)
MONO = f'''<defs><mask id="mk"><rect width="512" height="512" fill="#fff"/>
 <g transform="{NB_T}"><g clip-path="url(#page2)"><g transform="{MT}"><path d="{M}" fill="#000" stroke="#000" stroke-width="10" stroke-linejoin="round"/></g></g>
 <rect x="100" y="164" width="288" height="12" fill="#000"/></g></mask>
 <clipPath id="page2"><rect x="100" y="104" width="288" height="290" rx="30"/></clipPath></defs>
<g mask="url(#mk)"><g transform="{NB_T}" fill="#000">
 <rect x="104" y="112" width="292" height="322" rx="30"/><rect x="100" y="104" width="288" height="290" rx="30"/>{RINGS}</g></g>'''

H = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
TILE = '<rect width="512" height="512" rx="114" fill="url(#bg)"/>'
# Nội dung cuốn sổ chiếm khoảng x100–450, y70–440: tâm thị giác ~ (275, 258)
CENTER = "translate(-280 -260)"
def fit(scale): return f"translate(256 256) scale({scale}) {CENTER}"

files = {
 'icon.svg':       f'{H}<title>Mon Inkdays</title>{DEFS}{TILE}{NOTEBOOK}</svg>',
 'round.svg':      f'{H}<title>Mon Inkdays</title>{DEFS}<circle cx="256" cy="256" r="256" fill="url(#bg)"/><g transform="{fit(0.8)}">{NOTEBOOK}</g></svg>',
 'background.svg': f'{H}{DEFS}<rect width="512" height="512" fill="url(#bg)"/></svg>',
 'foreground.svg': f'{H}{DEFS}<g transform="{fit(0.68)}">{NOTEBOOK}</g></svg>',
 'splash-mark.svg':f'{H}{DEFS}{TILE}{NOTEBOOK}</svg>',
}
# monochrome: bọc cả khối đã mask trong transform fit
files['monochrome.svg'] = f'{H}{MONO.split("<g mask")[0]}<g transform="{fit(0.68)}"><g mask{MONO.split("<g mask")[1]}</g></svg>'
for n, s in files.items(): open(n, 'w').write(s)
print('ok')
