import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PlusCircle } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { Idea, Project, Task } from '@/lib/types';

interface MindMapModuleProps {
  ideas: Idea[];
  tasks: Task[];
  projects: Project[];
  loading: boolean;
  fullScreen?: boolean;
  onCreateIdea?: () => void;
}

interface MindNode {
  id: string;
  title: string;
  label: string;
  x: number;
  y: number;
  color: string;
}

const centralNodeBase = {
  id: 'brain-core',
  title: 'BrainOS',
  label: 'Centro de insights',
  color: 'bg-slate-950/95 border-cyan-300/20 text-white',
};

const calculatePosition = (index: number, centerX: number, centerY: number, fullScreen: boolean) => {
  const ringIndex = Math.floor(index / 6);
  const positionInRing = index % 6;
  const radius = 180 + ringIndex * (fullScreen ? 120 : 90);
  const segment = (Math.PI * 2) / 6;
  const angle = segment * positionInRing - Math.PI / 2;

  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
};

export function MindMapModule({ ideas, loading, fullScreen = false, onCreateIdea }: MindMapModuleProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const center = fullScreen ? { x: 680, y: 320 } : { x: 430, y: 240 };

  const nodes = useMemo(
    () =>
      ideas.map((idea, index) => {
        const position = calculatePosition(index, center.x, center.y, fullScreen);
        return {
          id: idea.id,
          title: idea.title,
          label: idea.category,
          x: position.x,
          y: position.y,
          color: 'bg-cyan-400/10 border-cyan-400/20 text-cyan-100',
        };
      }),
    [ideas, center.x, center.y, fullScreen]
  );

  const lineAnchor = fullScreen ? { x: center.x + 100, y: center.y + 90 } : { x: center.x + 60, y: center.y + 60 };

  const svgLines = useMemo(
    () =>
      nodes.map((node) => ({
        id: `${centralNodeBase.id}-${node.id}`,
        x1: lineAnchor.x,
        y1: lineAnchor.y,
        x2: node.x + (fullScreen ? 120 : 70),
        y2: node.y + (fullScreen ? 90 : 40),
      })),
    [nodes, lineAnchor.x, lineAnchor.y, fullScreen]
  );

  const nodeStyle = (node: MindNode): CSSProperties => ({
    left: node.x,
    top: node.y,
  });

  const selectedNodeData = nodes.find((node) => node.id === selectedNode);

  const content = (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-[inset_0_0_120px_rgba(15,23,42,0.3)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08),transparent_35%),radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_35%)]" />

      {fullScreen && onCreateIdea && (
        <div className="absolute right-6 top-6 z-30">
          <button
            type="button"
            onClick={onCreateIdea}
            className="inline-flex items-center gap-2 rounded-3xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-glow transition hover:bg-cyan-300"
          >
            <PlusCircle className="h-5 w-5" />
            + Nova Ideia
          </button>
        </div>
      )}

      {selectedNodeData && (
        <div className="absolute left-6 top-6 z-30 w-64 rounded-3xl border border-white/10 bg-slate-950/90 p-4 text-sm text-slate-200 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-300/80">Nó selecionado</p>
          <p className="mt-2 font-semibold text-white">{selectedNodeData.title}</p>
          <p className="mt-1 text-xs text-slate-400">{selectedNodeData.label}</p>
          <p className="mt-3 text-xs text-slate-400">Clique em outro balão para trocar.</p>
        </div>
      )}

      {loading ? (
        <div className="flex h-full min-h-[520px] items-center justify-center rounded-[2rem] bg-slate-900/80 text-slate-500">Carregando mapa...</div>
      ) : (
        <>
          <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 1360 720" preserveAspectRatio="none">
            <defs>
              <marker id="mindmap-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,8 L8,4 Z" fill="rgba(56,189,248,0.75)" />
              </marker>
            </defs>
            {svgLines.map((line) => (
              <line
                key={line.id}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="rgba(56,189,248,0.45)"
                strokeWidth="2"
                markerEnd="url(#mindmap-arrow)"
                strokeLinecap="round"
              />
            ))}
          </svg>

          <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/20 bg-slate-950/95 px-8 py-6 text-center shadow-[0_60px_180px_-120px_rgba(56,189,248,0.9)]">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Núcleo</p>
            <p className="mt-2 text-lg font-semibold text-white">BrainOS</p>
            <p className="mt-1 text-xs text-slate-400">O ponto de partida de todas as conexões</p>
          </div>

          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNode(node.id)}
              className={`absolute z-20 min-h-[104px] w-[240px] rounded-[2rem] border border-white/10 bg-slate-900/95 p-5 text-left text-white shadow-[0_25px_80px_-30px_rgba(0,0,0,0.85)] transition duration-200 ${node.color} hover:-translate-y-1 hover:shadow-glow ${selectedNode === node.id ? 'ring-2 ring-cyan-300' : ''}`}
              style={nodeStyle(node)}
            >
              <span className="text-[0.70rem] uppercase tracking-[0.32em] text-slate-400">{node.label}</span>
              <span className="mt-4 block text-lg font-semibold leading-6 text-white whitespace-normal break-words">{node.title}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );

  return fullScreen ? content : (
    <ModuleCard title="Mapa mental" description="Crie ideias e veja os nós surgirem automaticamente no mural investigativo.">
      {content}
    </ModuleCard>
  );
}
