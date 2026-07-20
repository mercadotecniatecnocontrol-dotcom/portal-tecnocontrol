// ══════════════════════════════════════════════════════════════
// MÓDULO MARKETING — Portal Tecnocontrol
// Archivo: /modulos/marketing.js
// Dependencias globales que provee index.html:
//   - db        (instancia Firestore)
//   - auth      (instancia Firebase Auth)
//   - esAdminTotal(email)
//   - mostrarPush(titulo, msg, icono)
//   - addDoc, collection, doc, getDoc, getDocs, setDoc,
//     updateDoc, deleteDoc, query, where  (Firestore helpers)
// ══════════════════════════════════════════════════════════════

// ── Inyectar estilos CSS del módulo ──────────────────────────
(function inyectarCSS() {
    if (document.getElementById('css-marketing')) return;
    const style = document.createElement('style');
    style.id = 'css-marketing';
    style.textContent = `
        .mkt-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
        .mkt-title{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px;}
        .mkt-badge{background:#eff6ff;color:#2563eb;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;}
        .mkt-add-btn{padding:7px 14px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;transition:0.2s;letter-spacing:0.5px;}
        .mkt-add-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(37,99,235,0.35);}
        .mkt-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px;}
        .mkt-kpi{background:#ffffff;border-radius:14px;padding:14px 12px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 6px rgba(37,99,235,0.05);position:relative;overflow:hidden;cursor:pointer;transition:0.2s;}
        .mkt-kpi:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.10);}
        .mkt-kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
        .mkt-kpi.k-seguidores::before{background:linear-gradient(90deg,#e1306c,#833ab4);}
        .mkt-kpi.k-alcance::before{background:linear-gradient(90deg,#1877f2,#42a5f5);}
        .mkt-kpi.k-engagement::before{background:linear-gradient(90deg,#f59e0b,#fbbf24);}
        .mkt-kpi.k-leads::before{background:linear-gradient(90deg,#10b981,#34d399);}
        .mkt-kpi.k-presupuesto::before{background:linear-gradient(90deg,#8b5cf6,#a78bfa);}
        .mkt-kpi.k-conversiones::before{background:linear-gradient(90deg,#ef4444,#f87171);}
        .mkt-kpi-icon{font-size:18px;margin-bottom:6px;}
        .mkt-kpi-val{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700;color:#1e293b;line-height:1;}
        .mkt-kpi-label{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-top:3px;}
        .mkt-kpi-delta{font-size:10px;margin-top:5px;font-weight:700;}
        .mkt-kpi-delta.up-good{color:#16a34a;}
        .mkt-kpi-delta.up-bad{color:#dc2626;}
        .mkt-kpi-delta.neutral{color:#64748b;}
        .mkt-charts-row{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:14px;margin-bottom:16px;}
        .mkt-card{background:#ffffff;border-radius:16px;padding:18px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.05);}
        .mkt-card-title{font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px;}
        .mkt-card-sub{font-size:10px;color:#64748b;margin-bottom:12px;}
        .mkt-canales{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;}
        .mkt-canal{background:#ffffff;border-radius:14px;padding:16px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 6px rgba(37,99,235,0.05);text-align:center;}
        .mkt-canal-icon{font-size:24px;margin-bottom:8px;}
        .mkt-canal-name{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
        .mkt-canal-val{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:#1e293b;}
        .mkt-canal-sub{font-size:10px;color:#94a3b8;margin-top:2px;}
        .mkt-canal-bar{height:4px;background:#e2e8f0;border-radius:4px;margin-top:8px;overflow:hidden;}
        .mkt-canal-fill{height:100%;border-radius:4px;transition:width 0.8s ease;}
        .mkt-campanas{background:#ffffff;border-radius:16px;padding:18px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.05);margin-bottom:16px;}
        .mkt-camp-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;padding:10px 12px;border-radius:10px;font-size:12px;align-items:center;margin-bottom:6px;border:1px solid rgba(59,130,246,0.06);}
        .mkt-camp-row.header{background:#f8faff;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;border:none;}
        .mkt-camp-row:not(.header):hover{background:#f8faff;}
        .camp-status{padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;display:inline-block;}
        .camp-activa{background:#dcfce7;color:#16a34a;}
        .camp-pausada{background:#fef9c3;color:#a16207;}
        .camp-finalizada{background:#f1f5f9;color:#64748b;}
        .camp-planeada{background:#eff6ff;color:#2563eb;}
        .mkt-budget-bar{height:6px;background:#e2e8f0;border-radius:4px;margin-top:4px;overflow:hidden;}
        .mkt-budget-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#2563eb,#60a5fa);transition:width 0.8s;}
        .mkt-stock{background:#ffffff;border-radius:16px;padding:18px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.05);margin-bottom:16px;}
        .parrilla-wrap{background:#ffffff;border-radius:16px;padding:18px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.05);margin-bottom:16px;}
        .parrilla-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;}
        .parrilla-filtros{display:flex;gap:8px;flex-wrap:wrap;}
        .parrilla-filtro{padding:5px 14px;border-radius:20px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:11px;font-weight:700;cursor:pointer;transition:0.2s;}
        .parrilla-filtro.active{background:#2563eb;color:#ffffff;border-color:#2563eb;}
        .parrilla-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;}
        .parrilla-dow{background:#f8faff;padding:8px 4px;text-align:center;font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;}
        .parrilla-cell{min-height:120px;padding:6px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;vertical-align:top;position:relative;background:#ffffff;}
        .parrilla-cell:nth-child(7n){border-right:none;}
        .parrilla-cell.otro-mes{background:#fafafa;}
        .parrilla-cell.hoy{background:#eff6ff;}
        .parrilla-cell-day{font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;}
        .parrilla-add-cell{background:none;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;padding:0;line-height:1;transition:0.15s;}
        .parrilla-add-cell:hover{color:#2563eb;}
        .post-card{border-radius:8px;padding:6px 8px;margin-bottom:4px;font-size:10px;cursor:pointer;transition:0.15s;border-left:3px solid transparent;position:relative;}
        .post-card:hover{filter:brightness(0.95);}
        .post-card.empresa-tecnocontrol{background:#dbeafe;border-left-color:#2563eb;color:#1e40af;}
        .post-card.empresa-akuris{background:#dcfce7;border-left-color:#16a34a;color:#14532d;}
        .post-card.empresa-jomar{background:#fef9c3;border-left-color:#ca8a04;color:#78350f;}
        .post-card.empresa-otra{background:#f3e8ff;border-left-color:#7c3aed;color:#4c1d95;}
        .post-card-hora{font-weight:700;font-size:9px;opacity:0.75;}
        .post-card-copy{font-weight:600;line-height:1.3;margin-top:1px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
        .post-card-canal{font-size:9px;opacity:0.7;margin-top:2px;}
        .parrilla-lista{width:100%;border-collapse:collapse;font-size:12px;}
        .parrilla-lista th{background:#f8faff;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;text-align:left;font-weight:700;}
        .parrilla-lista td{padding:10px 12px;border-bottom:1px solid rgba(59,130,246,0.06);color:#1e293b;vertical-align:middle;}
        .parrilla-lista tr:hover td{background:#f8faff;}
        .empresa-chip{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;display:inline-block;}
        .canal-chip{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#f1f5f9;color:#475569;}
        #modal-mkt{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:3000;align-items:center;justify-content:center;}
        .mkt-modal-box{background:#ffffff;border-radius:20px;padding:28px;width:560px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15);}
        .mkt-modal-title{font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:700;color:#1e293b;margin-bottom:20px;}
        .mkt-form-label{font-size:10px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;display:block;margin-top:14px;}
        .mkt-form-input{width:100%;padding:11px 14px;border-radius:10px;border:1px solid rgba(59,130,246,0.2);background:#f8faff;color:#1e293b;font-size:13px;outline:none;font-family:'DM Sans',sans-serif;}
        .mkt-form-input:focus{border-color:#2563eb;background:#eff6ff;}
        .mkt-tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;}
        .mkt-tab{padding:7px 14px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:11px;font-weight:700;cursor:pointer;transition:0.2s;}
        .mkt-tab.active{background:#2563eb;color:#ffffff;border-color:#2563eb;}
        .mkt-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        #modal-parrilla{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:3500;align-items:center;justify-content:center;}
        #modal-preview-post{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(10px);z-index:3600;align-items:center;justify-content:center;}
        .preview-box{background:#ffffff;border-radius:20px;width:820px;max-width:96vw;max-height:90vh;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.25);display:grid;grid-template-columns:1fr 1fr;}
        .preview-col-img{position:relative;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:400px;border-radius:20px 0 0 20px;overflow:hidden;}
        .preview-col-info{padding:28px;overflow-y:auto;max-height:90vh;display:flex;flex-direction:column;}
        .preview-empresa-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:14px;align-self:flex-start;}
        .preview-copy{font-size:13px;color:#1e293b;line-height:1.75;white-space:pre-wrap;margin-bottom:16px;flex:1;overflow-y:auto;max-height:260px;}
        .preview-meta{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:#64748b;margin-bottom:14px;}
        .preview-meta span{display:flex;align-items:center;gap:4px;background:#f8faff;padding:3px 10px;border-radius:10px;border:1px solid #e2e8f0;}
        .preview-notas{font-size:11px;color:#64748b;background:#fef9c3;border-radius:8px;padding:10px 12px;margin-bottom:16px;border:1px solid #fde68a;}
        .preview-acciones{display:flex;flex-direction:column;gap:8px;margin-top:auto;}
        .preview-acciones button{width:100%;padding:11px;border-radius:10px;font-weight:700;font-size:12px;cursor:pointer;border:none;}
        .parrilla-modal-box{background:#ffffff;border-radius:20px;padding:28px;width:580px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15);}
        .parrilla-img-preview{width:100%;height:160px;object-fit:cover;border-radius:10px;margin-top:8px;display:none;}
        .parrilla-drop-zone{border:2px dashed #cbd5e1;border-radius:10px;padding:24px;text-align:center;color:#94a3b8;font-size:12px;cursor:pointer;transition:0.2s;margin-top:6px;}
        .parrilla-drop-zone:hover{border-color:#2563eb;color:#2563eb;background:#eff6ff;}
        @media(max-width:768px){
            .mkt-kpis{grid-template-columns:repeat(2,1fr);gap:8px;}
            .mkt-charts-row{grid-template-columns:1fr;gap:10px;}
            .mkt-canales{grid-template-columns:repeat(2,1fr);}
            .parrilla-grid{grid-template-columns:repeat(4,1fr);}
            .mkt-modal-box{width:96vw;padding:16px;}
            .parrilla-modal-box{width:96vw;padding:16px;border-radius:16px;}
            .mkt-form-grid{grid-template-columns:1fr !important;}
            .parrilla-header{flex-direction:column;gap:8px;}
            .mkt-camp-row{grid-template-columns:1.2fr 0.8fr;gap:6px;font-size:11px;}
            .mkt-camp-row span:nth-child(n+3){display:none;}
            .mkt-kpi{padding:10px 8px;}
            .mkt-kpi-val{font-size:16px;}
        }
    `;
    document.head.appendChild(style);
})();


// ── Inyectar HTML del dashboard de Marketing ─────────────────
(function inyectarDashboardHTML() {
    if (document.getElementById('mkt-dashboard')) return;
    const container = document.getElementById('sec-area') || document.querySelector('[id*="sec-area"]');
    const rhDash = document.getElementById('rh-dashboard');
    const htmlDash = `            <div id="mkt-dashboard">
                <div class="mkt-header">
                    <div class="mkt-title">📣 Indicadores Marketing
                        <span class="mkt-badge">Digital · Mensual</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#64748b;">
                            <button class="rh-mes-btn" onclick="mktMesPrev()">‹</button>
                            <span class="rh-mes-label" id="mkt-mes-label" style="min-width:90px;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;color:#1e293b;"></span>
                            <button class="rh-mes-btn" onclick="mktMesNext()">›</button>
                        </div>
                        <button class="mkt-add-btn" onclick="abrirModalMkt()">➕ Registrar datos</button>
                        <button class="mkt-add-btn" onclick="sincronizarStock()" style="background:linear-gradient(135deg,#059669,#047857);" id="btn-sync-stock">🔄 Sync Stock</button>
                    </div>
                </div>

                <!-- KPIs principales: QUITADOS TEMPORALMENTE 2026-07-20, retomar después -->

                <!-- Gráficas principales -->
                <div class="mkt-charts-row">
                    <div class="mkt-card">
                        <div class="mkt-card-title">📈 Tendencia de alcance</div>
                        <div class="mkt-card-sub">Seguidores y alcance últimos 6 meses</div>
                        <div style="height:160px;"><canvas id="mkt-chart-tendencia"></canvas></div>
                    </div>
                    <div class="mkt-card" style="text-align:center;">
                        <div class="mkt-card-title" style="text-align:left;">💰 Presupuesto</div>
                        <div class="mkt-card-sub" style="text-align:left;">Gastado vs asignado</div>
                        <div style="position:relative;width:130px;height:130px;margin:0 auto;">
                            <canvas id="mkt-chart-budget"></canvas>
                            <div id="mkt-budget-pct" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:#1e293b;">—</div>
                        </div>
                        <div id="mkt-budget-detalle" style="font-size:11px;color:#64748b;margin-top:8px;"></div>
                    </div>
                    <div class="mkt-card" style="text-align:center;">
                        <div class="mkt-card-title" style="text-align:left;">📊 Mix de canales</div>
                        <div class="mkt-card-sub" style="text-align:left;">Distribución de alcance</div>
                        <div style="position:relative;width:130px;height:130px;margin:0 auto;">
                            <canvas id="mkt-chart-mix"></canvas>
                        </div>
                        <div id="mkt-mix-leyenda" style="font-size:10px;color:#64748b;margin-top:8px;text-align:left;"></div>
                    </div>
                </div>

                <!-- Canales individuales -->
                <div class="mkt-canales">
                    <div class="mkt-canal">
                        <div class="mkt-canal-icon">📸</div>
                        <div class="mkt-canal-name">Instagram</div>
                        <div class="mkt-canal-val" id="mkt-ig-seg">—</div>
                        <div class="mkt-canal-sub">seguidores</div>
                        <div class="mkt-canal-bar"><div class="mkt-canal-fill" id="mkt-ig-bar" style="width:0%;background:linear-gradient(90deg,#e1306c,#833ab4);"></div></div>
                        <div style="font-size:10px;color:#64748b;margin-top:4px;">Alcance: <b id="mkt-ig-alc">—</b></div>
                    </div>
                    <div class="mkt-canal">
                        <div class="mkt-canal-icon">👍</div>
                        <div class="mkt-canal-name">Facebook</div>
                        <div class="mkt-canal-val" id="mkt-fb-seg">—</div>
                        <div class="mkt-canal-sub">seguidores</div>
                        <div class="mkt-canal-bar"><div class="mkt-canal-fill" id="mkt-fb-bar" style="width:0%;background:linear-gradient(90deg,#1877f2,#42a5f5);"></div></div>
                        <div style="font-size:10px;color:#64748b;margin-top:4px;">Alcance: <b id="mkt-fb-alc">—</b></div>
                    </div>
                    <div class="mkt-canal">
                        <div class="mkt-canal-icon">🔍</div>
                        <div class="mkt-canal-name">Google Ads</div>
                        <div class="mkt-canal-val" id="mkt-gads-clicks">—</div>
                        <div class="mkt-canal-sub">clics</div>
                        <div class="mkt-canal-bar"><div class="mkt-canal-fill" id="mkt-gads-bar" style="width:0%;background:linear-gradient(90deg,#4285f4,#34a853);"></div></div>
                        <div style="font-size:10px;color:#64748b;margin-top:4px;">Impresiones: <b id="mkt-gads-imp">—</b></div>
                    </div>
                    <div class="mkt-canal">
                        <div class="mkt-canal-icon">🌐</div>
                        <div class="mkt-canal-name">Sitio Web</div>
                        <div class="mkt-canal-val" id="mkt-web-vis">—</div>
                        <div class="mkt-canal-sub">visitas</div>
                        <div class="mkt-canal-bar"><div class="mkt-canal-fill" id="mkt-web-bar" style="width:0%;background:linear-gradient(90deg,#10b981,#34d399);"></div></div>
                        <div style="font-size:10px;color:#64748b;margin-top:4px;">Bounce rate: <b id="mkt-web-bounce">—</b></div>
                    </div>
                </div>

                <!-- Campañas activas -->
                <div class="mkt-campanas">
                    <div class="rh-vac-title">
                        <span>🚀 Campañas del mes</span>
                        <button class="mkt-add-btn" onclick="abrirModalMkt('campana')" style="font-size:10px;padding:5px 10px;">+ Nueva campaña</button>
                    </div>
                    <div class="mkt-camp-row header">
                        <span>Campaña</span><span>Canal</span><span>Presupuesto</span><span>Avance</span><span>Estatus</span>
                    </div>
                    <div id="mkt-campanas-lista"><div style="text-align:center;color:#94a3b8;padding:16px;font-size:12px;">Sin campañas registradas este mes</div></div>
                </div>

                <!-- Stock Tecnocontrol desde Google Sheets -->
                <div class="mkt-stock">
                    <div class="rh-vac-title">
                        <span>📦 Revisión de Artículos en Stock <span style="font-size:10px;color:#64748b;font-weight:400;">(Google Sheets)</span></span>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <span id="mkt-stock-status" style="font-size:10px;color:#94a3b8;"></span>
                            <button class="mkt-add-btn" onclick="sincronizarStock()" style="font-size:10px;padding:5px 10px;">🔄 Actualizar</button>
                            <input type="text" id="mkt-sheets-url" placeholder="URL del Google Sheet publicado (CSV)" style="font-size:11px;padding:5px 10px;border-radius:8px;border:1px solid #cbd5e1;color:#475569;width:300px;display:none;" />
                            <button onclick="configurarSheetURL()" style="font-size:10px;padding:5px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;color:#475569;" id="btn-config-sheet">⚙️ Configurar</button>
                        </div>
                    </div>
                    <div id="mkt-stock-content">
                        <div style="text-align:center;color:#94a3b8;padding:24px;font-size:12px;">
                            Configura la URL de tu Google Sheet para sincronizar el stock.<br>
                            <span style="font-size:10px;">Archivo → Publicar en la web → CSV → copiar URL</span>
                        </div>
                    </div>
                </div>

                <!-- ═══ PARRILLA DE CONTENIDO ═══════════════════════════ -->
                <div class="parrilla-wrap">
                    <div class="parrilla-header">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;color:#1e293b;">📅 Parrilla de Contenido</span>
                            <span id="parrilla-mes-label" style="font-size:12px;color:#64748b;"></span>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                            <!-- Filtros por empresa -->
                            <div class="parrilla-filtros" id="parrilla-filtros">
                                <button class="parrilla-filtro active" data-empresa="todos" onclick="filtrarParrilla('todos',this)">Todos</button>
                                <button class="parrilla-filtro" data-empresa="tecnocontrol" onclick="filtrarParrilla('tecnocontrol',this)">🔵 Tecnocontrol</button>
                                <button class="parrilla-filtro" data-empresa="akuris" onclick="filtrarParrilla('akuris',this)">🟢 Akuris</button>
                                <button class="parrilla-filtro" data-empresa="jomar" onclick="filtrarParrilla('jomar',this)">🟡 Jomar</button>
                                <button class="parrilla-filtro" data-empresa="otra" onclick="filtrarParrilla('otra',this)">🟣 Otra</button>
                            </div>
                            <!-- Nav mes -->
                            <div style="display:flex;align-items:center;gap:6px;">
                                <button class="rh-mes-btn" onclick="parrillaMesPrev()">‹</button>
                                <span id="parrilla-nav-label" style="font-size:12px;font-weight:700;color:#1e293b;min-width:90px;text-align:center;"></span>
                                <button class="rh-mes-btn" onclick="parrillaMesNext()">›</button>
                            </div>
                            <!-- Vista -->
                            <div style="display:flex;gap:4px;">
                                <button id="btn-vista-cal" onclick="setVistaParrilla('calendario')" style="padding:5px 10px;border-radius:8px;border:1px solid #2563eb;background:#2563eb;color:white;font-size:11px;font-weight:700;cursor:pointer;">📅 Calendario</button>
                                <button id="btn-vista-lista" onclick="setVistaParrilla('lista')" style="padding:5px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:11px;font-weight:700;cursor:pointer;">📋 Lista</button>
                            </div>
                            <button class="mkt-add-btn" onclick="abrirModalParrilla()">➕ Nuevo post</button>
                        </div>
                    </div>
                    <!-- Contenido: calendario o lista -->
                    <div id="parrilla-content"></div>
                </div>
            </div>
`;
    if (rhDash) {
        rhDash.insertAdjacentHTML('beforebegin', htmlDash);
    } else if (container) {
        container.insertAdjacentHTML('beforeend', htmlDash);
    }
})();

