"""Rebuild the Quartermaster pilot with Blender 4.4; no add-ons or network required.

Blender --background --factory-startup --python game/scripts/quartermaster/render_pilot.py -- --sample
Omit --sample to render every frame. Run pack_atlases.py with Pillow afterwards.
"""
import argparse
import math
import random
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[3]
DOCS = ROOT / 'docs/assets/quartermaster-motion'
SOURCE = DOCS / 'source'
FRAMES = Path(tempfile.gettempdir()) / 'sector-zero-quartermaster-frames'
RUNTIME = ROOT / 'game/public/sprites/pilot/quartermaster'
RNG = random.Random(20260906)
ARGS = argparse.ArgumentParser()
ARGS.add_argument('--sample', action='store_true')
ARGS.add_argument('--source-only', action='store_true')
OPTIONS = ARGS.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
for directory in (DOCS, FRAMES, RUNTIME):
    directory.mkdir(parents=True, exist_ok=True)


def material(name, dark, light, metal=0.0, roughness=0.8, scale=42, bump=0.08):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = roughness
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 3.5
    noise.inputs['Roughness'].default_value = 0.78
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = 0.73
    ramp.color_ramp.elements[1].color = (*light, 1)
    links.new(noise.outputs['Fac'], ramp.inputs[0])
    links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    fine = nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = 240
    fine.inputs['Detail'].default_value = 2
    normal = nodes.new('ShaderNodeBump')
    normal.inputs['Strength'].default_value = bump
    normal.inputs['Distance'].default_value = 0.014
    links.new(fine.outputs['Fac'], normal.inputs['Height'])
    links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def glow(name, color, strength):
    m = material(name, color, color, 0.15, 0.35, bump=0)
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Emission Color'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = strength
    return m


def finish(obj, name, mat, bone=None, bevel=0, smooth=True):
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Worn rounded edges', 'BEVEL')
        mod.width, mod.segments = bevel, 2
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if bone:
        # A rigid accessory follows the anatomical rig; its rest transform is preserved.
        world = obj.matrix_world.copy()
        obj.parent = RIG
        obj.parent_type = 'BONE'
        obj.parent_bone = bone
        bpy.context.view_layer.update()
        obj.matrix_world = world
    ACTOR.append(obj)
    return obj


def box(name, loc, size, mat, bone=None, bevel=0.012, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation:
        obj.rotation_euler = rotation
    return finish(obj, name, mat, bone, bevel, False)


def ellipsoid(name, loc, size, mat, bone=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=loc)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, mat, bone)


def cylinder_between(name, a, b, radius, mat, bone=None, vertices=12):
    direction = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(Vector(a) + Vector(b)) / 2)
    o = bpy.context.object
    o.rotation_quaternion = direction.to_track_quat('Z', 'Y')
    o.rotation_mode = 'QUATERNION'
    return finish(o, name, mat, bone, 0.002)


def curve(name, points, width, mat, bone=None):
    c = bpy.data.curves.new(name, 'CURVE')
    c.dimensions = '3D'
    c.resolution_u = 1
    c.bevel_depth, c.bevel_resolution = width, 1
    spline = c.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bone:
        world = obj.matrix_world.copy()
        obj.parent, obj.parent_type, obj.parent_bone = RIG, 'BONE', bone
        bpy.context.view_layer.update()
        obj.matrix_world = world
    ACTOR.append(obj)
    return obj


def torso_shell(name, rings, mat, bone):
    verts, faces, n = [], [], 32
    for z, rx, ry, cy in rings:
        for j in range(n):
            a = math.tau * j / n
            verts.append((rx * math.cos(a), cy + ry * math.sin(a), z))
    for i in range(len(rings) - 1):
        for j in range(n):
            faces.append((i*n+j, i*n+(j+1)%n, (i+1)*n+(j+1)%n, (i+1)*n+j))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    finish(ob, name, mat, bone)
    solid = ob.modifiers.new('Heavy garment thickness', 'SOLIDIFY')
    solid.thickness = 0.009
    sub = ob.modifiers.new('Tailored surface', 'SUBSURF')
    sub.levels = 1
    return ob


