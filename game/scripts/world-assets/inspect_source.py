"""Run inside the completed Blender source to verify its editable asset census."""
import hashlib
import json
from pathlib import Path

import bpy

ROOT=Path(__file__).resolve().parents[3]
DOCS=ROOT/'docs/assets/graphics-rollout/world'
catalog=json.loads((Path(__file__).parent/'catalog.json').read_text())
records=[]
for asset in catalog['assets']:
    collection=bpy.data.collections.get(asset['id'])
    assert collection is not None,asset['id']
    assert collection.get('runtime_path')=='/sprites/'+asset['path'],asset['id']
    assert collection.get('source_resolution')==(1024 if asset['kind']=='prop' else 512),asset['id']
    meshes=[o for o in collection.objects if o.type=='MESH']
    curves=[o for o in collection.objects if o.type=='CURVE']
    assert len(meshes)>10,(asset['id'],len(meshes))
    records.append({'id':asset['id'],'meshes':len(meshes),'curves':len(curves),
                    'vertices':sum(len(o.data.vertices) for o in meshes),
                    'cameraLocation':list(collection['camera_location']),
                    'cameraRotationEuler':list(collection['camera_rotation_euler']),
                    'cameraOrthoScale':collection['camera_ortho_scale']})
external=[i.filepath for i in bpy.data.images if i.source=='FILE' and i.packed_file is None]
assert not external,external
path=Path(bpy.data.filepath)
receipt={'blenderVersion':bpy.app.version_string,'assets':records,'externalImageFiles':external,
         'sourcePath':str(path.relative_to(ROOT)),'sourceBytes':path.stat().st_size,
         'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
         'totalMeshes':sum(a['meshes'] for a in records),'totalVertices':sum(a['vertices'] for a in records),
         'status':'verified'}
(DOCS/'source-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('WORLD_SOURCE_VERIFIED',len(records),receipt['totalMeshes'],receipt['totalVertices'],receipt['sourceBytes'])
