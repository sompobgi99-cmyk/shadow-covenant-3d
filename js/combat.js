// ---- Tunables (world units; 1 unit ~= one 2D tile) ----
const PLAYER_SPEED = 4.6;
const DASH_SPEED = 26, DASH_DUR = 0.15, DASH_CD = 2.2;   // dash/dodge
const SPD_SCALE = 1/28;          // enemy px/s -> units/s
const MAP_BOUND = 56;            // playable half-extent
const PICKUP_MAGNET = 3.0, PICKUP_COLLECT = 0.7;
// ---- Weapons (active; multiple, gained/leveled via the level-up choices) ----
const WEAPON_TYPES = {
  bolt:   { name:'Void Bolt',      icon:'wpn_bolt',     desc:'ยิงกระสุนติดตามศัตรูที่ใกล้ที่สุด',  mode:'aim',
            dmg:12, rate:1.47, range:11, count:1, pierce:1, speed:16, life:1.3, color:0xb98aff, shape:'orb', evolveTo:'boltX', evolveTome:'might' },
  spread: { name:'Hex Spread',     icon:'wpn_spread', desc:'ยิงเศษเวทกระจายเป็นพัดไปด้านหน้า',    mode:'spread',
            dmg:8, rate:1.10, range:9, count:2, pierce:0, speed:15, life:0.9, color:0x66ccff, arc:0.38, shape:'shard', evolveTo:'spreadX', evolveTome:'multishot' },
  nova:   { name:'Nova Burst',     icon:'wpn_nova',  desc:'ระเบิดวงแหวนรอบตัว',    mode:'nova',
            dmg:17, rate:0.78, range:0, count:1, pierce:99, speed:12, life:0.6, color:0xffaa44, radius:2.8, evolveTo:'novaX', evolveTome:'growth' },
  orbit:  { name:'Orbiting Skull', icon:'wpn_orbit', desc:'กะโหลกวนรอบตัว โจมตีและช่วยกันดาเมจ',     mode:'orbit',
            dmg:9, count:2, color:0xff6688, orbitR:2.0, orbitSpd:3.45, tick:0.36, guardBlock:0.50, guardRecover:4.5, evolveTo:'orbitX', evolveTome:'precision' },
  arrow:  { name:"Hunter's Arrow",  icon:'wpn_arrow', desc:'ลูกธนูระยะไกลที่ยิงทะลุศัตรู',       mode:'aim',
            dmg:14, rate:0.97, range:15, count:1, pierce:3, speed:24, life:1.6, color:0x8ef06a, shape:'arrow', evolveTo:'arrowX', evolveTome:'velocity' },
  smite:  { name:'Holy Smite',      icon:'wpn_smite',  desc:'พลังศักดิ์สิทธิ์โจมตีจากด้านบน',  mode:'smite',
            dmg:19, rate:0.75, range:10, count:1, pierce:2, speed:14, life:1.4, color:0xfff2c0, radius:1.6, evolveTo:'smiteX', evolveTome:'growth' },
  lightning:{ name:'Lightning Strike', icon:'wpn_lightning', desc:'เรียกสายฟ้าฟาดเป้าหมายทีละตัว', mode:'smite',
            dmg:18, rate:0.94, range:11, count:1, pierce:1, speed:14, life:1.2, color:0x7ce7ff, radius:1.25, shape:'lightning', evolveTo:'lightningX', evolveTome:'focus' },
  dagger: { name:'Throwing Knives', icon:'wpn_dagger', desc:'ปามีดเร็วใส่ศัตรูใกล้ตัว', mode:'aim',
            dmg:9, rate:2.05, range:7.4, count:2, pierce:0, speed:26, life:0.9, color:0xdde7ff, shape:'dagger', evolveTo:'daggerX', evolveTome:'execution' },
  chidori_fang:{ name:'Chidori Fang', icon:'wpn_chidori_fang', desc:'อัดสายฟ้าสีม่วงเป็นก้อนแหลมแล้วยิงระยะสั้น ทะลุศัตรูและระเบิดเมื่อกระแทก', mode:'aim',
            dmg:25, rate:1.72, range:4.2, count:1, pierce:3, speed:18, life:0.24, charge:0.12, color:0xb45cff, shape:'chidori', evolveTo:'chidori_fangX', evolveTome:'execution' },
  toolstab:{ name:'Multi-Tool Screwdriver', icon:'wpn_screwdriver', desc:'แทงระยะประชิดอย่างรวดเร็ว ทะลุศัตรูทั้งแนว', mode:'stab',
            dmg:22, rate:2.42, range:3.0, count:1, pierce:99, speed:0, life:0.16, color:0x64d7ff, shape:'screwdriver', width:0.36, evolveTo:'toolstabX', evolveTome:'growth' },
  bladewhirl:{ name:'Blade Wave',   icon:'wpn_bladewhirl',     desc:'ปล่อยคลื่นดาบโค้งระยะสั้น', mode:'slash',
            dmg:15, rate:1.71, range:3.6, count:1, pierce:1, speed:8, life:0.38, color:0xff5566, arc:0.45, shape:'crescent', evolveTo:'bladewhirlX', evolveTome:'swiftness' },
  soulspiral:{ name:'Soul Spiral',  icon:'wpn_soulspiral',  desc:'ยิงวิญญาณหมุนวนรอบทิศ',       mode:'spiral',
            dmg:9, rate:2.21, range:0, count:2, pierce:1, speed:13, life:1.4, color:0xb06aff, shape:'soul', evolveTo:'soulspiralX', evolveTome:'duration' },
  football:{ name:'Cursed Football', icon:'wpn_football', desc:'ลูกบอลเด้งหาเป้าหมายใหม่ต่อเนื่อง', mode:'aim',
            dmg:11, rate:1.24, range:12, count:1, pierce:0, speed:21, life:1.45, color:0xf2f0d8, shape:'football', bounces:2, bounceRadius:9, bounceDmgMul:0.92, evolveTo:'footballX', evolveTome:'ricochet' },
  shieldtoss:{ name:'Shield Toss', icon:'wpn_shieldtoss', desc:'ขว้างโล่หนัก ทะลุก่อนเด้งกลับหาเป้าหมาย', mode:'aim',
            dmg:16, rate:0.90, range:11, count:1, pierce:1, speed:18, life:1.55, color:0x9fd8ff, shape:'shield', bounces:1, bounceRadius:8, bounceDmgMul:0.90, evolveTo:'shieldtossX', evolveTome:'fortitude' },
  boneboomerang:{ name:'Bone Boomerang', icon:'wpn_boneboomerang', desc:'กระดูกคู่โค้งเด้งระหว่างศัตรู', mode:'spread',
            dmg:11, rate:1.43, range:10, count:2, pierce:0, speed:17, life:1.35, color:0xe8dcc4, arc:0.36, shape:'bone_boomerang', bounces:1, bounceRadius:8, bounceDmgMul:0.86, evolveTo:'boneboomerangX', evolveTome:'duration' },
  bouncebomb:{ name:'Bouncing Bomb', icon:'wpn_bouncebomb', desc:'ระเบิดแตกตอนชนแล้วเด้งต่อไปยังเป้าหมายอื่น', mode:'aim',
            dmg:13, rate:0.86, range:10, count:1, pierce:0, speed:13, life:1.75, color:0xff9a4a, shape:'bomb', bounces:2, bounceRadius:8, bounceDmgMul:0.82, impactRadius:1.25, impactDmgMul:0.50, evolveTo:'bouncebombX', evolveTome:'impact' },
  bamboo_spikes:{ name:'Bamboo Spike Field', icon:'wpn_bamboo_spikes', desc:'วางพื้นเรียกหน่อไม้แทงขึ้นจากดินแบบกวน ๆ', mode:'bamboo',
            dmg:15, rate:0.78, range:9.5, count:2, pierce:99, speed:0, life:1.25, color:0xa8e36a, radius:1.45, shape:'bamboo', evolveTo:'bamboo_spikesX', evolveTome:'growth' },
  frost_familiar:{ name:'Frost Familiar', icon:'wpn_frost_familiar', desc:'Frost spirit that orbits the player and fires freezing shards.', mode:'familiar',
            dmg:16, rate:0.72, range:10.5, count:1, pierce:1, speed:17, life:7.5, color:0x9cecff, shape:'frost_shard', evolveTo:'frost_familiarX', evolveTome:'duration' },
  // evolved forms (hidden from the acquire pool)
  boltX:  { name:'Doom Bolt',      icon:'wpn_bolt_evolved',     desc:'ร่างวิวัฒน์: ยิงกระสุนทะลุเป็นชุด', mode:'aim', hidden:true,
            dmg:28, rate:2.4, range:13, count:2, pierce:4, speed:20, life:1.6, color:0xff66ff, shape:'doom' },
  spreadX:{ name:'Hex Storm',      icon:'wpn_spread_evolved', desc:'ร่างวิวัฒน์: พายุเศษเวทกระจายกว้าง',      mode:'spread', hidden:true,
            dmg:16, rate:1.6, range:11, count:5, pierce:2, speed:18, life:1.1, color:0x99eeff, arc:0.78, shape:'shard' },
  novaX:  { name:'Supernova',      icon:'wpn_nova_evolved',  desc:'ร่างวิวัฒน์: ระเบิดวงกว้างรุนแรง',    mode:'nova', hidden:true,
            dmg:24, rate:1.15, range:0, count:2, pierce:99, speed:15, life:0.8, color:0xffd24a, radius:4.5 },
  orbitX: { name:'Death Orbit',    icon:'wpn_orbit_evolved', desc:'ร่างวิวัฒน์: วงโคจรคู่และป้องกันดีขึ้น',      mode:'orbit', hidden:true,
            dmg:15, count:4, color:0xff3366, orbitR:3.0, orbitSpd:4.55, tick:0.21, guardBlock:0.72, guardRecover:3.2 },
  arrowX: { name:'Tempest Volley', icon:'wpn_arrow_evolved', desc:'ร่างวิวัฒน์: พายุลูกธนูทะลุฝูง',  mode:'aim', hidden:true,
            dmg:30, rate:1.7, range:18, count:3, pierce:6, speed:30, life:1.9, color:0xc8ff7a, shape:'arrow' },
  smiteX: { name:'Divine Judgment', icon:'wpn_smite_evolved', desc:'ร่างวิวัฒน์: พิพากษาจากสวรรค์', mode:'smite', hidden:true,
            dmg:40, rate:1.2, range:12, count:2, pierce:3, speed:14, life:1.4, color:0xffe9a0, radius:3.0 },
  lightningX:{ name:'Storm Tribunal', icon:'wpn_lightning_evolved', desc:'ร่างวิวัฒน์: สายฟ้าลูกโซ่พิพากษา', mode:'smite', hidden:true,
            dmg:31, rate:1.75, range:14, count:3, pierce:3, speed:14, life:1.4, color:0xa7f2ff, radius:2.2, shape:'lightning' },
  daggerX:{ name:'Execution Knives', icon:'wpn_dagger_evolved', desc:'ร่างวิวัฒน์: พายุมีดแทงทะลุ', mode:'aim', hidden:true,
            dmg:18, rate:3.35, range:9.8, count:5, pierce:2, speed:32, life:1.0, color:0xffd8f2, shape:'dagger' },
  chidori_fangX:{ name:'Raikiri Fang', icon:'wpn_chidori_fang_evolved', desc:'ร่างวิวัฒน์: ยิงเขี้ยวสายฟ้าขนาดใหญ่พร้อม Raijin Wraith และก้อนเสริมที่รุมเป้าหมายเดี่ยวได้', mode:'aim', hidden:true,
            dmg:42, rate:2.28, range:5.1, count:2, pierce:6, speed:21, life:0.25, charge:0.10, color:0xe2b8ff, shape:'chidori' },
  toolstabX:{ name:'Admin Override', icon:'wpn_screwdriver_evolved', desc:'ร่างวิวัฒน์: แทงกว้างหลายจังหวะแบบแก้ปัญหาเร่งด่วน', mode:'stab', hidden:true,
            dmg:34, rate:3.15, range:4.2, count:2, pierce:99, speed:0, life:0.18, color:0x7cffd8, shape:'screwdriver', width:0.55 },
  bladewhirlX:{ name:'Tempest Blades', icon:'wpn_bladewhirl_evolved', desc:'ร่างวิวัฒน์: พายุคลื่นดาบหลายชุด', mode:'slash', hidden:true,
            dmg:22, rate:2.4, range:4.6, count:3, pierce:3, speed:10, life:0.46, color:0xff7a88, arc:0.9, shape:'crescent' },
  soulspiralX:{ name:'Soul Tempest', icon:'wpn_soulspiral_evolved', desc:'ร่างวิวัฒน์: มรสุมวิญญาณหมุนวน', mode:'spiral', hidden:true,
            dmg:16, rate:3.0, range:0, count:4, pierce:3, speed:15, life:1.7, color:0xcf8aff, shape:'soul' },
  footballX:{ name:'Meteor Shot', icon:'wpn_football_evolved', desc:'ร่างวิวัฒน์: ลูกบอลหลายลูกเด้งพร้อมระเบิดกระแทก', mode:'aim', hidden:true,
            dmg:25, rate:1.75, range:14, count:2, pierce:0, speed:24, life:1.75, color:0xffd66a, shape:'football', bounces:4, bounceRadius:11, bounceDmgMul:0.92, impactRadius:0.9, impactDmgMul:0.35 },
  shieldtossX:{ name:'Aegis Rebound', icon:'wpn_shieldtoss_evolved', desc:'ร่างวิวัฒน์: โล่แรงขึ้นและเด้งผ่านฝูงศัตรู', mode:'aim', hidden:true,
            dmg:34, rate:1.35, range:13, count:2, pierce:2, speed:21, life:1.9, color:0xb8f0ff, shape:'shield', bounces:3, bounceRadius:10, bounceDmgMul:0.92 },
  boneboomerangX:{ name:'Grave Cyclone', icon:'wpn_boneboomerang_evolved', desc:'ร่างวิวัฒน์: พายุกระดูกเร็วขึ้นและเด้งเพิ่ม', mode:'spread', hidden:true,
            dmg:22, rate:2.1, range:12, count:3, pierce:1, speed:20, life:1.65, color:0xfff0ce, arc:0.55, shape:'bone_boomerang', bounces:2, bounceRadius:9, bounceDmgMul:0.90 },
  bouncebombX:{ name:'Chain Detonator', icon:'wpn_bouncebomb_evolved', desc:'ร่างวิวัฒน์: ระเบิดลูกโซ่ขนาดใหญ่ระหว่างเป้าหมาย', mode:'aim', hidden:true,
            dmg:27, rate:1.25, range:12, count:2, pierce:0, speed:15, life:2.0, color:0xffbd5f, shape:'bomb', bounces:3, bounceRadius:10, bounceDmgMul:0.86, impactRadius:2.0, impactDmgMul:0.70 },
  bamboo_spikesX:{ name:'Bamboo Forest Judgment', icon:'wpn_bamboo_spikes_evolved', desc:'ร่างวิวัฒน์: ป่าหน่อไม้แทงซ้ำหลายระลอก', mode:'bamboo', hidden:true,
            dmg:24, rate:1.15, range:11.5, count:4, pierce:99, speed:0, life:1.75, color:0xd9ff7a, radius:2.05, shape:'bamboo' },
  frost_familiarX:{ name:'Frozen Sentinel', icon:'wpn_frozen_sentinel', desc:'Evolution: crystal sentinels orbit longer and fire stronger frozen lances.', mode:'familiar', hidden:true,
            dmg:31, rate:0.96, range:12.5, count:2, pierce:2, speed:20, life:9.5, color:0xc8f5ff, shape:'frost_sentinel' },
};
const BONUS_COUNT_DMG_MUL = 0.65;
const GLOBAL_WEAPON_DMG_MUL = 1.0602;
const WEAPON_SYNERGIES=[
  {id:'divine_storm',name:'Divine Storm',pair:['smite','lightning'],desc:'Holy Smite has a 25% chance to call an extra Lightning Strike.'},
  {id:'aegis_covenant',name:'Aegis Covenant',pair:['orbit','shieldtoss'],desc:'Orbit guard blocks 15% more damage.'},
  {id:'grave_waltz',name:'Grave Waltz',pair:['soulspiral','boneboomerang'],desc:'Both weapons attack 25% faster.'},
  {id:'explosive_derby',name:'Explosive Derby',pair:['football','bouncebomb'],desc:'Impact radius increases by 40%.'},
  {id:'rangers_focus',name:"Ranger's Focus",pair:['bolt','arrow'],desc:'Projectile speed +30% and pierce +2.'},
  {id:'verdant_wrath',name:'Verdant Wrath',pair:['nova','bamboo_spikes'],desc:'Area radius increases by 20%.'},
  {id:'shadow_strike',name:'Shadow Strike',pair:['dagger','chidori_fang'],desc:'Critical damage +25%.'},
  {id:'hex_blade',name:'Hex Blade',pair:['bladewhirl','spread'],desc:'Both weapon arcs are 50% wider.'},
  {id:'close_quarters',name:'Close Quarters',pair:['toolstab','bladewhirl'],desc:'Melee range +25% and damage +15%.'}
];
function weaponMatchesFamily(key,base){
  const root=WEAPON_TYPES[base];
  return key===base || !!(root&&root.evolveTo===key);
}
function ownsWeaponFamily(base,p){
  const list=(p||player).weapons||[];
  for(let i=0;i<list.length;i++) if(weaponMatchesFamily(list[i].key,base)) return true;
  return false;
}
function hasWeaponSynergy(id,p){
  const syn=WEAPON_SYNERGIES.find(s=>s.id===id);
  return !!(syn&&ownsWeaponFamily(syn.pair[0],p)&&ownsWeaponFamily(syn.pair[1],p));
}
function activeWeaponSynergies(p){ return WEAPON_SYNERGIES.filter(s=>hasWeaponSynergy(s.id,p)); }
const BUILD_ARCHETYPES=[
  {id:'berserker',name:'Berserker',desc:'Below 50% HP with 200%+ damage: Damage +15%'},
  {id:'crimson_priest',name:'Crimson Priest',desc:'20% Lifesteal and 200+ Max HP: overheal becomes a temporary shield'},
  {id:'storm_caller',name:'Storm Caller',desc:'50% Crit with Lightning: critical hits gain a 10% lightning proc'},
  {id:'juggernaut',name:'Juggernaut',desc:'20+ Armor with Orbit: Guard blocks 10% more damage'},
  {id:'shadow_dancer',name:'Shadow Dancer',desc:'30% Evade and Dash below 1.5s: dash damages enemies passed through'},
  {id:'void_mage',name:'Void Mage',desc:'3 evolved weapons: evolved weapon damage +10%'}
];
function hasBuildArchetype(id,p){
  p=p||player;
  if(!p) return false;
  const armor=(p.def||0)*(p.armorMul||1);
  const evolved=(p.weapons||[]).filter(w=>w.evolved||((WEAPON_TYPES[w.key]||{}).hidden)).length;
  switch(id){
    case 'berserker': return p.hp<Math.max(1,p.maxHp)*0.5 && (p.dmgMul||1)>=2;
    case 'crimson_priest': return (p.lifestealPct||0)>=0.20 && p.maxHp>=200;
    case 'storm_caller': return (p.critChance||0)>=0.50 && ownsWeaponFamily('lightning',p);
    case 'juggernaut': return armor>=20 && ownsWeaponFamily('orbit',p);
    case 'shadow_dancer': return (p.evade||0)>=0.30 && (typeof DASH_CD==='number'?DASH_CD:2.2)*(p.dashCdMul||1)<1.5;
    case 'void_mage': return evolved>=3;
  }
  return false;
}
function activeBuildArchetypes(p){ return BUILD_ARCHETYPES.filter(a=>hasBuildArchetype(a.id,p)); }
function updateBuildArchetypes(){
  if(!player) return [];
  const active=activeBuildArchetypes(player);
  player._activeArchetypes=active.map(a=>a.id);
  player._seenArchetypes=player._seenArchetypes||{};
  for(const a of active){
    if(player._seenArchetypes[a.id]) continue;
    player._seenArchetypes[a.id]=1;
    showToast('BUILD COMPLETE: '+a.name,2.4);
    spawnObjectPulse(player.x,player.z,0xc994ff,5.5,0.55);
  }
  return active;
}
// ---- Items (pickup from enemy drops, stack unlimited) ----
const DROP_RATES = { common: 0.12, uncommon: 0.06, rare: 0.025, legendary: 0.005 };
const ITEMS = [
  // ═══════════════ 🟢 Common ═══════════════
  { id:'gym_sauce',   name:'Gym Sauce',      desc:'ดาเมจ +10%',              rarity:'common', icon:'item_gym_sauce',
    apply:p=>{ p.dmgMul*=1.10; } },
  { id:'oats',        name:'Oats',           desc:'เลือดสูงสุด +25',               rarity:'common', icon:'item_oats',
    apply:p=>{ p.maxHp+=25; p.hp+=25; } },
  { id:'turbo_socks', name:'Turbo Socks',    desc:'ความเร็วเดิน +15%',          rarity:'common', icon:'item_turbo_socks',
    apply:p=>{ p.spd*=1.15; } },
  { id:'time_brace',  name:'Time Bracelet',  desc:'XP ที่ได้รับ +8%',             rarity:'common', icon:'item_time_brace',
    apply:p=>{ p.xpMul*=1.08; } },
  { id:'gold_glove',  name:'Golden Glove',   desc:'ทองที่ได้รับ +15%',               rarity:'common', icon:'item_gold_glove',
    apply:p=>{ p.goldMul*=1.15; } },
  { id:'medkit',      name:'MedKit',         desc:'ฟื้นเลือด +0.5 ต่อวินาที',       rarity:'common', icon:'item_medkit',
    apply:p=>{ p.regen+=0.5; } },
  { id:'battery',     name:'Battery',        desc:'ความเร็วโจมตี +8%',        rarity:'common', icon:'item_battery',
    apply:p=>{ p.rateMul*=1.08; } },
  { id:'boss_buster', name:'Boss Buster',    desc:'ดาเมจต่อบอส/Elite +15%',  rarity:'common', icon:'item_boss_buster',
    apply:p=>{ p._bossBuster=(p._bossBuster||0)+1; } },
  { id:'ice_crystal', name:'Ice Crystal',    desc:'โจมตีมีโอกาสแช่แข็ง +10%',      rarity:'common', icon:'item_ice_crystal',
    apply:p=>{ p.freezeChance=(p.freezeChance||0)+0.10; } },
  { id:'frost_shard', name:'Frost Shard', desc:'โอกาสแช่แข็ง +6%', rarity:'common', icon:'item_frost_shard',
    apply:p=>{ p.freezeChance=(p.freezeChance||0)+0.06; } },
  { id:'clover',      name:'Clover',         desc:'Luck +7.5% ของดรอปดีขึ้น', rarity:'common', icon:'item_clover',
    apply:p=>{ p.luck=(p.luck||0)+0.075; } },
  { id:'wrench',      name:'Wrench',         desc:'ค่าหีบ -8% ต่อ stack', rarity:'common', icon:'item_wrench',
    apply:p=>{ p._wrench=(p._wrench||0)+1; } },
  { id:'slip_ring',   name:'Slippery Ring',  desc:'หลบหลีก +15%',            rarity:'common', icon:'item_slip_ring',
    apply:p=>{ p.evade=(p.evade||0)+0.15; } },
  { id:'lucky_charm', name:'Lucky Charm',    desc:'โอกาสคริติคอล +5%',         rarity:'common', icon:'item_lucky_charm',
    apply:p=>{ p.critChance+=0.05; } },
  { id:'dash_boots',  name:'Dash Boots',     desc:'คูลดาวน์พุ่งหลบ -10%',      rarity:'common', icon:'item_dash_boots',
    apply:p=>{ p.dashCdMul*=0.90; } },
  { id:'magnet_coil', name:'Magnet Coil',    desc:'ระยะดูดของ +18%', rarity:'common', icon:'item_magnet_coil',
    apply:p=>{ p.magnet*=1.18; } },
  { id:'swift_oil',   name:'Swift Oil',      desc:'ความเร็วกระสุน/วัตถุโจมตี +10%', rarity:'common', icon:'item_swift_oil',
    apply:p=>{ p.projSpeedMul*=1.10; } },
  // ═══════════════ 🔵 Uncommon ═══════════════
  { id:'backpack',    name:'Backpack',       desc:'จำนวนกระสุน/วัตถุโจมตีทุกอาวุธ +1', rarity:'uncommon', icon:'item_backpack',
    apply:p=>{ p.countBonus+=1; } },
  { id:'beer',        name:'Beer',           desc:'ดาเมจ +20%, เลือดสูงสุด -5%',  rarity:'uncommon', icon:'item_beer',
    apply:p=>{ p.dmgMul*=1.20; p.maxHp=Math.round(p.maxHp*0.95); p.hp=Math.min(p.hp,p.maxHp); } },
  { id:'brass_knuckle',name:'Brass Knuckles',desc:'ดาเมจต่อศัตรูใกล้ตัว +20%', rarity:'uncommon', icon:'item_brass_knuckle',
    apply:p=>{ p._brass=(p._brass||0)+1; } },
  { id:'echo_shard',  name:'Echo Shard',     desc:'โอกาสดรอป XP ซ้ำ +12%',     rarity:'uncommon', icon:'item_echo_shard',
    apply:p=>{ p.echoChance=(p.echoChance||0)+0.12; } },
  { id:'campfire',    name:'Campfire',       desc:'ยืนนิ่งแล้วฟื้นเลือด +2 ต่อวินาที', rarity:'uncommon', icon:'item_campfire',
    apply:p=>{ p._campfire=(p._campfire||0)+1; } },
  { id:'leech_crystal',name:'Leeching Crystal',desc:'เลือดสูงสุด +50, ฟื้นเลือด -50%', rarity:'uncommon', icon:'item_leech_crystal',
    apply:p=>{ p.maxHp+=50; p.hp+=50; p.regen*=0.5; } },
  { id:'frozen_heart', name:'Frozen Heart', desc:'ระยะเวลาแช่แข็ง +35%', rarity:'uncommon', icon:'item_frozen_heart',
    apply:p=>{ p.freezeDurationMul=(p.freezeDurationMul||1)*1.35; } },
  { id:'demon_blood', name:'Demonic Blood',  desc:'ฆ่าศัตรูแล้วเลือดสูงสุด +0.5 สูงสุด 200', rarity:'uncommon', icon:'item_demon_blood',
    apply:p=>{ p._demonBlood=(p._demonBlood||0)+1; } },
  { id:'idle_juice',  name:'Idle Juice',     desc:'ยืนนิ่ง 3 วิแล้วดาเมจ +100%', rarity:'uncommon', icon:'item_idle_juice',
    apply:p=>{ p._idle=(p._idle||0)+1; } },
  { id:'thunder_mitts',name:'Thunder Mitts', desc:'โจมตีมีโอกาส 10% เกิดสายฟ้า AoE', rarity:'uncommon', icon:'item_thunder_mitts',
    apply:p=>{ p.thunderChance=(p.thunderChance||0)+0.10; } },
  { id:'credit_card', name:'Credit Card',    desc:'เปิดหีบแล้วดาเมจ +2.5%', rarity:'uncommon', icon:'item_credit_card',
    apply:p=>{ p._creditCard=(p._creditCard||0)+1; } },
  { id:'sharpening_stone',name:'Sharpening Stone',desc:'ดาเมจคริติคอล +15%',   rarity:'uncommon', icon:'item_sharpening_stone',
    apply:p=>{ p.critDmg+=0.15; } },
  { id:'blink_feather',name:'Blink Feather', desc:'ระยะพุ่งหลบ +15%',      rarity:'uncommon', icon:'item_blink_feather',
    apply:p=>{ p.dashDistMul*=1.15; } },
  { id:'runic_lens',  name:'Runic Lens',     desc:'ขนาดสกิล +10%', rarity:'uncommon', icon:'item_runic_lens',
    apply:p=>{ p.projScale*=1.10; } },
  { id:'stopwatch',   name:'Stopwatch',      desc:'อายุกระสุน/วัตถุโจมตี +12%, ระยะเวลา AoE +6%', rarity:'uncommon', icon:'item_stopwatch',
    apply:p=>{ p.lifeMul*=1.12; p.areaLifeMul*=1.06; } },
  { id:'ricochet_charm',name:'Ricochet Charm',desc:'เด้งเพิ่ม +1 ครั้งสำหรับอาวุธที่รองรับ', rarity:'uncommon', icon:'item_ricochet_charm',
    apply:p=>{ p.ricochetBonus=(p.ricochetBonus||0)+1; } },
  // ═══════════════ 🟣 Rare ═══════════════
  { id:'beefy_ring',  name:'Beefy Ring',     desc:'ดาเมจ +20% ต่อเลือดสูงสุด 100', rarity:'rare', icon:'item_beefy_ring',
    apply:p=>{ p._beefy=(p._beefy||0)+1; } },
  { id:'spiky_shield',name:'Spiky Shield',   desc:'Thorns +2 ต่อเกราะ 1%',  rarity:'rare', icon:'item_spiky_shield',
    apply:p=>{ p.thorns=(p.thorns||0)+Math.max(1,Math.round(p.def*2)); } },
  { id:'shatter_know',name:'Shattered Knowledge',desc:'XP ที่ได้รับ +12%',        rarity:'rare', icon:'item_shatter_know',
    apply:p=>{ p.xpMul*=1.12; } },
  { id:'gamer_goggles',name:'Gamer Goggles', desc:'เลือดต่ำแล้วยิ่งแรง สูงสุด +60%', rarity:'rare', icon:'item_gamer_goggles',
    apply:p=>{ p._goggles=(p._goggles||0)+1; } },
  { id:'ice_crown', name:'Ice Crown', desc:'ดาเมจต่อศัตรูที่ถูกแช่แข็งหรือชะลอ +18%', rarity:'rare', icon:'item_ice_crown',
    apply:p=>{ p.frostbiteMul=(p.frostbiteMul||0)+0.18; } },
  { id:'demon_soul',  name:'Demonic Soul',   desc:'ฆ่าศัตรูแล้วดาเมจ +0.1% สูงสุด 100%', rarity:'rare', icon:'item_demon_soul',
    apply:p=>{ p._demonSoul=(p._demonSoul||0)+1; } },
  { id:'mirror',      name:'Mirror',         desc:'สะท้อนดาเมจกลับ 30%',  rarity:'rare', icon:'item_mirror',
    apply:p=>{ p.reflect=(p.reflect||0)+0.30; } },
  { id:'slurp_gloves',name:'Slurp Gloves',   desc:'ดูดเลือดตอนโจมตี +7.5%',  rarity:'rare', icon:'item_slurp_gloves',
    apply:p=>{ p.lifestealPct=(p.lifestealPct||0)+0.075; } },
  { id:'eagle_claw',  name:'Eagle Claw',     desc:'ดาเมจต่อศัตรูบิน +66%',    rarity:'rare', icon:'item_eagle_claw',
    apply:p=>{ p._eagle=(p._eagle||0)+1; } },
  { id:'execution_coin',name:'Execution Coin',desc:'ดาเมจคริติคอล +12%, คริติคอลอาจให้ทอง', rarity:'rare', icon:'item_execution_coin',
    apply:p=>{ p.critDmg+=0.12; p._executionCoin=(p._executionCoin||0)+1; } },
  { id:'phase_cloak', name:'Phase Cloak',    desc:'อมตะหลังพุ่งหลบ +0.12 วิ, หลบหลีก +5%', rarity:'rare', icon:'item_phase_cloak',
    apply:p=>{ p.dashInvulnBonus=(p.dashInvulnBonus||0)+0.12; p.evade=(p.evade||0)+0.05; } },
  { id:'battle_banner',name:'Battle Banner', desc:'บัฟ Haste/Might จากพื้นอยู่นานขึ้น +35%', rarity:'rare', icon:'item_battle_banner',
    apply:p=>{ p.buffDurationMul*=1.35; } },
  { id:'butcher_token',name:'Butcher Token', desc:'ดาเมจต่อ The Butcher และ Mimic +25%', rarity:'rare', icon:'item_butcher_token',
    apply:p=>{ p._butcherToken=(p._butcherToken||0)+1; } },
  // ═══════════════ 🟡 Legendary ═══════════════
  { id:'big_bonk',    name:'Big Bonk',       desc:'โอกาส 2% ทำดาเมจ 20 เท่า',  rarity:'legendary', icon:'item_big_bonk',
    apply:p=>{ p.bonkChance=(p.bonkChance||0)+0.02; } },
  { id:'holy_book',   name:'Holy Book',      desc:'เลือด +100, ฟื้นเลือด +5/วินาที',   rarity:'legendary', icon:'item_holy_book',
     apply:p=>{ p.maxHp+=100; p.hp+=100; p.regen+=5; } },
  { id:'soul_harvester',name:'Soul Harvester',desc:'ฆ่าศัตรูแล้วดรอป XP เพิ่ม และทองเพิ่มเล็กน้อย', rarity:'legendary', icon:'item_soul_harvester',
    apply:p=>{ p._soulHarv=(p._soulHarv||0)+1; } },
  { id:'singularity_core',name:'Singularity Core',desc:'ระยะดูด XP/ทอง +200%, ความเร็วดูด XP/ทอง +50%', rarity:'legendary', icon:'item_singularity_core',
    apply:p=>{ p.lootMagnetBonus=(p.lootMagnetBonus||0)+2.00; p.lootPullBonus=(p.lootPullBonus||0)+0.50; } },
  { id:'spicy_meatball',name:'Spicy Meatball',desc:'โจมตีมีโอกาส 25% ระเบิด 65% ดาเมจ', rarity:'legendary', icon:'item_spicy_meatball',
    apply:p=>{ p.spicyChance=(p.spicyChance||0)+0.25; } },
  { id:'chonkplate',  name:'Chonkplate',     desc:'Overheal +50%, ดูดเลือด 10% ของดาเมจที่ทำได้', rarity:'legendary', icon:'item_chonkplate',
    apply:p=>{ p.overheal=(p.overheal||0)+0.50; p.lifestealPct=(p.lifestealPct||0)+0.10; } },
  { id:'energy_core', name:'Energy Core',    desc:'ออร่าพลังงานเป็นจังหวะ ทำดาเมจรอบตัว', rarity:'legendary', icon:'item_energy_core',
    apply:p=>{ p._energyCore=(p._energyCore||0)+1; } },
  { id:'power_gloves',name:'Storm Gauntlets',desc:'ความเร็วโจมตี +40%, ความเร็วกระสุน/วัตถุ +12%, คูลดาวน์พุ่งหลบ -8%', rarity:'legendary', icon:'item_power_gloves',
    apply:p=>{ p.rateMul*=1.40; p.projSpeedMul*=1.12; p.dashCdMul*=0.92; } },
  { id:'dragonfire',  name:'Golden Sword',   desc:'ดาเมจ +99%', rarity:'legendary', icon:'item_dragonfire',
    apply:p=>{ p.dmgMul*=1.99; } },
  { id:'glass_needle',name:'Glass Needle',   desc:'โอกาสคริติคอล +25%, ดาเมจคริติคอล +75%, เลือดสูงสุด -15%', rarity:'legendary', icon:'item_glass_needle',
    apply:p=>{ p.critChance+=0.25; p.critDmg+=0.75; p.maxHp=Math.max(1,Math.round(p.maxHp*0.85)); p.hp=Math.min(p.hp,p.maxHp); } },
  { id:'royal_jelly', name:'Royal Jelly',    desc:'Luck +20%, ทอง +20%, XP +10%', rarity:'legendary', icon:'item_royal_jelly',
    apply:p=>{ p.luck=(p.luck||0)+0.20; p.goldMul*=1.20; p.xpMul*=1.10; } },
];
const RARITY_COLORS = { common:0x7ecf5a, uncommon:0x5a9ecf, rare:0xcf5acf, legendary:0xcfc05a };
const RARITY_GLOW = { common:0x44ff44, uncommon:0x44aaff, rare:0xff44ff, legendary:0xffdd44 };
function scaledSkillStat(raw, gain, cap){
  return Math.min(cap, 1 + (Math.max(1,raw||1)-1)*gain);
}
function skillSizeMul(mode){
  if(mode==='aoe') return scaledSkillStat(player.projScale,0.65,1.75);
  if(mode==='bamboo') return scaledSkillStat(player.projScale,0.50,1.35);
  if(mode==='melee') return scaledSkillStat(player.projScale,0.65,1.60);
  return scaledSkillStat(player.projScale,0.65,1.40);
}
function skillRangeMul(mode){
  if(mode==='melee') return scaledSkillStat(player.rangeMul,0.75,1.60);
  if(mode==='placement') return scaledSkillStat(player.rangeMul,0.75,1.65);
  if(mode==='orbit') return scaledSkillStat(player.rangeMul,0.75,1.60);
  if(mode==='bounce') return scaledSkillStat(player.rangeMul,0.65,1.50);
  return scaledSkillStat(player.rangeMul,0.75,1.75);
}
function wstats(key, lvl){
  const b = WEAPON_TYPES[key], s = Object.assign({}, b), k = lvl-1;
  s.sourceKey = key;
  s.baseCount = Math.max(1, b.count||1);
  s.dmg = Math.round(b.dmg * GLOBAL_WEAPON_DMG_MUL * (1 + 0.15*k) * (player.dmgMul||1) * (1+(player.pickupDmgBoost||0)));
  const bonus=player.countBonus||0;
  if (b.mode === 'orbit'){
    s.count = b.count + Math.floor(k/2) + bonus;
    s.orbitR = b.orbitR * (1 + 0.055*k) * skillRangeMul('orbit');
    s.skillSizeMul = skillSizeMul('projectile');
    s.tick = b.tick * Math.pow(0.90, k) / (player.rateMul||1);   // orbs hit faster per level + attack speed
    if(player.environmentConduitActive) s.tick/=(player.environmentConduitMul||1.40);
  } else {
    const step=b.mode==='nova'||b.mode==='slash'||b.mode==='bamboo' ? 4 : 3;
    s.count = b.count + Math.floor(k/step) + bonus;
    s.rate  = b.rate * (1 + 0.06*k) * (player.rateMul||1);
    if(player.environmentConduitActive) s.rate*=(player.environmentConduitMul||1.40);
    const rangeMode=b.mode==='stab'||b.mode==='slash'?'melee':b.mode==='smite'||b.mode==='bamboo'?'placement':'projectile';
    const rangeScale=b.mode==='nova'?1:skillRangeMul(rangeMode);
    s.range = b.range * rangeScale;
    if (b.mode==='bamboo') s.range = Math.min(s.range, key==='bamboo_spikesX'?17.0:14.5);
    s.life  = b.life * (player.lifeMul||1) * ((b.mode==='aim'||b.mode==='spread'||b.mode==='spiral'||b.mode==='slash')?rangeScale:1);
    s.areaLife = player.areaLifeMul||1;
    s.speed = b.speed * (player.projSpeedMul||1);
    s.skillSizeMul = skillSizeMul(b.mode==='nova'||b.mode==='smite'?'aoe':b.mode==='bamboo'?'bamboo':b.mode==='stab'||b.mode==='slash'?'melee':'projectile');
    if (b.radius) {
      s.radius = b.radius * (1 + 0.055*k) * s.skillSizeMul;
      if (b.mode==='nova') s.radius = Math.min(s.radius, key==='novaX'?8.6:6.2);
      if (b.mode==='bamboo') s.radius = Math.min(s.radius, key==='bamboo_spikesX'?2.45:1.65);
      if (b.mode==='smite') {
        const cap=weaponMatchesFamily(key,'lightning')
          ? (key==='lightningX'?3.8:2.8)
          : (key==='smiteX'?4.8:3.2);
        s.radius=Math.min(s.radius,cap);
      }
    }
    if (b.bounces != null) {
      s.bounces = Math.max(0, (b.bounces||0) + (player.ricochetBonus||0));
      s.bounceRadius = (b.bounceRadius||8) * skillRangeMul('bounce');
      s.bounceDmgMul = b.bounceDmgMul || 0.88;
    }
    if (b.impactRadius) s.impactRadius = b.impactRadius * (1 + 0.04*k) * skillSizeMul('aoe');
    if (b.impactDmgMul) s.impactDmgMul = b.impactDmgMul;
  }
  if(hasWeaponSynergy('grave_waltz')&&(weaponMatchesFamily(key,'soulspiral')||weaponMatchesFamily(key,'boneboomerang'))) s.rate*=1.25;
  if(hasWeaponSynergy('rangers_focus')&&(weaponMatchesFamily(key,'bolt')||weaponMatchesFamily(key,'arrow'))){ s.speed*=1.30; s.pierce=(s.pierce||0)+2; }
  if(hasWeaponSynergy('verdant_wrath')&&(weaponMatchesFamily(key,'nova')||weaponMatchesFamily(key,'bamboo_spikes'))){
    const radiusCap=weaponMatchesFamily(key,'nova')
      ? (key==='novaX'?8.6:6.2)
      : (key==='bamboo_spikesX'?2.45:1.65);
    s.radius=Math.min(radiusCap,(s.radius||1)*1.20);
  }
  if(hasWeaponSynergy('explosive_derby')&&(weaponMatchesFamily(key,'football')||weaponMatchesFamily(key,'bouncebomb'))){ s.impactRadius=(s.impactRadius||0.72)*1.40; s.impactDmgMul=s.impactDmgMul||0.30; }
  if(hasWeaponSynergy('hex_blade')&&(weaponMatchesFamily(key,'bladewhirl')||weaponMatchesFamily(key,'spread'))) s.arc=(s.arc||0.45)*1.50;
  if(hasWeaponSynergy('close_quarters')&&(weaponMatchesFamily(key,'toolstab')||weaponMatchesFamily(key,'bladewhirl'))){ s.range=Math.min(b.range*1.60,s.range*1.25); s.dmg=Math.round(s.dmg*1.15); }
  if(hasBuildArchetype('berserker')) s.dmg=Math.round(s.dmg*1.15);
  if(hasBuildArchetype('void_mage')&&(b.hidden||key.endsWith('X'))) s.dmg=Math.round(s.dmg*1.10);
  return s;
}
function damageForCountSlot(s,i){
  return i < (s.baseCount||1) ? s.dmg : Math.max(1, Math.round(s.dmg*BONUS_COUNT_DMG_MUL));
}
function statsForCountSlot(s,i){
  const dmg=damageForCountSlot(s,i);
  return dmg===s.dmg ? s : Object.assign({},s,{ dmg });
}
function makeWeapon(key){ return { key, lvl:1, cd:0, orbs:[] }; }

