// tarifas.js — Módulo principal de Gestión de Tarifas y Netos
// Depende de: tarifas-calc.js, tarifas-firebase.js (cargados antes como scripts)

let tfState = {
  config: null,
  servicios: [],
  activeVehiculo: 'auto',
  activeServicioId: null,
  dirty: {},       // { servicioId: true }
  blueSource: 'manual',
  loading: false,
  chart: null
};

let _tfGestionModal = { open: false, mode: 'add', svcId: null };

// ─── INIT ──────────────────────────────────────────────────────────────────

async function tfInit() {
  const root = document.getElementById('tf-root');
  if (!root) return;

  // 1. Carga inmediata desde localStorage — sin esperar Firebase
  const defaultCfg = { tipoCambio: { blue_compra: 1410, mep: 1435, real: 270, fuente: 'manual', actualizadoEn: null } };
  if (!tfState.config) {
    try { const c = localStorage.getItem('viarg_tf_config'); tfState.config = c ? JSON.parse(c) : defaultCfg; } catch(e) { tfState.config = defaultCfg; }
  }
  if (!tfState.servicios.length) {
    try { const s = localStorage.getItem('viarg_tf_servicios'); tfState.servicios = s ? JSON.parse(s) : []; } catch(e) { tfState.servicios = []; }
  }
  if (!tfState.activeServicioId && tfState.servicios.length > 0) {
    tfState.activeServicioId = tfState.servicios[0].id;
  }
  tfRender(); // renderiza INMEDIATAMENTE con datos locales

  // Fetch live rates on init
  tfFetchAllRates();
  setInterval(tfFetchAllRates, 15 * 60 * 1000);

  // 2. Luego actualiza desde Firebase en background
  try {
    const [config, servicios] = await Promise.race([
      Promise.all([tfFbGetConfig(), tfFbGetServicios()]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 7000))
    ]);
    let changed = false;
    if (config) { tfState.config = config; changed = true; }
    if (servicios && servicios.length) {
      tfState.servicios = servicios;
      if (!tfState.activeServicioId) tfState.activeServicioId = servicios[0]?.id || null;
      changed = true;
    }
    if (changed) tfRender();
  } catch(e) {
    // sin conexión — seguimos con datos locales
  }
}

// ─── SKELETON ──────────────────────────────────────────────────────────────

function tfRenderSkeleton() {
  return `<div style="padding:0">
    <div class="tf-skeleton" style="height:52px;margin-bottom:12px"></div>
    <div class="tf-skeleton" style="height:36px;margin-bottom:16px"></div>
    <div class="tf-skeleton" style="height:28px;margin-bottom:8px"></div>
    <div class="tf-skeleton" style="height:28px;margin-bottom:8px"></div>
    <div class="tf-skeleton" style="height:28px;margin-bottom:8px"></div>
    <div class="tf-skeleton" style="height:28px;margin-bottom:8px"></div>
    <div class="tf-skeleton" style="height:28px;margin-bottom:8px"></div>
  </div>`;
}

// ─── MAIN RENDER ───────────────────────────────────────────────────────────

function tfRender() {
  const root = document.getElementById('tf-root');
  if (!root) return;
  try { _tfRenderInner(root); } catch(e) {
    root.innerHTML = `<div style="padding:24px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);border-radius:12px;color:var(--red,#ef4444);font-family:'Outfit',sans-serif">
      <div style="font-size:16px;font-weight:800;margin-bottom:8px">⚠ Error al renderizar Tarifas</div>
      <div style="font-size:12px;font-family:monospace;opacity:.8">${e.message}</div>
      <button onclick="tfInit()" style="margin-top:12px;background:#2BBCCC;color:#060F1E;border:none;padding:8px 18px;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif">Reintentar</button>
    </div>`;
  }
}
function _tfRenderInner(root) {
  const tc = (tfState.config && tfState.config.tipoCambio) || {};

  // Determine active tab
  const tabs = ['tarifas', 'dashboard'];
  const activeTab = tfState.activeTab || 'tarifas';

  const tabBtn = (key, label) => `<button onclick="tfSetTab('${key}')" style="padding:7px 18px;border-radius:20px;border:1px solid var(--border);background:${activeTab===key?'var(--teal)':'var(--surface2)'};color:${activeTab===key?'#060F1E':'var(--text2)'};font-weight:700;font-size:13px;cursor:pointer;font-family:'Outfit',sans-serif">${label}</button>`;
  const showTCBar = activeTab === 'tarifas' || activeTab === 'dashboard';
  root.innerHTML = `
    <div style="margin-bottom:18px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${tabBtn('tarifas','Tarifas')}
        ${tabBtn('dashboard','Dashboard')}
        ${tabBtn('config','Configuración')}
        ${tabBtn('gestion','Gestión')}
      </div>
      <button onclick="tfExportExcel()" style="padding:7px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text2);font-weight:600;font-size:12px;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        Exportar XLSX
      </button>
    </div>
    ${showTCBar ? tfRenderTCBar(tc) : ''}
    ${activeTab === 'tarifas'   ? tfRenderTarifasTab(tc) :
      activeTab === 'dashboard' ? tfRenderDashboard(tfGetOrderedServicios(), tc) :
      activeTab === 'config'    ? tfRenderConfigTab() :
                                  tfRenderGestionTab()}
    ${tfRenderServiceModal()}
  `;

  // Re-init chart after render
  if (activeTab === 'dashboard') {
    setTimeout(() => tfInitChart(), 80);
  }
}

function tfSetTab(tab) {
  tfState.activeTab = tab;
  // destroy existing chart if switching away
  if (tab !== 'dashboard' && tfState.chart) {
    tfState.chart.destroy();
    tfState.chart = null;
  }
  tfRender();
}

// ─── TIPO DE CAMBIO BAR ────────────────────────────────────────────────────

function tfRenderTCBar(tc) {
  const src = tc.fuente === 'live' ? '<span class="tf-tc-live">LIVE</span>' : '<span class="tf-tc-manual">MANUAL</span>';
  const ts = tc.actualizadoEn ? new Date(tc.actualizadoEn).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}) : '';
  return `<div class="tf-tc-bar">
    <div class="tf-tc-card">
      <div class="tf-tc-label">Blue Compra ${src}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:14px;color:var(--text3);font-family:'JetBrains Mono',monospace;font-weight:700">$</span>
        <input type="number" class="tf-tc-input" id="tf-blue-input" value="${tc.blue_compra||1410}" oninput="tfOnTcEdit('blue_compra',this.value)" onblur="tfSaveTc()">
        ${ts ? `<span style="font-size:9px;color:var(--text3)">${ts}</span>` : ''}
      </div>
    </div>
    <div class="tf-tc-card">
      <div class="tf-tc-label">MEP ${src}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:14px;color:var(--text3);font-family:'JetBrains Mono',monospace;font-weight:700">$</span>
        <input type="number" class="tf-tc-input" value="${tc.mep||1435}" oninput="tfOnTcEdit('mep',this.value)" onblur="tfSaveTc()">
      </div>
    </div>
    <div class="tf-tc-card">
      <div class="tf-tc-label">Real BRL ${src}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:14px;color:var(--text3);font-family:'JetBrains Mono',monospace;font-weight:700">$</span>
        <input type="number" class="tf-tc-input" value="${tc.real||270}" oninput="tfOnTcEdit('real',this.value)" onblur="tfSaveTc()">
      </div>
    </div>
    <div class="tf-tc-card" style="display:flex;align-items:center;justify-content:center;min-width:auto;flex:0 0 auto">
      <button id="tf-blue-refresh" onclick="tfFetchAllRates()" style="padding:8px 14px;border-radius:8px;background:rgba(43,188,204,0.12);color:var(--teal);border:1px solid rgba(43,188,204,0.3);font-size:12px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;gap:6px;white-space:nowrap">
        <span id="tf-blue-refresh-icon">&#8635;</span> Actualizar
      </button>
    </div>
  </div>`;
}

// ─── TARIFAS TAB ───────────────────────────────────────────────────────────

function tfRenderTarifasTab(tc) {
  const servicios = tfGetOrderedServicios();
  if (!servicios.length) {
    return `<div style="text-align:center;padding:48px 0;color:var(--text3)">
      <div style="font-size:36px;margin-bottom:12px">📋</div>
      <div style="font-size:15px;font-weight:600">No hay servicios cargados</div>
      <div style="font-size:12px;margin-top:6px">Ejecutá <code style="background:var(--surface2);padding:2px 6px;border-radius:4px">tarifasSeedAll()</code> en la consola del browser para poblar los datos iniciales.</div>
    </div>`;
  }

  const activeId = tfState.activeServicioId;
  const servicio = servicios.find(s => s.id === activeId) || servicios[0];

  return `<div style="display:grid;grid-template-columns:190px 1fr;gap:12px;align-items:start">
    ${tfRenderServiceSidebar(servicios)}
    <div>
      ${tfRenderVehiculoTabs(servicio)}
      ${tfRenderTableSection(servicio, tc)}
    </div>
  </div>`;
}

