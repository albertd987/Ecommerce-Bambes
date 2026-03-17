import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "../services/api"
import ProductCard from "../components/ProductCard"
import Header from "../components/Header"
import { ChevronDown, SlidersHorizontal, X } from "lucide-react"

/** Pill de comptador (Nike-like) */
function ActivePill({ count }) {
  if (!count || count <= 0) return null
  return (
    <span className="ml-2 inline-flex items-center justify-center rounded-full border border-border bg-muted px-2 py-0.5 text-[12px] font-medium text-foreground">
      {count}
    </span>
  )
}

/** Resum discret del valor seleccionat a la dreta */
function SelectedSummary({ text }) {
  if (!text) return null
  return (
    <span className="ml-2 text-[12px] text-muted-foreground truncate max-w-[140px]">
      {text}
    </span>
  )
}

/** Secció plegable reusable (estil Nike) */
function CollapsibleSection({
  title,
  count = 0,
  summary = "",
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-border py-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left cursor-pointer group"
      >
        <div className="flex items-center min-w-0">
          <span className="text-[15px] font-medium text-foreground truncate">
            {title}
          </span>
          <ActivePill count={count} />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <SelectedSummary text={summary} />
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

function CheckboxOption({ label, checked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted transition-colors"
    >
      <span className="text-sm text-foreground">{label}</span>

      <span
        className={`h-4 w-4 rounded-[4px] border flex items-center justify-center ${
          checked
            ? "bg-foreground border-foreground"
            : "border-border bg-background"
        }`}
        aria-hidden="true"
      >
        {checked ? <span className="block h-2 w-2 rounded-[2px] bg-background" /> : null}
      </span>
    </button>
  )
}

/** Chip */
function FilterChip({ label, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
      title="Treure filtre"
    >
      <span className="max-w-[220px] truncate">{label}</span>
      <X className="h-4 w-4 text-muted-foreground" />
    </button>
  )
}

/** Paginació robusta amb números + ellipsis */
function Pagination({ page, lastPage, onPage, loading, t }) {
  if (!lastPage || lastPage <= 1) return null

  const clamp = (n) => Math.max(1, Math.min(lastPage, n))

  const getPages = () => {
    const p = page
    const pages = new Set([1, lastPage, p, p - 1, p + 1, p - 2, p + 2])
    const arr = [...pages]
      .filter((x) => x >= 1 && x <= lastPage)
      .sort((a, b) => a - b)

    const out = []
    for (let i = 0; i < arr.length; i++) {
      const curr = arr[i]
      const prev = arr[i - 1]
      if (i > 0 && curr - prev > 1) out.push("…")
      out.push(curr)
    }
    return out
  }

  const pages = getPages()

  const btnBase = "h-9 min-w-[36px] px-3 rounded-md border text-sm transition-colors"
  const btn = btnBase + " hover:bg-muted"
  const btnActive = btnBase + " bg-foreground text-background border-foreground hover:opacity-90"
  const btnDisabled = btnBase + " opacity-50 cursor-not-allowed"

  return (
    <div className="flex items-center justify-between gap-4 mt-10">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={loading || page <= 1 ? btnDisabled : btn}
          disabled={loading || page <= 1}
          onClick={() => onPage(1)}
        >
          {t("home.pagination.first")}
        </button>
        <button
          type="button"
          className={loading || page <= 1 ? btnDisabled : btn}
          disabled={loading || page <= 1}
          onClick={() => onPage(clamp(page - 1))}
        >
          {t("home.pagination.prev")}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        {pages.map((p, idx) => {
          if (p === "…") {
            return (
              <span key={`dots-${idx}`} className="px-2 text-muted-foreground">
                …
              </span>
            )
          }
          const isActive = p === page
          return (
            <button
              key={p}
              type="button"
              className={isActive ? btnActive : btn}
              disabled={loading}
              onClick={() => onPage(p)}
              aria-current={isActive ? "page" : undefined}
            >
              {p}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={loading || page >= lastPage ? btnDisabled : btn}
          disabled={loading || page >= lastPage}
          onClick={() => onPage(clamp(page + 1))}
        >
          {t("home.pagination.next")}
        </button>
        <button
          type="button"
          className={loading || page >= lastPage ? btnDisabled : btn}
          disabled={loading || page >= lastPage}
          onClick={() => onPage(lastPage)}
        >
          {t("home.pagination.last")}
        </button>
      </div>
    </div>
  )
}

function FilterSidebar({
  visible,
  draftFilters,
  setDraftFilters,
  appliedFilters,
  setAppliedFilters,
  onApply,
  onClearAll,
  filterOptions,
  filtersLoading,
  t,
}) {
  if (!visible) {
    return (
      <div className="shrink-0 self-stretch transition-all duration-300 w-0 opacity-0 mr-0" />
    )
  }

  const brands = filterOptions?.brands ?? []
  const types = filterOptions?.types ?? []
  const sizes = filterOptions?.sizes ?? []
  const colors = filterOptions?.colors ?? []

  const toggleInArray = (key, value) => {
    setDraftFilters((p) => {
      const arr = Array.isArray(p[key]) ? p[key] : []
      const exists = arr.includes(value)
      return {
        ...p,
        [key]: exists ? arr.filter((x) => x !== value) : [...arr, value],
      }
    })
  }

  const setSingleDraft = (key, value) => {
    setDraftFilters((p) => ({ ...p, [key]: value }))
  }

  const clearArrayDraft = (key) => {
    setDraftFilters((p) => ({ ...p, [key]: [] }))
  }

  const mkMultiSummary = (arr) => {
    const n = arr?.length ?? 0
    if (!n) return ""
    if (n === 1) return arr[0]
    return `${arr[0]} +${n - 1}`
  }

  // Comptadors (applied)
  const counts = useMemo(() => {
    return {
      q: appliedFilters.q?.trim() ? 1 : 0,
      brands: (appliedFilters.brands?.length ?? 0),
      types: (appliedFilters.types?.length ?? 0),
      sizes: (appliedFilters.sizes?.length ?? 0),
      colors: (appliedFilters.colors?.length ?? 0),
      price:
        (String(appliedFilters.min_price).trim() !== "" ? 1 : 0) +
        (String(appliedFilters.max_price).trim() !== "" ? 1 : 0),
    }
  }, [appliedFilters])

  const priceSummary = useMemo(() => {
    const min = String(appliedFilters.min_price).trim()
    const max = String(appliedFilters.max_price).trim()
    if (!min && !max) return ""
    if (min && max) return `${min}–${max}€`
    if (min) return `≥ ${min}€`
    return `≤ ${max}€`
  }, [appliedFilters.min_price, appliedFilters.max_price])

  const brandsSummary = useMemo(() => mkMultiSummary(appliedFilters.brands), [appliedFilters.brands])
  const typesSummary = useMemo(() => mkMultiSummary(appliedFilters.types), [appliedFilters.types])
  const sizesSummary = useMemo(() => mkMultiSummary(appliedFilters.sizes), [appliedFilters.sizes])
  const colorsSummary = useMemo(() => mkMultiSummary(appliedFilters.colors), [appliedFilters.colors])

  const activeTypes = appliedFilters.types ?? []

  return (
    <div className="shrink-0 self-stretch transition-all duration-300 w-[280px] opacity-100 mr-10">
      <aside className="w-[280px] sticky top-20 flex flex-col border border-border rounded-lg bg-background">
        <div className="px-4">
          {/* Tipus reals a dalt (click ràpid) */}
          <div className="py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                {t("home.quickTypes.title")}
                {filtersLoading ? ` ${t("home.common.loadingSuffix")}` : ""}
              </p>

              {activeTypes.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedFilters((p) => ({ ...p, types: [], page: 1 }))
                    setDraftFilters((p) => ({ ...p, types: [] }))
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {t("home.common.clear")}
                </button>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setAppliedFilters((p) => ({ ...p, types: [], page: 1 }))
                  setDraftFilters((p) => ({ ...p, types: [] }))
                }}
                className={`block text-[15px] font-medium transition-colors ${
                  !activeTypes.length
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("home.quickTypes.all")}
              </button>

              {types.map((tType) => {
                const isActive = activeTypes.includes(tType)
                return (
                  <button
                    key={tType}
                    type="button"
                    onClick={() => {
                      setAppliedFilters((p) => {
                        const arr = p.types ?? []
                        const next = arr.includes(tType)
                          ? arr.filter((x) => x !== tType)
                          : [...arr, tType]
                        return { ...p, types: next, page: 1 }
                      })
                      setDraftFilters((p) => {
                        const arr = p.types ?? []
                        const next = arr.includes(tType)
                          ? arr.filter((x) => x !== tType)
                          : [...arr, tType]
                        return { ...p, types: next }
                      })
                    }}
                    className={`block text-[15px] font-medium transition-colors ${
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tType}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ✅ Tots tancats per defecte */}
          <CollapsibleSection
            title={t("home.filters.search")}
            count={counts.q}
            summary={appliedFilters.q?.trim() ? appliedFilters.q.trim() : ""}
            defaultOpen={false}
          >
            <input
              value={draftFilters.q}
              onChange={(e) => setSingleDraft("q", e.target.value)}
              placeholder={t("home.filters.searchPlaceholder")}
              className="w-full rounded-md border px-3 py-2 bg-background text-sm"
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={t("home.filters.brand")}
            count={counts.brands}
            summary={brandsSummary}
            defaultOpen={false}
          >
            {filtersLoading ? (
              <p className="text-sm text-muted-foreground">{t("home.filters.loadingBrands")}</p>
            ) : (
              <div className="space-y-1">
                <CheckboxOption
                  label={t("home.filters.allFeminine")}
                  checked={(draftFilters.brands?.length ?? 0) === 0}
                  onClick={() => clearArrayDraft("brands")}
                />
                {brands.map((b) => (
                  <CheckboxOption
                    key={b}
                    label={b}
                    checked={(draftFilters.brands ?? []).includes(b)}
                    onClick={() => toggleInArray("brands", b)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title={t("home.filters.type")}
            count={counts.types}
            summary={typesSummary}
            defaultOpen={false}
          >
            {filtersLoading ? (
              <p className="text-sm text-muted-foreground">{t("home.filters.loadingTypes")}</p>
            ) : (
              <div className="space-y-1">
                <CheckboxOption
                  label={t("home.filters.allMasculine")}
                  checked={(draftFilters.types?.length ?? 0) === 0}
                  onClick={() => clearArrayDraft("types")}
                />
                {types.map((tt) => (
                  <CheckboxOption
                    key={tt}
                    label={tt}
                    checked={(draftFilters.types ?? []).includes(tt)}
                    onClick={() => toggleInArray("types", tt)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title={t("home.filters.size")}
            count={counts.sizes}
            summary={sizesSummary}
            defaultOpen={false}
          >
            {filtersLoading ? (
              <p className="text-sm text-muted-foreground">{t("home.filters.loadingSizes")}</p>
            ) : (
              <div className="space-y-1">
                <CheckboxOption
                  label={t("home.filters.allFeminine")}
                  checked={(draftFilters.sizes?.length ?? 0) === 0}
                  onClick={() => clearArrayDraft("sizes")}
                />
                {sizes.map((s) => (
                  <CheckboxOption
                    key={s}
                    label={s}
                    checked={(draftFilters.sizes ?? []).includes(s)}
                    onClick={() => toggleInArray("sizes", s)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title={t("home.filters.color")}
            count={counts.colors}
            summary={colorsSummary}
            defaultOpen={false}
          >
            {filtersLoading ? (
              <p className="text-sm text-muted-foreground">{t("home.filters.loadingColors")}</p>
            ) : (
              <div className="space-y-1">
                <CheckboxOption
                  label={t("home.filters.allMasculine")}
                  checked={(draftFilters.colors?.length ?? 0) === 0}
                  onClick={() => clearArrayDraft("colors")}
                />
                {colors.map((c) => (
                  <CheckboxOption
                    key={c}
                    label={c}
                    checked={(draftFilters.colors ?? []).includes(c)}
                    onClick={() => toggleInArray("colors", c)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title={t("home.filters.price")}
            count={counts.price}
            summary={priceSummary}
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                value={draftFilters.min_price}
                onChange={(e) => setSingleDraft("min_price", e.target.value)}
                placeholder={t("home.filters.min")}
                className="w-full rounded-md border px-3 py-2 bg-background text-sm"
                inputMode="decimal"
              />
              <input
                value={draftFilters.max_price}
                onChange={(e) => setSingleDraft("max_price", e.target.value)}
                placeholder={t("home.filters.max")}
                className="w-full rounded-md border px-3 py-2 bg-background text-sm"
                inputMode="decimal"
              />
            </div>
          </CollapsibleSection>
        </div>

        {/* Botons sempre a sota */}
        <div className="mt-auto border-t border-border bg-background p-4">
          <button
            onClick={onApply}
            type="button"
            className="w-full inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t("home.actions.apply")}
          </button>

          <button
            onClick={onClearAll}
            type="button"
            className="mt-2 w-full inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {t("home.actions.clear")}
          </button>
        </div>
      </aside>
    </div>
  )
}

export default function HomePage() {
  const { t } = useTranslation()

  const [products, setProducts] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 12 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showFilters, setShowFilters] = useState(true)

  const [filterOptions, setFilterOptions] = useState({
    brands: [],
    sizes: [],
    colors: [],
    types: [],
  })
  const [filtersLoading, setFiltersLoading] = useState(false)

  const [draftFilters, setDraftFilters] = useState({
    q: "",
    brands: [],
    types: [],
    sizes: [],
    colors: [],
    min_price: "",
    max_price: "",
  })

  const [appliedFilters, setAppliedFilters] = useState({
    q: "",
    brands: [],
    types: [],
    sizes: [],
    colors: [],
    min_price: "",
    max_price: "",
    sort: "newest",
    page: 1,
    per_page: 12,
  })

  useEffect(() => {
    let cancelled = false

    const loadFilters = async () => {
      setFiltersLoading(true)
      try {
        const res = await api.get("/products/filters")
        if (cancelled) return
        setFilterOptions(res.data?.data ?? { brands: [], sizes: [], colors: [], types: [] })
      } catch (e) {
        if (cancelled) return
        console.warn("No s'han pogut carregar filtres:", e?.response?.data || e)
      } finally {
        if (!cancelled) setFiltersLoading(false)
      }
    }

    loadFilters()
    return () => { cancelled = true }
  }, [])

  const params = useMemo(() => {
    const p = {
      sort: appliedFilters.sort,
      page: appliedFilters.page,
      per_page: appliedFilters.per_page,
    }

    if (appliedFilters.q?.trim()) p.q = appliedFilters.q.trim()
    if ((appliedFilters.brands?.length ?? 0) > 0) p.brands = appliedFilters.brands.join(",")
    if ((appliedFilters.types?.length ?? 0) > 0) p.types = appliedFilters.types.join(",")
    if ((appliedFilters.sizes?.length ?? 0) > 0) p.sizes = appliedFilters.sizes.join(",")
    if ((appliedFilters.colors?.length ?? 0) > 0) p.colors = appliedFilters.colors.join(",")

    if (String(appliedFilters.min_price).trim() !== "") p.min_price = appliedFilters.min_price
    if (String(appliedFilters.max_price).trim() !== "") p.max_price = appliedFilters.max_price

    return p
  }, [appliedFilters])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await api.get("/products", { params })
        if (cancelled) return
        setProducts(res.data?.data ?? [])
        setMeta(
          res.data?.meta ?? {
            current_page: 1,
            last_page: 1,
            total: (res.data?.data ?? []).length,
            per_page: appliedFilters.per_page,
          }
        )
      } catch (err) {
        if (cancelled) return
        console.error("Error:", err)
        setError(err?.response?.data?.message || err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [params, appliedFilters.per_page])

  const applyFilters = () => {
    setAppliedFilters((p) => ({
      ...p,
      ...draftFilters,
      page: 1,
    }))
  }

  const clearAll = () => {
    const empty = {
      q: "",
      brands: [],
      types: [],
      sizes: [],
      colors: [],
      min_price: "",
      max_price: "",
    }
    setDraftFilters(empty)
    setAppliedFilters((p) => ({
      ...p,
      ...empty,
      page: 1,
      sort: "newest",
    }))
  }

  const chips = useMemo(() => {
    const out = []

    if (appliedFilters.q?.trim()) {
      out.push({
        key: `q:${appliedFilters.q}`,
        label: t("home.chips.search", { value: appliedFilters.q.trim() }),
        remove: () => setAppliedFilters((p) => ({ ...p, q: "", page: 1 })),
      })
    }

    for (const b of appliedFilters.brands ?? []) {
      out.push({
        key: `brand:${b}`,
        label: t("home.chips.brand", { value: b }),
        remove: () =>
          setAppliedFilters((p) => ({
            ...p,
            brands: (p.brands ?? []).filter((x) => x !== b),
            page: 1,
          })),
      })
    }

    for (const tt of appliedFilters.types ?? []) {
      out.push({
        key: `type:${tt}`,
        label: t("home.chips.type", { value: tt }),
        remove: () =>
          setAppliedFilters((p) => ({
            ...p,
            types: (p.types ?? []).filter((x) => x !== tt),
            page: 1,
          })),
      })
    }

    for (const s of appliedFilters.sizes ?? []) {
      out.push({
        key: `size:${s}`,
        label: t("home.chips.size", { value: s }),
        remove: () =>
          setAppliedFilters((p) => ({
            ...p,
            sizes: (p.sizes ?? []).filter((x) => x !== s),
            page: 1,
          })),
      })
    }

    for (const c of appliedFilters.colors ?? []) {
      out.push({
        key: `color:${c}`,
        label: t("home.chips.color", { value: c }),
        remove: () =>
          setAppliedFilters((p) => ({
            ...p,
            colors: (p.colors ?? []).filter((x) => x !== c),
            page: 1,
          })),
      })
    }

    const min = String(appliedFilters.min_price).trim()
    const max = String(appliedFilters.max_price).trim()
    if (min || max) {
      const label =
        min && max
          ? t("home.chips.priceBetween", { min, max })
          : min
          ? t("home.chips.priceMin", { min })
          : t("home.chips.priceMax", { max })

      out.push({
        key: `price:${min}:${max}`,
        label,
        remove: () =>
          setAppliedFilters((p) => ({
            ...p,
            min_price: "",
            max_price: "",
            page: 1,
          })),
      })
    }

    return out
  }, [appliedFilters, t])

  useEffect(() => {
    setDraftFilters((d) => ({
      ...d,
      q: appliedFilters.q,
      brands: appliedFilters.brands,
      types: appliedFilters.types,
      sizes: appliedFilters.sizes,
      colors: appliedFilters.colors,
      min_price: appliedFilters.min_price,
      max_price: appliedFilters.max_price,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appliedFilters.q,
    appliedFilters.brands,
    appliedFilters.types,
    appliedFilters.sizes,
    appliedFilters.colors,
    appliedFilters.min_price,
    appliedFilters.max_price,
  ])

  const totalAll = meta?.total ?? products.length
  const page = meta?.current_page ?? appliedFilters.page
  const lastPage = meta?.last_page ?? 1
  const perPage = meta?.per_page ?? appliedFilters.per_page

  const from = totalAll === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, totalAll)

  return (
    <>
      <Header />

      <main className="max-w-[1320px] mx-auto px-6 py-6">
        <div className="mb-1">
          <span className="text-sm text-muted-foreground">{t("home.breadcrumb.category")}</span>
          <span className="text-sm text-muted-foreground mx-1.5">/</span>
          <span className="text-sm font-medium text-foreground underline cursor-pointer">
            {t("home.breadcrumb.page")}
          </span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("home.title", { total: totalAll })}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalAll
                ? t("home.results.showing", { from, to, total: totalAll })
                : t("home.results.empty")}
              {loading ? ` · ${t("home.results.loading")}` : ""}
            </p>
            {error && <p className="text-sm text-destructive mt-1">{t("home.results.error", { message: error })}</p>}
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-[15px] text-foreground hover:text-muted-foreground transition-colors cursor-pointer"
              type="button"
            >
              {showFilters ? t("home.actions.hideFilters") : t("home.actions.showFilters")}
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[15px] text-foreground">{t("home.sort.label")}</span>
              <select
                className="rounded-md border px-2 py-1 bg-background text-sm"
                value={appliedFilters.sort}
                onChange={(e) =>
                  setAppliedFilters((p) => ({
                    ...p,
                    sort: e.target.value,
                    page: 1,
                  }))
                }
              >
                <option value="newest">{t("home.sort.newest")}</option>
                <option value="price_asc">{t("home.sort.priceAsc")}</option>
                <option value="price_desc">{t("home.sort.priceDesc")}</option>
                <option value="name_asc">{t("home.sort.nameAsc")}</option>
                <option value="name_desc">{t("home.sort.nameDesc")}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[15px] text-foreground">{t("home.perPage.label")}</span>
              <select
                className="rounded-md border px-2 py-1 bg-background text-sm"
                value={appliedFilters.per_page}
                onChange={(e) =>
                  setAppliedFilters((p) => ({
                    ...p,
                    per_page: Number(e.target.value),
                    page: 1,
                  }))
                }
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={36}>36</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex">
          <FilterSidebar
            visible={showFilters}
            draftFilters={draftFilters}
            setDraftFilters={setDraftFilters}
            appliedFilters={appliedFilters}
            setAppliedFilters={setAppliedFilters}
            onApply={applyFilters}
            onClearAll={clearAll}
            filterOptions={filterOptions}
            filtersLoading={filtersLoading}
            t={t}
          />

          <div className="flex-1 min-w-0">
            {/* Chips bar */}
            {chips.length > 0 ? (
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {chips.map((c) => (
                    <FilterChip key={c.key} label={c.label} onRemove={c.remove} />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm text-muted-foreground hover:text-foreground underline whitespace-nowrap"
                >
                  {t("home.actions.clearAll")}
                </button>
              </div>
            ) : null}

            {products.length === 0 && !loading ? (
              <div className="border rounded-lg p-6">
                <p className="text-muted-foreground">{t("home.results.noProducts")}</p>
              </div>
            ) : (
              <>
                <div
                  className={`grid gap-x-5 gap-y-10 ${
                    showFilters
                      ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  } ${loading ? "opacity-60 pointer-events-none" : ""}`}
                >
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                <Pagination
                  page={page}
                  lastPage={lastPage}
                  loading={loading}
                  onPage={(p) => setAppliedFilters((prev) => ({ ...prev, page: p }))}
                  t={t}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </>
  )
}