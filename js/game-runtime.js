let scene, camera, renderer, clock, playerLight, hemiLight, sunLight, rimLight, borderMaterial;
const APP_VERSION = window.SHADOW_BUILD_VERSION || 'dev';
const tex = {};
let player, ground;
const enemies = [], projectiles = [], pickups = [];
const breakables = [];                      // destructible jars/crates for early maps
const obstacles = [];                       // solid scenery {x,z,r}
const worldScenery = [];                    // base map scenery that can be removed on stage changes
const stageProps = [];                      // scenery added/removed when changing maps
const ENEMY_GRID_SIZE = 4;
const ENEMY_GRID_OFFSET = 4096;
const ENEMY_GRID_STRIDE = 8192;
const enemyGrid = new Map();
function enemyGridKey(cx, cz){ return (cx + ENEMY_GRID_OFFSET) * ENEMY_GRID_STRIDE + (cz + ENEMY_GRID_OFFSET); }
function rebuildEnemyGrid(){
  for(const bucket of enemyGrid.values()) bucket.length=0;
  for (let i=0;i<enemies.length;i++){
    const e=enemies[i];
    if(!e.alive) continue;
    e.gridIndex=i;
    const cx=Math.floor(e.x/ENEMY_GRID_SIZE), cz=Math.floor(e.z/ENEMY_GRID_SIZE);
    const key=enemyGridKey(cx,cz);
    let bucket=enemyGrid.get(key);
    if(!bucket){ bucket=[]; enemyGrid.set(key,bucket); }
    bucket.push(e);
  }
}
function forEachNearbyEnemy(x,z,radius,visit){
  const minX=Math.floor((x-radius)/ENEMY_GRID_SIZE), maxX=Math.floor((x+radius)/ENEMY_GRID_SIZE);
  const minZ=Math.floor((z-radius)/ENEMY_GRID_SIZE), maxZ=Math.floor((z+radius)/ENEMY_GRID_SIZE);
  for(let cx=minX;cx<=maxX;cx++) for(let cz=minZ;cz<=maxZ;cz++){
    const bucket=enemyGrid.get(enemyGridKey(cx,cz));
    if(!bucket) continue;
    for(const e of bucket) if(e.alive && visit(e)===false) return false;
  }
  return true;
}
const afterimages = [];                     // dash trail ghosts
function spawnAfterimage(){
  const p = player.spr;
  const m = new THREE.SpriteMaterial({ map:p.material.map, color:0x7CE7FF, transparent:true, opacity:0.55, alphaTest:0.3, depthWrite:false, fog:true, blending:THREE.AdditiveBlending });
  const g = new THREE.Sprite(m);
  g.center.copy(p.center); g.scale.copy(p.scale); g.position.copy(p.position);
  scene.add(g); afterimages.push({ spr:g, life:0.28, max:0.28 });
}
const enemyShots = [];                      // enemy ranged projectiles
const particles = [];                       // hit/death bursts
const PARTICLE_GEO = new THREE.BoxGeometry(0.14,0.14,0.14);
const trails=[]; const TRAIL_GEO=new THREE.BoxGeometry(0.14,0.14,0.14);
const EFFECT_PLANE_GEO = new THREE.PlaneGeometry(2,2);
const burstMaterialCache = new Map();
function effectColorKey(color){
  return new THREE.Color(color==null?0xffffff:color).getHexString();
}
function getBurstMaterial(color){
  const key=effectColorKey(color);
  let mat=burstMaterialCache.get(key);
  if(!mat){
    mat=new THREE.MeshBasicMaterial({ color:new THREE.Color('#'+key), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
    mat._shared=true;
    burstMaterialCache.set(key,mat);
  }
  return mat;
}
EFFECT_PLANE_GEO.rotateX(-Math.PI/2);
const MAX_RINGS = 72;
const MAX_NOVA_WAVES = 48;
const MAX_SLASH_FX = 64;
function capEffectList(list, max){
  while(list.length>=max){
    const old=list.shift();
    if(old && old.mesh){ scene.remove(old.mesh); freeObj(old.mesh); }
  }
}
const dmgNums=[];
const petBubbles=[];
const damageScreenPos=new THREE.Vector3();
function spriteSrc(key){
  const src = SP + (MANIFEST[key] || (key + '.png'));
  if (src.includes('?')) return src;
  const v = (typeof window !== 'undefined' && window.SHADOW_BUILD_VERSION) ? window.SHADOW_BUILD_VERSION : 'local';
  return src + '?v=' + encodeURIComponent(v);
}

const LANG_STORAGE_KEY='sc3_lang_v1';
const HOWTO_SEEN_STORAGE_KEY='sc3_howto_seen_v1';
const WHATS_NEW_SEEN_STORAGE_KEY='sc3_whats_new_seen_build_v1';
let currentGuideKind='';
const I18N={
  th:{
    'lang.th':'ไทย','lang.en':'EN','lang.label':'ภาษา',
    'title.eyebrow':'Gothic Action Survivors','title.tagline':'ฝ่าดงอสูร สะสมอาวุธ และทำลายพันธสัญญาแห่งความมืดก่อนคืนจันทราจะกลืนกินทุกสิ่ง',
    'title.meta.heroes':'12 นักล่า','title.meta.maps':'3 เขตต้องสาป','title.meta.minutes':'10 นาที/ด่าน',
    'title.identity':'เลือกตัวตน','title.pets':'Pets / ร้านสัตว์เลี้ยง','title.guide':'คู่มือ / ข้อมูลเกม','title.latest':'อัปเดตล่าสุด','title.rank.show':'แสดง Ranking','title.rank.hide':'ซ่อน Ranking',
    'auth.chooseTitle':'เลือกวิธีเข้าเกม','auth.chooseSub':'เลือกตัวตนก่อน แล้วค่อยกดเริ่มเกมจากหน้าแรก','auth.google':'Sign in with Google','auth.googleDesc':'บันทึก Ranking และ Unlock Online','auth.guest':'Play as Guest','auth.guestDesc':'เล่นทันที บันทึกในเครื่องนี้',
    'start.needChoice':'เลือก Guest หรือ Google ก่อน','start.needChoiceStatus':'เลือกวิธีเข้าเกมก่อน','start.guestBtn':'เริ่มเกมแบบ Guest','start.guestStatus':'Guest: บันทึก unlock ในเครื่องนี้ คะแนนออนไลน์เป็น Guest','start.verifiedBtn':'เริ่มเกมแบบ Verified','start.loadingBtn':'กำลังโหลด Google Login...','start.loadingStatus':'รอระบบ Login พร้อมใช้งาน','start.notReadyBtn':'Google Login ยังไม่พร้อม','start.notReadyStatus':'ยังไม่ได้ตั้งค่า Supabase/Netlify auth สำหรับ Google Login','start.loginGoogleBtn':'Login ด้วย Google','start.loginGoogleStatus':'Google: ต้อง login ก่อนเริ่มแบบ Verified',
    'guide.open':'เปิดคู่มือ','guide.hub.title':'คู่มือ / ข้อมูลเกม','guide.hub.note':'รวมข้อมูลหลักของระบบและสิ่งที่ปลดล็อกได้','guide.characters':'ตัวละคร','guide.characters.desc':'อาวุธเริ่มต้น สกิลติดตัว และค่าสถานะพื้นฐาน','guide.weapons':'อาวุธ','guide.weapons.desc':'อาวุธพื้นฐานและร่างวิวัฒน์','guide.tomes':'Tome','guide.tomes.desc':'อัปเกรดติดตัวและคู่สำหรับวิวัฒน์อาวุธ','guide.evolution':'วิวัฒน์อาวุธ','guide.evolution.desc':'กติกาอาวุธ Lv8 พร้อม Tome ที่ตรงกัน','guide.items':'ไอเทม','guide.items.desc':'ของดรอปที่ซ้อนทับได้และระดับความหายาก','guide.relics':'Relic','guide.relics.desc':'รางวัลหลังฆ่าบอสที่เปลี่ยนแนวเล่นของรัน','guide.monsters':'สารานุกรมมอนสเตอร์','guide.monsters.desc':'ระดับและพฤติกรรมของศัตรูทั่วไป','guide.bosses':'สารานุกรมบอส','guide.bosses.desc':'สกิลสำคัญของมินิบอสและบอส','guide.events':'อีเวนต์','guide.events.desc':'เหตุการณ์พิเศษและความปั่นระหว่างรัน','guide.maps':'แผนที่','guide.maps.desc':'ความต่างของแต่ละด่าน','guide.combat':'ระบบต่อสู้','guide.combat.desc':'Crit, knockback, pierce, guard และ overtime','guide.shrine':'Shrine','guide.shrine.desc':'เสาแม่เหล็ก, Shrine, Chest, Merchant, Altar และ Portal','guide.shop':'ร้านค้า / NPC','guide.shop.desc':'การซื้อของ reroll และโอกาสพ่อค้าทรยศ','guide.pets':'Pets','guide.pets.desc':'ซื้อสัตว์เลี้ยงด้วย Soul Coins และเลือกติดตาม 1 ตัวต่อรัน','guide.achievements':'Achievements','guide.achievements.desc':'ปลดล็อกตัวละคร อาวุธ และไอเทม พร้อม sync เมื่อใช้ Google','guide.ranking':'Ranking','guide.ranking.desc':'กติกาคะแนนและ leaderboard online',
    'pets.title':'Pets','pets.note':'Soul Coins {coins} · ซื้อแล้ว {owned}/{total} · {selected}','pets.none':'ยังไม่ได้เลือก Pet','pets.noPet':'เล่นโดยไม่มี Pet','pets.selected':'เลือกใช้อยู่','pets.select':'เลือกใช้','pets.buy':'ซื้อ {price}','pets.price':'ราคา {price} Soul Coins','pets.notEnough':'Soul Coins ไม่พอ: ต้องมี {price}','pets.bought':'ซื้อ Pet: {name}','pets.notOwned':'ยังไม่ได้ซื้อ Pet ตัวนี้','pets.selectedToast':'เลือก Pet: {name} — {quip}','pets.noPetToast':'เล่นโดยไม่มี Pet','pets.testUnlock':'TEST: ปลดล็อก Pet ทั้งหมดแล้ว','pets.coinInfoTitle':'Soul Coins','pets.coinInfoDesc':'ได้จากการจบรันแบบจำนวนน้อย และจาก Achievement บางอันครั้งเดียว','pets.coinInfoMeta':'Pet ราคาแพงเพื่อเป็นเป้าหมายระยะยาว',
    'ach.title':'Achievements','ach.note':'{done}/{total} สำเร็จ · Soul Coins {coins}','ach.done':'DONE','ach.locked':'LOCKED','ach.rewards':'รางวัล','ach.synced':'Achievement Synced: {name}','ach.unlocked':'Achievement Unlocked: {name}','ach.unlockedSection':'Unlocked','unlock.ready':'ปลดล็อกแล้ว',
    'card.weapon':'อาวุธ','card.passive':'สกิลติดตัว','locked':'LOCKED',
    'update.kicker':'New Update','update.title':'Scoring & Overtime Update','update.lead':'สรุปสิ่งสำคัญของเวอร์ชันนี้ก่อนเริ่มรัน คะแนนและ balance อาจต่างจาก build เก่า','update.ok':'เข้าใจแล้ว','update.meta':'Build {version} · Ranking ควรเล่นด้วยเวอร์ชันล่าสุดเพื่อให้กติกาตรงกัน'
  },
  en:{
    'lang.th':'TH','lang.en':'English','lang.label':'Language',
    'title.eyebrow':'Gothic Action Survivors','title.tagline':'Survive cursed hordes, forge broken weapons, and shatter the shadow pact before the moon devours everything.',
    'title.meta.heroes':'12 hunters','title.meta.maps':'3 cursed zones','title.meta.minutes':'10 min / map',
    'title.identity':'Choose identity','title.pets':'Pets / Pet Shop','title.guide':'Guide / Game Info','title.latest':'Latest Update','title.rank.show':'Show Ranking','title.rank.hide':'Hide Ranking',
    'auth.chooseTitle':'Choose Login Method','auth.chooseSub':'Pick an identity first, then start from the title screen.','auth.google':'Sign in with Google','auth.googleDesc':'Save Ranking and Unlocks online','auth.guest':'Play as Guest','auth.guestDesc':'Play now and save on this device',
    'start.needChoice':'Choose Guest or Google first','start.needChoiceStatus':'Choose a login method first','start.guestBtn':'Start as Guest','start.guestStatus':'Guest: unlocks are saved on this device; online score is marked Guest','start.verifiedBtn':'Start as Verified','start.loadingBtn':'Loading Google Login...','start.loadingStatus':'Waiting for login service','start.notReadyBtn':'Google Login unavailable','start.notReadyStatus':'Supabase/Netlify auth is not configured for Google Login yet','start.loginGoogleBtn':'Login with Google','start.loginGoogleStatus':'Google: login first to start as Verified',
    'guide.open':'Open guide','guide.hub.title':'Guide / Game Info','guide.hub.note':'Core systems, unlocks, and run mechanics','guide.characters':'Characters','guide.characters.desc':'Starting weapons, passives, and base stats','guide.weapons':'Weapons','guide.weapons.desc':'Base weapons and evolved forms','guide.tomes':'Tomes','guide.tomes.desc':'Passive upgrades and weapon evolution pairs','guide.evolution':'Weapon Evolution','guide.evolution.desc':'Lv8 weapon plus the matching Tome','guide.items':'Items','guide.items.desc':'Stackable drops and rarity tiers','guide.relics':'Relics','guide.relics.desc':'Boss rewards that reshape the run','guide.monsters':'Monster Codex','guide.monsters.desc':'Enemy tiers and behavior types','guide.bosses':'Boss Codex','guide.bosses.desc':'Major miniboss and boss skills','guide.events':'Events','guide.events.desc':'Special encounters and chaotic run twists','guide.maps':'Maps','guide.maps.desc':'How each stage changes the run','guide.combat':'Combat','guide.combat.desc':'Crit, knockback, pierce, guard, and overtime','guide.shrine':'Shrines','guide.shrine.desc':'Magnet pillars, shrines, chests, merchants, altars, and portals','guide.shop':'Shop / NPC','guide.shop.desc':'Buying, rerolling, and merchant betrayal risk','guide.pets':'Pets','guide.pets.desc':'Buy pets with Soul Coins and bring one per run','guide.achievements':'Achievements','guide.achievements.desc':'Unlock characters, weapons, and items; sync with Google','guide.ranking':'Ranking','guide.ranking.desc':'Score rules and online leaderboard',
    'pets.title':'Pets','pets.note':'Soul Coins {coins} · Owned {owned}/{total} · {selected}','pets.none':'No pet selected','pets.noPet':'Play without a Pet','pets.selected':'Selected','pets.select':'Select','pets.buy':'Buy {price}','pets.price':'Price {price} Soul Coins','pets.notEnough':'Not enough Soul Coins: need {price}','pets.bought':'Bought Pet: {name}','pets.notOwned':'You do not own this Pet yet','pets.selectedToast':'Selected Pet: {name} — {quip}','pets.noPetToast':'Playing without a Pet','pets.testUnlock':'TEST: unlocked all Pets','pets.coinInfoTitle':'Soul Coins','pets.coinInfoDesc':'Earned slowly from run rewards and one-time Achievement rewards','pets.coinInfoMeta':'Pets are long-term goals and intentionally expensive',
    'ach.title':'Achievements','ach.note':'{done}/{total} complete · Soul Coins {coins}','ach.done':'DONE','ach.locked':'LOCKED','ach.rewards':'Rewards','ach.synced':'Achievement Synced: {name}','ach.unlocked':'Achievement Unlocked: {name}','ach.unlockedSection':'Unlocked','unlock.ready':'Unlocked',
    'card.weapon':'Weapon','card.passive':'Passive','locked':'LOCKED',
    'update.kicker':'New Update','update.title':'Scoring & Overtime Update','update.lead':'A quick summary of what changed in this version before you start a run. Scores and balance may differ from older builds.','update.ok':'Got it','update.meta':'Build {version} · Ranking runs should use the latest version so everyone plays by the same rules'
  }
};
Object.assign(I18N.th,{
  'title.howto':'วิธีเล่น','guide.howto':'วิธีเล่น','guide.howto.desc':'สรุป core loop สำหรับรันแรกแบบจบในหน้าเดียว'
});
Object.assign(I18N.en,{
  'title.howto':'How to Play','guide.howto':'How to Play','guide.howto.desc':'A one-page first-run summary of the core loop'
});
Object.assign(I18N.th,{
  'common.items':'ไอเทม','common.relic':'Relic','common.weapon':'อาวุธ','common.passive':'สกิลติดตัว','common.emptyWeapon':'ช่องอาวุธว่าง','common.emptyTome':'ช่อง Tome ว่าง','common.stackUnlimited':'stack ได้ไม่จำกัด','common.moreItems':'มีไอเทมอีก {count} stack เปิด Pause เพื่อดูทั้งหมด','common.locked':'ล็อก','common.unlocked':'ปลดล็อกแล้ว',
  'common.basic':'พื้นฐาน','common.evolved':'ร่างวิวัฒน์','common.from':'จาก {name}','common.damage':'ดาเมจ','common.rate':'ความถี่','common.count':'จำนวน','common.ready':'พร้อม','common.almost':'ใกล้พร้อม','common.evoPair':'คู่วิวัฒน์','common.evolve':'วิวัฒน์','common.chooseEvolve':'เลือกตอนนี้เพื่อวิวัฒน์อาวุธนี้','common.pairWith':'จับคู่กับ {name}','common.requires':'ต้องมี {weapon} Lv8 + {tome} x3. Ancient Anvil ทำให้ครั้งแรกใช้ x2',
  'common.ban':'แบน','common.bansLeft':'แบนเหลือ {count}','common.banHint':'แบนจะลบตัวเลือกนี้ออกจากรันนี้','common.new':'ใหม่','common.score':'คะแนน','common.useLast':'ใช้ชุดล่าสุด x{mult}','common.noLast':'ไม่มีชุดล่าสุด','common.tomeUpgrade':'อัปเกรด Tome',
  'pause.resume':'▶ เล่นต่อ','pause.quit':'⌂ ออกไปหน้าแรก','pause.hint':'กด P / Esc หรือปุ่มเล่นต่อเพื่อกลับเข้าเกม',
  'rarity.common':'Common','rarity.uncommon':'Uncommon','rarity.rare':'Rare','rarity.legendary':'Legendary',
  'items.summaryTitle':'ไอเทมซ้อนทับได้','items.summaryDesc':'เก็บซ้ำหรือซื้อซ้ำได้เรื่อย ๆ ผลของไอเทมจะคูณหรือบวกต่อจาก stack เดิม เลือกของให้เข้ากับอาวุธหลักของรัน','items.unlockedCount':'{unlocked}/{total} ปลดล็อกแล้ว','items.lockedHint':'ของที่ล็อกจะแสดงเงื่อนไขไว้ในการ์ด',
  'items.commonNote':'ของพื้นฐานที่ช่วยตั้งตัวช่วงต้นเกม','items.uncommonNote':'เริ่มกำหนดทิศทางบิลด์และคอมโบ','items.rareNote':'ของแรงที่เปลี่ยนจังหวะเล่นชัดเจน','items.legendaryNote':'ของระดับรันเปลี่ยนชีวิต แต่หาไม่ง่าย'
});
Object.assign(I18N.en,{
  'common.items':'Items','common.relic':'Relic','common.weapon':'Weapon','common.passive':'Passive','common.emptyWeapon':'Empty weapon slot','common.emptyTome':'Empty Tome slot','common.stackUnlimited':'unlimited stacks','common.moreItems':'{count} more item stacks. Pause to view all.','common.locked':'Locked','common.unlocked':'Unlocked',
  'common.basic':'Base','common.evolved':'Evolved','common.from':'from {name}','common.damage':'DMG','common.rate':'Rate','common.count':'Count','common.ready':'Ready','common.almost':'Almost ready','common.evoPair':'Evolution pair','common.evolve':'Evolve','common.chooseEvolve':'Choose this now to evolve the weapon','common.pairWith':'Pairs with {name}','common.requires':'Requires {weapon} Lv8 + {tome} x3. Ancient Anvil makes the first evolve use x2.',
  'common.ban':'Ban','common.bansLeft':'Bans left {count}','common.banHint':'Ban removes this choice for this run','common.new':'NEW','common.score':'Score','common.useLast':'Use last loadout x{mult}','common.noLast':'No last loadout','common.tomeUpgrade':'Tome upgrade',
  'pause.resume':'▶ Resume','pause.quit':'⌂ Title Screen','pause.hint':'Press P / Esc or Resume to continue',
  'rarity.common':'Common','rarity.uncommon':'Uncommon','rarity.rare':'Rare','rarity.legendary':'Legendary',
  'items.summaryTitle':'Items Stack Forever','items.summaryDesc':'Picking up or buying the same item again keeps stacking its effect. Choose items that match your main weapon and run plan.','items.unlockedCount':'{unlocked}/{total} unlocked','items.lockedHint':'Locked items show their unlock requirement on the card.',
  'items.commonNote':'Basic tools that help stabilize the early game','items.uncommonNote':'Build-shaping upgrades and combo starters','items.rareNote':'Strong items that noticeably change the run rhythm','items.legendaryNote':'Run-changing prizes, but they are intentionally rare'
});
const PET_I18N={
  lumo_wisp:{th:{title:'วิญญาณไฟหลงทาง',desc:'ดวงไฟตัวจิ๋วลอยตามหลัง ช่วยให้โตไวขึ้นแบบนุ่ม ๆ',quip:'วิบวับพร้อมลุย'},en:{title:'Lost flame wisp',desc:'A tiny wandering flame that trails behind you and gently boosts growth.',quip:'glowing and ready'}},
  lantern_bunny:{th:{title:'กระต่ายโคมผี',desc:'ตัวเล็กถือโคมไฟ คอยส่องของที่ตกอยู่รอบตัว',quip:'lantern ready'},en:{title:'Ghost lantern bunny',desc:'A tiny bunny with a lantern that helps spot nearby loot.',quip:'lantern ready'}},
  tiny_gargoyle:{th:{title:'การ์กอยล์ไซซ์พกพา',desc:'หินมีปีกจอมจริงจัง เกาะตามเหมือนบอดี้การ์ดตัวน้อย',quip:'tiny guard mode'},en:{title:'Pocket gargoyle',desc:'A serious winged stone buddy acting like a tiny bodyguard.',quip:'tiny guard mode'}},
  storm_pup:{th:{title:'ลูกหมาป่าฟ้าผ่า',desc:'วิ่งตามพร้อมประกายไฟฟ้า ทำให้วัตถุโจมตีพุ่งไวขึ้น',quip:'tail full of sparks'},en:{title:'Storm pup',desc:'A sparking pup that helps your projectiles fly faster.',quip:'tail full of sparks'}},
  grave_kitten:{th:{title:'แมวสุสาน',desc:'แมวดำตาเรืองแสง ข่วนโชคชะตาให้ติดคริบ่อยขึ้น',quip:'cursed meow'},en:{title:'Grave kitten',desc:'A glowing-eyed kitten that scratches fate toward more crits.',quip:'cursed meow'}},
  mini_mimic:{th:{title:'หีบจิ๋วมีขา',desc:'หีบสมบัติที่เลือกอยู่ข้างคุณ ช่วยหาเงินและของดีขึ้นนิดหน่อย',quip:'proud little chest'},en:{title:'Mini Mimic',desc:'A small treasure chest on legs that nudges gold and luck upward.',quip:'proud little chest'}}
};
const ACHIEVEMENT_I18N={
  first_hunt:{th:{name:'นักล่ามือใหม่',desc:'ฆ่ามอนสเตอร์ 120 ตัวในรันเดียว'},en:{name:'First Hunt',desc:'Kill 120 monsters in one run'}},
  level_10:{th:{name:'เริ่มจับทางได้',desc:'ไปถึงเลเวล 15 ในรันเดียว'},en:{name:'Getting the Hang of It',desc:'Reach level 15 in one run'}},
  map2_reached:{th:{name:'ข้ามแดนต้องสาป',desc:'เข้า Map 2 และฆ่าศัตรูอย่างน้อย 250 ตัวในรันเดียว'},en:{name:'Cross the Cursed Border',desc:'Reach Map 2 and kill at least 250 enemies in one run'}},
  first_evolution:{th:{name:'ช่างตีอาวุธเงา',desc:'วิวัฒน์อาวุธ 1 ชิ้น และไปถึงเลเวล 25 ในรันเดียว'},en:{name:'Shadow Smith',desc:'Evolve 1 weapon and reach level 25 in one run'}},
  swift_survivor:{th:{name:'หลบไวไม่ถามสุขภาพ',desc:'อยู่รอดอย่างน้อย 12 นาทีในรันเดียว'},en:{name:'Swift Survivor',desc:'Survive at least 12 minutes in one run'}},
  assassin_trial:{th:{name:'งานเงียบแต่ศพเยอะ',desc:'ฆ่ามอนสเตอร์ 550 ตัวในรันเดียว'},en:{name:'Silent Work, Loud Results',desc:'Kill 550 monsters in one run'}},
  soul_collector:{th:{name:'บัญชีวิญญาณไม่เคยว่าง',desc:'ฆ่ามอนสเตอร์ 700 ตัว หรือถือไอเทม 14 ชิ้นในรันเดียว'},en:{name:'Soul Accountant',desc:'Kill 700 monsters or hold 14 items in one run'}},
  shop_regular:{th:{name:'ลูกค้าประจำ NPC',desc:'ซื้อของจาก Merchant 6 ครั้งในรันเดียว'},en:{name:'Merchant Regular',desc:'Buy from the Merchant 6 times in one run'}},
  rich_striker:{th:{name:'มีงบก็ยิงชิ่งได้',desc:'จบรันพร้อมทองอย่างน้อย 800 หรือเปิดหีบ 8 ใบ'},en:{name:'Funded Footballer',desc:'End a run with at least 800 gold or open 8 chests'}},
  map3_reached:{th:{name:'ฟ้าผ่าเข้าห้องบอส',desc:'เข้าสู่ Map 3 และฆ่าศัตรู 900 ตัว หรือถึงเลเวล 35'},en:{name:'Storm at the Boss Gate',desc:'Reach Map 3 and kill 900 enemies, or reach level 35'}},
  butcher_hunted:{th:{name:'The Butcher Hunt',desc:'ฆ่า The Butcher ให้ทันก่อนมันหายตัว'},en:{name:'The Butcher Hunt',desc:'Kill The Butcher before it disappears'}},
  void_cleared:{th:{name:'ปิดสัญญาเงา',desc:'เคลียร์รันสำเร็จ'},en:{name:'Close the Shadow Pact',desc:'Clear a full run'}}
};
function gameLang(){ const v=localStorage.getItem(LANG_STORAGE_KEY); return v==='en'?'en':'th'; }
function tr(key, vars){ let text=(I18N[gameLang()]&&I18N[gameLang()][key]) || (I18N.th&&I18N.th[key]) || key; if(vars) for(const [k,v] of Object.entries(vars)) text=text.replaceAll('{'+k+'}', String(v)); return text; }
function localized(map, fallback){ return (map && (map[gameLang()] || map.th || map.en)) || fallback || ''; }
function petText(pet, field){ const row=PET_I18N[pet&&pet.id]; return localized(row && row[gameLang()] ? { [gameLang()]:row[gameLang()][field] } : row && row.th ? { th:row.th[field], en:row.en&&row.en[field] } : null, pet&&pet[field]); }
function achievementName(a){ const row=ACHIEVEMENT_I18N[a&&a.id]; return localized(row && { th:row.th&&row.th.name, en:row.en&&row.en.name }, a&&a.name); }
function achievementDesc(a){ const row=ACHIEVEMENT_I18N[a&&a.id]; return localized(row && { th:row.th&&row.th.desc, en:row.en&&row.en.desc }, a&&a.desc); }
// ---- Content i18n (weapon/tome/item/character/monster/boss) ----
// Side tables keyed by id. Proper NAMES stay English (no name entry -> falls back to data's .name).
// Only fill the fields that need translation (mainly .desc / character story-passive-unlock).
// TH falls back to the data's built-in Thai field; EN falls back to it too until translated.
const WEAPON_I18N={}, TOME_I18N={}, ITEM_I18N={}, CHAR_I18N={}, MONSTER_I18N={}, BOSS_I18N={}, PACT_I18N={};
function i18nField(table, id, field, fallback){
  const row = table && id!=null && table[id];
  if(row){ const lang=gameLang();
    const direct=row[lang]&&row[lang][field];
    if(direct!=null && direct!=='') return direct;
    if(lang==='en' && row.en && row.en[field]!=null && row.en[field]!=='') return row.en[field];
    if(lang!=='th' && row.th && row.th[field]!=null && row.th[field]!=='') return row.th[field];
  }
  return fallback!=null ? fallback : '';
}
function weaponName(key){ const w=(typeof WEAPON_TYPES!=='undefined'&&WEAPON_TYPES[key])||{}; return i18nField(WEAPON_I18N,key,'name',w.name); }
function weaponDesc(key){ const w=(typeof WEAPON_TYPES!=='undefined'&&WEAPON_TYPES[key])||{}; return i18nField(WEAPON_I18N,key,'desc',w.desc); }
function tomeName(u){
  const row = typeof u === 'string' ? ((typeof UPGRADES !== 'undefined' && UPGRADES.find(x=>x.id===u)) || { id:u, name:u }) : u;
  return i18nField(TOME_I18N,row&&row.id,'name',row&&row.name);
}
function tomeDesc(u){ return i18nField(TOME_I18N,u&&u.id,'desc',u&&u.desc); }
function itemName(it){ return i18nField(ITEM_I18N,it&&it.id,'name',it&&it.name); }
function itemDesc(it){ return i18nField(ITEM_I18N,it&&it.id,'desc',it&&it.desc); }
function monsterName(t){ return i18nField(MONSTER_I18N,t&&t.sprite,'name',t&&t.name); }
function monsterDesc(t){ return i18nField(MONSTER_I18N,t&&t.sprite,'desc',t&&t.desc); }
function bossName(t){ return i18nField(BOSS_I18N,t&&t.sprite,'name',t&&t.name); }
function bossDesc(t){ return i18nField(BOSS_I18N,t&&t.sprite,'desc',t&&t.desc); }
function charField(key, field, fallback){ return i18nField(CHAR_I18N,key,field,fallback); }   // name/bio/passive/unlock/...
Object.assign(WEAPON_I18N,{
  bolt:{en:{desc:'Fires a homing void projectile at the nearest enemy.'}},
  spread:{en:{desc:'Shoots a fan of hex shards forward.'}},
  nova:{en:{desc:'Bursts a circular wave around the player.'}},
  orbit:{en:{desc:'Skulls orbit you, dealing damage and blocking incoming hits.'}},
  arrow:{en:{desc:'A long-range arrow that pierces through enemies.'}},
  smite:{en:{desc:'Calls holy power down from above.'}},
  lightning:{en:{desc:'Strikes one target at a time with focused lightning.'}},
  dagger:{en:{desc:'Throws fast knives at nearby enemies.'}},
  toolstab:{en:{desc:'A rapid close-range screwdriver thrust that pierces an entire line.'}},
  bladewhirl:{en:{desc:'Launches a short curved blade wave.'}},
  soulspiral:{en:{desc:'Fires spiraling souls in all directions.'}},
  football:{en:{desc:'A cursed football that bounces toward new targets.'}},
  shieldtoss:{en:{desc:'Throws a heavy shield that pierces, then rebounds to another target.'}},
  boneboomerang:{en:{desc:'Twin curved bones bounce between enemies.'}},
  bouncebomb:{en:{desc:'A bomb that explodes on impact, then bounces to another target.'}},
  boltX:{en:{desc:'Evolved: fires piercing volleys of doom bolts.'}},
  spreadX:{en:{desc:'Evolved: unleashes a wider storm of hex shards.'}},
  novaX:{en:{desc:'Evolved: larger and harder-hitting circular bursts.'}},
  orbitX:{en:{desc:'Evolved: dual death orbits with stronger guard power.'}},
  arrowX:{en:{desc:'Evolved: a piercing tempest volley for dense hordes.'}},
  smiteX:{en:{desc:'Evolved: divine judgment crashes down from the sky.'}},
  lightningX:{en:{desc:'Evolved: chain lightning calls down a storm tribunal.'}},
  daggerX:{en:{desc:'Evolved: a storm of piercing execution knives.'}},
  toolstabX:{en:{desc:'Evolved: wider multi-hit admin override thrusts.'}},
  bladewhirlX:{en:{desc:'Evolved: multiple aggressive blade waves.'}},
  soulspiralX:{en:{desc:'Evolved: a heavier soul tempest spirals outward.'}},
  footballX:{en:{desc:'Evolved: multiple meteor shots bounce and explode.'}},
  shieldtossX:{en:{desc:'Evolved: a stronger shield that rebounds through hordes.'}},
  boneboomerangX:{en:{desc:'Evolved: faster bone cyclones with extra bounces.'}},
  bouncebombX:{en:{desc:'Evolved: large chain detonations between targets.'}}
});
Object.assign(TOME_I18N,{
  might:{en:{desc:'Damage +15%'}}, vitality:{en:{desc:'Max HP +25 and heal immediately'}}, celerity:{en:{desc:'Attack speed +10%'}},
  precision:{en:{desc:'Attack range +15%'}}, multishot:{en:{desc:'Projectile/object count +1'}}, swiftness:{en:{desc:'Move speed +6%'}},
  regen:{en:{desc:'Regenerate +0.8 HP per second'}}, magnet:{en:{desc:'Pickup magnet range +30%'}}, exp:{en:{desc:'XP gain +15%'}},
  greed:{en:{desc:'Gold gain +20%'}}, fortitude:{en:{desc:'Armor +4'}}, lifesteal:{en:{desc:'Heal +1 when killing an enemy'}},
  duration:{en:{desc:'Projectile/object lifetime +20%, AoE duration +10%'}}, velocity:{en:{desc:'Projectile/object speed +20%'}},
  growth:{en:{desc:'Skill size +20%'}}, impact:{en:{desc:'Knockback +15%'}}, focus:{en:{desc:'Critical chance +8%'}},
  execution:{en:{desc:'Critical damage +25%'}}, ricochet:{en:{desc:'Supported ricochet weapons bounce +1 extra time'}}
});
Object.assign(ITEM_I18N,{
  gym_sauce:{en:{desc:'Damage +10%'}}, oats:{en:{desc:'Max HP +25'}}, turbo_socks:{en:{desc:'Move speed +15%'}},
  time_brace:{en:{desc:'XP gain +8%'}}, gold_glove:{en:{desc:'Gold gain +15%'}}, medkit:{en:{desc:'Regenerate +0.5 HP per second'}},
  battery:{en:{desc:'Attack speed +8%'}}, boss_buster:{en:{desc:'Damage to bosses and elites +15%'}}, ice_crystal:{en:{desc:'Attacks gain +10% freeze chance'}},
  clover:{en:{desc:'Luck +7.5%, improving good drops'}}, wrench:{en:{desc:'Chest cost -8% per stack'}}, slip_ring:{en:{desc:'Evasion +15%'}},
  lucky_charm:{en:{desc:'Critical chance +5%'}}, dash_boots:{en:{desc:'Dash cooldown -10%'}}, magnet_coil:{en:{desc:'Pickup magnet range +18%'}},
  swift_oil:{en:{desc:'Projectile/object speed +10%'}}, backpack:{en:{desc:'All weapon projectile/object count +1'}},
  beer:{en:{desc:'Damage +20%, max HP -5%'}}, brass_knuckle:{en:{desc:'Damage to nearby enemies +20%'}}, echo_shard:{en:{desc:'XP drops have +12% chance to echo'}},
  campfire:{en:{desc:'Standing still regenerates +2 HP per second'}}, leech_crystal:{en:{desc:'Max HP +50, regeneration -50%'}},
  demon_blood:{en:{desc:'Killing enemies increases max HP by +0.5, up to 200'}}, idle_juice:{en:{desc:'Stand still for 3 seconds to gain +100% damage'}},
  thunder_mitts:{en:{desc:'Attacks have 10% chance to trigger lightning AoE'}}, credit_card:{en:{desc:'Opening chests increases damage by +2.5%'}},
  sharpening_stone:{en:{desc:'Critical damage +15%'}}, blink_feather:{en:{desc:'Dash distance +15%'}}, runic_lens:{en:{desc:'Skill size +10%'}},
  stopwatch:{en:{desc:'Projectile/object lifetime +12%, AoE duration +6%'}}, ricochet_charm:{en:{desc:'Supported ricochet weapons bounce +1 extra time'}},
  beefy_ring:{en:{desc:'Damage +20% per 100 max HP'}}, spiky_shield:{en:{desc:'Thorns +2 per 1% armor'}}, shatter_know:{en:{desc:'XP gain +12%'}},
  gamer_goggles:{en:{desc:'Low HP increases damage, up to +60%'}}, demon_soul:{en:{desc:'Killing enemies increases damage by +0.1%, up to 100%'}},
  mirror:{en:{desc:'Reflect 30% damage back'}}, slurp_gloves:{en:{desc:'Lifesteal while attacking +7.5%'}}, eagle_claw:{en:{desc:'Damage to flying enemies +66%'}},
  execution_coin:{en:{desc:'Critical damage +12%; critical hits may drop gold'}}, phase_cloak:{en:{desc:'Dash invulnerability +0.12s, evasion +5%'}},
  battle_banner:{en:{desc:'Ground Haste/Might buffs last +35% longer'}}, butcher_token:{en:{desc:'Damage to The Butcher and Mimics +25%'}},
  big_bonk:{en:{desc:'2% chance to deal 20x damage'}}, holy_book:{en:{desc:'Max HP +100, regeneration +50'}}, soul_harvester:{en:{desc:'Kills drop extra XP and a little extra gold'}}, singularity_core:{en:{desc:'XP/gold magnet range +200%, XP/gold pull speed +50%'}},
  spicy_meatball:{en:{desc:'Attacks have 25% chance to explode for 65% damage'}}, chonkplate:{en:{desc:'Overheal +50%, lifesteal 10% of damage dealt'}},
  energy_core:{en:{desc:'Pulses an energy aura that damages nearby enemies'}}, power_gloves:{en:{name:'Storm Gauntlets',desc:'Attack speed +40%, projectile/object speed +12%, dash cooldown -8%'}},
  dragonfire:{en:{name:'Golden Sword',desc:'Damage +99%'}}, glass_needle:{en:{desc:'Critical chance +25%, critical damage +75%, max HP -15%'}},
  royal_jelly:{en:{desc:'Luck +20%, gold +20%, XP +10%'}}
});
Object.assign(CHAR_I18N,{
  paladin:{en:{bio:'A holy warrior who forgives everyone, except when the cooldown is ready.',passive:'Armor +2 / Lv (heavy tank, slower movement and attacks)'}},
  huntress:{en:{bio:'Can track every monster on the map, but still loses her own house keys.',passive:'Attack speed +1%, damage +1% / Lv'}},
  sorceress:{en:{bio:'Solves most problems with large explosions, then asks what the problem was.',passive:'Damage +2% / Lv'}},
  templar:{en:{bio:'Bound by an old bone oath. The skulls do the staring so he can focus on surviving.',passive:'Damage +1%, max HP +4 / Lv'}},
  ranger:{en:{bio:'Loves nature, but not the parts of nature sprinting directly at him.',passive:'Move speed +1%, attack speed +1% / Lv'}},
  necromancer:{en:{bio:'Talks to spirits every night. The downside is some ask about insurance.',passive:'XP gain +3% / Lv'}},
  slayer:{en:{bio:'Talks less because that time could be used for three more slashes.',passive:'Damage +2.5% / Lv'}},
  priestess:{en:{bio:'Heals with a smile, then politely smites anyone who forgets to say thanks.',passive:'Regeneration +0.3 and heal / Lv'}},
  stormcaller:{en:{bio:'Calls lightning very precisely, except when her phone also needs charging.',passive:'Critical damage +5% / Lv'}},
  assassin:{en:{bio:'So good at vanishing that teammates forget to split loot with her.',passive:'Critical chance +1%, evade +0.5% / Lv'}},
  it_support:{en:{bio:'Always called when systems crash, and always asks, "Have you tried restarting it?"',passive:'Skill size +1%, attack range +1% / Lv'}},
  striker:{en:{bio:'A tournament forward who turned match pressure into a cursed pact.',passive:'Move speed +0.5%, projectile/object speed +2% / Lv'}}
});
Object.assign(PACT_I18N,{
  blood_moon:{en:{title:'Blood Moon',desc:'Normal monsters have +50% HP',unlock:'Clear Map 3 on the selected difficulty by killing the final boss and entering the portal'}},
  glass_soul:{en:{title:'Glass Soul',desc:'Player max HP -25%',unlock:'Clear Map 3 on the selected difficulty by killing the final boss and entering the portal'}},
  cursed_economy:{en:{title:'Cursed Economy',desc:'Gold gain x0.6, shop/chest prices x1.3',unlock:'Clear Map 3 on the selected difficulty by killing the final boss and entering the portal'}},
  no_mercy:{en:{title:'No Mercy',desc:'Regeneration and healing are reduced by 50%',unlock:'Clear Map 3 on the selected difficulty by killing the final boss and entering the portal'}},
  ravenous_horde:{en:{title:'Ravenous Horde',desc:'Monsters spawn faster and in denser packs',unlock:'Clear Map 3 on the selected difficulty by killing the final boss and entering the portal'}}
});
function pactName(p){ return i18nField(PACT_I18N,p&&p.id,'name',p&&p.name); }
function pactTitle(p){ return i18nField(PACT_I18N,p&&p.id,'title',p&&p.title); }
function pactDesc(p){ return i18nField(PACT_I18N,p&&p.id,'desc',p&&p.desc); }
function pactUnlockText(p, difficulty){
  const diff=(difficulty||activeDifficultyId)==='hard' ? 'Hard' : 'Normal';
  if(gameLang()==='en') return 'Clear Map 3 on '+diff+' by killing the final boss and entering the portal';
  return 'เคลียร์ Map 3 ระดับ '+diff+' โดยฆ่าบอสสุดท้ายแล้วเข้าวาร์ป';
}
function setGameLanguage(lang){ localStorage.setItem(LANG_STORAGE_KEY, lang==='en'?'en':'th'); applyStaticI18n(); updateStartFlow(); if(typeof renderAuth==='function') renderAuth(); if(currentGuideKind) openGuide(currentGuideKind); if(document.getElementById('select')&&document.getElementById('select').style.display==='flex') buildSelect(); }
function makeLangToggle(id){
  const wrap=document.createElement('div');
  wrap.id=id;
  wrap.className='langtoggle';
  wrap.innerHTML='<span></span><button type="button" data-lang="th"></button><button type="button" data-lang="en"></button>';
  wrap.querySelectorAll('button').forEach(btn=>btn.onclick=()=>setGameLanguage(btn.dataset.lang));
  return wrap;
}
function ensureLanguageToggle(){
  const titleContent=document.querySelector('#title .titlecontent');
  if(titleContent && !document.getElementById('langtoggle')){
    const wrap=makeLangToggle('langtoggle');
    const label=titleContent.querySelector('.startlabel');
    titleContent.insertBefore(wrap, label || titleContent.firstChild);
  }
  const authPanel=document.querySelector('.authpanel');
  if(authPanel && !document.getElementById('authlangtoggle')){
    const wrap=makeLangToggle('authlangtoggle');
    const sub=authPanel.querySelector('.authsub');
    authPanel.insertBefore(wrap, sub ? sub.nextSibling : authPanel.firstChild);
  }
}
function applyStaticI18n(){
  ensureLanguageToggle();
  const lang=gameLang();
  document.documentElement.lang=lang;
  const set=(sel,key)=>{ const el=document.querySelector(sel); if(el) el.textContent=tr(key); };
  set('#title .eyebrow','title.eyebrow'); set('#title .ts','title.tagline'); set('.startlabel','title.identity');
  const metas=document.querySelectorAll('.titlemeta span'); if(metas[0]) metas[0].innerHTML='<i></i>'+escHtml(tr('title.meta.heroes')); if(metas[1]) metas[1].innerHTML='<i></i>'+escHtml(tr('title.meta.maps')); if(metas[2]) metas[2].innerHTML='<i></i>'+escHtml(tr('title.meta.minutes'));
  const howtoBtn=document.querySelector('.titlemenu button[data-guide="howto"]'); if(howtoBtn) howtoBtn.textContent=tr('title.howto');
  const latestBtn=document.getElementById('latestbtn'); if(latestBtn) latestBtn.textContent=tr('title.latest');
  const petsBtn=document.querySelector('.titlemenu button[data-guide="pets"]'); if(petsBtn) petsBtn.textContent=tr('title.pets');
  const guideBtn=document.querySelector('.titlemenu button[data-guide="hub"]'); if(guideBtn) guideBtn.textContent=tr('title.guide');
  updateRankToggleLabel();
  set('.authpanel h2','auth.chooseTitle'); set('.authpanel .authsub','auth.chooseSub');
  const g=document.querySelector('#googlechoice .mode-name'); if(g) g.textContent=tr('auth.google'); const gd=document.querySelector('#googlechoice .mode-desc'); if(gd) gd.textContent=tr('auth.googleDesc');
  const q=document.querySelector('#guestchoice .mode-name'); if(q) q.textContent=tr('auth.guest'); const qd=document.querySelector('#guestchoice .mode-desc'); if(qd) qd.textContent=tr('auth.guestDesc');
  set('#resumebtn','pause.resume'); set('#quitbtn','pause.quit'); set('#pause small','pause.hint');
  if(document.getElementById('firsthelp')&&document.getElementById('firsthelp').style.display==='flex') renderFirstHelp();
  if(document.getElementById('whatsnew')&&document.getElementById('whatsnew').style.display==='flex') renderWhatsNew();
  updateScreenShakeButton();
  updateAudioButtons();
  document.querySelectorAll('.langtoggle').forEach(langBox=>{ const span=langBox.querySelector('span'); if(span) span.textContent=tr('lang.label'); langBox.querySelector('[data-lang="th"]').textContent=tr('lang.th'); langBox.querySelector('[data-lang="en"]').textContent=tr('lang.en'); langBox.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active', btn.dataset.lang===lang)); });
}
window.tr=tr; window.setGameLanguage=setGameLanguage; window.gameLang=gameLang; window.updateRankToggleLabel=updateRankToggleLabel;

function isTitleRankingVisible(){
  return document.body.classList.contains('touch')
    ? document.body.classList.contains('rank-open')
    : !document.body.classList.contains('rank-hidden');
}
function updateRankToggleLabel(){
  const btn=document.getElementById('ranktoggle');
  if(btn) btn.textContent=tr(isTitleRankingVisible() ? 'title.rank.hide' : 'title.rank.show');
  const restore=document.getElementById('rankrestore');
  if(restore) restore.textContent=tr('title.rank.show');
}
function toggleTitleRanking(){
  if(document.body.classList.contains('touch')){
    document.body.classList.toggle('rank-open');
  }else{
    document.body.classList.toggle('rank-hidden');
  }
  updateRankToggleLabel();
}

function spawnDmg(x,z,amount,color,crit,kind){
  if(document.body.classList.contains('touch')){
    const important = crit || kind==='playerhit' || kind==='guard' || kind==='immune';
    if(document.body.classList.contains('hud-min') && !important) return;
    if(document.body.classList.contains('hud-compact') && !important && Math.random()<0.6) return;
  }
  if (dmgNums.length>36) return;
  const cls=['dn'];
  if(crit) cls.push('crit');
  if(kind) cls.push(kind);
  const el=document.createElement('div');
  el.className=cls.join(' ');
  el.textContent=typeof amount==='string' ? amount : Math.round(amount);
  el.style.color=crit?'#ffd86a':(kind==='playerhit'?'#ff536d':kind==='guard'?'#9ee7ff':kind==='immune'?'#d7c5ff':'#'+('000000'+((color||0xffffff)>>>0).toString(16)).slice(-6));
  document.getElementById('dmg').appendChild(el);
  dmgNums.push({ el, x, z, t:0, life:crit?0.86:(kind==='playerhit'?0.76:0.65), ox:(Math.random()-0.5)*0.7, crit:!!crit, kind:kind||'' });
}
function petEmojiSet(kind, petId){
  const base={
    start:['✨','💛','!'],
    level:['⭐','🎉','✨'],
    loot:['💎','✨','!'],
    hurt:['💢','💛','!'],
    lowhp:['💙','💦','!'],
    idle:['…','💤','?'],
    select:['💛','✨','!']
  };
  const flavor={
    lumo_wisp:{ start:['✨','🔥'], level:['⭐','🔥'], loot:['💎','✨'], hurt:['💦','🔥'], lowhp:['💙','✨'], idle:['✨','…'], select:['🔥','✨'] },
    lantern_bunny:{ start:['🏮','✨'], level:['🐾','⭐'], loot:['💎','🏮'], hurt:['💦','🏮'], lowhp:['💛','🏮'], idle:['💤','🏮'], select:['🏮','🐾'] },
    tiny_gargoyle:{ start:['🛡','✨'], level:['🪨','⭐'], loot:['💎','🛡'], hurt:['🛡','💢'], lowhp:['🛡','💙'], idle:['…','🪨'], select:['🛡','!'] },
    storm_pup:{ start:['⚡','🐾'], level:['⚡','⭐'], loot:['💎','⚡'], hurt:['💢','⚡'], lowhp:['💙','⚡'], idle:['🐾','…'], select:['⚡','🐾'] },
    grave_kitten:{ start:['🐾','🌙'], level:['🐾','⭐'], loot:['💎','🌙'], hurt:['💢','🐾'], lowhp:['💜','🐾'], idle:['💤','🐾'], select:['🐾','💜'] },
    mini_mimic:{ start:['💰','✨'], level:['💰','⭐'], loot:['💎','💰'], hurt:['💢','💰'], lowhp:['💛','💰'], idle:['…','💰'], select:['💰','!'] }
  };
  return (flavor[petId]&&flavor[petId][kind]) || base[kind] || ['✨'];
}
function spawnPetBubble(text, life){
  if(!player || !player.pet || !player.pet.spr || petBubbles.length>10) return;
  const el=document.createElement('div');
  el.className='petbubble';
  el.textContent=text;
  document.getElementById('dmg').appendChild(el);
  const pet=player.pet;
  petBubbles.push({ el, pet, t:0, life:life||1.05, ox:(Math.random()-0.5)*0.3 });
}
function petReact(kind, force){
  if(!player || !player.pet) return;
  const pet=player.pet;
  const now=gameTime||0;
  if(!force && now < (pet.reactCd||0)) return;
  const set=petEmojiSet(kind, pet.id);
  spawnPetBubble(set[(Math.random()*set.length)|0], kind==='idle'?1.25:1.05);
  pet.reactT=Math.max(pet.reactT||0, kind==='start'?0.9:kind==='loot'?0.75:kind==='hurt'||kind==='lowhp'?0.65:0.55);
  pet.reactKind=kind;
  pet.reactCd=now+(kind==='lowhp'?5.5:kind==='idle'?7.0:1.2);
}
let weaponSig=null;
function updateWeaponHUD(){
  const sig = player.weapons.map(w=>w.key+w.lvl+evolveStateForWeapon(w).state).join(',')+'|'+Object.entries(player.tomeCount||{}).map(([k,v])=>k+v).join(',');
  if (sig===weaponSig) return; weaponSig=sig;
  const wrap=document.getElementById('weapons'); wrap.innerHTML='';
  for (let i=0;i<MAX_WEAPONS;i++){
    const w=player.weapons[i];
    const d=document.createElement('div');
    if (w){ const t=WEAPON_TYPES[w.key]||{}, ev=evolveStateForWeapon(w); d.className='wslot'+(w.evolved?' evo':'')+(ev.state!=='none'?' ev-'+ev.state:''); d.title=weaponName(w.key)+(ev.text?' - '+ev.text:'');
      d.innerHTML='<img src="'+escHtml(spriteSrc(t.icon))+'"><span>Lv'+w.lvl+'</span>'; }
    else { d.className='wslot empty'; d.title=tr('common.emptyWeapon'); d.textContent='+'; }
    wrap.appendChild(d);
  }
}
let tomeSig=null;
function updateTomeHUD(){
  const tc=player.tomeCount||{};
  const ids=Object.keys(tc).filter(id=>tc[id]>0);
  const sig=ids.map(id=>id+tc[id]+evolveStateForTome(id).state).join(',')+'|'+player.weapons.map(w=>w.key+w.lvl).join(',');
  if (sig===tomeSig) return; tomeSig=sig;
  const wrap=document.getElementById('tomes'); if(!wrap) return; wrap.innerHTML='';
  for (let i=0;i<MAX_TOMES;i++){
    const id=ids[i];
    const d=document.createElement('div');
    if (id){ const u=UPGRADES.find(x=>x.id===id)||{}, ev=evolveStateForTome(id); d.className='tslot'+(ev.state!=='none'?' ev-'+ev.state:''); d.title=tomeName(u)+' - '+tomeDesc(u)+(ev.text?' - '+ev.text:'');
      d.innerHTML='<img src="'+escHtml(spriteSrc(u.icon))+'"><span>×'+tc[id]+'</span>'; }
    else { d.className='tslot empty'; d.title=tr('common.emptyTome'); d.textContent='+'; }
    wrap.appendChild(d);
  }
}
async function checkForGameUpdate(){
  try{
    const res=await fetch('version.json?ts='+Date.now(),{ cache:'no-store' });
    if(!res.ok) return;
    const data=await res.json();
    const latest=String(data.version||'').trim();
    const btn=document.getElementById('updatebtn');
    if(btn && latest) btn.style.display = latest!==APP_VERSION ? 'block' : 'none';
  } catch(e){}
}
function startVersionCheck(){
  const btn=document.getElementById('updatebtn');
  if(btn) btn.onclick=()=>{ location.href=location.pathname+'?reload='+Date.now(); };
  checkForGameUpdate();
  if(versionCheckTimer) clearInterval(versionCheckTimer);
  versionCheckTimer=setInterval(checkForGameUpdate,45000);
}
let objSig='';
function updateObjective(){
  objSig='';
}
function updateDamageNumbers(dt){
  for (let i=dmgNums.length-1;i>=0;i--){ const d=dmgNums[i]; d.t+=dt;
    if (d.t>=d.life){ d.el.remove(); dmgNums.splice(i,1); continue; }
    const p=d.t/d.life;
    const jump=d.crit?2.9:(d.kind==='playerhit'?2.1:2.4);
    damageScreenPos.set(d.x+d.ox, 1.6+d.t*jump, d.z).project(camera);
    d.el.style.left=((damageScreenPos.x*0.5+0.5)*innerWidth)+'px';
    d.el.style.top=((-damageScreenPos.y*0.5+0.5)*innerHeight)+'px';
    d.el.style.opacity=String(Math.max(0,1-p));
    const punch=d.crit ? 1+Math.max(0,1-p*5)*0.55 : d.kind==='playerhit' ? 1+Math.max(0,1-p*6)*0.28 : 1+Math.max(0,1-p*7)*0.18;
    const wobble=d.crit ? Math.sin(p*Math.PI*5)*3 : 0;
    d.el.style.transform='translate(-50%,-50%) scale('+punch.toFixed(3)+') rotate('+wobble.toFixed(2)+'deg)';
  }
  for (let i=petBubbles.length-1;i>=0;i--){
    const b=petBubbles[i]; b.t+=dt;
    if(b.t>=b.life || !b.pet || !b.pet.spr){ b.el.remove(); petBubbles.splice(i,1); continue; }
    const p=b.t/b.life;
    const x=(b.pet.x||player.x)+b.ox;
    const z=(b.pet.z||player.z);
    damageScreenPos.set(x, 1.25 + p*1.4, z).project(camera);
    b.el.style.left=((damageScreenPos.x*0.5+0.5)*innerWidth)+'px';
    b.el.style.top=((-damageScreenPos.y*0.5+0.5)*innerHeight)+'px';
    b.el.style.opacity=String(Math.max(0,1-p));
    const bounce=1+Math.sin(Math.min(1,p*2)*Math.PI)*0.22;
    b.el.style.transform='translate(-50%,-50%) scale('+bounce.toFixed(3)+')';
  }
}
function spawnTrail(x,z,color,scale,life){
  if(trails.length>=80) return;
  const m=new THREE.Group();
  const core=new THREE.Mesh(TRAIL_GEO, new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.52, blending:THREE.AdditiveBlending, depthWrite:false }));
  const glow=new THREE.Mesh(new THREE.SphereGeometry(0.18,8,8), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.16, blending:THREE.AdditiveBlending, depthWrite:false }));
  m.add(glow); m.add(core);
  m.scale.setScalar(scale||1); m.position.set(x, groundHeight(x,z)+0.9, z); scene.add(m);
  trails.push({ mesh:m, life:life||0.16, max:life||0.16, core, glow });
}
const rings = [];
const bossAoEs = [];
const bossImpactFx = [];
const challengeRoomVisuals = [];
function spawnRing(x, z, color, maxR, life){
  capEffectList(rings, MAX_RINGS);
  const m=new THREE.Mesh(EFFECT_PLANE_GEO, new THREE.MeshBasicMaterial({
    map:getPixelRingTexture(), color, transparent:true, opacity:0.9,
    alphaTest:0.08, side:THREE.DoubleSide, depthWrite:false
  }));
  m.position.set(x, groundHeight(x,z)+0.12, z); scene.add(m);
  rings.push({ mesh:m, maxR:maxR||5, life:life||0.5, max:life||0.5 });
}
function spawnObjectPulse(x, z, color, maxR, life){
  capEffectList(rings, MAX_RINGS);
  const m=new THREE.Mesh(EFFECT_PLANE_GEO, new THREE.MeshBasicMaterial({
    map:getEntityAuraTexture('object'), color, transparent:true, opacity:0.72,
    alphaTest:0.06, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending
  }));
  m.position.set(x, groundHeight(x,z)+0.13, z);
  m.rotation.z=Math.PI/4;
  scene.add(m);
  rings.push({ mesh:m, maxR:maxR||5, life:life||0.5, max:life||0.5 });
}
function spawnBurst(x, z, color, n, scl){
  const budget=IS_MOBILE?60:120;   // fewer particles on phones
  const count=Math.min(IS_MOBILE?Math.ceil((n||7)*0.55):(n||7), Math.max(0,budget-particles.length));
  for (let i=0;i<count;i++){ const a=Math.random()*Math.PI*2, sp=2+Math.random()*4;
    const m=new THREE.Mesh(PARTICLE_GEO, getBurstMaterial(color));
    m.scale.setScalar(scl||1); scene.add(m);
    particles.push({ x, z, y:0.6, vx:Math.cos(a)*sp, vz:Math.sin(a)*sp, vy:2+Math.random()*3, life:0.5, max:0.5, mesh:m }); }
}
function spawnEnemyShot(x, z, dx, dz, dmg, opts){
  if (enemyShots.length > 96) return;
  if (enemyShots.length > 72 && Math.random() < 0.35) return;
  opts=opts||{};
  const m=new THREE.Group();
  const color=opts.color||0xff5066, coreColor=opts.coreColor||0xffb0bc;
  if(opts.shape==='arrow'){
    const shaft=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.05,0.09), new THREE.MeshBasicMaterial({ color:coreColor, transparent:true, opacity:0.98, blending:THREE.AdditiveBlending, depthWrite:false }));
    const head=new THREE.Mesh(new THREE.ConeGeometry(0.13,0.30,4), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false }));
    head.rotation.z=-Math.PI/2; head.position.x=0.48;
    const glow=new THREE.Mesh(new THREE.BoxGeometry(0.98,0.04,0.20), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.16, blending:THREE.AdditiveBlending, depthWrite:false }));
    m.add(glow); m.add(shaft); m.add(head);
    m.rotation.y=-Math.atan2(dz,dx);
  } else {
    const glow=new THREE.Mesh(new THREE.SphereGeometry(opts.glowSize||0.26,10,10), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.20, blending:THREE.AdditiveBlending, depthWrite:false }));
    const core=new THREE.Mesh(new THREE.SphereGeometry(opts.coreSize||0.12,8,8), new THREE.MeshBasicMaterial({ color:coreColor, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false }));
    m.add(glow); m.add(core);
  }
  scene.add(m); enemyShots.push({ x, z, dx, dz, speed:opts.speed||9, dmg, life:opts.life||3, alive:true, mesh:m, color, source:opts.source||null, hitRadius:opts.hitRadius||0.46, trailScale:opts.trailScale||0.48 });
}
const SHOOTERS  = new Set(['Swamp Witch','Shadow Weaver','Dark Apostle','Toxic Spore','Abyssal Horror','Grave Arbalist','Mire Hexer','Rift Needler','Doom Cantor']);
const CHARGERS  = new Set(['Wraith','Dire Bat','Chaos Wisp','Willow Wisp','Rift Phantom','Nether Drake']);
const EXPLODERS = new Set(['Oblivion Orb','Chaos Wisp','Plague Rat']);
const SPLITTERS = new Set(['Muck Slime','Blight Treant']);
const BUFFERS   = new Set(['Dark Apostle','Doom Cantor']);
const PULLERS   = new Set(['Void Walker','Abyssal Horror']);
const HAZARDERS = new Set(['Toxic Spore','Bog Elemental','Blight Treant']);
const THIEVES   = new Set(['Grave Robber','Marsh Lurker']);
const WARDERS   = new Set(['Covenant Warder']);
const SHIELDERS = new Set(['Covenant Warder','Dark Apostle']);
const AIRBORNE  = new Set(['Wraith','Dire Bat','Willow Wisp','Chaos Wisp','Rift Phantom','Nether Drake','Oblivion Orb']);   // Eagle Claw targets
function behaviorFor(name){ if(WARDERS.has(name))return'warder'; if(THIEVES.has(name))return'thief'; if(PULLERS.has(name))return'puller'; if(HAZARDERS.has(name))return'hazard'; if(SHOOTERS.has(name))return'shooter'; if(CHARGERS.has(name))return'charger'; if(EXPLODERS.has(name))return'exploder'; if(SPLITTERS.has(name))return'splitter'; return'chase'; }
function hasTrait(e,set){ return !!(e && set && set.has(e.name)); }
function canReceiveEnemyBuff(source,target){
  if(!source || !target || !target.alive || target===source || target.isBoss || target.elite) return false;
  if(target.name===source.name) return false;
  if(hasTrait(target,BUFFERS) || hasTrait(target,SHIELDERS) || hasTrait(target,WARDERS)) return false;
  return true;
}
function updateWarderAura(e,dt){
  e.wardPulse=(e.wardPulse||0)-dt;
  const radius=6.2;
  const targets=[];
  forEachNearbyEnemy(e.x,e.z,radius+1,t=>{
    if(!t.alive || t===e || t.isBoss || t.elite) return;
    const dx=t.x-e.x,dz=t.z-e.z;
    const dist2=dx*dx+dz*dz;
    if(dist2>(radius+t.r)*(radius+t.r)) return;
    targets.push({t,dist2});
  });
  targets.sort((a,b)=>a.dist2-b.dist2);
  const linked=Math.min(5,targets.length);
  for(let i=0;i<linked;i++){
    const t=targets[i].t;
    t.wardedBy=e; t.wardT=0.35;
    if(t.spr && t.spr.material) t.spr.material.color.setHex(0xd8a2ff);
  }
  if(e.wardPulse<=0){
    e.wardPulse=1.0;
    spawnObjectPulse(e.x,e.z,0x9a55ff,radius,0.55);
    spawnBurst(e.x,e.z,0x9a55ff,Math.min(14,4+linked),0.7);
  }
}
function isDeathWarded(e){
  return !!(e && e.wardedBy && e.wardedBy.alive && (e.wardT||0)>0);
}
function enemyHazardColor(e){
  if(e.name==='Bog Elemental') return 0x8a6a3f;
  if(e.name==='Blight Treant') return 0x8fcf6a;
  return 0x55d66a;
}
function enemyHazardImpact(e){
  if(e.name==='Bog Elemental') return 'mud_hazard';
  if(e.name==='Blight Treant') return 'root_hazard';
  return 'poison_hazard';
}
function updateEnemyTraits(e,dt,nx,nz,d){
  if(hasTrait(e,SHIELDERS)) updateWarderAura(e,dt);
  if(hasTrait(e,BUFFERS)) updateEnemyBuffer(e,dt);
  if(hasTrait(e,HAZARDERS)) updateEnemyHazard(e,dt,d);
  if(hasTrait(e,PULLERS)) updateEnemyPuller(e,dt,nx,nz,d);
  if(hasTrait(e,THIEVES)) updateEnemyThief(e,dt,nx,nz,d);
}
function updateEnemyBuffer(e,dt){
  e.buffCd=(e.buffCd||1.2+Math.random()*1.8)-dt;
  if(e.buffCd>0) return;
  e.buffCd=e.name==='Doom Cantor'?5.8+Math.random()*1.2:6.8+Math.random()*1.5;
  let linked=0;
  forEachNearbyEnemy(e.x,e.z,7.4,t=>{
    if(linked>=6 || !canReceiveEnemyBuff(e,t)) return;
    const dx=t.x-e.x,dz=t.z-e.z;
    if(dx*dx+dz*dz>(7.4+t.r)*(7.4+t.r)) return;
    t.buffT=Math.max(t.buffT||0,4.0);
    t.buffAtkMul=Math.max(t.buffAtkMul||1,1.22);
    t.buffSpeedMul=Math.max(t.buffSpeedMul||1,1.18);
    linked++;
  });
  if(linked>0){
    spawnObjectPulse(e.x,e.z,e.name==='Doom Cantor'?0xff75b7:0x9a55ff,7.4,0.55);
    spawnBossImpactFx(e.x,e.z,3.3,e.name==='Doom Cantor'?0xff75b7:0x9a55ff,'enemy_buff');
    spawnBurst(e.x,e.z,e.name==='Doom Cantor'?0xff75b7:0x9a55ff,8+linked,0.85);
  }
}
function updateEnemyHazard(e,dt,d){
  e.hazardCd=(e.hazardCd||3.2+Math.random()*2.8)-dt;
  if(e.hazardCd>0 || d>14) return;
  const activeHazards=bossAoEs.filter(a=>a && a.enemyHazard).length;
  const hazardCap=mapStage>=3?5:4;
  if(activeHazards>=hazardCap){
    e.hazardCd=1.4+Math.random()*1.0;
    return;
  }
  const slow=e.name==='Blight Treant';
  e.hazardCd=slow?7.4+Math.random()*1.8:6.0+Math.random()*1.6;
  const radius=e.name==='Bog Elemental'?1.95:e.name==='Blight Treant'?1.72:1.48;
  const delay=e.name==='Toxic Spore'?0.75:0.92;
  const color=enemyHazardColor(e);
  const ox=e.name==='Bog Elemental'?0:Math.cos(Math.atan2(player.z-e.z,player.x-e.x))*1.6;
  const oz=e.name==='Bog Elemental'?0:Math.sin(Math.atan2(player.z-e.z,player.x-e.x))*1.6;
  bossAoe(e,clamp(player.x-ox,-MAP_BOUND,MAP_BOUND),clamp(player.z-oz,-MAP_BOUND,MAP_BOUND),radius,delay,e.name==='Bog Elemental'?0.95:0.66,color,slow?6:9,enemyHazardImpact(e),{ danger:e.name!=='Toxic Spore', markSpin:slow?0.3:0, enemyHazard:true });
  spawnObjectPulse(e.x,e.z,color,e.r*1.8,0.32);
}
function updateEnemyPuller(e,dt,nx,nz,d){
  e.pullCd=(e.pullCd||2.4+Math.random()*2.4)-dt;
  if(e.pullCd>0 || d<3.0 || d>13.5) return;
  e.pullCd=e.name==='Abyssal Horror'?5.2+Math.random()*1.2:4.6+Math.random()*1.0;
  e.pullWindup=0.48;
  e.pullX=nx; e.pullZ=nz;
  spawnObjectPulse(e.x,e.z,0x7c8dff,e.r*2.5,0.46);
  spawnRing(e.x,e.z,0x7c8dff,e.r*2.8,0.38);
}
function resolveEnemyPull(e,dt){
  if(!e.pullWindup) return;
  e.pullWindup-=dt;
  if(e.pullWindup>0) return;
  e.pullWindup=0;
  const dx=e.x-player.x,dz=e.z-player.z,d=Math.hypot(dx,dz)||1;
  if(d<14){
    const power=e.name==='Abyssal Horror'?7.0:8.5;
    player.knockX=(player.knockX||0)+dx/d*power;
    player.knockZ=(player.knockZ||0)+dz/d*power;
    spawnObjectPulse(player.x,player.z,0x7c8dff,2.2,0.38);
    spawnBossImpactFx(player.x,player.z,2.1,0x7c8dff,'void_pull');
    spawnBurst(player.x,player.z,0x7c8dff,8,0.62);
  }
}
function updateEnemyThief(e,dt,nx,nz,d){
  if(e.stolenGold>0){
    e.fleeT=(e.fleeT||4.0)-dt;
    if(e.fleeT<=0){ e.stolenGold=0; e.fleeT=0; }
    return;
  }
  e.stealCd=(e.stealCd||2.5+Math.random()*2.0)-dt;
  if(e.stealCd>0 || d>1.75 || player.gold<=0) return;
  const amount=Math.max(1,Math.min(player.gold,Math.round(4+mapStage*2+Math.random()*5)));
  player.gold-=amount;
  e.stolenGold=amount;
  e.fleeT=4.5;
  e.stealCd=7.0+Math.random()*3.0;
  spawnDmg(e.x,e.z,'-'+amount+' gold',0xffd86a,false,'gold');
  spawnObjectPulse(e.x,e.z,0xffd86a,2.6,0.45);
  spawnBossImpactFx(e.x,e.z,1.8,0xffd86a,'gold_steal');
}
function enemyShoot(e,nx,nz){
  const base=Math.atan2(nz,nx);
  if(e.name==='Grave Arbalist'){
    spawnEnemyShot(e.x,e.z,nx,nz,Math.round(e.atk*1.05),{ source:e, speed:13.5, life:2.2, color:0xd8c08a, coreColor:0xffedb0, shape:'arrow', hitRadius:0.34, trailScale:0.36 });
    e.atkCd=1.45+Math.random()*0.40;
  } else if(e.name==='Mire Hexer'){
    for(const k of [-0.5,0.5]){ const a=base+k*0.26; spawnEnemyShot(e.x,e.z,Math.cos(a),Math.sin(a),Math.round(e.atk*0.9),{ source:e, speed:7.2, life:3.2, color:0x45d66a, coreColor:0xa8ffc0, hitRadius:0.40, trailScale:0.40 }); }
    e.atkCd=2.70+Math.random()*0.70;
  } else if(e.name==='Rift Needler'){
    for(let k=-1;k<=1;k++){
      const a=base+k*0.12;
      spawnEnemyShot(e.x,e.z,Math.cos(a),Math.sin(a),Math.round(e.atk*0.76),{ source:e, speed:12.5, life:2.2, color:0x7c8dff, coreColor:0xd8e4ff, glowSize:0.18, coreSize:0.08, hitRadius:0.32, trailScale:0.30 });
    }
    e.atkCd=2.20+Math.random()*0.45;
  } else if(e.name==='Doom Cantor'){
    const n=7, off=gameTime*0.8;
    for(let i=0;i<n;i++){ const a=off+(i/n)*Math.PI*2; spawnEnemyShot(e.x,e.z,Math.cos(a),Math.sin(a),Math.round(e.atk*0.74),{ source:e, speed:5.5, life:3.8, color:0x9a55ff, coreColor:0xff75b7, glowSize:0.22, coreSize:0.10, hitRadius:0.40, trailScale:0.38 }); }
    e.atkCd=4.8+Math.random()*0.9;
  } else {
    spawnEnemyShot(e.x, e.z, nx, nz, e.atk, { source:e });
    e.atkCd=1.8+Math.random()*0.8;
  }
}
function blocked(x, z){
  for (const o of obstacles){ const rr=o.r+0.42; if ((x-o.x)*(x-o.x)+(z-o.z)*(z-o.z) < rr*rr) return true; }
  return false;
}
function findOpenPosition(x,z,maxRadius){
  if(!blocked(x,z)) return {x,z};
  const limit=maxRadius||2.4;
  for(let radius=0.45;radius<=limit;radius+=0.45){
    const steps=Math.max(8,Math.ceil(radius*12));
    for(let i=0;i<steps;i++){
      const angle=(i/steps)*Math.PI*2;
      const nx=clamp(x+Math.cos(angle)*radius,-MAP_BOUND,MAP_BOUND);
      const nz=clamp(z+Math.sin(angle)*radius,-MAP_BOUND,MAP_BOUND);
      if(!blocked(nx,nz)) return {x:nx,z:nz};
    }
  }
  return null;
}
function pointAroundPlayer(minDistance,maxDistance,ignoreObstacles){
  for(let i=0;i<24;i++){
    const angle=Math.random()*Math.PI*2;
    const distance=minDistance+Math.random()*(maxDistance-minDistance);
    const x=clamp(player.x+Math.cos(angle)*distance,-MAP_BOUND+1,MAP_BOUND-1);
    const z=clamp(player.z+Math.sin(angle)*distance,-MAP_BOUND+1,MAP_BOUND-1);
    if(ignoreObstacles || !blocked(x,z)) return {x,z};
  }
  return findOpenPosition(
    clamp(player.x+minDistance,-MAP_BOUND+1,MAP_BOUND-1),
    clamp(player.z,-MAP_BOUND+1,MAP_BOUND-1),
    4
  );
}
function relocateEnemyNearPlayer(e){
  const point=pointAroundPlayer(e.isBoss?22:20,e.isBoss?28:26,e.isBoss);
  if(!point) return false;
  spawnBurst(e.x,e.z,e.isBoss?0xff5066:0x7655aa,e.isBoss?8:3,e.isBoss?0.8:0.35);
  e.x=point.x; e.z=point.z;
  e.kx=0; e.kz=0; e.stuckT=0; e.relocateCd=2;
  spawnBurst(e.x,e.z,e.isBoss?0xff5066:0x7655aa,e.isBoss?10:4,e.isBoss?0.9:0.4);
  return true;
}
function moveEnemyAroundObstacles(e,mvx,mvz,dt){
  const startX=e.x, startZ=e.z;
  const distance=Math.hypot(mvx,mvz);
  if(distance<=0) return false;
  const base=Math.atan2(mvz,mvx);
  if(!e.avoidSide) e.avoidSide=Math.random()<0.5?-1:1;
  const turns=[0,0.38*e.avoidSide,-0.38*e.avoidSide,0.78*e.avoidSide,-0.78*e.avoidSide,1.2*e.avoidSide,-1.2*e.avoidSide];
  for(const turn of turns){
    const nx=e.x+Math.cos(base+turn)*distance;
    const nz=e.z+Math.sin(base+turn)*distance;
    if(!blocked(nx,nz)){
      e.x=nx; e.z=nz;
      if(turn) e.avoidSide=turn>0?1:-1;
      break;
    }
  }
  const moved=(e.x-startX)*(e.x-startX)+(e.z-startZ)*(e.z-startZ)>0.000001;
  e.stuckT=moved?Math.max(0,(e.stuckT||0)-dt*2):(e.stuckT||0)+dt;
  if(e.stuckT>0.45){
    const open=findOpenPosition(e.x,e.z,Math.min(2.7,0.9+e.stuckT*1.5));
    if(open){
      e.x=open.x; e.z=open.z;
      e.stuckT=0;
      e.avoidSide*=-1;
      return true;
    }
  }
  return moved;
}
const keys = {};
let gameTime = 0, kills = 0, gameOver = false, deathCinematic = false, deathCinematicTimer = 0, score = 0, damageTaken = 0, scoreFinalized = false, lastScoreEntry = null, deathPenalty = null;
let runStats = null;
let stageStartTime = 0;                       // gameTime when the current stage began
function stageTime(){ return gameTime - stageStartTime; }   // per-stage clock (resets each map)
function healCap(p){ return Math.round(p.maxHp*(1+(p.overheal||0))); }   // Chonkplate lets HP exceed max
// Overtime starts at x2, then climbs x3, x4, x5... on a shared cadence.
function overtimeThreshold(){ return activeDifficulty().otStart || RUN_TARGET; }
function overtimeStep(){ return activeDifficulty().otStep || 60; }
function overtimeCapBase(){ return activeDifficulty().otCapBase || 220; }
function overtimeCapStep(){ return activeDifficulty().otCapStep || 40; }
function overtimeElapsed(){
  if(mapStage>=3) return finalBossKilledAt==null ? -1 : gameTime-finalBossKilledAt;
  return stageTime()-overtimeThreshold();
}
function overtimeLevel(){
  const ot=overtimeElapsed();
  const step=overtimeStep();
  if(mapStage>=3) return ot<0 ? 0 : Math.floor(ot/step)+1;
  return ot<0 ? 0 : Math.floor(ot/step)+1;
}
function overtimeTier(){ const level=overtimeLevel(); return level ? level+1 : 1; }
function otPowerMul(){ return overtimeTier(); }
function otSpeedMul(){ const tier=overtimeTier(); return tier>1 ? 1 + Math.min(0.72,(tier-2)*0.08) : 1; }
// Unified enemy cap on ALL platforms so leaderboard scoring conditions are identical (fair single board).
// (Mobile still saves FPS via bloom-off + fewer particles — those are visual only, no score impact.)
function overtimeEnemyCap(){ return overtimeLevel() ? overtimeCapBase() + (overtimeLevel()-1)*overtimeCapStep() : overtimeCapBase(); }
let globalPickupMagnet = 0;
let waveTimer = 0, waveInterval = 3.2, enemiesPerWave = 2, maxEnemies = 18;
let nextHordeAt = 240, hordeRemaining = 0, hordeSpawnTimer = 0, hordeNumber = 0, hordeSpawned = 0, hordeWarned = false;
let overtimeWarnStage = 0;
let overtimeAnnouncedTier = 1;
let finalBossWarnStage = 0;
let relocationCursor = 0;
let mbTimer = 0;
let nextMinibossAt = 180;
const MINIBOSS_INTERVAL = 55;
const BUTCHER_RUN_CHANCE = 0.20;
const BUTCHER_OVERTIME_CHANCE = 0.16;
const BUTCHER_OVERTIME_ROLL_INTERVAL = 45;
const BUTCHER_HUNT_DURATION = 30;
let butcherRunEligible = Math.random() < BUTCHER_RUN_CHANCE;
let butcherAppeared = false;
let nextButcherAt = butcherRunEligible ? 360 + Math.random()*120 : Infinity;
let nextButcherOvertimeRollAt = Infinity;
let butcherActive = false;
let butcherKills = 0;
const CHALLENGE_ONLY_ENEMIES = new Set([
  'Grave Robber','Marsh Lurker','Muck Slime','Blight Treant','Toxic Spore','Bog Elemental',
  'Void Walker','Abyssal Horror','Dark Apostle','Doom Cantor','Chaos Wisp','Oblivion Orb'
]);
const CHALLENGE_ROOMS = [
  { id:'treasure_vault', name:'Treasure Vault', duration:65, cap:52, batch:4, interval:1.05, color:0xffd86a,
    enemies:['Grave Robber','Marsh Lurker','Muck Slime','Oblivion Orb'], reward:'gold' },
  { id:'cursed_shrine', name:'Cursed Shrine Room', duration:75, cap:60, batch:5, interval:0.95, color:0x9a55ff,
    enemies:['Dark Apostle','Doom Cantor','Blight Treant','Toxic Spore'], reward:'relic' },
  { id:'butcher_arena', name:'Butcher Arena', duration:60, cap:34, batch:3, interval:1.25, color:0xff263f,
    enemies:['Grave Robber','Abyssal Horror','Void Walker','Chaos Wisp'], reward:'butcher' },
  { id:'soul_trial', name:'Soul Trial', duration:45, cap:46, batch:4, interval:1.0, color:0x57e0ff,
    enemies:['Void Walker','Toxic Spore','Marsh Lurker','Doom Cantor'], reward:'soul' },
  { id:'merchant_trap', name:'Merchant Trap', duration:70, cap:48, batch:4, interval:1.05, color:0xffb14a,
    enemies:['Grave Robber','Dark Apostle','Muck Slime','Bog Elemental'], reward:'merchant' },
];
let challengeRoom = null;
const RUN_TARGET = 600;            // 10:00 clear target
let mapStage = 1;
let stageTransitioning = false;
let won = false, altar = null, boss = null;
let finalBossKilledAt = null;
let started = false;   // false until a character is chosen
let composer = null;   // bloom post-processing
let versionCheckTimer = null;
const interactables = [];   // chests / shrines / merchant {type,tier,x,z,used,spr}
let chestsOpened = 0, shopOffers = [], currentShopMerchant = null, shopPurchases = 0;
const groundItems = [];     // dropped item pickups {x,z,item, spr,glow}
const hauntedClones = [];
let goldRainT = 0, goldRainDropT = 0, goldRainSpawnT = 0, goldRainCollected = 0, goldRainElite = false, nextGoldRainAt = 150;
let dontMoveT = 0, dontMoveX = 0, dontMoveZ = 0, dontMoveWarnT = 0;
let debtCollectorCooldownUntil = 0;
const CHEST_BASE=[40,100,220];
const PLAYER_NAME_KEY='sc3_player_name';
const PLAYER_COUNTRY_KEY='sc3_player_country';
const AUTH_PENDING_MODE_KEY='sc3_pending_start_mode';
const PACT_UNLOCK_STORAGE_KEY='sc3_pact_unlocks_v2';
const PACT_LAST_STORAGE_KEY='sc3_last_pacts_v2';
const SOUL_COINS_STORAGE_KEY='sc3_soul_coins_v1';
const PET_STATE_STORAGE_KEY='sc3_pets_v1';
let playerName = localStorage.getItem(PLAYER_NAME_KEY) || 'Player';
let playerCountry = localStorage.getItem(PLAYER_COUNTRY_KEY) || 'TH';
let selectedStartMode = '';
let selectedPactIds = [];
let activePactIds = [];
let pactMultiplier = 1;
const DIFFICULTIES = [
  { id:'casual', name:'Casual', badge:'ฝึก · ไม่นับ Ranking', mult:0.6, hp:0.82, atk:0.82, bossHp:0.88, bossAtk:0.88, spawnCap:0.78, spawnInterval:1.22, spawnBatch:0.82,
    otStart:600, otStep:30, otCapBase:170, otCapStep:24,
    desc:'โหมดฝึกลองตัวละครและบิลด์ มอนพิเศษลดลง ปิด Pact และไม่ขึ้น Ranking', meta:'Score x0.60 · Unranked · OT 10:00 / x2 แล้ว +1 ทุก 30 วิ' },
  { id:'normal', name:'Normal', badge:'เริ่มที่นี่', mult:1.0, hp:1, atk:1, bossHp:1, bossAtk:1, spawnCap:1, spawnInterval:1, spawnBatch:1,
    otStart:600, otStep:30, otCapBase:220, otCapStep:40,
    desc:'โหมดมาตรฐานสำหรับเล่นจริง เคลียร์ Map 3 เพื่อปลดล็อก Pact ระดับ Normal', meta:'Score x1.00 · ใช้ Pact ได้ · OT 10:00 / x2 แล้ว +1 ทุก 30 วิ' },
  { id:'hard', name:'Hard', badge:'เอาคะแนน', mult:1.4, hp:1.25, atk:1.22, bossHp:1.24, bossAtk:1.18, spawnCap:1.18, spawnInterval:0.88, spawnBatch:1.22,
    otStart:600, otStep:30, otCapBase:250, otCapStep:52,
    desc:'มอนโหดขึ้น และ Pact ระดับ Hard ต้องปลดด้วยการเคลียร์ Hard เท่านั้น', meta:'Score x1.40 · Hard enemy pool · OT 10:00 / x2 แล้ว +1 ทุก 30 วิ' }
] ;
let activeDifficultyId = 'normal';
let lastPactUnlocks = [];
let runBossKills = 0, runMinibossKills = 0, lastSoulCoinAward = null;
function chestCost(tier){ const disc=Math.max(0.5, 1-0.08*((player&&player._wrench)||0)); return Math.round(CHEST_BASE[tier]*Math.pow(1.18, chestsOpened)*disc*pactCostMul()); }
let paused = false, pendingUps = 0, currentChoices = [], currentRelicChoices = [], pendingRelicPortal = null;
let userPaused = false;
function buildPauseInfo(){
  const el=document.getElementById('pauseinfo'); if(!el) return;
  const C=CHARACTERS[player.char]||{};
  const critChance=Math.min(1, Math.max(0, player.critChance||0));
  const critDmg=(player.critDmg||1.5)+Math.max(0,(player.critChance||0)-1);
  let h='<div class="piw">';
  for (const w of player.weapons){ const t=WEAPON_TYPES[w.key]; if(!t) continue;
    h+='<div class="piwslot'+(w.evolved?' evo':'')+'"><img src="'+escHtml(spriteSrc(t.icon))+'"><div class="pn">'+escHtml(weaponName(w.key))+'</div><div class="pl">Lv '+w.lvl+'</div></div>'; }
  h+='</div><div class="pist">'+escHtml(charField(player.char,'name',C.name||''))+' \u00b7 Lv '+player.level+' \u00b7 HP '+Math.ceil(player.hp)+'/'+player.maxHp
    +' \u00b7 SPD '+player.spd.toFixed(1)+' \u00b7 DASH '+Math.round(100*(player.dashCdMul||1))+'% CD/'+Math.round(100*(player.dashDistMul||1))+'% DIST'
    +' \u00b7 CRIT '+Math.round(critChance*100)+'%/'+Math.round(critDmg*100)+'%</div>';
  // items list
  if (player.items.length) {
    h+='<div style="margin-top:8px;color:#ffe08a;font-size:12px">'+escHtml(tr('common.items'))+' ('+player.items.length+')</div>';
    h+='<div class="piitems">';
    for(const s of itemStacks()){
      const it=s.item;
      h+='<div class="piitem '+escHtml(it.rarity||'common')+'"><img src="'+escHtml(spriteSrc(it.icon))+'"><div><b>'+escHtml(itemName(it))+'</b><p>'+escHtml(itemDesc(it))+'</p></div><span>x'+s.count+'</span></div>';
    }
    h+='</div>';
  }
  if (player.relics && player.relics.length) {
    h+='<div style="margin-top:8px;color:#ffd86a;font-size:12px">'+escHtml(tr('common.relic'))+'</div>';
    for(const r of player.relics) h+='<div style="color:#d7c18a;font-size:11px">'+r.name+' - '+r.desc+'</div>';
  }
  el.innerHTML=h;
}
function togglePause(){
  if (gameOver || paused) return;            // don't toggle during level-up
  userPaused = !userPaused;
  if (userPaused) { buildPauseInfo(); updateScreenShakeButton(); updateAudioButtons(); }
  document.getElementById('pause').style.display = userPaused ? 'flex' : 'none';
  document.getElementById('pausebtn').textContent = userPaused ? '▶' : '⏸';
  document.body.classList.toggle('user-paused', userPaused);
}
function screenShakeOffSetting(){
  return typeof isScreenShakeOff==='function' ? isScreenShakeOff() : localStorage.getItem('sc3_screen_shake_off_v1') === '1';
}
function updateScreenShakeButton(){
  const btn=document.getElementById('screenshakebtn');
  if(!btn) return;
  const off=screenShakeOffSetting();
  btn.textContent = gameLang()==='en'
    ? 'Screen Shake: '+(off?'OFF':'ON')
    : 'สั่นจอ: '+(off?'ปิด':'เปิด');
  btn.classList.toggle('off', off);
}
function toggleScreenShakeSetting(){
  const off=!screenShakeOffSetting();
  if(typeof setScreenShakeOff==='function') setScreenShakeOff(off);
  else localStorage.setItem('sc3_screen_shake_off_v1', off ? '1' : '0');
  updateScreenShakeButton();
}
function audioMutedSetting(){
  return typeof isAudioMuted==='function' ? isAudioMuted() : localStorage.getItem('sc3_audio_muted_v1') === '1';
}
function updateAudioButtons(){
  const off=audioMutedSetting();
  const label='Sound: '+(off?'OFF':'ON');
  const pauseBtn=document.getElementById('audiobtn');
  if(pauseBtn){
    pauseBtn.textContent=label;
    pauseBtn.classList.toggle('off', off);
  }
  const hudBtn=document.getElementById('mutebtn');
  if(hudBtn){
    hudBtn.textContent=off ? 'MUTE' : 'SND';
    hudBtn.title=label;
    hudBtn.setAttribute('aria-label', label);
    hudBtn.classList.toggle('off', off);
  }
}
function toggleAudioSetting(){
  if(typeof toggleAudioMuted==='function') toggleAudioMuted();
  else localStorage.setItem('sc3_audio_muted_v1', audioMutedSetting() ? '0' : '1');
  updateAudioButtons();
}
document.addEventListener('click', e=>{
  if(e.target && e.target.id==='screenshakebtn') toggleScreenShakeSetting();
  if(e.target && (e.target.id==='audiobtn' || e.target.id==='mutebtn')) toggleAudioSetting();
});
// Dash trigger shared by keyboard (Space) and the mobile Dash button.
function tryDash(){
  if (!started || paused || gameOver || won || player.dashCd>0 || player.dashTime>0) return;
  let dx=player.ldx, dz=player.ldz;
  if (!dx && !dz){ dx=player.face||1; dz=0; }
  const l=Math.hypot(dx,dz)||1; player.dashX=dx/l; player.dashZ=dz/l;
  player.dashTime=DASH_DUR*(player.dashDistMul||1); player.dashCd=DASH_CD*(player.dashCdMul||1);
  sfx('dash');
  player.invuln=Math.max(player.invuln, player.dashTime+0.08+(player.dashInvulnBonus||0));   // i-frames while dashing
}
function quitToTitle(){
  clearTimeout(deathCinematicTimer);
  started=false; userPaused=false; paused=false; gameOver=false; deathCinematic=false; won=false; pendingUps=0;
  pendingRelicPortal=null; currentRelicChoices=[];
  for (const id of ['pause','shop','playersetup','select','difficultyselect','pactselect','over','levelup','relicup','deathfx']) document.getElementById(id).style.display='none';
  document.getElementById('pausebtn').textContent='⏸';
  document.body.classList.remove('user-paused');
  document.getElementById('title').style.display='flex';
  showLeaderboard();
  updateStartFlow();
  if(!selectedStartMode) openAuthChoice(false);
  else closeAuthChoice();
  startTitleBGM();
}
function cleanPlayerName(v){
  return String(v||'').trim().replace(/\s+/g,' ').slice(0,18) || 'Player';
}
function cleanCountryCode(v){
  const code=String(v||'TH').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : 'TH';
}
const KNOWN_FLAG_CODES = new Set(['TH','US','JP','KR','CN','SG','MY','ID','PH','VN','GB','FR','DE','BR','AU']);
function countryFlag(code){
  const cc=cleanCountryCode(code);
  const cls=KNOWN_FLAG_CODES.has(cc) ? 'cflag cflag-'+cc.toLowerCase() : 'cflag cflag-fallback';
  return '<i class="'+cls+'" title="'+cc+'"><b>'+cc+'</b></i>';
}
function resetRunStats(){
  runStats = { startedAt:Date.now(), weaponDamage:{}, itemStats:{}, damageTakenBy:{}, lastHit:null, deathCause:null };
}
function statName(kind,key){
  if(kind==='weapon'){
    return weaponName(key)||key||'Unknown Weapon';
  }
  const special={ hp_orb:'HP Orb', lifesteal:'Lifesteal', orbit:'Orbiting Skull Guard', orbitX:'Death Orbit Guard' };
  if(special[key]) return special[key];
  const it=(typeof ITEMS!=='undefined') ? ITEMS.find(x=>x.id===key) : null;
  return (it&&itemName(it))||key||'Unknown Item';
}
function addStatBucket(group,key,fields){
  if(!runStats || !key) return null;
  const bucket=runStats[group] || (runStats[group]={});
  const isWeapon=group==='weaponDamage';
  const row=bucket[key] || (bucket[key]={ key, name:statName(isWeapon?'weapon':'item',key), damage:0, procs:0, heal:0, blocked:0 });
  for(const k in fields) row[k]=(row[k]||0)+fields[k];
  return row;
}
function recordRunDamage(amount, meta){
  if(!runStats || !amount || amount<=0) return;
  meta=meta||{};
  if(meta.weapon) addStatBucket('weaponDamage',meta.weapon,{ damage:amount });
  else if(meta.item) addStatBucket('itemStats',meta.item,{ damage:amount });
  else addStatBucket('weaponDamage','unknown',{ damage:amount });
}
function recordRunItem(key, fields){
  if(!runStats || !key) return;
  addStatBucket('itemStats',key,fields||{ procs:1 });
}
function sourceLabel(src, kind){
  if(src && src.name) return src.name + (kind ? ' '+kind : '');
  return kind || 'Unknown';
}
function recordPlayerHit(amount, src, kind){
  if(!runStats || !amount || amount<=0) return;
  const label=sourceLabel(src,kind);
  runStats.lastHit={ label, source:src&&src.name||'', kind:kind||'hit', amount, time:gameTime, stage:mapStage };
  runStats.damageTakenBy[label]=(runStats.damageTakenBy[label]||0)+amount;
}
function recordDeathCause(){
  if(runStats && !runStats.deathCause) runStats.deathCause=runStats.lastHit || { label:'Unknown', kind:'unknown', amount:0, time:gameTime, stage:mapStage };
}
function openAuthChoice(unlockAudio=true){
  if(unlockAudio){ initAudio(); resumeAudio(); }   // unlock audio on the first tap; auth.js keeps the Google button state current
  const box=document.getElementById('authchoice'); if(box) box.style.display='flex';
}
function closeAuthChoice(){
  const box=document.getElementById('authchoice'); if(box) box.style.display='none';
}
function whatsNewItems(){
  if(gameLang()==='en') return [
    ['Death penalty','Dying now reduces final score: -20% normally, -15% after Overtime, and -10% on Map 3. Clears are not penalized.'],
    ['Overtime rules','All difficulties now start Overtime at 10:00. Enemy pressure begins at x2, then rises to x3, x4, x5 and keeps climbing every 30 seconds.'],
    ['Score summary','Run Summary now shows final score, base score, and Death Penalty so you can see exactly why points changed. Ranking uses the final score.'],
    ['Difficulty balance','Casual, Normal, and Hard keep their own enemy/score settings, but Overtime timing is shared so runs are easier to compare.'],
    ['Challenge rooms','Mystery gates can lead to Treasure Vault, Cursed Shrine Room, Butcher Arena, Soul Trial, or Merchant Trap.'],
    ['Guide refresh','Combat guide, Ranking rules, Codex, Shrine, Pets, Achievements, and How to Play were refreshed for the current systems.']
  ];
  return [
    ['คะแนนเมื่อตาย','ตายแล้วคะแนนสุดท้ายจะลดลง: ปกติ -20%, หลัง Overtime -15%, และ Map 3 -10% ถ้าเคลียร์สำเร็จจะไม่โดนหัก'],
    ['กติกา Overtime','ทุกระดับความยากเริ่ม Overtime ที่ 10:00 เหมือนกัน เริ่ม x2 แล้วเพิ่มเป็น x3, x4, x5 ต่อไปทุก 30 วินาที'],
    ['สรุปคะแนนชัดขึ้น','หน้า Run Summary แสดงคะแนนสุดท้าย คะแนนก่อนหัก และ Death Penalty เพื่อให้รู้ว่าคะแนนหายไปเท่าไหร่ Ranking ใช้คะแนนหลังหัก'],
    ['ปรับสมดุลระดับความยาก','Casual, Normal และ Hard ยังมีค่าสถานะ/คะแนนต่างกัน แต่เวลา Overtime เท่ากันเพื่อให้เปรียบเทียบรันง่ายขึ้น'],
    ['Challenge Room','ประตูลึกลับพาไป Treasure Vault, Cursed Shrine Room, Butcher Arena, Soul Trial หรือ Merchant Trap'],
    ['คู่มืออัปเดต','อัปเดต Combat Guide, Ranking, Codex, Shrine, Pets, Achievements และ How to Play ให้ตรงกับระบบปัจจุบัน']
  ];
}
function renderWhatsNew(){
  const body=document.getElementById('whatsnewbody');
  if(!body) return;
  const items=whatsNewItems().map((it,i)=>
    '<div class="whatsnewitem"><i>'+String(i+1)+'</i><div><b>'+escHtml(it[0])+'</b><span>'+escHtml(it[1])+'</span></div></div>'
  ).join('');
  body.innerHTML='<div class="whatsnewkicker">'+escHtml(tr('update.kicker'))+'</div>'
    +'<h2>'+escHtml(tr('update.title'))+'</h2>'
    +'<p class="whatsnewlead">'+escHtml(tr('update.lead'))+'</p>'
    +'<div class="whatsnewlist">'+items+'</div>'
    +'<div class="whatsnewmeta">'+escHtml(tr('update.meta',{version:APP_VERSION}))+'</div>'
    +'<div class="whatsnewactions"><button id="whatsnewok" type="button">'+escHtml(tr('update.ok'))+'</button></div>';
  const ok=document.getElementById('whatsnewok');
  if(ok) ok.onclick=closeWhatsNew;
}
function openWhatsNew(manual){
  const box=document.getElementById('whatsnew');
  if(!box) return;
  renderWhatsNew();
  box.style.display='flex';
  if(manual) box.dataset.manual='1'; else delete box.dataset.manual;
}
function closeWhatsNew(){
  const box=document.getElementById('whatsnew');
  if(box) box.style.display='none';
  try{ localStorage.setItem(WHATS_NEW_SEEN_STORAGE_KEY, APP_VERSION); }catch(_){}
}
function maybeShowWhatsNew(){
  try{ if(localStorage.getItem(WHATS_NEW_SEEN_STORAGE_KEY)===APP_VERSION) return; }catch(_){}
  const title=document.getElementById('title');
  const auth=document.getElementById('authchoice');
  const guide=document.getElementById('guide');
  const first=document.getElementById('firsthelp');
  if(!title || title.style.display==='none') return;
  if(auth && auth.style.display==='flex') return;
  if(guide && guide.style.display==='flex') return;
  if(first && first.style.display==='flex') return;
  openWhatsNew(false);
}
function scheduleWhatsNew(){
  setTimeout(maybeShowWhatsNew, 180);
}
function selectStartMode(mode){
  const googleInput=document.getElementById('startmode_google');
  if(mode==='google' && googleInput && googleInput.disabled) return;
  selectedStartMode = mode === 'google' ? 'google' : 'guest';
  updateStartFlow();
}
function settleAuthChoice(mode){
  selectedStartMode = mode === 'google' ? 'google' : 'guest';
  try{ sessionStorage.removeItem(AUTH_PENDING_MODE_KEY); }catch(_){}
  updateStartFlow();
  if(typeof renderAuth === 'function') renderAuth();
  closeAuthChoice();
  scheduleWhatsNew();
}
function updateStartFlow(){
  const guest=document.getElementById('guestchoice');
  const google=document.getElementById('googlechoice');
  const guestInput=document.getElementById('startmode_guest');
  const googleInput=document.getElementById('startmode_google');
  const play=document.getElementById('playbtn');
  const status=document.getElementById('startstatus');
  if(!guest || !google || !status) return;
  guest.classList.toggle('selected', selectedStartMode==='guest');
  google.classList.toggle('selected', selectedStartMode==='google');
  if(guestInput) guestInput.checked = selectedStartMode==='guest';
  if(googleInput) googleInput.checked = selectedStartMode==='google';
  const user = (typeof currentAuthUser==='function') ? currentAuthUser() : null;
  const st = window.gameAuthState || {};
  if(!selectedStartMode){
    if(play){ play.disabled = true; play.textContent = tr('start.needChoice'); }
    status.textContent = tr('start.needChoiceStatus');
  } else if(selectedStartMode==='guest'){
    if(play){ play.disabled = false; play.textContent = tr('start.guestBtn'); }
    status.textContent = tr('start.guestStatus');
  } else if(user){
    if(play){ play.disabled = false; play.textContent = tr('start.verifiedBtn'); }
    status.textContent = 'Google: '+user.name+' · '+(gameLang()==='en'?'score and unlocks sync online':'คะแนนและ unlock จะ sync online');
  } else if(!st.ready){
    if(play){ play.disabled = true; play.textContent = tr('start.loadingBtn'); }
    status.textContent = tr('start.loadingStatus');
  } else if(!st.enabled){
    if(play){ play.disabled = true; play.textContent = tr('start.notReadyBtn'); }
    status.textContent = tr('start.notReadyStatus');
  } else {
    if(play){ play.disabled = false; play.textContent = tr('start.loginGoogleBtn'); }
    status.textContent = tr('start.loginGoogleStatus');
  }
}
function openPlayerSetup(){
  closeGuide();
  closeAuthChoice();
  document.getElementById('title').style.display='none';
  document.getElementById('pactselect').style.display='none';
  const box=document.getElementById('playersetup'), input=document.getElementById('playername');
  input.value=playerName;
  const country=document.getElementById('playercountry');
  if(country) country.value=playerCountry;
  box.style.display='flex';
  setTimeout(()=>{ input.focus(); input.select(); },0);
}
function titleStartAction(){
  if(!selectedStartMode){
    showToast(tr('start.needChoice'), 1.8);
    updateStartFlow();
    openAuthChoice(true);
    return;
  }
  if(selectedStartMode==='guest') beginTitleRun();
  else beginGoogleRun();
}
function chooseGuestStart(){
  settleAuthChoice('guest');
}
function chooseGoogleStart(){
  const google=document.getElementById('googlechoice');
  if(google && (google.disabled || google.classList.contains('disabled'))){
    updateStartFlow();
    showToast(gameLang()==='en'?'Google Login is not ready yet; Guest is available':'Google Login ยังไม่พร้อม ใช้ Guest ได้ก่อน', 2);
    return;
  }
  selectedStartMode='google';
  updateStartFlow();
  if(typeof currentAuthUser==='function' && currentAuthUser()){
    settleAuthChoice('google');
    return;
  }
  const st=window.gameAuthState || {};
  if(!st.ready){
    showToast('Login is still loading', 1.6);
    return;
  }
  if(!st.enabled){
    showToast('Google Login is not configured yet', 2.4);
    return;
  }
  try{ sessionStorage.setItem(AUTH_PENDING_MODE_KEY,'google'); }catch(_){}
  if(typeof gameAuthLogin==='function') gameAuthLogin();
}
function finishPendingAuthChoice(){
  let pending='';
  try{ pending=sessionStorage.getItem(AUTH_PENDING_MODE_KEY)||''; }catch(_){}
  if(pending==='google' && typeof currentAuthUser==='function' && currentAuthUser()){
    settleAuthChoice('google');
    return true;
  }
  return false;
}
function applyRememberedLogin(){
  if(selectedStartMode) return false;
  if(typeof currentAuthUser==='function' && currentAuthUser()){
    selectedStartMode='google';
    try{ sessionStorage.removeItem(AUTH_PENDING_MODE_KEY); }catch(_){}
    updateStartFlow();
    closeAuthChoice();
    scheduleWhatsNew();
    return true;
  }
  return false;
}
function resetStartChoiceAfterLogout(){
  selectedStartMode='';
  try{ sessionStorage.removeItem(AUTH_PENDING_MODE_KEY); }catch(_){}
  updateStartFlow();
  openAuthChoice(false);
}
function beginTitleRun(){
  initAudio();
  resumeAudio();
  stopTitleBGM();
  openPlayerSetup();
}
function beginGoogleRun(){
  initAudio();
  resumeAudio();
  if(typeof currentAuthUser==='function' && currentAuthUser()){
    stopTitleBGM();
    openPlayerSetup();
    return;
  }
  const st=window.gameAuthState || {};
  if(!st.ready){
    showToast('Login is still loading', 1.6);
    return;
  }
  if(!st.enabled){
    showToast('Google Login is not configured yet', 2.4);
    return;
  }
  if(typeof gameAuthLogin==='function') gameAuthLogin();
}
window.updateStartFlow = updateStartFlow;
window.finishPendingAuthChoice = finishPendingAuthChoice;
window.applyRememberedLogin = applyRememberedLogin;
window.resetStartChoiceAfterLogout = resetStartChoiceAfterLogout;
window.getSelectedStartMode = () => selectedStartMode;
window.chooseGoogleStart = chooseGoogleStart;
function confirmPlayerName(){
  const input=document.getElementById('playername');
  playerName=cleanPlayerName(input.value);
  const country=document.getElementById('playercountry');
  playerCountry=cleanCountryCode(country && country.value);
  localStorage.setItem(PLAYER_NAME_KEY, playerName);
  localStorage.setItem(PLAYER_COUNTRY_KEY, playerCountry);
  document.getElementById('playersetup').style.display='none';
  buildSelect();
  document.getElementById('select').style.display='flex';
}
function buildSelect(){
  const wrap=document.getElementById('selcards'); wrap.innerHTML='';
  for (const key in CHARACTERS){
    const c=CHARACTERS[key], wpn=weaponName(c.weapon)||c.weapon;
    const locked=!isCharacterUnlocked(key);
    const lockText=locked ? unlockRequirementShort('character', key) : '';
    const d=document.createElement('div'); d.className='ccard'+(locked?' locked':'');
    d.innerHTML='<img src="'+characterPortrait(key)+'"><div class="cn">'+escHtml(charField(key,'name',c.name))+'</div><div class="cw">\u2694 '+escHtml(wpn)+'</div><div class="cp">'+escHtml(charField(key,'passive',c.passive.desc))+'</div>'+(charField(key,'bio',c.bio)?'<div class="cbio">'+escHtml(charField(key,'bio',c.bio))+'</div>':'')+(locked?'<div class="lock">'+escHtml(tr('locked'))+'</div><div class="unlock">'+escHtml(lockText)+'</div>':'');
    d.onclick=()=>locked ? showToast('Locked: '+lockText,2.8) : selectCharacter(key);
    wrap.appendChild(d);
  }
}
let itemSig=null;
function itemStacks(){
  const out=new Map();
  for(const it of (player&&player.items)||[]){
    const key=it.id||it.name;
    const row=out.get(key) || { item:it, count:0 };
    row.count++;
    out.set(key,row);
  }
  return Array.from(out.values()).sort((a,b)=>{
    const rarityOrder={legendary:4,rare:3,uncommon:2,common:1};
    const ro=(rarityOrder[b.item.rarity]||0)-(rarityOrder[a.item.rarity]||0);
    if(ro) return ro;
    if(b.count!==a.count) return b.count-a.count;
    return String(a.item.name).localeCompare(String(b.item.name));
  });
}
function updateItemHUD(force){
  const wrap=document.getElementById('itemhud'); if(!wrap || !player) return;
  const stacks=itemStacks();
  const buffs=[
    player.pickupSpeedTimer>0 ? 'haste:'+Math.ceil(player.pickupSpeedTimer) : '',
    player.pickupDmgTimer>0 ? 'might:'+Math.ceil(player.pickupDmgTimer) : ''
  ].filter(Boolean).join('|');
  const sig=buffs+'||'+stacks.map(s=>(s.item.id||s.item.name)+':'+s.count).join('|');
  if(!force && sig===itemSig) return;
  itemSig=sig;
  wrap.innerHTML='';
  if(!stacks.length && !buffs){ wrap.style.display='none'; return; }
  wrap.style.display='flex';
  if(player.pickupSpeedTimer>0){
    const d=document.createElement('div');
    d.className='islot buff haste';
    d.title='เร่งฝีเท้า: ความเร็วเคลื่อนที่ +25%';
    d.innerHTML='<span>'+Math.ceil(player.pickupSpeedTimer)+'</span>';
    wrap.appendChild(d);
  }
  if(player.pickupDmgTimer>0){
    const d=document.createElement('div');
    d.className='islot buff might';
    d.title='พลังโจมตี: ดาเมจ +30%';
    d.innerHTML='<span>'+Math.ceil(player.pickupDmgTimer)+'</span>';
    wrap.appendChild(d);
  }
  const limit=document.body.classList.contains('touch') ? 8 : 10;
  stacks.slice(0,limit).forEach(s=>{
    const it=s.item, d=document.createElement('div');
    d.className='islot '+(it.rarity||'common');
    d.title=itemName(it)+(s.count>1?' x'+s.count:'')+' - '+itemDesc(it);
    d.innerHTML='<img src="'+escHtml(spriteSrc(it.icon))+'"><span>'+s.count+'</span>';
    d.onclick=()=>showToast(itemName(it)+(s.count>1?' x'+s.count:'')+' - '+itemDesc(it),2.0);
    wrap.appendChild(d);
  });
  if(stacks.length>limit){
    const d=document.createElement('div');
    d.className='islot more';
    d.title=tr('common.moreItems',{count:stacks.length-limit});
    d.textContent='+'+(stacks.length-limit);
    wrap.appendChild(d);
  }
}
function characterPortrait(key){
  return spriteSrc('char_'+((CHARACTERS[key]&&CHARACTERS[key].portrait)||key)+'_portrait');
}
function escHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function guideCard(img, name, desc, meta, cls){
  return '<div class="guidecard '+(cls||'')+'"><img src="'+escHtml(img)+'" loading="lazy"><div><b>'+escHtml(name)+'</b><p>'+escHtml(desc)+'</p>'+(meta?'<small>'+escHtml(meta)+'</small>':'')+'</div></div>';
}
function guideTextCard(name, desc, meta, cls){
  return '<div class="guidecard text '+(cls||'')+'"><b>'+escHtml(name)+'</b><p>'+escHtml(desc)+'</p>'+(meta?'<small>'+escHtml(meta)+'</small>':'')+'</div>';
}
function guideSectionTitle(name, desc){
  return '<div class="guidesection"><b>'+escHtml(name)+'</b>'+(desc?'<span>'+escHtml(desc)+'</span>':'')+'</div>';
}
function guideJumpCard(kind, name, desc){
  return '<button class="guidecard text jump" data-jump="'+escHtml(kind)+'"><b>'+escHtml(name)+'</b><p>'+escHtml(desc)+'</p><small>'+escHtml(tr('guide.open'))+'</small></button>';
}
function petIconData(pet){
  return 'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" shape-rendering="crispEdges"><rect width="48" height="48" fill="none"/><rect x="12" y="38" width="24" height="4" fill="rgba(0,0,0,.38)"/><rect x="14" y="11" width="5" height="7" fill="'+(pet.color||'#ffe08a')+'"/><rect x="29" y="11" width="5" height="7" fill="'+(pet.color||'#ffe08a')+'"/><rect x="16" y="14" width="16" height="16" fill="'+(pet.color||'#ffe08a')+'"/><rect x="12" y="20" width="24" height="14" fill="'+(pet.color||'#ffe08a')+'"/><rect x="20" y="19" width="3" height="3" fill="#fff4d6"/><rect x="27" y="19" width="3" height="3" fill="#fff4d6"/><rect x="21" y="20" width="2" height="2" fill="#241a38"/><rect x="28" y="20" width="2" height="2" fill="#241a38"/><rect x="21" y="27" width="6" height="2" fill="#120b18"/></svg>');
}
function guidePetCard(pet){
  const state=loadPetState();
  const owned=!!(state.owned||{})[pet.id];
  const selected=owned && state.selected===pet.id;
  const coins=soulCoins();
  const pct=Math.min(100, Math.round((coins/pet.price)*100));
  const price=pet.price.toLocaleString();
  const action=owned ? (selected?tr('pets.selected'):tr('pets.select')) : tr('pets.buy',{price});
  const emojis=petEmojiSet('idle',pet.id).slice(0,3);
  const mood=emojis.map((e,i)=>'<span style="--i:'+i+'">'+escHtml(e)+'</span>').join('');
  const color=pet.color||'#ffe08a';
  return '<div class="guidecard pet '+(owned?'owned ':'locked ')+(selected?'selected':'')+'" style="--pet-color:'+escHtml(color)+'">'
    +'<div class="petstage"><i></i><img src="'+escHtml(pet.sprite?spriteSrc(pet.sprite):petIconData(pet))+'" loading="lazy"><em>'+mood+'</em></div><div class="petcopy"><b>'+escHtml(pet.name)+'</b><p>'+escHtml(petText(pet,'title')+' — '+petText(pet,'desc'))+'</p>'
    +'<small>'+escHtml(pet.buff)+' / '+escHtml(tr('pets.price',{price}))+'</small>'
    +(!owned?'<div class="petprogress"><i style="width:'+pct+'%"></i><span>'+coins.toLocaleString()+' / '+price+'</span></div>':'')
    +'<button data-pet-'+(owned?'select':'buy')+'="'+escHtml(pet.id)+'" '+(selected?'disabled':'')+'>'+escHtml(action)+'</button></div></div>';
}
function guideCharacterCard(img, name, bio, weapon, passive, stats, cls){
  return '<div class="guidecard character '+(cls||'')+'"><img src="'+escHtml(img)+'" loading="lazy"><div class="gctxt">'
    +'<b>'+escHtml(name)+'</b>'
    +(bio?'<p class="gcbio">'+escHtml(bio)+'</p>':'')
    +'<div class="gcrow"><span>'+escHtml(tr('common.weapon'))+'</span><strong>'+escHtml(weapon)+'</strong></div>'
    +'<div class="gcrow passive"><span>'+escHtml(tr('common.passive'))+'</span><strong>'+escHtml(passive)+'</strong></div>'
    +(stats?'<small>'+escHtml(stats)+'</small>':'')
    +'</div></div>';
}
function guideUnitCard(img, name, desc, meta, cls){
  return '<div class="guidecard unit '+(cls||'')+'"><img src="'+escHtml(img)+'" loading="lazy"><div><b>'+escHtml(name)+'</b><p>'+escHtml(desc)+'</p>'+(meta?'<small>'+escHtml(meta)+'</small>':'')+'</div></div>';
}
function guideText(row, fallback){
  return localized(row, fallback);
}
const ITEM_RARITY_ORDER = { common:0, uncommon:1, rare:2, legendary:3 };
const ITEM_RARITY_TEXT = {
  common:'Common',
  uncommon:'Uncommon',
  rare:'Rare',
  legendary:'Legendary'
};
const ITEM_RARITY_NOTE = {
  common:'ของพื้นฐานที่ช่วยตั้งตัวช่วงต้นเกม',
  uncommon:'เริ่มกำหนดทิศทางบิลด์และคอมโบ',
  rare:'ของแรงที่เปลี่ยนจังหวะเล่นชัดเจน',
  legendary:'ของระดับรันเปลี่ยนชีวิต แต่หาไม่ง่าย'
};
function itemGuideTags(it){
  const txt=(it.id+' '+itemName(it)+' '+itemDesc(it)).toLowerCase();
  const tags=[];
  if(/crit|คริติคอล/.test(txt)) tags.push('Crit');
  if(/ดาเมจ|damage|แรง|ระเบิด|สายฟ้า|ติดไฟ|thorns|สะท้อน|โจมตี/.test(txt)) tags.push('Damage');
  if(/เลือด|ฟื้น|ดูดเลือด|overheal|ฮีล/.test(txt)) tags.push('Sustain');
  if(/เกราะ|หลบ|พุ่ง|อมตะ|dash|คูลดาวน์/.test(txt)) tags.push('Defense');
  if(/xp|ทอง|gold|luck|หีบ|ร้าน|ค่าหีบ|ดรอป/.test(txt)) tags.push('Economy');
  if(/ความเร็ว|จำนวน|กระสุน|วัตถุ|ขนาด|stack|ออร่า/.test(txt)) tags.push('Build');
  if(!tags.length) tags.push('Utility');
  return tags.slice(0,3);
}
function guideItemSummary(items){
  const total=items.length;
  const unlocked=items.filter(it=>isItemUnlocked(it.id)).length;
  const counts={ common:0, uncommon:0, rare:0, legendary:0 };
  for(const it of items) counts[it.rarity]=(counts[it.rarity]||0)+1;
  const rows=['common','uncommon','rare','legendary'].map(r=>
    '<div><span>'+escHtml(tr('rarity.'+r))+'</span><b>'+counts[r]+'</b></div>'
  ).join('');
  return '<div class="itemsummary">'
    +'<div class="itemhint"><b>'+escHtml(tr('items.summaryTitle'))+'</b><p>'+escHtml(tr('items.summaryDesc'))+'</p></div>'
    +rows
    +'<div class="itemhint compact"><b>'+escHtml(tr('items.unlockedCount',{unlocked,total}))+'</b><p>'+escHtml(tr('items.lockedHint'))+'</p></div>'
    +'</div>';
}
function guideItemCard(it){
  const unlocked=isItemUnlocked(it.id);
  const rarity=it.rarity||'common';
  const lock=unlocked ? tr('common.unlocked') : tr('common.locked')+': '+unlockRequirementShort('item', it.id);
  const tags=itemGuideTags(it).map(t=>'<span>'+escHtml(itemGuideTagLabel(t))+'</span>').join('');
  return '<div class="guidecard item '+escHtml(rarity)+(unlocked?'':' locked')+'">'
    +'<div class="itemicon"><img src="'+escHtml(spriteSrc(it.icon))+'" loading="lazy"><em>'+escHtml(tr('rarity.'+rarity)||rarity)+'</em></div>'
    +'<div class="itemcopy"><b>'+escHtml(unlocked?itemName(it):itemName(it)+' ('+tr('common.locked')+')')+'</b><p>'+escHtml(itemDesc(it))+'</p><div class="itemtags">'+tags+'</div><small>'+escHtml(lock)+' / '+escHtml(tr('common.stackUnlimited'))+'</small></div>'
    +'</div>';
}
function unitSpritePath(sprite){
  if(MANIFEST[sprite+'_8dir']) return spriteSrc(sprite+'_8dir');
  if(MANIFEST[sprite+'_walk']) return spriteSrc(sprite+'_walk');
  return spriteSrc(sprite);
}
function itemGuideTagLabel(tag){
  if(gameLang()!=='th') return tag;
  return ({Damage:'ดาเมจ',Crit:'คริติคอล',Sustain:'ฟื้นฟู',Defense:'ป้องกัน',Economy:'เศรษฐกิจ',Build:'บิลด์',Utility:'อรรถประโยชน์'})[tag] || tag;
}
const MONSTER_GUIDE_TEXT = {
  'Grave Arbalist':{th:'ยิงตรงเร็ว ระยะไกล ต้องหลบเส้นกระสุน',en:'fast straight shots from long range'},
  'Mire Hexer':{th:'ยิงกระจาย 3 นัด เหมาะกับการบีบพื้นที่',en:'fires a 3-shot spread to pressure space'},
  'Rift Needler':{th:'ยิง fan แคบ 5 นัด กระสุนถี่และเร็ว',en:'fires a narrow 5-shot fan'},
  'Doom Cantor':{th:'ยิงวงกระสุนหรือกระสุนช้าแรง',en:'uses bullet rings or slow heavy shots'},
  'Covenant Warder':{th:'คุ้มกันเพื่อนใกล้ตัว 4-5 ตัวให้เป็นอมตะ ต้องฆ่ามันก่อน',en:'protects 4-5 nearby allies with immunity until killed'},
  'Toxic Spore':{th:'ยิงพิษระยะไกลและกดพื้นที่',en:'ranged poison pressure'},
  'Swamp Witch':{th:'ยิงเวทระยะไกลแล้วถอยคุมระยะ',en:'keeps distance and fires ranged magic'},
  'Dark Apostle':{th:'นักเวทระยะไกลของ Map 3 ยิงแรงแต่เดินช้า',en:'slow, hard-hitting ranged caster'},
  'Abyssal Horror':{th:'ยิงระยะไกลพร้อมตัวถึกกว่า caster ทั่วไป',en:'durable ranged horror'},
};
function unitBehaviorText(unit){
  if(MONSTER_GUIDE_TEXT[unit.name]) return guideText(MONSTER_GUIDE_TEXT[unit.name], unit.name);
  if(typeof behaviorFor!=='function') return 'ไล่ล่า';
  const b=behaviorFor(unit.name);
  const text={
    chase:{th:'ไล่ล่าเข้าประชิด',en:'direct chaser'},
    shooter:{th:'ยิงระยะไกลและคุมระยะ',en:'ranged attacker'},
    charger:{th:'พุ่งชนเป็นจังหวะ',en:'charge attacker'},
    exploder:{th:'ระเบิดเมื่อเข้าใกล้หรือตาย',en:'explodes on contact or death'},
    warder:{th:'ออร่าคุ้มกันเพื่อนรอบตัว',en:'protective aura support'},
    splitter:{th:'ตายแล้วแตกเป็นตัวเล็ก',en:'splits into smaller enemies on death'},
    hazard:{th:'วางพื้นที่อันตรายบังคับให้ขยับ',en:'creates hazardous ground zones'},
    puller:{th:'ดึงผู้เล่นเข้าหาเป็นจังหวะ',en:'periodically pulls the player in'},
    thief:{th:'ขโมยทองแล้ววิ่งหนี ฆ่าทันได้คืน',en:'steals gold and flees until killed'}
  }[b];
  return guideText(text, b);
}
const SKILL_GUIDE_TEXT = {
  ring:{th:'วงกระสุนรอบตัว',en:'radial bullet ring'},
  bigRing:{th:'วงกระสุนใหญ่',en:'large radial bullet ring'},
  fan:{th:'ยิงกระสุนเป็นพัด',en:'fan volley'},
  spiral:{th:'กระสุนหมุนวน',en:'spiral volley'},
  scatter:{th:'กระสุนสุ่มรอบตัว',en:'scattered shots'},
  charge:{th:'พุ่งชน',en:'charge attack'},
  summon:{th:'เรียกลูกสมุน',en:'summons minions'},
  summon3:{th:'เรียกลูกสมุนหลายตัว',en:'summons multiple minions'},
  shock:{th:'AOE ช็อกพื้นรอบตัว',en:'point-blank shock AoE'},
  lob:{th:'ยิงกระสุนหนัก',en:'heavy lob shot'},
  heal:{th:'ฟื้นเลือดตัวเอง',en:'self heal'},
  shield:{th:'กางโล่ชั่วคราว',en:'temporary shield'},
  ancientQuake:{th:'แผ่นดินไหวเป็นแนวหน้า',en:'forward quake line'},
  stoneWall:{th:'ทุบพื้นสร้างกำแพงหินเตือนล่วงหน้า',en:'telegraphed stone wall slam'},
  rustedGallows:{th:'พุ่งพร้อมยิงลูกศร',en:'dash with arrow shots'},
  executionMark:{th:'ตราพิพากษาเป็นแนวฟัน',en:'marked execution line'},
  graveSpikes:{th:'หนามสุสานปักรอบผู้เล่น',en:'grave spikes around the player'},
  burrowEmerge:{th:'มุดดินแล้วโผล่โจมตีตำแหน่งเตือน',en:'burrows and emerges on a warning mark'},
  cryptCall:{th:'เรียกลูกสมุนและยิงพัด',en:'summons adds and fires fans'},
  mossRegrowth:{th:'ฟื้นเลือดพร้อมยิงก้อนพิษ',en:'regenerates and fires a toxic shot'},
  ruinedBulwark:{th:'โล่ป้องกันพร้อม AOE',en:'shield plus AoE burst'},
  wardensDecree:{th:'คำสั่งผู้คุมสร้างเขตอันตรายหลายวง',en:'multi-zone warden decree'},
  lichCross:{th:'AOE กากบาทน้ำแข็ง',en:'cross-shaped arcane AoE'},
  lichPrison:{th:'คุกเวทและวง AOE ใต้เท้า',en:'arcane prison and ground AoE'},
  behemothSlam:{th:'ทุบพื้น AOE ใหญ่',en:'large ground slam'},
  behemothQuake:{th:'คลื่นแผ่นดินไหวหลายชั้น',en:'layered quake waves'},
  behemothRoar:{th:'คำรามเปิดรอยแตก 5 แนว',en:'five-lane fissure roar'},
  reaperScythes:{th:'เคียวกระสุนสองข้าง',en:'side scythe volleys'},
  reaperBlink:{th:'วาร์ปไล่ตามพร้อม AOE',en:'blink chase with AoE'},
  wyrmBreath:{th:'ลมหายใจมังกรเป็นพัด',en:'wide breath fan'},
  wyrmMeteor:{th:'ฝนดาวตกและ AOE ตามแนว',en:'meteor line with AoE marks'},
  overlordStar:{th:'ดาวกระสุนพร้อมกากบาท',en:'star ring and cross pattern'},
  overlordJudgment:{th:'พิพากษา AOE หลายจุดและเรียกลูกสมุน',en:'multi-AoE judgment and summons'}
};
function skillListFor(sprite, table){
  if(!table || !table[sprite]) return 'สกิล: พื้นฐาน';
  return 'สกิล: '+table[sprite].map(s=>guideText(SKILL_GUIDE_TEXT[s], s.replace(/([A-Z])/g,' $1'))).join(', ');
}
function monsterStatMeta(e){
  const hpMul=[1.1,1.1*1.22*2.7*1.10,1.1*1.48*4.8*1.10][e.tier||0];
  const atkMul=[1,1.12*1.75,1.27*2.4][e.tier||0];
  return 'ฐาน HP '+e.hp+' / ATK '+e.atk+' / SPD '+e.spd+' / XP '+e.xp+' · ตอนเล่นจริงเริ่มราว HP x'+hpMul.toFixed(1)+' / ATK x'+atkMul.toFixed(1)+' และเพิ่มตามเวลา/OT';
}
function bossStatMeta(e, kind){
  const extra=e.final?' / 3 หลอด':'';
  const scale=kind==='mini' ? 'มินิบอสจริงถูกคูณตามเวลา ด่าน และ Overtime' : 'บอสจริงถูกคูณตามเวลา ด่าน และ Overtime';
  return 'ฐาน HP '+e.hp+' / ATK '+e.atk+(e.spd?' / SPD '+e.spd:'')+extra+' · '+scale;
}
function evolveGuideForTome(id){
  const pairs=Object.keys(WEAPON_TYPES).filter(key=>!WEAPON_TYPES[key].hidden && WEAPON_TYPES[key].evolveTome===id).map(weaponName);
  return pairs.length ? ' / '+tr('common.evolve')+': '+pairs.join(', ') : '';
}
function evolvedFromName(evolvedKey){
  const base=Object.values(WEAPON_TYPES).find(w=>w && !w.hidden && w.evolveTo===evolvedKey);
  return base ? weaponName(Object.keys(WEAPON_TYPES).find(k=>WEAPON_TYPES[k]===base)) : '';
}
function howToSteps(){
  if(gameLang()==='en') return [
    ['Move and survive','Use WASD or the mobile joystick. Your weapons attack automatically, so focus on positioning and dodging.','Dash with Space or the on-screen DASH button.'],
    ['Collect XP and level up','Blue XP and gold are collected automatically when close enough. Leveling up lets you choose weapons, Tomes, or items.','Ban unwanted choices if your build needs cleaner options.'],
    ['Build around evolutions','Raise a weapon to Lv8 and collect its matching Tome to evolve it. Gold glow means an evolution is ready.','Example: Holy Smite + Growth, Arrow + Velocity.'],
    ['Use the map objects','Chests, Merchants, Shrines, Magnet Pillars, Altars, Portals, and Challenge Gates can swing a run.','Walk into portals/gates; interact with F when prompted.'],
    ['Kill bosses to advance','Bosses drop Relics. Choose one, then enter the portal to move to the next map. Map 3 is the final boss stage.','Clear Map 3 on Normal or Hard to unlock Pact modifiers for that difficulty tier.'],
    ['Score comes from risk','Kills, clear time, items, bosses, no-damage play, and Pact modifiers all affect Ranking.','Guest saves locally; Google syncs ranking and unlocks online.']
  ];
  return [
    ['เดินให้รอดก่อน','ใช้ WASD หรือจอยมือถือเคลื่อนที่ อาวุธจะโจมตีอัตโนมัติ หน้าที่หลักคือยืนตำแหน่งดี ๆ และหลบให้ทัน','พุ่งหลบด้วย Space หรือปุ่ม DASH บนจอ'],
    ['เก็บ XP แล้วอัปเลเวล','XP สีฟ้าและทองจะเก็บอัตโนมัติเมื่อเข้าใกล้ เลเวลอัปแล้วเลือกอาวุธ Tome หรือไอเทมเพื่อทำบิลด์','ใช้ Ban ตัดตัวเลือกที่ยังไม่อยากได้'],
    ['เล่นตามคู่ Evolution','อัปอาวุธให้ถึง Lv8 และมี Tome คู่กันเพื่อวิวัฒน์ อันที่พร้อมวิวัฒน์จะมีแสงทองเตือน','เช่น Holy Smite + Growth, Arrow + Velocity'],
    ['ใช้ของในแผนที่','หีบ พ่อค้า Shrine เสาแม่เหล็ก แท่น Portal และ Challenge Gate ช่วยพลิกเกมได้','เดินชนประตู/วาร์ป หรือกด F เมื่อมี prompt'],
    ['ฆ่าบอสเพื่อไปด่านต่อ','บอสดรอป Relic เลือก 1 ชิ้นแล้วเข้าวาร์ปไปแผนที่ถัดไป Map 3 คือด่านบอสสุดท้าย','เคลียร์ Map 3 ระดับ Normal หรือ Hard เพื่อปลดล็อก Pact ของระดับนั้น'],
    ['คะแนนมาจากความเสี่ยง','จำนวนฆ่า เวลาเคลียร์ ไอเทม บอส การไม่โดนตี และ Pact modifier มีผลกับ Ranking','Guest บันทึกในเครื่อง ส่วน Google sync คะแนนและ unlock online']
  ];
}
function renderHowToMarkup(){
  return '<div class="howtosteps">'+howToSteps().map((s,i)=>
    '<div class="howtostep"><b>'+escHtml((i+1)+'. '+s[0])+'</b><p>'+escHtml(s[1])+'</p><small>'+escHtml(s[2])+'</small></div>'
  ).join('')+'</div>';
}
function renderFirstHelp(){
  const title=document.getElementById('firsthelptitle');
  const body=document.getElementById('firsthelpbody');
  const guideBtn=document.getElementById('firsthelpguide');
  const startBtn=document.getElementById('firsthelpstart');
  if(title) title.textContent=gameLang()==='en'?'Quick Start Guide':'วิธีเล่นแบบสรุปสำหรับมือใหม่';
  if(body) body.innerHTML=renderHowToMarkup();
  if(guideBtn) guideBtn.textContent=gameLang()==='en'?'Open Full Guide':'เปิดคู่มือเต็ม';
  if(startBtn) startBtn.textContent=gameLang()==='en'?'Got it, Start Run':'เข้าใจแล้ว เริ่มรัน';
}
function showFirstRunHowTo(done){
  const panel=document.getElementById('firsthelp');
  if(!panel || localStorage.getItem(HOWTO_SEEN_STORAGE_KEY)==='1'){ done&&done(); return; }
  const hud=document.getElementById('hud');
  if(hud && panel.parentElement!==hud) hud.appendChild(panel);
  renderFirstHelp();
  panel.style.display='flex';
  const finish=()=>{
    localStorage.setItem(HOWTO_SEEN_STORAGE_KEY,'1');
    panel.style.display='none';
    done&&done();
  };
  const startBtn=document.getElementById('firsthelpstart');
  const guideBtn=document.getElementById('firsthelpguide');
  if(startBtn) startBtn.onclick=finish;
  if(guideBtn) guideBtn.onclick=()=>openGuide('howto');
}

function guideHeader(title, note, kind){
  const isHub = kind === 'hub';
  const crumb = isHub ? '' : '<button class="guidecrumb" data-guide-home type="button">'+escHtml(tr('guide.hub.title'))+'</button><span class="guidechev">/</span>';
  return '<div class="guidehead">'+
    '<div class="guidepath">'+crumb+'<h2>'+escHtml(title)+'</h2></div>'+
    '<span>'+escHtml(note||'')+'</span>'+
  '</div>';
}
function bindGuideChrome(body){
  if(!body) return;
  body.querySelectorAll('[data-guide-home]').forEach(btn=>btn.onclick=()=>openGuide('hub'));
}
function renderLocalizedGuide(kind, guide, body){
  currentGuideKind=kind;
  if(kind==='howto'){
    body.innerHTML=guideHeader(tr('guide.howto'), tr('guide.howto.desc'), kind)+renderHowToMarkup();
    bindGuideChrome(body);
    guide.style.display='flex';
    return true;
  }
  if(kind==='hub'){
    const entries=['howto','characters','weapons','tomes','items','relics','monsters','bosses','events','maps','combat','shrine','shop','pets','achievements','ranking'];
    const cards=entries.map(k=>guideJumpCard(k,tr('guide.'+k),tr('guide.'+k+'.desc'))).join('');
    body.innerHTML=guideHeader(tr('guide.hub.title'), tr('guide.hub.note'), kind)+'<div class="guidegrid hub">'+cards+'</div>';
    bindGuideChrome(body);
    body.querySelectorAll('[data-jump]').forEach(btn=>btn.onclick=()=>openGuide(btn.dataset.jump));
    guide.style.display='flex';
    return true;
  }
  if(kind==='pets'){
    const state=loadPetState();
    const ownedCount=Object.keys(state.owned||{}).length;
    const selected=petById(selectedPetId());
    const note=tr('pets.note',{coins:soulCoins().toLocaleString(),owned:ownedCount,total:PETS.length,selected:selected?selected.name:tr('pets.none')});
    const cards=guideTextCard(tr('pets.coinInfoTitle'),tr('pets.coinInfoDesc'),tr('pets.coinInfoMeta'),'legendary')+
      '<div class="petnone"><button data-pet-select="">'+escHtml(tr('pets.noPet'))+'</button></div>'+PETS.map(guidePetCard).join('');
    body.innerHTML=guideHeader(tr('pets.title'), note, kind)+'<div class="guidegrid pets">'+cards+'</div>';
    bindGuideChrome(body);
    body.querySelectorAll('[data-pet-buy]').forEach(btn=>btn.onclick=()=>buyPet(btn.getAttribute('data-pet-buy')));
    body.querySelectorAll('[data-pet-select]').forEach(btn=>btn.onclick=()=>selectPet(btn.getAttribute('data-pet-select')||''));
    guide.style.display='flex';
    return true;
  }
  if(kind==='achievements'){
    const state=loadAchievementState();
    const done=ACHIEVEMENTS.filter(a=>state.done&&state.done[a.id]).length;
    const note=tr('ach.note',{done,total:ACHIEVEMENTS.length,coins:soulCoins().toLocaleString()});
    const cards=ACHIEVEMENTS.map(a=>{
      const ok=!!(state.done&&state.done[a.id]);
      return '<div class="guidecard text achievement '+(ok?'done':'locked')+'"><b>'+escHtml(achievementName(a))+'</b><p>'+escHtml(achievementDesc(a))+'</p><small>'+escHtml((ok?tr('ach.done'):tr('ach.locked'))+' · '+tr('ach.rewards')+': '+achievementRewardText(a))+'</small></div>';
    }).join('');
    body.innerHTML=guideHeader(tr('ach.title'), note, kind)+'<div class="guidegrid achievements">'+cards+'</div>';
    bindGuideChrome(body);
    guide.style.display='flex';
    return true;
  }
  return false;
}

function openGuide(kind){
  const guide=document.getElementById('guide'), body=document.getElementById('guidebody');
  if(!guide||!body) return;
  kind=kind||'hub';
  if(renderLocalizedGuide(kind, guide, body)) return;
  currentGuideKind=kind;
  if(kind==='hub'){
    const title='สารบัญคู่มือ', note='รวมข้อมูลสำคัญของตัวละคร อาวุธ ศัตรู และระบบการเล่น';
    const cards=[
      guideJumpCard('characters','ตัวละคร','อาวุธเริ่มต้น สกิลติดตัว และค่าสถานะพื้นฐาน'),
      guideJumpCard('weapons','อาวุธ','อาวุธพื้นฐานและร่างวิวัฒน์'),
      guideJumpCard('tomes','Tome','อัปเกรดติดตัวและคู่สำหรับวิวัฒน์อาวุธ'),
      guideJumpCard('items','ไอเทม','ของดรอปที่ซ้อนทับได้และระดับความหายาก'),
      guideJumpCard('relics','Relic','รางวัลหลังฆ่าบอสที่เปลี่ยนแนวเล่นของรัน'),
      guideJumpCard('monsters','สารานุกรมมอนสเตอร์','ระดับและพฤติกรรมของศัตรูทั่วไป'),
      guideJumpCard('bosses','สารานุกรมบอส','สกิลสำคัญของมินิบอสและบอส'),
      guideJumpCard('events','อีเวนต์','เหตุการณ์พิเศษและความปั่นระหว่างรัน'),
      guideJumpCard('maps','แผนที่','ความต่างของแต่ละด่าน'),
      guideJumpCard('combat','ระบบต่อสู้','Crit, knockback, pierce, guard และ overtime'),
      guideJumpCard('shrine','Shrine','เสาแม่เหล็ก, Shrine, Chest, Merchant, Altar และ Portal'),
      guideJumpCard('shop','ร้านค้า / NPC','การซื้อของ reroll และโอกาสพ่อค้าทรยศ'),
      guideJumpCard('pets','Pets','ซื้อสัตว์เลี้ยงด้วย Soul Coins และเลือกติดตาม 1 ตัวต่อรัน'),
      guideJumpCard('achievements','Achievements','ปลดล็อกตัวละคร อาวุธ และไอเทม พร้อม sync เมื่อใช้ Google'),
      guideJumpCard('ranking','Ranking','กติกาคะแนนและ leaderboard online')
    ].join('');
    body.innerHTML=guideHeader(title, note, kind)+'<div class="guidegrid hub">'+cards+'</div>';
    bindGuideChrome(body);
    body.querySelectorAll('[data-jump]').forEach(btn=>btn.onclick=()=>openGuide(btn.dataset.jump));
    guide.style.display='flex';
    return;
  }
  let title='คู่มือ', note='', cards='';
  if(kind==='characters'){
    title='ตัวละคร';
    note='อาวุธเริ่มต้นและ passive ที่โตตามเลเวล';
    cards=Object.keys(CHARACTERS).map(key=>{
      const c=CHARACTERS[key], w=WEAPON_TYPES[c.weapon]||{};
      const stats=c.stats||{};
      const statLine=[
        stats.maxHp?'HP '+stats.maxHp:null,
        stats.spd?'SPD '+stats.spd:null,
        stats.def?'DEF '+stats.def:null,
        stats.regen?'Regen '+stats.regen:null
      ].filter(Boolean).join(' / ');
      const locked=!isCharacterUnlocked(key);
      const meta=statLine+(locked?(statLine?' / ':'')+tr('common.locked')+': '+unlockRequirementShort('character', key):'');
      return guideCharacterCard(characterPortrait(key), locked?charField(key,'name',c.name)+' ('+tr('common.locked')+')':charField(key,'name',c.name), charField(key,'bio',c.bio||''), weaponName(c.weapon)||c.weapon, charField(key,'passive',c.passive.desc), meta, locked?'locked':'');
    }).join('');
  } else if(kind==='weapons'){
    title='อาวุธ';
    note='อาวุธที่เลือกได้ตอนอัปเลเวล และร่าง evolved';
    title='อาวุธ';
    note='อาวุธพื้นฐานคือสิ่งที่เลือกได้ตอนอัปเลเวล ส่วนร่างวิวัฒน์จะเกิดหลังอาวุธ Lv8 และมี Tome ที่ตรงกัน';
    const baseCards=Object.keys(WEAPON_TYPES).filter(key=>!WEAPON_TYPES[key].hidden).map(key=>{
      const w=WEAPON_TYPES[key];
      const pair=w.evolveTome ? ' / '+tr('common.pairWith',{name:tomeName(w.evolveTome)}) : '';
      const locked=!isWeaponUnlocked(key);
      const meta=tr('common.basic')+' / '+tr('common.damage')+' '+(w.dmg||'-')+(w.rate?' / '+tr('common.rate')+' '+w.rate:'')+(w.count?' / '+tr('common.count')+' '+w.count:'')+pair+(locked?' / '+tr('common.locked')+': '+unlockRequirementShort('weapon', key):'');
      return guideCard(spriteSrc(w.icon), locked?weaponName(key)+' ('+tr('common.locked')+')':weaponName(key), weaponDesc(key), meta, locked?'locked':'');
    }).join('');
    const evolvedCards=Object.keys(WEAPON_TYPES).filter(key=>WEAPON_TYPES[key].hidden).map(key=>{
      const w=WEAPON_TYPES[key];
      const from=evolvedFromName(key);
      const meta=tr('common.evolved')+(from?' '+tr('common.from',{name:from}):'')+' / '+tr('common.damage')+' '+(w.dmg||'-')+(w.rate?' / '+tr('common.rate')+' '+w.rate:'')+(w.count?' / '+tr('common.count')+' '+w.count:'');
      return guideCard(spriteSrc(w.icon), weaponName(key), weaponDesc(key), meta, 'rare');
    }).join('');
    cards=guideSectionTitle('อาวุธพื้นฐาน','เลือกได้ตอนอัปเลเวล รายละเอียด Tome คู่จะแสดงอยู่ในการ์ด')+
      baseCards+
      guideSectionTitle('ร่างวิวัฒน์','เป็นผลลัพธ์จากการวิวัฒน์ ไม่ใช่ตัวเลือกอัปเลเวลปกติ')+
      evolvedCards;
  } else if(kind==='tomes'){
    title='Tome';
    note='อัปเกรดติดตัว เลือกได้สูงสุด 4 ชนิดต่อรัน แต่เก็บซ้ำเพื่อเพิ่มพลังได้';
    note='อัปเกรดติดตัว เลือกได้สูงสุด 4 ชนิดต่อรัน และเก็บซ้ำเพื่อเพิ่มพลังได้';
    cards=UPGRADES.map(u=>
      guideCard(spriteSrc(u.icon), tomeName(u), tomeDesc(u), tr('common.tomeUpgrade')+evolveGuideForTome(u.id), 'uncommon')
    ).join('');
  } else if(kind==='items') {
    title='ไอเทม';
    note='ดู rarity, สายของไอเทม และสถานะปลดล็อก เพื่อเลือกของให้เข้ากับบิลด์ในรัน';
    const sortedItems=ITEMS.slice().sort((a,b)=>(ITEM_RARITY_ORDER[a.rarity]||0)-(ITEM_RARITY_ORDER[b.rarity]||0)||a.name.localeCompare(b.name));
    cards=guideItemSummary(sortedItems)+['common','uncommon','rare','legendary'].map(r=>{
      const group=sortedItems.filter(it=>(it.rarity||'common')===r);
      if(!group.length) return '';
      return guideSectionTitle(tr('rarity.'+r)||r, tr('items.'+r+'Note'))+group.map(guideItemCard).join('');
    }).join('');
  } else if(kind==='evolution'){
    title='คู่มือวิวัฒน์อาวุธ';
    note='อัปอาวุธพื้นฐานให้ถึง Lv8 แล้วมี Tome คู่ให้พอ ตัวเลือกที่พร้อมวิวัฒน์จะเรืองแสงสีทอง';
    cards=Object.keys(WEAPON_TYPES).filter(key=>{
      const w=WEAPON_TYPES[key];
      return w && !w.hidden && w.evolveTo;
    }).map(key=>{
      const w=WEAPON_TYPES[key], ev=WEAPON_TYPES[w.evolveTo]||{};
      const desc=weaponName(key)+' '+tr('common.evolve')+' -> '+weaponName(w.evolveTo);
      const meta=tr('common.requires',{weapon:weaponName(key),tome:tomeName(w.evolveTome)});
      return guideCard(spriteSrc(ev.icon||w.icon), weaponName(w.evolveTo)||weaponName(key), desc, meta, 'rare');
    }).join('');
  } else if(kind==='relics'){
    title='Relic';
    note='รางวัลหลังฆ่าบอส มีผลแรงและเปลี่ยนแนวเล่นของรัน เลือกให้เข้ากับบิลด์และแผนที่ถัดไป';
    cards=RELICS.map(r=>guideCard(spriteSrc(r.icon), r.name, r.desc, 'รางวัล Relic จากบอส', 'legendary')).join('');
  } else if(kind==='achievements'){
    title='Achievements';
    const done=ACHIEVEMENTS.filter(a=>hasAchievement(a.id)).length;
    const syncText=typeof progressSyncStatus==='function' ? progressSyncStatus() : 'Guest: บันทึกในเครื่องนี้';
    note=syncText+' ('+done+'/'+ACHIEVEMENTS.length+') · Soul Coins '+soulCoins().toLocaleString();
    cards=ACHIEVEMENTS.map(a=>{
      const ok=hasAchievement(a.id);
      const meta=(ok?'สำเร็จแล้ว':'ยังไม่สำเร็จ')+' / รางวัล: '+achievementRewardText(a);
      return guideTextCard((ok?'[DONE] ':'[LOCKED] ')+a.name, a.desc, meta, 'achievement '+(ok?'done':'locked'));
    }).join('');
  } else if(kind==='pets'){
    title='Pets';
    const state=loadPetState();
    const ownedCount=Object.keys(state.owned||{}).length;
    const selected=petById(selectedPetId());
    note='Soul Coins '+soulCoins().toLocaleString()+' · ซื้อแล้ว '+ownedCount+'/'+PETS.length+' · '+(selected?'ใช้งาน: '+selected.name:'ยังไม่ได้เลือก Pet');
    cards=guideSectionTitle('ร้านสัตว์เลี้ยง','ไม่มีตัวฟรี ซื้อขาดถาวร และเลือกใช้ได้ 1 ตัวต่อรัน')+
      guideTextCard('Soul Coins','ได้จากการจบรันแบบจำนวนน้อย และจาก Achievement บางอันครั้งเดียว','Pet ราคาแพงเพื่อเป็นเป้าหมายระยะยาว','legendary')+
      '<div class="petnone"><button data-pet-select="">เล่นโดยไม่มี Pet</button></div>'+
      PETS.map(guidePetCard).join('');
  } else if(kind==='events'){
    title='อีเวนต์';
    note='เหตุการณ์พิเศษเพิ่มความปั่น รางวัล หรือปัญหาระยะสั้นให้ต้องแก้ระหว่างรัน';
    cards=[
      guideTextCard('Mystery Challenge Gate','หลังฆ่าบอส Map 1 หรือ Map 2 และเลือก Relic จะมีประตูท้าทายแยกจาก Portal ปกติ เดินชนเพื่อสุ่มเข้าห้องพิเศษ','ถ้าไม่อยากเสี่ยงให้เดินเข้า Portal ปกติไปด่านถัดไปได้เลย','legendary'),
      guideTextCard('Treasure Vault','ห้องสมบัติ 65 วิ เจอมอนขโมย/สไลม์/ลูกแก้วระเบิด จบแล้วได้ทองและกล่องเพิ่ม','เหมาะกับรันที่ต้องการเร่งเศรษฐกิจและไอเทม','uncommon'),
      guideTextCard('Cursed Shrine Room','ห้องศาลคำสาป 75 วิ เจอนักเวท บัฟเพื่อน และพื้นที่พิษ จบแล้วได้ Relic สุ่มทันที 1 ชิ้น','รางวัลแรง แต่ฝูงคุมพื้นที่จะกดดันมาก','legendary'),
      guideTextCard('Butcher Arena','ห้องล่า 60 วิ มี The Butcher โผล่ชัดเจน ถ้าฆ่าทันจะได้รางวัล Butcher เพิ่ม','เสี่ยงสูง เหมาะกับบิลด์ดาเมจพร้อมแล้ว','rare'),
      guideTextCard('Soul Trial','ห้องทดสอบ 45 วิ ถ้าไม่โดนตีเลยได้ Soul Coins มากกว่า ถ้าโดนตียังได้รางวัลปลอบใจ','รางวัล 30 Soul Coins แบบ perfect หรือ 10 ถ้าโดนตี','rare'),
      guideTextCard('Merchant Trap','ห้องร้านลับ 70 วิ จบแล้วเปิด Secret Shop ลดราคา 30% การันตีของ rare/legendary ช่องแรก และอาจมี False Merchant','ถ้าฆ่า False Merchant ได้ จะดรอป item rare/legendary เพิ่ม','legendary'),
      guideTextCard('หีบปลอม','หีบที่ดูน่าหยิบอาจกลายเป็นศัตรูได้ ของฟรีในเกมนี้ควรระแวงไว้ก่อน','อีเวนต์เสี่ยงแลกรางวัล','rare'),
      guideTextCard('ฝนทอง','เหรียญจะตกทั่วแผนที่ช่วงสั้น ๆ เอฟเฟกต์แม่เหล็กช่วยได้มาก','อีเวนต์เก็บทอง','uncommon'),
      guideTextCard('นักทวงหนี้','ศัตรูพิเศษจะกดดันเศรษฐกิจของคุณ ฆ่าให้เร็วหรือจ่ายราคาแพง','อีเวนต์กดดันร้านค้า','rare'),
      guideTextCard('คำสาปห้ามยืน','การยืนนิ่งจะอันตราย รีบขยับจนกว่าคำสาปจะหมด','อีเวนต์ท้าทายการเคลื่อนที่','uncommon'),
      guideTextCard('ร่างเงาหลอน','ร่างเลียนแบบจะไล่กดดันเส้นทางและลงโทษการหนีแบบตื่นตระหนก','อีเวนต์ดวลตัวเอง','rare'),
      guideTextCard('พ่อค้าทรยศ','ซื้อของถี่เกินไปอาจทำให้พ่อค้ากลายเป็นบอส','โอกาส 15% เมื่อซื้อบ่อย','legendary')
    ].join('');
  } else if(kind==='maps'){
    title='คู่มือแผนที่';
    note='แต่ละแผนที่จะเปลี่ยนชนิดศัตรู จังหวะเกม และแรงกดดันจากบอส';
    cards=[
      guideTextCard('Map 1: '+((MAP_THEMES[1]&&MAP_THEMES[1].name)||'Bleakfield'),'ด่านเริ่มต้น มีเวฟช่วงต้น มินิบอสตัวแรกตอน 3:00 และเสาแม่เหล็ก 1 ต้น','ใช้ตั้งทิศทางบิลด์ช่วงต้น'),
      guideTextCard('Map 2: '+((MAP_THEMES[2]&&MAP_THEMES[2].name)||'Crimson Wastes'),'ด่านแดนร้างสีเลือด ศัตรูแรงขึ้นมาก object เยอะขึ้น และมีเสาแม่เหล็ก 1-2 ต้น','ฆ่าบอสเพื่อเปิดทางไปด่านถัดไป'),
      guideTextCard('Map 3: '+((MAP_THEMES[3]&&MAP_THEMES[3].name)||'Void Citadel'),'ด่านบอสสุดท้าย เข้าไปแล้วเจอบอสทันทีพร้อมเวฟช่วยตีหนัก ต้องฆ่าบอสให้ทันภายใน 10 นาทีของด่าน','บอสมีเลือด 3 หลอด หลายเฟส และถ้าฆ่าได้ Portal จบเกมจะเปิดพร้อมเริ่ม Overtime'),
      guideTextCard('วาร์ปศัตรูไกล','ศัตรูที่อยู่ไกลเกินไปจะกลับมาเกิดรอบผู้เล่นโดยไม่ฟื้นเลือดที่เสียไป','ช่วยให้แรงกดดันไม่หาย')
    ].join('');
  } else if(kind==='combat'){
    title='ระบบต่อสู้';
    note='กติกาสั้น ๆ ของค่าสถานะและเอฟเฟกต์ที่สำคัญระหว่างรัน';
    cards=[
      guideTextCard('โอกาสคริติคอล','โอกาสที่การโจมตีจะติดคริติคอล Focus Tome และบางตัวละครช่วยเพิ่มค่านี้','มี pity เล็กน้อย ถ้าดวงไม่ติดหลายครั้ง โอกาสครั้งถัดไปจะดีขึ้น'),
      guideTextCard('ดาเมจคริติคอล','ตัวคูณดาเมจเมื่อโจมตีติดคริติคอล Execution Tome และ Stormcaller ช่วยเพิ่มค่านี้','คริติคอลต่อเนื่องเกิด chain bonus และทำให้ศัตรูติด Rend เลือดไหลสั้น ๆ'),
      guideTextCard('ยิงทะลุ','จำนวนศัตรูที่กระสุนหรือวัตถุโจมตีผ่านได้ก่อนหายไป','แข็งแรงมากเมื่อเจอฝูงศัตรูแน่น ๆ'),
      guideTextCard('Ricochet','อาวุธที่รองรับจะเด้งไปหาเป้าหมายใหม่หลังชน Ricochet Tome เพิ่มจำนวนเด้ง','เหมาะกับ Cursed Football, Shield Toss, Bone Boomerang และ Bouncing Bomb'),
      guideTextCard('บิลด์ Ricochet','Football เด้งต่อเป้าหมาย, Shield Toss ทะลุก่อนเด้ง, Bone Boomerang ยิงเป็นโค้งคู่, Bouncing Bomb ทิ้งแรงระเบิด','Ricochet ไม่ส่งผลกับ melee, nova, orbit, smite หรือ lightning'),
      guideTextCard('Knockback','แรงผลักศัตรู ยิ่งเข้า Overtime ศัตรูยิ่งต้านแรงผลักมากขึ้น','ผู้เล่นเองก็โดนมอนสเตอร์ตีจนกระเด็นได้'),
      guideTextCard('Guard','Orbiting Skull บล็อกดาเมจได้ หัวกะโหลกจะหายไปเมื่อบล็อกแล้วค่อยฟื้นตามคูลดาวน์','มีกะโหลกมากเท่ากับกันตายได้มากขึ้น'),
      guideTextCard('Overtime','หลัง 10:00 ศัตรูจะเริ่มที่ x2 แล้วเพิ่มเป็น x3, x4, x5 ต่อเนื่อง Map 3 เริ่มหลังบอสสุดท้ายตาย','ทุกโหมดเริ่ม Overtime และเพิ่มระดับทุก 30 วิเหมือนกัน เพื่อให้คะแนนเทียบกันง่ายขึ้น')
    ].join('');
  } else if(kind==='shrine'){
    title='Shrine';
    note='สิ่งก่อสร้างและ object สำคัญบนแผนที่ กด F เมื่อเข้าใกล้เพื่อใช้งาน';
    cards=[
      guideSectionTitle('เสาแม่เหล็ก','ใช้ครั้งเดียวต่อเสา วางแผนใช้หลังเวฟใหญ่หรือหลังบอสเพื่อเก็บ XP/ทองที่ค้างทั้งแผนที่'),
      guideCard(spriteSrc('obj_magnet_pillar'),'เสาแม่เหล็ก','ดูด XP และทองที่ตกอยู่ทั่วแผนที่เข้าหาผู้เล่นทันที','Map 1: 1 ต้น / Map 2: 1-2 ต้น / Map 3: 1 ต้น', 'uncommon'),
      guideSectionTitle('Shrine','แท่นเสี่ยงแลกผลตอบแทน มีหลายแบบและใช้แล้วหายไป'),
      guideCard(spriteSrc('obj_shrine_elite'),'Elite Shrine','เรียก Elite 8 ตัวออกมารอบแท่น เหมาะเมื่อพร้อมรับไฟต์เพื่อแลกรางวัลจากการฆ่า','เสี่ยงสูงช่วงต้นเกม', 'rare'),
      guideCard(spriteSrc('obj_shrine_blood'),'Blood Shrine','เสียเลือด 30% แล้วดรอปไอเทมแบบ boosted','อย่าใช้ตอนเลือดต่ำหรือมีฝูงศัตรูล้อม', 'rare'),
      guideCard(spriteSrc('obj_shrine_speed'),'Speed Shrine','เพิ่มความเร็วเคลื่อนที่ 40% เป็นเวลา 30 วินาที','ใช้หนีเวฟ เก็บของ หรือวนหลบบอส', 'uncommon'),
      guideCard(spriteSrc('obj_shrine_curse'),'Curse Shrine','มอนทั่วไปที่เกิดใหม่ HP +10% / ATK +15% แต่เพิ่ม XP และทองที่ได้รับ 50% ตลอดรัน','เหมาะกับรันที่มั่นใจและอยากเร่งสเกล', 'legendary'),
      guideCard(spriteSrc('obj_shrine_gamble'),'Gamble Shrine','สุ่ม 50/50 ระหว่างได้ไอเทม legendary หรือโดน Elite 12 ตัว','สนุก แต่ไม่สุภาพกับคนเลือดน้อย', 'legendary'),
      guideSectionTitle('Chest และ Merchant','แหล่งซื้อของ/สุ่มของหลักของรัน แต่มีความเสี่ยง'),
      guideCard(spriteSrc('chest_common'),'Common Chest','ใช้ทองเปิด มีโอกาสได้ไอเทมและมีโอกาสเป็น Mimic','ราคาถูก เหมาะเปิดช่วงต้น', 'common'),
      guideCard(spriteSrc('chest_rare'),'Rare Chest','ใช้ทองมากขึ้น แต่โอกาสของดีสูงกว่า','เหมาะเมื่อมีบิลด์เริ่มนิ่ง', 'rare'),
      guideCard(spriteSrc('chest_epic'),'Epic Chest','แพงที่สุด แต่โอกาส rare/legendary สูงสุด','อย่าเปิดถ้าเงินยังต้องใช้กับร้าน', 'legendary'),
      guideCard(spriteSrc('obj_merchant'),'Merchant','ขายไอเทม 3 ชิ้น สินค้าไม่รีเองจนกด Reroll','ซื้อบ่อยมีโอกาส 15% ที่พ่อค้าจะกลายเป็นบอส', 'rare'),
      guideSectionTitle('Altar และ Portal','ใช้คุมความคืบหน้าของ map และการย้ายด่าน'),
      guideCard(spriteSrc('obj_altar'),'Boss Altar','กด F เพื่อเรียกบอสประจำด่าน เมื่อพร้อมสู้และอยากไปต่อ','Map 3 จะเรียกบอสสุดท้ายให้อัตโนมัติเมื่อเข้าด่าน', 'legendary'),
      guideCard(spriteSrc('obj_normal_portal'),'Portal ปกติ','หลังฆ่าบอส Map 1/2 และเลือก Relic แล้ว Portal ปกติจะเปิดเพื่อย้ายไป map ถัดไป','เดินชน Portal เพื่อไปต่อ ไม่ต้องกด F', 'rare'),
      guideCard(spriteSrc('obj_portal'),'Final Portal','หลังฆ่าบอสสุดท้ายใน Map 3 ประตูจบเกมจะเปิด ใช้เพื่อเคลียร์รันและบันทึกคะแนน','ถ้าไม่เข้าทันที เกมจะเข้าสู่ Overtime หลังบอสตาย', 'legendary'),
      guideCard(spriteSrc('obj_challenge_gate'),'Challenge Gate','หลังบอส Map 1/2 อาจมีประตูท้าทายแยกจาก Portal ปกติ เดินชนเพื่อสุ่มเข้าห้องพิเศษ','จบห้องแล้วจะมี Portal กลับไป map ถัดไป', 'legendary')
    ].join('');
  } else if(kind==='shop'){
    title='ร้านค้า / NPC';
    note='พ่อค้าเร่มีประโยชน์ ราคาแรง และอารมณ์ไม่ค่อยมั่นคง';
    cards=[
      guideTextCard('ซื้อไอเทม','ไอเทมออกซ้ำได้ ซื้อหรือเก็บซ้ำแล้ว stack ผลของมันต่อไป','ราคาถูกปรับให้สูงขึ้นตามระบบเศรษฐกิจร้านค้า'),
      guideTextCard('Reroll','สุ่มสินค้าในร้านใหม่ และจะแพงขึ้นทุกครั้งที่ใช้','ใช้เมื่อบิลด์ต้องการค่าสถานะเฉพาะจริง ๆ'),
      guideTextCard('พ่อค้าทรยศ','ซื้อของถี่เกินไปมีโอกาส 15% ที่ NPC จะกลายเป็นบอส','Relic Golden Pact เพิ่มความเสี่ยงนี้'),
      guideTextCard('ของที่น่าซื้อ','ดาเมจ, crit, growth และไอเทมเศรษฐกิจมักคุ้มเมื่อเข้ากับสไตล์อาวุธของคุณ','อย่ากวาดซื้อทุกอย่างแบบไม่ดูบิลด์')
    ].join('');
  } else if(kind==='ranking'){
    title='Ranking';
    note='Leaderboard online รับคะแนนจากเกมเวอร์ชันปัจจุบันเท่านั้น';
    cards=[
      guideTextCard('เฉพาะเวอร์ชันปัจจุบัน','คะแนนจาก build เก่าจะถูกปฏิเสธ เพื่อให้ทุกคนแข่งด้วยกติกาเดียวกัน','รันที่ถูกปฏิเสธจะไม่ขึ้น ranking'),
      guideTextCard('ที่มาของคะแนน','จำนวน kill, บอส, เวลารอดชีวิต, ความคืบหน้าแผนที่ และรางวัลที่เลือก มีผลกับคะแนน','เสาแม่เหล็กอาจให้คะแนนน้อยหรือไม่ให้เลย'),
      guideTextCard('ชื่อผู้เล่น','ชื่อที่กรอกก่อนเริ่มเกมจะใช้แสดงบน ranking','Guest เล่นได้ แต่ Login จะทำให้คะแนนเป็น Verified'),
      guideTextCard('ธงประเทศ','เลือกประเทศก่อนเริ่มรัน และแสดงธงด้วย CSS เพื่อให้ใช้ได้บน PC','เหมาะกับการแข่งกันเล่นแบบขำ ๆ')
    ].join('');
  } else if(kind==='monsters'){
    title='สารานุกรมมอนสเตอร์';
    note='มอนสเตอร์ปกติ แยกตามโซน/แผนที่และพฤติกรรมหลัก';
    const mn=n=>(MAP_THEMES[n]&&MAP_THEMES[n].name)||('Map '+n);
    const mapName=t=>t.tier===0?('Map 1 · '+mn(1)):t.tier===1?('Map 2 · '+mn(2)):('Map 3 · '+mn(3));
    cards=ENEMY_TYPES.slice().sort((a,b)=>a.tier-b.tier||a.name.localeCompare(b.name)).map(e=>{
      const desc=unitBehaviorText(e)+' / '+(CHALLENGE_ONLY_ENEMIES.has(e.name)?'Challenge Room':mapName(e));
      const meta=monsterStatMeta(e);
      return guideUnitCard(unitSpritePath(e.sprite), e.name, desc, meta, 'monster sheet');
    }).join('');
  } else if(kind==='bosses'){
    title='สารานุกรมบอส';
    note='บอสและมินิบอส พร้อมสกิลสำคัญที่ต้องระวัง';
    const mnb=n=>(MAP_THEMES[n]&&MAP_THEMES[n].name)||('Map '+n);
    const minis=MINIBOSS_TYPES.map(e=>
      guideUnitCard(unitSpritePath(e.sprite), e.name, 'มินิบอส / '+skillListFor(e.sprite, typeof MB_SKILLS!=='undefined'?MB_SKILLS:null), bossStatMeta(e,'mini'), 'boss sheet')
    ).join('');
    const bosses=BOSS_TYPES.map(e=>{
      const where=e.final?('Map 3 · '+mnb(3)+' (บอสสุดท้าย)'):(e.name==='Lich King'||e.name==='Abyssal Behemoth')?('Map 1 · '+mnb(1)):('Map 2 · '+mnb(2));
      return guideUnitCard(unitSpritePath(e.sprite), e.name, where+' / '+skillListFor(e.sprite, typeof BOSS_SKILLS!=='undefined'?BOSS_SKILLS:null), bossStatMeta(e,'boss'), 'boss sheet');
    }).join('');
    const butcher=guideUnitCard(unitSpritePath('boss_butcher'), 'The Butcher', 'Special Hunt / สุ่ม 20% ต่อรัน ช่วงนาที 6-8 / สกิล: '+['reaperBlink','rustedGallows','fan'].map(s=>guideText(SKILL_GUIDE_TEXT[s],s)).join(', '), 'มีเวลา 30 วิให้ฆ่าเพื่อรางวัลพิเศษ · ไม่กระเด็น แต่เลือดและความเร็วถูกลดลงแล้ว', 'boss sheet hunt');
    cards=minis+bosses+butcher;
  } else {
    return openGuide('hub');
  }
  if(tr('guide.'+kind)) title=tr('guide.'+kind);
  if(tr('guide.'+kind+'.desc')) note=tr('guide.'+kind+'.desc');
  body.innerHTML=guideHeader(title, note, kind)+'<div class="guidegrid '+escHtml(kind)+'">'+cards+'</div>';
  bindGuideChrome(body);
  body.querySelectorAll('[data-jump]').forEach(btn=>btn.onclick=()=>openGuide(btn.dataset.jump));
  body.querySelectorAll('[data-pet-buy]').forEach(btn=>btn.onclick=()=>buyPet(btn.getAttribute('data-pet-buy')));
  body.querySelectorAll('[data-pet-select]').forEach(btn=>btn.onclick=()=>selectPet(btn.getAttribute('data-pet-select')||''));
  guide.style.display='flex';
}
function closeGuide(){
  const guide=document.getElementById('guide');
  if(guide) guide.style.display='none';
}
function selectCharacter(key){
  if(!isCharacterUnlocked(key)){
    showToast(tr('common.locked')+': '+unlockRequirement('character', key), 2.8);
    return;
  }
  currentChar=key;
  document.getElementById('select').style.display='none';
  document.getElementById('over').style.display='none';
  showFirstRunHowTo(afterCharacterHowTo);
}
function afterCharacterHowTo(){
  openDifficultySelect();
}
function difficultyById(id){ return DIFFICULTIES.find(d=>d.id===id) || DIFFICULTIES[1]; }
function activeDifficulty(){ return difficultyById(activeDifficultyId); }
function difficultyAllowsPacts(){ return activeDifficultyId==='normal' || activeDifficultyId==='hard'; }
function difficultyScoreMul(){ return activeDifficulty().mult || 1; }
function setActiveDifficulty(id){ activeDifficultyId=difficultyById(id).id; }
function openDifficultySelect(){
  buildDifficultySelect();
  document.getElementById('difficultyselect').style.display='flex';
}
function buildDifficultySelect(){
  const wrap=document.getElementById('difficultycards');
  if(!wrap) return;
  wrap.innerHTML='';
  for(const d of DIFFICULTIES){
    const card=document.createElement('div');
    card.className='difficultycard '+d.id;
    card.innerHTML='<span class="dmult">x'+Number(d.mult).toFixed(2)+'</span><b>'+escHtml(d.name)+'</b><em>'+escHtml(d.badge||'')+'</em><p>'+escHtml(d.desc)+'</p><small>'+escHtml(d.meta)+'</small>';
    card.onclick=()=>chooseDifficulty(d.id);
    wrap.appendChild(card);
  }
}
function chooseDifficulty(id){
  setActiveDifficulty(id);
  document.getElementById('difficultyselect').style.display='none';
  if(difficultyAllowsPacts() && unlockedPacts().length){
    openPactSelect();
    return;
  }
  setActivePacts([]);
  beginSelectedRun();
}
function beginSelectedRun(){
  document.getElementById('difficultyselect').style.display='none';
  document.getElementById('pactselect').style.display='none';
  started=true; restart();
  heroQuip('start',1,2.8);
  petReact('start', true);
}
function openPactSelect(){
  selectedPactIds = [];
  buildPactSelect();
  document.getElementById('pactselect').style.display='flex';
}
function buildPactSelect(){
  const wrap=document.getElementById('pactcards');
  const mult=document.getElementById('pactmult');
  const lastBtn=document.getElementById('pactlast');
  if(!wrap || !mult) return;
  wrap.innerHTML='';
  const currentMult=calcPactMultiplier(selectedPactIds);
  mult.textContent=tr('common.score')+' x'+currentMult.toFixed(2);
  mult.classList.toggle('hot', currentMult>=1.75);
  for(const p of PACTS){
    const unlocked=isPactUnlocked(p.id);
    const selected=selectedPactIds.includes(p.id);
    const d=document.createElement('div');
    d.className='pactcard '+(selected?'selected ':'')+(unlocked?'':'locked');
    d.innerHTML='<span class="pactbadge '+escHtml(p.tier)+'">+'+Math.round(p.bonus*100)+'%</span>'
      +'<b>'+escHtml(pactName(p))+'</b><p>'+escHtml(pactDesc(p))+'</p>'
      +'<small>'+escHtml(unlocked ? pactTitle(p) : tr('common.locked')+': '+pactUnlockText(p))+'</small>';
    d.onclick=()=>{
      if(!unlocked){ showToast(tr('common.locked')+': '+pactUnlockText(p),2.5); return; }
      if(selectedPactIds.includes(p.id)) selectedPactIds=selectedPactIds.filter(id=>id!==p.id);
      else selectedPactIds.push(p.id);
      buildPactSelect();
    };
    wrap.appendChild(d);
  }
  if(lastBtn){
    const last=lastPactLoadout();
    lastBtn.className=last.length?'':'disabled';
    lastBtn.textContent=last.length ? tr('common.useLast',{mult:calcPactMultiplier(last).toFixed(2)}) : tr('common.noLast');
  }
}
const UPGRADES = [
  { id:'might',    name:'Might',      desc:'ดาเมจ +15%',        icon:'tomeic_might',     apply:()=>{ player.dmgMul*=1.15; } },
  { id:'vitality', name:'Vitality',   desc:'เลือดสูงสุด +25 และฮีลทันที',   icon:'tomeic_vitality',  apply:()=>{ player.maxHp+=25; player.hp=Math.min(healCap(player), player.hp+scaledHeal(25)); } },
  { id:'celerity', name:'Celerity',   desc:'ความเร็วโจมตี +10%',  icon:'tomeic_celerity',  apply:()=>{ player.rateMul*=1.10; } },
  { id:'precision',name:'Precision',  desc:'ระยะโจมตี +15%',         icon:'tomeic_precision', apply:()=>{ player.rangeMul*=1.15; } },
  { id:'multishot',name:'Multishot',  desc:'จำนวนกระสุน/วัตถุโจมตี +1',      icon:'tomeic_multishot', apply:()=>{ player.countBonus+=1; } },
  { id:'swiftness',name:'Swiftness',  desc:'ความเร็วเดิน +6%',     icon:'tomeic_swiftness', apply:()=>{ player.spd*=1.06; } },
  { id:'regen',    name:'Regen',      desc:'ฟื้นเลือด +0.8 ต่อวินาที',        icon:'tomeic_regen',     apply:()=>{ player.regen+=0.8; } },
  { id:'magnet',   name:'Magnetism',  desc:'ระยะดูดของ +30%',  icon:'tomeic_magnet', apply:()=>{ player.magnet*=1.3; } },
  { id:'exp',      name:'Experience', desc:'XP ที่ได้รับ +15%',       icon:'tomeic_exp',apply:()=>{ player.xpMul*=1.15; } },
  { id:'greed',    name:'Greed',      desc:'ทองที่ได้รับ +20%',          icon:'tomeic_greed',     apply:()=>{ player.goldMul*=1.2; } },
  { id:'fortitude',name:'Fortitude',  desc:'เกราะ +4',           icon:'tomeic_fortitude', apply:()=>{ player.def+=4; } },
  { id:'lifesteal',name:'Lifesteal',  desc:'ฆ่าศัตรูแล้วฟื้นเลือด +1',     icon:'tomeic_lifesteal',  apply:()=>{ player.lifesteal+=1; } },
  { id:'duration', name:'Persistence',desc:'อายุกระสุน/วัตถุโจมตี +20%, ระยะเวลา AoE +10%',icon:'tomeic_duration',    apply:()=>{ player.lifeMul*=1.20; player.areaLifeMul*=1.10; } },
  { id:'velocity', name:'Velocity',   desc:'ความเร็วกระสุน/วัตถุโจมตี +20%',icon:'tomeic_velocity',apply:()=>{ player.projSpeedMul*=1.2; } },
  { id:'growth',   name:'Growth',     desc:'ขนาดสกิล +15%',icon:'tomeic_growth',     apply:()=>{ player.projScale*=1.15; } },
  { id:'impact',   name:'Impact',     desc:'แรงผลัก +15%',        icon:'tomeic_impact',   apply:()=>{ player.knockbackMul=(player.knockbackMul||0)+0.15; } },
  { id:'focus',    name:'Focus',      desc:'โอกาสคริติคอล +8%',       icon:'tomeic_focus',    apply:()=>{ player.critChance+=0.08; } },
  { id:'execution',name:'Execution',  desc:'ดาเมจคริติคอล +25%',      icon:'tomeic_execution',apply:()=>{ player.critDmg+=0.25; } },
  { id:'ricochet', name:'Ricochet',   desc:'เด้งเพิ่ม +1 ครั้งสำหรับ Football, Shield, Bone Boomerang และ Bomb', icon:'tomeic_ricochet', apply:()=>{ player.ricochetBonus=(player.ricochetBonus||0)+1; } },
];
const RELICS = [
  { id:'phoenix_sigil', name:'Phoenix Sigil', desc:'คืนชีพ 1 ครั้งที่เลือด 50%', icon:'relic_phoenix_sigil',
    apply:p=>{ p._phoenix=1; } },
  { id:'blood_crown', name:'Blood Crown', desc:'ดาเมจ +35%, เลือดสูงสุด -20%', icon:'relic_blood_crown',
    apply:p=>{ p.dmgMul*=1.35; p.maxHp=Math.max(1,Math.round(p.maxHp*0.8)); p.hp=Math.min(p.hp,p.maxHp); } },
  { id:'golden_pact', name:'Golden Pact', desc:'ราคาขายในร้าน -30%, โอกาสพ่อค้าทรยศ 25%', icon:'relic_golden_pact',
    apply:p=>{ p._goldenPact=1; } },
  { id:'execution_seal', name:'Execution Seal', desc:'ดาเมจต่อบอสและมินิบอส +25%', icon:'relic_execution_seal',
    apply:p=>{ p._executionSeal=1; } },
  { id:'soul_lantern', name:'Soul Lantern', desc:'XP และทองจากมินิบอส +50%', icon:'relic_soul_lantern',
    apply:p=>{ p._soulLantern=1; } },
  { id:'ancient_anvil', name:'Ancient Anvil', desc:'First weapon evolve needs 2 Tome stacks instead of 3', icon:'relic_ancient_anvil',
    apply:p=>{ p._ancientAnvil=1; p._anvilUsed=0; } },
];
function evolveTomeNeed(w){
  return player && player._ancientAnvil && !player._anvilUsed && w && !w.evolved ? 2 : 3;
}
function evolveStateForWeapon(w){
  const t=w&&WEAPON_TYPES[w.key];
  if(!t || !t.evolveTo || w.evolved) return { state:'none', text:'' };
  const need=evolveTomeNeed(w);
  const have=(player.tomeCount&&player.tomeCount[t.evolveTome])||0;
  if(w.lvl>=8 && have>=need) return { state:'ready', text:tr('common.ready')+' '+tr('common.evolve')+': '+tomeName(t.evolveTome) };
  if(w.lvl>=8 && have===need-1) return { state:'almost', text:(gameLang()==='en'?'1 more ':'ขาดอีก 1 ')+tomeName(t.evolveTome) };
  if(have>0) return { state:'pair', text:tr('common.pairWith',{name:tomeName(t.evolveTome)})+' ('+have+'/'+need+')' };
  return { state:'none', text:tr('common.evoPair')+': '+tomeName(t.evolveTome) };
}
function evolveStateForTome(id){
  if(!id || !player || !player.weapons) return { state:'none', text:'' };
  let best={ state:'none', text:'' }, priority={ none:0, pair:1, almost:2, ready:3 };
  for(const w of player.weapons){
    const t=WEAPON_TYPES[w.key];
    if(!t || !t.evolveTo || t.evolveTome!==id || w.evolved) continue;
    const need=evolveTomeNeed(w), have=(player.tomeCount&&player.tomeCount[id])||0;
    let cur={ state:'pair', text:tr('common.pairWith',{name:weaponName(w.key)}) };
    if(w.lvl>=8 && have>=need) cur={ state:'ready', text:weaponName(w.key)+' '+tr('common.ready') };
    else if(w.lvl>=8 && have===need-1) cur={ state:'almost', text:'เลือกอันนี้เพื่อเตรียมวิวัฒน์ '+weaponName(w.key) };
    else if(have>0) cur={ state:'pair', text:tr('common.pairWith',{name:weaponName(w.key)})+' ('+have+'/'+need+')' };
    if(priority[cur.state]>priority[best.state]) best=cur;
  }
  return best;
}
function evolveHintForChoice(u){
  if(!u || !player) return null;
  if(u.id && u.id.startsWith('evo_')) return { state:'ready', label:tr('common.ready'), text:tr('common.chooseEvolve') };
  if(u.id && u.id.startsWith('w_')){
    const key=u.id.slice(2), w=player.weapons.find(x=>x.key===key);
    if(w){
      const st=evolveStateForWeapon(w);
      if(st.state!=='none') return { state:st.state, label:st.state==='ready'?tr('common.ready'):st.state==='almost'?tr('common.almost'):tr('common.evoPair'), text:st.text };
    }
    const t=WEAPON_TYPES[key];
    if(t && t.evolveTome && player.tomeCount[t.evolveTome]) return { state:'pair', label:tr('common.evoPair'), text:tr('common.pairWith',{name:tomeName(t.evolveTome)}) };
  } else if(u.id){
    const st=evolveStateForTome(u.id);
    if(st.state!=='none') return { state:st.state, label:st.state==='ready'?tr('common.ready'):st.state==='almost'?tr('common.almost'):tr('common.evoPair'), text:st.text };
  }
  return null;
}
function relicCard(r,i){
  return '<img src="'+escHtml(spriteSrc(r.icon))+'"><div class="nm">'+escHtml(r.name)+'</div><div class="ds">'+escHtml(r.desc)+'</div><div class="key">[ '+(i+1)+' ]</div>';
}
function openRelicChoice(nextStage){
  const pool=RELICS.filter(r=>!(player.relics||[]).some(x=>x.id===r.id));
  currentRelicChoices=[];
  for(let i=0;i<3 && pool.length;i++) currentRelicChoices.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
  pendingRelicPortal={ nextStage };
  const wrap=document.getElementById('reliccards'); wrap.innerHTML='';
  currentRelicChoices.forEach((r,i)=>{ const d=document.createElement('div'); d.className='card'; d.innerHTML=relicCard(r,i); d.onclick=()=>pickRelic(i); wrap.appendChild(d); });
  paused=true;
  document.getElementById('relicup').style.display='flex';
}
function pickRelic(i){
  if(!paused || document.getElementById('relicup').style.display!=='flex') return;
  const r=currentRelicChoices[i]; if(!r) return;
  r.apply(player);
  player.relics.push({ id:r.id, name:r.name, desc:r.desc });
  document.getElementById('relicup').style.display='none';
  const nextStage=pendingRelicPortal&&pendingRelicPortal.nextStage;
  pendingRelicPortal=null;
  paused=false;
  if(nextStage) {
    altarToPortal('nextStage', nextStage);
    spawnChallengeDoors(nextStage);
  }
  showToast((gameLang()==='en'?'Relic gained: ':'ได้รับ Relic: ')+r.name,2.4);
}
function grantRandomRelic(reason){
  if(!player) return null;
  const pool=RELICS.filter(r=>!(player.relics||[]).some(x=>x.id===r.id));
  if(!pool.length) return null;
  const r=pool[(Math.random()*pool.length)|0];
  r.apply(player);
  player.relics.push({ id:r.id, name:r.name, desc:r.desc });
  showToast((reason||'Relic')+': '+r.name,3.0);
  return r;
}
const MAX_TOMES = 4;   // เลือก tome ได้สูงสุด 4 ชนิด (เก็บซ้อนได้ไม่จำกัด)
const CHOICE_BANS_PER_RUN = 5;
function choiceBansPerRun(){
  return activeDifficultyId==='casual' ? 10 : CHOICE_BANS_PER_RUN;
}
function isBannedChoice(u){
  return !!(u && player.bannedChoices && player.bannedChoices[u.id]);
}
function canBanChoice(u){
  return !!(player && player.bansRemaining && isBanEligibleChoice(u));
}
function isBanEligibleChoice(u){
  if(!u || isBannedChoice(u) || u.id.startsWith('evo_')) return false;
  if(u.id.startsWith('w_')){
    const key=u.id.slice(2);
    return !player.weapons.some(w=>w.key===key);
  }
  return !player.tomeCount[u.id];
}
function weaponChoiceHintText(key){
  const t=WEAPON_TYPES[key];
  if(!t || !t.evolveTo) return '';
  const owned=player && player.weapons && player.weapons.find(x=>x.key===key);
  const need=evolveTomeNeed(owned);
  return ' · '+tr('common.evolve')+': '+tomeName(t.evolveTome)+' x'+need+' @Lv8';
}
function localizedChoiceName(u){
  if(!u) return '';
  if(u.id && u.id.startsWith('evo_')){
    const key=u.id.slice(4);
    const ev=(WEAPON_TYPES[key]&&WEAPON_TYPES[key].evolveTo)||key;
    return '★ '+tr('common.evolve')+': '+weaponName(ev);
  }
  if(u.id && u.id.startsWith('w_')){
    const key=u.id.slice(2);
    const owned=player && player.weapons && player.weapons.find(w=>w.key===key);
    return owned ? weaponName(key)+' Lv'+(owned.lvl+1) : tr('common.new')+': '+weaponName(key);
  }
  return tomeName(u);
}
function localizedChoiceDesc(u){
  if(!u) return '';
  if(u.id && u.id.startsWith('evo_')){
    const key=u.id.slice(4);
    const ev=(WEAPON_TYPES[key]&&WEAPON_TYPES[key].evolveTo)||key;
    return weaponDesc(ev);
  }
  if(u.id && u.id.startsWith('w_')){
    const key=u.id.slice(2);
    return weaponDesc(key)+weaponChoiceHintText(key);
  }
  return tomeDesc(u);
}
function choiceCard(u,i){
  const ban=isBanEligibleChoice(u)
    ? (canBanChoice(u)
    ? '<button class="banbtn" type="button" data-ban="'+i+'" title="'+escHtml(tr('common.banHint'))+'" aria-label="'+escHtml(tr('common.ban')+' '+localizedChoiceName(u)+' · '+tr('common.bansLeft',{count:player.bansRemaining}))+'"><span>'+escHtml(tr('common.ban'))+'</span><b>'+player.bansRemaining+'</b></button>'
    : '<button class="banbtn disabled" type="button" disabled><span>'+escHtml(tr('common.ban'))+'</span><b>0</b></button>')
    : '';
  const hint=evolveHintForChoice(u);
  const badge=hint ? '<div class="evobadge '+hint.state+'">'+escHtml(hint.label)+'</div><div class="evohint">'+escHtml(hint.text)+'</div>' : '';
  return '<img src="'+escHtml(spriteSrc(u.icon))+'">'+badge+'<div class="nm">'+escHtml(localizedChoiceName(u))+'</div><div class="ds">'+escHtml(localizedChoiceDesc(u))+'</div><div class="choiceactions"><div class="key">[ '+(i+1)+' ]</div>'+ban+'</div>';
}
function openUpgradeChoice(){
  // Once 4 distinct tomes are taken, only offer those (level them up), no new tome types.
  const ownedTomes = Object.keys(player.tomeCount||{}).length;
  const tomePool = ownedTomes >= MAX_TOMES ? UPGRADES.filter(u=>player.tomeCount[u.id]) : UPGRADES;
  const pool=[...tomePool, ...weaponChoices()].filter(u=>!isBannedChoice(u)), pick=[];
  for(let i=0;i<3 && pool.length;i++) pick.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
  currentChoices=pick;
  const c=document.getElementById('cards'); c.innerHTML='';
  const actions=document.getElementById('levelactions');
  if(actions) actions.setAttribute('data-bans', tr('common.bansLeft',{count:player.bansRemaining||0}));
  pick.forEach((u,i)=>{ const hint=evolveHintForChoice(u); const d=document.createElement('div'); d.className='card'+(hint?' evochoice ev-'+hint.state:'');
    d.innerHTML=choiceCard(u,i);
    d.onclick=()=>pickUpgrade(i); c.appendChild(d); });
  c.querySelectorAll('.banbtn').forEach(btn=>btn.onclick=e=>{ e.stopPropagation(); banUpgrade(+btn.dataset.ban); });
  paused=true; document.getElementById('levelup').style.display='flex';
}
function pickUpgrade(i){ if(!paused) return; const u=currentChoices[i]; if(!u) return; u.apply();
  if (u.id && !u.id.startsWith('w_') && !u.id.startsWith('evo_')) player.tomeCount[u.id]=(player.tomeCount[u.id]||0)+1;
  checkEvolveReady();
  document.getElementById('levelup').style.display='none';
  pendingUps--; if(pendingUps>0) openUpgradeChoice(); else paused=false; }
function banUpgrade(i){
  if(!paused || pendingUps<=0) return;
  const u=currentChoices[i];
  if(!canBanChoice(u)) return;
  player.bannedChoices[u.id]=true;
  player.bansRemaining--;
  showToast(tr('common.ban')+' '+localizedChoiceName(u), 1.1);
  openUpgradeChoice();
}
function skipUpgrade(){
  if(!paused || pendingUps<=0 || document.getElementById('levelup').style.display!=='flex') return;
  document.getElementById('levelup').style.display='none';
  pendingUps--;
  if(pendingUps>0) openUpgradeChoice(); else paused=false;
}
// Notify the player the moment a weapon meets its evolve requirement.
function checkEvolveReady(){
  for (const w of player.weapons){
    const t = WEAPON_TYPES[w.key];
    if (t && t.evolveTo && !w.evolved && !w.evoAnnounced && w.lvl>=8 && (player.tomeCount[t.evolveTome]||0)>=evolveTomeNeed(w)){
      w.evoAnnounced = true;
      showToast('★ '+weaponName(w.key)+' '+(gameLang()==='en'?'is ready to evolve. Pick the ★ card on level up!':'พร้อมวิวัฒน์ เลือกการ์ด ★ ตอนอัปเลเวล!'), 3.5);
      sfx('levelup');
    }
  }
}
function currentTier(){ return mapStage>=2 ? 2 : gameTime>=240 ? 2 : gameTime>=120 ? 1 : 0; }
function timeScale(){ return Math.min(10, 1 + gameTime/130); }
// ATK scales far slower than HP so late-game hits sting without one-shotting.
function atkTimeScale(){ return Math.min(2.4, 1 + gameTime/420); }
// Map 2+ ramps hard: enemies/minibosses/bosses get much tougher each stage.
function lateMapHpBonus(){ return mapStage>=2 ? 1.10 : 1; }
function stageHpMul(){ return (mapStage>=3 ? 4.8 : mapStage>=2 ? 2.7 : 1) * lateMapHpBonus(); }
function stageAtkMul(){ return mapStage>=3 ? 2.4 : mapStage>=2 ? 1.75 : 1; }
function normalHpScale(tier){ return timeScale()*1.10*[1,1.22,1.48][tier||0]*stageHpMul()*otPowerMul()*pactNormalHpMul(); }
function normalAtkScale(tier){ return atkTimeScale()*[1,1.12,1.27][tier||0]*stageAtkMul()*otPowerMul()*difficultyAtkMul(); }
function minibossHpScale(){ return timeScale()*1.35*1.05*(mapStage>=3 ? 5.0 : mapStage>=2 ? 2.9 : 1)*lateMapHpBonus()*otPowerMul()*difficultyBossHpMul(); }
function bossHpScale(){ return timeScale()*1.45*1.08*(mapStage>=3 ? 5.8 : mapStage>=2 ? 3.1 : 1)*lateMapHpBonus()*otPowerMul()*difficultyBossHpMul(); }
function bossRegenCap(e){
  if(e && e.final && e.phaseHp && e.finalPhase) return e.phaseHp*e.finalPhase;
  return e && e.maxHp ? e.maxHp : 0;
}
function bossRegenRate(e){
  if(!e || !e.isBoss || e.phaseInvuln>0) return 0;
  const pct=e.isStageBoss ? (e.final?0.0018:0.0024) : (e.elite?0.0011:0.0009);
  const flat=e.isStageBoss ? (e.final?2.4:3.2) : (e.elite?1.3:1.0);
  return e.maxHp*pct + flat*otPowerMul();
}
const MINIBOSS_SPEED_MUL = 1.18;
const BOSS_SPEED_MUL = 1.22;
const MAX_LEVEL = 60;
function xpRequired(level){
  const k=Math.max(0,level-1);
  // cubic ramp: gentle early, brutal near max level
  return Math.round(20 + 10*k + 4*k*k + 0.22*k*k*k);
}
function enemySpeedMul(){
  return (1 + Math.min(0.35, stageTime()/720)) * otSpeedMul();
}
function progressionProfile(){
  const st=stageTime();   // spawn density ramps fresh each stage
  const points=[
    [0,18,3.4,2],[60,28,3.0,3],[120,40,2.6,4],[240,60,2.1,5],
    [360,80,1.7,6],[480,105,1.35,8],[600,130,1.1,10]
  ];
  if(overtimeLevel()){
    const mul=otPowerMul();
    return pactHordeProfile({cap:Math.min(overtimeEnemyCap(),Math.round(130*mul)),interval:Math.max(0.25,1.1/mul),batch:Math.min(96,Math.round(10*mul))});
  }
  let a=points[0], b=points[1];
  for(let i=1;i<points.length;i++) if(st>=points[i][0]){ a=points[i]; b=points[Math.min(i+1,points.length-1)]; }
  const f=(st-a[0])/Math.max(1,b[0]-a[0]);
  return pactHordeProfile({
    cap:Math.round(a[1]+(b[1]-a[1])*f),
    interval:a[2]+(b[2]-a[2])*f,
    batch:Math.round(a[3]+(b[3]-a[3])*f)
  });
}
function hordeSize(number){
  const mul=otPowerMul();
  const base=number<=1 ? 35 : number===2 ? 55 : Math.round(55*Math.pow(1.2,number-2));
  return Math.min(overtimeEnemyCap(),pactHordeSize(Math.round(base*mul)));
}
function updateOvertimeWarning(){
  const tier=overtimeTier();
  if(tier>1){
    if(tier>overtimeAnnouncedTier){
      overtimeAnnouncedTier=tier;
      showToast('OVERTIME x'+tier, tier===2 ? 3.2 : 2.6);
    }
    return;
  }
  if(mapStage>=3) return;
  const remain=overtimeThreshold()-stageTime();
  if(overtimeWarnStage<1 && remain<=60 && remain>30){
    overtimeWarnStage=1;
    showToast('ใกล้ Overtime: เหลือ 60 วิ ก่อน x2',2.8);
  } else if(overtimeWarnStage<2 && remain<=30 && remain>10){
    overtimeWarnStage=2;
    showToast('เตือน Overtime: เหลือ 30 วิ ก่อน x2',3.0);
  } else if(overtimeWarnStage<3 && remain<=10 && remain>0){
    overtimeWarnStage=3;
    showToast('Overtime ในอีก 10 วินาที!',2.6);
  }
}
function finalBossDeadlineActive(){
  return mapStage>=3 && finalBossKilledAt==null && !won && !gameOver;
}
function updateFinalBossDeadline(){
  if(!finalBossDeadlineActive()) return false;
  const remain=RUN_TARGET-stageTime();
  if(finalBossWarnStage<1 && remain<=60 && remain>30){
    finalBossWarnStage=1;
    showToast('เส้นตายบอสสุดท้าย: เหลือ 60 วิ',3.0);
  } else if(finalBossWarnStage<2 && remain<=30 && remain>10){
    finalBossWarnStage=2;
    showToast('เส้นตายบอสสุดท้าย: เหลือ 30 วิ',3.0);
  } else if(finalBossWarnStage<3 && remain<=10 && remain>0){
    finalBossWarnStage=3;
    showToast('เส้นตายบอสสุดท้าย: เหลือ 10 วิ!',2.8);
  }
  if(remain>0) return false;
  if(runStats) runStats.deathCause={ label:'หมดเวลา Map 3', source:'THE OVERLORD', kind:'deadline', amount:0, time:gameTime, stage:mapStage };
  player.hp=0;
  player.alive=false;
  showToast('หมดเวลา - พันธสัญญาแห่งความมืดกลืนกินคุณ!',4.0);
  sfx('hurt');
  if(typeof triggerDeathCinematic==='function'){
    try { triggerDeathCinematic(); }
    catch(err){
      console.warn('Final boss deadline death cinematic failed', err);
      deathCinematic=false;
      gameOver=true;
      if(typeof finalizeScore==='function') finalizeScore();
    }
  } else { gameOver=true; if(typeof finalizeScore==='function') finalizeScore(); }
  return true;
}
let toastTimer = 0;
let heroQuipAt = 0;
function showToast(message,duration){
  $('toast').textContent=message;
  toastTimer=duration||1.5;
}
function heroQuip(kind,chance,duration){
  if(!player || !player.char || !CHARACTERS[player.char] || !CHARACTERS[player.char].quips) return;
  if(gameTime < heroQuipAt || Math.random() > (chance==null?1:chance)) return;
  const list=CHARACTERS[player.char].quips[kind] || CHARACTERS[player.char].quips.start || [];
  if(!list.length) return;
  const name=CHARACTERS[player.char].name || 'Hero';
  const readTime=Math.min(5.2, Math.max(3.8, (duration||2.4)*1.55));
  showToast(name+': '+list[(Math.random()*list.length)|0], readTime);
  heroQuipAt = gameTime + Math.max(6.5, readTime+1.4);
}
let fpsAccum = 0, fpsFrames = 0;
const SHADOW_GEO = new THREE.CircleGeometry(0.5, 16);
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.32, depthWrite:false });
const ENEMY_SHADOW_GEO = SHADOW_GEO.clone();
ENEMY_SHADOW_GEO.rotateX(-Math.PI/2);
const ENEMY_SHADOW_CAP = 520;
let enemyShadowMesh = null;
let enemyShadowDummy = null;
const GRID_TEXTURE_POOL_CAP = 16;
const gridTexturePools = new Map();
// ---- GPU memory: free per-instance geometry/material/texture when objects are removed ----
// Shared resources are flagged so freeObj() skips them. Cloned textures are freed only by the
// material that owns them (_ownsMap). Without this, long sessions leak GPU memory -> white screen.
SHADOW_GEO._shared = ENEMY_SHADOW_GEO._shared = SHADOW_MAT._shared = PARTICLE_GEO._shared = TRAIL_GEO._shared = EFFECT_PLANE_GEO._shared = true;
function returnGridTextureToPool(map){
  if(!map || !map._poolKey) return false;
  const key=map._poolKey;
  map.offset.set(0,0);
  let pool=gridTexturePools.get(key);
  if(!pool){ pool=[]; gridTexturePools.set(key,pool); }
  if(pool.length>=GRID_TEXTURE_POOL_CAP){ map.dispose(); return true; }
  pool.push(map);
  return true;
}
function freeObj(obj){
  if(!obj || !obj.traverse) return;
  obj.traverse(n=>{
    if(n.geometry && !n.isSprite && !n.geometry._shared) n.geometry.dispose();
    const mat=n.material; if(!mat) return;
    const mats=Array.isArray(mat)?mat:[mat];
    for(const m of mats){
      if(!m || m._shared) continue;
      if(m.map && m.map._poolKey){
        returnGridTextureToPool(m.map);
        m.map=null;
      } else if(m._ownsMap && m.map) m.map.dispose();
      m.dispose();
    }
  });
}

function groundHeight(x, z) { return 0; }   // flat map (no hills)
// vertical gradient sky used as scene background
const MAP_THEMES = {
  1: {
    name:'Bleakfield',
    sky:['#140d24','#2e1840','#5a2746','#7e3450'],
    fog:0x271436,
    clear:0x140d24,
    ground:0xffffff,
    groundKey:'px_ground',
    borderKey:'border_wall',
    hemiSky:0x8a82b8,
    hemiGround:0x181020,
    sun:0xb9c8ff,
    rim:0xd34b73,
    playerLight:0x8fb8ff
  },
  2: {
    name:'Crimson Wastes',
    sky:['#120609','#2a080d','#68171d','#b3392a'],
    fog:0x3b0c11,
    clear:0x120609,
    ground:0xffffff,
    groundKey:'map2_ground',
    groundTile:10,
    borderKey:'map2_border_wall',
    hemiSky:0xe8785d,
    hemiGround:0x1a0707,
    sun:0xe89a62,
    rim:0xd6424e,
    playerLight:0xee7763
  },
  3: {
    name:'Void Citadel',
    sky:['#050714','#10092a','#251058','#1a315f'],
    fog:0x12072d,
    clear:0x050714,
    ground:0xffffff,
    groundKey:'map3_ground',
    borderKey:'map3_border_wall',
    hemiSky:0x7a75ff,
    hemiGround:0x050414,
    sun:0x8bd7ff,
    rim:0x9a55ff,
    playerLight:0x62d9ff
  }
};
function skyTexture() {
  const cv=document.createElement('canvas'); cv.width=16; cv.height=256;
  const ctx=cv.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,256);
  const theme=MAP_THEMES[mapStage] || MAP_THEMES[1];
  g.addColorStop(0.0,theme.sky[0]); g.addColorStop(0.5,theme.sky[1]);
  g.addColorStop(0.8,theme.sky[2]); g.addColorStop(1.0,theme.sky[3]);
  ctx.fillStyle=g; ctx.fillRect(0,0,16,256);
  const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; return t;
}
function applyMapTheme(){
  if(!scene) return;
  const theme=MAP_THEMES[mapStage] || MAP_THEMES[1];
  scene.background=skyTexture();
  scene.fog=new THREE.Fog(theme.fog, mapStage>=3 ? 28 : mapStage>=2 ? 34 : 42, mapStage>=3 ? 96 : mapStage>=2 ? 104 : 112);
  if(renderer) renderer.setClearColor(theme.clear);
  if(ground && ground.material){
    const groundTex=tex[theme.groundKey] || tex.px_ground;
    if(groundTex){
      groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
      const tile=theme.groundTile || 2.5;
      groundTex.repeat.set(Math.round(170/tile), Math.round(170/tile));
      ground.material.map=groundTex;
      ground.material.needsUpdate=true;
    }
    if(ground.material.color) ground.material.color.setHex(theme.ground);
  }
  if(borderMaterial){
    const borderTex=tex[theme.borderKey] || tex.border_wall;
    if(borderTex){
      borderMaterial.map=borderTex;
      borderMaterial.needsUpdate=true;
    }
  }
  if(hemiLight){ hemiLight.color.setHex(theme.hemiSky); hemiLight.groundColor.setHex(theme.hemiGround); hemiLight.intensity=mapStage>=3 ? 1.12 : mapStage>=2 ? 1.05 : 0.9; }
  if(sunLight){ sunLight.color.setHex(theme.sun); sunLight.intensity=mapStage>=3 ? 0.86 : mapStage>=2 ? 0.78 : 0.68; }
  if(rimLight){ rimLight.color.setHex(theme.rim); rimLight.intensity=mapStage>=3 ? 0.88 : mapStage>=2 ? 0.72 : 0.42; }
  if(playerLight){ playerLight.color.setHex(theme.playerLight); playerLight.intensity=mapStage>=3 ? 0.95 : mapStage>=2 ? 0.86 : 0.7; }
}
// multi-stop height palette -> lush stylized terrain
function terrainColor(h){
  const stops=[[0x16241d,0.0],[0x24382b,0.30],[0x33493a,0.52],
               [0x404a4e,0.72],[0x55556a,0.88],[0x6e6a86,1.0]];
  const t=Math.min(1,Math.max(0,(h+2.9)/5.8));
  let a=stops[0], b=stops[stops.length-1];
  for(let i=0;i<stops.length-1;i++){ if(t>=stops[i][1] && t<=stops[i+1][1]){ a=stops[i]; b=stops[i+1]; break; } }
  const f=(t-a[1])/((b[1]-a[1])||1);
  return new THREE.Color(a[0]).lerp(new THREE.Color(b[0]), Math.min(1,Math.max(0,f)));
}

// ---------- boot ----------
const mgr = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(mgr);
let pendingTex = 0, bootDone = false;
function bootIfReady(){ if (!bootDone && pendingTex<=0){ bootDone = true; init(); } }
for (const [k,f] of Object.entries(MANIFEST)) {
  pendingTex++;
  loader.load(spriteSrc(k), (t) => {
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false; t.encoding = THREE.sRGBEncoding;
    tex[k] = t; pendingTex--; bootIfReady();
  }, undefined, () => {
    // Optional sprite missing — code already falls back to canvas/static art at use sites.
    pendingTex--; bootIfReady();
  });
}
mgr.onLoad = bootIfReady;
mgr.onError = (u) => console.warn('tex load fail', u);

function prewarmEffectTextures(){
  try{
    if(typeof getPixelRingTexture==='function') getPixelRingTexture();
    if(typeof getCrescentTexture==='function') getCrescentTexture();
    if(typeof getBossDangerTexture==='function') getBossDangerTexture();
    if(typeof getBossDangerMarkTexture==='function') getBossDangerMarkTexture();
    if(typeof ensureMagnetPillarTexture==='function') ensureMagnetPillarTexture();
    if(typeof ensureBreakableTextures==='function') ensureBreakableTextures();
    if(typeof ensureStagePropTextures==='function') ensureStagePropTextures();
    if(typeof getEntityAuraTexture==='function'){
      ['object','boss','miniboss','immune','buff'].forEach(k=>getEntityAuraTexture(k));
    }
    if(typeof getLootBeaconTexture==='function'){
      [0x57e0ff,0xffb84f,0x52e7d1,0xffd86a,0x9a55ff,0xff5a5a].forEach(c=>getLootBeaconTexture(c));
    }
    if(typeof ensurePickupIconTexture==='function'){
      [
        ['icon_heal','hp'], ['icon_haste','haste'], ['icon_might','might'],
        ['icon_magnet_buff','magnet'], ['icon_coin','gold'], ['icon_xp','xp']
      ].forEach(([key,type])=>ensurePickupIconTexture(key,type));
    }
    if(typeof getPixelProjectileTexture==='function'){
      [
        ['smite',0xfff0a8], ['lightning',0xbff8ff], ['soul',0x9a55ff],
        ['orb',0x7ce7ff], ['doom',0xff5a5a], ['shard',0x89d8ff],
        ['dagger',0xffd6a8], ['screwdriver',0x7cffd8], ['arrow',0xd8f0ff],
        ['football',0xffffff], ['shield',0x8bd8ff], ['bone_boomerang',0xf3e2b8],
        ['bomb',0xffb84f]
      ].forEach(([shape,color])=>getPixelProjectileTexture(shape,color));
    }
  }catch(err){
    console.warn('effect texture prewarm failed', err);
  }
}
function prewarmShaders(){
  if(!renderer || !scene || !camera) return;
  const group=new THREE.Group();
  const warmMeshes=[];
  const add=m=>{ m.visible=true; m.position.set(0,-120,0); group.add(m); warmMeshes.push(m); };
  try{
    const spriteMap=tex.hero || tex.char_paladin_idle || tex.px_ground || null;
    if(spriteMap){
      add(new THREE.Sprite(new THREE.SpriteMaterial({ map:spriteMap, transparent:true, alphaTest:0.4, depthWrite:true })));
      add(new THREE.Sprite(new THREE.SpriteMaterial({ map:spriteMap, transparent:true, opacity:0.55, alphaTest:0.08, depthWrite:false, blending:THREE.AdditiveBlending })));
    }
    add(new THREE.Mesh(PARTICLE_GEO, getBurstMaterial(0xffd86a)));
    add(new THREE.Mesh(TRAIL_GEO, new THREE.MeshBasicMaterial({ color:0x7ce7ff, transparent:true, opacity:0.52, blending:THREE.AdditiveBlending, depthWrite:false })));
    add(new THREE.Mesh(EFFECT_PLANE_GEO, new THREE.MeshBasicMaterial({
      map:getPixelRingTexture(), color:0xffd86a, transparent:true, opacity:0.9,
      alphaTest:0.08, side:THREE.DoubleSide, depthWrite:false
    })));
    add(new THREE.Mesh(EFFECT_PLANE_GEO, new THREE.MeshBasicMaterial({
      map:getEntityAuraTexture('object'), color:0x52e7d1, transparent:true, opacity:0.72,
      alphaTest:0.06, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending
    })));
    ['fire','void','arcane','burrow_emerge'].forEach((kind,i)=>{
      const texKey=kind==='fire'?'fx_boss_aoe_fire_gen':kind==='arcane'?'fx_boss_aoe_arcane_gen':kind==='burrow_emerge'?'fx_burrow_emerge_gen':'fx_boss_aoe_void_gen';
      add(new THREE.Mesh(EFFECT_PLANE_GEO, new THREE.MeshBasicMaterial({
        map:tex[texKey]||getBossDangerTexture(), color:[0xffaa44,0x9a55ff,0x55ddff,0x6f5a91][i],
        transparent:true, opacity:0.5, alphaTest:0.05, side:THREE.DoubleSide,
        depthWrite:false, blending:THREE.AdditiveBlending
      })));
    });
    add(new THREE.Mesh(new THREE.SphereGeometry(0.26,10,10), new THREE.MeshBasicMaterial({
      color:0xff5066, transparent:true, opacity:0.20, blending:THREE.AdditiveBlending, depthWrite:false
    })));
    add(new THREE.Mesh(new THREE.BoxGeometry(0.72,0.05,0.09), new THREE.MeshBasicMaterial({
      color:0xffd6a8, transparent:true, opacity:0.98, blending:THREE.AdditiveBlending, depthWrite:false
    })));
    scene.add(group);
    renderer.compile(scene,camera);
  }catch(err){
    console.warn('shader prewarm failed', err);
  }finally{
    scene.remove(group);
    for(const m of warmMeshes){
      if(m.material && !m.material._shared) {
        const mats=Array.isArray(m.material)?m.material:[m.material];
        mats.forEach(mat=>{ if(mat && !mat._shared) mat.dispose(); });
      }
      if(m.geometry && !m.geometry._shared) m.geometry.dispose();
    }
    group.clear();
  }
}

function init() {
  document.getElementById('load').style.display = 'none';
  document.body.insertAdjacentHTML('beforeend','<div id="vig"></div>');
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth*innerHeight>2200000 ? 1.25 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x140d24);

  scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x271436, 42, 112);

  camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 600);

  hemiLight = new THREE.HemisphereLight(0x8a82b8, 0x181020, 0.9);
  scene.add(hemiLight);
  sunLight = new THREE.DirectionalLight(0xb9c8ff, 0.68);
  sunLight.position.set(20, 52, -10); scene.add(sunLight);
  rimLight = new THREE.DirectionalLight(0xd34b73, 0.42);
  rimLight.position.set(-22, 12, 18); scene.add(rimLight);
  playerLight = new THREE.PointLight(0x8fb8ff, 0.7, 12, 2);
  scene.add(playerLight);

  buildGround();
  applyMapTheme();
  spawnTrees(40);
  buildScenery();
  makeBorder();
  initEnemyShadowInstances();
  prewarmEffectTextures();
  prewarmShaders();

  player = makePlayer();
  applyLocalPetTestUnlock();
  makeAltar();
  for (let i=0;i<4;i++) spawnEnemy();
  document.getElementById('title').style.display='flex';
  const authReady = (typeof initGameAuth==='function') ? initGameAuth() : Promise.resolve();
  showLeaderboard();
  authReady.then(()=>{
    showLeaderboard();
    updateStartFlow();
    const resolved = finishPendingAuthChoice() || applyRememberedLogin();
    if(!resolved && !selectedStartMode) openAuthChoice(false);
    scheduleWhatsNew();
  }).catch(()=>{
    updateStartFlow();
    if(!selectedStartMode) openAuthChoice(false);
    scheduleWhatsNew();
  });
  { const gb=document.getElementById('guestchoice'); if(gb) gb.onclick = chooseGuestStart; }
  { const gp=document.getElementById('googlechoice'); if(gp) gp.onclick = chooseGoogleStart; }
  { const gi=document.getElementById('startmode_guest'); if(gi) gi.onchange = ()=>selectStartMode('guest'); }
  { const go=document.getElementById('startmode_google'); if(go) go.onchange = ()=>selectStartMode('google'); }
  { const pb=document.getElementById('playbtn'); if(pb) pb.onclick = titleStartAction; }
  updateStartFlow();
  document.getElementById('nameconfirm').onclick = confirmPlayerName;
  document.getElementById('playername').addEventListener('keydown', e=>{ if(e.code==='Enter') confirmPlayerName(); });
  document.getElementById('pactnone').onclick = ()=>{ selectedPactIds=[]; setActivePacts([]); beginSelectedRun(); };
  document.getElementById('pactlast').onclick = ()=>{
    const ids=lastPactLoadout();
    if(!ids.length){ showToast('ยังไม่มีชุด Pact ล่าสุด',1.6); return; }
    selectedPactIds=ids.slice();
    buildPactSelect();
  };
  document.getElementById('pactstart').onclick = ()=>{ setActivePacts(selectedPactIds); beginSelectedRun(); };
  document.querySelectorAll('.titlemenu button[data-guide]').forEach(btn=>btn.onclick=()=>openGuide(btn.dataset.guide));
  { const lb=document.getElementById('latestbtn'); if(lb) lb.onclick = ()=>openWhatsNew(true); }
  { const rb=document.getElementById('ranktoggle'); if(rb) rb.onclick = toggleTitleRanking; const rr=document.getElementById('rankrestore'); if(rr) rr.onclick = toggleTitleRanking; }
  document.getElementById('guideclose').onclick = closeGuide;
  document.getElementById('guide').onclick = e=>{ if(e.target.id==='guide') closeGuide(); };
  { const wc=document.getElementById('whatsnewclose'); if(wc) wc.onclick = closeWhatsNew; }
  { const wn=document.getElementById('whatsnew'); if(wn) wn.onclick = e=>{ if(e.target.id==='whatsnew') closeWhatsNew(); }; }

  addEventListener('resize', onResize);
  document.getElementById('pausebtn').onclick = togglePause;
  startVersionCheck();
  applyStaticI18n();
  updateStartFlow();
  document.getElementById('shopreroll').onclick = rerollShop;
  document.getElementById('shopclose').onclick = closeShop;
  document.getElementById('skipupgrade').onclick = skipUpgrade;
  document.getElementById('homebtn').onclick = quitToTitle;
  addEventListener('wheel', (e)=>{ camDist = clamp(camDist + Math.sign(e.deltaY)*1.3, 13, 18); }, { passive:true });
  document.getElementById('resumebtn').onclick = ()=>{ if(userPaused) togglePause(); };
  document.getElementById('quitbtn').onclick = quitToTitle;
  addEventListener('keydown', (e)=>{ if(!started){ return; } keys[e.code]=true;
    resumeAudio();
    if (paused && ['Digit1','Digit2','Digit3'].includes(e.code)){
      if(document.getElementById('relicup').style.display==='flex') pickRelic(+e.code.slice(5)-1);
      else pickUpgrade(+e.code.slice(5)-1);
      e.preventDefault(); return;
    }
    if (paused && (e.code==='Digit0'||e.code==='Numpad0'||e.code==='Backspace')){ skipUpgrade(); e.preventDefault(); return; }
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if (e.code==='Space' && !e.repeat) tryDash();
    if ((e.code==='KeyP'||e.code==='Escape') && !e.repeat && !gameOver && !paused) togglePause();
    if (e.code==='KeyF' && !e.repeat){ if (document.getElementById('shop').style.display==='flex') closeShop(); else activateNearby(); }
    if (deathCinematic) return;
    if (e.code==='KeyR' && (gameOver||won)) restart();
    if (e.code==='KeyC' && (gameOver||won)){ started=false; selectedPactIds=[]; activePactIds=[]; document.getElementById('difficultyselect').style.display='none'; document.getElementById('pactselect').style.display='none'; document.getElementById('select').style.display='none'; document.getElementById('over').style.display='none'; openPlayerSetup(); }
  });
  addEventListener('keyup', (e)=>{ keys[e.code]=false; });

  clock = new THREE.Clock();
  if (IS_MOBILE) {
    composer = null;   // mobile: skip bloom post-processing for FPS
  } else try {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.28, 0.88);
    composer.addPass(bloom);
  } catch(e){ composer=null; console.warn('bloom unavailable, plain render', e); }
  renderer.setAnimationLoop(frame);
}

function onResize(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth*innerHeight>2200000 ? 1.25 : 1.5));
  renderer.setSize(innerWidth,innerHeight);
  if (composer) composer.setSize(innerWidth,innerHeight);
}

// ---------- builders ----------
function buildGround() {
  const S = 170, N = 90;
  const t = tex['px_ground'];
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.round(S/2.5), Math.round(S/2.5));   // ~2.5 world units per tile
  const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for (let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i); pos.setY(i, groundHeight(x,z)); }
  geo.computeVertexNormals();
  // bake slope shading into vertex colors so hills read (flat-top lit, slopes darker)
  const nrm=geo.attributes.normal, colors=[];
  const L=new THREE.Vector3(0.4,1,0.3).normalize();
  for (let i=0;i<nrm.count;i++){
    const d=Math.max(0, nrm.getX(i)*L.x + nrm.getY(i)*L.y + nrm.getZ(i)*L.z);
    const sh=0.55 + 0.45*d;
    colors.push(sh,sh,sh);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  ground = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map:t, vertexColors:true, fog:true }));
  scene.add(ground);
}
function buildScenery() {
  ensureBreakableTextures();
  const scatter=(key, n, h, minR, solidR)=>{
    for (let i=0;i<n;i++){
      const x=(Math.random()*2-1)*MAP_BOUND, z=(Math.random()*2-1)*MAP_BOUND;
      if (Math.hypot(x,z) < (minR||5)) continue;
      const s=billboard(key, h*(0.8+Math.random()*0.5));
      s.position.set(x, groundHeight(x,z), z); scene.add(s);
      let obstacle=null;
      if (solidR){ obstacle={ x, z, r:solidR }; obstacles.push(obstacle); }
      worldScenery.push({ spr:s, obstacle });
    }
  };
  scatter('px_rock', 20, 1.0, 6, 0.55);     // big rocks solid
  scatter('px_rock_small', 25, 0.7, 5);     // small rocks walkable
  scatter('px_grass', 140, 0.7, 4);
  scatter('px_mushroom', 30, 0.6, 5);
  scatter('px_wisp', 25, 0.5, 5);
  for (let i=0;i<45;i++){
    const x=(Math.random()*2-1)*MAP_BOUND, z=(Math.random()*2-1)*MAP_BOUND;
    if (Math.hypot(x,z) < 6) continue;
    const s=billboard(Math.random()<0.4?'px_bush_berry':'px_bush', 0.85+Math.random()*0.4);
    s.position.set(x, groundHeight(x,z), z); scene.add(s);
    worldScenery.push({ spr:s, obstacle:null });
  }
  let fl=0, guard=0;
  while (fl<100 && guard++<700){
    const cx=(Math.random()*2-1)*MAP_BOUND, cz=(Math.random()*2-1)*MAP_BOUND;
    if (Math.hypot(cx,cz) < 5) continue;
    const patch=1+(Math.random()*4|0);
    for (let j=0;j<patch && fl<100;j++){
      const x=cx+(Math.random()-0.5)*2.4, z=cz+(Math.random()-0.5)*2.4;
      if (Math.abs(x)>MAP_BOUND||Math.abs(z)>MAP_BOUND) continue;
      const s=billboard('px_flower', 0.55+Math.random()*0.25);
      s.position.set(x, groundHeight(x,z), z); scene.add(s); worldScenery.push({ spr:s, obstacle:null }); fl++;
    }
  }
  // ancient castle ruins (landmarks, sparse)
  scatter('px_ruin_rubble', 12, 0.85, 6);     // small rubble is visual-only to avoid invisible snagging
  scatter('px_ruin_wall',    6, 1.8, 8, 1.0);
  scatter('px_ruin_pillar',  5, 2.5, 7, 0.5);
  scatter('px_ruin_arch',    3, 3.0, 9);
  scatter('px_ruin_statue',  3, 2.3, 8, 0.5);
  // gravestones in little graveyard clusters
  for (let c=0;c<3;c++){
    const cx=(Math.random()*2-1)*MAP_BOUND*0.9, cz=(Math.random()*2-1)*MAP_BOUND*0.9;
    if (Math.hypot(cx,cz) < 8) continue;
    const rows=2+(Math.random()*2|0), cols=2+(Math.random()*3|0);
    for (let r=0;r<rows;r++) for (let k=0;k<cols;k++){
      const x=cx+(k-cols/2)*2.0+(Math.random()-0.5), z=cz+(r-rows/2)*2.4+(Math.random()-0.5);
      if (Math.abs(x)>MAP_BOUND||Math.abs(z)>MAP_BOUND||Math.hypot(x,z)<6) continue;
      const g=billboard('px_ruin_grave', 1.15+Math.random()*0.25);
      g.position.set(x, groundHeight(x,z), z); scene.add(g);
      const obstacle={ x, z, r:0.4 }; obstacles.push(obstacle); worldScenery.push({ spr:g, obstacle });
    }
  }
  scatterBreakables(1, 34);
}
function clearWorldScenery(){
  for(const p of worldScenery){
    if(p.spr) scene.remove(p.spr);
    if(p.obstacle){
      const idx=obstacles.indexOf(p.obstacle);
      if(idx>=0) obstacles.splice(idx,1);
    }
  }
  worldScenery.length=0;
}
function clearStageScenery(){
  for(const p of stageProps){
    if(p.spr) scene.remove(p.spr);
    if(p.obstacle){
      const idx=obstacles.indexOf(p.obstacle);
      if(idx>=0) obstacles.splice(idx,1);
    }
  }
  stageProps.length=0;
}
function pixelPropTexture(key,w,h,draw){
  if(tex[key]) return;
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,w,h);
  draw(ctx,w,h);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  tex[key]=t;
}
function ensureBreakableTextures(){
  if(tex.obj_clay_jar && tex.obj_wood_crate && tex.obj_crimson_jar && tex.obj_charred_crate) return;
  pixelPropTexture('obj_clay_jar',28,34,(c)=>{
    c.fillStyle='rgba(0,0,0,0.20)'; c.fillRect(7,29,15,3);
    c.fillStyle='#2b1612'; c.fillRect(9,7,10,3); c.fillRect(6,13,16,15); c.fillRect(9,28,10,3);
    c.fillStyle='#7a3d29'; c.fillRect(8,12,14,16); c.fillRect(11,9,8,3); c.fillRect(10,28,8,2);
    c.fillStyle='#b86239'; c.fillRect(10,13,9,14); c.fillRect(12,10,5,3);
    c.fillStyle='#e4a36a'; c.fillRect(12,12,3,4); c.fillRect(10,18,2,6);
    c.fillStyle='#4b241c'; c.fillRect(7,22,3,5); c.fillRect(19,20,2,6);
  });
  pixelPropTexture('obj_wood_crate',34,30,(c)=>{
    c.fillStyle='rgba(0,0,0,0.22)'; c.fillRect(6,27,22,3);
    c.fillStyle='#24120c'; c.fillRect(6,8,22,20);
    c.fillStyle='#5f3820'; c.fillRect(8,10,18,16);
    c.fillStyle='#9a6030'; c.fillRect(9,11,16,4); c.fillRect(9,18,16,5); c.fillRect(13,10,4,16);
    c.fillStyle='#d09755'; c.fillRect(10,12,7,2); c.fillRect(18,19,5,2);
    c.fillStyle='#33170f'; c.fillRect(7,8,20,2); c.fillRect(7,26,20,2); c.fillRect(6,9,2,18); c.fillRect(27,9,2,18);
    c.fillStyle='#2a120b'; c.fillRect(10,24,15,2); c.fillRect(22,13,2,10);
  });
  pixelPropTexture('obj_crimson_jar',30,36,(c)=>{
    c.fillStyle='rgba(0,0,0,0.22)'; c.fillRect(7,31,16,3);
    c.fillStyle='#23090a'; c.fillRect(9,8,11,4); c.fillRect(6,14,18,16); c.fillRect(10,30,10,3);
    c.fillStyle='#662020'; c.fillRect(8,13,15,17); c.fillRect(12,10,7,3);
    c.fillStyle='#b8342d'; c.fillRect(11,14,9,14); c.fillRect(13,11,4,3);
    c.fillStyle='#ff7a4f'; c.fillRect(13,15,2,5); c.fillRect(11,22,2,4);
    c.fillStyle='#3a0f12'; c.fillRect(20,19,2,7); c.fillRect(7,23,2,5);
  });
  pixelPropTexture('obj_charred_crate',36,30,(c)=>{
    c.fillStyle='rgba(0,0,0,0.26)'; c.fillRect(6,27,24,3);
    c.fillStyle='#160b08'; c.fillRect(6,8,24,20);
    c.fillStyle='#3b2015'; c.fillRect(8,10,20,16);
    c.fillStyle='#6e2d1f'; c.fillRect(9,11,18,4); c.fillRect(9,19,18,5); c.fillRect(14,10,4,17);
    c.fillStyle='#d85a2f'; c.fillRect(11,12,4,1); c.fillRect(22,20,3,1);
    c.fillStyle='#27100b'; c.fillRect(7,8,22,2); c.fillRect(7,26,22,2); c.fillRect(6,9,2,18); c.fillRect(29,9,2,18);
    c.fillStyle='#ff9a3d'; c.fillRect(25,11,2,3); c.fillRect(10,23,2,2);
  });
}
function spawnBreakable(stage,x,z,kind){
  const crimson=stage>=2;
  const key=kind==='crate' ? (crimson?'obj_charred_crate':'obj_wood_crate') : (crimson?'obj_crimson_jar':'obj_clay_jar');
  const h=kind==='crate' ? 0.72 : 0.82;
  const spr=billboard(key,h*(0.9+Math.random()*0.24));
  spr.position.set(x, groundHeight(x,z), z);
  scene.add(spr);
  breakables.push({
    x,z,stage,kind,key,spr,alive:true,born:gameTime||0,
    hp:kind==='crate' ? 18 : 12,
    r:kind==='crate' ? 0.54 : 0.42,
    gold:kind==='crate' ? 2 : 1,
    xp:kind==='crate' ? 2 : 1,
    flash:0
  });
}
function scatterBreakables(stage,count){
  ensureBreakableTextures();
  let made=0, guard=0;
  while(made<count && guard++<count*35){
    const x=(Math.random()*2-1)*MAP_BOUND*0.9, z=(Math.random()*2-1)*MAP_BOUND*0.9;
    if(Math.hypot(x,z)<9 || blocked(x,z)) continue;
    const near=breakables.some(b=>b.alive && Math.hypot(b.x-x,b.z-z)<2.2);
    if(near) continue;
    spawnBreakable(stage,x,z,Math.random()<0.46?'crate':'jar');
    made++;
  }
}
function ensureStagePropTextures(){
  pixelPropTexture('map2_blood_crystal',32,44,(c)=>{
    c.fillStyle='rgba(255,52,42,0.18)'; c.fillRect(5,3,22,34);
    c.fillStyle='#4b0710'; c.fillRect(13,9,7,29); c.fillRect(9,18,15,20); c.fillRect(7,38,19,4);
    c.fillStyle='#a91524'; c.fillRect(12,12,9,25); c.fillRect(10,22,12,12);
    c.fillStyle='#ff4f3f'; c.fillRect(15,5,4,31); c.fillRect(9,18,5,17); c.fillRect(21,21,4,14);
    c.fillStyle='#ffd0a2'; c.fillRect(16,7,2,13); c.fillRect(11,20,2,5);
    c.fillStyle='#24050a'; c.fillRect(8,41,17,3);
  });
  pixelPropTexture('map2_ember_spire',28,54,(c)=>{
    c.fillStyle='rgba(255,106,35,0.15)'; c.fillRect(4,5,20,42);
    c.fillStyle='#2a0908'; c.fillRect(9,14,10,37); c.fillRect(6,47,17,4);
    c.fillStyle='#5d1810'; c.fillRect(11,11,9,36);
    c.fillStyle='#b63819'; c.fillRect(13,8,6,32); c.fillRect(9,26,12,8);
    c.fillStyle='#ffb13b'; c.fillRect(14,3,4,23); c.fillRect(12,30,3,7);
    c.fillStyle='#fff0a5'; c.fillRect(15,5,2,10);
  });
  pixelPropTexture('map2_bone_totem',30,42,(c)=>{
    c.fillStyle='rgba(255,196,122,0.12)'; c.fillRect(5,5,20,30);
    c.fillStyle='#31110c'; c.fillRect(13,13,4,24); c.fillRect(7,35,16,4);
    c.fillStyle='#d7c09b'; c.fillRect(9,7,12,8); c.fillRect(7,18,16,4); c.fillRect(8,27,14,4);
    c.fillStyle='#fff1cf'; c.fillRect(11,8,3,5); c.fillRect(17,8,3,5); c.fillRect(10,19,9,2);
    c.fillStyle='#7d2118'; c.fillRect(12,15,7,3); c.fillRect(14,24,4,3);
  });
  pixelPropTexture('map2_crimson_brazier',34,34,(c)=>{
    c.fillStyle='rgba(255,74,38,0.22)'; c.fillRect(5,2,24,20);
    c.fillStyle='#1d0a09'; c.fillRect(8,19,18,5); c.fillRect(12,24,3,8); c.fillRect(20,24,3,8); c.fillRect(9,31,16,2);
    c.fillStyle='#6b2014'; c.fillRect(10,17,14,4);
    c.fillStyle='#ff6a23'; c.fillRect(13,9,4,9); c.fillRect(18,5,5,13); c.fillRect(10,12,4,7);
    c.fillStyle='#ffe179'; c.fillRect(15,10,2,5); c.fillRect(20,7,2,6);
  });
  pixelPropTexture('map2_lava_crack',42,18,(c)=>{
    c.fillStyle='rgba(255,76,26,0.16)'; c.fillRect(4,5,34,8);
    c.fillStyle='#2b0809'; c.fillRect(5,8,9,3); c.fillRect(13,6,8,4); c.fillRect(20,9,9,3); c.fillRect(29,6,7,3);
    c.fillStyle='#ff5b24'; c.fillRect(8,9,5,1); c.fillRect(15,8,8,1); c.fillRect(23,10,5,1); c.fillRect(30,7,4,1);
    c.fillStyle='#ffd278'; c.fillRect(17,8,3,1); c.fillRect(31,7,2,1);
  });
  pixelPropTexture('map2_blood_root',34,36,(c)=>{
    c.fillStyle='rgba(184,20,32,0.10)'; c.fillRect(5,9,24,20);
    c.fillStyle='#2b090d'; c.fillRect(15,8,5,23); c.fillRect(7,27,22,3);
    c.fillStyle='#6e1420'; c.fillRect(12,13,4,13); c.fillRect(20,15,4,11); c.fillRect(9,23,4,6); c.fillRect(24,23,4,5);
    c.fillStyle='#ff584c'; c.fillRect(16,10,2,8); c.fillRect(13,16,2,5); c.fillRect(21,18,2,5);
  });
  pixelPropTexture('map3_void_obelisk',30,58,(c)=>{
    c.fillStyle='rgba(116,86,255,0.18)'; c.fillRect(5,4,20,44);
    c.fillStyle='#080716'; c.fillRect(10,14,10,38); c.fillRect(7,50,16,5);
    c.fillStyle='#21114d'; c.fillRect(12,10,9,39);
    c.fillStyle='#5d48ff'; c.fillRect(14,6,5,34); c.fillRect(11,25,12,5);
    c.fillStyle='#9ff7ff'; c.fillRect(15,9,2,18); c.fillRect(13,27,8,1);
    c.fillStyle='#05030c'; c.fillRect(8,54,17,3);
  });
  pixelPropTexture('map3_rift_crystal',34,46,(c)=>{
    c.fillStyle='rgba(75,219,255,0.16)'; c.fillRect(5,4,24,34);
    c.fillStyle='#09091d'; c.fillRect(14,12,7,28); c.fillRect(9,38,18,4);
    c.fillStyle='#2546a8'; c.fillRect(12,17,12,21);
    c.fillStyle='#54d8ff'; c.fillRect(16,7,4,29); c.fillRect(9,23,5,13); c.fillRect(23,20,5,15);
    c.fillStyle='#e8feff'; c.fillRect(17,9,2,12); c.fillRect(25,22,1,5);
  });
  pixelPropTexture('map3_rune_shard',32,30,(c)=>{
    c.fillStyle='rgba(178,111,255,0.18)'; c.fillRect(5,7,22,16);
    c.fillStyle='#080712'; c.fillRect(10,12,12,12); c.fillRect(7,24,18,2);
    c.fillStyle='#2d1b62'; c.fillRect(12,9,11,14);
    c.fillStyle='#bc76ff'; c.fillRect(15,11,2,9); c.fillRect(12,16,9,2);
    c.fillStyle='#7ff7ff'; c.fillRect(18,13,2,2);
  });
  pixelPropTexture('map3_void_torch',28,44,(c)=>{
    c.fillStyle='rgba(104,214,255,0.16)'; c.fillRect(4,3,20,25);
    c.fillStyle='#070711'; c.fillRect(12,16,4,24); c.fillRect(8,39,13,3); c.fillRect(9,14,11,4);
    c.fillStyle='#3a2c92'; c.fillRect(10,13,9,4);
    c.fillStyle='#36dcff'; c.fillRect(12,5,4,11); c.fillRect(16,8,3,8);
    c.fillStyle='#f5feff'; c.fillRect(13,6,2,5);
  });
  pixelPropTexture('map3_chain_pylon',36,42,(c)=>{
    c.fillStyle='rgba(100,80,210,0.10)'; c.fillRect(5,8,26,25);
    c.fillStyle='#080711'; c.fillRect(8,27,6,11); c.fillRect(23,27,6,11); c.fillRect(7,37,23,3);
    c.fillStyle='#30206a'; c.fillRect(10,13,4,14); c.fillRect(24,13,4,14);
    c.fillStyle='#806cff'; c.fillRect(13,15,4,3); c.fillRect(17,18,4,3); c.fillRect(21,21,4,3);
    c.fillStyle='#77eaff'; c.fillRect(11,11,2,5); c.fillRect(25,11,2,5);
  });
  pixelPropTexture('map3_star_rift',42,32,(c)=>{
    c.fillStyle='rgba(64,216,255,0.15)'; c.fillRect(5,6,32,19);
    c.fillStyle='#090817'; c.fillRect(9,15,23,5);
    c.fillStyle='#4b38cc'; c.fillRect(12,13,16,3); c.fillRect(15,18,18,3);
    c.fillStyle='#65e9ff'; c.fillRect(16,14,13,2); c.fillRect(11,17,8,2); c.fillRect(26,19,5,1);
    c.fillStyle='#ffffff'; c.fillRect(21,14,2,2); c.fillRect(15,17,1,1); c.fillRect(30,19,1,1);
  });
}
function buildStageScenery(stage){
  clearStageScenery();
  if(stage<2) return;
  ensureStagePropTextures();
  if(stage===2) scatterBreakables(2, 26);
  const options=stage>=3 ? [
    {key:'map3_shard', h:2.5, solid:0.42, weight:0.10},
    {key:'map3_obelisk', h:2.9, solid:0.42, weight:0.09},
    {key:'map3_crystal', h:1.75, weight:0.12},
    {key:'map3_void_obelisk', h:3.1, solid:0.44, weight:0.10},
    {key:'map3_rift_crystal', h:1.95, weight:0.16},
    {key:'map3_rune_shard', h:1.15, weight:0.17},
    {key:'map3_void_torch', h:1.8, weight:0.11},
    {key:'map3_chain_pylon', h:1.7, weight:0.07},
    {key:'map3_star_rift', h:0.82, weight:0.07},
    {key:'map3_rift_arch', h:2.65, weight:0.07},
    {key:'map3_void_lantern', h:2.15, weight:0.08}
  ] : [
    {key:'map2_rock', h:2.15, solid:0.46, weight:0.10},
    {key:'map2_pillar', h:2.65, solid:0.38, weight:0.08},
    {key:'map2_crystal', h:1.55, weight:0.14},
    {key:'map2_blood_crystal', h:1.95, weight:0.13},
    {key:'map2_ember_spire', h:2.25, weight:0.11},
    {key:'map2_bone_totem', h:1.7, weight:0.09},
    {key:'map2_crimson_brazier', h:1.25, weight:0.10},
    {key:'map2_lava_crack', h:0.55, weight:0.10},
    {key:'map2_blood_root', h:1.45, weight:0.08},
    {key:'map2_altar_shard', h:1.65, weight:0.08},
    {key:'map2_skull_brazier', h:1.42, weight:0.09}
  ];
  const pick=()=>{
    const total=options.reduce((sum,opt)=>sum+opt.weight,0);
    let r=Math.random()*total;
    for(const opt of options){ r-=opt.weight; if(r<=0) return opt; }
    return options[options.length-1];
  };
  const avoidRadius=stage>=3 ? 18 : 10;
  const canPlace=(x,z,choice)=>Math.abs(x)<MAP_BOUND*0.95 && Math.abs(z)<MAP_BOUND*0.95 && Math.hypot(x,z)>avoidRadius && (!choice.solid || !blocked(x,z));
  const addProp=(x,z,choice)=>{
    if(!canPlace(x,z,choice)) return false;
    const spr=billboard(choice.key, choice.h*(0.82+Math.random()*0.38));
    spr.position.set(x, groundHeight(x,z), z);
    scene.add(spr);
    const obstacle=choice.solid ? {x,z,r:choice.solid} : null;
    if(obstacle) obstacles.push(obstacle);
    stageProps.push({spr, obstacle});
    return true;
  };
  let placed=0;
  const clusterCount=stage>=3 ? 18 : 15;
  const clusterSize=stage>=3 ? 5 : 4;
  for(let i=0;i<clusterCount;i++){
    const angle=(i/clusterCount)*Math.PI*2+Math.random()*0.35;
    const dist=(stage>=3 ? 23 : 15)+Math.random()*(stage>=3 ? 43 : 48);
    const cx=Math.cos(angle)*dist, cz=Math.sin(angle)*dist;
    for(let j=0;j<clusterSize;j++){
      const a=Math.random()*Math.PI*2, d=Math.random()*(stage>=3 ? 5.2 : 6.4);
      if(addProp(cx+Math.cos(a)*d, cz+Math.sin(a)*d, pick())) placed++;
    }
  }
  const ringCount=stage>=3 ? 38 : 28;
  for(let i=0;i<ringCount;i++){
    const angle=(i/ringCount)*Math.PI*2+Math.random()*0.08;
    const dist=(stage>=3 ? 28 : 20)+(i%3)*10+Math.random()*4;
    if(addProp(Math.cos(angle)*dist, Math.sin(angle)*dist, pick())) placed++;
  }
  if(stage>=3){
    const landmarks=['map3_void_obelisk','map3_chain_pylon','map3_void_torch','map3_rift_crystal'];
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2;
      const key=landmarks[i%landmarks.length];
      const choice=options.find(opt=>opt.key===key) || pick();
      if(addProp(Math.cos(a)*38, Math.sin(a)*38, choice)) placed++;
    }
  }
  let guard=0;
  const target=stage>=3 ? 175 : 140;
  while(placed<target && guard++<1100){
    const x=(Math.random()*2-1)*MAP_BOUND*0.92, z=(Math.random()*2-1)*MAP_BOUND*0.92;
    const choice=pick();
    if(addProp(x,z,choice)) placed++;
  }
}

function billboard(key, height) {
  const mat = new THREE.SpriteMaterial({ map: tex[key], transparent:true, alphaTest:0.4, depthWrite:true });
  const s = new THREE.Sprite(mat);
  const ar = tex[key] ? (tex[key].image.width / tex[key].image.height) : 1;
  s.center.set(0.5, 0);              // pivot at feet
  s.scale.set(height*ar, height, 1);
  return s;
}
function ensureMagnetPillarTexture(){
  if (tex.obj_magnet_pillar) return;
  const cv=document.createElement('canvas'); cv.width=32; cv.height=48;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,32,48);
  ctx.fillStyle='rgba(18,10,28,0.95)'; ctx.fillRect(9,12,14,31);
  ctx.fillStyle='#2d2144'; ctx.fillRect(7,40,18,5); ctx.fillRect(10,9,12,5);
  ctx.fillStyle='#5f4f86'; ctx.fillRect(12,14,8,25);
  ctx.fillStyle='#b8fff2'; ctx.fillRect(14,4,4,18); ctx.fillRect(8,12,16,3);
  ctx.fillStyle='#52e7d1'; ctx.fillRect(15,5,2,16); ctx.fillRect(9,13,14,1);
  ctx.fillStyle='rgba(82,231,209,0.42)'; ctx.fillRect(5,8,22,2); ctx.fillRect(3,19,26,2); ctx.fillRect(6,30,20,2);
  ctx.fillStyle='#fffbd0'; ctx.fillRect(15,7,2,5);
  ctx.fillStyle='rgba(120,255,230,0.28)'; ctx.fillRect(2,6,28,28);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  tex.obj_magnet_pillar=t;
}

function initEnemyShadowInstances(){
  enemyShadowMesh = new THREE.InstancedMesh(ENEMY_SHADOW_GEO, SHADOW_MAT, ENEMY_SHADOW_CAP);
  enemyShadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  enemyShadowMesh.count = 0;
  enemyShadowMesh.frustumCulled = false;
  enemyShadowDummy = new THREE.Object3D();
  scene.add(enemyShadowMesh);
}
function makeShadow(r){ const m=new THREE.Mesh(SHADOW_GEO, SHADOW_MAT); m.rotation.x=-Math.PI/2; m.scale.set(r,r,r); return m; }
function makeEnemyShadow(r){ return { _instancedShadow:true, r:r||0.32, visible:true }; }
function removeShadow(sh){
  if(!sh) return;
  if(sh._instancedShadow){ sh.visible=false; return; }
  scene.remove(sh);
  freeObj(sh);
}
function updateEnemyShadowInstances(){
  if(!enemyShadowMesh || !enemyShadowDummy) return;
  let idx=0;
  for(const e of enemies){
    const sh=e.sh;
    if(!e.alive || !sh || !sh._instancedShadow || sh.visible===false) continue;
    if(idx>=ENEMY_SHADOW_CAP) break;
    const y=groundHeight(e.x,e.z)+0.02;
    const s=sh.r||e.r||0.32;
    enemyShadowDummy.position.set(e.x,y,e.z);
    enemyShadowDummy.rotation.set(0,0,0);
    enemyShadowDummy.scale.set(s,s,s);
    enemyShadowDummy.updateMatrix();
    enemyShadowMesh.setMatrixAt(idx++, enemyShadowDummy.matrix);
  }
  if(enemyShadowMesh.count>idx){
    enemyShadowDummy.position.set(0,-9999,0);
    enemyShadowDummy.scale.set(0,0,0);
    enemyShadowDummy.updateMatrix();
    for(let i=idx;i<enemyShadowMesh.count;i++) enemyShadowMesh.setMatrixAt(i, enemyShadowDummy.matrix);
  }
  enemyShadowMesh.count=idx;
  enemyShadowMesh.instanceMatrix.needsUpdate=true;
}
function clearEnemyShadowInstances(){
  if(!enemyShadowMesh) return;
  enemyShadowMesh.count=0;
  enemyShadowMesh.instanceMatrix.needsUpdate=true;
}
function makePlayerHealthBar(){
  const g=new THREE.Group();
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({ color:0x0b0610, transparent:true, opacity:0.78, depthTest:false, depthWrite:false }));
  bg.scale.set(1.34,0.16,1); bg.renderOrder=20; g.add(bg);
  const fill=new THREE.Sprite(new THREE.SpriteMaterial({ color:0x58e070, transparent:true, opacity:0.95, depthTest:false, depthWrite:false }));
  fill.center.set(0,0.5); fill.position.x=-0.59; fill.scale.set(1.18,0.08,1); fill.renderOrder=21; g.add(fill);
  g.visible=false; g.userData={ fill };
  scene.add(g); return g;
}
const entityAuraTextures=new Map();
function getEntityAuraTexture(kind){
  if(entityAuraTextures.has(kind)) return entityAuraTextures.get(kind);
  if(kind==='boss' && tex.fx_boss_aura_gen) return tex.fx_boss_aura_gen;
  if(kind==='miniboss' && tex.fx_miniboss_aura_gen) return tex.fx_miniboss_aura_gen;
  if(kind==='object' && tex.fx_shrine_glow_gen) return tex.fx_shrine_glow_gen;
  const cv=document.createElement('canvas'); cv.width=64; cv.height=64;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const cx=32, cy=32;
  if(kind==='boss'){
    ctx.strokeStyle='rgba(255,255,255,0.95)';
    ctx.lineWidth=3;
    for(let i=0;i<20;i++){
      const a=(i/20)*Math.PI*2;
      const r=25+(i%2)*3;
      const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
      ctx.fillStyle=i%2?'rgba(255,255,255,0.75)':'rgba(255,255,255,0.45)';
      ctx.fillRect(Math.round(x)-1,Math.round(y)-1,3,3);
    }
    ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth=1; ctx.beginPath(); ctx.arc(cx,cy,15,0,Math.PI*2); ctx.stroke();
  } else {
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.fillRect(30,8,4,48);
    ctx.fillRect(8,30,48,4);
    ctx.fillRect(20,20,24,24);
    ctx.globalAlpha=0.45;
    ctx.fillRect(27,13,10,38);
    ctx.fillRect(13,27,38,10);
    ctx.globalAlpha=0.22;
    ctx.fillRect(24,6,16,52);
    ctx.fillRect(6,24,52,16);
  }
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  entityAuraTextures.set(kind,t); return t;
}
function makeBossAura(color, rad, final){
  const g=new THREE.Group();
  const geo=new THREE.PlaneGeometry(rad*3.6,rad*3.6); geo.rotateX(-Math.PI/2);
  const auraKey=final?'boss':'miniboss';
  const outer=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map:getEntityAuraTexture(auraKey), color, transparent:true, opacity:final?0.76:0.58,
    alphaTest:0.06, side:THREE.DoubleSide, depthWrite:false
  }));
  outer.position.y=0.06; g.add(outer);
  const inner=new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
    map:getEntityAuraTexture(auraKey), color:0xffffff, transparent:true, opacity:final?0.22:0.14,
    alphaTest:0.08, side:THREE.DoubleSide, depthWrite:false
  }));
  inner.scale.setScalar(0.62); inner.position.y=0.08; inner.rotation.z=Math.PI/8; g.add(inner);
  scene.add(g); return g;
}
function makeObjectGlow(color, rad, type){
  const g=new THREE.Group();
  const base=type==='chest'?1.0:type==='shrine'?1.2:1.08;
  const geo=new THREE.PlaneGeometry(rad*2.4*base,rad*2.4*base); geo.rotateX(-Math.PI/2);
  const glowTex=type==='chest'&&tex.fx_item_glow_gen?tex.fx_item_glow_gen:
                type==='magnet_pillar'&&tex.fx_item_glow_gen?tex.fx_item_glow_gen:
                type==='portal'&&tex.fx_portal_pulse_gen?tex.fx_portal_pulse_gen:
                type==='shrine'&&tex.fx_shrine_glow_gen?tex.fx_shrine_glow_gen:
                getEntityAuraTexture('object');
  const foot=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map:glowTex, color, transparent:true,
    opacity:type==='chest'?0.34:0.42, alphaTest:0.05, side:THREE.DoubleSide,
    depthWrite:false, blending:THREE.AdditiveBlending
  }));
  foot.position.y=0.045; g.add(foot);
  const core=new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
    map:glowTex, color:0xffffff, transparent:true,
    opacity:type==='chest'?0.10:0.16, alphaTest:0.08, side:THREE.DoubleSide,
    depthWrite:false, blending:THREE.AdditiveBlending
  }));
  core.scale.setScalar(0.46); core.position.y=0.065; core.rotation.z=Math.PI/4; g.add(core);
  scene.add(g); return g;
}

const lootBeaconTextures=new Map();
function getLootBeaconTexture(color){
  if(lootBeaconTextures.has(color)) return lootBeaconTextures.get(color);
  const cv=document.createElement('canvas'); cv.width=8; cv.height=32;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const c=new THREE.Color(color), mid='#'+c.getHexString(), light='#'+c.clone().lerp(new THREE.Color(0xffffff),0.72).getHexString();
  ctx.fillStyle=mid; ctx.globalAlpha=0.18; ctx.fillRect(1,2,6,29);
  ctx.globalAlpha=0.48; ctx.fillRect(2,5,4,25);
  ctx.globalAlpha=0.9; ctx.fillStyle=light; ctx.fillRect(3,8,2,20);
  ctx.globalAlpha=1; ctx.fillRect(2,2,4,3); ctx.fillRect(1,0,2,2); ctx.fillRect(5,0,2,2);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  lootBeaconTextures.set(color,t); return t;
}
function makeLootBeacon(color,tier,type){
  const map=type==='magnet_pillar'&&tex.fx_magnet_beacon_gen?tex.fx_magnet_beacon_gen:
            type==='chest'&&tex.fx_chest_beacon_gen?tex.fx_chest_beacon_gen:
            tex.fx_loot_sparkle_gen || getLootBeaconTexture(color);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({
    map, color:0xffffff, transparent:true, opacity:0.72,
    alphaTest:0.04, depthWrite:false
  }));
  const ar=map && map.image ? map.image.width/map.image.height : 1;
  s.center.set(0.5,0); s.scale.set((0.36+tier*0.07)*ar,2.0+tier*0.35,1);
  scene.add(s); return s;
}

// ---- Sprite-sheet walk animations ----
// Horizontal strip: N frames in a row. Drop the PNG in assets/sprites/, add it
// to MANIFEST, and list it here as baseSpriteKey -> {sheet, frames, fps}.
// Until the sheet image loads, the entity uses its single static sprite.
const WALK_SHEETS = { 'enemy_abyssal_horror':{sheet:'enemy_abyssal_horror_walk',frames:4,fps:7}, 'enemy_blight_treant':{sheet:'enemy_blight_treant_walk',frames:4,fps:7}, 'enemy_bog_elemental':{sheet:'enemy_bog_elemental_walk',frames:4,fps:7}, 'enemy_bog_fiend':{sheet:'enemy_bog_fiend_walk',frames:4,fps:7}, 'enemy_bone_stalker':{sheet:'enemy_bone_stalker_walk',frames:4,fps:7}, 'enemy_chaos_wisp':{sheet:'enemy_chaos_wisp_walk',frames:4,fps:7}, 'enemy_crypt_spider':{sheet:'enemy_crypt_spider_walk',frames:4,fps:7}, 'enemy_cursed_knight':{sheet:'enemy_cursed_knight_walk',frames:4,fps:7}, 'enemy_dark_apostle':{sheet:'enemy_dark_apostle_walk',frames:4,fps:7}, 'enemy_dire_bat':{sheet:'enemy_dire_bat_walk',frames:4,fps:7}, 'enemy_fen_stalker':{sheet:'enemy_fen_stalker_walk',frames:4,fps:7}, 'enemy_grave_robber':{sheet:'enemy_grave_robber_walk',frames:4,fps:7}, 'enemy_leech_swarm':{sheet:'enemy_leech_swarm_walk',frames:4,fps:7}, 'enemy_marsh_lurker':{sheet:'enemy_marsh_lurker_walk',frames:4,fps:7}, 'enemy_muck_slime':{sheet:'enemy_muck_slime_walk',frames:4,fps:7}, 'enemy_nether_drake':{sheet:'enemy_nether_drake_walk',frames:4,fps:7}, 'enemy_oblivion_orb':{sheet:'enemy_oblivion_orb_walk',frames:4,fps:7}, 'enemy_plague_rat':{sheet:'enemy_plague_rat_walk',frames:4,fps:7}, 'enemy_rift_phantom':{sheet:'enemy_rift_phantom_walk',frames:4,fps:7}, 'enemy_rot_hound':{sheet:'enemy_rot_hound_walk',frames:4,fps:7}, 'enemy_shade':{sheet:'enemy_shade_walk',frames:4,fps:7}, 'enemy_shadow_weaver':{sheet:'enemy_shadow_weaver_walk',frames:4,fps:7}, 'enemy_swamp_witch':{sheet:'enemy_swamp_witch_walk',frames:4,fps:7}, 'enemy_toxic_spore':{sheet:'enemy_toxic_spore_walk',frames:4,fps:7}, 'enemy_void_reaper':{sheet:'enemy_void_reaper_walk',frames:4,fps:7}, 'enemy_void_walker':{sheet:'enemy_void_walker_walk',frames:4,fps:7}, 'enemy_willow_wisp':{sheet:'enemy_willow_wisp_walk',frames:4,fps:7}, 'enemy_wraith':{sheet:'enemy_wraith_walk',frames:4,fps:7}, 'miniboss_colossus':{sheet:'miniboss_colossus_walk',frames:4,fps:7}, 'miniboss_executioner':{sheet:'miniboss_executioner_walk',frames:4,fps:7}, 'miniboss_horror':{sheet:'miniboss_horror_walk',frames:4,fps:7}, 'miniboss_skeleton_lord':{sheet:'miniboss_skeleton_lord_walk',frames:4,fps:7}, 'miniboss_troll':{sheet:'miniboss_troll_walk',frames:4,fps:7}, 'miniboss_warden':{sheet:'miniboss_warden_walk',frames:4,fps:7} };  // enemy 4-frame walk strips
const DIR_SHEETS = { 'enemy_shade':{key:'enemy_shade_8dir',cols:1,rows:8,fps:1},'enemy_bone_stalker':{key:'enemy_bone_stalker_8dir',cols:1,rows:8,fps:1},'enemy_wraith':{key:'enemy_wraith_8dir',cols:1,rows:8,fps:1},'enemy_dire_bat':{key:'enemy_dire_bat_8dir',cols:1,rows:8,fps:1},'enemy_rot_hound':{key:'enemy_rot_hound_8dir',cols:1,rows:8,fps:1},'enemy_cursed_knight':{key:'enemy_cursed_knight_8dir',cols:1,rows:8,fps:1},'enemy_plague_rat':{key:'enemy_plague_rat_8dir',cols:1,rows:8,fps:1},'enemy_marsh_lurker':{key:'enemy_marsh_lurker_8dir',cols:1,rows:8,fps:1},'enemy_swamp_witch':{key:'enemy_swamp_witch_8dir',cols:1,rows:8,fps:1},'enemy_crypt_spider':{key:'enemy_crypt_spider_8dir',cols:1,rows:8,fps:1},'enemy_bog_fiend':{key:'enemy_bog_fiend_8dir',cols:1,rows:8,fps:1},'enemy_leech_swarm':{key:'enemy_leech_swarm_8dir',cols:1,rows:8,fps:1},'enemy_willow_wisp':{key:'enemy_willow_wisp_8dir',cols:1,rows:8,fps:1},'enemy_fen_stalker':{key:'enemy_fen_stalker_8dir',cols:1,rows:8,fps:1},'enemy_blight_treant':{key:'enemy_blight_treant_8dir',cols:1,rows:8,fps:1},'enemy_muck_slime':{key:'enemy_muck_slime_8dir',cols:1,rows:8,fps:1},'enemy_bog_elemental':{key:'enemy_bog_elemental_8dir',cols:1,rows:8,fps:1},'enemy_void_walker':{key:'enemy_void_walker_8dir',cols:1,rows:8,fps:1},'enemy_abyssal_horror':{key:'enemy_abyssal_horror_8dir',cols:1,rows:8,fps:1},'enemy_nether_drake':{key:'enemy_nether_drake_8dir',cols:1,rows:8,fps:1},'enemy_rift_phantom':{key:'enemy_rift_phantom_8dir',cols:1,rows:8,fps:1},'enemy_oblivion_orb':{key:'enemy_oblivion_orb_8dir',cols:1,rows:8,fps:1},'enemy_dark_apostle':{key:'enemy_dark_apostle_8dir',cols:1,rows:8,fps:1},'miniboss_executioner':{key:'miniboss_executioner_8dir',cols:1,rows:8,fps:1},'miniboss_horror':{key:'miniboss_horror_8dir',cols:1,rows:8,fps:1},'miniboss_skeleton_lord':{key:'miniboss_skeleton_lord_8dir',cols:1,rows:8,fps:1},'miniboss_troll':{key:'miniboss_troll_8dir',cols:1,rows:8,fps:1},'miniboss_warden':{key:'miniboss_warden_8dir',cols:1,rows:8,fps:1},'enemy_grave_robber':{key:'enemy_grave_robber_8dir',cols:1,rows:8,fps:1},'enemy_toxic_spore':{key:'enemy_toxic_spore_8dir',cols:1,rows:8,fps:1},'enemy_chaos_wisp':{key:'enemy_chaos_wisp_8dir',cols:1,rows:8,fps:1},'enemy_shadow_weaver':{key:'enemy_shadow_weaver_8dir',cols:1,rows:8,fps:1},'enemy_void_reaper':{key:'enemy_void_reaper_8dir',cols:1,rows:8,fps:1},'miniboss_colossus':{key:'miniboss_colossus_8dir',cols:1,rows:8,fps:1},'boss_lich':{key:'boss_lich_8dir',cols:1,rows:8,fps:1},'boss_behemoth':{key:'boss_behemoth_8dir',cols:1,rows:8,fps:1},'boss_reaper':{key:'boss_reaper_8dir',cols:1,rows:8,fps:1},'boss_dragon':{key:'boss_dragon_8dir',cols:1,rows:8,fps:1},'boss_overlord':{key:'boss_overlord_8dir',cols:1,rows:8,fps:1} };  // PixelLab 8-dir rotations
// Auto-fill DIR/WALK sheet configs from the rosters (only missing keys; guarded by tex[] at use sites).
DIR_SHEETS.boss_butcher={key:'boss_butcher_8dir',cols:1,rows:8,fps:1};
[].concat(ENEMY_TYPES, MINIBOSS_TYPES, BOSS_TYPES).forEach(t=>{ if(!DIR_SHEETS[t.sprite]) DIR_SHEETS[t.sprite]={key:t.sprite+'_8dir',cols:1,rows:8,fps:1}; });
[].concat(ENEMY_TYPES, MINIBOSS_TYPES).forEach(t=>{ if(!WALK_SHEETS[t.sprite]) WALK_SHEETS[t.sprite]={sheet:t.sprite+'_walk',frames:4,fps:7}; });
// 8-direction grid sheets: rows = direction, cols = animation frame.
// dirRows maps movement direction index -> sheet row.
// dir index: 0=S 1=SE 2=E 3=NE 4=N 5=NW 6=W 7=SW  (matches PixelLab row order here)
const SHEETS = {
  player: {
    walk: { key:'player_walk', cols:6, rows:8, fps:10 },
    idle: { key:'player_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  sorceress: {
    walk: { key:'char_sorceress_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_sorceress_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  templar: {
    walk: { key:'char_templar_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_templar_idle', cols:4, rows:8, fps:6 },
    visible: { w:0.74, h:1.38 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  necromancer: {
    walk: { key:'char_necromancer_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_necromancer_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  slayer: {
    walk: { key:'char_slayer_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_slayer_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  huntress: {
    walk: { key:'char_huntress_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_huntress_idle', cols:5, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  ranger: {
    walk: { key:'char_ranger_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_ranger_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  priestess: {
    walk: { key:'char_priestess_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_priestess_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  stormcaller: {
    walk: { key:'char_stormcaller_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_stormcaller_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  assassin: {
    walk: { key:'char_assassin_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_assassin_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  it_support: {
    walk: { key:'char_it_support_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_it_support_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  striker: {
    walk: { key:'char_striker_walk', cols:8, rows:8, fps:10 },
    idle: { key:'char_striker_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
};

// ---- Playable characters: signature weapon + base stats + per-level passive ----
// (add SHEETS.<sheet> entries when the char_<key>_walk/idle sheets exist; falls back to paladin art)
const CHARACTERS = {
  paladin:     { name:'Paladin',     sheet:'player',      weapon:'shieldtoss',
                 stats:{ spd:4.0, rateMul:0.85 }, passive:{ desc:'เกราะ +2 / Lv (แทงค์หนัก เดินช้า ตีช้า)', apply:p=>{ p.def += 2; } } },
  huntress:    { name:'Huntress',    sheet:'huntress',    weapon:'spread',
                 stats:{ maxHp:70, spd:5.8 }, passive:{ desc:'ความเร็วโจมตี +1%, ดาเมจ +1% / Lv', apply:p=>{ p.rateMul *= 1.01; p.dmgMul *= 1.01; } } },
  sorceress:   { name:'Sorceress',   sheet:'sorceress',   weapon:'nova',
                 stats:{ maxHp:65 }, passive:{ desc:'ดาเมจ +2% / Lv', apply:p=>{ p.dmgMul *= 1.02; } } },
  templar:     { name:'Oathbone',    sheet:'templar',     weapon:'orbit',
                 stats:{ maxHp:110, spd:5.2, def:7 }, passive:{ desc:'ดาเมจ +1%, เลือดสูงสุด +4 / Lv', apply:p=>{ p.dmgMul *= 1.01; p.maxHp += 4; p.hp += 4; } } },
  ranger:      { name:'Ranger',      sheet:'ranger',      weapon:'arrow',
                 stats:{ maxHp:75, spd:5.6, magnet:4.4 }, passive:{ desc:'ความเร็วเดิน +1%, ความเร็วโจมตี +1% / Lv', apply:p=>{ p.spd *= 1.01; p.rateMul *= 1.01; } } },
  necromancer: { name:'Necromancer', sheet:'necromancer', weapon:'soulspiral',
                 stats:{ maxHp:75 }, passive:{ desc:'XP ที่ได้รับ +3% / Lv', apply:p=>{ p.xpMul *= 1.03; } } },
  slayer:      { name:'Slayer',      sheet:'slayer',      weapon:'bladewhirl',
                 stats:{ maxHp:75 }, passive:{ desc:'ดาเมจ +2.5% / Lv', apply:p=>{ p.dmgMul *= 1.025; } } },
  priestess:   { name:'Priestess',   sheet:'priestess',   weapon:'smite',
                 stats:{ maxHp:95, regen:0.4 }, passive:{ desc:'ฟื้นเลือด +0.3 และฮีล / Lv', apply:p=>{ p.regen += 0.3; p.hp=Math.min(healCap(p),p.hp+scaledHeal(10)); } } },
  stormcaller: { name:'Stormcaller', sheet:'stormcaller', weapon:'lightning', portrait:'stormcaller',
                 stats:{ maxHp:70, critChance:0.08 }, passive:{ desc:'ดาเมจคริติคอล +5% / Lv', apply:p=>{ p.critDmg += 0.05; } } },
  assassin:    { name:'Assassin',    sheet:'assassin',    weapon:'dagger', portrait:'assassin',
                 stats:{ maxHp:65, spd:5.9, critChance:0.12 }, passive:{ desc:'โอกาสคริติคอล +1%, หลบหลีก +0.5% / Lv', apply:p=>{ p.critChance += 0.01; p.evade=(p.evade||0)+0.005; } } },
  it_support:  { name:'IT Support',  sheet:'it_support', weapon:'toolstab', portrait:'it_support',
                 stats:{ maxHp:78, spd:5.5, magnet:3.6, critChance:0.07 }, passive:{ desc:'ขนาดสกิล +1%, ระยะสกิล +1% / Lv', apply:p=>{ p.projScale *= 1.01; p.rangeMul *= 1.01; } } },
  striker:     { name:'Striker',     sheet:'striker',     weapon:'football', portrait:'striker',
                 stats:{ maxHp:76, spd:5.7, magnet:3.4, critChance:0.06 }, passive:{ desc:'ความเร็วเดิน +0.5%, ความเร็วกระสุน/วัตถุโจมตี +2% / Lv', apply:p=>{ p.spd *= 1.005; p.projSpeedMul *= 1.02; } } },
};
Object.assign(CHARACTERS.templar, {
  stats:{ maxHp:116, spd:5.0, def:8, rateMul:1.08 },
  passive:{ desc:'ดาเมจ +1%, เลือด +4 / Lv', apply:p=>{ p.dmgMul *= 1.01; p.maxHp += 4; p.hp += 4; } }
});
Object.assign(CHARACTERS.paladin, {
  bio:'นักรบศักดิ์สิทธิ์ที่ให้อภัยทุกคน ยกเว้นตอน cooldown พร้อม',
  quips:{ start:['ความยุติธรรมออนไลน์แล้ว'], level:['ศรัทธาอัปเดตแพตช์ใหม่'], hurt:['เกราะรับไว้แล้ว ใจยังรับไม่ไหว'] }
});
Object.assign(CHARACTERS.huntress, {
  bio:'ตามรอยมอนได้ทุกตัว แต่กุญแจบ้านตัวเองยังหาไม่เจอ',
  quips:{ start:['รอยเท้านี้...น่าจะไม่ใช่ของเพื่อน'], level:['ลูกธนูเยอะขึ้น ความรับผิดชอบก็เช่นกัน'], hurt:['ใครยิงสวน ใจเย็นก่อน'] }
});
Object.assign(CHARACTERS.sorceress, {
  bio:'แก้ปัญหาด้วยระเบิดวงใหญ่ แล้วค่อยถามว่าปัญหาคืออะไร',
  quips:{ start:['อย่ายืนใกล้เกินไป ฉันก็ยังไม่ชัวร์'], level:['เวทแรงขึ้น ประกันภัยไม่ครอบคลุม'], hurt:['อันนี้เจ็บแบบมีหลักสูตร'] }
});
Object.assign(CHARACTERS.templar, {
  bio:'เกราะหนา ใจนิ่ง เดินช้า เพราะแบกทั้งศรัทธาและโลหะหนัก',
  quips:{ start:['ข้าจะยืนตรงนี้ ถ้ามอนเดินมาถึงก่อน'], level:['เกราะหนักขึ้นอีกนิด ไม่เป็นไร'], hurt:['เสียงดัง แต่ยังไม่บุบ'] }
});
Object.assign(CHARACTERS.ranger, {
  bio:'รักธรรมชาติ แต่ไม่ค่อยรักสิ่งที่วิ่งเข้าหาเขา',
  quips:{ start:['ลมดี แสงดี มอนเยอะเกินดี'], level:['ระยะเพิ่ม ใจห่างไปอีก'], hurt:['ธรรมชาติฝากตบกลับมา'] }
});
Object.assign(CHARACTERS.necromancer, {
  bio:'คุยกับวิญญาณได้ทุกคืน ข้อเสียคือบางตนถามเรื่องประกัน',
  quips:{ start:['ถ้าได้ยินเสียงแปลก ๆ ไม่ใช่บั๊ก'], level:['วิญญาณโหวตให้แรงขึ้น'], hurt:['โอเค อันนี้ยังไม่ต้องเรียกฉันกลับ'] }
});
Object.assign(CHARACTERS.slayer, {
  bio:'ไม่พูดเยอะ เพราะเวลาที่ใช้พูดเอาไปฟันได้อีกสามที',
  quips:{ start:['พูดน้อย ฟันไว'], level:['คมขึ้นอีกนิด โลกสงบขึ้นอีกหน่อย'], hurt:['ได้ เดี๋ยวจำหน้าไว้'] }
});
Object.assign(CHARACTERS.priestess, {
  bio:'ฮีลด้วยรอยยิ้ม แล้ว smite คนที่ไม่ขอบคุณอย่างสุภาพ',
  quips:{ start:['พรมาแล้ว ใบเสร็จตามทีหลัง'], level:['ศักดิ์สิทธิ์ขึ้นแบบมี service charge'], hurt:['ขอเวลาฮีลใจหนึ่งวิ'] }
});
Object.assign(CHARACTERS.stormcaller, {
  bio:'เรียกฟ้าผ่าได้แม่นมาก ยกเว้นตอนต้องชาร์จมือถือจริง ๆ',
  quips:{ start:['พยากรณ์วันนี้ มีโอกาสฟ้าผ่า 100%'], level:['เมฆอนุมัติแล้ว'], hurt:['ใครลัดวงจรฉัน'] }
});
Object.assign(CHARACTERS.assassin, {
  bio:'หายตัวเก่งจนเพื่อนร่วมทีมลืมแบ่ง loot ให้เป็นประจำ',
  quips:{ start:['ถ้าไม่เห็นฉัน แปลว่าทำงานอยู่'], level:['คมขึ้น เงียบขึ้น น่าสงสัยขึ้น'], hurt:['เห็นเมื่อกี้ไหม ไม่เห็นก็ดี'] }
});
Object.assign(CHARACTERS.it_support, {
  bio:'ถูกเรียกตอนระบบล่มเสมอ และถามบอสว่า ลอง Restart หรือยังครับ?',
  quips:{
    start:['ลอง Restart หรือยังครับ?','ถ้าระบบล่ม ใจเราต้องไม่ล่ม','Ticket นี้ไม่มีรายละเอียดอีกแล้วสินะ'],
    level:['อัปแพตช์เรียบร้อย กรุณาอย่าถามว่าแก้อะไร','เพิ่ม RAM ให้สกิลแล้วครับ','สิทธิ์ admin มาแล้ว'],
    loot:['ของในกล่องดูเหมือน spare part','อันนี้เบิกแผนกได้ไหมครับ'],
    hurt:['ใคร unplug สายชีวิต','แจ้ง incident แล้วครับ','ขอ remote เข้าแผลหน่อย']
  }
});
Object.assign(CHARACTERS.striker, {
  bio:'กองหน้าทัวร์นาเมนต์ต้องสาป ผู้เอาแรงกดดันวันแข่งเข้ามาในพันธสัญญา',
  quips:{
    start:['เริ่มเขี่ยบอล อย่าฟาวล์ศพเดินได้ก็พอ','VAR บอกว่ารันนี้นับคะแนน','เก้าสิบนาทีเหรอ ผมขอแค่สิบก็พอ'],
    level:['สปีดเพิ่ม เด้งเพิ่ม ทรงผมยังพังเหมือนเดิม','โค้ชอยากครองบอล ผมเลือกความวุ่นวาย'],
    loot:['อันนี้ต้องเอาเข้าตู้ถ้วยรางวัล','โบนัสย้ายทีมฟรี'],
    hurt:['กรรมการ อันนั้นเปิดปุ่มชัด ๆ','เกมเยือนบางนัดยังหนักกว่านี้']
  }
});
let currentChar = 'paladin';
const MAX_WEAPONS = 3;   // signature + 2

const PETS = [
  { id:'lumo_wisp', name:'Lumo Wisp', title:'วิญญาณไฟหลงทาง', price:1200, icon:'LW', sprite:'pet_lumo_wisp', sheet:'pet_lumo_wisp_8dir', color:'#7ce7ff',
    desc:'ดวงไฟตัวจิ๋วลอยตามหลัง ช่วยให้โตไวขึ้นแบบนุ่ม ๆ', buff:'+6% XP gain',
    apply:p=>{ p.xpMul*=1.06; } },
  { id:'lantern_bunny', name:'Lantern Bunny', title:'กระต่ายโคมผี', price:1600, icon:'LB', sprite:'pet_lantern_bunny', sheet:'pet_lantern_bunny_8dir', color:'#ffe08a',
    desc:'ตัวเล็กถือโคมไฟ คอยส่องของที่ตกอยู่รอบตัว', buff:'+8% magnet range',
    apply:p=>{ p.magnet*=1.08; } },
  { id:'tiny_gargoyle', name:'Tiny Gargoyle', title:'การ์กอยล์ไซซ์พกพา', price:2200, icon:'TG', sprite:'pet_tiny_gargoyle', sheet:'pet_tiny_gargoyle_8dir', color:'#9fb4c8',
    desc:'หินมีปีกจอมจริงจัง เกาะตามเหมือนบอดี้การ์ดตัวน้อย', buff:'+10% armor',
    apply:p=>{ p.armorMul*=1.10; } },
  { id:'storm_pup', name:'Storm Pup', title:'ลูกหมาป่าฟ้าผ่า', price:2800, icon:'SP', sprite:'pet_storm_pup', sheet:'pet_storm_pup_8dir', color:'#9ee7ff',
    desc:'วิ่งตามพร้อมประกายไฟฟ้า ทำให้วัตถุโจมตีพุ่งไวขึ้น', buff:'+5% projectile speed',
    apply:p=>{ p.projSpeedMul*=1.05; } },
  { id:'grave_kitten', name:'Grave Kitten', title:'แมวสุสาน', price:3600, icon:'GK', sprite:'pet_grave_kitten', sheet:'pet_grave_kitten_8dir', color:'#d887ff',
    desc:'แมวดำตาเรืองแสง ข่วนโชคชะตาให้ติดคริบ่อยขึ้น', buff:'+4% crit chance',
    apply:p=>{ p.critChance+=0.04; } },
  { id:'mini_mimic', name:'Mini Mimic', title:'หีบจิ๋วมีขา', price:4500, icon:'MM', sprite:'pet_mini_mimic', sheet:'pet_mini_mimic_8dir', color:'#ffcc66',
    desc:'หีบสมบัติที่เลือกอยู่ข้างคุณ ช่วยหาเงินและของดีขึ้นนิดหน่อย', buff:'+5% gold, +3% luck',
    apply:p=>{ p.goldMul*=1.05; p.luck=(p.luck||0)+0.03; } }
];
function petById(id){ return PETS.find(p=>p.id===id); }
function loadPetState(){
  try{
    const parsed=JSON.parse(localStorage.getItem(PET_STATE_STORAGE_KEY)||'{}');
    return { owned:parsed&&parsed.owned?parsed.owned:{}, selected:parsed&&parsed.selected?parsed.selected:'' };
  }catch(_){ return { owned:{}, selected:'' }; }
}
function savePetState(state){
  try{ localStorage.setItem(PET_STATE_STORAGE_KEY, JSON.stringify(state||{owned:{},selected:''})); }catch(_){}
}
function soulCoins(){
  const n=parseInt(localStorage.getItem(SOUL_COINS_STORAGE_KEY)||'0',10);
  return Number.isFinite(n) && n>0 ? n : 0;
}
function setSoulCoins(v){
  const n=Math.max(0, Math.floor(v||0));
  try{ localStorage.setItem(SOUL_COINS_STORAGE_KEY, String(n)); }catch(_){}
  return n;
}
function addSoulCoins(amount, reason){
  amount=Math.max(0, Math.floor(amount||0));
  if(!amount) return 0;
  const total=setSoulCoins(soulCoins()+amount);
  if(reason) showToast('Soul Coins +'+amount+' · '+reason, 3.2);
  if(typeof queueOnlineAchievementSync==='function') queueOnlineAchievementSync('coins');
  return total;
}
function isPetOwned(id){ return !!(loadPetState().owned||{})[id]; }
function selectedPetId(){
  const state=loadPetState();
  return state.selected && state.owned && state.owned[state.selected] ? state.selected : '';
}
function buyPet(id){
  const p=petById(id), state=loadPetState();
  if(!p) return false;
  if(state.owned[p.id]){ selectPet(p.id); return true; }
  const coins=soulCoins();
  if(coins<p.price){ showToast('Soul Coins ไม่พอ: ต้องมี '+p.price.toLocaleString(),2.4); return false; }
  setSoulCoins(coins-p.price);
  state.owned[p.id]=new Date().toISOString();
  state.selected=p.id;
  savePetState(state);
  if(typeof queueOnlineAchievementSync==='function') queueOnlineAchievementSync('pet');
  showToast('ซื้อ Pet: '+p.name,2.8);
  openGuide('pets');
  return true;
}
function selectPet(id){
  const state=loadPetState();
  if(id && !state.owned[id]){ showToast('ยังไม่ได้ซื้อ Pet ตัวนี้',2); return false; }
  state.selected=id||'';
  savePetState(state);
  if(typeof queueOnlineAchievementSync==='function') queueOnlineAchievementSync('pet');
  const p=petById(id);
  const quips={
    lumo_wisp:'วิบวับพร้อมลุย',
    lantern_bunny:'ถือโคมตามมาแล้ว',
    tiny_gargoyle:'ทำหน้าเข้ม แต่ตัวเล็ก',
    storm_pup:'หางสปาร์กด้วยความตื่นเต้น',
    grave_kitten:'เมี๊ยวแบบต้องสาป',
    mini_mimic:'หีบจิ๋วขยับขาอย่างภูมิใจ'
  };
  showToast(id ? 'เลือก Pet: '+p.name+' — '+(quips[id]||'พร้อมลุย') : 'เล่นโดยไม่มี Pet',2.3);
  openGuide('pets');
  return true;
}
function unlockAllPetsForTesting(){
  const state=loadPetState();
  const now=new Date().toISOString();
  for(const p of PETS) state.owned[p.id]=state.owned[p.id]||now;
  if(!state.selected && PETS[0]) state.selected=PETS[0].id;
  savePetState(state);
  return state;
}
function applyLocalPetTestUnlock(){
  const host=location.hostname;
  const local=host==='localhost' || host==='127.0.0.1' || host==='::1';
  const params=new URLSearchParams(location.search);
  if(!local || params.get('unlockPets')!=='1') return false;
  unlockAllPetsForTesting();
  showToast('TEST: ปลดล็อก Pet ทั้งหมดแล้ว',3);
  if(history && history.replaceState){
    params.delete('unlockPets');
    const qs=params.toString();
    history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+location.hash);
  }
  return true;
}
window.unlockAllPetsForTesting = unlockAllPetsForTesting;

const ACHIEVEMENT_STORAGE_KEY = 'sc3_achievements_v1';
const STARTER_CHARACTER_KEYS = new Set(['paladin','ranger','sorceress']);
const STARTER_WEAPON_KEYS = new Set(['shieldtoss','arrow','nova']);
const ACHIEVEMENTS = [
  { id:'first_hunt', name:'นักล่ามือใหม่', desc:'ฆ่ามอนสเตอร์ 120 ตัวในรันเดียว',
    rewards:[{type:'character',key:'huntress'},{type:'weapon',key:'spread'},{type:'item',key:'backpack'},{type:'item',key:'magnet_coil'},{type:'coins',amount:10}],
    test:c=>c.kills>=120 },
  { id:'level_10', name:'เริ่มจับทางได้', desc:'ไปถึงเลเวล 15 ในรันเดียว',
    rewards:[{type:'character',key:'slayer'},{type:'weapon',key:'bladewhirl'},{type:'item',key:'brass_knuckle'},{type:'item',key:'swift_oil'},{type:'coins',amount:30}],
    test:c=>c.level>=15 },
  { id:'map2_reached', name:'ข้ามแดนต้องสาป', desc:'เข้าสู่ Map 2 และฆ่าศัตรูอย่างน้อย 250 ตัวในรันเดียว',
    rewards:[{type:'character',key:'priestess'},{type:'weapon',key:'smite'},{type:'item',key:'holy_book'},{type:'coins',amount:50}],
    test:c=>(c.stage>=2 && c.kills>=250) || c.won },
  { id:'first_evolution', name:'ช่างตีอาวุธเงา', desc:'วิวัฒน์อาวุธ 1 ชิ้น และไปถึงเลเวล 25 ในรันเดียว',
    rewards:[{type:'character',key:'templar'},{type:'weapon',key:'orbit'},{type:'item',key:'spiky_shield'},{type:'item',key:'mirror'},{type:'item',key:'runic_lens'},{type:'coins',amount:50}],
    test:c=>c.evolved && c.level>=25 },
  { id:'swift_survivor', name:'หลบไวไม่ถามสุขภาพ', desc:'อยู่รอดอย่างน้อย 12 นาทีในรันเดียว',
    rewards:[{type:'item',key:'dash_boots'},{type:'item',key:'blink_feather'},{type:'item',key:'phase_cloak'},{type:'item',key:'battle_banner'},{type:'coins',amount:50}],
    test:c=>c.time>=720 },
  { id:'assassin_trial', name:'งานเงียบแต่ศพเยอะ', desc:'ฆ่ามอนสเตอร์ 550 ตัวในรันเดียว',
    rewards:[{type:'character',key:'assassin'},{type:'weapon',key:'dagger'},{type:'item',key:'lucky_charm'},{type:'item',key:'sharpening_stone'},{type:'item',key:'execution_coin'},{type:'item',key:'glass_needle'},{type:'coins',amount:75}],
    test:c=>c.kills>=550 },
  { id:'soul_collector', name:'บัญชีวิญญาณไม่เคยว่าง', desc:'ฆ่ามอนสเตอร์ 700 ตัว หรือถือไอเทม 14 ชิ้นในรันเดียว',
    rewards:[{type:'character',key:'necromancer'},{type:'weapon',key:'soulspiral'},{type:'item',key:'demon_soul'},{type:'item',key:'soul_harvester'},{type:'item',key:'stopwatch'},{type:'coins',amount:75}],
    test:c=>c.kills>=700 || c.items>=14 },
  { id:'shop_regular', name:'ลูกค้าประจำ NPC', desc:'ซื้อของจาก Merchant 6 ครั้งในรันเดียว',
    rewards:[{type:'character',key:'it_support'},{type:'weapon',key:'toolstab'},{type:'item',key:'wrench'},{type:'item',key:'credit_card'},{type:'coins',amount:45}],
    test:c=>c.shops>=6 },
  { id:'rich_striker', name:'มีงบก็ยิงชิ่งได้', desc:'จบรันพร้อมทองอย่างน้อย 800 หรือเปิดหีบ 8 ใบ',
    rewards:[{type:'character',key:'striker'},{type:'weapon',key:'football'},{type:'weapon',key:'boneboomerang'},{type:'weapon',key:'bouncebomb'},{type:'item',key:'ricochet_charm'},{type:'coins',amount:45}],
    test:c=>c.gold>=800 || c.chests>=8 },
  { id:'map3_reached', name:'ฟ้าผ่าเข้าห้องบอส', desc:'เข้าสู่ Map 3 และฆ่าศัตรู 900 ตัว หรือถึงเลเวล 35',
    rewards:[{type:'character',key:'stormcaller'},{type:'weapon',key:'lightning'},{type:'item',key:'thunder_mitts'},{type:'coins',amount:100}],
    test:c=>(c.stage>=3 && (c.kills>=900 || c.level>=35)) || c.won },
  { id:'butcher_hunted', name:'The Butcher Hunt', desc:'ฆ่า The Butcher ให้ทันก่อนมันหายตัว',
    rewards:[{type:'item',key:'butcher_token'},{type:'coins',amount:120}],
    test:c=>c.butcherKills>=1 },
  { id:'survive_3m', name:'First Breath', desc:'Survive for 3 minutes in one run',
    rewards:[{type:'coins',amount:5}],
    test:c=>c.time>=180 },
  { id:'survive_6m', name:'Still Breathing', desc:'Survive for 6 minutes in one run',
    rewards:[{type:'coins',amount:10}],
    test:c=>c.time>=360 },
  { id:'overtime_witness', name:'Overtime Witness', desc:'Reach Overtime in one run',
    rewards:[{type:'coins',amount:20}],
    test:c=>c.time>=600 || c.overtimeLevel>=1 },
  { id:'overtime_climber', name:'Overtime Climber', desc:'Reach Overtime x4 or survive 11:30',
    rewards:[{type:'coins',amount:35}],
    test:c=>c.overtimeTier>=4 || c.time>=690 },
  { id:'overtime_madness', name:'Overtime Madness', desc:'Reach Overtime x6 or survive 12:30',
    rewards:[{type:'coins',amount:70}],
    test:c=>c.overtimeTier>=6 || c.time>=750 },
  { id:'kill_300', name:'Crowd Control', desc:'Kill 300 monsters in one run',
    rewards:[{type:'coins',amount:15}],
    test:c=>c.kills>=300 },
  { id:'kill_1000', name:'Thousand Cut Covenant', desc:'Kill 1,000 monsters in one run',
    rewards:[{type:'coins',amount:50}],
    test:c=>c.kills>=1000 },
  { id:'kill_1500', name:'The Floor Is Bones', desc:'Kill 1,500 monsters in one run',
    rewards:[{type:'coins',amount:90}],
    test:c=>c.kills>=1500 },
  { id:'level_30', name:'Veteran Hunter', desc:'Reach level 30 in one run',
    rewards:[{type:'coins',amount:30}],
    test:c=>c.level>=30 },
  { id:'level_45', name:'Power Curve Enjoyer', desc:'Reach level 45 in one run',
    rewards:[{type:'coins',amount:65}],
    test:c=>c.level>=45 },
  { id:'level_60_cap', name:'Limit Breaker', desc:'Reach level 60 in one run',
    rewards:[{type:'coins',amount:140}],
    test:c=>c.level>=60 },
  { id:'items_20', name:'Pocket Dimension', desc:'Hold 20 item stacks in one run',
    rewards:[{type:'coins',amount:35}],
    test:c=>c.items>=20 },
  { id:'items_30', name:'Inventory Incident', desc:'Hold 30 item stacks in one run',
    rewards:[{type:'coins',amount:80}],
    test:c=>c.items>=30 },
  { id:'chests_12', name:'Chest Auditor', desc:'Open 12 chests in one run',
    rewards:[{type:'coins',amount:30}],
    test:c=>c.chests>=12 },
  { id:'chests_20', name:'Box Problem Solver', desc:'Open 20 chests in one run',
    rewards:[{type:'coins',amount:70}],
    test:c=>c.chests>=20 },
  { id:'shops_10', name:'Merchant Loyalty Card', desc:'Buy from merchants 10 times in one run',
    rewards:[{type:'coins',amount:45}],
    test:c=>c.shops>=10 },
  { id:'gold_1500', name:'Emergency Fund', desc:'End a run with at least 1,500 gold',
    rewards:[{type:'coins',amount:35}],
    test:c=>c.gold>=1500 },
  { id:'gold_3000', name:'Cursed Accountant', desc:'End a run with at least 3,000 gold',
    rewards:[{type:'coins',amount:85}],
    test:c=>c.gold>=3000 },
  { id:'first_boss_kill', name:'Boss Receipt', desc:'Kill at least 1 boss in one run',
    rewards:[{type:'coins',amount:25}],
    test:c=>c.bossKills>=1 },
  { id:'boss_triple', name:'Management Meeting', desc:'Kill 3 bosses in one run',
    rewards:[{type:'coins',amount:85}],
    test:c=>c.bossKills>=3 },
  { id:'mini_3', name:'Mini Boss Warmup', desc:'Kill 3 minibosses in one run',
    rewards:[{type:'coins',amount:30}],
    test:c=>c.minibossKills>=3 },
  { id:'mini_8', name:'Mini Boss Union Breaker', desc:'Kill 8 minibosses in one run',
    rewards:[{type:'coins',amount:90}],
    test:c=>c.minibossKills>=8 },
  { id:'evolve_2', name:'Two Sharp Ideas', desc:'Evolve 2 weapons in one run',
    rewards:[{type:'coins',amount:55}],
    test:c=>c.evolvedCount>=2 },
  { id:'full_armory', name:'Full Armory Online', desc:'Hold 3 weapons and evolve at least 1',
    rewards:[{type:'coins',amount:45}],
    test:c=>c.weaponCount>=3 && c.evolvedCount>=1 },
  { id:'no_damage_5m', name:'Do Not Touch The Cape', desc:'Survive 5 minutes without taking damage',
    rewards:[{type:'coins',amount:75}],
    test:c=>c.time>=300 && c.damageTaken<=0 },
  { id:'clean_clear', name:'Untouchable Covenant', desc:'Clear a run without taking damage',
    rewards:[{type:'coins',amount:240}],
    test:c=>c.won && c.damageTaken<=0 },
  { id:'normal_clear', name:'Normal Covenant Clear', desc:'Clear Map 3 on Normal',
    rewards:[{type:'coins',amount:120}],
    test:c=>c.won && c.difficulty==='normal' },
  { id:'hard_clear', name:'Hard Covenant Clear', desc:'Clear Map 3 on Hard',
    rewards:[{type:'coins',amount:260}],
    test:c=>c.won && c.difficulty==='hard' },
  { id:'pact_runner', name:'Small Print Accepted', desc:'Survive 5 minutes with at least 1 Pact active',
    rewards:[{type:'coins',amount:45}],
    test:c=>c.time>=300 && c.pactCount>=1 },
  { id:'pact_stack', name:'Lawyer Needed', desc:'Reach Overtime with at least 3 Pacts active',
    rewards:[{type:'coins',amount:110}],
    test:c=>(c.time>=600 || c.overtimeLevel>=1) && c.pactCount>=3 },
  { id:'pact_clear', name:'Signed In Blood', desc:'Clear a run with Pact score x1.50 or higher',
    rewards:[{type:'coins',amount:200}],
    test:c=>c.won && c.pactMultiplier>=1.5 },
  { id:'tax_evasion', name:'ภาษีไม่เกี่ยว ข้าเกี่ยวทอง', desc:'จบรันพร้อมทองอย่างน้อย 777',
    rewards:[{type:'coins',amount:25}],
    test:c=>c.gold>=777 },
  { id:'shopaholic_denial', name:'ไม่ได้ติดช้อป แค่สนับสนุน NPC', desc:'ซื้อของจาก Merchant 15 ครั้งในรันเดียว',
    rewards:[{type:'coins',amount:80}],
    test:c=>c.shops>=15 },
  { id:'box_has_feelings', name:'กล่องก็มีหัวใจ แต่เราตีแตก', desc:'เปิดหีบ 15 ใบในรันเดียว',
    rewards:[{type:'coins',amount:45}],
    test:c=>c.chests>=15 },
  { id:'walking_inventory', name:'ตัวละครหรือโกดังเคลื่อนที่', desc:'ถือไอเทม 25 stack ในรันเดียว',
    rewards:[{type:'coins',amount:55}],
    test:c=>c.items>=25 },
  { id:'one_more_level', name:'อีกเลเวลเดียวพอ พูดมา 20 รอบแล้ว', desc:'ถึงเลเวล 50 ในรันเดียว',
    rewards:[{type:'coins',amount:95}],
    test:c=>c.level>=50 },
  { id:'bonk_department', name:'แผนกตีแรง ไม่รับคืนสินค้า', desc:'ฆ่ามอน 777 ตัวในรันเดียว',
    rewards:[{type:'coins',amount:45}],
    test:c=>c.kills>=777 },
  { id:'boss_hr_complaint', name:'บอสขอร้องเรียน HR', desc:'ฆ่าบอส 2 ตัวในรันเดียว',
    rewards:[{type:'coins',amount:55}],
    test:c=>c.bossKills>=2 },
  { id:'mini_boss_is_not_mini', name:'มินิบอสไม่มินิเลยครับ', desc:'ฆ่ามินิบอส 5 ตัวในรันเดียว',
    rewards:[{type:'coins',amount:55}],
    test:c=>c.minibossKills>=5 },
  { id:'overtime_terms_unread', name:'ไม่ได้อ่านเงื่อนไข Overtime', desc:'ไปถึง Overtime x5',
    rewards:[{type:'coins',amount:60}],
    test:c=>c.overtimeTier>=5 },
  { id:'still_here_why', name:'ยังอยู่อีกเหรอ', desc:'อยู่รอด 13 นาทีในรันเดียว',
    rewards:[{type:'coins',amount:85}],
    test:c=>c.time>=780 },
  { id:'three_weapon_problem', name:'สามอาวุธ สามปัญหา', desc:'ถืออาวุธครบ 3 ชิ้นในรันเดียว',
    rewards:[{type:'coins',amount:25}],
    test:c=>c.weaponCount>=3 },
  { id:'evolution_addict', name:'เห็นแสงวิวัฒน์แล้วมือสั่น', desc:'วิวัฒน์อาวุธ 3 ชิ้นในรันเดียว',
    rewards:[{type:'coins',amount:120}],
    test:c=>c.evolvedCount>=3 },
  { id:'hard_mode_regret', name:'กด Hard เพราะมือไว', desc:'อยู่รอด 8 นาทีใน Hard',
    rewards:[{type:'coins',amount:90}],
    test:c=>c.difficulty==='hard' && c.time>=480 },
  { id:'casual_research', name:'ไม่ได้ง่าย แค่วิจัยระบบ', desc:'อยู่รอด 10 นาทีใน Casual',
    rewards:[{type:'coins',amount:20}],
    test:c=>c.difficulty==='casual' && c.time>=600 },
  { id:'normal_person', name:'คนปกติที่ถืออาวุธสามชิ้น', desc:'อยู่รอด 10 นาทีใน Normal',
    rewards:[{type:'coins',amount:55}],
    test:c=>c.difficulty==='normal' && c.time>=600 },
  { id:'pact_fine_print', name:'ตัวหนังสือเล็กกว่าความเสี่ยง', desc:'เล่นด้วย Pact อย่างน้อย 2 อันและอยู่รอด 8 นาที',
    rewards:[{type:'coins',amount:85}],
    test:c=>c.pactCount>=2 && c.time>=480 },
  { id:'glass_cannon_intern', name:'เด็กฝึกงานสาย Glass Cannon', desc:'เล่นด้วย Pact x1.40 ขึ้นไปและฆ่ามอน 500 ตัว',
    rewards:[{type:'coins',amount:95}],
    test:c=>c.pactMultiplier>=1.4 && c.kills>=500 },
  { id:'butcher_no_tip', name:'Butcher มาแล้ว แต่ไม่มีทิปให้', desc:'ฆ่า The Butcher และมีทองอย่างน้อย 1,000',
    rewards:[{type:'coins',amount:140}],
    test:c=>c.butcherKills>=1 && c.gold>=1000 },
  { id:'health_insurance_denied', name:'ประกันสุขภาพไม่อนุมัติ', desc:'ชนะรันแต่เคยโดนดาเมจ',
    rewards:[{type:'coins',amount:60}],
    test:c=>c.won && c.damageTaken>0 },
  { id:'do_not_panic_much', name:'ไม่ได้ลน แค่กดหลบเชิงศิลปะ', desc:'อยู่รอด 9 นาทีโดยยังไม่ชนะรัน',
    rewards:[{type:'coins',amount:35}],
    test:c=>!c.won && c.time>=540 },
  { id:'void_cleared', name:'ปิดสัญญาเงา', desc:'เคลียร์รันสำเร็จ',
    rewards:[{type:'item',key:'big_bonk'},{type:'item',key:'power_gloves'},{type:'item',key:'dragonfire'},{type:'item',key:'energy_core'},{type:'item',key:'royal_jelly'},{type:'coins',amount:200}],
    test:c=>c.won }
];
const ACHIEVEMENT_LOCKED_WEAPONS = new Set(ACHIEVEMENTS.flatMap(a=>a.rewards.filter(r=>r.type==='weapon').map(r=>r.key)));
const ACHIEVEMENT_LOCKED_ITEMS = new Set(ACHIEVEMENTS.flatMap(a=>a.rewards.filter(r=>r.type==='item').map(r=>r.key)));
let achievementStateCache = null;
let lastAchievementUnlocks = [];

const PACTS = [
  { id:'blood_moon', name:'Blood Moon', title:'จันทร์โลหิต', desc:'มอนสเตอร์ปกติมีเลือด +50%', bonus:0.20, tier:'silver',
    unlock:'เคลียร์ Map 3 ของระดับที่เลือก โดยฆ่าบอสสุดท้ายแล้วเข้าวาร์ป', test:c=>c.victoryClear },
  { id:'glass_soul', name:'Glass Soul', title:'วิญญาณแก้ว', desc:'เลือดสูงสุดผู้เล่น -25%', bonus:0.25, tier:'gold',
    unlock:'เคลียร์ Map 3 ของระดับที่เลือก โดยฆ่าบอสสุดท้ายแล้วเข้าวาร์ป', test:c=>c.victoryClear },
  { id:'cursed_economy', name:'Cursed Economy', title:'เศรษฐกิจต้องสาป', desc:'ทองที่ได้รับ x0.6, ร้าน/หีบแพงขึ้น x1.3', bonus:0.15, tier:'bronze',
    unlock:'เคลียร์ Map 3 ของระดับที่เลือก โดยฆ่าบอสสุดท้ายแล้วเข้าวาร์ป', test:c=>c.victoryClear },
  { id:'no_mercy', name:'No Mercy', title:'ไร้ความเมตตา', desc:'การฟื้นเลือดและฮีลลดลง 50%', bonus:0.20, tier:'silver',
    unlock:'เคลียร์ Map 3 ของระดับที่เลือก โดยฆ่าบอสสุดท้ายแล้วเข้าวาร์ป', test:c=>c.victoryClear },
  { id:'ravenous_horde', name:'Ravenous Horde', title:'ฝูงกระหายเลือด', desc:'มอนสเตอร์เกิดถี่ขึ้นและจำนวนหนาแน่นขึ้น', bonus:0.25, tier:'gold',
    unlock:'เคลียร์ Map 3 ของระดับที่เลือก โดยฆ่าบอสสุดท้ายแล้วเข้าวาร์ป', test:c=>c.victoryClear }
];
const PACT_CAP = 2.5;
let pactUnlockStateCache = null;

function pactById(id){ return PACTS.find(p=>p.id===id); }
function pactDifficultyKey(difficulty){ return difficulty==='hard' ? 'hard' : 'normal'; }
function normalizePactUnlockState(parsed){
  const state={ done:{ normal:{}, hard:{} } };
  const done=(parsed && parsed.done && typeof parsed.done==='object') ? parsed.done : {};
  const valid=id=>!!pactById(id);
  if(done.normal || done.hard){
    for(const diff of ['normal','hard']){
      const bucket=(done[diff] && typeof done[diff]==='object') ? done[diff] : {};
      for(const [id, at] of Object.entries(bucket)){
        if(valid(id)) state.done[diff][id]=at || new Date().toISOString();
      }
    }
    return state;
  }
  for(const [id, at] of Object.entries(done)){
    if(valid(id)) state.done.normal[id]=at || new Date().toISOString();
  }
  return state;
}
function loadPactUnlockState(){
  if(pactUnlockStateCache) return pactUnlockStateCache;
  try{
    const raw=localStorage.getItem(PACT_UNLOCK_STORAGE_KEY);
    const parsed=raw ? JSON.parse(raw) : {};
    pactUnlockStateCache = normalizePactUnlockState(parsed);
  }catch(_){
    pactUnlockStateCache = normalizePactUnlockState({});
  }
  return pactUnlockStateCache;
}
function savePactUnlockState(state){
  pactUnlockStateCache = normalizePactUnlockState(state || {});
  try{ localStorage.setItem(PACT_UNLOCK_STORAGE_KEY, JSON.stringify(pactUnlockStateCache)); }catch(_){}
}
function isPactUnlocked(id, difficulty){
  const diff=pactDifficultyKey(difficulty||activeDifficultyId);
  const done=(loadPactUnlockState().done||{})[diff] || {};
  return !!done[id];
}
function unlockedPacts(difficulty){ return PACTS.filter(p=>isPactUnlocked(p.id, difficulty)); }
function pactBonusSum(ids){ return (ids||[]).reduce((sum,id)=>sum+((pactById(id)||{}).bonus||0),0); }
function calcPactMultiplier(ids){ return Math.min(PACT_CAP, 1 + pactBonusSum(ids)); }
function activePact(id){ return activePactIds.includes(id); }
function difficultyHpMul(){ return activeDifficulty().hp || 1; }
function difficultyAtkMul(){ return activeDifficulty().atk || 1; }
function difficultyBossHpMul(){ return activeDifficulty().bossHp || 1; }
function difficultyBossAtkMul(){ return activeDifficulty().bossAtk || 1; }
function pactNormalHpMul(){ return difficultyHpMul() * (activePact('blood_moon') ? 1.5 : 1); }
function pactCostMul(){ return activePact('cursed_economy') ? 1.3 : 1; }
function pactGoldMul(){ return activePact('cursed_economy') ? 0.6 : 1; }
function pactHealMul(){ return activePact('no_mercy') ? 0.5 : 1; }
function scaledHeal(v){ return Math.max(0, v * pactHealMul()); }
function pactHordeProfile(profile){
  const diff=activeDifficulty();
  profile={
    cap:Math.max(24, Math.round(profile.cap*(diff.spawnCap||1))),
    interval:Math.max(0.25, profile.interval*(diff.spawnInterval||1)),
    batch:Math.max(1, Math.round(profile.batch*(diff.spawnBatch||1)))
  };
  if(!activePact('ravenous_horde')) return profile;
  return {
    cap:Math.min(360, Math.round(profile.cap*1.22 + 12)),
    interval:Math.max(0.35, profile.interval*0.82),
    batch:Math.min(64, Math.max(profile.batch+1, Math.round(profile.batch*1.35)))
  };
}
function pactHordeSize(n){ return activePact('ravenous_horde') ? Math.min(360, Math.round(n*1.25)) : n; }
function pactLabel(ids){
  ids=ids||activePactIds;
  return ids.length ? ids.map(id=>{ const p=pactById(id); return p ? pactName(p) : id; }).join(', ') : 'No Pact';
}
function pactSummary(ids){
  ids=ids||activePactIds;
  return { ids:ids.slice(), multiplier:calcPactMultiplier(ids), label:pactLabel(ids), count:ids.length };
}
function setActivePacts(ids){
  activePactIds = (ids||[]).filter(id=>isPactUnlocked(id, activeDifficultyId));
  pactMultiplier = calcPactMultiplier(activePactIds);
  try{ localStorage.setItem(PACT_LAST_STORAGE_KEY, JSON.stringify(activePactIds)); }catch(_){}
}
function lastPactLoadout(){
  try{
    const ids=JSON.parse(localStorage.getItem(PACT_LAST_STORAGE_KEY)||'[]');
    return Array.isArray(ids) ? ids.filter(id=>isPactUnlocked(id, activeDifficultyId)) : [];
  }catch(_){ return []; }
}
function pactContext(){
  const healed=Object.values((runStats&&runStats.itemStats)||{}).some(r=>(r.heal||0)>0);
  const pactEligibleDifficulty = activeDifficultyId==='normal' || activeDifficultyId==='hard';
  return {
    finished:true,
    time:gameTime||0,
    kills:kills||0,
    stage:mapStage||1,
    won:!!won,
    victoryClear:!!(won && mapStage>=3 && finalBossKilledAt!=null && pactEligibleDifficulty),
    difficulty:activeDifficultyId,
    shops:shopPurchases||0,
    gold:player?player.gold:0,
    lowHp:!!(player && player.maxHp && player.hp/player.maxHp<0.25),
    healed
  };
}
function evaluatePactUnlocks(){
  lastPactUnlocks=[];
  const state=loadPactUnlockState();
  const ctx=pactContext();
  const diff=pactDifficultyKey(ctx.difficulty);
  const done=state.done[diff] || (state.done[diff]={});
  for(const p of PACTS){
    if(done[p.id] || !p.test(ctx)) continue;
    done[p.id]=new Date().toISOString();
    lastPactUnlocks.push(p);
  }
  if(lastPactUnlocks.length){
    savePactUnlockState(state);
    lastPactUnlocks.forEach((p,i)=>setTimeout(()=>showToast((gameLang()==='en'?'Pact Unlocked ('+diff+'): ':'ปลดล็อก Pact ('+diff+'): ')+pactName(p),3.2), 400+i*850));
  }
  return lastPactUnlocks;
}
function pactUnlockSummaryHtml(){
  if(!lastPactUnlocks.length) return '';
  return '<section><h3>Pact Unlocked ('+escHtml(pactDifficultyKey(activeDifficultyId))+')</h3>'+lastPactUnlocks.map(p=>
    '<div><b>'+escHtml(pactName(p))+'</b><span>'+escHtml(pactDesc(p))+' · +'+Math.round(p.bonus*100)+'%</span></div>'
  ).join('')+'</section>';
}
function currentPactSummaryHtml(){
  const s=pactSummary(activePactIds);
  if(!s.ids.length) return '<section><h3>Pact</h3><div><b>No Pact</b><span>Score x1.00</span></div></section>';
  return '<section><h3>Pact</h3><div><b>x'+s.multiplier.toFixed(2)+' · '+s.count+' Pact'+(s.count>1?'s':'')+'</b><span>'+escHtml(s.label)+'</span></div></section>';
}
function calcRunSoulCoins(){
  let base=0;
  const parts=[];
  if((gameTime||0)>=180){
    base+=3; parts.push('เล่นครบ 3 นาที +3');
    const extra=Math.max(0, Math.floor(((gameTime||0)-180)/60));
    if(extra>0){ base+=extra; parts.push('เวลาหลัง 3 นาที +'+extra); }
  }
  if(runMinibossKills>0){ base+=runMinibossKills*2; parts.push('มินิบอส x'+runMinibossKills+' +'+(runMinibossKills*2)); }
  if(runBossKills>0){ base+=runBossKills*5; parts.push('บอส x'+runBossKills+' +'+(runBossKills*5)); }
  if(mapStage>=2 || won){ base+=6; parts.push('ผ่าน Map 1 +6'); }
  if(mapStage>=3 || won){ base+=10; parts.push('ผ่าน Map 2 +10'); }
  if(won){ base+=18; parts.push('ชนะ Map 3 +18'); }
  const mult=Math.min(1.5, Math.max(1, typeof pactMultiplier==='number'?pactMultiplier:1));
  const total=Math.round(base*mult);
  if(mult>1 && base>0) parts.push('Pact x'+mult.toFixed(2));
  return { base, total, mult, parts };
}
function awardRunSoulCoins(){
  const award=calcRunSoulCoins();
  lastSoulCoinAward=award;
  if(award.total>0) addSoulCoins(award.total, 'Run Reward');
  return award;
}
function soulCoinSummaryHtml(){
  if(!lastSoulCoinAward) return '';
  const a=lastSoulCoinAward;
  if(!a.total) return '<section><h3>Soul Coins</h3><div><b>+0</b><span>ต้องอยู่รอดอย่างน้อย 3 นาทีเพื่อรับรางวัลรัน</span></div></section>';
  return '<section><h3>Soul Coins</h3><div><b>+'+a.total.toLocaleString()+'</b><span>'+escHtml(a.parts.join(' · '))+'</span></div></section>';
}

function loadAchievementState(){
  if(achievementStateCache) return achievementStateCache;
  try{
    const raw=localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
    const parsed=raw ? JSON.parse(raw) : {};
    achievementStateCache = { done: parsed && parsed.done ? parsed.done : {} };
  }catch(_){
    achievementStateCache = { done:{} };
  }
  return achievementStateCache;
}
function saveAchievementState(state){
  achievementStateCache = state || { done:{} };
  try{ localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(achievementStateCache)); }catch(_){}
}
function exportAchievementProgress(){
  const state=loadAchievementState();
  return { done:{ ...(state.done||{}) } };
}
function exportPlayerProgress(){
  return {
    done:{ ...(loadAchievementState().done||{}) },
    pacts:loadPactUnlockState(),
    soulCoins:soulCoins(),
    pets:loadPetState()
  };
}
function importAchievementProgress(done, opts){
  opts=opts||{};
  const state=loadAchievementState();
  const imported=[];
  for(const [id, at] of Object.entries(done||{})){
    if(!ACHIEVEMENTS.some(a=>a.id===id) || state.done[id]) continue;
    const parsed=Date.parse(at);
    state.done[id]=Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
    const a=ACHIEVEMENTS.find(x=>x.id===id);
    if(a) imported.push(a);
  }
  if(imported.length){
    saveAchievementState(state);
    if(!opts.silent){
      imported.forEach((a,i)=>setTimeout(()=>showToast(tr('ach.synced',{name:achievementName(a)}),3), 250+i*800));
    }
  }
  return imported;
}
function importPactProgress(pacts){
  if(!pacts || typeof pacts!=='object') return false;
  const remote=normalizePactUnlockState(pacts);
  const local=loadPactUnlockState();
  let changed=false;
  for(const diff of ['normal','hard']){
    local.done[diff]=local.done[diff] || {};
    for(const [id, at] of Object.entries((remote.done||{})[diff] || {})){
      if(local.done[diff][id]) continue;
      local.done[diff][id]=at;
      changed=true;
    }
  }
  if(changed) savePactUnlockState(local);
  return changed;
}
function importPlayerProgress(progress, opts){
  progress=progress||{};
  const imported=importAchievementProgress(progress.done||{}, opts);
  const pactsChanged=importPactProgress(progress.pacts || progress.pactUnlocks);
  const remoteCoins=Math.max(0, Math.floor(Number(progress.soulCoins||0)));
  let coinsChanged=false, petsChanged=false;
  if(Number.isFinite(remoteCoins) && remoteCoins>soulCoins()){
    setSoulCoins(remoteCoins);
    coinsChanged=true;
  }
  if(progress.pets && typeof progress.pets==='object'){
    const local=loadPetState();
    const remoteOwned=(progress.pets.owned && typeof progress.pets.owned==='object') ? progress.pets.owned : {};
    for(const [id, at] of Object.entries(remoteOwned)){
      if(!petById(id) || local.owned[id]) continue;
      const parsed=Date.parse(at);
      local.owned[id]=Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
      petsChanged=true;
    }
    if(progress.pets.selected && local.owned[progress.pets.selected] && local.selected!==progress.pets.selected){
      local.selected=progress.pets.selected;
      petsChanged=true;
    }
    if(petsChanged) savePetState(local);
  }
  return { imported, coinsChanged, petsChanged, pactsChanged };
}
function hasAchievement(id){
  return !!(loadAchievementState().done||{})[id];
}
function achievementForReward(type,key){
  return ACHIEVEMENTS.find(a=>a.rewards.some(r=>r.type===type && r.key===key));
}
function rewardUnlocked(type,key){
  return ACHIEVEMENTS.some(a=>hasAchievement(a.id) && a.rewards.some(r=>r.type===type && r.key===key));
}
function isCharacterUnlocked(key){
  return STARTER_CHARACTER_KEYS.has(key) || rewardUnlocked('character', key);
}
function isWeaponUnlocked(key){
  const w=WEAPON_TYPES[key];
  if(w && w.hidden) return true;
  return STARTER_WEAPON_KEYS.has(key) || !ACHIEVEMENT_LOCKED_WEAPONS.has(key) || rewardUnlocked('weapon', key);
}
function isItemUnlocked(id){
  return !ACHIEVEMENT_LOCKED_ITEMS.has(id) || rewardUnlocked('item', id);
}
function availableItemPool(rarity){
  const pool=ITEMS.filter(i=>i.rarity===rarity && isItemUnlocked(i.id));
  if(pool.length) return pool;
  return ITEMS.filter(i=>isItemUnlocked(i.id));
}
function unlockRequirement(type,key){
  const a=achievementForReward(type,key);
  return a ? achievementName(a)+' - '+achievementDesc(a) : tr('unlock.ready');
}
function unlockRequirementShort(type,key){
  const a=achievementForReward(type,key);
  return a ? achievementName(a) : tr('unlock.ready');
}
function rewardDisplayName(r){
  if(r.type==='character') return charField(r.key,'name',(CHARACTERS[r.key]&&CHARACTERS[r.key].name)||r.key);
  if(r.type==='weapon') return weaponName(r.key)||r.key;
  if(r.type==='item'){ const it=ITEMS.find(x=>x.id===r.key); return (it&&itemName(it))||r.key; }
  if(r.type==='coins') return '+'+Math.round(r.amount||0).toLocaleString()+' Soul Coins';
  return r.key;
}
function achievementRewardText(a){
  return a.rewards.map(r=>rewardDisplayName(r)).join(', ');
}
function achievementContext(){
  const weapons=(player&&player.weapons)||[];
  const evolvedCount=weapons.filter(w=>w.evolved || ((WEAPON_TYPES[w.key]||{}).hidden)).length;
  return {
    kills:kills||0,
    level:player?player.level:1,
    stage:mapStage||1,
    time:gameTime||0,
    won:!!won,
    damageTaken:damageTaken||0,
    difficulty:activeDifficultyId||'normal',
    pactMultiplier:typeof pactMultiplier==='number' ? pactMultiplier : 1,
    pactCount:(activePactIds||[]).length,
    overtimeLevel:typeof overtimeLevel==='function' ? overtimeLevel() : 0,
    overtimeTier:typeof overtimeTier==='function' ? overtimeTier() : 1,
    items:player&&player.items?player.items.length:0,
    gold:player?player.gold:0,
    chests:chestsOpened||0,
    shops:shopPurchases||0,
    weaponCount:weapons.length,
    evolvedCount,
    evolved:evolvedCount>0,
    butcherKills:butcherKills||0,
    bossKills:runBossKills||0,
    minibossKills:runMinibossKills||0
  };
}
function completeAchievement(a){
  const state=loadAchievementState();
  if(state.done[a.id]) return false;
  state.done[a.id]=new Date().toISOString();
  saveAchievementState(state);
  const coins=(a.rewards||[]).filter(r=>r.type==='coins').reduce((sum,r)=>sum+(r.amount||0),0);
  if(coins>0) addSoulCoins(coins, achievementName(a));
  const index=lastAchievementUnlocks.length;
  lastAchievementUnlocks.push(a);
  setTimeout(()=>showToast(tr('ach.unlocked',{name:achievementName(a)}),3.6), 250 + index*900);
  if(typeof queueOnlineAchievementSync==='function') queueOnlineAchievementSync('unlock');
  return true;
}
function evaluateRunAchievements(){
  lastAchievementUnlocks=[];
  const ctx=achievementContext();
  for(const a of ACHIEVEMENTS){
    if(!hasAchievement(a.id) && a.test(ctx)) completeAchievement(a);
  }
  return lastAchievementUnlocks;
}
function achievementSummaryHtml(){
  if(!lastAchievementUnlocks.length) return '';
  return '<section><h3>'+escHtml(tr('ach.unlockedSection'))+'</h3>'+lastAchievementUnlocks.map(a=>
    '<div><b>'+escHtml(achievementName(a))+'</b><span>'+escHtml(achievementRewardText(a))+'</span></div>'
  ).join('')+'</section>';
}
function onAchievementProgressSynced(){
  if(document.getElementById('select').style.display==='flex') buildSelect();
  const guide=document.getElementById('guide');
  if(guide && guide.style.display==='flex') {
    const body=document.getElementById('guidebody');
    const head=body && body.querySelector('.guidehead h2');
    const title=head ? head.textContent : '';
    if(title===tr('ach.title') || title==='Achievements') openGuide('achievements');
    if(title===tr('pets.title') || title==='Pets') openGuide('pets');
  }
}
window.exportAchievementProgress = exportAchievementProgress;
window.importAchievementProgress = importAchievementProgress;
window.exportPlayerProgress = exportPlayerProgress;
window.importPlayerProgress = importPlayerProgress;
window.onAchievementProgressSynced = onAchievementProgressSynced;

function dirIndex(mx, mz){ return ((Math.round(Math.atan2(mx, mz)/(Math.PI/4)))%8+8)%8; }

function animBillboard(sheetKey, height, frames) {
  const base = tex[sheetKey];
  const t = base.clone(); t.needsUpdate = true;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = 1 / frames; t.offset.x = 0;
  const mat = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.4, depthWrite: true });
  mat._ownsMap = true;   // cloned strip texture -> free on removal
  const s = new THREE.Sprite(mat);
  const ar = (base.image.width / frames) / base.image.height;  // single-frame aspect
  s.center.set(0.5, 0);
  s.scale.set(height * ar, height, 1);
  return s;
}

// Returns { spr, anim }. Uses the walk sheet if available, else the static sprite.
function entitySprite(baseKey, height) {
  const D = DIR_SHEETS[baseKey];
  if (D && tex[D.key]) {
    const st = makeGridState(D, true);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: st.map, transparent:true, alphaTest:0.4, depthWrite:true }));
    spr.material._ownsMap = true;   // pooled/cloned 8-dir texture -> returned or freed on removal
    const base = tex[D.key];
    const ar = (base.image.width/D.cols) / (base.image.height/D.rows);
    spr.center.set(0.5, 0); spr.scale.set(height*ar, height, 1);
    return { spr, anim: { grid:true, walk:st, idle:st, dirRows:[0,7,6,5,4,3,2,1] } };
  }
  const w = WALK_SHEETS[baseKey];
  if (w && tex[w.sheet]) return { spr: animBillboard(w.sheet, height, w.frames), anim: { frames: w.frames, fps: w.fps } };
  return { spr: billboard(baseKey, height), anim: null };
}

function checkoutGridTexture(c){
  const pool=gridTexturePools.get(c.key);
  if(pool && pool.length) return pool.pop();
  const t = tex[c.key].clone();
  t.needsUpdate = true;
  t._poolKey = c.key;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1/c.cols, 1/c.rows);
  return t;
}
function makeGridState(c, pooled) {
  const t = pooled ? checkoutGridTexture(c) : tex[c.key].clone();
  if(!pooled){
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1/c.cols, 1/c.rows);
  }
  return { map:t, cols:c.cols, rows:c.rows, fps:c.fps };
}

const PLAYER_VISIBLE_SIZE = { w:0.66, h:1.36 };
const playerFrameBounds = new Map();
function alphaBoundsForFirstFrame(base, cols, rows){
  const key=(base.image&&base.image.src||'')+'|'+cols+'|'+rows;
  if(playerFrameBounds.has(key)) return playerFrameBounds.get(key);
  const img=base.image, fw=Math.floor(img.width/cols), fh=Math.floor(img.height/rows);
  let box=null;
  try{
    const cv=document.createElement('canvas'); cv.width=fw; cv.height=fh;
    const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,fw,fh,0,0,fw,fh);
    const data=ctx.getImageData(0,0,fw,fh).data;
    let minX=fw,minY=fh,maxX=-1,maxY=-1;
    for(let y=0;y<fh;y++) for(let x=0;x<fw;x++){
      if(data[(y*fw+x)*4+3] > 12){ if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; }
    }
    if(maxX>=minX && maxY>=minY) box={ w:maxX-minX+1, h:maxY-minY+1, fw, fh };
  }catch(_){}
  if(!box) box={ w:fw, h:fh, fw, fh };
  playerFrameBounds.set(key,box); return box;
}
function normalizedPlayerScale(base, cfg){
  const b=alphaBoundsForFirstFrame(base,cfg.walk.cols,cfg.walk.rows);
  const target=cfg.visible || PLAYER_VISIBLE_SIZE;
  return {
    x:target.w * b.fw / Math.max(1,b.w),
    y:target.h * b.fh / Math.max(1,b.h)
  };
}
const petTextureCache = new Map();
function petTexture(pet){
  if(pet.sprite && tex[pet.sprite]) return tex[pet.sprite];
  if(petTextureCache.has(pet.id)) return petTextureCache.get(pet.id);
  const cv=document.createElement('canvas'); cv.width=48; cv.height=48;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const color=pet.color||'#ffe08a';
  ctx.clearRect(0,0,48,48);
  ctx.fillStyle='rgba(0,0,0,.38)'; ctx.fillRect(12,38,24,4);
  ctx.fillStyle=color; ctx.fillRect(16,14,16,16); ctx.fillRect(12,20,24,14);
  ctx.fillStyle='#fff4d6'; ctx.fillRect(20,19,3,3); ctx.fillRect(27,19,3,3);
  ctx.fillStyle='#241a38'; ctx.fillRect(21,20,2,2); ctx.fillRect(28,20,2,2);
  ctx.fillStyle='#120b18'; ctx.fillRect(21,27,6,2);
  ctx.fillStyle=color; ctx.fillRect(14,11,5,6); ctx.fillRect(29,11,5,6);
  ctx.fillStyle='rgba(255,255,255,.75)'; ctx.fillRect(14,14,2,2); ctx.fillRect(31,14,2,2); ctx.fillRect(17,16,2,2);
  ctx.fillStyle='#ffe7a6'; ctx.font='bold 8px monospace'; ctx.textAlign='center'; ctx.fillText(pet.icon||'P',24,43);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  petTextureCache.set(pet.id,t); return t;
}
function makePetFollower(id){
  const pet=petById(id);
  if(!pet) return null;
  let map=petTexture(pet), dirState=null;
  if(pet.sheet && tex[pet.sheet]){
    map=tex[pet.sheet].clone(); map.needsUpdate=true; map.wrapS=map.wrapT=THREE.RepeatWrapping; map.repeat.set(1,1/8);
    dirState={ map, rows:8, dirRows:[0,7,6,5,4,3,2,1] };
  }
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent:true, alphaTest:0.08, depthWrite:true }));
  if(dirState) spr.material._ownsMap=true;
  spr.center.set(0.5,0); spr.scale.set(0.58,0.58,1);
  const sh=makeShadow(0.28);
  scene.add(spr); scene.add(sh);
  return { id, name:pet.name, spr, sh, dirState, baseW:0.58, baseH:0.58, x:-0.8, z:0.55, lastX:-0.8, lastZ:0.55, face:1, bob:Math.random()*6.28, reactT:0, reactKind:'', idleT:0, lowHpWarnAt:0 };
}
function updatePetFollower(dt){
  if(!player || !player.pet || !player.pet.spr) return;
  const pet=player.pet;
  const headingX=player.moving ? (player.ldx||0) : ((player.face||1)*0.65);
  const headingZ=player.moving ? (player.ldz||0) : 0.35;
  const hl=Math.hypot(headingX,headingZ)||1;
  const hx=headingX/hl, hz=headingZ/hl;
  const side=(player.face||1)>0?-1:1;
  const tx=player.x-hx*0.78+(-hz)*side*0.28;
  const tz=player.z-hz*0.78+(hx)*side*0.28;
  const follow=1-Math.pow(0.04,dt);
  pet.lastX=pet.x; pet.lastZ=pet.z;
  pet.x+=(tx-pet.x)*follow; pet.z+=(tz-pet.z)*follow;
  const mvx=pet.x-pet.lastX, mvz=pet.z-pet.lastZ, moveLen=Math.hypot(mvx,mvz), moving=moveLen>0.002;
  const faceX=moveLen>0.012 ? mvx : player.x-pet.x;
  const faceZ=moveLen>0.012 ? mvz : player.z-pet.z;
  if(moveLen>0.012 && Math.abs(mvx)>0.001) pet.face = mvx>0 ? 1 : -1;
  else pet.face = pet.x < player.x ? 1 : -1;
  if(moving) pet.idleT=0; else pet.idleT=(pet.idleT||0)+dt;
  if(pet.idleT>6.5 && Math.random()<dt*0.22){ petReact('idle'); pet.idleT=0; }
  if(player.hp/player.maxHp<0.3 && gameTime>(pet.lowHpWarnAt||0)){ petReact('lowhp', true); pet.lowHpWarnAt=gameTime+8; }
  if(pet.reactT>0) pet.reactT=Math.max(0, pet.reactT-dt);
  const react=pet.reactT>0 ? pet.reactT : 0;
  const hop=moving ? Math.abs(Math.sin(gameTime*10+pet.bob))*0.07 : Math.sin(gameTime*3.4+pet.bob)*0.035;
  const cheer=react ? Math.sin((1-react)*Math.PI*4)*0.13 + react*0.14 : 0;
  const y=groundHeight(pet.x,pet.z)+0.34+hop+Math.max(0,cheer);
  const squish=moving ? Math.sin(gameTime*10+pet.bob)*0.045 : Math.sin(gameTime*2.8+pet.bob)*0.025;
  const pop=react ? 1+react*0.26 : 1;
  if(pet.dirState && pet.spr.material.map){
    const fl=Math.hypot(faceX,faceZ)||1;
    const dir=dirIndex(-faceX/fl, faceZ/fl);
    const row=pet.dirState.dirRows[dir] || 0;
    pet.dirState.map.offset.x=0;
    pet.dirState.map.offset.y=1-(row+1)/pet.dirState.rows;
  }
  const flip=pet.dirState ? 1 : pet.face;
  pet.spr.scale.set(pet.baseW*flip*pop*(1-squish), pet.baseH*pop*(1+squish), 1);
  pet.spr.position.set(pet.x,y,pet.z);
  if(pet.sh){
    const shadowPulse=0.92 + Math.max(0, 0.08-hop*0.6) + (react?0.08*react:0);
    pet.sh.position.set(pet.x, groundHeight(pet.x,pet.z)+0.018, pet.z);
    pet.sh.scale.set(0.28*shadowPulse,0.28*shadowPulse,0.28*shadowPulse);
  }
}

function makePlayer() {
  const C = CHARACTERS[currentChar] || CHARACTERS.paladin;
  const cfg = SHEETS[C.sheet] || SHEETS.player;
  let spr, anim = null;
  if (cfg && tex[cfg.walk.key]) {
    const walk = makeGridState(cfg.walk);
    const idle = tex[cfg.idle.key] ? makeGridState(cfg.idle) : walk;
    spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: walk.map, transparent:true, alphaTest:0.4, depthWrite:true }));
    const base = tex[cfg.walk.key];
    const scale=normalizedPlayerScale(base,cfg);
    spr.center.set(0.5, 0); spr.scale.set(scale.x, scale.y, 1);
    anim = { grid:true, walk, idle, dirRows: cfg.dirRows };
  } else {
    spr = billboard('player', 1.7);
  }
  const sh = makeShadow(0.72);
  const hpbar = makePlayerHealthBar();
  scene.add(spr); scene.add(sh);
  const p = { x:0, z:0, hp:80, maxHp:80, def:5, spd:PLAYER_SPEED,
           level:1, xp:0, xpToNext:xpRequired(1), gold:0, alive:true, moving:false, dir:0,
           invuln:0, flash:0, hpBarUntil:0, cd:0, runTime:0, dashTime:0, dashCd:0, dashX:0, dashZ:0, dashCdMul:1, dashDistMul:1, dashInvulnBonus:0, ldx:0, ldz:0, knockX:0, knockZ:0, trailT:0, magnet:PICKUP_MAGNET, regen:0, xpMul:1, goldMul:1, dmgMul:1, rateMul:1, rangeMul:1, countBonus:0, ricochetBonus:0, lifesteal:0, lifestealPct:0, knockbackMul:0, armorMul:1, lifeMul:1, areaLifeMul:1, projSpeedMul:1, projScale:1, buffDurationMul:1, pickupSpeedBoost:0, pickupSpeedTimer:0, pickupDmgBoost:0, pickupDmgTimer:0, critChance:0.05, critDmg:1.5, tomeCount:{}, bansRemaining:choiceBansPerRun(), bannedChoices:{}, weapons:[makeWeapon(C.weapon)], items:[], itemCounts:{}, relics:[], char:currentChar, passive:C.passive, bw:spr.scale.x, bh:spr.scale.y, born:0, face:1, anim, spr, sh, hpbar };
  const st = C.stats || {};
  if (st.maxHp!=null){ p.maxHp=st.maxHp; p.hp=st.maxHp; }
  if (st.spd!=null)   p.spd=st.spd;
  if (st.def!=null)   p.def=st.def;
  if (st.magnet!=null)p.magnet=st.magnet;
  if (st.regen!=null) p.regen=st.regen;
  if (st.critChance!=null) p.critChance=st.critChance;
  if (st.critDmg!=null) p.critDmg=st.critDmg;
  if (st.rateMul!=null) p.rateMul=st.rateMul;
  const petId=selectedPetId();
  const pet=petById(petId);
  if(pet){
    pet.apply(p);
    p.petId=petId;
    p.pet=makePetFollower(petId);
  }
  if (activePact('glass_soul')){ p.maxHp=Math.max(1,Math.round(p.maxHp*0.75)); p.hp=Math.min(p.hp,p.maxHp); }
  if (activePact('cursed_economy')) p.goldMul*=pactGoldMul();
  return p;
}

function pickupItem(gi){
  if(gi.collected) return;
  gi.collected = true;
  const it = gi.item;
  it.apply(player);
  player.items.push(it);
  player.itemCounts[it.name]=(player.itemCounts[it.name]||0)+1;
  itemSig=null; updateItemHUD(true);
  sfx('pickup');
  if (gi.spr) scene.remove(gi.spr);
  score += ({common:100,uncommon:200,rare:300,legendary:500})[it.rarity]||100;
  if (gi.glow) scene.remove(gi.glow);
  showToast('📦 '+itemName(it)+' ('+tr('rarity.'+(it.rarity||'common'))+')', 1.5);
  if((it.rarity==='rare' || it.rarity==='legendary') && typeof petReact==='function') petReact('loot', true);
}
function spawnGroundItem(x, z, item){
  const col = RARITY_COLORS[item.rarity]||0xffffff;
  // use canvas-generated icon texture (fallback until PixelLab sprites exist)
  let sprTex = tex[item.icon];
  if (!sprTex) { sprTex = makeItemIconTex(item); tex[item.icon] = sprTex; }
  const mat = new THREE.SpriteMaterial({ map: sprTex, transparent: true, alphaTest: 0.1, depthWrite: true });
  const spr = new THREE.Sprite(mat);
  spr.center.set(0.5, 0);
  spr.scale.set(0.55, 0.55, 1);
  spr.position.set(x, groundHeight(x,z)+0.3, z);
  scene.add(spr);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getPixelRingTexture(), color: RARITY_GLOW[item.rarity]||0xffffff,
    transparent: true, opacity: 0.45, alphaTest: 0.06, depthWrite: false
  }));
  glow.scale.set(1.4, 1.4, 1);
  glow.position.set(x, groundHeight(x,z)+0.05, z);
  scene.add(glow);
  groundItems.push({ x, z, item, spr, glow, collected:false, homing:false });
}
function rollItemDrop(boosted){
  const luck = 1 + (player.luck||0);
  const r = Math.random();
  let rarity = null;
  if (boosted === 'chest_epic') {
    if (r < 0.14*luck) rarity = 'legendary';
    else if (r < 0.42*luck) rarity = 'rare';
    else if (r < 0.75*luck) rarity = 'uncommon';
    else rarity = 'common';
  } else if (boosted === 'chest_rare') {
    if (r < 0.06*luck) rarity = 'legendary';
    else if (r < 0.24*luck) rarity = 'rare';
    else if (r < 0.55*luck) rarity = 'uncommon';
    else rarity = 'common';
  } else if (boosted) {
    if (r < 0.08*luck) rarity = 'legendary';
    else if (r < 0.30*luck) rarity = 'rare';
    else if (r < 0.60*luck) rarity = 'uncommon';
    else rarity = 'common';
  } else {
    if (r < 0.02*luck) rarity = 'legendary';
    else if (r < 0.10*luck) rarity = 'rare';
    else if (r < 0.25*luck) rarity = 'uncommon';
    else rarity = 'common';
  }
  if (!rarity) rarity = 'common'; // guaranteed drop, fallback to common
  const pool = availableItemPool(rarity);
  if (!pool.length) return null;
  return pool[(Math.random()*pool.length)|0];
}
function nearestGroundItem(x, z, range){
  let best = null, bd = range || 2.0;
  for (const gi of groundItems) {
    if (gi.collected) continue;
    const d = Math.hypot(x-gi.x, z-gi.z);
    if (d < bd) { bd = d; best = gi; }
  }
  return best;
}
function isWeirdEnemy(t){
  if(!t) return false;
  const name=t.name;
  return CHALLENGE_ONLY_ENEMIES.has(name) || SHOOTERS.has(name) || BUFFERS.has(name) || PULLERS.has(name) ||
    HAZARDERS.has(name) || THIEVES.has(name) || SPLITTERS.has(name) || EXPLODERS.has(name) || WARDERS.has(name);
}
function enemyPool(){
  if(challengeRoom && challengeRoom.enemies && challengeRoom.enemies.length){
    const names=new Set(challengeRoom.enemies);
    const pool=ENEMY_TYPES.filter(e=>names.has(e.name));
    if(pool.length) return pool;
  }
  let pool;
  if(mapStage>=3) pool=ENEMY_TYPES.filter(e=>e.tier>=2);
  else if(mapStage>=2) pool=ENEMY_TYPES.filter(e=>e.tier>=1);
  else {
  const tier=currentTier();
    pool=ENEMY_TYPES.filter(e=>e.tier<=tier);
  }
  pool = pool.filter(e=>!CHALLENGE_ONLY_ENEMIES.has(e.name));
  if(activeDifficultyId==='casual') {
    const simple=pool.filter(e=>!isWeirdEnemy(e));
    if(simple.length>=3) pool=simple;
  }
  return pool;
}
function hardChallengeEnemyPool(){
  if(activeDifficultyId!=='hard' || challengeRoom) return [];
  let pool;
  if(mapStage>=3) pool=ENEMY_TYPES.filter(e=>e.tier>=2);
  else if(mapStage>=2) pool=ENEMY_TYPES.filter(e=>e.tier>=1);
  else {
    const tier=currentTier();
    pool=ENEMY_TYPES.filter(e=>e.tier<=tier);
  }
  return pool.filter(e=>CHALLENGE_ONLY_ENEMIES.has(e.name));
}
function warderLimit(){ if(activeDifficultyId==='casual') return 0; return mapStage>=3 ? 2 : mapStage>=2 ? 1 : 0; }
function activeWarderCount(){ return enemies.reduce((n,e)=>n+(e.alive && WARDERS.has(e.name) ? 1 : 0),0); }
function pickEnemyType(opts){
  opts=opts||{};
  let pool=enemyPool();
  if(!opts.allowWarder || activeWarderCount()>=warderLimit()) pool=pool.filter(e=>!WARDERS.has(e.name));
  if(!pool.length) pool=enemyPool().filter(e=>!WARDERS.has(e.name));
  if(activeDifficultyId==='hard' && !opts.noChallengeRare){
    const rare=hardChallengeEnemyPool();
    const chance=overtimeLevel()?0.12:0.08;
    if(rare.length && Math.random()<chance) return rare[(Math.random()*rare.length)|0];
  }
  return pool[(Math.random()*pool.length)|0];
}
function maybeSpawnWarder(cx,cz){
  if(warderLimit()<=0 || activeWarderCount()>=warderLimit()) return;
  if(Math.random()>(overtimeLevel()?0.20:0.12)) return;
  const t=ENEMY_TYPES.find(e=>WARDERS.has(e.name));
  if(!t) return;
  const a=Math.random()*Math.PI*2, r=3.6+Math.random()*2.6;
  spawnEnemy(t,cx+Math.cos(a)*r,cz+Math.sin(a)*r);
}
function minibossPool(){
  if(mapStage>=3){
    const sprites=new Set(['miniboss_horror','miniboss_skeleton_lord','miniboss_warden']);
    return MINIBOSS_TYPES.filter(e=>sprites.has(e.sprite));
  }
  if(mapStage>=2){
    const sprites=new Set(['miniboss_executioner','miniboss_horror','miniboss_skeleton_lord','miniboss_warden']);
    return MINIBOSS_TYPES.filter(e=>sprites.has(e.sprite));
  }
  const sprites=new Set(['miniboss_colossus','miniboss_troll','miniboss_executioner']);
  return MINIBOSS_TYPES.filter(e=>sprites.has(e.sprite));
}
function bossPool(){
  // THE OVERLORD (final boss) only on the final stage — overtime no longer forces it on early stages.
  if(mapStage>=3) return [BOSS_TYPES[BOSS_TYPES.length-1]];
  if(mapStage>=2) return BOSS_TYPES.filter(b=>['Soul Reaper','Void Wyrm'].includes(b.name));
  return BOSS_TYPES.filter(b=>!b.final && ['Lich King','Abyssal Behemoth'].includes(b.name));
}
function spawnEnemy(t, px, pz) {
  if (enemies.length >= maxEnemies) return;
  if (!t) t=pickEnemyType({ allowWarder:true });
  let x, z;
  if (px!==undefined){ x=clamp(px,-MAP_BOUND,MAP_BOUND); z=clamp(pz,-MAP_BOUND,MAP_BOUND); }
  else { const ang=Math.random()*Math.PI*2, d=24+Math.random()*6; x=clamp(player.x+Math.cos(ang)*d,-MAP_BOUND,MAP_BOUND); z=clamp(player.z+Math.sin(ang)*d,-MAP_BOUND,MAP_BOUND); }
  const curseHpMul = 1 + (player.cursedHp||0);
  const curseAtkMul = 1 + (player.cursedAtk||0);
  const hpSc=normalHpScale(t.tier)*curseHpMul, atkSc=normalAtkScale(t.tier)*curseAtkMul;
  const { spr, anim } = entitySprite(t.sprite, t.h);
  const sh = makeEnemyShadow(t.h*0.32);
  scene.add(spr);
  enemies.push({ x, z, hp:t.hp*hpSc, maxHp:t.hp*hpSc, atk:Math.round(t.atk*atkSc), spd:t.spd*SPD_SCALE,
                 xp:t.xp, r:t.h*0.32, name:t.name, alive:true, cd:0, flash:0, isBoss:false, behavior:behaviorFor(t.name), airborne:AIRBORNE.has(t.name), kx:0, kz:0, atkCd:1+Math.random(), chargeCd:1.5+Math.random()*2, charging:0, bw:spr.scale.x, bh:spr.scale.y, born:gameTime, face:1, anim, spr, sh });
}
function spawnCluster(count){
  const t=pickEnemyType({ allowWarder:false });
  const center=pointAroundPlayer(22,28,false);
  if(!center) return;
  const cx=center.x, cz=center.z;
  const supportPool=hasTrait(t,BUFFERS)
    ? enemyPool().filter(e=>e.name!==t.name && !BUFFERS.has(e.name) && !SHIELDERS.has(e.name) && !WARDERS.has(e.name))
    : null;
  for(let i=0;i<count;i++){
    const a=(i/Math.max(1,count))*Math.PI*2+Math.random()*0.35;
    const r=1.2+Math.sqrt(i)*0.9;
    const unit=(supportPool && i>0 && supportPool.length) ? supportPool[(Math.random()*supportPool.length)|0] : t;
    spawnEnemy(unit, cx+Math.cos(a)*r, cz+Math.sin(a)*r);
  }
  maybeSpawnWarder(cx,cz);
}

function spawnMiniboss() {
  const pool=minibossPool();
  const t = pool[(Math.random()*pool.length)|0];
  const ang = Math.random()*Math.PI*2, d = 26;
  const x = clamp(player.x + Math.cos(ang)*d, -MAP_BOUND, MAP_BOUND);
  const z = clamp(player.z + Math.sin(ang)*d, -MAP_BOUND, MAP_BOUND);
  const hpSc=minibossHpScale(), atkSc=atkTimeScale()*1.15*stageAtkMul()*otPowerMul();
  const { spr, anim } = entitySprite(t.sprite, t.h);
  const sh = makeShadow(t.h*0.34);
  scene.add(spr); scene.add(sh);
  enemies.push({ x, z, hp:t.hp*hpSc, maxHp:t.hp*hpSc, atk:Math.round(t.atk*atkSc*(typeof difficultyBossAtkMul==='function'?difficultyBossAtkMul():1)), spd:t.spd*SPD_SCALE*MINIBOSS_SPEED_MUL,
                 xp:t.xp, r:t.h*0.30, name:t.name, alive:true, cd:0, flash:0, isBoss:true, isMiniboss:true, behavior:'chase', kx:0, kz:0, atkCd:0, chargeCd:0, charging:0, bw:spr.scale.x, bh:spr.scale.y, born:gameTime, face:1, anim, spr, sh });
  assignSkills(enemies[enemies.length-1], MB_SKILLS[t.sprite] || ['ring','charge']);
  { const mb=enemies[enemies.length-1]; mb.aura=makeBossAura(0xff3f66, mb.r*1.85, false); mb.tint=0xffe3e8; }
  spawnObjectPulse(x,z,0xff3f66,t.h*1.8,0.75); spawnBurst(x,z,0xff6a82,18,1.0); shake(0.22,0.16);
  showToast('\u26a0 ' + t.name + ' ปรากฏตัว!', 2.0);
}

// low-poly 3D gothic trees — 5 variants (haunted twilight)
function leafMat(hex, vary){ return new THREE.MeshStandardMaterial({ color:new THREE.Color(hex).multiplyScalar(0.78+Math.random()*(vary||0.4)), roughness:1, flatShading:true }); }
function glowMat(hex, inten){ return new THREE.MeshStandardMaterial({ color:0x0b0b14, emissive:new THREE.Color(hex), emissiveIntensity:(inten||1.0), roughness:1, flatShading:true }); }
function blob(mat, r, x, y, z){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0), mat); m.position.set(x,y,z); m.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3); return m; }
function makeTree() {
  const g = new THREE.Group();
  const type = Math.floor(Math.random()*5);
  let trunkH = 1.0 + Math.random()*0.8, trunkR = 0.22, barkHex = 0x33251e;
  if (type===2){ trunkH = 1.6 + Math.random()*0.8; trunkR = 0.13; barkHex = 0x474038; }   // tall dead
  const barkMat = new THREE.MeshStandardMaterial({ color:new THREE.Color(barkHex).multiplyScalar(0.8+Math.random()*0.4), roughness:1, flatShading:true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR*0.6, trunkR, trunkH, 6), barkMat);
  trunk.position.y = trunkH/2; g.add(trunk);

  if (type===0) {                            // gnarled dark oak
    const mat = leafMat(0x2b4632, 0.4);
    g.add(blob(mat,0.95,0,trunkH+0.5,0)); g.add(blob(mat,0.62,0.4,trunkH+0.2,0.2));
    g.add(blob(mat,0.6,-0.34,trunkH+0.38,-0.22)); g.add(blob(mat,0.6,0.06,trunkH+0.95,0));
  } else if (type===1) {                     // dark pine
    const mat = leafMat(0x1e3a32, 0.35);
    for (const [r,y,h] of [[0.92,trunkH+0.1,1.0],[0.72,trunkH+0.75,0.88],[0.48,trunkH+1.4,0.7]])
      { const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,7), mat); m.position.y=y; g.add(m); }
  } else if (type===2) {                     // dead twisted — leaning, gnarled branches reaching up
    g.rotation.z = (Math.random()-0.5)*0.2;
    for (let i=0;i<6;i++){
      const len = 0.7 + Math.random()*0.9;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, len, 5), barkMat);
      const a = Math.random()*6.28;
      br.position.set(Math.cos(a)*0.13, trunkH*0.6 + i*0.16, Math.sin(a)*0.13);
      br.rotation.set((Math.random()*0.5+0.15)*Math.cos(a), a, (Math.random()*0.5+0.15)*Math.sin(a)*-1);
      g.add(br);
    }
  } else if (type===3) {                     // weeping willow (dark, drooping)
    const mat = leafMat(0x33402c, 0.4);
    g.add(blob(mat,0.7,0,trunkH+0.4,0));
    for (let i=0;i<6;i++){ const a=(i/6)*Math.PI*2; const d=new THREE.Mesh(new THREE.IcosahedronGeometry(0.3,0), mat);
      d.position.set(Math.cos(a)*0.7, trunkH+0.05, Math.sin(a)*0.7); d.scale.set(0.6,1.55,0.6); g.add(d); }
  } else {                                   // glowing spore tree (eerie)
    const mat = leafMat(0x24332e, 0.3);
    g.add(blob(mat,0.8,0,trunkH+0.45,0)); g.add(blob(mat,0.55,0.35,trunkH+0.2,0.2));
    const gm = glowMat(Math.random()<0.5?0x4fe0d8:0x9a6cff, 1.0);
    for (let i=0;i<6;i++){ const a=Math.random()*6.28, rad=0.4+Math.random()*0.4;
      const gb=new THREE.Mesh(new THREE.IcosahedronGeometry(0.12,0), gm);
      gb.position.set(Math.cos(a)*rad, trunkH+0.3+Math.random()*0.6, Math.sin(a)*rad); g.add(gb); }
  }
  const sc = 0.85 + Math.random()*0.6; g.scale.set(sc, sc, sc); g.rotation.y = Math.random()*6.28;
  return g;
}
// dark thorny bush, sometimes glowing berries
function makeBush() {
  const g = new THREE.Group();
  const mat = leafMat(0x2c4030, 0.4);
  const n = 2 + (Math.random()*3|0);
  for (let i=0;i<n;i++){ const r=0.4+Math.random()*0.35;
    g.add(blob(mat, r, (Math.random()-0.5)*0.7, r*0.75, (Math.random()-0.5)*0.7)); }
  if (Math.random()<0.45){ const gm=glowMat(Math.random()<0.5?0x6affa0:0x9a6cff, 0.9);
    for (let i=0;i<4;i++){ const b=new THREE.Mesh(new THREE.SphereGeometry(0.07,6,6), gm);
      b.position.set((Math.random()-0.5)*0.8, 0.35+Math.random()*0.5, (Math.random()-0.5)*0.8); g.add(b); } }
  const sc=0.8+Math.random()*0.6; g.scale.set(sc,sc,sc); return g;
}
// will-o-wisp orb OR pale mushroom cluster (replaces bright flowers)
function makeFlower() {
  const g = new THREE.Group();
  if (Math.random()<0.6) {                   // will-o-wisp
    const h=0.4+Math.random()*0.6;
    const hue=[0x4fe0d8,0x9a6cff,0x6affa0][(Math.random()*3)|0];
    const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(0.12+Math.random()*0.06,0), glowMat(hue,1.15));
    orb.position.y=h; g.add(orb);
  } else {                                   // pale mushroom cluster
    const capCol=[0x7a5a8a,0x4f7a76,0x8a8a9a][(Math.random()*3)|0];
    const n=1+(Math.random()*3|0);
    for (let i=0;i<n;i++){ const hh=0.18+Math.random()*0.22; const ox=(Math.random()-0.5)*0.4, oz=(Math.random()-0.5)*0.4;
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,hh,5), new THREE.MeshStandardMaterial({ color:0xc7c0d2, roughness:1 }));
      stem.position.set(ox,hh/2,oz); g.add(stem);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6), new THREE.MeshStandardMaterial({ color:capCol, emissive:new THREE.Color(capCol).multiplyScalar(0.35), roughness:1 }));
      cap.scale.y=0.6; cap.position.set(ox,hh,oz); g.add(cap); }
  }
  const sc=0.85+Math.random()*0.6; g.scale.set(sc,sc,sc); g.rotation.y=Math.random()*6.28; return g;
}
function spawnTrees(n) {
  const clusters=[];
  for (let i=0;i<13;i++) clusters.push({ cx:(Math.random()*2-1)*MAP_BOUND*0.9, cz:(Math.random()*2-1)*MAP_BOUND*0.9 });
  let placed=0, guard=0;
  while (placed<n && guard++<n*6){
    const cl=clusters[(Math.random()*clusters.length)|0];
    const x=cl.cx+(Math.random()*2-1)*9, z=cl.cz+(Math.random()*2-1)*9;
    if (Math.abs(x)>MAP_BOUND || Math.abs(z)>MAP_BOUND) continue;
    if (Math.hypot(x,z) < 7) continue;
    const r=Math.random();
    const key = r<0.30?'px_tree_pine' : r<0.60?'px_tree_oak' : r<0.78?'px_tree_willow' : r<0.92?'px_tree_dead' : 'px_tree_spore';
    const spr = billboard(key, 2.3+Math.random()*1.0);
    spr.position.set(x, groundHeight(x,z), z);
    scene.add(spr);
    const obstacle={ x, z, r:0.45 };
    obstacles.push(obstacle);
    worldScenery.push({ spr, obstacle });
    placed++;
  }
}