// ─── SERVICE SIDEBAR ───────────────────────────────────────────────────────

function tfRenderServiceSidebar(servicios) {
  const catLabels = tfGetCatLabels();
  const cats = Object.keys(catLabels);
  let html = '';
  cats.forEach(cat => {
    const items = servicios.filter(s => s.categoria === cat);
    if (!items.length) return;
    html += `<div style="margin-bottom:10px">
      <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;padding:0 8px;margin-bottom:3px">${catLabels[cat]}</div>
      ${items.map(s => {
        const active = s.id === tfState.activeServicioId;
        return `<button onclick="tfSelectServicio('${s.id}')"
          style="display:block;width:100%;text-align:left;padding:7px 10px;border-radius:7px;border:none;
            background:${active?'var(--teal)':'transparent'};
            color:${active?'#060F1E':'var(--text2)'};
            font-size:12px;font-weight:${active?'700':'500'};cursor:pointer;font-family:'Outfit',sans-serif;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            margin-bottom:1px;transition:background .12s,color .12s">
          ${s.nombre}
        </button>`;
      }).join('')}
    </div>`;
  });
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 6px;position:sticky;top:8px">${html}</div>`;
}

function tfSelectServicio(id) {
  tfState.activeServicioId = id;
  // Reset to first active vehiculo for this service
  const s = tfState.servicios.find(x => x.id === id);
  if (s && s.vehiculos) {
    const vOrder = ['auto','van','minibus'];
    const firstActive = vOrder.find(v => s.vehiculos[v] && s.vehiculos[v].activo);
    if (firstActive) tfState.activeVehiculo = firstActive;
  }
  tfRender();
}

// ─── VEHICULO TABS ─────────────────────────────────────────────────────────

function tfRenderVehiculoTabs(servicio) {
  if (!servicio) return '';
  if (servicio.variantes && servicio.variantes.length && (!servicio.vehiculos || !Object.keys(servicio.vehiculos).length)) return '';

  const vOrder = ['auto','van','minibus'];
  const vLabels = { auto: 'Auto (1-6 pax)', van: 'Van (7-18 pax)', minibus: 'MiniBus (19-23 pax)' };
  const vIcons = { auto: '🚗', van: '🚐', minibus: '🚌' };

  return `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
    ${vOrder.map(v => {
      const isActive = servicio.vehiculos && servicio.vehiculos[v] && servicio.vehiculos[v].activo;
      const isCurrent = v === tfState.activeVehiculo;
      if (isActive) {
        return `<button onclick="tfSelectVehiculo('${v}')" style="padding:7px 16px;border-radius:20px;border:1px solid var(--border);background:${isCurrent?'var(--navy)':'var(--surface2)'};color:${isCurrent?'#fff':'var(--text2)'};font-weight:600;font-size:12px;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;gap:5px">${vIcons[v]} ${vLabels[v]}</button>`;
      } else {
        return `<button onclick="tfActivateTier('${servicio.id}','${v}')" title="Crear tier ${vLabels[v]}" style="padding:7px 16px;border-radius:20px;border:1px dashed rgba(43,188,204,0.35);background:transparent;color:rgba(43,188,204,0.5);font-weight:600;font-size:12px;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;gap:5px">+ ${vIcons[v]} ${vLabels[v]}</button>`;
      }
    }).join('')}
  </div>`;
}

function tfSelectVehiculo(v) {
  tfState.activeVehiculo = v;
  tfRender();
}

// ─── TICKET HELPER ─────────────────────────────────────────────────────────
// ticketEnabled (bool) controls ON/OFF; ticketARS stores the price.
// Falls back to ticketARS>0 for legacy data that lacks ticketEnabled.
function tfEffectiveTicket(svc) {
  const en = svc.ticketEnabled === true ||
             (svc.ticketEnabled === undefined && +svc.ticketARS > 0);
  return en ? (+svc.ticketARS || 0) : 0;
}
function tfIsTicketEnabled(svc) {
  return svc.ticketEnabled === true ||
         (svc.ticketEnabled === undefined && +svc.ticketARS > 0);
}

// ─── TABLE SECTION ─────────────────────────────────────────────────────────

