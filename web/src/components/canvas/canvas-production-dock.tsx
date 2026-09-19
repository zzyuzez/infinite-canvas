import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, ChevronDown, ChevronUp, Clapperboard, Globe2, Image as ImageIcon, Pause, Play, Plus, SkipBack, Sparkles, Users } from "lucide-react";
import { nanoid } from "nanoid";

import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import type { CanvasProduction, ProductionReference, ProductionShot } from "@/types/production";
import type { CanvasTheme } from "@/lib/canvas-theme";

type ProductionView = "timeline" | "research" | "worlds" | "characters" | "scenes";
type ReferenceKey = Exclude<ProductionView, "timeline">;

export function CanvasProductionDock({
    nodes,
    selectedNodeIds,
    production,
    theme,
    onChange,
    onFocusNode,
}: {
    nodes: CanvasNodeData[];
    selectedNodeIds: Set<string>;
    production: CanvasProduction;
    theme: CanvasTheme;
    onChange: (production: CanvasProduction) => void;
    onFocusNode: (nodeId: string) => void;
}) {
    const [open, setOpen] = useState(true);
    const [view, setView] = useState<ProductionView>("timeline");
    const [playing, setPlaying] = useState(false);
    const [playheadMs, setPlayheadMs] = useState(0);
    const selectedNodes = useMemo(() => nodes.filter((node) => selectedNodeIds.has(node.id)), [nodes, selectedNodeIds]);
    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    const totalDuration = Math.max(1, production.shots.reduce((sum, shot) => sum + shot.durationMs, 0));

    useEffect(() => {
        if (!playing || !production.shots.length) return;
        const timer = window.setInterval(() => setPlayheadMs((value) => (value + 100 >= totalDuration ? 0 : value + 100)), 100);
        return () => window.clearInterval(timer);
    }, [playing, production.shots.length, totalDuration]);

    const addShots = () => {
        const existing = new Set(production.shots.map((item) => item.nodeId));
        const additions = selectedNodes
            .filter((node) => node.type === CanvasNodeType.Video && !existing.has(node.id))
            .map<ProductionShot>((node, index) => ({
                id: nanoid(),
                title: node.title,
                nodeId: node.id,
                description: node.metadata?.prompt || "",
                createdAt: new Date().toISOString(),
                order: production.shots.length + index,
                durationMs: node.metadata?.durationMs || Number(node.metadata?.seconds || 5) * 1000,
                track: "video",
                transition: "cut",
            }));
        if (additions.length) onChange({ ...production, shots: [...production.shots, ...additions], activeShotId: additions[0].id });
    };

    const addReferences = (key: ReferenceKey) => {
        const existing = new Set((production[key] || []).map((item) => item.nodeId));
        const additions = selectedNodes.filter((node) => !existing.has(node.id)).map<ProductionReference>((node) => ({ id: nanoid(), title: node.title, nodeId: node.id, description: node.metadata?.prompt || node.metadata?.content || "", createdAt: new Date().toISOString() }));
        if (additions.length) onChange({ ...production, [key]: [...(production[key] || []), ...additions] });
    };

    const selectShot = (shot: ProductionShot) => {
        setPlayheadMs(production.shots.slice(0, shot.order).reduce((sum, item) => sum + item.durationMs, 0));
        onChange({ ...production, activeShotId: shot.id });
        onFocusNode(shot.nodeId);
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 z-[85] border-t backdrop-blur-xl" style={{ height: open ? 214 : 38, borderColor: theme.toolbar.border, background: theme.toolbar.panel }}>
            <header className="flex h-[38px] items-center justify-between px-3">
                <nav className="flex h-full items-center gap-1" aria-label="制片工作区">
                    <Tab active={view === "timeline"} theme={theme} icon={<Clapperboard className="size-3.5" />} label="时间线" count={production.shots.length} onClick={() => (setView("timeline"), setOpen(true))} />
                    <Tab active={view === "research"} theme={theme} icon={<BookOpen className="size-3.5" />} label="研究" count={production.research?.length || 0} onClick={() => (setView("research"), setOpen(true))} />
                    <Tab active={view === "worlds"} theme={theme} icon={<Globe2 className="size-3.5" />} label="世界" count={production.worlds?.length || 0} onClick={() => (setView("worlds"), setOpen(true))} />
                    <Tab active={view === "characters"} theme={theme} icon={<Users className="size-3.5" />} label="角色" count={production.characters.length} onClick={() => (setView("characters"), setOpen(true))} />
                    <Tab active={view === "scenes"} theme={theme} icon={<ImageIcon className="size-3.5" />} label="场景" count={production.scenes.length} onClick={() => (setView("scenes"), setOpen(true))} />
                </nav>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: theme.node.muted }}>
                    <span>{production.aspectRatio}</span>
                    <span>{production.fps} FPS</span>
                    <button type="button" className="grid size-7 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setOpen((value) => !value)} aria-label={open ? "收起制片面板" : "展开制片面板"}>
                        {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                    </button>
                </div>
            </header>

            {open && view === "timeline" ? (
                <div className="grid h-[176px] grid-cols-[132px_minmax(0,1fr)] border-t" style={{ borderColor: theme.toolbar.border }}>
                    <div className="flex flex-col justify-between border-r p-3" style={{ borderColor: theme.toolbar.border }}>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[.14em]" style={{ color: theme.node.faint }}>Sequence 01</p>
                            <p className="mt-1 truncate text-xs font-medium">主叙事线</p>
                        </div>
                        <button type="button" disabled={!selectedNodes.some((node) => node.type === CanvasNodeType.Video)} onClick={addShots} className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-white/10">
                            <Plus className="size-3.5" /> 将选中视频加入
                        </button>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                        <div className="flex h-9 items-center border-b px-3" style={{ borderColor: theme.toolbar.border }}>
                            <div className="flex items-center gap-1.5">
                                <button type="button" className="grid size-6 place-items-center rounded hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setPlayheadMs(0)}><SkipBack className="size-3.5" /></button>
                                <button type="button" className="grid size-6 place-items-center rounded-full" style={{ background: theme.node.text, color: theme.canvas.background }} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause className="size-3" /> : <Play className="ml-0.5 size-3" />}</button>
                                <time className="ml-1 text-[10px] tabular-nums" style={{ color: theme.node.muted }}>{formatTime(playheadMs)} / {formatTime(totalDuration)}</time>
                            </div>
                            <div className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: theme.node.faint }}><Sparkles className="size-3" /> 镜头改动会保留画布来源</div>
                        </div>
                        <div className="relative h-[137px] overflow-x-auto px-3 pb-2 pt-6">
                            <div className="pointer-events-none absolute left-3 right-3 top-0 flex justify-between text-[9px]" style={{ color: theme.node.faint }}><span>00:00</span><span>00:05</span><span>00:10</span><span>00:15</span><span>00:20</span></div>
                            <div className="relative flex h-[82px] min-w-[720px] items-stretch gap-1 border-y py-1" style={{ borderColor: theme.toolbar.border }}>
                                {production.shots.length ? production.shots.map((shot) => {
                                    const node = nodeById.get(shot.nodeId);
                                    const active = production.activeShotId === shot.id;
                                    return (
                                        <button key={shot.id} type="button" onClick={() => selectShot(shot)} className="group relative min-w-[116px] overflow-hidden rounded-md border text-left transition" style={{ width: Math.max(116, shot.durationMs / 36), borderColor: active ? theme.node.activeStroke : theme.node.stroke, background: theme.node.panel }}>
                                            <ShotPreview node={node} />
                                            <span className="absolute inset-x-0 bottom-0 flex h-6 items-center justify-between bg-black/65 px-2 text-[10px] text-white"><b className="max-w-[80%] truncate font-medium">{String(shot.order + 1).padStart(2, "0")} · {shot.title}</b><i className="font-normal opacity-70">{Math.round(shot.durationMs / 100) / 10}s</i></span>
                                        </button>
                                    );
                                }) : (
                                    <div className="flex flex-1 items-center justify-center text-xs" style={{ color: theme.node.faint }}>选择画布中的视频节点，把第一个镜头放进时间线</div>
                                )}
                                <span className="pointer-events-none absolute bottom-0 top-0 w-px bg-red-500" style={{ left: `${Math.min(100, (playheadMs / totalDuration) * 100)}%` }}><i className="absolute -left-1 -top-1 size-2 rotate-45 bg-red-500" /></span>
                            </div>
                            <div className="mt-1 flex h-5 min-w-[720px] items-center rounded px-2 text-[9px]" style={{ background: theme.canvas.line, color: theme.node.faint }}>A1 · 环境音与旁白</div>
                        </div>
                    </div>
                </div>
            ) : null}

            {open && view !== "timeline" ? (
                <ReferenceShelf kind={view} items={production[view] || []} selectedCount={selectedNodes.length} theme={theme} nodeById={nodeById} onAdd={() => addReferences(view)} onFocusNode={onFocusNode} />
            ) : null}
        </div>
    );
}

