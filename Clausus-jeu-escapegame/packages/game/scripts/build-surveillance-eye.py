"""Build the articulated surveillance eye and a software-rendered PNG of its real mesh.
Run from repository root: python3 packages/game/scripts/build-surveillance-eye.py
No dependencies for GLB generation; Pillow for the preview only.
"""
import json, math, struct
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / 'assets/props'
PALETTE = [('sclera', (0.76, 0.77, 0.65)), ('sclera_shadow', (0.65, 0.68, 0.57)),
           ('limbal_ring', (0.15, 0.19, 0.12)), ('iris_olive', (0.39, 0.43, 0.16)),
           ('iris_gold', (0.58, 0.51, 0.21)), ('iris_moss', (0.25, 0.34, 0.15)),
           ('pupil', (0.012, 0.017, 0.014)), ('lid', (0.33, 0.31, 0.24)),
           ('lid_edge', (0.48, 0.44, 0.34))]
triangles = []
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def norm(a):
 l=math.sqrt(dot(a,a)); return tuple(x/l for x in a) if l else (0,0,-1)
def tri(a,b,c,mat):
 n=norm(cross(sub(b,a),sub(c,a)))
 center=tuple((a[i]+b[i]+c[i])/3 for i in range(3))
 if dot(n,center)<0: b,c=c,b; n=tuple(-x for x in n)
 triangles.append((a,b,c,n,mat))
# An ellipsoid with concentric iris topology, rather than a flat eye decal.
# Polar axis points towards local -Z. The iris is part of the curved globe.
N=24
angles=[0,.12,.25,.34,.40,.48,.65,.85,1.1,1.35,1.6,1.9,2.2,2.5,2.8,math.pi]
rings=[]
for a in angles:
 rings.append([(0.14*math.sin(a)*math.cos(i*2*math.pi/N),
                0.12*math.sin(a)*math.sin(i*2*math.pi/N),
                -0.125*math.cos(a)) for i in range(N)])
for j in range(len(rings)-1):
 for i in range(N):
  ni=(i+1)%N
  mat=6 if j<2 else [3,4,5][i%3] if j<4 else 2 if j==4 else (1 if (i*7+j*3)%17==0 else 0)
  if j!=0: tri(rings[j][i],rings[j+1][i],rings[j][ni],mat)
  if j!=len(rings)-2: tri(rings[j][ni],rings[j+1][i],rings[j+1][ni],mat)
# Upper and lower angular lid rims: dark desaturated tissue, no blood or gore.
for upper in [1,-1]:
 strips=[]
 for scale,z in [(1.0,-.052),(1.09,-.038),(1.12,-.006)]:
  strips.append([(scale*.139*math.cos(i*math.pi/16), upper*scale*.124*math.sin(i*math.pi/16),z) for i in range(17)])
 for j in range(2):
  for i in range(16):
   tri(strips[j][i],strips[j+1][i],strips[j][i+1],8 if j==0 else 7)
   tri(strips[j][i+1],strips[j+1][i],strips[j+1][i+1],8 if j==0 else 7)
