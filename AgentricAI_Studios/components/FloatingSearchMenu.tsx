
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { DynamicNodeConfig, Point } from '../src/core/types';

interface FloatingSearchMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: Point; // Viewport coordinates for positioning the menu
  agents: DynamicNodeConfig[];
  onSelectAgent: (agentConfig: DynamicNodeConfig, clickViewportPosition: Point) => void;
  initialClickViewportPosition: Point; // Viewport coordinates of the double-click
}

const FloatingSearchMenu: React.FC<FloatingSearchMenuProps> = ({
  isOpen,
  onClose,
  position,
  agents,
  onSelectAgent,
  initialClickViewportPosition,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFullIndexView, setShowFullIndexView] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(''); 
      setShowFullIndexView(false); // Reset index view when opened
      setTimeout(() => inputRef.current?.focus(), 0); 
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  const handleToggleIndexView = () => {
    const newIndexState = !showFullIndexView;
    setShowFullIndexView(newIndexState);
    if (newIndexState) {
      setSearchTerm(''); // Clear search when showing index
    }
    // Keep focus on input for quick revert to search or further interaction
    inputRef.current?.focus(); 
  };

  const displayedAgents = useMemo(() => {
    if (showFullIndexView) {
      return agents.slice(0, 10); // Show first 10 for index view
    }
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      return agents.slice(0, 4); // Show first 4 if no search term
    }
    return agents
      .filter(
        (agent) =>
          agent.name.toLowerCase().includes(term) ||
          (agent.category && agent.category.toLowerCase().includes(term)) ||
          (agent.description && agent.description.toLowerCase().includes(term))
      )
      .slice(0, 4); // Show up to 4 filtered results
  }, [agents, searchTerm, showFullIndexView]);

  if (!isOpen) {
    return null;
  }

  // Adjust position if menu would go off-screen
  const menuWidth = 300; 
  const menuHeight = 250; 
  let top = position.y;
  let left = position.x;

  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10; 
  }
  if (top + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 10;
  }
  if (left < 0) left = 10;
  if (top < 0) top = 10;


  return (
    <div
      ref={menuRef}
      className="fixed bg-black border-4 border-dotted border-neutral-800 rounded-lg shadow-2xl z-50 p-3"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: `${menuWidth}px`,
        maxHeight: `${menuHeight}px`,
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => e.stopPropagation()} 
    >
      <div className="flex items-center mb-2 space-x-2">
        <input
          ref={inputRef}
          type="search"
          placeholder="Search nodes/agents..."
          className="flex-grow p-2 bg-neutral-800 border border-neutral-700 rounded-md text-gray-200 focus:ring-sky-500 focus:border-sky-500 text-sm placeholder-gray-500"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (showFullIndexView && e.target.value.trim() !== '') {
              setShowFullIndexView(false); // Revert to search if user types
            }
          }}
        />
        <button
            onClick={handleToggleIndexView}
            className="p-1.5 text-gray-400 hover:text-sky-400 focus:outline-none rounded-full hover:bg-neutral-700 transition-colors"
            aria-label="Toggle index view"
            title={showFullIndexView ? "Show Search Results" : "Show All Agents (Index)"}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-red-500 focus:outline-none rounded-full hover:bg-neutral-700 transition-colors"
          aria-label="Close search menu"
          title="Close search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="overflow-y-auto flex-grow">
        {displayedAgents.length > 0 ? (
          displayedAgents.map((agent) => (
            <div
              key={agent.name}
              onClick={() => {
                onSelectAgent(agent, initialClickViewportPosition);
              }}
              className="p-2 mb-1.5 rounded-md hover:bg-neutral-800 cursor-pointer transition-colors border border-transparent hover:border-sky-600"
              title={agent.description}
            >
              <div className="flex items-center">
                <span className="mr-2 text-lg" style={{ minWidth: '20px', textAlign: 'center' }}>
                  {agent.icon || '⚙️'}
                </span>
                <span className="font-medium text-sm text-gray-100">{agent.name}</span>
              </div>
              {agent.category && <p className="text-xs text-sky-400 mt-0.5 ml-1">{agent.category}</p>}
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm text-center p-2">
            {showFullIndexView ? "No agents available." : "No matching agents found."}
          </p>
        )}
      </div>
    </div>
  );
};

export default FloatingSearchMenu;
