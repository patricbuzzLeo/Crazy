import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- Configuration ---
const API_KEY = process.env.API_KEY;
const MODEL_NAME = "gemini-2.5-flash";

// --- Types ---
type GameState = 'START' | 'SELECT_THEME' | 'SELECT_DIFFICULTY' | 'BATTLE' | 'SHOP' | 'GAMEOVER';
type ShopTab = 'ITEMS' | 'WEAPONS' | 'JOBS' | 'SKILLS';
type Difficulty = 'EASY' | 'NORMAL' | 'HARD';

interface DungeonTheme {
  id: string;
  name: string;
  description: string;
  color: string;
  bgGradient: string;
  emoji: string;
  monsterType: string;
}

interface Ultimate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  unlockLevel: number;
}

interface Weapon {
  id: string;
  name: string;
  atkBonus: number;
  price: number;
  emoji: string;
  description: string;
}

interface Job {
  id: string;
  name: string;
  hpBonus: number;
  mpBonus: number;
  atkBonus: number;
  price: number;
  emoji: string;
  description: string;
}

interface Hero {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  baseAtk: number; // Pure stats without weapon
  level: number;
  name: string;
  ult: number; // 0 to 100
  gold: number;
  jellies: number;
  elixirs: number;
  equippedUltId: string;
  weapon: Weapon;
  job: Job;
}

interface Monster {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  emoji: string;
  description: string;
  isBoss: boolean;
  rewardGold: number;
}

interface Log {
  id: number;
  text: string;
  source: 'SYSTEM' | 'HERO' | 'MONSTER' | 'AI';
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
}

// --- Constants ---
const DUNGEONS: DungeonTheme[] = [
  {
    id: 'FIRE',
    name: '불의 협곡',
    description: '뜨거운 용암과 화염 몬스터가 서식합니다.',
    color: '#ff4400',
    bgGradient: 'radial-gradient(circle at center, #3a0000 0%, #110500 100%)',
    emoji: '🌋',
    monsterType: 'Fire, Lava, Demon'
  },
  {
    id: 'ICE',
    name: '얼음 동굴',
    description: '모든 것이 얼어붙은 차가운 미궁입니다.',
    color: '#00ccff',
    bgGradient: 'radial-gradient(circle at center, #001a33 0%, #000511 100%)',
    emoji: '❄️',
    monsterType: 'Ice, Yeti, Spirit'
  },
  {
    id: 'FOREST',
    name: '유령의 숲',
    description: '음산한 안개 속에 언데드가 숨어있습니다.',
    color: '#aa00ff',
    bgGradient: 'radial-gradient(circle at center, #1a0033 0%, #050011 100%)',
    emoji: '🌲',
    monsterType: 'Undead, Ghost, Poison'
  }
];

const ULTIMATES: Ultimate[] = [
  {
    id: 'METEOR',
    name: '메테오',
    emoji: '☄️',
    description: '적에게 공격력의 600% 피해',
    color: '#ff2222',
    unlockLevel: 1
  },
  {
    id: 'HOLY_LIGHT',
    name: '성스러운 빛',
    emoji: '✨',
    description: 'HP 80% 회복 및 MP 50 회복',
    color: '#ffffaa',
    unlockLevel: 3
  },
  {
    id: 'VAMPIRE',
    name: '블러드 슬래시',
    emoji: '🩸',
    description: '공격력 400% 피해 + 피해량 50% 흡혈',
    color: '#ff00aa',
    unlockLevel: 5
  }
];

const WEAPONS: Weapon[] = [
  { id: 'WOOD_SWORD', name: '목검', atkBonus: 0, price: 0, emoji: '🪵', description: '수련용 목검입니다.' },
  { id: 'RUSTY_DAGGER', name: '녹슨 단검', atkBonus: 5, price: 100, emoji: '🔪', description: '녹슬었지만 쓸만합니다.' },
  { id: 'IRON_SWORD', name: '철검', atkBonus: 10, price: 500, emoji: '🗡️', description: '기본적인 철제 검입니다.' },
  { id: 'IRON_MACE', name: '철퇴', atkBonus: 18, price: 1000, emoji: '🔨', description: '단단한 몬스터에게 효과적입니다.' },
  { id: 'SILVER_LANCE', name: '은빛 창', atkBonus: 25, price: 2000, emoji: '🔱', description: '길고 날카로운 창입니다.' },
  { id: 'STEEL_CLAYMORE', name: '강철 대검', atkBonus: 35, price: 3500, emoji: '⚔️', description: '무겁지만 강력한 베기.' },
  { id: 'GOLD_AXE', name: '황금 도끼', atkBonus: 50, price: 6000, emoji: '🪓', description: '화려하고 파괴적입니다.' },
  { id: 'KATANA', name: '명도', atkBonus: 70, price: 9000, emoji: '🎌', description: '장인의 혼이 담긴 검.' },
  { id: 'DRAGON_SLAYER', name: '용살검', atkBonus: 120, price: 15000, emoji: '🐉', description: '전설 속의 검입니다.' },
  { id: 'DEMON_BLADE', name: '마검', atkBonus: 180, price: 30000, emoji: '👿', description: '저주받은 힘이 깃들어 있습니다.' },
  { id: 'LIGHT_SABER', name: '광선검', atkBonus: 300, price: 80000, emoji: '🔦', description: '미래의 기술로 만든 검.' },
  { id: 'INFINITY_BLADE', name: '무한의 검', atkBonus: 999, price: 999999, emoji: '♾️', description: '신조차 베어버릴 수 있습니다.' }
];

const JOBS: Job[] = [
  { id: 'NOVICE', name: '견습생', hpBonus: 0, mpBonus: 0, atkBonus: 0, price: 0, emoji: '👶', description: '모험을 시작하는 초보자' },
  { id: 'KNIGHT', name: '기사', hpBonus: 100, mpBonus: 0, atkBonus: 5, price: 1000, emoji: '🛡️', description: '체력이 높고 튼튼합니다.' },
  { id: 'MAGE', name: '마법사', hpBonus: -20, mpBonus: 100, atkBonus: 10, price: 1000, emoji: '🧙‍♂️', description: '마력이 높고 공격적입니다.' },
  { id: 'ASSASSIN', name: '암살자', hpBonus: 20, mpBonus: 20, atkBonus: 20, price: 2500, emoji: '🥷', description: '높은 공격력을 가집니다.' },
  { id: 'BERSERKER', name: '버서커', hpBonus: 200, mpBonus: -30, atkBonus: 30, price: 5000, emoji: '👹', description: '압도적인 피지컬.' }
];

const COLORS = {
  bg: '#050505',
  primary: '#FFD700', // Gold
  secondary: '#8B0000', // Dark Red
  text: '#E0E0E0',
  hp: '#ff4444',
  mp: '#4488ff',
  ult: '#cc00ff',
  gold: '#ffcc00',
  panel: 'rgba(20, 20, 20, 0.95)',
};

