"""Reopen retained sources and verify actual 3D geometry and keyed joints."""
import hashlib
import json
import tempfile
from array import array
from pathlib import Path

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
DOCS=ROOT/'docs/assets/actor-motion'
report={}
for actor in ['voss','hostile']:
    path=DOCS/(actor+'-editable.blend')
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    action=rig.animation_data.action
    assert action and len(action.fcurves)>50
    assert len(rig.data.bones)>10
    external=[im.filepath for im in bpy.data.images if im.source=='FILE' and not im.packed_file]
    assert not external,external
    clips={}
    frames=[1,2,11,13,15,17]+([21,22,23,31,41,46] if actor=='hostile' else [])
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        depsgraph=bpy.context.evaluated_depsgraph_get()
        points=[]
        for ob in bpy.data.objects:
            if ob.type=='MESH':
                evaluated=ob.evaluated_get(depsgraph)
                points.extend(evaluated.matrix_world@Vector(p) for p in evaluated.bound_box)
        bounds=[[round(min(p[i] for p in points),5),round(max(p[i] for p in points),5)] for i in range(3)]
        assert all(hi-lo>.1 for lo,hi in bounds),(actor,frame,bounds)
        joints={name:[round(v,6) for v in rig.pose.bones[name].matrix.translation] for name in (['hand_l','hand_r','calf_l','calf_r'] if actor=='voss' else ['head','arm_l','forearm_l','thigh_l','calf_l'])}
        rotations={name:[round(v,6) for row in rig.pose.bones[name].matrix.to_3x3() for v in row] for name in joints}
        clips[str(frame)]={'world_bounds':bounds,'joints':joints,'joint_rotations':rotations}
        if actor=='hostile':
            centers={}
            for ob in bpy.data.objects:
                if ob.name.startswith(('Curved finger talon','Angular horned skull')):
                    evaluated=ob.evaluated_get(depsgraph)
                    center=sum((evaluated.matrix_world@Vector(p) for p in evaluated.bound_box),Vector())/8
                    centers[ob.name]=[round(v,6) for v in center]
            clips[str(frame)]['anatomy_world_centers']=centers
    assert clips['11']!=clips['13'],(actor,'walk poses identical')
    if actor=='hostile':
        assert clips['21']!=clips['23']
        assert clips['1']!=clips['31']
        assert clips['41']!=clips['46']
        rest=clips['1']['anatomy_world_centers'];strike=clips['23']['anatomy_world_centers'];hurt=clips['31']['anatomy_world_centers']
        advances={name:round(rest[name][1]-strike[name][1],6) for name in rest if name.startswith('Curved finger talon')}
        recoil=round(hurt['Angular horned skull'][1]-rest['Angular horned skull'][1],6)
        assert all(distance>.25 for distance in advances.values()),('claws must advance toward actor front -Y',advances)
        assert recoil>.15,('hurt skull must recoil away from front toward +Y',recoil)
    scene=bpy.context.scene
    replay_clip='attack' if actor=='hostile' else 'idle'
    replay_column=2 if actor=='hostile' else 0
    scene.frame_set(23 if actor=='hostile' else 1)
    if actor=='hostile':
        scene.camera.location=Vector((0,-6,1.05))
        scene.camera.rotation_euler=(Vector((0,0,1.05))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    replay=Path(tempfile.gettempdir())/f'sector-zero-{actor}-source-replay.png'
    scene.render.filepath=str(replay)
    bpy.ops.render.render(write_still=True)
    rendered=bpy.data.images.load(str(replay),check_existing=False)
    atlas=bpy.data.images.load(str(ROOT/f'game/public/sprites/actors/{actor}/{replay_clip}.png'),check_existing=False)
    width,height=rendered.size
    atlas_pixels=tuple(atlas.pixels)
    cell=[]
    # Blender image pixels begin at the bottom; atlas row zero is the top cell.
    for y in range(height):
        start=((atlas.size[1]-height+y)*atlas.size[0]+replay_column*width)*4
        cell.extend(atlas_pixels[start:start+width*4])
    rendered_pixels=tuple(rendered.pixels)
    assert tuple(cell)==rendered_pixels,(actor,replay_clip,'retained source does not reproduce shipped front pixels')
    report[actor]={'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'blender_version':bpy.app.version_string,'bones':len(rig.data.bones),'fcurves':len(action.fcurves),'external_unpacked_images':external,'poses':clips,'replay_front':str(replay),'replay_pixels_identical':True,'replay_float_pixels_sha256':hashlib.sha256(array('f',rendered_pixels).tobytes()).hexdigest(),'render_settings':{'engine':scene.render.engine,'samples':scene.cycles.samples,'seed':scene.cycles.seed,'animated_seed':scene.cycles.use_animated_seed}}
    report[actor]['replay_clip']=replay_clip;report[actor]['replay_column']=replay_column
    if actor=='hostile':report[actor]['strike_recoil_evidence']={'actor_front':'-Y','claw_advance_toward_front':advances,'hurt_skull_recoil_toward_positive_y':recoil}
(DOCS/'reopened-source-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('ACTOR_SOURCES_VERIFIED',','.join(report),flush=True)