def import_hair(filename, name, mat):
    label='SOURCE_HAIR_BUZZED' if 'Buzzed' in filename else 'SOURCE_HAIR_BEARD'
    with bpy.data.libraries.load(str(SOURCE/'quartermaster-base.blend'),link=False) as (available,selected):
        selected.objects=[label]
    meshes=selected.objects
    for obj in meshes:bpy.context.collection.objects.link(obj)
    for ob in meshes:
        coords = [ob.matrix_world @ v.co for v in ob.data.vertices]
        lo = Vector(tuple(min(v[i] for v in coords) for i in range(3)))
        hi = Vector(tuple(max(v[i] for v in coords) for i in range(3)))
        print('HAIR_BOUNDS', filename, tuple(lo), tuple(hi), flush=True)
        # Origin-at-zero hair is authored to fit this kit's head at z=0.
        if hi.z < 0.5:
            ob.location.z += 1.5998
        finish(ob, name, mat, 'Head')


def project_hero(objects, materials):
    """Use the approved painted hero as a rest-space front texture on actual 3D surfaces.

    The UVs and blend mask are stored on the real meshes, so the texture follows the rig.
    Side/back retain their procedural surfaces; this is not a flat camera-facing cutout.
    """
    image=bpy.data.images.load(str(DOCS.parent/'pilot/quartermaster-hero-v1-alpha.png'),check_existing=True)
    for obj in objects:
        uv=obj.data.uv_layers.new(name='Hero rest-space projection')
        mask=obj.data.color_attributes.new(name='Hero projection mask',type='FLOAT_COLOR',domain='CORNER')
        # Adding CustomData reallocates loop storage; reacquire the UV layer reference.
        uv=obj.data.uv_layers['Hero rest-space projection']
        for polygon in obj.data.polygons:
            for loopindex in polygon.loop_indices:
                v=obj.data.vertices[obj.data.loops[loopindex].vertex_index]
                p=obj.matrix_world@v.co
                if p.z>1.53:
                    # The portrait's slightly larger head is fitted independently.
                    u=(495+p.x/.16*154)/1024
                    texv=1-(246-(p.z-1.60)/.22*208)/1536
                    facefade=max(0,min(1,(-v.normal.y-.05)*2.5))
                else:
                    u=.487+p.x*.87
                    texv=.029+p.z*.52
                    facefade=max(0,min(1,(-v.normal.y-.1)*2.1))*.8
                uv.data[loopindex].uv=(u,texv)
                mask.data[loopindex].color=(facefade,facefade,facefade,1)
    for mat in materials:
        n,l=mat.node_tree.nodes,mat.node_tree.links
        shader=n.get('Principled BSDF')
        prior=shader.inputs['Base Color'].links[0].from_socket if shader.inputs['Base Color'].is_linked else None
        tex=n.new('ShaderNodeTexImage');tex.image=image;tex.extension='EXTEND'
        coords=n.new('ShaderNodeUVMap');coords.uv_map='Hero rest-space projection'
        l.new(coords.outputs['UV'],tex.inputs['Vector'])
        attr=n.new('ShaderNodeVertexColor');attr.layer_name='Hero projection mask'
        mix=n.new('ShaderNodeMixRGB');mix.blend_type='MIX'
        if prior:l.new(prior,mix.inputs[1])
        else:mix.inputs[1].default_value=shader.inputs['Base Color'].default_value
        l.new(attr.outputs['Color'],mix.inputs[0]);l.new(tex.outputs['Color'],mix.inputs[2]);l.new(mix.outputs[0],shader.inputs['Base Color'])


