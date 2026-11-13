(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mapCanvas = document.getElementById('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  const W = 2500, H = 2500, sx = 0.78, sy = 0.40;
  const $ = id => document.getElementById(id);
  let width = 0, height = 0, dpr = 1, last = 0, gameTime = 0, audioCtx = null;
  let camera = {x: 0, y: 0};
  const keys = new Set();
  const player = {x: 1160, y: 1190, vx: 0, vy: 0, faceX: 1, faceY: 0, health: 100, stamina: 100, attack: 0, attackCooldown: 0, dodge: 0, invuln: 0, hurt: 0, moving: false};
  let enemies = [], particles = [], props = [], flowers = [], drops = [], kills = 0, defeated = false, tipDismissed = false, toastTimer = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(117);
  const project = (x, y) => ({x: (x - camera.x - y + camera.y) * sx + width / 2, y: (x - camera.x + y - camera.y) * sy + height * .56});
  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); width = innerWidth; height = innerHeight; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); canvas.style.width = width + 'px'; canvas.style.height = height + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  window.addEventListener('resize', resize); resize();

  // A hand-placed trail, pond, and camps give the valley a little geography.
  const trail = [[600,1710],[780,1570],[930,1490],[1050,1370],[1240,1310],[1390,1190],[1540,1080],[1660,940],[1850,820],[2050,790]];
  const pond = [[500,700],[760,650],[915,760],[890,940],[720,1010],[535,915],[455,800]];
  const camps = [[1510,900],[1930,1260],[1000,780]];
  const campCenters = [[1530,940],[1915,1220],[1010,800]];
  const enemySpawns = [[1480,930],[1575,895],[1535,1020],[1880,1210],[1975,1260],[1900,1330],[960,760],[1045,835]];
  function addEnemy(x, y, i) { enemies.push({x,y,hp:36,maxHp:36,face:Math.atan2(player.y-y,player.x-x),state:'idle',timer:rand()*1.5,attack:0,hit:0,dead:0,id:i, speed:48+rand()*12, type:i%3}); }
  enemySpawns.forEach((p,i)=>addEnemy(...p,i));

  for (let i=0;i<78;i++) {
    const x=150+rand()*2200,y=180+rand()*2150;
    if (Math.hypot(x-1160,y-1190)<180 || Math.hypot(x-700,y-830)<260) continue;
    const r=rand(); props.push({x,y,kind:r<.46?'tree':r<.69?'pine':r<.86?'rock':'bush',size:.65+rand()*.75,seed:rand()});
  }
  for(let i=0;i<185;i++) flowers.push({x:rand()*W,y:rand()*H,c:Math.floor(rand()*4),s:1+rand()*1.4});
  const flowerColors=['#fff2bb','#f4e3e7','#f2ca75','#e9d8a4'];

  function path(points, close=false) { const p=points.map(v=>project(v[0],v[1])); ctx.beginPath(); if(!p.length)return; ctx.moveTo(p[0].x,p[0].y); for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y); if(close)ctx.closePath(); }
  function linePath(points) { path(points); }
  function drawTerrain() {
    const sky=ctx.createLinearGradient(0,0,0,height); sky.addColorStop(0,'#9fc2b0');sky.addColorStop(.25,'#b9d1ab');sky.addColorStop(1,'#9eb97e');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    // Rolling distant ridges
    ctx.fillStyle='rgba(87,130,111,.35)';ctx.beginPath();ctx.moveTo(0,height*.25);ctx.lineTo(0,height*.14);ctx.lineTo(width*.08,height*.10);ctx.lineTo(width*.16,height*.18);ctx.lineTo(width*.26,height*.08);ctx.lineTo(width*.37,height*.17);ctx.lineTo(width*.48,height*.09);ctx.lineTo(width*.61,height*.16);ctx.lineTo(width*.72,height*.07);ctx.lineTo(width*.83,height*.16);ctx.lineTo(width*.94,height*.08);ctx.lineTo(width,height*.15);ctx.lineTo(width,height*.28);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(225,232,189,.16)';ctx.beginPath();ctx.moveTo(0,height*.22);ctx.lineTo(width*.12,height*.13);ctx.lineTo(width*.18,height*.2);ctx.lineTo(width*.27,height*.12);ctx.lineTo(width*.36,height*.22);ctx.lineTo(width*.46,height*.14);ctx.lineTo(width*.55,height*.22);ctx.lineTo(width*.64,height*.13);ctx.lineTo(width*.76,height*.22);ctx.lineTo(width*.86,height*.13);ctx.lineTo(width,height*.21);ctx.lineTo(width,height*.28);ctx.lineTo(0,height*.28);ctx.closePath();ctx.fill();
    // Small valley floor breaks beyond the camera edge.
    const corners=[[0,0],[W,0],[W,H],[0,H]].map(p=>project(...p));ctx.fillStyle='#9fbd7e';ctx.beginPath();ctx.moveTo(corners[0].x,corners[0].y);corners.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();
    // Soft, painterly meadow patches
    for(let i=0;i<35;i++) { const x=(i*673+210)%W,y=(i*419+100)%H,p=project(x,y);ctx.fillStyle=i%2?'rgba(207,215,145,.17)':'rgba(72,131,89,.1)';ctx.beginPath();ctx.ellipse(p.x,p.y,110+((i*37)%95),35+((i*13)%32),-.35,0,Math.PI*2);ctx.fill(); }
    // Trail ribbon
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';linePath(trail);ctx.strokeStyle='rgba(109,91,61,.19)';ctx.lineWidth=44;ctx.stroke();linePath(trail);ctx.strokeStyle='#c9b68a';ctx.lineWidth=33;ctx.stroke();linePath(trail);ctx.strokeStyle='rgba(235,219,174,.65)';ctx.lineWidth=21;ctx.stroke();
    // Shore and water
    path(pond,true);ctx.fillStyle='rgba(88,113,77,.18)';ctx.fill();path(pond,true);ctx.fillStyle='#6fa7a2';ctx.fill();ctx.strokeStyle='rgba(223,221,167,.73)';ctx.lineWidth=6;ctx.stroke();
    const pp=project(660,810);ctx.fillStyle='rgba(218,237,197,.42)';ctx.beginPath();ctx.ellipse(pp.x,pp.y,76,23,-.27,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(249,250,220,.55)';ctx.beginPath();ctx.ellipse(pp.x+20,pp.y-4,27,6,-.27,0,Math.PI*2);ctx.fill();ctx.restore();
    // tiny warm flowers, clustered away from the trails
    for(const f of flowers){if(Math.abs(f.x-camera.x)+Math.abs(f.y-camera.y)>1700)continue;const p=project(f.x,f.y);if(p.x<0||p.x>width||p.y<0||p.y>height)continue;ctx.fillStyle=flowerColors[f.c];ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(p.x,p.y,f.s,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    drawCamps();
  }
  function drawCamps() {
    for(let i=0;i<campCenters.length;i++) {const [x,y]=campCenters[i],p=project(x,y);ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(93,67,44,.12)';ctx.beginPath();ctx.ellipse(0,0,92,28,0,0,Math.PI*2);ctx.fill();
      // cookfire stones and orange glow
      ctx.fillStyle='rgba(245,148,74,.12)';ctx.beginPath();ctx.arc(0,-5,28,0,Math.PI*2);ctx.fill();ctx.fillStyle='#635b47';for(let j=0;j<7;j++){const a=j*Math.PI*2/7;ctx.beginPath();ctx.ellipse(Math.cos(a)*15,Math.sin(a)*7-3,4,2,0,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#f6a14e';ctx.beginPath();ctx.moveTo(-2,-4);ctx.quadraticCurveTo(-9,-17,0,-23);ctx.quadraticCurveTo(10,-11,3,-4);ctx.fill();ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.ellipse(0,-7,3,7,0,0,Math.PI*2);ctx.fill();
      // crude hide shelter
      ctx.fillStyle='#806547';ctx.beginPath();ctx.moveTo(37,-2);ctx.lineTo(53,-29);ctx.lineTo(72,-2);ctx.closePath();ctx.fill();ctx.fillStyle='#b59461';ctx.beginPath();ctx.moveTo(31,-3);ctx.lineTo(54,-37);ctx.lineTo(77,-3);ctx.closePath();ctx.fill();ctx.fillStyle='#554b3b';ctx.beginPath();ctx.moveTo(48,-4);ctx.lineTo(54,-23);ctx.lineTo(61,-4);ctx.fill();ctx.restore();
    }
  }
  function drawTree(o) {
    const p=project(o.x,o.y),s=o.size; if(p.x<-100||p.x>width+100||p.y<-150||p.y>height+150)return;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
    ctx.fillStyle='rgba(34,65,41,.19)';ctx.beginPath();ctx.ellipse(3,0,31,11,-.16,0,Math.PI*2);ctx.fill();
    if(o.kind==='tree') {ctx.fillStyle='#705943';ctx.beginPath();ctx.moveTo(-4,-5);ctx.lineTo(-2,-50);ctx.lineTo(7,-53);ctx.lineTo(8,-5);ctx.fill();ctx.fillStyle='#477550';ctx.beginPath();ctx.ellipse(0,-57,27,35,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6c9a67';ctx.beginPath();ctx.ellipse(-10,-65,15,20,-.35,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(193,204,137,.55)';ctx.beginPath();ctx.ellipse(-11,-73,8,7,-.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3e694a';ctx.beginPath();ctx.ellipse(12,-52,17,24,.4,0,Math.PI*2);ctx.fill();}
    else if(o.kind==='pine'){ctx.fillStyle='#50634a';ctx.beginPath();ctx.moveTo(0,-84);ctx.lineTo(-24,-29);ctx.lineTo(-11,-32);ctx.lineTo(-29,-8);ctx.lineTo(26,-8);ctx.lineTo(11,-33);ctx.lineTo(24,-29);ctx.closePath();ctx.fill();ctx.fillStyle='#708c5b';ctx.beginPath();ctx.moveTo(-2,-80);ctx.lineTo(-20,-35);ctx.lineTo(2,-42);ctx.closePath();ctx.fill();}
    else if(o.kind==='rock'){ctx.fillStyle='#777b69';ctx.beginPath();ctx.moveTo(-23,-3);ctx.lineTo(-17,-18);ctx.lineTo(-4,-26);ctx.lineTo(16,-19);ctx.lineTo(24,-4);ctx.closePath();ctx.fill();ctx.fillStyle='#9fa28a';ctx.beginPath();ctx.moveTo(-17,-18);ctx.lineTo(-4,-26);ctx.lineTo(6,-18);ctx.lineTo(-4,-11);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(236,226,194,.45)';ctx.beginPath();ctx.moveTo(-16,-17);ctx.lineTo(-4,-25);ctx.lineTo(1,-21);ctx.lineTo(-9,-16);ctx.closePath();ctx.fill();}
    else {ctx.fillStyle='#548154';ctx.beginPath();ctx.ellipse(-9,-8,17,14,0,0,Math.PI*2);ctx.ellipse(8,-9,16,13,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a5ae69';ctx.beginPath();ctx.arc(-7,-16,3,0,Math.PI*2);ctx.arc(11,-13,2.5,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  function drawEnemy(e) {
    const p=project(e.x,e.y); if(p.x<-70||p.x>width+70||p.y<-70||p.y>height+60)return;
    const phase=e.state==='windup'?1+Math.sin(gameTime*18)*.06:1;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(e.hit?Math.sin(gameTime*42)*.12:0);ctx.scale(phase,1);
    ctx.fillStyle='rgba(31,43,29,.26)';ctx.beginPath();ctx.ellipse(0,2,17,7,0,0,Math.PI*2);ctx.fill();
    if(e.state==='windup'){ctx.strokeStyle='rgba(248,191,91,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-13,25,-.6,Math.PI*1.35);ctx.stroke();}
    const green=e.type===1?'#8b9b52':e.type===2?'#5c8e66':'#74a34f';
    ctx.fillStyle='#4c4737';ctx.fillRect(-10,-14,7,14);ctx.fillRect(3,-14,7,14);ctx.fillStyle='#72503c';ctx.fillRect(-11,-3,9,4);ctx.fillRect(2,-3,9,4);
    ctx.fillStyle=e.hit?'#dca16b':green;ctx.beginPath();ctx.ellipse(0,-23,14,17,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#b3c074';ctx.beginPath();ctx.moveTo(-13,-34);ctx.lineTo(-12,-44);ctx.lineTo(-4,-37);ctx.lineTo(0,-45);ctx.lineTo(5,-36);ctx.lineTo(14,-40);ctx.lineTo(12,-28);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ead48b';ctx.beginPath();ctx.arc(-5,-24,2.7,0,Math.PI*2);ctx.arc(5,-24,2.7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#312f27';ctx.beginPath();ctx.arc(-5,-24,1.2,0,Math.PI*2);ctx.arc(5,-24,1.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#79583d';ctx.fillRect(-5,-10,10,5);ctx.strokeStyle='#554431';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(13,-22);ctx.lineTo(24,-10);ctx.stroke();ctx.fillStyle='#c3ae7b';ctx.beginPath();ctx.moveTo(20,-12);ctx.lineTo(25,-9);ctx.lineTo(21,-5);ctx.closePath();ctx.fill();
    // Health pip
    ctx.fillStyle='rgba(30,35,27,.56)';ctx.fillRect(-15,-53,30,4);ctx.fillStyle='#da7660';ctx.fillRect(-15,-53,30*Math.max(0,e.hp/e.maxHp),4);ctx.restore();
  }
  function drawPlayer() {
    const p=project(player.x,player.y);ctx.save();ctx.translate(p.x,p.y);
    const step=player.moving?Math.sin(gameTime*14)*2.5:0;
    ctx.fillStyle='rgba(31,49,38,.27)';ctx.beginPath();ctx.ellipse(0,1,16,7,0,0,Math.PI*2);ctx.fill();
    if(player.dodge>0){ctx.globalAlpha=.35+Math.sin(gameTime*45)*.15;ctx.strokeStyle='#eff0c8';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(-13,0,17,5,-.4,0,Math.PI*2);ctx.stroke();}
    ctx.translate(0,step);
    // boots and legs
    ctx.fillStyle='#443d32';ctx.fillRect(-8,-14,6,14);ctx.fillRect(3,-14,6,14);ctx.fillStyle='#705842';ctx.fillRect(-10,-3,9,4);ctx.fillRect(2,-3,9,4);
    // green travel cloak
    ctx.fillStyle=player.hurt>0?'#d99368':'#496c4d';ctx.beginPath();ctx.moveTo(-11,-37);ctx.quadraticCurveTo(-20,-23,-13,-10);ctx.lineTo(12,-10);ctx.quadraticCurveTo(18,-27,10,-37);ctx.closePath();ctx.fill();ctx.fillStyle='#779261';ctx.beginPath();ctx.moveTo(-10,-35);ctx.lineTo(0,-32);ctx.lineTo(-4,-12);ctx.lineTo(-13,-13);ctx.closePath();ctx.fill();
    // head and hair
    ctx.fillStyle='#d9ad7e';ctx.beginPath();ctx.arc(0,-42,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b18456';ctx.beginPath();ctx.arc(-1,-47,10,Math.PI,Math.PI*2);ctx.lineTo(8,-40);ctx.lineTo(-7,-40);ctx.closePath();ctx.fill();
    // belt
    ctx.fillStyle='#c5aa70';ctx.fillRect(-12,-18,24,3);ctx.fillStyle='#f0d98a';ctx.fillRect(-2,-19,4,5);
    // sword swing arc and blade
    const attacking=player.attack>0;let a=Math.atan2(player.faceY,player.faceX);
    if(attacking){const t=1-player.attack/.28;ctx.save();ctx.rotate(a);ctx.strokeStyle=`rgba(235,245,219,${Math.sin(t*Math.PI)*.82})`;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-25,43,-1.2+t*1.5,.4+t*1.5);ctx.stroke();ctx.restore();}
    ctx.save();ctx.rotate(a);ctx.strokeStyle='#403b32';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(7,-25);ctx.lineTo(20,-19);ctx.stroke();ctx.strokeStyle='#d9ded0';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(19,-19);ctx.lineTo(35,-12);ctx.stroke();ctx.strokeStyle='#fff7d9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(21,-20);ctx.lineTo(34,-13);ctx.stroke();ctx.restore();
    if(player.invuln>0){ctx.globalAlpha=.4;ctx.strokeStyle='#fff1bc';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,-20,22,29,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }

  function burst(x,y,color,count=9) { for(let i=0;i<count;i++){const a=rand()*Math.PI*2,s=20+rand()*105;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-25,life:.25+rand()*.45,max:.7,color,size:1.5+rand()*3});} }
  function playSound(kind) { if(!$('sound-button').classList.contains('muted')) { try { audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type=kind==='hit'?'triangle':'sine';o.frequency.setValueAtTime(kind==='hit'?180:kind==='hurt'?110:360,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(kind==='hit'?90:kind==='hurt'?65:220,audioCtx.currentTime+.12);g.gain.setValueAtTime(.055,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.13);o.start();o.stop(audioCtx.currentTime+.14);}catch(_){} } }
  function showToast(text) { const el=$('toast');el.textContent=text;el.classList.add('show');toastTimer=2.2; }
  function attack() {
    if(player.attackCooldown>0||player.health<=0||defeated)return;
    player.attack=.28;player.attackCooldown=.42;playSound('swing');
    // Soft lock the swing onto the nearest raider in reach so keyboard and touch combat feel reliable.
    const nearby=enemies.map(e=>({e,d:Math.hypot(e.x-player.x,e.y-player.y)})).filter(x=>x.e.hp>0&&x.e.dead<=0&&x.d<150).sort((a,b)=>a.d-b.d);
    if(nearby.length){const target=nearby[0].e,dx=target.x-player.x,dy=target.y-player.y,d=nearby[0].d||1;player.faceX=dx/d;player.faceY=dy/d;}
    const candidates=enemies.filter(e=>e.hp>0&&e.dead<=0).map(e=>({e,d:Math.hypot(e.x-player.x,e.y-player.y),a:(e.x-player.x)*player.faceX+(e.y-player.y)*player.faceY})).filter(x=>x.d<112&&x.a>0).sort((a,b)=>a.d-b.d).slice(0,2);
    if(candidates.length){for(const {e} of candidates){e.hp-=24;e.hit=.22;e.state='stagger';e.timer=.38;const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy)||1;e.x+=dx/d*15;e.y+=dy/d*15;burst(e.x,e.y-25,'#f8dd9a',8);playSound('hit');if(e.hp<=0){e.dead=.72;e.state='dead';kills++;$('quest-count').textContent=`${kills} / 8`;$('objective-progress').textContent=`${kills}/8`;drops.push({x:e.x,y:e.y,life:8});if(kills===8){defeated=true;setTimeout(()=>endGame(true),1100)}else if(kills===1||kills===4)showToast(kills===1?'First raider down. Keep going!':'Half the camp has scattered.');}}
    } else {burst(player.x+player.faceX*48,player.y+player.faceY*48-20,'#fff0bf',3);}
  }
  function dodge() { if(player.stamina<26||player.dodge>0||player.health<=0)return;player.stamina-=26;player.dodge=.42;player.invuln=.48;const speed=340;if(!player.moving){player.vx=player.faceX*speed;player.vy=player.faceY*speed;} }
  function damagePlayer(amount) { if(player.invuln>0||player.health<=0)return;player.health=Math.max(0,player.health-amount);player.hurt=.32;player.invuln=.58;player.stamina=Math.max(0,player.stamina-6);playSound('hurt');$('screen-flash').classList.add('hit');setTimeout(()=>$('screen-flash').classList.remove('hit'),120);burst(player.x,player.y-28,'#e58c6b',7);if(player.health===0)setTimeout(()=>endGame(false),650); }
  function update(dt) {
    gameTime+=dt;player.attack=Math.max(0,player.attack-dt);player.attackCooldown=Math.max(0,player.attackCooldown-dt);player.dodge=Math.max(0,player.dodge-dt);player.invuln=Math.max(0,player.invuln-dt);player.hurt=Math.max(0,player.hurt-dt);toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');
    let ix=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),iy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(Math.hypot(touchX,touchY)>.12){ix=touchX;iy=touchY;}const inputLength=Math.hypot(ix,iy);player.moving=inputLength>.08;
    // Convert intuitive screen-space input into the valley's isometric world axes.
    let wx=ix/sx+iy/sy,wy=iy/sy-ix/sx;const worldLength=Math.hypot(wx,wy)||1;wx/=worldLength;wy/=worldLength;
    const speed=player.dodge>0?340:keys.has('shift')?150:190;
    if(player.moving){player.vx=wx*speed;player.vy=wy*speed;if(player.dodge<=0){player.faceX=wx;player.faceY=wy;}}
    else if(player.dodge<=0){player.vx*=Math.pow(.001,dt);player.vy*=Math.pow(.001,dt);}
    player.x=clamp(player.x+player.vx*dt,80,W-80);player.y=clamp(player.y+player.vy*dt,80,H-80);
    if(keys.has('shift')&&player.moving&&player.stamina>28&&player.dodge<=0)dodge();
    player.stamina=clamp(player.stamina+(player.dodge>0?-0:16)*dt,0,100);
    camera.x+=(player.x-camera.x)*Math.min(1,dt*4);camera.y+=(player.y-camera.y)*Math.min(1,dt*4);
    for(const e of enemies){if(e.hp<=0){e.dead=Math.max(0,e.dead-dt);continue;}e.hit=Math.max(0,e.hit-dt);const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;e.face=Math.atan2(dy,dx);
      if(e.state==='stagger'){e.timer-=dt;if(e.timer<=0)e.state='chase';continue;}
      if(d<48){if(e.state!=='windup'){e.state='windup';e.timer=.67;}else {e.timer-=dt;if(e.timer<=0){if(player.invuln<=0)damagePlayer(11);e.state='recover';e.timer=.78;}}}
      else if(e.state==='recover'){e.timer-=dt;if(e.timer<=0)e.state='chase';}
      else {e.state=d<230?'chase':'idle';if(d<230){e.x+=dx/d*e.speed*dt;e.y+=dy/d*e.speed*dt;}else{e.timer-=dt;if(e.timer<0){e.timer=1+rand()*2;e.x+=Math.cos(rand()*6.28)*8;e.y+=Math.sin(rand()*6.28)*8;}}}
    }
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=130*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
    for(const d of drops)d.life-=dt;drops=drops.filter(d=>d.life>0);
    if(player.health<=0)return;
  }
  function drawParticles(){for(const p of particles){const q=project(p.x,p.y);ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(q.x,q.y,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;for(const d of drops){const p=project(d.x,d.y);ctx.globalAlpha=.7+.3*Math.sin(gameTime*6);ctx.fillStyle='#edcf76';ctx.beginPath();ctx.arc(p.x,p.y-7+Math.sin(gameTime*4)*3,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff0bb';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y-7+Math.sin(gameTime*4)*3,9,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;}
  function drawMinimap(){const w=mapCanvas.width,h=mapCanvas.height;mapCtx.clearRect(0,0,w,h);mapCtx.fillStyle='#a5bd83';mapCtx.fillRect(0,0,w,h);mapCtx.fillStyle='#89b2a1';mapCtx.beginPath();mapCtx.ellipse(31,35,20,13,-.25,0,Math.PI*2);mapCtx.fill();mapCtx.strokeStyle='rgba(227,211,167,.8)';mapCtx.lineWidth=4;mapCtx.beginPath();mapCtx.moveTo(29,76);mapCtx.lineTo(42,65);mapCtx.lineTo(53,58);mapCtx.lineTo(66,48);mapCtx.lineTo(80,42);mapCtx.lineTo(91,32);mapCtx.lineTo(108,20);mapCtx.stroke();mapCtx.fillStyle='#e7d9b2';mapCtx.strokeStyle='rgba(64,68,48,.25)';for(const [x,y] of campCenters){const mx=x/W*w,my=y/H*h;mapCtx.beginPath();mapCtx.arc(mx,my,5,0,Math.PI*2);mapCtx.fill();mapCtx.stroke();}for(const e of enemies.filter(e=>e.hp>0)){mapCtx.fillStyle='#bd6350';mapCtx.beginPath();mapCtx.arc(e.x/W*w,e.y/H*h,2,0,Math.PI*2);mapCtx.fill();}mapCtx.fillStyle='#fff2bc';mapCtx.strokeStyle='#315548';mapCtx.lineWidth=2;mapCtx.beginPath();mapCtx.arc(player.x/W*w,player.y/H*h,4,0,Math.PI*2);mapCtx.fill();mapCtx.stroke();}
  function render(){ctx.clearRect(0,0,width,height);drawTerrain();const ordered=[];for(const o of props)ordered.push({d:o.x+o.y,fn:()=>drawTree(o)});for(const e of enemies)if(e.hp>0)ordered.push({d:e.x+e.y,fn:()=>drawEnemy(e)});ordered.push({d:player.x+player.y,fn:drawPlayer});ordered.sort((a,b)=>a.d-b.d);for(const o of ordered)o.fn();drawParticles();drawMinimap();const hp=player.health,st=player.stamina;$('health-fill').style.width=hp+'%';$('health-value').textContent=Math.ceil(hp);$('stamina-fill').style.width=st+'%';$('stamina-value').textContent=Math.round(st);}
  function frame(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;if(!defeated&&player.health>0)update(dt);render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
  function endGame(win){$('end-screen').hidden=false;$('end-kicker').textContent=win?'THE VALE REMEMBERS':'A WAYFARER FALLS';$('end-title').textContent=win?'The camp is clear.':'The trail goes quiet.';$('end-copy').textContent=win?'The wind moves softly through Fernwake Meadow once more. You have earned the vale’s thanks.':'Rest, gather your courage, and take another path through the vale.';}
  function reset(){player.x=1160;player.y=1190;player.health=100;player.stamina=100;player.vx=player.vy=0;enemies=[];enemySpawns.forEach((p,i)=>addEnemy(...p,i));particles=[];drops=[];kills=0;defeated=false;camera.x=player.x;camera.y=player.y;$('quest-count').textContent='0 / 8';$('objective-progress').textContent='0/8';$('end-screen').hidden=true;}

  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys.add(k);if(k===' '||k==='j')attack();if(k==='shift')dodge();if(k==='escape'&&$('end-screen').hidden){showToast('WASD to move · Space to swing · Shift to dodge');}});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
  let touchX=0,touchY=0;const joy=$('joystick'),knob=$('joy-knob');let joyPointer=null;
  joy.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)moveJoy(e);});function moveJoy(e){const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),m=Math.min(1,Math.hypot(dx,dy)/(r.width*.34));touchX=dx/(r.width*.34)*m;touchY=dy/(r.height*.34)*m;knob.style.left=`${50+touchX*31}%`;knob.style.top=`${50+touchY*31}%`;}
  joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);function endJoy(){joyPointer=null;touchX=touchY=0;knob.style.left='50%';knob.style.top='50%';}
  $('mobile-attack').addEventListener('pointerdown',e=>{e.preventDefault();attack();});$('mobile-dodge').addEventListener('pointerdown',e=>{e.preventDefault();dodge();});$('restart-button').addEventListener('click',reset);$('dismiss-tip').addEventListener('click',()=>{$('tip-card').style.display='none';tipDismissed=true;});$('sound-button').addEventListener('click',e=>{e.currentTarget.classList.toggle('muted');e.currentTarget.textContent=e.currentTarget.classList.contains('muted')?'♫':'♫';e.currentTarget.style.opacity=e.currentTarget.classList.contains('muted')?'.48':'1';showToast(e.currentTarget.classList.contains('muted')?'Sound off':'Sound on');});
  let pointerDown=false;canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0){pointerDown=true;attack();}});canvas.addEventListener('pointerup',()=>pointerDown=false);canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&player.health>0){const p=project(player.x,player.y),dx=e.clientX-p.x,dy=e.clientY-p.y; // invert the isometric screen projection
      const wx=dx/(2*sx)+dy/(2*sy),wy=dy/(2*sy)-dx/(2*sx),d=Math.hypot(wx,wy);if(d>10){player.faceX=wx/d;player.faceY=wy/d;}}});
  // Brief ambient welcome, then the landscape is yours.
  setTimeout(()=>{if(!tipDismissed)showToast('Find the goblin camps and drive out the raiders.');},900);
})();
