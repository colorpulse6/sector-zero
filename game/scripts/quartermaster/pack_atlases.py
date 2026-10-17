"""Pack Blender's straight-alpha cells without resampling or changing colors.

Requires Pillow. The Blender script has no external Python dependencies.
"""
import hashlib
import json
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[3]
DOCS=ROOT/'docs/assets/quartermaster-motion'
RUNTIME=ROOT/'game/public/sprites/pilot/quartermaster'
FRAMES=Path(tempfile.gettempdir())/'sector-zero-quartermaster-frames'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    receipt={'cell':[128,256],'rows':['front','front-right','right','back-right','back','back-left','left','front-left'],'assets':{},'frames':{}}
    contact=Image.new('RGB',(1024,816),(18,22,25))
    draw=ImageDraw.Draw(contact)
    for clip,cols in [('idle',4),('walk',8),('work',8)]:
        atlas=Image.new('RGBA',(cols*128,8*256))
        records=[]
        for row in range(8):
            for col in range(cols):
                path=FRAMES/f'{clip}-{row}-{col}.png'
                with Image.open(path) as im:
                    assert im.size==(128,256),(path,im.size)
                    assert im.mode=='RGBA',(path,im.mode)
                    alpha=im.getchannel('A')
                    box=alpha.getbbox()
                    assert box and box[0]>0 and box[1]>0 and box[2]<128 and box[3]<256,(path,box)
                    assert alpha.getextrema()==(0,255),(path,alpha.getextrema())
                    # Copy raw pixels; no alpha compositing/premultiplication of atlas cells.
                    atlas.paste(im,(col*128,row*256))
                    records.append({'row':row,'column':col,'bounds':box,'sha256':sha(path)})
                    if col==0:
                        cy=['idle','walk','work'].index(clip)*272
                        contact.paste(im,(row*128,cy+16),im)
                        draw.text((row*128+5,cy+3),f'{clip} / {row}',fill=(180,188,191))
        target=RUNTIME/f'{clip}.png'
        atlas.save(target,optimize=True)
        receipt['assets'][target.name]={'dimensions':list(atlas.size),'bytes':target.stat().st_size,'sha256':sha(target)}
        receipt['frames'][clip]=records
    station=RUNTIME/'workstation.png'
    with Image.open(station) as im:
        assert im.mode=='RGBA' and max(im.size)<=512
        assert im.getchannel('A').getextrema()==(0,255)
        receipt['assets'][station.name]={'dimensions':list(im.size),'bytes':station.stat().st_size,'sha256':sha(station),'bounds':im.getchannel('A').getbbox()}
    receipt['runtime_total_bytes']=sum(a['bytes'] for a in receipt['assets'].values())
    receipt['source_blend_bytes']=(DOCS/'quartermaster-pilot.blend').stat().st_size
    receipt['source_blend_sha256']=sha(DOCS/'quartermaster-pilot.blend')
    (DOCS/'asset-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
    contact.save(DOCS/'direction-contact-sheet.png',optimize=True)
    # A small inspection animation; runtime animation uses the atlases directly.
    for clip,cols in [('walk',8),('work',8)]:
        views=[]
        for col in range(cols):
            frame=Image.new('RGB',(384,256),(18,22,25))
            for panel,row in enumerate([0,2,4]):
                im=Image.open(FRAMES/f'{clip}-{row}-{col}.png')
                frame.paste(im,(panel*128,0),im)
            views.append(frame)
        views[0].save(DOCS/f'{clip}-inspection.gif',save_all=True,append_images=views[1:],duration=110,loop=0)
    print(json.dumps({'assets':receipt['assets'],'runtime_total_bytes':receipt['runtime_total_bytes']},indent=2))


if __name__=='__main__':main()