def build_actor():
    global RIG, ACTOR, CLOTH, LEATHER, STEEL, EDGE, DARK, CYAN, DUST, RUBBER
    ACTOR = []
    with bpy.data.libraries.load(str(SOURCE/'quartermaster-base.blend'),link=False) as (available,selected):
        selected.objects=[name for name in available.objects if not name.startswith('SOURCE_HAIR')]
    for obj in selected.objects:bpy.context.collection.objects.link(obj)
    RIG = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    RIG.name = 'Quartermaster_Rig'
    for o in list(bpy.context.scene.objects):
        if o.name.startswith('Icosphere'):
            bpy.data.objects.remove(o, do_unlink=True)
        elif o.type == 'MESH':
            ACTOR.append(o)
    CLOTH = material('Ash stained brown canvas', (0.012,0.010,0.008), (0.079,0.057,0.032), scale=68, bump=0.4)
    LEATHER = material('Worn umber leather', (0.008,0.007,0.005), (0.055,0.037,0.022), scale=82, bump=0.28)
    STEEL = material('Chipped oxidized gunmetal', (0.008,0.010,0.012), (0.066,0.075,0.080), 0.65, 0.73, 53, 0.22)
    EDGE = material('Exposed edge steel', (0.048,0.05,0.047), (0.17,0.145,0.11), 0.67, 0.7, 93)
    DARK = material('Soot dark recess', (0.007,0.008,0.009), (0.025,0.028,0.03), 0.15, 0.95)
    DUST = material('Embedded ochre grit', (0.07,0.049,0.027), (0.3,0.235,0.155), 0.1, 0.9)
    RUBBER = material('Scuffed rubber soles', (0.006,0.006,0.006), (0.06,0.057,0.052), roughness=0.93, scale=35)
    CYAN = glow('Small cyan status phosphor', (0.015,0.48,0.58), 2.2)
    HAIR = material('Salt and pepper cropped hair', (0.007,0.008,0.007), (0.070,0.067,0.053), roughness=0.96, scale=145, bump=0.44)
    eyebrows=bpy.data.objects.get('Eyebrows')
    eyebrows.data.materials.clear();eyebrows.data.materials.append(HAIR)
    BODY = bpy.data.objects.get('SuperHero_Male')
    BODY.name = 'Anatomical body and face - Quaternius CC0'
    # Retain real skin/normal maps on the head; the underlying body is cloth and gloves.
    BODY.data.materials.append(CLOTH)
    BODY.data.materials.append(LEATHER)
    for poly in BODY.data.polygons:
        center = sum((BODY.data.vertices[i].co for i in poly.vertices), Vector()) / len(poly.vertices)
        if center.z < 1.54 or abs(center.x)>.13:
            poly.material_index = 2 if abs(center.x) > 0.705 else 1
    for mat in list(BODY.data.materials)[:1]:
        b = mat.node_tree.nodes.get('Principled BSDF')
        b.inputs['Roughness'].default_value = 0.86
    # Fitted sleeve/trouser shell from the deformation mesh: real mesh + original weights.
    import bmesh
    garment = BODY.copy()
    garment.data = BODY.data.copy()
    bpy.context.collection.objects.link(garment)
    bm = bmesh.new(); bm.from_mesh(garment.data)
    remove = [v for v in bm.verts if v.co.z > 1.535 or abs(v.co.x) > 0.701 or v.co.z < 0.15]
    bmesh.ops.delete(bm, geom=remove, context='VERTS')
    for v in bm.verts:
        v.co += v.normal * (0.027 if v.co.z < 1.06 else 0.021)
    bm.to_mesh(garment.data); bm.free()
    garment.data.materials.clear(); garment.data.materials.append(CLOTH)
    for p in garment.data.polygons: p.material_index = 0
    garment.name = 'Weighted heavy canvas sleeves and trousers'
    ACTOR.append(garment)
    jacket=torso_shell('Field jacket torso', [(0.88,.205,.125,.028),(.93,.20,.136,.025),(.98,.199,.127,.025),(1.06,.204,.139,.02),(1.12,.196,.145,.017),(1.20,.226,.16,.019),(1.3,.257,.162,.021),(1.38,.26,.141,.021),(1.43,.255,.144,.021),(1.50,.13,.09,.024)], CLOTH, 'spine_03')
    torso_shell('Folded armored neck scarf', [(1.435,.116,.116,.01),(1.48,.127,.121,.02),(1.535,.108,.102,.027),(1.558,.084,.08,.024)], LEATHER, 'neck_01')
    for z in [1.459,1.49,1.522]:
        curve('Scarf crease', [(math.cos(a)*.119,.02+math.sin(a)*.114,z+.009*math.sin(a*3)) for a in [i*math.tau/32 for i in range(33)]], .0025, DUST, 'neck_01')
    # Front seam, wide shoulder straps, buckles, multi-layer utility bags.
    curve('Jacket front reinforced seam', [(0,-.114,.9),(0,-.147,1.10),(0,-.15,1.32),(0,-.09,1.48)], .008, LEATHER, 'spine_03')
    for side in [-1,1]:
        curve('Load bearing harness front', [(side*.13,-.123,1.45),(side*.16,-.165,1.32),(side*.135,-.17,1.12),(side*.11,-.145,.985)], .025, LEATHER, 'spine_03')
        curve('Harness edge piping', [(side*.15,-.13,1.45),(side*.18,-.166,1.32),(side*.155,-.17,1.12)], .004, DUST, 'spine_03')
        curve('Load bearing harness back', [(side*.13,.145,1.44),(side*.13,.179,1.21),(side*.11,.166,.99)], .024, LEATHER, 'spine_03')
        for z in [1.33,1.15]:
            box('Steel harness buckle',(side*.151,-.191,z),(.055,.015,.065),EDGE,'spine_03',.003)
            box('Buckle inset',(side*.151,-.202,z),(.032,.011,.035),LEATHER,'spine_03',.002)
        for z in [1.22,1.1,1.00]:
            ellipsoid('Jacket metal snap',(0.015,-.162,z),(.008,.006,.008),EDGE,'spine_03')
    torso_shell('Broad utility belt',[(.945,.227,.158,.024),(.992,.227,.158,.024)],LEATHER,'pelvis')
    box('Belt clasp',(0,-.15,.976),(.10,.035,.06),STEEL,'pelvis',.006)
    for x,z,w,h in [(-.13,1.1,.17,.15),(.075,1.06,.12,.13),(-.22,.925,.105,.14),(.22,.935,.115,.155)]:
        box('Canvas equipment pouch',(x,-.18,z),(w,.082,h),CLOTH,'pelvis' if z<1 else 'spine_03',.014)
        box('Overlapping pouch flap',(x,-.23,z+h*.25),(w*.96,.025,h*.36),LEATHER,'pelvis' if z<1 else 'spine_03',.009)
        for dx in [-w*.27,w*.27]:
            box('Pouch latch',(x+dx,-.25,z),(.012,.012,.047),EDGE,'pelvis' if z<1 else 'spine_03',.002)
    box('Rear equipment pack',(0,.188,1.16),(.33,.115,.32),CLOTH,'spine_03',.035)
    box('Rear pack lid',(0,.253,1.27),(.35,.04,.095),LEATHER,'spine_03',.02)
    for x in [-.115,.115]:
        box('Rear pack strap',(x,.256,1.13),(.025,.024,.3),LEATHER,'spine_03',.005)
    # Asymmetric pauldron and rugged forearm equipment.
    ellipsoid('Left shoulder heavy pauldron',(.255,.056,1.458),(.131,.129,.090),STEEL,'upperarm_l')
    for a in [-1,1]:
        curve('Pauldron reinforced lip',[(.15,.056+a*.135,1.48),(.25,.056+a*.143,1.458),(.36,.056+a*.098,1.425)],.008,EDGE,'upperarm_l')
    for x,y,z in [(.16,-.043,1.499),(.32,-.043,1.475),(.32,.143,1.475),(.18,.157,1.489)]:
        ellipsoid('Armor rivet',(x,y,z),(.008,.008,.008),EDGE,'upperarm_l')
    box('Pauldron lamp socket',(.285,-.07,1.49),(.055,.025,.052),DARK,'upperarm_l',.012)
    box('Pauldron cyan lamp',(.285,-.086,1.49),(.029,.006,.028),CYAN,'upperarm_l',.009)
    for side,suffix in [(1,'l'),(-1,'r')]:
        box('Forearm cuff',(side*.629,.065,1.455),(.11,.13,.12),LEATHER,'lowerarm_'+suffix,.018)
        box('Forearm armor plate',(side*.60,.01,1.463),(.16,.031,.095),STEEL,'lowerarm_'+suffix,.015)
        for x in [.55,.65]:
            box('Cuff steel clasp',(side*x,-.01,1.462),(.016,.018,.08),EDGE,'lowerarm_'+suffix,.004)
        ellipsoid('Reinforced kneepad',(side*.114,-.071,.542),(.068,.034,.088),STEEL,'calf_'+suffix)
        for z in [.493,.587]:
            box('Kneepad strap',(side*.114,.031,z),(.184,.16,.027),LEATHER,'calf_'+suffix,.008)
        box('Thigh cargo pouch',(side*.188,-.025,.763),(.102,.133,.17),CLOTH,'thigh_'+suffix,.014)
        # Boots have layered welt/sole/toe caps and thick instep buckles.
        ellipsoid('Steel toe field boot',(side*.114,-.021,.098),(.084,.165,.086),LEATHER,'foot_'+suffix)
        box('Boot tread sole',(side*.114,-.02,.023),(.166,.325,.044),RUBBER,'foot_'+suffix,.021)
        ellipsoid('Toe guard',(side*.114,-.124,.068),(.081,.076,.043),STEEL,'foot_'+suffix)
        for y in [-.064,.035]:
            box('Boot instep strap',(side*.114,y,.163),(.179,.033,.026),LEATHER,'foot_'+suffix,.005)
            box('Boot buckle',(side*.174,y,.164),(.037,.044,.02),EDGE,'foot_'+suffix,.003)
        for y in [-.14,-.06,.02,.10]:
            box('Sole tread cut',(side*.114,y,.004),(.179,.013,.012),DARK,'foot_'+suffix,.001)
    # Organic seams and folds interrupt the simple deformation shell silhouette.
    for sign,suffix in [(1,'l'),(-1,'r')]:
        for z in [.30,.38,.70,.82]:
            points=[(sign*.115+.069*math.cos(a),.027+.078*math.sin(a),z+.011*math.cos(a*2)) for a in [math.pi+i*math.pi/16 for i in range(17)]]
            curve('Gathered trouser fold',points,.0024,CLOTH,('calf_' if z<.5 else 'thigh_')+suffix)
        for x in [.40,.48,.51,.57]:
            points=[(sign*x+.006*math.cos(a*2),.065+.068*math.sin(a),1.455+.071*math.cos(a)) for a in [i*math.tau/20 for i in range(21)]]
            curve('Canvas sleeve gathered fold',points,.003,CLOTH,('upperarm_' if x<.46 else 'lowerarm_')+suffix)
    projected_cloth=CLOTH.copy();projected_cloth.name='Canvas with original hero rest-space front detail'
    BODY.data.materials[1]=projected_cloth
    garment.data.materials[0]=projected_cloth
    jacket.data.materials[0]=projected_cloth
    eyes=bpy.data.objects.get('Eyes')
    project_hero([BODY,garment,jacket,eyes], [BODY.data.materials[0],projected_cloth,eyes.data.materials[0]])
    wrinkle=bpy.data.textures.new('Low amplitude irregular canvas folds',type='CLOUDS');wrinkle.noise_scale=.066;wrinkle.noise_depth=2
    for clothing in [garment,jacket]:
        dis=clothing.modifiers.new('Canvas irregularity','DISPLACE');dis.texture=wrinkle;dis.strength=.008;dis.texture_coords='LOCAL'
    import_hair('Hair_Buzzed.gltf','Cropped graying hair',HAIR)
    import_hair('Hair_Beard.gltf','Close graying beard',HAIR)
    # Tablet rests against left palm, screen faces forward. Work poses lift this assembly.
    box('Armored inventory scanner',(.804,-.03,1.455),(.19,.051,.245),STEEL,'hand_l',.019)
    box('Scanner screen inset',(.804,-.059,1.47),(.146,.015,.179),DARK,'hand_l',.005)
    box('Scanner dim cyan glass',(.804,-.07,1.47),(.126,.003,.152),glow('Scanner phosphor',(.005,.075,.09),1.3),'hand_l',.002)
    for i in range(12):
        width = RNG.uniform(.026,.092)
        box('Inventory display scanline',(.78+width*.2,-.073,1.411+i*.010), (width,.002,.0023),CYAN,'hand_l',.0002)
    for z in [1.36,1.57]:
        for x in [.733,.875]:
            ellipsoid('Scanner captive screw',(x,-.06,z),(.005,.004,.005),EDGE,'hand_l')
    # Deterministic wear is true geometry on hard plates, visible as chipped edges at 128px.
    for i in range(36):
        x = RNG.uniform(-.21,.21); z = RNG.uniform(.91,1.43)
        y = -.166 if z>1 else -.141
        curve('Worn canvas abrasion',[(x,y,z),(x+RNG.uniform(.006,.025),y-.002,z+.003)],.0015,DUST,'spine_03')
    return RIG


