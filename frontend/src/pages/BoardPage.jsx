import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useNavigate } from 'react-router-dom'
import { Search, X, ArrowUp, ArrowDown } from 'lucide-react'
import { api } from '../api/jobs.js'
import FitBadge from '../components/FitBadge.jsx'
import { cn } from '../lib/utils.js'

const STAGES = [
  'Watching', 'Shortlisted', 'Applied', 'Screen',
  'Interviewing', 'Offer', 'Rejected', 'Auto Rejected', 'Ghosted',
]

function formatDuration(iso) {
  if (!iso) return null
  const diffDays = Math.floor((Date.now() - new Date(iso)) / (1000 * 60 * 60 * 24))
  if (diffDays < 1) return 'less than a day'
  if (diffDays === 1) return '1 day'
  if (diffDays < 7) return `${diffDays} days`
  if (diffDays < 30) {
    const weeks = Math.round(diffDays / 7)
    return `${weeks} week${weeks !== 1 ? 's' : ''}`
  }
  const months = Math.round(diffDays / 30)
  return `${months} month${months !== 1 ? 's' : ''}`
}

function formatRelativeAge(iso) {
  if (!iso) return null
  const diffDays = Math.floor((Date.now() - new Date(iso)) / (1000 * 60 * 60 * 24))
  if (diffDays < 1) return 'Added today'
  if (diffDays === 1) return 'Added 1 day ago'
  if (diffDays < 7) return `Added ${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.round(diffDays / 7)
    return `Added ${weeks} week${weeks !== 1 ? 's' : ''} ago`
  }
  const months = Math.round(diffDays / 30)
  return `Added ${months} month${months !== 1 ? 's' : ''} ago`
}

const SEARCH_FIELDS = [
  'company', 'job_title', 'location', 'company_size', 'salary',
  'source', 'notes', 'product_description', 'why_it_fits', 'role_requirements', 'pipeline_stage',
]

const FIT_ORDER = { High: 0, Medium: 1, Low: 2, Unknown: 3 }

const SORT_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  { value: 'date', label: 'Date added' },
  { value: 'company', label: 'Company name' },
]

const SORT_COMPARATORS = {
  fit: (a, b) => (FIT_ORDER[a.fit_level] ?? 2) - (FIT_ORDER[b.fit_level] ?? 2),
  date: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
  company: (a, b) => (a.company || '').localeCompare(b.company || ''),
}

const SORT_DIR_LABELS = {
  fit: { asc: 'High to Low', desc: 'Low to High' },
  date: { asc: 'Oldest first', desc: 'Newest first' },
  company: { asc: 'A to Z', desc: 'Z to A' },
}

export default function BoardPage() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const navigate = useNavigate()

  useEffect(() => {
    api.listJobs()
      .then(setJobs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const query = search.trim().toLowerCase()
  const visibleJobs = query
    ? jobs.filter(j => SEARCH_FIELDS.some(f => j[f]?.toLowerCase().includes(query)))
    : jobs

  const comparator = SORT_COMPARATORS[sortField]
  const jobsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = visibleJobs
      .filter(j => j.pipeline_stage === stage)
      .sort((a, b) => sortDir === 'asc' ? comparator(a, b) : comparator(b, a))
    return acc
  }, {})

  async function onDragEnd(result) {
    const { source, destination, draggableId } = result
    if (!destination || source.droppableId === destination.droppableId) return
    const jobId = parseInt(draggableId)
    const newStage = destination.droppableId
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, pipeline_stage: newStage } : j))
    try {
      await api.updateJob(jobId, { pipeline_stage: newStage })
    } catch {
      api.listJobs().then(setJobs)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-destructive">Couldn't load your roles. {error}</div>

  return (
    <div className="flex flex-col overflow-x-auto h-[calc(100vh-56px)] p-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 w-72 focus-within:ring-1 focus-within:ring-ring">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search roles, companies, notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {query && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {visibleJobs.length} result{visibleJobs.length !== 1 ? 's' : ''}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <select
            value={sortField}
            onChange={e => setSortField(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={SORT_DIR_LABELS[sortField][sortDir]}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-input bg-card text-muted-foreground hover:text-foreground"
          >
            {sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 flex-1 min-w-max">
          {STAGES.map(stage => (
            <div key={stage} className="flex flex-col w-[220px] flex-shrink-0">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-semibold text-foreground">{stage}</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {jobsByStage[stage].length}
                </span>
              </div>
              <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 flex flex-col gap-2 p-2 rounded-lg min-h-[80px] transition-colors',
                      snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-muted/60'
                    )}
                  >
                    {jobsByStage[stage].map((job, index) => (
                      <Draggable key={job.id} draggableId={String(job.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => navigate(`/job/${job.id}`)}
                            className={cn(
                              'bg-card border border-border rounded-lg p-3 cursor-pointer transition-shadow',
                              snapshot.isDragging
                                ? 'shadow-lg rotate-1'
                                : 'shadow-sm hover:shadow-md hover:border-border/80'
                            )}
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {job.logo_url && (
                                <img
                                  src={job.logo_url}
                                  alt=""
                                  className="w-4 h-4 rounded object-contain flex-shrink-0"
                                  onError={e => { e.target.style.display = 'none' }}
                                />
                              )}
                              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                                {job.company}
                              </span>
                            </div>
                            <div className="text-[13px] font-medium text-foreground mb-2 leading-snug">
                              {job.job_title}
                            </div>
                            {job.notes && (
                              <div className="text-xs text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
                                {job.notes}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <div className="flex-shrink-0"><FitBadge level={job.fit_level} /></div>
                              {job.location && (
                                <span className="text-[11px] text-muted-foreground truncate min-w-0">{job.location}</span>
                              )}
                            </div>
                            {job.created_at && (
                              <div className="text-[10px] text-muted-foreground mt-1.5">
                                {formatRelativeAge(job.created_at)}
                              </div>
                            )}
                            {job.status_changed_at && job.status_changed_at !== job.created_at && (
                              <div className="text-[10px] text-muted-foreground">
                                In this column for {formatDuration(job.status_changed_at)}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}
