import React, { useMemo, useRef, useState } from 'react'
import { Activity, BarChart3, Check, CircleHelp, FileSpreadsheet, FileUp, Landmark, RefreshCw, ShieldCheck } from 'lucide-react'
import { BankDashboard } from './BankDashboard'
import { CompanyDashboard } from './CompanyDashboard'
import { makeBankChartSpecs, makeChartSpecs } from './Charts'
import { exportExcel, exportPdf } from './exportReports'
import { parseBankWorkbook, parseCompanyWorkbook } from './parseWorkbook'
import './styles.css'

export default function LedgerWrapper() {
  const [mode, setMode] = useState('nonbank')
  const [section, setSection] = useState('overview')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef(null)
  const companySpecs = useMemo(() => !data || data.mode === 'bank' ? null : makeChartSpecs(data.annual, data.quarterly), [data])
  const bankSpecs = useMemo(() => !data || data.mode !== 'bank' ? null : makeBankChartSpecs(data.annual, data.quarterly), [data])

  async function handleFileUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) { setError('Choose an .xlsx workbook.'); return }
    setBusy(true)
    setError('')
    try {
      const parsed = mode === 'bank' ? await parseBankWorkbook(file) : await parseCompanyWorkbook(file)
      setData(parsed)
      setSection('overview')
    } catch (cause) {
      setData(null)
      setError(cause instanceof Error ? cause.message : 'Could not read this workbook.')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setData(null)
    setError('')
    setSection('overview')
  }

  function handleExport(kind) {
    return async event => {
      if (!data) return
      try {
        if (kind === 'pdf') await exportPdf(data, event.currentTarget)
        else await exportExcel(data, event.currentTarget)
      } catch (cause) {
        setError(`Export failed: ${cause instanceof Error ? cause.message : String(cause)}`)
      }
    }
  }

  const sections = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'yearly', label: 'Plots', icon: BarChart3 },
    { key: 'tables', label: 'Data Sheet', icon: FileSpreadsheet },
    { key: 'checks', label: 'Data checks', icon: CircleHelp },
  ]

  return <div className={`app-shell ${data?.mode === 'bank' ? 'bank-theme' : data ? 'company-theme' : ''} ledger-dashboard-container`}>
    <header className="topbar">
      <a className="brand" href="#ledger-home" aria-label="Ledger home"><span className="brand-mark"><Activity size={18}/></span><span>ledger<span className="brand-dot">.</span></span></a>
      <div className="topbar-right">
        <span className="privacy-label"><ShieldCheck size={15}/> Files stay in this browser</span>
        {data && <>
          <button className="button button-soft" onClick={handleExport('pdf')}>PDF report</button>
          <button className="button button-primary" onClick={handleExport('excel')}><FileSpreadsheet size={16}/> Excel with charts</button>
          <button className="button button-soft" onClick={() => { setData(null); setError(''); setSection('overview') }}><RefreshCw size={15}/> New workbook</button>
        </>}
      </div>
    </header>
    <main id="ledger-home" className="main-wrap">
      {!data ? <section className="welcome-view">
        <div className="welcome-copy"><div className="hero-kicker">FINANCIAL STATEMENTS, MADE CLEAR</div><h1>See the story<br/>behind the <em>numbers.</em></h1><p className="hero-description">Choose an analysis mode and upload a Screener Data Sheet workbook to explore its financial trends and ratios.</p><div className="promise-row"><span><Check size={15}/> Workbook stays local</span><span><Check size={15}/> No Ledger account</span><span><Check size={15}/> Clear formulas</span></div></div>
        <div className="setup-card"><div className="step-label">START HERE</div><h2>Choose analysis mode</h2><p className="muted">The selected mode determines which metrics are calculated.</p>
          <div className="mode-options">
            <button className={`mode-option ${mode === 'nonbank' ? 'selected' : ''}`} onClick={() => changeMode('nonbank')}><span className="mode-icon"><BarChart3 size={18}/></span><span className="mode-copy"><strong>Non-bank company</strong><small>Manufacturers, IT, FMCG and other companies</small></span></button>
            <button className={`mode-option ${mode === 'bank' ? 'selected' : ''}`} onClick={() => changeMode('bank')}><span className="mode-icon bank"><Landmark size={18}/></span><span className="mode-copy"><strong>Bank</strong><small>Bank-specific calculations from available workbook data</small></span></button>
          </div>
          <div className="upload-zone manual-upload ${busy ? 'loading' : ''}"><input ref={fileInput} type="file" accept=".xlsx" hidden onChange={handleFileUpload}/><span className="upload-icon"><FileUp size={20}/></span><strong>{busy ? 'Processing workbook…' : 'Upload a Data Sheet workbook'}</strong><small>Choose an .xlsx file containing a <b>Data Sheet</b> worksheet</small><button className="button button-primary upload-button" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? 'Processing…' : 'Choose .xlsx file'}</button><span className="file-note">PROCESSED IN THIS BROWSER</span></div>
          {error && <div className="error-box">{error}</div>}
        </div>
      </section> : <>
        <section className="company-banner"><div className="company-title-wrap"><div className="company-icon">{data.companyName.slice(0, 1).toUpperCase()}</div><div><div className="hero-kicker">{data.mode === 'bank' ? 'BANK ANALYSIS' : 'NON-BANK ANALYSIS'}</div><h1>{data.companyName}</h1><p className="muted">Source: {data.sourceFileName}</p></div></div></section>
        <nav className="section-nav" aria-label="Analysis sections">{sections.map(({ key, label, icon: Icon }) => <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><Icon size={16}/>{label}</button>)}</nav>
        {data.mode === 'bank' ? <BankDashboard data={data} section={section} specs={bankSpecs}/> : <CompanyDashboard data={data} section={section} specs={companySpecs}/>}
        {error && <div className="error-box">{error}</div>}
        <footer className="app-footer"><span>LEDGER · PRIVATE BY DESIGN</span><span>Workbook is processed in browser memory only.</span></footer>
      </>}
    </main>
  </div>
}