def aim_bone(name, head, tail):
    b = RIG.data.bones[name]
    rest = b.tail_local - b.head_local
    direction = Vector(tail) - Vector(head)
    q = rest.rotation_difference(direction)
    RIG.pose.bones[name].matrix = Matrix.Translation(Vector(head)) @ q.to_matrix().to_4x4() @ b.matrix_local.to_quaternion().to_matrix().to_4x4()
    bpy.context.view_layer.update()


def two_bone(start, end, length1, length2, bend_direction):
    start,end = Vector(start),Vector(end)
    d = end-start
    length = min(d.length,length1+length2-.001)
    forward = d.normalized()
    bend = Vector(bend_direction)
    bend = (bend-forward*bend.dot(forward)).normalized()
    along = (length1**2-length2**2+length**2)/(2*length)
    height = math.sqrt(max(.000001,length1**2-along**2))
    return start+forward*along+bend*height


def pose(clip, index, count):
    phase=math.tau*index/count
    for b in RIG.pose.bones:
        b.rotation_mode='QUATERNION'
        b.location=(0,0,0);b.rotation_quaternion=(1,0,0,0);b.scale=(1,1,1)
    bpy.context.view_layer.update()
    bob = .007*math.cos(phase*2) if clip=='walk' else .0025*math.sin(phase)
    RIG.pose.bones['pelvis'].location.y = bob
    bpy.context.view_layer.update()
    # Explicit two-bone positions produce real anatomical deformation and planted ankles.
    for sign,suffix in [(1,'l'),(-1,'r')]:
        hip = RIG.pose.bones['thigh_'+suffix].head.copy()
        gait=math.sin(phase + (0 if sign==1 else math.pi))
        stride=.17*gait if clip=='walk' else 0
        lift=.037*max(0,math.cos(phase+(0 if sign==1 else math.pi))) if clip=='walk' else 0
        ankle=Vector((sign*.125,.087+stride,.101+lift))
        knee=two_bone(hip,ankle,.429,.456,(0,-1,0))
        aim_bone('thigh_'+suffix,hip,knee)
        aim_bone('calf_'+suffix,knee,ankle)
        aim_bone('foot_'+suffix,ankle,ankle+Vector((0,-.142,-.0713)))
    for sign,suffix in [(1,'l'),(-1,'r')]:
        shoulder=RIG.pose.bones['upperarm_'+suffix].head.copy()
        if clip=='work':
            if suffix=='l':
                wrist=Vector((.135,-.285,1.177+.009*math.sin(phase)))
            else:
                wrist=Vector((.04+.025*math.sin(phase),-.331,1.257+.033*math.cos(phase)))
            elbow=two_bone(shoulder,wrist,.251,.244,(sign,.1,-.8))
            hand_direction=Vector((0,-.015,.06)) if suffix=='l' else Vector((.058,-.015,-.015))
        else:
            sway=.076*math.sin(phase+(math.pi if suffix=='l' else 0)) if clip=='walk' else .004*math.sin(phase)
            wrist=Vector((sign*.306,.018+sway,.984+bob))
            elbow=two_bone(shoulder,wrist,.251,.244,(sign,-.25,-.1))
            hand_direction=Vector((sign*.008,-.003,-.06))
        aim_bone('upperarm_'+suffix,shoulder,elbow)
        aim_bone('lowerarm_'+suffix,elbow,wrist)
        aim_bone('hand_'+suffix,wrist,wrist+hand_direction)
    # Gentle head inspection without changing body identity or introducing sprite drift.
    head=RIG.pose.bones['Head']
    head.rotation_quaternion=Quaternion((1,0,0),(-.11 if clip=='work' else 0)+.025*math.sin(phase)) @ Quaternion((0,1,0),.015*math.cos(phase))
    bpy.context.view_layer.update()


