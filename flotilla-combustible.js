// ══════════════════════════════════════════════════════════════
// FLOTILLA · COMBUSTIBLE (9-nov-2026)
// Importa el reporte de transacciones de OXXO GAS "Sistema Flotillas"
// (hoja Export) a la tabla fl_cargas_combustible y muestra el tablero:
// gasto, litros, km/l real vs esperado, costo por km, choferes y alertas.
// - No duplica: la llave es "despacho" (número único de OXXO GAS).
// - ECO: NúmeroEconómico → si viene vacío, por placa en la plataforma →
//   si no, por el IdVehiculo de OXXO ya ligado en importaciones anteriores.
// - Chofer: quien tenía el ECO vinculado en la app (flotilla_usos) a la
//   fecha y hora de la carga. El "Responsable" de OXXO solo se guarda.
// Archivo independiente: no modifica flotilla.js.
// ══════════════════════════════════════════════════════════════
(function(){
  const NAVY='#1D2E73', RED='#E7402B';
  const TZ='-06:00'; // Chihuahua
  const st={desde:null,hasta:null,cargas:[],veh:[],usos:[],usuarios:{},chk:[],ecoSel:null,filtro:'todas'};

  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v==null||v==='')return null;const n=Number(String(v).replace(/[$,\s]/g,''));return isNaN(n)?null:n;};
  const mxn=n=>'$'+Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  const n1=n=>Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:1});
  const normPlaca=p=>String(p||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const normEco=e=>{const s=String(e==null?'':e).trim();return /^\d+(\.0+)?$/.test(s)?String(parseInt(s,10)):s;};
  const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const fFecha=iso=>{const d=new Date(iso);return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',timeZone:'America/Chihuahua'})+' '+d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Chihuahua'});};
  const diaLocal=iso=>new Date(new Date(iso).getTime()-6*3600e3).toISOString().slice(0,10);
  const horaLocal=iso=>new Date(new Date(iso).getTime()-6*3600e3).getUTCHours();
  const rendEsperado=v=>{const n=num(String((v&&v.rend)||'').replace(/km\/?l/i,''));return n&&n>0?n:null;};

  async function sb(){return await window.tcSb();}
  async function miCorreo(){try{const c=await sb();const r=await c.auth.getUser();return (r.data&&r.data.user&&r.data.user.email)||null;}catch(e){return null;}}

  async function flDocs(col,desdeIso){
    const c=await sb(); let out=[], from=0;
    while(true){
      let q=c.from('fl_docs').select('ref,datos,creado_en').eq('col',col);
      if(desdeIso)q=q.gte('creado_en',desdeIso);
      const r=await q.range(from,from+999);
      if(r.error)throw r.error; out=out.concat(r.data||[]);
      if(!r.data||r.data.length<1000)break; from+=1000;
    }
    return out;
  }

  async function cargarCatalogos(){
    const [v,u,us]=await Promise.all([flDocs('flotilla_vehiculos'),flDocs('flotilla_usos'),flDocs('fl_usuarios')]);
    st.veh=v.map(x=>Object.assign({_ref:x.ref},x.datos||{}));
    st.usos=u.map(x=>x.datos||{}).filter(x=>x.eco&&x.vinculadoEn);
    st.usuarios={}; us.forEach(x=>{const d=x.datos||{};if(d.email)st.usuarios[String(d.email).toLowerCase()]=d.nombre||d.email;});
  }

  function choferEn(eco,iso){
    const t=new Date(iso).getTime(); let best=null;
    st.usos.forEach(u=>{
      if(normEco(u.eco)!==normEco(eco))return;
      const a=new Date(u.vinculadoEn).getTime(), b=u.desvinculadoEn?new Date(u.desvinculadoEn).getTime():Infinity;
      if(a<=t&&t<b&&(!best||a>new Date(best.vinculadoEn).getTime()))best=u;
    });
    if(!best)return {email:null,nombre:null};
    const em=String(best.email||'').toLowerCase();
    let nom=st.usuarios[em]||best.nombre||em; if(nom&&nom.includes('@')&&st.usuarios[em])nom=st.usuarios[em];
    return {email:em||null,nombre:nom||null};
  }

  // ─── Lectura del Excel de OXXO GAS ───
  function serialAFecha(v){
    if(v instanceof Date)return ymd(v);
    if(typeof v==='number'){const d=new Date(Math.round((v-25569)*86400e3));return d.toISOString().slice(0,10);}
    const s=String(v||'').trim(); let m;
    if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))){let y=+m[3];if(y<100)y+=2000;return y+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');}
    if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)))return m[1]+'-'+m[2]+'-'+m[3];
    return null;
  }
  function hora(v){
    if(typeof v==='number'){const mins=Math.round((v%1)*1440);return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');}
    const m=String(v||'').match(/(\d{1,2}):(\d{2})/); return m?m[1].padStart(2,'0')+':'+m[2]:'00:00';
  }
  function leerExcel(file){
    return new Promise((res,rej)=>{
      const fr=new FileReader();
      fr.onload=e=>{try{
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        let filas=null;
        for(const n of wb.SheetNames){
          const a=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:null});
          const h=a.findIndex(r=>r&&r.some(c=>String(c||'').trim()==='Despacho')&&r.some(c=>String(c||'').trim()==='Cantidad'));
          if(h>=0){const hd=a[h].map(c=>String(c||'').trim());filas=a.slice(h+1).filter(r=>r&&r.some(c=>c!=null&&c!=='')).map(r=>{const o={};hd.forEach((k,i)=>{if(k)o[k]=r[i];});return o;});break;}
        }
        if(!filas)throw new Error('No encontré la hoja del reporte (debe traer las columnas "Despacho" y "Cantidad").');
        res(filas);
      }catch(err){rej(err);}};
      fr.onerror=()=>rej(fr.error); fr.readAsArrayBuffer(file);
    });
  }

  async function importar(file){
    const msg=document.getElementById('flc-msg'); const say=t=>{if(msg)msg.innerHTML=t;};
    try{
      if(typeof XLSX==='undefined')throw new Error('No cargó la librería de Excel. Recarga el portal.');
      say('Leyendo archivo…');
      const filas=await leerExcel(file);
      if(!st.veh.length)await cargarCatalogos();
      const c=await sb(); const yo=await miCorreo();
      // Ligas IdVehiculo OXXO → ECO ya conocidas (importaciones anteriores + este archivo)
      const ligas={};
      const prev=await c.from('fl_cargas_combustible').select('id_vehiculo_oxxo,eco').not('id_vehiculo_oxxo','is',null).not('eco','like','SIN ECO%').limit(5000);
      (prev.data||[]).forEach(r=>{ligas[r.id_vehiculo_oxxo]=r.eco;});
      filas.forEach(r=>{const e=normEco(r['NúmeroEconómico']);if(e&&r.IdVehiculo!=null)ligas[String(r.IdVehiculo)]=e;});
      const porPlaca={}; st.veh.forEach(v=>{if(v.placas)porPlaca[normPlaca(v.placas)]=normEco(v.eco);});
      const regs=[]; let sinEco=0; const vistos={};
      filas.forEach(r=>{
        const despacho=r.Despacho!=null?((r.CR?String(r.CR).trim()+'-':'')+String(r.Despacho).replace(/\.0+$/,'').trim()):'';
        if(!despacho||vistos[despacho])return; vistos[despacho]=1;
        const f=serialAFecha(r.FechaDespacho); const litros=num(r.Cantidad), importe=num(r.Monto);
        if(!despacho||!f||litros==null||importe==null)return;
        const idv=r.IdVehiculo!=null?String(r.IdVehiculo).replace(/\.0+$/,''):null;
        let eco=normEco(r['NúmeroEconómico'])||porPlaca[normPlaca(r.Placa)]||(idv&&ligas[idv])||null;
        if(!eco){eco='SIN ECO · '+(r.Placa||r['Descripción']||idv||'');sinEco++;}
        const fecha=f+'T'+hora(r.HoraDespacho)+':00'+TZ;
        const ch=eco.startsWith('SIN ECO')?{email:null,nombre:null}:choferEn(eco,fecha);
        regs.push({
          despacho, eco, fecha, estacion:r.Estacion?String(r.Estacion).trim():null,
          producto:String(r.Producto||'').replace(/\(LT\)/i,'').trim()||null,
          litros, importe, precio_litro:litros?Math.round(importe/litros*10000)/10000:null,
          odometro:num(r.Odometro), odometro_anterior:num(r.OdometroAnterior), recorrido_oxxo:num(r.Recorrido),
          tarjeta:r.Tarjeta!=null?String(r.Tarjeta).replace(/\.0+$/,''):null,
          factura:r['#Factura']!=null?String(r['#Factura']).replace(/\.0+$/,''):null,
          placa:r.Placa?String(r.Placa).trim():null, id_vehiculo_oxxo:idv,
          id_bomba:r.IdBomba!=null?String(r.IdBomba).replace(/\.0+$/,''):null,
          responsable_oxxo:r.Responsable||null, grupo:r.Grupo||null,
          chofer:ch.nombre, chofer_email:ch.email,
          origen:'oxxo_import', creado_por:yo
        });
      });
      if(!regs.length)throw new Error('El archivo no trae cargas válidas.');
      say('Revisando duplicados…');
      const existentes={}; const ids=regs.map(r=>r.despacho);
      for(let i=0;i<ids.length;i+=200){
        const r=await c.from('fl_cargas_combustible').select('id,despacho,eco').in('despacho',ids.slice(i,i+200));
        if(r.error)throw r.error; (r.data||[]).forEach(x=>{existentes[x.despacho]=x;});
      }
      const nuevos=regs.filter(r=>!existentes[r.despacho]);
      // Cargas ya existentes que seguían SIN ECO y ahora sí se pudieron ligar
      const ligar=regs.filter(r=>existentes[r.despacho]&&String(existentes[r.despacho].eco).startsWith('SIN ECO')&&!r.eco.startsWith('SIN ECO'));
      for(let i=0;i<nuevos.length;i+=200){
        say('Guardando '+Math.min(i+200,nuevos.length)+' de '+nuevos.length+'…');
        const r=await c.from('fl_cargas_combustible').insert(nuevos.slice(i,i+200)); if(r.error)throw r.error;
      }
      for(const r of ligar){await c.from('fl_cargas_combustible').update({eco:r.eco,chofer:r.chofer,chofer_email:r.chofer_email}).eq('despacho',r.despacho);}
      say('<b style="color:#15803D">Listo:</b> '+nuevos.length+' cargas nuevas, '+(regs.length-nuevos.length)+' ya estaban (no se duplicaron)'+(ligar.length?', '+ligar.length+' ligadas a su ECO':'')+(sinEco?'. <b style="color:'+RED+'">'+sinEco+' sin ECO</b>: asígnalos abajo en Alertas.':'.'));
      await cargar();
    }catch(e){console.error(e);say('<b style="color:'+RED+'">No se pudo importar:</b> '+esc(e.message||e));}
  }

  // ─── Datos del período ───
  async function cargar(){
    const c=await sb();
    const d=st.desde+'T00:00:00'+TZ, h=st.hasta+'T23:59:59'+TZ;
    let out=[],from=0;
    while(true){
      const r=await c.from('fl_cargas_combustible').select('*').gte('fecha',d).lte('fecha',h).order('fecha',{ascending:true}).range(from,from+999);
      if(r.error){document.getElementById('flc-body').innerHTML='<div style="padding:20px;color:'+RED+'">Error: '+esc(r.error.message)+'</div>';return;}
      out=out.concat(r.data||[]); if(!r.data||r.data.length<1000)break; from+=1000;
    }
    st.cargas=out;
    try{
      const dd=new Date(new Date(st.desde).getTime()-10*864e5).toISOString();
      const chk=await flDocs('flotilla_checklist_semanal',dd);
      st.chk=chk.map(x=>({eco:normEco(x.datos&&x.datos.vehiculoEco),km:num(x.datos&&x.datos.km),f:(x.datos&&x.datos.creadoEn)||x.creado_en})).filter(x=>x.eco&&x.km);
    }catch(e){st.chk=[];}
    pintar();
  }

  // ─── Cálculos ───
  function odoValido(c){const r=c.recorrido_oxxo;return r!=null&&r>0&&r<=1500&&c.litros>=1&&!/^(9{3,}|1234|0+)$/.test(String(c.odometro||''));}
  function alertas(){
    const al=[]; const porEcoDia={};
    st.cargas.forEach(c=>{const k=c.eco+'|'+diaLocal(c.fecha);(porEcoDia[k]=porEcoDia[k]||[]).push(c);});
    const vehPorEco={}; st.veh.forEach(v=>{vehPorEco[normEco(v.eco)]=v;});
    st.cargas.forEach(c=>{
      const add=(sev,tipo,txt)=>al.push({sev,tipo,txt,c});
      if(String(c.eco).startsWith('SIN ECO'))add('alta','Sin ECO','La placa/tarjeta no está ligada a ningún vehículo de la plataforma.');
      if(c.litros<1)add('baja','Carga mínima','Carga de '+n1(c.litros)+' L (probable ticket partido).');
      const h=horaLocal(c.fecha); if(h>=22||h<5)add('media','Fuera de horario','Carga a las '+fFecha(c.fecha).split(' ').pop()+'.');
      if(c.litros>=1&&!odoValido(c))add('media','Odómetro inválido','Odómetro '+(c.odometro==null?'vacío':c.odometro)+' (recorrido '+(c.recorrido_oxxo==null?'—':c.recorrido_oxxo)+' km). El chofer no capturó bien el km en la bomba.');
      if(!c.factura)add('baja','Sin factura','OXXO GAS no reporta número de factura.');
      if(!String(c.eco).startsWith('SIN ECO')&&!c.chofer)add('media','Sin chofer','Nadie tenía vinculado el ECO '+c.eco+' en la app a esa hora.');
      const v=vehPorEco[normEco(c.eco)];
      if(v&&v.placas&&c.placa&&normPlaca(v.placas)!==normPlaca(c.placa))add('baja','Placa distinta','OXXO GAS tiene '+c.placa+', la plataforma '+v.placas+'.');
    });
    Object.values(porEcoDia).forEach(arr=>{
      if(arr[0].eco.startsWith('SIN ECO'))return;
      const tot=arr.reduce((s,c)=>s+c.litros,0);
      if(arr.length>=3)al.push({sev:'alta',tipo:'Muchas cargas en un día',txt:arr.length+' cargas, '+n1(tot)+' L el '+diaLocal(arr[0].fecha)+'.',c:arr[arr.length-1]});
      arr.sort((a,b)=>a.fecha.localeCompare(b.fecha));
      for(let i=1;i<arr.length;i++){const m=(new Date(arr[i].fecha)-new Date(arr[i-1].fecha))/60000;if(m<=30&&arr[i].litros>=5&&arr[i-1].litros>=5)al.push({sev:'alta',tipo:'Cargas seguidas',txt:'Dos cargas con '+Math.round(m)+' min de diferencia ('+n1(arr[i-1].litros)+' L y '+n1(arr[i].litros)+' L).',c:arr[i]});}
    });
    // Duplicados de "Placa distinta" por ECO: dejar solo uno
    const vistos={}; return al.filter(a=>{if(a.tipo!=='Placa distinta')return true;const k=a.c.eco;if(vistos[k])return false;vistos[k]=1;return true;});
  }
  function resumenEco(){
    const g={}; const vehPorEco={}; st.veh.forEach(v=>{vehPorEco[normEco(v.eco)]=v;});
    st.cargas.forEach(c=>{
      const k=c.eco; const o=g[k]=g[k]||{eco:k,cargas:0,litros:0,importe:0,lOdo:0,kmOdo:0,choferes:{},v:vehPorEco[normEco(k)]||null};
      o.cargas++; o.litros+=c.litros; o.importe+=c.importe;
      if(odoValido(c)){o.lOdo+=c.litros;o.kmOdo+=c.recorrido_oxxo;}
      if(c.chofer)o.choferes[c.chofer]=(o.choferes[c.chofer]||0)+1;
    });
    Object.values(g).forEach(o=>{
      // km del checklist semanal dentro del período (respaldo)
      const ks=st.chk.filter(x=>x.eco===normEco(o.eco)&&x.f>=st.desde&&String(x.f).slice(0,10)<=st.hasta).map(x=>x.km).filter(k=>k>0);
      o.kmChk=ks.length>=2?Math.max(...ks)-Math.min(...ks):null; if(o.kmChk!=null&&(o.kmChk<0||o.kmChk>20000))o.kmChk=null;
      if(o.lOdo>=o.litros*0.7&&o.kmOdo>0){o.kml=o.kmOdo/o.lOdo;o.km=o.kmOdo*(o.litros/o.lOdo);o.fuente='OXXO';}
      else if(o.kmChk){o.kml=o.kmChk/o.litros;o.km=o.kmChk;o.fuente='Checklist (aprox.)';}
      else {o.kml=null;o.km=null;o.fuente='Sin km confiable';}
      o.esp=rendEsperado(o.v); o.desv=(o.kml&&o.esp)?(o.kml/o.esp-1)*100:null; o.costoKm=o.km?o.importe/o.km:null;
    });
    return Object.values(g).sort((a,b)=>b.importe-a.importe);
  }

  // ─── Pintar ───
  function kpi(t,v,s){return '<div style="flex:1;min-width:140px;border:1px solid #E2E8F0;border-radius:12px;padding:10px 12px;background:#fff"><div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase">'+t+'</div><div style="font-size:20px;font-weight:900;color:'+NAVY+'">'+v+'</div>'+(s?'<div style="font-size:11px;color:#64748B">'+s+'</div>':'')+'</div>';}
  const th='style="text-align:left;padding:6px 8px;font-size:11px;color:#fff;background:'+NAVY+';position:sticky;top:0;white-space:nowrap"';
  const td='style="padding:6px 8px;font-size:12px;border-bottom:1px solid #EEF2F7;white-space:nowrap"';
  function pintar(){
    const body=document.getElementById('flc-body'); if(!body)return;
    if(!st.cargas.length){body.innerHTML='<div style="padding:30px;text-align:center;color:#64748B">No hay cargas en este período. Importa el reporte de OXXO GAS con el botón de arriba.</div>';return;}
    const tot=st.cargas.reduce((s,c)=>s+c.importe,0), lit=st.cargas.reduce((s,c)=>s+c.litros,0);
    const res=resumenEco(), al=alertas(); const altas=al.filter(a=>a.sev==='alta').length;
    const bajoRend=res.filter(o=>o.desv!=null&&o.desv<=-15).length;
    let h='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
      kpi('Gasto',mxn(tot),st.cargas.length+' cargas')+kpi('Litros',n1(lit)+' L','Precio prom. '+mxn(lit?tot/lit:0)+'/L')+
      kpi('Vehículos',res.filter(o=>!o.eco.startsWith('SIN ECO')).length,res.filter(o=>o.eco.startsWith('SIN ECO')).length+' sin ECO')+
      kpi('Bajo rendimiento',bajoRend,'15 % o más abajo de lo esperado')+kpi('Alertas altas',altas,al.length+' alertas en total')+'</div>';
    // Por ECO
    h+='<h4 style="margin:6px 0;color:'+NAVY+'">Por vehículo <span style="font-weight:400;font-size:11px;color:#64748B">(toca un renglón para ver sus cargas)</span></h4><div style="max-height:320px;overflow:auto;border:1px solid #E2E8F0;border-radius:10px"><table style="border-collapse:collapse;width:100%"><thead><tr>'+
      ['ECO','Unidad','Plaza','Chofer(es)','Cargas','Litros','Gasto','km','km/l real','km/l esperado','Desv.','$/km','Fuente km'].map(x=>'<th '+th+'>'+x+'</th>').join('')+'</tr></thead><tbody>';
    res.forEach(o=>{
      const rojo=o.desv!=null&&o.desv<=-15; const ch=Object.entries(o.choferes).sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,2).join(', ')+(Object.keys(o.choferes).length>2?' +'+(Object.keys(o.choferes).length-2):'');
      h+='<tr style="cursor:pointer;'+(st.ecoSel===o.eco?'background:#EEF2FF':'')+'" onclick="flcSelEco(\''+esc(o.eco).replace(/'/g,"\\'")+'\')">'+
        '<td '+td+'><b>'+esc(o.eco)+'</b></td><td '+td+'>'+esc(o.v?o.v.unidad:'—')+'</td><td '+td+'>'+esc(o.v?o.v.plaza:'—')+'</td><td '+td+'>'+esc(ch||'—')+'</td>'+
        '<td '+td+'>'+o.cargas+'</td><td '+td+'>'+n1(o.litros)+'</td><td '+td+'><b>'+mxn(o.importe)+'</b></td><td '+td+'>'+(o.km?n1(o.km):'—')+'</td>'+
        '<td '+td+'><b style="color:'+(rojo?RED:NAVY)+'">'+(o.kml?o.kml.toFixed(1):'—')+'</b></td><td '+td+'>'+(o.esp||'—')+'</td>'+
        '<td '+td+'>'+(o.desv!=null?'<b style="color:'+(rojo?RED:(o.desv<0?'#B45309':'#15803D'))+'">'+(o.desv>0?'+':'')+o.desv.toFixed(0)+'%</b>':'—')+'</td>'+
        '<td '+td+'>'+(o.costoKm?mxn(o.costoKm):'—')+'</td><td '+td+'><span style="font-size:11px;color:#64748B">'+o.fuente+'</span></td></tr>';
    });
    h+='</tbody></table></div>';
    // Alertas
    const tipos=['todas'].concat([...new Set(al.map(a=>a.tipo))]);
    const alF=al.filter(a=>(st.filtro==='todas'||a.tipo===st.filtro)&&(!st.ecoSel||a.c.eco===st.ecoSel));
    const ord={alta:0,media:1,baja:2}; alF.sort((a,b)=>ord[a.sev]-ord[b.sev]||b.c.fecha.localeCompare(a.c.fecha));
    const col={alta:[RED,'#FEF2F2'],media:['#B45309','#FFFBEB'],baja:['#1D4ED8','#EFF6FF']};
    h+='<div style="display:flex;align-items:center;gap:8px;margin:14px 0 6px;flex-wrap:wrap"><h4 style="margin:0;color:'+NAVY+'">Alertas'+(st.ecoSel?' · ECO '+esc(st.ecoSel):'')+'</h4>'+
      '<select onchange="flcFiltro(this.value)" style="padding:4px 8px;border-radius:8px;border:1px solid #CBD5E1;font-size:12px">'+tipos.map(t=>'<option '+(t===st.filtro?'selected':'')+' value="'+esc(t)+'">'+(t==='todas'?'Todas':esc(t))+' ('+(t==='todas'?al.length:al.filter(a=>a.tipo===t).length)+')</option>').join('')+'</select>'+
      (st.ecoSel?'<button onclick="flcSelEco(null)" style="padding:4px 10px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;font-size:12px;cursor:pointer">Ver todos los ECO</button>':'')+'</div>';
    h+='<div style="max-height:260px;overflow:auto;border:1px solid #E2E8F0;border-radius:10px">'+(alF.length?alF.slice(0,400).map(a=>
      '<div style="display:flex;gap:8px;align-items:flex-start;padding:7px 10px;border-bottom:1px solid #EEF2F7;font-size:12px">'+
      '<span style="font-size:10px;font-weight:900;color:'+col[a.sev][0]+';background:'+col[a.sev][1]+';padding:2px 6px;border-radius:6px;white-space:nowrap">'+esc(a.tipo)+'</span>'+
      '<div style="flex:1"><b>'+esc(a.c.eco)+'</b> · '+fFecha(a.c.fecha)+' · '+esc(a.c.estacion||'')+' · '+n1(a.c.litros)+' L · '+mxn(a.c.importe)+'<br><span style="color:#475569">'+esc(a.txt)+'</span>'+
      (a.tipo==='Sin ECO'?' <button onclick="flcAsignarEco(\''+esc(a.c.id_vehiculo_oxxo||'')+'\',\''+esc(a.c.placa||'')+'\')" style="margin-left:6px;padding:2px 8px;border-radius:6px;border:1px solid '+NAVY+';background:#fff;color:'+NAVY+';font-size:11px;cursor:pointer">Asignar ECO</button>':'')+'</div></div>'
    ).join(''):'<div style="padding:14px;color:#64748B;font-size:12px">Sin alertas.</div>')+'</div>';
    // Detalle
    const det=st.cargas.filter(c=>!st.ecoSel||c.eco===st.ecoSel).slice().reverse();
    h+='<h4 style="margin:14px 0 6px;color:'+NAVY+'">Cargas'+(st.ecoSel?' · ECO '+esc(st.ecoSel):'')+' ('+det.length+')</h4><div style="max-height:320px;overflow:auto;border:1px solid #E2E8F0;border-radius:10px"><table style="border-collapse:collapse;width:100%"><thead><tr>'+
      ['Fecha','ECO','Chofer (plataforma)','Estación','Producto','Litros','$/L','Importe','Odómetro','Recorrido','Factura','Despacho'].map(x=>'<th '+th+'>'+x+'</th>').join('')+'</tr></thead><tbody>'+
      det.slice(0,1500).map(c=>'<tr><td '+td+'>'+fFecha(c.fecha)+'</td><td '+td+'><b>'+esc(c.eco)+'</b></td><td '+td+'>'+esc(c.chofer||'—')+'</td><td '+td+'>'+esc(c.estacion||'')+'</td><td '+td+'>'+esc(c.producto||'')+'</td><td '+td+'>'+n1(c.litros)+'</td><td '+td+'>'+(c.precio_litro?mxn(c.precio_litro):'—')+'</td><td '+td+'>'+mxn(c.importe)+'</td><td '+td+'>'+(c.odometro==null?'—':c.odometro)+'</td><td '+td+'>'+(c.recorrido_oxxo==null?'—':'<span style="color:'+(odoValido(c)?'#0F172A':RED)+'">'+c.recorrido_oxxo+'</span>')+'</td><td '+td+'>'+esc(c.factura||'—')+'</td><td '+td+'>'+esc(c.despacho||'')+'</td></tr>').join('')+
      '</tbody></table></div>';
    body.innerHTML=h;
  }

  window.flcSelEco=function(e){st.ecoSel=(st.ecoSel===e?null:e);pintar();};
  window.flcFiltro=function(t){st.filtro=t;pintar();};
  window.flcAsignarEco=async function(idv,placa){
    const eco=prompt('¿A qué ECO de la plataforma pertenece la placa '+placa+'?\n(Se ligan todas sus cargas, también las que se importen después.)');
    if(!eco)return; const e=normEco(eco);
    if(!st.veh.some(v=>normEco(v.eco)===e)&&!confirm('El ECO '+e+' no existe en la plataforma. ¿Ligar de todos modos?'))return;
    const c=await sb(); let q=c.from('fl_cargas_combustible').select('id,fecha').like('eco','SIN ECO%');
    q=idv?q.eq('id_vehiculo_oxxo',idv):q.eq('placa',placa);
    const r=await q; if(r.error){alert(r.error.message);return;}
    for(const x of (r.data||[])){const ch=choferEn(e,x.fecha);await c.from('fl_cargas_combustible').update({eco:e,chofer:ch.nombre,chofer_email:ch.email}).eq('id',x.id);}
    await cargar();
  };
  window.flcExportar=function(){
    if(!st.cargas.length){alert('No hay cargas en el período.');return;}
    const res=resumenEco(), al=alertas(); const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(res.map(o=>({ECO:o.eco,Unidad:o.v?o.v.unidad:'',Plaza:o.v?o.v.plaza:'',Choferes:Object.keys(o.choferes).join(', '),Cargas:o.cargas,Litros:+o.litros.toFixed(2),Gasto:+o.importe.toFixed(2),Km:o.km?Math.round(o.km):'',KmL_real:o.kml?+o.kml.toFixed(2):'',KmL_esperado:o.esp||'',Desviacion_pct:o.desv!=null?+o.desv.toFixed(1):'',Costo_km:o.costoKm?+o.costoKm.toFixed(2):'',Fuente_km:o.fuente}))),'Por vehículo');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(al.map(a=>({Severidad:a.sev,Tipo:a.tipo,ECO:a.c.eco,Fecha:fFecha(a.c.fecha),Estacion:a.c.estacion,Litros:a.c.litros,Importe:a.c.importe,Detalle:a.txt,Despacho:a.c.despacho}))),'Alertas');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(st.cargas.map(c=>({Fecha:fFecha(c.fecha),ECO:c.eco,Chofer:c.chofer||'',Estacion:c.estacion,Producto:c.producto,Litros:c.litros,Precio_L:c.precio_litro,Importe:c.importe,Odometro:c.odometro,Recorrido:c.recorrido_oxxo,Factura:c.factura,Despacho:c.despacho,Tarjeta:c.tarjeta,Placa_OXXO:c.placa,Responsable_OXXO:c.responsable_oxxo}))),'Cargas');
    XLSX.writeFile(wb,'Combustible_'+st.desde+'_a_'+st.hasta+'.xlsx');
  };
  window.flcPeriodo=function(){st.desde=document.getElementById('flc-d').value;st.hasta=document.getElementById('flc-h').value;st.ecoSel=null;document.getElementById('flc-body').innerHTML='<div style="padding:30px;text-align:center;color:#64748B">Cargando…</div>';cargar();};
  window.flcMes=function(delta){const b=new Date(st.desde+'T12:00:00');const d=new Date(b.getFullYear(),b.getMonth()+delta,1);const h=new Date(d.getFullYear(),d.getMonth()+1,0);document.getElementById('flc-d').value=ymd(d);document.getElementById('flc-h').value=ymd(h);flcPeriodo();};

  window.flAbrirCombustible=async function(){
    document.getElementById('flc-ov')?.remove();
    const hoy=new Date(); if(!st.desde){st.desde=ymd(new Date(hoy.getFullYear(),hoy.getMonth(),1));st.hasta=ymd(hoy);}
    const ov=document.createElement('div'); ov.className='fl-ov'; ov.id='flc-ov';
    ov.style.cssText='position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    ov.innerHTML='<div class="fl-modal" style="max-width:1180px;width:100%;background:#fff;border-radius:16px;padding:16px;box-sizing:border-box">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><h3 style="margin:0;color:'+NAVY+';display:flex;align-items:center;gap:8px">⛽ Combustible <span style="font-size:12px;font-weight:600;color:#64748B">OXXO GAS · Sistema Flotillas</span></h3>'+
      '<button onclick="this.closest(\'.fl-ov\').remove()" style="margin-left:auto;border:none;background:#F1F5F9;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:700">✕</button></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'+
        '<button onclick="flcMes(-1)" style="padding:6px 10px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;cursor:pointer">◀ Mes</button>'+
        '<input type="date" id="flc-d" value="'+st.desde+'" onchange="flcPeriodo()" style="padding:5px 8px;border-radius:8px;border:1px solid #CBD5E1">'+
        '<span style="color:#64748B">al</span><input type="date" id="flc-h" value="'+st.hasta+'" onchange="flcPeriodo()" style="padding:5px 8px;border-radius:8px;border:1px solid #CBD5E1">'+
        '<button onclick="flcMes(1)" style="padding:6px 10px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;cursor:pointer">Mes ▶</button>'+
        '<label style="margin-left:auto;padding:7px 12px;border-radius:8px;background:'+NAVY+';color:#fff;font-weight:700;font-size:13px;cursor:pointer">⬆ Importar reporte OXXO GAS<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="if(this.files[0])flcImportar(this.files[0]);this.value=\'\'"></label>'+
        '<button onclick="flcExportar()" style="padding:7px 12px;border-radius:8px;border:1px solid '+NAVY+';background:#fff;color:'+NAVY+';font-weight:700;font-size:13px;cursor:pointer">⬇ Excel</button>'+
      '</div><div id="flc-msg" style="font-size:12px;color:#475569;min-height:16px;margin-bottom:8px">Descarga el reporte de transacciones en el portal de OXXO GAS Flotillas y súbelo aquí. Puedes subir el mismo archivo varias veces: no se duplica.</div>'+
      '<div id="flc-body"><div style="padding:30px;text-align:center;color:#64748B">Cargando…</div></div></div>';
    document.body.appendChild(ov);
    try{await cargarCatalogos();}catch(e){console.warn('flc catálogos',e);}
    await cargar();
  };
  window.flcImportar=importar;

  // Botón en la barra de Flotilla, junto a "Análisis de kilometraje" (sin tocar flotilla.js)
  function ponerBoton(){
    if(document.getElementById('fl-tb-combustible'))return;
    const ref=document.getElementById('fl-tb-kmanalisis'); if(!ref)return;
    const b=document.createElement('button'); b.className='fl-tab-btn'; b.id='fl-tb-combustible'; b.title='Combustible (OXXO GAS)';
    b.onclick=()=>window.flAbrirCombustible();
    b.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17"/><path d="M2 22h13"/><path d="M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/><rect x="6" y="7" width="5" height="4" rx="1"/></svg>';
    const cont=ref.parentElement&&ref.parentElement.style&&ref.parentElement.style.position==='relative'?ref.parentElement:ref;
    cont.insertAdjacentElement('afterend',b);
  }
  setInterval(ponerBoton,1500);
})();
