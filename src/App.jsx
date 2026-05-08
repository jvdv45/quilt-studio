// Quilt Studio — Main App Component
// Full source at: https://github.com/YOUR_USERNAME/quilt-studio

import { useState, useRef, useCallback, useEffect } from "react";

const GAP = 3;
const BORDER = 3;
const MIN_CELL = 24;
const DEFAULT_CELL = 72;

// ── Template helpers ─────────────────────────────────────────────
// A template stores the grid as slot numbers (1-based index of the fabric
// used, in order of first appearance). Fabric images are NOT saved.
function gridToTemplate(grid, fabricIds) {
  const slotMap = {};   // fabricId -> slot number
  let next = 1;
  return grid.map((row) =>
    row.map((cell) => {
      if (!cell) return 0;
      if (slotMap[cell] === undefined) { slotMap[cell] = next++; }
      return slotMap[cell];
    })
  );
}

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem("quilt_templates") || "[]"); }
  catch { return []; }
}

function saveTemplates(templates) {
  localStorage.setItem("quilt_templates", JSON.stringify(templates));
}

// Pastel colours for slot numbers in template preview / canvas
const SLOT_COLORS = [
  "#e8c8a0","#a8c8e8","#c8e8a8","#e8a8c8","#c8a8e8",
  "#e8d8a0","#a8e8d8","#e8b8a0","#b8e8a8","#d8a8e8",
];
function slotColor(n) { return SLOT_COLORS[(n - 1) % SLOT_COLORS.length]; }