function tfRenderTableSection(servicio, tc) {
  if (!servicio) return '';
  const isDirty = tfState.dirty[servicio.id];
  const saveBtn = `<button class="tf-save-btn${isDirty?'':' disabled'}" ${isDirty?'':'disabled'} onclick="tfSave('${servicio.id}')">Guardar cambios</button>`;

  // ── Ticket (managed in Configuración tab — only used for calculations here)
  const ticketARS = tfEffectiveTicket(servicio);

  // ── Ventas commission link selector
  const ventasServs = (typeof state !== 'undefined' ? (state?.ventas?.servicios || []) : []);
  const linkedId = servicio.ventasServiceId || '';
  const ventasLinkHtml = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:9px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
    <span style="font-size:11px;font-weight:700;color:var(--text3);white-space:nowrap">🔗 Comisión Ventas:</span>
    <select onchange="tfSetVentasLink('${servicio.id}',this.value)" style="font-size:11.5px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-family:'Outfit',sans-serif">
      <option value="">— Manual —</option>
      ${ventasServs.map(vs=>`<option value="${vs.id}"${linkedId===vs.id?' selected':''}>${vs.nombre}</option>`).join('')}
    </select>
    ${linkedId
      ? `<span style="font-size:11px;color:var(--teal);font-weight:600">✓ Vinculado · columna comisión automática</span>`
      : `<span style="font-size:11px;color:var(--text3)">Vinculá para usar la comisión configurada en Ventas</span>`}
  </div>`;

  // Variantes mode
  if (servicio.variantes && servicio.variantes.length) {
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px">
      <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:10px">${servicio.nombre} <span style="font-size:11px;font-weight:500;color:var(--text3);margin-left:6px">${servicio.duracionHs}hs</span></div>
      ${ventasLinkHtml}
      ${tfRenderVariantesTable(servicio, tc)}
      ${saveBtn}
    </div>`;
  }

  // Vehiculo mode
  const vehiculoData = servicio.vehiculos && servicio.vehiculos[tfState.activeVehiculo];
  const tierLabel = {auto:'Auto',van:'Van',minibus:'MiniBus'}[tfState.activeVehiculo] || tfState.activeVehiculo;
  if (!vehiculoData || !vehiculoData.activo) {
    return `<div style="text-align:center;padding:32px;color:var(--text3);background:var(--surface);border:1px solid var(--border);border-radius:12px">
      <div style="margin-bottom:12px">No hay tarifas para el tier <strong>${tierLabel}</strong>.</div>
      <button onclick="tfActivateTier('${servicio.id}','${tfState.activeVehiculo}')" style="background:rgba(43,188,204,0.12);color:var(--teal);border:1px solid rgba(43,188,204,0.3);padding:8px 22px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:'Outfit',sans-serif">+ Crear tier ${tierLabel}</button>
    </div>`;
  }

  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px">
    <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:10px">${servicio.nombre} <span style="font-size:11px;font-weight:500;color:var(--text3);margin-left:6px">${servicio.duracionHs}hs</span></div>
    ${ventasLinkHtml}
    ${tfRenderTable(servicio, tfState.activeVehiculo, tc)}
    ${saveBtn}
  </div>`;
}

// ─── ARS INPUT HELPER ──────────────────────────────────────────────────────
// Renders an editable integer ARS cell: formatted on display, raw on focus
function tfArsInput(sId, vKey, idx, field, val, w) {
  const raw = Math.round(+val || 0);
  const fmt = raw.toLocaleString('es-AR');
  return `<input type="text" class="tf-cell-edit" style="width:${w||88}px" value="${fmt}" data-raw="${raw}" onfocus="this.value=this.dataset.raw" onblur="this.value=parseInt(this.dataset.raw||0).toLocaleString('es-AR')" oninput="this.dataset.raw=this.value.replace(/\\./g,'');tfOnEditCell('${sId}','${vKey}',${idx},'${field}',this.dataset.raw)">`;
}

// ─── MAIN TABLE ────────────────────────────────────────────────────────────

function tfRenderTable(servicio, vehiculoKey, tc) {
  const vehiculoData = servicio.vehiculos[vehiculoKey];
  const addRowBtn = `<div style="margin-top:8px"><button onclick="tfAddRow('${servicio.id}','${vehiculoKey}')" style="display:flex;align-items:center;gap:6px;background:rgba(43,188,204,0.08);color:var(--teal);border:1px dashed rgba(43,188,204,0.3);border-radius:7px;padding:6px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif">+ Agregar fila de pax</button></div>`;
  if (!vehiculoData || !vehiculoData.tarifas || !vehiculoData.tarifas.length) {
    return `<div style="color:var(--text3);font-size:12px;padding:8px 0">Sin filas aún.</div>${addRowBtn}`;
  }
  const rows = vehiculoData.tarifas;
  const linked = servicio.ventasServiceId;
  const ticketARS = tfEffectiveTicket(servicio);

  const header = `<tr>
    <th style="text-align:center;width:72px">Pax</th>
    <th>USD</th><th>Reales BRL</th>
    <th>Comisión${linked?' 🔗':''}</th>
    <th>Tarifa Guía</th>
    <th>Costo Paseo ARS${ticketARS>0?' 🎫':''}</th>
    <th>Costo Transp. ARS</th>
    <th>Conversión</th>
    <th>Ganancia USD</th>
    <th>Margen %</th>
    <th>Gan. -10%</th>
    <th style="width:26px"></th>
  </tr>`;

  const trs = rows.map((row, idx) => {
    const ventasCom = linked ? tfGetVentasComision(linked, row.pax) : null;
    const paseoEfectivo = ticketARS > 0 ? ticketARS * (row.pax || 1) : row.costoPaseoArs;
    const rowCalc = {
      ...row,
      comisionUsd: ventasCom !== null ? ventasCom : row.comisionUsd,
      costoPaseoArs: paseoEfectivo
    };
    const calc = tarifasCalcRow(rowCalc, tc);
    const color = tarifasMargenColor(calc.margenPct, calc.gananciaUsd);
    const cls = `tf-margen-${color}`;
    const comCell = linked
      ? `<td class="tf-cell-calc" style="color:var(--teal);font-weight:700">${tfFmtUSD(ventasCom??0)} <span style="font-size:9px;opacity:.55">🔗</span></td>`
      : `<td><input type="number" class="tf-cell-edit" value="${row.comisionUsd}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'comisionUsd',this.value)"></td>`;
    const paseoCell = ticketARS > 0
      ? `<td class="tf-cell-calc" style="color:var(--teal);font-weight:700">${tfFmtARS(paseoEfectivo)} <span style="font-size:9px;opacity:.55">🎫</span></td>`
      : `<td>${tfArsInput(servicio.id, vehiculoKey, idx, 'costoPaseoArs', row.costoPaseoArs)}</td>`;
    return `<tr>
      <td style="text-align:center"><input type="number" class="tf-cell-edit" style="width:62px;text-align:center;font-weight:700" value="${row.pax}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'pax',this.value)"></td>
      <td><input type="number" class="tf-cell-edit" value="${row.usd}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'usd',this.value)"></td>
      <td class="tf-cell-calc">${tfFmtBRL(calc.precioReales)}</td>
      ${comCell}
      <td><input type="number" class="tf-cell-edit" value="${row.tarifaGuiaUsd}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'tarifaGuiaUsd',this.value)"></td>
      ${paseoCell}
      <td>${tfArsInput(servicio.id, vehiculoKey, idx, 'costoTransporteArs', row.costoTransporteArs)}</td>
      <td class="tf-cell-calc">${tfFmtUSD(calc.conversionUsd)}</td>
      <td><span class="${cls}">${tfFmtUSD(calc.gananciaUsd)}</span></td>
      <td><span class="${cls}">${tfFmtPct(calc.margenPct)}</span></td>
      <td class="tf-cell-calc" style="${calc.gananciaConDescuento<=0?'color:var(--red)':''}">${tfFmtUSD(calc.gananciaConDescuento)}</td>
      <td><button onclick="tfDelRow('${servicio.id}','${vehiculoKey}',${idx})" title="Eliminar fila" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 4px;opacity:.55">✕</button></td>
    </tr>`;
  }).join('');

  return `<div class="tf-table-wrap"><table class="tf-table"><thead>${header}</thead><tbody>${trs}</tbody></table></div>${addRowBtn}`;
}

// ─── VARIANTES TABLE ───────────────────────────────────────────────────────

function tfRenderVariantesTable(servicio, tc) {
  const variantes = servicio.variantes || [];
  const linked = servicio.ventasServiceId;
  const ticketARS = tfEffectiveTicket(servicio);

  const header = `<tr>
    <th style="text-align:left;width:130px">Variante</th>
    <th>USD</th><th>Reales BRL</th>
    <th>Comisión${linked?' 🔗':''}</th>
    <th>Tarifa Guía</th>
    <th>Costo Paseo ARS</th>
    <th>Costo Transp. ARS</th>
    <th>Conversión</th>
    <th>Ganancia USD</th>
    <th>Margen %</th>
    <th>Gan. -10%</th>
    <th style="width:26px"></th>
  </tr>`;

  const trs = variantes.map((row, idx) => {
    const ventasCom = linked ? tfGetVentasComision(linked, 1) : null;
    const paseoEfectivo = ticketARS > 0 ? ticketARS : row.costoPaseoArs;
    const rowCalc = {
      ...row,
      comisionUsd: ventasCom !== null ? ventasCom : row.comisionUsd,
      costoPaseoArs: paseoEfectivo
    };
    const calc = tarifasCalcRow(rowCalc, tc);
    const color = tarifasMargenColor(calc.margenPct, calc.gananciaUsd);
    const cls = `tf-margen-${color}`;
    const comCell = linked
      ? `<td class="tf-cell-calc" style="color:var(--teal);font-weight:700">${tfFmtUSD(ventasCom??0)} <span style="font-size:9px;opacity:.55">🔗</span></td>`
      : `<td><input type="number" class="tf-cell-edit" value="${row.comisionUsd}" oninput="tfOnEditCell('${servicio.id}','variante',${idx},'comisionUsd',this.value)"></td>`;
    const paseoCell = ticketARS > 0
      ? `<td class="tf-cell-calc" style="color:var(--teal);font-weight:700">${tfFmtARS(paseoEfectivo)} <span style="font-size:9px;opacity:.55">🎫</span></td>`
      : `<td>${tfArsInput(servicio.id, 'variante', idx, 'costoPaseoArs', row.costoPaseoArs)}</td>`;
    return `<tr>
      <td><input type="text" class="tf-cell-edit" style="text-align:left;width:120px;font-weight:600" value="${(row.nombre||'').replace(/"/g,'&quot;')}" oninput="tfOnEditVarianteName('${servicio.id}',${idx},this.value)"></td>
      <td><input type="number" class="tf-cell-edit" value="${row.usd}" oninput="tfOnEditCell('${servicio.id}','variante',${idx},'usd',this.value)"></td>
      <td class="tf-cell-calc">${tfFmtBRL(calc.precioReales)}</td>
      ${comCell}
      <td><input type="number" class="tf-cell-edit" value="${row.tarifaGuiaUsd}" oninput="tfOnEditCell('${servicio.id}','variante',${idx},'tarifaGuiaUsd',this.value)"></td>
      ${paseoCell}
      <td>${tfArsInput(servicio.id, 'variante', idx, 'costoTransporteArs', row.costoTransporteArs)}</td>
      <td class="tf-cell-calc">${tfFmtUSD(calc.conversionUsd)}</td>
      <td><span class="${cls}">${tfFmtUSD(calc.gananciaUsd)}</span></td>
      <td><span class="${cls}">${tfFmtPct(calc.margenPct)}</span></td>
      <td class="tf-cell-calc" style="${calc.gananciaConDescuento<=0?'color:var(--red)':''}">${tfFmtUSD(calc.gananciaConDescuento)}</td>
      <td><button onclick="tfDelVariante('${servicio.id}',${idx})" title="Eliminar variante" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 4px;opacity:.55">✕</button></td>
    </tr>`;
  }).join('');

  const addBtn = `<div style="margin-top:8px"><button onclick="tfAddVariante('${servicio.id}')" style="display:flex;align-items:center;gap:6px;background:rgba(43,188,204,0.08);color:var(--teal);border:1px dashed rgba(43,188,204,0.3);border-radius:7px;padding:6px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif">+ Agregar variante</button></div>`;
  return `<div class="tf-table-wrap"><table class="tf-table"><thead>${header}</thead><tbody>${trs}</tbody></table></div>${addBtn}`;
}

// ─── EDIT CELL ─────────────────────────────────────────────────────────────

function tfOnEditCell(servicioId, vehiculoOVariante, idx, campo, value) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s) return;
  const rawStr = String(value).replace(/\./g, '').replace(',', '.');
  const v = campo === 'pax' ? (parseInt(rawStr) || 0) : (parseFloat(rawStr) || 0);

  if (vehiculoOVariante === 'variante') {
    if (!s.variantes || !s.variantes[idx]) return;
    s.variantes[idx][campo] = v;
  } else {
    if (!s.vehiculos || !s.vehiculos[vehiculoOVariante] || !s.vehiculos[vehiculoOVariante].tarifas) return;
    s.vehiculos[vehiculoOVariante].tarifas[idx][campo] = v;
  }

  tfState.dirty[servicioId] = true;

  // Update save button state without full re-render
  const saveBtn = document.querySelector('.tf-save-btn');
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.classList.remove('disabled');
  }

  // Recalculate visible computed cells for the edited row
  tfRecalcRowDOM(servicioId, vehiculoOVariante, idx);
}

function tfRecalcRowDOM(servicioId, vehiculoOVariante, idx) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s) return;
  const tc = (tfState.config && tfState.config.tipoCambio) || {};

  let row;
  if (vehiculoOVariante === 'variante') {
    row = s.variantes && s.variantes[idx];
  } else {
    row = s.vehiculos && s.vehiculos[vehiculoOVariante] && s.vehiculos[vehiculoOVariante].tarifas && s.vehiculos[vehiculoOVariante].tarifas[idx];
  }
  if (!row) return;

  // Apply ticket and ventas commission overrides
  const ticketARS = tfEffectiveTicket(s);
  const ventasCom = s.ventasServiceId ? tfGetVentasComision(s.ventasServiceId, row.pax || 1) : null;
  const rowForCalc = {
    ...row,
    comisionUsd: ventasCom !== null ? ventasCom : row.comisionUsd,
    costoPaseoArs: ticketARS > 0 ? ticketARS * (row.pax || 1) : row.costoPaseoArs
  };
  const calc = tarifasCalcRow(rowForCalc, tc);
  const color = tarifasMargenColor(calc.margenPct, calc.gananciaUsd);

  const table = document.querySelector('.tf-table tbody');
  if (!table) return;
  const tr = table.rows[idx];
  if (!tr) return;

  // cols: pax(0) usd(1) reales(2) com(3) guia(4) paseo(5) transp(6) conv(7) gan(8) margen(9) gan10(10) del(11)
  const cells = tr.cells;
  if (cells[2]) cells[2].textContent = tfFmtBRL(calc.precioReales);
  if (cells[5] && ticketARS > 0) cells[5].innerHTML = `<span style="color:var(--teal);font-weight:700;font-family:'JetBrains Mono',monospace;font-size:12px">${tfFmtARS(rowForCalc.costoPaseoArs)} <span style="font-size:9px;opacity:.55">🎫</span></span>`;
  if (cells[7]) cells[7].textContent = tfFmtUSD(calc.conversionUsd);
  if (cells[8]) cells[8].innerHTML = `<span class="tf-margen-${color}">${tfFmtUSD(calc.gananciaUsd)}</span>`;
  if (cells[9]) cells[9].innerHTML = `<span class="tf-margen-${color}">${tfFmtPct(calc.margenPct)}</span>`;
  if (cells[10]) cells[10].innerHTML = `<span class="tf-cell-calc" style="${calc.gananciaConDescuento<=0?'color:var(--red)':''}">${tfFmtUSD(calc.gananciaConDescuento)}</span>`;
}

// ─── VENTAS COMMISSION LINK ────────────────────────────────────────────────

function tfGetVentasComision(ventasServiceId, pax) {
  const svcs = (typeof state !== 'undefined') ? (state?.ventas?.servicios || []) : [];
  const svc = svcs.find(s => s.id === ventasServiceId);
  if (!svc || !svc.tarifas || !svc.tarifas.length) return null;
  const t = svc.tarifas.find(t => pax >= t.minPax && (t.maxPax === 0 || pax <= t.maxPax));
  if (!t) return null;
  return +(t.porPasajero ? t.comision * pax : t.comision);
}

function tfSetTicket(servicioId, value) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s) return;
  s.ticketARS = parseFloat(value) || 0;
  tfState.dirty[servicioId] = true;
  const saveBtn = document.querySelector('.tf-save-btn');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.classList.remove('disabled'); }
  // Recalculate rows live without losing focus on the input
  const vKey = tfState.activeVehiculo;
  const rows = s.variantes
    ? s.variantes
    : (s.vehiculos && s.vehiculos[vKey] && s.vehiculos[vKey].tarifas) || [];
  rows.forEach((_, idx) => tfRecalcRowDOM(s.id, s.variantes ? 'variante' : vKey, idx));
  // Update ticket label
  const lbl = document.getElementById(`tf-ticket-lbl-${servicioId}`);
  if (lbl) lbl.textContent = s.ticketARS > 0
    ? `→ Costo Paseo = ${new Intl.NumberFormat('es-AR').format(s.ticketARS)} × pax (automático)`
    : 'Configura el costo de entrada por persona — se aplica a todas las filas';
}

function tfSetVentasLink(servicioId, ventasServiceId) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s) return;
  s.ventasServiceId = ventasServiceId || null;
  tfState.dirty[servicioId] = true;
  // Auto-save on link change
  const { id, ...data } = s;
  tfFbSetServicio(id, data).catch(() => {});
  if (typeof mostrarToast === 'function') mostrarToast(ventasServiceId ? 'Comisión vinculada' : 'Comisión desvinculada', 'ok');
  tfRender();
}

// ─── ADD / DELETE ROWS ─────────────────────────────────────────────────────

function tfActivateTier(servicioId, vehiculoKey) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s) return;
  if (!s.vehiculos) s.vehiculos = {};
  if (!s.vehiculos[vehiculoKey]) s.vehiculos[vehiculoKey] = {};
  s.vehiculos[vehiculoKey].activo = true;
  if (!s.vehiculos[vehiculoKey].tarifas) s.vehiculos[vehiculoKey].tarifas = [];
  const paxStart = { auto: 1, van: 7, minibus: 19 };
  s.vehiculos[vehiculoKey].tarifas.push({
    pax: paxStart[vehiculoKey] || 1, usd: 0, comisionUsd: 0, tarifaGuiaUsd: 0,
    costoPaseoArs: 0, costoTransporteArs: 0
  });
  tfState.dirty[servicioId] = true;
  tfState.activeVehiculo = vehiculoKey;
  tfRender();
  if (typeof mostrarToast === 'function') mostrarToast(`Tier ${vehiculoKey} activado — completá los valores y guardá`);
}

function tfAddRow(servicioId, vehiculoKey) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s || !s.vehiculos || !s.vehiculos[vehiculoKey]) return;
  const tarifas = s.vehiculos[vehiculoKey].tarifas || [];
  const lastPax = tarifas.length > 0 ? (tarifas[tarifas.length - 1].pax || 0) : 0;
  tarifas.push({ pax: lastPax + 1, usd: 0, comisionUsd: 0, tarifaGuiaUsd: 0, costoPaseoArs: 0, costoTransporteArs: 0 });
  s.vehiculos[vehiculoKey].tarifas = tarifas;
  tfState.dirty[servicioId] = true;
  tfRender();
}

function tfDelRow(servicioId, vehiculoKey, idx) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s || !s.vehiculos || !s.vehiculos[vehiculoKey]) return;
  s.vehiculos[vehiculoKey].tarifas.splice(idx, 1);
  if (!s.vehiculos[vehiculoKey].tarifas.length) s.vehiculos[vehiculoKey].activo = false;
  tfState.dirty[servicioId] = true;
  tfRender();
}

function tfAddVariante(servicioId) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s) return;
  if (!s.variantes) s.variantes = [];
  s.variantes.push({ nombre: 'Nueva variante', usd: 0, comisionUsd: 0, tarifaGuiaUsd: 0, costoPaseoArs: 0, costoTransporteArs: 0 });
  tfState.dirty[servicioId] = true;
  tfRender();
}

function tfDelVariante(servicioId, idx) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s || !s.variantes) return;
  s.variantes.splice(idx, 1);
  tfState.dirty[servicioId] = true;
  tfRender();
}

function tfOnEditVarianteName(servicioId, idx, value) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s || !s.variantes || !s.variantes[idx]) return;
  s.variantes[idx].nombre = value;
  tfState.dirty[servicioId] = true;
  const saveBtn = document.querySelector('.tf-save-btn');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.classList.remove('disabled'); }
}

// ─── TC EDIT ───────────────────────────────────────────────────────────────

function tfOnTcEdit(campo, value) {
  if (!tfState.config) tfState.config = { tipoCambio: {} };
  if (!tfState.config.tipoCambio) tfState.config.tipoCambio = {};
  tfState.config.tipoCambio[campo] = parseFloat(value) || 0;
  tfState.config.tipoCambio.fuente = 'manual';
}

async function tfSaveTc() {
  if (!tfState.config) return;
  try {
    await tfFbSetConfig(tfState.config);
  } catch(e) {
    // silent fail — config still updated in-memory
  }
  // Refresh computed cells in visible table
  const s = tfState.servicios.find(x => x.id === tfState.activeServicioId);
  if (!s) return;
  const tc = tfState.config.tipoCambio || {};
  const vKey = tfState.activeVehiculo;

  const rows = s.variantes ? s.variantes : (s.vehiculos && s.vehiculos[vKey] && s.vehiculos[vKey].tarifas) || [];
  rows.forEach((row, idx) => {
    tfRecalcRowDOM(s.id, s.variantes ? 'variante' : vKey, idx);
  });
}

// ─── SAVE SERVICIO ─────────────────────────────────────────────────────────

async function tfSave(servicioId) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s) return;
  const btn = document.querySelector('.tf-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    const { id, ...data } = s;
    await tfFbSetServicio(servicioId, data);
    delete tfState.dirty[servicioId];
    if (btn) { btn.textContent = 'Guardado ✓'; btn.classList.add('disabled'); }
    if (typeof mostrarToast === 'function') mostrarToast('Tarifas guardadas', 'ok');
    setTimeout(() => {
      if (btn) btn.textContent = 'Guardar cambios';
    }, 2000);
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
    if (typeof mostrarToast === 'function') mostrarToast('Error al guardar: ' + e.message, 'error');
  }
}

// ─── LIVE RATES FETCH ──────────────────────────────────────────────────────

async function tfFetchAllRates() {
  const btn = document.getElementById('tf-blue-refresh');
  const icon = document.getElementById('tf-blue-refresh-icon');
  if (btn) btn.disabled = true;
  if (icon) icon.innerHTML = '<span style="display:inline-block;animation:spin 0.8s linear infinite">&#8635;</span>';

  if (!tfState.config) tfState.config = { tipoCambio: {} };
  if (!tfState.config.tipoCambio) tfState.config.tipoCambio = {};

  let anySuccess = false;
  let blueCompra = null;

  try {
    const r = await fetch('https://dolarapi.com/v1/dolares/blue');
    if (r.ok) {
      const d = await r.json();
      blueCompra = d.compra || d.venta;
      if (blueCompra) { tfState.config.tipoCambio.blue_compra = blueCompra; anySuccess = true; }
    }
  } catch(e) {}

  try {
    const r = await fetch('https://dolarapi.com/v1/dolares/bolsa');
    if (r.ok) {
      const d = await r.json();
      const mep = d.compra || d.venta;
      if (mep) { tfState.config.tipoCambio.mep = mep; anySuccess = true; }
    }
  } catch(e) {}

  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    if (r.ok) {
      const d = await r.json();
      const usdToBrl = d.rates && d.rates.BRL;
      const currentBlue = blueCompra || tfState.config.tipoCambio.blue_compra || 1410;
      if (usdToBrl && usdToBrl > 0) {
        tfState.config.tipoCambio.real = Math.round(currentBlue / usdToBrl);
        anySuccess = true;
      }
    }
  } catch(e) {}

  if (anySuccess) {
    tfState.config.tipoCambio.fuente = 'live';
    tfState.config.tipoCambio.actualizadoEn = new Date().toISOString();
    try { await tfFbSetConfig(tfState.config); } catch(e) {}
    if (typeof mostrarToast === 'function') mostrarToast('Tipos de cambio actualizados', 'ok');
    tfRender();
  } else {
    if (btn) btn.disabled = false;
    if (icon) icon.innerHTML = '&#8635;';
    if (typeof mostrarToast === 'function') mostrarToast('Error al obtener cotizaciones');
  }
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────

function tfRenderDashboard(servicios, tc) {
  if (!servicios.length) {
    return `<div style="text-align:center;padding:48px 0;color:var(--text3)">Sin servicios para mostrar.</div>`;
  }

  // Compute KPIs
  let totalServicios = 0, totalVariantes = 0, totalMargenSum = 0, margenCount = 0;
  let mejorServicio = null, mejorMargen = -Infinity;

  servicios.forEach(s => {
    totalServicios++;
    if (s.variantes && s.variantes.length) {
      totalVariantes += s.variantes.length;
      s.variantes.forEach(row => {
        const c = tarifasCalcRow(row, tc);
        if (c.margenPct && isFinite(c.margenPct)) { totalMargenSum += c.margenPct; margenCount++; }
        if (c.margenPct > mejorMargen) { mejorMargen = c.margenPct; mejorServicio = s.nombre + ' (' + row.nombre + ')'; }
      });
    }
    const vOrder = ['auto','van','minibus'];
    vOrder.forEach(vk => {
      const vd = s.vehiculos && s.vehiculos[vk];
      if (!vd || !vd.activo || !vd.tarifas) return;
      vd.tarifas.forEach(row => {
        const c = tarifasCalcRow(row, tc);
        if (c.margenPct && isFinite(c.margenPct)) { totalMargenSum += c.margenPct; margenCount++; }
        if (c.margenPct > mejorMargen) { mejorMargen = c.margenPct; mejorServicio = s.nombre + ' (' + vk + ' ' + row.pax + 'pax)'; }
      });
    });
  });

  const avgMargen = margenCount > 0 ? totalMargenSum / margenCount : 0;

  const kpis = `<div class="tf-kpi-row">
    <div class="tf-kpi">
      <div class="tf-kpi-val">${totalServicios}</div>
      <div class="tf-kpi-label">Servicios</div>
    </div>
    <div class="tf-kpi">
      <div class="tf-kpi-val" style="color:${avgMargen>=0.30?'#00d296':avgMargen>=0.15?'var(--orange)':'var(--red)'}">${tfFmtPct(avgMargen)}</div>
      <div class="tf-kpi-label">Margen promedio</div>
    </div>
    <div class="tf-kpi">
      <div class="tf-kpi-val">$${(+((tfState.config&&tfState.config.tipoCambio&&tfState.config.tipoCambio.blue_compra)||1410)).toLocaleString('es-AR')}</div>
      <div class="tf-kpi-label">Blue Compra</div>
    </div>
    <div class="tf-kpi">
      <div class="tf-kpi-val" style="font-size:13px;color:var(--text2);font-weight:600">${mejorServicio || '—'}</div>
      <div class="tf-kpi-label">Mejor margen</div>
    </div>
  </div>`;

  const chart = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px">
    <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:16px">Ganancia promedio por servicio (USD) — Auto vs Van vs MiniBus</div>
    <div style="position:relative;height:300px">
      <canvas id="tf-chart-canvas"></canvas>
    </div>
  </div>`;

  const tableRows = tfBuildDashboardTable(servicios, tc);
  const table = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px">
    <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:14px">Resumen de márgenes por servicio</div>
    <div class="tf-table-wrap">
      <table class="tf-table">
        <thead><tr>
          <th style="text-align:left">Servicio</th>
          <th>Categoría</th>
          <th>Auto avg. margen</th>
          <th>Van avg. margen</th>
          <th>MiniBus avg. margen</th>
          <th>Margen global</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>`;

  return kpis + chart + table;
}

function tfBuildDashboardTable(servicios, tc) {
  return servicios.map(s => {
    const calcAvgMargen = (rows) => {
      if (!rows || !rows.length) return null;
      const sum = rows.reduce((acc, row) => { const c = tarifasCalcRow(row, tc); return acc + c.margenPct; }, 0);
      return sum / rows.length;
    };

    let autoM = null, vanM = null, mbM = null, allRows = [];

    if (s.variantes && s.variantes.length) {
      const m = calcAvgMargen(s.variantes);
      allRows = s.variantes;
      const cls = m === null ? '' : `tf-margen-${tarifasMargenColor(m, m * 100)}`;
      return `<tr>
        <td style="text-align:left;font-weight:600">${s.nombre}</td>
        <td style="color:var(--text3)">${s.categoria}</td>
        <td colspan="3" style="color:var(--text3);font-size:11px">variantes</td>
        <td><span class="${cls}">${m !== null ? tfFmtPct(m) : '—'}</span></td>
      </tr>`;
    }

    if (s.vehiculos) {
      if (s.vehiculos.auto && s.vehiculos.auto.activo) { autoM = calcAvgMargen(s.vehiculos.auto.tarifas); allRows = allRows.concat(s.vehiculos.auto.tarifas || []); }
      if (s.vehiculos.van && s.vehiculos.van.activo) { vanM = calcAvgMargen(s.vehiculos.van.tarifas); allRows = allRows.concat(s.vehiculos.van.tarifas || []); }
      if (s.vehiculos.minibus && s.vehiculos.minibus.activo) { mbM = calcAvgMargen(s.vehiculos.minibus.tarifas); allRows = allRows.concat(s.vehiculos.minibus.tarifas || []); }
    }

    const globalM = calcAvgMargen(allRows);
    const fmtM = (m) => m !== null ? `<span class="tf-margen-${tarifasMargenColor(m, m*100)}">${tfFmtPct(m)}</span>` : '<span style="color:var(--text3)">—</span>';

    return `<tr>
      <td style="text-align:left;font-weight:600">${s.nombre}</td>
      <td style="color:var(--text3)">${s.categoria}</td>
      <td>${fmtM(autoM)}</td>
      <td>${fmtM(vanM)}</td>
      <td>${fmtM(mbM)}</td>
      <td>${fmtM(globalM)}</td>
    </tr>`;
  }).join('');
}

function tfInitChart() {
  const canvas = document.getElementById('tf-chart-canvas');
  if (!canvas) return;
  if (tfState.chart) { tfState.chart.destroy(); tfState.chart = null; }

  const tc = (tfState.config && tfState.config.tipoCambio) || {};
  const servicios = tfState.servicios;

  const labels = [];
  const autoData = [], vanData = [], mbData = [];

  servicios.forEach(s => {
    if (s.variantes && s.variantes.length) {
      labels.push(s.nombre.length > 14 ? s.nombre.substring(0,13)+'…' : s.nombre);
      const avg = s.variantes.reduce((acc, row) => acc + tarifasCalcRow(row, tc).gananciaUsd, 0) / s.variantes.length;
      autoData.push(+avg.toFixed(2));
      vanData.push(null);
      mbData.push(null);
      return;
    }
    labels.push(s.nombre.length > 14 ? s.nombre.substring(0,13)+'…' : s.nombre);
    const calcAvg = (rows) => {
      if (!rows || !rows.length) return null;
      return rows.reduce((acc, row) => acc + tarifasCalcRow(row, tc).gananciaUsd, 0) / rows.length;
    };
    autoData.push(s.vehiculos && s.vehiculos.auto && s.vehiculos.auto.activo ? +( calcAvg(s.vehiculos.auto.tarifas)||0).toFixed(2) : null);
    vanData.push(s.vehiculos && s.vehiculos.van && s.vehiculos.van.activo ? +(calcAvg(s.vehiculos.van.tarifas)||0).toFixed(2) : null);
    mbData.push(s.vehiculos && s.vehiculos.minibus && s.vehiculos.minibus.activo ? +(calcAvg(s.vehiculos.minibus.tarifas)||0).toFixed(2) : null);
  });

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const labelColor = isDark ? '#8294AB' : '#8294AB';

  tfState.chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Auto', data: autoData, backgroundColor: 'rgba(43,188,204,0.75)', borderRadius: 4 },
        { label: 'Van', data: vanData, backgroundColor: 'rgba(43,188,204,0.40)', borderRadius: 4 },
        { label: 'MiniBus', data: mbData, backgroundColor: 'rgba(43,188,204,0.20)', borderRadius: 4 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: labelColor, font: { family: 'Outfit', size: 12 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: USD ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : '—'}`
          }
        }
      },
      scales: {
        x: { ticks: { color: labelColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: {
          ticks: { color: labelColor, callback: v => 'USD ' + v },
          grid: { color: gridColor }
        }
      }
    }
  });
}

