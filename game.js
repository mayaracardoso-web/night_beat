const BG_SRC="bg.png", MUSIC_SRC="music.mp3";
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const W=1920,H=1080,GY=930,S=6,GAME_TIME=60,GRAV=4200,FIRST_NOTE=4;
const K=1.43,SK=Math.sqrt(K),JUMP=-1500*SK; // K = fator de tamanho: personagem, obstaculos, notas e pulo crescem juntos
const bg=new Image();bg.src=BG_SRC;
const music=new Audio(MUSIC_SRC);music.loop=true;music.volume=.85;music.preload='auto';
function criarSprite(rows,pal,sc=S){const w=Math.max(...rows.map(r=>r.length)),c=document.createElement('canvas');c.width=w*sc;c.height=rows.length*sc;const g=c.getContext('2d');
 rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(pal[ch]){g.fillStyle=pal[ch];g.fillRect(x*sc,y*sc,sc,sc)}}));return c}
// ---------- personagem (spritesheet: 4 quadros de corrida + 1 de pulo) ----------
const PL={fw:338,fh:406,cx:164,base:396};
const playerImg=new Image();playerImg.src='player.png';
const PW=Math.round(126*K),PH=294; // caixa de colisao (corpo)
function desenharQuadro(i,cx,gy){ // cx = centro do corpo, gy = linha do chao (pe)
 if(!playerImg.complete||!playerImg.naturalWidth)return;
 ctx.save();ctx.shadowColor='rgba(255,80,210,.5)';ctx.shadowBlur=18; // brilho neon (apague estas 2 linhas p/ remover)
 ctx.drawImage(playerImg,i*PL.fw,0,PL.fw,PL.fh,Math.round(cx-PL.cx),Math.round(gy-PL.base),PL.fw,PL.fh);ctx.restore()}
// ---------- barreira holografica ----------
const BK=7,HW=18*BK,HH=18*BK; // 18x18 blocos
function desenharBarreira(x){
 const y=GY-HH,t=anim,bx=Math.round(x),fl=(Math.floor(t*14)%23===0)?.45:1;
 const retangulo=(c,r,w,h,col,al=1)=>{ctx.globalAlpha=al;ctx.fillStyle=col;ctx.fillRect(bx+c*BK,y+r*BK,w*BK,h*BK)};
 ctx.save();
 // campo holografico (com brilho)
 ctx.shadowColor='rgba(53,230,255,.85)';ctx.shadowBlur=24;
 retangulo(2,1,14,13,'#35e6ff',(.2+.06*Math.sin(t*6))*fl);
 ctx.shadowBlur=0;
 for(let r=2;r<13;r+=2)retangulo(2,r,14,1,'#ffffff',.07*fl);
 retangulo(2,1,14,1,'#7ff6ff',.95*fl);retangulo(2,13,14,1,'#7ff6ff',.95*fl);
 // faixa de perigo diagonal animada
 const sh=Math.floor(t*4);
 for(let c=0;c<14;c++)for(let r=0;r<4;r++)retangulo(2+c,5+r,1,1,((c+r+sh)%4<2)?'#ff2fb3':'#14101a',.92*fl);
 retangulo(2,4,14,1,'#7ff6ff',.7*fl);retangulo(2,9,14,1,'#7ff6ff',.7*fl);
 // postes
 for(const c0 of [0,16]){retangulo(c0,0,2,18,'#1b2040');retangulo(c0,0,1,18,'#2c3570');
  const on=Math.floor(t*6)%2===0;retangulo(c0,0,2,2,on?'#ff2fb3':'#ff8be0');
  ctx.shadowColor='rgba(255,47,179,.9)';ctx.shadowBlur=on?18:8;retangulo(c0,0,2,1,on?'#ff2fb3':'#ff8be0');ctx.shadowBlur=0}
 // base
 retangulo(0,16,18,2,'#141830');retangulo(0,16,18,1,'#35e6ff',.75);
 ctx.restore()}
// ---------- nota neon (ciano com sombra rosa) ----------
const NS=8,noteRows=["..WWWWW.","..WWWWWW","..W...WW","..W....W","..W.....","..W.....",".WW.....","WWWW....","WWWW....",".WW....."];
const note=(()=>{const c=document.createElement('canvas');c.width=8*NS+4;c.height=10*NS+4;const g=c.getContext('2d');
 g.drawImage(criarSprite(noteRows,{W:'#ff2fb3'},NS),4,4);g.drawImage(criarSprite(noteRows,{W:'#6ff3ff'},NS),0,0);return c})();
