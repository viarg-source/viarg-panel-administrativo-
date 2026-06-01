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

// ─── INIT ──────────────────────────────────────────────────────────────────

async function tfInit() {
  const root = document.getElementById('tf-root');
  if (!root) return;

  // 1. Carga inmediata desde localStorage — sin esperar Firebase
  const defaultCfg = { tipoCambio: { blue_compra: 1410, mep: 1435, real: 270, sturla: 1415, fuente: 'manual', actualizadoEn: null } };
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

  root.innerHTML = `
    <div style="margin-bottom:18px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between">
      <div style="display:flex;gap:8px">
        <button onclick="tfSetTab('tarifas')" style="padding:7px 18px;border-radius:20px;border:1px solid var(--border);background:${activeTab==='tarifas'?'var(--teal)':'var(--surface2)'};color:${activeTab==='tarifas'?'#060F1E':'var(--text2)'};font-weight:700;font-size:13px;cursor:pointer;font-family:'Outfit',sans-serif">Tarifas</button>
        <button onclick="tfSetTab('dashboard')" style="padding:7px 18px;border-radius:20px;border:1px solid var(--border);background:${activeTab==='dashboard'?'var(--teal)':'var(--surface2)'};color:${activeTab==='dashboard'?'#060F1E':'var(--text2)'};font-weight:700;font-size:13px;cursor:pointer;font-family:'Outfit',sans-serif">Dashboard</button>
      </div>
      <button onclick="tfExportExcel()" style="padding:7px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text2);font-weight:600;font-size:12px;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        Exportar XLSX
      </button>
    </div>
    ${tfRenderTCBar(tc)}
    ${activeTab === 'tarifas' ? tfRenderTarifasTab(tc) : tfRenderDashboard(tfState.servicios, tc)}
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
      <div class="tf-tc-label">MEP</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:14px;color:var(--text3);font-family:'JetBrains Mono',monospace;font-weight:700">$</span>
        <input type="number" class="tf-tc-input" value="${tc.mep||1435}" oninput="tfOnTcEdit('mep',this.value)" onblur="tfSaveTc()">
      </div>
    </div>
    <div class="tf-tc-card">
      <div class="tf-tc-label">Real BRL</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:14px;color:var(--text3);font-family:'JetBrains Mono',monospace;font-weight:700">$</span>
        <input type="number" class="tf-tc-input" value="${tc.real||270}" oninput="tfOnTcEdit('real',this.value)" onblur="tfSaveTc()">
      </div>
    </div>
    <div class="tf-tc-card">
      <div class="tf-tc-label">Sturla</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:14px;color:var(--text3);font-family:'JetBrains Mono',monospace;font-weight:700">$</span>
        <input type="number" class="tf-tc-input" value="${tc.sturla||1415}" oninput="tfOnTcEdit('sturla',this.value)" onblur="tfSaveTc()">
      </div>
    </div>
    <div class="tf-tc-card" style="display:flex;align-items:center;justify-content:center;min-width:auto;flex:0 0 auto">
      <button id="tf-blue-refresh" onclick="tfFetchDolarBlue()" style="padding:8px 14px;border-radius:8px;background:rgba(43,188,204,0.12);color:var(--teal);border:1px solid rgba(43,188,204,0.3);font-size:12px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;gap:6px;white-space:nowrap">
        <span id="tf-blue-refresh-icon">&#8635;</span> Actualizar
      </button>
    </div>
  </div>`;
}

// ─── TARIFAS TAB ───────────────────────────────────────────────────────────

function tfRenderTarifasTab(tc) {
  const servicios = tfState.servicios;
  if (!servicios.length) {
    return `<div style="text-align:center;padding:48px 0;color:var(--text3)">
      <div style="font-size:36px;margin-bottom:12px">📋</div>
      <div style="font-size:15px;font-weight:600">No hay servicios cargados</div>
      <div style="font-size:12px;margin-top:6px">Ejecutá <code style="background:var(--surface2);padding:2px 6px;border-radius:4px">tarifasSeedAll()</code> en la consola del browser para poblar los datos iniciales.</div>
    </div>`;
  }

  const activeId = tfState.activeServicioId;
  const servicio = servicios.find(s => s.id === activeId) || servicios[0];

  return `
    ${tfRenderServiceSelector(servicios)}
    ${tfRenderVehiculoTabs(servicio)}
    ${tfRenderTableSection(servicio, tc)}
  `;
}

// ─── SERVICE SELECTOR ──────────────────────────────────────────────────────