function Tab({ active, icon, label, count, theme, onClick }: { active: boolean; icon: ReactNode; label: string; count: number; theme: CanvasTheme; onClick: () => void }) {
    return <button type="button" onClick={onClick} className="flex h-full items-center gap-1.5 border-b-2 px-2.5 text-xs transition" style={{ borderColor: active ? theme.node.activeStroke : "transparent", color: active ? theme.node.text : theme.node.muted }}>{icon}<span>{label}</span>{count ? <b className="font-normal opacity-55">{count}</b> : null}</button>;
}

function ShotPreview({ node }: { node?: CanvasNodeData }) {
    if (node?.metadata?.content) return <video src={`${node.metadata.content}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover opacity-80" />;
    return <span className="grid size-full place-items-center bg-gradient-to-br from-stone-700 to-stone-900"><Play className="size-5 text-white/45" /></span>;
}

function ReferenceShelf({ kind, items, selectedCount, theme, nodeById, onAdd, onFocusNode }: { kind: ReferenceKey; items: ProductionReference[]; selectedCount: number; theme: CanvasTheme; nodeById: Map<string, CanvasNodeData>; onAdd: () => void; onFocusNode: (nodeId: string) => void }) {
    const copy = {
        research: { title: "研究资料", description: "把事实、摘录与知识节点留在创作链上。", empty: "研究资料", icon: <BookOpen className="size-5 opacity-35" /> },
        worlds: { title: "游戏世界", description: "把研究映射为地点、规则、任务与叙事机制。", empty: "世界设定", icon: <Globe2 className="size-5 opacity-35" /> },
        characters: { title: "角色圣经", description: "把人物参考、外观与性格绑定到画布节点。", empty: "角色参考", icon: <Users className="size-5 opacity-35" /> },
        scenes: { title: "场景库", description: "沉淀地点、光线与美术风格，供镜头复用。", empty: "场景素材", icon: <ImageIcon className="size-5 opacity-35" /> },
    }[kind];
    return (
        <div className="flex h-[176px] border-t" style={{ borderColor: theme.toolbar.border }}>
            <div className="w-[180px] shrink-0 border-r p-3" style={{ borderColor: theme.toolbar.border }}>
                <p className="text-xs font-medium">{copy.title}</p>
                <p className="mt-1 text-[10px] leading-4" style={{ color: theme.node.muted }}>{copy.description}</p>
                <button type="button" disabled={!selectedCount} onClick={onAdd} className="mt-3 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition hover:bg-black/5 disabled:opacity-35 dark:hover:bg-white/10"><Plus className="size-3.5" /> 从选中节点添加</button>
            </div>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto p-3">
                {items.length ? items.map((item) => {
                    const node = nodeById.get(item.nodeId);
                    return <button type="button" key={item.id} onClick={() => onFocusNode(item.nodeId)} className="group flex w-[210px] shrink-0 overflow-hidden rounded-lg border text-left transition hover:-translate-y-0.5" style={{ borderColor: theme.node.stroke, background: theme.node.panel }}><div className="w-20 shrink-0 overflow-hidden" style={{ background: theme.node.fill }}>{node?.metadata?.content && node.type === CanvasNodeType.Image ? <img src={node.metadata.content} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center">{copy.icon}</span>}</div><div className="min-w-0 p-2.5"><strong className="block truncate text-xs">{item.title}</strong><p className="mt-1 line-clamp-3 text-[10px] leading-4" style={{ color: theme.node.muted }}>{item.description || "等待补充设定"}</p></div></button>;
                }) : <div className="flex flex-1 items-center justify-center text-xs" style={{ color: theme.node.faint }}>从画布选择{copy.empty}后添加</div>}
            </div>
        </div>
    );
}

function formatTime(value: number) {
    const seconds = Math.floor(value / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
