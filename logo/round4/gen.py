import math, random
def f(x): return f"{x:.1f}".rstrip('0').rstrip('.')
def smooth(pts):
    # Catmull-Rom khép kín → Bézier
    n=len(pts); d=f"M{f(pts[0][0])} {f(pts[0][1])}"
    for i in range(n):
        p0,p1,p2,p3=pts[(i-1)%n],pts[i],pts[(i+1)%n],pts[(i+2)%n]
        c1=(p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6)
        c2=(p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6)
        d+=f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}"
    return d+"Z"
def splash(cx,cy):
    # Vết mực tạt mềm: thân tròn nhiều thùy + các nhánh thuôn có đầu tròn + vệt chảy
    rnd=random.Random(11)
    N=48; pts=[]
    for i in range(N):
        a=i*2*math.pi/N
        r=52+11*math.sin(5*a+0.9)+5*math.sin(9*a+2.1)
        pts.append((cx+r*math.cos(a), cy+r*math.sin(a)))
    body=smooth(pts)
    out=body
    # nhánh: (góc độ, dài, rộng gốc, bán kính đầu)
    for ang,L,w0,rt in [(205,34,28,13),(250,26,24,11),(160,24,22,10),(118,18,20,9),(300,16,20,8)]:
        a=math.radians(ang); ux,uy=math.cos(a),math.sin(a); px,py=-uy,ux
        bx,by=cx+44*ux,cy+44*uy; tx,ty=cx+(44+L)*ux,cy+(44+L)*uy
        w1=rt*0.9
        poly=[(bx+px*w0/2,by+py*w0/2),(tx+px*w1,ty+py*w1),(tx-px*w1,ty-py*w1),(bx-px*w0/2,by-py*w0/2)]
        out+="M"+"L".join(f"{f(x)} {f(y)}" for x,y in poly)+"Z"
        out+=f"M{f(tx-rt)} {f(ty)}a{rt} {rt} 0 1 0 {2*rt} 0a{rt} {rt} 0 1 0 {-2*rt} 0Z"
    # vệt chảy xuống qua mép sổ
    out+=f"M{f(cx-6)} {f(cy+40)}C{f(cx-8)} {f(cy+70)} {f(cx-2)} {f(cy+86)} {f(cx+6)} {f(cy+92)}C{f(cx+16)} {f(cy+100)} {f(cx+26)} {f(cy+88)} {f(cx+22)} {f(cy+72)}C{f(cx+20)} {f(cy+60)} {f(cx+20)} {f(cy+50)} {f(cx+22)} {f(cy+40)}Z"
    drops=[(cx-118,cy-34,9),(cx-84,cy-84,6),(cx+74,cy+52,6),(cx-104,cy+40,5),(cx-44,cy-112,4)]
    dd=''.join(f"M{f(x-r)} {f(y)}a{r} {r} 0 1 0 {2*r} 0a{r} {r} 0 1 0 {-2*r} 0Z" for x,y,r in drops)
    return out, dd

def icon(name, bg1, bg2, head1, head2, ink1, ink2, tabs, lines="#D9C9B0", ring=("#9AA3B5","#F4F6FA","#7C8597"), paper2="#FFF4E2"):
    body,dd=splash(136,372)
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<title>Mon Inkdays</title>
<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient>
 <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{head1}"/><stop offset="1" stop-color="{head2}"/></linearGradient>
 <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="{paper2}"/></linearGradient>
 <linearGradient id="ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{ring[0]}"/><stop offset=".5" stop-color="{ring[1]}"/><stop offset="1" stop-color="{ring[2]}"/></linearGradient>
 <radialGradient id="ink" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="{ink1}"/><stop offset="1" stop-color="{ink2}"/></radialGradient>
 <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#6B3A2A" flood-opacity=".28"/></filter>
 <filter id="ish" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="{ink2}" flood-opacity=".35"/></filter>
</defs>
<rect width="512" height="512" rx="114" fill="url(#bg)"/>
<g transform="translate(18 -4) rotate(-5 256 270)">
 <g filter="url(#sh)">
  <rect x="112" y="128" width="288" height="306" rx="30" fill="{tabs[2]}"/>
  <rect x="108" y="120" width="288" height="300" rx="30" fill="{tabs[1]}"/>
  <rect x="104" y="112" width="288" height="294" rx="30" fill="{tabs[0]}"/>
  <rect x="100" y="104" width="288" height="290" rx="30" fill="url(#paper)"/>
  <path d="M130 104H358A30 30 0 0 1 388 134V170H100V134A30 30 0 0 1 130 104Z" fill="url(#top)"/>
  <rect x="100" y="104" width="288" height="30" rx="30" fill="#fff" opacity=".15"/>
  <g stroke="{lines}" stroke-width="9" stroke-linecap="round"><path d="M146 214H344"/><path d="M146 252H344"/><path d="M196 290H344"/><path d="M226 328H316"/></g>
 </g>
 <g filter="url(#ish)">
  <path d="{body}" fill="url(#ink)"/>
  <path d="{dd}" fill="url(#ink)"/>
 </g>
 <ellipse cx="118" cy="350" rx="15" ry="8" fill="#fff" opacity=".45" transform="rotate(-35 118 350)"/>
 <circle cx="142" cy="340" r="4" fill="#fff" opacity=".5"/>
 <g fill="url(#ring)">
  <rect x="150" y="80" width="16" height="56" rx="8"/><rect x="204" y="80" width="16" height="56" rx="8"/>
  <rect x="258" y="80" width="16" height="56" rx="8"/><rect x="312" y="80" width="16" height="56" rx="8"/>
 </g>
</g>
</svg>'''
    open(name,'w').write(svg)

TAGS=("#F9D3DF","#C9A48C","#CDEFD5")
# 1: giữ đầu đỏ + mực xanh tím
icon('c1-red-indigo.svg',"#FFF6D6","#FFD3B6","#FF6F6A","#E0323F","#7A88FF","#23266B",TAGS)
# 2: đầu sổ xanh tím trùng màu mực, nền kem hồng
icon('c2-indigo.svg',"#FFF1F3","#FFD6DE","#7C86F5","#3D43B8","#6A78F7","#1E2160",TAGS,ring=("#C6A15B","#FFF0C2","#A47E3B"))
# 3: mực đen tím than, đầu sổ vàng mù tạt, nền xanh bạc hà
icon('c3-mustard.svg',"#EAFBF2","#BDEBD8","#FFD15C","#F2A93B","#4A4A7A","#141428",TAGS)
# 4: mực đỏ đô, đầu sổ xanh mòng két, nền kem
icon('c4-teal-wine.svg',"#FFF8EC","#FFE2C4","#4FC3B5","#21897F","#FF6F7E","#8E1530",TAGS)
