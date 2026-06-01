// tarifas-seed.js — datos iniciales para poblar Firestore
// Ejecutar UNA SOLA VEZ desde la consola del browser: tarifasSeedAll()

const TF_SEED_CONFIG = {
  tipoCambio: {
    blue_compra: 1410,
    mep: 1435,
    real: 270,
    sturla: 1415,
    fuente: 'manual',
    actualizadoEn: null
  }
};

// Helper to build pax rows
function _rows(list) {
  return list.map(r => ({
    pax: r.pax, usd: r.usd, comisionUsd: r.com, tarifaGuiaUsd: r.guia,
    costoPaseoArs: r.paseo, costoTransporteArs: r.transp || 0
  }));
}

const TF_SEED_SERVICIOS = [
  {
    id: 'city_tigre',
    nombre: 'City + Tigre',
    duracionHs: 9,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:205,com:10,guia:90,paseo:15700},
        {pax:2,usd:260,com:20,guia:110,paseo:31400},
        {pax:3,usd:310,com:25,guia:110,paseo:47100},
        {pax:4,usd:360,com:30,guia:110,paseo:62800},
        {pax:5,usd:415,com:35,guia:110,paseo:78500},
        {pax:6,usd:460,com:40,guia:110,paseo:94200},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:795,com:40,guia:150,paseo:101500,transp:450000},
        {pax:8, usd:840,com:42,guia:150,paseo:116000,transp:450000},
        {pax:9, usd:880,com:44,guia:150,paseo:130500,transp:450000},
        {pax:10,usd:915,com:46,guia:150,paseo:145000,transp:450000},
        {pax:11,usd:950,com:48,guia:150,paseo:159500,transp:450000},
        {pax:12,usd:980,com:49,guia:150,paseo:174000,transp:450000},
      ])},
      minibus: { activo: true, tarifas: _rows([
        {pax:19,usd:1590,com:80,guia:200,paseo:275500,transp:450000},
        {pax:20,usd:1640,com:82,guia:200,paseo:290000,transp:450000},
        {pax:21,usd:1700,com:85,guia:200,paseo:304500,transp:450000},
        {pax:22,usd:1760,com:88,guia:200,paseo:319000,transp:450000},
        {pax:23,usd:1820,com:91,guia:200,paseo:333500,transp:450000},
      ])}
    }
  },
  {
    id: 'full_day_ba',
    nombre: 'Full Day Buenos Aires',
    duracionHs: 8,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:180,com:10,guia:90,paseo:0},
        {pax:2,usd:220,com:18,guia:110,paseo:0},
        {pax:3,usd:270,com:22,guia:110,paseo:0},
        {pax:4,usd:320,com:26,guia:110,paseo:0},
        {pax:5,usd:365,com:30,guia:110,paseo:0},
        {pax:6,usd:410,com:34,guia:110,paseo:0},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:740,com:37,guia:150,paseo:0,transp:400000},
        {pax:8, usd:780,com:39,guia:150,paseo:0,transp:400000},
        {pax:9, usd:820,com:41,guia:150,paseo:0,transp:400000},
        {pax:10,usd:855,com:43,guia:150,paseo:0,transp:400000},
        {pax:11,usd:890,com:45,guia:150,paseo:0,transp:400000},
        {pax:12,usd:920,com:46,guia:150,paseo:0,transp:400000},
      ])},
      minibus: { activo: true, tarifas: _rows([
        {pax:19,usd:1480,com:74,guia:200,paseo:0,transp:400000},
        {pax:20,usd:1520,com:76,guia:200,paseo:0,transp:400000},
        {pax:21,usd:1570,com:79,guia:200,paseo:0,transp:400000},
        {pax:22,usd:1620,com:81,guia:200,paseo:0,transp:400000},
        {pax:23,usd:1670,com:84,guia:200,paseo:0,transp:400000},
      ])}
    }
  },
  {
    id: 'city_clasico',
    nombre: 'City Clásico',
    duracionHs: 4,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:110,com:8, guia:60,paseo:0},
        {pax:2,usd:145,com:12,guia:75,paseo:0},
        {pax:3,usd:175,com:15,guia:75,paseo:0},
        {pax:4,usd:210,com:18,guia:75,paseo:0},
        {pax:5,usd:240,com:20,guia:75,paseo:0},
        {pax:6,usd:270,com:22,guia:75,paseo:0},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:480,com:24,guia:100,paseo:0,transp:200000},
        {pax:8, usd:510,com:26,guia:100,paseo:0,transp:200000},
        {pax:9, usd:540,com:27,guia:100,paseo:0,transp:200000},
        {pax:10,usd:565,com:28,guia:100,paseo:0,transp:200000},
        {pax:11,usd:590,com:30,guia:100,paseo:0,transp:200000},
        {pax:12,usd:615,com:31,guia:100,paseo:0,transp:200000},
      ])},
      minibus: { activo: true, tarifas: _rows([
        {pax:19,usd:980,com:49,guia:150,paseo:0,transp:200000},
        {pax:20,usd:1010,com:51,guia:150,paseo:0,transp:200000},
        {pax:21,usd:1040,com:52,guia:150,paseo:0,transp:200000},
        {pax:22,usd:1070,com:54,guia:150,paseo:0,transp:200000},
        {pax:23,usd:1100,com:55,guia:150,paseo:0,transp:200000},
      ])}
    }
  },
  {
    id: 'city_night',
    nombre: 'City Night Tour',
    duracionHs: 3,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:95, com:8, guia:50,paseo:0},
        {pax:2,usd:130,com:11,guia:65,paseo:0},
        {pax:3,usd:165,com:14,guia:65,paseo:0},
        {pax:4,usd:195,com:16,guia:65,paseo:0},
        {pax:5,usd:225,com:18,guia:65,paseo:0},
        {pax:6,usd:255,com:20,guia:65,paseo:0},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:440,com:22,guia:90,paseo:0,transp:150000},
        {pax:8, usd:465,com:23,guia:90,paseo:0,transp:150000},
        {pax:9, usd:490,com:25,guia:90,paseo:0,transp:150000},
        {pax:10,usd:515,com:26,guia:90,paseo:0,transp:150000},
        {pax:11,usd:540,com:27,guia:90,paseo:0,transp:150000},
        {pax:12,usd:560,com:28,guia:90,paseo:0,transp:150000},
      ])},
      minibus: { activo: true, tarifas: _rows([
        {pax:19,usd:890,com:45,guia:130,paseo:0,transp:150000},
        {pax:20,usd:920,com:46,guia:130,paseo:0,transp:150000},
        {pax:21,usd:950,com:48,guia:130,paseo:0,transp:150000},
        {pax:22,usd:980,com:49,guia:130,paseo:0,transp:150000},
        {pax:23,usd:1010,com:51,guia:130,paseo:0,transp:150000},
      ])}
    }
  },
  {
    id: 'tango_porteno',
    nombre: 'Tango Porteño',
    duracionHs: 3,
    categoria: 'show',
    vehiculos: {},
    variantes: [
      {nombre:'Preferencial',usd:79, comisionUsd:8, tarifaGuiaUsd:0,costoPaseoArs:44000,costoTransporteArs:0},
      {nombre:'Platea',      usd:99, comisionUsd:10,tarifaGuiaUsd:0,costoPaseoArs:66000,costoTransporteArs:0},
      {nombre:'VIP',         usd:129,comisionUsd:15,tarifaGuiaUsd:0,costoPaseoArs:88000,costoTransporteArs:0},
    ]
  },
  {
    id: 'tour_estadios',
    nombre: 'Tour de Estadios',
    duracionHs: 5,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:165,com:10,guia:70,paseo:82000},
        {pax:2,usd:230,com:16,guia:85,paseo:164000},
        {pax:3,usd:295,com:20,guia:85,paseo:246000},
        {pax:4,usd:355,com:24,guia:85,paseo:328000},
        {pax:5,usd:415,com:28,guia:85,paseo:410000},
        {pax:6,usd:470,com:32,guia:85,paseo:492000},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:820,com:41,guia:120,paseo:574000,transp:250000},
        {pax:8, usd:880,com:44,guia:120,paseo:656000,transp:250000},
        {pax:9, usd:940,com:47,guia:120,paseo:738000,transp:250000},
        {pax:10,usd:995,com:50,guia:120,paseo:820000,transp:250000},
        {pax:11,usd:1050,com:53,guia:120,paseo:902000,transp:250000},
        {pax:12,usd:1100,com:55,guia:120,paseo:984000,transp:250000},
      ])},
      minibus: { activo: false, tarifas: [] }
    }
  },
  {
    id: 'fiesta_gaucha',
    nombre: 'Fiesta Gaucha',
    duracionHs: 8,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:175,com:10,guia:70,paseo:90000},
        {pax:2,usd:245,com:17,guia:85,paseo:180000},
        {pax:3,usd:305,com:21,guia:85,paseo:270000},
        {pax:4,usd:365,com:25,guia:85,paseo:360000},
        {pax:5,usd:425,com:29,guia:85,paseo:450000},
        {pax:6,usd:480,com:32,guia:85,paseo:540000},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:845,com:42,guia:120,paseo:630000,transp:400000},
        {pax:8, usd:900,com:45,guia:120,paseo:720000,transp:400000},
        {pax:9, usd:955,com:48,guia:120,paseo:810000,transp:400000},
        {pax:10,usd:1010,com:51,guia:120,paseo:900000,transp:400000},
        {pax:11,usd:1060,com:53,guia:120,paseo:990000,transp:400000},
        {pax:12,usd:1110,com:56,guia:120,paseo:1080000,transp:400000},
      ])},
      minibus: { activo: false, tarifas: [] }
    }
  },
  {
    id: 'uruguay',
    nombre: 'Uruguay',
    duracionHs: 10,
    categoria: 'tour',
    vehiculos: {},
    variantes: [
      {nombre:'Colonia Express',          usd:185,comisionUsd:12,tarifaGuiaUsd:80,costoPaseoArs:0,costoTransporteArs:0},
      {nombre:'Colonia + Punto Turístico',usd:225,comisionUsd:15,tarifaGuiaUsd:90,costoPaseoArs:0,costoTransporteArs:0},
      {nombre:'Montevideo (día)',          usd:295,comisionUsd:18,tarifaGuiaUsd:110,costoPaseoArs:0,costoTransporteArs:0},
      {nombre:'Wine Experience',          usd:345,comisionUsd:20,tarifaGuiaUsd:110,costoPaseoArs:0,costoTransporteArs:0},
    ]
  },
  {
    id: 'campanopolis',
    nombre: 'Campanopolis',
    duracionHs: 6,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:135,com:8, guia:60,paseo:20000},
        {pax:2,usd:185,com:13,guia:75,paseo:40000},
        {pax:3,usd:230,com:16,guia:75,paseo:60000},
        {pax:4,usd:275,com:19,guia:75,paseo:80000},
        {pax:5,usd:315,com:22,guia:75,paseo:100000},
        {pax:6,usd:355,com:24,guia:75,paseo:120000},
      ])},
      van: { activo: false, tarifas: [] },
      minibus: { activo: false, tarifas: [] }
    }
  },
  {
    id: 'bodega_gamboa',
    nombre: 'Bodega Gamboa',
    duracionHs: 8,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:290,com:15,guia:90,paseo:104755},
        {pax:2,usd:380,com:22,guia:110,paseo:209510},
        {pax:3,usd:465,com:27,guia:110,paseo:314265},
        {pax:4,usd:545,com:32,guia:110,paseo:419020},
        {pax:5,usd:625,com:37,guia:110,paseo:523775},
        {pax:6,usd:700,com:42,guia:110,paseo:628530},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:1210,com:61,guia:150,paseo:733285,transp:589000},
        {pax:8, usd:1280,com:64,guia:150,paseo:838040,transp:589000},
        {pax:9, usd:1345,com:67,guia:150,paseo:942795,transp:589000},
        {pax:10,usd:1410,com:71,guia:150,paseo:1047550,transp:589000},
        {pax:11,usd:1475,com:74,guia:150,paseo:1152305,transp:589000},
        {pax:12,usd:1540,com:77,guia:150,paseo:1257060,transp:589000},
      ])},
      minibus: { activo: false, tarifas: [] }
    }
  },
  {
    id: 'delta_tigre_premium',
    nombre: 'Delta Tigre Premium',
    duracionHs: 5,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:175,com:10,guia:70,paseo:39000},
        {pax:2,usd:235,com:16,guia:85,paseo:78000},
        {pax:3,usd:290,com:20,guia:85,paseo:117000},
        {pax:4,usd:345,com:23,guia:85,paseo:156000},
        {pax:5,usd:395,com:27,guia:85,paseo:195000},
        {pax:6,usd:445,com:30,guia:85,paseo:234000},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:775,com:39,guia:120,paseo:273000,transp:250000},
        {pax:8, usd:820,com:41,guia:120,paseo:312000,transp:250000},
        {pax:9, usd:865,com:43,guia:120,paseo:351000,transp:250000},
        {pax:10,usd:910,com:46,guia:120,paseo:390000,transp:250000},
        {pax:11,usd:955,com:48,guia:120,paseo:429000,transp:250000},
        {pax:12,usd:995,com:50,guia:120,paseo:468000,transp:250000},
      ])},
      minibus: { activo: false, tarifas: [] }
    }
  },
  {
    id: 'delta_tigre_nav',
    nombre: 'Delta Tigre Navegación',
    duracionHs: 4,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:145,com:8, guia:60,paseo:14500},
        {pax:2,usd:200,com:14,guia:75,paseo:29000},
        {pax:3,usd:250,com:17,guia:75,paseo:43500},
        {pax:4,usd:295,com:20,guia:75,paseo:58000},
        {pax:5,usd:340,com:23,guia:75,paseo:72500},
        {pax:6,usd:385,com:26,guia:75,paseo:87000},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:665,com:33,guia:100,paseo:101500,transp:200000},
        {pax:8, usd:710,com:36,guia:100,paseo:116000,transp:200000},
        {pax:9, usd:750,com:38,guia:100,paseo:130500,transp:200000},
        {pax:10,usd:790,com:40,guia:100,paseo:145000,transp:200000},
        {pax:11,usd:825,com:41,guia:100,paseo:159500,transp:200000},
        {pax:12,usd:860,com:43,guia:100,paseo:174000,transp:200000},
      ])},
      minibus: { activo: false, tarifas: [] }
    }
  },
  {
    id: 'temaiken',
    nombre: 'Temaiken',
    duracionHs: 6,
    categoria: 'tour',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:130,com:8, guia:60,paseo:34000},
        {pax:2,usd:185,com:13,guia:75,paseo:68000},
        {pax:3,usd:235,com:16,guia:75,paseo:102000},
        {pax:4,usd:280,com:19,guia:75,paseo:136000},
        {pax:5,usd:325,com:22,guia:75,paseo:170000},
        {pax:6,usd:365,com:24,guia:75,paseo:204000},
      ])},
      van: { activo: false, tarifas: [] },
      minibus: { activo: false, tarifas: [] }
    }
  },
  {
    id: 'transfer_eze',
    nombre: 'Transfer Ezeiza',
    duracionHs: 2,
    categoria: 'transfer',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:55, com:5,guia:0,paseo:0,transp:157000},
        {pax:2,usd:60, com:5,guia:0,paseo:0,transp:157000},
        {pax:3,usd:65, com:5,guia:0,paseo:0,transp:157000},
        {pax:4,usd:70, com:6,guia:0,paseo:0,transp:157000},
        {pax:5,usd:75, com:6,guia:0,paseo:0,transp:157000},
        {pax:6,usd:80, com:7,guia:0,paseo:0,transp:157000},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:175,com:9, guia:0,paseo:0,transp:157000},
        {pax:8, usd:185,com:9, guia:0,paseo:0,transp:157000},
        {pax:9, usd:195,com:10,guia:0,paseo:0,transp:157000},
        {pax:10,usd:205,com:10,guia:0,paseo:0,transp:157000},
        {pax:11,usd:215,com:11,guia:0,paseo:0,transp:157000},
        {pax:12,usd:225,com:11,guia:0,paseo:0,transp:157000},
      ])},
      minibus: { activo: false, tarifas: [] }
    }
  },
  {
    id: 'transfer_aep',
    nombre: 'Transfer Aeroparque',
    duracionHs: 1,
    categoria: 'transfer',
    vehiculos: {
      auto: { activo: true, tarifas: _rows([
        {pax:1,usd:40, com:4,guia:0,paseo:0,transp:113000},
        {pax:2,usd:45, com:4,guia:0,paseo:0,transp:113000},
        {pax:3,usd:50, com:5,guia:0,paseo:0,transp:113000},
        {pax:4,usd:55, com:5,guia:0,paseo:0,transp:113000},
        {pax:5,usd:60, com:5,guia:0,paseo:0,transp:113000},
        {pax:6,usd:65, com:6,guia:0,paseo:0,transp:113000},
      ])},
      van: { activo: true, tarifas: _rows([
        {pax:7, usd:140,com:7,guia:0,paseo:0,transp:113000},
        {pax:8, usd:150,com:8,guia:0,paseo:0,transp:113000},
        {pax:9, usd:158,com:8,guia:0,paseo:0,transp:113000},
        {pax:10,usd:166,com:8,guia:0,paseo:0,transp:113000},
        {pax:11,usd:174,com:9,guia:0,paseo:0,transp:113000},
        {pax:12,usd:182,com:9,guia:0,paseo:0,transp:113000},
      ])},
      minibus: { activo: false, tarifas: [] }
    }
  },
  {
    id: 'transfer_eze_minibus',
    nombre: 'Transfer Ezeiza MiniBus24',
    duracionHs: 2,
    categoria: 'transfer',
    vehiculos: {
      auto: { activo: false, tarifas: [] },
      van: { activo: false, tarifas: [] },
      minibus: { activo: true, tarifas: _rows([
        {pax:19,usd:590,com:30,guia:0,paseo:0,transp:211000},
        {pax:20,usd:610,com:31,guia:0,paseo:0,transp:211000},
        {pax:21,usd:630,com:32,guia:0,paseo:0,transp:211000},
        {pax:22,usd:650,com:33,guia:0,paseo:0,transp:211000},
        {pax:23,usd:670,com:34,guia:0,paseo:0,transp:211000},
      ])}
    }
  },
];

async function tarifasSeedAll() {
  if (!window._tfSetConfig || !window._tfSetServicio) {
    console.error('Firebase no disponible. Abrí el panel e intentá de nuevo.');
    return;
  }
  console.log('Seeding tarifas_config...');
  await window._tfSetConfig(TF_SEED_CONFIG);
  console.log('Seeding tarifas_servicios (' + TF_SEED_SERVICIOS.length + ' servicios)...');
  for (const s of TF_SEED_SERVICIOS) {
    const { id, ...data } = s;
    await window._tfSetServicio(id, data);
    console.log('  ok', s.nombre);
  }
  console.log('Seed completo. Recargá el módulo de Tarifas.');
}
