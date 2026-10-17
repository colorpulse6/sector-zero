"""Rebuild live FP actors in Blender 4.4.3; shared licensed humanoid base.

Blender --background --factory-startup --python game/scripts/actors/render_actors.py -- --sample --actors voss,reyes,hostile
Blender --background --factory-startup --python game/scripts/actors/render_actors.py
"""
import argparse
import hashlib
import importlib.util
import json
import math
import random
import sys
import tempfile
import time
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[3]
DOCS = ROOT / 'docs/assets/actor-motion'
OUTPUT = ROOT / 'game/public/sprites/actors'
FRAMES = Path(tempfile.gettempdir()) / 'sector-zero-actor-frames'
BASE = ROOT / 'docs/assets/quartermaster-motion/source/quartermaster-base.blend'
parser = argparse.ArgumentParser()
parser.add_argument('--actors', default='voss,kael,reyes,survivor,scavenger,hub-bartender,hub-regular,hub-signal-chaser,hostile')
parser.add_argument('--sample', action='store_true')
parser.add_argument('--source-only', action='store_true')
parser.add_argument('--clips', help='Render only these comma-separated clips, retaining prior clip receipts')
parser.add_argument('--engine', choices=['eevee', 'cycles'], default='cycles')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

# Reuse the pilot's authored mesh/rig helpers and anatomical IK solver. Its
# executable entry point is guarded; resetting argv avoids consuming our flags.
old_argv = sys.argv
sys.dont_write_bytecode = True
sys.argv = [sys.argv[0]]
spec = importlib.util.spec_from_file_location('quartermaster_geometry', ROOT / 'game/scripts/quartermaster/render_pilot.py')
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)
sys.argv = old_argv

PROFILES = {
    'voss': dict(role='Commander; navy long coat, optical implant, swept dark hair', cloth=(.018,.025,.044), trim=(.026,.03,.036), skin=(.35,.23,.15), hair='swept', hair_color=(.018,.014,.011), width=.97, height=1.03, coat=.28, face=(.507,.162,.073,.065)),
    'kael': dict(role='Science officer; pale laboratory coat, dark underlayers, tousled hair', cloth=(.31,.30,.25), trim=(.032,.045,.042), skin=(.38,.26,.17), hair='tousled', hair_color=(.075,.06,.038), width=.90, height=1.02, coat=.36, face=(.50,.155,.078,.050)),
    'reyes': dict(role='Pilot; orange pressure suit, dark harness, goggles, tied hair', cloth=(.23,.072,.012), trim=(.025,.029,.023), skin=(.30,.16,.075), hair='tied', hair_color=(.043,.025,.013), width=.85, height=.98, coat=0, face=(.515,.167,.077,.051)),
    'survivor': dict(role='Worn survivor; rolled shirt sleeves, damaged trousers, loose hair', cloth=(.105,.10,.078), trim=(.029,.035,.027), skin=(.30,.20,.12), hair='tousled', hair_color=(.04,.028,.014), width=.88, height=.98, coat=0, face=(.512,.176,.075,.05)),
    'scavenger': dict(role='Enclosed scavenger; hood, respirator, segmented grey armor', cloth=(.064,.073,.065), trim=(.026,.03,.024), skin=(.18,.13,.08), hair='hood', hair_color=(.02,.02,.016), width=1.00, height=.98, coat=.64, face=None),
    'hub-bartender': dict(role='Broad bartender; heat-scarred apron, rolled sleeves, prosthetic forearm', cloth=(.12,.085,.048), trim=(.042,.043,.034), skin=(.245,.13,.062), hair='cropped', hair_color=(.025,.017,.010), width=1.18, height=.97, coat=0, face=(.50,.134,.074,.048)),
    'hub-regular': dict(role='Older maintenance veteran; padded jacket and respiratory collar', cloth=(.065,.075,.055), trim=(.035,.04,.031), skin=(.31,.21,.12), hair='receding', hair_color=(.08,.075,.06), width=.95, height=.93, coat=0, face=(.50,.128,.067,.045)),
    'hub-signal-chaser': dict(role='Lean surveyor; short textured hair, asymmetric headset, antenna cloak', cloth=(.053,.06,.052), trim=(.025,.032,.028), skin=(.19,.095,.045), hair='textured', hair_color=(.012,.009,.007), width=.82, height=.99, coat=.36, face=(.52,.125,.062,.039)),
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for data in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.armatures, bpy.data.actions, bpy.data.images):
        for entry in list(data):
            if entry.users == 0:
                data.remove(entry)
    q.ACTOR = []


