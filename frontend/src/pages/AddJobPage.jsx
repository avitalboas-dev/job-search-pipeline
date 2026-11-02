import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/jobs.js'
import { Button } from '../components/ui/button.jsx'
import { Input } from '../components/ui/input.jsx'
import { Textarea } from '../components/ui/textarea.jsx'
import { Label } from '../components/ui/label.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { cn } from '../lib/utils.js'

const STAGES = ['Watching','Shortlisted','Applied','Screen','Interviewing','Offer','Rejected','Auto Rejected','Ghosted']
const FIT_LEVELS = ['High', 'Medium', 'Low', 'Unknown']

const EMPTY_FORM = {
  company: '', job_title: '', location: '', company_size: '', salary: '',
  role_requirements: '', product_description: '', pipeline_stage: 'Shortlisted',
  fit_level: 'Unknown', why_it_fits: '', careers_page_url: '', source: '', notes: '',
  logo_url: '',
}

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AddJobPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [docFile, setDocFile] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formVisible, setFormVisible] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function applyExtraction(data, extra = {}) {
    setForm(prev => ({
      ...prev,
      company: data.company || '',
      job_title: data.job_title || '',
      location: data.location || '',
      company_size: data.company_size || '',
      salary: data.salary || '',
      role_requirements: data.role_requirements || '',
      product_description: data.product_description || '',
      fit_level: data.fit_level || 'Unknown',
      why_it_fits: data.why_it_fits || '',
      logo_url: data.logo_url || '',
      ...extra,
    }))
    setFormVisible(true)
  }

  async function handleExtract(e) {
    e.preventDefault()
    if (!url.trim()) return
    setExtracting(true)
    setExtractError(null)
    try {
      const data = await api.extractJob(url.trim())
      if (data.raw_error) {
        setExtractError(data.raw_error)
      } else {
        applyExtraction(data, { careers_page_url: data.careers_page_url || url.trim() })
      }
    } catch(e) {
      setExtractError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  async function handleExtractFile(e) {
    e.preventDefault()
    if (!docFile) return
    setExtracting(true)
    setExtractError(null)
    try {
      const data = await api.extractJobDocument(docFile)
      if (data.raw_error) {
        setExtractError(data.raw_error)
      } else {
        const ext = docFile.name.split('.').pop().toUpperCase()
        applyExtraction(data, { source: ext })
      }
    } catch(e) {
      setExtractError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.company || !form.job_title) return
    setSaving(true)
    try {
      const job = await api.createJob(form)
      navigate(`/job/${job.id}`)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="flex justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Add a role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {['url', 'file', 'manual'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setFormVisible(m === 'manual'); setForm(EMPTY_FORM); setDocFile(null); setExtractError(null) }}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  mode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m === 'url' ? 'From URL' : m === 'file' ? 'From File' : 'Manual'}
              </button>
            ))}
          </div>

          {/* URL mode */}
          {mode === 'url' && (
            <form onSubmit={handleExtract} className="flex gap-2">
              <Input
                type="url"
                placeholder="Paste a job posting URL…"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={extracting}>
                {extracting ? 'Extracting…' : 'Extract with AI'}
              </Button>
            </form>
          )}

          {/* File mode */}
          {mode === 'file' && (
            <form onSubmit={handleExtractFile} className="flex gap-2">
              <Input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => setDocFile(e.target.files?.[0] || null)}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={extracting || !docFile}>
                {extracting ? 'Extracting…' : 'Extract with AI'}
              </Button>
            </form>
          )}

          {/* Extract error */}
          {extractError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 flex items-center justify-between">
              <span>Could not extract: {extractError}</span>
              <button
                className="text-sm font-medium underline ml-2"
                onClick={() => { setFormVisible(true); setExtractError(null) }}
              >
                Fill manually →
              </button>
            </div>
          )}

          {/* Job form */}
          {(formVisible || mode === 'manual') && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Company *</Label>
                  <Input name="company" value={form.company} onChange={handleChange} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Job title *</Label>
                  <Input name="job_title" value={form.job_title} onChange={handleChange} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input name="location" value={form.location} onChange={handleChange} />
                </div>
                <div className="space-y-1.5">
                  <Label>Company size</Label>
                  <Input name="company_size" value={form.company_size} onChange={handleChange} />
                </div>
                <div className="space-y-1.5">
                  <Label>Salary</Label>
                  <Input name="salary" value={form.salary} onChange={handleChange} />
                </div>
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Input name="source" value={form.source} onChange={handleChange} placeholder="LinkedIn, referral…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Pipeline stage</Label>
                  <select name="pipeline_stage" value={form.pipeline_stage} onChange={handleChange} className={selectClass}>
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fit level</Label>
                  <select name="fit_level" value={form.fit_level} onChange={handleChange} className={selectClass}>
                    {FIT_LEVELS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Careers page URL</Label>
                  <Input name="careers_page_url" value={form.careers_page_url} onChange={handleChange} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Product / company description</Label>
                  <Textarea name="product_description" value={form.product_description} onChange={handleChange} rows={2} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Why it fits</Label>
                  <Textarea name="why_it_fits" value={form.why_it_fits} onChange={handleChange} rows={3} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Role requirements</Label>
                  <Textarea name="role_requirements" value={form.role_requirements} onChange={handleChange} rows={4} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea name="notes" value={form.notes} onChange={handleChange} rows={3} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/')}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save role'}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
