// App.js - 老人斗地主游戏 (支持多种模式)
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  Modal,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 扑克牌数据结构
const createDeck = () => {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const deck = [];
  
  // 添加普通牌
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value, id: `${suit}${value}`, type: 'normal' });
    }
  }
  
  // 添加大小王
  deck.push({ suit: '', value: 'Joker', id: 'small_joker', type: 'joker', realValue: '小王' });
  deck.push({ suit: '', value: 'Joker', id: 'big_joker', type: 'joker', realValue: '大王' });
  
  return shuffleDeck(deck);
};

const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 牌值排序与等级函数
const valuesOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

// 返回单张牌的等级（数字越大表示牌越大）
const cardRank = (card) => {
  if (!card) return -1;
  if (card.type === 'joker') {
    // 小王小于大王
    return card.id === 'small_joker' ? valuesOrder.length : valuesOrder.length + 1; // 13,14
  }
  return valuesOrder.indexOf(card.value);
};

// 用于 Array.sort 的比较函数（从小到大）
const compareCardValues = (card1, card2) => {
  return cardRank(card1) - cardRank(card2);
};

// 牌型判断函数
const getCardType = (cards) => {
  if (cards.length === 0) return { type: 'pass', valid: true };
  
  // 排序
  const sortedCards = [...cards].sort(compareCardValues);
  
  // 单张
  if (cards.length === 1) return { type: 'single', valid: true, value: cardRank(cards[0]) };
  
  // 对子
  if (cards.length === 2 && cards[0].value === cards[1].value) return { type: 'pair', valid: true, value: cardRank(cards[0]) };
  
  // 三张
  if (cards.length === 3 && cards[0].value === cards[1].value && cards[1].value === cards[2].value) return { type: 'triple', valid: true, value: cardRank(cards[0]) };
  
  // 三带一
  if (cards.length === 4) {
    const valueCounts = {};
    cards.forEach(card => {
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    });
    
    const counts = Object.values(valueCounts);
    if (counts.includes(3) && counts.includes(1)) {
      const tripleValue = Object.keys(valueCounts).find(v => valueCounts[v] === 3);
      return { type: 'triple_with_single', valid: true, value: valuesOrder.indexOf(tripleValue) };
    }
  }
  
  // 三带二
  if (cards.length === 5) {
    const valueCounts = {};
    cards.forEach(card => {
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    });
    
    const counts = Object.values(valueCounts);
    if (counts.includes(3) && counts.includes(2)) {
      const tripleValue = Object.keys(valueCounts).find(v => valueCounts[v] === 3);
      return { type: 'triple_with_pair', valid: true, value: valuesOrder.indexOf(tripleValue) };
    }
  }
  
  // 王炸
  if (cards.length === 2 && 
      ((cards[0].id === 'small_joker' && cards[1].id === 'big_joker') || 
       (cards[0].id === 'big_joker' && cards[1].id === 'small_joker'))) {
    return { type: 'king_bomb', valid: true, value: 999 }; // 王炸最大值
  }
  
  // 普通炸弹
  if (cards.length === 4 && cards[0].value === cards[1].value && 
      cards[1].value === cards[2].value && cards[2].value === cards[3].value) {
    return { type: 'bomb', valid: true, value: cardRank(cards[0]) };
  }
  
  // 顺子（至少5张）
  if (cards.length >= 5) {
    const uniqueValues = [...new Set(cards.map(c => c.value))];
    if (uniqueValues.length !== cards.length) return { type: 'invalid', valid: false }; // 不能有重复值
    
    const sortedValues = uniqueValues.sort((a, b) => {
      const valuesOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
      return valuesOrder.indexOf(a) - valuesOrder.indexOf(b);
    });
    
    // 检查是否连续且不包含2
    let isStraight = true;
    for (let i = 1; i < sortedValues.length; i++) {
      const currentIndex = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'].indexOf(sortedValues[i]);
      const prevIndex = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'].indexOf(sortedValues[i-1]);
      
      if (currentIndex !== prevIndex + 1 || sortedValues[i] === '2') {
        isStraight = false;
        break;
      }
    }
    
    if (isStraight) {
      return { type: 'straight', valid: true, value: valuesOrder.indexOf(sortedValues[sortedValues.length-1]) };
    }
  }
  
  // 连对（至少3对）
  if (cards.length >= 6 && cards.length % 2 === 0) {
    const valueCounts = {};
    cards.forEach(card => {
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    });
    
    const counts = Object.values(valueCounts);
    if (counts.every(count => count === 2)) { // 所有牌都成对
      const uniqueValues = Object.keys(valueCounts);
      const sortedValues = uniqueValues.sort((a, b) => {
        const valuesOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        return valuesOrder.indexOf(a) - valuesOrder.indexOf(b);
      });
      
      // 检查是否连续
      let isChain = true;
      for (let i = 1; i < sortedValues.length; i++) {
        const currentIndex = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'].indexOf(sortedValues[i]);
        const prevIndex = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'].indexOf(sortedValues[i-1]);
        
        if (currentIndex !== prevIndex + 1 || sortedValues[i] === '2') {
          isChain = false;
          break;
        }
      }
      
      if (isChain) {
        return { type: 'chain_pairs', valid: true, value: valuesOrder.indexOf(sortedValues[sortedValues.length-1]) };
      }
    }
  }
  
  // 四带二
  if (cards.length === 6) {
    const valueCounts = {};
    cards.forEach(card => {
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    });
    
    const counts = Object.values(valueCounts);
    if (counts.includes(4) && (counts.filter(c => c === 1).length === 2 || counts.filter(c => c === 2).length === 1)) {
      const fourValue = Object.keys(valueCounts).find(v => valueCounts[v] === 4);
      return { type: 'four_with_two', valid: true, value: valuesOrder.indexOf(fourValue) };
    }
  }
  
  return { type: 'invalid', valid: false };
};

// 比较牌型大小
const canBeat = (currentCards, lastCards) => {
  if (lastCards.length === 0) return true; // 没有上一手牌，任何牌都可以出
  
  const currentType = getCardType(currentCards);
  const lastType = getCardType(lastCards);
  
  // 王炸最大
  if (currentType.type === 'king_bomb') return true;
  if (lastType.type === 'king_bomb') return false;
  
  // 普通炸弹比非炸弹大
  if (currentType.type === 'bomb' && lastType.type !== 'bomb') return true;
  if (currentType.type !== 'bomb' && lastType.type === 'bomb') return false;
  
  // 同类型比较
  if (currentType.type === lastType.type) {
    return currentType.value > lastType.value;
  }
  
  return false;
};

