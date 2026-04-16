// Worms-lite prototype: canvas, simple terrain, projectile, explosion, turn-based
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W, H;

function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.width = Math.floor(window.innerWidth * dpr);
  H = canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  rebuildTerrain();
}
window.addEventListener('resize', resize);

// Terrain as height map
let terrain = [];
function rebuildTerrain(){
  terrain = new Array(window.innerWidth|0);
  const w = window.innerWidth|0;
  const base = Math.floor(window.innerHeight*0.6);
  for(let x=0;x<w;x++){
    // simple hills with noise
    const nx = x/w;
    const y = base + Math.sin(nx*8)*40 + Math.sin(nx*2.3)*20 + (Math.random()*10-5);
    terrain[x] = Math.min(window.innerHeight-10, Math.max(60, Math.floor(y)));
  }
  // smooth
  for(let i=0;i<4;i++){
    for(let x=1;x<w-1;x++) terrain[x] = Math.floor((terrain[x-1]+terrain[x]+terrain[x+1])/3);
  }
  placePlayers();
}

const players = [];
function placePlayers(){
  const w = window.innerWidth|0;
  players.length = 0;
  players.push({x: Math.floor(w*0.12), color:'#ff5e57', alive:true});
  players.push({x: Math.floor(w*0.88), color:'#6be585', alive:true});
  players.forEach(p=>{ p.y = terrain[p.x]; p.radius = 12; p.health = 100; });
}

// Controls
const angleInput = document.getElementById('angle');
const powerInput = document.getElementById('power');
const fireBtn = document.getElementById('fire');
const resetBtn = document.getElementById('reset');
const angleVal = document.getElementById('angleVal');
const powerVal = document.getElementById('powerVal');
const turnEl = document.getElementById('turn');
angleInput.addEventListener('input', ()=> angleVal.textContent = angleInput.value);
powerInput.addEventListener('input', ()=> powerVal.textContent = powerInput.value);

let currentTurn = 0; // index in players
function nextTurn(){
  currentTurn = (currentTurn+1)%players.length;
  turnEl.textContent = currentTurn+1;
  // ensure player not inside hole
  const p = players[currentTurn];
  p.y = terrain[p.x];
}

// Projectile
let projectile = null; // {x,y,vx,vy,owner}
const gravity = 0.45; // tuning for mobile

function launch(){
  if(projectile) return; // still flying
  const p = players[currentTurn];
  if(!p.alive) return nextTurn();
  const angleDeg = parseFloat(angleInput.value);
  const power = parseFloat(powerInput.value);
  const ang = angleDeg * Math.PI / 180.0;
  const dir = (angleDeg>90) ? -1 : 1; // treat >90 as left-ish
  const vx = Math.cos(ang) * power * (dir*0.08);
  const vy = -Math.sin(ang) * power * 0.08;
  projectile = {x: p.x, y: p.y - p.radius - 2, vx, vy, owner: currentTurn, traveled:0};
}
fireBtn.addEventListener('click', ()=>{ launch(); });
resetBtn.addEventListener('click', ()=>{ rebuildTerrain(); projectile=null; players.forEach(p=>p.alive=true); currentTurn=0; turnEl.textContent=1; });

// Touch-friendly: tap FIRE area via button already present. Also support tap to set angle/power? (skip for brevity)

// Explosion modifies terrain height map
function explode(cx,cy,radius){
  const w = window.innerWidth|0;
  const start = Math.max(0, Math.floor(cx-radius));
  const end = Math.min(w-1, Math.ceil(cx+radius));
  for(let x=start;x<=end;x++){
    const dx = x-cx;
    const maxDy = Math.sqrt(Math.max(0, radius*radius - dx*dx));
    const holeBottom = cy + maxDy; // remove terrain up to this y
    if(terrain[x] < holeBottom){
      // push terrain down to create hole
      terrain[x] = Math.min(window.innerHeight-8, Math.floor(holeBottom + 4));
    }
  }
  // smooth edges
  for(let i=0;i<2;i++){
    for(let x=Math.max(1,start-8); x<=Math.min(w-2,end+8); x++) terrain[x] = Math.floor((terrain[x-1]+terrain[x]+terrain[x+1])/3);
  }
  // update players positions if they fall into hole
  players.forEach(p=>{
    if(!p.alive) return;
    const tx = Math.max(0, Math.min(window.innerWidth-1, p.x|0));
    p.y = terrain[tx];
    if(p.y > window.innerHeight - 20){ p.alive = false; }
  });
}