def animate():
    RIG.animation_data_create()
    RIG.animation_data.action=bpy.data.actions.new('Quartermaster - Idle 1-4 Walk 11-18 Work 21-28')
    for clip,count,start in [('idle',4,1),('walk',8,11),('work',8,21)]:
        bpy.context.scene.timeline_markers.new(clip.upper(),frame=start)
        for i in range(count):
            bpy.context.scene.frame_set(start+i)
            pose(clip,i,count)
            for b in RIG.pose.bones:
                for prop in ['location','rotation_quaternion','scale']:
                    b.keyframe_insert(prop,frame=start+i,group=b.name)
    for curve in RIG.animation_data.action.fcurves:
        for k in curve.keyframe_points:k.interpolation='LINEAR'
    bpy.context.scene.frame_start,bpy.context.scene.frame_end=1,28
    bpy.context.scene.frame_set(1)


def build_station():
    start=len(ACTOR)
    # A heavy maintenance desk, with layered terminal and a compact stores stack.
    box('Workstation scarred steel top',(0,0,.83),(1.22,.6,.095),STEEL,bevel=.024)
    box('Workstation front reinforcement',(0,-.312,.776),(1.24,.04,.095),STEEL,bevel=.008)
    for x in [-.49,.49]:
        for y in [-.21,.21]:
            box('Desk square tube leg',(x,y,.415),(.07,.07,.79),STEEL,bevel=.008)
            box('Desk welded foot',(x,y,.025),(.15,.13,.05),DARK,bevel=.004)
    box('Lower storage shelf',(0,.02,.22),(1.05,.46,.052),STEEL,bevel=.006)
    box('Rugged stores controller',(.39,.13,1.025),(.28,.32,.30),STEEL,bevel=.032)
    for z in [.965,1.0,1.035,1.07,1.105]:
        box('Tower cooling slit',(.39,-.034,z),(.19,.004,.012),DARK,bevel=.001)
    box('Terminal display housing',(-.13,.1,1.135),(.46,.08,.37),STEEL,bevel=.025,rotation=(math.radians(12),0,0))
    box('Terminal black bezel',(-.13,.045,1.143),(.398,.016,.298),DARK,bevel=.008,rotation=(math.radians(12),0,0))
    box('Terminal emissive screen',(-.13,.032,1.145),(.355,.008,.249),glow('Terminal dim glass',(.004,.052,.061),1.5),bevel=.002,rotation=(math.radians(12),0,0))
    for i in range(11):
        width=RNG.uniform(.10,.3)
        box('Terminal inventory data',(-.27+width/2,.018+(i-5)*-.004,1.05+i*.018),(width,.003,.004),CYAN,bevel=.0005)
    box('Terminal stand',(-.13,.12,.937),(.10,.09,.15),STEEL,bevel=.01)
    for side in [-1,1]:
        box('Console armor cheek',(-.13+side*.25,.091,1.125),(.045,.135,.39),STEEL,bevel=.012,rotation=(math.radians(12),0,0))
    for x in [-.333,.07]:
        for z in [1.012,1.28]:
            ellipsoid('Console recessed bolt',(x,.018,z),(.01,.007,.01),EDGE)
    for x in [-.58,-.48,.48,.58]:
        ellipsoid('Desk welded frame bolt',(x,-.336,.78),(.012,.006,.012),EDGE)
    box('Underbench armoured drawer',(-.23,.02,.663),(.50,.47,.16),STEEL,bevel=.018)
    box('Drawer inset',(-.23,-.226,.666),(.43,.01,.112),DARK,bevel=.006)
    box('Drawer steel handle',(-.23,-.25,.68),(.19,.027,.019),EDGE,bevel=.005)
    curve('Terminal power cable',[(-.1,.18,1.0),(-.26,.23,.8),(-.28,.22,.56),(-.08,.15,.4),(.32,.18,.45),(.4,.14,.9)],.016,DARK)
    curve('Stores controller data cable',[(.4,.17,1.02),(.57,.22,.89),(.54,.24,.47),(.34,.20,.34)],.011,LEATHER)
    box('Supply console lower chassis',(-.25,.04,.455),(.46,.42,.37),STEEL,bevel=.023)
    box('Chassis access panel',(-.25,-.18,.455),(.37,.021,.285),DARK,bevel=.008)
    for z in [.35,.39,.43]:
        box('Chassis cooling grille',(-.25,-.197,z),(.27,.009,.013),STEEL,bevel=.002)
    for x in [-.41,-.09]:
        for z in [.33,.58]:
            ellipsoid('Access panel captive bolt',(x,-.197,z),(.01,.004,.01),EDGE)
    box('Rugged keyboard',(-.14,-.185,.901),(.46,.175,.035),DARK,bevel=.012)
    for ix in range(12):
        for iy in range(4):
            box('Keyboard worn key',(-.345+ix*.037,-.243+iy*.036,.924),(.027,.024,.012),EDGE,bevel=.002)
    for x,z in [(.76,.20),(.77,.61),(-.83,.22)]:
        box('Reinforced inventory crate',(x,.03,z),(.40,.46,.38),CLOTH,bevel=.022)
        for dz in [-.15,.15]:
            box('Crate reinforcing band',(x,.03,z+dz),(.43,.48,.036),STEEL,bevel=.006)
        for dx in [-.155,.155]:
            box('Crate corner guard',(x+dx,-.21,z),(.053,.035,.32),STEEL,bevel=.004)
        box('Crate recessed latch',(x,-.213,z+.02),(.10,.023,.09),DARK,bevel=.006)
        box('Crate latch handle',(x,-.231,z+.02),(.065,.018,.032),EDGE,bevel=.004)
    for i in range(27):
        x=RNG.uniform(-.58,.57);y=RNG.uniform(-.28,.27)
        curve('Desktop scraped metal',[(x,y,.879),(x+RNG.uniform(.015,.08),y+.01,.879)],.0028,EDGE)
    rust=material('Workstation exposed rust chips',(.029,.012,.006),(.16,.063,.026),.2,.92,85,.27)
    # Irregular exposed-metal and oxide chips break up the pristine generated edges.
    chip_regions=[(-.60,.60,-.338,.736,.82),(.57,.97,-.237,.05,.35),(.58,.98,-.237,.46,.76),(-1.03,-.63,-.237,.06,.38)]
    for left,right,y,bottom,top in chip_regions:
        for i in range(24):
            x=RNG.uniform(left,right);z=RNG.choice([bottom,top])+RNG.uniform(-.010,.010)
            width=RNG.uniform(.009,.039);height=RNG.uniform(.003,.012)
            mesh=bpy.data.meshes.new('Jagged chipped coating')
            mesh.from_pydata([(x,y,z),(x+width*.6,y,z+height),(x+width,y,z-height*.2),(x+width*.38,y,z-height*.4)],[],[(0,1,2,3)])
            ob=bpy.data.objects.new('Exposed edge abrasion',mesh);bpy.context.collection.objects.link(ob)
            finish(ob,ob.name,EDGE if i%3 else rust,smooth=False)
    cylinder_between('Utility conduit',(.30,.21,.27),(.31,.21,1.05),.022,DARK)
    station=ACTOR[start:]
    del ACTOR[start:]
    for o in station:o.hide_render=True
    return station