// 游戏主组件
export default function App() {
  const [gameState, setGameState] = useState('menu'); // menu, dealing, bidding, playing, gameOver
  const [gameMode, setGameMode] = useState('standard'); // standard, classic, fast, threeKing
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [computer1Hand, setComputer1Hand] = useState([]);
  const [computer2Hand, setComputer2Hand] = useState([]);
  const [bottomCards, setBottomCards] = useState([]); // 底牌
  const [pendingBottom, setPendingBottom] = useState({ owner: -1, cards: [] }); // 待确认插入的底牌
  const [bottomInserted, setBottomInserted] = useState(false);
  const [cardOrder, setCardOrder] = useState('asc'); // 'asc' 小->大, 'desc' 大->小

  // 计分相关
  const [bombsCount, setBombsCount] = useState(0); // 炸弹次数
  const [playedAny, setPlayedAny] = useState([false, false, false]); // 各玩家是否出过牌
  
  const [currentPlayer, setCurrentPlayer] = useState(0); // 0: 玩家, 1: 电脑1, 2: 电脑2
  const [lastPlayedCards, setLastPlayedCards] = useState([]);
  const [lastPlayer, setLastPlayer] = useState(-1); // 上一个出牌的玩家
  const [consecutivePasses, setConsecutivePasses] = useState(0); // 连续过牌计数，当达到2时允许最后出牌者任意出牌
  const [selectedCards, setSelectedCards] = useState([]);
  const [gameLog, setGameLog] = useState([]); // 游戏日志
  const [showSettings, setShowSettings] = useState(false); // 设置界面
  const [showGameLog, setShowGameLog] = useState(false); // 游戏记录界面
  const [showHowToPlay, setShowHowToPlay] = useState(false); // 游戏玩法说明
  const [showGameModeSelection, setShowGameModeSelection] = useState(false); // 游戏模式选择界面
  const [landlord, setLandlord] = useState(-1); // 地主 (-1: 未确定, 0,1,2: 地主)
  const [highestBid, setHighestBid] = useState(0); // 最高叫分
  const [bidder, setBidder] = useState(-1); // 当前叫分者
  const [bids, setBids] = useState([0, 0, 0]); // 每个玩家的叫分 [玩家, 电脑1, 电脑2]
  const [gamePhase, setGamePhase] = useState('bidding'); // bidding, playing

  // 初始化游戏
  const initGame = () => {
    const newDeck = createDeck();
    const playerCards = newDeck.slice(0, 17);
    const computer1Cards = newDeck.slice(17, 34);
    const computer2Cards = newDeck.slice(34, 51);
    const bottomCards = newDeck.slice(51, 54);

    // 排序手牌
    const sortedPlayerCards = [...playerCards].sort(compareCardValues);

    setDeck(newDeck);
    setPlayerHand(sortedPlayerCards);
    setComputer1Hand(computer1Cards);
    setComputer2Hand(computer2Cards);
    setBottomCards(bottomCards);
    setPendingBottom({ owner: -1, cards: [] });
    setBottomInserted(false);
    setBombsCount(0);
    setPlayedAny([false, false, false]);
    setCurrentPlayer(0);
    setLastPlayedCards([]);
    setLastPlayer(-1);
    setSelectedCards([]);

    // 根据游戏模式设置初始状态
    if (gameMode === 'standard') {
      // 标准模式：经典叫地主
      setGameLog(['发牌完成，开始叫地主！']);
      setLandlord(-1);
      setHighestBid(0);
      setBidder(0); // 从玩家开始叫地主
      setBids([0, 0, 0]);
      setGamePhase('bidding');
      setGameState('playing'); // 现在开始游戏，但处于叫地主阶段
    } else if (gameMode === 'classic') {
      // 经典模式：不叫地主，随机分配地主
      // 随机选择地主
      const randomLandlord = Math.floor(Math.random() * 3);
      let newPlayerHand = [...playerCards];
      let newComputer1Hand = [...computer1Cards];
      let newComputer2Hand = [...computer2Cards];

      switch(randomLandlord) {
        case 0: // 玩家是地主
          newPlayerHand = [...playerCards, ...bottomCards].sort(compareCardValues);
          setGameLog(['发牌完成，随机选择地主中...', `您成为地主，获得底牌！`]);
          break;
        case 1: // 电脑1是地主
          newComputer1Hand = [...computer1Cards, ...bottomCards].sort(compareCardValues);
          setGameLog(['发牌完成，随机选择地主中...', `电脑1成为地主，获得底牌！`]);
          break;
        case 2: // 电脑2是地主
          newComputer2Hand = [...computer2Cards, ...bottomCards].sort(compareCardValues);
          setGameLog(['发牌完成，随机选择地主中...', `电脑2成为地主，获得底牌！`]);
          break;
      }

      setPlayerHand(newPlayerHand);
      setComputer1Hand(newComputer1Hand);
      setComputer2Hand(newComputer2Hand);
      setBottomCards([]);
      setLandlord(randomLandlord);
      setGamePhase('playing');
      setCurrentPlayer(randomLandlord); // 地主先出牌
      setGameState('playing');
    } else if (gameMode === 'fast') {
      // 快速模式：简化流程，自动叫分
      setGameLog(['发牌完成，自动叫地主中...']);
      setLandlord(-1);
      setHighestBid(0);
      setBidder(0); // 从玩家开始叫地主
      setBids([0, 0, 0]);
      setGamePhase('bidding');
      setGameState('playing');

      // 立即开始自动叫地主
      setTimeout(() => {
        // 简单的AI叫地主逻辑：根据手牌强度决定叫分
        const valueCounts = {};
        playerCards.forEach(card => {
          valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });

        let strength = 0;
        Object.values(valueCounts).forEach(count => {
          if (count === 2) strength += 1; // 对子
          else if (count === 3) strength += 2; // 三张
          else if (count === 4) strength += 4; // 炸弹
        });

        // 如果有王炸，增加强度
        const hasJokers = playerCards.some(c => c.type === 'joker');
        if (hasJokers) {
          const jokerCount = playerCards.filter(c => c.type === 'joker').length;
          if (jokerCount === 2) strength += 5; // 王炸
        }

        let bid = 0;
        if (strength >= 6) bid = 3;
        else if (strength >= 4) bid = 2;
        else if (strength >= 2) bid = 1;
        else bid = 0;

        bidLandlord(bid);
      }, 1000);
    } else if (gameMode === 'threeKing') {
      // 三王模式：三人游戏，无叫地主环节
      setGameLog(['发牌完成，三王模式开始！']);
      setLandlord(-1);
      setHighestBid(0);
      setBidder(-1);
      setBids([0, 0, 0]);
      setGamePhase('playing');
      setCurrentPlayer(0); // 玩家先出牌
      setGameState('playing');
    } else {
      // 默认为标准模式
      setGameLog(['发牌完成，开始叫地主！']);
      setLandlord(-1);
      setHighestBid(0);
      setBidder(0); // 从玩家开始叫地主
      setBids([0, 0, 0]);
      setGamePhase('bidding');
      setGameState('playing'); // 现在开始游戏，但处于叫地主阶段
    }
  };

  // 开始新游戏
  const startNewGame = () => {
    initGame();
  };

  // 叫地主
  const bidLandlord = (bid) => {
    if (gamePhase !== 'bidding' || bidder !== 0) return;
    
    if (bid <= highestBid && bid !== 0) {
      Alert.alert('提示', `叫分必须高于当前最高分(${highestBid}分)`);
      return;
    }
    
    if (bid > 3) {
      Alert.alert('提示', '最高只能叫3分');
      return;
    }
    
    const newBids = [...bids];
    newBids[0] = bid;
    setBids(newBids);
    
    if (bid > highestBid) {
      setHighestBid(bid);
      setLandlord(0); // 暂时设定玩家为地主，如果没人更高分则最终确定
    }
    
    setGameLog(prev => [...prev, `您叫了${bid === 0 ? '不叫' : bid + '分'}`]);
    
    // 轮到下一个玩家
    setBidder(prev => (prev + 1) % 3);
  };

  // 不叫地主
  const passBid = () => {
    if (gamePhase !== 'bidding' || bidder !== 0) return;
    
    setGameLog(prev => [...prev, '您选择不叫']);
    
    // 轮到下一个玩家
    setBidder(prev => (prev + 1) % 3);
  };

  // 电脑叫地主
  useEffect(() => {
    if (gamePhase === 'bidding' && bidder !== 0 && landlord === -1) {
      const timer = setTimeout(() => {
        const computerIndex = bidder;
        let computerHand;
        
        switch(computerIndex) {
          case 1:
            computerHand = computer1Hand;
            break;
          case 2:
            computerHand = computer2Hand;
            break;
          default:
            return;
        }
        
        // 简单的AI叫地主逻辑：根据手牌强度决定叫分
        let bid = 0;
        
        // 计算手牌强度（简单算法：统计对子、三张、炸弹等）
        const valueCounts = {};
        computerHand.forEach(card => {
          valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        
        let strength = 0;
        Object.values(valueCounts).forEach(count => {
          if (count === 2) strength += 1; // 对子
          else if (count === 3) strength += 2; // 三张
          else if (count === 4) strength += 4; // 炸弹
        });
        
        // 如果有王炸，增加强度
        const hasJokers = computerHand.some(c => c.type === 'joker');
        if (hasJokers) {
          const jokerCount = computerHand.filter(c => c.type === 'joker').length;
          if (jokerCount === 2) strength += 5; // 王炸
        }
        
        // 根据强度决定叫分
        if (strength >= 6) bid = 3;
        else if (strength >= 4) bid = 2;
        else if (strength >= 2) bid = 1;
        else bid = 0;
        
        // 如果当前最高分已经是3分，就不再叫
        if (highestBid === 3) bid = 0;
        
        // 确保叫分高于当前最高分
        if (bid <= highestBid) bid = 0;
        
        const newBids = [...bids];
        newBids[computerIndex] = bid;
        setBids(newBids);
        
        if (bid > highestBid) {
          setHighestBid(bid);
          setLandlord(computerIndex);
        }
        
        setGameLog(prev => [...prev, `电脑${computerIndex}叫了${bid === 0 ? '不叫' : bid + '分'}`]);
        
        // 检查是否所有人都已叫分
        const allBids = newBids.filter(b => b !== 0).length;
        const totalBids = newBids[0] + newBids[1] + newBids[2];
        
        // 如果已经有人叫分，且连续三人不叫，则结束叫地主
        if (bid === 0 && highestBid > 0) {
          // 检查是否连续三人不叫
          const nextBidder = (computerIndex + 1) % 3;
          if (nextBidder === 0) {
            // 轮到玩家，如果玩家也不叫，则结束
            // 这里我们假设当前AI已经不叫，等待下一个玩家决定
          }
        }
        
        // 轮到下一个玩家
        setBidder(prev => (prev + 1) % 3);
      }, 1500); // 1.5秒后电脑叫分

      return () => clearTimeout(timer);
    }
  }, [bidder, gamePhase, highestBid, bids]);

  // 检查叫地主是否结束
  useEffect(() => {
    if (gamePhase === 'bidding' && bidder !== 0) {
      // 检查是否所有人都已叫分
      const allBids = bids.filter(b => b !== 0).length;
      const totalBids = bids[0] + bids[1] + bids[2];
      
      // 如果连续三人不叫（即一轮都没人叫分），则重新发牌
      if (totalBids === 0 && bidder === 0) {
        setGameLog(prev => [...prev, '无人叫分，重新发牌']);
        setTimeout(() => {
          initGame();
        }, 2000);
        return;
      }
      
      // 如果有人叫分，且已经轮了一圈，或者有人叫了3分，则结束叫地主
      if ((totalBids > 0 && bidder === 0) || highestBid === 3) {
        // 确定地主
        if (landlord !== -1) {
          // 给地主底牌
          let newPlayerHand = [...playerHand];
          let newComputer1Hand = [...computer1Hand];
          let newComputer2Hand = [...computer2Hand];
          
          switch(landlord) {
            case 0: // 玩家是地主
              // 玩家成为地主：先展示为待确认底牌，让玩家查看后确认插入
              setPendingBottom({ owner: 0, cards: bottomCards });
              setBottomInserted(false);
              setGameLog(prev => [...prev, `您成为地主，获得底牌！（请确认收牌）`]);
              break;
            case 1: // 电脑1是地主
              newComputer1Hand = [...computer1Hand, ...bottomCards].sort(compareCardValues);
              setGameLog(prev => [...prev, `电脑1成为地主，获得底牌！`]);
              break;
            case 2: // 电脑2是地主
              newComputer2Hand = [...computer2Hand, ...bottomCards].sort(compareCardValues);
              setGameLog(prev => [...prev, `电脑2成为地主，获得底牌！`]);
              break;
          }
          
          setPlayerHand(newPlayerHand);
          setComputer1Hand(newComputer1Hand);
          setComputer2Hand(newComputer2Hand);
          // 如果 pendingBottom 已设置给玩家，则清空底牌数组（实际卡片在 pendingBottom 中）
          setBottomCards([]);
          setGamePhase('playing');
          setCurrentPlayer(landlord); // 地主先出牌
          setGameLog(prev => [...prev, `游戏开始！地主是${landlord === 0 ? '您' : `电脑${landlord}`}`]);
        } else {
          // 没有人叫分，重新发牌
          setGameLog(prev => [...prev, '无人叫分，重新发牌']);
          setTimeout(() => {
            initGame();
          }, 2000);
        }
      }
    }
  }, [bidder, bids, highestBid, landlord, gamePhase]);

  // 选择牌
  const toggleCardSelection = (index) => {
    if (gameState !== 'playing' || gamePhase !== 'playing' || currentPlayer !== 0) return;
    
    const newSelected = [...selectedCards];
    const selectedIndex = newSelected.indexOf(index);
    
    if (selectedIndex > -1) {
      newSelected.splice(selectedIndex, 1);
    } else {
      newSelected.push(index);
    }
    
    setSelectedCards(newSelected);
  };

  // 获取显示顺序的手牌（不修改实际逻辑数组）
  const getDisplayedHand = () => {
    return cardOrder === 'asc' ? playerHand : [...playerHand].slice().reverse();
  };

  const getRealIndex = (displayIndex) => {
    return cardOrder === 'asc' ? displayIndex : playerHand.length - 1 - displayIndex;
  };

  // 玩家确认收底牌
  const confirmBottomForPlayer = () => {
    if (pendingBottom.owner === 0 && pendingBottom.cards.length > 0) {
      setPlayerHand(prev => [...prev, ...pendingBottom.cards].sort(compareCardValues));
      setPendingBottom({ owner: -1, cards: [] });
      setBottomInserted(true);
      setGameLog(prev => [...prev, '您已确认收下底牌']);
    }
  };

  // 计算手牌重叠量（根据手牌数量自适应）
  const computeOverlap = (count) => {
    if (count <= 6) return -8;
    if (count <= 10) return -16;
    if (count <= 14) return -28;
    return -38;
  };

  // 加载并保存 cardOrder 到本地存储
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('cardOrder');
        if (saved === 'asc' || saved === 'desc') setCardOrder(saved);
      } catch (e) {
        console.warn('读取 cardOrder 失败', e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('cardOrder', cardOrder);
      } catch (e) {
        console.warn('保存 cardOrder 失败', e);
      }
    })();
  }, [cardOrder]);

  // 自动选择相同点数的牌
  const selectSameValueCards = (index) => {
    if (gameState !== 'playing' || gamePhase !== 'playing' || currentPlayer !== 0) return;
    
    const clickedCard = playerHand[index];
    const sameValueIndices = [];
    
    playerHand.forEach((card, idx) => {
      if (card.value === clickedCard.value && !selectedCards.includes(idx)) {
        sameValueIndices.push(idx);
      }
    });
    
    const newSelected = [...selectedCards, ...sameValueIndices];
    setSelectedCards(newSelected);
  };

  // 统一结算函数
  const finishGame = (winnerIndex) => {
    const isLandlordWin = landlord === winnerIndex;
    // 计算关住人数（未出牌的对手）
    const locked = [0,1,2].filter(i => i !== winnerIndex && !playedAny[i]).length;
    const multiplier = Math.pow(2, bombsCount + locked);
    const base = Math.max(1, highestBid);
    const score = base * multiplier;

    setGameState('gameOver');
    const result = isLandlordWin ? '地主获胜！' : '农民获胜！';
    setGameLog(prev => [...prev, `游戏结束：${result}（炸弹 ${bombsCount} 次，关住 ${locked} 人，倍数 x${multiplier}） 得分 ${score}`]);

    const winMessage = `${result}\n基础分: ${base}\n炸弹: ${bombsCount} 次\n关住: ${locked} 人\n倍数: x${multiplier}\n最终得分: ${score}`;
    Alert.alert('游戏结束', winMessage, [{ text: '再来一局', onPress: startNewGame }]);
  };

  // 出牌
  const playCards = () => {
    if (gameState !== 'playing' || gamePhase !== 'playing' || currentPlayer !== 0) return;
    
    if (selectedCards.length === 0) {
      Alert.alert('提示', '请选择要出的牌');
      return;
    }

    const playedCards = selectedCards.map(i => playerHand[i]);
    const cardType = getCardType(playedCards);
    
    if (!cardType.valid) {
      Alert.alert('提示', '无效的牌型');
      return;
    }
    // 如果不是在接牌（即上一个出牌者不是当前玩家），则需要压过上一手牌
    if (!(lastPlayer === currentPlayer || lastPlayedCards.length === 0)) {
      if (!canBeat(playedCards, lastPlayedCards)) {
        Alert.alert('提示', '您出的牌不能压过上一手牌');
        return;
      }
    }

    // 标记玩家已出牌
    setPlayedAny(prev => {
      const next = [...prev];
      next[0] = true;
      return next;
    });

    // 如果是炸弹或王炸，记录炸弹次数（每次翻倍）
    if (cardType.type === 'bomb' || cardType.type === 'king_bomb') {
      setBombsCount(prev => prev + 1);
    }

    const newPlayerHand = playerHand.filter((card, index) => !selectedCards.includes(index));
    setPlayerHand(newPlayerHand);
    setLastPlayedCards(playedCards);
    setLastPlayer(0);
    setConsecutivePasses(0);
    setSelectedCards([]);
    
    // 添加游戏日志
    const cardNames = playedCards.map(c => c.type === 'joker' ? c.realValue : c.value);
    setGameLog(prev => [...prev, `您出了: ${cardNames.join(', ')}`]);
    
    // 检查是否获胜
    if (newPlayerHand.length === 0) {
      finishGame(0);
      return;
    }
    
    // 轮到下一个玩家
    setCurrentPlayer((currentPlayer + 1) % 3);
  };

  // 不出（过牌）
  const passTurn = () => {
    if (gameState !== 'playing' || gamePhase !== 'playing' || currentPlayer !== 0) return;
    if (lastPlayer === -1 && lastPlayedCards.length === 0) {
      Alert.alert('提示', '地主先出牌，您不能过牌');
      return;
    }
    
    setGameLog(prev => [...prev, '您选择过牌']);
    setSelectedCards([]);
    setConsecutivePasses(prev => {
      const next = prev + 1;
      if (next >= 2) {
        setGameLog(g => [...g, `所有其他玩家均过牌，轮到 ${lastPlayer === 0 ? '您' : `电脑${lastPlayer}`} 任意出牌`]);
        setLastPlayedCards([]);
        setCurrentPlayer(lastPlayer);
        return 0;
      } else {
        setCurrentPlayer((currentPlayer + 1) % 3);
        return next;
      }
    });
  };

  // 提示功能
  const showHint = () => {
    if (gameState !== 'playing' || gamePhase !== 'playing' || currentPlayer !== 0) {
      Alert.alert('提示', '现在不是您的回合');
      return;
    }
    
    // 简单的提示逻辑：显示能压过上一手牌的最小牌
    let hintCards = null;
    
    if (lastPlayedCards.length === 0) {
      // 如果是第一手牌，提示出最小的牌
      const sortedHand = [...playerHand].sort(compareCardValues);
      hintCards = [sortedHand[0]];
    } else {
      // 尝试找到能压过上一手牌的最小牌
      const lastType = getCardType(lastPlayedCards);
      const sortedHand = [...playerHand].sort(compareCardValues);
      
      if (lastType.type === 'single') {
        for (let i = 0; i < sortedHand.length; i++) {
          const cardToTry = [sortedHand[i]];
          if (canBeat(cardToTry, lastPlayedCards)) {
            hintCards = cardToTry;
            break;
          }
        }
      }
    }
    
    if (hintCards) {
      const hintIndices = [];
      hintCards.forEach(hintCard => {
        for (let i = 0; i < playerHand.length; i++) {
          if (playerHand[i].id === hintCard.id && !hintIndices.includes(i)) {
            hintIndices.push(i);
            break;
          }
        }
      });
      
      setSelectedCards(hintIndices);
      Alert.alert('提示', '已为您选中可以出的牌');
    } else {
      Alert.alert('提示', '没有可以压过的牌');
    }
  };

  // 电脑玩家出牌
  useEffect(() => {
    if (gameState === 'playing' && gamePhase === 'playing' && currentPlayer !== 0) {
      const timer = setTimeout(() => {
        // 简单的电脑AI逻辑
        const computerIndex = currentPlayer;
        let computerHand;
        
        switch(computerIndex) {
          case 1:
            computerHand = computer1Hand;
            break;
          case 2:
            computerHand = computer2Hand;
            break;
          default:
            return;
        }
        
        // 如果是第一家、上家过牌，或上一次出牌者正好是自己（可主动再出），则尝试出牌
        if (lastPlayer === -1 || lastPlayer === computerIndex || (lastPlayer !== computerIndex && lastPlayedCards.length > 0)) {
          // 更智能的策略：根据上一手牌类型尝试匹配相同牌型，否则尝试最小单张或使用炸弹
          let bestPlay = null;
          const lastType = lastPlayedCards.length > 0 ? getCardType(lastPlayedCards).type : null;

          // 如果没有上一手，优先出最小单张
          if (!lastType) {
            if (computerHand.length > 0) {
              bestPlay = { cards: [computerHand[0]], indices: [0] };
            }
          } else {
            // 按照 lastType 尝试对应牌型
            if (lastType === 'single') {
              for (let i = 0; i < computerHand.length; i++) {
                const cardToTry = [computerHand[i]];
                if (canBeat(cardToTry, lastPlayedCards)) {
                  bestPlay = { cards: cardToTry, indices: [i] };
                  break;
                }
              }
            } else if (lastType === 'pair') {
              for (let i = 0; i < computerHand.length - 1; i++) {
                for (let j = i + 1; j < computerHand.length; j++) {
                  if (computerHand[i].value === computerHand[j].value) {
                    const pair = [computerHand[i], computerHand[j]];
                    if (canBeat(pair, lastPlayedCards)) {
                      bestPlay = { cards: pair, indices: [i, j] };
                      break;
                    }
                  }
                }
                if (bestPlay) break;
              }
            } else if (lastType === 'triple') {
              for (let i = 0; i < computerHand.length - 2; i++) {
                for (let j = i + 1; j < computerHand.length - 1; j++) {
                  for (let k = j + 1; k < computerHand.length; k++) {
                    if (computerHand[i].value === computerHand[j].value && computerHand[j].value === computerHand[k].value) {
                      const triple = [computerHand[i], computerHand[j], computerHand[k]];
                      if (canBeat(triple, lastPlayedCards)) {
                        bestPlay = { cards: triple, indices: [i, j, k] };
                        break;
                      }
                    }
                  }
                  if (bestPlay) break;
                }
                if (bestPlay) break;
              }
            }
          }

          // 如果仍未找到合适牌，尝试出炸弹（四张同点或王炸）以压制
          if (!bestPlay) {
            // 查找四张相同
            const valueCounts = {};
            computerHand.forEach((c, idx) => {
              valueCounts[c.value] = valueCounts[c.value] || [];
              valueCounts[c.value].push(idx);
            });
            for (const v in valueCounts) {
              if (valueCounts[v].length === 4) {
                const indices = valueCounts[v];
                const bombCards = indices.map(i => computerHand[i]);
                if (canBeat(bombCards, lastPlayedCards)) {
                  bestPlay = { cards: bombCards, indices };
                  break;
                }
              }
            }

            // 查找王炸
            if (!bestPlay) {
              const jokerIndices = computerHand.reduce((acc, c, idx) => {
                if (c.type === 'joker') acc.push(idx);
                return acc;
              }, []);
              if (jokerIndices.length === 2) {
                const kingBomb = jokerIndices.map(i => computerHand[i]);
                if (canBeat(kingBomb, lastPlayedCards)) {
                  bestPlay = { cards: kingBomb, indices: jokerIndices };
                }
              }
            }

            // 如果还是没有，而上家非过牌且必须接牌，则过牌
            if (!bestPlay && lastPlayer !== -1) {
              // 电脑过牌，检查是否所有其他玩家均过牌
              setConsecutivePasses(prev => {
                const next = prev + 1;
                if (next >= 2) {
                  setGameLog(g => [...g, `所有其他玩家均过牌，轮到 ${lastPlayer === 0 ? '您' : `电脑${lastPlayer}`} 任意出牌`]);
                  setLastPlayedCards([]);
                  setCurrentPlayer(lastPlayer);
                  return 0;
                } else {
                  setGameLog(g => [...g, `电脑${computerIndex}过牌`]);
                  setCurrentPlayer((currentPlayer + 1) % 3);
                  return next;
                }
              });
              return;
            }
          }
          
          // 如果找到合适的牌，则出牌
            if (bestPlay) {
            const newComputerHand = computerHand.filter((_, i) => !bestPlay.indices.includes(i));
            
            switch(computerIndex) {
              case 1:
                setComputer1Hand(newComputerHand);
                break;
              case 2:
                setComputer2Hand(newComputerHand);
                break;
            }
            
            setLastPlayedCards(bestPlay.cards);
            setLastPlayer(computerIndex);
            setConsecutivePasses(0);

            // 标记该电脑已出牌
            setPlayedAny(prev => {
              const next = [...prev];
              next[computerIndex] = true;
              return next;
            });

            // 如果电脑出了炸弹，记录
            const playedType = getCardType(bestPlay.cards);
            if (playedType.type === 'bomb' || playedType.type === 'king_bomb') {
              setBombsCount(prev => prev + 1);
            }

            const cardNames = bestPlay.cards.map(c => c.type === 'joker' ? c.realValue : c.value);
            setGameLog(prev => [...prev, `电脑${computerIndex}出了: ${cardNames.join(', ')}`]);
            
            // 检查电脑是否获胜
            if (newComputerHand.length === 0) {
              // 标记该电脑已出牌
              setPlayedAny(prev => {
                const next = [...prev];
                next[computerIndex] = true;
                return next;
              });

              // 如果电脑出了炸弹，记录
              const lastType = getCardType(bestPlay.cards);
              if (lastType.type === 'bomb' || lastType.type === 'king_bomb') {
                setBombsCount(prev => prev + 1);
              }

              finishGame(computerIndex);
              return;
            }
          }
          } else {
          // 电脑过牌（未进入上面分支），也计入连续过牌
          setConsecutivePasses(prev => {
            const next = prev + 1;
            if (next >= 2) {
              setGameLog(g => [...g, `所有其他玩家均过牌，轮到 ${lastPlayer === 0 ? '您' : `电脑${lastPlayer}`} 任意出牌`]);
              setLastPlayedCards([]);
              setCurrentPlayer(lastPlayer);
              return 0;
            } else {
              setGameLog(g => [...g, `电脑${computerIndex}过牌`]);
              return next;
            }
          });
          return; // 已处理轮转，避免外部重复设置 next player
        }
        
        // 轮到下一个玩家
        setCurrentPlayer((currentPlayer + 1) % 3);
      }, 2000); // 2秒后电脑出牌

      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameState, gamePhase, computer1Hand, computer2Hand, lastPlayedCards, lastPlayer]);

  // 游戏主菜单
  if (gameState === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.menuContainer}>
          <Text style={styles.title}>老人斗地主</Text>
          <Text style={styles.subtitle}>纯净版 • 无广告 • 无内购</Text>
          
          <TouchableOpacity style={styles.startButton} onPress={startNewGame}>
            <Text style={styles.startButtonText}>开始游戏</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingsButton} onPress={() => setShowHowToPlay(true)}>
            <Text style={styles.settingsButtonText}>游戏玩法</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsButton} onPress={() => setShowGameModeSelection(true)}>
            <Text style={styles.settingsButtonText}>选择游戏模式</Text>
          </TouchableOpacity>

          <Text style={styles.description}>
            经典斗地主游戏，专为老人设计\n界面简洁，操作方便
          </Text>
        </View>

        {/* 游戏玩法说明界面 */}
        <Modal
          visible={showHowToPlay}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>游戏玩法</Text>
              <ScrollView style={styles.rulesContainer}>
                <Text style={styles.ruleText}>• 游戏人数：3人（您和2个电脑玩家）</Text>
                <Text style={styles.ruleText}>• 牌数：每人17张，底牌3张</Text>
                <Text style={styles.ruleText}>• 叫地主：依次叫1分、2分、3分或不叫</Text>
                <Text style={styles.ruleText}>• 地主：叫分最高的玩家获得底牌，先出牌</Text>
                <Text style={styles.ruleText}>• 农民：另外两个玩家合作对抗地主</Text>
                <Text style={styles.ruleText}>• 胜负：地主先出完牌则地主获胜，否则农民获胜</Text>
                <Text style={styles.ruleText}>• 牌型大小：单张、对子、三张、顺子、连对、三带一、三带二、四带二、炸弹、王炸</Text>
                <Text style={styles.ruleText}>• 王炸最大，然后是普通炸弹</Text>
                <Text style={styles.ruleText}>• 所有功能离线可用，无任何广告</Text>
                <Text style={styles.ruleText}>• 点击牌可选中，再次点击取消</Text>
                <Text style={styles.ruleText}>• 长按相同点数的牌可快速选中</Text>
                <Text style={styles.ruleText}>• 点击"提示"按钮可获得出牌建议</Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowHowToPlay(false)}
              >
                <Text style={styles.closeButtonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 游戏模式选择界面 */}
        <Modal
          visible={showGameModeSelection}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>选择游戏模式</Text>
              <ScrollView style={styles.rulesContainer}>
                <TouchableOpacity
                  style={[styles.gameModeButton, gameMode === 'standard' && styles.selectedGameModeButton]}
                  onPress={() => {
                    setGameMode('standard');
                    setShowGameModeSelection(false);
                  }}
                >
                  <Text style={styles.gameModeButtonText}>标准模式</Text>
                  <Text style={styles.gameModeDescription}>经典叫地主模式，叫1-3分决定地主</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.gameModeButton, gameMode === 'classic' && styles.selectedGameModeButton]}
                  onPress={() => {
                    setGameMode('classic');
                    setShowGameModeSelection(false);
                  }}
                >
                  <Text style={styles.gameModeButtonText}>经典模式</Text>
                  <Text style={styles.gameModeDescription}>不叫地主，随机分配地主</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.gameModeButton, gameMode === 'fast' && styles.selectedGameModeButton]}
                  onPress={() => {
                    setGameMode('fast');
                    setShowGameModeSelection(false);
                  }}
                >
                  <Text style={styles.gameModeButtonText}>快速模式</Text>
                  <Text style={styles.gameModeDescription}>简化流程，自动叫分</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.gameModeButton, gameMode === 'threeKing' && styles.selectedGameModeButton]}
                  onPress={() => {
                    setGameMode('threeKing');
                    setShowGameModeSelection(false);
                  }}
                >
                  <Text style={styles.gameModeButtonText}>三王模式</Text>
                  <Text style={styles.gameModeDescription}>三人游戏，无叫地主环节</Text>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowGameModeSelection(false)}
              >
                <Text style={styles.closeButtonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // 叫地主阶段界面
  if (gameState === 'playing' && gamePhase === 'bidding') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
        <View style={styles.infoBar}>
          <Text style={styles.infoText}>叫地主阶段</Text>
          <Text style={styles.infoText}>当前最高分: {highestBid}</Text>
        </View>
        
        <View style={styles.playersRow}>
          <View style={styles.topPlayerSmall}>
            <Text style={styles.playerName}>电脑玩家 1</Text>
            <Text style={styles.cardCount}>叫分: {bids[1] === 0 ? '不叫' : bids[1] + '分'}</Text>
          </View>
          <View style={styles.topPlayerSmall}>
            <Text style={styles.playerName}>电脑玩家 2</Text>
            <Text style={styles.cardCount}>叫分: {bids[2] === 0 ? '不叫' : bids[2] + '分'}</Text>
          </View>
        </View>
        
        <View style={styles.centerArea}>
          <Text style={styles.biddingText}>当前叫分者: {bidder === 0 ? '您' : `电脑${bidder}`}</Text>
          <Text style={styles.biddingText}>最高分: {highestBid}分</Text>
          <Text style={styles.biddingText}>地主: {landlord === -1 ? '未确定' : (landlord === 0 ? '您' : `电脑${landlord}`)}</Text>
        </View>
        
        
        <View style={styles.bottomPlayer}>
          <Text style={styles.playerName}>您的牌 (17张)</Text>
          {/* 顺序切换按钮 */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
            <TouchableOpacity onPress={() => setCardOrder(prev => prev === 'asc' ? 'desc' : 'asc')} style={{ padding: 6 }}>
              <Text style={{ color: '#fff' }}>顺序: {cardOrder === 'asc' ? '小→大' : '大→小'}</Text>
            </TouchableOpacity>
          </View>

          {pendingBottom.owner === 0 && pendingBottom.cards.length > 0 && !bottomInserted && (
            <View style={styles.pendingBottomRow}>
              {pendingBottom.cards.map((card, idx) => (
                <View key={idx} style={[styles.card, styles.pendingCard, { marginLeft: idx === 0 ? 0 : -46 }]}>
                  <View style={styles.cardCorner}>
                    {card.type === 'joker' ? (
                      <Text style={[styles.jokerText, card.realValue && card.realValue.indexOf('大') !== -1 ? styles.jokerRed : styles.jokerBlack]}>J{"\n"}O{"\n"}K{"\n"}E{"\n"}R</Text>
                    ) : (
                      <>
                        <Text style={styles.cardValueSmall}>{card.value}</Text>
                        <Text style={styles.cardSuitSmall}>{card.suit}</Text>
                      </>
                    )}
                  </View>
                  {/* 中间花色已移除，花色改为角落小字显示 */}
                </View>
              ))}
              <TouchableOpacity style={styles.confirmButton} onPress={confirmBottomForPlayer}>
                <Text style={styles.confirmButtonText}>确认收牌</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            horizontal
            contentContainerStyle={styles.handScroll}
            showsHorizontalScrollIndicator={false}
          >
            {(() => {
              const displayed = getDisplayedHand();
              const baseOverlap = computeOverlap(displayed.length);
              return displayed.map((card, displayIndex) => {
                const realIndex = getRealIndex(displayIndex);
                const prevCard = displayIndex > 0 ? displayed[displayIndex - 1] : null;
                let marginLeft = displayIndex === 0 ? 0 : baseOverlap;
                if (prevCard && prevCard.value === card.value) {
                  marginLeft = Math.floor(baseOverlap * 1.3); // 相同点数靠得更紧一些（更重叠）
                }
                return (
                  <View
                    key={displayIndex}
                    style={[
                      styles.card,
                      { marginLeft: displayIndex === 0 ? 0 : marginLeft, zIndex: displayIndex }
                    ]}
                  >
                    <View style={styles.cardCorner}>
                      {card.type === 'joker' ? (
                        <Text style={[styles.jokerText, card.realValue && card.realValue.indexOf('大') !== -1 ? styles.jokerRed : styles.jokerBlack]}>J{"\n"}O{"\n"}K{"\n"}E{"\n"}R</Text>
                      ) : (
                        <>
                          <Text style={styles.cardValueSmall}>{card.value}</Text>
                          <Text style={styles.cardSuitSmall}>{card.suit}</Text>
                        </>
                      )}
                    </View>
                    {/* 中间花色移除：只在角落显示小花色 */}
                  </View>
                );
              });
            })()}
          </ScrollView>
        </View>
        
        {/* 叫地主按钮 */}
        {bidder === 0 && (
          <View style={styles.biddingButtonContainer}>
            <TouchableOpacity style={styles.bidButton} onPress={() => bidLandlord(1)}>
              <Text style={styles.buttonText}>1分</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bidButton} onPress={() => bidLandlord(2)}>
              <Text style={styles.buttonText}>2分</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bidButton} onPress={() => bidLandlord(3)}>
              <Text style={styles.buttonText}>3分</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.passButton} onPress={passBid}>
              <Text style={styles.buttonText}>不叫</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* 游戏记录按钮 */}
        <TouchableOpacity 
          style={styles.logButton} 
          onPress={() => setShowGameLog(true)}
        >
          <Text style={styles.logButtonText}>游戏记录</Text>
        </TouchableOpacity>
        
        {/* 游戏记录界面 */}
        <Modal
          visible={showGameLog}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalContainer}>
            <View style={styles.logModalContent}>
              <Text style={styles.modalTitle}>游戏记录</Text>
              <ScrollView style={styles.logScrollView}>
                {gameLog.map((log, index) => (
                  <Text key={index} style={styles.logText}>{log}</Text>
                ))}
              </ScrollView>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setShowGameLog(false)}
              >
                <Text style={styles.closeButtonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // 游戏结束界面
  if (gameState === 'gameOver') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>游戏结束</Text>
          <Text style={styles.gameOverText}>游戏已结束</Text>
          <TouchableOpacity style={styles.startButton} onPress={startNewGame}>
            <Text style={styles.startButtonText}>再来一局</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 游戏进行中界面
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 顶部信息栏 */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>当前玩家: {currentPlayer === 0 ? '您' : `电脑${currentPlayer}`}</Text>
        <Text style={styles.infoText}>地主: {landlord === 0 ? '您' : `电脑${landlord}`}</Text>
      </View>
      
      {/* 顶部两个电脑玩家一行显示 */}
      <View style={styles.playersRow}>
        <View style={styles.topPlayerSmall}>
          <Text style={styles.playerName}>电脑玩家 1</Text>
          <Text style={styles.cardCount}>{computer1Hand.length} 张牌</Text>
        </View>
        <View style={styles.topPlayerSmall}>
          <Text style={styles.playerName}>电脑玩家 2</Text>
          <Text style={styles.cardCount}>{computer2Hand.length} 张牌</Text>
        </View>
      </View>
      
      {/* 中间区域显示上一手牌 */}
      <View style={styles.centerArea}>
        {lastPlayedCards.length > 0 ? (
          <View style={styles.lastPlayArea}>
            <Text style={styles.lastPlayText}>上一手牌:</Text>
            <View style={styles.lastPlayCards}>
              {lastPlayedCards.map((card, index) => (
                <View key={index} style={styles.cardPlaceholder}>
                  {card.type === 'joker' ? (
                    <Text style={[styles.jokerTextSmall, card.realValue && card.realValue.indexOf('大') !== -1 ? styles.jokerRed : styles.jokerBlack]}>J{"\n"}O{"\n"}K{"\n"}E{"\n"}R</Text>
                  ) : (
                    <>
                      <Text style={styles.cardSuitSmall}>{card.suit}</Text>
                      <Text style={styles.cardText}>{card.value}</Text>
                    </>
                  )}
                </View>
              ))}
            </View>
            <Text style={styles.lastPlayerText}>来自: {lastPlayer === 0 ? '您' : `电脑${lastPlayer}`}</Text>
          </View>
        ) : (
          <Text style={styles.waitingText}>等待出牌...</Text>
        )}
      </View>
      
      
      {/* 玩家手牌区域 */}
      <View style={styles.bottomPlayer}>
        <Text style={styles.playerName}>您的牌 ({playerHand.length})</Text>
        {/* 顺序切换按钮 */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
          <TouchableOpacity onPress={() => setCardOrder(prev => prev === 'asc' ? 'desc' : 'asc')} style={{ padding: 6 }}>
            <Text style={{ color: '#fff' }}>顺序: {cardOrder === 'asc' ? '小→大' : '大→小'}</Text>
          </TouchableOpacity>
        </View>

        {pendingBottom.owner === 0 && pendingBottom.cards.length > 0 && !bottomInserted && (
          <View style={styles.pendingBottomRow}>
            {(() => {
              const cards = pendingBottom.cards || [];
              const baseOverlapP = computeOverlap(cards.length);
              return cards.map((card, idx) => {
                const prev = idx > 0 ? cards[idx - 1] : null;
                let marginLeftP = idx === 0 ? 0 : baseOverlapP;
                if (prev && prev.value === card.value) marginLeftP = Math.floor(baseOverlapP * 1.3);
                return (
                  <View key={idx} style={[styles.card, styles.pendingCard, { marginLeft: idx === 0 ? 0 : marginLeftP }]}>
                    <View style={styles.cardCorner}>
                      {card.type === 'joker' ? (
                        <Text style={[styles.jokerText, card.realValue && card.realValue.indexOf('大') !== -1 ? styles.jokerRed : styles.jokerBlack]}>J{"\n"}O{"\n"}K{"\n"}E{"\n"}R</Text>
                      ) : (
                        <>
                          <Text style={styles.cardValueSmall}>{card.value}</Text>
                          <Text style={styles.cardSuitSmall}>{card.suit}</Text>
                        </>
                      )}
                    </View>
                    {/* 中间花色已移除，花色改为角落小字显示 */}
                  </View>
                );
              });
            })()}
            <TouchableOpacity style={styles.confirmButton} onPress={confirmBottomForPlayer}>
              <Text style={styles.confirmButtonText}>确认收牌</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          horizontal
          contentContainerStyle={styles.handScroll}
          showsHorizontalScrollIndicator={false}
        >
          {(() => {
            const displayed = getDisplayedHand();
            const baseOverlap = computeOverlap(displayed.length);
            return displayed.map((card, displayIndex) => {
              const realIndex = getRealIndex(displayIndex);
              const prevCard = displayIndex > 0 ? displayed[displayIndex - 1] : null;
              let marginLeft = displayIndex === 0 ? 0 : baseOverlap;
              if (prevCard && prevCard.value === card.value) marginLeft = Math.floor(baseOverlap * 1.3);
              return (
                <TouchableOpacity 
                  key={displayIndex} 
                  style={[
                    styles.card,
                    selectedCards.includes(realIndex) && styles.selectedCard,
                    { marginLeft: displayIndex === 0 ? 0 : marginLeft, zIndex: displayIndex }
                  ]}
                  onPress={() => toggleCardSelection(realIndex)}
                  onLongPress={() => selectSameValueCards(realIndex)}
                >
                  <View style={styles.cardCorner}>
                    {card.type === 'joker' ? (
                      <Text style={[styles.jokerText, card.realValue && card.realValue.indexOf('大') !== -1 ? styles.jokerRed : styles.jokerBlack]}>J{"\n"}O{"\n"}K{"\n"}E{"\n"}R</Text>
                    ) : (
                      <>
                        <Text style={styles.cardValueSmall}>{card.value}</Text>
                        <Text style={styles.cardSuitSmall}>{card.suit}</Text>
                      </>
                    )}
                  </View>
                  {/* 中间花色移除：只在角落显示小花色 */}
                </TouchableOpacity>
              );
            });
          })()}
        </ScrollView>
      </View>
      
      {/* 操作按钮 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.hintButton} onPress={showHint}>
          <Text style={[styles.buttonText, styles.largeButtonText]}>提示</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.passButton} onPress={passTurn}>
          <Text style={[styles.buttonText, styles.largeButtonText]}>过牌</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.playButton} onPress={playCards}>
          <Text style={[styles.buttonText, styles.largeButtonText]}>出牌</Text>
        </TouchableOpacity>
      </View>
      
      {/* 游戏记录按钮 */}
      <TouchableOpacity 
        style={styles.logButton} 
        onPress={() => setShowGameLog(true)}
      >
        <Text style={styles.logButtonText}>游戏记录</Text>
      </TouchableOpacity>
      
      {/* 游戏记录界面 */}
      <Modal
        visible={showGameLog}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.logModalContent}>
            <Text style={styles.modalTitle}>游戏记录</Text>
            <ScrollView style={styles.logScrollView}>
              {gameLog.map((log, index) => (
                <Text key={index} style={styles.logText}>{log}</Text>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShowGameLog(false)}
            >
              <Text style={styles.closeButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a6e20',
    padding: 10,
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: '#ccc',
    marginBottom: 30,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 30,
    marginBottom: 20,
    minWidth: 220,
    alignItems: 'center',
  },
  settingsButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 30,
    marginBottom: 30,
    minWidth: 220,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  settingsButtonText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  description: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 26,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  topPlayer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    margin: 8,
    borderRadius: 15,
    alignItems: 'center',
  },
  topPlayerSmall: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    margin: 6,
    borderRadius: 12,
    alignItems: 'center',
    width: '48%',
  },
  playersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 8,
    alignItems: 'center',
  },
  playerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardCount: {
    fontSize: 18,
    color: '#fff',
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  lastPlayArea: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
  },
  lastPlayText: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 10,
  },
  lastPlayCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardPlaceholder: {
    width: 60,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  cardText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  jokerTextSmall: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 18,
  },
  lastPlayerText: {
    fontSize: 18,
    color: '#ffcc00',
    fontWeight: 'bold',
  },
  waitingText: {
    fontSize: 24,
    color: '#fff',
  },
  biddingText: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  bottomPlayer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    margin: 8,
    borderRadius: 15,
  },
  handContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  card: {
    width: 56,
    height: 84,
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  selectedCard: {
    backgroundColor: '#ffcc00',
    transform: [{ translateY: -20 }],
  },
  cardCorner: {
    position: 'absolute',
    top: 4,
    left: 2,
    alignItems: 'flex-start',
  },
  cardSuitSmall: {
    fontSize: 12,
    lineHeight: 14,
    marginTop: 2,
  },
  cardValueSmall: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  jokerText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 18,
  },
  jokerRed: {
    color: 'red',
  },
  jokerBlack: {
    color: '#000',
  },
  cardSuitCenter: {
    fontSize: 22,
  },
  handScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pendingBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  pendingCard: {
    transform: [{ translateY: -18 }],
    opacity: 1,
  },
  confirmButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    zIndex: 1000,
    elevation: 10,
    position: 'relative',
  },
  biddingButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    padding: 15,
  },
  hintButton: {
    backgroundColor: '#9c27b0',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 80,
    alignItems: 'center',
  },
  bidButton: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 60,
    alignItems: 'center',
    margin: 5,
  },
  passButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 80,
    alignItems: 'center',
    zIndex: 1010,
    elevation: 12,
  },
  playButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  largeButtonText: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  gameOverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  gameOverText: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 30,
  },
  logButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 18,
  },
  logButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    width: '85%',
    maxHeight: '80%',
    alignItems: 'center',
  },
  logModalContent: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    width: '85%',
    height: '60%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  rulesContainer: {
    width: '100%',
  },
  ruleText: {
    fontSize: 18,
    marginBottom: 12,
    color: '#333',
    lineHeight: 26,
  },
  logScrollView: {
    width: '100%',
    flex: 1,
    marginBottom: 15,
  },
  logText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 22,
    minWidth: 120,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameModeButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  selectedGameModeButton: {
    backgroundColor: '#4a90e2',
    borderColor: '#4a90e2',
  },
  gameModeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  gameModeDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
});