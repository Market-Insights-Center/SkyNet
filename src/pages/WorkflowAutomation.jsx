import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Save, Play, Pause, Plus, Trash2, ArrowLeft,
    Workflow, Activity, DollarSign, Percent,
    Target, Layers, Mail, Lock, X, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:8000/api'; // Adjust if needed

const WorkflowAutomation = () => {
    const navigate = useNavigate();
    const [automations, setAutomations] = useState([]);
    const [currentAuto, setCurrentAuto] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [userEmail, setUserEmail] = useState(''); // Need to get this from Auth context ideally

    // Editor State
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]); // { source: id, target: id, sourceHandle: 'right', targetHandle: 'left' }

    // Interaction State
    const [dragNode, setDragNode] = useState(null);
    const [connecting, setConnecting] = useState(null); // { nodeId, handle, x, y }
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const canvasRef = useRef(null);

    // Fetch user info + automations
    useEffect(() => {
        // Mock Auth for now - replace with actual auth hook
        const email = localStorage.getItem('user_email') || 'test@example.com';
        setUserEmail(email);
        fetchAutomations();
    }, []);

    const fetchAutomations = async () => {
        try {
            const res = await fetch(`${API_URL}/automations`);
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            setAutomations(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch automations:", e);
            setAutomations([]);
        }
    };

    // --- EDITOR ACTIONS ---



    const deleteNode = (id) => {
        setNodes(nodes.filter(n => n.id !== id));
        setEdges(edges.filter(e => e.source !== id && e.target !== id));
    };

    const deleteEdge = (index) => {
        const newEdges = [...edges];
        newEdges.splice(index, 1);
        setEdges(newEdges);
    };

    const handleSave = async () => {
        // Validation
        // 1. Must start with Conditional (Risk/Price/Percent/Time)
        // 2. Must end with Action (Tracking/Nexus/Email)
        console.log("Validating Automation...");
        const conditionals = nodes.filter(n => ['risk', 'price', 'percentage', 'time_interval'].includes(n.type));
        const actions = nodes.filter(n => ['tracking', 'nexus', 'send_email'].includes(n.type));

        console.log("Conditionals:", conditionals.length, "Actions:", actions.length);

        if (conditionals.length === 0) {
            alert("Error: Automation must have a Conditional block.");
            return;
        }
        if (actions.length === 0) {
            alert("Error: Automation must have an Action block.");
            return;
        }

        // Validate Connectivity (Simple check: Conditional has output, Action has input)
        // ... (Sophisticated BFS could go here, but simple warnings suffice for now)

        try {
            const res = await fetch(`${API_URL}/automations/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: currentAuto.id,
                    name: currentAuto.name,
                    active: currentAuto.active,
                    nodes,
                    edges,
                    user_email: userEmail
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || res.statusText);
            }

            const data = await res.json();
            if (data.status === 'success') {
                await fetchAutomations();
                setCurrentAuto(null); // Redirect to list
            } else {
                alert(`Error: ${data.detail || data.message}`);
            }
        } catch (e) {
            console.error("Save Error:", e);
            alert(`Error saving: ${e.message}`);
        }
    };

    const handleToggle = async (auto) => {
        try {
            await fetch(`${API_URL}/automations/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: auto.id, active: !auto.active })
            });
            fetchAutomations();
        } catch (e) {
            console.error(e);
        }
    };

    // --- CLICK-TO-CONNECT INTERACTION ---

    const handleCanvasMouseDown = (e) => {
        // Cancel connecting if clicking on canvas
        if (connecting && !e.target.closest('.connection-dot')) {
            setConnecting(null);
        }
    };

    const handleNodeMouseDown = (e, nodeId) => {
        if (connecting) return; // Don't drag if connecting
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setDragNode({
            id: nodeId,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top
        });
    };

    const handleDotClick = (e, nodeId, handle, type) => {
        e.stopPropagation();

        if (!connecting) {
            // Start Connection
            const rect = e.target.getBoundingClientRect();
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const x = rect.left + rect.width / 2 - canvasRect.left;
            const y = rect.top + rect.height / 2 - canvasRect.top;

            setConnecting({ nodeId, handle, type, startX: x, startY: y });
        } else {
            // Complete Connection
            if (connecting.nodeId === nodeId) {
                // Clicked same node, cancel
                setConnecting(null);
                return;
            }

            // Add Edge
            setEdges([...edges, {
                source: connecting.nodeId,
                target: nodeId,
                sourceHandle: connecting.handle,
                targetHandle: handle
            }]);
            setConnecting(null);
        }
    };

    const handleMouseMove = (e) => {
        if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

            if (dragNode) {
                const x = e.clientX - rect.left - dragNode.offsetX;
                const y = e.clientY - rect.top - dragNode.offsetY;
                setNodes(nodes.map(n => n.id === dragNode.id ? { ...n, position: { x, y } } : n));
            }
        }
    };

    const handleMouseUp = () => {
        setDragNode(null);
    };

    // --- RENDER HELPERS ---
    const addNode = (type) => {
        const id = Date.now().toString();
        let initialData = { label: type };

        // Initial Data Templates
        if (type === 'risk') initialData = { metric: 'general', op: '>', value: 50 };
        if (type === 'price') initialData = { ticker: 'AAPL', op: '>', value: 150 };
        if (type === 'percentage') initialData = { ticker: 'AAPL', op: '>', value: 5, timeframe: '1d' };
        if (type === 'tracking') initialData = { code: '', value: 1000, fractional: false, actions: [] };
        if (type === 'nexus') initialData = { code: '', value: 5000, fractional: true, actions: [] };
        if (type === 'email_info') initialData = { email: '' };
        if (type === 'rh_info') initialData = { email: '', password: '' };
        if (type === 'send_email') initialData = { subject: 'Automation Alert' };
        if (type === 'time_interval') initialData = { interval: 1, unit: 'days', target_time: '09:30', last_run: null };

        const newNode = {
            id,
            type,
            position: { x: 100 + nodes.length * 20, y: 100 + nodes.length * 20 },
            data: initialData
        };
        setNodes([...nodes, newNode]);
    };

    // ... (Existing List View) ...
    // Note: Render logic for List View is unchanged, so we assume the previous context handles it if we don't touch it.
    // Wait, I am replacing a huge chunk. I need to make sure I don't delete the List View render block if it's inside the replace range?
    // The previous `view_file` showed the List View code inside `if (!currentAuto) { ... }`.
    // My StartLine is 142 (handleCanvasMouseDown). My EndLine is 602.
    // The List View code starts around line 218.
    // I MUST include the List View code in my replacement or it will be deleted.

    if (!currentAuto) {
        return (
            <div className="min-h-screen bg-black text-white p-8 font-sans selection:bg-purple-500/30">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-12">
                        <div>
                            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent mb-2">
                                Workflow Automation
                            </h1>
                            <p className="text-gray-400 text-lg">
                                Create autonomous trading agents that run 24/7.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setNodes([]); setEdges([]);
                                setCurrentAuto({ id: Date.now().toString(), name: 'New Automation', active: false });
                            }}
                            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all"
                        >
                            <Plus size={20} /> New Automation
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {automations.map(auto => (
                            <div key={auto.id} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/50 transition-colors group relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                                        <Workflow size={24} />
                                    </div>
                                    <div className="flex gap-2 z-10">
                                        <button
                                            onClick={() => handleToggle(auto)}
                                            className={`p-2 rounded-lg transition-colors ${auto.active ? 'text-green-400 bg-green-500/10' : 'text-gray-500 bg-gray-800'}`}
                                        >
                                            {auto.active ? <Play size={16} /> : <Pause size={16} />}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (confirm('Delete?')) {
                                                    await fetch(`${API_URL}/automations/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: auto.id }) });
                                                    fetchAutomations();
                                                }
                                            }}
                                            className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold mb-2">{auto.name}</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    {auto.nodes?.length || 0} Blocks
                                </p>
                                <button
                                    onClick={() => {
                                        setNodes(auto.nodes || []);
                                        setEdges(auto.edges || []);
                                        setCurrentAuto(auto);
                                    }}
                                    className="w-full py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    Edit Workflow
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="h-screen w-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Toolbar */}
            <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-[#0a0a0a] z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentAuto(null)} className="text-gray-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </button>
                    <input
                        value={currentAuto.name}
                        onChange={(e) => setCurrentAuto({ ...currentAuto, name: e.target.value })}
                        className="bg-transparent text-xl font-bold focus:outline-none"
                    />
                </div>
                <div className="flex gap-4">
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors">
                        <Save size={18} /> Save
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 border-r border-gray-800 bg-[#0f0f0f] p-4 flex flex-col gap-6 overflow-y-auto z-40 select-none">
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Conditional</h4>
                        <div className="flex flex-col gap-2">
                            <BlockButton label="Risk" icon={Activity} onClick={() => addNode('risk')} color="text-red-400" />
                            <BlockButton label="Price" icon={DollarSign} onClick={() => addNode('price')} color="text-green-400" />
                            <BlockButton label="Percentage" icon={Percent} onClick={() => addNode('percentage')} color="text-blue-400" />
                            <BlockButton label="Time Interval" icon={Clock} onClick={() => addNode('time_interval')} color="text-cyan-400" />
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Action</h4>
                        <div className="flex flex-col gap-2">
                            <BlockButton label="Tracking" icon={Target} onClick={() => addNode('tracking')} color="text-amber-400" />
                            <BlockButton label="Nexus" icon={Layers} onClick={() => addNode('nexus')} color="text-purple-400" />
                            <BlockButton label="Send Email" icon={Mail} onClick={() => addNode('send_email')} color="text-blue-400" />
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Information</h4>
                        <div className="flex flex-col gap-2">
                            <BlockButton label="Email Info" icon={Mail} onClick={() => addNode('email_info')} color="text-gray-400" />
                            <BlockButton label="Robinhood" icon={Lock} onClick={() => addNode('rh_info')} color="text-green-600" />
                        </div>
                    </div>
                </div>

                {/* Canvas */}
                <div
                    className="flex-1 relative bg-[#050505] overflow-hidden"
                    ref={canvasRef}
                    onMouseDown={handleCanvasMouseDown}
                >
                    {/* Dot Grid */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(#444 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    />

                    {/* Edges (SVG Layer) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        {edges.map((edge, i) => {
                            const sourceNode = nodes.find(n => n.id === edge.source);
                            const targetNode = nodes.find(n => n.id === edge.target);
                            if (!sourceNode || !targetNode) return null;

                            const getHandlePos = (node, handle) => {
                                const el = document.getElementById(`node-${node.id}`);
                                const w = el ? el.offsetWidth : 320;
                                const h = el ? el.offsetHeight : 150;

                                const cx = node.position.x + w / 2;
                                const cy = node.position.y + h / 2;

                                if (handle === 'top') return { x: cx, y: node.position.y };
                                if (handle === 'bottom') return { x: cx, y: node.position.y + h };
                                if (handle === 'left') return { x: node.position.x, y: cy };
                                if (handle === 'right') return { x: node.position.x + w, y: cy };
                                return { x: cx, y: cy };
                            };

                            const start = getHandlePos(sourceNode, edge.sourceHandle);
                            const end = getHandlePos(targetNode, edge.targetHandle);

                            return (
                                <line
                                    key={i}
                                    x1={start.x} y1={start.y}
                                    x2={end.x} y2={end.y}
                                    stroke="#666"
                                    strokeWidth="2"
                                />
                            );
                        })}
                        {connecting && (
                            <line
                                x1={connecting.startX} y1={connecting.startY}
                                x2={mousePos.x} y2={mousePos.y}
                                stroke="#a855f7"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                            />
                        )}
                    </svg>

                    {/* Nodes */}
                    {nodes.map(node => (
                        <div
                            key={node.id}
                            id={`node-${node.id}`}
                            style={{
                                left: node.position.x,
                                top: node.position.y
                            }}
                            className="absolute"
                            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        >
                            <NodeComponent
                                node={node}
                                onDelete={() => deleteNode(node.id)}
                                updateData={(data) => {
                                    setNodes(nodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, ...data } } : n));
                                }}
                                onDotClick={handleDotClick}
                                connecting={connecting}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const BlockButton = ({ label, icon: Icon, onClick, color }) => (
    <button onClick={onClick} className="flex items-center gap-3 w-full p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-700 text-left group">
        <Icon size={18} className={`${color} group-hover:scale-110 transition-transform`} />
        <span className="text-sm font-medium text-gray-300 group-hover:text-white">{label}</span>
    </button>
);

const NodeComponent = ({ node, onDelete, updateData, onDotClick, connecting }) => {
    // Styles
    const getStyles = () => {
        switch (node.type) {
            case 'risk': return 'border-red-500/50 bg-red-900/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
            case 'price': return 'border-green-500/50 bg-green-900/40 shadow-[0_0_15px_rgba(34,197,94,0.2)]';
            case 'percentage': return 'border-blue-500/50 bg-blue-900/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]';
            case 'time_interval': return 'border-cyan-500/50 bg-cyan-900/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]';
            case 'tracking': return 'border-amber-500/50 bg-amber-900/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
            case 'nexus': return 'border-purple-500/50 bg-purple-900/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]';
            case 'send_email': return 'border-blue-500/50 bg-blue-900/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]';
            case 'email_info': return 'border-gray-500/50 bg-gray-800/40';
            case 'rh_info': return 'border-green-600/50 bg-green-900/20';
            default: return 'border-gray-700 bg-gray-900';
        }
    };

    // Click-to-Connect Dot
    const Dot = ({ handle }) => {
        const isSelected = connecting?.nodeId === node.id && connecting?.handle === handle;
        return (
            <div
                className={`connection-dot absolute w-4 h-4 rounded-full cursor-pointer z-50 transition-all
                    ${isSelected ? 'bg-purple-500 scale-125 border-white' : 'bg-gray-400 border-black hover:bg-white'}
                    border-2 
                    ${handle === 'top' ? '-top-2 left-1/2 -translate-x-1/2' : ''}
                    ${handle === 'bottom' ? '-bottom-2 left-1/2 -translate-x-1/2' : ''}
                    ${handle === 'left' ? 'top-1/2 -left-2 -translate-y-1/2' : ''}
                    ${handle === 'right' ? 'top-1/2 -right-2 -translate-y-1/2' : ''}
                `}
                onClick={(e) => onDotClick(e, node.id, handle, node.type)}
                onMouseDown={(e) => e.stopPropagation()}
            />
        );
    };

    return (
        <div className={`w-80 rounded-xl border backdrop-blur-md p-4 relative ${getStyles()}`}>
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider opacity-90">{node.type.replace('_', ' ')}</span>
                <button onClick={onDelete} className="text-gray-400 hover:text-red-400">
                    <Trash2 size={14} />
                </button>
            </div>

            <div className="space-y-3 text-sm">

                {/* --- CONDITIONAL BLOCKS --- */}
                {node.type === 'risk' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span>When Risk</span>
                        <select className="bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.metric} onChange={e => updateData({ metric: e.target.value })}>
                            <option value="general">General</option>
                            <option value="market">Market</option>
                        </select>
                        <select className="bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.op} onChange={e => updateData({ op: e.target.value })}>
                            <option value=">">{'>'}</option>
                            <option value="<">{'<'}</option>
                        </select>
                        <input type="number" className="w-16 bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.value} onChange={e => updateData({ value: e.target.value })} />
                    </div>
                )}

                {node.type === 'time_interval' && (
                    <div className="space-y-2">
                        <div className="text-xs text-gray-400">Runs on Trading Days (M-F)</div>
                        <div className="flex items-center gap-2">
                            <span>After</span>
                            <input type="time" className="bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.target_time} onChange={e => updateData({ target_time: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Every</span>
                            <input type="number" className="w-16 bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.interval} onChange={e => updateData({ interval: e.target.value })} />
                            <select className="bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.unit} onChange={e => updateData({ unit: e.target.value })}>
                                <option value="days">Days</option>
                                <option value="hours">Hours</option>
                            </select>
                        </div>
                        <div className="text-[10px] text-gray-500">Last Run: {node.data.last_run ? new Date(node.data.last_run).toLocaleString() : 'Never'}</div>
                    </div>
                )}

                {node.type === 'price' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span>When Price of</span>
                        <input className="w-20 bg-black/40 rounded px-2 py-1 border border-white/10" placeholder="NVDA" value={node.data.ticker} onChange={e => updateData({ ticker: e.target.value })} />
                        <select className="bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.op} onChange={e => updateData({ op: e.target.value })}>
                            <option value=">">{'>'}</option>
                            <option value="<">{'<'}</option>
                        </select>
                        <span>$</span>
                        <input type="number" className="w-20 bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.value} onChange={e => updateData({ value: e.target.value })} />
                    </div>
                )}

                {node.type === 'percentage' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span>When</span>
                        <input className="w-20 bg-black/40 rounded px-2 py-1 border border-white/10" placeholder="NVDA" value={node.data.ticker} onChange={e => updateData({ ticker: e.target.value })} />
                        <select className="bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.op} onChange={e => updateData({ op: e.target.value })}>
                            <option value=">">{'>'}</option>
                            <option value="<">{'<'}</option>
                        </select>
                        <input type="number" className="w-16 bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.value} onChange={e => updateData({ value: e.target.value })} />
                        <span>% in</span>
                        <select className="bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.timeframe} onChange={e => updateData({ timeframe: e.target.value })}>
                            <option value="1d">1d</option>
                            <option value="1w">1w</option>
                            <option value="1m">1m</option>
                        </select>
                    </div>
                )}

                {/* --- ACTION BLOCKS --- */}
                {(node.type === 'tracking' || node.type === 'nexus') && (
                    <div className="space-y-2">
                        <div>
                            <div className="text-xs text-gray-400 mb-1">Portfolio Code</div>
                            <input className="w-full bg-black/40 rounded px-2 py-1 border border-white/10" placeholder="Code..." value={node.data.code} onChange={e => updateData({ code: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">$</span>
                            <input type="number" className="flex-1 bg-black/40 rounded px-2 py-1 border border-white/10" placeholder="Value" value={node.data.value} onChange={e => updateData({ value: e.target.value })} />
                        </div>
                        <div className="space-y-1 pt-1">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={node.data.fractional}
                                    onChange={e => updateData({ fractional: e.target.checked })}
                                />
                                <label className="text-xs">Fractional Shares</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={node.data.actions?.includes('email')}
                                    onChange={e => {
                                        const current = node.data.actions || [];
                                        const next = e.target.checked ? [...current, 'email'] : current.filter(a => a !== 'email');
                                        updateData({ actions: next });
                                    }}
                                />
                                <label className="text-xs">Send Email</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={node.data.actions?.includes('overwrite')}
                                    disabled={node.data.actions?.includes('robinhood')}
                                    onChange={e => {
                                        if (node.data.actions?.includes('robinhood')) return; // Prevent change if locked
                                        const current = node.data.actions || [];
                                        const next = e.target.checked ? [...current, 'overwrite'] : current.filter(a => a !== 'overwrite');
                                        updateData({ actions: next });
                                    }}
                                />
                                <label className={`text-xs ${node.data.actions?.includes('robinhood') ? 'text-gray-500 cursor-not-allowed' : ''}`}>
                                    Overwrite Last {node.data.actions?.includes('robinhood') && '(Locked)'}
                                </label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={node.data.actions?.includes('robinhood')}
                                    onChange={e => {
                                        const current = node.data.actions || [];
                                        let next;
                                        if (e.target.checked) {
                                            // Ensure unique values when adding both
                                            const set = new Set([...current, 'robinhood', 'overwrite']);
                                            next = Array.from(set);
                                        } else {
                                            next = current.filter(a => a !== 'robinhood');
                                        }
                                        updateData({ actions: next });
                                    }}
                                />
                                <label className="text-xs">Exec on Robinhood</label>
                            </div>
                        </div>
                    </div>
                )}

                {node.type === 'send_email' && (
                    <div className="space-y-2">
                        <div className="text-xs text-gray-400">Recipient provided via 'Email Info' block.</div>
                        <input className="w-full bg-black/40 rounded px-2 py-1 border border-white/10" placeholder="Subject..." value={node.data.subject} onChange={e => updateData({ subject: e.target.value })} />
                    </div>
                )}

                {/* --- INFO BLOCKS --- */}
                {node.type === 'email_info' && (
                    <input className="w-full bg-black/40 rounded px-2 py-1 border border-white/10" placeholder="Email Address..." value={node.data.email} onChange={e => updateData({ email: e.target.value })} />
                )}
                {node.type === 'rh_info' && (
                    <div className="space-y-2">
                        <input className="w-full bg-black/40 rounded px-2 py-1 border border-white/10" placeholder="RH Email" value={node.data.email} onChange={e => updateData({ email: e.target.value })} />
                        <input className="w-full bg-black/40 rounded px-2 py-1 border border-white/10" type="password" placeholder="RH Password" value={node.data.password} onChange={e => updateData({ password: e.target.value })} />
                    </div>
                )}
            </div>

            {/* Connection Dots */}
            <Dot handle="top" />
            <Dot handle="bottom" />
            <Dot handle="left" />
            <Dot handle="right" />
        </div>
    );
};
export default WorkflowAutomation;
