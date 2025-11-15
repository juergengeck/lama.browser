/**
 * Story Recipe - Assembly tracking for browser platform
 *
 * Defines the Story object type used by StoryFactory/AssemblyPlan to track
 * execution of business logic (plans/assemblies).
 */

import type {Recipe} from '@refinio/one.core/lib/recipes.js';

export const StoryRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'Story',
    rule: [
        // ID property - makes this a versioned object
        {
            itemprop: 'id',
            isId: true,
            itemtype: {type: 'string'}
        },
        // Timestamp when story was created
        {
            itemprop: 'created',
            itemtype: {type: 'integer'}
        },
        // Human-readable description of what was executed
        {
            itemprop: 'description',
            itemtype: {type: 'string'}
        },
        // Domain/category for grouping (e.g., "conversation", "ai", "sync")
        {
            itemprop: 'domain',
            itemtype: {type: 'string'}
        },
        // Execution duration in milliseconds
        {
            itemprop: 'duration',
            itemtype: {type: 'integer'}
        },
        // Instance version identifier
        {
            itemprop: 'instanceVersion',
            itemtype: {type: 'string'}
        },
        // Match score for assembly matching (0.0 to 1.0)
        {
            itemprop: 'matchScore',
            itemtype: {type: 'number'}
        },
        // Metadata key-value pairs (Map serializes as array of tuples)
        {
            itemprop: 'metadata',
            itemtype: {
                type: 'map',
                key: {type: 'string'},
                value: {type: 'string'}
            }
        },
        // Outcome description (error message or success details)
        {
            itemprop: 'outcome',
            itemtype: {type: 'string'},
            optional: true
        },
        // Owner person ID (who executed this story)
        {
            itemprop: 'owner',
            itemtype: {type: 'string'}
        },
        // Plan/assembly name that was executed
        {
            itemprop: 'plan',
            itemtype: {type: 'string'}
        },
        // Product/result of execution (optional, can be any type)
        {
            itemprop: 'product',
            itemtype: {type: 'stringifiable'},
            optional: true
        },
        // Success flag (true/false)
        {
            itemprop: 'success',
            itemtype: {type: 'boolean'}
        },
        // Human-readable title
        {
            itemprop: 'title',
            itemtype: {type: 'string'}
        }
    ]
};

// Extend ONE's type system to recognize Story
declare module '@OneObjectInterfaces' {
    export interface OneVersionedObjectInterfaces {
        Story: Story;
    }
}

// TypeScript interface matching the recipe
export interface Story {
    $type$: 'Story';
    id: string;                           // Unique story ID (isId: true)
    created: number;                      // Timestamp
    description: string;                  // Human-readable description
    domain: string;                       // Domain/category
    duration: number;                     // Execution time in ms
    instanceVersion: string;              // Instance version ID
    matchScore: number;                   // Match score (0.0-1.0)
    metadata: Map<string, string>;        // Key-value metadata pairs
    outcome: string | null;               // Outcome description
    owner: string;                        // Owner person ID
    plan: string;                         // Plan/assembly name
    product: any | null;                  // Result/product
    success: boolean;                     // Success flag
    title: string;                        // Human-readable title
}
