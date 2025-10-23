/**
 * Error Boundary Component
 *
 * Catches React errors and displays a fallback UI.
 * Provides error details and recovery options.
 */

import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })

    // Log to worker if available
    try {
      // TODO: Send error report to worker for logging
      console.error('[ErrorBoundary] Error details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    } catch (e) {
      console.error('[ErrorBoundary] Failed to log error:', e)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex h-screen items-center justify-center bg-background p-6">
          <div className="max-w-2xl w-full">
            <div className="bg-card border rounded-lg p-8 shadow-lg">
              {/* Icon and Title */}
              <div className="flex items-start space-x-4 mb-6">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
                  <p className="text-muted-foreground">
                    The application encountered an unexpected error. You can try resetting the component or reloading the page.
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {this.state.error && (
                <div className="mb-6 p-4 bg-muted rounded-md">
                  <h3 className="font-semibold mb-2 text-sm">Error Message:</h3>
                  <p className="text-sm font-mono text-red-600">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset Component
                </Button>
                <Button onClick={this.handleReload} variant="outline">
                  Reload Page
                </Button>
              </div>

              {/* Error Details (Collapsible) */}
              {this.state.error && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Show error details
                  </summary>
                  <div className="mt-3 p-4 bg-muted rounded-md max-h-60 overflow-auto">
                    <h4 className="font-semibold mb-2 text-xs">Stack Trace:</h4>
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                    {this.state.errorInfo?.componentStack && (
                      <>
                        <h4 className="font-semibold mb-2 mt-4 text-xs">Component Stack:</h4>
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Async Error Boundary Wrapper
 *
 * Wraps async operations and displays loading/error states
 */
interface AsyncBoundaryProps {
  children: ReactNode
  isLoading?: boolean
  error?: Error | null
  fallback?: ReactNode
  loadingFallback?: ReactNode
}

export function AsyncBoundary({
  children,
  isLoading,
  error,
  fallback,
  loadingFallback
}: AsyncBoundaryProps) {
  if (isLoading) {
    return loadingFallback || (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return fallback || (
      <div className="flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Content</h3>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