function syncOrbitGuard(w, s){
  const max=Math.max(0, s.count|0);
  if(w.guardActive==null){ w.guardActive=max; w.guardMax=max; w.guardCd=0; }
  if(w.guardMax!==max){
    const diff=max-(w.guardMax||0);
    w.guardActive=Math.max(0, Math.min(max, (w.guardActive||0)+Math.max(0,diff)));
    w.guardMax=max;
    if(w.guardActive>=max) w.guardCd=0;
  }
}

function trySkullGuard(amt, src){
  if((player.skullGuardHitCd||0)>0) return { blocked:false, amount:amt };
  let best=null, bestStats=null;
  for(const w of player.weapons||[]){
    const b=WEAPON_TYPES[w.key];
    if(!b || b.mode!=='orbit') continue;
    const s=wstats(w.key,w.lvl);
    syncOrbitGuard(w,s);
    if((w.guardActive||0)>0){ best=w; bestStats=s; break; }
  }
  if(!best) return { blocked:false, amount:amt };
  const b=WEAPON_TYPES[best.key]||{};
  const block=Math.max(0, Math.min(0.9, (b.guardBlock||0.5)+(hasWeaponSynergy('aegis_covenant')?0.15:0)+(hasBuildArchetype('juggernaut')?0.10:0)));
  recordRunItem(best.key==='orbitX'?'orbitX':'orbit',{ procs:1, blocked:Math.round(amt*block) });
  best.guardActive=Math.max(0,(best.guardActive||0)-1);
  best.guardCd=b.guardRecover||5;
  player.skullGuardHitCd=0.25;
  const color=best.key==='orbitX'?0xff335f:0xff7aa0;
  spawnRing(player.x, player.z, color, 2.4, 0.25);
  spawnBurst(player.x, player.z, color, best.key==='orbitX'?14:9, 0.85);
  sfx('guard');
  spawnDmg(player.x, player.z, Math.round(amt*block), color, false, 'guard');
  if(src && src.alive && best.key==='orbitX'){
    dealEnemyDamage(src, Math.max(1, Math.round(bestStats.dmg*1.4)), color, src.x-player.x, src.z-player.z, 2.2, true, { weapon:best.key });
  }
  return { blocked:true, amount:Math.max(1, Math.round(amt*(1-block))) };
}

