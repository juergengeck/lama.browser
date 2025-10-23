/**
 * Session State Persistence
 *
 * Manages session state persistence using localStorage for browser platform.
 * Stores UI state like active tab, selected conversation, etc.
 */

interface SessionState {
  activeTab?: string
  selectedConversationId?: string
  lastLogin?: number
  preferences?: {
    theme?: 'light' | 'dark' | 'system'
    sidebarCollapsed?: boolean
  }
}

const SESSION_STORAGE_KEY = 'lama-session-state'

class SessionStorage {
  /**
   * Get session state from localStorage
   */
  getState(): SessionState | null {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY)
      if (!stored) return null

      return JSON.parse(stored) as SessionState
    } catch (error) {
      console.error('[SessionStorage] Failed to parse session state:', error)
      return null
    }
  }

  /**
   * Save session state to localStorage
   */
  setState(state: SessionState): void {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.error('[SessionStorage] Failed to save session state:', error)
    }
  }

  /**
   * Update partial session state
   */
  updateState(partialState: Partial<SessionState>): void {
    const currentState = this.getState() || {}
    this.setState({ ...currentState, ...partialState })
  }

  /**
   * Clear session state
   */
  clearState(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch (error) {
      console.error('[SessionStorage] Failed to clear session state:', error)
    }
  }

  /**
   * Get active tab
   */
  getActiveTab(): string | undefined {
    return this.getState()?.activeTab
  }

  /**
   * Set active tab
   */
  setActiveTab(tab: string): void {
    this.updateState({ activeTab: tab })
  }

  /**
   * Get selected conversation ID
   */
  getSelectedConversationId(): string | undefined {
    return this.getState()?.selectedConversationId
  }

  /**
   * Set selected conversation ID
   */
  setSelectedConversationId(id: string | undefined): void {
    this.updateState({ selectedConversationId: id })
  }

  /**
   * Record last login time
   */
  recordLogin(): void {
    this.updateState({ lastLogin: Date.now() })
  }

  /**
   * Get last login time
   */
  getLastLogin(): number | undefined {
    return this.getState()?.lastLogin
  }

  /**
   * Set theme preference
   */
  setTheme(theme: 'light' | 'dark' | 'system'): void {
    const currentState = this.getState() || {}
    const preferences = currentState.preferences || {}
    this.updateState({
      preferences: { ...preferences, theme }
    })
  }

  /**
   * Get theme preference
   */
  getTheme(): 'light' | 'dark' | 'system' | undefined {
    return this.getState()?.preferences?.theme
  }

  /**
   * Set sidebar collapsed state
   */
  setSidebarCollapsed(collapsed: boolean): void {
    const currentState = this.getState() || {}
    const preferences = currentState.preferences || {}
    this.updateState({
      preferences: { ...preferences, sidebarCollapsed: collapsed }
    })
  }

  /**
   * Get sidebar collapsed state
   */
  getSidebarCollapsed(): boolean | undefined {
    return this.getState()?.preferences?.sidebarCollapsed
  }

  /**
   * Restore state on app load
   */
  restoreState(): SessionState | null {
    const state = this.getState()

    if (state) {
      console.log('[SessionStorage] Restored session state:', {
        activeTab: state.activeTab,
        hasConversation: !!state.selectedConversationId,
        lastLogin: state.lastLogin ? new Date(state.lastLogin).toISOString() : null
      })
    }

    return state
  }
}

// Export singleton instance
export const sessionStorage = new SessionStorage()
