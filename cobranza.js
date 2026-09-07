/* ============================================================================
 * cobranza.js · Módulo de Cobranza — Fase 1
 * ----------------------------------------------------------------------------
 * Mismo contrato que almacen.js/compras.js: NO inicializa Firebase propio, NO
 * tiene login propio — vive dentro de index.html, que ya resuelve sesión y
 * permisos por departamento (verArea ya filtra quién puede llegar aquí).
 *
 * Depende de globals del portal: window.db.
 * Expone: window.abrirCobranza(idContenedor)  ← contrato con verArea('Cobranza')
 *
 * Colecciones:
 *   cuentas_por_cobrar/{id}            → cuenta por cobrar (1 por factura/concepto)
 *   cuentas_por_cobrar/{id}/seguimiento/{id} → notas de gestión + próximo contacto
 *   cuentas_por_cobrar/{id}/pagos/{id}       → pagos recibidos, van restando el saldo
 *
 * Cliente se elige de 'ventas_clientes' (ya existe) — no se recaptura nada.
 * Fase 1: un solo usuario (Francisca) — sin flujo de autorización ni roles.
 *
 * Relación con Almacén (solo lectura, sin duplicar nada): el expediente de
 * cada cuenta muestra los pedidos de la colección 'surtidos' de ese mismo
 * cliente (match por nombre, igual patrón que ya usa ventas.js:
 * where('cliente','==', c.nombre)) junto con sus evidencias
 * (surtidos/{id}/evidencias — fotos/documentos que ya sube Almacén al
 * entregar). Cobranza NO sube ni edita evidencia, solo la consulta.
 * ============================================================================*/