// ---- Centralized damage: every weapon/proc routes through here ----
// Applies per-target item multipliers, shield, crits, knockback, on-hit procs.
function hitMul(e){
  let m = 1;
  if ((e.isBoss||e.elite) && player._bossBuster) m *= 1 + 0.15*player._bossBuster;
  if ((e.isBoss||e.elite) && player._executionSeal) m *= 1.25;
  if (player._brass){ const dx=e.x-player.x, dz=e.z-player.z; if (dx*dx+dz*dz < 9) m *= 1 + 0.20*player._brass; }
  if (player._eagle && e.airborne) m *= 1 + 0.66*player._eagle;
  if (player._creditCard) m *= 1 + 0.025*player._creditCard*chestsOpened;
  if (player._idle && (player.stillT||0) > 3) m *= 1 + 1.0*player._idle;
  if (player.frostbiteMul && e.slowT > 0) m *= 1 + player.frostbiteMul;
  if (player.killDmgBonus) m *= 1 + player.killDmgBonus;
  if (player._cursedEye && e._cursedEyeUntil && e._cursedEyeUntil > (typeof gameTime==='number'?gameTime:0)) m *= 1 + Math.min(0.30, player._cursedEye);
  return m;
}
function rollCrit(meta){
  const guaranteedFamily=player && player._sigGuaranteedCritFamily;
  const guaranteedHit=!!(guaranteedFamily && meta && meta.weapon && weaponMatchesFamily(meta.weapon,guaranteedFamily));
  if(guaranteedHit){   // Huntress True Shot: only the matching weapon family consumes it
    player._sigGuaranteedCritFamily='';
    const now=typeof gameTime==='number'?gameTime:0;
    const chain=now < (player._critChainUntil||0) ? Math.min(5,(player._critChain||0)+1) : 1;
    player._critPity=0; player._critChain=chain; player._critChainUntil=now+1.1;
    return { crit:true, mul:Math.max(1,(player.critDmg||1.5)+(hasWeaponSynergy('shadow_strike')?0.25:0))*(1+0.04*(chain-1)), chain };
  }
  const base=Math.max(0, player.critChance||0);
  const overflow=Math.max(0, base-1);
  const pity=Math.min(0.12, (player._critPity||0)*0.015);
  const chance=Math.max(0, Math.min(1, base+pity));
  if(chance<=0 || Math.random()>=chance){
    player._critPity=Math.min(10,(player._critPity||0)+1);
    return { crit:false, mul:1, chain:0 };
  }
  const now=typeof gameTime==='number'?gameTime:0;
  const chain=now < (player._critChainUntil||0) ? Math.min(5,(player._critChain||0)+1) : 1;
  player._critPity=0;
  player._critChain=chain;
  player._critChainUntil=now+1.1;
  return { crit:true, mul:Math.max(1, (player.critDmg||1.5)+overflow+(hasWeaponSynergy('shadow_strike')?0.25:0))*(1+0.04*(chain-1)), chain };
}
let raijinWraithTexture=null;
function getRaijinWraithTexture(){
  if(typeof tex!=='undefined' && tex.fx_raijin_wraith) return tex.fx_raijin_wraith;
  if(raijinWraithTexture) return raijinWraithTexture;
  const cv=document.createElement('canvas'); cv.width=48; cv.height=64;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const px=(x,y,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  const dark='rgba(30,8,64,0.76)', mid='rgba(128,54,224,0.84)', light='rgba(224,164,255,0.94)', white='rgba(255,238,255,0.98)';
  px(21,2,6,5,light); px(18,7,12,8,mid); px(16,13,16,8,dark);
  px(12,19,24,20,dark); px(15,21,18,16,mid); px(20,24,8,8,light);
  px(8,18,8,20,dark); px(32,18,8,20,dark); px(5,30,9,7,mid); px(34,30,9,7,mid);
  px(18,39,12,10,dark); px(14,49,20,5,mid); px(11,55,26,3,dark);
  px(13,10,4,4,light); px(31,10,4,4,light); px(22,15,4,3,white);
  px(7,8,4,8,mid); px(37,8,4,8,mid); px(3,14,5,3,light); px(40,14,5,3,light);
  px(4,42,8,2,light); px(36,42,8,2,light); px(17,57,14,2,light);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  raijinWraithTexture=t; return t;
}
let cursedEyeMarkTexture=null;
function getCursedEyeMarkTexture(){
  if(cursedEyeMarkTexture) return cursedEyeMarkTexture;
  const cv=document.createElement('canvas'); cv.width=32; cv.height=32;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const px=(x,y,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  const dark='rgba(34,8,72,0.92)', mid='rgba(164,70,255,0.94)', light='rgba(232,168,255,0.96)', white='rgba(255,238,255,0.98)';
  px(8,15,16,2,dark); px(6,13,4,2,mid); px(22,13,4,2,mid); px(10,11,12,2,mid); px(10,19,12,2,mid);
  px(13,12,6,8,dark); px(14,13,4,6,mid); px(15,14,2,4,light); px(16,15,1,2,white);
  px(15,4,2,5,mid); px(15,23,2,5,mid); px(4,15,5,2,mid); px(23,15,5,2,mid);
  px(8,7,3,3,light); px(21,7,3,3,light); px(8,22,3,3,light); px(21,22,3,3,light);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  cursedEyeMarkTexture=t; return t;
}
function ensureCursedEyeMark(e){
  if(e.cursedEyeMark) return e.cursedEyeMark;
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({
    map:getCursedEyeMarkTexture(), color:0xffffff, transparent:true, opacity:0.92,
    alphaTest:0.08, depthWrite:false, blending:THREE.AdditiveBlending
  }));
  spr.scale.set(0.82,0.82,1);
  scene.add(spr);
  e.cursedEyeMark=spr;
  return spr;
}
function currentChidoriWeapon(){
  return (player.weapons||[]).find(w=>w.key==='chidori_fang'||w.key==='chidori_fangX') || null;
}
function spawnRaijinWraith(target, seedDamage, meta){
  if(!player || player.char!=='kuro_raijin' || !target || !target.alive) return false;
  if(meta && meta.raijinWraith) return false;
  const w=currentChidoriWeapon();
  if(!w) return false;
  const now=typeof gameTime==='number'?gameTime:0;
  const evolved=w.key==='chidori_fangX';
  if(now < (player._raijinWraithReadyAt||0)) return false;
  player._raijinWraithReadyAt = now + (evolved ? 1.60 : 2.20);
  let dx=target.x-player.x, dz=target.z-player.z;
  const len=Math.hypot(dx,dz)||1; dx/=len; dz/=len;
  const s=wstats(w.key,w.lvl);
  const range=evolved?5.9:5.2, width=evolved?1.75:1.42;
  const dmg=Math.max(1,Math.round(s.dmg*(evolved?1.35:1.60)));
  const color=evolved?0xe2b8ff:0xb45cff;
  const group=new THREE.Group();
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({
    map:getRaijinWraithTexture(), color:color, transparent:true, opacity:0.22,
    alphaTest:0.04, depthWrite:false, blending:THREE.AdditiveBlending
  }));
  glow.scale.set(evolved?3.15:2.78,evolved?4.05:3.62,1);
  glow.position.set(player.x-dx*0.86,groundHeight(player.x,player.z)+1.72,player.z-dz*0.86);
  glow.userData.fxOpacity=0.22;
  group.add(glow);
  const avatar=new THREE.Sprite(new THREE.SpriteMaterial({
    map:getRaijinWraithTexture(), color:0xffffff, transparent:true, opacity:0.82,
    alphaTest:0.08, depthWrite:false, blending:THREE.NormalBlending
  }));
  avatar.scale.set(evolved?2.8:2.45,evolved?3.65:3.25,1);
  avatar.position.set(player.x-dx*0.82,groundHeight(player.x,player.z)+1.72,player.z-dz*0.82);
  avatar.userData.fxOpacity=0.82;
  group.add(avatar);
  const slash=new THREE.Sprite(new THREE.SpriteMaterial({
    map:getPixelProjectileTexture('chidori',color), color:0xffffff, transparent:true, opacity:0.96,
    alphaTest:0.08, depthWrite:false, blending:THREE.AdditiveBlending
  }));
  slash.material.rotation=-Math.atan2(dz,dx);
  slash.scale.set(range*0.92,width*0.74,1);
  slash.position.set(player.x+dx*range*0.46,groundHeight(player.x,player.z)+1.05,player.z+dz*range*0.46);
  slash.userData.fxOpacity=0.98;
  group.add(slash);
  scene.add(group);
  capEffectList(slashFx, MAX_SLASH_FX);
  slashFx.push({ mesh:group, life:1.0, max:1.0, hold:0.65, grow:0.14, fade:0.95, baseScale:group.scale.clone() });
  spawnRing(player.x,player.z,color,2.2,0.22);
  spawnObjectPulse(player.x,player.z,0xa54cff,evolved?5.4:4.6,0.42);
  spawnBurst(player.x,player.z,color,evolved?18:12,evolved?1.05:0.82);
  if(evolved) spawnDmg(player.x,player.z,'RAIJIN',color,false,'critproc');
  forEachNearbyEnemy(player.x,player.z,range+2,e=>{
    if(!e.alive) return;
    const ex=e.x-player.x, ez=e.z-player.z;
    const along=ex*dx+ez*dz;
    if(along<0 || along>range) return;
    const side=Math.abs(ex*dz-ez*dx);
    if(side <= width+e.r) dealEnemyDamage(e,dmg,color,dx,dz,3.2,true,{ weapon:w.key, raijinWraith:true });
  });
  hitBreakablesAt(player.x+dx*range*0.52,player.z+dz*range*0.52,width+0.8,dmg,color);
  return true;
}
function onCritProcs(e,d,color,meta,chain){
  if(!e || !e.alive || d<=0) return;
  if(runStats) runStats.critHits=(runStats.critHits||0)+1;
  const now=typeof gameTime==='number'?gameTime:0;
  const wasCursed=!!(player._cursedEye && e._cursedEyeUntil && e._cursedEyeUntil>now);
  if(player._cursedEye){
    e._cursedEyeUntil=now+3.0;
    e._cursedEyeMul=Math.min(0.30,player._cursedEye);
    ensureCursedEyeMark(e);
  }
  if(wasCursed) spawnRaijinWraith(e,d,meta);
  if(hasBuildArchetype('storm_caller')&&!(meta&&meta.archetypeStorm)&&Math.random()<0.10){
    const targets=nearestEnemies(e.x,e.z,7,2);
    for(const hit of targets){
      const target=hit&&hit.e?hit.e:hit;
      if(target&&target.alive) dealEnemyDamage(target,Math.max(1,d*0.45),0x8deaff,target.x-e.x,target.z-e.z,0,true,{weapon:'lightning',archetypeStorm:true});
    }
    spawnRing(e.x,e.z,0x8deaff,3.2,0.25);
  }
  e.bleedDps=Math.max(e.bleedDps||0, d*0.10*(1+0.12*Math.max(0,(chain||1)-1)));
  e.bleedT=Math.max(e.bleedT||0,1.6);
  e.bleedMeta=meta||null;
  if(now>(player._critFxAt||0)){
    player._critFxAt=now+0.12;
    spawnRing(e.x,e.z,0xffd86a,Math.max(1.2,e.r*1.7),0.20);
    spawnBurst(e.x,e.z,0xffd86a,chain>=3?7:4,chain>=3?0.72:0.52);
    if(chain>=3) spawnDmg(e.x,e.z,'CHAIN x'+chain,0xffd86a,false,'critproc');
  }
}
function dealEnemyDamage(e, dmg, color, kx, kz, kbCap, noProc, meta){
  if (!e.alive) return;
  let d = dmg * hitMul(e);
  if (player.bonkChance && Math.random() < player.bonkChance) d *= 20;   // Big Bonk
  const crit=rollCrit(meta);
  if(crit.crit) d *= crit.mul;
  if (e.shieldT > 0) d *= 0.4;                                           // Warden shield
  if(e.guardT>0){
    let sx=-(kx||0),sz=-(kz||0),sd=Math.hypot(sx,sz);
    if(sd<0.01){sx=player.x-e.x;sz=player.z-e.z;sd=Math.hypot(sx,sz);}
    const facingD=Math.hypot(e.guardFacingX||0,e.guardFacingZ||0)||1;
    const front=sd>0&&((sx/sd)*(e.guardFacingX||0)/facingD+(sz/sd)*(e.guardFacingZ||0)/facingD)>0.15;
    if(front){d*=0.45;if(gameTime>(e.guardBlockFxAt||0)){e.guardBlockFxAt=gameTime+0.22;spawnDmg(e.x,e.z,'GUARD',0xffd86a,false,'guard');spawnRing(e.x,e.z,0xd8b45a,e.r*1.45,0.18);}}
  }
  if (e.damageTakenMul != null) d *= Math.max(0.05, e.damageTakenMul);    // boss armor/resistance
  d = Math.round(d);
  if (!Number.isFinite(d) || d < 0) d = 0;
  const immune = !!(e.final && e.finalPhase && e.phaseInvuln>0);
  if (!immune && dmg > 0 && d < 1) d = 1;
  const hpBefore=e.hp;
  if(e.final && e.finalPhase){
    if(immune) d = 0;
    const floor = (e.finalPhase>1 || e.phaseInvuln>0) ? 1 : -Infinity;
    e.hp = Math.max(floor, e.hp - d);
  } else {
    e.hp -= d;
    if(e.hp<=0 && isDeathWarded(e)){
      e.hp=1;
      spawnDmg(e.x,e.z,'WARD',0x9a55ff,false,'guard');
      spawnBurst(e.x,e.z,0x9a55ff,5,0.55);
    }
  }
  e.flash = 0.08;
  spawnDmg(e.x, e.z, immune ? 'IMMUNE' : d, color, crit.crit && d > 0, immune ? 'immune' : '');
  recordRunDamage(d, meta);
  if(d>0) sfx(crit.crit?'crit':'hit');
  if(d>0 && player.lifestealPct){
    const dealt=Math.max(0,hpBefore-e.hp);
    const before=player.hp;
    player.hp=Math.min(healCap(player), player.hp+scaledHeal(dealt*player.lifestealPct));
    recordRunItem('lifesteal',{ heal:Math.max(0,player.hp-before), procs:1 });
  }
  if(d>0 && crit.crit && !immune) onCritProcs(e,d,color,meta,crit.chain);
  if(d>0 && crit.crit && player._executionCoin && Math.random()<Math.min(0.60,0.15*player._executionCoin)){
    const g=Math.max(1,mapStage);
    player.gold+=g;
    recordRunItem('execution_coin',{ procs:1 });
  }
  if (kbCap && !e.knockImmune){ const kd=Math.hypot(kx,kz)||1, resist=e.isStageBoss?0.18:e.isBoss?0.35:e.elite?0.45:1, kb=Math.min(kbCap, d*0.045/Math.max(0.5,e.r))*(player.knockbackMul||0)*resist;
    e.kx += kx/kd*kb; e.kz += kz/kd*kb; }
  spawnBurst(e.x, e.z, color, 3, 0.5);
  if (!noProc) onHitProcs(e, d, color);
  if (d>0 && !immune && typeof signatureOnEnemyHit==='function') signatureOnEnemyHit(e, d, crit.crit, meta, noProc);
  if (e.hp <= 0) killEnemy(e);
}
function onHitProcs(e, d, color){
  if (player.freezeChance && Math.random() < player.freezeChance){ const freezeDuration=1.2*(player.freezeDurationMul||1); e.slowT = Math.max(e.slowT||0, freezeDuration); if(typeof runStats!=='undefined'&&runStats) runStats.freezeHits=(runStats.freezeHits||0)+1; recordRunItem('ice_crystal',{ procs:1 }); }   // Ice Crystal / Frost Shard
  if (player.thunderChance && Math.random() < player.thunderChance){ recordRunItem('thunder_mitts',{ procs:1 }); aoeProc(e.x, e.z, 3.0, d*0.4, 0x9ad8ff, false, 'thunder_mitts'); }   // Thunder Mitts
  if (player.spicyChance && Math.random() < player.spicyChance){ recordRunItem('spicy_meatball',{ procs:1 }); aoeProc(e.x, e.z, 2.5, d*0.65, 0xff7a3a, false, 'spicy_meatball'); }      // Spicy Meatball
}
function aoeProc(x, z, radius, dmg, color, knock, itemKey){
  spawnRing(x, z, color, radius*1.6, 0.32);
  forEachNearbyEnemy(x, z, radius+1, e=>{
    if (!e.alive) return;
    const dx=e.x-x, dz=e.z-z;
    if (dx*dx+dz*dz < (radius+e.r)*(radius+e.r))
      dealEnemyDamage(e, dmg, color, dx, dz, knock?3:0, true, itemKey?{ item:itemKey }:null);
  });
}
function fireAim(s){
  sfx('shoot');
  const t = nearestEnemies(player.x, player.z, s.range, s.count);
  for (let i=0;i<s.count;i++){
    const target = t.length ? t[i % t.length] : null;
    let dx,dz; if (target){ dx=target.x-player.x; dz=target.z-player.z; }
    else { const a=Math.random()*Math.PI*2; dx=Math.cos(a); dz=Math.sin(a); }
    const l=Math.hypot(dx,dz)||1; spawnProjectile(dx/l, dz/l, statsForCountSlot(s,i));
  }
}
function fireSpread(s){
  sfx('shoot');
  const t = nearestEnemies(player.x, player.z, s.range, 1)[0];
  const base = t ? Math.atan2(t.z-player.z, t.x-player.x) : (player.face<0?Math.PI:0);
  for (let i=0;i<s.count;i++){ const a = base + (s.count>1 ? (i/(s.count-1)-0.5)*(s.arc||0.6) : 0);
    spawnProjectile(Math.cos(a), Math.sin(a), statsForCountSlot(s,i)); }
}
const novaWaves = [];
let pixelRingTexture=null;
function getPixelRingTexture(){
  if (pixelRingTexture) return pixelRingTexture;
  const gen=typeof getSpriteFrameTexture==='function' ? getSpriteFrameTexture('fx_nova_gen',2,4) : null;
  if(gen){ pixelRingTexture=gen; return gen; }
  const cv=document.createElement('canvas'); cv.width=32; cv.height=32;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  for(let y=0;y<32;y++) for(let x=0;x<32;x++){
    const dx=x-15.5, dy=y-15.5, d=Math.hypot(dx,dy);
    if(d>10.5 && d<14.5){
      const a=(Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2);
      if(((a/(Math.PI/12))|0)%2===0 || d<12.2){
        ctx.fillStyle=d>13?'#fff3c0':d>11.8?'#ffc45a':'#d96628';
        ctx.fillRect(x,y,1,1);
      }
    }
  }
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  t.generateMipmaps=false; pixelRingTexture=t; return t;
}
function spawnNovaWave(x,z,maxR,dmg,color,areaLife,sourceKey){
  capEffectList(novaWaves, MAX_NOVA_WAVES);
  const ring=new THREE.Mesh(EFFECT_PLANE_GEO, new THREE.MeshBasicMaterial({
    map:getPixelRingTexture(), color, transparent:true, opacity:1,
    alphaTest:0.08, side:THREE.DoubleSide, depthWrite:false
  }));
  const m=ring;
  m.position.set(x, groundHeight(x,z)+0.12, z); m.scale.setScalar(0.5); scene.add(m);
  novaWaves.push({ x, z, r:0.5, maxR, speed:16/(areaLife||1), dmg, color, sourceKey, hit:new Set(), mesh:m, ring, wash:null });
}
function fireNova(s){ sfx('shoot'); const n=s.count, R=s.radius||6;
  for(let i=0;i<n;i++) spawnNovaWave(player.x, player.z, R*(0.6+0.4*(i+1)/n), damageForCountSlot(s,i), s.color, s.areaLife, s.sourceKey); }
