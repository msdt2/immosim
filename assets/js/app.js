/* ImmoSim — version structurée pour GitHub Pages. */

/* ══════════════════════════════════════════════════════════════
   IMMOSIM V7 — JavaScript complet
══════════════════════════════════════════════════════════════ */
'use strict';

/* ── ÉTAT GLOBAL ──────────────────────────────── */
let R = null;           // dernier résultat
let iaData = null;      // données IA
let portf = [];         // portefeuille (projets)
let lots = [];          // lots multi-lots
let history = [];       // historique auto
let chartRefs = {};     // refs Chart.js
let locMode = 'ld';     // location longue/courte
let finMode = 'credit'; // financement credit/multilot
let checkState = {};    // checklist
const MAX_HIST = 30;    // max entrées historique

/* ── THÈME ────────────────────────────────────── */
function toggleTheme(){const h=document.documentElement;h.dataset.theme=h.dataset.theme==='dark'?'light':'dark';localStorage.setItem('immoV7_theme',h.dataset.theme)}

/* ── MODE NUIT AUTOMATIQUE ───────────────────────── */
(function(){
  // Si pas de préférence sauvegardée, suivre le système
  if(!localStorage.getItem('immoV7_theme')){
    const prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme=prefersDark?'dark':'light';
  }
  // Écouter les changements système en temps réel
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',e=>{
    if(!localStorage.getItem('immoV7_theme')){
      document.documentElement.dataset.theme=e.matches?'dark':'light';
    }
  });
})();

(function(){const t=localStorage.getItem('immoV7_theme');if(t)document.documentElement.dataset.theme=t;})();

/* ── NAVIGATION ───────────────────────────────── */
function gv(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.db').forEach(b=>b.classList.remove('active'));
  const viewEl=document.getElementById('view-'+name);
  if(viewEl)viewEl.classList.add('active');
  const btns=document.querySelectorAll('.nb');
  const dbtn=document.querySelector(`.db[onclick*="'${name}'"]`);
  if(dbtn)dbtn.classList.add('active');
  // Highlight matching nav button by searching text
  btns.forEach(b=>{if(b.getAttribute('onclick')&&b.getAttribute('onclick').includes("'"+name+"'"))b.classList.add('active')});
  if(name==='analyse')buildAnalyse();
  if(name==='fiscal')buildFiscal();
  if(name==='tools')buildTools();
  if(name==='hist')buildHist();
  if(name==='portf')buildPortf();
  if(name==='doc'){buildGlossaire();buildFAQ();}
  if(name==='shortlist')renderShortlist();
  if(name==='dashboard')renderDashboard();
  if(name==='pipeline')renderPipeline();
  if(name==='sim')setTimeout(loadProjectState,50);
}
function gvM(n){closeDrawer();gv(n)}
function openDrawer(){document.getElementById('drawer').classList.add('open');document.getElementById('doverlay').classList.add('open')}
function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('doverlay').classList.remove('open')}

/* ── UTILITAIRES ──────────────────────────────── */
function g(id){return document.getElementById(id)}
function vn(id){const n=parseFloat(g(id)?.value);return isNaN(n)?0:n}
function tx(id){return(g(id)?.value||'').trim()}
function sv(id,val){if(g(id))g(id).value=val}
function eur(n,d=2){if(isNaN(n)||n===null)return'—';return n.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})+' €'}
function pct(n,d=2){if(isNaN(n)||!isFinite(n))return'—';return n.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%'}
function toast(msg,type=''){const el=document.createElement('div');el.className='toast'+(type?' '+type:'');el.textContent=msg;g('toasts').appendChild(el);setTimeout(()=>el.remove(),3200)}
function destroyChart(id){if(chartRefs[id]){chartRefs[id].destroy();delete chartRefs[id]}}
function openMod(id){g(id).classList.add('open')}
function closeMod(id){g(id).classList.remove('open')}
function isDark(){return document.documentElement.dataset.theme==='dark'}
function chartColors(){return{grid:isDark()?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)',label:isDark()?'#50566e':'#968e80'}}

/* ── PANEL TABS ───────────────────────────────── */
function switchPanel(id){
  document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.pt').forEach(t=>t.classList.remove('active'));
  g(id).classList.add('active');
  const pts=document.querySelectorAll('.pt');
  const map={'pr-main':0,'pr-levier':1,'pr-cf':2};
  if(map[id]!==undefined&&pts[map[id]])pts[map[id]].classList.add('active');
}

/* ── FRAIS DE NOTAIRE AUTO ────────────────────── */

/* ── APPORT PRESETS (notaire / 10% / 20%) ─────────── */
const APPORT_PRESETS=['apportNotaire','apport10','apport20'];

function setApportPreset(preset){
  const prix=vn('prixAchat');
  const apportInput=g('apport');

  // Décocher les autres checkboxes
  APPORT_PRESETS.forEach(id=>{
    if(id!==({notaire:'apportNotaire','10':'apport10','20':'apport20'}[preset]))
      g(id).checked=false;
  });

  const isChecked=g({notaire:'apportNotaire','10':'apport10','20':'apport20'}[preset]).checked;

  if(isChecked){
    if(!prix){
      toast('Saisissez un prix d\'achat avant de choisir un preset.','warn');
      APPORT_PRESETS.forEach(id=>{ g(id).checked=false; });
      return;
    }
    let val=0;
    if(preset==='notaire') val=Math.round(getNotaire());
    else if(preset==='10')  val=Math.round(prix*0.10);
    else if(preset==='20')  val=Math.round(prix*0.20);
    sv('apport', val);
    apportInput.readOnly=true;
    apportInput.classList.add('comp');
  } else {
    apportInput.readOnly=false;
    apportInput.classList.remove('comp');
  }
  lv();
}

function _refreshApportPreset(){
  // Recalcule l'apport si un preset est actif (appelé quand le prix change)
  const prix=vn('prixAchat');
  if(!prix) return;
  if(g('apportNotaire').checked){ sv('apport',Math.round(getNotaire())); }
  else if(g('apport10').checked){ sv('apport',Math.round(prix*0.10)); }
  else if(g('apport20').checked){ sv('apport',Math.round(prix*0.20)); }
}

function onApportInput(){
  // Saisie manuelle → décocher tous les presets
  APPORT_PRESETS.forEach(id=>{ g(id).checked=false; });
  g('apport').readOnly=false;
  g('apport').classList.remove('comp');
}
function autoNotaire(){
  const prix=vn('prixAchat');
  if(!prix)return;
  // Mettre à jour l'apport si un preset est actif
  _refreshApportPreset();
  const isNeuf=tx('anciennete')==='neuf';
  const taux=isNeuf?0.03:0.085;
  const calc=(prix*taux).toFixed(0);
  if(!g('fraisNotaire').value.trim()){
    g('notaireDisplay').textContent=eur(+calc,0)+` (${isNeuf?'3%':'8,5%'} estimé)`;
  } else {
    g('notaireDisplay').textContent=eur(vn('fraisNotaire'),0)+' (saisi manuellement)';
  }
}
function getNotaire(){
  const manual=g('fraisNotaire').value.trim();
  if(manual) return vn('fraisNotaire');
  const prix=vn('prixAchat');
  return prix*(tx('anciennete')==='neuf'?0.03:0.085);
}

/* ── NÉGOCIATION ──────────────────────────────── */
function updateNego(){
  const aff=vn('prixAffiche'),neg=vn('negoP');
  if(aff>0){
    const nego=aff*(1-neg/100);
    sv('prixAchat',nego.toFixed(0));
    const save=aff-nego;
    if(save>0){g('negoRow').style.display='flex';g('negoVal').textContent=eur(save,0)}
    else g('negoRow').style.display='none';
  }
  autoNotaire();
  lv();
}

/* ── SWITCH LOC / FIN ─────────────────────────── */
function switchLoc(m){
  locMode=m;
  document.querySelectorAll('[data-loc]').forEach(t=>t.classList.toggle('active',t.dataset.loc===m));
  g('loc-ld').classList.toggle('active',m==='ld');
  g('loc-cd').classList.toggle('active',m==='cd');
  lv();
}
function switchFin(m){
  finMode=m;
  document.querySelectorAll('[data-ft]').forEach(t=>t.classList.toggle('active',t.dataset.ft===m));
  g('ft-credit').classList.toggle('active',m==='credit');
  g('ft-multilot').classList.toggle('active',m==='multilot');
}

/* ── MENSUALITÉ ───────────────────────────────── */
function calcMens(cap,tauxAn,duree){
  if(cap<=0||tauxAn<=0||duree<=0)return 0;
  const t=(tauxAn/100)/12,n=duree*12;
  return cap*(t*Math.pow(1+t,n))/(Math.pow(1+t,n)-1);
}

/* ── REVENU COURTE DURÉE ──────────────────────── */
function revCourte(){
  const nuit=vn('prixNuit'),occ=vn('occup')/100,comm=vn('commPlat')/100;
  const brut=nuit*30*occ*(1-comm);
  return Math.max(0,brut-vn('fraisMenage')*vn('nbSejours')-vn('concierge'));
}

/* ── LIVE UPDATE ──────────────────────────────── */
function lv(){
  const notaire=getNotaire();
  const cout=vn('prixAchat')+notaire+vn('fraisAgence')+vn('travaux')+vn('ameublement')+vn('autresFrais');
  sv('coutTotal',cout>0?cout.toFixed(2):'');
  let emp=vn('emprunte');
  if(!g('emprunte').value.trim())emp=Math.max(0,cout-vn('apport'));
  let ass=vn('assurEmpr');
  if(g('periodeAss').value==='a')ass/=12;
  const m=calcMens(emp,vn('tauxPret'),vn('dureePret'))+ass;
  sv('mensCalculee',m>0?m.toFixed(2):'');
  if(locMode==='cd'){const rc=revCourte();sv('revCourte',rc.toFixed(2))}
  autoNotaire();
  updAmort();
  updLots();
}

/* ── AMORTISSEMENTS ───────────────────────────── */
const PRESETS=[
  {id:'pi',name:'Immeuble (2,5%)',detail:'Structure hors terrain · 40 ans',base:'prixAchat',c:.025,f:'amortImm'},
  {id:'pm',name:'Mobilier (20%)',detail:'Meubles & équipement · 5 ans',base:'ameublement',c:.20,f:'amortMob'},
  {id:'pt',name:'Travaux (10%)',detail:'Rénovation · 10 ans',base:'travaux',c:.10,f:'amortTrav'},
  {id:'pe',name:'Équipements (33%)',detail:'Matériel élec. · 3 ans',base:null,c:0,f:'amortAut'},
];
function buildPresets(){
  g('presetGrid').innerHTML=PRESETS.map(p=>`
    <div style="display:flex;align-items:flex-start;gap:7px;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:8px 10px;cursor:pointer;transition:all var(--t)" id="prs-${p.id}" onclick="togPr('${p.id}')">
      <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid var(--bd3);flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:1px;transition:all var(--t)" id="pc-${p.id}"></div>
      <div><div style="font-size:.77rem;font-weight:700;color:var(--ink)">${p.name}</div><div style="font-size:.66rem;color:var(--ink3);margin-top:1px">${p.detail}</div></div>
    </div>`).join('');
}
function togPr(pid){
  const el=g('prs-'+pid),ch=g('pc-'+pid);
  const on=el.style.borderColor!=='var(--gold-b)';
  el.style.borderColor=on?'var(--gold-b)':'var(--bd)';
  el.style.background=on?'var(--gold-a)':'var(--bg2)';
  ch.style.background=on?'var(--gold)':'';
  ch.style.borderColor=on?'var(--gold)':'var(--bd3)';
  ch.innerHTML=on?'<span style="color:#0f0800;font-size:9px;font-weight:700">✓</span>':'';
  const p=PRESETS.find(x=>x.id===pid);
  if(p&&p.base&&p.c){
    const base=vn(p.base),mont=base*p.c,cur=vn(p.f);
    sv(p.f,Math.max(0,on?cur+mont:cur-mont).toFixed(0));
  }
  updAmort();
}
function updAmort(){
  const tot=vn('amortImm')+vn('amortMob')+vn('amortTrav')+vn('amortAut');
  sv('amortissements',tot>0?tot.toFixed(0):'0');
  g('amortTotal').textContent=eur(tot,0)+'/an';
}

/* ── MULTI-LOTS ───────────────────────────────── */
function updLots(){
  const total=lots.reduce((s,l)=>s+l.loyer*(1-l.vacance/100),0);
  if(g('totalLots'))g('totalLots').textContent=eur(total)+'/mois';
}
function renderLots(){
  const el=g('lotList');
  if(!el)return;
  if(!lots.length){el.innerHTML='<p style="font-size:.75rem;color:var(--ink4);text-align:center;padding:10px">Aucun lot ajouté.</p>';updLots();return}
  el.innerHTML=lots.map((l,i)=>`
    <div class="lot-item">
      <div class="lot-info">
        <span class="li-name">${l.nom}</span>
        <span class="li-val">${l.type} · ${l.surf}m²</span>
        <span class="li-val" style="color:var(--em)">${eur(l.loyer)}/mois</span>
        <span class="li-val">Vac. ${l.vacance}%</span>
      </div>
      <div class="lot-actions">
        <button class="btn btn-d btn-sm" onclick="delLot(${i})">✕</button>
      </div>
    </div>`).join('');
  updLots();
}
function openAddLot(){sv('lotNom','');sv('lotSurf','');sv('lotLoyer','');sv('lotVac','5');sv('lotCharges','');openMod('modalLot')}
function saveLot(){
  const nom=tx('lotNom');if(!nom){toast('Donnez un nom au lot.','err');return}
  lots.push({nom,type:tx('lotType'),surf:vn('lotSurf'),loyer:vn('lotLoyer'),vacance:vn('lotVac'),charges:vn('lotCharges')});
  renderLots();closeMod('modalLot');toast('Lot ajouté ✓','ok');
}
function delLot(i){lots.splice(i,1);renderLots()}

/* ── RÉGIME FISCAL ────────────────────────────── */
function setRegime(r){
  sv('regime',r);
  document.querySelectorAll('.rt').forEach(b=>b.classList.toggle('active',b.dataset.r===r));
  const reel=['reel-foncier','lmnp-reel','sci-ir','sci-is'].includes(r);
  const amortR=['lmnp-reel','sci-is'].includes(r);
  const sciIS=r==='sci-is';
  g('f-int').style.display=reel?'':'none';
  g('f-asd').style.display=reel?'':'none';
  g('f-ded').style.display=reel?'':'none';
  g('f-is').style.display=sciIS?'':'none';
  g('f-sal').style.display=sciIS?'':'none';
  g('f-div').style.display=sciIS?'':'none';
  g('bloc-amort').style.display=amortR?'':'none';
}

/* ── CALCUL FISCAL ────────────────────────────── */
function calcFiscal(regime,p){
  const{loyer,charges,interets,assurDed,amort,autresDed,tmi,ps,tauxIS,cfAvant}=p;
  let revImp=0,impot=0,desc='';
  switch(regime){
    case'micro-foncier': revImp=loyer*.70;impot=revImp*(tmi+ps);desc='Micro-foncier — abattement 30%';break;
    case'reel-foncier':  revImp=Math.max(0,loyer-charges-interets-assurDed-autresDed);impot=revImp*(tmi+ps);desc='Réel foncier — charges réelles';break;
    case'micro-bic':     revImp=loyer*.50;impot=revImp*(tmi+ps);desc='Micro-BIC — abattement 50%';break;
    case'lmnp-reel':     revImp=Math.max(0,loyer-charges-interets-assurDed-amort-autresDed);impot=revImp*(tmi+ps);desc='LMNP Réel — amortissements';break;
    case'sci-ir':        revImp=Math.max(0,loyer-charges-interets-assurDed-autresDed);impot=revImp*(tmi+ps);desc='SCI à l\'IR';break;
    case'sci-is':{
      const salDir=p.salaireDirigeant||0;
      const pctDiv=(p.pctDividende||0)/100;
      const resAvantIS=Math.max(0,loyer-charges-interets-assurDed-amort-autresDed-salDir);
      let isImpot=0;
      if(tauxIS==='15') isImpot=resAvantIS*.15;
      else if(tauxIS==='25') isImpot=resAvantIS*.25;
      else isImpot=resAvantIS<=42500?resAvantIS*.15:42500*.15+(resAvantIS-42500)*.25;
      const resNetIS=resAvantIS-isImpot;
      const pfuImpot=resNetIS*pctDiv*.30;
      impot=isImpot+pfuImpot;
      revImp=resAvantIS;
      const tauxEff=resAvantIS>0?((impot/resAvantIS)*100).toFixed(1):'0';
      desc='SCI IS ('+tauxEff+'%)';
      break;}
  }
  return{revImp,impot,cfApres:cfAvant-(impot/12),desc};
}

/* ── SCORE ────────────────────────────────────── */
function calcScore(p){
  let s=0;
  if(p.rentBrute>=8)s+=25;else if(p.rentBrute>=6)s+=17;else if(p.rentBrute>=4)s+=8;else s+=2;
  if(p.cfAvant>200)s+=20;else if(p.cfAvant>0)s+=12;else if(p.cfAvant>-200)s+=4;
  const dpeS={A:15,B:13,C:10,D:7,E:4,F:1,G:0};s+=(dpeS[p.dpe]||5);
  if(p.vacance<=3)s+=12;else if(p.vacance<=7)s+=8;else if(p.vacance<=12)s+=4;
  const ratio=p.loyer>0?p.mens/p.loyer:1;
  if(ratio<0.6)s+=13;else if(ratio<0.8)s+=8;else if(ratio<1)s+=4;
  // Bonus ville (0-15 pts) basé sur le score d'attractivité
  if(_selectedCity&&_selectedCity._attrScore){
    const cityS=_selectedCity._attrScore;
    if(cityS>=75)s+=15;else if(cityS>=60)s+=10;else if(cityS>=45)s+=5;else s+=1;
  }
  return Math.min(100,s);
}
function scColor(s){return s>=70?'var(--em)':s>=45?'var(--am)':'var(--ru)'}
function scLabel(s){
  if(s>=75)return{l:'Excellent',s:'Investissement solide'};
  if(s>=60)return{l:'Bon',s:'Paramètres favorables'};
  if(s>=45)return{l:'Moyen',s:'Quelques risques à surveiller'};
  if(s>=30)return{l:'Faible',s:'Risque élevé'};
  return{l:'Risqué',s:'Revoir les paramètres'};
}

/* ══════════════════════════════════════════════
   CALCUL PRINCIPAL
══════════════════════════════════════════════ */
function calc(){
  const notaire=getNotaire();
  const pa=vn('prixAchat'),fn=notaire,fa=vn('fraisAgence'),
        tr=vn('travaux'),am=vn('ameublement'),af=vn('autresFrais');
  const coutTotal=pa+fn+fa+tr+am+af;

  let emp=vn('emprunte');
  if(!g('emprunte').value.trim())emp=Math.max(0,coutTotal-vn('apport'));
  let assEmpM=vn('assurEmpr');
  if(g('periodeAss').value==='a')assEmpM/=12;
  const mensHAss=calcMens(emp,vn('tauxPret'),vn('dureePret'));
  const mensFin=g('mensManuelle').value.trim()?vn('mensManuelle'):mensHAss+assEmpM;

  // Loyer effectif
  let loyerM,isCD=false;
  if(finMode==='multilot'&&lots.length){
    loyerM=lots.reduce((s,l)=>s+l.loyer*(1-l.vacance/100),0);
  } else if(locMode==='cd'){
    loyerM=revCourte();isCD=true;
  } else {
    loyerM=vn('loyerMensuel');
  }
  const loyerAn=loyerM*12;
  const revNet=isCD?loyerAn:loyerAn*(1-vn('vacance')/100-vn('impayes')/100);

  const charges=vn('taxeFonc')+vn('assurPNO')+vn('chargesCopro')+vn('fraisGestion')+vn('entretien')+vn('compta')+vn('autresCharges');
  const rentBrute=coutTotal>0?(loyerAn/coutTotal)*100:0;
  const revNC=revNet-charges;
  const rentNette=coutTotal>0?(revNC/coutTotal)*100:0;
  const cfAvant=(revNC/12)-mensFin;

  const tmi=vn('tmi')/100,ps=vn('ps')/100,tauxIS=tx('tauxIS');
  let interets=vn('interets');
  if(!g('interets').value?.trim())interets=emp*(vn('tauxPret')/100);
  const amort=vn('amortissements');

  const fp={loyer:loyerAn,charges,interets,assurDed:vn('assurDed'),amort,autresDed:vn('autresDed'),tmi,ps,tauxIS,cfAvant,salaireDirigeant:vn('salaireDirigeant'),pctDividende:vn('pctDividende')};
  const regime=tx('regime');
  const{revImp,impot,cfApres,desc}=calcFiscal(regime,fp);

  // Meilleur régime
  const allReg=['micro-foncier','reel-foncier','micro-bic','lmnp-reel','sci-ir','sci-is'];
  const allRes=allReg.map(r=>({r,res:calcFiscal(r,fp)}));
  const bestReg=allRes.reduce((b,c)=>c.res.cfApres>b.res.cfApres?c:b);

  // Score
  const score=calcScore({rentBrute,cfAvant,dpe:tx('dpe'),vacance:vn('vacance'),loyer:loyerM,mens:mensFin});

  // Hypothèses long terme
  const horizon=vn('horizon')||20;
  const revalBien=vn('revalBien')||2;
  const irlTaux=vn('irlTaux')||1.5;
  const inflCharges=vn('inflCharges')||1.5;

  R={
    coutTotal,pa,notaire,fa,tr,am,af,
    emp,mensFin,mensHAss,assEmpM,
    loyerAn,loyerM,rentBrute,charges,rentNette,revNC,cfAvant,
    revImp,impot,cfApres,desc,regime,
    tmi:vn('tmi'),ps:vn('ps'),tauxIS,interets,amort,
    assurDed:vn('assurDed'),autresDed:vn('autresDed'),
    fp,score,bestReg,allRes,
    ville:tx('ville'),typeBien:tx('typeBien'),surface:vn('surface'),dpe:tx('dpe'),
    apport:vn('apport'),tauxPret:vn('tauxPret'),dureePret:vn('dureePret'),
    prixAffiche:vn('prixAffiche'),negoPct:vn('negoP'),
    horizon,revalBien,irlTaux,inflCharges,isCD,lots:[...lots],
    prixRevente:vn('prixRevente'),
    ts:Date.now(),
  };

  displayResults(R);
  addToHist(R);
  g('histBadge').textContent=getHist().length;
  // Auto-save project state if section exists
  if(typeof saveProjectState === 'function') saveProjectState();
  return R;
}

/* ── AFFICHAGE RÉSULTATS PANEL ─────────────────── */
function displayResults(r){
  const cls=v=>v>0?'pos':v<0?'neg':'';
  const sl=scLabel(r.score),sc=scColor(r.score);

  // Panel principal
  g('panelMain').innerHTML=`
    <div class="score-wrap">
      <div class="score-ring" style="border-color:${sc};background:${sc}18">
        <span class="sn2" style="color:${sc}">${Math.round(r.score)}</span>
        <span class="sm">/100</span>
      </div>
      <div class="score-info" style="flex:1">
        <div class="sl" style="color:${sc}">${sl.l}</div>
        <div class="ss">${sl.s}</div>
        <div class="sbar"><div class="sbar-f" style="width:${r.score}%;background:${sc}"></div></div>
      </div>
    </div>
    <div class="rec-box ${r.regime===r.bestReg.r?'':'warn'}">
      💡 Régime optimal : <strong>${r.bestReg.res.desc.split('—')[0].trim()}</strong> →
      <strong>${eur(r.bestReg.res.cfApres)}/mois</strong> après impôt
      ${r.regime===r.bestReg.r?'<br/><em style="font-size:.68rem;color:var(--em)">✓ Régime actuel optimal</em>':'<br/><em style="font-size:.68rem">Actuel : '+r.desc.split('—')[0].trim()+'</em>'}
    </div>
    ${(()=>{const alert=getDPEAlert(r.dpe,r.isCD?'courte':'nue');if(!alert)return'';const colors={err:'var(--ru)',warn:'var(--am)',info:'var(--sa)'};const bgs={err:'var(--ru-a)',warn:'var(--am-a)',info:'var(--sa-a)'};const bds={err:'var(--ru-b)',warn:'rgba(245,165,32,.25)',info:'var(--sa-b)'};return`<div class="rec-box" style="background:${bgs[alert.level]};border-color:${bds[alert.level]}"><span style="color:${colors[alert.level]}">⚡ ${alert.msg}</span></div>`;})()}
    ${(()=>{const t=getTensionLocative(r.ville);if(!t)return'';const[score,label,vacConseillée]=t;const color=score>=85?'var(--em)':score>=65?'var(--am)':'var(--ru)';return`<div class="rec-box" style="background:var(--bg2);border-color:var(--bd2)"><span style="color:${color}">📍 <strong>${r.ville}</strong> — ${label} (${score}/100)</span><br/><span style="font-size:.68rem;color:var(--ink3)">Vacance conseillée : ${vacConseillée}% · Source : estimation ImmoSim (indicatif)</span></div>`;})()}
    <div class="rg"><div class="rg-label">Investissement</div>
      <div class="rc gold"><span class="rl">Coût total projet</span><span class="rv">${eur(r.coutTotal,0)}</span></div>
      ${r.negoPct>0?`<div class="rc pos"><span class="rl">Économie négociée (${r.negoPct}%)</span><span class="rv">${eur(r.prixAffiche-r.pa,0)}</span></div>`:''}
      <div class="rc"><span class="rl">Mensualité (avec assurance)</span><span class="rv">${eur(r.mensFin)}/mois</span></div>
      ${(()=>{const rev=vn('revenusMenage');if(!rev)return'';const autres=vn('autresCredits');const ratio=((r.mensFin+autres)/rev)*100;const cls=ratio<=33?'ok':ratio<=35?'warn':'danger';const icon=ratio<=33?'✓':ratio<=35?'⚠':'✗';return`<div class="rc ${ratio<=33?'pos':ratio>35?'neg':''}"><span class="rl">Taux d'endettement</span><span class="rv"><span class="debt-badge ${cls}">${icon} ${ratio.toFixed(1)}%</span></span></div>`;})()}
    </div>
    <div class="rg"><div class="rg-label">Rentabilité & Performance</div>
      <div class="rc gold"><span class="rl">Rentabilité brute</span><span class="rv">${pct(r.rentBrute)}</span></div>
      <div class="rc gold"><span class="rl">Rentabilité nette (hors impôts)</span><span class="rv">${pct(r.rentNette)}</span></div>
      <div class="rc"><span class="rl">Charges annuelles</span><span class="rv">${eur(r.charges,0)}</span></div>
      ${(()=>{const tri=computeTRI(r);return tri!==null?`<div class="rc gold"><span class="rl">TRI (Taux Rendement Interne, ${r.horizon} ans)</span><span class="rv">${pct(tri)}</span></div>`:''})()}
    </div>
    <div class="rg"><div class="rg-label">Cash-flow mensuel</div>
      <div class="rc ${cls(r.cfAvant)}"><span class="rl">Avant impôt</span><span class="rv">${eur(r.cfAvant)}/mois</span></div>
      <div class="rc ${cls(r.cfApres)}"><span class="rl">Après impôt</span><span class="rv">${eur(r.cfApres)}/mois</span></div>
    </div>
    ${buildStressLoyerHTML(r)}
    <div class="rg"><div class="rg-label">Fiscalité — ${r.desc}</div>
      <div class="rc"><span class="rl">Revenu imposable</span><span class="rv">${eur(r.revImp,0)}</span></div>
      <div class="rc"><span class="rl">Impôt estimé</span><span class="rv">${eur(r.impot,0)}/an</span></div>
    </div>
    <p class="disc">⚠ Estimations indicatives. Consultez un professionnel avant toute décision.</p>`;

  // Panel effet levier
  buildLevier(r);

  // Panel CF mini-chart
  buildMiniCF(r);
}


/* ── STRESS LOYER 90/80/70% (capacité de crédit) ─ */

/* ── TRI — TAUX DE RENDEMENT INTERNE ────────────── */
function calcTRI(fluxInitial, fluxAnnuels, maxIter=100, tol=1e-7){
  // Newton-Raphson sur la VAN
  let r=0.08; // taux initial 8%
  for(let i=0;i<maxIter;i++){
    let van=fluxInitial,dVan=0;
    fluxAnnuels.forEach((f,t)=>{
      const disc=Math.pow(1+r,t+1);
      van+=f/disc;
      dVan-=(t+1)*f/Math.pow(1+r,t+2);
    });
    if(Math.abs(dVan)<1e-10)break;
    const r2=r-van/dVan;
    if(Math.abs(r2-r)<tol){r=r2;break;}
    r=r2;
    if(r<-0.99)r=-0.99;
    if(r>100)r=10;
  }
  return isFinite(r)?r*100:null;
}


/* ── ALERTE DPE / LOI CLIMAT ────────────────────── */

/* ── TENSION LOCATIVE PAR VILLE ─────────────────── */
const TENSION_VILLES={
  // Format: [score 0-100, label, vacance conseillée]
  'paris':[98,'Très forte tension',2],'lyon':[90,'Forte tension',3],
  'marseille':[75,'Tension modérée',4],'toulouse':[85,'Forte tension',3],
  'bordeaux':[88,'Forte tension',3],'nantes':[87,'Forte tension',3],
  'strasbourg':[82,'Forte tension',3],'montpellier':[86,'Forte tension',3],
  'lille':[80,'Forte tension',4],'nice':[78,'Tension modérée',4],
  'rennes':[84,'Forte tension',3],'grenoble':[79,'Tension modérée',4],
  'angers':[76,'Tension modérée',4],'dijon':[70,'Tension modérée',5],
  'clermont-ferrand':[62,'Tension faible',6],'nancy':[65,'Tension faible',6],
  'saint-etienne':[45,'Marché détendu',8],'limoges':[42,'Marché détendu',8],
  'brest':[72,'Tension modérée',5],'tours':[74,'Tension modérée',4],
  'rouen':[71,'Tension modérée',5],'amiens':[55,'Marché peu tendu',7],
  'perpignan':[60,'Tension faible',6],'metz':[63,'Tension faible',6],
  'caen':[68,'Tension faible',5],'pau':[58,'Marché peu tendu',7],
  'lorient':[67,'Tension faible',6],'toulon':[65,'Tension faible',6],
  'douai':[58,'Marché peu tendu',7],'lens':[50,'Marché détendu',8],
  'dunkerque':[52,'Marché détendu',7],'valenciennes':[55,'Marché peu tendu',7],
  'arras':[60,'Tension faible',6],'calais':[45,'Marché détendu',8],
  'la-rochelle':[80,'Forte tension',3],'poitiers':[65,'Tension faible',6],
  'orleans':[72,'Tension modérée',5],'reims':[68,'Tension faible',5],
  'le-mans':[60,'Tension faible',6],'besancon':[62,'Tension faible',6],
  'mulhouse':[50,'Marché détendu',8],'colmar':[70,'Tension modérée',5],
  'avignon':[68,'Tension faible',5],'nimes':[65,'Tension faible',6],
  'bayonne':[82,'Forte tension',3],'aix-en-provence':[85,'Forte tension',3],
};

function getTensionLocative(ville){
  if(!ville)return null;
  const key=ville.toLowerCase().trim().split(' ')[0]
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return TENSION_VILLES[key]||null;
}

/* ═══════════════════════════════════════════════════
   CITY SEARCH — API geo.api.gouv.fr + données INSEE
═══════════════════════════════════════════════════ */

// Données département (INSEE 2023) : [chomage%, etudiants%, revenuMedian€, prixM2moyen€, tendance%/an]
const DEPT_DATA={
'01':[6.2,3.1,23400,2150,2.5],'02':[12.1,2.5,19200,1350,-0.5],'03':[9.8,2.8,19800,1100,-1.0],
'04':[9.5,1.5,21200,2300,1.5],'05':[7.2,1.8,22500,2550,2.0],'06':[8.5,5.2,24800,4450,1.8],
'07':[8.8,1.2,21500,1800,1.0],'08':[12.5,1.8,19000,1050,-1.5],'09':[11.2,1.0,20200,1250,0.0],
'10':[9.8,2.5,20800,1400,0.5],'11':[13.0,1.5,20000,1650,1.0],'12':[6.8,2.0,21000,1400,0.5],
'13':[10.5,7.5,22200,3250,2.0],'14':[8.2,5.5,21500,2200,1.5],'15':[7.0,1.0,20500,1050,-0.5],
'16':[9.5,2.0,20500,1200,-0.5],'17':[9.0,2.5,21800,2350,2.0],'18':[9.5,2.0,20000,1100,-1.0],
'19':[7.5,1.5,20800,1200,0.0],'21':[7.2,6.5,22500,2100,1.5],'22':[7.8,2.0,21500,1700,1.0],
'23':[8.5,0.8,19500,850,-2.0],'24':[9.8,1.5,20500,1500,0.5],'25':[7.5,5.5,22000,2150,1.5],
'26':[9.2,2.8,21800,2100,1.0],'27':[8.8,1.5,21500,1800,0.5],'28':[8.2,2.0,22000,1900,0.5],
'29':[7.2,3.5,21800,1900,1.5],'30':[11.5,3.5,20800,2100,1.0],'31':[8.5,8.5,23500,3200,2.5],
'32':[8.8,0.8,20200,1200,0.0],'33':[8.8,7.0,23000,3500,2.0],'34':[11.5,8.0,22000,2900,2.5],
'35':[6.5,7.5,22800,2800,2.5],'36':[9.2,1.5,19800,1000,-1.0],'37':[7.8,5.5,22500,2300,1.5],
'38':[7.0,6.5,23500,2600,1.5],'39':[6.8,1.5,21500,1500,0.5],'40':[8.5,1.5,21000,2000,1.0],
'41':[8.0,2.0,21000,1500,0.5],'42':[8.8,4.5,21500,1600,0.5],'43':[7.0,1.5,20800,1300,0.0],
'44':[7.2,6.5,23000,3100,2.0],'45':[8.5,3.5,22000,2000,1.0],'46':[8.0,1.0,20500,1400,0.5],
'47':[10.5,1.5,20000,1350,0.0],'48':[6.5,0.8,20000,1100,0.0],'49':[7.0,5.0,22000,2200,1.5],
'50':[7.5,1.5,21000,1700,0.5],'51':[8.5,5.0,22000,1900,0.5],'52':[8.8,1.0,19500,900,-2.0],
'53':[5.8,1.5,21000,1400,0.5],'54':[8.5,5.5,21500,1800,0.5],'55':[9.0,1.0,19500,900,-1.5],
'56':[7.0,2.5,21500,2200,1.5],'57':[9.0,3.0,21000,1600,0.0],'58':[9.5,1.0,19800,900,-2.0],
'59':[10.8,7.5,21500,2200,1.0],'60':[9.0,2.0,22000,2100,0.5],'61':[8.8,1.0,20000,1150,-0.5],
'62':[11.0,3.5,20500,1650,0.5],'63':[8.0,6.0,22000,2100,1.5],'64':[7.8,3.5,22500,2700,2.0],
'65':[9.0,1.5,20800,1500,0.5],'66':[14.0,2.5,20000,2100,1.0],'67':[7.5,7.0,23000,2800,1.5],
'68':[8.5,4.0,22500,2000,1.0],'69':[7.8,9.0,24000,3600,2.5],'70':[8.0,1.0,20500,1100,-0.5],
'71':[7.5,2.0,21000,1300,0.0],'72':[7.8,2.5,21000,1500,0.5],'73':[6.5,3.5,23500,3200,2.0],
'74':[6.0,3.0,25000,4000,2.5],'75':[7.5,15.0,31000,10500,1.5],'76':[9.5,5.0,21500,2000,0.5],
'77':[7.0,3.0,24000,2900,1.5],'78':[6.5,4.5,27000,3800,1.5],'79':[7.8,2.0,20800,1400,0.5],
'80':[10.0,3.5,20500,1700,0.5],'81':[9.5,2.5,20500,1400,0.5],'82':[10.5,2.0,20200,1350,0.0],
'83':[9.5,2.0,22500,3400,2.0],'84':[11.0,3.0,20800,2300,1.0],'85':[6.0,2.0,22000,2200,1.5],
'86':[7.5,5.5,21500,1700,1.0],'87':[8.0,3.5,21000,1450,0.0],'88':[9.0,1.5,20500,1050,-0.5],
'89':[8.5,1.5,20800,1200,-0.5],'90':[9.5,3.5,22000,1700,0.5],
'91':[6.8,4.5,25000,3200,1.5],'92':[7.0,6.5,29000,6500,1.5],'93':[12.0,5.0,21000,4000,2.5],
'94':[7.5,4.5,24500,4800,2.0],'95':[8.0,3.5,23500,3000,1.5],
'971':[20.0,4.0,18500,2500,0.5],'972':[17.0,3.5,18000,2400,0.0],'973':[22.0,3.0,16500,2200,-0.5],
'974':[24.0,4.5,18000,2300,0.0],'976':[30.0,3.0,12000,1800,1.0],
};

let _citySearchTimer=null;
let _cityResults=[];
let _cityDDIndex=-1;
let _selectedCity=null;

function citySearch(val){
  clearTimeout(_citySearchTimer);
  const dd=document.getElementById('cityDropdown');
  const icon=document.getElementById('citySearchIcon');
  val=val.trim();
  if(val.length<2){dd.classList.remove('open');dd.innerHTML='';icon.innerHTML='🔍';icon.classList.remove('city-search-spin');return;}
  icon.innerHTML='⟳';icon.classList.add('city-search-spin');
  _citySearchTimer=setTimeout(()=>_doSearch(val),280);
}

async function _doSearch(val){
  const dd=document.getElementById('cityDropdown');
  const icon=document.getElementById('citySearchIcon');
  try{
    const isCP=/^\d{2,5}$/.test(val);
    let url;
    if(isCP){
      url=`https://geo.api.gouv.fr/communes?codePostal=${val}&fields=nom,code,codesPostaux,population,departement,region,centre&limit=10`;
    } else {
      url=`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(val)}&fields=nom,code,codesPostaux,population,departement,region,centre&boost=population&limit=8`;
    }
    const resp=await fetch(url);
    if(!resp.ok)throw new Error('API error');
    _cityResults=await resp.json();
    _cityDDIndex=-1;
    if(_cityResults.length===0){
      dd.innerHTML='<div class="city-dd-item" style="color:var(--ink3);pointer-events:none">Aucune commune trouvée</div>';
    } else {
      dd.innerHTML=_cityResults.map((c,i)=>{
        const cp=(c.codesPostaux||[])[0]||'';
        const pop=c.population?c.population.toLocaleString('fr-FR'):'?';
        const dept=c.departement?c.departement.nom:'';
        return`<div class="city-dd-item" data-i="${i}" onclick="citySelect(${i})" onmouseenter="_cityDDIndex=${i};_cityDDHighlight()">
          <span><span class="cdi-name">${c.nom}</span> <span class="cdi-cp">${cp}</span></span>
          <span class="cdi-pop">${pop} hab. · ${dept}</span>
        </div>`;
      }).join('');
    }
    dd.classList.add('open');
  }catch(e){
    console.warn('City search error:',e);
    dd.innerHTML='<div class="city-dd-item" style="color:var(--ru);pointer-events:none">Erreur réseau — vérifiez la connexion</div>';
    dd.classList.add('open');
  }
  icon.innerHTML='🔍';icon.classList.remove('city-search-spin');
}

function cityKeydown(e){
  const dd=document.getElementById('cityDropdown');
  if(!dd.classList.contains('open')||!_cityResults.length)return;
  if(e.key==='ArrowDown'){e.preventDefault();_cityDDIndex=Math.min(_cityDDIndex+1,_cityResults.length-1);_cityDDHighlight();}
  else if(e.key==='ArrowUp'){e.preventDefault();_cityDDIndex=Math.max(_cityDDIndex-1,0);_cityDDHighlight();}
  else if(e.key==='Enter'&&_cityDDIndex>=0){e.preventDefault();citySelect(_cityDDIndex);}
  else if(e.key==='Escape'){dd.classList.remove('open');}
}

function _cityDDHighlight(){
  const dd=document.getElementById('cityDropdown');
  dd.querySelectorAll('.city-dd-item').forEach((el,i)=>{
    el.classList.toggle('selected',i===_cityDDIndex);
    if(i===_cityDDIndex)el.scrollIntoView({block:'nearest'});
  });
}

function citySelect(idx){
  const c=_cityResults[idx];
  if(!c)return;
  _selectedCity=c;
  const dd=document.getElementById('cityDropdown');
  dd.classList.remove('open');
  document.getElementById('ville').value=c.nom;
  document.getElementById('codePostal').value=(c.codesPostaux||[])[0]||'';
  document.getElementById('codeCommune').value=c.code||'';
  _renderCityCard(c);
  // Fetch DVF data asynchronously
  _fetchDVF(c.code);
  if(typeof lv==='function')lv();
}

/* ── DVF FETCH — Données de vente réelles ── */
let _dvfData=null;
async function _fetchDVF(codeCommune){
  _dvfData=null;
  const card=document.getElementById('cityCard');
  const dvfZone=document.getElementById('dvfZone');
  if(dvfZone)dvfZone.innerHTML='<div style="font-size:.7rem;color:var(--ink3);padding:8px">⟳ Chargement DVF…</div>';
  const currentYear=new Date().getFullYear();
  const yearMin=currentYear-5;
  try{
    const url=`https://apidf-preprod.cerema.fr/dvf_opendata/mutations/?code_commune=${codeCommune}&nature_mutation=Vente&page_size=500&ordering=-date_mutation`;
    const resp=await fetch(url,{signal:AbortSignal.timeout(8000)});
    if(!resp.ok)throw new Error('DVF API '+resp.status);
    const data=await resp.json();
    const mutations=(data.results||data||[]).filter(m=>m.valeur_fonciere>0&&m.surface_reelle_bati>0);
    if(mutations.length<3){
      if(dvfZone)dvfZone.innerHTML='<div style="font-size:.68rem;color:var(--ink3);padding:6px">Peu de transactions DVF disponibles pour cette commune.</div>';
      _applySuggestions(null);
      return;
    }
    // Aggregate by year
    const byYear={};
    mutations.forEach(m=>{
      const y=parseInt((m.date_mutation||'').substring(0,4));
      if(y<yearMin||isNaN(y))return;
      if(!byYear[y])byYear[y]={totalPrix:0,totalSurf:0,count:0,types:{}};
      byYear[y].totalPrix+=m.valeur_fonciere;
      byYear[y].totalSurf+=m.surface_reelle_bati;
      byYear[y].count++;
      const t=m.type_local||'Autre';
      if(!byYear[y].types[t])byYear[y].types[t]={totalPrix:0,totalSurf:0,count:0};
      byYear[y].types[t].totalPrix+=m.valeur_fonciere;
      byYear[y].types[t].totalSurf+=m.surface_reelle_bati;
      byYear[y].types[t].count++;
    });
    const years=Object.keys(byYear).map(Number).sort();
    const history=years.map(y=>({
      annee:y,
      prixM2:Math.round(byYear[y].totalPrix/byYear[y].totalSurf),
      nbVentes:byYear[y].count,
      types:byYear[y].types
    }));
    // Global stats
    const allPrix=mutations.reduce((s,m)=>s+m.valeur_fonciere,0);
    const allSurf=mutations.reduce((s,m)=>s+m.surface_reelle_bati,0);
    const prixM2Global=Math.round(allPrix/allSurf);
    // Tendance: première vs dernière année
    let tendance=0;
    if(history.length>=2){
      const first=history[0].prixM2,last=history[history.length-1].prixM2;
      tendance=first>0?Math.round((last/first-1)*100/history.length*10)/10:0;
    }
    // Appart vs Maison
    const lastYear=history[history.length-1];
    const appart=lastYear?.types?.['Appartement'];
    const maison=lastYear?.types?.['Maison'];
    _dvfData={prixM2:prixM2Global,tendance,history,totalVentes:mutations.length,
      prixAppart:appart?Math.round(appart.totalPrix/appart.totalSurf):null,
      prixMaison:maison?Math.round(maison.totalPrix/maison.totalSurf):null};
    if(_selectedCity)_selectedCity._dvf=_dvfData;
    _renderDVFZone(_dvfData);
    _applySuggestions(_dvfData);
  }catch(e){
    console.warn('DVF fetch error:',e);
    if(dvfZone)dvfZone.innerHTML='<div style="font-size:.68rem;color:var(--ink4);padding:6px">DVF indisponible — données départementales utilisées.</div>';
    _applySuggestions(null);
  }
}

function _renderDVFZone(dvf){
  const zone=document.getElementById('dvfZone');
  if(!zone||!dvf)return;
  const maxP=Math.max(...dvf.history.map(h=>h.prixM2));
  const barColor=dvf.tendance>1?'var(--em)':dvf.tendance>=0?'var(--am)':'var(--ru)';
  zone.innerHTML=`
    <div style="font-size:.7rem;font-weight:700;color:var(--gold);margin-bottom:4px">📊 Prix réels DVF (ventes notariées)</div>
    <div class="city-kpis" style="margin-bottom:6px">
      <div class="city-kpi"><div class="ck-val" style="color:var(--gold)">${dvf.prixM2.toLocaleString('fr-FR')} €</div><div class="ck-lbl">Prix/m² moyen</div></div>
      ${dvf.prixAppart?`<div class="city-kpi"><div class="ck-val">${dvf.prixAppart.toLocaleString('fr-FR')} €</div><div class="ck-lbl">Appart/m²</div></div>`:''}
      ${dvf.prixMaison?`<div class="city-kpi"><div class="ck-val">${dvf.prixMaison.toLocaleString('fr-FR')} €</div><div class="ck-lbl">Maison/m²</div></div>`:''}
    </div>
    <div class="dvf-chart">${dvf.history.map(h=>{
      const pct=maxP>0?Math.round(h.prixM2/maxP*100):10;
      return`<div class="dvf-bar-wrap"><div class="dvf-bar-val">${h.prixM2.toLocaleString('fr-FR')}</div><div class="dvf-bar" style="height:${pct}%;background:${barColor}"></div><div class="dvf-bar-lbl">${h.annee}</div></div>`;
    }).join('')}</div>
    <div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--ink3)">
      <span>${dvf.totalVentes} ventes analysées</span>
      <span style="color:${barColor};font-weight:700">Tendance : ${dvf.tendance>0?'+':''}${dvf.tendance}%/an</span>
    </div>
    ${document.getElementById('prixAchat')?.value&&document.getElementById('surface')?.value?`
    <div style="margin-top:6px;padding:6px 8px;border-radius:var(--r);font-size:.7rem;background:${
      (()=>{const votreM2=Math.round(parseFloat(document.getElementById('prixAchat').value)/(parseFloat(document.getElementById('surface').value)||1));
      const diff=dvf.prixM2>0?Math.round((votreM2/dvf.prixM2-1)*100):0;
      return diff>10?'var(--ru-a)':diff<-10?'var(--em-a)':'var(--gold-a)';})()
    }">
      💰 Votre bien : <strong>${Math.round(parseFloat(document.getElementById('prixAchat').value)/(parseFloat(document.getElementById('surface').value)||1)).toLocaleString('fr-FR')} €/m²</strong>
      ${(()=>{const votreM2=Math.round(parseFloat(document.getElementById('prixAchat').value)/(parseFloat(document.getElementById('surface').value)||1));
      const diff=dvf.prixM2>0?Math.round((votreM2/dvf.prixM2-1)*100):0;
      return diff>0?`<span style="color:var(--ru)"> (+${diff}% vs marché)</span>`:`<span style="color:var(--em)"> (${diff}% vs marché)</span>`;})()}
    </div>`:''}
  `;
}

/* ── SUGGESTIONS AUTOMATIQUES ── */
function _applySuggestions(dvf){
  const sugZone=document.getElementById('citySuggestions');
  if(!sugZone||!_selectedCity)return;
  const pop=_selectedCity.population||0;
  const deptCode=_selectedCity.departement?.code||'';
  const dd=DEPT_DATA[deptCode]||null;
  const tension=getTensionLocative(_selectedCity.nom);
  const sugs=[];

  // Vacance suggestion
  let sugVac=tension?tension[2]:(pop>=100000?3:pop>=30000?5:pop>=10000?7:10);
  sugs.push({icon:'📋',label:'Vacance locative',val:sugVac+'%',field:'vacance',fieldVal:sugVac,
    tip:tension?'Basé sur la tension locative':'Estimation selon taille ville'});

  // Rent estimation
  const surface=parseFloat(document.getElementById('surface')?.value)||0;
  if(surface>0){
    const pM2=dvf?.prixM2||(dd?dd[3]:null);
    if(pM2){
      // Rendement locatif moyen estimé selon tension
      const rendLoc=tension?(tension[0]>=80?4.5:tension[0]>=60?5.5:6.5):(pop>=100000?4.5:5.5);
      const loyerEstime=Math.round(pM2*surface*rendLoc/100/12);
      sugs.push({icon:'🏠',label:'Loyer estimé',val:loyerEstime+' €/mois',field:'loyerMensuel',fieldVal:loyerEstime,
        tip:`Basé sur ${pM2.toLocaleString('fr-FR')} €/m² × ${rendLoc}% rendement`});
    }
  }

  // Charges suggestions
  const taxeFonc=pop>=200000?Math.round(surface*14):pop>=50000?Math.round(surface*12):Math.round(surface*10);
  sugs.push({icon:'🏛',label:'Taxe foncière estimée',val:taxeFonc+' €/an',field:'taxeFonc',fieldVal:taxeFonc,
    tip:'Estimation selon surface et taille ville'});

  const assurPNO=Math.max(80,Math.round(surface*2.8));
  sugs.push({icon:'🛡',label:'Assurance PNO',val:assurPNO+' €/an',field:'assurPNO',fieldVal:assurPNO,
    tip:'Estimation moyenne ~2.8 €/m²'});

  const copro=pop>=100000?Math.round(surface*25):Math.round(surface*18);
  sugs.push({icon:'🏢',label:'Charges copropriété',val:copro+' €/an',field:'chargesCopro',fieldVal:copro,
    tip:'Estimation moyenne selon localisation'});

  sugZone.innerHTML=`
    <div style="font-size:.68rem;font-weight:700;color:var(--gold);margin-bottom:4px">💡 Suggestions basées sur ${_selectedCity.nom}</div>
    <div class="city-suggestions">${sugs.map(s=>`
      <div class="city-sug" title="${s.tip}">
        <span class="cs-label">${s.icon} ${s.label}</span>
        <span style="display:flex;align-items:center;gap:6px">
          <span class="cs-val">${s.val}</span>
          <button class="cs-btn" onclick="event.stopPropagation();document.getElementById('${s.field}').value=${s.fieldVal};if(typeof lv==='function')lv();toast('${s.label} appliqué','ok')">Appliquer</button>
        </span>
      </div>`).join('')}
    </div>
  `;
}

function _renderCityCard(c){
  const card=document.getElementById('cityCard');
  if(!card)return;
  const deptCode=c.departement?.code||c.code?.substring(0,2)||'';
  const deptName=c.departement?.nom||'';
  const regionName=c.region?.nom||'';
  const pop=c.population||0;
  const dd=DEPT_DATA[deptCode]||DEPT_DATA[deptCode.replace(/^0/,'')]||null;
  const chomage=dd?dd[0]:null;
  const etudiants=dd?dd[1]:null;
  const revMedian=dd?dd[2]:null;
  const prixM2=dd?dd[3]:null;
  const tendance=dd?dd[4]:null;
  const tension=getTensionLocative(c.nom);
  const tensScore=tension?tension[0]:null;
  const tensLabel=tension?tension[1]:null;
  const tensVac=tension?tension[2]:null;
  const catIcon=pop>=200000?'🏙️':pop>=50000?'🏘️':pop>=10000?'🏠':'🌾';

  let attrScore=50;
  if(dd){
    attrScore+=chomage<7?12:chomage<9?6:chomage<12?0:-8;
    attrScore+=etudiants>6?10:etudiants>3?5:0;
    attrScore+=revMedian>24000?8:revMedian>21000?4:0;
    attrScore+=tendance>2?10:tendance>0?5:tendance>-1?0:-8;
  }
  if(tensScore)attrScore=Math.round(attrScore*0.5+tensScore*0.5);
  attrScore=Math.max(0,Math.min(100,attrScore));
  const attrColor=attrScore>=70?'var(--em)':attrScore>=45?'var(--am)':'var(--ru)';
  const attrLabel=attrScore>=75?'Excellent':attrScore>=60?'Attractif':attrScore>=45?'Correct':'Peu attractif';

  card.innerHTML=`
    <div class="city-card-header">
      <span class="cc-name">${catIcon} ${c.nom}</span>
      <span class="cc-dept">${deptName} (${deptCode}) · ${regionName}</span>
      <button class="cc-close" onclick="document.getElementById('cityCard').classList.remove('open')">✕</button>
    </div>
    <div class="city-kpis">
      <div class="city-kpi"><div class="ck-val">${pop.toLocaleString('fr-FR')}</div><div class="ck-lbl">Habitants</div></div>
      <div class="city-kpi"><div class="ck-val" style="color:${attrColor}">${attrScore}/100</div><div class="ck-lbl">Attractivité</div></div>
      <div class="city-kpi"><div class="ck-val">${prixM2?prixM2.toLocaleString('fr-FR')+' €':'—'}</div><div class="ck-lbl">Prix/m² dept.</div></div>
    </div>
    <div class="city-indicators">
      ${chomage!==null?`<div class="city-ind"><span class="ci-label">📊 Chômage (dept. ${deptCode})</span><span class="ci-val" style="color:${chomage<7?'var(--em)':chomage<10?'var(--am)':'var(--ru)'}">${chomage}%</span></div>`:''}
      ${etudiants!==null?`<div class="city-ind"><span class="ci-label">🎓 Étudiants (dept. ${deptCode})</span><span class="ci-val" style="color:${etudiants>5?'var(--em)':etudiants>2?'var(--am)':'var(--ink2)'}">${etudiants}%</span></div>`:''}
      ${revMedian!==null?`<div class="city-ind"><span class="ci-label">💰 Revenu médian (dept.)</span><span class="ci-val">${revMedian.toLocaleString('fr-FR')} €/an</span></div>`:''}
      ${tensLabel?`<div class="city-ind"><span class="ci-label">🏠 Tension locative</span><span class="ci-val" style="color:${tensScore>=70?'var(--em)':tensScore>=50?'var(--am)':'var(--ru)'}">${tensLabel} (${tensScore}/100)</span></div>`:''}
      ${tensVac?`<div class="city-ind"><span class="ci-label">📋 Vacance conseillée</span><span class="ci-val">${tensVac}%</span></div>`:''}
    </div>
    <div style="margin-top:8px">
      <div style="display:flex;justify-content:space-between;font-size:.68rem;margin-bottom:3px">
        <span style="color:var(--ink3)">Score attractivité</span>
        <span style="color:${attrColor};font-weight:700">${attrLabel}</span>
      </div>
      <div class="city-score-bar"><div class="city-score-fill" style="width:${attrScore}%;background:${attrColor}"></div></div>
    </div>
    <div id="dvfZone" style="margin-top:10px"></div>
    <div id="citySuggestions" style="margin-top:6px"></div>
    <div style="font-size:.55rem;color:var(--ink4);margin-top:6px">Sources : geo.api.gouv.fr, DVF/CEREMA (ventes notariées), INSEE 2023</div>
  `;
  card.classList.add('open');
  _selectedCity._attrScore=attrScore;
}

// Fermer dropdown au clic extérieur
document.addEventListener('click',e=>{
  const wrap=document.querySelector('.city-search-wrap');
  if(wrap&&!wrap.contains(e.target)){
    document.getElementById('cityDropdown')?.classList.remove('open');
  }
});

function getDPEAlert(dpe, typeLoc){
  if(!dpe||typeLoc==='courte')return null;
  const now=new Date().getFullYear();
  // Dates d'interdiction à la location (métropole)
  const bans={G:2025,F:2028,E:2034,D:2037};
  const banYear=bans[dpe];
  if(!banYear)return null;
  const yearsLeft=banYear-now;
  if(yearsLeft<=0) return{level:'err',msg:`DPE ${dpe} — Logement interdit à la location depuis ${banYear} (loi Climat). Travaux obligatoires.`};
  if(yearsLeft<=3) return{level:'warn',msg:`DPE ${dpe} — Interdiction de location en ${banYear} (dans ${yearsLeft} an${yearsLeft>1?'s':''}). Planifiez des travaux.`};
  return{level:'info',msg:`DPE ${dpe} — Restriction de location prévue en ${banYear}. Anticipez une rénovation.`};
}

function computeTRI(r){
  // Flux : -apport en an 0, puis CF annuels nets, + gain revente en dernier an
  const flux=[];
  const duree=r.dureePret||20;
  const tauxM=(r.tauxPret/100)/12;
  let cap=r.emp;
  let cumCF=0;

  for(let an=1;an<=r.horizon;an++){
    let iAn=0;
    if(an<=duree){
      for(let m=0;m<12;m++){const i=Math.max(0,cap)*tauxM;iAn+=i;cap-=r.mensHAss-i;}
    }
    const loyerAn=r.loyerAn*Math.pow(1+r.irlTaux/100,an-1);
    const chargesAn=r.charges*Math.pow(1+r.inflCharges/100,an-1);
    const mensAn=an<=duree?r.mensFin*12:0;
    const cfNetAn=loyerAn-chargesAn-r.impot-mensAn;
    cumCF+=cfNetAn;

    if(an===r.horizon){
      // Dernier flux : CF annuel + produit de vente net
      const prixRev=r.prixRevente||r.pa*Math.pow(1+r.revalBien/100,r.horizon);
      const pv=prixRev-r.pa;
      const abatt=r.horizon>=30?1:r.horizon>=6?Math.min(1,(r.horizon-5)*0.06):0;
      const pvImp=Math.max(0,pv*(1-abatt));
      const impotPV=pvImp*(0.19+0.172);
      const fraisVente=prixRev*0.06;
      const reventeNet=prixRev-impotPV-fraisVente;
      flux.push(cfNetAn+reventeNet);
    } else {
      flux.push(cfNetAn);
    }
  }

  const fluxInit=-(r.apport||r.coutTotal);
  const tri=calcTRI(fluxInit, flux);
  return tri;
}


/* ── PROGRESSION FORMULAIRE ─────────────────────── */
const REQUIRED_FIELDS=['prixAchat','loyerMensuel','apport','tauxPret','dureePret'];
const OPTIONAL_FIELDS=['surface','ville','dpe','taxeFonc','assurPNO','chargesCopro','fraisGestion','entretien'];

function updateFormProgress(){
  const req=REQUIRED_FIELDS.filter(id=>{const el=g(id);return el&&el.value.trim()!==''&&el.value!=='0';});
  const opt=OPTIONAL_FIELDS.filter(id=>{const el=g(id);return el&&el.value.trim()!==''&&el.value!=='0';});
  const score=Math.round((req.length/REQUIRED_FIELDS.length)*70+(opt.length/OPTIONAL_FIELDS.length)*30);
  const bar=g('formProgressBar');
  if(bar)bar.style.width=score+'%';
  // Couleur selon complétion
  if(bar){
    if(score>=70)bar.style.background='linear-gradient(90deg,var(--gold),var(--em))';
    else if(score>=40)bar.style.background='linear-gradient(90deg,var(--am),var(--gold))';
    else bar.style.background='var(--ru)';
  }
}

// Attacher aux inputs du formulaire
document.addEventListener('DOMContentLoaded',()=>{
  [...REQUIRED_FIELDS,...OPTIONAL_FIELDS].forEach(id=>{
    const el=g(id);
    if(el)el.addEventListener('input',updateFormProgress);
  });
  updateFormProgress();
});


/* ── RÉSUMÉ VOCAL ────────────────────────────────── */
let _speechActive=false;
function speakResults(){
  if(!R){toast('Calculez d\'abord un bien.','err');return;}
  if(!('speechSynthesis' in window)){toast('Synthèse vocale non supportée sur ce navigateur.','err');return;}

  if(_speechActive){
    window.speechSynthesis.cancel();
    _speechActive=false;
    const btn=g('btnSpeak');
    if(btn){btn.textContent='🔊 Écouter';btn.classList.remove('btn-d');}
    return;
  }

  const r=R;
  const cf=r.cfApres>=0?'positif de '+Math.abs(r.cfApres).toFixed(0)+' euros par mois':'négatif de '+Math.abs(r.cfApres).toFixed(0)+' euros par mois';
  const regime=r.bestReg?.res?.desc?.split('—')[0]?.trim()||'inconnu';
  const tri=computeTRI(r);
  const dpeAlert=getDPEAlert(r.dpe,r.isCD?'courte':'nue');

  const texte=`Voici le résumé de votre simulation ImmoSim.
    Bien : ${r.typeBien||'bien immobilier'}${r.ville?' à '+r.ville:''}.
    Coût total du projet : ${Math.round(r.coutTotal).toLocaleString('fr-FR')} euros.
    Mensualité de crédit : ${Math.round(r.mensFin)} euros par mois.
    Loyer mensuel : ${Math.round(r.loyerM)} euros.
    Rentabilité brute : ${r.rentBrute.toFixed(1)} pour cent.
    Rentabilité nette : ${r.rentNette.toFixed(1)} pour cent.
    Cash-flow après impôt : ${cf}.
    ${tri?'Taux de rendement interne sur '+r.horizon+' ans : '+tri.toFixed(1)+' pour cent.':''}
    Régime fiscal optimal : ${regime}.
    Score d'investissement : ${Math.round(r.score)} sur 100.
    ${dpeAlert?dpeAlert.msg:''}
    Fin du résumé.`;

  const utt=new SpeechSynthesisUtterance(texte);
  utt.lang='fr-FR';utt.rate=1.05;utt.pitch=1;
  // Choisir une voix française si disponible
  const voices=window.speechSynthesis.getVoices();
  const frVoice=voices.find(v=>v.lang.startsWith('fr'));
  if(frVoice)utt.voice=frVoice;

  utt.onend=()=>{
    _speechActive=false;
    const btn=g('btnSpeak');
    if(btn){btn.textContent='🔊 Écouter';btn.classList.remove('btn-d');}
  };
  utt.onerror=()=>{_speechActive=false;};

  window.speechSynthesis.speak(utt);
  _speechActive=true;
  const btn=g('btnSpeak');
  if(btn){btn.textContent='⏹ Arrêter';btn.classList.add('btn-d');}
}


/* ── UNDO / REDO FORMULAIRE ─────────────────────── */
const _undoStack=[];
const _redoStack=[];
let _undoPaused=false;
const UNDO_MAX=30;

function _captureState(){
  if(_undoPaused)return;
  const state=capForm();
  const last=_undoStack[_undoStack.length-1];
  // Ne pas dupliquer si identique
  if(last&&JSON.stringify(last)===JSON.stringify(state))return;
  _undoStack.push(state);
  if(_undoStack.length>UNDO_MAX)_undoStack.shift();
  _redoStack.length=0; // reset redo après une nouvelle action
  _updateUndoButtons();
}

function undoForm(){
  if(_undoStack.length<2)return;
  const current=_undoStack.pop();
  _redoStack.push(current);
  const prev=_undoStack[_undoStack.length-1];
  _undoPaused=true;
  restForm(prev);
  lv();
  _undoPaused=false;
  _updateUndoButtons();
  toast('Annulé ↩','ok');
}

function redoForm(){
  if(!_redoStack.length)return;
  const next=_redoStack.pop();
  _undoStack.push(next);
  _undoPaused=true;
  restForm(next);
  lv();
  _undoPaused=false;
  _updateUndoButtons();
  toast('Rétabli ↪','ok');
}

function _updateUndoButtons(){
  const u=g('btnUndo'),r=g('btnRedo');
  if(u)u.style.opacity=_undoStack.length>1?'1':'0.35';
  if(r)r.style.opacity=_redoStack.length?'1':'0.35';
}

// Capture automatique après chaque saisie (debounced)
let _undoTimer=null;
function _debouncedCapture(){
  clearTimeout(_undoTimer);
  _undoTimer=setTimeout(_captureState,600);
}

// Raccourcis clavier
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key==='z'){e.preventDefault();undoForm();}
  if((e.ctrlKey||e.metaKey)&&(e.shiftKey&&e.key==='z'||e.key==='y')){e.preventDefault();redoForm();}
});

function calcStressLoyer(r, pct){
  // CF avant impôt avec loyer réduit à pct%
  const loyerStress = r.loyerM * pct;
  const chargesMois = r.charges / 12;
  return loyerStress - r.mensFin - chargesMois;
}

function stressClass(cf){
  return cf > 0 ? 'pos' : cf > -200 ? 'warn' : 'neg';
}

function buildStressLoyerHTML(r){
  const s90 = calcStressLoyer(r, 0.90);
  const s80 = calcStressLoyer(r, 0.80);
  const s70 = calcStressLoyer(r, 0.70);
  return `
    <div class="rg">
      <div class="rg-label">Capacité de crédit — Loyer pris en compte</div>
      <div style="font-size:.67rem;color:var(--ink3);margin-bottom:6px;line-height:1.4">
        CF si la banque ne retient que 90%, 80% ou 70% du loyer (pratique courante lors d'un nouveau dossier de crédit)
      </div>
      <div class="stress-grid">
        <div class="stress-card ${stressClass(s90)}">
          <div class="stress-pct">90% loyer</div>
          <div class="stress-cf">${eur(s90)}</div>
          <div class="stress-sub">${eur(r.loyerM*0.90)}/mois retenu</div>
        </div>
        <div class="stress-card ${stressClass(s80)}">
          <div class="stress-pct">80% loyer</div>
          <div class="stress-cf">${eur(s80)}</div>
          <div class="stress-sub">${eur(r.loyerM*0.80)}/mois retenu</div>
        </div>
        <div class="stress-card ${stressClass(s70)}">
          <div class="stress-pct">70% loyer</div>
          <div class="stress-cf">${eur(s70)}</div>
          <div class="stress-sub">${eur(r.loyerM*0.70)}/mois retenu</div>
        </div>
      </div>
    </div>`;
}


/* ── RAPPORT EXPRESS ─────────────────────────────── */

/* ── THÈME COULEUR PERSONNALISABLE ──────────────── */

/* ═══════════════════════════════════════════════════
   SYSTÈME DE COULEURS PDF PERSONNALISABLES
═══════════════════════════════════════════════════ */

// Définition des couleurs avec leurs valeurs par défaut, label, catégorie
const PDF_COLOR_DEFS = [
  // Principales
  {id:'pdf_accent',    label:'Couleur accent / entêtes',  sub:'Sections, titres, bande latérale', cat:'primary', def:'#8c5f0f'},
  {id:'pdf_accent2',   label:'Couleur accent secondaire', sub:'Soulignements, bordures dorées',   cat:'primary', def:'#6e4a0a'},
  {id:'pdf_title',     label:'Couleur titre principal',   sub:'Nom du bien en couverture',        cat:'primary', def:'#12141f'},
  {id:'pdf_header_bg', label:'Fond en-tête / bandes',    sub:'Bandes décoratives de page',       cat:'primary', def:'#edf1fa'},
  // Sémantiques
  {id:'pdf_pos',       label:'Couleur positive (gain)',   sub:'Cash-flow positif, rentabilité',   cat:'semantic', def:'#16824b'},
  {id:'pdf_neg',       label:'Couleur négative (perte)',  sub:'Cash-flow négatif, risques',       cat:'semantic', def:'#be2d2d'},
  {id:'pdf_info',      label:'Couleur info (financement)',sub:'Mensualités, capital emprunté',    cat:'semantic', def:'#2d5fb9'},
  {id:'pdf_warn',      label:'Couleur avertissement',     sub:'Déficits, alertes modérées',       cat:'semantic', def:'#b46e14'},
  // Textes
  {id:'pdf_ink1',      label:'Texte principal',           sub:'Labels, titres de lignes',         cat:'bg', def:'#12141f'},
  {id:'pdf_ink2',      label:'Texte secondaire',          sub:'Valeurs normales',                 cat:'bg', def:'#41465f'},
  {id:'pdf_ink3',      label:'Texte discret',             sub:'Notes, pieds de page',             cat:'bg', def:'#787d96'},
  {id:'pdf_row1',      label:'Fond ligne paire',          sub:'Alternance tableau',               cat:'bg', def:'#f7f9fd'},
  {id:'pdf_row2',      label:'Fond ligne impaire',        sub:'Alternance tableau',               cat:'bg', def:'#fcfdff'},
  {id:'pdf_th_bg',     label:'Fond en-tête tableau',      sub:'Ligne de titre des tableaux',      cat:'bg', def:'#dce4f5'},
];

const PDF_PRESETS = {
  pro:   {pdf_accent:'#8c5f0f',pdf_accent2:'#6e4a0a',pdf_title:'#12141f',pdf_header_bg:'#edf1fa',pdf_pos:'#16824b',pdf_neg:'#be2d2d',pdf_info:'#2d5fb9',pdf_warn:'#b46e14',pdf_ink1:'#12141f',pdf_ink2:'#41465f',pdf_ink3:'#787d96',pdf_row1:'#f7f9fd',pdf_row2:'#fcfdff',pdf_th_bg:'#dce4f5'},
  bleu:  {pdf_accent:'#1e40af',pdf_accent2:'#1e3a8a',pdf_title:'#0f172a',pdf_header_bg:'#eff6ff',pdf_pos:'#15803d',pdf_neg:'#dc2626',pdf_info:'#2563eb',pdf_warn:'#d97706',pdf_ink1:'#0f172a',pdf_ink2:'#334155',pdf_ink3:'#64748b',pdf_row1:'#f8fafc',pdf_row2:'#f1f5f9',pdf_th_bg:'#dbeafe'},
  vert:  {pdf_accent:'#166534',pdf_accent2:'#14532d',pdf_title:'#052e16',pdf_header_bg:'#f0fdf4',pdf_pos:'#15803d',pdf_neg:'#dc2626',pdf_info:'#0369a1',pdf_warn:'#ca8a04',pdf_ink1:'#052e16',pdf_ink2:'#166534',pdf_ink3:'#4ade80',pdf_row1:'#f0fdf4',pdf_row2:'#dcfce7',pdf_th_bg:'#bbf7d0'},
};

function getPDFColors(){
  const saved=JSON.parse(localStorage.getItem('immoV8_pdfColors')||'{}');
  const result={};
  PDF_COLOR_DEFS.forEach(d=>{
    const el=document.getElementById(d.id);
    result[d.id]=(el&&el.value)?el.value:(saved[d.id]||d.def);
  });
  return result;
}
function savePDFColors(){
  const vals={};
  PDF_COLOR_DEFS.forEach(d=>{
    const el=document.getElementById(d.id);
    if(el)vals[d.id]=el.value;
  });
  localStorage.setItem('immoV8_pdfColors',JSON.stringify(vals));
  updateColorPreview();
  toast('Couleurs PDF enregistrées ✓','ok');
}
function resetAllColors(){
  PDF_COLOR_DEFS.forEach(d=>{const el=document.getElementById(d.id);if(el)el.value=d.def;});
  localStorage.removeItem('immoV8_pdfColors');
  updateColorPreview();
  toast('Couleurs réinitialisées','ok');
}
function applyColorPreset(name){
  const preset=PDF_PRESETS[name];if(!preset)return;
  Object.entries(preset).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val;});
  updateColorPreview();
  toast('Preset "'+name+'" appliqué — cliquez Enregistrer','ok');
}
function updateColorPreview(){
  const bar=document.getElementById('colorPreviewBar');if(!bar)return;
  const ids=['pdf_accent','pdf_pos','pdf_neg','pdf_info','pdf_warn','pdf_header_bg','pdf_th_bg'];
  bar.innerHTML=ids.map(id=>{
    const el=document.getElementById(id);
    const col=el?el.value:(getPDFColors()[id]||'#ccc');
    return`<div style="background:${col};height:100%"></div>`;
  }).join('');
}
function buildColorRows(){
  const colors=getPDFColors();
  ['primary','semantic','bg'].forEach(cat=>{
    const suffix={primary:'Primary',semantic:'Semantic',bg:'Bg'}[cat];
    const el=document.getElementById('colorRows'+suffix);
    if(!el)return;
    const defs=PDF_COLOR_DEFS.filter(d=>d.cat===cat);
    el.innerHTML=defs.map(d=>`
      <div class="color-row">
        <div style="flex:1">
          <span class="color-row-label">${d.label}</span>
          <span class="color-row-sub">${d.sub}</span>
        </div>
        <div class="color-picker-wrap">
          <input type="color" id="${d.id}" value="${colors[d.id]||d.def}" oninput="updateColorPreview()"/>
          <button class="color-reset" onclick="document.getElementById('${d.id}').value='${d.def}';updateColorPreview()" title="Réinitialiser">↺</button>
        </div>
      </div>`).join('');
  });
  updateColorPreview();
}

function switchModalTab(tabId, btn){
  document.querySelectorAll('.modal-tabpane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.modal-tab').forEach(b=>b.classList.remove('active'));
  const panel=document.getElementById(tabId);
  if(panel)panel.classList.add('active');
  if(btn)btn.classList.add('active');
  if(tabId==='tab-colors')buildColorRows();
}

// Colors are saved via the main saveIdentity function below

function setThemeColor(hex){
  if(g('id_color'))g('id_color').value=hex;
}
function hexToRgb(hex){
  if(!hex||typeof hex!=='string'||hex.length<7)return[0,0,0];
  const r=parseInt(hex.slice(1,3),16),g_=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return[isNaN(r)?0:r,isNaN(g_)?0:g_,isNaN(b)?0:b];
}
function getThemeColor(){
  const id=getIdentity();
  return id.themeColor||'#dba84a';
}


/* ── ONBOARDING ──────────────────────────────────── */
let _obStep=0;
const _obTotal=6;
function openOnboard(){
  _obStep=0;_obRender();
  document.getElementById('onboardOverlay').classList.add('open');
}
function closeOnboard(){
  document.getElementById('onboardOverlay').classList.remove('open');
  localStorage.setItem('immoV8_onboarded','1');
}
function obNav(dir){
  _obStep=Math.max(0,Math.min(_obTotal-1,_obStep+dir));
  _obRender();
}
function _obRender(){
  for(let i=0;i<_obTotal;i++){
    const s=document.getElementById('ob'+i);
    const d=document.getElementById('obdot'+i);
    if(s)s.classList.toggle('active',i===_obStep);
    if(d)d.classList.toggle('active',i===_obStep);
  }
  const prev=document.getElementById('obPrev');
  const next=document.getElementById('obNext');
  if(prev)prev.style.display=_obStep>0?'':'none';
  if(next)next.textContent=_obStep===_obTotal-1?'Commencer !':'Suivant →';
  if(_obStep===_obTotal-1&&next)next.onclick=closeOnboard;
  else if(next)next.onclick=()=>obNav(1);
}
// Lancer au premier chargement
(function(){
  if(!localStorage.getItem('immoV8_onboarded')){
    setTimeout(openOnboard,600);
  }
})();

function calcExpress(){
  const prix=+g('ex_prix').value||0;
  const loyer=+g('ex_loyer').value||0;
  const apport=+g('ex_apport').value||0;
  const taux=+g('ex_taux').value||3.65;
  const duree=+g('ex_duree').value||20;
  if(!prix||!loyer){g('expressResult').style.display='none';return;}
  const notaire=Math.round(prix*0.085);
  const cout=prix+notaire+(prix*0.04); // +4% frais agence estimés
  const emp=Math.max(0,cout-apport);
  const mens=calcMens(emp,taux,duree);
  const charges=loyer*12*0.25; // estimation charges à 25%
  const rentBrute=(loyer*12/cout)*100;
  const cf=(loyer*12-charges)/12-mens;
  const ratio=loyer>0?(mens/loyer)*100:0;
  g('er_notaire').textContent=eur(notaire,0);
  g('er_cout').textContent=eur(cout,0);
  g('er_mens').textContent=eur(mens)+'/mois';
  g('er_rent').textContent=pct(rentBrute);
  g('er_cf').textContent=eur(cf)+'/mois';
  g('er_cf').className='er-val '+(cf>=0?'pos':'neg');
  g('er_ratio').textContent=pct(ratio);
  g('er_ratio').className='er-val '+(ratio<80?'pos':ratio<100?'warn':'neg');
  g('expressResult').style.display='block';
}
function importExpress(){
  const prix=+g('ex_prix').value||0;
  const loyer=+g('ex_loyer').value||0;
  const apport=+g('ex_apport').value||0;
  const taux=+g('ex_taux').value||3.65;
  const duree=+g('ex_duree').value||20;
  if(!prix)return;
  sv('prixAchat',prix);sv('prixAffiche',prix);sv('loyerMensuel',loyer);
  sv('apport',apport);sv('tauxPret',taux);sv('dureePret',duree);sv('emprunte','');
  sv('fraisNotaire','');sv('fraisAgence',Math.round(prix*0.04));
  lv();closeModal('expressModal');gv('sim');
  toast('Données importées dans le simulateur','ok');
}


/* ── COMPARATEUR MULTI-BIENS ─────────────────────── */
function buildComparateur(){
  const portf=getPortf();
  const el=g('compContent');
  if(!el)return;
  if(portf.length<1){
    el.innerHTML='<div class="comp-empty">Sauvegardez au moins 2 biens dans votre portefeuille pour les comparer ici.</div>';
    return;
  }
  // Trouver le meilleur CF
  const bestCF=Math.max(...portf.map(p=>p.cfApres||p.cfAvant||0));
  el.innerHTML='<div class="comp-grid">'+portf.map(p=>{
    const cf=p.cfApres??p.cfAvant??0;
    const isBest=cf===bestCF&&portf.length>1;
    return `<div class="comp-card">
      ${isBest?'<div class="comp-winner">Meilleur CF</div>':''}
      <div class="comp-card-head">
        <span class="comp-card-name">${p.nom||'—'}</span>
        <span style="font-size:.7rem;color:var(--ink3)">${p.score||0}/100</span>
      </div>
      <div class="comp-card-body">
        <div class="comp-row"><span>Prix d'achat</span><span class="cv gold">${eur(p.pa||0,0)}</span></div>
        <div class="comp-row"><span>Loyer mensuel</span><span class="cv">${eur(p.loyerM||0)}</span></div>
        <div class="comp-row"><span>Mensualité</span><span class="cv">${eur(p.mensFin||0)}</span></div>
        <div class="comp-row"><span>Rent. brute</span><span class="cv gold">${pct(p.rentBrute||0)}</span></div>
        <div class="comp-row"><span>Rent. nette</span><span class="cv gold">${pct(p.rentNette||0)}</span></div>
        <div class="comp-row"><span>CF avant impôt</span><span class="cv ${(p.cfAvant||0)>=0?'pos':'neg'}">${eur(p.cfAvant||0)}/mois</span></div>
        <div class="comp-row"><span>CF après impôt</span><span class="cv ${cf>=0?'pos':'neg'}">${eur(cf)}/mois</span></div>
        <div class="comp-row"><span>Régime optimal</span><span class="cv" style="font-size:.72rem">${p.bestReg||'—'}</span></div>
      </div>
    </div>`;
  }).join('')+'</div>';
}

function exportCompPDF(){
  const portf=getPortf();
  if(portf.length<1){toast('Aucun bien à comparer.','err');return;}
  if(typeof window.jspdf==='undefined'){toast('jsPDF non disponible.','err');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const W=297,H=210,M=12,CW=W-2*M;
  const _tc=hexToRgb(getThemeColor());
  const _pc2=getPDFColors();
  const _h2=k=>hexToRgb(_pc2[k]||'#000000');
  const GOLD=_h2('pdf_accent'),INK2=_h2('pdf_ink2'),INK3=_h2('pdf_ink3'),DARK3=_h2('pdf_header_bg');
  const GREEN=_h2('pdf_pos'),RED=_h2('pdf_neg');
  const TH_BG2=_h2('pdf_th_bg');
  const ROW1_2=_h2('pdf_row1'),ROW2_2=_h2('pdf_row2');
  // Fond
  doc.setFillColor(255,255,255);doc.rect(0,0,W,H,'F');
  doc.setFillColor(...GOLD);doc.rect(0,0,3,H,'F');
  doc.setFillColor(...TH_BG2);doc.rect(3,0,5,H,'F');
  // Titre
  doc.setTextColor(...GOLD);doc.setFontSize(11);doc.setFont('helvetica','bold');
  doc.text('COMPARATIF DE BIENS IMMOBILIERS — IMMOSIM V8',M+5,14);
  doc.setDrawColor(...GOLD);doc.setLineWidth(.5);doc.line(M,18,W-M,18);
  // En-têtes colonnes
  const colW=Math.min(55,(CW-30)/Math.min(portf.length,5));
  const labelCol=30;
  const labels=['Prix achat','Loyer/mois','Mensualité','Rent. brute','Rent. nette','CF av. impôt','CF ap. impôt','Score','Régime optimal'];
  let ty=30;
  doc.setFillColor(...TH_BG2);doc.rect(M,ty-5,CW,8,'F');
  doc.setTextColor(...GOLD);doc.setFontSize(7);doc.setFont('helvetica','bold');
  doc.text('Indicateur',M+3,ty);
  portf.slice(0,5).forEach((p,i)=>{
    doc.text((p.nom||'Bien '+(i+1)).substring(0,18),M+labelCol+i*colW+colW/2,ty,{align:'center'});
  });
  ty+=10;
  const bestCF=Math.max(...portf.map(p=>+(p.cfApres??p.cfAvant??0)));
  labels.forEach((lbl,li)=>{
    const isAlt=li%2===0;
    doc.setFillColor(...(isAlt?ROW1_2:ROW2_2));
    doc.rect(M,ty-4,CW,7,'F');
    doc.setTextColor(...INK2);doc.setFontSize(7);doc.setFont('helvetica','normal');
    doc.text(lbl,M+3,ty);
    portf.slice(0,5).forEach((p,i)=>{
      const vals=[p.pa,p.loyerM,p.mensFin,p.rentBrute,p.rentNette,p.cfAvant,p.cfApres??p.cfAvant,p.score,p.bestReg];
      const v=vals[li];
      let txt='—',col=INK2;
      if(li<=6&&v!=null)txt=li>=3&&li<=4?pct(v):eur(v)+(li>=5&&li<=6?'/mois':'');
      else if(li===7&&v!=null)txt=Math.round(v)+'/100';
      else if(li===8&&v)txt=String(v).substring(0,20);
      if(li===6){col=(v??0)===bestCF&&portf.length>1?GREEN:(v??0)>=0?GREEN:RED;}
      doc.setTextColor(...col);doc.setFont('helvetica',li===6&&(v??0)===bestCF?'bold':'normal');
      doc.text(txt,M+labelCol+i*colW+colW/2,ty,{align:'center'});
    });
    ty+=7;
  });
  doc.setTextColor(...INK3);doc.setFontSize(6);
  doc.text('ImmoSim V8 — Comparatif — '+new Date().toLocaleDateString('fr-FR'),M,H-5);
  doc.save('ImmoSim_Comparatif_'+new Date().toISOString().slice(0,10)+'.pdf');
  toast('PDF comparatif exporté ✓','ok');
}


/* ── DÉFICIT FONCIER PLURIANNUEL ─────────────────── */

/* ── REMBOURSEMENT ANTICIPÉ ──────────────────────── */
function calcIRA(){
  const capital=+g('ira_capital').value||0;
  const taux=(+g('ira_taux').value||3.65)/100;
  const duree=+g('ira_duree').value||20;
  const anRemb=+g('ira_an').value||5;
  const montantRemb=+g('ira_montant').value||0;
  const el=g('iraResult');if(!el||!capital)return;

  const tauxM=taux/12;
  const mens=capital*tauxM*Math.pow(1+tauxM,duree*12)/(Math.pow(1+tauxM,duree*12)-1);

  // Capital restant à l'année de remboursement
  let cap=capital;
  let intTotalAvant=0;
  for(let m=0;m<anRemb*12;m++){
    const int=cap*tauxM;
    intTotalAvant+=int;
    cap-=mens-int;
  }
  cap=Math.max(0,cap);

  const rembEff=montantRemb>0?Math.min(montantRemb,cap):cap;
  const isTotalRemb=rembEff>=cap-1;

  // IRA = min(3% capital restant, 6 mois intérêts)
  const ira3pct=rembEff*0.03;
  const ira6mois=rembEff*taux*6/12;
  const ira=Math.min(ira3pct,ira6mois);

  // Scénario sans remboursement : intérêts restants à payer
  let capSans=cap,intSans=0;
  const moisRestants=(duree-anRemb)*12;
  for(let m=0;m<moisRestants;m++){const int=capSans*tauxM;intSans+=int;capSans-=mens-int;}

  // Scénario avec remboursement partiel : intérêts restants
  let capAvec=cap-rembEff,intAvec=0;
  if(!isTotalRemb&&capAvec>0){
    // Recalculer mensualité sur capital restant, même durée
    const mensAvec=capAvec*tauxM*Math.pow(1+tauxM,moisRestants)/(Math.pow(1+tauxM,moisRestants)-1);
    let capA=capAvec;
    for(let m=0;m<moisRestants;m++){const int=capA*tauxM;intAvec+=int;capA-=mensAvec-int;}
  }

  const economieBrute=intSans-intAvec;
  const economieNette=economieBrute-ira;
  const pointMort=ira>0&&economieNette>0?Math.ceil(ira/(economieBrute/moisRestants)):0;

  el.innerHTML=`
    <div class="card">
      <h3>Résultats du remboursement anticipé</h3>
      <div class="grid2" style="gap:8px;margin-bottom:14px">
        <div class="kpi"><div class="kl">Capital restant dû (an ${anRemb})</div><div class="kv gold">${eur(cap,0)}</div></div>
        <div class="kpi"><div class="kl">Montant remboursé</div><div class="kv gold">${eur(rembEff,0)}</div></div>
        <div class="kpi"><div class="kl">IRA (pénalités)</div><div class="kv neg">${eur(ira,0)}</div></div>
        <div class="kpi"><div class="kl">Règle retenue</div><div class="kv" style="font-size:.72rem">${ira===ira3pct?'3% capital (min)':'6 mois intérêts (min)'}</div></div>
        <div class="kpi"><div class="kl">Économie d'intérêts brute</div><div class="kv pos">${eur(economieBrute,0)}</div></div>
        <div class="kpi"><div class="kl">Économie nette (après IRA)</div><div class="kv ${economieNette>=0?'pos':'neg'}">${eur(economieNette,0)}</div></div>
      </div>
      ${pointMort>0?`<div class="rec-box" style="background:var(--em-a);border-color:var(--em-b)">
        <strong style="color:var(--em)">Point mort : ${pointMort} mois</strong> — L'opération devient rentable après ${Math.ceil(pointMort/12)} an${pointMort>12?'s':''} ${pointMort%12>0?'et '+(pointMort%12)+' mois':''}.
      </div>`:''}
      ${isTotalRemb?`<div class="rec-box" style="background:var(--am-a);border-color:rgba(245,165,32,.25)">
        <strong style="color:var(--am)">Remboursement total</strong> — Vous économisez ${eur(economieNette,0)} net en soldant le crédit maintenant.
      </div>`:''}
      <p class="disc" style="margin-top:10px">IRA plafonnées légalement (art. R313-25 Code conso). Non applicables si remboursement résulte d'une vente suite à mobilité professionnelle.</p>
    </div>`;
}

/* ── PREFILL FUNCTIONS (from simulator) ─────────── */
function prefillDeficit(){
  if(!R){toast('Calculez d\'abord un bien dans le simulateur','err');return}
  sv('df_loyer', Math.round(R.loyerAn));
  sv('df_charges', Math.round(R.charges));
  sv('df_interets', Math.round(R.interets));
  sv('df_travaux', Math.round(R.tr||0));
  g('df_tmi').value = R.tmi || 30;
  calcDeficit();
  toast('Données importées du simulateur ✓','ok');
}
function prefillDenormandie(){
  if(!R){toast('Calculez d\'abord un bien dans le simulateur','err');return}
  sv('dn_prix', Math.round(R.pa));
  sv('dn_travaux', Math.round(R.tr||0));
  sv('dn_loyer', Math.round(R.loyerM));
  sv('dn_charges', Math.round(R.charges));
  g('dn_tmi').value = R.tmi || 30;
  calcDenormandie();
  toast('Données importées du simulateur ✓','ok');
}
function prefillIRA(){
  if(!R){toast('Calculez d\'abord un bien dans le simulateur','err');return}
  sv('ira_capital', Math.round(R.emp));
  sv('ira_taux', R.tauxPret);
  sv('ira_duree', R.dureePret);
  sv('ira_an', 5);
  calcIRA();
  toast('Données importées du simulateur ✓','ok');
}

function calcDeficit(){
  const loyer=+g('df_loyer').value||0;
  const charges=+g('df_charges').value||0;
  const interets=+g('df_interets').value||0;
  const travaux=+g('df_travaux').value||0;
  const tmi=(+g('df_tmi').value||30)/100;
  const ps=0.172;
  let reportInitial=+g('df_report').value||0;
  const el=g('deficitResult');if(!el||!loyer)return;

  const MAX_IMPUTABLE=10700; // plafond annuel déficit sur revenu global
  let rows='';
  let reportFoncier=reportInitial;
  let cumEco=0;

  for(let an=1;an<=10;an++){
    // Revenus fonciers nets
    const chargesTotal=charges+interets+travaux;
    const revFoncier=loyer-chargesTotal;
    let baseIR=0,basePS=0;
    let deficitCree=0,deficitImpute=0,reportAnSuivant=0;
    let ecoIR=0,ecoPS=0;

    if(revFoncier>=0){
      // Bénéfice foncier : on impute d'abord le report
      const apresReport=Math.max(0,revFoncier-reportFoncier);
      reportFoncier=Math.max(0,reportFoncier-revFoncier);
      baseIR=apresReport;basePS=apresReport;
    } else {
      // Déficit foncier
      deficitCree=Math.abs(revFoncier);
      deficitImpute=Math.min(deficitCree,MAX_IMPUTABLE); // sur revenu global
      reportAnSuivant=deficitCree-deficitImpute+reportFoncier;
      ecoIR=deficitImpute*(tmi+ps); // économie sur revenu global (tmi+ps)
      reportFoncier=reportAnSuivant;
    }

    if(baseIR>0){
      ecoIR=-(baseIR*tmi); // impôt à payer
      ecoPS=-(basePS*ps);
    }
    const ecoAn=ecoIR+(baseIR>0?ecoPS:0);
    cumEco+=ecoAn;

    const cls=v=>v>=0?'pos':'neg';
    rows+=`<tr>
      <td>An ${an}</td>
      <td>${eur(loyer,0)}</td>
      <td class="${cls(-chargesTotal)}">${eur(chargesTotal,0)}</td>
      <td class="${revFoncier>=0?'pos':'neg'}">${eur(revFoncier,0)}</td>
      <td class="gold">${deficitImpute>0?eur(deficitImpute,0):'—'}</td>
      <td class="gold">${reportFoncier>0?eur(reportFoncier,0):'0 €'}</td>
      <td class="${ecoAn>=0?'pos':'neg'}">${eur(ecoAn,0)}</td>
    </tr>`;
  }

  el.innerHTML=`
    <div class="card">
      <h3>Projection sur 10 ans</h3>
      <div style="overflow-x:auto">
      <table class="deficit-table">
        <thead><tr>
          <th>Année</th><th>Loyer</th><th>Charges</th>
          <th>Résultat</th><th>Déficit imputé</th><th>Report N+1</th><th>Éco. fiscale</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="6">ÉCONOMIE FISCALE CUMULÉE 10 ANS</td>
          <td class="${cumEco>=0?'pos':'neg'}">${eur(cumEco,0)}</td>
        </tr></tfoot>
      </table>
      </div>
      <p class="disc" style="margin-top:10px">⚠ Calcul simplifié. Le déficit imputable sur le revenu global est plafonné à 10 700€/an hors intérêts. Consultez un expert-comptable.</p>
    </div>`;
}


/* ── DENORMANDIE ─────────────────────────────────── */
function calcDenormandie(){
  const prix=+g('dn_prix').value||0;
  const travaux=+g('dn_travaux').value||0;
  const duree=+g('dn_duree').value||9;
  const tmi=(+g('dn_tmi').value||30)/100;
  const ps=0.172;
  const loyer=+g('dn_loyer').value||0;
  const charges=+g('dn_charges').value||0;
  const el=g('denormandieResult');if(!el||!prix)return;

  // Base de calcul = prix + travaux, plafonnée à 300 000€
  const base=Math.min(prix+travaux,300000);
  // Taux de réduction selon durée
  const taux={6:0.12,9:0.18,12:0.21}[duree]||0.18;
  const reductionTotale=base*taux;
  const reductionAnnuelle=reductionTotale/duree;

  // Condition travaux ≥ 25%
  const pctTravaux=prix>0?(travaux/(prix+travaux))*100:0;
  const travauxOK=pctTravaux>=25;

  // Rentabilité avec réduction
  const loyerAn=loyer*12;
  const revImposable=Math.max(0,loyerAn*0.70); // micro-foncier simplifié
  const impotSansReduction=revImposable*(tmi+ps);
  const impotAvecReduction=Math.max(0,impotSansReduction-reductionAnnuelle);
  const economieReelle=impotSansReduction-impotAvecReduction;

  const cfAvant=(loyerAn-charges)/12;
  const cfApres=cfAvant-(impotAvecReduction/12);
  const rentBrute=prix>0?(loyerAn/(prix+travaux))*100:0;

  const warn=travauxOK?'':`<div style="background:var(--ru-a);border:1px solid var(--ru-b);border-radius:var(--r);padding:8px 12px;margin-bottom:12px;font-size:.76rem;color:var(--ru)">
    ⚠ Travaux insuffisants : ${pctTravaux.toFixed(1)}% du coût total. Minimum requis : <strong>25%</strong>.
  </div>`;

  el.innerHTML=`
    <div class="card">
      <h3>Résultats Denormandie</h3>
      ${warn}
      <div class="grid2" style="gap:8px;margin-bottom:14px">
        <div class="kpi"><div class="kl">Base de calcul (plafonné 300k€)</div><div class="kv gold">${eur(base,0)}</div></div>
        <div class="kpi"><div class="kl">Taux de réduction</div><div class="kv gold">${pct(taux*100)}</div></div>
        <div class="kpi"><div class="kl">Réduction totale sur ${duree} ans</div><div class="kv" style="color:var(--em)">${eur(reductionTotale,0)}</div></div>
        <div class="kpi"><div class="kl">Réduction annuelle</div><div class="kv" style="color:var(--em)">${eur(reductionAnnuelle,0)}</div></div>
        <div class="kpi"><div class="kl">Rentabilité brute</div><div class="kv gold">${pct(rentBrute)}</div></div>
        <div class="kpi"><div class="kl">% travaux / coût total</div><div class="kv ${travauxOK?'':'neg'}">${pctTravaux.toFixed(1)}% ${travauxOK?'✓':' < 25%'}</div></div>
        <div class="kpi"><div class="kl">CF avant impôt/mois</div><div class="kv ${cfAvant>=0?'pos':'neg'}">${eur(cfAvant)}</div></div>
        <div class="kpi"><div class="kl">CF après impôt réduit/mois</div><div class="kv ${cfApres>=0?'pos':'neg'}">${eur(cfApres)}</div></div>
      </div>
      <table class="deficit-table">
        <thead><tr><th>Année</th><th>Loyer brut</th><th>Charges</th><th>Réduction IS</th><th>Impôt net</th><th>CF après impôt</th></tr></thead>
        <tbody>${Array.from({length:duree},(_,i)=>`<tr>
          <td>An ${i+1}</td>
          <td>${eur(loyerAn,0)}</td>
          <td class="neg">${eur(charges,0)}</td>
          <td class="pos">${eur(reductionAnnuelle,0)}</td>
          <td class="neg">${eur(impotAvecReduction,0)}</td>
          <td class="${cfApres>=0?'pos':'neg'}">${eur(cfApres)}/mois</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr>
          <td colspan="2">RÉDUCTION CUMULÉE</td>
          <td></td>
          <td class="pos">${eur(reductionTotale,0)}</td>
          <td></td>
          <td></td>
        </tr></tfoot>
      </table>
      <p class="disc" style="margin-top:10px">⚠ Simulation simplifiée. Villes éligibles : liste officielle Action Cœur de Ville. Plafonds de loyer et de ressources locataires à vérifier selon la zone.</p>
    </div>`;
}


/* ── IMPORT URL ANNONCE ──────────────────────────── */
async function fetchAnnonceURL(){
  const url=g('annonceURL')?.value?.trim();
  const status=g('urlStatus');
  if(!url){if(status)status.textContent='Collez une URL valide.';return;}
  const key=getKey();
  if(!key){toast('Cle API Claude requise pour analyser l\'URL.','err');return;}

  // Afficher spinner
  g('fetchTxt').style.display='none';g('fetchSpin').style.display='';
  g('btnFetchURL').disabled=true;
  if(status)status.textContent='Récupération du contenu…';

  try{
    // On passe l'URL à Claude directement — il va la "lire" via son contexte
    // En pratique on demande à l'IA d'extraire depuis l'URL en la passant dans le prompt
    const prompt=`Voici l'URL d'une annonce immobilière : ${url}

Même si tu ne peux pas accéder à cette URL directement, essaie d'extraire ce que tu peux du texte de l'URL elle-même (ville, type de bien, parfois le prix y figure).
Ensuite, indique à l'utilisateur de copier-coller le texte de la page pour une extraction complète.
Extrais ce que tu peux et formate en JSON : {prix, surface, ville, typeBien, dpe, loyerEstime, charges, description, source}.
Réponds UNIQUEMENT en JSON valide, sans markdown.`;

    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:prompt}]})
    });
    const data=await resp.json();
    const txt=data.content?.map(b=>b.text||'').join('')||'';
    // Essayer de parser
    try{
      const clean=txt.replace(/```json|```/g,'').trim();
      const parsed=JSON.parse(clean);
      // Pré-remplir le textarea avec une description de l'annonce
      const desc=Object.entries(parsed).filter(([k,v])=>v&&v!=='null').map(([k,v])=>k+': '+v).join('\n');
      g('annonceTxt').value=desc;
      if(status)status.textContent='Donnees partielles extraites. Affinez en lancant l\'extraction IA.';
    }catch{
      // L'IA a donné du texte libre → le coller dans le textarea
      g('annonceTxt').value=txt;
      if(status)status.textContent='Contenu charge. Lancez l\'extraction IA pour analyser.';
    }
  }catch(err){
    if(status)status.textContent='Erreur : '+err.message+'. Copiez-collez le texte manuellement.';
  }finally{
    g('fetchTxt').style.display='';g('fetchSpin').style.display='none';
    g('btnFetchURL').disabled=false;
  }
}


/* ── EXPORT GOOGLE SHEETS ────────────────────────── */
function exportGSheets(){
  if(!R){toast('Calculez d\'abord un bien.','err');return;}
  const r=R;
  // Construire le tableau CSV encodé pour Google Sheets
  const rows=[
    ['ImmoSim V8 — Simulation patrimoniale',''],
    ['Date',new Date().toLocaleDateString('fr-FR')],
    ['',''],
    ['BIEN',''],
    ['Ville',r.ville||'—'],
    ['Type',r.typeBien||'—'],
    ['Surface (m2)',r.surface||'—'],
    ['DPE',r.dpe||'—'],
    ['Prix d\'achat',r.pa||0],
    ['Coût total',r.coutTotal||0],
    ['',''],
    ['FINANCEMENT',''],
    ['Apport',r.apport||0],
    ['Emprunté',r.emp||0],
    ['Taux (%)',r.tauxPret||0],
    ['Durée (ans)',r.dureePret||0],
    ['Mensualité',r.mensFin||0],
    ['',''],
    ['REVENUS & CHARGES',''],
    ['Loyer mensuel',r.loyerM||0],
    ['Loyer annuel',r.loyerAn||0],
    ['Charges annuelles',r.charges||0],
    ['',''],
    ['RENTABILITÉ',''],
    ['Rentabilité brute (%)',r.rentBrute?.toFixed(2)||0],
    ['Rentabilité nette (%)',r.rentNette?.toFixed(2)||0],
    ['Cash-flow avant impôt (mois)',r.cfAvant?.toFixed(2)||0],
    ['Cash-flow après impôt (mois)',r.cfApres?.toFixed(2)||0],
    ['Impôt estimé/an',r.impot?.toFixed(2)||0],
    ['Régime fiscal',r.desc||'—'],
    ['Score d\'investissement',Math.round(r.score||0)+'/100'],
    ['',''],
    ['STRESS LOYER',''],
    ['CF à 90% loyer',(r.loyerM*0.9-r.mensFin-r.charges/12).toFixed(2)],
    ['CF à 80% loyer',(r.loyerM*0.8-r.mensFin-r.charges/12).toFixed(2)],
    ['CF à 70% loyer',(r.loyerM*0.7-r.mensFin-r.charges/12).toFixed(2)],
  ];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const csvUrl=URL.createObjectURL(blob);
  // Télécharger le CSV + ouvrir Google Sheets import
  const a=document.createElement('a');
  a.href=csvUrl;
  a.download='ImmoSim_V8_'+(r.ville||'bien').replace(/\s+/g,'_')+'.csv';
  a.click();
  // Délai puis ouvrir Google Sheets
  setTimeout(()=>{
    window.open('https://sheets.new','_blank');
    toast('CSV téléchargé — importez-le dans Google Sheets via Fichier → Importer','ok');
  },400);
}


/* ═══════════════════════════════════════════════════
   SHARED — Génère le HTML complet du rapport
   Utilisé par exportDOCX() et exportGoogleDocs()
═══════════════════════════════════════════════════ */
function _buildReportHTML(forWord){
  const r=R;
  const id=getIdentity();
  const pc=getPDFColors();
  const acc=pc.pdf_accent||'#8c5f0f';
  const pos=pc.pdf_pos||'#16824b';
  const neg=pc.pdf_neg||'#be2d2d';
  const blue=pc.pdf_info||'#2d5fb9';
  const warn=pc.pdf_warn||'#b46e14';
  const hdrBg=pc.pdf_header_bg||'#edf1fa';
  const thBg=pc.pdf_th_bg||'#dce4f5';
  const row1=pc.pdf_row1||'#f7f9fd';
  const row2=pc.pdf_row2||'#fcfdff';
  const ink1=pc.pdf_ink1||'#12141f';
  const ink2=pc.pdf_ink2||'#41465f';
  const ink3=pc.pdf_ink3||'#787d96';

  const e=(n,d=0)=>{if(isNaN(n)||n===null||n===undefined)return'—';return(+n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})+' €'};
  const p=(n,d=2)=>{if(isNaN(n)||!isFinite(n))return'—';return(+n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%'};
  const vn=id2=>{const el=document.getElementById(id2);return el?parseFloat(el.value)||0:0};
  const tx=id2=>{const el=document.getElementById(id2);return el?el.value.trim():''};

  const cfColor=v=>v>=0?pos:neg;
  const row=(l,v,color)=>`<tr><td style="padding:6px 10px;border:1px solid ${thBg};background:${row1};font-size:12px;color:${ink2}">${l}</td><td style="padding:6px 10px;border:1px solid ${thBg};text-align:right;font-weight:600;font-size:12px;color:${color||ink1}">${v}</td></tr>`;
  const rowB=(l,v,color)=>`<tr><td style="padding:7px 10px;border:1px solid ${thBg};background:${hdrBg};font-size:12px;font-weight:700;color:${ink1}">${l}</td><td style="padding:7px 10px;border:1px solid ${thBg};background:${hdrBg};text-align:right;font-weight:700;font-size:13px;color:${color||acc}">${v}</td></tr>`;
  const sec=(n,t)=>`<h2 style="color:${acc};border-bottom:2px solid ${acc};padding-bottom:6px;font-size:14px;letter-spacing:1px;margin-top:28px">${n} — ${t.toUpperCase()}</h2>`;
  const tbl=rows=>`<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${rows}</table>`;

  // Stress loyer
  const cf90=r.loyerM*0.9-r.mensFin-r.charges/12;
  const cf80=r.loyerM*0.8-r.mensFin-r.charges/12;
  const cf70=r.loyerM*0.7-r.mensFin-r.charges/12;
  // Amortissement crédit
  const assM=vn('assurEmpr')*(document.getElementById('periodeAss')?.value==='a'?1/12:1);
  const tauxM_r=(r.tauxPret/100)/12;
  // Charges détail
  const chargesD=[
    ['Taxe foncière',vn('taxeFonc')],['Assurance PNO',vn('assurPNO')],
    ['Charges copropriété',vn('chargesCopro')],['Gestion locative',vn('fraisGestion')],
    ['Entretien',vn('entretien')],['Comptabilité',vn('compta')],['Autres',vn('autresCharges')]
  ].filter(c=>c[1]>0);
  // Projection patrimoine
  let cap2=r.emp,cumCF=0,totalInt2=0;
  const proj=[];
  for(let an=1;an<=r.horizon;an++){
    let iAn=0;
    if(an<=r.dureePret){for(let m=0;m<12;m++){const i=Math.max(0,cap2)*tauxM_r;iAn+=i;cap2-=r.mensHAss-i}}
    totalInt2+=iAn;
    const loyer_p=r.loyerAn*Math.pow(1+r.irlTaux/100,an-1);
    const charges_p=r.charges*Math.pow(1+r.inflCharges/100,an-1);
    const mens_p=an<=r.dureePret?r.mensFin*12:0;
    const cfAn=loyer_p-charges_p-mens_p;
    cumCF+=cfAn;
    const valBien=r.pa*Math.pow(1+r.revalBien/100,an);
    const capR=Math.max(0,cap2);
    proj.push({an,iAn,cfAn,cumCF,valBien,capR,patriNet:valBien-capR+cumCF});
  }
  const dernier=proj[proj.length-1];
  // Revente
  const prixRev=r.prixRevente||r.pa*Math.pow(1+r.revalBien/100,r.horizon);
  const pv=prixRev-r.pa;
  let abatt=r.horizon>=30?1:r.horizon>=6?Math.min(1,(r.horizon-5)*0.06):0;
  const pvImp=Math.max(0,pv*(1-abatt));
  const impotPV=pvImp*(0.19+0.172);
  const fraisVente=prixRev*0.06;
  const gainNet=pv-impotPV-fraisVente+dernier.cumCF;
  // TRI
  const tri_val=typeof computeTRI==='function'?computeTRI(r):null;
  // Score
  const scLbl=r.score>=70?'Excellent':r.score>=60?'Bon':r.score>=45?'Moyen':r.score>=30?'Faible':'Risque';
  const scColor=r.score>=70?pos:r.score>=45?warn:neg;

  const wordNs=forWord?` xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"`:'';
  const wordMeta=forWord?`<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->`:'';

  return `<!DOCTYPE html><html${wordNs}><head><meta charset="UTF-8"/>${wordMeta}
<style>
@page{size:A4;margin:2cm}
body{font-family:Calibri,Arial,sans-serif;max-width:800px;margin:0 auto;color:${ink1};line-height:1.55;font-size:12px}
table{width:100%;border-collapse:collapse;margin-bottom:16px;page-break-inside:auto}
tr{page-break-inside:avoid}
h1{color:${acc};font-size:26px;margin:0 0 4px 0}
h2{color:${acc};font-size:13px;letter-spacing:1px;border-bottom:2px solid ${acc};padding-bottom:5px;margin-top:28px;page-break-after:avoid}
.kpi-grid{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}
.kpi{background:${row1};border:1px solid ${thBg};border-left:3px solid ${acc};border-radius:4px;padding:8px 14px;flex:1;min-width:140px;text-align:center}
.kpi .label{font-size:10px;color:${ink3};margin-bottom:2px}
.kpi .value{font-size:16px;font-weight:700}
.page-break{page-break-before:always}
.alert{padding:10px 14px;border-radius:4px;margin:12px 0;font-size:11px}
footer{margin-top:30px;font-size:10px;color:${ink3};border-top:1px solid ${thBg};padding-top:8px}
</style></head><body>

${id.cabinet?`<div style="background:${row1};border-left:4px solid ${acc};padding:10px 16px;margin-bottom:20px">
<strong style="color:${acc};font-size:15px">${id.cabinet}</strong>
${id.conseiller?`<br/><span style="font-size:12px;color:${ink2}">${id.conseiller}${id.titre?' — '+id.titre:''}</span>`:''}
${id.tel||id.email?`<br/><span style="font-size:11px;color:${ink3}">${[id.tel,id.email,id.web].filter(Boolean).join('  |  ')}</span>`:''}
</div>`:''}

<h1>${(r.typeBien||'Bien immobilier').toUpperCase()}</h1>
${r.ville?`<p style="color:${acc};font-size:18px;margin:2px 0 4px 0">${r.ville}</p>`:''}
<p style="color:${ink3};font-size:12px;margin:2px 0">${[r.surface&&r.surface+' m²',r.dpe&&'DPE '+r.dpe,r.pa&&'Prix : '+e(r.pa)].filter(Boolean).join('  ·  ')}</p>
<p style="margin:8px 0 4px 0"><span style="font-weight:700;color:${scColor};font-size:14px">Score : ${Math.round(r.score)}/100 — ${scLbl}</span></p>

<div class="kpi-grid">
<div class="kpi"><div class="label">Coût total</div><div class="value" style="color:${acc}">${e(r.coutTotal)}</div></div>
<div class="kpi"><div class="label">Rent. brute</div><div class="value" style="color:${acc}">${p(r.rentBrute)}</div></div>
<div class="kpi"><div class="label">Rent. nette</div><div class="value" style="color:${acc}">${p(r.rentNette)}</div></div>
<div class="kpi"><div class="label">CF avant impôt</div><div class="value" style="color:${cfColor(r.cfAvant)}">${e(r.cfAvant)}/mois</div></div>
<div class="kpi"><div class="label">CF après impôt</div><div class="value" style="color:${cfColor(r.cfApres)}">${e(r.cfApres)}/mois</div></div>
<div class="kpi"><div class="label">Mensualité</div><div class="value" style="color:${blue}">${e(r.mensFin)}/mois</div></div>
${tri_val!==null?`<div class="kpi"><div class="label">TRI (${r.horizon} ans)</div><div class="value" style="color:${acc}">${p(tri_val)}</div></div>`:''}
</div>

${sec('01','Identification du bien')}
${tbl(
  row('Type de bien',r.typeBien||'—')+
  row('Ville / Localisation',r.ville||'—')+
  (document.getElementById('codePostal')?.value?row('Code postal',document.getElementById('codePostal').value):'')+
  row('Surface habitable',r.surface?r.surface+' m²':'—')+
  row('DPE',r.dpe?'Classe '+r.dpe:'—')+
  row('Type de location',{'nue':'Location nue','meublee':'LMNP meublée','courte':'Courte durée'}[tx('typeLoc')]||'—')+
  row('Ancienneté',tx('anciennete')==='neuf'?'Neuf / VEFA':'Ancien (>5 ans)')
)}
${(()=>{
  if(!_selectedCity)return'';
  const _dc=_selectedCity.departement?.code||'';
  const _dd=DEPT_DATA[_dc]||null;
  const _as=_selectedCity._attrScore||0;
  const _asC=_as>=70?pos:_as>=45?warn:neg;
  const _asL=_as>=75?'Excellent':_as>=60?'Attractif':_as>=45?'Correct':'Peu attractif';
  let rows2='';
  if(_selectedCity.population)rows2+=row('Population',_selectedCity.population.toLocaleString('fr-FR')+' hab.');
  if(_dd){
    rows2+=row('Chômage (dept.)',_dd[0]+'%',_dd[0]<7?pos:_dd[0]<10?warn:neg);
    rows2+=row('Étudiants (dept.)',_dd[1]+'%');
    rows2+=row('Revenu médian (dept.)',e(_dd[2])+'/an');
    rows2+=row('Prix moyen/m² (dept.)',e(_dd[3]),blue);
    rows2+=row('Tendance prix',(_dd[4]>0?'+':'')+_dd[4]+'%/an',_dd[4]>1?pos:_dd[4]>=0?warn:neg);
  }
  if(_as)rows2+=rowB('Score attractivité',_as+'/100 — '+_asL,_asC);
  return rows2?`<h3 style="color:${acc};font-size:12px;margin:12px 0 6px 0">📍 Données de la commune</h3>${tbl(rows2)}`:'';
})()}

${sec('02','Coût d\'acquisition')}
${tbl(
  (r.negoPct>0?row('Prix affiché',e(r.prixAffiche))+row('Négociation ('+r.negoPct+'%)','- '+e(r.prixAffiche-r.pa),pos):'')+
  rowB('Prix d\'achat négocié',e(r.pa),acc)+
  row('Frais de notaire',e(r.notaire||0))+
  row('Frais d\'agence',e(r.fa))+
  (r.tr>0?row('Travaux',e(r.tr)):'')+
  (r.am>0?row('Ameublement',e(r.am)):'')+
  (r.af>0?row('Autres frais',e(r.af)):'')+
  rowB('COÛT TOTAL DU PROJET',e(r.coutTotal),acc)
)}

${sec('03','Plan de financement')}
${tbl(
  row('Apport personnel',e(r.apport),blue)+
  row('Montant emprunté',e(r.emp))+
  row('Taux d\'intérêt',p(r.tauxPret))+
  row('Durée du prêt',r.dureePret+' ans')+
  row('Assurance emprunteur',e(assM)+'/mois')+
  row('Mensualité hors assurance',e(r.mensHAss))+
  rowB('MENSUALITÉ TOTALE',e(r.mensFin)+'/mois',blue)+
  row('Coût total du crédit',e(r.mensFin*r.dureePret*12))+
  row('Total intérêts payés',e(r.mensFin*r.dureePret*12-r.emp),neg)
)}

${sec('04','Revenus locatifs')}
${tbl(
  row('Loyer mensuel',e(r.loyerM))+
  row('Loyer annuel brut',e(r.loyerAn))+
  row('Vacance locative',p(vn('vacance')))+
  row('Impayés',p(vn('impayes')))+
  rowB('Revenus effectifs',e(r.loyerAn*(1-vn('vacance')/100-vn('impayes')/100))+'/an',pos)
)}

${sec('05','Détail des charges annuelles')}
${tbl(
  chargesD.map(c=>row(c[0],e(c[1]))).join('')+
  rowB('TOTAL CHARGES',e(r.charges)+'/an',neg)
)}

${sec('06','Résultats de rentabilité')}
${tbl(
  row('Revenu locatif annuel brut',e(r.loyerAn))+
  row('Revenus nets après charges',e(r.revNC))+
  rowB('Rentabilité brute',p(r.rentBrute),acc)+
  rowB('Rentabilité nette',p(r.rentNette),acc)
)}

<div class="page-break"></div>

${sec('07','Cash-flow mensuel détaillé')}
${tbl(
  row('Loyer mensuel effectif',e(r.loyerM)+'/mois',pos)+
  row('Mensualité de crédit',e(r.mensHAss)+'/mois',neg)+
  row('Assurance emprunteur',e(assM)+'/mois',neg)+
  row('Charges mensualisées',e(r.charges/12)+'/mois',neg)+
  rowB('CF AVANT IMPÔT',e(r.cfAvant)+'/mois',cfColor(r.cfAvant))+
  row('Impôt mensuel',e(r.impot/12)+'/mois',neg)+
  rowB('CF APRÈS IMPÔT',e(r.cfApres)+'/mois',cfColor(r.cfApres))
)}

${sec('08','Bilan annuel')}
${tbl(
  row('Loyer annuel encaissé',e(r.loyerAn),pos)+
  row('Charges annuelles',e(r.charges),neg)+
  row('Remboursement crédit',e(r.mensFin*12),neg)+
  row('Impôt annuel',e(r.impot),neg)+
  rowB('RÉSULTAT NET ANNUEL',e(r.cfApres*12),cfColor(r.cfApres))
)}

${sec('09','Stress loyer — Capacité de crédit')}
${tbl(
  rowB('100% loyer retenu',e(r.cfAvant)+'/mois',cfColor(r.cfAvant))+
  row('90% loyer retenu',e(cf90)+'/mois',cfColor(cf90))+
  row('80% loyer retenu',e(cf80)+'/mois',cfColor(cf80))+
  row('70% loyer retenu',e(cf70)+'/mois',cfColor(cf70))
)}

${sec('10','Paramètres fiscaux')}
${tbl(
  row('TMI',r.tmi+'%')+
  row('Prélèvements sociaux',r.ps+'%')+
  row('Taux global',(r.tmi+r.ps).toFixed(1)+'%',warn)+
  (r.interets>0?row('Intérêts déductibles',e(r.interets)+'/an'):'')+
  (r.amort>0?rowB('Total amortissements',e(r.amort)+'/an',blue):'')
)}

${sec('11','Comparatif des régimes fiscaux')}
<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
<tr style="background:${thBg}"><th style="padding:6px 10px;text-align:left;font-size:11px;color:${acc}">Régime</th><th style="padding:6px 10px;text-align:right;font-size:11px;color:${acc}">Rev. imposable</th><th style="padding:6px 10px;text-align:right;font-size:11px;color:${acc}">Impôt/an</th><th style="padding:6px 10px;text-align:right;font-size:11px;color:${acc}">CF après impôt</th></tr>
${(r.allRes||[]).map((x,i)=>{
  const isBest=r.bestReg&&x.r===r.bestReg.r;
  const bg=isBest?hdrBg:(i%2===0?row1:row2);
  return`<tr style="background:${bg}"><td style="padding:5px 10px;border:1px solid ${thBg};font-size:12px;font-weight:${isBest?700:400};color:${isBest?acc:ink2}">${isBest?'★ ':''}${(x.res.desc||'').split('—')[0].trim()}</td><td style="padding:5px 10px;border:1px solid ${thBg};text-align:right;font-size:12px;color:${ink2}">${e(x.res.revImp)}</td><td style="padding:5px 10px;border:1px solid ${thBg};text-align:right;font-size:12px;color:${neg}">${e(x.res.impot)}</td><td style="padding:5px 10px;border:1px solid ${thBg};text-align:right;font-size:12px;font-weight:${isBest?700:400};color:${cfColor(x.res.cfApres)}">${e(x.res.cfApres)}/mois</td></tr>`;
}).join('')}
</table>

<div class="page-break"></div>

${sec('12','Projection patrimoniale sur '+r.horizon+' ans')}
${tbl(
  row('Valeur du bien (an '+r.horizon+')',e(dernier.valBien),acc)+
  row('Capital restant dû',e(dernier.capR),dernier.capR<=0?pos:neg)+
  row('Cash-flow cumulé',e(dernier.cumCF),cfColor(dernier.cumCF))+
  rowB('PATRIMOINE NET (an '+r.horizon+')',e(dernier.patriNet),acc)+
  row('Plus-value latente',e(dernier.valBien-r.pa),acc)+
  row('Total intérêts payés',e(totalInt2),neg)
)}

${sec('13','Évolution du patrimoine')}
<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
<tr style="background:${thBg}"><th style="padding:6px 8px;text-align:left;font-size:11px;color:${acc}">Horizon</th><th style="padding:6px 8px;text-align:right;font-size:11px;color:${acc}">Valeur bien</th><th style="padding:6px 8px;text-align:right;font-size:11px;color:${acc}">Capital dû</th><th style="padding:6px 8px;text-align:right;font-size:11px;color:${acc}">CF cumulé</th><th style="padding:6px 8px;text-align:right;font-size:11px;color:${acc}">Patrimoine net</th></tr>
${[1,3,5,10,15,20].filter(j=>j<=r.horizon).map((j,i)=>{
  const pj=proj[j-1];if(!pj)return'';
  return`<tr style="background:${i%2===0?row1:row2}"><td style="padding:5px 8px;border:1px solid ${thBg};font-size:12px;color:${ink2}">An ${j}</td><td style="padding:5px 8px;border:1px solid ${thBg};text-align:right;font-size:12px;color:${acc}">${e(pj.valBien)}</td><td style="padding:5px 8px;border:1px solid ${thBg};text-align:right;font-size:12px;color:${blue}">${e(pj.capR)}</td><td style="padding:5px 8px;border:1px solid ${thBg};text-align:right;font-size:12px;color:${cfColor(pj.cumCF)}">${e(pj.cumCF)}</td><td style="padding:5px 8px;border:1px solid ${thBg};text-align:right;font-size:12px;font-weight:700;color:${acc}">${e(pj.patriNet)}</td></tr>`;
}).join('')}
</table>

${sec('14','Simulation de revente (an '+r.horizon+')')}
${tbl(
  row('Prix d\'achat initial',e(r.pa))+
  row('Prix de revente estimé',e(prixRev))+
  row('Plus-value brute',e(pv),pv>=0?pos:neg)+
  row('Abattement durée détention',p(abatt*100))+
  row('Impôt plus-value',e(impotPV),neg)+
  row('Frais de vente (6%)',e(fraisVente),neg)+
  row('CF cumulé',e(dernier.cumCF),cfColor(dernier.cumCF))+
  rowB('GAIN NET TOTAL',e(gainNet),cfColor(gainNet))
)}

${sec('15','Effet de levier')}
${(()=>{
  const cfComptant=(r.loyerAn-r.charges)/12;
  const rendComptant=r.coutTotal>0?(r.loyerAn-r.charges)/r.coutTotal*100:0;
  const rendCredit=r.apport>0?(r.cfAvant*12/r.apport)*100:0;
  return tbl(
    row('Rendement comptant (sur coût total)',p(rendComptant))+
    row('CF comptant',e(cfComptant)+'/mois')+
    row('Rendement à crédit (sur apport)',p(rendCredit),rendCredit>rendComptant?pos:warn)+
    row('CF à crédit',e(r.cfAvant)+'/mois')+
    rowB('Conclusion',rendCredit>rendComptant?'Levier POSITIF':'Levier NÉGATIF',rendCredit>rendComptant?pos:warn)
  );
})()}

${sec('16','Score d\'investissement — Détail')}
<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
<tr style="background:${thBg}"><th style="padding:6px 8px;text-align:left;font-size:11px;color:${acc}">Critère</th><th style="padding:6px 8px;text-align:right;font-size:11px;color:${acc}">Valeur</th><th style="padding:6px 8px;text-align:right;font-size:11px;color:${acc}">Points</th><th style="padding:6px 8px;text-align:right;font-size:11px;color:${acc}">Évaluation</th></tr>
${(()=>{
  const _cityS=_selectedCity?._attrScore||0;
  const _cityPts=_cityS>=75?15:_cityS>=60?10:_cityS>=45?5:(_selectedCity?1:0);
  const criteria=[
  {l:'Rentabilité brute',v:p(r.rentBrute),pts:r.rentBrute>=8?25:r.rentBrute>=6?17:r.rentBrute>=4?8:2,max:25,ok:r.rentBrute>=6,w:r.rentBrute>=4},
  {l:'Cash-flow avant impôt',v:e(r.cfAvant)+'/mois',pts:r.cfAvant>200?20:r.cfAvant>0?12:r.cfAvant>-200?4:0,max:20,ok:r.cfAvant>0,w:r.cfAvant>-200},
  {l:'DPE',v:r.dpe?'Classe '+r.dpe:'—',pts:({A:15,B:13,C:10,D:7,E:4,F:1,G:0}[r.dpe]||5),max:15,ok:['A','B','C'].includes(r.dpe),w:r.dpe==='D'},
  {l:'Vacance locative',v:p(vn('vacance')),pts:vn('vacance')<=3?12:vn('vacance')<=7?8:vn('vacance')<=12?4:0,max:12,ok:vn('vacance')<=5,w:vn('vacance')<=10},
  {l:'Ratio mensualité/loyer',v:r.loyerM>0?p(r.mensFin/r.loyerM*100):'—',pts:r.mensFin/Math.max(1,r.loyerM)<0.6?13:r.mensFin/Math.max(1,r.loyerM)<0.8?8:r.mensFin/Math.max(1,r.loyerM)<1?4:0,max:13,ok:r.mensFin/Math.max(1,r.loyerM)<0.7,w:r.mensFin/Math.max(1,r.loyerM)<0.85},
  ];
  if(_selectedCity)criteria.push({l:'Attractivité ville',v:_cityS+'/100',pts:_cityPts,max:15,ok:_cityS>=60,w:_cityS>=45});
  return criteria;
})().map((c,i)=>{
  const evalTxt=c.ok?'✓ Bon':c.w?'⚠ Moyen':'✗ Risque';
  const evalCol=c.ok?pos:c.w?warn:neg;
  return`<tr style="background:${i%2===0?row1:row2}"><td style="padding:5px 8px;border:1px solid ${thBg};font-size:12px;color:${ink2}">${c.l}</td><td style="padding:5px 8px;border:1px solid ${thBg};text-align:right;font-size:12px;color:${acc}">${c.v}</td><td style="padding:5px 8px;border:1px solid ${thBg};text-align:right;font-size:12px;color:${blue}">${c.pts} / ${c.max}</td><td style="padding:5px 8px;border:1px solid ${thBg};text-align:right;font-size:12px;font-weight:700;color:${evalCol}">${evalTxt}</td></tr>`;
}).join('')}
</table>

<div class="alert" style="background:#fff3f3;border:1px solid ${neg};border-left:4px solid ${neg}">
<strong style="color:${neg}">AVERTISSEMENT LÉGAL</strong><br/>
<span style="color:${ink3};font-size:10px">Ce document est produit à titre indicatif par ImmoSim V8. Les calculs fiscaux sont simplifiés. Les projections reposent sur des hypothèses et ne constituent pas une garantie de performance. Consultez un professionnel qualifié (notaire, expert-comptable, CGP) avant toute décision.</span>
</div>

<footer>ImmoSim V8 — Document généré le ${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})} — Estimations indicatives, non contractuelles.</footer>
</body></html>`;
}


/* ═══════════════════════════════════════════════════
   EXPORT DOCX — Document Word (.doc HTML natif)
   Aucune librairie externe requise
═══════════════════════════════════════════════════ */
async function exportDOCX(){
  if(!R){toast('Calculez d\'abord un bien.','err');return;}
  try{
    const html=_buildReportHTML(true);
    const blob=new Blob(['\ufeff'+html],{type:'application/msword;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='ImmoSim_V8_'+(R.ville||'simulation').replace(/\s+/g,'_')+'.doc';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    toast('Document Word exporté ✓','ok');
  }catch(err){
    console.error('Erreur DOCX:',err);
    toast('Erreur export Word : '+err.message,'err');
  }
}

/* ═══════════════════════════════════════════════════
   EXPORT GOOGLE DOCS — copie riche + ouverture
═══════════════════════════════════════════════════ */
async function exportGoogleDocs(){
  if(!R){toast('Calculez d\'abord un bien.','err');return;}
  try{
    const html=_buildReportHTML(false);
    // 1) Copier le HTML riche dans le presse-papiers
    let copied=false;
    try{
      const blob=new Blob([html],{type:'text/html'});
      await navigator.clipboard.write([new ClipboardItem({'text/html':blob})]);
      copied=true;
    }catch(e){console.warn('Clipboard API non disponible:',e);}
    // 2) Ouvrir un nouveau Google Doc
    window.open('https://docs.google.com/document/u/0/create','_blank');
    if(copied){
      toast('✓ Rapport copié — collez-le (Ctrl+V) dans le Google Doc qui s\'ouvre','ok');
    } else {
      // Fallback: télécharger le .doc et guider l'import
      const blob2=new Blob(['\ufeff'+html],{type:'application/msword;charset=utf-8'});
      const url2=URL.createObjectURL(blob2);
      const a=document.createElement('a');a.href=url2;
      a.download='ImmoSim_V8_'+(R.ville||'simulation').replace(/\s+/g,'_')+'.doc';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url2),5000);
      toast('Fichier .doc téléchargé — importez-le dans Google Docs via Fichier → Ouvrir','ok');
    }
  }catch(err){
    console.error('Erreur Google Docs:',err);
    toast('Erreur export Google Docs : '+err.message,'err');
  }
}

function buildLevier(r){
  // Comptant vs crédit
  const loyerAn=r.loyerAn,charges=r.charges;
  // Comptant : pas de mensualité, rendement sur apport = coût total
  const cfComptant=(loyerAn-charges)/12;
  const rendComptant=r.coutTotal>0?(loyerAn-charges)/r.coutTotal*100:0;
  // Crédit : apport mis en jeu
  const cfCredit=r.cfAvant;
  const rendCredit=r.apport>0?((r.cfAvant*12)/r.apport)*100:0;
  const isBetter=cfCredit>cfComptant||rendCredit>rendComptant;

  g('panelLevier').innerHTML=`
    <div class="ptitle">Effet levier — Crédit vs Comptant</div>
    <div class="levier-compare">
      <div class="lc-card ${!isBetter?'highlighted':''}">
        <div class="lc-title">💵 Investissement comptant</div>
        <div class="lc-kpis">
          <div class="lc-row"><span class="l">Capital investi</span><span class="v">${eur(r.coutTotal,0)}</span></div>
          <div class="lc-row"><span class="l">CF mensuel (hors impôt)</span><span class="v" style="color:${cfComptant>=0?'var(--em)':'var(--ru)'}">${eur(cfComptant)}</span></div>
          <div class="lc-row"><span class="l">Rendement sur capital</span><span class="v" style="color:var(--gold)">${pct(rendComptant)}</span></div>
          <div class="lc-row"><span class="l">Mensualité</span><span class="v">0 €</span></div>
          <div class="lc-row"><span class="l">Liquidité préservée</span><span class="v">0 €</span></div>
        </div>
      </div>
      <div class="lc-card ${isBetter?'highlighted':''}">
        <div class="lc-title ${isBetter?'':''}">🏦 Financement à crédit</div>
        <div class="lc-kpis">
          <div class="lc-row"><span class="l">Apport</span><span class="v">${eur(r.apport,0)}</span></div>
          <div class="lc-row"><span class="l">CF mensuel (hors impôt)</span><span class="v" style="color:${cfCredit>=0?'var(--em)':'var(--ru)'}">${eur(cfCredit)}</span></div>
          <div class="lc-row"><span class="l">Rendement sur apport</span><span class="v" style="color:var(--gold)">${pct(rendCredit)}</span></div>
          <div class="lc-row"><span class="l">Mensualité</span><span class="v" style="color:var(--ru)">${eur(r.mensFin)}</span></div>
          <div class="lc-row"><span class="l">Liquidité préservée</span><span class="v" style="color:var(--em)">${eur(r.coutTotal-r.apport,0)}</span></div>
        </div>
      </div>
    </div>
    <div class="rec-box" style="font-size:.73rem">
      ${isBetter?`🚀 <strong>Le crédit amplifie votre rendement</strong> sur l'apport (${pct(rendCredit)} vs ${pct(rendComptant)}). Effet de levier positif — votre argent travaille mieux.`
      :`⚖ <strong>Le comptant est plus rentable</strong> ici. Le coût du crédit dépasse le bénéfice du levier financier.`}
    </div>
    <p class="disc">Hors fiscalité et frais de crédit. L'effet de levier est positif quand le rendement brut > taux du crédit.</p>`;
}

function buildMiniCF(r){
  const duree=Math.min(r.dureePret||20,r.horizon);
  const emp=r.emp,tauxM=(r.tauxPret/100)/12,nMois=duree*12;
  const mensHAss=r.mensHAss;
  let cap=emp;
  const projCF=[],projPat=[],years=[];
  let cumCF=0;
  for(let an=1;an<=duree;an++){
    let iAn=0,cAn=0;
    for(let m=0;m<12;m++){const i=cap*tauxM;iAn+=i;cAn+=mensHAss-i;cap-=mensHAss-i}
    const loyerRevalo=r.loyerAn*Math.pow(1+r.irlTaux/100,an-1);
    const chargesInfla=r.charges*Math.pow(1+r.inflCharges/100,an-1);
    const cfAn=(loyerRevalo-chargesInfla)-r.mensFin*12;
    cumCF+=cfAn;
    const valeurBien=r.pa*Math.pow(1+r.revalBien/100,an);
    const capRestant=Math.max(0,cap);
    const patrimoineNet=valeurBien-capRestant+(cumCF);
    projCF.push(+(cfAn/12).toFixed(2));
    projPat.push(+patrimoineNet.toFixed(0));
    years.push('A'+an);
  }

  g('panelCF').innerHTML=`
    <div class="ptitle">Cash-flow & Patrimoine</div>
    <div style="font-size:.72rem;color:var(--ink3);margin-bottom:10px;display:flex;gap:14px;flex-wrap:wrap">
      <span>CF moyen : <strong style="color:var(--gold)">${eur(projCF.reduce((a,b)=>a+b,0)/projCF.length)}/mois</strong></span>
      <span>Patrimoine net fin : <strong style="color:var(--em)">${eur(projPat[projPat.length-1],0)}</strong></span>
    </div>
    <div class="chart-box"><canvas id="miniCF"></canvas></div>`;

  destroyChart('miniCF');
  const cc=chartColors();
  setTimeout(()=>{
    const ctx=g('miniCF').getContext('2d');
    chartRefs['miniCF']=new Chart(ctx,{
      data:{labels:years,datasets:[
        {type:'bar',label:'CF mensuel',data:projCF,backgroundColor:projCF.map(v=>v>=0?'rgba(78,202,136,.55)':'rgba(239,101,101,.55)'),borderWidth:0,borderRadius:2,yAxisID:'y'},
        {type:'line',label:'Patrimoine net',data:projPat,borderColor:'rgba(219,168,74,.8)',backgroundColor:'rgba(219,168,74,.06)',borderWidth:2,pointRadius:0,fill:true,tension:.3,yAxisID:'y2'},
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:cc.label,font:{size:10}}}},scales:{
        x:{ticks:{color:cc.label,font:{size:9}},grid:{color:cc.grid}},
        y:{ticks:{color:cc.label,font:{size:9},callback:v=>eur(v,0)},grid:{color:cc.grid},position:'left'},
        y2:{ticks:{color:'rgba(219,168,74,.7)',font:{size:9},callback:v=>v>=1000?Math.round(v/1000)+'k€':eur(v,0)},grid:{display:false},position:'right'},
      }}
    });
  },50);
}

/* ══════════════════════════════════════════════
   VUE ANALYSE
══════════════════════════════════════════════ */
function buildAnalyse(){
  if(!R){g('analyseContent').innerHTML='<div class="nodata"><span class="ico">◈</span><h3>Aucune donnée</h3><p>Calculez d\'abord un bien.</p></div>';return}
  const r=R,duree=r.dureePret||20,emp=r.emp,tauxM=(r.tauxPret/100)/12,mensHAss=r.mensHAss;
  let cap=emp;
  const tableRows=[],projCF=[],projPat=[],projLoyer=[],projPV=[];
  let cumCF=0,totalInt=0,totalCap=0;

  for(let an=1;an<=r.horizon;an++){
    let iAn=0,cAn=0;
    if(an<=duree){
      for(let m=0;m<12;m++){const i=Math.max(0,cap)*tauxM;const c=mensHAss-i;iAn+=i;cAn+=c;cap-=c}
    }
    totalInt+=iAn;totalCap+=cAn;
    const loyerRevalo=r.loyerAn*Math.pow(1+r.irlTaux/100,an-1);
    const chargesInfla=r.charges*Math.pow(1+r.inflCharges/100,an-1);
    const mensPeriode=an<=duree?r.mensFin*12:0;
    const cfAn=loyerRevalo-chargesInfla-mensPeriode;
    cumCF+=cfAn;
    const valBien=r.pa*Math.pow(1+r.revalBien/100,an);
    const capR=Math.max(0,cap);
    // Plus-value latente
    const pvLatente=valBien-r.pa;
    const patriNet=valBien-capR+cumCF;
    projCF.push(+(cfAn/12).toFixed(2));
    projPat.push(+patriNet.toFixed(0));
    projLoyer.push(+(loyerRevalo/12).toFixed(2));
    projPV.push(+pvLatente.toFixed(0));
    tableRows.push({an,iAn,cAn,capR:Math.max(0,capR),cfM:cfAn/12,cumCF,valBien,patriNet});
  }

  // Revente simulation
  const horizonRev=r.horizon;
  const prixRev=r.prixRevente||r.pa*Math.pow(1+r.revalBien/100,horizonRev);
  const pv=prixRev-r.pa;
  let abatt=0;
  if(horizonRev>=30)abatt=1;
  else if(horizonRev>=6)abatt=Math.min(1,(horizonRev-5)*0.06);
  const pvImp=Math.max(0,pv*(1-abatt));
  const impotPV=pvImp*(0.19+0.172);
  const fraisVente=prixRev*0.06;
  const gainNet=pv-impotPV-fraisVente+cumCF;

  const yrs=Array.from({length:r.horizon},(_,i)=>`A${i+1}`);

  g('analyseContent').innerHTML=`
    <div class="ph"><h2>Analyse détaillée</h2><p>Projection sur ${r.horizon} ans · Revalorisation loyer ${r.irlTaux}%/an · Bien +${r.revalBien}%/an</p></div>
    <div class="grid2" style="margin-bottom:16px">

      <div class="card full">
        <h3>📈 Évolution patrimoine net & cash-flow</h3>
        <div style="font-size:.73rem;color:var(--ink3);margin-bottom:10px;display:flex;gap:16px;flex-wrap:wrap">
          <span>CF cumulé : <strong style="color:${cumCF>=0?'var(--em)':'var(--ru)'}">${eur(cumCF,0)}</strong></span>
          <span>Patrimoine net final : <strong style="color:var(--gold)">${eur(projPat[projPat.length-1],0)}</strong></span>
          <span>Plus-value latente : <strong style="color:var(--sa)">${eur(projPV[projPV.length-1],0)}</strong></span>
        </div>
        <div class="chart-box tall"><canvas id="chartPat"></canvas></div>
      </div>

      <div class="card">
        <h3>📊 Cash-flow mensuel (loyer revalorisé)</h3>
        <div class="chart-box"><canvas id="chartCF"></canvas></div>
      </div>

      <div class="card">
        <h3>🏷 Simulation de revente (an ${horizonRev})</h3>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <div class="field" style="flex:1"><label>Prix revente (€)</label><input type="number" id="prxRev2" value="${Math.round(prixRev)}" min="0" oninput="recalcRev()"/></div>
          <div class="field" style="flex:1"><label>Durée détention (ans)</label><input type="number" id="durDet2" value="${horizonRev}" min="1" max="40" oninput="recalcRev()"/></div>
        </div>
        <div id="revKPIs">
          <div class="grid2" style="gap:8px">
            <div class="kpi"><div class="kl">Plus-value brute</div><div class="kv ${pv>=0?'pos':'neg'}">${eur(pv,0)}</div></div>
            <div class="kpi"><div class="kl">Abattement</div><div class="kv gold">${Math.round(abatt*100)}%${horizonRev>=30?' (exo.)':''}</div></div>
            <div class="kpi"><div class="kl">Impôt PV</div><div class="kv neg">${eur(impotPV,0)}</div></div>
            <div class="kpi"><div class="kl">Gain net (PV + CF)</div><div class="kv ${gainNet>=0?'pos':'neg'}">${eur(gainNet,0)}</div></div>
          </div>
        </div>
        <p style="font-size:.64rem;color:var(--ink4);margin-top:8px">Exonération totale après 30 ans. Hors résidence principale.</p>
      </div>

      <div class="card full">
        <h3>📋 Tableau d'amortissement du crédit</h3>
        <div style="font-size:.73rem;color:var(--ink3);margin-bottom:10px;display:flex;gap:18px;flex-wrap:wrap">
          <span>Capital : <strong>${eur(emp,0)}</strong></span>
          <span>Total intérêts : <strong style="color:var(--ru)">${eur(totalInt,0)}</strong></span>
          <span>Coût total crédit : <strong>${eur(emp+totalInt,0)}</strong></span>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>
              <th style="text-align:left">Année</th><th>Intérêts</th><th>Capital remb.</th>
              <th>Cap. restant</th><th>Loyer/mois</th><th>CF mensuel</th><th>CF cumulé</th><th>Patrimoine net</th>
            </tr></thead>
            <tbody>
              ${tableRows.map((row,i)=>`
                <tr class="${row.an%5===0?'y5':''}">
                  <td>An ${row.an}</td>
                  <td class="ti">${row.an<=duree?eur(row.iAn,0):'—'}</td>
                  <td class="tc">${row.an<=duree?eur(row.cAn,0):'—'}</td>
                  <td>${eur(row.capR,0)}</td>
                  <td style="color:var(--em)">${eur(projLoyer[i])}</td>
                  <td style="color:${row.cfM>=0?'var(--em)':'var(--ru)'}">${eur(row.cfM)}</td>
                  <td style="color:${row.cumCF>=0?'var(--em)':'var(--ru)'}">${eur(row.cumCF,0)}</td>
                  <td style="color:var(--gold)">${eur(row.patriNet,0)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>`;

  // Charts analyse
  destroyChart('chartPat');destroyChart('chartCF');
  const cc=chartColors();
  setTimeout(()=>{
    const ctxPat=g('chartPat').getContext('2d');
    chartRefs['chartPat']=new Chart(ctxPat,{
      data:{labels:yrs,datasets:[
        {type:'line',label:'Patrimoine net (€)',data:projPat,borderColor:'rgba(219,168,74,.9)',backgroundColor:'rgba(219,168,74,.08)',borderWidth:2,pointRadius:0,fill:true,tension:.3,yAxisID:'y'},
        {type:'line',label:'Plus-value latente (€)',data:projPV,borderColor:'rgba(107,158,248,.8)',backgroundColor:'rgba(107,158,248,.05)',borderWidth:1.5,borderDash:[4,3],pointRadius:0,tension:.3,yAxisID:'y'},
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:cc.label,font:{size:10}}}},scales:{
        x:{ticks:{color:cc.label,font:{size:9}},grid:{color:cc.grid}},
        y:{ticks:{color:cc.label,font:{size:9},callback:v=>v>=1000?Math.round(v/1000)+'k€':eur(v,0)},grid:{color:cc.grid}},
      }}
    });
    const ctxCF=g('chartCF').getContext('2d');
    chartRefs['chartCF']=new Chart(ctxCF,{
      type:'bar',
      data:{labels:yrs,datasets:[
        {label:'CF mensuel (€)',data:projCF,backgroundColor:projCF.map(v=>v>=0?'rgba(78,202,136,.6)':'rgba(239,101,101,.6)'),borderWidth:0,borderRadius:2},
        {type:'line',label:'Loyer/mois',data:projLoyer,borderColor:'rgba(219,168,74,.7)',borderWidth:1.5,pointRadius:0,tension:.3,borderDash:[4,3]},
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:cc.label,font:{size:10}}}},scales:{x:{ticks:{color:cc.label,font:{size:9}},grid:{color:cc.grid}},y:{ticks:{color:cc.label,font:{size:9},callback:v=>eur(v,0)},grid:{color:cc.grid}}}}
    });
  },50);
}

function recalcRev(){
  const prixR=parseFloat(g('prxRev2')?.value)||0;
  const det=parseFloat(g('durDet2')?.value)||0;
  if(!R||prixR<=0)return;
  const pv=prixR-R.pa;
  let abatt=det>=30?1:det>=6?Math.min(1,(det-5)*0.06):0;
  const pvImp=Math.max(0,pv*(1-abatt));
  const impotPV=pvImp*(0.19+0.172);
  const fraisV=prixR*0.06;
  // CF cumulé approximé
  const cfCum=R.cfAvant*12*det;
  const gain=pv-impotPV-fraisV+cfCum;
  if(g('revKPIs'))g('revKPIs').innerHTML=`
    <div class="grid2" style="gap:8px">
      <div class="kpi"><div class="kl">Plus-value brute</div><div class="kv ${pv>=0?'pos':'neg'}">${eur(pv,0)}</div></div>
      <div class="kpi"><div class="kl">Abattement</div><div class="kv gold">${Math.round(abatt*100)}%${det>=30?' (exo.)':''}</div></div>
      <div class="kpi"><div class="kl">Impôt PV</div><div class="kv neg">${eur(impotPV,0)}</div></div>
      <div class="kpi"><div class="kl">Gain net (PV + CF)</div><div class="kv ${gain>=0?'pos':'neg'}">${eur(gain,0)}</div></div>
    </div>`;
}

/* ── FISCAL ────────────────────────────────────── */
function buildFiscal(){
  if(!R){g('fiscalContent').innerHTML='<div class="nodata"><span class="ico">◈</span><h3>Aucune donnée</h3><p>Calculez d\'abord un bien.</p></div>';return}
  const regimes=[
    {id:'micro-foncier',name:'Micro-foncier',bg:'var(--sa-a)',color:'var(--sa)',sub:'Nue · abat. 30%'},
    {id:'reel-foncier',name:'Réel foncier',bg:'var(--em-a)',color:'var(--em)',sub:'Nue · charges réelles'},
    {id:'micro-bic',name:'Micro-BIC',bg:'var(--pu-a)',color:'var(--pu)',sub:'LMNP · abat. 50%'},
    {id:'lmnp-reel',name:'LMNP Réel',bg:'var(--gold-a)',color:'var(--gold)',sub:'LMNP · amortissements'},
    {id:'sci-ir',name:'SCI à l\'IR',bg:'var(--am-a)',color:'var(--am)',sub:'Translucide · réel'},
    {id:'sci-is',name:'SCI à l\'IS',bg:'var(--sa-a)',color:'var(--sa)',sub:'Impôt société'},
  ];
  const results=regimes.map(rg=>({...rg,...calcFiscal(rg.id,R.fp)}));
  const bi=results.reduce((bi,rr,i)=>rr.cfApres>results[bi].cfApres?i:bi,0);

  const cards=results.map((rr,i)=>`
    <div style="background:var(--bg1);border:1px solid ${i===bi?'var(--gold-b)':'var(--bd)'};border-radius:var(--r2);padding:14px;${i===bi?'box-shadow:0 0 0 1px var(--gold-b)':''}">
      <div style="display:inline-block;padding:2px 8px;border-radius:20px;background:${rr.bg};color:${rr.color};border:1px solid ${rr.color}40;font-size:.6rem;font-weight:700;margin-bottom:8px">${rr.name}</div>
      ${i===bi?'<span style="margin-left:4px;background:var(--gold);color:#0f0800;font-size:.6rem;font-weight:700;padding:2px 8px;border-radius:20px">★ Optimal</span>':''}
      <div style="font-family:\'Libre Baskerville\',serif;font-size:.92rem;font-weight:700;color:var(--ink);margin-bottom:2px">${rr.name}</div>
      <div style="font-size:.67rem;color:var(--ink3);margin-bottom:10px">${rr.sub}</div>
      <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.07em;color:var(--ink4)">Rev. imposable</div>
      <div style="font-family:\'Libre Baskerville\',serif;font-size:1rem;color:var(--gold);font-weight:700">${eur(rr.revImp,0)}</div>
      <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.07em;color:var(--ink4);margin-top:5px">CF après impôt</div>
      <div style="font-family:\'Libre Baskerville\',serif;font-size:1.15rem;color:${rr.cfApres>=0?'var(--em)':'var(--ru)'};font-weight:700">${eur(rr.cfApres)}/mois</div>
    </div>`).join('');

  const thC=results.map((rr,i)=>`<th style="text-align:center;${i===bi?'color:var(--gold)':''}">${rr.name}</th>`).join('');
  const tr2=(l,fn)=>`<tr><td>${l}</td>${results.map((rr,i)=>`<td style="text-align:center;${i===bi?'background:var(--gold-a)':''}">${fn(rr)}</td>`).join('')}</tr>`;

  g('fiscalContent').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:20px">${cards}</div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th style="text-align:left">Indicateur</th>${thC}</tr></thead>
      <tbody>
        ${tr2('Revenu imposable/an',rr=>`<span style="color:var(--gold);font-weight:700">${eur(rr.revImp,0)}</span>`)}
        ${tr2('Impôt annuel',rr=>eur(rr.impot,0))}
        ${tr2('Charge fiscale/mois',rr=>eur(rr.impot/12))}
        ${tr2('CF avant impôt',()=>eur(R.cfAvant)+'/mois')}
        ${tr2('CF après impôt',rr=>`<span style="color:${rr.cfApres>=0?'var(--em)':'var(--ru)'};font-weight:700">${eur(rr.cfApres)}/mois</span>`)}
        ${tr2('CF annuel net',rr=>`<span style="color:${rr.cfApres>=0?'var(--em)':'var(--ru)'}">${eur(rr.cfApres*12,0)}</span>`)}
      </tbody>
    </table></div>
    <p class="disc" style="margin-top:12px">⚠ Calculs simplifiés. Un expert-comptable est recommandé.</p>`;
}

/* ── OUTILS ────────────────────────────────────── */
const CHECKLIST=[
  {cat:'Juridique',items:['Vérifier le titre de propriété','Consulter le PLU','Absence de servitudes','Permis si travaux']},
  {cat:'Technique',items:['DPE à jour','Diagnostic amiante / plomb','Toiture & charpente','Électricité & plomberie','Humidité / fissures']},
  {cat:'Copropriété',items:['3 derniers PV d\'AG','Appels de fonds votés','Fonds de travaux','Charges courantes']},
  {cat:'Financier',items:['2+ scénarios de financement','3 devis travaux','Comparer assurances PNO','Vérifier viabilité loyer marché']},
  {cat:'Marché locatif',items:['Loyers du marché vérifiés','Taux de vacance local','Demande locative locale','Zone tendue / encadrement loyers']},
];
function buildChecklist(){
  let html='',total=0,done=0;
  CHECKLIST.forEach(cat=>{
    html+=`<div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--ink4);margin-top:11px;margin-bottom:5px">${cat.cat}</div>`;
    cat.items.forEach(item=>{
      const id='ck-'+btoa(encodeURIComponent(item)).replace(/[=+/]/g,'');
      if(!checkState[id])checkState[id]=false;
      if(checkState[id])done++;total++;
      html+=`<div onclick="togChk('${id}')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--r);background:${checkState[id]?'var(--em-a)':'var(--bg2)'};border:1px solid ${checkState[id]?'var(--em-b)':'var(--bd)'};cursor:pointer;transition:all var(--t);margin-bottom:4px">
        <div style="width:15px;height:15px;border-radius:3px;flex-shrink:0;border:1.5px solid ${checkState[id]?'var(--em)':'var(--bd3)'};background:${checkState[id]?'var(--em)':''};display:flex;align-items:center;justify-content:center">${checkState[id]?'<span style="color:#fff;font-size:9px;font-weight:700">✓</span>':''}</div>
        <span style="font-size:.74rem;color:${checkState[id]?'var(--ink3)':'var(--ink2)'};${checkState[id]?'text-decoration:line-through':''}">${item}</span>
      </div>`;
    });
  });
  const pct2=total?Math.round(done/total*100):0;
  g('checklistWrap').innerHTML=`
    <div class="card">
      <h3>✅ Checklist Due Diligence</h3>
      <div style="display:flex;justify-content:space-between;font-size:.71rem;color:var(--ink3);margin-bottom:6px"><span>${done} / ${total} vérifiés</span><span style="color:${pct2>=80?'var(--em)':pct2>=50?'var(--am)':'var(--ru)'}">${pct2}%</span></div>
      <div style="height:5px;background:var(--bd2);border-radius:3px;overflow:hidden;margin-bottom:13px"><div style="height:100%;width:${pct2}%;background:var(--em);border-radius:3px;transition:width .4s ease"></div></div>
      ${html}
    </div>`;
}
function togChk(id){checkState[id]=!checkState[id];buildChecklist()}

function buildTools(){
  if(!R){
    g('toolsContent').innerHTML='<div class="nodata"><span class="ico">◈</span><h3>Aucune donnée</h3><p>Calculez d\'abord un bien.</p></div>';
    buildChecklist();return;
  }
  const r=R,sc=scColor(r.score),sl=scLabel(r.score);
  const targetRents=[4,5,6,7,8];
  const ville=encodeURIComponent(tx('ville')||'France');
  const riskItems=[
    {l:'Rentabilité brute',v:pct(r.rentBrute),ok:r.rentBrute>=6,w:r.rentBrute>=4},
    {l:'CF avant impôt',v:eur(r.cfAvant)+'/mois',ok:r.cfAvant>0,w:r.cfAvant>-200},
    {l:'DPE',v:r.dpe||'—',ok:['A','B','C'].includes(r.dpe),w:r.dpe==='D'},
    {l:'Vacance',v:pct(vn('vacance')),ok:vn('vacance')<=5,w:vn('vacance')<=10},
    {l:'Ratio mens./loyer',v:r.loyerM>0?Math.round(r.mensFin/r.loyerM*100)+'%':'—',ok:r.mensFin/Math.max(1,r.loyerM)<0.7,w:r.mensFin/Math.max(1,r.loyerM)<0.85},
  ];

  g('toolsContent').innerHTML=`
    <div class="grid2">

      <div class="card">
        <h3>🎯 Score d'investissement</h3>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="width:56px;height:56px;border-radius:50%;border:3px solid ${sc};background:${sc}18;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
            <span style="font-family:'Libre Baskerville',serif;font-size:1.3rem;font-weight:700;color:${sc};line-height:1">${Math.round(r.score)}</span>
            <span style="font-size:.56rem;color:var(--ink4)">/100</span>
          </div>
          <div><div style="font-size:.83rem;font-weight:700;color:${sc}">${sl.l}</div><div style="font-size:.69rem;color:var(--ink3);margin-top:2px">${sl.s}</div></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${riskItems.map(ri=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg2);border-radius:var(--r);border:1px solid var(--bd)">
            <span style="font-size:.73rem;color:var(--ink2)">${ri.l}</span>
            <span style="font-size:.71rem;color:var(--ink3);margin-right:8px">${ri.v}</span>
            <span style="padding:2px 8px;border-radius:20px;font-size:.64rem;font-weight:700;${ri.ok?'background:var(--em-a);color:var(--em);border:1px solid var(--em-b)':ri.w?'background:var(--am-a);color:var(--am);border:1px solid rgba(245,165,32,.25)':'background:var(--ru-a);color:var(--ru);border:1px solid var(--ru-b)'}">${ri.ok?'✓ OK':ri.w?'⚠ Moyen':'✗ Risque'}</span>
          </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <h3>💶 Loyer optimal par cible de rentabilité</h3>
        <p style="font-size:.74rem;color:var(--ink3);margin-bottom:12px">Quel loyer mensuel pour atteindre chaque seuil ?</p>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${targetRents.map(t=>{
            const loyerOpt=r.coutTotal*(t/100)/12;
            const cf=(loyerOpt*(1-vn('vacance')/100-vn('impayes')/100)-r.charges/12)-r.mensFin;
            return`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;background:var(--bg2);border-radius:var(--r);border:1px solid var(--bd)">
              <span style="font-size:.72rem;color:var(--ink3);width:80px">${t}% brut</span>
              <span style="font-family:'Libre Baskerville',serif;font-weight:700;color:var(--gold)">${eur(loyerOpt)}/mois</span>
              <span style="font-size:.7rem;color:${cf>=0?'var(--em)':'var(--ru)'};white-space:nowrap">CF ${eur(cf)}</span>
            </div>`;
          }).join('')}
        </div>
        <div style="margin-top:12px;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:10px">
          <div class="field"><label>Cible personnalisée (%)</label><input type="number" id="rentCible" placeholder="6.5" min="1" max="20" step="0.5" oninput="calcLoyerOpt()"/></div>
          <div id="loyerOptResult" style="margin-top:8px;display:none;background:var(--em-a);border:1px solid var(--em-b);border-radius:var(--r);padding:10px">
            <div id="loyerOptVal" style="font-family:'Libre Baskerville',serif;font-size:1.35rem;font-weight:700;color:var(--em)"></div>
            <div id="loyerOptSub" style="font-size:.7rem;color:var(--ink3);margin-top:2px"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>📍 Localisation</h3>
        ${tx('ville')?`<p style="font-size:.76rem;color:var(--ink3);margin-bottom:10px">${tx('ville')} · ${vn('surface')||'—'}m² · ${tx('typeBien')||'—'}</p>`:'<p style="font-size:.76rem;color:var(--ink3);margin-bottom:10px">Renseignez la ville dans le simulateur.</p>'}
        <div style="height:160px;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--ink3);font-size:.78rem;margin-bottom:12px">
          <span style="font-size:1.4rem">🗺</span><span>${tx('ville')||'Ville non renseignée'}</span>
        </div>
        ${tx('ville')?`<div style="display:flex;flex-direction:column;gap:6px">
          <a href="https://www.google.com/maps/search/${ville}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:var(--r);background:var(--sa-a);color:var(--sa);border:1px solid var(--sa-b);font-size:.75rem;font-weight:700;text-decoration:none">🗺 Google Maps</a>
          <a href="https://www.meilleursagents.com/prix-immobilier/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:var(--r);background:var(--em-a);color:var(--em);border:1px solid var(--em-b);font-size:.75rem;font-weight:700;text-decoration:none">📊 Prix m² — MeilleursAgents</a>
          <a href="https://www.seloger.com/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:var(--r);background:var(--gold-a);color:var(--gold);border:1px solid var(--gold-b);font-size:.75rem;font-weight:700;text-decoration:none">🏠 Loyers marché — SeLoger</a>
        </div>`:'' }
      </div>

    </div>`;
  buildChecklist();
}

function calcLoyerOpt(){
  if(!R)return;
  const cible=parseFloat(g('rentCible')?.value)||0;
  if(cible<=0){g('loyerOptResult').style.display='none';return}
  const l=R.coutTotal*(cible/100)/12;
  const cf=(l*(1-vn('vacance')/100-vn('impayes')/100)-R.charges/12)-R.mensFin;
  g('loyerOptResult').style.display='block';
  g('loyerOptVal').textContent=eur(l)+'/mois';
  g('loyerOptSub').textContent=`CF estimé : ${eur(cf)}/mois · ${R.surface>0?eur(l/R.surface):'—'}/m²`;
}

/* ══════════════════════════════════════════════
   PORTEFEUILLE
══════════════════════════════════════════════ */
function addToPortf(){
  if(!R){toast('Calculez d\'abord un bien.','err');return}
  sv('nomProjet',tx('ville')||'');
  openMod('modalSave');
  setTimeout(()=>g('nomProjet').focus(),100);
}
function getPortf(){try{return JSON.parse(localStorage.getItem('immoV7_portf')||'[]')}catch{return[]}}
function savePortf(){
  const nom=g('nomProjet').value.trim();
  if(!nom){toast('Donnez un nom.','err');return}
  portf=getPortf();
  portf.push({id:Date.now(),nom,date:new Date().toLocaleDateString('fr-FR'),res:R,form:capForm()});
  localStorage.setItem('immoV7_portf',JSON.stringify(portf));
  closeMod('modalSave');
  g('portfBadge').textContent=portf.length;
  toast(`"${nom}" ajouté au portefeuille ✓`,'ok');
}
function delPortf(id){
  portf=getPortf().filter(p=>p.id!==id);
  localStorage.setItem('immoV7_portf',JSON.stringify(portf));
  g('portfBadge').textContent=portf.length;
  buildPortf();toast('Projet supprimé');
}
function loadPortf(id){
  const p=getPortf().find(p=>p.id===id);
  if(!p?.form)return;
  restForm(p.form);lv();calc();gv('sim');
  toast(`"${p.nom}" chargé ✓`,'ok');
}

function buildPortf(){
  portf=getPortf();
  g('portfBadge').textContent=portf.length;
  const gr=g('portfGrid');
  if(!portf.length){
    gr.innerHTML='<div class="portf-empty"><span class="ico">◈</span>Aucun projet.<br/>Calculez un bien puis cliquez sur <strong>📁 Portefeuille</strong>.</div>';
    g('portfCharts').style.display='none';
    // Reset totals
    ['ptBiens','ptValeur','ptCF','ptCFan','ptRent'].forEach(id=>sv(id,'—'));sv('ptBiens','0');
    return;
  }
  // Totaux
  const totVal=portf.reduce((s,p)=>s+(p.res?.pa||0),0);
  const totCF=portf.reduce((s,p)=>s+(p.res?.cfApres||0),0);
  const avgRent=portf.reduce((s,p)=>s+(p.res?.rentBrute||0),0)/portf.length;
  sv('ptBiens',portf.length);
  g('ptValeur').textContent=eur(totVal,0);
  g('ptCF').textContent=eur(totCF)+'/mois';
  g('ptCFan').textContent=eur(totCF*12,0)+'/an';
  g('ptRent').textContent=pct(avgRent);
  ['ptCF','ptCFan'].forEach(id=>{const el=g(id);if(el){el.className='tv '+(totCF>=0?'pos':'neg')}});

  gr.innerHTML=portf.map(p=>{
    const r=p.res||{};
    return`<div class="portf-card">
      <div class="pc-title">${p.nom}</div>
      <div class="pc-sub">${r.ville||''} · ${r.typeBien||''} · ${p.date}</div>
      <div class="pc-kpis">
        <div class="pk"><span class="l">Rent. brute</span><span class="v gold">${pct(r.rentBrute)}</span></div>
        <div class="pk"><span class="l">CF net/mois</span><span class="v ${(r.cfApres||0)>=0?'g':'r'}">${eur(r.cfApres)}</span></div>
        <div class="pk"><span class="l">Prix</span><span class="v">${eur(r.pa,0)}</span></div>
        <div class="pk"><span class="l">Score</span><span class="v" style="color:${scColor(r.score||0)}">${Math.round(r.score||0)}</span></div>
      </div>
      <div class="pc-actions">
        <button class="btn btn-g btn-sm" style="flex:1" onclick="loadPortf(${p.id})">Charger</button>
        <button class="btn btn-d btn-sm" onclick="delPortf(${p.id})">✕</button>
      </div>
    </div>`;}).join('');

  g('portfCharts').style.display='block';
  buildPortfCharts();
}

function buildPortfCharts(){
  destroyChart('chartPortfPie');destroyChart('chartPortfCF');
  const cc=chartColors();
  const palettes=['rgba(219,168,74,.7)','rgba(78,202,136,.7)','rgba(107,158,248,.7)','rgba(239,101,101,.7)','rgba(167,139,248,.7)','rgba(245,165,32,.7)'];
  setTimeout(()=>{
    const ctxP=g('chartPortfPie')?.getContext('2d');
    if(ctxP){
      chartRefs['chartPortfPie']=new Chart(ctxP,{
        type:'doughnut',
        data:{labels:portf.map(p=>p.nom),datasets:[{data:portf.map(p=>p.res?.pa||0),backgroundColor:portf.map((_,i)=>palettes[i%palettes.length]),borderWidth:0}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:cc.label,font:{size:10}}}}}
      });
    }
    const ctxCF=g('chartPortfCF')?.getContext('2d');
    if(ctxCF){
      chartRefs['chartPortfCF']=new Chart(ctxCF,{
        type:'bar',
        data:{labels:portf.map(p=>p.nom),datasets:[{label:'CF après impôt (€/mois)',data:portf.map(p=>p.res?.cfApres||0),backgroundColor:portf.map(p=>(p.res?.cfApres||0)>=0?'rgba(78,202,136,.65)':'rgba(239,101,101,.65)'),borderWidth:0,borderRadius:4}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:cc.label,font:{size:10}}}},scales:{x:{ticks:{color:cc.label,font:{size:9}},grid:{color:cc.grid}},y:{ticks:{color:cc.label,font:{size:9},callback:v=>eur(v,0)},grid:{color:cc.grid}}}}
      });
    }
  },50);
}

/* ══════════════════════════════════════════════
   HISTORIQUE AUTO
══════════════════════════════════════════════ */
function getHist(){try{return JSON.parse(localStorage.getItem('immoV7_hist')||'[]')}catch{return[]}}
function addToHist(r){
  let hist=getHist();
  hist.unshift({ts:r.ts,ville:r.ville,typeBien:r.typeBien,rentBrute:r.rentBrute,cfApres:r.cfApres,coutTotal:r.coutTotal,score:r.score,res:r,form:capForm()});
  if(hist.length>MAX_HIST)hist=hist.slice(0,MAX_HIST);
  localStorage.setItem('immoV7_hist',JSON.stringify(hist));
}
function clearHist(){localStorage.removeItem('immoV7_hist');g('histBadge').textContent=0;buildHist()}
function buildHist(){
  const hist=getHist();
  g('histBadge').textContent=hist.length;
  const el=g('histList');
  if(!hist.length){el.innerHTML='<div class="nodata"><span class="ico">◈</span><h3>Historique vide</h3><p>Les calculs sont enregistrés automatiquement.</p></div>';return}
  el.innerHTML=`<div class="hist-list">`+hist.map(h=>{
    const d=new Date(h.ts).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    return`<div class="hist-item">
      <span class="hist-time">${d}</span>
      <div class="hist-info">
        <span class="hist-name">${h.ville||'—'} · ${h.typeBien||'—'}</span>
        <span class="hist-stat">Rent. ${pct(h.rentBrute)}</span>
        <span class="hist-stat" style="color:${(h.cfApres||0)>=0?'var(--em)':'var(--ru)'}">CF ${eur(h.cfApres)}</span>
        <span class="hist-stat">Score ${Math.round(h.score||0)}</span>
      </div>
      <div class="hist-actions">
        <button class="btn btn-g btn-sm" onclick="loadHist(${h.ts})">Charger</button>
      </div>
    </div>`;}).join('')+'</div>';
}
function loadHist(ts){
  const h=getHist().find(x=>x.ts===ts);
  if(!h?.form)return;
  restForm(h.form);lv();calc();gv('sim');
  toast('Simulation chargée ✓','ok');
}

/* ══════════════════════════════════════════════
   EXPORT / IMPORT JSON
══════════════════════════════════════════════ */
function exportJSON(){
  const data={
    version:'5',
    exportedAt:new Date().toISOString(),
    simulation:R||null,
    formulaire:capForm(),
    portf:getPortf(),
    hist:getHist(),
    lots:[...lots],
    checkState:{...checkState},
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const name=(R?.ville||'simulation').toLowerCase().replace(/\s+/g,'_');
  a.download=`immosim_${name}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  toast('Fichier JSON exporté ✓','ok');
}

function importJSON(evt){
  const file=evt.target.files?.[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data.version){toast('Fichier JSON invalide.','err');return}
      if(data.formulaire)restForm(data.formulaire);
      if(data.lots)lots=[...data.lots];
      if(data.checkState)checkState={...data.checkState};
      if(data.portf&&data.portf.length){
        localStorage.setItem('immoV7_portf',JSON.stringify(data.portf));
        g('portfBadge').textContent=data.portf.length;
      }
      if(data.hist&&data.hist.length){
        localStorage.setItem('immoV7_hist',JSON.stringify(data.hist));
        g('histBadge').textContent=data.hist.length;
      }
      renderLots();lv();
      if(data.simulation){R=data.simulation;displayResults(R)}
      toast(`Import réussi — ${file.name} ✓`,'ok');
    }catch(err){toast('Erreur JSON : '+err.message,'err')}
  };
  reader.readAsText(file);
  evt.target.value='';
}

/* ══════════════════════════════════════════════
   PARTAGE PAR URL
══════════════════════════════════════════════ */
function copyShareURL(){
  const form=capForm();
  const payload=btoa(unescape(encodeURIComponent(JSON.stringify(form))));
  const url=location.origin+location.pathname+'?sim='+encodeURIComponent(payload);
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(()=>toast('Lien copié dans le presse-papier ✓','ok'));
  } else {
    const ta=document.createElement('textarea');
    ta.value=url;document.body.appendChild(ta);ta.select();document.execCommand('copy');
    document.body.removeChild(ta);toast('Lien copié ✓','ok');
  }
}
function loadShareURL(){
  const params=new URLSearchParams(location.search);
  const sim=params.get('sim');
  if(!sim)return;
  try{
    const form=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(sim)))));
    restForm(form);lv();
    toast('Simulation importée depuis le lien ✓','ok');
    history.replaceState({},'',location.pathname);
  }catch(e){console.warn('URL param invalid',e)}
}

/* ══════════════════════════════════════════════
   IA
══════════════════════════════════════════════ */
function saveKey(){
  const k=g('apiKey').value.trim();
  const st=g('keyStatus');
  if(!k.startsWith('sk-ant-')){st.style.display='block';st.style.background='var(--ru-a)';st.style.color='var(--ru)';st.style.border='1px solid var(--ru-b)';st.textContent='❌ Format invalide (sk-ant-…)';return}
  localStorage.setItem('immoV7_key',k);
  st.style.display='block';st.style.background='var(--em-a)';st.style.color='var(--em)';st.style.border='1px solid var(--em-b)';st.textContent='✅ Clé enregistrée.';
  toast('Clé API enregistrée ✓','ok');
}
function getKey(){return localStorage.getItem('immoV7_key')||''}
function toggleKeyVis(){const i=g('apiKey');i.type=i.type==='password'?'text':'password'}
async function extraire(){
  const cle=getKey();
  if(!cle){toast('Entrez votre clé API.','err');return}
  const texte=g('annonceTxt').value.trim();
  if(!texte){toast('Collez le texte de l\'annonce.','err');return}
  g('extTxt').style.display='none';g('extSpin').style.display='inline-flex';g('btnExt').disabled=true;
  const prompt=`Analyse cette annonce immobilière française. Réponds UNIQUEMENT avec un JSON valide sans backticks :
{"prixAchat":number|null,"surface":number|null,"ville":string|null,"typeBien":string|null,"dpe":string|null,"loyerMensuel":number|null,"fraisAgence":number|null,"taxeFonciere":number|null,"chargesCopro":number|null,"provisions":number|null,"travaux":number|null,"description":string|null}
ANNONCE: ${texte}`;
  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':cle,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:800,messages:[{role:'user',content:prompt}]})});
    if(!resp.ok){const e=await resp.json().catch(()=>({}));throw new Error(e.error?.message||'HTTP '+resp.status)}
    const data=await resp.json();
    iaData=JSON.parse(data.content.map(b=>b.text||'').join('').replace(/```json|```/g,'').trim());
    const labels={prixAchat:"Prix d'achat",surface:"Surface m²",ville:"Ville",typeBien:"Type",dpe:"DPE",loyerMensuel:"Loyer/mois",fraisAgence:"Frais agence",taxeFonciere:"Taxe foncière",chargesCopro:"Charges copro",provisions:"Provisions",travaux:"Travaux",description:"Description"};
    g('iaGrid').innerHTML=Object.entries(labels).map(([k,l])=>{const val=iaData[k];return`<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:7px 10px"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink4)">${l}</div><div style="font-size:.85rem;color:${val!==null&&val!==undefined?'var(--ink)':'var(--ink4)'};${val===null?'font-style:italic':'font-weight:500'}">${val!==null&&val!==undefined?val:'Non détecté'}</div></div>`;}).join('');
    g('iaResult').style.display='block';
    g('iaResult').scrollIntoView({behavior:'smooth',block:'nearest'});
    toast('Extraction réussie ✓','ok');
  }catch(err){toast('Erreur : '+err.message,'err')}
  finally{g('extTxt').style.display='inline';g('extSpin').style.display='none';g('btnExt').disabled=false}
}
function importIA(){
  if(!iaData)return;
  const s=(id,val)=>{if(val!==null&&val!==undefined)sv(id,val)};
  s('prixAchat',iaData.prixAchat);s('prixAffiche',iaData.prixAchat);
  s('surface',iaData.surface);s('ville',iaData.ville);s('dpe',iaData.dpe);
  s('loyerMensuel',iaData.loyerMensuel);s('fraisAgence',iaData.fraisAgence);
  s('taxeFonc',iaData.taxeFonciere);s('chargesCopro',iaData.chargesCopro);
  s('entretien',iaData.provisions);s('travaux',iaData.travaux);s('description',iaData.description);
  if(iaData.typeBien){const sel=g('typeBien');[...sel.options].forEach(o=>{if(o.value===iaData.typeBien)sel.value=iaData.typeBien})}
  lv();g('iaResult').style.display='none';gv('sim');toast('Données importées ✓','ok');
}

/* ══════════════════════════════════════════════
   EXPORT CSV / PDF
══════════════════════════════════════════════ */

/* ─── GESTION PHOTOS ─────────────────────────────── */
let PHOTOS=[]; // [{name, b64, mime}]

function handlePhotoInput(files){
  handlePhotoFiles(Array.from(files));
}
function handlePhotoDrop(e){
  e.preventDefault();
  document.getElementById('photoDrop').classList.remove('over');
  handlePhotoFiles(Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/')));
}
function handlePhotoFiles(files){
  const remaining=5-PHOTOS.length;
  files.slice(0,remaining).forEach(file=>{
    const reader=new FileReader();
    reader.onload=ev=>{
      PHOTOS.push({name:file.name,b64:ev.target.result.split(',')[1],mime:file.type});
      renderPhotoGrid();
    };
    reader.readAsDataURL(file);
  });
  if(files.length>remaining)toast('Maximum 5 photos — les suivantes ont été ignorées.','warn');
}
function removePhoto(i){
  PHOTOS.splice(i,1);
  renderPhotoGrid();
}
function renderPhotoGrid(){
  const grid=document.getElementById('photoGrid');
  const count=document.getElementById('photoCount');
  grid.innerHTML=PHOTOS.map((p,i)=>`
    <div class="photo-thumb">
      <img src="data:${p.mime};base64,${p.b64}" alt="${p.name}"/>
      <button class="photo-thumb-del" onclick="removePhoto(${i})" title="Supprimer">×</button>
    </div>`).join('');
  count.textContent=PHOTOS.length?(PHOTOS.length+' photo'+(PHOTOS.length>1?'s':'')+' incluse'+(PHOTOS.length>1?'s':'')+' dans le PDF'):'  ';
  document.getElementById('photoDrop').style.display=PHOTOS.length>=5?'none':'';
}

function exportCSV(){
  if(!R){toast('Calculez d\'abord.','err');return}
  const r=R;
  const rows=[['Indicateur','Valeur'],['Ville',r.ville||''],['Type',r.typeBien||''],['Surface m²',r.surface||''],['DPE',r.dpe||''],['Prix affiché',r.prixAffiche||''],['Négociation %',r.negoPct||0],['Prix achat',r.pa||''],['Coût total',r.coutTotal.toFixed(2)],['Emprunté',r.emp.toFixed(2)],['Mensualité',r.mensFin.toFixed(2)],['Loyer mensuel',r.loyerM||''],['Loyer annuel',r.loyerAn.toFixed(2)],['Charges annuelles',r.charges.toFixed(2)],['Rentabilité brute %',r.rentBrute.toFixed(2)],['Rentabilité nette %',r.rentNette.toFixed(2)],['CF avant impôt',r.cfAvant.toFixed(2)],['CF après impôt',r.cfApres.toFixed(2)],['Impôt estimé/an',r.impot.toFixed(2)],['Score',Math.round(r.score)],['Régime',r.desc]];
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));a.download='simulation_'+(r.ville||'bien').toLowerCase().replace(/\s+/g,'_')+'.csv';a.click();
  toast('CSV exporté ✓','ok');
}

function exportPDF(){
  if(!R){toast('Calculez d\'abord un bien.','err');return}
  if(typeof window.jspdf==='undefined'){toast('jsPDF non disponible.','err');return}
  try{
  const r=R;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  if(doc.setProperties){
    doc.setProperties({
      title:'ImmoSim V9 - Dossier d\'analyse patrimoniale',
      subject:'Simulation de rentabilité immobilière',
      author:'ImmoSim',
      keywords:'immobilier, investissement, rentabilité, cash-flow, fiscalité',
      creator:'ImmoSim V9'
    });
  }

  /* ── Constantes mise en page ── */
  const W=210,M=15,RR=195,CW=RR-M; // largeur contenu = 180mm
  // Palette CLAIRE — impression professionnelle
  // Couleur thème cabinet (si définie)
  const _tc=hexToRgb(getThemeColor());
  // Palette PDF verrouillée pour un rendu bancaire propre et stable.
  // On n'utilise plus les couleurs sauvegardées dans localStorage pour l'export final :
  // elles pouvaient produire des aplats cyan/bleu vif et rendre le rapport illisible.
  const _pc={
    pdf_accent:'#8c5f0f',
    pdf_accent2:'#6e4a0a',
    pdf_title:'#111827',
    pdf_header_bg:'#1f2937',
    pdf_pos:'#16824b',
    pdf_neg:'#be2d2d',
    pdf_info:'#2d5fb9',
    pdf_warn:'#b46e14',
    pdf_ink1:'#111827',
    pdf_ink2:'#374151',
    pdf_ink3:'#6b7280',
    pdf_row1:'#f8fafc',
    pdf_row2:'#ffffff',
    pdf_th_bg:'#e5e7eb'
  };
  const _h=k=>hexToRgb(_pc[k]||'#000000');
  const DARK=[255,255,255],DARK2=[247,249,253];
  const DARK3=_h('pdf_header_bg');
  const GOLD=_h('pdf_accent'),GOLD2=_h('pdf_accent2');
  const GREEN=_h('pdf_pos'),RED=_h('pdf_neg'),ORANGE=_h('pdf_warn'),BLUE=_h('pdf_info');
  const INK=_h('pdf_ink1'),INK2=_h('pdf_ink2'),INK3=_h('pdf_ink3'),INK4=_h('pdf_ink3');
  const ROW1=_h('pdf_row1'),ROW2=_h('pdf_row2'),TH_BG=_h('pdf_th_bg');
  const WHITE=[255,255,255];
  // Helpers couleurs dérivées
  const mix=(c,w,t=255)=>c.map(v=>Math.round(v+(t-v)*w));
  const GOLD_LIGHT=mix(GOLD,.88);    // fond doré très clair
  const GREEN_LIGHT=mix(GREEN,.85);   // fond vert clair
  const RED_LIGHT=mix(RED,.90);       // fond rouge clair
  const ORANGE_LIGHT=mix(ORANGE,.87); // fond orange clair
  const BLUE_LIGHT=mix(BLUE,.88);     // fond bleu clair
  const INK3_LIGHT=mix(INK3,.6);      // texte léger
  const INK2_LIGHT=mix(INK2,.45);     // texte secondaire léger
  const CARD_BG=mix(TH_BG,.55);       // fond carte KPI
  const BAR_BG=mix(TH_BG,.40);        // fond barre de progression
  const DARK_ACCENT=[...DARK3.map(v=>Math.max(0,v-30))]; // plus sombre pour ring bg
  let y=0, pageNum=0;
  const totalPagesExp='{total_pages_count_string}';

  /* ── Helpers ── */
  // Safe text wrapper — ensures jsPDF always receives a string
  const _origText=doc.text.bind(doc);
  doc.text=function(text,x,y,options){
    if(Array.isArray(text))text=text.map(t=>String(t==null?'':t));
    else text=String(text==null?'—':text);
    if(typeof x!=='number'||isNaN(x))x=0;
    if(typeof y!=='number'||isNaN(y))y=0;
    return _origText(text,x,y,options);
  };
  // Safe setCharSpace — may not exist in all builds
  const _setCharSpace=doc.setCharSpace?doc.setCharSpace.bind(doc):function(){};
  doc.setCharSpace=function(v){try{_setCharSpace(v)}catch(e){}};
  // BUGFIX: toLocaleString('fr-FR') utilise des espaces insécables (U+00A0) comme
  // séparateurs de milliers. jsPDF ne les gère pas et les affiche en "/".
  // Solution : remplacement systématique par des espaces normaux.
  const fmt=(n,d=0)=>(+n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d}).replace(/[\u00A0\u202F]/g,' ');
  const e=(n,d=0)=>{if(isNaN(n)||n===null||n===undefined)return'—';return fmt(n,d)+' \u20AC'};
  const p=(n,d=2)=>{if(isNaN(n)||!isFinite(n))return'—';return fmt(n,d)+'%'};
  const n0=(v)=>isNaN(+v)||!v?0:+v;

  function addPage(){
    doc.addPage();
    pageNum++;
    doc.setFillColor(255,255,255);doc.rect(0,0,W,297,'F');
    // Top accent bar
    doc.setFillColor(...GOLD);doc.rect(0,0,W,2,'F');
    // Header bar
    doc.setFillColor(...DARK3);doc.rect(0,2,W,12,'F');
    doc.setTextColor(...GOLD);doc.setFontSize(6.5);doc.setFont('helvetica','bold');
    doc.setCharSpace(.3);
    doc.text('IMMOSIM V9  -  DOSSIER D\'ANALYSE PATRIMONIALE',M,9);
    doc.setCharSpace(0);
    if(r.ville||r.typeBien){
      const titreH=[(r.typeBien||''),(r.ville||'')].filter(Boolean).join(' - ');
      doc.setTextColor(...INK3_LIGHT);doc.setFontSize(6);doc.setFont('helvetica','normal');
      doc.text(titreH,RR,9,{align:'right'});
    }
    // Footer
    doc.setDrawColor(...INK3_LIGHT);doc.setLineWidth(.15);doc.line(M,283,RR,283);
    doc.setFontSize(6.5);doc.setTextColor(...INK3);doc.setFont('helvetica','normal');
    const dateStr=new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
    doc.text('ImmoSim V9  -  Dossier genere le '+dateStr+'  -  Estimations indicatives - non contractuelles',M,288);
    doc.setTextColor(...GOLD);doc.setFont('helvetica','bold');
    doc.text(pageNum+' / '+totalPagesExp,RR,288,{align:'right'});
    y=20;
  }

  function checkY(needed=10){if(y+needed>278)addPage();}

  function sectionTitle(label,icon=''){
    checkY(16);
    // Modern gradient-feel header with rounded corners
    doc.setFillColor(...DARK3);doc.roundedRect(M,y-1,CW,10,2,2,'F');
    // Gold left accent
    doc.setFillColor(...GOLD);doc.roundedRect(M,y-1,3,10,2,2,'F');
    doc.setFillColor(...GOLD);doc.rect(M+1,y-1,2,10,'F');
    // Number badge
    if(icon){
      doc.setFillColor(...GOLD);doc.circle(M+9,y+3.5,4,'F');
      doc.setTextColor(...INK);doc.setFontSize(5.5);doc.setFont('helvetica','bold');
      doc.text(icon,M+9,y+5,{align:'center'});
    }
    doc.setTextColor(255,255,255);doc.setFontSize(8);doc.setFont('helvetica','bold');
    doc.text(label.toUpperCase(),M+(icon?17:8),y+5);
    y+=14;
  }

  function subTitle(label){
    checkY(8);
    doc.setTextColor(...INK2);doc.setFontSize(7.5);doc.setFont('helvetica','bold');
    doc.text(label,M,y);y+=6;
  }

  // row simple : label gauche, valeur droite, fond alternant
  let rowToggle=false;
  function row(label,val,color=INK2,bold=false,indent=0){
    checkY(7.5);
    rowToggle=!rowToggle;
    const _rclr=rowToggle?ROW1:ROW2;
    doc.setFillColor(..._rclr);
    doc.roundedRect(M,y-3.5,CW,7,1,1,'F');
    // Subtle left accent for bold/important rows
    if(bold){doc.setFillColor(...color);doc.rect(M,y-2.5,1.5,5,'F');}
    doc.setTextColor(...INK3);doc.setFontSize(7.5);doc.setFont('helvetica','normal');
    doc.text(label,M+4+indent,y+0.5);
    doc.setTextColor(...color);doc.setFont('helvetica',bold?'bold':'normal');
    doc.setFontSize(bold?8.5:7.5);
    doc.text(String(val),RR-3,y+0.5,{align:'right'});
    y+=7.5;
  }

  function rowSeparator(){checkY(3);doc.setDrawColor(...INK4);doc.setLineWidth(.1);doc.line(M,y,RR,y);y+=4;}

  // Bloc KPI visuel (grand)
  function kpiBlock(items,bx,by,bw,bh){
    doc.setFillColor(...CARD_BG);doc.roundedRect(bx,by,bw,bh,2,2,'F');
    doc.setDrawColor(...GOLD2);doc.setLineWidth(.3);doc.roundedRect(bx,by,bw,bh,2,2,'S');
    const mid=bh/2;
    doc.setTextColor(...items.color||GOLD);doc.setFontSize(items.valSize||11);doc.setFont('helvetica','bold');
    doc.text(String(items.val),bx+bw/2,by+mid-1,{align:'center'});
    doc.setTextColor(...INK3);doc.setFontSize(6);doc.setFont('helvetica','normal');
    doc.text(items.label,bx+bw/2,by+mid+5,{align:'center'});
  }

  // Mini barre de progression horizontale
  function progressBar(bx,by,bw,bh,ratio,color){
    doc.setFillColor(...BAR_BG);doc.roundedRect(bx,by,bw,bh,1,1,'F');
    const fw=Math.max(2,Math.min(bw,bw*ratio));
    doc.setFillColor(...color);doc.roundedRect(bx,by,fw,bh,1,1,'F');
  }

  // Tableau avec en-tête
  function tableHeader(cols){
    checkY(8);
    doc.setFillColor(...TH_BG);doc.rect(M,y-1,CW,7,'F');
    cols.forEach(c=>{
      doc.setTextColor(...GOLD);doc.setFontSize(6.5);doc.setFont('helvetica','bold');
      doc.text(c.label,c.x,y+3,{align:c.align||'left'});
    });
    y+=8;rowToggle=false;
  }

  function tableRow(cols,colDefs){
    checkY(6.5);
    rowToggle=!rowToggle;
    const _rclr=rowToggle?ROW1:ROW2;
    doc.setFillColor(..._rclr);
    doc.rect(M,y-3,CW,6.5,'F');
    cols.forEach((val,i)=>{
      const cd=colDefs[i];
      doc.setTextColor(...(cd.color||INK2));
      doc.setFontSize(7);doc.setFont('helvetica',cd.bold?'bold':'normal');
      doc.text(String(val===undefined||val===null?'—':val),cd.x,y+0.5,{align:cd.align||'left'});
    });
    y+=7;
  }

  // Texte multiligne avec wrap
  function wrapText(txt,x,startY,maxW,lineH=5){
    const words=String(txt||'').split(' ');
    let line='';
    let cy=startY;
    words.forEach(w=>{
      const test=line?line+' '+w:w;
      if(doc.getTextWidth(test)>maxW){
        doc.text(line,x,cy);cy+=lineH;line=w;
      } else line=test;
    });
    if(line)doc.text(line,x,cy);
    return cy+lineH;
  }
  function pdfCallout(title,body,color=BLUE,fill=BLUE_LIGHT){
    const lines=doc.splitTextToSize(String(body||''),CW-12);
    const h=Math.max(14,10+lines.length*4);
    checkY(h+4);
    doc.setFillColor(...fill);doc.roundedRect(M,y,CW,h,2,2,'F');
    doc.setDrawColor(...color);doc.setLineWidth(.25);doc.roundedRect(M,y,CW,h,2,2,'S');
    doc.setFillColor(...color);doc.rect(M,y+2,2,h-4,'F');
    doc.setTextColor(...color);doc.setFontSize(7.5);doc.setFont('helvetica','bold');
    doc.text(title,M+6,y+6);
    doc.setTextColor(...INK2);doc.setFontSize(6.7);doc.setFont('helvetica','normal');
    doc.text(lines,M+6,y+11);
    y+=h+5;
  }

  function pdfChecklist(items){
    // Cartes checklist auto-ajustables : aucune ligne ne doit sortir du cadre.
    // Le label et la note sont wrappés, la valeur de droite garde sa zone dédiée.
    items.forEach((it,i)=>{
      const statusColor=it.ok?GREEN:(it.warn?ORANGE:RED);
      const value=String(it.value===undefined||it.value===null?'—':it.value);

      doc.setFont('helvetica','bold');
      doc.setFontSize(7);
      const valueW=Math.min(48,Math.max(24,doc.getTextWidth(value)+5));
      const leftX=M+10;
      const rightX=RR-4;
      const labelW=CW-16-valueW;

      const labelLines=doc.splitTextToSize(String(it.label||''),Math.max(60,labelW));
      doc.setFont('helvetica','normal');
      doc.setFontSize(5.8);
      const noteLines=it.note?doc.splitTextToSize(String(it.note),CW-18):[];

      const labelH=labelLines.length*3.8;
      const noteH=noteLines.length?2+noteLines.length*3.4:0;
      const rowH=Math.max(12,7+labelH+noteH);
      checkY(rowH+3);

      const top=y;
      doc.setFillColor(...(i%2?ROW2:ROW1));
      doc.roundedRect(M,top,CW,rowH,1.5,1.5,'F');
      doc.setDrawColor(...mix(statusColor,.72));
      doc.setLineWidth(.12);
      doc.roundedRect(M,top,CW,rowH,1.5,1.5,'S');
      doc.setFillColor(...statusColor);
      doc.circle(M+4.5,top+5.5,2.2,'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(4.4);
      doc.setFont('helvetica','bold');
      doc.text(it.ok?'OK':(it.warn?'!':'x'),M+4.5,top+6.3,{align:'center'});

      doc.setTextColor(...INK2);
      doc.setFontSize(7);
      doc.setFont('helvetica','bold');
      doc.text(labelLines,leftX,top+5.2,{lineHeightFactor:1.15});

      doc.setTextColor(...statusColor);
      doc.setFont('helvetica','bold');
      doc.setFontSize(7);
      doc.text(value,rightX,top+5.2,{align:'right'});

      if(noteLines.length){
        doc.setTextColor(...INK3);
        doc.setFontSize(5.8);
        doc.setFont('helvetica','normal');
        const noteY=top+5.2+labelH+2;
        doc.text(noteLines,leftX,noteY,{lineHeightFactor:1.15});
      }
      y+=rowH+3;
    });
  }

  /* ════════════════════════════════════════
     PAGE 1 — COUVERTURE PREMIUM
  ════════════════════════════════════════ */
  pageNum=1;
  // Full white background
  doc.setFillColor(255,255,255);doc.rect(0,0,W,297,'F');

  // ── TOP HERO BLOCK (dark gradient feel) ──
  doc.setFillColor(...DARK3);doc.rect(0,0,W,105,'F');
  // Gold accent bar top
  doc.setFillColor(...GOLD);doc.rect(0,0,W,3,'F');
  // Subtle side accent
  doc.setFillColor(...GOLD);doc.rect(0,3,3,102,'F');

  // ── IDENTITY / BRANDING ──
  const identity=getIdentity();
  const hasIdentity=identity.cabinet||identity.conseiller;
  let headerBaseY=10;
  if(hasIdentity){
    let logoEndX=M+2;
    if(identity.logo){
      try{doc.addImage(identity.logo,'PNG',M+2,8,20,16,'logo','MEDIUM');logoEndX=M+26;}catch(e){}
    }
    doc.setTextColor(...GOLD);doc.setFontSize(11);doc.setFont('helvetica','bold');
    doc.text(identity.cabinet||identity.conseiller,logoEndX,16);
    doc.setTextColor(...INK3_LIGHT);doc.setFontSize(7);doc.setFont('helvetica','normal');
    let cLine=22;
    if(identity.conseiller&&identity.cabinet){doc.text(identity.conseiller+(identity.titre?' - '+identity.titre:''),logoEndX,cLine);cLine+=4.5;}
    const contacts=[identity.tel,identity.email,identity.web].filter(Boolean).join('  |  ');
    if(contacts)doc.text(contacts,logoEndX,cLine);
    headerBaseY=32;
  } else {
    headerBaseY=14;
  }

  // ── DOCUMENT BADGE (top right) ──
  doc.setFillColor(...GOLD);doc.roundedRect(W-62,8,50,14,2,2,'F');
  doc.setTextColor(...INK);doc.setFontSize(6.5);doc.setFont('helvetica','bold');
  doc.text('DOSSIER D\'ANALYSE',W-37,14,{align:'center'});
  doc.text('PATRIMONIALE',W-37,19,{align:'center'});

  // ── MAIN TITLE ──
  doc.setTextColor(255,255,255);doc.setFontSize(28);doc.setFont('helvetica','bold');
  const titreB=(r.typeBien||'Bien immobilier').toUpperCase();
  doc.text(titreB,M+2,headerBaseY+18);
  if(r.ville){
    doc.setTextColor(...GOLD);doc.setFontSize(16);doc.setFont('helvetica','normal');
    doc.text(r.ville,M+2,headerBaseY+30);
  }
  // Metadata line
  const meta=[];
  if(r.surface)meta.push(r.surface+' m2');
  if(r.dpe)meta.push('DPE '+r.dpe);
  if(r.pa)meta.push('Prix : '+e(r.pa));
  doc.setTextColor(...INK3_LIGHT);doc.setFontSize(8.5);doc.setFont('helvetica','normal');
  doc.text(meta.filter(Boolean).join('   -   '),M+2,headerBaseY+40);

  // ── SCORE RING (right side of hero) ──
  const scC=r.score>=70?GREEN:r.score>=45?ORANGE:RED;
  const scLbl=r.score>=70?'Excellent':r.score>=60?'Bon':r.score>=45?'Moyen':r.score>=30?'Faible':'Risque';
  const ringX=W-42,ringY=Math.max(headerBaseY+20,42),ringR=18;
  // Circle background
  doc.setFillColor(...DARK_ACCENT);doc.circle(ringX,ringY,ringR+1,'F');
  // Outer ring
  doc.setDrawColor(...INK3);doc.setLineWidth(2.5);doc.circle(ringX,ringY,ringR,'S');
  // Score colored ring
  doc.setDrawColor(...scC);doc.setLineWidth(3);doc.circle(ringX,ringY,ringR,'S');
  // Score number
  doc.setTextColor(...scC);doc.setFontSize(20);doc.setFont('helvetica','bold');
  doc.text(Math.round(r.score)+'',ringX,ringY+2,{align:'center'});
  doc.setTextColor(...INK3_LIGHT);doc.setFontSize(6);doc.setFont('helvetica','normal');
  doc.text('/100',ringX,ringY+8,{align:'center'});
  doc.setTextColor(...scC);doc.setFontSize(7);doc.setFont('helvetica','bold');
  doc.text(scLbl.toUpperCase(),ringX,ringY+15,{align:'center'});

  // ── KPI CARDS (below hero on white background) ──
  y=112;
  const cover_kpis=[
    {label:'Cout total',val:e(r.coutTotal),color:GOLD,icon:'\u20AC'},
    {label:'Rent. brute',val:p(r.rentBrute),color:GOLD,icon:'%'},
    {label:'Rent. nette',val:p(r.rentNette),color:GOLD,icon:'%'},
    {label:'CF avant impot',val:e(r.cfAvant)+'/mois',color:r.cfAvant>=0?GREEN:RED,icon:r.cfAvant>=0?'+':'-'},
    {label:'CF apres impot',val:e(r.cfApres)+'/mois',color:r.cfApres>=0?GREEN:RED,icon:r.cfApres>=0?'+':'-'},
    {label:'Mensualite',val:e(r.mensFin)+'/mois',color:BLUE,icon:'M'},
  ];
  const kW=56,kH=28,kG=5,kpiPerRow=3;
  cover_kpis.forEach((k,i)=>{
    const col=i%kpiPerRow;
    const row_=Math.floor(i/kpiPerRow);
    const kx=M+col*(kW+kG);
    const ky=y+row_*(kH+kG);
    // Card with colored left border
    doc.setFillColor(...CARD_BG);doc.roundedRect(kx,ky,kW,kH,2,2,'F');
    doc.setDrawColor(...BAR_BG);doc.setLineWidth(0.3);doc.roundedRect(kx,ky,kW,kH,2,2,'S');
    doc.setFillColor(...k.color);doc.rect(kx,ky+2,2,kH-4,'F');
    // Value
    doc.setTextColor(...k.color);doc.setFontSize(10);doc.setFont('helvetica','bold');
    doc.text(String(k.val),kx+kW/2+2,ky+12,{align:'center'});
    // Label
    doc.setTextColor(...INK3);doc.setFontSize(6);doc.setFont('helvetica','normal');
    doc.text(k.label.toUpperCase(),kx+kW/2+2,ky+20,{align:'center'});
  });
  y+=2*(kH+kG)+8;

  // ── TRI + TAUX ENDETTEMENT ROW ──
  const tri_val=computeTRI(r);
  const rev_menage=vn('revenusMenage');
  if(tri_val!==null||rev_menage>0){
    const miniKpis=[];
    if(tri_val!==null)miniKpis.push({label:'TRI ('+r.horizon+' ans)',val:p(tri_val),color:GOLD});
    if(rev_menage>0){
      const dRatio=((r.mensFin+vn('autresCredits'))/rev_menage)*100;
      miniKpis.push({label:'Taux endettement',val:p(dRatio,1),color:dRatio<=33?GREEN:dRatio<=35?ORANGE:RED});
    }
    miniKpis.forEach((mk,i)=>{
      const mkx=M+i*(kW+kG);
      doc.setFillColor(...CARD_BG);doc.roundedRect(mkx,y,kW,18,2,2,'F');
      doc.setFillColor(...mk.color);doc.rect(mkx,y+2,2,14,'F');
      doc.setTextColor(...mk.color);doc.setFontSize(9);doc.setFont('helvetica','bold');
      doc.text(mk.val,mkx+kW/2+2,y+8,{align:'center'});
      doc.setTextColor(...INK3);doc.setFontSize(5.5);doc.setFont('helvetica','normal');
      doc.text(mk.label.toUpperCase(),mkx+kW/2+2,y+14.5,{align:'center'});
    });
    y+=24;
  }

  // ── DESCRIPTION ──
  const desc=tx('description');
  if(desc){
    doc.setFillColor(...CARD_BG);doc.roundedRect(M,y,CW,16,2,2,'F');
    doc.setFillColor(...GOLD);doc.rect(M,y+3,2,10,'F');
    doc.setTextColor(...INK2);doc.setFontSize(7.5);doc.setFont('helvetica','italic');
    const descLines=doc.splitTextToSize('"'+desc+'"',CW-18);
    doc.text(descLines.slice(0,2),M+8,y+7);
    y+=20;
  }

  // ── BEST REGIME RECOMMENDATION ──
  doc.setFillColor(...GREEN_LIGHT);doc.roundedRect(M,y,CW,16,2,2,'F');
  doc.setFillColor(...GREEN);doc.rect(M,y+2,3,12,'F');
  const regRec=((r.bestReg&&r.bestReg.res&&r.bestReg.res.desc)||'').split('--')[0]||((r.bestReg&&r.bestReg.res&&r.bestReg.res.desc)||'').split('—')[0]||'';
  doc.setTextColor(...GREEN);doc.setFontSize(7.5);doc.setFont('helvetica','bold');
  doc.text('REGIME OPTIMAL : '+regRec.trim().toUpperCase(),M+8,y+6);
  doc.setTextColor(...GREEN);doc.setFont('helvetica','normal');doc.setFontSize(7);
  doc.text('Cash-flow apres impot : '+e(r.bestReg?r.bestReg.res.cfApres:0)+'/mois   |   Impot estime : '+e(r.bestReg?r.bestReg.res.impot:0)+'/an',M+8,y+12);
  y+=20;

  // ── FOOTER ──
  doc.setDrawColor(...INK3_LIGHT);doc.setLineWidth(.15);doc.line(M,278,RR,278);
  doc.setFontSize(6.5);doc.setTextColor(...INK3);doc.setFont('helvetica','normal');
  const dateStr=new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
  doc.text('ImmoSim V9  -  Dossier genere le '+dateStr+'  -  Estimations indicatives - non contractuelles',M,283);
  doc.setTextColor(...GOLD);doc.setFont('helvetica','bold');doc.text('1 / '+totalPagesExp,RR,283,{align:'right'});


  /* ═══════════════════════════════════════════
     PAGE SOMMAIRE — LECTURE RAPIDE
  ═══════════════════════════════════════════ */
  addPage();
  sectionTitle('Sommaire du dossier','S');
  pdfCallout('Comment lire ce dossier','La première partie sert à décider rapidement : score, cash-flow, financement et risques. Les pages suivantes détaillent les hypothèses, la fiscalité, le crédit, les projections et les points de vérification avant offre.',GOLD,GOLD_LIGHT);
  const toc=[
    ['1','Dashboard investisseur','Score, rentabilité, cash-flow, financement et scénarios.'],
    ['2','Photos du bien','Visuel du logement si des photos ont été ajoutées.'],
    ['3','Identification et acquisition','Prix, frais, travaux, ville, DPE et description.'],
    ['4','Financement et exploitation','Crédit, mensualité, loyers, charges, vacance et impayés.'],
    ['5','Fiscalité et régimes','Comparaison micro, réel, LMNP, SCI IR et SCI IS.'],
    ['6','Projection long terme','Cash-flow, amortissement, patrimoine net et revente.'],
    ['7','Décision investisseur','Points forts, alertes, action plan et vérifications terrain.'],
    ['8','Avertissement','Limites des calculs et rappel non contractuel.']
  ];
  tableHeader([
    {label:'Bloc',x:M+3,align:'left'},
    {label:'Contenu',x:M+28,align:'left'},
    {label:'Utilité',x:M+93,align:'left'},
  ]);
  toc.forEach(t=>tableRow(t,[
    {x:M+3,align:'left',color:GOLD,bold:true},
    {x:M+28,align:'left',color:INK2,bold:true},
    {x:M+93,align:'left',color:INK3},
  ]));
  y+=6;
  sectionTitle('Lecture express en 60 secondes','L');
  pdfChecklist([
    {label:'Cash-flow après impôt',value:e(r.cfApres)+'/mois',ok:r.cfApres>=0,warn:r.cfApres>-150,note:'Indicateur central pour savoir si le bien s’autofinance réellement.'},
    {label:'Rentabilité nette',value:p(r.rentNette),ok:r.rentNette>=5.5,warn:r.rentNette>=3.5,note:'À comparer au secteur, au risque locatif et à l’effort d’épargne accepté.'},
    {label:'DPE',value:r.dpe?'Classe '+r.dpe:'Non renseigné',ok:['A','B','C','D'].includes(r.dpe),warn:r.dpe==='E',note:'DPE F/G : risque réglementaire, travaux et vacance plus élevés.'},
    {label:'Effet de levier',value:r.apport>0?p((r.cfAvant*12/r.apport)):'Apport nul',ok:r.apport>0&&(r.cfAvant*12/r.apport)>0,warn:r.cfAvant>-100,note:'Mesure le rendement du cash réellement immobilisé.'},
    {label:'Régime fiscal conseillé',value:(r.bestReg&&r.bestReg.res?String(r.bestReg.res.desc).split('—')[0].trim():'—'),ok:true,note:'À confirmer avec un expert-comptable si le dossier passe en offre.'}
  ]);

  /* ═══════════════════════════════════════════
     PAGE 2 — DASHBOARD VISUEL (NOUVEAU)
  ═══════════════════════════════════════════ */
  addPage();
  sectionTitle('Dashboard de l\'investissement','00');

  // ── ROW 1: 4 mini KPI cards ──
  const dashKpis=[
    {label:'Rentabilite brute',val:p(r.rentBrute),color:GOLD},
    {label:'Rentabilite nette',val:p(r.rentNette),color:GOLD},
    {label:'Cash-flow/mois',val:e(r.cfApres),color:r.cfApres>=0?GREEN:RED},
    {label:'Score',val:Math.round(r.score)+'/100',color:scC},
  ];
  const dkW=(CW-15)/4;
  dashKpis.forEach((dk,i)=>{
    const dx=M+i*(dkW+5);
    doc.setFillColor(...CARD_BG);doc.roundedRect(dx,y,dkW,22,2,2,'F');
    doc.setFillColor(...dk.color);doc.rect(dx,y+3,2,16,'F');
    doc.setTextColor(...dk.color);doc.setFontSize(11);doc.setFont('helvetica','bold');
    doc.text(dk.val,dx+dkW/2+2,y+10,{align:'center'});
    doc.setTextColor(...INK3);doc.setFontSize(5.5);doc.setFont('helvetica','normal');
    doc.text(dk.label.toUpperCase(),dx+dkW/2+2,y+18,{align:'center'});
  });
  y+=30;

  // ── ROW 2: Financing breakdown visual ──
  subTitle('Repartition du financement');
  const ratioAp_dash=r.coutTotal>0?r.apport/r.coutTotal:0;
  const finBarY=y,finBarH=12,finBarW=CW;
  // Full bar background
  doc.setFillColor(...BAR_BG);doc.roundedRect(M,finBarY,finBarW,finBarH,3,3,'F');
  // Apport portion
  const apW=Math.max(3,finBarW*ratioAp_dash);
  doc.setFillColor(...BLUE);doc.roundedRect(M,finBarY,apW,finBarH,3,3,'F');
  // Credit portion
  doc.setFillColor(...GOLD);doc.roundedRect(M+apW,finBarY,finBarW-apW,finBarH,0,0,'F');
  // Right rounded corner fix
  doc.setFillColor(...GOLD);doc.roundedRect(M+apW,finBarY,finBarW-apW,finBarH,3,3,'F');
  // Labels on bar
  if(ratioAp_dash>0.08){
    doc.setTextColor(255,255,255);doc.setFontSize(7);doc.setFont('helvetica','bold');
    doc.text('Apport '+p(ratioAp_dash*100,1),M+apW/2,finBarY+7.5,{align:'center'});
  }
  doc.setTextColor(...INK);doc.setFontSize(7);doc.setFont('helvetica','bold');
  doc.text('Emprunt '+p((1-ratioAp_dash)*100,1),M+apW+(finBarW-apW)/2,finBarY+7.5,{align:'center'});
  y=finBarY+finBarH+4;
  // Legend
  doc.setFillColor(...BLUE);doc.circle(M+2,y+2,1.5,'F');
  doc.setTextColor(...INK3);doc.setFontSize(6.5);doc.setFont('helvetica','normal');
  doc.text('Apport : '+e(r.apport,0),M+6,y+3.5);
  doc.setFillColor(...GOLD);doc.circle(M+60,y+2,1.5,'F');
  doc.text('Emprunt : '+e(r.emp,0),M+64,y+3.5);
  doc.setFillColor(...RED);doc.circle(M+125,y+2,1.5,'F');
  doc.text('Interets totaux : '+e(r.mensFin*r.dureePret*12-r.emp,0),M+129,y+3.5);
  y+=10;

  // ── ROW 3: Cash-flow waterfall ──
  subTitle('Decomposition du cash-flow mensuel');
  const cfItems=[
    {label:'Loyer',val:r.loyerM,color:GREEN},
    {label:'Credit',val:-r.mensFin,color:RED},
    {label:'Charges',val:-r.charges/12,color:RED},
    {label:'Impot',val:-r.impot/12,color:RED},
    {label:'= CF net',val:r.cfApres,color:r.cfApres>=0?GREEN:RED},
  ];
  const cfBarW=(CW-20)/cfItems.length;
  const maxCf=Math.max(...cfItems.map(c=>Math.abs(c.val)),1);
  const cfBarMaxH=35;
  cfItems.forEach((ci,i)=>{
    const cx=M+i*(cfBarW+4);
    const barH2=Math.min(cfBarMaxH,(Math.abs(ci.val)/maxCf)*cfBarMaxH);
    const barTop=ci.val>=0?(y+cfBarMaxH-barH2):y;
    // Bar
    doc.setFillColor(...ci.color);
    if(i===cfItems.length-1){doc.setFillColor(...ci.color);}
    doc.roundedRect(cx+3,barTop,cfBarW-6,barH2,1.5,1.5,'F');
    // Value on bar
    doc.setTextColor(...ci.color);doc.setFontSize(7);doc.setFont('helvetica','bold');
    doc.text(e(ci.val),cx+cfBarW/2,ci.val>=0?barTop-2:barTop+barH2+5,{align:'center'});
    // Label below
    doc.setTextColor(...INK3);doc.setFontSize(5.5);doc.setFont('helvetica','normal');
    doc.text(ci.label,cx+cfBarW/2,y+cfBarMaxH+10,{align:'center'});
  });
  y+=cfBarMaxH+18;

  // ── ROW 4: Score breakdown mini bars ──
  subTitle('Score d\'investissement - detail des criteres');
  const criteria_dash=[
    {l:'Rentabilite brute',v:r.rentBrute,max:10,pts:r.rentBrute>=8?25:r.rentBrute>=6?17:r.rentBrute>=4?8:2,ptsMax:25},
    {l:'Cash-flow',v:r.cfAvant,max:500,pts:r.cfAvant>200?20:r.cfAvant>0?12:r.cfAvant>-200?4:0,ptsMax:20},
    {l:'DPE',v:r.dpe||'?',max:1,pts:({A:15,B:13,C:10,D:7,E:4,F:1,G:0}[r.dpe]||5),ptsMax:15},
    {l:'Vacance',v:vn('vacance'),max:20,pts:vn('vacance')<=3?12:vn('vacance')<=7?8:vn('vacance')<=12?4:0,ptsMax:12},
    {l:'Ratio mens./loyer',v:r.mensFin/Math.max(1,r.loyerM),max:2,pts:r.mensFin/Math.max(1,r.loyerM)<0.6?13:r.mensFin/Math.max(1,r.loyerM)<0.8?8:r.mensFin/Math.max(1,r.loyerM)<1?4:0,ptsMax:13},
  ];
  if(_selectedCity&&_selectedCity._attrScore){
    const _as2=_selectedCity._attrScore;
    criteria_dash.push({l:'Attractivite ville',v:_as2,max:100,pts:_as2>=75?15:_as2>=60?10:_as2>=45?5:1,ptsMax:15});
  }
  criteria_dash.forEach((cd,i)=>{
    const cy=y+i*10;
    const ratio=cd.pts/cd.ptsMax;
    const col=ratio>=0.7?GREEN:ratio>=0.4?ORANGE:RED;
    // Label
    doc.setTextColor(...INK2);doc.setFontSize(6.5);doc.setFont('helvetica','normal');
    doc.text(cd.l,M,cy+4);
    // Bar background
    doc.setFillColor(...BAR_BG);doc.roundedRect(M+48,cy+1,CW-72,6,2,2,'F');
    // Bar filled
    doc.setFillColor(...col);doc.roundedRect(M+48,cy+1,(CW-72)*ratio,6,2,2,'F');
    // Score text
    doc.setTextColor(...col);doc.setFontSize(6.5);doc.setFont('helvetica','bold');
    doc.text(cd.pts+'/'+cd.ptsMax,RR-2,cy+5,{align:'right'});
  });
  y+=criteria_dash.length*10+8;

  // ── SCENARIO COMPARISON (mini) ──
  if(typeof calcMens==='function'){
    subTitle('Scenarios : Optimiste / Realiste / Pessimiste');
    const scens=[
      {name:'OPTIMISTE',loyerM:1.05,vacM:0.5,tauxD:-0.3,col:GREEN},
      {name:'REALISTE',loyerM:1,vacM:1,tauxD:0,col:GOLD},
      {name:'PESSIMISTE',loyerM:0.9,vacM:2,tauxD:0.5,col:RED},
    ];
    const scW=(CW-10)/3;
    scens.forEach((sc,i)=>{
      const sx=M+i*(scW+5);
      const ly=r.loyerM*sc.loyerM;
      const adjT=Math.max(0.1,r.tauxPret+sc.tauxD);
      const adjMens=calcMens(r.emp,adjT,r.dureePret);
      let aEM=vn('assurEmpr');if(g('periodeAss').value==='a')aEM/=12;
      const mf2=g('mensManuelle').value.trim()?vn('mensManuelle'):adjMens+aEM;
      const vac=vn('vacance')*sc.vacM;
      const revN=ly*12*(1-vac/100-(vn('impayes')||0)/100);
      const cf2=(revN-r.charges)/12-mf2;
      // Card
      doc.setFillColor(...CARD_BG);doc.roundedRect(sx,y,scW,40,2,2,'F');
      doc.setFillColor(...sc.col);doc.rect(sx,y+3,2,34,'F');
      // Title
      doc.setTextColor(...sc.col);doc.setFontSize(6.5);doc.setFont('helvetica','bold');
      doc.text(sc.name,sx+scW/2,y+8,{align:'center'});
      // Data rows
      doc.setFontSize(6);doc.setFont('helvetica','normal');
      const rows2=[
        ['Loyer',e(ly)],
        ['Taux',p(adjT)],
        ['Mensualite',e(mf2)],
        ['CF/mois',e(cf2)],
      ];
      rows2.forEach((rr,j)=>{
        doc.setTextColor(...INK3);doc.text(rr[0],sx+5,y+16+j*6);
        doc.setTextColor(...(j===3?(cf2>=0?GREEN:RED):INK2));doc.setFont('helvetica',j===3?'bold':'normal');
        doc.text(rr[1],sx+scW-4,y+16+j*6,{align:'right'});
      });
    });
    y+=48;
  }

  /* ═══ PAGE PHOTOS (si photos uploadées) ═══════════ */
  /* ═══ PAGE PHOTOS (si photos uploadées) ═══════════ */
  if(typeof PHOTOS!=='undefined'&&PHOTOS.length>0){
    addPage();
    sectionTitle('Photos du bien','00');
    const phW=CW/2-3, phH=55;
    let px=M, py=y;
    PHOTOS.forEach((ph,i)=>{
      try{
        const imgData='data:'+ph.mime+';base64,'+ph.b64;
        doc.addImage(imgData,(ph.mime||'').includes('png')?'PNG':'JPEG',px,py,phW,phH,undefined,'MEDIUM');
        // Légende
        doc.setFontSize(6);doc.setTextColor(...INK3);doc.setFont('helvetica','normal');
        doc.text(ph.name.substring(0,28),px+1,py+phH+4);
      }catch(err){console.warn('Photo ignorée:',ph.name,err);}
      if(i%2===1){py+=phH+8;px=M;}
      else px=M+phW+6;
    });
    y=py+(PHOTOS.length%2===1?phH+8:0)+6;
  }

  /* ════════════════════════════════════════
     PAGE 2 — ACQUISITION & FINANCEMENT
  ════════════════════════════════════════ */
  addPage();
  sectionTitle('Identification du bien','01');
  rowToggle=false;
  row('Type de bien',r.typeBien||'—');
  row('Ville / Localisation',r.ville||'—');
  const _cp=tx('codePostal');if(_cp)row('Code postal',_cp);
  row('Surface habitable',r.surface?r.surface+' m²':'—');
  row('Diagnostic Performance Énergétique (DPE)',r.dpe?'Classe '+r.dpe:'—',['A','B','C'].includes(r.dpe)?GREEN:['E','F','G'].includes(r.dpe)?RED:INK2);
  row('Type de location',{'nue':'Location nue (longue durée)','meublee':'Location meublée (LMNP)','courte':'Location courte durée (Airbnb)'}[r.isCD?'courte':(tx('typeLoc')||'nue')]||'—');
  row('Ancienneté',tx('anciennete')==='neuf'?'Neuf / VEFA':'Ancien (>5 ans)');
  // Données ville si disponibles
  if(_selectedCity){
    const _dCode=_selectedCity.departement?.code||'';
    const _dData=DEPT_DATA[_dCode]||null;
    if(_selectedCity.population)row('Population commune',_selectedCity.population.toLocaleString('fr-FR')+' hab.');
    if(_dData){
      row('Taux de chômage (dept.)',_dData[0]+'%',_dData[0]<7?GREEN:_dData[0]<10?ORANGE:RED);
      row('Part étudiants (dept.)',_dData[1]+'%');
      row('Revenu médian (dept.)',e(_dData[2])+'/an');
      row('Prix moyen au m² (dept.)',e(_dData[3])+'/m²',BLUE);
      row('Tendance prix immo',(_dData[4]>0?'+':'')+_dData[4]+'%/an',_dData[4]>1?GREEN:_dData[4]>=0?ORANGE:RED);
    }
    if(_selectedCity._attrScore){
      const _as=_selectedCity._attrScore;
      row('Score attractivité ville',_as+'/100 — '+(_as>=75?'Excellent':_as>=60?'Attractif':_as>=45?'Correct':'Peu attractif'),_as>=70?GREEN:_as>=45?ORANGE:RED,true);
    }
  }
  if(tx('description')){
    checkY(10);
    doc.setTextColor(...INK3);doc.setFontSize(7);doc.setFont('helvetica','italic');
    const descL=doc.splitTextToSize('Notes : '+tx('description'),CW-6);
    doc.text(descL.slice(0,3),M+3,y);y+=descL.slice(0,3).length*5+4;
  }
  rowSeparator();

  sectionTitle('Coût d\'acquisition','02');
  rowToggle=false;
  if(r.negoPct>0){
    row('Prix affiché',e(r.prixAffiche));
    row('Negociation obtenue ('+r.negoPct+'%)', '- '+e(r.prixAffiche-r.pa),GREEN);
  }
  row('Prix d\'achat négocié',e(r.pa,0),GOLD,true);
  row('Frais de notaire ('+( tx('anciennete')==='neuf'?'3% neuf':'8,5% ancien')+')',e(r.notaire||getNotaire(),0));
  row('Frais d\'agence',e(r.fa,0));
  if(r.tr>0)row('Travaux',e(r.tr,0));
  if(r.am>0)row('Ameublement / Équipement',e(r.am,0));
  if(r.af>0)row('Autres frais',e(r.af,0));
  rowSeparator();
  row('COÛT TOTAL DU PROJET',e(r.coutTotal,0),GOLD,true);
  y+=4;

  sectionTitle('Plan de financement','03');
  rowToggle=false;
  row('Apport personnel',e(r.apport,0),BLUE);
  row('Montant emprunté',e(r.emp,0));
  row('Taux d\'intérêt annuel',p(r.tauxPret));
  row('Durée du prêt',r.dureePret+' ans');
  const assM=n0(vn('assurEmpr'))*(g('periodeAss').value==='a'?1/12:1);
  row('Assurance emprunteur',e(assM)+'/mois');
  row('Mensualité hors assurance',e(r.mensHAss));
  row('MENSUALITÉ TOTALE (crédit + assurance)',e(r.mensFin)+'/mois',BLUE,true);
  rowSeparator();
  const totalRembourse=r.mensFin*r.dureePret*12;
  const totalInterets=totalRembourse-r.emp;
  row('Coût total du crédit (capital + intérêts)',e(totalRembourse,0));
  row('Total des intérêts payés',e(totalInterets,0),RED);
  row('Taux d\'endettement (mensualité / mensualité loyer)',r.loyerM>0?p(r.mensFin/r.loyerM*100):'—',r.mensFin/Math.max(1,r.loyerM)<0.8?GREEN:RED);
  y+=4;

  // Ratio apport visuel
  checkY(22);
  const ratioAp=r.coutTotal>0?r.apport/r.coutTotal:0;
  doc.setFillColor(...CARD_BG);doc.roundedRect(M,y,CW,16,2,2,'F');
  doc.setTextColor(...INK2);doc.setFontSize(7);doc.setFont('helvetica','normal');
  doc.text('Apport',M+4,y+6);doc.text(p(ratioAp*100),M+4,y+12);
  doc.text('Emprunt',M+4+CW/2,y+6);doc.text(p((1-ratioAp)*100),M+4+CW/2,y+12);
  progressBar(M+35,y+4,CW-70,8,ratioAp,BLUE);
  y+=20;

  /* ════════════════════════════════════════
     PAGE 3 — EXPLOITATION LOCATIVE & CHARGES
  ════════════════════════════════════════ */
  addPage();
  sectionTitle('Revenus locatifs','04');
  rowToggle=false;
  if(!r.isCD){
    row('Loyer mensuel hors charges',e(r.loyerM));
    row('Loyer annuel brut',e(r.loyerAn,0));
    row('Taux de vacance locative',p(vn('vacance')));
    row('Taux d\'impayés provisionné',p(vn('impayes')));
    const revEffectif=r.loyerAn*(1-vn('vacance')/100-vn('impayes')/100);
    row('Revenus effectifs annuels (après vacance + impayés)',e(revEffectif,0),GREEN);
    row('Revalorisation annuelle du loyer (IRL)',p(r.irlTaux));
  } else {
    row('Type',r.isCD?'Courte durée (saisonnière)':'—');
    row('Prix nuitée',e(vn('prixNuit')));
    row('Taux d\'occupation',p(vn('occup')));
    row('Commission plateforme',p(vn('commPlat')));
    row('Frais ménage / séjour',e(vn('fraisMenage')));
    row('Séjours estimés / mois',vn('nbSejours')+'');
    row('Conciergerie',e(vn('concierge'))+'/mois');
    row('REVENU NET MENSUEL ESTIMÉ',e(r.loyerM)+'/mois',GREEN,true);
  }
  y+=4;

  sectionTitle('Détail des charges annuelles','05');
  rowToggle=false;
  const charges_detail=[
    {l:'Taxe foncière',v:vn('taxeFonc')},
    {l:'Assurance PNO (Propriétaire Non Occupant)',v:vn('assurPNO')},
    {l:'Charges de copropriété non récupérables',v:vn('chargesCopro')},
    {l:'Frais de gestion locative',v:vn('fraisGestion')},
    {l:'Entretien et réparations',v:vn('entretien')},
    {l:'Comptabilité / Expert-comptable',v:vn('compta')},
    {l:'Autres charges',v:vn('autresCharges')},
  ];
  charges_detail.forEach(c=>{if(c.v>0)row(c.l,e(c.v,0));});
  rowSeparator();
  row('TOTAL CHARGES ANNUELLES',e(r.charges,0),RED,true);
  row('Charges mensualisées',e(r.charges/12)+'/mois',RED);
  y+=4;

  sectionTitle('Résultats de rentabilité','06');
  rowToggle=false;
  const revNet=r.loyerAn*(1-(r.isCD?0:vn('vacance')/100+vn('impayes')/100));
  row('Revenu locatif annuel brut',e(r.loyerAn,0));
  row('Revenus nets après vacance/impayés',e(revNet,0));
  row('Revenus nets après charges',e(r.revNC,0));
  rowSeparator();
  row('Rentabilité brute',p(r.rentBrute),GOLD,true);
  row('Rentabilité nette (hors impôts)',p(r.rentNette),GOLD,true);
  y+=6;

  // Barre de rentabilité visuelle — indicateur propre sans triangle
  checkY(28);
  const rentAvis=r.rentBrute>=8?'Excellent':r.rentBrute>=6?'Bon':r.rentBrute>=4?'Correct':'Faible';
  const rentAvisColor=r.rentBrute>=8?GREEN:r.rentBrute>=6?GREEN:r.rentBrute>=4?ORANGE:RED;
  doc.setFillColor(...CARD_BG);doc.roundedRect(M,y,CW,24,2,2,'F');
  // Titre + valeur + avis sur la même ligne
  doc.setTextColor(...INK2);doc.setFontSize(7);doc.setFont('helvetica','normal');
  doc.text('Rentabilite brute :',M+4,y+8);
  doc.setTextColor(...GOLD);doc.setFontSize(9);doc.setFont('helvetica','bold');
  doc.text(p(r.rentBrute),M+46,y+8.5);
  doc.setTextColor(...rentAvisColor);doc.setFontSize(7.5);doc.setFont('helvetica','bold');
  doc.text('-> '+rentAvis,M+70,y+8.5);
  // Barre de progression avec étiquettes
  const targets_pdf=[4,5,6,7,8,10];
  const barW=(CW-8)/targets_pdf.length;
  targets_pdf.forEach((t,i)=>{
    const bx=M+4+i*barW;
    const isReached=r.rentBrute>=t;
    doc.setFillColor(...(isReached?GREEN:BAR_BG));
    doc.roundedRect(bx,y+12,barW-2,7,1,1,'F');
    doc.setTextColor(...INK3);doc.setFontSize(5.5);doc.setFont('helvetica','normal');
    doc.text(t+'%',bx+(barW-2)/2,y+21.5,{align:'center'});
  });
  // Curseur vertical sur la valeur réelle
  const cursorX=M+4+Math.min(Math.max(0,(r.rentBrute-4)/(10-4))*(CW-8),CW-10);
  doc.setFillColor(...GOLD);doc.roundedRect(cursorX-1,y+11,2,9,1,1,'F');
  y+=28;

  /* ════════════════════════════════════════
     PAGE 4 — CASH-FLOW DÉTAILLÉ
  ════════════════════════════════════════ */
  addPage();
  sectionTitle('Cash-flow mensuel détaillé','07');
  rowToggle=false;
  row('Loyer mensuel effectif',e(r.loyerM)+'/mois',GREEN);
  row('Mensualite de credit (capital + interets)',e(r.mensHAss)+'/mois',RED);
  row('Assurance emprunteur',e(assM)+'/mois',RED);
  row('Charges mensualises',e(r.charges/12)+'/mois',RED);
  rowSeparator();
  row('CASH-FLOW AVANT IMPOT',e(r.cfAvant)+'/mois',r.cfAvant>=0?GREEN:RED,true);
  row('Impôt mensuel estimé ('+(r.desc||'').split('—')[0].trim()+')',e(r.impot/12)+'/mois',RED);
  rowSeparator();
  row('CASH-FLOW APRÈS IMPÔT',e(r.cfApres)+'/mois',r.cfApres>=0?GREEN:RED,true);
  y+=5;

  // Bilan annuel
  sectionTitle('Bilan annuel','08');
  rowToggle=false;
  row('Loyer annuel encaissé',e(r.loyerAn,0),GREEN);
  row('Charges totales annuelles',e(r.charges,0),RED);
  row('Remboursement crédit annuel',e(r.mensFin*12,0),RED);
  row('Impôt estimé annuel',e(r.impot,0),RED);
  rowSeparator();
  row('RÉSULTAT NET ANNUEL',e((r.cfApres)*12,0),r.cfApres>=0?GREEN:RED,true);
  y+=5;

  // Tableau calendrier mensuel (loyer vs charges)
  sectionTitle('Calendrier des flux — 12 mois détaillé','09');
  const MOIS_PDF=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const ponctuel_pdf={0:vn('assurPNO'),9:vn('taxeFonc'),11:vn('compta'),3:200};
  tableHeader([
    {label:'Mois',x:M+3,align:'left'},
    {label:'Loyer encaissé',x:M+45,align:'right'},
    {label:'Crédit + Ass.',x:M+85,align:'right'},
    {label:'Charges fixes',x:M+120,align:'right'},
    {label:'Charges ponct.',x:M+152,align:'right'},
    {label:'Solde net',x:RR-2,align:'right'},
  ]);
  const chargesRecMens=(r.charges-vn('taxeFonc')-vn('assurPNO')-vn('compta'))/12;
  MOIS_PDF.forEach((mn,i)=>{
    const ponc=ponctuel_pdf[i]||0;
    const solde=r.loyerM-r.mensFin-chargesRecMens-ponc;
    tableRow([mn,e(r.loyerM),e(r.mensFin),e(chargesRecMens),ponc>0?e(ponc):'—',e(solde)],[
      {x:M+3,align:'left',color:INK2,bold:false},
      {x:M+45,align:'right',color:GREEN,bold:false},
      {x:M+85,align:'right',color:RED,bold:false},
      {x:M+120,align:'right',color:ORANGE,bold:false},
      {x:M+152,align:'right',color:ORANGE,bold:false},
      {x:RR-2,align:'right',color:solde>=0?GREEN:RED,bold:true},
    ]);
  });
  // Totaux annuels
  checkY(8);
  const totalPonc=Object.values(ponctuel_pdf).reduce((a,b)=>a+b,0);
  const totalSolde=r.loyerM*12-r.mensFin*12-r.charges;
  tableRow(['TOTAL ANNUEL',e(r.loyerM*12,0),e(r.mensFin*12,0),e(chargesRecMens*12,0),e(totalPonc,0),e(totalSolde,0)],[
    {x:M+3,align:'left',color:GOLD,bold:true},
    {x:M+45,align:'right',color:GREEN,bold:true},
    {x:M+85,align:'right',color:RED,bold:true},
    {x:M+120,align:'right',color:ORANGE,bold:true},
    {x:M+152,align:'right',color:ORANGE,bold:true},
    {x:RR-2,align:'right',color:totalSolde>=0?GREEN:RED,bold:true},
  ]);
  y+=4;

  /* ════════════════════════════════════════
     PAGE 5 — FISCALITÉ COMPARÉE
  ════════════════════════════════════════ */
  addPage();
  sectionTitle('Paramètres fiscaux du contribuable','10');
  rowToggle=false;
  row('Tranche marginale d\'imposition (TMI)',r.tmi+'%');
  row('Prélèvements sociaux',r.ps+'%');
  row('Taux global d\'imposition sur les revenus locatifs',(r.tmi+r.ps).toFixed(1)+'%',ORANGE);
  if(r.interets>0)row('Intérêts d\'emprunt déductibles',e(r.interets,0)+'/an');
  if(r.assurDed>0)row('Assurance emprunteur déductible',e(r.assurDed,0)+'/an');
  if(r.amort>0){
    row('Amortissement immeuble',e(vn('amortImm'),0)+'/an');
    row('Amortissement mobilier',e(vn('amortMob'),0)+'/an');
    row('Amortissement travaux',e(vn('amortTrav'),0)+'/an');
    row('TOTAL AMORTISSEMENTS',e(r.amort,0)+'/an',BLUE,true);
  }
  y+=5;

  sectionTitle('Comparatif de tous les régimes fiscaux','11');
  tableHeader([
    {label:'Régime fiscal',x:M+3,align:'left'},
    {label:'Rev. imposable/an',x:M+75,align:'right'},
    {label:'Impôt annuel',x:M+115,align:'right'},
    {label:'CF après impôt/mois',x:RR-2,align:'right'},
  ]);
  (r.allRes||[]).forEach(x=>{
    const isBest=r.bestReg&&x.r===r.bestReg.r;
    const isCurrent=x.r===r.regime;
    const label=((x.res.desc||'').split('—')[0].trim())+(isBest?' ★ OPTIMAL':'')+(isCurrent&&!isBest?' ← actuel':'');
    tableRow([label,e(x.res.revImp,0),e(x.res.impot,0),e(x.res.cfApres)+'/mois'],[
      {x:M+3,align:'left',color:isBest?GOLD:isCurrent?BLUE:INK2,bold:isBest},
      {x:M+75,align:'right',color:INK2,bold:false},
      {x:M+115,align:'right',color:RED,bold:false},
      {x:RR-2,align:'right',color:x.res.cfApres>=0?GREEN:RED,bold:isBest},
    ]);
  });
  y+=4;

  // Analyse du régime actuel
  sectionTitle('Analyse régime actuel : '+(r.desc||'—'),'12');
  rowToggle=false;
  row('Revenu locatif brut annuel',e(r.loyerAn,0));
  row('Revenu imposable annuel',e(r.revImp,0));
  row('Impôt estimé annuel',e(r.impot,0),RED);
  row('Impôt estimé mensuel',e(r.impot/12),RED);
  rowSeparator();
  row('CF avant impôt',e(r.cfAvant)+'/mois',r.cfAvant>=0?GREEN:RED,true);
  row('CF après impôt (RÉSULTAT FINAL)',e(r.cfApres)+'/mois',r.cfApres>=0?GREEN:RED,true);
  y+=5;

  // Alerte déficit foncier si applicable
  if(['reel-foncier','sci-ir'].includes(r.regime)){
    const base=r.loyerAn-r.charges-r.interets-(r.assurDed||0)-(r.autresDed||0);
    if(base<0){
      checkY(18);
      doc.setFillColor(...ORANGE_LIGHT);doc.roundedRect(M,y,CW,16,2,2,'F');
      doc.setDrawColor(...ORANGE);doc.setLineWidth(.25);doc.roundedRect(M,y,CW,16,2,2,'S');
      doc.setTextColor(...ORANGE);doc.setFontSize(7);doc.setFont('helvetica','bold');
      doc.text('DÉFICIT FONCIER DÉTECTÉ',M+4,y+6);
      doc.setTextColor(...ORANGE);doc.setFont('helvetica','normal');
      doc.text('Déficit : '+e(Math.abs(base),0)+'/an — Imputable sur revenu global à hauteur de 10 700 €/an maximum.',M+4,y+12);
      y+=20;
    }
  }

  /* ════════════════════════════════════════
     PAGE 6 — PROJECTIONS LONG TERME
  ════════════════════════════════════════ */
  addPage();
  sectionTitle('Hypothèses de projection long terme','13');
  rowToggle=false;
  row('Durée de projection',r.horizon+' ans');
  row('Revalorisation annuelle du bien',p(r.revalBien));
  row('Revalorisation annuelle du loyer (IRL)',p(r.irlTaux));
  row('Inflation annuelle des charges',p(r.inflCharges));
  row('Prix de revente estimé (an '+r.horizon+')',e(r.prixRevente||r.pa*Math.pow(1+r.revalBien/100,r.horizon)));
  y+=5;

  // Tableau amortissement crédit — TOUTES les années du prêt (max 30)
  const maxAmortYears=Math.min(r.dureePret,30);
  sectionTitle('Tableau d\'amortissement du crédit ('+maxAmortYears+' ans)','14');
  tableHeader([
    {label:'Année',x:M+3,align:'left'},
    {label:'Intérêts payés',x:M+42,align:'right'},
    {label:'Capital remboursé',x:M+83,align:'right'},
    {label:'Capital restant dû',x:M+124,align:'right'},
    {label:'CF net/mois',x:RR-2,align:'right'},
  ]);
  const tauxM_pdf=(r.tauxPret/100)/12;
  let cap_pdf=r.emp;
  for(let an=1;an<=maxAmortYears;an++){
    let iAn=0,cAn=0;
    for(let m=0;m<12;m++){const i=Math.max(0,cap_pdf)*tauxM_pdf;iAn+=i;cAn+=r.mensHAss-i;cap_pdf-=r.mensHAss-i}
    const loyer_an=r.loyerAn*Math.pow(1+r.irlTaux/100,an-1);
    const charges_an=r.charges*Math.pow(1+r.inflCharges/100,an-1);
    const cf_an=(loyer_an-charges_an)/12-r.mensFin;
    if(an>1&&(an-1)%5===0){checkY(2);doc.setDrawColor(...GOLD2);doc.setLineWidth(.15);doc.line(M,y-1,RR,y-1);}
    tableRow([
      'An '+an+' ('+(new Date().getFullYear()+an-1)+')',
      e(iAn,0),e(cAn,0),e(Math.max(0,cap_pdf),0),e(cf_an)
    ],[
      {x:M+3,align:'left',color:INK2},
      {x:M+42,align:'right',color:RED},
      {x:M+83,align:'right',color:GREEN},
      {x:M+124,align:'right',color:BLUE},
      {x:RR-2,align:'right',color:cf_an>=0?GREEN:RED,bold:true},
    ]);
  }
  y+=4;

  // ── STRESS LOYER 90/80/70% dans le PDF ──
  sectionTitle('Capacité de crédit — Impact loyer retenu','08B');
  rowToggle=false;
  // Explication
  checkY(10);
  doc.setTextColor(...INK3);doc.setFontSize(7);doc.setFont('helvetica','italic');
  doc.text('Simulation du cash-flow si la banque ne retient que 90%, 80% ou 70% du loyer lors d\'un nouveau dossier de credit.',M+3,y);
  y+=7;
  // En-tête 4 colonnes
  tableHeader([
    {label:'Scenario',x:M+3,align:'left'},
    {label:'Loyer retenu/mois',x:M+65,align:'right'},
    {label:'CF avant impot/mois',x:M+118,align:'right'},
    {label:'Situation',x:RR-2,align:'right'},
  ]);
  const stressScenarios=[
    {lbl:'Loyer 100% (référence)',pct:1.00},
    {lbl:'Loyer retenu à 90%',pct:0.90},
    {lbl:'Loyer retenu à 80%',pct:0.80},
    {lbl:'Loyer retenu à 70%',pct:0.70},
  ];
  stressScenarios.forEach(sc=>{
    const loyerR=r.loyerM*sc.pct;
    const cfS=loyerR-r.mensFin-r.charges/12;
    const sit=cfS>0?'Positif':cfS>-200?'Attention':'Negatif';
    const col=cfS>0?GREEN:cfS>-200?ORANGE:RED;
    const isBold=sc.pct===1.00;
    tableRow([sc.lbl,e(loyerR)+'/mois',e(cfS)+'/mois',sit],[
      {x:M+3,align:'left',color:INK2,bold:isBold},
      {x:M+65,align:'right',color:BLUE,bold:false},
      {x:M+118,align:'right',color:col,bold:true},
      {x:RR-2,align:'right',color:col,bold:true},
    ]);
  });
  y+=4;

  // ════════════════════════════════════════
  // 08C — TAUX D'ENDETTEMENT BANCAIRE : HCSF vs DIFFÉRENTIEL
  // ════════════════════════════════════════
  sectionTitle('Taux d\'endettement bancaire — HCSF vs Différentiel','08C');
  rowToggle=false;
  {
    // ── Lecture des saisies utilisateur ──
    const _v=id=>parseFloat((document.getElementById(id)||{}).value)||0;
    const _decote=()=>{
      const radios=document.getElementsByName('simEnd_decote');
      for(let i=0;i<radios.length;i++){if(radios[i].checked)return parseFloat(radios[i].value)/100;}
      return 0.70;
    };
    const _sal     = _v('revenusMenage');
    const _creds   = _v('autresCredits');
    const _newMens = r.mensFin;                 // mensualité calculée par la simu (avec assurance)
    const _loyer   = r.loyerM;                  // loyer mensuel HC
    const _primes  = _v('simEnd_primes');
    const _autres  = _v('simEnd_autres');
    const _decotePct = _decote();
    const _decoteShow = Math.round(_decotePct*100);

    if(_sal<=0 || _newMens<=0 || _loyer<=0){
      // Pas assez de données : message explicatif
      doc.setTextColor(...INK3);doc.setFontSize(7.5);doc.setFont('helvetica','italic');
      const _msg=doc.splitTextToSize('Données insuffisantes pour le calcul d\'endettement. Renseignez vos revenus nets mensuels dans le simulateur (section "Revenus du ménage") pour générer cette analyse comparative HCSF vs Différentiel.',CW-6);
      doc.text(_msg,M+3,y);
      y+=_msg.length*4+4;
    } else {
      // ── Calculs des 2 méthodes ──
      const _revPrimes = (_primes/12)*0.70;
      const _revAutres = _autres*0.70;
      const _revTotal  = _sal + _revPrimes + _revAutres;
      const _loyerNet  = _loyer * _decotePct;
      const _revHCSF   = _revTotal + _loyerNet;
      const _chargesHCSF = _creds + _newMens;
      const _tauxHCSF  = _revHCSF>0 ? (_chargesHCSF/_revHCSF)*100 : 0;
      const _diff      = Math.max(0, _newMens - _loyerNet);
      const _chargesDiff = _creds + _diff;
      const _tauxDiff  = _revTotal>0 ? (_chargesDiff/_revTotal)*100 : 0;

      const _statusFor=t=>{
        if(t<=33) return {c:GREEN, bg:GREEN_LIGHT, lbl:'Excellent'};
        if(t<=35) return {c:GREEN, bg:GREEN_LIGHT, lbl:'Conforme HCSF'};
        if(t<=39) return {c:ORANGE,bg:ORANGE_LIGHT,lbl:'Limite haute'};
        return         {c:RED,   bg:RED_LIGHT,   lbl:'Hors normes'};
      };
      const _sH = _statusFor(_tauxHCSF);
      const _sD = _statusFor(_tauxDiff);

      // ── Intro ──
      checkY(8);
      doc.setTextColor(...INK3);doc.setFontSize(7);doc.setFont('helvetica','italic');
      doc.text('Comparaison des 2 méthodes utilisées par les banques. HCSF : obligatoire depuis jan. 2022. Différentielle : dérogatoire (<4% des dossiers).',M+3,y);
      y+=6;

      // ── Bandeau décote ──
      checkY(11);
      doc.setFillColor(...GOLD_LIGHT);doc.roundedRect(M,y,CW,9,1.5,1.5,'F');
      doc.setDrawColor(...GOLD2);doc.setLineWidth(.25);doc.roundedRect(M,y,CW,9,1.5,1.5,'S');
      doc.setTextColor(...GOLD2);doc.setFontSize(7.5);doc.setFont('helvetica','bold');
      doc.text('Décote bancaire appliquée : '+(100-_decoteShow)+'%',M+4,y+5.5);
      doc.setTextColor(...INK2);doc.setFont('helvetica','normal');
      doc.text('→ Loyer retenu : '+_decoteShow+'% × '+e(_loyer)+' = '+e(_loyerNet)+'/mois',M+78,y+5.5);
      y+=12;

      // ── 3 KPIs synthèse ──
      checkY(20);
      const _kw = (CW-6)/3;
      const _kh = 16;
      kpiBlock({val:e(_revTotal)+'/mois',label:'Revenus retenus',color:INK2,valSize:9}, M, y, _kw, _kh);
      kpiBlock({val:e(_creds)+'/mois',label:'Charges actuelles',color:INK2,valSize:9}, M+_kw+3, y, _kw, _kh);
      kpiBlock({val:e(_loyerNet)+'/mois',label:'Loyer net retenu ('+_decoteShow+'%)',color:GOLD,valSize:9}, M+(_kw+3)*2, y, _kw, _kh);
      y+=_kh+5;

      // ── 2 grandes cartes méthodes ──
      checkY(36);
      const _cw = (CW-4)/2;
      const _ch = 30;

      function _drawMethodCard(_x, _title, _sub, _taux, _status, _line1, _line2){
        doc.setFillColor(..._status.bg);doc.roundedRect(_x,y,_cw,_ch,2,2,'F');
        doc.setDrawColor(..._status.c);doc.setLineWidth(.4);doc.roundedRect(_x,y,_cw,_ch,2,2,'S');
        // Titre + sous-titre
        doc.setTextColor(..._status.c);doc.setFontSize(7);doc.setFont('helvetica','bold');
        doc.text(_title,_x+3,y+5);
        doc.setFontSize(5.5);doc.setFont('helvetica','normal');
        doc.text(_sub,_x+3,y+8.5);
        // Taux %
        doc.setTextColor(..._status.c);doc.setFontSize(17);doc.setFont('helvetica','bold');
        doc.text(_taux.toFixed(1)+' %',_x+3,y+18);
        doc.setFontSize(7);
        doc.text(_status.lbl,_x+3,y+22.5);
        // Mini jauge
        const _gY=y+25;const _gW=_cw-6;
        progressBar(_x+3,_gY,_gW,1.6,Math.min(_taux/50,1),_status.c);
        doc.setDrawColor(...INK3);doc.setLineWidth(.15);
        doc.line(_x+3+_gW*(35/50),_gY-0.5,_x+3+_gW*(35/50),_gY+2.1);
        doc.setDrawColor(...RED);
        doc.line(_x+3+_gW*(39/50),_gY-0.5,_x+3+_gW*(39/50),_gY+2.1);
        doc.setTextColor(...INK3);doc.setFontSize(5);doc.setFont('helvetica','normal');
        doc.text('0%',_x+3,y+_ch-1);
        doc.text('35%',_x+3+_gW*(35/50),y+_ch-1,{align:'center'});
        doc.setTextColor(...RED);
        doc.text('39%',_x+3+_gW*(39/50),y+_ch-1,{align:'center'});
        doc.setTextColor(...INK3);
        doc.text('50%',_x+3+_gW,y+_ch-1,{align:'right'});
      }

      _drawMethodCard(M, 'METHODE HCSF', 'Obligatoire depuis jan. 2022', _tauxHCSF, _sH);
      _drawMethodCard(M+_cw+4, 'METHODE DIFFERENTIELLE', 'Derogatoire — <4% des dossiers', _tauxDiff, _sD);
      y+=_ch+5;

      // ── Tableau détaillé ──
      checkY(8);
      doc.setTextColor(...INK3);doc.setFontSize(6.5);doc.setFont('helvetica','italic');
      doc.text('Détail du calcul ligne par ligne — formules : HCSF = (charges + mensualité) / (revenus + loyer net) | Différentiel = (charges + max(0, mens. − loyer net)) / revenus',M+3,y);
      y+=4;

      tableHeader([
        {label:'Poste',x:M+3,align:'left'},
        {label:'Méthode HCSF',x:M+115,align:'right'},
        {label:'Méthode Différentielle',x:RR-2,align:'right'},
      ]);

      // Lignes revenus
      tableRow(['Salaires nets', e(_sal), e(_sal)],[
        {x:M+3,align:'left',color:INK2},
        {x:M+115,align:'right',color:INK2},
        {x:RR-2,align:'right',color:INK2},
      ]);
      if(_primes>0){
        tableRow(['Primes / variable (×70% / 12)', e(_revPrimes), e(_revPrimes)],[
          {x:M+3,align:'left',color:INK2},
          {x:M+115,align:'right',color:INK2},
          {x:RR-2,align:'right',color:INK2},
        ]);
      }
      if(_autres>0){
        tableRow(['Autres revenus stables (×70%)', e(_revAutres), e(_revAutres)],[
          {x:M+3,align:'left',color:INK2},
          {x:M+115,align:'right',color:INK2},
          {x:RR-2,align:'right',color:INK2},
        ]);
      }
      tableRow(['→ Revenus de base retenus', e(_revTotal), e(_revTotal)],[
        {x:M+3,align:'left',color:INK,bold:true},
        {x:M+115,align:'right',color:INK,bold:true},
        {x:RR-2,align:'right',color:INK,bold:true},
      ]);
      tableRow(['Loyer net retenu (×'+_decoteShow+'%)', '+ '+e(_loyerNet)+' (ajouté)', e(_diff)+' (différentiel)'],[
        {x:M+3,align:'left',color:INK2},
        {x:M+115,align:'right',color:GREEN},
        {x:RR-2,align:'right',color:BLUE},
      ]);
      tableRow(['→ REVENUS POUR CALCUL', e(_revHCSF), e(_revTotal)],[
        {x:M+3,align:'left',color:GOLD,bold:true},
        {x:M+115,align:'right',color:GOLD,bold:true},
        {x:RR-2,align:'right',color:GOLD,bold:true},
      ]);

      // Section CHARGES
      checkY(6);
      doc.setFillColor(...TH_BG);doc.rect(M,y-1,CW,5,'F');
      doc.setTextColor(...GOLD);doc.setFontSize(6.5);doc.setFont('helvetica','bold');
      doc.text('CHARGES',M+3,y+2.5);
      y+=5;
      rowToggle=false;

      tableRow(['Crédits en cours', e(_creds), e(_creds)],[
        {x:M+3,align:'left',color:INK2},
        {x:M+115,align:'right',color:RED},
        {x:RR-2,align:'right',color:RED},
      ]);
      tableRow(['Nouvelle mensualité (projet, assurance incluse)', e(_newMens), e(_newMens)],[
        {x:M+3,align:'left',color:INK2},
        {x:M+115,align:'right',color:RED},
        {x:RR-2,align:'right',color:RED},
      ]);
      tableRow(['Compensation loyer (méthode différentielle)', '—', '− '+e(Math.min(_loyerNet,_newMens))],[
        {x:M+3,align:'left',color:INK2},
        {x:M+115,align:'right',color:INK3},
        {x:RR-2,align:'right',color:GREEN},
      ]);
      tableRow(['→ TOTAL CHARGES RETENUES', e(_chargesHCSF), e(_chargesDiff)],[
        {x:M+3,align:'left',color:GOLD,bold:true},
        {x:M+115,align:'right',color:RED,bold:true},
        {x:RR-2,align:'right',color:RED,bold:true},
      ]);

      // Ligne finale TAUX D'ENDETTEMENT — encart doré
      checkY(10);
      doc.setFillColor(...GOLD_LIGHT);doc.roundedRect(M,y-1,CW,9,1.5,1.5,'F');
      doc.setDrawColor(...GOLD2);doc.setLineWidth(.4);doc.roundedRect(M,y-1,CW,9,1.5,1.5,'S');
      doc.setTextColor(...INK);doc.setFontSize(8.5);doc.setFont('helvetica','bold');
      doc.text('TAUX D\'ENDETTEMENT',M+4,y+4.5);
      doc.setTextColor(..._sH.c);doc.setFontSize(11);
      doc.text(_tauxHCSF.toFixed(1)+' %',M+115,y+4.5,{align:'right'});
      doc.setTextColor(..._sD.c);
      doc.text(_tauxDiff.toFixed(1)+' %',RR-2,y+4.5,{align:'right'});
      y+=12;

      // ── Verdict ──
      const _ok  = _tauxHCSF<=35;
      const _aok = _tauxHCSF<=39;
      let _vTitle, _vBody, _vColor, _vFill;
      if(_ok){
        _vTitle='✓ Dossier conforme HCSF (≤ 35%)';
        _vBody='Le taux d\'endettement HCSF est conforme à la règle des 35%. La méthode différentielle donne '+_tauxDiff.toFixed(1)+' % — favorable aux investisseurs expérimentés en cas de dérogation bancaire.';
        _vColor=GREEN;_vFill=GREEN_LIGHT;
      } else if(_aok){
        _vTitle='⚠ Dossier limite — entre 35% et 39%';
        _vBody='Le taux dépasse 35% (règle HCSF). Une dérogation bancaire est nécessaire (accordée dans <4% des dossiers, profils solides uniquement). La méthode différentielle donne '+_tauxDiff.toFixed(1)+' %.';
        _vColor=ORANGE;_vFill=ORANGE_LIGHT;
      } else {
        _vTitle='✗ Taux hors normes — refus bancaire probable';
        _vBody='Au-delà de 39%, la plupart des banques refuseront le financement. Solutions : augmenter l\'apport, réduire le capital emprunté, allonger la durée du prêt ou augmenter les revenus. Méthode différentielle : '+_tauxDiff.toFixed(1)+' %.';
        _vColor=RED;_vFill=RED_LIGHT;
      }
      pdfCallout(_vTitle,_vBody,_vColor,_vFill);

      // ── Écart entre les méthodes ──
      const _ecart = Math.abs(_tauxHCSF-_tauxDiff).toFixed(1);
      const _ecartTxt = 'Écart entre les 2 méthodes : '+_ecart+' %' + (_tauxDiff<_tauxHCSF ? ' — la méthode différentielle vous est favorable.' : ' — les 2 méthodes donnent un résultat similaire.');
      doc.setTextColor(...INK3);doc.setFontSize(6.5);doc.setFont('helvetica','italic');
      doc.text('• '+_ecartTxt,M+3,y);
      y+=4;
      doc.text('• Mensualité utilisée : '+e(_newMens)+'/mois (avec assurance) — Loyer brut : '+e(_loyer)+'/mois — Décote : '+(100-_decoteShow)+'%',M+3,y);
      y+=6;
    }
  }

  /* ════════════════════════════════════════
     PAGE BONUS — PROJECTION DÉTAILLÉE AN PAR AN
  ════════════════════════════════════════ */
  addPage();
  sectionTitle('Projection détaillée — flux annuels sur '+r.horizon+' ans','16B');
  tableHeader([
    {label:'Année',x:M+3,align:'left'},
    {label:'Loyer annuel',x:M+42,align:'right'},
    {label:'Charges ann.',x:M+82,align:'right'},
    {label:'Mensualités',x:M+118,align:'right'},
    {label:'CF annuel',x:M+148,align:'right'},
    {label:'CF/mois',x:RR-2,align:'right'},
  ]);
  {
    let cap3=r.emp;
    for(let an=1;an<=r.horizon;an++){
      const loyer3=r.loyerAn*Math.pow(1+r.irlTaux/100,an-1);
      const charges3=r.charges*Math.pow(1+r.inflCharges/100,an-1);
      const mens3=an<=r.dureePret?r.mensFin*12:0;
      const cfAn3=loyer3-charges3-r.impot-mens3;
      const cfMois3=cfAn3/12;
      if(an>1&&(an-1)%5===0){checkY(2);doc.setDrawColor(...GOLD2);doc.setLineWidth(.15);doc.line(M,y-1,RR,y-1);}
      tableRow([
        'An '+an+' ('+(new Date().getFullYear()+an-1)+')',
        e(loyer3,0),e(charges3,0),e(mens3,0),e(cfAn3,0),e(cfMois3)
      ],[
        {x:M+3,align:'left',color:INK2},
        {x:M+42,align:'right',color:GREEN},
        {x:M+82,align:'right',color:RED},
        {x:M+118,align:'right',color:BLUE},
        {x:M+148,align:'right',color:cfAn3>=0?GREEN:RED,bold:false},
        {x:RR-2,align:'right',color:cfMois3>=0?GREEN:RED,bold:true},
      ]);
    }
  }
  y+=4;

  /* ════════════════════════════════════════
     PAGE 7 — SIMULATION REVENTE & PATRIMOINE
  ════════════════════════════════════════ */
  addPage();

  // Calcul projection patrimoine complet
  let cap2=r.emp;let cumCF2=0;let totalInt2=0;
  const proj=[];
  for(let an=1;an<=r.horizon;an++){
    let iAn=0;
    if(an<=r.dureePret){for(let m=0;m<12;m++){const i=Math.max(0,cap2)*tauxM_pdf;iAn+=i;cap2-=r.mensHAss-i}}
    totalInt2+=iAn;
    const loyer_p=r.loyerAn*Math.pow(1+r.irlTaux/100,an-1);
    const charges_p=r.charges*Math.pow(1+r.inflCharges/100,an-1);
    const mens_p=an<=r.dureePret?r.mensFin*12:0;
    const cfAn=loyer_p-charges_p-mens_p;
    cumCF2+=cfAn;
    const valBien=r.pa*Math.pow(1+r.revalBien/100,an);
    const capR=Math.max(0,cap2);
    proj.push({an,iAn,cfAn,cumCF:cumCF2,valBien,capR,patriNet:valBien-capR+cumCF2});
  }
  const dernier=proj[proj.length-1];

  sectionTitle('Projection patrimoniale sur '+r.horizon+' ans','15');
  rowToggle=false;
  row('Valeur estimée du bien (an '+r.horizon+')',e(dernier.valBien,0),GOLD);
  row('Capital restant dû (fin de prêt)',e(dernier.capR,0),r.dureePret<=r.horizon?GREEN:RED);
  row('Cash-flow cumulé sur la période',e(dernier.cumCF,0),dernier.cumCF>=0?GREEN:RED);
  rowSeparator();
  row('PATRIMOINE NET ESTIMÉ (an '+r.horizon+')',e(dernier.patriNet,0),GOLD,true);
  row('Plus-value latente brute',e(dernier.valBien-r.pa,0),GOLD);
  row('Total intérêts payés',e(totalInt2,0),RED);
  y+=5;

  // Tableau projection synthétique (tous les 5 ans)
  sectionTitle('Évolution du patrimoine (jalons clés)','16');
  tableHeader([
    {label:'Horizon',x:M+3,align:'left'},
    {label:'Valeur bien',x:M+50,align:'right'},
    {label:'Cap. restant',x:M+90,align:'right'},
    {label:'CF cumulé',x:M+130,align:'right'},
    {label:'Patrimoine net',x:RR-2,align:'right'},
  ]);
  const jalons=[1,3,5,10,15,20].filter(j=>j<=r.horizon);
  jalons.forEach(j=>{
    const p_j=proj[j-1];if(!p_j)return;
    tableRow(['An '+p_j.an,e(p_j.valBien,0),e(p_j.capR,0),e(p_j.cumCF,0),e(p_j.patriNet,0)],[
      {x:M+3,align:'left',color:INK2},
      {x:M+50,align:'right',color:GOLD},
      {x:M+90,align:'right',color:BLUE},
      {x:M+130,align:'right',color:p_j.cumCF>=0?GREEN:RED},
      {x:RR-2,align:'right',color:GOLD,bold:true},
    ]);
  });
  y+=5;

  // Simulation de revente
  sectionTitle('Simulation de revente (an '+r.horizon+')','17');
  rowToggle=false;
  const prixRev_pdf=r.prixRevente||r.pa*Math.pow(1+r.revalBien/100,r.horizon);
  const pv_pdf=prixRev_pdf-r.pa;
  let abatt_pdf=r.horizon>=30?1:r.horizon>=6?Math.min(1,(r.horizon-5)*0.06):0;
  const pvImp_pdf=Math.max(0,pv_pdf*(1-abatt_pdf));
  const impotPV_pdf=pvImp_pdf*(0.19+0.172);
  const fraisVente=prixRev_pdf*0.06;
  const gainNet_pdf=pv_pdf-impotPV_pdf-fraisVente+dernier.cumCF;
  row('Prix d\'achat initial',e(r.pa,0));
  row('Prix de revente estimé (an '+r.horizon+')',e(prixRev_pdf,0));
  row('Plus-value brute',e(pv_pdf,0),pv_pdf>=0?GREEN:RED);
  row('Abattement pour durée de détention',p(abatt_pdf*100)+(r.horizon>=30?' (exonération totale)':''));
  row('Plus-value imposable',e(pvImp_pdf,0));
  row('Impôt sur la plus-value (19% + 17,2%)',e(impotPV_pdf,0),RED);
  row('Frais de vente estimés (6%)',e(fraisVente,0),RED);
  row('Cash-flow cumulé sur la période',e(dernier.cumCF,0),dernier.cumCF>=0?GREEN:RED);
  rowSeparator();
  row('GAIN NET TOTAL DE L\'OPÉRATION',e(gainNet_pdf,0),gainNet_pdf>=0?GREEN:RED,true);
  y+=5;

  // Effet de levier
  sectionTitle('Analyse de l\'effet de levier','18');
  rowToggle=false;
  const cfComptant=(r.loyerAn-r.charges)/12;
  const rendComptant=r.coutTotal>0?(r.loyerAn-r.charges)/r.coutTotal*100:0;
  const rendCredit=r.apport>0?(r.cfAvant*12/r.apport)*100:0;
  row('Rendement comptant (sur coût total)',p(rendComptant));
  row('CF mensuel si achat comptant',e(cfComptant));
  rowSeparator();
  row('Rendement à crédit (sur apport)',p(rendCredit),rendCredit>rendComptant?GREEN:ORANGE);
  row('CF mensuel à crédit',e(r.cfAvant));
  row('Liquidités préservées par l\'effet levier',e(r.coutTotal-r.apport,0),BLUE);
  row('Conclusion',rendCredit>rendComptant?'Effet de levier POSITIF (crédit > comptant)':'Effet de levier NÉGATIF (comptant préférable)',rendCredit>rendComptant?GREEN:ORANGE,true);

  /* ════════════════════════════════════════
     PAGE GRAPHIQUES — COURBES CHART.JS
  ════════════════════════════════════════ */
  addPage();
  sectionTitle('Graphiques — Evolution patrimoniale','GR');
  checkY(10);
  // Capturer chartPat (courbe patrimoine)
  try{
    const chartPatEl=g('chartPat');
    if(chartPatEl&&chartRefs['chartPat']){
      const imgPat=chartRefs['chartPat'].toBase64Image('image/png',1.0);
      const chartH=70;
      doc.addImage(imgPat,'PNG',M,y,CW,chartH);
      doc.setTextColor(...INK3);doc.setFontSize(6.5);doc.setFont('helvetica','normal');
      doc.text('Patrimoine net et plus-value latente sur '+r.horizon+' ans',M,y+chartH+4);
      y+=chartH+10;
    }
  }catch(e){console.warn('Chart patrimoine non disponible pour PDF',e);}
  // Capturer chartCF (barres cash-flow)
  checkY(75);
  try{
    const chartCFEl=g('chartCF');
    if(chartCFEl&&chartRefs['chartCF']){
      const imgCF=chartRefs['chartCF'].toBase64Image('image/png',1.0);
      const chartH=65;
      doc.addImage(imgCF,'PNG',M,y,CW,chartH);
      doc.setTextColor(...INK3);doc.setFontSize(6.5);doc.setFont('helvetica','normal');
      doc.text('Cash-flow mensuel et loyer sur '+r.horizon+' ans',M,y+chartH+4);
      y+=chartH+10;
    }
  }catch(e){console.warn('Chart cash-flow non disponible pour PDF',e);}

  /* ════════════════════════════════════════
     PAGE DECISION — ACTION PLAN INVESTISSEUR
  ════════════════════════════════════════ */
  addPage();
  sectionTitle('Décision investisseur — action plan','AP');
  const debtRatioPdf=vn('revenusMenage')>0?((r.mensFin+vn('autresCredits'))/vn('revenusMenage'))*100:null;
  const dpeRisk=['F','G'].includes(r.dpe);
  const cfStress70=(r.loyerM*.70)-r.mensFin-r.charges/12;
  const decision=r.score>=70&&r.cfApres>=0&&!dpeRisk?'GO sous réserve de vérifications terrain':r.score>=45?'À négocier / sécuriser avant offre':'À écarter sauf forte décote ou stratégie travaux';
  pdfCallout('Décision proposée',decision+' — Cette recommandation automatique se base sur le score, le cash-flow, le DPE, l’effet de levier et la résistance du dossier à un loyer bancaire retenu à 70%.',r.score>=70?GREEN:(r.score>=45?ORANGE:RED),r.score>=70?GREEN_LIGHT:(r.score>=45?ORANGE_LIGHT:RED_LIGHT));
  sectionTitle('Points forts et alertes','PF');
  const strengths=[];
  const alerts=[];
  if(r.cfApres>=0)strengths.push('Cash-flow après impôt positif : '+e(r.cfApres)+'/mois.'); else alerts.push('Cash-flow après impôt négatif : '+e(r.cfApres)+'/mois.');
  if(r.rentBrute>=7)strengths.push('Rentabilité brute attractive : '+p(r.rentBrute)+'.'); else alerts.push('Rentabilité brute à challenger : '+p(r.rentBrute)+'.');
  if(r.rentNette>=5)strengths.push('Rentabilité nette correcte : '+p(r.rentNette)+'.'); else alerts.push('Rentabilité nette limitée après charges : '+p(r.rentNette)+'.');
  if(r.bestReg&&r.bestReg.res&&r.bestReg.res.cfApres>r.cfApres+20)alerts.push('Optimisation fiscale possible : le régime optimal améliore le cash-flow.'); else strengths.push('Régime fiscal actuel proche de l’optimum calculé.');
  if(dpeRisk)alerts.push('DPE '+r.dpe+' : risque réglementaire et travaux à anticiper.'); else if(r.dpe)strengths.push('DPE '+r.dpe+' : risque énergétique modéré selon les données saisies.');
  if(debtRatioPdf!==null){ if(debtRatioPdf<=35)strengths.push('Taux d’endettement indicatif sous 35% : '+p(debtRatioPdf,1)+'.'); else alerts.push('Taux d’endettement indicatif au-dessus de 35% : '+p(debtRatioPdf,1)+'.'); }
  if(cfStress70>=0)strengths.push('Stress bancaire 70% du loyer encore positif : '+e(cfStress70)+'/mois.'); else alerts.push('Stress bancaire 70% du loyer négatif : '+e(cfStress70)+'/mois.');
  doc.setTextColor(...GREEN);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text('Points forts',M,y);y+=5;
  (strengths.length?strengths:['Aucun point fort automatique détecté avec les données saisies.']).slice(0,6).forEach(s=>{checkY(6);doc.setTextColor(...GREEN);doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text('✓ '+s,M+3,y);y+=5;});
  y+=3;
  doc.setTextColor(...RED);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text('Alertes à traiter',M,y);y+=5;
  (alerts.length?alerts:['Aucune alerte majeure automatique détectée.']).slice(0,6).forEach(s=>{checkY(6);doc.setTextColor(...RED);doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text('• '+s,M+3,y);y+=5;});
  y+=5;
  sectionTitle('Checklist avant offre','CL');
  pdfChecklist([
    {label:'Vérifier les loyers comparables',value:'À faire',warn:true,note:'Comparer 5 à 10 annonces louées similaires dans le même secteur.'},
    {label:'Confirmer charges et taxe foncière',value:'À faire',warn:true,note:'Demander les 3 derniers PV d’AG, appels de charges, taxe foncière et sinistres.'},
    {label:'Chiffrer travaux / DPE',value:dpeRisk?'Prioritaire':'Recommandé',warn:true,note:'Obtenir devis écrits, surtout si DPE E/F/G ou rénovation lourde.'},
    {label:'Contrôler financement banque',value:debtRatioPdf===null?'À simuler':p(debtRatioPdf,1),ok:debtRatioPdf!==null&&debtRatioPdf<=35,warn:debtRatioPdf===null||debtRatioPdf<=40,note:'Vérifier assurance, différé, apport, frais annexes et loyer retenu banque.'},
    {label:'Préparer offre négociée',value:r.negoPct?p(r.negoPct,1):'0%',warn:r.negoPct<5,note:'Argumenter avec travaux, DPE, vacance, prix/m² et comparables DVF.'}
  ]);
  y+=5;
  sectionTitle('Arguments de négociation','NG');
  const negoArgs=[];
  if(r.tr>0)negoArgs.push('Travaux saisis : '+e(r.tr,0)+' — demander une décote ou devis opposables.');
  if(dpeRisk)negoArgs.push('DPE '+r.dpe+' — coût de rénovation énergétique et risque locatif à valoriser.');
  if(r.cfApres<0)negoArgs.push('Cash-flow négatif au prix actuel — viser un prix permettant au moins l’équilibre.');
  if(r.rentBrute<6)negoArgs.push('Rentabilité brute sous 6% — prix d’achat à revoir ou loyer à sécuriser.');
  if(!negoArgs.length)negoArgs.push('Dossier solide : négociation possible sur délais, mobilier, frais ou petites réparations plutôt que forte décote.');
  negoArgs.forEach(a=>{checkY(6);doc.setTextColor(...INK2);doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text('• '+a,M+3,y);y+=5;});

  /* ════════════════════════════════════════
     PAGE 8 — SCORE DE RISQUE & SYNTHÈSE FINALE
  ════════════════════════════════════════ */
  addPage();
  sectionTitle('Analyse du risque et score d\'investissement','19');

  // Score visuel étendu
  checkY(32);
  doc.setFillColor(...CARD_BG);doc.roundedRect(M,y,CW,28,3,3,'F');
  doc.setDrawColor(...scC);doc.setLineWidth(.4);doc.roundedRect(M,y,CW,28,3,3,'S');
  // Score chiffre
  doc.setTextColor(...scC);doc.setFontSize(22);doc.setFont('helvetica','bold');
  doc.text(Math.round(r.score)+'',M+18,y+17,{align:'center'});
  doc.setFontSize(7);doc.text('/100',M+18,y+23,{align:'center'});
  // Libellé
  doc.setTextColor(...INK);doc.setFontSize(11);doc.setFont('helvetica','bold');
  doc.text(scLbl.toUpperCase(),M+30,y+14);
  doc.setTextColor(...INK2);doc.setFontSize(7.5);doc.setFont('helvetica','normal');
  const scDesc=r.score>=70?'Paramètres excellents — investissement solide.':r.score>=60?'Bons paramètres — quelques points à surveiller.':r.score>=45?'Paramètres moyens — risques à évaluer soigneusement.':'Paramètres insuffisants — revoir la stratégie.';
  doc.text(scDesc,M+30,y+21);
  // Barre score
  progressBar(M+30,y+24,CW-35,4,r.score/100,scC);
  y+=34;

  // Critères détaillés
  const criteria=[
    {l:'Rentabilité brute',v:p(r.rentBrute),pts:r.rentBrute>=8?25:r.rentBrute>=6?17:r.rentBrute>=4?8:2,max:25,ok:r.rentBrute>=6,w:r.rentBrute>=4},
    {l:'Cash-flow avant impôt',v:e(r.cfAvant)+'/mois',pts:r.cfAvant>200?20:r.cfAvant>0?12:r.cfAvant>-200?4:0,max:20,ok:r.cfAvant>0,w:r.cfAvant>-200},
    {l:'DPE',v:r.dpe?'Classe '+r.dpe:'—',pts:({A:15,B:13,C:10,D:7,E:4,F:1,G:0}[r.dpe]||5),max:15,ok:['A','B','C'].includes(r.dpe),w:r.dpe==='D'},
    {l:'Vacance locative',v:p(vn('vacance')),pts:vn('vacance')<=3?12:vn('vacance')<=7?8:vn('vacance')<=12?4:0,max:12,ok:vn('vacance')<=5,w:vn('vacance')<=10},
    {l:'Ratio mensualité / loyer',v:r.loyerM>0?p(r.mensFin/r.loyerM*100):'—',pts:r.mensFin/Math.max(1,r.loyerM)<0.6?13:r.mensFin/Math.max(1,r.loyerM)<0.8?8:r.mensFin/Math.max(1,r.loyerM)<1?4:0,max:13,ok:r.mensFin/Math.max(1,r.loyerM)<0.7,w:r.mensFin/Math.max(1,r.loyerM)<0.85},
  ];
  if(_selectedCity&&_selectedCity._attrScore){
    const _as=_selectedCity._attrScore;
    const _aPts=_as>=75?15:_as>=60?10:_as>=45?5:1;
    criteria.push({l:'Attractivité ville',v:_as+'/100',pts:_aPts,max:15,ok:_as>=60,w:_as>=45});
  }
  tableHeader([
    {label:'Critère',x:M+3,align:'left'},
    {label:'Valeur',x:M+80,align:'right'},
    {label:'Points',x:M+115,align:'right'},
    {label:'Évaluation',x:RR-2,align:'right'},
  ]);
  criteria.forEach(c=>{
    tableRow([c.l,c.v,c.pts+' / '+c.max,c.ok?'[OK] Bon':c.w?'[!] Moyen':'[X] Risque'],[
      {x:M+3,align:'left',color:INK2},
      {x:M+80,align:'right',color:GOLD},
      {x:M+115,align:'right',color:BLUE},
      {x:RR-2,align:'right',color:c.ok?GREEN:c.w?ORANGE:RED,bold:true},
    ]);
  });
  y+=5;

  // Synthèse finale
  sectionTitle('Synthèse exécutive','20');
  checkY(50);
  const synth=[
    ['Bien',r.typeBien&&r.ville?(r.typeBien+' — '+r.ville):'—'],
    ['Coût total du projet',e(r.coutTotal,0)],
    ['Apport personnel',e(r.apport,0)+' ('+p(r.apport/r.coutTotal*100)+' du coût)'],
    ['Mensualité',e(r.mensFin)+'/mois'],
    ['Loyer mensuel',e(r.loyerM)+'/mois'],
    ['Rentabilité brute',p(r.rentBrute)],
    ['Rentabilité nette',p(r.rentNette)],
    ['Cash-flow avant impôt',e(r.cfAvant)+'/mois'],
    ['Régime fiscal optimal',(r.bestReg&&r.bestReg.res&&r.bestReg.res.desc||'—').split('—')[0].trim()],
    ['Cash-flow après impôt (optimal)',e(r.bestReg?r.bestReg.res.cfApres:0)+'/mois'],
    ['Score d\'investissement',Math.round(r.score)+'/100 — '+scLbl],
    ['Patrimoine net estimé (an '+r.horizon+')',e(dernier.patriNet,0)],
    ['TRI (Taux Rendement Interne)',((t)=>t!==null?p(t):'Non calculable')(computeTRI(r))],
    ['Gain net total de l\'opération',e(gainNet_pdf,0)],
  ];
  rowToggle=false;
  synth.forEach(([l,v],i)=>{
    const isBig=[7,9,10,11,12].includes(i);
    row(l,v,isBig?GOLD:INK2,isBig);
  });
  y+=6;

  // Avertissement légal final
  checkY(28);
  doc.setFillColor(...RED_LIGHT);doc.roundedRect(M,y,CW,24,2,2,'F');
  doc.setDrawColor(...RED);doc.setLineWidth(.2);doc.roundedRect(M,y,CW,24,2,2,'S');
  doc.setTextColor(...RED);doc.setFontSize(7);doc.setFont('helvetica','bold');
  doc.text('AVERTISSEMENT LÉGAL',M+4,y+6);
  doc.setTextColor(...RED);doc.setFont('helvetica','normal');doc.setFontSize(6.5);
  const avert='Ce document est produit a titre indicatif par ImmoSim V9 sur la base des donnees saisies par l\'utilisateur. '+
    'Les calculs fiscaux sont simplifiés et ne tiennent pas compte de l\'ensemble des spécificités de votre situation personnelle. '+
    'Les projections long terme reposent sur des hypothèses et ne constituent pas une garantie de performance. '+
    'Ce document ne remplace pas le conseil d\'un professionnel qualifié (notaire, expert-comptable, conseiller en gestion de patrimoine).';
  const avertLines=doc.splitTextToSize(avert,CW-8);
  doc.text(avertLines,M+4,y+11);
  y+=28;

  /* ── Sauvegarde ── */
  if(doc.putTotalPages)doc.putTotalPages(totalPagesExp);
  const safeVille=String(r.ville||'bien').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'bien';
  const fname='ImmoSim_V9_Dossier_'+safeVille+'_'+new Date().toISOString().slice(0,10)+'.pdf';
  doc.save(fname);
  toast('PDF pro '+doc.getNumberOfPages()+' pages exporte','ok');
  }catch(err){console.error('Erreur PDF:',err,err.stack);toast('Erreur PDF: '+err.message,'err');}
}

/* ══════════════════════════════════════════════
   DÉMO
══════════════════════════════════════════════ */
function demo(){
  const s=(id,v)=>sv(id,v);
  s('prixAffiche',128000);s('negoP',5);updateNego();
  s('surface',42);s('ville','Bordeaux');s('typeBien','T2');s('anciennete','ancien');s('dpe','C');s('typeLoc','meublee');
  s('description','T2 meublé hypercentre, proche tramway. Refait à neuf 2023. Forte demande locative.');
  s('fraisAgence',3800);s('travaux',6000);s('ameublement',4000);s('autresFrais',400);
  s('apport',22000);s('emprunte','');s('tauxPret',3.65);s('dureePret',20);s('assurEmpr',28);s('periodeAss','m');s('mensManuelle','');
  s('loyerMensuel',680);s('irlTaux',2);s('vacance',4);s('impayes',1);
  s('prixNuit',90);s('occup',68);s('commPlat',15);s('fraisMenage',28);s('nbSejours',7);s('concierge',80);
  s('taxeFonc',720);s('assurPNO',140);s('chargesCopro',580);s('fraisGestion',600);s('entretien',380);s('compta',380);s('autresCharges',120);
  setRegime('lmnp-reel');
  s('tmi',30);s('ps',17.2);s('interets','');s('assurDed',336);s('autresDed',0);
  s('amortImm',2800);s('amortMob',800);s('amortTrav',600);s('amortAut',0);
  s('revalBien',2.5);s('inflCharges',1.5);s('horizon',20);s('prixRevente','');
  lv();calc();
}

/* ══════════════════════════════════════════════
   CAPTURE / RESTAURATION FORMULAIRE
══════════════════════════════════════════════ */
const FIDS=['prixAffiche','prixAchat','negoP','surface','ville','codePostal','codeCommune','typeBien','anciennete','dpe','typeLoc','description','fraisNotaire','fraisAgence','travaux','ameublement','autresFrais','apport','emprunte','tauxPret','dureePret','assurEmpr','periodeAss','mensManuelle','loyerMensuel','irlTaux','vacance','impayes','prixNuit','occup','commPlat','fraisMenage','nbSejours','concierge','taxeFonc','assurPNO','chargesCopro','fraisGestion','entretien','compta','autresCharges','regime','tmi','ps','interets','assurDed','autresDed','tauxIS','amortImm','amortMob','amortTrav','amortAut','salaireDirigeant','pctDividende','revalBien','inflCharges','horizon','prixRevente','revenusMenage','autresCredits'];
function capForm(){const d={};FIDS.forEach(id=>{const el=g(id);if(el)d[id]=el.value});d._locMode=locMode;d._finMode=finMode;d._lots=lots;return d}
function restForm(d){FIDS.forEach(id=>{const el=g(id);if(el&&d[id]!==undefined)el.value=d[id]});setRegime(d.regime||'micro-foncier');if(d._locMode)switchLoc(d._locMode);if(d._finMode)switchFin(d._finMode);if(d._lots)lots=[...d._lots];renderLots();updAmort()}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  // Listeners
  ['prixAchat','fraisNotaire','fraisAgence','travaux','ameublement','autresFrais','apport','emprunte','tauxPret','dureePret','assurEmpr','periodeAss','prixNuit','occup','commPlat','fraisMenage','nbSejours','concierge'].forEach(id=>{const el=g(id);if(el)el.addEventListener('input',lv)});
  g('anciennete').addEventListener('change',autoNotaire);
  g('regimeTabs').addEventListener('click',e=>{if(e.target.classList.contains('rt'))setRegime(e.target.dataset.r)});
  g('modalSave').addEventListener('click',e=>{if(e.target===e.currentTarget)closeMod('modalSave')});
  g('modalLot').addEventListener('click',e=>{if(e.target===e.currentTarget)closeMod('modalLot')});
  g('nomProjet').addEventListener('keydown',e=>{if(e.key==='Enter')savePortf()});
  buildPresets();renderLots();setRegime('micro-foncier');buildChecklist();

  // Clé API
  const k=getKey();
  if(k){g('apiKey').value=k;const st=g('keyStatus');st.style.display='block';st.style.background='var(--em-a)';st.style.color='var(--em)';st.style.border='1px solid var(--em-b)';st.textContent='✅ Clé chargée.'}

  // Badges
  g('portfBadge').textContent=getPortf().length;
  g('histBadge').textContent=getHist().length;

  // Import depuis URL
  loadShareURL();

  // Notaire initial
  autoNotaire();
  // Capture initiale pour undo
  setTimeout(()=>{_captureState();},200);
  // Listener undo sur tous les inputs
  document.querySelectorAll('#view-sim input,#view-sim select,#view-sim textarea').forEach(el=>el.addEventListener('change',_debouncedCapture));

  // Documentation
  initDoc();
});

/* ════════════════════════════════════════════════
   DOCUMENTATION — Fonctions
════════════════════════════════════════════════ */

/* Données glossaire */
const GLOSSAIRE=[
  {t:'Rentabilité brute',d:'(Loyer annuel / Prix d\'achat total) × 100. Indicateur de base, avant charges et impôts. Un seuil de 6% est considéré correct pour un investissement locatif classique.'},
  {t:'Rentabilité nette',d:'Rentabilité après déduction de toutes les charges (taxe foncière, assurances, gestion, entretien…) mais avant impôts sur les revenus locatifs.'},
  {t:'Cash-flow',d:'Argent généré ou consommé chaque mois par l\'investissement. CF positif = l\'investissement s\'autofinance. CF négatif = vous complétez chaque mois de votre poche.'},
  {t:'Vacance locative',d:'Pourcentage de temps où le bien est inoccupé sur une année. Ex : 5% = environ 18 jours sans locataire. À prendre en compte dans les projections.'},
  {t:'Taux d\'impayés',d:'Risque de ne pas percevoir les loyers attendus. Même avec une assurance loyers impayés, un taux de 1% est réaliste à provisionner.'},
  {t:'Frais de notaire',d:'Frais liés à l\'acte authentique chez le notaire. Environ 7–8% du prix dans l\'ancien, 2–3% dans le neuf. Comprennent taxes, débours et honoraires.'},
  {t:'LMNP',d:'Loueur Meublé Non Professionnel. Statut fiscal pour les locations meublées dont les recettes annuelles sont inférieures à 23 000€ ou ne dépassent pas les revenus professionnels.'},
  {t:'Déficit foncier',d:'Situation où les charges déductibles dépassent les revenus fonciers. Ce déficit peut être imputé sur le revenu global dans la limite de 10 700€/an, le reste est reportable 10 ans.'},
  {t:'Amortissement',d:'Déduction comptable représentant la dépréciation annuelle d\'un actif (immeuble, mobilier, travaux) sur sa durée de vie. En LMNP réel, réduit le résultat imposable sans sortie d\'argent.'},
  {t:'Revenu imposable',d:'Assiette sur laquelle est calculé l\'impôt. Varie selon le régime : loyer × 70% (micro-foncier), loyer − charges réelles (réel), etc.'},
  {t:'TMI',d:'Tranche Marginale d\'Imposition. Le taux d\'imposition sur le dernier euro de revenu perçu : 0%, 11%, 30%, 41% ou 45% selon vos revenus totaux.'},
  {t:'Prélèvements sociaux',d:'Cotisations sociales appliquées sur les revenus du patrimoine : 17,2% en 2024. S\'ajoutent à l\'impôt sur le revenu pour les revenus locatifs.'},
  {t:'IRL',d:'Indice de Référence des Loyers. Indice publié trimestriellement par l\'INSEE servant de base à la révision annuelle des loyers des baux d\'habitation.'},
  {t:'SCI',d:'Société Civile Immobilière. Société permettant de détenir et gérer des biens immobiliers à plusieurs, facilitant la gestion et la transmission du patrimoine.'},
  {t:'Taxe foncière',d:'Impôt local annuel dû par le propriétaire du bien au 1er janvier de l\'année, qu\'il soit occupant ou bailleur. Son montant varie fortement selon la commune.'},
  {t:'PNO',d:'Propriétaire Non Occupant. Assurance obligatoire pour les bailleurs couvrant les risques non couverts par l\'assurance du locataire (notamment les périodes de vacance).'},
  {t:'Plus-value immobilière',d:'Différence entre le prix de vente et le prix d\'achat d\'un bien. Imposée à 19% + 17,2% de prélèvements sociaux, avec abattements progressifs selon la durée de détention.'},
  {t:'IRA',d:'Indemnités de Remboursement Anticipé. Pénalités dues à la banque en cas de remboursement anticipé du crédit. Plafonnées légalement à 3% du capital restant ou 6 mois d\'intérêts (le plus faible des deux).'},
  {t:'Rendement sur apport',d:'(CF mensuel × 12) / Apport × 100. Mesure l\'efficacité de votre capital investi. Un rendement sur apport > rendement brut indique que l\'effet de levier est positif.'},
  {t:'TRI',d:'Taux de Rendement Interne. Taux qui annule la Valeur Actuelle Nette de tous les flux de trésorerie de l\'investissement. Permet de comparer des investissements de durées différentes.'},
  {t:'Charges récupérables',d:'Charges que le bailleur peut refacturer au locataire (eau, entretien parties communes, etc.). À distinguer des charges non récupérables qui restent à la charge du propriétaire.'},
  {t:'Copropriété',d:'Régime juridique d\'un immeuble divisé en lots appartenant à plusieurs propriétaires. Des charges de copropriété sont appelées pour l\'entretien des parties communes.'},
];


/* ═══════════════════════════════════════════════
   PAGE DE GARDE — IDENTITÉ CABINET
═══════════════════════════════════════════════ */
function openIdentityModal(){
  const id=JSON.parse(localStorage.getItem('immoV8_identity')||'{}');
  ['cabinet','conseiller','titre','tel','email','web','adresse'].forEach(k=>{
    if(g('id_'+k))g('id_'+k).value=id[k]||'';
  });
  if(g('id_color'))g('id_color').value=id.themeColor||'#dba84a';
  const prev=g('id_logo_preview');
  if(id.logo){prev.src=id.logo;prev.style.display='block';g('id_logo_del').style.display='inline-flex';}
  else{prev.style.display='none';g('id_logo_del').style.display='none';}
  openModal('identityModal');
}
function closeIdentityModal(){closeModal('identityModal');}
function handleIdentityLogo(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    g('id_logo_preview').src=e.target.result;
    g('id_logo_preview').style.display='block';
    g('id_logo_del').style.display='inline-flex';
  };
  reader.readAsDataURL(file);
}
function removeIdentityLogo(){
  g('id_logo_preview').src='';g('id_logo_preview').style.display='none';
  g('id_logo_input').value='';g('id_logo_del').style.display='none';
}
function saveIdentity(){
  const id={};
  ['cabinet','conseiller','titre','tel','email','web','adresse'].forEach(k=>{id[k]=g('id_'+k)?.value||'';});
  id.themeColor=g('id_color')?.value||'#dba84a';
  const prev=g('id_logo_preview');
  if(prev&&prev.src&&prev.src!==window.location.href)id.logo=prev.src;
  localStorage.setItem('immoV8_identity',JSON.stringify(id));
  // Sauvegarder couleurs PDF si l'onglet a été visité
  const anyColorEl=document.getElementById('pdf_accent');
  if(anyColorEl)savePDFColors();
  closeIdentityModal();
  toast('Paramètres enregistrés ✓','ok');
}
function clearIdentity(){
  localStorage.removeItem('immoV8_identity');
  ['cabinet','conseiller','titre','tel','email','web','adresse'].forEach(k=>{if(g('id_'+k))g('id_'+k).value='';});
  removeIdentityLogo();
  toast('Page de garde effacée','ok');
}
function getIdentity(){return JSON.parse(localStorage.getItem('immoV8_identity')||'{}')}

/* ═══════════════════════════════════════════════
   HELPERS MODALES GÉNÉRIQUES
═══════════════════════════════════════════════ */
function openModal(id){const el=g(id);if(el)el.classList.add('open');}
function closeModal(id){const el=g(id);if(el)el.classList.remove('open');}
document.addEventListener('click',e=>{
  if(e.target.classList.contains('modal-overlay'))e.target.classList.remove('open');
});

/* ═══════════════════════════════════════════════
   CLOUD SYNC — JSONBin.io
═══════════════════════════════════════════════ */
function cloudStatus(msg,type='info'){
  const el=g('cloud_status');if(!el)return;
  const colors={ok:'var(--em)',err:'var(--ru)',info:'var(--ink3)',load:'var(--am)'};
  el.style.color=colors[type]||colors.info;
  el.textContent=msg;
}

async function cloudSave(){
  const apiKey=g('cloud_apikey')?.value.trim();
  if(!apiKey){cloudStatus('Saisissez votre clé API JSONBin.','err');return;}
  const binId=g('cloud_binid')?.value.trim();
  cloudStatus('Sauvegarde en cours...','load');
  const payload={
    simulation:capForm(),
    portf:getPortf(),
    identity:getIdentity(),
    savedAt:new Date().toISOString(),
    version:'ImmoSim V8'
  };
  try{
    let url='https://api.jsonbin.io/v3/b';
    let method='POST';
    const headers={'Content-Type':'application/json','X-Master-Key':apiKey,'X-Bin-Name':'ImmoSim-V8'};
    if(binId){url+='/'+binId;method='PUT';}
    const resp=await fetch(url,{method,headers,body:JSON.stringify(payload)});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.message||'Erreur '+resp.status);
    const id=data.metadata?.id||binId;
    if(g('cloud_binid'))g('cloud_binid').value=id;
    localStorage.setItem('immoV8_cloudBinId',id);
    localStorage.setItem('immoV8_cloudKey',apiKey);
    cloudStatus('Sauvegarde OK — Bin ID : '+id,'ok');
    toast('Cloud sauvegardé ✓','ok');
  }catch(err){cloudStatus('Erreur : '+err.message,'err');}
}

async function cloudLoad(){
  const apiKey=g('cloud_apikey')?.value.trim()||localStorage.getItem('immoV8_cloudKey')||'';
  const binId=g('cloud_binid')?.value.trim()||localStorage.getItem('immoV8_cloudBinId')||'';
  if(!apiKey||!binId){cloudStatus('Renseignez la clé API et le Bin ID.','err');return;}
  cloudStatus('Chargement depuis le cloud...','load');
  try{
    const resp=await fetch('https://api.jsonbin.io/v3/b/'+binId+'/latest',{
      headers:{'X-Master-Key':apiKey,'X-Bin-Private':'false'}
    });
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.message||'Erreur '+resp.status);
    const payload=data.record;
    if(payload.simulation)restForm(payload.simulation);
    if(payload.portf)localStorage.setItem('immoV7_portf',JSON.stringify(payload.portf));
    if(payload.identity)localStorage.setItem('immoV8_identity',JSON.stringify(payload.identity));
    closeModal('cloudModal');
    toast('Données cloud chargées ✓ ('+new Date(payload.savedAt).toLocaleDateString('fr-FR')+')','ok');
  }catch(err){cloudStatus('Erreur : '+err.message,'err');}
}

// Pré-remplir depuis localStorage au chargement
(function(){
  const k=localStorage.getItem('immoV8_cloudKey');
  const b=localStorage.getItem('immoV8_cloudBinId');
  if(k&&g('cloud_apikey'))g('cloud_apikey').value=k;
  if(b&&g('cloud_binid'))g('cloud_binid').value=b;
})();


/* Données FAQ */
const FAQ=[
  {q:'Quelle rentabilité viser pour un investissement locatif ?',a:'En général : rentabilité brute ≥ 5–6% en zone tendue (Paris, Lyon, Bordeaux), ≥ 7–8% en province. La rentabilité nette cible est typiquement 3,5–5%. Mais le cash-flow après impôt est l\'indicateur décisif : visez un CF positif ou neutre, au pire légèrement négatif si vous comptez sur la plus-value.'},
  {q:'Quelle est la différence entre rentabilité nette et cash-flow ?',a:'La rentabilité nette (en %) mesure le rapport entre revenus nets et capital investi — c\'est un ratio. Le cash-flow (en €/mois) est l\'argent réellement en poche chaque mois après le remboursement du crédit. Un bien peut avoir une bonne rentabilité nette mais un CF négatif si le crédit est important.'},
  {q:'Quel régime fiscal choisir : micro-foncier ou réel ?',a:'Choisissez le réel si vos charges réelles dépassent 30% de vos loyers (micro-foncier), ou si vous avez des intérêts d\'emprunt importants. Pour la location meublée, le LMNP réel avec amortissements est presque toujours le plus avantageux — il permet souvent de ne payer aucun impôt pendant 10–15 ans.'},
  {q:'Comment fonctionne le déficit foncier ?',a:'En régime réel foncier, si vos charges (intérêts, travaux, etc.) dépassent vos loyers, vous créez un déficit. Ce déficit est imputable sur votre revenu global jusqu\'à 10 700€/an, ce qui réduit votre impôt total. L\'excédent est reportable 10 ans sur les revenus fonciers futurs. C\'est un avantage fiscal puissant lors des premières années ou après des travaux.'},
  {q:'Mes données sont-elles sauvegardées automatiquement ?',a:'L\'historique des calculs (30 entrées) est sauvegardé automatiquement dans votre navigateur. Le portefeuille est également conservé localement. En revanche, si vous changez de navigateur ou d\'appareil, utilisez le bouton ↓ JSON pour exporter vos données et ↑ Import pour les restaurer.'},
  {q:'Comment partager ma simulation avec mon banquier ?',a:'Trois options : (1) Bouton ↓ PDF pour un dossier professionnel 3 pages, idéal pour la banque. (2) Bouton ↓ CSV pour un tableau Excel. (3) Bouton 🔗 Partager pour un lien URL que votre banquier peut ouvrir — il verra la simulation pré-remplie.'},
  {q:'Comment fonctionne l\'extraction IA ?',a:'Dans l\'onglet ✦ IA, saisissez votre clé API Claude (obtenable sur console.anthropic.com) puis collez le texte copié d\'une annonce SeLoger, LeBonCoin, PAP, etc. L\'IA analyse le texte et extrait automatiquement le prix, la surface, la ville, le DPE, les charges, etc. Vérifiez les données avant de les importer dans le simulateur. Coût : ≈ 0,001–0,003€ par analyse.'},
  {q:'Qu\'est-ce que le score d\'investissement ?',a:'C\'est une note sur 100 calculée selon 5 critères : rentabilité brute (30pts), cash-flow (25pts), DPE (15pts), vacance locative (15pts), ratio mensualité/loyer (15pts). Score ≥ 70 = excellent. 50–70 = bon. 30–50 = moyen. < 30 = risqué. Il est visible dans les résultats et dans votre portefeuille.'},
  {q:'Peut-on simuler un achat sans crédit (comptant) ?',a:'Oui. Laissez le champ "Apport" égal au coût total du projet et le taux à 0. La mensualité sera nulle et le cash-flow reflétera les seuls revenus nets de charges. L\'onglet "Effet levier" dans le panel résultats compare d\'ailleurs automatiquement les deux stratégies.'},
  {q:'Comment utiliser le simulateur de refinancement ?',a:'Dans le panel résultats, onglet "Refin.", saisissez après combien d\'années vous souhaitez renégocier et le nouveau taux obtenu. Le simulateur calcule le capital restant à ce moment, les IRA à payer, la nouvelle mensualité et le nombre de mois nécessaires pour rentabiliser l\'opération (point mort).'},
];

function initDoc(){
  buildGlossaire();
  buildFAQ();
  // Ouvrir la première section par défaut
  toggleDoc('ds0');
}

/* Navigation dans le doc */
function scrollDoc(id){
  const el=g(id);if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'start'});
  // Ouvrir la section si fermée
  const bodyId=el.querySelector('.doc-body')?.id;
  if(bodyId&&!g(bodyId).classList.contains('open'))toggleDoc(bodyId.replace('db','ds'));
}

function toggleDoc(sectionId){
  const idx=sectionId.replace('ds','');
  const body=g('db'+idx),arrow=g('da'+idx);
  if(!body)return;
  const isOpen=body.classList.toggle('open');
  if(arrow)arrow.classList.toggle('open',isOpen);
}

/* Glossaire */
function buildGlossaire(){
  const el=g('glossaireContent');if(!el)return;
  el.innerHTML=GLOSSAIRE.map(e=>`
    <div class="doc-glos-item" data-term="${e.t.toLowerCase()}">
      <span class="doc-glos-term">${e.t}</span>
      <span class="doc-glos-def">${e.d}</span>
    </div>`).join('');
}

function filterGlossaire(){
  const q=(g('glossFilter')?.value||'').toLowerCase();
  document.querySelectorAll('.doc-glos-item').forEach(el=>{
    el.style.display=el.dataset.term?.includes(q)||el.textContent.toLowerCase().includes(q)?'':'none';
  });
}

/* FAQ */
function buildFAQ(){
  const el=g('faqContent');if(!el)return;
  el.innerHTML=FAQ.map((f,i)=>`
    <div class="doc-faq-item">
      <div class="doc-faq-q" onclick="toggleFAQ(${i})">
        <span>${f.q}</span><span id="faq-arrow-${i}">▼</span>
      </div>
      <div class="doc-faq-a" id="faq-a-${i}">${f.a}</div>
    </div>`).join('');
}

function toggleFAQ(i){
  const a=g('faq-a-'+i),arrow=g('faq-arrow-'+i);
  if(!a)return;
  const isOpen=a.classList.toggle('open');
  if(arrow)arrow.textContent=isOpen?'▲':'▼';
}

/* ════════════════════════════════════════════════
   FEATURE 1: AUTO-SAVE
════════════════════════════════════════════════ */
const AUTOSAVE_KEY='immoV8_autosave';
let _autoSaveTimer=null;

function autoSave(){
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer=setTimeout(()=>{
    const data=capForm();
    data._photos=undefined; // don't save photos
    try{localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(data));}catch(e){}
    const badge=g('autosaveBadge');
    if(badge){badge.classList.add('show');setTimeout(()=>badge.classList.remove('show'),1400);}
  },600);
}

function autoRestore(){
  try{
    const raw=localStorage.getItem(AUTOSAVE_KEY);
    if(!raw)return;
    const data=JSON.parse(raw);
    if(!data||!data.prixAchat)return;
    restForm(data);
    lv();updateFormProgress();updateDebtRatio();runValidation();
    toast('Formulaire restauré automatiquement','ok');
  }catch(e){}
}

/* ════════════════════════════════════════════════
   FEATURE 2: VALIDATION VISUELLE
════════════════════════════════════════════════ */
function clearValMsg(id){
  const el=g(id);if(!el)return;
  el.classList.remove('field-error','field-ok');
  const prev=el.parentElement.querySelector('.val-msg');
  if(prev)prev.remove();
}
function setValMsg(id,msg,type){
  const el=g(id);if(!el)return;
  clearValMsg(id);
  el.classList.add(type==='err'?'field-error':'field-ok');
  const span=document.createElement('span');
  span.className='val-msg '+type;
  span.textContent=msg;
  el.parentElement.appendChild(span);
}

function runValidation(){
  // Clear all
  FIDS.forEach(id=>clearValMsg(id));

  const pa=vn('prixAchat'),loyer=vn('loyerMensuel'),taux=vn('tauxPret'),
        duree=vn('dureePret'),apport=vn('apport'),mens=vn('mensCalculee')||0;

  // Required fields check
  if(!pa&&g('prixAchat').value.trim()==='')setValMsg('prixAchat','Champ obligatoire','err');
  else if(pa>0)setValMsg('prixAchat','✓','ok');

  if(!loyer&&g('loyerMensuel').value.trim()==='')setValMsg('loyerMensuel','Champ obligatoire','err');
  else if(loyer>0)setValMsg('loyerMensuel','✓','ok');

  if(!taux&&g('tauxPret').value.trim()==='')setValMsg('tauxPret','Champ obligatoire','err');
  else if(taux>0&&taux<0.5)setValMsg('tauxPret','Taux inhabituellement bas','warn');
  else if(taux>7)setValMsg('tauxPret','Taux très élevé — vérifiez','warn');
  else if(taux>0)setValMsg('tauxPret','✓','ok');

  if(!duree&&g('dureePret').value.trim()==='')setValMsg('dureePret','Champ obligatoire','err');
  else if(duree>25)setValMsg('dureePret','> 25 ans : difficile à obtenir','warn');
  else if(duree>0)setValMsg('dureePret','✓','ok');

  // Coherence warnings
  if(loyer>0&&pa>0){
    const rentBrute=(loyer*12/pa)*100;
    if(rentBrute<3)setValMsg('loyerMensuel','Rent. brute < 3% — loyer faible vs prix','warn');
    else if(rentBrute>15)setValMsg('loyerMensuel','Rent. brute > 15% — vérifiez le loyer','warn');
    else setValMsg('loyerMensuel','✓','ok');
  }

  if(apport>0&&pa>0&&apport>pa*1.2)setValMsg('apport','Apport > 120% du prix — vérifiez','warn');

  const vacance=vn('vacance');
  if(vacance>20)setValMsg('vacance','Vacance > 20% — très conservateur','warn');
}

/* ════════════════════════════════════════════════
   FEATURE 3: TAUX D'ENDETTEMENT
════════════════════════════════════════════════ */
function updateDebtRatio(){
  const revenus=vn('revenusMenage');
  const autresCredits=vn('autresCredits');
  const mens=vn('mensCalculee')||vn('mensManuelle')||0;
  const display=g('debtRatioDisplay');
  if(!display)return;

  if(!revenus||revenus<=0){display.style.display='none';return;}
  display.style.display='block';

  const totalCharges=mens+autresCredits;
  const ratio=(totalCharges/revenus)*100;
  const ratioStr=ratio.toFixed(1)+'%';

  const badge=g('debtRatioValue');
  const gauge=g('debtGaugeFill');
  const msg=g('debtRatioMsg');

  badge.textContent=ratioStr;
  gauge.style.width=Math.min(ratio,100)+'%';

  if(ratio<=33){
    badge.className='debt-badge ok';
    gauge.style.background='var(--em)';
    msg.className='val-msg ok';
    msg.textContent='✓ Endettement maîtrisé — dossier bancaire solide';
  } else if(ratio<=35){
    badge.className='debt-badge warn';
    gauge.style.background='var(--am)';
    msg.className='val-msg warn';
    msg.textContent='⚠ Limite HCSF (35%) approchée — négociation possible';
  } else {
    badge.className='debt-badge danger';
    gauge.style.background='var(--ru)';
    msg.className='val-msg err';
    msg.textContent='✗ Taux > 35% — refus bancaire probable (norme HCSF)';
  }
}

/* ════════════════════════════════════════════════
   FEATURE: TABLEAU D'AMORTISSEMENT INTERACTIF
════════════════════════════════════════════════ */
function buildAmort(r){
  if(!r)return;
  const panel=g('panelAmort');
  if(!panel)return;
  const eur=(n,d=0)=>(+n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})+' €';
  const tauxM=(r.tauxPret/100)/12;
  let cap=r.emp;
  let totalInt=0,totalCap=0;
  const rows=[];
  for(let an=1;an<=r.dureePret;an++){
    let iAn=0,cAn=0;
    for(let m=0;m<12;m++){
      const i=Math.max(0,cap)*tauxM;
      iAn+=i;cAn+=r.mensHAss-i;cap-=r.mensHAss-i;
    }
    totalInt+=iAn;totalCap+=cAn;
    const loyerAn=r.loyerAn*Math.pow(1+r.irlTaux/100,an-1);
    const chargesAn=r.charges*Math.pow(1+r.inflCharges/100,an-1);
    const cfMois=(loyerAn-chargesAn)/12-r.mensFin;
    rows.push({an,iAn,cAn,capRestant:Math.max(0,cap),cfMois,loyerAn,chargesAn});
  }
  const totalRembourse=r.mensFin*r.dureePret*12;
  const pctInt=r.emp>0?Math.round(totalInt/totalRembourse*100):0;
  panel.innerHTML=`
    <div class="ptitle">Tableau d'amortissement — ${r.dureePret} ans</div>
    <div class="amort-summary">
      <div class="as-card"><div class="as-val am-gold">${eur(r.emp)}</div><div class="as-lbl">Emprunté</div></div>
      <div class="as-card"><div class="as-val am-red">${eur(totalInt)}</div><div class="as-lbl">Intérêts (${pctInt}%)</div></div>
      <div class="as-card"><div class="as-val am-blue">${eur(r.mensFin)}/mois</div><div class="as-lbl">Mensualité</div></div>
      <div class="as-card"><div class="as-val">${eur(totalRembourse)}</div><div class="as-lbl">Coût total crédit</div></div>
    </div>
    <div class="amort-wrap">
    <table class="amort-table">
      <thead><tr><th style="text-align:left">Année</th><th>Intérêts</th><th>Capital</th><th>Restant dû</th><th>CF net/mois</th></tr></thead>
      <tbody>${rows.map(r=>`
        <tr class="${r.an%5===0?'amort-5y':''}">
          <td>An ${r.an} <span style="color:var(--ink3);font-weight:400;font-size:.64rem">(${new Date().getFullYear()+r.an-1})</span></td>
          <td class="am-red">${eur(r.iAn)}</td>
          <td class="am-green">${eur(r.cAn)}</td>
          <td class="am-blue">${eur(r.capRestant)}</td>
          <td class="${r.cfMois>=0?'am-green':'am-red'}" style="font-weight:700">${eur(r.cfMois)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px;height:40px;background:var(--bg2);border-radius:var(--r);position:relative;overflow:hidden" title="Répartition intérêts/capital">
        <div style="position:absolute;left:0;top:0;height:100%;width:${pctInt}%;background:var(--ru-a);border-right:2px solid var(--ru)"></div>
        <div style="position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:12px;font-size:.65rem;font-weight:700">
          <span style="color:var(--ru)">Intérêts ${pctInt}%</span>
          <span style="color:var(--em)">Capital ${100-pctInt}%</span>
        </div>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════
   FEATURE 4: MULTI-SCÉNARIOS
════════════════════════════════════════════════ */
function buildScenarios(r){
  if(!r)return;
  const panel=g('panelScenarios');
  if(!panel)return;

  // Scenario params: adjust loyer, vacance, taux
  const scenarios=[
    {name:'Optimiste',cls:'opti',loyerMult:1.05,vacanceMult:0.5,tauxDelta:-0.3,revaloAdd:0.5},
    {name:'Réaliste',cls:'real',loyerMult:1,vacanceMult:1,tauxDelta:0,revaloAdd:0},
    {name:'Pessimiste',cls:'pessi',loyerMult:0.9,vacanceMult:2,tauxDelta:0.5,revaloAdd:-0.5},
  ];

  const cards=scenarios.map(sc=>{
    const loyerM=r.loyerM*sc.loyerMult;
    const loyerAn=loyerM*12;
    const vacance=(r.isCD?0:vn('vacance'))*sc.vacanceMult;
    const revNet=r.isCD?loyerAn:loyerAn*(1-vacance/100-(vn('impayes')||0)/100);
    const charges=r.charges;
    const revNC=revNet-charges;
    const rentBrute=r.coutTotal>0?(loyerAn/r.coutTotal)*100:0;
    const rentNette=r.coutTotal>0?(revNC/r.coutTotal)*100:0;

    // Recalc mensualité with adjusted rate
    const adjTaux=Math.max(0.1,r.tauxPret+sc.tauxDelta);
    const adjMens=calcMens(r.emp,adjTaux,r.dureePret);
    let assEmpM=vn('assurEmpr');if(g('periodeAss').value==='a')assEmpM/=12;
    const mensFin=g('mensManuelle').value.trim()?vn('mensManuelle'):adjMens+assEmpM;

    const cfAvant=(revNC/12)-mensFin;
    const fp={...r.fp,loyer:loyerAn,charges,cfAvant};
    const fisc=calcFiscal(r.regime,fp);

    // Revente at horizon
    const revalo=Math.max(0,(r.revalBien||2)+sc.revaloAdd);
    const prixRevH=r.pa*Math.pow(1+revalo/100,r.horizon||20);

    return{
      ...sc,loyerM,rentBrute,rentNette,cfAvant,cfApres:fisc.cfApres,
      mensFin,prixRevH,adjTaux
    };
  });

  // Find best CF
  const bestIdx=cards.reduce((bi,c,i)=>c.cfApres>cards[bi].cfApres?i:bi,0);

  panel.innerHTML=`
    <div class="ptitle">Scénarios optimiste / réaliste / pessimiste</div>
    <p style="font-size:.72rem;color:var(--ink3);margin-bottom:6px">Variation automatique du loyer, vacance, taux et revalorisation.</p>
    <div class="scenario-grid">
      ${cards.map((c,i)=>`
        <div class="scenario-card ${i===bestIdx?'best':''}">
          <div class="sc-title ${c.cls}">${c.name}</div>
          <div class="sc-row"><span class="l">Loyer</span><span class="v">${eur(c.loyerM)}/m</span></div>
          <div class="sc-row"><span class="l">Taux crédit</span><span class="v">${pct(c.adjTaux)}</span></div>
          <div class="sc-row"><span class="l">Mensualité</span><span class="v">${eur(c.mensFin)}</span></div>
          <div class="sc-row"><span class="l">Rent. brute</span><span class="v">${pct(c.rentBrute)}</span></div>
          <div class="sc-row"><span class="l">Rent. nette</span><span class="v">${pct(c.rentNette)}</span></div>
          <div class="sc-row"><span class="l">CF avant impôt</span><span class="v" style="color:${c.cfAvant>=0?'var(--em)':'var(--ru)'}">${eur(c.cfAvant)}/m</span></div>
          <div class="sc-row"><span class="l">CF après impôt</span><span class="v" style="color:${c.cfApres>=0?'var(--em)':'var(--ru)'}">${eur(c.cfApres)}/m</span></div>
          <div class="sc-row"><span class="l">Valeur ${r.horizon||20} ans</span><span class="v" style="color:var(--gold)">${eur(c.prixRevH,0)}</span></div>
        </div>
      `).join('')}
    </div>
    <p class="disc" style="margin-top:10px">Optimiste : loyer +5%, vacance ÷2, taux −0,3pt, revalo +0,5pt.<br/>
    Pessimiste : loyer −10%, vacance ×2, taux +0,5pt, revalo −0,5pt.</p>
  `;

  // Build scenario chart
  buildScenarioChart(cards,r);
}

function buildScenarioChart(cards,r){
  const panel=g('panelScenarios');
  if(!panel)return;
  // Add a small chart container
  let wrap=document.getElementById('scenarioChartWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='scenarioChartWrap';
    wrap.className='chart-box';
    wrap.style.marginTop='14px';
    wrap.innerHTML='<canvas id="chartScenarios"></canvas>';
    panel.appendChild(wrap);
  }
  destroyChart('chartScenarios');
  const cc=chartColors();
  chartRefs['chartScenarios']=new Chart(document.getElementById('chartScenarios'),{
    type:'bar',
    data:{
      labels:cards.map(c=>c.name),
      datasets:[
        {label:'CF avant impôt',data:cards.map(c=>+c.cfAvant.toFixed(2)),backgroundColor:['rgba(78,202,136,.6)','rgba(219,168,74,.6)','rgba(239,101,101,.6)']},
        {label:'CF après impôt',data:cards.map(c=>+c.cfApres.toFixed(2)),backgroundColor:['rgba(78,202,136,.3)','rgba(219,168,74,.3)','rgba(239,101,101,.3)'],borderWidth:1,borderColor:['var(--em)','var(--gold)','var(--ru)']},
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:cc.label,font:{size:11}}}},
      scales:{
        y:{grid:{color:cc.grid},ticks:{color:cc.label,callback:v=>v+'€'}},
        x:{grid:{display:false},ticks:{color:cc.label}}
      }
    }
  });
}

/* ════════════════════════════════════════════════
   WIRE UP: Hook into existing calc() + init
════════════════════════════════════════════════ */
// Patch displayResults to also build scenarios + debt ratio
const _origDisplayResults=displayResults;
displayResults=function(r){
  _origDisplayResults(r);
  buildScenarios(r);
  buildAmort(r);
  updateDebtRatio();
  runValidation();
};

// Patch lv to include debt ratio + validation + autosave
const _origLv=lv;
lv=function(){
  _origLv();
  updateDebtRatio();
  autoSave();
  // Debounced validation
  clearTimeout(lv._valTimer);
  lv._valTimer=setTimeout(runValidation,400);
};

// Auto-restore on load
document.addEventListener('DOMContentLoaded',()=>{
  // Attach autosave to all form inputs
  document.querySelectorAll('#view-sim input,#view-sim select,#view-sim textarea').forEach(el=>{
    el.addEventListener('input',autoSave);
  });
  // Auto-restore disabled: fields start empty
  // User can restore via JSON import if needed
  // setTimeout(autoRestore,300);
  // Income fields trigger debt calc
  ['revenusMenage','autresCredits'].forEach(id=>{
    const el=g(id);
    if(el)el.addEventListener('input',()=>{updateDebtRatio();autoSave();});
  });
});

/* Recherche dans la documentation */
const DOC_INDEX=[
  {section:'Démarrage rapide',text:'simuler bien 5 minutes prix notaire loyer vacance régime fiscal calculer rentabilité'},
  {section:'Formules',text:'coût total mensualité crédit rentabilité brute nette cash-flow vacance amortissement formule calcul'},
  {section:'Régimes fiscaux',text:'micro-foncier réel foncier micro-bic lmnp sci ir is abattement charges amortissement déficit foncier'},
  {section:'Outils',text:'stress test tableau fiscal calendrier flux analyse effet levier refinancement loyer optimal score risque'},
  {section:'Exports',text:'json import export pdf csv partage lien url impression sauvegarde portefeuille'},
  {section:'Glossaire',text:'rentabilité brute nette cash-flow vacance impayés notaire lmnp déficit amortissement tmi irl sci pno ira tri'},
  {section:'FAQ',text:'rentabilité viser différence régime choisir déficit données sauvegardées partager banquier extraction ia score refinancement'},
  ...GLOSSAIRE.map(e=>({section:'Glossaire — '+e.t,text:e.t+' '+e.d})),
  ...FAQ.map(f=>({section:'FAQ',text:f.q+' '+f.a})),
];

function searchDoc(){
  const q=(g('docSearch')?.value||'').toLowerCase().trim();
  const res=g('docSearchResults');if(!res)return;
  if(!q||q.length<2){res.style.display='none';return}
  const matches=DOC_INDEX.filter(item=>item.text.toLowerCase().includes(q)).slice(0,6);
  if(!matches.length){res.innerHTML='<div style="font-size:.76rem;color:var(--ink3);padding:8px">Aucun résultat pour "'+q+'"</div>';res.style.display='block';return}
  res.innerHTML=matches.map(m=>{
    const hl=m.text.toLowerCase().indexOf(q);
    const snippet=m.text.substring(Math.max(0,hl-40),hl+80).replace(new RegExp(q,'gi'),`<span class="doc-sr-match">$&</span>`);
    return`<div class="doc-search-result"><div class="doc-sr-section">${m.section}</div><div class="doc-sr-text">…${snippet}…</div></div>`;
  }).join('');
  res.style.display='block';
}

/* ═══════════════════════════════════════════════════════════════
   AGGREGATEUR — MOTEUR DE RECHERCHE & ANALYSE IA
═══════════════════════════════════════════════════════════════ */

let listings = [];        // toutes les annonces
let filteredListings = []; // après filtres
let shortlist = [];        // favoris
let currentDetail = null;  // annonce en détail

// ── DEMO DATA (expanded - 12 listings) ───────────────────────
function loadDemoListings(){
  const demos = [
    {id:'d1',source:'leboncoin',url:'https://www.leboncoin.fr/',title:'Immeuble de rapport 3 lots — Centre Arras',prix:195000,surface:180,pieces:7,type:'Immeuble',ville:'Arras',cp:'62000',dpe:'D',
     description:"Immeuble de rapport composé de 3 appartements (T2+T2+T3), tous loués. Revenus locatifs actuels : 1 650 €/mois. Toitures refaites en 2019. Façade à ravaler. DPE D. Taxe foncière : 2 400 €/an. Charges copro : aucune (mono-propriétaire). Bon emplacement proche gare. Cave et cour intérieure.",
     loyerActuel:1650,taxeFonciere:2400,chargesCopro:0,travaux:15000,locataireEnPlace:true,img:'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=250&fit=crop',date:'2026-04-05'},
    {id:'d2',source:'seloger',url:'https://www.seloger.com/',title:'T3 lumineux avec balcon — Lens centre',prix:78000,surface:62,pieces:3,type:'Appartement',ville:'Lens',cp:'62300',dpe:'E',
     description:"Appartement T3 au 2ème étage, lumineux, balcon plein sud. Cuisine équipée. Salle de bain refaite. DPE E — isolation des combles à prévoir. Loyer estimé : 480 €/mois. Quartier calme, proche commerces et transports. Charges copro : 45 €/mois. Taxe foncière : 780 €.",
     loyerActuel:0,loyerEstime:480,taxeFonciere:780,chargesCopro:540,travaux:8000,locataireEnPlace:false,img:'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=250&fit=crop',date:'2026-04-07'},
    {id:'d3',source:'bienici',url:'https://www.bienici.com/',title:'Studio meublé rentable — Lille Wazemmes',prix:72000,surface:22,pieces:1,type:'Studio',ville:'Lille',cp:'59000',dpe:'C',
     description:"Studio meublé de 22m², loué 450 €/mois charges comprises. Locataire étudiant en place (bail jusqu'en août 2027). DPE C. Copro récente et bien entretenue. Charges : 35 €/mois. TF : 520 €. Aucun travaux à prévoir. Idéal investisseur, rentabilité élevée.",
     loyerActuel:450,taxeFonciere:520,chargesCopro:420,travaux:0,locataireEnPlace:true,img:'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=250&fit=crop',date:'2026-04-06'},
    {id:'d4',source:'pap',url:'https://www.pap.fr/',title:'Maison 4 pièces avec jardin — Douai',prix:125000,surface:95,pieces:4,type:'Maison',ville:'Douai',cp:'59500',dpe:'F',
     description:"Maison de ville 4 pièces, jardin 80m², garage. Potentiel colocation (3 chambres). Gros travaux d'isolation à prévoir (DPE F). Loyer estimé après rénovation : 750 €/mois. Taxe foncière : 1 100 €. Quartier résidentiel calme. Proche A21.",
     loyerActuel:0,loyerEstime:750,taxeFonciere:1100,chargesCopro:0,travaux:35000,locataireEnPlace:false,colocPossible:true,img:'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=250&fit=crop',date:'2026-04-03'},
    {id:'d5',source:'logicimmo',url:'https://www.logic-immo.com/',title:'T2 rénové centre — Béthune',prix:55000,surface:42,pieces:2,type:'Appartement',ville:'Béthune',cp:'62400',dpe:'C',
     description:"T2 entièrement rénové, RDC sur cour calme. Cuisine neuve, salle d'eau moderne. DPE C. Idéal premier investissement. Loyer marché estimé : 380 €. TF : 650 €. Charges copro faibles : 25 €/mois. Disponible immédiatement.",
     loyerActuel:0,loyerEstime:380,taxeFonciere:650,chargesCopro:300,travaux:0,locataireEnPlace:false,img:'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=250&fit=crop',date:'2026-04-01'},
    {id:'d6',source:'leboncoin',url:'https://www.leboncoin.fr/',title:'Immeuble 5 lots — Saint-Omer',prix:165000,surface:220,pieces:10,type:'Immeuble',ville:'Saint-Omer',cp:'62500',dpe:'E',
     description:"Immeuble de 5 appartements (2xT1 + 2xT2 + 1xT3). 4 lots loués sur 5, revenus actuels : 1 850 €/mois. T2 RDC vacant, travaux de rafraîchissement à prévoir (estimés 5 000 €). DPE E global. TF : 3 200 €. Toiture OK. Façade correcte. Potentiel après travaux : 2 200 €/mois.",
     loyerActuel:1850,loyerEstime:2200,taxeFonciere:3200,chargesCopro:0,travaux:5000,locataireEnPlace:true,img:'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=250&fit=crop',date:'2026-04-04'},
    {id:'d7',source:'leboncoin',url:'https://www.leboncoin.fr/',title:'T2 à rénover prix cassé — Liévin',prix:38000,surface:48,pieces:2,type:'Appartement',ville:'Liévin',cp:'62800',dpe:'G',
     description:"T2 de 48m² au 1er étage à rénover entièrement. DPE G. Prix très bas. Estimation travaux : 25 000 € (isolation, fenêtres, chauffage, cuisine, SDB). Loyer estimé après rénovation : 400 €/mois. Copro de 6 lots, charges : 30 €/mois. TF : 480 €. Potentiel intéressant si travaux maîtrisés.",
     loyerActuel:0,loyerEstime:400,taxeFonciere:480,chargesCopro:360,travaux:25000,locataireEnPlace:false,img:'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=250&fit=crop',date:'2026-04-02'},
    {id:'d8',source:'seloger',url:'https://www.seloger.com/',title:'T1 bis loué — Valenciennes gare',prix:52000,surface:30,pieces:1,type:'Studio',ville:'Valenciennes',cp:'59300',dpe:'D',
     description:"T1 bis de 30m², locataire en place depuis 2 ans, loyer 350 €/mois. Bon état général. DPE D. Charges copro : 40 €/mois. TF : 550 €. Résidence calme proche gare SNCF et université. Idéal investissement clé en main.",
     loyerActuel:350,taxeFonciere:550,chargesCopro:480,travaux:0,locataireEnPlace:true,img:'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400&h=250&fit=crop',date:'2026-04-06'},
    {id:'d9',source:'pap',url:'https://www.pap.fr/',title:'Maison divisible 140m² — Hénin-Beaumont',prix:110000,surface:140,pieces:6,type:'Maison',ville:'Hénin-Beaumont',cp:'62110',dpe:'E',
     description:"Grande maison 6 pièces divisible en 2 appartements (T3+T3). Potentiel colocation ou immeuble de rapport. Garage, cave, cour. DPE E. Travaux de division estimés : 20 000 €. Loyer potentiel total : 900 €/mois. TF : 950 €.",
     loyerActuel:0,loyerEstime:900,taxeFonciere:950,chargesCopro:0,travaux:20000,locataireEnPlace:false,colocPossible:true,img:'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=250&fit=crop',date:'2026-03-29'},
    {id:'d10',source:'bienici',url:'https://www.bienici.com/',title:'Parking boxé — Lille centre',prix:15000,surface:12,pieces:0,type:'Parking',ville:'Lille',cp:'59000',dpe:'',
     description:"Box fermé en sous-sol, résidence sécurisée. Loué 75 €/mois à un locataire stable. Charges copro : 10 €/mois. Pas de taxe foncière. Rentabilité nette très élevée. Zéro gestion.",
     loyerActuel:75,taxeFonciere:0,chargesCopro:120,travaux:0,locataireEnPlace:true,img:'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=250&fit=crop',date:'2026-04-07'},
    {id:'d11',source:'leboncoin',url:'https://www.leboncoin.fr/',title:'Local commercial — Arras Grand Place',prix:89000,surface:55,pieces:2,type:'Local commercial',ville:'Arras',cp:'62000',dpe:'D',
     description:"Local commercial de 55m² avec vitrine, emplacement n°1 Grand Place. Bail commercial en cours, loyer : 650 €/mois. Locataire fiable (restaurant). TF : 1 200 €. Charges : 0 (locataire). Murs en bon état.",
     loyerActuel:650,taxeFonciere:1200,chargesCopro:0,travaux:0,locataireEnPlace:true,img:'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=250&fit=crop',date:'2026-04-06'},
    {id:'d12',source:'seloger',url:'https://www.seloger.com/',title:'T4 familial avec terrasse — Arras Cité',prix:148000,surface:82,pieces:4,type:'Appartement',ville:'Arras',cp:'62000',dpe:'C',
     description:"T4 au dernier étage avec terrasse 15m². Lumineux, calme. 3 chambres. Loyer estimé : 700 €/mois. DPE C. Copro bien gérée. Charges : 120 €/mois. TF : 1 050 €. Ascenseur, cave. Bon secteur scolaire. Potentiel colocation étudiante.",
     loyerActuel:0,loyerEstime:700,taxeFonciere:1050,chargesCopro:1440,travaux:0,locataireEnPlace:false,colocPossible:true,img:'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=250&fit=crop',date:'2026-04-04'},
  ];
  demos.forEach(d=>analyzeListingLocal(d));
  listings = demos;
  filteredListings = [...listings];
  filterListings();
  toast('12 annonces chargées — Hauts-de-France','ok');
  addNotif('12 annonces démo chargées','search');
  // Apply alert profile matching if set
  if(alertProfile){
    listings.forEach(l=>{l.matchPct=calcMatch(l);});
    const matches=listings.filter(l=>l.matchPct>=80);
    if(matches.length) addNotif(`🎯 ${matches.length} annonce(s) à ≥80% de match avec votre profil !`,'match');
  }
}

// ── RECHERCHE RÉELLE VIA CLAUDE + WEB SEARCH ─────────────────
// ── API KEY & PROVIDER MANAGEMENT ─────────────────────────────
const API_PROVIDERS={
  anthropic:{
    url:'https://api.anthropic.com/v1/messages',
    model:'claude-sonnet-4-20250514',
    keyPlaceholder:'sk-ant-api03-…',
    help:'ℹ <strong>Anthropic :</strong> clé sk-ant-api03-… depuis console.anthropic.com<br/><strong>Dans Claude.ai :</strong> fonctionne sans clé.',
    buildHeaders(key){
      const h={'Content-Type':'application/json'};
      if(key){h['x-api-key']=key;h['anthropic-version']='2023-06-01';h['anthropic-dangerous-direct-browser-access']='true';}
      return h;
    },
    buildBody(model,maxTokens,messages,tools){
      const b={model,max_tokens:maxTokens,messages};
      if(tools)b.tools=tools;
      return b;
    },
    extractText(data){return(data.content||[]).map(c=>c.text||'').filter(Boolean).join('\n');}
  },
  openrouter:{
    url:'https://openrouter.ai/api/v1/chat/completions',
    model:'anthropic/claude-sonnet-4-20250514',
    keyPlaceholder:'sk-or-… ou sk-…',
    help:'ℹ <strong>OpenRouter :</strong> clé depuis openrouter.ai/keys<br/>Supporte Claude, GPT, Mistral, etc. Format OpenAI compatible.',
    buildHeaders(key){return{'Content-Type':'application/json','Authorization':'Bearer '+key,'HTTP-Referer':'https://immosim.app','X-Title':'ImmoSim V9'};},
    buildBody(model,maxTokens,messages){return{model,max_tokens:maxTokens,messages:messages.map(m=>({role:m.role,content:m.content}))};},
    extractText(data){return data.choices?.[0]?.message?.content||'';}
  },
  custom:{
    url:'http://localhost:3456/api/messages',
    model:'claude-sonnet-4-20250514',
    keyPlaceholder:'votre clé sk-…',
    help:'ℹ <strong>Proxy local :</strong> lancez le proxy (node proxy.js) puis collez votre clé ici.<br/>Endpoint par défaut : localhost:3456',
    buildHeaders(key){return{'Content-Type':'application/json','Authorization':'Bearer '+key};},
    buildBody(model,maxTokens,messages){return{model,max_tokens:maxTokens,messages:messages.map(m=>({role:m.role,content:m.content}))};},
    extractText(data){
      // Try Anthropic format first, then OpenAI
      if(data.content)return(data.content||[]).map(c=>c.text||'').filter(Boolean).join('\n');
      return data.choices?.[0]?.message?.content||'';
    }
  }
};

function getProvider(){return g('aggApiProvider')?.value||'anthropic';}

function onProviderChange(){
  const p=getProvider();
  const cfg=API_PROVIDERS[p];
  g('aggApiKey').placeholder=cfg.keyPlaceholder;
  g('providerHelp').innerHTML=cfg.help;
  g('customEndpointWrap').style.display=(p==='custom')?'block':'none';
  g('customModelWrap').style.display=(p==='custom'||p==='openrouter')?'block':'none';
  if(p==='openrouter'&&g('aggApiModel'))g('aggApiModel').value=cfg.model;
  if(p==='custom'&&g('aggApiModel'))g('aggApiModel').value='claude-sonnet-4-20250514';
  saveProviderLS();
}

function getAggApiKey(){
  return g('aggApiKey')?.value?.trim() || localStorage.getItem('immoV9_apiKey') || localStorage.getItem('immoV7_key') || '';
}
function saveAggApiKey(){
  const k=g('aggApiKey')?.value?.trim();
  if(!k){toast('Entrez une clé API','err');return;}
  localStorage.setItem('immoV9_apiKey',k);
  localStorage.setItem('immoV7_key',k);
  if(g('apiKey'))g('apiKey').value=k;
  saveProviderLS();
  toast('Configuration API sauvegardée ✓','ok');
  g('apiKeyStatus').textContent='✓ Sauvegardée';
  g('apiKeyStatus').style.color='var(--em)';
}
function toggleAggKeyVis(){const el=g('aggApiKey');el.type=el.type==='password'?'text':'password';}

async function testAggApiKey(){
  const k=getAggApiKey();
  if(!k){toast('Entrez une clé API d\'abord','err');return;}
  g('apiKeyStatus').textContent='⏳ Test en cours…';
  g('apiKeyStatus').style.color='var(--am)';
  try{
    const r=await callClaudeAPI('Réponds juste "OK".', false, 10);
    if(r){
      g('apiKeyStatus').textContent='✓ Connexion OK — '+getProvider();
      g('apiKeyStatus').style.color='var(--em)';
      toast('API connectée ✓ ('+getProvider()+')','ok');
    }
  }catch(e){
    g('apiKeyStatus').textContent='✗ '+e.message;
    g('apiKeyStatus').style.color='var(--ru)';
    toast('Erreur API : '+e.message,'err');
  }
}

function saveProviderLS(){
  try{localStorage.setItem('immoV9_provider',JSON.stringify({
    provider:getProvider(),
    endpoint:g('aggApiEndpoint')?.value||'',
    model:g('aggApiModel')?.value||''
  }))}catch(e){}
}
function loadProviderLS(){
  try{
    const d=JSON.parse(localStorage.getItem('immoV9_provider'));
    if(d){
      if(d.provider&&g('aggApiProvider')){g('aggApiProvider').value=d.provider;onProviderChange();}
      if(d.endpoint&&g('aggApiEndpoint'))g('aggApiEndpoint').value=d.endpoint;
      if(d.model&&g('aggApiModel'))g('aggApiModel').value=d.model;
    }
  }catch(e){}
}

// Load saved key & provider on init
(function(){
  const k=localStorage.getItem('immoV9_apiKey')||localStorage.getItem('immoV7_key')||'';
  if(k&&g('aggApiKey')){g('aggApiKey').value=k;g('apiKeyStatus').textContent='✓ Clé chargée';g('apiKeyStatus').style.color='var(--em)';}
  loadProviderLS();
})();

// ── UNIFIED API CALLER (multi-provider) ──────────────────────
async function callClaudeAPI(prompt, useWebSearch=false, maxTokens=1000){
  const key=getAggApiKey();
  const providerKey=getProvider();
  const cfg=API_PROVIDERS[providerKey];

  // Determine URL and model
  let url=cfg.url;
  let model=cfg.model;
  if(providerKey==='custom'){
    url=g('aggApiEndpoint')?.value?.trim()||url;
    if(!url)throw new Error('Entrez l\'URL de votre endpoint custom');
  }
  if(providerKey==='custom'||providerKey==='openrouter'){
    const customModel=g('aggApiModel')?.value?.trim();
    if(customModel)model=customModel;
  }

  const headers=cfg.buildHeaders(key);
  const messages=[{role:'user',content:prompt}];

  let tools=null;
  if(useWebSearch && providerKey==='anthropic'){
    tools=[{"type":"web_search_20250305","name":"web_search"}];
  }

  const body=cfg.buildBody(model,maxTokens,messages,tools);

  const response=await fetch(url,{
    method:'POST',
    headers,
    body:JSON.stringify(body)
  });

  if(!response.ok){
    const err=await response.json().catch(()=>({}));
    const msg=err.error?.message||err.message||'HTTP '+response.status;
    throw new Error(msg);
  }

  const data=await response.json();
  return cfg.extractText(data);
}

let searchInProgress = false;

async function searchRealListings(){
  if(searchInProgress){toast('Recherche déjà en cours…','err');return;}

  const ville = (g('sVille')?.value||'').trim() || 'Arras';
  const pMin = g('sPrixMin')?.value || '';
  const pMax = g('sPrixMax')?.value || '300000';
  const type = g('sType')?.value || '';
  const sMin = g('sSurfMin')?.value || '';

  searchInProgress = true;
  const prog = g('searchProgress');
  const bar = g('searchBar');
  const btn = g('btnSearch');
  prog.style.display = 'block';
  btn.disabled = true;
  btn.innerHTML = '⏳ Recherche en cours…';
  bar.style.width = '15%';
  showSkeletons(8);

  const progressSteps = [
    [20, 'Recherche sur Leboncoin…'],
    [40, 'Recherche sur SeLoger…'],
    [55, 'Recherche sur Bien\'ici, PAP…'],
    [70, 'Extraction des données…'],
    [85, 'Analyse des annonces…'],
    [95, 'Calcul des indicateurs…'],
  ];
  let stepIdx = 0;
  const stepInterval = setInterval(()=>{
    if(stepIdx < progressSteps.length){
      bar.style.width = progressSteps[stepIdx][0]+'%';
      g('searchProgressText').textContent = progressSteps[stepIdx][1];
      stepIdx++;
    }
  }, 2500);

  const prompt = `Tu es un assistant spécialisé en immobilier français. Cherche sur le web des annonces immobilières à vendre dans ou autour de "${ville}" ${pMin?'à partir de '+pMin+'€':''} ${pMax?'jusqu\'à '+pMax+'€':''} ${type?'de type '+type:''} ${sMin?'surface min '+sMin+'m²':''}.

Utilise la recherche web pour trouver des annonces RÉELLES actuellement en ligne sur leboncoin, seloger, bienici, pap, logic-immo ou autres sites immobiliers.

Pour chaque annonce trouvée (trouve-en au moins 6, idéalement 10+), extrais les données et réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks, pas de texte avant/après) :

[
  {
    "title": "titre descriptif court",
    "prix": nombre entier,
    "surface": nombre en m2,
    "pieces": nombre,
    "type": "Studio|Appartement|Maison|Immeuble|Local commercial|Parking",
    "ville": "nom ville",
    "cp": "code postal",
    "dpe": "A à G ou vide",
    "loyerActuel": 0,
    "loyerEstime": nombre estimé basé sur le marché local,
    "taxeFonciere": estimation ou 0,
    "chargesCopro": estimation annuelle ou 0,
    "travaux": estimation ou 0,
    "locataireEnPlace": false,
    "description": "description courte avec les infos clés",
    "source": "leboncoin|seloger|bienici|pap|logicimmo",
    "url": "URL réelle de l'annonce si disponible"
  }
]

IMPORTANT: Ne renvoie QUE du JSON valide. Pas de commentaire, pas de markdown.`;

  try {
    const text = await callClaudeAPI(prompt, true, 4000);
    bar.style.width = '90%';

    // Try to parse JSON from the response
    let parsed = [];
    try {
      // Find JSON array in the text
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if(jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch(e2){
      console.warn('JSON parse failed, trying line-by-line', e2);
    }

    if(parsed.length > 0){
      bar.style.width = '100%';
      g('searchProgressText').textContent = `${parsed.length} annonces trouvées !`;

      parsed.forEach((p,i) => {
        p.id = 'web_' + Date.now() + '_' + i;
        p.source = p.source || 'web';
        p.date = new Date().toISOString().slice(0,10);
        p.img = '';
        p.loyerEstime = p.loyerEstime || estimateRent(p);
        analyzeListingLocal(p);
      });

      // Merge with existing
      const existingIds = new Set(listings.map(l=>l.title));
      parsed.filter(p=>!existingIds.has(p.title)).forEach(p=>listings.push(p));
      filteredListings = [...listings];
      filterListings();
      toast(`${parsed.length} annonces trouvées via recherche web ✓`, 'ok');
    } else {
      throw new Error('No listings found');
    }

  } catch(e) {
    console.error('Search error:', e);
    bar.style.width = '100%';
    const errMsg = e.message || '';
    let userMsg = '';
    if(errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('Load failed')){
      userMsg = '⚠ Requête bloquée (CORS). Dans Claude.ai : fonctionne sans clé. En local : entrez votre clé API dans les filtres.';
    } else if(errMsg.includes('invalid') || errMsg.includes('401') || errMsg.includes('authentication')){
      userMsg = '⚠ Clé API invalide ou manquante. Configurez votre clé dans les filtres → 🔑 Clé API Claude.';
    } else if(errMsg.includes('overloaded') || errMsg.includes('529')){
      userMsg = '⚠ API surchargée. Réessayez dans quelques secondes.';
    } else {
      userMsg = '⚠ Erreur API : ' + errMsg;
    }
    g('searchProgressText').textContent = userMsg;
    toast(userMsg, 'err');
    addNotif('Recherche échouée — ' + (errMsg||'erreur réseau'), 'info');

    // Fallback: load demo
    if(!listings.length) loadDemoListings();
  } finally {
    clearInterval(stepInterval);
    searchInProgress = false;
    btn.disabled = false;
    btn.innerHTML = '🔍 Rechercher des annonces';
    setTimeout(()=>{ prog.style.display='none'; }, 2000);
  }
}

// Estimate rent if not provided
function estimateRent(l){
  const city = (l.ville||'').toLowerCase();
  // Average rent per m² estimates for northern France
  const rates = {'lille':12,'arras':9,'lens':8,'douai':8,'valenciennes':8,'bethune':7.5,'saint-omer':7,'lievin':7,'henin':7.5,'calais':7};
  let rate = 8; // default
  for(const[k,v] of Object.entries(rates)){
    if(city.includes(k)){rate=v;break;}
  }
  return Math.round(l.surface * rate);
}

// ── ANALYSE LOCALE (sans IA) ─────────────────────────────────
function analyzeListingLocal(l){
  const loyer = l.loyerActuel || l.loyerEstime || 0;
  const loyerAn = loyer * 12;
  const coutTotal = l.prix + (l.travaux||0) + Math.round(l.prix*0.085);
  const rentBrute = coutTotal > 0 ? (loyerAn / coutTotal)*100 : 0;
  const charges = (l.taxeFonciere||0) + (l.chargesCopro||0);
  const rentNette = coutTotal > 0 ? ((loyerAn - charges) / coutTotal)*100 : 0;
  // Estimation mensualité 20 ans 3.5%
  const emp = coutTotal - Math.round(coutTotal*0.1);
  const t = 0.035/12, n = 240;
  const mens = t > 0 ? emp * (t*Math.pow(1+t,n))/(Math.pow(1+t,n)-1) : emp/n;
  const cfMensuel = loyer - mens - charges/12;
  const prixM2 = l.surface > 0 ? l.prix / l.surface : 0;

  // Score investisseur (0-100)
  let score = 0;
  score += Math.min(30, rentBrute * 3.5);
  score += cfMensuel > 0 ? Math.min(25, cfMensuel / 10) : Math.max(-10, cfMensuel / 20);
  score += l.locataireEnPlace ? 10 : 0;
  const dpeS = {A:10,B:9,C:7,D:5,E:3,F:1,G:0};
  score += dpeS[l.dpe] || 4;
  score += prixM2 < 1500 ? 10 : prixM2 < 2500 ? 6 : prixM2 < 3500 ? 3 : 0;
  score += (l.travaux||0) === 0 ? 8 : (l.travaux||0) < 10000 ? 4 : 0;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict = 'caution';
  if(score >= 65) verdict = 'good';
  else if(score < 40) verdict = 'avoid';

  const verdictLabel = {good:'✓ Bonne affaire',caution:'⚠ Prudence',avoid:'✗ À écarter'};

  Object.assign(l, {
    loyer, loyerAn, coutTotal, rentBrute, rentNette, charges, mens, cfMensuel, prixM2, score, verdict,
    verdictLabel: verdictLabel[verdict],
    notaire: Math.round(l.prix * 0.085),
    emp
  });
  // Track price history (for repeated imports of same id)
  if(typeof trackPrice === 'function') trackPrice(l);
}

// ── RENDER LISTINGS ──────────────────────────────────────────
function renderListings(){
  const grid = g('aggGrid');
  const list = filteredListings;
  g('aggCount').textContent = list.length + ' annonce(s)';

  // Stats bar
  const statsEl = g('aggStats');
  if(!list.length){
    if(statsEl) statsEl.style.display='none';
    grid.innerHTML = '<div class="nodata" style="grid-column:1/-1"><span class="ico">🏘</span><h3>Aucun résultat</h3><p>Modifiez vos filtres ou importez des annonces.</p></div>';
    return;
  }

  if(statsEl && list.length > 0){
    const avgPrix = list.reduce((s,l)=>s+l.prix,0)/list.length;
    const avgRent = list.reduce((s,l)=>s+l.rentBrute,0)/list.length;
    const avgCF = list.reduce((s,l)=>s+l.cfMensuel,0)/list.length;
    const avgScore = list.reduce((s,l)=>s+l.score,0)/list.length;
    const bonnes = list.filter(l=>l.verdict==='good').length;
    statsEl.style.display='grid';
    statsEl.innerHTML=`
      <div class="agg-stat"><div class="as-val gold">${list.length}</div><div class="as-lbl">Annonces</div></div>
      <div class="agg-stat"><div class="as-val gold">${eur(avgPrix,0)}</div><div class="as-lbl">Prix moyen</div></div>
      <div class="agg-stat"><div class="as-val pos">${avgRent.toFixed(1)}%</div><div class="as-lbl">Rent. moy.</div></div>
      <div class="agg-stat"><div class="as-val ${avgCF>=0?'pos':'neg'}">${avgCF>=0?'+':''}${Math.round(avgCF)} €</div><div class="as-lbl">CF moyen</div></div>
      <div class="agg-stat"><div class="as-val" style="color:var(--em)">${bonnes}</div><div class="as-lbl">Bonnes affaires</div></div>
    `;
  }

  grid.innerHTML = list.map(l => {
    const inShort = shortlist.some(s=>s.id===l.id);
    const scCol = l.score>=65?'var(--em)':l.score>=40?'var(--am)':'var(--ru)';
    const srcC = {leboncoin:'#F56B2A',seloger:'#E00034',bienici:'#6C5CE7',pap:'#00B894',logicimmo:'#0984E3'};
    return `
    <div class="lcard" onclick="openDetail('${l.id}')">
      <div class="lcard-img">
        ${l.img?`<img src="${l.img}" alt="" loading="lazy" onerror="this.style.display='none'"/>`:'<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--ink4);font-size:2.5rem">🏠</div>'}
        <span class="lcard-src" style="background:${srcC[l.source]||'rgba(0,0,0,.7)'}">${l.source}</span>
        <button class="shortlist-star ${inShort?'active':''}" onclick="event.stopPropagation();toggleShort('${l.id}')" title="Shortlist">${inShort?'★':'☆'}</button>
      </div>
      <div class="lcard-body">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="lcard-price">${eur(l.prix,0)}</div><span style="display:flex;gap:5px;align-items:center"><span style="font-size:.67rem;color:var(--ink3)">${eur(l.prixM2,0)}/m²</span>${getMatchBadgeHTML(l)}</span></div>
        <div class="lcard-title">${l.title}</div>
        <div class="lcard-meta">
          <span class="lcard-tag">${l.type||'Bien'}</span>
          <span class="lcard-tag">${l.surface} m²</span>
          ${l.pieces?`<span class="lcard-tag">${l.pieces} p.</span>`:''}
          <span class="lcard-tag">📍 ${l.ville}</span>
          ${l.dpe?`<span class="lcard-tag">DPE ${l.dpe}</span>`:''}
          ${l.locataireEnPlace?'<span class="lcard-tag" style="color:var(--em);background:var(--em-a)">✓ Loué</span>':''}
        </div>
        <div class="lcard-kpis">
          <div class="lcard-kpi"><div class="k-val gold">${l.rentBrute.toFixed(1)}%</div><div class="k-lbl">Rent. brute</div></div>
          <div class="lcard-kpi"><div class="k-val ${l.cfMensuel>=0?'pos':'neg'}">${l.cfMensuel>=0?'+':''}${Math.round(l.cfMensuel)} €</div><div class="k-lbl">Cash-flow</div></div>
          <div class="lcard-kpi"><div class="k-val" style="color:${scCol}">${l.score}/100</div><div class="k-lbl">Score</div></div>
        </div>
        <div class="lcard-actions">
          <button class="btn btn-p btn-sm" onclick="event.stopPropagation();openDetail('${l.id}')">📊 Détail</button>
          <button class="btn btn-b btn-sm" onclick="event.stopPropagation();sendToSimulator('${l.id}')">→ Simul.</button>
          ${l.url&&l.url!=='#'?`<a class="btn btn-g btn-sm" href="${l.url}" target="_blank" onclick="event.stopPropagation()">↗</a>`:`<button class="btn btn-g btn-sm" onclick="event.stopPropagation();generateReport('${l.id}')">📄</button>`}
        </div>
      </div>
      <div class="lcard-verdict ${l.verdict}">${l.verdictLabel}</div>
    </div>`;
  }).join('');
}

// ── FILTRES ──────────────────────────────────────────────────
function filterListings(){
  const ville = (g('sVille')?.value||'').toLowerCase().trim();
  const pMin = parseFloat(g('sPrixMin')?.value)||0;
  const pMax = parseFloat(g('sPrixMax')?.value)||Infinity;
  const sMin = parseFloat(g('sSurfMin')?.value)||0;
  const sMax = parseFloat(g('sSurfMax')?.value)||Infinity;
  const type = g('sType')?.value||'';
  const pieces = parseFloat(g('sPieces')?.value)||0;
  const rendMin = parseFloat(g('sRendMin')?.value)||0;
  const dpeMax = g('sDPE')?.value||'';
  const source = g('sSource')?.value||'';
  const locataire = g('sLocataire')?.checked;
  const travaux = g('sTravaux')?.checked;
  const coloc = g('sColoc')?.checked;
  const immeuble = g('sImmeuble')?.checked;
  const dpeOrd = 'ABCDEFG';

  filteredListings = listings.filter(l => {
    if(ville && !l.ville.toLowerCase().includes(ville) && !(l.cp||'').includes(ville)) return false;
    if(l.prix < pMin || l.prix > pMax) return false;
    if(l.surface < sMin || l.surface > sMax) return false;
    if(type && l.type !== type) return false;
    if(l.pieces < pieces) return false;
    if(rendMin && l.rentBrute < rendMin) return false;
    if(dpeMax && l.dpe && dpeOrd.indexOf(l.dpe) > dpeOrd.indexOf(dpeMax)) return false;
    if(source && l.source !== source) return false;
    if(locataire && !l.locataireEnPlace) return false;
    if(travaux && !(l.travaux > 0)) return false;
    if(coloc && !l.colocPossible) return false;
    if(immeuble && l.type !== 'Immeuble') return false;
    return true;
  });
  // Save to search history if filters are non-trivial
  if(ville || pMin || pMax<Infinity || type || rendMin){
    saveSearchToHist({ville:g('sVille')?.value||'',prixMin:pMin||null,prixMax:pMax<Infinity?pMax:null,type,surfMin:sMin||null,rendMin:rendMin||null});
  }
  sortListings();
}

function resetFilters(){
  ['sVille','sPrixMin','sPrixMax','sSurfMin','sSurfMax','sPieces','sRendMin'].forEach(id=>{if(g(id))g(id).value=''});
  ['sType','sDPE','sSource','sRayon'].forEach(id=>{if(g(id))g(id).selectedIndex=0});
  ['sLocataire','sTravaux','sColoc','sImmeuble'].forEach(id=>{if(g(id))g(id).checked=false});
  filteredListings=[...listings];
  renderListings();
}

function sortListings(){
  const s = g('aggSort')?.value||'score';
  const cmp = {
    'score':(a,b)=>b.score-a.score,
    'prix-asc':(a,b)=>a.prix-b.prix,
    'prix-desc':(a,b)=>b.prix-a.prix,
    'renta':(a,b)=>b.rentBrute-a.rentBrute,
    'cashflow':(a,b)=>b.cfMensuel-a.cfMensuel,
    'surface':(a,b)=>b.surface-a.surface,
    'prixm2':(a,b)=>a.prixM2-b.prixM2,
    'date':(a,b)=>(b.date||'').localeCompare(a.date||''),
  };
  filteredListings.sort(cmp[s]||(()=>0));
  renderListings();
}

// ── SHORTLIST ────────────────────────────────────────────────
function toggleShort(id){
  const idx = shortlist.findIndex(s=>s.id===id);
  if(idx>=0){ shortlist.splice(idx,1); toast('Retiré de la shortlist'); }
  else { const l=listings.find(x=>x.id===id); if(l){shortlist.push(l);toast('Ajouté à la shortlist ⭐','ok');} }
  g('shortBadge').textContent=shortlist.length;
  renderListings();
  saveShortlistLS();
}

function clearShortlist(){shortlist=[];g('shortBadge').textContent=0;renderShortlist();renderListings();saveShortlistLS();}

function saveShortlistLS(){try{localStorage.setItem('immoV9_shortlist',JSON.stringify(shortlist.map(s=>s.id)))}catch(e){}}
function loadShortlistLS(){try{const ids=JSON.parse(localStorage.getItem('immoV9_shortlist')||'[]');shortlist=listings.filter(l=>ids.includes(l.id));g('shortBadge').textContent=shortlist.length}catch(e){}}

function renderShortlist(){
  const el = g('shortlistContent');
  if(!shortlist.length){
    el.innerHTML='<div class="nodata"><span class="ico">⭐</span><h3>Shortlist vide</h3><p>Ajoutez des annonces depuis la vue Recherche en cliquant sur ⭐</p></div>';
    return;
  }
  let h = '<div style="margin-bottom:18px"><div class="portf-totals" style="grid-template-columns:repeat(4,1fr)">';
  const avgRent = shortlist.reduce((s,l)=>s+l.rentBrute,0)/shortlist.length;
  const avgScore = shortlist.reduce((s,l)=>s+l.score,0)/shortlist.length;
  const totalPrix = shortlist.reduce((s,l)=>s+l.prix,0);
  const avgCF = shortlist.reduce((s,l)=>s+l.cfMensuel,0)/shortlist.length;
  h+=`<div class="pt-kpi"><div class="tl">Biens</div><div class="tv gold">${shortlist.length}</div></div>`;
  h+=`<div class="pt-kpi"><div class="tl">Budget total</div><div class="tv gold">${eur(totalPrix,0)}</div></div>`;
  h+=`<div class="pt-kpi"><div class="tl">Rent. moy.</div><div class="tv pos">${avgRent.toFixed(1)}%</div></div>`;
  h+=`<div class="pt-kpi"><div class="tl">CF moyen</div><div class="tv ${avgCF>=0?'pos':'neg'}">${Math.round(avgCF)} €</div></div>`;
  h+='</div></div>';

  h+='<div class="compare-grid">';
  shortlist.forEach(l=>{
    const scCol=l.score>=65?'var(--em)':l.score>=40?'var(--am)':'var(--ru)';
    h+=`<div class="compare-card">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <h4>${l.title}</h4>
        <button class="btn btn-d btn-sm" onclick="toggleShort('${l.id}');renderShortlist()">✕</button>
      </div>
      <div class="compare-row"><span class="l">Prix</span><span class="v" style="color:var(--gold)">${eur(l.prix,0)}</span></div>
      <div class="compare-row"><span class="l">Surface</span><span class="v">${l.surface} m²</span></div>
      <div class="compare-row"><span class="l">Prix/m²</span><span class="v">${eur(l.prixM2,0)}</span></div>
      <div class="compare-row"><span class="l">Loyer</span><span class="v">${eur(l.loyer,0)}/mois</span></div>
      <div class="compare-row"><span class="l">Rent. brute</span><span class="v" style="color:var(--gold)">${l.rentBrute.toFixed(1)}%</span></div>
      <div class="compare-row"><span class="l">Rent. nette</span><span class="v">${l.rentNette.toFixed(1)}%</span></div>
      <div class="compare-row"><span class="l">Cash-flow</span><span class="v" style="color:${l.cfMensuel>=0?'var(--em)':'var(--ru)'}">${Math.round(l.cfMensuel)} €/mois</span></div>
      <div class="compare-row"><span class="l">Charges/an</span><span class="v">${eur(l.charges,0)}</span></div>
      <div class="compare-row"><span class="l">Travaux</span><span class="v">${eur(l.travaux||0,0)}</span></div>
      <div class="compare-row"><span class="l">DPE</span><span class="v">${l.dpe||'—'}</span></div>
      <div class="compare-row"><span class="l">Score</span><span class="v" style="color:${scCol}">${l.score}/100</span></div>
      <div class="compare-row"><span class="l">Verdict</span><span class="v">${l.verdictLabel}</span></div>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn btn-p btn-sm" style="flex:1" onclick="openDetail('${l.id}')">📊 Détail</button>
        <button class="btn btn-b btn-sm" style="flex:1" onclick="sendToSimulator('${l.id}')">→ Simul.</button>
      </div>
    </div>`;
  });
  h+='</div>';
  el.innerHTML=h;
}

// ── DETAIL MODAL ─────────────────────────────────────────────
function openDetail(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  currentDetail = l;
  const scCol=l.score>=65?'var(--em)':l.score>=40?'var(--am)':'var(--ru)';

  g('detailHeaderContent').innerHTML=`
    <div style="font-family:'Libre Baskerville',serif;font-size:1.2rem;font-weight:700;color:var(--gold);margin-bottom:4px">${eur(l.prix,0)}</div>
    <div style="font-size:.88rem;font-weight:600;color:var(--ink);margin-bottom:6px">${l.title}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <span class="lcard-tag">${l.source}</span>
      <span class="lcard-tag">${l.type} · ${l.surface}m² · ${l.pieces}p.</span>
      <span class="lcard-tag">${l.ville} ${l.cp||''}</span>
      ${l.dpe?`<span class="lcard-tag">DPE ${l.dpe}</span>`:''}
      <span class="lcard-tag" style="color:${scCol};font-weight:700">Score ${l.score}/100</span>
      ${getMatchBadgeHTML(l)}
    </div>`;

  let body = '<div class="detail-cols">';

  // Col 1: Données brutes
  body += '<div>';
  body += '<div class="detail-section"><h4>📋 Données de l\'annonce</h4>';
  body += `<div class="rc gold"><span class="rl">Prix</span><span class="rv">${eur(l.prix,0)}</span></div>`;
  body += `<div class="rc"><span class="rl">Surface</span><span class="rv">${l.surface} m²</span></div>`;
  body += `<div class="rc"><span class="rl">Prix au m²</span><span class="rv">${eur(l.prixM2,0)}</span></div>`;
  body += `<div class="rc"><span class="rl">Pièces</span><span class="rv">${l.pieces}</span></div>`;
  if(l.dpe) body += `<div class="rc"><span class="rl">DPE</span><span class="rv">${l.dpe}</span></div>`;
  body += `<div class="rc"><span class="rl">Loyer ${l.loyerActuel?'actuel':'estimé'}</span><span class="rv">${eur(l.loyer,0)}/mois</span></div>`;
  body += getMarketRentHTML(l);
  body += `<div class="rc"><span class="rl">Taxe foncière</span><span class="rv">${eur(l.taxeFonciere||0,0)}/an</span></div>`;
  body += `<div class="rc"><span class="rl">Charges copro</span><span class="rv">${eur(l.chargesCopro||0,0)}/an</span></div>`;
  body += `<div class="rc"><span class="rl">Travaux estimés</span><span class="rv">${eur(l.travaux||0,0)}</span></div>`;
  body += `<div class="rc"><span class="rl">Locataire en place</span><span class="rv">${l.locataireEnPlace?'✓ Oui':'✗ Non'}</span></div>`;
  body += '</div>';

  // Description
  body += '<div class="detail-section"><h4>📝 Description</h4>';
  body += `<p style="font-size:.76rem;color:var(--ink2);line-height:1.6">${l.description||'Aucune description disponible.'}</p>`;
  body += '</div></div>';

  // Col 2: Analyse
  body += '<div>';
  body += '<div class="detail-section"><h4>📊 Analyse investisseur</h4>';
  body += `<div class="score-wrap"><div class="score-ring" style="border-color:${scCol};background:${scCol}18"><span class="sn2" style="color:${scCol}">${l.score}</span><span class="sm">/100</span></div>`;
  const sl=l.score>=70?{l:'Excellente opportunité',s:'Ce bien présente un profil très intéressant pour un investisseur.'}:l.score>=45?{l:'Investissement à étudier',s:'Potentiel correct mais certains points méritent attention.'}:{l:'Prudence recommandée',s:'Les indicateurs sont fragiles. Analyser attentivement les risques.'};
  body += `<div class="score-info" style="flex:1"><div class="sl" style="color:${scCol}">${sl.l}</div><div class="ss">${sl.s}</div></div></div>`;

  body += `<div class="rc gold"><span class="rl">Coût total projet</span><span class="rv">${eur(l.coutTotal,0)}</span></div>`;
  body += `<div class="rc"><span class="rl">Frais de notaire (~8.5%)</span><span class="rv">${eur(l.notaire,0)}</span></div>`;
  body += `<div class="rc gold"><span class="rl">Rentabilité brute</span><span class="rv">${l.rentBrute.toFixed(2)}%</span></div>`;
  body += `<div class="rc gold"><span class="rl">Rentabilité nette</span><span class="rv">${l.rentNette.toFixed(2)}%</span></div>`;
  body += `<div class="rc ${l.cfMensuel>=0?'pos':'neg'}"><span class="rl">Cash-flow mensuel</span><span class="rv">${l.cfMensuel>=0?'+':''}${Math.round(l.cfMensuel)} €</span></div>`;
  body += `<div class="rc"><span class="rl">Mensualité estimée (20a/3.5%)</span><span class="rv">${eur(l.mens)}/mois</span></div>`;
  body += '</div>';

  // AI Analysis zone
  body += `<div class="detail-section"><h4>✦ Analyse IA</h4>
    <div class="ai-analysis" id="aiAnalysis_${l.id}">
      ${l.aiAnalysis ? renderAIAnalysis(l.aiAnalysis) : `
        <div style="text-align:center;padding:14px">
          <p style="font-size:.76rem;color:var(--ink3);margin-bottom:10px">Lancez l'analyse IA pour obtenir un résumé intelligent, points forts/faibles, alertes et recommandations.</p>
          <button class="btn btn-p" onclick="runAIAnalysis('${l.id}')">✦ Lancer l'analyse IA</button>
        </div>`}
    </div>
  </div>`;

  body += '</div></div>'; // close cols

  // What-If simulator
  body += `
  <div class="whatif-box">
    <div class="whatif-title">🎯 Simulation "Et si je négociais ?"</div>
    <div class="whatif-slider">
      <label>Négociation du prix <span class="wi-val" id="wi_negoVal_${l.id}">0%</span></label>
      <input type="range" id="wi_nego_${l.id}" min="0" max="25" value="0" step="1" oninput="updateWhatIf('${l.id}')"/>
      <div class="wi-scale"><span>0%</span><span>-5%</span><span>-10%</span><span>-15%</span><span>-20%</span><span>-25%</span></div>
    </div>
    <div class="whatif-slider">
      <label>Loyer négocié / optimisé <span class="wi-val" id="wi_loyerVal_${l.id}">${eur(l.loyer,0)}/mois</span></label>
      <input type="range" id="wi_loyer_${l.id}" min="${Math.max(100,Math.round(l.loyer*0.7))}" max="${Math.round(l.loyer*1.5)}" value="${Math.round(l.loyer)}" step="10" oninput="updateWhatIf('${l.id}')"/>
    </div>
    <div class="whatif-slider">
      <label>Travaux réels <span class="wi-val" id="wi_travVal_${l.id}">${eur(l.travaux||0,0)}</span></label>
      <input type="range" id="wi_trav_${l.id}" min="0" max="${Math.max(50000,(l.travaux||0)*2)}" value="${l.travaux||0}" step="500" oninput="updateWhatIf('${l.id}')"/>
    </div>
    <div class="whatif-impact" id="wi_impact_${l.id}"></div>
  </div>`;

  // DVF section (placeholder, loaded async)
  body += `
  <div class="dvf-section" id="dvfSection_${l.id}">
    <div class="dvf-title">📊 Transactions réelles du secteur (DVF)</div>
    <div class="dvf-loading">⏳ Chargement des données DVF...</div>
  </div>`;

  // Négociation assistée + Quartier (lazy IA)
  body += `
  <div class="nego-box" id="negoBox_${l.id}">
    <div class="nego-title">💬 Négociation assistée par IA</div>
    <p style="font-size:.73rem;color:var(--ink3);margin-bottom:10px">Obtenez un argumentaire de négociation personnalisé basé sur les points faibles du bien et les prix du marché.</p>
    <button class="btn btn-p" onclick="runNegoAI('${l.id}')">🎯 Générer ma stratégie de négociation</button>
  </div>

  <div class="quartier-box" id="quartierBox_${l.id}">
    <div class="quartier-title">📍 Analyse du quartier</div>
    <p style="font-size:.73rem;color:var(--ink3);margin-bottom:10px">L'IA analyse commerces, transports, écoles, emploi et dynamique du secteur.</p>
    <button class="btn btn-b" onclick="runQuartierAI('${l.id}')">🏘 Analyser le quartier avec l'IA</button>
  </div>

  <div class="chat-section">
    <div class="chat-title">💬 Questions sur ce bien</div>
    <div class="chat-suggestions">
      <span class="chat-sug" onclick="chatListingAsk('${l.id}','Ce bien est-il une bonne affaire ?')">Bonne affaire ?</span>
      <span class="chat-sug" onclick="chatListingAsk('${l.id}','Quels sont les risques de ce bien ?')">Risques ?</span>
      <span class="chat-sug" onclick="chatListingAsk('${l.id}','Quel régime fiscal est le plus adapté ?')">Régime fiscal ?</span>
      <span class="chat-sug" onclick="chatListingAsk('${l.id}','Combien devrais-je négocier ?')">Négociation ?</span>
      <span class="chat-sug" onclick="chatListingAsk('${l.id}','Quels points vérifier en visite ?')">En visite ?</span>
      <span class="chat-sug" onclick="chatListingAsk('${l.id}','Ce loyer est-il cohérent avec le marché ?')">Loyer OK ?</span>
    </div>
    <div class="chat-messages" id="chatMsgs_${l.id}">
      <div class="chat-empty">Posez une question sur ce bien ou choisissez une suggestion ci-dessus</div>
    </div>
    <div class="chat-input-row">
      <input type="text" id="chatInput_${l.id}" placeholder="Posez votre question sur ce bien..." onkeydown="if(event.key==='Enter')chatListingSend('${l.id}')"/>
      <button class="btn btn-p" onclick="chatListingSend('${l.id}')">Envoyer</button>
    </div>
  </div>

  <details style="margin:14px 0;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r2);padding:12px">
    <summary style="font-size:.8rem;font-weight:700;color:var(--gold);cursor:pointer">📋 Checklist de visite (à cocher sur place)</summary>
    <div class="inspec-list" style="margin-top:10px">
      <div class="inspec-cat">
        <h5>⚡ Électricité & gaz</h5>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','elec1',this.checked)"/> Tableau électrique aux normes</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','elec2',this.checked)"/> Prises de terre partout</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','elec3',this.checked)"/> Chaudière/chauffage fonctionnel</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','elec4',this.checked)"/> Certificat gaz si concerné</label>
      </div>
      <div class="inspec-cat">
        <h5>💧 Plomberie & sanitaire</h5>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','plomb1',this.checked)"/> Pression d'eau correcte</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','plomb2',this.checked)"/> Aucune fuite visible</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','plomb3',this.checked)"/> Évacuations qui fonctionnent</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','plomb4',this.checked)"/> Ballon d'eau chaude en état</label>
      </div>
      <div class="inspec-cat">
        <h5>🏠 Structure & bâti</h5>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','struct1',this.checked)"/> Pas d'humidité / moisissures</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','struct2',this.checked)"/> Fissures non inquiétantes</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','struct3',this.checked)"/> Toiture en bon état</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','struct4',this.checked)"/> Fenêtres étanches (double vitrage ?)</label>
      </div>
      <div class="inspec-cat">
        <h5>🏘 Environnement</h5>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','env1',this.checked)"/> Voisinage calme</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','env2',this.checked)"/> Commerces à proximité</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','env3',this.checked)"/> Transports accessibles</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','env4',this.checked)"/> Pas de nuisances (bruit, odeurs)</label>
      </div>
      <div class="inspec-cat">
        <h5>📑 Administratif</h5>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','admin1',this.checked)"/> PV de la copro sur 3 ans</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','admin2',this.checked)"/> Diagnostics à jour (DPE, amiante, plomb)</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','admin3',this.checked)"/> Pas de travaux votés non provisionnés</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','admin4',this.checked)"/> Charges impayées du vendeur ?</label>
      </div>
      <div class="inspec-cat">
        <h5>💰 Négociation</h5>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','nego1',this.checked)"/> Prix médian du quartier vérifié</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','nego2',this.checked)"/> Défauts identifiés à exploiter</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','nego3',this.checked)"/> Urgence de vente ? (divorce, succession)</label>
        <label><input type="checkbox" onchange="saveInspec('${l.id}','nego4',this.checked)"/> Durée depuis la mise en vente</label>
      </div>
    </div>
  </details>`;

  // Price history (if available)
  body += getPriceHistHTML(l);

  // Action buttons
  const pipeStage = getPipelineStage(l.id);
  const pipeLabel = pipeStage ? PIPELINE_STAGES.find(s=>s.id===pipeStage.stage)?.label||'—' : null;
  body += `<div style="display:flex;gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid var(--bd);flex-wrap:wrap">
    <button class="btn btn-p" onclick="sendToSimulator('${l.id}')">📥 Simulateur</button>
    <button class="btn btn-b" onclick="generateReport('${l.id}')">📄 Rapport</button>
    <button class="btn btn-g" onclick="toggleShort('${l.id}');openDetail('${l.id}')">⭐ ${shortlist.some(s=>s.id===l.id)?'Retirer':'Shortlist'}</button>
    <button class="btn btn-g" onclick="openPipelineMenu('${l.id}',this)" style="position:relative">${pipeLabel||'📋 Pipeline'}</button>
  </div>`;

  g('detailBody').innerHTML = body;
  g('detailOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  // Initialize what-if with current values
  setTimeout(()=>{updateWhatIf(l.id);loadDVF(l);}, 50);
}

function closeDetail(){
  g('detailOverlay').classList.remove('open');
  document.body.style.overflow='';
}

// ── ANALYSE IA (Claude API) ──────────────────────────────────
async function runAIAnalysis(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  const el = g('aiAnalysis_'+id);
  if(!el) return;
  el.innerHTML='<div class="ai-loading"><div class="spinner"></div><br/>Analyse IA en cours…</div>';

  const prompt = `Tu es un expert en investissement immobilier locatif français. Analyse cette annonce et réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks):
{
  "resume": "résumé clair en 2-3 phrases",
  "points_forts": ["point 1", "point 2", "..."],
  "points_faibles": ["point 1", "..."],
  "alertes": ["alerte 1 si pertinent", "..."],
  "loyer_estime": nombre en euros/mois,
  "rentabilite_estimee": nombre en %,
  "cashflow_estime": nombre en euros/mois,
  "score_interet": nombre de 0 à 100,
  "verdict": "bonne_affaire" ou "prudence" ou "a_ecarter",
  "recommandation": "texte de recommandation finale en 2-3 phrases"
}

ANNONCE:
Titre: ${l.title}
Prix: ${l.prix} €
Surface: ${l.surface} m²
Pièces: ${l.pieces}
Type: ${l.type}
Ville: ${l.ville} (${l.cp||''})
DPE: ${l.dpe||'Non renseigné'}
Loyer actuel: ${l.loyerActuel||'Non loué'} €/mois
Loyer estimé: ${l.loyerEstime||'Non renseigné'} €/mois
Taxe foncière: ${l.taxeFonciere||'?'} €/an
Charges copro: ${l.chargesCopro||0} €/an
Travaux: ${l.travaux||0} €
Locataire en place: ${l.locataireEnPlace?'Oui':'Non'}
Description: ${l.description}`;

  try {
    const text = await callClaudeAPI(prompt, false, 1000);
    const clean = text.replace(/```json|```/g,'').trim();
    const analysis = JSON.parse(clean);
    l.aiAnalysis = analysis;
    el.innerHTML = renderAIAnalysis(analysis);
    toast('Analyse IA terminée ✓','ok');
  } catch(e) {
    // Fallback: local analysis
    const analysis = {
      resume: `${l.type} de ${l.surface}m² à ${l.ville} pour ${eur(l.prix,0)}. ${l.locataireEnPlace?'Locataire en place — sécurité de revenus.':'Bien vacant — à louer.'} ${l.travaux>10000?'Travaux significatifs à prévoir.':'Peu ou pas de travaux.'}`,
      points_forts: [
        l.rentBrute>7?'Rentabilité brute attractive (>7%)':l.rentBrute>5?'Rentabilité correcte':'',
        l.locataireEnPlace?'Locataire en place — revenus immédiats':'',
        l.prixM2<1500?'Prix au m² très compétitif':'',
        (l.dpe==='A'||l.dpe==='B'||l.dpe==='C')?'Bon DPE — pas de travaux énergétiques urgents':'',
        (l.travaux||0)===0?'Aucun travaux à prévoir':'',
      ].filter(Boolean),
      points_faibles: [
        l.rentBrute<5?'Rentabilité brute faible (<5%)':'',
        (l.dpe==='F'||l.dpe==='G')?'DPE défavorable — interdiction de location à terme':'',
        l.travaux>20000?'Budget travaux important':'',
        l.cfMensuel<0?'Cash-flow négatif — effort d\'épargne mensuel':'',
      ].filter(Boolean),
      alertes: [
        (l.dpe==='G')?'⚠ DPE G : interdiction de location depuis 2025':'',
        (l.dpe==='F')?'⚠ DPE F : interdiction de location prévue en 2028':'',
        l.cfMensuel<-200?'⚠ Cash-flow très négatif — risque financier':'',
      ].filter(Boolean),
      loyer_estime: l.loyer,
      rentabilite_estimee: parseFloat(l.rentBrute.toFixed(1)),
      cashflow_estime: Math.round(l.cfMensuel),
      score_interet: l.score,
      verdict: l.verdict==='good'?'bonne_affaire':l.verdict==='avoid'?'a_ecarter':'prudence',
      recommandation: l.score>=65?'Ce bien présente un bon profil investisseur avec des fondamentaux solides. Vérifiez les éléments sur place et négociez si possible.':l.score>=40?'Investissement à étudier attentivement. Certains indicateurs méritent d\'être validés avant de s\'engager.':'Les indicateurs sont fragiles. Nous recommandons de passer à d\'autres opportunités sauf si des éléments non visibles dans l\'annonce changent l\'analyse.'
    };
    l.aiAnalysis = analysis;
    el.innerHTML = renderAIAnalysis(analysis);
    toast('Analyse locale générée (API indisponible)','');
  }
}

function renderAIAnalysis(a){
  const verdictColors = {bonne_affaire:'var(--em)',prudence:'var(--am)',a_ecarter:'var(--ru)'};
  const verdictLabels = {bonne_affaire:'✓ Bonne affaire',prudence:'⚠ Prudence',a_ecarter:'✗ À écarter'};
  let h = '<div class="ai-badge">✦ Analysé par IA</div>';
  h += `<div class="ai-summary">${a.resume}</div>`;

  if(a.points_forts?.length){
    h += '<div class="ai-points">';
    a.points_forts.forEach(p=>{ h+=`<div class="ai-point pro">✓ ${p}</div>`; });
    h += '</div>';
  }
  if(a.points_faibles?.length){
    h += '<div class="ai-points">';
    a.points_faibles.forEach(p=>{ h+=`<div class="ai-point con">✗ ${p}</div>`; });
    h += '</div>';
  }
  if(a.alertes?.length){
    h += '<div class="ai-points">';
    a.alertes.forEach(p=>{ h+=`<div class="ai-point alert">⚠ ${p}</div>`; });
    h += '</div>';
  }

  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">
    <div class="rc gold"><span class="rl">Rent. estimée</span><span class="rv">${a.rentabilite_estimee}%</span></div>
    <div class="rc ${a.cashflow_estime>=0?'pos':'neg'}"><span class="rl">CF estimé</span><span class="rv">${a.cashflow_estime>=0?'+':''}${a.cashflow_estime} €</span></div>
  </div>`;

  h += `<div class="rec-box" style="margin-top:10px;background:${verdictColors[a.verdict]}18;border-color:${verdictColors[a.verdict]}44">
    <strong style="color:${verdictColors[a.verdict]}">${verdictLabels[a.verdict]||a.verdict}</strong><br/>
    <span style="font-size:.73rem">${a.recommandation}</span>
  </div>`;

  return h;
}

// ── IMPORT & ANALYSE ─────────────────────────────────────────
async function importAndAnalyze(){
  const text = g('importText')?.value?.trim();
  if(!text){ toast('Collez le texte d\'une annonce','err'); return; }

  const id = 'imp_' + Date.now();
  const prompt = `Tu es un expert immobilier. Extrais les informations de cette annonce et réponds UNIQUEMENT en JSON valide (pas de markdown):
{
  "title": "titre court",
  "prix": nombre,
  "surface": nombre en m2,
  "pieces": nombre,
  "type": "Studio|Appartement|Maison|Immeuble|Local commercial|Parking",
  "ville": "nom ville",
  "cp": "code postal",
  "dpe": "A à G ou null",
  "loyerActuel": nombre ou 0,
  "loyerEstime": nombre estimé,
  "taxeFonciere": nombre ou 0,
  "chargesCopro": nombre annuel ou 0,
  "travaux": nombre estimé ou 0,
  "locataireEnPlace": true/false,
  "description": "description résumée",
  "source": "manual"
}

TEXTE DE L'ANNONCE:
${text}`;

  toast('Extraction IA en cours…');

  try {
    const raw = await callClaudeAPI(prompt, false, 1000);
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
    parsed.id = id;
    parsed.source = parsed.source || 'manual';
    parsed.img = '';
    parsed.date = new Date().toISOString().slice(0,10);
    analyzeListingLocal(parsed);
    listings.unshift(parsed);
    filteredListings = [...listings];
    renderListings();
    g('importText').value='';
    toast('Annonce importée et analysée ✓','ok');
  } catch(e){
    // Fallback: basic parsing
    const l = {id, source:'manual', title:'Import manuel',
      prix:parseInt((text.match(/(\d[\d\s]*)\s*€/)||[])[1]?.replace(/\s/g,''))||0,
      surface:parseInt((text.match(/(\d+)\s*m[²2]/)||[])[1])||0,
      pieces:parseInt((text.match(/(\d+)\s*pi[èe]ce/)||[])[1])||1,
      type:'Appartement', ville:'—', cp:'', dpe:'',
      loyerActuel:0, loyerEstime:0, taxeFonciere:0, chargesCopro:0,
      travaux:0, locataireEnPlace:false,
      description:text.substring(0,500), img:'', date:new Date().toISOString().slice(0,10)
    };
    analyzeListingLocal(l);
    listings.unshift(l);
    filteredListings=[...listings];
    renderListings();
    g('importText').value='';
    toast('Import basique (API indisponible) — complétez manuellement','');
  }
}

function toggleImportZone(){
  const z=g('importZone');
  z.style.display=z.style.display==='none'?'block':'none';
}

// ── ENVOYER AU SIMULATEUR ────────────────────────────────────
function sendToSimulator(id){
  const l=listings.find(x=>x.id===id);
  if(!l)return;
  sv('prixAchat', l.prix);
  sv('surface', l.surface);
  sv('ville', l.ville);
  sv('typeBien', l.type==='Appartement'?'T'+l.pieces:l.type);
  if(l.dpe) sv('dpe', l.dpe);
  sv('travaux', l.travaux||0);
  sv('loyerMensuel', l.loyer);
  sv('taxeFonc', l.taxeFonciere||0);
  sv('chargesCopro', l.chargesCopro||0);
  autoNotaire();
  lv();
  closeDetail();
  gv('sim');
  toast('Données importées dans le simulateur ✓','ok');
}

// ── RAPPORT INDIVIDUEL ───────────────────────────────────────
function generateReport(id){
  const l=listings.find(x=>x.id===id);
  if(!l)return;
  const scCol=l.score>=65?'#2ECC71':l.score>=40?'#F39C12':'#E74C3C';
  const ai = l.aiAnalysis || {};

  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Rapport — ${l.title}</title>
  <style>
    body{font-family:'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:30px;color:#222;line-height:1.6}
    h1{color:#96680e;border-bottom:3px solid #96680e;padding-bottom:8px;font-size:1.5rem}
    h2{color:#555;font-size:1.1rem;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:5px}
    .kpi-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:16px 0}
    .kpi{background:#f8f5f0;border:1px solid #e4ddd1;border-radius:8px;padding:12px;text-align:center}
    .kpi .val{font-size:1.3rem;font-weight:700;color:#96680e}
    .kpi .lbl{font-size:.75rem;color:#777;margin-top:2px}
    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:.88rem}
    .row .l{color:#777}.row .v{font-weight:600}
    .verdict{padding:12px 16px;border-radius:8px;font-weight:700;margin:16px 0;font-size:.95rem}
    .good{background:#d5f5e3;color:#1a7a4a}.caution{background:#fef3c7;color:#92610e}.avoid{background:#fdeded;color:#c0392b}
    .points{margin:8px 0}.point{padding:4px 8px;margin:3px 0;border-radius:4px;font-size:.82rem}
    .pro{background:#d5f5e3;color:#1a7a4a}.con{background:#fdeded;color:#c0392b}.alert{background:#fef3c7;color:#92610e}
    .footer{margin-top:30px;padding-top:12px;border-top:2px solid #96680e;font-size:.72rem;color:#aaa;text-align:center}
    @media print{body{padding:15px}}
  </style></head><body>
  <h1>📊 Rapport d'investissement — ImmoSim V9</h1>
  <p style="color:#777;font-size:.85rem">Généré le ${new Date().toLocaleDateString('fr-FR')} · Source : ${l.source}</p>

  <h2>📋 Résumé du bien</h2>
  <div class="row"><span class="l">Titre</span><span class="v">${l.title}</span></div>
  <div class="row"><span class="l">Prix</span><span class="v">${eur(l.prix,0)}</span></div>
  <div class="row"><span class="l">Surface</span><span class="v">${l.surface} m²</span></div>
  <div class="row"><span class="l">Prix/m²</span><span class="v">${eur(l.prixM2,0)}</span></div>
  <div class="row"><span class="l">Localisation</span><span class="v">${l.ville} ${l.cp||''}</span></div>
  <div class="row"><span class="l">Type</span><span class="v">${l.type} · ${l.pieces} pièce(s)</span></div>
  <div class="row"><span class="l">DPE</span><span class="v">${l.dpe||'Non renseigné'}</span></div>
  <div class="row"><span class="l">Locataire en place</span><span class="v">${l.locataireEnPlace?'Oui':'Non'}</span></div>

  <h2>💰 Données financières</h2>
  <div class="row"><span class="l">Prix d'achat</span><span class="v">${eur(l.prix,0)}</span></div>
  <div class="row"><span class="l">Frais de notaire (~8.5%)</span><span class="v">${eur(l.notaire,0)}</span></div>
  <div class="row"><span class="l">Travaux estimés</span><span class="v">${eur(l.travaux||0,0)}</span></div>
  <div class="row"><span class="l"><strong>Coût total projet</strong></span><span class="v" style="color:#96680e"><strong>${eur(l.coutTotal,0)}</strong></span></div>
  <div class="row"><span class="l">Taxe foncière</span><span class="v">${eur(l.taxeFonciere||0,0)}/an</span></div>
  <div class="row"><span class="l">Charges copropriété</span><span class="v">${eur(l.chargesCopro||0,0)}/an</span></div>

  <h2>📈 Hypothèses locatives</h2>
  <div class="row"><span class="l">Loyer ${l.loyerActuel?'actuel':'estimé'}</span><span class="v">${eur(l.loyer,0)}/mois</span></div>
  ${(()=>{const mr=estimateMarketRent(l.ville,l.surface,l.type);if(!mr)return'';const diff=l.loyer-mr;return`<div class="row"><span class="l">Loyer marché estimé (${l.ville})</span><span class="v">${eur(mr,0)}/mois</span></div><div class="row"><span class="l">Écart vs marché</span><span class="v" style="color:${diff>mr*0.15?'#c0392b':diff<-mr*0.1?'#1a7a4a':'#333'}">${diff>=0?'+':''}${eur(diff,0)}</span></div>`;})()}
  <div class="row"><span class="l">Revenus annuels</span><span class="v">${eur(l.loyerAn,0)}/an</span></div>
  <div class="row"><span class="l">Charges annuelles totales</span><span class="v">${eur(l.charges,0)}/an</span></div>

  <h2>🎯 Indicateurs de performance</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="val">${l.rentBrute.toFixed(2)}%</div><div class="lbl">Rentabilité brute</div></div>
    <div class="kpi"><div class="val">${l.rentNette.toFixed(2)}%</div><div class="lbl">Rentabilité nette</div></div>
    <div class="kpi"><div class="val" style="color:${l.cfMensuel>=0?'#1a7a4a':'#c0392b'}">${l.cfMensuel>=0?'+':''}${Math.round(l.cfMensuel)} €</div><div class="lbl">Cash-flow/mois</div></div>
  </div>
  <div class="row"><span class="l">Mensualité estimée (20a/3.5%/10% apport)</span><span class="v">${eur(l.mens)}/mois</span></div>

  ${ai.resume ? `
  <h2>✦ Analyse IA</h2>
  <p>${ai.resume}</p>
  ${ai.points_forts?.length?'<div class="points"><strong>Points forts :</strong>'+ai.points_forts.map(p=>'<div class="point pro">✓ '+p+'</div>').join('')+'</div>':''}
  ${ai.points_faibles?.length?'<div class="points"><strong>Points faibles :</strong>'+ai.points_faibles.map(p=>'<div class="point con">✗ '+p+'</div>').join('')+'</div>':''}
  ${ai.alertes?.length?'<div class="points"><strong>Alertes :</strong>'+ai.alertes.map(p=>'<div class="point alert">⚠ '+p+'</div>').join('')+'</div>':''}
  `:''}

  <h2>🏆 Score & Recommandation</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="val" style="color:${scCol}">${l.score}/100</div><div class="lbl">Score investisseur</div></div>
    <div class="kpi"><div class="val">${l.verdictLabel}</div><div class="lbl">Verdict</div></div>
  </div>
  <div class="verdict ${l.verdict}">${ai.recommandation||'Utilisez le simulateur complet ImmoSim pour une analyse détaillée avec comparaison des régimes fiscaux.'}</div>

  <div class="footer">
    Rapport généré par ImmoSim V9 — Agrégateur & Simulateur Patrimonial<br/>
    ⚠ Estimations indicatives. Ne constitue pas un conseil en investissement. Consultez un professionnel.
  </div>
  </body></html>`);
  w.document.close();
}

// ── RAPPORT COMPARATIF ───────────────────────────────────────
function generateCompareReport(){
  if(shortlist.length<2){toast('Ajoutez au moins 2 biens à la shortlist','err');return}
  const w=window.open('','_blank');
  let rows='';
  const fields=[
    ['Prix',l=>eur(l.prix,0)],['Surface',l=>l.surface+' m²'],['Prix/m²',l=>eur(l.prixM2,0)],
    ['Loyer',l=>eur(l.loyer,0)+'/mois'],['Rent. brute',l=>l.rentBrute.toFixed(1)+'%'],
    ['Rent. nette',l=>l.rentNette.toFixed(1)+'%'],['Cash-flow',l=>(l.cfMensuel>=0?'+':'')+Math.round(l.cfMensuel)+' €/mois'],
    ['Charges/an',l=>eur(l.charges,0)],['Travaux',l=>eur(l.travaux||0,0)],['DPE',l=>l.dpe||'—'],
    ['Score',l=>l.score+'/100'],['Verdict',l=>l.verdictLabel]
  ];
  fields.forEach(([label,fn])=>{
    rows+=`<tr><td style="font-weight:600;color:#777">${label}</td>${shortlist.map(l=>`<td>${fn(l)}</td>`).join('')}</tr>`;
  });

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Comparatif — ImmoSim V9</title>
  <style>body{font-family:'Segoe UI',sans-serif;max-width:1000px;margin:0 auto;padding:30px;color:#222}
  h1{color:#96680e;border-bottom:3px solid #96680e;padding-bottom:8px}
  table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:8px 12px;border-bottom:1px solid #eee;text-align:left;font-size:.85rem}
  th{background:#f8f5f0;color:#96680e;font-weight:700}
  .footer{margin-top:30px;padding-top:12px;border-top:2px solid #96680e;font-size:.72rem;color:#aaa;text-align:center}</style></head><body>
  <h1>🔀 Rapport comparatif — ImmoSim V9</h1>
  <p style="color:#777">${shortlist.length} biens comparés · ${new Date().toLocaleDateString('fr-FR')}</p>
  <table><thead><tr><th>Critère</th>${shortlist.map(l=>`<th>${l.title.substring(0,30)}</th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="footer">ImmoSim V9 — Agrégateur & Simulateur Patrimonial · Estimations indicatives</div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════════════
   FEATURE 3: NOTIFICATIONS SYSTEM
═══════════════════════════════════════════════════════════════ */
let notifications = [];

function toggleNotifPanel(){
  const p=g('notifPanel');
  p.classList.toggle('open');
  if(p.classList.contains('open')) markNotifsRead();
}

function addNotif(msg, type='info'){
  notifications.unshift({msg, type, time:Date.now(), read:false});
  if(notifications.length>30) notifications.pop();
  renderNotifs();
  g('notifDot').classList.add('show');
  saveNotifsLS();
}

function renderNotifs(){
  const el=g('notifList');
  if(!notifications.length){el.innerHTML='<div class="notif-empty">Aucune notification</div>';return;}
  el.innerHTML=notifications.slice(0,20).map((n,i)=>{
    const ago=Math.round((Date.now()-n.time)/60000);
    const timeStr=ago<1?'À l\'instant':ago<60?ago+'min':ago<1440?Math.round(ago/60)+'h':''+Math.round(ago/1440)+'j';
    const icons={info:'💡',alert:'🎯',match:'⭐',search:'🔍'};
    return`<div class="notif-item ${n.read?'':'new'}" onclick="onNotifClick(${i})"><span>${icons[n.type]||'💡'} ${n.msg}</span><div class="ni-time">${timeStr}</div></div>`;
  }).join('');
}

function markNotifsRead(){
  notifications.forEach(n=>n.read=true);
  g('notifDot').classList.remove('show');
  renderNotifs();
  saveNotifsLS();
}

function clearNotifs(){notifications=[];renderNotifs();g('notifDot').classList.remove('show');saveNotifsLS();}

function onNotifClick(i){
  const n=notifications[i];
  if(n&&n.type==='match') gv('search');
  toggleNotifPanel();
}

function saveNotifsLS(){try{localStorage.setItem('immoV9_notifs',JSON.stringify(notifications.slice(0,20)))}catch(e){}}
function loadNotifsLS(){try{notifications=JSON.parse(localStorage.getItem('immoV9_notifs')||'[]');renderNotifs();if(notifications.some(n=>!n.read))g('notifDot').classList.add('show');}catch(e){}}

/* ═══════════════════════════════════════════════════════════════
   FEATURE 4: PDF EXPORT FOR SHORTLIST
═══════════════════════════════════════════════════════════════ */
function exportShortlistPDF(){
  if(shortlist.length<1){toast('Ajoutez des biens à la shortlist','err');return;}
  if(typeof jspdf==='undefined'&&typeof window.jspdf==='undefined'){toast('jsPDF non chargé','err');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const W=297,H=210;
  const gold=[150,104,14],dark=[15,15,25],white=[255,255,255],grey=[130,130,130];

  // Page 1: Cover
  doc.setFillColor(...dark);doc.rect(0,0,W,H,'F');
  doc.setFillColor(...gold);doc.rect(0,0,W,4,'F');
  doc.setTextColor(...gold);doc.setFontSize(28);doc.text('Rapport Comparatif',20,40);
  doc.setFontSize(12);doc.setTextColor(...white);doc.text(`${shortlist.length} biens analysés — ${new Date().toLocaleDateString('fr-FR')}`,20,52);
  doc.setFontSize(9);doc.setTextColor(...grey);doc.text('ImmoSim V9 — Agrégateur & Simulateur Patrimonial',20,62);

  // KPIs summary
  const avgRent=shortlist.reduce((s,l)=>s+l.rentBrute,0)/shortlist.length;
  const avgCF=shortlist.reduce((s,l)=>s+l.cfMensuel,0)/shortlist.length;
  const totalBudget=shortlist.reduce((s,l)=>s+l.prix,0);
  const bonnes=shortlist.filter(l=>l.verdict==='good').length;

  let y=80;
  const kpis=[
    ['Budget total',eur(totalBudget,0)],['Rent. moyenne',avgRent.toFixed(1)+'%'],
    ['CF moyen',Math.round(avgCF)+' €/mois'],['Bonnes affaires',''+bonnes+'/'+shortlist.length]
  ];
  kpis.forEach((k,i)=>{
    const x=20+i*68;
    doc.setFillColor(30,30,45);doc.roundedRect(x,y,62,28,3,3,'F');
    doc.setFontSize(14);doc.setTextColor(...gold);doc.text(k[1],x+31,y+12,{align:'center'});
    doc.setFontSize(7);doc.setTextColor(...grey);doc.text(k[0],x+31,y+22,{align:'center'});
  });

  // Page 2+: Comparison table
  doc.addPage();
  doc.setFillColor(...dark);doc.rect(0,0,W,H,'F');
  doc.setFillColor(...gold);doc.rect(0,0,W,4,'F');
  doc.setTextColor(...gold);doc.setFontSize(14);doc.text('Détail comparatif',20,18);

  const fields=[['Titre',l=>l.title.substring(0,35)],['Prix',l=>eur(l.prix,0)],['Surface',l=>l.surface+'m²'],['Prix/m²',l=>eur(l.prixM2,0)],
    ['Loyer',l=>eur(l.loyer,0)+'/m'],['Rent. brute',l=>l.rentBrute.toFixed(1)+'%'],['Rent. nette',l=>l.rentNette.toFixed(1)+'%'],
    ['Cash-flow',l=>(l.cfMensuel>=0?'+':'')+Math.round(l.cfMensuel)+'€'],['DPE',l=>l.dpe||'—'],
    ['Travaux',l=>eur(l.travaux||0,0)],['Score',l=>l.score+'/100'],['Verdict',l=>l.verdictLabel]];

  y=28;
  const colW=Math.min(45,((W-25)/shortlist.length)-2);
  // Header row
  doc.setFontSize(7);doc.setTextColor(...grey);
  fields.forEach((f,fi)=>{
    doc.text(f[0],15,y+fi*11.5);
  });
  shortlist.forEach((l,li)=>{
    const x=70+li*colW;
    doc.setFillColor(25,25,40);doc.roundedRect(x-2,y-6,colW,fields.length*11.5+4,2,2,'F');
    fields.forEach((f,fi)=>{
      doc.setFontSize(7);
      if(fi===0){doc.setTextColor(...gold);}else{doc.setTextColor(...white);}
      doc.text(String(f[1](l)).substring(0,18),x,y+fi*11.5);
    });
  });

  // Footer
  doc.setFontSize(6);doc.setTextColor(...grey);
  doc.text('⚠ Estimations indicatives — Ne constitue pas un conseil en investissement',20,H-8);
  doc.text('ImmoSim V9',W-30,H-8);

  doc.save('ImmoSim_Comparatif_'+new Date().toISOString().slice(0,10)+'.pdf');
  toast('PDF comparatif exporté ✓','ok');
  addNotif('PDF comparatif exporté ('+shortlist.length+' biens)','info');
}

/* ═══════════════════════════════════════════════════════════════
   FEATURE 5: SEARCH HISTORY
═══════════════════════════════════════════════════════════════ */
let searchHistory=[];

function saveSearchToHist(params){
  const entry={...params, ts:Date.now()};
  // Deduplicate by ville
  searchHistory=searchHistory.filter(h=>h.ville!==entry.ville||h.type!==entry.type);
  searchHistory.unshift(entry);
  if(searchHistory.length>10)searchHistory.pop();
  renderSearchHist();
  saveSearchHistLS();
}

function renderSearchHist(){
  const wrap=g('searchHistWrap'),chips=g('searchHistChips');
  if(!searchHistory.length){wrap.style.display='none';return;}
  wrap.style.display='block';
  chips.innerHTML=searchHistory.map((h,i)=>{
    const parts=[h.ville||'Toutes villes'];
    if(h.prixMax)parts.push('≤'+Math.round(h.prixMax/1000)+'k€');
    if(h.type)parts.push(h.type);
    if(h.rendMin)parts.push('≥'+h.rendMin+'%');
    return`<span class="sh-chip" onclick="replaySearch(${i})">${parts.join(' · ')}<span class="sh-x" onclick="event.stopPropagation();removeSearchHist(${i})">✕</span></span>`;
  }).join('');
}

function replaySearch(i){
  const h=searchHistory[i];if(!h)return;
  if(h.ville)sv('sVille',h.ville);
  if(h.prixMin)sv('sPrixMin',h.prixMin);
  if(h.prixMax)sv('sPrixMax',h.prixMax);
  if(h.type)g('sType').value=h.type;
  if(h.surfMin)sv('sSurfMin',h.surfMin);
  if(h.rendMin)sv('sRendMin',h.rendMin);
  filterListings();
  toast('Recherche rechargée','ok');
}

function removeSearchHist(i){searchHistory.splice(i,1);renderSearchHist();saveSearchHistLS();}
function clearSearchHist(){searchHistory=[];renderSearchHist();saveSearchHistLS();}
function saveSearchHistLS(){try{localStorage.setItem('immoV9_searchHist',JSON.stringify(searchHistory))}catch(e){}}
function loadSearchHistLS(){try{searchHistory=JSON.parse(localStorage.getItem('immoV9_searchHist')||'[]');renderSearchHist();}catch(e){}}

/* ═══════════════════════════════════════════════════════════════
   FEATURE 6: CUSTOM SCORE WEIGHTS
═══════════════════════════════════════════════════════════════ */
let scoreWeights={renta:35,cf:25,dpe:10,pm2:10,loc:10,trav:10};

function openScoreCust(){g('scoreCustOverlay').classList.add('open');updateScoreWeights();}
function closeScoreCust(){g('scoreCustOverlay').classList.remove('open');}

function updateScoreWeights(){
  const ids=['renta','cf','dpe','pm2','loc','trav'];
  ids.forEach(id=>{
    const v=+g('sw_'+id).value;
    g('sw_'+id+'_v').textContent=v;
  });
  // Show preview with normalized weights
  const total=ids.reduce((s,id)=>s+(+g('sw_'+id).value),0)||1;
  const prev=g('scorePreview');
  prev.innerHTML=ids.map(id=>{
    const v=+g('sw_'+id).value;
    const pct=((v/total)*100).toFixed(0);
    const labels={renta:'Renta.',cf:'Cash-flow',dpe:'DPE',pm2:'Prix/m²',loc:'Locataire',trav:'Travaux'};
    return`<div class="sp-item"><div class="sp-val">${pct}%</div><div class="sp-lbl">${labels[id]}</div></div>`;
  }).join('');
}

function applyScoreWeights(){
  const ids=['renta','cf','dpe','pm2','loc','trav'];
  const total=ids.reduce((s,id)=>s+(+g('sw_'+id).value),0)||1;
  ids.forEach(id=>{scoreWeights[id]=Math.round((+g('sw_'+id).value/total)*100);});
  // Recalculate all listing scores
  listings.forEach(l=>recalcScoreCustom(l));
  filteredListings=[...listings];
  filterListings();
  closeScoreCust();
  toast('Scores recalculés avec pondération personnalisée ✓','ok');
  addNotif('Pondération score mise à jour','info');
  saveScoreWeightsLS();
}

function resetScoreWeights(){
  const defs={renta:35,cf:25,dpe:10,pm2:10,loc:10,trav:10};
  Object.entries(defs).forEach(([k,v])=>{g('sw_'+k).value=v;});
  scoreWeights={...defs};
  updateScoreWeights();
}

function recalcScoreCustom(l){
  const w=scoreWeights;
  let score=0;
  // Renta: 0-100 mapped from 0-12%
  score+=(w.renta/100)*Math.min(100,l.rentBrute*100/12);
  // CF: 0-100 mapped from -300 to +300
  score+=(w.cf/100)*Math.min(100,Math.max(0,(l.cfMensuel+300)/6));
  // DPE
  const dpeS={A:100,B:85,C:70,D:50,E:30,F:10,G:0};
  score+=(w.dpe/100)*(dpeS[l.dpe]||40);
  // Prix/m²: lower is better, 0-100 mapped from 5000 to 500
  score+=(w.pm2/100)*Math.min(100,Math.max(0,(5000-l.prixM2)/45));
  // Locataire
  score+=(w.loc/100)*(l.locataireEnPlace?100:0);
  // Travaux: less is better
  score+=(w.trav/100)*((l.travaux||0)===0?100:(l.travaux||0)<10000?50:0);
  l.score=Math.max(0,Math.min(100,Math.round(score)));
  l.verdict=l.score>=65?'good':l.score<40?'avoid':'caution';
  l.verdictLabel={good:'✓ Bonne affaire',caution:'⚠ Prudence',avoid:'✗ À écarter'}[l.verdict];
}

function saveScoreWeightsLS(){try{localStorage.setItem('immoV9_scoreW',JSON.stringify(scoreWeights))}catch(e){}}
function loadScoreWeightsLS(){
  try{
    const w=JSON.parse(localStorage.getItem('immoV9_scoreW'));
    if(w){scoreWeights=w;Object.entries(w).forEach(([k,v])=>{if(g('sw_'+k))g('sw_'+k).value=v;});}
  }catch(e){}
}

/* ═══════════════════════════════════════════════════════════════
   FEATURE 9: AUTO RENT ESTIMATE (market data)
═══════════════════════════════════════════════════════════════ */
const LOYER_M2_MARCHE={
  // Based on real market data - €/m²/month by city
  'paris':28,'lyon':15,'marseille':14,'toulouse':13,'bordeaux':14,'nantes':13,
  'strasbourg':13,'montpellier':14,'lille':13,'nice':16,'rennes':13,'grenoble':12,
  'arras':9.5,'lens':8,'douai':8.5,'valenciennes':8.5,'bethune':7.5,'saint-omer':7,
  'lievin':7,'henin-beaumont':7.5,'calais':7.5,'dunkerque':8,'boulogne-sur-mer':8.5,
  'cambrai':7.5,'maubeuge':7,'avesnes':6.5,'saint-quentin':7,'laon':6.5,
  'beauvais':10,'compiegne':10.5,'amiens':9.5,'abbeville':7,'rouen':12,
  'le-havre':10,'caen':11,'roubaix':9,'tourcoing':9,'villeneuve-d-ascq':11,
  'croix':11,'marcq-en-baroeul':12,'lambersart':12,'lomme':10,'wasquehal':11,
};

function estimateMarketRent(ville, surface, type){
  if(!ville||!surface) return null;
  const key=ville.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-');
  // Try exact match, then prefix match
  let rate=LOYER_M2_MARCHE[key];
  if(!rate){
    for(const[k,v] of Object.entries(LOYER_M2_MARCHE)){
      if(key.startsWith(k)||k.startsWith(key)){rate=v;break;}
    }
  }
  if(!rate) rate=8; // default for unknown cities
  // Adjust for type
  if(type==='Studio'||type==='Parking') rate*=1.15; // studios/parking higher per m²
  if(type==='Maison') rate*=0.9; // houses slightly lower per m²
  if(type==='Immeuble') rate*=0.85; // bulk discount
  if(surface<25) rate*=1.1; // small units premium
  if(surface>100) rate*=0.92; // large units discount
  return Math.round(surface*rate);
}

// Inject market rent display into detail view
function getMarketRentHTML(l){
  const marketRent=estimateMarketRent(l.ville,l.surface,l.type);
  if(!marketRent) return '';
  const actual=l.loyer;
  const diff=actual-marketRent;
  const pct=marketRent>0?((diff/marketRent)*100).toFixed(0):0;
  const cls=diff>marketRent*0.15?'neg':diff<-marketRent*0.1?'pos':'';
  return`
    <div class="rc blue"><span class="rl">Loyer marché estimé (${l.ville})</span><span class="rv">${eur(marketRent,0)}/mois</span></div>
    <div class="rc ${cls}"><span class="rl">Écart loyer vs marché</span><span class="rv">${diff>=0?'+':''}${eur(diff,0)} (${diff>=0?'+':''}${pct}%)</span></div>`;
}

/* ═══════════════════════════════════════════════════════════════
   FEATURE 10: ALERT PROFILE & MATCHING
═══════════════════════════════════════════════════════════════ */
let alertProfile=null;

function openAlertProfile(){g('alertProfileOverlay').classList.add('open');loadAlertProfileUI();}
function closeAlertProfile(){g('alertProfileOverlay').classList.remove('open');}

function loadAlertProfileUI(){
  if(!alertProfile)return;
  if(alertProfile.ville)sv('ap_ville',alertProfile.ville);
  if(alertProfile.budget)sv('ap_budget',alertProfile.budget);
  if(alertProfile.renta)sv('ap_renta',alertProfile.renta);
  if(alertProfile.cf)sv('ap_cf',alertProfile.cf);
  if(alertProfile.surf)sv('ap_surf',alertProfile.surf);
  if(alertProfile.dpe)g('ap_dpe').value=alertProfile.dpe;
  if(alertProfile.type)g('ap_type').value=alertProfile.type;
  if(alertProfile.scoreMin)sv('ap_scoreMin',alertProfile.scoreMin);
  if(alertProfile.locataire)g('ap_locataire').checked=true;
  if(alertProfile.noTravaux)g('ap_noTravaux').checked=true;
}

function saveAlertProfile(){
  alertProfile={
    ville:(g('ap_ville')?.value||'').trim(),
    budget:+g('ap_budget')?.value||0,
    renta:+g('ap_renta')?.value||0,
    cf:+g('ap_cf')?.value||0,
    surf:+g('ap_surf')?.value||0,
    dpe:g('ap_dpe')?.value||'',
    type:g('ap_type')?.value||'',
    scoreMin:+g('ap_scoreMin')?.value||60,
    locataire:g('ap_locataire')?.checked||false,
    noTravaux:g('ap_noTravaux')?.checked||false,
  };
  // Recalculate match% for all listings
  listings.forEach(l=>{l.matchPct=calcMatch(l);});
  filteredListings=[...listings];
  filterListings();
  closeAlertProfile();
  saveAlertProfileLS();
  toast('Profil d\'alerte enregistré ✓','ok');
  addNotif('Profil investisseur mis à jour — les annonces sont maintenant scorées en % de match','info');
  // Check for matches and notify
  const matches=listings.filter(l=>l.matchPct>=80);
  if(matches.length) addNotif(`🎯 ${matches.length} annonce(s) correspondent à ≥80% de votre profil !`,'match');
}

function clearAlertProfile(){
  alertProfile=null;
  ['ap_ville','ap_budget','ap_renta','ap_cf','ap_surf','ap_scoreMin'].forEach(id=>{if(g(id))g(id).value='';});
  ['ap_dpe','ap_type'].forEach(id=>{if(g(id))g(id).selectedIndex=0;});
  ['ap_locataire','ap_noTravaux'].forEach(id=>{if(g(id))g(id).checked=false;});
  listings.forEach(l=>{delete l.matchPct;});
  filteredListings=[...listings];
  filterListings();
  saveAlertProfileLS();
  toast('Profil d\'alerte effacé');
}

function calcMatch(l){
  if(!alertProfile)return null;
  const ap=alertProfile;
  let total=0,matched=0,weights=0;

  function test(weight,pass){weights+=weight;if(pass){matched+=weight;}}

  if(ap.ville){test(20, l.ville.toLowerCase().includes(ap.ville.toLowerCase()));}
  if(ap.budget>0){test(15, l.prix<=ap.budget);}
  if(ap.renta>0){test(20, l.rentBrute>=ap.renta);}
  if(ap.cf!==0){test(15, l.cfMensuel>=ap.cf);}
  if(ap.surf>0){test(10, l.surface>=ap.surf);}
  if(ap.dpe){const ord='ABCDEFG';test(10, l.dpe&&ord.indexOf(l.dpe)<=ord.indexOf(ap.dpe));}
  if(ap.type){test(5, l.type===ap.type);}
  if(ap.locataire){test(10, l.locataireEnPlace);}
  if(ap.noTravaux){test(10, (l.travaux||0)===0);}

  if(weights===0)return null;
  return Math.round((matched/weights)*100);
}

function getMatchBadgeHTML(l){
  if(!alertProfile||l.matchPct===null||l.matchPct===undefined)return '';
  const pct=l.matchPct;
  const cls=pct>=80?'high':pct>=50?'med':'low';
  return`<span class="match-badge ${cls}">🎯 ${pct}%</span>`;
}

function saveAlertProfileLS(){try{localStorage.setItem('immoV9_alertP',JSON.stringify(alertProfile))}catch(e){}}
function loadAlertProfileLS(){try{alertProfile=JSON.parse(localStorage.getItem('immoV9_alertP'));if(alertProfile)listings.forEach(l=>{l.matchPct=calcMatch(l);});}catch(e){}}

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURES — View toggle, Quick filters, CSV, Keyboard,
   Skeleton, Source counts, Persistence, Auto-load
═══════════════════════════════════════════════════════════════ */

// ── VIEW TOGGLE (grid/list) ──────────────────────────────────
let currentView = 'grid';
function setView(mode){
  currentView = mode;
  const grid = g('aggGrid');
  grid.classList.toggle('list-view', mode==='list');
  document.querySelectorAll('.vt-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector(`.vt-btn[onclick="setView('${mode}')"]`)?.classList.add('active');
}

// ── QUICK FILTERS ────────────────────────────────────────────
let activeQF = 'all';
function quickFilter(type){
  activeQF = type;
  // Update chip styles
  document.querySelectorAll('.qf-chip').forEach(c=>c.classList.remove('active'));
  event?.target?.classList.add('active');

  if(type==='all'){ filteredListings=[...listings]; }
  else {
    filteredListings = listings.filter(l=>{
      switch(type){
        case 'good': return l.verdict==='good';
        case 'cf+': return l.cfMensuel > 0;
        case 'renta7': return l.rentBrute >= 7;
        case 'loue': return l.locataireEnPlace;
        case 'immeuble': return l.type==='Immeuble';
        case 'petit': return l.prix < 80000;
        case 'notrav': return (l.travaux||0) === 0;
        default: return true;
      }
    });
  }
  sortListings();
}

// ── UPDATE SOURCE COUNTS ─────────────────────────────────────
function updateSourceCounts(){
  const sources = ['leboncoin','seloger','bienici','pap','logicimmo'];
  sources.forEach(s=>{
    const el = g('srcCount_'+s);
    if(el){
      const count = listings.filter(l=>l.source===s).length;
      el.textContent = count ? '('+count+')' : '';
    }
  });
}

// ── SKELETON LOADING ─────────────────────────────────────────
function showSkeletons(n=6){
  const grid = g('aggGrid');
  grid.innerHTML = Array(n).fill(0).map(()=>`
    <div class="skel-card">
      <div class="skel-img"></div>
      <div class="skel-body">
        <div class="skel-line w60"></div>
        <div class="skel-line w80"></div>
        <div class="skel-row"><div class="skel-pill"></div><div class="skel-pill"></div><div class="skel-pill"></div></div>
        <div class="skel-kpis"><div class="skel-kpi"></div><div class="skel-kpi"></div><div class="skel-kpi"></div></div>
        <div class="skel-line w40"></div>
      </div>
    </div>
  `).join('');
}

// ── CSV EXPORT ───────────────────────────────────────────────
function exportListingsCSV(){
  if(!filteredListings.length){toast('Aucune annonce à exporter','err');return;}
  const headers=['Titre','Prix','Surface m²','Pièces','Type','Ville','CP','DPE','Loyer €/mois','Rent. brute %','Rent. nette %','Cash-flow €/mois','Score','Verdict','Travaux €','Taxe foncière €','Charges copro €','Locataire','Source','URL'];
  const rows=filteredListings.map(l=>[
    '"'+(l.title||'').replace(/"/g,'""')+'"',l.prix,l.surface,l.pieces,l.type,l.ville,l.cp,l.dpe||'',
    l.loyer,l.rentBrute?.toFixed(1),l.rentNette?.toFixed(1),Math.round(l.cfMensuel),l.score,
    l.verdictLabel,l.travaux||0,l.taxeFonciere||0,l.chargesCopro||0,
    l.locataireEnPlace?'Oui':'Non',l.source,l.url||''
  ].join(','));
  const csv='\uFEFF'+headers.join(',')+'\n'+rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='ImmoSim_annonces_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast(filteredListings.length+' annonces exportées en CSV ✓','ok');
  addNotif('Export CSV de '+filteredListings.length+' annonces','info');
}

// ── CLEAR ALL with confirmation ──────────────────────────────
function clearAllListings(){
  if(listings.length && !confirm('Supprimer les '+listings.length+' annonces chargées ?'))return;
  listings=[];filteredListings=[];
  renderListings();
  clearListingsLS();
  toast('Annonces supprimées');
}

// ── PERSISTENCE — save/load listings to localStorage ─────────
function saveListingsLS(){
  try{
    const slim=listings.map(l=>({...l,aiAnalysis:undefined})); // don't store AI analysis (too big)
    localStorage.setItem('immoV9_listings',JSON.stringify(slim));
  }catch(e){console.warn('Save listings failed',e)}
}
function loadListingsLS(){
  try{
    const data=JSON.parse(localStorage.getItem('immoV9_listings'));
    if(data&&data.length){
      data.forEach(d=>analyzeListingLocal(d));
      listings=data;
      filteredListings=[...listings];
      renderListings();
      return true;
    }
  }catch(e){}
  return false;
}
function clearListingsLS(){try{localStorage.removeItem('immoV9_listings')}catch(e){}}

// ── KEYBOARD SHORTCUTS ───────────────────────────────────────
document.addEventListener('keydown',function(e){
  // Escape = close modals
  if(e.key==='Escape'){
    if(g('detailOverlay')?.classList.contains('open')){closeDetail();return;}
    if(g('scoreCustOverlay')?.classList.contains('open')){closeScoreCust();return;}
    if(g('alertProfileOverlay')?.classList.contains('open')){closeAlertProfile();return;}
    if(g('tmiCalcOverlay')?.classList.contains('open')){closeTMICalc();return;}
    if(g('notifPanel')?.classList.contains('open')){toggleNotifPanel();return;}
  }
  // Enter in search field = trigger search
  if(e.key==='Enter' && document.activeElement?.id==='sVille'){
    e.preventDefault();
    searchRealListings();
  }
  // Ctrl+K or / = focus search field
  if((e.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) ||
     (e.key==='k' && (e.ctrlKey||e.metaKey))){
    e.preventDefault();
    g('sVille')?.focus();
  }
});

// ── INJECT SCORE MINI-GAUGE INTO renderListings ──────────────
// (patching the original renderListings to add score bar + new badge + source counts)
const _origRenderListings = renderListings;
renderListings = function(){
  _origRenderListings();
  // After render, add score gauges and new badges
  filteredListings.forEach(l=>{
    // Update source counts
  });
  updateSourceCounts();
  // Save to localStorage
  if(listings.length) saveListingsLS();
  // Update quick filter active counts
  updateQFCounts();
};

function updateQFCounts(){
  const counts={
    all:listings.length,
    good:listings.filter(l=>l.verdict==='good').length,
    'cf+':listings.filter(l=>l.cfMensuel>0).length,
    renta7:listings.filter(l=>l.rentBrute>=7).length,
    loue:listings.filter(l=>l.locataireEnPlace).length,
    immeuble:listings.filter(l=>l.type==='Immeuble').length,
    petit:listings.filter(l=>l.prix<80000).length,
    notrav:listings.filter(l=>(l.travaux||0)===0).length,
  };
  document.querySelectorAll('.qf-chip').forEach(chip=>{
    const onclick=chip.getAttribute('onclick')||'';
    const match=onclick.match(/quickFilter\('(\w+[\+]?)'\)/);
    if(match){
      const key=match[1];
      const existing=chip.querySelector('.qf-count');
      if(existing)existing.textContent=counts[key]?'('+counts[key]+')':'';
      else if(counts[key]){
        const span=document.createElement('span');
        span.className='qf-count';
        span.textContent='('+counts[key]+')';
        chip.appendChild(span);
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   INIT — Load all saved data on page load
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   CALCULATEUR TMI — Barème IR 2025 (revenus 2024)
   + Simulation impact revenus fonciers
═══════════════════════════════════════════════════════════════ */
const IR_TRANCHES = [
  { min: 0,      max: 11294,  taux: 0    },
  { min: 11295,  max: 28797,  taux: 0.11 },
  { min: 28798,  max: 82341,  taux: 0.30 },
  { min: 82342,  max: 177106, taux: 0.41 },
  { min: 177107, max: Infinity, taux: 0.45 },
];

function openTMICalc(){
  g('tmiCalcOverlay').classList.add('open');
  // Pre-fill with simulator data if available
  if(R && R.loyerAn && R.charges){
    const foncierNet = Math.round(R.loyerAn - R.charges - (R.interets||0));
    if(foncierNet > 0) sv('tmi_foncier', foncierNet);
    else sv('tmi_deficit', Math.min(10700, Math.abs(foncierNet)));
  }
  // Load saved RFR
  try {
    const saved = JSON.parse(localStorage.getItem('immoV9_tmi'));
    if(saved){
      if(saved.revenu) sv('tmi_revenu', saved.revenu);
      if(saved.parts) sv('tmi_parts', saved.parts);
    }
  } catch(e){}
  calcTMILive();
}

function closeTMICalc(){ g('tmiCalcOverlay').classList.remove('open'); }

function calcIR(revenuImposable, parts){
  const quotient = revenuImposable / parts;
  let impotParPart = 0;

  for(const tr of IR_TRANCHES){
    if(quotient <= tr.min) break;
    const trancheBase = Math.min(quotient, tr.max) - tr.min;
    if(trancheBase > 0) impotParPart += trancheBase * tr.taux;
  }

  const impotTotal = Math.round(impotParPart * parts);
  const tauxEffectif = revenuImposable > 0 ? (impotTotal / revenuImposable) * 100 : 0;

  // Determine TMI bracket
  let tmi = 0;
  for(const tr of IR_TRANCHES){
    if(quotient > tr.min) tmi = tr.taux * 100;
  }

  return { impotTotal, tauxEffectif, tmi, quotient, impotParPart: Math.round(impotParPart) };
}

function calcTMILive(){
  const revenu = parseFloat(g('tmi_revenu')?.value) || 0;
  const parts = parseFloat(g('tmi_parts')?.value) || 1;
  const foncier = parseFloat(g('tmi_foncier')?.value) || 0;
  const deficit = Math.min(10700, parseFloat(g('tmi_deficit')?.value) || 0);

  const resultEl = g('tmiCalcResult');
  if(!revenu){ resultEl.style.display='none'; return; }
  resultEl.style.display='block';

  // Current situation
  const current = calcIR(revenu, parts);

  // With property income
  const revenuAvecImmo = Math.max(0, revenu + foncier - deficit);
  const withImmo = calcIR(revenuAvecImmo, parts);

  // KPIs
  g('tmiKPIs').innerHTML = `
    <div style="text-align:center;padding:8px;background:var(--bg3);border-radius:var(--r)">
      <div style="font-family:'Libre Baskerville',serif;font-size:1.2rem;font-weight:700;color:var(--gold)">${current.tmi}%</div>
      <div style="font-size:.6rem;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">TMI actuelle</div>
    </div>
    <div style="text-align:center;padding:8px;background:var(--bg3);border-radius:var(--r)">
      <div style="font-family:'Libre Baskerville',serif;font-size:1.2rem;font-weight:700;color:var(--ink)">${eur(current.impotTotal,0)}</div>
      <div style="font-size:.6rem;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">IR estimé</div>
    </div>
    <div style="text-align:center;padding:8px;background:var(--bg3);border-radius:var(--r)">
      <div style="font-family:'Libre Baskerville',serif;font-size:1.2rem;font-weight:700;color:var(--ink)">${current.tauxEffectif.toFixed(1)}%</div>
      <div style="font-size:.6rem;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">Taux effectif</div>
    </div>
  `;

  // Bracket visualization
  const bracketColors = ['var(--em)','#6b9ef8','var(--gold)','var(--am)','var(--ru)'];
  const bracketLabels = ['0%','11%','30%','41%','45%'];
  const quotient = current.quotient;
  g('tmiBracketViz').innerHTML = `
    <div style="font-size:.68rem;color:var(--ink3);margin-bottom:6px">Quotient familial : <strong style="color:var(--ink)">${eur(Math.round(quotient),0)}</strong> (${eur(revenu,0)} ÷ ${parts} part${parts>1?'s':''})</div>
    <div style="display:flex;height:24px;border-radius:4px;overflow:hidden;gap:1px">
      ${IR_TRANCHES.map((tr,i) => {
        const width = tr.max === Infinity ? 8 : Math.min(35, (tr.max - tr.min) / 2000);
        const active = quotient > tr.min;
        const isCurrent = quotient > tr.min && (i === IR_TRANCHES.length-1 || quotient <= IR_TRANCHES[i].max);
        return `<div style="flex:${width};background:${active?bracketColors[i]:'var(--bg3)'};opacity:${active?1:0.3};position:relative;display:flex;align-items:center;justify-content:center;font-size:.55rem;font-weight:700;color:${active?'#fff':'var(--ink4)'};${isCurrent?'outline:2px solid var(--gold);z-index:1;border-radius:2px':''}" title="${bracketLabels[i]} : ${tr.max===Infinity?'> '+eur(tr.min,0):eur(tr.min,0)+' → '+eur(tr.max,0)}">${bracketLabels[i]}</div>`;
      }).join('')}
    </div>
    <div style="font-size:.6rem;color:var(--ink4);margin-top:4px">Chaque euro supplémentaire est imposé à <strong style="color:var(--gold)">${current.tmi}%</strong> + 17,2% PS = <strong style="color:var(--ru)">${(current.tmi + 17.2).toFixed(1)}%</strong></div>
  `;

  // Impact box
  if(foncier > 0 || deficit > 0){
    const tmiChanged = withImmo.tmi !== current.tmi;
    const impotDiff = withImmo.impotTotal - current.impotTotal;
    const psDiff = Math.round((foncier - deficit) * 0.172);
    const totalImpact = impotDiff + psDiff;

    g('tmiImpactBox').innerHTML = `
      <div class="rc ${tmiChanged?'neg':'gold'}"><span class="rl">TMI après investissement</span><span class="rv">${withImmo.tmi}% ${tmiChanged?'⚠ CHANGEMENT DE TRANCHE':'= pas de changement'}</span></div>
      ${tmiChanged ? `<div class="rec-box warn" style="margin:8px 0"><strong>⚠ Attention :</strong> vos revenus fonciers vous font passer de la tranche ${current.tmi}% à ${withImmo.tmi}%. Chaque euro de revenu foncier supplémentaire sera taxé à ${withImmo.tmi}% + 17,2% PS = <strong>${(withImmo.tmi+17.2).toFixed(1)}%</strong>.</div>` : ''}
      <div class="rc"><span class="rl">Revenu imposable avec immo</span><span class="rv">${eur(revenuAvecImmo,0)}</span></div>
      <div class="rc"><span class="rl">IR estimé avec immo</span><span class="rv">${eur(withImmo.impotTotal,0)}</span></div>
      <div class="rc ${impotDiff>0?'neg':'pos'}"><span class="rl">Surcoût IR dû à l'investissement</span><span class="rv">${impotDiff>0?'+':''}${eur(impotDiff,0)}/an</span></div>
      <div class="rc ${psDiff>0?'neg':'pos'}"><span class="rl">Prélèvements sociaux (17,2%)</span><span class="rv">${psDiff>0?'+':''}${eur(psDiff,0)}/an</span></div>
      <div class="rc gold"><span class="rl"><strong>Impact fiscal total</strong></span><span class="rv"><strong>${totalImpact>0?'+':''}${eur(totalImpact,0)}/an</strong> soit <strong>${eur(Math.round(totalImpact/12),0)}/mois</strong></span></div>
      ${deficit > 0 ? `<div class="rc pos"><span class="rl">Économie grâce au déficit foncier</span><span class="rv">${eur(Math.round(deficit * (current.tmi/100 + 0.172)),0)}/an</span></div>` : ''}
    `;
  } else {
    g('tmiImpactBox').innerHTML = `
      <p style="font-size:.76rem;color:var(--ink3);text-align:center;padding:10px">
        Renseignez un revenu foncier estimé ci-dessus pour voir l'impact sur votre imposition.<br/>
        <span style="font-size:.68rem">Revenu foncier = loyers annuels − charges − intérêts d'emprunt</span>
      </p>`;
  }

  // Barème détaillé
  g('tmiBaremeDetail').innerHTML = `
    <table style="width:100%;font-size:.72rem;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid var(--bd2)">
        <th style="text-align:left;padding:4px 8px;color:var(--ink3);font-size:.62rem">TRANCHE</th>
        <th style="text-align:right;padding:4px 8px;color:var(--ink3);font-size:.62rem">TAUX</th>
        <th style="text-align:right;padding:4px 8px;color:var(--ink3);font-size:.62rem">IMPÔT / PART</th>
        <th style="text-align:right;padding:4px 8px;color:var(--ink3);font-size:.62rem">CUMUL</th>
      </tr></thead>
      <tbody>${IR_TRANCHES.map((tr,i) => {
        const active = quotient > tr.min;
        const trancheUsed = Math.max(0, Math.min(quotient, tr.max===Infinity?quotient:tr.max) - tr.min);
        const impotTranche = Math.round(trancheUsed * tr.taux);
        let cumul = 0;
        for(let j=0;j<=i;j++){
          const u = Math.max(0, Math.min(quotient, IR_TRANCHES[j].max===Infinity?quotient:IR_TRANCHES[j].max) - IR_TRANCHES[j].min);
          cumul += u * IR_TRANCHES[j].taux;
        }
        return `<tr style="border-bottom:1px solid var(--bd);${active?'':'opacity:.4'}">
          <td style="padding:5px 8px">${tr.max===Infinity?'> '+eur(tr.min,0):eur(tr.min,0)+' → '+eur(tr.max,0)}</td>
          <td style="text-align:right;padding:5px 8px;font-weight:700;color:${bracketColors[i]}">${(tr.taux*100)}%</td>
          <td style="text-align:right;padding:5px 8px">${active?eur(impotTranche,0):'—'}</td>
          <td style="text-align:right;padding:5px 8px;font-weight:700">${active?eur(Math.round(cumul),0):'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  `;

  // Save to localStorage
  try{localStorage.setItem('immoV9_tmi',JSON.stringify({revenu,parts}))}catch(e){}
}

function applyTMICalc(){
  const revenu = parseFloat(g('tmi_revenu')?.value) || 0;
  const parts = parseFloat(g('tmi_parts')?.value) || 1;
  if(!revenu){toast('Renseignez votre revenu d\'abord','err');return;}

  const result = calcIR(revenu, parts);
  // Set TMI in simulator
  g('tmi').value = result.tmi;
  // Also set in deficit/denormandie if they have TMI selects
  if(g('df_tmi')) g('df_tmi').value = result.tmi;
  if(g('dn_tmi')) g('dn_tmi').value = result.tmi;

  // Show hint
  const hint = g('tmiAutoHint');
  if(hint){
    hint.style.display='block';
    hint.innerHTML = `📊 TMI ${result.tmi}% (revenu ${eur(revenu,0)}, ${parts} part${parts>1?'s':''}) · <button onclick="openTMICalc()" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:.66rem;text-decoration:underline">modifier</button>`;
  }

  closeTMICalc();
  lv(); // recalculate simulator
  toast('TMI mise à jour : '+result.tmi+'% ✓','ok');
  addNotif('TMI calculée automatiquement : '+result.tmi+'% ('+eur(revenu,0)+', '+parts+' parts)','info');
}

/* ═══════════════════════════════════════════════════════════════
   CARTE INTERACTIVE — Leaflet + OpenStreetMap
═══════════════════════════════════════════════════════════════ */
let mapInstance = null;
let mapMarkers = [];

async function geocodeCity(ville, cp){
  if(!ville) return null;
  const cacheKey = 'geo_'+(cp||'')+'_'+ville.toLowerCase();
  const cached = localStorage.getItem(cacheKey);
  if(cached){try{return JSON.parse(cached);}catch(e){}}
  try{
    const q = encodeURIComponent((cp?cp+' ':'')+ville+', France');
    const res = await fetch('https://api-adresse.data.gouv.fr/search/?q='+q+'&limit=1');
    const data = await res.json();
    if(data.features && data.features.length){
      const [lon, lat] = data.features[0].geometry.coordinates;
      const coords = {lat, lon};
      try{localStorage.setItem(cacheKey, JSON.stringify(coords));}catch(e){}
      return coords;
    }
  }catch(e){console.warn('Geocode failed',e);}
  return null;
}

async function initMap(){
  if(mapInstance) return;
  const el = g('aggMap');
  if(!el) return;
  mapInstance = L.map(el).setView([50.5, 2.5], 8); // Hauts-de-France default
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(mapInstance);
}

async function renderMap(){
  await initMap();
  if(!mapInstance) return;

  // Clear old markers
  mapMarkers.forEach(m=>mapInstance.removeLayer(m));
  mapMarkers = [];

  // Geocode + place markers
  for(const l of filteredListings){
    if(!l.lat || !l.lon){
      const coords = await geocodeCity(l.ville, l.cp);
      if(coords){l.lat=coords.lat;l.lon=coords.lon;}
    }
    if(l.lat && l.lon){
      // Slight random offset so markers don't overlap for same city
      const latJitter = l.lat + (Math.random()-0.5)*0.008;
      const lonJitter = l.lon + (Math.random()-0.5)*0.008;

      const cls = l.verdict === 'good' ? 'good' : l.verdict === 'avoid' ? 'avoid' : 'caution';
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker ${cls}">${l.score}</div>`,
        iconSize: [36,36],
        iconAnchor: [18,18]
      });
      const marker = L.marker([latJitter, lonJitter], {icon}).addTo(mapInstance);
      marker.bindPopup(buildPopupHTML(l), {maxWidth: 280, className: 'map-popup-wrap'});
      marker.on('click', ()=>marker.openPopup());
      mapMarkers.push(marker);
    }
  }

  // Fit bounds
  if(mapMarkers.length){
    const group = L.featureGroup(mapMarkers);
    mapInstance.fitBounds(group.getBounds().pad(0.15));
  }
}

function buildPopupHTML(l){
  const scCol = l.score>=65?'#1a7a4a':l.score>=40?'#b06a00':'#c83030';
  return `
    <div class="map-popup">
      ${l.img?`<img src="${l.img}" class="map-popup-img" onerror="this.style.display='none'"/>`:''}
      <div class="map-popup-title">${l.title}</div>
      <div class="map-popup-price">${eur(l.prix,0)}</div>
      <div class="map-popup-meta">${l.type} · ${l.surface}m² · ${l.pieces}p. · ${l.ville}</div>
      <div class="map-popup-kpis">
        <div class="map-popup-kpi"><div class="v" style="color:#96680e">${l.rentBrute.toFixed(1)}%</div><div class="l">Rent.</div></div>
        <div class="map-popup-kpi"><div class="v" style="color:${l.cfMensuel>=0?'#1a7a4a':'#c83030'}">${l.cfMensuel>=0?'+':''}${Math.round(l.cfMensuel)}€</div><div class="l">CF</div></div>
        <div class="map-popup-kpi"><div class="v" style="color:${scCol}">${l.score}</div><div class="l">Score</div></div>
      </div>
      <div class="map-popup-btns">
        <button class="btn btn-p btn-sm" onclick="openDetail('${l.id}')">📊 Détail</button>
        <button class="btn btn-g btn-sm" onclick="toggleShort('${l.id}');renderMap()">⭐</button>
      </div>
    </div>`;
}

function fitMapToListings(){
  if(!mapInstance || !mapMarkers.length) return;
  const group = L.featureGroup(mapMarkers);
  mapInstance.fitBounds(group.getBounds().pad(0.15));
}

// Override setView to include map
const _origSetView = typeof setView === 'function' ? setView : null;
setView = function(mode){
  currentView = mode;
  const grid = g('aggGrid');
  const mapC = g('aggMapContainer');
  const stats = g('aggStats');

  document.querySelectorAll('.vt-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector(`.vt-btn[onclick="setView('${mode}')"]`)?.classList.add('active');

  if(mode === 'map'){
    grid.style.display = 'none';
    mapC.classList.remove('hidden');
    setTimeout(()=>{
      renderMap();
      if(mapInstance) mapInstance.invalidateSize();
    }, 100);
  } else {
    grid.style.display = '';
    mapC.classList.add('hidden');
    grid.classList.toggle('list-view', mode==='list');
  }
};

/* ═══════════════════════════════════════════════════════════════
   SIMULATION "ET SI..." — live négociation
═══════════════════════════════════════════════════════════════ */
function updateWhatIf(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  const negoPct = parseFloat(g('wi_nego_'+id)?.value)||0;
  const loyerMod = parseFloat(g('wi_loyer_'+id)?.value)||l.loyer;
  const travMod = parseFloat(g('wi_trav_'+id)?.value)||0;

  // Update labels
  g('wi_negoVal_'+id).textContent = '-'+negoPct+'% ('+eur(Math.round(l.prix*negoPct/100),0)+' économisés)';
  g('wi_loyerVal_'+id).textContent = eur(loyerMod,0)+'/mois';
  g('wi_travVal_'+id).textContent = eur(travMod,0);

  // Recalculate
  const newPrix = l.prix * (1 - negoPct/100);
  const newCout = newPrix + travMod + Math.round(newPrix*0.085);
  const newLoyerAn = loyerMod * 12;
  const newRent = newCout > 0 ? (newLoyerAn/newCout)*100 : 0;

  const charges = (l.taxeFonciere||0) + (l.chargesCopro||0);
  const emp = newCout - Math.round(newCout*0.1);
  const t = 0.035/12, n = 240;
  const mens = t > 0 ? emp * (t*Math.pow(1+t,n))/(Math.pow(1+t,n)-1) : emp/n;
  const newCF = loyerMod - mens - charges/12;

  // Compare to original
  const origRent = l.rentBrute;
  const origCF = l.cfMensuel;
  const origCout = l.coutTotal;

  const dRent = newRent - origRent;
  const dCF = newCF - origCF;
  const dCout = newCout - origCout;

  // Score recalc (simple)
  let newScore = 0;
  newScore += Math.min(30, newRent * 3.5);
  newScore += newCF > 0 ? Math.min(25, newCF / 10) : Math.max(-10, newCF / 20);
  newScore += l.locataireEnPlace ? 10 : 0;
  const dpeS = {A:10,B:9,C:7,D:5,E:3,F:1,G:0};
  newScore += dpeS[l.dpe] || 4;
  const newPm2 = newPrix / l.surface;
  newScore += newPm2 < 1500 ? 10 : newPm2 < 2500 ? 6 : newPm2 < 3500 ? 3 : 0;
  newScore += travMod === 0 ? 8 : travMod < 10000 ? 4 : 0;
  newScore = Math.max(0, Math.min(100, Math.round(newScore)));
  const dScore = newScore - l.score;

  g('wi_impact_'+id).innerHTML = `
    <div class="whatif-kpi"><div class="l">Coût total</div><div class="v">${eur(newCout,0)}</div><div class="d ${dCout<0?'up':'down'}">${dCout>=0?'+':''}${eur(dCout,0)}</div></div>
    <div class="whatif-kpi"><div class="l">Rent. brute</div><div class="v" style="color:var(--gold)">${newRent.toFixed(2)}%</div><div class="d ${dRent>0?'up':'down'}">${dRent>=0?'+':''}${dRent.toFixed(2)}pt</div></div>
    <div class="whatif-kpi"><div class="l">Cash-flow</div><div class="v" style="color:${newCF>=0?'var(--em)':'var(--ru)'}">${newCF>=0?'+':''}${Math.round(newCF)}€</div><div class="d ${dCF>0?'up':'down'}">${dCF>=0?'+':''}${Math.round(dCF)}€</div></div>
    <div class="whatif-kpi"><div class="l">Score</div><div class="v" style="color:${newScore>=65?'var(--em)':newScore>=40?'var(--am)':'var(--ru)'}">${newScore}</div><div class="d ${dScore>0?'up':'down'}">${dScore>=0?'+':''}${dScore}</div></div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   DVF — Données de ventes immobilières (data.gouv.fr)
═══════════════════════════════════════════════════════════════ */
async function loadDVF(l){
  const section = g('dvfSection_'+l.id);
  if(!section || !l.cp) return;

  try{
    // Use API DVF from cquest (proxy around open data)
    const today = new Date();
    const twoYearsAgo = new Date(today.getFullYear()-2, today.getMonth(), today.getDate());
    const dateMin = twoYearsAgo.toISOString().slice(0,10);

    const url = `https://api.cquest.org/dvf?code_postal=${l.cp}&limit=50`;
    const res = await fetch(url);
    const data = await res.json();

    if(!data.resultats || data.resultats.length === 0){
      section.innerHTML = `
        <div class="dvf-title">📊 Transactions réelles du secteur (DVF)</div>
        <p style="font-size:.72rem;color:var(--ink3);padding:10px;text-align:center">Aucune transaction DVF trouvée pour le code postal ${l.cp}.</p>`;
      return;
    }

    // Filter by type similar to listing
    let txs = data.resultats.filter(t => t.nature_mutation === 'Vente' && t.valeur_fonciere > 10000);

    // Similar type filter
    if(l.type === 'Maison') txs = txs.filter(t => t.type_local === 'Maison');
    else if(l.type === 'Appartement' || l.type === 'Studio' || l.type === 'T2' || l.type === 'T3') txs = txs.filter(t => t.type_local === 'Appartement');

    if(!txs.length){
      section.innerHTML = `
        <div class="dvf-title">📊 Transactions réelles du secteur (DVF)</div>
        <p style="font-size:.72rem;color:var(--ink3);padding:10px;text-align:center">Pas de ventes comparables trouvées.</p>`;
      return;
    }

    // Sort by date (recent first) and limit
    txs.sort((a,b) => (b.date_mutation||'').localeCompare(a.date_mutation||''));
    txs = txs.slice(0, 20);

    // Stats
    const prices = txs.map(t=>t.valeur_fonciere).filter(p=>p>0);
    const avgPrix = prices.reduce((s,p)=>s+p,0) / prices.length;
    const surfaces = txs.map(t=>t.surface_reelle_bati||0).filter(s=>s>0);
    const pricesM2 = txs.filter(t=>t.valeur_fonciere>0 && t.surface_reelle_bati>0).map(t=>t.valeur_fonciere/t.surface_reelle_bati);
    const avgM2 = pricesM2.reduce((s,p)=>s+p,0) / (pricesM2.length||1);

    // Compare to listing
    const listingM2 = l.prixM2;
    const diffM2 = listingM2 - avgM2;
    const diffPct = avgM2 > 0 ? ((diffM2/avgM2)*100) : 0;

    let verdict = '';
    if(diffPct < -10) verdict = `<span class="down">📉 <strong>${Math.abs(diffPct).toFixed(0)}% moins cher</strong> que le marché local → bon prix</span>`;
    else if(diffPct > 15) verdict = `<span class="up">📈 <strong>${diffPct.toFixed(0)}% plus cher</strong> que le marché local → potentiel de négociation</span>`;
    else verdict = `<strong>Dans la moyenne du marché</strong> (écart ${diffPct>=0?'+':''}${diffPct.toFixed(0)}%)`;

    section.innerHTML = `
      <div class="dvf-title">📊 Transactions réelles du secteur (${txs.length} ventes sur 2 ans)</div>
      <div class="dvf-summary">
        <div class="dvf-kpi"><div class="v gold">${eur(Math.round(avgPrix),0)}</div><div class="l">Prix moyen</div></div>
        <div class="dvf-kpi"><div class="v gold">${eur(Math.round(avgM2),0)}/m²</div><div class="l">Prix m² moyen</div></div>
        <div class="dvf-kpi"><div class="v">${eur(Math.round(listingM2),0)}/m²</div><div class="l">Cette annonce</div></div>
      </div>
      <div class="dvf-vs">${verdict}</div>
      <div class="dvf-list">
        ${txs.slice(0,10).map(t=>{
          const d = t.date_mutation ? new Date(t.date_mutation).toLocaleDateString('fr-FR',{month:'2-digit',year:'2-digit'}) : '—';
          const addr = [t.numero_voie, t.type_voie, t.voie].filter(Boolean).join(' ') || t.commune || '—';
          const m2 = t.surface_reelle_bati ? t.surface_reelle_bati+'m²' : '—';
          return `<div class="dvf-tx">
            <div class="date">${d}</div>
            <div class="addr" title="${addr}">${addr}</div>
            <div class="price">${eur(t.valeur_fonciere,0)}</div>
            <div class="m2">${m2}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:.6rem;color:var(--ink4);margin-top:6px;text-align:center">Source : data.gouv.fr DVF · Dernières ventes ${l.cp}</div>
    `;
  } catch(e){
    console.warn('DVF load failed', e);
    section.innerHTML = `
      <div class="dvf-title">📊 Transactions réelles du secteur (DVF)</div>
      <p style="font-size:.72rem;color:var(--ink3);padding:10px;text-align:center">⚠ Impossible de charger les données DVF (${e.message||'erreur réseau'}).</p>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   CAPACITÉ D'EMPRUNT & RESTE À VIVRE
═══════════════════════════════════════════════════════════════ */
function calcCapacity(){
  const capacityPageActive = g('view-capacity')?.classList.contains('active');

  function capitalAt(mens, taux, duree){
    const t = taux/100/12, n = duree*12;
    return t > 0 ? mens * ((1 - Math.pow(1+t,-n))/t) : mens * n;
  }

  function mensualitePourCapital(capital, taux, duree, assurancePct){
    const t = taux/100/12, n = duree*12;
    const credit = t > 0 ? capital * (t*Math.pow(1+t,n))/(Math.pow(1+t,n)-1) : capital/n;
    const assurance = capital * (assurancePct/100) / 12;
    return credit + assurance;
  }

  function capitalAvecAssurance(mensMax, taux, duree, assurancePct){
    if(mensMax <= 0) return 0;
    let lo = 0, hi = 2000000;
    for(let i=0;i<70;i++){
      const mid = (lo+hi)/2;
      if(mensualitePourCapital(mid,taux,duree,assurancePct) <= mensMax) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  if(capacityPageActive){
    const salaire1 = vn('cap_salaire1');
    const salaire2 = vn('cap_salaire2');
    const autresStables = vn('cap_autres') * 0.70;
    const primesMensuelles = (vn('cap_primes') / 12) * 0.70;
    const loyerFuturRetenu = vn('cap_loyerFutur') * 0.70;

    const revenus = salaire1 + salaire2 + autresStables + primesMensuelles + loyerFuturRetenu;
    const charges = vn('cap_credAuto') + vn('cap_credImmo') + vn('cap_credConso') + vn('cap_pension');
    const taux = vn('cap_taux') || 3.50;
    const duree = Math.min(27, Math.max(5, vn('cap_duree') || 20));
    const apport = vn('cap_apport');
    const assurancePct = vn('cap_ass') || 0.36;
    const personnes = Math.max(1, vn('cap_personnes') || 1);

    if(!revenus){
      g('capacityResult').innerHTML = `<div class="nodata"><span class="ico">💰</span><h3>Renseignez votre situation</h3><p>Indiquez au moins un revenu mensuel pour calculer la capacité d'emprunt.</p></div>`;
      return;
    }

    const mensualiteMax = Math.max(0, revenus * 0.35 - charges);
    const capCurrent = capitalAvecAssurance(mensualiteMax, taux, duree, assurancePct);
    const cap20 = capitalAvecAssurance(mensualiteMax, taux, 20, assurancePct);
    const cap25 = capitalAvecAssurance(mensualiteMax, taux, 25, assurancePct);
    const budgetTotal = capCurrent + apport;
    const prixBienMax = Math.round(budgetTotal / 1.085);
    const endettementActuel = revenus > 0 ? (charges / revenus) * 100 : 0;
    const endettementProjet = revenus > 0 ? ((charges + mensualiteMax) / revenus) * 100 : 0;
    const resteVivre = revenus - charges - mensualiteMax;
    const resteMinIndicatif = 800 + Math.max(0, personnes-1) * 350;

    let eligCls='ok', eligMsg='';
    if(mensualiteMax <= 0){
      eligCls='ko';
      eligMsg = `✗ Vos charges actuelles dépassent ou atteignent déjà le plafond HCSF de 35%. Diminuez les charges ou augmentez l'apport.`;
    } else if(resteVivre < resteMinIndicatif){
      eligCls='warn';
      eligMsg = `⚠ Capacité théorique positive, mais reste à vivre faible : ${eur(resteVivre,0)}/mois pour ${personnes} personne(s).`;
    } else {
      eligMsg = `✓ Capacité estimée conforme au plafond HCSF : endettement projeté à ${endettementProjet.toFixed(1)}%.`;
    }

    window.lastCapacityBudget = prixBienMax;

    g('capacityResult').innerHTML = `
      <div class="capacity-box">
        <div class="capacity-title">💰 Capacité d'emprunt estimée</div>
        <div class="cap-result">
          <div class="cap-kpi"><div class="cv">${eur(mensualiteMax,0)}</div><div class="cl">Mensualité max assurance incluse</div></div>
          <div class="cap-kpi"><div class="cv">${eur(Math.round(capCurrent),0)}</div><div class="cl">Capital empruntable (${duree} ans)</div></div>
          <div class="cap-kpi"><div class="cv">${eur(prixBienMax,0)}</div><div class="cl">Prix bien max frais inclus estimés</div></div>
        </div>
        <div class="cap-result" style="margin-top:8px">
          <div class="cap-kpi"><div class="cv">${eur(Math.round(cap20),0)}</div><div class="cl">Sur 20 ans</div></div>
          <div class="cap-kpi"><div class="cv">${eur(Math.round(cap25),0)}</div><div class="cl">Sur 25 ans</div></div>
          <div class="cap-kpi"><div class="cv">${eur(resteVivre,0)}</div><div class="cl">Reste à vivre après projet</div></div>
        </div>
        <div class="cap-gauge" style="margin-top:14px">
          <div class="cap-gauge-label"><span>Endettement actuel : ${endettementActuel.toFixed(1)}%</span><span>Projeté : ${endettementProjet.toFixed(1)}%</span></div>
          <div class="cap-gauge-bar">
            <div class="cap-gauge-limit" style="left:35%"></div>
            <div class="cap-gauge-fill" style="width:${Math.min(100,endettementProjet)}%;background:${endettementProjet<=35?'var(--em)':endettementProjet<=38?'var(--am)':'var(--ru)'}"></div>
          </div>
        </div>
        <div class="cap-eligibility ${eligCls}">${eligMsg}</div>
        <div style="font-size:.66rem;color:var(--ink3);margin-top:8px;line-height:1.45">
          Hypothèses : revenus locatifs futurs retenus à 70%, revenus variables retenus à 70%, frais de notaire estimés à 8,5%.
          Calcul indicatif, à confirmer avec une banque ou un courtier.
        </div>
      </div>`;
    addNotif('Capacité d\'emprunt calculée — budget max '+eur(prixBienMax,0),'info');
    return;
  }

  const revenus = vn('revenusMenage');
  const autres = vn('autresCredits');
  if(!revenus){toast('Renseignez d\'abord vos revenus nets mensuels','err');return;}

  const maxMensualite = Math.max(0, (revenus * 0.35) - autres);
  const tauxActuel = vn('tauxPret')||3.5;
  const dureeActuelle = vn('dureePret')||20;

  const cap20 = capitalAt(maxMensualite, tauxActuel, 20);
  const cap25 = capitalAt(maxMensualite, tauxActuel, 25);
  const capCurrent = capitalAt(maxMensualite, tauxActuel, dureeActuelle);

  let mensImmo = 0;
  if(R) mensImmo = R.mensFin || 0;
  const resteVivreAvant = revenus - autres;
  const resteVivreApres = revenus - autres - mensImmo;
  const apportMin = capCurrent * 0.1;
  const budgetTotal = capCurrent + apportMin;
  const prixBienMax = Math.round(budgetTotal / 1.085);

  let eligCls = 'ok', eligMsg = '';
  if(mensImmo > 0){
    const ratio = ((mensImmo + autres) / revenus) * 100;
    if(ratio <= 33) {eligCls='ok';eligMsg=`✓ Votre projet actuel est <strong>dans les clous</strong> (${ratio.toFixed(1)}% d'endettement). Les banques accepteront plus facilement votre dossier.`;}
    else if(ratio <= 35) {eligCls='warn';eligMsg=`⚠ Endettement à ${ratio.toFixed(1)}% — <strong>limite HCSF</strong>. Dossier acceptable mais peu de marge.`;}
    else {eligCls='ko';eligMsg=`✗ Endettement à ${ratio.toFixed(1)}% — <strong>dépasse le seuil HCSF de 35%</strong>. Réduisez le projet, augmentez l'apport ou allongez la durée si possible.`;}
  } else {
    eligMsg = `💡 Calculez un bien dans le simulateur pour voir si votre projet respecte le seuil HCSF de 35%.`;
  }

  const out = g('simCapacityResult') || g('capacityResult');
  out.innerHTML = `
    <div class="capacity-box">
      <div class="capacity-title">💰 Capacité d'emprunt & reste à vivre</div>
      <div class="cap-result">
        <div class="cap-kpi"><div class="cv">${eur(maxMensualite,0)}</div><div class="cl">Mensualité max</div></div>
        <div class="cap-kpi"><div class="cv">${eur(Math.round(capCurrent),0)}</div><div class="cl">Capital empruntable (${dureeActuelle}a)</div></div>
        <div class="cap-kpi"><div class="cv">${eur(prixBienMax,0)}</div><div class="cl">Prix bien max</div></div>
      </div>
      <div class="cap-result" style="margin-top:8px">
        <div class="cap-kpi"><div class="cv">${eur(Math.round(cap20),0)}</div><div class="cl">Sur 20 ans</div></div>
        <div class="cap-kpi"><div class="cv">${eur(Math.round(cap25),0)}</div><div class="cl">Sur 25 ans (max)</div></div>
        <div class="cap-kpi"><div class="cv">${eur(Math.round(apportMin),0)}</div><div class="cl">Apport min (10%)</div></div>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--em-b)">
        <div style="font-size:.72rem;font-weight:700;color:var(--em);margin-bottom:8px">📊 Reste à vivre</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="cap-kpi"><div class="cv">${eur(resteVivreAvant,0)}</div><div class="cl">Avant investissement</div></div>
          <div class="cap-kpi"><div class="cv" style="color:${resteVivreApres>=1500?'var(--em)':resteVivreApres>=1000?'var(--am)':'var(--ru)'}">${eur(resteVivreApres,0)}</div><div class="cl">Après investissement</div></div>
        </div>
        <div style="font-size:.67rem;color:var(--ink3);margin-top:6px;line-height:1.5">
          Après paiement de <strong>${eur(mensImmo,0)}</strong> de mensualité immo + <strong>${eur(autres,0)}</strong> d'autres crédits, il vous reste ${eur(resteVivreApres,0)}/mois.
          ${resteVivreApres < 1200 ? '<br/><strong style="color:var(--ru)">⚠ Reste à vivre faible</strong> — prévoyez une marge de sécurité.' : ''}
        </div>
      </div>
      <div class="cap-eligibility ${eligCls}" style="margin-top:12px">${eligMsg}</div>
    </div>`;

  addNotif('Capacité d\'emprunt calculée — max '+eur(Math.round(capCurrent),0),'info');
}

function applyCapacityToFilters(){
  const budget = window.lastCapacityBudget || 0;
  if(!budget){
    calcCapacity();
  }
  const finalBudget = window.lastCapacityBudget || 0;
  if(!finalBudget){
    toast('Calculez d\'abord votre capacité d\'emprunt','err');
    return;
  }
  if(g('sPrixMax')) g('sPrixMax').value = Math.max(0, Math.round(finalBudget));
  gv('search');
  setTimeout(()=>{
    if(typeof filterListings === 'function') filterListings();
    toast('Filtre budget appliqué : prix max '+eur(finalBudget,0),'ok');
  },80);
}

/* ═══════════════════════════════════════════════════════════════
   CHAT IA FLOTTANT — Assistant conversationnel
═══════════════════════════════════════════════════════════════ */
let chatHistory = [];
let chatContextListing = null;

function toggleChat(){
  const w = g('chatWindow');
  const b = g('chatBubble');
  const open = w.classList.toggle('open');
  b.classList.toggle('active', open);
  b.innerHTML = open ? '✕' : '✦';
  if(open) updateChatContext();
}

function updateChatContext(){
  const el = g('chatContext');
  if(!el) return;
  if(chatContextListing){
    el.innerHTML = `<div class="chat-ctx-pill">🎯 Contexte : ${chatContextListing.title.substring(0,40)}${chatContextListing.title.length>40?'…':''}</div>`;
  } else if(R){
    el.innerHTML = `<div class="chat-ctx-pill">🎯 Contexte : simulation actuelle</div>`;
  } else {
    el.innerHTML = '';
  }
}

async function askChat(predefined){
  const input = g('chatInput');
  const q = predefined || input?.value?.trim();
  if(!q) return;

  // Add user message
  const messages = g('chatMessages');
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.textContent = q;
  messages.appendChild(userMsg);
  input.value = '';
  messages.scrollTop = messages.scrollHeight;

  // Add typing indicator
  const typing = document.createElement('div');
  typing.className = 'chat-msg ai typing';
  typing.textContent = '✦ L\'assistant réfléchit...';
  messages.appendChild(typing);
  messages.scrollTop = messages.scrollHeight;
  g('chatSendBtn').disabled = true;

  // Build context
  let contextStr = '';
  if(chatContextListing){
    const l = chatContextListing;
    contextStr = `\n\nContexte — annonce en cours d'analyse :
- Titre : ${l.title}
- Prix : ${l.prix}€ / ${l.surface}m² / ${l.type} à ${l.ville}
- Loyer : ${l.loyer}€/mois
- Rentabilité brute : ${l.rentBrute.toFixed(1)}%
- Cash-flow : ${Math.round(l.cfMensuel)}€/mois
- Score : ${l.score}/100
- DPE : ${l.dpe||'?'}
- Travaux : ${l.travaux||0}€
- Locataire en place : ${l.locataireEnPlace?'Oui':'Non'}
- Description : ${l.description?.substring(0,200)}`;
  } else if(R){
    contextStr = `\n\nContexte — simulation en cours :
- Prix : ${R.pa}€ / ${R.surface||'?'}m² à ${R.ville||'?'}
- Loyer : ${R.loyerM}€/mois
- Rentabilité brute : ${R.rentBrute?.toFixed(1)}%
- Cash-flow : ${Math.round(R.cfAvant)}€/mois
- Régime : ${R.desc}`;
  }

  const prompt = `Tu es un expert en investissement immobilier locatif français (fiscalité, rentabilité, négociation, stratégie patrimoniale). Réponds en français, de manière concise et directe (max 150 mots). Utilise des listes à puces quand c'est pertinent. Tu peux utiliser du markdown (gras avec **, listes avec -).${contextStr}

Historique de la conversation :
${chatHistory.map(m=>`${m.role}: ${m.content}`).join('\n')}

Question : ${q}`;

  try{
    const answer = await callClaudeAPI(prompt, false, 600);
    typing.remove();

    // Parse basic markdown
    let html = answer
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g,'<br/><br/>')
      .replace(/\n/g,'<br/>');

    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg ai';
    aiMsg.innerHTML = html;
    messages.appendChild(aiMsg);

    chatHistory.push({role:'user', content:q});
    chatHistory.push({role:'assistant', content:answer});
    if(chatHistory.length > 10) chatHistory.splice(0, 2); // keep last 5 exchanges

  }catch(e){
    typing.remove();
    const errMsg = document.createElement('div');
    errMsg.className = 'chat-msg ai';
    errMsg.innerHTML = `⚠ Erreur : ${e.message}<br/><em style="font-size:.68rem">Vérifiez votre clé API dans les filtres.</em>`;
    messages.appendChild(errMsg);
  }

  messages.scrollTop = messages.scrollHeight;
  g('chatSendBtn').disabled = false;
}

// Set chat context when opening listing detail
const _origOpenDetail = openDetail;
openDetail = function(id){
  chatContextListing = listings.find(x=>x.id===id);
  _origOpenDetail(id);
  updateChatContext();
};

/* ═══════════════════════════════════════════════════════════════
   NÉGOCIATION ASSISTÉE PAR IA
═══════════════════════════════════════════════════════════════ */
async function runNegoAI(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  const box = g('negoBox_'+id);
  box.innerHTML = '<div class="nego-title">💬 Négociation assistée par IA</div><div class="ai-loading"><div class="spinner"></div>Analyse des points de négociation…</div>';

  const prompt = `Tu es un expert négociateur immobilier. Analyse cette annonce et génère un argumentaire de négociation PRÉCIS et ACTIONNABLE pour faire baisser le prix. Réponds UNIQUEMENT en JSON valide (pas de markdown):

{
  "prix_cible": nombre (prix de négociation réaliste),
  "reduction_pct": nombre (% de baisse visé),
  "points_faibles_exploitables": ["point concret à évoquer 1", "..."],
  "arguments_cles": ["argument 1 court", "argument 2", "..."],
  "script_ouverture": "phrase d'ouverture à utiliser face au vendeur (20-30 mots)",
  "pieges_eviter": ["piège 1", "..."]
}

ANNONCE:
Titre: ${l.title}
Prix affiché: ${l.prix}€
Prix/m²: ${Math.round(l.prixM2)}€
Surface: ${l.surface}m²
Type: ${l.type}
Ville: ${l.ville}
DPE: ${l.dpe||'non renseigné'}
Travaux estimés: ${l.travaux||0}€
Locataire en place: ${l.locataireEnPlace?'Oui':'Non'}
Rentabilité brute estimée: ${l.rentBrute.toFixed(1)}%
Description: ${l.description}`;

  try{
    const text = await callClaudeAPI(prompt, false, 1200);
    const clean = text.replace(/```json|```/g,'').trim();
    const nego = JSON.parse(clean);
    l.negoAnalysis = nego;

    box.innerHTML = `
      <div class="nego-title">💬 Stratégie de négociation</div>
      <div class="nego-price-target">
        <div class="npt-label">Prix cible recommandé</div>
        <div class="npt-val">${eur(nego.prix_cible,0)}</div>
        <div class="npt-save">Économie potentielle : ${eur(l.prix - nego.prix_cible,0)} (-${nego.reduction_pct}%)</div>
      </div>
      <div class="nego-content">
        <h5>🎯 Points faibles à exploiter</h5>
        <ul>${nego.points_faibles_exploitables.map(p=>'<li>'+p+'</li>').join('')}</ul>
        <h5>💡 Arguments clés</h5>
        <ul>${nego.arguments_cles.map(a=>'<li>'+a+'</li>').join('')}</ul>
        <h5>🗣 Script d'ouverture</h5>
        <div style="background:var(--bg2);border-left:3px solid var(--pu);padding:10px 14px;border-radius:var(--r);font-style:italic;color:var(--ink2);line-height:1.5">« ${nego.script_ouverture} »</div>
        <h5>⚠ Pièges à éviter</h5>
        <ul>${nego.pieges_eviter.map(p=>'<li>'+p+'</li>').join('')}</ul>
      </div>
    `;
    addNotif('Stratégie de négociation générée ✓','info');
  }catch(e){
    box.innerHTML = `<div class="nego-title">💬 Négociation assistée</div><p style="font-size:.73rem;color:var(--ru)">⚠ Erreur : ${e.message}</p>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ANALYSE DE QUARTIER PAR IA
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   CHAT IA CONTEXTUALISÉ — par annonce
═══════════════════════════════════════════════════════════════ */
const chatHistories = {}; // id → messages[]

function chatListingAsk(id, question){
  g('chatInput_'+id).value = question;
  chatListingSend(id);
}

async function chatListingSend(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  const input = g('chatInput_'+id);
  const msgEl = g('chatMsgs_'+id);
  const question = (input.value||'').trim();
  if(!question) return;

  // Init history
  if(!chatHistories[id]) chatHistories[id] = [];

  // Clear empty state on first message
  if(!chatHistories[id].length){
    msgEl.innerHTML = '';
  }

  // Add user message
  chatHistories[id].push({role:'user', content:question});
  msgEl.innerHTML += `<div class="chat-msg user">${escapeHTML(question)}</div>`;
  input.value = '';
  msgEl.scrollTop = msgEl.scrollHeight;

  // Loading indicator
  const loadingId = 'ld_'+Date.now();
  msgEl.innerHTML += `<div class="chat-msg loading" id="${loadingId}">✦ L'IA réfléchit...</div>`;
  msgEl.scrollTop = msgEl.scrollHeight;

  // Build prompt with listing context
  const contextPrompt = `Tu es un conseiller en investissement immobilier locatif français expert. Tu aides l'utilisateur à analyser une annonce spécifique.

CONTEXTE DE L'ANNONCE :
- Titre : ${l.title}
- Prix : ${eur(l.prix,0)}
- Surface : ${l.surface} m² (${l.pieces} pièces)
- Type : ${l.type}
- Ville : ${l.ville} (${l.cp||''})
- DPE : ${l.dpe||'Non renseigné'}
- Loyer ${l.loyerActuel?'actuel':'estimé'} : ${eur(l.loyer,0)}/mois
- Taxe foncière : ${eur(l.taxeFonciere||0,0)}/an
- Charges copropriété : ${eur(l.chargesCopro||0,0)}/an
- Travaux estimés : ${eur(l.travaux||0,0)}
- Locataire en place : ${l.locataireEnPlace?'Oui':'Non'}
- Description : ${l.description||'(aucune)'}

INDICATEURS CALCULÉS :
- Prix au m² : ${eur(l.prixM2,0)}
- Rentabilité brute : ${l.rentBrute.toFixed(2)}%
- Rentabilité nette : ${l.rentNette.toFixed(2)}%
- Cash-flow mensuel estimé : ${Math.round(l.cfMensuel)} €/mois
- Score investisseur : ${l.score}/100 (${l.verdictLabel})

QUESTION DE L'UTILISATEUR : ${question}

Réponds de façon claire, concise (max 150 mots), précise, avec des chiffres et des conseils actionnables. Utilise les données de l'annonce. Si une information manque, indique-le clairement.`;

  try {
    const response = await callClaudeAPI(contextPrompt, false, 500);
    document.getElementById(loadingId)?.remove();

    chatHistories[id].push({role:'assistant', content:response});
    const html = escapeHTML(response).replace(/\n/g,'<br/>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    msgEl.innerHTML += `<div class="chat-msg ai">${html}</div>`;
    msgEl.scrollTop = msgEl.scrollHeight;
  } catch(e) {
    document.getElementById(loadingId)?.remove();
    msgEl.innerHTML += `<div class="chat-msg ai" style="color:var(--ru)">⚠ Erreur : ${e.message}. Vérifiez votre clé API dans les filtres.</div>`;
    msgEl.scrollTop = msgEl.scrollHeight;
  }
}

function escapeHTML(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function runQuartierAI(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  const box = g('quartierBox_'+id);
  box.innerHTML = '<div class="quartier-title">📍 Analyse du quartier</div><div class="ai-loading"><div class="spinner"></div>Analyse du secteur…</div>';

  const prompt = `Analyse le quartier/secteur de ${l.ville} (${l.cp||''}) pour un investissement locatif. Réponds UNIQUEMENT en JSON valide (pas de markdown):

{
  "scores": {
    "commerces": nombre sur 10,
    "transports": nombre sur 10,
    "ecoles": nombre sur 10,
    "emploi": nombre sur 10,
    "securite": nombre sur 10,
    "dynamisme": nombre sur 10
  },
  "tension_locative": "faible|modérée|forte|très forte",
  "profil_locataires_type": "description courte (étudiants, jeunes actifs, familles, seniors…)",
  "projets_urbains": "projets en cours/prévus dans le secteur (rénovation, tramway, etc.) ou 'aucun connu'",
  "synthese": "résumé investisseur en 2-3 phrases",
  "points_forts": ["atout 1", "atout 2", "atout 3"],
  "points_vigilance": ["point 1", "point 2"]
}`;

  try{
    const text = await callClaudeAPI(prompt, false, 1000);
    const clean = text.replace(/```json|```/g,'').trim();
    const q = JSON.parse(clean);
    l.quartierAnalysis = q;

    const icons = {commerces:'🛒',transports:'🚍',ecoles:'🎓',emploi:'💼',securite:'🛡',dynamisme:'📈'};
    const labels = {commerces:'Commerces',transports:'Transports',ecoles:'Écoles',emploi:'Emploi',securite:'Sécurité',dynamisme:'Dynamisme'};

    box.innerHTML = `
      <div class="quartier-title">📍 Analyse du quartier — ${l.ville}</div>
      <div class="quartier-grid" style="grid-template-columns:repeat(6,1fr)">
        ${Object.entries(q.scores).map(([k,v])=>`
          <div class="quartier-item">
            <div class="qi-icon">${icons[k]||'📍'}</div>
            <div class="qi-score">${v}/10</div>
            <div class="qi-label">${labels[k]||k}</div>
          </div>
        `).join('')}
      </div>
      <div class="quartier-summary">
        <strong style="color:var(--sa)">${q.synthese}</strong>
        <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><div style="font-size:.65rem;color:var(--sa);font-weight:700;margin-bottom:3px">🔑 Tension locative</div><div style="font-weight:700">${q.tension_locative}</div></div>
          <div><div style="font-size:.65rem;color:var(--sa);font-weight:700;margin-bottom:3px">👥 Profil locataires</div><div>${q.profil_locataires_type}</div></div>
        </div>
        <div style="margin-top:8px">
          <div style="font-size:.65rem;color:var(--sa);font-weight:700;margin-bottom:3px">🏗 Projets urbains</div>
          <div>${q.projets_urbains}</div>
        </div>
        <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div style="font-size:.65rem;color:var(--em);font-weight:700;margin-bottom:3px">✓ Points forts</div>
            <ul style="padding-left:16px;margin:0">${q.points_forts.map(p=>'<li style="font-size:.72rem">'+p+'</li>').join('')}</ul>
          </div>
          <div>
            <div style="font-size:.65rem;color:var(--am);font-weight:700;margin-bottom:3px">⚠ Points de vigilance</div>
            <ul style="padding-left:16px;margin:0">${q.points_vigilance.map(p=>'<li style="font-size:.72rem">'+p+'</li>').join('')}</ul>
          </div>
        </div>
      </div>
    `;
    addNotif('Analyse du quartier terminée ✓','info');
  }catch(e){
    box.innerHTML = `<div class="quartier-title">📍 Analyse du quartier</div><p style="font-size:.73rem;color:var(--ru)">⚠ Erreur : ${e.message}</p>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   CHECKLIST INSPECTION (persistance)
═══════════════════════════════════════════════════════════════ */
function saveInspec(listingId, key, checked){
  try{
    const data = JSON.parse(localStorage.getItem('immoV9_inspec_'+listingId)||'{}');
    data[key] = checked;
    localStorage.setItem('immoV9_inspec_'+listingId, JSON.stringify(data));
  }catch(e){}
}
function loadInspec(listingId){
  try{return JSON.parse(localStorage.getItem('immoV9_inspec_'+listingId)||'{}');}catch(e){return {};}
}

/* ═══════════════════════════════════════════════════════════════
   PARTAGE SHORTLIST
═══════════════════════════════════════════════════════════════ */
function shareShortlistLegacy(){
  if(!shortlist.length){toast('Shortlist vide','err');return;}
  // Create compressed data
  const compact = shortlist.map(l=>({
    t:l.title,p:l.prix,s:l.surface,pc:l.pieces,ty:l.type,v:l.ville,cp:l.cp,
    d:l.dpe,la:l.loyerActuel,le:l.loyerEstime,tf:l.taxeFonciere,cc:l.chargesCopro,
    tr:l.travaux,lo:l.locataireEnPlace,de:l.description?.substring(0,200),sr:l.source
  }));
  try{
    const json = JSON.stringify(compact);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = window.location.origin + window.location.pathname + '#shortlist=' + encoded;

    // Copy to clipboard
    navigator.clipboard?.writeText(url).then(()=>{
      toast('Lien copié dans le presse-papiers ✓','ok');
    }).catch(()=>{});

    // Show modal
    const html = `
      <div class="score-cust-overlay open" onclick="if(event.target===this)this.remove()" style="z-index:700">
        <div class="share-modal" onclick="event.stopPropagation()">
          <h3 style="font-family:'Libre Baskerville',serif;font-size:1.05rem;color:var(--gold);margin-bottom:8px">🔗 Partager votre shortlist</h3>
          <p style="font-size:.76rem;color:var(--ink3);margin-bottom:10px">${shortlist.length} biens sélectionnés. Le destinataire pourra les voir immédiatement sans avoir à installer quoi que ce soit.</p>
          <div class="share-url">${url}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-p" onclick="navigator.clipboard.writeText('${url.replace(/'/g,"\\'")}').then(()=>toast('Copié!','ok'))">📋 Copier le lien</button>
            <a class="btn btn-em" href="mailto:?subject=${encodeURIComponent('Ma shortlist immobilière')}&body=${encodeURIComponent('Voici ma sélection de biens à analyser : '+url)}" target="_blank">📧 Email</a>
            <a class="btn btn-b" href="https://wa.me/?text=${encodeURIComponent('Ma shortlist immobilière : '+url)}" target="_blank">💬 WhatsApp</a>
            <button class="btn btn-g" onclick="this.closest('.score-cust-overlay').remove()">Fermer</button>
          </div>
          <div style="font-size:.62rem;color:var(--ink4);margin-top:12px;line-height:1.5">
            ℹ Les données sont encodées dans l'URL (pas de serveur). La personne qui reçoit le lien verra exactement votre sélection avec les mêmes analyses.
          </div>
        </div>
      </div>`;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
    addNotif('Shortlist partagée ('+shortlist.length+' biens)','info');
  }catch(e){
    toast('Erreur de partage : '+e.message,'err');
  }
}

// Check for shared shortlist on load
(function checkSharedShortlist(){
  const hash = window.location.hash;
  if(hash.startsWith('#shortlist=')){
    try{
      const encoded = hash.substring('#shortlist='.length);
      const json = decodeURIComponent(escape(atob(encoded)));
      const compact = JSON.parse(json);
      const imported = compact.map((c,i)=>({
        id:'shared_'+i,title:c.t,prix:c.p,surface:c.s,pieces:c.pc,type:c.ty,
        ville:c.v,cp:c.cp,dpe:c.d,loyerActuel:c.la,loyerEstime:c.le,
        taxeFonciere:c.tf,chargesCopro:c.cc,travaux:c.tr,locataireEnPlace:c.lo,
        description:c.de,source:c.sr||'shared',img:'',date:new Date().toISOString().slice(0,10)
      }));
      imported.forEach(l=>analyzeListingLocal(l));
      setTimeout(()=>{
        listings = imported;
        filteredListings = [...listings];
        renderListings();
        toast(imported.length+' biens importés depuis un lien partagé ✓','ok');
        addNotif('Shortlist partagée reçue : '+imported.length+' biens','info');
        // Clean URL
        history.replaceState({},'',window.location.pathname);
      }, 500);
    }catch(e){console.warn('Shared shortlist parse failed',e);}
  }
})();

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD D'ACCUEIL
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   PROJECT PIPELINE — Intégration simulateur + agrégateur
═══════════════════════════════════════════════════════════════ */
const STAGE_CONFIG = {
  watch:   {label:'À étudier',   icon:'👀', color:'var(--sa)',  order:1, desc:'Analyse et pré-étude en cours'},
  contact: {label:'À contacter', icon:'📞', color:'#a78bf8',    order:2, desc:'Prendre contact avec le vendeur/agent'},
  visit:   {label:'À visiter',   icon:'🚪', color:'var(--am)',  order:3, desc:'Visite planifiée ou à caler'},
  offer:   {label:'Offre faite', icon:'📝', color:'var(--gold)',order:4, desc:'Proposition envoyée au vendeur'},
  accept:  {label:'Acceptée',    icon:'✅', color:'var(--em)',  order:5, desc:'Offre acceptée, procédure en cours'},
  sold:    {label:'Vendu',       icon:'🏆', color:'#4eca88',    order:6, desc:'Acte signé, bien acquis'},
  reject:  {label:'Abandonnée',  icon:'❌', color:'var(--ru)',  order:7, desc:'Refusée ou écartée'},
};

const MAX_PROJECTS_PER_STAGE = 10;

// Current simulator project state
let currentProject = null;

function getProjectId(){
  let id = localStorage.getItem('immoV9_currentProjectId');
  if(!id){
    id = 'proj_' + Date.now();
    localStorage.setItem('immoV9_currentProjectId', id);
  }
  return id;
}

function loadProjectState(){
  const id = getProjectId();
  try {
    const data = JSON.parse(localStorage.getItem('immoV9_project_'+id)||'{}');
    currentProject = {id, ...data};
    if(g('projectName')) g('projectName').value = data.name || '';
    if(g('projectNotes')) g('projectNotes').value = data.notes || '';
    updateStageButtons(data.stage);
    updateNextStepHint(data.stage);
  } catch(e){
    currentProject = {id};
  }
}

function saveProjectState(){
  const id = getProjectId();
  const data = {
    id,
    name: g('projectName')?.value?.trim() || '',
    notes: g('projectNotes')?.value?.trim() || '',
    stage: currentProject?.stage || null,
    stageDate: currentProject?.stageDate || null,
    // Snapshot of key simulation data
    prix: vn('prixAchat'),
    surface: vn('surface'),
    ville: tx('ville'),
    typeBien: tx('typeBien'),
    loyerMensuel: vn('loyerMensuel') || (R?.loyerM||0),
    rentBrute: R?.rentBrute || 0,
    cfAvant: R?.cfAvant || 0,
    score: R?.score || 0,
    lastUpdate: Date.now(),
  };
  try {
    localStorage.setItem('immoV9_project_'+id, JSON.stringify(data));
    currentProject = data;
    updatePipeBadge();
  }catch(e){}
}

function updateProjectName(){saveProjectState();}
function saveProjectNotes(){saveProjectState();toast('Notes sauvegardées','ok');}

function setProjectStage(stage){
  if(!currentProject) currentProject = {id:getProjectId()};
  const currentId = currentProject.id;

  // Check max 10 per stage (except current if already in that stage)
  const all = getAllProjects();
  const inStage = all.filter(p => p.stage === stage && p.id !== currentId).length;
  if(inStage >= MAX_PROJECTS_PER_STAGE){
    const cfg = STAGE_CONFIG[stage];
    toast(`Maximum atteint : ${MAX_PROJECTS_PER_STAGE} projets en "${cfg.label}". Archivez-en un avant d'en ajouter.`,'err');
    return;
  }

  currentProject.stage = stage;
  currentProject.stageDate = Date.now();
  updateStageButtons(stage);
  updateNextStepHint(stage);
  saveProjectState();
  const cfg = STAGE_CONFIG[stage];
  toast(`Dossier marqué "${cfg.label}" ${cfg.icon}`,'ok');
  addNotif(`Projet → ${cfg.label} ${cfg.icon}`,'info');
}

function updateStageButtons(stage){
  document.querySelectorAll('.stage-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.stage === stage);
  });
}

function updateNextStepHint(stage){
  const el = g('projectNextStep');
  if(!el) return;
  const hints = {
    watch: {title:'💡 Prochaines étapes recommandées',items:[
      'Analyser la rentabilité dans le simulateur',
      'Vérifier le prix via DVF (données de ventes réelles)',
      'Estimer les travaux éventuels',
      'Valider que le cash-flow est acceptable',
      '→ Si intéressant, passer à "📞 À contacter"'
    ]},
    contact: {title:'📞 Actions à faire maintenant',items:[
      'Appeler l\'agent ou le propriétaire',
      'Demander le DPE complet et la taxe foncière',
      'Demander les charges de copropriété (procès-verbaux AG)',
      'Vérifier l\'existence d\'un locataire et du bail',
      '→ Caler une visite → passer à "🚪 À visiter"'
    ]},
    visit: {title:'🚪 Préparer la visite',items:[
      'Imprimer la checklist de visite (électricité, plomberie, structure)',
      'Venir avec un mètre ou télémètre laser',
      'Prendre des photos de tout (défauts inclus)',
      'Interroger sur le voisinage, les nuisances, les projets d\'urbanisme',
      '→ Si convaincu, passer à "📝 Offre faite"'
    ]},
    offer: {title:'📝 Offre en cours',items:[
      'Envoyer une offre écrite (email + LRAR)',
      'Prévoir une clause suspensive d\'obtention de prêt',
      'Ne pas hésiter à négocier (moyenne observée : -5 à -10%)',
      'Avoir une simulation de prêt prête pour rassurer',
      '→ En cas d\'accord, passer à "✅ Acceptée"'
    ]},
    accept: {title:'✅ Offre acceptée — procédure en cours',items:[
      'Envoyer le dossier à la banque (3 devis si travaux)',
      'Signature du compromis chez le notaire (sous ~10 jours)',
      'Délai de rétractation : 10 jours',
      'Obtention du prêt : 30-60 jours',
      'Signature définitive : ~3 mois après compromis',
    ]},
    sold: {title:'🏆 Félicitations — Acte signé !',items:[
      'Déclarer le bien aux impôts (formulaire 2044 si locatif nu)',
      'Souscrire l\'assurance PNO (propriétaire non occupant)',
      'Déclarer le loyer si locataire en place',
      'Activer le régime fiscal optimal (LMNP réel, micro-foncier…)',
      'Mettre à jour votre portefeuille dans ImmoSim',
      '→ Passer à la recherche de la prochaine opportunité !',
    ]},
    reject: {title:'❌ Dossier abandonné',items:[
      'Noter les raisons dans vos notes privées',
      'Archiver le dossier — vous pouvez le rouvrir plus tard',
      'Chercher d\'autres opportunités dans la section Recherche',
    ]},
  };
  if(!hints[stage]){ el.style.display='none'; return; }
  el.style.display='block';
  el.innerHTML = `
    <span class="pns-title">${hints[stage].title}</span>
    <ul>${hints[stage].items.map(it=>`<li>${it}</li>`).join('')}</ul>
  `;
}

function newProject(){
  if(currentProject && (currentProject.name || currentProject.stage)){
    if(!confirm('Archiver le projet actuel et en créer un nouveau ?'))return;
  }
  localStorage.removeItem('immoV9_currentProjectId');
  currentProject = null;
  if(g('projectName')) g('projectName').value = '';
  if(g('projectNotes')) g('projectNotes').value = '';
  updateStageButtons(null);
  g('projectNextStep').style.display='none';
  getProjectId(); // creates new ID
  toast('Nouveau dossier créé ✓','ok');
}

function saveToPipeline(){
  // Validate we have data to save
  const nom = g('projectName')?.value?.trim();
  const hasPrice = vn('prixAchat') > 0;

  if(!nom && !hasPrice){
    toast('Renseignez au moins un nom de projet ou un prix','err');
    return;
  }

  // Force a calculation first to have fresh data
  if(hasPrice && typeof calc === 'function'){
    try{calc();}catch(e){}
  }

  // If no stage yet, default to "À étudier"
  if(!currentProject) currentProject = {id:getProjectId()};
  const currentId = currentProject.id;

  if(!currentProject.stage){
    // Check that "watch" stage isn't full before defaulting
    const all = getAllProjects();
    const watchCount = all.filter(p => p.stage === 'watch' && p.id !== currentId).length;
    if(watchCount >= MAX_PROJECTS_PER_STAGE){
      toast(`Maximum atteint : ${MAX_PROJECTS_PER_STAGE} projets en "À étudier". Archivez-en un d'abord.`,'err');
      return;
    }
    currentProject.stage = 'watch';
    currentProject.stageDate = Date.now();
    updateStageButtons('watch');
    updateNextStepHint('watch');
  } else {
    // Check capacity for current stage
    const all = getAllProjects();
    const stageCount = all.filter(p => p.stage === currentProject.stage && p.id !== currentId).length;
    if(stageCount >= MAX_PROJECTS_PER_STAGE){
      const cfg = STAGE_CONFIG[currentProject.stage];
      toast(`Maximum atteint : ${MAX_PROJECTS_PER_STAGE} projets en "${cfg.label}". Archivez-en un d'abord.`,'err');
      return;
    }
  }

  // If no name, auto-generate one
  if(!nom && hasPrice){
    const autoName = (tx('typeBien')||'Bien') + ' — ' + (tx('ville')||'Sans ville') + ' — ' + eur(vn('prixAchat'),0);
    if(g('projectName')) g('projectName').value = autoName;
    toast('Nom généré automatiquement','');
  }

  saveProjectState();
  updatePipeBadge();

  const stageName = STAGE_CONFIG[currentProject.stage]?.label || 'À étudier';
  toast(`✓ Projet "${g('projectName').value}" sauvegardé en "${stageName}"`,'ok');
  addNotif(`💾 Projet sauvegardé dans pipeline → ${stageName}`,'info');

  // Ask if user wants to view the pipeline
  setTimeout(()=>{
    if(confirm('Projet sauvegardé ✓\n\nVoir votre pipeline maintenant ?')){
      gv('pipeline');
    }
  }, 400);
}

/* ═══════════════════════════════════════════════════════════════
   PIPELINE KANBAN — aggregates simulator projects + listings
═══════════════════════════════════════════════════════════════ */
function getAllProjects(){
  const projects = [];
  // Gather all simulator projects
  try {
    for(let i=0;i<localStorage.length;i++){
      const key = localStorage.key(i);
      if(key && key.startsWith('immoV9_project_')){
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if(data && (data.name || data.stage)){
            projects.push({
              id: data.id,
              kind: 'sim',
              title: data.name || (data.ville ? (data.typeBien+' — '+data.ville) : 'Dossier sans nom'),
              stage: data.stage,
              stageDate: data.stageDate,
              prix: data.prix,
              surface: data.surface,
              ville: data.ville,
              loyer: data.loyerMensuel,
              rentBrute: data.rentBrute,
              cfAvant: data.cfAvant,
              score: data.score,
              lastUpdate: data.lastUpdate,
              notes: data.notes,
            });
          }
        } catch(e){}
      }
    }
  } catch(e){}

  // Gather listings with pipeline stage
  listings.forEach(l=>{
    const ps = getPipelineStage(l.id);
    if(ps && ps.stage){
      projects.push({
        id: l.id,
        kind: 'listing',
        title: l.title,
        stage: ps.stage,
        stageDate: ps.ts,
        prix: l.prix,
        surface: l.surface,
        ville: l.ville,
        loyer: l.loyer,
        rentBrute: l.rentBrute,
        cfAvant: l.cfMensuel,
        score: l.score,
        source: l.source,
        url: l.url,
        listingRef: l,
      });
    }
  });

  return projects;
}

function updatePipeBadge(){
  const all = getAllProjects();
  const active = all.filter(p=>p.stage && p.stage !== 'reject').length;
  const badge = g('pipeBadge');
  if(badge) badge.textContent = active;
}

function renderPipeline(){
  const all = getAllProjects();

  // Stats
  const statsEl = g('pipelineStats');
  if(statsEl){
    statsEl.innerHTML = Object.entries(STAGE_CONFIG).map(([key,cfg])=>{
      const count = all.filter(p=>p.stage===key).length;
      return `<div class="pipe-stat ${key}">
        <div class="ps-val">${count}<span style="font-size:.62rem;color:var(--ink3);font-weight:400">/${MAX_PROJECTS_PER_STAGE}</span></div>
        <div class="ps-lbl">${cfg.icon} ${cfg.label}</div>
      </div>`;
    }).join('');
  }

  // Board
  const boardEl = g('pipelineBoard');
  if(!boardEl) return;

  boardEl.innerHTML = Object.entries(STAGE_CONFIG).map(([stage,cfg])=>{
    const items = all.filter(p=>p.stage===stage).sort((a,b)=>(b.stageDate||0)-(a.stageDate||0));
    const count = items.length;
    const full = count >= MAX_PROJECTS_PER_STAGE;
    const pctFill = Math.min(100, (count/MAX_PROJECTS_PER_STAGE)*100);
    return `<div class="pipe-col ${stage} ${full?'full':''}">
      <div class="pipe-col-header">
        <h4>${cfg.icon} ${cfg.label} <span class="count ${full?'count-full':''}">${count}/${MAX_PROJECTS_PER_STAGE}</span></h4>
        <div class="desc">${cfg.desc}</div>
        <div class="col-capacity-bar"><div class="col-capacity-fill" style="width:${pctFill}%;background:${full?'var(--ru)':count>=7?'var(--am)':cfg.color}"></div></div>
      </div>
      <div class="pipe-items">
        ${items.length ? items.map(p=>renderPipeItem(p,stage)).join('') : `<div class="pipe-empty"><span class="ico">${cfg.icon}</span>Vide</div>`}
      </div>
    </div>`;
  }).join('');

  updatePipeBadge();
}

function renderPipeItem(p, currentStage){
  const ago = p.stageDate ? Math.round((Date.now()-p.stageDate)/86400000) : 0;
  const ageStr = ago===0?'aujourd\'hui':ago===1?'hier':ago+'j';
  const srcColors = {leboncoin:'#F56B2A',seloger:'#E00034',bienici:'#6C5CE7',pap:'#00B894',logicimmo:'#0984E3'};
  const srcColor = p.source ? (srcColors[p.source]||'var(--ink3)') : 'var(--pu)';
  const sourceLabel = p.kind === 'sim' ? 'Simulateur' : p.source;

  // Stage move buttons
  const stages = Object.keys(STAGE_CONFIG);
  const curIdx = stages.indexOf(currentStage);
  const prevStage = curIdx > 0 ? stages[curIdx-1] : null;
  const nextStage = curIdx < stages.length-1 ? stages[curIdx+1] : null;

  return `<div class="pipe-item" onclick="openPipeItem('${p.id}','${p.kind}')">
    <div class="pipe-item-title">${p.title}</div>
    <div class="pipe-item-meta">${p.ville||'—'} ${p.surface?'· '+p.surface+'m²':''} ${p.prix?'· '+eur(p.prix,0):''}</div>
    <div class="pipe-item-kpis">
      ${p.rentBrute?`<span class="pipe-item-kpi gold">${p.rentBrute.toFixed(1)}%</span>`:''}
      ${p.cfAvant!==undefined?`<span class="pipe-item-kpi ${p.cfAvant>=0?'pos':'neg'}">${p.cfAvant>=0?'+':''}${Math.round(p.cfAvant)}€/m</span>`:''}
      ${p.score?`<span class="pipe-item-kpi">Score ${p.score}</span>`:''}
    </div>
    <div class="pipe-item-date">
      <span class="pipe-item-source" style="background:${srcColor}">${sourceLabel}</span>
      <span>${ageStr}</span>
    </div>
    <div class="pipe-item-moves" onclick="event.stopPropagation()">
      ${prevStage?`<button onclick="movePipeItem('${p.id}','${p.kind}','${prevStage}')">← ${STAGE_CONFIG[prevStage].icon}</button>`:'<button disabled style="opacity:.3">—</button>'}
      ${nextStage?`<button onclick="movePipeItem('${p.id}','${p.kind}','${nextStage}')">${STAGE_CONFIG[nextStage].icon} →</button>`:'<button disabled style="opacity:.3">—</button>'}
    </div>
  </div>`;
}

function movePipeItem(id, kind, newStage){
  // Check max 10 per stage
  const all = getAllProjects();
  const inStage = all.filter(p => p.stage === newStage && p.id !== id).length;
  if(inStage >= MAX_PROJECTS_PER_STAGE){
    const cfg = STAGE_CONFIG[newStage];
    toast(`Maximum atteint : ${MAX_PROJECTS_PER_STAGE} projets en "${cfg.label}". Archivez-en un avant d'en ajouter.`,'err');
    return;
  }

  if(kind === 'sim'){
    try {
      const key = 'immoV9_project_'+id;
      const data = JSON.parse(localStorage.getItem(key)||'{}');
      data.stage = newStage;
      data.stageDate = Date.now();
      localStorage.setItem(key, JSON.stringify(data));
    } catch(e){}
  } else {
    setPipelineStage(id, newStage);
  }
  renderPipeline();
  toast(`Déplacé vers "${STAGE_CONFIG[newStage].label}" ${STAGE_CONFIG[newStage].icon}`,'ok');
}

function openPipeItem(id, kind){
  if(kind === 'sim'){
    // Switch to this simulator project
    localStorage.setItem('immoV9_currentProjectId', id);
    toast('Projet chargé — allez dans le simulateur','ok');
    gv('sim');
  } else {
    gv('search');
    setTimeout(()=>openDetail(id), 100);
  }
}

function exportPipelineCSV(){
  const all = getAllProjects();
  if(!all.length){toast('Pipeline vide','err');return;}
  const headers = ['Titre','Étape','Ville','Prix','Surface','Loyer','Rentabilité','Cash-flow','Score','Type','Dernière MAJ','Notes'];
  const rows = all.map(p=>[
    '"'+(p.title||'').replace(/"/g,'""')+'"',
    STAGE_CONFIG[p.stage]?.label||'—',
    p.ville||'',p.prix||'',p.surface||'',p.loyer||'',
    p.rentBrute?.toFixed(1)||'',p.cfAvant?Math.round(p.cfAvant):'',p.score||'',
    p.kind, p.lastUpdate?new Date(p.lastUpdate).toLocaleDateString('fr-FR'):'',
    '"'+(p.notes||'').replace(/"/g,'""').replace(/\n/g,' ')+'"'
  ].join(','));
  const csv = '\uFEFF'+headers.join(',')+'\n'+rows.join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Pipeline_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast('Pipeline exporté ✓','ok');
}

function renderDashboard(){
  // Hero stats
  const matches = alertProfile ? listings.filter(l=>l.matchPct>=70).length : 0;
  const bonnes = listings.filter(l=>l.verdict==='good').length;
  const cfPos = listings.filter(l=>l.cfMensuel>0).length;
  const avgScore = listings.length?Math.round(listings.reduce((s,l)=>s+l.score,0)/listings.length):0;

  const heroStats = g('dashHeroStats');
  if(heroStats){
    heroStats.innerHTML = `
      <div class="dhs-card"><div class="dhs-val">${listings.length}</div><div class="dhs-lbl">Annonces</div></div>
      <div class="dhs-card"><div class="dhs-val">${shortlist.length}</div><div class="dhs-lbl">Shortlist</div></div>
      <div class="dhs-card"><div class="dhs-val">${bonnes}</div><div class="dhs-lbl">Bonnes affaires</div></div>
      <div class="dhs-card"><div class="dhs-val">${avgScore}</div><div class="dhs-lbl">Score moyen</div></div>
    `;
  }

  // Latest listings
  const latestEl = g('dashLatestListings');
  if(latestEl){
    const latest = [...listings].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);
    if(!latest.length){
      latestEl.innerHTML = `<div class="dash-empty"><span class="ico">🏘</span>Aucune annonce chargée<br/><button class="btn btn-p btn-sm" style="margin-top:10px" onclick="loadDemoListings();setTimeout(renderDashboard,100)">📦 Charger démo</button></div>`;
    } else {
      latestEl.innerHTML = latest.map(l=>{
        const scCol = l.score>=65?'var(--em)':l.score>=40?'var(--am)':'var(--ru)';
        return `<div class="dash-listing" onclick="gv('search');setTimeout(()=>openDetail('${l.id}'),100)">
          <div class="dash-listing-score" style="border-color:${scCol};color:${scCol}">${l.score}</div>
          ${l.img?`<img src="${l.img}" class="dash-listing-img" onerror="this.style.display='none'"/>`:'<div class="dash-listing-img" style="display:flex;align-items:center;justify-content:center;color:var(--ink4)">🏠</div>'}
          <div class="dash-listing-info">
            <div class="dash-listing-title">${l.title}</div>
            <div class="dash-listing-meta">${l.ville} · ${l.surface}m² · ${l.type}</div>
          </div>
          <div class="dash-listing-kpis">
            <span class="dlk" style="color:var(--gold)">${eur(l.prix,0)}</span>
            <span class="dlk" style="color:var(--gold)">${l.rentBrute.toFixed(1)}%</span>
          </div>
        </div>`;
      }).join('');
    }
  }

  // Shortlist preview
  const shortEl = g('dashShortlist');
  if(shortEl){
    if(!shortlist.length){
      shortEl.innerHTML = `<div class="dash-empty"><span class="ico">⭐</span>Shortlist vide<br/><small>Ajoutez des annonces depuis la recherche</small></div>`;
    } else {
      shortEl.innerHTML = shortlist.slice(0,4).map(l=>{
        const scCol = l.score>=65?'var(--em)':l.score>=40?'var(--am)':'var(--ru)';
        return `<div class="dash-listing" onclick="gv('shortlist')">
          <div class="dash-listing-score" style="border-color:${scCol};color:${scCol}">${l.score}</div>
          <div class="dash-listing-info">
            <div class="dash-listing-title">${l.title}</div>
            <div class="dash-listing-meta">${eur(l.prix,0)} · ${l.rentBrute.toFixed(1)}%</div>
          </div>
        </div>`;
      }).join('') + (shortlist.length>4?`<div style="text-align:center;margin-top:8px;font-size:.7rem;color:var(--ink3)">+ ${shortlist.length-4} autre(s)</div>`:'');
    }
  }

  // Alert matches
  const alertsEl = g('dashAlerts');
  if(alertsEl){
    if(!alertProfile){
      alertsEl.innerHTML = `<div class="dash-empty"><span class="ico">🎯</span>Aucun profil défini<br/><button class="btn btn-p btn-sm" style="margin-top:10px" onclick="openAlertProfile()">🎯 Définir mon profil</button></div>`;
    } else {
      const topMatches = listings.filter(l=>l.matchPct>=60).sort((a,b)=>(b.matchPct||0)-(a.matchPct||0)).slice(0,4);
      if(!topMatches.length){
        alertsEl.innerHTML = `<div class="dash-empty"><span class="ico">🔍</span>Aucune annonce ne matche<br/><small>${matches} sur ${listings.length} annonces</small></div>`;
      } else {
        alertsEl.innerHTML = topMatches.map(l=>`
          <div class="dash-alert-match" onclick="gv('search');setTimeout(()=>openDetail('${l.id}'),100)">
            <div><span class="dam-pct">🎯 ${l.matchPct}%</span><span class="dam-title">${l.title.substring(0,40)}${l.title.length>40?'…':''}</span></div>
            <div class="dam-meta">${eur(l.prix,0)} · ${l.ville} · ${l.rentBrute.toFixed(1)}%</div>
          </div>`).join('');
      }
    }
  }

  // Activity feed
  const actEl = g('dashActivity');
  if(actEl){
    if(!notifications.length){
      actEl.innerHTML = `<div class="dash-empty"><span class="ico">🕐</span>Pas d'activité récente</div>`;
    } else {
      actEl.innerHTML = notifications.slice(0,6).map(n=>{
        const ago = Math.round((Date.now()-n.time)/60000);
        const timeStr = ago<1?'À l\'instant':ago<60?ago+'min':ago<1440?Math.round(ago/60)+'h':Math.round(ago/1440)+'j';
        const icons={info:'💡',alert:'🎯',match:'⭐',search:'🔍'};
        return `<div style="padding:6px 10px;border-bottom:1px solid var(--bd);font-size:.7rem">
          <div style="color:var(--ink);line-height:1.4">${icons[n.type]||'💡'} ${n.msg}</div>
          <div style="font-size:.58rem;color:var(--ink4);margin-top:2px">${timeStr}</div>
        </div>`;
      }).join('');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   PARTAGE SHORTLIST — URL compressée
═══════════════════════════════════════════════════════════════ */
function shareShortlist(){
  if(!shortlist.length){toast('Shortlist vide','err');return;}

  // Compact payload — just essential data
  const payload = shortlist.map(l=>({
    t:l.title,p:l.prix,s:l.surface,pi:l.pieces,ty:l.type,v:l.ville,cp:l.cp,
    d:l.dpe,l:l.loyer,tf:l.taxeFonciere,cc:l.chargesCopro,tr:l.travaux,
    lo:l.locataireEnPlace?1:0,src:l.source
  }));
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const url = window.location.origin + window.location.pathname + '?shortlist=' + b64;

  g('shareUrl').textContent = url;
  g('shareCount').textContent = shortlist.length;
  g('shareOverlay').classList.add('open');

  // Generate QR via public API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  g('shareQR').src = qrUrl;
}
function closeShare(){g('shareOverlay').classList.remove('open');}

function copyShareURL_shortlist(){
  const url = g('shareUrl').textContent;
  navigator.clipboard.writeText(url).then(()=>toast('URL copiée ✓','ok')).catch(()=>toast('Impossible de copier','err'));
}

function shareByEmail(){
  const url = g('shareUrl').textContent;
  const subject = encodeURIComponent('Ma shortlist immobilière — '+shortlist.length+' biens');
  const body = encodeURIComponent(`Bonjour,

Voici ma sélection de ${shortlist.length} biens immobiliers analysés via ImmoSim V9 :

${shortlist.map(l=>`• ${l.title} — ${eur(l.prix,0)} — ${l.ville} — Rentabilité ${l.rentBrute.toFixed(1)}%`).join('\n')}

Lien interactif : ${url}

Cordialement`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// Auto-load shortlist from URL param on page load
(function(){
  const params = new URLSearchParams(window.location.search);
  const sl = params.get('shortlist');
  if(sl){
    try{
      const json = decodeURIComponent(escape(atob(sl)));
      const data = JSON.parse(json);
      const loaded = data.map((d,i)=>({
        id:'shared_'+i,source:d.src||'shared',title:d.t,prix:d.p,surface:d.s,pieces:d.pi,type:d.ty,
        ville:d.v,cp:d.cp,dpe:d.d,loyerActuel:d.lo?d.l:0,loyerEstime:d.lo?0:d.l,
        taxeFonciere:d.tf||0,chargesCopro:d.cc||0,travaux:d.tr||0,locataireEnPlace:!!d.lo,
        description:'Bien partagé',img:'',date:new Date().toISOString().slice(0,10)
      }));
      loaded.forEach(l=>analyzeListingLocal(l));
      listings.push(...loaded);
      shortlist.push(...loaded);
      saveShortlistLS();
      setTimeout(()=>{
        toast(`${loaded.length} biens partagés chargés dans votre shortlist ✓`,'ok');
        gv('shortlist');
      },300);
    }catch(e){console.warn('Shortlist import failed',e);}
  }
})();

/* ═══════════════════════════════════════════════════════════════
   HISTORIQUE DES PRIX — track listings revisited
═══════════════════════════════════════════════════════════════ */
let priceHistory = {}; // id → [{date, prix}]

function trackPrice(l){
  if(!l.id || !l.prix) return;
  if(!priceHistory[l.id]) priceHistory[l.id] = [];
  const last = priceHistory[l.id][priceHistory[l.id].length-1];
  const today = new Date().toISOString().slice(0,10);
  if(!last || last.prix !== l.prix){
    priceHistory[l.id].push({date:today, prix:l.prix});
    if(priceHistory[l.id].length > 20) priceHistory[l.id].shift();
    savePriceHistLS();
  }
}

function savePriceHistLS(){try{localStorage.setItem('immoV9_priceHist',JSON.stringify(priceHistory))}catch(e){}}
function loadPriceHistLS(){try{priceHistory=JSON.parse(localStorage.getItem('immoV9_priceHist')||'{}');}catch(e){priceHistory={}}}

function getPriceHistHTML(l){
  const hist = priceHistory[l.id];
  if(!hist || hist.length < 2) return ''; // need at least 2 data points
  const max = Math.max(...hist.map(h=>h.prix));
  const min = Math.min(...hist.map(h=>h.prix));
  const first = hist[0].prix, current = hist[hist.length-1].prix;
  const diff = current - first;
  const diffPct = first > 0 ? (diff/first)*100 : 0;

  let signalHTML = '';
  if(diff < 0){
    signalHTML = `<div class="price-hist-signal" style="background:var(--em-a);border-color:var(--em-b);color:var(--em)">📉 <strong>Prix en baisse : ${eur(Math.abs(diff),0)} (${diffPct.toFixed(1)}%)</strong> depuis le ${new Date(hist[0].date).toLocaleDateString('fr-FR')}. Signal potentiellement favorable pour négocier.</div>`;
  } else if(diff > 0){
    signalHTML = `<div class="price-hist-signal" style="background:var(--ru-a);border-color:var(--ru-b);color:var(--ru)">📈 Prix en hausse : +${eur(diff,0)} (${diffPct.toFixed(1)}%) depuis le ${new Date(hist[0].date).toLocaleDateString('fr-FR')}.</div>`;
  }

  const chartHTML = hist.map((h,i)=>{
    const ratio = (h.prix - min) / (max - min || 1);
    const height = Math.max(20, ratio * 70);
    const isCurrent = i === hist.length-1;
    const d = new Date(h.date);
    return `<div class="price-hist-bar ${isCurrent?'current':''}" style="height:${height}%" data-price="${eur(h.prix,0)}" data-date="${d.getDate()}/${d.getMonth()+1}"></div>`;
  }).join('');

  return `
    <div class="price-hist-section">
      <div class="price-hist-title">💹 Historique de prix (${hist.length} relevé${hist.length>1?'s':''})</div>
      <div class="price-hist-chart">${chartHTML}</div>
      ${signalHTML}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   PRO MODE — Pipeline de dossiers
═══════════════════════════════════════════════════════════════ */
const PIPELINE_STAGES = [
  {id:'watch',label:'👀 À étudier',color:'var(--sa)'},
  {id:'visit',label:'🚪 À visiter',color:'var(--am)'},
  {id:'offer',label:'📝 Offre faite',color:'var(--gold)'},
  {id:'accept',label:'✅ Acceptée',color:'var(--em)'},
  {id:'reject',label:'❌ Refusée',color:'var(--ru)'},
];

function getPipelineStage(id){
  try{
    const data = JSON.parse(localStorage.getItem('immoV9_pipeline')||'{}');
    return data[id] || null;
  }catch(e){return null;}
}

function setPipelineStage(id, stage){
  try{
    const data = JSON.parse(localStorage.getItem('immoV9_pipeline')||'{}');
    if(stage) data[id] = {stage, ts:Date.now()};
    else delete data[id];
    localStorage.setItem('immoV9_pipeline',JSON.stringify(data));
  }catch(e){}
}

function openPipelineMenu(id, btn){
  const current = getPipelineStage(id);
  const menu = document.createElement('div');
  menu.style.cssText = 'position:absolute;background:var(--bg1);border:1px solid var(--bd2);border-radius:var(--r2);box-shadow:var(--sh2);padding:6px;z-index:999;min-width:160px';
  menu.innerHTML = PIPELINE_STAGES.map(s=>`<div style="padding:8px 12px;cursor:pointer;font-size:.76rem;border-radius:var(--r);color:${s.color};${current?.stage===s.id?'background:'+s.color+'22':''}" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='${current?.stage===s.id?s.color+'22':'transparent'}'" onclick="setPipelineStage('${id}','${s.id}');this.parentElement.remove();openDetail('${id}')">${s.label}</div>`).join('')
    + `<div style="padding:8px 12px;cursor:pointer;font-size:.76rem;border-radius:var(--r);color:var(--ink3);border-top:1px solid var(--bd)" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='transparent'" onclick="setPipelineStage('${id}',null);this.parentElement.remove();openDetail('${id}')">✕ Retirer du pipeline</div>`;
  const rect = btn.getBoundingClientRect();
  menu.style.top = (rect.bottom+4)+'px';
  menu.style.left = rect.left+'px';
  document.body.appendChild(menu);
  setTimeout(()=>document.addEventListener('click', function h(e){if(!menu.contains(e.target)){menu.remove();document.removeEventListener('click',h);}},{once:true}),10);
}

(function initAggregator(){
  loadNotifsLS();
  loadSearchHistLS();
  loadScoreWeightsLS();
  loadAlertProfileLS();
  loadPriceHistLS();

  // Try to restore saved listings first
  const hasListings = loadListingsLS();
  if(hasListings){
    loadShortlistLS();
    if(alertProfile) listings.forEach(l=>{l.matchPct=calcMatch(l);});
    updateSourceCounts();
  } else {
    loadShortlistLS();
  }

  // Render dashboard on page load
  setTimeout(()=>{
    renderDashboard();
    loadProjectState();
    updatePipeBadge();
  }, 100);
})();

