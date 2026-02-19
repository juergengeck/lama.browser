import { useState } from 'react'
import { Button } from '@refinio/lama.ui'
import { Input } from '@refinio/lama.ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@refinio/lama.ui'
import { Alert, AlertDescription } from '@refinio/lama.ui'
import { Loader2, UserPlus, LogIn } from 'lucide-react'

interface LoginScreenProps {
  onLogin: (userId: string, password: string) => Promise<void>
  onRegister: (name: string, password: string) => Promise<void>
}

export function LoginScreen({ onLogin, onRegister }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState(() => {
    const mode = localStorage.getItem('lama:loginPrefillMode') ?? 'demo'
    if (mode === 'demo') return 'demo'
    if (mode === 'lastUsed') return localStorage.getItem('lama:lastUsedUsername') ?? ''
    return ''
  })
  const [password, setPassword] = useState(() => {
    const mode = localStorage.getItem('lama:loginPrefillMode') ?? 'demo'
    if (mode === 'demo') return 'demo'
    return ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        await onLogin(name, password)
      } else {
        await onRegister(name, password)
      }
      // Save last used username
      localStorage.setItem('lama:lastUsedUsername', name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <img
              src="/assets/icons/lamaFilled.svg"
              alt="LAMA Logo"
              className="h-24 w-24 dark:invert"
            />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            LAMA Desktop
          </CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Welcome back! Please login to continue.' : 'Create a new account to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                {mode === 'login' ? 'Identity' : 'Identity Name'}
              </label>
              <input
                id="name"
                type="text"
                name="username"
                autoComplete="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === 'login' ? 'Your identity (public key or name)' : 'Choose an identity name'}
                required
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Using cryptographic identities (moving to public keys)
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !name || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === 'login' ? 'Logging in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {mode === 'login' ? (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Login
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Register
                    </>
                  )}
                </>
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login')
                  setError(null)
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                disabled={loading}
              >
                {mode === 'login'
                  ? "Don't have an account? Register"
                  : 'Already have an account? Login'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
            <p>🔒 End-to-end encrypted</p>
            <p>🌐 P2P messaging</p>
            <p>🤖 Local AI processing</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}