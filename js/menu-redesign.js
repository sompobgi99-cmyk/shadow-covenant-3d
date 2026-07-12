// Consolidated pre-run setup and the Soul Market. Existing selectors remain as fallbacks.
const RUN_SETUP_STORAGE_KEY='sc3_run_setup_v1';
let runSetupDifficultyId='normal';
let runSetupPactIds=[];
let activeMarketTab='pets';

function loadRunSetupConfig(){
  try{
    const v=JSON.parse(localStorage.getItem(RUN_SETUP_STORAGE_KEY)||'{}');
    return v&&typeof v==='object'?v:{};
  }catch(_){ return {}; }
}
function saveRunSetupConfig(){
  try{ localStorage.setItem(RUN_SETUP_STORAGE_KEY,JSON.stringify({character:currentChar,difficulty:runSetupDifficultyId,pacts:runSetupPactIds.slice()})); }catch(_){}
}
function closeSetupOverlays(){
  for(const id of ['playersetup','select','difficultyselect','pactselect','offeringselect']){
    const el=document.getElementById(id); if(el) el.style.display='none';
  }
}
function runSetupPet(){ return typeof petById==='function'?petById(selectedPetId()):null; }
function runSetupDeity(){ return typeof divineOfferingById==='function'?divineOfferingById(selectedDivineOfferingId):null; }
function safeChar(){
  if(CHARACTERS[currentChar]&&isCharacterUnlocked(currentChar)) return currentChar;
  return Object.keys(CHARACTERS).find(isCharacterUnlocked)||Object.keys(CHARACTERS)[0];
}
function openRunSetup(){
  closeGuide(); closeAuthChoice(); closeSetupOverlays();
  const saved=loadRunSetupConfig();
  if(saved.character&&CHARACTERS[saved.character]&&isCharacterUnlocked(saved.character)) currentChar=saved.character;
  currentChar=safeChar();
  runSetupDifficultyId=difficultyById(saved.difficulty||activeDifficultyId||'normal').id;
  runSetupPactIds=Array.isArray(saved.pacts)?saved.pacts.filter(id=>isPactUnlocked(id,runSetupDifficultyId)):[];
  if(runSetupDifficultyId==='casual') runSetupPactIds=[];
  if(!isDivineOfferingOwned(selectedDivineOfferingId)) selectedDivineOfferingId='';
  document.getElementById('title').style.display='none';
  const panel=document.getElementById('runsetup'); panel.style.display='flex';
  renderRunSetup();
}
function closeRunSetupToTitle(){
  const panel=document.getElementById('runsetup'); if(panel) panel.style.display='none';
  document.getElementById('title').style.display='flex';
  showLeaderboard(); updateStartFlow(); startTitleBGM();
}
function renderRunSetup(){
  const body=document.getElementById('runsetupbody'); if(!body) return;
  currentChar=safeChar();
  const c=CHARACTERS[currentChar], stats=c.stats||{}, pet=runSetupPet(), deity=runSetupDeity();
  const roster=Object.keys(CHARACTERS).map(key=>{
    const locked=!isCharacterUnlocked(key), selected=key===currentChar;
    return `<button class="runcharpick${selected?' selected':''}${locked?' locked':''}" data-run-char="${escHtml(key)}" title="${escHtml(charField(key,'name',CHARACTERS[key].name))}"><img src="${escHtml(characterPortrait(key))}" alt=""></button>`;
  }).join('');
  const diffs=DIFFICULTIES.map(d=>`<button class="rundiff ${d.id}${d.id===runSetupDifficultyId?' selected':''}" data-run-diff="${d.id}"><b>${escHtml(d.name)} · x${Number(d.mult).toFixed(2)}</b><small>${escHtml(d.badge||d.meta||'')}</small></button>`).join('');
  const pacts=PACTS.map(p=>{
    const locked=!isPactUnlocked(p.id,runSetupDifficultyId), disabled=runSetupDifficultyId==='casual';
    return `<button class="runpact${runSetupPactIds.includes(p.id)?' selected':''}${locked?' locked':''}${disabled?' disabled':''}" data-run-pact="${p.id}"><b>${escHtml(pactName(p))} · +${Math.round(p.bonus*100)}%</b><small>${escHtml(locked?'ยังไม่ปลดล็อก':pactDesc(p))}</small></button>`;
  }).join('');
  const petImg=pet?(pet.sprite?spriteSrc(pet.sprite):petIconData(pet)):'assets/sprites/item_singularity_core.png';
  const deityImg=deity?`assets/sprites/deity_${deity.id}.png`:'assets/sprites/relic_soul_lantern.png';
  const diff=difficultyById(runSetupDifficultyId), score=diff.mult*calcPactMultiplier(runSetupPactIds);
  body.innerHTML=`<div class="runsetupgrid">
    <section class="runsection"><h3>ตัวละคร <span>${Object.keys(CHARACTERS).filter(isCharacterUnlocked).length}/${Object.keys(CHARACTERS).length}</span></h3>
      <div class="runcharhero"><img src="${escHtml(characterPortrait(currentChar))}" alt=""><div><b>${escHtml(charField(currentChar,'name',c.name))}</b><em>${escHtml(weaponName(c.weapon))}</em><p>${escHtml(charField(currentChar,'bio',c.bio||''))}</p><div class="runcharstats"><span>HP ${stats.maxHp||100}</span><span>SPD ${stats.spd||5}</span><span>${escHtml(charField(currentChar,'passive',c.passive&&c.passive.desc||''))}</span></div></div></div>
      <div class="runcharroster">${roster}</div></section>
    <section class="runsection"><h3>ข้อมูลรัน</h3><div class="runidentity"><input id="runplayername" maxlength="18" value="${escHtml(playerName)}" aria-label="Player name"><select id="runcountry"><option value="TH">TH</option><option value="US">US</option><option value="JP">JP</option><option value="KR">KR</option><option value="SG">SG</option><option value="BR">BR</option><option value="GB">GB</option><option value="AU">AU</option></select></div>
      <div class="rundifficulty">${diffs}</div><div class="runsubhead">PACT ${runSetupDifficultyId==='casual'?'· ปิดในโหมดฝึก':'· เลือกความเสี่ยงเพื่อเพิ่มคะแนน'}</div><div class="runpacts">${pacts}</div></section>
    <section class="runsection"><h3>คู่หูและวิญญาณเทพ</h3>
      <div class="runloadoutslot"><img src="${escHtml(petImg)}" alt=""><div><b>${escHtml(pet?pet.name:'ไม่มีสัตว์เลี้ยง')}</b><small>${escHtml(pet?pet.buff:'เล่นโดยไม่มีบัฟสัตว์เลี้ยง')}</small></div><button data-run-picker="pet" title="เลือกสัตว์เลี้ยง">↻</button></div>
      <div class="runloadoutslot"><img src="${escHtml(deityImg)}" alt=""><div><b>${escHtml(deity?deity.name:'ไม่มีวิญญาณเทพ')}</b><small>${escHtml(deity?deity.short+` · Cooldown ${divineOfferingCooldown(deity.id)}s`:'ไม่ใช้สกิลแอคทีฟ Q')}</small></div><button data-run-picker="divine" title="เลือกวิญญาณเทพ">↻</button></div>
      <button class="runquickmarket" data-open-market="pets">ตลาดวิญญาณ · ซื้อ Pet และองค์เทพ</button></section></div>
    <div class="runsummarybar"><div class="runsummarytext"><span>${escHtml(diff.name)} · Pact ${runSetupPactIds.length} · ${escHtml(pet?pet.name:'No Pet')} · ${escHtml(deity?deity.name:'No Divine')}</span><b>${escHtml(charField(currentChar,'name',c.name))} · คะแนน x${score.toFixed(2)}</b></div><button class="runstart" id="runstartconfigured">เริ่มรัน</button></div>`;
  const country=document.getElementById('runcountry'); if(country){ country.value=playerCountry; if(country.value!==playerCountry){ const o=document.createElement('option'); o.value=playerCountry;o.textContent=playerCountry;country.appendChild(o);country.value=playerCountry; } }
  document.getElementById('runsetupcoins').textContent=soulCoins().toLocaleString();
  body.querySelectorAll('[data-run-char]').forEach(b=>b.onclick=()=>{ if(!isCharacterUnlocked(b.dataset.runChar)){ showToast('ตัวละครนี้ยังไม่ปลดล็อก',2); return; } currentChar=b.dataset.runChar; saveRunSetupConfig(); renderRunSetup(); });
  body.querySelectorAll('[data-run-diff]').forEach(b=>b.onclick=()=>{ runSetupDifficultyId=b.dataset.runDiff; runSetupPactIds=runSetupDifficultyId==='casual'?[]:runSetupPactIds.filter(id=>isPactUnlocked(id,runSetupDifficultyId)); saveRunSetupConfig(); renderRunSetup(); });
  body.querySelectorAll('[data-run-pact]').forEach(b=>b.onclick=()=>{ const id=b.dataset.runPact; if(runSetupDifficultyId==='casual'||!isPactUnlocked(id,runSetupDifficultyId)) return; runSetupPactIds=runSetupPactIds.includes(id)?runSetupPactIds.filter(x=>x!==id):runSetupPactIds.concat(id); saveRunSetupConfig(); renderRunSetup(); });
  body.querySelectorAll('[data-run-picker]').forEach(b=>b.onclick=()=>openRunSetupPicker(b.dataset.runPicker));
  body.querySelector('[data-open-market]').onclick=()=>openSoulMarket('pets',true);
  document.getElementById('runstartconfigured').onclick=startConfiguredRun;
}
function openRunSetupPicker(kind){
  const drawer=document.getElementById('runsetupdrawer'); if(!drawer) return;
  let cards='';
  if(kind==='pet'){
    cards=`<button class="runpickcard${selectedPetId()?'':' selected'}" data-pick-pet=""><b>ไม่มี Pet</b><small>ไม่รับบัฟ</small></button>`+PETS.map(p=>{ const owned=isPetOwned(p.id); return `<button class="runpickcard${selectedPetId()===p.id?' selected':''}${owned?'':' locked'}" data-pick-pet="${p.id}"><img src="${escHtml(p.sprite?spriteSrc(p.sprite):petIconData(p))}" alt=""><b>${escHtml(p.name)}</b><small>${escHtml(owned?p.buff:'ซื้อในตลาดก่อน')}</small></button>`; }).join('');
  }else{
    cards=`<button class="runpickcard${selectedDivineOfferingId?'':' selected'}" data-pick-divine=""><b>ไม่บูชา</b><small>ไม่มี Active Skill</small></button>`+DIVINE_OFFERINGS.map(o=>{ const owned=isDivineOfferingOwned(o.id); return `<button class="runpickcard${selectedDivineOfferingId===o.id?' selected':''}${owned?'':' locked'}" data-pick-divine="${o.id}"><img src="assets/sprites/deity_${o.id}.png" alt=""><b>${escHtml(o.name)}</b><small>${escHtml((owned?o.short:'1,500 Soul Coins')+` · CD ${divineOfferingCooldown(o.id)}s`)}</small></button>`; }).join('');
  }
  drawer.innerHTML=`<div class="runsetupdrawerpanel"><header><h3>${kind==='pet'?'เลือกสัตว์เลี้ยง':'เลือกวิญญาณเทพ'}</h3><button id="runpickerclose">×</button></header><div class="runpickergrid">${cards}</div></div>`;
  drawer.style.display='flex'; document.getElementById('runpickerclose').onclick=closeRunSetupPicker;
  drawer.querySelectorAll('[data-pick-pet]').forEach(b=>b.onclick=()=>{ const id=b.dataset.pickPet; if(id&&!isPetOwned(id)){ openSoulMarket('pets',true); return; } selectPet(id); closeGuide(); closeRunSetupPicker(); renderRunSetup(); });
  drawer.querySelectorAll('[data-pick-divine]').forEach(b=>b.onclick=()=>{ const id=b.dataset.pickDivine; if(id&&!isDivineOfferingOwned(id)){ openSoulMarket('divine',true); return; } selectedDivineOfferingId=id; try{localStorage.setItem(DIVINE_OFFERING_LAST_KEY,id);}catch(_){} closeRunSetupPicker(); renderRunSetup(); });
}
function closeRunSetupPicker(){ const d=document.getElementById('runsetupdrawer'); if(d) d.style.display='none'; }
function startConfiguredRun(){
  const name=document.getElementById('runplayername'), country=document.getElementById('runcountry');
  playerName=cleanPlayerName(name&&name.value); playerCountry=cleanCountryCode(country&&country.value);
  localStorage.setItem(PLAYER_NAME_KEY,playerName); localStorage.setItem(PLAYER_COUNTRY_KEY,playerCountry);
  setActiveDifficulty(runSetupDifficultyId); setActivePacts(runSetupPactIds);
  activeDivineOfferingId=isDivineOfferingOwned(selectedDivineOfferingId)?selectedDivineOfferingId:'';
  try{localStorage.setItem(DIVINE_OFFERING_LAST_KEY,activeDivineOfferingId);}catch(_){}
  saveRunSetupConfig(); document.getElementById('runsetup').style.display='none';
  showFirstRunHowTo(()=>beginSelectedRun());
}

