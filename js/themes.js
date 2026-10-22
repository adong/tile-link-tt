/* TT Tile Link: the pictures on the tiles, four sets. Each tile is [emoji, English name, 中文 word, 中文 label]. The
   toast for a pair you link says the name in the language you're playing in. In 中文 mode the zodiac and 中国 tiles
   also carry their label small at the top, the way mahjong tiles carry a character (the label is the word unless a
   fourth entry gives a shorter one: the zodiac's single characters).
   The zodiac is in its real order (rat first, pig last). 中国 things: festivals, food and everyday things. */
(function () {
  'use strict';
  const TL = (window.TL = window.TL || {});
  TL.THEMES = {
    zodiac: {
      icon: '🐲', name: 'ZODIAC', accent: '#d8322a', label: true,
      tiles: [['🐭', 'RAT', '老鼠', '鼠'], ['🐮', 'OX', '牛', '牛'], ['🐯', 'TIGER', '老虎', '虎'], ['🐰', 'RABBIT', '兔子', '兔'], ['🐲', 'DRAGON', '龙', '龙'],
        ['🐍', 'SNAKE', '蛇', '蛇'], ['🐴', 'HORSE', '马', '马'], ['🐑', 'GOAT', '羊', '羊'], ['🐵', 'MONKEY', '猴子', '猴'], ['🐔', 'ROOSTER', '公鸡', '鸡'],
        ['🐶', 'DOG', '狗', '狗'], ['🐷', 'PIG', '猪', '猪']],
    },
    china: {
      icon: '🏮', name: 'CHINA', accent: '#c9a227', label: true,
      tiles: [['🏮', 'LANTERN', '灯笼'], ['🧧', 'RED ENVELOPE', '红包'], ['🥟', 'DUMPLINGS', '饺子'], ['🐼', 'PANDA', '熊猫'], ['🥢', 'CHOPSTICKS', '筷子'],
        ['🍵', 'TEA', '茶'], ['🧨', 'FIRECRACKER', '鞭炮'], ['🀄', 'MAHJONG', '麻将'], ['🍜', 'NOODLES', '面条'], ['🥮', 'MOONCAKE', '月饼'],
        ['🪁', 'KITE', '风筝'], ['🧋', 'BUBBLE TEA', '奶茶'], ['🍚', 'RICE', '米饭'], ['🎆', 'FIREWORKS', '烟花'], ['🍊', 'MANDARIN', '橘子'],
        ['🪭', 'FAN', '扇子'], ['🫖', 'TEAPOT', '茶壶'], ['🐟', 'FISH', '鱼'], ['🌕', 'FULL MOON', '月亮'], ['🐉', 'DRAGON', '龙']],
    },
    fruit: {
      icon: '🍓', name: 'FRUIT', accent: '#3fa34d',
      tiles: [['🍎', 'APPLE', '苹果'], ['🍌', 'BANANA', '香蕉'], ['🍇', 'GRAPES', '葡萄'], ['🍓', 'STRAWBERRY', '草莓'], ['🍉', 'WATERMELON', '西瓜'],
        ['🍊', 'ORANGE', '橙子'], ['🍋', 'LEMON', '柠檬'], ['🍑', 'PEACH', '桃子'], ['🍒', 'CHERRIES', '樱桃'], ['🍍', 'PINEAPPLE', '菠萝'],
        ['🥝', 'KIWI', '猕猴桃'], ['🥭', 'MANGO', '芒果'], ['🍐', 'PEAR', '梨'], ['🫐', 'BLUEBERRIES', '蓝莓'], ['🥥', 'COCONUT', '椰子'],
        ['🍈', 'MELON', '甜瓜'], ['🍅', 'TOMATO', '西红柿'], ['🥑', 'AVOCADO', '牛油果'], ['🍏', 'GREEN APPLE', '青苹果'], ['🌽', 'CORN', '玉米']],
    },
    animals: {
      icon: '🐼', name: 'ANIMALS', accent: '#2f7cf0',
      tiles: [['🐶', 'DOG', '小狗'], ['🐱', 'CAT', '小猫'], ['🐼', 'PANDA', '熊猫'], ['🐨', 'KOALA', '考拉'], ['🦁', 'LION', '狮子'],
        ['🐸', 'FROG', '青蛙'], ['🐧', 'PENGUIN', '企鹅'], ['🦒', 'GIRAFFE', '长颈鹿'], ['🐘', 'ELEPHANT', '大象'], ['🦓', 'ZEBRA', '斑马'],
        ['🐢', 'TURTLE', '乌龟'], ['🐬', 'DOLPHIN', '海豚'], ['🦉', 'OWL', '猫头鹰'], ['🐙', 'OCTOPUS', '章鱼'], ['🦊', 'FOX', '狐狸'],
        ['🐻', 'BEAR', '小熊'], ['🐷', 'PIG', '小猪'], ['🐵', 'MONKEY', '猴子'], ['🐥', 'CHICK', '小鸡'], ['🦋', 'BUTTERFLY', '蝴蝶']],
    },
  };
  TL.THEME_ORDER = ['zodiac', 'china', 'fruit', 'animals'];
})();
