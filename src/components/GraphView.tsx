import React, { useRef, useEffect, useState } from 'react';
import { 
  Share2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Filter, 
  Info,
  Maximize2
} from 'lucide-react';
import { AppNote, AppProject, AppTask, AppObject, AppLink } from '../lib/types';

interface GraphViewProps {
  notes: AppNote[];
  projects: AppProject[];
  tasks: AppTask[];
  objects: AppObject[];
  links: AppLink[];
  onNavigateToEntity: (id: string, type: string) => void;
}

interface Node {
  id: string;
  title: string;
  type: 'note' | 'project' | 'task' | 'object';
  color: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Edge {
  source: string;
  target: string;
  label?: string;
}

export const GraphView: React.FC<GraphViewProps> = ({
  notes,
  projects,
  tasks,
  objects,
  links,
  onNavigateToEntity
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Filters
  const [showNotes, setShowNotes] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showObjects, setShowObjects] = useState(true);

  // Pan & Zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);

  // Internal Nodes and Edges state for physics
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  // Build graph data
  useEffect(() => {
    const rawNodes: Node[] = [];
    const width = 800;
    const height = 600;

    if (showProjects) {
      projects.forEach(p => {
        rawNodes.push({
          id: p.id,
          title: p.title,
          type: 'project',
          color: '#3b82f6',
          radius: 14,
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          vx: 0,
          vy: 0
        });
      });
    }

    if (showNotes) {
      notes.forEach(n => {
        rawNodes.push({
          id: n.id,
          title: n.title,
          type: 'note',
          color: '#a855f7',
          radius: 10,
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          vx: 0,
          vy: 0
        });
      });
    }

    if (showTasks) {
      tasks.forEach(t => {
        rawNodes.push({
          id: t.id,
          title: t.title,
          type: 'task',
          color: '#f59e0b',
          radius: 8,
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          vx: 0,
          vy: 0
        });
      });
    }

    if (showObjects) {
      objects.forEach(o => {
        rawNodes.push({
          id: o.id,
          title: o.title,
          type: 'object',
          color: '#10b981',
          radius: 9,
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          vx: 0,
          vy: 0
        });
      });
    }

    // Build edges from explicit links + relational links (notes->project, tasks->project, tasks->note)
    const rawEdges: Edge[] = [];
    const nodeIds = new Set(rawNodes.map(n => n.id));

    // Explicit links
    links.forEach(l => {
      const sourceId = l.from_id || l.source_id;
      let targetId = l.to_id || l.target_id;
      if (!targetId && l.target_title) {
        const found = rawNodes.find(n => n.title.toLowerCase() === l.target_title?.toLowerCase());
        if (found) targetId = found.id;
      }
      if (sourceId && nodeIds.has(sourceId) && targetId && nodeIds.has(targetId)) {
        rawEdges.push({ source: sourceId, target: targetId, label: l.relation_label || l.link_type });
      }
    });

    // Relational links
    notes.forEach(n => {
      if (n.project_id && nodeIds.has(n.id) && nodeIds.has(n.project_id)) {
        rawEdges.push({ source: n.id, target: n.project_id, label: 'project' });
      }
    });

    tasks.forEach(t => {
      if (t.project_id && nodeIds.has(t.id) && nodeIds.has(t.project_id)) {
        rawEdges.push({ source: t.id, target: t.project_id, label: 'project' });
      }
      if (t.note_id && nodeIds.has(t.id) && nodeIds.has(t.note_id)) {
        rawEdges.push({ source: t.id, target: t.note_id, label: 'note' });
      }
    });

    nodesRef.current = rawNodes;
    edgesRef.current = rawEdges;
  }, [notes, projects, tasks, objects, links, showNotes, showProjects, showTasks, showObjects]);

  // Simulation Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Physics constants
    const repulsion = 4000;
    const springLength = 120;
    const springK = 0.04;
    const damping = 0.85;
    const centerGravity = 0.02;

    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // 1. Repulsion between all nodes (Coulomb)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          if (dist < 400) {
            const force = repulsion / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }
      }

      // 2. Spring attraction along edges (Hooke)
      for (const edge of edges) {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const displacement = dist - springLength;
          const force = displacement * springK;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        }
      }

      // 3. Center Gravity & Position update
      for (const node of nodes) {
        if (draggedNode && node.id === draggedNode.id) continue;
        node.vx -= node.x * centerGravity;
        node.vy -= node.y * centerGravity;
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      }

      // 4. Render
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Draw Edges
      ctx.lineWidth = 1.2;
      for (const edge of edges) {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (source && target) {
          const isHighlighted = hoveredNode && (hoveredNode.id === source.id || hoveredNode.id === target.id);
          ctx.strokeStyle = isHighlighted ? 'rgba(168, 85, 247, 0.8)' : 'rgba(75, 85, 99, 0.35)';
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      }

      // Draw Nodes
      for (const node of nodes) {
        const isHovered = hoveredNode?.id === node.id;
        
        // Glow effect on hover
        if (isHovered) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = node.color;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? node.radius + 3 : node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Node Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = isHovered ? '#ffffff' : '#9ca3af';
        ctx.font = isHovered ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.title, node.x, node.y + node.radius + 12);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [transform, draggedNode, hoveredNode]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = canvasRef.current.parentElement?.clientWidth || 800;
        canvasRef.current.height = canvasRef.current.parentElement?.clientHeight || 600;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse Interaction Helpers
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - canvas.width / 2 - transform.x) / transform.scale;
    const worldY = (mouseY - canvas.height / 2 - transform.y) / transform.scale;
    return { x: worldX, y: worldY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const clickedNode = nodesRef.current.find(n => {
      const dist = Math.hypot(n.x - x, n.y - y);
      return dist <= n.radius + 4;
    });

    if (clickedNode) {
      setDraggedNode(clickedNode);
    } else {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    if (draggedNode) {
      draggedNode.x = x;
      draggedNode.y = y;
      draggedNode.vx = 0;
      draggedNode.vy = 0;
      return;
    }

    if (isDraggingCanvas) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
      return;
    }

    const hover = nodesRef.current.find(n => {
      const dist = Math.hypot(n.x - x, n.y - y);
      return dist <= n.radius + 4;
    });
    setHoveredNode(hover || null);
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsDraggingCanvas(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.2, Math.min(3, prev.scale * zoomFactor))
    }));
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const clicked = nodesRef.current.find(n => {
      const dist = Math.hypot(n.x - x, n.y - y);
      return dist <= n.radius + 4;
    });

    if (clicked) {
      onNavigateToEntity(clicked.id, clicked.type);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#111116] overflow-hidden select-none relative">
      {/* Top Floating Controls */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top,0px))] left-3 sm:left-6 right-3 sm:right-auto z-10 bg-[#191922]/90 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-[#2d2d3d] shadow-xl flex flex-wrap items-center gap-2 sm:gap-4 max-w-full">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span className="text-xs font-bold text-white tracking-wide">Grafo de Red</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#252536] text-gray-400 font-mono hidden xs:inline">
            {nodesRef.current.length} nodos • {edgesRef.current.length} vínculos
          </span>
        </div>

        {/* Node Filter Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-t xs:border-t-0 xs:border-l border-[#2e2e40] pt-1.5 xs:pt-0 xs:pl-3 sm:pl-4 text-xs overflow-x-auto no-scrollbar w-full xs:w-auto">
          <button
            onClick={() => setShowProjects(!showProjects)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition whitespace-nowrap ${
              showProjects ? 'bg-blue-950/60 text-blue-300 border border-blue-800/40' : 'text-gray-400 bg-transparent opacity-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Proyectos
          </button>

          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition whitespace-nowrap ${
              showNotes ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40' : 'text-gray-400 bg-transparent opacity-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Notas
          </button>

          <button
            onClick={() => setShowTasks(!showTasks)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition whitespace-nowrap ${
              showTasks ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40' : 'text-gray-400 bg-transparent opacity-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Tareas
          </button>

          <button
            onClick={() => setShowObjects(!showObjects)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition whitespace-nowrap ${
              showObjects ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'text-gray-400 bg-transparent opacity-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Objetos
          </button>
        </div>
      </div>

      {/* Zoom / Reset Controls */}
      <div className="absolute bottom-6 right-6 z-10 bg-[#191922]/90 backdrop-blur-md p-1.5 rounded-xl border border-[#2d2d3d] shadow-xl flex flex-col gap-1">
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))}
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#252535] transition"
          title="Acercar (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.2, prev.scale / 1.2) }))}
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#252535] transition"
          title="Alejar (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#252535] transition"
          title="Centrar Grafo"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleClick}
          className="w-full h-full block"
        />
      </div>

      {/* Hovered Node Tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-6 left-6 z-10 bg-[#1c1c28] border border-purple-500/40 p-3 rounded-lg shadow-2xl text-xs space-y-1">
          <div className="font-semibold text-white">{hoveredNode.title}</div>
          <div className="text-[10px] text-gray-400 uppercase font-mono">Tipo: {hoveredNode.type}</div>
          <div className="text-[10px] text-purple-300 font-medium">Haz clic para abrir</div>
        </div>
      )}
    </div>
  );
};
