import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import BoardPage from './pages/BoardPage.jsx'
import JobDetailPage from './pages/JobDetailPage.jsx'
import AddJobPage from './pages/AddJobPage.jsx'
import { api } from './api/jobs.js'

function PasswordGate({ onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await api.login(input)
      onUnlock()
    } catch (err) {
      setError(err.message)
      setInput('')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-lg font-semibold">Job Search Pipeline</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-64">
        <input
          type="password"
          placeholder="Password"
          value={input}
          onChange={e => { setInput(e.target.value); setError('') }}
          autoFocus
          className={`flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${error ? 'border-destructive' : 'border-input'}`}
        />
        {error && <span className="text-xs text-destructive">{error}</span>}
        <button type="submit" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Enter
        </button>
      </form>
    </div>
  )
}

export default function App() {
  // null = still checking the stored token with the server
  const [unlocked, setUnlocked] = useState(null)

  useEffect(() => {
    api.checkAuth().then(setUnlocked)
  }, [])

  if (unlocked === null) return null
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 h-14 bg-card border-b border-border sticky top-0 z-50">
        <NavLink to="/" className="text-sm font-semibold text-foreground hover:no-underline">
          Job Search Pipeline
        </NavLink>
        <nav className="flex gap-1 items-center">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:no-underline ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`
            }
          >
            Board
          </NavLink>
          <NavLink
            to="/add"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:no-underline ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`
            }
          >
            + Add Role
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<BoardPage />} />
          <Route path="/add" element={<AddJobPage />} />
          <Route path="/job/:id" element={<JobDetailPage />} />
        </Routes>
      </main>
    </div>
  )
}
