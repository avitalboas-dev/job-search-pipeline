import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../api/jobs.js'
import FitBadge from '../components/FitBadge.jsx'
import { Button } from '../components/ui/button.jsx'
import { Input } from '../components/ui/input.jsx'
import { Textarea } from '../components/ui/textarea.jsx'
import { Label } from '../components/ui/label.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { Badge } from '../components/ui/badge.jsx'

const STAGES = ['Watching','Shortlisted','Applied','Screen','Interviewing','Offer','Rejected','Auto Rejected','Ghosted']
const FIT_LEVELS = ['High', 'Medium', 'Low', 'Unknown']

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    api.getJob(id)
      .then(j => { setJob(j); setForm(j) })
      .catch(e => setLoadError(e.message))
  }, [id])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    setSaving(true)
    setActionError(null)
    try {
      const updated = await api.updateJob(id, form)
      setJob(updated)
      setEditing(false)
    } catch(e) {
      setActionError(`Couldn't save your changes. ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${job.company} - ${job.job_title}"? This cannot be undone.`)) return
    setDeleting(true)
    setActionError(null)
    try {
      await api.deleteJob(id)
      navigate('/')
    } catch(e) {
      setActionError(`Couldn't delete this role. ${e.message}`)
      setDeleting(false)
    }
  }

  if (loadError) return <div className="flex items-center justify-center h-full text-destructive">Couldn't load this role. {loadError}</div>
  if (!job) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="w-3 h-3" /> Board
          </button>
          <h1 className="text-xl font-semibold">{job.company} — {job.job_title}</h1>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm(job) }}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {actionError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{actionError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Pipeline stage</Label>
              {editing ? (
                <select name="pipeline_stage" value={form.pipeline_stage} onChange={handleChange} className={selectClass}>
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <div><Badge variant="secondary">{job.pipeline_stage}</Badge></div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Fit level</Label>
              {editing ? (
                <select name="fit_level" value={form.fit_level} onChange={handleChange} className={selectClass}>
                  {FIT_LEVELS.map(f => <option key={f}>{f}</option>)}
                </select>
              ) : (
                <div><FitBadge level={job.fit_level} /></div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Why it fits</Label>
              {editing ? (
                <Textarea name="why_it_fits" value={form.why_it_fits || ''} onChange={handleChange} rows={4} />
              ) : (
                <p className="text-sm text-foreground">{job.why_it_fits || <em className="text-muted-foreground">—</em>}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Company', name: 'company' },
              { label: 'Job title', name: 'job_title' },
              { label: 'Location', name: 'location' },
              { label: 'Company size', name: 'company_size' },
              { label: 'Salary', name: 'salary' },
              { label: 'Source', name: 'source' },
            ].map(({ label, name }) => (
              <div key={name} className="space-y-1.5">
                <Label>{label}</Label>
                {editing ? (
                  <Input name={name} value={form[name] || ''} onChange={handleChange} />
                ) : (
                  <p className="text-sm">{job[name] || <em className="text-muted-foreground">—</em>}</p>
                )}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Careers page</Label>
              {editing ? (
                <Input name="careers_page_url" value={form.careers_page_url || ''} onChange={handleChange} />
              ) : job.careers_page_url ? (
                <a href={job.careers_page_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  Open ↗
                </a>
              ) : <em className="text-sm text-muted-foreground">—</em>}
            </div>
          </CardContent>
        </Card>

        {/* Role details */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Role details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Product / company description', name: 'product_description', rows: 3 },
              { label: 'Role requirements', name: 'role_requirements', rows: 5 },
              { label: 'Notes', name: 'notes', rows: 4 },
            ].map(({ label, name, rows }) => (
              <div key={name} className="space-y-1.5">
                <Label>{label}</Label>
                {editing ? (
                  <Textarea name={name} value={form[name] || ''} onChange={handleChange} rows={rows} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{job[name] || <em className="text-muted-foreground">—</em>}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
