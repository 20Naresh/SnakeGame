
// Friends-style Snake PWA game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speedDisplay');
const powerEl = document.getElementById('powerUpDisplay');
const soundToggle = document.getElementById('soundToggle');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const touchControls = document.getElementById('touchControls');

let GRID = 20;
let CELL = canvas.width / GRID;
let snake = [{x:9,y:9}];
let dir = {x:0,y:0};
let nextDir = null;
let food = null;
let obstacles = [];
let powerUps = [];
let speedBoosts = [];
let score = 0;
let baseInterval = 140; // ms between steps at speed 1
let speedMultiplier = 1;
let running = true;
let powerState = null;
let powerTimer = 0;
let music = new Audio('bg_music.wav');
music.loop = true;
let musicOn = true;
music.volume = 0.45;

function resetGame(){
  GRID = 20;
  CELL = canvas.width / GRID;
  snake = [{x:9,y:9}];
  dir = {x:0,y:0};
  nextDir = null;
  placeFood();
  obstacles = []; powerUps = []; speedBoosts = [];
  spawnObstacles(6);
  spawnPowerUps(2);
  spawnSpeedBoosts(2);
  score = 0;
  speedMultiplier = 1;
  powerState = null;
  powerTimer = 0;
  updateHud();
}

function updateHud(){
  scoreEl.textContent = score;
  speedEl.textContent = speedMultiplier.toFixed(2);
  powerEl.textContent = powerState ? `${powerState} (${Math.ceil(powerTimer/1000)}s)` : '—';
}

function placeFood(){
  food = randomEmptyCell();
}

function randomEmptyCell(){
  for(let i=0;i<2000;i++){
    const x = Math.floor(Math.random()*GRID);
    const y = Math.floor(Math.random()*GRID);
    if (!snake.some(s=>s.x===x && s.y===y) && !obstacles.some(o=>o.x===x && o.y===y) && !powerUps.some(p=>p.x===x && p.y===y) && !speedBoosts.some(s=>s.x===x && s.y===y)){
      return {x,y};
    }
  }
  return {x:0,y:0};
}

function spawnObstacles(n){
  for(let i=0;i<n;i++){
    obstacles.push(randomEmptyCell());
  }
}

function spawnPowerUps(n){
  for(let i=0;i<n;i++){
    powerUps.push({...randomEmptyCell(), type: Math.random()<0.5 ? 'grow' : 'invincible'});
  }
}

function spawnSpeedBoosts(n){
  for(let i=0;i<n;i++){
    speedBoosts.push({...randomEmptyCell(), boost: 1.6 + Math.random()*1.6});
  }
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw grid subtle
  ctx.fillStyle = '#071018';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw food
  if (food){
    drawDot(food.x, food.y, 0.45, '#FF5A5F');
  }
  // draw powerups
  powerUps.forEach(p=>drawDot(p.x,p.y,0.42, p.type==='grow'?'#00A699':'#FFB400'));
  // draw speed boosts
  speedBoosts.forEach(s=>drawDot(s.x,s.y,0.36, '#FC642D'));

  // draw obstacles
  obstacles.forEach(o=>{
    ctx.fillStyle = '#2b3b45';
    roundRect(ctx, o.x*CELL+CELL*0.08, o.y*CELL+CELL*0.08, CELL*0.84, CELL*0.84, CELL*0.12);
    ctx.fill();
  });

  // draw snake
  for(let i=snake.length-1;i>=0;i--){
    const s = snake[i];
    const t = i===0 ? 0.9 : 0.6 - (i/snake.length)*0.4;
    const color = i===0 ? '#00D1C1' : '#9fbfc6';
    drawDot(s.x,s.y,t,color);
  }
}

