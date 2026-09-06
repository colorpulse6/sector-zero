"""Editable industrial world kit, Blender 4.4+, no external assets or add-ons.

Blender --background --factory-startup --python game/scripts/world-assets/render_world.py -- --sample
Blender --background --factory-startup --python game/scripts/world-assets/render_world.py
Then run verify_world.py with Pillow. All geometry/materials are original procedural work.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
DOCS = ROOT / 'docs/assets/graphics-rollout/world'
CATALOG = json.loads((Path(__file__).parent / 'catalog.json').read_text())
PARSER = argparse.ArgumentParser()
PARSER.add_argument('--sample', action='store_true')
PARSER.add_argument('--only', nargs='+')
PARSER.add_argument('--source-only', action='store_true')
ARGS = PARSER.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
SAMPLE_IDS = {'facade-purifier', 'purifier-pump', 'mine-extractor'}
RNG = random.Random(CATALOG['seed'])
COLLECTION = None
ASSET_OBJECTS = []
M = {}


def worn(name, low, high, metal=0.6, rough=0.78, scale=34):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    n, l = mat.node_tree.nodes, mat.node_tree.links
    b = n.get('Principled BSDF')
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = min(rough,.66) if metal>=.5 else rough
    tex = n.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = scale
    tex.inputs['Detail'].default_value = 5
    tex.inputs['Roughness'].default_value = 0.8
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.3
    # Keep steel tonal variation restrained; geometry carries scratches/rims.
    # Concrete and oxide retain broad aggregate variation, not every surface.
    ramp.color_ramp.elements[0].color = (*tuple(a*.75+c*.25 for a,c in zip(low,high)),1) if metal>=.5 else (*low,1)
    ramp.color_ramp.elements[1].position = 0.76
    ramp.color_ramp.elements[1].color = (*tuple(a*.45+c*.55 for a,c in zip(low,high)),1) if metal>=.5 else (*high,1)
    l.new(tex.outputs['Fac'], ramp.inputs[0])
    l.new(ramp.outputs[0], b.inputs['Base Color'])
    grain = n.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = 190
    grain.inputs['Detail'].default_value = 3
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .16 if metal>=.5 else .30
    bump.inputs['Distance'].default_value = .007 if metal>=.5 else .012
    l.new(grain.outputs['Fac'], bump.inputs['Height'])
    l.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def emission(name, color, power):
    mat = worn(name, color, color, 0.1, 0.5)
    b = mat.node_tree.nodes.get('Principled BSDF')
    b.inputs['Emission Color'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = power
    return mat


def materials():
    M.update({
        'steel': worn('Gouged gunmetal with embedded brown oxide', (.014,.017,.02), (.13,.14,.145)),
        'edge': worn('Exposed steel abrasion', (.052,.048,.04), (.25,.23,.19), .7, .72, 100),
        'rust': worn('Stippled dark oxide', (.025,.013,.007), (.16,.081,.035), .3, .92, 48),
        'dark': worn('Soot recess', (.004,.006,.009), (.019,.021,.025), .3, .92),
        'dust': worn('Ash dust over steel', (.046,.037,.026), (.20,.157,.1), .35, .91, 70),
        'concrete': worn('Fractured mineral aggregate', (.032,.029,.026), (.15,.135,.11), 0, .97, 22),
        'rubber': worn('Scuffed rubber', (.004,.005,.006), (.025,.029,.033), 0, .96),
        'cloth': worn('Worn insulated field canvas', (.023,.022,.018), (.088,.072,.05), 0, .98, 125),
        'glass': worn('Dark solar glass', (.006,.012,.018), (.035,.055,.066), .5, .39),
        'cyan': emission('Cyan instrument phosphor', (.005,.42,.52), 2.2),
        'amber': emission('Amber warning diode', (.75,.19,.025), 2),
    })


def mesh_obj(name, verts, faces, mat, bevel=0, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    COLLECTION.objects.link(obj)
    obj.data.materials.append(M[mat] if isinstance(mat, str) else mat)
    if bevel:
        b = obj.modifiers.new('Chamfered worked edges', 'BEVEL')
        b.width, b.segments = bevel, 2
    if smooth:
        for f in mesh.polygons:
            f.use_smooth = True
    ASSET_OBJECTS.append(obj)
    return obj


def box(name, loc, size, mat='steel', bevel=.012, rotation=None):
    x,y,z = [a / 2 for a in size]
    obj = mesh_obj(name, [(-x,-y,-z),(-x,-y,z),(-x,y,-z),(-x,y,z),(x,-y,-z),(x,-y,z),(x,y,-z),(x,y,z)],
                   [(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)], mat, bevel)
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def rod(name, a, b, radius=.03, mat='steel', vertices=12, bevel=.003):
    d = Vector(b) - Vector(a)
    verts = [(radius*math.cos(math.tau*i/vertices), radius*math.sin(math.tau*i/vertices), z)
             for z in [-d.length/2,d.length/2] for i in range(vertices)]
    faces = [(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
    faces += [tuple(range(vertices-1,-1,-1)),tuple(range(vertices,2*vertices))]
    obj = mesh_obj(name, verts, faces, mat, bevel)
    obj.location = (Vector(a)+Vector(b))/2
    obj.rotation_mode='QUATERNION'
    obj.rotation_quaternion = d.to_track_quat('Z','Y')
    return obj


def pipe(name, points, radius=.045, mat='steel'):
    data=bpy.data.curves.new(name,'CURVE')
    data.dimensions='3D'
    data.resolution_u=2
    data.bevel_depth=radius
    data.bevel_resolution=2
    spline=data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for v,p in zip(spline.bezier_points,points):
        v.co=p
        v.handle_left_type=v.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data)
    COLLECTION.objects.link(obj)
    obj.data.materials.append(M[mat])
    ASSET_OBJECTS.append(obj)
    return obj


def rivet(x,y,z,r=.018):
    rod('Hexagonal fastener', (x,y,z-.01),(x,y,z+.01),r,'edge',6,0)
    box('Fastener slot',(x,y,z+.012),(.02,.004,.002),'dark',0)


def plate(x,y,w,h,mat='steel',z=.06,bolts=True):
    box('Bolted overlapping plate',(x,y,z),(w,h,.075),mat,.015)
    # Machined rim and uneven exposed-steel scrapes carry wear at game scale.
    for side in [-1,1]:
        box('Inset machining seam',(x+side*(w/2-.023),y,z+.038),(.005,max(.025,h-.045),.003),'dark',0)
    for i in range(max(2,int((w+h)*3))):
        xx=x+RNG.uniform(-w*.44,w*.44)
        yy=y+(-1 if i%2 else 1)*(h/2-.016)
        box('Broken edge abrasion',(xx,yy,z+.04),(RNG.uniform(.013,.045),.006,.002),'edge',0)
    if bolts:
        for dx in [-w/2+.055,w/2-.055]:
            for dy in [-h/2+.055,h/2-.055]:
                rivet(x+dx,y+dy,z+.045)


def grille(x,y,w,h,z=.1,horizontal=True):
    box('Recessed ventilation cavity',(x,y,z),(w,h,.045),'dark',.006)
    count=max(3,int((h if horizontal else w)/.058))
    for i in range(count):
        p=(i+.5)/count-.5
        box('Thick worn vent louver',(x if horizontal else x+p*w,y+p*h if horizontal else y,z+.033),
            (w*.9,.019,.033) if horizontal else (.019,h*.9,.033),'edge',.003)


def tile_scars(count=130,z=.118):
    # Physical gouges and exposed-metal chips; their scale survives 256px sampling.
    for i in range(count):
        x,y=RNG.uniform(-.91,.91),RNG.uniform(-.91,.91)
        obj=box('Inset scar or chipped edge',(x,y,z),(RNG.uniform(.013,.073),RNG.uniform(.0015,.005),.001),
                'edge' if i%4 else 'rust',0)
        obj.rotation_euler.z=RNG.uniform(-.65,.65)


def flange(a,b,radius=.15,mat='edge'):
    rod('Flanged pipe coupling',a,b,radius,mat,16)


def wall_tile(kind, exterior=False):
    box('Continuous underlying bulkhead',(0,0,-.04),(2.08,2.08,.12),'dark',0)
    for x in [-.5,.5]:
        for y in [-.5,.5]:
            plate(x,y,.965,.965,'dust' if exterior else 'steel',z=.01)
    if kind=='solar':
        for x in [-.71,.71]:
            box('Bus duct casing',(x,0,.12),(.17,2.08,.16),'steel')
            for y in [-.7,-.35,0,.35,.7]:
                plate(x,y,.23,.085,'edge',.215,False)
        grille(0,-.47,.92,.55,.12)
        plate(0,.45,.95,.67,'dark',.12)
        for i in range(6):
            box('Accumulator heat sink',(-.34+i*.137,.44,.21),(.04,.49,.08),'steel',.008)
        box('Small energized status slit',(0,.85,.17),(.25,.024,.025),'cyan',0)
    elif kind=='farm':
        for x in [-.72,0,.72]:
            box('Greenhouse rib',(x,0,.13),(.085,2.08,.18),'edge',.01)
        for x in [-.36,.36]:
            plate(x,.22,.59,1.17,'dark',.12)
            for y in [-.14,.2,.54]:
                box('Dusty insulated greenhouse pane',(x,y,.175),(.48,.25,.04),'glass',.005)
                box('Pane retaining rib',(x,y-.15,.2),(.55,.025,.04),'edge',.003)
        grille(0,-.74,1.17,.21,.15)
        pipe('Irrigation service line',[(-.89,-1.03,.2),(-.89,.9,.2),(-.78,1.03,.2)],.025,'rust')
    elif kind=='purifier':
        for x,r in [(-.69,.11),(-.34,.065),(.68,.095)]:
            rod('Vertical pressure main',(x,-1.04,.21),(x,1.04,.21),r,'steel',20)
            for y in [-.72,.71]:
                flange((x,y-.048,.21),(x,y+.048,.21),r*1.44)
                for dx in [-r*.9,r*.9]:
                    rivet(x+dx,y,.21+r*1.5,.014)
        plate(.17,.27,.56,.78,'steel',.13)
        rod('Pressure gauge bezel',(.15,.37,.2),(.15,.37,.29),.168,'edge',24)
        rod('Pressure gauge glass',(.15,.37,.29),(.15,.37,.297),.13,'dark',24,0)
        for i in range(18):
            angle=-.6+i*math.tau/22
            xx=.15+math.cos(angle)*.107
            yy=.37+math.sin(angle)*.107
            box('Gauge dial graduation',(xx,yy,.299),(.011,.003,.002),'edge',0,rotation=(0,0,angle))
        box('Gauge needle',(.18,.4,.299),(.008,.14,.003),'cyan',0,rotation=(0,0,-.6))
        grille(.15,-.5,.6,.34,.13)
        box('Small fault diode',(.27,-.05,.21),(.025,.045,.025),'amber',0)
    elif kind=='habitat':
        for x in [-.5,.5]:
            plate(x,-.38,.76,.76,'cloth',.095)
            for y in [-.53,-.18]:
                box('Quilted insulation strap',(x,y,.15),(.71,.025,.02),'steel',.003)
        plate(0,.56,1.46,.5,'dark',.14)
        for x in [-.39,.39]:
            box('Narrow habitat window',(x,.56,.2),(.59,.30,.045),'glass',.006)
        for x in [-.9,.9]:
            box('Load bearing corner rib',(x,0,.12),(.10,2.08,.12),'edge',.006)
        box('Habitat wall lamp housing',(0,.0,.22),(.34,.12,.13),'dark')
        box('Habitat warm practical',(0,-.017,.292),(.24,.026,.02),'amber',0)
    elif kind=='station':
        plate(0,0,1.39,1.51,'dark',.1)
        for y in [-.56,0,.56]:
            plate(0,y,1.21,.45,'steel',.15)
        for x in [-.87,.87]:
            box('Structural armored beam',(x,0,.18),(.15,2.1,.28),'edge',.01)
        grille(0,-.59,.92,.22,.21)
        box('Cold emergency lumen',(0,.68,.205),(.35,.026,.018),'cyan',0)
        for x in [-.62,.62]:
            pipe('External data conduit',[(x,-1.05,.20),(x,-.5,.20),(x*.82,0,.20),(x,.5,.20),(x,1.05,.20)],.025,'rust')
    elif kind in ['mine','ruin']:
        rock_panel(kind)
    tile_scars(135,z=.11)


def rock_panel(kind):
    # Individual jagged aggregate plates with real relief, backed by exposed girders.
    for ix in range(5):
        for iy in range(5):
            x,y=-.8+ix*.4,-.8+iy*.4
            z=RNG.uniform(.09,.18)
            pts=[(x+dx*.188+RNG.uniform(-.028,.028),y+dy*.187+RNG.uniform(-.025,.025),z+RNG.uniform(-.035,.035))
                 for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
            mesh_obj('Fractured exposed aggregate',pts,[(0,1,2,3)],'concrete',0)
    for x in [-.87,.87]:
        box('Scarred reinforcement column',(x,0,.17),(.12,2.12,.14),'rust',.014)
        for y in [-.76,-.2,.38,.84]:
            plate(x,y,.19,.13,'steel',.265)
    if kind=='ruin':
        for y in [-.67,.67]:
            box('Exposed cross reinforcement',(0,y,.145),(2.08,.04,.06),'rust',.005)
        pipe('Broken hanging cable',[(-.65,.95,.18),(-.55,.5,.21),(-.22,.18,.26),(.23,.32,.21)],.02,'rubber')
    else:
        box('Bolted mine lintel',(0,.86,.2),(2.08,.12,.14),'steel')
        box('Dust covered worklight',(0,.84,.283),(.30,.023,.018),'amber',0)


def floor_tile(kind):
    box('Underlying dark substrate',(0,0,-.05),(2.1,2.1,.13),'dark',0)
    material='concrete' if kind in ['mine','ruin','foundation'] else ('rubber' if kind=='habitat' else 'steel')
    for x in [-.5,.5]:
        for y in [-.5,.5]:
            plate(x,y,.97,.97,material,.015,kind!='ruin')
    if kind in ['mine','ruin','foundation']:
        for i in range(18):
            x,y=RNG.uniform(-.86,.86),RNG.uniform(-.86,.86)
            points=[(x,y,.058),(x+.08,y+.05,.06),(x+.13,y-.02,.06),(x+.2,y+.07,.06)]
            pipe('Hairline fracture',points,.003,'dark')
        if kind=='mine':
            for x in [-.64,.64]:
                box('Embedded haulage rail',(x,0,.09),(.075,2.12,.09),'edge',.006)
        if kind=='foundation':
            for x in [-.75,.75]:
                for y in [-.75,.75]:
                    plate(x,y,.22,.22,'steel',.07)
    elif kind=='habitat':
        for i in range(23):
            box('Worn rubber anti slip rib',(0,-.94+i*.085,.065),(1.90,.016,.018),'dust',.003)
    elif kind=='farm':
        for x in [-.75,.75]:
            grille(x,0,.2,2.08,.08)
        for i in range(45):
            x,y=RNG.uniform(-.57,.57),RNG.uniform(-.95,.95)
            box('Embedded soil stain',(x,y,.057),(RNG.uniform(.015,.07),RNG.uniform(.006,.03),.001),'dust',0)
    elif kind=='purifier':
        grille(0,0,.36,2.08,.08)
        for x in [-.74,.74]:
            box('Drainage trough rim',(x,0,.067),(.025,2.08,.035),'edge',.003)
    elif kind=='solar':
        for y in [-.67,.67]:
            box('Service cable tray',(0,y,.082),(2.08,.15,.09),'dark')
            for i in range(22):
                box('Tray cross grating',(-.97+i*.092,y,.14),(.032,.15,.025),'edge',.003)
    elif kind=='landing-pad':
        for x in [-.65,.65]:
            box('Scuffed landing alignment rail',(x,0,.064),(.12,2.1,.012),'dust',.002)
        for y in [-.71,.71]:
            for x in [-.8,.8]:
                plate(x,y,.22,.10,'dark',.1,False)
                box('Recessed pad guide lamp',(x,y,.16),(.1,.026,.014),'cyan',0)
    else:
        # Alternating raised chevrons, laid out in a repeatable plate field.
        for ix in range(12):
            for iy in range(12):
                x,y=-.91+ix*.164,-.91+iy*.164
                box('Raised anti slip diamond',(x,y,.066),(.073,.014,.014),'edge',.003,rotation=(0,0,.62 if (ix+iy)%2 else -.62))
    tile_scars(100,.068)


def ceiling_tile(kind):
    box('Opaque ceiling substrate',(0,0,-.05),(2.1,2.1,.13),'dark',0)
    for x in [-.5,.5]:
        for y in [-.5,.5]:
            plate(x,y,.95,.95,'concrete' if kind=='ruin' else 'steel',.01)
    for x in [-.84,.84]:
        box('Ceiling structural joist',(x,0,.13),(.14,2.1,.22),'edge')
    grille(0,0,.64,1.30,.12)
    for x in [-.55,.55]:
        rod('Ceiling conduit',(x,-1.06,.13),(x,1.06,.13),.035,'rust')
    if kind=='ruin':
        pipe('Severed dangling feed',[(-.77,.8,.18),(-.6,.27,.32),(-.44,-.1,.22)],.023,'rubber')
    else:
        for y in [-.81,.81]:
            box('Protected ceiling light',(0,y,.16),(.44,.07,.075),'dark')
            box('Ceiling practical lumen',(0,y,.204),(.35,.025,.018),'cyan' if kind=='station' else 'amber',0)
    tile_scars(85,.065)


def prop_chips(center,size,count=60):
    cx,cy,cz=center
    sx,sy,sz=size
    for i in range(count):
        x=cx+RNG.uniform(-sx*.44,sx*.44)
        z=cz+RNG.uniform(-sz*.43,sz*.43)
        ob=box('Front face gouge',(x,cy-sy/2-.006,z),(RNG.uniform(.009,.047),.0015,RNG.uniform(.002,.005)),
               'edge' if i%3 else 'rust',0)
        ob.rotation_euler.y=RNG.uniform(-.55,.55)


def front_bolts(center,size):
    x,y,z=center
    w,d,h=size
    for dx in [-w/2+.045,w/2-.045]:
        for dz in [-h/2+.045,h/2-.045]:
            rod('Front hex bolt',(x+dx,y-d/2-.006,z+dz),(x+dx,y-d/2-.023,z+dz),.018,'edge',6,0)


def casing(name,center,size,mat='steel'):
    box(name,center,size,mat,.025)
    front_bolts(center,size)
    prop_chips(center,size,38)


def feet(w,d):
    for x in [-w/2,w/2]:
        for y in [-d/2,d/2]:
            box('Anchoring foot',(x,y,.075),(.24,.24,.15),'steel',.018)
            box('Worn foot leading edge',(x,y-.115,.095),(.2,.025,.04),'edge',.002)


def screen(x,y,z,w=.27,h=.19):
    box('Instrument screen surround',(x,y,z),(w+.06,.08,h+.06),'edge',.01)
    box('Dark instrument screen',(x,y-.047,z),(w,.018,h),'dark',.005)
    for i in range(5):
        box('Small readable status trace',(x-w*.15,y-.057,z+h*.30-i*h*.14),(w*(.42+(i%2)*.25),.002,.003),'cyan',0)


def pump():
    feet(1.12,.65)
    casing('Heavy pump skid',(0,0,.21),(1.45,1.02,.25),'rust')
    for x in [-.36,.36]:
        rod('Industrial pressure vessel',(x,.16,.34),(x,.16,1.46),.27,'steel',24,.014)
        for z in [.4,1.34]:
            flange((x,.16,z-.035),(x,.16,z+.035),.30)
        for z in [.72,1.1]:
            box('Vessel mounting strap',(x,-.095,z),(.56,.04,.08),'edge',.008)
        rod('Vessel top neck',(x,.16,1.43),(x,.16,1.61),.09,'rust',16)
    casing('Pump motor gearbox',(-.2,-.21,.54),(.65,.60,.38))
    for i in range(7):
        box('Motor cooling fin',(-.46+i*.085,-.21,.73),(.027,.51,.07),'edge',.004)
    pipe('Pressure crossover',[(-.36,.16,1.63),(-.36,-.01,1.83),(.36,-.01,1.83),(.36,.16,1.63)],.074)
    pipe('Heavy outlet hose',[(.36,-.15,.72),(.69,-.25,.58),(.69,-.46,.34),(.4,-.55,.29)],.072,'rubber')
    rod('Gauge bezel',(.05,-.18,1.35),(.05,-.29,1.35),.145,'edge',24)
    rod('Dark gauge',(.05,-.292,1.35),(.05,-.3,1.35),.114,'dark',24,0)
    box('Gauge pointer',(.078,-.307,1.39),(.012,.005,.13),'cyan',0,rotation=(0,.6,0))
    screen(.49,-.14,1.13,.18,.14)


def auger_flight():
    # A continuous helical steel cutting flight, rather than stacked rings.
    verts=[]
    steps=192
    for i in range(steps+1):
        phase=i/steps
        angle=phase*math.tau*6.4
        z=.44+phase*1.14
        for radius,dz in [(.13,-.018),(.23,-.018),(.13,.018),(.23,.018)]:
            verts.append((math.cos(angle)*radius,-.08+math.sin(angle)*radius,z+dz))
    faces=[]
    for i in range(steps):
        a=i*4;b=a+4
        faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a+1,b+1,b+3,a+3)])
    mesh_obj('Continuous helical excavation flight',verts,faces,'edge',.003)
    tip=[(0,-.08,.30)]+[(math.cos(math.tau*i/12)*.134,-.08+math.sin(math.tau*i/12)*.134,.46) for i in range(12)]
    mesh_obj('Faceted diamond drill nose',tip,[(0,(i+1)%12+1,i+1) for i in range(12)],'steel',.002)


def extractor():
    feet(1.45,.72)
    casing('Anchored extractor chassis',(0,0,.24),(1.76,1.13,.28),'rust')
    for x in [-.64,.64]:
        casing('Heavy stabilizer',(x,.06,.59),(.27,.85,.63))
        rod('Exposed hydraulic piston',(x,-.16,.85),(x,-.16,1.89),.069,'edge',16)
        rod('Hydraulic sleeve',(x,-.16,.62),(x,-.16,1.16),.115,'steel',16)
    casing('Drill gantry crosshead',(0,.04,1.78),(1.66,.54,.32))
    casing('Drill feed motor',(0,.1,2.07),(.64,.64,.36))
    for i in range(8):
        box('Feed motor heat fin',(-.27+i*.077,.1,2.26),(.026,.52,.07),'edge',.003)
    rod('Diamond extraction auger',(0,-.08,.4),(0,-.08,1.67),.135,'steel',20)
    auger_flight()
    pipe('Oil return line',[(-.74,.19,.5),(-.83,.19,1.3),(-.49,.19,1.77),(-.29,.19,2.09)],.037,'rubber')
    pipe('Armored drill power cable',[(.34,.3,2.10),(.86,.38,1.56),(.85,.25,.38)],.064,'rubber')
    casing('Operator control box',(.55,-.36,.94),(.43,.27,.36))
    screen(.55,-.52,.97,.28,.19)
    box('Tiny extraction warning lamp',(-.5,-.246,1.84),(.15,.03,.025),'amber',0)


def prop(kind):
    if kind=='purifier-pump':
        pump()
    elif kind=='mine-extractor':
        extractor()
    elif kind=='farm-crate':
        feet(1.17,.62)
        casing('Hydroponic supply chest',(0,0,.59),(1.46,.98,.95),'dust')
        for x in [-.6,.6]:
            box('External container rib',(x,-.48,.61),(.12,.09,1.02),'steel')
            box('Container lid band',(x,0,1.08),(.13,1.03,.10),'steel')
        casing('Raised service hatch',(0,-.51,.66),(.73,.075,.39),'steel')
        for x in [-.19,.19]:
            box('Cargo latch',(x,-.575,.73),(.067,.04,.14),'edge',.006)
        for y in [-.2,.15]:
            box('Worn equipment stacked on lid',(.13,y,1.17),(.67,.26,.16),'cloth')
        pipe('Coiled irrigation hose',[(-.45,.32,1.10),(-.65,.05,1.19),(-.32,-.11,1.28),(.02,.06,1.19),(-.1,.28,1.10)],.046,'rubber')
    elif kind=='solar-panel':
        feet(1.10,.53)
        box('Solar control pedestal',(0,.08,.66),(.39,.42,1.25),'steel',.024)
        casing('Heavy solar regulator',(0,0,1.36),(1.3,.53,.85))
        screen(-.24,-.31,1.54,.48,.26)
        for i in range(5):
            box('Regulator vent',(0.31,-.277,1.1+i*.07),(.30,.025,.019),'dark',0)
        for x in [-.44,-.26,-.08]:
            rod('Mechanical isolator knob',(x,-.25,1.2),(x,-.34,1.2),.035,'edge',12)
        pipe('Heavy incoming cable',[(-.46,.20,1.03),(-.5,.26,.64),(-.39,.28,.25)],.054,'rubber')
        box('Dark solar cell auxiliary panel',(.48,.23,.87),(.63,.07,1.18),'glass',.006,rotation=(0,.23,0))
    elif kind=='bunk':
        feet(1.7,.65)
        for x in [-.8,.8]:
            for y in [-.31,.31]:
                rod('Bunk structural upright',(x,y,.11),(x,y,1.73),.048,'steel',10)
        for z in [.38,1.24]:
            casing('Stacked bunk tray',(0,0,z),(1.8,.9,.15),'steel')
            box('Heavy worn bunk mattress',(0,0,z+.12),(1.67,.82,.16),'cloth',.065)
            box('Rolled sleeping cover',(.1,-.05,z+.22),(.81,.75,.06),'dust',.027)
            box('Canvas pillow',(-.59,0,z+.25),(.35,.71,.12),'cloth',.08)
            rod('Bunk safety rail',(-.78,.36,z+.38),(.62,.36,z+.38),.029,'edge')
        for z in [.33,.65,.95,1.27]:
            rod('Ladder rung',(.58,-.43,z),(.86,-.43,z),.026,'edge')
    elif kind=='scaffolding':
        feet(1.54,.83)
        for x in [-.7,.7]:
            for y in [-.37,.37]:
                rod('Scaffold upright',(x,y,.12),(x,y,2.1),.044,'steel')
                for z in [.3,1.1,1.96]:
                    flange((x,y,z-.035),(x,y,z+.035),.063,'rust')
        for z in [.37,1.14,1.89]:
            box('Worn scaffold deck',(0,0,z),(1.63,.98,.10),'dust',.01)
            for x in [-.59,-.28,.03,.34,.65]:
                box('Deck seam',(x,0,z+.051),(.015,.97,.004),'dark',0)
        for y in [-.37,.37]:
            rod('Diagonal steel bracing',(-.7,y,.42),(.7,y,1.83),.025,'rust')
            rod('Diagonal steel bracing',(.7,y,.42),(-.7,y,1.83),.025,'rust')
        for z in [.25,.56,.87,1.18,1.49,1.80]:
            rod('Access ladder rung',(.7,-.38,z),(.7,.38,z),.024,'edge')
    elif kind=='station-console':
        feet(1.0,.7)
        casing('Armored console lower cabinet',(0,.07,.56),(1.21,.90,.86),'steel')
        casing('Canted control desk',(0,-.04,1.03),(1.39,1.01,.22),'edge')
        casing('Recessed operator display',(0,.22,1.43),(1.30,.27,.64),'steel')
        screen(-.22,.055,1.45,.65,.36)
        screen(.44,.055,1.46,.20,.27)
        for i in range(6):
            box('Console cooling louver',(0,-.39,.37+i*.052),(.69,.025,.018),'dark',0)
        for i in range(5):
            box('Raised physical controls',(-.45+i*.20,-.28,1.17),(.08,.12,.04),'dark',.005)
        pipe('Heavy trailing data loom',[(-.54,.44,1.31),(-.69,.42,.80),(-.54,.46,.15)],.06,'rubber')
    elif kind=='ruin-column':
        casing('Fractured column foot',(0,0,.17),(1.04,.95,.33),'concrete')
        for i in range(5):
            obj=box('Broken column stone',(RNG.uniform(-.04,.04),RNG.uniform(-.025,.025),.42+i*.30),
                    (.73+RNG.random()*.07,.63+RNG.random()*.04,.285),'concrete',.037)
            obj.rotation_euler.z=RNG.uniform(-.06,.06)
        for x in [-.28,.28]:
            rod('Exposed corroded rebar',(x,.13,.3),(x+.07,.13,2.02-RNG.random()*.13),.025,'rust')
        pipe('Hanging dead utility cable',[(.26,-.1,1.7),(.48,-.2,1.26),(.41,-.34,.87)],.025,'rubber')
        for x,y,s in [(-.53,-.17,.20),(.45,-.33,.28),(.30,.25,.21)]:
            box('Fallen mineral chunk',(x,y,s*.42),(s,s*.78,s*.7),'concrete',.023,rotation=(0,.12,.3))
    elif kind=='supply-canisters':
        casing('Supply tray',(0,0,.10),(1.29,.92,.2),'rust')
        for x,y,z,r in [(-.35,.07,1.06,.235),(.23,.18,1.30,.22),(.36,-.22,.73,.19)]:
            rod('Pressure supply canister',(x,y,.17),(x,y,z),r,'steel',24,.018)
            for h in [.26,z-.11]:
                flange((x,y,h-.025),(x,y,h+.025),r*1.08,'edge')
            rod('Protected valve neck',(x,y,z),(x,y,z+.14),.058,'rust')
            rod('Valve handle',(x-.10,y,z+.12),(x+.1,y,z+.12),.019,'edge')
            box('Tiny canister status diode',(x,y-r-.008,z*.65),(.027,.014,.05),'cyan' if z>1 else 'amber',0)


def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def setup():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    s=bpy.context.scene
    s.render.engine='CYCLES'
    s.cycles.device='CPU'
    s.cycles.samples=24
    s.cycles.use_denoising=True
    s.cycles.seed=CATALOG['seed']
    s.render.resolution_x=s.render.resolution_y=512
    s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG'
    s.render.image_settings.color_mode='RGBA'
    s.render.image_settings.color_depth='8'
    s.render.threads_mode='FIXED';s.render.threads=5
    bpy.context.preferences.filepaths.save_version=0
    s.view_settings.view_transform='AgX'
    s.view_settings.look='AgX - Medium High Contrast'
    s.world.use_nodes=True
    s.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.15,.19,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.22
    for name,loc,power,color,size in [
        ('Warm industrial key',(-3,-4,6),650,(1,.76,.55),4),
        ('Cold edge fill',(3,1,4),430,(.56,.73,1),3),
        ('Small frontal readability light',(0,-4,2),110,(.80,.85,1),3),
    ]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(name,data);s.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,.8))
    data=bpy.data.cameras.new('Orthographic world asset camera')
    cam=bpy.data.objects.new('Orthographic world asset camera',data);s.collection.objects.link(cam)
    data.type='ORTHO';s.camera=cam
    materials()
    return s,cam


def main():
    global COLLECTION,ASSET_OBJECTS,RNG
    DOCS.mkdir(parents=True,exist_ok=True)
    (DOCS/'renders').mkdir(exist_ok=True)
    scene,camera=setup()
    selected=[a for a in CATALOG['assets'] if (not ARGS.sample or a['id'] in SAMPLE_IDS) and (not ARGS.only or a['id'] in ARGS.only)]
    built=[]
    for a in selected:
        RNG=random.Random(CATALOG['seed']+sum((i+1)*ord(c) for i,c in enumerate(a['builder'])))
        COLLECTION=bpy.data.collections.new(a['id'])
        scene.collection.children.link(COLLECTION)
        ASSET_OBJECTS=[]
        if a['kind']=='prop':
            prop(a['builder'])
            camera.location=(3.7,-8,3.4)
            bpy.context.view_layer.update()
            coords=[ob.matrix_world@Vector(c) for ob in ASSET_OBJECTS for c in ob.bound_box]
            lo=Vector([min(v[i] for v in coords) for i in range(3)])
            hi=Vector([max(v[i] for v in coords) for i in range(3)])
            target=(lo+hi)/2
            aim(camera,target)
            # Fit in camera space, then center. Sources preserve native transparent margins.
            inv=camera.matrix_world.inverted()
            bpy.context.view_layer.update();inv=camera.matrix_world.inverted()
            camcoords=[inv@v for v in coords]
            dx=max(v.x for v in camcoords)-min(v.x for v in camcoords)
            dy=max(v.y for v in camcoords)-min(v.y for v in camcoords)
            camera.data.ortho_scale=max(dx,dy)*1.10
            scene.render.film_transparent=True
            scene.render.resolution_x=scene.render.resolution_y=1024
        else:
            name=a['builder']
            if name.endswith('-wall'):
                wall_tile(name.removesuffix('-wall'),a['id'].startswith('facade-'))
            elif name.endswith('-ceiling'):
                ceiling_tile(name.removesuffix('-ceiling'))
            else:
                floor_tile(name.removesuffix('-floor'))
            camera.location=(0,0,5)
            camera.rotation_euler=(0,0,0)
            camera.data.ortho_scale=2
            scene.render.film_transparent=False
            scene.render.resolution_x=scene.render.resolution_y=512
        scene.render.filepath=str(DOCS/'renders'/f"{a['id']}.png")
        COLLECTION['camera_location']=list(camera.location)
        COLLECTION['camera_rotation_euler']=list(camera.rotation_euler)
        COLLECTION['camera_ortho_scale']=camera.data.ortho_scale
        COLLECTION['source_resolution']=scene.render.resolution_x
        COLLECTION['runtime_path']='/sprites/'+a['path']
        if not ARGS.source_only:
            print('RENDER_ASSET',a['id'],scene.render.filepath,flush=True)
            bpy.ops.render.render(write_still=True)
        built.append({'id':a['id'],'objects':len(ASSET_OBJECTS),'builder':a['builder']})
        COLLECTION.hide_render=True
        COLLECTION.hide_viewport=True
    if built:
        last=bpy.data.collections.get(built[-1]['id'])
        last.hide_render=False;last.hide_viewport=False
    scene['readme']='World kit: one collection per editable asset. Toggle collection render visibility; rerun render_world.py for exact per-asset camera setup. Original procedural geometry and materials; no vendor dependencies.'
    scene['seed']=CATALOG['seed']
    bpy.ops.wm.save_as_mainfile(filepath=str(DOCS/('world-kit-samples.blend' if ARGS.sample else 'world-kit.blend')),compress=True)
    (DOCS/('sample-build.json' if ARGS.sample else 'source-build.json')).write_text(json.dumps({'blender':bpy.app.version_string,'seed':CATALOG['seed'],'assets':built},indent=2)+'\n')


if __name__=='__main__':
    main()
