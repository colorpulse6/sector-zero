"""Validate native Blender cells and pack without resampling or compositing.

python3 game/scripts/actors/pack_atlases.py --sample
python3 game/scripts/actors/pack_atlases.py
"""
import argparse
import hashlib
import json
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[3]
DOCS=ROOT/'docs/assets/actor-motion'
OUT=ROOT/'game/public/sprites/actors'
FRAMES=Path(tempfile.gettempdir())/'sector-zero-actor-frames'
NAMES=['voss','kael','reyes','survivor','scavenger','hub-bartender','hub-regular','hub-signal-chaser','hostile']
ROWS=['front','front-right','right','back-right','back','back-left','left','front-left']
parser=argparse.ArgumentParser();parser.add_argument('--sample',action='store_true');parser.add_argument('--actors',default=','.join(NAMES));args=parser.parse_args()


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def hostile_pose_sheet():
    poses=[('idle',0,0),('idle',2,0),('attack',0,2),('attack',2,2),('hurt',0,0),('death',0,0),('death',0,1),('death',0,3),('death',0,4),('death',0,5)]
    sheet=Image.new('RGB',(1280,568),(21,25,29));draw=ImageDraw.Draw(sheet)
    for i,(clip,row,col) in enumerate(poses):
        x=(i%5)*256;y=(i//5)*284
        draw.text((x+8,y+7),f'{clip} / {ROWS[row]} / frame {col}',fill=(210,218,221))
        with Image.open(FRAMES/'hostile'/f'{clip}-{row}-{col}.png') as frame:sheet.paste(frame,(x,y+26),frame)
    sheet.save(DOCS/'hostile-poses.png',optimize=True)


def sample():
    names=[n for n in args.actors.split(',') if (FRAMES/n/'idle-0-0.png').exists()]
    sheet=Image.new('RGB',(768,len(names)*540),(21,25,29));draw=ImageDraw.Draw(sheet)
    for index,name in enumerate(names):
        y=index*540;draw.text((12,y+8),name+' / reference / front / right profile',fill=(222,224,221))
        reference=ROOT/f'game/public/sprites/boarding/{"enemy-fp-front" if name=="hostile" else "npc-"+name}.png'
        with Image.open(reference) as ref:
            ref=ref.convert('RGBA');bbox=ref.getchannel('A').getbbox();ref=ref.crop(bbox);ref.thumbnail((235,490),Image.Resampling.LANCZOS)
            sheet.paste(ref,((256-ref.width)//2,y+34+(490-ref.height)//2),ref)
        for col,row in [(1,0),(2,2)]:
            with Image.open(FRAMES/name/f'idle-{row}-0.png') as frame:
                frame=frame.resize((frame.width*2,frame.height*2),Image.Resampling.NEAREST)
                if frame.width>256:frame.thumbnail((256,512),Image.Resampling.NEAREST)
                sheet.paste(frame,(col*256+(256-frame.width)//2,y+28+(512-frame.height)//2),frame)
    path=DOCS/'sample-identity-review.png';sheet.save(path,optimize=True);print(path)


def main():
    if args.sample:sample();return
    if 'hostile' in args.actors.split(','):hostile_pose_sheet()
    receipt={'version':1,'row_contract':ROWS,'actors':{},'sources':{},'runtime_total_bytes':0}
    overview=Image.new('RGB',(1024,len(NAMES)*284),(21,25,29));od=ImageDraw.Draw(overview)
    for actor in args.actors.split(','):
        hostile=actor=='hostile';cw=256 if hostile else 128;ch=256
        clips=[('idle',4,8),('walk',8,8)]+([('attack',4,8),('hurt',1,8),('death',6,1)] if hostile else [])
        actor_receipt={'cell':[cw,ch],'atlases':{},'frames':{},'total_bytes':0}
        for clip,cols,rows in clips:
            atlas=Image.new('RGBA',(cw*cols,ch*rows));records=[]
            for row in range(rows):
                for col in range(cols):
                    path=FRAMES/actor/f'{clip}-{row}-{col}.png'
                    with Image.open(path) as cell:
                        assert cell.mode=='RGBA' and cell.size==(cw,ch),(path,cell.mode,cell.size)
                        alpha=cell.getchannel('A');bounds=alpha.getbbox()
                        assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<cw and bounds[3]<ch,(path,'clipped',bounds)
                        assert alpha.getextrema()==(0,255),(path,'alpha extrema',alpha.getextrema())
                        atlas.paste(cell,(col*cw,row*ch))
                        records.append({'row':row,'column':col,'bounds':bounds,'sha256':sha(path)})
            target=OUT/actor/(clip+'.png');target.parent.mkdir(parents=True,exist_ok=True);atlas.save(target,optimize=True)
            actor_receipt['atlases'][clip]={'path':str(target.relative_to(ROOT/'game/public')),'columns':cols,'rows':rows,'dimensions':list(atlas.size),'bytes':target.stat().st_size,'sha256':sha(target)}
            actor_receipt['frames'][clip]=records;actor_receipt['total_bytes']+=target.stat().st_size
        # Contact sheet contains every direction at original source-cell size.
        contact=Image.new('RGB',(cw*8,284),(21,25,29));draw=ImageDraw.Draw(contact)
        for row in range(8):
            with Image.open(FRAMES/actor/f'idle-{row}-0.png') as frame:contact.paste(frame,(cw*row,26),frame)
            draw.text((cw*row+5,7),ROWS[row],fill=(190,200,205))
        contact.save(DOCS/(actor+'-directions.png'),optimize=True)
        for clip in (['walk','attack','death'] if hostile else ['walk']):
            cols=8 if clip=='walk' else (4 if clip=='attack' else 6);gif=[]
            for col in range(cols):
                panels=[0] if clip=='death' else [0,2,4]
                frame=Image.new('RGB',(cw*len(panels),ch),(21,25,29))
                for panel,row in enumerate(panels):
                    with Image.open(FRAMES/actor/f'{clip}-{row}-{col}.png') as cell:frame.paste(cell,(panel*cw,0),cell)
                gif.append(frame)
            gif[0].save(DOCS/f'{actor}-{clip}.gif',save_all=True,append_images=gif[1:],duration=110,loop=0)
        i=NAMES.index(actor);od.text((8,i*284+5),actor,fill=(215,222,225))
        for row in range(8):
            with Image.open(FRAMES/actor/f'idle-{row}-0.png') as frame:
                if hostile:frame=frame.resize((128,128),Image.Resampling.LANCZOS)
                overview.paste(frame,(128*row,i*284+26+(128 if hostile else 0)),frame)
        receipt['actors'][actor]=actor_receipt;receipt['runtime_total_bytes']+=actor_receipt['total_bytes']
    for name in ['voss-editable.blend','hostile-editable.blend']:
        p=DOCS/name
        receipt['sources'][name]={'bytes':p.stat().st_size,'sha256':sha(p)}
    overview.save(DOCS/'all-directions.png',optimize=True)
    (DOCS/'asset-manifest.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({'actors':len(receipt['actors']),'frames':sum(len(frames) for a in receipt['actors'].values() for frames in a['frames'].values()),'runtime_total_bytes':receipt['runtime_total_bytes']},indent=2))


if __name__=='__main__':main()