const NW=note.width,NH=note.height;
// ---------- state ----------
let state='title',reason='',dist=0,timeLeft=GAME_TIME,score=0,ending=false,musicOn=false,fade=false,fn=false,cool=0,overAt=0;
let obs=[],notes=[],parts=[],p,jumpBuf=0,coyote=0,holding=false,anim=0,flash=0;
const aleatorio=(a,b)=>a+Math.random()*(b-a);
const tempoDecorrido=()=>GAME_TIME-timeLeft;
function velocidade(){return 650+250*Math.min(1,tempoDecorrido()/GAME_TIME)}
function reiniciar(){state='play';reason='';dist=0;timeLeft=GAME_TIME;score=0;ending=false;musicOn=false;fade=false;fn=false;obs=[];notes=[];parts=[];
 p={x:260,y:GY,vy:0,mode:'run',fin:false,rot:0,dt:0};
 music.pause();music.currentTime=0;music.volume=.85;cool=1100}
// ---------- spawning ----------
function arcoDeNotas(cx,n,gap,peak){if(tempoDecorrido()<FIRST_NOTE)return;gap*=K;peak*=K;for(let i=0;i<n;i++){const t=(i-(n-1)/2)/((n-1)/2||1);notes.push({x:cx+i*gap-(n-1)*gap/2,y:GY-60*K-peak*(1-t*t),ph:i})}}
function linhaDeNotas(x,n){if(tempoDecorrido()<FIRST_NOTE)return;for(let i=0;i<n;i++)notes.push({x:x+i*70*K,y:GY-70*K,ph:i})}
function gerarObstaculo(){
 const x=W+100,el=tempoDecorrido(),r=Math.random();let width=120*K;
 if(r<.28){obs.push({t:'h',x,w:HW});arcoDeNotas(x+HW/2,3,95,150)}
 else if(r<.55){const w=aleatorio(190,250)*K;obs.push({t:'o',x,w});arcoDeNotas(x+w/2,5,Math.max(75,w/(4*K)),190);width=w}
 else if(r<.72){const n=3+Math.floor(aleatorio(0,3));linhaDeNotas(x,n);width=n*70*K}
 else if(r<.86||el<15){obs.push({t:'h',x,w:HW});arcoDeNotas(x+HW/2,3,100,160);width=120*K}
 else{const w=aleatorio(190,230)*K;obs.push({t:'o',x,w},{t:'h',x:x+w+520*SK,w:HW});arcoDeNotas(x+w/2,4,70,190);width=w+600*SK}
 cool=width+aleatorio(560,800)*SK*velocidade()/650}
// ---------- input ----------
function pressionar(){
 if(state==='title'||(state==='over'&&performance.now()-overAt>700)){reiniciar();return}
 if(state==='play')jumpBuf=.12;holding=true}
function soltar(){holding=false;if(p&&p.cut===false&&p.vy<-700*SK){p.vy*=.55}if(p)p.cut=true}
addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();if(!e.repeat)pressionar()}});
addEventListener('keyup',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code))soltar()});
cv.addEventListener('pointerdown',e=>{e.preventDefault();pressionar()});
addEventListener('pointerup',soltar);
document.addEventListener('visibilitychange',()=>{if(document.hidden)music.pause();else if(musicOn&&state==='play'&&!fade)music.play().catch(()=>{})});
// ---------- update ----------
function faiscas(x,y,c){for(let i=0;i<9;i++)parts.push({x,y,vx:aleatorio(-260,260),vy:aleatorio(-320,120),l:.5,c:c||(i%2?'#35e6ff':'#ff2fb3')})}
function buracoAbaixo(){const cx=p.x+PW/2;return obs.find(o=>o.t==='o'&&cx>o.x+8&&cx<o.x+o.w-8)}
function finalizarQuadro(dt){
 if(fade){music.volume=Math.max(0,music.volume-dt/1.0);if(music.volume<=0)music.pause()}
 parts.forEach(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=900*dt;q.l-=dt});parts=parts.filter(q=>q.l>0)}
