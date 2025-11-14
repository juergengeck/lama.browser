/**
 * HorizontalTreeView - Reusable horizontal tree component
 *
 * Used for chain of trust and audit trail visualizations.
 * Platform-agnostic, uses Tailwind CSS for styling.
 */

import React, { useState, useCallback } from 'react';

export interface TreeNode<T = any> {
  id: string;
  data: T;
  children?: TreeNode<T>[];
  collapsed?: boolean;
}

export interface HorizontalTreeViewProps<T = any> {
  nodes: TreeNode<T>[];
  renderNode: (node: TreeNode<T>, level: number) => React.ReactNode;
  onNodeClick?: (node: TreeNode<T>) => void;
  onToggleCollapse?: (nodeId: string, collapsed: boolean) => void;
  className?: string;
  nodeClassName?: string;
  collapsible?: boolean;
}

interface TreeNodeRendererProps<T> {
  node: TreeNode<T>;
  level: number;
  renderNode: (node: TreeNode<T>, level: number) => React.ReactNode;
  onNodeClick?: (node: TreeNode<T>) => void;
  onToggleCollapse?: (nodeId: string, collapsed: boolean) => void;
  nodeClassName?: string;
  collapsible?: boolean;
  isLastChild?: boolean;
  hasParent?: boolean;
}

function TreeNodeRenderer<T>({
  node,
  level,
  renderNode,
  onNodeClick,
  onToggleCollapse,
  nodeClassName,
  collapsible = true,
  isLastChild = false,
  hasParent = false,
}: TreeNodeRendererProps<T>) {
  const [isCollapsed, setIsCollapsed] = useState(node.collapsed ?? false);
  const hasChildren = node.children && node.children.length > 0;

  const handleToggle = useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onToggleCollapse?.(node.id, newCollapsed);
  }, [isCollapsed, node.id, onToggleCollapse]);

  const handleClick = useCallback(() => {
    onNodeClick?.(node);
  }, [node, onNodeClick]);

  return (
    <div className="flex items-start relative">
      {/* Connection line from parent */}
      {hasParent && (
        <div className="absolute left-0 top-1/2 w-8 h-px bg-gray-300 dark:bg-gray-600" style={{ marginLeft: '-2rem' }} />
      )}

      {/* Vertical line for children */}
      {hasChildren && !isCollapsed && (
        <div
          className="absolute left-full top-1/2 bottom-0 w-px bg-gray-300 dark:bg-gray-600"
          style={{
            marginLeft: '2rem',
            height: `calc(${node.children!.length * 100}% - 50%)`
          }}
        />
      )}

      <div className="flex flex-col items-center gap-2">
        <div
          className={`min-w-[200px] max-w-[300px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${nodeClassName || ''}`}
          onClick={handleClick}
        >
          <div className="p-4">
            <div className="flex items-start gap-2">
              {collapsible && hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle();
                  }}
                  className="h-6 w-6 p-0 flex-shrink-0 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {isCollapsed ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
              )}
              <div className="flex-1 min-w-0">
                {renderNode(node, level)}
              </div>
            </div>
          </div>
        </div>

        {/* Children container */}
        {hasChildren && !isCollapsed && (
          <div className="flex items-start gap-8 pl-8">
            {node.children!.map((child, index) => (
              <TreeNodeRenderer
                key={child.id}
                node={child}
                level={level + 1}
                renderNode={renderNode}
                onNodeClick={onNodeClick}
                onToggleCollapse={onToggleCollapse}
                nodeClassName={nodeClassName}
                collapsible={collapsible}
                isLastChild={index === node.children!.length - 1}
                hasParent={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function HorizontalTreeView<T = any>({
  nodes,
  renderNode,
  onNodeClick,
  onToggleCollapse,
  className,
  nodeClassName,
  collapsible = true,
}: HorizontalTreeViewProps<T>) {
  return (
    <div className={`w-full overflow-x-auto ${className || ''}`}>
      <div className="flex items-start gap-8 p-8 min-h-[400px]">
        {nodes.map((node, index) => (
          <TreeNodeRenderer
            key={node.id}
            node={node}
            level={0}
            renderNode={renderNode}
            onNodeClick={onNodeClick}
            onToggleCollapse={onToggleCollapse}
            nodeClassName={nodeClassName}
            collapsible={collapsible}
            isLastChild={index === nodes.length - 1}
            hasParent={false}
          />
        ))}
      </div>
    </div>
  );
}

export default HorizontalTreeView;