function drawDot(gx, gy, scale=0.5, color='#fff'){
  const x = gx*CELL + CELL*0.5;
  const y = gy*CELL + CELL*0.5;
  const r = CELL*scale*0.5;
  // shadow
  ctx.beginPath();
  ctx.arc(x+CELL*0.04, y+CELL*0.06, r*1.03, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();
  // main
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = color;
  ctx.fill();
  // highlight
  ctx.beginPath();
  ctx.arc(x - r*0.35, y - r*0.45, r*0.28, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function step(){
  if (!running) return;
  // handle direction
  if (nextDir){
    // prevent reversing directly
    if (!(nextDir.x === -dir.x && nextDir.y === -dir.y)) dir = nextDir;
    nextDir = null;
  }
  if (dir.x===0 && dir.y===0) return;

  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

  // wrap around edges
  head.x = (head.x + GRID) % GRID;
  head.y = (head.y + GRID) % GRID;

  // collisions
  const hitSelf = snake.some((s,i)=>i>0 && s.x===head.x && s.y===head.y);
  const hitObstacle = obstacles.some(o=>o.x===head.x && o.y===head.y);
  if (hitSelf && powerState !== 'invincible'){
    // game over -> reset quickly
    flashGameOver();
    resetGame();
    return;
  }
  if (hitObstacle && powerState !== 'invincible'){
    flashGameOver();
    resetGame();
    return;
  }

  snake.unshift(head);

  // eat food?
  if (food && head.x===food.x && head.y===food.y){
    score += 10;
    placeFood();
    // occasionally spawn new obstacle
    if (Math.random()<0.35) obstacles.push(randomEmptyCell());
    // sometimes spawn powerup/speed
    if (Math.random()<0.4) spawnPowerUps(1);
    if (Math.random()<0.35) spawnSpeedBoosts(1);
  } else {
    snake.pop();
  }

  // power up collection
  for(let i=0;i<powerUps.length;i++){
    const p = powerUps[i];
    if (p.x===head.x && p.y===head.y){
      if (p.type === 'grow'){
        // grow snake 3 segments
        for(let k=0;k<3;k++) snake.push({...snake[snake.length-1]});
        score += 15;
      } else if (p.type === 'invincible'){
        powerState = 'invincible';
        powerTimer = 8000;
      }
      powerUps.splice(i,1);
      break;
    }
  }

  // speed boost collection
  for(let i=0;i<speedBoosts.length;i++){
    const s = speedBoosts[i];
    if (s.x===head.x && s.y===head.y){
      speedMultiplier *= s.boost;
      score += 8;
      // limited duration boost
      setTimeout(()=>{ speedMultiplier /= s.boost; updateHud(); }, 7000);
      speedBoosts.splice(i,1);
      break;
    }
  }

  updateGameState();
  draw();
  updateHud();
}

function updateGameState(){
  // power timer decrement
  if (powerState){
    powerTimer -= baseInterval * (1/speedMultiplier);
    if (powerTimer <= 0){
      powerState = null;
      powerTimer = 0;
    }
  }

  // shrink or grow adjustments
  // dynamic difficulty: occasionally increase base speed as score rises
  const extra = Math.floor(score/60);
  baseInterval = Math.max(70, 140 - extra*6);
}

function flashGameOver(){
  // quick flash
  canvas.style.transition='filter 0.12s';
  canvas.style.filter='grayscale(100%) saturate(0.4)';
  setTimeout(()=>{ canvas.style.filter=''; }, 160);
}

let lastTick = 0;
function loop(ts){
  if (!lastTick) lastTick = ts;
  const interval = baseInterval / speedMultiplier;
  if (ts - lastTick >= interval){
    step();
    lastTick = ts;
  }
  requestAnimationFrame(loop);
}

// input
window.addEventListener('keydown', e=>{
  const k = e.key;
  if (k === 'ArrowUp' || k === 'w') nextDir = {x:0,y:-1};
  if (k === 'ArrowDown' || k === 's') nextDir = {x:0,y:1};
  if (k === 'ArrowLeft' || k === 'a') nextDir = {x:-1,y:0};
  if (k === 'ArrowRight' || k === 'd') nextDir = {x:1,y:0};
  if (k===' '){ running = !running; pauseBtn.textContent = running ? 'Pause' : 'Resume'; }
});

// touch controls
document.querySelectorAll('#touchControls button').forEach(b=>{
  b.addEventListener('touchstart', e=>{ e.preventDefault(); const d = b.dataset.dir; setDirFromStr(d); });
  b.addEventListener('mousedown', e=>{ const d = b.dataset.dir; setDirFromStr(d); });
});
function setDirFromStr(s){
  if (s==='up') nextDir = {x:0,y:-1};
  if (s==='down') nextDir = {x:0,y:1};
  if (s==='left') nextDir = {x:-1,y:0};
  if (s==='right') nextDir = {x:1,y:0};
}

soundToggle.addEventListener('click', ()=>{
  musicOn = !musicOn;
  if (musicOn){ music.play(); soundToggle.textContent='🔊 Music: On'; }
  else { music.pause(); soundToggle.textContent='🔇 Music: Off'; }
});

pauseBtn.addEventListener('click', ()=>{
  running = !running;
  pauseBtn.textContent = running ? 'Pause' : 'Resume';
});

resetBtn.addEventListener('click', ()=>{ resetGame(); });

// responsive/touch detection
if ('ontouchstart' in window) touchControls.classList.remove('hidden');

// install prompt handling (basic)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  // show a simple prompt after user interacts
  const btn = document.createElement('button');
  btn.textContent = 'Install App';
  btn.style.marginLeft = '8px';
  btn.onclick = async ()=>{
    if (deferredPrompt){
      deferredPrompt.prompt();
      const {outcome} = await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.remove();
    }
  };
  document.querySelector('header .controls').appendChild(btn);
});

// Start
resetGame();
draw();
music.play().catch(()=>{ /* autoplay may be blocked until interaction */ });
requestAnimationFrame(loop);

// expose a debug method
window._friendsSnake = {reset: resetGame};
