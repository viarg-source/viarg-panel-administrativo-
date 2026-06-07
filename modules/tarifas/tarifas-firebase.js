// tarifas-firebase.js — capa de acceso a Firestore para el módulo de Tarifas

const TF_CONFIG_LS = 'viarg_tf_config';
const TF_SERVICIOS_LS = 'viarg_tf_servicios';

async function tfFbGetConfig() {
  try {
    if (!window._tfGetConfig) throw new Error('no fb');
    const d = await window._tfGetConfig();
    if (d) { try { localStorage.setItem(TF_CONFIG_LS, JSON.stringify(d)); } catch(e) {} }
    return d;
  } catch(e) {
    try { const c = localStorage.getItem(TF_CONFIG_LS); return c ? JSON.parse(c) : null; } catch(e2) { return null; }
  }
}

async function tfFbSetConfig(data) {
  if (!window._tfSetConfig) throw new Error('Firebase no disponible');
  await window._tfSetConfig(data);
  try { localStorage.setItem(TF_CONFIG_LS, JSON.stringify(data)); } catch(e) {}
}

async function tfFbGetServicios() {
  try {
    if (!window._tfGetServicios) throw new Error('no fb');
    const arr = await window._tfGetServicios();
    if (arr && arr.length) { try { localStorage.setItem(TF_SERVICIOS_LS, JSON.stringify(arr)); } catch(e) {} }
    return arr || [];
  } catch(e) {
    try { const c = localStorage.getItem(TF_SERVICIOS_LS); return c ? JSON.parse(c) : []; } catch(e2) { return []; }
  }
}

async function tfFbSetServicio(id, data) {
  if (!window._tfSetServicio) throw new Error('Firebase no disponible');
  await window._tfSetServicio(id, data);
  try {
    const c = localStorage.getItem(TF_SERVICIOS_LS);
    const arr = c ? JSON.parse(c) : [];
    if (data === null || data === undefined) {
      // Eliminar del localStorage
      localStorage.setItem(TF_SERVICIOS_LS, JSON.stringify(arr.filter(s => s.id !== id)));
    } else {
      const i = arr.findIndex(s => s.id === id);
      const obj = { ...data, id };
      if (i >= 0) arr[i] = obj; else arr.push(obj);
      localStorage.setItem(TF_SERVICIOS_LS, JSON.stringify(arr));
    }
  } catch(e) {}
}

async function tfFbDeleteServicio(id) {
  return tfFbSetServicio(id, null);
}