(function(){

  var contId = 'vista-cobranza-area';
  var _fs = null;
  var cuentas = [];
  var clientes = [];
  var tabActual = 'activas'; // 'activas' | 'pagadas' | 'incobrables'
  var filtroTexto = '';
  var filtroAntiguedad = 'todas';
  var detalleId = null;
  var _pedidosCache = {};      // clienteNombre -> [surtidos]
  var _evidenciasCache = {};   // surtidoId -> [evidencias]
  var _pedidoAbierto = null;   // id del pedido con evidencias expandidas

  function cargarFirestore(){
    if(_fs) return Promise.resolve(_fs);
    return import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').then(function(m){ _fs=m; return m; });
  }

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function toast(msg){
    if(window.mostrarPush){ window.mostrarPush('Cobranza', msg, '💰'); return; }
    var t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0A1628;color:#fff;padding:10px 18px;border-radius:9px;font-size:13px;z-index:3000';
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); },3000);
  }

  function fmtMoney(n){
    n = Number(n)||0;
    return '$'+n.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function fmtFecha(f){
    if(!f) return '—';
    var d = (typeof f==='string') ? new Date(f+'T00:00:00') : (f.toDate ? f.toDate() : new Date(f));
    if(isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
  }
  function hoyISO(){ return new Date().toISOString().slice(0,10); }
  function diasVencido(fechaVenc){
    if(!fechaVenc) return null;
    var v = new Date(fechaVenc+'T00:00:00');
    var h = new Date(hoyISO()+'T00:00:00');
    return Math.round((h-v)/86400000);
  }
  // Semáforo de antigüedad: 🟢 por vencer · 🟡 1-30 · 🟠 31-60 · 🔴 61+
  function semaforo(d){
    if(d===null) return {color:'#94A3B8', bg:'#F1F5F9', label:'—'};
    if(d<=0)  return {color:'#16A34A', bg:'#DCFCE7', label:'Por vencer'};
    if(d<=30) return {color:'#B45309', bg:'#FEF3C7', label:'1-30 días'};
    if(d<=60) return {color:'#C2410C', bg:'#FFEDD5', label:'31-60 días'};
    return       {color:'#DC2626', bg:'#FEE2E2', label:'61+ días'};
  }
  function bucketAntiguedad(d){
    if(d===null || d<=0) return 'porvencer';
    if(d<=30) return 'b1_30';
    if(d<=60) return 'b31_60';
    return 'b61_mas';
  }

  // ── Clientes (ventas_clientes) — para autocomplete, sin recapturar nada ──
  function cargarClientes(){
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.collection(window.db,'ventas_clientes')).then(function(snap){
        clientes = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        return clientes;
      }).catch(function(){ clientes = []; return clientes; });
    });
  }
  function clienteNombre(c){ return c.nombre || c.razonSocial || '(sin nombre)'; }

  // ── Cuentas por cobrar ──
  function cargarCuentas(){
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.query(fs.collection(window.db,'cuentas_por_cobrar'), fs.orderBy('fechaVencimiento','asc'))).then(function(snap){
        cuentas = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        render();
      }).catch(function(e){
        // Si el índice de orderBy no existe aún, cargar sin orden y ordenar en memoria
        return fs.getDocs(fs.collection(window.db,'cuentas_por_cobrar')).then(function(snap){
          cuentas = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
          cuentas.sort(function(a,b){ return (a.fechaVencimiento||'').localeCompare(b.fechaVencimiento||''); });
          render();
        });
      });
    });
  }

  function saldo(c){ return Math.max(0, Number(c.monto||0) - Number(c.totalPagado||0)); }

  function guardarCuenta(datos, id){
    return cargarFirestore().then(function(fs){
      if(id){
        return fs.updateDoc(fs.doc(window.db,'cuentas_por_cobrar',id), datos);
      }
      datos.totalPagado = 0;
      datos.estado = 'pendiente';
      datos.fechaCreacion = hoyISO();
      datos.creadoPor = (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '';
      return fs.addDoc(fs.collection(window.db,'cuentas_por_cobrar'), datos);
    });
  }

  function agregarSeguimiento(cuentaId, nota, proximoContacto){
    return cargarFirestore().then(function(fs){
      return fs.addDoc(fs.collection(window.db,'cuentas_por_cobrar',cuentaId,'seguimiento'), {
        nota: nota||'',
        proximoContacto: proximoContacto||null,
        fecha: hoyISO(),
        usuario: (window.auth && window.auth.currentUser && window.auth.currentUser.email) || ''
      });
    });
  }

  function cargarSeguimiento(cuentaId){
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.query(fs.collection(window.db,'cuentas_por_cobrar',cuentaId,'seguimiento'), fs.orderBy('fecha','desc'))).then(function(snap){
        return snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
      }).catch(function(){ return []; });
    });
  }

  function registrarPago(cuentaId, monto, formaPago){
    return cargarFirestore().then(function(fs){
      var cRef = fs.doc(window.db,'cuentas_por_cobrar',cuentaId);
      return fs.getDoc(cRef).then(function(snap){
        var c = snap.data();
        var nuevoTotal = Number(c.totalPagado||0) + Number(monto);
        var nuevoSaldo = Math.max(0, Number(c.monto||0) - nuevoTotal);
        var nuevoEstado = nuevoSaldo<=0 ? 'pagada' : (nuevoTotal>0 ? 'parcial' : c.estado);
        return fs.addDoc(fs.collection(window.db,'cuentas_por_cobrar',cuentaId,'pagos'), {
          monto: Number(monto), formaPago: formaPago||'—', fecha: hoyISO(),
          usuario: (window.auth && window.auth.currentUser && window.auth.currentUser.email) || ''
        }).then(function(){
          return fs.updateDoc(cRef, { totalPagado: nuevoTotal, estado: nuevoEstado });
        });
      });
    });
  }

  function cargarPagos(cuentaId){
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.query(fs.collection(window.db,'cuentas_por_cobrar',cuentaId,'pagos'), fs.orderBy('fecha','desc'))).then(function(snap){
        return snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
      }).catch(function(){ return []; });
    });
  }

  // ── Pedidos de Almacén del mismo cliente (solo lectura) ──
  function cargarPedidosAlmacen(clienteNombre){
    if(!clienteNombre) return Promise.resolve([]);
    if(_pedidosCache[clienteNombre]) return Promise.resolve(_pedidosCache[clienteNombre]);
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.query(fs.collection(window.db,'surtidos'), fs.where('cliente','==',clienteNombre))).then(function(snap){
        var list = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        list.sort(function(a,b){
          var ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
          var tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
          return tb-ta;
        });
        _pedidosCache[clienteNombre] = list;
        return list;
      }).catch(function(e){ console.warn('[cobranza] cargarPedidosAlmacen:',e); return []; });
    });
  }

  function cargarEvidenciasPedido(surtidoId){
    if(_evidenciasCache[surtidoId]) return Promise.resolve(_evidenciasCache[surtidoId]);
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.collection(window.db,'surtidos',surtidoId,'evidencias')).then(function(snap){
        var list = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        _evidenciasCache[surtidoId] = list;
        return list;
      }).catch(function(){ _evidenciasCache[surtidoId]=[]; return []; });
    });
  }

  function marcarIncobrable(cuentaId){
    return cargarFirestore().then(function(fs){
      return fs.updateDoc(fs.doc(window.db,'cuentas_por_cobrar',cuentaId), {estado:'incobrable'});
    });
  }

  // ══════════════════════════ RENDER ══════════════════════════
  function render(){
    var cont = document.getElementById(contId);
    if(!cont) return;

    var activas = cuentas.filter(function(c){ return c.estado!=='pagada' && c.estado!=='incobrable'; });
    var pagadas = cuentas.filter(function(c){ return c.estado==='pagada'; });
    var incobrables = cuentas.filter(function(c){ return c.estado==='incobrable'; });

    var totalPorCobrar = activas.reduce(function(s,c){ return s+saldo(c); },0);
    var vencido = activas.filter(function(c){ return diasVencido(c.fechaVencimiento)>0; }).reduce(function(s,c){ return s+saldo(c); },0);
    var porVencer = totalPorCobrar - vencido;
    var hoy = new Date();
    var mesActual = hoyISO().slice(0,7);
    var cobradoMes = 0;
    // cobradoMes se calcula async (requiere leer subcolecciones de pagos); se
    // deja en 0 aquí y se actualiza con calcularCobradoMes() abajo.

    var lista = cuentas.filter(function(c){
      if(tabActual==='activas') return c.estado!=='pagada' && c.estado!=='incobrable';
      if(tabActual==='pagadas') return c.estado==='pagada';
      return c.estado==='incobrable';
    }).filter(function(c){
      if(filtroAntiguedad!=='todas' && bucketAntiguedad(diasVencido(c.fechaVencimiento))!==filtroAntiguedad) return false;
      if(!filtroTexto) return true;
      var q = filtroTexto.toLowerCase();
      return (c.clienteNombre||'').toLowerCase().indexOf(q)>=0 || (c.concepto||'').toLowerCase().indexOf(q)>=0;
    });

    cont.innerHTML =
      '<div style="background:#fff;border-radius:14px;padding:20px 22px;margin-bottom:16px;box-shadow:0 1px 3px rgba(10,22,40,.08)">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">'+
          '<h2 style="font-size:19px;font-weight:700;margin:0;color:#0A1628">Cobranza</h2>'+
          '<button onclick="window.__cbAbrirNuevaCuenta()" style="padding:9px 16px;border-radius:9px;border:none;background:#0A1628;color:#fff;font-size:12px;font-weight:700;cursor:pointer">+ Nueva cuenta por cobrar</button>'+
        '</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:0">'+
          '<div style="flex:1;min-width:130px;padding-right:16px"><p style="font-size:11px;color:#94A3B8;margin:0 0 4px">Total por cobrar</p><p style="font-size:22px;font-weight:700;margin:0;color:#0A1628">'+fmtMoney(totalPorCobrar)+'</p></div>'+
          '<div style="flex:1;min-width:130px;padding:0 16px;border-left:1px solid #E2E8F0"><p style="font-size:11px;color:#94A3B8;margin:0 0 4px">Vencido</p><p style="font-size:22px;font-weight:700;margin:0;color:#DC2626">'+fmtMoney(vencido)+'</p></div>'+
          '<div style="flex:1;min-width:130px;padding:0 16px;border-left:1px solid #E2E8F0"><p style="font-size:11px;color:#94A3B8;margin:0 0 4px">Por vencer</p><p style="font-size:22px;font-weight:700;margin:0;color:#16A34A">'+fmtMoney(porVencer)+'</p></div>'+
          '<div style="flex:1;min-width:130px;padding-left:16px;border-left:1px solid #E2E8F0"><p style="font-size:11px;color:#94A3B8;margin:0 0 4px">Cobrado este mes</p><p style="font-size:22px;font-weight:700;margin:0;color:#1473E6" id="cb-kpi-cobrado-mes">'+fmtMoney(cobradoMes)+'</p></div>'+
        '</div>'+
      '</div>'+

      '<div style="background:#fff;border-radius:14px;padding:18px 22px;box-shadow:0 1px 3px rgba(10,22,40,.08)">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">'+
          '<div style="display:flex;gap:6px">'+
            tabBtn('activas','Activas')+ tabBtn('pagadas','Pagadas')+ tabBtn('incobrables','Incobrables')+
          '</div>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
            '<input id="cb-filtro-texto" placeholder="Buscar cliente o concepto…" value="'+esc(filtroTexto)+'" oninput="window.__cbSetFiltroTexto(this.value)" style="padding:8px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px;min-width:200px">'+
            '<select onchange="window.__cbSetFiltroAntiguedad(this.value)" style="padding:8px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px">'+
              '<option value="todas"'+(filtroAntiguedad==='todas'?' selected':'')+'>Toda antigüedad</option>'+
              '<option value="porvencer"'+(filtroAntiguedad==='porvencer'?' selected':'')+'>Por vencer</option>'+
              '<option value="b1_30"'+(filtroAntiguedad==='b1_30'?' selected':'')+'>1-30 días</option>'+
              '<option value="b31_60"'+(filtroAntiguedad==='b31_60'?' selected':'')+'>31-60 días</option>'+
              '<option value="b61_mas"'+(filtroAntiguedad==='b61_mas'?' selected':'')+'>61+ días</option>'+
            '</select>'+
          '</div>'+
        '</div>'+
        (lista.length ? renderTabla(lista) : '<p style="text-align:center;color:#94A3B8;padding:40px 0;font-size:13px">Sin cuentas en esta vista.</p>')+
      '</div>'+
      (detalleId ? renderDetalle() : '');

    calcularCobradoMes(mesActual);
    if(detalleId) window.__cbCargarDetalleAsync(detalleId);
  }

  function tabBtn(id, label){
    var activo = tabActual===id;
    return '<button onclick="window.__cbSetTab(\''+id+'\')" style="padding:7px 15px;border-radius:20px;border:none;background:'+(activo?'#0A1628':'#fff')+';color:'+(activo?'#fff':'#5C7089')+';font-size:12px;font-weight:700;cursor:pointer;box-shadow:'+(activo?'0 1px 3px rgba(10,22,40,.15)':'none')+'">'+label+'</button>';
  }

  function renderTabla(lista){
    var filas = lista.map(function(c){
      var dv = diasVencido(c.fechaVencimiento);
      var sem = semaforo(dv);
      var sld = saldo(c);
      return '<tr style="border-top:1px solid #F1F5F9;cursor:pointer" onclick="window.__cbAbrirDetalle(\''+c.id+'\')">'+
        '<td style="padding:10px 8px"><p style="font-size:13px;font-weight:700;color:#0A1628;margin:0">'+esc(c.clienteNombre||'—')+'</p></td>'+
        '<td style="padding:10px 8px;font-size:12.5px;color:#334155">'+esc(c.concepto||'—')+'</td>'+
        '<td style="padding:10px 8px;font-size:12.5px;color:#334155;text-align:right">'+fmtMoney(c.monto)+'</td>'+
        '<td style="padding:10px 8px;font-size:12.5px;font-weight:700;color:#0A1628;text-align:right">'+fmtMoney(sld)+'</td>'+
        '<td style="padding:10px 8px;font-size:12.5px;color:#334155">'+fmtFecha(c.fechaVencimiento)+'</td>'+
        '<td style="padding:10px 8px"><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:'+sem.color+';background:'+sem.bg+'">'+sem.label+'</span></td>'+
        '<td style="padding:10px 8px;font-size:11.5px;color:#94A3B8;text-transform:capitalize">'+esc(c.estado||'—')+'</td>'+
      '</tr>';
    }).join('');
    return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">'+
      '<thead><tr style="text-align:left"><th style="padding:8px;font-size:11px;color:#94A3B8">Cliente</th><th style="padding:8px;font-size:11px;color:#94A3B8">Concepto / Factura</th><th style="padding:8px;font-size:11px;color:#94A3B8;text-align:right">Monto</th><th style="padding:8px;font-size:11px;color:#94A3B8;text-align:right">Saldo</th><th style="padding:8px;font-size:11px;color:#94A3B8">Vencimiento</th><th style="padding:8px;font-size:11px;color:#94A3B8">Antigüedad</th><th style="padding:8px;font-size:11px;color:#94A3B8">Estado</th></tr></thead>'+
      '<tbody>'+filas+'</tbody></table></div>';
  }

  function calcularCobradoMes(mesActual){
    // Suma los pagos del mes en curso entre todas las cuentas activas/pagadas.
    // Se hace en segundo plano y solo actualiza el KPI si el nodo sigue en el DOM.
    cargarFirestore().then(function(fs){
      var promesas = cuentas.map(function(c){
        return fs.getDocs(fs.collection(window.db,'cuentas_por_cobrar',c.id,'pagos')).then(function(snap){
          return snap.docs.reduce(function(s,d){
            var p = d.data();
            return s + ((p.fecha||'').slice(0,7)===mesActual ? Number(p.monto||0) : 0);
          },0);
        }).catch(function(){ return 0; });
      });
      Promise.all(promesas).then(function(vals){
        var total = vals.reduce(function(a,b){ return a+b; },0);
        var el = document.getElementById('cb-kpi-cobrado-mes');
        if(el) el.textContent = fmtMoney(total);
      });
    });
  }

  // ── Modal: nueva cuenta ──
  window.__cbAbrirNuevaCuenta = function(){
    var opciones = clientes.map(function(c){ return '<option value="'+esc(c.id)+'">'+esc(clienteNombre(c))+'</option>'; }).join('');
    var html =
      '<div id="cb-modal-nueva" style="position:fixed;inset:0;background:rgba(10,22,40,.45);display:flex;align-items:center;justify-content:center;z-index:4000" onclick="if(event.target===this) this.remove()">'+
        '<div style="background:#fff;border-radius:14px;max-width:460px;width:100%;padding:22px" onclick="event.stopPropagation()">'+
          '<h3 style="font-size:16px;font-weight:700;margin:0 0 16px;color:#0A1628">Nueva cuenta por cobrar</h3>'+
          '<label style="font-size:11.5px;font-weight:700;color:#5C7089">Cliente</label>'+
          '<select id="cb-nc-cliente" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;margin:4px 0 12px"><option value="">Elegir cliente…</option>'+opciones+'</select>'+
          '<label style="font-size:11.5px;font-weight:700;color:#5C7089">Concepto / Factura</label>'+
          '<input id="cb-nc-concepto" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;margin:4px 0 12px" placeholder="Ej. Factura F-1832">'+
          '<label style="font-size:11.5px;font-weight:700;color:#5C7089">Monto</label>'+
          '<input id="cb-nc-monto" type="number" step="0.01" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;margin:4px 0 12px" placeholder="0.00">'+
          '<label style="font-size:11.5px;font-weight:700;color:#5C7089">Fecha de vencimiento</label>'+
          '<input id="cb-nc-vencimiento" type="date" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;margin:4px 0 18px">'+
          '<div style="display:flex;gap:10px">'+
            '<button onclick="document.getElementById(\'cb-modal-nueva\').remove()" style="flex:1;padding:10px;background:#F1F5F9;color:#0A1628;border:none;border-radius:9px;font-weight:700;cursor:pointer">Cancelar</button>'+
            '<button onclick="window.__cbGuardarNuevaCuenta()" style="flex:1;padding:10px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Guardar</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.__cbGuardarNuevaCuenta = function(){
    var clienteId = document.getElementById('cb-nc-cliente').value;
    var concepto = document.getElementById('cb-nc-concepto').value.trim();
    var monto = Number(document.getElementById('cb-nc-monto').value);
    var vencimiento = document.getElementById('cb-nc-vencimiento').value;
    if(!clienteId || !concepto || !monto || !vencimiento){ toast('Completa todos los campos'); return; }
    var cliente = clientes.find(function(c){ return c.id===clienteId; });
    guardarCuenta({
      clienteId: clienteId,
      clienteNombre: cliente ? clienteNombre(cliente) : '—',
      concepto: concepto,
      monto: monto,
      fechaVencimiento: vencimiento
    }).then(function(){
      var m = document.getElementById('cb-modal-nueva'); if(m) m.remove();
      toast('Cuenta creada');
      cargarCuentas();
    }).catch(function(e){ toast('Error: '+e.message); });
  };

  // ── Filtros / tabs ──
  window.__cbSetTab = function(t){ tabActual = t; render(); };
  window.__cbSetFiltroTexto = function(v){ filtroTexto = v; render(); var el=document.getElementById('cb-filtro-texto'); if(el){ el.focus(); el.selectionStart=el.selectionEnd=el.value.length; } };
  window.__cbSetFiltroAntiguedad = function(v){ filtroAntiguedad = v; render(); };

  // ── Detalle de cuenta (expediente: seguimiento + pagos) ──
  window.__cbAbrirDetalle = function(id){ detalleId = id; render(); };
  window.__cbCerrarDetalle = function(){ detalleId = null; render(); };

  function renderDetalle(){
    var c = cuentas.find(function(x){ return x.id===detalleId; });
    if(!c) return '';
    var sld = saldo(c);
    var dv = diasVencido(c.fechaVencimiento);
    var sem = semaforo(dv);
    return '<div style="position:fixed;inset:0;background:rgba(10,22,40,.45);display:flex;align-items:center;justify-content:center;z-index:4000" onclick="if(event.target===this) window.__cbCerrarDetalle()">'+
      '<div style="background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:88vh;overflow-y:auto;padding:22px" onclick="event.stopPropagation()">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">'+
          '<div><p style="font-size:16px;font-weight:700;margin:0;color:#0A1628">'+esc(c.clienteNombre)+'</p>'+
          '<p style="font-size:12.5px;color:#5C7089;margin:2px 0 0">'+esc(c.concepto)+'</p></div>'+
          '<button onclick="window.__cbCerrarDetalle()" style="border:none;background:none;font-size:18px;color:#94A3B8;cursor:pointer">✕</button>'+
        '</div>'+
        '<div style="display:flex;gap:16px;margin:14px 0 18px;flex-wrap:wrap">'+
          '<div><p style="font-size:11px;color:#94A3B8;margin:0">Monto</p><p style="font-size:15px;font-weight:700;margin:2px 0 0;color:#0A1628">'+fmtMoney(c.monto)+'</p></div>'+
          '<div><p style="font-size:11px;color:#94A3B8;margin:0">Saldo pendiente</p><p style="font-size:15px;font-weight:700;margin:2px 0 0;color:'+(sld>0?'#DC2626':'#16A34A')+'">'+fmtMoney(sld)+'</p></div>'+
          '<div><p style="font-size:11px;color:#94A3B8;margin:0">Vencimiento</p><p style="font-size:13px;font-weight:700;margin:2px 0 0;color:#0A1628">'+fmtFecha(c.fechaVencimiento)+'</p></div>'+
          '<div><span style="display:inline-block;margin-top:14px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:'+sem.color+';background:'+sem.bg+'">'+sem.label+'</span></div>'+
        '</div>'+
        (c.estado!=='pagada' && c.estado!=='incobrable' ?
          '<div style="display:flex;gap:8px;margin-bottom:18px">'+
            '<button onclick="window.__cbAbrirRegistrarPago(\''+c.id+'\')" style="flex:1;padding:9px;background:#0A1628;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Registrar pago</button>'+
            '<button onclick="window.__cbAbrirAgregarNota(\''+c.id+'\')" style="flex:1;padding:9px;background:#F1F5F9;color:#0A1628;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">+ Nota de seguimiento</button>'+
            '<button onclick="window.__cbMarcarIncobrable(\''+c.id+'\')" style="padding:9px 14px;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Incobrable</button>'+
          '</div>' : ''
        )+
        '<h4 style="font-size:12.5px;font-weight:700;color:#0A1628;margin:0 0 8px">Seguimiento</h4>'+
        '<div id="cb-seg-list" style="margin-bottom:18px;font-size:12px;color:#94A3B8">Cargando…</div>'+
        '<h4 style="font-size:12.5px;font-weight:700;color:#0A1628;margin:0 0 8px">Pagos</h4>'+
        '<div id="cb-pagos-list" style="font-size:12px;color:#94A3B8">Cargando…</div>'+
        '<h4 style="font-size:12.5px;font-weight:700;color:#0A1628;margin:18px 0 8px">Historial de pedidos de Almacén</h4>'+
        '<div id="cb-pedidos-list" style="font-size:12px;color:#94A3B8">Cargando…</div>'+
      '</div>'+
    '</div>';
  }

  // Nota: el detalle se pinta como HTML estático en render(); las listas de
  // seguimiento/pagos/pedidos se rellenan aparte porque requieren lecturas
  // async — render() llama a esta función justo después de montar el HTML.
  window.__cbCargarDetalleAsync = function(id){
    var cuenta = cuentas.find(function(x){ return x.id===id; });
    Promise.all([cargarSeguimiento(id), cargarPagos(id), cargarPedidosAlmacen(cuenta && cuenta.clienteNombre)]).then(function(r){
      var seg = r[0], pagos = r[1], pedidos = r[2];
      var segList = document.getElementById('cb-seg-list');
      if(segList){
        segList.innerHTML = seg.length ? seg.map(function(s){
          return '<div style="padding:8px 0;border-top:1px solid #F1F5F9"><p style="font-size:12.5px;color:#334155;margin:0">'+esc(s.nota)+'</p>'+
            '<p style="font-size:10.5px;color:#94A3B8;margin:2px 0 0">'+fmtFecha(s.fecha)+(s.proximoContacto?' · Próximo contacto: '+fmtFecha(s.proximoContacto):'')+'</p></div>';
        }).join('') : '<p style="font-size:12px;color:#94A3B8">Sin notas todavía.</p>';
      }
      var pagList = document.getElementById('cb-pagos-list');
      if(pagList){
        pagList.innerHTML = pagos.length ? pagos.map(function(p){
          return '<div style="padding:8px 0;border-top:1px solid #F1F5F9;display:flex;justify-content:space-between"><span style="font-size:12.5px;color:#334155">'+fmtFecha(p.fecha)+' · '+esc(p.formaPago)+'</span><span style="font-size:12.5px;font-weight:700;color:#16A34A">'+fmtMoney(p.monto)+'</span></div>';
        }).join('') : '<p style="font-size:12px;color:#94A3B8">Sin pagos registrados.</p>';
      }
      var pedList = document.getElementById('cb-pedidos-list');
      if(pedList){
        if(!pedidos.length){
          pedList.innerHTML = '<p style="font-size:12px;color:#94A3B8">Sin pedidos de Almacén encontrados para este cliente.</p>';
        } else {
          pedList.innerHTML = pedidos.map(renderPedidoRow).join('');
          if(_pedidoAbierto) renderEvidenciasDe(_pedidoAbierto);
        }
      }
    });
  };

  function renderPedidoRow(p){
    var fecha = p.createdAt && p.createdAt.seconds ? new Date(p.createdAt.seconds*1000) : null;
    var abierto = _pedidoAbierto===p.id;
    return '<div style="border-top:1px solid #F1F5F9;padding:10px 0">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="window.__cbToggleEvidencias(\''+p.id+'\')">'+
        '<div><p style="font-size:12.5px;font-weight:700;color:#0A1628;margin:0">'+esc(p.folio||p.id)+'</p>'+
        '<p style="font-size:10.5px;color:#94A3B8;margin:2px 0 0">'+(fecha?fecha.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'—')+' · '+esc(p.estado||'—')+'</p></div>'+
        '<span style="font-size:11px;font-weight:700;color:#1473E6">'+(abierto?'Ocultar evidencias ▲':'Ver evidencias ▼')+'</span>'+
      '</div>'+
      '<div id="cb-evid-'+p.id+'" style="margin-top:8px;'+(abierto?'':'display:none')+'">'+(abierto?'<p style="font-size:11px;color:#94A3B8">Cargando evidencias…</p>':'')+'</div>'+
    '</div>';
  }

  window.__cbToggleEvidencias = function(pedidoId){
    _pedidoAbierto = (_pedidoAbierto===pedidoId) ? null : pedidoId;
    if(detalleId) window.__cbCargarDetalleAsync(detalleId);
  };

  function renderEvidenciasDe(pedidoId){
    var el = document.getElementById('cb-evid-'+pedidoId);
    if(!el) return;
    cargarEvidenciasPedido(pedidoId).then(function(list){
      if(!list.length){ el.innerHTML = '<p style="font-size:11px;color:#94A3B8">Sin evidencias en este pedido.</p>'; return; }
      el.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap">'+list.map(function(ev){
        if(ev.tipo==='imagen' && ev.imagen){
          return '<img src="'+esc(ev.imagen)+'" onclick="window.open(this.src)" style="width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid #E2E8F0">';
        }
        return '<a href="'+esc(ev.url||'#')+'" target="_blank" style="width:64px;height:64px;border-radius:8px;border:1px solid #E2E8F0;background:#F8FAFC;display:flex;flex-direction:column;align-items:center;justify-content:center;text-decoration:none;color:#334155;font-size:9px;text-align:center;padding:2px">'+
          '<span style="font-size:18px">📄</span>'+esc(ev.nombre||'Documento')+'</a>';
      }).join('')+'</div>';
    });
  }

  // ── Modal: registrar pago ──
  window.__cbAbrirRegistrarPago = function(cuentaId){
    var html =
      '<div id="cb-modal-pago" style="position:fixed;inset:0;background:rgba(10,22,40,.55);display:flex;align-items:center;justify-content:center;z-index:4100" onclick="if(event.target===this) this.remove()">'+
        '<div style="background:#fff;border-radius:14px;max-width:360px;width:100%;padding:20px" onclick="event.stopPropagation()">'+
          '<h3 style="font-size:15px;font-weight:700;margin:0 0 14px;color:#0A1628">Registrar pago</h3>'+
          '<label style="font-size:11.5px;font-weight:700;color:#5C7089">Monto recibido</label>'+
          '<input id="cb-pago-monto" type="number" step="0.01" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;margin:4px 0 12px">'+
          '<label style="font-size:11.5px;font-weight:700;color:#5C7089">Forma de pago</label>'+
          '<select id="cb-pago-forma" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;margin:4px 0 18px">'+
            '<option>Transferencia</option><option>Efectivo</option><option>Cheque</option><option>Depósito</option><option>Otro</option>'+
          '</select>'+
          '<div style="display:flex;gap:10px">'+
            '<button onclick="document.getElementById(\'cb-modal-pago\').remove()" style="flex:1;padding:10px;background:#F1F5F9;color:#0A1628;border:none;border-radius:9px;font-weight:700;cursor:pointer">Cancelar</button>'+
            '<button onclick="window.__cbGuardarPago(\''+cuentaId+'\')" style="flex:1;padding:10px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Guardar</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.__cbGuardarPago = function(cuentaId){
    var monto = Number(document.getElementById('cb-pago-monto').value);
    var forma = document.getElementById('cb-pago-forma').value;
    if(!monto || monto<=0){ toast('Ingresa un monto válido'); return; }
    registrarPago(cuentaId, monto, forma).then(function(){
      var m = document.getElementById('cb-modal-pago'); if(m) m.remove();
      toast('Pago registrado');
      cargarCuentas();
    }).catch(function(e){ toast('Error: '+e.message); });
  };

  // ── Modal: nota de seguimiento ──
  window.__cbAbrirAgregarNota = function(cuentaId){
    var html =
      '<div id="cb-modal-nota" style="position:fixed;inset:0;background:rgba(10,22,40,.55);display:flex;align-items:center;justify-content:center;z-index:4100" onclick="if(event.target===this) this.remove()">'+
        '<div style="background:#fff;border-radius:14px;max-width:400px;width:100%;padding:20px" onclick="event.stopPropagation()">'+
          '<h3 style="font-size:15px;font-weight:700;margin:0 0 14px;color:#0A1628">Nota de seguimiento</h3>'+
          '<label style="font-size:11.5px;font-weight:700;color:#5C7089">Nota</label>'+
          '<textarea id="cb-nota-texto" rows="3" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;margin:4px 0 12px" placeholder="Ej. Se llamó, promete pagar el viernes"></textarea>'+
          '<label style="font-size:11.5px;font-weight:700;color:#5C7089">Próximo contacto (opcional)</label>'+
          '<input id="cb-nota-proximo" type="date" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;margin:4px 0 18px">'+
          '<div style="display:flex;gap:10px">'+
            '<button onclick="document.getElementById(\'cb-modal-nota\').remove()" style="flex:1;padding:10px;background:#F1F5F9;color:#0A1628;border:none;border-radius:9px;font-weight:700;cursor:pointer">Cancelar</button>'+
            '<button onclick="window.__cbGuardarNota(\''+cuentaId+'\')" style="flex:1;padding:10px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Guardar</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.__cbGuardarNota = function(cuentaId){
    var nota = document.getElementById('cb-nota-texto').value.trim();
    var proximo = document.getElementById('cb-nota-proximo').value;
    if(!nota){ toast('Escribe una nota'); return; }
    agregarSeguimiento(cuentaId, nota, proximo).then(function(){
      var m = document.getElementById('cb-modal-nota'); if(m) m.remove();
      toast('Nota guardada');
      window.__cbCargarDetalleAsync(cuentaId);
    }).catch(function(e){ toast('Error: '+e.message); });
  };

  window.__cbMarcarIncobrable = function(cuentaId){
    if(!confirm('¿Marcar esta cuenta como incobrable? Dejará de contar en el total por cobrar.')) return;
    marcarIncobrable(cuentaId).then(function(){
      toast('Marcada como incobrable');
      detalleId = null;
      cargarCuentas();
    }).catch(function(e){ toast('Error: '+e.message); });
  };

  // ══════════════════════════ BOOTSTRAP ══════════════════════════
  window.abrirCobranza = function(idContenedor){
    contId = idContenedor || 'vista-cobranza-area';
    var cont = document.getElementById(contId);
    if(cont) cont.innerHTML = '<p style="padding:40px;text-align:center;color:#94A3B8">Cargando módulo de Cobranza…</p>';
    Promise.all([cargarClientes(), cargarCuentas()]);
  };

})();