def mat(name, color, metal=0, roughness=.84):
    material=q.material(name, tuple(c*.23 for c in color), color, metal=metal, roughness=roughness, scale=18, bump=.40)
    nodes,links=material.node_tree.nodes,material.node_tree.links;shader=nodes.get('Principled BSDF')
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=9;noise.inputs['Detail'].default_value=5
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.27;bump.inputs['Distance'].default_value=.035
    links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(shader.inputs['Normal'].links[0].from_socket,bump.inputs['Normal']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
    return material


def add_front_projection(objects, materials, actor, face):
    reference = ROOT / f'game/public/sprites/boarding/npc-{actor}.png'
    upgraded=DOCS/'source'/(actor+'-front.png')
    hub_source=ROOT/f'docs/assets/source/m3-hubs/cantina/{actor}-billboard-source.png'
    is_hub=hub_source.exists()
    if is_hub:upgraded=hub_source
    if upgraded.exists():
        reference=upgraded
        face={'voss':(.5,.12,.082,.064),'reyes':(.499,.12,.092,.055),'kael':(.502,.139,.085,.058),'survivor':(.491,.125,.09,.070),'scavenger':None,'hub-bartender':(.496,.112,.092,.06),'hub-regular':(.487,.115,.098,.060),'hub-signal-chaser':(.434,.104,.082,.053)}[actor]
    im = bpy.data.images.load(str(reference), check_existing=True)
    for ob in objects:
        ob.data.uv_layers.new(name='Identity rest projection')
        mask = ob.data.color_attributes.new(name='Identity front mask', type='FLOAT_COLOR', domain='CORNER')
        uv = ob.data.uv_layers['Identity rest projection']
        for poly in ob.data.polygons:
            for li in poly.loop_indices:
                vertex = ob.data.vertices[ob.data.loops[li].vertex_index]
                p = ob.matrix_world @ vertex.co
                if p.z > 1.535 and face:
                    cx, cy, rx, ry = face
                    u = cx + p.x/.105*rx
                    v = 1-cy + (p.z-1.68)/.12*ry
                    weight = max(0,min(1,(-vertex.normal.y-.08)*2.4))
                else:
                    u = .50 + p.x*(.88 if upgraded.exists() else .76)
                    v = .035 + p.z*.48
                    if upgraded.exists():
                        if p.z>.95:v=.606+(p.z-.95)*.40
                        else:
                            v=.005+p.z*.636
                            sign=1 if p.x>0 else -1
                            u=.5+sign*.125+(p.x-sign*.114)*.78
                    weight = max(0,min(1,(-vertex.normal.y-.12)*1.8))*.90
                    if upgraded.exists() and abs(p.x)>.235 and p.z>1.15:weight=0
                uv.data[li].uv=(u,v)
                mask.data[li].color=(weight,weight,weight,1)
    for material in materials:
        nodes, links = material.node_tree.nodes, material.node_tree.links
        shader = nodes.get('Principled BSDF')
        prior = shader.inputs['Base Color'].links[0].from_socket if shader.inputs['Base Color'].is_linked else None
        coords=nodes.new('ShaderNodeUVMap');coords.uv_map='Identity rest projection'
        texture=nodes.new('ShaderNodeTexImage');texture.image=im;texture.extension='EXTEND'
        links.new(coords.outputs['UV'],texture.inputs['Vector'])
        color=nodes.new('ShaderNodeVertexColor');color.layer_name='Identity front mask'
        alpha=nodes.new('ShaderNodeMath');alpha.operation='MULTIPLY'
        links.new(color.outputs['Color'],alpha.inputs[0]);links.new(texture.outputs['Alpha'],alpha.inputs[1])
        if upgraded.exists():
            # Built-in source references were returned as RGB with a pale
            # checker backdrop. Reject that pale backdrop in the material;
            # no runtime alpha is derived from these source images.
            if is_hub:
                channels=nodes.new('ShaderNodeSeparateXYZ');links.new(texture.outputs['Color'],channels.inputs[0])
                maximum=nodes.new('ShaderNodeMath');maximum.operation='MAXIMUM';links.new(channels.outputs['X'],maximum.inputs[0]);links.new(channels.outputs['Z'],maximum.inputs[1])
                green=nodes.new('ShaderNodeMath');green.operation='SUBTRACT';links.new(channels.outputs['Y'],green.inputs[0]);links.new(maximum.outputs[0],green.inputs[1])
                keep=nodes.new('ShaderNodeMath');keep.operation='LESS_THAN';keep.inputs[1].default_value=.12;links.new(green.outputs[0],keep.inputs[0])
            else:
                gray=nodes.new('ShaderNodeRGBToBW');links.new(texture.outputs['Color'],gray.inputs[0])
                keep=nodes.new('ShaderNodeMath');keep.operation='LESS_THAN' if actor in ('voss','reyes') else 'GREATER_THAN';keep.inputs[1].default_value=.52 if actor in ('voss','reyes') else .008;links.new(gray.outputs[0],keep.inputs[0])
            gate=nodes.new('ShaderNodeMath');gate.operation='MULTIPLY';links.new(alpha.outputs[0],gate.inputs[0]);links.new(keep.outputs[0],gate.inputs[1])
            mask_socket=gate.outputs[0]
        else:mask_socket=alpha.outputs[0]
        mix=nodes.new('ShaderNodeMixRGB')
        if prior:links.new(prior,mix.inputs[1])
        else:mix.inputs[1].default_value=shader.inputs['Base Color'].default_value
        links.new(mask_socket,mix.inputs[0]);links.new(texture.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],shader.inputs['Base Color'])


def hair_mesh(profile):
    style=profile['hair'];hair=mat('Identity hair',profile['hair_color'])
    if style=='hood':return
    q.import_hair('Hair_Buzzed.gltf','Close fitted hair base',hair)
    if style=='cropped':return
    rng=random.Random(221)
    if style in ('swept','tousled','tied','textured'):
        q.ellipsoid('Fitted crown hair',(0,.025,1.79),(.089,.088,.035),hair,'Head')
        for i in range(18 if style!='textured' else 38):
            a=rng.uniform(0,math.tau); radius=rng.uniform(.01,.104)
            z=1.785+rng.uniform(0,.018)
            x=math.cos(a)*radius;y=.028+math.sin(a)*radius*.78
            if style in ('swept','tousled'):
                horn('Swept sculpted hair lock',[(x,y,z-.018),(x-.02,y-.024,z+.012),(x-.044,y-.047,z+.026)],[.018,.014,0],hair,'Head')
            else:q.ellipsoid('Textured hair locks',(x,y,z),(.015,.018,.018),hair,'Head')
    if style=='receding':
        for s in [-1,1]:q.ellipsoid('Grey temple hair',(s*.094,.035,1.73),(.021,.075,.057),hair,'Head')
    if style=='tied':
        q.ellipsoid('Tied back hair',(0,.14,1.75),(.067,.053,.055),hair,'Head')
        q.curve('Short tied hair tail',[(0,.14,1.74),(0,.16,1.67),(.015,.15,1.61)],.028,hair,'Head')