const STYLES = {
  container: {
    width: '100%',
    maxWidth: '600px', // Adjusted size
    height: '95vh',
    border: `4px double ${COLORS.primary}`,
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: COLORS.bg,
    boxShadow: `0 0 30px rgba(255, 215, 0, 0.1)`,
    position: 'relative' as const,
    overflow: 'hidden',
    fontFamily: '"VT323", monospace',
    color: COLORS.text,
  },
  header: (themeColor: string) => ({
    padding: '0.8rem 1rem',
    borderBottom: `2px solid ${themeColor}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(to bottom, #222, #000)',
    zIndex: 5,
  }),
  title: (color: string) => ({
    fontSize: '2rem',
    color: color,
    textShadow: '2px 2px #000',
    margin: 0,
    letterSpacing: '2px',
  }),
  floorBadge: (isBoss: boolean, themeColor: string) => ({
    fontSize: '1.4rem',
    color: isBoss ? '#ff0000' : '#fff',
    backgroundColor: isBoss ? '#330000' : '#333',
    padding: '4px 10px',
    borderRadius: '4px',
    border: `1px solid ${isBoss ? '#ff0000' : themeColor}`,
    boxShadow: isBoss ? '0 0 10px #ff0000' : 'none',
  }),
  scene: (bgGradient: string) => ({
    flex: 2,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '1rem',
    position: 'relative' as const,
    backgroundImage: bgGradient,
    transition: 'background 1s',
  }),
  charBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    width: '45%', // Responsive width
    transition: 'all 0.3s',
  },
  emoji: (scale: number = 1) => ({
    fontSize: `${6 * scale}rem`, // Adjusted emoji size
    filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.6))',
    lineHeight: 1,
    marginBottom: '1rem',
    transition: 'transform 0.2s',
  }),
  statBar: (height: string = '12px') => ({
    width: '100%',
    height: height,
    backgroundColor: '#333',
    border: '1px solid #666',
    marginTop: '4px',
    position: 'relative' as const,
    overflow: 'hidden',
  }),
  fill: (pct: number, color: string) => ({
    width: `${Math.max(0, Math.min(100, pct))}%`,
    height: '100%',
    backgroundColor: color,
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  }),
  logWindow: (borderColor: string) => ({
    flex: 1.2,
    borderTop: `2px solid ${borderColor}`,
    padding: '1rem',
    overflowY: 'auto' as const,
    backgroundColor: 'rgba(0,0,0,0.85)',
    fontSize: '1rem', // Adjusted font size
    lineHeight: '1.4',
    fontFamily: 'monospace',
  }),
  controls: (borderColor: string) => ({
    borderTop: `2px solid ${borderColor}`,
    padding: '1rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr 1.3fr',
    gap: '8px',
    backgroundColor: '#111',
    height: '140px',
  }),
  button: (isActive: boolean, themeColor: string, isUlt: boolean = false, ultColor: string = COLORS.ult) => ({
    background: isUlt ? (isActive ? '#2a0033' : '#222') : '#1a1a1a',
    border: `1px solid ${isUlt ? ultColor : themeColor}`,
    color: isUlt ? ultColor : themeColor,
    fontSize: '1rem', // Adjusted font size
    fontFamily: 'inherit',
    cursor: isActive ? 'pointer' : 'not-allowed',
    opacity: isActive ? 1 : 0.5,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s',
    boxShadow: isUlt && isActive ? `0 0 10px ${ultColor}` : 'none',
    transform: isActive ? 'scale(1)' : 'scale(0.98)',
    padding: '5px',
  }),
  overlay: {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    textAlign: 'center' as const,
  },
  card: (borderColor: string, disabled: boolean = false) => ({
    border: `2px solid ${disabled ? '#555' : borderColor}`,
    background: disabled ? '#222' : 'rgba(30,30,30,0.9)',
    padding: '15px',
    margin: '10px',
    width: '260px', // Adjusted card width
    cursor: disabled ? 'default' : 'pointer',
    textAlign: 'left' as const,
    transition: 'transform 0.2s',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    minHeight: '140px',
    opacity: disabled ? 0.5 : 1
  }),
  floating: (x: number, y: number, color: string, size: number) => ({
    position: 'absolute' as const,
    left: `${x}%`,
    top: `${y}%`,
    color: color,
    fontSize: `${size}rem`,
    fontWeight: 'bold',
    pointerEvents: 'none' as const,
    textShadow: '3px 3px 0 #000',
    animation: 'floatUp 0.8s forwards',
    zIndex: 15,
  }),
  dungeonCard: (color: string) => ({
    border: `2px solid ${color}`,
    background: 'rgba(10,10,10,0.9)',
    padding: '20px',
    margin: '10px',
    width: '140px', // Adjusted for list view
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'transform 0.2s',
    boxShadow: `0 0 10px ${color}33`,
  }),
  shopItem: {
    border: '1px solid #666',
    padding: '15px',
    margin: '8px',
    background: '#222',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: '550px',
    fontSize: '1.1rem'
  },
  ultCard: (isSelected: boolean, isLocked: boolean, color: string) => ({
    border: `2px solid ${isLocked ? '#444' : isSelected ? color : '#666'}`,
    background: isLocked ? '#222' : isSelected ? '#1a1a1a' : '#111',
    padding: '15px',
    margin: '8px',
    width: '100%',
    maxWidth: '550px',
    cursor: isLocked ? 'not-allowed' : 'pointer',
    opacity: isLocked ? 0.6 : 1,
    textAlign: 'left' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    position: 'relative' as const,
    boxShadow: isSelected ? `0 0 10px ${color}33` : 'none',
    fontSize: '1.1rem'
  }),
  shopTab: (isActive: boolean) => ({
    padding: '10px 15px',
    cursor: 'pointer',
    background: isActive ? '#333' : '#111',
    borderBottom: isActive ? `3px solid ${COLORS.primary}` : '3px solid transparent',
    color: isActive ? '#fff' : '#888',
    flex: 1,
    textAlign: 'center' as const,
    fontSize: '1.2rem'
  })
};

// --- App Component ---

const App = () => {
  const [gameState, setGameState] = useState<GameState>('START');
  const [dungeonTheme, setDungeonTheme] = useState<DungeonTheme>(DUNGEONS[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [floor, setFloor] = useState(1);
  const [hero, setHero] = useState<Hero>({
    hp: 120, maxHp: 120, mp: 60, maxMp: 60, baseAtk: 15, level: 1, name: "용사", ult: 0, 
    gold: 0, jellies: 2, elixirs: 1, equippedUltId: 'METEOR',
    weapon: WEAPONS[0],
    job: JOBS[0]
  });
  const [monster, setMonster] = useState<Monster | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shake, setShake] = useState(0); 
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  
  // Shop State
  const [shopTab, setShopTab] = useState<ShopTab>('ITEMS');
  const [hasLeveledUp, setHasLeveledUp] = useState(false);
  
  // Gacha State
  const [gachaResult, setGachaResult] = useState<{text: string, color: string} | null>(null);
  const [isGachaRolling, setIsGachaRolling] = useState(false);
  
  // Home Modal State
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: API_KEY });
    }
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // --- Derived Stats ---
  const totalAtk = hero.baseAtk + hero.weapon.atkBonus + hero.job.atkBonus;
  const totalMaxHp = hero.maxHp + hero.job.hpBonus;
  const totalMaxMp = hero.maxMp + hero.job.mpBonus;
  
  // --- Helpers ---

  const addLog = (text: string, source: Log['source']) => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), text, source }]);
  };

  const showFloat = (text: string, isHero: boolean, color: string, isCrit: boolean = false) => {
    const id = Date.now() + Math.random();
    setFloatingTexts(prev => [...prev, { 
      id, text, 
      x: isHero ? 20 + Math.random() * 10 : 70 + Math.random() * 10, 
      y: 40 + Math.random() * 10, 
      color,
      size: isCrit ? 4 : 2.5
    }]);
    setTimeout(() => setFloatingTexts(p => p.filter(f => f.id !== id)), 800);
  };

  const triggerShake = (intensity: number = 1) => {
    setShake(intensity);
    setTimeout(() => setShake(0), 500);
  };

  const generateMonster = async (currentFloor: number, theme: DungeonTheme) => {
    if (!aiRef.current) return;
    setIsProcessing(true);
    
    const isBoss = currentFloor % 5 === 0;
    // Difficulty Multipliers
    let statMult = 1.0;
    let goldMult = 1.0;
    if (difficulty === 'EASY') { statMult = 0.8; goldMult = 0.8; }
    if (difficulty === 'HARD') { statMult = 1.5; goldMult = 1.5; }

    const baseDifficulty = 10 + (currentFloor * 5);
    
    if (isBoss) {
      addLog(`⚠️ ${currentFloor}층: 강력한 기운이 느껴집니다! (${difficulty})`, 'SYSTEM');
    } else {
      addLog(`${currentFloor}층 [${theme.name}] 탐색 중... (${difficulty})`, 'SYSTEM');
    }

    try {
      const prompt = `
        Create a fantasy RPG monster for Dungeon Theme: "${theme.name}" (${theme.monsterType}).
        Floor: ${currentFloor}.
        Is Boss: ${isBoss}.
        Difficulty level: ${baseDifficulty}.
        Return ONLY JSON:
        {
          "name": "Name in Korean",
          "hp": number,
          "atk": number,
          "emoji": "Single Emoji",
          "description": "Short menacing intro in Korean",
          "rewardGold": number
        }
      `;

      const result = await aiRef.current.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const data = JSON.parse(result.text);
      
      // Apply difficulty modifiers locally to ensure consistency if AI drifts
      const modHp = Math.floor(data.hp * statMult);
      const modAtk = Math.floor(data.atk * statMult);
      const modGold = Math.floor(data.rewardGold * goldMult);

      setMonster({
        name: data.name,
        hp: modHp,
        maxHp: modHp,
        atk: modAtk,
        emoji: data.emoji,
        description: data.description,
        isBoss,
        rewardGold: modGold
      });
      addLog(isBoss ? `☠️ 보스 [${data.name}] 출현!` : `야생의 [${data.name}] 등장!`, 'SYSTEM');
      addLog(`"${data.description}"`, 'MONSTER');
    } catch (e) {
      const hp = Math.floor((60 * currentFloor) * (isBoss ? 2 : 1) * statMult);
      const atk = Math.floor((10 * currentFloor) * (isBoss ? 1.2 : 1) * statMult);
      const gold = Math.floor(50 * currentFloor * goldMult);

      setMonster({
        name: isBoss ? `심연의 군주` : `던전 슬라임`,
        hp, maxHp: hp, atk,
        emoji: isBoss ? "👹" : "🦠",
        description: "알 수 없는 적입니다.",
        isBoss,
        rewardGold: gold
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectDungeon = (theme: DungeonTheme) => {
    setDungeonTheme(theme);
    setGameState('SELECT_DIFFICULTY');
  };

  const openShopFromStart = () => {
    setIsBrowsing(true);
    setGameState('SHOP');
  };

  const exitShopToStart = () => {
    setIsBrowsing(false);
    setGameState('START');
    setShopTab('ITEMS');
  };

  const startGame = (diff: Difficulty) => {
    setIsBrowsing(false);
    setDifficulty(diff);
    setGameState('BATTLE');
    setFloor(1);
    setHero({ 
      hp: 120, maxHp: 120, mp: 60, maxMp: 60, baseAtk: 15, level: 1, name: "용사", ult: 0, 
      gold: 0, jellies: 3, elixirs: 1, equippedUltId: 'METEOR',
      weapon: WEAPONS[0],
      job: JOBS[0]
    });
    setLogs([]);
    generateMonster(1, dungeonTheme);
  };

  const tryGoHome = () => {
    setShowExitConfirm(true);
  };

  const confirmHome = () => {
    setShowExitConfirm(false);
    setGameState('START');
  };

  const cancelHome = () => {
    setShowExitConfirm(false);
  };

  const handleWin = () => {
    if (!monster) return;
    const goldEarned = monster.rewardGold + Math.floor(Math.random() * 20);
    
    addLog(`🏆 승리! ${goldEarned}G 획득!`, 'SYSTEM');
    if (monster.isBoss) {
      setHero(h => ({ ...h, ult: 100, gold: h.gold + goldEarned })); 
      addLog(`🎉 보스 보너스! 필살기 게이지 MAX!`, 'SYSTEM');
    } else {
      setHero(h => ({ ...h, gold: h.gold + goldEarned }));
    }
    
    setTimeout(() => {
      setGameState('SHOP');
      setGachaResult(null); // Reset gacha state
      setShopTab('ITEMS'); // Reset tab
      setHasLeveledUp(false); // Reset level up status
    }, 1200);
  };

  const nextFloor = () => {
    setFloor(f => f + 1);
    setGameState('BATTLE');
    generateMonster(floor + 1, dungeonTheme);
  };

  const switchUlt = (ultId: string) => {
    const targetUlt = ULTIMATES.find(u => u.id === ultId);
    if (targetUlt && hero.level >= targetUlt.unlockLevel) {
      setHero(h => ({ ...h, equippedUltId: ultId }));
    }
  };

  const buyWeapon = (weapon: Weapon) => {
    if (hero.weapon.id === weapon.id) return;
    if (hero.gold >= weapon.price) {
      setHero(h => ({ ...h, gold: h.gold - weapon.price, weapon: weapon }));
      addLog(`⚔️ [${weapon.name}] 구매 완료!`, 'SYSTEM');
    } else {
      addLog(`돈이 부족합니다! (${weapon.price}G 필요)`, 'SYSTEM');
    }
  };

  const changeJob = (job: Job) => {
    if (hero.job.id === job.id) return;
    if (hero.gold >= job.price) {
      // Need to adjust current HP/MP to not exceed new max or be weird
      setHero(h => {
        const newMaxHp = h.maxHp + job.hpBonus;
        const newMaxMp = h.maxMp + job.mpBonus;
        return { 
          ...h, 
          gold: h.gold - job.price, 
          job: job,
          // Cap current values to new max if needed, or keep them
          hp: Math.min(h.hp, newMaxHp),
          mp: Math.min(h.mp, newMaxMp)
        };
      });
      addLog(`🏅 [${job.name}] 전직 완료!`, 'SYSTEM');
    } else {
      addLog(`돈이 부족합니다! (${job.price}G 필요)`, 'SYSTEM');
    }
  };

  // --- Battle Logic ---

  const chargeUlt = (amount: number) => {
    setHero(h => ({ ...h, ult: Math.min(100, h.ult + amount) }));
  };

  const heroTurn = async (action: 'ATTACK' | 'FIREBALL' | 'ITEM' | 'ELIXIR' | 'DEFEND' | 'ULTIMATE') => {
    if (!monster || isProcessing) return;

    let dmg = 0;
    let logMsg = "";
    let ultCharge = 10;
    
    // 1. Hero Action
    if (action === 'ATTACK') {
      const isCrit = Math.random() < 0.2;
      dmg = Math.floor(totalAtk * (Math.random() * 0.4 + 0.8) * (isCrit ? 1.5 : 1));
      showFloat(isCrit ? `CRIT ${dmg}` : `${dmg}`, false, '#fff', isCrit);
      logMsg = `🗡️ [${monster.name}]에게 ${dmg}의 물리 피해!`;
      triggerShake(isCrit ? 2 : 1);
    } 
    else if (action === 'FIREBALL') {
      if (hero.mp < 15) {
        addLog("마력이 부족합니다!", 'SYSTEM');
        return;
      }
      setHero(h => ({ ...h, mp: h.mp - 15 }));
      dmg = Math.floor(totalAtk * 2.5);
      showFloat(`🔥 ${dmg}`, false, '#ffaa00');
      logMsg = `🔥 화염구 작렬! ${dmg}의 화염 피해!`;
      ultCharge = 15;
      triggerShake(1);
    }
    else if (action === 'ITEM') {
      if (hero.jellies <= 0) {
        addLog("젤리가 없습니다! 상점에서 구매하세요.", 'SYSTEM');
        return;
      }
      const heal = Math.floor(totalMaxHp * 0.5);
      setHero(h => ({ 
        ...h, 
        jellies: h.jellies - 1,
        hp: Math.min(totalMaxHp, h.hp + heal) 
      }));
      showFloat(`+${heal}`, true, '#00ff00');
      addLog(`🍬 젤리 섭취! 체력 ${heal} 회복. (남은 젤리: ${hero.jellies - 1})`, 'HERO');
      dmg = 0;
      ultCharge = 5;
    }
    else if (action === 'ELIXIR') {
      if (hero.elixirs <= 0) {
        addLog("엘릭서가 없습니다! 상점에서 구매하세요.", 'SYSTEM');
        return;
      }
      const mpRec = 50;
      setHero(h => ({ 
        ...h, 
        elixirs: h.elixirs - 1,
        mp: Math.min(totalMaxMp, h.mp + mpRec) 
      }));
      showFloat(`+${mpRec} MP`, true, COLORS.mp);
      addLog(`🧪 엘릭서 사용! 마력 ${mpRec} 회복. (남은 엘릭서: ${hero.elixirs - 1})`, 'HERO');
      dmg = 0;
      ultCharge = 5;
    }
    else if (action === 'DEFEND') {
      const mpRec = 15;
      setHero(h => ({ ...h, mp: Math.min(totalMaxMp, h.mp + mpRec) }));
      addLog("🛡️ 방어 태세! 마력을 회복합니다.", 'HERO');
      showFloat("+15 MP", true, COLORS.mp);
      dmg = 0;
      ultCharge = 5;
    }
    else if (action === 'ULTIMATE') {
       if (hero.ult < 100) return;
       const equippedUlt = ULTIMATES.find(u => u.id === hero.equippedUltId) || ULTIMATES[0];
       
       if (equippedUlt.id === 'METEOR') {
         dmg = Math.floor(totalAtk * 6);
         showFloat(`☄️ ${dmg}`, false, equippedUlt.color, true);
         logMsg = `☄️ [궁극기] 메테오 스트라이크!!!`;
         triggerShake(3);
       } else if (equippedUlt.id === 'HOLY_LIGHT') {
         const healAmount = Math.floor(totalMaxHp * 0.8);
         setHero(h => ({ ...h, hp: Math.min(totalMaxHp, h.hp + healAmount), mp: Math.min(totalMaxMp, h.mp + 50) }));
         showFloat(`+${healAmount}`, true, '#00ff00', true);
         logMsg = `✨ [궁극기] 성스러운 빛! 체력과 마력을 대폭 회복합니다!`;
         dmg = 0;
       } else if (equippedUlt.id === 'VAMPIRE') {
         dmg = Math.floor(totalAtk * 4);
         const vampHeal = Math.floor(dmg * 0.5);
         setHero(h => ({ ...h, hp: Math.min(totalMaxHp, h.hp + vampHeal) }));
         showFloat(`🩸 ${dmg}`, false, equippedUlt.color, true);
         setTimeout(() => showFloat(`+${vampHeal}`, true, '#00ff00'), 200);
         logMsg = `🩸 [궁극기] 블러드 슬래시! 피해량의 절반을 흡수합니다!`;
         triggerShake(2);
       }

       addLog(logMsg, 'HERO');
       setHero(h => ({ ...h, ult: 0 }));
       ultCharge = 0;
    }

    if (dmg > 0) {
      setMonster(m => m ? { ...m, hp: Math.max(0, m.hp - dmg) } : null);
      if (logMsg && action !== 'ULTIMATE') addLog(logMsg, 'HERO');
    }
    
    if (ultCharge > 0) chargeUlt(ultCharge);

    // Check Win
    if (monster.hp - dmg <= 0) {
      handleWin();
      return;
    }

    // 2. Enemy Turn (Delayed)
    setIsProcessing(true);
    setTimeout(() => {
      if (!monster) return;

      const isDefending = action === 'DEFEND';
      
      const dodgeChance = 0.05 + (hero.level * 0.005);
      const isDodged = Math.random() < dodgeChance;

      if (isDodged) {
        showFloat("MISS", true, '#aaa');
        addLog(`💨 [${monster.name}]의 공격을 회피했습니다!`, 'HERO');
        setIsProcessing(false);
        return;
      }

      const monsterDmgRaw = Math.floor(monster.atk * (Math.random() * 0.4 + 0.8));
      const monsterDmg = isDefending ? Math.floor(monsterDmgRaw / 2) : monsterDmgRaw;

      setHero(h => {
        const newHp = Math.max(0, h.hp - monsterDmg);
        if (newHp <= 0) setTimeout(() => setGameState('GAMEOVER'), 500);
        return { ...h, hp: newHp, ult: Math.min(100, h.ult + (monsterDmg > 0 ? 10 : 0)) };
      });

      if (monsterDmg > 0) {
        showFloat(`-${monsterDmg}`, true, COLORS.hp);
        addLog(`💥 [${monster.name}]의 공격! ${monsterDmg} 피해.`, 'MONSTER');
        triggerShake(1);
      } else {
        addLog(`[${monster.name}]의 공격이 빗나갔습니다!`, 'MONSTER');
      }

      setIsProcessing(false);
    }, 1000);
  };

  const buyJelly = () => {
    if (hero.gold >= 100) {
      setHero(h => ({ ...h, gold: h.gold - 100, jellies: h.jellies + 1 }));
      addLog(`🍬 젤리 구매 완료!`, 'SYSTEM');
    } else {
      addLog(`돈이 부족합니다!`, 'SYSTEM'); 
    }
  };

  const buyElixir = () => {
    if (hero.gold >= 150) {
      setHero(h => ({ ...h, gold: h.gold - 150, elixirs: h.elixirs + 1 }));
      addLog(`🧪 엘릭서 구매 완료!`, 'SYSTEM');
    } else {
      addLog(`돈이 부족합니다!`, 'SYSTEM'); 
    }
  };

  const pullGacha = () => {
    const PRICE = 300;
    if (hero.gold < PRICE) {
        addLog("돈이 부족합니다!", 'SYSTEM');
        return;
    }
    
    setHero(h => ({ ...h, gold: h.gold - PRICE }));
    setIsGachaRolling(true);
    setGachaResult({ text: "두근두근...", color: '#fff' });
    
    setTimeout(() => {
        const rand = Math.random();
        let rewardText = "";
        let rewardColor = "#fff";
        
        if (rand < 0.4) { // 40% Jelly
            setHero(h => ({ ...h, jellies: h.jellies + 1 }));
            rewardText = "🍬 젤리 1개 획득!";
            rewardColor = "#0f0";
        } else if (rand < 0.7) { // 30% Gold Refund
            const refund = Math.floor(Math.random() * 300) + 50;
            setHero(h => ({ ...h, gold: h.gold + refund }));
            rewardText = `💰 페이백! ${refund}G 획득!`;
            rewardColor = COLORS.gold;
        } else if (rand < 0.95) { // 25% Small Stat Boost
             if (Math.random() < 0.5) {
                setHero(h => ({ ...h, maxHp: h.maxHp + 10, hp: h.hp + 10 }));
                rewardText = "❤ 최대 체력 +10 증가!";
                rewardColor = COLORS.hp;
             } else {
                setHero(h => ({ ...h, baseAtk: h.baseAtk + 1 }));
                rewardText = "⚔ 공격력 +1 증가!";
                rewardColor = COLORS.secondary;
             }
        } else { // 5% Jackpot
             setHero(h => ({ ...h, baseAtk: h.baseAtk + 5, maxHp: h.maxHp + 50, hp: h.hp + 50, maxMp: h.maxMp + 20, mp: h.maxMp + 20, gold: h.gold + 1000 }));
             rewardText = "✨ 잭팟!! 올스탯 대폭 증가 & 1000G!!";
             rewardColor = COLORS.ult;
             triggerShake(2);
        }
        
        setIsGachaRolling(false);
        setGachaResult({ text: rewardText, color: rewardColor });
        addLog(`[뽑기] ${rewardText}`, 'SYSTEM');
    }, 1500);
  };

  const levelUp = (type: 'STR' | 'VIT' | 'INT') => {
    if (hasLeveledUp) return;

    if (type === 'STR') {
      setHero(h => ({ ...h, baseAtk: h.baseAtk + 4, level: h.level + 1 }));
      addLog("힘을 키웠습니다! (공격력 +4)", 'SYSTEM');
    } else if (type === 'VIT') {
      setHero(h => ({ ...h, maxHp: h.maxHp + 30, hp: Math.min(totalMaxHp + 30, h.hp + 30), level: h.level + 1 }));
      addLog("체력을 단련했습니다! (최대체력 +30 & 회복)", 'SYSTEM');
    } else if (type === 'INT') {
      setHero(h => ({ ...h, maxMp: h.maxMp + 20, mp: Math.min(totalMaxMp + 20, h.mp + 20), level: h.level + 1 }));
      addLog("지능을 높였습니다! (최대마력 +20 & 회복)", 'SYSTEM');
    }
    setHasLeveledUp(true);
  };

  const currentUlt = ULTIMATES.find(u => u.id === hero.equippedUltId) || ULTIMATES[0];

  return (
    <div style={{
      ...STYLES.container,
      borderColor: dungeonTheme.color,
      animation: shake === 2 ? 'shakeHard 0.4s' : shake === 1 ? 'shake 0.4s' : 'none'
    }}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes shakeHard {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-10px, -10px); }
          30% { transform: translate(10px, 10px); }
          50% { transform: translate(-10px, 10px); }
          70% { transform: translate(10px, -10px); }
        }
        @keyframes floatUp {
          to { transform: translateY(-80px); opacity: 0; }
        }
        @keyframes glow {
          0% { box-shadow: 0 0 5px ${currentUlt.color}; }
          50% { box-shadow: 0 0 20px ${currentUlt.color}, 0 0 10px #fff; }
          100% { box-shadow: 0 0 5px ${currentUlt.color}; }
        }
      `}</style>

      {/* Home Button */}
      {gameState !== 'START' && (
        <button 
          onClick={tryGoHome}
          style={{
            position: 'absolute', top: '15px', right: '15px', zIndex: 100,
            background: '#222', border: '1px solid #666', color: '#fff',
            fontSize: '1.2rem', padding: '5px 10px', cursor: 'pointer', borderRadius: '4px'
          }}
          title="홈으로 돌아가기"
        >
          🏠
        </button>
      )}
      
      {/* Home Confirmation Modal */}
      {showExitConfirm && (
        <div style={STYLES.overlay}>
           <div style={{background: '#222', border: '2px solid #fff', padding: '20px', borderRadius: '10px', maxWidth:'80%'}}>
             <h2 style={{marginTop:0, fontSize:'1.5rem'}}>정말 나가시겠습니까?</h2>
             <p>현재 진행 상황이 모두 사라집니다.</p>
             <div style={{display:'flex', gap:'15px', justifyContent:'center', marginTop:'15px'}}>
               <button onClick={confirmHome} style={{padding:'8px 16px', background:'#500', color:'#fff', border:'none', cursor:'pointer', fontSize:'1rem'}}>네, 나갈래요</button>
               <button onClick={cancelHome} style={{padding:'8px 16px', background:'#333', color:'#fff', border:'1px solid #666', cursor:'pointer', fontSize:'1rem'}}>취소</button>
             </div>
           </div>
        </div>
      )}

      {/* Header */}
      <div style={STYLES.header(dungeonTheme.color)}>
        <h1 style={STYLES.title(dungeonTheme.color)}>{dungeonTheme.name} <span style={{fontSize:'1rem', color:'#aaa'}}>({difficulty})</span></h1>
        <div style={{display:'flex', gap:'10px', alignItems:'center', marginRight: '40px'}}>
           {/* Hint for Shop */}
           <div 
             style={{fontSize:'1.2rem', cursor:'pointer', color: '#888'}} 
             title="전투에서 승리하면 상점이 열립니다."
             onClick={() => addLog("💡 팁: 몬스터를 처치하면 상점이 열립니다!", 'SYSTEM')}
           >
             🏘️
           </div>
           <div style={{fontSize:'1.2rem', color: COLORS.gold}}>💰 {hero.gold}G</div>
           <div style={STYLES.floorBadge(monster?.isBoss || false, dungeonTheme.color)}>
             {monster?.isBoss ? 'BOSS' : `B${floor}F`}
           </div>
        </div>
      </div>

      {/* Battle Scene */}
      <div style={STYLES.scene(dungeonTheme.bgGradient)}>
        {floatingTexts.map(ft => (
          <div key={ft.id} style={STYLES.floating(ft.x, ft.y, ft.color, ft.size)}>{ft.text}</div>
        ))}

        {/* Hero */}
        <div style={STYLES.charBox}>
          <div style={STYLES.emoji(1)}>{hero.job.emoji}</div>
          <div style={{color: dungeonTheme.color, fontSize: '1.2rem'}}>{hero.job.name} {hero.name} Lv.{hero.level}</div>
          
          <div style={{width: '100%', padding: '8px', background: 'rgba(0,0,0,0.6)'}}>
            <div style={{display:'flex', justifyContent:'space-between', fontSize: '1rem', color: '#fff'}}>
              <span>HP</span><span>{hero.hp}/{totalMaxHp}</span>
            </div>
            <div style={STYLES.statBar()}>
              <div style={STYLES.fill((hero.hp / totalMaxHp) * 100, COLORS.hp)}></div>
            </div>
            
            <div style={{display:'flex', justifyContent:'space-between', fontSize: '1rem', color: '#fff', marginTop: '4px'}}>
              <span>MP</span><span>{hero.mp}/{totalMaxMp}</span>
            </div>
            <div style={STYLES.statBar('8px')}>
              <div style={STYLES.fill((hero.mp / totalMaxMp) * 100, COLORS.mp)}></div>
            </div>

            <div style={{display:'flex', justifyContent:'space-between', fontSize: '1rem', color: currentUlt.color, marginTop: '4px'}}>
               <span>{currentUlt.name}</span><span>{Math.floor(hero.ult)}%</span>
            </div>
            <div style={{...STYLES.statBar('6px'), border: 'none', background: '#222'}}>
              <div style={{...STYLES.fill(hero.ult, currentUlt.color), boxShadow: hero.ult === 100 ? `0 0 8px ${currentUlt.color}` : 'none'}}></div>
            </div>
            
            <div style={{fontSize: '0.9rem', color: '#aaa', marginTop: '6px', textAlign:'center'}}>
              {hero.weapon.emoji}{hero.weapon.name} (Atk:{totalAtk})
            </div>
          </div>
        </div>

        {/* Monster */}
        {monster && (
          <div style={STYLES.charBox}>
            <div style={{...STYLES.emoji(monster.isBoss ? 2 : 1), animation: isProcessing ? 'none' : 'shake 3s infinite ease-in-out'}}>
              {monster.emoji}
            </div>
            <div style={{color: '#ffaaaa', fontSize: '1.2rem', textShadow: '0 0 5px #f00'}}>
              {monster.name}
            </div>
            <div style={{width: '100%', padding: '8px', background: 'rgba(0,0,0,0.6)'}}>
               <div style={{display:'flex', justifyContent:'space-between', fontSize: '1rem', color: '#fff'}}>
                <span>HP</span><span>{monster.hp}/{monster.maxHp}</span>
              </div>
              <div style={STYLES.statBar()}>
                <div style={STYLES.fill((monster.hp / monster.maxHp) * 100, COLORS.secondary)}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Log */}
      <div ref={logRef} style={STYLES.logWindow(dungeonTheme.color)}>
        {logs.map(log => (
          <div key={log.id} style={{
            marginBottom: '4px',
            color: log.source === 'SYSTEM' ? '#888' : log.source === 'HERO' ? '#aaf' : log.source === 'MONSTER' ? '#faa' : '#fff',
            borderLeft: log.source === 'SYSTEM' ? 'none' : `3px solid ${log.source === 'HERO' ? '#aaf' : '#faa'}`,
            paddingLeft: log.source === 'SYSTEM' ? 0 : '8px'
          }}>
            {log.text}
          </div>
        ))}
        {isProcessing && <div style={{color:'#666', fontStyle:'italic'}}>...턴 진행 중...</div>}
      </div>

      {/* Controls */}
      <div style={STYLES.controls(dungeonTheme.color)}>
        <button 
          style={STYLES.button(!isProcessing && !!monster, dungeonTheme.color)} 
          onClick={() => heroTurn('ATTACK')} disabled={isProcessing || !monster}
        >
          <span>⚔️</span> 공격
        </button>
        <button 
          style={STYLES.button(!isProcessing && !!monster, dungeonTheme.color)} 
          onClick={() => heroTurn('FIREBALL')} disabled={isProcessing || !monster}
        >
          <span>🔥</span> 화염구
          <span style={{fontSize:'0.8rem', color: COLORS.mp}}>15 MP</span>
        </button>
        
        {/* Items Combined */}
        <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
           <button 
            style={{...STYLES.button(!isProcessing && !!monster, dungeonTheme.color), flex:1, fontSize:'0.8rem'}} 
            onClick={() => heroTurn('ITEM')} disabled={isProcessing || !monster}
          >
             <span>🍬</span> 젤리 ({hero.jellies})
          </button>
          <button 
            style={{...STYLES.button(!isProcessing && !!monster, dungeonTheme.color), flex:1, fontSize:'0.8rem'}} 
            onClick={() => heroTurn('ELIXIR')} disabled={isProcessing || !monster}
          >
             <span>🧪</span> 엘릭서 ({hero.elixirs})
          </button>
        </div>

        <button 
          style={STYLES.button(!isProcessing && !!monster, dungeonTheme.color)} 
          onClick={() => heroTurn('DEFEND')} disabled={isProcessing || !monster}
        >
           <span>🛡️</span> 방어
           <span style={{fontSize:'0.8rem', color: COLORS.mp}}>MP회복</span>
        </button>
         <button 
          style={{
            ...STYLES.button(!isProcessing && !!monster && hero.ult >= 100, dungeonTheme.color, true, currentUlt.color),
            animation: hero.ult >= 100 ? 'glow 1.5s infinite' : 'none'
          }}
          onClick={() => heroTurn('ULTIMATE')} disabled={isProcessing || !monster || hero.ult < 100}
        >
           <span>{currentUlt.emoji}</span> {currentUlt.name}
        </button>
      </div>

      {/* Overlays */}
      
      {/* 1. START SCREEN */}
      {gameState === 'START' && (
        <div style={STYLES.overlay}>
          <h1 style={{fontSize:'3.5rem', color: COLORS.primary, marginBottom: '20px', textShadow:'0 0 20px #ff0'}}>ENDLESS DUNGEON</h1>
          <p style={{fontSize:'1.5rem', marginBottom: '40px'}}>준비되셨습니까?</p>
          <div style={{display:'flex', gap:'15px'}}>
            <button style={{
              padding: '15px 40px', fontSize: '1.5rem', background: 'transparent', 
              color: COLORS.primary, border: `3px solid ${COLORS.primary}`, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 'bold'
            }} onClick={() => setGameState('SELECT_THEME')}>
              모험 시작
            </button>
            <button style={{
              padding: '15px 20px', fontSize: '1.5rem', background: '#222', 
              color: '#fff', border: `1px solid #666`, cursor: 'pointer',
              fontFamily: 'inherit'
            }} onClick={openShopFromStart}>
              상점 구경
            </button>
          </div>
        </div>
      )}

      {/* 2. SELECT THEME */}
      {gameState === 'SELECT_THEME' && (
        <div style={STYLES.overlay}>
           <h2 style={{color: '#fff', marginBottom:'20px', fontSize:'2rem'}}>던전 선택</h2>
           <div style={{display:'flex', flexWrap:'wrap', justifyContent:'center'}}>
             {DUNGEONS.map(d => (
               <div key={d.id} style={STYLES.dungeonCard(d.color)} onClick={() => selectDungeon(d)}>
                 <div style={{fontSize:'3rem'}}>{d.emoji}</div>
                 <h3 style={{color: d.color, fontSize:'1.5rem'}}>{d.name}</h3>
                 <p style={{fontSize:'0.9rem', color:'#aaa'}}>{d.description}</p>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* 2.5 SELECT DIFFICULTY */}
      {gameState === 'SELECT_DIFFICULTY' && (
        <div style={STYLES.overlay}>
           <h2 style={{color: '#fff', marginBottom:'20px', fontSize:'2rem'}}>난이도 선택</h2>
           <div style={{display:'flex', gap:'10px'}}>
             <div 
               style={{...STYLES.dungeonCard('#00ff00'), borderColor: '#00ff00'}} 
               onClick={() => startGame('EASY')}
             >
               <div style={{fontSize:'3rem'}}>🐣</div>
               <h3 style={{color: '#00ff00', fontSize:'1.5rem'}}>쉬움</h3>
               <p style={{fontSize:'0.9rem', color:'#aaa'}}>적 약함, 보상 적음</p>
             </div>
             <div 
               style={{...STYLES.dungeonCard(COLORS.primary), borderColor: COLORS.primary}} 
               onClick={() => startGame('NORMAL')}
             >
               <div style={{fontSize:'3rem'}}>⚔️</div>
               <h3 style={{color: COLORS.primary, fontSize:'1.5rem'}}>보통</h3>
               <p style={{fontSize:'0.9rem', color:'#aaa'}}>표준 밸런스</p>
             </div>
             <div 
               style={{...STYLES.dungeonCard(COLORS.secondary), borderColor: COLORS.secondary}} 
               onClick={() => startGame('HARD')}
             >
               <div style={{fontSize:'3rem'}}>☠️</div>
               <h3 style={{color: COLORS.secondary, fontSize:'1.5rem'}}>어려움</h3>
               <p style={{fontSize:'0.9rem', color:'#aaa'}}>적 강함, 보상 1.5배</p>
             </div>
           </div>
           <button style={{marginTop:'20px', background:'transparent', color:'#888', border:'none', cursor:'pointer', fontSize:'1rem'}} onClick={() => setGameState('SELECT_THEME')}>
             뒤로가기
           </button>
        </div>
      )}

      {/* 3. SHOP & REST */}
      {gameState === 'SHOP' && (
        <div style={STYLES.overlay}>
          <div style={{display:'flex', justifyContent:'space-between', width:'100%', padding:'0 20px', alignItems:'center'}}>
            <div style={{fontSize:'2rem'}}>🏘️ 상점 (마을)</div>
            <div style={{fontSize:'1.5rem', color: COLORS.gold}}>💰 {hero.gold}G</div>
          </div>

          {/* Tab Navigation */}
          <div style={{display:'flex', width:'95%', marginTop:'10px'}}>
             <div style={STYLES.shopTab(shopTab === 'ITEMS')} onClick={() => setShopTab('ITEMS')}>🛒 아이템</div>
             <div style={STYLES.shopTab(shopTab === 'WEAPONS')} onClick={() => setShopTab('WEAPONS')}>⚒️ 대장간</div>
             <div style={STYLES.shopTab(shopTab === 'JOBS')} onClick={() => setShopTab('JOBS')}>🏰 길드</div>
             <div style={STYLES.shopTab(shopTab === 'SKILLS')} onClick={() => setShopTab('SKILLS')}>✨ 필살기</div>
          </div>
          
          <div style={{background: '#1a1a1a', width:'95%', height: '400px', padding: '15px', overflowY:'auto', border: `1px solid #333`}}>
             
             {/* Tab 1: ITEMS */}
             {shopTab === 'ITEMS' && (
               <div style={{display:'flex', flexDirection:'column', gap:'10px', alignItems:'center'}}>
                   <div style={STYLES.shopItem} onClick={buyJelly}>
                     <div style={{textAlign:'left'}}>
                       <div style={{color:'#0f0', fontSize:'1.2rem'}}>🍬 회복 젤리</div>
                       <div style={{fontSize:'0.9rem', color:'#888'}}>HP 50% 회복 (보유: {hero.jellies})</div>
                     </div>
                     <div style={{color: hero.gold >= 100 ? COLORS.gold : '#555', fontSize:'1.2rem'}}>
                       100 G <button style={{marginLeft:'10px', padding: '5px 10px', background:'transparent', border:'1px solid #fff', color:'#fff', cursor:'pointer'}} disabled={hero.gold < 100}>구매</button>
                     </div>
                  </div>
                  
                  <div style={STYLES.shopItem} onClick={buyElixir}>
                     <div style={{textAlign:'left'}}>
                       <div style={{color: COLORS.mp, fontSize:'1.2rem'}}>🧪 마력 엘릭서</div>
                       <div style={{fontSize:'0.9rem', color:'#888'}}>MP 50 회복 (보유: {hero.elixirs})</div>
                     </div>
                     <div style={{color: hero.gold >= 150 ? COLORS.gold : '#555', fontSize:'1.2rem'}}>
                       150 G <button style={{marginLeft:'10px', padding: '5px 10px', background:'transparent', border:'1px solid #fff', color:'#fff', cursor:'pointer'}} disabled={hero.gold < 150}>구매</button>
                     </div>
                  </div>

                  <div style={{...STYLES.shopItem, flexDirection: 'column', alignItems: 'center', padding:'20px', gap:'10px', border:`1px solid ${COLORS.ult}`, marginTop:'20px'}}>
                     <div style={{fontSize:'2.5rem'}}>{isGachaRolling ? '🔮' : '🎁'}</div>
                     <div style={{color: COLORS.ult, fontSize:'1.2rem'}}>미스터리 뽑기</div>
                     <button 
                       onClick={pullGacha} 
                       disabled={hero.gold < 300 || isGachaRolling}
                       style={{
                          background: hero.gold >= 300 ? '#4a004a' : '#333', 
                          border: `1px solid ${COLORS.ult}`, 
                          color: '#fff', 
                          padding: '8px 20px', 
                          fontSize: '1rem',
                          cursor: hero.gold >= 300 ? 'pointer' : 'not-allowed'
                       }}
                     >
                       {isGachaRolling ? '뽑는 중...' : '300G 뽑기'}
                     </button>
                     {gachaResult && (
                       <div style={{color: gachaResult.color, fontWeight:'bold', textAlign:'center', fontSize:'1rem'}}>
                         {gachaResult.text}
                       </div>
                     )}
                   </div>
               </div>
             )}

             {/* Tab 2: WEAPONS */}
             {shopTab === 'WEAPONS' && (
               <div style={{display:'flex', flexDirection:'column', gap:'10px', alignItems:'center'}}>
                 {WEAPONS.map(w => {
                   const isOwned = hero.weapon.id === w.id;
                   const canBuy = hero.gold >= w.price;
                   return (
                     <div key={w.id} style={{...STYLES.shopItem, borderColor: isOwned ? COLORS.gold : '#666', background: isOwned ? '#332200' : '#222'}} onClick={() => !isOwned && buyWeapon(w)}>
                       <div style={{textAlign:'left', display:'flex', alignItems:'center', gap:'15px'}}>
                         <div style={{fontSize:'2.5rem'}}>{w.emoji}</div>
                         <div>
                            <div style={{color: isOwned ? COLORS.gold : '#fff', fontSize:'1.1rem'}}>{w.name} {isOwned && '(장착중)'}</div>
                            <div style={{fontSize:'0.9rem', color:'#aaa'}}>공격력 +{w.atkBonus} | {w.description}</div>
                         </div>
                       </div>
                       {!isOwned && (
                         <div style={{color: canBuy ? COLORS.gold : '#555', fontSize:'1.1rem'}}>
                            {w.price} G <button disabled={!canBuy} style={{marginLeft:'8px', padding:'4px 10px', cursor: canBuy ? 'pointer' : 'not-allowed'}}>구매</button>
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
             )}

             {/* Tab 3: JOBS */}
             {shopTab === 'JOBS' && (
               <div style={{display:'flex', flexDirection:'column', gap:'10px', alignItems:'center'}}>
                 {JOBS.map(j => {
                   const isCurrent = hero.job.id === j.id;
                   const canBuy = hero.gold >= j.price;
                   return (
                     <div key={j.id} style={{...STYLES.shopItem, borderColor: isCurrent ? COLORS.secondary : '#666', background: isCurrent ? '#330000' : '#222'}} onClick={() => !isCurrent && changeJob(j)}>
                       <div style={{textAlign:'left', display:'flex', alignItems:'center', gap:'15px'}}>
                         <div style={{fontSize:'2.5rem'}}>{j.emoji}</div>
                         <div>
                            <div style={{color: isCurrent ? COLORS.secondary : '#fff', fontSize:'1.1rem'}}>{j.name} {isCurrent && '(현재)'}</div>
                            <div style={{fontSize:'0.9rem', color:'#aaa'}}>
                              HP{j.hpBonus > 0 ? `+${j.hpBonus}` : j.hpBonus} MP{j.mpBonus > 0 ? `+${j.mpBonus}` : j.mpBonus} ATK{j.atkBonus > 0 ? `+${j.atkBonus}` : j.atkBonus}
                            </div>
                            <div style={{fontSize:'0.8rem', color:'#666'}}>{j.description}</div>
                         </div>
                       </div>
                       {!isCurrent && (
                         <div style={{color: canBuy ? COLORS.gold : '#555', fontSize:'1.1rem'}}>
                            {j.price} G <button disabled={!canBuy} style={{marginLeft:'8px', padding:'4px 10px', cursor: canBuy ? 'pointer' : 'not-allowed'}}>전직</button>
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
             )}

             {/* Tab 4: SKILLS */}
             {shopTab === 'SKILLS' && (
               <div style={{display:'flex', flexDirection:'column', gap:'10px', alignItems:'center'}}>
                 {ULTIMATES.map(u => {
                    const isLocked = hero.level < u.unlockLevel;
                    const isSelected = hero.equippedUltId === u.id;
                    return (
                      <div key={u.id} 
                           style={STYLES.ultCard(isSelected, isLocked, u.color)}
                           onClick={() => !isLocked && switchUlt(u.id)}>
                        <div style={{fontSize:'2.5rem'}}>{isLocked ? '🔒' : u.emoji}</div>
                        <div>
                           <div style={{color: isLocked ? '#666' : u.color, fontWeight:'bold', fontSize:'1.2rem'}}>
                             {u.name} {isSelected && <span style={{fontSize:'0.9rem', color:'#fff'}}> [장착됨]</span>}
                           </div>
                           <div style={{fontSize:'0.9rem', color:'#aaa'}}>
                             {isLocked ? `Lv.${u.unlockLevel} 해금` : u.description}
                           </div>
                        </div>
                      </div>
                    );
                  })}
               </div>
             )}

          </div>

          <div style={{width:'95%', margin:'15px auto'}}>
            {/* Conditional Rendering for Shop Actions */}
            {!isBrowsing ? (
              <>
                <h3 style={{color: '#fff', borderBottom:'1px solid #555', paddingBottom:'8px', marginBottom: '10px', fontSize:'1.2rem'}}>
                  {hasLeveledUp ? '준비 완료' : '능력치 강화 (1회 필수)'}
                </h3>
                
                {!hasLeveledUp ? (
                  <div style={{display:'flex', gap:'10px', justifyContent:'center'}}>
                    <button style={STYLES.card(COLORS.secondary, false)} onClick={() => levelUp('STR')}>
                      <div style={{color: COLORS.secondary, fontSize:'1.2rem'}}>💪 힘 강화</div>
                      <div style={{fontSize:'0.9rem', color:'#ccc'}}>공격력 +4</div>
                    </button>
                    <button style={STYLES.card(COLORS.hp, false)} onClick={() => levelUp('VIT')}>
                      <div style={{color: COLORS.hp, fontSize:'1.2rem'}}>❤ 체력 단련</div>
                      <div style={{fontSize:'0.9rem', color:'#ccc'}}>최대체력 +30<br/>(체력 회복)</div>
                    </button>
                    <button style={STYLES.card(COLORS.mp, false)} onClick={() => levelUp('INT')}>
                      <div style={{color: COLORS.mp, fontSize:'1.2rem'}}>🧠 지능 개발</div>
                      <div style={{fontSize:'0.9rem', color:'#ccc'}}>최대마력 +20<br/>(마력 회복)</div>
                    </button>
                  </div>
                ) : (
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:'1.2rem', color:'#0f0', marginBottom:'10px'}}>✅ 능력치 강화 완료</div>
                    <button 
                      onClick={nextFloor}
                      style={{
                        padding:'12px 40px', 
                        fontSize:'1.5rem', 
                        background: COLORS.primary, 
                        color: '#000', 
                        border:'none', 
                        fontWeight:'bold',
                        cursor:'pointer',
                        boxShadow: `0 0 15px ${COLORS.primary}`
                      }}
                    >
                      다음 층으로 ({floor + 1}F) ▶
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{textAlign:'center', marginTop:'20px'}}>
                <button 
                  onClick={exitShopToStart}
                  style={{
                    padding:'12px 40px', 
                    fontSize:'1.5rem', 
                    background: '#555', 
                    color: '#fff', 
                    border:'none', 
                    fontWeight:'bold',
                    cursor:'pointer',
                    boxShadow: `0 0 10px #333`
                  }}
                >
                  ◀ 타이틀로 돌아가기
                </button>
                <div style={{marginTop:'10px', color:'#888', fontSize:'0.9rem'}}>
                  * 구경 모드에서는 진행 상황이 저장되지 않습니다.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. GAME OVER */}
      {gameState === 'GAMEOVER' && (
        <div style={STYLES.overlay}>
           <h1 style={{fontSize:'5rem', color:'#888', margin: 0}}>YOU DIED</h1>
           <p style={{fontSize:'1.5rem', color: dungeonTheme.color}}>
             {hero.name}는 {floor}층에서 {monster?.name}에게 쓰러졌습니다.
           </p>
           <button style={{
             marginTop:'30px', padding: '12px 40px', fontSize: '1.2rem',
             background: '#333', color: '#fff', border: 'none', cursor: 'pointer'
           }} onClick={() => setGameState('START')}>
             처음으로
           </button>
        </div>
      )}

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);