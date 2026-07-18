const address = '北京市昌平区风雅园一区 15 号楼 1 单元 303';

export const eventDetails = {
  title: '周六来家里吃面吧！',
  date: '2026-07-18',
  dateDisplay: '2026.07.18 周六',
  generalArrival: '15:00–16:00',
  nativeArrival: '17:00 特别登场',
  address,
  mapQuery: address,
  mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
};

export const characters = [
  {
    id: 'noodle-cat',
    name: '炸酱面主理人',
    role: 'guest',
    arrival: '15:00–16:00',
    image: 'assets/characters/noodle-cat.svg',
    accent: '#F5C84C',
  },
  {
    id: 'product-bear',
    name: 'AI Builder、产品负责人',
    role: 'guest',
    arrival: '15:00–16:00',
    image: 'assets/characters/product-bear.svg',
    accent: '#F5B8C1',
  },
  {
    id: 'native-ghosts',
    name: 'AI Native 连续创业者',
    role: 'guest',
    arrival: '17:00 特别登场',
    image: 'assets/characters/native-ghosts.svg',
    accent: '#83A95C',
  },
  {
    id: 'ops-fluffy',
    name: 'AI 运营负责人',
    role: 'guest',
    arrival: '15:00–16:00',
    image: 'assets/characters/ops-fluffy.svg',
    accent: '#E85D4A',
  },
  {
    id: 'blogger-dog',
    name: '小红书千粉博主',
    role: 'host',
    arrival: '已就位 ✓',
    image: 'assets/characters/blogger-dog.svg',
    accent: '#663C2A',
  },
  {
    id: 'home-chef',
    name: '家庭煮夫',
    role: 'host',
    arrival: '已就位 ✓',
    image: 'assets/characters/home-chef.svg',
    accent: '#E98A51',
  },
];

export const parts = [
  {
    id: 'part-01',
    number: '01',
    title: '到家集合',
    teaser: '放下包包，先随便坐！',
    stamp: '顺利会师',
  },
  {
    id: 'part-02',
    number: '02',
    title: '龙哥开饭',
    teaser: '今日主角：龙哥牌炸酱面',
    stamp: '香迷糊了',
  },
  {
    id: 'part-03',
    number: '03',
    title: '咔嚓留念',
    teaser: '吃面不拍照，等于没吃到！',
    stamp: '今日份回忆',
  },
  {
    id: 'part-04',
    number: '04',
    title: '水果时间',
    teaser: '饭后水果，给胃留个甜甜的结尾。',
    stamp: '水果自由',
  },
  {
    id: 'part-05',
    number: '05',
    title: '麦克风时间',
    teaser: '吐槽大会 × 家庭脱口秀',
    stamp: '全场最佳',
  },
  {
    id: 'part-06',
    number: '06',
    title: '快乐散场',
    teaser: '吃饱了，也笑累了。',
    stamp: '平安到家',
  },
];

export const micLines = [
  '这个可以说吗？',
  '展开讲讲！',
  '今天不许端水！',
  '掌声在哪里？',
  '刚才那段掐了别播！',
];