// ─── EXPORT EXCEL ──────────────────────────────────────────────────────────

function tfExportExcel() {
  if (typeof XLSX === 'undefined') {
    if (typeof mostrarToast === 'function') mostrarToast('XLSX no disponible');
    return;
  }
  const tc = (tfState.config && tfState.config.tipoCambio) || {};
  const servicios = tfState.servicios;
  const wb = XLSX.utils.book_new();

  const buildSheet = (vehiculoKey, label) => {
    const header = ['Servicio','Pax/Variante','USD','Reales BRL','Comisión USD','Tarifa Guía USD','Costo Paseo ARS','Costo Transp ARS','Conversión USD','Ganancia USD','Margen %','Gan. -10%'];
    const data = [header];

    servicios.forEach(s => {
      if (s.variantes && s.variantes.length) {
        if (vehiculoKey !== 'auto') return; // variantes only in auto sheet
        s.variantes.forEach(row => {
          const c = tarifasCalcRow(row, tc);
          data.push([s.nombre, row.nombre, row.usd, +tfFmtBRL(c.precioReales), row.comisionUsd, row.tarifaGuiaUsd, row.costoPaseoArs, row.costoTransporteArs, +tfFmtUSD(c.conversionUsd), +tfFmtUSD(c.gananciaUsd), +(c.margenPct*100).toFixed(1), +tfFmtUSD(c.gananciaConDescuento)]);
        });
        return;
      }
      const vd = s.vehiculos && s.vehiculos[vehiculoKey];
      if (!vd || !vd.activo || !vd.tarifas) return;
      vd.tarifas.forEach(row => {
        const c = tarifasCalcRow(row, tc);
        data.push([s.nombre, row.pax, row.usd, +tfFmtBRL(c.precioReales), row.comisionUsd, row.tarifaGuiaUsd, row.costoPaseoArs, row.costoTransporteArs, +tfFmtUSD(c.conversionUsd), +tfFmtUSD(c.gananciaUsd), +(c.margenPct*100).toFixed(1), +tfFmtUSD(c.gananciaConDescuento)]);
      });
    });

    return XLSX.utils.aoa_to_sheet(data);
  };

  XLSX.utils.book_append_sheet(wb, buildSheet('auto','Auto'), 'Auto');
  XLSX.utils.book_append_sheet(wb, buildSheet('van','Van'), 'Van');
  XLSX.utils.book_append_sheet(wb, buildSheet('minibus','MiniBus'), 'MiniBus');

  const date = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `VIARG_Tarifas_${date}.xlsx`);
  if (typeof mostrarToast === 'function') mostrarToast('Excel exportado', 'ok');
}

