"""Derive runtime PNGs and inspect every rendered world asset with Pillow.

python3 game/scripts/world-assets/verify_world.py [--sample]
Samples stay in docs until the art direction is reviewed. Full mode writes only
the exact production paths declared in catalog.json. No source image is edited.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat

ROOT = Path(__file__).resolve().parents[3]
DOCS = ROOT / 'docs/assets/graphics-rollout/world'
CATALOG = json.loads((Path(__file__).parent/'catalog.json').read_text())
PARSER=argparse.ArgumentParser()
PARSER.add_argument('--sample',action='store_true')
PARSER.add_argument('--manifest-only',action='store_true')
PARSER.add_argument('--only',nargs='+')
ARGS=PARSER.parse_args()
SAMPLE_IDS={'facade-purifier','purifier-pump','mine-extractor'}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def seam_metrics(img):
    rgb=img.convert('RGB')
    w,h=rgb.size
    horizontal=ImageStat.Stat(ImageChops.difference(rgb.crop((0,0,1,h)),rgb.crop((w-1,0,w,h))))
    vertical=ImageStat.Stat(ImageChops.difference(rgb.crop((0,0,w,1)),rgb.crop((0,h-1,w,h))))
    inner_x=ImageStat.Stat(ImageChops.difference(rgb.crop((0,0,w-1,h)),rgb.crop((1,0,w,h))))
    inner_y=ImageStat.Stat(ImageChops.difference(rgb.crop((0,0,w,h-1)),rgb.crop((0,1,w,h))))
    values={k:round(sum(stat.mean)/3,3) for k,stat in [('wrapXMeanRgbDelta',horizontal),('wrapYMeanRgbDelta',vertical),('interiorXMeanRgbDelta',inner_x),('interiorYMeanRgbDelta',inner_y)]}
    values['reviewFlag']=any(values[f'wrap{axis}MeanRgbDelta']>max(8,values[f'interior{axis}MeanRgbDelta']*3) for axis in 'XY')
    return values


def derive(asset):
    source=DOCS/'renders'/f"{asset['id']}.png"
    img=Image.open(source).convert('RGBA')
    expected=(1024,1024) if asset['kind']=='prop' else (512,512)
    assert img.size==expected,(asset['id'],img.size,expected)
    bbox=img.getchannel('A').getbbox()
    assert bbox,asset['id']
    if asset['kind']=='prop':
        assert bbox[0]>0 and bbox[1]>0 and bbox[2]<img.width and bbox[3]<img.height,(asset['id'],'source silhouette clipped',bbox)
        crop=img.crop(bbox)
        ratio=min(488/crop.width,510/crop.height)
        crop=crop.resize((round(crop.width*ratio),round(crop.height*ratio)),Image.Resampling.LANCZOS)
        out=Image.new('RGBA',(512,512),(0,0,0,0))
        out.alpha_composite(crop,((512-crop.width)//2,512-crop.height))
        assert out.getchannel('A').getextrema()==(0,255),asset['id']
        assert out.getchannel('A').getbbox()[3]==512,asset['id']
    else:
        assert img.getchannel('A').getextrema()==(255,255),asset['id']
        out=img
    destination=(DOCS/'samples'/f"{asset['id']}.png") if ARGS.sample else ROOT/'game/public/sprites'/asset['path']
    destination.parent.mkdir(parents=True,exist_ok=True)
    out.save(destination,optimize=True)
    return {
        **asset,'runtimePath':'/sprites/'+asset['path'],
        'productionPath':'game/public/sprites/'+asset['path'],
        'sourcePath':str(source.relative_to(ROOT)),
        'width':512,'height':512,'alpha':'transparent' if asset['kind']=='prop' else 'opaque',
        'sourceWidth':img.width,'sourceHeight':img.height,'sourceAlphaBounds':bbox,
        'runtimeAlphaBounds':out.getchannel('A').getbbox(),
        'sourceBytes':source.stat().st_size,'sourceSha256':sha(source),
        'bytes':destination.stat().st_size,'sha256':sha(destination),
        'seamMetrics':seam_metrics(out) if asset['kind']=='tile' else None,
        'rawSourceSeamMetrics':seam_metrics(img) if asset['kind']=='tile' else None,
        'tileEdgeBlendPixels':0 if asset['kind']=='tile' else None,
        'status':'sample-rendered' if ARGS.sample else 'rendered-and-verified',
    },out


def sheets(entries):
    tiles=[(a,i) for a,i in entries if a['kind']=='tile']
    props=[(a,i) for a,i in entries if a['kind']=='prop']
    for group,name,cell in [(tiles,'materials',256),(props,'props',256)]:
        if not group:
            continue
        columns=4 if len(group)>4 else len(group)
        rows=(len(group)+columns-1)//columns
        sheet=Image.new('RGB',(columns*cell,rows*(cell+25)),(17,20,24))
        draw=ImageDraw.Draw(sheet)
        for index,(asset,img) in enumerate(group):
            x=index%columns*cell;y=index//columns*(cell+25)
            miniature=img.resize((cell,cell),Image.Resampling.LANCZOS)
            sheet.paste(miniature,(x,y),miniature)
            draw.text((x+5,y+cell+5),asset['id'],fill=(220,218,212))
        sheet.save(DOCS/(('sample-' if ARGS.sample else '')+name+'-contact.png'))
    if props:
        sheet=Image.new('RGB',(256,len(props)*156),(15,18,22))
        draw=ImageDraw.Draw(sheet)
        for index,(asset,img) in enumerate(props):
            y=index*156
            draw.rectangle((128,y,255,y+127),fill=(197,188,171))
            tiny=img.resize((128,128),Image.Resampling.LANCZOS)
            sheet.paste(tiny,(0,y),tiny);sheet.paste(tiny,(128,y),tiny)
            draw.text((5,y+132),asset['id'],fill=(222,219,213))
        sheet.save(DOCS/(('sample-' if ARGS.sample else '')+'props-dark-bright-128.png'))
    if tiles:
        d=DOCS/'tiling';d.mkdir(exist_ok=True)
        for asset,img in tiles:
            tile=img.convert('RGB').resize((256,256),Image.Resampling.LANCZOS)
            sheet=Image.new('RGB',(512,512))
            for x,y in [(0,0),(256,0),(0,256),(256,256)]:sheet.paste(tile,(x,y))
            sheet.save(d/f"{asset['id']}-2x2.png")


def main():
    if ARGS.manifest_only:
        records=[{**a,'runtimePath':'/sprites/'+a['path'],'productionPath':'game/public/sprites/'+a['path'],
                  'width':512,'height':512,'alpha':'transparent' if a['kind']=='prop' else 'opaque','status':'planned'} for a in CATALOG['assets']]
        entries=[]
    else:
        selected=[a for a in CATALOG['assets'] if (not ARGS.sample or a['id'] in SAMPLE_IDS) and (not ARGS.only or a['id'] in ARGS.only)]
        entries=[derive(a) for a in selected]
        records=[a for a,_ in entries]
        sheets(entries)
    result={
        'schemaVersion':1,'seed':CATALOG['seed'],'generator':'game/scripts/world-assets/render_world.py',
        'sourceBlend':'docs/assets/graphics-rollout/world/world-kit.blend',
        'provenance':'Original parameterized Blender geometry and procedural materials; no imported models, image textures, paid service or external runtime dependency.',
        'runtimeDimensions':[512,512],'sourceTileDimensions':[512,512],'sourcePropDimensions':[1024,1024],
        'assets':records,
    }
    blend=DOCS/'world-kit.blend'
    if ARGS.sample and not blend.exists():blend=DOCS/'world-kit-samples.blend'
    if blend.exists():
        result['sourceBlend']=str(blend.relative_to(ROOT))
        result['sourceBlendBytes']=blend.stat().st_size
        result['sourceBlendSha256']=sha(blend)
    result['generatorSha256']=sha(Path(__file__).parent/'render_world.py')
    result['catalogSha256']=sha(Path(__file__).parent/'catalog.json')
    path=DOCS/('sample-verification.json' if ARGS.sample else ('partial-verification.json' if ARGS.only else 'manifest.json'))
    path.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'manifest':str(path),'assets':len(records),'runtimeBytes':sum(a.get('bytes',0) for a in records)},indent=2))


if __name__=='__main__':main()
