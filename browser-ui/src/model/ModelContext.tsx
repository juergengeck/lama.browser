/**
 * React Context for LAMA Model
 *
 * Provides easy access to the Model instance from React components.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type Model from './Model.js';

// Create context with null as default (will be set by provider)
const ModelContext = createContext<Model | null>(null);

interface ModelProviderProps {
  model: Model;
  children: ReactNode;
}

/**
 * Provider component that makes Model available to all child components
 */
export function ModelProvider({ model, children }: ModelProviderProps) {
  return (
    <ModelContext.Provider value={model}>
      {children}
    </ModelContext.Provider>
  );
}

/**
 * Hook to access Model from any component
 *
 * @throws Error if used outside ModelProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const model = useModel();
 *   const contacts = await model.contactsHandler.getContacts();
 *   return <div>...</div>;
 * }
 * ```
 */
export function useModel(): Model {
  const model = useContext(ModelContext);

  if (!model) {
    throw new Error('useModel must be used within ModelProvider');
  }

  return model;
}

/**
 * Hook to access a specific handler from Model
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const chatHandler = useHandler('chatHandler');
 *   const messages = await chatHandler.getMessages(topicId);
 *   return <div>...</div>;
 * }
 * ```
 */
export function useHandler<K extends keyof Model>(handlerName: K): Model[K] {
  const model = useModel();
  return model[handlerName];
}

/**
 * Hook to access ONE.core models directly
 *
 * @example
 * ```tsx
 * function ContactsList() {
 *   const leuteModel = useOneModel('leuteModel');
 *   // Direct access to LeuteModel
 *   return <div>...</div>;
 * }
 * ```
 */
export function useOneModel<K extends 'leuteModel' | 'channelManager' | 'topicModel' | 'connections' | 'one'>(
  modelName: K
): Model[K] {
  const model = useModel();
  return model[modelName];
}