// ── Inyectar HTML de modales ──────────────────────────────────
(function inyectarModales() {
    if (document.getElementById('modal-mkt')) return;

    const html = `
    <!-- MODAL MARKETING -->
    <div id="modal-mkt">
        <div class="mkt-modal-box">
            <div class="mkt-modal-title" id="mkt-modal-title">📊 Registrar datos de Marketing</div>
            <div class="mkt-tabs">
                <button class="mkt-tab active" onclick="mktTabSwitch('kpis',this)">📊 KPIs</button>
                <button class="mkt-tab" onclick="mktTabSwitch('canales',this)">📡 Canales</button>
                <button class="mkt-tab" onclick="mktTabSwitch('presupuesto',this)">💰 Presupuesto</button>
                <button class="mkt-tab" onclick="mktTabSwitch('campana',this)">🚀 Campaña</button>
            </div>
            <div id="mkt-form-container"></div>
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button class="mkt-add-btn" style="flex:1;padding:12px;" onclick="guardarDatoMkt()">GUARDAR</button>
                <button style="flex:1;padding:12px;border:1px solid #cbd5e1;border-radius:10px;background:#f8faff;color:#475569;font-size:12px;font-weight:700;cursor:pointer;" onclick="document.getElementById('modal-mkt').style.display='none'">Cancelar</button>
            </div>
        </div>
    </div>

    <!-- MODAL VISTA PREVIA POST -->
    <div id="modal-preview-post">
        <div class="preview-box">
            <div class="preview-col-img">
                <img id="preview-img" class="preview-img" style="display:none;" onerror="this.style.display='none'">
                <div id="preview-no-img" class="preview-no-img-inner">
                    <div style="font-size:48px;margin-bottom:8px;">🖼️</div>
                    <div style="font-size:12px;">Sin imagen adjunta</div>
                </div>
            </div>
            <div class="preview-col-info">
                <div id="preview-empresa-chip" class="preview-empresa-chip"></div>
                <div class="preview-meta" id="preview-meta"></div>
                <div class="preview-copy" id="preview-copy"></div>
                <div class="preview-notas" id="preview-notas" style="display:none;"></div>
                <div class="preview-acciones">
                    <button id="preview-btn-editar" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;">✏️ Editar post</button>
                    <button id="preview-btn-eliminar" style="background:linear-gradient(135deg,#ef4444,#dc2626);color:white;">🗑 Eliminar post</button>
                    <button onclick="document.getElementById('modal-preview-post').style.display='none'" style="background:#f1f5f9;color:#475569;">✕ Cerrar</button>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL PARRILLA -->
    <div id="modal-parrilla">
        <div class="parrilla-modal-box">
            <div style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:700;color:#1e293b;margin-bottom:20px;" id="parrilla-modal-title">📝 Nuevo post</div>
            <input type="hidden" id="parrilla-edit-id">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <label class="mkt-form-label">Fecha de publicación</label>
                    <input class="mkt-form-input" id="par-fecha" type="date">
                </div>
                <div>
                    <label class="mkt-form-label">Hora</label>
                    <input class="mkt-form-input" id="par-hora" type="time" value="09:00">
                </div>
                <div>
                    <label class="mkt-form-label">Empresa</label>
                    <select class="mkt-form-input" id="par-empresa">
                        <option value="tecnocontrol">🔵 Tecnocontrol</option>
                        <option value="akuris">🟢 Akuris</option>
                        <option value="jomar">🟡 Jomar</option>
                        <option value="otra">🟣 Otra</option>
                    </select>
                </div>
                <div>
                    <label class="mkt-form-label">Canal / Red social</label>
                    <select class="mkt-form-input" id="par-canal">
                        <option>Instagram</option>
                        <option>Facebook</option>
                        <option>Instagram + Facebook</option>
                        <option>LinkedIn</option>
                        <option>TikTok</option>
                        <option>Multicanal</option>
                    </select>
                </div>
            </div>
            <label class="mkt-form-label" style="margin-top:14px;">Copy / Texto del post</label>
            <textarea class="mkt-form-input" id="par-copy" rows="4" placeholder="Escribe el copy del post aquí... incluye hashtags y call to action" style="resize:vertical;min-height:90px;"></textarea>
            <label class="mkt-form-label">Imagen / Arte</label>
            <div class="parrilla-drop-zone" id="par-drop-zone" onclick="document.getElementById('par-img-input').click()">
                <div id="par-drop-text">🖼️ Clic para seleccionar imagen o arrastra aquí<br><span style="font-size:10px;">JPG, PNG, GIF — máx. 2MB</span></div>
                <img id="par-img-preview" class="parrilla-img-preview">
            </div>
            <input type="file" id="par-img-input" accept="image/*" style="display:none;" onchange="previewParrillaImg(this)">
            <input type="hidden" id="par-img-url">
            <label class="mkt-form-label">URL de imagen (alternativo)</label>
            <input class="mkt-form-input" id="par-img-link" type="url" placeholder="https://... (si tienes la imagen en Drive o servidor)">
            <label class="mkt-form-label">Notas / instrucciones para el diseñador</label>
            <input class="mkt-form-input" id="par-notas" type="text" placeholder="Ej: Usar paleta azul, incluir logo, formato cuadrado...">
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button class="mkt-add-btn" style="flex:1;padding:12px;" onclick="guardarPostParrilla()">GUARDAR POST</button>
                <button style="flex:1;padding:12px;border:1px solid #cbd5e1;border-radius:10px;background:#f8faff;color:#475569;font-size:12px;font-weight:700;cursor:pointer;" onclick="cerrarModalParrilla()">Cancelar</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    // Eventos de cierre al hacer clic en el fondo
    document.getElementById('modal-mkt').addEventListener('click', e => {
        if (e.target === document.getElementById('modal-mkt'))
            document.getElementById('modal-mkt').style.display = 'none';
    });
    document.getElementById('modal-parrilla').addEventListener('click', e => {
        if (e.target === document.getElementById('modal-parrilla')) cerrarModalParrilla();
    });
    document.getElementById('modal-preview-post').addEventListener('click', e => {
        if (e.target === document.getElementById('modal-preview-post'))
            document.getElementById('modal-preview-post').style.display = 'none';
    });

    // Drag & drop en zona de imagen
    document.getElementById('modal-parrilla').addEventListener('dragover', e => e.preventDefault());
    document.getElementById('modal-parrilla').addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (file && file.type.startsWith('image/')) {
            window.previewParrillaImg({ files: [file] });
        }
    });

    // Delegación de clicks para tarjetas del calendario
    document.addEventListener('click', e => {
        const editBtn = e.target.closest('[data-editid]');
        const delBtn  = e.target.closest('[data-delid]');
        const card    = e.target.closest('[data-postid]');
        if (editBtn) {
            e.stopPropagation();
            window.editarPost(editBtn.dataset.editid);
        } else if (delBtn) {
            e.stopPropagation();
            window.eliminarPost(delBtn.dataset.delid);
        } else if (card && !editBtn && !delBtn) {
            window.editarPost(card.dataset.postid);
        }
    });
})();

// ══════════════════════════════════════════════════════════════
// PARRILLA DE CONTENIDO
// ══════════════════════════════════════════════════════════════
let parrillaMes = new Date().getMonth();
let parrillaAnio = new Date().getFullYear();
let parrillaFiltroEmpresa = 'todos';
let parrillaVista = 'calendario';
let parrillaPosts = [];

const DIAS_SEMANA_PAR = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const MESES_PAR = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const EMPRESA_INFO = {
    tecnocontrol: { label:'Tecnocontrol', emoji:'🔵', class:'empresa-tecnocontrol' },
    akuris:       { label:'Akuris',       emoji:'🟢', class:'empresa-akuris' },
    jomar:        { label:'Jomar',        emoji:'🟡', class:'empresa-jomar' },
    otra:         { label:'Otra',         emoji:'🟣', class:'empresa-otra' },
};

function actualizarLabelParrilla(){
    const el = document.getElementById('parrilla-nav-label');
    if(el) el.innerText = `${MESES_PAR[parrillaMes]} ${parrillaAnio}`;
}

window.parrillaMesPrev = () => {
    parrillaMes--; if(parrillaMes<0){parrillaMes=11;parrillaAnio--;}
    actualizarLabelParrilla(); cargarParrilla();
};
window.parrillaMesNext = () => {
    parrillaMes++; if(parrillaMes>11){parrillaMes=0;parrillaAnio++;}
    actualizarLabelParrilla(); cargarParrilla();
};
window.filtrarParrilla = (empresa, btn) => {
    parrillaFiltroEmpresa = empresa;
    document.querySelectorAll('.parrilla-filtro').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderParrilla();
};
window.setVistaParrilla = (vista) => {
    parrillaVista = vista;
    const btnCal  = document.getElementById('btn-vista-cal');
    const btnList = document.getElementById('btn-vista-lista');
    btnCal.style.background    = vista==='calendario'?'#2563eb':'#ffffff';
    btnCal.style.color         = vista==='calendario'?'white':'#475569';
    btnCal.style.borderColor   = vista==='calendario'?'#2563eb':'#cbd5e1';
    btnList.style.background   = vista==='lista'?'#2563eb':'#ffffff';
    btnList.style.color        = vista==='lista'?'white':'#475569';
    btnList.style.borderColor  = vista==='lista'?'#2563eb':'#cbd5e1';
    renderParrilla();
};

async function cargarParrilla(){
    try {
        const fbP = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const mesKey = `${parrillaAnio}-${String(parrillaMes+1).padStart(2,'0')}`;
        const snap = await fbP.getDocs(fbP.query(
            fbP.collection(db,'mkt_parrilla'),
            fbP.where('mesKey','==',mesKey)
        ));
        parrillaPosts = snap.docs
            .map(d=>({id:d.id,...d.data()}))
            .sort((a,b)=>((a.fecha||'')+(a.hora||'')).localeCompare((b.fecha||'')+(b.hora||'')));
        renderParrilla();
    } catch(e){
        console.warn('[PARRILLA]', e.message);
        parrillaPosts = [];
        renderParrilla();
    }
}

function getPostsFiltrados(){
    if(parrillaFiltroEmpresa === 'todos') return parrillaPosts;
    return parrillaPosts.filter(p=>p.empresa===parrillaFiltroEmpresa);
}

function renderParrilla(){
    const content = document.getElementById('parrilla-content');
    if(!content) return;
    if(parrillaVista === 'lista') renderParrillaLista(content);
    else renderParrillaCalendario(content);
}

function postCardHTML(p){
    const info = EMPRESA_INFO[p.empresa] || EMPRESA_INFO.otra;
    const copy = (p.copy||'Sin copy').slice(0,55) + ((p.copy||'').length>55?'…':'');
    const imgThumb = (p.imgUrl||p.imgLink)
        ? `<img src="${p.imgUrl||p.imgLink}" style="width:100%;height:36px;object-fit:cover;border-radius:4px;margin-top:3px;" onerror="this.style.display='none'">`
        : '';
    return `<div class="post-card ${info.class}" data-postid="${p.id}" style="cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div class="post-card-hora">${p.hora||''} · ${info.emoji}</div>
            <div style="display:flex;gap:2px;flex-shrink:0;">
                <button class="post-card-btn" data-editid="${p.id}" title="Editar" style="background:rgba(255,255,255,0.85);border:none;border-radius:4px;width:18px;height:18px;font-size:9px;cursor:pointer;">✏️</button>
                <button class="post-card-btn" data-delid="${p.id}" title="Eliminar" style="background:rgba(255,255,255,0.85);border:none;border-radius:4px;width:18px;height:18px;font-size:9px;cursor:pointer;">🗑</button>
            </div>
        </div>
        <div class="post-card-copy">${copy}</div>
        ${imgThumb}
        <div class="post-card-canal">${p.canal||''}</div>
    </div>`;
}

function renderParrillaCalendario(content){
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const firstDay = new Date(parrillaAnio, parrillaMes, 1).getDay();
    const totalDias = new Date(parrillaAnio, parrillaMes+1, 0).getDate();
    const prevDias = new Date(parrillaAnio, parrillaMes, 0).getDate();
    const posts = getPostsFiltrados();
    const porDia = {};
    posts.forEach(p=>{
        if(!p.fecha) return;
        const dia = parseInt(p.fecha.split('-')[2]);
        if(!porDia[dia]) porDia[dia] = [];
        porDia[dia].push(p);
    });
    let html = `<div class="parrilla-grid">`;
    DIAS_SEMANA_PAR.forEach(d=>{ html+=`<div class="parrilla-dow">${d}</div>`; });
    for(let i=firstDay-1;i>=0;i--){
        html+=`<div class="parrilla-cell otro-mes"><div class="parrilla-cell-day" style="color:#d1d5db;">${prevDias-i}</div></div>`;
    }
    for(let d=1;d<=totalDias;d++){
        const esHoy = hoy.getDate()===d && hoy.getMonth()===parrillaMes && hoy.getFullYear()===parrillaAnio;
        const dPosts = porDia[d]||[];
        const fechaStr = `${parrillaAnio}-${String(parrillaMes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        html+=`<div class="parrilla-cell${esHoy?' hoy':''}">
            <div class="parrilla-cell-day">
                <span${esHoy?' style="color:#2563eb;font-weight:900;"':''}>${d}</span>
                <button class="parrilla-add-cell" onclick="abrirModalParrilla('${fechaStr}')" title="Agregar post">+</button>
            </div>
            ${dPosts.map(p=>postCardHTML(p)).join('')}
        </div>`;
    }
    const remain = (firstDay + totalDias) % 7;
    if(remain>0){
        for(let i=1;i<=7-remain;i++){
            html+=`<div class="parrilla-cell otro-mes"><div class="parrilla-cell-day" style="color:#d1d5db;">${i}</div></div>`;
        }
    }
    html+=`</div>`;
    const total = posts.length;
    const byEmp = Object.entries(EMPRESA_INFO).map(([k,v])=>{
        const n = posts.filter(p=>p.empresa===k).length;
        return n>0?`<span style="font-size:11px;">${v.emoji} ${v.label}: <b>${n}</b></span>`:'';
    }).filter(Boolean).join(' &nbsp;·&nbsp; ');
    html+=`<div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;font-size:11px;color:#64748b;">
        <span><b style="color:#1e293b;">${total}</b> posts programados</span>
        ${byEmp?`&nbsp;·&nbsp; ${byEmp}`:''}
    </div>`;
    content.innerHTML = html;
}

function renderParrillaLista(content){
    const posts = getPostsFiltrados();
    if(!posts.length){
        content.innerHTML='<div style="text-align:center;color:#94a3b8;padding:32px;font-size:12px;">Sin posts programados este mes.</div>';
        return;
    }
    content.innerHTML=`<div style="overflow-x:auto;">
    <table class="parrilla-lista">
        <thead><tr>
            <th>Fecha</th><th>Hora</th><th>Empresa</th><th>Canal</th>
            <th>Copy</th><th>Imagen</th><th>Notas</th><th>Acciones</th>
        </tr></thead>
        <tbody>
        ${posts.map(p=>{
            const info = EMPRESA_INFO[p.empresa]||EMPRESA_INFO.otra;
            const img = (p.imgUrl||p.imgLink)
                ?`<img src="${p.imgUrl||p.imgLink}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'">`
                :`<span style="color:#d1d5db;font-size:11px;">Sin imagen</span>`;
            return `<tr>
                <td style="white-space:nowrap;font-weight:700;">${p.fecha||'—'}</td>
                <td style="white-space:nowrap;">${p.hora||'—'}</td>
                <td><span class="empresa-chip ${info.class}">${info.emoji} ${info.label}</span></td>
                <td><span class="canal-chip">${p.canal||'—'}</span></td>
                <td style="max-width:220px;font-size:11px;line-height:1.4;">${p.copy||'—'}</td>
                <td>${img}</td>
                <td style="font-size:11px;color:#64748b;max-width:160px;">${p.notas||'—'}</td>
                <td>
                    <div style="display:flex;gap:4px;">
                        <button onclick="editarPost('${p.id}')" style="padding:4px 8px;background:#eff6ff;color:#2563eb;border:none;border-radius:6px;font-size:10px;cursor:pointer;">✏️</button>
                        <button onclick="eliminarPost('${p.id}')" style="padding:4px 8px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:10px;cursor:pointer;">🗑</button>
                    </div>
                </td>
            </tr>`;
        }).join('')}
        </tbody>
    </table></div>`;
}

window.abrirModalParrilla = (fechaPreset=null) => {
    document.getElementById('parrilla-edit-id').value = '';
    document.getElementById('parrilla-modal-title').innerText = '📝 Nuevo post';
    document.getElementById('par-fecha').value = fechaPreset || new Date().toISOString().slice(0,10);
    document.getElementById('par-hora').value = '09:00';
    document.getElementById('par-empresa').value = 'tecnocontrol';
    document.getElementById('par-canal').value = 'Instagram';
    document.getElementById('par-copy').value = '';
    document.getElementById('par-img-link').value = '';
    document.getElementById('par-notas').value = '';
    document.getElementById('par-img-url').value = '';
    const prev = document.getElementById('par-img-preview');
    prev.style.display='none'; prev.src='';
    document.getElementById('par-drop-text').style.display='block';
    document.getElementById('modal-parrilla').style.display='flex';
};
window.cerrarModalParrilla = () => { document.getElementById('modal-parrilla').style.display='none'; };

window.editarPost = (id) => {
    const p = parrillaPosts.find(x=>x.id===id);
    if(!p) return;
    const info = EMPRESA_INFO[p.empresa]||EMPRESA_INFO.otra;
    const imgSrc = p.imgUrl||p.imgLink||'';
    const img = document.getElementById('preview-img');
    const noImg = document.getElementById('preview-no-img');
    if(imgSrc){ img.src=imgSrc; img.style.display='block'; noImg.style.display='none'; }
    else { img.style.display='none'; noImg.style.display='flex'; noImg.style.flexDirection='column'; }
    const chip = document.getElementById('preview-empresa-chip');
    const colors = {tecnocontrol:'background:#dbeafe;color:#1e40af',akuris:'background:#dcfce7;color:#14532d',jomar:'background:#fef9c3;color:#78350f',otra:'background:#f3e8ff;color:#4c1d95'};
    chip.style.cssText = colors[p.empresa]||colors.otra;
    chip.innerHTML = `${info.emoji} ${info.label}`;
    document.getElementById('preview-meta').innerHTML = `
        <span>📅 ${p.fecha||'—'}</span>
        <span>⏰ ${p.hora||'—'}</span>
        <span>📱 ${p.canal||'—'}</span>`;
    document.getElementById('preview-copy').innerText = p.copy||'—';
    const notasEl = document.getElementById('preview-notas');
    if(p.notas){ notasEl.innerHTML=`📝 <b>Notas:</b> ${p.notas}`; notasEl.style.display='block'; }
    else notasEl.style.display='none';
    document.getElementById('preview-btn-editar').onclick = () => {
        document.getElementById('modal-preview-post').style.display='none';
        abrirEditorPost(id);
    };
    document.getElementById('preview-btn-eliminar').onclick = () => {
        document.getElementById('modal-preview-post').style.display='none';
        window.eliminarPost(id);
    };
    document.getElementById('modal-preview-post').style.display='flex';
};

window.abrirEditorPost = (id) => {
    const p = parrillaPosts.find(x=>x.id===id);
    if(!p) return;
    document.getElementById('parrilla-edit-id').value = id;
    document.getElementById('parrilla-modal-title').innerText = '✏️ Editar post';
    document.getElementById('par-fecha').value = p.fecha||'';
    document.getElementById('par-hora').value = p.hora||'09:00';
    document.getElementById('par-empresa').value = p.empresa||'tecnocontrol';
    document.getElementById('par-canal').value = p.canal||'Instagram';
    document.getElementById('par-copy').value = p.copy||'';
    document.getElementById('par-img-link').value = p.imgLink||'';
    document.getElementById('par-notas').value = p.notas||'';
    document.getElementById('par-img-url').value = p.imgUrl||'';
    const prev = document.getElementById('par-img-preview');
    const imgSrc = p.imgUrl||p.imgLink;
    if(imgSrc){ prev.src=imgSrc; prev.style.display='block'; document.getElementById('par-drop-text').style.display='none'; }
    else { prev.style.display='none'; document.getElementById('par-drop-text').style.display='block'; }
    document.getElementById('modal-parrilla').style.display='flex';
};

window.previewParrillaImg = (input) => {
    const file = input.files[0];
    if(!file) return;
    if(file.size > 2*1024*1024){ alert('La imagen es muy grande. Máximo 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        const prev = document.getElementById('par-img-preview');
        prev.src = e.target.result;
        prev.style.display='block';
        document.getElementById('par-drop-text').style.display='none';
        document.getElementById('par-img-url').value = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.guardarPostParrilla = async () => {
    const fecha = document.getElementById('par-fecha').value;
    const copy  = document.getElementById('par-copy').value.trim();
    if(!fecha){ alert('Selecciona una fecha'); return; }
    if(!copy){ alert('Escribe el copy del post'); return; }
    const mesKey = `${parrillaAnio}-${String(parrillaMes+1).padStart(2,'0')}`;
    const docData = {
        mesKey, fecha,
        hora:    document.getElementById('par-hora').value,
        empresa: document.getElementById('par-empresa').value,
        canal:   document.getElementById('par-canal').value,
        copy,
        imgUrl:  document.getElementById('par-img-url').value,
        imgLink: document.getElementById('par-img-link').value,
        notas:   document.getElementById('par-notas').value.trim(),
        creadoPor: auth.currentUser?.email||'',
        creadoEn:  new Date().toISOString(),
    };
    const btn = document.querySelector('#modal-parrilla .mkt-add-btn');
    if(btn){ btn.textContent='Guardando...'; btn.disabled=true; }
    try {
        const fbP = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const editId = document.getElementById('parrilla-edit-id').value;
        if(editId){
            await fbP.updateDoc(fbP.doc(db,'mkt_parrilla',editId), docData);
        } else {
            await fbP.addDoc(fbP.collection(db,'mkt_parrilla'), docData);
        }
        cerrarModalParrilla();
        window.mostrarPush('📅 Post guardado',`${docData.empresa} · ${fecha}`,'📣');
        cargarParrilla();
    } catch(e){ alert('Error: '+e.message); }
    finally{ if(btn){ btn.textContent='GUARDAR POST'; btn.disabled=false; } }
};

window.eliminarPost = async (id) => {
    if(!confirm('¿Eliminar este post? No se puede deshacer.')) return;
    try {
        const fbP = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        await fbP.deleteDoc(fbP.doc(db,'mkt_parrilla',id));
        window.mostrarPush('🗑 Post eliminado','','📣');
        cargarParrilla();
    } catch(e){ alert('Error: '+e.message); }
};

// ══════════════════════════════════════════════════════════════
// MÓDULO MARKETING — KPIs, campañas, stock
// ══════════════════════════════════════════════════════════════
const MKT_EMAIL   = 'mercadotecniatecnocontrol@gmail.com';
const MKT_MESES   = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MKT_SHEET_KEY = 'tc_mkt_sheet_url';
let mktMes  = new Date().getMonth();
let mktAnio = new Date().getFullYear();
let mktData = {};
let mktChartTend = null, mktChartBudget = null, mktChartMix = null;
let mktTabActual = 'kpis';
let stockCompletitudChart = null;

function puedeVerMkt(email){ return email === MKT_EMAIL || esAdminTotal(email); }
function mktKey(mes,anio){ return `${anio}-${String(mes+1).padStart(2,'0')}`; }

// Función principal: muestra u oculta el dashboard según el área

function _getMktDashHTML() {
    return `            <div id="mkt-dashboard">
                <div class="mkt-header">
                    <div class="mkt-title">📣 Indicadores Marketing
                        <span class="mkt-badge">Digital · Mensual</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#64748b;">
                            <button class="rh-mes-btn" onclick="mktMesPrev()">‹</button>
                            <span class="rh-mes-label" id="mkt-mes-label" style="min-width:90px;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;color:#1e293b;"></span>
                            <button class="rh-mes-btn" onclick="mktMesNext()">›</button>
                        </div>
                        <button class="mkt-add-btn" onclick="abrirModalMkt()">➕ Registrar datos</button>
                        <button class="mkt-add-btn" onclick="sincronizarStock()" style="background:linear-gradient(135deg,#059669,#047857);" id="btn-sync-stock">🔄 Sync Stock</button>
                    </div>
                </div>

                <!-- KPIs principales: QUITADOS TEMPORALMENTE 2026-07-20, retomar después -->

                <!-- Gráficas principales -->
                <div class="mkt-charts-row">
                    <div class="mkt-card">
                        <div class="mkt-card-title">📈 Tendencia de alcance</div>
                        <div class="mkt-card-sub">Seguidores y alcance últimos 6 meses</div>
                        <div style="height:160px;"><canvas id="mkt-chart-tendencia"></canvas></div>
                    </div>
                    <div class="mkt-card" style="text-align:center;">
                        <div class="mkt-card-title" style="text-align:left;">💰 Presupuesto</div>
                        <div class="mkt-card-sub" style="text-align:left;">Gastado vs asignado</div>
                        <div style="position:relative;width:130px;height:130px;margin:0 auto;">
                            <canvas id="mkt-chart-budget"></canvas>
                            <div id="mkt-budget-pct" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:#1e293b;">—</div>
                        </div>
                        <div id="mkt-budget-detalle" style="font-size:11px;color:#64748b;margin-top:8px;"></div>
                    </div>
                    <div class="mkt-card" style="text-align:center;">
                        <div class="mkt-card-title" style="text-align:left;">📊 Mix de canales</div>
                        <div class="mkt-card-sub" style="text-align:left;">Distribución de alcance</div>
                        <div style="position:relative;width:130px;height:130px;margin:0 auto;">
                            <canvas id="mkt-chart-mix"></canvas>
                        </div>
                        <div id="mkt-mix-leyenda" style="font-size:10px;color:#64748b;margin-top:8px;text-align:left;"></div>
                    </div>
                </div>

                <!-- Canales individuales -->
                <div class="mkt-canales">
                    <div class="mkt-canal">
                        <div class="mkt-canal-icon">📸</div>
                        <div class="mkt-canal-name">Instagram</div>
                        <div class="mkt-canal-val" id="mkt-ig-seg">—</div>
                        <div class="mkt-canal-sub">seguidores</div>
                        <div class="mkt-canal-bar"><div class="mkt-canal-fill" id="mkt-ig-bar" style="width:0%;background:linear-gradient(90deg,#e1306c,#833ab4);"></div></div>
                        <div style="font-size:10px;color:#64748b;margin-top:4px;">Alcance: <b id="mkt-ig-alc">—</b></div>
                    </div>
                    <div class="mkt-canal">
                        <div class="mkt-canal-icon">👍</div>
                        <div class="mkt-canal-name">Facebook</div>
                        <div class="mkt-canal-val" id="mkt-fb-seg">—</div>
                        <div class="mkt-canal-sub">seguidores</div>
                        <div class="mkt-canal-bar"><div class="mkt-canal-fill" id="mkt-fb-bar" style="width:0%;background:linear-gradient(90deg,#1877f2,#42a5f5);"></div></div>
                        <div style="font-size:10px;color:#64748b;margin-top:4px;">Alcance: <b id="mkt-fb-alc">—</b></div>
                    </div>
                    <div class="mkt-canal">
                        <div class="mkt-canal-icon">🔍</div>
                        <div class="mkt-canal-name">Google Ads</div>
                        <div class="mkt-canal-val" id="mkt-gads-clicks">—</div>
                        <div class="mkt-canal-sub">clics</div>
                        <div class="mkt-canal-bar"><div class="mkt-canal-fill" id="mkt-gads-bar" style="width:0%;background:linear-gradient(90deg,#4285f4,#34a853);"></div></div>
                        <div style="font-size:10px;color:#64748b;margin-top:4px;">Impresiones: <b id="mkt-gads-imp">—</b></div>
                    </div>
                    <div class="mkt-canal">
                        <div class="mkt-canal-icon">🌐</div>
                        <div class="mkt-canal-name">Sitio Web</div>
                        <div class="mkt-canal-val" id="mkt-web-vis">—</div>
                        <div class="mkt-canal-sub">visitas</div>
                        <div class="mkt-canal-bar"><div class="mkt-canal-fill" id="mkt-web-bar" style="width:0%;background:linear-gradient(90deg,#10b981,#34d399);"></div></div>
                        <div style="font-size:10px;color:#64748b;margin-top:4px;">Bounce rate: <b id="mkt-web-bounce">—</b></div>
                    </div>
                </div>

                <!-- Campañas activas -->
                <div class="mkt-campanas">
                    <div class="rh-vac-title">
                        <span>🚀 Campañas del mes</span>
                        <button class="mkt-add-btn" onclick="abrirModalMkt('campana')" style="font-size:10px;padding:5px 10px;">+ Nueva campaña</button>
                    </div>
                    <div class="mkt-camp-row header">
                        <span>Campaña</span><span>Canal</span><span>Presupuesto</span><span>Avance</span><span>Estatus</span>
                    </div>
                    <div id="mkt-campanas-lista"><div style="text-align:center;color:#94a3b8;padding:16px;font-size:12px;">Sin campañas registradas este mes</div></div>
                </div>

                <!-- Stock Tecnocontrol desde Google Sheets -->
                <div class="mkt-stock">
                    <div class="rh-vac-title">
                        <span>📦 Revisión de Artículos en Stock <span style="font-size:10px;color:#64748b;font-weight:400;">(Google Sheets)</span></span>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <span id="mkt-stock-status" style="font-size:10px;color:#94a3b8;"></span>
                            <button class="mkt-add-btn" onclick="sincronizarStock()" style="font-size:10px;padding:5px 10px;">🔄 Actualizar</button>
                            <input type="text" id="mkt-sheets-url" placeholder="URL del Google Sheet publicado (CSV)" style="font-size:11px;padding:5px 10px;border-radius:8px;border:1px solid #cbd5e1;color:#475569;width:300px;display:none;" />
                            <button onclick="configurarSheetURL()" style="font-size:10px;padding:5px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;color:#475569;" id="btn-config-sheet">⚙️ Configurar</button>
                        </div>
                    </div>
                    <div id="mkt-stock-content">
                        <div style="text-align:center;color:#94a3b8;padding:24px;font-size:12px;">
                            Configura la URL de tu Google Sheet para sincronizar el stock.<br>
                            <span style="font-size:10px;">Archivo → Publicar en la web → CSV → copiar URL</span>
                        </div>
                    </div>
                </div>

                <!-- ═══ PARRILLA DE CONTENIDO ═══════════════════════════ -->
                <div class="parrilla-wrap">
                    <div class="parrilla-header">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;color:#1e293b;">📅 Parrilla de Contenido</span>
                            <span id="parrilla-mes-label" style="font-size:12px;color:#64748b;"></span>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                            <!-- Filtros por empresa -->
                            <div class="parrilla-filtros" id="parrilla-filtros">
                                <button class="parrilla-filtro active" data-empresa="todos" onclick="filtrarParrilla('todos',this)">Todos</button>
                                <button class="parrilla-filtro" data-empresa="tecnocontrol" onclick="filtrarParrilla('tecnocontrol',this)">🔵 Tecnocontrol</button>
                                <button class="parrilla-filtro" data-empresa="akuris" onclick="filtrarParrilla('akuris',this)">🟢 Akuris</button>
                                <button class="parrilla-filtro" data-empresa="jomar" onclick="filtrarParrilla('jomar',this)">🟡 Jomar</button>
                                <button class="parrilla-filtro" data-empresa="otra" onclick="filtrarParrilla('otra',this)">🟣 Otra</button>
                            </div>
                            <!-- Nav mes -->
                            <div style="display:flex;align-items:center;gap:6px;">
                                <button class="rh-mes-btn" onclick="parrillaMesPrev()">‹</button>
                                <span id="parrilla-nav-label" style="font-size:12px;font-weight:700;color:#1e293b;min-width:90px;text-align:center;"></span>
                                <button class="rh-mes-btn" onclick="parrillaMesNext()">›</button>
                            </div>
                            <!-- Vista -->
                            <div style="display:flex;gap:4px;">
                                <button id="btn-vista-cal" onclick="setVistaParrilla('calendario')" style="padding:5px 10px;border-radius:8px;border:1px solid #2563eb;background:#2563eb;color:white;font-size:11px;font-weight:700;cursor:pointer;">📅 Calendario</button>
                                <button id="btn-vista-lista" onclick="setVistaParrilla('lista')" style="padding:5px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:11px;font-weight:700;cursor:pointer;">📋 Lista</button>
                            </div>
                            <button class="mkt-add-btn" onclick="abrirModalParrilla()">➕ Nuevo post</button>
                        </div>
                    </div>
                    <!-- Contenido: calendario o lista -->
                    <div id="parrilla-content"></div>
                </div>
            </div>
`;
}

export function toggleMktDash(area, email){
    // Inyectar HTML del dashboard si aún no existe
    if(!document.getElementById('mkt-dashboard')){
        const rhDash = document.getElementById('rh-dashboard');
        const htmlDash = _getMktDashHTML();
        if(rhDash){
            rhDash.insertAdjacentHTML('beforebegin', htmlDash);
        } else {
            document.body.insertAdjacentHTML('beforeend', htmlDash);
        }
    }
    const dash = document.getElementById('mkt-dashboard');
    if(!dash) return;
    if(area === 'Marketing' && puedeVerMkt(email)){
        dash.style.display = 'block';
        actualizarLabelMesMkt();
        cargarDatosMkt();
        actualizarLabelParrilla();
        cargarParrilla();
    } else {
        dash.style.display = 'none';
    }
}

function actualizarLabelMesMkt(){
    const el = document.getElementById('mkt-mes-label');
    if(el) el.innerText = `${MKT_MESES[mktMes]} ${mktAnio}`;
}

window.mktMesPrev = () => { mktMes--; if(mktMes<0){mktMes=11;mktAnio--;} actualizarLabelMesMkt(); cargarDatosMkt(); };
window.mktMesNext = () => { mktMes++; if(mktMes>11){mktMes=0;mktAnio++;} actualizarLabelMesMkt(); cargarDatosMkt(); };

async function cargarDatosMkt(){
    const key = mktKey(mktMes, mktAnio);
    try {
        const fb = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const d = { kpis:{}, canales:{}, presupuesto:{}, campanas:[] };
        for(const tipo of ['kpis','canales','presupuesto']){
            const ref = fb.doc(db,'mkt_indicadores',`${key}_${tipo}`);
            const snap = await fb.getDoc(ref);
            if(snap.exists()){
                const data = snap.data();
                if(tipo==='kpis') d.kpis = data;
                else if(tipo==='canales') d.canales = data;
                else if(tipo==='presupuesto') d.presupuesto = data;
            }
        }
        const snapQ = await fb.getDocs(fb.query(fb.collection(db,'mkt_indicadores'), fb.where('mesAnio','==',key)));
        snapQ.docs.forEach(docSnap => {
            const data = docSnap.data();
            if(data.tipo==='kpis' && !d.kpis.alcance) d.kpis = data;
            else if(data.tipo==='canales' && !d.canales.igSeg) d.canales = data;
            else if(data.tipo==='presupuesto' && !d.presupuesto.asignado) d.presupuesto = data;
            else if(data.tipo==='campana') d.campanas.push({id:docSnap.id,...data});
        });
        mktData[key] = d;
        renderMktDash(d, key);
    } catch(e){
        console.warn('[MKT]', e.message);
        renderMktDash({ kpis:{}, canales:{}, presupuesto:{}, campanas:[] }, key);
    }
}

const fmtNum = n => { if(!n&&n!==0) return '—'; if(n>=1000000) return (n/1000000).toFixed(1)+'M'; if(n>=1000) return (n/1000).toFixed(1)+'k'; return n; };
const fmtPct = n => n ? n+'%' : '—';
const fmtMXN = n => n ? '$'+Number(n).toLocaleString('es-MX') : '—';

function mktDelta(curr, prev, invertido=false){
    if(!prev||prev===0) return `<span class="mkt-kpi-delta neutral">— Sin comparativo</span>`;
    const diff=curr-prev; const pct=Math.abs(Math.round(diff/prev*100));
    const sube=diff>0; const bueno=invertido?!sube:sube;
    return `<span class="mkt-kpi-delta ${bueno?'up-good':'up-bad'}">${sube?'▲':'▼'} ${pct}% vs mes anterior</span>`;
}

function renderMktDash(d, key){
    // Guard: si el dashboard no está en el DOM todavía, no hacer nada
    if(!document.getElementById('mkt-dashboard')) return;
    const prevKey = mktKey(mktMes-1<0?11:mktMes-1, mktMes-1<0?mktAnio-1:mktAnio);
    const prev = mktData[prevKey]||{};
    const kpis = d.kpis||{}; const prevKpis = prev.kpis||{};
    const canales = d.canales||{}; const budget = d.presupuesto||{};

    const segTotal = (Number(canales.igSeg||0)+Number(canales.fbSeg||0));
    // KPIs principales QUITADOS TEMPORALMENTE 2026-07-20 (grid .mkt-kpis eliminado del HTML).
    // Lógica conservada aquí comentada para retomar después:
    // document.getElementById('mkt-val-seguidores').innerText = fmtNum(segTotal||kpis.seguidores||0);
    // document.getElementById('mkt-delta-seguidores').innerHTML = mktDelta(segTotal||kpis.seguidores, (prev.canales?.igSeg||0)+(prev.canales?.fbSeg||0)+(prevKpis.seguidores||0));
    // document.getElementById('mkt-val-alcance').innerText = fmtNum(kpis.alcance||0);
    // document.getElementById('mkt-delta-alcance').innerHTML = mktDelta(kpis.alcance, prevKpis.alcance);
    // document.getElementById('mkt-val-engagement').innerText = fmtPct(kpis.engagement);
    // document.getElementById('mkt-delta-engagement').innerHTML = mktDelta(kpis.engagement, prevKpis.engagement);
    // document.getElementById('mkt-val-leads').innerText = fmtNum(kpis.leads||0);
    // document.getElementById('mkt-delta-leads').innerHTML = mktDelta(kpis.leads, prevKpis.leads);
    // document.getElementById('mkt-val-conversiones').innerText = fmtNum(kpis.conversiones||0);
    // document.getElementById('mkt-delta-conversiones').innerHTML = mktDelta(kpis.conversiones, prevKpis.conversiones);

    const budgetUsado = Number(budget.gastado||0);
    const budgetTotal = Number(budget.asignado||0);
    const budgetPct = budgetTotal>0 ? Math.round(budgetUsado/budgetTotal*100) : 0;
    // document.getElementById('mkt-val-presupuesto').innerText = fmtMXN(budgetUsado);
    // document.getElementById('mkt-delta-presupuesto').innerHTML = budgetTotal>0
    //     ? `<span class="mkt-kpi-delta ${budgetPct>90?'up-bad':'neutral'}">${budgetPct}% de ${fmtMXN(budgetTotal)}</span>`
    //     : `<span class="mkt-kpi-delta neutral">— Sin presupuesto registrado</span>`;

    // Dona presupuesto
    const elBudget = document.getElementById('mkt-chart-budget');
    if(elBudget){
        if(mktChartBudget) mktChartBudget.destroy();
        mktChartBudget = new Chart(elBudget,{
            type:'doughnut',
            data:{datasets:[{data:[budgetUsado, Math.max(0.001,budgetTotal-budgetUsado)],
                backgroundColor:['#2563eb','#e2e8f0'],borderWidth:0}]},
            options:{cutout:'76%',plugins:{legend:{display:false}},animation:{duration:600}}
        });
        document.getElementById('mkt-budget-pct').innerText = budgetPct+'%';
        document.getElementById('mkt-budget-detalle').innerHTML =
            `Gastado: <b style="color:#2563eb;">${fmtMXN(budgetUsado)}</b><br>Disponible: <b style="color:#16a34a;">${fmtMXN(budgetTotal-budgetUsado)}</b>`;
    }

    // Canales individuales
    const igSeg=Number(canales.igSeg||0), fbSeg=Number(canales.fbSeg||0);
    const maxSeg=Math.max(igSeg,fbSeg,1);
    document.getElementById('mkt-ig-seg').innerText = fmtNum(igSeg);
    document.getElementById('mkt-ig-alc').innerText = fmtNum(canales.igAlc||0);
    document.getElementById('mkt-ig-bar').style.width = Math.round(igSeg/maxSeg*100)+'%';
    document.getElementById('mkt-fb-seg').innerText = fmtNum(fbSeg);
    document.getElementById('mkt-fb-alc').innerText = fmtNum(canales.fbAlc||0);
    document.getElementById('mkt-fb-bar').style.width = Math.round(fbSeg/maxSeg*100)+'%';
    const gadsClicks=Number(canales.gadsClicks||0), gadsImp=Number(canales.gadsImp||0);
    document.getElementById('mkt-gads-clicks').innerText = fmtNum(gadsClicks);
    document.getElementById('mkt-gads-imp').innerText = fmtNum(gadsImp);
    document.getElementById('mkt-gads-bar').style.width = Math.min(100,Math.round(gadsClicks/Math.max(gadsImp,1)*100))+'%';
    const webVis=Number(canales.webVis||0);
    document.getElementById('mkt-web-vis').innerText = fmtNum(webVis);
    document.getElementById('mkt-web-bounce').innerText = fmtPct(canales.webBounce);
    document.getElementById('mkt-web-bar').style.width = '100%';

    // Dona mix canales
    const elMix = document.getElementById('mkt-chart-mix');
    if(elMix){
        if(mktChartMix) mktChartMix.destroy();
        mktChartMix = new Chart(elMix,{
            type:'doughnut',
            data:{datasets:[{data:[Number(canales.igAlc||0),Number(canales.fbAlc||0),Number(canales.gadsImp||0),Number(canales.webVis||0)],
                backgroundColor:['#e1306c','#1877f2','#4285f4','#10b981'],borderWidth:2,borderColor:'#ffffff'}]},
            options:{cutout:'60%',plugins:{legend:{display:false}},animation:{duration:600}}
        });
        document.getElementById('mkt-mix-leyenda').innerHTML =
            `<span style="color:#e1306c;">● IG</span> &nbsp;
             <span style="color:#1877f2;">● FB</span> &nbsp;
             <span style="color:#4285f4;">● Ads</span> &nbsp;
             <span style="color:#10b981;">● Web</span>`;
    }

    // Gráfica tendencia 6 meses
    const elTend = document.getElementById('mkt-chart-tendencia');
    if(elTend){
        if(mktChartTend) mktChartTend.destroy();
        const labels=[], segHist=[], alcHist=[];
        for(let i=5;i>=0;i--){
            let m=mktMes-i; let a=mktAnio;
            if(m<0){m+=12;a--;}
            labels.push(MKT_MESES[m].slice(0,3));
            const k=mktKey(m,a);
            const kd=mktData[k]?.kpis||{};
            const cd=mktData[k]?.canales||{};
            segHist.push((Number(cd.igSeg||0)+Number(cd.fbSeg||0))||kd.seguidores||0);
            alcHist.push(kd.alcance||0);
        }
        mktChartTend = new Chart(elTend,{
            type:'line',
            data:{labels,datasets:[
                {label:'Seguidores',data:segHist,borderColor:'#e1306c',backgroundColor:'rgba(225,48,108,0.08)',tension:0.4,borderWidth:2,pointRadius:3,fill:true,yAxisID:'y'},
                {label:'Alcance',data:alcHist,borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,0.06)',tension:0.4,borderWidth:2,pointRadius:3,fill:true,yAxisID:'y1'}
            ]},
            options:{responsive:true,maintainAspectRatio:false,
                plugins:{legend:{position:'bottom',labels:{boxWidth:8,font:{size:10},color:'#64748b'}}},
                scales:{
                    y:{position:'left',beginAtZero:false,ticks:{color:'#94a3b8',font:{size:9}},grid:{color:'rgba(59,130,246,0.05)'}},
                    y1:{position:'right',beginAtZero:true,ticks:{color:'#94a3b8',font:{size:9}},grid:{display:false}}
                }
            }
        });
    }

    // Campañas
    const campLista = document.getElementById('mkt-campanas-lista');
    if(campLista){
        if(!(d.campanas||[]).length){
            campLista.innerHTML='<div style="text-align:center;color:#94a3b8;padding:16px;font-size:12px;">Sin campañas registradas</div>';
        } else {
            campLista.innerHTML = (d.campanas||[]).sort((a,b)=>new Date(b.creadoEn)-new Date(a.creadoEn)).map(camp=>{
                const gastado=Number(camp.gastado||0), presupuesto=Number(camp.presupuesto||0);
                const pct=presupuesto>0?Math.round(gastado/presupuesto*100):0;
                return `<div class="mkt-camp-row">
                    <div>
                        <div style="font-weight:700;color:#1e293b;">${camp.nombre||'—'}</div>
                        <div style="font-size:10px;color:#64748b;">${camp.objetivo||''}</div>
                    </div>
                    <span class="camp-status camp-${camp.estatus||'planeada'}">${camp.estatus||'planeada'}</span>
                    <div>
                        <div style="font-size:11px;color:#1e293b;">${fmtMXN(gastado)} <span style="color:#94a3b8;">/ ${fmtMXN(presupuesto)}</span></div>
                        <div class="mkt-budget-bar"><div class="mkt-budget-fill" style="width:${pct}%;background:${pct>90?'#ef4444':'#2563eb'};"></div></div>
                    </div>
                    <div style="font-size:11px;color:#64748b;">${camp.canal||'—'}</div>
                    <div style="font-size:11px;color:#64748b;">${camp.fechaFin||'—'}</div>
                </div>`;
            }).join('');
        }
    }
}

// Formularios por tab
const MKT_FORMS = {
    kpis: `
        <p style="font-size:11px;color:#64748b;margin-bottom:4px;">Datos de resumen mensual</p>
        <div class="mkt-form-grid">
            <div><label class="mkt-form-label">Alcance total mensual</label><input class="mkt-form-input" id="mkt-f-alcance" type="number" placeholder="Ej: 45000"></div>
            <div><label class="mkt-form-label">Engagement rate (%)</label><input class="mkt-form-input" id="mkt-f-engagement" type="number" step="0.1" placeholder="Ej: 3.5"></div>
            <div><label class="mkt-form-label">Leads generados</label><input class="mkt-form-input" id="mkt-f-leads" type="number" placeholder="Ej: 24"></div>
            <div><label class="mkt-form-label">Conversiones</label><input class="mkt-form-input" id="mkt-f-conversiones" type="number" placeholder="Ej: 8"></div>
            <div><label class="mkt-form-label">Publicaciones realizadas</label><input class="mkt-form-input" id="mkt-f-posts" type="number" placeholder="Ej: 12"></div>
            <div><label class="mkt-form-label">Seguidores totales</label><input class="mkt-form-input" id="mkt-f-seguidores" type="number" placeholder="Ej: 3200"></div>
        </div>
        <label class="mkt-form-label">Notas del mes</label>
        <input class="mkt-form-input" id="mkt-f-notas" type="text" placeholder="Ej: Lanzamos campaña Semana Santa">`,
    canales: `
        <p style="font-size:11px;color:#64748b;margin-bottom:4px;">Datos por canal</p>
        <div style="font-weight:700;color:#e1306c;font-size:11px;margin:10px 0 4px;">📸 Instagram</div>
        <div class="mkt-form-grid">
            <div><label class="mkt-form-label">Seguidores</label><input class="mkt-form-input" id="mkt-f-igSeg" type="number" placeholder="Ej: 1850"></div>
            <div><label class="mkt-form-label">Alcance mensual</label><input class="mkt-form-input" id="mkt-f-igAlc" type="number" placeholder="Ej: 12000"></div>
        </div>
        <div style="font-weight:700;color:#1877f2;font-size:11px;margin:10px 0 4px;">👍 Facebook</div>
        <div class="mkt-form-grid">
            <div><label class="mkt-form-label">Seguidores / Me gusta</label><input class="mkt-form-input" id="mkt-f-fbSeg" type="number" placeholder="Ej: 2400"></div>
            <div><label class="mkt-form-label">Alcance mensual</label><input class="mkt-form-input" id="mkt-f-fbAlc" type="number" placeholder="Ej: 18000"></div>
        </div>
        <div style="font-weight:700;color:#4285f4;font-size:11px;margin:10px 0 4px;">🔍 Google Ads</div>
        <div class="mkt-form-grid">
            <div><label class="mkt-form-label">Impresiones</label><input class="mkt-form-input" id="mkt-f-gadsImp" type="number" placeholder="Ej: 35000"></div>
            <div><label class="mkt-form-label">Clics</label><input class="mkt-form-input" id="mkt-f-gadsClicks" type="number" placeholder="Ej: 980"></div>
        </div>
        <div style="font-weight:700;color:#10b981;font-size:11px;margin:10px 0 4px;">🌐 Sitio Web</div>
        <div class="mkt-form-grid">
            <div><label class="mkt-form-label">Visitas</label><input class="mkt-form-input" id="mkt-f-webVis" type="number" placeholder="Ej: 1200"></div>
            <div><label class="mkt-form-label">Bounce rate (%)</label><input class="mkt-form-input" id="mkt-f-webBounce" type="number" step="0.1" placeholder="Ej: 48.5"></div>
        </div>`,
    presupuesto: `
        <div class="mkt-form-grid">
            <div><label class="mkt-form-label">Presupuesto asignado ($)</label><input class="mkt-form-input" id="mkt-f-presAsig" type="number" placeholder="Ej: 15000"></div>
            <div><label class="mkt-form-label">Presupuesto gastado ($)</label><input class="mkt-form-input" id="mkt-f-presGast" type="number" placeholder="Ej: 8500"></div>
            <div><label class="mkt-form-label">Gasto Meta Ads ($)</label><input class="mkt-form-input" id="mkt-f-gastMeta" type="number" placeholder="Ej: 4000"></div>
            <div><label class="mkt-form-label">Gasto Google Ads ($)</label><input class="mkt-form-input" id="mkt-f-gastGoogle" type="number" placeholder="Ej: 3500"></div>
            <div><label class="mkt-form-label">Gasto SWM / Agencia ($)</label><input class="mkt-form-input" id="mkt-f-gastSwm" type="number" placeholder="Ej: 1000"></div>
            <div><label class="mkt-form-label">Otros gastos ($)</label><input class="mkt-form-input" id="mkt-f-gastOtros" type="number" placeholder="Ej: 0"></div>
        </div>`,
    campana: `
        <div class="mkt-form-grid">
            <div style="grid-column:span 2"><label class="mkt-form-label">Nombre de la campaña</label><input class="mkt-form-input" id="mkt-f-campNombre" type="text" placeholder="Ej: Campaña Semana Santa 2026"></div>
            <div><label class="mkt-form-label">Canal principal</label>
                <select class="mkt-form-input" id="mkt-f-campCanal">
                    <option>Instagram</option><option>Facebook</option><option>Google Ads</option>
                    <option>Meta Ads</option><option>Email</option><option>Multicanal</option>
                </select>
            </div>
            <div><label class="mkt-form-label">Estatus</label>
                <select class="mkt-form-input" id="mkt-f-campEstatus">
                    <option value="planeada">Planeada</option>
                    <option value="activa">Activa</option>
                    <option value="pausada">Pausada</option>
                    <option value="finalizada">Finalizada</option>
                </select>
            </div>
            <div><label class="mkt-form-label">Presupuesto asignado ($)</label><input class="mkt-form-input" id="mkt-f-campPres" type="number"></div>
            <div><label class="mkt-form-label">Gastado hasta hoy ($)</label><input class="mkt-form-input" id="mkt-f-campGast" type="number"></div>
            <div><label class="mkt-form-label">Fecha inicio</label><input class="mkt-form-input" id="mkt-f-campInicio" type="date"></div>
            <div><label class="mkt-form-label">Fecha fin</label><input class="mkt-form-input" id="mkt-f-campFin" type="date"></div>
        </div>
        <label class="mkt-form-label">Objetivo de la campaña</label>
        <input class="mkt-form-input" id="mkt-f-campObj" type="text" placeholder="Ej: Aumentar reconocimiento de marca">`
};

window.abrirModalMkt = (tab='kpis') => {
    mktTabActual = tab;
    document.querySelectorAll('.mkt-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('onclick').includes(`'${tab}'`));
    });
    document.getElementById('mkt-form-container').innerHTML = MKT_FORMS[tab]||'';
    document.getElementById('modal-mkt').style.display = 'flex';
    const key = mktKey(mktMes, mktAnio);
    const d = mktData[key];
    if(d && tab==='kpis' && d.kpis){
        ['alcance','engagement','leads','conversiones','posts','seguidores','notas'].forEach(f=>{
            const el = document.getElementById('mkt-f-'+f);
            if(el && d.kpis[f]) el.value = d.kpis[f];
        });
    }
    if(d && tab==='canales' && d.canales){
        ['igSeg','igAlc','fbSeg','fbAlc','gadsImp','gadsClicks','webVis','webBounce'].forEach(f=>{
            const el = document.getElementById('mkt-f-'+f);
            if(el && d.canales[f]) el.value = d.canales[f];
        });
    }
};

window.mktTabSwitch = (tab, btn) => {
    mktTabActual = tab;
    document.querySelectorAll('.mkt-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('mkt-form-container').innerHTML = MKT_FORMS[tab]||'';
};

window.guardarDatoMkt = async () => {
    const key = mktKey(mktMes, mktAnio);
    const btn = document.querySelector('#modal-mkt .mkt-add-btn');
    if(btn){ btn.textContent='Guardando...'; btn.disabled=true; }
    try {
        const base = { mesAnio:key, creadoEn:new Date().toISOString(), creadoPor:auth.currentUser?.email||'' };
        const get = id => { const el=document.getElementById(id); return el?el.value:''; };
        const getNum = id => Number(get(id))||0;
        const getIfFilled = id => { const v=get(id); return v!==''?v:undefined; };
        const getNumIfFilled = id => { const v=getNum(id); return v!==0?v:undefined; };
        const fb = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const docId = `${key}_${mktTabActual}`;
        const docRef = fb.doc(db,'mkt_indicadores',docId);
        let newData = {...base, tipo:mktTabActual};
        if(mktTabActual==='kpis'){
            const fields = { alcance:getNumIfFilled('mkt-f-alcance'), engagement:getNumIfFilled('mkt-f-engagement'),
                leads:getNumIfFilled('mkt-f-leads'), conversiones:getNumIfFilled('mkt-f-conversiones'),
                posts:getNumIfFilled('mkt-f-posts'), seguidores:getNumIfFilled('mkt-f-seguidores'), notas:getIfFilled('mkt-f-notas') };
            Object.keys(fields).forEach(k => { if(fields[k]!==undefined) newData[k]=fields[k]; });
        } else if(mktTabActual==='canales'){
            const fields = { igSeg:getNumIfFilled('mkt-f-igSeg'), igAlc:getNumIfFilled('mkt-f-igAlc'),
                fbSeg:getNumIfFilled('mkt-f-fbSeg'), fbAlc:getNumIfFilled('mkt-f-fbAlc'),
                gadsImp:getNumIfFilled('mkt-f-gadsImp'), gadsClicks:getNumIfFilled('mkt-f-gadsClicks'),
                webVis:getNumIfFilled('mkt-f-webVis'), webBounce:getNumIfFilled('mkt-f-webBounce') };
            Object.keys(fields).forEach(k => { if(fields[k]!==undefined) newData[k]=fields[k]; });
        } else if(mktTabActual==='presupuesto'){
            const fields = { asignado:getNumIfFilled('mkt-f-presAsig'), gastado:getNumIfFilled('mkt-f-presGast'),
                gastMeta:getNumIfFilled('mkt-f-gastMeta'), gastGoogle:getNumIfFilled('mkt-f-gastGoogle'),
                gastSwm:getNumIfFilled('mkt-f-gastSwm'), gastOtros:getNumIfFilled('mkt-f-gastOtros') };
            Object.keys(fields).forEach(k => { if(fields[k]!==undefined) newData[k]=fields[k]; });
        } else if(mktTabActual==='campana'){
            await fb.addDoc(fb.collection(db,'mkt_indicadores'),{...base, tipo:'campana',
                nombre:get('mkt-f-campNombre'), canal:get('mkt-f-campCanal'),
                estatus:get('mkt-f-campEstatus'), presupuesto:getNum('mkt-f-campPres'),
                gastado:getNum('mkt-f-campGast'), fechaInicio:get('mkt-f-campInicio'),
                fechaFin:get('mkt-f-campFin'), objetivo:get('mkt-f-campObj')
            });
            document.getElementById('modal-mkt').style.display='none';
            window.mostrarPush('✅ Campaña guardada','','📣');
            cargarDatosMkt(); return;
        }
        await fb.setDoc(docRef, newData, { merge:true });
        document.getElementById('modal-mkt').style.display='none';
        window.mostrarPush('✅ Dato Marketing guardado',`Registro de ${mktTabActual} guardado`,'📣');
        cargarDatosMkt();
    } catch(e){ alert('Error: '+e.message); }
    finally{ if(btn){ btn.textContent='GUARDAR'; btn.disabled=false; } }
};

// Google Sheets: sincronizar stock
window.configurarSheetURL = () => {
    const input = document.getElementById('mkt-sheets-url');
    const btn = document.getElementById('btn-config-sheet');
    if(input.style.display==='none'){
        input.style.display='inline-block';
        const saved = localStorage.getItem(MKT_SHEET_KEY)||'';
        if(saved) input.value = saved;
        btn.textContent='✅ Guardar URL';
    } else {
        const url = input.value.trim();
        if(url){ localStorage.setItem(MKT_SHEET_KEY, url); sincronizarStock(); }
        input.style.display='none';
        btn.textContent='⚙️ Configurar';
    }
};

window.sincronizarStock = async () => {
    const url = localStorage.getItem(MKT_SHEET_KEY);
    const status = document.getElementById('mkt-stock-status');
    const content = document.getElementById('mkt-stock-content');
    if(!url){ if(status) status.innerText='⚠️ Configura la URL primero'; return; }
    if(status) status.innerText='🔄 Sincronizando...';
    try {
        const r = await fetch(url);
        if(!r.ok) throw new Error('No se pudo leer el archivo');
        const text = await r.text();
        const parseCSVRow = row => {
            const result=[]; let cur=''; let inQ=false;
            for(let i=0;i<row.length;i++){
                const ch=row[i];
                if(ch==='"'){inQ=!inQ;}
                else if(ch===','&&!inQ){result.push(cur.trim());cur='';}
                else{cur+=ch;}
            }
            result.push(cur.trim());
            return result;
        };
        const lines = text.split('\n').filter(l=>l.trim());
        if(lines.length<2) throw new Error('El archivo parece vacío');
        let headerLineIdx=0;
        for(let i=0;i<Math.min(5,lines.length);i++){
            const row=parseCSVRow(lines[i]).map(h=>h.replace(/"/g,'').trim().toLowerCase());
            if(row.some(h=>/articulo|nombre|sku|codigo|linea|completo|producto/.test(h))){
                headerLineIdx=i; break;
            }
        }
        const headers = parseCSVRow(lines[headerLineIdx]).map(h=>h.replace(/"/g,'').trim());
        const datos = lines.slice(headerLineIdx+1).map(line=>{
            const vals=parseCSVRow(line);
            return Object.fromEntries(headers.map((h,i)=>[h,(vals[i]||'').replace(/"/g,'').trim()]));
        }).filter(d=>Object.values(d).some(v=>v));
        const colCompleto = headers.find(h=>/esta.*completo/i.test(h))||headers.find(h=>/^completo$/i.test(h));
        const colTipo = headers.find(h=>/^linea$/i.test(h))||headers.find(h=>/^tipo$/i.test(h))||headers.find(h=>/linea|tipo|categ/i.test(h));
        const esCompleto = v => /^(verdadero|true|1|si|sí|yes|completo)$/i.test((v||'').trim());
        const completos = datos.filter(d=>colCompleto&&esCompleto(d[colCompleto]));
        const incompletos = datos.filter(d=>colCompleto&&!esCompleto(d[colCompleto]));
        const total = datos.length;
        const pctCompleto = total>0?Math.round(completos.length/total*100):0;
        const porTipo = {};
        if(colTipo){
            datos.forEach(d=>{
                const tipo=d[colTipo]||'Sin tipo';
                if(!porTipo[tipo]) porTipo[tipo]={total:0,completos:0};
                porTipo[tipo].total++;
                if(colCompleto&&esCompleto(d[colCompleto])) porTipo[tipo].completos++;
            });
        }
        const tiposOrdenados = Object.entries(porTipo).sort((a,b)=>b[1].total-a[1].total).slice(0,8);
        const coloresTipo = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#e1306c','#1877f2','#059669'];
        if(status) status.innerText=`✅ ${total} artículos · ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`;
        content.innerHTML=`
        <div style="display:grid;grid-template-columns:220px 1fr;gap:20px;align-items:start;margin-bottom:20px;">
            <div style="text-align:center;">
                <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:4px;">Completitud del catálogo</div>
                <div style="font-size:10px;color:#64748b;margin-bottom:12px;">Artículos con datos completos</div>
                <div style="position:relative;width:160px;height:160px;margin:0 auto;">
                    <canvas id="chart-completitud"></canvas>
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
                        <div style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${pctCompleto>=80?'#16a34a':pctCompleto>=50?'#f59e0b':'#ef4444'};">${pctCompleto}%</div>
                        <div style="font-size:10px;color:#64748b;">completado</div>
                    </div>
                </div>
                <div style="margin-top:12px;display:flex;justify-content:center;gap:14px;font-size:11px;">
                    <span><span style="color:#16a34a;font-weight:700;">✅ ${completos.length}</span> completos</span>
                    <span><span style="color:#ef4444;font-weight:700;">⬜ ${incompletos.length}</span> pendientes</span>
                </div>
            </div>
            <div>
                <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:12px;">Completitud por tipo de producto</div>
                ${tiposOrdenados.map(([tipo,data],i)=>{
                    const pct=data.total>0?Math.round(data.completos/data.total*100):0;
                    const color=coloresTipo[i%coloresTipo.length];
                    return `<div style="margin-bottom:10px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                            <span style="font-size:12px;font-weight:600;color:#1e293b;">${tipo}</span>
                            <span style="font-size:11px;color:#64748b;">${data.completos}/${data.total} &nbsp;<b style="color:${pct>=80?'#16a34a':pct>=50?'#f59e0b':'#ef4444'};">${pct}%</b></span>
                        </div>
                        <div style="height:7px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                            <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.8s ease;"></div>
                        </div>
                    </div>`;
                }).join('')}
                ${tiposOrdenados.length===0?'<div style="color:#94a3b8;font-size:12px;">No se detectó columna "Tipo" en el Sheet</div>':''}
            </div>
        </div>
        ${pctCompleto===100?'<div style="text-align:center;padding:12px;color:#16a34a;font-weight:700;font-size:13px;">🎉 ¡Todos los artículos están completos!</div>':''}`;
        const elDona = document.getElementById('chart-completitud');
        if(elDona){
            if(stockCompletitudChart) stockCompletitudChart.destroy();
            stockCompletitudChart = new Chart(elDona,{
                type:'doughnut',
                data:{datasets:[{
                    data:[completos.length,Math.max(0.001,incompletos.length)],
                    backgroundColor:[pctCompleto>=80?'#16a34a':pctCompleto>=50?'#f59e0b':'#ef4444','#e2e8f0'],
                    borderWidth:0
                }]},
                options:{cutout:'76%',plugins:{legend:{display:false}},animation:{duration:800}}
            });
        }
    } catch(e){
        if(status) status.innerText='❌ Error al sincronizar';
        content.innerHTML=`<div style="text-align:center;color:#ef4444;padding:16px;font-size:12px;">
            Error: ${e.message}<br>
            <span style="color:#94a3b8;font-size:10px;">Verifica que el Sheet esté publicado como CSV</span>
        </div>`;
    }
};

// ══════════════════════════════════════════════════════════════
// MÓDULO SOLICITUDES DE MERCADOTECNIA — Fase 1
// Modal XXL tipo wizard + folio automático + Firestore + panel de
// seguimiento (visible para todos los empleados).
// Colección: mkt_solicitudes  ·  Subcolección: mkt_solicitudes/{id}/adjuntos
// Contador de folio: contadores/mkt_solicitudes  { anio, ultimo }
// ══════════════════════════════════════════════════════════════

const MSOL_TIPOS = [
    {id:'diseno_grafico', icon:'🎨', label:'Diseño gráfico'},
    {id:'redes_sociales', icon:'📱', label:'Diseño para redes sociales'},
    {id:'desarrollo_web',  icon:'🌐', label:'Desarrollo Web'},
    {id:'landing',         icon:'🖥',  label:'Landing Page'},
    {id:'mod_web',         icon:'🔧', label:'Modificación de página web'},
    {id:'fotografia',      icon:'📷', label:'Fotografía'},
    {id:'video',           icon:'🎥', label:'Video'},
    {id:'edicion_video',   icon:'✂️', label:'Edición de video'},
    {id:'branding',        icon:'🏷', label:'Branding'},
    {id:'manuales',        icon:'📘', label:'Manuales'},
    {id:'presentaciones',  icon:'📊', label:'Presentaciones'},
    {id:'flyers',          icon:'📄', label:'Flyers'},
    {id:'banners',         icon:'🖼', label:'Banners'},
    {id:'publicidad',      icon:'📢', label:'Publicidad'},
    {id:'campanas',        icon:'🚀', label:'Campañas'},
    {id:'mailing',         icon:'✉️', label:'Mailing'},
    {id:'renderizados',    icon:'🧊', label:'Renderizados'},
    {id:'logos',           icon:'⭐', label:'Logos'},
    {id:'catalogos',       icon:'📚', label:'Catálogos'},
    {id:'cotizaciones',    icon:'💵', label:'Cotizaciones'},
    {id:'material_pop',    icon:'🛍', label:'Material POP'},
    {id:'impresiones',     icon:'🖨', label:'Impresiones'},
    {id:'lonas',           icon:'🏳️', label:'Lonas'},
    {id:'rotulacion',      icon:'🚚', label:'Rotulación'},
    {id:'senaletica',      icon:'🪧', label:'Señalética'},
    {id:'credenciales',    icon:'🪪', label:'Credenciales'},
    {id:'certificados',    icon:'📜', label:'Certificados'},
    {id:'invitaciones',    icon:'💌', label:'Invitaciones'},
    {id:'com_interna',     icon:'📣', label:'Comunicación interna'},
    {id:'rh',              icon:'🧑‍💼', label:'Recursos Humanos'},
    {id:'eventos',         icon:'🎪', label:'Eventos'},
    {id:'otro',            icon:'📦', label:'Otro'}
];
const MSOL_PRIORIDADES = [
    {id:'baja',    label:'Baja',    color:'#64748b'},
    {id:'normal',  label:'Normal',  color:'#2563eb'},
    {id:'alta',    label:'Alta',    color:'#f59e0b'},
    {id:'urgente', label:'Urgente', color:'#ef4444'},
    {id:'critica', label:'Crítica', color:'#7c3aed'}
];
const MSOL_MEDIOS = ['Digital','Impreso','Web','Pantalla','Redes Sociales','Correo','Otro'];
const MSOL_ALCANCE = [
    'Crear desde cero','Modificar diseño existente','Actualizar información','Adaptar diseño',
    'Rediseñar','Optimizar','Corregir errores','Solo impresión','Solo publicación','Solo revisión'
];
const MSOL_ESTADOS = ['Nueva','En revisión','Pendiente de información','Asignada','En diseño','En desarrollo',
    'En revisión interna','Correcciones','Aprobada','En producción','Finalizada','Entregada','Cancelada'];
const MSOL_MAX_FILE_BYTES = 900 * 1024; // límite seguro por archivo (base64 en Firestore, doc ≤ 1MB, deja margen para metadata)

let msolPaso = 1;
const MSOL_TOTAL_PASOS = 6;
let msolData = {};
let msolArchivos = [];    // [{nombre,tipo,size,base64}]
let msolReferencias = []; // [{nombre,tipo,size,base64}] (imágenes de inspiración)
let msolEnviando = false;

// ── CSS del módulo de solicitudes ────────────────────────────
(function inyectarCSSMsol() {
    if (document.getElementById('css-msol')) return;
    const style = document.createElement('style');
    style.id = 'css-msol';
    style.textContent = `
        #modal-msol{display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(10px);z-index:4000;align-items:center;justify-content:center;}
        .msol-box{background:#ffffff;border-radius:24px;width:960px;max-width:96vw;max-height:92vh;box-shadow:0 30px 80px rgba(0,0,0,0.25);display:flex;flex-direction:column;overflow:hidden;}
        .msol-topbar{display:flex;align-items:center;justify-content:space-between;padding:22px 30px;border-bottom:1px solid #eef2f7;flex-shrink:0;}
        .msol-topbar-title{font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:10px;}
        .msol-topbar-sub{font-size:12px;color:#94a3b8;margin-top:2px;font-weight:500;}
        .msol-folio-badge{background:#eff6ff;color:#2563eb;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;letter-spacing:0.5px;}
        .msol-close{width:34px;height:34px;border-radius:10px;border:none;background:#f1f5f9;color:#64748b;font-size:16px;cursor:pointer;transition:0.15s;}
        .msol-close:hover{background:#e2e8f0;color:#1e293b;}
        .msol-steps{display:flex;gap:6px;padding:16px 30px;border-bottom:1px solid #eef2f7;flex-shrink:0;overflow-x:auto;}
        .msol-step-pill{display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:24px;background:#f8faff;color:#94a3b8;font-size:11px;font-weight:700;white-space:nowrap;transition:0.2s;}
        .msol-step-pill .n{width:18px;height:18px;border-radius:50%;background:#e2e8f0;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:10px;}
        .msol-step-pill.done{color:#16a34a;}
        .msol-step-pill.done .n{background:#16a34a;}
        .msol-step-pill.active{background:#eff6ff;color:#2563eb;}
        .msol-step-pill.active .n{background:#2563eb;}
        .msol-body{padding:28px 30px;overflow-y:auto;flex:1;background:#fbfcfe;}
        .msol-section-title{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;display:flex;align-items:center;gap:8px;}
        .msol-section-sub{font-size:12px;color:#94a3b8;margin-bottom:18px;}
        .msol-card{background:#ffffff;border-radius:16px;padding:20px 22px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.04);margin-bottom:16px;}
        .msol-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .msol-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
        .msol-label{font-size:10px;font-weight:700;color:#64748b;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;display:block;}
        .msol-input,.msol-select,.msol-textarea{width:100%;padding:11px 14px;border-radius:10px;border:1px solid rgba(59,130,246,0.18);background:#f8faff;color:#1e293b;font-size:13px;outline:none;font-family:'DM Sans',sans-serif;transition:0.15s;}
        .msol-input:focus,.msol-select:focus,.msol-textarea:focus{border-color:#2563eb;background:#eff6ff;}
        .msol-textarea{resize:vertical;min-height:70px;line-height:1.5;}
        .msol-field{margin-bottom:14px;}
        .msol-tipos-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
        .msol-tipo-card{border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 8px;text-align:center;cursor:pointer;transition:0.15s;background:#ffffff;}
        .msol-tipo-card:hover{border-color:#93c5fd;background:#f8faff;}
        .msol-tipo-card.sel{border-color:#2563eb;background:#eff6ff;box-shadow:0 0 0 3px rgba(37,99,235,0.12);}
        .msol-tipo-icon{font-size:20px;margin-bottom:4px;}
        .msol-tipo-label{font-size:9.5px;font-weight:700;color:#475569;line-height:1.25;}
        .msol-chip-group{display:flex;flex-wrap:wrap;gap:8px;}
        .msol-chip{padding:7px 13px;border-radius:20px;border:1.5px solid #e2e8f0;background:#ffffff;color:#475569;font-size:11.5px;font-weight:700;cursor:pointer;transition:0.15s;}
        .msol-chip.sel{background:#2563eb;color:#ffffff;border-color:#2563eb;}
        .msol-prioridad-group{display:flex;gap:8px;}
        .msol-prioridad-chip{flex:1;padding:10px;border-radius:12px;border:1.5px solid #e2e8f0;text-align:center;font-size:11px;font-weight:700;cursor:pointer;transition:0.15s;color:#64748b;}
        .msol-prioridad-chip.sel{color:#ffffff;border-color:transparent;}
        .msol-semaforo{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;font-size:12px;font-weight:700;margin-top:10px;}
        .msol-semaforo.verde{background:#f0fdf4;color:#16a34a;}
        .msol-semaforo.amarillo{background:#fefce8;color:#a16207;}
        .msol-semaforo.rojo{background:#fef2f2;color:#dc2626;}
        .msol-semaforo .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
        .msol-semaforo.verde .dot{background:#16a34a;} .msol-semaforo.amarillo .dot{background:#eab308;} .msol-semaforo.rojo .dot{background:#ef4444;}
        .msol-drop{border:2px dashed #cbd5e1;border-radius:16px;padding:32px 20px;text-align:center;color:#94a3b8;font-size:12.5px;cursor:pointer;transition:0.2s;background:#fafcff;}
        .msol-drop:hover,.msol-drop.dragover{border-color:#2563eb;color:#2563eb;background:#eff6ff;}
        .msol-drop .big{font-size:26px;margin-bottom:6px;}
        .msol-files-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:14px;}
        .msol-file-item{border:1px solid #e2e8f0;border-radius:12px;padding:8px;background:#ffffff;position:relative;text-align:center;}
        .msol-file-thumb{width:100%;height:64px;object-fit:cover;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:6px;}
        .msol-file-name{font-size:9.5px;color:#475569;word-break:break-all;line-height:1.3;max-height:24px;overflow:hidden;}
        .msol-file-size{font-size:9px;color:#94a3b8;}
        .msol-file-del{position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:#fef2f2;color:#dc2626;border:none;font-size:11px;cursor:pointer;font-weight:700;}
        .msol-checklist-item{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;margin-bottom:8px;font-size:12.5px;font-weight:600;}
        .msol-checklist-item.ok{background:#f0fdf4;color:#16a34a;}
        .msol-checklist-item.warn{background:#fffbeb;color:#b45309;}
        .msol-footer{display:flex;gap:10px;padding:18px 30px;border-top:1px solid #eef2f7;flex-shrink:0;background:#ffffff;}
        .msol-btn-primary{padding:12px 22px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;border:none;border-radius:12px;font-size:12.5px;font-weight:700;cursor:pointer;transition:0.15s;}
        .msol-btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(37,99,235,0.35);}
        .msol-btn-secondary{padding:12px 20px;background:#f1f5f9;color:#475569;border:none;border-radius:12px;font-size:12.5px;font-weight:700;cursor:pointer;}
        .msol-btn-ghost{padding:12px 18px;background:transparent;color:#94a3b8;border:none;font-size:12px;font-weight:700;cursor:pointer;}
        .msol-nav-btn{width:38px;height:38px;border-radius:50%;flex-shrink:0;}
        #msol-toast{position:fixed;top:20px;right:20px;background:#1e293b;color:#ffffff;padding:14px 20px;border-radius:12px;font-size:12.5px;font-weight:600;z-index:5000;box-shadow:0 12px 30px rgba(0,0,0,0.25);display:none;}
        /* Panel de seguimiento */
        .msol-track-wrap{background:#ffffff;border-radius:16px;padding:18px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.05);margin-bottom:16px;}
        .msol-track-row{display:grid;grid-template-columns:1.1fr 1.4fr 1fr 0.8fr 0.9fr 0.9fr;padding:11px 12px;border-radius:10px;font-size:12px;align-items:center;margin-bottom:6px;border:1px solid rgba(59,130,246,0.06);cursor:pointer;transition:0.15s;}
        .msol-track-row.header{background:#f8faff;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;border:none;cursor:default;}
        .msol-track-row:not(.header):hover{background:#f8faff;}
        .msol-estado-badge{padding:3px 9px;border-radius:10px;font-size:10px;font-weight:700;display:inline-block;background:#eff6ff;color:#2563eb;}
        @media(max-width:768px){
            .msol-box{width:100vw;max-height:100vh;border-radius:0;}
            .msol-grid2,.msol-grid3{grid-template-columns:1fr;}
            .msol-tipos-grid{grid-template-columns:repeat(2,1fr);}
            .msol-prioridad-group{flex-wrap:wrap;}
            .msol-track-row{grid-template-columns:1fr 1fr;font-size:11px;}
            .msol-track-row span:nth-child(n+3){display:none;}
        }
    `;
    document.head.appendChild(style);
})();

// ── HTML del modal (shell fijo: topbar + steps + body + footer) ──
(function inyectarModalMsol() {
    if (document.getElementById('modal-msol')) return;
    const html = `
    <div id="modal-msol">
        <div class="msol-box">
            <div class="msol-topbar">
                <div>
                    <div class="msol-topbar-title">📋 Solicitudes de Mercadotecnia
                        <span class="msol-folio-badge" id="msol-folio-badge" style="display:none;"></span>
                    </div>
                    <div class="msol-topbar-sub">Centro de gestión de requerimientos para el Departamento de Mercadotecnia</div>
                </div>
                <button class="msol-close" onclick="msolCerrar()">✕</button>
            </div>
            <div class="msol-steps" id="msol-steps"></div>
            <div class="msol-body" id="msol-body"></div>
            <div class="msol-footer" id="msol-footer">
                <button class="msol-btn-ghost" onclick="msolCerrar()">Cancelar</button>
                <div style="flex:1;"></div>
                <button class="msol-btn-secondary" onclick="msolGuardarBorrador()">💾 Guardar borrador</button>
                <button class="msol-btn-secondary msol-nav-btn-anterior" onclick="msolIrPaso(msolPaso-1)" style="display:none;" id="msol-btn-anterior">‹ Anterior</button>
                <button class="msol-btn-primary" onclick="msolSiguiente()" id="msol-btn-siguiente">Siguiente ›</button>
            </div>
        </div>
    </div>
    <div id="msol-toast"></div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
})();

// ── Utilidades ────────────────────────────────────────────────
function msolToast(msg){
    const t = document.getElementById('msol-toast');
    if(!t) return;
    t.innerText = msg;
    t.style.display = 'block';
    clearTimeout(window._msolToastTimer);
    window._msolToastTimer = setTimeout(()=>{ t.style.display='none'; }, 3200);
}
function msolFileToBase64(file){
    return new Promise((resolve,reject)=>{
        const r = new FileReader();
        r.onload = ()=>resolve(r.result);
        r.onerror = ()=>reject(new Error('No se pudo leer el archivo'));
        r.readAsDataURL(file);
    });
}
function msolIconoArchivo(tipo, nombre){
    if(/image\//.test(tipo)) return null; // se muestra la miniatura real
    if(/pdf/.test(tipo)||/\.pdf$/i.test(nombre)) return '📕';
    if(/\.(ai|psd|indd)$/i.test(nombre)) return '🎨';
    if(/\.(docx?|xlsx?|pptx?)$/i.test(nombre)) return '📄';
    if(/\.(zip|rar)$/i.test(nombre)) return '🗜';
    if(/\.(mp4|mov)$/i.test(nombre)||/video\//.test(tipo)) return '🎬';
    return '📎';
}

// ── Abrir / cerrar modal ──────────────────────────────────────
function abrirModalSolicitudMkt(){
    msolPaso = 1;
    msolData = {
        general:{}, proyecto:{}, tecnico:{medios:[]}, fechas:{}, alcance:[], aprobacion:{}, presupuesto:{}, comentarios:''
    };
    msolArchivos = [];
    msolReferencias = [];
    msolEnviando = false;
    document.getElementById('msol-folio-badge').style.display = 'none';
    const modal = document.getElementById('modal-msol');
    modal.style.display = 'flex';
    msolIrPaso(1);
}
function msolCerrar(){
    const modal = document.getElementById('modal-msol');
    if(modal) modal.style.display = 'none';
}

// ── Navegación del wizard ─────────────────────────────────────
const MSOL_PASOS_LABEL = ['Información general','Proyecto','Especificaciones y fechas','Archivos e inspiración','Alcance y aprobación','Revisión final'];

function msolRenderSteps(){
    const cont = document.getElementById('msol-steps');
    cont.innerHTML = MSOL_PASOS_LABEL.map((label,i)=>{
        const n = i+1;
        const cls = n===msolPaso?'active':(n<msolPaso?'done':'');
        return `<div class="msol-step-pill ${cls}"><span class="n">${n<msolPaso?'✓':n}</span>${label}</div>`;
    }).join('');
}

function msolIrPaso(n){
    if(n < 1 || n > MSOL_TOTAL_PASOS) return;
    if(n > msolPaso && !msolValidarPaso(msolPaso)) return; // solo valida al avanzar
    if(msolPaso >= 1 && msolPaso <= MSOL_TOTAL_PASOS) msolGuardarPaso(msolPaso);
    msolPaso = n;
    msolRenderSteps();
    document.getElementById('msol-body').innerHTML = msolHTMLPaso(n);
    document.getElementById('msol-body').scrollTop = 0;
    msolBindPaso(n);
    document.getElementById('msol-btn-anterior').style.display = n>1 ? 'inline-block' : 'none';
    document.getElementById('msol-btn-siguiente').innerText = n===MSOL_TOTAL_PASOS ? '✅ Enviar solicitud' : 'Siguiente ›';
    document.getElementById('msol-btn-siguiente').onclick = n===MSOL_TOTAL_PASOS ? msolEnviarSolicitud : msolSiguiente;
}
function msolSiguiente(){ msolIrPaso(msolPaso+1); }

// ── Recolectar datos del paso actual desde el DOM ────────────
function msolGuardarPaso(n){
    const val = id => (document.getElementById(id)||{}).value || '';
    if(n===1){
        msolData.general = {
            solicitante: val('msol-solicitante'), departamento: val('msol-departamento'),
            empresa: val('msol-empresa'), sucursal: val('msol-sucursal'), responsable: val('msol-responsable'),
            correo: val('msol-correo'), telefono: val('msol-telefono'), extension: val('msol-extension'),
            prioridad: msolData.general?.prioridad || 'normal', tipo: msolData.general?.tipo || null
        };
    } else if(n===2){
        msolData.proyecto = {
            titulo: val('msol-titulo'), descripcion: val('msol-descripcion'), objetivo: val('msol-objetivo'),
            problema: val('msol-problema'), uso: val('msol-uso'), publico: val('msol-publico'),
            mensaje: val('msol-mensaje'), cta: val('msol-cta')
        };
    } else if(n===3){
        msolData.tecnico = {
            medidas: val('msol-medidas'), formato: val('msol-formato'), colores: val('msol-colores'),
            tipografia: val('msol-tipografia'), idioma: val('msol-idioma'), resolucion: val('msol-resolucion'),
            cantidad: val('msol-cantidad'), medios: msolData.tecnico?.medios || []
        };
        msolData.fechas = {
            solicitada: val('msol-fecha-solicitada'), limite: val('msol-fecha-limite'),
            evento: val('msol-fecha-evento'), publicacion: val('msol-fecha-publicacion')
        };
    } else if(n===5){
        msolData.alcance = msolData.alcance || [];
        msolData.aprobacion = { nombre: val('msol-aprueba-nombre'), puesto: val('msol-aprueba-puesto'), correo: val('msol-aprueba-correo') };
        msolData.presupuesto = { tiene: msolData.presupuesto?.tiene || 'no', monto: val('msol-presupuesto-monto'), proveedor: val('msol-presupuesto-proveedor') };
        msolData.comentarios = val('msol-comentarios');
    }
}

// ── Validación mínima por paso (obligatorios) ─────────────────
function msolValidarPaso(n){
    msolGuardarPaso(n);
    if(n===1){
        const g = msolData.general;
        if(!g.solicitante || !g.departamento || !g.correo || !g.tipo){
            msolToast('⚠️ Completa solicitante, departamento, correo y tipo de solicitud'); return false;
        }
    }
    if(n===2){
        if(!msolData.proyecto.titulo || !msolData.proyecto.descripcion){
            msolToast('⚠️ El título y la descripción del proyecto son obligatorios'); return false;
        }
    }
    return true;
}

// ── HTML por paso ─────────────────────────────────────────────
function msolHTMLPaso(n){
    if(n===1) return msolHTMLPaso1();
    if(n===2) return msolHTMLPaso2();
    if(n===3) return msolHTMLPaso3();
    if(n===4) return msolHTMLPaso4();
    if(n===5) return msolHTMLPaso5();
    if(n===6) return msolHTMLPaso6();
    return '';
}

function msolHTMLPaso1(){
    const g = msolData.general||{};
    const hoy = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
    return `
    <div class="msol-section-title">👤 Información general</div>
    <div class="msol-section-sub">Fecha de solicitud: ${hoy}</div>
    <div class="msol-card">
        <div class="msol-grid2">
            <div class="msol-field"><label class="msol-label">Solicitante *</label><input class="msol-input" id="msol-solicitante" value="${g.solicitante||''}" placeholder="Nombre completo"></div>
            <div class="msol-field"><label class="msol-label">Departamento *</label><input class="msol-input" id="msol-departamento" value="${g.departamento||''}" placeholder="Ej. Ventas, RH, Operaciones"></div>
            <div class="msol-field"><label class="msol-label">Empresa</label><input class="msol-input" id="msol-empresa" value="${g.empresa||''}" placeholder="Tecnocontrol / Akuris / Jomar"></div>
            <div class="msol-field"><label class="msol-label">Sucursal</label><input class="msol-input" id="msol-sucursal" value="${g.sucursal||''}"></div>
            <div class="msol-field"><label class="msol-label">Responsable directo</label><input class="msol-input" id="msol-responsable" value="${g.responsable||''}"></div>
            <div class="msol-field"><label class="msol-label">Correo *</label><input class="msol-input" id="msol-correo" value="${g.correo||''}" placeholder="tucorreo@tecnocontrol.com.mx"></div>
            <div class="msol-field"><label class="msol-label">Teléfono</label><input class="msol-input" id="msol-telefono" value="${g.telefono||''}"></div>
            <div class="msol-field"><label class="msol-label">Extensión</label><input class="msol-input" id="msol-extension" value="${g.extension||''}"></div>
        </div>
        <div class="msol-field">
            <label class="msol-label">Prioridad</label>
            <div class="msol-prioridad-group" id="msol-prioridad-group">
                ${MSOL_PRIORIDADES.map(p=>`<div class="msol-prioridad-chip ${g.prioridad===p.id?'sel':''}" style="${g.prioridad===p.id?`background:${p.color};`:''}" onclick="msolSetPrioridad('${p.id}')">${p.label}</div>`).join('')}
            </div>
        </div>
    </div>
    <div class="msol-card">
        <div class="msol-label" style="margin-bottom:10px;">Tipo de solicitud *</div>
        <div class="msol-tipos-grid" id="msol-tipos-grid">
            ${MSOL_TIPOS.map(t=>`<div class="msol-tipo-card ${g.tipo===t.id?'sel':''}" onclick="msolSetTipo('${t.id}')"><div class="msol-tipo-icon">${t.icon}</div><div class="msol-tipo-label">${t.label}</div></div>`).join('')}
        </div>
    </div>`;
}
function msolSetPrioridad(id){
    msolData.general = msolData.general || {};
    msolData.general.prioridad = id;
    document.getElementById('msol-prioridad-group').querySelectorAll('.msol-prioridad-chip').forEach((el,i)=>{
        const p = MSOL_PRIORIDADES[i];
        const sel = p.id===id;
        el.classList.toggle('sel', sel);
        el.style.background = sel ? p.color : '';
    });
}
function msolSetTipo(id){
    msolData.general = msolData.general || {};
    msolData.general.tipo = id;
    document.getElementById('msol-tipos-grid').querySelectorAll('.msol-tipo-card').forEach((el,i)=>{
        el.classList.toggle('sel', MSOL_TIPOS[i].id===id);
    });
}

function msolHTMLPaso2(){
    const p = msolData.proyecto||{};
    return `
    <div class="msol-section-title">🗂 Información del proyecto</div>
    <div class="msol-section-sub">Cuéntanos qué necesitas y para qué se usará</div>
    <div class="msol-card">
        <div class="msol-field"><label class="msol-label">Título del proyecto *</label><input class="msol-input" id="msol-titulo" value="${p.titulo||''}" placeholder="Ej. Flyer promoción de verano"></div>
        <div class="msol-field"><label class="msol-label">Descripción completa *</label><textarea class="msol-textarea" id="msol-descripcion" placeholder="Describe con detalle qué necesitas">${p.descripcion||''}</textarea></div>
        <div class="msol-grid2">
            <div class="msol-field"><label class="msol-label">¿Qué problema busca resolver?</label><textarea class="msol-textarea" id="msol-problema">${p.problema||''}</textarea></div>
            <div class="msol-field"><label class="msol-label">Objetivo</label><textarea class="msol-textarea" id="msol-objetivo">${p.objetivo||''}</textarea></div>
        </div>
        <div class="msol-grid2">
            <div class="msol-field"><label class="msol-label">¿Para qué será utilizado?</label><input class="msol-input" id="msol-uso" value="${p.uso||''}"></div>
            <div class="msol-field"><label class="msol-label">Público objetivo</label><input class="msol-input" id="msol-publico" value="${p.publico||''}"></div>
        </div>
        <div class="msol-grid2">
            <div class="msol-field"><label class="msol-label">Mensaje principal</label><input class="msol-input" id="msol-mensaje" value="${p.mensaje||''}"></div>
            <div class="msol-field"><label class="msol-label">Llamado a la acción</label><input class="msol-input" id="msol-cta" value="${p.cta||''}"></div>
        </div>
    </div>`;
}

function msolHTMLPaso3(){
    const t = msolData.tecnico||{medios:[]};
    const f = msolData.fechas||{};
    return `
    <div class="msol-section-title">⚙️ Especificaciones técnicas</div>
    <div class="msol-section-sub">Medidas, formato y medio donde se publicará</div>
    <div class="msol-card">
        <div class="msol-grid3">
            <div class="msol-field"><label class="msol-label">Medidas</label><input class="msol-input" id="msol-medidas" value="${t.medidas||''}" placeholder="Ej. 90x60cm"></div>
            <div class="msol-field"><label class="msol-label">Formato requerido</label><input class="msol-input" id="msol-formato" value="${t.formato||''}" placeholder="PDF, JPG, MP4..."></div>
            <div class="msol-field"><label class="msol-label">Cantidad</label><input class="msol-input" id="msol-cantidad" value="${t.cantidad||''}"></div>
            <div class="msol-field"><label class="msol-label">Colores</label><input class="msol-input" id="msol-colores" value="${t.colores||''}"></div>
            <div class="msol-field"><label class="msol-label">Tipografía</label><input class="msol-input" id="msol-tipografia" value="${t.tipografia||''}"></div>
            <div class="msol-field"><label class="msol-label">Idioma</label><input class="msol-input" id="msol-idioma" value="${t.idioma||'Español'}"></div>
            <div class="msol-field"><label class="msol-label">Resolución</label><input class="msol-input" id="msol-resolucion" value="${t.resolucion||''}"></div>
        </div>
        <div class="msol-field">
            <label class="msol-label">Medio de publicación</label>
            <div class="msol-chip-group" id="msol-medios-group">
                ${MSOL_MEDIOS.map(m=>`<div class="msol-chip ${(t.medios||[]).includes(m)?'sel':''}" onclick="msolToggleMedio('${m}')">${m}</div>`).join('')}
            </div>
        </div>
    </div>
    <div class="msol-card">
        <div class="msol-label" style="margin-bottom:10px;">Fechas</div>
        <div class="msol-grid2">
            <div class="msol-field"><label class="msol-label">Fecha solicitada</label><input type="date" class="msol-input" id="msol-fecha-solicitada" value="${f.solicitada||new Date().toISOString().slice(0,10)}"></div>
            <div class="msol-field"><label class="msol-label">Fecha límite</label><input type="date" class="msol-input" id="msol-fecha-limite" value="${f.limite||''}" onchange="msolActualizarSemaforo()"></div>
            <div class="msol-field"><label class="msol-label">Fecha del evento</label><input type="date" class="msol-input" id="msol-fecha-evento" value="${f.evento||''}"></div>
            <div class="msol-field"><label class="msol-label">Fecha de publicación</label><input type="date" class="msol-input" id="msol-fecha-publicacion" value="${f.publicacion||''}"></div>
        </div>
        <div id="msol-semaforo-cont">${msolHTMLSemaforo(f.limite)}</div>
    </div>`;
}
function msolToggleMedio(m){
    msolData.tecnico = msolData.tecnico || {medios:[]};
    msolData.tecnico.medios = msolData.tecnico.medios || [];
    const i = msolData.tecnico.medios.indexOf(m);
    if(i>-1) msolData.tecnico.medios.splice(i,1); else msolData.tecnico.medios.push(m);
    document.querySelectorAll('#msol-medios-group .msol-chip').forEach(el=>{
        if(el.innerText===m) el.classList.toggle('sel', msolData.tecnico.medios.includes(m));
    });
}
function msolCalcularSemaforo(fechaLimite){
    if(!fechaLimite) return {nivel:'sin-fecha', dias:null};
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const lim = new Date(fechaLimite+'T00:00:00');
    const dias = Math.round((lim-hoy)/86400000);
    let nivel = 'verde';
    if(dias < 2) nivel = 'rojo'; else if(dias <= 7) nivel = 'amarillo';
    return {nivel, dias};
}
function msolHTMLSemaforo(fechaLimite){
    const r = msolCalcularSemaforo(fechaLimite);
    if(r.nivel==='sin-fecha') return `<div class="msol-semaforo" style="background:#f8faff;color:#94a3b8;"><span class="dot" style="background:#cbd5e1;"></span>Indica la fecha límite para ver el semáforo de tiempos</div>`;
    const msg = r.dias<0 ? `Fecha límite vencida hace ${Math.abs(r.dias)} día(s)` : (r.dias===0?'La fecha límite es hoy':`Quedan ${r.dias} día(s) para la fecha límite`);
    return `<div class="msol-semaforo ${r.nivel}"><span class="dot"></span>${msg}</div>`;
}
function msolActualizarSemaforo(){
    const v = document.getElementById('msol-fecha-limite').value;
    document.getElementById('msol-semaforo-cont').innerHTML = msolHTMLSemaforo(v);
}

function msolHTMLPaso4(){
    return `
    <div class="msol-section-title">📎 Carga de archivos</div>
    <div class="msol-section-sub">PNG, JPG, SVG, PDF, AI, PSD, INDD, DOCX, XLSX, PPTX, ZIP, RAR, MP4, MOV — máx. ~900KB por archivo</div>
    <div class="msol-card">
        <div class="msol-drop" id="msol-drop-archivos" onclick="document.getElementById('msol-input-archivos').click()">
            <div class="big">☁️</div>Arrastra tus archivos aquí o haz clic para buscarlos
            <input type="file" id="msol-input-archivos" multiple style="display:none;">
        </div>
        <div class="msol-files-list" id="msol-lista-archivos"></div>
    </div>
    <div class="msol-section-title" style="margin-top:6px;">✨ Inspiración / referencias</div>
    <div class="msol-section-sub">Imágenes de referencia y enlaces (Pinterest, Behance, Dribbble, Instagram, Figma...)</div>
    <div class="msol-card">
        <div class="msol-drop" id="msol-drop-referencias" onclick="document.getElementById('msol-input-referencias').click()">
            <div class="big">🖼</div>Sube imágenes de inspiración
            <input type="file" id="msol-input-referencias" multiple accept="image/*" style="display:none;">
        </div>
        <div class="msol-files-list" id="msol-lista-referencias"></div>
        <div class="msol-field" style="margin-top:14px;"><label class="msol-label">Enlaces de referencia</label><input class="msol-input" id="msol-referencia-links" value="${msolData.referenciaLinks||''}" placeholder="Pega uno o varios enlaces separados por coma"></div>
        <div class="msol-field"><label class="msol-label">"Quiero algo parecido a..."</label><textarea class="msol-textarea" id="msol-referencia-texto">${msolData.referenciaTexto||''}</textarea></div>
    </div>`;
}
function msolBindDropzone(dropId, inputId, arrRef, listId){
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    if(!drop || !input) return;
    input.onchange = e => msolProcesarArchivos(e.target.files, arrRef, listId);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('dragover'); };
    drop.ondragleave = () => drop.classList.remove('dragover');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('dragover'); msolProcesarArchivos(e.dataTransfer.files, arrRef, listId); };
}
async function msolProcesarArchivos(fileList, arrRef, listId){
    for(const file of Array.from(fileList)){
        if(file.size > MSOL_MAX_FILE_BYTES){
            msolToast(`⚠️ "${file.name}" pesa más de 900KB. Comprímelo antes de subirlo.`);
            continue;
        }
        try{
            const base64 = await msolFileToBase64(file);
            arrRef.push({nombre:file.name, tipo:file.type, size:file.size, base64});
        }catch(e){ msolToast('❌ Error al leer '+file.name); }
    }
    msolRenderListaArchivos(arrRef, listId);
}
function msolRenderListaArchivos(arr, listId){
    const cont = document.getElementById(listId);
    if(!cont) return;
    cont.innerHTML = arr.map((f,i)=>{
        const icono = msolIconoArchivo(f.tipo, f.nombre);
        const thumb = icono ? `<div class="msol-file-thumb">${icono}</div>` : `<img class="msol-file-thumb" src="${f.base64}" style="object-fit:cover;">`;
        return `<div class="msol-file-item">
            <button class="msol-file-del" onclick="msolEliminarArchivo('${listId}',${i})">✕</button>
            ${thumb}
            <div class="msol-file-name">${f.nombre}</div>
            <div class="msol-file-size">${(f.size/1024).toFixed(0)} KB</div>
        </div>`;
    }).join('');
}
function msolEliminarArchivo(listId, idx){
    const arr = listId==='msol-lista-archivos' ? msolArchivos : msolReferencias;
    arr.splice(idx,1);
    msolRenderListaArchivos(arr, listId);
}

function msolHTMLPaso5(){
    const al = msolData.alcance||[];
    const ap = msolData.aprobacion||{};
    const pr = msolData.presupuesto||{};
    return `
    <div class="msol-section-title">🎯 Alcance del trabajo</div>
    <div class="msol-card">
        <div class="msol-chip-group" id="msol-alcance-group">
            ${MSOL_ALCANCE.map(a=>`<div class="msol-chip ${al.includes(a)?'sel':''}" onclick="msolToggleAlcance('${a}')">${a}</div>`).join('')}
        </div>
    </div>
    <div class="msol-section-title" style="margin-top:6px;">✅ Aprobaciones</div>
    <div class="msol-card">
        <div class="msol-grid3">
            <div class="msol-field"><label class="msol-label">Nombre</label><input class="msol-input" id="msol-aprueba-nombre" value="${ap.nombre||''}"></div>
            <div class="msol-field"><label class="msol-label">Puesto</label><input class="msol-input" id="msol-aprueba-puesto" value="${ap.puesto||''}"></div>
            <div class="msol-field"><label class="msol-label">Correo</label><input class="msol-input" id="msol-aprueba-correo" value="${ap.correo||''}"></div>
        </div>
    </div>
    <div class="msol-section-title" style="margin-top:6px;">💰 Presupuesto</div>
    <div class="msol-card">
        <div class="msol-field">
            <label class="msol-label">¿Tiene presupuesto asignado?</label>
            <div class="msol-chip-group">
                <div class="msol-chip ${pr.tiene==='si'?'sel':''}" onclick="msolSetPresupuesto('si')">Sí</div>
                <div class="msol-chip ${(!pr.tiene||pr.tiene==='no')?'sel':''}" onclick="msolSetPresupuesto('no')">No</div>
            </div>
        </div>
        <div class="msol-grid2">
            <div class="msol-field"><label class="msol-label">Monto</label><input class="msol-input" id="msol-presupuesto-monto" value="${pr.monto||''}" placeholder="$"></div>
            <div class="msol-field"><label class="msol-label">Proveedor</label><input class="msol-input" id="msol-presupuesto-proveedor" value="${pr.proveedor||''}"></div>
        </div>
    </div>
    <div class="msol-section-title" style="margin-top:6px;">💬 Comentarios</div>
    <div class="msol-card"><textarea class="msol-textarea" id="msol-comentarios" style="min-height:90px;" placeholder="Observaciones adicionales">${msolData.comentarios||''}</textarea></div>`;
}
function msolToggleAlcance(a){
    msolData.alcance = msolData.alcance || [];
    const i = msolData.alcance.indexOf(a);
    if(i>-1) msolData.alcance.splice(i,1); else msolData.alcance.push(a);
    document.querySelectorAll('#msol-alcance-group .msol-chip').forEach(el=>{
        if(el.innerText===a) el.classList.toggle('sel', msolData.alcance.includes(a));
    });
}
function msolSetPresupuesto(v){
    msolGuardarPaso(5); // conserva lo ya escrito (comentarios, aprobación, monto, etc.) antes de re-pintar
    msolData.presupuesto = msolData.presupuesto || {};
    msolData.presupuesto.tiene = v;
    document.getElementById('msol-body').innerHTML = msolHTMLPaso5();
}

function msolHTMLPaso6(){
    msolGuardarPaso(5);
    const g = msolData.general||{}, p = msolData.proyecto||{}, f = msolData.fechas||{};
    const check = (cond,label) => `<div class="msol-checklist-item ${cond?'ok':'warn'}">${cond?'✅':'⚠️'} ${label}</div>`;
    const tieneLogo = msolArchivos.some(a=>/logo/i.test(a.nombre)) || msolReferencias.some(a=>/logo/i.test(a.nombre));
    const tieneFotos = msolArchivos.some(a=>/image\//.test(a.tipo));
    const tipoLabel = (MSOL_TIPOS.find(t=>t.id===g.tipo)||{}).label || '—';
    return `
    <div class="msol-section-title">🔎 Revisión final</div>
    <div class="msol-section-sub">Verifica que no falte información antes de enviar</div>
    <div class="msol-card">
        <div class="msol-checklist-item ${p.objetivo||p.problema?'ok':'warn'}">${p.objetivo||p.problema?'✅':'⚠️'} Objetivo del proyecto indicado</div>
        ${check(tieneFotos || msolArchivos.length>0, 'Archivos adjuntos')}
        ${check(tieneLogo, 'Logotipo detectado entre los archivos (si aplica)')}
        ${check(!!p.descripcion, 'Descripción del proyecto completa')}
        ${check(!!(msolData.tecnico&&msolData.tecnico.medidas), 'Medidas indicadas (si aplica)')}
        ${check(!!f.limite, 'Fecha límite indicada')}
    </div>
    <div class="msol-card">
        <div class="msol-grid2" style="font-size:12.5px;color:#475569;">
            <div><b>Solicitante:</b> ${g.solicitante||'—'}</div>
            <div><b>Departamento:</b> ${g.departamento||'—'}</div>
            <div><b>Tipo:</b> ${tipoLabel}</div>
            <div><b>Prioridad:</b> ${g.prioridad||'normal'}</div>
            <div><b>Proyecto:</b> ${p.titulo||'—'}</div>
            <div><b>Fecha límite:</b> ${f.limite||'—'}</div>
            <div><b>Archivos:</b> ${msolArchivos.length}</div>
            <div><b>Referencias:</b> ${msolReferencias.length}</div>
        </div>
        ${msolHTMLSemaforo(f.limite)}
    </div>
    <div style="text-align:center;color:#94a3b8;font-size:11.5px;">Al hacer clic en "Enviar solicitud" se generará un folio y no podrás editar la información general.</div>`;
}

function msolBindPaso(n){
    if(n===4){
        msolRenderListaArchivos(msolArchivos, 'msol-lista-archivos');
        msolRenderListaArchivos(msolReferencias, 'msol-lista-referencias');
        msolBindDropzone('msol-drop-archivos','msol-input-archivos', msolArchivos, 'msol-lista-archivos');
        msolBindDropzone('msol-drop-referencias','msol-input-referencias', msolReferencias, 'msol-lista-referencias');
    }
}

// ── Folio automático (contador en Firestore) ──────────────────
async function msolGenerarFolio(){
    const anioActual = new Date().getFullYear();
    const ref = doc(db, 'contadores', 'mkt_solicitudes');
    const snap = await getDoc(ref);
    let ultimo = 1;
    if(snap.exists()){
        const d = snap.data();
        ultimo = (d.anio === anioActual) ? (Number(d.ultimo||0)+1) : 1;
        await updateDoc(ref, {anio:anioActual, ultimo});
    } else {
        await setDoc(ref, {anio:anioActual, ultimo:1});
    }
    // Nota: esto no es una transacción atómica (setDoc/updateDoc simples según
    // los helpers disponibles). En el caso extremo de dos envíos simultáneos
    // al mismo segundo podría repetirse un folio; si eso llega a pasar en
    // producción, conviene mover esto a runTransaction.
    return `MKT-${anioActual}-${String(ultimo).padStart(6,'0')}`;
}

// ── Guardar borrador (sin folio, validación laxa) ─────────────
async function msolGuardarBorrador(){
    msolGuardarPaso(msolPaso);
    try{
        const email = (auth.currentUser && auth.currentUser.email) || msolData.general?.correo || '';
        const docRef = await addDoc(collection(db,'mkt_solicitudes'), {
            ...msolData, estado:'Borrador', folio:null,
            creadoPor: email, fechaCreacion: new Date().toISOString(),
            historial:[{fecha:new Date().toISOString(), usuario:email, comentario:'Borrador guardado'}]
        });
        await msolGuardarAdjuntos(docRef.id);
        msolToast('💾 Borrador guardado');
    }catch(e){
        msolToast('❌ Error al guardar borrador: '+e.message);
    }
}

// ── Guardar adjuntos en subcolección ──────────────────────────
async function msolGuardarAdjuntos(solicitudId){
    let orden = 0;
    for(const a of msolArchivos){
        await addDoc(collection(db,'mkt_solicitudes',solicitudId,'adjuntos'), {...a, categoria:'archivo', orden:orden++});
    }
    for(const a of msolReferencias){
        await addDoc(collection(db,'mkt_solicitudes',solicitudId,'adjuntos'), {...a, categoria:'referencia', orden:orden++});
    }
}

// ── Envío final de la solicitud ────────────────────────────────
async function msolEnviarSolicitud(){
    if(msolEnviando) return;
    if(!msolValidarPaso(1) ) { msolIrPaso(1); return; }
    if(!msolValidarPaso(2) ) { msolIrPaso(2); return; }
    msolGuardarPaso(5);
    msolEnviando = true;
    const btn = document.getElementById('msol-btn-siguiente');
    if(btn){ btn.disabled = true; btn.innerText = 'Enviando...'; }
    try{
        const folio = await msolGenerarFolio();
        const email = (auth.currentUser && auth.currentUser.email) || msolData.general?.correo || '';
        const linksRaw = (document.getElementById('msol-referencia-links')||{}).value || '';
        const referenciaTexto = (document.getElementById('msol-referencia-texto')||{}).value || '';
        const ahora = new Date();
        const docRef = await addDoc(collection(db,'mkt_solicitudes'), {
            folio,
            general: msolData.general, proyecto: msolData.proyecto, tecnico: msolData.tecnico,
            fechas: msolData.fechas, alcance: msolData.alcance||[], aprobacion: msolData.aprobacion,
            presupuesto: msolData.presupuesto, comentarios: msolData.comentarios||'',
            referenciaLinks: linksRaw.split(',').map(s=>s.trim()).filter(Boolean),
            referenciaTexto,
            archivosCount: msolArchivos.length, referenciasCount: msolReferencias.length,
            estado: 'Nueva', creadoPor: email, fechaCreacion: ahora.toISOString(),
            historial: [{fecha: ahora.toISOString(), usuario: email, comentario: 'Solicitud creada', estado:'Nueva'}]
        });
        await msolGuardarAdjuntos(docRef.id);
        document.getElementById('msol-folio-badge').style.display = 'inline-block';
        document.getElementById('msol-folio-badge').innerText = folio;
        if(typeof mostrarPush === 'function') mostrarPush('Solicitud enviada', `Folio ${folio} creado correctamente`, '✅');
        document.getElementById('msol-body').innerHTML = `
            <div style="text-align:center;padding:50px 20px;">
                <div style="font-size:44px;margin-bottom:12px;">🎉</div>
                <div style="font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:700;color:#1e293b;margin-bottom:6px;">¡Solicitud enviada!</div>
                <div style="font-size:13px;color:#64748b;margin-bottom:18px;">Tu folio es <b style="color:#2563eb;">${folio}</b>. El equipo de Mercadotecnia la revisará pronto.</div>
                <button class="msol-btn-primary" onclick="msolCerrar()">Cerrar</button>
            </div>`;
        document.getElementById('msol-footer') && (document.getElementById('msol-footer').style.display='none');
        if(typeof msolCargarSeguimiento === 'function') msolCargarSeguimiento();
    }catch(e){
        msolToast('❌ Error al enviar la solicitud: '+e.message);
    }finally{
        msolEnviando = false;
        if(btn){ btn.disabled = false; btn.innerText = '✅ Enviar solicitud'; }
    }
}

// ── Panel de seguimiento (todos los empleados ven todas) ──────
async function msolCargarSeguimiento(){
    const cont = document.getElementById('msol-track-lista');
    if(!cont) return;
    cont.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:16px;font-size:12px;">Cargando...</div>`;
    try{
        const snap = await getDocs(collection(db,'mkt_solicitudes'));
        const items = [];
        snap.forEach(d=>{ if(d.data().folio) items.push({id:d.id, ...d.data()}); });
        items.sort((a,b)=> new Date(b.fechaCreacion||0) - new Date(a.fechaCreacion||0));
        if(items.length===0){ cont.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:16px;font-size:12px;">Sin solicitudes registradas todavía</div>`; return; }
        cont.innerHTML = items.map(it=>{
            const g = it.general||{};
            const sem = msolCalcularSemaforo(it.fechas?.limite);
            const dot = sem.nivel==='verde'?'🟢':sem.nivel==='amarillo'?'🟡':sem.nivel==='rojo'?'🔴':'⚪';
            const tipoLabel = (MSOL_TIPOS.find(t=>t.id===g.tipo)||{}).label || '—';
            return `<div class="msol-track-row">
                <span><b>${it.folio}</b></span>
                <span>${it.proyecto?.titulo||'—'}</span>
                <span>${tipoLabel}</span>
                <span>${g.prioridad||'normal'}</span>
                <span class="msol-estado-badge">${it.estado||'Nueva'}</span>
                <span>${dot}</span>
            </div>`;
        }).join('');
    }catch(e){
        cont.innerHTML = `<div style="text-align:center;color:#ef4444;padding:16px;font-size:12px;">Error al cargar: ${e.message}</div>`;
    }
}

// ── Inyectar panel de seguimiento dentro del dashboard de Marketing ──
(function inyectarPanelSeguimientoMsol(){
    const dash = document.getElementById('mkt-dashboard');
    if(!dash || document.getElementById('msol-track-wrap')) return;
    const html = `
    <div class="msol-track-wrap" id="msol-track-wrap">
        <div class="rh-vac-title">
            <span>📋 Solicitudes de Mercadotecnia <span style="font-size:10px;color:#64748b;font-weight:400;">(todas las áreas)</span></span>
            <button class="mkt-add-btn" onclick="abrirModalSolicitudMkt()">➕ Nueva solicitud</button>
        </div>
        <div class="msol-track-row header">
            <span>Folio</span><span>Proyecto</span><span>Tipo</span><span>Prioridad</span><span>Estatus</span><span>Tiempo</span>
        </div>
        <div id="msol-track-lista"></div>
    </div>`;
    dash.insertAdjacentHTML('beforeend', html);
    msolCargarSeguimiento();
})();

console.log('[Marketing.js] ✅ Módulo de Solicitudes de Mercadotecnia (Fase 1) cargado');
console.log('[Marketing.js] ✅ Módulo cargado correctamente');
