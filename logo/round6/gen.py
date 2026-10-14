def M_path(x,y,s=1.0):
    P=[(0,210),(0,0),(62,0),(115,86),(168,0),(230,0),(230,210),(176,210),(176,96),(132,166),(98,166),(54,96),(54,210)]
    return "M"+"L".join(f"{x+px*s:.1f} {y+py*s:.1f}" for px,py in P)+"Z"

def icon(name, bg1,bg2, head1,head2, m1,m2, tabs, ring, mx=86, my=276, ms=0.6, mrot=-6, lines="#D9C9B0", shadow="#6B3A2A"):
    m=M_path(0,0)
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<title>Mon Inkdays</title>
<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient>
 <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{head1}"/><stop offset="1" stop-color="{head2}"/></linearGradient>
 <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFF4E2"/></linearGradient>
 <linearGradient id="ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{ring[0]}"/><stop offset=".5" stop-color="{ring[1]}"/><stop offset="1" stop-color="{ring[2]}"/></linearGradient>
 <linearGradient id="mf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{m1}"/><stop offset="1" stop-color="{m2}"/></linearGradient>
 <clipPath id="page"><rect x="100" y="104" width="288" height="290" rx="30"/></clipPath>
 <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="{shadow}" flood-opacity=".3"/></filter>
</defs>
<rect width="512" height="512" rx="114" fill="url(#bg)"/>
<g transform="translate(18 -4) rotate(-5 256 270)">
 <g filter="url(#sh)">
  <rect x="112" y="128" width="288" height="306" rx="30" fill="{tabs[2]}"/>
  <rect x="108" y="120" width="288" height="300" rx="30" fill="{tabs[1]}"/>
  <rect x="104" y="112" width="288" height="294" rx="30" fill="{tabs[0]}"/>
  <rect x="100" y="104" width="288" height="290" rx="30" fill="url(#paper)"/>
 </g>
 <!-- chữ M in lên trang: phần ra ngoài mép giấy bị cắt -->
 <g clip-path="url(#page)">
  <g transform="translate({mx} {my}) rotate({mrot}) scale({ms})">
   <path d="{m}" fill="url(#mf)" stroke="url(#mf)" stroke-width="10" stroke-linejoin="round"/>
  </g>
 </g>
 <path d="M130 104H358A30 30 0 0 1 388 134V170H100V134A30 30 0 0 1 130 104Z" fill="url(#top)"/>
 <rect x="100" y="104" width="288" height="30" rx="30" fill="#fff" opacity=".15"/>
 <g stroke="{lines}" stroke-width="9" stroke-linecap="round"><path d="M146 210H344"/><path d="M146 240H344"/><path d="M260 284H344"/><path d="M260 316H330"/></g>
 <g fill="url(#ring)">
  <rect x="150" y="80" width="16" height="56" rx="8"/><rect x="204" y="80" width="16" height="56" rx="8"/>
  <rect x="258" y="80" width="16" height="56" rx="8"/><rect x="312" y="80" width="16" height="56" rx="8"/>
 </g>
</g>
</svg>'''
    open(name,'w').write(svg)

TAGS=("#F9D3DF","#C9A48C","#CDEFD5")
GOLD=("#C6A15B","#FFF0C2","#A47E3B")
icon('a-print.svg',"#FFF3E6","#FFD9C7","#4A54C9","#2E347F","#FF6B5E","#D7263D",TAGS,GOLD)
icon('b-print-navy.svg',"#FFF3E6","#FFD9C7","#4A54C9","#2E347F","#5B66E0","#2E347F",TAGS,GOLD)