def lighting():
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.cycles.device='CPU'
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.image_settings.color_depth='8'
    scene.render.resolution_percentage=100
    scene.render.resolution_x=128;scene.render.resolution_y=256
    scene.world.color=(.055,.055,.055)
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.15
    bpy.ops.object.camera_add(location=(0,-6,.95))
    camera=bpy.context.object;camera.name='Sprite orthographic camera'
    camera.data.type='ORTHO';camera.data.ortho_scale=2.05
    camera.rotation_euler=(Vector((0,0,.93))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    lights=[]
    for name,loc,power,color,size in [('Neutral warm key',(-3,-4,4.5),650,(1,.88,.71),3),('Cold steel fill',(3,-2,2.5),225,(.52,.68,.84),2.5),('Subtle cool edge',(1,2,3.2),450,(.29,.60,.72),2)]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        ob=bpy.context.object;ob.name=name;ob.data.energy=power;ob.data.color=color;ob.data.shape='DISK';ob.data.size=size
        ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
        lights.append((ob,Vector(loc)))
    return camera,lights


def orbit(row,camera,lights):
    # Front is -Y. The actor's right is -X: rows orbit toward -X, back, +X.
    angle=-row*math.tau/8
    rot=Matrix.Rotation(angle,4,'Z')
    camera.location=rot @ Vector((0,-6,.95))
    camera.rotation_euler=(Vector((0,0,.93))-camera.location).to_track_quat('-Z','Y').to_euler()
    for light,loc in lights:
        light.location=rot@loc
        light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()


def render(path):
    bpy.context.scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.context.preferences.filepaths.save_version=0
    build_actor();animate()
    station=build_station()
    camera,lights=lighting()
    for name,objects in [('Quartermaster geometry',ACTOR+[RIG]),('Workstation geometry',station),('Studio',[camera]+[entry[0] for entry in lights])]:
        collection=bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
        for obj in objects:
            for previous in list(obj.users_collection):previous.objects.unlink(obj)
            collection.objects.link(obj)
    bpy.context.view_layer.layer_collection.children['Workstation geometry'].hide_viewport=True
    bpy.ops.object.select_all(action='DESELECT')
    RIG.select_set(True);bpy.context.view_layer.objects.active=RIG
    bpy.context.scene['sprite_contract']='128x256 cells; front then actor right; idle 4x8, walk/work 8x8; projected floor y=244'
    RIG['source']='Quaternius Universal Base Characters Standard - CC0 1.0'
    RIG['animation']='Joint-driven authored idle, gait and handheld scanner poses. All clips in one named timeline action.'
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(DOCS/'quartermaster-pilot.blend'),compress=True)
    if OPTIONS.source_only:
        return
    for clip,count,start in [('idle',4,1),('walk',8,11),('work',8,21)]:
        rows=[0,2,4] if OPTIONS.sample and clip=='idle' else ([0] if OPTIONS.sample else range(8))
        for row in rows:
            orbit(row,camera,lights)
            for col in ([0] if OPTIONS.sample else range(count)):
                bpy.context.scene.frame_set(start+col)
                render(FRAMES/f'{clip}-{row}-{col}.png')
    if OPTIONS.sample:
        orbit(0,camera,lights)
        bpy.context.scene.render.resolution_x=256;bpy.context.scene.render.resolution_y=512
        bpy.context.scene.cycles.samples=64
        for clip,frame in [('idle',1),('work',21)]:
            bpy.context.scene.frame_set(frame)
            render(DOCS/f'sample-{clip}-front.png')
    for ob in ACTOR:ob.hide_render=True
    for ob in station:ob.hide_render=False
    bpy.context.scene.cycles.samples=24
    camera.location=(2.8,-6,2.7)
    camera.rotation_euler=(Vector((0,0,.66))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=2.32
    bpy.context.scene.render.resolution_x=512;bpy.context.scene.render.resolution_y=512
    for light,loc in lights:
        light.location=loc
        light.rotation_euler=(Vector((0,0,.7))-light.location).to_track_quat('-Z','Y').to_euler()
    render(RUNTIME/'workstation.png')
    print('QUARTERMASTER_RENDER_COMPLETE',flush=True)


if __name__=='__main__':main()
