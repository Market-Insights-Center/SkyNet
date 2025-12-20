import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Save, Play, Pause, Plus, Trash2, ArrowLeft,
    Workflow, Activity, DollarSign, Percent,
    Target, Layers, Mail, Lock, X, Clock,
    GitBranch, Zap, Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const API_URL = '/api'; // Adjust if needed

const WorkflowAutomation = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [automations, setAutomations] = useState([]);
    const [currentAuto, setCurrentAuto] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const userEmail = currentUser?.email || '';

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
        if (userEmail) {
            fetchAutomations();
        }
    }, [userEmail]);

    const fetchAutomations = async () => {
        try {
            const res = await fetch(`/api/automations?email=${userEmail || 'demo'}`); // Fixed missing email param that might be needed
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            setAutomations(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch automations:", e);
            setAutomations([]);
        }
    };

    // --- COMMUNITY & SHARE ---
    const [viewMode, setViewMode] = useState('my'); // 'my' or 'community'
    const [communityAutos, setCommunityAutos] = useState([]);
    const [communitySort, setCommunitySort] = useState('recent'); // 'recent' | 'popular'

    useEffect(() => {
        if (viewMode === 'community') {
            fetchCommunity();
        }
    }, [viewMode, communitySort]);

    const fetchCommunity = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/automations/community?sort=${communitySort}`);
            const data = await res.json();
            setCommunityAutos(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleShare = async (auto, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log("handleShare clicked", auto);
        const username = userProfile?.username || "Anonymous";
        if (!confirm(`Share "${auto.name}" with the community as ${username}?`)) return;

        try {
            const res = await fetch('/api/automations/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ automation: auto, username })
            });
            const d = await res.json();
            if (d.success) alert("Shared successfully!");
            else alert("Error sharing: " + d.message);
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        }
    };

    const handleCopy = async (sharedAuto) => {
        if (!confirm(`Import "${sharedAuto.name}" to your automations?`)) return;

        // 1. Increment Count
        fetch('/api/automations/copy-count', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shared_id: sharedAuto.id })
        });

        // 2. Add to Local List (Clone)
        const newAuto = {
            ...sharedAuto,
            id: Date.now().toString(), // New ID
            name: `Copy of ${sharedAuto.name}`,
            creator: userEmail, // Now owned by me
            active: false
            // remove shared metadata
        };
        delete newAuto.copy_count;
        delete newAuto.original_id;

        // Save to DB
        try {
            const res = await fetch('/api/automations/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newAuto,
                    user_email: userEmail
                })
            });
            if (res.ok) {
                alert("Imported successfully!");
                fetchAutomations();
                setViewMode('my');
            } else {
                alert("Failed to save imported automation.");
            }
        } catch (e) { console.error(e); }
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
        const conditionals = nodes.filter(n => ['risk', 'price', 'percentage', 'time_interval', 'sentinel_trigger'].includes(n.type));
        const actions = nodes.filter(n => ['tracking', 'nexus', 'send_email', 'webhook'].includes(n.type));

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
                import('../services/usageService').then(({ trackUsage }) => trackUsage('cultivate')); // Track usage
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

    const [errorMessage, setErrorMessage] = useState(null);

    // Clear error after 3 seconds
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => setErrorMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    // Validation Logic
    const validateConnection = (sourceId, sourceHandle, targetId, targetHandle) => {
        const sourceNode = nodes.find(n => n.id === sourceId);
        const targetNode = nodes.find(n => n.id === targetId);

        if (!sourceNode || !targetNode) return false;

        const sourceType = sourceNode.type;
        const targetType = targetNode.type;

        // Categories
        const isConditional = ['risk', 'price', 'percentage', 'sentiment_trigger', 'time_interval'].includes(sourceType);
        const isLogic = ['logic_gate', 'if_gate'].includes(sourceType);
        const isInfo = ['email_info', 'rh_info'].includes(sourceType);
        const isAction = ['tracking', 'nexus', 'send_email', 'webhook'].includes(targetType);
        const isTargetLogic = ['logic_gate', 'if_gate'].includes(targetType);

        // Rules
        // 1. Conditionals -> Logic or Action
        if (isConditional) {
            if (!(isAction || isTargetLogic)) {
                return `${sourceType.replace('_', ' ')} blocks cannot be connected to ${targetType.replace('_', ' ')} blocks. Connected to Action or Logic only.`;
            }
        }

        // 2. Logic -> Logic or Action
        if (isLogic) {
            if (!(isAction || isTargetLogic)) {
                return `${sourceType.replace('_', ' ')} blocks cannot be connected to ${targetType.replace('_', ' ')} blocks. Connect to Action or Logic only.`;
            }
        }

        // 3. Info -> Compatible Actions only
        if (isInfo) {
            // Info blocks usually connect to specific actions or any action that needs data?
            // For simplicity, let's allow Info -> Actions, but NOT Info -> Logic or Info -> Conditional
            if (!isAction) {
                return `${sourceType.replace('_', ' ')} blocks cannot be connected to ${targetType.replace('_', ' ')} blocks. Connect to Action only.`;
            }
        }

        // 4. Action -> Nothing (End of flow)
        // (Handled by the fact that Actions usually don't have "Right" handles, but if they did...)
        if (['tracking', 'nexus', 'send_email', 'webhook'].includes(sourceType)) {
            return "Action blocks cannot have outgoing connections.";
        }

        return null; // Valid
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
                setConnecting(null);
                return;
            }

            // Validate
            const errorMsg = validateConnection(connecting.nodeId, connecting.handle, nodeId, handle);
            if (errorMsg) {
                setErrorMessage(errorMsg);
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
        if (type === 'sentiment_trigger') initialData = { ticker: 'NVDA', op: '>', value: 75 };
        if (type === 'logic_gate') initialData = { operation: 'AND' };
        if (type === 'if_gate') initialData = { conditions: [{ id: 'c1', outputId: 'out1' }], elseOutputId: 'out_else' };
        if (type === 'tracking') initialData = { code: '', value: 1000, fractional: false, actions: [] };
        if (type === 'nexus') initialData = { code: '', value: 5000, fractional: true, actions: [] };
        if (type === 'email_info') initialData = { email: '' };
        if (type === 'rh_info') initialData = { email: '', password: '' };
        if (type === 'send_email') initialData = { subject: 'Automation Alert' };
        if (type === 'webhook') initialData = { url: '', platform: 'discord', message: 'Alert Triggered' };
        if (type === 'time_interval') initialData = { interval: 1, unit: 'days', target_time: '09:30', last_run: null };

        const newNode = {
            id,
            type,
            position: { x: 100 + nodes.length * 20, y: 100 + nodes.length * 20 },
            data: initialData
        };
        setNodes([...nodes, newNode]);
    };

    // ... (Existing Render) ...

    if (!currentAuto) {
        return (
            <div className="min-h-screen bg-black text-white p-8 font-sans selection:bg-purple-500/30">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent mb-2">
                                Workflow Automation
                            </h1>
                            <p className="text-gray-400 text-lg">
                                Create and share autonomous trading agents.
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

                    {/* Tabs */}
                    <div className="flex items-center gap-6 mb-8 border-b border-gray-800 pb-2">
                        <button
                            onClick={() => setViewMode('my')}
                            className={`pb-2 px-1 text-lg font-medium transition-colors ${viewMode === 'my' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}
                        >
                            My Automations
                        </button>
                        <button
                            onClick={() => setViewMode('community')}
                            className={`pb-2 px-1 text-lg font-medium transition-colors ${viewMode === 'community' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                        >
                            Community
                        </button>
                    </div>

                    {/* Content */}
                    {viewMode === 'my' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {automations.map(auto => (
                                <div key={auto.id} onClick={() => { setNodes(auto.nodes || []); setEdges(auto.edges || []); setCurrentAuto(auto); }} className="cursor-pointer bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/50 transition-colors group relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                                            <Workflow size={24} />
                                        </div>
                                        <div className="flex gap-2 z-50 pointer-events-auto" onClick={e => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={(e) => handleShare(auto, e)}
                                                className="p-2 text-gray-400 hover:text-white bg-gray-600 hover:bg-blue-600 rounded-full transition-all"
                                                style={{ zIndex: 100, position: 'relative' }}
                                            >
                                                <Globe size={16} />
                                            </button>
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
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>Click to Edit</span>
                                        {auto.active && <span className="text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Active</span>}
                                    </div>
                                </div>
                            ))}
                            {automations.length === 0 && (
                                <div className="col-span-full py-20 text-center text-gray-500">
                                    No automations found. Create your first one above!
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Sort Controls */}
                            <div className="flex items-center gap-4">
                                <span className="text-gray-400 text-sm">Sort By:</span>
                                <button onClick={() => setCommunitySort('recent')} className={`text-sm px-3 py-1 rounded ${communitySort === 'recent' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:text-white'}`}>Most Recent</button>
                                <button onClick={() => setCommunitySort('popular')} className={`text-sm px-3 py-1 rounded ${communitySort === 'popular' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:text-white'}`}>Most Copied</button>
                            </div>

                            {/* Community Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {communityAutos.map(auto => (
                                    <div key={auto.id} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-blue-500/50 transition-colors group relative">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                                                <Globe size={24} />
                                            </div>
                                            <div className="flex items-center gap-1 bg-gray-800 px-2 py-1 rounded text-xs text-gray-400">
                                                <Layers size={12} /> {auto.copy_count || 0} Copies
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-bold mb-1">{auto.name}</h3>
                                        <p className="text-xs text-blue-400 mb-4">by @{auto.creator}</p>
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => handleCopy(auto)}
                                                className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-white hover:text-black transition-colors py-2 rounded-lg text-sm font-medium"
                                            >
                                                <Plus size={16} /> Import
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {communityAutos.length === 0 && !loading && (
                                    <div className="col-span-full py-20 text-center text-gray-500">
                                        No shared automations yet. Be the first!
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
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
                            <BlockButton label="Sentiment" icon={Zap} onClick={() => addNode('sentiment_trigger')} color="text-yellow-400" />
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Logic</h4>
                        <div className="flex flex-col gap-2">
                            <BlockButton label="And/Or Gate" icon={GitBranch} onClick={() => addNode('logic_gate')} color="text-pink-400" />
                            <BlockButton label="If / Else Gate" icon={GitBranch} onClick={() => addNode('if_gate')} color="text-orange-400" />
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Action</h4>
                        <div className="flex flex-col gap-2">
                            <BlockButton label="Tracking" icon={Target} onClick={() => addNode('tracking')} color="text-amber-400" />
                            <BlockButton label="Nexus" icon={Layers} onClick={() => addNode('nexus')} color="text-purple-400" />
                            <BlockButton label="Send Email" icon={Mail} onClick={() => addNode('send_email')} color="text-blue-400" />
                            <BlockButton label="Webhook" icon={Globe} onClick={() => addNode('webhook')} color="text-indigo-400" />
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
                                if (!el) return { x: node.position.x, y: node.position.y }; // Fallback

                                const w = el.offsetWidth;
                                const h = el.offsetHeight;

                                // Standard Handles
                                if (handle === 'top') return { x: node.position.x + w / 2, y: node.position.y };
                                if (handle === 'bottom') return { x: node.position.x + w / 2, y: node.position.y + h };
                                if (handle === 'left') return { x: node.position.x, y: node.position.y + h / 2 };
                                if (handle === 'right') return { x: node.position.x + w, y: node.position.y + h / 2 };

                                // Dynamic Handles (if_gate)
                                // Format: "in-0", "out-0", "out-else"
                                // We assume rows are ~40px height, starting after header (~45px)
                                const headerHeight = 45;
                                const rowHeight = 40;

                                if (handle.startsWith('in-')) {
                                    const index = parseInt(handle.split('-')[1]);
                                    const yOffset = headerHeight + (index * rowHeight) + (rowHeight / 2);
                                    return { x: node.position.x, y: node.position.y + yOffset };
                                }
                                if (handle.startsWith('out-')) {
                                    if (handle === 'out-else') {
                                        // Specific calculation for else (last item)
                                        // Need to know total conditions to place 'else' correctly?
                                        // Easier: The 'Else' row is rendered last. 
                                        // Limitation: We don't verify node data count here easily without potentially stale state.
                                        // BUT we can map it to node.data.conditions length if available.
                                        const count = node.data.conditions?.length || 0;
                                        const yOffset = headerHeight + (count * rowHeight) + (rowHeight / 2);
                                        return { x: node.position.x + w, y: node.position.y + yOffset };
                                    } else {
                                        const index = parseInt(handle.split('-')[1]);
                                        const yOffset = headerHeight + (index * rowHeight) + (rowHeight / 2);
                                        return { x: node.position.x + w, y: node.position.y + yOffset };
                                    }
                                }

                                return { x: node.position.x + w / 2, y: node.position.y + h / 2 };
                            };

                            const start = getHandlePos(sourceNode, edge.sourceHandle);
                            const end = getHandlePos(targetNode, edge.targetHandle);

                            // Calculate Midpoint for Delete Button
                            const midX = (start.x + end.x) / 2;
                            const midY = (start.y + end.y) / 2;

                            return (
                                <g key={i}>
                                    <line
                                        x1={start.x} y1={start.y}
                                        x2={end.x} y2={end.y}
                                        stroke="#666"
                                        strokeWidth="2"
                                    />
                                    {/* Delete Handle */}
                                    <g
                                        className="cursor-pointer pointer-events-auto hover:opacity-80 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteEdge(i);
                                        }}
                                    >
                                        <circle cx={midX} cy={midY} r="8" fill="#1f2937" stroke="#ef4444" strokeWidth="1" />
                                        <text
                                            x={midX}
                                            y={midY}
                                            dy="3"
                                            textAnchor="middle"
                                            fontSize="10"
                                            fill="#ef4444"
                                            fontWeight="bold"
                                        >
                                            ×
                                        </text>
                                    </g>
                                </g>
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
                    {errorMessage && (
                        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.6)] backdrop-blur-md flex items-center gap-3 z-50 animate-bounce">
                            <X size={20} className="cursor-pointer" onClick={() => setErrorMessage(null)} />
                            <span className="font-bold">{errorMessage}</span>
                        </div>
                    )}
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
            case 'sentiment_trigger': return 'border-yellow-500/50 bg-yellow-900/40 shadow-[0_0_15px_rgba(234,179,8,0.2)]';
            case 'logic_gate': return 'border-pink-500/50 bg-pink-900/40 shadow-[0_0_15px_rgba(236,72,153,0.2)]';
            case 'if_gate': return 'border-orange-500/50 bg-orange-900/40 shadow-[0_0_15px_rgba(249,115,22,0.2)]';
            case 'tracking': return 'border-amber-500/50 bg-amber-900/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
            case 'nexus': return 'border-purple-500/50 bg-purple-900/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]';
            case 'send_email': return 'border-blue-500/50 bg-blue-900/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]';
            case 'webhook': return 'border-indigo-500/50 bg-indigo-900/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]';
            case 'email_info': return 'border-gray-500/50 bg-gray-800/40';
            case 'rh_info': return 'border-green-600/50 bg-green-900/20';
            default: return 'border-gray-700 bg-gray-900';
        }
    };

    // Click-to-Connect Dot
    const Dot = ({ handle, style }) => {
        const isSelected = connecting?.nodeId === node.id && connecting?.handle === handle;
        return (
            <div
                className={`connection-dot absolute w-4 h-4 rounded-full cursor-pointer z-50 transition-all
                    ${isSelected ? 'bg-purple-500 scale-125 border-white' : 'bg-gray-400 border-black hover:bg-white'}
                    border-2 
                    ${!style && handle === 'top' ? '-top-2 left-1/2 -translate-x-1/2' : ''}
                    ${!style && handle === 'bottom' ? '-bottom-2 left-1/2 -translate-x-1/2' : ''}
                    ${!style && handle === 'left' ? 'top-1/2 -left-2 -translate-y-1/2' : ''}
                    ${!style && handle === 'right' ? 'top-1/2 -right-2 -translate-y-1/2' : ''}
                `}
                style={style}
                onClick={(e) => onDotClick(e, node.id, handle, node.type)}
                onMouseDown={(e) => e.stopPropagation()}
                title={handle}
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

                {node.type === 'sentiment_trigger' && (
                    <div className="space-y-2">
                        <div className="text-xs text-yellow-500 font-bold flex items-center gap-1">
                            <Zap size={12} /> AI Sentiment
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span>When</span>
                            <input className="w-16 bg-black/40 rounded px-2 py-1 border border-white/10" placeholder="NVDA" value={node.data.ticker} onChange={e => updateData({ ticker: e.target.value })} />
                            <select className="bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.op} onChange={e => updateData({ op: e.target.value })}>
                                <option value=">">{'>'}</option>
                                <option value="<">{'<'}</option>
                                <option value=">=">{'>='}</option>
                                <option value="<=">{'<='}</option>
                            </select>
                            <input type="number" className="w-16 bg-black/40 rounded px-2 py-1 border border-white/10" value={node.data.value} onChange={e => updateData({ value: e.target.value })} />
                        </div>
                        <div className="text-[10px] text-gray-500">Score 0-100</div>
                    </div>
                )}

                {node.type === 'logic_gate' && (
                    <div className="flex flex-col items-center justify-center py-2">
                        <div className="text-xs text-pink-400 mb-2 font-bold uppercase tracking-wider">And/Or Gate</div>
                        <select
                            className="bg-black/40 rounded px-4 py-2 border border-white/10 text-xl font-bold font-mono text-center w-full"
                            value={node.data.operation}
                            onChange={e => updateData({ operation: e.target.value })}
                        >
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                            <option value="XOR">XOR</option>
                            <option value="NAND">NAND</option>
                        </select>
                        <span className="text-[10px] text-gray-500 mt-2">Connect 2+ Inputs</span>
                    </div>
                )}

                {node.type === 'if_gate' && (
                    <div className="space-y-0">
                        {(node.data.conditions || []).map((cond, idx) => (
                            <div key={idx} className="flex items-center justify-between h-[40px] px-2 bg-white/5 mb-1 rounded relative">
                                <div className="font-mono text-orange-400 font-bold text-xs">{idx === 0 ? 'IF' : 'ELSE IF'}</div>
                                {/* Custom Dots */}
                                <Dot handle={`in-${idx}`} style={{ top: '50%', left: '-8px', transform: 'translateY(-50%)' }} />
                                <Dot handle={`out-${idx}`} style={{ top: '50%', right: '-8px', transform: 'translateY(-50%)' }} />

                                <button
                                    onClick={() => {
                                        const newConds = node.data.conditions.filter((_, i) => i !== idx);
                                        updateData({ conditions: newConds });
                                    }}
                                    className="text-gray-600 hover:text-red-400 ml-4 hover:scale-110 transition-transform"
                                    disabled={idx === 0} // Prevent deleting first
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        {/* Else Row */}
                        <div className="flex items-center justify-between h-[40px] px-2 bg-white/5 rounded relative">
                            <div className="font-mono text-gray-400 font-bold text-xs">ELSE</div>
                            <Dot handle="out-else" style={{ top: '50%', right: '-8px', transform: 'translateY(-50%)' }} />
                        </div>

                        <div className="mt-2 text-center">
                            <button
                                onClick={() => updateData({ conditions: [...(node.data.conditions || []), { id: `c${Date.now()}` }] })}
                                className="text-[10px] bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white px-2 py-1 rounded transition-colors"
                            >
                                + Add Condition
                            </button>
                        </div>
                    </div>
                )}

                {/* --- ACTION BLOCKS --- */}
                {(node.type === 'tracking' || node.type === 'nexus') && (
                    <div className="space-y-2">
                        {/* Track Type Selector */}
                        <div className="flex gap-1 mb-1">
                            <select
                                className="w-full bg-black/40 rounded px-2 py-1 border border-white/10 text-xs"
                                value={node.data.trackType || 'portfolio'}
                                onChange={e => updateData({ trackType: e.target.value })}
                            >
                                <option value="portfolio">Portfolio Code</option>
                                <option value="market">Custom Tickers</option>
                                <option value="copy_user">Copy User (Social)</option>
                            </select>
                        </div>

                        {/* Dynamic Inputs */}
                        {node.data.trackType === 'copy_user' ? (
                            <div className="space-y-2">
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">Target Username</div>
                                    <input
                                        className="w-full bg-black/40 rounded px-2 py-1 border border-white/10"
                                        placeholder="e.g. QuantMaster"
                                        value={node.data.target_username || ''}
                                        onChange={e => updateData({ target_username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">Target Portfolio Code</div>
                                    <input
                                        className="w-full bg-black/40 rounded px-2 py-1 border border-white/10"
                                        placeholder="e.g. ALPHA_V1"
                                        value={node.data.target_code || ''}
                                        onChange={e => updateData({ target_code: e.target.value })}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="text-xs text-gray-400 mb-1">
                                    {node.data.trackType === 'market' ? 'Tickers list' : 'Target Code'}
                                </div>
                                <input
                                    className="w-full bg-black/40 rounded px-2 py-1 border border-white/10"
                                    placeholder={node.data.trackType === 'market' ? "AAPL, NVDA, TSLA" : "Code..."}
                                    value={node.data.code}
                                    onChange={e => updateData({ code: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-2 mt-2">
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

                {node.type === 'webhook' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <select className="bg-black/40 rounded px-2 py-1 border border-white/10 text-xs" value={node.data.platform} onChange={e => updateData({ platform: e.target.value })}>
                                <option value="discord">Discord</option>
                                <option value="slack">Slack</option>
                            </select>
                        </div>
                        <input className="w-full bg-black/40 rounded px-2 py-1 border border-white/10 text-xs font-mono" placeholder="Webhook URL..." value={node.data.url} onChange={e => updateData({ url: e.target.value })} />
                        <textarea
                            className="w-full bg-black/40 rounded px-2 py-1 border border-white/10 text-xs resize-none"
                            rows={2}
                            placeholder="Message payload..."
                            value={node.data.message}
                            onChange={e => updateData({ message: e.target.value })}
                        />
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

            {/* Connection Dots (Normal) */}
            {/* If Gate has custom dots, so we might want to hide default ones or keep them key to logic? */}
            {/* Logic: If Gate uses dynamic dots. Do we need standard dots too? 
               Usually Logic blocks have Inputs (Left) and Outputs (Right).
               If Gate has 'Left' inputs for each condition? Or one main Input?
               "Connect to one output nodule for each if and else path" -> Output side.
               "Schecks for a true condition starting with the first if statement"
               Wait, does the If Gate RECEIVE a boolean signal (from a Condition block)?
               YES. It's a Logic block. It receives inputs.
               So:
               - Input 0 (Left) -> Condition A
               - Input 1 (Left) -> Condition B
               
               My dynamic renderer adds these.
               So I should NOT render standard dots for if_gate if I use custom ones.
            */}
            {node.type !== 'if_gate' && (
                <>
                    <Dot handle="top" />
                    <Dot handle="bottom" />
                    <Dot handle="left" />
                    <Dot handle="right" />
                </>
            )}
        </div>
    );
};
export default WorkflowAutomation;