def export_mesh(faces, filename, node_name):
 global triangles
 saved = triangles
 triangles = faces
 # GLB, separate materials and flat per-face normals, no textures to filter.
 binary=bytearray(); views=[]; accessors=[]; primitives=[]
 def buf(values,kind,width):
  while len(binary)%4: binary.append(0)
  off=len(binary); flat=[v for row in values for v in row]
  binary.extend(struct.pack('<'+'f'*len(flat),*flat)); idx=len(views)
  views.append({'buffer':0,'byteOffset':off,'byteLength':len(binary)-off,'target':34962})
  ac={'bufferView':idx,'componentType':5126,'count':len(values),'type':kind}
  if kind=='VEC3': ac.update(min=[min(v[i] for v in values) for i in range(width)],max=[max(v[i] for v in values) for i in range(width)])
  accessors.append(ac); return len(accessors)-1
 for mat in range(len(PALETTE)):
  faces=[t for t in triangles if t[4]==mat]
  if not faces: continue
  positions=[p for t in faces for p in t[:3]]; normals=[t[3] for t in faces for _ in range(3)]
  primitives.append({'attributes':{'POSITION':buf(positions,'VEC3',3),'NORMAL':buf(normals,'VEC3',3)},'material':mat,'mode':4})
 j={'asset':{'version':'2.0','generator':'Clausus surveillance eye mesh source'},'scene':0,'scenes':[{'nodes':[0]}],
  'nodes':[{'name':node_name,'mesh':0}], 'meshes':[{'name':'faceted_eye','primitives':primitives}],
  'materials':[{'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[*c,1],'metallicFactor':0,'roughnessFactor':.8}} for name,c in PALETTE],
  'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors}
 jb=json.dumps(j,separators=(',',':')).encode(); jb+=b' '*((-len(jb))%4); binary+=b'\0'*((-len(binary))%4)
 OUT.mkdir(parents=True,exist_ok=True)
 (OUT/filename).write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(jb)+8+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary)
 triangles = saved

eye_triangles = triangles[:]
export_mesh(eye_triangles, 'camera_eye.glb', 'surveillance_eye')
# Fixed organic growth wraps around the two perpendicular walls. Coordinates are
# relative to camera_corner's root (ceiling corner), never camera_head's rotation.
PALETTE.extend([('corner_tissue', (.32,.34,.25)), ('corner_ridge', (.43,.45,.32))])
triangles = []
# A faceted V of tissue, joined at the corner and spreading over both walls.
# Each lobe is a tapered patch, not a mechanical plate or bracket.
for side in [-1,1]:
 for k in range(7):
  u0=k/7; u1=(k+1)/7
  def cross_section(u):
   x=side*(.008+.205*u); z=-abs(x)-.012
   bulge=math.sin(math.pi*u)**.7
   half=.165*(1-.72*u)
   return [(x,-.2+half,z), (x,-.2+half*.55,z-.018*bulge),
           (x,-.205,z-.045*bulge), (x,-.2-half*.55,z-.02*bulge), (x,-.2-half,z)]
  q,r=cross_section(u0),cross_section(u1)
  for j in range(4):
   tri(q[j],r[j],q[j+1],9 if (j+k)%3 else 10)
   tri(q[j+1],r[j],r[j+1],9 if (j+k)%3 else 10)
# Thick neck links the corner growth to the eye's back. Elliptical rings.
neck=[]
for z,rx,ry in [(-.025,.022,.09),(-.09,.052,.08),(-.17,.072,.075),(-.205,.092,.085)]:
 neck.append([(rx*math.cos(i*math.pi/6), -.2+ry*math.sin(i*math.pi/6),z) for i in range(12)])
for k in range(len(neck)-1):
 for i in range(12):
  q=(i+1)%12
  tri(neck[k][i],neck[k+1][i],neck[k][q],9)
  tri(neck[k][q],neck[k+1][i],neck[k+1][q],10 if i%4==0 else 9)
mount_triangles=triangles[:]
export_mesh(mount_triangles, 'camera_eye_mount.glb', 'eye_mount')
# Preview shows the delivered pair installed between two perpendicular walls.
triangles=[]
PALETTE.extend([('hospital_wall_left',(.37,.43,.39)),('hospital_wall_right',(.28,.34,.31)),('hospital_ceiling',(.48,.51,.44))])
# Wall planes meet behind the mount, along the vertical corner line.
for side,mat in [(-1,11),(1,12)]:
 a=(0,.02,.005); b=(side*.65,.02,-.65); c=(side*.65,-.72,-.65); e=(0,-.72,.005)
 tri(a,b,c,mat); tri(a,c,e,mat)
tri((0,.02,0),(-.65,.02,-.65),(.65,.02,-.65),13)
triangles+=mount_triangles
for a,b,c,n,mat in eye_triangles:
 triangles.append((tuple((p[0],p[1]-.2,p[2]-.275) for p in [a,b,c]))+(n,mat))
# Orthographic painter render of these exact triangles, front three-quarter camera.
W,H=1200,900; im=Image.new('RGB',(W,H),(17,22,21)); d=ImageDraw.Draw(im)
view=norm((.40,.12,-1)); right=norm(cross((0,1,0),view)); up=cross(view,right)
def project(p): return (W/2+dot(sub(p,(0,-.23,-.2)),right)*1500,H/2-dot(sub(p,(0,-.23,-.2)),up)*1500)
light=norm((-.5,.8,-1))
d.ellipse((265,700,945,790),fill=(12,16,15))
pixels=im.load(); depths=[-1e9]*(W*H)
for a,b,c,n,mat in triangles:
 shade=.38+.62*max(0,dot(n,light)); base=PALETTE[mat][1]
 color=tuple(round(min(255,255*v*shade)) for v in base)
 pa,pb,pc=[project(p) for p in [a,b,c]]
 den=(pb[1]-pc[1])*(pa[0]-pc[0])+(pc[0]-pb[0])*(pa[1]-pc[1])
 if abs(den)<1e-8: continue
 za,zb,zc=[dot(p,view) for p in [a,b,c]]
 for y in range(max(0,int(min(pa[1],pb[1],pc[1]))), min(H,int(max(pa[1],pb[1],pc[1]))+1)):
  for x in range(max(0,int(min(pa[0],pb[0],pc[0]))), min(W,int(max(pa[0],pb[0],pc[0]))+1)):
   u=((pb[1]-pc[1])*(x-pc[0])+(pc[0]-pb[0])*(y-pc[1]))/den
   v=((pc[1]-pa[1])*(x-pc[0])+(pa[0]-pc[0])*(y-pc[1]))/den
   w=1-u-v
   if min(u,v,w)<-1e-6: continue
   z=u*za+v*zb+w*zc; k=y*W+x
   if z>depths[k]: depths[k]=z; pixels[x,y]=color
d.rectangle((0,0,W,112),fill=(17,22,21))
d.rectangle((0,810,W,H),fill=(17,22,21))
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
d.text((58,45),'CLAUSUS  /  SURVEILLANCE',font=font,fill=(164,180,154))
d.text((58,77),'Œil d’angle — support organique fixe et globe mobile',font=small,fill=(104,120,111))
d.text((58,842),f'{len(eye_triangles)+len(mount_triangles)} triangles  ·  Deux murs à 90°  ·  Globe orientable',font=small,fill=(137,152,137))
preview = OUT.parents[1] / 'preview' / 'camera_eye.png'
preview.parent.mkdir(parents=True, exist_ok=True)
im.save(preview)
print(f'{len(triangles)} triangles; {OUT}/camera_eye.glb; {preview}')