// ── Component ────────────────────────────────────────────────────
export default function QuiltDesigner() {
  const [phase, setPhase] = useState("setup");
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [grid, setGrid] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceFrom, setReplaceFrom] = useState(null);
  const [toast, setToast] = useState(null);
  const [zoomMode, setZoomMode] = useState(false);
  const [exportImage, setExportImage] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Template state
  const [templates, setTemplates] = useState(loadTemplates);
  const [saveModal, setSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [loadModal, setLoadModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // template id to delete

  // Canvas/zoom
  const canvasAreaRef = useRef(null);
  const [cellSize, setCellSize] = useState(DEFAULT_CELL);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const lastPinchDist = useRef(null);
  const lastPanPos = useRef(null);
  const isDragging = useRef(false);
  const mouseDownPos = useRef(null);
  const fileInputId = "fabric-file-input";

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  // Fit-to-screen cell sizing
  useEffect(() => {
    if (phase !== "design" || zoomMode) return;
    const el = canvasAreaRef.current;
    if (!el) return;
    const compute = () => {
      const { width, height } = el.getBoundingClientRect();
      const cellW = Math.floor((width  - 48 - BORDER * 2 - GAP * (cols - 1)) / cols);
      const cellH = Math.floor((height - 48 - BORDER * 2 - GAP * (rows - 1)) / rows);
      setCellSize(Math.max(MIN_CELL, Math.min(cellW, cellH)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase, cols, rows, zoomMode]);

  const toggleZoom = () => {
    if (zoomMode) { setScale(1); setPan({ x: 0, y: 0 }); }
    else setCellSize(DEFAULT_CELL);
    setZoomMode((v) => !v);
  };

  // ── Grid creation ─────────────────────────────────────────────
  const generateGrid = () => {
    const r = Math.max(1, Math.min(20, parseInt(rows) || 4));
    const c = Math.max(1, Math.min(20, parseInt(cols) || 4));
    setGrid(Array.from({ length: r }, () => Array(c).fill(null)));
    setZoomMode(false); setScale(1); setPan({ x: 0, y: 0 });
    setPhase("design");
  };

  // Load a saved template — grid uses slot numbers, not fabric ids
  const loadTemplate = (tpl) => {
    setRows(tpl.rows);
    setCols(tpl.cols);
    // Store template slot grid; fabrics will be mapped when painting
    setGrid(tpl.slotGrid.map((row) => row.map(() => null))); // blank canvas same shape
    setTemplateGrid(tpl.slotGrid);
    setLoadModal(false);
    setZoomMode(false); setScale(1); setPan({ x: 0, y: 0 });
    setPhase("design");
    showToast(`Loaded "${tpl.name}" — use Replace All to assign fabrics`);
  };

  // templateGrid holds the slot-number layout when a template is active
  const [templateGrid, setTemplateGrid] = useState(null);

  // When a template is loaded, initialise the grid from slot numbers
  useEffect(() => {
    if (!templateGrid) return;
    setGrid(templateGrid.map((row) => row.map((slot) => (slot ? `__slot_${slot}` : null))));
    setTemplateGrid(null);
  }, [templateGrid]);

  // ── Fabric upload ─────────────────────────────────────────────
  const handleFabricUpload = (e) => {
    Array.from(e.target.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setFabrics((prev) => [...prev, { id: Date.now() + Math.random(), src: ev.target.result, name: file.name }]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // ── Painting ──────────────────────────────────────────────────
  const paintCell = useCallback((r, c) => {
    if (!selectedFabric) return;
    setGrid((prev) => { const next = prev.map((row) => [...row]); next[r][c] = selectedFabric.id; return next; });
  }, [selectedFabric]);

  const handleCellInteract = useCallback((r, c) => {
    if (replaceMode) {
      const target = grid[r][c];
      if (replaceFrom === null) {
        setReplaceFrom(target);
        showToast(target ? "Now select the replacement fabric and tap any block" : "Now select a fabric to fill empty cells");
      } else {
        const replaceTo = selectedFabric ? selectedFabric.id : null;
        setGrid((prev) => prev.map((row) => row.map((cell) => (cell === target ? replaceTo : cell))));
        setReplaceMode(false); setReplaceFrom(null); showToast("Replaced!");
      }
      return;
    }
    paintCell(r, c);
  }, [replaceMode, replaceFrom, grid, selectedFabric, paintCell]);

  // Touch drag (fit mode)
  const handleTouchMove = useCallback((e) => {
    if (replaceMode || !selectedFabric || zoomMode) return;
    e.preventDefault();
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (el?.dataset.row !== undefined && el?.dataset.col !== undefined)
      paintCell(Number(el.dataset.row), Number(el.dataset.col));
  }, [replaceMode, selectedFabric, paintCell, zoomMode]);

  // Zoom-mode gestures
  const getPinchDist = (e) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  const handleZoomTouchStart = (e) => {
    if (e.touches.length === 2) { lastPinchDist.current = getPinchDist(e); isDragging.current = false; }
    else { lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; isDragging.current = true; }
  };
  const handleZoomTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = getPinchDist(e);
      if (lastPinchDist.current) setScale((s) => Math.min(4, Math.max(0.5, s * (dist / lastPinchDist.current))));
      lastPinchDist.current = dist; isDragging.current = false;
    } else if (e.touches.length === 1 && isDragging.current) {
      setPan((p) => ({ x: p.x + e.touches[0].clientX - lastPanPos.current.x, y: p.y + e.touches[0].clientY - lastPanPos.current.y }));
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleZoomTouchEnd = (e) => {
    if (e.touches.length < 2) lastPinchDist.current = null;
    if (e.changedTouches.length === 1 && !isDragging.current) {
      const t = e.changedTouches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (el?.dataset.row !== undefined) handleCellInteract(Number(el.dataset.row), Number(el.dataset.col));
    }
  };
  const handleZoomMouseDown = (e) => { mouseDownPos.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; isDragging.current = false; };
  const handleZoomMouseMove = (e) => {
    if (!mouseDownPos.current) return;
    const dx = e.clientX - mouseDownPos.current.x, dy = e.clientY - mouseDownPos.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) isDragging.current = true;
    if (isDragging.current) setPan({ x: mouseDownPos.current.px + dx, y: mouseDownPos.current.py + dy });
  };
  const handleZoomMouseUp = (e) => {
    if (!isDragging.current && mouseDownPos.current) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el?.dataset.row !== undefined) handleCellInteract(Number(el.dataset.row), Number(el.dataset.col));
    }
    mouseDownPos.current = null; isDragging.current = false;
  };
  const handleWheel = (e) => { e.preventDefault(); setScale((s) => Math.min(4, Math.max(0.5, s * (e.deltaY > 0 ? 0.9 : 1.1)))); };

  // ── Template save ─────────────────────────────────────────────
  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name) { showToast("Please enter a name"); return; }
    const slotGrid = gridToTemplate(grid, fabrics.map((f) => f.id));
    const tpl = { id: Date.now(), name, rows, cols, slotGrid, createdAt: new Date().toLocaleDateString() };
    const updated = [...templates, tpl];
    setTemplates(updated);
    saveTemplates(updated);
    setSaveModal(false);
    setTemplateName("");
    showToast(`Template "${name}" saved`);
  };

  const handleDeleteTemplate = (id) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
    setDeleteConfirm(null);
    showToast("Template deleted");
  };

  // ── Export ────────────────────────────────────────────────────
  const exportQuilt = useCallback(async () => {
    setExporting(true); setExportImage(null);
    const CELL = 120;
    const canvasEl = document.createElement("canvas");
    canvasEl.width  = BORDER + cols * CELL + (cols - 1) * GAP + BORDER;
    canvasEl.height = BORDER + rows * CELL + (rows - 1) * GAP + BORDER;
    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#2c1f14"; ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    const imageCache = {};
    await Promise.all(fabrics.map((f) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { imageCache[f.id] = img; resolve(); };
      img.onerror = resolve; img.src = f.src;
    })));
    grid.forEach((row, ri) => row.forEach((cell, ci) => {
      const x = BORDER + ci * (CELL + GAP), y = BORDER + ri * (CELL + GAP);
      if (cell && typeof cell === "string" && cell.startsWith("__slot_")) {
        const slot = parseInt(cell.replace("__slot_", ""));
        ctx.fillStyle = slotColor(slot); ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = "#2c1f14"; ctx.font = `bold ${CELL * 0.4}px Georgia`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(slot), x + CELL / 2, y + CELL / 2);
      } else if (cell && imageCache[cell]) {
        ctx.drawImage(imageCache[cell], x, y, CELL, CELL);
      } else {
        ctx.fillStyle = "#fdf6ee"; ctx.fillRect(x, y, CELL, CELL);
      }
    }));
    setExportImage(canvasEl.toDataURL("image/png")); setExporting(false);
  }, [grid, fabrics, rows, cols]);

  const closeExport = () => { setExportImage(null); setExporting(false); };

  // ── Cell rendering helpers ────────────────────────────────────
  const getFabricById = (id) => fabrics.find((f) => f.id === id);

  const isSlot = (cell) => cell && typeof cell === "string" && cell.startsWith("__slot_");
  const slotNum = (cell) => parseInt(cell.replace("__slot_", ""));

  const startReplaceMode = () => {
    if (!selectedFabric && fabrics.length === 0) { showToast("Upload fabrics first"); return; }
    setReplaceMode(true); setReplaceFrom(null); showToast("Tap a block to select what to replace");
  };
  const cancelReplace = () => { setReplaceMode(false); setReplaceFrom(null); };
  const removeFabric = (id) => { setFabrics((prev) => prev.filter((f) => f.id !== id)); if (selectedFabric?.id === id) setSelectedFabric(null); };

  const quiltGridStyle = {
    display: "grid", gap: GAP, background: "#2c1f14", padding: BORDER, borderRadius: 4,
    boxShadow: "0 12px 60px rgba(44,31,20,0.25)", userSelect: "none",
    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
    ...(zoomMode ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "center center", transition: "none" } : {}),
  };

  // Mini template preview (small grid of coloured squares)
  const TemplatePreview = ({ tpl }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${tpl.cols}, 1fr)`, gap: 1, width: 64, height: 64, flexShrink: 0, border: "1px solid #e8ddd0", borderRadius: 3, overflow: "hidden" }}>
      {tpl.slotGrid.flat().map((slot, i) => (
        <div key={i} style={{ background: slot ? slotColor(slot) : "#fdf6ee" }} />
      ))}
    </div>
  );

  return (
    <div style={S.root}>

      {/* ── Save Template Modal ── */}
      {saveModal && (
        <div style={S.overlay} onClick={() => setSaveModal(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span style={S.modalTitle}>Save as Template</span>
              <button style={S.modalClose} onClick={() => setSaveModal(false)}>&#x2715;</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={S.modalDesc}>
                The pattern layout will be saved as a template. Fabric images are not stored —
                numbered placeholders remember which slots share the same fabric.
              </p>
              <label style={S.inputLabel}>Template Name</label>
              <input
                style={S.textInput}
                placeholder="e.g. Log Cabin 4x4"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
                autoFocus
              />
              {/* Mini preview of what will be saved */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "20px 0 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 2, width: 80, height: 80, flexShrink: 0, border: "2px solid #e8ddd0", borderRadius: 4, overflow: "hidden", padding: 2 }}>
                  {gridToTemplate(grid, fabrics.map((f) => f.id)).flat().map((slot, i) => (
                    <div key={i} style={{ background: slot ? slotColor(slot) : "#fdf6ee", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {slot > 0 && cols <= 8 && <span style={{ fontSize: 7, color: "#2c1f14", fontWeight: "bold" }}>{slot}</span>}
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#8c6a52" }}>{cols} x {rows} grid</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8c6a52" }}>
                    {new Set(gridToTemplate(grid, fabrics.map((f) => f.id)).flat().filter(Boolean)).size} fabric slots
                  </p>
                </div>
              </div>
              <button style={{ ...S.primaryBtn, marginTop: 24 }} onClick={handleSaveTemplate}>Save Template</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Load Template Modal ── */}
      {loadModal && (
        <div style={S.overlay} onClick={() => setLoadModal(false)}>
          <div style={{ ...S.modal, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span style={S.modalTitle}>Load Template</span>
              <button style={S.modalClose} onClick={() => setLoadModal(false)}>&#x2715;</button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
              {templates.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#8c6a52", fontSize: 14, fontStyle: "italic" }}>
                  No templates saved yet. Complete a design and save it as a template.
                </div>
              ) : (
                templates.map((tpl) => (
                  <div key={tpl.id} style={S.tplRow}>
                    <TemplatePreview tpl={tpl} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.tplName}>{tpl.name}</div>
                      <div style={S.tplMeta}>{tpl.cols} x {tpl.rows} &nbsp;·&nbsp; {new Set(tpl.slotGrid.flat().filter(Boolean)).size} fabric slots &nbsp;·&nbsp; {tpl.createdAt}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                      <button style={S.tplLoadBtn} onClick={() => loadTemplate(tpl)}>Load</button>
                      {deleteConfirm === tpl.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button style={S.tplDeleteConfirm} onClick={() => handleDeleteTemplate(tpl.id)}>Yes</button>
                          <button style={S.tplDeleteCancel} onClick={() => setDeleteConfirm(null)}>No</button>
                        </div>
                      ) : (
                        <button style={S.tplDeleteBtn} onClick={() => setDeleteConfirm(tpl.id)}>Delete</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #e8ddd0" }}>
              <button style={S.primaryBtn} onClick={() => { setLoadModal(false); }}>Start Blank Instead</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export Modal ── */}
      {(exporting || exportImage) && (
        <div style={S.overlay} onClick={closeExport}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span style={S.modalTitle}>Export Quilt</span>
              <button style={S.modalClose} onClick={closeExport}>&#x2715;</button>
            </div>
            {exporting ? (
              <div style={S.modalSpinner}>Rendering your quilt...</div>
            ) : (
              <>
                <div style={S.modalImgWrap}>
                  <img src={exportImage} alt="Quilt Design" style={S.modalImg} />
                </div>
                <div style={S.modalFoot}>
                  <p style={S.modalHint}>On mobile: long-press the image, then tap Save to Photos</p>
                  <p style={S.modalHint}>On desktop: right-click the image, then Save image as</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <span style={S.logo}>Quilt Studio</span>
          {phase === "design" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={S.zoomBtn} onClick={toggleZoom}>{zoomMode ? "Full" : "Zoom"}</button>
              <button style={S.saveTemplateBtn} onClick={() => { setTemplateName(""); setSaveModal(true); }}>Save Template</button>
              <button style={S.exportBtn} onClick={exportQuilt}>Export</button>
              <button style={S.ghostBtn} onClick={() => setPhase("setup")}>New Quilt</button>
            </div>
          )}
        </div>
      </header>

      {toast && <div style={S.toast}>{toast}</div>}

      {/* ── Setup screen ── */}
      {phase === "setup" && (
        <div style={S.setupWrap}>
          <div style={S.setupCard}>
            <p style={S.eyebrow}>New Design</p>
            <h1 style={S.setupTitle}>How large is your quilt?</h1>
            <p style={S.setupSub}>Enter the number of blocks in each direction</p>
            <div style={S.dimRow}>
              <div style={S.dimGroup}>
                <label style={S.dimLabel}>Columns</label>
                <input type="number" min={1} max={20} value={cols} onChange={(e) => setCols(e.target.value)} style={S.dimInput} />
              </div>
              <span style={S.dimX}>x</span>
              <div style={S.dimGroup}>
                <label style={S.dimLabel}>Rows</label>
                <input type="number" min={1} max={20} value={rows} onChange={(e) => setRows(e.target.value)} style={S.dimInput} />
              </div>
            </div>
            <div style={S.previewLabel}>{cols} x {rows} = {cols * rows} blocks</div>
            <button style={S.primaryBtn} onClick={generateGrid}>Start Blank Canvas</button>
            {templates.length > 0 && (
              <button style={{ ...S.secondaryBtn, marginTop: 12 }} onClick={() => setLoadModal(true)}>
                Load a Saved Template ({templates.length})
              </button>
            )}
          </div>
          <div style={{ ...S.miniGrid, gridTemplateColumns: `repeat(${Math.min(cols, 10)}, 1fr)` }}>
            {Array.from({ length: Math.min(rows, 10) * Math.min(cols, 10) }).map((_, i) => <div key={i} style={S.miniDot} />)}
          </div>
        </div>
      )}

      {/* ── Design screen ── */}
      {phase === "design" && (
        <div style={S.designWrap}>
          <aside style={S.sidebar}>
            <div style={S.section}>
              <div style={S.sectionHead}>
                <span style={S.sectionLabel}>Fabrics</span>
                <label htmlFor={fileInputId} style={S.addBtn}>
                  + Add
                  <input id={fileInputId} type="file" accept="image/*" multiple
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                    onChange={handleFabricUpload} />
                </label>
              </div>
              {fabrics.length === 0 && (
                <div style={S.emptyFabrics}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🪡</div>
                  <p style={S.emptyText}>Upload fabric photos from your phone</p>
                </div>
              )}
              <div style={S.fabricList}>
                {fabrics.map((f) => (
                  <div key={f.id} style={{ ...S.fabricItem, ...(selectedFabric?.id === f.id ? S.fabricSel : {}) }} onClick={() => setSelectedFabric(f)}>
                    <img src={f.src} alt={f.name} style={S.thumb} />
                    <span style={S.fabricName}>{f.name.replace(/\.[^.]+$/, "").slice(0, 16)}</span>
                    <button style={S.removeBtn} onClick={(e) => { e.stopPropagation(); removeFabric(f.id); }}>&#x2715;</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.section}>
              <span style={S.sectionLabel}>Tools</span>
              <div style={S.toolRow}>
                <div style={S.activeSwatch}>
                  {selectedFabric ? <img src={selectedFabric.src} style={S.activeSwatchImg} alt="" /> : <span style={S.swatchNone}>None</span>}
                </div>
                <span style={S.toolLabel}>Active fabric</span>
              </div>
              {replaceMode ? (
                <>
                  <div style={S.replaceBanner}>{replaceFrom === null ? "Step 1: Tap a block to replace" : "Step 2: Tap canvas to apply"}</div>
                  <button style={S.cancelBtn} onClick={cancelReplace}>Cancel</button>
                </>
              ) : (
                <button style={S.replaceBtn} onClick={startReplaceMode}>Replace All</button>
              )}
              <p style={S.hint}>{zoomMode ? "Pinch to zoom  ·  Drag to pan  ·  Tap to paint" : "Select a fabric, then tap or drag blocks to paint."}</p>
            </div>

            <div style={S.section}>
              <span style={S.sectionLabel}>Grid</span>
              <div style={S.gridInfo}>{cols} x {rows}</div>
              <button style={S.ghostBtn2} onClick={() => setPhase("setup")}>Resize / New</button>
            </div>
          </aside>

          <main
            ref={canvasAreaRef}
            style={{ ...S.canvas, overflow: zoomMode ? "hidden" : "auto", cursor: zoomMode ? "grab" : "default" }}
            onMouseDown={zoomMode ? handleZoomMouseDown : undefined}
            onMouseMove={zoomMode ? handleZoomMouseMove : undefined}
            onMouseUp={zoomMode ? handleZoomMouseUp : undefined}
            onMouseLeave={zoomMode ? () => { mouseDownPos.current = null; } : () => setIsPainting(false)}
            onWheel={zoomMode ? handleWheel : undefined}
            onTouchStart={zoomMode ? handleZoomTouchStart : undefined}
            onTouchMove={zoomMode ? handleZoomTouchMove : handleTouchMove}
            onTouchEnd={zoomMode ? handleZoomTouchEnd : undefined}
          >
            <div style={quiltGridStyle}>
              {grid.map((row, ri) => row.map((cell, ci) => {
                const fabric = (!isSlot(cell)) ? getFabricById(cell) : null;
                const slot = isSlot(cell) ? slotNum(cell) : null;
                return (
                  <div key={`${ri}-${ci}`} data-row={ri} data-col={ci}
                    style={{ ...S.cell, width: cellSize, height: cellSize, ...(replaceMode ? S.cellReplace : {}), ...(slot ? { background: slotColor(slot) } : {}) }}
                    onMouseDown={zoomMode ? undefined : () => { setIsPainting(true); handleCellInteract(ri, ci); }}
                    onMouseEnter={zoomMode ? undefined : () => { if (isPainting && !replaceMode) paintCell(ri, ci); }}
                    onMouseUp={zoomMode ? undefined : () => setIsPainting(false)}
                    onTouchStart={zoomMode ? undefined : () => handleCellInteract(ri, ci)}>
                    {fabric && <img src={fabric.src} alt="" style={S.cellImg} draggable={false} />}
                    {slot && (
                      <div style={S.cellEmpty}>
                        <span style={{ ...S.slotLabel, fontSize: Math.max(8, Math.min(cellSize * 0.35, 28)) }}>{slot}</span>
                      </div>
                    )}
                    {!fabric && !slot && <div style={S.cellEmpty} />}
                  </div>
                );
              }))}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

const CREAM = "#fdf6ee", WARM = "#e8ddd0", DARK = "#2c1f14", ACCENT = "#b85c2a", MID = "#8c6a52";

const S = {
  root: { minHeight: "100vh", background: CREAM, fontFamily: "Georgia, serif", color: DARK, display: "flex", flexDirection: "column" },

  overlay: { position: "fixed", inset: 0, background: "rgba(44,31,20,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#fff", borderRadius: 12, width: "100%", maxWidth: 480, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${WARM}`, flexShrink: 0 },
  modalTitle: { fontSize: 16, fontStyle: "italic" },
  modalClose: { background: "none", border: "none", fontSize: 20, color: MID, cursor: "pointer", lineHeight: 1 },
  modalDesc: { fontSize: 13, color: MID, lineHeight: 1.6, marginBottom: 20, marginTop: 0 },
  modalImgWrap: { flex: 1, overflow: "auto", padding: 20, display: "flex", alignItems: "center", justifyContent: "center", background: CREAM },
  modalImg: { maxWidth: "100%", maxHeight: "58vh", borderRadius: 4, boxShadow: "0 4px 24px rgba(44,31,20,0.2)", display: "block" },
  modalFoot: { padding: "12px 20px 18px", borderTop: `1px solid ${WARM}`, flexShrink: 0 },
  modalHint: { fontSize: 12, color: MID, margin: "3px 0", textAlign: "center" },
  modalSpinner: { padding: 60, textAlign: "center", fontSize: 16, color: MID, fontStyle: "italic" },
  inputLabel: { display: "block", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: MID, marginBottom: 8 },
  textInput: { width: "100%", padding: "10px 12px", fontSize: 15, border: `2px solid ${WARM}`, borderRadius: 8, fontFamily: "Georgia, serif", color: DARK, background: CREAM, outline: "none", boxSizing: "border-box" },

  // Template list row
  tplRow: { display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: `1px solid ${WARM}` },
  tplName: { fontSize: 14, color: DARK, marginBottom: 3 },
  tplMeta: { fontSize: 11, color: MID },
  tplLoadBtn: { background: ACCENT, color: "#fff", border: "none", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" },
  tplDeleteBtn: { background: "transparent", color: MID, border: `1px solid ${WARM}`, padding: "5px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontFamily: "Georgia, serif" },
  tplDeleteConfirm: { background: "#c0392b", color: "#fff", border: "none", padding: "5px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 },
  tplDeleteCancel: { background: "transparent", color: MID, border: `1px solid ${WARM}`, padding: "5px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 },

  header: { background: DARK, padding: "0 16px", height: 52, display: "flex", alignItems: "center", flexShrink: 0 },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" },
  logo: { color: CREAM, fontSize: 16, letterSpacing: "0.08em", fontStyle: "italic" },
  ghostBtn: { background: "transparent", border: `1px solid ${WARM}`, color: CREAM, padding: "5px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" },
  exportBtn: { background: ACCENT, border: "none", color: "#fff", padding: "5px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" },
  saveTemplateBtn: { background: "transparent", border: "1px solid #c8a87a", color: "#c8a87a", padding: "5px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" },
  zoomBtn: { background: "transparent", border: "1px solid #7a9e7e", color: "#a8c8ac", padding: "5px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" },
  toast: { position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", background: DARK, color: CREAM, padding: "10px 22px", borderRadius: 6, fontSize: 13, zIndex: 1100, pointerEvents: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", whiteSpace: "nowrap" },

  setupWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 40 },
  setupCard: { background: "#fff", border: `1px solid ${WARM}`, borderRadius: 12, padding: "40px 48px", maxWidth: 440, width: "100%", textAlign: "center", boxShadow: "0 8px 40px rgba(44,31,20,0.07)" },
  eyebrow: { fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: MID, marginBottom: 8 },
  setupTitle: { fontSize: 28, fontWeight: "normal", margin: "0 0 8px" },
  setupSub: { color: MID, fontSize: 14, marginBottom: 32 },
  dimRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 },
  dimGroup: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  dimLabel: { fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: MID },
  dimInput: { width: 80, padding: "10px 8px", fontSize: 24, textAlign: "center", border: `2px solid ${WARM}`, borderRadius: 8, fontFamily: "Georgia, serif", color: DARK, background: CREAM, outline: "none" },
  dimX: { fontSize: 28, color: WARM, paddingTop: 18 },
  previewLabel: { fontSize: 13, color: MID, marginBottom: 28 },
  primaryBtn: { background: ACCENT, color: "#fff", border: "none", padding: "14px 32px", borderRadius: 8, fontSize: 15, cursor: "pointer", fontFamily: "Georgia, serif", width: "100%" },
  secondaryBtn: { background: "transparent", color: ACCENT, border: `2px solid ${ACCENT}`, padding: "12px 32px", borderRadius: 8, fontSize: 15, cursor: "pointer", fontFamily: "Georgia, serif", width: "100%" },
  miniGrid: { display: "grid", gap: 4, opacity: 0.25 },
  miniDot: { width: 8, height: 8, background: ACCENT, borderRadius: 1 },

  designWrap: { flex: 1, display: "flex", overflow: "hidden", minHeight: 0 },
  sidebar: { width: 216, background: "#fff", borderRight: `1px solid ${WARM}`, display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0 },
  section: { padding: "16px", borderBottom: `1px solid ${WARM}` },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionLabel: { fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: MID, display: "block", marginBottom: 8 },
  addBtn: { background: ACCENT, color: "#fff", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 12, cursor: "pointer", position: "relative", display: "inline-block", userSelect: "none" },
  emptyFabrics: { textAlign: "center", padding: "16px 8px" },
  emptyText: { fontSize: 12, color: MID, lineHeight: 1.5 },
  fabricList: { display: "flex", flexDirection: "column", gap: 6 },
  fabricItem: { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", border: "2px solid transparent", background: CREAM },
  fabricSel: { border: `2px solid ${ACCENT}`, background: "#fff5ef" },
  thumb: { width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0, border: `1px solid ${WARM}` },
  fabricName: { fontSize: 11, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  removeBtn: { background: "none", border: "none", color: MID, fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 },
  toolRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  activeSwatch: { width: 44, height: 44, border: `2px solid ${ACCENT}`, borderRadius: 6, overflow: "hidden", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  activeSwatchImg: { width: "100%", height: "100%", objectFit: "cover" },
  swatchNone: { fontSize: 10, color: MID },
  toolLabel: { fontSize: 11, color: MID },
  replaceBtn: { width: "100%", background: DARK, color: CREAM, border: "none", padding: "9px 0", borderRadius: 6, fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif", marginBottom: 10 },
  replaceBanner: { background: "#fff5ef", border: `1px solid ${ACCENT}`, borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#7a3e1d", marginBottom: 8, textAlign: "center" },
  cancelBtn: { width: "100%", background: "transparent", border: `1px solid ${MID}`, color: MID, padding: "7px 0", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif", marginBottom: 8 },
  hint: { fontSize: 11, color: MID, lineHeight: 1.5, margin: 0 },
  gridInfo: { fontSize: 22, fontStyle: "italic", marginBottom: 10 },
  ghostBtn2: { background: "transparent", border: `1px solid ${WARM}`, color: MID, padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" },

  canvas: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: `repeating-conic-gradient(${WARM} 0% 25%, ${CREAM} 0% 50%) 0 0 / 24px 24px` },
  cell: { cursor: "crosshair", overflow: "hidden", position: "relative", touchAction: "none", background: CREAM },
  cellReplace: { cursor: "pointer" },
  cellImg: { width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" },
  cellEmpty: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  slotLabel: { fontWeight: "bold", color: "#2c1f14", opacity: 0.7, pointerEvents: "none", fontFamily: "Georgia, serif" },
};