def garment_from_body(body,cloth,rolled=False):
    ob=body.copy();ob.data=body.data.copy();bpy.context.collection.objects.link(ob)
    ob.name='Weighted tailored sleeves and trousers'
    bm=bmesh.new();bm.from_mesh(ob.data)
    remove=[v for v in bm.verts if v.co.z>1.535 or abs(v.co.x)>(.50 if rolled else .701) or v.co.z<.15]
    bmesh.ops.delete(bm,geom=remove,context='VERTS')
    for v in bm.verts:v.co+=v.normal*(.019 if v.co.z>1.0 else .023)
    bm.to_mesh(ob.data);bm.free();ob.data.materials.clear();ob.data.materials.append(cloth)
    for p in ob.data.polygons:p.material_index=0
    q.ACTOR.append(ob)
    return ob


def build_human(actor):
    profile=PROFILES[actor]
    with bpy.data.libraries.load(str(BASE),link=False) as (available,selected):
        selected.objects=[n for n in available.objects if not n.startswith(('SOURCE_HAIR','Icosphere'))]
        # The rig's imported name is discovered rather than assumed.
    # Reload with names known to exist; vendor names may include a suffix.
    loaded=[o for o in selected.objects if o]
    for ob in loaded:bpy.context.collection.objects.link(ob)
    if not any(o.type=='ARMATURE' for o in loaded):
        for ob in loaded:bpy.data.objects.remove(ob,do_unlink=True)
        with bpy.data.libraries.load(str(BASE),link=False) as (available,selected):
            selected.objects=[n for n in available.objects if not n.startswith(('SOURCE_HAIR','Icosphere'))]
        loaded=selected.objects
        for ob in loaded:bpy.context.collection.objects.link(ob)
    q.RIG=next(o for o in loaded if o.type=='ARMATURE');q.RIG.name=actor+' anatomical rig'
    q.ACTOR=[o for o in loaded if o.type=='MESH']
    body=next(o for o in q.ACTOR if o.name.startswith('SuperHero_Male'))
    body.name='Weighted anatomical body'
    # Slim the vendor superhero's limb cross sections before tailoring.
    for vertex in body.data.vertices:
        if abs(vertex.co.x)>.27 and 1.30<vertex.co.z<1.62:
            vertex.co.y=.045+(vertex.co.y-.045)*.68
            vertex.co.z=1.455+(vertex.co.z-1.455)*.68
        if vertex.co.z<.18:
            s=1 if vertex.co.x>0 else -1
            vertex.co.x=s*.114+(vertex.co.x-s*.114)*.82
            vertex.co.y=.01+(vertex.co.y-.01)*.83
    if actor in ('reyes','hub-signal-chaser','kael'):
        for vertex in body.data.vertices:
            if vertex.co.z>1.555:
                vertex.co.x*=1.04
                if vertex.co.z<1.665:vertex.co.x*=.88
                if vertex.co.y<-.065:vertex.co.y=-.065+(vertex.co.y+.065)*.72
            elif 1.05<vertex.co.z<1.42 and abs(vertex.co.x)<.25:
                vertex.co.x*=.88 if actor!='kael' else .94
        body.data.update()
    cloth=mat(profile['role'],profile['cloth']);trim=mat('Worn dark trim',profile['trim']);metal=mat('Scuffed metal',(.09,.105,.105),.7)
    skin=mat('Identity skin tone',profile['skin'],roughness=.75)
    # Keep source eye and normal geometry, but explicit profile skin avoids
    # sharing the quartermaster's skin color on sides and backs of heads.
    body.data.materials.clear()
    for m in [skin,cloth,trim]:body.data.materials.append(m)
    rolled=actor in ('survivor','hub-bartender')
    for p in body.data.polygons:
        co=sum((body.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
        p.material_index=0 if co.z>1.535 or (rolled and abs(co.x)>.50) else (2 if abs(co.x)>.70 else 1)
    garment=garment_from_body(body,cloth,rolled)
    feminine=actor in ('reyes','hub-signal-chaser')
    rings=[(.88,.185,.12,.025),(.96,.18 if feminine else .195,.132,.025),(1.08,.17 if feminine else .20,.13,.02),(1.22,.215,.148,.02),(1.38,.222 if feminine else .235,.13,.02),(1.45,.19,.11,.02),(1.50,.11,.083,.024)]
    jacket=q.torso_shell('Identity jacket torso',rings,cloth,'spine_03')
    front_objects=[body,garment,jacket]
    eyes=next((o for o in q.ACTOR if o.name.startswith('Eyes')),None)
    projection_mats=[skin,cloth]
    if eyes:front_objects.append(eyes);projection_mats.extend(list(eyes.data.materials))
    project_role_meshes=actor=='scavenger' or actor.startswith('hub-')
    if not project_role_meshes:add_front_projection(front_objects,projection_mats,actor,profile['face'])
    # A real cloth tail gives long-coat characters their silhouette in profile.
    if profile['coat']:
        verts=[];faces=[];n=22
        for z,rx,ry in [(.99,.22,.14),(profile['coat'],.28,.20)]:
            for j in range(n):
                a=-.12+j*(math.pi+ .24)/(n-1)
                verts.append((rx*math.cos(a),.025+ry*math.sin(a),z))
        for j in range(n-1):faces.append((j,j+1,n+j+1,n+j))
        me=bpy.data.meshes.new('Split coat tails');me.from_pydata(verts,[],faces);me.update()
        ob=bpy.data.objects.new('Split coat tails',me);bpy.context.collection.objects.link(ob);q.finish(ob,'Open front coat tails',cloth,'pelvis')
        mod=ob.modifiers.new('Coat cloth thickness','SOLIDIFY');mod.thickness=.012
    q.torso_shell('Collar',[(1.47,.105,.10,.02),(1.54,.10,.093,.025)],trim,'neck_01')
    q.torso_shell('Waist belt',[(.95,.216,.149,.024),(.994,.216,.149,.024)],trim,'pelvis')
    q.box('Belt buckle',(0,-.138,.971),(.072,.034,.047),metal,'pelvis',.005)
    q.curve('Front garment seam',[(0,-.116,.9),(0,-.141,1.15),(0,-.132,1.4)],.005,trim,'spine_03')
    for sign,suffix in [(1,'l'),(-1,'r')]:
        q.ellipsoid('Boot leather',(sign*.114,-.009,.078),(.063,.132,.064),trim,'foot_'+suffix)
        q.box('Boot sole',(sign*.114,-.009,.022),(.131,.26,.031),trim,'foot_'+suffix,.010)
        for y in [-.07,-.01,.04]:q.box('Boot strap',(sign*.114,y,.126),(.132,.02,.017),cloth,'foot_'+suffix,.003)
        q.box('Trouser pocket',(sign*.171,.00,.78),(.07,.14,.15),cloth,'thigh_'+suffix,.014)
        for z in [.35,.73,.83]:
            q.curve('Tailored trouser fold',[(sign*.113+.06*math.cos(a),.02+.08*math.sin(a),z+.012*math.cos(a*2)) for a in [math.pi+i*math.pi/14 for i in range(15)]],.0028,trim,('calf_' if z<.5 else 'thigh_')+suffix)
        for z in [1.12,1.28,1.38]:
            q.curve('Back stitched tailoring',[(sign*.03,.17,z),(sign*.10,.18,z+.014),(sign*.19,.13,z+.002)],.0035,trim,'spine_03')
        for x in [.34,.43,.55,.63]:
            q.curve('Sleeve seam and crease',[(sign*x,.046+.050*math.sin(a),1.455+.052*math.cos(a)) for a in [math.tau*j/20 for j in range(21)]],.003,trim,('upperarm_' if x<.48 else 'lowerarm_')+suffix)
    hair_mesh(profile)
    cyan=q.glow('Instrument phosphor',(.015,.23,.25),1.8)
    if actor=='voss':
        for sign in [-1,1]:q.box('Command epaulet',(sign*.218,.017,1.458),(.11,.13,.023),metal,'spine_03',.005)
        q.box('Optical implant frame',(.062,-.085,1.699),(.082,.025,.048),metal,'Head',.008)
        q.ellipsoid('Optical cyan lens',(.062,-.103,1.699),(.018,.009,.016),cyan,'Head')
        for i in range(3):q.box('Service bar',(-.085+i*.025,-.145,1.35),(.02,.008,.012),mat('Muted service bar '+str(i),[(.25,.13,.03),(.11,.19,.08),(.20,.07,.04)][i]),'spine_03',.001)
    elif actor=='kael':
        for sign in [-1,1]:
            q.box('Lab coat breast pocket',(sign*.128,-.14,1.27),(.12,.025,.095),cloth,'spine_03',.007)
            q.curve('Lab lapel',[(sign*.10,-.10,1.48),(sign*.065,-.153,1.35),(sign*.13,-.16,1.28)],.019,cloth,'spine_03')
        q.box('Medical instrument',(-.125,-.162,1.3),(.034,.012,.075),cyan,'spine_03',.004)
    elif actor=='reyes':
        for sign in [-1,1]:
            q.curve('Pressure suit harness',[(sign*.13,-.095,1.47),(sign*.13,-.164,1.23),(sign*.095,-.15,1.0)],.027,trim,'spine_03')
            q.ellipsoid('Goggle rim',(sign*.041,-.069,1.769),(.034,.025,.023),metal,'Head')
            q.ellipsoid('Goggle smoked lens',(sign*.041,-.089,1.769),(.025,.009,.016),mat('Smoked amber lenses',(.18,.085,.012),.3,.3),'Head')
        q.box('Pilot thigh holster',(-.21,-.012,.80),(.11,.10,.20),trim,'thigh_r',.016)
    elif actor=='survivor':
        for sign,suffix in [(1,'l'),(-1,'r')]:
            q.box('Rolled sleeve cuff',(sign*.48,.04,1.456),(.053,.16,.16),cloth,'upperarm_'+suffix,.019)
    elif actor=='scavenger':
        hood_rings=[(1.49,.16,.12,.035),(1.65,.151,.127,.04),(1.80,.124,.115,.025),(1.865,.035,.035,.012)]
        verts=[];faces=[];n=26
        for z,rx,ry,cy in hood_rings:
            for j in range(n):
                angle=-.58+j*(math.pi+1.16)/(n-1)
                verts.append((rx*math.cos(angle),cy+ry*math.sin(angle),z))
        for k in range(len(hood_rings)-1):
            for j in range(n-1):faces.append((k*n+j,k*n+j+1,(k+1)*n+j+1,(k+1)*n+j))
        mesh=bpy.data.meshes.new('Open hood shell');mesh.from_pydata(verts,[],faces);mesh.update()
        hood=bpy.data.objects.new('Open hood shell',mesh);bpy.context.collection.objects.link(hood);q.finish(hood,hood.name,cloth,'Head')
        hood.modifiers.new('Hood cloth thickness','SOLIDIFY').thickness=.013
        q.ellipsoid('Recessed full face respirator',(0,-.106,1.675),(.098,.023,.10),trim,'Head')
        q.box('Narrow respirator visor',(0,-.134,1.714),(.133,.013,.024),metal,'Head',.005)
        for sign in [-1,1]:
            q.ellipsoid('Respirator glint',(sign*.047,-.145,1.714),(.009,.004,.005),q.glow('Dim amber visor',(.2,.13,.015),.8),'Head')
            q.ellipsoid('Shoulder pressure plate',(sign*.255,.015,1.442),(.108,.115,.075),metal,'upperarm_'+('l' if sign>0 else 'r'))
        for z in [1.11,1.23,1.35]:q.box('Chest pressure segments',(0,-.164,z),(.34,.035,.085),metal,'spine_03',.012)
    elif actor=='hub-bartender':
        q.box('Heat scarred apron bib',(0,-.163,1.22),(.36,.029,.36),cloth,'spine_03',.028)
        q.box('Heavy apron skirt',(0,-.172,.80),(.42,.028,.42),cloth,'pelvis',.025)
        q.curve('Apron neck strap',[(-.14,-.172,1.32),(-.09,-.086,1.48),(.09,-.086,1.48),(.14,-.172,1.32)],.014,trim,'spine_03')
        for x in [-.11,.05]:q.box('Apron pocket',(x,-.19,.89),(.14,.014,.13),trim,'pelvis',.009)
        q.box('Prosthetic forearm housing',(-.61,.046,1.455),(.23,.139,.129),metal,'lowerarm_r',.02)
        for x in [-.54,-.61,-.68]:q.box('Prosthetic inset band',(x,-.03,1.454),(.022,.01,.13),trim,'lowerarm_r',.002)
    elif actor=='hub-regular':
        q.torso_shell('Respiratory collar',[(1.43,.14,.13,.02),(1.53,.142,.135,.02),(1.56,.10,.095,.02)],trim,'neck_01')
        for sign in [-1,1]:
            q.cylinder_between('Respirator filter',(sign*.14,-.02,1.46),(sign*.14,-.08,1.46),.045,metal,'neck_01')
            for z in [1.08,1.19,1.30]:q.box('Padded jacket panel',(sign*.118,-.159,z),(.20,.04,.085),cloth,'spine_03',.024)
        q.ellipsoid('Collar keepsake',(-.085,-.146,1.48),(.013,.006,.019),metal,'neck_01')
    elif actor=='hub-signal-chaser':
        q.torso_shell('Layered dust cowl',[(1.34,.257,.19,.018),(1.44,.22,.18,.016),(1.53,.115,.114,.014)],cloth,'spine_03')
        q.box('Folded sensor pack',(.075,.18,1.22),(.20,.11,.32),trim,'spine_03',.028)
        q.cylinder_between('Antenna folded mast',(.17,.2,1.36),(.17,.2,1.93),.009,metal,'spine_03')
        for z in [1.63,1.74,1.85]:q.cylinder_between('Antenna crosspiece',(.09,.2,z),(.24,.2,z),.006,metal,'spine_03')
        q.ellipsoid('Headset earpiece',(-.11,.025,1.706),(.025,.035,.045),metal,'Head')
        q.curve('Headset pickup',[(-.11,.005,1.72),(-.13,-.07,1.65),(-.065,-.105,1.646)],.007,metal,'Head')
        q.ellipsoid('Sensor glow',(.20,-.07,1.428),(.027,.012,.027),cyan,'spine_03')
    if project_role_meshes:
        add_front_projection([ob for ob in q.ACTOR if ob.type=='MESH'],list(dict.fromkeys(projection_mats+[trim,metal])),actor,profile['face'])
    # Proportions change as an assembly, preserving skeleton/skin alignment.
    bpy.ops.object.empty_add(type='PLAIN_AXES');root=bpy.context.object;root.name=actor+' identity proportions'
    for ob in q.ACTOR+[q.RIG]:
        if ob.parent is None:
            world=ob.matrix_world.copy();ob.parent=root;ob.matrix_world=world
    root.scale=(profile['width'],1.0,profile['height'])
    q.RIG['identity']=profile['role']
    return root


def animate_human(actor):
    q.RIG.animation_data_create();q.RIG.animation_data.action=bpy.data.actions.new(actor+' idle and walk')
    for clip,count,start in [('idle',4,1),('walk',8,11)]:
        bpy.context.scene.timeline_markers.new(clip.upper(),frame=start)
        for i in range(count):
            bpy.context.scene.frame_set(start+i);q.pose(clip,i,count)
            # Idle is breathing and a subtle head check, never an inventory gesture.
            if clip=='idle':
                b=q.RIG.pose.bones['Head'];b.rotation_quaternion @= Quaternion((0,1,0),.045*math.sin(math.tau*i/count))
            for bone in q.RIG.pose.bones:
                for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(prop,frame=start+i,group=bone.name)
    bpy.context.scene.frame_set(1)


def monster_rig():
    bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Hostile articulated skeleton'
    bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
    def bone(name,head,tail,parent=None):
        b=rig.data.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=rig.data.edit_bones[parent]
    bone('root',(0,0,.02),(0,0,.22))
    bone('body',(0,0,.66),(0,0,1.2),'root');bone('head',(0,0,1.22),(0,0,1.55),'body')
    for s,suffix in [(1,'l'),(-1,'r')]:
        bone('arm_'+suffix,(s*.43,0,1.18),(s*.62,0,.83),'body')
        bone('forearm_'+suffix,(s*.62,0,.83),(s*.67,-.06,.43),'arm_'+suffix)
        bone('thigh_'+suffix,(s*.22,0,.65),(s*.32,-.07,.33),'root')
        bone('calf_'+suffix,(s*.32,-.07,.33),(s*.32,.01,.11),'thigh_'+suffix)
    bpy.ops.object.mode_set(mode='OBJECT');q.RIG=rig;q.ACTOR=[]


def horn(name,points,radii,material,bone):
    verts=[];faces=[];n=10
    for (x,y,z),radius in zip(points,radii):
        for j in range(n):
            angle=math.tau*j/n;verts.append((x+radius*math.cos(angle),y+radius*math.sin(angle),z))
    for k in range(len(points)-1):
        for j in range(n):faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);return q.finish(ob,name,material,bone)


def carapace_volume(name,rings,material,bone,cx=0):
    n=18;verts=[];faces=[]
    for z,rx,ry,cy in rings:
        for j in range(n):
            a=math.tau*j/n
            ridge=1+.07*math.sin(a*5+z*3)
            verts.append((cx+rx*math.cos(a)*ridge,cy+ry*math.sin(a),z+.013*math.sin(a*3)))
    for k in range(len(rings)-1):
        for j in range(n):faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    faces.append(tuple(reversed(range(n))));faces.append(tuple((len(rings)-1)*n+j for j in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
    return q.finish(ob,name,material,bone,smooth=False)


def build_monster():
    monster_rig()
    shell=mat('Charred obsidian carapace',(.026,.031,.033),.28)
    plate=mat('Ash grey exposed plate edges',(.065,.071,.068),.32)
    recess=mat('Deep organic seams',(.012,.009,.008))
    ember=q.glow('Living red core',(.38,.002,.0003),.65)
    orange=q.glow('Hot amber eyes',(.85,.062,.001),1.3)
    carapace_volume('Tapered carapace torso',[(.68,.17,.15,.015),(.78,.23,.18,.015),(.97,.33,.21,.012),(1.18,.39,.22,.005),(1.31,.26,.17,0)],shell,'body')
    carapace_volume('Angular horned skull',[(1.22,.10,.13,-.045),(1.32,.19,.17,-.035),(1.46,.26,.22,-.018),(1.63,.245,.20,-.01),(1.76,.14,.14,0),(1.80,.06,.075,.005)],shell,'head')
    carapace_volume('Angular lower jaw',[(1.24,.11,.08,-.13),(1.28,.17,.11,-.13),(1.36,.19,.10,-.13)],shell,'head')
    q.ellipsoid('Fierce recessed mouth',(0,-.285,1.326),(.145,.018,.048),recess,'head')
    for x,z,radius in [(0,1.04,.025),(-.036,1.07,.014),(.032,1.075,.015),(-.019,1.11,.011),(.015,.99,.012)]:
        q.ellipsoid('Recessed chest embers',(x,-.225,z),(radius,.016,radius*1.3),ember,'body')
    for s,suffix in [(1,'l'),(-1,'r')]:
        horn('Swept outer horn',[(s*.20,.015,1.6),(s*.42,.025,1.72),(s*.63,.035,1.9),(s*.75,.035,2.02)],[.10,.08,.043,0],shell,'head')
        horn('Inset ember horn seam',[(s*.31,-.047,1.67),(s*.47,-.01,1.80),(s*.59,.018,1.9)],[.018,.012,0],ember,'head')
        q.ellipsoid('Eye armored rim',(s*.123,-.215,1.485),(.053,.014,.032),shell,'head')
        q.ellipsoid('Recessed burning eye',(s*.123,-.229,1.485),(.025,.005,.016),orange,'head')
        horn('Angry integrated brow',[(s*.045,-.235,1.53),(s*.14,-.247,1.542),(s*.205,-.22,1.566)],[.045,.035,0],plate,'head')
        q.ellipsoid('Shoulder carapace',(s*.43,.025,1.18),(.205,.19,.17),shell,'arm_'+suffix)
        q.ellipsoid('Upper arm sinew',(s*.56,.012,1.01),(.153,.155,.23),recess,'arm_'+suffix)
        q.ellipsoid('Forearm carapace',(s*.65,-.006,.66),(.16,.15,.23),shell,'forearm_'+suffix)
        q.ellipsoid('Large claw palm',(s*.67,-.08,.46),(.12,.10,.13),shell,'forearm_'+suffix)
        for j in range(3):
            x=s*(.59+j*.07)
            horn('Curved finger talon',[(x,-.10,.44),(x,-.18,.30),(x,-.28,.28)],[.032,.018,0],shell,'forearm_'+suffix)
        carapace_volume('Angular overlapping haunch',[(.36,.10,.11,-.005),(.46,.15,.16,.01),(.60,.165,.17,.01),(.69,.115,.12,.01)],shell,'thigh_'+suffix,s*.26)
        carapace_volume('Bent ridged shin',[(.09,.07,.085,-.02),(.20,.105,.13,-.025),(.32,.10,.105,-.035),(.39,.075,.08,-.05)],plate,'calf_'+suffix,s*.32)
        q.ellipsoid('Clawed foot',(s*.32,-.09,.085),(.17,.22,.085),shell,'calf_'+suffix)
        for j in range(3):horn('Toe talon',[(s*(.23+j*.085),-.21,.075),(s*(.23+j*.085),-.42,.028)],[.036,0],plate,'calf_'+suffix)
        for z in [.91,1.05,1.18]:
            q.curve('Rib carapace edge',[(s*.05,-.242,z),(s*.20,-.24,z+.06),(s*.32,-.14,z+.095)],.027,plate,'body')
        for z in [1.38,1.53,1.64]:
            horn('Cranial side spikes',[(s*.20,.025,z),(s*.35,.055,z-.08),(s*.43,.08,z-.11)],[.068,.04,0],plate,'head')
        for z in [.63,.75]:horn('Arm spur',[(s*.73,.045,z),(s*.89,.09,z+.10)],[.063,0],plate,'forearm_'+suffix)
        for z in [1.01,1.20]:horn('Shoulder spur',[(s*.47,.1,z),(s*.66,.14,z+.15)],[.07,0],shell,'arm_'+suffix)
    q.ellipsoid('Third eye socket',(0,-.214,1.637),(.05,.015,.063),shell,'head')
    q.ellipsoid('Recessed third ember eye',(0,-.231,1.637),(.017,.004,.033),orange,'head')
    for i in range(7):
        x=(i-3)*.037
        horn('Jagged jaw tooth',[(x,-.306,1.351),(x,-.307,1.294)],[.011,0],plate,'head')
    # Genuine rear anatomy makes the asset readable from every direction.
    for z in [.77,.96,1.14,1.31]:
        q.ellipsoid('Dorsal armored vertebra',(0,.25,z),(.11,.07,.10),plate,'body')
        horn('Dorsal spine',[(0,.26,z),(0,.42,z+.08)],[.045,0],shell,'body')
    # Overlapping faceted shell plates break the rounded anatomical underform.
    rng=random.Random(20260906)
    for s,suffix in [(1,'l'),(-1,'r')]:
        for x,y,z,w,h,bone in [(s*.40,-.14,1.24,.28,.20,'arm_'+suffix),(s*.61,-.14,.75,.24,.19,'forearm_'+suffix),(s*.65,-.16,.58,.22,.15,'forearm_'+suffix),(s*.26,-.13,.53,.20,.19,'thigh_'+suffix),(s*.32,-.13,.28,.19,.20,'calf_'+suffix)]:
            verts=[(x-w/2,y,z+h/2),(x+w/2,y,z+h*.32),(x+w*.42,y-.025,z-h*.30),(x,y-.065,z-h/2),(x-w*.40,y-.028,z-h*.25),(x,y-.095,z+.018)]
            faces=[(j,(j+1)%5,5) for j in range(5)]
            me=bpy.data.meshes.new('Angular carapace plate');me.from_pydata(verts,[],faces);me.update()
            ob=bpy.data.objects.new('Angular carapace plate',me);bpy.context.collection.objects.link(ob);q.finish(ob,ob.name,plate,bone,smooth=False)
        for i in range(14):
            z=rng.uniform(.8,1.25);x=s*rng.uniform(.12,.3)
            q.curve('Carapace fracture',[(x,-.218,z),(x+s*.023,-.224,z+.03),(x+s*.04,-.214,z+.036)],.003,recess,'body')
    project_monster_surface([o for o in q.ACTOR if o.type=='MESH'],[shell,plate,recess])
    for ob in q.ACTOR:
        if ob.type=='MESH' and any(m in [shell,plate,recess] for m in ob.data.materials) and len(ob.data.polygons)>100:
            mod=ob.modifiers.new('Fractured angular shell facets','DECIMATE');mod.ratio=.18;mod.use_collapse_triangulate=True
            for p in ob.data.polygons:p.use_smooth=False
    q.RIG['identity']='Original shared hostile: broad charcoal carapace, swept horns, three ember eyes, red chest and clawed limbs'
    q.RIG['source']='Original procedural sculpture and articulated skeleton; no third-party monster mesh'


def project_monster_surface(objects,materials):
    image=bpy.data.images.load(str(ROOT/'game/public/sprites/boarding/enemy-fp-front.png'),check_existing=True)
    for ob in objects:
        ob.data.uv_layers.new(name='Hostile rest projection')
        mask=ob.data.color_attributes.new(name='Hostile front mask',type='FLOAT_COLOR',domain='CORNER')
        uv=ob.data.uv_layers['Hostile rest projection']
        for poly in ob.data.polygons:
            for li in poly.loop_indices:
                vertex=ob.data.vertices[ob.data.loops[li].vertex_index];p=ob.matrix_world@vertex.co
                uv.data[li].uv=(.502+p.x*.278,.155+p.z*.338)
                normal=ob.matrix_world.to_3x3()@vertex.normal
                weight=max(0,min(1,(-normal.y+.10)*2.0))*.94
                mask.data[li].color=(weight,weight,weight,1)
    for material in materials:
        nodes,links=material.node_tree.nodes,material.node_tree.links;shader=nodes.get('Principled BSDF')
        prior=shader.inputs['Base Color'].links[0].from_socket
        uv=nodes.new('ShaderNodeUVMap');uv.uv_map='Hostile rest projection'
        tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='EXTEND';links.new(uv.outputs['UV'],tex.inputs['Vector'])
        mask=nodes.new('ShaderNodeVertexColor');mask.layer_name='Hostile front mask'
        alpha=nodes.new('ShaderNodeMath');alpha.operation='MULTIPLY';links.new(mask.outputs['Color'],alpha.inputs[0]);links.new(tex.outputs['Alpha'],alpha.inputs[1])
        mix=nodes.new('ShaderNodeMixRGB');links.new(prior,mix.inputs[1]);links.new(tex.outputs['Color'],mix.inputs[2]);links.new(alpha.outputs[0],mix.inputs[0]);links.new(mix.outputs[0],shader.inputs['Base Color'])


def animate_monster():
    q.RIG.animation_data_create();q.RIG.animation_data.action=bpy.data.actions.new('Hostile idle walk attack hurt death')
    for clip,count,start in [('idle',4,1),('walk',8,11),('attack',4,21),('hurt',1,31),('death',6,41)]:
        bpy.context.scene.timeline_markers.new(clip.upper(),frame=start)
        for i in range(count):
            bpy.context.scene.frame_set(start+i)
            for b in q.RIG.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0)
            phase=math.tau*i/count
            q.RIG.pose.bones['body'].location.y=.016*math.sin(phase)
            q.RIG.pose.bones['head'].rotation_euler.y=.045*math.sin(phase)
            if clip=='walk':
                for s,suffix in [(1,'l'),(-1,'r')]:
                    gait=math.sin(phase+(0 if s==1 else math.pi))
                    q.RIG.pose.bones['thigh_'+suffix].rotation_euler.x=.30*gait
                    q.RIG.pose.bones['calf_'+suffix].rotation_euler.x=-.25*max(0,-gait)
                    q.RIG.pose.bones['arm_'+suffix].rotation_euler.x=-.16*gait
                    q.RIG.pose.bones['forearm_'+suffix].rotation_euler.x=.1*gait
            elif clip=='attack':
                reach=[.24,-.5,-1.12,-.08][i]
                for suffix in ['l','r']:
                    q.RIG.pose.bones['arm_'+suffix].rotation_euler.x=reach
                    q.RIG.pose.bones['forearm_'+suffix].rotation_euler.x=-.34*math.sin(math.pi*i/3)
                q.RIG.pose.bones['body'].rotation_euler.x=.16*math.sin(math.pi*i/3)
                q.RIG.pose.bones['head'].rotation_euler.x=.08*math.sin(math.pi*i/3)
            elif clip=='hurt':
                q.RIG.pose.bones['body'].rotation_euler.x=-.32;q.RIG.pose.bones['head'].rotation_euler.x=-.25
                q.RIG.pose.bones['body'].rotation_euler.z=.07
                for s,suffix in [(1,'l'),(-1,'r')]:q.RIG.pose.bones['arm_'+suffix].rotation_euler.y=s*.25
            elif clip=='death':
                t=i/5
                q.RIG.pose.bones['body'].rotation_euler.x=-1.25*t
                q.RIG.pose.bones['root'].location.y=-.08*t
                q.RIG.pose.bones['head'].rotation_euler.x=.37*t
                for s,suffix in [(1,'l'),(-1,'r')]:
                    q.RIG.pose.bones['thigh_'+suffix].rotation_euler.x=.45*t
                    q.RIG.pose.bones['calf_'+suffix].rotation_euler.x=-.8*t
                    q.RIG.pose.bones['arm_'+suffix].rotation_euler.y=s*.28*t
            for b in q.RIG.pose.bones:
                for prop in ['location','rotation_euler']:b.keyframe_insert(prop,frame=start+i,group=b.name)
    bpy.context.scene.frame_set(1)


def studio(hostile=False):
    camera,lights=q.lighting();scene=bpy.context.scene
    if args.engine=='eevee':
        scene.render.engine='BLENDER_EEVEE_NEXT'
        scene.eevee.taa_render_samples=48
    else:
        scene.cycles.samples=20;scene.render.threads_mode='FIXED';scene.render.threads=6
    scene.render.resolution_x=256 if hostile else 128;scene.render.resolution_y=256
    camera.data.ortho_scale=2.50 if hostile else 2.10
    scene.render.image_settings.compression=35
    scene.view_settings.exposure=.0
    return camera,lights


def orbit(row,camera,lights,hostile=False):
    q.orbit(row,camera,lights)
    if hostile:
        rotation=Matrix.Rotation(-row*math.tau/8,4,'Z')
        camera.location=rotation@Vector((0,-6,1.05))
        camera.rotation_euler=(Vector((0,0,1.05))-camera.location).to_track_quat('-Z','Y').to_euler()


def main():
    for p in [DOCS,OUTPUT,FRAMES]:p.mkdir(parents=True,exist_ok=True)
    for actor in args.actors.split(','):
        started=time.monotonic();reset();hostile=actor=='hostile'
        (FRAMES/actor).mkdir(exist_ok=True);(OUTPUT/actor).mkdir(exist_ok=True)
        if hostile:build_monster();animate_monster()
        else:build_human(actor);animate_human(actor)
        camera,lights=studio(hostile)
        bpy.context.preferences.filepaths.save_version=0
        for curve in q.RIG.animation_data.action.fcurves:
            for key in curve.keyframe_points:key.interpolation='LINEAR'
        scene=bpy.context.scene
        scene['actor_identity']=actor;scene['row_contract']='front,front-right,right,back-right,back,back-left,left,front-left'
        scene['geometry_source']='Real rigged three-dimensional mesh; original references projected only into material color in rest space'
        verification={'actor':actor,'blender_version':bpy.app.version_string,'bones':len(q.RIG.data.bones),'meshes':sum(o.type=='MESH' for o in q.ACTOR),'fcurves':len(q.RIG.animation_data.action.fcurves),'source_reference':str((ROOT/f'game/public/sprites/boarding/{"enemy-fp-front" if hostile else "npc-"+actor}.png').relative_to(ROOT)),'clips':{},'engine':scene.render.engine}
        projection=ROOT/verification['source_reference']
        if (DOCS/'source'/(actor+'-front.png')).exists():projection=DOCS/'source'/(actor+'-front.png')
        if actor.startswith('hub-'):projection=ROOT/f'docs/assets/source/m3-hubs/cantina/{actor}-billboard-source.png'
        verification['projection_reference']=str(projection.relative_to(ROOT))
        # One human representative + generator reconstructs all profiles; the
        # imported vendor base is never copied into eight redundant sources.
        if actor in ('voss','hostile'):
            bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(DOCS/(actor+'-editable.blend')),compress=True)
        if args.source_only:continue
        clips=[('idle',4,1),('walk',8,11)]+([('attack',4,21),('hurt',1,31),('death',6,41)] if hostile else [])
        if args.clips:
            requested=set(args.clips.split(','))
            assert requested<={clip for clip,_,_ in clips},('unsupported clips',requested)
            previous=json.loads((DOCS/(actor+'-source-verification.json')).read_text())
            verification['clips']=previous['clips']
            verification['rerendered_clips']=sorted(requested)
            clips=[entry for entry in clips if entry[0] in requested]
        for clip,count,start in clips:
            records=[]
            for row in ([0,2] if args.sample else ([0] if clip=='death' else range(8))):
                orbit(row,camera,lights,hostile)
                for col in ([0] if args.sample else range(count)):
                    scene.frame_set(start+col)
                    target=FRAMES/actor/f'{clip}-{row}-{col}.png'
                    q.render(target)
                    records.append({'row':row,'column':col,'frame':start+col})
            verification['clips'][clip]=records
        verification['elapsed_seconds']=round(time.monotonic()-started,2)
        (DOCS/(actor+'-source-verification.json')).write_text(json.dumps(verification,indent=2)+'\n')
        print('ACTOR_COMPLETE',actor,verification['elapsed_seconds'],flush=True)
    print('ACTOR_RENDER_COMPLETE',flush=True)


if __name__=='__main__':main()