function atualizar(dt){
 anim+=dt;flash+=dt;
 if(state==='title'){dist+=220*dt;return}
 if(state==='over'){finalizarQuadro(dt);return}
 if(p.mode==='dead'){
  p.vy+=GRAV*dt;p.y=Math.min(GY,p.y+p.vy*dt);if(p.y>=GY)p.vy=0;p.x-=(p.y<GY?320:0)*dt;p.rot=Math.max(-1.5,p.rot-dt*7);p.dt+=dt;
  if(p.dt>1.3){state='over';reason='hit';overAt=performance.now()}
  finalizarQuadro(dt);return}
 const sp=velocidade();dist+=sp*dt;
 if(!ending)timeLeft=Math.max(0,timeLeft-dt);
 if(!fn&&tempoDecorrido()>=FIRST_NOTE){fn=true;linhaDeNotas(Math.max(W+40,...obs.map(o=>o.x+o.w+130)),4)}
 if(timeLeft<=0&&!ending){ending=true;const mx=Math.max(W+80,...obs.map(o=>o.x+o.w+350));obs.push({t:'o',x:mx,w:1700,fin:true})}
 if(!ending){cool-=sp*dt;if(cool<=0)gerarObstaculo()}
 for(const a of [obs,notes])for(const o of a)o.x-=sp*dt;
 obs=obs.filter(o=>o.x+o.w>-300);notes=notes.filter(n=>n.x>-100);
 jumpBuf-=dt;coyote-=dt;
 p.vy+=GRAV*dt;p.y+=p.vy*dt;
 if(p.mode==='run'){
  const hu=buracoAbaixo();
  if(p.y>=GY&&!hu){p.y=GY;p.vy=0;coyote=.08}
  else if(p.y>GY+4&&hu){p.mode='fall';p.fin=!!hu.fin;p.vy=Math.max(p.vy,200);fade=true}
  if(jumpBuf>0&&coyote>0){p.vy=JUMP;p.y=GY-1;jumpBuf=0;coyote=0;p.cut=false;if(!holding){p.vy*=.55;p.cut=true}}
  for(const o of obs)if(o.t==='h'&&p.x+PW/2+33*K>o.x+6*K&&p.x+PW/2-27*K<o.x+o.w-6*K&&p.y>GY-HH+10*K){
   p.mode='dead';p.vy=-900;p.rot=0;p.dt=0;fade=true;faiscas(o.x+o.w/2,GY-HH/2,'#ff3b5c');break}
  if(p.mode==='run')for(const n of notes){const bx=p.x+28*K,by=p.y-PH+12*K,bw=PW-56*K,bh=PH-12*K;
   const cx=Math.max(bx,Math.min(n.x,bx+bw)),cy=Math.max(by,Math.min(n.y,by+bh));
   if((n.x-cx)**2+(n.y-cy)**2<(34*K)**2){n.got=true;score++;faiscas(n.x,n.y);
    if(!musicOn){musicOn=true;music.currentTime=0;music.play().catch(()=>{})}}}
  notes=notes.filter(n=>!n.got);
 }else if(p.y>H+140){state='over';reason=p.fin?'time':'fall';overAt=performance.now()}
 finalizarQuadro(dt)}
// ---------- draw ----------
function desenharFundo(){
 if(!bg.complete||!bg.naturalWidth){ctx.fillStyle='#070b33';ctx.fillRect(0,0,W,H);return}
 const off=Math.floor(dist*.12/S)*S,n0=Math.floor(off/W);
 for(let n=n0;n<=n0+1;n++){const x=n*W-off;ctx.save();if(n%2){ctx.translate(x+W,0);ctx.scale(-1,1);ctx.drawImage(bg,0,0)}else ctx.drawImage(bg,x,0);ctx.restore()}}
function desenharChao(x0,x1){if(x1<=x0)return;ctx.save();ctx.beginPath();ctx.rect(x0,GY,x1-x0,H-GY);ctx.clip();
 ctx.fillStyle='#0a1048';ctx.fillRect(0,GY,W,H-GY);ctx.fillStyle='#4f8cff';ctx.fillRect(0,GY,W,S);ctx.fillStyle='#1b34a8';ctx.fillRect(0,GY+S,W,S*2);
 const off=Math.floor(dist/S)*S%240;ctx.fillStyle='#060a30';
 for(let x=-off;x<W;x+=240){ctx.fillRect(x,GY+18,S,60);ctx.fillRect(x+120,GY+84,S,66)}
 ctx.fillRect(0,GY+78,W,S);ctx.fillStyle='#14238a';for(let x=-off+36;x<W;x+=120)ctx.fillRect(x,GY+36,36,S);
 ctx.restore()}
function texto(s,x,y,sz,col='#fff',al='left'){ctx.font=sz+"px 'Press Start 2P',monospace";ctx.textAlign=al;ctx.lineWidth=sz/4;ctx.strokeStyle='#02030f';ctx.strokeText(s,x,y);ctx.fillStyle=col;ctx.fillText(s,x,y)}
function desenharPersonagem(q){const air=q.y<GY-2||q.mode==='fall';
 if(q.mode==='dead'){ctx.save();ctx.translate(Math.round(q.x+PW/2),Math.round(q.y-PH/2));ctx.rotate(q.rot);desenharQuadro(4,0,PH/2);ctx.restore()}
 else desenharQuadro(air?4:Math.floor(dist/45)%4,q.x+PW/2,q.y)}
