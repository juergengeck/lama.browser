// Re-export module system from @refinio/api
export { ModuleRegistry } from '@refinio/api';
export type { Module, ModuleMetadata } from '@refinio/api';

// Export local modules
export { CoreModule } from './CoreModule';
export { AIModule } from './AIModule';
export { ChatModule } from './ChatModule';
export { ConnectionModule } from './ConnectionModule';
export { TrustModule } from './TrustModule';
