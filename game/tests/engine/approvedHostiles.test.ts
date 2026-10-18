import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvedHostilePresentation, APPROVED_HOSTILES } from '../../app/components/engine/approvedHostiles';
import type { FPEnemy } from '../../app/components/engine/types';
const enemy=(type:FPEnemy['type'],action='idle',clockMs=0,deathTimer=0)=>({type,deathTimer,atlasAnimation:{action,clockMs,walkDistance:.3}} as FPEnemy);
test('approved types preserve source aspect, measured feet and distinct identities',()=>{
 const paths=new Set<string>();
 for(const type of ['grunt','charger','sentry'] as const){
  const source=APPROVED_HOSTILES[type],look=approvedHostilePresentation(enemy(type));paths.add(source.path);
  assert.equal(look.widthFactor,source.width/source.height);
  assert.equal(look.groundLine,source.footRow/source.height);
  assert.ok(look.groundLine>.95&&look.groundLine<=1);
 }
 assert.equal(paths.size,3);
});
test('walk, attack, hurt and death have deterministic visible feedback without changing combat state',()=>{
 for(const type of ['grunt','charger','sentry'] as const){
  const idle=approvedHostilePresentation(enemy(type));
  for(const e of [enemy(type,'walk'),enemy(type,'attack',180),enemy(type,'hurt',70),enemy(type,'death',200,18)]){
   const before=JSON.stringify(e),pose=approvedHostilePresentation(e);
   assert.notEqual(pose.scale,idle.scale,e.atlasAnimation!.action);
   assert.equal(JSON.stringify(e),before,'rendering cannot mutate simulation');
   assert.ok(pose.scale>0&&pose.widthFactor>0);
   assert.ok(Math.abs(pose.scale*pose.widthFactor-idle.scale*idle.widthFactor)<1e-9,'vertical motion preserves width');
  }
  const early=approvedHostilePresentation(enemy(type,'death',30,28)),late=approvedHostilePresentation(enemy(type,'death',450,3));
  assert.ok(late.scale<early.scale,'death collapses toward the ground');
 }
});
