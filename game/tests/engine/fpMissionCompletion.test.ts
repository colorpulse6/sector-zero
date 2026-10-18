import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSpecialMissionGameState, createGameState, updateGame } from '../../app/components/engine/gameEngine';
import { createKeplerBlackBoxFirstPersonState } from '../../app/components/engine/keplerBlackBoxMission';
import { createFirstPersonRuinTemplate, createFirstPersonWreckTemplate, createFirstPersonCanyonTemplate } from '../../app/components/colony/region/poiTemplates';
import { updateFirstPerson } from '../../app/components/engine/firstPersonEngine';
import { GameScreen, type FirstPersonState, type Keys } from '../../app/components/engine/types';
const NONE: Keys = {up:false,down:false,left:false,right:false,strafeLeft:false,strafeRight:false,shoot:false,bomb:false,jump:false};
const cases: [string,()=>FirstPersonState][] = [
 ['Kepler first clear',()=>createKeplerBlackBoxFirstPersonState(false)],
 ['Kepler replay',()=>createKeplerBlackBoxFirstPersonState(true)],
 ...[0,1,42,1001,0xffffffff].flatMap(seed => [
  [`Cinder Relay ${seed}`,()=>createFirstPersonRuinTemplate(seed)],
  [`Oathbreaker ${seed}`,()=>createFirstPersonWreckTemplate(seed)],
  [`Glassknife ${seed}`,()=>createFirstPersonCanyonTemplate(seed)],
 ] as [string,()=>FirstPersonState][]),
 ['campaign station',()=>{
  const game=createGameState(5,3);game.screen=GameScreen.PLAYING;game.levelCompleteTimer=1;
  return updateGame(game,NONE,null,null).firstPersonState!;
 }],
];
function routes(fp: FirstPersonState) {
 const start=[Math.floor(fp.posX),Math.floor(fp.posY)];
 const paths=new Map<string,number[][]>([[start.join(','),[start]]]);const queue=[start];
 for(let i=0;i<queue.length;i++) for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
  const [x,y]=queue[i],next=[x+dx,y+dy],key=next.join(',');
  if(paths.has(key)||!['floor','spawn','goal','door'].includes(fp.map.tiles[next[1]]?.[next[0]]))continue;
  paths.set(key,[...paths.get([x,y].join(','))!,next]);queue.push(next);
 }
 return paths;
}
for(const [name,make] of cases) {
 test(`${name}: reachable objective, safe placements, and real movement reaches completion`,()=>{
  const fp=make(),paths=routes(fp);
  assert.ok(fp.map.tiles.every(row=>row.length===fp.map.width),'rectangular map');
  for(const enemy of fp.enemies) assert.ok(paths.has([Math.floor(enemy.x),Math.floor(enemy.y)].join(',')),`enemy ${enemy.id} must be on reachable floor`);
  const goal=fp.objectivePickup ?? fp.map.tiles.flatMap((row,y)=>row.flatMap((tile,x)=>tile==='goal'?[{x:x+.5,y:y+.5}]:[]))[0];
  assert.ok(goal,'a first clear and replay must both have a completion target');
  const path=paths.get([Math.floor(goal.x),Math.floor(goal.y)].join(','));
  assert.ok(path,'completion target must connect to spawn');
  const game=createSpecialMissionGameState('kepler-black-box',false);game.screen=GameScreen.PLAYING;game.firstPersonState=fp;
  // Isolate navigation from combat; leave enemies and their collision positions intact.
  game.player.invincibleTimer=1e9;
  for(const [col,row] of path.slice(1)) {
   const x=col+.5,y=row+.5;
   for(let ticks=0;Math.hypot(x-fp.posX,y-fp.posY)>.035;ticks++) {
    assert.ok(ticks<100,`movement stuck approaching ${col},${row} from ${fp.posX},${fp.posY}`);
    const dx=x-fp.posX,dy=y-fp.posY,len=Math.hypot(dx,dy);
    fp.dirX=dx/len;fp.dirY=dy/len;fp.planeX=-fp.dirY*.66;fp.planeY=fp.dirX*.66;
    updateFirstPerson(game,{...NONE,up:true});
    if(game.levelCompleteTimer>0)break;
   }
   if(game.levelCompleteTimer>0)break;
  }
  if(fp.objectivePickup)updateFirstPerson(game,{...NONE,interact:true});
  assert.equal(fp.goalReached,true,'completion must fire through real engine logic');
  assert.ok(game.levelCompleteTimer>0);
  if(goal && name!=='Kepler replay' && name!=='campaign station')assert.equal(fp.objectiveCollected,true);
  // Exercise the actual end-of-mission transition too, without rewriting goalReached.
  for(let ticks=0;game.screen===GameScreen.PLAYING&&ticks<400;ticks++)Object.assign(game,updateGame(game,NONE,null,null));
  assert.equal(game.screen,GameScreen.LEVEL_COMPLETE);
 });
}
