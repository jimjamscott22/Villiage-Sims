(async () => {
  const { transport } = await import('/src/state/transport.ts');
  const terrain = await transport.getTerrain();
  const info = JSON.parse(window.render_game_to_text());
  const v = info.villagers[0];
  const tx = Math.floor(v.x / terrain.tileSize);
  const ty = Math.floor(v.y / terrain.tileSize);
  console.log('spawn', tx, ty, 'state', v.state, 'pos', v.x, v.y);
  // find a reachable goal
  let moved=false;
  for (const [dx,dy] of [[5,0],[-5,0],[0,5],[0,-5],[8,2],[-8,2],[10,0],[-10,0],[0,10]]) {
    try {
      await transport.moveVillagerTo(tx+dx, ty+dy);
      console.log('ordered move to', tx+dx, ty+dy);
      moved=true; break;
    } catch(e) { console.log('skip', tx+dx, ty+dy, String(e.message||e)); }
  }
  if (!moved) throw new Error('could not order any move');
  window.advanceTime(2500);
  const mid = JSON.parse(window.render_game_to_text()).villagers[0];
  console.log('mid', mid);
  window.advanceTime(8000);
  const end = JSON.parse(window.render_game_to_text()).villagers[0];
  console.log('end', end);

  // Second scenario: long walk then place hut on path
  const v2 = end;
  const t2x = Math.floor(v2.x / terrain.tileSize);
  const t2y = Math.floor(v2.y / terrain.tileSize);
  let target=null;
  for (const [dx,dy] of [[20,0],[-20,0],[0,20],[0,-20],[15,15]]) {
    try { await transport.moveVillagerTo(t2x+dx, t2y+dy); target=[t2x+dx,t2y+dy]; break; } catch {}
  }
  console.log('long target', target);
  window.advanceTime(800); // start walking
  // place hut near current heading — try several tiles between start and target
  const catalog = await transport.getCatalog();
  let placed=null;
  if (target) {
    const midX = Math.round((t2x+target[0])/2);
    const midY = Math.round((t2y+target[1])/2);
    for (const [x,y] of [[midX,midY],[midX+1,midY],[midX,midY+1],[t2x+3,t2y],[t2x,t2y+3]]) {
      try {
        const val = await transport.validatePlacement('hut', x, y, 0);
        if (!val.valid) continue;
        placed = await transport.placeBuilding('hut', x, y, 0);
        console.log('placed hut', x, y, placed);
        break;
      } catch (e) { console.log('place fail', x,y, e); }
    }
  }
  window.advanceTime(10000);
  const afterBlock = JSON.parse(window.render_game_to_text());
  console.log('afterBlock villagers', afterBlock.villagers[0], 'buildings', afterBlock.buildings);
})();