function desenhar(){
 ctx.imageSmoothingEnabled=false;desenharFundo();
 const holes=obs.filter(o=>o.t==='o').sort((a,b)=>a.x-b.x);let cur=0;
 for(const h of holes){desenharChao(cur,Math.min(h.x,W));cur=Math.max(cur,h.x+h.w)}desenharChao(cur,W);
 for(const h of holes){ctx.fillStyle='rgba(2,3,15,.72)';ctx.fillRect(h.x,GY,h.w,H-GY);ctx.fillStyle='#02030f';ctx.fillRect(h.x,GY,S,H-GY);ctx.fillRect(h.x+h.w-S,GY,S,H-GY)}
 for(const n of notes){const by=Math.sin(anim*5+n.ph)*6,pr=1+.18*Math.sin(anim*6+n.ph),R=56*pr;const g=ctx.createRadialGradient(n.x,n.y+by,2,n.x,n.y+by,R);g.addColorStop(0,'rgba(53,230,255,.5)');g.addColorStop(.55,'rgba(255,47,179,.16)');g.addColorStop(1,'rgba(255,47,179,0)');ctx.fillStyle=g;ctx.fillRect(n.x-R,n.y+by-R,R*2,R*2);ctx.drawImage(note,Math.round(n.x-NW/2),Math.round(n.y+by-NH/2))}
 for(const o of obs)if(o.t==='h')desenharBarreira(o.x);
 desenharPersonagem(p||{x:260,y:GY,mode:'run'});
 for(const q of parts){ctx.fillStyle=q.c;ctx.fillRect(Math.round(q.x),Math.round(q.y),S,S)}
 if(state==='play'||state==='over'){
  ctx.drawImage(note,36,22,NW*.8,NH*.8);texto('x '+String(score).padStart(2,'0'),108,74,34,'#6ff3ff');
  const m=Math.floor(Math.ceil(timeLeft)/60),s=Math.ceil(timeLeft)%60;texto(m+':'+String(s).padStart(2,'0'),W-40,70,34,'#fff','right');
  ctx.fillStyle='rgba(2,3,15,.6)';ctx.fillRect(W-340,86,300,14);ctx.fillStyle=timeLeft<10?'#ff5a7a':'#35e6ff';ctx.fillRect(W-338,88,296*timeLeft/GAME_TIME,10);
  if(fn&&!musicOn&&state==='play'&&!ending&&Math.floor(flash*2)%2===0)texto('Pegue a primeira nota para ligar a musica!',W/2,180,24,'#ff5ad0','center');
  if(ending&&state==='play'&&p.mode!=='dead')texto('TEMPO ESGOTADO!',W/2,200,40,'#ff5a7a','center')}
 if(state==='title'){ctx.fillStyle='rgba(2,3,15,.55)';ctx.fillRect(0,0,W,H);
  texto('NIGHT BEAT',W/2,360,92,'#35e6ff','center');
  texto('Colete as notas e pule os buracos e barreiras!',W/2,480,26,'#fff','center');
  texto('Bater na barreira ou cair no buraco = GAME OVER',W/2,540,22,'#ff5a7a','center');
  texto('ESPACO / SETA PARA CIMA / TOQUE = PULAR',W/2,610,22,'#ffd84a','center');
  texto('Segure para pular mais alto  |  Duracao: 1:00',W/2,660,20,'#9db8ff','center');
  if(Math.floor(flash*2)%2===0)texto('Pressione ESPACO ou toque para comecar',W/2,800,28,'#fff','center')}
 if(state==='over'){ctx.fillStyle='rgba(2,3,15,.65)';ctx.fillRect(0,0,W,H);
  const win=reason==='time';
  texto(win?'FIM DE JOGO':'GAME OVER',W/2,380,84,win?'#35e6ff':'#ff5a7a','center');
  texto(win?'Voce sobreviveu ate o fim!':reason==='hit'?'Voce bateu na barreira!':'Voce caiu no buraco!',W/2,460,26,'#fff','center');
  ctx.drawImage(note,W/2-260,516,NW*1.1,NH*1.1);texto('x '+score+'  notas',W/2-150,600,48,'#6ff3ff');
  if(Math.floor(flash*2)%2===0)texto('Pressione ESPACO ou toque para jogar de novo',W/2,780,26,'#fff','center')}}
let last=performance.now();
function laco(t){const dt=Math.min(.05,(t-last)/1000);last=t;atualizar(dt);desenhar();requestAnimationFrame(laco)}
requestAnimationFrame(laco);
