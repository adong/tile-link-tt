/* 中文 for TT Tile Link (连连看): the words on the page, the toasts, the story card and the ? panel (Kit.lang, from
   kit/lang.js). Simple words: Tommy is 5. 连连看 is the game, 配对 a pair, 转弯 a turn, 洗牌 a shuffle. The kids' and the
   friends' names and the game's own name stay English. The toast for a linked pair is made in the right language by
   js/game.js (each picture's 中文 word is in js/themes.js). */
(function () {
  'use strict';
  const L = Kit.lang;
  L.keep(['TT Tile Link', 'TT', 'Tile Link', 'TT Tile Link · Teddy & Tommy', 'TEDDY', 'TOMMY', 'FOXY', 'FROGGY', 'TEDDY & TOMMY',
    'Teddy & Tommy', 'Teddy', 'Tommy', 'Foxy', 'Froggy', 'Esc', 'Enter', 'Space', 'X', 'T', 'R', 'B', 'W', 'L', 'M', 'P', 'GO!', '1', '2', '3']);
  const TREATS = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };

  L.add({
    // the menu
    'MATCH TWO TILES. JOIN THEM WITH TWO TURNS OR LESS!': '连连看！一样的两张牌，用最多转两个弯的线连起来！',
    PLAY: '开始', Play: '开始', 'Play (Enter)': '开始 (Enter)',
    'Who plays': '谁来玩', '1 PLAYER': '单人', '1 player (1)': '单人 (1)', 'Race a friend (2)': '和朋友比赛 (2)',
    '2 PLAYERS': '双人', '2 players (3)': '双人 (3)', 'Who are you?': '你是谁？', 'Teddy (W)': 'Teddy (W)', 'Tommy (W)': 'Tommy (W)',
    Level: '难度', EASY: '简单', NORMAL: '普通', 'Easy (L)': '简单 (L)', 'Normal (L)': '普通 (L)',
    Tiles: '牌', 'Zodiac animals': '十二生肖', China: '中国', Fruit: '水果', Animals: '动物',
    ZODIAC: '十二生肖', CHINA: '中国', FRUIT: '水果', ANIMALS: '动物',
    'An easier level': '简单一关', 'A harder level': '难一关', 'The story': '故事', 'The story (B)': '故事 (B)',
    // playing
    Pause: '暂停', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    LEVEL: '关卡', 'PAIRS LEFT': '还剩几对', SCORE: '分数', BEST: '最好',
    'Shuffle (X)': '洗牌 (X)', 'Shuffle the tiles': '洗牌',
    'Call your brother': '叫兄弟来帮忙', 'Call your brother (T)': '叫兄弟来帮忙 (T)', 'High five!': '击掌！', 'High five! (T)': '击掌！(T)',
    'HIGH FIVE! 🙌': '击掌！🙌', 'LINK THE PAIRS!': '找配对，连起来！', 'TOO MANY TURNS!': '转弯太多啦！', 'SHUFFLE!': '洗牌！',
    'NO PAIRS LEFT! SHUFFLE!': '没有能连的啦，洗牌！', "TIME'S UP!": '时间到！', 'WOW!': '哇！',
    // the end, pause
    'NEW BEST!': '新纪录！', 'THE CLOCK GETS A SECOND BACK FOR EVERY PAIR!': '每连上一对，时间就多一秒！',
    Home: '主页', 'Next level': '下一关', 'NEXT LEVEL': '下一关', 'Play again': '再玩一次', 'PLAY AGAIN': '再玩一次', 'TRY AGAIN': '再试一次',
    'Keep playing': '继续玩', 'Start again': '重新开始',
    // the story
    'TILES FROM CHINA': '连连看和中国', 'Back a page': '上一页', 'Next page': '下一页', 'Close the story': '关上故事',
    'In China this game is called Lianliankan: "link, link, look!" Find two tiles that match and join them with a line. The line may turn two times at most.':
      '这个游戏叫"连连看"！找到两张一样的牌，用一条线把它们连起来。这条线最多只能转两个弯。',
    'The tiles look like mahjong tiles. At holidays, families in China often play mahjong together round one table while the kids watch and cheer. Click, clack!':
      '这些牌长得像麻将牌。过节的时候，中国的一家人常常围着一张桌子打麻将，小朋友在旁边看热闹。噼里啪啦！',
    'Every year in China has an animal. Twelve take turns: rat, ox, tiger, rabbit, dragon, snake, horse, goat, monkey, rooster, dog and pig. 2026 is the Year of the Horse 🐴!':
      '在中国，每一年都有一个属相。十二种动物轮流来：鼠、牛、虎、兔、龙、蛇、马、羊、猴、鸡、狗、猪。2026 年是马年 🐴！',
    'Red lanterns glow at the Lantern Festival. Red envelopes bring lucky money at Spring Festival. Round mooncakes are for the round full moon at the Mid-Autumn Festival.':
      '元宵节挂起红红的灯笼，春节收到装着压岁钱的红包，中秋节吃圆圆的月饼，看圆圆的月亮。',
    // the ? panel
    'pick a tile, then its partner': '先点一张牌，再点和它一样的牌', 'shuffle the tiles': '洗牌',
    'call your brother (2 players: high five)': '叫兄弟来帮忙（双人：击掌）', 'this level again': '这一关重来',
    '2 players: Teddy · Tommy': '双人：Teddy · Tommy', 'menu: play · the story': '菜单：开始 · 故事',
    'menu: 1 player · race · 2 players': '菜单：单人 · 比赛 · 双人', 'menu: Teddy or Tommy · level': '菜单：Teddy 或 Tommy · 难度',
    'menu: the tiles · the starting level': '菜单：选牌 · 从第几关开始',
    'Find two tiles that match. Join them with a line that turns two times at most, through empty spaces or round the outside of the board. Clear every tile!':
      '找到两张一样的牌，用一条线连起来。线只能走空的地方，也可以绕到牌外面，最多转两个弯。把牌全部消完！',
    "Tap a tile, then its partner. 🔀 mixes the tiles. Tap your brother's face (bottom right) and he shows you a pair.":
      '点一张牌，再点和它一样的牌。🔀 是洗牌。点右下角兄弟的脸，他会告诉你一对能连的牌。',
  });

  // text with names and numbers in it
  L.rule(/^RACE (\S+)$/, '和 $1 比赛');
  L.rule(/^LEVEL (\d+)$/, '第 $1 关');
  L.rule(/^LEVEL (\d+) CLEAR!$/, '第 $1 关过关啦！');
  L.rule(/^(\d+) IN A ROW!$/, '连续 $1 对！');
  L.rule(/^SCORE (\d+)$/, '分数 $1');
  L.rule(/^BONUS \+(\d+)$/, '奖励 +$1');
  L.rule(/^BEST: (\d+)$/, '最好成绩：$1');
  L.rule(/^PAIRS LEFT: (\d+)$/, '还剩 $1 对');
  L.rule(/^(\S+) WINS!$/, '$1 赢啦！');
  L.rule(/^GAMES WON: (\S+) (\d+) · (\S+) (\d+)$/, '赢的局数：$1 $2 · $3 $4');
  L.rule(/^(\S+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (\S+)!$/, (m, e, item, who) => `${e} ${who} 送来的${TREATS[item]}！`);
  L.rule(/^(\S+) SAYS: LINK THESE (\S+)!$/, '$1 说：连这两个 $2！');
})();
