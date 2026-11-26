//#region src/runtime.ts
let _react = null;
let _api = null;
function initRuntime(api) {
	_react = api.react;
	_api = api;
}
/** The scoped SafelightAPI captured at activate(). */
function api() {
	if (!_api) throw new Error("[library-search] api used before activate()");
	return _api;
}
/** The app's React namespace (createElement, useState, useEffect, useRef, …). */
function R() {
	if (!_react) throw new Error("[library-search] runtime used before activate()");
	return _react;
}
/** createElement shorthand. */
function h(type, props, ...children) {
	return R().createElement(type, props, ...children);
}
//#endregion
//#region src/search-store.ts
/** The bar after a toggle: opening keeps the box, closing empties it. */
function toggled(s) {
	return s.visible ? {
		visible: false,
		query: ""
	} : {
		visible: true,
		query: s.query
	};
}
let store = null;
function initSearchStore(api) {
	store = api.stores.create((set) => ({
		query: "",
		setQuery: (q) => set({ query: q }),
		visible: false,
		setVisible: (v) => set({ visible: v }),
		toggle: () => set(toggled)
	}));
	return store;
}
function searchStore() {
	if (!store) throw new Error("[library-search] search store used before activate()");
	return store;
}
//#endregion
//#region src/query.ts
const EDIT_FIELDS = /* @__PURE__ */ new Set(["edited", "edit"]);
const YES = /* @__PURE__ */ new Set([
	"yes",
	"y",
	"true"
]);
const NO = /* @__PURE__ */ new Set([
	"no",
	"n",
	"false"
]);
/** Build a matcher from a raw query. Empty/whitespace matches everything.
*  Without `editedAt` (a Safelight older than 3.2.6), an edited: term matches
*  nothing. */
function buildMatcher(raw, editedAt) {
	const tokens = tokenize(raw);
	if (tokens.length === 0) return () => true;
	const clauses = tokens.map((token) => compileToken(token, editedAt));
	return (photo) => clauses.every((c) => c(photo));
}
/** Whether a query has an edited: term, so its matcher reads edit times. */
function queryReadsEdits(raw) {
	return tokenize(raw).some((token) => {
		const colon = token.indexOf(":");
		return colon > 0 && colon < token.length - 1 && EDIT_FIELDS.has(token.slice(0, colon).toLowerCase());
	});
}
/** True when a query actually constrains anything (drives the active styling). */
function isQueryActive(raw) {
	return tokenize(raw).length > 0;
}
function tokenize(raw) {
	return raw.trim().split(/\s+/).filter(Boolean);
}
function compileToken(token, editedAt) {
	const colon = token.indexOf(":");
	if (colon > 0) {
		const field = token.slice(0, colon).toLowerCase();
		const value = token.slice(colon + 1);
		if (value) {
			if (EDIT_FIELDS.has(field)) return editClause(value, editedAt);
			const clause = compileField(field, value);
			if (clause) return clause;
			return freeText(value);
		}
	}
	return freeText(token);
}
function compileField(field, value) {
	switch (field) {
		case "filename":
		case "file":
		case "name": return (p) => incl(p.filename, value);
		case "keyword":
		case "keywords":
		case "kw": return (p) => p.keywords.some((k) => incl(k, value));
		case "camera":
		case "make":
		case "model": return (p) => incl(p.exif.cameraMake, value) || incl(p.exif.cameraModel, value);
		case "lens": return (p) => incl(p.exif.lens, value);
		case "type":
		case "mime":
		case "ext": return (p) => incl(p.mimeType, value);
		case "label":
		case "color": return (p) => p.colorLabel === value.toLowerCase();
		case "iso": return numClause(value, (p) => p.exif.iso);
		case "focal":
		case "focallength":
		case "mm": return numClause(value, (p) => p.exif.focalLength);
		case "date":
		case "day": return (p) => dateStr(p).includes(value.toLowerCase());
		default: return null;
	}
}
function editClause(value, editedAt) {
	if (!editedAt) return () => false;
	const v = value.toLowerCase();
	if (YES.has(v)) return (p) => editedAt(p.id) !== void 0;
	if (NO.has(v)) return (p) => editedAt(p.id) === void 0;
	return (p) => {
		const t = editedAt(p.id);
		return t !== void 0 && localDate(t).includes(v);
	};
}
function incl(hay, needle) {
	return !!hay && hay.toLowerCase().includes(needle.toLowerCase());
}
function freeText(token) {
	const t = token.toLowerCase();
	return (p) => blob(p).includes(t);
}
/** Searchable text for bare tokens: filename + keywords + a few EXIF facets,
*  encoded so "300mm", "iso6400", "6400" and "2024-06" all hit. */
function blob(p) {
	const e = p.exif;
	return [
		p.filename,
		p.keywords.join(" "),
		p.mimeType,
		p.colorLabel === "none" ? "" : p.colorLabel,
		e.cameraMake,
		e.cameraModel,
		e.lens,
		e.focalLength != null ? `${e.focalLength}mm` : "",
		e.iso != null ? `iso${e.iso} ${e.iso}` : "",
		dateStr(p)
	].filter(Boolean).join(" ").toLowerCase();
}
function numClause(value, get) {
	const cmp = parseNum(value);
	return (p) => {
		const n = get(p);
		return n != null && cmp(n);
	};
}
/** Parse ">3200", ">=3200", "<800", "=300", "300", "300mm", or "200-300". An
*  unparseable value never matches numerically. */
function parseNum(value) {
	const range = value.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
	if (range) {
		const lo = Number(range[1]);
		const hi = Number(range[2]);
		return (n) => n >= lo && n <= hi;
	}
	const m = value.match(/^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+)?)\s*[a-z]*$/i);
	if (!m) return () => false;
	const target = Number(m[2]);
	switch (m[1]) {
		case ">": return (n) => n > target;
		case ">=": return (n) => n >= target;
		case "<": return (n) => n < target;
		case "<=": return (n) => n <= target;
		default: return (n) => n === target;
	}
}
/** Local YYYY-MM-DD for the capture date, or "" if unknown. */
function dateStr(p) {
	return p.dateCreated ? localDate(p.dateCreated) : "";
}
/** Local YYYY-MM-DD for a time in ms, or "" for an invalid one. */
function localDate(t) {
	const d = new Date(t);
	if (Number.isNaN(d.getTime())) return "";
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}
//#endregion
//#region src/sort.ts
const PREFIX = "com.safelight.advanced-library-sort";
function text(get) {
	return (a, b) => {
		const av = (get(a) ?? "").trim().toLowerCase();
		const bv = (get(b) ?? "").trim().toLowerCase();
		if (!av && !bv) return 0;
		if (!av) return 1;
		if (!bv) return -1;
		return av.localeCompare(bv);
	};
}
function num(get) {
	return (a, b) => {
		const av = get(a);
		const bv = get(b);
		const am = av == null;
		const bm = bv == null;
		if (am && bm) return 0;
		if (am) return 1;
		if (bm) return -1;
		return av - bv;
	};
}
function cameraName(p) {
	return `${p.exif.cameraMake ?? ""} ${p.exif.cameraModel ?? ""}`.trim();
}
const SORTS = [
	{
		id: `${PREFIX}.camera`,
		label: "Camera",
		compare: text(cameraName),
		reads: ["exif"]
	},
	{
		id: `${PREFIX}.lens`,
		label: "Lens",
		compare: text((p) => p.exif.lens),
		reads: ["exif"]
	},
	{
		id: `${PREFIX}.focal`,
		label: "Focal Length",
		compare: num((p) => p.exif.focalLength),
		reads: ["exif"]
	},
	{
		id: `${PREFIX}.iso`,
		label: "ISO",
		compare: num((p) => p.exif.iso),
		reads: ["exif"]
	}
];
//#endregion
//#region src/icons.ts
/** Magnifier sized to `size` px. Colour is inherited (currentColor). */
function searchIcon(size = 14) {
	return h("svg", {
		viewBox: "0 0 24 24",
		width: size,
		height: size,
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		style: {
			display: "block",
			flexShrink: 0
		}
	}, h("circle", {
		cx: 11,
		cy: 11,
		r: 7
	}), h("line", {
		x1: 21,
		y1: 21,
		x2: 16.65,
		y2: 16.65
	}));
}
//#endregion
//#region src/shortcut.ts
const ID = "com.safelight.advanced-library-sort";
const TOGGLE_SEARCH_ACTION = `${ID}.focus`;
/** "Label (Combo)", or the label alone when the action is unbound. */
function withShortcut(label, combo) {
	return combo ? `${label} (${combo})` : label;
}
//#endregion
//#region src/SearchBar.ts
function SearchBar() {
	const ui = api().ui;
	if (!ui) return h("div", { style: {
		padding: "10px",
		fontSize: "11px",
		color: "var(--color-text-muted)"
	} }, "Update Safelight to use this panel.");
	const t = ui.tokens;
	const react = R();
	const store = searchStore();
	const query = store((s) => s.query);
	const setQuery = store((s) => s.setQuery);
	const visible = store((s) => s.visible);
	const setVisible = store((s) => s.setVisible);
	const inputRef = react.useRef(null);
	react.useEffect(() => {
		if (!visible) return;
		const el = inputRef.current;
		if (el) {
			el.focus();
			el.select();
		}
	}, [visible]);
	if (!visible) return null;
	const close = () => {
		setQuery("");
		setVisible(false);
	};
	const active = isQueryActive(query);
	const field = h("div", { style: {
		position: "relative",
		display: "flex",
		alignItems: "center",
		width: "20rem",
		maxWidth: "100%"
	} }, h("span", { style: {
		position: "absolute",
		left: "9px",
		top: "50%",
		transform: "translateY(-50%)",
		display: "flex",
		color: t.textMuted,
		pointerEvents: "none"
	} }, searchIcon(14)), h("input", {
		ref: inputRef,
		type: "text",
		value: query,
		placeholder: "Search in library…",
		title: "Search filename, keywords, camera, lens, ISO, date. Try: heron 300mm · lens:70-300 · iso:>3200 · date:2024-06",
		onChange: (e) => setQuery(e.currentTarget.value),
		onKeyDown: (e) => {
			if (e.key === "Escape") if (query) setQuery("");
			else close();
		},
		onFocus: (e) => {
			e.currentTarget.style.borderColor = t.accent;
		},
		onBlur: (e) => {
			e.currentTarget.style.borderColor = t.borderSubtle;
		},
		style: {
			width: "100%",
			boxSizing: "border-box",
			borderRadius: "4px",
			border: `1px solid ${t.borderSubtle}`,
			background: t.surface2,
			color: t.textPrimary,
			fontSize: "11px",
			padding: "5px 26px 5px 28px",
			outline: "none"
		}
	}), active ? h("button", {
		onClick: () => setQuery(""),
		title: "Clear text (Esc)",
		"aria-label": "Clear search text",
		style: {
			position: "absolute",
			right: "6px",
			top: "50%",
			transform: "translateY(-50%)",
			display: "flex",
			alignItems: "center",
			background: "transparent",
			border: "none",
			padding: 0,
			cursor: "pointer",
			color: t.textMuted,
			fontSize: "15px",
			lineHeight: 1
		}
	}, "×") : null);
	const closeButton = h(ui.Button, {
		variant: "ghost",
		size: "sm",
		onClick: close,
		title: withShortcut("Close search", api().keybindings.getBinding(TOGGLE_SEARCH_ACTION)),
		"aria-label": "Close search"
	}, "×");
	return h("div", { style: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "8px",
		padding: "6px 12px",
		borderBottom: `1px solid ${t.borderSubtle}`,
		background: t.surface1
	} }, field, closeButton);
}
//#endregion
//#region src/SearchToggle.ts
function SearchToggle() {
	const ui = api().ui;
	if (!ui) return null;
	const store = searchStore();
	const visible = store((s) => s.visible);
	const toggle = store((s) => s.toggle);
	const combo = api().keybindings.getBinding(TOGGLE_SEARCH_ACTION);
	return h("button", {
		type: "button",
		onClick: toggle,
		title: withShortcut(visible ? "Close the library search" : "Search the library", combo),
		"aria-label": "Toggle library search",
		"aria-pressed": visible,
		className: "sl-library-toolbar-action",
		style: visible ? {
			background: ui.tokens.surface4,
			color: ui.tokens.textPrimary
		} : void 0
	}, "Search");
}
//#endregion
//#region src/saved-searches.ts
const RATING_OP_SYMBOL = {
	lt: "<",
	lte: "≤",
	gt: ">",
	gte: "≥",
	eq: "=",
	neq: "≠"
};
/** Short human summary of a filter, e.g. "≥3★ · red · edited"; "" while it
*  narrows nothing. */
function filterSummary(f) {
	const parts = [];
	if (f.rating > 0 || f.ratingOp !== "gte") parts.push(`${RATING_OP_SYMBOL[f.ratingOp] ?? "≥"}${f.rating}★`);
	if (f.flag !== "any") parts.push(f.flag);
	if (f.label !== "any") parts.push(f.label);
	if (f.keywords.length) parts.push(f.keywords.join(", "));
	if (f.edited && f.edited !== "any") parts.push(f.edited);
	return parts.join(" · ");
}
/** The whole Library filter a saved search puts back: one saved before the
*  Edits filter existed sets Edits to All. */
function restoredFilter(s) {
	return {
		...s.filter,
		edited: s.filter.edited ?? "any"
	};
}
/** An id no entry in `list` uses. The fallback is for a runtime without
*  crypto.randomUUID (an insecure context). */
function newSearchId(list) {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	const used = new Set(list.map((s) => s.id));
	let n = list.length;
	while (used.has(`s_${n}`)) n += 1;
	return `s_${n}`;
}
function withSavedSearch(list, fields) {
	return [...list, {
		id: newSearchId(list),
		...fields
	}];
}
function withoutSavedSearch(list, id) {
	return list.filter((s) => s.id !== id);
}
//#endregion
//#region src/SmartSearches.ts
const KEY = "savedSearches";
function load() {
	const raw = api().settings.get(KEY, []);
	return Array.isArray(raw) ? raw : [];
}
function save(list) {
	api().settings.set(KEY, list);
}
function SmartSearchesPanel() {
	const ui = api().ui;
	if (!ui) return h("div", { style: {
		padding: "10px",
		fontSize: "11px",
		color: "var(--color-text-muted)"
	} }, "Update Safelight to use this panel.");
	const t = ui.tokens;
	const react = R();
	const [list, setList] = react.useState(load);
	const [name, setName] = react.useState("");
	react.useEffect(() => {
		return api().settings.onChange((key) => {
			if (key === KEY) setList(load());
		});
	}, []);
	const liveQuery = searchStore()((s) => s.query);
	const searching = searchStore()((s) => s.visible);
	const toggleSearch = searchStore()((s) => s.toggle);
	const combo = api().keybindings.getBinding(TOGGLE_SEARCH_ACTION);
	const liveFilter = api().stores.useUIStore((s) => s.filter);
	const canSave = isQueryActive(liveQuery) || filterSummary(liveFilter) !== "";
	const commit = (next) => {
		setList(next);
		save(next);
	};
	const onSave = () => {
		commit(withSavedSearch(list, {
			name: name.trim() || liveQuery.trim() || filterSummary(liveFilter) || "Untitled search",
			query: liveQuery,
			filter: liveFilter
		}));
		setName("");
	};
	const onApply = (s) => {
		searchStore().getState().setQuery(s.query);
		api().stores.useUIStore.getState().setFilter(restoredFilter(s));
	};
	const onDelete = (id) => {
		commit(withoutSavedSearch(list, id));
	};
	const textInput = {
		minWidth: 0,
		flex: 1,
		boxSizing: "border-box",
		borderRadius: "4px",
		border: `1px solid ${t.borderSubtle}`,
		background: t.surface2,
		color: t.textPrimary,
		fontSize: "11px",
		padding: "4px 8px",
		outline: "none"
	};
	const ellipsis = {
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	};
	return h("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: "8px",
		padding: "8px"
	} }, h("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: "4px"
	} }, h(ui.Button, {
		variant: "ghost",
		size: "sm",
		onClick: toggleSearch,
		title: withShortcut(searching ? "Close the library search" : "Search the library", combo),
		"aria-label": "Toggle library search",
		"aria-pressed": searching,
		style: searching ? {
			color: t.accent,
			padding: "4px"
		} : { padding: "4px" }
	}, searchIcon(13)), h("input", {
		type: "text",
		value: name,
		placeholder: "Name this search…",
		onChange: (e) => setName(e.currentTarget.value),
		onKeyDown: (e) => {
			if (e.key === "Enter" && canSave) onSave();
		},
		style: textInput
	}), h(ui.Button, {
		variant: "secondary",
		size: "sm",
		onClick: onSave,
		disabled: !canSave,
		title: canSave ? "Save the current search + filters" : withShortcut("Search the library", combo) + " or set a filter first"
	}, "Save")), list.length === 0 ? h("p", { style: {
		padding: "8px 4px",
		fontSize: "10px",
		color: t.textMuted
	} }, `No saved searches yet. ${combo ? `Search (${combo})` : "Search"} or filter the Library, then Save.`) : h("ul", { style: {
		display: "flex",
		flexDirection: "column",
		gap: "2px",
		listStyle: "none",
		margin: 0,
		padding: 0
	} }, ...list.map((s) => h("li", {
		key: s.id,
		style: {
			display: "flex",
			alignItems: "center",
			gap: "4px",
			borderRadius: "4px",
			padding: "4px"
		},
		onMouseEnter: (e) => {
			e.currentTarget.style.background = t.surface2;
		},
		onMouseLeave: (e) => {
			e.currentTarget.style.background = "transparent";
		}
	}, h("button", {
		onClick: () => onApply(s),
		title: "Apply this saved search",
		style: {
			display: "flex",
			flexDirection: "column",
			alignItems: "flex-start",
			textAlign: "left",
			flex: 1,
			minWidth: 0,
			background: "transparent",
			border: "none",
			padding: 0,
			cursor: "pointer"
		}
	}, h("span", { style: {
		display: "flex",
		alignItems: "center",
		gap: "6px",
		maxWidth: "100%",
		color: t.textPrimary,
		fontSize: "11px"
	} }, h("span", { style: {
		display: "flex",
		color: t.textMuted
	} }, searchIcon(12)), h("span", { style: ellipsis }, s.name)), h("span", { style: {
		maxWidth: "100%",
		fontSize: "9px",
		color: t.textMuted,
		...ellipsis
	} }, [s.query, filterSummary(s.filter)].filter(Boolean).join("  ·  ") || "all photos")), h("button", {
		onClick: () => onDelete(s.id),
		title: "Delete saved search",
		"aria-label": "Delete saved search",
		style: {
			background: "transparent",
			border: "none",
			padding: "0 4px",
			cursor: "pointer",
			color: t.textMuted,
			fontSize: "13px",
			lineHeight: 1
		},
		onMouseEnter: (e) => {
			e.currentTarget.style.color = "#e06666";
		},
		onMouseLeave: (e) => {
			e.currentTarget.style.color = t.textMuted;
		}
	}, "×")))));
}
//#endregion
//#region src/index.ts
const GRID_FILTER_ID = `${ID}.filter`;
const DEBOUNCE_MS = 150;
function activate(api) {
	initRuntime(api);
	const store = initSearchStore(api);
	for (const sort of SORTS) api.registerLibrarySort(sort);
	const applyFilter = () => {
		const { query } = store.getState();
		api.registerGridFilter({
			id: GRID_FILTER_ID,
			test: buildMatcher(query, api.catalog.editedAt),
			reads: isQueryActive(query) ? void 0 : [],
			readsEdits: queryReadsEdits(query),
			onClear: () => store.getState().setQuery("")
		});
	};
	applyFilter();
	let timer;
	store.subscribe((s, prev) => {
		if (s.query === prev.query) return;
		if (timer !== void 0) window.clearTimeout(timer);
		timer = window.setTimeout(applyFilter, DEBOUNCE_MS);
	});
	api.registerSlot({
		id: `${ID}.bar`,
		slot: "library-subbar",
		component: SearchBar,
		order: 0
	});
	api.registerSlot({
		id: `${ID}.toggle`,
		slot: "library-toolbar",
		component: SearchToggle
	});
	api.registerKeybinding({
		id: TOGGLE_SEARCH_ACTION,
		label: "Toggle library search",
		category: "Library",
		defaultCombo: "Ctrl+F",
		handler: () => store.getState().toggle()
	});
	api.registerPanel({
		id: `${ID}.smart`,
		title: "Smart Searches",
		component: SmartSearchesPanel,
		defaultDock: {
			module: "library",
			direction: "left",
			order: 20,
			height: 220
		}
	});
}
function deactivate() {}
//#endregion
export { activate, deactivate };
