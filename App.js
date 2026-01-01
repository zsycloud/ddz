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
  ScrollView,
  Platform,
  BackHandler,
  Dimensions
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
  if (sortedCards.length === 1) return { type: 'single', valid: true, value: cardRank(sortedCards[0]) };

  // 对子
  if (sortedCards.length === 2 && sortedCards[0].value === sortedCards[1].value) return { type: 'pair', valid: true, value: cardRank(sortedCards[0]) };

  // 三张
  if (sortedCards.length === 3 && sortedCards[0].value === sortedCards[1].value && sortedCards[1].value === sortedCards[2].value) return { type: 'triple', valid: true, value: cardRank(sortedCards[0]) };

  // 三带一
  if (sortedCards.length === 4) {
    const valueCounts = {};
    sortedCards.forEach(card => {
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    });

    const counts = Object.values(valueCounts);
    if (counts.includes(3) && counts.includes(1)) {
      const tripleValue = Object.keys(valueCounts).find(v => valueCounts[v] === 3);
      return { type: 'triple_with_single', valid: true, value: valuesOrder.indexOf(tripleValue) };
    }
  }

  // 三带二
  if (sortedCards.length === 5) {
    const valueCounts = {};
    sortedCards.forEach(card => {
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    });

    const counts = Object.values(valueCounts);
    if (counts.includes(3) && counts.includes(2)) {
      const tripleValue = Object.keys(valueCounts).find(v => valueCounts[v] === 3);
      return { type: 'triple_with_pair', valid: true, value: valuesOrder.indexOf(tripleValue) };
    }
  }
  
  // 王炸
  if (sortedCards.length === 2 &&
      ((sortedCards[0].id === 'small_joker' && sortedCards[1].id === 'big_joker') ||
       (sortedCards[0].id === 'big_joker' && sortedCards[1].id === 'small_joker'))) {
    return { type: 'king_bomb', valid: true, value: 999 }; // 王炸最大值
  }

  // 普通炸弹
  if (sortedCards.length === 4 && sortedCards[0].value === sortedCards[1].value &&
      sortedCards[1].value === sortedCards[2].value && sortedCards[2].value === sortedCards[3].value) {
    return { type: 'bomb', valid: true, value: cardRank(sortedCards[0]) };
  }

  // 顺子（至少5张）
  if (sortedCards.length >= 5) {
    const uniqueValues = [...new Set(sortedCards.map(c => c.value))];
    if (uniqueValues.length !== sortedCards.length) return { type: 'invalid', valid: false }; // 不能有重复值
    
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
  if (sortedCards.length >= 6 && sortedCards.length % 2 === 0) {
    const valueCounts = {};
    sortedCards.forEach(card => {
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    });

    const counts = Object.values(valueCounts);
    if (counts.every(count => count === 2)) { // 所有牌都成对
      const uniqueValues = Object.keys(valueCounts);
      const sortedValues = uniqueValues.sort((a, b) => {
        return valuesOrder.indexOf(a) - valuesOrder.indexOf(b);
      });

      // 检查是否连续
      let isChain = true;
      for (let i = 1; i < sortedValues.length; i++) {
        const currentIndex = valuesOrder.indexOf(sortedValues[i]);
        const prevIndex = valuesOrder.indexOf(sortedValues[i-1]);

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

  // 飞机（至少两个连续的三张）以及飞机带翅膀（飞机带单牌/对子）检测
  if (sortedCards.length >= 6) {
    const valueCounts = {};
    sortedCards.forEach(card => {
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    });

    // 连三（飞机）检测：至少两个连续的三张
    // 支持：
    // - 纯飞机（3*k 张）
    // - 飞机带单（3*k + k 张，带 k 张单牌）
    // - 飞机带对（3*k + 2*k 张，带 k 对牌）
    // 规则：找到所有点数出现 >=3 的值（排除2与Joker），检查是否存在长度 >=2 的连续段
    {
      const tripleValues = Object.keys(valueCounts).filter(v => valueCounts[v] >= 3 && v !== '2' && v !== 'Joker');
      if (tripleValues.length >= 2) {
        const sortedTripleValues = tripleValues.sort((a, b) => valuesOrder.indexOf(a) - valuesOrder.indexOf(b));
        // find consecutive runs
        let run = [sortedTripleValues[0]];
        const runs = [];
        for (let i = 1; i < sortedTripleValues.length; i++) {
          const prevIdx = valuesOrder.indexOf(sortedTripleValues[i-1]);
          const curIdx = valuesOrder.indexOf(sortedTripleValues[i]);
          if (curIdx === prevIdx + 1) {
            run.push(sortedTripleValues[i]);
          } else {
            if (run.length >= 2) runs.push([...run]);
            run = [sortedTripleValues[i]];
          }
        }
        if (run.length >= 2) runs.push([...run]);

        if (runs.length > 0) {
          // try each run (长的优先)
          runs.sort((a, b) => b.length - a.length);
          for (const r of runs) {
            const k = r.length; // number of triples in this plane
            const triplesCardCount = 3 * k;
            // collect cards that are part of triples (取每个三张)
            const tripleCards = [];
            const remaining = [];
            const usedCounts = {};
            sortedCards.forEach(c => {
              if (r.includes(c.value) && (usedCounts[c.value] || 0) < 3) {
                tripleCards.push(c);
                usedCounts[c.value] = (usedCounts[c.value] || 0) + 1;
              } else {
                remaining.push(c);
              }
            });

            // 纯飞机
            if (sortedCards.length === triplesCardCount) {
              const highest = r[r.length - 1];
              return { type: 'plane', valid: true, count: k, value: valuesOrder.indexOf(highest) };
            }

            // 飞机带单：剩余 k 张单牌
            if (sortedCards.length === triplesCardCount + k) {
              let ok = true;
              remaining.forEach(c => { if (r.includes(c.value)) ok = false; });
              if (ok && remaining.length === k) {
                const highest = r[r.length - 1];
                return { type: 'plane_with_single', valid: true, count: k, value: valuesOrder.indexOf(highest) };
              }
            }

            // 飞机带对：剩余为 k 对（共 2*k 张）
            if (sortedCards.length === triplesCardCount + 2 * k) {
              const remCounts = {};
              let ok = true;
              remaining.forEach(c => { remCounts[c.value] = (remCounts[c.value] || 0) + 1; if (r.includes(c.value)) ok = false; });
              if (ok) {
                const pairs = Object.values(remCounts).every(v => v === 2);
                const pairsCount = Object.values(remCounts).length;
                if (pairs && pairsCount === k) {
                  const highest = r[r.length - 1];
                  return { type: 'plane_with_pair', valid: true, count: k, value: valuesOrder.indexOf(highest) };
                }
              }
            }
          }
        }
      }
    }
  }

  // 四带二
  if (sortedCards.length === 6) {
    const valueCounts = {};
    sortedCards.forEach(card => {
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

// 生成所有可能的出牌选项
const generatePossiblePlays = (hand, lastPlayedCards) => {
  const possiblePlays = [];

  if (lastPlayedCards.length === 0) {
    // 自由出牌：生成所有可能的牌型
    // 单张
    for (let i = 0; i < hand.length; i++) {
      possiblePlays.push([i]);
    }

    // 对子
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        if (hand[i].value === hand[j].value && hand[i].type !== 'joker') {
          possiblePlays.push([i, j]);
        }
      }
    }

    // 三张
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          if (hand[i].value === hand[j].value && hand[j].value === hand[k].value) {
            possiblePlays.push([i, j, k]);
          }
        }
      }
    }

    // 三带一
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          if (hand[i].value === hand[j].value && hand[j].value === hand[k].value) {
            // 找到一个三张，然后找一个单张
            for (let l = 0; l < hand.length; l++) {
              if (l !== i && l !== j && l !== k) {
                possiblePlays.push([i, j, k, l]);
              }
            }
          }
        }
      }
    }

    // 三带二
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          if (hand[i].value === hand[j].value && hand[j].value === hand[k].value) {
            // 找到一个三张，然后找一个对子
            for (let l = 0; l < hand.length; l++) {
              for (let m = l + 1; m < hand.length; m++) {
                if (l !== i && l !== j && l !== k &&
                    m !== i && m !== j && m !== k &&
                    hand[l].value === hand[m].value && hand[l].type !== 'joker') {
                  possiblePlays.push([i, j, k, l, m]);
                }
              }
            }
          }
        }
      }
    }

    // 王炸
    let smallJokerIndex = -1;
    let bigJokerIndex = -1;
    for (let i = 0; i < hand.length; i++) {
      if (hand[i].id === 'small_joker') smallJokerIndex = i;
      if (hand[i].id === 'big_joker') bigJokerIndex = i;
    }
    if (smallJokerIndex !== -1 && bigJokerIndex !== -1) {
      possiblePlays.push([smallJokerIndex, bigJokerIndex]);
    }

    // 普通炸弹
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          for (let l = k + 1; l < hand.length; l++) {
            if (hand[i].value === hand[j].value &&
                hand[j].value === hand[k].value &&
                hand[k].value === hand[l].value) {
              possiblePlays.push([i, j, k, l]);
            }
          }
        }
      }
    }

    // 顺子
    for (let length = 5; length <= hand.length; length++) {
      for (let start = 0; start <= hand.length - length; start++) {
        // 尝试所有可能的组合
        const combinations = getCombinations(hand, length, start);
        for (const combo of combinations) {
          const cards = combo.map(i => hand[i]);
          if (getCardType(cards).type === 'straight') {
            possiblePlays.push(combo);
          }
        }
      }
    }

    // 连对
    for (let length = 6; length <= hand.length && length % 2 === 0; length += 2) {
      for (let start = 0; start <= hand.length - length; start++) {
        const combinations = getCombinations(hand, length, start);
        for (const combo of combinations) {
          const cards = combo.map(i => hand[i]);
          if (getCardType(cards).type === 'chain_pairs') {
            possiblePlays.push(combo);
          }
        }
      }
    }

    // 飞机
    for (let length = 6; length <= hand.length; length += 3) {
      for (let start = 0; start <= hand.length - length; start++) {
        const combinations = getCombinations(hand, length, start);
        for (const combo of combinations) {
          const cards = combo.map(i => hand[i]);
          const cardType = getCardType(cards);
          if (cardType.type === 'plane' || cardType.type === 'plane_with_single' || cardType.type === 'plane_with_pair') {
            possiblePlays.push(combo);
          }
        }
      }
    }

    // 四带二
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          for (let l = k + 1; l < hand.length; l++) {
            if (hand[i].value === hand[j].value &&
                hand[j].value === hand[k].value &&
                hand[k].value === hand[l].value) {
              // 找到一个四张，然后找两个单张或一个对子
              // 找两个单张
              for (let m = 0; m < hand.length; m++) {
                for (let n = m + 1; n < hand.length; n++) {
                  if (m !== i && m !== j && m !== k && m !== l &&
                      n !== i && n !== j && n !== k && n !== l) {
                    possiblePlays.push([i, j, k, l, m, n]);
                  }
                }
              }
              // 找一个对子
              for (let m = 0; m < hand.length; m++) {
                for (let n = m + 1; n < hand.length; n++) {
                  if (m !== i && m !== j && m !== k && m !== l &&
                      n !== i && n !== j && n !== k && n !== l &&
                      hand[m].value === hand[n].value && hand[m].type !== 'joker') {
                    possiblePlays.push([i, j, k, l, m, n]);
                  }
                }
              }
            }
          }
        }
      }
    }
  } else {
    // 接牌：生成能压过上一手牌的牌型
    const lastType = getCardType(lastPlayedCards);

    if (lastType.type === 'single') {
      // 单张：找更大的单张
      for (let i = 0; i < hand.length; i++) {
        const cardToTry = [hand[i]];
        if (canBeat(cardToTry, lastPlayedCards)) {
          possiblePlays.push([i]);
        }
      }
    } else if (lastType.type === 'pair') {
      // 对子：找更大的对子
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          if (hand[i].value === hand[j].value && hand[i].type !== 'joker') {
            const pair = [hand[i], hand[j]];
            if (canBeat(pair, lastPlayedCards)) {
              possiblePlays.push([i, j]);
            }
          }
        }
      }
    } else if (lastType.type === 'triple') {
      // 三张：找更大的三张
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          for (let k = j + 1; k < hand.length; k++) {
            if (hand[i].value === hand[j].value && hand[j].value === hand[k].value) {
              const triple = [hand[i], hand[j], hand[k]];
              if (canBeat(triple, lastPlayedCards)) {
                possiblePlays.push([i, j, k]);
              }
            }
          }
        }
      }
    } else if (lastType.type === 'triple_with_single') {
      // 三带一：找更大的三带一
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          for (let k = j + 1; k < hand.length; k++) {
            if (hand[i].value === hand[j].value && hand[j].value === hand[k].value) {
              for (let l = 0; l < hand.length; l++) {
                if (l !== i && l !== j && l !== k) {
                  const tripleWithSingle = [hand[i], hand[j], hand[k], hand[l]];
                  if (canBeat(tripleWithSingle, lastPlayedCards)) {
                    possiblePlays.push([i, j, k, l]);
                  }
                }
              }
            }
          }
        }
      }
    } else if (lastType.type === 'triple_with_pair') {
      // 三带二：找更大的三带二
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          for (let k = j + 1; k < hand.length; k++) {
            if (hand[i].value === hand[j].value && hand[j].value === hand[k].value) {
              for (let l = 0; l < hand.length; l++) {
                for (let m = l + 1; m < hand.length; m++) {
                  if (l !== i && l !== j && l !== k &&
                      m !== i && m !== j && m !== k &&
                      hand[l].value === hand[m].value && hand[l].type !== 'joker') {
                    const tripleWithPair = [hand[i], hand[j], hand[k], hand[l], hand[m]];
                    if (canBeat(tripleWithPair, lastPlayedCards)) {
                      possiblePlays.push([i, j, k, l, m]);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else if (lastType.type === 'straight') {
      // 顺子：找同长度的更大顺子
      for (let start = 0; start <= hand.length - lastPlayedCards.length; start++) {
        const combinations = getCombinations(hand, lastPlayedCards.length, start);
        for (const combo of combinations) {
          const cards = combo.map(i => hand[i]);
          if (getCardType(cards).type === 'straight' && canBeat(cards, lastPlayedCards)) {
            possiblePlays.push(combo);
          }
        }
      }
    } else if (lastType.type === 'chain_pairs') {
      // 连对：找同长度的更大连对
      for (let start = 0; start <= hand.length - lastPlayedCards.length; start++) {
        const combinations = getCombinations(hand, lastPlayedCards.length, start);
        for (const combo of combinations) {
          const cards = combo.map(i => hand[i]);
          if (getCardType(cards).type === 'chain_pairs' && canBeat(cards, lastPlayedCards)) {
            possiblePlays.push(combo);
          }
        }
      }
    } else if (lastType.type === 'plane' || lastType.type === 'plane_with_single' || lastType.type === 'plane_with_pair') {
      // 飞机：找同类型同长度的更大飞机
      for (let start = 0; start <= hand.length - lastPlayedCards.length; start++) {
        const combinations = getCombinations(hand, lastPlayedCards.length, start);
        for (const combo of combinations) {
          const cards = combo.map(i => hand[i]);
          const cardType = getCardType(cards);
          if ((cardType.type === 'plane' || cardType.type === 'plane_with_single' || cardType.type === 'plane_with_pair') &&
              canBeat(cards, lastPlayedCards)) {
            possiblePlays.push(combo);
          }
        }
      }
    } else if (lastType.type === 'four_with_two') {
      // 四带二：找更大的四带二
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          for (let k = j + 1; k < hand.length; k++) {
            for (let l = k + 1; l < hand.length; l++) {
              if (hand[i].value === hand[j].value &&
                  hand[j].value === hand[k].value &&
                  hand[k].value === hand[l].value) {
                // 找两个单张
                for (let m = 0; m < hand.length; m++) {
                  for (let n = m + 1; n < hand.length; n++) {
                    if (m !== i && m !== j && m !== k && m !== l &&
                        n !== i && n !== j && n !== k && n !== l) {
                      const fourWithTwo = [hand[i], hand[j], hand[k], hand[l], hand[m], hand[n]];
                      if (canBeat(fourWithTwo, lastPlayedCards)) {
                        possiblePlays.push([i, j, k, l, m, n]);
                      }
                    }
                  }
                }
                // 找一个对子
                for (let m = 0; m < hand.length; m++) {
                  for (let n = m + 1; n < hand.length; n++) {
                    if (m !== i && m !== j && m !== k && m !== l &&
                        n !== i && n !== j && n !== k && n !== l &&
                        hand[m].value === hand[n].value && hand[m].type !== 'joker') {
                      const fourWithTwo = [hand[i], hand[j], hand[k], hand[l], hand[m], hand[n]];
                      if (canBeat(fourWithTwo, lastPlayedCards)) {
                        possiblePlays.push([i, j, k, l, m, n]);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // 检查炸弹和王炸是否能压过上一手牌
    // 普通炸弹
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          for (let l = k + 1; l < hand.length; l++) {
            if (hand[i].value === hand[j].value &&
                hand[j].value === hand[k].value &&
                hand[k].value === hand[l].value) {
              const bomb = [hand[i], hand[j], hand[k], hand[l]];
              if (canBeat(bomb, lastPlayedCards)) {
                possiblePlays.push([i, j, k, l]);
              }
            }
          }
        }
      }
    }

    // 王炸
    let smallJokerIndex = -1;
    let bigJokerIndex = -1;
    for (let i = 0; i < hand.length; i++) {
      if (hand[i].id === 'small_joker') smallJokerIndex = i;
      if (hand[i].id === 'big_joker') bigJokerIndex = i;
    }
    if (smallJokerIndex !== -1 && bigJokerIndex !== -1) {
      const kingBomb = [hand[smallJokerIndex], hand[bigJokerIndex]];
      if (canBeat(kingBomb, lastPlayedCards)) {
        possiblePlays.push([smallJokerIndex, bigJokerIndex]);
      }
    }
  }

  // 去重
  const uniquePlays = [];
  const seen = new Set();
  for (const play of possiblePlays) {
    const sortedPlay = [...play].sort((a, b) => a - b);
    const key = sortedPlay.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      uniquePlays.push(play);
    }
  }

  return uniquePlays;
};

// 获取组合的辅助函数
const getCombinations = (arr, length, start) => {
  const result = [];

  const combine = (start, depth, current) => {
    if (depth === 0) {
      result.push([...current]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      current.push(i);
      combine(i + 1, depth - 1, current);
      current.pop();
    }
  };

  combine(start, length, []);
  return result;
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

  // 飞机家族比较：plane / plane_with_single / plane_with_pair
  const isPlaneType = t => t && (t.type === 'plane' || t.type === 'plane_with_single' || t.type === 'plane_with_pair');
  if (isPlaneType(currentType) && isPlaneType(lastType)) {
    // 必须相同数量的三张组（count）才能比较
    if (currentType.count && lastType.count && currentType.count === lastType.count) {
      return currentType.value > lastType.value;
    }
    return false;
  }

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
  const [hintIndex, setHintIndex] = useState(0); // 提示索引，用于循环显示所有可能的出牌选项
  const [possiblePlays, setPossiblePlays] = useState([]); // 所有可能的出牌选项
  const [gameLog, setGameLog] = useState([]); // 游戏日志
  const [showSettings, setShowSettings] = useState(false); // 设置界面
  const [showGameLog, setShowGameLog] = useState(false); // 游戏记录界面
  const [showOptionsMenu, setShowOptionsMenu] = useState(false); // 选项菜单界面
  const [showHowToPlay, setShowHowToPlay] = useState(false); // 游戏玩法说明
  const [showGameModeSelection, setShowGameModeSelection] = useState(false); // 游戏模式选择界面
  const [landlord, setLandlord] = useState(-1); // 地主 (-1: 未确定, 0,1,2: 地主)
  const [landlordPlayCount, setLandlordPlayCount] = useState(0); // 地主已出牌手数（用于反春判定）
  const [highestBid, setHighestBid] = useState(0); // 最高叫分
  const [bidder, setBidder] = useState(-1); // 当前叫分者
  const [bids, setBids] = useState([-1, -1, -1]); // 每个玩家的叫分 [玩家, 电脑1, 电脑2]，-1表示未叫分
  const [biddingConsecutivePasses, setBiddingConsecutivePasses] = useState(0); // 叫分阶段连续不叫次数
  const [lastBidderForBidding, setLastBidderForBidding] = useState(-1); // 叫分阶段上一个叫分的玩家
  const [computerBiddingInProgress, setComputerBiddingInProgress] = useState(false); // 电脑叫分进行中，防止重复执行
  const [totalScore, setTotalScore] = useState(0); // 玩家总分

  // 加载和保存总分
  useEffect(() => {
    (async () => {
      try {
        const savedScore = await AsyncStorage.getItem('totalScore');
        if (savedScore !== null) {
          setTotalScore(parseInt(savedScore) || 0);
        }
      } catch (e) {
        console.warn('读取总分失败', e);
      }
    })();
  }, []);

  // 头像组件
  const PlayerAvatar = ({ playerIndex, size = 40, showLabel = false }) => {
    let backgroundColor, borderColor, label;

    switch(playerIndex) {
      case 0: // 玩家
        backgroundColor = '#E91E63'; // 绛紫色
        borderColor = '#C2185B'; // 深一点的绛紫
        label = '您';
        break;
      case 1: // 电脑1
        backgroundColor = '#2196F3'; // 蓝色
        borderColor = '#1976D2'; // 深一点的蓝
        label = '1';
        break;
      case 2: // 电脑2
        backgroundColor = '#FF9800'; // 橙色
        borderColor = '#F57C00'; // 深一点的橙
        label = '2';
        break;
      default:
        backgroundColor = '#9E9E9E'; // 灰色
        borderColor = '#757575'; // 深一点的灰
        label = '?';
    }

    return (
      <View style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 3,
          borderColor: borderColor,
          marginRight: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }
      ]}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: size * 0.4 }}>
          {label}
        </Text>
      </View>
    );
  };

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
      // 随机选择先叫地主的玩家
      const firstBidder = Math.floor(Math.random() * 3);
      setBidder(firstBidder); // 随机选择先叫地主的玩家
      setBids([-1, -1, -1]);
      setBiddingConsecutivePasses(0); // 重置连续不叫次数
      setLastBidderForBidding(-1); // 重置上一个叫分的玩家
      setComputerBiddingInProgress(false); // 重置电脑叫分进行中状态
      setGamePhase('bidding');
      setGameState('playing'); // 现在开始游戏，但处于叫地主阶段
      setLandlordPlayCount(0);
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
      setLandlordPlayCount(0);
      setGamePhase('playing');
      setCurrentPlayer(randomLandlord); // 地主先出牌
      setGameState('playing');
    } else if (gameMode === 'fast') {
      // 快速模式：简化流程，自动叫分
      setGameLog(['发牌完成，自动叫地主中...']);
      setLandlord(-1);
      setHighestBid(0);
      // 随机选择先叫地主的玩家
      const firstBidder = Math.floor(Math.random() * 3);
      setBidder(firstBidder); // 随机选择先叫地主的玩家
      setBids([-1, -1, -1]);
      setGamePhase('bidding');
      setGameState('playing');

      setLandlordPlayCount(0);

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
        if (strength >= 6 && highestBid < 3) bid = 3;
        else if (strength >= 4 && highestBid < 2) bid = 2;
        else if (strength >= 2 && highestBid < 1) bid = 1;
        else bid = 0;

        bidLandlord(bid);
      }, 1000);
    } else if (gameMode === 'threeKing') {
      // 三王模式：三人游戏，无叫地主环节
      setGameLog(['发牌完成，三王模式开始！']);
      setLandlord(-1);
      setHighestBid(0);
      setBidder(-1);
      setBids([-1, -1, -1]);
      setGamePhase('playing');
      setCurrentPlayer(0); // 玩家先出牌
      setGameState('playing');
      setLandlordPlayCount(0);
    } else {
      // 默认为标准模式
      setGameLog(['发牌完成，开始叫地主！']);
      setLandlord(-1);
      setHighestBid(0);
      // 随机选择先叫地主的玩家
      const firstBidder = Math.floor(Math.random() * 3);
      setBidder(firstBidder); // 随机选择先叫地主的玩家
      setBids([-1, -1, -1]);
      setBiddingConsecutivePasses(0); // 重置连续不叫次数
      setLastBidderForBidding(-1); // 重置上一个叫分的玩家
      setComputerBiddingInProgress(false); // 重置电脑叫分进行中状态
      setGamePhase('bidding');
      setGameState('playing'); // 现在开始游戏，但处于叫地主阶段
      setLandlordPlayCount(0);
    }

    // 重置提示索引
    setHintIndex(0);
    setPossiblePlays([]);
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

    // 不要立即更新状态，而是使用临时变量在后面统一处理
    // 这样可以确保状态更新的一致性

    setGameLog(prev => [...prev, `您叫了${bid === 0 ? '不叫' : bid + '分'}`]);

    // 使用临时变量来跟踪更新后的状态
    let newBiddingConsecutivePasses = biddingConsecutivePasses;
    let newLastBidderForBidding = lastBidderForBidding;

    // 更新叫分状态
    if (bid > highestBid) {
      setHighestBid(bid);
      // 不要在此处设置 `landlord`，只记录上一个叫分的玩家
      setLastBidderForBidding(0);
      newLastBidderForBidding = 0; // 记录玩家是上一个叫分的玩家
      newBiddingConsecutivePasses = 0; // 重置连续不叫次数
    } else if (bid === 0) {
      // 玩家不叫
      newBiddingConsecutivePasses = biddingConsecutivePasses + 1;
    } else {
      // 玩家叫了分但不是最高分（这种情况应该被视为不叫，增加连续不叫次数）
      newBiddingConsecutivePasses = biddingConsecutivePasses + 1;
    }

    // 检查是否应该结束叫地主
    if (bid === 3) {
      // 玩家叫了3分，直接结束叫地主
      setLandlord(0);
      setGamePhase('playing');
      setCurrentPlayer(0); // 玩家先出牌
      setGameLog(prev => [...prev, `您成为地主，获得底牌！（请确认收牌）`, `游戏开始！地主是您`]);
      setPendingBottom({ owner: 0, cards: [...bottomCards] });
      setBottomInserted(false);
      setBottomCards([]);
      // 重置电脑叫分进行中标记
      setComputerBiddingInProgress(false);
    } else if (newBiddingConsecutivePasses >= 2) {
      if (newLastBidderForBidding !== -1) {
        // 连续两个不叫，上一个叫分的玩家成为地主
        setLandlord(newLastBidderForBidding);
        setGamePhase('playing');
        setCurrentPlayer(newLastBidderForBidding);

        if (newLastBidderForBidding === 0) {
          // 玩家成为地主
          setGameLog(prev => [...prev, `您成为地主，获得底牌！（请确认收牌）`, `游戏开始！地主是您`]);
          setPendingBottom({ owner: 0, cards: [...bottomCards] });
          setBottomInserted(false);
        } else {
          // 电脑成为地主
          let newComputerHand = newLastBidderForBidding === 1 ? [...computer1Hand] : [...computer2Hand];
          newComputerHand = [...newComputerHand, ...bottomCards].sort(compareCardValues);
          if (newLastBidderForBidding === 1) {
            setComputer1Hand([...newComputerHand]);
          } else {
            setComputer2Hand([...newComputerHand]);
          }
          setGameLog(prev => [...prev, `电脑${newLastBidderForBidding}成为地主，获得底牌！`, `游戏开始！地主是电脑${newLastBidderForBidding}`]);
        }
        setBottomCards([]);
        // 重置电脑叫分进行中标记
        setComputerBiddingInProgress(false);
      } else {
        // 没有人叫分，随机选择一个玩家成为地主
        const randomLandlord = Math.floor(Math.random() * 3);
        setLandlord(randomLandlord);
        setGamePhase('playing');
        setCurrentPlayer(randomLandlord);

        if (randomLandlord === 0) {
          // 玩家成为地主
          setGameLog(prev => [...prev, `所有玩家都不叫地主，随机选择地主中...您成为地主，获得底牌！`, `游戏开始！地主是您`]);
          setPendingBottom({ owner: 0, cards: [...bottomCards] });
          setBottomInserted(false);
        } else {
          // 电脑成为地主
          let newComputerHand = randomLandlord === 1 ? [...computer1Hand] : [...computer2Hand];
          newComputerHand = [...newComputerHand, ...bottomCards].sort(compareCardValues);
          if (randomLandlord === 1) {
            setComputer1Hand([...newComputerHand]);
          } else {
            setComputer2Hand([...newComputerHand]);
          }
          setGameLog(prev => [...prev, `所有玩家都不叫地主，随机选择地主中...电脑${randomLandlord}成为地主，获得底牌！`, `游戏开始！地主是电脑${randomLandlord}`]);
        }
        setBottomCards([]);
        // 重置叫分相关状态，确保不会出现状态冲突
        setBiddingConsecutivePasses(0);
        setLastBidderForBidding(-1);
        // 重置电脑叫分进行中标记
        setComputerBiddingInProgress(false);
      }
    } else {
      // 轮到下一个玩家
      setBidder(prev => (prev + 1) % 3);
    }
  };

  // 不叫地主
  const passBid = () => {
    if (gamePhase !== 'bidding' || bidder !== 0) return;

    setGameLog(prev => [...prev, '您选择不叫']);

    // 更新叫分记录
    const newBids = [...bids];
    newBids[0] = 0; // 不叫
    setBids(newBids);

    // 检查是否连续两个不叫（在更新当前不叫之前）
    const newConsecutivePasses = biddingConsecutivePasses + 1;
    setBiddingConsecutivePasses(newConsecutivePasses);
    if (newConsecutivePasses >= 2) {
      if (lastBidderForBidding !== -1) {
        // 连续两个不叫，上一个叫分的玩家成为地主
        setLandlord(lastBidderForBidding);
        setGamePhase('playing');
        setCurrentPlayer(lastBidderForBidding);

        if (lastBidderForBidding === 0) {
          // 玩家成为地主
          setGameLog(prev => [...prev, `您成为地主，获得底牌！（请确认收牌）`, `游戏开始！地主是您`]);
          setPendingBottom({ owner: 0, cards: bottomCards });
          setBottomInserted(false);
        } else {
          // 电脑成为地主
          let newComputerHand = lastBidderForBidding === 1 ? [...computer1Hand] : [...computer2Hand];
          newComputerHand = [...newComputerHand, ...bottomCards].sort(compareCardValues);
          if (lastBidderForBidding === 1) {
            setComputer1Hand(newComputerHand);
          } else {
            setComputer2Hand(newComputerHand);
          }
          setGameLog(prev => [...prev, `电脑${lastBidderForBidding}成为地主，获得底牌！`, `游戏开始！地主是电脑${lastBidderForBidding}`]);
        }
        setBottomCards([]);
        // 重置电脑叫分进行中标记
        setComputerBiddingInProgress(false);
      } else {
        // 没有人叫分，随机选择一个玩家成为地主
        const randomLandlord = Math.floor(Math.random() * 3);
        setLandlord(randomLandlord);
        setGamePhase('playing');
        setCurrentPlayer(randomLandlord);

        if (randomLandlord === 0) {
          // 玩家成为地主
          setGameLog(prev => [...prev, `所有玩家都不叫地主，随机选择地主中...您成为地主，获得底牌！`, `游戏开始！地主是您`]);
          setPendingBottom({ owner: 0, cards: bottomCards });
          setBottomInserted(false);
        } else {
          // 电脑成为地主
          let newComputerHand = randomLandlord === 1 ? [...computer1Hand] : [...computer2Hand];
          newComputerHand = [...newComputerHand, ...bottomCards].sort(compareCardValues);
          if (randomLandlord === 1) {
            setComputer1Hand(newComputerHand);
          } else {
            setComputer2Hand(newComputerHand);
          }
          setGameLog(prev => [...prev, `所有玩家都不叫地主，随机选择地主中...电脑${randomLandlord}成为地主，获得底牌！`, `游戏开始！地主是电脑${randomLandlord}`]);
        }
        setBottomCards([]);
        // 重置叫分相关状态，确保不会出现状态冲突
        setBiddingConsecutivePasses(0);
        setLastBidderForBidding(-1);
        // 重置电脑叫分进行中标记
        setComputerBiddingInProgress(false);
      }
    } else {
      // 轮到下一个玩家
      setBidder(prev => (prev + 1) % 3);
      // 重置电脑叫分进行中标记
      setComputerBiddingInProgress(false);
    }
  };

  // 电脑叫地主
  useEffect(() => {
    if (gamePhase === 'bidding' && bidder !== 0 && landlord === -1 && !computerBiddingInProgress) {
      // 设置电脑叫分进行中标记，防止重复执行
      setComputerBiddingInProgress(true);

      // 使用异步函数和延迟来模拟"思考"效果，同时保持逻辑同步
      (async () => {
        // 模拟电脑思考时间
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 检查在此期间状态是否发生变化
        if (gamePhase !== 'bidding' || bidder === 0 || landlord !== -1 || computerBiddingInProgress) {
          // 如果状态不再满足条件，直接重置标记并返回
          setComputerBiddingInProgress(false);
          return;
        }

        try {
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
              // 重置电脑叫分进行中标记并返回
              setComputerBiddingInProgress(false);
              return;
          }

          // 检查电脑手牌是否已加载且格式正确
          if (!computerHand || !Array.isArray(computerHand) || computerHand.length === 0) {
            console.log(`电脑${computerIndex}手牌未加载或格式不正确，跳过叫分`);
            // 重置标记，允许后续重试
            setComputerBiddingInProgress(false);
            // 轮到下一个玩家
            setBidder(prev => (prev + 1) % 3);
            return;
          }

          // 简单的AI叫地主逻辑：根据手牌强度决定叫分
          let bid = 0;

          try {
            // 计算手牌强度（简单算法：统计对子、三张、炸弹等）
            const valueCounts = {};
            (computerHand || []).forEach(card => {
              if (card && card.value) {
                valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
              }
            });

            let strength = 0;
            Object.values(valueCounts).forEach(count => {
              if (count === 2) strength += 1; // 对子
              else if (count === 3) strength += 2; // 三张
              else if (count === 4) strength += 4; // 炸弹
            });

            // 如果有王炸，增加强度
            const jokers = (computerHand || []).filter(c => c && c.type === 'joker');
            if (jokers.length === 2) strength += 5; // 王炸

            // 根据强度决定叫分，但必须高于当前最高分
            if (strength >= 6 && highestBid < 3) bid = 3;
            else if (strength >= 4 && highestBid < 2) bid = 2;
            else if (strength >= 2 && highestBid < 1) bid = 1;
            else bid = 0;

            // 如果当前最高分已经是3分，就不再叫
            if (highestBid === 3) bid = 0;
          } catch (error) {
            console.error(`电脑${computerIndex}计算叫分时出错:`, error);
            bid = 0; // 默认不叫
          }

          const newBids = [...bids];
          newBids[computerIndex] = bid;
          setBids(newBids);

          // 注意：这里不立即更新最高分和地主，而是在后续状态更新中处理
          // 这样可以确保只有真正超过最高分的叫分才会更新地主信息

          setGameLog(prev => [...prev, `电脑${computerIndex}叫了${bid === 0 ? '不叫' : bid + '分'}`]);

          // 使用临时变量来跟踪更新后的状态
          let newBiddingConsecutivePasses = biddingConsecutivePasses;
          let newLastBidderForBidding = lastBidderForBidding;

          // 更新叫分状态
          if (bid > highestBid) {
            setHighestBid(bid);
            // 不要在此处设置 `landlord`，只记录上一个叫分的玩家
            newLastBidderForBidding = computerIndex; // 记录上一个叫分的玩家
            setLastBidderForBidding(computerIndex);
            newBiddingConsecutivePasses = 0; // 重置连续不叫次数
            setBiddingConsecutivePasses(0);
          } else if (bid === 0) {
            // 电脑不叫
            newBiddingConsecutivePasses = biddingConsecutivePasses + 1;
            setBiddingConsecutivePasses(prev => prev + 1);
          } else {
            // 电脑叫了分但不是最高分（这种情况应该被视为不叫，增加连续不叫次数）
            newBiddingConsecutivePasses = biddingConsecutivePasses + 1;
            setBiddingConsecutivePasses(prev => prev + 1);
          }

          // 检查是否应该结束叫地主
          if (bid === 3) {
            // 有人叫了3分，直接结束
            // 确保当前电脑确实叫了3分并成为了地主
            if (bid > highestBid) {
              // 最终确定地主为当前叫分者
              setLandlord(computerIndex);
              // 给地主底牌
              let newPlayerHand = [...playerHand];
              let newComputer1Hand = [...computer1Hand];
              let newComputer2Hand = [...computer2Hand];

              switch(computerIndex) {
                case 0: // 玩家是地主
                  // 玩家成为地主：先展示为待确认底牌，让玩家查看后确认插入
                  setPendingBottom({ owner: 0, cards: [...bottomCards] });
                  setBottomInserted(false);
                  setGameLog(prev => [...prev, `您成为地主，获得底牌！（请确认收牌）`, `游戏开始！地主是您`]);
                  setGamePhase('playing');
                  setCurrentPlayer(0); // 玩家先出牌
                  break;
                case 1: // 电脑1是地主
                  newComputer1Hand = [...computer1Hand, ...bottomCards].sort(compareCardValues);
                  setGameLog(prev => [...prev, `电脑1成为地主，获得底牌！`, `游戏开始！地主是电脑1`]);
                  setGamePhase('playing');
                  setCurrentPlayer(1); // 电脑1先出牌
                  break;
                case 2: // 电脑2是地主
                  newComputer2Hand = [...computer2Hand, ...bottomCards].sort(compareCardValues);
                  setGameLog(prev => [...prev, `电脑2成为地主，获得底牌！`, `游戏开始！地主是电脑2`]);
                  setGamePhase('playing');
                  setCurrentPlayer(2); // 电脑2先出牌
                  break;
              }

              if (computerIndex !== 0) { // 如果不是玩家成为地主，则更新手牌
                setPlayerHand([...newPlayerHand]);
                setComputer1Hand([...newComputer1Hand]);
                setComputer2Hand([...newComputer2Hand]);
                setBottomCards([]);
              }
            }
          } else if (newBiddingConsecutivePasses >= 2) {
            if (newLastBidderForBidding !== -1) {
              // 连续两个不叫，上一个叫分的玩家成为地主
              setLandlord(newLastBidderForBidding);
              setGamePhase('playing');
              setCurrentPlayer(newLastBidderForBidding);

              let newPlayerHand = [...playerHand];
              let newComputer1Hand = [...computer1Hand];
              let newComputer2Hand = [...computer2Hand];

              switch(newLastBidderForBidding) {
                case 0: // 玩家是地主
                  setPendingBottom({ owner: 0, cards: [...bottomCards] });
                  setBottomInserted(false);
                  setGameLog(prev => [...prev, `您成为地主，获得底牌！（请确认收牌）`, `游戏开始！地主是您`]);
                  break;
                case 1: // 电脑1是地主
                  newComputer1Hand = [...computer1Hand, ...bottomCards].sort(compareCardValues);
                  setGameLog(prev => [...prev, `电脑1成为地主，获得底牌！`, `游戏开始！地主是电脑1`]);
                  break;
                case 2: // 电脑2是地主
                  newComputer2Hand = [...computer2Hand, ...bottomCards].sort(compareCardValues);
                  setGameLog(prev => [...prev, `电脑2成为地主，获得底牌！`, `游戏开始！地主是电脑2`]);
                  break;
              }

              if (newLastBidderForBidding !== 0) { // 如果不是玩家成为地主，则更新手牌
                setPlayerHand(newPlayerHand);
                setComputer1Hand(newComputer1Hand);
                setComputer2Hand(newComputer2Hand);
                setBottomCards([]);
              }
            } else {
              // 没有人叫分，随机选择一个玩家成为地主
              const randomLandlord = Math.floor(Math.random() * 3);
              setLandlord(randomLandlord);
              setGamePhase('playing');
              setCurrentPlayer(randomLandlord);

              let newPlayerHand = [...playerHand];
              let newComputer1Hand = [...computer1Hand];
              let newComputer2Hand = [...computer2Hand];

              switch(randomLandlord) {
                case 0: // 玩家是地主
                  setPendingBottom({ owner: 0, cards: [...bottomCards] });
                  setBottomInserted(false);
                  setGameLog(prev => [...prev, `所有玩家都不叫地主，随机选择地主中...您成为地主，获得底牌！`, `游戏开始！地主是您`]);
                  break;
                case 1: // 电脑1是地主
                  newComputer1Hand = [...computer1Hand, ...bottomCards].sort(compareCardValues);
                  setGameLog(prev => [...prev, `所有玩家都不叫地主，随机选择地主中...电脑1成为地主，获得底牌！`, `游戏开始！地主是电脑1`]);
                  break;
                case 2: // 电脑2是地主
                  newComputer2Hand = [...computer2Hand, ...bottomCards].sort(compareCardValues);
                  setGameLog(prev => [...prev, `所有玩家都不叫地主，随机选择地主中...电脑2成为地主，获得底牌！`, `游戏开始！地主是电脑2`]);
                  break;
              }

              if (randomLandlord !== 0) { // 如果不是玩家成为地主，则更新手牌
                setPlayerHand(newPlayerHand);
                setComputer1Hand(newComputer1Hand);
                setComputer2Hand(newComputer2Hand);
                setBottomCards([]);
              }

              // 重置叫分相关状态，确保不会出现状态冲突
              setBiddingConsecutivePasses(0);
              setLastBidderForBidding(-1);
            }
          } else {
            // 轮到下一个玩家
            setBidder(prev => (prev + 1) % 3);
          }
        } catch (error) {
          console.error('电脑叫分逻辑出错:', error);
        } finally {
          // 无论是否出错，都要重置电脑叫分进行中标记
          setComputerBiddingInProgress(false);
        }
      })();
    }
  }, [bidder, gamePhase, highestBid, biddingConsecutivePasses, lastBidderForBidding, landlord, computerBiddingInProgress]);




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

  // 计算手牌重叠量以保证尽量一屏显示（返回 marginLeft 值，可为负数）
  // 为老年人优化：使用更紧凑的重叠策略，确保能显示所有牌
  // 重叠度：0%表示牌紧贴，负值表示重叠
  const computeOverlap = (count) => {
    const screenWidth = Dimensions.get('window').width;
    const horizontalPadding = 4; // 进一步减少边距，让牌能更占满屏幕
    const containerWidth = screenWidth - horizontalPadding;
    const cardWidth = 58; // 卡片宽度（与样式中一致）

    if (count <= 1) return 0;

    // 为了确保所有牌都在容器内，计算最大允许的间距
    // 第n张牌的右边界：(n-1) * marginLeft + cardWidth <= containerWidth
    // 解得：marginLeft <= (containerWidth - cardWidth) / (count - 1)
    const maxAllowedSpacing = (containerWidth - cardWidth) / (count - 1);
    // 平滑插值参数（可调）：
    const MIN_OVERLAP = 0.12; // 最小重叠比例（12%）——保证总有一点重叠
    const MAX_OVERLAP = 0.72; // 最大重叠比例（20张及以上）
    const MAX_COUNT = 20; // 对应 MAX_OVERLAP
    const exponent = 0.5; // 使用幂函数（sqrt）使曲线在高牌数处更接近 MAX_OVERLAP

    // 计算基于牌数的目标重叠比例（0..1），使用归一化并应用幂函数
    const t = Math.max(0, Math.min(1, (count - 1) / (MAX_COUNT - 1)));
    let targetOverlap = MIN_OVERLAP + (MAX_OVERLAP - MIN_OVERLAP) * Math.pow(t, exponent);

    // 对于极端点（明确要求）：在 17 张附近接近 0.68，我们通过上面的参数已能达到接近值
    // 现在根据容器可用空间，调整真实重叠以确保卡片能放下

    // 若空间充足（允许非重叠或正间距），优先使用允许的最大间距以减少重叠
    if (maxAllowedSpacing >= cardWidth * (1 - targetOverlap)) {
      // 可以使用目标偏移或更大间距（减少重叠）
      return Math.floor(Math.min(maxAllowedSpacing, cardWidth));
    }

    // 计算为了适配容器所需的最小重叠比例
    const requiredOverlapToFit = 1 - (maxAllowedSpacing / cardWidth);

    // 最终重叠比例至少为 targetOverlap，但如果空间不足需要增加到 requiredOverlapToFit
    const finalOverlap = Math.max(targetOverlap, requiredOverlapToFit);
    const clampedOverlap = Math.min(finalOverlap, MAX_OVERLAP);

    // 返回负的 marginLeft（重叠）或在极端情况下接近 -cardWidth*MAX_OVERLAP
    return -Math.round(cardWidth * clampedOverlap);
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

    // 计算倍数：炸弹翻倍 + 春天/反春天翻倍
    let multiplier = Math.pow(2, bombsCount); // 炸弹翻倍

    // 检查是否为春天或反春天
    const isLandlordWinner = winnerIndex === landlord; // 地主获胜
    // 春天：地主获胜且两个农民都没有出过牌
    const isAllFarmersLocked = landlord !== -1 && (
      (landlord === 0 && !playedAny[1] && !playedAny[2]) ||
      (landlord === 1 && !playedAny[0] && !playedAny[2]) ||
      (landlord === 2 && !playedAny[0] && !playedAny[1])
    );
    // 反春天（按您提供的规则）：农民获胜且地主仅出过一手牌
    const isAntiSpring = !isLandlordWinner && landlord !== -1 && landlordPlayCount === 1;

    const isSpring = isLandlordWinner && isAllFarmersLocked;

    if (isSpring || isAntiSpring) {
      multiplier *= 2; // 春天或反春天翻倍
    }

    const base = Math.max(1, highestBid);
    const score = base * multiplier;

    // 计算新的总分
    let newTotalScore = totalScore;
    if (winnerIndex === 0) { // 玩家获胜
      newTotalScore += score;
    } else { // 玩家失败
      newTotalScore -= score;
    }

    // 确保分数不为负数
    newTotalScore = Math.max(0, newTotalScore);

    setGameState('gameOver');
    const result = isLandlordWin ? '地主获胜！' : '农民获胜！';
    setGameLog(prev => [...prev, `游戏结束：${result}（炸弹 ${bombsCount} 次，关住 ${locked} 人，倍数 x${multiplier}） 得分 ${score}`]);

    const winMessage = `${result}\n基础分: ${base}\n炸弹: ${bombsCount} 次\n关住: ${locked} 人\n倍数: x${multiplier}\n本次得分: ${score}\n总分: ${newTotalScore}`;
    Alert.alert('游戏结束', winMessage, [{ text: '确定', onPress: () => {} }]);

    // 更新总分并保存
    setTotalScore(newTotalScore);
    (async () => {
      try {
        await AsyncStorage.setItem('totalScore', newTotalScore.toString());
      } catch (e) {
        console.warn('保存总分失败', e);
      }
    })();

    // 重置提示索引
    setHintIndex(0);
    setPossiblePlays([]);

    // 重置叫地主相关状态
    setBiddingConsecutivePasses(0);
    setLastBidderForBidding(-1);
    setComputerBiddingInProgress(false);
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
    // 如果不是���接���（��上一个��牌者不是���前玩家）���则需要压过��一手牌
    if (!(lastPlayer === currentPlayer || lastPlayedCards.length === 0)) {
      if (!canBeat(playedCards, lastPlayedCards)) {
        Alert.alert('提示', '���出的牌不��压过上一手牌');
        return;
      }
    }

    // 标��玩家已出牌
    setPlayedAny(prev => {
      const next = [...prev];
      next[0] = true;
      return next;
    });

    // 如果当前玩家是地主，记录地主出牌手数（按“手”计数）
    if (landlord === 0) {
      setLandlordPlayCount(prev => prev + 1);
    }

    // 如果是炸弹或王炸，记录炸弹次数���每次翻倍）
    if (cardType.type === 'bomb' || cardType.type === 'king_bomb') {
      setBombsCount(prev => prev + 1);
    }

    const newPlayerHand = playerHand.filter((card, index) => !selectedCards.includes(index));
    setPlayerHand(newPlayerHand);
    setLastPlayedCards(playedCards);
    setLastPlayer(0);
    setConsecutivePasses(0);
    setSelectedCards([]);
    
    // �����游戏���志
    const cardNames = playedCards.map(c => c.type === 'joker' ? c.realValue : c.value);
    setGameLog(prev => [...prev, `您出了: ${cardNames.join(', ')}`]);
    
    // 检查是否获胜
    if (newPlayerHand.length === 0) {
      finishGame(0);
      return;
    }
    
    // 轮到��一个玩家
    setCurrentPlayer((currentPlayer + 1) % 3);

    // 重置提示索引
    setHintIndex(0);
    setPossiblePlays([]);
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

    // 重置提示索引
    setHintIndex(0);
    setPossiblePlays([]);
  };

  // 提示功能
  const showHint = () => {
    if (gameState !== 'playing' || gamePhase !== 'playing' || currentPlayer !== 0) {
      Alert.alert('提示', '现在不是������������的回合');
      return;
    }
    // 重新生成所有可能的出牌选项（使用局部变量以避免 setState 的异步问题）
    let plays = possiblePlays;
    if (!plays || plays.length === 0) {
      plays = generatePossiblePlays(playerHand, lastPlayedCards);
      setPossiblePlays(plays);
      setHintIndex(0);
    }

    if (!plays || plays.length === 0) {
      Alert.alert('提示', '没有可以出的牌');
      return;
    }

    // 按顺序显示每一种出牌方式，轮流完所有方式后再点一次收回所有选择
    let localIndex = hintIndex;
    // 如果刚刚生成了 plays，重置本地索引为 0（避免异步 setState 导致的旧索引问题）
    if (!possiblePlays || possiblePlays.length === 0) {
      localIndex = 0;
    }

    if (localIndex < plays.length) {
      const currentPlay = plays[localIndex] || [];
      setSelectedCards(currentPlay);

      // 显示提示信息
      const cardNames = currentPlay.map(i => {
        const card = playerHand[i];
        return card ? (card.type === 'joker' ? card.realValue : card.value) : '';
      });
      Alert.alert('提示', `第${localIndex + 1}/${plays.length}种出牌方式: ${cardNames.join(', ')}`);

      // 递增索引，下一次显示下一种
      setHintIndex(localIndex + 1);
    } else {
      // 已经显示完所有出牌方式，收回所有牌并重置
      setSelectedCards([]);
      setHintIndex(0);
      setPossiblePlays([]);
      Alert.alert('提示', '已收回所有提示');
    }
  };

  // 电脑玩���出牌
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

            // 如果该电脑是地主，记录地主出牌手数（按手计数）
            if (computerIndex === landlord) {
              setLandlordPlayCount(prev => prev + 1);
            }

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

            // 重置提示索引
            setHintIndex(0);
            setPossiblePlays([]);
          }
          } else {
          // 电脑过牌（未进入上面分支），也计入连续过牌
          setConsecutivePasses(prev => {
            const next = prev + 1;
            if (next >= 2) {
              setGameLog(g => [...g, `所有其他玩家均过牌，轮到 ${lastPlayer === 0 ? '您' : `电脑${lastPlayer}`} 任意出牌`]);
              setLastPlayedCards([]);
              setCurrentPlayer(lastPlayer);
              // 重置提示索引
              setHintIndex(0);
              setPossiblePlays([]);
              return 0;
            } else {
              setGameLog(g => [...g, `电脑${computerIndex}过牌`]);
              // 重置提示索引
              setHintIndex(0);
              setPossiblePlays([]);
              return next;
            }
          });
          return; // 已处理轮转，避免外部重复设置 next player
        }

        // 轮到���一��玩家
        setCurrentPlayer((currentPlayer + 1) % 3);

        // 重置提示索引
        setHintIndex(0);
        setPossiblePlays([]);
      }, 2000); // 2秒后电脑��牌

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
          <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>总分: {totalScore}</Text>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={startNewGame}>
            <Text style={styles.startButtonText}>开始游戏</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsButton} onPress={() => setShowHowToPlay(true)}>
            <Text style={styles.settingsButtonText}>游戏玩法</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsButton} onPress={() => setShowGameModeSelection(true)}>
            <Text style={styles.settingsButtonText}>选择游戏模式</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsButton} onPress={() => {
            if (Platform.OS === 'android') {
              BackHandler.exitApp();
            } else {
              // 对于iOS，我们显示一个确认对话框
              Alert.alert(
                '退出游戏',
                '您确定要退出游戏吗？',
                [
                  { text: '取消', style: 'cancel' },
                  { text: '确定', onPress: () => {
                    // 这接退出应用
                    if (Platform.OS === 'ios') {
                      // iOS无法直接退出应用，可以隐藏应用
                      // 但通常不推荐这样做，我们可以提醒用户使用后台管理
                      Alert.alert('提示', '请使用系统后台管理功能退出应用');
                    }
                  }}
                ]
              );
            }
          }}>
            <Text style={styles.settingsButtonText}>退出游戏</Text>
          </TouchableOpacity>
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
                <Text style={styles.ruleText}>• 游戏人数：3人（您和2个电脑对手）</Text>
                <Text style={styles.ruleText}>• 牌数：每人17张，底牌3张</Text>
                <Text style={styles.ruleText}>• 叫地主：随机选择一位玩家先叫，依次叫1分、2分、3分或不叫</Text>
                <Text style={styles.ruleText}>• 地主：叫分最高的玩家获得底牌，���出牌</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* 选项按钮 */}
            <TouchableOpacity
              style={styles.optionsButtonInInfoBar}
              onPress={() => setShowOptionsMenu(true)}
            >
              <Text style={styles.optionsButtonTextInInfoBar}>选项</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
              <Text style={styles.infoText}>叫地主阶段</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.infoText}>当前最高分: {highestBid}</Text>
          </View>
        </View>
        
        <View style={styles.playersRow}>
          <View style={styles.topPlayerSmall}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <PlayerAvatar playerIndex={1} size={30} />
              <Text style={styles.playerName}>电脑1</Text>
            </View>
            <Text style={styles.cardCount}>叫分: {bids[1] === 0 ? '不叫' : bids[1] + '分'}</Text>
          </View>
          <View style={styles.topPlayerSmall}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <PlayerAvatar playerIndex={2} size={30} />
              <Text style={styles.playerName}>电脑2</Text>
            </View>
            <Text style={styles.cardCount}>叫分: {bids[2] === 0 ? '不叫' : bids[2] + '分'}</Text>
          </View>
        </View>
        
        <View style={styles.centerArea}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.biddingText}>当前叫分者: </Text>
            <PlayerAvatar playerIndex={bidder} size={25} />
          </View>
          <Text style={styles.biddingText}>最高分: {highestBid}分</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Text style={styles.biddingText}>地主: </Text>
            {landlord === -1 ? (
              <Text style={styles.biddingText}>未确定</Text>
            ) : (
              <PlayerAvatar playerIndex={landlord} size={25} />
            )}
          </View>
        </View>
        
        
        <View style={styles.bottomPlayer}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PlayerAvatar playerIndex={0} size={30} />
            <Text style={styles.playerName}> (17张)</Text>
          </View>
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
                  const marginLeftP = idx === 0 ? 0 : baseOverlapP; // 第一张牌不需要特别偏移
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
                })}
              )}
              <TouchableOpacity style={styles.confirmButton} onPress={confirmBottomForPlayer}>
                <Text style={styles.confirmButtonText}>确认收牌</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            horizontal
            scrollEnabled={false}
            contentContainerStyle={styles.handScroll}
            showsHorizontalScrollIndicator={false}
          >
            {(() => {
              const displayed = getDisplayedHand();
              const baseOverlap = computeOverlap(displayed.length);
              return displayed.map((card, displayIndex) => {
                const realIndex = getRealIndex(displayIndex);
                const marginLeft = displayIndex === 0 ? 0 : baseOverlap; // 第一张牌不需要特别偏移
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
        
        {/* 选项菜单弹窗 */}
        <Modal
          visible={showOptionsMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowOptionsMenu(false)}
        >
          <TouchableOpacity
            style={styles.optionMenuOverlay}
            onPress={() => setShowOptionsMenu(false)}
          >
            <View style={styles.optionMenuContainer}>
              <TouchableOpacity
                style={styles.optionMenuItem}
                onPress={() => {
                  setShowGameLog(true);
                  setShowOptionsMenu(false);
                }}
              >
                <Text style={styles.optionMenuItemText}>游戏记录</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionMenuItem}
                onPress={() => {
                  Alert.alert(
                    '退出游戏',
                    '您确定要退出当前游戏吗？',
                    [
                      { text: '取消', style: 'cancel', onPress: () => setShowOptionsMenu(false) },
                      { text: '确定', onPress: () => {
                          setGameState('menu');
                          setShowOptionsMenu(false);
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.optionMenuItemText}>退出游戏</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
        
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
          <Text style={styles.gameOverText}>总分: {totalScore}</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.startButton} onPress={startNewGame}>
              <Text style={styles.startButtonText}>再来一局</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsButton} onPress={() => setGameState('menu')}>
              <Text style={styles.settingsButtonText}>返回主菜单</Text>
            </TouchableOpacity>
          </View>
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* 选项按钮 */}
          <TouchableOpacity
            style={styles.optionsButtonInInfoBar}
            onPress={() => setShowOptionsMenu(true)}
          >
            <Text style={styles.optionsButtonTextInInfoBar}>选项</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
            <Text style={styles.infoText}>当前: </Text>
            <PlayerAvatar playerIndex={currentPlayer} size={25} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
            <Text style={styles.infoText}>地主: </Text>
            <PlayerAvatar playerIndex={landlord} size={25} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.infoText}>最高分: {highestBid}</Text>
        </View>
      </View>
      
      {/* 顶部两个电脑玩家一行显示 */}
      <View style={styles.playersRow}>
        <View style={styles.topPlayerSmall}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PlayerAvatar playerIndex={1} size={30} />
            <Text style={styles.playerName}>电脑1</Text>
          </View>
          <Text style={styles.cardCount}>{computer1Hand.length} 张牌</Text>
        </View>
        <View style={styles.topPlayerSmall}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PlayerAvatar playerIndex={2} size={30} />
            <Text style={styles.playerName}>电脑2</Text>
          </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <PlayerAvatar playerIndex={lastPlayer} size={20} />
              <Text style={styles.lastPlayerText}>出牌</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.waitingText}>等待出牌...</Text>
        )}
      </View>
      
      
      {/* 玩家手牌区域 */}
      <View style={styles.bottomPlayer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PlayerAvatar playerIndex={0} size={30} />
          <Text style={styles.playerName}> ({playerHand.length})</Text>
        </View>
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
                const marginLeftP = idx === 0 ? -4 : baseOverlapP; // 第一张牌稍微向左移动，更好地利用空间
                return (
                  <View key={idx} style={[styles.card, styles.pendingCard, { marginLeft: idx === 0 ? -4 : marginLeftP }]}> 
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
          scrollEnabled={false}
          contentContainerStyle={styles.handScroll}
          showsHorizontalScrollIndicator={false}
        >
          {(() => {
            const displayed = getDisplayedHand();
            const baseOverlap = computeOverlap(displayed.length);
            return displayed.map((card, displayIndex) => {
              const realIndex = getRealIndex(displayIndex);
              const marginLeft = displayIndex === 0 ? 0 : baseOverlap; // 第一张牌不需要特别偏移
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
      
      {/* 选项菜单弹窗 */}
      <Modal
        visible={showOptionsMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.optionMenuOverlay}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.optionMenuContainer}>
            <TouchableOpacity
              style={styles.optionMenuItem}
              onPress={() => {
                setShowGameLog(true);
                setShowOptionsMenu(false);
              }}
            >
              <Text style={styles.optionMenuItemText}>游戏记录</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionMenuItem}
              onPress={() => {
                Alert.alert(
                  '退出游戏',
                  '您确定要退出当前游戏吗？',
                  [
                    { text: '取消', style: 'cancel', onPress: () => setShowOptionsMenu(false) },
                    { text: '确定', onPress: () => {
                        setGameState('menu');
                        setShowOptionsMenu(false);
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.optionMenuItemText}>退出游戏</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      
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
    fontSize: 52,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
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
    fontSize: 26,
    color: '#fff',
    fontWeight: 'bold',
  },
  settingsButtonText: {
    fontSize: 26,
    color: '#fff',
    fontWeight: 'bold',
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 20,
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
    padding: 12, // 减少内边距
    margin: 6, // 减少外边距
    borderRadius: 15,
    alignItems: 'center',
    width: '48%',
  },
  playersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 8,
    alignItems: 'center',
    marginTop: 10, // 添加上边距，让出空间给按钮
  },
  playerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardCount: {
    fontSize: 20,
    color: '#fff',
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5, // 减少垂直边距
  },
  lastPlayArea: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
  },
  lastPlayText: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 12,
  },
  lastPlayCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardPlaceholder: {
    width: 64,
    height: 90,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  cardText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  jokerTextSmall: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 20,
  },
  lastPlayerText: {
    fontSize: 22,
    color: '#ffcc00',
    fontWeight: 'bold',
  },
  waitingText: {
    fontSize: 28,
    color: '#fff',
  },
  biddingText: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  bottomPlayer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10, // 减少内边距
    marginHorizontal: 4, // 减少水平边距
    marginVertical: 5, // 减少垂直边距
    borderRadius: 15,
  },
  handContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  card: {
    width: 58, // 卡片宽度
    height: 94, // 卡片高度
    backgroundColor: '#fff',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2, // 增加水平边距，让牌更清晰
    marginVertical: 6, // 增加垂直边距，让牌更清晰
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
    top: 6,
    left: 2,
    alignItems: 'flex-start',
  },
  cardSuitSmall: {
    fontSize: 14,
    lineHeight: 16,
    marginTop: 3,
  },
  cardValueSmall: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  jokerText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 20,
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
    paddingHorizontal: 2, // 进一步减少边距，让牌能更占满屏幕
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
    padding: 10, // 减少内边距
    zIndex: 1000,
    elevation: 10,
    position: 'relative',
    marginTop: 5, // 添加上边距
  },
  biddingButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    padding: 10, // 减少内边距
  },
  hintButton: {
    backgroundColor: '#9c27b0',
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 30,
    minWidth: 100,
    alignItems: 'center',
  },
  bidButton: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 25,
    paddingVertical: 20,
    borderRadius: 30,
    minWidth: 80,
    alignItems: 'center',
    margin: 8,
  },
  passButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 30,
    minWidth: 100,
    alignItems: 'center',
    zIndex: 1010,
    elevation: 12,
  },
  playButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 30,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  largeButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  gameOverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverTitle: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 25,
  },
  gameOverText: {
    fontSize: 32,
    color: '#fff',
    marginBottom: 35,
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#333',
    textAlign: 'center',
  },
  rulesContainer: {
    width: '100%',
  },
  ruleText: {
    fontSize: 22,
    marginBottom: 15,
    color: '#333',
    lineHeight: 30,
  },
  logScrollView: {
    width: '100%',
    flex: 1,
    marginBottom: 15,
  },
  logText: {
    fontSize: 20,
    marginBottom: 10,
    color: '#333',
    lineHeight: 26,
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
    fontSize: 22,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  gameModeDescription: {
    fontSize: 20,
    color: '#666',
    lineHeight: 26,
  },
  optionsButtonInInfoBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 10,
    marginRight: 10,
  },
  optionsButtonTextInInfoBar: {
    color: '#fff',
    fontSize: 16,
  },
  optionMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionMenuContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    width: '60%',
    alignItems: 'stretch',
  },
  optionMenuItem: {
    backgroundColor: '#4a90e2',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  optionMenuItemText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});