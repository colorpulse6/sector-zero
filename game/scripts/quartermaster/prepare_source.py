"""Import the freely downloaded official Standard archive into a packed base .blend.

Only needed to reproduce the initial vendor import. The normal render path uses the
checked-in packed base and does not download or extract anything.
"""
import argparse
import hashlib
import json
import sys
import tempfile
import zipfile
from pathlib import Path

import bpy

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'docs/assets/quartermaster-motion/source'
parser=argparse.ArgumentParser()
parser.add_argument('--archive',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
archive=Path(args.archive)
OUT.mkdir(parents=True,exist_ok=True)
manifest={
    'author':'Quaternius',
    'pack':'Universal Base Characters Standard',
    'product_url':'https://quaternius.com/packs/universalbasecharacters.html',
    'download_page':'https://quaternius.itch.io/universal-base-characters',
    'download_date':'2026-09-06',
    'license':'CC0-1.0',
    'license_url':'https://creativecommons.org/publicdomain/zero/1.0/',
    'archive_bytes':archive.stat().st_size,
    'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
    'imported_files':[],
    'uri_repairs':'Two *_png.png normal-map URIs reference missing names; copied byte-identical corresponding .png files from the same archive.',
}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
with zipfile.ZipFile(archive) as z,tempfile.TemporaryDirectory(prefix='quartermaster-vendor-') as temp:
    for name,subdir,label in [
        ('Superhero_Male_FullBody','Base Characters/Godot - UE/',None),
        ('Hair_Buzzed','Hairstyles/Origin at 0/glTF (Godot)/','SOURCE_HAIR_BUZZED'),
        ('Hair_Beard','Hairstyles/Origin at 0/glTF (Godot)/','SOURCE_HAIR_BEARD'),
    ]:
        prefix='Universal Base Characters[Standard]/'+subdir
        doc=json.loads(z.read(prefix+name+'.gltf'))
        files=set([name+'.gltf']+[e['uri'] for e in doc['buffers']]+[e['uri'] for e in doc.get('images',[])])
        for f in sorted(files):
            key=prefix+f
            if key not in z.namelist():
                key=key.replace('_png.png','.png')
            if key not in z.namelist():
                key=next(n for n in z.namelist() if n.endswith('/'+f.replace('_png.png','.png')))
            data=z.read(key)
            (Path(temp)/f).write_bytes(data)
            manifest['imported_files'].append({'archive_path':key,'imported_name':f,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        before=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(Path(temp)/(name+'.gltf')))
        if label:
            mesh=next(o for o in set(bpy.data.objects)-before if o.type=='MESH')
            mesh.name=label
    for o in list(bpy.data.objects):
        if o.name.startswith('Icosphere'):bpy.data.objects.remove(o,do_unlink=True)
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'quartermaster-base.blend'),compress=True)
    license_text = z.read('Universal Base Characters[Standard]/License_Standard.txt').decode('utf-8')
    (OUT/'License_Standard.txt').write_text('\n'.join(line.rstrip() for line in license_text.splitlines()).rstrip() + '\n')
base=OUT/'quartermaster-base.blend'
manifest['packed_base']={'path':'source/quartermaster-base.blend','bytes':base.stat().st_size,'sha256':hashlib.sha256(base.read_bytes()).hexdigest()}
hero=ROOT/'docs/assets/pilot/quartermaster-hero-v1-alpha.png'
manifest['existing_hero_reference']={'path':str(hero.relative_to(ROOT)),'bytes':hero.stat().st_size,'sha256':hashlib.sha256(hero.read_bytes()).hexdigest(),'usage':'Rest-space UV color projection on real front-facing head and garment mesh; original pixels unchanged.'}
(OUT.parent/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