function tfRenderServiceSelector(servicios) {
  const cats = ['tour','show','transfer'];
  const catLabels = { tour: 'Tours', show: 'Shows', transfer: 'Transfers' };

  let html = '';
  cats.forEach(cat => {
    const items = servicios.filter(s => s.categoria === cat);
    if (!items.length) return;
    html += `<div style="margin-bottom:12px">
      <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${catLabels[cat]}</div>
      <div class="tf-service-selector">
        ${items.map(s => `<button class="tf-service-btn${s.id===tfState.activeServicioId?' active':''}" onclick="tfSelectServicio('${s.id}')">${s.nombre}</button>`).join('')}
      </div>
    </div>`;
  });
  return html;
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

// ─── TABLE SECTION ─────────────────────────────────────────────────────────

function tfRenderTableSection(servicio, tc) {
  if (!servicio) return '';
  const isDirty = tfState.dirty[servicio.id];
  const saveBtn = `<button class="tf-save-btn${isDirty?'':' disabled'}" ${isDirty?'':'disabled'} onclick="tfSave('${servicio.id}')">Guardar cambios</button>`;

  // Ventas commission link selector
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

// ─── MAIN TABLE ────────────────────────────────────────────────────────────

function tfRenderTable(servicio, vehiculoKey, tc) {
  const vehiculoData = servicio.vehiculos[vehiculoKey];
  const addRowBtn = `<div style="margin-top:8px"><button onclick="tfAddRow('${servicio.id}','${vehiculoKey}')" style="display:flex;align-items:center;gap:6px;background:rgba(43,188,204,0.08);color:var(--teal);border:1px dashed rgba(43,188,204,0.3);border-radius:7px;padding:6px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif">+ Agregar fila de pax</button></div>`;
  if (!vehiculoData || !vehiculoData.tarifas || !vehiculoData.tarifas.length) {
    return `<div style="color:var(--text3);font-size:12px;padding:8px 0">Sin filas aún.</div>${addRowBtn}`;
  }
  const rows = vehiculoData.tarifas;
  const linked = servicio.ventasServiceId;

  const header = `<tr>
    <th style="text-align:center;width:58px">Pax</th>
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

  const trs = rows.map((row, idx) => {
    const ventasCom = linked ? tfGetVentasComision(linked, row.pax) : null;
    const rowCalc = ventasCom !== null ? {...row, comisionUsd: ventasCom} : row;
    const calc = tarifasCalcRow(rowCalc, tc);
    const color = tarifasMargenColor(calc.margenPct, calc.gananciaUsd);
    const cls = `tf-margen-${color}`;
    const comCell = linked
      ? `<td class="tf-cell-calc" style="color:var(--teal);font-weight:700">${tfFmtUSD(ventasCom??0)} <span style="font-size:9px;opacity:.55">🔗</span></td>`
      : `<td><input type="number" class="tf-cell-edit" value="${row.comisionUsd}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'comisionUsd',this.value)"></td>`;
    return `<tr>
      <td style="text-align:center"><input type="number" class="tf-cell-edit" style="width:48px;text-align:center;font-weight:700" value="${row.pax}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'pax',this.value)"></td>
      <td><input type="number" class="tf-cell-edit" value="${row.usd}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'usd',this.value)"></td>
      <td class="tf-cell-calc">${tfFmtBRL(calc.precioReales)}</td>
      ${comCell}
      <td><input type="number" class="tf-cell-edit" value="${row.tarifaGuiaUsd}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'tarifaGuiaUsd',this.value)"></td>
      <td><input type="number" class="tf-cell-edit" style="width:88px" value="${row.costoPaseoArs}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'costoPaseoArs',this.value)"></td>
      <td><input type="number" class="tf-cell-edit" style="width:88px" value="${row.costoTransporteArs}" oninput="tfOnEditCell('${servicio.id}','${vehiculoKey}',${idx},'costoTransporteArs',this.value)"></td>
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
    const rowCalc = ventasCom !== null ? {...row, comisionUsd: ventasCom} : row;
    const calc = tarifasCalcRow(rowCalc, tc);
    const color = tarifasMargenColor(calc.margenPct, calc.gananciaUsd);
    const cls = `tf-margen-${color}`;
    const comCell = linked
      ? `<td class="tf-cell-calc" style="color:var(--teal);font-weight:700">${tfFmtUSD(ventasCom??0)} <span style="font-size:9px;opacity:.55">🔗</span></td>`
      : `<td><input type="number" class="tf-cell-edit" value="${row.comisionUsd}" oninput="tfOnEditCell('${servicio.id}','variante',${idx},'comisionUsd',this.value)"></td>`;
    return `<tr>
      <td><input type="text" class="tf-cell-edit" style="text-align:left;width:120px;font-weight:600" value="${(row.nombre||'').replace(/"/g,'&quot;')}" oninput="tfOnEditVarianteName('${servicio.id}',${idx},this.value)"></td>
      <td><input type="number" class="tf-cell-edit" value="${row.usd}" oninput="tfOnEditCell('${servicio.id}','variante',${idx},'usd',this.value)"></td>
      <td class="tf-cell-calc">${tfFmtBRL(calc.precioReales)}</td>
      ${comCell}
      <td><input type="number" class="tf-cell-edit" value="${row.tarifaGuiaUsd}" oninput="tfOnEditCell('${servicio.id}','variante',${idx},'tarifaGuiaUsd',this.value)"></td>
      <td><input type="number" class="tf-cell-edit" style="width:88px" value="${row.costoPaseoArs}" oninput="tfOnEditCell('${servicio.id}','variante',${idx},'costoPaseoArs',this.value)"></td>
      <td><input type="number" class="tf-cell-edit" style="width:88px" value="${row.costoTransporteArs}" oninput="tfOnEditCell('${servicio.id}','variante',${idx},'costoTransporteArs',this.value)"></td>
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
  const v = campo === 'pax' ? (parseInt(value) || 0) : (parseFloat(value) || 0);

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

  const calc = tarifasCalcRow(row, tc);
  const color = tarifasMargenColor(calc.margenPct, calc.gananciaUsd);

  // Find the table row - it's the (idx+1)th tbody row
  const table = document.querySelector('.tf-table tbody');
  if (!table) return;
  const tr = table.rows[idx];
  if (!tr) return;

  // Columns: pax(0) usd(1) reales(2) com(3) guia(4) paseo(5) transp(6) conv(7) gan(8) margen(9) gan10(10)
  const cells = tr.cells;
  if (cells[2]) cells[2].innerHTML = `<span class="tf-cell-calc">${tfFmtBRL(calc.precioReales)}</span>`;
  if (cells[7]) cells[7].innerHTML = `<span class="tf-cell-calc">${tfFmtUSD(calc.conversionUsd)}</span>`;
  if (cells[8]) cells[8].innerHTML = `<span class="tf-margen-${color}">${tfFmtUSD(calc.gananciaUsd)}</span>`;
  if (cells[9]) cells[9].innerHTML = `<span class="tf-margen-${color}">${tfFmtPct(calc.margenPct)}</span>`;
  if (cells[10]) {
    cells[10].innerHTML = `<span class="tf-cell-calc" style="${calc.gananciaConDescuento<=0?'color:var(--red)':''}">${tfFmtUSD(calc.gananciaConDescuento)}</span>`;
  }
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

function tfSetVentasLink(servicioId, ventasServiceId) {
  const s = tfState.servicios.find(x => x.id === servicioId);
  if (!s) return;
  s.ventasServiceId = ventasServiceId || null;
  tfState.dirty[servicioId] = true;
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

// ─── DOLAR BLUE FETCH ──────────────────────────────────────────────────────

async function tfFetchDolarBlue() {
  const btn = document.getElementById('tf-blue-refresh');
  const icon = document.getElementById('tf-blue-refresh-icon');
  if (btn) btn.disabled = true;
  if (icon) icon.innerHTML = '<span style="display:inline-block;animation:spin 0.8s linear infinite">&#8635;</span>';

  try {
    const r = await fetch('https://dolarapi.com/v1/dolares/blue');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const compra = data.compra || data.venta;
    if (!compra) throw new Error('Sin dato');
    if (!tfState.config) tfState.config = { tipoCambio: {} };
    if (!tfState.config.tipoCambio) tfState.config.tipoCambio = {};
    tfState.config.tipoCambio.blue_compra = compra;
    tfState.config.tipoCambio.fuente = 'live';
    tfState.config.tipoCambio.actualizadoEn = new Date().toISOString();
    await tfFbSetConfig(tfState.config);
    if (typeof mostrarToast === 'function') mostrarToast('Blue actualizado: $' + compra, 'ok');
    tfRender();
  } catch(e) {
    if (btn) btn.disabled = false;
    if (icon) icon.innerHTML = '&#8635;';
    if (typeof mostrarToast === 'function') mostrarToast('Error al obtener blue: ' + e.message);
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