function soulMarketIsOpen(){ return document.getElementById('soulmarket')?.style.display==='flex'; }
function openSoulMarket(tab,fromSetup){
  activeMarketTab=tab||activeMarketTab||'pets';
  const market=document.getElementById('soulmarket'); market.dataset.returnSetup=fromSetup?'1':'0'; market.style.display='flex';
  renderSoulMarket(activeMarketTab);
}
function closeSoulMarket(){ const market=document.getElementById('soulmarket'); if(market) market.style.display='none'; if(market?.dataset.returnSetup==='1') renderRunSetup(); }
function renderSoulMarket(tab){
  activeMarketTab=tab||'pets'; const body=document.getElementById('marketbody'); if(!body) return;
  document.getElementById('marketcoins').textContent=soulCoins().toLocaleString();
  document.querySelectorAll('[data-market-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.marketTab===activeMarketTab));
  if(activeMarketTab==='pets') body.innerHTML=`<div class="marketgrid">${petShopCardsMarkup()}</div>`;
  else if(activeMarketTab==='box') body.innerHTML=`<div class="marketbox"><div class="marketodds"><div><b>0.5%</b><span>Special Pet</span></div><div><b>5%</b><span>Normal Pet</span></div><div><b>94.5%</b><span>Soul Coins</span></div></div>${guidePetBoxCard()}</div>`;
  else body.innerHTML=`<div class="marketdivine">${DIVINE_OFFERINGS.map(o=>{ const owned=isDivineOfferingOwned(o.id), selected=selectedDivineOfferingId===o.id; return `<article class="marketgod${owned?' owned':''}${selected?' selected':''}"><img src="assets/sprites/deity_${o.id}.png" alt=""><b>${escHtml(o.name)}</b><em>${escHtml(o.title)}</em><p>${escHtml(owned?o.effect:o.short)}</p><small>${owned?'ปลดล็อกแล้ว':'1,500 Soul Coins'} · CD ${divineOfferingCooldown(o.id)}s</small><button data-market-divine="${o.id}">${owned?(selected?'เลือกอยู่':'เลือกใช้'):'ซื้อ'}</button></article>`; }).join('')}</div>`;
  body.querySelectorAll('[data-pet-buy]').forEach(b=>b.onclick=()=>{ buyPet(b.dataset.petBuy); closeGuide(); renderSoulMarket('pets'); });
  body.querySelectorAll('[data-pet-select]').forEach(b=>b.onclick=()=>{ selectPet(b.dataset.petSelect); closeGuide(); renderSoulMarket('pets'); });
  body.querySelectorAll('[data-pet-box-open]').forEach(b=>b.onclick=()=>{ openPetBox(); closeGuide(); renderSoulMarket('box'); });
  body.querySelectorAll('[data-market-divine]').forEach(b=>b.onclick=()=>{ const id=b.dataset.marketDivine; if(isDivineOfferingOwned(id)){ selectedDivineOfferingId=id; try{localStorage.setItem(DIVINE_OFFERING_LAST_KEY,id);}catch(_){} }else buyDivineOffering(id); renderSoulMarket('divine'); });
}
function initMenuRedesign(){
  const back=document.getElementById('runsetupback'), close=document.getElementById('marketclose');
  const market=document.getElementById('soulmarket');
  // HUD is a fixed stacking context below the title. Keep the market at body level
  // so its controls cannot click through to title buttons underneath.
  if(market&&market.parentElement!==document.body) document.body.appendChild(market);
  if(back) back.onclick=closeRunSetupToTitle; if(close) close.onclick=closeSoulMarket;
  document.querySelectorAll('[data-market-tab]').forEach(b=>b.onclick=()=>renderSoulMarket(b.dataset.marketTab));
  const oldPetButton=document.querySelector('#title [data-guide="pets"]');
  if(oldPetButton){ oldPetButton.removeAttribute('data-guide'); oldPetButton.id='marketbtn'; oldPetButton.textContent=gameLang()==='en'?'Soul Market':'ตลาดวิญญาณ'; oldPetButton.onclick=()=>openSoulMarket('pets',false); }
}

window.openRunSetup=openRunSetup;
window.openSoulMarket=openSoulMarket;
window.closeSoulMarket=closeSoulMarket;
