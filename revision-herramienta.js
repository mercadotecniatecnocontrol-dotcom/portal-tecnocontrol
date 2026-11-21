// ═════════════════════════════════════════════════════════════════
//  revision-herramienta.js — Portal Operativo Tecnocontrol (nov-2026)
//  Lo comparten el Portal (operaciones.js) y la app de Flotilla
//  (flotilla-movil.js) para que el PDF de auditoría de herramienta
//  salga IGUAL desde los dos lados.
//
//  · tcRevPDF(revision, cargarFoto, opts) → documento jsPDF
//      cargarFoto(herramientaId) → Promise<dataURL|null>
//      opts.soloNovedades = true → solo faltantes / incompletas / dañadas,
//      con resumen y firmas (para traspasos y descuentos de finiquito).
//  · Las fotos se ajustan SIN deformarse (se respeta su proporción).
// ═════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  var ESTADOS = {
    conforme:   { label: "Conforme",   color: [22, 101, 52] },
    faltante:   { label: "Faltante",   color: [185, 28, 28] },
    incompleto: { label: "Incompleto", color: [180, 83, 9] },
    danada:     { label: "Dañada",     color: [194, 65, 12] }
  };
  window.tcRevEstados = ESTADOS;

  // "Trae 5 de 8" para piezas incompletas (kits, juegos de dados, desarmadores…)
  window.tcRevTxtCantidad = function (h) {
    if (!h || h.estado !== "incompleto") return "";
    var e = h.cantidadEncontrada, t = h.cantidadEsperada;
    if (e == null && t == null) return "";
    var falta = (t != null && e != null) ? Math.max(0, Number(t) - Number(e)) : null;
    return "Trae " + (e != null ? e : "?") + " de " + (t != null ? t : "?") + (falta != null ? " (faltan " + falta + ")" : "");
  };

  function limpiar(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function dinero(n) { return "$" + (Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // Descuento al técnico por pieza: precio real de la requisición (lo captura Compras);
  // si todavía no hay, el estimado que se capturó al pedir la reposición.
  // null = sin reposición; 0 = reposición sin descuento.
  window.tcRevMontoDescuento = function (h) {
    var r = h && h.reposicion;
    if (!r) return null;
    if (!r.descontar) return 0;
    return Number(r.precioRequisicion) > 0 ? Number(r.precioRequisicion) : (Number(r.montoDescuento) || 0);
  };

  // Dibuja la imagen centrada dentro del recuadro, conservando su proporción.
  function imagenAjustada(doc, b64, x, y, w, h) {
    var props;
    try { props = doc.getImageProperties(b64); } catch (e) { props = null; }
    var iw = props && props.width ? props.width : 4, ih = props && props.height ? props.height : 3;
    var esc = Math.min(w / iw, h / ih);
    var dw = iw * esc, dh = ih * esc;
    var fmt = /^data:image\/png/i.test(b64) ? "PNG" : "JPEG";
    doc.setFillColor(241, 245, 249);
    doc.rect(x, y, w, h, "F");
    doc.addImage(b64, fmt, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, undefined, "MEDIUM");
  }

  window.tcRevPDF = async function (revision, cargarFoto, opts) {
    opts = opts || {};
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error("No se cargó la librería de PDF (jsPDF).");
    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    var PW = 216, PH = 279, M = 14, W = PW - M * 2;
    var todas = revision.herramientas || [];
    var novedades = todas.filter(function (h) { return h.estado && h.estado !== "conforme"; });
    var piezas = opts.soloNovedades ? novedades : todas;
    var y = 16;

    function encabezado(primera) {
      doc.setTextColor(29, 46, 115);
      doc.setFont("helvetica", "bold"); doc.setFontSize(primera ? 14 : 10);
      doc.text(opts.soloNovedades ? "FALTANTES Y NOVEDADES DE HERRAMIENTA" : "REPORTE DE AUDITORÍA DE HERRAMIENTA", M, y);
      y += primera ? 6 : 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90);
      if (primera) {
        doc.text("HEDMA TECNOCONTROL S.A. DE C.V.", M, y); y += 5;
        doc.text("Técnico / almacén: " + limpiar(revision.tecnicoNombre || revision.almacenNombre || "—") + (revision.tecnicoNumero ? "  ·  N.° " + revision.tecnicoNumero : ""), M, y); y += 5;
        doc.text("Fecha: " + String(revision.fecha || "").slice(0, 16).replace("T", " ") + "  ·  Revisó: " + limpiar(revision.realizadoPor || "—"), M, y); y += 5;
        var c = { faltante: 0, incompleto: 0, danada: 0 };
        novedades.forEach(function (h) { if (c[h.estado] != null) c[h.estado]++; });
        doc.text(todas.length + " pieza(s) revisada(s)  ·  " + c.faltante + " faltante(s)  ·  " + c.incompleto + " incompleta(s)  ·  " + c.danada + " dañada(s)", M, y);
        y += 7;
      } else { y += 2; }
      doc.setTextColor(20);
    }
    encabezado(true);

    // ── Resumen en tabla (solo en el PDF de faltantes) ──
    if (opts.soloNovedades) {
      if (!piezas.length) {
        doc.setFontSize(11); doc.setTextColor(22, 101, 52);
        doc.text("Sin faltantes: todo se encontró conforme.", M, y + 4);
        return doc;
      }
      var cx = [M, M + 22, M + 84, M + 106, M + 136, M + 160];
      var totalDesc = 0, hayEstimado = false;
      doc.setFillColor(29, 46, 115); doc.rect(M, y, W, 7, "F");
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      ["Folio", "Descripción", "Estado", "Cantidad", "Descuento", "Observación"].forEach(function (t, i) { doc.text(t, cx[i] + 1.5, y + 4.8); });
      y += 7; doc.setFont("helvetica", "normal"); doc.setTextColor(20);
      piezas.forEach(function (h, i) {
        var obs = doc.splitTextToSize(limpiar(h.observacion || ""), PW - M - cx[5] - 2);
        var des = doc.splitTextToSize(limpiar(h.descripcion || ""), cx[2] - cx[1] - 3);
        var cant = doc.splitTextToSize(window.tcRevTxtCantidad(h) || "—", cx[4] - cx[3] - 3);
        var md = window.tcRevMontoDescuento(h), rep = h.reposicion || {};
        var real = Number(rep.precioRequisicion) > 0;
        var descTxt = md == null ? ["—"] : (md === 0 ? ["Sin descuento"] : [dinero(md), real ? "precio real" : "estimado"]);
        if (md) { totalDesc += md; if (!real) hayEstimado = true; }
        var alto = Math.max(obs.length, des.length, cant.length, descTxt.length, 1) * 3.8 + 3 + (h.reposicion && h.reposicion.requisicionFolio ? 3.5 : 0);
        if (y + alto > PH - 20) { doc.addPage(); y = 16; encabezado(false); }
        if (i % 2) { doc.setFillColor(248, 250, 252); doc.rect(M, y, W, alto, "F"); }
        var est = ESTADOS[h.estado] || { label: h.estado, color: [90, 90, 90] };
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold"); doc.text(limpiar(h.folio || "—"), cx[0] + 1.5, y + 4.2);
        doc.setFont("helvetica", "normal"); doc.text(des, cx[1] + 1.5, y + 4.2);
        doc.setTextColor(est.color[0], est.color[1], est.color[2]); doc.setFont("helvetica", "bold");
        doc.text(est.label, cx[2] + 1.5, y + 4.2);
        doc.setTextColor(20); doc.setFont("helvetica", "normal");
        doc.text(cant, cx[3] + 1.5, y + 4.2);
        if (md) {
          doc.setTextColor(185, 28, 28); doc.setFont("helvetica", "bold"); doc.text(descTxt[0], cx[4] + 1.5, y + 4.2);
          doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(120); doc.text(descTxt[1], cx[4] + 1.5, y + 8); doc.setFontSize(8.5);
        } else { doc.setTextColor(120); doc.text(descTxt[0], cx[4] + 1.5, y + 4.2); }
        doc.setTextColor(70); doc.text(obs, cx[5] + 1.5, y + 4.2); doc.setTextColor(20);
        if (h.reposicion && h.reposicion.requisicionFolio) {
          doc.setFontSize(7); doc.setTextColor(109, 40, 217);
          doc.text("Req. " + h.reposicion.requisicionFolio + (h.reposicion.descontar ? " · se descuenta" : ""), cx[1] + 1.5, y + alto - 0.8);
          doc.setTextColor(20);
        }
        y += alto;
      });
      if (totalDesc > 0) {
        if (y + 12 > PH - 20) { doc.addPage(); y = 16; encabezado(false); }
        doc.setFillColor(254, 242, 242); doc.rect(M, y, W, 8, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(185, 28, 28);
        doc.text("Total a descontar al técnico: " + dinero(totalDesc), M + 2, y + 5.4);
        if (hayEstimado) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110);
          doc.text("Incluye precios estimados (Compras aún sin precio real).", PW - M - 2, y + 5.4, { align: "right" });
        }
        doc.setFont("helvetica", "normal"); doc.setTextColor(20);
        y += 8;
      }
      y += 8;
    }

    // ── Fichas con foto (2 por renglón, foto grande sin deformar) ──
    var cols = 2, gap = 6, cw = (W - gap) / cols, imgH = 62, txtH = 22, cardH = imgH + txtH;
    var col = 0;
    for (var i = 0; i < piezas.length; i++) {
      var h = piezas[i];
      if (col === 0 && y + cardH > PH - 12) { doc.addPage(); y = 16; encabezado(false); }
      var x = M + col * (cw + gap);
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cw, cardH, 2, 2);
      var est2 = ESTADOS[h.estado] || { label: h.estado || "—", color: [90, 90, 90] };
      doc.setFillColor(est2.color[0], est2.color[1], est2.color[2]); doc.rect(x, y, cw, 1.4, "F");
      var b64 = null;
      if (h.tieneFoto && cargarFoto) { try { b64 = await cargarFoto(h.herramientaId); } catch (e) { b64 = null; } }
      if (b64) {
        try { imagenAjustada(doc, b64, x + 2, y + 3, cw - 4, imgH - 2); } catch (e) { b64 = null; }
      }
      if (!b64) {
        doc.setFillColor(248, 250, 252); doc.rect(x + 2, y + 3, cw - 4, imgH - 2, "F");
        doc.setFontSize(8); doc.setTextColor(170); doc.text("Sin foto", x + cw / 2, y + imgH / 2 + 2, { align: "center" }); doc.setTextColor(20);
      }
      var ty = y + imgH + 5;
      doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
      var tit = doc.splitTextToSize(limpiar((h.folio || "") + " — " + (h.descripcion || "")), cw - 6).slice(0, 2);
      doc.text(tit, x + 3, ty); ty += tit.length * 3.6 + 0.6;
      doc.setTextColor(est2.color[0], est2.color[1], est2.color[2]);
      var cantTxt = window.tcRevTxtCantidad(h);
      doc.text(est2.label + (cantTxt ? "  ·  " + cantTxt : ""), x + 3, ty); ty += 4;
      doc.setFont("helvetica", "normal"); doc.setTextColor(80);
      if (h.observacion) doc.text(doc.splitTextToSize(limpiar(h.observacion), cw - 6).slice(0, 2), x + 3, ty);
      doc.setTextColor(20);
      col++;
      if (col >= cols) { col = 0; y += cardH + 5; }
    }
    if (col !== 0) { y += cardH + 5; }

    if (revision.observacionesGenerales) {
      var lineas = doc.splitTextToSize(limpiar(revision.observacionesGenerales), W);
      if (y + 8 + lineas.length * 4.5 > PH - 12) { doc.addPage(); y = 16; }
      doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.text("Observaciones generales:", M, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.text(lineas, M, y); y += lineas.length * 4.5 + 4;
    }

    // ── Firmas (PDF de faltantes) ──
    if (opts.soloNovedades) {
      if (y + 30 > PH - 10) { doc.addPage(); y = 20; }
      y += 16;
      doc.setDrawColor(100); doc.setLineWidth(0.3);
      doc.line(M + 6, y, M + 80, y); doc.line(PW - M - 80, y, PW - M - 6, y);
      doc.setFontSize(8.5); doc.setTextColor(60);
      doc.text("Revisó: " + limpiar(revision.realizadoPor || ""), M + 43, y + 4.5, { align: "center" });
      doc.text("Técnico: " + limpiar(revision.tecnicoNombre || ""), PW - M - 43, y + 4.5, { align: "center" });
      doc.setTextColor(20);
    }
    return doc;
  };

  window.tcRevNombrePDF = function (revision, soloNovedades) {
    var base = String(revision.tecnicoNumero || revision.tecnicoNombre || revision.almacenNombre || "tec")
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_");
    return (soloNovedades ? "Faltantes_" : "Auditoria_") + base + "_" + String(revision.fecha || "").slice(0, 10) + ".pdf";
  };
})();