// ─── ORDEN DE SERVICIOS ────────────────────────────────────────────────────

function tfGetOrderedServicios() {
  const order = (tfState.config && tfState.config.serviciosOrder) || [];
  const all = tfState.servicios;
  if (!order.length) return all;
  const result = [];
  order.forEach(id => { const s = all.find(x => x.id === id); if (s) result.push(s); });
  all.forEach(s => { if (!order.includes(s.id)) result.push(s); });
  return result;
}

function tfMoveServicio(id, cat, dir) {
  if (!tfState.config) tfState.config = {};
  const ordered = tfGetOrderedServicios();
  const currentOrder = ordered.map(s => s.id);
  const catItems = ordered.filter(s => s.categoria === cat);
  const catIdx = catItems.findIndex(s => s.id === id);
  const newCatIdx = catIdx + dir;
  if (newCatIdx < 0 || newCatIdx >= catItems.length) return;
  const aPos = currentOrder.indexOf(catItems[catIdx].id);
  const bPos = currentOrder.indexOf(catItems[newCatIdx].id);
  [currentOrder[aPos], currentOrder[bPos]] = [currentOrder[bPos], currentOrder[aPos]];
  tfState.config.serviciosOrder = currentOrder;
  tfFbSetConfig(tfState.config).catch(() => {});
  tfRender();
}