function fireSpiral(s){ sfx('shoot'); const base=gameTime*4; for(let i=0;i<s.count;i++){ const a=base+(i/s.count)*Math.PI*2; spawnProjectile(Math.cos(a), Math.sin(a), statsForCountSlot(s,i)); } }
const slashFx=[];
function fireSlash(s){
  sfx('shoot');
  const target=nearestEnemies(player.x, player.z, s.range, 1)[0];
  let dx=player.ldx, dz=player.ldz;
  if (target){ dx=target.x-player.x; dz=target.z-player.z; }
  if (!dx && !dz){ dx=player.face||1; dz=0; }
  const len=Math.hypot(dx,dz)||1, base=Math.atan2(dz/len,dx/len);
  for(let i=0;i<s.count;i++){
    const a=base+(s.count>1?(i/(s.count-1)-0.5)*(s.arc||0.45):0);
    spawnProjectile(Math.cos(a),Math.sin(a),statsForCountSlot(s,i));
  }
}
function fireStab(s){
  sfx('shoot');
  const target=nearestEnemies(player.x, player.z, s.range+2.2, 1)[0];
  let dx=player.ldx, dz=player.ldz;
  if (target){ dx=target.x-player.x; dz=target.z-player.z; }
  if (!dx && !dz){ dx=player.face||1; dz=0; }
  const len=Math.hypot(dx,dz)||1, base=Math.atan2(dz/len,dx/len);
  const isChidori=s.shape==='chidori';
  const spread=s.count>1 ? (isChidori?0.15:0.26) : 0;
  for(let i=0;i<s.count;i++){
    const a=base+(s.count>1?(i/(s.count-1)-0.5)*spread:0);
    const slot=statsForCountSlot(s,i);
    spawnStabProjectile(Math.cos(a),Math.sin(a),isChidori?Object.assign({},slot,{ chidoriBranch:i>0, branchIndex:i }):slot);
  }
}
function fireSmite(s){
  sfx('shoot');
  const count=Math.max(1,s.count||1);
  const targets=nearestEnemies(player.x, player.z, s.range||11, count);
  if (!targets.length) return;
  const volleyHits=new Set();
  for(let i=0;i<count;i++){
    const t=targets[i % targets.length];
    const tx=t.x, tz=t.z, R=s.radius||2.4;
    const slotDmg=damageForCountSlot(s,i);
    hitBreakablesAt(tx,tz,R,slotDmg,s.color);
    forEachNearbyEnemy(tx,tz,R+1,e=>{ if(!e.alive) return;
      if (Math.hypot(e.x-tx, e.z-tz) < R+e.r) {
        const repeat=volleyHits.has(e);
        volleyHits.add(e);
        dealEnemyDamage(e, repeat?Math.max(1,Math.round(slotDmg*0.45)):slotDmg, s.color, e.x-tx, e.z-tz, 3.5, false, { weapon:s.sourceKey, smiteRepeat:repeat });
      }
    });
    const bm=new THREE.Sprite(new THREE.SpriteMaterial({
      map:getPixelProjectileTexture(s.shape||'smite',s.color), color:0xffffff,
      transparent:true, alphaTest:0.08, depthWrite:false
    }));
    if(s.shape==='lightning'){
      bm.scale.set(1.05,6.2,1); bm.position.set(tx,3.45,tz);
    } else {
      bm.scale.set(1.35,5.4,1); bm.position.set(tx,3.05,tz);
    }
    const fxLife=(s.shape==='lightning'?0.18:0.28)*(s.areaLife||1);
    capEffectList(slashFx, MAX_SLASH_FX);
    scene.add(bm); slashFx.push({ mesh:bm, life:fxLife, max:fxLife, grow:0.04, baseScale:bm.scale.clone(), fade:1 });
    if(s.shape==='lightning'){
      spawnRing(tx,tz,0xbff8ff,R*1.25,0.22*(s.areaLife||1));
      spawnBurst(tx,tz,0x9eefff,12,0.65);
    } else {
      spawnRing(tx,tz,s.color,R*1.8,0.45*(s.areaLife||1));
      spawnBurst(tx,tz,s.color,8,0.8);
    }
  }
  if(weaponMatchesFamily(s.sourceKey,'smite')&&hasWeaponSynergy('divine_storm')&&(player._divineStormAt||0)<=gameTime&&Math.random()<0.25){
    const lightning=(player.weapons||[]).find(w=>weaponMatchesFamily(w.key,'lightning'));
    if(lightning){
      player._divineStormAt=gameTime+2;
      const extra=wstats(lightning.key,lightning.lvl);
      extra.count=1; extra.baseCount=1; extra.dmg=Math.max(1,Math.round(extra.dmg*0.65));
      fireSmite(extra);
      spawnDmg(player.x,player.z,'DIVINE STORM',0x9eefff,false,'critproc');
    }
  }
}
const bambooPatches=[];
const MAX_BAMBOO_PATCHES=48;
const BAMBOO_FX_FRAMES=6;
function bambooFxMap(sourceKey){
  const key=sourceKey==='bamboo_spikesX'?'fx_bamboo_spike_evolved_sheet':'fx_bamboo_spike_sheet';
  const base=tex[key];
  if(!base || !base.image) return getPixelProjectileTexture('bamboo', sourceKey==='bamboo_spikesX'?0xd9ff7a:0xa8e36a);
  const map=base.clone();
  map.repeat.set(1/BAMBOO_FX_FRAMES,1);
  map.offset.set(0,0);
  map.needsUpdate=true;
  map._ownsMap=true;
  return map;
}
function spawnBambooPatch(x,z,s,i){
  capEffectList(bambooPatches, MAX_BAMBOO_PATCHES);
  const radius=Math.max(0.7,s.radius||1.5);
  const evolved=s.sourceKey==='bamboo_spikesX';
  const mat=new THREE.SpriteMaterial({
    map:bambooFxMap(s.sourceKey), color:0xffffff,
    transparent:true, opacity:0, alphaTest:0.08, depthWrite:false
  });
  const mesh=new THREE.Sprite(mat);
  mesh.center.set(0.5,0);
  mesh.scale.set(radius*(evolved?1.02:0.90), radius*(evolved?0.68:0.56), 1);
  mesh.position.set(x, groundHeight(x,z)+0.018, z);
  mesh.visible=false;
  scene.add(mesh);
  spawnRing(x,z,evolved?0xffdf72:s.color,radius*(evolved?1.28:1.10),evolved?0.26:0.20);
  if(evolved) spawnRing(x,z,0xa8ff70,radius*0.92,0.18);
  bambooPatches.push({
    x,z,r:radius,dmg:Math.max(1,Math.round(damageForCountSlot(s,i)*0.34)),
    color:s.color,sourceKey:s.sourceKey,life:(s.life||1.2)*(s.areaLife||1),
    maxLife:(s.life||1.2)*(s.areaLife||1),delay:0.18,tick:0.04,
    tickEvery:evolved?0.24:0.30,mesh,alive:true,frames:BAMBOO_FX_FRAMES,evolved
  });
}
function fireBamboo(s){
  sfx('shoot');
  const count=Math.max(1,s.count||1);
  const targets=nearestEnemies(player.x,player.z,s.range||9,count);
  for(let i=0;i<count;i++){
    const t=targets.length?targets[i%targets.length]:null;
    let x,z;
    if(t){
      const jitter=(i%3-1)*0.45;
      x=t.x+jitter; z=t.z+(i%2?0.38:-0.24);
    } else {
      const a=Math.random()*Math.PI*2, d=3+Math.random()*Math.max(1,(s.range||9)-3);
      x=player.x+Math.cos(a)*d; z=player.z+Math.sin(a)*d;
    }
    spawnBambooPatch(x,z,s,i);
  }
}
function removeFamiliar(f){
  if(!f) return;
  if(f.mesh){ scene.remove(f.mesh); freeObj(f.mesh); }
  const i=familiarSummons.indexOf(f);
  if(i>=0) familiarSummons.splice(i,1);
}
function clearFamiliarSummons(){
  for(let i=familiarSummons.length-1;i>=0;i--) removeFamiliar(familiarSummons[i]);
  if(typeof player!=='undefined' && player && player.weapons){
    for(const w of player.weapons){ if(w.familiars) w.familiars=[]; w._familiarSourceKey=''; }
  }
}
function createFamiliar(w, s, index){
  const b=WEAPON_TYPES[s.sourceKey]||WEAPON_TYPES.frost_familiar;
  const map=tex[b.icon]||getPixelProjectileTexture('shard',b.color);
  const mesh=new THREE.Sprite(new THREE.SpriteMaterial({
    map, color:0xffffff, transparent:true, opacity:0.98, alphaTest:0.08, depthWrite:false
  }));
  const evolved=s.sourceKey==='frost_familiarX';
  const size=(evolved?1.02:0.78)*(s.skillSizeMul||1);
  mesh.scale.set(size,size,1);
  scene.add(mesh);
  const f={ mesh, weapon:w, angle:(index/Math.max(1,s.count))*Math.PI*2,
    orbitRadius:evolved?2.15:1.85, orbitSpeed:evolved?1.8:2.25,
    life:s.life, maxLife:s.life, fireCd:(index*0.18)%Math.max(0.25,1/s.rate),
    fireRate:s.rate, range:s.range, speed:s.speed, dmg:s.dmg,
    pierce:s.pierce||0, color:b.color, sourceKey:s.sourceKey, evolved };
  familiarSummons.push(f);
  return f;
}
function fireFamiliarShot(f){
  const target=nearestEnemies(f.mesh.position.x,f.mesh.position.z,f.range,1)[0];
  if(!target) return;
  const dx=target.x-f.mesh.position.x, dz=target.z-f.mesh.position.z, len=Math.hypot(dx,dz)||1;
  const stats={ sourceKey:f.sourceKey, mode:'aim', dmg:f.dmg, baseCount:1, count:1,
    pierce:f.pierce, speed:f.speed, life:0.95*(player.lifeMul||1), range:f.range,
    color:f.color, shape:f.evolved?'doom':'shard', skillSizeMul:skillSizeMul('projectile') };
  spawnProjectile(dx/len,dz/len,stats);
  spawnBurst(f.mesh.position.x,f.mesh.position.z,f.color,f.evolved?3:2,0.24);
}
function updateFamiliarWeapon(w,s,dt){
  w.familiars=w.familiars||[];
  if(w._familiarSourceKey!==s.sourceKey){
    for(let i=w.familiars.length-1;i>=0;i--) removeFamiliar(w.familiars[i]);
    w.familiars=[];
    w._familiarSourceKey=s.sourceKey;
  }
  const needed=Math.min(4,Math.max(1,s.count||1));
  while(w.familiars.length<needed) w.familiars.push(createFamiliar(w,s,w.familiars.length));
  while(w.familiars.length>needed) removeFamiliar(w.familiars.pop());
  for(const f of w.familiars){
    if(!f || !f.mesh) continue;
    f.life-=dt;
    if(f.life<=0){ removeFamiliar(f); continue; }
    if(s.life>f.maxLife) f.life+=s.life-f.maxLife;
    f.maxLife=s.life;
    f.angle+=f.orbitSpeed*dt;
    f.fireCd-=dt;
    f.fireRate=s.rate; f.range=s.range; f.speed=s.speed; f.dmg=s.dmg; f.pierce=s.pierce||0;
    const x=player.x+Math.cos(f.angle)*f.orbitRadius;
    const z=player.z+Math.sin(f.angle)*f.orbitRadius;
    f.mesh.position.set(x,groundHeight(x,z)+1.15+(f.evolved?0.22:0.10)*Math.sin(gameTime*4+f.angle),z);
    f.mesh.material.opacity=Math.min(0.98,0.45+0.55*Math.min(1,f.life/Math.max(0.1,f.maxLife*0.18)));
    f.mesh.material.rotation+=dt*(f.evolved?0.8:1.2);
    if(f.fireCd<=0){ fireFamiliarShot(f); f.fireCd+=1/Math.max(0.1,f.fireRate); }
  }
  w.familiars=w.familiars.filter(f=>f && f.life>0);
}
const WFIRE = { aim:fireAim, spread:fireSpread, nova:fireNova, spiral:fireSpiral, slash:fireSlash, stab:fireStab, smite:fireSmite, bamboo:fireBamboo };
function updateOrbit(w, s, dt){
  const b = WEAPON_TYPES[w.key] || WEAPON_TYPES.orbit;
  syncOrbitGuard(w,s);
  if((player.skullGuardHitCd||0)>0) player.skullGuardHitCd=Math.max(0,player.skullGuardHitCd-dt);
  if((w.guardActive||0)<(w.guardMax||s.count)){
    w.guardCd=(w.guardCd||b.guardRecover||5)-dt;
    if(w.guardCd<=0){
      w.guardActive=Math.min(w.guardMax||s.count,(w.guardActive||0)+1);
      w.guardCd=(w.guardActive<(w.guardMax||s.count))?(b.guardRecover||5):0;
      spawnBurst(player.x, player.z, b.color, 6, 0.45);
    }
  }
  while (w.orbs.length < s.count){
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map:tex.wpn_orbit, color:b.color, transparent:true, alphaTest:0.2, depthWrite:false
    }));
    m.scale.set(0.82*(s.skillSizeMul||1),0.82*(s.skillSizeMul||1),1);
    scene.add(m); w.orbs.push({ mesh:m, hit:new Map() });
  }
  const n = w.orbs.length;
  for (let i=0;i<n;i++){
    const o = w.orbs[i];
    const active=i<(w.guardActive||0);
    o.mesh.visible=active;
    if(!active) continue;
    o.mesh.scale.set(0.82*(s.skillSizeMul||1),0.82*(s.skillSizeMul||1),1);
    const evolved=w.key==='orbitX';
    const ring=evolved && (i%2===0) ? 0.62 : 1;
    const dir=evolved && (i%2===0) ? -1 : 1;
    const orbitCount=evolved ? Math.ceil(n/2) : n;
    const slot=evolved ? Math.floor(i/2) : i;
    const ang = gameTime*b.orbitSpd*dir + (slot/orbitCount)*Math.PI*2;
    const ox = player.x + Math.cos(ang)*s.orbitR*ring, oz = player.z + Math.sin(ang)*s.orbitR*ring;
    o.mesh.position.set(ox, groundHeight(ox,oz)+0.9, oz);
    forEachNearbyEnemy(ox,oz,1.6,e=>{ if(!e.alive) return;
      if (Math.hypot(ox-e.x, oz-e.z) < e.r+0.5*(s.skillSizeMul||1) && (o.hit.get(e)||0) <= gameTime){
        o.hit.set(e, gameTime + (s.tick||b.tick));
        dealEnemyDamage(e, damageForCountSlot(s,i), b.color, e.x-ox, e.z-oz, 3, false, { weapon:w.key });
      } });
    hitBreakablesAt(ox,oz,0.55*(s.skillSizeMul||1),damageForCountSlot(s,i),b.color,1);
  }
}
function updateWeapon(w, dt){
  const b = WEAPON_TYPES[w.key];
  let s = wstats(w.key, w.lvl);
  if (b.mode === 'orbit'){ updateOrbit(w, s, dt); return; }
  if (b.mode === 'familiar'){ updateFamiliarWeapon(w, s, dt); return; }
  w.cd -= dt;
  if (w.cd <= 0){
    w.cd = 1/s.rate;
    if(typeof signatureModifyWeaponFire==='function') s=signatureModifyWeaponFire(w,s)||s;
    WFIRE[b.mode](s);
  }
}
function weaponChoices(){
  const out = [];
  const tomeLbl = id => { const u = (typeof UPGRADES!=='undefined') ? UPGRADES.find(x=>x.id===id) : null; return u ? (typeof tomeName==='function'?tomeName(u):u.name) : id; };
  const evolveLabel = typeof tr === 'function' ? tr('common.evolve') : 'Evolve';
  const newLabel = typeof tr === 'function' ? tr('common.new') : 'NEW';
  for (const key in WEAPON_TYPES){
    const t = WEAPON_TYPES[key]; if (t.hidden) continue;
    const need = t.evolveTo ? evolveTomeNeed(player.weapons.find(x=>x.key===key)) : 3;
    const hint = t.evolveTo ? ' · ★'+evolveLabel+': '+tomeLbl(t.evolveTome)+' x'+need+' @Lv8' : '';
    const w = player.weapons.find(x=>x.key===key);
    if (w){ if (w.lvl < 8) out.push({ id:'w_'+key, name:weaponName(key)+' Lv'+(w.lvl+1), desc:weaponDesc(key)+hint, icon:t.icon, apply:()=>{ w.lvl++; } }); }
    else if (player.weapons.length < MAX_WEAPONS && (typeof isWeaponUnlocked!=='function' || isWeaponUnlocked(key))){ out.push({ id:'w_'+key, name:newLabel+': '+weaponName(key), desc:weaponDesc(key)+hint, icon:t.icon, apply:()=>{ player.weapons.push(makeWeapon(key)); } }); }
  }
  // weapon evolutions: maxed weapon + paired tome (x3)
  for (const w of player.weapons){
    const t = WEAPON_TYPES[w.key];
    if (t && t.evolveTo && w.lvl>=8 && !w.evolved && (player.tomeCount[t.evolveTome]||0) >= evolveTomeNeed(w)){
      const ev = WEAPON_TYPES[t.evolveTo];
      out.push({ id:'evo_'+w.key, name:'\u2605 '+evolveLabel+': '+weaponName(t.evolveTo), desc:weaponDesc(t.evolveTo), icon:ev.icon, apply:()=>{ if(player._ancientAnvil && !player._anvilUsed) player._anvilUsed=1; w.key=t.evolveTo; w.evolved=true; } });
    }
  }
  return out;
}