// Simple damage: if player within explosion radius
function applyDamage(cx,cy,radius){
  players.forEach(p=>{
    if(!p.alive) return;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.sqrt(dx*dx+dy*dy);
    if(d < radius+20){
      const dmg = Math.max(5, Math.floor((radius+20 - d)));
      p.health -= dmg;
      if(p.health <= 0) p.alive = false;
    }
  });
}

// Draw
function draw(){
  const w = window.innerWidth, h = window.innerHeight;
  ctx.clearRect(0,0,w,h);

  // sky
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#87CEEB');
  g.addColorStop(1,'#6aa0d8');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // terrain
  ctx.fillStyle = '#5d4037';
  ctx.beginPath();
  ctx.moveTo(0,h);
  for(let x=0;x<w;x++) ctx.lineTo(x, terrain[x]);
  ctx.lineTo(w,h);
  ctx.closePath();
  ctx.fill();

  // players
  players.forEach((p,idx)=>{
    if(!p.alive) return;
    const x = p.x; const y = terrain[x]; p.y = y;
    // body
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y-8, p.radius, 0, Math.PI*2);
    ctx.fill();
    // gun as simple line showing angle
    if(idx===currentTurn && !projectile){
      const ang = (parseFloat(angleInput.value) * Math.PI/180);
      const dir = (parseFloat(angleInput.value)>90)? -1:1;
      const gx = x + Math.cos(ang)*p.radius*1.6*(dir);
      const gy = (y-8) - Math.sin(ang)*p.radius*1.6;
      ctx.strokeStyle = '#222'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x,y-8); ctx.lineTo(gx,gy); ctx.stroke();
    }
    // health
    ctx.fillStyle = '#000'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.fillText(p.health|0, x, y-22);
  });

  // projectile
  if(projectile){
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(projectile.x, projectile.y, 6,0,Math.PI*2); ctx.fill();
  }
}

// Simulation loop
let last = performance.now();
function loop(ts){
  const dt = Math.min(40, ts-last);
  last = ts;

  if(projectile){
    projectile.vy += gravity * (dt/16);
    projectile.x += projectile.vx * (dt/16) * 16;
    projectile.y += projectile.vy * (dt/16) * 16;
    projectile.traveled += Math.hypot(projectile.vx, projectile.vy) * (dt/16);

    // check bounds
    if(projectile.x < 0 || projectile.x >= window.innerWidth || projectile.y > window.innerHeight+50){
      // offscreen -> explode at last pos
      explode(projectile.x|0, Math.min(projectile.y|0, window.innerHeight-1), 40);
      applyDamage(projectile.x, projectile.y, 40);
      projectile = null; nextTurn();
    } else {
      const tx = Math.max(0, Math.min(window.innerWidth-1, projectile.x|0));
      if(projectile.y >= terrain[tx]){
        // collision
        explode(projectile.x|0, projectile.y|0, 48);
        applyDamage(projectile.x, projectile.y, 48);
        projectile = null; nextTurn();
      }
    }
  }

  draw();
  requestAnimationFrame(loop);
}

// Init
resize();
requestAnimationFrame(loop);

// Simple keyboard shortcuts for desktop testing
window.addEventListener('keydown', e=>{
  if(e.key===' ') launch();
  if(e.key==='r') rebuildTerrain();
});

// Prevent scrolling on mobile while touching UI
['touchstart','touchmove'].forEach(ev=>document.body.addEventListener(ev, e=>{ if(e.target.tagName!=='INPUT' && e.target.tagName!=='BUTTON') e.preventDefault(); }, {passive:false}));