// ─── CONFIGURACIÓN TAB ─────────────────────────────────────────────────────

function tfRenderConfigTab() {
  const servicios = tfGetOrderedServicios();
  const catLabels = tfGetCatLabels();
  const cats = Object.keys(catLabels);

  // Sección 1: orden con drag & drop + edición de nombre
  let orderRows = '';
  cats.forEach(cat => {
    const items = servicios.filter(s => s.categoria === cat);
    if (!items.length) return;
    orderRows += `<div style="margin-bottom:14px">
      <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${catLabels[cat]}</div>
      ${items.map(s => `
        <div draggable="true"
          ondragstart="tfDragStart('${s.id}','${cat}')"
          ondragover="event.preventDefault();this.style.outline='2px solid var(--teal)'"
          ondragleave="this.style.outline='none'"
          ondrop="this.style.outline='none';tfDrop('${s.id}','${cat}')"
          ondragend="tfDragEnd()"
          style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:5px;cursor:grab;user-select:none">
          <span style="color:var(--text3);font-size:16px;flex-shrink:0;line-height:1">⠿</span>
          <span style="flex:1;font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${s.nombre}</span>
          <span style="font-size:10px;color:var(--text3);background:var(--surface3);padding:2px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0">${s.duracionHs}hs</span>
        </div>`).join('')}
    </div>`;
  });

  // Sección 2: ticket por persona — siempre visible, acento azul cuando activo
  const ticketRows = servicios.map(s => {
    const hasTicket = tfIsTicketEnabled(s);
    const ticketFmt = +s.ticketARS > 0 ? Math.round(+s.ticketARS).toLocaleString('es-AR') : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
      background:${hasTicket?'rgba(43,188,204,0.13)':'var(--surface2)'};
      border:1px solid ${hasTicket?'rgba(43,188,204,0.45)':'var(--border)'};
      border-left:4px solid ${hasTicket?'var(--teal)':'transparent'};
      border-radius:8px;margin-bottom:5px;transition:background .2s,border-color .2s">
      <input type="checkbox" ${hasTicket?'checked':''} onchange="tfToggleTicket('${s.id}',this.checked)"
        style="width:16px;height:16px;accent-color:var(--teal);cursor:pointer;flex-shrink:0">
      <span style="font-size:13px;font-weight:600;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:none">${s.nombre}</span>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
        <span style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace">$</span>
        <input type="text" value="${ticketFmt}" placeholder="0"
          data-raw="${s.ticketARS||0}"
          onfocus="this.value=this.dataset.raw"
          onblur="this.value=parseInt(this.dataset.raw||0)?parseInt(this.dataset.raw).toLocaleString('es-AR'):''"
          oninput="this.dataset.raw=this.value.replace(/\\./g,'');tfSetTicketFromConfig('${s.id}',this.dataset.raw)"
          onchange="tfSaveTicketConfig('${s.id}')"
          style="width:96px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;padding:4px 8px;border:1px solid ${hasTicket?'rgba(43,188,204,0.4)':'var(--border)'};border-radius:6px;background:var(--surface);color:var(--text);outline:none">
        <span style="font-size:10px;color:var(--text3);white-space:nowrap">ARS/pax</span>
      </div>
    </div>`;
  }).join('');

  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:3px">Orden de visualización</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:14px">Arrastrá para cambiar el orden. Editá nombres en la pestaña <strong>Gestión</strong>.</div>
      ${orderRows}
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:3px">🎫 Costo de entrada por persona</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:14px">Activá para los paseos que tengan ticket de entrada. El precio × pax se aplica automáticamente como Costo Paseo en todas las filas.</div>
      ${ticketRows}
    </div>
  </div>`;
}

// ─── TICKET CONFIG ─────────────────────────────────────────────────────────

const _tfTicketSave = {};

function tfToggleTicket(id, checked) {
  const s = tfState.servicios.find(x => x.id === id);
  if (!s) return;
  s.ticketEnabled = checked;           // persist enabled state
  // ticketARS keeps its value so price is preserved when toggling
  tfSaveTicketConfig(id);
  tfRender();
}

function tfSetTicketFromConfig(id, value) {
  const s = tfState.servicios.find(x => x.id === id);
  if (!s) return;
  s.ticketARS = parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
}

function tfSaveTicketConfig(id) {
  clearTimeout(_tfTicketSave[id]);
  _tfTicketSave[id] = setTimeout(async () => {
    const s = tfState.servicios.find(x => x.id === id);
    if (!s) return;
    const { id: sid, ...data } = s;
    try { await tfFbSetServicio(sid, data); } catch(e) {}
  }, 600);
}

// ─── DRAG & DROP ───────────────────────────────────────────────────────────

let _tfDrag = { id: null, cat: null };

function tfDragStart(id, cat) { _tfDrag = { id, cat }; }
function tfDragEnd() { _tfDrag = { id: null, cat: null }; }

function tfDrop(id, cat) {
  if (!_tfDrag.id || _tfDrag.cat !== cat || _tfDrag.id === id) {
    _tfDrag = { id: null, cat: null };
    return;
  }
  if (!tfState.config) tfState.config = {};
  const ordered = tfGetOrderedServicios();
  const currentOrder = ordered.map(s => s.id);
  const aPos = currentOrder.indexOf(_tfDrag.id);
  const bPos = currentOrder.indexOf(id);
  if (aPos >= 0 && bPos >= 0) {
    [currentOrder[aPos], currentOrder[bPos]] = [currentOrder[bPos], currentOrder[aPos]];
    tfState.config.serviciosOrder = currentOrder;
    tfFbSetConfig(tfState.config).catch(() => {});
  }
  _tfDrag = { id: null, cat: null };
  tfRender();
}

// ─── RENAME SERVICIO ───────────────────────────────────────────────────────

function tfRenameServicio(id, newName) {
  const s = tfState.servicios.find(x => x.id === id);
  if (!s || !newName.trim()) return;
  s.nombre = newName.trim();
  tfSaveTicketConfig(id);
}

// ═══════════════════════════════════════════════════════════════════════════
// GESTIÓN: CATEGORÍAS + CRUD DE SERVICIOS
// ═══════════════════════════════════════════════════════════════════════════

// ─── CAT LABELS ────────────────────────────────────────────────────────────

function tfGetCatLabels() {
  const base = { tour: 'Tours', show: 'Shows', transfer: 'Transfers' };
  // Once config.categorias is explicitly set (any key), use it exclusively.
  // This lets the user delete default sections (tour/show/transfer).
  if (tfState.config?.categorias && Object.keys(tfState.config.categorias).length > 0) {
    return { ...tfState.config.categorias };
  }
  return base;
}

function tfSaveCatLabel(cat, newLabel) {
  if (!newLabel?.trim()) return;
  if (!tfState.config) tfState.config = {};
  if (!tfState.config.categorias) tfState.config.categorias = {};
  tfState.config.categorias[cat] = newLabel.trim();
  tfFbSetConfig(tfState.config).catch(() => {});
  tfRender();
}

function tfAddNewCategory() {
  const keyEl = document.getElementById('tf-new-cat-key');
  const lblEl = document.getElementById('tf-new-cat-label');
  const key = (keyEl?.value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const label = (lblEl?.value || '').trim();
  if (!key || !label) { if (typeof mostrarToast === 'function') mostrarToast('Ingresá clave y nombre'); return; }
  if (!tfState.config) tfState.config = {};
  if (!tfState.config.categorias) tfState.config.categorias = {};
  tfState.config.categorias[key] = label;
  tfFbSetConfig(tfState.config).catch(() => {});
  if (typeof mostrarToast === 'function') mostrarToast(`Sección "${label}" creada`, 'ok');
  tfRender();
}

function tfDeleteCategory(cat) {
  if (tfState.servicios.some(s => s.categoria === cat)) {
    if (typeof mostrarToast === 'function') mostrarToast('Primero mové o eliminá las actividades de esta sección');
    return;
  }
  if (!tfState.config) tfState.config = {};
  // If categorias not yet customized, initialize with all current labels
  if (!tfState.config.categorias || Object.keys(tfState.config.categorias).length === 0) {
    tfState.config.categorias = { ...tfGetCatLabels() };
  }
  delete tfState.config.categorias[cat];
  tfFbSetConfig(tfState.config).catch(() => {});
  if (typeof mostrarToast === 'function') mostrarToast(`Sección "${cat}" eliminada`);
  tfRender();
}

function tfShowNewCatForm() {
  const f = document.getElementById('tf-new-cat-form');
  if (f) f.style.display = f.style.display === 'none' ? 'flex' : 'none';
}

// ─── SERVICE MODAL ─────────────────────────────────────────────────────────

function tfOpenServiceModal(mode, id) {
  _tfGestionModal = { open: true, mode, svcId: id || null };
  tfRender();
}

function tfCloseServiceModal() {
  _tfGestionModal = { open: false, mode: 'add', svcId: null };
  tfRender();
}

function tfRenderServiceModal() {
  if (!_tfGestionModal.open) return '';
  const isEdit = _tfGestionModal.mode === 'edit';
  const svc = isEdit ? tfState.servicios.find(s => s.id === _tfGestionModal.svcId) : null;
  const catLabels = tfGetCatLabels();
  const cats = Object.keys(catLabels);

  const nombre  = (svc?.nombre || '').replace(/"/g, '&quot;');
  const cat     = svc?.categoria || cats[0] || 'tour';
  const dur     = svc?.duracionHs || 4;
  const tipo    = (svc?.variantes?.length > 0 || (svc && !svc.vehiculos)) ? 'variantes' : 'vehiculos';

  const tipoSection = !isEdit ? `
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Tipo de tarifas</div>
      <div style="display:flex;gap:8px">
        <label style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;cursor:pointer">
          <input type="radio" name="tf-modal-tipo" value="vehiculos" checked style="accent-color:var(--teal)">
          <span style="font-size:12px;font-weight:600;color:var(--text);text-transform:none">Por cantidad de pax</span>
        </label>
        <label style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;cursor:pointer">
          <input type="radio" name="tf-modal-tipo" value="variantes" style="accent-color:var(--teal)">
          <span style="font-size:12px;font-weight:600;color:var(--text);text-transform:none">Por variante</span>
        </label>
      </div>
    </div>` : '';

  return `<div onclick="if(event.target===this)tfCloseServiceModal()"
    style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px)">
    <div onclick="event.stopPropagation()"
      style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;width:100%;max-width:440px;box-shadow:0 16px 48px rgba(0,0,0,0.3);font-family:'Outfit',sans-serif">
      <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:18px">${isEdit ? '✏ Editar actividad' : '+ Nueva actividad'}</div>
      <div style="display:flex;flex-direction:column;gap:13px">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Nombre</div>
          <input type="text" id="tf-modal-nombre" value="${nombre}" placeholder="Nombre de la actividad"
            style="width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:7px;background:var(--surface2,var(--surface));color:var(--text);font-size:13px;font-family:'Outfit',sans-serif;outline:none">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Categoría / Sección</div>
            <select id="tf-modal-cat"
              style="width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:7px;background:var(--surface2,var(--surface));color:var(--text);font-size:13px;font-family:'Outfit',sans-serif;outline:none">
              ${cats.map(c => `<option value="${c}"${c===cat?' selected':''}>${catLabels[c]}</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Duración (hs)</div>
            <input type="number" id="tf-modal-dur" value="${dur}" min="0.5" step="0.5"
              style="width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:7px;background:var(--surface2,var(--surface));color:var(--text);font-size:13px;font-family:'JetBrains Mono',monospace;outline:none">
          </div>
        </div>
        ${tipoSection}
      </div>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button onclick="tfSaveServiceModal()"
          style="flex:2;padding:10px;border-radius:8px;background:var(--teal);color:#060F1E;border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif">
          ${isEdit ? 'Guardar cambios' : 'Crear actividad'}
        </button>
        <button onclick="tfCloseServiceModal()"
          style="flex:1;padding:10px;border-radius:8px;background:transparent;color:var(--text3);border:1px solid var(--border);font-size:13px;cursor:pointer;font-family:'Outfit',sans-serif">
          Cancelar
        </button>
      </div>
    </div>
  </div>`;
}

function tfSaveServiceModal() {
  const nombre = (document.getElementById('tf-modal-nombre')?.value || '').trim();
  const cat    = document.getElementById('tf-modal-cat')?.value || 'tour';
  const dur    = parseFloat(document.getElementById('tf-modal-dur')?.value) || 1;
  if (!nombre) { if (typeof mostrarToast === 'function') mostrarToast('Ingresá un nombre'); return; }

  if (_tfGestionModal.mode === 'edit') {
    const s = tfState.servicios.find(x => x.id === _tfGestionModal.svcId);
    if (!s) return;
    s.nombre = nombre; s.categoria = cat; s.duracionHs = dur;
    const { id, ...data } = s;
    tfFbSetServicio(id, data).catch(() => {});
    if (typeof mostrarToast === 'function') mostrarToast('Actividad actualizada', 'ok');
  } else {
    const tipo = document.querySelector('input[name="tf-modal-tipo"]:checked')?.value || 'vehiculos';
    const slug = nombre.normalize('NFD').replace(/[̀-ͯ]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,28);
    const id = slug + '_' + Date.now().toString(36).slice(-4);
    const newSvc = {
      id, nombre, categoria: cat, duracionHs: dur,
      ...(tipo === 'variantes'
        ? { vehiculos: {}, variantes: [] }
        : { vehiculos: { auto:{activo:true,tarifas:[]}, van:{activo:false,tarifas:[]}, minibus:{activo:false,tarifas:[]} } })
    };
    tfState.servicios.push(newSvc);
    const { id: sid, ...data } = newSvc;
    tfFbSetServicio(sid, data).catch(() => {});
    if (typeof mostrarToast === 'function') mostrarToast(`"${nombre}" creada`, 'ok');
  }
  tfCloseServiceModal();
}

async function tfDeleteServicio(id) {
  const s = tfState.servicios.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`¿Eliminar "${s.nombre}"?\nEsta acción no se puede deshacer.`)) return;
  tfState.servicios = tfState.servicios.filter(x => x.id !== id);
  if (tfState.config?.serviciosOrder)
    tfState.config.serviciosOrder = tfState.config.serviciosOrder.filter(x => x !== id);
  tfFbSetConfig(tfState.config || {}).catch(() => {});
  // Delete from Firebase (set to null — works for RTDB and most wrappers)
  try { if (window._tfSetServicio) await window._tfSetServicio(id, null); } catch(e) {}
  // Update localStorage
  try {
    const arr = JSON.parse(localStorage.getItem('viarg_tf_servicios') || '[]');
    localStorage.setItem('viarg_tf_servicios', JSON.stringify(arr.filter(x => x.id !== id)));
  } catch(e) {}
  if (typeof mostrarToast === 'function') mostrarToast(`"${s.nombre}" eliminada`);
  if (tfState.activeServicioId === id) tfState.activeServicioId = tfState.servicios[0]?.id || null;
  tfRender();
}

// ─── GESTIÓN TAB ───────────────────────────────────────────────────────────

function tfRenderGestionTab() {
  const servicios = tfGetOrderedServicios();
  const catLabels = tfGetCatLabels();
  const cats = Object.keys(catLabels);

  // Service list
  let svcRows = '';
  cats.forEach(cat => {
    const items = servicios.filter(s => s.categoria === cat);
    svcRows += `<div style="margin-bottom:18px">
      <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:7px">${catLabels[cat]}</div>
      ${items.length === 0
        ? `<div style="font-size:11px;color:var(--text3);padding:6px 0;font-style:italic">Sin actividades</div>`
        : items.map(s => {
            const tipo = s.variantes?.length > 0 ? 'Variantes' : 'Por pax';
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.nombre}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:1px">${s.duracionHs}hs · ${tipo}</div>
              </div>
              <button onclick="tfOpenServiceModal('edit','${s.id}')"
                style="padding:5px 11px;border-radius:6px;background:rgba(43,188,204,0.1);color:var(--teal);border:1px solid rgba(43,188,204,0.3);font-size:12px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;white-space:nowrap">
                ✏ Editar
              </button>
              <button onclick="tfDeleteServicio('${s.id}')"
                style="padding:5px 9px;border-radius:6px;background:rgba(217,32,32,0.08);color:var(--red);border:1px solid rgba(217,32,32,0.2);font-size:13px;cursor:pointer;white-space:nowrap">
                🗑
              </button>
            </div>`;
          }).join('')}
    </div>`;
  });

  // Category management — key editable + delete any empty section
  const catRows = cats.map(cat => {
    const inUse = servicios.some(s => s.categoria === cat);
    const count = servicios.filter(s => s.categoria === cat).length;
    return `<div style="display:flex;align-items:center;gap:7px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:5px">
      <input type="text" value="${cat}"
        onfocus="this.style.outline='1px solid var(--teal)'"
        onblur="this.style.outline='none';if(this.value&&this.value!=='${cat}')tfRenameCategory('${cat}',this.value)"
        title="Clave interna — editá para cambiarla"
        style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace;background:rgba(0,0,0,.05);padding:2px 6px;border-radius:4px;border:none;outline:none;width:80px;flex-shrink:0;cursor:text">
      <input type="text" value="${(catLabels[cat]||'').replace(/"/g,'&quot;')}"
        onblur="tfSaveCatLabel('${cat}',this.value)"
        onfocus="this.style.borderBottomColor='var(--teal)'"
        style="flex:1;font-size:13px;font-weight:600;color:var(--text);background:transparent;border:none;border-bottom:1px dashed transparent;outline:none;padding:0 3px;cursor:text">
      ${inUse
        ? `<span style="font-size:10px;color:var(--text3);flex-shrink:0">${count}</span>`
        : `<button onclick="tfDeleteCategory('${cat}')" title="Eliminar sección" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:15px;opacity:.55;padding:2px 4px;flex-shrink:0">✕</button>`}
    </div>`;
  }).join('');

  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button onclick="tfOpenServiceModal('add',null)"
        style="padding:8px 18px;border-radius:8px;background:var(--teal);color:#060F1E;border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;gap:7px">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nueva actividad
      </button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:3px">Actividades</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:16px">Agregá, editá o eliminá actividades del catálogo.</div>
        ${svcRows}
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:3px">Secciones</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:14px">Renombrá haciendo clic en el nombre. Las secciones vacías se pueden eliminar.</div>
        ${catRows}
        <button onclick="tfShowNewCatForm()"
          style="display:flex;align-items:center;gap:6px;width:100%;margin-top:6px;background:rgba(43,188,204,0.08);color:var(--teal);border:1px dashed rgba(43,188,204,0.3);border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif">
          + Nueva sección
        </button>
        <div id="tf-new-cat-form" style="display:none;margin-top:10px;flex-direction:column;gap:7px">
          <input type="text" id="tf-new-cat-key" placeholder="clave (ej: cruceros)"
            style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface2,var(--surface));color:var(--text);font-size:12px;font-family:'JetBrains Mono',monospace;outline:none">
          <input type="text" id="tf-new-cat-label" placeholder="Nombre visible (ej: Cruceros)"
            style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface2,var(--surface));color:var(--text);font-size:12px;font-family:'Outfit',sans-serif;outline:none">
          <button onclick="tfAddNewCategory()"
            style="padding:7px 14px;border-radius:6px;background:var(--teal);color:#060F1E;border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif">
            Crear sección
          </button>
        </div>
      </div>
    </div>`;
}

// ─── RENAME CATEGORY KEY ───────────────────────────────────────────────────

function tfRenameCategory(oldKey, rawNew) {
  const newKey = (rawNew||'').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  if (!newKey || newKey === oldKey) return;

  if (!tfState.config) tfState.config = {};
  // Ensure all current labels are persisted before modifying
  if (!tfState.config.categorias || Object.keys(tfState.config.categorias).length === 0) {
    tfState.config.categorias = { ...tfGetCatLabels() };
  }
  const label = tfState.config.categorias[oldKey] || oldKey;
  delete tfState.config.categorias[oldKey];
  tfState.config.categorias[newKey] = label;
  tfFbSetConfig(tfState.config).catch(() => {});

  // Migrate all services from oldKey → newKey
  let updatedLocal = false;
  tfState.servicios.forEach(s => {
    if (s.categoria !== oldKey) return;
    s.categoria = newKey;
    updatedLocal = true;
    const { id, ...data } = s;
    tfFbSetServicio(id, data).catch(() => {});
  });

  // Sync localStorage
  if (updatedLocal) {
    try {
      const arr = JSON.parse(localStorage.getItem('viarg_tf_servicios') || '[]');
      arr.forEach(x => { if (x.categoria === oldKey) x.categoria = newKey; });
      localStorage.setItem('viarg_tf_servicios', JSON.stringify(arr));
    } catch(e) {}
  }

  if (typeof mostrarToast === 'function') mostrarToast(`Clave "${oldKey}" → "${newKey}"`, 'ok');
  tfRender();
}

// Nota: capacidad de vehículos de flota se gestiona en el módulo Vehículos (section-h1)
